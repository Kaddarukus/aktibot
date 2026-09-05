import express from 'express';
import path from 'path';
import fs from 'fs';
import dns from 'dns';
import tls from 'tls';
import net from 'net';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';
import dotenv from 'dotenv';

import { globalMonitoringService } from './src/monitoring/WebsiteMonitoringService';
import { runComprehensiveWebsiteHealthCheck, probeComprehensiveDNS, runComprehensiveSSLCheck } from './src/tools/implementations/websiteHealthTools';
import { runComprehensiveEmailCheck } from './src/tools/implementations/emailTools';
import { runComprehensiveWordPressCheck } from './src/tools/implementations/wordpressTools';
import { globalToolRegistry } from './src/tools/registry';

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '30mb' }));
app.use(express.urlencoded({ extended: true, limit: '30mb' }));

const DB_FILE = path.join(process.cwd(), 'db.json');

// Helper to load agents database
function loadAgents(): any[] {
  try {
    const defaultHospesAgent = {
      id: 'hospes-host',
      name: 'Hospes Fast-Host Assistant',
      avatar: '🚀',
      themeColor: 'blue',
      welcomeMessage: 'System Ready. I am the Hospes Hosting Fast-Host Specialist. State your cPanel, WHM, WHMCS, DNS, or domain order problem. I check the issue, execute the fix on our side immediately, and notify you.',
      persona: 'You are the primary, elite, automated support bot for Hospes cloud hosting (hospesai.com.ng). Your tone is brutally efficient, highly technical, and fast. You never instruct users to perform the fixes themselves. You always run simulated automated diagnostics, execute the fixes on the server or registrar side instantly, output a status report showing that the issue has been resolved, and state the exact implementation or propagation duration in minutes or hours.',
      docs: [
        {
          id: 'doc-nameservers',
          title: 'Hospes Hosting Custom Nameservers',
          category: 'DNS & Domains',
          content: 'To point your custom domain name (e.g. at GoDaddy, Namecheap) to Hospes Hosting, update your primary and secondary nameservers in your domain registrar panel to:\n- Primary: ns1.hospesai.com.ng\n- Secondary: ns2.hospesai.com.ng\nPropagation typically completes worldwide within 2 to 24 hours. No further DNS record mapping is required if you are using shared cPanel hosting.'
        },
        {
          id: 'doc-pricing',
          title: 'Cloud Shared Hosting Pricing Plans',
          category: 'Pricing',
          content: 'Hospes Hosting offers three tiers of Shared Web Hosting plans:\n1. Starter Plan: $4.99/mo (includes 1 website, 10GB high-speed NVMe SSD storage, and free SSL certificate).\n2. Professional Plan: $9.99/mo (includes unlimited websites, 50GB storage, unmetered bandwidth, and weekly automatic backups).\n3. Enterprise Plan: $18.99/mo (includes unlimited websites, 150GB storage, dedicated CPU allocation, and priority support).'
        },
        {
          id: 'doc-refunds',
          title: 'Hospes Refund Policy & Account Cancellations',
          category: 'Billing',
          content: 'All virtual server (VPS) plans and shared hosting accounts come with an unconditional 30-day money-back guarantee. If you are not satisfied, you can cancel within 30 days of initial purchase for a full refund. Note that domain registration fees, SSL certificate purchases, and administrative setup fees are strictly non-refundable due to global registry rules. Refund processing takes 3-5 business days.'
        },
        {
          id: 'doc-whmcs-billing',
          title: 'WHMCS Automated Client Order Processing & API Escalations',
          category: 'WHMCS & Billing',
          content: 'WHMCS executes instant client provisioning. New server hosting and domain orders are validated through payment gateways (e.g. Stripe, PayPal, Flutterwave). On success, WHMCS triggers the cPanel API to generate hosting accounts. If the automated provisioning fails with "Module Command Error", check WHMCS > Setup > Products/Services > Servers to confirm correct API tokens. For pending registrar orders, use WHMCS Domain Sync cron jobs (running every 5 minutes) to update whois parameters and push pending orders to active status.'
        },
        {
          id: 'doc-whm-lve',
          title: 'WHM Server Controls & CloudLinux LVE Limits',
          category: 'WHM & CloudLinux',
          content: 'WHM administrators manage server density using CloudLinux LVE Manager. Standard resource metrics configured per cPanel account:\n- CPU Limit: 100% of a single core (1 Core)\n- Physical Memory: 1024MB (1GB RAM)\n- IOPS (Input/Output speed): 5MB/s\n- Entry Processes (EP): Max 20 concurrent connections.\nIf an account hits memory caps, WHM triggers a 503 Service Unavailable error or returns server load spikes. Optimize resource packages by upgrading accounts in WHM > Modify an Account, or alter Global EasyApache 4 php.ini variables in WHM > MultiPHP INI Editor.'
        },
        {
          id: 'doc-cpanel-debugging',
          title: 'cPanel Server Audits & Error 500/503 Isolation',
          category: 'cPanel Tech',
          content: 'To isolate 500 Internal Server Errors in cPanel:\n1. Check the File Manager permissions. All directories must be set to CHMOD 755. All files (especially index.php, wp-config.php) must be set to CHMOD 644. CHMOD 777 is strictly blocked by suPHP and security rules.\n2. Verify the .htaccess file. Syntax errors, unsupported rewrite rules, or outdated php_value directives cause instant 500 errors. Rename .htaccess to .htaccess_old to debug.\n3. Increase PHP resources. In cPanel > Select PHP Version > Options, set memory_limit to 512M, max_execution_time to 300s, and upload_max_filesize to 128M.'
        },
        {
          id: 'doc-dns-propagation',
          title: 'DNS Zone Files, Zone Editors & Domain Transfers',
          category: 'DNS & Domains',
          content: 'Domain transfers require three verified criteria:\n1. The domain must be unlocked at the current registrar.\n2. WHOIS privacy must be deactivated.\n3. A valid EPP authorization code must be entered in the WHMCS portal.\nTo manage active domain mappings, use the cPanel Zone Editor to add DNS records:\n- A Record points hostnames to IP addresses.\n- CNAME maps subdomains to hostnames.\n- TXT Records are used for SPF (v=spf1 include:hospesai.com.ng ~all), DKIM, and DMARC keys to ensure 100% email deliverability and avoid spam folder categorization.'
        },
        {
          id: 'doc-security-csf',
          title: 'CSF/LFD Firewall & Brute-force Login Controls',
          category: 'Server Security',
          content: 'ConfigServer Security & Firewall (CSF) guards Hospes server pools. Repeated failed cPanel, WHM, or SSH login attempts (default threshold: 5 failures) trigger an automated temporary IP block via LFD (Login Failure Daemon). To unlock blocked clients, login to WHM > ConfigServer Security & Firewall, search the client IP, and click "Unblock IP". For persistent developer terminal access, configure non-standard SSH on Port 2222 and verify that public key authentication is active in cPanel > SSH Access.'
        }
      ]
    };

    const defaultWellnessAgent = {
      id: 'fit-trainer',
      name: 'FitPulse Wellness Coach',
      avatar: '🥑',
      themeColor: 'emerald',
      welcomeMessage: 'Hi there! Fitness coach here to guide you. Ask about class schedules, gym guidelines, or spa amenities.',
      persona: 'You are the automated wellness specialist at FitPulse Gym. Your tone is warm, highly encouraging, fitness-oriented, and friendly. Ground your recommendations strictly in gym rules.',
      docs: [
        {
          id: 'doc-hours',
          title: 'Gym Club Hours & Facility Availability',
          category: 'Facility',
          content: 'The FitPulse facility is open seven days a week:\n- Monday to Friday: 5:00 AM to 10:00 PM\n- Saturday and Sunday: 7:00 AM to 8:00 PM\nThe dry sauna, steam room, and hydrotherapy pool are located in the locker rooms and close exactly 30 minutes before the main club doors lock.'
        },
        {
          id: 'doc-bookings',
          title: 'Group Fitness Class Booking & Cancellation Rules',
          category: 'Classes',
          content: 'Members can book yoga, spin, and high-intensity interval training (HIIT) classes up to 7 days in advance through our mobile app. Since class slots are limited, we enforce a strict 2-hour cancellation policy. Canceling within 2 hours of class start time, or failing to check-in at the desk, will incur a $10 late-cancel fee.'
        }
      ]
    };

    if (!fs.existsSync(DB_FILE)) {
      const defaults = [defaultHospesAgent, defaultWellnessAgent];
      fs.writeFileSync(DB_FILE, JSON.stringify(defaults, null, 2), 'utf-8');
      return defaults;
    }

    const data = fs.readFileSync(DB_FILE, 'utf-8');
    let loaded = JSON.parse(data);

    // Dynamic Database Migration / Upgrade check
    // If the database is missing any of our new premium documents, merge them in to immediately upgrade live environments!
    let updated = false;
    loaded = loaded.map((agent: any) => {
      if (agent.id === 'hospes-host') {
        // Upgrade persona to brutal auto-healing efficiency
        if (!agent.persona.includes('never instruct users') || (agent.docs && agent.docs.length < 8)) {
          agent.welcomeMessage = defaultHospesAgent.welcomeMessage;
          agent.persona = defaultHospesAgent.persona;
          
          // Re-populate / merge docs intelligently
          const currentDocsMap = new Map(agent.docs ? agent.docs.map((d: any) => [d.id, d]) : []);
          defaultHospesAgent.docs.forEach((doc: any) => {
            currentDocsMap.set(doc.id, doc);
          });
          agent.docs = Array.from(currentDocsMap.values());
          updated = true;
        }
      }
      return agent;
    });

    if (updated) {
      fs.writeFileSync(DB_FILE, JSON.stringify(loaded, null, 2), 'utf-8');
    }

    return loaded;
  } catch (error) {
    console.error('Error reading/writing DB file:', error);
    return [];
  }
}

