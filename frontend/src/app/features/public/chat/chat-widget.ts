import {
  Component,
  DestroyRef,
  ElementRef,
  computed,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';

import { ApiError } from '../../../core/api/api-error';
import { ChatSource, ChatTurn } from '../../../core/models';
import { ChatService } from '../../../core/services/chat.service';
import { ProfileService } from '../../../core/services/profile.service';
import { Icon } from '../../../shared/components/icon/icon';
import { MarkdownPipe } from '../../../shared/pipes/markdown.pipe';

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
 * Floating "ask the portfolio" assistant. Answers stream in from the Go API
 * (which retrieves portfolio content and asks Gemini); sources link to the
 * pages the answer is based on. Shown only when the API reports the chatbot
 * as enabled. The conversation survives page navigation and reloads within
 * the browser tab (sessionStorage).
 */
@Component({
  selector: 'app-chat-widget',
  imports: [RouterLink, Icon, MarkdownPipe],
  templateUrl: './chat-widget.html',
  styleUrl: './chat-widget.scss',
})
export class ChatWidget {
  private readonly chat = inject(ChatService);
  private readonly profile = inject(ProfileService);
  private readonly router = inject(Router);

  protected readonly status = toSignal(this.chat.status$, { initialValue: null });
  protected readonly enabled = computed(() => this.status()?.enabled === true);
  protected readonly maxChars = computed(() => this.status()?.maxMessageChars ?? 500);

  protected readonly open = signal(false);
  protected readonly messages = signal<ChatMessage[]>(restoreMessages());
  protected readonly draft = signal('');
  /** True while an answer is being generated (sending is disabled). */
  protected readonly busy = computed(() => this.messages().some((m) => m.status === 'streaming'));

  protected readonly ownerName = computed(() => this.profile.siteName() || 'this developer');
  private readonly firstName = computed(() => this.ownerName().split(' ')[0]);
  protected readonly suggestions = computed(() => [
    `What technologies does ${this.firstName()} use?`,
    'Tell me about the projects',
    `What work experience does ${this.firstName()} have?`,
    `How can I contact ${this.firstName()}?`,
  ]);

  private readonly log = viewChild<ElementRef<HTMLElement>>('log');
  private readonly input = viewChild<ElementRef<HTMLTextAreaElement>>('input');
  private readonly launcher = viewChild<ElementRef<HTMLButtonElement>>('launcher');

  private request?: Subscription;
  private nextId = Math.max(0, ...this.messages().map((m) => m.id)) + 1;

  constructor() {
    // Keep the newest message in view while answers stream in.
    effect(() => {
      this.messages();
      if (this.open()) {
        requestAnimationFrame(() => {
          const el = this.log()?.nativeElement;
          if (el) el.scrollTop = el.scrollHeight;
        });
      }
    });

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

  protected toggle(): void {
    if (this.open()) {
      this.close();
    } else {
      this.open.set(true);
      requestAnimationFrame(() => this.input()?.nativeElement.focus());
    }
  }

  protected close(): void {
    this.open.set(false);
    // Return keyboard focus to the button that opened the chat.
    requestAnimationFrame(() => this.launcher()?.nativeElement.focus());
  }

  protected onInput(event: Event): void {
    const el = event.target as HTMLTextAreaElement;
    this.draft.set(el.value);
    // Grow with the text, up to the max-height set in CSS.
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }

  /** Enter sends; Shift+Enter inserts a new line. */
  protected onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
      event.preventDefault();
      this.send();
    }
  }

  protected send(text = this.draft()): void {
    const message = text.trim();
    if (!message || this.busy()) {
      return;
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
    const el = this.input()?.nativeElement;
    if (el) {
      el.value = '';
      el.style.height = 'auto';
    }

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
  }

  /** Re-asks the question whose answer failed. */
  protected retry(failed: ChatMessage): void {
    const list = this.messages();
    const index = list.findIndex((m) => m.id === failed.id);
    const question = list[index - 1];
    if (!question || question.role !== 'user') {
      return;
    }
    this.messages.set(list.slice(0, index - 1));
    this.send(question.content);
  }

  protected clear(): void {
    this.request?.unsubscribe();
    this.messages.set([]);
    this.input()?.nativeElement.focus();
  }

  /**
   * Links inside answers are plain <a href> (rendered Markdown). Site links
   * are routed by Angular instead of reloading the page.
   */
  protected onLogClick(event: MouseEvent): void {
    const anchor = (event.target as HTMLElement).closest('a');
    const href = anchor?.getAttribute('href');
    if (anchor && href?.startsWith('/') && !href.startsWith('//') && !anchor.target && !event.ctrlKey && !event.metaKey) {
      event.preventDefault();
      void this.router.navigateByUrl(href);
    }
  }

  protected isInternal(url: string): boolean {
    return url.startsWith('/') && !url.startsWith('//');
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
