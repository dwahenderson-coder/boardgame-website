import { createPRNG, nextInt, PRNGState, shuffleArray } from '../../common/prng.js';
import { ValidationResult } from '../ticket-to-ride/types.js';

export type CatanResource = 'WOOD' | 'BRICK' | 'SHEEP' | 'WHEAT' | 'ORE';

export type CatanTerrain = CatanResource | 'DESERT';

export const ALL_CATAN_RESOURCES: readonly CatanResource[] = [
  'WOOD',
  'BRICK',
  'SHEEP',
  'WHEAT',
  'ORE',
] as const;

export interface CatanHexTile {
  readonly id: string;
  readonly q: number;
  readonly r: number;
  readonly terrain: CatanTerrain;
  readonly numberToken: number | null; // 2..12 (null for DESERT)
  readonly hasRobber: boolean;
}

export interface CatanBuilding {
  readonly id: string;
  readonly hexIds: readonly string[]; // Adjacent hex IDs that produce resources for this settlement/city
  readonly ownerId: string;
  readonly kind: 'SETTLEMENT' | 'CITY';
}

export interface CatanPlayerState {
  readonly id: string;
  readonly resources: Readonly<Record<CatanResource, number>>;
  readonly settlementsRemaining: number;
  readonly citiesRemaining: number;
  readonly roadsBuilt: number;
  readonly victoryPoints: number;
}

export interface CatanSanitizedOpponent {
  readonly id: string;
  readonly totalResourceCards: number;
  readonly settlementsRemaining: number;
  readonly citiesRemaining: number;
  readonly roadsBuilt: number;
  readonly victoryPoints: number;
}

export type CatanPhase = 'PLAYING' | 'GAME_OVER';
export type CatanTurnStep = 'ROLL_DICE' | 'MAIN_PHASE';

export interface CatanGameState {
  readonly gameId: 'catan';
  readonly phase: CatanPhase;
  readonly playerOrder: readonly string[];
  readonly activePlayerIndex: number;
  readonly turnStep: CatanTurnStep;
  readonly turnNumber: number;
  readonly prng: PRNGState;
  readonly lastDiceRoll: readonly [number, number] | null;
  readonly hexes: readonly CatanHexTile[];
  readonly buildings: readonly CatanBuilding[];
  readonly players: Readonly<Record<string, CatanPlayerState>>;
  readonly lastActionSummary: string | null;
}

export interface CatanSanitizedGameState {
  readonly gameId: 'catan';
  readonly phase: CatanPhase;
  readonly playerOrder: readonly string[];
  readonly activePlayerId: string;
  readonly turnStep: CatanTurnStep;
  readonly turnNumber: number;
  readonly lastDiceRoll: readonly [number, number] | null;
  readonly hexes: readonly CatanHexTile[];
  readonly buildings: readonly CatanBuilding[];
  readonly self: CatanPlayerState;
  readonly opponents: Readonly<Record<string, CatanSanitizedOpponent>>;
  readonly lastActionSummary: string | null;
}

// --- Catan Actions ---

export interface CatanRollDiceAction {
  readonly type: 'CATAN_ROLL_DICE';
}

export interface CatanBuildRoadAction {
  readonly type: 'CATAN_BUILD_ROAD';
}

export interface CatanBuildSettlementAction {
  readonly type: 'CATAN_BUILD_SETTLEMENT';
  readonly hexId: string;
}

export interface CatanUpgradeCityAction {
  readonly type: 'CATAN_UPGRADE_CITY';
  readonly buildingId: string;
}

export interface CatanMaritimeTradeAction {
  readonly type: 'CATAN_MARITIME_TRADE';
  readonly give: CatanResource;
  readonly receive: CatanResource;
}

export interface CatanEndTurnAction {
  readonly type: 'CATAN_END_TURN';
}

export type CatanAction =
  | CatanRollDiceAction
  | CatanBuildRoadAction
  | CatanBuildSettlementAction
  | CatanUpgradeCityAction
  | CatanMaritimeTradeAction
  | CatanEndTurnAction;