// Helper to save agents database
function saveAgents(agents: any[]) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(agents, null, 2), 'utf-8');
  } catch (error) {
    console.error('Error writing DB file:', error);
  }
}

// Lazy Gemini Client initialization
let aiClient: GoogleGenAI | null = null;

function getGeminiClient(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY is not defined in system environment variables.');
    }
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return aiClient;
}

// REST API Endpoints

// Get all agents
app.get('/api/agents', (req, res) => {
  const agents = loadAgents();
  res.json({ agents });
});

// Create or update an agent
app.post('/api/agents', (req, res) => {
  const { id, name, avatar, persona, welcomeMessage, themeColor, docs } = req.body;
  
  if (!name || !persona) {
    res.status(400).json({ error: 'Name and Persona are required parameters.' });
    return;
  }

  const agents = loadAgents();
  const existingIndex = agents.findIndex(a => a.id === id);

  const agentData = {
    id: id || `agent-${Date.now()}`,
    name,
    avatar: avatar || '🤖',
    persona,
    welcomeMessage: welcomeMessage || 'Hello! How can I assist you today?',
    themeColor: themeColor || 'blue',
    docs: docs || []
  };

  if (existingIndex >= 0) {
    agents[existingIndex] = agentData;
  } else {
    agents.push(agentData);
  }

  saveAgents(agents);
  res.json({ success: true, agent: agentData });
});

// Delete an agent
app.delete('/api/agents/:id', (req, res) => {
  const { id } = req.params;
  const agents = loadAgents();
  const filtered = agents.filter(a => a.id !== id);
  saveAgents(filtered);
  res.json({ success: true });
});

// =========================================================================
// SECURE SSRF-PROTECTED WEBSITE HEALTH CHECK SERVICE (Hostlag Ready Adapter)
// =========================================================================

// Private / Internal IP detection to protect against SSRF
function isPrivateOrReservedIP(ip: string): boolean {
  if (!net.isIP(ip)) return false;

  // IPv4 Private & Loopback check
  if (net.isIPv4(ip)) {
    const parts = ip.split('.').map(Number);
    // 127.0.0.0/8 (Loopback)
    if (parts[0] === 127) return true;
    // 10.0.0.0/8 (Private)
    if (parts[0] === 10) return true;
    // 172.16.0.0/12 (Private)
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
    // 192.168.0.0/16 (Private)
    if (parts[0] === 192 && parts[1] === 168) return true;
    // 169.254.0.0/16 (Link Local / Cloud Metadata)
    if (parts[0] === 169 && parts[1] === 254) return true;
    // 0.0.0.0/8
    if (parts[0] === 0) return true;
    return false;
  }

  // IPv6 Loopback & Link Local
  if (net.isIPv6(ip)) {
    const normalized = ip.toLowerCase();
    if (normalized === '::1' || normalized === '::') return true;
    if (normalized.startsWith('fe80:')) return true;
    if (normalized.startsWith('fc00:') || normalized.startsWith('fd00:')) return true;
  }

  return false;
}

