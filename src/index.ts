import { oklch, parse, interpolate, differenceEuclidean, toGamut, type Oklch } from 'culori';

export type Ramp = Record<string, Oklch>;
export type { Oklch };

export interface DittoTonesOptions {
  ramps: Map<string, Ramp>;
  /** Preserve hue offsets from reference ramps (default: false) */
  preserveHueOffsets?: boolean;
  /** Map output to sRGB gamut (default: true) */
  gamutMap?: boolean;
}

export interface GenerateResult {
  inputColor: Oklch;
  matchedShade: string;
  method: 'exact' | 'single' | 'blend';
  sources: { name: string; diff: number; weight: number }[];
  scale: Record<string, Oklch>;
}

export class DittoTones {
  private ramps: Map<string, Ramp>;
  private shadeKeys: string[];
  private diff: (a: Oklch, b: Oklch) => number;
  private neutralRampName: string;
  private preserveHueOffsets: boolean;
  private gamutMapEnabled: boolean;

  private static EXACT_THRESHOLD = 0.02;
  private static NEUTRAL_CHROMA = 0.02;

  constructor(options: DittoTonesOptions) {
    this.ramps = options.ramps;
    const firstRamp = this.ramps.values().next().value;
    if (!firstRamp) throw new Error('At least one ramp is required');
    this.shadeKeys = Object.keys(firstRamp);

    // Validate keys
    for (const [name, ramp] of this.ramps) {
      const keys = Object.keys(ramp);
      if (keys.length !== this.shadeKeys.length || !keys.every((k) => this.shadeKeys.includes(k))) {
        throw new Error(`Ramp ${name} has inconsistent keys`);
      }
    }

    this.diff = differenceEuclidean('oklch');
    this.preserveHueOffsets = options.preserveHueOffsets ?? false;
    this.gamutMapEnabled = options.gamutMap ?? true;

    const neutral = this.findBestNeutralRamp();
    this.neutralRampName = neutral.name;
    if (neutral.avgChroma > DittoTones.NEUTRAL_CHROMA) {
      console.warn(
        `dittoTones: no neutral ramp detected — the least chromatic ramp "${neutral.name}" ` +
          `(avg chroma ${neutral.avgChroma.toFixed(3)}) will be used for low-chroma inputs.`
      );
    }
  }

  private findBestNeutralRamp(): { name: string; avgChroma: number } {
    let best = { name: '', avgChroma: Infinity };
    for (const [rampName, ramp] of this.ramps) {
      let total = 0,
        count = 0;
      for (const c of Object.values(ramp)) {
        if (c) {
          total += c.c ?? 0;
          count++;
        }
      }
      const avg = count > 0 ? total / count : Infinity;
      if (avg < best.avgChroma) best = { name: rampName, avgChroma: avg };
    }
    return best;
  }

  generate(color: string): GenerateResult {
    const parsed = oklch(parse(color));
    if (!parsed) throw new Error(`Invalid color: ${color}`);

    if ((parsed.c ?? 0) < DittoTones.NEUTRAL_CHROMA) {
      return this.generateNeutral(parsed);
    }

    const { rampName, shade, diff } = this.findClosestMatch(parsed);

    if (diff < DittoTones.EXACT_THRESHOLD) {
      return this.generateFromSingleRamp(parsed, rampName, shade, diff);
    }

    const second = this.findSecondClosest(parsed, shade, rampName);
    if (!second) {
      return this.generateFromSingleRamp(parsed, rampName, shade, diff);
    }

    return this.generateBlended(parsed, shade, rampName, diff, second.rampName, second.diff);
  }

  private findClosestMatch(color: Oklch) {
    let best = { rampName: '', shade: '', diff: Infinity };
    for (const [rampName, ramp] of this.ramps) {
      for (const [shade, rampColor] of Object.entries(ramp)) {
        if (!rampColor) continue;
        const distance = this.diff(color, rampColor as Oklch);
        if (distance < best.diff) best = { rampName, shade, diff: distance };
      }
    }
    return best;
  }

  private findSecondClosest(color: Oklch, shade: string, excludeRamp: string) {
    let best: { rampName: string; diff: number } | null = null;

    for (const [rampName, ramp] of this.ramps) {
      if (rampName === excludeRamp) continue;
      const rampColor = ramp[shade];
      if (!rampColor || (rampColor.c ?? 0) < DittoTones.NEUTRAL_CHROMA) continue;

      const distance = this.diff(color, rampColor as Oklch);

      if (!best || distance < best.diff) {
        best = { rampName, diff: distance };
      }
    }

    return best;
  }

  private generateNeutral(parsed: Oklch): GenerateResult {
    const rampName = this.neutralRampName;
    const ramp = this.ramps.get(rampName)!;
    const shade = this.findClosestShadeInRamp(parsed, ramp);

    // Compute actual distance to the closest neutral shade
    const matchedInRamp = ramp[shade];
    const diff = matchedInRamp ? this.diff(parsed, matchedInRamp as Oklch) : 0;

    // buildScale preserves any hue tint and chroma tint from the input (its
    // low-chroma branch shifts chroma additively), and rescales lightness with
    // the same piecewise-linear mapping as chromatic scales. For achromatic
    // input (h: undefined) it keeps each shade's own ramp hue.
    const scale = this.buildScale(ramp, parsed, shade);

    return {
      inputColor: parsed,
      matchedShade: shade,
      method: diff < DittoTones.EXACT_THRESHOLD ? 'exact' : 'single',
      sources: [{ name: rampName, diff, weight: 1 }],
      scale,
    };
  }

