import axios from 'axios';
import type { 
  User, 
  AuthResponse, 
  LoginPayload, 
  RegisterPayload 
} from '@/types/auth';
import type {
  Course,
  CourseCreatePayload,
  Topic,
  TopicCreatePayload,
} from '@/types/course';
import type {
  DocumentItem,
  DocumentDetail,
} from '@/types/document';
import type {
  RAGQueryRequest,
  RAGResponse,
  RAGIndexStatus,
  SourceCitation,
} from '@/types/rag';
import type {
  TutorSession,
  TutorSessionDetail,
  TutorMessage,
  CreateSessionPayload,
  SendMessagePayload,
  UpdateModePayload,
  RemediationSessionPayload,
} from '@/types/tutor';
import type {
  Assessment,
  AssessmentDetail,
  AssessmentGeneratePayload,
  AssessmentSubmitRequest,
  AssessmentAttempt,
  AssessmentAttemptDetail,
} from '@/types/assessment';
import type {
  CourseMastery,
  AdaptiveRecommendationsResponse,
  ConceptMastery,
} from '@/types/mastery';
import type {
  Flashcard,
  FlashcardCreatePayload,
  FlashcardGeneratePayload,
  FlashcardReviewPayload,
  FlashcardReviewResult,
  FlashcardDeck,
  FlashcardDeckCreatePayload,
  SRSStats,
} from '@/types/flashcard';
import type { CourseAnalyticsReport } from '@/types/analytics';

// Base API client configured with fallback to relative path (handled by Vite proxy in dev)
export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api/v1',
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor to inject stored JWT token into all outgoing requests
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('knovara_token');
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

export interface DatabaseHealth {
  status: 'connected' | 'disconnected';
  dialect: string;
  host?: string;
  database?: string;
  error?: string;
}

export interface HealthResponse {
  status: 'healthy' | 'degraded';
  service: string;
  description: string;
  version: string;
  environment: string;
  timestamp: string;
  database: DatabaseHealth;
}

export const fetchHealthStatus = async (): Promise<HealthResponse> => {
  try {
    const response = await axios.get<HealthResponse>('http://127.0.0.1:8000/health', {
      timeout: 4000,
    });
    return response.data;
  } catch {
    // Fallback to Vite proxy /api/health
    const response = await axios.get<HealthResponse>('/api/health');
    return response.data;
  }
};

// Authentication API methods
export const registerUser = async (data: RegisterPayload): Promise<AuthResponse> => {
  const response = await api.post<AuthResponse>('/auth/register', data);
  return response.data;
};

export const loginUser = async (data: LoginPayload): Promise<AuthResponse> => {
  const response = await api.post<AuthResponse>('/auth/login', data);
  return response.data;
};

export interface GoogleAuthPayload {
  token?: string;
  id_token?: string;
  email?: string;
  name?: string;
  picture?: string;
}

export const loginWithGoogle = async (data: GoogleAuthPayload): Promise<AuthResponse> => {
  const response = await api.post<AuthResponse>('/auth/google', data);
  return response.data;
};

export const fetchCurrentUser = async (): Promise<User> => {
  const response = await api.get<User>('/auth/me');
  return response.data;
};

// Course API methods
export const fetchCourses = async (): Promise<Course[]> => {
  const response = await api.get<Course[]>('/courses');
  return response.data;
};

export const fetchCourse = async (courseId: string): Promise<Course> => {
  const response = await api.get<Course>(`/courses/${courseId}`);
  return response.data;
};

export const createCourse = async (payload: CourseCreatePayload): Promise<Course> => {
  const response = await api.post<Course>('/courses', payload);
  return response.data;
};

export const updateCourse = async (courseId: string, payload: Partial<CourseCreatePayload>): Promise<Course> => {
  const response = await api.put<Course>(`/courses/${courseId}`, payload);
  return response.data;
};

export const deleteCourse = async (courseId: string): Promise<void> => {
  await api.delete(`/courses/${courseId}`);
};

export const seedDemoCourse = async (): Promise<Course> => {
  const response = await api.post<Course>('/courses/seed-demo');
  return response.data;
};

export const seedFullScenario = async (courseId: string): Promise<Record<string, unknown>> => {
  const response = await api.post<Record<string, unknown>>(`/courses/${courseId}/seed-scenario`);
  return response.data;
};

export const addTopicToCourse = async (courseId: string, payload: TopicCreatePayload): Promise<Topic> => {
  const response = await api.post<Topic>(`/courses/${courseId}/topics`, payload);
  return response.data;
};

