import {
  ClueGridCoord,
  CluePawnPosition,
  ClueRoom,
  ClueSuspect,
} from './types.js';

export const CLUE_BOARD_WIDTH = 24;
export const CLUE_BOARD_HEIGHT = 25;

export interface ClueDoorConnection {
  readonly roomTile: ClueGridCoord;
  readonly hallwayTile: ClueGridCoord;
}

export interface ClueRoomDefinition {
  readonly room: ClueRoom;
  readonly xMin: number;
  readonly xMax: number;
  readonly yMin: number;
  readonly yMax: number;
  readonly excludedCoords: readonly ClueGridCoord[];
  readonly doors: readonly ClueDoorConnection[];
  readonly secretPassageTo: ClueRoom | null;
  readonly backgroundStyle: string;
  readonly labelBoxColor: string;
  readonly labelTextColor: string;
  readonly borderColor: string;
}

export interface ClueStartSquareDefinition {
  readonly suspect: ClueSuspect;
  readonly shortLabel: string;
  readonly tiles: readonly [ClueGridCoord, ClueGridCoord];
  readonly exitHallway: ClueGridCoord;
  readonly squareBgHex: string;
  readonly pawnHex: string;
  readonly pawnBorderHex: string;
  readonly textHex: string;
}

export const CLUE_START_SQUARES: Readonly<
  Record<ClueSuspect, ClueStartSquareDefinition>
> = {
  'Professor Plum': {
    suspect: 'Professor Plum',
    shortLabel: 'Prof. Plum',
    tiles: [
      { x: 1, y: 5 },
      { x: 1, y: 6 },
    ],
    exitHallway: { x: 2, y: 6 },
    squareBgHex: '#6B21A8',
    pawnHex: '#C084FC',
    pawnBorderHex: '#F3E8FF',
    textHex: '#F3E8FF',
  },
  'Mrs. Peacock': {
    suspect: 'Mrs. Peacock',
    shortLabel: 'Mrs. Peacock',
    tiles: [
      { x: 1, y: 18 },
      { x: 1, y: 19 },
    ],
    exitHallway: { x: 2, y: 19 },
    squareBgHex: '#0369A1',
    pawnHex: '#7DD3FC',
    pawnBorderHex: '#E0F2FE',
    textHex: '#E0F2FE',
  },
  'Mr. Green': {
    suspect: 'Mr. Green',
    shortLabel: 'Mr. Green',
    tiles: [
      { x: 9, y: 25 },
      { x: 10, y: 25 },
    ],
    exitHallway: { x: 10, y: 24 },
    squareBgHex: '#15803D',
    pawnHex: '#4ADE80',
    pawnBorderHex: '#DCFCE7',
    textHex: '#DCFCE7',
  },
  'Mrs. White': {
    suspect: 'Mrs. White',
    shortLabel: 'Mrs. White',
    tiles: [
      { x: 15, y: 25 },
      { x: 16, y: 25 },
    ],
    exitHallway: { x: 15, y: 24 },
    squareBgHex: '#CBD5E1',
    pawnHex: '#FFFFFF',
    pawnBorderHex: '#475569',
    textHex: '#0F172A',
  },
  'Colonel Mustard': {
    suspect: 'Colonel Mustard',
    shortLabel: 'Col. Mustard',
    tiles: [
      { x: 24, y: 7 },
      { x: 24, y: 8 },
    ],
    exitHallway: { x: 23, y: 8 },
    squareBgHex: '#CA8A04',
    pawnHex: '#FDE047',
    pawnBorderHex: '#FEF9C3',
    textHex: '#FEF9C3',
  },
  'Miss Scarlet': {
    suspect: 'Miss Scarlet',
    shortLabel: 'Miss Scarlet',
    tiles: [
      { x: 16, y: 1 },
      { x: 17, y: 1 },
    ],
    exitHallway: { x: 17, y: 2 },
    squareBgHex: '#991B1B',
    pawnHex: '#F87171',
    pawnBorderHex: '#FEE2E2',
    textHex: '#FEE2E2',
  },
};

export const CLUE_CENTER_SPACE = {
  xMin: 10,
  xMax: 14,
  yMin: 9,
  yMax: 15,
} as const;

export const CLUE_ROOM_DEFINITIONS: Readonly<
  Record<ClueRoom, ClueRoomDefinition>
