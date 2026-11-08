import {
  GAME_CATALOG,
  GAME_CATALOG_BY_ID,
} from '../registry/catalog.js';
import {
  GameColorDefinition,
  GameExpansion,
  GameId,
  GameSetupOptions,
} from '../types/game.js';
import {
  applyCatanAction,
  calculateCatanFinalScores,
  CatanAction,
  CatanGameState,
  CatanSanitizedGameState,
  getCatanPlayerPerspective,
  initCatanGame,
  validateCatanAction,
} from './catan/index.js';
import {
  applyCribbageAction,
  calculateCribbageFinalScores,
  CribbageAction,
  CribbageGameState,
  CribbageSanitizedGameState,
  getCribbagePlayerPerspective,
  initCribbageGame,
  validateCribbageAction,
} from './cribbage/index.js';
import {
  applyDominionAction,
  calculateDominionFinalScores,
  DEFAULT_BASE_KINGDOM_CARD_IDS,
  DominionAction,
  DominionGameState,
  getDominionPlayerPerspective,
  initDominionGame,
  SanitizedDominionState,
  validateDominionAction,
} from './dominion/index.js';
import {
  applyEuchreAction,
  calculateEuchreFinalScores,
  EuchreAction,
  EuchreGameState,
  EuchreSanitizedGameState,
  getEuchrePlayerPerspective,
  initEuchreGame,
  validateEuchreAction,
} from './euchre/index.js';
import {
  applyKingsCornersAction,
  calculateKingsCornersFinalScores,
  getKingsCornersPlayerPerspective,
  initKingsCornersGame,
  KingsCornersAction,
  KingsCornersGameState,
  KingsCornersSanitizedGameState,
  validateKingsCornersAction,
} from './kings-corners/index.js';
import {
  applyPowerGridAction,
  calculatePowerGridFinalScores,
  getPowerGridPlayerPerspective,
  initPowerGridGame,
  PowerGridAction,
  PowerGridGameState,
  SanitizedPowerGridState,
  validatePowerGridAction,
} from './power-grid/index.js';
import {
  applyStockpileAction,
  calculateStockpileFinalScores,
  getStockpilePlayerPerspective,
  initStockpileGame,
  StockpileAction,
  StockpileGameState,
  StockpileSanitizedGameState,
  validateStockpileAction,
} from './stockpile/index.js';
import {
  applyHoldemAction,
  calculateHoldemFinalScores,
  getHoldemPlayerPerspective,
  HoldemAction,
  HoldemGameState,
  HoldemSanitizedGameState,
  initHoldemGame,
  validateHoldemAction,
} from './texas-holdem/index.js';
import {
  Action as TTRAction,
  applyAction as applyTTRAction,
  calculateFinalScores as calculateTTRFinalScores,
  GameState as TTRGameState,
  getPlayerPerspective as getTTRPlayerPerspective,
  initGame as initTTRGame,
  SanitizedGameState as TTRSanitizedGameState,
  validateAction as validateTTRAction,
  ValidationResult,
} from './ticket-to-ride/index.js';

export type { GameColorDefinition, GameExpansion, GameId, GameSetupOptions };

export type GameCategory = 'BOARD' | 'CARD';

export type AnyGameState =
  | TTRGameState
  | CatanGameState
  | StockpileGameState
  | PowerGridGameState
  | HoldemGameState
  | EuchreGameState
  | CribbageGameState
  | KingsCornersGameState
  | DominionGameState;

export type AnySanitizedGameState =
  | TTRSanitizedGameState
  | CatanSanitizedGameState
  | StockpileSanitizedGameState
  | SanitizedPowerGridState
  | HoldemSanitizedGameState
  | EuchreSanitizedGameState
  | CribbageSanitizedGameState
  | KingsCornersSanitizedGameState
  | SanitizedDominionState;

