import type { TRMetrics } from '@tim/shared';

export interface TRMeasurement {
  label: string;
  startMs: number;
}

const measurements = new Map<string, TRMeasurement>();

export function startMeasure(label: string): void {
  measurements.set(label, { label, startMs: performance.now() });
}

export function endMeasure(label: string): number {
  const m = measurements.get(label);
  if (!m) return 0;
  const elapsed = performance.now() - m.startMs;
  measurements.delete(label);
  return elapsed;
}

export function computeTR(t1LoadMs: number, t2ProcessMs: number, modelSizeBytes: number, elementCount: number): TRMetrics {
  return {
    t1LoadMs,
    t2ProcessMs,
    totalMs: t1LoadMs + t2ProcessMs,
    modelSizeBytes,
    elementCount,
  };
}

/** Target TR thresholds from architecture spec */
export const TR_TARGETS = {
  small: { maxBytes: 25 * 1024 * 1024, targetMs: 10_000 },
  medium: { maxBytes: 100 * 1024 * 1024, targetMs: 15_000 },
  large: { maxBytes: 500 * 1024 * 1024, targetMs: 25_000 },
} as const;

export function evaluateTR(metrics: TRMetrics): 'good' | 'acceptable' | 'slow' {
  const { modelSizeBytes, totalMs } = metrics;
  let target: number;

  if (modelSizeBytes <= TR_TARGETS.small.maxBytes) target = TR_TARGETS.small.targetMs;
  else if (modelSizeBytes <= TR_TARGETS.medium.maxBytes) target = TR_TARGETS.medium.targetMs;
  else target = TR_TARGETS.large.targetMs;

  if (totalMs <= target * 0.8) return 'good';
  if (totalMs <= target) return 'acceptable';
  return 'slow';
}
