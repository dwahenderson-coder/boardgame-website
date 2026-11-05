import { PRNGState } from '../../common/prng.js';

export type StockpileCompanyId =
  | 'GLOBAL_TELECOM'
  | 'BIOTECH'
  | 'ENERGY'
  | 'RAIL'
  | 'AUTOMOBILE'
  | 'ELECTRONIC';

export interface StockpileCompanyMeta {
  readonly id: StockpileCompanyId;
  readonly name: string;
  readonly ticker: string;
  readonly colorHex: string;
  readonly badgeClass: string;
}

export type StockpilePhase = 'PLAYING' | 'GAME_OVER';

export type StockpileTurnStep =
  | 'PHASE_2_SUPPLY'
  | 'PHASE_3_DEMAND'
  | 'PHASE_4_ACTION'
  | 'PHASE_5_SELLING'
  | 'PHASE_6_MOVEMENT_SUMMARY'
  | 'GAME_OVER';

export type ForecastType = 'CHANGE' | 'BANKRUPTCY';

export interface StockpileForecastCard {
  readonly id: string;
  readonly type: ForecastType;
  readonly delta: number; // e.g., +4, +3, +2, -2, -3, or 0 for BANKRUPTCY
  readonly label: string; // e.g., "+3", "-2", "BANKRUPTCY"
}

export interface StockpileInsiderPairing {
  readonly companyId: StockpileCompanyId;
  readonly forecast: StockpileForecastCard;
  readonly isPublic: boolean;
  readonly ownerPlayerId: string | null;
}

export type MarketCardKind = 'SHARE' | 'BOOM' | 'BUST' | 'TRADING_FEE';

export interface StockpileMarketCard {
  readonly id: string;
  readonly kind: MarketCardKind;
  readonly companyId: StockpileCompanyId | null;
  readonly shareCount: number; // 1 for standard share cards
  readonly feeAmount: number; // 1000, 2000, or 3000 for TRADING_FEE
  readonly label: string;
}

export const STOCKPILE_BID_TRACK = [0, 1, 3, 6, 10, 15, 20, 25] as const;
export type StockpileBidValue = (typeof STOCKPILE_BID_TRACK)[number];

export interface StockpilePile {
  readonly index: number;
  readonly faceUpCards: readonly StockpileMarketCard[];
  readonly faceDownCards: readonly StockpileMarketCard[];
  readonly currentBid: StockpileBidValue | null;
  readonly highBidderId: string | null;
}

export interface StockpileSanitizedPile {
  readonly index: number;
  readonly faceUpCards: readonly StockpileMarketCard[];
  readonly faceDownCount: number;
  readonly currentBid: StockpileBidValue | null;
  readonly highBidderId: string | null;
}

export interface StockpilePlayerState {
  readonly id: string;
  readonly cash: number;
  readonly portfolio: Readonly<Record<StockpileCompanyId, number>>;
  readonly supplyHand: readonly StockpileMarketCard[];
  readonly hasPlacedSupply: boolean;
  readonly pendingActionCards: readonly StockpileMarketCard[];
  readonly outbidFromPileIndex: number | null;
  readonly hasFinishedSelling: boolean;
  readonly insiderPairing: StockpileInsiderPairing | null;
  readonly lastActionLabel: string | null;
  readonly endGameStockLiquidation: number;
  readonly endGameMajorityBonus: number;
}

export interface StockpilePublicPlayerState {
  readonly id: string;
  readonly cash: number;
  readonly portfolio: Readonly<Record<StockpileCompanyId, number>>;
  readonly supplyHandCount: number;
  readonly supplyHand: readonly StockpileMarketCard[] | null;
  readonly hasPlacedSupply: boolean;
  readonly pendingActionCards: readonly StockpileMarketCard[];
  readonly outbidFromPileIndex: number | null;
  readonly hasFinishedSelling: boolean;
  readonly insiderPairing: StockpileInsiderPairing | null;
  readonly lastActionLabel: string | null;
  readonly endGameStockLiquidation: number;
  readonly endGameMajorityBonus: number;
}

export interface StockpileMovementEvent {
  readonly companyId: StockpileCompanyId;
  readonly previousPrice: number;
  readonly forecastLabel: string;
  readonly finalPrice: number;
  readonly triggeredSplit: boolean;
  readonly triggeredBankruptcy: boolean;
}

export interface StockpileGameState {
  readonly gameId: 'stockpile';
  readonly phase: StockpilePhase;
  readonly turnStep: StockpileTurnStep;
  readonly turnNumber: number;
  readonly roundNumber: number;
  readonly maxRounds: number;
  readonly playerOrder: readonly string[];
  readonly firstPlayerIndex: number;
  readonly activePlayerIndex: number;
  readonly stockPrices: Readonly<Record<StockpileCompanyId, number>>;
  readonly marketDeck: readonly StockpileMarketCard[];
  readonly marketDiscard: readonly StockpileMarketCard[];
  readonly publicPairing: StockpileInsiderPairing;
  readonly allPairings: readonly StockpileInsiderPairing[];
  readonly stockpiles: readonly StockpilePile[];
  readonly players: Readonly<Record<string, StockpilePlayerState>>;
  readonly lastRoundMovements: readonly StockpileMovementEvent[];
  readonly prng: PRNGState;
  readonly winnerId: string | null;
  readonly lastActionSummary: string | null;
}

export interface StockpileSanitizedGameState {
  readonly gameId: 'stockpile';
  readonly phase: StockpilePhase;
  readonly turnStep: StockpileTurnStep;
  readonly turnNumber: number;
  readonly roundNumber: number;
  readonly maxRounds: number;
  readonly playerOrder: readonly string[];
  readonly firstPlayerIndex: number;
  readonly activePlayerIndex: number;
  readonly activePlayerId: string;
  readonly stockPrices: Readonly<Record<StockpileCompanyId, number>>;
  readonly marketDeckCount: number;
  readonly marketDiscardCount: number;
  readonly publicPairing: StockpileInsiderPairing;
  /** Revealed only during PHASE_6_MOVEMENT_SUMMARY or GAME_OVER */
  readonly revealedPairings: readonly StockpileInsiderPairing[] | null;
  readonly stockpiles: readonly StockpileSanitizedPile[];
  readonly self: StockpilePublicPlayerState;
  readonly opponents: Readonly<Record<string, StockpilePublicPlayerState>>;
  readonly lastRoundMovements: readonly StockpileMovementEvent[];
  readonly winnerId: string | null;
  readonly lastActionSummary: string | null;
}

export type StockpileAction =
  | {
      readonly type: 'STOCKPILE_PLACE_SUPPLY';
      readonly faceUpCardId: string;
      readonly faceUpPileIndex: number;
      readonly faceDownCardId: string;
      readonly faceDownPileIndex: number;
    }
  | {
      readonly type: 'STOCKPILE_BID';
      readonly pileIndex: number;
      readonly bidAmount: StockpileBidValue;
    }
  | {
      readonly type: 'STOCKPILE_PLAY_BOOM_BUST';
      readonly cardId: string;
      readonly companyId: StockpileCompanyId;
    }
  | {
      readonly type: 'STOCKPILE_SELL_SHARES';
      readonly companyId: StockpileCompanyId;
      readonly quantity: number;
    }
  | {
      readonly type: 'STOCKPILE_FINISH_SELLING';
    }
  | {
      readonly type: 'STOCKPILE_NEXT_ROUND';
    }
  | {
      readonly type: 'STOCKPILE_AI_TURN';
    };

