/**
 * Type definitions for Grounded Flashcards and Spaced Repetition System (SRS).
 */

export interface Flashcard {
  id: string;
  deck_id?: string | null;
  course_id: string;
  user_id: string;
  front: string;
  back: string;
  hint?: string | null;
  topic?: string | null;
  bloom_level: string;

  // Grounding Coordinates
  citation_label?: string | null;
  document_name?: string | null;
  page_number?: number | null;
  slide_number?: number | null;
  timestamp_start?: string | null;
  timestamp_end?: string | null;
  source_snippet?: string | null;

  // SM-2 State
  repetitions: number;
  interval_days: number;
  ease_factor: number;
  next_review_at: string;
  last_reviewed_at?: string | null;
  total_reviews: number;
  lapses: number;
  is_due: boolean;

  created_at: string;
  updated_at: string;
}

export interface FlashcardCreatePayload {
  deck_id?: string | null;
  topic?: string | null;
  front: string;
  back: string;
  hint?: string | null;
  bloom_level?: string;
  citation_label?: string | null;
  document_name?: string | null;
  page_number?: number | null;
  slide_number?: number | null;
  timestamp_start?: string | null;
  timestamp_end?: string | null;
  source_snippet?: string | null;
}

export interface FlashcardGeneratePayload {
  topic?: string | null;
  num_cards: number;
  target_weak_concepts: boolean;
  deck_title?: string | null;
}

export interface FlashcardReviewPayload {
  quality: number; // 0 to 5
}

export interface FlashcardReviewResult {
  card_id: string;
  repetitions: number;
  interval_days: number;
  ease_factor: number;
  next_review_at: string;
  quality: number;
  is_successful: boolean;
  bkt_synced: boolean;
  card: Flashcard;
}

export interface FlashcardDeck {
  id: string;
  course_id: string;
  user_id: string;
  title: string;
  description?: string | null;
  cards_count: number;
  cards_due_count: number;
  created_at: string;
  updated_at: string;
}

export interface FlashcardDeckCreatePayload {
  title: string;
  description?: string | null;
}

export interface TopicBreakdown {
  total: number;
  due: number;
  retention_rate: number;
}

export interface SRSStats {
  total_cards: number;
  cards_due_today: number;
  cards_learning: number; // repetitions <= 1
  cards_reviewing: number; // repetitions > 1 and < 5
  cards_mastered: number; // repetitions >= 5
  average_ease_factor: number;
  retention_rate: number;
  total_reviews: number;
  total_lapses: number;
  topics_breakdown: Record<string, TopicBreakdown>;
}
