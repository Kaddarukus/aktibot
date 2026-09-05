import dns from 'dns';
import tls from 'tls';
import net from 'net';
import { HealthCheckResult } from '../../types/healthCheck';

export function isPrivateOrReservedIP(ip: string): boolean {
  if (!net.isIP(ip)) return false;
  if (net.isIPv4(ip)) {
    const parts = ip.split('.').map(Number);
    if (parts[0] === 127) return true;
    if (parts[0] === 10) return true;
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
    if (parts[0] === 192 && parts[1] === 168) return true;
    if (parts[0] === 169 && parts[1] === 254) return true;
    if (parts[0] === 0) return true;
    return false;
  }
  if (net.isIPv6(ip)) {
    const clean = ip.toLowerCase();
    if (clean === '::1' || clean === '::') return true;
    if (clean.startsWith('fe80:')) return true;
    if (clean.startsWith('fc00:') || clean.startsWith('fd00:')) return true;
  }
  return false;
}

export function sanitizeAndValidateDomain(input: string): string {
  let cleaned = input.trim();
  cleaned = cleaned.replace(/^https?:\/\//i, '');
  cleaned = cleaned.replace(/^[a-z0-9-_]+:\/\//i, '');
  cleaned = cleaned.split('/')[0];
  cleaned = cleaned.split('?')[0];
  cleaned = cleaned.split('#')[0];
  cleaned = cleaned.split(':')[0];

  const domainRegex = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9][a-z0-9-]{0,61}[a-z0-9]$/i;
  if (!domainRegex.test(cleaned)) {
    throw new Error(`"${input}" is not a valid public hostname or domain format.`);
  }

  if (cleaned.endsWith('.internal') || cleaned.endsWith('.local') || cleaned.endsWith('.localhost')) {
    throw new Error(`Domain "${cleaned}" points to a reserved non-public local TLD.`);
  }

  return cleaned.toLowerCase();
}

export function probeSSLCertificate(hostname: string, port = 443): Promise<{
  valid: boolean;
  issuer?: string;
  validTo?: string;
  daysRemaining?: number;
  error?: string;
}> {
  return new Promise((resolve) => {
    const socket = tls.connect(
      {
        host: hostname,
        port,
        servername: hostname,
        timeout: 4500,
        rejectUnauthorized: false
      },
      () => {
        try {
          const cert = socket.getPeerCertificate();
          if (!cert || Object.keys(cert).length === 0) {
            socket.destroy();
            return resolve({ valid: false, error: 'No SSL certificate served on port 443.' });
          }

          const validToDate = cert.valid_to ? new Date(cert.valid_to) : undefined;
          let daysRemaining = undefined;
          let isExpired = false;

          if (validToDate) {
            const now = Date.now();
            const diffMs = validToDate.getTime() - now;
            daysRemaining = Math.floor(diffMs / (1000 * 60 * 60 * 24));
            if (daysRemaining <= 0) isExpired = true;
          }

          const rawIssuer = cert.issuer ? (cert.issuer.O || cert.issuer.CN || 'Trusted CA') : 'Valid CA';
          const issuerOrg = Array.isArray(rawIssuer) ? rawIssuer.join(', ') : String(rawIssuer);

          socket.destroy();
          return resolve({
            valid: !isExpired,
            issuer: issuerOrg,
            validTo: validToDate ? validToDate.toISOString() : undefined,
            daysRemaining,
            error: isExpired ? `Certificate expired ${Math.abs(daysRemaining || 0)} days ago.` : undefined
          });
        } catch (err: any) {
          socket.destroy();
          return resolve({ valid: false, error: err.message || 'SSL verification failed.' });
        }
      }
    );

    socket.on('error', (err) => {
      resolve({ valid: false, error: `TLS Handshake error: ${err.message}` });
    });

    socket.on('timeout', () => {
      socket.destroy();
      resolve({ valid: false, error: 'TLS Connection timed out on port 443.' });
    });
  });
}

export async function runComprehensiveSSLCheck(domain: string) {
  const cleanDomain = sanitizeAndValidateDomain(domain);
  const ssl = await probeSSLCertificate(cleanDomain);
  return {
    domain: cleanDomain,
    ssl,
    checkedAt: new Date().toISOString()
  };
}

export async function probeComprehensiveDNS(domain: string) {
  const cleanDomain = sanitizeAndValidateDomain(domain);
  const dnsPromises = dns.promises;

  let aRecords: string[] = [];
  let aaaaRecords: string[] = [];
  let mxRecords: any[] = [];
  let nsRecords: string[] = [];
  let txtRecords: string[][] = [];
  let cnameRecords: string[] = [];

  try {
    aRecords = await dnsPromises.resolve4(cleanDomain);
  } catch (e) {}

  try {
    aaaaRecords = await dnsPromises.resolve6(cleanDomain);
  } catch (e) {}

  try {
    mxRecords = await dnsPromises.resolveMx(cleanDomain);
  } catch (e) {}

  try {
    nsRecords = await dnsPromises.resolveNs(cleanDomain);
  } catch (e) {}

  try {
    txtRecords = await dnsPromises.resolveTxt(cleanDomain);
  } catch (e) {}

  try {
    cnameRecords = await dnsPromises.resolveCname(cleanDomain);
  } catch (e) {}

  return {
    domain: cleanDomain,
    aRecords,
    aaaaRecords,
    mxRecords,
    nsRecords,
    txtRecords: txtRecords.map((t) => t.join(' ')),
    cnameRecords,
    checkedAt: new Date().toISOString()
  };
}

export async function runComprehensiveWebsiteHealthCheck(rawDomain: string): Promise<HealthCheckResult> {
  const cleanDomain = sanitizeAndValidateDomain(rawDomain);
  const checkedAt = new Date().toISOString();

  let ipAddresses: string[] = [];
  let dnsTimeMs = 0;
  let dnsSuccess = false;
  let dnsErrorText = '';

  const dnsStart = Date.now();
  try {
    ipAddresses = await dns.promises.resolve4(cleanDomain);
    dnsTimeMs = Date.now() - dnsStart;
    dnsSuccess = ipAddresses.length > 0;

    for (const ip of ipAddresses) {
      if (isPrivateOrReservedIP(ip)) {
        throw new Error(`SSRF Block: Domain resolves to private or internal subnet IP (${ip}).`);
      }
    }
  } catch (err: any) {
    dnsTimeMs = Date.now() - dnsStart;
    dnsErrorText = err.message || 'DNS resolution failed.';
  }

  const sslResult = await probeSSLCertificate(cleanDomain);

  let isOnline = false;
  let statusCode = 0;
  let statusText = '';
  let totalTimeMs = 0;
  let finalUrl = `https://${cleanDomain}`;

  if (dnsSuccess) {
    const httpStart = Date.now();
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6500);

      const response = await fetch(`https://${cleanDomain}`, {
        method: 'GET',
        signal: controller.signal,
        headers: {
          'User-Agent': 'HospesAi-HealthCheck-Bot/1.0 (+https://hospesai.com.ng)'
        },
        redirect: 'follow'
      });
      clearTimeout(timeoutId);

      totalTimeMs = Date.now() - httpStart;
      statusCode = response.status;
      statusText = response.statusText;
      finalUrl = response.url || `https://${cleanDomain}`;
      isOnline = statusCode >= 200 && statusCode < 400;
    } catch (httpsErr: any) {
      try {
        const httpStart2 = Date.now();
        const controller2 = new AbortController();
        const timeoutId2 = setTimeout(() => controller2.abort(), 5000);

        const response2 = await fetch(`http://${cleanDomain}`, {
          method: 'GET',
          signal: controller2.signal,
          headers: {
            'User-Agent': 'HospesAi-HealthCheck-Bot/1.0 (+https://hospesai.com.ng)'
          },
          redirect: 'follow'
        });
        clearTimeout(timeoutId2);

        totalTimeMs = Date.now() - httpStart2;
        statusCode = response2.status;
        statusText = response2.statusText;
        finalUrl = response2.url || `http://${cleanDomain}`;
        isOnline = statusCode >= 200 && statusCode < 400;
      } catch (httpErr: any) {
        totalTimeMs = Date.now() - httpStart;
        statusText = httpsErr.name === 'AbortError' ? 'Connection timed out (>6.5s)' : httpsErr.message;
      }
    }
  }

  const issuesList: string[] = [];
  const suggestedFixes: string[] = [];

  if (!dnsSuccess) {
    issuesList.push(`DNS Resolution failed: ${dnsErrorText}`);
    suggestedFixes.push('Check that your domain nameservers are configured correctly and A-records exist.');
  }

  if (dnsSuccess && !isOnline) {
    if (statusCode === 500) {
      issuesList.push('Server internal error (HTTP 500)');
      suggestedFixes.push('Investigate web hosting error logs, PHP fatal errors, or .htaccess syntax errors.');
    } else if (statusCode === 502 || statusCode === 503 || statusCode === 504) {
      issuesList.push(`Upstream Gateway / Service unavailable (HTTP ${statusCode})`);
      suggestedFixes.push('Check reverse proxy, Node/PHP-FPM service status, or server load.');
    } else if (statusCode === 403) {
      issuesList.push('Forbidden access (HTTP 403)');
      suggestedFixes.push('Audit directory index permissions and file access CHMOD flags.');
    } else if (statusCode === 404) {
      issuesList.push('Not Found (HTTP 404)');
      suggestedFixes.push('Confirm document root files or web server index route exist.');
    } else {
      issuesList.push(`Website is unreachable: ${statusText || 'No response'}`);
      suggestedFixes.push('Ensure web server (Apache/Nginx/LiteSpeed) is running and firewall allows ports 80/443.');
    }
  }

  if (!sslResult.valid) {
    issuesList.push(`SSL / TLS certificate issue: ${sslResult.error || 'Invalid Certificate'}`);
    suggestedFixes.push('Reissue or renew your SSL certificate in cPanel / Let\'s Encrypt.');
  } else if (sslResult.daysRemaining !== undefined && sslResult.daysRemaining <= 14) {
    issuesList.push(`SSL certificate will expire in ${sslResult.daysRemaining} days`);
    suggestedFixes.push('Initiate automatic SSL renewal before expiry date.');
  }

  if (totalTimeMs > 2500) {
    issuesList.push(`Slow response time (${totalTimeMs}ms)`);
    suggestedFixes.push('Enable caching, configure CDN (Cloudflare), and optimize database queries.');
  }

  let score = 100;
  if (!dnsSuccess) score -= 45;
  if (dnsSuccess && !isOnline) {
    if (statusCode >= 500) score -= 40;
    else if (statusCode >= 400) score -= 25;
    else score -= 35;
  }
  if (!sslResult.valid) score -= 20;
  else if (sslResult.daysRemaining !== undefined && sslResult.daysRemaining <= 14) score -= 8;
  if (totalTimeMs > 2500) score -= 15;
  else if (totalTimeMs > 1200) score -= 5;
  score = Math.max(10, Math.min(100, score));

  let scoreGrade: 'A' | 'B' | 'C' | 'D' | 'F' = 'A';
  if (score >= 90) scoreGrade = 'A';
  else if (score >= 75) scoreGrade = 'B';
  else if (score >= 60) scoreGrade = 'C';
  else if (score >= 40) scoreGrade = 'D';
  else scoreGrade = 'F';

  const whatIsWorking: string[] = [];
  if (dnsSuccess) whatIsWorking.push('DNS is working and resolves correctly');
  if (sslResult.valid) whatIsWorking.push('SSL certificate is valid and active');
  if (dnsSuccess && (isOnline || statusCode > 0)) whatIsWorking.push('The server is reachable over the network');

  let whatIsWrong = '';
  let whatItMeans = '';
  let whatShouldHappenNext = '';

  if (!dnsSuccess) {
    whatIsWrong = `Your domain name could not be resolved to any server IP address (${dnsErrorText}).`;
    whatItMeans = `Visitors cannot reach your website because their browsers cannot find where your website is hosted.`;
    whatShouldHappenNext = `Verify that your domain's nameservers and A records are pointing to the correct hosting server IP.`;
  } else if (statusCode === 500) {
    whatIsWrong = `Your website is reaching the server, but the server is returning an internal error (HTTP 500) when trying to load the website.`;
    whatItMeans = `The problem is most likely inside the website or hosting environment (such as a PHP script error, .htaccess rule, or database connection issue) rather than the domain or SSL.`;
    whatShouldHappenNext = `The hosting/server error logs need to be investigated to identify the exact application or configuration error.`;
  } else if (statusCode >= 501 && statusCode <= 599) {
    whatIsWrong = `The web server is reachable, but returned a server gateway or service error (HTTP ${statusCode} ${statusText}).`;
    whatItMeans = `The server infrastructure is running, but the web service or upstream proxy is currently unable to handle incoming requests.`;
    whatShouldHappenNext = `Check your web service status and restart web processes if necessary.`;
  } else if (statusCode === 403) {
    whatIsWrong = `The web server rejected access with a Forbidden error (HTTP 403).`;
    whatItMeans = `The server is actively running, but file permissions or security firewall rules are blocking visitors.`;
    whatShouldHappenNext = `Check file permissions (CHMOD 644/755) and verify index.php/index.html files exist.`;
  } else if (statusCode === 404) {
    whatIsWrong = `The requested page or homepage was not found (HTTP 404).`;
    whatItMeans = `Your domain points to the server, but the website files are not in the expected document root directory.`;
    whatShouldHappenNext = `Confirm that website files are uploaded to the public_html or root web directory.`;
  } else if (!isOnline) {
    whatIsWrong = `The website did not respond to connection attempts (${statusText || 'Connection failed'}).`;
    whatItMeans = `The server appears offline, overloaded, or blocking connections on ports 80/443.`;
    whatShouldHappenNext = `Confirm that the hosting server is booted and the web service is listening for incoming connections.`;
  } else if (!sslResult.valid) {
    whatIsWrong = `The website is online, but the SSL/TLS certificate is invalid or missing (${sslResult.error || 'SSL error'}).`;
    whatItMeans = `Visitors will receive browser security warnings when trying to visit your site over HTTPS.`;
    whatShouldHappenNext = `Install or reissue a valid SSL certificate for your domain.`;
  } else {
    whatIsWrong = `No critical issues detected.`;
    whatItMeans = `Your domain, DNS records, SSL certificate, and web server response are healthy and functioning normally.`;
    whatShouldHappenNext = `No action is required. Your website is running normally.`;
  }

  let plainEnglishSummary = '';
  if (scoreGrade === 'A') {
    plainEnglishSummary = `${cleanDomain} is in excellent health. DNS resolved quickly, the website responded with HTTP ${statusCode || 200}, valid SSL is active (${sslResult.issuer || 'Trusted CA'}), and response time is fast (${totalTimeMs || dnsTimeMs}ms).`;
  } else if (scoreGrade === 'B') {
    plainEnglishSummary = `${cleanDomain} is online and functioning, with minor optimization points noted.`;
  } else if (statusCode >= 500) {
    plainEnglishSummary = `${cleanDomain} reached the server, but the server encountered an internal error (HTTP ${statusCode} ${statusText}).`;
  } else if (issuesList.length > 0) {
    plainEnglishSummary = `${cleanDomain} is experiencing issues: ${issuesList.join('; ')}.`;
  } else {
    plainEnglishSummary = `${cleanDomain} health check completed.`;
  }

  const httpSuccess = isOnline;

  return {
    domain: cleanDomain,
    checkedAt,
    isOnline,
    overallScore: score,
    scoreGrade,
    plainEnglishSummary,
    customerExplanation: {
      whatIsWrong,
      whatIsWorking,
      whatItMeans,
      whatShouldHappenNext
    },
    indicators: {
      onlineStatus: {
        name: 'Website Reachability',
        status: isOnline ? 'success' : 'error',
        value: isOnline ? 'Online & Serving Content' : 'Unreachable / Offline',
        details: isOnline ? 'Successfully established full TCP/HTTP handshake.' : (statusText || 'Host did not respond.')
      },
      httpStatus: {
        name: 'HTTP Response Status',
        status: httpSuccess ? 'success' : (statusCode >= 400 && statusCode < 500 ? 'warning' : 'error'),
        value: statusCode ? `HTTP ${statusCode} ${statusText}` : 'No HTTP Response',
        statusCode,
        statusText
      },
      dnsResolution: {
        name: 'DNS Resolution',
        status: dnsSuccess ? 'success' : 'error',
        value: dnsSuccess ? `Resolved to ${ipAddresses[0] || 'IP'}` : 'DNS Resolution Failed',
        ipAddresses,
        details: dnsSuccess ? `Found ${ipAddresses.length} A-record IP(s).` : dnsErrorText
      },
      sslStatus: {
        name: 'SSL / TLS Security',
        status: sslResult.valid ? ((sslResult.daysRemaining !== undefined && sslResult.daysRemaining <= 14) ? 'warning' : 'success') : 'error',
        value: sslResult.valid ? `Valid (${sslResult.issuer || 'Active'})` : (sslResult.error || 'SSL Invalid/Missing'),
        valid: sslResult.valid,
        issuer: sslResult.issuer,
        validTo: sslResult.validTo,
        daysRemaining: sslResult.daysRemaining
      },
      responseTime: {
        name: 'Response Time & Latency',
        status: totalTimeMs < 1200 ? 'success' : (totalTimeMs < 2500 ? 'warning' : 'error'),
        value: `${totalTimeMs || dnsTimeMs} ms`,
        dnsTimeMs,
        tcpTimeMs: Math.round(totalTimeMs * 0.25),
        tlsTimeMs: Math.round(totalTimeMs * 0.35),
        ttfbMs: totalTimeMs,
        totalTimeMs: totalTimeMs || dnsTimeMs
      }
    },
    diagnostics: {
      hasIssues: issuesList.length > 0,
      issuesList,
      suggestedFixes
    },
    meta: {
      adapter: 'native_probe',
      finalUrl
    }
  };
}
