import {
  runComprehensiveWebsiteHealthCheck,
  probeComprehensiveDNS,
  runComprehensiveSSLCheck,
  sanitizeAndValidateDomain
} from './implementations/websiteHealthTools';
import { runComprehensiveEmailCheck } from './implementations/emailTools';
import { runComprehensiveWordPressCheck } from './implementations/wordpressTools';

export interface ToolExecutionResult {
  toolName: string;
  success: boolean;
  data: any;
  error?: string;
}

export interface AgentTool {
  name: string;
  displayName: string;
  description: string;
  riskLevel: 'read_only' | 'mutation_safe' | 'mutation_sensitive';
  requiresPermission: boolean;
  execute: (params: Record<string, any>) => Promise<ToolExecutionResult>;
  formatResponse: (result: ToolExecutionResult) => string;
}

export type IntentResolution =
  | { type: 'execute_tool'; tool: AgentTool; params: Record<string, any> }
  | { type: 'prompt_for_domain'; promptMessage: string }
  | { type: 'tool_unavailable'; promptMessage: string }
  | { type: 'no_tool_match' };

export class ToolRegistry {
  private tools: Map<string, AgentTool> = new Map();

  constructor() {
    this.registerDefaults();
  }

  public registerTool(tool: AgentTool) {
    this.tools.set(tool.name, tool);
  }

  public getTool(name: string): AgentTool | undefined {
    return this.tools.get(name);
  }

  public getAllTools(): AgentTool[] {
    return Array.from(this.tools.values());
  }

