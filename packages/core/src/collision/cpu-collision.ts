import type { BoundingBox, BuildingElement } from '@tim/shared';

export function boxesIntersect(a: BoundingBox, b: BoundingBox): boolean {
  return (
    a.min.x <= b.max.x && a.max.x >= b.min.x &&
    a.min.y <= b.max.y && a.max.y >= b.min.y &&
    a.min.z <= b.max.z && a.max.z >= b.min.z
  );
}

export interface CollisionPair {
  elementAId: string;
  elementBId: string;
}

/**
 * CPU-based broad-phase collision detection.
 * Used as fallback when WebGPU is unavailable.
 */
export function detectCollisionsCPU(
  elements: BuildingElement[]
): CollisionPair[] {
  const pairs: CollisionPair[] = [];

  for (let i = 0; i < elements.length; i++) {
    for (let j = i + 1; j < elements.length; j++) {
      const a = elements[i];
      const b = elements[j];
      if (boxesIntersect(a.bbox, b.bbox)) {
        pairs.push({ elementAId: a.id, elementBId: b.id });
      }
    }
  }

  return pairs;
}

export function createBBoxFromDimensions(
  x: number, y: number, z: number,
  width: number, height: number, depth: number
): BoundingBox {
  return {
    min: { x: x - width / 2, y: y - depth / 2, z },
    max: { x: x + width / 2, y: y + depth / 2, z: z + height },
  };
}
