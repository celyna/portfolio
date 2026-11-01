// Curated nature imagery only; never sample arbitrary CJK code points.
const REGION_CHARACTERS = {
  terrain: ['山木土石丘艸', '林松竹岩芝坡', '森峰嶺岳葉苗'],
  sky: ['天空雨風', '天雨空氣', '霄晴氣風'],
  fog: ['雲霧', '雲霧霞', '霧靄雲'],
  figure: ['人行立', '衣行旅', '衣衫袍履'],
} as const;

// Source-image coordinates, so the landscape labels follow responsive crops.
// This traced ridge separates the sky from the mountain/fog layers below it.
const SKYLINE = [
  [0, 0.333], [0.065, 0.326], [0.115, 0.313], [0.162, 0.289],
  [0.19, 0.3], [0.247, 0.368], [0.3, 0.397], [0.37, 0.395],
  [0.381, 0.355], [0.404, 0.354], [0.421, 0.397], [0.49, 0.397],
  [0.57, 0.37], [0.628, 0.383], [0.686, 0.352], [0.72, 0.35],
  [0.756, 0.314], [0.79, 0.32], [0.827, 0.291], [0.87, 0.33],
  [0.91, 0.316], [0.94, 0.337], [0.97, 0.326], [1, 0.346],
] as const;

// Trace the figure instead of changing glyph sets inside a rectangular box.
const FIGURE_OUTLINE = [
  [0.247,0.347],[0.27,0.347],[0.273,0.389],[0.294,0.411],
  [0.304,0.489],[0.294,0.534],[0.284,0.549],[0.29,0.608],
  [0.276,0.62],[0.273,0.666],[0.268,0.711],[0.269,0.746],
  [0.263,0.755],[0.253,0.749],[0.251,0.734],[0.254,0.7],
  [0.253,0.645],[0.246,0.662],[0.232,0.701],[0.212,0.708],[0.205,0.692],
  [0.216,0.648],[0.218,0.575],[0.217,0.5],[0.22,0.433],[0.239,0.398],
] as const;

function insideFigure(x: number, y: number) {
  let inside = false;
  for (let i=0,j=FIGURE_OUTLINE.length-1;i<FIGURE_OUTLINE.length;j=i++) {
    const [ax,ay]=FIGURE_OUTLINE[i], [bx,by]=FIGURE_OUTLINE[j];
    if ((ay>y)!==(by>y) && x<(bx-ax)*(y-ay)/(by-ay)+ax) inside=!inside;
  }
  return inside;
}

function regionAt(x: number, y: number, luminance: number) {
  let horizon = SKYLINE[SKYLINE.length - 1][1] as number;
  for (let j = 1; j < SKYLINE.length; j++) {
    if (x > SKYLINE[j][0]) continue;
    const [ax, ay] = SKYLINE[j - 1], [bx, by] = SKYLINE[j];
    horizon = ay + (by - ay) * (x - ax) / (bx - ax);
    break;
  }
  // Keep the wanderer's dark silhouette distinct from the surrounding ground.
  if (luminance < 0.33 && insideFigure(x,y)) return 'figure';
  if (y < horizon) return 'sky';
  // Fog is the pale layer between the darker rock and tree-covered ridges.
  // A softer threshold near the horizon retains faint, faraway mountains.
  const distanceBelowRidge = Math.max(0, Math.min(1, (y-horizon)/0.08));
  const terrainThreshold = 0.71 - distanceBelowRidge * 0.08;
  return luminance < terrainThreshold ? 'terrain' : 'fog';
}

/** Full-bleed character painting with a damped, pointer-driven displacement field. */
export class PaintingScene {
  private ctx: CanvasRenderingContext2D;
  private image = new Image();
  private observer: ResizeObserver;
  private visibility: IntersectionObserver;
  private motion = matchMedia('(prefers-reduced-motion: reduce)');
  private raf = 0;
  private last = 0;
  private time = 0;
  private visible = true;
  private disposed = false;
  private width = 0;
  private height = 0;
  private cw = 6;
  private ch = 10;
  private cols = 0;
  private rows = 0;
  private glyphs: string[] = [];
  private shades = new Float32Array(0);
  private dx = new Float32Array(0);
  private dy = new Float32Array(0);
  private vx = new Float32Array(0);
  private vy = new Float32Array(0);
  private pointer = { x: -1000, y: -1000, active: false, down: false };