  private registerDefaults() {
    // 1. checkWebsite
    this.registerTool({
      name: 'checkWebsite',
      displayName: 'Website Health Check',
      description: 'Comprehensive health check examining HTTP reachability, SSL security, DNS resolution, and latency.',
      riskLevel: 'read_only',
      requiresPermission: false,
      execute: async (params) => {
        const domain = sanitizeAndValidateDomain(params.domain);
        const data = await runComprehensiveWebsiteHealthCheck(domain);
        return { toolName: 'checkWebsite', success: true, data };
      },
      formatResponse: (result) => {
        const d = result.data;
        const ind = d.indicators;
        const expl = d.customerExplanation;
        const checkIcon = (st: string) => (st === 'success' ? '✓' : st === 'warning' ? '⚠' : '✕');

        let md = `### 🌐 Website Health Check: \`${d.domain}\`\n\n`;
        md += `**Health Score:** **${d.overallScore}/100 (Grade ${d.scoreGrade})**\n\n`;
        md += `**Diagnostic Status:**\n`;
        md += `- ${checkIcon(ind.onlineStatus.status)} **Website Reachability:** ${ind.onlineStatus.value}\n`;
        md += `- ${checkIcon(ind.httpStatus.status)} **HTTP Status:** ${ind.httpStatus.value}\n`;
        md += `- ${checkIcon(ind.dnsResolution.status)} **DNS Resolution:** ${ind.dnsResolution.value}\n`;
        md += `- ${checkIcon(ind.sslStatus.status)} **SSL Security:** ${ind.sslStatus.value}\n`;
        md += `- ${checkIcon(ind.responseTime.status)} **Response Time:** ${ind.responseTime.value}\n\n`;

        if (expl) {
          if (d.diagnostics.hasIssues) {
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
            md += `**SUMMARY:**\n${d.plainEnglishSummary}\n\n`;
            md += `**WHAT IT MEANS:**\n${expl.whatItMeans}\n\n`;
          }
        }
        return md;
      }
    });

    // 2. checkDNS
    this.registerTool({
      name: 'checkDNS',
      displayName: 'DNS Zone & Delegation Diagnosis',
      description: 'Inspects public DNS records: A, AAAA, CNAME, MX, TXT, and Nameservers.',
      riskLevel: 'read_only',
      requiresPermission: false,
      execute: async (params) => {
        const domain = sanitizeAndValidateDomain(params.domain);
        const data = await probeComprehensiveDNS(domain);
        return { toolName: 'checkDNS', success: true, data };
      },
      formatResponse: (result) => {
        const d = result.data;
        let md = `### 📡 DNS Diagnosis: \`${d.domain}\`\n\n`;
        md += `**DNS Records Found:**\n`;
        md += `- **Nameservers (NS):** ${d.nsRecords.length > 0 ? d.nsRecords.join(', ') : '✕ None found'}\n`;
        md += `- **IPv4 (A Records):** ${d.aRecords.length > 0 ? d.aRecords.join(', ') : '✕ None found'}\n`;
        md += `- **IPv6 (AAAA Records):** ${d.aaaaRecords.length > 0 ? d.aaaaRecords.join(', ') : 'None (Optional)'}\n`;
        md += `- **Mail Exchange (MX):** ${d.mxRecords.length > 0 ? d.mxRecords.map((m: any) => `${m.exchange} (pri: ${m.priority})`).join(', ') : '✕ None found'}\n`;
        md += `- **TXT Records:** ${d.txtRecords.length > 0 ? `${d.txtRecords.length} record(s)` : 'None found'}\n\n`;

        if (d.aRecords.length === 0 && d.nsRecords.length === 0) {
          md += `**What this means:**\nYour domain does not currently resolve to any IP address and has no nameservers. Visitors cannot reach your site.\n\n`;
          md += `**What should happen next:**\nConfigure your domain's nameservers at your registrar to point to your hosting provider.`;
        } else if (d.mxRecords.length === 0) {
          md += `**What this means:**\nYour domain has A-records for web traffic, but no MX records were found. This means email sent to your domain will not be delivered.\n\n`;
          md += `**What should happen next:**\nIf you use email on this domain, add your mail server's MX records to your DNS zone.`;
        } else {
          md += `**What this means:**\nYour DNS records are published and resolving correctly across public nameservers.`;
        }
        return md;
      }
    });

    // 3. checkSSL
    this.registerTool({
      name: 'checkSSL',
      displayName: 'SSL / TLS Certificate Diagnosis',
      description: 'Inspects certificate validity, expiry date, days remaining, and CA issuer.',
      riskLevel: 'read_only',
      requiresPermission: false,
      execute: async (params) => {
        const domain = sanitizeAndValidateDomain(params.domain);
        const data = await runComprehensiveSSLCheck(domain);
        return { toolName: 'checkSSL', success: true, data };
      },
      formatResponse: (result) => {
        const d = result.data;
        const ssl = d.ssl;
        let md = `### 🔒 SSL Certificate Diagnosis: \`${d.domain}\`\n\n`;

        if (ssl.valid) {
          md += `**SSL Status:**\n`;
          md += `✓ Certificate is valid and active\n`;
          md += `✓ Issuer: ${ssl.issuer}\n`;
          if (ssl.daysRemaining !== undefined) {
            md += `${ssl.daysRemaining <= 14 ? '⚠' : '✓'} Expires in: **${ssl.daysRemaining} days** (${ssl.validTo ? new Date(ssl.validTo).toLocaleDateString() : ''})\n\n`;
          }
          if (ssl.daysRemaining !== undefined && ssl.daysRemaining <= 14) {
            md += `**What this means:**\nYour website is secure right now, but the SSL certificate will expire soon.\n\n`;
            md += `**What should happen next:**\nRenew your certificate to prevent browser security warnings.`;
          } else {
            md += `**What this means:**\nYour website has a valid SSL certificate. HTTPS connections are encrypted and secure.`;
          }
        } else {
          md += `**SSL Status:**\n`;
          md += `✕ Certificate invalid or missing: ${ssl.error || 'Connection failed'}\n\n`;
          md += `**What this means:**\nYour website's security certificate is not valid. Visitors may see a security warning.\n\n`;
          md += `**What should happen next:**\nInstall or reissue an SSL certificate in your hosting panel (e.g. cPanel AutoSSL or Let's Encrypt).`;
        }
        return md;
      }
    });

    // 4. checkEmail
    this.registerTool({
      name: 'checkEmail',
      displayName: 'Email Domain & Deliverability Diagnosis',
      description: 'Checks MX records, SPF, DMARC, DKIM public records, and mail server reachability.',
      riskLevel: 'read_only',
      requiresPermission: false,
      execute: async (params) => {
        const domain = sanitizeAndValidateDomain(params.domain);
        const data = await runComprehensiveEmailCheck(domain);
        return { toolName: 'checkEmail', success: true, data };
      },
      formatResponse: (result) => {
        const d = result.data;
        let md = `### ✉️ Email Configuration Diagnosis: \`${d.domain}\`\n\n`;
        md += `**Email Records:**\n`;
        md += `- ${d.hasMx ? '✓' : '✕'} **MX Records:** ${d.hasMx ? `${d.mxRecords.length} found` : 'Missing'}\n`;
        md += `- ${d.hasSpf ? '✓' : '⚠'} **SPF Record:** ${d.hasSpf ? 'Configured' : 'Missing (Risk of spam flagging)'}\n`;
        md += `- ${d.hasDmarc ? '✓' : '⚠'} **DMARC Policy:** ${d.hasDmarc ? 'Configured' : 'Missing'}\n`;
        md += `- ${d.hasDkim ? '✓' : 'ℹ'} **DKIM:** ${d.hasDkim ? 'Detected on standard selector' : 'Not detected on standard selectors'}\n\n`;

        if (!d.hasMx) {
          md += `**What this means:**\nYour domain has no MX record. This means mail servers do not know where to deliver incoming email.\n\n`;
          md += `**What should happen next:**\nAdd MX records for your mail service (Google Workspace, Microsoft 365, or cPanel mail).`;
        } else if (!d.hasSpf) {
          md += `**What this means:**\nYour email server can receive mail, but without an SPF record, emails you send may land in spam folders.\n\n`;
          md += `**What should happen next:**\nAdd an SPF TXT record (e.g. \`v=spf1 include:spf.yourhost.com ~all\`) to authorize your outgoing mail servers.`;
        } else {
          md += `**What this means:**\nYour email records (MX and SPF) are configured properly for receiving and sending mail.`;
        }
        return md;
      }
    });

    // 5. checkWordPress
    this.registerTool({
      name: 'checkWordPress',
      displayName: 'WordPress Health & Compatibility Diagnosis',
      description: 'Public health checks for WordPress REST API, login endpoints, and error detection.',
      riskLevel: 'read_only',
      requiresPermission: false,
      execute: async (params) => {
        const domain = sanitizeAndValidateDomain(params.domain);
        const data = await runComprehensiveWordPressCheck(domain);
        return { toolName: 'checkWordPress', success: true, data };
      },
      formatResponse: (result) => {
        const d = result.data;
        let md = `### 📝 WordPress Diagnosis: \`${d.domain}\`\n\n`;
        if (d.isWordPress) {
          md += `**Public WordPress Findings:**\n`;
          md += `✓ WordPress installation detected\n`;
          md += `- REST API: ${d.publicCheck.hasRestApi ? '✓ Available' : 'Restricted / Offline'}\n`;
          md += `- Login Page (\`/wp-login.php\`): ${d.publicCheck.loginPageAccessible ? '✓ Accessible' : 'Not accessible'}\n\n`;
          if (d.publicCheck.errorSignatures.length > 0) {
            md += `**Errors detected:**\n${d.publicCheck.errorSignatures.join('\n')}\n\n`;
          }
          md += `*Note: Private checks (database connectivity, plugin updates, and error logs) require connecting your WordPress site with authenticated access.*`;
        } else {
          md += `**Result:**\nNo public WordPress installation signatures were detected on \`${d.domain}\`.\n\n`;
          md += `If this website runs on WordPress, it may be blocking public REST endpoints or static headers.`;
        }
        return md;
      }
    });

    // 6. checkHosting (Read-Only Adapter Architecture)
    this.registerTool({
      name: 'checkHosting',
      displayName: 'Hosting Provider Account Diagnosis',
      description: 'Inspects hosting resources, disk usage, PHP version, and database status via provider adapter.',
      riskLevel: 'read_only',
      requiresPermission: false,
      execute: async (params) => {
        return {
          toolName: 'checkHosting',
          success: false,
          data: null,
          error: "I don't currently have access to your hosting account."
        };
      },
      formatResponse: () => {
        return `### 🖥️ Hosting Diagnosis\n\nI don't currently have access to your hosting account.\n\nTo diagnose server resources, disk space, and PHP error logs, connect your hosting provider in Settings.`;
      }
    });
  }

