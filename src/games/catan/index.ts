import { createPRNG, nextInt, PRNGState } from '../../common/prng.js';
import { ValidationResult } from '../ticket-to-ride/types.js';
import {
  calculateLongestRoadLength,
  CatanBoard,
  createSeededRng,
  EdgeNode,
  generateCatanBoard,
  getValidInitialSettlementSpots,
  getValidRoadSpots,
  getValidSettlementSpots,
  HarborType,
  HexNode,
   OUTER_CORNER_COORDS,
  shuffleWithRng,
  SPIRAL_TOKEN_LETTERS,
  SPIRAL_TOKEN_NUMBERS,
  STANDARD_19_TERRAINS,
  STANDARD_9_HARBORS,
  TerrainType,
  TokenLetter,
  VertexNode,
} from './boardGenerator.js';

export {
  calculateLongestRoadLength,
  createSeededRng,
  generateCatanBoard,
  getValidInitialSettlementSpots,
  getValidRoadSpots,
  getValidSettlementSpots,
  OUTER_CORNER_COORDS,
  shuffleWithRng,
  SPIRAL_TOKEN_LETTERS,
  SPIRAL_TOKEN_NUMBERS,
  STANDARD_19_TERRAINS,
  STANDARD_9_HARBORS,
};
export type {
  CatanBoard,
  EdgeNode,
  HarborType,
  HexNode,
  TerrainType,
  TokenLetter,
  VertexNode,
};

export type CatanResource = 'WOOD' | 'BRICK' | 'SHEEP' | 'WHEAT' | 'ORE';

export type CatanTerrain = CatanResource | 'DESERT';

export const ALL_CATAN_RESOURCES: readonly CatanResource[] = [
  'WOOD',
  'BRICK',
  'SHEEP',
  'WHEAT',
  'ORE',
] as const;

// ============================================================================
// Development Card Definitions
// ============================================================================

export type CatanDevCardType =
  | 'KNIGHT'
  | 'MONOPOLY'
  | 'YEAR_OF_PLENTY'
  | 'ROAD_BUILDING'
  | 'UNIVERSITY'
  | 'PALACE'
  | 'LIBRARY'
  | 'CHAPEL'
  | 'MARKET';

export type CatanDevCardFrame = 'RED' | 'GREEN' | 'YELLOW';
export type CatanDevCardCategory = 'KNIGHT' | 'PROGRESS' | 'VICTORY_POINT';

export interface CatanDevCardDefinition {
  readonly type: CatanDevCardType;
  readonly name: string;
  readonly category: CatanDevCardCategory;
  readonly frame: CatanDevCardFrame;
  readonly description: string;
  readonly vp: number;
}

export const CATAN_DEV_CARD_DEFINITIONS: Readonly<
  Record<CatanDevCardType, CatanDevCardDefinition>
> = {
  KNIGHT: {
    type: 'KNIGHT',
    name: 'Knight',
    category: 'KNIGHT',
    frame: 'RED',
    description:
      'Move the robber. Steal 1 resource card from the owner of an adjacent settlement or city.',
    vp: 0,
  },
  MONOPOLY: {
    type: 'MONOPOLY',
    name: 'Monopoly',
    category: 'PROGRESS',
    frame: 'GREEN',
    description:
      'When you play this card, announce 1 type of resource. All other players must give you all their resource cards of that type.',
    vp: 0,
  },
  YEAR_OF_PLENTY: {
    type: 'YEAR_OF_PLENTY',
    name: 'Year of Plenty',
    category: 'PROGRESS',
    frame: 'GREEN',
    description:
      'Take any 2 resources from the bank. Add them to your hand. They can be 2 of the same resource or 2 different resources.',
    vp: 0,
  },
  ROAD_BUILDING: {
    type: 'ROAD_BUILDING',
    name: 'Road Building',
    category: 'PROGRESS',
    frame: 'GREEN',
    description: 'Place 2 new roads as if you had just built them.',
    vp: 0,
  },
  UNIVERSITY: {
    type: 'UNIVERSITY',
    name: 'University',
    category: 'VICTORY_POINT',
    frame: 'YELLOW',
    description: '1 Victory Point',
    vp: 1,
  },
  PALACE: {
    type: 'PALACE',
    name: 'Palace',
    category: 'VICTORY_POINT',
    frame: 'YELLOW',
    description: '1 Victory Point',
    vp: 1,
  },
  LIBRARY: {
    type: 'LIBRARY',
    name: 'Library',
    category: 'VICTORY_POINT',
    frame: 'YELLOW',
    description: '1 Victory Point',
    vp: 1,
  },
  CHAPEL: {
    type: 'CHAPEL',
    name: 'Chapel',
    category: 'VICTORY_POINT',
    frame: 'YELLOW',
    description: '1 Victory Point',
    vp: 1,
  },
  MARKET: {
    type: 'MARKET',
    name: 'Market',
    category: 'VICTORY_POINT',
    frame: 'YELLOW',
    description: '1 Victory Point',
    vp: 1,
  },
};

export interface CatanDevCardInstance {
  readonly id: string;
  readonly type: CatanDevCardType;
  readonly name: string;
  readonly category: CatanDevCardCategory;
  readonly frame: CatanDevCardFrame;
  readonly description: string;
  readonly vp: number;
  readonly purchasedOnTurn: number;
}

/**
 * Standard 25-card Development Card composition:
 * 14 Knight, 2 Monopoly, 2 Year of Plenty, 2 Road Building,
 * 1 University, 1 Palace, 1 Library, 1 Chapel, 1 Market.
 */
export const STANDARD_DEV_CARD_DECK_TYPES: readonly CatanDevCardType[] = [
  'KNIGHT',
  'KNIGHT',
  'KNIGHT',
  'KNIGHT',
  'KNIGHT',
  'KNIGHT',
  'KNIGHT',
  'KNIGHT',
  'KNIGHT',
  'KNIGHT',
  'KNIGHT',
  'KNIGHT',
  'KNIGHT',
  'KNIGHT',
  'MONOPOLY',
  'MONOPOLY',
  'YEAR_OF_PLENTY',
  'YEAR_OF_PLENTY',
  'ROAD_BUILDING',
  'ROAD_BUILDING',
  'UNIVERSITY',
  'PALACE',
  'LIBRARY',
  'CHAPEL',
  'MARKET',
] as const;

export function createShuffledDevCardDeck(
  rng: () => number
): CatanDevCardInstance[] {
  const shuffledTypes = shuffleWithRng(STANDARD_DEV_CARD_DECK_TYPES, rng);
  return shuffledTypes.map((type, idx) => {
    const def = CATAN_DEV_CARD_DEFINITIONS[type];
    return {
      id: `DEV_${idx + 1}_${type}`,
      type: def.type,
      name: def.name,
      category: def.category,
      frame: def.frame,
      description: def.description,
      vp: def.vp,
      purchasedOnTurn: 0,
    };
  });
}

// ============================================================================
// Trade Negotiation Structures
// ============================================================================

export type CatanTradeBranchStatus =
  | 'AWAITING_OPPONENT'
  | 'OPPONENT_ACCEPTED'
  | 'OPPONENT_COUNTERED'
  | 'DECLINED';

export interface CatanTradeBranch {
  readonly opponentId: string;
  readonly status: CatanTradeBranchStatus;
  /** Resources the active player gives to this opponent if accepted */
  readonly activeGives: Readonly<Record<CatanResource, number>>;
  /** Resources this opponent gives to the active player if accepted */
  readonly opponentGives: Readonly<Record<CatanResource, number>>;
  readonly lastProposedBy: string;
}

export interface CatanActiveTrade {
  readonly initiatorId: string;
  readonly phase: 'AWAITING_OPPONENTS' | 'AWAITING_ACTIVE_PLAYER';
  readonly initialOffered: Readonly<Record<CatanResource, number>>;
  readonly initialRequested: Readonly<Record<CatanResource, number>>;
  readonly branches: Readonly<Record<string, CatanTradeBranch>>;
}

// ============================================================================
// Game State & Player State Interfaces
// ============================================================================

export interface CatanHexTile {
  readonly id: string;
  readonly q: number;
  readonly r: number;
  readonly terrain: CatanTerrain;
  readonly numberToken: number | null; // 2..12 (null for DESERT)
  readonly tokenLetter?: TokenLetter | null;
  readonly hasRobber: boolean;
}

export interface CatanBuilding {
  readonly id: string;
  readonly vertexId: string;
  readonly hexIds: readonly string[];
  readonly ownerId: string;
  readonly kind: 'SETTLEMENT' | 'CITY';
}

export interface CatanPlayerState {
  readonly id: string;
  readonly resources: Readonly<Record<CatanResource, number>>;
  readonly devCards: readonly CatanDevCardInstance[];
  readonly playedVictoryCards: readonly CatanDevCardInstance[];
  readonly faceUpKnights: number;
  readonly settlementsRemaining: number; // starts at 5
  readonly citiesRemaining: number; // starts at 4
  readonly roadsRemaining: number; // starts at 15
  readonly roadsBuilt: number;
  readonly longestRoadLength: number;
  readonly hasLongestRoad: boolean;
  readonly hasLargestArmy: boolean;
  readonly victoryPoints: number;
}

export interface CatanSanitizedOpponent {
  readonly id: string;
  readonly totalResourceCards: number;
  readonly developmentCardCount: number;
  readonly faceUpKnights: number;
  readonly settlementsRemaining: number;
  readonly citiesRemaining: number;
  readonly roadsRemaining: number;
  readonly roadsBuilt: number;
  readonly longestRoadLength: number;
  readonly hasLongestRoad: boolean;
  readonly hasLargestArmy: boolean;
  readonly victoryPoints: number;
}

export type CatanPhase = 'PLAYING' | 'GAME_OVER';

export type CatanTurnStep =
  | 'ROLL_FOR_START'
  | 'SETUP_SETTLEMENT_1'
  | 'SETUP_ROAD_1'
  | 'SETUP_SETTLEMENT_2'
  | 'SETUP_ROAD_2'
  | 'ROLL_DICE'
  | 'DISCARD_ON_SEVEN'
  | 'MOVE_ROBBER'
  | 'SELECT_ROBBER_VICTIM'
  | 'STEAL_ROBBER_CARD'
  | 'SELECT_CITY_UPGRADE'
  | 'MAIN_PHASE';

