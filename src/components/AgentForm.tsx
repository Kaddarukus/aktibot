import React, { useState, useEffect, useRef, useCallback } from 'react';
import { SupportAgent } from '../types';
import { Bot, Save, Sparkles, HelpCircle, AlertCircle, X, Download, CheckCircle2, Loader2, Cloud } from 'lucide-react';

interface AgentFormProps {
  agent: Partial<SupportAgent> | null;
  onSave: (agent: Partial<SupportAgent>, isAutoSave?: boolean) => Promise<any> | void;
  onCancel: () => void;
}

const TEMPLATES = [
  {
    name: 'Technical Host Expert',
    avatar: '💻',
    color: 'blue',
    welcome: 'Hello! Technical Support here. How can I help resolve your server or hosting issues today?',
    persona: 'You are an advanced systems administrator and support engineer at Hospes Hosting. Your tone is technical, exact, professional, and clear. Ground your answers strictly in the reference manuals. If you cannot find a resolution in the documents, state: "I cannot find a direct resolution in my tech guides, but let me open an escalated engineering ticket for you."'
  },
  {
    name: 'Billing & Account Specialist',
    avatar: '💳',
    color: 'amber',
    welcome: 'Greetings! I am your billing companion. Ask me anything about refunds, plans, or cancellation policies.',
    persona: 'You are an account manager and billing assistant. Your tone is warm, polite, incredibly empathetic, and professional. Always search billing documentation first. If a request requires manual review or falls outside documents, state: "Our finance desk will need to manually approve this. I am notifying our team right away."'
  },
  {
    name: 'Friendly Concierge Bot',
    avatar: '🌟',
    color: 'emerald',
    welcome: 'Hi! Welcome! How can I bring a smile to your face and guide you through our services today?',
    persona: 'You are a warm, customer-first receptionist and concierge. Your tone is charming, cheerful, welcoming, and helpful. Always guide users with clear lists and enthusiastic support, strictly respecting center hours and facilities.'
  }
];

