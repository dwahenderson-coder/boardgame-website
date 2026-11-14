/**
 * Deterministic, Seed-Based Random Board Generator for 3–4 Player Catan.
 * Pure, UI-agnostic module outputting a planar graph layered over a
 * pointy-top hexagonal axial coordinate system (q, r).
 */

export type TerrainType =
  | 'wood'
  | 'brick'
  | 'sheep'
  | 'wheat'
  | 'ore'
  | 'desert';

export type HarborType =
  | '3:1'
  | '2:1:wood'
  | '2:1:brick'
  | '2:1:sheep'
  | '2:1:wheat'
  | '2:1:ore';

export type TokenLetter =
  | 'A'
  | 'B'
  | 'C'
  | 'D'
  | 'E'
  | 'F'
  | 'G'
  | 'H'
  | 'I'
  | 'J'
  | 'K'
  | 'L'
  | 'M'
  | 'N'
  | 'O'
  | 'P'
  | 'Q'
  | 'R';

export interface HexNode {
  id: string; // "q,r"
  q: number;
  r: number;
  terrain: TerrainType;
  numberToken: number | null; // 2..12 | null
  tokenLetter: TokenLetter | null; // 'A'..'R' | null
  hasRobber: boolean;
  vertexIds: string[]; // 6 clockwise IDs
  edgeIds: string[]; // 6 clockwise IDs
}

export interface VertexNode {
  id: string;
  building: 'settlement' | 'city' | null;
  ownerId: string | null;
  harbor: HarborType | null;
  adjacentVertexIds: string[]; // 2–3 connected vertices
  connectedEdgeIds: string[]; // 2–3 connected edges
  touchingHexIds: string[]; // 1–3 hexes
  x: number;
  y: number;
}

export interface EdgeNode {
  id: string;
  ownerId: string | null;
  endpointVertexIds: [string, string];
  connectedEdgeIds: string[]; // up to 4 adjacent edges
  isCoastal: boolean;
  x: number;
  y: number;
}

export interface CatanBoard {
  seed: string;
  hexes: Record<string, HexNode>;
  vertices: Record<string, VertexNode>;
  edges: Record<string, EdgeNode>;
  robberHexId: string;
}

// ============================================================================
// 1. Deterministic Seeded PRNG (FNV-1a + Mulberry32) & Fisher-Yates Shuffle
// ============================================================================

let fallbackSeedCounter = 1;

/**
 * Hashes an arbitrary seed string into an unsigned 32-bit integer using FNV-1a.
 */
export function hashSeedFNV1a(seed: string): number {
  let hash = 0x811c9dc5; // 2166136261
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193); // 16777619
  }
  return hash >>> 0;
}

/**
 * Creates a deterministic Mulberry32 PRNG returning floats in [0, 1) from a string seed.
 * Never uses Math.random().
 */
export function createSeededRng(seed: string): () => number {
  let state = hashSeedFNV1a(seed);
  if (state === 0) {
    state = 0x6d2b79f5;
  }
  return (): number => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Deterministic Fisher-Yates shuffle using the provided seeded RNG.
 */
export function shuffleWithRng<T>(
  array: readonly T[],
  rng: () => number
): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = result[i]!;
    result[i] = result[j]!;
    result[j] = tmp;
  }
  return result;
}

/**
 * Generates a deterministic 6-character alphanumeric seed when no seed is passed,
 * without calling Math.random().
 */
function generateDefaultSeed(): string {
  const alphabet = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const rng = createSeededRng(`CATAN_DEFAULT_${fallbackSeedCounter++}`);
  let out = '';
  for (let i = 0; i < 6; i++) {
    const idx = Math.floor(rng() * alphabet.length);
    out += alphabet[idx]!;
  }
  return out;
}

// ============================================================================
// 2. Constants for Standard 19-Hex Catan Board
// ============================================================================

export const STANDARD_19_TERRAINS: readonly TerrainType[] = [
  'wood',
  'wood',
  'wood',
  'wood',
  'sheep',
  'sheep',
  'sheep',
  'sheep',
  'wheat',
  'wheat',
  'wheat',
  'wheat',
  'brick',
  'brick',
  'brick',
  'ore',
  'ore',
  'ore',
  'desert',
] as const;

export const SPIRAL_TOKEN_NUMBERS: readonly number[] = [
  5, 2, 6, 3, 8, 10, 9, 12, 11, 4, 8, 10, 9, 4, 5, 6, 3, 11,
] as const;

