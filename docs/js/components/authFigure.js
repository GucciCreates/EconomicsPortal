/**
 * EconomicsPortal — the supply-and-demand chart on the sign-in page.
 *
 * After the curves draw in, demand shifts right and back again, slowly and
 * forever. The equilibrium dot and its guide lines follow the real point
 * where the two curves cross, so the picture stays correct economics.
 * Nothing moves for people who ask for reduced motion, and the loop stops
 * by itself once the sign-in page is gone.
 */

const S = [[64, 228], [130, 190], [230, 110], [392, 36]];
const D = [[64, 40], [140, 80], [270, 170], [392, 228]];
const AXIS_X = 40; // y axis
const AXIS_Y = 244; // x axis
const SHIFT = 46; // how far demand moves right, in chart units
const START_DELAY = 1500; // let the curves finish drawing first
const HOLD = 1400; // pause at each end
const MOVE = 2600; // time for one shift

function bezier(p, t) {
  const u = 1 - t;
  const a = u * u * u;
  const b = 3 * u * u * t;
  const c = 3 * u * t * t;
  const d = t * t * t;
  return [a * p[0][0] + b * p[1][0] + c * p[2][0] + d * p[3][0], a * p[0][1] + b * p[1][1] + c * p[2][1] + d * p[3][1]];
}

const sample = (p, n = 240) => Array.from({ length: n + 1 }, (_, i) => bezier(p, i / n));
const S_PTS = sample(S);
const D_PTS = sample(D); // x rises steadily along D, so y can be read off by x

function demandY(x) {
  if (x <= D_PTS[0][0]) return D_PTS[0][1];
  for (let i = 1; i < D_PTS.length; i++) {
    const [x1, y1] = D_PTS[i];
    if (x1 >= x) {
      const [x0, y0] = D_PTS[i - 1];
      return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0 || 1);
    }
  }
  return D_PTS[D_PTS.length - 1][1];
}

/** Where supply meets demand shifted right by `dx`. */
export function equilibrium(dx) {
  let prev = null;
  for (const [x, y] of S_PTS) {
    const gap = y - demandY(x - dx); // supply below demand (in screen y) until they cross
    if (prev && Math.sign(gap) !== Math.sign(prev.gap)) {
      const k = prev.gap / (prev.gap - gap);
      return [prev.x + (x - prev.x) * k, prev.y + (y - prev.y) * k];
    }
    prev = { x, y, gap };
  }
  return [216.03, 130.45];
}

const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/** Shift of demand at time `ms` since the loop began: 0 → SHIFT → 0 … */
function shiftAt(ms) {
  const cycle = 2 * (HOLD + MOVE);
  const t = ms % cycle;
  if (t < HOLD) return 0;
  if (t < HOLD + MOVE) return SHIFT * ease((t - HOLD) / MOVE);
  if (t < 2 * HOLD + MOVE) return SHIFT;
  return SHIFT * (1 - ease((t - 2 * HOLD - MOVE) / MOVE));
}

const MIN_SHIFT = -36; // how far a visitor can push demand left …
const MAX_SHIFT = 58; // … and right
const f = (n) => n.toFixed(2);

/** Polygon along `pts` (already shifted) between x0 and x1, closed to the price line. */
function surplusPath(pts, x1, yE, fromTop) {
  const inside = pts.filter(([x]) => x >= S[0][0] && x <= x1); // keep it right of where the curves begin
  if (!inside.length) return '';
  const edge = fromTop ? inside : inside.slice().reverse();
  const start = `M${f(inside[0][0])} ${f(yE)}`;
  const along = edge.map(([x, y]) => `L${f(x)} ${f(y)}`).join(' ');
  return fromTop ? `${start} ${along} L${f(x1)} ${f(yE)} Z` : `${start} L${f(x1)} ${f(yE)} ${along} Z`;
}

