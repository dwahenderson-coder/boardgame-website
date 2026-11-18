import { PRNGState } from '../../common/prng.js';
import { DeckState } from '../../mechanics/deck.js';
import { CardTiming, DiceTownCard } from './diceTownCards.js';

export type DieFace = '9' | '10' | 'J' | 'Q' | 'K' | 'A';

export const ALL_DIE_FACES: readonly DieFace[] = [
  '9',
  '10',
  'J',
  'Q',
  'K',
  'A',
] as const;

export const DIE_FACE_RANK: Readonly<Record<DieFace, number>> = {
  '9': 9,
  '10': 10,
  J: 11,
  Q: 12,
  K: 13,
  A: 14,
};

export type DieStatus = 'in_cup' | 'staged_hidden' | 'locked_public';

export interface PokerDie {
  readonly index: number;
  readonly value: DieFace;
  readonly status: DieStatus;
}

export interface SanitizedPokerDie {
  readonly index: number;
  /** `null` for opponents when `status` is `'in_cup'` or `'staged_hidden'` */
  readonly value: DieFace | null;
  readonly status: DieStatus;
}

export type DiceTownPokerHandCategory =
  | 'FIVE_OF_A_KIND'
  | 'FOUR_OF_A_KIND'
  | 'FULL_HOUSE'
  | 'STRAIGHT'
  | 'THREE_OF_A_KIND'
  | 'TWO_PAIR'
  | 'ONE_PAIR'
  | 'HIGH_CARD';

export interface EvaluatedPokerDiceHand {
  readonly category: DiceTownPokerHandCategory;
  readonly categoryRank: number; // 8 (Five of a Kind) .. 1 (High Card)
  readonly tiebreakerRanks: readonly number[];
  readonly label: string;
}

export interface PlayerState {
  readonly id: string;
  readonly name: string;
  readonly dollars: number; // starts at $8
  readonly nuggets: number; // starts at 0
  readonly isSheriff: boolean;
  readonly dice: readonly PokerDie[]; // 5 PokerDice
  readonly handCards: readonly DiceTownCard[]; // General Store cards
  readonly propertyDeeds: readonly DiceTownCard[]; // Public face-up Property Deed cards
  readonly protectedDeedIds: readonly string[]; // Property Deeds protected from theft (Elixir of Protection)
  readonly docBadluckCards: readonly DiceTownCard[]; // Held Doc Badluck Elixir cards
  readonly hasSubmittedSelection: boolean;
  readonly stagedExtraDiceFee: number;
  readonly usedBruteThisStep: boolean;
  readonly locationsWonThisRound: number;
}

export interface SanitizedOpponentState {
  readonly id: string;
  readonly name: string;
  readonly dollars: number;
  readonly nuggets: number;
  readonly isSheriff: boolean;
  readonly dice: readonly SanitizedPokerDie[];
  readonly handCardCount: number;
  readonly propertyDeeds: readonly DiceTownCard[];
  readonly protectedDeedIds: readonly string[];
  readonly docBadluckCardCount: number;
  readonly hasSubmittedSelection: boolean;
  readonly locationsWonThisRound: number;
}

export interface TownState {
  readonly goldMineNuggets: number; // starts at 30
  readonly bankVaultDollars: number; // starts at $3, gains +$1 per round at ROUND_START
  readonly generalStoreDeck: DeckState<DiceTownCard>;
  readonly discardPile: readonly DiceTownCard[];
  readonly propertyDeck: DeckState<DiceTownCard>;
  readonly faceUpProperties: readonly DiceTownCard[]; // up to 3 visible Property Deed cards
  readonly docBadluckDeck: DeckState<DiceTownCard>; // 7 Elixir cards
}

export interface SanitizedTownState {
  readonly goldMineNuggets: number;
  readonly bankVaultDollars: number;
  readonly generalStoreDrawCount: number;
  readonly generalStoreDiscardCount: number;
  readonly discardPileTopCard: DiceTownCard | null;
  readonly propertyDrawCount: number;
  readonly faceUpProperties: readonly DiceTownCard[];
  readonly docBadluckDrawCount: number;
}

export type DiceTownPhase =
  | 'ROUND_START'
  | 'SIMULTANEOUS_ROLL'
  | 'SECRET_SELECTION'
  | 'REVEAL_STEP'
  | 'LOCATION_RESOLUTION'
  | 'ACTION_CARD_WINDOWS'
  | 'END_GAME_CHECK'
  | 'GAME_OVER';

export type DiceTownLocation =
  | 'GOLD_MINE'
  | 'BANK'
  | 'GENERAL_STORE'
  | 'SALOON'
  | 'SHERIFF_OFFICE'
  | 'TOWN_HALL'
  | 'DOC_BADLUCK';

export const LOCATION_RESOLUTION_ORDER: readonly DiceTownLocation[] = [
  'GOLD_MINE',
  'BANK',
  'GENERAL_STORE',
  'SALOON',
  'SHERIFF_OFFICE',
  'TOWN_HALL',
  'DOC_BADLUCK',
] as const;

export type DiceTownResolutionSubState =
  | 'IDLE'
  | 'SHERIFF_TIEBREAKER'
  | 'GENERAL_STORE_PICK'
  | 'SALOON_STEAL'
  | 'DOC_BADLUCK_TARGET';

export interface SheriffTiebreakerPrompt {
  readonly location: DiceTownLocation;
  readonly sheriffPlayerId: string;
  readonly tiedPlayerIds: readonly string[];
}

export interface GeneralStorePendingDraw {
  readonly winnerPlayerId: string;
  readonly drawnCards: readonly DiceTownCard[];
  readonly remainingVisits: number;
}

