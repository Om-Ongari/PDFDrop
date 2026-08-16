import React, { useEffect, useRef } from 'react';

/**
 * AnimatedBackground
 * ---------------------------------------------------------------
 * A purely decorative, non-interactive canvas layer that floats
 * translucent PDF-document shapes behind the app UI.
 *
 * Design contract (do not violate):
 *  - Never intercepts clicks: pointer-events: none, aria-hidden.
 *  - Always sits behind real content (parent controls z-index).
 *  - Low opacity, blurred, slow — ambient, not a screensaver.
 *  - Lighter directly behind the centered content column.
 *  - Respects prefers-reduced-motion (renders a static frame).
 *  - Pauses when the tab is hidden; cleans up on unmount.
 *
 * Behavior:
 *  - Three depth layers (far / mid / near) drift independently
 *    and respond to scroll at different rates, creating parallax.
 *  - "near" and "mid" documents occasionally morph into a small
 *    tool glyph (compress / merge / split / convert / edit) and
 *    fade back to a plain document.
 *  - "near" documents occasionally leave a faint particle trail.
 *
 * Tuning knobs live in LAYER_CONFIG / the color constants below —
 * everything else is plumbing.
 * ---------------------------------------------------------------
 */

type LayerName = 'far' | 'mid' | 'near';

const TOOL_ICONS = ['doc', 'compress', 'merge', 'split', 'convert', 'edit'] as const;
type ToolIcon = (typeof TOOL_ICONS)[number];

interface LayerConfig {
  count: number;
  minSize: number;
  maxSize: number;
  minOpacity: number;
  maxOpacity: number;
  blur: number;
  driftSpeed: [number, number]; // px/sec range
  rotationSpeed: [number, number]; // rad/sec range
  parallax: number; // scroll response multiplier (depth)
  canMorph: boolean;
  canTrail: boolean;
}

const LAYER_CONFIG: Record<LayerName, LayerConfig> = {
  far: {
    count: 9,
    minSize: 16,
    maxSize: 26,
    minOpacity: 0.035,
    maxOpacity: 0.06,
    blur: 2.5,
    driftSpeed: [2, 5],
    rotationSpeed: [-0.03, 0.03],
    parallax: 0.05,
    canMorph: false,
    canTrail: false,
  },
  mid: {
    count: 8,
    minSize: 24,
    maxSize: 38,
    minOpacity: 0.05,
    maxOpacity: 0.09,
    blur: 1.2,
    driftSpeed: [4, 9],
    rotationSpeed: [-0.06, 0.06],
    parallax: 0.11,
    canMorph: true,
    canTrail: false,
  },
  near: {
    count: 6,
    minSize: 32,
    maxSize: 48,
    minOpacity: 0.07,
    maxOpacity: 0.13,
    blur: 0,
    driftSpeed: [7, 14],
    rotationSpeed: [-0.1, 0.1],
    parallax: 0.2,
    canMorph: true,
    canTrail: true,
  },
};

const INK = '30, 64, 175'; // blue-800-ish, used for mid/near strokes
const INK_SOFT = '100, 116, 139'; // slate-500-ish, used for the far layer
const WASH = '37, 99, 235'; // blue-600, the app's own accent — used for the ambient wash

interface Doc {
  layer: LayerName;
  x: number;
  y: number;
  size: number;
  opacity: number;
  rotation: number;
  rotationSpeed: number;
  driftAngle: number;
  driftSpeed: number;
  wanderPhase: number;
  bobPhase: number;
  bobAmp: number;
  bobSpeed: number;
  blur: number;
  color: string;
  icon: ToolIcon;
  morphing: boolean;
  morphElapsed: number;
  morphDuration: number;
  nextMorphAt: number;
  trailAcc: number;
}

interface Trail {
  x: number;
  y: number;
  size: number;
  life: number;
  color: string;
}

