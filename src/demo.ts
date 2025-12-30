import { DittoTones } from './index';
import { tailwindRamps } from './ramps/tailwind';
import { tailwindV3Ramps } from './ramps/tailwind-v3';
import { radixRamps } from './ramps/radix';
import { formatCss, formatHex, converter, type Oklch } from 'culori';

type RampSet = 'tailwind' | 'tailwind-v3' | 'radix';
type ColorFormat = 'oklch' | 'oklab' | 'hex';

let currentRampSet: RampSet = 'tailwind';
let currentFormat: ColorFormat = 'oklch';
let ditto = new DittoTones({ ramps: tailwindRamps });

const colorPicker = document.getElementById('colorPicker') as HTMLInputElement;
const hexInput = document.getElementById('hexInput') as HTMLInputElement;
const rampSelector = document.getElementById('rampSelector') as HTMLSelectElement;
const formatSelector = document.getElementById('formatSelector') as HTMLSelectElement;
const methodBadge = document.getElementById('methodBadge')!;
const rampInfo = document.getElementById('rampInfo')!;
const blendViz = document.getElementById('blendViz')!;
const paletteGrid = document.getElementById('paletteGrid')!;
const cssOutput = document.getElementById('cssOutput')!;
const paletteTitle = document.getElementById('paletteTitle')!;
const copyBtn = document.getElementById('copyBtn')!;
const toast = document.getElementById('toast')!;

const face = document.querySelector<HTMLElement>('[data-face]')!;
const logo = document.querySelector<HTMLElement>('.logo');
const eyes = [
  '✿',
  '╹',
  'T',
  '个',
  '≖',
  'ꈍ',
  'ʘ',
  '◕',
  '•',
  'ಠ',
  '눈',
  '◉',
  '◔',
  'Φ',
  '⊙',
  '⨀',
  '☉',
  'σ',
  'ф',
  '￣',
  '✧',
] as const;
const mouths = [
  'ʖ̯ ',
  'ٹ',
  '〇',
  'θ',
  'ᴥ',
  'ゝ',
  'з',
  'ᴗ',
  '‿',
  '_',
  'ω',
  '▽',
  '△',
  '෴',
  'o',
  '.',
  '﹏',
  'ᆺ',
  'ロ',
  'Д',
  '︿',
  '～',
  '∀',
  '_ʖ',
  '(ｴ)',
] as const;
const cheeks = ['♪', '˘', '˚', '•', '♥', '?'] as const;

type Eye = (typeof eyes)[number];

const CHEEK_PROB = 0.05;
const MISMATCH_EYE_PROB = 0.05;

function pickOne<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

function pickDifferentEye(exclude: Eye): Eye {
  const options = eyes.filter((e): e is Eye => e !== exclude);
  return pickOne(options);
}

function buildFace(): string {
  let leftEye: Eye = pickOne(eyes);
  let rightEye: Eye = leftEye;

  // Very rare: one eye differs
  if (Math.random() < MISMATCH_EYE_PROB) {
    if (Math.random() < 0.5) leftEye = pickDifferentEye(rightEye);
    else rightEye = pickDifferentEye(leftEye);
  }

  const mouth = pickOne(mouths);

  const hasCheek = Math.random() < CHEEK_PROB;
  const cheek = hasCheek ? pickOne(cheeks) : '';

  return `${leftEye}${mouth}${rightEye}${cheek}`;
}

function setRandomFace() {
  face.textContent = buildFace();
}

setRandomFace();

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function setLogoPointerVars(clientX: number, clientY: number) {
  if (!logo) return;
  const rect = logo.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return;

  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;

  // Normalize against viewport edges so +/-1 is reached near the browser sides,
  // not after moving a few pixels across the logo.
  const maxDx = Math.max(cx, window.innerWidth - cx);
  const maxDy = Math.max(cy, window.innerHeight - cy);

  const x = maxDx > 0 ? clamp((clientX - cx) / maxDx, -1, 1) : 0;
  const y = maxDy > 0 ? clamp((clientY - cy) / maxDy, -1, 1) : 0;

  logo.style.setProperty('--x', x.toFixed(3));
  logo.style.setProperty('--y', y.toFixed(3));
}

function resetLogoPointerVars() {
  if (!logo) return;
  logo.style.setProperty('--x', '0');
  logo.style.setProperty('--y', '0');
}

window.addEventListener(
  'pointermove',
  (e) => {
    setLogoPointerVars(e.clientX, e.clientY);
  },
  { passive: true }
);

window.addEventListener('blur', () => resetLogoPointerVars());

document.addEventListener('click', () => {
  setRandomFace();
});

function getShades(): string[] {
  return currentRampSet === 'radix'
    ? ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12']
    : ['50', '100', '200', '300', '400', '500', '600', '700', '800', '900', '950'];
}

