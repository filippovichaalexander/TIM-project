import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { BuildingElement } from '@tim/shared';
import { startMeasure, endMeasure, computeTR } from '@tim/core';

export interface ViewerState {
  selectedId: string | null;
  collisionIds: Set<string>;
}

export class BIMViewer {
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private controls: OrbitControls;
  private meshMap = new Map<string, THREE.Mesh>();
  private collisionMaterial: THREE.MeshStandardMaterial;
  private normalMaterial: THREE.MeshStandardMaterial;
  private selectedMaterial: THREE.MeshStandardMaterial;
  private animationId = 0;
  private raycaster = new THREE.Raycaster();
  private pointer = new THREE.Vector2();
  onSelect: ((id: string | null) => void) | null = null;

  constructor(private container: HTMLElement) {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0f1117);

    this.camera = new THREE.PerspectiveCamera(60, 1, 0.1, 1000);
    this.camera.position.set(15, 12, 15);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(this.renderer.domElement);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.target.set(0, 1.5, 0);

    const ambient = new THREE.AmbientLight(0xffffff, 0.5);
    this.scene.add(ambient);

    const dir = new THREE.DirectionalLight(0xffffff, 1.2);
    dir.position.set(10, 20, 10);
    dir.castShadow = true;
    this.scene.add(dir);

    const grid = new THREE.GridHelper(30, 30, 0x2e3348, 0x1a1d27);
    this.scene.add(grid);

    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(30, 30),
      new THREE.MeshStandardMaterial({ color: 0x1a1d27, roughness: 0.9 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.scene.add(ground);

    this.normalMaterial = new THREE.MeshStandardMaterial({ color: 0x3b82f6, roughness: 0.6, metalness: 0.1 });
    this.selectedMaterial = new THREE.MeshStandardMaterial({ color: 0x22c55e, roughness: 0.4, metalness: 0.2 });
    this.collisionMaterial = new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.4, emissive: 0x440000 });

    this.renderer.domElement.addEventListener('click', this.handleClick);
    this.resize();
    window.addEventListener('resize', this.resize);
    this.animate();
  }

  private handleClick = (event: MouseEvent) => {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.pointer, this.camera);

    const meshes = Array.from(this.meshMap.values());
    const hits = this.raycaster.intersectObjects(meshes);
    if (hits.length > 0) {
      const id = hits[0].object.userData.elementId as string;
      this.onSelect?.(id);
    } else {
      this.onSelect?.(null);
    }
  };

  private resize = () => {
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  };

  private animate = () => {
    this.animationId = requestAnimationFrame(this.animate);
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  };

  loadElements(elements: BuildingElement[], collisionIds: Set<string> = new Set(), selectedId: string | null = null): number {
    startMeasure('viewer-load');

    for (const mesh of this.meshMap.values()) {
      this.scene.remove(mesh);
      mesh.geometry.dispose();
    }
    this.meshMap.clear();

    const categoryColors: Record<string, number> = {
      wall: 0x64748b, column: 0x78716c, slab: 0x94a3b8,
      beam: 0xa8a29e, door: 0xd97706, window: 0x38bdf8,
      pipe: 0x10b981, duct: 0x8b5cf6, generic: 0x6b7280,
    };

    for (const el of elements) {
      const { min, max } = el.bbox;
      const w = max.x - min.x;
      const h = max.z - min.z;
      const d = max.y - min.y;
      const cx = (min.x + max.x) / 2;
      const cy = (min.y + max.y) / 2;
      const cz = (min.z + max.z) / 2;

      const geo = new THREE.BoxGeometry(Math.max(w, 0.05), Math.max(h, 0.05), Math.max(d, 0.05));
      let mat: THREE.MeshStandardMaterial;
      if (collisionIds.has(el.id)) {
        mat = this.collisionMaterial;
      } else if (el.id === selectedId) {
        mat = this.selectedMaterial;
      } else {
        mat = this.normalMaterial.clone();
        mat.color.setHex(categoryColors[el.category] ?? 0x6b7280);
      }

      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(cx, cz, cy);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.userData.elementId = el.id;
      this.scene.add(mesh);
      this.meshMap.set(el.id, mesh);
    }

    return endMeasure('viewer-load');
  }

  dispose(): void {
    cancelAnimationFrame(this.animationId);
    window.removeEventListener('resize', this.resize);
    this.renderer.domElement.removeEventListener('click', this.handleClick);
    this.renderer.dispose();
    this.container.removeChild(this.renderer.domElement);
  }
}

export { computeTR };
