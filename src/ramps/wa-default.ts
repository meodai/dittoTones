import { parse, oklch, type Oklch } from 'culori';
import { waDefaultColors } from './raw/wa-default';

export type Ramp = Record<string, Oklch>;

export const waDefaultRamps = new Map<string, Ramp>(
  Object.entries(waDefaultColors).map(([key, value]) => [
    key,
    Object.fromEntries(
      Object.entries(value).map(([shade, color]) => [shade, oklch(parse(color)) as Oklch])
    ),
  ])
);

export default waDefaultRamps;
