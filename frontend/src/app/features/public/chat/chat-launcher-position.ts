import { Injectable, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';

interface LauncherPos {
  right: number;
  bottom: number;
}

const LAUNCHER_SIZE = 56;
const MARGIN = 8;
const DRAG_THRESHOLD = 5;

/**
 * The draggable chat button: where it sits, dragging it, and where the chat
 * panel opens relative to it. The position is not saved, and moving to
 * another page puts the button back in its default corner. Provided by
 * ChatWidget.
 */
@Injectable()
export class ChatLauncherPosition {
  /** Distance from the viewport's right/bottom edges; null = default corner. */
  private readonly pos = signal<LauncherPos | null>(null);
  readonly dragging = signal(false);
  private readonly viewport = signal({ w: window.innerWidth, h: window.innerHeight });

  private drag: { startX: number; startY: number; right: number; bottom: number; moved: boolean } | null = null;
  private suppressClick = false;

  /** Launcher placement, kept inside the viewport. */
  readonly launcherStyle = computed(() => {
    const p = this.clamp(this.pos());
    return p ? { right: `${p.right}px`, bottom: `${p.bottom}px` } : null;
  });

  /** Opens the panel next to the launcher, above or below depending on where it sits. */
  readonly panelStyle = computed(() => {
    const p = this.clamp(this.pos());
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

  constructor() {
    inject(Router)
      .events.pipe(
        filter((e) => e instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe(() => this.pos.set(null));
  }

  onResize(): void {
    this.viewport.set({ w: window.innerWidth, h: window.innerHeight });
  }

  dragStart(event: PointerEvent): void {
    if (event.button !== 0) return;
    const current = this.clamp(this.pos()) ?? this.defaultPos();
    this.drag = { startX: event.clientX, startY: event.clientY, right: current.right, bottom: current.bottom, moved: false };
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  }

  dragMove(event: PointerEvent): void {
    const d = this.drag;
    if (!d) return;
    const dx = event.clientX - d.startX;
    const dy = event.clientY - d.startY;
    // Small movements stay clicks.
    if (!d.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
    d.moved = true;
    this.dragging.set(true);
    this.pos.set(this.clamp({ right: d.right - dx, bottom: d.bottom - dy }));
  }

  dragEnd(): void {
    const d = this.drag;
    this.drag = null;
    if (!d?.moved) return;
    this.dragging.set(false);
    // The click that follows a drag must not toggle the chat.
    this.suppressClick = true;
    setTimeout(() => (this.suppressClick = false));
  }

  /** True when a click is really the end of a drag (and should be ignored). */
  isDragClick(): boolean {
    return this.suppressClick;
  }

  private defaultPos(): LauncherPos {
    // Matches the CSS default (--space-4 = 1rem).
    const margin = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
    return { right: margin, bottom: margin };
  }

  private clamp(p: LauncherPos | null): LauncherPos | null {
    if (!p) return null;
    const { w, h } = this.viewport();
    return {
      right: Math.round(Math.min(Math.max(p.right, MARGIN), Math.max(MARGIN, w - LAUNCHER_SIZE - MARGIN))),
      bottom: Math.round(Math.min(Math.max(p.bottom, MARGIN), Math.max(MARGIN, h - LAUNCHER_SIZE - MARGIN))),
    };
  }
}