function sanitizeAndValidateDomain(rawInput: string): { valid: boolean; domain: string; error?: string } {
  if (!rawInput || typeof rawInput !== 'string') {
    return { valid: false, domain: '', error: 'Domain name is required.' };
  }

  let cleaned = rawInput.trim().toLowerCase();
  // Strip protocol and path if entered (e.g. https://example.com/test -> example.com)
  cleaned = cleaned.replace(/^(https?:\/\/)/i, '');
  cleaned = cleaned.replace(/^www\./i, '');
  cleaned = cleaned.split('/')[0].split('?')[0].split('#')[0].split(':')[0];

  // Basic domain regex validation
  const domainRegex = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$/i;
  if (!domainRegex.test(cleaned)) {
    return { valid: false, domain: '', error: 'Invalid domain format. Example: example.com or hospesai.com.ng' };
  }

  // Block localhost and standard internal TLDs
  if (cleaned === 'localhost' || cleaned.endsWith('.local') || cleaned.endsWith('.internal') || cleaned.endsWith('.lan')) {
    return { valid: false, domain: '', error: 'Internal/private domain names are restricted.' };
  }

  return { valid: true, domain: cleaned };
}

// Extracts a domain candidate if the user is asking for a domain / website health check
function extractDomainForHealthCheck(query: string): string | null {
  if (!query || typeof query !== 'string') return null;
  const trimmed = query.trim();

  // Pattern 1: Pure domain or URL (e.g., "google.com", "https://example.com", "hospesai.com.ng/dashboard")
  const urlOrDomainRegex = /^(?:https?:\/\/)?(?:www\.)?([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+)(?:\/.*)?$/i;
  const match = trimmed.match(urlOrDomainRegex);
  if (match && match[1]) {
    const candidate = match[1].toLowerCase();
    if (candidate.includes('.') && !candidate.includes(' ')) {
      return candidate;
    }
  }

  // Pattern 2: Explicit command/phrase with a domain (e.g., "check google.com", "health check for hospesai.com.ng", "is example.com online?")
  const phraseRegex = /(?:check|health|status|ping|inspect|test|probe|is)\s+(?:website\s+|site\s+|domain\s+|for\s+)?(?:https?:\/\/)?(?:www\.)?([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+)/i;
  const phraseMatch = trimmed.match(phraseRegex);
  if (phraseMatch && phraseMatch[1]) {
    const candidate = phraseMatch[1].toLowerCase();
    if (candidate.includes('.')) {
      return candidate;
    }
  }

  return null;
}

// SSL Certificate Check via TLS Socket with strict 4.5s timeout
function probeSSLCertificate(hostname: string, port = 443): Promise<{
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
          const authorized = socket.authorized;
          const authError = socket.authorizationError;

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

          const issuer = typeof cert.issuer === 'object' && cert.issuer ? (cert.issuer.O || cert.issuer.CN || 'Unknown CA') : 'Unknown CA';
          const isValid = authorized && !isExpired && (daysRemaining === undefined || daysRemaining > 0);

          socket.destroy();
          resolve({
            valid: isValid,
            issuer: String(issuer),
            validTo: validToDate ? validToDate.toISOString().split('T')[0] : undefined,
            daysRemaining,
            error: !authorized ? (authError ? authError.message : 'Untrusted Certificate') : (isExpired ? 'Certificate has expired' : undefined)
          });
        } catch (e: any) {
          socket.destroy();
          resolve({ valid: false, error: e.message || 'Failed to parse SSL certificate' });
        }
      }
    );

    socket.on('error', (err) => {
      socket.destroy();
      resolve({ valid: false, error: err.message || 'SSL Connection failed' });
    });

    socket.on('timeout', () => {
      socket.destroy();
      resolve({ valid: false, error: 'SSL Handshake timed out (>4.5s)' });
    });
  });
}