function rand(min: number, max: number) {
  return min + Math.random() * (max - min);
}

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function makeDoc(layer: LayerName, w: number, h: number): Doc {
  const cfg = LAYER_CONFIG[layer];
  return {
    layer,
    x: rand(0, w),
    y: rand(0, h),
    size: rand(cfg.minSize, cfg.maxSize),
    opacity: rand(cfg.minOpacity, cfg.maxOpacity),
    rotation: rand(0, Math.PI * 2),
    rotationSpeed: rand(cfg.rotationSpeed[0], cfg.rotationSpeed[1]),
    driftAngle: rand(0, Math.PI * 2),
    driftSpeed: rand(cfg.driftSpeed[0], cfg.driftSpeed[1]),
    wanderPhase: rand(0, Math.PI * 2),
    bobPhase: rand(0, Math.PI * 2),
    bobAmp: rand(6, 16),
    bobSpeed: rand(0.15, 0.35),
    blur: cfg.blur,
    color: layer === 'far' ? INK_SOFT : INK,
    icon: 'doc',
    morphing: false,
    morphElapsed: 0,
    morphDuration: rand(1.1, 1.6),
    nextMorphAt: rand(6, 22),
    trailAcc: 0,
  };
}

// ---- icon drawing — all strokes only, drawn centered at the origin ----

function drawDocument(ctx: CanvasRenderingContext2D, s: number) {
  const w = s * 0.72;
  const h = s * 0.94;
  const fold = s * 0.18;
  ctx.beginPath();
  ctx.moveTo(-w / 2, -h / 2);
  ctx.lineTo(w / 2 - fold, -h / 2);
  ctx.lineTo(w / 2, -h / 2 + fold);
  ctx.lineTo(w / 2, h / 2);
  ctx.lineTo(-w / 2, h / 2);
  ctx.closePath();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(w / 2 - fold, -h / 2);
  ctx.lineTo(w / 2 - fold, -h / 2 + fold);
  ctx.lineTo(w / 2, -h / 2 + fold);
  ctx.stroke();
  [-h * 0.08, h * 0.08, h * 0.24].forEach((ly) => {
    ctx.beginPath();
    ctx.moveTo(-w / 2 + s * 0.1, ly);
    ctx.lineTo(w / 2 - s * 0.12, ly);
    ctx.stroke();
  });
}

function drawCompress(ctx: CanvasRenderingContext2D, s: number) {
  const w = s * 0.5;
  ctx.beginPath();
  ctx.moveTo(-w, -s * 0.32);
  ctx.lineTo(0, -s * 0.08);
  ctx.lineTo(w, -s * 0.32);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-w, s * 0.32);
  ctx.lineTo(0, s * 0.08);
  ctx.lineTo(w, s * 0.32);
  ctx.stroke();
}

function drawMerge(ctx: CanvasRenderingContext2D, s: number) {
  const w = s * 0.42;
  const h = s * 0.56;
  ctx.save();
  ctx.translate(-s * 0.16, -s * 0.1);
  ctx.strokeRect(-w / 2, -h / 2, w, h);
  ctx.restore();
  ctx.save();
  ctx.translate(s * 0.16, s * 0.1);
  ctx.strokeRect(-w / 2, -h / 2, w, h);
  ctx.restore();
  ctx.beginPath();
  ctx.moveTo(-s * 0.02, 0);
  ctx.lineTo(s * 0.3, 0);
  ctx.moveTo(s * 0.22, -s * 0.07);
  ctx.lineTo(s * 0.3, 0);
  ctx.lineTo(s * 0.22, s * 0.07);
  ctx.stroke();
}

function drawSplit(ctx: CanvasRenderingContext2D, s: number) {
  ctx.beginPath();
  ctx.moveTo(-s * 0.02, 0);
  ctx.lineTo(-s * 0.32, -s * 0.34);
  ctx.moveTo(-s * 0.02, 0);
  ctx.lineTo(-s * 0.32, s * 0.34);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(-s * 0.36, -s * 0.36, s * 0.07, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(-s * 0.36, s * 0.36, s * 0.07, 0, Math.PI * 2);
  ctx.stroke();
  ctx.save();
  ctx.setLineDash([s * 0.06, s * 0.06]);
  ctx.beginPath();
  ctx.moveTo(0, -s * 0.42);
  ctx.lineTo(0, s * 0.42);
  ctx.stroke();
  ctx.restore();
}

function drawConvert(ctx: CanvasRenderingContext2D, s: number) {
  const r = s * 0.3;
  ctx.beginPath();
  ctx.arc(0, 0, r, -Math.PI * 0.15, Math.PI * 1.15);
  ctx.stroke();
  const ex = Math.cos(Math.PI * 1.15) * r;
  const ey = Math.sin(Math.PI * 1.15) * r;
  ctx.beginPath();
  ctx.moveTo(ex - s * 0.09, ey - s * 0.02);
  ctx.lineTo(ex, ey);
  ctx.lineTo(ex - s * 0.02, ey - s * 0.11);
  ctx.stroke();
}

function drawEdit(ctx: CanvasRenderingContext2D, s: number) {
  ctx.beginPath();
  ctx.moveTo(-s * 0.28, s * 0.32);
  ctx.lineTo(s * 0.2, -s * 0.28);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(s * 0.2, -s * 0.28);
  ctx.lineTo(s * 0.32, -s * 0.16);
  ctx.lineTo(-s * 0.16, s * 0.4);
  ctx.lineTo(-s * 0.28, s * 0.32);
  ctx.closePath();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-s * 0.34, s * 0.36);
  ctx.lineTo(-s * 0.28, s * 0.44);
  ctx.lineTo(-s * 0.2, s * 0.38);
  ctx.stroke();
}

