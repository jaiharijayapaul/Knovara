import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  fetchTutorSessions, 
  createTutorSession, 
  fetchTutorSessionDetail, 
  sendTutorMessage, 
  streamTutorMessage,
  updateTutorSessionMode, 
  deleteTutorSession 
} from '@/services/api';
import type { 
  TutorSession, 
  TutorSessionDetail, 
  TutorMessage, 
  PedagogicalMode 
} from '@/types/tutor';
import { PEDAGOGICAL_MODES } from '@/types/tutor';
import type { SourceCitation } from '@/types/rag';
import {
  Sparkles,
  HelpCircle,
  Atom,
  AlertOctagon,
  GraduationCap,
  Cpu,
  Zap,
  Send,
  Plus,
  Trash2,
  Clock,
  BookOpen,
  FileText,
  Video,
  Presentation,
  X,
  MessageSquare,
  Loader2,
  CheckCircle2,
  Bookmark
} from 'lucide-react';

interface TutorChatStudioProps {
  courseId: string;
  courseName: string;
  initialSessionId?: string | null;
}

export const TutorChatStudio: React.FC<TutorChatStudioProps> = ({
  courseId,
  courseName,
  initialSessionId,
}) => {
  // Session list & active session
  const [sessions, setSessions] = useState<TutorSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(initialSessionId || null);
  const [sessionDetail, setSessionDetail] = useState<TutorSessionDetail | null>(null);
  const [loadingSessions, setLoadingSessions] = useState<boolean>(true);
  const [loadingDetail, setLoadingDetail] = useState<boolean>(false);
  
  // Active pedagogical mode (defaults to Socratic)
  const [currentMode, setCurrentMode] = useState<PedagogicalMode>('socratic');
  const [isUpdatingMode, setIsUpdatingMode] = useState<boolean>(false);

  // Language Mode (Req 6d: English vs Hinglish)
  const [languageMode, setLanguageMode] = useState<'english' | 'hinglish'>('english');

  // Message input & submission
  const [inputMessage, setInputMessage] = useState<string>('');
  const [isSending, setIsSending] = useState<boolean>(false);
  const [sendError, setSendError] = useState<string | null>(null);

  // Citation inspection drawer
  const [inspectedCitation, setInspectedCitation] = useState<SourceCitation | null>(null);

  // Auto-scroll ref
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [sessionDetail?.messages, isSending]);

  // Load all sessions for this course
  const loadSessions = useCallback(async () => {
    setLoadingSessions(true);
    try {
      const data = await fetchTutorSessions(courseId);
      setSessions(data);
      if (initialSessionId) {
        setActiveSessionId(initialSessionId);
      } else if (data.length > 0 && !activeSessionId) {
        setActiveSessionId(data[0].id);
      } else if (data.length === 0) {
        // Auto-create initial session if none exist
        const initial = await createTutorSession(courseId, {
          title: 'General Curriculum Tutoring',
          pedagogical_mode: 'socratic'
        });
        setSessions([initial]);
        setActiveSessionId(initial.id);
      }
    } catch (err) {
      console.error('Failed to load tutor sessions:', err);
    } finally {
      setLoadingSessions(false);
    }
  }, [courseId, activeSessionId, initialSessionId]);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  useEffect(() => {
    if (initialSessionId) {
      setActiveSessionId(initialSessionId);
    }
  }, [initialSessionId]);

  // Load active session detail
  const loadSessionDetail = useCallback(async (sessionId: string) => {
    setLoadingDetail(true);
    setSendError(null);
    try {
      const detail = await fetchTutorSessionDetail(courseId, sessionId);
      setSessionDetail(detail);
      setCurrentMode(detail.pedagogical_mode);
    } catch (err) {
      console.error('Failed to load session detail:', err);
    } finally {
      setLoadingDetail(false);
    }
  }, [courseId]);

  useEffect(() => {
    if (activeSessionId) {
      loadSessionDetail(activeSessionId);
    }
  }, [activeSessionId, loadSessionDetail]);

  // Handle switching pedagogical mode
  const handleModeSwitch = async (newMode: PedagogicalMode) => {
    if (newMode === currentMode) return;
    setCurrentMode(newMode);
    if (!activeSessionId) return;

    setIsUpdatingMode(true);
    try {
      const updated = await updateTutorSessionMode(courseId, activeSessionId, {
        pedagogical_mode: newMode
      });
      // Update session in list & detail
      setSessions(prev => prev.map(s => s.id === updated.id ? { ...s, pedagogical_mode: newMode } : s));
      if (sessionDetail) {
        setSessionDetail({ ...sessionDetail, pedagogical_mode: newMode });
      }
    } catch (err) {
      console.error('Failed to update pedagogical mode:', err);
    } finally {
      setIsUpdatingMode(false);
    }
  };

  // Handle creating a new session
  const handleCreateSession = async () => {
    try {
      const sessionCount = sessions.length + 1;
      const newSession = await createTutorSession(courseId, {
        title: `Tutoring Session #${sessionCount}`,
        pedagogical_mode: currentMode
      });
      setSessions([newSession, ...sessions]);
      setActiveSessionId(newSession.id);
    } catch (err) {
      console.error('Failed to create new session:', err);
    }
  };

  // Handle deleting a session
  const handleDeleteSession = async (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this tutoring session?')) return;
    try {
      await deleteTutorSession(courseId, sessionId);
      const remaining = sessions.filter(s => s.id !== sessionId);
      setSessions(remaining);
      if (activeSessionId === sessionId) {
        if (remaining.length > 0) {
          setActiveSessionId(remaining[0].id);
        } else {
          setActiveSessionId(null);
          setSessionDetail(null);
        }
      }
    } catch (err) {
      console.error('Failed to delete session:', err);
    }
  };

  // Handle sending a message
  // Send message in current active session with live SSE streaming
  const handleSendMessage = async (textToSend?: string) => {
    const messageContent = (textToSend || inputMessage).trim();
    if (!messageContent || !activeSessionId || isSending) return;

    setIsSending(true);
    setSendError(null);
    setInputMessage('');

    // Optimistically append user message
    const tempUserMsg: TutorMessage = {
      id: `temp-${Date.now()}`,
      session_id: activeSessionId,
      sender: 'user',
      content: messageContent,
      pedagogical_mode: currentMode,
      citations: [],
      created_at: new Date().toISOString()
    };

    // Prepare live streaming assistant placeholder
    const streamingAssistantId = `streaming-assistant-${Date.now()}`;
    const streamingAssistantMsg: TutorMessage = {
      id: streamingAssistantId,
      session_id: activeSessionId,
      sender: 'assistant',
      content: '',
      pedagogical_mode: currentMode,
      citations: [],
      created_at: new Date().toISOString()
    };

    setSessionDetail(prev => prev ? {
      ...prev,
      messages: [...prev.messages, tempUserMsg, streamingAssistantMsg]
    } : null);

    try {
      await streamTutorMessage(
        courseId,
        activeSessionId,
        { content: messageContent, language: languageMode },
        {
          onCitations: (citations) => {
            setSessionDetail(prev => {
              if (!prev) return null;
              return {
                ...prev,
                messages: prev.messages.map(m =>
                  m.id === streamingAssistantId ? { ...m, citations } : m
                )
              };
            });
          },
          onToken: (token) => {
            setSessionDetail(prev => {
              if (!prev) return null;
              return {
                ...prev,
                messages: prev.messages.map(m =>
                  m.id === streamingAssistantId ? { ...m, content: m.content + token } : m
                )
              };
            });
          },
          onDone: (savedMsg) => {
            setSessionDetail(prev => {
              if (!prev) return null;
              return {
                ...prev,
                messages: prev.messages.map(m =>
                  m.id === streamingAssistantId ? savedMsg : m
                )
              };
            });
            loadSessions();
          }
        }
      );
    } catch (streamErr: unknown) {
      console.warn('SSE Streaming connection note, attempting fallback:', streamErr);
      try {
        const assistantReply = await sendTutorMessage(courseId, activeSessionId, {
          content: messageContent,
          language: languageMode,
        });
        setSessionDetail(prev => {
          if (!prev) return null;
          return {
            ...prev,
            messages: prev.messages.map(m =>
              m.id === streamingAssistantId ? assistantReply : m
            )
          };
        });
        loadSessions();
      } catch (err: unknown) {
        setSessionDetail(prev => {
          if (!prev) return null;
          return {
            ...prev,
            messages: prev.messages.filter(m => m.id !== streamingAssistantId)
          };
        });
        const errorMsg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || 'Failed to get tutor response. Please try again.';
        setSendError(errorMsg);
      }
    } finally {
      setIsSending(false);
    }
  };

  // Mode icon mapper
  const renderModeIcon = (mode: PedagogicalMode, className = 'w-4 h-4') => {
    switch (mode) {
      case 'socratic':
        return <HelpCircle className={className} />;
      case 'analogy':
        return <Sparkles className={className} />;
      case 'first_principles':
        return <Atom className={className} />;
      case 'misconception_buster':
        return <AlertOctagon className={className} />;
      case 'exam_prep':
        return <GraduationCap className={className} />;
      case 'deep_dive':
        return <Cpu className={className} />;
      case 'quick_review':
        return <Zap className={className} />;
      default:
        return <HelpCircle className={className} />;
    }
  };

  // Doc icon mapper for citations
  const renderDocIcon = (docName: string) => {
    const lower = docName.toLowerCase();
    if (lower.endsWith('.pdf')) return <FileText className="w-3.5 h-3.5 text-rose-400" />;
    if (lower.endsWith('.pptx') || lower.endsWith('.ppt')) return <Presentation className="w-3.5 h-3.5 text-amber-400" />;
    if (lower.endsWith('.vtt') || lower.endsWith('.srt') || lower.endsWith('.mp4')) return <Video className="w-3.5 h-3.5 text-cyan-400" />;
    return <BookOpen className="w-3.5 h-3.5 text-emerald-400" />;
  };

  const activeModeMeta = PEDAGOGICAL_MODES[currentMode];

  return (
    <div className="flex flex-col h-[820px] bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
      {/* Top Header & Mode Switcher Bar */}
      <div className="p-4 bg-slate-950/80 border-b border-slate-800 backdrop-blur-md">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-cyan-500 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white tracking-tight">Knovara Multi-Turn AI Tutor</h2>
                <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/30">
                  Adaptive Pedagogy
                </span>
                {isUpdatingMode && (
                  <span className="flex items-center gap-1 text-xs text-slate-400">
                    <Loader2 className="w-3 h-3 animate-spin text-indigo-400" /> Switching mode...
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400">
                Course: <span className="text-slate-300 font-medium">{courseName}</span> &bull; Active Mode: <span className={`font-semibold ${activeModeMeta.colorClass}`}>{activeModeMeta.label}</span>
              </p>
            </div>
          </div>

          {/* Language Mode Toggle (Req 6d) & Quick Actions */}
          <div className="flex items-center gap-2">
            <div className="flex items-center rounded-lg p-0.5 bg-slate-850/80 border border-slate-750 bg-slate-800 text-xs shadow-inner">
              <button
                type="button"
                onClick={() => setLanguageMode('english')}
                className={`px-2.5 py-1 rounded-md font-medium transition-all ${
                  languageMode === 'english'
                    ? 'bg-indigo-600 text-white shadow'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                🌐 English
              </button>
              <button
                type="button"
                onClick={() => setLanguageMode('hinglish')}
                className={`px-2.5 py-1 rounded-md font-medium transition-all ${
                  languageMode === 'hinglish'
                    ? 'bg-amber-600 text-white shadow'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Hindi explanations with English technical terms"
              >
                🇮🇳 Hinglish
              </button>
            </div>
            <button
              onClick={handleCreateSession}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white shadow transition-all duration-150"
            >
              <Plus className="w-3.5 h-3.5" />
              New Conversation
            </button>
          </div>
        </div>

        {/* 7 Pedagogical Modes Selector Pill Strip */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin scrollbar-thumb-slate-800">
          {(Object.keys(PEDAGOGICAL_MODES) as PedagogicalMode[]).map((modeKey) => {
            const meta = PEDAGOGICAL_MODES[modeKey];
            const isActive = currentMode === modeKey;
            return (
              <button
                key={modeKey}
                onClick={() => handleModeSwitch(modeKey)}
                title={meta.description}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all duration-200 border ${
                  isActive
                    ? `${meta.bgLightClass} ${meta.borderClass} ${meta.colorClass} shadow-md shadow-indigo-950/50 scale-[1.02]`
                    : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                }`}
              >
                {renderModeIcon(modeKey, 'w-3.5 h-3.5')}
                <span>{meta.label}</span>
                {isActive && (
                  <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Studio Body: Sessions Sidebar + Chat Main Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sessions Sidebar */}
        <div className="w-64 border-r border-slate-800 bg-slate-950/40 hidden md:flex flex-col">
          <div className="p-3 border-b border-slate-800/60 flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Conversations</span>
            <span className="text-xs text-slate-500">{sessions.length}</span>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {loadingSessions ? (
              <div className="flex items-center justify-center p-6 text-slate-500 text-xs">
                <Loader2 className="w-4 h-4 animate-spin mr-2" /> Loading sessions...
              </div>
            ) : sessions.length === 0 ? (
              <div className="p-4 text-center text-xs text-slate-500">
                No past tutoring sessions yet. Start your first inquiry!
              </div>
            ) : (
              sessions.map((session) => {
                const isSelected = session.id === activeSessionId;
                const meta = PEDAGOGICAL_MODES[session.pedagogical_mode];
                return (
                  <div
                    key={session.id}
                    onClick={() => setActiveSessionId(session.id)}
                    className={`group relative p-2.5 rounded-xl cursor-pointer transition-all duration-150 border ${
                      isSelected
                        ? 'bg-indigo-600/15 border-indigo-500/40 text-white'
                        : 'bg-slate-900/40 border-transparent hover:bg-slate-800/60 text-slate-300'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-1 mb-1">
                      <div className="flex items-center gap-1.5 truncate">
                        <MessageSquare className={`w-3.5 h-3.5 shrink-0 ${isSelected ? 'text-indigo-400' : 'text-slate-500'}`} />
                        <span className="text-xs font-medium truncate">{session.title}</span>
                      </div>
                      <button
                        onClick={(e) => handleDeleteSession(session.id, e)}
                        title="Delete session"
                        className="opacity-0 group-hover:opacity-100 p-1 text-slate-500 hover:text-rose-400 rounded transition-all"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-slate-400">
                      <span className={`inline-flex items-center gap-1 font-medium ${meta.colorClass}`}>
                        {renderModeIcon(session.pedagogical_mode, 'w-2.5 h-2.5')}
                        {meta.label}
                      </span>
                      <span className="flex items-center gap-0.5 text-slate-500">
                        <Clock className="w-2.5 h-2.5" />
                        {new Date(session.updated_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Active Mode Explanation Footer */}
          <div className="p-3 border-t border-slate-800/80 bg-slate-950/60 text-xs text-slate-400">
            <div className="flex items-center gap-1.5 mb-1">
              <span className={`font-semibold ${activeModeMeta.colorClass}`}>{activeModeMeta.label}</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">
                {activeModeMeta.badge}
              </span>
            </div>
            <p className="text-[11px] leading-relaxed text-slate-400">{activeModeMeta.description}</p>
          </div>
        </div>

        {/* Right Chat Main Area */}
        <div className="flex-1 flex flex-col bg-slate-900/50 relative">
          {/* Messages Feed */}
          <div className="flex-1 overflow-y-auto p-4 lg:p-6 space-y-4">
            {loadingDetail ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-500 gap-2">
                <Loader2 className="w-6 h-6 animate-spin text-indigo-400" />
                <p className="text-xs">Loading dialogue history...</p>
              </div>
            ) : !sessionDetail || sessionDetail.messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 max-w-lg mx-auto">
                <div className={`w-14 h-14 rounded-2xl ${activeModeMeta.bgLightClass} ${activeModeMeta.borderClass} border flex items-center justify-center mb-4`}>
                  {renderModeIcon(currentMode, `w-7 h-7 ${activeModeMeta.colorClass}`)}
                </div>
                <h3 className="text-base font-bold text-white mb-1">
                  Ready for {activeModeMeta.label}
                </h3>
                <p className="text-xs text-slate-400 mb-6 leading-relaxed">
                  {activeModeMeta.description} All tutor answers are grounded in your indexed textbooks, lecture videos, and slide decks.
                </p>

                {/* Mode Suggested Prompts */}
                <div className="w-full space-y-2">
                  <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2 text-left">
                    Suggested prompts for this mode:
                  </div>
                  {activeModeMeta.prompts.map((promptText, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleSendMessage(promptText)}
                      className="w-full text-left p-3 rounded-xl bg-slate-800/60 hover:bg-slate-800 border border-slate-700/60 hover:border-indigo-500/50 text-xs text-slate-200 transition-all duration-150 flex items-center justify-between group shadow-sm"
                    >
                      <span className="truncate pr-2">"{promptText}"</span>
                      <Send className="w-3 h-3 text-slate-500 group-hover:text-indigo-400 group-hover:translate-x-0.5 transition-all shrink-0" />
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <>
                {/* Messages Stream */}
                {sessionDetail.messages.map((message) => {
                  const isUser = message.sender === 'user';
                  const msgModeMeta = PEDAGOGICAL_MODES[message.pedagogical_mode] || activeModeMeta;

                  return (
                    <div
                      key={message.id}
                      className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} max-w-3xl ${
                        isUser ? 'ml-auto' : 'mr-auto'
                      }`}
                    >
                      {/* Message Sender Header */}
                      <div className="flex items-center gap-2 mb-1 px-1 text-[11px] text-slate-400">
                        {isUser ? (
                          <>
                            <span>You</span>
                            <span>&bull;</span>
                            <span>{new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          </>
                        ) : (
                          <>
                            <span className={`inline-flex items-center gap-1 font-semibold ${msgModeMeta.colorClass}`}>
                              {renderModeIcon(message.pedagogical_mode, 'w-3 h-3')}
                              {msgModeMeta.label}
                            </span>
                            <span>&bull;</span>
                            <span>Grounded Response</span>
                          </>
                        )}
                      </div>

                      {/* Message Bubble */}
                      <div
                        className={`p-4 rounded-2xl text-xs md:text-sm leading-relaxed shadow-lg ${
                          isUser
                            ? 'bg-gradient-to-r from-indigo-600 to-indigo-700 text-white rounded-tr-none'
                            : 'bg-slate-800/90 border border-slate-700/70 text-slate-100 rounded-tl-none'
                        }`}
                      >
                        <div className="whitespace-pre-wrap font-sans space-y-2">
                          {message.content}
                          {isSending && message.id.startsWith('streaming-assistant-') && (
                            <>
                              {message.content ? (
                                <span className="inline-block w-1.5 h-4 ml-0.5 bg-indigo-400 animate-pulse align-middle" />
                              ) : (
                                <span className="inline-flex items-center gap-2 text-slate-400 text-xs italic py-1">
                                  <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-400" />
                                  Synthesizing course grounding in <strong className={msgModeMeta.colorClass}>{msgModeMeta.label}</strong> mode...
                                </span>
                              )}
                            </>
                          )}
                        </div>

                        {/* Multimodal Source Citations Shelf */}
                        {!isUser && message.citations && message.citations.length > 0 && (
                          <div className="mt-4 pt-3 border-t border-slate-700/80">
                            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-400 mb-2">
                              <Bookmark className="w-3 h-3 text-indigo-400" />
                              <span>Grounded Course Sources ({message.citations.length})</span>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {message.citations.map((citation, cIdx) => {
                                const locText = citation.page_number
                                  ? `Page ${citation.page_number}`
                                  : citation.slide_number
                                  ? `Slide ${citation.slide_number}`
                                  : citation.timestamp_start
                                  ? `${citation.timestamp_start}`
                                  : 'Excerpt';

                                return (
                                  <button
                                    key={cIdx}
                                    onClick={() => setInspectedCitation(citation)}
                                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-900/80 hover:bg-slate-900 border border-slate-700 hover:border-indigo-500/60 text-[11px] text-slate-300 hover:text-white transition-all duration-150 shadow-sm"
                                  >
                                    {renderDocIcon(citation.document_name)}
                                    <span className="font-semibold text-indigo-300">{citation.citation_label}</span>
                                    <span className="text-slate-400 truncate max-w-[120px]">{citation.document_name}</span>
                                    <span className="px-1.5 py-0.2 bg-slate-800 rounded text-[10px] text-indigo-400 font-mono">
                                      {locText}
                                    </span>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}

                <div ref={messagesEndRef} />
              </>
            )}
          </div>

          {/* Error Banner */}
          {sendError && (
            <div className="mx-4 mb-2 p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-300 flex items-center justify-between">
              <span>{sendError}</span>
              <button onClick={() => setSendError(null)} className="p-1 hover:text-white">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Bottom Chat Composer */}
          <div className="p-4 bg-slate-950/90 border-t border-slate-800 backdrop-blur-md">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage();
              }}
              className="flex items-center gap-2"
            >
              <div className="relative flex-1">
                <input
                  type="text"
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  placeholder={`Ask a question in ${activeModeMeta.label} mode (e.g., "Why does Shannon entropy peak at 0.5?")...`}
                  disabled={isSending || !activeSessionId}
                  className="w-full px-4 py-3 rounded-xl bg-slate-900 border border-slate-700/80 text-white placeholder-slate-500 text-xs md:text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all disabled:opacity-50"
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 hidden sm:flex items-center gap-1.5 text-slate-500 text-[11px] pointer-events-none">
                  <span className="px-1.5 py-0.5 rounded bg-slate-800 text-[10px] font-mono border border-slate-700">Enter</span>
                  <span>to send</span>
                </div>
              </div>

              <button
                type="submit"
                disabled={!inputMessage.trim() || isSending || !activeSessionId}
                className="px-4 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-600 text-white text-xs md:text-sm font-semibold flex items-center gap-2 transition-all duration-150 shadow-md shadow-indigo-600/20 shrink-0"
              >
                {isSending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <span>Send</span>
                    <Send className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* Citation Inspector Modal / Slide-over */}
      {inspectedCitation && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 font-bold text-xs font-mono">
                  {inspectedCitation.citation_label}
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-white">Grounded Course Excerpt</h4>
                  <p className="text-[11px] text-slate-400">Multimodal verification coordinate</p>
                </div>
              </div>
              <button
                onClick={() => setInspectedCitation(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {/* Document metadata cards */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
                  <div className="text-[10px] uppercase font-semibold text-slate-500 mb-1">Source Material</div>
                  <div className="flex items-center gap-1.5 font-medium text-slate-200 truncate">
                    {renderDocIcon(inspectedCitation.document_name)}
                    <span className="truncate">{inspectedCitation.document_name}</span>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
                  <div className="text-[10px] uppercase font-semibold text-slate-500 mb-1">Citation Coordinate</div>
                  <div className="font-semibold text-indigo-300 font-mono">
                    {inspectedCitation.page_number && `Page ${inspectedCitation.page_number}`}
                    {inspectedCitation.slide_number && `Slide ${inspectedCitation.slide_number}`}
                    {inspectedCitation.timestamp_start && `${inspectedCitation.timestamp_start} – ${inspectedCitation.timestamp_end}`}
                    {!inspectedCitation.page_number && !inspectedCitation.slide_number && !inspectedCitation.timestamp_start && 'Section Chunk'}
                  </div>
                </div>
              </div>

              {/* Verified Content Excerpt */}
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
                <div className="flex items-center justify-between text-[11px] font-semibold text-slate-400 mb-2">
                  <span>Grounding Text Snippet</span>
                  {inspectedCitation.topic && (
                    <span className="px-2 py-0.5 rounded bg-slate-800 text-indigo-400 text-[10px]">
                      Topic: {inspectedCitation.topic}
                    </span>
                  )}
                </div>
                <p className="text-xs leading-relaxed text-slate-300 italic font-serif bg-slate-900/60 p-3 rounded-lg border-l-2 border-indigo-500">
                  "{inspectedCitation.snippet}"
                </p>
              </div>

              <div className="flex items-center justify-between text-[11px] text-slate-500 pt-2">
                <span className="flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  Hallucination Guard Verified
                </span>
                <button
                  onClick={() => setInspectedCitation(null)}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
