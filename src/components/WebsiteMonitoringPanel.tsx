import React, { useState, useEffect } from 'react';
import { MonitoredTarget, MonitoringIncident } from '../monitoring/types';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  Plus,
  RefreshCw,
  Trash2,
  Pause,
  Play,
  Shield,
  Server,
  Globe,
  ExternalLink,
  Search,
  Zap,
  ArrowRight
} from 'lucide-react';

interface WebsiteMonitoringPanelProps {
  onInvestigateWithAktibot?: (domain: string, incidentTitle?: string) => void;
}

export default function WebsiteMonitoringPanel({ onInvestigateWithAktibot }: WebsiteMonitoringPanelProps) {
  const [targets, setTargets] = useState<MonitoredTarget[]>([]);
  const [incidents, setIncidents] = useState<MonitoringIncident[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [newDomain, setNewDomain] = useState('');
  const [newLabel, setNewLabel] = useState('');
  const [newInterval, setNewInterval] = useState('60');
  const [actionError, setActionError] = useState<string | null>(null);
  const [probingTargetId, setProbingTargetId] = useState<string | null>(null);

  const fetchMonitoringData = async () => {
    try {
      const [targetsRes, incidentsRes] = await Promise.all([
        fetch('/api/monitoring/targets'),
        fetch('/api/monitoring/incidents')
      ]);

      if (targetsRes.ok) {
        const data = await targetsRes.json();
        setTargets(data);
      }
      if (incidentsRes.ok) {
        const incData = await incidentsRes.json();
        setIncidents(incData);
      }
    } catch (e: any) {
      console.error('Failed to load monitoring data', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchMonitoringData();
    const interval = setInterval(fetchMonitoringData, 8000);
    return () => clearInterval(interval);
  }, []);

  const handleAddTarget = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionError(null);
    if (!newDomain.trim()) return;

    try {
      const res = await fetch('/api/monitoring/targets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          domain: newDomain.trim(),
          label: newLabel.trim() || undefined,
          intervalSeconds: parseInt(newInterval, 10)
        })
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to add target.');
      }

      setNewDomain('');
      setNewLabel('');
      setIsAdding(false);
      fetchMonitoringData();
    } catch (err: any) {
      setActionError(err.message || 'Could not add monitored target.');
    }
  };

  const handleManualCheck = async (id: string) => {
    setProbingTargetId(id);
    setActionError(null);
    try {
      const res = await fetch(`/api/monitoring/targets/${id}/check`, {
        method: 'POST'
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Check failed.');
      }
      await fetchMonitoringData();
    } catch (err: any) {
      setActionError(err.message || 'Check failed.');
    } finally {
      setProbingTargetId(null);
    }
  };

  const handleDeleteTarget = async (id: string) => {
    try {
      await fetch(`/api/monitoring/targets/${id}`, { method: 'DELETE' });
      setTargets((prev) => prev.filter((t) => t.id !== id));
    } catch (e) {
      console.error(e);
    }
  };

  const openIncidents = incidents.filter((inc) => inc.status === 'open');

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'healthy':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Healthy
          </span>
        );
      case 'needs_attention':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            <AlertTriangle className="w-3 h-3 text-amber-500" />
            Degraded
          </span>
        );
      case 'down':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
            <XCircle className="w-3 h-3 text-rose-500" />
            DOWN
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-600">
            Checking
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header info */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-blue-50 text-blue-600">
              <Activity className="h-5 w-5" />
            </div>
            <h2 className="font-display font-black text-slate-800 text-base">Website Monitoring & Incident Center</h2>
          </div>
          <p className="text-slate-500 text-xs mt-1.5 max-w-xl">
            Real-time proactive monitoring for public websites. Automatically inspects HTTP reachability, SSL certificates, response latency, and DNS delegation to detect incidents.
          </p>
        </div>

        <button
          onClick={() => setIsAdding(!isAdding)}
          className="flex items-center justify-center gap-1.5 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold transition-colors shrink-0 shadow-xs cursor-pointer"
        >
          <Plus className="h-4 w-4" />
          Add Monitored Website
        </button>
      </div>

      {/* Add Website Form */}
      {isAdding && (
        <form
          onSubmit={handleAddTarget}
          className="bg-white p-5 rounded-2xl border border-blue-200 shadow-sm space-y-4 animate-fadeIn"
        >
          <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Configure New Monitored Website</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">Domain Name / URL *</label>
              <input
                type="text"
                placeholder="e.g. sankofaresearchhub.com"
                value={newDomain}
                onChange={(e) => setNewDomain(e.target.value)}
                className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">Friendly Label (Optional)</label>
              <input
                type="text"
                placeholder="e.g. Main Production Portal"
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">Check Frequency</label>
              <select
                value={newInterval}
                onChange={(e) => setNewInterval(e.target.value)}
                className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="60">Every 1 minute (Fast)</option>
                <option value="300">Every 5 minutes (Standard)</option>
                <option value="600">Every 10 minutes</option>
              </select>
            </div>
          </div>

          {actionError && <p className="text-xs text-rose-600 font-semibold">{actionError}</p>}

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setIsAdding(false)}
              className="px-3 py-1.5 text-xs text-slate-600 hover:text-slate-800 font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 text-xs bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg"
            >
              Start Monitoring
            </button>
          </div>
        </form>
      )}

      {/* ACTIVE INCIDENTS BANNER */}
      {openIncidents.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="flex h-2.5 w-2.5 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500"></span>
            </span>
            <h3 className="text-xs font-bold uppercase tracking-wider text-rose-700">
              Active Incidents ({openIncidents.length})
            </h3>
          </div>

          <div className="grid grid-cols-1 gap-3">
            {openIncidents.map((incident) => (
              <div
                key={incident.id}
                className="bg-rose-50/70 border border-rose-200/90 rounded-2xl p-5 shadow-xs"
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-rose-200/60 pb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded-md bg-rose-600 text-white text-[10px] font-mono font-bold tracking-wider uppercase">
                        INCIDENT DETECTED
                      </span>
                      <h4 className="font-bold text-slate-900 text-sm font-mono">{incident.domain}</h4>
                    </div>
                    <p className="text-xs text-rose-800 font-medium mt-1">{incident.title}</p>
                  </div>

                  <button
                    onClick={() => onInvestigateWithAktibot?.(incident.domain, incident.title)}
                    className="flex items-center gap-1.5 px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors shrink-0 cursor-pointer"
                  >
                    <Zap className="h-3.5 w-3.5" />
                    Investigate with Aktibot
                  </button>
                </div>

                {/* Incident telemetry breakdown */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 py-3 text-xs">
                  <div className="bg-white/80 p-2.5 rounded-xl border border-rose-100">
                    <span className="text-[10px] text-slate-400 font-semibold block uppercase">Website Status</span>
                    <span className="font-bold text-rose-600 font-mono text-xs">{incident.metrics.websiteStatus}</span>
                  </div>
                  <div className="bg-white/80 p-2.5 rounded-xl border border-rose-100">
                    <span className="text-[10px] text-slate-400 font-semibold block uppercase">HTTP Code</span>
                    <span className="font-bold text-slate-800 font-mono text-xs">{incident.metrics.httpStatus}</span>
                  </div>
                  <div className="bg-white/80 p-2.5 rounded-xl border border-rose-100">
                    <span className="text-[10px] text-slate-400 font-semibold block uppercase">DNS Status</span>
                    <span className="font-bold text-emerald-600 font-mono text-xs">{incident.metrics.dnsStatus}</span>
                  </div>
                  <div className="bg-white/80 p-2.5 rounded-xl border border-rose-100">
                    <span className="text-[10px] text-slate-400 font-semibold block uppercase">SSL Status</span>
                    <span className="font-bold text-emerald-600 font-mono text-xs">{incident.metrics.sslStatus}</span>
                  </div>
                </div>

                {/* Plain english diagnostic */}
                <div className="bg-white/90 p-3 rounded-xl border border-rose-100 text-xs text-slate-700 space-y-1">
                  <p className="font-semibold text-rose-900">What this means:</p>
                  <p className="text-slate-600">{incident.explanation.whatItMeans}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Monitored Websites List */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
            Monitored Websites ({targets.length})
          </h3>
          <span className="text-[11px] text-slate-400 font-medium">Auto-refreshes periodically</span>
        </div>

        {targets.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-xs">
            No websites currently monitored. Click "Add Monitored Website" above to start.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {targets.map((target) => {
              const isProbing = probingTargetId === target.id;
              const res = target.lastResult;

              return (
                <div key={target.id} className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-slate-50/50 transition-colors">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-slate-900 text-sm">{target.domain}</h4>
                      {getStatusBadge(target.status)}
                    </div>
                    {target.label && target.label !== target.domain && (
                      <p className="text-[11px] text-slate-500">{target.label}</p>
                    )}
                    <div className="flex items-center gap-3 text-[11px] text-slate-400 font-mono">
                      <span>Checked every {target.intervalSeconds}s</span>
                      {target.lastChecked && (
                        <span>• Last checked {new Date(target.lastChecked).toLocaleTimeString()}</span>
                      )}
                      {res && (
                        <span>• TTFB: {res.indicators.responseTime.value}</span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => handleManualCheck(target.id)}
                      disabled={isProbing}
                      className="flex items-center gap-1 px-3 py-1.5 text-xs text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200/80 rounded-lg transition-colors font-semibold cursor-pointer disabled:opacity-50"
                      title="Run safe real-time diagnostic probe right now"
                    >
                      <RefreshCw className={`h-3.5 w-3.5 ${isProbing ? 'animate-spin text-blue-600' : ''}`} />
                      {isProbing ? 'Probing...' : 'Check Now'}
                    </button>

                    <button
                      onClick={() => onInvestigateWithAktibot?.(target.domain)}
                      className="flex items-center gap-1 px-3 py-1.5 text-xs text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors font-semibold cursor-pointer"
                      title="Open Aktibot conversation for this domain"
                    >
                      <Search className="h-3.5 w-3.5" />
                      Aktibot Diagnosis
                    </button>

                    <button
                      onClick={() => handleDeleteTarget(target.id)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors cursor-pointer"
                      title="Stop monitoring this domain"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
