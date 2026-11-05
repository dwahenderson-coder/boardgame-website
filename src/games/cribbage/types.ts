import {
  SanitizedCardZone,
  SerializedCardZone,
  StandardCard,
} from '../../common/cards/index.js';
import { PRNGState } from '../../common/prng.js';

export type CribbagePhase = 'PLAYING' | 'GAME_OVER';
export type CribbageTurnStep = 'DISCARD_TO_CRIB' | 'PEGGING' | 'HAND_OVER';

export interface CribbageScoreBreakdown {
  readonly fifteens: number;
  readonly pairs: number;
  readonly runs: number;
  readonly flush: number;
  readonly nobs: number;
  readonly total: number;
  readonly details: readonly string[];
}

export interface CribbagePegPlayedCard {
  readonly playerId: string;
  readonly card: StandardCard;
}

export interface CribbagePlayerState {
  readonly id: string;
  /** Cards currently held in hand (6->4 during discard; 4 during pegging/show) */
  readonly handZone: SerializedCardZone<StandardCard>;
  /** Remaining unplayed cards during the Pegging phase */
  readonly peggingCards: readonly StandardCard[];
  readonly discardedToCrib: boolean;
  readonly score: number;
  readonly lastActionLabel: string | null;
  readonly lastShowBreakdown: CribbageScoreBreakdown | null;
}

export interface CribbagePublicPlayerState {
  readonly id: string;
  readonly handZone: SanitizedCardZone<StandardCard>;
  readonly peggingCardsCount: number;
  /** Revealed only to self during pegging */
  readonly peggingCards: readonly StandardCard[] | null;
  readonly discardedToCrib: boolean;
  readonly score: number;
  readonly lastActionLabel: string | null;
  readonly lastShowBreakdown: CribbageScoreBreakdown | null;
}

export interface CribbageGameState {
  readonly gameId: 'cribbage';
  readonly phase: CribbagePhase;
  readonly turnStep: CribbageTurnStep;
  readonly turnNumber: number;
  readonly handNumber: number;
  readonly targetScore: number;
  readonly playerOrder: readonly string[];
  readonly dealerIndex: number;
  readonly activePlayerIndex: number;
  readonly starterCard: StandardCard | null;
  readonly cribZone: SerializedCardZone<StandardCard>;
  readonly cribBreakdown: CribbageScoreBreakdown | null;
  readonly runningCount: number;
  readonly currentSequence: readonly CribbagePegPlayedCard[];
  readonly playedPegHistory: readonly CribbagePegPlayedCard[];
  readonly players: Readonly<Record<string, CribbagePlayerState>>;
  readonly prng: PRNGState;
  readonly winnerId: string | null;
  readonly lastActionSummary: string | null;
}

export interface CribbageSanitizedGameState {
  readonly gameId: 'cribbage';
  readonly phase: CribbagePhase;
  readonly turnStep: CribbageTurnStep;
  readonly turnNumber: number;
  readonly handNumber: number;
  readonly targetScore: number;
  readonly playerOrder: readonly string[];
  readonly dealerIndex: number;
  readonly activePlayerIndex: number;
  readonly activePlayerId: string;
  readonly requiredDiscardsPerPlayer: number;
  readonly starterCard: StandardCard | null;
  readonly cribZone: SanitizedCardZone<StandardCard>;
  readonly cribBreakdown: CribbageScoreBreakdown | null;
  readonly runningCount: number;
  readonly currentSequence: readonly CribbagePegPlayedCard[];
  readonly playedPegHistory: readonly CribbagePegPlayedCard[];
  readonly self: CribbagePublicPlayerState;
  readonly opponents: Readonly<Record<string, CribbagePublicPlayerState>>;
  readonly winnerId: string | null;
  readonly lastActionSummary: string | null;
}

export type CribbageAction =
  | {
      readonly type: 'CRIB_DISCARD';
      readonly cardIds: readonly string[];
    }
  | {
      readonly type: 'CRIB_PLAY_CARD';
      readonly cardId: string;
    }
  | {
      readonly type: 'CRIB_SAY_GO';
    }
  | {
      readonly type: 'CRIB_NEXT_HAND';
    };