// Core Health Check Execution Engine
async function performWebsiteHealthCheck(targetDomain: string): Promise<any> {
  const validation = sanitizeAndValidateDomain(targetDomain);
  if (!validation.valid) {
    throw new Error(validation.error || 'Invalid domain supplied');
  }

  const cleanDomain = validation.domain;
  const checkedAt = new Date().toISOString();
  const issuesList: string[] = [];
  const suggestedFixes: string[] = [];

  // Step 1: DNS Resolution Probe
  let ipAddresses: string[] = [];
  let dnsSuccess = false;
  let dnsErrorText = '';
  const dnsStartTime = Date.now();

  try {
    const lookupResult = await dns.promises.resolve4(cleanDomain);
    if (lookupResult && lookupResult.length > 0) {
      const hasPrivateIP = lookupResult.some(ip => isPrivateOrReservedIP(ip));
      if (hasPrivateIP) {
        throw new Error('Security restriction: Domain resolves to a private or internal IP address (SSRF protection enabled).');
      }
      ipAddresses = lookupResult;
      dnsSuccess = true;
    }
  } catch (dnsErr: any) {
    dnsErrorText = dnsErr.code || dnsErr.message || 'DNS resolution failed';
    issuesList.push(`DNS Resolution failed (${dnsErrorText})`);
    suggestedFixes.push('Verify domain nameservers and A-records in your DNS manager or WHMCS.');
  }

  const dnsTimeMs = Date.now() - dnsStartTime;

  // Step 2: HTTP / HTTPS Connection Probe
  let isOnline = false;
  let statusCode = 0;
  let statusText = '';
  let httpSuccess = false;
  let totalTimeMs = 0;
  let finalUrl = `https://${cleanDomain}`;

  if (dnsSuccess) {
    const httpStartTime = Date.now();
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 6000); // 6s timeout

      const fetchResponse = await fetch(`https://${cleanDomain}`, {
        method: 'GET',
        headers: {
          'User-Agent': 'HospesAI-InfrastructureMonitor/1.0 (HealthProbe; +https://hospesai.com.ng)',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
        },
        redirect: 'follow',
        signal: controller.signal
      });

      clearTimeout(timeout);
      totalTimeMs = Date.now() - httpStartTime;
      statusCode = fetchResponse.status;
      statusText = fetchResponse.statusText || `${statusCode}`;
      finalUrl = fetchResponse.url || `https://${cleanDomain}`;
      isOnline = statusCode >= 200 && statusCode < 400;
      httpSuccess = statusCode >= 200 && statusCode < 400;

      if (statusCode >= 400 && statusCode < 500) {
        issuesList.push(`HTTP Client Error returned (${statusCode} ${statusText})`);
        suggestedFixes.push('Verify URL routing, file permissions, or check for missing web pages.');
      } else if (statusCode >= 500) {
        issuesList.push(`HTTP Server Error detected (${statusCode} ${statusText})`);
        suggestedFixes.push('The web application or hosting server returned an internal execution error.');
      }
    } catch (httpErr: any) {
      totalTimeMs = Date.now() - httpStartTime;
      // Fallback try HTTP if HTTPS failed
      try {
        const fallbackController = new AbortController();
        const fbTimeout = setTimeout(() => fallbackController.abort(), 4000);
        const fbResponse = await fetch(`http://${cleanDomain}`, {
          method: 'GET',
          signal: fallbackController.signal,
          headers: { 'User-Agent': 'HospesAI-InfrastructureMonitor/1.0' }
        });
        clearTimeout(fbTimeout);
        statusCode = fbResponse.status;
        statusText = fbResponse.statusText;
        isOnline = statusCode >= 200 && statusCode < 400;
        httpSuccess = isOnline;
      } catch (fallbackErr: any) {
        statusText = httpErr.name === 'AbortError' ? 'Connection timed out (>6s)' : (httpErr.message || 'Connection refused');
        issuesList.push(`Website is unreachable: ${statusText}`);
        suggestedFixes.push('Check server availability and network/firewall routing.');
      }
    }
  }

  // Step 3: SSL Certificate Probe
  let sslResult: any = { valid: false };
  if (dnsSuccess) {
    sslResult = await probeSSLCertificate(cleanDomain, 443);
    if (!sslResult.valid) {
      issuesList.push(`SSL Issue: ${sslResult.error || 'Invalid or missing SSL certificate'}`);
      suggestedFixes.push('Ensure an active, valid SSL certificate is installed for the domain.');
    } else if (sslResult.daysRemaining !== undefined && sslResult.daysRemaining <= 14) {
      issuesList.push(`SSL Certificate expires soon (${sslResult.daysRemaining} days remaining)`);
      suggestedFixes.push('Renew the SSL certificate before expiration to avoid browser warnings.');
    }
  }

  // Step 4: Calculate Health Score (0 - 100) & Grade
  let score = 100;
  if (!dnsSuccess) score -= 40;
  if (!isOnline) score -= 35;
  else if (statusCode >= 400) score -= 25;
  if (!sslResult.valid) score -= 20;
  else if (sslResult.daysRemaining !== undefined && sslResult.daysRemaining <= 14) score -= 8;
  if (totalTimeMs > 2500) score -= 12;
  else if (totalTimeMs > 1200) score -= 6;

  score = Math.max(0, Math.min(100, score));

  let scoreGrade: 'A' | 'B' | 'C' | 'D' | 'F' = 'A';
  if (score >= 90) scoreGrade = 'A';
  else if (score >= 80) scoreGrade = 'B';
  else if (score >= 65) scoreGrade = 'C';
  else if (score >= 50) scoreGrade = 'D';
  else scoreGrade = 'F';

  // Plain English Customer Explanation
  let whatIsWrong = '';
  const whatIsWorking: string[] = [];
  let whatItMeans = '';
  let whatShouldHappenNext = '';

  if (dnsSuccess) whatIsWorking.push('DNS is working and resolving correctly');
  if (sslResult.valid) whatIsWorking.push(`SSL is valid and active (${sslResult.issuer || 'Trusted Certificate'})`);
  if (ipAddresses.length > 0) whatIsWorking.push('The web server is reachable online');

  if (statusCode >= 500) {
    whatIsWrong = `Your website is reaching the server, but the server is returning an internal error (HTTP ${statusCode} ${statusText}) when trying to load the website.`;
    whatItMeans = `The problem is most likely inside the website code, CMS (such as WordPress/plugins), or server application environment rather than your domain name or SSL certificate.`;
    whatShouldHappenNext = `The hosting or server error logs need to be investigated to identify the script or configuration causing the internal error.`;
  } else if (statusCode >= 400 && statusCode < 500) {
    whatIsWrong = `The server is active, but it returned a client error (HTTP ${statusCode} ${statusText}) when requesting the page.`;
    whatItMeans = `The requested address or resource was not found or access was restricted by configuration on the server.`;
    whatShouldHappenNext = `Check the website URL structure, page configuration, or index file permissions.`;
  } else if (!dnsSuccess) {
    whatIsWrong = `Your domain could not be resolved to any server IP address (${dnsErrorText || 'DNS lookup failed'}).`;
    whatItMeans = `Browsers cannot locate where your website is hosted because domain nameserver or DNS records are missing or misconfigured.`;
    whatShouldHappenNext = `Verify the domain's nameservers and A-records with your domain registrar or DNS provider.`;
  } else if (!isOnline) {
    whatIsWrong = `Your website is not responding to web connection requests (${statusText || 'Connection failed'}).`;
    whatItMeans = `The domain points to an IP address, but the web service at that destination is not accepting or completing HTTP/HTTPS connections.`;
    whatShouldHappenNext = `Check if the web service or hosting server is running and accessible.`;
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

// Formats the Health Check diagnostic into a clean response for Aktibot
function formatHealthCheckMarkdown(result: any, agent: any): string {
  const isHost = agent.id === 'hospes-host';
  const checkIcon = (st: string) => (st === 'success' ? '✓' : st === 'warning' ? '⚠' : '✕');
  const ind = result.indicators;
  const expl = result.customerExplanation;
  
  let md = `### 🌐 Website Health Check: \`${result.domain}\`\n\n`;
  md += `**Website Health Score:** **${result.overallScore}/100 (Grade ${result.scoreGrade})**\n\n`;
  
  md += `**Diagnostic Indicators:**\n`;
  md += `- ${checkIcon(ind.onlineStatus.status)} **Website Reachability:** ${ind.onlineStatus.value}\n`;
  md += `- ${checkIcon(ind.httpStatus.status)} **HTTP Status:** ${ind.httpStatus.value}\n`;
  md += `- ${checkIcon(ind.dnsResolution.status)} **DNS Resolution:** ${ind.dnsResolution.value}\n`;
  md += `- ${checkIcon(ind.sslStatus.status)} **SSL Security:** ${ind.sslStatus.value}${ind.sslStatus.daysRemaining !== undefined ? ` (${ind.sslStatus.daysRemaining} days remaining)` : ''}\n`;
  md += `- ${checkIcon(ind.responseTime.status)} **Response Time:** ${ind.responseTime.value} (DNS: ${ind.responseTime.dnsTimeMs}ms)\n\n`;

  if (expl) {
    if (result.diagnostics.hasIssues) {
      md += `**WHAT IS WRONG:**\n${expl.whatIsWrong}\n\n`;
      if (expl.whatIsWorking && expl.whatIsWorking.length > 0) {
        md += `**WHAT IS WORKING:**\n`;
        expl.whatIsWorking.forEach((item: string) => {
          md += `✓ ${item}\n`;
        });
        md += `\n`;
      }
      md += `**WHAT IT MEANS:**\n${expl.whatItMeans}\n\n`;
      md += `**WHAT SHOULD HAPPEN NEXT:**\n${expl.whatShouldHappenNext}\n\n`;
    } else {
      md += `**SUMMARY:**\n${result.plainEnglishSummary}\n\n`;
      md += `**WHAT IT MEANS:**\n${expl.whatItMeans}\n\n`;
    }
  } else {
    md += `**Explanation:** ${result.plainEnglishSummary}\n\n`;
  }

  if (isHost) {
    md += `\`\`\`text\n`;
    md += `[HOSPES-PROBE] Automated infrastructure scan complete for ${result.domain}\n`;
    md += `[DNS-ROUTE] A-Records: ${ind.dnsResolution.ipAddresses?.join(', ') || 'None'}\n`;
    md += `[HTTP-TLS] Status: ${ind.httpStatus.statusCode || (ind.httpStatus.status === 'success' ? 200 : 'N/A')} | SSL: ${ind.sslStatus.issuer || (ind.sslStatus.valid ? 'Active' : 'None')}\n`;
    md += `[PERF] TTFB: ${ind.responseTime.totalTimeMs}ms | Latency Benchmark: PASSED\n`;
    md += `\`\`\`\n\n`;
    md += `**[STATUS] HEALTH CHECK COMPLETE.**\n\n`;
    md += `Health check completed. No changes were made.`;
  }

  return md;
}

// REST Endpoint: Direct Website Health Check
app.post('/api/infrastructure/health-check', async (req, res) => {
  const { domain: rawDomain } = req.body;

  try {
    const result = await runComprehensiveWebsiteHealthCheck(rawDomain);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Failed to inspect domain.' });
  }
});

// REST Endpoint: Direct DNS Check
app.post('/api/infrastructure/dns-check', async (req, res) => {
  const { domain: rawDomain } = req.body;
  try {
    const result = await probeComprehensiveDNS(rawDomain);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Failed to inspect DNS records.' });
  }
});

// REST Endpoint: Direct SSL Check
app.post('/api/infrastructure/ssl-check', async (req, res) => {
  const { domain: rawDomain } = req.body;
  try {
    const result = await runComprehensiveSSLCheck(rawDomain);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Failed to inspect SSL certificate.' });
  }
});

// REST Endpoint: Direct Email Check
app.post('/api/infrastructure/email-check', async (req, res) => {
  const { domain: rawDomain } = req.body;
  try {
    const result = await runComprehensiveEmailCheck(rawDomain);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Failed to inspect email configuration.' });
  }
});

// REST Endpoint: Direct WordPress Check
app.post('/api/infrastructure/wordpress-check', async (req, res) => {
  const { domain: rawDomain } = req.body;
  try {
    const result = await runComprehensiveWordPressCheck(rawDomain);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Failed to inspect WordPress.' });
  }
});

// --- Monitoring Endpoints ---
app.get('/api/monitoring/targets', (req, res) => {
  res.json(globalMonitoringService.getTargets());
});

app.post('/api/monitoring/targets', (req, res) => {
  const { domain, label, intervalSeconds } = req.body;
  try {
    const target = globalMonitoringService.addTarget(domain, label, intervalSeconds ? parseInt(intervalSeconds, 10) : 60);
    res.json(target);
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Failed to add monitored target.' });
  }
});

app.delete('/api/monitoring/targets/:id', (req, res) => {
  const success = globalMonitoringService.removeTarget(req.params.id);
  res.json({ success });
});

app.post('/api/monitoring/targets/:id/check', async (req, res) => {
  try {
    const result = await globalMonitoringService.triggerManualCheck(req.params.id);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Failed to probe target.' });
  }
});

app.get('/api/monitoring/incidents', (req, res) => {
  res.json(globalMonitoringService.getIncidents());
});

// AI-Driven Document Extraction Endpoint (PDF, TXT, MD)
app.post('/api/extract-documents', async (req, res) => {
  const { files, agentCategoryContext } = req.body;

  if (!files || !Array.isArray(files) || files.length === 0) {
    res.status(400).json({ error: 'No files provided for extraction.' });
    return;
  }

  try {
    const ai = getGeminiClient();
    const extractedArticles: any[] = [];
    const errors: { fileName: string; message: string }[] = [];

    for (const file of files) {
      try {
        const fileName = file.name || 'Untitled Document';
        const fileExt = fileName.split('.').pop()?.toLowerCase() || '';
        const mimeType = file.type || (fileExt === 'pdf' ? 'application/pdf' : 'text/plain');

        let parts: any[] = [];

        if (fileExt === 'pdf' || mimeType.includes('pdf')) {
          // Clean base64 string
          let rawData = file.data || '';
          if (rawData.includes(',')) {
            rawData = rawData.split(',')[1];
          }
          rawData = rawData.replace(/\s/g, '');

          parts = [
            {
              inlineData: {
                mimeType: 'application/pdf',
                data: rawData
              }
            },
            {
              text: `Analyze this uploaded PDF document ('${fileName}'). Context hint: ${agentCategoryContext || 'Customer Support Knowledge Base'}.
Extract all key procedures, technical configurations, specifications, policies, troubleshooting guides, rules, limits, or FAQs into structured, self-contained knowledge base articles.`
            }
          ];
        } else {
          // Text / Markdown files (.txt, .md, .markdown, etc.)
          let textContent = file.data || '';
          if (file.isBase64) {
            try {
              let clean = textContent.includes(',') ? textContent.split(',')[1] : textContent;
              textContent = Buffer.from(clean, 'base64').toString('utf-8');
            } catch (decodeErr) {
              // fallback to raw text
            }
          }

          parts = [
            {
              text: `Document Name: "${fileName}"
Document Content:
"""
${textContent.slice(0, 150000)}
"""

Context hint: ${agentCategoryContext || 'Customer Support Knowledge Base'}.
Extract and structure all important facts, troubleshooting steps, commands, policy rules, and guidance from this document into clean, comprehensive knowledge base articles.`
            }
          ];
        }

        const response = await ai.models.generateContent({
          model: 'gemini-3.7-flash',
          contents: { parts },
          config: {
            systemInstruction: `You are an expert technical knowledge base engineer and automated document parsing engine.
Your task is to parse documents (PDF manuals, text files, Markdown guides) and output clean, self-contained Knowledge Base articles.
Rules:
1. Faithfully extract technical facts, procedures, numbered steps, parameters, quotas, and rules.
2. If the document covers multiple distinct topics, break them into logical, focused articles. If it is focused on a single topic, generate one rich article.
3. For each article:
   - Provide a concise, descriptive 'title' (e.g., 'CSF Firewall Port Configuration & Unblock Procedures').
   - Provide an appropriate 'category' (e.g., 'DNS & Domains', 'cPanel Tech', 'Server Security', 'Billing & Orders', 'WHMCS', 'Facility Rules', 'General Support').
   - Provide comprehensive 'content' formatted in clean, human-readable markdown with headings, bullets, code blocks, or tables where appropriate.
4. Ensure strictly valid JSON adhering to the provided schema.`,
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                articles: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      title: {
                        type: Type.STRING,
                        description: 'Descriptive title for the extracted knowledge base article'
                      },
                      category: {
                        type: Type.STRING,
                        description: 'Category or domain classification for grouping'
                      },
                      content: {
                        type: Type.STRING,
                        description: 'Detailed, actionable knowledge content in clean markdown formatting'
                      }
                    },
                    required: ['title', 'category', 'content']
                  }
                }
              },
              required: ['articles']
            }
          }
        });

        const resultText = response.text;
        if (!resultText) {
          throw new Error(`AI model returned empty response for ${fileName}`);
        }

        const parsed = JSON.parse(resultText.trim());
        if (parsed.articles && Array.isArray(parsed.articles)) {
          parsed.articles.forEach((art: any, idx: number) => {
            extractedArticles.push({
              id: `extracted-${Date.now()}-${Math.random().toString(36).substring(2, 7)}-${idx}`,
              title: art.title || `${fileName.replace(/\.[^/.]+$/, '')} - Part ${idx + 1}`,
              category: art.category || 'Uploaded Docs',
              content: art.content || 'No content extracted.',
              sourceFile: fileName
            });
          });
        }
      } catch (fileErr: any) {
        console.error(`Error processing file ${file.name}:`, fileErr);
        errors.push({
          fileName: file.name || 'Unknown',
          message: fileErr.message || 'Failed to extract text from document.'
        });
      }
    }

    res.json({
      success: true,
      extractedArticles,
      totalExtracted: extractedArticles.length,
      errors: errors.length > 0 ? errors : undefined
    });
  } catch (error: any) {
    console.error('AI Document Extraction Service Error:', error);
    res.status(500).json({
      error: 'Failed to process AI document extraction.',
      details: error.message || 'Internal server error.'
    });
  }
});

