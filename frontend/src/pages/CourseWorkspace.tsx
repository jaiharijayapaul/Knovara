import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, Link, useNavigate, useSearchParams } from 'react-router-dom';
import { 
  fetchCourse, 
  addTopicToCourse, 
  deleteCourse,
  fetchDocuments,
  fetchDocumentDetail,
  uploadDocument,
  ingestYouTubeLecture,
  deleteDocument,
  queryRAG,
  indexCourseRAG,
  fetchRAGStatus,
  synthesizeMaterials,
} from '@/services/api';
import type { Course } from '@/types/course';
import type { DocumentItem, DocumentDetail, FileType } from '@/types/document';
import type { SourceCitation, RAGResponse, RAGIndexStatus } from '@/types/rag';
import { useAuth } from '@/contexts/AuthContext';
import { 
  ArrowLeft, 
  BookOpen, 
  Sparkles, 
  Plus, 
  Trash2, 
  Loader2, 
  FileText, 
  Video, 
  FileUp, 
  CheckCircle2, 
  LogOut,
  User,
  Presentation,
  Music,
  Eye,
  X,
  Clock,
  Bookmark,
  Check,
  UploadCloud,
  RefreshCw,
  AlertTriangle,
  Search,
  Database,
  ShieldCheck,
  ShieldAlert,
  Award,
  BarChart3,
  Printer
} from 'lucide-react';
import { TutorChatStudio } from '@/components/tutor/TutorChatStudio';
import { AssessmentStudio } from '@/components/assessment/AssessmentStudio';
import { MasteryDashboard } from '@/components/mastery/MasteryDashboard';
import { FlashcardStudio } from '@/components/flashcards/FlashcardStudio';
import { AnalyticsStudio } from '@/components/analytics/AnalyticsStudio';
import { ExamRevisionSheetModal } from '@/components/course/ExamRevisionSheetModal';
import { AIStudyNotesModal } from '@/components/course/AIStudyNotesModal';

const YouTubeIcon: React.FC<{ className?: string }> = ({ className = 'w-4 h-4' }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
  </svg>
);