const ICON_DRAWERS: Record<ToolIcon, (ctx: CanvasRenderingContext2D, s: number) => void> = {
  doc: drawDocument,
  compress: drawCompress,
  merge: drawMerge,
  split: drawSplit,
  convert: drawConvert,
  edit: drawEdit,
};

export default function AnimatedBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let width = window.innerWidth;
    let height = window.innerHeight;

    const resize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();

    const docs: Doc[] = (Object.keys(LAYER_CONFIG) as LayerName[]).flatMap((layer) =>
      Array.from({ length: LAYER_CONFIG[layer].count }, () => makeDoc(layer, width, height))
    );
    let trails: Trail[] = [];

    // Keep the vertical band behind the centered content column lighter,
    // so the animation lives mainly in the margins and empty space.
    const centerFalloff = (x: number) => {
      const bandHalf = Math.min(560, width * 0.4);
      const feather = 160;
      const dist = Math.abs(x - width / 2);
      if (dist > bandHalf + feather) return 1;
      if (dist < bandHalf) return 0.35;
      return 0.35 + (0.65 * (dist - bandHalf)) / feather;
    };

    const scrollState = { current: window.scrollY };
    const onScroll = () => {
      scrollState.current = window.scrollY;
    };
    window.addEventListener('scroll', onScroll, { passive: true });

    const drawStatic = () => {
      ctx.clearRect(0, 0, width, height);
      docs.forEach((d) => {
        ctx.save();
        ctx.globalAlpha = d.opacity * centerFalloff(d.x);
        ctx.translate(d.x, d.y);
        ctx.rotate(d.rotation);
        ctx.strokeStyle = `rgb(${d.color})`;
        ctx.lineWidth = Math.max(1, d.size * 0.035);
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        drawDocument(ctx, d.size);
        ctx.restore();
      });
    };

    if (reduceMotion) {
      drawStatic();
      const onResizeStatic = () => {
        resize();
        drawStatic();
      };
      window.addEventListener('resize', onResizeStatic);
      return () => {
        window.removeEventListener('scroll', onScroll);
        window.removeEventListener('resize', onResizeStatic);
      };
    }

    let hidden = document.hidden;
    const onVisibility = () => {
      hidden = document.hidden;
    };
    document.addEventListener('visibilitychange', onVisibility);

    const onResize = () => resize();
    window.addEventListener('resize', onResize);

    let rafId = 0;
    let lastTime = performance.now();
    let lastScroll = window.scrollY;
    let hue = 0;

    const frame = (now: number) => {
      rafId = requestAnimationFrame(frame);
      const dt = Math.min(0.05, (now - lastTime) / 1000);
      lastTime = now;
      if (hidden) return;

      const scrollY = scrollState.current;
      const scrollDelta = scrollY - lastScroll;
      lastScroll = scrollY;
      hue += dt * 0.6;

      ctx.clearRect(0, 0, width, height);

      // Very faint ambient wash that shifts almost imperceptibly.
      const grad = ctx.createRadialGradient(
        width / 2, height * 0.35, 0,
        width / 2, height * 0.35, Math.max(width, height) * 0.8
      );
      grad.addColorStop(0, `rgba(${WASH}, ${0.025 + Math.sin(hue * 0.05) * 0.008})`);
      grad.addColorStop(1, `rgba(${WASH}, 0)`);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);

      (['far', 'mid', 'near'] as LayerName[]).forEach((layer) => {
        const cfg = LAYER_CONFIG[layer];
        docs.forEach((d) => {
          if (d.layer !== layer) return;

          // Gentle curved wander instead of straight lines.
          d.driftAngle += Math.sin(now / 1000 * 0.12 + d.wanderPhase) * 0.25 * dt;
          const vx = Math.cos(d.driftAngle) * d.driftSpeed;
          const vy = Math.sin(d.driftAngle) * d.driftSpeed;

          d.x += vx * dt;
          // Parallax: deeper layers respond less to scroll than nearer ones.
          d.y += vy * dt - scrollDelta * cfg.parallax;
          d.rotation += d.rotationSpeed * dt;

          const pad = d.size * 2;
          if (d.x < -pad) d.x = width + pad;
          if (d.x > width + pad) d.x = -pad;
          if (d.y < -pad) d.y = height + pad;
          if (d.y > height + pad) d.y = -pad;

          // Occasional PDF -> tool-icon -> PDF morph.
          if (cfg.canMorph) {
            if (!d.morphing) {
              d.nextMorphAt -= dt;
              if (d.nextMorphAt <= 0) {
                d.morphing = true;
                d.morphElapsed = 0;
                d.icon = pick(TOOL_ICONS.filter((t) => t !== 'doc'));
              }
            } else {
              d.morphElapsed += dt;
              const hold = 1.6;
              const total = d.morphDuration * 2 + hold;
              if (d.morphElapsed >= total) {
                d.morphing = false;
                d.icon = 'doc';
                d.nextMorphAt = rand(14, 34);
              }
            }
          }

          const bob = Math.sin(now / 1000 * d.bobSpeed + d.bobPhase) * d.bobAmp;
          const drawX = d.x;
          const drawY = d.y + bob;

          let morphT = 0;
          if (d.morphing) {
            const fadeIn = d.morphDuration;
            const hold = 1.6;
            if (d.morphElapsed < fadeIn) {
              morphT = d.morphElapsed / fadeIn;
            } else if (d.morphElapsed < fadeIn + hold) {
              morphT = 1;
            } else {
              morphT = 1 - (d.morphElapsed - fadeIn - hold) / fadeIn;
            }
            morphT = Math.max(0, Math.min(1, morphT));
            morphT = morphT * morphT * (3 - 2 * morphT); // ease
          }

          const alpha = d.opacity * centerFalloff(drawX);
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          ctx.strokeStyle = `rgb(${d.color})`;
          ctx.lineWidth = Math.max(1, d.size * 0.035);
          ctx.filter = d.blur > 0 ? `blur(${d.blur}px)` : 'none';

          if (morphT < 1) {
            ctx.save();
            ctx.globalAlpha = alpha * (1 - morphT);
            ctx.translate(drawX, drawY);
            ctx.rotate(d.rotation);
            drawDocument(ctx, d.size);
            ctx.restore();
          }
          if (morphT > 0) {
            ctx.save();
            ctx.globalAlpha = alpha * morphT;
            ctx.translate(drawX, drawY);
            ctx.rotate(d.rotation * 0.3);
            ICON_DRAWERS[d.icon](ctx, d.size);
            ctx.restore();
          }
          ctx.filter = 'none';

          if (cfg.canTrail) {
            d.trailAcc += dt;
            const speed = Math.hypot(vx, vy);
            if (d.trailAcc > 0.22 && speed > 4 && trails.length < 60) {
              d.trailAcc = 0;
              trails.push({
                x: drawX - vx * 0.05,
                y: drawY - vy * 0.05,
                size: rand(1.5, 3),
                life: 1,
                color: d.color,
              });
            }
          }
        });
      });

      trails = trails.filter((t) => t.life > 0);
      trails.forEach((t) => {
        t.life -= dt * 0.7;
        ctx.save();
        ctx.globalAlpha = Math.max(0, t.life) * 0.35 * centerFalloff(t.x);
        ctx.fillStyle = `rgb(${t.color})`;
        ctx.fillRect(t.x - t.size / 2, t.y - t.size / 2, t.size, t.size);
        ctx.restore();
      });
    };

    rafId = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onResize);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="fixed inset-0 w-full h-full pointer-events-none"
      style={{ zIndex: 0 }}
    />
  );
}
