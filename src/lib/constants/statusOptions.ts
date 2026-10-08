/**
 * Shared status options constants and helpers.
 * Used by MatrixGrid, Matrix.tsx, MySpaceMatrix.tsx, and StatusOptionsEditor.
 */

export const DEFAULT_STATUS_OPTIONS: string[] = [
  'PENDING', 'PASS', 'FAIL', 'BLOCKED', 'SKIP', 'IMPROVEMENT',
];

/** Tailwind classes for known statuses — fallback to PENDING style */
export const STATUS_CLS: Record<string, string> = {
  PASS:        'bg-green-100  text-green-800  border-green-300',
  FAIL:        'bg-red-100    text-red-800    border-red-300',
  BLOCKED:     'bg-yellow-100 text-yellow-800 border-yellow-300',
  SKIP:        'bg-slate-100  text-slate-700  border-slate-300',
  IMPROVEMENT: 'bg-purple-100 text-purple-800 border-purple-300',
  PENDING:     'bg-gray-100   text-gray-700   border-gray-300',
};

/** Row-level highlight classes */
export const STATUS_ROW_CLS: Record<string, string> = {
  PASS:        'qhm-row-pass',
  FAIL:        'qhm-row-fail',
  BLOCKED:     'qhm-row-blocked',
  SKIP:        'qhm-row-skip',
  IMPROVEMENT: 'qhm-row-improvement',
  PENDING:     '',
};

/** Emoji prefixes for known statuses */
export const STATUS_EMOJI: Record<string, string> = {
  PENDING:     '⏳',
  PASS:        '✅',
  FAIL:        '❌',
  BLOCKED:     '⚠️',
  SKIP:        '⏭️',
  IMPROVEMENT: '💡',
};

/** Returns "⏳ PENDING" or "🔘 CUSTOM" for any status value */
export function statusLabel(s: string): string {
  const emoji = STATUS_EMOJI[s] ?? '🔘';
  return `${emoji} ${s}`;
}

/** Returns CSS class for a status value (falls back to PENDING style) */
export function statusCls(s: string): string {
  return STATUS_CLS[s] ?? STATUS_CLS.PENDING;
}

/** Returns row-level CSS class for a status value */
export function statusRowCls(s: string): string {
  return STATUS_ROW_CLS[s] ?? '';
}

/** Extracts status_options from test_cycles.custom_values */
export function getCycleStatusOptions(customValues: Record<string, any> | null | undefined): string[] {
  const opts = customValues?._status_options;
  if (Array.isArray(opts) && opts.length > 0) return opts;
  return [...DEFAULT_STATUS_OPTIONS];
}

/** Extracts status_options from personal_matrix_versions.matrix_data */
export function getMatrixDataStatusOptions(matrixData: Record<string, any> | null | undefined): string[] {
  const opts = matrixData?.status_options;
  if (Array.isArray(opts) && opts.length > 0) return opts;
  return [...DEFAULT_STATUS_OPTIONS];
}
