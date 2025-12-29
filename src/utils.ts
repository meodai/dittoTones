import { formatCss, round, type Color } from 'culori';

export function formatCssRounded(color: undefined): undefined;
export function formatCssRounded(color: Color): string;
export function formatCssRounded(
  color: undefined | string | Color,
  decimals = 3
): string | undefined {
  const cssStr = formatCss(color);

  if (!cssStr) return;

  let roundNumber = round(decimals);

  const roundedStr = cssStr.replace(/(\d?\.\d+)/g, (match) => {
    return roundNumber(parseFloat(match)).toFixed(decimals);
  });

  return roundedStr;
}
