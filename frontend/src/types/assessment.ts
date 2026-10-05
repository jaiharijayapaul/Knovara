export type BloomLevel = 
  | 'remember'
  | 'understand'
  | 'apply'
  | 'analyze'
  | 'evaluate'
  | 'create';

export type QuestionType = 
  | 'multiple_choice'
  | 'multiple_select'
  | 'true_false'
  | 'short_answer';

export type AssessmentDifficulty = 
  | 'easy'
  | 'medium'
  | 'hard'
  | 'adaptive';

export interface BloomLevelMeta {
  level: BloomLevel;
  label: string;
  badge: string;
  rank: number;
  description: string;
  colorClass: string;
  bgLightClass: string;
  borderClass: string;
  tagClass: string;
}

export const BLOOM_LEVELS: Record<BloomLevel, BloomLevelMeta> = {
  remember: {
    level: 'remember',
    label: '1. Remember',
    badge: 'Factual Recall',
    rank: 1,
    description: 'Recalls facts, basic mathematical definitions, and canonical formulas.',
    colorClass: 'text-sky-400',
    bgLightClass: 'bg-sky-500/10',
    borderClass: 'border-sky-500/30',
    tagClass: 'bg-sky-500/20 text-sky-300 border-sky-500/40',
  },
  understand: {
    level: 'understand',
    label: '2. Understand',
    badge: 'Conceptual Grasp',
    rank: 2,
    description: 'Explains ideas, principles, and causes of behavior without superficial memorization.',
    colorClass: 'text-teal-400',
    bgLightClass: 'bg-teal-500/10',
    borderClass: 'border-teal-500/30',
    tagClass: 'bg-teal-500/20 text-teal-300 border-teal-500/40',
  },
  apply: {
    level: 'apply',
    label: '3. Apply',
    badge: 'Procedural Application',
    rank: 3,
    description: 'Executes computations, partitions nodes, and applies formulas to novel concrete scenarios.',
    colorClass: 'text-emerald-400',
    bgLightClass: 'bg-emerald-500/10',
    borderClass: 'border-emerald-500/30',
    tagClass: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
  },
  analyze: {
    level: 'analyze',
    label: '4. Analyze',
    badge: 'Structural Analysis',
    rank: 4,
    description: 'Differentiates metrics (e.g. Gini vs Entropy), examines trade-offs, and decomposes bias/variance.',
    colorClass: 'text-amber-400',
    bgLightClass: 'bg-amber-500/10',
    borderClass: 'border-amber-500/30',
    tagClass: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
  },
  evaluate: {
    level: 'evaluate',
    label: '5. Evaluate',
    badge: 'Critical Appraisal',
    rank: 5,
    description: 'Appraises modeling proposals, diagnoses overfitting vs underfitting, and justifies interventions.',
    colorClass: 'text-rose-400',
    bgLightClass: 'bg-rose-500/10',
    borderClass: 'border-rose-500/30',
    tagClass: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
  },
  create: {
    level: 'create',
    label: '6. Create',
    badge: 'Algorithmic Synthesis',
    rank: 6,
    description: 'Synthesizes new split criteria, formulates objective regularizations, and designs architectures.',
    colorClass: 'text-purple-400',
    bgLightClass: 'bg-purple-500/10',
    borderClass: 'border-purple-500/30',
    tagClass: 'bg-purple-500/20 text-purple-300 border-purple-500/40',
  },
};

export interface QuestionOption {
  id: string;
  text: string;
  is_correct?: boolean;
  misconception?: string | null;
}

export interface Question {
  id: string;
  assessment_id: string;
  course_id: string;
  topic?: string | null;
  bloom_level: BloomLevel;
  difficulty: string;
  question_type: QuestionType;
  question_text: string;
  options: QuestionOption[];
  correct_answers?: string[];
  explanation?: string;
  points: number;
  order_index: number;
  citation_label?: string | null;
  document_name?: string | null;
  page_number?: number | null;
  slide_number?: number | null;
  timestamp_start?: string | null;
  timestamp_end?: string | null;
  source_snippet?: string | null;
  created_at?: string;
}

export interface Assessment {
  id: string;
  course_id: string;
  user_id: string;
  title: string;
  description?: string | null;
  topic?: string | null;
  difficulty: string;
  is_adaptive?: boolean;
  time_limit_minutes?: number | null;
  total_points: number;
  pass_percentage: number;
  status: string;
  questions_count: number;
  created_at: string;
  updated_at: string;
}

export interface AssessmentDetail extends Assessment {
  questions: Question[];
}

