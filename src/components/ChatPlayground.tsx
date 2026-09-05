import React, { useState, useRef, useEffect } from 'react';
import { SupportAgent, ChatMessage } from '../types';
import { Send, Bot, User, CornerDownLeft, AlertCircle, FileText, HelpCircle, Loader2 } from 'lucide-react';

interface ChatPlaygroundProps {
  agent: SupportAgent;
  initialMessage?: string;
}

export default function ChatPlayground({ agent, initialMessage }: ChatPlaygroundProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingStep, setLoadingStep] = useState(0);

  const loadingSteps = [
    'Initializing secure WHMCS & WHM API handshakes...',
    'Interrogating WHM resource quotas & CloudLinux LVE limits...',
    'Auditing cPanel directory CHMOD permissions & .htaccess syntax...',
    'Performing DNS zone file registry scans & SPF/DKIM validation...',
    'Executing automatic core configuration repairs...'
  ];

  useEffect(() => {
    let interval: any;
    if (isLoading && agent.id === 'hospes-host') {
      setLoadingStep(0);
      interval = setInterval(() => {
        setLoadingStep(prev => (prev < loadingSteps.length - 1 ? prev + 1 : prev));
      }, 1300);
    } else {
      setLoadingStep(0);
    }
    return () => clearInterval(interval);
  }, [isLoading, agent.id]);

  const chatEndRef = useRef<HTMLDivElement>(null);

  // Initialize with welcome message when agent changes
  useEffect(() => {
    setMessages([
      {
        id: 'welcome',
        role: 'model',
        text: agent.welcomeMessage || `Hello! I am ${agent.name}. How can I assist you today?`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }
    ]);
    setError(null);

    if (initialMessage && initialMessage.trim()) {
      setTimeout(() => {
        handleSendMessage(initialMessage);
      }, 200);
    }
  }, [agent, initialMessage]);

  // Scroll to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Dynamically compile suggestive questions based on documents
  const getSuggestions = () => {
    if (!agent.docs || agent.docs.length === 0) {
      return ['Is there human help available?'];
    }
    return agent.docs.slice(0, 3).map(doc => {
      const lower = doc.title.toLowerCase();
      if (lower.includes('nameserver') || lower.includes('dns')) return 'How do I point my domain nameservers?';
      if (lower.includes('refund') || lower.includes('cancel')) return 'What is your cancellation refund policy?';
      if (lower.includes('pricing') || lower.includes('plan')) return 'What are the cloud shared hosting prices?';
      if (lower.includes('ssl') || lower.includes('security')) return 'How do I request a free SSL?';
      if (lower.includes('ssh') || lower.includes('terminal')) return 'Is SSH access enabled?';
      return `What is the policy for: ${doc.title}?`;
    });
  };

  const handleSendMessage = async (textToSend: string) => {
    if (!textToSend.trim() || isLoading) return;

    setError(null);
    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      text: textToSend.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    setInput('');
    setIsLoading(true);

    try {
      // Proxy chat prompt through our server backend
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentId: agent.id,
          messages: nextMessages.map(m => ({ role: m.role, text: m.text }))
        })
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || 'Server error communicating with Gemini.');
      }

      const data = await response.json();

      const modelMsg: ChatMessage = {
        id: `model-${Date.now()}`,
        role: 'model',
        text: data.answer,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        sourcesUsed: data.usedSources?.map((src: string, index: number) => ({ id: `src-${index}`, title: src })) || []
      };

      setMessages(prev => [...prev, modelMsg]);
    } catch (err: any) {
      console.error('Chat error:', err);
      setError(err.message || 'An unexpected error occurred while generating a response.');
    } finally {
      setIsLoading(false);
    }
  };

  const getThemeStyles = (color: string) => {
    const map: Record<string, { bg: string; text: string; border: string; focus: string; msgBg: string }> = {
      emerald: {
        bg: 'bg-emerald-600 hover:bg-emerald-700',
        text: 'text-emerald-600',
        border: 'border-emerald-200',
        focus: 'focus:ring-emerald-500',
        msgBg: 'bg-emerald-50 text-slate-800'
      },
      violet: {
        bg: 'bg-violet-600 hover:bg-violet-700',
        text: 'text-violet-600',
        border: 'border-violet-200',
        focus: 'focus:ring-violet-500',
        msgBg: 'bg-violet-50 text-slate-800'
      },
      amber: {
        bg: 'bg-amber-500 hover:bg-amber-600',
        text: 'text-amber-600',
        border: 'border-amber-200',
        focus: 'focus:ring-amber-500',
        msgBg: 'bg-amber-50 text-slate-800'
      },
      rose: {
        bg: 'bg-rose-500 hover:bg-rose-600',
        text: 'text-rose-600',
        border: 'border-rose-200',
        focus: 'focus:ring-rose-500',
        msgBg: 'bg-rose-50 text-slate-800'
      },
      slate: {
        bg: 'bg-slate-600 hover:bg-slate-700',
        text: 'text-slate-600',
        border: 'border-slate-300',
        focus: 'focus:ring-slate-500',
        msgBg: 'bg-slate-100 text-slate-800'
      },
      blue: {
        bg: 'bg-blue-600 hover:bg-blue-700',
        text: 'text-blue-600',
        border: 'border-blue-200',
        focus: 'focus:ring-blue-500',
        msgBg: 'bg-blue-50 text-slate-800'
      }
    };
    return map[color] || map.blue;
  };

  const styles = getThemeStyles(agent.themeColor);

  return (
    <div className="flex flex-col h-[520px] bg-slate-50 rounded-2xl border border-slate-150 overflow-hidden shadow-xs">
      {/* Active Playground Status Bar */}
      <div className="bg-white border-b border-slate-150 p-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-base border font-display ${styles.text} ${styles.border} bg-white`}>
            {agent.avatar || '🤖'}
          </div>
          <div>
            <h3 className="text-xs font-bold text-slate-800 font-display flex items-center gap-2">
              {agent.name}
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
            </h3>
            <p className="text-[10px] text-slate-400 font-mono tracking-wider uppercase">
              ACTIVE SANDBOX PLATFORM
            </p>
          </div>
        </div>

        <button
          onClick={() => {
            if (confirm('Clear chat history?')) {
              setMessages([
                {
                  id: 'welcome',
                  role: 'model',
                  text: agent.welcomeMessage || 'Hello! How can I assist you today?',
                  timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                }
              ]);
              setError(null);
            }
          }}
          className="text-[10px] font-mono font-semibold text-slate-400 hover:text-slate-600 bg-slate-100 hover:bg-slate-200 px-2 py-1 rounded-md transition-all"
        >
          RESET
        </button>
      </div>

      {/* Messages scrolling list */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3.5">
        {messages.map(msg => (
          <div
            key={msg.id}
            className={`flex items-start gap-2.5 max-w-[85%] ${msg.role === 'user' ? 'ml-auto flex-row-reverse' : ''}`}
          >
            {/* Persona icon badge */}
            <div className={`w-7 h-7 rounded-lg flex items-center justify-center border text-xs shrink-0 ${
              msg.role === 'user'
                ? 'bg-white text-slate-600 border-slate-200'
                : `bg-white ${styles.text} ${styles.border}`
            }`}>
              {msg.role === 'user' ? <User className="h-3.5 w-3.5" /> : (agent.avatar || '🤖')}
            </div>

            {/* Bubble body */}
            <div className="flex flex-col gap-1">
              <div className={`px-4 py-2.5 rounded-2xl text-xs font-sans leading-relaxed shadow-xs ${
                msg.role === 'user'
                  ? 'bg-blue-600 text-white rounded-tr-none'
                  : 'bg-white text-slate-700 rounded-tl-none border border-slate-150'
              }`}>
                <div className="whitespace-pre-wrap">{msg.text}</div>

                {/* Grounding Citations */}
                {msg.role === 'model' && msg.sourcesUsed && msg.sourcesUsed.length > 0 && (
                  <div className="mt-3.5 pt-2 border-t border-slate-100 flex flex-col gap-1.5">
                    <div className="flex items-center gap-1 text-[9px] font-mono font-bold text-slate-400 uppercase tracking-wide">
                      <FileText className="h-3 w-3" /> Grounding Source Referenced
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {msg.sourcesUsed.map(src => (
                        <span
                          key={src.id}
                          className="inline-flex items-center gap-1 text-[9px] font-semibold bg-slate-50 text-slate-500 border border-slate-150 rounded-md px-1.5 py-0.5"
                          title="Verified business record lookup"
                        >
                          {src.title}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <span className={`text-[9px] text-slate-400 font-mono ${msg.role === 'user' ? 'text-right' : ''}`}>
                {msg.timestamp}
              </span>
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex items-start gap-2.5 max-w-[85%]">
            <div className={`w-7 h-7 rounded-lg flex items-center justify-center border text-xs shrink-0 bg-white ${styles.text} ${styles.border}`}>
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            </div>
            <div className="px-4 py-3 rounded-2xl text-xs font-sans bg-white border border-slate-150 shadow-sm flex-1">
              {agent.id === 'hospes-host' ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-[10px] font-mono font-bold text-blue-600 uppercase tracking-wide">
                    <span>Brutal Order Check & Fix Engine</span>
                    <span>Step {loadingStep + 1}/5</span>
                  </div>
                  <div className="text-slate-700 font-medium font-sans">
                    {loadingSteps[loadingStep]}
                  </div>
                  <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                    <div 
                      className="bg-blue-600 h-full transition-all duration-300"
                      style={{ width: `${((loadingStep + 1) / 5) * 100}%` }}
                    />
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="text-slate-400">AI search in documentation...</span>
                </div>
              )}
            </div>
          </div>
        )}

        {error && (
          <div className="flex items-start gap-2 p-3 bg-rose-50 border border-rose-100 rounded-xl text-rose-600 text-xs">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <div className="flex-1">
              <span className="font-semibold block mb-0.5">Prompt failure</span>
              <span>{error}</span>
            </div>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Suggestive Quick-Fills */}
      <div className="px-4 py-2.5 bg-white border-t border-slate-100 flex flex-col gap-1.5 shrink-0">
        <div className="flex items-center gap-1">
          <HelpCircle className="h-3 w-3 text-slate-400" />
          <span className="text-[9px] font-mono font-bold text-slate-400 uppercase tracking-wider">Suggested test queries</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {getSuggestions().map((q, i) => (
            <button
              key={i}
              type="button"
              disabled={isLoading}
              onClick={() => handleSendMessage(q)}
              className="text-[10px] bg-slate-50 text-slate-600 border border-slate-200 hover:border-blue-400 hover:bg-blue-50 hover:text-blue-600 px-2.5 py-1 rounded-lg transition-all text-left truncate max-w-full cursor-pointer disabled:opacity-50"
            >
              {q}
            </button>
          ))}
        </div>
      </div>

      {/* Input box */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSendMessage(input);
        }}
        className="p-3 bg-white border-t border-slate-150 flex items-center gap-2 shrink-0"
      >
        <input
          type="text"
          value={input}
          disabled={isLoading}
          onChange={(e) => setInput(e.target.value)}
          placeholder={`Message ${agent.name}...`}
          className="flex-1 text-xs px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white text-slate-800"
        />
        <button
          type="submit"
          disabled={!input.trim() || isLoading}
          className={`w-9 h-9 rounded-xl text-white flex items-center justify-center transition-all ${
            !input.trim() || isLoading
              ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
              : `${styles.bg} shadow-xs hover:shadow-md cursor-pointer`
          }`}
        >
          <Send className="h-4 w-4" />
        </button>
      </form>
    </div>
  );
}