// Document & Knowledge Base Ingestion API methods
export const fetchDocuments = async (courseId: string): Promise<DocumentItem[]> => {
  const response = await api.get<DocumentItem[]>(`/courses/${courseId}/documents`);
  return response.data;
};

export const fetchDocumentDetail = async (courseId: string, documentId: string): Promise<DocumentDetail> => {
  const response = await api.get<DocumentDetail>(`/courses/${courseId}/documents/${documentId}`);
  return response.data;
};

export const uploadDocument = async (courseId: string, file: File): Promise<DocumentDetail> => {
  const formData = new FormData();
  formData.append('file', file);
  const response = await api.post<DocumentDetail>(`/courses/${courseId}/documents`, formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return response.data;
};

export const uploadMultipleDocuments = async (courseId: string, files: File[]): Promise<DocumentDetail[]> => {
  const formData = new FormData();
  for (const file of files) {
    formData.append('files', file);
  }
  const response = await api.post<DocumentDetail[]>(`/courses/${courseId}/documents/batch`, formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return response.data;
};

export interface DocumentNotesResponse {
  document_id: string;
  filename: string;
  file_type: string;
  ai_notes: string;
}

export const fetchDocumentNotes = async (courseId: string, documentId: string): Promise<DocumentNotesResponse> => {
  const response = await api.get<DocumentNotesResponse>(`/courses/${courseId}/documents/${documentId}/notes`);
  return response.data;
};

export interface CourseStudyNotesResponse {
  course_id: string;
  course_name: string;
  subject: string;
  study_notes: string;
  document_notes: Array<{
    document_id: string;
    filename: string;
    file_type: string;
    ai_notes: string;
  }>;
}

export const fetchCourseStudyNotes = async (courseId: string): Promise<CourseStudyNotesResponse> => {
  const response = await api.get<CourseStudyNotesResponse>(`/courses/${courseId}/study-notes`);
  return response.data;
};

export interface SynthesisResult {
  message: string;
  course_id: string;
  documents_count: number;
  chunks_count: number;
  topics: string[];
  topics_count: number;
  flashcards_count: number;
  assessment_id?: string;
}

export const synthesizeMaterials = async (courseId: string): Promise<SynthesisResult> => {
  const response = await api.post<SynthesisResult>(`/courses/${courseId}/documents/synthesize`);
  return response.data;
};

export const seedDemoMaterials = async (courseId: string): Promise<DocumentItem[]> => {
  const response = await api.post<DocumentItem[]>(`/courses/${courseId}/documents/demo-seed`);
  return response.data;
};

export const deleteDocument = async (courseId: string, documentId: string): Promise<void> => {
  await api.delete(`/courses/${courseId}/documents/${documentId}`);
};

// Grounded RAG & Source Citations API methods
export const queryRAG = async (courseId: string, payload: RAGQueryRequest): Promise<RAGResponse> => {
  const response = await api.post<RAGResponse>(`/courses/${courseId}/rag/query`, payload);
  return response.data;
};

export const indexCourseRAG = async (courseId: string): Promise<RAGIndexStatus> => {
  const response = await api.post<RAGIndexStatus>(`/courses/${courseId}/rag/index`);
  return response.data;
};

export const fetchRAGStatus = async (courseId: string): Promise<RAGIndexStatus> => {
  const response = await api.get<RAGIndexStatus>(`/courses/${courseId}/rag/status`);
  return response.data;
};

// Multi-Turn AI Tutor & Pedagogical Modes API methods
export const fetchTutorSessions = async (courseId: string): Promise<TutorSession[]> => {
  const response = await api.get<TutorSession[]>(`/courses/${courseId}/tutor/sessions`);
  return response.data;
};

export const createTutorSession = async (courseId: string, payload: CreateSessionPayload): Promise<TutorSession> => {
  const response = await api.post<TutorSession>(`/courses/${courseId}/tutor/sessions`, payload);
  return response.data;
};

export const createRemediationSession = async (
  courseId: string,
  payload: RemediationSessionPayload
): Promise<TutorSessionDetail> => {
  const response = await api.post<TutorSessionDetail>(
    `/courses/${courseId}/tutor/remediate`,
    payload
  );
  return response.data;
};

export const fetchTutorSessionDetail = async (courseId: string, sessionId: string): Promise<TutorSessionDetail> => {
  const response = await api.get<TutorSessionDetail>(`/courses/${courseId}/tutor/sessions/${sessionId}`);
  return response.data;
};

export const sendTutorMessage = async (
  courseId: string, 
  sessionId: string, 
  payload: SendMessagePayload
): Promise<TutorMessage> => {
  const response = await api.post<TutorMessage>(`/courses/${courseId}/tutor/sessions/${sessionId}/messages`, payload);
  return response.data;
};

export interface StreamTutorMessageCallbacks {
  onCitations?: (citations: SourceCitation[]) => void;
  onToken?: (token: string) => void;
  onDone?: (message: TutorMessage) => void;
}

export const streamTutorMessage = async (
  courseId: string,
  sessionId: string,
  payload: SendMessagePayload,
  callbacks: StreamTutorMessageCallbacks
): Promise<TutorMessage> => {
  const token = localStorage.getItem('knovara_token');
  const baseUrl = import.meta.env.VITE_API_BASE_URL || '/api/v1';
  const url = `${baseUrl}/courses/${courseId}/tutor/sessions/${sessionId}/messages/stream`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    let errDetail = 'Failed to connect to tutor streaming service.';
    try {
      const errJson = await response.json();
      if (errJson?.detail) errDetail = errJson.detail;
    } catch {
      // fallback
    }
    throw new Error(errDetail);
  }

  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error('Streaming response body is unavailable.');
  }

  const decoder = new TextDecoder('utf-8');
  let finalMessage: TutorMessage | null = null;
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data: ')) continue;
      const dataStr = trimmed.slice(6).trim();
      if (!dataStr) continue;

      try {
        const parsed = JSON.parse(dataStr);
        if (parsed.type === 'citations' && callbacks.onCitations) {
          callbacks.onCitations(parsed.citations);
        } else if (parsed.type === 'token' && callbacks.onToken) {
          callbacks.onToken(parsed.token);
        } else if (parsed.type === 'done') {
          finalMessage = parsed.message;
          if (callbacks.onDone) callbacks.onDone(parsed.message);
        }
      } catch (e) {
        console.warn('Error parsing SSE chunk:', e);
      }
    }
  }

  if (finalMessage) {
    return finalMessage;
  }
  throw new Error('Streaming completed without final message.');
};

