import { DestroyRef, Directive, ElementRef, afterNextRender, inject, input } from '@angular/core';

import { loadGsap, prefersReducedMotion } from './gsap';

/**
 * '' = the element rises in · 'stagger' = its children rise in one after
 * another · 'zoom' = the element fades in while scaling up slightly.
 */
export type IntroMode = '' | 'stagger' | 'zoom';

// Subtle and quick.
const DURATION = 0.4; // seconds per element
const DISTANCE = 12; // px risen
const STAGGER_EACH = 0.08; // seconds between children
const MAX_STAGGER = 0.4; // long lists never take longer than this in total

/**
 * Short GSAP entrance used across the public pages. Content that is on
 * screen when the page opens plays right away; content further down plays
 * when it scrolls into view. Each element animates once.
 *
 *   <header class="page-intro" appIntro="stagger">…</header>
 *   <div class="grid" appIntro="stagger" [introDelay]="0.15">…</div>
 *   <img appIntro="zoom" … />
 *
 * The hidden starting state comes from CSS (styles/_animations.scss), so
 * nothing flashes before GSAP loads. With reduced motion, or if GSAP cannot
 * load, content is simply shown.
 */
@Directive({
  selector: '[appIntro]',
  host: {
    '[class.intro]': 'animate',
    '[class.intro--stagger]': 'animate && mode() === "stagger"',
  },
})
export class IntroDirective {
  readonly mode = input<IntroMode>('', { alias: 'appIntro' });
  /** Seconds to wait before playing (to follow other elements). */
  readonly introDelay = input(0);

  private readonly el = inject(ElementRef<HTMLElement>).nativeElement as HTMLElement;
  protected readonly animate = !prefersReducedMotion();
  private tween?: { kill(): void };

  constructor() {
    if (!this.animate) {
      return;
    }
    let observer: IntersectionObserver | undefined;
    afterNextRender(() => {
      if (typeof IntersectionObserver !== 'function') {
        void this.play();
        return;
      }
      observer = new IntersectionObserver(
        (entries) => {
          if (entries.some((e) => e.isIntersecting)) {
            observer?.disconnect();
            void this.play();
          }
        },
        { rootMargin: '0px 0px -5% 0px' },
      );
      observer.observe(this.el);
    });
    inject(DestroyRef).onDestroy(() => {
      observer?.disconnect();
      this.tween?.kill();
    });
  }

  private async play(): Promise<void> {
    let gsap: Awaited<ReturnType<typeof loadGsap>>;
    try {
      gsap = await loadGsap();
    } catch {
      this.el.classList.add('is-intro-done'); // no GSAP: just show it
      return;
    }
    if (!this.el.isConnected) {
      return;
    }

    const mode = this.mode();
    const targets = mode === 'stagger' ? Array.from(this.el.children) : [this.el];
    const from = mode === 'zoom' ? { autoAlpha: 0, scale: 0.96 } : { autoAlpha: 0, y: DISTANCE };
    const to = mode === 'zoom' ? { autoAlpha: 1, scale: 1 } : { autoAlpha: 1, y: 0 };

    // fromTo sets the start values inline straight away, so the CSS hiding
    // can be lifted (is-intro-done) without a flash.
    this.tween = gsap.fromTo(targets, from, {
      ...to,
      duration: mode === 'zoom' ? DURATION + 0.1 : DURATION,
      ease: 'power2.out',
      delay: this.introDelay(),
      stagger: targets.length > 1 ? Math.min(STAGGER_EACH, MAX_STAGGER / (targets.length - 1)) : 0,
      clearProps: 'opacity,visibility,transform',
    });
    this.el.classList.add('is-intro-done');
  }
}