export interface CatanGameState {
  readonly gameId: 'catan';
  readonly phase: CatanPhase;
  readonly playerOrder: readonly string[];
  readonly activePlayerIndex: number;
  readonly turnStep: CatanTurnStep;
  readonly turnNumber: number;
  readonly prng: PRNGState;
  readonly board: CatanBoard;
  readonly startingRolls: Readonly<Record<string, readonly [number, number]>>;
  readonly startingPlayerId: string | null;
  readonly lastPlacedSettlementVertexId: string | null;
  readonly freeRoadsRemaining: number;
  readonly lastDiceRoll: readonly [number, number] | null;
  readonly devCardDeck: readonly CatanDevCardInstance[];
  readonly hasPlayedDevCardThisTurn: boolean;
  readonly pendingDiscards: Readonly<Record<string, number>>;
  readonly robberReturnStep: 'ROLL_DICE' | 'MAIN_PHASE';
  readonly robberEligibleVictimIds: readonly string[];
  readonly robberVictimId: string | null;
  readonly robberShuffledVictimCards: readonly CatanResource[];
  readonly cityUpgradePaid: boolean;
  readonly largestArmyOwnerId: string | null;
  readonly largestArmySize: number;
  readonly longestRoadOwnerId: string | null;
  readonly longestRoadLength: number;
  readonly activeTrade: CatanActiveTrade | null;
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
  readonly board: CatanBoard;
  readonly startingRolls: Readonly<Record<string, readonly [number, number]>>;
  readonly startingPlayerId: string | null;
  readonly lastPlacedSettlementVertexId: string | null;
  readonly freeRoadsRemaining: number;
  readonly lastDiceRoll: readonly [number, number] | null;
  readonly devCardDeckCount: number;
  readonly hasPlayedDevCardThisTurn: boolean;
  readonly pendingDiscards: Readonly<Record<string, number>>;
  readonly robberEligibleVictimIds: readonly string[];
  readonly robberVictimId: string | null;
  readonly robberVictimCardCount: number;
  readonly cityUpgradePaid: boolean;
  readonly largestArmyOwnerId: string | null;
  readonly largestArmySize: number;
  readonly longestRoadOwnerId: string | null;
  readonly longestRoadLength: number;
  readonly activeTrade: CatanActiveTrade | null;
  readonly hexes: readonly CatanHexTile[];
  readonly buildings: readonly CatanBuilding[];
  readonly self: CatanPlayerState;
  readonly opponents: Readonly<Record<string, CatanSanitizedOpponent>>;
  readonly lastActionSummary: string | null;
}

// ============================================================================
// Catan Actions
// ============================================================================

export interface CatanRollDiceAction {
  readonly type: 'CATAN_ROLL_DICE';
}

export interface CatanDiscardResourcesAction {
  readonly type: 'CATAN_DISCARD_RESOURCES';
  readonly resources: Partial<Record<CatanResource, number>>;
}

export interface CatanMoveRobberAction {
  readonly type: 'CATAN_MOVE_ROBBER';
  readonly targetHexId: string;
}

export interface CatanSelectRobberVictimAction {
  readonly type: 'CATAN_SELECT_ROBBER_VICTIM';
  readonly victimPlayerId: string;
}

export interface CatanStealCardAction {
  readonly type: 'CATAN_STEAL_CARD';
  readonly cardIndex: number;
}

export interface CatanStartUpgradeCityAction {
  readonly type: 'CATAN_START_UPGRADE_CITY';
}

export interface CatanPlaceInitialSettlementAction {
  readonly type: 'CATAN_PLACE_INITIAL_SETTLEMENT';
  readonly vertexId: string;
}

export interface CatanPlaceInitialRoadAction {
  readonly type: 'CATAN_PLACE_INITIAL_ROAD';
  readonly edgeId: string;
}

export interface CatanBuildRoadAction {
  readonly type: 'CATAN_BUILD_ROAD';
  readonly edgeId?: string;
}

export interface CatanBuildSettlementAction {
  readonly type: 'CATAN_BUILD_SETTLEMENT';
  readonly vertexId?: string;
  readonly hexId?: string;
}

export interface CatanUpgradeCityAction {
  readonly type: 'CATAN_UPGRADE_CITY';
  readonly vertexId?: string;
  readonly buildingId?: string;
}

export interface CatanBuyDevCardAction {
  readonly type: 'CATAN_BUY_DEV_CARD';
}

export interface CatanPlayKnightAction {
  readonly type: 'CATAN_PLAY_KNIGHT';
  readonly targetHexId?: string;
  readonly victimPlayerId?: string;
}

export interface CatanPlayMonopolyAction {
  readonly type: 'CATAN_PLAY_MONOPOLY';
  readonly resource: CatanResource;
}

export interface CatanPlayYearOfPlentyAction {
  readonly type: 'CATAN_PLAY_YEAR_OF_PLENTY';
  readonly resource1: CatanResource;
  readonly resource2: CatanResource;
}

export interface CatanPlayRoadBuildingAction {
  readonly type: 'CATAN_PLAY_ROAD_BUILDING';
  readonly edgeIds?: readonly string[];
}

export interface CatanPlayVictoryPointCardAction {
  readonly type: 'CATAN_PLAY_VP_CARD';
  readonly cardId?: string;
}

export interface CatanMaritimeTradeAction {
  readonly type: 'CATAN_MARITIME_TRADE';
  readonly give: CatanResource;
  readonly receive: CatanResource;
}

export interface CatanProposeTradeAction {
  readonly type: 'CATAN_PROPOSE_TRADE';
  readonly offered: Partial<Record<CatanResource, number>>;
  readonly requested: Partial<Record<CatanResource, number>>;
}

export interface CatanRespondTradeAction {
  readonly type: 'CATAN_RESPOND_TRADE';
  readonly response: 'ACCEPT' | 'COUNTER' | 'DECLINE';
  /** Required when the active player is responding to a specific opponent's branch */
  readonly targetOpponentId?: string;
  /** What the responding player offers to give */
  readonly counterGive?: Partial<Record<CatanResource, number>>;
  /** What the responding player asks to receive */
  readonly counterRequest?: Partial<Record<CatanResource, number>>;
}

export interface CatanCancelTradeAction {
  readonly type: 'CATAN_CANCEL_TRADE';
}

export interface CatanEndTurnAction {
  readonly type: 'CATAN_END_TURN';
}

export type CatanAction =
  | CatanRollDiceAction
  | CatanDiscardResourcesAction
  | CatanMoveRobberAction
  | CatanSelectRobberVictimAction
  | CatanStealCardAction
  | CatanStartUpgradeCityAction
  | CatanPlaceInitialSettlementAction
  | CatanPlaceInitialRoadAction
  | CatanBuildRoadAction
  | CatanBuildSettlementAction
  | CatanUpgradeCityAction
  | CatanBuyDevCardAction
  | CatanPlayKnightAction
  | CatanPlayMonopolyAction
  | CatanPlayYearOfPlentyAction
  | CatanPlayRoadBuildingAction
  | CatanPlayVictoryPointCardAction
  | CatanMaritimeTradeAction
  | CatanProposeTradeAction
  | CatanRespondTradeAction
  | CatanCancelTradeAction
  | CatanEndTurnAction;

// ============================================================================
// Internal Helpers
// ============================================================================

export function createEmptyResources(): Record<CatanResource, number> {
  return {
    WOOD: 0,
    BRICK: 0,
    SHEEP: 0,
    WHEAT: 0,
    ORE: 0,
  };
}

export function normalizeResourceBundle(
  bundle?: Partial<Record<CatanResource, number>>
): Record<CatanResource, number> {
  const out = createEmptyResources();
  if (!bundle) return out;
  for (const res of ALL_CATAN_RESOURCES) {
    const val = Math.floor(Number(bundle[res] ?? 0));
    out[res] = val > 0 ? val : 0;
  }
  return out;
}

export function getTotalResourceCards(
  res: Readonly<Record<CatanResource, number>>
): number {
  return res.WOOD + res.BRICK + res.SHEEP + res.WHEAT + res.ORE;
}

export function hasResources(
  held: Readonly<Record<CatanResource, number>>,
  required: Readonly<Record<CatanResource, number>>
): boolean {
  for (const res of ALL_CATAN_RESOURCES) {
    if ((held[res] ?? 0) < (required[res] ?? 0)) {
      return false;
    }
  }
  return true;
}

export function terrainToResource(terrain: TerrainType): CatanResource | null {
  switch (terrain) {
    case 'wood':
      return 'WOOD';
    case 'brick':
      return 'BRICK';
    case 'sheep':
      return 'SHEEP';
    case 'wheat':
      return 'WHEAT';
    case 'ore':
      return 'ORE';
    case 'desert':
      return null;
  }
}

function terrainToUppercase(terrain: TerrainType): CatanTerrain {
  return terrain.toUpperCase() as CatanTerrain;
}

function syncLegacyHexesAndBuildings(board: CatanBoard): {
  hexes: CatanHexTile[];
  buildings: CatanBuilding[];
} {
  const hexes: CatanHexTile[] = Object.values(board.hexes).map((h) => ({
    id: h.id,
    q: h.q,
    r: h.r,
    terrain: terrainToUppercase(h.terrain),
    numberToken: h.numberToken,
    tokenLetter: h.tokenLetter,
    hasRobber: h.hasRobber,
  }));

  const buildings: CatanBuilding[] = [];
  for (const v of Object.values(board.vertices)) {
    if (v.building && v.ownerId) {
      buildings.push({
        id: `BLD_${v.id}`,
        vertexId: v.id,
        hexIds: [...v.touchingHexIds],
        ownerId: v.ownerId,
        kind: v.building === 'city' ? 'CITY' : 'SETTLEMENT',
      });
    }
  }
  return { hexes, buildings };
}

function cloneBoard(board: CatanBoard): CatanBoard {
  const hexes: Record<string, HexNode> = {};
  for (const [k, h] of Object.entries(board.hexes)) {
    hexes[k] = {
      ...h,
      vertexIds: [...h.vertexIds],
      edgeIds: [...h.edgeIds],
    };
  }
  const vertices: Record<string, VertexNode> = {};
  for (const [k, v] of Object.entries(board.vertices)) {
    vertices[k] = {
      ...v,
      adjacentVertexIds: [...v.adjacentVertexIds],
      connectedEdgeIds: [...v.connectedEdgeIds],
      touchingHexIds: [...v.touchingHexIds],
    };
  }
  const edges: Record<string, EdgeNode> = {};
  for (const [k, e] of Object.entries(board.edges)) {
    edges[k] = {
      ...e,
      endpointVertexIds: [e.endpointVertexIds[0], e.endpointVertexIds[1]],
      connectedEdgeIds: [...e.connectedEdgeIds],
    };
  }
  return {
    seed: board.seed,
    hexes,
    vertices,
    edges,
    robberHexId: board.robberHexId,
  };
}

/**
 * Recalculates Longest Road, Largest Army, and each player's total Victory Points.
 */
