export interface Book {
  id: string;
  title: string;
  author: string | null;
  pageCount: number;
  hasCover: boolean;
  createdAt: string;
  currentPage: number | null;
  lastReadAt: string | null;
}

export interface BookList {
  items: Book[];
  total: number;
  page: number;
  pageSize: number;
}

// CurrentPage is 1-based. Block/segment indices and UTF-16 offsets are 0-based.
export interface ReadingPosition {
  currentPage: number;
  currentBlockIndex?: number | null;
  currentSegmentIndex?: number | null;
  characterOffset?: number | null; // Stored only; never used to select/slice a segment.
  structureVersion?: number | null;
}

export interface DocumentSegment {
  index: number;
  text: string;
  startOffset: number;
  endOffset: number; // Exclusive offset in canonical block text.
}

export interface DocumentBlock {
  index: number;
  type: string;
  bounds: { x: number; y: number; width: number; height: number };
  text: string;
  segments: DocumentSegment[];
}

export interface DocumentPage {
  pageNumber: number;
  structureVersion: number;
  width: number;
  height: number;
  blocks: DocumentBlock[];
}

export interface DocumentStructure {
  status: 'Pending' | 'Processing' | 'Ready' | 'NoText' | 'Failed';
  structureVersion: number;
  parserName: string;
  completedPageCount: number;
  errorMessage: string | null;
}

export interface ResumeSegment {
  position: ReadingPosition;
  segment: DocumentSegment | null;
}

export interface BookSummaryStatus {
  status: 'Unavailable' | 'Pending' | 'Processing' | 'RateLimited' | 'Ready' | 'Failed';
  totalChunks: number;
  completedChunks: number;
  errorMessage: string | null;
  nextAttemptAt: string | null;
}

export interface BookSummaryResult {
  content: string;
  completedAt: string;
}
