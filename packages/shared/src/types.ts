/** Unique identifier */
export type ID = string;

/** 3D vector */
export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

/** Axis-aligned bounding box for collision detection */
export interface BoundingBox {
  min: Vec3;
  max: Vec3;
}

/** BIM element category */
export type ElementCategory =
  | 'wall'
  | 'column'
  | 'slab'
  | 'beam'
  | 'door'
  | 'window'
  | 'pipe'
  | 'duct'
  | 'generic';

/** Parametric parameter definition */
export interface ParameterDef {
  name: string;
  value: number | string | boolean;
  unit?: string;
  readonly?: boolean;
}

/** BIM building element */
export interface BuildingElement {
  id: ID;
  name: string;
  category: ElementCategory;
  parameters: Record<string, ParameterDef>;
  bbox: BoundingBox;
  branchId: ID;
  familyId?: ID;
  createdAt: string;
  updatedAt: string;
}

/** Git-like branch for collaborative BIM workflow */
export interface Branch {
  id: ID;
  projectId: ID;
  name: string;
  parentBranchId?: ID;
  headCommitId?: ID;
  authorId: ID;
  isMain: boolean;
  status: 'active' | 'merged' | 'archived';
  createdAt: string;
  updatedAt: string;
}

/** Commit snapshot of building state */
export interface Commit {
  id: ID;
  branchId: ID;
  parentCommitId?: ID;
  message: string;
  authorId: ID;
  elementIds: ID[];
  createdAt: string;
}

/** Collision between two elements */
export interface Collision {
  id: ID;
  elementAId: ID;
  elementBId: ID;
  branchId: ID;
  severity: 'warning' | 'critical';
  resolved: boolean;
  detectedAt: string;
}

/** Merge request (architect approves branch → main) */
export interface MergeRequest {
  id: ID;
  projectId: ID;
  sourceBranchId: ID;
  targetBranchId: ID;
  authorId: ID;
  reviewerId?: ID;
  status: 'open' | 'approved' | 'rejected' | 'merged';
  collisions: Collision[];
  message: string;
  createdAt: string;
  updatedAt: string;
}

/** Parametric family (Revit-like) */
export interface Family {
  id: ID;
  name: string;
  category: ElementCategory;
  parameters: ParameterDef[];
  thumbnailUrl?: string;
  source: 'builtin' | 'library' | 'upload';
  createdAt: string;
}

/** Building project */
export interface Project {
  id: ID;
  name: string;
  description?: string;
  ownerId: ID;
  mainBranchId: ID;
  createdAt: string;
  updatedAt: string;
}

/** User (architect) */
export interface User {
  id: ID;
  email: string;
  name: string;
  role: 'lead_architect' | 'architect' | 'viewer';
  createdAt: string;
}

/** SNiP / СанПиН validation result */
export interface ValidationResult {
  ruleId: string;
  status: 'passed' | 'failed' | 'unknown';
  errors: string[];
}

/** TR performance metrics: TR = T1 + T2 */
export interface TRMetrics {
  t1LoadMs: number;
  t2ProcessMs: number;
  totalMs: number;
  modelSizeBytes: number;
  elementCount: number;
}

/** Node graph for visual programming */
export interface NodeGraph {
  id: ID;
  projectId: ID;
  name: string;
  nodes: GraphNode[];
  connections: GraphConnection[];
  updatedAt: string;
}

export interface GraphNode {
  id: ID;
  type: string;
  position: { x: number; y: number };
  inputs: Record<string, unknown>;
}

export interface GraphConnection {
  id: ID;
  fromNodeId: ID;
  fromPort: string;
  toNodeId: ID;
  toPort: string;
}

/** API response wrapper */
export interface ApiResponse<T> {
  data: T;
  error?: string;
}

/** Paginated list */
export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}
