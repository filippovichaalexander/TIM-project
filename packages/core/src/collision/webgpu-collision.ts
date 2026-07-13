import type { BuildingElement } from '@tim/shared';
import { detectCollisionsCPU, type CollisionPair } from './cpu-collision.js';

const COLLISION_SHADER = /* wgsl */ `
struct BoundingBox {
  minX: f32, minY: f32, minZ: f32, _pad0: f32,
  maxX: f32, maxY: f32, maxZ: f32, _pad1: f32,
}

@group(0) @binding(0) var<storage, read> boxes: array<BoundingBox>;
@group(0) @binding(1) var<storage, read_write> results: array<u32>;
@group(0) @binding(2) var<uniform> count: u32;

fn intersects(a: BoundingBox, b: BoundingBox) -> bool {
  return a.minX <= b.maxX && a.maxX >= b.minX
      && a.minY <= b.maxY && a.maxY >= b.minY
      && a.minZ <= b.maxZ && a.maxZ >= b.minZ;
}

@compute @workgroup_size(256)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let i = gid.x;
  if (i >= count) { return; }

  for (var j = i + 1u; j < count; j++) {
    if (intersects(boxes[i], boxes[j])) {
      let idx = i * count + j;
      results[idx] = 1u;
    }
  }
}
`;

export class WebGPUCollisionDetector {
  private device!: GPUDevice;
  private pipeline!: GPUComputePipeline;
  private bindGroupLayout!: GPUBindGroupLayout;

  async init(): Promise<void> {
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) throw new Error('WebGPU adapter not available');

    this.device = await adapter.requestDevice();
    const module = this.device.createShaderModule({ code: COLLISION_SHADER });

    this.bindGroupLayout = this.device.createBindGroupLayout({
      entries: [
        { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'read-only-storage' } },
        { binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } },
        { binding: 2, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'uniform' } },
      ],
    });

    this.pipeline = this.device.createComputePipeline({
      layout: this.device.createPipelineLayout({ bindGroupLayouts: [this.bindGroupLayout] }),
      compute: { module, entryPoint: 'main' },
    });
  }

  async checkCollisions(elements: BuildingElement[]): Promise<CollisionPair[]> {
    const count = elements.length;
    if (count < 2) return [];

    const boxData = new Float32Array(count * 8);
    for (let i = 0; i < count; i++) {
      const { min, max } = elements[i].bbox;
      const off = i * 8;
      boxData[off] = min.x; boxData[off + 1] = min.y; boxData[off + 2] = min.z;
      boxData[off + 4] = max.x; boxData[off + 5] = max.y; boxData[off + 6] = max.z;
    }

    const boxBuffer = this.device.createBuffer({
      size: boxData.byteLength,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });
    this.device.queue.writeBuffer(boxBuffer, 0, boxData);

    const resultSize = count * count * 4;
    const resultBuffer = this.device.createBuffer({
      size: resultSize,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
    });

    const countBuffer = this.device.createBuffer({
      size: 4,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    this.device.queue.writeBuffer(countBuffer, 0, new Uint32Array([count]));

    const bindGroup = this.device.createBindGroup({
      layout: this.bindGroupLayout,
      entries: [
        { binding: 0, resource: { buffer: boxBuffer } },
        { binding: 1, resource: { buffer: resultBuffer } },
        { binding: 2, resource: { buffer: countBuffer } },
      ],
    });

    const encoder = this.device.createCommandEncoder();
    const pass = encoder.beginComputePass();
    pass.setPipeline(this.pipeline);
    pass.setBindGroup(0, bindGroup);
    pass.dispatchWorkgroups(Math.ceil(count / 256));
    pass.end();

    const readBuffer = this.device.createBuffer({
      size: resultSize,
      usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
    });
    encoder.copyBufferToBuffer(resultBuffer, 0, readBuffer, 0, resultSize);
    this.device.queue.submit([encoder.finish()]);

    await readBuffer.mapAsync(GPUMapMode.READ);
    const results = new Uint32Array(readBuffer.getMappedRange().slice(0));
    readBuffer.unmap();

    const pairs: CollisionPair[] = [];
    for (let i = 0; i < count; i++) {
      for (let j = i + 1; j < count; j++) {
        if (results[i * count + j] === 1) {
          pairs.push({ elementAId: elements[i].id, elementBId: elements[j].id });
        }
      }
    }

    boxBuffer.destroy();
    resultBuffer.destroy();
    countBuffer.destroy();
    readBuffer.destroy();

    return pairs;
  }

  dispose(): void {
    this.device?.destroy();
  }
}
