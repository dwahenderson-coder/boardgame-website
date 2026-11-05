import { CITY_SLOT_COSTS, POWER_GRID_MAPS } from './constants.js';
import {
  CityOccupancyState,
  PowerGridMapDefinition,
  PowerGridStep,
} from './types.js';

/**
 * Verifies that the selected active regions form a single connected component.
 */
export function areRegionsContiguous(
  map: PowerGridMapDefinition,
  regionIds: readonly string[]
): boolean {
  if (regionIds.length === 0) return false;
  const activeSet = new Set(regionIds);
  for (const r of regionIds) {
    if (!map.regions.includes(r)) {
      return false;
    }
  }

  const visited = new Set<string>();
  const queue: string[] = [regionIds[0]!];
  visited.add(regionIds[0]!);

  while (queue.length > 0) {
    const curr = queue.shift()!;
    const neighbors = map.regionAdjacency[curr] ?? [];
    for (const next of neighbors) {
      if (activeSet.has(next) && !visited.has(next)) {
        visited.add(next);
        queue.push(next);
      }
    }
  }

  return visited.size === activeSet.size;
}

/**
 * Selects the default contiguous subset of regions for a given player count.
 */
export function selectActiveRegions(
  map: PowerGridMapDefinition,
  requiredCount: number,
  requestedRegions?: readonly string[]
): readonly string[] {
  if (requestedRegions && requestedRegions.length > 0) {
    if (!areRegionsContiguous(map, requestedRegions)) {
      throw new Error(
        `Selected map regions (${requestedRegions.join(', ')}) are not contiguous on map ${map.id}.`
      );
    }
    return [...requestedRegions];
  }
  return map.regions.slice(0, requiredCount);
}

/**
 * Creates the initial `cityBoard` map containing only cities within the active regions.
 */
export function createInitialCityBoard(
  mapId: 'USA' | 'GERMANY',
  activeRegions: readonly string[]
): Record<string, CityOccupancyState> {
  const map = POWER_GRID_MAPS[mapId];
  const activeSet = new Set(activeRegions);
  const board: Record<string, CityOccupancyState> = {};

  for (const city of map.cities) {
    if (activeSet.has(city.regionId)) {
      board[city.id] = {
        cityId: city.id,
        regionId: city.regionId,
        owners: [],
      };
    }
  }

  return board;
}

/**
 * Returns the maximum number of connection slots open in each city for the given Step:
 * - STEP_1: 1 slot ($10)
 * - STEP_2: 2 slots ($10, $15)
 * - STEP_3: 3 slots ($10, $15, $20)
 */
export function getMaxCitySlotsForStep(step: PowerGridStep): number {
  switch (step) {
    case 'STEP_1':
      return 1;
    case 'STEP_2':
      return 2;
    case 'STEP_3':
      return 3;
  }
}

/**
 * Returns the slot fee ($10, $15, or $20) for a player to build in `city`,
 * or throws/returns null if the city is full for the current step or already owned by `playerId`.
 */
export function getCitySlotFee(
  city: CityOccupancyState,
  step: PowerGridStep,
  playerId: string
): {
  readonly allowed: boolean;
  readonly slotCost: number;
  readonly reason?: string;
} {
  if (city.owners.includes(playerId)) {
    return {
      allowed: false,
      slotCost: 0,
      reason: `Player ${playerId} already owns a connection slot in ${city.cityId}.`,
    };
  }

  const maxSlots = getMaxCitySlotsForStep(step);
  const occupiedCount = city.owners.length;
  if (occupiedCount >= maxSlots) {
    return {
      allowed: false,
      slotCost: 0,
      reason: `City ${city.cityId} has no open slots in ${step} (${occupiedCount}/${maxSlots} occupied).`,
    };
  }

  const slotCost = CITY_SLOT_COSTS[occupiedCount]!;
  return {
    allowed: true,
    slotCost,
  };
}

/**
 * Computes the shortest cumulative pipe connection cost from a player's existing network
 * (`ownedCities`) to `targetCityId` using Dijkstra's algorithm across active-region cities.
 *
 * - If `ownedCities` is empty (the player's first city on the board), returns `0`.
 * - Intermediate cities may be traversed regardless of whether their building slots are occupied,
 *   provided those cities belong to the active map regions (`cityBoard`).
 * - Returns `null` if no path exists.
 */
