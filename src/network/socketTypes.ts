import {
  AnyGameAction,
  AnyGameState,
  AnySanitizedGameState,
  GameId,
} from '../games/registry.js';
import { DestinationTicket } from '../games/ticket-to-ride/types.js';

export type RoomStatus = 'LOBBY' | 'PLAYING' | 'FINISHED';

export interface PlayerSession {
  playerId: string;
  name: string;
  sessionToken: string; // Stored in localStorage on the client for reconnection
  socketId: string;
  connected: boolean;
  seatIndex: number;
}

export interface GameRoom {
  roomId: string;
  hostPlayerId: string;
  selectedGameId: GameId;
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
}

export interface RoomResponse {
  ok: boolean;
  roomId?: string;
  playerId?: string;
  sessionToken?: string;
  selectedGameId?: GameId;
  error?: string;
}

export interface DispatchActionResponse {
  ok: boolean;
  error?: string;
}

export interface TicketBreakdown {
  readonly ticket: DestinationTicket;
  readonly completed: boolean;
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
}

export interface StateSyncPayload {
  roomId: string;
  selectedGameId: GameId;
  status: RoomStatus;
  view: AnySanitizedGameState | null;
  playerNames: Readonly<Record<string, string>>;
  finalScores?: Readonly<Record<string, number>>;
  finalStandings?: readonly PlayerFinalStanding[];
}

export interface RoomUpdatedPayload {
  roomId: string;
  selectedGameId: GameId;
  status: RoomStatus;
  hostPlayerId: string;
  players: readonly RoomPlayerSummary[];
}

// Client -> Server events
export interface ClientToServerEvents {
  create_room: (
    data: { playerName: string; selectedGameId?: GameId },
    cb: (res: RoomResponse) => void
  ) => void;
  join_room: (
    data: { roomId: string; playerName: string; sessionToken?: string },
    cb: (res: RoomResponse) => void
  ) => void;
  select_game: (data: { roomId: string; gameId: GameId }) => void;
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
