import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { BuildingElement } from '@tim/shared';
import { startMeasure, endMeasure, computeTR } from '@tim/core';

export interface ViewerState {
  selectedId: string | null;
  collisionIds: Set<string>;
}

const CATEGORY_COLORS: Record<string, number> = {
  wall: 0x64748b, column: 0x78716c, slab: 0x94a3b8,
  beam: 0xa8a29e, door: 0xd97706, window: 0x38bdf8,
  pipe: 0x10b981, duct: 0x8b5cf6, generic: 0x6b7280,
};

function elementCenter(el: BuildingElement): THREE.Vector3 {
  const { min, max } = el.bbox;
  // scene maps (x, z-up) -> three (x, y=up=z, z=y)
  return new THREE.Vector3((min.x + max.x) / 2, (min.z + max.z) / 2, (min.y + max.y) / 2);
}

export class BIMViewer {
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private controls: OrbitControls;
  private meshMap = new Map<string, THREE.Mesh>();
  private ghostMeshMap = new Map<string, THREE.Mesh>();
  private connectionGroup = new THREE.Group();
  private collisionMaterial: THREE.MeshStandardMaterial;
  private selectedMaterial: THREE.MeshStandardMaterial;
  private ghostMaterial: THREE.MeshStandardMaterial;
  private animationId = 0;
  private raycaster = new THREE.Raycaster();
  private pointer = new THREE.Vector2();

  // region selection
  private selectionEl: HTMLDivElement;
  private isSelecting = false;
  private dragMoved = false;
  private regionArmed = false;
  private selStart = { x: 0, y: 0 };
  private selectedRegionIds = new Set<string>();

  // camera focus animation
  private focusState: { toTarget: THREE.Vector3; toCam: THREE.Vector3; t: number } | null = null;

  onSelect: ((id: string | null) => void) | null = null;
  onRegionSelect: ((ids: string[]) => void) | null = null;

  constructor(private container: HTMLElement) {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0f1117);

    this.camera = new THREE.PerspectiveCamera(60, 1, 0.1, 2000);
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
      new THREE.PlaneGeometry(60, 60),
      new THREE.MeshStandardMaterial({ color: 0x1a1d27, roughness: 0.9 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.scene.add(ground);

    this.scene.add(this.connectionGroup);

    this.selectedMaterial = new THREE.MeshStandardMaterial({ color: 0x22c55e, roughness: 0.4, metalness: 0.2 });
    this.collisionMaterial = new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.4, emissive: 0x440000 });
    this.ghostMaterial = new THREE.MeshStandardMaterial({
      color: 0x4aa8ff,
      emissive: 0x0b3a5c,
      transparent: true,
      opacity: 0.18,
      depthWrite: false,
      roughness: 1,
    });

    // selection rectangle overlay
    this.selectionEl = document.createElement('div');
    this.selectionEl.style.cssText = [
      'position:absolute', 'border:1px solid #f59e0b',
      'background:rgba(245,158,11,0.12)', 'pointer-events:none',
      'display:none', 'z-index:5',
    ].join(';');
    container.style.position = container.style.position || 'relative';
    container.appendChild(this.selectionEl);

    const dom = this.renderer.domElement;
    dom.addEventListener('click', this.handleClick);
    dom.addEventListener('mousedown', this.handleMouseDown);
    window.addEventListener('mousemove', this.handleMouseMove);
    window.addEventListener('mouseup', this.handleMouseUp);

