/** Allowed steps on Tailwind v4's --spacing multiplier scale. Adopter-editable: add steps your
 *  design uses. The off-scale-spacing check flags p-/m-/gap-/space- utilities outside this set. */
export const ALLOWED_SPACING_STEPS = new Set([
  0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 5, 6, 7, 8, 9, 10, 11, 12, 14, 16, 20, 24, 28, 32, 36, 40, 44,
  48, 52, 56, 60, 64, 72, 80, 96,
]);
