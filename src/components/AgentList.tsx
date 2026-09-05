import React, { useState } from 'react';
import { SupportAgent } from '../types';
import { Bot, Plus, Search, HelpCircle, Sparkles, ChevronRight, MessageSquare, Trash2 } from 'lucide-react';

interface AgentListProps {
  agents: SupportAgent[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onCreateNew: () => void;
  onDelete: (id: string) => void;
}

export default function AgentList({
  agents,
  selectedId,
  onSelect,
  onCreateNew,
  onDelete
}: AgentListProps) {
  const [search, setSearch] = useState('');

  const filtered = agents.filter(agent =>
    agent.name.toLowerCase().includes(search.toLowerCase()) ||
    agent.persona.toLowerCase().includes(search.toLowerCase())
  );

  const getThemeClass = (color: string) => {
    switch (color) {
      case 'emerald': return 'bg-emerald-50 text-emerald-600 border-emerald-200';
      case 'violet': return 'bg-violet-50 text-violet-600 border-violet-200';
      case 'amber': return 'bg-amber-50 text-amber-600 border-amber-200';
      case 'rose': return 'bg-rose-50 text-rose-600 border-rose-200';
      case 'slate': return 'bg-slate-100 text-slate-700 border-slate-300';
      default: return 'bg-blue-50 text-blue-600 border-blue-200';
    }
  };

  return (
    <div className="flex flex-col h-full bg-white border-r border-slate-100 w-80 shrink-0">
      {/* Header */}
      <div className="p-4 border-b border-slate-100 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold text-lg">
              H
            </div>
            <div>
              <h1 className="font-display font-bold text-slate-800 leading-none">HospesAI</h1>
              <span className="text-[10px] text-slate-400 font-mono tracking-wider">SUPPORT CONVERSATIONAL HOST</span>
            </div>
          </div>
          <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 font-mono text-[10px] font-semibold border border-blue-100">
            v1.2
          </span>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search agents..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white text-slate-700 transition-colors"
          />
        </div>
      </div>

      {/* Agents Scrolling Area */}
      <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
        <div className="flex items-center justify-between px-2 mb-2">
          <span className="text-[10px] font-bold text-slate-400 font-mono tracking-wider">LIVE SUPPORT AGENTS</span>
          <button
            onClick={onCreateNew}
            className="flex items-center gap-1 text-[11px] font-semibold text-blue-600 hover:text-blue-700 hover:bg-blue-50/60 px-2 py-1 rounded-md transition-colors"
          >
            <Plus className="h-3 w-3" /> New Agent
          </button>
        </div>

        {filtered.length === 0 ? (
          <div className="text-center py-8 px-4 border border-dashed border-slate-100 rounded-xl bg-slate-50/50">
            <HelpCircle className="h-6 w-6 text-slate-300 mx-auto mb-2 animate-bounce" />
            <p className="text-xs text-slate-500 font-medium">No agents found</p>
            <button
              onClick={onCreateNew}
              className="mt-2 text-[10px] font-semibold text-blue-600 underline"
            >
              Create one now
            </button>
          </div>
        ) : (
          filtered.map(agent => {
            const isSelected = agent.id === selectedId;
            return (
              <div
                key={agent.id}
                onClick={() => onSelect(agent.id)}
                className={`group relative flex items-center gap-3 p-3 rounded-xl cursor-pointer border transition-all ${
                  isSelected
                    ? 'bg-slate-50 border-slate-200 shadow-sm ring-1 ring-slate-100'
                    : 'bg-white border-slate-100 hover:border-slate-200 hover:shadow-xs'
                }`}
              >
                {/* Agent Avatar Icon */}
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg border font-display shrink-0 ${getThemeClass(agent.themeColor)}`}>
                  {agent.avatar || '🤖'}
                </div>

                {/* Agent details */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-semibold text-slate-800 font-display truncate pr-2">
                      {agent.name}
                    </h3>
                    <ChevronRight className="h-3.5 w-3.5 text-slate-300 group-hover:text-slate-400 group-hover:translate-x-0.5 transition-all shrink-0" />
                  </div>
                  <p className="text-[10px] text-slate-400 truncate mt-0.5">
                    {agent.docs?.length || 0} grounding docs
                  </p>
                  <p className="text-[10px] text-slate-500 line-clamp-1 mt-1 italic">
                    "{agent.persona}"
                  </p>
                </div>

                {/* Hover Delete Action */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm(`Are you sure you want to delete ${agent.name}?`)) {
                      onDelete(agent.id);
                    }
                  }}
                  className="absolute right-2 bottom-2 p-1 rounded-md bg-rose-50 text-rose-500 opacity-0 group-hover:opacity-100 hover:bg-rose-100 hover:text-rose-600 transition-all shrink-0"
                  title="Delete Agent"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            );
          })
        )}
      </div>

      {/* Footer Branding & Status */}
      <div className="p-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          <span className="text-[10px] font-mono font-medium text-slate-500">hospesai.com.ng</span>
        </div>
        <span className="text-[10px] text-slate-400 font-mono">Platform Active</span>
      </div>
    </div>
  );
}
