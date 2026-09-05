import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { SupportAgent, AgentAnalyticsSummary, DocumentUsageStat } from '../types';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Cell,
  PieChart,
  Pie
} from 'recharts';
import {
  BarChart3,
  TrendingUp,
  Clock,
  Activity,
  FileText,
  Layers,
  Zap,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Download,
  Search,
  ArrowUpRight,
  ShieldCheck,
  Cpu,
  Info,
  Check,
  Sliders,
  ExternalLink,
  Flame
} from 'lucide-react';

interface PerformanceAnalyticsProps {
  agent: SupportAgent;
}

const CATEGORY_COLORS = ['#3b82f6', '#10b981', '#8b5cf6', '#f59e0b', '#ec4899', '#06b6d4', '#64748b'];

export default function PerformanceAnalytics({ agent }: PerformanceAnalyticsProps) {
  const [timeframe, setTimeframe] = useState<'24h' | '7d' | '30d'>('7d');
  const [analytics, setAnalytics] = useState<AgentAnalyticsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSimulating, setIsSimulating] = useState(false);
  const [docSearchQuery, setDocSearchQuery] = useState('');
  const [selectedMetricView, setSelectedMetricView] = useState<'all' | 'volume' | 'latency' | 'docs'>('all');
  const [simulationToast, setSimulationToast] = useState<string | null>(null);

  const fetchAnalytics = useCallback(async (selectedTimeframe = timeframe) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/analytics/${agent.id}?timeframe=${selectedTimeframe}`);
      if (!response.ok) throw new Error('Failed to load performance metrics.');
      const data = await response.json();
      setAnalytics(data);
    } catch (err) {
      console.error('Error fetching analytics:', err);
    } finally {
      setLoading(false);
    }
  }, [agent.id, timeframe]);

  useEffect(() => {
    fetchAnalytics(timeframe);
  }, [agent.id, timeframe, fetchAnalytics]);

  useEffect(() => {
    if (simulationToast) {
      const timer = setTimeout(() => setSimulationToast(null), 4500);
      return () => clearTimeout(timer);
    }
  }, [simulationToast]);

  const handleSimulateSurge = async () => {
    setIsSimulating(true);
    try {
      const response = await fetch(`/api/analytics/${agent.id}/simulate-traffic`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ batchSize: 5 })
      });
      if (response.ok) {
        await fetchAnalytics();
        setSimulationToast('Simulated 5 live chat queries and updated telemetry graphs!');
      }
    } catch (e) {
      console.error('Simulation failed', e);
    } finally {
      setIsSimulating(false);
    }
  };

  const handleExportAnalyticsReport = () => {
    if (!analytics) return;
    const payload = {
      exportDate: new Date().toISOString(),
      agentId: agent.id,
      agentName: agent.name,
      timeframe,
      metrics: {
        totalInteractions: analytics.totalInteractions,
        avgResponseTimeMs: analytics.avgResponseTimeMs,
        p95ResponseTimeMs: analytics.p95ResponseTimeMs,
        groundingRatePercentage: analytics.groundingRatePercentage,
        knowledgeBaseCoveragePercentage: analytics.knowledgeBaseCoveragePercentage
      },
      documentUtilization: analytics.documentUsage,
      volumeTrends: analytics.volumeTrends,
      latencyTrends: analytics.latencyTrends
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${agent.id}-analytics-report-${timeframe}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const filteredDocs = useMemo(() => {
    if (!analytics?.documentUsage) return [];
    if (!docSearchQuery.trim()) return analytics.documentUsage;
    const q = docSearchQuery.toLowerCase();
    return analytics.documentUsage.filter(
      d => d.title.toLowerCase().includes(q) || d.category.toLowerCase().includes(q)
    );
  }, [analytics?.documentUsage, docSearchQuery]);

  // Custom Chart Tooltips
  const CustomVolumeTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-slate-900 text-white p-3 rounded-xl shadow-xl border border-slate-700 text-xs space-y-1.5 min-w-[170px]">
          <div className="font-bold text-slate-200 border-b border-slate-800 pb-1 flex items-center justify-between">
            <span>{label}</span>
            <span className="text-[10px] text-blue-400 font-mono">{data.resolutionRate}% Grounded</span>
          </div>
          <div className="flex items-center justify-between text-slate-300">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-blue-500" /> Total Interactions:
            </span>
            <span className="font-mono font-bold text-white">{data.totalChats}</span>
          </div>
          <div className="flex items-center justify-between text-emerald-400">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-emerald-400" /> Grounded Answers:
            </span>
            <span className="font-mono font-bold">{data.groundedResponses}</span>
          </div>
          <div className="flex items-center justify-between text-slate-400">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-slate-500" /> Fallbacks:
            </span>
            <span className="font-mono">{data.fallbackResponses}</span>
          </div>
        </div>
      );
    }
    return null;
  };

  const CustomLatencyTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-slate-900 text-white p-3 rounded-xl shadow-xl border border-slate-700 text-xs space-y-1.5 min-w-[170px]">
          <div className="font-bold text-slate-200 border-b border-slate-800 pb-1">
            {label}
          </div>
          <div className="flex items-center justify-between text-indigo-300">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-indigo-400" /> Avg Latency:
            </span>
            <span className="font-mono font-bold text-white">{data.avgLatencyMs} ms</span>
          </div>
          <div className="flex items-center justify-between text-purple-300">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-purple-400" /> P95 Latency:
            </span>
            <span className="font-mono font-bold">{data.p95LatencyMs} ms</span>
          </div>
          <div className="pt-1 border-t border-slate-800 text-[10px] text-slate-400 flex justify-between">
            <span>Inference: {data.inferenceMs}ms</span>
            <span>Retrieval: {data.retrievalMs}ms</span>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6" id="performance-analytics-panel">
      {/* Toast alert */}
      {simulationToast && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-center justify-between text-xs font-semibold shadow-xs animate-fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
            <span>{simulationToast}</span>
          </div>
          <button
            onClick={() => setSimulationToast(null)}
            className="text-emerald-500 hover:text-emerald-700 text-xs cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Header and Controls Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-blue-600 text-white shadow-xs">
              <BarChart3 className="h-4 w-4" />
            </span>
            <h2 className="font-display font-bold text-slate-900 text-sm tracking-tight">
              Performance Analytics & Grounding Intelligence
            </h2>
          </div>
          <p className="text-slate-500 text-xs leading-relaxed">
            Real-time telemetry, conversational interaction volumes, AI response latencies, and knowledge base citation frequencies for <strong className="text-slate-800 font-semibold">{agent.name}</strong>.
          </p>
        </div>

        {/* Controls & Action Buttons */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {/* Timeframe Selector */}
          <div className="bg-slate-100 p-1 rounded-xl flex items-center gap-0.5 border border-slate-200">
            {(['24h', '7d', '30d'] as const).map((tf) => (
              <button
                key={tf}
                type="button"
                onClick={() => setTimeframe(tf)}
                className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                  timeframe === tf
                    ? 'bg-white text-blue-600 shadow-2xs font-bold'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {tf === '24h' ? '24 Hours' : tf === '7d' ? '7 Days' : '30 Days'}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={handleSimulateSurge}
            disabled={isSimulating}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-blue-50 hover:bg-blue-100/80 text-blue-700 border border-blue-200/80 transition-all cursor-pointer shadow-2xs disabled:opacity-50"
            title="Simulate 5 test user queries to see graph curves update"
          >
            <Sparkles className="h-3.5 w-3.5 text-blue-600" />
            {isSimulating ? 'Simulating...' : 'Simulate Traffic'}
          </button>

          <button
            type="button"
            onClick={handleExportAnalyticsReport}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 transition-all cursor-pointer shadow-2xs"
            title="Download full analytics payload as JSON"
          >
            <Download className="h-3.5 w-3.5 text-slate-500" /> Export
          </button>

          <button
            type="button"
            onClick={() => fetchAnalytics()}
            className="p-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 border border-slate-200 transition-all cursor-pointer"
            title="Refresh Metrics"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin text-blue-600' : ''}`} />
          </button>
        </div>
      </div>

      {/* KPI Cards Overview Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* Metric 1: Total Chat Volume */}
        <div className="bg-white p-4.5 rounded-2xl border border-slate-200/90 shadow-2xs relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-start justify-between gap-2 mb-2">
            <span className="text-[11px] font-bold text-slate-400 font-mono tracking-wide uppercase">
              Total Interaction Volume
            </span>
            <span className="p-2 rounded-xl bg-blue-50 text-blue-600">
              <Activity className="h-4 w-4" />
            </span>
          </div>
          <div className="space-y-1">
            <div className="text-2xl font-bold font-display text-slate-900">
              {analytics?.totalInteractions?.toLocaleString() || '0'}
            </div>
            <div className="flex items-center gap-1 text-[11px] text-emerald-600 font-semibold">
              <TrendingUp className="h-3 w-3" />
              <span>+14.2% interaction surge vs last period</span>
            </div>
          </div>
        </div>

        {/* Metric 2: Avg Response Time */}
        <div className="bg-white p-4.5 rounded-2xl border border-slate-200/90 shadow-2xs relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-start justify-between gap-2 mb-2">
            <span className="text-[11px] font-bold text-slate-400 font-mono tracking-wide uppercase">
              Average Response Time
            </span>
            <span className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
              <Clock className="h-4 w-4" />
            </span>
          </div>
          <div className="space-y-1">
            <div className="text-2xl font-bold font-display text-slate-900">
              {analytics?.avgResponseTimeMs || 0} <span className="text-sm font-normal text-slate-500">ms</span>
            </div>
            <div className="flex items-center gap-1 text-[11px] text-indigo-600 font-semibold">
              <Zap className="h-3 w-3" />
              <span>P95 latency at {analytics?.p95ResponseTimeMs || 0} ms (Target &lt; 1500ms)</span>
            </div>
          </div>
        </div>

        {/* Metric 3: Grounding Resolution Rate */}
        <div className="bg-white p-4.5 rounded-2xl border border-slate-200/90 shadow-2xs relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-start justify-between gap-2 mb-2">
            <span className="text-[11px] font-bold text-slate-400 font-mono tracking-wide uppercase">
              Grounding Accuracy Rate
            </span>
            <span className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
              <ShieldCheck className="h-4 w-4" />
            </span>
          </div>
          <div className="space-y-1">
            <div className="text-2xl font-bold font-display text-emerald-700">
              {analytics?.groundingRatePercentage || 0}%
            </div>
            <div className="flex items-center gap-1 text-[11px] text-slate-500">
              <Check className="h-3 w-3 text-emerald-600" />
              <span>Citing verified Knowledge Base articles</span>
            </div>
          </div>
        </div>

        {/* Metric 4: Knowledge Base Coverage */}
        <div className="bg-white p-4.5 rounded-2xl border border-slate-200/90 shadow-2xs relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-start justify-between gap-2 mb-2">
            <span className="text-[11px] font-bold text-slate-400 font-mono tracking-wide uppercase">
              Knowledge Base Coverage
            </span>
            <span className="p-2 rounded-xl bg-amber-50 text-amber-600">
              <FileText className="h-4 w-4" />
            </span>
          </div>
          <div className="space-y-1">
            <div className="text-2xl font-bold font-display text-slate-900">
              {analytics?.knowledgeBaseCoveragePercentage || 0}%
            </div>
            <div className="flex items-center gap-1 text-[11px] text-slate-500">
              <Layers className="h-3 w-3 text-amber-600" />
              <span>{agent.docs?.length || 0} active articles indexed</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Charts Deck */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart 1: Chat Interaction Volumes */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <h3 className="font-display font-bold text-slate-800 text-xs flex items-center gap-2">
                <Activity className="h-4 w-4 text-blue-600" />
                Chat Interaction Volume & Resolution
              </h3>
              <p className="text-[11px] text-slate-400">
                Number of total queries and verified grounded answers over time.
              </p>
            </div>
            <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-100">
              {timeframe.toUpperCase()} Trend
            </span>
          </div>

          <div className="h-64 w-full pt-2">
            {analytics?.volumeTrends && analytics.volumeTrends.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={analytics.volumeTrends} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="totalChatsGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.0} />
                    </linearGradient>
                    <linearGradient id="groundedGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.5} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis
                    dataKey="timeLabel"
                    tick={{ fontSize: 10, fill: '#94a3b8' }}
                    axisLine={{ stroke: '#e2e8f0' }}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: '#94a3b8' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip content={<CustomVolumeTooltip />} />
                  <Legend
                    verticalAlign="top"
                    align="right"
                    iconType="circle"
                    wrapperStyle={{ fontSize: 11, paddingBottom: 8 }}
                  />
                  <Area
                    type="monotone"
                    name="Total Queries"
                    dataKey="totalChats"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#totalChatsGrad)"
                  />
                  <Area
                    type="monotone"
                    name="Grounded Answers"
                    dataKey="groundedResponses"
                    stroke="#10b981"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#groundedGrad)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-slate-400">
                Loading volume trends...
              </div>
            )}
          </div>
        </div>

        {/* Chart 2: Response Time & Latency Trends */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <h3 className="font-display font-bold text-slate-800 text-xs flex items-center gap-2">
                <Clock className="h-4 w-4 text-indigo-600" />
                Response Latency & Processing Times (ms)
              </h3>
              <p className="text-[11px] text-slate-400">
                Average vs P95 response latency comparing model generation and document retrieval.
              </p>
            </div>
            <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100">
              SLA Target: &lt;1.5s
            </span>
          </div>

          <div className="h-64 w-full pt-2">
            {analytics?.latencyTrends && analytics.latencyTrends.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={analytics.latencyTrends} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis
                    dataKey="timeLabel"
                    tick={{ fontSize: 10, fill: '#94a3b8' }}
                    axisLine={{ stroke: '#e2e8f0' }}
                    tickLine={false}
                  />
                  <YAxis
                    unit="ms"
                    tick={{ fontSize: 10, fill: '#94a3b8' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip content={<CustomLatencyTooltip />} />
                  <Legend
                    verticalAlign="top"
                    align="right"
                    iconType="circle"
                    wrapperStyle={{ fontSize: 11, paddingBottom: 8 }}
                  />
                  <Line
                    type="monotone"
                    name="Avg Latency (ms)"
                    dataKey="avgLatencyMs"
                    stroke="#6366f1"
                    strokeWidth={2.5}
                    dot={{ r: 3, fill: '#6366f1' }}
                    activeDot={{ r: 5 }}
                  />
                  <Line
                    type="monotone"
                    name="P95 Latency (ms)"
                    dataKey="p95LatencyMs"
                    stroke="#a855f7"
                    strokeWidth={2}
                    strokeDasharray="4 4"
                    dot={{ r: 2.5, fill: '#a855f7' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-slate-400">
                Loading latency curves...
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Document Utilization & Category Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Document Citation Frequencies Horizontal Bar Chart */}
        <div className="lg:col-span-2 bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <h3 className="font-display font-bold text-slate-800 text-xs flex items-center gap-2">
                <Flame className="h-4 w-4 text-amber-500" />
                Knowledge Base Article Utilization Rates
              </h3>
              <p className="text-[11px] text-slate-400">
                Top reference documents cited by the AI model during customer answers.
              </p>
            </div>
            <span className="text-[10px] text-slate-400 font-mono">
              {analytics?.documentUsage?.length || 0} Total Articles
            </span>
          </div>

          <div className="h-72 w-full pt-1">
            {analytics?.documentUsage && analytics.documentUsage.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={analytics.documentUsage.slice(0, 6)}
                  layout="vertical"
                  margin={{ top: 5, right: 30, left: 10, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                  <XAxis type="number" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <YAxis
                    type="category"
                    dataKey="title"
                    width={150}
                    tick={{ fontSize: 10, fill: '#334155' }}
                    axisLine={{ stroke: '#e2e8f0' }}
                    tickLine={false}
                    tickFormatter={(val) => (val.length > 22 ? `${val.substring(0, 22)}...` : val)}
                  />
                  <Tooltip
                    formatter={(value: any, name: any, item: any) => [
                      `${value} Citations (${item.payload.percentage}%)`,
                      'Citations'
                    ]}
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px', color: '#fff', fontSize: '11px' }}
                  />
                  <Bar dataKey="citationCount" fill="#3b82f6" radius={[0, 6, 6, 0]}>
                    {analytics.documentUsage.slice(0, 6).map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={CATEGORY_COLORS[index % CATEGORY_COLORS.length]}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-slate-400">
                No documents uploaded yet to calculate utilization.
              </div>
            )}
          </div>
        </div>

        {/* Category Share Pie Chart */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs space-y-4 flex flex-col justify-between">
          <div>
            <h3 className="font-display font-bold text-slate-800 text-xs flex items-center gap-2">
              <Layers className="h-4 w-4 text-violet-600" />
              Category Domain Share
            </h3>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Knowledge domain citation distribution.
            </p>
          </div>

          <div className="h-44 w-full relative">
            {analytics?.categoryBreakdown && analytics.categoryBreakdown.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={analytics.categoryBreakdown}
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={68}
                    paddingAngle={3}
                    dataKey="count"
                    nameKey="category"
                  >
                    {analytics.categoryBreakdown.map((entry, index) => (
                      <Cell key={`cat-cell-${index}`} fill={CATEGORY_COLORS[index % CATEGORY_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(val: any, name: any, item: any) => [
                      `${val} citations (${item.payload.percentage}%)`,
                      name
                    ]}
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px', color: '#fff', fontSize: '11px' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-slate-400">
                No category data available
              </div>
            )}
          </div>

          {/* Category Legend List */}
          <div className="space-y-1.5 pt-2 border-t border-slate-100 max-h-28 overflow-y-auto">
            {analytics?.categoryBreakdown?.map((cat, idx) => (
              <div key={cat.category} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5 truncate">
                  <span
                    className="h-2.5 w-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: CATEGORY_COLORS[idx % CATEGORY_COLORS.length] }}
                  />
                  <span className="text-slate-700 truncate">{cat.category}</span>
                </div>
                <span className="font-mono text-slate-500 font-semibold shrink-0">
                  {cat.percentage}%
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Comprehensive Knowledge Base Utilization Table */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div className="space-y-0.5">
            <h3 className="font-display font-bold text-slate-800 text-xs flex items-center gap-2">
              <FileText className="h-4 w-4 text-blue-600" />
              Document Grounding Table & Citation Breakdown
            </h3>
            <p className="text-[11px] text-slate-400">
              Detailed tracking of every uploaded reference document and its relative utilization impact.
            </p>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="h-3.5 w-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search document metrics..."
              value={docSearchQuery}
              onChange={(e) => setDocSearchQuery(e.target.value)}
              className="w-full pl-8.5 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:bg-white focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/50 text-[10px] font-mono uppercase font-bold text-slate-500">
                <th className="py-2.5 px-3">Document Title</th>
                <th className="py-2.5 px-3">Category</th>
                <th className="py-2.5 px-3 text-right">Citations</th>
                <th className="py-2.5 px-3">Share %</th>
                <th className="py-2.5 px-3">Utilization Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredDocs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-slate-400 text-xs">
                    No documents matched your query.
                  </td>
                </tr>
              ) : (
                filteredDocs.map((doc) => {
                  const isHighDemand = doc.percentage >= 18;
                  const isModerate = doc.percentage > 5 && doc.percentage < 18;
                  const isUnused = doc.citationCount === 0;

                  return (
                    <tr key={doc.docId} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3 px-3 font-semibold text-slate-800">
                        <div className="flex items-center gap-2">
                          <FileText className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                          <span className="truncate max-w-sm" title={doc.title}>
                            {doc.title}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        <span className="inline-flex px-2 py-0.5 rounded-md text-[10px] font-mono font-medium bg-slate-100 text-slate-600">
                          {doc.category}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-bold text-slate-800">
                        {doc.citationCount.toLocaleString()}
                      </td>
                      <td className="py-3 px-3 w-44">
                        <div className="flex items-center gap-2">
                          <div className="w-24 bg-slate-100 h-1.5 rounded-full overflow-hidden">
                            <div
                              className="bg-blue-600 h-full rounded-full"
                              style={{ width: `${Math.min(100, doc.percentage * 2.5)}%` }}
                            />
                          </div>
                          <span className="font-mono text-[10px] text-slate-500 font-semibold">
                            {doc.percentage}%
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        {isHighDemand && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <Flame className="h-3 w-3 text-emerald-600" /> High Demand
                          </span>
                        )}
                        {isModerate && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                            <CheckCircle2 className="h-3 w-3 text-blue-600" /> Active Reference
                          </span>
                        )}
                        {isUnused && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">
                            <Info className="h-3 w-3 text-slate-400" /> Standby
                          </span>
                        )}
                        {!isHighDemand && !isModerate && !isUnused && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-50 text-slate-600">
                            Regular
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recent Telemetry & Interaction Stream */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-2xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="space-y-0.5">
            <h3 className="font-display font-bold text-slate-800 text-xs flex items-center gap-2">
              <Activity className="h-4 w-4 text-blue-600" />
              Live Telemetry Stream & Interaction Log
            </h3>
            <p className="text-[11px] text-slate-400">
              Live inspection of recent user queries, grounding sources cited, and latency response durations.
            </p>
          </div>
          <span className="text-[10px] font-mono px-2.5 py-1 rounded-lg bg-slate-100 text-slate-600 font-semibold">
            {analytics?.recentLogs?.length || 0} Recent Events
          </span>
        </div>

        <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
          {analytics?.recentLogs && analytics.recentLogs.length > 0 ? (
            analytics.recentLogs.map((log) => (
              <div
                key={log.id}
                className="p-3 rounded-xl border border-slate-200/80 bg-slate-50/50 hover:bg-white hover:border-blue-200 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
              >
                <div className="space-y-1 truncate flex-1">
                  <div className="flex items-center gap-2 truncate">
                    <span className="font-semibold text-slate-800 truncate">
                      "{log.userQuery}"
                    </span>
                    <span
                      className={`text-[9px] font-bold px-1.5 py-0.5 rounded-sm font-mono shrink-0 ${
                        log.status === 'grounded'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {log.status.toUpperCase()}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-slate-500">
                    <span className="font-mono">{new Date(log.timestamp).toLocaleTimeString()}</span>
                    <span>•</span>
                    {log.usedSources && log.usedSources.length > 0 ? (
                      <span className="text-blue-600 font-medium">
                        Sources: {log.usedSources.join(', ')}
                      </span>
                    ) : (
                      <span className="text-slate-400">No specific sources cited</span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <div className="text-right">
                    <div className="font-mono font-bold text-slate-800">
                      {log.latencyMs} ms
                    </div>
                    <div className="text-[10px] text-slate-400 font-mono">
                      ~{log.tokenCount} tokens
                    </div>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="py-6 text-center text-slate-400 text-xs">
              No live telemetry recorded yet. Converse with the agent in the Sandbox to log live metrics.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
