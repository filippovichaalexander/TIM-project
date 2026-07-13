import type { BuildingElement } from '@tim/shared';
import { detectCollisionsCPU, type CollisionPair } from './cpu-collision.js';

export interface CollisionDetector {
  init(): Promise<void>;
  checkCollisions(elements: BuildingElement[]): Promise<CollisionPair[]>;
  dispose(): void;
}

export { detectCollisionsCPU, boxesIntersect, createBBoxFromDimensions } from './cpu-collision.js';
export type { CollisionPair } from './cpu-collision.js';
export { WebGPUCollisionDetector } from './webgpu-collision.js';

export async function createCollisionDetector(): Promise<CollisionDetector> {
  if (typeof navigator !== 'undefined' && 'gpu' in navigator) {
    try {
      const { WebGPUCollisionDetector } = await import('./webgpu-collision.js');
      const detector = new WebGPUCollisionDetector();
      await detector.init();
      return detector;
    } catch {
      // fall through to CPU
    }
  }

  return {
    async init() {},
    async checkCollisions(elements) {
      return detectCollisionsCPU(elements);
    },
    dispose() {},
  };
}
