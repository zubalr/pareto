export interface Point {
  id: string;
  cost: number | null;
  solveRate: number; // percentage, e.g. 41.8
  [key: string]: any;
}

export interface DominateResult<T extends Point> {
  frontier: T[];
  dominated: T[];
}

/**
 * Calculates the Pareto frontier for minimizing cost and maximizing solveRate.
 * Points with null, undefined, or non-positive cost, or points marked as lacking cost data,
 * are omitted from the frontier calculation.
 */
export function dominate<T extends Point>(
  points: T[],
  options?: {
    getCost?: (p: T) => number | null;
    getSolveRate?: (p: T) => number;
  }
): DominateResult<T> {
  const getCost = options?.getCost ?? ((p: T) => p.cost);
  const getSolveRate = options?.getSolveRate ?? ((p: T) => p.solveRate);

  // Filter out points without valid cost
  const validPoints: T[] = [];
  const invalidPoints: T[] = [];

  for (const p of points) {
    const c = getCost(p);
    const s = getSolveRate(p);
    if (c !== null && c !== undefined && !Number.isNaN(c) && !Number.isNaN(s)) {
      validPoints.push(p);
    } else {
      invalidPoints.push(p);
    }
  }

  if (validPoints.length === 0) {
    return { frontier: [], dominated: [...invalidPoints] };
  }

  const frontier: T[] = [];
  const dominated: T[] = [...invalidPoints];

  for (let i = 0; i < validPoints.length; i++) {
    const p1 = validPoints[i];
    const c1 = getCost(p1)!;
    const s1 = getSolveRate(p1);

    let isDominated = false;

    for (let j = 0; j < validPoints.length; j++) {
      if (i === j) continue;
      const p2 = validPoints[j];
      const c2 = getCost(p2)!;
      const s2 = getSolveRate(p2);

      // p2 dominates p1 if:
      // c2 <= c1 AND s2 >= s1 AND (c2 < c1 OR s2 > s1)
      if (c2 <= c1 && s2 >= s1 && (c2 < c1 || s2 > s1)) {
        isDominated = true;
        break;
      }
    }

    if (isDominated) {
      dominated.push(p1);
    } else {
      frontier.push(p1);
    }
  }

  // Sort frontier by cost ascending (and solveRate ascending)
  frontier.sort((a, b) => {
    const ca = getCost(a)!;
    const cb = getCost(b)!;
    if (ca !== cb) return ca - cb;
    return getSolveRate(a) - getSolveRate(b);
  });

  return { frontier, dominated };
}

/**
 * Calculates the knee point of the Pareto frontier.
 * Uses the Kneedle chord distance method (max perpendicular distance from the chord
 * between the cheapest and most accurate points).
 */
export function knee<T extends Point>(
  frontier: T[],
  options?: {
    getCost?: (p: T) => number | null;
    getSolveRate?: (p: T) => number;
  }
): T | null {
  if (!frontier || frontier.length === 0) {
    return null;
  }

  if (frontier.length === 1) {
    return frontier[0];
  }

  const getCost = options?.getCost ?? ((p: T) => p.cost);
  const getSolveRate = options?.getSolveRate ?? ((p: T) => p.solveRate);

  // Ensure sorted by cost ascending
  const sorted = [...frontier].sort((a, b) => {
    const ca = getCost(a) ?? 0;
    const cb = getCost(b) ?? 0;
    return ca - cb;
  });

  if (sorted.length === 2) {
    // With 2 points, return the higher solve rate point if it represents good trade-off or first
    return sorted[1];
  }

  const first = sorted[0];
  const last = sorted[sorted.length - 1];

  const minCost = getCost(first) ?? 0;
  const maxCost = getCost(last) ?? 0;
  const minSolve = getSolveRate(first);
  const maxSolve = getSolveRate(last);

  const costRange = maxCost - minCost;
  const solveRange = maxSolve - minSolve;

  if (costRange <= 0 || solveRange <= 0) {
    return sorted[0];
  }

  let maxDistance = -Infinity;
  let kneePoint: T = sorted[0];

  for (let i = 0; i < sorted.length; i++) {
    const pt = sorted[i];
    const c = getCost(pt) ?? 0;
    const s = getSolveRate(pt);

    // Normalize coordinates to [0, 1]
    const x = (c - minCost) / costRange;
    const y = (s - minSolve) / solveRange;

    // Perpendicular distance to chord line connecting (0,0) and (1,1):
    // Line equation: y - x = 0
    // Distance = (y - x) / sqrt(2)
    const distance = (y - x) / Math.SQRT2;

    if (distance > maxDistance) {
      maxDistance = distance;
      kneePoint = pt;
    }
  }

  return kneePoint;
}