/** Draw everything that depends on where demand is. */
function drawAt(els, dx) {
  const [x, y] = equilibrium(dx);
  const shift = `translate(${f(dx)} 0)`;
  els.demand.setAttribute('transform', shift);
  if (els.labelD) els.labelD.setAttribute('transform', shift);
  if (els.ghost) els.ghost.style.opacity = String(Math.min(0.5, Math.abs(dx) / 24));
  for (const dot of els.dots) {
    dot.setAttribute('cx', f(x));
    dot.setAttribute('cy', f(y));
  }
  els.guide.setAttribute('d', `M${AXIS_X} ${f(y)} H${f(x)} V${AXIS_Y}`);
  if (els.guideUp) els.guideUp.setAttribute('d', `M${f(x)} 58 V${f(y - 12)}`);
  if (els.label) els.label.setAttribute('x', f(x));
  if (els.labelBg) els.labelBg.setAttribute('x', f(x - els.labelWidth / 2));
  if (els.markP) els.markP.setAttribute('transform', `translate(0 ${f(y)})`);
  if (els.markQ) els.markQ.setAttribute('transform', `translate(${f(x)} 0)`);

  // Consumer surplus: under demand, above the price. Producer surplus: above supply, below it.
  const demandPts = D_PTS.map(([px, py]) => [px + dx, py]);
  if (els.cs) els.cs.setAttribute('d', surplusPath(demandPts, x, y, true));
  if (els.ps) els.ps.setAttribute('d', surplusPath(S_PTS, x, y, false));
  // Labels sit near the price line, where each triangle is widest.
  const placeLabel = (el, left, cy) => {
    if (!el) return;
    const cx = left + (x - left) * 0.4;
    el.querySelectorAll('tspan').forEach((t) => t.setAttribute('x', f(cx)));
    el.setAttribute('x', f(cx));
    el.setAttribute('y', f(cy));
  };
  placeLabel(els.csLabel, Math.max(S[0][0], D[0][0] + dx), y - 20);
  placeLabel(els.psLabel, S[0][0], y + 18);
}

/** Start the chart on the sign-in page. Safe to call more than once. */
export function animateAuthFigure(svg) {
  if (!svg || svg.dataset.animated) return;
  svg.dataset.animated = '1';
  const q = (sel) => svg.querySelector(sel);
  const els = {
    demand: q('.curve-d'),
    ghost: q('.curve-d-ghost'),
    labelD: q('.label-d'),
    dots: [q('.eq-dot'), q('.eq-halo')].filter(Boolean),
    guide: q('.guide-eq'),
    guideUp: q('.guide-label'),
    label: q('.label-eq'),
    labelBg: q('.label-eq-bg'),
    markP: q('.mark-p'),
    markQ: q('.mark-q'),
    cs: q('.area-cs'),
    ps: q('.area-ps'),
    csLabel: q('.area-label-cs'),
    psLabel: q('.area-label-ps'),
    labelWidth: 172,
  };
  if (!els.demand || !els.guide || !els.dots.length) return;
  // Fit the highlighter behind the label to the label's real width.
  try {
    const w = els.label.getComputedTextLength();
    if (w > 0) {
      els.labelWidth = w + 14;
      els.labelBg.setAttribute('width', f(els.labelWidth));
    }
  } catch (e) {
    /* keep the default */
  }
  drawAt(els, 0);

  const still = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Move across (or drag on) the chart to push demand left or right.
  let pointerShift = null;
  const toShift = (event) => {
    const ctm = svg.getScreenCTM();
    if (!ctm) return null;
    const x = (event.clientX - ctm.e) / ctm.a; // chart units
    const t = Math.min(1, Math.max(0, (x - 80) / (380 - 80)));
    return MIN_SHIFT + t * (MAX_SHIFT - MIN_SHIFT);
  };
  svg.addEventListener('pointermove', (e) => {
    pointerShift = toShift(e);
    if (still && pointerShift !== null) drawAt(els, pointerShift);
  });
  svg.addEventListener('pointerdown', (e) => {
    pointerShift = toShift(e);
    if (still && pointerShift !== null) drawAt(els, pointerShift);
  });
  const release = () => {
    pointerShift = null;
    if (still) drawAt(els, 0);
  };
  svg.addEventListener('pointerleave', release);
  svg.addEventListener('pointercancel', release);
  if (still) return; // no motion that the visitor didn't cause

  let started = null;
  let current = 0;
  let loopFrom = 0; // keeps the loop from jumping when a visitor lets go
  function frame(now) {
    if (!svg.isConnected) return; // signed in: the chart is gone
    if (started === null) started = now;
    const elapsed = now - started - START_DELAY;
    if (elapsed > 0 || pointerShift !== null) {
      if (pointerShift !== null) loopFrom = now;
      const loopTarget = shiftAt(Math.max(0, now - Math.max(started + START_DELAY, loopFrom)));
      const target = pointerShift !== null ? pointerShift : loopTarget;
      current += (target - current) * (pointerShift !== null ? 0.18 : 0.12);
      if (Math.abs(target - current) < 0.01) current = target;
      drawAt(els, current);
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
