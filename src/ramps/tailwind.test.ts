import { describe, it, expect } from 'vitest';
import { tailwindRamps } from './tailwind';

describe('tailwindRamps', () => {
  it('should export a Map', () => {
    expect(tailwindRamps).toBeInstanceOf(Map);
  });

  it('should contain multiple color ramps', () => {
    expect(tailwindRamps.size).toBeGreaterThan(0);
  });

  it('should have consistent shade keys across all ramps', () => {
    const firstRamp = tailwindRamps.values().next().value;
    const expectedShades = Object.keys(firstRamp);

    for (const [name, ramp] of tailwindRamps) {
      const shades = Object.keys(ramp);
      expect(shades).toEqual(expectedShades);
    }
  });

  it('should contain valid OKLCH colors', () => {
    for (const [name, ramp] of tailwindRamps) {
      for (const [shade, color] of Object.entries(ramp)) {
        expect(color.mode).toBe('oklch');
        expect(color.l).toBeGreaterThanOrEqual(0);
        expect(color.l).toBeLessThanOrEqual(1);
        expect(color.c).toBeGreaterThanOrEqual(0);

        if (color.c && color.c > 0.01) {
          expect(color.h).toBeDefined();
        }
      }
    }
  });

  it('should have common Tailwind color names', () => {
    const rampNames = Array.from(tailwindRamps.keys());

    // Check for some common Tailwind colors
    const commonColors = ['slate', 'red', 'blue', 'green', 'yellow'];
    const hasCommonColors = commonColors.some(color => rampNames.includes(color));

    expect(hasCommonColors).toBe(true);
  });

  it('should have lightness progression in each ramp', () => {
    for (const [name, ramp] of tailwindRamps) {
      const shades = Object.keys(ramp).sort((a, b) => Number(a) - Number(b));
      const lightnesses = shades.map(shade => ramp[shade].l);

      // First shade should be lighter than last shade
      expect(lightnesses[0]).toBeGreaterThan(lightnesses[lightnesses.length - 1]);
    }
  });

  it('should have all colors with valid numeric properties', () => {
    for (const [name, ramp] of tailwindRamps) {
      for (const [shade, color] of Object.entries(ramp)) {
        expect(Number.isFinite(color.l)).toBe(true);
        expect(Number.isFinite(color.c)).toBe(true);

        if (color.c && color.c > 0.01) {
          expect(Number.isFinite(color.h)).toBe(true);
        }
      }
    }
  });
});