    this.resize();
    window.addEventListener('resize', this.resize);
    this.animate();
  }

  private handleClick = (event: MouseEvent) => {
    if (this.dragMoved) { this.dragMoved = false; return; }
    if (event.ctrlKey || event.metaKey) return;
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.pointer, this.camera);

    const hits = this.raycaster.intersectObjects(Array.from(this.meshMap.values()));
    this.onSelect?.(hits.length > 0 ? (hits[0].object.userData.elementId as string) : null);
  };

  // ── Region selection (Ctrl/Cmd + drag) ──

  setRegionArmed(armed: boolean): void {
    this.regionArmed = armed;
    this.renderer.domElement.style.cursor = armed ? 'crosshair' : '';
  }

  private handleMouseDown = (event: MouseEvent) => {
    if (!(event.ctrlKey || event.metaKey || this.regionArmed)) return;
    event.preventDefault();
    this.isSelecting = true;
    this.dragMoved = false;
    this.controls.enabled = false;
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.selStart = { x: event.clientX - rect.left, y: event.clientY - rect.top };
    this.updateSelectionRect(this.selStart.x, this.selStart.y, this.selStart.x, this.selStart.y);
    this.selectionEl.style.display = 'block';
  };

  private handleMouseMove = (event: MouseEvent) => {
    if (!this.isSelecting) return;
    const rect = this.renderer.domElement.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    if (Math.abs(x - this.selStart.x) > 3 || Math.abs(y - this.selStart.y) > 3) this.dragMoved = true;
    this.updateSelectionRect(this.selStart.x, this.selStart.y, x, y);
  };

  private handleMouseUp = (event: MouseEvent) => {
    if (!this.isSelecting) return;
    this.isSelecting = false;
    this.controls.enabled = true;
    this.selectionEl.style.display = 'none';
    if (!this.dragMoved) return;

    const rect = this.renderer.domElement.getBoundingClientRect();
    const endX = event.clientX - rect.left;
    const endY = event.clientY - rect.top;
    const minX = Math.min(this.selStart.x, endX);
    const maxX = Math.max(this.selStart.x, endX);
    const minY = Math.min(this.selStart.y, endY);
    const maxY = Math.max(this.selStart.y, endY);

    const ids = this.pickInScreenRect(minX, minY, maxX, maxY);
    this.selectedRegionIds = new Set(ids);
    this.applySelectionTint();
    this.onRegionSelect?.(ids);
  };

  private updateSelectionRect(x1: number, y1: number, x2: number, y2: number) {
    const left = Math.min(x1, x2);
    const top = Math.min(y1, y2);
    this.selectionEl.style.left = `${left}px`;
    this.selectionEl.style.top = `${top}px`;
    this.selectionEl.style.width = `${Math.abs(x2 - x1)}px`;
    this.selectionEl.style.height = `${Math.abs(y2 - y1)}px`;
  }

  /** Only branch meshes (meshMap) are selectable, not ghost/main. */
  private pickInScreenRect(minX: number, minY: number, maxX: number, maxY: number): string[] {
    const canvas = this.renderer.domElement;
    const wHalf = canvas.clientWidth / 2;
    const hHalf = canvas.clientHeight / 2;
    const result: string[] = [];

    for (const [id, mesh] of this.meshMap) {
      const box = new THREE.Box3().setFromObject(mesh);
      const corners = [
        new THREE.Vector3(box.min.x, box.min.y, box.min.z),
        new THREE.Vector3(box.max.x, box.min.y, box.min.z),
        new THREE.Vector3(box.min.x, box.max.y, box.min.z),
        new THREE.Vector3(box.min.x, box.min.y, box.max.z),
        new THREE.Vector3(box.max.x, box.max.y, box.min.z),
        new THREE.Vector3(box.max.x, box.min.y, box.max.z),
        new THREE.Vector3(box.min.x, box.max.y, box.max.z),
        new THREE.Vector3(box.max.x, box.max.y, box.max.z),
        mesh.position.clone(),
      ];
      for (const c of corners) {
        const p = c.project(this.camera);
        if (p.z > 1) continue;
        const sx = p.x * wHalf + wHalf;
        const sy = -p.y * hHalf + hHalf;
        if (sx >= minX && sx <= maxX && sy >= minY && sy <= maxY) {
          result.push(id);
          break;
        }
      }
    }
    return result;
  }

  private applySelectionTint() {
    for (const [id, mesh] of this.meshMap) {
      const base = mesh.userData.baseMaterial as THREE.MeshStandardMaterial;
      const isRed = mesh.userData.isCollision as boolean;
      if (isRed) continue;
      if (this.selectedRegionIds.has(id)) {
        const tint = base.clone();
        tint.emissive = new THREE.Color(0x3a2f00);
        tint.color = new THREE.Color(0xf5c542);
        mesh.material = tint;
      } else {
        mesh.material = base;
      }
    }
  }

  private resize = () => {
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    this.camera.aspect = w / h || 1;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  };

  private animate = () => {
    this.animationId = requestAnimationFrame(this.animate);
    if (this.focusState) {
      this.focusState.t += 0.08;
      const t = Math.min(this.focusState.t, 1);
      this.controls.target.lerp(this.focusState.toTarget, t);
      this.camera.position.lerp(this.focusState.toCam, t);
      if (t >= 1) this.focusState = null;
    }
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

    for (const el of elements) {
      const { min, max } = el.bbox;
      const w = max.x - min.x;
      const h = max.z - min.z;
      const d = max.y - min.y;

      const geo = new THREE.BoxGeometry(Math.max(w, 0.05), Math.max(h, 0.05), Math.max(d, 0.05));
      const base = new THREE.MeshStandardMaterial({
        color: CATEGORY_COLORS[el.category] ?? 0x6b7280,
        roughness: 0.6, metalness: 0.1,
      });

      let mat: THREE.Material = base;
      if (collisionIds.has(el.id)) mat = this.collisionMaterial;
      else if (el.id === selectedId) mat = this.selectedMaterial;

      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.copy(elementCenter(el));
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.userData.elementId = el.id;
      mesh.userData.baseMaterial = base;
      mesh.userData.isCollision = collisionIds.has(el.id);
      this.scene.add(mesh);
      this.meshMap.set(el.id, mesh);
    }

    this.applySelectionTint();
    return endMeasure('viewer-load');
  }

  /** Lightweight semi-transparent overlay of main-branch volumes. */
  setGhost(elements: BuildingElement[]): void {
    for (const mesh of this.ghostMeshMap.values()) {
      this.scene.remove(mesh);
      mesh.geometry.dispose();
    }
    this.ghostMeshMap.clear();

    for (const el of elements) {
      if (this.meshMap.has(el.id)) continue; // already shown in the branch
      const { min, max } = el.bbox;
      const w = max.x - min.x;
      const h = max.z - min.z;
      const d = max.y - min.y;
      const geo = new THREE.BoxGeometry(Math.max(w, 0.05), Math.max(h, 0.05), Math.max(d, 0.05));
      const mesh = new THREE.Mesh(geo, this.ghostMaterial);
      mesh.position.copy(elementCenter(el));
      mesh.userData.elementId = el.id;
      mesh.renderOrder = -1;
      this.scene.add(mesh);
      this.ghostMeshMap.set(el.id, mesh);
    }
  }

  /** Red-highlight colliding elements (branch or ghost) and draw connection lines. */
  setCollisionPairs(pairs: Array<[string, string]>): void {
    this.connectionGroup.clear();

    const redIds = new Set<string>();
    for (const [a, b] of pairs) { redIds.add(a); redIds.add(b); }

    for (const [id, mesh] of this.meshMap) {
      const base = mesh.userData.baseMaterial as THREE.MeshStandardMaterial;
      if (redIds.has(id)) {
        mesh.material = this.collisionMaterial;
        mesh.userData.isCollision = true;
      } else {
        mesh.userData.isCollision = false;
        mesh.material = base;
      }
    }

    for (const [id, mesh] of this.ghostMeshMap) {
      mesh.material = redIds.has(id)
        ? new THREE.MeshStandardMaterial({ color: 0xef4444, transparent: true, opacity: 0.45, depthWrite: false })
        : this.ghostMaterial;
    }

    const lineMat = new THREE.LineBasicMaterial({ color: 0xff3344 });
    for (const [a, b] of pairs) {
      const ma = this.meshMap.get(a) ?? this.ghostMeshMap.get(a);
      const mb = this.meshMap.get(b) ?? this.ghostMeshMap.get(b);
      if (!ma || !mb) continue;
      const geo = new THREE.BufferGeometry().setFromPoints([ma.position.clone(), mb.position.clone()]);
      this.connectionGroup.add(new THREE.Line(geo, lineMat));
    }

    this.applySelectionTint();
  }

  clearRegion(): void {
    this.selectedRegionIds.clear();
    this.connectionGroup.clear();
    this.applySelectionTint();
  }

  /**
   * Fly to an element AND rotate the view a bit so the user always gets a
   * visible response — useful when several identical-looking elements collide.
   */
  focusElement(id: string): void {
    const mesh = this.meshMap.get(id) ?? this.ghostMeshMap.get(id);
    if (!mesh) return;
    const target = mesh.position.clone();

    // rotate the current camera offset ~22° around Y for clear feedback
    const offset = this.camera.position.clone().sub(this.controls.target);
    offset.applyAxisAngle(new THREE.Vector3(0, 1, 0), 0.38);
    const dist = Math.min(Math.max(offset.length(), 8), 14);
    offset.setLength(dist);
    if (offset.y < 4) offset.y = 5;

    this.focusState = { toTarget: target, toCam: target.clone().add(offset), t: 0 };
  }

  dispose(): void {
    cancelAnimationFrame(this.animationId);
    window.removeEventListener('resize', this.resize);
    window.removeEventListener('mousemove', this.handleMouseMove);
    window.removeEventListener('mouseup', this.handleMouseUp);
    const dom = this.renderer.domElement;
    dom.removeEventListener('click', this.handleClick);
    dom.removeEventListener('mousedown', this.handleMouseDown);
    this.renderer.dispose();
    this.container.removeChild(dom);
    if (this.selectionEl.parentElement) this.selectionEl.parentElement.removeChild(this.selectionEl);
  }
}

export { computeTR };
