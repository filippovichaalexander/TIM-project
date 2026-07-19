export {
  createCollisionDetector,
  detectCollisionsCPU,
  detectCrossBranchCollisions,
  resolveCollisionByMove,
  WebGPUCollisionDetector,
} from './collision/index.js';
export type { CollisionDetector, CollisionPair } from './collision/index.js';
export { ParametricFamily, BUILTIN_FAMILIES, createWindowFamily } from './parametric/family.js';
export { previewMerge, diffBranches } from './branch/merge.js';
export type { MergePreview } from './branch/merge.js';
export { validateSNiP, validateElement, SNIP_RULES } from './validation/snip.js';
export { startMeasure, endMeasure, computeTR, evaluateTR, TR_TARGETS } from './performance/tr-metrics.js';
