'use client';
import React from 'react';
import { BaseEdge, EdgeProps, Position } from '@xyflow/react';

const CORNER_R = 10;
const BUMP_R   = 7;

/** Returns true if cx is strictly between a and b (±margin). */
function isBetween(cx: number, a: number, b: number, margin = 20): boolean {
  const lo = Math.min(a, b) + margin;
  const hi = Math.max(a, b) - margin;
  return cx >= lo && cx <= hi;
}

/** Emit arc bump commands along a horizontal line at each crossing X. */
function emitHorizBumps(
  bumpXs: number[],
  y: number,
  goRight: boolean,
  br: number,
): string {
  let d = '';
  const sweep = goRight ? 1 : 0;
  const sorted = [...bumpXs].sort((a, b) => goRight ? a - b : b - a);
  for (const cx of sorted) {
    d += ` L ${cx - br} ${y}`;
    d += ` A ${br} ${br} 0 0 ${sweep} ${cx + br} ${y}`;
  }
  return d;
}

/** Emit arc bump commands along a vertical line at each crossing Y. */
function emitVertBumps(
  bumpYs: number[],
  x: number,
  goDown: boolean,
  br: number,
): string {
  let d = '';
  const sweep = goDown ? 0 : 1;
  const sorted = [...bumpYs].sort((a, b) => goDown ? a - b : b - a);
  for (const cy of sorted) {
    d += ` L ${x} ${cy - br}`;
    d += ` A ${br} ${br} 0 0 ${sweep} ${x} ${cy + br}`;
  }
  return d;
}

/**
 * Build a clean orthogonal path that routes around nodes.
 * 
 * The routing strategy depends on the handle positions:
 *  - Right→Left (normal):  horizontal gap routing with vertX in the gap
 *  - Top→*  or  *→Bottom: use vertical corridor routing
 *  - Backwards or same column: loop around using extra margin
 * 
 * crossings: X positions where OTHER edges' vertical lines intersect our horizontal segments.
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

  const goRight = tx >= sx;
  const goDown  = ty >= sy;

  // ── Case 1: Top or Bottom handles — use vertical corridor routing ──────────
  if (sourcePos === 'top' || sourcePos === 'bottom' || targetPos === 'top' || targetPos === 'bottom') {
    // Pick a horizontal corridor Y midway between source and target
    const corridorY = (sy + ty) / 2;
    const vDir1 = corridorY > sy ? 1 : -1;
    const vDir2 = ty > corridorY ? 1 : -1;
    const hDir  = tx >= sx ? 1 : -1;

    return [
      `M ${sx} ${sy}`,
      `L ${sx} ${corridorY - vDir1 * r}`,
      `Q ${sx} ${corridorY} ${sx + hDir * r} ${corridorY}`,
      `L ${tx - hDir * r} ${corridorY}`,
      `Q ${tx} ${corridorY} ${tx} ${corridorY + vDir2 * r}`,
      `L ${tx} ${ty}`,
    ].join(' ');
  }

  // ── Case 2: Same Y — straight horizontal ──────────────────────────────────
  if (Math.abs(sy - ty) < 2) {
    const sorted = crossings
      .filter(cx => isBetween(cx, sx, tx))
      .sort((a, b) => goRight ? a - b : b - a);
    let d = `M ${sx} ${sy}`;
    d += emitHorizBumps(sorted, sy, goRight, br);
    d += ` L ${tx} ${ty}`;
    return d;
  }

  // ── Case 3: Same column or backwards — loop around ────────────────────────
  if (!goRight || Math.abs(sx - tx) < 20) {
    const loopX = Math.min(sx, tx) - 50;
    return [
      `M ${sx} ${sy}`,
      `L ${sx - r} ${sy}`,
      `Q ${loopX} ${sy} ${loopX} ${(sy + ty) / 2}`,
      `Q ${loopX} ${ty} ${tx - r} ${ty}`,
      `L ${tx} ${ty}`,
    ].join(' ');
  }

  // ── Case 4: Normal left-to-right — L-shaped through the column gap ────────
  // Crossings on SOURCE horizontal segment (at height sy)
  const srcCrossings = crossings
    .filter(cx => isBetween(cx, sx, vertX))
    .sort((a, b) => goRight ? a - b : b - a);

  // Crossings on TARGET horizontal segment (at height ty)
  const tgtCrossings = crossings
    .filter(cx => isBetween(cx, vertX, tx))
    .sort((a, b) => goRight ? a - b : b - a);

  const vDir  = goDown ? 1 : -1;
  const hDir1 = vertX >= sx ? 1 : -1;
  const hDir2 = tx >= vertX ? 1 : -1;

  let d = `M ${sx} ${sy}`;

  // Source horizontal with bumps
  d += emitHorizBumps(srcCrossings, sy, hDir1 > 0, br);

  // Corner 1 (source end of horizontal → start of vertical)
  d += ` L ${vertX - hDir1 * r} ${sy}`;
  d += ` Q ${vertX} ${sy} ${vertX} ${sy + vDir * r}`;

  // Vertical segment
  d += ` L ${vertX} ${ty - vDir * r}`;

  // Corner 2 (end of vertical → target horizontal)
  d += ` Q ${vertX} ${ty} ${vertX + hDir2 * r} ${ty}`;

  // Target horizontal with bumps
  d += emitHorizBumps(tgtCrossings, ty, hDir2 > 0, br);

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
  // vertX and crossings are injected by InteractiveFlowchart via edge.data
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