function recalculateAwardsAndVictoryPoints(state: CatanGameState): CatanGameState {
  // 1. Longest Road (minimum 5 continuous segments; only changes hands when strictly exceeded)
  const roadLengths: Record<string, number> = {};
  for (const pid of state.playerOrder) {
    roadLengths[pid] = calculateLongestRoadLength(state.board, pid);
  }

  let longestRoadOwnerId = state.longestRoadOwnerId;
  let longestRoadLength = longestRoadOwnerId
    ? roadLengths[longestRoadOwnerId] ?? 0
    : 0;

  if (longestRoadLength < 5) {
    longestRoadOwnerId = null;
    longestRoadLength = 0;
  }

  for (const pid of state.playerOrder) {
    const len = roadLengths[pid] ?? 0;
    if (len >= 5 && len > longestRoadLength) {
      longestRoadOwnerId = pid;
      longestRoadLength = len;
    }
  }

  // 2. Largest Army (minimum 3 face-up Knight cards; only changes hands when strictly exceeded)
  let largestArmyOwnerId = state.largestArmyOwnerId;
  let largestArmySize = largestArmyOwnerId
    ? state.players[largestArmyOwnerId]?.faceUpKnights ?? 0
    : 0;

  if (largestArmySize < 3) {
    largestArmyOwnerId = null;
    largestArmySize = 0;
  }

  for (const pid of state.playerOrder) {
    const knights = state.players[pid]?.faceUpKnights ?? 0;
    if (knights >= 3 && knights > largestArmySize) {
      largestArmyOwnerId = pid;
      largestArmySize = knights;
    }
  }

  // 3. Recompute each player's Victory Points:
  //    - 1 VP per Settlement on board
  //    - 2 VP per City on board
  //    - +2 VP for Longest Road
  //    - +2 VP for Largest Army
  //    - +1 VP per played Victory Point card
  const nextPlayers: Record<string, CatanPlayerState> = {};
  for (const pid of state.playerOrder) {
    const p = state.players[pid]!;
    let settlementsOnBoard = 0;
    let citiesOnBoard = 0;
    for (const v of Object.values(state.board.vertices)) {
      if (v.ownerId === pid) {
        if (v.building === 'settlement') settlementsOnBoard++;
        else if (v.building === 'city') citiesOnBoard++;
      }
    }
    const roadsOnBoard = Object.values(state.board.edges).filter(
      (e) => e.ownerId === pid
    ).length;

    const hasLongestRoad = longestRoadOwnerId === pid;
    const hasLargestArmy = largestArmyOwnerId === pid;
    const playedVpPoints = p.playedVictoryCards.reduce(
      (sum, c) => sum + c.vp,
      0
    );

    const vp =
      settlementsOnBoard * 1 +
      citiesOnBoard * 2 +
      (hasLongestRoad ? 2 : 0) +
      (hasLargestArmy ? 2 : 0) +
      playedVpPoints;

    nextPlayers[pid] = {
      ...p,
      settlementsRemaining: Math.max(0, 5 - settlementsOnBoard),
      citiesRemaining: Math.max(0, 4 - citiesOnBoard),
      roadsRemaining: Math.max(0, 15 - roadsOnBoard),
      roadsBuilt: Math.max(p.roadsBuilt, roadsOnBoard),
      longestRoadLength: roadLengths[pid] ?? 0,
      hasLongestRoad,
      hasLargestArmy,
      victoryPoints: vp,
    };
  }

  const { hexes, buildings } = syncLegacyHexesAndBuildings(state.board);
  const activePlayerId = state.playerOrder[state.activePlayerIndex]!;
  const activePlayerVP = nextPlayers[activePlayerId]?.victoryPoints ?? 0;
  const nextPhase: CatanPhase =
    activePlayerVP >= 10 ? 'GAME_OVER' : state.phase;

  return {
    ...state,
    phase: nextPhase,
    largestArmyOwnerId,
    largestArmySize,
    longestRoadOwnerId,
    longestRoadLength,
    hexes,
    buildings,
    players: nextPlayers,
  };
}

/**
 * Determines the maritime trade ratio for `playerId` when giving `resource`:
 * - 2:1 if the player has a settlement/city on a matching `2:1:<resource>` harbor
 * - 3:1 if the player has a settlement/city on any `3:1` harbor
 * - 4:1 default bank rate
 */
export function getPlayerMaritimeTradeRate(
  board: CatanBoard,
  playerId: string,
  resource: CatanResource
): number {
  const specificHarbor = `2:1:${resource.toLowerCase()}` as HarborType;
  let rate = 4;
  for (const v of Object.values(board.vertices)) {
    if (v.ownerId === playerId && v.building !== null) {
      if (v.harbor === specificHarbor) {
        return 2;
      }
      if (v.harbor === '3:1') {
        rate = 3;
      }
    }
  }
  return rate;
}

// ============================================================================
// Game Initialization (`initCatanGame`)
// ============================================================================

export interface CatanInitOptions {
  readonly seedString?: string;
  /**
   * When true, skips the interactive starting-player roll and snake-draft setup
   * and places 2 initial settlements + 2 roads per player automatically.
   */
  readonly skipSetup?: boolean;
}

export function initCatanGame(
  playerIds: string[],
  seed: number,
  options?: CatanInitOptions
): CatanGameState {
  if (playerIds.length < 3 || playerIds.length > 4) {
    throw new Error(
      `Catan requires between 3 and 4 players (received ${playerIds.length}).`
    );
  }

  const seedStr = options?.seedString ?? String(seed);
  const board = generateCatanBoard(seedStr);
  const rng = createSeededRng(`${board.seed}_GAME`);
  const devCardDeck = createShuffledDevCardDeck(rng);
  const prng = createPRNG(seed);

  // Determine the Starting Player by the highest 2d6 roll using seeded RNG
  const startingRolls: Record<string, readonly [number, number]> = {};
  let bestSum = -1;
  let winningPlayerIndex = 0;

  playerIds.forEach((pid, idx) => {
    let d1 = Math.floor(rng() * 6) + 1;
    let d2 = Math.floor(rng() * 6) + 1;
    // Ensure unique highest roll so there is an unambiguous starting player
    while (d1 + d2 === bestSum) {
      d1 = Math.floor(rng() * 6) + 1;
      d2 = Math.floor(rng() * 6) + 1;
    }
    startingRolls[pid] = [d1, d2];
    if (d1 + d2 > bestSum) {
      bestSum = d1 + d2;
      winningPlayerIndex = idx;
    }
  });

  // Rotate playerOrder so the player with the highest roll goes first!
  const rotatedOrder = [
    ...playerIds.slice(winningPlayerIndex),
    ...playerIds.slice(0, winningPlayerIndex),
  ];
  const startingPlayerId = rotatedOrder[0]!;
  const winningRoll = startingRolls[startingPlayerId]!;

  const players: Record<string, CatanPlayerState> = {};
  for (const pid of rotatedOrder) {
    players[pid] = {
      id: pid,
      resources: createEmptyResources(),
      devCards: [],
      playedVictoryCards: [],
      faceUpKnights: 0,
      settlementsRemaining: 5,
      citiesRemaining: 4,
      roadsRemaining: 15,
      roadsBuilt: 0,
      longestRoadLength: 0,
      hasLongestRoad: false,
      hasLargestArmy: false,
      victoryPoints: 0,
    };
  }

  const { hexes, buildings } = syncLegacyHexesAndBuildings(board);

  let initialState: CatanGameState = {
    gameId: 'catan',
    phase: 'PLAYING',
    playerOrder: rotatedOrder,
    activePlayerIndex: 0,
    turnStep: 'SETUP_SETTLEMENT_1',
    turnNumber: 1,
    prng,
    board,
    startingRolls,
    startingPlayerId,
    lastPlacedSettlementVertexId: null,
    freeRoadsRemaining: 0,
    lastDiceRoll: winningRoll,
    devCardDeck,
    hasPlayedDevCardThisTurn: false,
    pendingDiscards: {},
    robberReturnStep: 'MAIN_PHASE',
    robberEligibleVictimIds: [],
    robberVictimId: null,
    robberShuffledVictimCards: [],
    cityUpgradePaid: false,
    largestArmyOwnerId: null,
    largestArmySize: 0,
    longestRoadOwnerId: null,
    longestRoadLength: 0,
    activeTrade: null,
    hexes,
    buildings,
    players,
    lastActionSummary: `High roll of the dice: ${startingPlayerId} rolled 🎲 ${winningRoll[0]} + ${winningRoll[1]} = ${
      winningRoll[0] + winningRoll[1]
    } and goes first! ${startingPlayerId}, select a hex corner for your 1st Settlement.`,
  };

  if (options?.skipSetup) {
    // Automatically run the snake draft (1st settlement + road forward, 2nd settlement + road reverse)
    for (let i = 0; i < rotatedOrder.length; i++) {
      const pid = rotatedOrder[i]!;
      const spot = getValidInitialSettlementSpots(initialState.board)[0]!;
      initialState = applyCatanAction(initialState, pid, {
        type: 'CATAN_PLACE_INITIAL_SETTLEMENT',
        vertexId: spot.id,
      });
      const roadSpot = getValidRoadSpots(
        initialState.board,
        pid,
        spot.id
      )[0]!;
      initialState = applyCatanAction(initialState, pid, {
        type: 'CATAN_PLACE_INITIAL_ROAD',
        edgeId: roadSpot.id,
      });
    }
    for (let i = rotatedOrder.length - 1; i >= 0; i--) {
      const pid = rotatedOrder[i]!;
      const spot = getValidInitialSettlementSpots(initialState.board)[0]!;
      initialState = applyCatanAction(initialState, pid, {
        type: 'CATAN_PLACE_INITIAL_SETTLEMENT',
        vertexId: spot.id,
      });
      const roadSpot = getValidRoadSpots(
        initialState.board,
        pid,
        spot.id
      )[0]!;
      initialState = applyCatanAction(initialState, pid, {
        type: 'CATAN_PLACE_INITIAL_ROAD',
        edgeId: roadSpot.id,
      });
    }
  }

  return initialState;
}

