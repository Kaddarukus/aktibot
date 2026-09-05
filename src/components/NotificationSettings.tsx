import React, { useState, useEffect } from 'react';
import { SupportAgent } from '../types';
import { Bell, Mail, AlertTriangle, ShieldAlert, Sliders, CheckCircle, Send } from 'lucide-react';

interface NotificationSettingsProps {
  agent: SupportAgent;
}

interface NotificationConfig {
  emailEnabled: boolean;
  alertEmail: string;
  dashboardEnabled: boolean;
  failureThreshold: number; // e.g. 1, 2, 3 failed auto-fixes
  criticalityLevel: 'all' | 'high_critical' | 'critical_only';
  pagerDutyEnabled: boolean;
  pagerDutyKey: string;
}

export default function NotificationSettings({ agent }: NotificationSettingsProps) {
  const storageKey = `hospes_notify_config_${agent.id}`;
  
  const [config, setConfig] = useState<NotificationConfig>({
    emailEnabled: true,
    alertEmail: 'admin@hospesai.com.ng',
    dashboardEnabled: true,
    failureThreshold: 1,
    criticalityLevel: 'high_critical',
    pagerDutyEnabled: false,
    pagerDutyKey: ''
  });

  const [simulatedAlerts, setSimulatedAlerts] = useState<Array<{
    id: string;
    timestamp: string;
    type: string;
    message: string;
    status: 'failed' | 'sent';
  }>>([]);

  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');

  // Load configuration from local storage on mount or agent change
  useEffect(() => {
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      try {
        setConfig(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to parse saved notification settings', e);
      }
    } else {
      // Defaults customized per agent
      setConfig({
        emailEnabled: true,
        alertEmail: agent.id === 'hospes-host' ? 'sysops@hospesai.com.ng' : 'wellness@fitpulse.gym',
        dashboardEnabled: true,
        failureThreshold: 1,
        criticalityLevel: 'high_critical',
        pagerDutyEnabled: false,
        pagerDutyKey: ''
      });
    }

    const savedAlerts = localStorage.getItem(`hospes_sim_alerts_${agent.id}`);
    if (savedAlerts) {
      try {
        setSimulatedAlerts(JSON.parse(savedAlerts));
      } catch (e) {}
    } else {
      setSimulatedAlerts([]);
    }
  }, [agent.id]);

  const saveConfig = (newConfig: NotificationConfig) => {
    setConfig(newConfig);
    setSaveStatus('saving');
    localStorage.setItem(storageKey, JSON.stringify(newConfig));
    setTimeout(() => {
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    }, 600);
  };

  const handleToggleEmail = () => {
    saveConfig({ ...config, emailEnabled: !config.emailEnabled });
  };

  const handleToggleDashboard = () => {
    saveConfig({ ...config, dashboardEnabled: !config.dashboardEnabled });
  };

  const handleTogglePagerDuty = () => {
    saveConfig({ ...config, pagerDutyEnabled: !config.pagerDutyEnabled });
  };

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setConfig({ ...config, alertEmail: e.target.value });
  };

  const handleEmailBlur = () => {
    saveConfig(config);
  };

  const handlePagerDutyKeyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setConfig({ ...config, pagerDutyKey: e.target.value });
  };

  const handlePagerDutyKeyBlur = () => {
    saveConfig(config);
  };

  const handleThresholdChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    saveConfig({ ...config, failureThreshold: parseInt(e.target.value, 10) });
  };

  const handleCriticalityChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    saveConfig({ ...config, criticalityLevel: e.target.value as any });
  };

  const triggerSimulatedFailure = () => {
    const errorMessages = [
      'cPanel API Call Failed: Token authorization rejected during CHMOD recursion (500 Internal Error)',
      'WHMCS Order Provisioning Error: Pending registrar callback returned status "EPP Code Unverified" on host transfer',
      'CloudLinux LVE Limit Adjustment Refused: Server node-04 reached maximum physically allocated memory caps (503 Service Unavailable)',
      'CSF Firewall Unblock Command Aborted: ConfigServer security Daemon reported non-responsive sockets (Timeout)'
    ];

    const randomError = errorMessages[Math.floor(Math.random() * errorMessages.length)];
    const newAlert = {
      id: Math.random().toString(36).substring(2, 9).toUpperCase(),
      timestamp: new Date().toLocaleTimeString(),
      type: 'Auto-Fix Failure',
      message: randomError,
      status: config.emailEnabled ? 'sent' as const : 'failed' as const
    };

    const updatedAlerts = [newAlert, ...simulatedAlerts].slice(0, 5);
    setSimulatedAlerts(updatedAlerts);
    localStorage.setItem(`hospes_sim_alerts_${agent.id}`, JSON.stringify(updatedAlerts));

    // Dispatch a custom event so other components (like App.tsx error banner) can listen and display it!
    const customEvent = new CustomEvent('infrastructure_alert', {
      detail: {
        agentName: agent.name,
        error: randomError,
        threshold: config.failureThreshold,
        alertEmail: config.emailEnabled ? config.alertEmail : null
      }
    });
    window.dispatchEvent(customEvent);
  };

  const clearHistory = () => {
    setSimulatedAlerts([]);
    localStorage.removeItem(`hospes_sim_alerts_${agent.id}`);
  };

  return (
    <div className="space-y-6" id="notification-settings-panel">
      {/* Overview Card */}
      <div className="bg-slate-50 border border-slate-200/60 rounded-xl p-5">
        <div className="flex items-start gap-4">
          <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl border border-blue-100">
            <Bell className="h-5 w-5" />
          </div>
          <div>
            <h4 className="font-display font-bold text-slate-800 text-sm">Fail-Safe Auto-Fix Monitors</h4>
            <p className="text-slate-500 text-xs mt-1 leading-relaxed">
              Define thresholds for when automated corrections cannot resolve a server problem. When failures cross these thresholds, the system escalates automatically to human administrators via active communication channels.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Settings */}
        <div className="lg:col-span-2 space-y-6">
          {/* Threshold Configurations */}
          <div className="bg-white border border-slate-100 shadow-xs rounded-2xl p-6 space-y-5">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
              <Sliders className="h-4.5 w-4.5 text-blue-600" />
              <h3 className="font-display font-bold text-slate-800 text-xs uppercase tracking-wider">Alert Threshold Rules</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 font-mono uppercase tracking-wider mb-2">
                  Auto-Fix Failure Threshold
                </label>
                <select
                  value={config.failureThreshold}
                  onChange={handleThresholdChange}
                  className="w-full text-xs font-medium px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 cursor-pointer"
                >
                  <option value={1}>Trigger on 1st Failed Attempt (Immediate)</option>
                  <option value={2}>Trigger after 2 Consecutive Failures</option>
                  <option value={3}>Trigger after 3 Consecutive Failures</option>
                </select>
                <span className="text-[10px] text-slate-400 mt-1 block">
                  Defines consecutive failed fixing loops before sending an escalation.
                </span>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 font-mono uppercase tracking-wider mb-2">
                  Criticality Escalation Filter
                </label>
                <select
                  value={config.criticalityLevel}
                  onChange={handleCriticalityChange}
                  className="w-full text-xs font-medium px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 cursor-pointer"
                >
                  <option value="all">Escalate All Failures & Warnings</option>
                  <option value="high_critical">Escalate High & Critical Events Only</option>
                  <option value="critical_only">Escalate Strict Server Terminations Only</option>
                </select>
                <span className="text-[10px] text-slate-400 mt-1 block">
                  Configures minimum severity level of diagnostics to trigger alerts.
                </span>
              </div>
            </div>
          </div>

          {/* Delivery Channels */}
          <div className="bg-white border border-slate-100 shadow-xs rounded-2xl p-6 space-y-6">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
              <ShieldAlert className="h-4.5 w-4.5 text-blue-600" />
              <h3 className="font-display font-bold text-slate-800 text-xs uppercase tracking-wider">Active Escalation Channels</h3>
            </div>

            {/* Email Channel */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className={`p-2 rounded-lg transition-colors ${config.emailEnabled ? 'bg-blue-50 text-blue-600' : 'bg-slate-100 text-slate-400'}`}>
                    <Mail className="h-4 w-4" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-slate-800 block">Email Dispatch System</span>
                    <span className="text-[10px] text-slate-400">Send direct SMTP notifications for unresolved server errors.</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleToggleEmail}
                  className={`w-10 h-6 rounded-full p-1 transition-colors cursor-pointer ${config.emailEnabled ? 'bg-blue-600' : 'bg-slate-250'}`}
                >
                  <div className={`w-4 h-4 rounded-full bg-white transition-transform duration-200 ${config.emailEnabled ? 'translate-x-4' : 'translate-x-0'}`} />
                </button>
              </div>

              {config.emailEnabled && (
                <div className="pl-11 animate-fade-in">
                  <input
                    type="email"
                    value={config.alertEmail}
                    onChange={handleEmailChange}
                    onBlur={handleEmailBlur}
                    placeholder="e.g. sysadmin@yourdomain.com"
                    className="w-full text-xs font-medium px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-mono"
                  />
                  <span className="text-[9px] text-slate-400 mt-1 block">
                    SMTP dispatch runs on our fail-safe cloud mail cluster. Click out to save changes.
                  </span>
                </div>
              )}
            </div>

            {/* Dashboard Alerts Channel */}
            <div className="space-y-3 pt-3 border-t border-slate-50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className={`p-2 rounded-lg transition-colors ${config.dashboardEnabled ? 'bg-blue-50 text-blue-600' : 'bg-slate-100 text-slate-400'}`}>
                    <AlertTriangle className="h-4 w-4" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-slate-800 block">Real-time Banner Interrupts</span>
                    <span className="text-[10px] text-slate-400">Display persistent, flash-red alert headers inside this dashboard window.</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleToggleDashboard}
                  className={`w-10 h-6 rounded-full p-1 transition-colors cursor-pointer ${config.dashboardEnabled ? 'bg-blue-600' : 'bg-slate-250'}`}
                >
                  <div className={`w-4 h-4 rounded-full bg-white transition-transform duration-200 ${config.dashboardEnabled ? 'translate-x-4' : 'translate-x-0'}`} />
                </button>
              </div>
            </div>

            {/* PagerDuty API Integration */}
            <div className="space-y-3 pt-3 border-t border-slate-50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className={`p-2 rounded-lg transition-colors ${config.pagerDutyEnabled ? 'bg-blue-50 text-blue-600' : 'bg-slate-100 text-slate-400'}`}>
                    <Bell className="h-4 w-4" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-slate-800 block">PagerDuty Integration</span>
                    <span className="text-[10px] text-slate-400">Trigger on-call developer paging directly via incident v2 API.</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleTogglePagerDuty}
                  className={`w-10 h-6 rounded-full p-1 transition-colors cursor-pointer ${config.pagerDutyEnabled ? 'bg-blue-600' : 'bg-slate-250'}`}
                >
                  <div className={`w-4 h-4 rounded-full bg-white transition-transform duration-200 ${config.pagerDutyEnabled ? 'translate-x-4' : 'translate-x-0'}`} />
                </button>
              </div>

              {config.pagerDutyEnabled && (
                <div className="pl-11 animate-fade-in">
                  <input
                    type="text"
                    value={config.pagerDutyKey}
                    onChange={handlePagerDutyKeyChange}
                    onBlur={handlePagerDutyKeyBlur}
                    placeholder="Enter PagerDuty Routing Integration Key"
                    className="w-full text-xs font-medium px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-mono"
                  />
                  <span className="text-[9px] text-slate-400 mt-1 block">
                    Required for automated service routing. Click out to save changes.
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Col: Diagnostics & Live Simulator */}
        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-850 rounded-2xl p-5 text-white flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <span className="text-[10px] font-mono font-bold text-blue-400 uppercase tracking-widest">Incident Simulator</span>
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
              </div>
              <p className="text-xs text-slate-300 mt-4 leading-relaxed">
                Test your thresholds instantly! Click below to simulate a critical hosting auto-repair execution loop termination.
              </p>
            </div>
            <div className="mt-8 pt-4 border-t border-slate-800/60">
              <button
                type="button"
                onClick={triggerSimulatedFailure}
                className="w-full py-2.5 px-4 bg-red-600 hover:bg-red-700 transition-colors text-white font-semibold text-xs rounded-xl flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
              >
                <AlertTriangle className="h-4 w-4" /> Trigger Auto-Fix Failure
              </button>
            </div>
          </div>

          {/* Simulated Incidents History */}
          <div className="bg-white border border-slate-100 shadow-xs rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <span className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-wider">Incident Log</span>
              {simulatedAlerts.length > 0 && (
                <button
                  type="button"
                  onClick={clearHistory}
                  className="text-[9px] font-bold text-slate-400 hover:text-slate-600 font-mono"
                >
                  CLEAR LOGS
                </button>
              )}
            </div>

            {simulatedAlerts.length === 0 ? (
              <div className="text-center py-6 text-slate-400">
                <CheckCircle className="h-6 w-6 text-slate-200 mx-auto mb-2" />
                <span className="text-[11px] font-medium block">All services nominal</span>
                <span className="text-[9px] text-slate-400 block mt-0.5">No simulated incidents logged.</span>
              </div>
            ) : (
              <div className="space-y-3 max-h-[220px] overflow-y-auto pr-1">
                {simulatedAlerts.map(alert => (
                  <div key={alert.id} className="p-3 bg-rose-50/50 border border-rose-100 rounded-xl space-y-1 text-xs">
                    <div className="flex items-center justify-between font-mono text-[9px]">
                      <span className="font-bold text-rose-600 uppercase">INCIDENT {alert.id}</span>
                      <span className="text-slate-400">{alert.timestamp}</span>
                    </div>
                    <p className="text-slate-700 font-medium text-[11px] leading-tight line-clamp-2">
                      {alert.message}
                    </p>
                    <div className="flex items-center gap-1.5 text-[9px] pt-1.5 border-t border-rose-100/50">
                      <span className={`px-1.5 py-0.5 rounded-sm font-mono text-[8px] font-bold ${
                        alert.status === 'sent' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-slate-100 text-slate-600 border border-slate-200'
                      }`}>
                        {alert.status === 'sent' ? `EMAIL DISPATCHED: ${config.alertEmail}` : 'EMAIL BYPASSED'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Persistent Status State Indicator */}
      <div className="flex justify-end pt-2">
        <span className="text-[10px] font-mono font-bold text-slate-400 flex items-center gap-1.5">
          {saveStatus === 'saving' && (
            <>
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
              Saving configuration in real-time...
            </>
          )}
          {saveStatus === 'saved' && (
            <>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              Settings saved automatically
            </>
          )}
          {saveStatus === 'idle' && (
            <>
              <span className="w-1.5 h-1.5 rounded-full bg-slate-300" />
              Sync status: Standby
            </>
          )}
        </span>
      </div>
    </div>
  );
}
