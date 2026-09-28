/** A citation returned with an answer: the portfolio item it is based on. */
export interface ChatSource {
  title: string;
  /** projects, experience, education, certificates, skills, profile, contact, resume, … */
  source: string;
  /** A page of this site (e.g. /projects/task-flow) or an external URL (the resume PDF). */
  url: string;
}

/** An earlier message, sent back so follow-up questions have context. */
export interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatRequest {
  message: string;
  history: ChatTurn[];
}

export interface ChatStatus {
  enabled: boolean;
  maxMessageChars: number;
}

/** Events of POST /api/chat/stream (Server-Sent Events). */
export type ChatStreamEvent =
  | { type: 'sources'; sources: ChatSource[] }
  | { type: 'delta'; text: string };

/** Admin: what the chatbot knows. */
export interface ChatKnowledge {
  enabled: boolean;
  /** Why the chatbot is disabled (admin only). */
  reason?: string;
  chunks?: number;
  lastIndexedAt?: string | null;
  model?: string;
  embeddingModel?: string;
}

/** Admin: result of rebuilding the knowledge base. */
export interface ReindexReport {
  chunks: number;
  embedded: number;
  unchanged: number;
  deleted: number;
  warnings: string[] | null;
  duration: string;
}
