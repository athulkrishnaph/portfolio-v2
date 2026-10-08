import { DestroyRef, Injectable, computed, effect, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Subscription } from 'rxjs';

import { ApiError } from '../../../core/api/api-error';
import { ChatSource, ChatTurn } from '../../../core/models';
import { ChatService } from '../../../core/services/chat.service';
import { ProfileService } from '../../../core/services/profile.service';

/** One message in the chat window. */
export interface ChatMessage {
  id: number;
  role: 'user' | 'assistant';
  content: string;
  sources: ChatSource[];
  status: 'streaming' | 'done' | 'error';
  error?: string;
}

const STORAGE_KEY = 'portfolio.chat';
const MAX_STORED_MESSAGES = 30;
/** Earlier messages sent along for follow-up questions (the API keeps the last few). */
const HISTORY_TURNS = 6;

/**
 * The assistant's conversation: whether the chatbot is enabled, the
 * messages, sending a question and streaming its answer, retry and clear.
 * Finished messages are remembered for the browser tab (sessionStorage).
 * Provided by ChatWidget.
 */
@Injectable()
export class ChatStore {
  private readonly chat = inject(ChatService);
  private readonly profile = inject(ProfileService);

  private readonly status = toSignal(this.chat.status$, { initialValue: null });
  readonly enabled = computed(() => this.status()?.enabled === true);
  readonly maxChars = computed(() => this.status()?.maxMessageChars ?? 500);

  readonly messages = signal<ChatMessage[]>(restoreMessages());
  readonly draft = signal('');
  /** True while an answer is being generated (sending is disabled). */
  readonly busy = computed(() => this.messages().some((m) => m.status === 'streaming'));

  readonly ownerName = computed(() => this.profile.siteName() || 'this developer');
  private readonly firstName = computed(() => this.ownerName().split(' ')[0]);
  readonly suggestions = computed(() => [
    `What technologies does ${this.firstName()} use?`,
    'Tell me about the projects',
    `What work experience does ${this.firstName()} have?`,
    `How can I contact ${this.firstName()}?`,
  ]);

  private request?: Subscription;
  private nextId = Math.max(0, ...this.messages().map((m) => m.id)) + 1;

  constructor() {
    // Remember finished messages for this browser tab.
    effect(() => {
      const done = this.messages().filter((m) => m.status === 'done');
      try {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(done.slice(-MAX_STORED_MESSAGES)));
      } catch {
        /* storage unavailable: the chat just isn't remembered */
      }
    });

    inject(DestroyRef).onDestroy(() => this.request?.unsubscribe());
  }

  /**
   * Asks a question (the draft by default) and streams the answer in.
   * Returns false when nothing was sent (empty, or an answer is in progress).
   */
  send(text = this.draft()): boolean {
    const message = text.trim();
    if (!message || this.busy()) {
      return false;
    }
    // Earlier finished messages give follow-up questions their context.
    const history: ChatTurn[] = this.messages()
      .filter((m) => m.status === 'done')
      .slice(-HISTORY_TURNS)
      .map((m) => ({ role: m.role, content: m.content }));

    const answerId = this.nextId + 1;
    this.messages.update((list) => [
      ...list,
      { id: this.nextId, role: 'user', content: message, sources: [], status: 'done' },
      { id: answerId, role: 'assistant', content: '', sources: [], status: 'streaming' },
    ]);
    this.nextId += 2;
    this.draft.set('');

    this.request = this.chat.stream({ message, history }).subscribe({
      next: (event) => {
        if (event.type === 'sources') {
          this.updateMessage(answerId, (m) => ({ ...m, sources: event.sources }));
        } else {
          this.updateMessage(answerId, (m) => ({ ...m, content: m.content + event.text }));
        }
      },
      complete: () => this.updateMessage(answerId, (m) => ({ ...m, status: 'done' })),
      error: (err: unknown) =>
        this.updateMessage(answerId, (m) => ({
          ...m,
          status: 'error',
          error: ApiError.from(err).message,
        })),
    });
    return true;
  }

  /** Re-asks the question whose answer failed. */
  retry(failed: ChatMessage): void {
    const list = this.messages();
    const index = list.findIndex((m) => m.id === failed.id);
    const question = list[index - 1];
    if (!question || question.role !== 'user') {
      return;
    }
    this.messages.set(list.slice(0, index - 1));
    this.send(question.content);
  }

  /** Stops any answer in progress and forgets the conversation. */
  clear(): void {
    this.request?.unsubscribe();
    this.messages.set([]);
  }

  private updateMessage(id: number, change: (m: ChatMessage) => ChatMessage): void {
    this.messages.update((list) => list.map((m) => (m.id === id ? change(m) : m)));
  }
}

function restoreMessages(): ChatMessage[] {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as ChatMessage[]) : [];
    return Array.isArray(parsed) ? parsed.filter((m) => m && typeof m.content === 'string') : [];
  } catch {
    return [];
  }
}
