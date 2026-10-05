import React, { useState, useEffect } from 'react';
import type { Course } from '@/types/course';
import type { DocumentItem } from '@/types/document';
import { fetchCourseStudyNotes, fetchDocumentNotes } from '@/services/api';
import {
  FileText,
  Sparkles,
  Copy,
  Check,
  Printer,
  X,
  MessageSquare,
  BookOpen,
  Loader2,
  CheckCircle2,
} from 'lucide-react';

interface AIStudyNotesModalProps {
  course: Course;
  documents: DocumentItem[];
  initialDocId?: string | null;
  onClose: () => void;
  onAskTutor?: (question: string) => void;
}

export const AIStudyNotesModal: React.FC<AIStudyNotesModalProps> = ({
  course,
  documents,
  initialDocId = null,
  onClose,
  onAskTutor,
}) => {
  const [selectedTab, setSelectedTab] = useState<string>(initialDocId || 'master');
  const [masterNotes, setMasterNotes] = useState<string>(course.study_notes || '');
  const [docNotesMap, setDocNotesMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);

  useEffect(() => {
    let isMounted = true;
    const loadAllNotes = async () => {
      setLoading(true);
      try {
        const courseData = await fetchCourseStudyNotes(course.id);
        if (isMounted) {
          setMasterNotes(courseData.study_notes || '');
          const map: Record<string, string> = {};
          for (const d of courseData.document_notes || []) {
            if (d.ai_notes) {
              map[d.document_id] = d.ai_notes;
            }
          }
          // Also prefill from documents prop
          for (const doc of documents) {
            if (doc.ai_notes && !map[doc.id]) {
              map[doc.id] = doc.ai_notes;
            }
          }
          setDocNotesMap(map);
        }
      } catch (err) {
        console.warn('Failed to fetch course study notes:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadAllNotes();
    return () => {
      isMounted = false;
    };
  }, [course.id, documents]);

  // Load specific doc notes if missing
  const handleSelectTab = async (tabKey: string) => {
    setSelectedTab(tabKey);
    if (tabKey !== 'master' && !docNotesMap[tabKey]) {
      setLoading(true);
      try {
        const res = await fetchDocumentNotes(course.id, tabKey);
        setDocNotesMap((prev) => ({ ...prev, [tabKey]: res.ai_notes }));
      } catch (err) {
        console.error('Failed fetching document notes:', err);
      } finally {
        setLoading(false);
      }
    }
  };

  const currentNotes =
    selectedTab === 'master'
      ? masterNotes || course.study_notes || 'Generating Master Study Guide for your uploaded materials...'
      : docNotesMap[selectedTab] ||
        documents.find((d) => d.id === selectedTab)?.ai_notes ||
        'Generating AI study notes for this document...';

  const handleCopy = () => {
    navigator.clipboard.writeText(currentNotes);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleAskTutor = () => {
    const activeDoc = documents.find((d) => d.id === selectedTab);
    const question = activeDoc
      ? `Can you explain the main ideas from my study notes in '${activeDoc.filename}' in simple words?`
      : `Can you explain the main concepts from our master study notes in simple words?`;
    onClose();
    if (onAskTutor) {
      onAskTutor(question);
    }
  };

  // Helper to render markdown text with enhanced visual styling
  const renderMarkdown = (text: string) => {
    const lines = text.split('\n');
    return lines.map((line, idx) => {
      const trimmed = line.trim();

      // H1 Header
      if (trimmed.startsWith('# ')) {
        return (
          <h1 key={idx} className="text-xl md:text-2xl font-black text-white mt-4 mb-2 pb-2 border-b border-slate-800 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-teal-400 shrink-0" />
            <span>{trimmed.replace('# ', '')}</span>
          </h1>
        );
      }

      // H2 or H3 Header
      if (trimmed.startsWith('## ') || trimmed.startsWith('### ')) {
        const title = trimmed.replace(/^###?\s+/, '');
        return (
          <h3 key={idx} className="text-base md:text-lg font-bold text-teal-300 mt-6 mb-2 flex items-center gap-2">
            <span>{title}</span>
          </h3>
        );
      }

      // H4 Header
      if (trimmed.startsWith('#### ')) {
        return (
          <h4 key={idx} className="text-sm font-bold text-indigo-300 mt-4 mb-1">
            {trimmed.replace('#### ', '')}
          </h4>
        );
      }

      // Blockquotes
      if (trimmed.startsWith('> ')) {
        return (
          <blockquote key={idx} className="my-2.5 pl-4 py-2 border-l-4 border-teal-500/60 bg-teal-500/10 rounded-r-xl text-xs md:text-sm text-slate-200 italic">
            {trimmed.replace('> ', '')}
          </blockquote>
        );
      }

      // Unordered list item
      if (trimmed.startsWith('- ') || trimmed.startsWith('* ') || trimmed.startsWith('&bull; ')) {
        const content = trimmed.replace(/^[-*&bull;]\s+/, '');
        return (
          <div key={idx} className="flex items-start gap-2 my-1 text-xs md:text-sm text-slate-300 pl-2">
            <span className="text-teal-400 mt-1 font-bold text-base leading-none">&bull;</span>
            <span className="flex-1 leading-relaxed">
              {formatInlineStyles(content)}
            </span>
          </div>
        );
      }

      // Numbered list item
      if (/^\d+\.\s+/.test(trimmed)) {
        const num = trimmed.match(/^\d+/)?.[0];
        const content = trimmed.replace(/^\d+\.\s+/, '');
        return (
          <div key={idx} className="flex items-start gap-2 my-1.5 text-xs md:text-sm text-slate-300 pl-2">
            <span className="px-1.5 py-0.5 rounded bg-slate-800 text-teal-400 font-bold text-[11px] shrink-0 mt-0.5">
              {num}
            </span>
            <span className="flex-1 leading-relaxed">
              {formatInlineStyles(content)}
            </span>
          </div>
        );
      }

      // Empty line
      if (!trimmed) {
        return <div key={idx} className="h-2" />;
      }

      // Standard paragraph
      return (
        <p key={idx} className="text-xs md:text-sm text-slate-300 leading-relaxed my-1">
          {formatInlineStyles(trimmed)}
        </p>
      );
    });
  };

  // Helper for bold and code tags
  const formatInlineStyles = (str: string) => {
    // Split on **bold** patterns
    const parts = str.split(/(\*\*.*?\*\*|`.*?`)/g);
    return parts.map((part, pIdx) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={pIdx} className="font-bold text-white">{part.slice(2, -2)}</strong>;
      }
      if (part.startsWith('`') && part.endsWith('`')) {
        return (
          <code key={pIdx} className="px-1.5 py-0.5 rounded bg-slate-800 text-teal-300 font-mono text-[11px] border border-slate-700">
            {part.slice(1, -1)}
          </code>
        );
      }
      return part;
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-4xl max-h-[92vh] flex flex-col rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="p-5 sm:p-6 border-b border-slate-800/80 flex items-center justify-between gap-3 bg-gradient-to-r from-slate-900 via-slate-900/90 to-teal-950/20">
          <div className="flex items-center space-x-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-teal-500/10 border border-teal-500/20 text-teal-400 flex items-center justify-center shrink-0">
              <FileText className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center space-x-2">
                <h2 className="text-base sm:text-lg font-bold text-white truncate">
                  AI Study Notes & Summary
                </h2>
                <span className="px-2 py-0.5 rounded-full bg-teal-500/10 text-teal-400 text-[10px] font-semibold border border-teal-500/20 shrink-0">
                  Grounded in Notes
                </span>
              </div>
              <p className="text-xs text-slate-400 truncate">
                {course.name} &bull; {course.subject}
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center space-x-2 shrink-0">
            <button
              onClick={handleCopy}
              className="p-2 rounded-xl border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
              title="Copy Study Notes"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            </button>
            <button
              onClick={handlePrint}
              className="p-2 rounded-xl border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
              title="Print / Save PDF"
            >
              <Printer className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Document Selection Tabs */}
        <div className="px-5 pt-3 border-b border-slate-800 flex items-center gap-2 overflow-x-auto bg-slate-950/40">
          <button
            onClick={() => handleSelectTab('master')}
            className={`pb-3 px-3 text-xs font-bold transition-all relative whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
              selectedTab === 'master' ? 'text-teal-400' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Master Study Guide</span>
            {selectedTab === 'master' && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-teal-400 rounded-full" />
            )}
          </button>

          {documents.map((doc) => (
            <button
              key={doc.id}
              onClick={() => handleSelectTab(doc.id)}
              className={`pb-3 px-3 text-xs font-semibold transition-all relative whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                selectedTab === doc.id ? 'text-teal-400 font-bold' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <FileText className="w-3.5 h-3.5 text-slate-400" />
              <span className="max-w-[140px] truncate">{doc.filename}</span>
              {selectedTab === doc.id && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-teal-400 rounded-full" />
              )}
            </button>
          ))}
        </div>

        {/* Study Notes Content Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-7 space-y-4">
          {loading ? (
            <div className="py-20 text-center space-y-3">
              <Loader2 className="w-8 h-8 mx-auto text-teal-400 animate-spin" />
              <p className="text-sm font-semibold text-white">Analyzing uploaded material...</p>
              <p className="text-xs text-slate-400">Synthesizing concepts, exam takeaways, and self-checks in simple words.</p>
            </div>
          ) : (
            <div className="max-w-none space-y-2">
              {renderMarkdown(currentNotes)}
            </div>
          )}
        </div>

        {/* Footer Navigation & Call to Action */}
        <div className="p-4 sm:p-5 border-t border-slate-800 bg-slate-950/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center space-x-2 text-xs text-slate-400">
            <CheckCircle2 className="w-4 h-4 text-teal-400 shrink-0" />
            <span>All concepts and takeaways are extracted directly from your uploaded material.</span>
          </div>

          <div className="flex items-center space-x-2 shrink-0">
            <button
              onClick={handleAskTutor}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-teal-400 to-indigo-500 hover:from-teal-300 hover:to-indigo-400 text-slate-950 font-bold text-xs flex items-center space-x-1.5 transition-all shadow-md cursor-pointer"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>Ask AI Tutor About These Notes &rarr;</span>
            </button>
            <button
              onClick={onClose}
              className="px-3.5 py-2 rounded-xl border border-slate-800 bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-semibold transition-colors cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
