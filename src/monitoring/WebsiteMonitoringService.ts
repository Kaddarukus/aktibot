import { MonitoredTarget, MonitoringIncident, MonitoredStatus } from './types';
import { runComprehensiveWebsiteHealthCheck, sanitizeAndValidateDomain } from '../tools/implementations/websiteHealthTools';
import { HealthCheckResult } from '../types/healthCheck';

export class WebsiteMonitoringService {
  private targets: Map<string, MonitoredTarget> = new Map();
  private incidents: Map<string, MonitoringIncident> = new Map();
  private lastProbeTimestamps: Map<string, number> = new Map();
  private intervalTimer: NodeJS.Timeout | null = null;
  private isProcessing = false;

  // Rate-limiting / anti-abuse safeguards
  private readonly MIN_INTERVAL_SECONDS = 30;
  private readonly PROBE_COOLDOWN_MS = 25000; // Mandatory 25s between repeated checks on same domain
  private readonly MAX_CONCURRENT_PROBES = 2;

  constructor() {
    // Seed initial monitored domain (sankofaresearchhub.com)
    this.addTarget('sankofaresearchhub.com', 'Research Hub', 60);
    this.addTarget('hospesai.com.ng', 'Hospes Main Portal', 300);

    // Start background monitoring tick (runs every 10 seconds to check scheduled targets)
    this.startScheduler();
  }

  public getTargets(): MonitoredTarget[] {
    return Array.from(this.targets.values());
  }

  public getTarget(id: string): MonitoredTarget | undefined {
    return this.targets.get(id);
  }

  public getIncidents(): MonitoringIncident[] {
    return Array.from(this.incidents.values()).sort(
      (a, b) => new Date(b.detectedAt).getTime() - new Date(a.detectedAt).getTime()
    );
  }

  public getActiveIncidents(): MonitoringIncident[] {
    return this.getIncidents().filter((inc) => inc.status === 'open');
  }

