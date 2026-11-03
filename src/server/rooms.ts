import { customAlphabet } from 'nanoid';
import { Graph } from '../common/graph.js';
import { CatanGameState } from '../games/catan/index.js';
import { GameId } from '../games/registry.js';
import {
  GameState as TTRGameState,
  RouteEdge,
} from '../games/ticket-to-ride/types.js';
import {
  GameRoom,
  PlayerFinalStanding,
  PlayerSession,
  RoomPlayerSummary,
} from '../network/socketTypes.js';

const generateRoomCode = customAlphabet('23456789ABCDEFGHJKLMNPQRSTUVWXYZ', 6);
const generateToken = customAlphabet(
  'abcdefghijklmnopqrstuvwxyz0123456789',
  24
);

export type JoinRoomResult =
  | {
      readonly ok: true;
      readonly room: GameRoom;
      readonly sessionToken: string;
      readonly player: PlayerSession;
      readonly reconnected: boolean;
    }
  | {
      readonly ok: false;
      readonly error: string;
    };

export class RoomManager {
  private readonly rooms = new Map<string, GameRoom>();
  private readonly socketToToken = new Map<string, string>(); // socket.id -> sessionToken

  public createRoom(
    hostName: string,
    socketId: string,
    initialGameId: GameId = 'ttr'
  ): {
    roomId: string;
    playerId: string;
    sessionToken: string;
    room: GameRoom;
  } {
    let roomId = generateRoomCode();
    while (this.rooms.has(roomId)) {
      roomId = generateRoomCode();
    }

    const sessionToken = generateToken();
    const hostPlayerId = 'p1';
    const trimmedName = hostName.trim() || 'Player 1';

    const hostSession: PlayerSession = {
      playerId: hostPlayerId,
      name: trimmedName,
      sessionToken,
      socketId,
      connected: true,
      seatIndex: 0,
    };

    const room: GameRoom = {
      roomId,
      hostPlayerId,
      selectedGameId: initialGameId,
      status: 'LOBBY',
      players: new Map([[sessionToken, hostSession]]),
      gameState: null,
    };

    this.rooms.set(roomId, room);
    this.socketToToken.set(socketId, sessionToken);

    return { roomId, playerId: hostPlayerId, sessionToken, room };
  }

  public joinRoom(
    rawRoomId: string,
    playerName: string,
    socketId: string,
    existingToken?: string
  ): JoinRoomResult {
    const roomId = rawRoomId.trim().toUpperCase();
    const room = this.rooms.get(roomId);
    if (!room) {
      return { ok: false, error: `Room "${roomId}" not found.` };
    }

    // 1. Reconnection scenario via sessionToken
    if (existingToken && room.players.has(existingToken)) {
      const session = room.players.get(existingToken)!;
      this.socketToToken.delete(session.socketId);
      session.socketId = socketId;
      session.connected = true;
      if (playerName.trim()) {
        session.name = playerName.trim();
      }
      this.socketToToken.set(socketId, existingToken);

      // If all players were disconnected and this player is first back, ensure a connected host
      const currentHostConnected = Array.from(room.players.values()).some(
        (p) => p.playerId === room.hostPlayerId && p.connected
      );
      if (!currentHostConnected) {
        room.hostPlayerId = session.playerId;
      }

      return {
        ok: true,
        room,
        sessionToken: existingToken,
        player: session,
        reconnected: true,
      };
    }

    // 2. New seat join scenario
    if (room.status !== 'LOBBY') {
      return { ok: false, error: 'Game is already in progress.' };
    }
    if (room.players.size >= 5) {
      return { ok: false, error: 'Room is full (maximum 5 players).' };
    }

    const seatIndex = room.players.size;
    const playerId = `p${seatIndex + 1}`;
    const sessionToken = generateToken();
    const trimmedName = playerName.trim() || `Player ${seatIndex + 1}`;

    const newSession: PlayerSession = {
      playerId,
      name: trimmedName,
      sessionToken,
      socketId,
      connected: true,
      seatIndex,
    };

    room.players.set(sessionToken, newSession);
    this.socketToToken.set(socketId, sessionToken);

    return {
      ok: true,
      room,
      sessionToken,
      player: newSession,
      reconnected: false,
    };
  }

