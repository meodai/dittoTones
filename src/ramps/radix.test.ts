import { describe, it, expect } from 'vitest';
import { radixRamps } from './radix';

describe('radixRamps', () => {
  it('should export a Map', () => {
    expect(radixRamps).toBeInstanceOf(Map);
  });

  it('should contain multiple color ramps', () => {
    expect(radixRamps.size).toBeGreaterThan(0);
  });

  it('should have consistent shade keys across all ramps', () => {
    const firstRamp = radixRamps.values().next().value;
    const expectedShades = Object.keys(firstRamp).sort((a, b) => Number(a) - Number(b));

    // Radix uses 1-12 scale
    expect(expectedShades).toEqual(['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12']);

    for (const [name, ramp] of radixRamps) {
      const shades = Object.keys(ramp).sort((a, b) => Number(a) - Number(b));
      expect(shades).toEqual(expectedShades);
    }
  });

  it('should contain valid OKLCH colors', () => {
    for (const [name, ramp] of radixRamps) {
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

  it('should have common Radix color names', () => {
    const rampNames = Array.from(radixRamps.keys());

    // Check for some common Radix colors
    const commonColors = ['gray', 'blue', 'red', 'green', 'yellow', 'purple'];
    const foundColors = commonColors.filter((color) => rampNames.includes(color));

    expect(foundColors.length).toBeGreaterThan(0);
  });

  it('should have lightness progression in each ramp', () => {
    for (const [name, ramp] of radixRamps) {
      const shades = Object.keys(ramp).sort((a, b) => Number(a) - Number(b));
      const lightnesses = shades.map((shade) => ramp[shade].l);

      // First shade should generally be lighter than last shade
      // (Radix has specific semantic scales)
      expect(lightnesses[0]).toBeGreaterThan(lightnesses[shades.length - 1]);
    }
  });

  it('should have neutral ramps with low chroma', () => {
    const neutrals = ['gray', 'mauve', 'slate', 'sage', 'olive', 'sand'];
    const availableNeutrals = neutrals.filter((name) => radixRamps.has(name));

    expect(availableNeutrals.length).toBeGreaterThan(0);

    for (const neutralName of availableNeutrals) {
      const ramp = radixRamps.get(neutralName)!;

      // Calculate average chroma
      let totalChroma = 0;
      let count = 0;

      for (const color of Object.values(ramp)) {
        totalChroma += color.c ?? 0;
        count++;
      }

      const avgChroma = totalChroma / count;

      // Neutral ramps should have low average chroma
      expect(avgChroma).toBeLessThan(0.05);
    }
  });

  it('should have all colors with valid numeric properties', () => {
    for (const [name, ramp] of radixRamps) {
      for (const [shade, color] of Object.entries(ramp)) {
        expect(Number.isFinite(color.l)).toBe(true);
        expect(Number.isFinite(color.c)).toBe(true);

        if (color.c && color.c > 0.01) {
          expect(Number.isFinite(color.h)).toBe(true);
        }
      }
    }
  });

  it('should correctly parse color names from keys', () => {
    // Test that the parseRamp function correctly extracts numbers from Radix keys
    for (const [name, ramp] of radixRamps) {
      const shades = Object.keys(ramp);

      // All shade keys should be numeric strings
      for (const shade of shades) {
        expect(Number.isInteger(Number(shade))).toBe(true);
        expect(Number(shade)).toBeGreaterThanOrEqual(1);
        expect(Number(shade)).toBeLessThanOrEqual(12);
      }
    }
  });
});
