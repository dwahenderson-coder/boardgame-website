import {
  AnyGameAction,
  AnyGameState,
  AnySanitizedGameState,
  GameId,
} from '../games/registry.js';
import { DestinationTicket } from '../games/ticket-to-ride/types.js';
import { GameCategorySlug } from './game.js';

export type RoomStatus = 'LOBBY' | 'PLAYING' | 'FINISHED';

export interface PlayerSession {
  playerId: string;
  name: string;
  sessionToken: string; // Stored in localStorage on the client for reconnection
  socketId: string;
  connected: boolean;
  seatIndex: number;
}

export interface PlayerLobbySettings {
  colorId: string | null;
  ready: boolean;
}

export interface GameRoom {
  roomId: string;
  hostPlayerId: string;
  category: GameCategorySlug | null;
  selectedGameId: GameId;
  configuredGameId: GameId | null;
  selectedExpansions: string[];
  playerSettings: Map<string, PlayerLobbySettings>; // Keyed by playerId
  status: RoomStatus;
  players: Map<string, PlayerSession>; // Keyed by sessionToken
  gameState: AnyGameState | null;
}

export interface RoomPlayerSummary {
  playerId: string;
  name: string;
  connected: boolean;
  isHost: boolean;
  seatIndex: number;
  colorId: string | null;
  ready: boolean;
}

export interface RoomResponse {
  ok: boolean;
  roomId?: string;
  playerId?: string;
  sessionToken?: string;
  selectedGameId?: GameId;
  configuredGameId?: GameId | null;
  category?: GameCategorySlug | null;
  error?: string;
}

export interface DispatchActionResponse {
  ok: boolean;
  error?: string;
}

export interface TicketBreakdown {
  readonly ticket: DestinationTicket;
  readonly completed: boolean;
  readonly effectivePoints?: number;
  readonly isChaosHalved?: boolean;
}

export interface PlayerFinalStanding {
  readonly playerId: string;
  readonly name: string;
  readonly routePoints: number;
  readonly ticketPoints: number;
  readonly totalScore: number;
  readonly trainsRemaining: number;
  readonly tickets: readonly TicketBreakdown[];
  readonly longestPathLength?: number;
  readonly hasTransAmericaExpress?: boolean;
  readonly transAmericaExpressBonus?: number;
  readonly stationsRemaining?: number;
  readonly stationPoints?: number;
  readonly alvinCards?: number;
  readonly dexterCards?: number;
  readonly alvinBonus?: number;
  readonly dexterBonus?: number;
}

export interface StateSyncPayload {
  roomId: string;
  selectedGameId: GameId;
  selectedExpansions: readonly string[];
  playerColors: Readonly<Record<string, string>>;
  status: RoomStatus;
  view: AnySanitizedGameState | null;
  playerNames: Readonly<Record<string, string>>;
  finalScores?: Readonly<Record<string, number>>;
  finalStandings?: readonly PlayerFinalStanding[];
}

export interface RoomUpdatedPayload {
  roomId: string;
  category: GameCategorySlug | null;
  selectedGameId: GameId;
  configuredGameId: GameId | null;
  selectedExpansions: readonly string[];
  playerSettings: Readonly<Record<string, PlayerLobbySettings>>;
  playerColors: Readonly<Record<string, string>>;
  status: RoomStatus;
  hostPlayerId: string;
  players: readonly RoomPlayerSummary[];
}

// Client -> Server events
export interface ClientToServerEvents {
  create_room: (
    data: { playerName: string; selectedGameId?: GameId | null },
    cb: (res: RoomResponse) => void
  ) => void;
  join_room: (
    data: { roomId: string; playerName: string; sessionToken?: string },
    cb: (res: RoomResponse) => void
  ) => void;
  set_game_category: (data: {
    roomId: string;
    category: GameCategorySlug;
  }) => void;
  select_game: (data: { roomId: string; gameId: GameId | null }) => void;
  toggle_expansion: (data: { roomId: string; expansionId: string }) => void;
  choose_color: (data: { roomId: string; colorId: string }) => void;
  toggle_ready: (data: { roomId: string; ready?: boolean }) => void;
  start_game: (data: { roomId: string; seed?: number }) => void;
  dispatch_action: (
    data: { roomId: string; action: AnyGameAction },
    cb?: (res: DispatchActionResponse) => void
  ) => void;
  reset_to_lobby: (data: { roomId: string }) => void;
}

// Server -> Client events
export interface ServerToClientEvents {
  state_sync: (data: StateSyncPayload) => void;
  action_error: (data: { message: string }) => void;
  room_updated: (data: RoomUpdatedPayload) => void;
}

