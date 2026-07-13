import type { ElementCategory, Family, ParameterDef } from '@tim/shared';
import { createBBoxFromDimensions } from '../collision/cpu-collision.js';
import type { BoundingBox } from '@tim/shared';

export interface FamilyConstraint {
  from: string;
  to: string;
  relation: (value: number | string | boolean) => number | string | boolean;
}

export class ParametricFamily {
  parameters: Record<string, ParameterDef>;
  constraints: FamilyConstraint[];

  constructor(
    public readonly id: string,
    public readonly name: string,
    public readonly category: ElementCategory,
    initialParams: ParameterDef[],
    constraints: FamilyConstraint[] = []
  ) {
    this.parameters = Object.fromEntries(initialParams.map(p => [p.name, { ...p }]));
    this.constraints = constraints;
  }

  setParameter(name: string, value: number | string | boolean): void {
    if (!(name in this.parameters)) {
      throw new Error(`Unknown parameter: ${name}`);
    }
    if (this.parameters[name].readonly) {
      throw new Error(`Parameter ${name} is read-only`);
    }
    this.parameters[name].value = value;
    this.applyConstraints(name);
  }

  private applyConstraints(changedParam: string): void {
    for (const c of this.constraints) {
      if (c.from === changedParam) {
        const newVal = c.relation(this.parameters[c.from].value);
        this.parameters[c.to].value = newVal;
      }
    }
  }

  buildBBox(position: { x: number; y: number; z: number }): BoundingBox {
    const w = Number(this.parameters.width?.value ?? 1);
    const h = Number(this.parameters.height?.value ?? 1);
    const d = Number(this.parameters.depth?.value ?? 0.2);
    return createBBoxFromDimensions(position.x, position.y, position.z, w, h, d);
  }
}

/** Built-in family library */
export const BUILTIN_FAMILIES: Family[] = [
  {
    id: 'fam-wall-basic',
    name: 'Basic Wall',
    category: 'wall',
    parameters: [
      { name: 'width', value: 5, unit: 'm' },
      { name: 'height', value: 3, unit: 'm' },
      { name: 'depth', value: 0.3, unit: 'm' },
      { name: 'material', value: 'concrete' },
    ],
    source: 'builtin',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'fam-column-round',
    name: 'Round Column',
    category: 'column',
    parameters: [
      { name: 'width', value: 0.4, unit: 'm' },
      { name: 'height', value: 3.5, unit: 'm' },
      { name: 'depth', value: 0.4, unit: 'm' },
      { name: 'concrete_class', value: 'B25' },
    ],
    source: 'builtin',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'fam-window-standard',
    name: 'Standard Window',
    category: 'window',
    parameters: [
      { name: 'width', value: 1.2, unit: 'm' },
      { name: 'height', value: 1.8, unit: 'm' },
      { name: 'depth', value: 0.12, unit: 'm' },
      { name: 'glassThickness', value: 6, unit: 'mm' },
    ],
    source: 'builtin',
    createdAt: new Date().toISOString(),
  },
];

export function createWindowFamily(): ParametricFamily {
  return new ParametricFamily(
    'fam-window-standard',
    'Standard Window',
    'window',
    BUILTIN_FAMILIES[2].parameters,
    [
      {
        from: 'glassThickness',
        to: 'material',
        relation: (t) => (Number(t) > 4 ? 'tempered' : 'float'),
      },
    ]
  );
}
