import {
  CardSuit,
  SanitizedCardZone,
  SerializedCardZone,
  StandardCard,
} from '../../common/cards/index.js';
import { PRNGState } from '../../common/prng.js';
import { TrickPlay } from '../../common/cards/evaluators/trick-evaluator.js';

export type EuchrePhase = 'PLAYING' | 'GAME_OVER';
export type EuchreTurnStep =
  | 'ORDER_UP_ROUND'
  | 'NAME_TRUMP_ROUND'
  | 'PLAYING_TRICK'
  | 'HAND_OVER';

export interface EuchrePlayerState {
  readonly id: string;
  readonly handZone: SerializedCardZone<StandardCard>;
  readonly tricksWonThisHand: number;
  readonly score: number;
  readonly lastActionLabel: string | null;
}

export interface EuchrePublicPlayerState {
  readonly id: string;
  readonly handZone: SanitizedCardZone<StandardCard>;
  readonly tricksWonThisHand: number;
  readonly score: number;
  readonly lastActionLabel: string | null;
}

export interface EuchreGameState {
  readonly gameId: 'euchre';
  readonly phase: EuchrePhase;
  readonly turnStep: EuchreTurnStep;
  readonly turnNumber: number;
  readonly handNumber: number;
  readonly trickNumber: number;
  readonly playerOrder: readonly string[];
  readonly dealerIndex: number;
  readonly activePlayerIndex: number;
  readonly upcard: StandardCard | null;
  readonly turnedDownSuit: CardSuit | null;
  readonly trumpSuit: CardSuit | null;
  readonly makerPlayerId: string | null;
  readonly currentTrick: readonly TrickPlay[];
  readonly lastCompletedTrick: {
    readonly winnerId: string;
    readonly plays: readonly TrickPlay[];
  } | null;
  readonly kittyZone: SerializedCardZone<StandardCard>;
  readonly players: Readonly<Record<string, EuchrePlayerState>>;
  readonly prng: PRNGState;
  readonly winnerId: string | null;
  readonly lastActionSummary: string | null;
}

export interface EuchreSanitizedGameState {
  readonly gameId: 'euchre';
  readonly phase: EuchrePhase;
  readonly turnStep: EuchreTurnStep;
  readonly turnNumber: number;
  readonly handNumber: number;
  readonly trickNumber: number;
  readonly playerOrder: readonly string[];
  readonly dealerIndex: number;
  readonly activePlayerIndex: number;
  readonly activePlayerId: string;
  readonly upcard: StandardCard | null;
  readonly turnedDownSuit: CardSuit | null;
  readonly trumpSuit: CardSuit | null;
  readonly makerPlayerId: string | null;
  readonly currentTrick: readonly TrickPlay[];
  readonly lastCompletedTrick: {
    readonly winnerId: string;
    readonly plays: readonly TrickPlay[];
  } | null;
  readonly kittyCount: number;
  readonly self: EuchrePublicPlayerState;
  readonly opponents: Readonly<Record<string, EuchrePublicPlayerState>>;
  readonly winnerId: string | null;
  readonly lastActionSummary: string | null;
}

export type EuchreAction =
  | { readonly type: 'EUCHRE_ORDER_UP' }
  | { readonly type: 'EUCHRE_PASS_TRUMP' }
  | { readonly type: 'EUCHRE_CALL_TRUMP'; readonly suit: CardSuit }
  | { readonly type: 'EUCHRE_PLAY_CARD'; readonly cardId: string }
  | { readonly type: 'EUCHRE_NEXT_HAND' };

