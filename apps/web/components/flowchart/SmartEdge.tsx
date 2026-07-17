'use client';
import React from 'react';
import { BaseEdge, EdgeProps } from '@xyflow/react';

const CORNER_R  = 14;  // radius of rounded corners
const BUMP_R    = 7;   // radius of bridge bumps at crossings
const CLEARANCE = 28;  // minimum distance from node border before turning

/** Returns true if cx is strictly between a and b (±margin). */
function isBetween(cx: number, a: number, b: number, margin = 20): boolean {
  const lo = Math.min(a, b) + margin;
  const hi = Math.max(a, b) - margin;
  return cx >= lo && cx <= hi;
}

/** Emit arc bumps along a horizontal segment. */
function emitHorizBumps(bumpXs: number[], y: number, goRight: boolean, br: number): string {
  let d = '';
  const sweep = goRight ? 1 : 0;
  const sorted = [...bumpXs].sort((a, b) => goRight ? a - b : b - a);
  for (const cx of sorted) {
    d += ` L ${cx - br} ${y} A ${br} ${br} 0 0 ${sweep} ${cx + br} ${y}`;
  }
  return d;
}

/**
 * Build an orthogonal path with:
 * - CLEARANCE gap from node borders before any turn
 * - Rounded corners (CORNER_R)
 * - Arc bumps at real crossings (BUMP_R)
 */
function buildPath(
  sx: number, sy: number,
  tx: number, ty: number,
  sourcePos: string | undefined,
  targetPos: string | undefined,
  vertX: number,
  crossings: number[],
): string {
  const r  = CORNER_R;
  const br = BUMP_R;
  const cl = CLEARANCE;

  // ── Top / Bottom handles: route through a mid-Y corridor ──────────────────
  if (sourcePos === 'top' || sourcePos === 'bottom' || targetPos === 'top' || targetPos === 'bottom') {
    const mid = (sy + ty) / 2;
    const vd1 = mid > sy ? 1 : -1;
    const vd2 = ty > mid ? 1 : -1;
    const hd  = tx > sx ? 1 : -1;

    // Leg 1: exit node vertically with clearance
    const leg1y = sy + vd1 * cl;
    // Corner 1: vertical → horizontal
    const c1ey = mid - vd1 * r;
    // Corner 2: horizontal → vertical
    const c2ex = tx - hd * r;
    // Leg 2: arrive at target with clearance
    const leg2y = ty - vd2 * cl;

    return [
      `M ${sx} ${sy}`,
      `L ${sx} ${c1ey}`,
      `Q ${sx} ${mid} ${sx + hd * r} ${mid}`,
      `L ${c2ex} ${mid}`,
      `Q ${tx} ${mid} ${tx} ${mid + vd2 * r}`,
      `L ${tx} ${ty}`,
    ].join(' ');
  }

  // ── Straight horizontal (same Y) ──────────────────────────────────────────
  if (Math.abs(sy - ty) < 2) {
    const goRight = tx > sx;
    const sorted = crossings
      .filter(cx => isBetween(cx, sx, tx))
      .sort((a, b) => goRight ? a - b : b - a);
    let d = `M ${sx} ${sy}`;
    d += emitHorizBumps(sorted, sy, goRight, br);
    d += ` L ${tx} ${ty}`;
    return d;
  }

  // ── Backwards / same column: loop around the left side ─────────────────────
  const goRight = tx > sx;
  if (!goRight || Math.abs(sx - tx) < 10) {
    const loopX = Math.min(sx, tx) - cl - r;
    const vDir = ty > sy ? 1 : -1;
    return [
      `M ${sx} ${sy}`,
      `L ${sx - r} ${sy}`,
      `Q ${loopX + r} ${sy} ${loopX} ${sy + vDir * r}`,
      `L ${loopX} ${ty - vDir * r}`,
      `Q ${loopX} ${ty} ${loopX + r} ${ty}`,
      `L ${tx} ${ty}`,
    ].join(' ');
  }

  // ── Normal left-to-right: L-shaped with CLEARANCE from both nodes ──────────
  // Anchor the vertical segment inside the gap, respecting clearance on both sides
  const minVertX = sx + cl;          // must be at least CLEARANCE right of source
  const maxVertX = tx - cl;          // must be at least CLEARANCE left of target
  const clampedVertX = Math.max(minVertX, Math.min(maxVertX, vertX));

  const vDir  = ty > sy ? 1 : -1;

  // Crossings on SOURCE horizontal segment (sy level, from sx to clampedVertX)
  const srcCrossings = crossings
    .filter(cx => isBetween(cx, sx, clampedVertX))
    .sort((a, b) => a - b);

  // Crossings on TARGET horizontal segment (ty level, from clampedVertX to tx)
  const tgtCrossings = crossings
    .filter(cx => isBetween(cx, clampedVertX, tx))
    .sort((a, b) => a - b);

  let d = `M ${sx} ${sy}`;

  // Source horizontal → bumps → corner 1
  d += emitHorizBumps(srcCrossings, sy, true, br);
  d += ` L ${clampedVertX - r} ${sy}`;
  d += ` Q ${clampedVertX} ${sy} ${clampedVertX} ${sy + vDir * r}`;

  // Vertical segment
  d += ` L ${clampedVertX} ${ty - vDir * r}`;

  // Corner 2 → bumps → target
  d += ` Q ${clampedVertX} ${ty} ${clampedVertX + r} ${ty}`;
  d += emitHorizBumps(tgtCrossings, ty, true, br);
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
  sourcePosition,
  targetPosition,
  style = {},
  markerEnd,
  data,
}: EdgeProps) {
  const vertX: number       = (data as any)?.vertX     ?? (sourceX + targetX) / 2;
  const crossings: number[] = (data as any)?.crossings ?? [];

  const path = buildPath(
    sourceX, sourceY,
    targetX, targetY,
    sourcePosition,
    targetPosition,
    vertX,
    crossings,
  );

  return (
    <>
      {/* Fat invisible hit area for easier click/touch */}
      <BaseEdge id={id + '_hit'} path={path} style={{ stroke: 'transparent', strokeWidth: 18 }} />
      {/* Visible styled path */}
      <BaseEdge id={id} path={path} style={style} markerEnd={markerEnd} />
    </>
  );
}