// ============================================================================
// Action Validation (`validateCatanAction`)
// ============================================================================

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

  const activePlayerId = state.playerOrder[state.activePlayerIndex]!;

  // Trade responses can be submitted by opponents when activeTrade.phase === 'AWAITING_OPPONENTS'
  if (action.type === 'CATAN_RESPOND_TRADE') {
    if (!state.activeTrade) {
      return { valid: false, reason: 'There is no active trade offer.' };
    }
    if (state.activeTrade.phase === 'AWAITING_OPPONENTS') {
      if (playerId === state.activeTrade.initiatorId) {
        return {
          valid: false,
          reason: 'Waiting for other players to respond to your trade offer.',
        };
      }
      const branch = state.activeTrade.branches[playerId];
      if (!branch || branch.status !== 'AWAITING_OPPONENT') {
        return {
          valid: false,
          reason: 'You have already responded to this trade round.',
        };
      }
      if (action.response === 'ACCEPT') {
        if (!hasResources(player.resources, branch.opponentGives)) {
          return {
            valid: false,
            reason:
              'You do not have the required resources to accept this trade.',
          };
        }
        return { valid: true };
      }
      if (action.response === 'COUNTER') {
        const counterGive = normalizeResourceBundle(action.counterGive);
        const counterRequest = normalizeResourceBundle(action.counterRequest);
        if (
          getTotalResourceCards(counterGive) <= 0 ||
          getTotalResourceCards(counterRequest) <= 0
        ) {
          return {
            valid: false,
            reason:
              'Counter-offer must include at least 1 resource offered and 1 resource requested.',
          };
        }
        if (!hasResources(player.resources, counterGive)) {
          return {
            valid: false,
            reason: 'You can only make counter-proposals with resources you have.',
          };
        }
        return { valid: true };
      }
      if (action.response === 'DECLINE') {
        return { valid: true };
      }
      return { valid: false, reason: 'Invalid trade response.' };
    } else {
      // AWAITING_ACTIVE_PLAYER
      if (playerId !== state.activeTrade.initiatorId) {
        return {
          valid: false,
          reason: 'Waiting for the active player to review trade responses.',
        };
      }
      const targetId = action.targetOpponentId;
      if (!targetId) {
        return {
          valid: false,
          reason: 'Specify targetOpponentId when responding to a trade branch.',
        };
      }
      const branch = state.activeTrade.branches[targetId];
      if (
        !branch ||
        (branch.status !== 'OPPONENT_ACCEPTED' &&
          branch.status !== 'OPPONENT_COUNTERED')
      ) {
        return {
          valid: false,
          reason: `Opponent ${targetId} does not have an open offer/counter-offer.`,
        };
      }
      const opponent = state.players[targetId]!;
      if (action.response === 'ACCEPT') {
        if (!hasResources(player.resources, branch.activeGives)) {
          return {
            valid: false,
            reason: 'You do not have the resources required for this trade.',
          };
        }
        if (!hasResources(opponent.resources, branch.opponentGives)) {
          return {
            valid: false,
            reason: `${targetId} does not have the resources required for this trade.`,
          };
        }
        return { valid: true };
      }
      if (action.response === 'COUNTER') {
        const counterGive = normalizeResourceBundle(action.counterGive);
        const counterRequest = normalizeResourceBundle(action.counterRequest);
        if (
          getTotalResourceCards(counterGive) <= 0 ||
          getTotalResourceCards(counterRequest) <= 0
        ) {
          return {
            valid: false,
            reason:
              'Counter-offer must include at least 1 resource offered and 1 resource requested.',
          };
        }
        if (!hasResources(player.resources, counterGive)) {
          return {
            valid: false,
            reason: 'You can only make proposals with resources you have.',
          };
        }
        return { valid: true };
      }
      if (action.response === 'DECLINE') {
        return { valid: true };
      }
      return { valid: false, reason: 'Invalid trade response.' };
    }
  }

  // Discarding on a 7 can be performed by any player who has >= 8 cards (pendingDiscards[playerId] > 0)
  if (action.type === 'CATAN_DISCARD_RESOURCES') {
    if (state.turnStep !== 'DISCARD_ON_SEVEN') {
      return {
        valid: false,
        reason: 'Not currently waiting for players to discard on a 7.',
      };
    }
    const required = state.pendingDiscards[playerId] ?? 0;
    if (required <= 0) {
      return {
        valid: false,
        reason: 'You do not need to discard any resource cards.',
      };
    }
    const discardBundle = normalizeResourceBundle(action.resources);
    const totalToDiscard = getTotalResourceCards(discardBundle);
    if (totalToDiscard !== required) {
      return {
        valid: false,
        reason: `You must discard exactly ${required} resource card(s) (half your hand rounded down).`,
      };
    }
    if (!hasResources(player.resources, discardBundle)) {
      return {
        valid: false,
        reason: 'You can only discard resource cards that you hold.',
      };
    }
    return { valid: true };
  }

  // All other actions require it to be `playerId`'s turn
  if (playerId !== activePlayerId) {
    return {
      valid: false,
      reason: `Out of turn: expected ${activePlayerId}, but ${playerId} attempted to act.`,
    };
  }

  if (state.activeTrade && action.type !== 'CATAN_CANCEL_TRADE') {
    return {
      valid: false,
      reason: 'Resolve or cancel the active trade negotiation before taking other actions.',
    };
  }

  switch (action.type) {
    case 'CATAN_CANCEL_TRADE':
      if (!state.activeTrade) {
        return { valid: false, reason: 'No active trade to cancel.' };
      }
      return { valid: true };

    case 'CATAN_ROLL_DICE':
      if (
        state.turnStep !== 'ROLL_DICE' &&
        state.turnStep !== 'ROLL_FOR_START'
      ) {
        return {
          valid: false,
          reason:
            state.turnStep.startsWith('SETUP_')
              ? 'Complete initial settlement and road placement before rolling production dice.'
              : 'Dice have already been rolled this turn.',
        };
      }
      return { valid: true };

    case 'CATAN_MOVE_ROBBER': {
      if (state.turnStep !== 'MOVE_ROBBER') {
        return {
          valid: false,
          reason: 'Not currently in the Move Robber step.',
        };
      }
      if (!state.board.hexes[action.targetHexId]) {
        return {
          valid: false,
          reason: `Target hex ${action.targetHexId} does not exist.`,
        };
      }
      if (action.targetHexId === state.board.robberHexId) {
        return {
          valid: false,
          reason: 'You must move the robber to a different hex.',
        };
      }
      return { valid: true };
    }

    case 'CATAN_SELECT_ROBBER_VICTIM': {
      if (state.turnStep !== 'SELECT_ROBBER_VICTIM') {
        return {
          valid: false,
          reason: 'Not currently selecting a player to steal from.',
        };
      }
      if (!state.robberEligibleVictimIds.includes(action.victimPlayerId)) {
        return {
          valid: false,
          reason: 'Selected player does not have a settlement or city on the robber hex.',
        };
      }
      return { valid: true };
    }

    case 'CATAN_STEAL_CARD': {
      if (state.turnStep !== 'STEAL_ROBBER_CARD') {
        return {
          valid: false,
          reason: 'Not currently picking a resource card to steal.',
        };
      }
      const count = state.robberShuffledVictimCards.length;
      if (
        !Number.isInteger(action.cardIndex) ||
        action.cardIndex < 0 ||
        action.cardIndex >= count
      ) {
        return {
          valid: false,
          reason: `Invalid card selection: choose a card index between 0 and ${count - 1}.`,
        };
      }
      return { valid: true };
    }

    case 'CATAN_PLACE_INITIAL_SETTLEMENT': {
      if (
        state.turnStep !== 'SETUP_SETTLEMENT_1' &&
        state.turnStep !== 'SETUP_SETTLEMENT_2'
      ) {
        return {
          valid: false,
          reason: 'Not currently in initial settlement placement step.',
        };
      }
      const validSpots = getValidInitialSettlementSpots(state.board);
      if (!validSpots.some((v) => v.id === action.vertexId)) {
        return {
          valid: false,
          reason:
            'Invalid starting settlement corner: must be on an unoccupied hex corner at least 2 segments away from all existing settlements.',
        };
      }
      return { valid: true };
    }

    case 'CATAN_PLACE_INITIAL_ROAD': {
      if (
        state.turnStep !== 'SETUP_ROAD_1' &&
        state.turnStep !== 'SETUP_ROAD_2'
      ) {
        return {
          valid: false,
          reason: 'Not currently in initial road placement step.',
        };
      }
      const validEdges = getValidRoadSpots(
        state.board,
        playerId,
        state.lastPlacedSettlementVertexId ?? undefined
      );
      if (!validEdges.some((e) => e.id === action.edgeId)) {
        return {
          valid: false,
          reason:
            'Initial road segment must connect directly to the settlement you just placed.',
        };
      }
      return { valid: true };
    }

    case 'CATAN_BUILD_ROAD': {
      // Allow CATAN_BUILD_ROAD to also work during SETUP_ROAD_1 / SETUP_ROAD_2 or free Road Building
      if (
        state.turnStep === 'SETUP_ROAD_1' ||
        state.turnStep === 'SETUP_ROAD_2'
      ) {
        const validEdges = getValidRoadSpots(
          state.board,
          playerId,
          state.lastPlacedSettlementVertexId ?? undefined
        );
        const targetId = action.edgeId ?? validEdges[0]?.id;
        if (!targetId || !validEdges.some((e) => e.id === targetId)) {
          return {
            valid: false,
            reason:
              'Initial road segment must connect directly to the settlement you just placed.',
          };
        }
        return { valid: true };
      }

      if (state.turnStep !== 'MAIN_PHASE' && state.freeRoadsRemaining <= 0) {
        return {
          valid: false,
          reason: 'You must roll the dice before building.',
        };
      }
      if (player.roadsRemaining <= 0) {
        return {
          valid: false,
          reason: 'No road segments remaining in supply (max 15).',
        };
      }
      if (
        state.freeRoadsRemaining <= 0 &&
        (player.resources.WOOD < 1 || player.resources.BRICK < 1)
      ) {
        return {
          valid: false,
          reason: 'Building a Road requires 1 WOOD + 1 BRICK.',
        };
      }
      const validEdges = getValidRoadSpots(state.board, playerId);
      if (action.edgeId && !validEdges.some((e) => e.id === action.edgeId)) {
        return {
          valid: false,
          reason:
            'Selected road edge is not connected to your road/settlement network or is already occupied.',
        };
      }
      if (validEdges.length === 0) {
        return {
          valid: false,
          reason: 'No valid connected road spots available on the board.',
        };
      }
      return { valid: true };
    }

    case 'CATAN_BUILD_SETTLEMENT': {
      // Support initial setup placement if dispatched as CATAN_BUILD_SETTLEMENT
      if (
        state.turnStep === 'SETUP_SETTLEMENT_1' ||
        state.turnStep === 'SETUP_SETTLEMENT_2'
      ) {
        const validSpots = getValidInitialSettlementSpots(state.board);
        const targetVertexId = action.vertexId ?? validSpots[0]?.id;
        if (!targetVertexId || !validSpots.some((v) => v.id === targetVertexId)) {
          return {
            valid: false,
            reason:
              'Settlement must be on a hex corner at least 2 segments away from existing settlements.',
          };
        }
        return { valid: true };
      }

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
      const validSpots = getValidSettlementSpots(state.board, playerId);
      if (action.vertexId) {
        if (!validSpots.some((v) => v.id === action.vertexId)) {
          return {
            valid: false,
            reason:
              'Settlement must be on an unoccupied corner connected to your road and at least 2 segments away from any other settlement.',
          };
        }
        return { valid: true };
      }
      if (action.hexId) {
        const hex = state.board.hexes[action.hexId];
        if (!hex) {
          return {
            valid: false,
            reason: `Hex ${action.hexId} does not exist.`,
          };
        }
        return { valid: true };
      }
      if (validSpots.length === 0) {
        return {
          valid: false,
          reason:
            'No valid corner spots connected to your roads (at least 2 segments away from other settlements).',
        };
      }
      return { valid: true };
    }

    case 'CATAN_START_UPGRADE_CITY': {
      if (state.turnStep !== 'MAIN_PHASE') {
        return {
          valid: false,
          reason: 'You must be in the main phase of your turn to upgrade a city.',
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
      const hasSettlement = Object.values(state.board.vertices).some(
        (v) => v.ownerId === playerId && v.building === 'settlement'
      );
      if (!hasSettlement) {
        return {
          valid: false,
          reason: 'You do not have any Settlements on the board to upgrade.',
        };
      }
      return { valid: true };
    }

    case 'CATAN_UPGRADE_CITY': {
      if (
        state.turnStep !== 'MAIN_PHASE' &&
        state.turnStep !== 'SELECT_CITY_UPGRADE'
      ) {
        return {
          valid: false,
          reason: 'You must roll the dice before upgrading a city.',
        };
      }
      if (player.citiesRemaining <= 0) {
        return { valid: false, reason: 'No cities remaining in supply.' };
      }
      if (
        !state.cityUpgradePaid &&
        (player.resources.WHEAT < 2 || player.resources.ORE < 3)
      ) {
        return {
          valid: false,
          reason: 'Upgrading to a City requires 2 WHEAT and 3 ORE.',
        };
      }
      const targetVertexId =
        action.vertexId ??
        (action.buildingId?.startsWith('BLD_')
          ? action.buildingId.slice(4)
          : action.buildingId);

      if (state.turnStep === 'SELECT_CITY_UPGRADE' && !targetVertexId) {
        return {
          valid: false,
          reason: 'Click on one of your Settlements on the board to upgrade it to a City.',
        };
      }

      const vertex = targetVertexId
        ? state.board.vertices[targetVertexId]
        : Object.values(state.board.vertices).find(
            (v) => v.ownerId === playerId && v.building === 'settlement'
          );
      if (
        !vertex ||
        vertex.ownerId !== playerId ||
        vertex.building !== 'settlement'
      ) {
        return {
          valid: false,
          reason: 'Select one of your existing Settlements to upgrade.',
        };
      }
      return { valid: true };
    }

    case 'CATAN_BUY_DEV_CARD': {
      if (state.turnStep !== 'MAIN_PHASE') {
        return {
          valid: false,
          reason: 'You must roll the dice before purchasing a Development Card.',
        };
      }
      if (state.devCardDeck.length === 0) {
        return {
          valid: false,
          reason:
            'The Development Card deck is exhausted (it is not reshuffled).',
        };
      }
      if (
        player.resources.WHEAT < 1 ||
        player.resources.ORE < 1 ||
        player.resources.SHEEP < 1
      ) {
        return {
          valid: false,
          reason:
            'Purchasing a Development Card requires 1 WHEAT, 1 ORE, and 1 SHEEP.',
        };
      }
      return { valid: true };
    }

    case 'CATAN_PLAY_KNIGHT': {
      if (
        state.turnStep !== 'ROLL_DICE' &&
        state.turnStep !== 'MAIN_PHASE'
      ) {
        return {
          valid: false,
          reason: 'Knight cards can only be played on your turn.',
        };
      }
      if (state.hasPlayedDevCardThisTurn) {
        return {
          valid: false,
          reason:
            'You may only play 1 Progress or Knight Development Card per turn.',
        };
      }
      const playableKnight = player.devCards.find(
        (c) => c.type === 'KNIGHT' && c.purchasedOnTurn < state.turnNumber
      );
      if (!playableKnight) {
        const boughtThisTurn = player.devCards.some(
          (c) => c.type === 'KNIGHT' && c.purchasedOnTurn === state.turnNumber
        );
        return {
          valid: false,
          reason: boughtThisTurn
            ? 'Knight cards cannot be played on the same turn they are purchased.'
            : 'You do not have a playable Knight card in hand.',
        };
      }
      if (action.targetHexId) {
        if (!state.board.hexes[action.targetHexId]) {
          return {
            valid: false,
            reason: `Target hex ${action.targetHexId} does not exist.`,
          };
        }
        if (action.targetHexId === state.board.robberHexId) {
          return {
            valid: false,
            reason: 'You must move the robber to a different hex.',
          };
        }
      }
      return { valid: true };
    }

    case 'CATAN_PLAY_MONOPOLY': {
      if (
        state.turnStep !== 'ROLL_DICE' &&
        state.turnStep !== 'MAIN_PHASE'
      ) {
        return {
          valid: false,
          reason: 'Progress cards can only be played on your turn.',
        };
      }
      if (state.hasPlayedDevCardThisTurn) {
        return {
          valid: false,
          reason:
            'You may only play 1 Progress or Knight Development Card per turn.',
        };
      }
      const playable = player.devCards.find(
        (c) => c.type === 'MONOPOLY' && c.purchasedOnTurn < state.turnNumber
      );
      if (!playable) {
        return {
          valid: false,
          reason:
            'You do not have a playable Monopoly card (Progress cards cannot be played the turn they are purchased).',
        };
      }
      if (!ALL_CATAN_RESOURCES.includes(action.resource)) {
        return { valid: false, reason: 'Specify a valid resource for Monopoly.' };
      }
      return { valid: true };
    }

    case 'CATAN_PLAY_YEAR_OF_PLENTY': {
      if (
        state.turnStep !== 'ROLL_DICE' &&
        state.turnStep !== 'MAIN_PHASE'
      ) {
        return {
          valid: false,
          reason: 'Progress cards can only be played on your turn.',
        };
      }
      if (state.hasPlayedDevCardThisTurn) {
        return {
          valid: false,
          reason:
            'You may only play 1 Progress or Knight Development Card per turn.',
        };
      }
      const playable = player.devCards.find(
        (c) =>
          c.type === 'YEAR_OF_PLENTY' && c.purchasedOnTurn < state.turnNumber
      );
      if (!playable) {
        return {
          valid: false,
          reason:
            'You do not have a playable Year of Plenty card (Progress cards cannot be played the turn they are purchased).',
        };
      }
      if (
        !ALL_CATAN_RESOURCES.includes(action.resource1) ||
        !ALL_CATAN_RESOURCES.includes(action.resource2)
      ) {
        return {
          valid: false,
          reason: 'Select 2 valid resources from the bank.',
        };
      }
      return { valid: true };
    }

    case 'CATAN_PLAY_ROAD_BUILDING': {
      if (
        state.turnStep !== 'ROLL_DICE' &&
        state.turnStep !== 'MAIN_PHASE'
      ) {
        return {
          valid: false,
          reason: 'Progress cards can only be played on your turn.',
        };
      }
      if (state.hasPlayedDevCardThisTurn) {
        return {
          valid: false,
          reason:
            'You may only play 1 Progress or Knight Development Card per turn.',
        };
      }
      const playable = player.devCards.find(
        (c) =>
          c.type === 'ROAD_BUILDING' && c.purchasedOnTurn < state.turnNumber
      );
      if (!playable) {
        return {
          valid: false,
          reason:
            'You do not have a playable Road Building card (Progress cards cannot be played the turn they are purchased).',
        };
      }
      return { valid: true };
    }

    case 'CATAN_PLAY_VP_CARD': {
      if (
        state.turnStep !== 'ROLL_DICE' &&
        state.turnStep !== 'MAIN_PHASE'
      ) {
        return {
          valid: false,
          reason: 'Victory Point cards can only be played on your turn.',
        };
      }
      const vpCards = player.devCards.filter(
        (c) => c.category === 'VICTORY_POINT'
      );
      if (vpCards.length === 0) {
        return {
          valid: false,
          reason: 'You do not have any Victory Point Development Cards.',
        };
      }
      const totalPotentialVP =
        player.victoryPoints + vpCards.reduce((s, c) => s + c.vp, 0);
      if (totalPotentialVP < 10) {
        return {
          valid: false,
          reason: `Victory Point cards can only be played if playing them triggers the end of the game (10 VP). You would have ${totalPotentialVP} VP.`,
        };
      }
      return { valid: true };
    }

    case 'CATAN_MARITIME_TRADE': {
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
      const rate = getPlayerMaritimeTradeRate(
        state.board,
        playerId,
        action.give
      );
      if (player.resources[action.give] < rate) {
        return {
          valid: false,
          reason: `${rate}:1 Maritime Trade requires at least ${rate} ${action.give} (you have ${player.resources[action.give]}).`,
        };
      }
      return { valid: true };
    }

    case 'CATAN_PROPOSE_TRADE': {
      if (state.turnStep !== 'MAIN_PHASE') {
        return {
          valid: false,
          reason: 'You must roll the dice before proposing a trade.',
        };
      }
      const offered = normalizeResourceBundle(action.offered);
      const requested = normalizeResourceBundle(action.requested);
      if (
        getTotalResourceCards(offered) <= 0 ||
        getTotalResourceCards(requested) <= 0
      ) {
        return {
          valid: false,
          reason:
            'Trade proposal must offer at least 1 resource and request at least 1 resource.',
        };
      }
      if (!hasResources(player.resources, offered)) {
        return {
          valid: false,
          reason: 'Players can only make proposals with resources they have.',
        };
      }
      return { valid: true };
    }

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

// ============================================================================
// State Transitions (`applyCatanAction`)
// ============================================================================

function formatResourceBundle(
  bundle: Readonly<Record<CatanResource, number>>
): string {
  const parts: string[] = [];
  for (const r of ALL_CATAN_RESOURCES) {
    if ((bundle[r] ?? 0) > 0) {
      parts.push(`${bundle[r]} ${r}`);
    }
  }
  return parts.length > 0 ? parts.join(' + ') : 'nothing';
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
    case 'CATAN_PLACE_INITIAL_SETTLEMENT':
    case 'CATAN_BUILD_SETTLEMENT': {
      // Check if we are in Snake Draft Setup (1st or 2nd settlement)
      if (
        state.turnStep === 'SETUP_SETTLEMENT_1' ||
        state.turnStep === 'SETUP_SETTLEMENT_2'
      ) {
        const validSpots = getValidInitialSettlementSpots(state.board);
        const vertexId =
          ('vertexId' in action && action.vertexId) || validSpots[0]!.id;
        const board = cloneBoard(state.board);
        const vertex = board.vertices[vertexId]!;
        vertex.building = 'settlement';
        vertex.ownerId = playerId;

        const isSecondSettlement = state.turnStep === 'SETUP_SETTLEMENT_2';
        const updatedResources = { ...player.resources };
        const gainedList: string[] = [];

        // Starting resources: 1 of each resource produced by the adjoining hexes of the 2nd settlement placed
        if (isSecondSettlement) {
          for (const hexId of vertex.touchingHexIds) {
            const hex = board.hexes[hexId];
            if (hex) {
              const res = terrainToResource(hex.terrain);
              if (res) {
                updatedResources[res] += 1;
                gainedList.push(`1 ${res}`);
              }
            }
          }
        }

        const nextStep: CatanTurnStep = isSecondSettlement
          ? 'SETUP_ROAD_2'
          : 'SETUP_ROAD_1';

        const nextState: CatanGameState = {
          ...state,
          board,
          turnStep: nextStep,
          lastPlacedSettlementVertexId: vertexId,
          players: {
            ...state.players,
            [playerId]: {
              ...player,
              resources: updatedResources,
            },
          },
          lastActionSummary: isSecondSettlement
            ? `${playerId} placed their 2nd Settlement on corner (${vertexId})${
                gainedList.length > 0
                  ? ` and received starting resources: ${gainedList.join(', ')}`
                  : ''
              }. Now select an adjoining edge to place your 2nd Road.`
            : `${playerId} placed their 1st Settlement on corner (${vertexId}). Now select an adjoining edge to place your 1st Road.`,
        };

        return recalculateAwardsAndVictoryPoints(nextState);
      }

      // Main Phase Settlement Building
      const validSpots = getValidSettlementSpots(state.board, playerId);
      let chosenVertexId = action.type === 'CATAN_BUILD_SETTLEMENT' ? action.vertexId : undefined;
      if (
        !chosenVertexId &&
        action.type === 'CATAN_BUILD_SETTLEMENT' &&
        action.hexId
      ) {
        const hex = state.board.hexes[action.hexId];
        if (hex) {
          chosenVertexId =
            hex.vertexIds.find((vid) =>
              validSpots.some((s) => s.id === vid)
            ) ??
            hex.vertexIds.find((vid) =>
              getValidInitialSettlementSpots(state.board).some(
                (s) => s.id === vid
              )
            );
        }
      }
      if (!chosenVertexId) {
        chosenVertexId = validSpots[0]?.id;
      }

      const board = cloneBoard(state.board);
      if (chosenVertexId && board.vertices[chosenVertexId]) {
        board.vertices[chosenVertexId]!.building = 'settlement';
        board.vertices[chosenVertexId]!.ownerId = playerId;
      }

      const updatedPlayer: CatanPlayerState = {
        ...player,
        resources: {
          ...player.resources,
          WOOD: player.resources.WOOD - 1,
          BRICK: player.resources.BRICK - 1,
          SHEEP: player.resources.SHEEP - 1,
          WHEAT: player.resources.WHEAT - 1,
        },
      };

      const nextState = recalculateAwardsAndVictoryPoints({
        ...state,
        board,
        players: {
          ...state.players,
          [playerId]: updatedPlayer,
        },
      });
      const newVP = nextState.players[playerId]!.victoryPoints;
      const isWon = nextState.phase === 'GAME_OVER';

      return {
        ...nextState,
        lastActionSummary: `${playerId} built a Settlement on corner ${chosenVertexId} (+1 VP → ${newVP} VP)${
          isWon ? ' — VICTORY!' : '.'
        }`,
      };
    }

    case 'CATAN_PLACE_INITIAL_ROAD':
    case 'CATAN_BUILD_ROAD': {
      // Snake draft road placement
      if (
        state.turnStep === 'SETUP_ROAD_1' ||
        state.turnStep === 'SETUP_ROAD_2'
      ) {
        const validEdges = getValidRoadSpots(
          state.board,
          playerId,
          state.lastPlacedSettlementVertexId ?? undefined
        );
        const edgeId = action.edgeId ?? validEdges[0]!.id;
        const board = cloneBoard(state.board);
        board.edges[edgeId]!.ownerId = playerId;

        const isFirstRound = state.turnStep === 'SETUP_ROAD_1';
        let nextActiveIndex = state.activePlayerIndex;
        let nextTurnStep: CatanTurnStep = state.turnStep;
        let summarySuffix = '';

        if (isFirstRound) {
          if (state.activePlayerIndex < state.playerOrder.length - 1) {
            // Advance clockwise to next player for 1st settlement
            nextActiveIndex = state.activePlayerIndex + 1;
            nextTurnStep = 'SETUP_SETTLEMENT_1';
            const nextPid = state.playerOrder[nextActiveIndex]!;
            summarySuffix = `Next up: ${nextPid} places their 1st Settlement.`;
          } else {
            // Last player just placed their 1st road -> stays active to place 2nd settlement (reverse order!)
            nextActiveIndex = state.activePlayerIndex;
            nextTurnStep = 'SETUP_SETTLEMENT_2';
            summarySuffix = `Reverse turn order begins! ${playerId} now places their 2nd Settlement.`;
          }
        } else {
          // Second round (reverse order back to index 0)
          if (state.activePlayerIndex > 0) {
            nextActiveIndex = state.activePlayerIndex - 1;
            nextTurnStep = 'SETUP_SETTLEMENT_2';
            const nextPid = state.playerOrder[nextActiveIndex]!;
            summarySuffix = `Next in reverse order: ${nextPid} places their 2nd Settlement.`;
          } else {
            // Starting player (index 0) has placed their 2nd road! Setup complete!
            nextActiveIndex = 0;
            nextTurnStep = 'ROLL_DICE';
            summarySuffix = `Initial setup complete! ${playerId} rolls the production dice to begin Turn 1.`;
          }
        }

        const nextState = recalculateAwardsAndVictoryPoints({
          ...state,
          board,
          activePlayerIndex: nextActiveIndex,
          turnStep: nextTurnStep,
          lastPlacedSettlementVertexId: null,
          lastActionSummary: `${playerId} placed a Road segment on edge (${edgeId}). ${summarySuffix}`,
        });

        return nextState;
      }

      // Main Phase (or free Road Building) Road Placement
      const validEdges = getValidRoadSpots(state.board, playerId);
      const edgeId = action.edgeId ?? validEdges[0]!.id;
      const board = cloneBoard(state.board);
      if (edgeId && board.edges[edgeId]) {
        board.edges[edgeId]!.ownerId = playerId;
      }

      const usedFreeRoad = state.freeRoadsRemaining > 0;
      const updatedPlayer: CatanPlayerState = {
        ...player,
        resources: usedFreeRoad
          ? player.resources
          : {
              ...player.resources,
              WOOD: player.resources.WOOD - 1,
              BRICK: player.resources.BRICK - 1,
            },
        roadsBuilt: player.roadsBuilt + 1,
      };

      const nextState = recalculateAwardsAndVictoryPoints({
        ...state,
        board,
        freeRoadsRemaining: usedFreeRoad
          ? state.freeRoadsRemaining - 1
          : state.freeRoadsRemaining,
        players: {
          ...state.players,
          [playerId]: updatedPlayer,
        },
      });

      const updatedP = nextState.players[playerId]!;
      return {
        ...nextState,
        lastActionSummary: `${playerId} built a Road on edge (${edgeId}) (Longest continuous road: ${updatedP.longestRoadLength}, remaining roads: ${updatedP.roadsRemaining}).`,
      };
    }

    case 'CATAN_ROLL_DICE': {
      const d1 = nextInt(state.prng, 1, 6);
      const d2 = nextInt(d1.prng, 1, 6);
      const d1Val = d1.value;
      const d2Val = d2.value;
      const sum = d1Val + d2Val;
      const nextPrng = d2.prng;

      const nextPlayers: Record<string, CatanPlayerState> = {
        ...state.players,
      };
      const productionNotes: string[] = [];

      if (sum !== 7) {
        for (const hex of Object.values(state.board.hexes)) {
          if (
            hex.numberToken === sum &&
            !hex.hasRobber &&
            hex.terrain !== 'desert'
          ) {
            const resource = terrainToResource(hex.terrain);
            if (!resource) continue;

            for (const vid of hex.vertexIds) {
              const vertex = state.board.vertices[vid];
              if (vertex && vertex.ownerId && vertex.building) {
                const yieldAmount = vertex.building === 'city' ? 2 : 1;
                const owner = nextPlayers[vertex.ownerId]!;
                nextPlayers[vertex.ownerId] = {
                  ...owner,
                  resources: {
                    ...owner.resources,
                    [resource]: owner.resources[resource] + yieldAmount,
                  },
                };
                productionNotes.push(
                  `${vertex.ownerId} +${yieldAmount} ${resource}`
                );
              }
            }
          }
        }

        const prodText =
          productionNotes.length > 0
            ? `Produced: ${productionNotes.join(', ')}.`
            : 'No settlements on matching hexes.';

        return {
          ...state,
          prng: nextPrng,
          turnStep: 'MAIN_PHASE',
          lastDiceRoll: [d1Val, d2Val],
          players: nextPlayers,
          lastActionSummary: `${playerId} rolled 🎲 ${d1Val} + ${d2Val} = ${sum}. ${prodText}`,
        };
      }

      // Rolled a 7! Check if any player has 8 or more resource cards
      const pendingDiscards: Record<string, number> = {};
      for (const pid of state.playerOrder) {
        const totalCards = getTotalResourceCards(nextPlayers[pid]!.resources);
        if (totalCards >= 8) {
          pendingDiscards[pid] = Math.floor(totalCards / 2);
        }
      }

      const hasPendingDiscards = Object.keys(pendingDiscards).length > 0;
      const nextStep: CatanTurnStep = hasPendingDiscards
        ? 'DISCARD_ON_SEVEN'
        : 'MOVE_ROBBER';

      const discardNote = hasPendingDiscards
        ? `Players with 8+ cards must discard half rounding down (${Object.entries(
            pendingDiscards
          )
            .map(([pid, cnt]) => `${pid}: ${cnt}`)
            .join(', ')}), then ${playerId} moves the Robber.`
        : `${playerId}, select a hex on the board to move the Robber!`;

      return {
        ...state,
        prng: nextPrng,
        turnStep: nextStep,
        pendingDiscards,
        robberReturnStep: 'MAIN_PHASE',
        robberEligibleVictimIds: [],
        robberVictimId: null,
        robberShuffledVictimCards: [],
        lastDiceRoll: [d1Val, d2Val],
        players: nextPlayers,
        lastActionSummary: `${playerId} rolled 🎲 ${d1Val} + ${d2Val} = 7! ${discardNote}`,
      };
    }

    case 'CATAN_DISCARD_RESOURCES': {
      const discardBundle = normalizeResourceBundle(action.resources);
      const updatedResources = { ...player.resources };
      for (const r of ALL_CATAN_RESOURCES) {
        updatedResources[r] -= discardBundle[r];
      }

      const nextPendingDiscards: Record<string, number> = {
        ...state.pendingDiscards,
      };
      delete nextPendingDiscards[playerId];

      const allDiscarded = Object.keys(nextPendingDiscards).length === 0;
      const activePlayerId = state.playerOrder[state.activePlayerIndex]!;

      return {
        ...state,
        turnStep: allDiscarded ? 'MOVE_ROBBER' : 'DISCARD_ON_SEVEN',
        pendingDiscards: nextPendingDiscards,
        players: {
          ...state.players,
          [playerId]: {
            ...player,
            resources: updatedResources,
          },
        },
        lastActionSummary: allDiscarded
          ? `${playerId} discarded ${formatResourceBundle(
              discardBundle
            )}. All discards complete! ${activePlayerId}, select a hex to move the Robber.`
          : `${playerId} discarded ${formatResourceBundle(
              discardBundle
            )}. Waiting on remaining players to discard.`,
      };
    }

    case 'CATAN_MOVE_ROBBER': {
      const board = cloneBoard(state.board);
      const targetHexId = action.targetHexId;
      for (const h of Object.values(board.hexes)) {
        h.hasRobber = h.id === targetHexId;
      }
      board.robberHexId = targetHexId;

      const targetHex = board.hexes[targetHexId]!;
      const adjacentOpponents: string[] = [];
      for (const vid of targetHex.vertexIds) {
        const ownerId = board.vertices[vid]?.ownerId;
        if (
          ownerId &&
          ownerId !== playerId &&
          !adjacentOpponents.includes(ownerId)
        ) {
          adjacentOpponents.push(ownerId);
        }
      }

      const { hexes, buildings } = syncLegacyHexesAndBuildings(board);

      if (adjacentOpponents.length > 0) {
        return {
          ...state,
          board,
          hexes,
          buildings,
          turnStep: 'SELECT_ROBBER_VICTIM',
          robberEligibleVictimIds: adjacentOpponents,
          robberVictimId: null,
          robberShuffledVictimCards: [],
          lastActionSummary: `${playerId} moved the Robber to hex (${targetHexId}). Select a player with a settlement or city on that hex (${adjacentOpponents.join(
            ', '
          )}) to steal from!`,
        };
      }

      return {
        ...state,
        board,
        hexes,
        buildings,
        turnStep: state.robberReturnStep,
        robberEligibleVictimIds: [],
        robberVictimId: null,
        robberShuffledVictimCards: [],
        lastActionSummary: `${playerId} moved the Robber to hex (${targetHexId}) (no opponent settlements/cities on that hex).`,
      };
    }

    case 'CATAN_SELECT_ROBBER_VICTIM': {
      const victimId = action.victimPlayerId;
      const victim = state.players[victimId]!;
      const pool: CatanResource[] = [];
      for (const r of ALL_CATAN_RESOURCES) {
        for (let i = 0; i < victim.resources[r]; i++) {
          pool.push(r);
        }
      }

      if (pool.length === 0) {
        return {
          ...state,
          turnStep: state.robberReturnStep,
          robberEligibleVictimIds: [],
          robberVictimId: null,
          robberShuffledVictimCards: [],
          lastActionSummary: `${playerId} selected ${victimId}, who has 0 resource cards to steal.`,
        };
      }

      const rng = createSeededRng(
        `${state.board.seed}_ROBBER_SHUFFLE_${state.turnNumber}_${victimId}_${pool.length}`
      );
      const shuffledCards = shuffleWithRng(pool, rng);

      return {
        ...state,
        turnStep: 'STEAL_ROBBER_CARD',
        robberVictimId: victimId,
        robberShuffledVictimCards: shuffledCards,
        lastActionSummary: `${victimId}'s ${shuffledCards.length} resource card(s) have been shuffled! ${playerId}, pick 1 card to steal.`,
      };
    }

    case 'CATAN_STEAL_CARD': {
      const victimId = state.robberVictimId!;
      const victim = state.players[victimId]!;
      const stolenRes = state.robberShuffledVictimCards[action.cardIndex]!;

      const nextPlayers: Record<string, CatanPlayerState> = {
        ...state.players,
        [victimId]: {
          ...victim,
          resources: {
            ...victim.resources,
            [stolenRes]: victim.resources[stolenRes] - 1,
          },
        },
        [playerId]: {
          ...player,
          resources: {
            ...player.resources,
            [stolenRes]: player.resources[stolenRes] + 1,
          },
        },
      };

      return {
        ...state,
        turnStep: state.robberReturnStep,
        robberEligibleVictimIds: [],
        robberVictimId: null,
        robberShuffledVictimCards: [],
        players: nextPlayers,
        lastActionSummary: `${playerId} picked card #${
          action.cardIndex + 1
        } from ${victimId}'s ${
          state.robberShuffledVictimCards.length
        } shuffled card(s) and stole 1 resource card!`,
      };
    }

    case 'CATAN_START_UPGRADE_CITY': {
      const updatedPlayer: CatanPlayerState = {
        ...player,
        resources: {
          ...player.resources,
          WHEAT: player.resources.WHEAT - 2,
          ORE: player.resources.ORE - 3,
        },
      };

      return {
        ...state,
        turnStep: 'SELECT_CITY_UPGRADE',
        cityUpgradePaid: true,
        players: {
          ...state.players,
          [playerId]: updatedPlayer,
        },
        lastActionSummary: `${playerId} paid 2 WHEAT + 3 ORE to upgrade a City. Click one of your Settlements on the board to upgrade it!`,
      };
    }

    case 'CATAN_UPGRADE_CITY': {
      const explicitTargetId =
        action.vertexId ??
        (action.buildingId?.startsWith('BLD_')
          ? action.buildingId.slice(4)
          : action.buildingId);

      // If in MAIN_PHASE and no vertexId/buildingId was provided yet, take payment first and prompt the player to click their settlement on the board!
      if (state.turnStep === 'MAIN_PHASE' && !explicitTargetId) {
        const updatedPlayer: CatanPlayerState = {
          ...player,
          resources: {
            ...player.resources,
            WHEAT: player.resources.WHEAT - 2,
            ORE: player.resources.ORE - 3,
          },
        };

        return {
          ...state,
          turnStep: 'SELECT_CITY_UPGRADE',
          cityUpgradePaid: true,
          players: {
            ...state.players,
            [playerId]: updatedPlayer,
          },
          lastActionSummary: `${playerId} paid 2 WHEAT + 3 ORE to upgrade a City. Click one of your Settlements on the board to upgrade it!`,
        };
      }

      const targetVertexId =
        explicitTargetId ??
        Object.values(state.board.vertices).find(
          (v) => v.ownerId === playerId && v.building === 'settlement'
        )?.id;

      const board = cloneBoard(state.board);
      if (targetVertexId && board.vertices[targetVertexId]) {
        board.vertices[targetVertexId]!.building = 'city';
      }

      const updatedPlayer: CatanPlayerState = state.cityUpgradePaid
        ? player
        : {
            ...player,
            resources: {
              ...player.resources,
              WHEAT: player.resources.WHEAT - 2,
              ORE: player.resources.ORE - 3,
            },
          };

      const nextState = recalculateAwardsAndVictoryPoints({
        ...state,
        board,
        turnStep: 'MAIN_PHASE',
        cityUpgradePaid: false,
        players: {
          ...state.players,
          [playerId]: updatedPlayer,
        },
      });
      const newVP = nextState.players[playerId]!.victoryPoints;
      const isWon = nextState.phase === 'GAME_OVER';

      return {
        ...nextState,
        lastActionSummary: `${playerId} upgraded corner ${targetVertexId} to a City (+1 VP → ${newVP} VP)${
          isWon ? ' — VICTORY!' : '.'
        }`,
      };
    }

    case 'CATAN_BUY_DEV_CARD': {
      const [drawnCard, ...remainingDeck] = state.devCardDeck;
      const cardWithTurn: CatanDevCardInstance = {
        ...drawnCard!,
        purchasedOnTurn: state.turnNumber,
      };

      const updatedPlayer: CatanPlayerState = {
        ...player,
        resources: {
          ...player.resources,
          WHEAT: player.resources.WHEAT - 1,
          ORE: player.resources.ORE - 1,
          SHEEP: player.resources.SHEEP - 1,
        },
        devCards: [...player.devCards, cardWithTurn],
      };

      return {
        ...state,
        devCardDeck: remainingDeck,
        players: {
          ...state.players,
          [playerId]: updatedPlayer,
        },
        lastActionSummary: `${playerId} purchased a Development Card (${remainingDeck.length} remaining in deck).`,
      };
    }

    case 'CATAN_PLAY_KNIGHT': {
      const cardIdx = player.devCards.findIndex(
        (c) => c.type === 'KNIGHT' && c.purchasedOnTurn < state.turnNumber
      );
      const nextDevCards = player.devCards.filter((_, i) => i !== cardIdx);
      const returnStep: 'ROLL_DICE' | 'MAIN_PHASE' =
        state.turnStep === 'ROLL_DICE' ? 'ROLL_DICE' : 'MAIN_PHASE';

      const board = cloneBoard(state.board);
      // Determine target robber hex
      const targetHexId =
        action.targetHexId && action.targetHexId !== board.robberHexId
          ? action.targetHexId
          : Object.keys(board.hexes).find((id) => id !== board.robberHexId)!;

      for (const h of Object.values(board.hexes)) {
        h.hasRobber = h.id === targetHexId;
      }
      board.robberHexId = targetHexId;

      const targetHex = board.hexes[targetHexId]!;
      const adjacentOpponents: string[] = [];
      for (const vid of targetHex.vertexIds) {
        const ownerId = board.vertices[vid]?.ownerId;
        if (
          ownerId &&
          ownerId !== playerId &&
          !adjacentOpponents.includes(ownerId)
        ) {
          adjacentOpponents.push(ownerId);
        }
      }

      const nextPlayers: Record<string, CatanPlayerState> = {
        ...state.players,
        [playerId]: {
          ...player,
          devCards: nextDevCards,
          faceUpKnights: player.faceUpKnights + 1,
        },
      };

      const nextState = recalculateAwardsAndVictoryPoints({
        ...state,
        board,
        hasPlayedDevCardThisTurn: true,
        robberReturnStep: returnStep,
        players: nextPlayers,
      });

      const newKnights = nextState.players[playerId]!.faceUpKnights;
      const armyNote =
        nextState.largestArmyOwnerId === playerId &&
        state.largestArmyOwnerId !== playerId
          ? ` — ${playerId} claims Largest Army (+2 VP)!`
          : '';

      // If no targetHexId was passed in action, enter MOVE_ROBBER so the player can select the hex on the board (unless no opponents have cards anywhere on default hex)
      if (!action.targetHexId) {
        // Check if any opponent on targetHexId has resource cards; if so, prompt victim selection
        const opponentsWithCards = adjacentOpponents.filter(
          (oid) => getTotalResourceCards(state.players[oid]!.resources) > 0
        );
        if (opponentsWithCards.length > 0) {
          return {
            ...nextState,
            turnStep: 'SELECT_ROBBER_VICTIM',
            robberEligibleVictimIds: adjacentOpponents,
            robberVictimId: null,
            robberShuffledVictimCards: [],
            lastActionSummary: `${playerId} played a Knight (${newKnights} face-up), moved the Robber to hex (${targetHexId})${armyNote}. Select a player on that hex to steal from!`,
          };
        }
        return {
          ...nextState,
          turnStep: returnStep,
          robberEligibleVictimIds: [],
          robberVictimId: null,
          robberShuffledVictimCards: [],
          lastActionSummary: `${playerId} played a Knight (${newKnights} face-up), moved the Robber to hex (${targetHexId})${armyNote}`,
        };
      }

      if (
        action.victimPlayerId &&
        adjacentOpponents.includes(action.victimPlayerId)
      ) {
        const victim = state.players[action.victimPlayerId]!;
        const pool: CatanResource[] = [];
        for (const r of ALL_CATAN_RESOURCES) {
          for (let i = 0; i < victim.resources[r]; i++) {
            pool.push(r);
          }
        }
        if (pool.length > 0) {
          const rng = createSeededRng(
            `${state.board.seed}_KNIGHT_${state.turnNumber}_${player.faceUpKnights}`
          );
          const shuffledCards = shuffleWithRng(pool, rng);
          return {
            ...nextState,
            turnStep: 'STEAL_ROBBER_CARD',
            robberEligibleVictimIds: adjacentOpponents,
            robberVictimId: action.victimPlayerId,
            robberShuffledVictimCards: shuffledCards,
            lastActionSummary: `${playerId} played a Knight (${newKnights} face-up), moved the Robber to hex (${targetHexId})${armyNote}, and selected ${action.victimPlayerId} (${shuffledCards.length} shuffled cards)!`,
          };
        }
      }

      if (adjacentOpponents.length > 0) {
        return {
          ...nextState,
          turnStep: 'SELECT_ROBBER_VICTIM',
          robberEligibleVictimIds: adjacentOpponents,
          robberVictimId: null,
          robberShuffledVictimCards: [],
          lastActionSummary: `${playerId} played a Knight (${newKnights} face-up), moved the Robber to hex (${targetHexId})${armyNote}. Select a player on that hex (${adjacentOpponents.join(
            ', '
          )}) to steal from!`,
        };
      }

      return {
        ...nextState,
        turnStep: returnStep,
        robberEligibleVictimIds: [],
        robberVictimId: null,
        robberShuffledVictimCards: [],
        lastActionSummary: `${playerId} played a Knight (${newKnights} face-up), moved the Robber to hex (${targetHexId})${armyNote}`,
      };
    }

    case 'CATAN_PLAY_MONOPOLY': {
      const cardIdx = player.devCards.findIndex(
        (c) => c.type === 'MONOPOLY' && c.purchasedOnTurn < state.turnNumber
      );
      const nextDevCards = player.devCards.filter((_, i) => i !== cardIdx);
      const targetRes = action.resource;

      let totalClaimed = 0;
      const nextPlayers: Record<string, CatanPlayerState> = {};

      for (const pid of state.playerOrder) {
        if (pid === playerId) continue;
        const opp = state.players[pid]!;
        const count = opp.resources[targetRes];
        totalClaimed += count;
        nextPlayers[pid] = {
          ...opp,
          resources: {
            ...opp.resources,
            [targetRes]: 0,
          },
        };
      }

      nextPlayers[playerId] = {
        ...player,
        devCards: nextDevCards,
        resources: {
          ...player.resources,
          [targetRes]: player.resources[targetRes] + totalClaimed,
        },
      };

      return {
        ...state,
        hasPlayedDevCardThisTurn: true,
        players: nextPlayers,
        lastActionSummary: `${playerId} played Monopoly on ${targetRes} and collected ${totalClaimed} ${targetRes} from all other players!`,
      };
    }

    case 'CATAN_PLAY_YEAR_OF_PLENTY': {
      const cardIdx = player.devCards.findIndex(
        (c) =>
          c.type === 'YEAR_OF_PLENTY' && c.purchasedOnTurn < state.turnNumber
      );
      const nextDevCards = player.devCards.filter((_, i) => i !== cardIdx);

      const updatedResources = { ...player.resources };
      updatedResources[action.resource1] += 1;
      updatedResources[action.resource2] += 1;

      return {
        ...state,
        hasPlayedDevCardThisTurn: true,
        players: {
          ...state.players,
          [playerId]: {
            ...player,
            devCards: nextDevCards,
            resources: updatedResources,
          },
        },
        lastActionSummary: `${playerId} played Year of Plenty and took 1 ${action.resource1} + 1 ${action.resource2} from the bank.`,
      };
    }

    case 'CATAN_PLAY_ROAD_BUILDING': {
      const cardIdx = player.devCards.findIndex(
        (c) =>
          c.type === 'ROAD_BUILDING' && c.purchasedOnTurn < state.turnNumber
      );
      const nextDevCards = player.devCards.filter((_, i) => i !== cardIdx);
      const board = cloneBoard(state.board);

      let placedCount = 0;
      if (action.edgeIds && action.edgeIds.length > 0) {
        for (const eid of action.edgeIds.slice(0, 2)) {
          const validNow = getValidRoadSpots(board, playerId);
          if (
            validNow.some((e) => e.id === eid) &&
            player.roadsRemaining - placedCount > 0
          ) {
            board.edges[eid]!.ownerId = playerId;
            placedCount++;
          }
        }
      }

      const remainingFree = Math.max(0, 2 - placedCount);
      const nextState = recalculateAwardsAndVictoryPoints({
        ...state,
        board,
        hasPlayedDevCardThisTurn: true,
        freeRoadsRemaining: state.freeRoadsRemaining + remainingFree,
        players: {
          ...state.players,
          [playerId]: {
            ...player,
            devCards: nextDevCards,
            roadsBuilt: player.roadsBuilt + placedCount,
          },
        },
      });

      return {
        ...nextState,
        lastActionSummary:
          placedCount === 2
            ? `${playerId} played Road Building and placed 2 free roads!`
            : `${playerId} played Road Building (${remainingFree} free road placement(s) ready).`,
      };
    }

    case 'CATAN_PLAY_VP_CARD': {
      const vpCards = player.devCards.filter(
        (c) => c.category === 'VICTORY_POINT'
      );
      const remainingDevCards = player.devCards.filter(
        (c) => c.category !== 'VICTORY_POINT'
      );

      const nextState = recalculateAwardsAndVictoryPoints({
        ...state,
        players: {
          ...state.players,
          [playerId]: {
            ...player,
            devCards: remainingDevCards,
            playedVictoryCards: [...player.playedVictoryCards, ...vpCards],
          },
        },
      });

      const revealedNames = vpCards.map((c) => c.name).join(', ');
      const finalVP = nextState.players[playerId]!.victoryPoints;

      return {
        ...nextState,
        phase: 'GAME_OVER',
        lastActionSummary: `${playerId} revealed Victory Point card(s): ${revealedNames} to reach ${finalVP} VP — VICTORY!`,
      };
    }

    case 'CATAN_MARITIME_TRADE': {
      const rate = getPlayerMaritimeTradeRate(
        state.board,
        playerId,
        action.give
      );
      const updatedPlayer: CatanPlayerState = {
        ...player,
        resources: {
          ...player.resources,
          [action.give]: player.resources[action.give] - rate,
          [action.receive]: player.resources[action.receive] + 1,
        },
      };

      return {
        ...state,
        players: {
          ...state.players,
          [playerId]: updatedPlayer,
        },
        lastActionSummary: `${playerId} traded ${rate} ${action.give} for 1 ${action.receive} (${rate}:1 Maritime Trade).`,
      };
    }

    case 'CATAN_PROPOSE_TRADE': {
      const offered = normalizeResourceBundle(action.offered);
      const requested = normalizeResourceBundle(action.requested);
      const branches: Record<string, CatanTradeBranch> = {};

      for (const pid of state.playerOrder) {
        if (pid === playerId) continue;
        branches[pid] = {
          opponentId: pid,
          status: 'AWAITING_OPPONENT',
          activeGives: offered,
          opponentGives: requested,
          lastProposedBy: playerId,
        };
      }

      const activeTrade: CatanActiveTrade = {
        initiatorId: playerId,
        phase: 'AWAITING_OPPONENTS',
        initialOffered: offered,
        initialRequested: requested,
        branches,
      };

      return {
        ...state,
        activeTrade,
        lastActionSummary: `${playerId} proposed a trade: offering ${formatResourceBundle(
          offered
        )} for ${formatResourceBundle(requested)}. Waiting for other players to Accept, Counter, or Decline.`,
      };
    }

    case 'CATAN_RESPOND_TRADE': {
      const trade = state.activeTrade!;

      if (trade.phase === 'AWAITING_OPPONENTS') {
        const currentBranch = trade.branches[playerId]!;
        let updatedBranch: CatanTradeBranch;

        if (action.response === 'ACCEPT') {
          updatedBranch = {
            ...currentBranch,
            status: 'OPPONENT_ACCEPTED',
          };
        } else if (action.response === 'COUNTER') {
          const counterGive = normalizeResourceBundle(action.counterGive);
          const counterRequest = normalizeResourceBundle(action.counterRequest);
          updatedBranch = {
            ...currentBranch,
            status: 'OPPONENT_COUNTERED',
            // Opponent offers `counterGive` and asks active player for `counterRequest`
            activeGives: counterRequest,
            opponentGives: counterGive,
            lastProposedBy: playerId,
          };
        } else {
          updatedBranch = {
            ...currentBranch,
            status: 'DECLINED',
          };
        }

        const nextBranches: Record<string, CatanTradeBranch> = {
          ...trade.branches,
          [playerId]: updatedBranch,
        };

        const branchValues = Object.values(nextBranches);
        const allDeclined = branchValues.every((b) => b.status === 'DECLINED');
        if (allDeclined) {
          return {
            ...state,
            activeTrade: null,
            lastActionSummary: `All players declined ${trade.initiatorId}'s trade proposal.`,
          };
        }

        const stillWaiting = branchValues.some(
          (b) => b.status === 'AWAITING_OPPONENT'
        );

        const nextTrade: CatanActiveTrade = {
          ...trade,
          phase: stillWaiting ? 'AWAITING_OPPONENTS' : 'AWAITING_ACTIVE_PLAYER',
          branches: nextBranches,
        };

        return {
          ...state,
          activeTrade: nextTrade,
          lastActionSummary: stillWaiting
            ? `${playerId} responded (${action.response}) to ${trade.initiatorId}'s trade. Waiting on remaining players.`
            : `All players have responded to ${trade.initiatorId}'s trade! ${trade.initiatorId} may now Accept, Counter, or Decline.`,
        };
      } else {
        // Active player responding to `targetOpponentId`
        const targetId = action.targetOpponentId!;
        const targetBranch = trade.branches[targetId]!;
        const opponent = state.players[targetId]!;

        if (action.response === 'ACCEPT') {
          // Execute trade between `playerId` (active) and `targetId` (opponent) and close trade!
          const nextActiveRes = { ...player.resources };
          const nextOppRes = { ...opponent.resources };

          for (const r of ALL_CATAN_RESOURCES) {
            nextActiveRes[r] =
              nextActiveRes[r] -
              targetBranch.activeGives[r] +
              targetBranch.opponentGives[r];
            nextOppRes[r] =
              nextOppRes[r] -
              targetBranch.opponentGives[r] +
              targetBranch.activeGives[r];
          }

          return {
            ...state,
            activeTrade: null,
            players: {
              ...state.players,
              [playerId]: {
                ...player,
                resources: nextActiveRes,
              },
              [targetId]: {
                ...opponent,
                resources: nextOppRes,
              },
            },
            lastActionSummary: `Trade completed! ${playerId} traded ${formatResourceBundle(
              targetBranch.activeGives
            )} to ${targetId} for ${formatResourceBundle(
              targetBranch.opponentGives
            )}.`,
          };
        }

        let updatedBranch: CatanTradeBranch;
        if (action.response === 'COUNTER') {
          const counterGive = normalizeResourceBundle(action.counterGive);
          const counterRequest = normalizeResourceBundle(action.counterRequest);
          updatedBranch = {
            ...targetBranch,
            status: 'AWAITING_OPPONENT',
            activeGives: counterGive,
            opponentGives: counterRequest,
            lastProposedBy: playerId,
          };
        } else {
          updatedBranch = {
            ...targetBranch,
            status: 'DECLINED',
          };
        }

        const nextBranches: Record<string, CatanTradeBranch> = {
          ...trade.branches,
          [targetId]: updatedBranch,
        };
        const branchValues = Object.values(nextBranches);
        const allDeclined = branchValues.every((b) => b.status === 'DECLINED');
        if (allDeclined) {
          return {
            ...state,
            activeTrade: null,
            lastActionSummary: `Trade negotiation ended — all trade branches were declined.`,
          };
        }

        const hasRemainingForActive = branchValues.some(
          (b) =>
            b.status === 'OPPONENT_ACCEPTED' ||
            b.status === 'OPPONENT_COUNTERED'
        );

        return {
          ...state,
          activeTrade: {
            ...trade,
            phase: hasRemainingForActive
              ? 'AWAITING_ACTIVE_PLAYER'
              : 'AWAITING_OPPONENTS',
            branches: nextBranches,
          },
          lastActionSummary:
            action.response === 'COUNTER'
              ? `${playerId} sent a counter-offer to ${targetId}: offering ${formatResourceBundle(
                  updatedBranch.activeGives
                )} for ${formatResourceBundle(updatedBranch.opponentGives)}.`
              : `${playerId} declined ${targetId}'s trade response.`,
        };
      }
    }

    case 'CATAN_CANCEL_TRADE': {
      return {
        ...state,
        activeTrade: null,
        lastActionSummary: `${playerId} cancelled the trade offer.`,
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
        hasPlayedDevCardThisTurn: false,
        pendingDiscards: {},
        robberReturnStep: 'MAIN_PHASE',
        robberEligibleVictimIds: [],
        robberVictimId: null,
        robberShuffledVictimCards: [],
        cityUpgradePaid: false,
        freeRoadsRemaining: 0,
        activeTrade: null,
        lastActionSummary: `${playerId} ended their turn. It is now ${nextPlayerId}'s turn to roll.`,
      };
    }
  }
}

// ============================================================================
// Sanitized Perspective & Final Scores
// ============================================================================

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
      developmentCardCount: opp.devCards.length,
      faceUpKnights: opp.faceUpKnights,
      settlementsRemaining: opp.settlementsRemaining,
      citiesRemaining: opp.citiesRemaining,
      roadsRemaining: opp.roadsRemaining,
      roadsBuilt: opp.roadsBuilt,
      longestRoadLength: opp.longestRoadLength,
      hasLongestRoad: opp.hasLongestRoad,
      hasLargestArmy: opp.hasLargestArmy,
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
    board: cloneBoard(state.board),
    startingRolls: { ...state.startingRolls },
    startingPlayerId: state.startingPlayerId,
    lastPlacedSettlementVertexId: state.lastPlacedSettlementVertexId,
    freeRoadsRemaining: state.freeRoadsRemaining,
    lastDiceRoll: state.lastDiceRoll ? [...state.lastDiceRoll] : null,
    devCardDeckCount: state.devCardDeck.length,
    hasPlayedDevCardThisTurn: state.hasPlayedDevCardThisTurn,
    pendingDiscards: { ...state.pendingDiscards },
    robberEligibleVictimIds: [...state.robberEligibleVictimIds],
    robberVictimId: state.robberVictimId,
    robberVictimCardCount: state.robberShuffledVictimCards.length,
    cityUpgradePaid: state.cityUpgradePaid,
    largestArmyOwnerId: state.largestArmyOwnerId,
    largestArmySize: state.largestArmySize,
    longestRoadOwnerId: state.longestRoadOwnerId,
    longestRoadLength: state.longestRoadLength,
    activeTrade: state.activeTrade,
    hexes: state.hexes.map((h) => ({ ...h })),
    buildings: state.buildings.map((b) => ({ ...b, hexIds: [...b.hexIds] })),
    self: {
      ...self,
      resources: { ...self.resources },
      devCards: [...self.devCards],
      playedVictoryCards: [...self.playedVictoryCards],
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
    const p = state.players[pid]!;
    const hiddenVpCards = p.devCards.reduce((sum, c) => sum + c.vp, 0);
    scores[pid] = p.victoryPoints + hiddenVpCards;
  }
  return scores;
}
