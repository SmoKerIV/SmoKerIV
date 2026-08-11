/**
 * 4-point homography → CSS matrix3d, used to pin DOM "ink" panes onto the
 * projected corners of the 3D book pages (Franklin Ta's adjugate method).
 */

export interface ScreenPoint {
  x: number;
  y: number;
}

/** 3×3 row-major matrix. */
type M3 = [
  number, number, number,
  number, number, number,
  number, number, number,
];

function adjugate(m: M3): M3 {
  return [
    m[4] * m[8] - m[5] * m[7], m[2] * m[7] - m[1] * m[8], m[1] * m[5] - m[2] * m[4],
    m[5] * m[6] - m[3] * m[8], m[0] * m[8] - m[2] * m[6], m[2] * m[3] - m[0] * m[5],
    m[3] * m[7] - m[4] * m[6], m[1] * m[6] - m[0] * m[7], m[0] * m[4] - m[1] * m[3],
  ];
}

function multmm(a: M3, b: M3): M3 {
  const c = new Array<number>(9) as M3;
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 3; col++) {
      let sum = 0;
      for (let k = 0; k < 3; k++) sum += a[row * 3 + k]! * b[k * 3 + col]!;
      c[row * 3 + col] = sum;
    }
  }
  return c;
}

function multmv(m: M3, v: [number, number, number]): [number, number, number] {
  return [
    m[0] * v[0] + m[1] * v[1] + m[2] * v[2],
    m[3] * v[0] + m[4] * v[1] + m[5] * v[2],
    m[6] * v[0] + m[7] * v[1] + m[8] * v[2],
  ];
}

/** Projective basis mapping the unit basis onto 4 points (p4 = p1+p2+p3 mix). */
function basisToPoints(
  p1: ScreenPoint, p2: ScreenPoint, p3: ScreenPoint, p4: ScreenPoint,
): M3 {
  const m: M3 = [p1.x, p2.x, p3.x, p1.y, p2.y, p3.y, 1, 1, 1];
  const v = multmv(adjugate(m), [p4.x, p4.y, 1]);
  return multmm(m, [v[0], 0, 0, 0, v[1], 0, 0, 0, v[2]]);
}

/**
 * CSS matrix3d string mapping a w×h rect (top-left at the viewport origin,
 * transform-origin 0 0) onto the given screen-space corners.
 * Corner order: top-left, top-right, bottom-left, bottom-right.
 */
export function computeMatrix3d(
  tl: ScreenPoint, tr: ScreenPoint, bl: ScreenPoint, br: ScreenPoint,
  w: number, h: number,
): string {
  const src = basisToPoints({ x: 0, y: 0 }, { x: w, y: 0 }, { x: 0, y: h }, { x: w, y: h });
  const dst = basisToPoints(tl, tr, bl, br);
  const t = multmm(dst, adjugate(src));
  if (t[8] === 0) return "matrix3d(1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1)";
  const n = t.map((value) => value / t[8]) as M3;
  // Expand 3×3 (x, y, w rows) to a column-major 4×4 with identity z.
  const m4 = [
    n[0], n[3], 0, n[6],
    n[1], n[4], 0, n[7],
    0, 0, 1, 0,
    n[2], n[5], 0, n[8],
  ];
  return `matrix3d(${m4.map((value) => value.toFixed(6)).join(",")})`;
}