> = {
  Study: {
    room: 'Study',
    xMin: 1,
    xMax: 7,
    yMin: 1,
    yMax: 4,
    excludedCoords: [],
    doors: [{ roomTile: { x: 7, y: 4 }, hallwayTile: { x: 7, y: 5 } }],
    secretPassageTo: 'Kitchen',
    backgroundStyle:
      'repeating-linear-gradient(90deg, #854d0e 0px, #a16207 10px, #713f12 20px)',
    labelBoxColor: '#713f12',
    labelTextColor: '#fef08a',
    borderColor: '#facc15',
  },
  Hall: {
    room: 'Hall',
    xMin: 10,
    xMax: 15,
    yMin: 1,
    yMax: 7,
    excludedCoords: [],
    doors: [
      { roomTile: { x: 10, y: 5 }, hallwayTile: { x: 9, y: 5 } },
      { roomTile: { x: 13, y: 7 }, hallwayTile: { x: 13, y: 8 } },
    ],
    secretPassageTo: null,
    backgroundStyle:
      'radial-gradient(circle at 8px 8px, #991b1b 2px, #7f1d1d 3px, #450a0a 10px)',
    labelBoxColor: '#7f1d1d',
    labelTextColor: '#fecaca',
    borderColor: '#f87171',
  },
  Lounge: {
    room: 'Lounge',
    xMin: 18,
    xMax: 24,
    yMin: 1,
    yMax: 6,
    excludedCoords: [{ x: 18, y: 1 }],
    doors: [{ roomTile: { x: 18, y: 6 }, hallwayTile: { x: 18, y: 7 } }],
    secretPassageTo: 'Conservatory',
    backgroundStyle:
      'repeating-linear-gradient(45deg, #be185d 0px, #be185d 8px, #9d174d 8px, #9d174d 16px)',
    labelBoxColor: '#831843',
    labelTextColor: '#fbcfe8',
    borderColor: '#f472b6',
  },
  Library: {
    room: 'Library',
    xMin: 1,
    xMax: 7,
    yMin: 7,
    yMax: 11,
    excludedCoords: [
      { x: 1, y: 7 },
      { x: 7, y: 7 },
      { x: 1, y: 11 },
      { x: 7, y: 11 },
    ],
    doors: [
      { roomTile: { x: 7, y: 9 }, hallwayTile: { x: 8, y: 9 } },
      { roomTile: { x: 4, y: 11 }, hallwayTile: { x: 4, y: 12 } },
    ],
    secretPassageTo: null,
    backgroundStyle:
      'radial-gradient(ellipse at center, #7c2d12 0%, #5c1f0b 65%, #431407 100%)',
    labelBoxColor: '#5c1f0b',
    labelTextColor: '#fed7aa',
    borderColor: '#fb923c',
  },
  'Dining Room': {
    room: 'Dining Room',
    xMin: 17,
    xMax: 24,
    yMin: 10,
    yMax: 16,
    excludedCoords: [
      { x: 17, y: 13 }, // Hallway outside the (X18,Y13) door
      { x: 17, y: 16 },
      { x: 18, y: 16 },
      { x: 19, y: 16 },
    ],
    doors: [
      { roomTile: { x: 18, y: 10 }, hallwayTile: { x: 18, y: 9 } },
      { roomTile: { x: 18, y: 13 }, hallwayTile: { x: 17, y: 13 } },
    ],
    secretPassageTo: null,
    backgroundStyle:
      'radial-gradient(circle at 12px 12px, rgba(248, 250, 252, 0.35) 3px, #38bdf8 4px, #0284c7 12px)',
    labelBoxColor: '#0369a1',
    labelTextColor: '#f0f9ff',
    borderColor: '#7dd3fc',
  },
  'Billiard Room': {
    room: 'Billiard Room',
    xMin: 1,
    xMax: 6,
    yMin: 13,
    yMax: 17,
    excludedCoords: [],
    doors: [
      { roomTile: { x: 2, y: 13 }, hallwayTile: { x: 2, y: 12 } },
      { roomTile: { x: 6, y: 16 }, hallwayTile: { x: 7, y: 16 } },
    ],
    secretPassageTo: null,
    backgroundStyle:
      'radial-gradient(circle at center, #15803d 0%, #166534 70%, #14532d 100%)',
    labelBoxColor: '#14532d',
    labelTextColor: '#bbf7d0',
    borderColor: '#4ade80',
  },
  Conservatory: {
    room: 'Conservatory',
    xMin: 1,
    xMax: 6,
    yMin: 20,
    yMax: 24,
    excludedCoords: [
      { x: 1, y: 20 },
      { x: 6, y: 20 },
    ],
    doors: [{ roomTile: { x: 5, y: 20 }, hallwayTile: { x: 6, y: 20 } }],
    secretPassageTo: 'Lounge',
    backgroundStyle:
      'repeating-radial-gradient(circle at 10px 10px, #1e3a8a 0px, #1e3a8a 5px, #172554 5px, #172554 11px)',
    labelBoxColor: '#1e3a8a',
    labelTextColor: '#bfdbfe',
    borderColor: '#60a5fa',
  },
  Ballroom: {
    room: 'Ballroom',
    xMin: 9,
    xMax: 16,
    yMin: 18,
    yMax: 24,
    excludedCoords: [
      { x: 9, y: 24 },
      { x: 10, y: 24 },
      { x: 15, y: 24 },
      { x: 16, y: 24 },
    ],
    doors: [
      { roomTile: { x: 9, y: 20 }, hallwayTile: { x: 8, y: 20 } },
      { roomTile: { x: 10, y: 18 }, hallwayTile: { x: 10, y: 17 } },
      { roomTile: { x: 15, y: 18 }, hallwayTile: { x: 15, y: 17 } },
      { roomTile: { x: 16, y: 20 }, hallwayTile: { x: 17, y: 20 } },
    ],
    secretPassageTo: null,
    backgroundStyle:
      'repeating-linear-gradient(135deg, #78350f 0px, #78350f 7px, #92400e 7px, #92400e 14px)',
    labelBoxColor: '#78350f',
    labelTextColor: '#fde68a',
    borderColor: '#fbbf24',
  },
  Kitchen: {
    room: 'Kitchen',
    xMin: 19,
    xMax: 24,
    yMin: 19,
    yMax: 24,
    excludedCoords: [],
    doors: [{ roomTile: { x: 20, y: 19 }, hallwayTile: { x: 20, y: 18 } }],
    secretPassageTo: 'Study',
    backgroundStyle:
      'radial-gradient(circle at 7px 7px, #f43f5e 2px, transparent 2.5px), radial-gradient(circle at 15px 14px, #10b981 2px, #f8fafc 3px)',
    labelBoxColor: '#e2e8f0',
    labelTextColor: '#0f172a',
    borderColor: '#94a3b8',
  },
};

