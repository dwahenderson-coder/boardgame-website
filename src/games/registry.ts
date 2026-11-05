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

export type GameCategory = 'BOARD' | 'CARD';

export type GameId =
  | 'ttr'
  | 'catan'
  | 'holdem'
  | 'euchre'
  | 'cribbage'
  | 'kings_corners';

export type AnyGameState =
  | TTRGameState
  | CatanGameState
  | HoldemGameState
  | EuchreGameState
  | CribbageGameState
  | KingsCornersGameState;

export type AnySanitizedGameState =
  | TTRSanitizedGameState
  | CatanSanitizedGameState
  | HoldemSanitizedGameState
  | EuchreSanitizedGameState
  | CribbageSanitizedGameState
  | KingsCornersSanitizedGameState;

export type AnyGameAction =
  | TTRAction
  | CatanAction
  | HoldemAction
  | EuchreAction
  | CribbageAction
  | KingsCornersAction;

export interface GameMetadata {
  readonly id: GameId;
  readonly category: GameCategory;
  readonly icon: string;
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
  // --- BOARD GAMES ---
  {
    id: 'ttr',
    category: 'BOARD',
    icon: '🚂',
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
    category: 'BOARD',
    icon: '🏝️',
    title: 'Catan',
    subtitle: 'Settlers of the Hex Island',
    minPlayers: 3,
    maxPlayers: 4,
    durationLabel: '~60 min',
    mechanicsLabel: 'Trading, Building & Dice Production',
    badgeColor: 'emerald',
  },
  // --- CARD GAMES ---
  {
    id: 'holdem',
    category: 'CARD',
    icon: '🃏',
    title: "Texas Hold'em",
    subtitle: 'No-Limit Casino Poker',
    minPlayers: 2,
    maxPlayers: 6,
    durationLabel: '~30 min',
    mechanicsLabel: 'No-Limit Betting & Hand Evaluation',
    badgeColor: 'rose',
  },
  {
    id: 'euchre',
    category: 'CARD',
    icon: '♠️',
    title: 'Euchre',
    subtitle: 'Classic 24-Card Bower Trick-Taking',
    minPlayers: 2,
    maxPlayers: 4,
    durationLabel: '~25 min',
    mechanicsLabel: 'Trump Calling, Right/Left Bowers & Tricks',
    badgeColor: 'indigo',
  },
  {
    id: 'cribbage',
    category: 'CARD',
    icon: '🪵',
    title: 'Cribbage',
    subtitle: '121-Point Pegging & Hand Counting',
    minPlayers: 2,
    maxPlayers: 4,
    durationLabel: '~30 min',
    mechanicsLabel: 'Crib Discards, 31 Pegging & 15s/Runs',
    badgeColor: 'cyan',
  },
  {
    id: 'kings_corners',
    category: 'CARD',
    icon: '👑',
    title: 'Kings Corners',
    subtitle: '4-Card Memory, Knocking & Quarters Pot',
    minPlayers: 2,
    maxPlayers: 6,
    durationLabel: '~20 min',
    mechanicsLabel: '2-Card Peek, Hidden Swaps & Low Score Knock',
    badgeColor: 'amber',
  },
] as const;

export const BOARD_GAME_METADATA_LIST: readonly GameMetadata[] =
  GAME_METADATA_LIST.filter((g) => g.category === 'BOARD');

export const CARD_GAME_METADATA_LIST: readonly GameMetadata[] =
  GAME_METADATA_LIST.filter((g) => g.category === 'CARD');

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
  holdem: {
    ...GAME_METADATA_LIST[2]!,
    initGame: initHoldemGame,
    validateAction: validateHoldemAction,
    applyAction: applyHoldemAction,
    getPlayerPerspective: getHoldemPlayerPerspective,
    calculateFinalScores: calculateHoldemFinalScores,
  },
  euchre: {
    ...GAME_METADATA_LIST[3]!,
    initGame: initEuchreGame,
    validateAction: validateEuchreAction,
    applyAction: applyEuchreAction,
    getPlayerPerspective: getEuchrePlayerPerspective,
    calculateFinalScores: calculateEuchreFinalScores,
  },
  cribbage: {
    ...GAME_METADATA_LIST[4]!,
    initGame: initCribbageGame,
    validateAction: validateCribbageAction,
    applyAction: applyCribbageAction,
    getPlayerPerspective: getCribbagePlayerPerspective,
    calculateFinalScores: calculateCribbageFinalScores,
  },
  kings_corners: {
    ...GAME_METADATA_LIST[5]!,
    initGame: initKingsCornersGame,
    validateAction: validateKingsCornersAction,
    applyAction: applyKingsCornersAction,
    getPlayerPerspective: getKingsCornersPlayerPerspective,
    calculateFinalScores: calculateKingsCornersFinalScores,
  },
};
