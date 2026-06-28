/** Capitalized exported component symbols (ignores lowercase helpers like buttonVariants). */
export function exportsOf(content: string): string[] {
  const out = new Set<string>();
  // export function Foo / export const Foo
  for (const m of content.matchAll(/export\s+(?:function|const)\s+([A-Z][A-Za-z0-9]*)/g)) out.add(m[1]);
  // export { Foo, Bar as Baz, lowercaseHelper }
  for (const m of content.matchAll(/export\s*\{([^}]*)\}/g)) {
    for (const part of m[1].split(",")) {
      const name = part.trim().split(/\s+as\s+/).pop()?.trim();
      if (name && /^[A-Z]/.test(name)) out.add(name);
    }
  }
  return [...out];
}