  public getRoom(roomId: string): GameRoom | undefined {
    return this.rooms.get(roomId.trim().toUpperCase());
  }

  public getSessionBySocket(
    socketId: string
  ): { room: GameRoom; session: PlayerSession } | null {
    const token = this.socketToToken.get(socketId);
    if (!token) {
      return null;
    }
    for (const room of this.rooms.values()) {
      const session = room.players.get(token);
      if (session) {
        return { room, session };
      }
    }
    return null;
  }

  /**
   * Marks the socket's session as disconnected and performs automatic Host Migration
   * if the departing player was the room's host and another connected player exists.
   */
  public handleDisconnect(socketId: string): {
    room: GameRoom;
    migratedToHostId?: string;
  } | null {
    const data = this.getSessionBySocket(socketId);
    if (!data) {
      return null;
    }
    const { room, session } = data;
    session.connected = false;
    this.socketToToken.delete(socketId);

    let migratedToHostId: string | undefined;
    if (room.hostPlayerId === session.playerId) {
      const nextConnected = Array.from(room.players.values())
        .sort((a, b) => a.seatIndex - b.seatIndex)
        .find((p) => p.connected);

      if (nextConnected) {
        room.hostPlayerId = nextConnected.playerId;
        migratedToHostId = nextConnected.playerId;
      }
    }

    return {
      room,
      ...(migratedToHostId !== undefined ? { migratedToHostId } : {}),
    };
  }

  public static getPlayerSummaries(room: GameRoom): RoomPlayerSummary[] {
    return Array.from(room.players.values())
      .sort((a, b) => a.seatIndex - b.seatIndex)
      .map((p) => ({
        playerId: p.playerId,
        name: p.name,
        connected: p.connected,
        isHost: p.playerId === room.hostPlayerId,
        seatIndex: p.seatIndex,
      }));
  }

  public static getPlayerNameMap(room: GameRoom): Record<string, string> {
    const map: Record<string, string> = {};
    for (const p of room.players.values()) {
      map[p.playerId] = p.name;
    }
    return map;
  }

  /**
   * Builds the full end-of-game leaderboard for either Ticket to Ride or Catan.
   */
  public static buildFinalStandings(
    room: GameRoom
  ): readonly PlayerFinalStanding[] {
    if (!room.gameState) {
      return [];
    }
    const nameMap = RoomManager.getPlayerNameMap(room);

    if (room.selectedGameId === 'catan' || 'gameId' in room.gameState) {
      const catanState = room.gameState as CatanGameState;
      return catanState.playerOrder
        .map((playerId) => {
          const p = catanState.players[playerId]!;
          return {
            playerId,
            name: nameMap[playerId] ?? playerId,
            routePoints: p.victoryPoints,
            ticketPoints: 0,
            totalScore: p.victoryPoints,
            trainsRemaining: p.settlementsRemaining,
            tickets: [],
          };
        })
        .sort((a, b) => b.totalScore - a.totalScore);
    }

    const state = room.gameState as TTRGameState;

    const standings: PlayerFinalStanding[] = state.playerOrder.map(
      (playerId) => {
        const player = state.players[playerId]!;
        const graph = new Graph<RouteEdge>();
        for (const r of state.routes) {
          if (r.ownerId === playerId) {
            graph.addEdge(r.from, r.to, r.length, r);
          }
        }

        let ticketPoints = 0;
        const tickets = player.tickets.map((ticket) => {
          const completed = graph.isConnected(ticket.from, ticket.to);
          ticketPoints += completed ? ticket.points : -ticket.points;
          return { ticket, completed };
        });

        const totalScore = player.claimedRoutePoints + ticketPoints;

        return {
          playerId,
          name: nameMap[playerId] ?? playerId,
          routePoints: player.claimedRoutePoints,
          ticketPoints,
          totalScore,
          trainsRemaining: player.trainsRemaining,
          tickets,
        };
      }
    );

    return standings.sort((a, b) => b.totalScore - a.totalScore);
  }
}
