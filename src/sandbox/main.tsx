import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Graph } from '../common/graph.js';
import {
  ALL_CATAN_RESOURCES,
  CatanGameState,
  CatanSanitizedGameState,
} from '../games/catan/index.js';
import {
  CribbageGameState,
  CribbageSanitizedGameState,
} from '../games/cribbage/index.js';
import {
  EuchreGameState,
  EuchreSanitizedGameState,
} from '../games/euchre/index.js';
import {
  KingsCornersGameState,
  KingsCornersSanitizedGameState,
} from '../games/kings-corners/index.js';
import {
  calculateMaxPoweredCities,
  getActivePlayerId as getPowerGridActivePlayerId,
  PowerGridGameState,
  SanitizedPowerGridState,
} from '../games/power-grid/index.js';
import {
  calculateStockpileNetWorth,
  StockpileGameState,
  StockpileSanitizedGameState,
} from '../games/stockpile/index.js';
import {
  HoldemGameState,
  HoldemSanitizedGameState,
} from '../games/texas-holdem/index.js';
import {
  AnyGameAction,
  AnyGameState,
  BOARD_GAME_METADATA_LIST,
  CARD_GAME_METADATA_LIST,
  GAME_METADATA_LIST,
  GameId,
  GameRegistry,
} from '../games/registry.js';
import { ALL_TRAIN_CARD_COLORS } from '../games/ticket-to-ride/index.js';
import {
  DestinationTicket,
  GameState as TTRGameState,
  RouteEdge,
  SanitizedGameState as TTRSanitizedGameState,
} from '../games/ticket-to-ride/types.js';
import { PlayerFinalStanding } from '../network/socketTypes.js';
import { CatanBoard } from './CatanBoard.js';
import { ClaimRoutePopover } from './ClaimRoutePopover.js';
import { CribbageBoard } from './CribbageBoard.js';
import { EuchreBoard } from './EuchreBoard.js';
import { HoldemBoard } from './HoldemBoard.js';
import { InteractiveMap } from './InteractiveMap.js';
import { KingsCornersBoard } from './KingsCornersBoard.js';
import { PowerGridBoard } from './PowerGridBoard.js';
import { StockpileBoard } from './StockpileBoard.js';
import { getPlayerPalette, ROUTE_COLOR_THEMES } from './mapData.js';
import { playTurnNotificationChime } from './sound.js';
import { useGameSocket } from './useGameSocket.js';
import './styles.css';

interface ActionLogEntry {
  readonly id: number;
  readonly timestamp: string;
  readonly turnNumber: number;
  readonly playerId: string;
  readonly action: AnyGameAction;
  readonly valid: boolean;
  readonly reason?: string;
}

type RunnerMode = 'MULTIPLAYER' | 'LOCAL';
type ViewportMode = 'GOD_MODE' | string; // 'GOD_MODE' or a specific playerId

function generatePlayerIds(count: number): string[] {
  return Array.from({ length: count }, (_, i) => `Player_${i + 1}`);
}

function formatTime(): string {
  const now = new Date();
  return now.toTimeString().split(' ')[0]!;
}

/**
 * Parses `/join/ABCD12`, `/room/ABCD12`, or `?room=ABCD12` from the browser URL.
 */
function parseRoomCodeFromLocation(): {
  code: string;
  autoReconnect: boolean;
} {
  const path = window.location.pathname;
  const joinMatch = path.match(/^\/join\/([A-Za-z0-9]{4,8})/i);
  if (joinMatch?.[1]) {
    return { code: joinMatch[1].toUpperCase(), autoReconnect: false };
  }
  const roomMatch = path.match(/^\/room\/([A-Za-z0-9]{4,8})/i);
  if (roomMatch?.[1]) {
    return { code: roomMatch[1].toUpperCase(), autoReconnect: true };
  }
  const params = new URLSearchParams(window.location.search);
  const queryCode = params.get('room')?.trim().toUpperCase();
  if (queryCode) {
    return { code: queryCode, autoReconnect: true };
  }
  return { code: '', autoReconnect: false };
}

