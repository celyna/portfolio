import { clamp, hash3 } from "./math";

/** Asymmetric ASCII thorn webs with open cells and tapering hooked tendrils. */
export class SigilScene {
  private ctx: CanvasRenderingContext2D;
  private mask = document.createElement("canvas");
  private ink: CanvasRenderingContext2D;
  private observer: ResizeObserver;
  private visibility: IntersectionObserver;
  private motion = matchMedia("(prefers-reduced-motion: reduce)");
  private raf = 0;
  private time = 0;
  private last = 0;
  private width = 0;
  private height = 0;
  private cell = 7;
  private rows = 0;
  private cols = 0;
  private visible = true;
  private disposed = false;
  private seed = 0;
  private layoutSeed = Math.floor(Math.random() * 0x7fffffff);
  private placements = new Map<number, { x: number; y: number; cycle: number }>();
  private placementCount = 0;
  private pointer = { x: 0, y: 0, active: false };

  constructor(private canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext("2d", { alpha: false });
    const ink = this.mask.getContext("2d", { willReadFrequently: true });
    if (!ctx || !ink) throw new Error("2D canvas unavailable");
    this.ctx = ctx;
    this.ink = ink;
    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(canvas);
    this.visibility = new IntersectionObserver(([entry]) => {
      this.visible = entry.isIntersecting;
      this.schedule();
    });
    this.visibility.observe(canvas);
    this.motion.addEventListener("change", this.schedule);
    canvas.addEventListener("pointermove", this.move);
    canvas.addEventListener("pointerleave", this.leave);
    canvas.addEventListener("pointerdown", this.activate);
    this.resize();
    this.schedule();
  }