export const CourseWorkspace: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const [course, setCourse] = useState<Course | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Default to 'materials' (Step 1) or query param
  const queryTab = searchParams.get('tab') as 'materials' | 'tutor' | 'flashcards' | 'assessments' | 'mastery' | 'rag' | 'topics' | 'analytics' | null;
  const [activeTab, setActiveTab] = useState<'materials' | 'tutor' | 'flashcards' | 'assessments' | 'mastery' | 'rag' | 'topics' | 'analytics'>(queryTab || 'materials');
  const [selectedAssessmentId, setSelectedAssessmentId] = useState<string | null>(null);
  const [selectedTutorSessionId, setSelectedTutorSessionId] = useState<string | null>(null);

  // Add topic modal/form state
  const [isTopicModalOpen, setIsTopicModalOpen] = useState(false);
  const [newTopicName, setNewTopicName] = useState('');
  const [newTopicDesc, setNewTopicDesc] = useState('');
  const [isSubmittingTopic, setIsSubmittingTopic] = useState(false);

  // Exam Revision Sheet state
  const [isRevisionSheetOpen, setIsRevisionSheetOpen] = useState(false);

  // Document management state
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [loadingDocs, setLoadingDocs] = useState<boolean>(false);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [selectedDoc, setSelectedDoc] = useState<DocumentDetail | null>(null);
  const [inspectingDocId, setInspectingDocId] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);
  const [isSynthesizing, setIsSynthesizing] = useState<boolean>(false);
  const [synthesisMessage, setSynthesisMessage] = useState<string | null>(null);

  // YouTube Lecture Ingestion state
  const [showYouTubeModal, setShowYouTubeModal] = useState<boolean>(false);
  const [youtubeModalTab, setYoutubeModalTab] = useState<'url' | 'transcript'>('url');
  const [youtubeUrl, setYoutubeUrl] = useState<string>('');
  const [youtubeTitle, setYoutubeTitle] = useState<string>('');
  const [youtubeTranscriptText, setYoutubeTranscriptText] = useState<string>('');
  const [isIngestingYouTube, setIsIngestingYouTube] = useState<boolean>(false);
  const [youtubeError, setYoutubeError] = useState<string | null>(null);

  // AI Study Notes modal state
  const [showNotesModal, setShowNotesModal] = useState<boolean>(false);
  const [selectedNotesDocId, setSelectedNotesDocId] = useState<string | null>(null);
  const [uploadProgressText, setUploadProgressText] = useState<string | null>(null);

  // Grounded RAG & Citations state
  const [ragQueryText, setRagQueryText] = useState<string>('');
  const [ragTopicFilter, setRagTopicFilter] = useState<string>('');
  const [isQueryingRAG, setIsQueryingRAG] = useState<boolean>(false);
  const [ragResponse, setRagResponse] = useState<RAGResponse | null>(null);
  const [ragStatus, setRagStatus] = useState<RAGIndexStatus | null>(null);
  const [isIndexingRAG, setIsIndexingRAG] = useState<boolean>(false);
  const [selectedCitation, setSelectedCitation] = useState<SourceCitation | null>(null);

  // File input ref for upload dropzone
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const loadCourse = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchCourse(id);
      setCourse(data);
    } catch {
      setError('Course workspace not found or permission denied.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  const loadDocuments = useCallback(async () => {
    if (!id) return;
    setLoadingDocs(true);
    try {
      const docs = await fetchDocuments(id);
      setDocuments(docs);
    } catch (err) {
      console.error('Failed to load documents:', err);
    } finally {
      setLoadingDocs(false);
    }
  }, [id]);

  const loadRAGStatus = useCallback(async () => {
    if (!id) return;
    try {
      const status = await fetchRAGStatus(id);
      setRagStatus(status);
    } catch (err) {
      console.error('Failed to load RAG status:', err);
    }
  }, [id]);

  useEffect(() => {
    loadCourse();
    loadDocuments();
    loadRAGStatus();
  }, [loadCourse, loadDocuments, loadRAGStatus]);

  const handleAddTopic = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !newTopicName.trim()) return;

    setIsSubmittingTopic(true);
    try {
      await addTopicToCourse(id, {
        name: newTopicName.trim(),
        description: newTopicDesc.trim() || undefined,
      });
      setIsTopicModalOpen(false);
      setNewTopicName('');
      setNewTopicDesc('');
      await loadCourse();
    } catch {
      alert('Failed to add topic.');
    } finally {
      setIsSubmittingTopic(false);
    }
  };

  const handleDeleteCourse = async () => {
    if (!id || !course) return;
    if (!window.confirm(`Are you sure you want to permanently delete "${course.name}"?`)) return;
    try {
      await deleteCourse(id);
      navigate('/courses', { replace: true });
    } catch {
      alert('Failed to delete course.');
    }
  };

  const handleFilesUpload = async (files: FileList | File[]) => {
    if (!id || !files || files.length === 0) return;
    const fileList = Array.from(files);
    setIsUploading(true);
    setUploadError(null);
    setUploadSuccess(null);
    setUploadProgressText(null);

    let successCount = 0;
    const failedNames: string[] = [];

    try {
      for (let i = 0; i < fileList.length; i++) {
        const file = fileList[i];
        setUploadProgressText(`Uploading ${i + 1} of ${fileList.length}: '${file.name}'...`);
        try {
          await uploadDocument(id, file);
          successCount++;
        } catch (err: unknown) {
          console.error(`Failed uploading ${file.name}:`, err);
          failedNames.push(file.name);
        }
      }

      await loadDocuments();
      await loadCourse();

      if (successCount > 0) {
        setUploadSuccess(
          `Uploaded ${successCount} ${successCount === 1 ? 'study material' : 'study materials'} successfully! Generating AI Study Notes, flashcards, and quizzes...`
        );
        // Auto-analyze material & synthesize topics, flashcards, quiz, notes
        try {
          setUploadProgressText('Generating AI Study Notes & synthesizing learning materials...');
          const syn = await synthesizeMaterials(id);
          setSynthesisMessage(
            `🎉 AI Analysis Complete! Generated AI Study Notes, extracted ${syn.topics_count} key topics, created ${syn.flashcards_count} flashcards, and prepared a practice quiz!`
          );
          await loadCourse();
          await loadDocuments();
        } catch (synErr) {
          console.warn('Auto-synthesis note:', synErr);
        }
      }

      if (failedNames.length > 0) {
        setUploadError(`Failed to upload ${failedNames.length} file(s): ${failedNames.join(', ')}`);
      }
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || 'Failed to complete document uploads.';
      setUploadError(msg);
    } finally {
      setIsUploading(false);
      setUploadProgressText(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleFileDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFilesUpload(e.dataTransfer.files);
    }
  };

  const handleYouTubeIngest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    if (youtubeModalTab === 'url' && !youtubeUrl.trim()) return;
    if (youtubeModalTab === 'transcript' && !youtubeTranscriptText.trim()) return;

    setIsIngestingYouTube(true);
    setYoutubeError(null);
    try {
      const doc = await ingestYouTubeLecture(id, {
        url: youtubeUrl.trim() || 'https://www.youtube.com/watch?v=manual_lecture',
        title: youtubeTitle.trim() || undefined,
        manual_transcript: youtubeModalTab === 'transcript' ? youtubeTranscriptText.trim() : undefined,
      });
      setUploadSuccess(`Successfully ingested YouTube lecture "${doc.filename}"! Extracted ${doc.chunks_count} semantic timestamp units.`);
      setShowYouTubeModal(false);
      setYoutubeUrl('');
      setYoutubeTitle('');
      setYoutubeTranscriptText('');
      setYoutubeModalTab('url');
      await loadDocuments();
      await loadCourse();
      await loadRAGStatus();
      if (doc.chunks_count > 0) {
        setSynthesisMessage(`YouTube lecture "${doc.filename}" successfully transcribed and indexed. Click "⚡ Synthesize from Uploads" to update topics and flashcards!`);
      }
    } catch (err: unknown) {
      let msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail 
        || (err as Error)?.message 
        || 'Failed to ingest YouTube video. Please ensure the video URL is valid and has captions/transcripts enabled.';
      if (msg === 'Network Error' || msg.toLowerCase().includes('timeout') || msg.toLowerCase().includes('network error')) {
        msg = 'Connection to backend timed out or server was waking up from cold start. Ingesting large lecture transcripts and generating AI study notes can take ~30-60 seconds. Please click "Ingest" again or refresh the page to check if it completed.';
      }
      setYoutubeError(msg);
    } finally {
      setIsIngestingYouTube(false);
    }
  };

  const handleInspectDoc = async (docId: string) => {
    if (!id) return;
    setInspectingDocId(docId);
    try {
      const detail = await fetchDocumentDetail(id, docId);
      setSelectedDoc(detail);
    } catch {
      alert('Failed to load document details and chunks.');
    } finally {
      setInspectingDocId(null);
    }
  };

  const handleDeleteDoc = async (docId: string, filename: string) => {
    if (!id) return;
    if (!window.confirm(`Delete "${filename}" and all its extracted chunks?`)) return;
    try {
      await deleteDocument(id, docId);
      if (selectedDoc?.id === docId) setSelectedDoc(null);
      await loadDocuments();
      await loadCourse();
      await loadRAGStatus();
    } catch {
      alert('Failed to delete document.');
    }
  };

  const handleSynthesizeMaterials = async () => {
    if (!id) return;
    if (documents.length === 0) {
      alert('Please upload at least one study material (PDF, PPTX, or Video/Audio transcript) first.');
      return;
    }
    setIsSynthesizing(true);
    setSynthesisMessage(null);
    setUploadError(null);
    try {
      const res = await synthesizeMaterials(id);
      setSynthesisMessage(
        `Successfully synthesized study workspace from your live documents: extracted ${res.topics_count} topics and generated ${res.flashcards_count} grounded flashcards.`
      );
      await loadCourse();
      await loadDocuments();
      await loadRAGStatus();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        'Failed to synthesize workspace from uploaded materials.';
      alert(msg);
    } finally {
      setIsSynthesizing(false);
    }
  };

  // Execute RAG Query
  const handleRunRAGQuery = async (queryToRun?: string) => {
    const q = (queryToRun || ragQueryText).trim();
    if (!id || !q) return;

    if (queryToRun) {
      setRagQueryText(queryToRun);
    }

    setIsQueryingRAG(true);
    try {
      const res = await queryRAG(id, {
        query: q,
        topic: ragTopicFilter || undefined,
        top_k: 4,
      });
      setRagResponse(res);
    } catch {
      alert('Failed to execute RAG query.');
    } finally {
      setIsQueryingRAG(false);
    }
  };

  // Re-index Vector Embeddings
  const handleIndexVectors = async () => {
    if (!id) return;
    setIsIndexingRAG(true);
    try {
      const status = await indexCourseRAG(id);
      setRagStatus(status);
      setUploadSuccess(`Vector index synced: ${status.indexed_chunks}/${status.total_chunks} chunks embedded with 256-dim semantic vectors.`);
    } catch {
      alert('Failed to re-index vector embeddings.');
    } finally {
      setIsIndexingRAG(false);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  };

  const getFileTypeIcon = (type: FileType, filename?: string) => {
    if (filename?.toLowerCase().includes('youtube') || filename?.startsWith('YouTube:')) {
      return <YouTubeIcon className="w-4 h-4 text-rose-500" />;
    }
    switch (type) {
      case 'pdf':
        return <FileText className="w-4 h-4 text-rose-400" />;
      case 'pptx':
        return <Presentation className="w-4 h-4 text-amber-400" />;
      case 'video':
        return <Video className="w-4 h-4 text-sky-400" />;
      case 'audio':
        return <Music className="w-4 h-4 text-indigo-400" />;
      default:
        return <FileText className="w-4 h-4 text-teal-400" />;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center space-y-3 text-slate-400">
        <Loader2 className="w-8 h-8 animate-spin text-teal-400" />
        <p className="text-xs">Loading course workspace...</p>
      </div>
    );
  }

  if (error || !course) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-center space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-rose-500/10 text-rose-400 border border-rose-500/20 flex items-center justify-center">
          <BookOpen className="w-6 h-6" />
        </div>
        <h2 className="text-xl font-bold text-white">Course Not Accessible</h2>
        <p className="text-xs text-slate-400 max-w-sm">{error || 'This workspace does not exist or belongs to another user.'}</p>
        <Link
          to="/courses"
          className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-slate-950 bg-teal-400 hover:bg-teal-300 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Courses</span>
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-teal-500 selection:text-white">
      {/* Top Navbar */}
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Link to="/courses" className="flex items-center space-x-2 text-slate-400 hover:text-white transition-colors mr-2">
              <ArrowLeft className="w-4 h-4" />
              <span className="text-xs font-medium">Courses</span>
            </Link>
            <div className="h-4 w-px bg-slate-800" />
            <div className="w-8 h-8 rounded-lg bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-teal-400">
              <BookOpen className="w-4 h-4" />
            </div>
            <span className="font-bold text-sm sm:text-base text-white truncate max-w-[200px] sm:max-w-xs">
              {course.name}
            </span>
          </div>

          <div className="flex items-center space-x-3">
            <Link
              to="/instructions"
              className="hidden sm:inline-flex items-center space-x-1 px-3 py-1.5 rounded-xl border border-slate-800 bg-slate-900/60 hover:bg-slate-800 text-xs font-medium text-slate-300 hover:text-white transition-colors"
            >
              <Sparkles className="w-3.5 h-3.5 text-teal-400" />
              <span>Platform Guide</span>
            </Link>

            <div className="flex items-center space-x-2 px-3 py-1.5 rounded-xl bg-slate-800/80 border border-slate-700/60 text-xs">
              <div className="w-5 h-5 rounded-full bg-teal-500/20 flex items-center justify-center text-teal-400">
                <User className="w-3 h-3" />
              </div>
              <span className="font-medium text-slate-200">{user?.name}</span>
            </div>

            <button
              onClick={logout}
              title="Sign Out"
              className="p-2 rounded-xl text-slate-400 hover:text-rose-400 hover:bg-slate-800/80 border border-slate-700/50 transition-colors cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        
        {/* Workspace Banner */}
        <div className="rounded-2xl bg-gradient-to-r from-teal-950/30 via-slate-900 to-slate-900 border border-slate-800 p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center space-x-2">
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-teal-500/10 text-teal-400 border border-teal-500/20">
                {course.subject}
              </span>
              <span className="text-xs text-slate-400 flex items-center gap-1.5">
                <BookOpen className="w-3.5 h-3.5 text-teal-400" />
                <span>{course.topics?.length || 0} Key Concepts</span>
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white">{course.name}</h1>
            <p className="text-xs sm:text-sm text-slate-400 max-w-2xl leading-relaxed">
              {course.description || 'Welcome to your course! Upload your study material below to get started.'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={() => {
                setSelectedNotesDocId(null);
                setShowNotesModal(true);
              }}
              className="px-3.5 py-2 rounded-xl bg-teal-500/15 border border-teal-500/30 hover:border-teal-400 hover:bg-teal-500/25 text-xs font-bold text-teal-300 hover:text-white transition-all flex items-center gap-2 cursor-pointer shadow-sm group"
              title="View Auto-Generated AI Study Notes"
            >
              <FileText className="w-4 h-4 text-teal-400 group-hover:scale-110 transition-transform" />
              <span>📝 AI Study Notes</span>
            </button>

            <button
              onClick={() => setIsRevisionSheetOpen(true)}
              className="px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-800 hover:border-emerald-500/50 hover:bg-slate-800/80 text-xs font-semibold text-slate-200 hover:text-white transition-all flex items-center gap-2 cursor-pointer shadow-sm group"
              title="Open Printable Exam Revision Sheet"
            >
              <Printer className="w-4 h-4 text-emerald-400 group-hover:scale-110 transition-transform" />
              <span>Exam Revision Sheet</span>
            </button>

            <button
              onClick={handleDeleteCourse}
              className="p-2.5 rounded-xl border border-slate-800 bg-slate-900 hover:border-rose-500/40 hover:text-rose-400 text-slate-500 transition-colors cursor-pointer"
              title="Delete Course Workspace"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Student-Friendly Tab Controls */}
        <div className="flex items-center space-x-2 border-b border-slate-800 text-xs font-semibold overflow-x-auto pb-1">
          <button
            onClick={() => setActiveTab('materials')}
            className={`pb-3 px-3.5 transition-all relative cursor-pointer whitespace-nowrap ${
              activeTab === 'materials' ? 'text-teal-400 font-bold' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <span className="flex items-center space-x-2">
              <FileText className="w-4 h-4 text-teal-400" />
              <span>1. Notes & AI Summary</span>
              <span className="px-2 py-0.5 text-[10px] rounded-full bg-teal-500/20 text-teal-300 font-semibold">
                {documents.length} {documents.length === 1 ? 'file' : 'files'}
              </span>
            </span>
            {activeTab === 'materials' && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-teal-400 rounded-full" />
            )}
          </button>

          <button
            onClick={() => setActiveTab('tutor')}
            className={`pb-3 px-3.5 transition-all relative cursor-pointer whitespace-nowrap ${
              activeTab === 'tutor' ? 'text-indigo-400 font-bold' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <span className="flex items-center space-x-2">
              <Sparkles className="w-4 h-4 text-indigo-400" />
              <span>2. Ask AI Tutor (Q&A)</span>
              <span className="px-2 py-0.5 text-[10px] rounded-full bg-indigo-500/20 text-indigo-300 font-semibold">
                Simple Words
              </span>
            </span>
            {activeTab === 'tutor' && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-500 rounded-full" />
            )}
          </button>

          <button
            onClick={() => setActiveTab('flashcards')}
            className={`pb-3 px-3.5 transition-all relative cursor-pointer whitespace-nowrap ${
              activeTab === 'flashcards' ? 'text-amber-400 font-bold' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <span className="flex items-center space-x-2">
              <RefreshCw className="w-4 h-4 text-amber-400" />
              <span>3. Study Flashcards</span>
              <span className="px-2 py-0.5 text-[10px] rounded-full bg-amber-500/20 text-amber-300 font-semibold">
                Practice
              </span>
            </span>
            {activeTab === 'flashcards' && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-amber-500 rounded-full" />
            )}
          </button>

          <button
            onClick={() => setActiveTab('assessments')}
            className={`pb-3 px-3.5 transition-all relative cursor-pointer whitespace-nowrap ${
              activeTab === 'assessments' ? 'text-emerald-400 font-bold' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <span className="flex items-center space-x-2">
              <Award className="w-4 h-4 text-emerald-400" />
              <span>4. Practice Quiz</span>
              <span className="px-2 py-0.5 text-[10px] rounded-full bg-emerald-500/20 text-emerald-300 font-semibold">
                Test Yourself
              </span>
            </span>
            {activeTab === 'assessments' && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-400 rounded-full" />
            )}
          </button>

          <button
            onClick={() => setActiveTab('mastery')}
            className={`pb-3 px-3.5 transition-all relative cursor-pointer whitespace-nowrap ${
              activeTab === 'mastery' ? 'text-violet-400 font-bold' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <span className="flex items-center space-x-2">
              <BarChart3 className="w-4 h-4 text-violet-400" />
              <span>5. Learning Progress</span>
            </span>
            {activeTab === 'mastery' && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-violet-500 rounded-full" />
            )}
          </button>
        </div>

        {/* Alerts & Notifications */}
        {uploadError && (
          <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{uploadError}</span>
            </div>
            <button onClick={() => setUploadError(null)} className="text-slate-400 hover:text-white">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {uploadSuccess && (
          <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Check className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{uploadSuccess}</span>
            </div>
            <button onClick={() => setUploadSuccess(null)} className="text-slate-400 hover:text-white">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* TAB: ADAPTIVE ASSESSMENTS & BLOOM TAXONOMY (PHASE 7) */}
        {activeTab === 'assessments' && (
          <div className="space-y-6">
            <AssessmentStudio
              courseId={course.id}
              courseName={course.name}
              topics={course.topics || []}
              onNavigateToTutor={(sessionId) => {
                if (sessionId) setSelectedTutorSessionId(sessionId);
                setActiveTab('tutor');
              }}
              initialAssessmentId={selectedAssessmentId}
            />
          </div>
        )}

        {/* TAB: BAYESIAN KNOWLEDGE TRACING & LEARNER MASTERY (PHASE 9) */}
        {activeTab === 'mastery' && (
          <div className="space-y-6">
            <div style={{
              background: 'linear-gradient(135deg, rgba(139,92,246,0.15), rgba(99,102,241,0.08))',
              border: '1px solid rgba(139,92,246,0.25)',
              borderRadius: 16,
              padding: '16px 20px',
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              marginBottom: 8,
            }}>
              <div style={{
                width: 40, height: 40,
                borderRadius: 10,
                background: 'linear-gradient(135deg, #8b5cf6, #6366f1)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 18, flexShrink: 0,
              }}>🧠</div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#c4b5fd', marginBottom: 2 }}>
                  Your Learning Progress & Confidence
                </div>
                <div style={{ fontSize: 12, color: '#a78bfa', lineHeight: 1.5 }}>
                  See how well you know each topic based on your practice quizzes. Complete quick quizzes to build up your confidence score!
                </div>
              </div>
            </div>
            <MasteryDashboard
              courseId={course.id}
              onNavigateToAssessment={(id) => {
                if (id) setSelectedAssessmentId(id);
                setActiveTab('assessments');
              }}
              onNavigateToTutor={(sessionId) => {
                if (sessionId) setSelectedTutorSessionId(sessionId);
                setActiveTab('tutor');
              }}
            />
          </div>
        )}

        {/* TAB: SPACED REPETITION & GROUNDED FLASHCARDS (PHASE 10-B) */}
        {activeTab === 'flashcards' && (
          <div className="space-y-6">
            <FlashcardStudio
              courseId={course.id}
              onNavigateToMastery={() => setActiveTab('mastery')}
            />
          </div>
        )}

        {/* TAB: COMPREHENSIVE LEARNING ANALYTICS & PROGRESS TELEMETRY (PHASE 11) */}
        {activeTab === 'analytics' && (
          <div className="space-y-6">
            <AnalyticsStudio
              courseId={course.id}
              courseName={course.name}
              onNavigateToTab={(tab) => setActiveTab(tab)}
            />
          </div>
        )}

        {/* TAB 0: MULTI-TURN SOCRATIC AI TUTOR (PHASE 6) */}
        {activeTab === 'tutor' && (
          <div className="space-y-6">
            <TutorChatStudio 
              courseId={course.id} 
              courseName={course.name} 
              initialSessionId={selectedTutorSessionId}
            />
          </div>
        )}

        {/* TAB 1: GROUNDED RAG & CITATIONS (PHASE 5) */}
        {activeTab === 'rag' && (
          <div className="space-y-6">
            {/* Vector Index Telemetry Banner */}
            <div className="p-4 rounded-2xl bg-slate-900/50 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center space-x-3">
                <div className="p-2.5 rounded-xl bg-teal-500/10 border border-teal-500/20 text-teal-400">
                  <Database className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-bold text-white">Hybrid Vector Knowledge Index</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-teal-500/10 text-teal-400 border border-teal-500/20 font-mono">
                      {ragStatus?.embedding_dimension || 256}-dim Dense Projections
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">
                    {ragStatus?.indexed_chunks || 0} of {ragStatus?.total_chunks || 0} chunks vectorized with cosine similarity & BM25 keyword reranker
                  </p>
                </div>
              </div>

              <button
                onClick={handleIndexVectors}
                disabled={isIndexingRAG}
                className="px-3.5 py-1.5 rounded-xl border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold flex items-center space-x-1.5 transition-colors cursor-pointer disabled:opacity-50 self-start sm:self-auto"
              >
                {isIndexingRAG ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-teal-400" />
                    <span>Indexing...</span>
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 text-teal-400" />
                    <span>Sync Vector Index</span>
                  </>
                )}
              </button>
            </div>

            {/* Query Section */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 space-y-4">
              <div className="space-y-1">
                <h3 className="text-base font-bold text-white flex items-center space-x-2">
                  <Search className="w-4 h-4 text-teal-400" />
                  <span>Grounded Knowledge Base Query</span>
                </h3>
                <p className="text-xs text-slate-400">
                  Ask questions strictly grounded in your course materials. Returns exact page numbers, slide numbers, and video timestamps.
                </p>
              </div>

              {/* Input Bar */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                {course.topics && course.topics.length > 0 && (
                  <select
                    value={ragTopicFilter}
                    onChange={(e) => setRagTopicFilter(e.target.value)}
                    className="px-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/40"
                  >
                    <option value="">All Topics</option>
                    {course.topics.map((t) => (
                      <option key={t.id} value={t.name}>{t.name}</option>
                    ))}
                  </select>
                )}

                <div className="relative flex-1">
                  <input
                    type="text"
                    value={ragQueryText}
                    onChange={(e) => setRagQueryText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleRunRAGQuery();
                    }}
                    placeholder="e.g. How is Shannon Entropy calculated for training examples?"
                    className="w-full pl-3.5 pr-10 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500/40 focus:border-teal-500/80 transition-all"
                  />
                  {ragQueryText && (
                    <button
                      onClick={() => setRagQueryText('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <button
                  onClick={() => handleRunRAGQuery()}
                  disabled={isQueryingRAG || !ragQueryText.trim()}
                  className="px-5 py-2.5 rounded-xl text-xs font-semibold text-slate-950 bg-teal-400 hover:bg-teal-300 disabled:opacity-50 transition-colors flex items-center justify-center space-x-1.5 cursor-pointer shrink-0"
                >
                  {isQueryingRAG ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Retrieving...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      <span>Run Grounded RAG</span>
                    </>
                  )}
                </button>
              </div>

              {/* Preset Test Prompts */}
              <div className="space-y-1.5 pt-1">
                <span className="text-[11px] font-semibold text-slate-400">Suggested Verification Prompts:</span>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => handleRunRAGQuery("How is Shannon Entropy calculated for training examples?")}
                    className="px-2.5 py-1 rounded-lg text-[11px] font-medium bg-slate-950 hover:bg-slate-800 border border-slate-800 text-rose-300 transition-colors cursor-pointer flex items-center space-x-1"
                  >
                    <FileText className="w-3 h-3 text-rose-400" />
                    <span>PDF Ch. 4 (Page 42 Entropy)</span>
                  </button>
                  <button
                    onClick={() => handleRunRAGQuery("What is Out-of-Bag (OOB) evaluation in Random Forests?")}
                    className="px-2.5 py-1 rounded-lg text-[11px] font-medium bg-slate-950 hover:bg-slate-800 border border-slate-800 text-amber-300 transition-colors cursor-pointer flex items-center space-x-1"
                  >
                    <Presentation className="w-3 h-3 text-amber-400" />
                    <span>PPTX Lec. 5 (Slide 20 OOB)</span>
                  </button>
                  <button
                    onClick={() => handleRunRAGQuery("What common misconception about Entropy did the professor explain in lecture?")}
                    className="px-2.5 py-1 rounded-lg text-[11px] font-medium bg-slate-950 hover:bg-slate-800 border border-slate-800 text-sky-300 transition-colors cursor-pointer flex items-center space-x-1"
                  >
                    <Video className="w-3 h-3 text-sky-400" />
                    <span>Video (18:20–20:05 Misconception)</span>
                  </button>
                  <button
                    onClick={() => handleRunRAGQuery("Explain Quantum Chromodynamics and gluon plasma")}
                    className="px-2.5 py-1 rounded-lg text-[11px] font-medium bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer flex items-center space-x-1"
                  >
                    <ShieldAlert className="w-3 h-3 text-amber-400" />
                    <span>Test Hallucination Guard</span>
                  </button>
                </div>
              </div>
            </div>

            {/* RAG Response View */}
            {ragResponse && (
              <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 space-y-5 animate-in fade-in duration-200">
                {/* Header status */}
                <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-800">
                  <div className="flex items-center space-x-2">
                    {ragResponse.grounded ? (
                      <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        <ShieldCheck className="w-3.5 h-3.5" />
                        <span>Grounded in Course Knowledge Base</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                        <ShieldAlert className="w-3.5 h-3.5" />
                        <span>Knowledge Base Boundary Alert</span>
                      </span>
                    )}

                    <span className="text-[11px] text-slate-500 font-mono">
                      Model: {ragResponse.model_used}
                    </span>
                  </div>

                  <span className="text-xs text-slate-400 font-medium">
                    {ragResponse.retrieved_count} Source Citations Aligned
                  </span>
                </div>

                {/* Answer Body */}
                <div className="p-5 rounded-2xl bg-slate-950/80 border border-slate-800/80 space-y-3">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                    Synthesized Grounded Answer:
                  </h4>
                  <div className="text-sm text-slate-200 leading-relaxed whitespace-pre-line font-sans">
                    {ragResponse.answer}
                  </div>
                </div>

                {/* Verified Citations List */}
                {ragResponse.citations.length > 0 && (
                  <div className="space-y-3 pt-2">
                    <h4 className="text-xs font-bold text-slate-300 flex items-center space-x-1.5">
                      <Bookmark className="w-3.5 h-3.5 text-teal-400" />
                      <span>Retrieved Multimodal Source Citations (Click to Inspect Full Passage):</span>
                    </h4>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {ragResponse.citations.map((cite) => (
                        <div
                          key={cite.chunk_id}
                          onClick={() => setSelectedCitation(cite)}
                          className="p-4 rounded-xl bg-slate-950/70 border border-slate-800/80 hover:border-teal-500/40 hover:bg-slate-900/60 transition-all cursor-pointer space-y-2 group"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-2">
                              <span className="text-xs font-bold text-teal-300">
                                {cite.citation_label}
                              </span>
                              {cite.topic && (
                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                                  {cite.topic}
                                </span>
                              )}
                            </div>

                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-teal-500/10 text-teal-400 border border-teal-500/20">
                              {Math.round(cite.score * 100)}% match
                            </span>
                          </div>

                          <div className="flex items-center space-x-2 text-xs text-slate-400">
                            {getFileTypeIcon(cite.file_type, cite.document_name)}
                            <span className="truncate max-w-[200px]">{cite.document_name}</span>
                            <span>&bull;</span>
                            {cite.page_number && <span className="text-rose-300 font-semibold">Page {cite.page_number}</span>}
                            {cite.slide_number && <span className="text-amber-300 font-semibold">Slide {cite.slide_number}</span>}
                            {cite.timestamp_start && (
                              <span className="text-sky-300 font-semibold">{cite.timestamp_start}–{cite.timestamp_end}</span>
                            )}
                          </div>

                          <p className="text-xs text-slate-400 line-clamp-2 italic font-mono bg-slate-900/40 p-2 rounded-lg border border-slate-800/50">
                            "{cite.snippet}"
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* TAB 1: NOTES, MATERIALS & AI SUMMARY (STEP 1) */}
        {activeTab === 'materials' && (
          <div className="space-y-6">
            {/* Step 1 Onboarding Banner */}
            <div className="p-6 rounded-3xl bg-gradient-to-r from-teal-950/60 via-slate-900 to-slate-900 border border-teal-500/30 space-y-2.5 shadow-xl">
              <div className="flex items-center space-x-2.5">
                <span className="w-7 h-7 rounded-xl bg-teal-400 text-slate-950 font-black text-xs flex items-center justify-center">
                  1
                </span>
                <h3 className="text-base font-extrabold text-white">
                  Step 1: Upload Your Study Notes & Materials
                </h3>
                <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-teal-500/10 text-teal-300 font-semibold border border-teal-500/20">
                  Instant AI Analysis
                </span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed pl-9 max-w-3xl">
                Upload your lecture slides (PPTX), textbook chapters (PDF), or reading notes. 
                Our AI will immediately read the content, break it down into simple concepts, and prepare your 
                <strong> Q&A tutor</strong>, <strong>study flashcards</strong>, and <strong>practice quiz</strong>!
              </p>
            </div>

            {/* Upload Dropzone */}
            <div 
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleFileDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`rounded-3xl border-2 border-dashed transition-all p-8 text-center space-y-4 cursor-pointer ${
                isDragging 
                  ? 'border-teal-400 bg-teal-500/10' 
                  : 'border-slate-800 hover:border-teal-500/40 bg-slate-900/40'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                accept=".pdf,.pptx,.mp4,.webm,.mov,.mkv,.mp3,.wav,.m4a,.aac,.flac,.txt,.vtt,.srt"
                onChange={(e) => {
                  if (e.target.files && e.target.files.length > 0) {
                    handleFilesUpload(e.target.files);
                  }
                }}
              />

              <div className="flex items-center justify-center space-x-3 text-slate-400">
                <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400">
                  <FileText className="w-5 h-5" />
                </div>
                <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
                  <Presentation className="w-5 h-5" />
                </div>
                <div className="p-3 rounded-2xl bg-sky-500/10 border border-sky-500/20 text-sky-400">
                  <Video className="w-5 h-5" />
                </div>
                <div className="p-3 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
                  <Music className="w-5 h-5" />
                </div>
                <div className="p-3 rounded-2xl bg-teal-500/10 border border-teal-500/20 text-teal-400">
                  <UploadCloud className="w-5 h-5" />
                </div>
              </div>

              <div className="space-y-1">
                <h3 className="text-sm font-bold text-white">
                  {isUploading ? (uploadProgressText || 'Analyzing Study Material with AI...') : 'Drop your study materials here, or click to browse'}
                </h3>
                <p className="text-xs text-slate-400 max-w-lg mx-auto">
                  Supports PDF textbooks, PowerPoint slides (.pptx), <strong>Video/Audio lectures (.mp4, .webm, .mov, .mp3, .wav)</strong> with AI speech transcription and visual slide analysis, or lecture notes.
                </p>
                <div className="pt-2 flex items-center justify-center">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowYouTubeModal(true);
                    }}
                    className="px-3.5 py-1.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-300 border border-red-500/25 text-xs font-semibold inline-flex items-center space-x-1.5 transition-all cursor-pointer shadow-sm hover:scale-[1.02]"
                  >
                    <YouTubeIcon className="w-3.5 h-3.5 text-red-400" />
                    <span>Have a YouTube lecture? Ingest by URL &rarr;</span>
                  </button>
                </div>
              </div>

              {isUploading && (
                <div className="flex items-center justify-center space-x-2 text-xs text-teal-400 pt-2 font-medium">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{uploadProgressText || 'Reading document content and generating AI Study Notes...'}</span>
                </div>
              )}
            </div>

            {/* Synthesis Success Banner */}
            {synthesisMessage && (
              <div className="p-4 rounded-2xl bg-emerald-950/40 border border-emerald-500/30 flex items-start space-x-3 text-xs text-emerald-300">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                <div className="space-y-2 flex-1">
                  <p className="font-bold text-emerald-200">Study Guide Ready</p>
                  <p className="text-emerald-400/90 leading-relaxed">{synthesisMessage}</p>
                  
                  {/* Next Step Quick Action Shortcuts */}
                  <div className="pt-1 flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => {
                        setSelectedNotesDocId(null);
                        setShowNotesModal(true);
                      }}
                      className="px-3.5 py-1.5 rounded-xl bg-teal-400 text-slate-950 font-bold text-xs hover:bg-teal-300 transition-colors shadow-sm flex items-center gap-1.5 cursor-pointer"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      <span>📝 Read AI Study Notes &rarr;</span>
                    </button>
                    <button
                      onClick={() => setActiveTab('tutor')}
                      className="px-3 py-1.5 rounded-xl bg-slate-800 text-slate-200 font-semibold text-xs hover:bg-slate-700 transition-colors border border-slate-700"
                    >
                      💬 Ask AI Tutor &rarr;
                    </button>
                    <button
                      onClick={() => setActiveTab('flashcards')}
                      className="px-3 py-1.5 rounded-xl bg-slate-800 text-slate-200 font-semibold text-xs hover:bg-slate-700 transition-colors border border-slate-700"
                    >
                      🗂️ Study Flashcards
                    </button>
                    <button
                      onClick={() => setActiveTab('assessments')}
                      className="px-3 py-1.5 rounded-xl bg-slate-800 text-slate-200 font-semibold text-xs hover:bg-slate-700 transition-colors border border-slate-700"
                    >
                      📝 Take Practice Quiz
                    </button>
                  </div>
                </div>
                <button
                  onClick={() => setSynthesisMessage(null)}
                  className="ml-auto text-emerald-400 hover:text-emerald-200"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Proactive Synthesis Suggestion for Newly Uploaded Materials */}
            {documents.length > 0 && (!course.topics || course.topics.length === 0) && (
              <div className="p-4 rounded-2xl bg-gradient-to-r from-teal-950/40 to-slate-900 border border-teal-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <Sparkles className="w-4 h-4 text-teal-400" />
                    <span className="text-xs font-bold text-white">Live Study Materials Detected</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-teal-500/10 text-teal-300 border border-teal-500/20">
                      {documents.length} File(s)
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 max-w-2xl">
                    Extract curriculum syllabus topics, initialize Bayesian Knowledge Tracing mastery models, and generate grounded flashcards directly from your live documents.
                  </p>
                </div>

                <button
                  onClick={handleSynthesizeMaterials}
                  disabled={isSynthesizing}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-teal-400 to-emerald-400 hover:from-teal-300 hover:to-emerald-300 text-slate-950 font-bold text-xs flex items-center space-x-1.5 transition-all shadow-lg shadow-teal-500/20 disabled:opacity-50 shrink-0 cursor-pointer"
                >
                  {isSynthesizing ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Synthesizing...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>⚡ Synthesize Workspace Now</span>
                    </>
                  )}
                </button>
              </div>
            )}

            {/* Materials List */}
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-base font-bold text-white">Course Knowledge Assets</h3>
                  <p className="text-xs text-slate-400">
                    Extracted semantic chunks with verified page, slide, and audio timestamp citations.
                  </p>
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => setShowYouTubeModal(true)}
                    className="px-3.5 py-2 rounded-xl bg-red-500/15 hover:bg-red-500/25 border border-red-500/30 text-red-300 hover:text-red-200 text-xs font-semibold flex items-center space-x-1.5 transition-all cursor-pointer shadow-sm"
                    title="Ingest YouTube lecture video with timestamped transcript citations"
                  >
                    <YouTubeIcon className="w-3.5 h-3.5 text-red-400" />
                    <span>🎥 Ingest YouTube</span>
                  </button>

                  <button
                    onClick={handleSynthesizeMaterials}
                    disabled={isSynthesizing || documents.length === 0}
                    className="px-3.5 py-2 rounded-xl bg-teal-500/15 hover:bg-teal-500/25 border border-teal-500/30 text-teal-300 hover:text-teal-200 text-xs font-semibold flex items-center space-x-1.5 transition-all cursor-pointer disabled:opacity-40"
                    title="Synthesize topics, flashcards, and assessments from uploaded materials"
                  >
                    {isSynthesizing ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-teal-400" />
                        <span>Synthesizing...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3.5 h-3.5 text-teal-400" />
                        <span>⚡ Synthesize from Uploads</span>
                      </>
                    )}
                  </button>

                  <button
                    onClick={loadDocuments}
                    title="Refresh Materials"
                    className="p-2 rounded-xl border border-slate-800 bg-slate-900 hover:border-slate-700 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${loadingDocs ? 'animate-spin' : ''}`} />
                  </button>
                </div>
              </div>

              {documents.length === 0 ? (
                <div className="rounded-2xl border border-slate-800 bg-slate-900/20 p-10 text-center space-y-3">
                  <div className="w-12 h-12 mx-auto rounded-2xl bg-slate-800/60 flex items-center justify-center text-slate-500">
                    <FileUp className="w-6 h-6" />
                  </div>
                  <h4 className="text-sm font-semibold text-slate-300">No Learning Materials Uploaded Yet</h4>
                  <p className="text-xs text-slate-500 max-w-md mx-auto">
                    Upload your course lecture slides (.pptx), textbook chapters (.pdf), or paste a YouTube lecture URL in the dropzone above to begin indexing.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3">
                  {documents.map((doc) => (
                    <div
                      key={doc.id}
                      className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80 hover:border-slate-700 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                    >
                      <div className="flex items-center space-x-3 min-w-0">
                        <div className="w-10 h-10 rounded-xl bg-slate-800/80 border border-slate-700 flex items-center justify-center shrink-0">
                          {getFileTypeIcon(doc.file_type, doc.filename)}
                        </div>
                        <div className="min-w-0 space-y-1">
                          <div className="flex items-center space-x-2">
                            <span className="font-semibold text-sm text-white truncate max-w-xs sm:max-w-md">
                              {doc.filename}
                            </span>
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase bg-slate-800 text-slate-300 border border-slate-700">
                              {doc.file_type}
                            </span>
                          </div>
                          <div className="flex items-center space-x-3 text-xs text-slate-400">
                            <span>{formatFileSize(doc.file_size)}</span>
                            <span>&bull;</span>
                            <span className="text-teal-400 font-medium">
                              {doc.chunks_count} citation chunks
                            </span>
                            <span>&bull;</span>
                            <span className="text-slate-500">
                              {new Date(doc.created_at).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center space-x-2 shrink-0 self-end sm:self-center">
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full flex items-center space-x-1 ${
                          doc.processing_status === 'COMPLETED'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : doc.processing_status === 'PROCESSING'
                            ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                            : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                        }`}>
                          <CheckCircle2 className="w-3 h-3" />
                          <span>{doc.processing_status}</span>
                        </span>

                        <button
                          onClick={() => {
                            setSelectedNotesDocId(doc.id);
                            setShowNotesModal(true);
                          }}
                          className="px-3 py-1.5 rounded-xl border border-teal-500/30 bg-teal-500/10 hover:bg-teal-500/20 text-teal-300 text-xs font-semibold flex items-center space-x-1.5 transition-colors cursor-pointer"
                          title="Read Auto-Generated AI Study Notes"
                        >
                          <FileText className="w-3.5 h-3.5 text-teal-400" />
                          <span>AI Notes</span>
                        </button>

                        <button
                          onClick={() => handleInspectDoc(doc.id)}
                          disabled={inspectingDocId === doc.id}
                          className="px-3 py-1.5 rounded-xl border border-slate-700 bg-slate-800 hover:bg-slate-700 hover:text-white text-slate-300 text-xs font-medium flex items-center space-x-1.5 transition-colors cursor-pointer disabled:opacity-50"
                        >
                          {inspectingDocId === doc.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin text-teal-400" />
                          ) : (
                            <Eye className="w-3.5 h-3.5 text-teal-400" />
                          )}
                          <span>Inspect Chunks</span>
                        </button>

                        <button
                          onClick={() => handleDeleteDoc(doc.id, doc.filename)}
                          className="p-1.5 rounded-xl border border-slate-800 bg-slate-900 hover:border-rose-500/40 text-slate-500 hover:text-rose-400 transition-colors cursor-pointer"
                          title="Delete Material"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* AI Content Analysis & Key Topics Section */}
            <div className="rounded-3xl bg-slate-900/60 border border-slate-800 p-6 sm:p-7 space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800/80">
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <Sparkles className="w-5 h-5 text-teal-400" />
                    <h3 className="text-base font-extrabold text-white">
                      AI Content Analysis & Key Concepts
                    </h3>
                    <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-teal-500/10 text-teal-300 font-semibold border border-teal-500/20">
                      {course.topics?.length || 0} Core Topics
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">
                    Extracted automatically by AI from your uploaded notes and reading materials.
                  </p>
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => setIsTopicModalOpen(true)}
                    className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 transition-colors cursor-pointer border border-slate-700"
                  >
                    <Plus className="w-3.5 h-3.5 text-teal-400" />
                    <span>Add Custom Topic</span>
                  </button>

                  <button
                    onClick={() => setActiveTab('tutor')}
                    className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl text-xs font-bold text-slate-950 bg-teal-400 hover:bg-teal-300 transition-all shadow-md shadow-teal-500/20 cursor-pointer"
                  >
                    <span>💬 Start Q&A Session &rarr;</span>
                  </button>
                </div>
              </div>

              {(!course.topics || course.topics.length === 0) ? (
                <div className="rounded-2xl border border-dashed border-slate-800 p-8 text-center space-y-3">
                  <p className="text-xs text-slate-400">
                    No key topics extracted yet. Upload a study document or click "Synthesize from Uploads" to analyze.
                  </p>
                  <button
                    onClick={handleSynthesizeMaterials}
                    disabled={isSynthesizing || documents.length === 0}
                    className="px-4 py-2 rounded-xl bg-teal-500/20 text-teal-300 hover:bg-teal-500/30 text-xs font-semibold transition-colors disabled:opacity-50"
                  >
                    ⚡ Analyze Materials Now
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {course.topics.map((topic, index) => (
                    <div
                      key={topic.id}
                      className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800/80 hover:border-teal-500/30 transition-all space-y-2 flex flex-col justify-between"
                    >
                      <div className="space-y-1.5">
                        <div className="flex items-center space-x-2">
                          <span className="w-6 h-6 rounded-lg bg-teal-500/10 text-teal-400 text-xs font-bold flex items-center justify-center shrink-0">
                            {index + 1}
                          </span>
                          <h4 className="font-bold text-sm text-white truncate">{topic.name}</h4>
                        </div>
                        <p className="text-xs text-slate-400 leading-relaxed pl-8 line-clamp-3">
                          {topic.description || 'Core concept extracted from your uploaded study materials.'}
                        </p>
                      </div>

                      <div className="pt-2 pl-8 flex items-center space-x-2">
                        <button
                          onClick={() => {
                            setActiveTab('tutor');
                          }}
                          className="text-[11px] font-semibold text-teal-400 hover:text-teal-300 flex items-center space-x-1"
                        >
                          <span>Ask AI about this</span>
                          <span>&rarr;</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Bottom Learning Session Launcher */}
              {documents.length > 0 && (
                <div className="pt-4 border-t border-slate-800/80 grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <button
                    onClick={() => setActiveTab('tutor')}
                    className="p-4 rounded-2xl bg-gradient-to-br from-indigo-950/40 to-slate-900 border border-indigo-500/30 hover:border-indigo-400 text-left space-y-1 transition-all group"
                  >
                    <div className="text-xs font-bold text-indigo-300 flex items-center justify-between">
                      <span>💬 Step 2: Ask AI Tutor (Q&A)</span>
                      <span className="text-indigo-400 group-hover:translate-x-1 transition-transform">&rarr;</span>
                    </div>
                    <p className="text-[11px] text-slate-400">
                      Ask whatever you want about your notes in simple words.
                    </p>
                  </button>

                  <button
                    onClick={() => setActiveTab('flashcards')}
                    className="p-4 rounded-2xl bg-gradient-to-br from-amber-950/40 to-slate-900 border border-amber-500/30 hover:border-amber-400 text-left space-y-1 transition-all group"
                  >
                    <div className="text-xs font-bold text-amber-300 flex items-center justify-between">
                      <span>🗂️ Step 3: Study Flashcards</span>
                      <span className="text-amber-400 group-hover:translate-x-1 transition-transform">&rarr;</span>
                    </div>
                    <p className="text-[11px] text-slate-400">
                      Practice active recall with auto-generated cards.
                    </p>
                  </button>

                  <button
                    onClick={() => setActiveTab('assessments')}
                    className="p-4 rounded-2xl bg-gradient-to-br from-emerald-950/40 to-slate-900 border border-emerald-500/30 hover:border-emerald-400 text-left space-y-1 transition-all group"
                  >
                    <div className="text-xs font-bold text-emerald-300 flex items-center justify-between">
                      <span>📝 Step 4: Practice Quiz</span>
                      <span className="text-emerald-400 group-hover:translate-x-1 transition-transform">&rarr;</span>
                    </div>
                    <p className="text-[11px] text-slate-400">
                      Test your understanding with instant feedback.
                    </p>
                  </button>
                </div>
              )}
            </div>
          </div>
        )}



      </main>

      {/* Deep Citation Inspector Modal */}
      {selectedCitation && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6">
          <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl flex flex-col space-y-4 animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center space-x-3">
                <div className="p-2.5 rounded-xl bg-slate-800 border border-slate-700">
                  {getFileTypeIcon(selectedCitation.file_type, selectedCitation.document_name)}
                </div>
                <div>
                  <h3 className="font-bold text-base text-white">
                    {selectedCitation.citation_label}
                  </h3>
                  <p className="text-xs text-slate-400">
                    Source: {selectedCitation.document_name}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedCitation(null)}
                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Coordinates & Topic */}
            <div className="flex flex-wrap items-center gap-2 text-xs">
              {selectedCitation.page_number && (
                <span className="px-2.5 py-1 rounded-lg bg-rose-500/10 text-rose-300 border border-rose-500/20 font-semibold flex items-center space-x-1">
                  <Bookmark className="w-3.5 h-3.5" />
                  <span>Textbook Page {selectedCitation.page_number}</span>
                </span>
              )}
              {selectedCitation.slide_number && (
                <span className="px-2.5 py-1 rounded-lg bg-amber-500/10 text-amber-300 border border-amber-500/20 font-semibold flex items-center space-x-1">
                  <Presentation className="w-3.5 h-3.5" />
                  <span>Slide {selectedCitation.slide_number}</span>
                </span>
              )}
              {selectedCitation.timestamp_start && (
                <span className="px-2.5 py-1 rounded-lg bg-sky-500/10 text-sky-300 border border-sky-500/20 font-semibold flex items-center space-x-1">
                  <Clock className="w-3.5 h-3.5" />
                  <span>Video Timestamp: {selectedCitation.timestamp_start} &ndash; {selectedCitation.timestamp_end}</span>
                </span>
              )}
              {selectedCitation.topic && (
                <span className="px-2.5 py-1 rounded-lg bg-teal-500/10 text-teal-300 border border-teal-500/20 font-semibold">
                  Curriculum Topic: {selectedCitation.topic}
                </span>
              )}
            </div>

            {/* Hybrid Retrieval Breakdown */}
            <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-2">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Hybrid Retrieval Relevance Metrics:
              </span>
              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <div className="p-2 rounded-xl bg-slate-900 border border-slate-800">
                  <div className="text-teal-400 font-bold text-sm">{Math.round(selectedCitation.score * 100)}%</div>
                  <div className="text-[10px] text-slate-500">Composite Score</div>
                </div>
                <div className="p-2 rounded-xl bg-slate-900 border border-slate-800">
                  <div className="text-sky-400 font-bold text-sm">{Math.round(selectedCitation.semantic_score * 100)}%</div>
                  <div className="text-[10px] text-slate-500">Semantic Cosine</div>
                </div>
                <div className="p-2 rounded-xl bg-slate-900 border border-slate-800">
                  <div className="text-amber-400 font-bold text-sm">{Math.round(selectedCitation.keyword_score * 100)}%</div>
                  <div className="text-[10px] text-slate-500">Keyword Density</div>
                </div>
              </div>
            </div>

            {/* Snippet / Full Text */}
            <div className="space-y-1.5">
              <span className="text-xs font-bold text-slate-300">Verified Excerpt Text:</span>
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800/80 text-xs text-slate-200 font-mono leading-relaxed max-h-48 overflow-y-auto">
                {selectedCitation.snippet}
              </div>
            </div>

            {/* Footer */}
            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setSelectedCitation(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-colors cursor-pointer"
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Document Chunks Drawer Modal */}
      {selectedDoc && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6">
          <div className="w-full max-w-3xl max-h-[85vh] bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl flex flex-col space-y-4 animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center space-x-3">
                <div className="p-2.5 rounded-xl bg-slate-800 border border-slate-700">
                  {getFileTypeIcon(selectedDoc.file_type, selectedDoc.filename)}
                </div>
                <div>
                  <h3 className="font-bold text-base text-white truncate max-w-md">
                    {selectedDoc.filename}
                  </h3>
                  <p className="text-xs text-slate-400">
                    {selectedDoc.chunks.length} extracted semantic chunks with grounded citation indices
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedDoc(null)}
                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Chunks List */}
            <div className="flex-1 overflow-y-auto space-y-3 pr-1">
              {selectedDoc.chunks.map((chunk, idx) => (
                <div
                  key={chunk.id}
                  className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800/80 space-y-2 hover:border-teal-500/30 transition-all"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center space-x-2">
                      <span className="w-5 h-5 rounded-md bg-teal-500/10 text-teal-400 text-xs font-bold flex items-center justify-center">
                        {idx + 1}
                      </span>
                      {chunk.topic && (
                        <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-800 text-teal-300 border border-slate-700">
                          Topic: {chunk.topic}
                        </span>
                      )}
                    </div>

                    {/* Exact Citations Attribution */}
                    <div className="flex items-center space-x-2">
                      {chunk.page_number && (
                        <span className="inline-flex items-center space-x-1 text-[11px] font-semibold px-2 py-0.5 rounded-md bg-rose-500/10 text-rose-300 border border-rose-500/20">
                          <Bookmark className="w-3 h-3" />
                          <span>Page {chunk.page_number}</span>
                        </span>
                      )}
                      {chunk.slide_number && (
                        <span className="inline-flex items-center space-x-1 text-[11px] font-semibold px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-300 border border-amber-500/20">
                          <Presentation className="w-3 h-3" />
                          <span>Slide {chunk.slide_number}</span>
                        </span>
                      )}
                      {chunk.timestamp_start && (
                        <span className="inline-flex items-center space-x-1 text-[11px] font-semibold px-2 py-0.5 rounded-md bg-sky-500/10 text-sky-300 border border-sky-500/20">
                          <Clock className="w-3 h-3" />
                          <span>{chunk.timestamp_start} &ndash; {chunk.timestamp_end}</span>
                        </span>
                      )}
                    </div>
                  </div>

                  <p className="text-xs text-slate-300 leading-relaxed font-mono bg-slate-900/50 p-3 rounded-xl border border-slate-800/60">
                    {chunk.content}
                  </p>
                </div>
              ))}
            </div>

            {/* Modal Footer */}
            <div className="pt-3 border-t border-slate-800 flex items-center justify-between text-xs text-slate-500">
              <span>Ready for Section 5: Grounded RAG & Semantic Retrieval</span>
              <button
                onClick={() => setSelectedDoc(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium transition-colors cursor-pointer"
              >
                Close Drawer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Topic Modal */}
      {isTopicModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <h3 className="font-bold text-lg text-white">Add Curriculum Topic</h3>

            <form onSubmit={handleAddTopic} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Topic Title *
                </label>
                <input
                  type="text"
                  required
                  value={newTopicName}
                  onChange={(e) => setNewTopicName(e.target.value)}
                  placeholder="e.g. Neural Networks & Backpropagation"
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500/40 focus:border-teal-500/80 transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Concept Description
                </label>
                <textarea
                  rows={3}
                  value={newTopicDesc}
                  onChange={(e) => setNewTopicDesc(e.target.value)}
                  placeholder="Key concepts, algorithms, formulas covered in this unit..."
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500/40 focus:border-teal-500/80 transition-all"
                />
              </div>

              <div className="pt-2 flex items-center justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setIsTopicModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingTopic || !newTopicName.trim()}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-950 bg-teal-400 hover:bg-teal-300 disabled:opacity-50 transition-colors flex items-center space-x-1.5 cursor-pointer"
                >
                  {isSubmittingTopic ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Adding...</span>
                    </>
                  ) : (
                    <span>Add to Curriculum</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Exam Revision Sheet Modal */}
      {isRevisionSheetOpen && course && (
        <ExamRevisionSheetModal
          course={course}
          documents={documents}
          studentName={user?.name || 'Student'}
          onClose={() => setIsRevisionSheetOpen(false)}
        />
      )}

      {/* AI Study Notes Modal */}
      {showNotesModal && course && (
        <AIStudyNotesModal
          course={course}
          documents={documents}
          initialDocId={selectedNotesDocId}
          onClose={() => {
            setShowNotesModal(false);
            setSelectedNotesDocId(null);
          }}
          onAskTutor={() => {
            setActiveTab('tutor');
          }}
        />
      )}

      {/* YouTube Lecture Ingestion Modal */}
      {showYouTubeModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-2xl bg-red-500/15 border border-red-500/25 flex items-center justify-center text-red-400">
                  <YouTubeIcon className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-white">Ingest YouTube Lecture</h3>
                  <p className="text-xs text-slate-400">Extract timestamped transcripts & vector embeddings</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (!isIngestingYouTube) {
                    setShowYouTubeModal(false);
                    setYoutubeError(null);
                  }
                }}
                className="text-slate-400 hover:text-slate-200 transition-colors cursor-pointer p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Tabs */}
            <div className="flex p-1 bg-slate-950/80 rounded-2xl border border-slate-800">
              <button
                type="button"
                onClick={() => setYoutubeModalTab('url')}
                className={`flex-1 py-2 px-3 rounded-xl text-xs font-semibold transition-all flex items-center justify-center space-x-2 cursor-pointer ${
                  youtubeModalTab === 'url'
                    ? 'bg-slate-800 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <YouTubeIcon className="w-4 h-4 text-rose-500" />
                <span>Auto Fetch (URL)</span>
              </button>
              <button
                type="button"
                onClick={() => setYoutubeModalTab('transcript')}
                className={`flex-1 py-2 px-3 rounded-xl text-xs font-semibold transition-all flex items-center justify-center space-x-2 cursor-pointer ${
                  youtubeModalTab === 'transcript'
                    ? 'bg-slate-800 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <FileText className="w-3.5 h-3.5 text-amber-400" />
                <span>Paste Transcript</span>
                <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  Cloud Safe
                </span>
              </button>
            </div>

            {youtubeError && (
              <div className="p-3.5 rounded-2xl bg-red-950/40 border border-red-500/30 space-y-2 text-xs text-red-300">
                <div className="flex items-start space-x-2.5">
                  <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                  <div className="flex-1 leading-relaxed">{youtubeError}</div>
                </div>
                {youtubeModalTab === 'url' && (
                  <div className="pt-1 flex items-center justify-end">
                    <button
                      type="button"
                      onClick={() => {
                        setYoutubeModalTab('transcript');
                        setYoutubeError(null);
                      }}
                      className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-300 hover:bg-amber-500/30 transition-all font-semibold text-[11px] cursor-pointer"
                    >
                      <Sparkles className="w-3 h-3 text-amber-400" />
                      <span>Switch to "Paste Transcript" Tab →</span>
                    </button>
                  </div>
                )}
              </div>
            )}

            <form onSubmit={handleYouTubeIngest} className="space-y-4">
              {youtubeModalTab === 'url' ? (
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    YouTube Video URL <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="url"
                    required
                    value={youtubeUrl}
                    onChange={(e) => setYoutubeUrl(e.target.value)}
                    placeholder="https://www.youtube.com/watch?v=... or https://youtu.be/..."
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-red-500/40 focus:border-red-500/80 transition-all font-mono"
                  />
                  <p className="text-[11px] text-slate-400 mt-1.5 flex items-center gap-1.5">
                    <span className="inline-block w-2 h-2 rounded-full bg-emerald-400"></span>
                    <span><strong>Multilingual Video Support:</strong> Paste videos in English, Hindi, Spanish, French, German, Tamil, etc. Foreign lectures are automatically translated into English!</span>
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                      YouTube Video URL <span className="text-slate-500 font-normal">(Optional, allows interactive timestamp jump links)</span>
                    </label>
                    <input
                      type="url"
                      value={youtubeUrl}
                      onChange={(e) => setYoutubeUrl(e.target.value)}
                      placeholder="https://www.youtube.com/watch?v=... (optional)"
                      className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500/80 transition-all font-mono"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-xs font-semibold text-slate-300">
                        Lecture Transcript / Captions <span className="text-red-400">*</span>
                      </label>
                      <span className="text-[11px] text-amber-400/90 font-medium">Timestamps supported or raw text</span>
                    </div>
                    <textarea
                      required
                      rows={5}
                      value={youtubeTranscriptText}
                      onChange={(e) => setYoutubeTranscriptText(e.target.value)}
                      placeholder="Paste YouTube transcript (with or without timestamps) or lecture notes here...&#10;&#10;Example:&#10;0:00 Welcome to the lecture...&#10;0:45 Today we cover binary search..."
                      className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500/80 transition-all font-mono leading-relaxed"
                    />
                    <div className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800/80 text-[11px] text-slate-400 space-y-1 mt-1.5">
                      <p className="font-semibold text-slate-300 flex items-center gap-1.5">
                        <Sparkles className="w-3 h-3 text-amber-400" />
                        <span>How to get transcript from YouTube in 5 seconds:</span>
                      </p>
                      <ol className="list-decimal pl-4 space-y-0.5 text-slate-400">
                        <li>Open the lecture video on YouTube.</li>
                        <li>Click the <strong>"..."</strong> button below the video title &rarr; select <strong>"Show transcript"</strong>.</li>
                        <li>Select and copy all transcript text, then paste it into the box above!</li>
                      </ol>
                    </div>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Custom Lecture Title <span className="text-slate-500 font-normal">(Optional)</span>
                </label>
                <input
                  type="text"
                  value={youtubeTitle}
                  onChange={(e) => setYoutubeTitle(e.target.value)}
                  placeholder="Leave blank to automatically fetch the official video title"
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500/40 focus:border-teal-500/80 transition-all"
                />
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800/80 space-y-2 text-[11px] text-slate-400">
                <div className="flex items-center space-x-1.5 text-slate-300 font-semibold">
                  <Sparkles className="w-3.5 h-3.5 text-teal-400" />
                  <span>What happens during ingestion?</span>
                </div>
                <ul className="list-disc pl-4 space-y-1.5 text-slate-400">
                  <li><strong>Captions & Timestamps:</strong> Speech is segmented into semantic units with exact video timestamps (e.g. <span className="text-sky-300 font-mono">[YouTube: 04:20-05:45]</span>).</li>
                  <li><strong>Multilingual Auto-Translation:</strong> Foreign language transcripts are translated into clear academic English.</li>
                  <li><strong>English AI Tutor & Notes:</strong> All generated notes, flashcards, and practice questions are synthesized strictly in English.</li>
                  <li><strong>Interactive Citations:</strong> Clicking any timestamp badge in chat or notes jumps straight to that moment in the lecture!</li>
                </ul>
              </div>

              <div className="pt-2 flex items-center justify-end space-x-3">
                <button
                  type="button"
                  disabled={isIngestingYouTube}
                  onClick={() => {
                    setShowYouTubeModal(false);
                    setYoutubeError(null);
                  }}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-slate-200 transition-colors cursor-pointer disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={
                    isIngestingYouTube ||
                    (youtubeModalTab === 'url' ? !youtubeUrl.trim() : !youtubeTranscriptText.trim())
                  }
                  className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-950 bg-gradient-to-r from-red-400 to-amber-400 hover:from-red-300 hover:to-amber-300 disabled:opacity-50 transition-all flex items-center space-x-2 cursor-pointer shadow-lg shadow-red-500/10"
                >
                  {isIngestingYouTube ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Transcribing & Embedding...</span>
                    </>
                  ) : (
                    <>
                      {youtubeModalTab === 'url' ? (
                        <YouTubeIcon className="w-3.5 h-3.5 text-slate-950" />
                      ) : (
                        <FileText className="w-3.5 h-3.5 text-slate-950" />
                      )}
                      <span>
                        {youtubeModalTab === 'url' ? 'Ingest & Generate Citations' : 'Ingest Pasted Transcript'}
                      </span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950 py-6 text-center text-xs text-slate-500">
        <p>Knovara — The Cognitive Learning Operating System. Built for authentic, verifiable academic mastery.</p>
      </footer>
    </div>
  );
};