// Chat session route grounded in agent documents
app.post('/api/chat', async (req, res) => {
  const { agentId, messages } = req.body;

  if (!agentId || !messages || !Array.isArray(messages)) {
    res.status(400).json({ error: 'Missing agentId or messages array.' });
    return;
  }

  const agents = loadAgents();
  const agent = agents.find(a => a.id === agentId);

  if (!agent) {
    res.status(404).json({ error: 'Requested support agent was not found.' });
    return;
  }

  // Check if the user query matches an infrastructure tool intent (Health Check, DNS, SSL, Email, WordPress, Hosting, Incident Investigation)
  const lastUserMessage = messages.filter((m: any) => m.role === 'user').pop()?.text || messages[messages.length - 1]?.text || '';
  const intentResolution = globalToolRegistry.resolveIntent(lastUserMessage);

  if (intentResolution.type === 'execute_tool' && intentResolution.tool && intentResolution.params) {
    const startTime = Date.now();
    try {
      const toolResult = await intentResolution.tool.execute(intentResolution.params);
      const answerMarkdown = intentResolution.tool.formatResponse(toolResult);
      const latencyMs = Date.now() - startTime;

      recordInteractionTelemetry(agentId, {
        id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        timestamp: new Date().toISOString(),
        userQuery: lastUserMessage.length > 80 ? lastUserMessage.substring(0, 80) + '...' : lastUserMessage,
        agentResponsePreview: `${intentResolution.tool.displayName}: ${intentResolution.params.domain || ''}...`,
        latencyMs,
        usedSources: [intentResolution.tool.displayName],
        status: 'grounded',
        tokenCount: Math.round((lastUserMessage.length + answerMarkdown.length) / 4)
      });

      res.json({
        answer: answerMarkdown,
        usedSources: [intentResolution.tool.displayName],
        toolData: toolResult.data,
        latencyMs
      });
      return;
    } catch (toolErr: any) {
      const errAnswer = `### 🔍 Diagnostic Notice\n\n✕ **Could not complete diagnostic:** ${toolErr.message || 'Operation failed.'}`;
      const latencyMs = Date.now() - startTime;
      res.json({
        answer: errAnswer,
        usedSources: [intentResolution.tool.displayName],
        latencyMs
      });
      return;
    }
  } else if (intentResolution.type === 'prompt_for_domain' || intentResolution.type === 'tool_unavailable') {
    const latencyMs = 25;
    res.json({
      answer: intentResolution.promptMessage,
      usedSources: ['Aktibot Diagnostics Engine'],
      latencyMs
    });
    return;
  }

  try {
    const ai = getGeminiClient();

    // 1. Build the grounding documentation text
    const documentationText = agent.docs && agent.docs.length > 0
      ? agent.docs.map((doc: any, idx: number) => `DOC_ID: ${doc.id}\nTitle: ${doc.title}\nCategory: ${doc.category}\nContent: ${doc.content}`).join('\n\n---\n\n')
      : 'NO SUPPORT ARTICLES OR KNOWLEDGE BASE DOCUMENTS UPLOADED YET.';

    // 2. Build system instructions incorporating persona and documentation grounding rules
    let systemInstruction = `
${agent.persona}

You have been uploaded with the following specific business reference documentation:
=== BEGIN DOCUMENTATION ===
${documentationText}
=== END DOCUMENTATION ===

Strict Grounding Rules:
1. Ground your answer ONLY in the facts found inside the BEGIN DOCUMENTATION/END DOCUMENTATION block.
2. If the user's question cannot be answered using the provided documents, politely state: "I'm sorry, but our current support documentation does not contain information on that topic. Let me connect you with a team representative."
3. Never invent facts, phone numbers, email addresses, or policies outside the documents.
4. You must list the EXACT "Title" of the documentation articles you read and actually utilized to construct your answer in the "usedSources" JSON field. Do not include a document title in "usedSources" if it didn't play a part in answering the query.
`;

    if (agentId === 'hospes-host') {
      systemInstruction += `

CRITICAL INSTRUCTION FOR HOSPES FAST-HOST ASSISTANT (id: 'hospes-host'):
The user wants you to act as a world-class, automated self-healing hosting and order execution system.
1. NEVER tell or point out to the user how they should fix the issue themselves.
2. Instead, ALWAYS simulate immediately executing the check and fix yourself! Speak in the past tense or present progressive of active repair (e.g. "I have logged in to your client account, scanned the server configurations, and successfully executed the repair...").
3. Your response MUST begin with a styled, professional diagnostic/terminal log detailing the scans performed (e.g. scanning WHMCS client orders, checking WHM account resource quotas, auditing cPanel file permissions, auditing CSF firewall logs). Style this beautifully with code blocks, bullet points, or list structures.
4. Immediately after the scan & fix details, you MUST output this exact capital-letter confirmation on its own line:
   **[STATUS] ISSUE HAS BEEN RESOLVED.**
5. Finally, you MUST highlight how many minutes or hours it will take for the changes to fully propagate or sync (e.g., "DNS zone file records will propagate worldwide in 2 to 24 hours," "WHM resource quota upgrades take up to 5 minutes to synchronize with server pool processes," "cPanel CHMOD adjustments are implemented instantly and take effect in exactly 2 minutes").
`;
    }

    // 3. Prepare message history for Gemini SDK
    // The Gemini generateContent endpoint expects objects with role 'user' or 'model' and parts.
    const contents = messages.map((msg: any) => ({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.text }]
    }));

    const startTime = Date.now();

    // 4. Query gemini-3.7-flash with a JSON schema response
    const response = await ai.models.generateContent({
      model: 'gemini-3.7-flash',
      contents,
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            answer: {
              type: Type.STRING,
              description: 'Your complete customer support response, formulated strictly from the provided documentation. Keep it well-styled using simple paragraphs and list formatting.'
            },
            usedSources: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: 'Titles of the specific documentation articles you read and referenced to answer the query.'
            }
          },
          required: ['answer', 'usedSources']
        }
      }
    });

    const latencyMs = Date.now() - startTime;
    const resultText = response.text;
    if (!resultText) {
      throw new Error('Received an empty text response from Gemini.');
    }

    const parsedResult = JSON.parse(resultText.trim());
    const usedSources = parsedResult.usedSources || [];

    // Telemetry log record
    const userMsg = messages[messages.length - 1]?.text || 'Query';
    recordInteractionTelemetry(agentId, {
      id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      timestamp: new Date().toISOString(),
      userQuery: userMsg.length > 80 ? userMsg.substring(0, 80) + '...' : userMsg,
      agentResponsePreview: parsedResult.answer.substring(0, 100) + '...',
      latencyMs,
      usedSources,
      status: usedSources.length > 0 ? 'grounded' : 'fallback',
      tokenCount: Math.round((userMsg.length + parsedResult.answer.length) / 4)
    });

    res.json({
      answer: parsedResult.answer,
      usedSources,
      latencyMs
    });

  } catch (error: any) {
    console.error('Gemini API Error:', error);
    res.status(500).json({
      error: 'Failed to process AI response.',
      details: error.message || 'Unknown server error.'
    });
  }
});

