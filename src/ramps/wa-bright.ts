import { parse, oklch, type Oklch } from 'culori';
import { waBrightColors } from './raw/wa-bright';

export type Ramp = Record<string, Oklch>;

export const waBrightRamps = new Map<string, Ramp>(
  Object.entries(waBrightColors).map(([key, value]) => [
    key,
    Object.fromEntries(
      Object.entries(value).map(([shade, color]) => [shade, oklch(parse(color)) as Oklch])
    ),
  ])
);

export default waBrightRamps;
