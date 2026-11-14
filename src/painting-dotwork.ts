import paintingUrl from './assets/wanderer-landscape.png';

const canvas = document.querySelector<HTMLCanvasElement>('.painting-dotwork')!;
const context = canvas.getContext('2d')!;
const painting = new Image();
const samples = document.createElement('canvas').getContext('2d', { willReadFrequently: true })!;
const still = document.createElement('canvas');
const stillContext = still.getContext('2d')!;
const spacing = 4;
const lifetime = 1500;
const waveWidth = 36;
const speed = 0.065;
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const ripples: { x: number; y: number; start: number }[] = [];
let dots: { color: string; radius: number }[] = [];
let columns = 0;
let rows = 0;
let density = 1;
let animation = 0;
let lastRipple = -Infinity;

function resize() {
  const { width, height } = canvas.getBoundingClientRect();
  if (!width || !height) return;
  density = Math.min(window.devicePixelRatio, 2);
  columns = Math.ceil(width / spacing);
  rows = Math.ceil(height / spacing);
  canvas.width = still.width = Math.round(width * density);
  canvas.height = still.height = Math.round(height * density);
  context.setTransform(density, 0, 0, density, 0, 0);
  stillContext.setTransform(density, 0, 0, density, 0, 0);

  samples.canvas.width = columns;
  samples.canvas.height = rows;
  samples.imageSmoothingQuality = 'high';
  const scale = Math.max(columns / painting.naturalWidth, rows / painting.naturalHeight);
  const imageWidth = painting.naturalWidth * scale;
  const imageHeight = painting.naturalHeight * scale;
  samples.drawImage(painting, (columns - imageWidth) / 2, (rows - imageHeight) / 2, imageWidth, imageHeight);
  const { data } = samples.getImageData(0, 0, columns, rows);

  dots = [];
  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) {
      const index = (row * columns + column) * 4;
      const red = data[index];
      const green = data[index + 1];
      const blue = data[index + 2];
      const lightness = (0.2126 * red + 0.7152 * green + 0.0722 * blue) / 255;
      const radius = 1.18 + 0.24 * (1 - lightness);
      const x = (column + 0.5) * spacing;
      const y = (row + 0.5) * spacing;
      const dot = { color: `rgb(${red}, ${green}, ${blue})`, radius };
      dots.push(dot);
      paintDot(stillContext, dot, x, y);
    }
  }
  if (!animation) render(performance.now());
}

function paintDot(target: CanvasRenderingContext2D, dot: { color: string; radius: number }, x: number, y: number) {
  target.fillStyle = dot.color;
  target.beginPath();
  target.arc(x, y, dot.radius, 0, Math.PI * 2);
  target.fill();
}

function render(now: number) {
  animation = 0;
  while (ripples.length && (now - ripples[0].start >= lifetime || reducedMotion.matches)) ripples.shift();
  context.clearRect(0, 0, columns * spacing, rows * spacing);
  context.drawImage(still, 0, 0, still.width / density, still.height / density);
  if (!ripples.length) return;

  // Redraw only the dots reached by the expanding waves.
  const offsets = new Map<number, { x: number; y: number }>();
  for (const ripple of ripples) {
    const age = Math.max(0, now - ripple.start);
    const crest = age * speed;
    const reach = crest + waveWidth;
    const fade = (1 - age / lifetime) ** 2;
    for (let row = Math.max(0, Math.floor((ripple.y - reach) / spacing)); row < Math.min(rows, Math.ceil((ripple.y + reach) / spacing)); row++) {
      for (let column = Math.max(0, Math.floor((ripple.x - reach) / spacing)); column < Math.min(columns, Math.ceil((ripple.x + reach) / spacing)); column++) {
        const x = (column + 0.5) * spacing - ripple.x;
        const y = (row + 0.5) * spacing - ripple.y;
        const distance = Math.hypot(x, y);
        const phase = (distance - crest) / waveWidth;
        if (!distance || Math.abs(phase) >= 1) continue;
        const displacement = Math.sin(phase * Math.PI * 2) * (1 - Math.abs(phase)) * fade * 2.8;
        const index = row * columns + column;
        const offset = offsets.get(index) ?? { x: 0, y: 0 };
        offset.x += x / distance * displacement;
        offset.y += y / distance * displacement;
        offsets.set(index, offset);
      }
    }
  }
  for (const index of offsets.keys()) {
    context.clearRect(index % columns * spacing, Math.floor(index / columns) * spacing, spacing, spacing);
  }
  for (const [index, offset] of offsets) {
    paintDot(context, dots[index], (index % columns + 0.5) * spacing + offset.x,
      (Math.floor(index / columns) + 0.5) * spacing + offset.y);
  }
  animation = requestAnimationFrame(render);
}

painting.addEventListener('load', () => {
  new ResizeObserver(resize).observe(canvas);
});
painting.src = paintingUrl;

window.addEventListener('pointermove', (event) => {
  if (!dots.length || reducedMotion.matches || event.pointerType === 'touch') return;
  const now = performance.now();
  if (now - lastRipple < 110) return;
  lastRipple = now;
  const { left, top } = canvas.getBoundingClientRect();
  ripples.push({ x: event.clientX - left, y: event.clientY - top, start: now });
  if (!animation) animation = requestAnimationFrame(render);
}, { passive: true });
