import type { BuildingElement, ValidationResult } from '@tim/shared';

interface RuleCheck {
  [param: string]: (value: number | string | boolean) => string;
}

interface SnipRule {
  checks: RuleCheck;
}

const SNIP_RULES: Record<string, SnipRule> = {
  'SNIP_3.03.01-87': {
    checks: {
      wall_thickness: (v) => Number(v) >= 1.2 ? 'OK' : 'Violation: thickness < 1.2 m',
      concrete_class: (v) =>
        ['B15', 'B20', 'B25'].includes(String(v)) ? 'OK' : 'Violation: concrete class not per GOST',
    },
  },
  'SANPIN_1.2.3685-21': {
    checks: {
      room_height: (v) => Number(v) >= 2.7 ? 'OK' : 'Violation: room height < 2.7 m',
      window_ratio: (v) => Number(v) >= 0.3 ? 'OK' : 'Violation: insufficient daylight',
    },
  },
};

export function validateSNiP(element: BuildingElement, ruleId: string): ValidationResult {
  const rule = SNIP_RULES[ruleId];
  if (!rule) return { ruleId, status: 'unknown', errors: [] };

  const errors: string[] = [];
  for (const [key, check] of Object.entries(rule.checks)) {
    const param = element.parameters[key];
    if (param !== undefined) {
      const result = check(param.value);
      if (result !== 'OK') errors.push(result);
    }
  }

  return {
    ruleId,
    status: errors.length === 0 ? 'passed' : 'failed',
    errors,
  };
}

export function validateElement(element: BuildingElement): ValidationResult[] {
  return Object.keys(SNIP_RULES).map(ruleId => validateSNiP(element, ruleId));
}

export { SNIP_RULES };
