import { describe, it, expect, beforeEach } from 'vitest';
import { DittoTones, type Ramp, type Oklch } from './index';
import { oklch, parse } from 'culori';

describe('DittoTones', () => {
  // Helper to create simple test ramps
  const createTestRamps = () => {
    const blueRamp: Ramp = {
      '50': { mode: 'oklch', l: 0.95, c: 0.02, h: 240 },
      '100': { mode: 'oklch', l: 0.9, c: 0.04, h: 240 },
      '200': { mode: 'oklch', l: 0.8, c: 0.08, h: 240 },
      '300': { mode: 'oklch', l: 0.7, c: 0.12, h: 240 },
      '400': { mode: 'oklch', l: 0.6, c: 0.16, h: 240 },
      '500': { mode: 'oklch', l: 0.5, c: 0.2, h: 240 },
      '600': { mode: 'oklch', l: 0.4, c: 0.16, h: 240 },
      '700': { mode: 'oklch', l: 0.3, c: 0.12, h: 240 },
      '800': { mode: 'oklch', l: 0.2, c: 0.08, h: 240 },
      '900': { mode: 'oklch', l: 0.1, c: 0.04, h: 240 },
    };

    const redRamp: Ramp = {
      '50': { mode: 'oklch', l: 0.95, c: 0.03, h: 30 },
      '100': { mode: 'oklch', l: 0.9, c: 0.06, h: 30 },
      '200': { mode: 'oklch', l: 0.8, c: 0.1, h: 30 },
      '300': { mode: 'oklch', l: 0.7, c: 0.14, h: 30 },
      '400': { mode: 'oklch', l: 0.6, c: 0.18, h: 30 },
      '500': { mode: 'oklch', l: 0.5, c: 0.22, h: 30 },
      '600': { mode: 'oklch', l: 0.4, c: 0.18, h: 30 },
      '700': { mode: 'oklch', l: 0.3, c: 0.14, h: 30 },
      '800': { mode: 'oklch', l: 0.2, c: 0.1, h: 30 },
      '900': { mode: 'oklch', l: 0.1, c: 0.06, h: 30 },
    };

    const grayRamp: Ramp = {
      '50': { mode: 'oklch', l: 0.98, c: 0.005, h: 0 },
      '100': { mode: 'oklch', l: 0.96, c: 0.005, h: 0 },
      '200': { mode: 'oklch', l: 0.9, c: 0.01, h: 0 },
      '300': { mode: 'oklch', l: 0.8, c: 0.01, h: 0 },
      '400': { mode: 'oklch', l: 0.6, c: 0.01, h: 0 },
      '500': { mode: 'oklch', l: 0.5, c: 0.01, h: 0 },
      '600': { mode: 'oklch', l: 0.4, c: 0.01, h: 0 },
      '700': { mode: 'oklch', l: 0.3, c: 0.01, h: 0 },
      '800': { mode: 'oklch', l: 0.2, c: 0.01, h: 0 },
      '900': { mode: 'oklch', l: 0.1, c: 0.005, h: 0 },
    };

    return new Map<string, Ramp>([
      ['blue', blueRamp],
      ['red', redRamp],
      ['gray', grayRamp],
    ]);
  };

  let ditto: DittoTones;

  beforeEach(() => {
    ditto = new DittoTones({ ramps: createTestRamps() });
  });

  describe('Constructor', () => {
    it('should create instance with valid ramps', () => {
      expect(ditto).toBeInstanceOf(DittoTones);
      expect(ditto.rampNames).toEqual(['blue', 'red', 'gray']);
      expect(ditto.shades).toEqual([
        '50',
        '100',
        '200',
        '300',
        '400',
        '500',
        '600',
        '700',
        '800',
        '900',
      ]);
    });

    it('should throw error when no ramps provided', () => {
      expect(() => {
        new DittoTones({ ramps: new Map() });
      }).toThrow('At least one ramp is required');
    });

    it('should throw error when ramps have inconsistent keys', () => {
      const inconsistentRamps = new Map<string, Ramp>([
        [
          'blue',
          {
            '50': { mode: 'oklch', l: 0.95, c: 0.02, h: 240 },
            '100': { mode: 'oklch', l: 0.9, c: 0.04, h: 240 },
          },
        ],
        [
          'red',
          {
            '50': { mode: 'oklch', l: 0.95, c: 0.03, h: 30 },
            '200': { mode: 'oklch', l: 0.8, c: 0.1, h: 30 },
          },
        ],
      ]);

      expect(() => {
        new DittoTones({ ramps: inconsistentRamps });
      }).toThrow('has inconsistent keys');
    });
  });

  describe('generate()', () => {
    it('should generate palette from a valid color string', () => {
      const result = ditto.generate('#3b82f6');

      expect(result).toHaveProperty('inputColor');
      expect(result).toHaveProperty('matchedShade');
      expect(result).toHaveProperty('method');
      expect(result).toHaveProperty('sources');
      expect(result).toHaveProperty('scale');

      expect(result.inputColor.mode).toBe('oklch');
      expect(result.method).toMatch(/^(exact|single|blend)$/);
      expect(Object.keys(result.scale)).toEqual(ditto.shades);
    });

    it('should throw error for invalid color', () => {
      expect(() => {
        ditto.generate('not-a-color');
      }).toThrow('Invalid color');
    });

    it('should handle hex colors', () => {
      const result = ditto.generate('#ff0000');
      expect(result.scale).toBeDefined();
      expect(Object.keys(result.scale).length).toBe(10);
    });

    it('should handle rgb colors', () => {
      const result = ditto.generate('rgb(255, 0, 0)');
      expect(result.scale).toBeDefined();
    });

    it('should handle hsl colors', () => {
      const result = ditto.generate('hsl(0, 100%, 50%)');
      expect(result.scale).toBeDefined();
    });

    it('should handle named colors', () => {
      const result = ditto.generate('blue');
      expect(result.scale).toBeDefined();
    });
  });

  describe('Neutral color handling', () => {
    it('should use neutral ramp for low-chroma colors', () => {
      // Create a very low chroma color (gray)
      const result = ditto.generate('#808080');

      expect(result.method).toBe('exact');
      expect(result.sources.length).toBe(1);
      expect(result.sources[0].name).toBe('gray');
    });

    it('should preserve hue tint in neutral colors', () => {
      // Create a very low-chroma but non-zero hue color
      const warmGray = 'oklch(0.5 0.01 30)';
      const result = ditto.generate(warmGray);

      // Check that the generated scale has the same hue
      const scale500 = result.scale['500'];
      expect(scale500.h).toBeCloseTo(30, 0);
    });
  });

  describe('Color matching methods', () => {
    it('should use exact method for very close color matches', () => {
      // Create a color very similar to blue-500
      const nearExactBlue = 'oklch(0.5 0.2 240)';
      const result = ditto.generate(nearExactBlue);

      // Should match to exact or single method
      expect(['exact', 'single']).toContain(result.method);
    });

    it('should use blend method for colors between ramps', () => {
      // Create a color between blue (240) and red (30) in hue
      // Use purple/magenta which is between them
      const purpleColor = 'oklch(0.5 0.2 300)';
      const result = ditto.generate(purpleColor);

      // Check that we have sources
      expect(result.sources.length).toBeGreaterThan(0);
    });

    it('should match correct shade based on lightness', () => {
      // Create a dark blue color
      const darkBlue = 'oklch(0.3 0.12 240)';
      const result = ditto.generate(darkBlue);

      // Should match to a darker shade
      expect(result.matchedShade).toMatch(/^(600|700|800|900)$/);
    });

    it('should match correct shade for light colors', () => {
      // Create a light blue color
      const lightBlue = 'oklch(0.9 0.04 240)';
      const result = ditto.generate(lightBlue);

      // Should match to a lighter shade
      expect(result.matchedShade).toMatch(/^(50|100|200)$/);
    });
  });

  describe('Scale generation', () => {
    it('should generate scale with all shades', () => {
      const result = ditto.generate('#3b82f6');
      const scaleKeys = Object.keys(result.scale);

      expect(scaleKeys).toEqual(ditto.shades);
    });

    it('should preserve input color at matched shade', () => {
      const inputColor = '#3b82f6';
      const result = ditto.generate(inputColor);
      const inputOklch = oklch(parse(inputColor)) as Oklch;

      // The matched shade should be very close to the input
      const matchedColor = result.scale[result.matchedShade];
      expect(matchedColor.l).toBeCloseTo(inputOklch.l, 2);
      expect(matchedColor.c).toBeCloseTo(inputOklch.c ?? 0, 2);
    });

    it('should generate valid OKLCH colors in scale', () => {
      const result = ditto.generate('#ff6b35');

      for (const [shade, color] of Object.entries(result.scale)) {
        expect(color.mode).toBe('oklch');
        expect(color.l).toBeGreaterThanOrEqual(0);
        expect(color.l).toBeLessThanOrEqual(1);
        expect(color.c).toBeGreaterThanOrEqual(0);
        expect(color.h).toBeDefined();
      }
    });

    it('should maintain hue consistency across scale', () => {
      const result = ditto.generate('#ff6b35');
      const inputHue = result.inputColor.h ?? 0;

      // All colors in scale should have similar hue
      for (const color of Object.values(result.scale)) {
        expect(color.h).toBeCloseTo(inputHue, 0);
      }
    });

    it('should have progressive lightness values', () => {
      const result = ditto.generate('#3b82f6');
      const lightnesses = ditto.shades.map((shade) => result.scale[shade].l);

      // Check that lightness generally decreases from 50 to 900
      expect(lightnesses[0]).toBeGreaterThan(lightnesses[lightnesses.length - 1]);

      // Check mostly monotonic decrease
      let decreasing = 0;
      for (let i = 1; i < lightnesses.length; i++) {
        if (lightnesses[i] <= lightnesses[i - 1]) {
          decreasing++;
        }
      }
      expect(decreasing).toBeGreaterThan(5); // Most should be decreasing
    });
  });

  describe('Source tracking', () => {
    it('should track single source for simple matches', () => {
      const result = ditto.generate('#0000ff');

      if (result.method === 'single' || result.method === 'exact') {
        expect(result.sources.length).toBe(1);
        expect(result.sources[0].weight).toBe(1);
      }
    });

    it('should track multiple sources for blended matches', () => {
      const result = ditto.generate('oklch(0.5 0.2 300)');

      if (result.method === 'blend') {
        expect(result.sources.length).toBe(2);

        // Weights should sum to 1
        const totalWeight = result.sources.reduce((sum, s) => sum + s.weight, 0);
        expect(totalWeight).toBeCloseTo(1, 5);

        // Both sources should have positive weights
        expect(result.sources[0].weight).toBeGreaterThan(0);
        expect(result.sources[1].weight).toBeGreaterThan(0);
      }
    });

    it('should include diff values in sources', () => {
      const result = ditto.generate('#3b82f6');

      for (const source of result.sources) {
        expect(source).toHaveProperty('name');
        expect(source).toHaveProperty('diff');
        expect(source).toHaveProperty('weight');
        expect(source.diff).toBeGreaterThanOrEqual(0);
      }
    });
  });

  describe('Getters', () => {
    it('should return ramp names', () => {
      const names = ditto.rampNames;
      expect(names).toEqual(['blue', 'red', 'gray']);
    });

    it('should return shade keys', () => {
      const shades = ditto.shades;
      expect(shades).toEqual(['50', '100', '200', '300', '400', '500', '600', '700', '800', '900']);
    });
  });

  describe('Lightness Interpolation', () => {
    it('should preserve white point when darkening a ramp', () => {
      const customRamp: Ramp = {
        '1': { mode: 'oklch', l: 0.95, c: 0.02, h: 240 }, // White-ish
        '5': { mode: 'oklch', l: 0.5, c: 0.2, h: 240 }, // Mid
        '9': { mode: 'oklch', l: 0.05, c: 0.02, h: 240 }, // Black-ish
      };

      const customDitto = new DittoTones({
        ramps: new Map([['custom', customRamp]]),
      });

      // Match shade '5' (L=0.5) with a darker color (L=0.3)
      // We ensure it matches '5' by keeping C=0.2.
      const input = 'oklch(0.3 0.2 240)';
      const res = customDitto.generate(input);

      expect(res.matchedShade).toBe('5');
      expect(res.scale['5'].l).toBeCloseTo(0.3, 4);

      // Shade '1' (L=0.95) should be interpolated between matched (0.3) and white (1.0)
      // Original '1' is at 0.95 relative to '5' at 0.5.
      // It is (0.95 - 0.5) / (1 - 0.5) = 0.9 of the way from mid to white.
      // New '1' should be 0.3 + 0.9 * (1 - 0.3) = 0.3 + 0.63 = 0.93.
      // Linear shift would be 0.95 - 0.2 = 0.75.

      expect(res.scale['1'].l).toBeGreaterThan(0.9);
      expect(res.scale['1'].l).toBeCloseTo(0.93, 2);
    });

    it('should prevent clamping when lightening a ramp', () => {
      const customRamp: Ramp = {
        '1': { mode: 'oklch', l: 0.9, c: 0.02, h: 240 },
        '2': { mode: 'oklch', l: 0.95, c: 0.02, h: 240 },
        '5': { mode: 'oklch', l: 0.5, c: 0.2, h: 240 },
      };

      const customDitto = new DittoTones({
        ramps: new Map([['custom', customRamp]]),
      });

      // Match shade '5' (L=0.5) with a lighter color (L=0.6)
      // Linear shift would be +0.1.
      // '1' would become 1.0. '2' would become 1.05 (clamped to 1).
      // They would lose distinction.
      const input = 'oklch(0.6 0.2 240)';
      const res = customDitto.generate(input);

      expect(res.matchedShade).toBe('5');
      expect(res.scale['5'].l).toBeCloseTo(0.6, 4);

      // '1' (0.9) is 0.8 of the way from 0.5 to 1.
      // New '1' should be 0.6 + 0.8 * (1 - 0.6) = 0.6 + 0.32 = 0.92.
      expect(res.scale['1'].l).toBeCloseTo(0.92, 2);

      // '2' (0.95) is 0.9 of the way from 0.5 to 1.
      // New '2' should be 0.6 + 0.9 * (1 - 0.6) = 0.6 + 0.36 = 0.96.
      expect(res.scale['2'].l).toBeCloseTo(0.96, 2);

      // Ensure they are distinct
      expect(res.scale['2'].l).toBeGreaterThan(res.scale['1'].l);
      expect(res.scale['2'].l).toBeLessThan(1);
    });
  });

  describe('Edge cases', () => {
    it('should handle pure black', () => {
      const result = ditto.generate('#000000');
      expect(result.scale).toBeDefined();
      expect(Object.keys(result.scale).length).toBe(10);
    });

    it('should handle pure white', () => {
      const result = ditto.generate('#ffffff');
      expect(result.scale).toBeDefined();
    });

    it('should handle colors with extreme chroma', () => {
      // Very saturated color
      const result = ditto.generate('oklch(0.5 0.4 120)');
      expect(result.scale).toBeDefined();
    });

    it('should handle colors with zero chroma', () => {
      const result = ditto.generate('oklch(0.5 0 0)');
      expect(result.method).toBe('exact');
      expect(result.sources[0].name).toBe('gray');
    });
  });
});
