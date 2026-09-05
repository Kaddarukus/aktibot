import React, { useState } from 'react';
import { SupportAgent } from '../types';
import { Code, Copy, Check, Info, Globe, ToggleLeft, Settings2, Sliders } from 'lucide-react';

interface WidgetEmbedProps {
  agent: SupportAgent;
}

export default function WidgetEmbed({ agent }: WidgetEmbedProps) {
  const [copied, setCopied] = useState(false);
  const [placement, setPlacement] = useState<'right' | 'left'>('right');
  const [triggerMode, setTriggerMode] = useState<'click' | 'delay'>('click');
  const [showBrand, setShowBrand] = useState(true);

  const getEmbedCode = () => {
    return `<!-- HospesAI Conversational Support Widget Embed (hospesai.com.ng) -->
<script>
  window.HospesAI_Widget = {
    agentId: "${agent.id}",
    themeColor: "${agent.themeColor}",
    welcomeMessage: "${agent.welcomeMessage.replace(/"/g, '\\"')}",
    position: "${placement}",
    trigger: "${triggerMode}",
    showHospesBranding: ${showBrand}
  };
</script>
<script src="https://cdn.hospesai.com.ng/v1/widget.js" async></script>
<!-- End HospesAI Embed -->`;
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(getEmbedCode());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Intro Banner */}
      <div className="bg-slate-50 border border-slate-100 p-5 rounded-2xl">
        <div className="flex items-center gap-2">
          <span className="p-1.5 rounded-lg bg-blue-50 text-blue-600">
            <Globe className="h-4 w-4" />
          </span>
          <h2 className="font-display font-bold text-slate-800 text-sm">Deploy Chat Widget to hospesai.com.ng</h2>
        </div>
        <p className="text-slate-400 text-[11px] mt-1">
          HospesAI lets you embed this intelligent, doc-grounded support chat bubble on any webpage. Customize its loader settings below and copy the snippet directly to your HTML header!
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Customization controls */}
        <div className="bg-white rounded-2xl border border-slate-100 p-5 space-y-4 shadow-xs">
          <div className="flex items-center gap-1.5 pb-2 border-b border-slate-100">
            <Sliders className="h-4 w-4 text-slate-500" />
            <h3 className="text-xs font-bold text-slate-800 font-display">Widget Loader Config</h3>
          </div>

          {/* Placement */}
          <div>
            <label className="block text-[10px] font-bold text-slate-400 font-mono tracking-wide uppercase mb-1.5">
              Screen Placement
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setPlacement('right')}
                className={`py-1.5 text-xs rounded-lg font-semibold border transition-all cursor-pointer ${
                  placement === 'right'
                    ? 'bg-blue-50 border-blue-200 text-blue-600'
                    : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                }`}
              >
                Bottom Right
              </button>
              <button
                onClick={() => setPlacement('left')}
                className={`py-1.5 text-xs rounded-lg font-semibold border transition-all cursor-pointer ${
                  placement === 'left'
                    ? 'bg-blue-50 border-blue-200 text-blue-600'
                    : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                }`}
              >
                Bottom Left
              </button>
            </div>
          </div>

          {/* Trigger behavior */}
          <div>
            <label className="block text-[10px] font-bold text-slate-400 font-mono tracking-wide uppercase mb-1.5">
              Trigger Behavior
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setTriggerMode('click')}
                className={`py-1.5 text-xs rounded-lg font-semibold border transition-all cursor-pointer ${
                  triggerMode === 'click'
                    ? 'bg-blue-50 border-blue-200 text-blue-600'
                    : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                }`}
              >
                On Launcher Click
              </button>
              <button
                onClick={() => setTriggerMode('delay')}
                className={`py-1.5 text-xs rounded-lg font-semibold border transition-all cursor-pointer ${
                  triggerMode === 'delay'
                    ? 'bg-blue-50 border-blue-200 text-blue-600'
                    : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                }`}
              >
                Auto-Open (3s Delay)
              </button>
            </div>
          </div>

          {/* Branding Toggle */}
          <div>
            <label className="block text-[10px] font-bold text-slate-400 font-mono tracking-wide uppercase mb-1.5">
              White-label Branding
            </label>
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-100">
              <span className="text-[11px] text-slate-600 font-medium">Show Hospes Logo</span>
              <button
                onClick={() => setShowBrand(!showBrand)}
                className={`px-2.5 py-1 text-[10px] font-bold rounded-md font-mono ${
                  showBrand
                    ? 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                    : 'bg-slate-200 text-slate-500 border border-slate-300'
                }`}
              >
                {showBrand ? 'ENABLED' : 'DISABLED'}
              </button>
            </div>
          </div>
        </div>

        {/* Integration Instructions & Code Block */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-slate-900 rounded-2xl overflow-hidden shadow-md flex flex-col h-full min-h-[300px]">
            {/* Code Block Header */}
            <div className="px-4 py-3 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Code className="h-4 w-4 text-slate-400" />
                <span className="text-[10px] font-mono text-slate-300 font-bold tracking-wider">HTML EMBED SNIPPET</span>
              </div>
              <button
                onClick={handleCopy}
                className="flex items-center gap-1 text-[10px] font-mono font-semibold bg-slate-850 hover:bg-slate-800 text-slate-300 hover:text-white px-2.5 py-1.5 rounded-lg border border-slate-800 transition-colors cursor-pointer"
              >
                {copied ? (
                  <>
                    <Check className="h-3 w-3 text-emerald-400 animate-pulse" /> Copied!
                  </>
                ) : (
                  <>
                    <Copy className="h-3 w-3" /> Copy Snippet
                  </>
                )}
              </button>
            </div>

            {/* Snippet Content */}
            <div className="flex-1 p-4 overflow-x-auto text-[11px] font-mono text-blue-300 leading-relaxed bg-slate-900 whitespace-pre">
              {getEmbedCode()}
            </div>
          </div>

          {/* Quick guide alerts */}
          <div className="flex items-start gap-3 p-4 bg-blue-50 border border-blue-100 rounded-xl text-blue-800 text-xs">
            <Info className="h-4.5 w-4.5 shrink-0 mt-0.5 text-blue-600" />
            <div>
              <h4 className="font-bold text-[11px]">Quick Hosting Directions</h4>
              <p className="text-blue-700/95 text-[10px] leading-relaxed mt-1">
                Insert this snippet directly inside the <code>&lt;body&gt;</code> tag of your index page or site layout. The asynchronous widget loader will load securely without slowing down your site speed or breaking SEO metadata.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
