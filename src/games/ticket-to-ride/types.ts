import { DeckState } from '../../mechanics/deck.js';

export type TrainCardColor =
  | 'RED'
  | 'BLUE'
  | 'GREEN'
  | 'YELLOW'
  | 'BLACK'
  | 'WHITE'
  | 'ORANGE'
  | 'PINK'
  | 'LOCOMOTIVE';

export type RouteColor = TrainCardColor | 'GRAY';

export type MonsterType = 'ALVIN' | 'DEXTER';

export type TTRMapId = 'USA' | 'EUROPE';

export interface DestinationTicket {
  readonly id: string;
  readonly from: string;
  readonly to: string;
  readonly points: number;
  readonly isLongRoute?: boolean;
}

export interface RouteEdge {
  readonly id: string;
  readonly from: string;
  readonly to: string;
  readonly length: number;
  readonly color: RouteColor;
  readonly ownerId: string | null;
  readonly routeIndex: number; // 0 for single or first double-route, 1 for parallel double-route
  readonly ferryLocomotives?: number; // Required locomotives to claim a Ferry route on Europe map
  readonly isTunnel?: boolean; // Mountain Tunnel route on Europe map
}

export type HandCounts = Readonly<Record<TrainCardColor, number>>;

export interface PlayerState {
  readonly id: string;
  readonly hand: HandCounts;
  readonly tickets: readonly DestinationTicket[];
  readonly pendingTickets: readonly DestinationTicket[];
  readonly minTicketsToKeep: number;
  readonly trainsRemaining: number;
  readonly claimedRoutePoints: number;
  readonly recentDrawnCards: Partial<Record<TrainCardColor, number>>;
  readonly stationsRemaining?: number;
  readonly alvinCards?: number;
  readonly dexterCards?: number;
  readonly faceUpAlvinTurnsRemaining?: number;
  readonly faceUpDexterTurnsRemaining?: number;
}

export interface AlvinAndDexterState {
  readonly enabled: boolean;
  readonly alvinCity: string | null;
  readonly dexterCity: string | null;
  readonly alvinDeckRemaining: number;
  readonly dexterDeckRemaining: number;
  readonly movedMonsterThisTurn: boolean;
  readonly monsterToPlace: MonsterType | null;
}

export type GamePhase =
  | 'INITIAL_TICKET_SELECTION'
  | 'MONSTER_PLACEMENT'
  | 'PLAYING'
  | 'FINAL_ROUND'
  | 'GAME_OVER';

export type TurnStep =
  | 'AWAITING_ACTION'
  | 'DREW_ONE_CARD'
  | 'CHOOSING_TICKETS'
  | 'PLACING_MONSTER';

export interface GameState {
  readonly mapId?: TTRMapId;
  readonly phase: GamePhase;
  readonly playerOrder: readonly string[];
  readonly activePlayerIndex: number;
  readonly turnStep: TurnStep;
  readonly players: Readonly<Record<string, PlayerState>>;
  readonly routes: readonly RouteEdge[];
  readonly stations?: Readonly<Record<string, string>>;
  readonly faceUpCards: readonly (TrainCardColor | null)[];
  readonly trainDeck: DeckState<TrainCardColor>;
  readonly ticketDeck: DeckState<DestinationTicket>;
  readonly finalRoundTriggeredBy: string | null;
  readonly turnsRemainingInFinalRound: number;
  readonly turnNumber: number;
  readonly lastActionSummary: string | null;
  readonly alvinAndDexter?: AlvinAndDexterState;
}

export interface SanitizedOpponentState {
  readonly id: string;
  readonly handCount: number;
  readonly ticketCount: number;
  readonly pendingTicketCount: number;
  readonly trainsRemaining: number;
  readonly claimedRoutePoints: number;
  readonly stationsRemaining?: number;
  readonly hasFaceUpAlvin?: boolean;
  readonly hasFaceUpDexter?: boolean;
}

export interface SanitizedGameState {
  readonly mapId?: TTRMapId;
  readonly phase: GamePhase;
  readonly playerOrder: readonly string[];
  readonly activePlayerId: string;
  readonly turnStep: TurnStep;
  readonly self: PlayerState;
  readonly opponents: Readonly<Record<string, SanitizedOpponentState>>;
  readonly routes: readonly RouteEdge[];
  readonly stations?: Readonly<Record<string, string>>;
  readonly faceUpCards: readonly (TrainCardColor | null)[];
  readonly trainDeckCount: number;
  readonly trainDiscardCount: number;
  readonly ticketDeckCount: number;
  readonly finalRoundTriggeredBy: string | null;
  readonly turnsRemainingInFinalRound: number;
  readonly turnNumber: number;
  readonly lastActionSummary: string | null;
  readonly alvinAndDexter?: AlvinAndDexterState;
}

// --- Turn Actions ---

export interface DrawCardFromDeckAction {
  readonly type: 'DRAW_CARDS';
  readonly source: 'DECK';
}

export interface DrawCardFromFaceUpAction {
  readonly type: 'DRAW_CARDS';
  readonly source: 'FACE_UP';
  readonly slotIndex: number; // 0..4
}

export type DrawCardsAction = DrawCardFromDeckAction | DrawCardFromFaceUpAction;

export interface ClaimRouteAction {
  readonly type: 'CLAIM_ROUTE';
  readonly routeId: string;
  readonly payment: Partial<Record<TrainCardColor, number>>;
}

export interface DrawTicketsAction {
  readonly type: 'DRAW_TICKETS';
}

export interface KeepTicketsAction {
  readonly type: 'KEEP_TICKETS';
  readonly ticketIds: readonly string[];
}

export interface PlaceMonsterAction {
  readonly type: 'PLACE_MONSTER';
  readonly monster: MonsterType;
  readonly cityName: string;
}

export interface MoveMonsterAction {
  readonly type: 'MOVE_MONSTER';
  readonly monster: MonsterType;
  readonly locomotivesSpent: 1 | 2;
  readonly targetCity: string;
}

export interface BuildStationAction {
  readonly type: 'BUILD_STATION';
  readonly cityName: string;
  readonly payment: Partial<Record<TrainCardColor, number>>;
}

export type Action =
  | DrawCardsAction
  | ClaimRouteAction
  | DrawTicketsAction
  | KeepTicketsAction
  | PlaceMonsterAction
  | MoveMonsterAction
  | BuildStationAction;

export interface ValidationResult {
  readonly valid: boolean;
  readonly reason?: string;
}
