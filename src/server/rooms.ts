import { customAlphabet } from 'nanoid';
import { CatanGameState } from '../games/catan/index.js';
import { ClueGameState } from '../games/clue/index.js';
import { CribbageGameState } from '../games/cribbage/index.js';
import {
  calculatePlayerVictoryPoints,
  DominionGameState,
  getAllOwnedCards,
} from '../games/dominion/index.js';
import { EuchreGameState } from '../games/euchre/index.js';
import { KingsCornersGameState } from '../games/kings-corners/index.js';
import {
  calculateMaxPoweredCities,
  PowerGridGameState,
} from '../games/power-grid/index.js';
import {
  calculateStockpileNetWorth,
  StockpileGameState,
} from '../games/stockpile/index.js';
import { HoldemGameState } from '../games/texas-holdem/index.js';
import { GameId } from '../games/registry.js';
import {
  ALVIN_BONUS_POINTS,
  DEXTER_BONUS_POINTS,
  evaluatePlayerTickets,
  getEffectiveTicketPoints,
  getMonsterBonusRecipients,
  getTransAmericaExpressRecipients,
  TRANS_AMERICA_EXPRESS_BONUS,
} from '../games/ticket-to-ride/engine.js';
import { UNUSED_STATION_POINTS } from '../games/ticket-to-ride/constants.js';
import {
  GameState as TTRGameState,
} from '../games/ticket-to-ride/types.js';
import {
  GameRoom,
  PlayerFinalStanding,
  PlayerLobbySettings,
  PlayerSession,
  RoomPlayerSummary,
} from '../network/socketTypes.js';
import { GAME_CATALOG_BY_ID } from '../registry/catalog.js';

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
    initialGameId: GameId | null = 'ttr'
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

    const resolvedGameId: GameId =
      initialGameId && initialGameId in GAME_CATALOG_BY_ID
        ? initialGameId
        : 'ttr';
    const catalogEntry = GAME_CATALOG_BY_ID[resolvedGameId];

    const room: GameRoom = {
      roomId,
      hostPlayerId,
      category: catalogEntry.category,
      selectedGameId: resolvedGameId,
      configuredGameId: initialGameId ? resolvedGameId : null,
      selectedExpansions: [],
      playerSettings: new Map([[hostPlayerId, { colorId: null, ready: false }]]),
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
      if (!room.playerSettings.has(session.playerId)) {
        room.playerSettings.set(session.playerId, {
          colorId: null,
          ready: false,
        });
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
    if (room.players.size >= 6) {
      return { ok: false, error: 'Room is full (maximum 6 players).' };
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
    room.playerSettings.set(playerId, { colorId: null, ready: false });
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
   * Marks the socket's session as disconnected, releases any claimed lobby color
   * so other players can use it while in LOBBY, and performs automatic Host Migration.
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

    // Release claimed color and ready status if still in LOBBY
    if (room.status === 'LOBBY') {
      room.playerSettings.set(session.playerId, {
        colorId: null,
        ready: false,
      });
    }

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

  public static resetLobbyPlayerSettings(room: GameRoom): void {
    for (const session of room.players.values()) {
      room.playerSettings.set(session.playerId, {
        colorId: null,
        ready: false,
      });
    }
  }

  public static getPlayerSettingsRecord(
    room: GameRoom
  ): Record<string, PlayerLobbySettings> {
    const record: Record<string, PlayerLobbySettings> = {};
    for (const session of room.players.values()) {
      record[session.playerId] = room.playerSettings.get(session.playerId) ?? {
        colorId: null,
        ready: false,
      };
    }
    return record;
  }

  public static getPlayerColorsRecord(room: GameRoom): Record<string, string> {
    const colors: Record<string, string> = {};
    for (const session of room.players.values()) {
      const colorId = room.playerSettings.get(session.playerId)?.colorId;
      if (colorId) {
        colors[session.playerId] = colorId;
      }
    }
    return colors;
  }

  public static getPlayerSummaries(room: GameRoom): RoomPlayerSummary[] {
    return Array.from(room.players.values())
      .sort((a, b) => a.seatIndex - b.seatIndex)
      .map((p) => {
        const settings = room.playerSettings.get(p.playerId);
        return {
          playerId: p.playerId,
          name: p.name,
          connected: p.connected,
          isHost: p.playerId === room.hostPlayerId,
          seatIndex: p.seatIndex,
          colorId: settings?.colorId ?? null,
          ready: settings?.ready ?? false,
        };
      });
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

    if (
      room.selectedGameId === 'power_grid' ||
      ('gameId' in room.gameState && room.gameState.gameId === 'power_grid')
    ) {
      const pgState = room.gameState as PowerGridGameState;
      return pgState.turnOrder
        .map((playerId) => {
          const p = pgState.players[playerId]!;
          const powered = calculateMaxPoweredCities(p);
          return {
            playerId,
            name: nameMap[playerId] ?? playerId,
            routePoints: powered,
            ticketPoints: p.money,
            totalScore: powered,
            trainsRemaining: p.cities.length,
            tickets: [],
          };
        })
        .sort((a, b) =>
          b.totalScore !== a.totalScore
            ? b.totalScore - a.totalScore
            : b.ticketPoints - a.ticketPoints
        );
    }

    if (
      room.selectedGameId === 'stockpile' ||
      ('gameId' in room.gameState && room.gameState.gameId === 'stockpile')
    ) {
      const spState = room.gameState as StockpileGameState;
      return spState.playerOrder
        .map((playerId) => {
          const p = spState.players[playerId]!;
          const netWorth = calculateStockpileNetWorth(spState, playerId);
          return {
            playerId,
            name: nameMap[playerId] ?? playerId,
            routePoints: p.cash - p.endGameMajorityBonus,
            ticketPoints: p.endGameMajorityBonus,
            totalScore: netWorth,
            trainsRemaining: 0,
            tickets: [],
          };
        })
        .sort((a, b) => b.totalScore - a.totalScore);
    }

    if (
      room.selectedGameId === 'euchre' ||
      ('gameId' in room.gameState && room.gameState.gameId === 'euchre')
    ) {
      const euchreState = room.gameState as EuchreGameState;
      return euchreState.playerOrder
        .map((playerId) => {
          const p = euchreState.players[playerId]!;
          return {
            playerId,
            name: nameMap[playerId] ?? playerId,
            routePoints: p.score,
            ticketPoints: 0,
            totalScore: p.score,
            trainsRemaining: p.tricksWonThisHand,
            tickets: [],
          };
        })
        .sort((a, b) => b.totalScore - a.totalScore);
    }

    if (
      room.selectedGameId === 'cribbage' ||
      ('gameId' in room.gameState && room.gameState.gameId === 'cribbage')
    ) {
      const cribState = room.gameState as CribbageGameState;
      return cribState.playerOrder
        .map((playerId) => {
          const p = cribState.players[playerId]!;
          return {
            playerId,
            name: nameMap[playerId] ?? playerId,
            routePoints: p.score,
            ticketPoints: 0,
            totalScore: p.score,
            trainsRemaining: 0,
            tickets: [],
          };
        })
        .sort((a, b) => b.totalScore - a.totalScore);
    }

    if (
      room.selectedGameId === 'kings_corners' ||
      ('gameId' in room.gameState && room.gameState.gameId === 'kings_corners')
    ) {
      const kcState = room.gameState as KingsCornersGameState;
      return kcState.playerOrder
        .map((playerId) => {
          const p = kcState.players[playerId]!;
          return {
            playerId,
            name: nameMap[playerId] ?? playerId,
            routePoints: p.quarters,
            ticketPoints: 0,
            totalScore: p.quarters,
            trainsRemaining: p.lastHandScore ?? 0,
            tickets: [],
          };
        })
        .sort((a, b) => b.totalScore - a.totalScore);
    }

    if (
      room.selectedGameId === 'dominion' ||
      ('gameId' in room.gameState && room.gameState.gameId === 'dominion')
    ) {
      const domState = room.gameState as DominionGameState;
      return domState.playerOrder
        .map((playerId) => {
          const p = domState.players[playerId]!;
          const vp = calculatePlayerVictoryPoints(p);
          return {
            playerId,
            name: nameMap[playerId] ?? playerId,
            routePoints: vp,
            ticketPoints: 0,
            totalScore: vp,
            trainsRemaining: getAllOwnedCards(p).length,
            tickets: [],
          };
        })
        .sort((a, b) => b.totalScore - a.totalScore);
    }

    if (
      room.selectedGameId === 'holdem' ||
      ('gameId' in room.gameState && room.gameState.gameId === 'holdem')
    ) {
      const holdemState = room.gameState as HoldemGameState;
      return holdemState.playerOrder
        .map((playerId) => {
          const p = holdemState.players[playerId]!;
          return {
            playerId,
            name: nameMap[playerId] ?? playerId,
            routePoints: p.chips,
            ticketPoints: 0,
            totalScore: p.chips,
            trainsRemaining: p.handsWon,
            tickets: [],
          };
        })
        .sort((a, b) => b.totalScore - a.totalScore);
    }

    if (
      room.selectedGameId === 'catan' ||
      ('gameId' in room.gameState && room.gameState.gameId === 'catan')
    ) {
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

    if (
      room.selectedGameId === 'clue' ||
      ('gameId' in room.gameState && room.gameState.gameId === 'clue')
    ) {
      const clueState = room.gameState as ClueGameState;
      return clueState.playerOrder
        .map((playerId) => {
          const p = clueState.players[playerId]!;
          const isWinner = clueState.winnerId === playerId ? 1 : 0;
          return {
            playerId,
            name: `${nameMap[playerId] ?? playerId} (${p.suspect})`,
            routePoints: isWinner,
            ticketPoints: 0,
            totalScore: isWinner,
            trainsRemaining: p.hand.length,
            tickets: [],
          };
        })
        .sort((a, b) => b.totalScore - a.totalScore);
    }

    const state = room.gameState as TTRGameState;
    const { longestPathByPlayer, recipients } =
      getTransAmericaExpressRecipients(state);
    const recipientSet = new Set(recipients);
    const { alvinRecipients, dexterRecipients } =
      getMonsterBonusRecipients(state);
    const alvinBonusSet = new Set(alvinRecipients);
    const dexterBonusSet = new Set(dexterRecipients);

    const standings: PlayerFinalStanding[] = state.playerOrder.map(
      (playerId) => {
        const player = state.players[playerId]!;
        const { ticketDelta: ticketPoints, completedTicketIds } =
          evaluatePlayerTickets(state, playerId);

        const tickets = player.tickets.map((ticket) => {
          const completed = completedTicketIds.has(ticket.id);
          const { points: effectivePoints, isChaosHalved } =
            getEffectiveTicketPoints(ticket, state);
          return {
            ticket,
            completed,
            effectivePoints,
            isChaosHalved,
          };
        });

        const stationPoints =
          state.mapId === 'EUROPE'
            ? (player.stationsRemaining ?? 0) * UNUSED_STATION_POINTS
            : 0;
        const hasTransAmericaExpress = recipientSet.has(playerId);
        const transAmericaExpressBonus = hasTransAmericaExpress
          ? TRANS_AMERICA_EXPRESS_BONUS
          : 0;
        const alvinBonus = alvinBonusSet.has(playerId) ? ALVIN_BONUS_POINTS : 0;
        const dexterBonus = dexterBonusSet.has(playerId)
          ? DEXTER_BONUS_POINTS
          : 0;
        const totalScore =
          player.claimedRoutePoints +
          ticketPoints +
          stationPoints +
          transAmericaExpressBonus +
          alvinBonus +
          dexterBonus;

        return {
          playerId,
          name: nameMap[playerId] ?? playerId,
          routePoints: player.claimedRoutePoints,
          ticketPoints,
          totalScore,
          trainsRemaining: player.trainsRemaining,
          tickets,
          longestPathLength: longestPathByPlayer[playerId] ?? 0,
          hasTransAmericaExpress,
          transAmericaExpressBonus,
          ...(state.mapId === 'EUROPE'
            ? {
                stationsRemaining: player.stationsRemaining ?? 0,
                stationPoints,
              }
            : {}),
          ...(state.alvinAndDexter?.enabled
            ? {
                alvinCards: player.alvinCards ?? 0,
                dexterCards: player.dexterCards ?? 0,
                alvinBonus,
                dexterBonus,
              }
            : {}),
        };
      }
    );

    return standings.sort((a, b) => {
      if (b.totalScore !== a.totalScore) {
        return b.totalScore - a.totalScore;
      }
      // Tie-breaker: The player who has the Trans America Express wins a tie!
      const aExpress = a.hasTransAmericaExpress ? 1 : 0;
      const bExpress = b.hasTransAmericaExpress ? 1 : 0;
      return bExpress - aExpress;
    });
  }
}
