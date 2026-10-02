import { Component, ElementRef, Injector, afterNextRender, inject, input, output, signal, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';

import { Icon, IconName } from '../icon/icon';

export type MenuLink = string | readonly (string | number)[];

/** One entry of an actions menu. */
export interface MenuAction {
  id: string;
  icon: IconName;
  /** Visible text, e.g. "Delete". */
  text: string;
  /** Navigate instead of emitting (select). */
  link?: MenuLink;
  danger?: boolean;
}

/** Size of the menu, used to position it (matches actions-menu.scss). */
const MENU_WIDTH = 176;
const ITEM_HEIGHT = 40;

/**
 * A "⋮" button that opens a small actions menu (Edit, Delete, …).
 *
 *   <app-actions-menu
 *     [actions]="[{ id: 'edit', icon: 'edit', text: 'Edit' }, …]"
 *     [label]="'More actions for ' + skill.name"
 *     (select)="onAction($event, skill)"
 *   />
 *
 * The menu is position: fixed, so scroll containers cannot clip it. Arrow
 * keys move between items, Escape closes it and returns focus to the button,
 * and a click outside, scrolling or resizing closes it.
 */
@Component({
  selector: 'app-actions-menu',
  imports: [RouterLink, Icon],
  templateUrl: './actions-menu.html',
  styleUrl: './actions-menu.scss',
  host: {
    '(document:click)': 'onDocumentClick($event)',
    '(window:scroll)': 'close()',
    '(window:resize)': 'close()',
  },
})
export class ActionsMenu {
  private readonly injector = inject(Injector);

  readonly actions = input.required<MenuAction[]>();
  /** Accessible name of the ⋮ button, e.g. "More actions for Angular". */
  readonly label = input('More actions');
  readonly disabled = input(false);

  /** The id of the chosen action (actions without a link). */
  readonly select = output<string>();

  /** Fixed position of the open menu, or null when closed. */
  protected readonly position = signal<{ top: number; left: number } | null>(null);
  private readonly trigger = viewChild.required<ElementRef<HTMLButtonElement>>('trigger');
  private readonly menuEl = viewChild<ElementRef<HTMLElement>>('menu');

  protected toggle(): void {
    if (this.position()) {
      this.close();
      return;
    }
    // Opens below the button, or above it when there is no room below.
    const rect = this.trigger().nativeElement.getBoundingClientRect();
    const height = this.actions().length * ITEM_HEIGHT + 12;
    const top = rect.bottom + 4 + height <= window.innerHeight ? rect.bottom + 4 : Math.max(8, rect.top - 4 - height);
    const left = Math.max(8, Math.min(rect.right - MENU_WIDTH, window.innerWidth - MENU_WIDTH - 8));
    this.position.set({ top, left });
    afterNextRender(() => this.items()[0]?.focus(), { injector: this.injector });
  }

  close(returnFocus = false): void {
    if (!this.position()) return;
    this.position.set(null);
    if (returnFocus) this.trigger().nativeElement.focus();
  }

  protected choose(action: MenuAction): void {
    this.close(true);
    this.select.emit(action.id);
  }

  /** Arrow keys move between items; Escape closes and returns to the ⋮ button. */
  protected onKeydown(event: KeyboardEvent): void {
    const items = this.items();
    const index = items.indexOf(document.activeElement as HTMLElement);
    const focus = (i: number) => items[(i + items.length) % items.length]?.focus();
    switch (event.key) {
      case 'ArrowDown':
        focus(index + 1);
        break;
      case 'ArrowUp':
        focus(index - 1);
        break;
      case 'Home':
        focus(0);
        break;
      case 'End':
        focus(items.length - 1);
        break;
      case 'Escape':
        this.close(true);
        break;
      case 'Tab':
        this.close();
        return; // let Tab move focus normally
      default:
        return;
    }
    event.preventDefault();
  }

  /** A click anywhere outside the open menu (and its button) closes it. */
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as Node;
    if (
      !this.position() ||
      this.trigger().nativeElement.contains(target) ||
      this.menuEl()?.nativeElement.contains(target)
    ) {
      return;
    }
    this.close();
  }

  protected link(target: MenuLink): string | (string | number)[] {
    return typeof target === 'string' ? target : [...target];
  }

  private items(): HTMLElement[] {
    return [...(this.menuEl()?.nativeElement.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])];
  }
}
