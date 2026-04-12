import { parse, oklch, type Oklch } from 'culori';
import { flexokiColors } from './raw/flexoki';

export type Ramp = Record<string, Oklch>;

export const flexokiRamps = new Map<string, Ramp>(
  Object.entries(flexokiColors).map(([key, value]) => [
    key,
    Object.fromEntries(
      Object.entries(value).map(([shade, color]) => [shade, oklch(parse(color)) as Oklch])
    ),
  ])
);

export default flexokiRamps;