  constructor(private canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('2D canvas unavailable');
    this.ctx = ctx;
    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(canvas);
    this.visibility = new IntersectionObserver(([entry]) => {
      this.visible = entry.isIntersecting;
      this.schedule();
    });
    this.visibility.observe(canvas);
    this.motion.addEventListener('change', this.schedule);
    canvas.addEventListener('pointermove', this.move);
    canvas.addEventListener('pointerdown', this.down);
    canvas.addEventListener('pointerleave', this.leave);
    canvas.addEventListener('pointercancel', this.leave);
    window.addEventListener('pointerup', this.up);
    window.addEventListener('blur', this.leave);
    this.image.onload = () => {
      if (!this.disposed) this.resize();
    };
    this.image.src = new URL('./assets/wanderer-landscape.png', import.meta.url).href;
    this.resize();
  }

  destroy() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.image.onload = null;
    this.observer.disconnect();
    this.visibility.disconnect();
    this.motion.removeEventListener('change', this.schedule);
    this.canvas.removeEventListener('pointermove', this.move);
    this.canvas.removeEventListener('pointerdown', this.down);
    this.canvas.removeEventListener('pointerleave', this.leave);
    this.canvas.removeEventListener('pointercancel', this.leave);
    window.removeEventListener('pointerup', this.up);
    window.removeEventListener('blur', this.leave);
  }

  private locate(event: PointerEvent) {
    const rect = this.canvas.getBoundingClientRect();
    this.pointer.x = event.clientX - rect.left;
    this.pointer.y = event.clientY - rect.top;
    this.pointer.active = true;
  }
  private move = (event: PointerEvent) => this.locate(event);
  private down = (event: PointerEvent) => {
    this.locate(event);
    this.pointer.down = true;
  };
  private up = (event: PointerEvent) => {
    this.pointer.down = false;
    if (event.pointerType !== 'mouse') this.pointer.active = false;
  };
  private leave = () => {
    this.pointer.active = false;
    this.pointer.down = false;
  };

  private resize() {
    const { width, height } = this.canvas.getBoundingClientRect();
    if (width < 1 || height < 1) return;
    this.width = width;
    this.height = height;
    const dpr = Math.min(devicePixelRatio || 1, 2);
    this.canvas.width = Math.round(width * dpr);
    this.canvas.height = Math.round(height * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.cw = Math.max(2.5, Math.min(4.5, width / 360));
    this.ch = this.cw * 1.3;
    this.cols = Math.ceil(width / this.cw);
    this.rows = Math.ceil(height / this.ch);
    const count = this.cols * this.rows;
    this.glyphs = Array(count).fill(' ');
    this.shades = new Float32Array(count);
    this.dx = new Float32Array(count);
    this.dy = new Float32Array(count);
    this.vx = new Float32Array(count);
    this.vy = new Float32Array(count);
    if (this.image.naturalWidth) this.sample();
    this.draw(0);
    this.schedule();
  }

  private sample() {
    const sample = document.createElement('canvas');
    sample.width = this.cols;
    sample.height = this.rows;
    const g = sample.getContext('2d', { willReadFrequently: true });
    if (!g) return;
    // Cover the viewport using the extended landscape; keep the figure
    // at the left third even when a narrow screen crops the right-hand valley.
    const scale = Math.max(this.width / this.image.naturalWidth, this.height / this.image.naturalHeight);
    const sw = this.width / scale;
    const sh = this.height / scale;
    const sx = Math.max(0, Math.min(this.image.naturalWidth - sw,
      this.image.naturalWidth * 0.257 - sw * 0.28));
    const sy = (this.image.naturalHeight - sh) * 0.5;
    g.drawImage(this.image, sx, sy, sw, sh, 0, 0, this.cols, this.rows);
    const pixels = g.getImageData(0, 0, this.cols, this.rows).data;
    for (let i = 0; i < this.glyphs.length; i++) {
      const p = i * 4;
      const luminance = (pixels[p] * 0.2126 + pixels[p + 1] * 0.7152 + pixels[p + 2] * 0.0722) / 255;
      const tone = Math.pow(Math.max(0, Math.min(1, (luminance - 0.1) / 0.8)), 0.78);
      const ink = 1 - tone;
      // Stroke density and opacity preserve the painting's light/dark structure.
      // Choose once per sampling pass so random glyphs do not flicker per frame.
      const sourceX = (sx + ((i % this.cols) + 0.5) / this.cols * sw) / this.image.naturalWidth;
      const sourceY = (sy + (Math.floor(i / this.cols) + 0.5) / this.rows * sh) / this.image.naturalHeight;
      const region = regionAt(sourceX, sourceY, luminance);
      const palette = REGION_CHARACTERS[region][ink < 0.28 ? 0 : ink < 0.6 ? 1 : 2];
      this.glyphs[i] = ink < 0.035 ? ' ' : palette[Math.floor(Math.random() * palette.length)];
      this.shades[i] = 0.12 + ink * 0.88;
    }
  }

  private schedule = () => {
    cancelAnimationFrame(this.raf);
    if (this.disposed || !this.visible) return;
    if (this.motion.matches) {
      this.dx.fill(0); this.dy.fill(0); this.vx.fill(0); this.vy.fill(0);
      this.draw(0);
      return;
    }
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.frame);
  };
  private frame = (now: number) => {
    const dt = Math.min(1 / 30, (now - this.last) / 1000);
    this.last = now;
    this.time += dt;
    this.draw(dt);
    this.raf = requestAnimationFrame(this.frame);
  };

  private draw(dt: number) {
    const g = this.ctx;
    g.fillStyle = '#ffffff';
    g.fillRect(0, 0, this.width, this.height);
    g.font = `500 ${this.cw * 0.98}px "PingFang TC", "Noto Sans CJK TC", "Microsoft JhengHei", sans-serif`;
    g.textBaseline = 'middle';
    g.textAlign = 'center';
    g.fillStyle = '#111111';
    const radius = Math.min(220, Math.max(135, this.width * 0.16));
    const spring = 65;
    const damping = Math.exp(-dt * 11);
    for (let i = 0; i < this.glyphs.length; i++) {
      const char = this.glyphs[i];
      if (char === ' ') continue;
      const x = (i % this.cols + 0.5) * this.cw;
      const y = (Math.floor(i / this.cols) + 0.5) * this.ch;
      let targetX = 0, targetY = 0;
      if (this.pointer.active && !this.motion.matches) {
        const px = this.pointer.x - x, py = this.pointer.y - y;
        const distance = Math.hypot(px, py);
        const falloff = Math.max(0, 1 - distance / radius);
        const strength = falloff * falloff * (this.pointer.down ? -0.65 : 0.48);
        targetX = px * strength;
        targetY = py * strength;
        // A small rolling component makes the distortion feel fluid.
        const curl = Math.sin(distance * 0.035 - this.time * 2) * falloff * 4;
        targetX += -py / Math.max(1, distance) * curl;
        targetY += px / Math.max(1, distance) * curl;
      }
      this.vx[i] = (this.vx[i] + (targetX - this.dx[i]) * spring * dt) * damping;
      this.vy[i] = (this.vy[i] + (targetY - this.dy[i]) * spring * dt) * damping;
      this.dx[i] += this.vx[i] * dt;
      this.dy[i] += this.vy[i] * dt;
      const alive = this.motion.matches ? 0 : Math.sin(y * 0.015 + this.time * 0.6) * Math.sin(x * 0.009 - this.time * 0.35) * 0.65;
      g.globalAlpha = this.shades[i];
      g.fillText(char, x + this.dx[i] + alive, y + this.dy[i]);
    }
    g.globalAlpha = 1;
  }
}