export const SPIRAL_TOKEN_LETTERS: readonly TokenLetter[] = [
  'A',
  'B',
  'C',
  'D',
  'E',
  'F',
  'G',
  'H',
  'I',
  'J',
  'K',
  'L',
  'M',
  'N',
  'O',
  'P',
  'Q',
  'R',
] as const;

export const STANDARD_9_HARBORS: readonly HarborType[] = [
  '3:1',
  '3:1',
  '3:1',
  '3:1',
  '2:1:wood',
  '2:1:brick',
  '2:1:sheep',
  '2:1:wheat',
  '2:1:ore',
] as const;

/**
 * The 6 outer corner hexes of the radius-2 ring:
 * [(0, -2), (2, -2), (2, 0), (0, 2), (-2, 2), (-2, 0)]
 */
export const OUTER_CORNER_COORDS: ReadonlyArray<readonly [number, number]> = [
  [0, -2],
  [2, -2],
  [2, 0],
  [0, 2],
  [-2, 2],
  [-2, 0],
] as const;

/**
 * The 12 outer-ring (radius 2) hexes in counterclockwise order starting from (0, -2).
 * Notice that the 6 outer corners sit at even indices 0, 2, 4, 6, 8, 10:
 *   index 0:  (0, -2)
 *   index 2:  (-2, 0)
 *   index 4:  (-2, 2)
 *   index 6:  (0, 2)
 *   index 8:  (2, 0)
 *   index 10: (2, -2)
 */
const OUTER_RING_CCW: ReadonlyArray<readonly [number, number]> = [
  [0, -2],
  [-1, -1],
  [-2, 0],
  [-2, 1],
  [-2, 2],
  [-1, 2],
  [0, 2],
  [1, 1],
  [2, 0],
  [2, -1],
  [2, -2],
  [1, -2],
] as const;

/**
 * The 6 inner-ring (radius 1) hexes in counterclockwise order aligned with
 * the 6 outer corners in OUTER_RING_CCW (indices 0, 2, 4, 6, 8, 10).
 */
const INNER_RING_CCW: ReadonlyArray<readonly [number, number]> = [
  [0, -1],
  [-1, 0],
  [-1, 1],
  [0, 1],
  [1, 0],
  [1, -1],
] as const;

/**
 * Builds the 19-hex counterclockwise inward spiral order starting from one of
 * the 6 outer corners.
 */
export function buildCounterclockwiseSpiralOrder(
  startCorner: readonly [number, number]
): Array<readonly [number, number]> {
  const outerStartIdx = OUTER_RING_CCW.findIndex(
    ([q, r]) => q === startCorner[0] && r === startCorner[1]
  );
  const effectiveOuterStart = outerStartIdx >= 0 ? outerStartIdx : 0;
  const innerStartIdx = Math.floor(effectiveOuterStart / 2) % 6;

  const spiral: Array<readonly [number, number]> = [];
  // 1. Walk the 12 hexes of the outer ring (radius 2) counterclockwise
  for (let i = 0; i < 12; i++) {
    spiral.push(OUTER_RING_CCW[(effectiveOuterStart + i) % 12]!);
  }
  // 2. Step inward onto the adjacent inner-ring hex (radius 1) and walk counterclockwise
  for (let i = 0; i < 6; i++) {
    spiral.push(INNER_RING_CCW[(innerStartIdx + i) % 6]!);
  }
  // 3. Finish at the center hex (0, 0)
  spiral.push([0, 0]);
  return spiral;
}

// ============================================================================
// 3. Main Board Generator (`generateCatanBoard`)
// ============================================================================

