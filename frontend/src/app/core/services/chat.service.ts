import { Injectable, inject } from '@angular/core';
import { Observable, catchError, of, shareReplay } from 'rxjs';

import { ApiClient } from '../api/api-client';
import { ApiError } from '../api/api-error';
import {
  ApiErrorBody,
  ChatKnowledge,
  ChatRequest,
  ChatStatus,
  ChatStreamEvent,
  ReindexReport,
} from '../models';
import { SseParser } from '../utils/sse';

/**
 * Talks to the chatbot endpoints of the Go API. The browser never contacts
 * Gemini: questions go to /api/chat/stream, and only the Go server holds the
 * API key.
 */
@Injectable({ providedIn: 'root' })
export class ChatService {
  private readonly api = inject(ApiClient);

  /** Whether the chatbot is enabled on this site (cached; false on errors). */
  readonly status$: Observable<ChatStatus> = this.api.get<ChatStatus>('/api/chat/status').pipe(
    catchError(() => of({ enabled: false, maxMessageChars: 500 })),
    shareReplay({ bufferSize: 1, refCount: false }),
  );

  /**
   * Asks a question and emits the answer as it is generated: first the
   * sources, then pieces of text. Completes when the answer is finished;
   * errors are ApiErrors with a visitor-friendly message. Unsubscribing
   * cancels the request.
   *
   * fetch() is used instead of HttpClient/EventSource because the request is
   * a POST with a JSON body and the response must be read as it streams in.
   */
  stream(request: ChatRequest): Observable<ChatStreamEvent> {
    return new Observable<ChatStreamEvent>((subscriber) => {
      const controller = new AbortController();

      const run = async () => {
        let res: Response;
        try {
          res = await fetch('/api/chat/stream', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
            body: JSON.stringify(request),
            signal: controller.signal,
          });
        } catch {
          if (!controller.signal.aborted) {
            subscriber.error(
              new ApiError(0, 'NETWORK_ERROR', 'Cannot reach the server. Check your connection and try again.'),
            );
          }
          return;
        }

        if (!res.ok || !res.body) {
          subscriber.error(await errorFromResponse(res));
          return;
        }

        const parser = new SseParser((event, data) => {
          if (subscriber.closed) return;
          const payload = safeParse(data);
          switch (event) {
            case 'sources':
              subscriber.next({ type: 'sources', sources: Array.isArray(payload) ? payload : [] });
              break;
            case 'delta':
              subscriber.next({ type: 'delta', text: String((payload as { text?: string })?.text ?? '') });
              break;
            case 'done':
              subscriber.complete();
              break;
            case 'error': {
              const body = payload as Partial<ApiErrorBody> | null;
              subscriber.error(
                new ApiError(
                  200,
                  body?.code ?? 'CHAT_ERROR',
                  body?.message ?? 'Something went wrong. Please try again.',
                ),
              );
              break;
            }
          }
        });

        const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
        while (!subscriber.closed) {
          const { value, done } = await reader.read();
          if (done) break;
          parser.push(value);
        }
        parser.flush();
        if (!subscriber.closed) {
          // The connection ended without a "done" event.
          subscriber.error(
            new ApiError(0, 'STREAM_INTERRUPTED', 'The answer was interrupted. Please try again.'),
          );
        }
      };

      run().catch((err: unknown) => {
        if (!controller.signal.aborted && !subscriber.closed) {
          subscriber.error(ApiError.from(err));
        }
      });
      return () => controller.abort();
    });
  }

  // ---- Admin ----------------------------------------------------------------

  knowledge(): Observable<ChatKnowledge> {
    return this.api.get<ChatKnowledge>('/api/chat/knowledge');
  }

  /** Rebuilds the knowledge base from the current portfolio content. */
  reindex(full = false): Observable<ReindexReport> {
    return this.api.post<ReindexReport>(`/api/chat/reindex${full ? '?full=true' : ''}`, {});
  }
}

function safeParse(data: string): unknown {
  try {
    return JSON.parse(data);
  } catch {
    return null;
  }
}

async function errorFromResponse(res: Response): Promise<ApiError> {
  let body: { error?: ApiErrorBody } | null = null;
  try {
    body = (await res.json()) as { error?: ApiErrorBody };
  } catch {
    /* not JSON */
  }
  if (body?.error?.code) {
    return new ApiError(res.status, body.error.code, body.error.message, body.error.details ?? {});
  }
  if (res.status === 429) {
    return new ApiError(429, 'TOO_MANY_REQUESTS', 'You are sending questions too quickly. Please wait a moment.');
  }
  return new ApiError(res.status, 'HTTP_ERROR', 'The assistant is unavailable right now. Please try again later.');
}
