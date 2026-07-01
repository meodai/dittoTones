# dittoTones 🟣

A mini-library to transform any color into a full palette, based on the perceptual "DNA" of any design system.

![dittotones.png](dittotones.png)

Demo: https://meodai.github.io/dittoTones/

## Why

Most palette generators for popular frameworks either match a single color or ignore the careful work that was put into creating the original palettes entirely. dittoTones takes a different approach: it analyzes the perceptual "DNA" (Lightness and Chroma curves in Oklch space) of popular design systems like Tailwind or Radix. It then maps your target hue onto these curves, ensuring your custom palette maintains similar accessible contrast ratios and vibrancy as the reference system.

## Install

```bash
npm install dittotones
```

## Usage

```typescript
import { DittoTones } from 'dittotones';
import { tailwindRamps } from 'dittotones/ramps/tailwind';
import { formatCss, formatHex } from 'culori';

const ditto = new DittoTones({ ramps: tailwindRamps });

const result = ditto.generate('#F97316');

// result.scale contains Oklch color objects
// Use culori's formatCss or formatHex to convert:

for (const [shade, color] of Object.entries(result.scale)) {
  console.log(`${shade}: ${formatHex(color)}`);
  // 50: #fff6f0
  // 100: #ffe9da
  // ...
  // 500: #f97316  ← your input, at its matched shade
  // ...
  // 950: #3f1701
}

// Or keep them as CSS oklch() strings:
for (const [shade, color] of Object.entries(result.scale)) {
  console.log(`${shade}: ${formatCss(color)}`);
  // 50: oklch(0.978 0.013 55.3)
  // ...
}
```

## Bundled ramps

Reference ramps for several design systems ship with the package. Each is a
`Map<string, Ramp>` you can pass straight to the `ramps` option, importable as
a subpath so you only bundle the data you use:

```typescript
import { tailwindRamps } from 'dittotones/ramps/tailwind';
import { radixRamps } from 'dittotones/ramps/radix';
import flexokiRamps from 'dittotones/ramps/flexoki'; // default export works too
```

