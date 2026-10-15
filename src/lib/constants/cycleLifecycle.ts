/**
 * Cycle lifecycle statuses — shared constants used in Matrix, Cycles list, etc.
 */

export const CYCLE_LIFECYCLE = {
  PENDING:     { label: 'Pendiente',   icon: '🕐', cls: 'bg-gray-100   text-gray-600   border-gray-200',  dot: 'bg-gray-400'  },
  IN_PROGRESS: { label: 'En Progreso', icon: '🔄', cls: 'bg-blue-100   text-blue-800   border-blue-200',  dot: 'bg-blue-500'  },
  CLOSED:      { label: 'Cerrado',     icon: '🔒', cls: 'bg-slate-100  text-slate-700  border-slate-200', dot: 'bg-slate-500' },
  APPROVED:    { label: 'Aprobado',    icon: '✅', cls: 'bg-green-100  text-green-800  border-green-200', dot: 'bg-green-500' },
  FAIL:        { label: 'Fallido',     icon: '❌', cls: 'bg-red-100    text-red-800    border-red-200',   dot: 'bg-red-500'   },
} as const;

export type CycleLifecycleStatus = keyof typeof CYCLE_LIFECYCLE;

export const CYCLE_LIFECYCLE_KEYS = Object.keys(CYCLE_LIFECYCLE) as CycleLifecycleStatus[];

/** Returns style class for a given status string (graceful fallback) */
export function cycleStatusCls(status: string | null | undefined): string {
  return CYCLE_LIFECYCLE[(status as CycleLifecycleStatus)]?.cls ?? CYCLE_LIFECYCLE.PENDING.cls;
}

export function cycleStatusIcon(status: string | null | undefined): string {
  return CYCLE_LIFECYCLE[(status as CycleLifecycleStatus)]?.icon ?? '🕐';
}

export function cycleStatusLabel(status: string | null | undefined): string {
  return CYCLE_LIFECYCLE[(status as CycleLifecycleStatus)]?.label ?? status ?? 'Pendiente';
}
