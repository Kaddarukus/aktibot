export interface DocumentItem {
  id: string;
  title: string;
  content: string;
  category: string;
  sourceFile?: string;
}

export interface ExtractedArticle extends DocumentItem {
  sourceFile?: string;
  isDraft?: boolean;
}

export interface IngestionFileItem {
  id: string;
  file: File;
  name: string;
  size: number;
  type: string;
  status: 'pending' | 'reading' | 'extracting' | 'completed' | 'error';
  progress?: number;
  extractedCount?: number;
  errorMessage?: string;
}

export interface SupportAgent {
  id: string;
  name: string;
  avatar: string; // Emoji representing the agent
  persona: string; // System instruction/behaviour
  welcomeMessage: string;
  themeColor: 'blue' | 'emerald' | 'violet' | 'amber' | 'rose' | 'slate';
  docs: DocumentItem[];
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: string;
  sourcesUsed?: { id: string; title: string }[];
}

export interface TestChatSession {
  agentId: string;
  messages: ChatMessage[];
}

export interface InteractionVolumePoint {
  timeLabel: string;
  timestamp: string;
  totalChats: number;
  groundedResponses: number;
  fallbackResponses: number;
  resolutionRate: number; // percentage
}

export interface ResponseTimePoint {
  timeLabel: string;
  timestamp: string;
  avgLatencyMs: number;
  p95LatencyMs: number;
  inferenceMs: number;
  retrievalMs: number;
}

export interface DocumentUsageStat {
  docId: string;
  title: string;
  category: string;
  citationCount: number;
  percentage: number;
  lastReferenced?: string;
}

export interface InteractionLogItem {
  id: string;
  timestamp: string;
  userQuery: string;
  agentResponsePreview: string;
  latencyMs: number;
  usedSources: string[];
  status: 'grounded' | 'fallback' | 'error';
  tokenCount: number;
}

export interface AgentAnalyticsSummary {
  agentId: string;
  timeframe: '24h' | '7d' | '30d';
  totalInteractions: number;
  avgResponseTimeMs: number;
  p95ResponseTimeMs: number;
  groundingRatePercentage: number;
  knowledgeBaseCoveragePercentage: number;
  volumeTrends: InteractionVolumePoint[];
  latencyTrends: ResponseTimePoint[];
  documentUsage: DocumentUsageStat[];
  categoryBreakdown: { category: string; count: number; percentage: number }[];
  recentLogs: InteractionLogItem[];
}
