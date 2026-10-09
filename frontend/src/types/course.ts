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

export interface CourseFlowMapNode {
  id: string;
  name: string;
  description?: string;
  order_index: number;
  prerequisites: string[];
  p_know: number;
  mastery_percentage: number;
  is_mastered: boolean;
  status: 'locked' | 'available' | 'in_progress' | 'mastered';
  chunk_count: number;
}

export interface CourseFlowMapEdge {
  source: string;
  target: string;
  relationship: string;
}

export interface CourseFlowMapResponse {
  course_id: string;
  course_name: string;
  subject: string;
  nodes: CourseFlowMapNode[];
  edges: CourseFlowMapEdge[];
  overall_progress_percentage: number;
}

export interface StudyScheduleItem {
  date: string;
  day_offset: number;
  topic: string;
  session_type: string;
  retention_estimate: number;
  retention_percentage: number;
  urgency: 'high' | 'medium' | 'low';
  recommended_duration_mins: number;
  suggested_action: string;
}

export interface StudyScheduleResponse {
  course_id: string;
  course_name: string;
  target_exam_date: string;
  days_until_exam: number;
  daily_allocated_hours: number;
  schedule: StudyScheduleItem[];
  summary: string;
}

