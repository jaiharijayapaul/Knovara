/**
 * Types for Comprehensive Learning Analytics & Progress Telemetry (Phase 11).
 */

export interface LearnerVelocity {
  overall_mastery_pct: number;
  mastered_concepts_count: number;
  total_concepts_count: number;
  mastery_velocity: number;
  study_streak_days: number;
  total_study_time_minutes: number;
  total_interactions: number;
  assessment_attempts_count: number;
  flashcard_reviews_count: number;
  tutor_messages_count: number;
}

export interface BloomCognitiveTelemetry {
  level: 'remember' | 'understand' | 'apply' | 'analyze' | 'evaluate' | 'create' | string;
  display_name: string;
  total_questions: number;
  correct_questions: number;
  accuracy_pct: number;
  description: string;
}

export interface MisconceptionTelemetry {
  error_category: string;
  display_name: string;
  count: number;
  percentage: number;
  remediation_advice: string;
  affected_concepts: string[];
}

export interface RetentionForecastDay {
  day_offset: number;
  date_str: string;
  projected_retention_pct: number;
  cards_due: number;
}

export interface RetentionForecast {
  active_cards: number;
  mature_cards: number;
  learning_cards: number;
  average_ease_factor: number;
  predicted_retention_pct: number;
  due_today: number;
  due_in_3_days: number;
  due_in_7_days: number;
  due_in_14_days: number;
  forecast_days: RetentionForecastDay[];
}

export interface ActivityTimelinePoint {
  date: string;
  assessments_count: number;
  reviews_count: number;
  tutor_messages_count: number;
  mastery_snapshot: number;
}

export interface ConceptMatrixItem {
  concept_label: string;
  p_know: number;
  is_mastered: boolean;
  status: 'Mastered' | 'In Progress' | 'Needs Attention' | string;
  priority_score: number;
  history: number[];
}

export interface CourseAnalyticsReport {
  course_id: string;
  course_name: string;
  generated_at: string;
  velocity: LearnerVelocity;
  bloom_telemetry: BloomCognitiveTelemetry[];
  misconception_telemetry: MisconceptionTelemetry[];
  retention_forecast: RetentionForecast;
  activity_timeline: ActivityTimelinePoint[];
  concept_matrix: ConceptMatrixItem[];
  executive_summary: string;
}
