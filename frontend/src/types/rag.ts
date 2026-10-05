export interface SourceCitation {
  chunk_id: string;
  document_id: string;
  document_name: string;
  file_type: 'pdf' | 'pptx' | 'video' | 'audio' | 'text';
  page_number?: number | null;
  slide_number?: number | null;
  timestamp_start?: string | null;
  timestamp_end?: string | null;
  topic?: string | null;
  snippet: string;
  score: number;
  semantic_score: number;
  keyword_score: number;
  citation_label: string;
}

export interface RAGQueryRequest {
  query: string;
  topic?: string;
  top_k?: number;
}

export interface RAGResponse {
  query: string;
  answer: string;
  course_id: string;
  citations: SourceCitation[];
  retrieved_count: number;
  grounded: boolean;
  model_used: string;
}

export interface RAGIndexStatus {
  course_id: string;
  total_chunks: number;
  indexed_chunks: number;
  embedding_dimension: number;
  embedding_model: string;
}