export function generateCatanBoard(seed?: string): CatanBoard {
  const resolvedSeed =
    seed !== undefined && seed.trim().length > 0
      ? seed.trim()
      : generateDefaultSeed();
  const rng = createSeededRng(resolvedSeed);

  // Step 1: Generate the 19-Hex Grid: max(|q|, |r|, |q + r|) <= 2
  const axialCoords: Array<readonly [number, number]> = [];
  for (let r = -2; r <= 2; r++) {
    for (let q = -2; q <= 2; q++) {
      if (Math.max(Math.abs(q), Math.abs(r), Math.abs(q + r)) <= 2) {
        axialCoords.push([q, r]);
      }
    }
  }

  // Step 2: Assign Terrains & Robber using seeded Fisher-Yates shuffle
  const shuffledTerrains = shuffleWithRng(STANDARD_19_TERRAINS, rng);
  const hexes: Record<string, HexNode> = {};
  let robberHexId = '0,0';

  axialCoords.forEach(([q, r], idx) => {
    const id = `${q},${r}`;
    const terrain = shuffledTerrains[idx]!;
    const hasRobber = terrain === 'desert';
    if (hasRobber) {
      robberHexId = id;
    }
    hexes[id] = {
      id,
      q,
      r,
      terrain,
      numberToken: null,
      tokenLetter: null,
      hasRobber,
      vertexIds: [],
      edgeIds: [],
    };
  });

  // Step 3: Standard Spiral Number Token Placement (A–R)
  const chosenCornerIdx = Math.floor(rng() * OUTER_CORNER_COORDS.length);
  const chosenCorner = OUTER_CORNER_COORDS[chosenCornerIdx]!;
  const spiralCoords = buildCounterclockwiseSpiralOrder(chosenCorner);

  let tokenCursor = 0;
  for (const [q, r] of spiralCoords) {
    const hexId = `${q},${r}`;
    const hex = hexes[hexId]!;
    if (hex.terrain === 'desert') {
      hex.numberToken = null;
      hex.tokenLetter = null;
    } else {
      hex.numberToken = SPIRAL_TOKEN_NUMBERS[tokenCursor]!;
      hex.tokenLetter = SPIRAL_TOKEN_LETTERS[tokenCursor]!;
      tokenCursor++;
    }
  }

  // Step 4: Deduplicate Vertices (54) & Edges (72)
  const vertices: Record<string, VertexNode> = {};
  const edges: Record<string, EdgeNode> = {};
  const edgeHexCounts: Record<string, number> = {};

  const sqrt3 = Math.sqrt(3);

  for (const [q, r] of axialCoords) {
    const hexId = `${q},${r}`;
    const hex = hexes[hexId]!;
    // Pointy-top hex center for size = 1
    const cx = sqrt3 * (q + r / 2);
    const cy = 1.5 * r;

    const hexVertexIds: string[] = [];
    // 6 pointy-top corners in clockwise order (starting from top corner at -90 deg)
    for (let i = 0; i < 6; i++) {
      const angleRad = ((-90 + i * 60) * Math.PI) / 180;
      const vx = Number((cx + Math.cos(angleRad)).toFixed(4));
      const vy = Number((cy + Math.sin(angleRad)).toFixed(4));
      const vertexKey = `${vx.toFixed(4)},${vy.toFixed(4)}`;

      let vertex = vertices[vertexKey];
      if (!vertex) {
        vertex = {
          id: vertexKey,
          building: null,
          ownerId: null,
          harbor: null,
          adjacentVertexIds: [],
          connectedEdgeIds: [],
          touchingHexIds: [],
          x: vx,
          y: vy,
        };
        vertices[vertexKey] = vertex;
      }
      if (!vertex.touchingHexIds.includes(hexId)) {
        vertex.touchingHexIds.push(hexId);
      }
      hexVertexIds.push(vertexKey);
    }

    hex.vertexIds = hexVertexIds;

    // Connect consecutive corners around each hex (6 clockwise edges)
    const hexEdgeIds: string[] = [];
    for (let i = 0; i < 6; i++) {
      const v1 = hexVertexIds[i]!;
      const v2 = hexVertexIds[(i + 1) % 6]!;
      const [minV, maxV] = v1 < v2 ? [v1, v2] : [v2, v1];
      const edgeKey = `${minV}~${maxV}`;

      let edge = edges[edgeKey];
      if (!edge) {
        const vert1 = vertices[minV]!;
        const vert2 = vertices[maxV]!;
        edge = {
          id: edgeKey,
          ownerId: null,
          endpointVertexIds: [minV, maxV],
          connectedEdgeIds: [],
          isCoastal: false,
          x: Number(((vert1.x + vert2.x) / 2).toFixed(4)),
          y: Number(((vert1.y + vert2.y) / 2).toFixed(4)),
        };
        edges[edgeKey] = edge;
      }

      edgeHexCounts[edgeKey] = (edgeHexCounts[edgeKey] ?? 0) + 1;
      hexEdgeIds.push(edgeKey);

      // Populate vertex <-> vertex and vertex <-> edge adjacency
      const vertA = vertices[v1]!;
      const vertB = vertices[v2]!;
      if (!vertA.adjacentVertexIds.includes(v2)) {
        vertA.adjacentVertexIds.push(v2);
      }
      if (!vertB.adjacentVertexIds.includes(v1)) {
        vertB.adjacentVertexIds.push(v1);
      }
      if (!vertA.connectedEdgeIds.includes(edgeKey)) {
        vertA.connectedEdgeIds.push(edgeKey);
      }
      if (!vertB.connectedEdgeIds.includes(edgeKey)) {
        vertB.connectedEdgeIds.push(edgeKey);
      }
    }

    hex.edgeIds = hexEdgeIds;
  }

  // Populate edge <-> edge adjacency and mark coastal edges (belonging to only 1 hex)
  for (const edge of Object.values(edges)) {
    edge.isCoastal = edgeHexCounts[edge.id] === 1;
    const [v1, v2] = edge.endpointVertexIds;
    const incident = new Set<string>();
    for (const eid of vertices[v1]!.connectedEdgeIds) {
      if (eid !== edge.id) incident.add(eid);
    }
    for (const eid of vertices[v2]!.connectedEdgeIds) {
      if (eid !== edge.id) incident.add(eid);
    }
    edge.connectedEdgeIds = Array.from(incident);
  }

  // Step 5: Place the 9 Coastal Harbors in clockwise perimeter order
  const coastalEdgesOrdered = getClockwiseCoastalEdges(vertices, edges);
  const shuffledHarbors = shuffleWithRng(STANDARD_9_HARBORS, rng);
  // 9 official harbor edge slots around the 30-edge perimeter (alternating gaps of 3 and 4 edges)
  const harborPerimeterSlots = [0, 3, 7, 10, 14, 17, 20, 24, 27];

  harborPerimeterSlots.forEach((slotIdx, harborIdx) => {
    const coastalEdge = coastalEdgesOrdered[slotIdx];
    const harborType = shuffledHarbors[harborIdx];
    if (coastalEdge && harborType) {
      const [v1, v2] = coastalEdge.endpointVertexIds;
      vertices[v1]!.harbor = harborType;
      vertices[v2]!.harbor = harborType;
    }
  });

  return {
    seed: resolvedSeed,
    hexes,
    vertices,
    edges,
    robberHexId,
  };
}