// --- Standard 19-Hex Axial Coordinates (Radius 2) ---

const AXIAL_COORDS: ReadonlyArray<{ readonly q: number; readonly r: number }> = [
  { q: 0, r: -2 },
  { q: 1, r: -2 },
  { q: 2, r: -2 },
  { q: -1, r: -1 },
  { q: 0, r: -1 },
  { q: 1, r: -1 },
  { q: 2, r: -1 },
  { q: -2, r: 0 },
  { q: -1, r: 0 },
  { q: 0, r: 0 },
  { q: 1, r: 0 },
  { q: 2, r: 0 },
  { q: -2, r: 1 },
  { q: -1, r: 1 },
  { q: 0, r: 1 },
  { q: 1, r: 1 },
  { q: -2, r: 2 },
  { q: -1, r: 2 },
  { q: 0, r: 2 },
];

const STANDARD_TERRAINS: readonly CatanTerrain[] = [
  'WOOD',
  'WOOD',
  'WOOD',
  'WOOD',
  'SHEEP',
  'SHEEP',
  'SHEEP',
  'SHEEP',
  'WHEAT',
  'WHEAT',
  'WHEAT',
  'WHEAT',
  'BRICK',
  'BRICK',
  'BRICK',
  'ORE',
  'ORE',
  'ORE',
  'DESERT',
];

const STANDARD_NUMBER_TOKENS: readonly number[] = [
  5, 2, 6, 3, 8, 10, 9, 12, 11, 4, 8, 10, 9, 4, 5, 6, 3, 11,
];

function createInitialResources(): Record<CatanResource, number> {
  return {
    WOOD: 2,
    BRICK: 2,
    SHEEP: 1,
    WHEAT: 1,
    ORE: 0,
  };
}

function getTotalResourceCards(
  res: Readonly<Record<CatanResource, number>>
): number {
  return res.WOOD + res.BRICK + res.SHEEP + res.WHEAT + res.ORE;
}

export function initCatanGame(
  playerIds: string[],
  seed: number
): CatanGameState {
  if (playerIds.length < 3 || playerIds.length > 4) {
    throw new Error(
      `Catan requires between 3 and 4 players (received ${playerIds.length}).`
    );
  }

  let prng = createPRNG(seed);
  const shuffledTerrains = shuffleArray(STANDARD_TERRAINS, prng);
  prng = shuffledTerrains.prng;

  let tokenIdx = 0;
  const hexes: CatanHexTile[] = AXIAL_COORDS.map((coord, i) => {
    const terrain = shuffledTerrains.value[i]!;
    const isDesert = terrain === 'DESERT';
    const numberToken = isDesert
      ? null
      : (STANDARD_NUMBER_TOKENS[tokenIdx++] ?? 6);
    return {
      id: `HEX_${i + 1}`,
      q: coord.q,
      r: coord.r,
      terrain,
      numberToken,
      hasRobber: isDesert,
    };
  });

  // Assign each player 2 starting settlements on productive non-desert hexes
  const nonDesertHexes = hexes.filter((h) => h.terrain !== 'DESERT');
  const buildings: CatanBuilding[] = [];
  const players: Record<string, CatanPlayerState> = {};

  playerIds.forEach((pid, idx) => {
    const h1 = nonDesertHexes[(idx * 2) % nonDesertHexes.length]!;
    const h2 = nonDesertHexes[(idx * 2 + 1) % nonDesertHexes.length]!;
    const h3 = nonDesertHexes[(idx * 2 + 2) % nonDesertHexes.length]!;

    buildings.push(
      {
        id: `BLD_${pid}_1`,
        hexIds: [h1.id, h2.id],
        ownerId: pid,
        kind: 'SETTLEMENT',
      },
      {
        id: `BLD_${pid}_2`,
        hexIds: [h2.id, h3.id],
        ownerId: pid,
        kind: 'SETTLEMENT',
      }
    );

    players[pid] = {
      id: pid,
      resources: createInitialResources(),
      settlementsRemaining: 3, // 5 total - 2 starting
      citiesRemaining: 4,
      roadsBuilt: 2,
      victoryPoints: 2,
    };
  });

  return {
    gameId: 'catan',
    phase: 'PLAYING',
    playerOrder: [...playerIds],
    activePlayerIndex: 0,
    turnStep: 'ROLL_DICE',
    turnNumber: 1,
    prng,
    lastDiceRoll: null,
    hexes,
    buildings,
    players,
    lastActionSummary:
      'Catan match initialized! Each settler starts with 2 settlements (2 VP). Roll the dice to begin!',
  };
}

