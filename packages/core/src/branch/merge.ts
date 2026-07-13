import type { BuildingElement, Branch, Collision } from '@tim/shared';
import type { CollisionPair } from '../collision/cpu-collision.js';

export interface MergePreview {
  newElements: BuildingElement[];
  modifiedElements: BuildingElement[];
  collisions: Collision[];
  canMerge: boolean;
}

/**
 * Compare source branch elements against target (main) branch
 * and detect collisions before merge approval.
 */
export function previewMerge(
  sourceElements: BuildingElement[],
  targetElements: BuildingElement[],
  sourceBranch: Branch,
  _targetBranch: Branch,
  collisionPairs: CollisionPair[]
): MergePreview {
  const targetIds = new Set(targetElements.map(e => e.id));
  const newElements = sourceElements.filter(e => !targetIds.has(e.id));
  const modifiedElements = sourceElements.filter(e => targetIds.has(e.id));

  const collisions: Collision[] = collisionPairs.map((pair, i) => ({
    id: `col-${i}`,
    elementAId: pair.elementAId,
    elementBId: pair.elementBId,
    branchId: sourceBranch.id,
    severity: 'critical' as const,
    resolved: false,
    detectedAt: new Date().toISOString(),
  }));

  return {
    newElements,
    modifiedElements,
    collisions,
    canMerge: collisions.length === 0,
  };
}

export function diffBranches(
  source: BuildingElement[],
  target: BuildingElement[]
): { added: BuildingElement[]; removed: BuildingElement[]; changed: BuildingElement[] } {
  const sourceMap = new Map(source.map(e => [e.id, e]));
  const targetMap = new Map(target.map(e => [e.id, e]));

  const added = source.filter(e => !targetMap.has(e.id));
  const removed = target.filter(e => !sourceMap.has(e.id));
  const changed = source.filter(e => {
    const t = targetMap.get(e.id);
    return t && JSON.stringify(e.parameters) !== JSON.stringify(t.parameters);
  });

  return { added, removed, changed };
}