export interface SaloonPendingSteal {
  readonly winnerPlayerId: string;
  readonly queensCount: number;
  readonly targetOpponentId: string | null;
  readonly revealedCandidateCards: readonly DiceTownCard[];
  readonly remainingSteals: number;
}

export interface DocBadluckPendingAction {
  readonly playerId: string;
  readonly card: DiceTownCard;
  readonly pendingQueuePlayerIds: readonly string[];
}

export interface LocationLeaderSummary {
  readonly location: DiceTownLocation;
  readonly leaderPlayerIds: readonly string[];
  readonly isTie: boolean;
  readonly bestValueLabel: string;
}

export interface UnderTheCupTrayHook {
  readonly playerId: string;
  readonly inCupDice: readonly PokerDie[];
  readonly stagedHiddenDice: readonly PokerDie[];
  readonly lockedPublicDice: readonly PokerDie[];
  readonly hasSubmittedSelection: boolean;
  readonly maxSelectableDiceCount: number;
}

export interface DiceTownVPBreakdown {
  readonly nuggetVP: number;
  readonly dollarVP: number;
  readonly sheriffVP: number;
  readonly propertyDeedVP: number;
  readonly bonusCardVP: number;
  readonly totalVP: number;
}

export interface DiceTownGameState {
  readonly gameId: 'dice_town';
  readonly phase: DiceTownPhase;
  readonly turnStep: DiceTownPhase;
  readonly subState: DiceTownResolutionSubState;
  readonly roundNumber: number;
  readonly turnNumber: number;
  readonly prng: PRNGState;
  readonly playerOrder: readonly string[];
  readonly activePlayerIndex: number;
  readonly sheriffPlayerId: string | null;
  readonly players: Readonly<Record<string, PlayerState>>;
  readonly town: TownState;
  readonly currentLocationIndex: number;
  readonly currentLocation: DiceTownLocation | null;
  readonly currentLocationWinnerId: string | null;
  readonly sheriffTiebreaker: SheriffTiebreakerPrompt | null;
  readonly generalStorePending: GeneralStorePendingDraw | null;
  readonly saloonPending: SaloonPendingSteal | null;
  readonly docBadluckPending: DocBadluckPendingAction | null;
  readonly docBadluckBonusVisitors: readonly string[];
  readonly lastBankRobbery: {
    readonly winnerId: string;
    readonly amountStolen: number;
  } | null;
  readonly lastPlayedStoreCard: {
    readonly playerId: string;
    readonly card: DiceTownCard;
  } | null;
  readonly finalVPByPlayer: Readonly<Record<string, DiceTownVPBreakdown>> | null;
  readonly winnerId: string | null;
  readonly lastActionSummary: string | null;
}

export interface DiceTownSanitizedState {
  readonly gameId: 'dice_town';
  readonly phase: DiceTownPhase;
  readonly turnStep: DiceTownPhase;
  readonly subState: DiceTownResolutionSubState;
  readonly roundNumber: number;
  readonly turnNumber: number;
  readonly playerOrder: readonly string[];
  readonly activePlayerIndex: number;
  readonly activePlayerId: string;
  readonly sheriffPlayerId: string | null;
  readonly self: PlayerState;
  readonly opponents: Readonly<Record<string, SanitizedOpponentState>>;
  readonly town: SanitizedTownState;
  readonly currentLocation: DiceTownLocation | null;
  readonly currentLocationWinnerId: string | null;
  /** UI Hook 1: Central Town board showing the 6 locations + current leaders */
  readonly townBoardLeaders: Readonly<
    Record<DiceTownLocation, LocationLeaderSummary>
  >;
  /** UI Hook 2: Private "Under the Cup" dice tray for selection */
  readonly underTheCup: UnderTheCupTrayHook;
  /** UI Hook 3: Sheriff Tie-Breaker Modal */
  readonly sheriffTiebreakerModal: SheriffTiebreakerPrompt | null;
  readonly generalStoreChoiceCards: readonly DiceTownCard[] | null;
  readonly saloonRevealedCards: readonly DiceTownCard[] | null;
  readonly docBadluckPending: DocBadluckPendingAction | null;
  readonly finalVPByPlayer: Readonly<Record<string, DiceTownVPBreakdown>> | null;
  readonly winnerId: string | null;
  readonly lastActionSummary: string | null;
}

export type DiceTownAction =
  | { readonly type: 'DT_START_ROUND' }
  | { readonly type: 'DT_ROLL_DICE' }
  | {
      readonly type: 'DT_SELECT_DICE';
      readonly dieIndices: readonly number[];
      readonly lockAllRemaining?: boolean;
      readonly playBruteCardId?: string;
      readonly cheaterCardId?: string;
      readonly cheaterDieIndex?: number;
      readonly cheaterTargetFace?: DieFace;
    }
  | { readonly type: 'DT_REVEAL_DICE' }
  | {
      readonly type: 'DT_SHERIFF_BREAK_TIE';
      readonly chosenWinnerId: string;
    }
  | {
      readonly type: 'DT_GENERAL_STORE_PICK_CARD';
      readonly cardId: string;
    }
  | {
      readonly type: 'DT_SALOON_SELECT_OPPONENT';
      readonly targetPlayerId: string;
    }
  | {
      readonly type: 'DT_SALOON_STEAL_CARD';
      readonly cardId: string;
    }
  | {
      readonly type: 'DT_PLAY_CARD';
      readonly cardId: string;
      readonly targetPlayerId?: string;
      readonly targetDieIndex?: number;
      readonly targetDieFace?: DieFace;
      readonly timingWindow?: CardTiming;
    }
  | {
      readonly type: 'DT_RESOLVE_DOC_BADLUCK_DEMAND';
      readonly targetPlayerId: string;
      readonly cardId?: string;
    }
  | { readonly type: 'DT_ADVANCE_RESOLUTION' };
