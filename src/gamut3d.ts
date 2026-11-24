// Minimal 3D OKLab viewer (dev-only, enabled with ?3d in the demo URL).
// Shows the sRGB gamut volume, the reference ramps the palette is derived from,
// and the currently generated palette. Plain canvas 2D, no dependencies.

import { converter, formatHex, type Oklch } from 'culori';

const toOklab = converter('oklab');

type Vec3 = [number, number, number];

interface Pt {
  p: Vec3;
  color: string;
  r: number;
  alpha: number;
  stroke?: string;
}

interface Line {
  pts: Vec3[];
  colors: string[];
  width: number;
  alpha: number;
}

export interface GamutViewData {
  ramps: Map<string, Record<string, Oklch>>;
  sources: string[];
  scale: Record<string, Oklch>;
  input: Oklch;
}

// Chroma axes are stretched so the (narrow) gamut reads better.
const CHROMA_STRETCH = 2;

function labPos(c: Oklch | { mode: string }): Vec3 {
  const lab = toOklab(c as any) as unknown as { l: number; a: number; b: number };
  return [(lab.a ?? 0) * CHROMA_STRETCH, (lab.l ?? 0) - 0.5, (lab.b ?? 0) * CHROMA_STRETCH];
}

function rgbPos(r: number, g: number, b: number): { p: Vec3; hex: string } {
  const c = { mode: 'rgb' as const, r, g, b };
  return { p: labPos(c), hex: formatHex(c) };
}

function buildGamut(): { edges: Line[]; surface: Pt[] } {
  // 12 edges of the RGB cube
  const corners: Vec3[] = [];
  for (let i = 0; i < 8; i++) corners.push([(i >> 2) & 1, (i >> 1) & 1, i & 1]);
  const edges: Line[] = [];
  for (let i = 0; i < 8; i++) {
    for (let j = i + 1; j < 8; j++) {
      const diff = corners[i].reduce((n, v, k) => n + Math.abs(v - corners[j][k]), 0);
      if (diff !== 1) continue;
      const pts: Vec3[] = [];
      const colors: string[] = [];
      const steps = 32;
      for (let s = 0; s <= steps; s++) {
        const t = s / steps;
        const [r, g, b] = corners[i].map((v, k) => v + (corners[j][k] - v) * t);
        const { p, hex } = rgbPos(r, g, b);
        pts.push(p);
        colors.push(hex);
      }
      edges.push({ pts, colors, width: 2, alpha: 0.9 });
    }
  }

  // Surface samples on the 6 faces
  const surface: Pt[] = [];
  const n = 14;
  for (let axis = 0; axis < 3; axis++) {
    for (const fixed of [0, 1]) {
      for (let u = 0; u <= n; u++) {
        for (let v = 0; v <= n; v++) {
          const rgb: number[] = [0, 0, 0];
          rgb[axis] = fixed;
          rgb[(axis + 1) % 3] = u / n;
          rgb[(axis + 2) % 3] = v / n;
          const { p, hex } = rgbPos(rgb[0], rgb[1], rgb[2]);
          surface.push({ p, color: hex, r: 1.6, alpha: 0.35 });
        }
      }
    }
  }
  return { edges, surface };
}