  public extractDomain(text: string): string | null {
    const trimmed = text.trim();
    // Pattern 1: Pure domain
    const urlOrDomainRegex = /^(?:https?:\/\/)?(?:www\.)?([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+)(?:\/.*)?$/i;
    const match = trimmed.match(urlOrDomainRegex);
    if (match && match[1] && match[1].includes('.') && !match[1].includes(' ')) {
      return match[1].toLowerCase();
    }

    // Pattern 2: Explicit command phrase
    const phraseRegex = /(?:check|health|status|ping|inspect|test|probe|is|investigate|diagnose|incident)\s+(?:website\s+|site\s+|domain\s+|for\s+|incident\s+on\s+)?(?:https?:\/\/)?(?:www\.)?([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+)/i;
    const phraseMatch = trimmed.match(phraseRegex);
    if (phraseMatch && phraseMatch[1] && phraseMatch[1].includes('.')) {
      return phraseMatch[1].toLowerCase();
    }

    return null;
  }

  public resolveIntent(userMessage: string): IntentResolution {
    const text = userMessage.toLowerCase();
    const domain = this.extractDomain(userMessage);

    // Intent 1: Incident investigation
    if (text.includes('incident') || (text.includes('investigate') && domain)) {
      if (domain) {
        const tool = this.getTool('checkWebsite')!;
        return { type: 'execute_tool', tool, params: { domain } };
      }
      return {
        type: 'prompt_for_domain',
        promptMessage: 'Please specify the domain name of the website you would like me to investigate.'
      };
    }

    // Intent 2: DNS
    if (text.includes('dns') || text.includes('nameserver') || text.includes('mx record') || text.includes('why isn\'t my domain working') || text.includes('domain not working')) {
      if (domain) {
        const tool = this.getTool('checkDNS')!;
        return { type: 'execute_tool', tool, params: { domain } };
      }
      return {
        type: 'prompt_for_domain',
        promptMessage: 'Which domain name would you like me to inspect DNS records for?'
      };
    }

    // Intent 3: SSL
    if (text.includes('ssl') || text.includes('tls') || text.includes('certificate') || text.includes('https error') || text.includes('is my ssl working')) {
      if (domain) {
        const tool = this.getTool('checkSSL')!;
        return { type: 'execute_tool', tool, params: { domain } };
      }
      return {
        type: 'prompt_for_domain',
        promptMessage: 'Which domain name would you like me to check the SSL certificate for?'
      };
    }

    // Intent 4: Email
    if (text.includes('email') || text.includes('spf') || text.includes('dmarc') || text.includes('dkim') || text.includes('mail delivery')) {
      if (domain) {
        const tool = this.getTool('checkEmail')!;
        return { type: 'execute_tool', tool, params: { domain } };
      }
      return {
        type: 'prompt_for_domain',
        promptMessage: 'Which domain name would you like me to diagnose email and MX configuration for?'
      };
    }

    // Intent 5: WordPress
    if (text.includes('wordpress') || text.includes('wp-admin') || text.includes('wp site')) {
      if (domain) {
        const tool = this.getTool('checkWordPress')!;
        return { type: 'execute_tool', tool, params: { domain } };
      }
      return {
        type: 'prompt_for_domain',
        promptMessage: 'Which WordPress website domain would you like me to check?'
      };
    }

    // Intent 6: Hosting
    if (text.includes('hosting') || text.includes('cpanel') || text.includes('disk space') || text.includes('whm') || text.includes('server usage')) {
      const tool = this.getTool('checkHosting')!;
      return { type: 'execute_tool', tool, params: { domain: domain || '' } };
    }

    // Intent 7: General Website Health Check
    if (
      domain ||
      text.includes('check website') ||
      text.includes('is my website online') ||
      text.includes('why is my website down') ||
      text.includes('health check') ||
      text.includes('site down')
    ) {
      if (domain) {
        const tool = this.getTool('checkWebsite')!;
        return { type: 'execute_tool', tool, params: { domain } };
      }
      return {
        type: 'prompt_for_domain',
        promptMessage: 'Which website domain would you like me to check? (e.g., example.com)'
      };
    }

    return { type: 'no_tool_match' };
  }
}

export const globalToolRegistry = new ToolRegistry();
