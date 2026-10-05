// Phase 9 — Bayesian Knowledge Tracing & Learner Mastery types

export type MasteryStatus = 'mastered' | 'developing' | 'needs_work' | 'not_started';

export interface ConceptMastery {
  id: string;
  user_id: string;
  course_id: string;
  concept_label: string;

  // BKT State
  p_know: number;           // Current P(L) — 0.0 to 1.0
  p_learn: number;          // P(T) — transition probability
  p_guess: number;          // P(G) — guessing probability
  p_slip: number;           // P(S) — slipping probability
  mastery_threshold: number;

  // Evidence
  total_attempts: number;
  correct_attempts: number;
  is_mastered: boolean;
  priority_score: number;

  // Trend sparkline
  p_know_history: number[];

  // Derived
  mastery_percentage: number;
  accuracy_rate: number;
  mastery_status: MasteryStatus;

  last_updated: string;
  created_at: string;
}

export interface CourseMastery {
  course_id: string;
  total_concepts: number;
  mastered_concepts: number;
  overall_mastery_percentage: number;
  concepts: ConceptMastery[];
}

export interface AdaptiveRecommendation {
  concept_label: string;
  p_know: number;
  mastery_status: MasteryStatus;
  priority_score: number;
  reason: string;
  recommended_bloom_levels: string[];
  estimated_questions_to_mastery: number;
}

export interface AdaptiveRecommendationsResponse {
  course_id: string;
  overall_mastery_percentage: number;
  recommendations: AdaptiveRecommendation[];
  mastered_count: number;
  total_count: number;
}

// UI display helpers

export const MASTERY_STATUS_CONFIG: Record<MasteryStatus, {
  label: string;
  color: string;
  bg: string;
  border: string;
  icon: string;
  gradient: string;
}> = {
  mastered: {
    label: 'Mastered',
    color: '#10b981',
    bg: 'rgba(16, 185, 129, 0.15)',
    border: 'rgba(16, 185, 129, 0.4)',
    icon: '✓',
    gradient: 'linear-gradient(135deg, #10b981, #059669)',
  },
  developing: {
    label: 'Developing',
    color: '#f59e0b',
    bg: 'rgba(245, 158, 11, 0.15)',
    border: 'rgba(245, 158, 11, 0.4)',
    icon: '◑',
    gradient: 'linear-gradient(135deg, #f59e0b, #d97706)',
  },
  needs_work: {
    label: 'Needs Work',
    color: '#ef4444',
    bg: 'rgba(239, 68, 68, 0.15)',
    border: 'rgba(239, 68, 68, 0.4)',
    icon: '!',
    gradient: 'linear-gradient(135deg, #ef4444, #dc2626)',
  },
  not_started: {
    label: 'Not Started',
    color: '#6b7280',
    bg: 'rgba(107, 114, 128, 0.10)',
    border: 'rgba(107, 114, 128, 0.3)',
    icon: '○',
    gradient: 'linear-gradient(135deg, #6b7280, #4b5563)',
  },
};

export const BLOOM_LEVEL_COLORS: Record<string, string> = {
  remember:   '#8b5cf6',
  understand: '#3b82f6',
  apply:      '#06b6d4',
  analyze:    '#10b981',
  evaluate:   '#f59e0b',
  create:     '#ef4444',
};
