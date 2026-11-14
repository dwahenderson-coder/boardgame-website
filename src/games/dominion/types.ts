import { PRNGState } from '../../common/prng.js';

export type CardKind =
  | 'TREASURE'
  | 'VICTORY'
  | 'ACTION'
  | 'ATTACK'
  | 'REACTION'
  | 'DURATION'
  | 'CURSE';

export type DominionCustomEffectId =
  | 'ADVENTURER'
  | 'AMBASSADOR'
  | 'ARTISAN'
  | 'ASTROLABE'
  | 'BANDIT'
  | 'BLOCKADE'
  | 'BUREAUCRAT'
  | 'CARAVAN'
  | 'CELLAR'
  | 'CHANCELLOR'
  | 'CHAPEL'
  | 'CORSAIR'
  | 'COUNCIL_ROOM'
  | 'CUTPURSE'
  | 'EMBARGO'
  | 'EXPLORER'
  | 'FEAST'
  | 'FISHING_VILLAGE'
  | 'GARDENS'
  | 'GHOST_SHIP'
  | 'HARBINGER'
  | 'HAVEN'
  | 'ISLAND'
  | 'LIBRARY'
  | 'LIGHTHOUSE'
  | 'LOOKOUT'
  | 'MERCHANT'
  | 'MERCHANT_SHIP'
  | 'MILITIA'
  | 'MINE'
  | 'MOAT'
  | 'MONEYLENDER'
  | 'MONKEY'
  | 'NATIVE_VILLAGE'
  | 'NAVIGATOR'
  | 'OUTPOST'
  | 'PEARL_DIVER'
  | 'PIRATE'
  | 'PIRATE_SHIP'
  | 'POACHER'
  | 'REMODEL'
  | 'SAILOR'
  | 'SALVAGER'
  | 'SEA_CHART'
  | 'SEA_HAG'
  | 'SEA_WITCH'
  | 'SENTRY'
  | 'SMUGGLERS'
  | 'SPY'
  | 'TACTICIAN'
  | 'THIEF'
  | 'THRONE_ROOM'
  | 'TIDE_POOLS'
  | 'TREASURE_MAP'
  | 'TREASURY'
  | 'VASSAL'
  | 'WAREHOUSE'
  | 'WHARF'
  | 'WITCH'
  | 'WORKSHOP';

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
  | 'GAIN_COSTING_UP_TO'
  | 'PUT_CARD_ONTO_DECK'
  | 'DISCARD_EXACT_COUNT'
  | 'EMBARGO_PILE'
  | 'ISLAND_SET_ASIDE'
  | 'HAVEN_SET_ASIDE'
  | 'NATIVE_VILLAGE_CHOICE'
  | 'PIRATE_SHIP_CHOICE'
  | 'SALVAGER_TRASH'
  | 'AMBASSADOR_RETURN';

export interface PendingInteraction {
  readonly playerId: string;
  readonly sourceCard: Card;
  readonly promptType: InteractionPromptType;
  readonly minCount: number;
  readonly maxCount: number;
  readonly maxCost?: number;
  /** Remaining opponent playerIds to resolve multi-player attacks (e.g. Militia, Ghost Ship) */
  readonly remainingTargetQueue?: readonly string[];
  /** Optional card type constraint (e.g. Mine requires TREASURE for both trash & gain) */
  readonly restrictedCardKind?: CardKind;
  /** Destination zone for gained card ('DISCARD' by default, 'HAND' for Mine/Artisan/Pirate) */
  readonly gainDestination?: 'DISCARD' | 'HAND' | 'HAVEN';
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
  /** Duration cards played during the current turn (will remain in play across Cleanup into next turn) */
  readonly durationCards?: readonly Card[];
  /** Duration cards played on the previous turn currently completing their 2nd phase in play */
  readonly activeDurations?: readonly Card[];
  /** Cards set aside under Haven or Blockade until the start of the player's next turn */
  readonly havenSetAside?: readonly Card[];
  /** Cards placed onto the player's Island Mat (counted for endgame Victory Points) */
  readonly islandMat?: readonly Card[];
  /** Cards placed onto the player's Native Village Mat (counted for endgame Victory Points) */
  readonly nativeVillageMat?: readonly Card[];
  /** Gold Coin tokens accumulated on the player's Pirate Ship Mat */
  readonly pirateShipTokens?: number;
  /** Cards gained by this player during their previous turn (used by Smugglers) */
  readonly gainedCardsLastTurn?: readonly Card[];
  /** Cards gained by this player during the current turn */
  readonly gainedCardsThisTurn?: readonly Card[];
  /** Whether this player bought a Victory card this turn (used by Treasury) */
  readonly boughtVictoryThisTurn?: boolean;
  /** Whether this player played Outpost this turn for an extra 3-card turn */
  readonly outpostPlayedThisTurn?: boolean;
  /** Whether the current turn is an Outpost extra turn */
  readonly isOutpostTurn?: boolean;
  /** Whether Tactician discarded at least 1 card and will trigger at the start of next turn */
  readonly tacticianPending?: boolean;
  /** Whether this player has already trashed a Silver/Gold to an opponent's Corsair this turn */
  readonly corsairTrashedThisTurn?: boolean;
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
  readonly durationCards?: readonly Card[];
  readonly activeDurations?: readonly Card[];
  readonly islandMat?: readonly Card[];
  readonly nativeVillageMat?: readonly Card[];
  readonly nativeVillageMatCount?: number;
  readonly pirateShipTokens?: number;
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
  readonly embargoTokens?: Readonly<Record<string, number>>;
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
  readonly embargoTokens?: Readonly<Record<string, number>>;
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
      readonly choice?: 'MAT_PUT' | 'MAT_TAKE' | 'PIRATE_COINS' | 'PIRATE_ATTACK';
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