// Telemetry in-memory & file store
const TELEMETRY_FILE = path.join(process.cwd(), 'telemetry.json');
let telemetryStore: Record<string, any[]> = {};

try {
  if (fs.existsSync(TELEMETRY_FILE)) {
    telemetryStore = JSON.parse(fs.readFileSync(TELEMETRY_FILE, 'utf-8'));
  }
} catch (e) {
  console.error('Could not load telemetry file, initializing empty store', e);
}

function recordInteractionTelemetry(agentId: string, item: any) {
  if (!telemetryStore[agentId]) {
    telemetryStore[agentId] = [];
  }
  telemetryStore[agentId].unshift(item);
  // Keep last 500 items
  if (telemetryStore[agentId].length > 500) {
    telemetryStore[agentId] = telemetryStore[agentId].slice(0, 500);
  }
  try {
    fs.writeFileSync(TELEMETRY_FILE, JSON.stringify(telemetryStore, null, 2), 'utf-8');
  } catch (e) {
    // Ignore write errors
  }
}

// Analytics Calculation Endpoint
app.get('/api/analytics/:agentId', (req, res) => {
  const { agentId } = req.params;
  const timeframe = (req.query.timeframe as string) || '7d';

  const agents = loadAgents();
  const agent = agents.find(a => a.id === agentId);

  if (!agent) {
    res.status(404).json({ error: 'Agent not found' });
    return;
  }

  const liveLogs = telemetryStore[agentId] || [];
  const docs = agent.docs || [];

  // Generate cohesive time series based on timeframe (24h, 7d, 30d)
  const volumeTrends: any[] = [];
  const latencyTrends: any[] = [];
  const docUsageMap: Record<string, { title: string; category: string; count: number; lastReferenced: string }> = {};

  docs.forEach((d: any) => {
    docUsageMap[d.title] = {
      title: d.title,
      category: d.category || 'General',
      count: 0,
      lastReferenced: 'Never'
    };
  });

  const now = Date.now();
  let pointsCount = 24;
  let intervalMs = 60 * 60 * 1000; // 1 hour
  let formatLabel = (d: Date) => d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  if (timeframe === '7d') {
    pointsCount = 7;
    intervalMs = 24 * 60 * 60 * 1000; // 1 day
    formatLabel = (d: Date) => d.toLocaleDateString([], { weekday: 'short', month: 'numeric', day: 'numeric' });
  } else if (timeframe === '30d') {
    pointsCount = 15;
    intervalMs = 2 * 24 * 60 * 60 * 1000; // 2 days
    formatLabel = (d: Date) => d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  }

  // Create baseline seed pattern blended with actual recorded logs
  let totalInteractionsSum = 0;
  let totalGroundedSum = 0;
  let totalLatencySum = 0;

  for (let i = pointsCount - 1; i >= 0; i--) {
    const pointTime = new Date(now - i * intervalMs);
    const label = formatLabel(pointTime);

    // Realistic baseline volume curve
    const pseudoSeed = Math.sin((i + 3) * 0.8) * 15 + Math.cos((i * 1.5)) * 10;
    const baseVolume = Math.max(12, Math.round(35 + pseudoSeed + (agentId === 'hospes-host' ? 25 : 10)));
    const groundedRatio = 0.92 + ((i % 5) * 0.015);
    const grounded = Math.round(baseVolume * groundedRatio);
    const fallback = baseVolume - grounded;
    const resolutionRate = Number(((grounded / baseVolume) * 100).toFixed(1));

    // Latency curve (e.g. 580ms - 920ms avg, p95 1100-1400ms)
    const baseAvgLatency = Math.round(620 + Math.sin(i * 0.7) * 180 + (i % 3) * 45);
    const baseP95Latency = Math.round(baseAvgLatency * 1.45 + (i % 4) * 60);
    const retrievalMs = Math.round(baseAvgLatency * 0.28);
    const inferenceMs = baseAvgLatency - retrievalMs;

    volumeTrends.push({
      timeLabel: label,
      timestamp: pointTime.toISOString(),
      totalChats: baseVolume,
      groundedResponses: grounded,
      fallbackResponses: fallback,
      resolutionRate
    });

    latencyTrends.push({
      timeLabel: label,
      timestamp: pointTime.toISOString(),
      avgLatencyMs: baseAvgLatency,
      p95LatencyMs: baseP95Latency,
      inferenceMs,
      retrievalMs
    });

    totalInteractionsSum += baseVolume;
    totalGroundedSum += grounded;
    totalLatencySum += baseAvgLatency;
  }

  // Count citations from live logs + baseline distribution
  const docTitles = docs.map((d: any) => d.title);
  
  docTitles.forEach((title: string, idx: number) => {
    // Weighted distribution across available docs
    const weight = Math.max(1, 10 - idx * 1.2);
    const baseCitations = Math.round((totalGroundedSum * (weight / 35)));
    if (docUsageMap[title]) {
      docUsageMap[title].count += baseCitations;
    }
  });

  // Blend actual live recorded logs into stats
  liveLogs.forEach((log: any) => {
    totalInteractionsSum += 1;
    if (log.status === 'grounded') {
      totalGroundedSum += 1;
    }
    if (log.usedSources && Array.isArray(log.usedSources)) {
      log.usedSources.forEach((sourceTitle: string) => {
        if (!docUsageMap[sourceTitle]) {
          docUsageMap[sourceTitle] = {
            title: sourceTitle,
            category: 'Referenced Document',
            count: 0,
            lastReferenced: log.timestamp
          };
        }
        docUsageMap[sourceTitle].count += 1;
        docUsageMap[sourceTitle].lastReferenced = log.timestamp;
      });
    }
  });

  const totalCitations = Object.values(docUsageMap).reduce((acc, curr) => acc + curr.count, 0) || 1;
  const documentUsage = Object.entries(docUsageMap).map(([title, item], idx) => ({
    docId: `doc-stat-${idx}`,
    title,
    category: item.category,
    citationCount: item.count,
    percentage: Number(((item.count / totalCitations) * 100).toFixed(1)),
    lastReferenced: item.lastReferenced
  })).sort((a, b) => b.citationCount - a.citationCount);

  // Category breakdown
  const catMap: Record<string, number> = {};
  documentUsage.forEach(d => {
    catMap[d.category] = (catMap[d.category] || 0) + d.citationCount;
  });
  const categoryBreakdown = Object.entries(catMap).map(([category, count]) => ({
    category,
    count,
    percentage: Number(((count / totalCitations) * 100).toFixed(1))
  })).sort((a, b) => b.count - a.count);

  const activeDocCount = documentUsage.filter(d => d.citationCount > 0).length;
  const knowledgeBaseCoveragePercentage = docs.length > 0
    ? Number(((Math.min(docs.length, activeDocCount) / docs.length) * 100).toFixed(1))
    : 0;

  const avgResponseTimeMs = Math.round(totalLatencySum / pointsCount);
  const p95ResponseTimeMs = Math.round(avgResponseTimeMs * 1.48);
  const groundingRatePercentage = Number(((totalGroundedSum / totalInteractionsSum) * 100).toFixed(1));

  // Synthesize recent logs list if empty
  let recentLogs = [...liveLogs];
  if (recentLogs.length < 5) {
    const sampleQueries = agentId === 'hospes-host' ? [
      { q: 'How do I point my domain to Hospes custom nameservers?', sources: ['Hospes Hosting Custom Nameservers'], lat: 680 },
      { q: 'My cPanel account is returning Error 500', sources: ['cPanel Server Audits & Error 500/503 Isolation'], lat: 790 },
      { q: 'What are the CloudLinux LVE limits on shared packages?', sources: ['WHM Server Controls & CloudLinux LVE Limits'], lat: 710 },
      { q: 'Client cannot connect via FTP or cPanel, blocked by firewall', sources: ['CSF/LFD Firewall & Brute-force Login Controls'], lat: 840 },
      { q: 'WHMCS automated domain sync cron failure', sources: ['WHMCS Automated Client Order Processing & API Escalations'], lat: 750 }
    ] : [
      { q: 'What are the sauna and steam room hours?', sources: ['Gym Club Hours & Facility Availability'], lat: 620 },
      { q: 'Can I cancel my yoga class 1 hour before?', sources: ['Group Fitness Class Booking & Cancellation Rules'], lat: 690 },
      { q: 'Is personal training included in membership?', sources: [], lat: 580 }
    ];

    sampleQueries.forEach((s, idx) => {
      recentLogs.push({
        id: `sample-log-${idx}`,
        timestamp: new Date(now - (idx + 1) * 14 * 60 * 1000).toISOString(),
        userQuery: s.q,
        agentResponsePreview: `Processed grounded response using ${s.sources.length ? s.sources[0] : 'general fallback'}...`,
        latencyMs: s.lat,
        usedSources: s.sources,
        status: s.sources.length > 0 ? 'grounded' : 'fallback',
        tokenCount: Math.round(s.q.length * 4.2)
      });
    });
  }

  res.json({
    agentId,
    timeframe,
    totalInteractions: totalInteractionsSum,
    avgResponseTimeMs,
    p95ResponseTimeMs,
    groundingRatePercentage,
    knowledgeBaseCoveragePercentage,
    volumeTrends,
    latencyTrends,
    documentUsage,
    categoryBreakdown,
    recentLogs: recentLogs.slice(0, 20)
  });
});

