'use client';
import React from 'react';
import { BaseEdge, EdgeProps } from '@xyflow/react';

const CORNER_R = 10;
const BUMP_R   = 7;

/**
 * Builds a pure orthogonal L-shaped path (source → vertical joint → target)
 * with rounded corners, then inserts arc bumps at real crossing X positions
 * on each horizontal segment.
 *
 * vertX   – the X coordinate of the shared vertical segment
 * crossings – X coordinates of OTHER edges' vertical segments that actually
 *             cross one of our horizontal segments (computed by the parent).
 */
function buildPath(
  sx: number, sy: number,
  tx: number, ty: number,
  vertX: number,
  crossings: number[],
): string {
  const r  = CORNER_R;
  const br = BUMP_R;

  // ── Trivial: same Y → straight horizontal ─────────────────────────────────
  if (Math.abs(sy - ty) < 2) {
    return buildHorizWithBumps(sx, sy, tx, ty, crossings);
  }

  // ── Trivial: same X → straight vertical (no bumps needed) ─────────────────
  if (Math.abs(sx - tx) < 2) {
    return `M ${sx} ${sy} L ${tx} ${ty}`;
  }

  const hDir1 = vertX >= sx ? 1 : -1;
  const hDir2 = tx   >= vertX ? 1 : -1;
  const vDir  = ty > sy ? 1 : -1;

  // Crossings that fall on the SOURCE horizontal segment (at height sy)
  const seg1Cross = crossings
    .filter(cx => isBetween(cx, sx, vertX))
    .sort((a, b) => hDir1 > 0 ? a - b : b - a);

  // Crossings that fall on the TARGET horizontal segment (at height ty)
  const seg2Cross = crossings
    .filter(cx => isBetween(cx, vertX, tx))
    .sort((a, b) => hDir2 > 0 ? a - b : b - a);

  let d = `M ${sx} ${sy}`;

  // Source horizontal with bumps
  d += emitBumps(sx, sy, seg1Cross, hDir1 > 0, br);

  // Corner 1: approach corner
  d += ` L ${vertX - hDir1 * r} ${sy}`;
  d += ` Q ${vertX} ${sy} ${vertX} ${sy + vDir * r}`;

  // Vertical segment
  d += ` L ${vertX} ${ty - vDir * r}`;

  // Corner 2: exit corner
  d += ` Q ${vertX} ${ty} ${vertX + hDir2 * r} ${ty}`;

  // Target horizontal with bumps
  d += emitBumps(vertX + hDir2 * r, ty, seg2Cross, hDir2 > 0, br);

  d += ` L ${tx} ${ty}`;
  return d;
}

/** Returns true if cx is strictly between a and b (±20px margin). */
function isBetween(cx: number, a: number, b: number): boolean {
  const lo = Math.min(a, b) + 20;
  const hi = Math.max(a, b) - 20;
  return cx >= lo && cx <= hi;
}

/** Emit the L and A commands for a sequence of bumps along a horizontal line. */
function emitBumps(
  startX: number, y: number,
  bumpXs: number[],
  goRight: boolean,
  br: number,
): string {
  let d = '';
  const sweep = goRight ? 1 : 0;
  for (const cx of bumpXs) {
    d += ` L ${cx - br} ${y}`;
    d += ` A ${br} ${br} 0 0 ${sweep} ${cx + br} ${y}`;
  }
  return d;
}

/** Build a plain horizontal line with arc bumps. */
function buildHorizWithBumps(sx: number, sy: number, tx: number, ty: number, crossings: number[]): string {
  const goRight = tx > sx;
  const sorted = [...crossings]
    .filter(cx => isBetween(cx, sx, tx))
    .sort((a, b) => goRight ? a - b : b - a);

  let d = `M ${sx} ${sy}`;
  d += emitBumps(sx, sy, sorted, goRight, BUMP_R);
  d += ` L ${tx} ${ty}`;
  return d;
}

// ─── SmartEdge component ────────────────────────────────────────────────────
export default function SmartEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  style = {},
  markerEnd,
  data,
}: EdgeProps) {
  // vertX and crossings are injected by InteractiveFlowchart via edge.data
  const vertX: number     = (data as any)?.vertX     ?? (sourceX + targetX) / 2;
  const crossings: number[] = (data as any)?.crossings ?? [];

  const path = buildPath(sourceX, sourceY, targetX, targetY, vertX, crossings);

  return (
    <>
      {/* Fat invisible hit area for easier click/touch */}
      <BaseEdge id={id + '_hit'} path={path} style={{ stroke: 'transparent', strokeWidth: 18 }} />
      {/* Visible styled path */}
      <BaseEdge id={id} path={path} style={style} markerEnd={markerEnd} />
    </>
  );
}
