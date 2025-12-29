import { DittoTones } from './index';
import { tailwindRamps } from './ramps/tailwind';
import { radixRamps } from './ramps/radix';
import { formatCss, formatHex, type Oklch } from 'culori';

type RampSet = 'tailwind' | 'radix';

let currentRampSet: RampSet = 'tailwind';
let ditto = new DittoTones({ ramps: tailwindRamps });

const colorPicker = document.getElementById('colorPicker') as HTMLInputElement;
const hexInput = document.getElementById('hexInput') as HTMLInputElement;
const rampSelector = document.getElementById('rampSelector') as HTMLSelectElement;
const methodBadge = document.getElementById('methodBadge')!;
const rampInfo = document.getElementById('rampInfo')!;
const blendViz = document.getElementById('blendViz')!;
const paletteGrid = document.getElementById('paletteGrid')!;
const cssOutput = document.getElementById('cssOutput')!;
const copyBtn = document.getElementById('copyBtn')!;
const toast = document.getElementById('toast')!;

function getShades(): string[] {
  return currentRampSet === 'tailwind' 
    ? ['50', '100', '200', '300', '400', '500', '600', '700', '800', '900', '950']
    : ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'];
}

function getCurrentRamps(): Map<string, Record<string, Oklch>> {
  return currentRampSet === 'tailwind' ? tailwindRamps : radixRamps;
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

function toCSS(result: ReturnType<typeof ditto.generate>, name = 'color') {
  const info = result.sources.map(r => `${r.name} (${(r.weight * 100).toFixed(0)}%)`).join(' + ');
  const lines = [`  /* ${name}: ${result.method} from ${info} @ shade ${result.matchedShade} */`];
  for (const [shade, color] of Object.entries(result.scale)) {
    lines.push(`  --${name}-${shade}: ${formatCss(color)};`);
  }
  return `:root {\n${lines.join('\n')}\n}`;
}

function renderRampBar(rampName: string, matchedShade: string): string {
  const colors = getRampColors(rampName);
  const shades = getShades();
  return shades.map(s => {
    const bg = colors[s] || '#000';
    const fg = isLightColor(bg) ? '#18181b' : '#fafafa';
    const matched = s === matchedShade ? 'matched' : '';
    return `<div class="shade-block ${matched}" style="background:${bg};color:${fg}">${s}</div>`;
  }).join('');
}

function renderBlendViz(result: ReturnType<typeof ditto.generate>, inputColor: string) {
  blendViz.innerHTML = '';
  const shades = getShades();
  const shadeIndex = shades.indexOf(result.matchedShade);
  const shadeX = (shadeIndex + 0.5) / shades.length * 100;

  if (result.method === 'blend' && result.sources.length === 2) {
    const [src1, src2] = result.sources;
    const t = src2.weight;

    const row1 = document.createElement('div');
    row1.className = 'ramp-row';
    row1.innerHTML = `
      <div class="ramp-label">${src1.name}<br><span class="weight">${(src1.weight * 100).toFixed(0)}%</span></div>
      <div class="ramp-bar">${renderRampBar(src1.name, result.matchedShade)}</div>
    `;
    blendViz.appendChild(row1);

    const indicator = document.createElement('div');
    indicator.className = 'blend-indicator';
    const yPos = t * 100;
    indicator.innerHTML = `
      <svg width="100%" height="48">
        <line x1="${shadeX}%" y1="0" x2="${shadeX}%" y2="48" stroke="currentColor" stroke-width="1" stroke-dasharray="3,3"/>
        <circle cx="${shadeX}%" cy="${yPos * 0.48}" r="10" fill="${inputColor}" stroke="currentColor" stroke-width="1"/>
        <text x="${shadeX}%" y="${yPos * 0.48}" text-anchor="middle" dominant-baseline="central" fill="${isLightColor(inputColor) ? '#18181b' : '#fafafa'}" font-size="6" font-weight="600">${t.toFixed(2)}</text>
      </svg>
    `;
    blendViz.appendChild(indicator);

    const row2 = document.createElement('div');
    row2.className = 'ramp-row';
    row2.innerHTML = `
      <div class="ramp-label">${src2.name}<br><span class="weight">${(src2.weight * 100).toFixed(0)}%</span></div>
      <div class="ramp-bar">${renderRampBar(src2.name, result.matchedShade)}</div>
    `;
    blendViz.appendChild(row2);

  } else {
    const src = result.sources[0];
    const row = document.createElement('div');
    row.className = 'ramp-row';
    row.innerHTML = `
      <div class="ramp-label">${src.name}<br><span class="weight">100%</span></div>
      <div class="ramp-bar">${renderRampBar(src.name, result.matchedShade)}</div>
    `;
    blendViz.appendChild(row);

    const indicator = document.createElement('div');
    indicator.className = 'blend-indicator';
    indicator.style.height = '84px';
    indicator.innerHTML = `
      <svg width="100%" height="28">
        <line x1="${shadeX}%" y1="0" x2="${shadeX}%" y2="14" stroke="currentColor" stroke-width="1"/>
        <circle cx="${shadeX}%" cy="20" r="8" fill="${inputColor}" stroke="currentColor" stroke-width="1"/>
      </svg>
    `;
    blendViz.appendChild(indicator);
  }
}

function updatePalette(color: string) {
  try {
    const result = ditto.generate(color);
    const shades = getShades();

    methodBadge.textContent = result.method;
    methodBadge.className = `method-badge method-${result.method}`;

    rampInfo.innerHTML = result.sources
      .map(r => `<span class="ramp-name">${r.name}</span> <span class="ramp-weight">(${(r.weight * 100).toFixed(0)}%)</span>`)
      .join(' + ') + ` @ shade <strong>${result.matchedShade}</strong>`;

    renderBlendViz(result, color);

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
      div.style.background = hex;
      div.innerHTML = `<div class="shade__label"><span class="shade-key">${shade}</span><span class="shade-value">${hex}</span></div>`;
      div.title = `Click to copy ${css}`;
      div.addEventListener('click', () => {
        navigator.clipboard.writeText(css);
        showToast(`Copied ${css}`);
      });
      paletteGrid.appendChild(div);
    }

    cssOutput.textContent = toCSS(result, 'brand');
  } catch (e) {
    console.error(e);
  }
}

colorPicker.addEventListener('input', (e) => {
  const color = (e.target as HTMLInputElement).value;
  hexInput.value = color.toUpperCase();
  updatePalette(color);
});

hexInput.addEventListener('input', (e) => {
  let value = (e.target as HTMLInputElement).value;
  if (!value.startsWith('#')) value = '#' + value;
  if (/^#[0-9A-Fa-f]{6}$/.test(value)) {
    colorPicker.value = value;
    updatePalette(value);
  }
});

rampSelector.addEventListener('change', (e) => {
  currentRampSet = (e.target as HTMLSelectElement).value as RampSet;
  ditto = new DittoTones({ ramps: getCurrentRamps() });
  updatePalette(colorPicker.value);
});

copyBtn.addEventListener('click', () => {
  navigator.clipboard.writeText(cssOutput.textContent || '');
  showToast('Copied CSS to clipboard!');
});

updatePalette(colorPicker.value);
