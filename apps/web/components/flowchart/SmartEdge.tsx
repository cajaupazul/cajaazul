import React from 'react';
import { BaseEdge, EdgeProps } from '@xyflow/react';

// Custom hash function to deterministically assign offsets
function getEdgeHashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

// Generate rounded path with "bumps" (arcs) when crossing vertical zones
function getPathWithBumps(points: { x: number; y: number }[], radius: number = 8, colsToCross: number[] = []): string {
  if (points.length === 0) return '';
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;

  let path = `M ${points[0].x} ${points[0].y}`;

  for (let i = 1; i < points.length - 1; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const next = points[i + 1];

    const d1x = prev.x - curr.x;
    const d1y = prev.y - curr.y;
    const len1 = Math.sqrt(d1x * d1x + d1y * d1y);

    const d2x = next.x - curr.x;
    const d2y = next.y - curr.y;
    const len2 = Math.sqrt(d2x * d2x + d2y * d2y);

    const r = Math.min(radius, len1 / 2, len2 / 2);

    // If this is a long horizontal line, check if we need to draw bumps
    if (prev.y === curr.y && Math.abs(prev.x - curr.x) > 50 && colsToCross.length > 0) {
      const isLeftToRight = curr.x > prev.x;
      let currentX = prev.x + (isLeftToRight ? r : -r);
      const segmentY = prev.y;

      const bumps = [...colsToCross].sort((a, b) => isLeftToRight ? a - b : b - a);

      for (const bumpX of bumps) {
        // Only draw bump if it's strictly between the start and end of this horizontal segment
        if ((isLeftToRight && bumpX > prev.x + 30 && bumpX < curr.x - 30) ||
            (!isLeftToRight && bumpX < prev.x - 30 && bumpX > curr.x + 30)) {
          
          const startBumpX = bumpX - 8;
          const endBumpX = bumpX + 8;

          // Draw line to start of bump
          path += ` L ${startBumpX} ${segmentY}`;
          // Draw bump (arc)
          // A rx ry x-axis-rotation large-arc-flag sweep-flag x y
          const sweep = isLeftToRight ? 1 : 0;
          path += ` A 8 8 0 0 ${sweep} ${endBumpX} ${segmentY}`;
        }
      }
    }

    if (r > 0) {
      const p1x = curr.x + (d1x / len1) * r;
      const p1y = curr.y + (d1y / len1) * r;
      const p2x = curr.x + (d2x / len2) * r;
      const p2y = curr.y + (d2y / len2) * r;

      path += ` L ${p1x} ${p1y} Q ${curr.x} ${curr.y} ${p2x} ${p2y}`;
    } else {
      path += ` L ${curr.x} ${curr.y}`;
    }
  }

  const last = points[points.length - 1];
  path += ` L ${last.x} ${last.y}`;
  return path;
}

export default function SmartEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  style = {},
  markerEnd,
}: EdgeProps) {
  // Columns are placed at multiples of 320.
  const col_source = Math.round(sourceX / 320);
  const col_target = Math.round(targetX / 320);
  const d_col = col_target - col_source;

  const edgeHash = getEdgeHashCode(id);

  let path = '';
  const colsToCross: number[] = [];

  if (d_col === 1) {
    // Adjacent columns: Simple bridge
    const gapMid = (sourceX + targetX) / 2;
    const xOffset = ((edgeHash % 7) - 3) * 10; // Stagger vertical segment
    const routeX = gapMid + xOffset;

    const points = [
      { x: sourceX, y: sourceY },
      { x: routeX, y: sourceY },
      { x: routeX, y: targetY },
      { x: targetX, y: targetY },
    ];
    path = getPathWithBumps(points, 12, []);
  } else if (d_col > 1) {
    // Distant columns: Route through a horizontal corridor
    const corridors = [40, 220, 380, 540, 700, 860, 1020, 1180, 1340];
    const targetYMid = (sourceY + targetY) / 2;
    
    let corridorY = corridors[0];
    let minDiff = Math.abs(corridors[0] - targetYMid);
    for (let i = 1; i < corridors.length; i++) {
      const diff = Math.abs(corridors[i] - targetYMid);
      if (diff < minDiff) {
        minDiff = diff;
        corridorY = corridors[i];
      }
    }

    const yOffset = ((edgeHash % 5) - 2) * 8; // Stagger horizontal corridor segment
    const routeY = corridorY + yOffset;

    const gapSourceMid = sourceX + 60;
    const xOffsetSource = ((edgeHash % 7) - 3) * 10; // Stagger source vertical gap
    const routeX_source = gapSourceMid + xOffsetSource;

    const gapTargetMid = targetX - 60;
    const xOffsetTarget = (((edgeHash + 13) % 7) - 3) * 10; // Stagger target vertical gap
    const routeX_target = gapTargetMid + xOffsetTarget;

    // Calculate vertical lines we are crossing to place bumps
    for (let c = col_source + 1; c < col_target; c++) {
      // The middle of the gap is where vertical lines usually drop
      const gapCenter = c * 320 - 40;
      colsToCross.push(gapCenter - 15);
      colsToCross.push(gapCenter + 15);
    }

    const points = [
      { x: sourceX, y: sourceY },
      { x: routeX_source, y: sourceY },
      { x: routeX_source, y: routeY },
      { x: routeX_target, y: routeY },
      { x: routeX_target, y: targetY },
      { x: targetX, y: targetY },
    ];
    path = getPathWithBumps(points, 12, colsToCross);
  } else {
    // Backwards connection (edge case)
    const xOffset = ((edgeHash % 5) - 2) * 12;
    const points = [
      { x: sourceX, y: sourceY },
      { x: sourceX + 40 + xOffset, y: sourceY },
      { x: sourceX + 40 + xOffset, y: (sourceY + targetY) / 2 + 80 },
      { x: targetX - 40 + xOffset, y: (sourceY + targetY) / 2 + 80 },
      { x: targetX - 40 + xOffset, y: targetY },
      { x: targetX, y: targetY },
    ];
    path = getPathWithBumps(points, 12, []);
  }

  // Draw an invisible thicker path behind it to make it clickable
  return (
    <>
      <BaseEdge id={id + '_bg'} path={path} style={{ stroke: 'transparent', strokeWidth: 15 }} />
      <BaseEdge id={id} path={path} style={style} markerEnd={markerEnd} />
    </>
  );
}
