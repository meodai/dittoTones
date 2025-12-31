import { parse, oklch, type Oklch } from 'culori';
import { shoelaceColors } from './raw/shoelace';

export type Ramp = Record<string, Oklch>;

export const shoelaceRamps = new Map<string, Ramp>(
  Object.entries(shoelaceColors).map(([key, value]) => [
    key,
    Object.fromEntries(
      Object.entries(value).map(([shade, color]) => [shade, oklch(parse(color)) as Oklch])
    ),
  ])
);

export default shoelaceRamps;
