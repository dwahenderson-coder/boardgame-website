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
import { GAME_CATALOG_BY_ID } from '../registry/catalog.js';
import { getEffectivePlayerBounds } from '../types/game.js';
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
    category: room.category,
    selectedGameId: room.selectedGameId,
    configuredGameId: room.configuredGameId,
    selectedExpansions: room.selectedExpansions,
    playerSettings: RoomManager.getPlayerSettingsRecord(room),
    playerColors: RoomManager.getPlayerColorsRecord(room),
    status: room.status,
    hostPlayerId: room.hostPlayerId,
    players: RoomManager.getPlayerSummaries(room),
  });
}

function broadcastSanitizedViews(room: GameRoom): void {
  const engine = GameRegistry[room.selectedGameId];
  const playerNames = RoomManager.getPlayerNameMap(room);
  const playerColors = RoomManager.getPlayerColorsRecord(room);
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
        selectedExpansions: room.selectedExpansions,
        playerColors,
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
    const validGameId: GameId | null =
      selectedGameId && selectedGameId in GameRegistry ? selectedGameId : null;
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
      configuredGameId: room.configuredGameId,
      category: room.category,
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
      configuredGameId: room.configuredGameId,
      category: room.category,
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
        selectedExpansions: room.selectedExpansions,
        playerColors: RoomManager.getPlayerColorsRecord(room),
        status: room.status,
        view,
        playerNames: RoomManager.getPlayerNameMap(room),
        ...(finalScores !== undefined ? { finalScores } : {}),
        ...(finalStandings !== undefined ? { finalStandings } : {}),
      });
    }
  });

  // 3A. Set Game Category (Host only during LOBBY phase)
  socket.on('set_game_category', ({ roomId, category }) => {
    const ctx = roomManager.getSessionBySocket(socket.id);
    if (!ctx || ctx.room.roomId !== roomId.trim().toUpperCase()) {
      return;
    }
    if (ctx.session.playerId !== ctx.room.hostPlayerId) {
      socket.emit('action_error', {
        message: 'Only the room host can change the game category.',
      });
      return;
    }
    if (ctx.room.status !== 'LOBBY') {
      socket.emit('action_error', {
        message: 'Cannot change category while a match is in progress.',
      });
      return;
    }
    if (category !== 'board' && category !== 'card') {
      socket.emit('action_error', {
        message: `Invalid category: ${String(category)}`,
      });
      return;
    }

    ctx.room.category = category;
    ctx.room.configuredGameId = null;
    ctx.room.selectedExpansions = [];
    RoomManager.resetLobbyPlayerSettings(ctx.room);
    broadcastRoomLobby(ctx.room);
  });

  // 3B. Select Game (Host only during LOBBY phase; pass null to return to Step 1)
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

    if (gameId === null) {
      ctx.room.configuredGameId = null;
      ctx.room.selectedExpansions = [];
      RoomManager.resetLobbyPlayerSettings(ctx.room);
      broadcastRoomLobby(ctx.room);
      return;
    }

    if (!(gameId in GameRegistry)) {
      socket.emit('action_error', {
        message: `Unknown game ID: ${gameId}`,
      });
      return;
    }

    const catalogEntry = GAME_CATALOG_BY_ID[gameId];
    ctx.room.category = catalogEntry.category;
    ctx.room.selectedGameId = gameId;
    ctx.room.configuredGameId = gameId;
    ctx.room.selectedExpansions = [];
    RoomManager.resetLobbyPlayerSettings(ctx.room);
    broadcastRoomLobby(ctx.room);
  });

  // 3C. Toggle Expansion (Host only during LOBBY phase)
  socket.on('toggle_expansion', ({ roomId, expansionId }) => {
    const ctx = roomManager.getSessionBySocket(socket.id);
    if (!ctx || ctx.room.roomId !== roomId.trim().toUpperCase()) {
      return;
    }
    if (ctx.session.playerId !== ctx.room.hostPlayerId) {
      socket.emit('action_error', {
        message: 'Only the room host can toggle game expansions.',
      });
      return;
    }
    if (ctx.room.status !== 'LOBBY') {
      socket.emit('action_error', {
        message: 'Cannot modify expansions while a match is in progress.',
      });
      return;
    }

    const activeGameId = ctx.room.configuredGameId ?? ctx.room.selectedGameId;
    const catalogEntry = GAME_CATALOG_BY_ID[activeGameId];
    const expansion = catalogEntry.expansions.find(
      (e) => e.id === expansionId
    );
    if (!expansion) {
      socket.emit('action_error', {
        message: `Expansion "${expansionId}" is not valid for ${catalogEntry.name}.`,
      });
      return;
    }

    const isCurrentlyEnabled =
      ctx.room.selectedExpansions.includes(expansionId);
    const nextExpansions = isCurrentlyEnabled
      ? ctx.room.selectedExpansions.filter((id) => id !== expansionId)
      : [...ctx.room.selectedExpansions, expansionId];

    // Validate player count constraints after toggling
    const nextBounds = getEffectivePlayerBounds(catalogEntry, nextExpansions);
    const connectedCount = Array.from(ctx.room.players.values()).filter(
      (p) => p.connected
    ).length;

    if (connectedCount > nextBounds.maxPlayers) {
      socket.emit('action_error', {
        message: `Cannot disable "${expansion.name}" while ${connectedCount} players are in the lobby (base limit is ${nextBounds.maxPlayers} players).`,
      });
      return;
    }

    ctx.room.selectedExpansions = nextExpansions;
    broadcastRoomLobby(ctx.room);
  });

  // 3D. Choose Player Color (Any player in LOBBY; enforces uniqueness)
  socket.on('choose_color', ({ roomId, colorId }) => {
    const ctx = roomManager.getSessionBySocket(socket.id);
    if (!ctx || ctx.room.roomId !== roomId.trim().toUpperCase()) {
      return;
    }
    if (ctx.room.status !== 'LOBBY') {
      socket.emit('action_error', {
        message: 'Cannot change player color after the match has started.',
      });
      return;
    }

    const activeGameId = ctx.room.configuredGameId ?? ctx.room.selectedGameId;
    const catalogEntry = GAME_CATALOG_BY_ID[activeGameId];
    const colorDef = catalogEntry.availableColors.find((c) => c.id === colorId);
    if (!colorDef) {
      socket.emit('action_error', {
        message: `Color "${colorId}" is not available for ${catalogEntry.name}.`,
      });
      return;
    }

    // Check uniqueness among all connected players
    for (const otherSession of ctx.room.players.values()) {
      if (
        otherSession.connected &&
        otherSession.playerId !== ctx.session.playerId
      ) {
        const otherSettings = ctx.room.playerSettings.get(
          otherSession.playerId
        );
        if (otherSettings?.colorId === colorId) {
          socket.emit('action_error', {
            message: `${colorDef.name} is already claimed by ${otherSession.name}.`,
          });
          return;
        }
      }
    }

    const existing = ctx.room.playerSettings.get(ctx.session.playerId);
    ctx.room.playerSettings.set(ctx.session.playerId, {
      colorId,
      ready: existing?.ready ?? false,
    });
    broadcastRoomLobby(ctx.room);
  });

  // 3E. Toggle Ready Status (Requires a selected color)
  socket.on('toggle_ready', ({ roomId, ready }) => {
    const ctx = roomManager.getSessionBySocket(socket.id);
    if (!ctx || ctx.room.roomId !== roomId.trim().toUpperCase()) {
      return;
    }
    if (ctx.room.status !== 'LOBBY') {
      return;
    }

    const currentSettings = ctx.room.playerSettings.get(
      ctx.session.playerId
    ) ?? {
      colorId: null,
      ready: false,
    };

    const targetReady = ready !== undefined ? ready : !currentSettings.ready;
    if (targetReady && !currentSettings.colorId) {
      socket.emit('action_error', {
        message: 'Please select a player color before marking yourself Ready.',
      });
      return;
    }

    ctx.room.playerSettings.set(ctx.session.playerId, {
      colorId: currentSettings.colorId,
      ready: targetReady,
    });
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

    if (ctx.room.status === 'LOBBY' && !ctx.room.configuredGameId) {
      socket.emit('action_error', {
        message: 'Please select a game before starting the match.',
      });
      return;
    }

    const gameId = ctx.room.configuredGameId ?? ctx.room.selectedGameId;
    ctx.room.selectedGameId = gameId;
    const engine = GameRegistry[gameId];
    const catalogEntry = GAME_CATALOG_BY_ID[gameId];
    const bounds = getEffectivePlayerBounds(
      catalogEntry,
      ctx.room.selectedExpansions
    );

    const connectedSessions = Array.from(ctx.room.players.values())
      .filter((p) => p.connected)
      .sort((a, b) => a.seatIndex - b.seatIndex);
    const allSessions = Array.from(ctx.room.players.values()).sort(
      (a, b) => a.seatIndex - b.seatIndex
    );

    const activePlayers =
      ctx.room.status === 'LOBBY' ? connectedSessions : allSessions;
    const currentCount = activePlayers.length;

    if (currentCount < bounds.minPlayers) {
      const needed = bounds.minPlayers - currentCount;
      socket.emit('action_error', {
        message: `${engine.title} requires at least ${bounds.minPlayers} players (need ${needed} more player${needed === 1 ? '' : 's'}).`,
      });
      return;
    }

    if (currentCount > bounds.maxPlayers) {
      socket.emit('action_error', {
        message: `${engine.title} supports at most ${bounds.maxPlayers} players (currently ${currentCount} in lobby).`,
      });
      return;
    }

    // When launching from LOBBY, validate that every connected player has picked a unique color and marked Ready
    if (ctx.room.status === 'LOBBY') {
      const seenColors = new Set<string>();
      for (const p of connectedSessions) {
        const settings = ctx.room.playerSettings.get(p.playerId);
        if (!settings?.colorId) {
          socket.emit('action_error', {
            message: `Waiting for ${p.name} to pick a player color.`,
          });
          return;
        }
        if (seenColors.has(settings.colorId)) {
          socket.emit('action_error', {
            message: `Duplicate color selection detected for ${p.name}.`,
          });
          return;
        }
        seenColors.add(settings.colorId);

        if (!settings.ready) {
          socket.emit('action_error', {
            message: `Waiting for ${p.name} to mark Ready.`,
          });
          return;
        }
      }
    }

    const playerIds = activePlayers.map((p) => p.playerId);
    const playerColors = RoomManager.getPlayerColorsRecord(ctx.room);
    const effectiveSeed = seed ?? Date.now();

    ctx.room.gameState = engine.initGame(playerIds, effectiveSeed, {
      selectedExpansions: ctx.room.selectedExpansions,
      playerColors,
    });
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
    // Keep players' chosen colors if still valid, but reset ready status for the next game
    for (const [pid, settings] of ctx.room.playerSettings.entries()) {
      ctx.room.playerSettings.set(pid, {
        colorId: settings.colorId,
        ready: false,
      });
    }
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
