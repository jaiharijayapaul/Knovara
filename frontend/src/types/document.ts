export type FileType = 'pdf' | 'pptx' | 'video' | 'audio' | 'text';

export type ProcessingStatus = 'UPLOADED' | 'PROCESSING' | 'COMPLETED' | 'FAILED';

export interface DocumentChunk {
  id: string;
  document_id: string;
  course_id: string;
  content: string;
  chunk_index: number;
  page_number?: number | null;
  slide_number?: number | null;
  timestamp_start?: string | null;
  timestamp_end?: string | null;
  topic?: string | null;
  created_at: string;
}

export interface DocumentItem {
  id: string;
  course_id: string;
  filename: string;
  file_type: FileType;
  file_size: number;
  processing_status: ProcessingStatus;
  processing_error?: string | null;
  chunks_count: number;
  ai_notes?: string | null;
  created_at: string;
  updated_at: string;
}

export interface DocumentDetail extends DocumentItem {
  chunks: DocumentChunk[];
}
