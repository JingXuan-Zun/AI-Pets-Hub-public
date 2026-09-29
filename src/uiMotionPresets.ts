/* @license SPDX-License-Identifier: Apache-2.0 */

import { gsap } from 'gsap';

/**
 * GSAP motion presets — derived from the UI/UX Pro Max design system
 * (design-system/ai-desktop-pet/MASTER.md, Motion dial 3/10 = Subtle).
 *
 * Rules applied (quick-reference §7):
 * - durations 200–400ms, power1/power2 ease, small offsets (8–16px)
 * - transform/opacity only (no layout properties)
 * - prefers-reduced-motion disables non-essential motion
 * - exit faster than enter (panel close handled by unmount, no block)
 */

export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** Panel/dialog entrance: subtle scale + fade from below-center (220ms). */
export function animatePanelEnter(element: HTMLElement) {
  if (prefersReducedMotion()) {
    return;
  }
  gsap.fromTo(
    element,
    { opacity: 0, scale: 0.975, y: 6 },
    { opacity: 1, scale: 1, y: 0, duration: 0.22, ease: 'power2.out', clearProps: 'transform', overwrite: 'auto' },
  );
}

/** Tab/page content switch: small upward fade (240ms, optional stagger delay). */
export function animateContentIn(element: HTMLElement, delay = 0) {
  if (prefersReducedMotion()) {
    return;
  }
  gsap.fromTo(
    element,
    { opacity: 0, y: 8 },
    { opacity: 1, y: 0, duration: 0.24, delay, ease: 'power1.out', clearProps: 'transform', overwrite: 'auto' },
  );
}

/**
 * List stagger reveal — skill preset "Stagger List / Subtle":
 * gsap.from('.list-item', { opacity: 0, y: 8, duration: 0.3, stagger: 0.03 }).
 * Select items with a stable selector, not array index (React re-renders).
 */
export function animateStaggerReveal(container: HTMLElement, selector: string) {
  if (prefersReducedMotion()) {
    return;
  }
  const items = container.querySelectorAll<HTMLElement>(selector);
  if (!items.length) {
    return;
  }
  gsap.fromTo(
    items,
    { opacity: 0, y: 8 },
    { opacity: 1, y: 0, duration: 0.3, stagger: 0.03, ease: 'power1.out', clearProps: 'transform', overwrite: 'auto' },
  );
}

/** Press feedback for buttons/cards: 0.97 scale (80ms down, 180ms spring back). */
export function animatePressDown(element: HTMLElement) {
  if (prefersReducedMotion()) {
    return;
  }
  gsap.to(element, { scale: 0.97, duration: 0.08, ease: 'power1.out', overwrite: 'auto' });
}

export function animatePressUp(element: HTMLElement) {
  if (prefersReducedMotion()) {
    return;
  }
  gsap.to(element, { scale: 1, duration: 0.18, ease: 'back.out(1.7)', overwrite: 'auto' });
}