export default function AgentForm({ agent, onSave, onCancel }: AgentFormProps) {
  const [name, setName] = useState('');
  const [avatar, setAvatar] = useState('🤖');
  const [themeColor, setThemeColor] = useState<SupportAgent['themeColor']>('blue');
  const [welcomeMessage, setWelcomeMessage] = useState('');
  const [persona, setPersona] = useState('');
  const [error, setError] = useState('');
  const [currentId, setCurrentId] = useState<string | undefined>(agent?.id);

  // Auto-save state
  const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'pending' | 'saving' | 'saved' | 'error'>('idle');
  const [lastSavedTime, setLastSavedTime] = useState<string | null>(null);

  const isInitialMount = useRef(true);
  const debounceTimerRef = useRef<any>(null);
  const lastSavedPayloadRef = useRef<string>('');

  useEffect(() => {
    if (agent) {
      setName(agent.name || '');
      setAvatar(agent.avatar || '🤖');
      setThemeColor(agent.themeColor || 'blue');
      setWelcomeMessage(agent.welcomeMessage || '');
      setPersona(agent.persona || '');
      setCurrentId(agent.id);

      lastSavedPayloadRef.current = JSON.stringify({
        id: agent.id,
        name: agent.name || '',
        avatar: agent.avatar || '🤖',
        themeColor: agent.themeColor || 'blue',
        welcomeMessage: agent.welcomeMessage || '',
        persona: agent.persona || '',
        docs: agent.docs || []
      });
    } else {
      setName('');
      setAvatar('🤖');
      setThemeColor('blue');
      setWelcomeMessage('Hello! How can I assist you today?');
      setPersona('');
      setCurrentId(undefined);
      lastSavedPayloadRef.current = '';
    }
    setError('');
    setAutoSaveStatus('idle');
    isInitialMount.current = true;
  }, [agent]);

  // Execute Auto-Save function
  const triggerAutoSave = useCallback(async (currentData: {
    id?: string;
    name: string;
    avatar: string;
    themeColor: SupportAgent['themeColor'];
    welcomeMessage: string;
    persona: string;
  }) => {
    // Only auto-save if required fields (name and persona) are non-empty
    if (!currentData.name.trim() || !currentData.persona.trim()) {
      setAutoSaveStatus('idle');
      return;
    }

    const payload = {
      id: currentData.id || currentId,
      name: currentData.name.trim(),
      avatar: currentData.avatar,
      themeColor: currentData.themeColor,
      welcomeMessage: currentData.welcomeMessage.trim(),
      persona: currentData.persona.trim(),
      docs: agent?.docs || []
    };

    const payloadString = JSON.stringify(payload);
    if (payloadString === lastSavedPayloadRef.current) {
      setAutoSaveStatus('saved');
      return;
    }

    try {
      setAutoSaveStatus('saving');
      const result = await onSave(payload, true);
      if (result?.id && !currentId) {
        setCurrentId(result.id);
      }
      lastSavedPayloadRef.current = payloadString;
      setLastSavedTime(new Date().toLocaleTimeString());
      setAutoSaveStatus('saved');
    } catch (err) {
      console.error('Auto-save error in AgentForm:', err);
      setAutoSaveStatus('error');
    }
  }, [agent?.docs, currentId, onSave]);

  // Track changes and debounce auto-save
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    const currentPayload = JSON.stringify({
      id: currentId,
      name: name.trim(),
      avatar,
      themeColor,
      welcomeMessage: welcomeMessage.trim(),
      persona: persona.trim(),
      docs: agent?.docs || []
    });

    if (currentPayload === lastSavedPayloadRef.current) {
      return;
    }

    if (name.trim() && persona.trim()) {
      setAutoSaveStatus('pending');
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      debounceTimerRef.current = setTimeout(() => {
        triggerAutoSave({
          id: currentId,
          name,
          avatar,
          themeColor,
          welcomeMessage,
          persona
        });
      }, 1800);
    }

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [name, avatar, themeColor, welcomeMessage, persona, currentId, agent?.docs, triggerAutoSave]);

  const applyTemplate = (tpl: typeof TEMPLATES[0]) => {
    setName(tpl.name);
    setAvatar(tpl.avatar);
    setThemeColor(tpl.color as SupportAgent['themeColor']);
    setWelcomeMessage(tpl.welcome);
    setPersona(tpl.persona);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    if (!name.trim()) {
      setError('Please provide a descriptive name for your support agent.');
      return;
    }
    if (!persona.trim()) {
      setError('Persona system prompt is required to instruct the AI behavior.');
      return;
    }
    await onSave({
      id: currentId || agent?.id,
      name: name.trim(),
      avatar,
      themeColor,
      welcomeMessage: welcomeMessage.trim(),
      persona: persona.trim(),
      docs: agent?.docs || []
    }, false);
  };

  const handleBackup = () => {
    const backupData = {
      id: currentId || agent?.id || `agent-${Date.now()}`,
      name: name.trim(),
      avatar,
      themeColor,
      welcomeMessage: welcomeMessage.trim(),
      persona: persona.trim(),
      docs: agent?.docs || []
    };
    
    const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const downloadAnchor = document.createElement('a');
    downloadAnchor.href = url;
    downloadAnchor.download = `${(name.trim() || 'agent').toLowerCase().replace(/[^a-z0-9]+/g, '_')}_backup.json`;
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    document.body.removeChild(downloadAnchor);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden p-6 max-w-2xl mx-auto my-4" id="agent-form-panel">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <Bot className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-display font-bold text-slate-800 text-sm">
                {agent?.id || currentId ? 'Configure Agent Settings' : 'Deploy a New Support Agent'}
              </h2>
              {/* Real-time Auto-Save Status Badge */}
              <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono transition-all">
                {autoSaveStatus === 'saving' && (
                  <span className="flex items-center gap-1 text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-100 font-semibold animate-pulse">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Auto-saving to database...
                  </span>
                )}
                {autoSaveStatus === 'pending' && (
                  <span className="flex items-center gap-1 text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-100">
                    <Cloud className="h-3 w-3 animate-pulse" />
                    Unsaved changes (auto-saving in 2s)...
                  </span>
                )}
                {autoSaveStatus === 'saved' && (
                  <span className="flex items-center gap-1 text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
                    <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                    Auto-saved to DB {lastSavedTime ? `at ${lastSavedTime}` : ''}
                  </span>
                )}
                {autoSaveStatus === 'error' && (
                  <span className="flex items-center gap-1 text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-100">
                    <AlertCircle className="h-3 w-3 text-rose-500" />
                    Auto-save failed
                  </span>
                )}
                {autoSaveStatus === 'idle' && (agent?.id || currentId) && (
                  <span className="flex items-center gap-1 text-slate-400 bg-slate-50 px-2 py-0.5 rounded-full border border-slate-100">
                    <Cloud className="h-3 w-3" />
                    Auto-save enabled
                  </span>
                )}
              </div>
            </div>
            <p className="text-slate-400 text-[11px]">
              Set the name, persona instructions, and greeting style. Changes auto-save to database while typing.
            </p>
          </div>
        </div>
        <button
          onClick={onCancel}
          className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
          title="Close editor"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Templates Row */}
      {!agent?.id && !currentId && (
        <div className="mb-6 p-4 bg-slate-50 rounded-xl border border-slate-100">
          <div className="flex items-center gap-1.5 mb-2.5">
            <Sparkles className="h-4 w-4 text-amber-500 animate-pulse" />
            <span className="text-[10px] font-bold text-slate-500 font-mono tracking-wider">CHOOSE AN AGENT TEMPLATE</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
            {TEMPLATES.map((tpl, i) => (
              <button
                key={i}
                type="button"
                onClick={() => applyTemplate(tpl)}
                className="text-left bg-white p-3 rounded-lg border border-slate-200/80 hover:border-blue-400 hover:shadow-xs transition-all"
              >
                <div className="flex items-center gap-2">
                  <span className="text-base">{tpl.avatar}</span>
                  <span className="text-xs font-semibold text-slate-800 truncate">{tpl.name}</span>
                </div>
                <p className="text-[9px] text-slate-400 mt-1 line-clamp-2">
                  {tpl.persona}
                </p>
              </button>
            ))}
          </div>
        </div>
      )}

      {error && (
        <div className="mb-5 flex items-start gap-2.5 p-3 rounded-lg bg-rose-50 text-rose-600 border border-rose-100 text-xs">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Name */}
          <div className="md:col-span-2">
            <div className="flex items-center justify-between mb-1">
              <label className="block text-[11px] font-bold text-slate-500 font-mono tracking-wide uppercase">
                Agent Display Name
              </label>
              <span className="text-[9px] text-slate-400 font-mono">Auto-saves as you type</span>
            </div>
            <input
              type="text"
              placeholder="e.g. Hospes Cloud Host Advisor"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full text-xs px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white text-slate-800"
            />
          </div>

          {/* Avatar Selection */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 font-mono tracking-wide uppercase mb-1">
              Avatar Emoji
            </label>
            <select
              value={avatar}
              onChange={(e) => setAvatar(e.target.value)}
              className="w-full text-xs px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white text-slate-800 cursor-pointer"
            >
              <option value="🤖">🤖 Robot</option>
              <option value="🚀">🚀 Rocket</option>
              <option value="💳">💳 Card</option>
              <option value="💻">💻 Screen</option>
              <option value="🥑">🥑 Avocado</option>
              <option value="🌟">🌟 Star</option>
              <option value="💼">💼 Briefcase</option>
              <option value="🛠️">🛠️ Tools</option>
              <option value="🍕">🍕 Pizza</option>
              <option value="🏥">🏥 Cross</option>
            </select>
          </div>
        </div>

        {/* Theme Color & Welcome Message */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-[11px] font-bold text-slate-500 font-mono tracking-wide uppercase mb-1">
              Theme Color (Widget)
            </label>
            <div className="flex items-center gap-1.5 mt-1">
              {(['blue', 'emerald', 'violet', 'amber', 'rose', 'slate'] as const).map(color => {
                const colors: Record<string, string> = {
                  blue: 'bg-blue-600',
                  emerald: 'bg-emerald-600',
                  violet: 'bg-violet-600',
                  amber: 'bg-amber-500',
                  rose: 'bg-rose-500',
                  slate: 'bg-slate-600'
                };
                return (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setThemeColor(color)}
                    className={`w-6 h-6 rounded-full ${colors[color]} relative transition-transform cursor-pointer ${
                      themeColor === color ? 'scale-125 ring-2 ring-offset-2 ring-slate-400' : 'opacity-80 hover:opacity-100'
                    }`}
                    title={color}
                  />
                );
              })}
            </div>
          </div>

          <div className="md:col-span-2">
            <label className="block text-[11px] font-bold text-slate-500 font-mono tracking-wide uppercase mb-1">
              Instant Welcome Message
            </label>
            <input
              type="text"
              placeholder="How the agent greets customers (e.g. Hello! how can I assist you today?)"
              value={welcomeMessage}
              onChange={(e) => setWelcomeMessage(e.target.value)}
              className="w-full text-xs px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white text-slate-800"
            />
          </div>
        </div>

        {/* Persona (System prompt) */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="block text-[11px] font-bold text-slate-500 font-mono tracking-wide uppercase">
              System Instruction Prompt (Persona)
            </label>
            <span className="text-[10px] text-slate-400 font-mono">Governs model behavior (Auto-saved)</span>
          </div>
          <textarea
            rows={5}
            placeholder="Instruct your AI support bot how to speak, its attitude, parameters of engagement, and what to state if manual help is needed."
            value={persona}
            onChange={(e) => setPersona(e.target.value)}
            className="w-full text-xs p-3 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white text-slate-800 font-mono leading-relaxed"
          />
          <p className="text-[10px] text-slate-400 mt-1">
            Tip: Be descriptive about formatting rules, constraints, and professional tone. Auto-saves continuously.
          </p>
        </div>

        {/* Action Row */}
        <div className="flex items-center justify-between gap-3 pt-3 border-t border-slate-100">
          <div className="flex items-center gap-2">
            {(agent?.id || currentId) && (
              <button
                type="button"
                onClick={handleBackup}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
              >
                <Download className="h-3.5 w-3.5" /> Export JSON
              </button>
            )}
            {autoSaveStatus === 'saved' && (
              <span className="hidden sm:flex items-center gap-1 text-[11px] text-emerald-600 font-medium">
                <CheckCircle2 className="h-3.5 w-3.5" /> All changes persisted
              </span>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-500 hover:text-slate-700 bg-slate-50 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              Done / Close
            </button>
            <button
              type="submit"
              className="flex items-center gap-1.5 px-5 py-2 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-xs hover:shadow-md transition-all cursor-pointer"
            >
              <Save className="h-4 w-4" /> Save Now
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

