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

/** Start the animation on the sign-in chart. Safe to call more than once. */
export function animateAuthFigure(svg) {
  if (!svg || svg.dataset.animated) return;
  svg.dataset.animated = '1';
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const demand = svg.querySelector('.curve-d');
  const ghost = svg.querySelector('.curve-d-ghost');
  const labelD = svg.querySelector('.label-d');
  const dot = svg.querySelector('.eq-dot');
  const guide = svg.querySelector('.guide-eq');
  const guideUp = svg.querySelector('.guide-label');
  const label = svg.querySelector('.label-eq');
  if (!demand || !dot || !guide) return;

  let started = null;
  function frame(now) {
    if (!svg.isConnected) return; // signed in: the chart is gone
    if (started === null) started = now;
    const elapsed = now - started - START_DELAY;
    if (elapsed > 0) {
      const dx = shiftAt(elapsed);
      const [x, y] = equilibrium(dx);
      demand.setAttribute('transform', `translate(${dx.toFixed(2)} 0)`);
      if (labelD) labelD.setAttribute('transform', `translate(${dx.toFixed(2)} 0)`);
      if (ghost) ghost.style.opacity = String(Math.min(0.45, dx / 26));
      dot.setAttribute('cx', x.toFixed(2));
      dot.setAttribute('cy', y.toFixed(2));
      guide.setAttribute('d', `M${AXIS_X} ${y.toFixed(2)} H${x.toFixed(2)} V${AXIS_Y}`);
      if (guideUp) guideUp.setAttribute('d', `M${x.toFixed(2)} 58 V${(y - 12).toFixed(2)}`);
      if (label) label.setAttribute('x', x.toFixed(2));
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
