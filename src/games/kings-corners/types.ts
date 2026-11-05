import { StandardCard } from '../../common/cards/index.js';
import { PRNGState } from '../../common/prng.js';

export type KingsCornersPhase = 'PLAYING' | 'GAME_OVER';
export type KingsCornersTurnStep =
  | 'INITIAL_PEEK'
  | 'AWAITING_TURN_ACTION'
  | 'DECIDING_DRAWN_CARD'
  | 'HAND_OVER';

export type KingsCornersPeekRow = 'TOP' | 'BOTTOM';

export interface KingsCornersPlayerState {
  readonly id: string;
  readonly quarters: number;
  readonly eliminated: boolean;
  /** 4 slots: 0 = Top-Left, 1 = Top-Right, 2 = Bottom-Left, 3 = Bottom-Right */
  readonly cards: readonly [
    StandardCard,
    StandardCard,
    StandardCard,
    StandardCard,
  ];
  readonly peekedRow: KingsCornersPeekRow | null;
  readonly readyAfterPeek: boolean;
  readonly lastActionLabel: string | null;
  readonly lastHandScore: number | null;
}

export interface KingsCornersSanitizedPlayerState {
  readonly id: string;
  readonly quarters: number;
  readonly eliminated: boolean;
  /**
   * Each of the 4 slots is `StandardCard` ONLY when visible to the viewing player
   * (i.e. their chosen 2 cards during `INITIAL_PEEK` before locking in, or all 4 cards at `HAND_OVER` / `GAME_OVER`).
   * During active play (`AWAITING_TURN_ACTION` / `DECIDING_DRAWN_CARD`), all 4 slots are `null` (face-down)!
   */
  readonly visibleSlots: readonly [
    StandardCard | null,
    StandardCard | null,
    StandardCard | null,
    StandardCard | null,
  ];
  readonly peekedRow: KingsCornersPeekRow | null;
  readonly readyAfterPeek: boolean;
  readonly lastActionLabel: string | null;
  readonly lastHandScore: number | null;
}

export interface KingsCornersHandSummary {
  readonly handNumber: number;
  readonly knockerId: string;
  readonly highestScore: number;
  readonly lowestScore: number;
  readonly scoresByPlayer: Readonly<Record<string, number>>;
  readonly losers: readonly string[];
  readonly isPush: boolean;
  readonly pushReason: string | null;
}

export interface KingsCornersGameState {
  readonly gameId: 'kings_corners';
  readonly phase: KingsCornersPhase;
  readonly turnStep: KingsCornersTurnStep;
  readonly turnNumber: number;
  readonly handNumber: number;
  readonly playerOrder: readonly string[];
  readonly dealerIndex: number;
  readonly activePlayerIndex: number;
  readonly knockerId: string | null;
  readonly potQuarters: number;
  readonly drawPile: readonly StandardCard[];
  readonly discardPile: readonly StandardCard[];
  readonly pendingDrawnCard: StandardCard | null;
  readonly players: Readonly<Record<string, KingsCornersPlayerState>>;
  readonly prng: PRNGState;
  readonly winnerId: string | null;
  readonly lastActionSummary: string | null;
  readonly lastHandSummary: KingsCornersHandSummary | null;
}

export interface KingsCornersSanitizedGameState {
  readonly gameId: 'kings_corners';
  readonly phase: KingsCornersPhase;
  readonly turnStep: KingsCornersTurnStep;
  readonly turnNumber: number;
  readonly handNumber: number;
  readonly playerOrder: readonly string[];
  readonly dealerIndex: number;
  readonly activePlayerIndex: number;
  readonly activePlayerId: string;
  readonly knockerId: string | null;
  readonly potQuarters: number;
  readonly drawPileCount: number;
  readonly discardTopCard: StandardCard | null;
  readonly discardPileCount: number;
  /** Visible only to the active player during `DECIDING_DRAWN_CARD` */
  readonly pendingDrawnCard: StandardCard | null;
  readonly self: KingsCornersSanitizedPlayerState;
  readonly opponents: Readonly<
    Record<string, KingsCornersSanitizedPlayerState>
  >;
  readonly winnerId: string | null;
  readonly lastActionSummary: string | null;
  readonly lastHandSummary: KingsCornersHandSummary | null;
}

export type KingsCornersAction =
  | {
      readonly type: 'KC_PEEK_CARDS';
      readonly row: KingsCornersPeekRow;
    }
  | {
      readonly type: 'KC_FINISH_PEEK';
    }
  | {
      readonly type: 'KC_DRAW_DECK';
    }
  | {
      readonly type: 'KC_USE_DRAWN';
      readonly replaceSlotIndex: 0 | 1 | 2 | 3;
    }
  | {
      readonly type: 'KC_DISCARD_DRAWN';
    }
  | {
      readonly type: 'KC_TAKE_DISCARD';
      readonly replaceSlotIndex: 0 | 1 | 2 | 3;
    }
  | {
      readonly type: 'KC_KNOCK';
    }
  | {
      readonly type: 'KC_NEXT_HAND';
    };

