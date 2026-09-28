import { DOCUMENT } from '@angular/common';
import { Injectable, computed, effect, inject, signal } from '@angular/core';

export type ThemeId =
  | 'system'
  | 'light'
  | 'dark'
  | 'ocean'
  | 'forest'
  | 'dracula'
  | 'sunset'
  | 'rose';

/** A selectable colour theme. The CSS for each lives in styles/_tokens.scss. */
export interface ThemeOption {
  id: ThemeId;
  label: string;
  /** Background + accent colours for the little preview dot in the picker. */
  swatch: [background: string, accent: string];
  /** Whether it is a dark theme ('system' depends on the OS). */
  dark: boolean | 'system';
}

export const THEMES: readonly ThemeOption[] = [
  { id: 'system', label: 'System', swatch: ['#f8fafc', '#0b1120'], dark: 'system' },
  { id: 'light', label: 'Light', swatch: ['#f8fafc', '#4f46e5'], dark: false },
  { id: 'dark', label: 'Dark', swatch: ['#0b1120', '#818cf8'], dark: true },
  { id: 'ocean', label: 'Ocean', swatch: ['#0a1622', '#38bdf8'], dark: true },
  { id: 'forest', label: 'Forest', swatch: ['#0b140f', '#4ade80'], dark: true },
  { id: 'dracula', label: 'Dracula', swatch: ['#282a36', '#bd93f9'], dark: true },
  { id: 'sunset', label: 'Sunset', swatch: ['#fffaf5', '#c2410c'], dark: false },
  { id: 'rose', label: 'Rose', swatch: ['#fff7f9', '#e11d48'], dark: false },
];

/** Key shared with the inline script in index.html (applies the theme before Angular starts). */
const STORAGE_KEY = 'portfolio.theme';

/**
 * The visitor's colour theme, remembered in localStorage.
 * 'system' follows the OS light/dark setting (pure CSS); every other theme
 * sets <html data-theme="...">.
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly document = inject(DOCUMENT);

  readonly themes: readonly ThemeOption[] = THEMES;
  readonly theme = signal<ThemeId>(readStoredTheme());
  readonly current = computed(() => THEMES.find((t) => t.id === this.theme()) ?? THEMES[0]);

  constructor() {
    effect(() => {
      const theme = this.theme();
      const root = this.document.documentElement;
      if (theme === 'system') {
        root.removeAttribute('data-theme');
      } else {
        root.setAttribute('data-theme', theme);
      }
      try {
        localStorage.setItem(STORAGE_KEY, theme);
      } catch {
        /* storage unavailable: the choice lasts for this visit only */
      }
    });
  }

  set(theme: ThemeId): void {
    this.theme.set(theme);
  }

  /** Whether the theme shown right now is dark. */
  isDark(): boolean {
    const dark = this.current().dark;
    if (dark !== 'system') {
      return dark;
    }
    return this.document.defaultView?.matchMedia('(prefers-color-scheme: dark)').matches ?? false;
  }
}

function readStoredTheme(): ThemeId {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return THEMES.find((t) => t.id === stored)?.id ?? 'system';
  } catch {
    return 'system';
  }
}
