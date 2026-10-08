import { Component, ElementRef, effect, inject, signal, viewChild } from '@angular/core';
import { Router, RouterLink } from '@angular/router';

import { Icon } from '../../../shared/components/icon/icon';
import { MarkdownPipe } from '../../../shared/pipes/markdown.pipe';
import { ChatLauncherPosition } from './chat-launcher-position';
import { ChatStore } from './chat.store';

/**
 * Floating "ask the portfolio" assistant. The conversation lives in
 * ChatStore and the draggable button in ChatLauncherPosition; this class
 * handles the DOM: opening/closing with focus, scrolling, the growing input
 * and in-app links inside answers.
 */
@Component({
  selector: 'app-chat-widget',
  imports: [RouterLink, Icon, MarkdownPipe],
  providers: [ChatStore, ChatLauncherPosition],
  templateUrl: './chat-widget.html',
  styleUrl: './chat-widget.scss',
  host: { '(window:resize)': 'position.onResize()' },
})
export class ChatWidget {
  protected readonly store = inject(ChatStore);
  protected readonly position = inject(ChatLauncherPosition);
  private readonly router = inject(Router);

  protected readonly open = signal(false);

  private readonly log = viewChild<ElementRef<HTMLElement>>('log');
  private readonly input = viewChild<ElementRef<HTMLTextAreaElement>>('input');
  private readonly launcherButton = viewChild<ElementRef<HTMLButtonElement>>('launcher');

  constructor() {
    // Keep the newest message in view while answers stream in.
    effect(() => {
      this.store.messages();
      if (this.open()) {
        requestAnimationFrame(() => {
          const el = this.log()?.nativeElement;
          if (el) el.scrollTop = el.scrollHeight;
        });
      }
    });
  }

  protected toggle(): void {
    if (this.position.isDragClick()) return;
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
    requestAnimationFrame(() => this.launcherButton()?.nativeElement.focus());
  }

  protected onInput(event: Event): void {
    const el = event.target as HTMLTextAreaElement;
    this.store.draft.set(el.value);
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

  protected send(text?: string): void {
    if (this.store.send(text)) {
      // Empty and shrink the input after sending.
      const el = this.input()?.nativeElement;
      if (el) {
        el.value = '';
        el.style.height = 'auto';
      }
    }
  }

  protected clear(): void {
    this.store.clear();
    this.input()?.nativeElement.focus();
  }

  /**
   * Links inside answers are plain <a href> (rendered Markdown). Site links
   * are routed by Angular instead of reloading the page.
   */
  protected onLogClick(event: MouseEvent): void {
    const anchor = (event.target as HTMLElement).closest('a');
    const href = anchor?.getAttribute('href');
    if (anchor && href && this.isInternal(href) && !anchor.target && !event.ctrlKey && !event.metaKey) {
      event.preventDefault();
      void this.router.navigateByUrl(href);
    }
  }

  protected isInternal(url: string): boolean {
    return url.startsWith('/') && !url.startsWith('//');
  }
}