export function coordKey(x: number, y: number): string {
  return `${x},${y}`;
}

const BORDER_SQUARE_KEYS: ReadonlySet<string> = (() => {
  const keys = new Set<string>();
  // Y1 - X9, X18
  keys.add(coordKey(9, 1));
  keys.add(coordKey(18, 1));
  // Y25 - X1..X8, X11..X14, X17..X24
  for (let x = 1; x <= 8; x++) keys.add(coordKey(x, 25));
  for (let x = 11; x <= 14; x++) keys.add(coordKey(x, 25));
  for (let x = 17; x <= 24; x++) keys.add(coordKey(x, 25));
  // X1 - Y7, Y11, Y12, Y20
  keys.add(coordKey(1, 7));
  keys.add(coordKey(1, 11));
  keys.add(coordKey(1, 12));
  keys.add(coordKey(1, 20));
  // X24 - Y9, Y17
  keys.add(coordKey(24, 9));
  keys.add(coordKey(24, 17));
  return keys;
})();

export type ClueTileClassification =
  | { readonly kind: 'ROOM'; readonly room: ClueRoom; readonly isDoor: boolean }
  | { readonly kind: 'CLUE_SPACE' }
  | { readonly kind: 'START_SQUARE'; readonly suspect: ClueSuspect }
  | { readonly kind: 'BORDER' }
  | { readonly kind: 'HALLWAY' };

export function classifyBoardTile(
  x: number,
  y: number
): ClueTileClassification {
  const key = coordKey(x, y);

  // 1. Check Starting Squares
  for (const def of Object.values(CLUE_START_SQUARES)) {
    if (def.tiles.some((t) => t.x === x && t.y === y)) {
      return { kind: 'START_SQUARE', suspect: def.suspect };
    }
  }

  // 2. Check Border Squares
  if (BORDER_SQUARE_KEYS.has(key)) {
    return { kind: 'BORDER' };
  }

  // 3. Check Center Clue Space (X10..X14, Y9..Y15)
  if (
    x >= CLUE_CENTER_SPACE.xMin &&
    x <= CLUE_CENTER_SPACE.xMax &&
    y >= CLUE_CENTER_SPACE.yMin &&
    y <= CLUE_CENTER_SPACE.yMax
  ) {
    return { kind: 'CLUE_SPACE' };
  }

  // 4. Check Rooms
  for (const def of Object.values(CLUE_ROOM_DEFINITIONS)) {
    if (x >= def.xMin && x <= def.xMax && y >= def.yMin && y <= def.yMax) {
      const isExcluded = def.excludedCoords.some((c) => c.x === x && c.y === y);
      if (!isExcluded) {
        const isDoor = def.doors.some(
          (d) => d.roomTile.x === x && d.roomTile.y === y
        );
        return { kind: 'ROOM', room: def.room, isDoor };
      }
    }
  }

  // 5. All remaining tiles are Hallway spaces
  return { kind: 'HALLWAY' };
}