| Import                         | Design system                                          | Ramps | Shade keys            |
| ------------------------------ | ------------------------------------------------------ | ----- | --------------------- |
| `dittotones/ramps/tailwind`    | [Tailwind CSS v4](https://tailwindcss.com/docs/colors) | 22    | `50`–`950` (11 steps) |
| `dittotones/ramps/tailwind-v3` | Tailwind CSS v3                                        | 22    | `50`–`950` (11 steps) |
| `dittotones/ramps/radix`       | [Radix Colors](https://www.radix-ui.com/colors)        | 31    | `1`–`12`              |
| `dittotones/ramps/flexoki`     | [Flexoki](https://stephango.com/flexoki)               | 9     | `50`–`950` (13 steps) |
| `dittotones/ramps/shoelace`    | [Shoelace](https://shoelace.style/tokens/color)        | 10    | `05`–`95`             |
| `dittotones/ramps/wa-default`  | [Web Awesome](https://webawesome.com/) (default)       | 10    | `05`–`95`             |
| `dittotones/ramps/wa-bright`   | Web Awesome (bright)                                   | 10    | `05`–`95`             |

All bundled ramp data comes from MIT-licensed projects; copyright remains with
the respective authors — Tailwind Labs, Inc. (Tailwind CSS), Modulz (Radix
Colors), Steph Ango (Flexoki), and Fonticons, Inc. (Shoelace / Web Awesome).
Source and license are noted in each data file.

## Result

```typescript
interface GenerateResult {
  inputColor: Oklch; // Parsed input color
  matchedShade: string; // e.g. "500"
  method: 'exact' | 'single' | 'blend';
  sources: {
    name: string; // Reference ramp name, e.g. "orange"
    diff: number; // OKLCH Euclidean distance to its matched shade
    weight: number; // Contribution to the result (all weights sum to 1)
  }[];
  scale: Record<string, Oklch>; // The generated palette
}
```

- **`method`** tells you how the palette was built:
  - `exact` — the input sits almost exactly on a reference shade; that ramp is used as-is
  - `single` — one ramp was close enough to use alone
  - `blend` — the two nearest ramps were interpolated to approximate the input's character
- **`diff`** is the Euclidean distance in OKLCH between the input and the source's matched shade — lower means a closer match.
- **`weight`** is each source's share of a blend (`1` for `exact`/`single`).

## How it works

1. **Parse input** — converts the input into `Oklch` via `culori`
2. **Handle neutrals** — if chroma is very low, picks the “most neutral” ramp (warning if none is actually neutral), preserves the input’s hue/chroma tint (or the ramp’s own tint for pure grays), and rescales lightness around the matched shade
3. **Find closest match** — finds the nearest ramp color by Euclidean distance in OKLCH (`diff`)
4. **Pick strategy** — `exact` if `diff` is below a small threshold, otherwise `single` (one ramp) or `blend` (two ramps; second ramp chosen by Euclidean distance in OKLCH at the matched shade, blended in Cartesian OKLAB to preserve chroma)
5. **Rotate hue + correct L/C** — sets the target hue across the scale (optionally preserving hue offsets from reference ramps), then adjusts lightness and chroma:
   - **Lightness**: Uses piecewise linear interpolation anchored at 0 (black) and 1 (white). This ensures the matched shade hits the target lightness exactly, while preventing lighter shades from being clamped to white or becoming too dark.
   - **Chroma**: Uses a hybrid approach. If the target chroma is higher than the reference, it applies **linear scaling** for lower chroma values (preserving delicate pastels) and **power curve scaling** for higher chroma values (preventing oversaturation in the most colorful shades). If the target chroma is lower, it uses a constant offset.

## Custom ramps

Any `Map<string, Ramp>` works — extract the DNA of your own design system:

```typescript
import { DittoTones } from 'dittotones';
import { parse, oklch, type Oklch } from 'culori';

const customRamps = new Map([
  [
    'brand',
    {
      '50': oklch(parse('oklch(98% 0.01 250)')) as Oklch,
      '500': oklch(parse('#3B82F6')) as Oklch,
      '950': oklch(parse('oklch(25% 0.05 250)')) as Oklch,
    },
  ],
]);

const ditto = new DittoTones({ ramps: customRamps });
```

Two constraints to be aware of:

- **All ramps must share the same shade keys.** The constructor throws if a
  ramp has different or missing keys.
- **Include a neutral (gray) ramp** if you expect low-chroma input. Grayish
  colors are matched against the least chromatic ramp; if none of your ramps
  is actually neutral, dittoTones warns and uses the closest thing it has.

## Options

```typescript
const ditto = new DittoTones({
  ramps: myRamps,
  // Preserve hue shifts from reference ramps across the scale.
  // e.g. Tailwind blues shift toward purple in dark shades.
  // Default: false (flat hue across all shades)
  preserveHueOffsets: true,
  // Map output colors to sRGB gamut by reducing chroma.
  // Prevents out-of-gamut colors when converting to hex.
  // Default: true — set to false to keep raw OKLCH values
  // (e.g. when targeting Display P3 or doing your own mapping)
  gamutMap: false,
});
```

## Dev

```bash
npm install
npm run dev     # Start dev server with demo
npm run build   # Build library
npm run preview # Preview the demo build
npm test        # Run tests in watch mode
```

## Notes

- ESM-first (`"type": "module"`), with CJS entries for `require()`.
- TypeScript types included; the `Oklch` type is re-exported from `culori`.

## Flowchart

```text
      Input Color
           │
           ▼
     Parse to OKLCH
           │
           ▼
   Is chroma very low?
     ┌─────┴─────┐
     ▼           ▼
    yes          no
     │           │
     ▼           ▼
 Use most     Find closest ramp
 neutral      + matched shade
 ramp             │
     │            │
     │            ▼
     │   Is diff below threshold?
     │       ┌────┴────┐
     │       ▼         ▼
     │      yes        no
     │       │         │
     │       ▼         ▼
     │  Use single   Pick second ramp
     │     ramp      (closest by OKLCH
     │               distance at shade)
     │                 │
     │           ┌─────┴─────┐
     │           ▼           ▼
     │          none       found
     │           │           │
     │           ▼           ▼
     │      Use single   Blend ramps
     │         ramp      (weighted)
     │           │           │
     └──────┬────┴──────┬────┘
            │           │
            ▼           ▼
      Rotate hue + correct L/C
                 │
                 ▼
         Generated Palette
```

## Changelog

### Unreleased

- **Breaking:** `gamutMap` now defaults to `true` — output is mapped into sRGB
  by reducing chroma. Pass `gamutMap: false` for the previous behavior.
- Reference ramps are now published as package subpaths
  (`dittotones/ramps/tailwind`, `dittotones/ramps/radix`, …).
- Added the Flexoki `base` (gray) ramp.
- Achromatic input (pure grays) now keeps the neutral ramp's own hue tint
  instead of tinting the scale red.
- Neutral scales rescale lightness around the matched shade, matching the
  behavior of chromatic scales.
- A warning is emitted when no near-neutral ramp exists in the provided set.

## Credits

Built with [Culori](https://culorijs.org/) for color math and interpolation.

Bundled reference palettes are the work of their respective design systems:
[Tailwind CSS](https://github.com/tailwindlabs/tailwindcss) (MIT, Tailwind
Labs, Inc.), [Radix Colors](https://github.com/radix-ui/colors) (MIT, Modulz),
[Flexoki](https://github.com/kepano/flexoki) (MIT, Steph Ango), and
[Shoelace / Web Awesome](https://github.com/shoelace-style/webawesome) (MIT,
Fonticons, Inc.).

## License

MIT
