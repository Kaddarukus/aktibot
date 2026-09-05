import React, { useState, useEffect, useRef, useCallback } from 'react';
import { SupportAgent, DocumentItem, ExtractedArticle, IngestionFileItem } from '../types';
import {
  FileText,
  Plus,
  Edit,
  Trash2,
  Check,
  AlertCircle,
  Bookmark,
  Sparkles,
  Loader2,
  Cloud,
  CheckCircle2,
  UploadCloud,
  FileUp,
  FileCheck2,
  FileType,
  X,
  Search,
  Filter,
  ArrowRight,
  Layers,
  BookOpen,
  Info
} from 'lucide-react';

interface KnowledgeBaseProps {
  agent: SupportAgent;
  onUpdateDocs: (docs: DocumentItem[], isAutoSave?: boolean) => Promise<any> | void;
}

export default function KnowledgeBase({ agent, onUpdateDocs }: KnowledgeBaseProps) {
  // Manual Editing States
  const [editingDocId, setEditingDocId] = useState<string | null>(null);
  const [docTitle, setDocTitle] = useState('');
  const [docCategory, setDocCategory] = useState('General');
  const [docContent, setDocContent] = useState('');
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [error, setError] = useState('');

  // Search and Category Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('all');

  // Drag & Drop / Bulk Ingestion States
  const [isDragOver, setIsDragOver] = useState(false);
  const [queuedFiles, setQueuedFiles] = useState<IngestionFileItem[]>([]);
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractionProgress, setExtractionProgress] = useState(0);
  const [extractionStatusText, setExtractionStatusText] = useState('');
  const [stagedArticles, setStagedArticles] = useState<ExtractedArticle[]>([]);
  const [extractionErrors, setExtractionErrors] = useState<string[]>([]);
  const [showIngestionModal, setShowIngestionModal] = useState(false);
  const [successBanner, setSuccessBanner] = useState<string | null>(null);

  // Auto-save state
  const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'pending' | 'saving' | 'saved' | 'error'>('idle');
  const [lastSavedTime, setLastSavedTime] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const debounceTimerRef = useRef<any>(null);
  const lastSavedPayloadRef = useRef<string>('');
  const activeEditingDocIdRef = useRef<string | null>(null);

  useEffect(() => {
    activeEditingDocIdRef.current = editingDocId;
  }, [editingDocId]);

  // Clear success banner after 6 seconds
  useEffect(() => {
    if (successBanner) {
      const timer = setTimeout(() => setSuccessBanner(null), 6000);
      return () => clearTimeout(timer);
    }
  }, [successBanner]);

  const handleEdit = (doc: DocumentItem) => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    setEditingDocId(doc.id);
    activeEditingDocIdRef.current = doc.id;
    setDocTitle(doc.title);
    setDocCategory(doc.category);
    setDocContent(doc.content);
    setIsAddingNew(false);
    setError('');
    setAutoSaveStatus('idle');
    lastSavedPayloadRef.current = JSON.stringify({
      id: doc.id,
      title: doc.title.trim(),
      category: doc.category.trim(),
      content: doc.content.trim()
    });
  };

  const handleAddNew = () => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    setEditingDocId(null);
    activeEditingDocIdRef.current = null;
    setDocTitle('');
    setDocCategory('Tech Support');
    setDocContent('');
    setIsAddingNew(true);
    setError('');
    setAutoSaveStatus('idle');
    lastSavedPayloadRef.current = '';
  };

  // Trigger auto-save for the document currently being edited or added
  const triggerAutoSave = useCallback(async (currentData: {
    title: string;
    category: string;
    content: string;
  }) => {
    if (!currentData.title.trim() || !currentData.content.trim()) {
      setAutoSaveStatus('idle');
      return;
    }

    let targetDocId = activeEditingDocIdRef.current;
    let isCreating = !targetDocId;

    if (isCreating) {
      targetDocId = `doc-${Date.now()}`;
      activeEditingDocIdRef.current = targetDocId;
      setEditingDocId(targetDocId);
      setIsAddingNew(false);
    }

    const payloadString = JSON.stringify({
      id: targetDocId,
      title: currentData.title.trim(),
      category: currentData.category.trim() || 'General',
      content: currentData.content.trim()
    });

    if (payloadString === lastSavedPayloadRef.current) {
      setAutoSaveStatus('saved');
      return;
    }

    try {
      setAutoSaveStatus('saving');
      let updatedDocs = [...(agent.docs || [])];
      const existingIndex = updatedDocs.findIndex(d => d.id === targetDocId);

      const targetDocItem: DocumentItem = {
        id: targetDocId!,
        title: currentData.title.trim(),
        category: currentData.category.trim() || 'General',
        content: currentData.content.trim()
      };

      if (existingIndex >= 0) {
        updatedDocs[existingIndex] = targetDocItem;
      } else {
        updatedDocs.push(targetDocItem);
      }

      await onUpdateDocs(updatedDocs, true);
      lastSavedPayloadRef.current = payloadString;
      setLastSavedTime(new Date().toLocaleTimeString());
      setAutoSaveStatus('saved');
    } catch (err) {
      console.error('Auto-save error in KnowledgeBase:', err);
      setAutoSaveStatus('error');
    }
  }, [agent.docs, onUpdateDocs]);

  // Track keystrokes in active editor and trigger debounced auto-save
  useEffect(() => {
    if (!isAddingNew && !editingDocId) {
      return;
    }

    const currentPayload = JSON.stringify({
      id: editingDocId || activeEditingDocIdRef.current || 'new',
      title: docTitle.trim(),
      category: docCategory.trim(),
      content: docContent.trim()
    });

    if (currentPayload === lastSavedPayloadRef.current) {
      return;
    }

    if (docTitle.trim() && docContent.trim()) {
      setAutoSaveStatus('pending');
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      debounceTimerRef.current = setTimeout(() => {
        triggerAutoSave({
          title: docTitle,
          category: docCategory,
          content: docContent
        });
      }, 1800);
    }

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [docTitle, docCategory, docContent, isAddingNew, editingDocId, triggerAutoSave]);

  const handleSave = async () => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    if (!docTitle.trim()) {
      setError('Document title is required.');
      return;
    }
    if (!docContent.trim()) {
      setError('Document body content is required for AI learning.');
      return;
    }

    let updatedDocs = [...(agent.docs || [])];
    const targetDocId = editingDocId || activeEditingDocIdRef.current || `doc-${Date.now()}`;

    const newDoc: DocumentItem = {
      id: targetDocId,
      title: docTitle.trim(),
      category: docCategory.trim() || 'General',
      content: docContent.trim()
    };

    const existingIndex = updatedDocs.findIndex(d => d.id === targetDocId);
    if (existingIndex >= 0) {
      updatedDocs[existingIndex] = newDoc;
    } else {
      updatedDocs.push(newDoc);
    }

    await onUpdateDocs(updatedDocs, false);
    cancelEditState();
  };

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to delete this support document? Your AI agent will no longer be grounded on this information.')) {
      const updatedDocs = agent.docs.filter(doc => doc.id !== id);
      onUpdateDocs(updatedDocs, false);
      if (editingDocId === id) {
        cancelEditState();
      }
    }
  };

  const cancelEditState = () => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    setEditingDocId(null);
    activeEditingDocIdRef.current = null;
    setIsAddingNew(false);
    setDocTitle('');
    setDocCategory('');
    setDocContent('');
    setError('');
    setAutoSaveStatus('idle');
    lastSavedPayloadRef.current = '';
  };

  // Drag and Drop File Handlers
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processSelectedFiles(Array.from(e.dataTransfer.files));
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processSelectedFiles(Array.from(e.target.files));
    }
  };

  const processSelectedFiles = (files: File[]) => {
    const validExtensions = ['.pdf', '.txt', '.md', '.markdown'];
    const newItems: IngestionFileItem[] = [];
    const rejectedNames: string[] = [];

    files.forEach((file) => {
      const ext = '.' + (file.name.split('.').pop()?.toLowerCase() || '');
      if (validExtensions.includes(ext) || file.type.includes('pdf') || file.type.includes('text')) {
        newItems.push({
          id: `file-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          file,
          name: file.name,
          size: file.size,
          type: file.type || ext,
          status: 'pending'
        });
      } else {
        rejectedNames.push(file.name);
      }
    });

    if (rejectedNames.length > 0) {
      setError(`Unsupported file types skipped: ${rejectedNames.join(', ')}. Please upload PDF, TXT, or Markdown documents.`);
    } else {
      setError('');
    }

    if (newItems.length > 0) {
      setQueuedFiles((prev) => [...prev, ...newItems]);
      setShowIngestionModal(true);
    }
  };

  const removeQueuedFile = (id: string) => {
    setQueuedFiles((prev) => prev.filter((f) => f.id !== id));
  };

  // Helper to read file as Data URL (Base64) or Text
  const readFilePayload = (file: File): Promise<{ data: string; isBase64: boolean; mimeType: string }> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      const ext = file.name.split('.').pop()?.toLowerCase();
      const isPdf = ext === 'pdf' || file.type.includes('pdf');

      if (isPdf) {
        reader.onload = () => {
          resolve({
            data: reader.result as string,
            isBase64: true,
            mimeType: 'application/pdf'
          });
        };
        reader.onerror = () => reject(new Error(`Failed to read PDF file ${file.name}`));
        reader.readAsDataURL(file);
      } else {
        reader.onload = () => {
          resolve({
            data: reader.result as string,
            isBase64: false,
            mimeType: file.type || 'text/plain'
          });
        };
        reader.onerror = () => reject(new Error(`Failed to read text file ${file.name}`));
        reader.readAsText(file);
      }
    });
  };

  // Execute AI-Driven Text Extraction across all queued files
  const handleExecuteBulkExtraction = async () => {
    if (queuedFiles.length === 0) return;

    setIsExtracting(true);
    setExtractionProgress(10);
    setExtractionStatusText('Reading and encoding files for AI model...');
    setExtractionErrors([]);

    try {
      const preparedFiles: { name: string; type: string; data: string; isBase64: boolean }[] = [];

      for (let i = 0; i < queuedFiles.length; i++) {
        const item = queuedFiles[i];
        setExtractionStatusText(`Reading ${item.name} (${i + 1}/${queuedFiles.length})...`);
        const { data, isBase64, mimeType } = await readFilePayload(item.file);
        preparedFiles.push({
          name: item.name,
          type: mimeType,
          data,
          isBase64
        });
        setExtractionProgress(10 + Math.round(((i + 1) / queuedFiles.length) * 30));
      }

      setExtractionStatusText('Sending to Gemini 3.7 Flash AI extraction service...');
      setExtractionProgress(50);

      const response = await fetch('/api/extract-documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          files: preparedFiles,
          agentCategoryContext: `${agent.name} (${agent.id === 'hospes-host' ? 'Hosting, cPanel, WHM, DNS, WHMCS' : 'Customer Support'})`
        })
      });

      setExtractionProgress(85);
      setExtractionStatusText('Parsing and validating extracted knowledge base articles...');

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || errData.details || `Server responded with status ${response.status}`);
      }

      const data = await response.json();
      setExtractionProgress(100);

      if (data.extractedArticles && data.extractedArticles.length > 0) {
        setStagedArticles(data.extractedArticles);
        setQueuedFiles([]);
        setExtractionStatusText('');
      } else {
        throw new Error('No articles could be extracted from the uploaded files.');
      }

      if (data.errors && data.errors.length > 0) {
        setExtractionErrors(data.errors.map((e: any) => `${e.fileName}: ${e.message}`));
      }
    } catch (err: any) {
      console.error('Bulk extraction failed:', err);
      setExtractionErrors([err.message || 'Failed to extract articles. Please check your document format.']);
    } finally {
      setIsExtracting(false);
    }
  };

  // Commit all staged articles to the active Knowledge Base
  const handleCommitStagedArticles = async () => {
    if (stagedArticles.length === 0) return;

    const newDocs: DocumentItem[] = stagedArticles.map((art) => ({
      id: art.id || `doc-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      title: art.title.trim() || 'Untitled Extracted Article',
      category: art.category.trim() || 'General',
      content: art.content.trim(),
      sourceFile: art.sourceFile
    }));

    const combined = [...(agent.docs || []), ...newDocs];
    await onUpdateDocs(combined, false);

    setSuccessBanner(`Successfully ingested ${newDocs.length} AI-extracted support articles into ${agent.name}!`);
    setStagedArticles([]);
    setShowIngestionModal(false);
  };

  const removeStagedArticle = (index: number) => {
    setStagedArticles((prev) => prev.filter((_, i) => i !== index));
  };

  const updateStagedArticle = (index: number, field: keyof ExtractedArticle, value: string) => {
    setStagedArticles((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  // Load Built-in Demo Docs for Quick Testing
  const loadSampleDocs = () => {
    const samples: DocumentItem[] = [
      {
        id: `sample-1`,
        title: 'HospesAI One-Click SSL Deployment',
        category: 'Tech Support',
        content: 'We offer free, unlimited Let\'s Encrypt SSL certificates for all domains and subdomains hosted with us. Installation is completely automated. Inside your Hospes customer portal, navigate to Security > SSL/TLS and click "Deploy Free SSL". Installation takes less than 60 seconds. Make sure your DNS nameservers are pointed to ns1.hospesai.com.ng before launching.'
      },
      {
        id: `sample-2`,
        title: 'SMTP Mail Deliverability & SMTP Limits',
        category: 'Server Config',
        content: 'To prevent network spam and uphold server reputation, shared hosting servers are capped at 100 outgoing emails per hour. All outgoing mail on VPS systems must go through verified secure ports: SSL Port 465 or TLS Port 587. Port 25 is blocked by default across all Hospes IP ranges.'
      },
      {
        id: `sample-3`,
        title: 'SSH Terminal Access Policy',
        category: 'Security',
        content: 'SSH terminal access is disabled by default for security. To request SSH access on standard shared plans, open a support ticket confirming your IP address. For Dedicated and Cloud VPS accounts, SSH root login is pre-enabled via Port 2222 with key-based authentication only. Password-based root SSH is strictly disabled.'
      }
    ];
    onUpdateDocs([...(agent.docs || []), ...samples], false);
  };

  // Generate Sample Markdown File for Testing Ingestion
  const injectSampleFileToQueue = () => {
    const sampleContent = `# WHMCS & cPanel Automatic Provisioning Manual

## 1. Domain Registration Workflow
Domain orders placed in WHMCS trigger instant registrar API calls to Flutterwave & Nominet.
- Required Nameservers: ns1.hospesai.com.ng and ns2.hospesai.com.ng
- DNS propagation window: 2 to 24 hours.

## 2. Server Resource Quota Limits
Shared cPanel accounts are assigned the following CloudLinux LVE limits:
- Maximum Physical RAM: 1024MB (1GB)
- CPU Usage: 100% of 1 dedicated vCPU core
- Concurrent Entry Processes (EP): Max 20 concurrent connections
- IOPS Speed: 5MB/s disk write throughput

## 3. CSF Firewall Block Resolution
If a user enters an incorrect cPanel password 5 consecutive times, LFD blocks their public IP address.
To resolve: Log in to WHM > Plugins > ConfigServer Security & Firewall, search the IP, and click "Unblock IP".`;

    const blob = new Blob([sampleContent], { type: 'text/markdown' });
    const file = new File([blob], 'whmcs-server-provisioning-handbook.md', { type: 'text/markdown' });
    processSelectedFiles([file]);
  };

  const getThemeBadge = (color: string) => {
    switch (color) {
      case 'emerald': return 'bg-emerald-100 text-emerald-800';
      case 'violet': return 'bg-violet-100 text-violet-800';
      case 'amber': return 'bg-amber-100 text-amber-800';
      case 'rose': return 'bg-rose-100 text-rose-800';
      default: return 'bg-blue-100 text-blue-800';
    }
  };

  // Filtered Documents
  const categories = Array.from(new Set((agent.docs || []).map((d) => d.category).filter(Boolean)));

  const filteredDocs = (agent.docs || []).filter((doc) => {
    const matchesCategory = selectedCategoryFilter === 'all' || doc.category === selectedCategoryFilter;
    const matchesSearch =
      !searchQuery.trim() ||
      doc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (doc.sourceFile && doc.sourceFile.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="space-y-6" id="knowledge-base-panel">
      {/* Hidden File Input for Click Selection */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept=".pdf,.txt,.md,.markdown,text/plain,text/markdown,application/pdf"
        className="hidden"
        onChange={handleFileInputChange}
      />

      {/* Success Notification Banner */}
      {successBanner && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-center justify-between text-xs font-semibold shadow-xs animate-fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
            <span>{successBanner}</span>
          </div>
          <button
            onClick={() => setSuccessBanner(null)}
            className="text-emerald-500 hover:text-emerald-700 p-1 cursor-pointer"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Main Top Header & Drag/Drop Integration Card */}
      <div
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`relative overflow-hidden rounded-2xl border transition-all duration-200 ${
          isDragOver
            ? 'border-blue-500 bg-blue-50/80 ring-4 ring-blue-500/20 shadow-md'
            : 'border-slate-200/90 bg-linear-to-b from-slate-50 to-white'
        } p-5.5`}
      >
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-xl bg-blue-600 text-white shadow-xs">
                <BookOpen className="h-4 w-4" />
              </span>
              <h2 className="font-display font-bold text-slate-900 text-sm tracking-tight">
                Knowledge Base & Grounding Repository
              </h2>
              <span className="inline-flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-semibold">
                {agent.docs?.length || 0} Articles Active
              </span>
            </div>
            <p className="text-slate-500 text-xs max-w-2xl leading-relaxed">
              Your AI agent grounds its responses strictly in these articles. Drag & drop bulk technical files (<strong className="font-semibold text-slate-700">PDF, TXT, MD</strong>) to automatically extract, structure, and categorize knowledge using Gemini 3.7 Flash.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              id="upload-files-trigger-btn"
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200/80 transition-all cursor-pointer shadow-2xs"
            >
              <UploadCloud className="h-4 w-4 text-blue-600" /> Upload Files (PDF / TXT / MD)
            </button>

            <button
              id="add-custom-doc-btn"
              type="button"
              onClick={handleAddNew}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-xs hover:shadow-md transition-all cursor-pointer"
            >
              <Plus className="h-4 w-4" /> New Article
            </button>
          </div>
        </div>

        {/* Drag & Drop Visual Dropzone Callout */}
        <div
          onClick={() => fileInputRef.current?.click()}
          className={`mt-4 border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-1.5 ${
            isDragOver
              ? 'border-blue-500 bg-blue-100/50 scale-[0.99]'
              : 'border-slate-200 hover:border-blue-400 bg-slate-50/50 hover:bg-blue-50/30'
          }`}
        >
          <div className="flex items-center gap-2 text-slate-700 font-medium text-xs">
            <FileUp className="h-4 w-4 text-blue-600" />
            <span>
              {isDragOver ? 'Release to ingest files now' : 'Drag & drop multiple PDF, TXT, or Markdown documents here'}
            </span>
          </div>
          <span className="text-[10px] text-slate-400 font-sans">
            AI text extraction will automatically parse manuals, extract key procedures, and create categorized entries.
          </span>
        </div>
      </div>

      {/* Bulk Ingestion / AI Extraction Staging Modal or Panel */}
      {showIngestionModal && (
        <div className="bg-white rounded-2xl border border-blue-200 p-5 shadow-lg shadow-blue-500/5 animate-fade-in space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-blue-100 text-blue-700">
                <Sparkles className="h-4 w-4" />
              </span>
              <div>
                <h3 className="text-xs font-bold text-slate-800 font-display">
                  {stagedArticles.length > 0 ? 'Review AI-Extracted Knowledge Articles' : 'Bulk Document Extraction Queue'}
                </h3>
                <p className="text-[11px] text-slate-400">
                  {stagedArticles.length > 0
                    ? `Review and customize ${stagedArticles.length} extracted articles before publishing to grounding base.`
                    : 'Process selected files with Gemini 3.7 Flash AI text extraction service.'}
                </p>
              </div>
            </div>

            <button
              onClick={() => {
                setShowIngestionModal(false);
                setQueuedFiles([]);
                setStagedArticles([]);
                setExtractionErrors([]);
              }}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Errors list if any */}
          {extractionErrors.length > 0 && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs space-y-1">
              <div className="flex items-center gap-1.5 font-bold">
                <AlertCircle className="h-4 w-4 text-rose-600" />
                <span>Document Extraction Issues</span>
              </div>
              <ul className="list-disc list-inside text-[11px] space-y-0.5 pl-1">
                {extractionErrors.map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Queue Stage: Display Queued Files ready for AI extraction */}
          {stagedArticles.length === 0 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                  <span>Queued Documents ({queuedFiles.length})</span>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="text-blue-600 hover:text-blue-700 text-[11px] font-semibold flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="h-3 w-3" /> Add more files
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 max-h-56 overflow-y-auto pr-1">
                  {queuedFiles.map((fileItem) => (
                    <div
                      key={fileItem.id}
                      className="p-3 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="flex items-center gap-2.5 truncate">
                        <span className="p-1.5 rounded-lg bg-white border border-slate-200 text-blue-600 shrink-0">
                          <FileType className="h-3.5 w-3.5" />
                        </span>
                        <div className="truncate">
                          <div className="font-semibold text-slate-800 truncate" title={fileItem.name}>
                            {fileItem.name}
                          </div>
                          <div className="text-[10px] text-slate-400 font-mono">
                            {(fileItem.size / 1024).toFixed(1)} KB • {fileItem.name.split('.').pop()?.toUpperCase()}
                          </div>
                        </div>
                      </div>

                      {!isExtracting && (
                        <button
                          onClick={() => removeQueuedFile(fileItem.id)}
                          className="text-slate-400 hover:text-rose-600 p-1 cursor-pointer"
                          title="Remove file"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Extraction Progress Bar during active processing */}
              {isExtracting && (
                <div className="p-4 rounded-xl bg-blue-50/80 border border-blue-200 space-y-2">
                  <div className="flex items-center justify-between text-xs font-semibold text-blue-900">
                    <span className="flex items-center gap-2">
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-600" />
                      {extractionStatusText || 'Extracting documentation...'}
                    </span>
                    <span className="font-mono">{extractionProgress}%</span>
                  </div>
                  <div className="w-full bg-blue-200 h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-blue-600 h-full transition-all duration-300 rounded-full"
                      style={{ width: `${extractionProgress}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={injectSampleFileToQueue}
                  className="text-xs text-slate-500 hover:text-slate-800 underline flex items-center gap-1 cursor-pointer"
                >
                  <Sparkles className="h-3 w-3 text-amber-500" /> Load sample Markdown guide for demo
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowIngestionModal(false);
                      setQueuedFiles([]);
                    }}
                    disabled={isExtracting}
                    className="px-3.5 py-1.5 rounded-lg text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleExecuteBulkExtraction}
                    disabled={isExtracting || queuedFiles.length === 0}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition-all cursor-pointer disabled:opacity-50"
                  >
                    {isExtracting ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Processing AI Extraction...
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-3.5 w-3.5" /> Parse {queuedFiles.length} File{queuedFiles.length > 1 ? 's' : ''} with AI
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Staged Review Stage: Review AI-Extracted Knowledge Articles */}
          {stagedArticles.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between bg-blue-50/70 p-3 rounded-xl border border-blue-100">
                <div className="flex items-center gap-2 text-xs text-blue-900 font-semibold">
                  <FileCheck2 className="h-4 w-4 text-blue-600 shrink-0" />
                  <span>
                    Gemini AI successfully extracted <strong>{stagedArticles.length}</strong> structured knowledge article{stagedArticles.length > 1 ? 's' : ''}.
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setStagedArticles([])}
                    className="text-xs text-slate-500 hover:text-slate-800 underline cursor-pointer"
                  >
                    Re-extract
                  </button>
                  <button
                    type="button"
                    onClick={handleCommitStagedArticles}
                    className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-all cursor-pointer"
                  >
                    <Check className="h-3.5 w-3.5" /> Ingest All Articles ({stagedArticles.length})
                  </button>
                </div>
              </div>

              {/* Extracted Articles Cards */}
              <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                {stagedArticles.map((art, idx) => (
                  <div
                    key={art.id || idx}
                    className="p-4 rounded-xl border border-slate-200 bg-slate-50/40 space-y-2.5 relative group hover:border-blue-300 transition-all"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 flex-1">
                        <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-blue-100 text-blue-800">
                          Article #{idx + 1}
                        </span>
                        {art.sourceFile && (
                          <span className="text-[10px] text-slate-400 font-mono flex items-center gap-1">
                            <FileType className="h-3 w-3" /> from {art.sourceFile}
                          </span>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => removeStagedArticle(idx)}
                        className="text-slate-400 hover:text-rose-600 p-1 cursor-pointer"
                        title="Discard this article"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
                      <div className="md:col-span-2">
                        <label className="block text-[10px] font-bold text-slate-400 uppercase font-mono mb-1">
                          Article Title
                        </label>
                        <input
                          type="text"
                          value={art.title}
                          onChange={(e) => updateStagedArticle(idx, 'title', e.target.value)}
                          className="w-full text-xs px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase font-mono mb-1">
                          Category
                        </label>
                        <input
                          type="text"
                          value={art.category}
                          onChange={(e) => updateStagedArticle(idx, 'category', e.target.value)}
                          className="w-full text-xs px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase font-mono mb-1">
                        Knowledge Content (Markdown)
                      </label>
                      <textarea
                        rows={3}
                        value={art.content}
                        onChange={(e) => updateStagedArticle(idx, 'content', e.target.value)}
                        className="w-full text-xs p-2.5 bg-white border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 font-sans leading-relaxed"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Manual Document Editor Pane (Adding/Editing single document) */}
      {(isAddingNew || editingDocId) && (
        <div className="bg-white rounded-2xl border border-blue-200 p-5 shadow-xs glow-blue animate-fade-in">
          <div className="flex items-center justify-between gap-2 mb-4 border-b border-slate-100 pb-2.5">
            <div className="flex items-center gap-2">
              <Bookmark className="h-4 w-4 text-blue-600" />
              <h3 className="text-xs font-bold text-slate-800 font-display">
                {isAddingNew ? 'Deploy New Support Document' : 'Revise Reference Article'}
              </h3>
            </div>

            {/* Auto-save status badge */}
            <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono">
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
                <span className="flex items-center gap-1 text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100 font-semibold">
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
              {autoSaveStatus === 'idle' && (
                <span className="flex items-center gap-1 text-slate-400 bg-slate-50 px-2 py-0.5 rounded-full border border-slate-100">
                  <Cloud className="h-3 w-3" />
                  Auto-save active
                </span>
              )}
            </div>
          </div>

          {error && (
            <div className="mb-4 flex items-start gap-2 p-3 rounded-lg bg-rose-50 text-rose-600 border border-rose-100 text-xs">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2">
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-[10px] font-bold text-slate-400 font-mono tracking-wide uppercase">
                    Document Title
                  </label>
                  <span className="text-[9px] text-slate-400 font-mono">Auto-saves continuously</span>
                </div>
                <input
                  type="text"
                  placeholder="e.g. Free Automated SSL Installation Guide"
                  value={docTitle}
                  onChange={(e) => setDocTitle(e.target.value)}
                  className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white text-slate-800"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 font-mono tracking-wide uppercase mb-1">
                  Category / Group
                </label>
                <input
                  type="text"
                  placeholder="e.g. DNS, Tech Support, Billing"
                  value={docCategory}
                  onChange={(e) => setDocCategory(e.target.value)}
                  className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white text-slate-800"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-[10px] font-bold text-slate-400 font-mono tracking-wide uppercase">
                  Document Body Content (Knowledge Text)
                </label>
                <span className="text-[9px] text-slate-400 font-mono">Persisted directly to agent</span>
              </div>
              <textarea
                rows={6}
                placeholder="Paste system configurations, product specifications, business terms of service, gym schedules, or pricing rules that the AI needs to answer from. Keep descriptions precise."
                value={docContent}
                onChange={(e) => setDocContent(e.target.value)}
                className="w-full text-xs p-3 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white text-slate-800 font-sans leading-relaxed"
              />
            </div>

            <div className="flex items-center justify-between gap-2.5 pt-2 border-t border-slate-100">
              <div className="text-[11px] text-slate-400 font-mono">
                {autoSaveStatus === 'saved' ? (
                  <span className="text-emerald-600 flex items-center gap-1">
                    <CheckCircle2 className="h-3.5 w-3.5" /> All edits saved to database
                  </span>
                ) : (
                  <span>Auto-save runs every few seconds while typing.</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={cancelEditState}
                  className="px-3 py-1.5 rounded-lg text-[11px] font-semibold text-slate-500 hover:text-slate-700 bg-slate-100 transition-colors cursor-pointer"
                >
                  Done / Close
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  className="flex items-center gap-1 px-4 py-1.5 rounded-lg text-[11px] font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition-colors cursor-pointer"
                >
                  <Check className="h-3.5 w-3.5" /> Save Now
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filter and Search Bar */}
      {agent.docs && agent.docs.length > 0 && (
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3 rounded-xl border border-slate-200/80 shadow-2xs">
          <div className="relative flex-1">
            <Search className="h-3.5 w-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search knowledge base articles, error codes, procedures..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8.5 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-800 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:ring-1 focus:ring-blue-500"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            <span className="text-[10px] text-slate-400 font-mono uppercase font-bold pl-1 flex items-center gap-1 shrink-0">
              <Filter className="h-3 w-3" /> Category:
            </span>
            <button
              onClick={() => setSelectedCategoryFilter('all')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold shrink-0 cursor-pointer transition-all ${
                selectedCategoryFilter === 'all'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              All ({agent.docs.length})
            </button>
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategoryFilter(cat)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold shrink-0 cursor-pointer transition-all ${
                  selectedCategoryFilter === cat
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Grounding list */}
      {agent.docs?.length === 0 ? (
        <div className="text-center py-16 px-4 border border-dashed border-slate-200 rounded-3xl bg-slate-50/40">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl w-fit mx-auto mb-3">
            <UploadCloud className="h-8 w-8 animate-pulse" />
          </div>
          <h3 className="font-display font-bold text-slate-800 text-sm">Grounding Repository is Empty</h3>
          <p className="text-slate-400 text-xs max-w-md mx-auto mt-1 leading-relaxed">
            Upload your technical documentation files (<strong className="text-slate-600">PDF, Markdown, TXT</strong>) or add custom articles to ground your AI assistant in real facts.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-2.5">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-xs hover:shadow-md transition-all cursor-pointer"
            >
              <UploadCloud className="h-4 w-4" /> Ingest PDF / TXT / MD
            </button>
            <button
              onClick={loadSampleDocs}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 transition-all cursor-pointer"
            >
              <Sparkles className="h-3.5 w-3.5" /> Pre-load Tech Docs
            </button>
            <button
              onClick={handleAddNew}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-all cursor-pointer"
            >
              Add Single Article
            </button>
          </div>
        </div>
      ) : filteredDocs.length === 0 ? (
        <div className="text-center py-12 px-4 border border-slate-200 rounded-2xl bg-white">
          <Search className="h-8 w-8 text-slate-300 mx-auto mb-2" />
          <h4 className="font-display font-bold text-slate-700 text-xs">No articles match your search</h4>
          <p className="text-slate-400 text-[11px] mt-1">Try clearing your search query or switching categories.</p>
          <button
            onClick={() => {
              setSearchQuery('');
              setSelectedCategoryFilter('all');
            }}
            className="mt-3 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer"
          >
            Reset Filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3.5">
          {filteredDocs.map((doc) => (
            <div
              key={doc.id}
              className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs hover:border-blue-300 hover:shadow-xs transition-all flex flex-col justify-between group"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono tracking-wider ${getThemeBadge(agent.themeColor)}`}>
                      {doc.category || 'General'}
                    </span>
                    <span className="text-[10px] font-mono text-slate-400">ID: {doc.id}</span>
                    {doc.sourceFile && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-mono text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-100/80">
                        <FileType className="h-3 w-3" /> Ingested from {doc.sourceFile}
                      </span>
                    )}
                  </div>
                  <h4 className="font-display font-bold text-slate-900 text-sm">
                    {doc.title}
                  </h4>
                </div>

                <div className="flex items-center gap-1.5 shrink-0 opacity-80 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => handleEdit(doc)}
                    className="p-1.5 rounded-lg bg-slate-50 text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition-colors cursor-pointer border border-slate-200/60"
                    title="Edit article"
                  >
                    <Edit className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => handleDelete(doc.id)}
                    className="p-1.5 rounded-lg bg-rose-50 text-rose-500 hover:bg-rose-100 hover:text-rose-600 transition-colors cursor-pointer border border-rose-200/60"
                    title="Delete article"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              <div className="mt-3 text-xs text-slate-600 font-sans leading-relaxed whitespace-pre-wrap bg-slate-50/70 p-3.5 rounded-xl border border-slate-200/60 max-h-48 overflow-y-auto">
                {doc.content}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
