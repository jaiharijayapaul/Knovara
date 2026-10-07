export interface AdminStats {
  total_users: number;
  total_students: number;
  total_instructors: number;
  total_admins: number;
  total_courses: number;
  total_documents: number;
  total_chunks: number;
  total_topics: number;
  total_flashcards: number;
  total_assessments: number;
  total_tutor_sessions: number;
  total_storage_bytes: number;
  database_status: string;
  database_dialect: string;
}

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: 'student' | 'instructor' | 'admin';
  education_level: string;
  courses_count: number;
  created_at: string;
  updated_at: string;
}

export interface AdminCourse {
  id: string;
  name: string;
  subject: string;
  description?: string;
  user_id: string;
  user_name?: string;
  user_email?: string;
  documents_count: number;
  topics_count: number;
  created_at: string;
  updated_at: string;
}

export interface AdminActivity {
  id: string;
  type: 'document_upload' | 'tutor_session' | 'assessment_attempt' | 'course_created';
  title: string;
  detail: string;
  user_name?: string;
  user_email?: string;
  timestamp: string;
}