export function validateCatanAction(
  state: CatanGameState,
  playerId: string,
  action: CatanAction
): ValidationResult {
  if (state.phase === 'GAME_OVER') {
    return { valid: false, reason: 'The Catan match is already over.' };
  }

  const player = state.players[playerId];
  if (!player) {
    return { valid: false, reason: `Unknown player ID: ${playerId}.` };
  }

  const activePlayerId = state.playerOrder[state.activePlayerIndex];
  if (playerId !== activePlayerId) {
    return {
      valid: false,
      reason: `Out of turn: expected ${activePlayerId}, but ${playerId} attempted to act.`,
    };
  }

  switch (action.type) {
    case 'CATAN_ROLL_DICE':
      if (state.turnStep !== 'ROLL_DICE') {
        return {
          valid: false,
          reason: 'Dice have already been rolled this turn.',
        };
      }
      return { valid: true };

    case 'CATAN_BUILD_ROAD':
      if (state.turnStep !== 'MAIN_PHASE') {
        return {
          valid: false,
          reason: 'You must roll the dice before building.',
        };
      }
      if (player.resources.WOOD < 1 || player.resources.BRICK < 1) {
        return {
          valid: false,
          reason: 'Building a Road requires 1 WOOD + 1 BRICK.',
        };
      }
      return { valid: true };

    case 'CATAN_BUILD_SETTLEMENT': {
      if (state.turnStep !== 'MAIN_PHASE') {
        return {
          valid: false,
          reason: 'You must roll the dice before building.',
        };
      }
      if (player.settlementsRemaining <= 0) {
        return { valid: false, reason: 'No settlements remaining in supply.' };
      }
      if (
        player.resources.WOOD < 1 ||
        player.resources.BRICK < 1 ||
        player.resources.SHEEP < 1 ||
        player.resources.WHEAT < 1
      ) {
        return {
          valid: false,
          reason:
            'Building a Settlement requires 1 WOOD, 1 BRICK, 1 SHEEP, and 1 WHEAT.',
        };
      }
      const hex = state.hexes.find((h) => h.id === action.hexId);
      if (!hex) {
        return { valid: false, reason: `Hex ${action.hexId} does not exist.` };
      }
      return { valid: true };
    }

    case 'CATAN_UPGRADE_CITY': {
      if (state.turnStep !== 'MAIN_PHASE') {
        return {
          valid: false,
          reason: 'You must roll the dice before upgrading a city.',
        };
      }
      if (player.citiesRemaining <= 0) {
        return { valid: false, reason: 'No cities remaining in supply.' };
      }
      if (player.resources.WHEAT < 2 || player.resources.ORE < 3) {
        return {
          valid: false,
          reason: 'Upgrading to a City requires 2 WHEAT and 3 ORE.',
        };
      }
      const bld = state.buildings.find((b) => b.id === action.buildingId);
      if (!bld || bld.ownerId !== playerId || bld.kind !== 'SETTLEMENT') {
        return {
          valid: false,
          reason: 'Select one of your existing Settlements to upgrade.',
        };
      }
      return { valid: true };
    }

    case 'CATAN_MARITIME_TRADE':
      if (state.turnStep !== 'MAIN_PHASE') {
        return {
          valid: false,
          reason: 'You must roll the dice before trading.',
        };
      }
      if (action.give === action.receive) {
        return {
          valid: false,
          reason: 'Cannot trade a resource for the same resource.',
        };
      }
      if (player.resources[action.give] < 4) {
        return {
          valid: false,
          reason: `4:1 Maritime Trade requires at least 4 ${action.give} (you have ${player.resources[action.give]}).`,
        };
      }
      return { valid: true };

    case 'CATAN_END_TURN':
      if (state.turnStep !== 'MAIN_PHASE') {
        return {
          valid: false,
          reason: 'You must roll the dice before ending your turn.',
        };
      }
      return { valid: true };
  }
}