export function createGamutView(container: HTMLElement) {
  container.innerHTML = `
    <div class="gamut3d__controls">
      <label><input type="checkbox" data-k="gamut" checked /> sRGB gamut</label>
      <label><input type="checkbox" data-k="ramps" checked /> reference ramps</label>
      <label><input type="checkbox" data-k="palette" checked /> current palette</label>
      <span class="gamut3d__hint">drag to rotate · scroll to zoom · OKLab, chroma ×${CHROMA_STRETCH}</span>
    </div>
    <canvas class="gamut3d__canvas"></canvas>
  `;
  const canvas = container.querySelector('canvas')!;
  const ctx = canvas.getContext('2d')!;
  const show = { gamut: true, ramps: true, palette: true };
  container.querySelectorAll<HTMLInputElement>('input[data-k]').forEach((el) => {
    el.addEventListener('change', () => {
      show[el.dataset.k as keyof typeof show] = el.checked;
      draw();
    });
  });

  const gamut = buildGamut();
  let data: GamutViewData | null = null;

  let yaw = 0.6;
  let pitch = 0.35;
  let zoom = 1;
  let autoRotate = true;

  function resize() {
    const dpr = window.devicePixelRatio || 1;
    const w = container.clientWidth;
    const h = Math.min(560, Math.max(320, w * 0.6));
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    draw();
  }

  function project(p: Vec3, w: number, h: number): { x: number; y: number; z: number } {
    const [x0, y0, z0] = p;
    const cy = Math.cos(yaw);
    const sy = Math.sin(yaw);
    const x1 = x0 * cy - z0 * sy;
    const z1 = x0 * sy + z0 * cy;
    const cp = Math.cos(pitch);
    const sp = Math.sin(pitch);
    const y2 = y0 * cp - z1 * sp;
    const z2 = y0 * sp + z1 * cp;
    const dist = 3;
    const f = (Math.min(w, h) * 1.9 * zoom) / (dist + z2);
    return { x: w / 2 + x1 * f, y: h / 2 - y2 * f, z: z2 };
  }

  function draw() {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (!w || !h) return;
    ctx.clearRect(0, 0, w, h);

    type Item = { z: number; fn: () => void };
    const items: Item[] = [];

    const pushLine = (line: Line) => {
      for (let i = 0; i < line.pts.length - 1; i++) {
        const a = project(line.pts[i], w, h);
        const b = project(line.pts[i + 1], w, h);
        const color = line.colors[i];
        items.push({
          z: (a.z + b.z) / 2,
          fn: () => {
            ctx.globalAlpha = line.alpha;
            ctx.strokeStyle = color;
            ctx.lineWidth = line.width;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
          },
        });
      }
    };

    const pushPt = (pt: Pt) => {
      const s = project(pt.p, w, h);
      items.push({
        z: s.z,
        fn: () => {
          ctx.globalAlpha = pt.alpha;
          ctx.fillStyle = pt.color;
          ctx.beginPath();
          ctx.arc(s.x, s.y, pt.r, 0, Math.PI * 2);
          ctx.fill();
          if (pt.stroke) {
            ctx.globalAlpha = 1;
            ctx.strokeStyle = pt.stroke;
            ctx.lineWidth = 1.5;
            ctx.stroke();
          }
        },
      });
    };

    // Lightness axis
    pushLine({
      pts: [
        [0, -0.5, 0],
        [0, 0.5, 0],
      ],
      colors: ['#888'],
      width: 1,
      alpha: 0.6,
    });

    if (show.gamut) {
      gamut.surface.forEach(pushPt);
      gamut.edges.forEach(pushLine);
    }

    if (data) {
      if (show.ramps) {
        for (const [name, ramp] of data.ramps) {
          const isSource = data.sources.includes(name);
          const colors = Object.values(ramp);
          const pts = colors.map((c) => labPos(c));
          const hexes = colors.map((c) => formatHex(c));
          pushLine({ pts, colors: hexes, width: isSource ? 2 : 1, alpha: isSource ? 0.9 : 0.35 });
          pts.forEach((p, i) =>
            pushPt({
              p,
              color: hexes[i],
              r: isSource ? 3.5 : 2.5,
              alpha: isSource ? 1 : 0.6,
              stroke: isSource ? 'rgba(127,127,127,.8)' : undefined,
            })
          );
        }
      }
      if (show.palette) {
        const colors = Object.values(data.scale);
        const pts = colors.map((c) => labPos(c));
        const hexes = colors.map((c) => formatHex(c));
        pushLine({ pts, colors: hexes, width: 4, alpha: 1 });
        pts.forEach((p, i) => pushPt({ p, color: hexes[i], r: 6, alpha: 1, stroke: '#fff' }));
        pushPt({ p: labPos(data.input), color: formatHex(data.input), r: 9, alpha: 1, stroke: '#000' });
      }
    }

    // Painter's algorithm: far (large z) first
    items.sort((a, b) => b.z - a.z);
    for (const it of items) it.fn();
    ctx.globalAlpha = 1;
  }

  // Interaction
  let dragging = false;
  let lx = 0;
  let ly = 0;
  canvas.addEventListener('pointerdown', (e) => {
    dragging = true;
    autoRotate = false;
    lx = e.clientX;
    ly = e.clientY;
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    yaw += (e.clientX - lx) * 0.01;
    pitch = Math.max(-1.5, Math.min(1.5, pitch + (e.clientY - ly) * 0.01));
    lx = e.clientX;
    ly = e.clientY;
    draw();
  });
  canvas.addEventListener('pointerup', () => (dragging = false));
  canvas.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault();
      zoom = Math.max(0.4, Math.min(4, zoom * Math.exp(-e.deltaY * 0.001)));
      draw();
    },
    { passive: false }
  );
  canvas.addEventListener('dblclick', () => {
    autoRotate = !autoRotate;
    if (autoRotate) tick();
  });

  function tick() {
    if (!autoRotate) return;
    yaw += 0.003;
    draw();
    requestAnimationFrame(tick);
  }

  new ResizeObserver(resize).observe(container);
  resize();
  tick();

  return {
    update(next: GamutViewData) {
      data = next;
      draw();
    },
  };
}
