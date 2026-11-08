import { PRNGState } from '../../common/prng.js';

export type CardKind =
  | 'TREASURE'
  | 'VICTORY'
  | 'ACTION'
  | 'ATTACK'
  | 'REACTION'
  | 'CURSE';

export type DominionCustomEffectId =
  | 'CELLAR'
  | 'CHAPEL'
  | 'MERCHANT'
  | 'MILITIA'
  | 'MINE'
  | 'MOAT'
  | 'REMODEL'
  | 'WITCH'
  | 'WORKSHOP'
  | 'GARDENS';

export interface Card {
  readonly id: string;
  readonly name: string;
  readonly cost: number;
  readonly types: readonly CardKind[];
  readonly coins: number;
  readonly vp: number;
  readonly actions: number;
  readonly buys: number;
  readonly cards: number;
  readonly description: string;
  readonly customEffectId?: DominionCustomEffectId;
}

export type DominionTurnPhase =
  | 'ACTION'
  | 'BUY_TREASURES'
  | 'BUY_CARDS'
  | 'CLEANUP';

export type InteractionPromptType =
  | 'DISCARD_FOR_DRAW'
  | 'TRASH_UP_TO_N'
  | 'ATTACK_DEFENSE_OR_DISCARD'
  | 'TRASH_AND_UPGRADE'
  | 'GAIN_COSTING_UP_TO';

export interface PendingInteraction {
  readonly playerId: string;
  readonly sourceCard: Card;
  readonly promptType: InteractionPromptType;
  readonly minCount: number;
  readonly maxCount: number;
  readonly maxCost?: number;
  /** Remaining opponent playerIds to resolve multi-player attacks (e.g. Militia) */
  readonly remainingTargetQueue?: readonly string[];
  /** Optional card type constraint (e.g. Mine requires TREASURE for both trash & gain) */
  readonly restrictedCardKind?: CardKind;
  /** Destination zone for gained card ('DISCARD' by default, 'HAND' for Mine) */
  readonly gainDestination?: 'DISCARD' | 'HAND';
  /** Cost bonus over trashed card for TRASH_AND_UPGRADE (+2 for Remodel, +3 for Mine) */
  readonly upgradeMaxCostDelta?: number;
}

export interface DominionPlayerState {
  readonly id: string;
  readonly deck: readonly Card[];
  readonly hand: readonly Card[];
  readonly inPlay: readonly Card[];
  readonly discard: readonly Card[];
  readonly actions: number;
  readonly buys: number;
  readonly coins: number;
  /** Number of Merchant cards played this turn awaiting the first Silver played */
  readonly merchantsPlayedThisTurn: number;
  /** Whether this player has already played at least one Silver this turn */
  readonly silverPlayedThisTurn: boolean;
}

export interface SanitizedDominionPlayerState {
  readonly id: string;
  readonly deckCount: number;
  readonly handCount: number;
  /** Populated for the viewing player (`self`); empty/hidden for opponents */
  readonly hand: readonly Card[];
  readonly inPlay: readonly Card[];
  readonly discardCount: number;
  readonly discardTopCard: Card | null;
  readonly actions: number;
  readonly buys: number;
  readonly coins: number;
  readonly totalVictoryPoints: number;
}

export interface DominionInitOptions {
  readonly kingdomCards?: readonly string[];
}

export interface DominionGameState {
  readonly gameId: 'dominion';
  readonly phase: 'PLAYING' | 'GAME_OVER';
  readonly turnPhase: DominionTurnPhase;
  readonly turnStep: DominionTurnPhase;
  readonly isGameOver: boolean;
  readonly turnNumber: number;
  readonly playerOrder: readonly string[];
  readonly activePlayerIndex: number;
  readonly activePlayerId: string;
  readonly players: Readonly<Record<string, DominionPlayerState>>;
  readonly supply: Readonly<Record<string, number>>;
  readonly kingdomCards: readonly string[];
  readonly trash: readonly Card[];
  readonly pendingInteraction: PendingInteraction | null;
  readonly prng: PRNGState;
  readonly winnerId: string | null;
  readonly finalScores: Readonly<Record<string, number>> | null;
  readonly lastActionSummary: string | null;
}

export interface SanitizedDominionState {
  readonly gameId: 'dominion';
  readonly phase: 'PLAYING' | 'GAME_OVER';
  readonly turnPhase: DominionTurnPhase;
  readonly turnStep: DominionTurnPhase;
  readonly isGameOver: boolean;
  readonly turnNumber: number;
  readonly playerOrder: readonly string[];
  readonly activePlayerIndex: number;
  readonly activePlayerId: string;
  readonly self: SanitizedDominionPlayerState;
  readonly opponents: Readonly<Record<string, SanitizedDominionPlayerState>>;
  readonly supply: Readonly<Record<string, number>>;
  readonly kingdomCards: readonly string[];
  readonly trash: readonly Card[];
  readonly pendingInteraction: PendingInteraction | null;
  readonly winnerId: string | null;
  readonly finalScores: Readonly<Record<string, number>> | null;
  readonly lastActionSummary: string | null;
}

export type DominionAction =
  | {
      readonly type: 'PLAY_ACTION_CARD';
      readonly cardId: string;
    }
  | {
      readonly type: 'RESOLVE_INTERACTION';
      readonly selectedCardIds?: readonly string[];
      readonly trashedCardId?: string;
      readonly gainedCardId?: string;
      readonly revealMoat?: boolean;
    }
  | {
      readonly type: 'PLAY_TREASURE';
      readonly cardId: string;
    }
  | {
      readonly type: 'PLAY_ALL_TREASURES';
    }
  | {
      readonly type: 'END_ACTION_PHASE';
    }
  | {
      readonly type: 'BUY_CARD';
      readonly cardId: string;
    }
  | {
      readonly type: 'CLEANUP';
    }
  | {
      readonly type: 'END_TURN';
    };