export function applyCatanAction(
  state: CatanGameState,
  playerId: string,
  action: CatanAction
): CatanGameState {
  const check = validateCatanAction(state, playerId, action);
  if (!check.valid) {
    throw new Error(`Invalid Catan action: ${check.reason}`);
  }

  const player = state.players[playerId]!;

  switch (action.type) {
    case 'CATAN_ROLL_DICE': {
      const d1 = nextInt(state.prng, 1, 6);
      const d2 = nextInt(d1.prng, 1, 6);
      const sum = d1.value + d2.value;

      const matchingHexes = state.hexes.filter(
        (h) => h.numberToken === sum && !h.hasRobber && h.terrain !== 'DESERT'
      );

      const nextPlayers: Record<string, CatanPlayerState> = {
        ...state.players,
      };
      const productionNotes: string[] = [];

      for (const hex of matchingHexes) {
        const resource = hex.terrain as CatanResource;
        for (const bld of state.buildings) {
          if (bld.hexIds.includes(hex.id)) {
            const yieldAmount = bld.kind === 'CITY' ? 2 : 1;
            const owner = nextPlayers[bld.ownerId]!;
            nextPlayers[bld.ownerId] = {
              ...owner,
              resources: {
                ...owner.resources,
                [resource]: owner.resources[resource] + yieldAmount,
              },
            };
            productionNotes.push(
              `${bld.ownerId} +${yieldAmount} ${resource}`
            );
          }
        }
      }

      const prodText =
        sum === 7
          ? 'Rolled 7 (Robber activated — no resources produced).'
          : productionNotes.length > 0
          ? `Produced: ${productionNotes.join(', ')}.`
          : 'No settlements on matching hexes.';

      return {
        ...state,
        prng: d2.prng,
        turnStep: 'MAIN_PHASE',
        lastDiceRoll: [d1.value, d2.value],
        players: nextPlayers,
        lastActionSummary: `${playerId} rolled 🎲 ${d1.value} + ${d2.value} = ${sum}. ${prodText}`,
      };
    }

    case 'CATAN_BUILD_ROAD': {
      const updatedPlayer: CatanPlayerState = {
        ...player,
        resources: {
          ...player.resources,
          WOOD: player.resources.WOOD - 1,
          BRICK: player.resources.BRICK - 1,
        },
        roadsBuilt: player.roadsBuilt + 1,
      };

      return {
        ...state,
        players: {
          ...state.players,
          [playerId]: updatedPlayer,
        },
        lastActionSummary: `${playerId} built a Road (total roads: ${updatedPlayer.roadsBuilt}).`,
      };
    }

    case 'CATAN_BUILD_SETTLEMENT': {
      const newVP = player.victoryPoints + 1;
      const updatedPlayer: CatanPlayerState = {
        ...player,
        resources: {
          ...player.resources,
          WOOD: player.resources.WOOD - 1,
          BRICK: player.resources.BRICK - 1,
          SHEEP: player.resources.SHEEP - 1,
          WHEAT: player.resources.WHEAT - 1,
        },
        settlementsRemaining: player.settlementsRemaining - 1,
        victoryPoints: newVP,
      };

      const newBuilding: CatanBuilding = {
        id: `BLD_${playerId}_${state.buildings.length + 1}`,
        hexIds: [action.hexId],
        ownerId: playerId,
        kind: 'SETTLEMENT',
      };

      const isWon = newVP >= 10;

      return {
        ...state,
        phase: isWon ? 'GAME_OVER' : state.phase,
        buildings: [...state.buildings, newBuilding],
        players: {
          ...state.players,
          [playerId]: updatedPlayer,
        },
        lastActionSummary: `${playerId} built a Settlement on ${action.hexId} (+1 VP → ${newVP} VP)${
          isWon ? ' — VICTORY!' : '.'
        }`,
      };
    }

    case 'CATAN_UPGRADE_CITY': {
      const newVP = player.victoryPoints + 1;
      const updatedPlayer: CatanPlayerState = {
        ...player,
        resources: {
          ...player.resources,
          WHEAT: player.resources.WHEAT - 2,
          ORE: player.resources.ORE - 3,
        },
        settlementsRemaining: player.settlementsRemaining + 1,
        citiesRemaining: player.citiesRemaining - 1,
        victoryPoints: newVP,
      };

      const updatedBuildings = state.buildings.map((b) =>
        b.id === action.buildingId ? { ...b, kind: 'CITY' as const } : b
      );

      const isWon = newVP >= 10;

      return {
        ...state,
        phase: isWon ? 'GAME_OVER' : state.phase,
        buildings: updatedBuildings,
        players: {
          ...state.players,
          [playerId]: updatedPlayer,
        },
        lastActionSummary: `${playerId} upgraded ${action.buildingId} to a City (+1 VP → ${newVP} VP)${
          isWon ? ' — VICTORY!' : '.'
        }`,
      };
    }

    case 'CATAN_MARITIME_TRADE': {
      const updatedPlayer: CatanPlayerState = {
        ...player,
        resources: {
          ...player.resources,
          [action.give]: player.resources[action.give] - 4,
          [action.receive]: player.resources[action.receive] + 1,
        },
      };

      return {
        ...state,
        players: {
          ...state.players,
          [playerId]: updatedPlayer,
        },
        lastActionSummary: `${playerId} traded 4 ${action.give} for 1 ${action.receive} (4:1 Maritime Trade).`,
      };
    }

    case 'CATAN_END_TURN': {
      const nextIndex =
        (state.activePlayerIndex + 1) % state.playerOrder.length;
      const nextPlayerId = state.playerOrder[nextIndex]!;
      return {
        ...state,
        activePlayerIndex: nextIndex,
        turnStep: 'ROLL_DICE',
        turnNumber: state.turnNumber + 1,
        lastActionSummary: `${playerId} ended their turn. It is now ${nextPlayerId}'s turn to roll.`,
      };
    }
  }
}

