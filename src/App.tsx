import React, { useState, useEffect } from 'react';
import { SupportAgent, DocumentItem } from './types';
import AgentList from './components/AgentList';
import AgentForm from './components/AgentForm';
import KnowledgeBase from './components/KnowledgeBase';
import ChatPlayground from './components/ChatPlayground';
import WidgetEmbed from './components/WidgetEmbed';
import NotificationSettings from './components/NotificationSettings';
import PerformanceAnalytics from './components/PerformanceAnalytics';
import WebsiteMonitoringPanel from './components/WebsiteMonitoringPanel';
import {
  Sparkles,
  Layers,
  MessageSquare,
  FileText,
  Code,
  Globe,
  Settings,
  Plus,
  ArrowLeft,
  Bot,
  AlertCircle,
  Clock,
  ArrowUpRight,
  ShieldCheck,
  Server,
  Bell,
  Download,
  BarChart3,
  Activity
} from 'lucide-react';

export default function App() {
  const [agents, setAgents] = useState<SupportAgent[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [isEditingAgent, setIsEditingAgent] = useState(false);
  const [activeTab, setActiveTab] = useState<'playground' | 'monitoring' | 'docs' | 'analytics' | 'demo' | 'embed' | 'notifications'>('monitoring');
  const [initialPlaygroundPrompt, setInitialPlaygroundPrompt] = useState<string | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Live Incident Alert Triggered by Simulator
  const [incidentAlert, setIncidentAlert] = useState<{
    agentName: string;
    error: string;
    threshold: number;
    alertEmail: string | null;
  } | null>(null);

  // Simulated website demo variables
  const [demoPlacement, setDemoPlacement] = useState<'right' | 'left'>('right');
  const [demoShowBrand, setDemoShowBrand] = useState(true);

  // Load all agents from the backend database
  const fetchAgents = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/agents');
      if (!response.ok) throw new Error('Failed to retrieve agents registry.');
      const data = await response.json();
      setAgents(data.agents || []);
      
      // Auto-select the first agent if none is selected
      if (data.agents && data.agents.length > 0 && !selectedAgentId) {
        setSelectedAgentId(data.agents[0].id);
      }
    } catch (err: any) {
      console.error(err);
      setError('Could not connect to the backend server database. Refresh to retry.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAgents();
  }, []);

  useEffect(() => {
    const handleInfraAlert = (e: Event) => {
      const customEvent = e as CustomEvent;
      setIncidentAlert(customEvent.detail);
    };
    window.addEventListener('infrastructure_alert', handleInfraAlert);
    return () => window.removeEventListener('infrastructure_alert', handleInfraAlert);
  }, []);

  const selectedAgent = agents.find(a => a.id === selectedAgentId) || null;

  // Handle saving agent details (Name, Persona, Welcome text, Theme)
  const handleSaveAgent = async (agentData: Partial<SupportAgent>, isAutoSave = false) => {
    try {
      if (!isAutoSave) setError(null);
      const response = await fetch('/api/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(agentData)
      });

      if (!response.ok) {
        throw new Error('Failed to synchronize support agent settings with server database.');
      }

      const result = await response.json();
      if (result.success && result.agent) {
        setAgents(prev => {
          const index = prev.findIndex(a => a.id === result.agent.id);
          if (index >= 0) {
            const next = [...prev];
            next[index] = result.agent;
            return next;
          }
          return [...prev, result.agent];
        });
        setSelectedAgentId(result.agent.id);
        if (!isAutoSave) {
          setIsEditingAgent(false);
        }
        return result.agent;
      }
      return null;
    } catch (err: any) {
      console.error(err);
      if (!isAutoSave) {
        setError(err.message || 'Error occurred while saving your agent.');
      }
      throw err;
    }
  };

  // Handle deleting an agent
  const handleDeleteAgent = async (id: string) => {
    try {
      setError(null);
      const response = await fetch(`/api/agents/${id}`, {
        method: 'DELETE'
      });
      if (!response.ok) throw new Error('Failed to delete support agent.');
      const result = await response.json();
      if (result.success) {
        if (selectedAgentId === id) {
          setSelectedAgentId(null);
        }
        await fetchAgents();
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Error occurred while deleting the agent.');
    }
  };

  // Handle saving grounding documents (Docs list updated)
  const handleUpdateDocs = async (updatedDocs: DocumentItem[], isAutoSave = false) => {
    if (!selectedAgent) return;
    const updatedAgentData = {
      ...selectedAgent,
      docs: updatedDocs
    };
    return await handleSaveAgent(updatedAgentData, isAutoSave);
  };

  // Export complete Agent configuration as JSON file
  const handleExportConfiguration = () => {
    if (!selectedAgent) return;

    // Retrieve notification settings for this agent
    let notificationConfig = {
      emailEnabled: true,
      alertEmail: selectedAgent.id === 'hospes-host' ? 'sysops@hospesai.com.ng' : 'wellness@fitpulse.gym',
      dashboardEnabled: true,
      failureThreshold: 1,
      criticalityLevel: 'high_critical',
      pagerDutyEnabled: false,
      pagerDutyKey: ''
    };

    const storedNotify = localStorage.getItem(`hospes_notify_config_${selectedAgent.id}`);
    if (storedNotify) {
      try {
        notificationConfig = JSON.parse(storedNotify);
      } catch (e) {
        console.error('Failed to parse notification config for export', e);
      }
    }

    const exportPayload = {
      schemaVersion: '1.0',
      exportedAt: new Date().toISOString(),
      agent: {
        id: selectedAgent.id,
        name: selectedAgent.name,
        avatar: selectedAgent.avatar,
        themeColor: selectedAgent.themeColor,
        welcomeMessage: selectedAgent.welcomeMessage,
        persona: selectedAgent.persona
      },
      knowledgeBase: {
        totalDocuments: selectedAgent.docs?.length || 0,
        documents: selectedAgent.docs || []
      },
      notificationSettings: notificationConfig
    };

    const blob = new Blob([JSON.stringify(exportPayload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const downloadAnchor = document.createElement('a');
    downloadAnchor.href = url;
    downloadAnchor.download = `${selectedAgent.id}-full-configuration.json`;
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    document.body.removeChild(downloadAnchor);
    URL.revokeObjectURL(url);
  };

  // Helper theme classes for headers
  const getHeaderTheme = (color: string) => {
    switch (color) {
      case 'emerald': return { bg: 'bg-emerald-50 text-emerald-600', ring: 'ring-emerald-100', dot: 'bg-emerald-500' };
      case 'violet': return { bg: 'bg-violet-50 text-violet-600', ring: 'ring-violet-100', dot: 'bg-violet-500' };
      case 'amber': return { bg: 'bg-amber-50 text-amber-600', ring: 'ring-amber-100', dot: 'bg-amber-500' };
      case 'rose': return { bg: 'bg-rose-50 text-rose-600', ring: 'ring-rose-100', dot: 'bg-rose-500' };
      default: return { bg: 'bg-blue-50 text-blue-600', ring: 'ring-blue-100', dot: 'bg-blue-500' };
    }
  };

  const headerTheme = selectedAgent ? getHeaderTheme(selectedAgent.themeColor) : null;

  return (
    <div className="flex h-screen bg-slate-50 text-slate-800 font-sans overflow-hidden">
      
      {/* Sidebar Agents Registry Panel */}
      <AgentList
        agents={agents}
        selectedId={selectedAgentId}
        onSelect={(id) => {
          setSelectedAgentId(id);
          setIsEditingAgent(false);
        }}
        onCreateNew={() => {
          setIsEditingAgent(true);
          setSelectedAgentId(null);
        }}
        onDelete={handleDeleteAgent}
      />

      {/* Main Panel Content */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        
        {/* Global Error Banner */}
        {error && (
          <div className="bg-rose-50 border-b border-rose-100 px-6 py-3.5 flex items-center gap-3 text-rose-700 text-xs shrink-0">
            <AlertCircle className="h-4.5 w-4.5 text-rose-500 shrink-0" />
            <div className="flex-1">
              <span className="font-bold">Operational Error:</span> {error}
            </div>
            <button
              onClick={() => setError(null)}
              className="text-[10px] font-bold underline text-rose-500 hover:text-rose-600 ml-4 font-mono"
            >
              DISMISS
            </button>
          </div>
        )}

        {/* Live Incident Alert Banner */}
        {incidentAlert && (
          <div className="bg-red-600 text-white px-6 py-4 flex flex-col md:flex-row md:items-center gap-4 text-xs shrink-0 animate-fade-in relative z-40 shadow-md border-b border-red-700">
            <div className="p-1.5 bg-red-800 rounded-lg shrink-0">
              <AlertCircle className="h-5 w-5 text-red-100" />
            </div>
            <div className="flex-1">
              <div className="font-bold text-[9px] tracking-widest uppercase text-red-200 font-mono">Critical Infrastructure Failure Escalation</div>
              <p className="mt-0.5 font-semibold text-white leading-relaxed">
                [{incidentAlert.agentName}] Failed to auto-resolve error: <span className="font-mono bg-red-850 px-1.5 py-0.5 rounded text-[11px] select-all break-all">{incidentAlert.error}</span>
              </p>
              <div className="text-[10px] text-red-200 mt-1 flex flex-wrap items-center gap-3">
                <span>Threshold reached: {incidentAlert.threshold} consecutive failure(s).</span>
                {incidentAlert.alertEmail ? (
                  <span className="flex items-center gap-1">📧 Direct dispatch sent to <strong className="underline">{incidentAlert.alertEmail}</strong></span>
                ) : (
                  <span>⚠️ No active external notification channel configured.</span>
                )}
              </div>
            </div>
            <button
              onClick={() => setIncidentAlert(null)}
              className="px-3 py-1.5 bg-red-800 hover:bg-red-900 transition-colors text-white font-bold font-mono text-[9px] rounded-lg border border-red-500/20 cursor-pointer self-start md:self-auto"
            >
              DISMISS
            </button>
          </div>
        )}

        {isLoading ? (
          <div className="flex-1 flex flex-col items-center justify-center bg-white">
            <Bot className="h-10 w-10 text-blue-500 animate-pulse mb-3" />
            <p className="text-xs text-slate-400 font-mono">Synchronizing databases...</p>
          </div>
        ) : isEditingAgent ? (
          <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50">
            <button
              onClick={() => {
                setIsEditingAgent(false);
                if (agents.length > 0) setSelectedAgentId(agents[0].id);
              }}
              className="flex items-center gap-1 text-slate-400 hover:text-slate-600 font-semibold text-xs mb-5 transition-colors"
            >
              <ArrowLeft className="h-4 w-4" /> Back to registry
            </button>
            <AgentForm
              agent={selectedAgent}
              onSave={handleSaveAgent}
              onCancel={() => {
                setIsEditingAgent(false);
                if (agents.length > 0 && !selectedAgentId) setSelectedAgentId(agents[0].id);
              }}
            />
          </div>
        ) : !selectedAgent ? (
          <div className="flex-1 flex flex-col items-center justify-center bg-white p-8 text-center">
            <Bot className="h-14 w-14 text-slate-300 mb-4 animate-bounce" />
            <h2 className="font-display font-bold text-slate-700 text-sm">Deploy your first AI Agent</h2>
            <p className="text-slate-400 text-xs max-w-sm mt-1 mb-5">
              Build a custom support specialist grounded in your business documentation or wiki guidelines to automatically handle tickets.
            </p>
            <button
              onClick={() => setIsEditingAgent(true)}
              className="flex items-center gap-1.5 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-xs hover:shadow-md transition-all cursor-pointer"
            >
              <Plus className="h-4 w-4" /> Create Support Bot
            </button>
          </div>
        ) : (
          // Active Workspace Panel
          <div className="flex-1 flex flex-col h-full overflow-hidden bg-white">
            
            {/* Workspace Header Panel */}
            <div className="p-6 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0">
              <div className="flex items-start gap-4">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-2xl border font-display shrink-0 shadow-xs ring-4 ${headerTheme?.bg} ${headerTheme?.ring}`}>
                  {selectedAgent.avatar || '🤖'}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="font-display font-black text-slate-800 text-base leading-none">
                      {selectedAgent.name}
                    </h2>
                    <span className={`w-2 h-2 rounded-full ${headerTheme?.dot} animate-pulse`} />
                  </div>
                  <p className="text-slate-400 text-[11px] font-mono mt-1 uppercase tracking-wider">
                    Agent ID: {selectedAgent.id}
                  </p>
                  <p className="text-xs text-slate-500 line-clamp-1 max-w-2xl mt-1.5 italic">
                    "{selectedAgent.persona}"
                  </p>
                </div>
              </div>

              {/* Workspace Action Buttons */}
              <div className="flex items-center gap-2 shrink-0">
                <button
                  id="export-config-btn"
                  type="button"
                  onClick={handleExportConfiguration}
                  className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100/80 border border-blue-200/80 px-3.5 py-2 rounded-lg transition-colors font-semibold cursor-pointer shadow-2xs"
                  title="Download JSON containing persona, knowledge base references, and notification settings"
                >
                  <Download className="h-3.5 w-3.5 text-blue-600" /> Export Configuration
                </button>
                <button
                  id="edit-agent-btn"
                  type="button"
                  onClick={() => setIsEditingAgent(true)}
                  className="flex items-center gap-1.5 text-xs text-slate-600 hover:text-slate-800 bg-slate-50 hover:bg-slate-100 border border-slate-200 px-3.5 py-2 rounded-lg transition-colors font-semibold cursor-pointer"
                >
                  <Settings className="h-3.5 w-3.5" /> Edit Agent Metadata
                </button>
              </div>
            </div>

            {/* Workspace Sub-Tabs Navigation */}
            <div className="px-6 bg-slate-50/50 border-b border-slate-100 flex items-center gap-1 shrink-0 overflow-x-auto">
              {[
                { id: 'monitoring', label: 'Website Monitoring & Incidents', icon: Activity },
                { id: 'playground', label: 'Conversational Sandbox', icon: MessageSquare },
                { id: 'docs', label: 'Grounding Knowledge Base', icon: FileText },
                { id: 'analytics', label: 'Performance Analytics', icon: BarChart3 },
                { id: 'demo', label: 'Website Simulator Demo', icon: Globe },
                { id: 'embed', label: 'Widget Integration Code', icon: Code },
                { id: 'notifications', label: 'Notification Settings', icon: Bell }
              ].map(tab => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    id={`tab-${tab.id}-btn`}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`flex items-center gap-2 px-4 py-3.5 text-xs font-semibold relative transition-colors cursor-pointer border-b-2 shrink-0 ${
                      isActive
                        ? 'text-blue-600 border-blue-600 font-bold bg-white/50'
                        : 'text-slate-400 border-transparent hover:text-slate-600'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {tab.label}
                  </button>
                );
              })}
            </div>

            {/* Tab Body Container */}
            <div className="flex-1 overflow-y-auto p-6 bg-slate-50/30">
              {activeTab === 'monitoring' && (
                <WebsiteMonitoringPanel
                  onInvestigateWithAktibot={(domain, incidentTitle) => {
                    const prompt = incidentTitle
                      ? `Investigate incident on ${domain}: ${incidentTitle}`
                      : `Run a full diagnostic health check on ${domain}`;
                    setInitialPlaygroundPrompt(prompt);
                    setActiveTab('playground');
                  }}
                />
              )}

              {activeTab === 'playground' && (
                <div className="max-w-3xl mx-auto">
                  <div className="mb-4">
                    <h3 className="font-display font-bold text-slate-800 text-sm">Agent Testing sandbox</h3>
                    <p className="text-slate-400 text-[11px] mt-1">
                      Converse with the bot to verify details. The model strictly analyzes the reference articles loaded in the knowledge base.
                    </p>
                  </div>
                  <ChatPlayground agent={selectedAgent} initialMessage={initialPlaygroundPrompt} />
                </div>
              )}

              {activeTab === 'docs' && (
                <div className="max-w-4xl mx-auto">
                  <KnowledgeBase
                    agent={selectedAgent}
                    onUpdateDocs={handleUpdateDocs}
                  />
                </div>
              )}

              {activeTab === 'analytics' && (
                <div className="max-w-5xl mx-auto">
                  <PerformanceAnalytics agent={selectedAgent} />
                </div>
              )}

              {activeTab === 'embed' && (
                <div className="max-w-4xl mx-auto">
                  <WidgetEmbed agent={selectedAgent} />
                </div>
              )}

              {activeTab === 'notifications' && (
                <div className="max-w-4xl mx-auto">
                  <NotificationSettings agent={selectedAgent} />
                </div>
              )}

              {activeTab === 'demo' && (
                <div className="max-w-5xl mx-auto space-y-4">
                  {/* Interactive Website Demo Simulator */}
                  <div className="flex-col md:flex-row md:items-center justify-between gap-4 hidden md:flex">
                    <div>
                      <h3 className="font-display font-bold text-slate-800 text-sm">Interactive Website Demo Simulator</h3>
                      <p className="text-slate-400 text-[11px] mt-0.5">
                        This simulates how a visitor on your client website (e.g. <code>hospesai.com.ng</code>) experiences your active grounded support agent.
                      </p>
                    </div>

                    {/* Simulation Controls directly inside the tab */}
                    <div className="flex items-center gap-3 bg-slate-100 p-2 rounded-xl border border-slate-200">
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] font-bold text-slate-500 font-mono tracking-wider">ALIGN:</span>
                        <button
                          onClick={() => setDemoPlacement(demoPlacement === 'right' ? 'left' : 'right')}
                          className="px-2 py-1 text-[9px] font-bold font-mono bg-white text-slate-700 hover:text-blue-600 rounded-md shadow-2xs cursor-pointer border border-slate-200"
                        >
                          {demoPlacement.toUpperCase()}
                        </button>
                      </div>
                      <div className="w-px h-4 bg-slate-250" />
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] font-bold text-slate-500 font-mono tracking-wider">BRAND:</span>
                        <button
                          onClick={() => setDemoShowBrand(!demoShowBrand)}
                          className={`px-2 py-1 text-[9px] font-bold font-mono rounded-md shadow-2xs cursor-pointer border ${
                            demoShowBrand ? 'bg-white text-emerald-600 border-emerald-100' : 'bg-slate-200 text-slate-500 border-slate-300'
                          }`}
                        >
                          {demoShowBrand ? 'VISIBLE' : 'HIDDEN'}
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="md:hidden">
                    <h3 className="font-display font-bold text-slate-800 text-sm">Interactive Website Demo Simulator</h3>
                    <p className="text-slate-400 text-[11px] mt-0.5">
                      This simulates how a visitor on your client website experiences your support agent.
                    </p>
                  </div>

                  {/* Mock Web Portal Container */}
                  <div className="relative border border-slate-200 rounded-3xl overflow-hidden bg-slate-900 shadow-lg min-h-[500px] flex flex-col">
                    {/* Simulated Browser Bar */}
                    <div className="bg-slate-950 border-b border-slate-800 px-4 py-3 flex items-center gap-3 shrink-0">
                      <div className="flex gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block" />
                        <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" />
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
                      </div>
                      <div className="flex-1 max-w-md bg-slate-900 border border-slate-800 rounded-lg px-3 py-1 text-[10px] font-mono text-slate-400 flex items-center gap-1.5 select-none truncate">
                        <Globe className="h-3 w-3 text-slate-500 shrink-0" />
                        <span>https://hospesai.com.ng/support/home-portal</span>
                      </div>
                      <span className="text-[9px] font-mono text-slate-500 shrink-0 select-none hidden md:block">
                        Simulation Mode
                      </span>
                    </div>

                    {/* Dummy Web Content Page */}
                    <div className="flex-1 bg-white p-6 md:p-8 flex flex-col justify-between relative overflow-y-auto">
                      
                      {/* Navigation banner */}
                      <header className="flex items-center justify-between border-b border-slate-100 pb-4">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded bg-blue-600 text-white font-bold flex items-center justify-center text-sm">
                            H
                          </div>
                          <span className="font-display font-black text-xs text-slate-800 tracking-tight">Hospes Host</span>
                        </div>
                        <nav className="flex items-center gap-3 text-[10px] font-semibold text-slate-500">
                          <span className="hover:text-blue-600 cursor-pointer">Cloud VPS</span>
                          <span className="hover:text-blue-600 cursor-pointer">Domains</span>
                          <span className="hover:text-blue-600 cursor-pointer">Shared</span>
                          <span className="px-3 py-1 rounded bg-blue-600 text-white text-[9px] font-bold">Portal Login</span>
                        </nav>
                      </header>

                      {/* Main landing content */}
                      <div className="my-auto py-8 max-w-xl">
                        <span className="px-2.5 py-1 bg-blue-50 text-blue-600 text-[9px] font-bold rounded-full border border-blue-100">
                          CLOUD WEB HOUSING & VPS PLATFORM
                        </span>
                        <h1 className="font-display font-black text-slate-900 text-xl md:text-2xl mt-3 leading-tight tracking-tight">
                          Enterprise-Grade Server Infrastructure, Deployed in Seconds.
                        </h1>
                        <p className="text-[11px] text-slate-500 mt-2 leading-relaxed">
                          Hospes Hosting provides lightning-fast shared hosting, NVMe VPS cloud systems, and automated domain registrars with full cPanel configurations. Grounded in state-of-the-art server protection and free one-click SSL certificates.
                        </p>

                        <div className="mt-5 flex flex-wrap gap-2.5">
                          <button className="px-4 py-2 bg-slate-900 text-white text-[11px] font-bold rounded-lg hover:bg-slate-800 transition-colors">
                            Explore Server Plans
                          </button>
                          <button className="px-4 py-2 border border-slate-200 text-slate-600 text-[11px] font-bold rounded-lg hover:bg-slate-50 transition-colors flex items-center gap-1">
                            Technical Wiki Docs <ArrowUpRight className="h-3.5 w-3.5 text-slate-400" />
                          </button>
                        </div>
                      </div>

                      {/* Info grid */}
                      <div className="grid grid-cols-3 gap-3 border-t border-slate-100 pt-5 mt-4">
                        <div className="p-3 rounded-xl bg-slate-50/50 border border-slate-100/40">
                          <span className="text-slate-400 text-[9px] font-mono">Guaranteed</span>
                          <span className="block font-bold text-slate-800 text-xs mt-0.5">99.99% Uptime</span>
                        </div>
                        <div className="p-3 rounded-xl bg-slate-50/50 border border-slate-100/40">
                          <span className="text-slate-400 text-[9px] font-mono">Performance</span>
                          <span className="block font-bold text-slate-800 text-xs mt-0.5">PCIe NVMe SSD</span>
                        </div>
                        <div className="p-3 rounded-xl bg-slate-50/50 border border-slate-100/40">
                          <span className="text-slate-400 text-[9px] font-mono">SSL Security</span>
                          <span className="block font-bold text-slate-800 text-xs mt-0.5">Free Let's Encrypt</span>
                        </div>
                      </div>

                      {/* --- FLOATING AGENT WIDGET TRIGGER PREVIEW --- */}
                      <div className={`absolute bottom-6 ${demoPlacement === 'right' ? 'right-6' : 'left-6'} flex flex-col items-end gap-3 z-30`}>
                        
                        {/* Interactive chat window open inside the website demo */}
                        <div className="w-[310px] h-[380px] rounded-2xl border border-slate-150 shadow-2xl overflow-hidden flex flex-col bg-white animate-fade-in origin-bottom-right">
                          {/* Chat header */}
                          <div className={`p-3.5 text-white flex items-center gap-2.5 shrink-0 ${
                            selectedAgent.themeColor === 'emerald' ? 'bg-emerald-600' :
                            selectedAgent.themeColor === 'violet' ? 'bg-violet-600' :
                            selectedAgent.themeColor === 'amber' ? 'bg-amber-500' :
                            selectedAgent.themeColor === 'rose' ? 'bg-rose-500' :
                            selectedAgent.themeColor === 'slate' ? 'bg-slate-600' :
                            'bg-blue-600'
                          }`}>
                            <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center font-display text-base">
                              {selectedAgent.avatar || '🤖'}
                            </div>
                            <div>
                              <h4 className="text-[11px] font-bold font-display leading-tight">{selectedAgent.name}</h4>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
                                <span className="text-[8px] font-mono opacity-80 tracking-wide uppercase">AI Active & Grounded</span>
                              </div>
                            </div>
                          </div>

                          {/* Quick embedding info */}
                          <div className="bg-slate-50 px-3 py-2 border-b border-slate-100 flex items-center gap-1.5 text-[9px] text-slate-500 font-mono">
                            <Server className="h-3 w-3 text-slate-400" />
                            <span>GROUNDED IN {selectedAgent.docs?.length || 0} SUPPORT RECORDS</span>
                          </div>

                          {/* Real-time sandbox nested right inside the demo frame */}
                          <div className="flex-1 p-3 overflow-y-auto bg-slate-50/40">
                            <div className="space-y-3">
                              <div className="flex gap-2 items-start max-w-[85%]">
                                <div className="w-6 h-6 rounded bg-slate-100 text-[10px] flex items-center justify-center border border-slate-200">
                                  {selectedAgent.avatar || '🤖'}
                                </div>
                                <div className="p-2.5 rounded-xl rounded-tl-none bg-white border border-slate-150 shadow-2xs text-[10px] text-slate-700 leading-relaxed font-sans">
                                  {selectedAgent.welcomeMessage || 'Hello! How can I assist you today?'}
                                </div>
                              </div>
                            </div>

                            <div className="mt-8 text-center px-4">
                              <span className="text-[9px] font-mono text-slate-400 block mb-1">
                                [ Live Support Sandbox Demo ]
                              </span>
                              <p className="text-[9px] text-slate-500 font-sans leading-normal">
                                To converse, input prompts in the <strong>Conversational Sandbox</strong> tab. The sandbox syncs this agent live!
                              </p>
                              <button
                                onClick={() => setActiveTab('playground')}
                                className="mt-2 text-[9px] bg-blue-50 text-blue-600 hover:bg-blue-100 font-semibold px-2.5 py-1 rounded-md border border-blue-100 transition-colors"
                              >
                                Go to Chat Sandbox
                              </button>
                            </div>
                          </div>

                          {/* Footer Branding */}
                          {demoShowBrand && (
                            <div className="px-3 py-1.5 bg-white border-t border-slate-100 flex items-center justify-center gap-1 shrink-0 text-[8px] text-slate-400 font-mono select-none">
                              <span>Powered by</span>
                              <span className="font-bold text-slate-600">HospesAI.com.ng</span>
                            </div>
                          )}
                        </div>

                        {/* Interactive floating launcher bubble */}
                        <button
                          className={`w-12 h-12 rounded-full text-white shadow-lg flex items-center justify-center text-lg relative cursor-default ${
                            selectedAgent.themeColor === 'emerald' ? 'bg-emerald-600 shadow-emerald-200' :
                            selectedAgent.themeColor === 'violet' ? 'bg-violet-600 shadow-violet-200' :
                            selectedAgent.themeColor === 'amber' ? 'bg-amber-500 shadow-amber-200' :
                            selectedAgent.themeColor === 'rose' ? 'bg-rose-500 shadow-rose-200' :
                            selectedAgent.themeColor === 'slate' ? 'bg-slate-600 shadow-slate-200' :
                            'bg-blue-600 shadow-blue-200'
                          }`}
                        >
                          {selectedAgent.avatar || '🤖'}
                          <span className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 border-2 border-white animate-ping" />
                        </button>
                      </div>

                    </div>
                  </div>
                </div>
              )}
            </div>

          </div>
        )}

      </div>
    </div>
  );
}