export type AnyGameAction =
  | TTRAction
  | CatanAction
  | StockpileAction
  | PowerGridAction
  | HoldemAction
  | EuchreAction
  | CribbageAction
  | KingsCornersAction
  | DominionAction;

export interface GameMetadata {
  readonly id: GameId;
  readonly category: GameCategory;
  readonly icon: string;
  readonly title: string;
  readonly name: string;
  readonly subtitle: string;
  readonly description: string;
  readonly minPlayers: number;
  readonly maxPlayers: number;
  readonly estimatedMinutes: number;
  readonly durationLabel: string;
  readonly mechanicsLabel: string;
  readonly badgeColor: string;
  readonly availableColors: readonly GameColorDefinition[];
  readonly expansions: readonly GameExpansion[];
}

export interface GameEngineModule<
  TState extends AnyGameState = AnyGameState,
  TAction extends AnyGameAction = AnyGameAction,
  TSanitized extends AnySanitizedGameState = AnySanitizedGameState,
> extends GameMetadata {
  readonly initGame: (
    playerIds: string[],
    seed: number,
    options?: GameSetupOptions
  ) => TState;
  readonly validateAction: (
    state: TState,
    playerId: string,
    action: TAction
  ) => ValidationResult;
  readonly applyAction: (
    state: TState,
    playerId: string,
    action: TAction
  ) => TState;
  readonly getPlayerPerspective: (
    state: TState,
    playerId: string
  ) => TSanitized;
  readonly calculateFinalScores: (state: TState) => Record<string, number>;
}

export const GAME_METADATA_LIST: readonly GameMetadata[] = GAME_CATALOG.map(
  (def) => ({
    id: def.id,
    category: def.category === 'board' ? 'BOARD' : 'CARD',
    icon: def.icon,
    title: def.name,
    name: def.name,
    subtitle: def.subtitle,
    description: def.description,
    minPlayers: def.minPlayers,
    maxPlayers: def.maxPlayers,
    estimatedMinutes: def.estimatedMinutes,
    durationLabel: `~${def.estimatedMinutes} min`,
    mechanicsLabel: def.mechanicsLabel,
    badgeColor: def.badgeColor,
    availableColors: def.availableColors,
    expansions: def.expansions,
  })
);

export const BOARD_GAME_METADATA_LIST: readonly GameMetadata[] =
  GAME_METADATA_LIST.filter((g) => g.category === 'BOARD');

export const CARD_GAME_METADATA_LIST: readonly GameMetadata[] =
  GAME_METADATA_LIST.filter((g) => g.category === 'CARD');

function findMetadata(id: GameId): GameMetadata {
  const found = GAME_METADATA_LIST.find((g) => g.id === id);
  if (!found) {
    const def = GAME_CATALOG_BY_ID[id];
    return {
      id: def.id,
      category: def.category === 'board' ? 'BOARD' : 'CARD',
      icon: def.icon,
      title: def.name,
      name: def.name,
      subtitle: def.subtitle,
      description: def.description,
      minPlayers: def.minPlayers,
      maxPlayers: def.maxPlayers,
      estimatedMinutes: def.estimatedMinutes,
      durationLabel: `~${def.estimatedMinutes} min`,
      mechanicsLabel: def.mechanicsLabel,
      badgeColor: def.badgeColor,
      availableColors: def.availableColors,
      expansions: def.expansions,
    };
  }
  return found;
}

export const GameRegistry: Readonly<
  Record<GameId, GameEngineModule<any, any, any>>
