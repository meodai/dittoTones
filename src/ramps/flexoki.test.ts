import { describe, it, expect } from 'vitest';
import { flexokiRamps } from './flexoki';
import { DittoTones } from '../index';

describe('flexokiRamps', () => {
  it('should export a Map', () => {
    expect(flexokiRamps).toBeInstanceOf(Map);
  });

  it('should include the base (gray) ramp', () => {
    expect(flexokiRamps.has('base')).toBe(true);
  });

  it('should have consistent shade keys across all ramps', () => {
    const firstRamp = flexokiRamps.values().next().value;
    if (!firstRamp) throw new Error('No ramps found');
    const expectedShades = Object.keys(firstRamp).sort((a, b) => Number(a) - Number(b));

    for (const [, ramp] of flexokiRamps) {
      const shades = Object.keys(ramp).sort((a, b) => Number(a) - Number(b));
      expect(shades).toEqual(expectedShades);
    }
  });

  it('should pick base as the neutral ramp for gray input', () => {
    const ditto = new DittoTones({ ramps: flexokiRamps });
    const result = ditto.generate('#808080');
    expect(result.sources[0].name).toBe('base');
  });
});
