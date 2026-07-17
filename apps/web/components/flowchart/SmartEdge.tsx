import React from 'react';
import { BaseEdge, EdgeProps, getSmoothStepPath } from '@xyflow/react';

const CORNER_R = 10;
const CLEARANCE = 30; // 30px is exactly halfway in the 60px gap between columns

export default function SmartEdge({
  id,
  sourceX,
  sourceY,
  sourcePosition,
  targetX,
  targetY,
  targetPosition,
  style,
  markerEnd,
}: EdgeProps) {
  
  let path = '';

  // Custom Manhattan Detour: When a Left-to-Right edge skips one or more columns
  // We must detour through an empty horizontal corridor so we don't slice through nodes!
  if (sourcePosition === 'right' && targetPosition === 'left' && targetX - sourceX > 300) {
    const sx = sourceX;
    const sy = sourceY;
    const tx = targetX;
    const ty = targetY;
    const r = CORNER_R;
    const cl = CLEARANCE;

    const vertX1 = sx + cl;     // Gap immediately after source
    const vertX2 = tx - cl;     // Gap immediately before target
    const isGoingDown = ty >= sy;
    
    // Rows are 150px apart. Center of node is sy. Corridor is exactly between rows: sy +/- 75.
    const corridorY = isGoingDown ? sy + 75 : sy - 75;

    const dirY1 = corridorY > sy ? 1 : -1;
    const dirY2 = ty > corridorY ? 1 : -1;

    // Ensure we have enough space for rounded corners
    const safeR1 = Math.min(r, Math.abs(corridorY - sy) / 2);
    const safeR2 = Math.min(r, Math.abs(ty - corridorY) / 2);

    // Corner 1: Right -> Up/Down
    const c1 = `L ${vertX1 - safeR1} ${sy} Q ${vertX1} ${sy} ${vertX1} ${sy + dirY1 * safeR1}`;
    // Corner 2: Up/Down -> Right
    const c2 = `L ${vertX1} ${corridorY - dirY1 * safeR1} Q ${vertX1} ${corridorY} ${vertX1 + safeR1} ${corridorY}`;
    // Corner 3: Right -> Up/Down
    const c3 = `L ${vertX2 - safeR2} ${corridorY} Q ${vertX2} ${corridorY} ${vertX2} ${corridorY + dirY2 * safeR2}`;
    // Corner 4: Up/Down -> Right
    const c4 = `L ${vertX2} ${ty - dirY2 * safeR2} Q ${vertX2} ${ty} ${vertX2 + safeR2} ${ty}`;

    path = `M ${sx} ${sy} ${c1} ${c2} ${c3} ${c4} L ${tx} ${ty}`;
  } else {
    // For all other cases (Top/Bottom handles, adjacent columns, backwards), use the robust native router
    const [smoothPath] = getSmoothStepPath({
      sourceX, sourceY, sourcePosition,
      targetX, targetY, targetPosition,
      borderRadius: CORNER_R,
      offset: CLEARANCE,
    });
    path = smoothPath;
  }

  return (
    <BaseEdge
      id={id}
      path={path}
      style={style}
      markerEnd={markerEnd}
      interactionWidth={20}
    />
  );
}