  destroy() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.observer.disconnect();
    this.visibility.disconnect();
    this.motion.removeEventListener("change", this.schedule);
    this.canvas.removeEventListener("pointermove", this.move);
    this.canvas.removeEventListener("pointerleave", this.leave);
    this.canvas.removeEventListener("pointerdown", this.activate);
  }

  private move = (event: PointerEvent) => {
    const rect = this.canvas.getBoundingClientRect();
    this.pointer = { x: event.clientX - rect.left, y: event.clientY - rect.top, active: true };
  };
  private leave = () => { this.pointer.active = false; };
  private activate = () => {
    this.layoutSeed = Math.floor(Math.random() * 0x7fffffff);
    this.placements.clear();
    this.draw();
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
    this.cell = clamp(width / 340, 2.5, 4);
    this.cols = Math.ceil(width / this.cell);
    this.rows = Math.ceil(height / (this.cell * 1.5));
    this.mask.width = this.cols * 2;
    this.mask.height = this.rows * 2;
    this.draw();
  }

  private schedule = () => {
    cancelAnimationFrame(this.raf);
    if (this.disposed || !this.visible) return;
    if (this.motion.matches) { this.draw(); return; }
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.frame);
  };
  private frame = (now: number) => {
    const dt = Math.min((now - this.last) / 1000, 0.05);
    this.last = now;
    this.time += dt;
    this.draw();
    this.raf = requestAnimationFrame(this.frame);
  };

  private arrange(count: number, time: number) {
    if (this.placementCount !== count) {
      this.placements.clear();
      this.placementCount = count;
    }
    const shortSide = Math.min(this.width, this.height);
    // Place the large form first, then accept random points with room around
    // existing centers. Positions stay fixed until that sigil fades and returns.
    const order = [count - 1, ...Array.from({ length: count - 1 }, (_, i) => i)];
    for (const index of order) {
      const large = index === count - 1;
      const duration = 38 + hash3(index, 2, this.seed) * 14;
      const cycle = Math.floor(time / duration + (large ? 0.4 : (index + 0.5) / count));
      if (this.placements.get(index)?.cycle === cycle) continue;
      this.placements.delete(index);
      let best = { x: 0.5, y: 0.5, cycle };
      let bestClearance = -Infinity;
      for (let attempt = 0; attempt < 100; attempt++) {
        const identity = index + cycle * count;
        const x = 0.1 + hash3(identity, attempt * 2, this.layoutSeed) * 0.8;
        const y = 0.1 + hash3(identity, attempt * 2 + 1, this.layoutSeed) * 0.8;
        let clearance = Infinity;
        for (const [other, position] of this.placements) {
          const distance = Math.hypot((x-position.x)*this.width/shortSide,
            (y-position.y)*this.height/shortSide);
          const required = large || other === count-1 ? 0.42 : 0.27;
          clearance = Math.min(clearance, distance - required);
        }
        if (clearance > bestClearance) {
          best = { x, y, cycle };
          bestClearance = clearance;
        }
        // Taking the first suitable random point avoids a corner-seeking grid.
        if (clearance >= 0) break;
      }
      this.placements.set(index, best);
    }
  }

  private draw() {
    if (!this.width || !this.height) return;
    const g = this.ink;
    const w = this.mask.width;
    const h = this.mask.height;
    const t = this.motion.matches ? 0 : this.time;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, w, h);
    g.strokeStyle = "white";
    g.lineCap = "round";
    const count = this.width < 600 ? 3 : 5;
    const physicalHeight = h * 1.5;
    this.arrange(count, t);
    for (let sigil = 0; sigil < count; sigil++) {
      const oversized = sigil === count - 1;
      const duration = 38 + hash3(sigil, 2, this.seed) * 14;
      const life = t / duration + (oversized ? 0.4 : (sigil + 0.5) / count);
      const cycle = Math.floor(life);
      const age = life - cycle;
      const identity = sigil + cycle * count;
      const random = (salt: number) => hash3(identity, salt, this.seed);
      const silhouette = (sigil + cycle + this.seed) % 5;
      const phase = random(3) * Math.PI * 2;
      const sizes = [0.7, 0.64, 0.82, 0.52];
      const size = oversized ? (this.width < 600 ? 1.42 : 1.65) : sizes[sigil];
      const scale = Math.min(physicalHeight, w) * 0.265 * size * (0.92 + random(7) * 0.16);
      const drift = sigil * Math.PI * 2 / count + 0.4;
      const position = this.placements.get(sigil)!;
      const cx = (position.x + Math.sin(t * 0.07 + drift) * 0.012) * w;
      const cy = (position.y + Math.sin(t * 0.05 + drift) * 0.018) * physicalHeight;
      g.save();
      g.globalAlpha = this.motion.matches ? 1 : Math.min(1, age / 0.12, (1 - age) / 0.15);
      g.scale(1, 1 / 1.5);
      g.translate(cx, cy);
      g.scale(scale * (sigil % 2 ? -1 : 1), scale);
      // The swept profile is already horizontal; turn the other oversized
      // profiles onto their side, then give the oversized form a strong diagonal.
      const angle = oversized
        ? (silhouette === 1 ? 0 : -Math.PI / 2) + Math.PI / 4 + (random(4) - 0.5) * 0.12
        : (random(4) - 0.5) * 0.5;
      g.rotate(angle);
      g.fillStyle = "white";
      const flex = (point: number[]): number[] => {
        const [px, py] = point;
        let x = px * (0.75 + random(12) * 0.5)
          + Math.sin(py * (2.3 + random(14))) * (random(13) - 0.5) * 0.24;
        let y = py;
        // Warp the entire filigree together, preserving its intricate openings
        // while giving each piece a different overall silhouette.
        if (silhouette === 1) {
          [x,y] = [y * 0.96 + x * 0.48, x * 0.68 + Math.sin(y * 3.6) * 0.2];
        } else if (silhouette === 2) {
          [x,y] = [x * 1.08 + Math.sin(y * 3.3) * 0.14,
            y * 0.85 + Math.sin(x * 4.2) * 0.07];
        } else if (silhouette === 3) {
          [x,y] = [x * 0.85 + Math.cos(y * 1.8) * 0.58 - 0.28,
            y * 0.9 + x * 0.19];
        } else if (silhouette === 4) {
          [x,y] = [x * 0.72 + Math.sin(y * 3.8) * 0.15,
            y * 1.06 + x * 0.35];
        }
        return [x + Math.sin(y * 3 - t * 0.45 + phase) * 0.025,
          y + Math.sin(x * 4 + t * 0.3 + phase) * 0.015];
      };
      // A ribbon is bounded by two curves, with its width falling to a needle.
      const ribbon = (points: number[][], width: number, taper = true) => {
        const [a,b,c,d] = points.map(flex);
        const left: number[][] = [], right: number[][] = [];
        const innerLeft: number[][] = [], innerRight: number[][] = [];
        for (let i = 0; i <= 60; i++) {
          const u = i / 60, v = 1-u;
          const x = v*v*v*a[0]+3*v*v*u*b[0]+3*v*u*u*c[0]+u*u*u*d[0];
          const y = v*v*v*a[1]+3*v*v*u*b[1]+3*v*u*u*c[1]+u*u*u*d[1];
          const dx = 3*v*v*(b[0]-a[0])+6*v*u*(c[0]-b[0])+3*u*u*(d[0]-c[0]);
          const dy = 3*v*v*(b[1]-a[1])+6*v*u*(c[1]-b[1])+3*u*u*(d[1]-c[1]);
          const length = Math.hypot(dx,dy) || 1;
          const edgeDetail = !taper && width > 0.009
            ? 1 + Math.pow(Math.max(0, Math.sin(u*31+phase)),6)*0.36 : 1;
          const thickness = width * edgeDetail * (taper ? Math.pow(1-u, 1.3) : 0.7 + Math.sin(u*Math.PI)*0.3);
          left.push([x-dy/length*thickness,y+dx/length*thickness]);
          right.push([x+dy/length*thickness,y-dx/length*thickness]);
          // Thin interior slits create two connected contours in each membrane.
          const slit = thickness * 0.65 * Math.pow(Math.sin(u*Math.PI),0.35);
          innerLeft.push([x-dy/length*slit,y+dx/length*slit]);
          innerRight.push([x+dy/length*slit,y-dx/length*slit]);
        }
        g.beginPath();
        [...left, ...right.reverse()].forEach(([x,y],i) => i ? g.lineTo(x,y) : g.moveTo(x,y));
        g.closePath();
        if(width >= 0.008) {
          [...innerLeft,...innerRight.reverse()].forEach(([x,y],i)=>i?g.lineTo(x,y):g.moveTo(x,y));
          g.closePath();
        }
        g.fill("evenodd");
        // Fine inset scratches give the wider junctions an etched appearance.
        g.lineWidth = 0.003;
        g.beginPath();
        left.slice(5,46).forEach(([x,y],i) => i ? g.lineTo(x+0.009,y) : g.moveTo(x+0.009,y));
        g.stroke();
      };
      // Joined, scalloped membranes surround uneven pinched openings.
      // Internal slits and etched seams keep the bodies intricate and airy.
      const junctions = [
        [-0.42,-0.68],[-0.27,-0.43],[-0.12,-0.28],[-0.34,-0.13],
        [-0.05,-0.06],[-0.29,0.11],[0.1,0.17],[-0.13,0.32],
        [0.19,0.39],[-0.14,0.55],[0.07,0.64],[0.3,0.63],[0.22,0.85],
        [-0.48,0.28],[-0.3,0.72],[0.33,-0.58],
      ];
      const edges = [
        [0,1],[1,2],[1,3],[2,3],[2,4],[3,4],[3,5],[4,5],
        [4,6],[5,6],[5,7],[6,7],[6,8],[7,8],[7,9],[8,10],
        [9,10],[8,11],[10,11],[10,12],[11,12],[5,13],[9,13],
        [9,14],[12,14],[2,15],[4,15],
      ];
      edges.forEach(([from,to],i) => {
        const a = junctions[from], b = junctions[to];
        const dx = b[0]-a[0], dy = b[1]-a[1];
        const bow = (i % 2 ? -1 : 1) * (0.25 + random(i+30)*0.22);
        ribbon([a,[a[0]+dx*0.32-dy*bow,a[1]+dy*0.32+dx*bow],
          [a[0]+dx*0.7-dy*bow,a[1]+dy*0.7+dx*bow],b],0.006 + random(i+80)*0.003,false);
      });
      // Swept structural bridges meet in pointed, stretched junctions.
      const bridges = [
        [[-0.4,-0.49],[-0.08,-0.34],[-0.46,-0.1],[-0.32,0.08]],
        [[-0.2,-0.27],[0.02,-0.48],[0.08,-0.57],[0.25,-0.69]],
        [[-0.35,0.02],[-0.18,0.04],[-0.12,0.18],[-0.06,0.28]],
        [[-0.2,0.27],[-0.08,0.24],[0.02,0.35],[0.03,0.49]],
        [[-0.18,0.52],[0.04,0.42],[0.22,0.51],[0.2,0.73]],
        [[0.01,0.76],[0.16,0.65],[0.32,0.83],[0.31,0.98]],
      ];
      bridges.forEach(points => ribbon(points,0.012,false));
      // Long horns and hooked whips carry the reference's asymmetric silhouette.
      const horns = [
        [[-0.2,-0.27],[-0.16,-0.92],[0.82,-0.47],[0.62,-1.4]],
        [[0.24,-0.69],[0.48,-0.78],[0.83,-0.9],[0.76,-1.12]],
        [[-0.1,-0.13],[0.23,-0.57],[0.62,-0.59],[0.58,-0.23]],
        [[0.08,0.08],[0.49,0.47],[0.98,0.22],[1.08,-0.04]],
        [[-0.29,0.25],[-0.56,0.48],[-0.55,0.7],[-0.72,0.77]],
        [[0.15,0.6],[0.65,0.45],[0.94,0.94],[0.88,1.26]],
        [[0.2,0.79],[0.37,1.03],[0.47,1.17],[0.38,1.43]],
        [[-0.43,-0.58],[-0.77,-0.64],[-0.73,-0.95],[-0.48,-0.87]],
        [[-0.31,0.09],[-0.74,0.26],[-0.77,-0.01],[-0.7,-0.1]],
        [[0.05,0.48],[0.35,0.41],[0.48,0.59],[0.5,0.73]],
      ];
      horns.forEach((points,i) => {
        // A few broad crescents define the outline; detail lives in the body.
        const selected = [[0,2,3,4,5,6],[0,1,3,5,8],[0,2,4,5,9],
          [0,2,3,5,6,8],[0,3,4,5,6]][silhouette];
        if(!selected.includes(i)) return;
        const direction = (random(i+230)-0.5)*0.6;
        const reach = [1,1.15,0.66,0.93,1.05][silhouette] * (0.76+random(i+250)*0.5);
        const varied = points.map((point,j) => {
          if(j===0) return point;
          const [ox,oy] = points[0];
          const dx=(point[0]-ox)*reach, dy=(point[1]-oy)*reach;
          return [ox+dx*Math.cos(direction)-dy*Math.sin(direction),
            oy+dx*Math.sin(direction)+dy*Math.cos(direction)];
        });
        const stretched = oversized ? varied.map((point,j) => {
          const origin = varied[0];
          const extension = [1, 1.12, 1.42, 1.65][j];
          return [origin[0] + (point[0]-origin[0])*extension,
            origin[1] + (point[1]-origin[1])*extension];
        }) : varied;
        ribbon(stretched, i < 7 ? 0.011 : 0.007);
        const etched=stretched.map(([x,y],j)=>[x+Math.sin(j*1.3+i)*0.026,y+0.018]);
        ribbon(etched,0.0025);
      });
      // Every form gets the same level of interlaced internal detail.
      // These pinched apertures sit inside the web rather than along a stem.
      const apertures = [
        [1,2,3],[2,4,3],[3,4,5],[4,6,5],[5,6,7],[6,8,7],
        [7,9,10],[8,10,11],[10,11,12],[5,9,13],[9,12,14],[2,4,15],
      ];
      apertures.forEach((indices,cell) => {
        const corners=indices.map(i=>junctions[i]);
        const center=[corners.reduce((sum,p)=>sum+p[0],0)/3,
          corners.reduce((sum,p)=>sum+p[1],0)/3];
        // Curved inset contours make sharp, uneven openings with clear interiors.
        const inset=corners.map(p=>[center[0]+(p[0]-center[0])*0.48,
          center[1]+(p[1]-center[1])*0.48]);
        for(let edge=0;edge<3;edge++) {
          const a=inset[edge], b=inset[(edge+1)%3];
          const dx=b[0]-a[0],dy=b[1]-a[1];
          ribbon([a,[a[0]+dx*0.25+dy*0.18,a[1]+dy*0.25-dx*0.18],
            [a[0]+dx*0.7+dy*0.18,a[1]+dy*0.7-dx*0.18],b],0.0028,false);
        }
        // Short etched seams subdivide junctions without filling each aperture.
        const root=corners[cell%3], inner=inset[cell%3];
        ribbon([root,[root[0]+0.025,root[1]-0.018],
          [inner[0]-0.012,inner[1]+0.018],inner],0.003,false);
      });
      junctions.forEach(([x,y],i) => {
        if(i===0 || i===12) return;
        const tilt=random(i+180)*Math.PI;
        const reach=0.03+random(i+190)*0.028;
        // Three irregular notches form a pointed, hollow junction ornament.
        const tips=[0,2.1,4.5].map(angle=>[x+Math.cos(angle+tilt)*reach,
          y+Math.sin(angle+tilt)*reach*1.25]);
        tips.forEach((a,j)=>{
          const b=tips[(j+1)%tips.length];
          ribbon([a,[x+(a[0]-x)*0.2,y+(a[1]-y)*0.2],
            [x+(b[0]-x)*0.2,y+(b[1]-y)*0.2],b],0.0045,false);
        });
      });
      g.restore();
    }
    g.globalAlpha = 1;
    const pixels = g.getImageData(0, 0, w, h).data;
    const ctx = this.ctx;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, this.width, this.height);
    ctx.font = `500 ${this.cell * 1.2}px ui-monospace, Menlo, monospace`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const ch = this.cell * 1.5;
    for (let row = 0; row < this.rows; row++) {
      for (let col = 0; col < this.cols; col++) {
        const x = col * this.cell + this.cell / 2;
        const y = row * ch + ch / 2;
        const p = ((row * 2) * w + col * 2) * 4;
        const coverage = Math.max(pixels[p + 3], pixels[p + 7], pixels[p + w * 4 + 3], pixels[p + w * 4 + 7]) / 255;
        if (coverage < 0.015) continue;
        const noise = hash3(Math.abs(col - Math.floor(this.cols / 2)), row, this.seed);
        const near = this.pointer.active && !this.motion.matches ? Math.max(0, 1 - Math.hypot(x - this.pointer.x, y - this.pointer.y) / 160) : 0;
        ctx.fillStyle = `rgba(0,0,0,${coverage})`;
        const glyphs = coverage > 0.85 ? "/\\|:;" : coverage > 0.4 ? "/\\|()" : ".'`/\\";
        ctx.fillText(glyphs[Math.floor(noise * glyphs.length)], x + near * Math.sin(row + t * 2) * 5, y);
      }
    }
  }
}
