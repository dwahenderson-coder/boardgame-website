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

export type GameId = 'ttr' | 'catan';

export type AnyGameState = TTRGameState | CatanGameState;
export type AnySanitizedGameState =
  | TTRSanitizedGameState
  | CatanSanitizedGameState;
export type AnyGameAction = TTRAction | CatanAction;

export interface GameMetadata {
  readonly id: GameId;
  readonly title: string;
  readonly subtitle: string;
  readonly minPlayers: number;
  readonly maxPlayers: number;
  readonly durationLabel: string;
  readonly mechanicsLabel: string;
  readonly badgeColor: string;
}

export interface GameEngineModule<
  TState extends AnyGameState = AnyGameState,
  TAction extends AnyGameAction = AnyGameAction,
  TSanitized extends AnySanitizedGameState = AnySanitizedGameState,
> extends GameMetadata {
  readonly initGame: (playerIds: string[], seed: number) => TState;
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

export const GAME_METADATA_LIST: readonly GameMetadata[] = [
  {
    id: 'ttr',
    title: 'Ticket to Ride',
    subtitle: 'Cross-Country Rail Adventure',
    minPlayers: 2,
    maxPlayers: 5,
    durationLabel: '~45 min',
    mechanicsLabel: 'Network & Card Drafting',
    badgeColor: 'amber',
  },
  {
    id: 'catan',
    title: 'Catan',
    subtitle: 'Settlers of the Hex Island',
    minPlayers: 3,
    maxPlayers: 4,
    durationLabel: '~60 min',
    mechanicsLabel: 'Trading, Building & Dice Production',
    badgeColor: 'emerald',
  },
] as const;

export const GameRegistry: Readonly<
  Record<GameId, GameEngineModule<any, any, any>>
> = {
  ttr: {
    ...GAME_METADATA_LIST[0]!,
    initGame: (playerIds: string[], seed: number) =>
      initTTRGame(playerIds, seed),
    validateAction: validateTTRAction,
    applyAction: applyTTRAction,
    getPlayerPerspective: getTTRPlayerPerspective,
    calculateFinalScores: calculateTTRFinalScores,
  },
  catan: {
    ...GAME_METADATA_LIST[1]!,
    initGame: initCatanGame,
    validateAction: validateCatanAction,
    applyAction: applyCatanAction,
    getPlayerPerspective: getCatanPlayerPerspective,
    calculateFinalScores: calculateCatanFinalScores,
  },
};