function getCurrentRamps(): Map<string, Record<string, Oklch>> {
  if (currentRampSet === 'tailwind') return tailwindRamps;
  if (currentRampSet === 'tailwind-v3') return tailwindV3Ramps;
  return radixRamps;
}

function isLightColor(hex: string) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.5;
}

function showToast(message: string) {
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2000);
}

function getRampColors(rampName: string): Record<string, string> {
  const ramps = getCurrentRamps();
  const ramp = ramps.get(rampName);
  if (!ramp) return {};
  const colors: Record<string, string> = {};
  for (const [shade, color] of Object.entries(ramp)) {
    colors[shade] = formatHex(color) || '#000';
  }
  return colors;
}

function roundColorChannels(color: any, precision = 3): any {
  const rounded: any = { mode: color.mode };
  for (const key in color) {
    if (key === 'mode') continue;
    const value = color[key];
    if (typeof value === 'number') {
      rounded[key] = Number(value.toFixed(precision));
    } else {
      rounded[key] = value;
    }
  }
  return rounded;
}

function formatColor(color: Oklch, format: ColorFormat): string {
  switch (format) {
    case 'hex':
      return formatHex(color) || '#000000';
    case 'oklab': {
      const oklab = converter('oklab');
      const converted = oklab(color);
      return formatCss(roundColorChannels(converted, 3)) || 'oklab(0 0 0)';
    }
    case 'oklch':
    default:
      return formatCss(roundColorChannels(color, 3)) || 'oklch(0 0 0)';
  }
}

function toCSS(
  result: ReturnType<typeof ditto.generate>,
  name = 'color',
  format: ColorFormat = 'oklch'
) {
  const info = result.sources.map((r) => `${r.name} (${(r.weight * 100).toFixed(0)}%)`).join(' + ');
  const lines = [`  /* ${name}: ${result.method} from ${info} @ shade ${result.matchedShade} */`];
  for (const [shade, color] of Object.entries(result.scale)) {
    lines.push(`  --${name}-${shade}: ${formatColor(color, format)};`);
  }
  return `:root {\n${lines.join('\n')}\n}`;
}

function renderRampBar(rampName: string, matchedShade: string): string {
  const colors = getRampColors(rampName);
  const shades = getShades();
  return shades
    .map((s) => {
      const bg = colors[s] || '#000';
      const fg = isLightColor(bg) ? '#18181b' : '#fafafa';
      const matched = s === matchedShade ? 'matched' : '';
      return `<div class="shade-block ${matched}" style="--cc:${bg};color:${fg}">${s}</div>`;
    })
    .join('');
}

function getPaletteNameFromTitle(title: string | null | undefined): string {
  const raw = (title || '').trim();
  if (!raw) return 'Palette';

  const prefix = 'Generated Palette:';
  if (raw.startsWith(prefix)) {
    const name = raw.slice(prefix.length).trim();
    return name || 'Palette';
  }

  if (raw === 'Generated Palette') return 'Palette';
  return raw;
}

function renderBlendViz(result: ReturnType<typeof ditto.generate>) {
  blendViz.innerHTML = '';
  const shades = getShades();

  const src1 = result.sources[0];
  const src2 = result.sources[1];

  const row1 = document.createElement('div');
  row1.className = 'ramp-row';
  if (src1) {
    const w1 = result.sources.length === 2 ? src1.weight : 1;
    row1.innerHTML = `
      <div class="ramp-label">${src1.name}<br><span class="weight">${(w1 * 100).toFixed(0)}%</span></div>
      <div class="ramp-bar">${renderRampBar(src1.name, result.matchedShade)}</div>
    `;
  }

  const paletteRow = document.createElement('div');
  paletteRow.className = 'ramp-row blend-palette-row';

  const paletteLabel = document.createElement('div');
  paletteLabel.className = 'ramp-label';

  const paletteBar = document.createElement('div');
  paletteBar.className = 'ramp-bar blend-palette-bar';

  paletteLabel.textContent =
    result.method === 'exact' ? '' : getPaletteNameFromTitle(paletteTitle.textContent);

  for (const shade of shades) {
    const oklchColor = result.scale[shade];
    if (!oklchColor) continue;

    const hex = formatHex(oklchColor) || '#000';
    const css = formatCss(oklchColor) || '';

    const div = document.createElement('div');
    div.className = `shade ${isLightColor(hex) ? 'dark-text' : 'light-text'}`;
    if (shade === result.matchedShade) div.classList.add('matched');
    div.style.setProperty('--cc', css);
    div.innerHTML = `<div class="shade__label"><span class="shade-key">${shade}</span><span class="shade-value">${hex}</span></div>`;
    div.title = `Click to copy ${css}`;
    div.addEventListener('click', () => {
      navigator.clipboard.writeText(css);
      showToast(`Copied ${css}`);
    });
    paletteBar.appendChild(div);
  }

  paletteRow.appendChild(paletteLabel);
  paletteRow.appendChild(paletteBar);

  const row3 = document.createElement('div');
  row3.className = 'ramp-row';
  if (src2) {
    const w2 = result.sources.length === 2 ? src2.weight : 0;
    row3.innerHTML = `
      <div class="ramp-label">${src2.name}<br><span class="weight">${(w2 * 100).toFixed(0)}%</span></div>
      <div class="ramp-bar">${renderRampBar(src2.name, result.matchedShade)}</div>
    `;
  }

  blendViz.appendChild(row1);
  blendViz.appendChild(paletteRow);
  blendViz.appendChild(row3);
}

function sanitizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

let nameFetchTimeout: any;
let lastResult: ReturnType<typeof ditto.generate> | null = null;

async function fetchAndApplyName(result: ReturnType<typeof ditto.generate>) {
  try {
    const shades = getShades();
    const middleShade = shades[Math.floor((shades.length - 1) / 2)];
    const middleColor = result.scale[middleShade];

    if (!middleColor) return;

    const hex = formatHex(middleColor).replace('#', '');
    const response = await fetch(
      `https://api.color.pizza/v1/?values=${hex}&list=bestOf&noduplicates=true`
    );
    const data = await response.json();
    const name = data.colors?.[0]?.name;

    if (name) {
      const safeName = sanitizeName(name);
      paletteTitle.textContent = `Generated Palette: ${name}`;
      cssOutput.textContent = toCSS(result, safeName, currentFormat);

      if (lastResult) renderBlendViz(lastResult);
    }
  } catch (e) {
    console.error('Failed to fetch color name', e);
  }
}

function updatePalette(color: string) {
  try {
    const result = ditto.generate(color);
    lastResult = result;
    const shades = getShades();

    methodBadge.textContent = result.method;
    methodBadge.className = `method-badge method-${result.method}`;

    rampInfo.innerHTML =
      result.sources
        .map(
          (r) =>
            `<span class="ramp-name">${r.name}</span> <span class="ramp-weight">(${(r.weight * 100).toFixed(0)}%)</span>`
        )
        .join(' + ') + ` @ shade <strong>${result.matchedShade}</strong>`;

    renderBlendViz(result);

    // Update grid columns based on shade count
    paletteGrid.style.gridTemplateColumns = `repeat(${shades.length}, 1fr)`;

    paletteGrid.innerHTML = '';
    for (const shade of shades) {
      const oklchColor = result.scale[shade];
      if (!oklchColor) continue;

      const hex = formatHex(oklchColor) || '#000';
      const css = formatCss(oklchColor) || '';

      const div = document.createElement('div');
      div.className = `shade ${isLightColor(hex) ? 'dark-text' : 'light-text'}`;
      if (shade === result.matchedShade) div.classList.add('matched');
      div.style.setProperty('--cc', css);
      div.innerHTML = `<div class="shade__label"><span class="shade-key">${shade}</span><span class="shade-value">${hex}</span></div>`;
      div.title = `Click to copy ${css}`;
      div.addEventListener('click', () => {
        navigator.clipboard.writeText(css);
        showToast(`Copied ${css}`);
      });
      paletteGrid.appendChild(div);
    }

    cssOutput.textContent = toCSS(result, 'brand', currentFormat);

    // Debounce name fetching
    if (nameFetchTimeout) clearTimeout(nameFetchTimeout);
    nameFetchTimeout = setTimeout(() => {
      fetchAndApplyName(result);
    }, 100);
  } catch (e) {
    console.error(e);
  }
}

colorPicker.addEventListener('input', (e) => {
  const color = (e.target as HTMLInputElement).value;
  hexInput.value = color.toUpperCase();
  updatePalette(color);
  setRandomFace();
});

hexInput.addEventListener('input', (e) => {
  let value = (e.target as HTMLInputElement).value;
  if (!value.startsWith('#')) value = '#' + value;
  if (/^#[0-9A-Fa-f]{6}$/.test(value)) {
    colorPicker.value = value;
    updatePalette(value);
    setRandomFace();
  }
});

rampSelector.addEventListener('change', (e) => {
  currentRampSet = (e.target as HTMLSelectElement).value as RampSet;
  ditto = new DittoTones({ ramps: getCurrentRamps() });
  updatePalette(colorPicker.value);
});

formatSelector.addEventListener('change', (e) => {
  currentFormat = (e.target as HTMLSelectElement).value as ColorFormat;
  updatePalette(colorPicker.value);
});

copyBtn.addEventListener('click', () => {
  navigator.clipboard.writeText(cssOutput.textContent || '');
  showToast('Copied CSS to clipboard!');
});

updatePalette(colorPicker.value);
