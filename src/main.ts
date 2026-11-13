import './style.css';

if (new URLSearchParams(location.search).get('font') === 'handjet') {
  document.documentElement.dataset.bioFont = 'handjet';
}

const frame = document.querySelector<SVGSVGElement>('.embroidery')!;
const step = 4;
const stitches = new Map<string, { x: number; y: number; cross: boolean }>();

function stitch(x: number, y: number, cross = false) {
  x = Math.round(x / step) * step;
  y = Math.round(y / step) * step;
  const key = x + ',' + y;
  if (cross || !stitches.has(key)) stitches.set(key, { x, y, cross });
}

function curve(point: (t: number) => [number, number], samples = 120) {
  for (let i = 0; i <= samples; i++) stitch(...point(i / samples));
}

function leaf(x: number, y: number, angle: number, length: number, width: number) {
  for (let row = -length; row <= length; row += 2) {
    const halfWidth = width * (1 - Math.abs(row / length) ** 1.4);
    for (let col = -halfWidth; col <= halfWidth; col += 2.5) {
      stitch(x + row * Math.cos(angle) - col * Math.sin(angle),
        y + row * Math.sin(angle) + col * Math.cos(angle));
    }
  }
}

function flower(x: number, y: number, size: number) {
  for (let i = 0; i < 6; i++) {
    const angle = i * Math.PI / 3;
    leaf(x + Math.cos(angle) * size * 0.63, y + Math.sin(angle) * size * 0.63,
      angle, size * 0.38, size * 0.24);
  }
  stitch(x, y, true);
}

function diamond(x: number, y: number, size: number) {
  for (let i = -size; i <= size; i += step) {
    stitch(x + i, y, true);
    stitch(x, y + i, true);
  }
}

const turn = 2 * Math.PI;
const cx = 340;
const cy = 380;
function oval(angle: number, inset = 0): [number, number] {
  return [cx + (247 - inset) * Math.cos(angle), cy + (313 - inset) * Math.sin(angle)];
}

curve(t => oval(t * turn, 13), 1400);
curve(t => {
  const angle = t * turn;
  return oval(angle, -6 - 5 * Math.cos(angle * 40));
}, 1700);

for (let i = 0; i < 40; i++) {
  const angle = (i + 0.5) * turn / 40;
  const [x, y] = oval(angle, 1);
  stitch(x, y, true);
  if (i % 2 === 0) {
    const [leafX, leafY] = oval(angle + 0.035, -13);
    leaf(leafX, leafY, angle + 0.72, 10, 4);
  }
}

for (const vertical of [-1, 1]) {
  flower(cx, cy + vertical * 317, 25);
  diamond(cx, cy + vertical * 352, 8);
  for (const side of [-1, 1]) {
    curve(t => [cx + side * t * 96, cy + vertical * (318 + 15 * Math.sin(Math.PI * t) - 31 * t * t)]);
    for (let i = 1; i <= 3; i++) {
      const t = i * 0.22;
      const x = cx + side * t * 96;
      const y = cy + vertical * (318 + 15 * Math.sin(Math.PI * t) - 31 * t * t);
      leaf(x + side * 4, y + vertical * 10, side * vertical * 0.84, 12, 4);
      leaf(x - side * 4, y - vertical * 11, -side * vertical * 0.87, 11, 4);
    }
    flower(cx + side * 96, cy + vertical * 286, 11);
  }
}

for (const side of [-1, 1]) {
  flower(cx + side * 257, cy, 18);
  diamond(cx + side * 293, cy, 12);
  for (const vertical of [-1, 1]) {
    curve(t => [cx + side * (255 + 20 * Math.sin(t * Math.PI)), cy + vertical * (13 + 69 * t)]);
    leaf(cx + side * 276, cy + vertical * 46, vertical * side * 0.96, 13, 5);
    diamond(cx + side * 290, cy + vertical * 112, 4);
  }
}

const dots: string[] = [];
const crosses: string[] = [];
for (const { x, y, cross } of stitches.values()) {
  if (cross) {
    crosses.push(`M${x-1.25} ${y-1.25}l2.5 2.5m0 -2.5l-2.5 2.5`);
  } else {
    dots.push(`M${x} ${y}h.01`);
  }
}

frame.innerHTML = `
  <path d="${dots.join('')}" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round"/>
  <path d="${crosses.join('')}" fill="none" stroke="currentColor" stroke-width="1.1" stroke-linecap="round"/>
`;

const clock = document.querySelector<HTMLTimeElement>('.local-clock');

function updateClock() {
  if (!clock) return;
  const now = new Date();
  const hours = now.getHours();
  const minutes = String(now.getMinutes()).padStart(2, '0');
  clock.textContent = `${hours}:${minutes}`;
  clock.dateTime = `${String(hours).padStart(2, '0')}:${minutes}`;
  window.setTimeout(updateClock, 60_000 - (now.getTime() % 60_000));
}

updateClock();

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
let lastPixelAt = -Infinity;
let pixelCount = 0;

window.addEventListener('pointermove', (event) => {
  if (event.pointerType !== 'mouse' || reducedMotion.matches) return;
  if (event.timeStamp - lastPixelAt < 24) return;
  lastPixelAt = event.timeStamp;

  const grid = 4;
  const pixel = document.createElement('span');
  pixel.className = 'cursor-pixel';
  pixel.toggleAttribute('data-stitch', pixelCount++ % 5 === 0);
  pixel.setAttribute('aria-hidden', 'true');
  pixel.style.left = Math.round(event.clientX / grid) * grid + 'px';
  pixel.style.top = Math.round(event.clientY / grid) * grid + 'px';
  document.body.append(pixel);
  pixel.addEventListener('animationend', () => pixel.remove(), { once: true });
}, { passive: true });
