export interface Topic {
  id: string;
  course_id: string;
  name: string;
  description?: string;
  parent_topic_id?: string;
  created_at: string;
}

export interface Course {
  id: string;
  user_id: string;
  name: string;
  description?: string;
  subject: string;
  created_at: string;
  updated_at: string;
  topics_count: number;
  documents_count: number;
  study_notes?: string | null;
  topics?: Topic[];
}

export interface CourseCreatePayload {
  name: string;
  description?: string;
  subject: string;
}

export interface TopicCreatePayload {
  name: string;
  description?: string;
  parent_topic_id?: string;
}