export const SandboxApp: React.FC = () => {
  const initialRouteInfo = useMemo(() => parseRoomCodeFromLocation(), []);

  const [runnerMode, setRunnerMode] = useState<RunnerMode>('MULTIPLAYER');

  // --- Multiplayer Form State ---
  const [playerNameInput, setPlayerNameInput] = useState<string>(
    () => localStorage.getItem('ttr_last_player_name') ?? 'Alice'
  );
  const [entrySelectedGameId, setEntrySelectedGameId] = useState<GameId>('ttr');
  const [joinCodeInput, setJoinCodeInput] = useState<string>(
    initialRouteInfo.code
  );
  const [copiedLink, setCopiedLink] = useState<boolean>(false);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [showDebugger, setShowDebugger] = useState<boolean>(false);

  const mp = useGameSocket(runnerMode === 'MULTIPLAYER');

  // Automatic rejoin on page refresh on `/room/:id`
  const didAutoJoinRef = useRef(false);
  useEffect(() => {
    if (
      runnerMode === 'MULTIPLAYER' &&
      mp.connected &&
      !mp.roomId &&
      initialRouteInfo.code &&
      !didAutoJoinRef.current
    ) {
      const savedToken = localStorage.getItem(
        `ttr_session_${initialRouteInfo.code}`
      );
      if (initialRouteInfo.autoReconnect && savedToken) {
        didAutoJoinRef.current = true;
        mp.joinRoom(initialRouteInfo.code, playerNameInput);
      }
    }
  }, [
    runnerMode,
    mp.connected,
    mp.roomId,
    initialRouteInfo,
    playerNameInput,
    mp.joinRoom,
  ]);

  // --- Local Sandbox Setup Config State ---
  const [localSelectedGameId, setLocalSelectedGameId] = useState<GameId>('ttr');
  const [playerCountInput, setPlayerCountInput] = useState<number>(3);
  const [seedInput, setSeedInput] = useState<string>('20261031');

  // --- Local Core Engine State ---
  const [localGameState, setLocalGameState] = useState<AnyGameState>(() =>
    GameRegistry.ttr.initGame(generatePlayerIds(3), 20261031)
  );

  // --- Viewport & Inspector State ---
  const [viewport, setViewport] = useState<ViewportMode>('GOD_MODE');
  const [followActiveTurn, setFollowActiveTurn] = useState<boolean>(false);
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);
  const [hoveredTicket, setHoveredTicket] = useState<DestinationTicket | null>(
    null
  );
  const [selectedPendingIds, setSelectedPendingIds] = useState<string[]>([]);

  // --- Debugger & Action Log State ---
  const [localErrorBanner, setLocalErrorBanner] = useState<string | null>(null);
  const [actionLog, setActionLog] = useState<ActionLogEntry[]>([]);
  const [inspectorTab, setInspectorTab] = useState<'SANITIZED' | 'RAW'>(
    'SANITIZED'
  );
  const [isInspectorOpen, setIsInspectorOpen] = useState<boolean>(true);

  const isMultiplayerActive =
    runnerMode === 'MULTIPLAYER' && mp.sanitizedView !== null;

  const activeGameId: GameId =
    runnerMode === 'MULTIPLAYER' ? mp.selectedGameId : localSelectedGameId;

  // Active Perspective resolution (either Local Engine or Server State Sync)
  const localActivePlayerId =
    'gameId' in localGameState && localGameState.gameId === 'power_grid'
      ? getPowerGridActivePlayerId(localGameState as PowerGridGameState)
      : localGameState.playerOrder[localGameState.activePlayerIndex] ??
        localGameState.playerOrder[0]!;

  const localViewedPlayerId =
    viewport === 'GOD_MODE' ? localActivePlayerId : viewport;

  const localSanitizedPerspective = useMemo(() => {
    const engine = GameRegistry[localSelectedGameId];
    return engine.getPlayerPerspective(localGameState, localViewedPlayerId);
  }, [localGameState, localSelectedGameId, localViewedPlayerId]);

  const activeSanitized = isMultiplayerActive
    ? mp.sanitizedView!
    : localSanitizedPerspective;

  const activePlayerId = activeSanitized.activePlayerId;
  const viewedPlayerId = isMultiplayerActive
    ? activeSanitized.self.id
    : localViewedPlayerId;

  const isCatanActive =
    'gameId' in activeSanitized && activeSanitized.gameId === 'catan';
  const isHoldemActive =
    'gameId' in activeSanitized && activeSanitized.gameId === 'holdem';
  const isEuchreActive =
    'gameId' in activeSanitized && activeSanitized.gameId === 'euchre';
  const isCribbageActive =
    'gameId' in activeSanitized && activeSanitized.gameId === 'cribbage';
  const isKingsCornersActive =
    'gameId' in activeSanitized && activeSanitized.gameId === 'kings_corners';
  const isStockpileActive =
    'gameId' in activeSanitized && activeSanitized.gameId === 'stockpile';
  const isPowerGridActive =
    'gameId' in activeSanitized && activeSanitized.gameId === 'power_grid';
  const ttrSanitized =
    !('gameId' in activeSanitized)
      ? (activeSanitized as TTRSanitizedGameState)
      : null;
  const catanSanitized = isCatanActive
    ? (activeSanitized as CatanSanitizedGameState)
    : null;
  const holdemSanitized = isHoldemActive
    ? (activeSanitized as HoldemSanitizedGameState)
    : null;
  const euchreSanitized = isEuchreActive
    ? (activeSanitized as EuchreSanitizedGameState)
    : null;
  const cribbageSanitized = isCribbageActive
    ? (activeSanitized as CribbageSanitizedGameState)
    : null;
  const kingsCornersSanitized = isKingsCornersActive
    ? (activeSanitized as KingsCornersSanitizedGameState)
    : null;
  const stockpileSanitized = isStockpileActive
    ? (activeSanitized as StockpileSanitizedGameState)
    : null;
  const powerGridSanitized = isPowerGridActive
    ? (activeSanitized as SanitizedPowerGridState)
    : null;

  // Determine whether the local user is allowed to act right now
  const isMyTurn = useMemo(() => {
    if (ttrSanitized && ttrSanitized.phase === 'INITIAL_TICKET_SELECTION') {
      return ttrSanitized.self.pendingTickets.length > 0;
    }
    return activePlayerId === activeSanitized.self.id;
  }, [ttrSanitized, activePlayerId, activeSanitized.self.id]);

  const isControlsLocked =
    runnerMode === 'MULTIPLAYER' && (!isMyTurn || mp.pendingAction);

  // Trigger subtle audio chime when the active turn shifts to the local player
  const prevTurnOwnerRef = useRef<string | null>(null);
  useEffect(() => {
    const prevOwner = prevTurnOwnerRef.current;
    prevTurnOwnerRef.current = activePlayerId;

    if (
      soundEnabled &&
      activeSanitized.phase !== 'INITIAL_TICKET_SELECTION' &&
      activeSanitized.phase !== 'GAME_OVER' &&
      prevOwner !== null &&
      prevOwner !== activePlayerId &&
      activePlayerId === activeSanitized.self.id
    ) {
      playTurnNotificationChime();
    }
  }, [
    activePlayerId,
    activeSanitized.phase,
    activeSanitized.self.id,
    soundEnabled,
  ]);

  const pendingTicketKey = ttrSanitized
    ? ttrSanitized.self.pendingTickets.map((t) => t.id).join(',')
    : '';

  useEffect(() => {
    if (ttrSanitized && ttrSanitized.self.pendingTickets.length > 0) {
      setSelectedPendingIds(ttrSanitized.self.pendingTickets.map((t) => t.id));
    } else {
      setSelectedPendingIds([]);
    }
  }, [viewedPlayerId, pendingTicketKey]);

  // Build a live Graph for Ticket to Ride to highlight completed Destination Tickets green
  const viewedPlayerGraph = useMemo(() => {
    const g = new Graph<RouteEdge>();
    if (!ttrSanitized) return g;
    for (const r of ttrSanitized.routes) {
      if (r.ownerId === viewedPlayerId) {
        g.addEdge(r.from, r.to, r.length, r);
      }
    }
    return g;
  }, [ttrSanitized, viewedPlayerId]);

  const localLiveScores = useMemo(() => {
    const engine = GameRegistry[localSelectedGameId];
    return engine.calculateFinalScores(localGameState);
  }, [localGameState, localSelectedGameId]);

  // Compute local final standings for the Game Over modal when playing in Local Sandbox
  const localFinalStandings = useMemo<readonly PlayerFinalStanding[]>(() => {
    if (localGameState.phase !== 'GAME_OVER') {
      return [];
    }
    if ('gameId' in localGameState && localGameState.gameId === 'power_grid') {
      const pgs = localGameState as PowerGridGameState;
      return pgs.turnOrder
        .map((pid) => {
          const p = pgs.players[pid]!;
          const powered = calculateMaxPoweredCities(p);
          return {
            playerId: pid,
            name: pid,
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
    if ('gameId' in localGameState && localGameState.gameId === 'stockpile') {
      const sps = localGameState as StockpileGameState;
      return sps.playerOrder
        .map((pid) => {
          const p = sps.players[pid]!;
          const netWorth = calculateStockpileNetWorth(sps, pid);
          return {
            playerId: pid,
            name: pid,
            routePoints: p.cash - p.endGameMajorityBonus,
            ticketPoints: p.endGameMajorityBonus,
            totalScore: netWorth,
            trainsRemaining: 0,
            tickets: [],
          };
        })
        .sort((a, b) => b.totalScore - a.totalScore);
    }
    if ('gameId' in localGameState && localGameState.gameId === 'euchre') {
      const es = localGameState as EuchreGameState;
      return es.playerOrder
        .map((pid) => {
          const p = es.players[pid]!;
          return {
            playerId: pid,
            name: pid,
            routePoints: p.score,
            ticketPoints: 0,
            totalScore: p.score,
            trainsRemaining: p.tricksWonThisHand,
            tickets: [],
          };
        })
        .sort((a, b) => b.totalScore - a.totalScore);
    }
    if ('gameId' in localGameState && localGameState.gameId === 'cribbage') {
      const crs = localGameState as CribbageGameState;
      return crs.playerOrder
        .map((pid) => {
          const p = crs.players[pid]!;
          return {
            playerId: pid,
            name: pid,
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
      'gameId' in localGameState &&
      localGameState.gameId === 'kings_corners'
    ) {
      const kcs = localGameState as KingsCornersGameState;
      return kcs.playerOrder
        .map((pid) => {
          const p = kcs.players[pid]!;
          return {
            playerId: pid,
            name: pid,
            routePoints: p.quarters,
            ticketPoints: 0,
            totalScore: p.quarters,
            trainsRemaining: p.lastHandScore ?? 0,
            tickets: [],
          };
        })
        .sort((a, b) => b.totalScore - a.totalScore);
    }
    if ('gameId' in localGameState && localGameState.gameId === 'holdem') {
      const hs = localGameState as HoldemGameState;
      return hs.playerOrder
        .map((pid) => {
          const p = hs.players[pid]!;
          return {
            playerId: pid,
            name: pid,
            routePoints: p.chips,
            ticketPoints: 0,
            totalScore: p.chips,
            trainsRemaining: p.handsWon,
            tickets: [],
          };
        })
        .sort((a, b) => b.totalScore - a.totalScore);
    }
    if ('gameId' in localGameState && localGameState.gameId === 'catan') {
      const cs = localGameState as CatanGameState;
      return cs.playerOrder
        .map((pid) => {
          const p = cs.players[pid]!;
          return {
            playerId: pid,
            name: pid,
            routePoints: p.victoryPoints,
            ticketPoints: 0,
            totalScore: p.victoryPoints,
            trainsRemaining: p.settlementsRemaining,
            tickets: [],
          };
        })
        .sort((a, b) => b.totalScore - a.totalScore);
    }

    const ts = localGameState as TTRGameState;
    return ts.playerOrder
      .map((pid) => {
        const p = ts.players[pid]!;
        const g = new Graph<RouteEdge>();
        for (const r of ts.routes) {
          if (r.ownerId === pid) {
            g.addEdge(r.from, r.to, r.length, r);
          }
        }
        let ticketPoints = 0;
        const tickets = p.tickets.map((ticket) => {
          const completed = g.isConnected(ticket.from, ticket.to);
          ticketPoints += completed ? ticket.points : -ticket.points;
          return { ticket, completed };
        });
        return {
          playerId: pid,
          name: pid,
          routePoints: p.claimedRoutePoints,
          ticketPoints,
          totalScore: p.claimedRoutePoints + ticketPoints,
          trainsRemaining: p.trainsRemaining,
          tickets,
        };
      })
      .sort((a, b) => b.totalScore - a.totalScore);
  }, [localGameState]);

  const effectiveFinalStandings = isMultiplayerActive
    ? mp.finalStandings ?? []
    : localFinalStandings;

  const selfProjectedScore = useMemo(() => {
    if (holdemSanitized) {
      return holdemSanitized.self.chips;
    }
    if (catanSanitized) {
      return catanSanitized.self.victoryPoints;
    }
    if (!ttrSanitized) return 0;
    if (!isMultiplayerActive) {
      return localLiveScores[ttrSanitized.self.id] ?? 0;
    }
    let score = ttrSanitized.self.claimedRoutePoints;
    for (const tkt of ttrSanitized.self.tickets) {
      if (viewedPlayerGraph.isConnected(tkt.from, tkt.to)) {
        score += tkt.points;
      } else {
        score -= tkt.points;
      }
    }
    return score;
  }, [
    catanSanitized,
    ttrSanitized,
    isMultiplayerActive,
    localLiveScores,
    viewedPlayerGraph,
  ]);

  const selectedRoute = useMemo(
    () =>
      ttrSanitized?.routes.find((r) => r.id === selectedRouteId) ?? null,
    [ttrSanitized, selectedRouteId]
  );

  const effectiveErrorBanner =
    runnerMode === 'MULTIPLAYER' ? mp.errorBanner : localErrorBanner;

  const formatPlayerLabel = (pid: string): string => {
    if (runnerMode === 'MULTIPLAYER' && mp.playerNames[pid]) {
      return `${mp.playerNames[pid]} (${pid})`;
    }
    return pid;
  };

  const formattedLastAction = useMemo(() => {
    const raw = activeSanitized.lastActionSummary;
    if (!raw) {
      return 'Waiting for the first move...';
    }
    if (runnerMode !== 'MULTIPLAYER') {
      return raw;
    }
    let formatted = raw;
    for (const [pid, name] of Object.entries(mp.playerNames)) {
      formatted = formatted.replace(
        new RegExp(`\\b${pid}\\b`, 'g'),
        `${name} (${pid})`
      );
    }
    return formatted;
  }, [activeSanitized.lastActionSummary, runnerMode, mp.playerNames]);

  // --- Handlers ---

  const handleCopyInviteLink = () => {
    if (!mp.roomId) return;
    const shareUrl = `${window.location.origin}/join/${mp.roomId}`;
    navigator.clipboard?.writeText(shareUrl);
    setCopiedLink(true);
    window.setTimeout(() => setCopiedLink(false), 2500);
  };

  const handleStartNewLocalGame = (
    overrideGameId?: GameId,
    overridePlayerCount?: number
  ) => {
    const targetGameId = overrideGameId ?? localSelectedGameId;
    const engine = GameRegistry[targetGameId];
    const requestedCount = overridePlayerCount ?? playerCountInput;
    const clampedCount = Math.min(
      engine.maxPlayers,
      Math.max(engine.minPlayers, requestedCount)
    );
    setLocalSelectedGameId(targetGameId);
    setPlayerCountInput(clampedCount);

    const parsedSeed = Number.parseInt(seedInput, 10);
    const effectiveSeed = Number.isNaN(parsedSeed)
      ? Math.floor(Math.random() * 1_000_000)
      : parsedSeed;
    const ids = generatePlayerIds(clampedCount);
    const nextState = engine.initGame(ids, effectiveSeed);
    setLocalGameState(nextState);
    setSelectedRouteId(null);
    setSelectedPendingIds([]);
    setLocalErrorBanner(null);
    setActionLog([]);
    if (viewport !== 'GOD_MODE' && !ids.includes(viewport)) {
      setViewport('GOD_MODE');
    }
  };

  const dispatchEngineAction = (actorId: string, action: AnyGameAction) => {
    if (runnerMode === 'MULTIPLAYER') {
      const logEntry: ActionLogEntry = {
        id: Date.now() + Math.random(),
        timestamp: formatTime(),
        turnNumber: activeSanitized.turnNumber,
        playerId: actorId,
        action,
        valid: true,
      };
      setActionLog((prev) => [logEntry, ...prev]);
      mp.sendAction(action);
      if (action.type === 'CLAIM_ROUTE') {
        setSelectedRouteId(null);
      }
      return;
    }

    // Local Sandbox Mode — Route through GameRegistry[localSelectedGameId]
    const engine = GameRegistry[localSelectedGameId];
    const check = engine.validateAction(localGameState, actorId, action);
    const logEntry: ActionLogEntry = {
      id: Date.now() + Math.random(),
      timestamp: formatTime(),
      turnNumber: localGameState.turnNumber,
      playerId: actorId,
      action,
      valid: check.valid,
      ...(check.reason !== undefined ? { reason: check.reason } : {}),
    };

    setActionLog((prev) => [logEntry, ...prev]);

    if (!check.valid) {
      setLocalErrorBanner(
        `Invalid Move (${actorId} • ${action.type}): ${check.reason ?? 'Rejected by engine'}`
      );
      return;
    }

    setLocalErrorBanner(null);
    const nextState = engine.applyAction(localGameState, actorId, action);
    setLocalGameState(nextState);

    if (action.type === 'CLAIM_ROUTE') {
      setSelectedRouteId(null);
    }

    // Auto-switch viewport in Hot-Seat mode if enabled
    if (followActiveTurn && viewport !== 'GOD_MODE') {
      const nextActive =
        nextState.playerOrder[nextState.activePlayerIndex]!;
      setViewport(nextActive);
    }
  };

  // --- Sandbox Cheat / Debug Helper (Local God Mode Only) ---
  const handleGodModeGrantCards = () => {
    if (runnerMode !== 'LOCAL') return;
    if ('gameId' in localGameState && localGameState.gameId === 'holdem') {
      const hs = localGameState as HoldemGameState;
      const p = hs.players[localActivePlayerId]!;
      setLocalGameState({
        ...hs,
        players: {
          ...hs.players,
          [localActivePlayerId]: {
            ...p,
            chips: p.chips + 500,
          },
        },
      });
      setLocalErrorBanner(null);
      return;
    }
    if ('gameId' in localGameState && localGameState.gameId === 'catan') {
      const cs = localGameState as CatanGameState;
      const p = cs.players[localActivePlayerId]!;
      const updatedRes = { ...p.resources };
      for (const r of ALL_CATAN_RESOURCES) {
        updatedRes[r] += 2;
      }
      setLocalGameState({
        ...cs,
        players: {
          ...cs.players,
          [localActivePlayerId]: {
            ...p,
            resources: updatedRes,
          },
        },
      });
      setLocalErrorBanner(null);
      return;
    }

    const ts = localGameState as TTRGameState;
    const p = ts.players[localActivePlayerId]!;
    const updatedHand = { ...p.hand };
    for (const c of ALL_TRAIN_CARD_COLORS) {
      updatedHand[c] += 1;
    }
    setLocalGameState({
      ...ts,
      players: {
        ...ts.players,
        [localActivePlayerId]: {
          ...p,
          hand: updatedHand,
        },
      },
    });
    setLocalErrorBanner(null);
  };

  const highlightedCities = useMemo(() => {
    const set = new Set<string>();
    if (hoveredTicket) {
      set.add(hoveredTicket.from);
      set.add(hoveredTicket.to);
    }
    if (selectedRoute) {
      set.add(selectedRoute.from);
      set.add(selectedRoute.to);
    }
    return set;
  }, [hoveredTicket, selectedRoute]);

  const togglePendingTicketSelection = (ticketId: string) => {
    setSelectedPendingIds((prev) =>
      prev.includes(ticketId)
        ? prev.filter((id) => id !== ticketId)
        : [...prev, ticketId]
    );
  };

  // Player count validation helper for the Waiting Room Lobby
  const selectedLobbyGameMeta = GameRegistry[mp.selectedGameId];
  const currentLobbyCount = mp.lobbyPlayers.length;
  const lobbyShortfall = Math.max(
    0,
    selectedLobbyGameMeta.minPlayers - currentLobbyCount
  );
  const lobbyExcess = Math.max(
    0,
    currentLobbyCount - selectedLobbyGameMeta.maxPlayers
  );
  const canStartLobbyGame = lobbyShortfall === 0 && lobbyExcess === 0;

  return (
    <div className="flex flex-col h-screen w-screen bg-slate-950 text-slate-100 select-none overflow-hidden">
      {/* =====================================================================
          FLOATING TOAST NOTIFICATIONS (Optimistic UI & Network Feedback)
         ===================================================================== */}
      {mp.toasts.length > 0 && (
        <div className="fixed bottom-64 right-6 z-50 flex flex-col gap-2 max-w-sm pointer-events-auto">
          {mp.toasts.map((toast) => (
            <div
              key={toast.id}
              className={`px-4 py-3 rounded-xl border shadow-2xl backdrop-blur-md text-xs font-semibold flex items-center justify-between gap-3 animate-bounce ${
                toast.variant === 'error'
                  ? 'bg-rose-950/95 border-rose-500 text-rose-100'
                  : toast.variant === 'success'
                  ? 'bg-emerald-950/95 border-emerald-500 text-emerald-100'
                  : 'bg-slate-900/95 border-slate-700 text-slate-100'
              }`}
            >
              <span>
                {toast.variant === 'error' ? '⚠️ ' : '✓ '}
                {toast.text}
              </span>
              <button
                onClick={() => mp.dismissToast(toast.id)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      {/* =====================================================================
          1. TOP CONTROL BAR
         ===================================================================== */}
      <header className="h-14 shrink-0 bg-slate-900 border-b border-slate-800 px-4 flex items-center justify-between gap-3 z-20">
        {/* Left: Mode Toggle & Setup Controls */}
        <div className="flex items-center gap-3">
          {/* Runner Mode Switcher: Live Multiplayer vs Local Sandbox */}
          <div className="flex items-center bg-slate-950 p-1 rounded-lg border border-slate-800">
            <button
              onClick={() => setRunnerMode('MULTIPLAYER')}
              className={`px-2.5 py-1 rounded text-xs font-bold transition flex items-center gap-1.5 ${
                runnerMode === 'MULTIPLAYER'
                  ? 'bg-emerald-500 text-slate-950 shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <span>🌐 Multiplayer Match</span>
              {runnerMode === 'MULTIPLAYER' && (
                <span
                  className={`w-2 h-2 rounded-full ${
                    mp.connected
                      ? 'bg-slate-950'
                      : mp.reconnecting
                      ? 'bg-amber-400 animate-ping'
                      : 'bg-rose-600 animate-ping'
                  }`}
                />
              )}
            </button>
            <button
              onClick={() => setRunnerMode('LOCAL')}
              className={`px-2.5 py-1 rounded text-xs font-bold transition ${
                runnerMode === 'LOCAL'
                  ? 'bg-amber-500 text-slate-950 shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              🛠️ Dev Sandbox
            </button>
          </div>

          {runnerMode === 'LOCAL' ? (
            <>
              <div className="h-5 w-px bg-slate-800" />
              {/* Game Selector in Local Sandbox */}
              <div className="flex items-center gap-1.5 text-xs">
                <label className="text-slate-400 font-medium">Game:</label>
                <select
                  value={localSelectedGameId}
                  onChange={(e) =>
                    handleStartNewLocalGame(e.target.value as GameId)
                  }
                  className="bg-slate-800 border border-slate-700 rounded px-2 py-1 text-amber-300 font-bold focus:outline-none focus:border-amber-400"
                >
                  <optgroup label="🎲 Board Games">
                    {BOARD_GAME_METADATA_LIST.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.icon} {g.title} ({g.minPlayers}–{g.maxPlayers}P)
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="🃏 Card Games">
                    {CARD_GAME_METADATA_LIST.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.icon} {g.title} ({g.minPlayers}–{g.maxPlayers}P)
                      </option>
                    ))}
                  </optgroup>
                </select>
              </div>

              <div className="flex items-center gap-1.5 text-xs">
                <label className="text-slate-400 font-medium">Players:</label>
                <select
                  value={playerCountInput}
                  onChange={(e) => {
                    const count = Number(e.target.value);
                    setPlayerCountInput(count);
                    handleStartNewLocalGame(localSelectedGameId, count);
                  }}
                  className="bg-slate-800 border border-slate-700 rounded px-2 py-1 text-slate-100 font-semibold focus:outline-none focus:border-amber-400"
                >
                  {[2, 3, 4, 5, 6]
                    .filter(
                      (n) =>
                        n >= GameRegistry[localSelectedGameId].minPlayers &&
                        n <= GameRegistry[localSelectedGameId].maxPlayers
                    )
                    .map((n) => (
                      <option key={n} value={n}>
                        {n}P
                      </option>
                    ))}
                </select>
              </div>

              <div className="flex items-center gap-1.5 text-xs">
                <label className="text-slate-400 font-medium">Seed:</label>
                <input
                  type="text"
                  value={seedInput}
                  onChange={(e) => setSeedInput(e.target.value)}
                  placeholder="Seed integer"
                  className="w-20 bg-slate-800 border border-slate-700 rounded px-2 py-1 text-slate-100 font-mono text-xs focus:outline-none focus:border-amber-400"
                />
              </div>

              <button
                onClick={() => handleStartNewLocalGame()}
                className="px-3 py-1 rounded-md bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition shadow-sm"
              >
                ↻ New Game
              </button>
            </>
          ) : (
            <div className="flex items-center gap-2 text-xs">
              <span
                className={`px-2 py-0.5 rounded font-mono text-[11px] border ${
                  mp.connected
                    ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300'
                    : mp.reconnecting
                    ? 'bg-amber-950/60 border-amber-500/40 text-amber-300'
                    : 'bg-rose-950/60 border-rose-500/40 text-rose-300'
                }`}
              >
                {mp.connected
                  ? '● Connected'
                  : mp.reconnecting
                  ? '↻ Reconnecting...'
                  : '○ Offline'}
              </span>
              {mp.roomId && (
                <>
                  <span className="px-2.5 py-0.5 rounded bg-slate-800 border border-slate-700 font-mono font-bold text-amber-300">
                    /room/{mp.roomId}
                  </span>
                  <span className="px-2 py-0.5 rounded bg-purple-950/60 border border-purple-500/40 font-bold text-purple-200">
                    {GameRegistry[mp.selectedGameId].title}
                  </span>
                  <span className="px-2 py-0.5 rounded bg-cyan-950 border border-cyan-500/40 font-semibold text-cyan-300">
                    Seat: {formatPlayerLabel(mp.playerId ?? '')}
                  </span>
                  <button
                    onClick={handleCopyInviteLink}
                    className="px-2.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-slate-700 font-semibold"
                  >
                    {copiedLink ? '✓ Copied!' : '🔗 Copy Invite Link'}
                  </button>
                  <button
                    onClick={mp.leaveRoom}
                    className="px-2 py-0.5 rounded bg-slate-800 hover:bg-rose-950 hover:text-rose-200 text-slate-300 transition"
                  >
                    Leave
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        {/* Center: Viewport Switcher Tabs (Local Mode) or Turn Banner (Multiplayer Mode) */}
        {runnerMode === 'LOCAL' ? (
          <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
            <button
              onClick={() => setViewport('GOD_MODE')}
              className={`px-2.5 py-1 rounded text-xs font-bold transition flex items-center gap-1.5 ${
                viewport === 'GOD_MODE'
                  ? 'bg-purple-600 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <span>👁️ God Mode</span>
            </button>

            {localGameState.playerOrder.map((pid) => {
              const palette = getPlayerPalette(pid, localGameState.playerOrder);
              const isSelected = viewport === pid;
              const isTurn = pid === activePlayerId;
              return (
                <button
                  key={pid}
                  onClick={() => setViewport(pid)}
                  className={`px-2.5 py-1 rounded text-xs font-semibold transition flex items-center gap-1.5 ${
                    isSelected
                      ? 'bg-slate-800 text-white border border-slate-600 shadow'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <span
                    className={`w-2 h-2 rounded-full ${palette.dotClass}`}
                  />
                  <span>{pid}</span>
                  {isTurn && (
                    <span className="text-[10px] px-1 rounded bg-amber-500/20 text-amber-300 font-mono">
                      TURN
                    </span>
                  )}
                </button>
              );
            })}

            {viewport !== 'GOD_MODE' && (
              <label className="ml-2 pr-1.5 flex items-center gap-1 text-[11px] text-slate-400 cursor-pointer">
                <input
                  type="checkbox"
                  checked={followActiveTurn}
                  onChange={(e) => setFollowActiveTurn(e.target.checked)}
                  className="rounded border-slate-700"
                />
                Auto-follow
              </label>
            )}
          </div>
        ) : (
          isMultiplayerActive && (
            <div
              className={`px-4 py-1 rounded-full text-xs font-bold border transition-all flex items-center gap-2 ${
                isMyTurn
                  ? 'bg-emerald-500/20 border-emerald-400 text-emerald-200 shadow-[0_0_15px_rgba(16,185,129,0.35)]'
                  : 'bg-slate-950 border-slate-800 text-slate-400'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  isMyTurn ? 'bg-emerald-400 animate-ping' : 'bg-slate-600'
                }`}
              />
              <span>
                {mp.pendingAction
                  ? '⏳ Sending move to server...'
                  : isMyTurn
                  ? '⚡ YOUR TURN — Make a move!'
                  : `⏳ Waiting for ${formatPlayerLabel(activePlayerId)}...`}
              </span>
            </div>
          )
        )}

        {/* Right: Game Status Display, Audio Chime Toggle & Inspector Toggle */}
        <div className="flex items-center gap-2.5 text-xs">
          <div className="flex items-center gap-2 bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800">
            <span className="text-slate-400">
              Turn #{activeSanitized.turnNumber}:
            </span>
            <span className="font-bold text-amber-300">
              {formatPlayerLabel(activePlayerId)}
            </span>
            <span className="text-slate-600">•</span>
            <span className="px-1.5 py-0.5 rounded bg-slate-800 text-cyan-300 font-mono text-[11px]">
              {activeSanitized.phase} / {activeSanitized.turnStep}
            </span>
          </div>

          <button
            onClick={() => setSoundEnabled((s) => !s)}
            className={`px-2 py-1 rounded border text-xs ${
              soundEnabled
                ? 'bg-slate-800 border-slate-700 text-amber-300'
                : 'bg-slate-950 border-slate-800 text-slate-500'
            }`}
            title="Toggle turn notification sound chime"
          >
            {soundEnabled ? '🔔' : '🔕'}
          </button>

          <button
            onClick={() => setShowDebugger((d) => !d)}
            className={`px-2.5 py-1 rounded border text-xs font-semibold ${
              showDebugger || runnerMode === 'LOCAL'
                ? 'bg-slate-800 border-slate-600 text-slate-100'
                : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
            title="Toggle Engine Debugger & Action Log Sidebar"
          >
            {showDebugger || runnerMode === 'LOCAL' ? 'Hide Debug' : 'Debug Log'}
          </button>
        </div>
      </header>

      {/* =====================================================================
          MAIN BODY: DYNAMIC GAME CONTAINER (`ttr` | `catan`) & DEBUG SIDEBAR
         ===================================================================== */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* LEFT + CENTER COLUMN (GameContainer) */}
        <div className="flex-1 flex flex-col min-w-0 min-h-0 relative">
          {/* ACTION FEED TEXT BOX — Displays what action the player has taken */}
          <div className="shrink-0 bg-slate-900/95 border-b border-slate-800 px-4 py-2 flex items-center justify-between gap-4 z-10">
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="px-2 py-0.5 rounded bg-amber-500/20 border border-amber-500/40 text-amber-300 font-bold text-[10px] uppercase tracking-wider shrink-0">
                Latest Action
              </span>
              <div className="text-xs font-medium text-slate-100 truncate">
                {formattedLastAction}
              </div>
            </div>
            <div className="text-[11px] font-mono text-slate-400 shrink-0">
              {GameRegistry[activeGameId].title} • Turn #
              {activeSanitized.turnNumber}
            </div>
          </div>

          {/* =================================================================
              DYNAMIC BOARD COMPONENT LOADER (`GameContainer`)
             ================================================================= */}
          {kingsCornersSanitized ? (
            /* Mount <KingsCornersBoard /> when `selectedGameId === 'kings_corners'` */
            <KingsCornersBoard
              gameState={kingsCornersSanitized}
              playerId={viewedPlayerId}
              playerNames={runnerMode === 'MULTIPLAYER' ? mp.playerNames : {}}
              sendAction={(action) =>
                dispatchEngineAction(viewedPlayerId, action)
              }
            />
          ) : euchreSanitized ? (
            /* Mount <EuchreBoard /> when `selectedGameId === 'euchre'` */
            <EuchreBoard
              gameState={euchreSanitized}
              playerId={viewedPlayerId}
              playerNames={runnerMode === 'MULTIPLAYER' ? mp.playerNames : {}}
              sendAction={(action) =>
                dispatchEngineAction(viewedPlayerId, action)
              }
            />
          ) : cribbageSanitized ? (
            /* Mount <CribbageBoard /> when `selectedGameId === 'cribbage'` */
            <CribbageBoard
              gameState={cribbageSanitized}
              playerId={viewedPlayerId}
              playerNames={runnerMode === 'MULTIPLAYER' ? mp.playerNames : {}}
              sendAction={(action) =>
                dispatchEngineAction(viewedPlayerId, action)
              }
            />
          ) : holdemSanitized ? (
            /* Mount <HoldemBoard /> when `selectedGameId === 'holdem'` */
            <HoldemBoard
              gameState={holdemSanitized}
              playerId={viewedPlayerId}
              playerNames={runnerMode === 'MULTIPLAYER' ? mp.playerNames : {}}
              sendAction={(action) =>
                dispatchEngineAction(viewedPlayerId, action)
              }
            />
          ) : catanSanitized ? (
            /* Mount <CatanBoard /> when `selectedGameId === 'catan'` */
            <CatanBoard
              view={catanSanitized}
              isControlsLocked={isControlsLocked}
              pendingAction={mp.pendingAction}
              formatPlayerLabel={formatPlayerLabel}
              onDispatchAction={(actorId, action) =>
                dispatchEngineAction(actorId, action)
              }
            />
          ) : stockpileSanitized ? (
            /* Mount <StockpileBoard /> when `selectedGameId === 'stockpile'` */
            <div className="flex-1 overflow-y-auto p-4 bg-slate-950">
              <StockpileBoard
                state={stockpileSanitized}
                viewingPlayerId={viewedPlayerId}
                playerNames={runnerMode === 'MULTIPLAYER' ? mp.playerNames : {}}
                isSpectator={false}
                onDispatchAction={(action) =>
                  dispatchEngineAction(viewedPlayerId, action)
                }
              />
            </div>
          ) : powerGridSanitized ? (
            /* Mount <PowerGridBoard /> when `selectedGameId === 'power_grid'` */
            <div className="flex-1 overflow-y-auto p-4 bg-slate-950">
              <PowerGridBoard
                state={powerGridSanitized}
                viewingPlayerId={viewedPlayerId}
                playerNames={runnerMode === 'MULTIPLAYER' ? mp.playerNames : {}}
                onDispatchAction={(action) =>
                  dispatchEngineAction(viewedPlayerId, action)
                }
              />
            </div>
          ) : (
            /* Mount <TTRBoard /> when `selectedGameId === 'ttr'` */
            ttrSanitized && (
              <>
                <div className="flex-1 relative min-h-0">
                  <InteractiveMap
                    routes={ttrSanitized.routes}
                    playerOrder={ttrSanitized.playerOrder}
                    selectedRouteId={selectedRouteId}
                    highlightedCities={highlightedCities}
                    onSelectRoute={(route) => {
                      if (isControlsLocked) {
                        return;
                      }
                      setSelectedRouteId((prev) =>
                        prev === route.id ? null : route.id
                      );
                    }}
                  />

                  {/* Claim Route Interactive Popover when a route is clicked */}
                  {selectedRoute && !isControlsLocked && (
                    <ClaimRoutePopover
                      route={selectedRoute}
                      activePlayerId={activePlayerId}
                      actingAsPlayerId={viewedPlayerId}
                      playerHand={ttrSanitized.self.hand}
                      onConfirmClaim={(actorId, routeId, payment) =>
                        dispatchEngineAction(actorId, {
                          type: 'CLAIM_ROUTE',
                          routeId,
                          payment,
                        })
                      }
                      onClose={() => setSelectedRouteId(null)}
                    />
                  )}

                  {/* Pending Destination Ticket Selection Prompt */}
                  {ttrSanitized.self.pendingTickets.length > 0 && (
                    <div className="absolute top-3 left-3 z-40 w-[420px] bg-slate-900/95 border-2 border-amber-500/70 rounded-2xl shadow-2xl backdrop-blur-md p-4 text-xs">
                      <div className="flex items-start justify-between border-b border-slate-800 pb-3">
                        <div>
                          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-amber-500/20 text-amber-300">
                            {ttrSanitized.phase === 'INITIAL_TICKET_SELECTION'
                              ? 'Opening Hand — Initial Route Selection'
                              : 'Mid-Game Destination Ticket Draw'}
                          </span>
                          <h3 className="text-base font-bold text-slate-100 mt-1">
                            {formatPlayerLabel(ttrSanitized.self.id)}: Keep or
                            Discard Routes
                          </h3>
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            {ttrSanitized.phase === 'INITIAL_TICKET_SELECTION'
                              ? 'Keep all 3 routes, or uncheck 1 route to discard it (minimum 2 required).'
                              : `Select at least ${ttrSanitized.self.minTicketsToKeep} route(s) to keep. Hover any ticket to preview its cities on the map.`}
                          </p>
                        </div>
                      </div>

                      {/* Progress indicator during initial selection */}
                      {ttrSanitized.phase === 'INITIAL_TICKET_SELECTION' && (
                        <div className="mt-2.5 flex items-center gap-1.5 flex-wrap">
                          {ttrSanitized.playerOrder.map((pid) => {
                            const pendingCount =
                              pid === ttrSanitized.self.id
                                ? ttrSanitized.self.pendingTickets.length
                                : ttrSanitized.opponents[pid]
                                    ?.pendingTicketCount ?? 0;
                            const isDone = pendingCount === 0;
                            const isCurrent = pid === ttrSanitized.self.id;
                            return (
                              <span
                                key={pid}
                                className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${
                                  isDone
                                    ? 'bg-emerald-950/70 border-emerald-500/50 text-emerald-300'
                                    : isCurrent
                                    ? 'bg-amber-500/20 border-amber-400 text-amber-200'
                                    : 'bg-slate-950 border-slate-800 text-slate-500'
                                }`}
                              >
                                {formatPlayerLabel(pid)}:{' '}
                                {isDone ? '✓ Ready' : 'Choosing...'}
                              </span>
                            );
                          })}
                        </div>
                      )}

                      <div className="mt-3 space-y-2">
                        {ttrSanitized.self.pendingTickets.map((tkt) => {
                          const isChecked = selectedPendingIds.includes(tkt.id);
                          const isAlreadyConnected =
                            viewedPlayerGraph.isConnected(tkt.from, tkt.to);
                          return (
                            <label
                              key={tkt.id}
                              onMouseEnter={() => setHoveredTicket(tkt)}
                              onMouseLeave={() => setHoveredTicket(null)}
                              className={`flex items-center justify-between p-2.5 rounded-xl border cursor-pointer transition ${
                                isChecked
                                  ? 'bg-amber-500/15 border-amber-400 text-slate-100'
                                  : 'bg-rose-950/30 border-rose-500/40 text-slate-400 hover:border-rose-400/60'
                              }`}
                            >
                              <div className="flex items-center gap-2.5">
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() =>
                                    togglePendingTicketSelection(tkt.id)
                                  }
                                  className="w-4 h-4 accent-amber-400 rounded"
                                />
                                <div>
                                  <div className="font-bold text-sm flex items-center gap-2">
                                    <span
                                      className={
                                        isChecked
                                          ? ''
                                          : 'line-through text-slate-500'
                                      }
                                    >
                                      {tkt.from} → {tkt.to}
                                    </span>
                                    <span
                                      className={`text-[10px] px-1.5 py-0.5 rounded font-bold uppercase ${
                                        isChecked
                                          ? 'bg-emerald-500/20 text-emerald-300'
                                          : 'bg-rose-500/20 text-rose-300'
                                      }`}
                                    >
                                      {isChecked ? 'Keep' : 'Discard'}
                                    </span>
                                  </div>
                                  <div className="text-[10px] text-slate-400 font-mono">
                                    {tkt.id} • Hover to highlight cities on map
                                    {isAlreadyConnected && (
                                      <span className="text-emerald-400 font-sans font-semibold ml-1">
                                        • Connected!
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                              <span className="px-2.5 py-1 rounded-lg bg-slate-800 font-mono font-bold text-amber-300 text-xs shrink-0">
                                +{tkt.points} pts
                              </span>
                            </label>
                          );
                        })}
                      </div>

                      <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between gap-2">
                        <div className="text-[11px] text-slate-400">
                          Keeping:{' '}
                          <strong className="text-emerald-300">
                            {selectedPendingIds.length}
                          </strong>{' '}
                          • Discarding:{' '}
                          <strong className="text-rose-300">
                            {ttrSanitized.self.pendingTickets.length -
                              selectedPendingIds.length}
                          </strong>{' '}
                          <span className="text-slate-500">
                            (Min {ttrSanitized.self.minTicketsToKeep})
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          {selectedPendingIds.length <
                            ttrSanitized.self.pendingTickets.length && (
                            <button
                              type="button"
                              onClick={() =>
                                setSelectedPendingIds(
                                  ttrSanitized.self.pendingTickets.map(
                                    (t) => t.id
                                  )
                                )
                              }
                              className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold transition"
                            >
                              Select All 3
                            </button>
                          )}
                          <button
                            type="button"
                            disabled={mp.pendingAction}
                            onClick={() =>
                              dispatchEngineAction(ttrSanitized.self.id, {
                                type: 'KEEP_TICKETS',
                                ticketIds: selectedPendingIds,
                              })
                            }
                            className="px-3.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-slate-950 font-bold transition shadow"
                          >
                            {mp.pendingAction
                              ? 'Submitting...'
                              : selectedPendingIds.length ===
                                ttrSanitized.self.pendingTickets.length
                              ? `Keep All ${selectedPendingIds.length} Routes`
                              : `Keep ${selectedPendingIds.length} & Discard ${
                                  ttrSanitized.self.pendingTickets.length -
                                  selectedPendingIds.length
                                }`}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* 3. BOTTOM PANEL — TTR ACTIVE / VIEWED PLAYER DASHBOARD */}
                <section
                  className={`h-60 shrink-0 bg-slate-900 border-t-2 px-4 py-3 flex gap-4 overflow-x-auto z-20 transition-all ${
                    runnerMode === 'MULTIPLAYER' && isMyTurn
                      ? 'border-emerald-500/80 shadow-[0_-4px_20px_rgba(16,185,129,0.18)]'
                      : 'border-slate-800'
                  }`}
                >
                  {/* Column A: Player Hand Display */}
                  <div className="flex-1 min-w-[320px] flex flex-col justify-between bg-slate-950/70 border border-slate-800 rounded-xl p-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                          Hand ({formatPlayerLabel(ttrSanitized.self.id)})
                        </span>
                        {runnerMode === 'LOCAL' && viewport === 'GOD_MODE' ? (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/40 font-semibold">
                            God Mode Active Actor
                          </span>
                        ) : isMyTurn ? (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold">
                            ⚡ Your Turn
                          </span>
                        ) : (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700 font-semibold">
                            Waiting for {formatPlayerLabel(activePlayerId)}
                          </span>
                        )}
                      </div>

                      {runnerMode === 'LOCAL' && viewport === 'GOD_MODE' && (
                        <button
                          onClick={handleGodModeGrantCards}
                          className="text-[10px] px-2 py-0.5 rounded bg-purple-600/30 hover:bg-purple-600/50 text-purple-200 border border-purple-500/40 font-semibold transition"
                          title="Sandbox helper: add +1 of every train card color to active player's hand"
                        >
                          +1 All Cards (God Cheat)
                        </button>
                      )}
                    </div>

                    {/* 9 Card Color Stacks */}
                    <div className="grid grid-cols-9 gap-1.5 my-auto pt-3">
                      {ALL_TRAIN_CARD_COLORS.map((color) => {
                        const count = ttrSanitized.self.hand[color];
                        const drawnCount =
                          ttrSanitized.self.recentDrawnCards?.[color] ?? 0;
                        const theme = ROUTE_COLOR_THEMES[color];
                        return (
                          <div
                            key={color}
                            className={`relative flex flex-col items-center justify-between rounded-lg p-1.5 border transition ${
                              drawnCount > 0
                                ? 'bg-slate-900 border-amber-400 ring-1 ring-amber-400/50 shadow-md'
                                : count > 0
                                ? 'bg-slate-900 border-slate-700 shadow-sm'
                                : 'bg-slate-950/40 border-slate-800/60 opacity-45'
                            }`}
                          >
                            {drawnCount > 0 && (
                              <span
                                className="absolute -top-2.5 left-1/2 -translate-x-1/2 px-1.5 py-0.2 rounded-full bg-amber-400 text-slate-950 font-mono text-[10px] font-black shadow-md border border-amber-200 animate-bounce"
                                title={`Drew ${drawnCount}x ${color} on last action`}
                              >
                                {drawnCount}x
                              </span>
                            )}
                            <div
                              className={`w-full h-9 rounded border flex items-center justify-center font-mono text-sm font-black shadow-inner ${theme.badgeBg} ${theme.badgeBorder}`}
                            >
                              {count}
                            </div>
                            <span className="text-[9px] font-bold tracking-tight text-slate-300 mt-1 truncate max-w-full">
                              {color === 'LOCOMOTIVE' ? 'LOCO' : color}
                            </span>
                          </div>
                        );
                      })}
                    </div>

                    {/* Opponent Sanitized Summary Strip */}
                    <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-800/80">
                      <span>Opponents (Sanitized Counts Only):</span>
                      <div className="flex items-center gap-3">
                        {Object.values(ttrSanitized.opponents).map((opp) => (
                          <span
                            key={opp.id}
                            className="font-mono text-slate-300"
                          >
                            {formatPlayerLabel(opp.id)}: 🃏{opp.handCount} 🎫
                            {opp.ticketCount}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Column B: Face-Up Train Market & Blind Deck */}
                  <div className="w-[410px] shrink-0 flex flex-col justify-between bg-slate-950/70 border border-slate-800 rounded-xl p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                        Train Card Market
                      </span>
                      <span className="text-[11px] font-mono text-slate-400">
                        Deck:{' '}
                        <strong className="text-slate-200">
                          {ttrSanitized.trainDeckCount}
                        </strong>{' '}
                        • Discard:{' '}
                        <strong className="text-slate-200">
                          {ttrSanitized.trainDiscardCount}
                        </strong>
                      </span>
                    </div>

                    <div className="grid grid-cols-6 gap-1.5 my-auto pt-1">
                      {/* Blind Deck Button */}
                      <button
                        disabled={isControlsLocked}
                        onClick={() =>
                          dispatchEngineAction(viewedPlayerId, {
                            type: 'DRAW_CARDS',
                            source: 'DECK',
                          })
                        }
                        className="flex flex-col items-center justify-center rounded-lg p-1.5 bg-indigo-950/70 hover:bg-indigo-900/80 disabled:opacity-40 disabled:cursor-not-allowed border border-indigo-500/50 text-indigo-200 transition shadow group"
                        title="Draw 1 blind card from top of Train Deck"
                      >
                        <div className="w-full h-11 rounded bg-indigo-600/40 border border-indigo-400/50 flex flex-col items-center justify-center">
                          <span className="text-xs font-black">
                            {mp.pendingAction ? '...' : 'DECK'}
                          </span>
                          <span className="text-[9px] font-mono">
                            ({ttrSanitized.trainDeckCount})
                          </span>
                        </div>
                        <span className="text-[9px] font-bold mt-1 text-indigo-300 group-hover:text-white">
                          Draw Blind
                        </span>
                      </button>

                      {/* 5 Face-Up Slots */}
                      {ttrSanitized.faceUpCards.map((card, slotIdx) => {
                        if (!card) {
                          return (
                            <div
                              key={slotIdx}
                              className="flex flex-col items-center justify-center rounded-lg p-1.5 bg-slate-900/40 border border-slate-800 text-slate-600 text-[10px]"
                            >
                              Empty
                            </div>
                          );
                        }
                        const theme = ROUTE_COLOR_THEMES[card];
                        return (
                          <button
                            key={slotIdx}
                            disabled={isControlsLocked}
                            onClick={() =>
                              dispatchEngineAction(viewedPlayerId, {
                                type: 'DRAW_CARDS',
                                source: 'FACE_UP',
                                slotIndex: slotIdx,
                              })
                            }
                            className="flex flex-col items-center justify-between rounded-lg p-1.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed border border-slate-700 hover:border-amber-400 transition group"
                            title={`Draw face-up ${card} from slot #${slotIdx}`}
                          >
                            <div
                              className={`w-full h-11 rounded border flex items-center justify-center font-black text-[10px] shadow ${theme.badgeBg} ${theme.badgeBorder}`}
                            >
                              {card === 'LOCOMOTIVE' ? '🌈 LOCO' : card}
                            </div>
                            <span className="text-[9px] font-mono text-slate-400 group-hover:text-amber-300 mt-1">
                              Slot #{slotIdx}
                            </span>
                          </button>
                        );
                      })}
                    </div>

                    <div className="text-[10px] text-slate-400 flex items-center justify-between pt-1 border-t border-slate-800/80">
                      <span>
                        {isControlsLocked && runnerMode === 'MULTIPLAYER' ? (
                          <span className="text-slate-500">
                            Controls locked while waiting for{' '}
                            {formatPlayerLabel(activePlayerId)}
                          </span>
                        ) : ttrSanitized.turnStep === 'DREW_ONE_CARD' ? (
                          <strong className="text-amber-300">
                            Step 2/2: Draw 1 more card (non-Locomotive face-up
                            or blind deck)
                          </strong>
                        ) : (
                          'Click any slot or Deck to draw cards (Face-up Loco costs 2 draws)'
                        )}
                      </span>
                    </div>
                  </div>

                  {/* Column C: Destination Tickets & Draw Tickets Action */}
                  <div className="w-80 shrink-0 flex flex-col justify-between bg-slate-950/70 border border-slate-800 rounded-xl p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                        Destination Tickets ({ttrSanitized.self.tickets.length})
                      </span>
                      <button
                        disabled={isControlsLocked}
                        onClick={() =>
                          dispatchEngineAction(viewedPlayerId, {
                            type: 'DRAW_TICKETS',
                          })
                        }
                        className="px-2.5 py-1 rounded bg-amber-500/20 hover:bg-amber-500/30 disabled:opacity-40 disabled:cursor-not-allowed text-amber-300 border border-amber-500/40 text-[11px] font-bold transition"
                      >
                        + Draw Tickets ({ttrSanitized.ticketDeckCount})
                      </button>
                    </div>

                    <div className="flex-1 overflow-y-auto space-y-1.5 my-1.5 pr-1">
                      {ttrSanitized.self.tickets.map((tkt) => {
                        const completed = viewedPlayerGraph.isConnected(
                          tkt.from,
                          tkt.to
                        );
                        return (
                          <div
                            key={tkt.id}
                            onMouseEnter={() => setHoveredTicket(tkt)}
                            onMouseLeave={() => setHoveredTicket(null)}
                            className={`px-2.5 py-1.5 rounded-lg border text-xs flex items-center justify-between transition cursor-default ${
                              completed
                                ? 'bg-emerald-950/60 border-emerald-500/60 text-emerald-200'
                                : 'bg-slate-900/90 border-slate-800 text-slate-200 hover:border-slate-700'
                            }`}
                          >
                            <div className="truncate pr-2">
                              <div className="font-semibold flex items-center gap-1.5">
                                <span>
                                  {tkt.from} → {tkt.to}
                                </span>
                              </div>
                              <div className="text-[10px] text-slate-400">
                                {completed
                                  ? '✓ Route Connected'
                                  : 'Hover to highlight cities'}
                              </div>
                            </div>
                            <span
                              className={`px-2 py-0.5 rounded font-mono font-bold text-xs shrink-0 ${
                                completed
                                  ? 'bg-emerald-500 text-slate-950'
                                  : 'bg-slate-800 text-amber-300'
                              }`}
                            >
                              {completed ? `+${tkt.points}` : `±${tkt.points}`}
                            </span>
                          </div>
                        );
                      })}
                    </div>

                    <div className="text-[10px] text-slate-400 flex items-center justify-between pt-1 border-t border-slate-800/80">
                      <span>
                        Projected Total Score (
                        {formatPlayerLabel(ttrSanitized.self.id)}):
                      </span>
                      <span className="font-mono font-bold text-xs text-emerald-400">
                        {selfProjectedScore} pts
                      </span>
                    </div>
                  </div>
                </section>
              </>
            )
          )}

          {/* =================================================================
              PHASE 1 & 2: ENTRY VIEW (`/`) & WAITING ROOM LOBBY (`/room/:id`)
              WITH GAME SELECTION CAROUSEL
             ================================================================= */}
          {runnerMode === 'MULTIPLAYER' && !isMultiplayerActive && (
            <div className="absolute inset-0 bg-slate-950/92 backdrop-blur-md flex items-center justify-center z-40 p-4 overflow-y-auto">
              {!mp.roomId ? (
                /* 1A. THE ENTRY VIEW (`/`) */
                <div className="w-full max-w-xl bg-slate-900 border border-emerald-500/50 rounded-2xl shadow-2xl p-6 text-xs">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300">
                        Boardgames Platform • Online Matchmaking
                      </span>
                      <h2 className="text-xl font-bold text-slate-100 mt-1">
                        Create or Join a Match
                      </h2>
                    </div>
                    <span
                      className={`px-2.5 py-1 rounded-full font-mono text-[11px] font-bold ${
                        mp.connected
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                          : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                      }`}
                    >
                      {mp.connected ? '● Server Online' : '○ Server Offline'}
                    </span>
                  </div>

                  {mp.errorBanner && (
                    <div className="mt-3 p-2.5 rounded-lg bg-rose-950/90 border border-rose-500/70 text-rose-200 font-medium">
                      ⚠️ {mp.errorBanner}
                    </div>
                  )}

                  <div className="mt-4 space-y-4">
                    <div>
                      <label className="block text-slate-300 font-semibold mb-1">
                        Your Player Name
                      </label>
                      <input
                        type="text"
                        value={playerNameInput}
                        onChange={(e) => setPlayerNameInput(e.target.value)}
                        placeholder="Enter your name (e.g. Alice)"
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-slate-100 text-sm font-medium focus:outline-none focus:border-emerald-400"
                      />
                    </div>

                    {/* Categorized Game Selection on Entry View (Board Games vs Card Games) */}
                    <div className="space-y-3">
                      <div>
                        <label className="block text-emerald-300 font-bold uppercase tracking-wider text-[11px] mb-1.5">
                          🎲 Board Games
                        </label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                          {BOARD_GAME_METADATA_LIST.map((game) => {
                            const isSelected = entrySelectedGameId === game.id;
                            return (
                              <button
                                key={game.id}
                                type="button"
                                onClick={() => setEntrySelectedGameId(game.id)}
                                className={`p-3 rounded-xl border text-left transition flex flex-col justify-between ${
                                  isSelected
                                    ? 'bg-emerald-950/50 border-emerald-400 shadow-lg ring-1 ring-emerald-400/50'
                                    : 'bg-slate-950/80 border-slate-800 hover:border-slate-700'
                                }`}
                              >
                                <div>
                                  <div className="flex items-center justify-between">
                                    <span className="font-black text-sm text-slate-100">
                                      {game.icon} {game.title}
                                    </span>
                                    {isSelected && (
                                      <span className="px-1.5 py-0.5 rounded bg-emerald-500 text-slate-950 text-[10px] font-black uppercase">
                                        Selected
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-[11px] text-amber-300 font-semibold mt-1">
                                    {game.minPlayers}–{game.maxPlayers} Players
                                    | {game.durationLabel}
                                  </div>
                                  <div className="text-[11px] text-slate-400 mt-0.5">
                                    {game.mechanicsLabel}
                                  </div>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <div>
                        <label className="block text-amber-300 font-bold uppercase tracking-wider text-[11px] mb-1.5">
                          🃏 Card Games
                        </label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                          {CARD_GAME_METADATA_LIST.map((game) => {
                            const isSelected = entrySelectedGameId === game.id;
                            return (
                              <button
                                key={game.id}
                                type="button"
                                onClick={() => setEntrySelectedGameId(game.id)}
                                className={`p-3 rounded-xl border text-left transition flex flex-col justify-between ${
                                  isSelected
                                    ? 'bg-emerald-950/50 border-emerald-400 shadow-lg ring-1 ring-emerald-400/50'
                                    : 'bg-slate-950/80 border-slate-800 hover:border-slate-700'
                                }`}
                              >
                                <div>
                                  <div className="flex items-center justify-between">
                                    <span className="font-black text-sm text-slate-100">
                                      {game.icon} {game.title}
                                    </span>
                                    {isSelected && (
                                      <span className="px-1.5 py-0.5 rounded bg-emerald-500 text-slate-950 text-[10px] font-black uppercase">
                                        Selected
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-[11px] text-amber-300 font-semibold mt-1">
                                    {game.minPlayers}–{game.maxPlayers} Players
                                    | {game.durationLabel}
                                  </div>
                                  <div className="text-[11px] text-slate-400 mt-0.5">
                                    {game.mechanicsLabel}
                                  </div>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 pt-1">
                      {/* Host Flow */}
                      <div className="p-4 rounded-xl bg-slate-950/90 border border-slate-800 flex flex-col justify-between">
                        <div>
                          <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">
                            Host Flow
                          </div>
                          <h3 className="font-bold text-slate-100 text-sm mt-0.5">
                            Create New Lobby
                          </h3>
                          <p className="text-slate-400 text-[11px] mt-1 leading-relaxed">
                            Generates a 6-character room code and shareable
                            invite URL (
                            <code className="text-slate-300">/join/ABCD12</code>
                            ).
                          </p>
                        </div>
                        <button
                          onClick={() =>
                            mp.createRoom(playerNameInput, entrySelectedGameId)
                          }
                          disabled={!mp.connected || !playerNameInput.trim()}
                          className="mt-4 w-full py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-slate-950 font-black text-xs transition shadow-lg"
                        >
                          + Create {GameRegistry[entrySelectedGameId].title} Room
                        </button>
                      </div>

                      {/* Join Flow */}
                      <div className="p-4 rounded-xl bg-slate-950/90 border border-slate-800 flex flex-col justify-between">
                        <div>
                          <div className="text-[10px] font-bold uppercase tracking-wider text-amber-400">
                            Join Flow
                          </div>
                          <h3 className="font-bold text-slate-100 text-sm mt-0.5">
                            Join by Room Code
                          </h3>
                          <input
                            type="text"
                            value={joinCodeInput}
                            onChange={(e) =>
                              setJoinCodeInput(e.target.value.toUpperCase())
                            }
                            placeholder="ABCD12"
                            maxLength={6}
                            className="mt-2.5 w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 font-mono uppercase tracking-widest text-amber-300 text-sm font-bold focus:outline-none focus:border-amber-400"
                          />
                        </div>
                        <button
                          onClick={() =>
                            mp.joinRoom(joinCodeInput, playerNameInput)
                          }
                          disabled={
                            !mp.connected ||
                            !joinCodeInput.trim() ||
                            !playerNameInput.trim()
                          }
                          className="mt-4 w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-slate-950 font-black text-xs transition shadow-lg"
                        >
                          → Join Room
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                /* 1B. THE WAITING ROOM VIEW (`/room/:id`) WITH GAME SELECTOR CAROUSEL */
                <div className="w-full max-w-2xl bg-slate-900 border border-amber-500/50 rounded-2xl shadow-2xl p-6 text-xs">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-amber-500/20 text-amber-300">
                        Waiting Room • /room/{mp.roomId}
                      </span>
                      <h2 className="text-xl font-bold text-slate-100 mt-1">
                        Game Lobby ({mp.lobbyPlayers.length} Seated)
                      </h2>
                    </div>
                    <button
                      onClick={mp.leaveRoom}
                      className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-rose-950 hover:text-rose-200 text-slate-300 font-semibold transition"
                    >
                      Leave Lobby
                    </button>
                  </div>

                  {/* =========================================================
                      CATEGORIZED GAME SELECTION MENU (Board Games & Card Games)
                     ========================================================= */}
                  <div className="mt-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-bold uppercase tracking-wider text-slate-300 text-[11px]">
                        Game Selection Menu
                      </span>
                      <span className="text-[11px] text-slate-400">
                        {mp.playerId === mp.hostPlayerId
                          ? '👑 Host Controls: Click any Board or Card game below to switch'
                          : `🔒 Guest View: Host (${formatPlayerLabel(mp.hostPlayerId ?? 'p1')}) selects the game`}
                      </span>
                    </div>

                    {(
                      [
                        {
                          label: '🎲 Board Games',
                          accent: 'text-emerald-300',
                          items: BOARD_GAME_METADATA_LIST,
                        },
                        {
                          label: '🃏 Card Games',
                          accent: 'text-amber-300',
                          items: CARD_GAME_METADATA_LIST,
                        },
                      ] as const
                    ).map((section) => (
                      <div key={section.label}>
                        <div
                          className={`text-[11px] font-black uppercase tracking-wider mb-1.5 ${section.accent}`}
                        >
                          {section.label}
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                          {section.items.map((game) => {
                            const isSelected = mp.selectedGameId === game.id;
                            const isHost = mp.playerId === mp.hostPlayerId;
                            const neededForThisGame = Math.max(
                              0,
                              game.minPlayers - currentLobbyCount
                            );
                            const tooManyForThisGame = Math.max(
                              0,
                              currentLobbyCount - game.maxPlayers
                            );

                            return (
                              <div
                                key={game.id}
                                onClick={() => {
                                  if (isHost && !isSelected) {
                                    mp.selectGame(game.id);
                                  }
                                }}
                                className={`p-3.5 rounded-xl border-2 transition flex flex-col justify-between ${
                                  isSelected
                                    ? 'bg-emerald-950/45 border-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.2)]'
                                    : 'bg-slate-950/70 border-slate-800 opacity-75'
                                } ${
                                  isHost
                                    ? 'cursor-pointer hover:border-emerald-400/70 hover:opacity-100'
                                    : 'cursor-default'
                                }`}
                              >
                                <div>
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="text-sm font-black text-slate-100">
                                      {game.icon} {game.title}
                                    </span>
                                    {isSelected ? (
                                      <span className="px-2 py-0.5 rounded-full bg-emerald-500 text-slate-950 font-black text-[10px] uppercase">
                                        ✓ Active Game
                                      </span>
                                    ) : (
                                      isHost && (
                                        <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-400 text-[10px] font-semibold">
                                          Click to Select
                                        </span>
                                      )
                                    )}
                                  </div>

                                  <div className="mt-1.5 inline-block px-2 py-0.5 rounded bg-slate-900 border border-slate-700 text-amber-300 font-semibold text-[10px]">
                                    {game.minPlayers}–{game.maxPlayers} Players
                                    | {game.durationLabel} |{' '}
                                    {game.mechanicsLabel}
                                  </div>
                                </div>

                                {/* Live Player Requirement Badge */}
                                <div className="mt-2.5 pt-2 border-t border-slate-800/80 flex items-center justify-between">
                                  {neededForThisGame > 0 ? (
                                    <span className="px-2 py-0.5 rounded bg-amber-500/20 border border-amber-500/40 text-amber-300 font-semibold text-[10px]">
                                      ⏳ Need {neededForThisGame} more player
                                      {neededForThisGame === 1 ? '' : 's'} for{' '}
                                      {game.title}
                                    </span>
                                  ) : tooManyForThisGame > 0 ? (
                                    <span className="px-2 py-0.5 rounded bg-rose-500/20 border border-rose-500/40 text-rose-300 font-semibold text-[10px]">
                                      ⚠️ Max {game.maxPlayers} players for{' '}
                                      {game.title}
                                    </span>
                                  ) : (
                                    <span className="px-2 py-0.5 rounded bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 font-semibold text-[10px]">
                                      ✓ Player count ready ({currentLobbyCount}/
                                      {game.maxPlayers})
                                    </span>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Direct Invite URL & Copy Button */}
                  <div className="mt-4 p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-slate-400 text-[11px] font-medium">
                        Shareable Direct Invite Link (Room Code:{' '}
                        <strong className="font-mono text-amber-400">
                          {mp.roomId}
                        </strong>
                        ):
                      </div>
                      <div className="font-mono text-xs text-emerald-300 truncate mt-0.5">
                        {`${window.location.origin}/join/${mp.roomId}`}
                      </div>
                    </div>
                    <button
                      onClick={handleCopyInviteLink}
                      className={`px-3.5 py-2 rounded-xl font-bold shrink-0 border transition shadow ${
                        copiedLink
                          ? 'bg-emerald-500 text-slate-950 border-emerald-400'
                          : 'bg-slate-800 hover:bg-slate-700 text-slate-100 border-slate-700'
                      }`}
                    >
                      {copiedLink ? '✓ Link Copied!' : '📋 Copy Invite Link'}
                    </button>
                  </div>

                  {/* Connected Players List with Live Connection Indicators */}
                  <div className="mt-4">
                    <div className="text-slate-400 font-semibold mb-2 flex items-center justify-between">
                      <span>
                        Connected Players ({currentLobbyCount} /{' '}
                        {selectedLobbyGameMeta.maxPlayers})
                      </span>
                      <span className="text-[11px] text-slate-500">
                        Green = Online • Yellow = Reconnecting
                      </span>
                    </div>
                    <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                      {mp.lobbyPlayers.map((p) => (
                        <div
                          key={p.playerId}
                          className="px-3.5 py-2 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center justify-between"
                        >
                          <div className="flex items-center gap-2.5">
                            <span
                              className={`w-2.5 h-2.5 rounded-full ${
                                p.connected
                                  ? 'bg-emerald-400 shadow-[0_0_8px_#34d399]'
                                  : 'bg-amber-400 animate-pulse'
                              }`}
                            />
                            <span className="font-bold text-sm text-slate-100">
                              {p.name}
                            </span>
                            <span className="font-mono text-slate-400 text-xs">
                              ({p.playerId})
                            </span>
                            {p.playerId === mp.playerId && (
                              <span className="px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 text-[10px] font-bold">
                                YOU
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            {!p.connected && (
                              <span className="text-[10px] text-amber-300 font-mono">
                                Reconnecting...
                              </span>
                            )}
                            {p.isHost && (
                              <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-bold uppercase">
                                👑 Host
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Host-Only Start Controls */}
                  <div className="mt-5 pt-4 border-t border-slate-800 flex items-center justify-between">
                    <span className="text-slate-400">
                      {lobbyShortfall > 0
                        ? `Need ${lobbyShortfall} more player${lobbyShortfall === 1 ? '' : 's'} for ${selectedLobbyGameMeta.title} (${selectedLobbyGameMeta.minPlayers}–${selectedLobbyGameMeta.maxPlayers}P)`
                        : lobbyExcess > 0
                        ? `Too many players for ${selectedLobbyGameMeta.title} (max ${selectedLobbyGameMeta.maxPlayers}P)`
                        : `Ready to launch ${selectedLobbyGameMeta.title}!`}
                    </span>
                    {mp.playerId === mp.hostPlayerId ? (
                      <button
                        onClick={() => mp.startGame()}
                        disabled={!canStartLobbyGame}
                        className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-slate-950 font-black text-xs transition shadow-lg"
                      >
                        ▶ Start {selectedLobbyGameMeta.title}
                      </button>
                    ) : (
                      <span className="px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-amber-300 font-semibold">
                        Waiting for Host (
                        {formatPlayerLabel(mp.hostPlayerId ?? 'p1')}) to start{' '}
                        {selectedLobbyGameMeta.title}...
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* =================================================================
              PHASE 3: FULL GAME OVER LEADERBOARD MODAL
             ================================================================= */}
          {activeSanitized.phase === 'GAME_OVER' && (
            <div className="absolute inset-0 bg-slate-950/88 backdrop-blur-md flex items-center justify-center z-50 p-4 overflow-y-auto">
              <div className="w-full max-w-2xl bg-slate-900 border-2 border-emerald-500/70 rounded-2xl shadow-2xl p-6 text-xs">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div>
                    <span className="px-2.5 py-0.5 rounded bg-emerald-500 text-slate-950 font-black uppercase text-[10px]">
                      Official Final Standings •{' '}
                      {GameRegistry[activeGameId].title}
                    </span>
                    <h2 className="text-2xl font-black text-slate-100 mt-1">
                      🏆 Match Complete — Final Leaderboard
                    </h2>
                  </div>
                  <div className="flex items-center gap-2">
                    {runnerMode === 'MULTIPLAYER' ? (
                      mp.playerId === mp.hostPlayerId ? (
                        <>
                          <button
                            onClick={() => mp.resetToLobby()}
                            className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold border border-slate-700 transition"
                          >
                            ← Back to Lobby
                          </button>
                          <button
                            onClick={() => mp.startGame()}
                            className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black transition shadow-lg"
                          >
                            ↻ Play Again
                          </button>
                        </>
                      ) : (
                        <span className="text-amber-300 font-semibold">
                          Waiting for Host to start rematch or return to
                          lobby...
                        </span>
                      )
                    ) : (
                      <button
                        onClick={() => handleStartNewLocalGame()}
                        className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black transition shadow-lg"
                      >
                        ↻ Play Again
                      </button>
                    )}
                  </div>
                </div>

                {/* Standings Cards */}
                <div className="mt-4 space-y-3 max-h-[65vh] overflow-y-auto pr-1">
                  {effectiveFinalStandings.map((standing, idx) => {
                    const isWinner = idx === 0;
                    return (
                      <div
                        key={standing.playerId}
                        className={`p-4 rounded-xl border ${
                          isWinner
                            ? 'bg-emerald-950/40 border-emerald-400/80 shadow-lg'
                            : 'bg-slate-950/80 border-slate-800'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2.5">
                            <span
                              className={`w-6 h-6 rounded-full flex items-center justify-center font-black text-xs ${
                                isWinner
                                  ? 'bg-amber-400 text-slate-950'
                                  : 'bg-slate-800 text-slate-300'
                              }`}
                            >
                              #{idx + 1}
                            </span>
                            <span className="text-base font-bold text-slate-100">
                              {standing.name}{' '}
                              <span className="font-mono text-xs text-slate-400">
                                ({standing.playerId})
                              </span>
                            </span>
                          </div>

                          <div className="flex items-center gap-3 font-mono">
                            <span className="px-3 py-1 rounded-lg bg-slate-900 border border-emerald-500/40 text-base font-black text-emerald-300">
                              {standing.totalScore}{' '}
                              {activeGameId === 'catan' ? 'VP' : 'pts'}
                            </span>
                          </div>
                        </div>

                        {/* Revealed Destination Tickets (for TTR) */}
                        {standing.tickets.length > 0 && (
                          <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex flex-wrap gap-2">
                            {standing.tickets.map(({ ticket, completed }) => (
                              <div
                                key={ticket.id}
                                className={`px-2.5 py-1 rounded-lg border text-[11px] font-semibold flex items-center gap-2 ${
                                  completed
                                    ? 'bg-emerald-950/70 border-emerald-500/50 text-emerald-200'
                                    : 'bg-rose-950/60 border-rose-500/50 text-rose-200'
                                }`}
                              >
                                <span>{completed ? '✓' : '✗'}</span>
                                <span>
                                  {ticket.from} → {ticket.to}
                                </span>
                                <span className="font-mono font-bold">
                                  {completed
                                    ? `+${ticket.points}`
                                    : `-${ticket.points}`}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* =====================================================================
            4. RIGHT SIDEBAR — ENGINE DEBUGGER, FEEDBACK & RAW STATE INSPECTOR
           ===================================================================== */}
        {(showDebugger || runnerMode === 'LOCAL') && (
          <aside className="w-96 shrink-0 bg-slate-900 border-l border-slate-800 flex flex-col min-h-0 z-20">
            {/* Action Feedback Banner */}
            <div className="p-3 border-b border-slate-800">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5 flex items-center justify-between">
                <span>Engine Validation Status</span>
                {effectiveErrorBanner && (
                  <button
                    onClick={() =>
                      runnerMode === 'MULTIPLAYER'
                        ? mp.clearError()
                        : setLocalErrorBanner(null)
                    }
                    className="text-[10px] text-slate-400 hover:text-slate-200"
                  >
                    Dismiss
                  </button>
                )}
              </div>
              {effectiveErrorBanner ? (
                <div className="p-2.5 rounded-lg bg-rose-950/90 border border-rose-500/70 text-rose-200 text-xs font-medium shadow-lg">
                  ⚠️ {effectiveErrorBanner}
                </div>
              ) : (
                <div className="p-2 rounded-lg bg-emerald-950/40 border border-emerald-700/40 text-emerald-300 text-xs flex items-center gap-2">
                  <span>●</span>
                  <span>
                    {runnerMode === 'MULTIPLAYER'
                      ? `Authoritative Server Sync (${GameRegistry[activeGameId].title})`
                      : `Ready — ${GameRegistry[activeGameId].title} Engine Active`}
                  </span>
                </div>
              )}
            </div>

            {/* Action Log History */}
            <div className="flex-1 flex flex-col min-h-0 border-b border-slate-800">
              <div className="px-3 py-2 bg-slate-950/50 border-b border-slate-800 flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Dispatched Action Log ({actionLog.length})
                </span>
                {actionLog.length > 0 && (
                  <button
                    onClick={() => setActionLog([])}
                    className="text-[10px] text-slate-400 hover:text-slate-200"
                  >
                    Clear
                  </button>
                )}
              </div>

              <div className="flex-1 overflow-y-auto p-2.5 space-y-2 text-xs">
                {actionLog.length === 0 ? (
                  <div className="text-slate-500 text-center py-6 italic">
                    No actions dispatched yet.
                  </div>
                ) : (
                  actionLog.map((entry) => (
                    <div
                      key={entry.id}
                      className={`p-2 rounded-lg border font-mono text-[11px] ${
                        entry.valid
                          ? 'bg-slate-950/80 border-slate-800 text-slate-200'
                          : 'bg-rose-950/40 border-rose-700/50 text-rose-200'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold">
                          {entry.valid ? '✅' : '❌'} [T{entry.turnNumber}]{' '}
                          {entry.playerId} → {entry.action.type}
                        </span>
                        <span className="text-[10px] text-slate-500">
                          {entry.timestamp}
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-400 mt-1 break-all">
                        {JSON.stringify(entry.action)}
                      </div>
                      {entry.reason && (
                        <div className="text-[10px] text-rose-300 mt-1 font-sans font-semibold">
                          Reason: {entry.reason}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Collapsible Raw State vs Sanitized Perspective JSON Inspector */}
            <div className="flex flex-col max-h-[45%] min-h-[160px]">
              <div className="px-3 py-2 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
                <button
                  onClick={() => setIsInspectorOpen((o) => !o)}
                  className="text-[11px] font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5"
                >
                  <span>{isInspectorOpen ? '▾' : '▸'}</span>
                  <span>State Inspector</span>
                </button>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setInspectorTab('SANITIZED')}
                    className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      inspectorTab === 'SANITIZED'
                        ? 'bg-cyan-600 text-white'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    Sanitized ({viewedPlayerId})
                  </button>
                  {runnerMode === 'LOCAL' && (
                    <button
                      onClick={() => setInspectorTab('RAW')}
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        inspectorTab === 'RAW'
                          ? 'bg-purple-600 text-white'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      Raw GameState
                    </button>
                  )}
                </div>
              </div>

              {isInspectorOpen && (
                <pre className="flex-1 overflow-auto p-3 bg-slate-950 text-[10px] font-mono text-slate-300 leading-relaxed">
                  {JSON.stringify(
                    runnerMode === 'MULTIPLAYER' || inspectorTab === 'SANITIZED'
                      ? activeSanitized
                      : localGameState,
                    null,
                    2
                  )}
                </pre>
              )}
            </div>
          </aside>
        )}
      </div>
    </div>
  );
};

// Mount application when running in browser DOM
const rootElement = document.getElementById('root');
if (rootElement) {
  createRoot(rootElement).render(
    <React.StrictMode>
      <SandboxApp />
    </React.StrictMode>
  );
}
