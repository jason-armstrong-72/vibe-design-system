import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Nested build output (git worktrees) + local agent dirs — the cwd-anchored ".next/**"
    // above misses ".claude/worktrees/*/.next/", which otherwise floods eslint with build chunks.
    "**/.next/**",
    ".claude/**",
  ]),
]);

export default eslintConfig;
