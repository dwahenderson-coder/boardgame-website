import cors from 'cors';
import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import {
  applyAction,
  calculateFinalScores,
  getPlayerPerspective,
  initGame,
  validateAction,
} from '../games/ticket-to-ride/index.js';
import {
  ClientToServerEvents,
  GameRoom,
  ServerToClientEvents,
} from '../network/socketTypes.js';
import { RoomManager } from './rooms.js';

const app = express();

// Set allowed frontend origins (local dev + Render/Vercel production URL)
const allowedOrigins = [
  'http://localhost:5173',
  process.env['CLIENT_URL'],
  process.env['CORS_ORIGIN'],
]
  .filter((origin): origin is string => Boolean(origin && origin !== '*'));

const corsOriginConfig: boolean | string | string[] =
  process.env['CORS_ORIGIN'] === '*'
    ? true
    : allowedOrigins.length > 0
    ? allowedOrigins
    : ['http://localhost:5173'];

app.use(
  cors({
    origin: corsOriginConfig,
    credentials: true,
  })
);

// Health check endpoints for Render to monitor service availability
app.get('/healthz', (_req, res) => {
  res.status(200).send('OK');
});

app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'ttr-multiplayer-server',
    timestamp: new Date().toISOString(),
  });
});

const httpServer = createServer(app);

// Configure Socket.IO with production-ready transports
const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
  cors: {
    origin: corsOriginConfig,
    methods: ['GET', 'POST'],
    credentials: true,
  },
  // Ensure websocket is prioritized over long-polling
  transports: ['websocket', 'polling'],
});

const roomManager = new RoomManager();

function broadcastRoomLobby(room: GameRoom): void {
  io.to(room.roomId).emit('room_updated', {
    roomId: room.roomId,
    status: room.status,
    hostPlayerId: room.hostPlayerId,
    players: RoomManager.getPlayerSummaries(room),
  });
}

function broadcastSanitizedViews(room: GameRoom): void {
  const playerNames = RoomManager.getPlayerNameMap(room);
  const isGameOver =
    room.gameState !== null && room.gameState.phase === 'GAME_OVER';
  const finalScores =
    isGameOver && room.gameState
      ? calculateFinalScores(room.gameState)
      : undefined;
  const finalStandings = isGameOver
    ? RoomManager.buildFinalStandings(room)
    : undefined;

  for (const session of room.players.values()) {
    if (session.connected) {
      const sanitizedView = room.gameState
        ? getPlayerPerspective(room.gameState, session.playerId)
        : null;

      io.to(session.socketId).emit('state_sync', {
        roomId: room.roomId,
        status: room.status,
        view: sanitizedView,
        playerNames,
        ...(finalScores !== undefined ? { finalScores } : {}),
        ...(finalStandings !== undefined ? { finalStandings } : {}),
      });
    }
  }
}