  private generateFromSingleRamp(
    parsed: Oklch,
    rampName: string,
    shade: string,
    diff: number
  ): GenerateResult {
    const ramp = this.ramps.get(rampName)!;
    const scale = this.buildScale(ramp, parsed, shade);
    return {
      inputColor: parsed,
      matchedShade: shade,
      method: diff < DittoTones.EXACT_THRESHOLD ? 'exact' : 'single',
      sources: [{ name: rampName, diff, weight: 1 }],
      scale,
    };
  }

  private generateBlended(
    parsed: Oklch,
    shade: string,
    ramp1Name: string,
    diff1: number,
    ramp2Name: string,
    diff2: number
  ): GenerateResult {
    const ramp1 = this.ramps.get(ramp1Name)!;
    const ramp2 = this.ramps.get(ramp2Name)!;
    const t = diff1 + diff2 > 0 ? diff1 / (diff1 + diff2) : 0.5;

    const blendedRamp: Ramp = {};
    for (const shadeKey of this.shadeKeys) {
      const c1 = ramp1[shadeKey] as Oklch,
        c2 = ramp2[shadeKey] as Oklch;
      if (!c1 || !c2) continue;
      // Blend in oklab (rectangular) rather than oklch: hue interpolation can't
      // wrap the wrong way. The slight chroma loss when the ramps' hues differ
      // is re-anchored to the input chroma by buildScale afterwards.
      blendedRamp[shadeKey] = oklch(interpolate([c1, c2], 'oklab')(t)) as Oklch;
    }

    const scale = this.buildScale(blendedRamp, parsed, shade);

    return {
      inputColor: parsed,
      matchedShade: shade,
      method: 'blend',
      sources: [
        { name: ramp1Name, diff: diff1, weight: 1 - t },
        { name: ramp2Name, diff: diff2, weight: t },
      ],
      scale,
    };
  }

  private findClosestShadeInRamp(color: Oklch, ramp: Ramp) {
    let best = { shade: '', diff: Infinity };
    for (const [shade, c] of Object.entries(ramp)) {
      if (!c) continue;
      const d = this.diff(color, c as Oklch);
      if (d < best.diff) best = { shade, diff: d };
    }
    return best.shade;
  }

  private buildScale(ramp: Ramp, target: Oklch, matchedShade: string): Record<string, Oklch> {
    // Achromatic input (e.g. pure gray) has h: undefined — keep each shade's
    // own ramp hue instead of falling back to hue 0 (red).
    const targetHue = target.h;
    const matchedPt = ramp[matchedShade];
    const matchedHue = matchedPt?.h ?? 0;

    const rotated: Record<string, Oklch> = {};
    for (const [shade, pt] of Object.entries(ramp)) {
      if (!pt) continue;
      let h = targetHue ?? pt.h;
      if (this.preserveHueOffsets && targetHue !== undefined) {
        // Preserve hue offsets from the reference ramp relative to the matched shade.
        // Real design-system ramps often have deliberate hue shifts across the lightness
        // range (e.g., Tailwind blues shift toward purple in dark shades).
        const ptHue = pt.h ?? 0;
        let hueOffset = ptHue - matchedHue;
        if (hueOffset > 180) hueOffset -= 360;
        if (hueOffset < -180) hueOffset += 360;
        h = targetHue + hueOffset;
        if (h < 0) h += 360;
        if (h >= 360) h -= 360;
      }
      rotated[shade] = { mode: 'oklch', l: pt.l, c: pt.c ?? 0, h };
    }

    const generated = rotated[matchedShade];
    if (!generated) {
      return rotated;
    }

    // Instead of a constant shift (L + delta), we use piecewise linear interpolation
    // anchored at 0 and 1. This prevents:
    // 1. Lighter shades becoming too dark when the matched shade is darkened
    // 2. Lighter shades getting clamped to white (and losing distinction) when lightened
    const scaleL = (l: number) => {
      if (Math.abs(l - generated.l) < 0.000001) return target.l;

      if (l < generated.l) {
        if (generated.l <= 0.000001) return target.l;
        return l * (target.l / generated.l);
      } else {
        if (generated.l >= 0.999999) return target.l;
        return target.l + ((l - generated.l) * (1 - target.l)) / (1 - generated.l);
      }
    };

    const targetC = target.c ?? 0;
    const generatedC = generated.c ?? 0;

    let scaleC: (c: number) => number;
    if (generatedC > DittoTones.NEUTRAL_CHROMA) {
      const ratio = targetC / generatedC;
      if (targetC > generatedC) {
        const logGenC = Math.log(generatedC);
        // Guard against degenerate k when generatedC is near 1.0 (log ≈ 0)
        // or when log values would produce extreme exponents
        if (Math.abs(logGenC) < 1e-6) {
          scaleC = (c) => c * ratio;
        } else {
          const k = Math.log(targetC) / logGenC;
          // Clamp k to a sane range to prevent extreme pow() results
          const safeK = Math.max(-10, Math.min(10, k));
          scaleC = (c) => {
            if (c <= 0) return 0;
            return Math.min(c * ratio, Math.pow(c, safeK));
          };
        }
      } else {
        scaleC = (c) => c * ratio;
      }
    } else {
      const diff = targetC - generatedC;
      scaleC = (c) => c + diff;
    }

    const gamutMap = this.gamutMapEnabled ? toGamut('rgb', 'oklch') : null;
    const scale: Record<string, Oklch> = {};
    for (const [shade, color] of Object.entries(rotated)) {
      const raw: Oklch = {
        mode: 'oklch',
        l: Math.max(0, Math.min(1, scaleL(color.l))),
        c: Math.max(0, scaleC(color.c ?? 0)),
        h: color.h,
      };
      scale[shade] = gamutMap ? (oklch(gamutMap(raw)) as Oklch) : raw;
    }

    return scale;
  }

  get rampNames() {
    return Array.from(this.ramps.keys());
  }
  get shades() {
    return this.shadeKeys;
  }
}