/**
 * Walks the 30 coastal edges in a single continuous clockwise loop around the island perimeter.
 */
function getClockwiseCoastalEdges(
  vertices: Record<string, VertexNode>,
  edges: Record<string, EdgeNode>
): EdgeNode[] {
  const coastalEdges = Object.values(edges).filter((e) => e.isCoastal);
  if (coastalEdges.length === 0) return [];

  // Map each coastal vertex to its incident coastal edges
  const vertexToCoastalEdges = new Map<string, EdgeNode[]>();
  for (const edge of coastalEdges) {
    for (const vid of edge.endpointVertexIds) {
      const list = vertexToCoastalEdges.get(vid) ?? [];
      list.push(edge);
      vertexToCoastalEdges.set(vid, list);
    }
  }

  // Start at the topmost coastal vertex (min y, then min x)
  const coastalVertexIds = Array.from(vertexToCoastalEdges.keys());
  coastalVertexIds.sort((a, b) => {
    const va = vertices[a]!;
    const vb = vertices[b]!;
    if (va.y !== vb.y) return va.y - vb.y;
    return va.x - vb.x;
  });

  const startVertexId = coastalVertexIds[0]!;
  const firstCandidateEdges = vertexToCoastalEdges.get(startVertexId)!;

  // Choose the first edge whose other endpoint goes clockwise (larger x at top of island)
  let currentEdge = firstCandidateEdges[0]!;
  if (firstCandidateEdges.length > 1) {
    const e0 = firstCandidateEdges[0]!;
    const e1 = firstCandidateEdges[1]!;
    const other0 =
      e0.endpointVertexIds[0] === startVertexId
        ? e0.endpointVertexIds[1]
        : e0.endpointVertexIds[0];
    const other1 =
      e1.endpointVertexIds[0] === startVertexId
        ? e1.endpointVertexIds[1]
        : e1.endpointVertexIds[0];
    if (vertices[other1]!.x > vertices[other0]!.x) {
      currentEdge = e1;
    }
  }

  const ordered: EdgeNode[] = [];
  const visitedEdges = new Set<string>();
  let currentVertexId = startVertexId;

  while (ordered.length < coastalEdges.length) {
    ordered.push(currentEdge);
    visitedEdges.add(currentEdge.id);
    const nextVertexId =
      currentEdge.endpointVertexIds[0] === currentVertexId
        ? currentEdge.endpointVertexIds[1]
        : currentEdge.endpointVertexIds[0];
    const nextCandidates = (
      vertexToCoastalEdges.get(nextVertexId) ?? []
    ).filter((e) => !visitedEdges.has(e.id));
    if (nextCandidates.length === 0) break;
    currentEdge = nextCandidates[0]!;
    currentVertexId = nextVertexId;
  }

  return ordered;
}

// ============================================================================
// 4. Placement & Validation Helper Functions
// ============================================================================

/**
 * Returns all VertexNodes where building === null and all adjacentVertexIds
 * have building === null (the Distance Rule: at least 2 segments away).
 */