export function calculateShortestPipeCost(
  mapId: 'USA' | 'GERMANY',
  cityBoard: Readonly<Record<string, CityOccupancyState>>,
  ownedCities: readonly string[],
  targetCityId: string
): {
  readonly pipeCost: number;
  readonly path: readonly string[];
} | null {
  if (!cityBoard[targetCityId]) {
    return null;
  }

  if (ownedCities.length === 0) {
    return {
      pipeCost: 0,
      path: [targetCityId],
    };
  }

  const map = POWER_GRID_MAPS[mapId];

  // Build adjacency list restricted to active cities in `cityBoard`
  const adj: Record<string, Array<{ to: string; cost: number }>> = {};
  for (const cid of Object.keys(cityBoard)) {
    adj[cid] = [];
  }

  for (const edge of map.connections) {
    if (cityBoard[edge.from] && cityBoard[edge.to]) {
      adj[edge.from]!.push({ to: edge.to, cost: edge.cost });
      adj[edge.to]!.push({ to: edge.from, cost: edge.cost });
    }
  }

  // Multi-source Dijkstra initialized with all cities currently owned by the player at distance 0
  const dist: Record<string, number> = {};
  const prev: Record<string, string | null> = {};
  const visited = new Set<string>();

  for (const cid of Object.keys(cityBoard)) {
    dist[cid] = Infinity;
    prev[cid] = null;
  }

  for (const sourceCity of ownedCities) {
    if (cityBoard[sourceCity]) {
      dist[sourceCity] = 0;
    }
  }

  while (true) {
    let bestNode: string | null = null;
    let bestDist = Infinity;

    for (const [cid, d] of Object.entries(dist)) {
      if (!visited.has(cid) && d < bestDist) {
        bestDist = d;
        bestNode = cid;
      }
    }

    if (bestNode === null || bestDist === Infinity) {
      break;
    }

    if (bestNode === targetCityId) {
      break;
    }

    visited.add(bestNode);

    for (const neighbor of adj[bestNode] ?? []) {
      if (visited.has(neighbor.to)) continue;
      const alt = bestDist + neighbor.cost;
      if (alt < (dist[neighbor.to] ?? Infinity)) {
        dist[neighbor.to] = alt;
        prev[neighbor.to] = bestNode;
      }
    }
  }

  const finalPipeCost = dist[targetCityId] ?? Infinity;
  if (finalPipeCost === Infinity) {
    return null;
  }

  // Reconstruct shortest path from the closest owned city to `targetCityId`
  const path: string[] = [];
  let curr: string | null = targetCityId;
  while (curr !== null) {
    path.unshift(curr);
    curr = prev[curr] ?? null;
  }

  return {
    pipeCost: finalPipeCost,
    path,
  };
}

/**
 * Calculates the combined build cost (Slot Cost + Shortest Pipe Connection Cost)
 * for `playerId` to connect `targetCityId`.
 */
export function calculateCityBuildCost(
  mapId: 'USA' | 'GERMANY',
  cityBoard: Readonly<Record<string, CityOccupancyState>>,
  step: PowerGridStep,
  playerId: string,
  ownedCities: readonly string[],
  targetCityId: string
): {
  readonly valid: boolean;
  readonly reason?: string;
  readonly slotCost: number;
  readonly pipeCost: number;
  readonly totalCost: number;
  readonly path: readonly string[];
} {
  const city = cityBoard[targetCityId];
  if (!city) {
    return {
      valid: false,
      reason: `City ${targetCityId} is not in an active region on the board.`,
      slotCost: 0,
      pipeCost: 0,
      totalCost: 0,
      path: [],
    };
  }

  const slotCheck = getCitySlotFee(city, step, playerId);
  if (!slotCheck.allowed) {
    return {
      valid: false,
      reason: slotCheck.reason ?? 'City slot unavailable.',
      slotCost: 0,
      pipeCost: 0,
      totalCost: 0,
      path: [],
    };
  }

  const pipeRes = calculateShortestPipeCost(
    mapId,
    cityBoard,
    ownedCities,
    targetCityId
  );
  if (!pipeRes) {
    return {
      valid: false,
      reason: `No valid connection path from ${playerId}'s network to ${targetCityId}.`,
      slotCost: 0,
      pipeCost: 0,
      totalCost: 0,
      path: [],
    };
  }

  return {
    valid: true,
    slotCost: slotCheck.slotCost,
    pipeCost: pipeRes.pipeCost,
    totalCost: slotCheck.slotCost + pipeRes.pipeCost,
    path: pipeRes.path,
  };
}

