/**
 * Bug 2 — keep the page put when focus leaves an editor field.
 *
 * The editor panel is mounted LAST in the document. Leaving a panel field with Tab therefore
 * moves focus to the next element in DOM tab order — the page's first focusable, which on the
 * design-system page sits far down — and the browser scrolls it into view, yanking the page to
 * the bottom. (`el.blur()` alone doesn't scroll; it's the focus *destination* that does.)
 *
 * We snapshot the document scroll position and restore it on the next animation frame (after the
 * browser has applied any focus-driven scroll-into-view), but only if it actually drifted, so we
 * never fight a legitimate scroll.
 */
export function pinScroll(): void {
  if (typeof window === "undefined" || typeof requestAnimationFrame !== "function") return;
  const x = window.scrollX;
  const y = window.scrollY;
  requestAnimationFrame(() => {
    if (window.scrollX !== x || window.scrollY !== y) window.scrollTo(x, y);
  });
}