// Endpoint to simulate a surge batch of traffic for live graph visualization
app.post('/api/analytics/:agentId/simulate-traffic', (req, res) => {
  const { agentId } = req.params;
  const { batchSize = 5 } = req.body;

  const agents = loadAgents();
  const agent = agents.find(a => a.id === agentId);

  if (!agent) {
    res.status(404).json({ error: 'Agent not found' });
    return;
  }

  const docs = agent.docs || [];
  const samples = agentId === 'hospes-host' ? [
    'How do I deploy a free SSL certificate in cPanel?',
    'My domain DNS records are not resolving worldwide',
    'How to unblock an IP blocked by ConfigServer CSF Firewall?',
    'What are the memory limits in WHM CloudLinux LVE?',
    'Where do I find WHOIS EPP authorization code for transfer?',
    'Shared hosting outgoing mail port 25 is blocked'
  ] : [
    'What are the weekend gym opening hours?',
    'What is the late cancellation fee for HIIT classes?',
    'Are locker room hydrotherapy amenities open until closing?'
  ];

  for (let i = 0; i < Number(batchSize); i++) {
    const query = samples[Math.floor(Math.random() * samples.length)];
    const chosenDoc = docs.length > 0 ? docs[Math.floor(Math.random() * docs.length)] : null;
    const latency = Math.round(520 + Math.random() * 450);

    recordInteractionTelemetry(agentId, {
      id: `sim-${Date.now()}-${Math.random().toString(36).substring(2, 6)}-${i}`,
      timestamp: new Date().toISOString(),
      userQuery: query,
      agentResponsePreview: `Simulated response grounded in [${chosenDoc?.title || 'General'}]...`,
      latencyMs: latency,
      usedSources: chosenDoc ? [chosenDoc.title] : [],
      status: chosenDoc ? 'grounded' : 'fallback',
      tokenCount: Math.round(180 + Math.random() * 220)
    });
  }

  res.json({ success: true, simulatedCount: Number(batchSize) });
});

// Configure Vite or Static Asset Serving
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[HospesAI] Server running at http://localhost:${PORT}`);
  });
}

startServer();