export interface AssessmentGeneratePayload {
  title?: string;
  topic?: string;
  num_questions: number;
  difficulty: AssessmentDifficulty;
  bloom_levels?: BloomLevel[];
  question_types?: QuestionType[];
  adaptive_mode?: boolean;
}

export type ErrorCategory =
  | 'factual_misconception'
  | 'procedural_slip'
  | 'formula_inversion'
  | 'dimensionality_confusion'
  | 'unchecked_assumption'
  | 'none';

export interface ErrorTaxonomyMeta {
  category: ErrorCategory;
  title: string;
  shortLabel: string;
  description: string;
  badgeClass: string;
  borderClass: string;
  bgLightClass: string;
  textClass: string;
}

export const ERROR_TAXONOMY_META: Record<ErrorCategory, ErrorTaxonomyMeta> = {
  factual_misconception: {
    category: 'factual_misconception',
    title: 'Factual Misconception',
    shortLabel: 'Factual Error',
    description: 'Direct contradiction of core definitions, axioms, or foundational course facts.',
    badgeClass: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
    borderClass: 'border-rose-500/40',
    bgLightClass: 'bg-rose-500/10',
    textClass: 'text-rose-400',
  },
  procedural_slip: {
    category: 'procedural_slip',
    title: 'Procedural / Computation Slip',
    shortLabel: 'Procedural Slip',
    description: 'Execution or calculation error (arithmetic, unweighted averaging, sign flip) despite correct concept.',
    badgeClass: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
    borderClass: 'border-amber-500/40',
    bgLightClass: 'bg-amber-500/10',
    textClass: 'text-amber-400',
  },
  formula_inversion: {
    category: 'formula_inversion',
    title: 'Formula Inversion',
    shortLabel: 'Formula Inversion',
    description: 'Numerator/denominator swap, inverted optimization target, or inverted trade-off.',
    badgeClass: 'bg-purple-500/20 text-purple-300 border-purple-500/40',
    borderClass: 'border-purple-500/40',
    bgLightClass: 'bg-purple-500/10',
    textClass: 'text-purple-400',
  },
  dimensionality_confusion: {
    category: 'dimensionality_confusion',
    title: 'Dimensionality / Cardinality Confusion',
    shortLabel: 'Dimensionality Error',
    description: 'Confusing feature dimensions, batch sizes, sample counts, or matrix rank.',
    badgeClass: 'bg-sky-500/20 text-sky-300 border-sky-500/40',
    borderClass: 'border-sky-500/40',
    bgLightClass: 'bg-sky-500/10',
    textClass: 'text-sky-400',
  },
  unchecked_assumption: {
    category: 'unchecked_assumption',
    title: 'Unchecked Assumption / Overfitting Fallacy',
    shortLabel: 'Unchecked Assumption',
    description: 'Assuming zero training error generalizes, ignoring sample independence, or overlooking variance.',
    badgeClass: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
    borderClass: 'border-emerald-500/40',
    bgLightClass: 'bg-emerald-500/10',
    textClass: 'text-emerald-400',
  },
  none: {
    category: 'none',
    title: 'Correct Response',
    shortLabel: 'Correct',
    description: 'Answer demonstrated accurate mastery of the concept and problem.',
    badgeClass: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
    borderClass: 'border-emerald-500/40',
    bgLightClass: 'bg-emerald-500/10',
    textClass: 'text-emerald-400',
  },
};

export interface QuestionSubmitItem {
  question_id: string;
  selected_answers: string[];
}

export interface AssessmentSubmitRequest {
  time_spent_seconds: number;
  answers?: Record<string, string[] | string>;
  responses?: QuestionSubmitItem[];
}

export interface QuestionResultResponse {
  question_id: string;
  order_index: number;
  bloom_level: BloomLevel;
  points_earned: number;
  points_possible: number;
  is_correct: boolean;
  selected_answers: string[];
  correct_answers: string[];
  error_category: ErrorCategory;
  misconception_diagnosis?: string | null;
  remediation_hint?: string | null;
  explanation?: string | null;
  citation_label?: string | null;
  document_name?: string | null;
  source_snippet?: string | null;
}

export interface AssessmentAttempt {
  id: string;
  assessment_id: string;
  user_id: string;
  score: number;
  total_points: number;
  percentage: number;
  passed: boolean;
  time_spent_seconds: number;
  error_summary: Record<string, number>;
  bloom_summary: Record<string, { correct: number; total: number; percentage: number }>;
  created_at: string;
}

export interface AssessmentAttemptDetail extends AssessmentAttempt {
  question_results: QuestionResultResponse[];
}