export function getCatanPlayerPerspective(
  state: CatanGameState,
  playerId: string
): CatanSanitizedGameState {
  const self = state.players[playerId];
  if (!self) {
    throw new Error(`Player ${playerId} does not exist in Catan state.`);
  }

  const opponents: Record<string, CatanSanitizedOpponent> = {};
  for (const pid of state.playerOrder) {
    if (pid === playerId) continue;
    const opp = state.players[pid]!;
    opponents[pid] = {
      id: opp.id,
      totalResourceCards: getTotalResourceCards(opp.resources),
      settlementsRemaining: opp.settlementsRemaining,
      citiesRemaining: opp.citiesRemaining,
      roadsBuilt: opp.roadsBuilt,
      victoryPoints: opp.victoryPoints,
    };
  }

  return {
    gameId: 'catan',
    phase: state.phase,
    playerOrder: [...state.playerOrder],
    activePlayerId: state.playerOrder[state.activePlayerIndex]!,
    turnStep: state.turnStep,
    turnNumber: state.turnNumber,
    lastDiceRoll: state.lastDiceRoll ? [...state.lastDiceRoll] : null,
    hexes: state.hexes.map((h) => ({ ...h })),
    buildings: state.buildings.map((b) => ({ ...b, hexIds: [...b.hexIds] })),
    self: {
      ...self,
      resources: { ...self.resources },
    },
    opponents,
    lastActionSummary: state.lastActionSummary,
  };
}

export function calculateCatanFinalScores(
  state: CatanGameState
): Record<string, number> {
  const scores: Record<string, number> = {};
  for (const pid of state.playerOrder) {
    scores[pid] = state.players[pid]!.victoryPoints;
  }
  return scores;
}