export const updateTutorSessionMode = async (
  courseId: string, 
  sessionId: string, 
  payload: UpdateModePayload
): Promise<TutorSession> => {
  const response = await api.patch<TutorSession>(`/courses/${courseId}/tutor/sessions/${sessionId}/mode`, payload);
  return response.data;
};

export const deleteTutorSession = async (courseId: string, sessionId: string): Promise<void> => {
  await api.delete(`/courses/${courseId}/tutor/sessions/${sessionId}`);
};

// Adaptive Assessment & Bloom's Taxonomy Question Generator API methods
export const fetchAssessments = async (courseId: string): Promise<Assessment[]> => {
  const response = await api.get<Assessment[]>(`/courses/${courseId}/assessments`);
  return response.data;
};

export const fetchAssessmentDetail = async (
  courseId: string,
  assessmentId: string,
  studentMode: boolean = false
): Promise<AssessmentDetail> => {
  const response = await api.get<AssessmentDetail>(
    `/courses/${courseId}/assessments/${assessmentId}?student_mode=${studentMode}`
  );
  return response.data;
};

export const generateAssessment = async (
  courseId: string,
  payload: AssessmentGeneratePayload
): Promise<AssessmentDetail> => {
  const response = await api.post<AssessmentDetail>(`/courses/${courseId}/assessments/generate`, payload);
  return response.data;
};

export const deleteAssessment = async (courseId: string, assessmentId: string): Promise<void> => {
  await api.delete(`/courses/${courseId}/assessments/${assessmentId}`);
};

export const submitAssessment = async (
  courseId: string,
  assessmentId: string,
  payload: AssessmentSubmitRequest
): Promise<AssessmentAttemptDetail> => {
  const response = await api.post<AssessmentAttemptDetail>(
    `/courses/${courseId}/assessments/${assessmentId}/submit`,
    payload
  );
  return response.data;
};

export const fetchAssessmentAttempts = async (
  courseId: string,
  assessmentId: string
): Promise<AssessmentAttempt[]> => {
  const response = await api.get<AssessmentAttempt[]>(
    `/courses/${courseId}/assessments/${assessmentId}/attempts`
  );
  return response.data;
};