io.on('connection', (socket) => {
  // 1. Create Room
  socket.on('create_room', ({ playerName }, callback) => {
    const { roomId, playerId, sessionToken, room } = roomManager.createRoom(
      playerName,
      socket.id
    );
    socket.join(roomId);
    callback({ ok: true, roomId, playerId, sessionToken });
    broadcastRoomLobby(room);
  });

  // 2. Join Room (Handles both new joins & sessionToken reconnects)
  socket.on('join_room', ({ roomId, playerName, sessionToken }, callback) => {
    const result = roomManager.joinRoom(
      roomId,
      playerName,
      socket.id,
      sessionToken
    );
    if (!result.ok) {
      callback({ ok: false, error: result.error });
      return;
    }

    const { room, player } = result;
    socket.join(room.roomId);
    callback({
      ok: true,
      roomId: room.roomId,
      playerId: player.playerId,
      sessionToken: result.sessionToken,
    });

    broadcastRoomLobby(room);

    if (
      (room.status === 'PLAYING' || room.status === 'FINISHED') &&
      room.gameState
    ) {
      const view = getPlayerPerspective(room.gameState, player.playerId);
      const isGameOver = room.gameState.phase === 'GAME_OVER';
      const finalScores = isGameOver
        ? calculateFinalScores(room.gameState)
        : undefined;
      const finalStandings = isGameOver
        ? RoomManager.buildFinalStandings(room)
        : undefined;

      socket.emit('state_sync', {
        roomId: room.roomId,
        status: room.status,
        view,
        playerNames: RoomManager.getPlayerNameMap(room),
        ...(finalScores !== undefined ? { finalScores } : {}),
        ...(finalStandings !== undefined ? { finalStandings } : {}),
      });
    }
  });

  // 3. Start Game (or Play Again rematch)
  socket.on('start_game', ({ roomId, seed }) => {
    const ctx = roomManager.getSessionBySocket(socket.id);
    if (!ctx || ctx.room.roomId !== roomId.trim().toUpperCase()) {
      return;
    }
    if (ctx.session.playerId !== ctx.room.hostPlayerId) {
      socket.emit('action_error', {
        message: 'Only the room host can start the game.',
      });
      return;
    }
    if (ctx.room.players.size < 2) {
      socket.emit('action_error', {
        message: 'At least 2 players are required to start Ticket to Ride.',
      });
      return;
    }

    const playerIds = Array.from(ctx.room.players.values())
      .sort((a, b) => a.seatIndex - b.seatIndex)
      .map((p) => p.playerId);

    const effectiveSeed = seed ?? Date.now();
    ctx.room.gameState = initGame(playerIds, effectiveSeed);
    ctx.room.status = 'PLAYING';

    broadcastRoomLobby(ctx.room);
    broadcastSanitizedViews(ctx.room);
  });

  // 4. Reset to Waiting Room Lobby (Host only)
  socket.on('reset_to_lobby', ({ roomId }) => {
    const ctx = roomManager.getSessionBySocket(socket.id);
    if (!ctx || ctx.room.roomId !== roomId.trim().toUpperCase()) {
      return;
    }
    if (ctx.session.playerId !== ctx.room.hostPlayerId) {
      socket.emit('action_error', {
        message: 'Only the room host can return the room to the lobby.',
      });
      return;
    }

    ctx.room.gameState = null;
    ctx.room.status = 'LOBBY';
    broadcastRoomLobby(ctx.room);
    broadcastSanitizedViews(ctx.room);
  });

  // 5. Dispatch Engine Action (with acknowledgement callback for Pending UI)
  socket.on('dispatch_action', ({ roomId, action }, callback) => {
    const ctx = roomManager.getSessionBySocket(socket.id);
    if (!ctx || ctx.room.roomId !== roomId.trim().toUpperCase()) {
      const msg = 'Not bound to this room.';
      socket.emit('action_error', { message: msg });
      callback?.({ ok: false, error: msg });
      return;
    }
    if (ctx.room.status !== 'PLAYING' || !ctx.room.gameState) {
      const msg = 'Game is not currently active.';
      socket.emit('action_error', { message: msg });
      callback?.({ ok: false, error: msg });
      return;
    }

    const check = validateAction(
      ctx.room.gameState,
      ctx.session.playerId,
      action
    );
    if (!check.valid) {
      const msg = check.reason ?? 'Illegal action rejected by engine.';
      socket.emit('action_error', { message: msg });
      callback?.({ ok: false, error: msg });
      return;
    }

    ctx.room.gameState = applyAction(
      ctx.room.gameState,
      ctx.session.playerId,
      action
    );

    if (ctx.room.gameState.phase === 'GAME_OVER') {
      ctx.room.status = 'FINISHED';
      broadcastRoomLobby(ctx.room);
    }

    callback?.({ ok: true });
    broadcastSanitizedViews(ctx.room);
  });

  // 6. Handle Disconnect & Automatic Host Migration
  socket.on('disconnect', () => {
    const res = roomManager.handleDisconnect(socket.id);
    if (res) {
      broadcastRoomLobby(res.room);
    }
  });
});

// Render injects PORT dynamically; default to 3001 locally
const PORT = process.env['PORT'] || 3001;

httpServer.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