> = {
  ttr: {
    ...findMetadata('ttr'),
    initGame: (
      playerIds: string[],
      seed: number,
      options?: GameSetupOptions
    ) =>
      initTTRGame(playerIds, seed, {
        mapId: options?.selectedExpansions?.includes('europe_map')
          ? 'EUROPE'
          : 'USA',
        enableAlvinAndDexter: Boolean(
          options?.selectedExpansions?.includes('alvin_and_dexter')
        ),
      }),
    validateAction: validateTTRAction,
    applyAction: applyTTRAction,
    getPlayerPerspective: getTTRPlayerPerspective,
    calculateFinalScores: calculateTTRFinalScores,
  },
  catan: {
    ...findMetadata('catan'),
    initGame: (playerIds: string[], seed: number) =>
      initCatanGame(playerIds, seed),
    validateAction: validateCatanAction,
    applyAction: applyCatanAction,
    getPlayerPerspective: getCatanPlayerPerspective,
    calculateFinalScores: calculateCatanFinalScores,
  },
  stockpile: {
    ...findMetadata('stockpile'),
    initGame: (playerIds: string[], seed: number) =>
      initStockpileGame(playerIds, seed),
    validateAction: validateStockpileAction,
    applyAction: applyStockpileAction,
    getPlayerPerspective: getStockpilePlayerPerspective,
    calculateFinalScores: calculateStockpileFinalScores,
  },
  power_grid: {
    ...findMetadata('power_grid'),
    initGame: (
      playerIds: string[],
      seed: number,
      options?: GameSetupOptions
    ) =>
      initPowerGridGame(
        playerIds,
        seed,
        options?.mapRegionKeys
          ? { mapRegionKeys: [...options.mapRegionKeys] }
          : undefined
      ),
    validateAction: validatePowerGridAction,
    applyAction: applyPowerGridAction,
    getPlayerPerspective: getPowerGridPlayerPerspective,
    calculateFinalScores: calculatePowerGridFinalScores,
  },
  holdem: {
    ...findMetadata('holdem'),
    initGame: (playerIds: string[], seed: number) =>
      initHoldemGame(playerIds, seed),
    validateAction: validateHoldemAction,
    applyAction: applyHoldemAction,
    getPlayerPerspective: getHoldemPlayerPerspective,
    calculateFinalScores: calculateHoldemFinalScores,
  },
  euchre: {
    ...findMetadata('euchre'),
    initGame: (playerIds: string[], seed: number) =>
      initEuchreGame(playerIds, seed),
    validateAction: validateEuchreAction,
    applyAction: applyEuchreAction,
    getPlayerPerspective: getEuchrePlayerPerspective,
    calculateFinalScores: calculateEuchreFinalScores,
  },
  cribbage: {
    ...findMetadata('cribbage'),
    initGame: (playerIds: string[], seed: number) =>
      initCribbageGame(playerIds, seed),
    validateAction: validateCribbageAction,
    applyAction: applyCribbageAction,
    getPlayerPerspective: getCribbagePlayerPerspective,
    calculateFinalScores: calculateCribbageFinalScores,
  },
  kings_corners: {
    ...findMetadata('kings_corners'),
    initGame: (playerIds: string[], seed: number) =>
      initKingsCornersGame(playerIds, seed),
    validateAction: validateKingsCornersAction,
    applyAction: applyKingsCornersAction,
    getPlayerPerspective: getKingsCornersPlayerPerspective,
    calculateFinalScores: calculateKingsCornersFinalScores,
  },
  dominion: {
    ...findMetadata('dominion'),
    initGame: (
      playerIds: string[],
      seed: number,
      options?: GameSetupOptions
    ) => {
      const useExtended = options?.selectedExpansions?.includes(
        'dominion_chapel_witch_gardens'
      );
      const kingdomCards = useExtended
        ? [
            'cellar',
            'chapel',
            'market',
            'militia',
            'moat',
            'remodel',
            'smithy',
            'village',
            'witch',
            'gardens',
          ]
        : DEFAULT_BASE_KINGDOM_CARD_IDS;
      return initDominionGame(playerIds, seed, { kingdomCards });
    },
    validateAction: validateDominionAction,
    applyAction: applyDominionAction,
    getPlayerPerspective: getDominionPlayerPerspective,
    calculateFinalScores: calculateDominionFinalScores,
  },
};