export const fetchAttemptDetail = async (
  courseId: string,
  assessmentId: string,
  attemptId: string
): Promise<AssessmentAttemptDetail> => {
  const response = await api.get<AssessmentAttemptDetail>(
    `/courses/${courseId}/assessments/${assessmentId}/attempts/${attemptId}`
  );
  return response.data;
};

// ── Phase 9: Mastery & BKT APIs ───────────────────────────────────────────

export const fetchCourseMastery = async (
  courseId: string
): Promise<CourseMastery> => {
  const response = await api.get<CourseMastery>(`/courses/${courseId}/mastery`);
  return response.data;
};

export const fetchAdaptiveRecommendations = async (
  courseId: string,
  topN: number = 5
): Promise<AdaptiveRecommendationsResponse> => {
  const response = await api.get<AdaptiveRecommendationsResponse>(
    `/courses/${courseId}/mastery/recommendations?top_n=${topN}`
  );
  return response.data;
};

export const fetchConceptMastery = async (
  courseId: string,
  conceptLabel: string
): Promise<ConceptMastery> => {
  const response = await api.get<ConceptMastery>(
    `/courses/${courseId}/mastery/${encodeURIComponent(conceptLabel)}`
  );
  return response.data;
};

// ── Phase 10-B: Spaced Repetition (SRS) & Grounded Flashcards APIs ──────────

export const fetchFlashcards = async (
  courseId: string,
  options?: { deckId?: string; topic?: string; dueOnly?: boolean }
): Promise<Flashcard[]> => {
  const params = new URLSearchParams();
  if (options?.deckId) params.append('deck_id', options.deckId);
  if (options?.topic) params.append('topic', options.topic);
  if (options?.dueOnly) params.append('due_only', 'true');

  const queryString = params.toString() ? `?${params.toString()}` : '';
  const response = await api.get<Flashcard[]>(
    `/courses/${courseId}/flashcards${queryString}`
  );
  return response.data;
};

export const createFlashcard = async (
  courseId: string,
  payload: FlashcardCreatePayload
): Promise<Flashcard> => {
  const response = await api.post<Flashcard>(
    `/courses/${courseId}/flashcards`,
    payload
  );
  return response.data;
};

export const generateFlashcards = async (
  courseId: string,
  payload: FlashcardGeneratePayload
): Promise<Flashcard[]> => {
  const response = await api.post<Flashcard[]>(
    `/courses/${courseId}/flashcards/generate`,
    payload
  );
  return response.data;
};

export const reviewFlashcard = async (
  courseId: string,
  cardId: string,
  payload: FlashcardReviewPayload
): Promise<FlashcardReviewResult> => {
  const response = await api.post<FlashcardReviewResult>(
    `/courses/${courseId}/flashcards/${cardId}/review`,
    payload
  );
  return response.data;
};

export const deleteFlashcard = async (
  courseId: string,
  cardId: string
): Promise<void> => {
  await api.delete(`/courses/${courseId}/flashcards/${cardId}`);
};

export const fetchFlashcardDecks = async (
  courseId: string
): Promise<FlashcardDeck[]> => {
  const response = await api.get<FlashcardDeck[]>(
    `/courses/${courseId}/flashcards/decks`
  );
  return response.data;
};

export const createFlashcardDeck = async (
  courseId: string,
  payload: FlashcardDeckCreatePayload
): Promise<FlashcardDeck> => {
  const response = await api.post<FlashcardDeck>(
    `/courses/${courseId}/flashcards/decks`,
    payload
  );
  return response.data;
};

export const fetchSRSStats = async (
  courseId: string
): Promise<SRSStats> => {
  const response = await api.get<SRSStats>(
    `/courses/${courseId}/flashcards/stats`
  );
  return response.data;
};

// ==========================================
// PHASE 11: LEARNING ANALYTICS & TELEMETRY
// ==========================================

export const fetchCourseAnalytics = async (
  courseId: string
): Promise<CourseAnalyticsReport> => {
  const response = await api.get<CourseAnalyticsReport>(
    `/courses/${courseId}/analytics`
  );
  return response.data;
};

export const exportCourseAnalytics = async (
  courseId: string,
  format: 'markdown' | 'json' = 'markdown'
): Promise<string | CourseAnalyticsReport> => {
  if (format === 'markdown') {
    const response = await api.get<string>(
      `/courses/${courseId}/analytics/export?format=markdown`,
      { responseType: 'text' }
    );
    return response.data;
  }
  const response = await api.get<CourseAnalyticsReport>(
    `/courses/${courseId}/analytics/export?format=json`
  );
  return response.data;
};