  public addTarget(rawDomain: string, label?: string, intervalSeconds = 60): MonitoredTarget {
    const domain = sanitizeAndValidateDomain(rawDomain);

    const existing = Array.from(this.targets.values()).find((t) => t.domain === domain);
    if (existing) {
      return existing;
    }

    const clampedInterval = Math.max(this.MIN_INTERVAL_SECONDS, intervalSeconds);
    const id = `target-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const newTarget: MonitoredTarget = {
      id,
      domain,
      label: label || domain,
      intervalSeconds: clampedInterval,
      status: 'healthy',
      isPaused: false,
      consecutiveFailures: 0,
      createdAt: new Date().toISOString()
    };

    this.targets.set(id, newTarget);
    // Queue initial check
    setTimeout(() => this.probeTarget(id), 1000);
    return newTarget;
  }

  public removeTarget(id: string): boolean {
    return this.targets.delete(id);
  }

  public togglePause(id: string): MonitoredTarget | null {
    const target = this.targets.get(id);
    if (!target) return null;
    target.isPaused = !target.isPaused;
    return target;
  }

  public async triggerManualCheck(id: string): Promise<HealthCheckResult> {
    const target = this.targets.get(id);
    if (!target) throw new Error('Target not found');

    const lastTime = this.lastProbeTimestamps.get(target.domain) || 0;
    if (Date.now() - lastTime < 5000) {
      if (target.lastResult) return target.lastResult;
    }

    return await this.probeTarget(id);
  }

  private startScheduler(): void {
    if (this.intervalTimer) clearInterval(this.intervalTimer);
    this.intervalTimer = setInterval(() => this.tick(), 10000);
  }

  private async tick(): Promise<void> {
    if (this.isProcessing) return;
    this.isProcessing = true;

    try {
      const now = Date.now();
      const targetsToCheck: MonitoredTarget[] = [];

      for (const target of this.targets.values()) {
        if (target.isPaused) continue;

        const lastTime = this.lastProbeTimestamps.get(target.domain) || 0;
        const cooldownPassed = now - lastTime >= this.PROBE_COOLDOWN_MS;
        const intervalPassed = !target.lastChecked || now - new Date(target.lastChecked).getTime() >= target.intervalSeconds * 1000;

        if (cooldownPassed && intervalPassed) {
          targetsToCheck.push(target);
          if (targetsToCheck.length >= this.MAX_CONCURRENT_PROBES) break;
        }
      }

      for (const target of targetsToCheck) {
        await this.probeTarget(target.id).catch((err) => {
          console.error(`[Monitoring] Error probing ${target.domain}:`, err.message);
        });
      }
    } finally {
      this.isProcessing = false;
    }
  }

  public async probeTarget(id: string): Promise<HealthCheckResult> {
    const target = this.targets.get(id);
    if (!target) throw new Error('Target not found');

    this.lastProbeTimestamps.set(target.domain, Date.now());
    const previousStatus = target.status;

    let result: HealthCheckResult;
    try {
      result = await runComprehensiveWebsiteHealthCheck(target.domain);
    } catch (err: any) {
      // Offline / DNS error synthetic result for state tracking
      result = {
        domain: target.domain,
        checkedAt: new Date().toISOString(),
        isOnline: false,
        overallScore: 0,
        scoreGrade: 'F',
        plainEnglishSummary: `${target.domain} failed connection: ${err.message}`,
        customerExplanation: {
          whatIsWrong: `Your website is unreachable: ${err.message}`,
          whatIsWorking: [],
          whatItMeans: `The server or domain could not be contacted over the network.`,
          whatShouldHappenNext: `Check server availability and DNS routing.`
        },
        indicators: {
          onlineStatus: { name: 'Website Reachability', status: 'error', value: 'Unreachable' },
          httpStatus: { name: 'HTTP Status', status: 'error', value: 'No response' },
          dnsResolution: { name: 'DNS Resolution', status: 'error', value: 'Failed' },
          sslStatus: { name: 'SSL Security', status: 'error', value: 'Unknown', valid: false },
          responseTime: { name: 'Response Time', status: 'error', value: 'N/A' }
        },
        diagnostics: { hasIssues: true, issuesList: [err.message], suggestedFixes: [] },
        meta: { adapter: 'native_probe', finalUrl: `https://${target.domain}` }
      };
    }

    // Determine current status
    let currentStatus: MonitoredStatus = 'healthy';
    const isDown = !result.isOnline || (result.indicators.httpStatus.statusCode && result.indicators.httpStatus.statusCode >= 500);
    const hasDegradedIssues = result.diagnostics.hasIssues || result.overallScore < 80;

    if (isDown) {
      currentStatus = 'down';
    } else if (hasDegradedIssues) {
      currentStatus = 'needs_attention';
    }

    target.lastChecked = new Date().toISOString();
    target.nextCheck = new Date(Date.now() + target.intervalSeconds * 1000).toISOString();
    target.status = currentStatus;
    target.lastResult = result;

    // Handle Incidents
    if (currentStatus === 'down' || (currentStatus === 'needs_attention' && result.indicators.httpStatus.statusCode && result.indicators.httpStatus.statusCode >= 400)) {
      target.consecutiveFailures += 1;

      // If transition to unhealthy or active incident missing
      if (!target.activeIncidentId) {
        const incident = this.createIncident(target, result);
        target.activeIncidentId = incident.id;
      }
    } else {
      // Returned to healthy -> Resolve existing incident if open
      target.consecutiveFailures = 0;
      if (target.activeIncidentId) {
        const activeInc = this.incidents.get(target.activeIncidentId);
        if (activeInc && activeInc.status === 'open') {
          activeInc.status = 'resolved';
          activeInc.resolvedAt = new Date().toISOString();
        }
        target.activeIncidentId = undefined;
      }
    }

    return result;
  }

  private createIncident(target: MonitoredTarget, result: HealthCheckResult): MonitoringIncident {
    const incidentId = `inc-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const ind = result.indicators;
    const expl = result.customerExplanation;

    const isHttp500 = ind.httpStatus.statusCode && ind.httpStatus.statusCode >= 500;
    const websiteStatus = ind.onlineStatus.status === 'success' ? (isHttp500 ? 'DOWN' : 'DEGRADED') : 'DOWN';

    const dnsStatus = ind.dnsResolution.status === 'success' ? 'Healthy' : ind.dnsResolution.status === 'warning' ? 'Warning' : 'Failed';
    const sslStatus = ind.sslStatus.valid ? 'Healthy' : (ind.sslStatus.status === 'warning' ? 'Warning' : 'Missing');

    const title = isHttp500
      ? `HTTP ${ind.httpStatus.statusCode} Internal Server Error`
      : !result.isOnline
      ? 'Website Reachability Failure'
      : 'Service Degradation Flagged';

    const incident: MonitoringIncident = {
      id: incidentId,
      targetId: target.id,
      domain: target.domain,
      detectedAt: new Date().toISOString(),
      status: 'open',
      severity: isHttp500 || !result.isOnline ? 'critical' : 'warning',
      title,
      metrics: {
        websiteStatus,
        httpStatus: ind.httpStatus.statusCode || (result.isOnline ? 200 : 'No Response'),
        httpStatusText: ind.httpStatus.statusText,
        dnsStatus,
        sslStatus,
        responseTimeMs: ind.responseTime.totalTimeMs
      },
      explanation: {
        whatIsWrong: expl?.whatIsWrong || `The website returned an unexpected response code: ${ind.httpStatus.value}`,
        whatIsWorking: expl?.whatIsWorking || [],
        whatItMeans: expl?.whatItMeans || 'The problem is located within the hosting server environment rather than DNS or SSL.',
        whatShouldHappenNext: expl?.whatShouldHappenNext || 'Investigate server error logs to identify the internal execution error.'
      },
      investigationNotes: `Automated incident created by HospesAI Monitoring Engine. Diagnostics: DNS: ${dnsStatus}, SSL: ${sslStatus}, HTTP: ${ind.httpStatus.value}.`
    };

    this.incidents.set(incidentId, incident);
    return incident;
  }
}

// Global Singleton Monitoring Service
export const globalMonitoringService = new WebsiteMonitoringService();
