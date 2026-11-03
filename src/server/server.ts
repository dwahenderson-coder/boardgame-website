import cors from 'cors';
import 'dotenv/config';
import express from 'express';
import fs from 'fs';
import { createServer } from 'http';
import path from 'path';
import { Server } from 'socket.io';
import { fileURLToPath } from 'url';
import { GameId, GameRegistry } from '../games/registry.js';
import {
  ClientToServerEvents,
  GameRoom,
  ServerToClientEvents,
} from '../network/socketTypes.js';
import { RoomManager } from './rooms.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Set allowed frontend origins (same-origin + local dev + optional external CLIENT_URL)
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3001',
  process.env['CLIENT_URL'],
  process.env['CORS_ORIGIN'],
].filter((origin): origin is string => Boolean(origin && origin !== '*'));

const corsOriginConfig: boolean | string | string[] =
  process.env['CORS_ORIGIN'] === '*' || !process.env['CLIENT_URL']
    ? true
    : allowedOrigins;

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
    service: 'boardgames-multiplayer-server',
    timestamp: new Date().toISOString(),
  });
});

// Serve the compiled Vite React frontend (`dist/client`) when present
const clientDistPath = path.resolve(__dirname, '../../dist/client');
const clientIndexHtml = path.join(clientDistPath, 'index.html');

if (fs.existsSync(clientIndexHtml)) {
  app.use(express.static(clientDistPath));

  // SPA fallback for `/`, `/join/:code`, and `/room/:code`
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/socket.io')) {
      next();
      return;
    }
    res.sendFile(clientIndexHtml);
  });
}

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
    selectedGameId: room.selectedGameId,
    status: room.status,
    hostPlayerId: room.hostPlayerId,
    players: RoomManager.getPlayerSummaries(room),
  });
}

function broadcastSanitizedViews(room: GameRoom): void {
  const engine = GameRegistry[room.selectedGameId];
  const playerNames = RoomManager.getPlayerNameMap(room);
  const isGameOver =
    room.gameState !== null && room.gameState.phase === 'GAME_OVER';
  const finalScores =
    isGameOver && room.gameState
      ? engine.calculateFinalScores(room.gameState)
      : undefined;
  const finalStandings = isGameOver
    ? RoomManager.buildFinalStandings(room)
    : undefined;

  for (const session of room.players.values()) {
    if (session.connected) {
      const sanitizedView = room.gameState
        ? engine.getPlayerPerspective(room.gameState, session.playerId)
        : null;

      io.to(session.socketId).emit('state_sync', {
        roomId: room.roomId,
        selectedGameId: room.selectedGameId,
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
  socket.on('create_room', ({ playerName, selectedGameId }, callback) => {
    const validGameId: GameId =
      selectedGameId && selectedGameId in GameRegistry ? selectedGameId : 'ttr';
    const { roomId, playerId, sessionToken, room } = roomManager.createRoom(
      playerName,
      socket.id,
      validGameId
    );
    socket.join(roomId);
    callback({
      ok: true,
      roomId,
      playerId,
      sessionToken,
      selectedGameId: room.selectedGameId,
    });
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
      selectedGameId: room.selectedGameId,
    });

    broadcastRoomLobby(room);

    if (
      (room.status === 'PLAYING' || room.status === 'FINISHED') &&
      room.gameState
    ) {
      const engine = GameRegistry[room.selectedGameId];
      const view = engine.getPlayerPerspective(room.gameState, player.playerId);
      const isGameOver = room.gameState.phase === 'GAME_OVER';
      const finalScores = isGameOver
        ? engine.calculateFinalScores(room.gameState)
        : undefined;
      const finalStandings = isGameOver
        ? RoomManager.buildFinalStandings(room)
        : undefined;

      socket.emit('state_sync', {
        roomId: room.roomId,
        selectedGameId: room.selectedGameId,
        status: room.status,
        view,
        playerNames: RoomManager.getPlayerNameMap(room),
        ...(finalScores !== undefined ? { finalScores } : {}),
        ...(finalStandings !== undefined ? { finalStandings } : {}),
      });
    }
  });

  // 3. Select Game (Host only during LOBBY phase)
  socket.on('select_game', ({ roomId, gameId }) => {
    const ctx = roomManager.getSessionBySocket(socket.id);
    if (!ctx || ctx.room.roomId !== roomId.trim().toUpperCase()) {
      return;
    }
    if (ctx.session.playerId !== ctx.room.hostPlayerId) {
      socket.emit('action_error', {
        message: 'Only the room host can change the selected game.',
      });
      return;
    }
    if (ctx.room.status !== 'LOBBY') {
      socket.emit('action_error', {
        message: 'Cannot switch games while a match is already in progress.',
      });
      return;
    }
    if (!(gameId in GameRegistry)) {
      socket.emit('action_error', {
        message: `Unknown game ID: ${gameId}`,
      });
      return;
    }

    ctx.room.selectedGameId = gameId;
    broadcastRoomLobby(ctx.room);
  });

  // 4. Start Game (or Play Again rematch) — Looks up engine from GameRegistry
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

    const engine = GameRegistry[ctx.room.selectedGameId];
    const currentCount = ctx.room.players.size;

    if (currentCount < engine.minPlayers) {
      const needed = engine.minPlayers - currentCount;
      socket.emit('action_error', {
        message: `${engine.title} requires at least ${engine.minPlayers} players (need ${needed} more player${needed === 1 ? '' : 's'}).`,
      });
      return;
    }

    if (currentCount > engine.maxPlayers) {
      socket.emit('action_error', {
        message: `${engine.title} supports at most ${engine.maxPlayers} players (currently ${currentCount} in lobby).`,
      });
      return;
    }

    const playerIds = Array.from(ctx.room.players.values())
      .sort((a, b) => a.seatIndex - b.seatIndex)
      .map((p) => p.playerId);

    const effectiveSeed = seed ?? Date.now();
    ctx.room.gameState = engine.initGame(playerIds, effectiveSeed);
    ctx.room.status = 'PLAYING';

    broadcastRoomLobby(ctx.room);
    broadcastSanitizedViews(ctx.room);
  });

  // 5. Reset to Waiting Room Lobby (Host only)
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

  // 6. Dispatch Engine Action — Routed through GameRegistry[room.selectedGameId]
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

    const engine = GameRegistry[ctx.room.selectedGameId];
    const check = engine.validateAction(
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

    const nextState = engine.applyAction(
      ctx.room.gameState,
      ctx.session.playerId,
      action
    );
    ctx.room.gameState = nextState;

    if (nextState.phase === 'GAME_OVER') {
      ctx.room.status = 'FINISHED';
      broadcastRoomLobby(ctx.room);
    }

    callback?.({ ok: true });
    broadcastSanitizedViews(ctx.room);
  });

  // 7. Handle Disconnect & Automatic Host Migration
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