export function getValidInitialSettlementSpots(
  board: CatanBoard
): VertexNode[] {
  return Object.values(board.vertices).filter((vertex) => {
    if (vertex.building !== null) {
      return false;
    }
    return vertex.adjacentVertexIds.every(
      (adjId) => board.vertices[adjId]?.building === null
    );
  });
}

/**
 * Enforces the Distance Rule PLUS requires at least one connectedEdgeIds owned by playerId.
 */
export function getValidSettlementSpots(
  board: CatanBoard,
  playerId: string
): VertexNode[] {
  return getValidInitialSettlementSpots(board).filter((vertex) =>
    vertex.connectedEdgeIds.some(
      (edgeId) => board.edges[edgeId]?.ownerId === playerId
    )
  );
}

/**
 * Returns all unowned EdgeNodes connected to either a vertex owned by playerId
 * or an edge owned by playerId (not blocked by an opponent's building).
 * If `mustConnectToVertexId` is provided (during initial setup road placement),
 * restricts to unowned edges incident to that vertex.
 */
export function getValidRoadSpots(
  board: CatanBoard,
  playerId: string,
  mustConnectToVertexId?: string
): EdgeNode[] {
  if (mustConnectToVertexId) {
    const targetVertex = board.vertices[mustConnectToVertexId];
    if (!targetVertex) return [];
    return targetVertex.connectedEdgeIds
      .map((eid) => board.edges[eid]!)
      .filter((edge) => edge && edge.ownerId === null);
  }

  return Object.values(board.edges).filter((edge) => {
    if (edge.ownerId !== null) {
      return false;
    }
    return edge.endpointVertexIds.some((vid) => {
      const vertex = board.vertices[vid];
      if (!vertex) return false;
      // Directly connected to player's own settlement/city
      if (vertex.ownerId === playerId) {
        return true;
      }
      // Blocked if an opponent owns a building on this vertex
      if (vertex.ownerId !== null && vertex.ownerId !== playerId) {
        return false;
      }
      // Connected to an existing road owned by playerId through this unblocked vertex
      return vertex.connectedEdgeIds.some(
        (adjEdgeId) =>
          adjEdgeId !== edge.id && board.edges[adjEdgeId]?.ownerId === playerId
      );
    });
  });
}

/**
 * Computes the length of the longest continuous road (simple edge path not passing
 * through an opponent's settlement/city) owned by `playerId`.
 */
export function calculateLongestRoadLength(
  board: CatanBoard,
  playerId: string
): number {
  const playerEdges = Object.values(board.edges).filter(
    (e) => e.ownerId === playerId
  );
  if (playerEdges.length === 0) {
    return 0;
  }

  let maxLen = 0;
  const visitedEdges = new Set<string>();

  function dfs(currentVertexId: string, currentLen: number): void {
    if (currentLen > maxLen) {
      maxLen = currentLen;
    }
    const vertex = board.vertices[currentVertexId];
    if (!vertex) return;

    for (const edgeId of vertex.connectedEdgeIds) {
      if (visitedEdges.has(edgeId)) continue;
      const edge = board.edges[edgeId];
      if (!edge || edge.ownerId !== playerId) continue;

      const nextVertexId =
        edge.endpointVertexIds[0] === currentVertexId
          ? edge.endpointVertexIds[1]
          : edge.endpointVertexIds[0];
      const nextVertex = board.vertices[nextVertexId];

      visitedEdges.add(edgeId);
      // If nextVertex has an opponent's building, the road ends at nextVertex and cannot continue past it
      if (
        nextVertex &&
        nextVertex.ownerId !== null &&
        nextVertex.ownerId !== playerId
      ) {
        if (currentLen + 1 > maxLen) {
          maxLen = currentLen + 1;
        }
      } else {
        dfs(nextVertexId, currentLen + 1);
      }
      visitedEdges.delete(edgeId);
    }
  }

  for (const edge of playerEdges) {
    for (const startVertexId of edge.endpointVertexIds) {
      visitedEdges.clear();
      visitedEdges.add(edge.id);
      const otherVertexId =
        edge.endpointVertexIds[0] === startVertexId
          ? edge.endpointVertexIds[1]
          : edge.endpointVertexIds[0];
      const otherVertex = board.vertices[otherVertexId];
      if (
        otherVertex &&
        otherVertex.ownerId !== null &&
        otherVertex.ownerId !== playerId
      ) {
        if (maxLen < 1) maxLen = 1;
      } else {
        dfs(otherVertexId, 1);
      }
    }
  }

  return maxLen;
}
