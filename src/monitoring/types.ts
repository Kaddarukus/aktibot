import { HealthCheckResult } from '../types/healthCheck';

export type MonitoredStatus = 'healthy' | 'needs_attention' | 'down' | 'checking' | 'paused';

export interface MonitoredTarget {
  id: string;
  domain: string;
  label?: string;
  intervalSeconds: number; // e.g. 60, 300
  status: MonitoredStatus;
  lastChecked?: string;
  nextCheck?: string;
  isPaused: boolean;
  consecutiveFailures: number;
  lastResult?: HealthCheckResult;
  activeIncidentId?: string;
  createdAt: string;
}

export interface MonitoringIncident {
  id: string;
  targetId: string;
  domain: string;
  detectedAt: string;
  resolvedAt?: string;
  status: 'open' | 'resolved';
  severity: 'critical' | 'warning';
  title: string;
  metrics: {
    websiteStatus: 'ONLINE' | 'DOWN' | 'DEGRADED';
    httpStatus: number | string;
    httpStatusText?: string;
    dnsStatus: 'Healthy' | 'Failed' | 'Warning';
    sslStatus: 'Healthy' | 'Expired' | 'Warning' | 'Missing';
    responseTimeMs?: number;
  };
  explanation: {
    whatIsWrong: string;
    whatIsWorking: string[];
    whatItMeans: string;
    whatShouldHappenNext: string;
  };
  investigationNotes?: string;
}