export function isHallwayTile(x: number, y: number): boolean {
  if (x < 1 || x > CLUE_BOARD_WIDTH || y < 1 || y > CLUE_BOARD_HEIGHT) {
    return false;
  }
  return classifyBoardTile(x, y).kind === 'HALLWAY';
}

export interface ClueReachableTargets {
  readonly hallways: ReadonlyMap<string, number>; // coordKey(x,y) -> min steps (1..maxSteps)
  readonly rooms: ReadonlyMap<ClueRoom, number>; // room -> min steps to enter (1..maxSteps)
}

/**
 * Computes all reachable hallway squares and rooms within `maxSteps` orthogonal steps
 * starting from `startPos` (which can be a START square, a ROOM, or a HALLWAY tile).
 *
 * Rules:
 * - Starting squares cannot be re-entered.
 * - Leaving a START square steps onto `exitHallway` (cost 1).
 * - Leaving a ROOM steps out of any of its doors onto that door's `hallwayTile` (cost 1).
 * - Moving between adjacent HALLWAY tiles is orthogonal (up/down/left/right, cost 1).
 * - Stepping from a door's `hallwayTile` into its `roomTile` enters that ROOM (cost 1) and stops further movement along that branch.
 */
export function getReachableClueTargets(
  startPos: CluePawnPosition,
  maxSteps: number,
  occupiedHallwayKeys: ReadonlySet<string> = new Set()
): ClueReachableTargets {
  const hallways = new Map<string, number>();
  const rooms = new Map<ClueRoom, number>();

  if (maxSteps <= 0) {
    return { hallways, rooms };
  }

  // BFS queue over hallway coordinates: [x, y, dist]
  const queue: Array<[number, number, number]> = [];
  const visitedDist = new Map<string, number>();

  const enqueueHallway = (hx: number, hy: number, dist: number) => {
    if (dist > maxSteps || !isHallwayTile(hx, hy)) return;
    const key = coordKey(hx, hy);
    // Occupied hallway tiles block landing (and passing through in standard Clue, unless we allow passing)
    if (occupiedHallwayKeys.has(key)) return;
    const prev = visitedDist.get(key);
    if (prev !== undefined && prev <= dist) return;
    visitedDist.set(key, dist);
    hallways.set(key, dist);
    queue.push([hx, hy, dist]);
  };

  if (startPos.kind === 'START') {
    const def = CLUE_START_SQUARES[startPos.suspect];
    enqueueHallway(def.exitHallway.x, def.exitHallway.y, 1);
  } else if (startPos.kind === 'ROOM') {
    const roomDef = CLUE_ROOM_DEFINITIONS[startPos.room];
    for (const door of roomDef.doors) {
      enqueueHallway(door.hallwayTile.x, door.hallwayTile.y, 1);
    }
  } else {
    // Starting in a hallway tile
    const startKey = coordKey(startPos.x, startPos.y);
    visitedDist.set(startKey, 0);
    queue.push([startPos.x, startPos.y, 0]);
  }

  while (queue.length > 0) {
    const [cx, cy, dist] = queue.shift()!;

    // Check if (cx, cy) is the hallwayTile of any room door -> can enter that room in `dist + 1` steps!
    if (dist + 1 <= maxSteps) {
      for (const roomDef of Object.values(CLUE_ROOM_DEFINITIONS)) {
        // Cannot re-enter the exact same room we started this turn in on the same roll
        if (startPos.kind === 'ROOM' && startPos.room === roomDef.room) {
          continue;
        }
        const matchesDoor = roomDef.doors.some(
          (d) =>
            (d.hallwayTile.x === cx && d.hallwayTile.y === cy) ||
            // Also support stepping into Dining Room (X18,Y13) from (X16,Y13) if player is right outside
            (roomDef.room === 'Dining Room' && cx === 16 && cy === 13)
        );
        if (matchesDoor) {
          const prevRoomDist = rooms.get(roomDef.room);
          if (prevRoomDist === undefined || dist + 1 < prevRoomDist) {
            rooms.set(roomDef.room, dist + 1);
          }
        }
      }
    }

    if (dist >= maxSteps) continue;

    // Orthogonal neighbors in hallway
    const neighbors: Array<[number, number]> = [
      [cx + 1, cy],
      [cx - 1, cy],
      [cx, cy + 1],
      [cx, cy - 1],
    ];
    for (const [nx, ny] of neighbors) {
      enqueueHallway(nx, ny, dist + 1);
    }
  }

  return { hallways, rooms };
}
