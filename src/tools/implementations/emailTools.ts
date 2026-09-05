import dns from 'dns';
import net from 'net';
import { sanitizeAndValidateDomain } from './websiteHealthTools';

export async function probeMailServerPort(host: string, port = 25, timeoutMs = 4000): Promise<{ reachable: boolean; banner?: string; error?: string }> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let banner = '';

    socket.setTimeout(timeoutMs);

    socket.connect(port, host, () => {
      // connected
    });

    socket.on('data', (data) => {
      banner = data.toString().trim();
      socket.destroy();
      resolve({ reachable: true, banner });
    });

    socket.on('timeout', () => {
      socket.destroy();
      resolve({ reachable: false, error: 'Connection timed out on SMTP port.' });
    });

    socket.on('error', (err) => {
      socket.destroy();
      resolve({ reachable: false, error: err.message });
    });
  });
}

export async function runComprehensiveEmailCheck(rawDomain: string) {
  const cleanDomain = sanitizeAndValidateDomain(rawDomain);
  const dnsPromises = dns.promises;

  let mxRecords: any[] = [];
  let txtRecords: string[][] = [];
  let dmarcRecords: string[][] = [];
  let dkimRecords: string[][] = [];

  try {
    mxRecords = await dnsPromises.resolveMx(cleanDomain);
  } catch (e) {}

  try {
    txtRecords = await dnsPromises.resolveTxt(cleanDomain);
  } catch (e) {}

  try {
    dmarcRecords = await dnsPromises.resolveTxt(`_dmarc.${cleanDomain}`);
  } catch (e) {}

  // Check common default DKIM selectors
  const selectors = ['default', 'google', 'k1', 'mail', 's1', 'dkim'];
  for (const sel of selectors) {
    try {
      const res = await dnsPromises.resolveTxt(`${sel}._domainkey.${cleanDomain}`);
      if (res && res.length > 0) {
        dkimRecords = res;
        break;
      }
    } catch (e) {}
  }

  // Parse SPF
  const flatTxt = txtRecords.map((t) => t.join(' '));
  const spfRecord = flatTxt.find((t) => t.toLowerCase().startsWith('v=spf1'));
  const dmarcFlat = dmarcRecords.map((t) => t.join(' '));
  const dmarcRecord = dmarcFlat.find((t) => t.toLowerCase().startsWith('v=dmarc1'));

  // Sort MX by priority
  const sortedMx = (mxRecords || []).sort((a, b) => a.priority - b.priority);

  let primaryMailServerReachable: boolean | undefined = undefined;
  if (sortedMx.length > 0 && sortedMx[0].exchange) {
    try {
      const probeRes = await probeMailServerPort(sortedMx[0].exchange, 25, 3000);
      primaryMailServerReachable = probeRes.reachable;
    } catch (e) {}
  }

  const hasMx = sortedMx.length > 0;
  const hasSpf = !!spfRecord;
  const hasDmarc = !!dmarcRecord;
  const hasDkim = dkimRecords.length > 0;

  return {
    domain: cleanDomain,
    checkedAt: new Date().toISOString(),
    hasMx,
    mxRecords: sortedMx,
    hasSpf,
    spfRecord,
    hasDmarc,
    dmarcRecord,
    hasDkim,
    primaryMailServerReachable,
    summary: hasMx
      ? `Found ${sortedMx.length} MX record(s). ${hasSpf ? 'SPF is configured.' : 'SPF is missing.'} ${hasDmarc ? 'DMARC is configured.' : 'DMARC is missing.'}`
      : 'No MX records found for this domain.'
  };
}
