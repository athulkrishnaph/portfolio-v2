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
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { Subscription, filter } from 'rxjs';

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
const LAUNCHER_SIZE = 56;
const MARGIN = 8;
const DRAG_THRESHOLD = 5;

interface LauncherPos {
  right: number;
  bottom: number;
}
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
  host: { '(window:resize)': 'onResize()' },
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

  /** Launcher distance from the viewport's right/bottom edges; null = default corner. Not saved, so a reload resets it. */
  protected readonly pos = signal<LauncherPos | null>(null);
  protected readonly dragging = signal(false);
  private readonly viewport = signal({ w: window.innerWidth, h: window.innerHeight });

  /** Launcher placement, kept inside the viewport. */
  protected readonly launcherStyle = computed(() => {
    const p = this.clampPos(this.pos());
    return p ? { right: `${p.right}px`, bottom: `${p.bottom}px` } : null;
  });

  /** Opens the panel next to the launcher, above or below depending on where it sits. */
  protected readonly panelStyle = computed(() => {
    const p = this.clampPos(this.pos());
    if (!p) return null;
    const { w, h } = this.viewport();
    const panelWidth = Math.min(400, w - 32);
    const right = Math.min(p.right, Math.max(MARGIN, w - panelWidth - MARGIN));
    const gap = LAUNCHER_SIZE + 12;
    const style: Record<string, string> = { '--chat-right': `${right}px` };
    if (p.bottom + LAUNCHER_SIZE / 2 < h / 2) {
      const bottom = p.bottom + gap;
      style['--chat-bottom'] = `${bottom}px`;
      style['--chat-top'] = 'auto';
      style['--chat-height'] = `${Math.min(620, h - bottom - MARGIN)}px`;
    } else {
      const top = h - p.bottom - LAUNCHER_SIZE + gap;
      style['--chat-top'] = `${top}px`;
      style['--chat-bottom'] = 'auto';
      style['--chat-height'] = `${Math.min(620, h - top - MARGIN)}px`;
    }
    return style;
  });

  private drag: { startX: number; startY: number; right: number; bottom: number; moved: boolean } | null = null;
  private suppressClick = false;
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

    // Moving to another page puts the button back in its default corner.
    this.router.events
      .pipe(filter((e) => e instanceof NavigationEnd), takeUntilDestroyed())
      .subscribe(() => this.pos.set(null));

    inject(DestroyRef).onDestroy(() => this.request?.unsubscribe());
  }

  protected onResize(): void {
    this.viewport.set({ w: window.innerWidth, h: window.innerHeight });
  }

  protected onDragStart(event: PointerEvent): void {
    if (event.button !== 0) return;
    const current = this.clampPos(this.pos()) ?? this.defaultPos();
    this.drag = {
      startX: event.clientX,
      startY: event.clientY,
      right: current.right,
      bottom: current.bottom,
      moved: false,
    };
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  }

  protected onDragMove(event: PointerEvent): void {
    const d = this.drag;
    if (!d) return;
    const dx = event.clientX - d.startX;
    const dy = event.clientY - d.startY;
    // Small movements stay clicks.
    if (!d.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
    d.moved = true;
    this.dragging.set(true);
    this.pos.set(this.clampPos({ right: d.right - dx, bottom: d.bottom - dy }));
  }

  protected onDragEnd(): void {
    const d = this.drag;
    this.drag = null;
    if (!d?.moved) return;
    this.dragging.set(false);
    // The click that follows a drag must not toggle the chat.
    this.suppressClick = true;
    setTimeout(() => (this.suppressClick = false));
  }

  private defaultPos(): LauncherPos {
    // Matches the CSS default (--space-4 = 1rem).
    const margin = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
    return { right: margin, bottom: margin };
  }

  private clampPos(p: LauncherPos | null): LauncherPos | null {
    if (!p) return null;
    const { w, h } = this.viewport();
    return {
      right: Math.round(Math.min(Math.max(p.right, MARGIN), Math.max(MARGIN, w - LAUNCHER_SIZE - MARGIN))),
      bottom: Math.round(Math.min(Math.max(p.bottom, MARGIN), Math.max(MARGIN, h - LAUNCHER_SIZE - MARGIN))),
    };
  }

  protected toggle(): void {
    if (this.suppressClick) return;
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
