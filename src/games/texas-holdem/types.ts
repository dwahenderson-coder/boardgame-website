import {
  EvaluatedPokerHand,
  SanitizedCardZone,
  SerializedCardZone,
  StandardCard,
} from '../../common/cards/index.js';
import { PRNGState } from '../../common/prng.js';

export type HoldemPhase = 'PLAYING' | 'GAME_OVER';
export type HoldemStreet = 'PREFLOP' | 'FLOP' | 'TURN' | 'RIVER' | 'SHOWDOWN';
export type HoldemTurnStep = 'BETTING' | 'HAND_OVER';

export interface HoldemPlayerState {
  readonly id: string;
  readonly chips: number;
  readonly holeZone: SerializedCardZone<StandardCard>;
  readonly currentBet: number;
  readonly totalHandCommit: number;
  readonly folded: boolean;
  readonly allIn: boolean;
  readonly hasActedThisStreet: boolean;
  readonly busted: boolean;
  readonly lastActionLabel: string | null;
  readonly handsWon: number;
}

export interface HoldemPublicPlayerState {
  readonly id: string;
  readonly chips: number;
  readonly holeZone: SanitizedCardZone<StandardCard>;
  readonly currentBet: number;
  readonly totalHandCommit: number;
  readonly folded: boolean;
  readonly allIn: boolean;
  readonly hasActedThisStreet: boolean;
  readonly busted: boolean;
  readonly lastActionLabel: string | null;
  readonly handsWon: number;
}

export interface HoldemWinnerSummary {
  readonly playerId: string;
  readonly amountWon: number;
  readonly handDescription: string;
  readonly bestFiveIds: readonly string[];
}

export interface HoldemGameState {
  readonly gameId: 'holdem';
  readonly phase: HoldemPhase;
  readonly street: HoldemStreet;
  readonly turnStep: HoldemTurnStep;
  readonly turnNumber: number;
  readonly handNumber: number;
  readonly smallBlind: number;
  readonly bigBlind: number;
  readonly playerOrder: readonly string[];
  readonly dealerIndex: number;
  readonly smallBlindIndex: number;
  readonly bigBlindIndex: number;
  readonly activePlayerIndex: number;
  readonly pot: number;
  readonly currentBet: number;
  readonly minRaiseDelta: number;
  readonly deckZone: SerializedCardZone<StandardCard>;
  readonly burnZone: SerializedCardZone<StandardCard>;
  readonly communityZone: SerializedCardZone<StandardCard>;
  readonly players: Readonly<Record<string, HoldemPlayerState>>;
  readonly prng: PRNGState;
  readonly winnerId: string | null;
  readonly lastActionSummary: string | null;
  readonly lastHandWinners: readonly HoldemWinnerSummary[];
  readonly showdownHands: Readonly<Record<string, EvaluatedPokerHand>>;
}

export interface HoldemSanitizedGameState {
  readonly gameId: 'holdem';
  readonly phase: HoldemPhase;
  readonly street: HoldemStreet;
  readonly turnStep: HoldemTurnStep;
  readonly turnNumber: number;
  readonly handNumber: number;
  readonly smallBlind: number;
  readonly bigBlind: number;
  readonly playerOrder: readonly string[];
  readonly dealerIndex: number;
  readonly smallBlindIndex: number;
  readonly bigBlindIndex: number;
  readonly activePlayerIndex: number;
  readonly activePlayerId: string;
  readonly pot: number;
  readonly currentBet: number;
  readonly minRaiseDelta: number;
  readonly deckCount: number;
  readonly burnCount: number;
  readonly communityCards: readonly StandardCard[];
  readonly self: HoldemPublicPlayerState;
  readonly selfBestHand: EvaluatedPokerHand | null;
  readonly opponents: Readonly<Record<string, HoldemPublicPlayerState>>;
  readonly winnerId: string | null;
  readonly lastActionSummary: string | null;
  readonly lastHandWinners: readonly HoldemWinnerSummary[];
  readonly showdownHands: Readonly<Record<string, EvaluatedPokerHand>>;
}

export type HoldemAction =
  | { readonly type: 'HOLDEM_FOLD' }
  | { readonly type: 'HOLDEM_CHECK' }
  | { readonly type: 'HOLDEM_CALL' }
  | {
      readonly type: 'HOLDEM_BET_RAISE';
      /** Target total street bet for this player (e.g., raising street bet to 60) */
      readonly targetBet: number;
    }
  | { readonly type: 'HOLDEM_NEXT_HAND' };
