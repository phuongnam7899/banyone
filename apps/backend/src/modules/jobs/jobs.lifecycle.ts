import type { GenerationJobStatus } from './jobs.types';

const allowed: Record<GenerationJobStatus, ReadonlySet<GenerationJobStatus>> = {
  queued: new Set(['processing']),
  processing: new Set(['ready', 'failed']),
  ready: new Set(),
  failed: new Set(),
};

export function isAllowedLifecycleTransition(
  from: GenerationJobStatus,
  to: GenerationJobStatus,
): boolean {
  return allowed[from]?.has(to) ?? false;
}

export function assertAllowedLifecycleTransition(
  from: GenerationJobStatus,
  to: GenerationJobStatus,
): void {
  if (!isAllowedLifecycleTransition(from, to)) {
    throw new Error(`Illegal lifecycle transition: ${from} -> ${to}`);
  }
}
