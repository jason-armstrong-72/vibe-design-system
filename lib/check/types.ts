export interface Finding {
  file: string;
  line: number; // 1-based; 0 = whole-file (not line-suppressible)
  rule: string;
  message: string; // includes the fix (recovery UX, spec §2); may embed variable content
  key?: string; // stable baseline identity: the offending token only. Absent → not baseline-able.
}
