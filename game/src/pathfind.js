// Breadth-first grid pathfinding over the tile map: returns a list of pixel waypoints
// (tile centres) from the start tile to the goal tile, avoiding blocked tiles, or null
// when no route exists. Used by the autopilot and by guards that investigate or chase.

export function findPath(isBlockedTile, cols, rows, startCol, startRow, goalCol, goalRow) {
  if (startCol === goalCol && startRow === goalRow) return [];
  const key = (c, r) => r * cols + c;
  const prev = new Map();
  const queue = [[startCol, startRow]];
  prev.set(key(startCol, startRow), null);
  while (queue.length > 0) {
    const [c, r] = queue.shift();
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nc = c + dc;
      const nr = r + dr;
      if (nc < 0 || nr < 0 || nc >= cols || nr >= rows) continue;
      if (prev.has(key(nc, nr))) continue;
      if (isBlockedTile(nc, nr)) continue;
      prev.set(key(nc, nr), [c, r]);
      if (nc === goalCol && nr === goalRow) {
        const path = [];
        let cur = [nc, nr];
        while (cur !== null) {
          path.push([(cur[0] + 0.5) * 40, (cur[1] + 0.5) * 40]);
          cur = prev.get(key(cur[0], cur[1]));
        }
        path.reverse();
        path.shift();
        return path;
      }
      queue.push([nc, nr]);
    }
  }
  return null;
}
