/**
 * GSAP, loaded on first use with a dynamic import so it stays out of the
 * site's initial bundle. Later calls reuse the same download.
 */
type Gsap = typeof import('gsap').gsap;

let loading: Promise<Gsap> | undefined;

export function loadGsap(): Promise<Gsap> {
  loading ??= import('gsap').then((m) => m.gsap);
  return loading;
}

/** Visitors who asked their device for less motion get no animations. */
export function prefersReducedMotion(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}
