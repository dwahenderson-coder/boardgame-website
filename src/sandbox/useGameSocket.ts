import { useCallback, useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import {
  AnyGameAction,
  AnySanitizedGameState,
  GameId,
} from '../games/registry.js';
import {
  ClientToServerEvents,
  PlayerFinalStanding,
  PlayerLobbySettings,
  RoomPlayerSummary,
  RoomStatus,
  ServerToClientEvents,
} from '../network/socketTypes.js';
import { GameCategorySlug } from '../types/game.js';

function resolveDefaultServerUrl(): string {
  const envUrl = (import.meta as unknown as { env?: Record<string, string> })
    .env?.['VITE_SERVER_URL'];
  if (envUrl) {
    return envUrl;
  }
  if (typeof window !== 'undefined') {
    if (window.location.port === '5173') {
      return 'http://localhost:3001';
    }
    return window.location.origin;
  }
  return 'http://localhost:3001';
}

const DEFAULT_SERVER_URL = resolveDefaultServerUrl();

export interface ToastMessage {
  readonly id: number;
  readonly text: string;
  readonly variant: 'error' | 'info' | 'success';
}

export interface UseGameSocketResult {
  readonly connected: boolean;
  readonly reconnecting: boolean;
  readonly pendingAction: boolean;
  readonly roomId: string | null;
  readonly category: GameCategorySlug | null;
  readonly selectedGameId: GameId;
  readonly configuredGameId: GameId | null;
  readonly selectedExpansions: readonly string[];
  readonly playerSettings: Readonly<Record<string, PlayerLobbySettings>>;
  readonly playerColors: Readonly<Record<string, string>>;
  readonly playerId: string | null;
  readonly roomStatus: RoomStatus | null;
  readonly hostPlayerId: string | null;
  readonly lobbyPlayers: readonly RoomPlayerSummary[];
  readonly playerNames: Readonly<Record<string, string>>;
  readonly sanitizedView: AnySanitizedGameState | null;
  readonly finalScores: Readonly<Record<string, number>> | null;
  readonly finalStandings: readonly PlayerFinalStanding[] | null;
  readonly errorBanner: string | null;
  readonly toasts: readonly ToastMessage[];
  readonly dismissToast: (id: number) => void;
  readonly clearError: () => void;
  readonly createRoom: (
    playerName: string,
    initialGameId?: GameId | null
  ) => void;
  readonly joinRoom: (roomId: string, playerName: string) => void;
  readonly setGameCategory: (category: GameCategorySlug) => void;
  readonly selectGame: (gameId: GameId | null) => void;
  readonly toggleExpansion: (expansionId: string) => void;
  readonly chooseColor: (colorId: string) => void;
  readonly toggleReady: (ready?: boolean) => void;
  readonly startGame: (seed?: number) => void;
  readonly resetToLobby: () => void;
  readonly sendAction: (action: AnyGameAction) => void;
  readonly leaveRoom: () => void;
}

export function useGameSocket(
  enabled: boolean,
  serverUrl = DEFAULT_SERVER_URL
): UseGameSocketResult {
  const socketRef = useRef<Socket<
    ServerToClientEvents,
    ClientToServerEvents
  > | null>(null);

  const activeSessionRef = useRef<{
    roomId: string | null;
    playerName: string;
  }>({
    roomId: null,
    playerName: localStorage.getItem('ttr_last_player_name') ?? 'Player',
  });

  const [connected, setConnected] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);
  const [pendingAction, setPendingAction] = useState(false);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [category, setCategory] = useState<GameCategorySlug | null>('board');
  const [selectedGameId, setSelectedGameId] = useState<GameId>('ttr');
  const [configuredGameId, setConfiguredGameId] = useState<GameId | null>(null);
  const [selectedExpansions, setSelectedExpansions] = useState<
    readonly string[]
  >([]);
  const [playerSettings, setPlayerSettings] = useState<
    Readonly<Record<string, PlayerLobbySettings>>
  >({});
  const [playerColors, setPlayerColors] = useState<
    Readonly<Record<string, string>>
  >({});
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [roomStatus, setRoomStatus] = useState<RoomStatus | null>(null);
  const [hostPlayerId, setHostPlayerId] = useState<string | null>(null);
  const [lobbyPlayers, setLobbyPlayers] = useState<
    readonly RoomPlayerSummary[]
  >([]);
  const [playerNames, setPlayerNames] = useState<
    Readonly<Record<string, string>>
  >({});
  const [sanitizedView, setSanitizedView] =
    useState<AnySanitizedGameState | null>(null);
  const [finalScores, setFinalScores] = useState<Readonly<
    Record<string, number>
  > | null>(null);
  const [finalStandings, setFinalStandings] = useState<
    readonly PlayerFinalStanding[] | null
  >(null);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const [toasts, setToasts] = useState<readonly ToastMessage[]>([]);

  const pushToast = useCallback(
    (text: string, variant: 'error' | 'info' | 'success' = 'error') => {
      const id = Date.now() + Math.random();
      setToasts((prev) => [...prev, { id, text, variant }]);
      window.setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 4500);
    },
    []
  );

  const dismissToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  useEffect(() => {
    if (!enabled) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      setConnected(false);
      setReconnecting(false);
      return;
    }

    const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io(
      serverUrl,
      {
        autoConnect: true,
        transports: ['websocket', 'polling'],
        withCredentials: true,
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 500,
        reconnectionDelayMax: 3000,
      }
    );
    socketRef.current = socket;

    socket.on('connect', () => {
      setConnected(true);
      setReconnecting(false);

      const targetRoom = activeSessionRef.current.roomId;
      if (targetRoom) {
        const storedToken =
          localStorage.getItem(`ttr_session_${targetRoom}`) ?? undefined;
        if (storedToken) {
          socket.emit(
            'join_room',
            {
              roomId: targetRoom,
              playerName: activeSessionRef.current.playerName,
              sessionToken: storedToken,
            },
            (res) => {
              if (res.ok && res.sessionToken) {
                const resolvedRoom = res.roomId ?? targetRoom;
                localStorage.setItem(
                  `ttr_session_${resolvedRoom}`,
                  res.sessionToken
                );
                setRoomId(resolvedRoom);
                if (res.playerId) {
                  setPlayerId(res.playerId);
                }
                if (res.selectedGameId) {
                  setSelectedGameId(res.selectedGameId);
                }
                if (res.configuredGameId !== undefined) {
                  setConfiguredGameId(res.configuredGameId);
                }
                if (res.category !== undefined) {
                  setCategory(res.category);
                }
              }
            }
          );
        }
      }
    });

    socket.on('disconnect', () => {
      setConnected(false);
      setPendingAction(false);
      if (activeSessionRef.current.roomId) {
        setReconnecting(true);
      }
    });

    socket.on('room_updated', (payload) => {
      setRoomId(payload.roomId);
      activeSessionRef.current.roomId = payload.roomId;
      setCategory(payload.category);
      setSelectedGameId(payload.selectedGameId);
      setConfiguredGameId(payload.configuredGameId);
      setSelectedExpansions(payload.selectedExpansions);
      setPlayerSettings(payload.playerSettings);
      setPlayerColors(payload.playerColors);
      setRoomStatus(payload.status);
      setHostPlayerId(payload.hostPlayerId);
      setLobbyPlayers(payload.players);
      const nameMap: Record<string, string> = {};
      for (const p of payload.players) {
        nameMap[p.playerId] = p.name;
      }
      setPlayerNames(nameMap);
      if (payload.status === 'LOBBY') {
        setSanitizedView(null);
        setFinalScores(null);
        setFinalStandings(null);
      }
    });

    socket.on('state_sync', (payload) => {
      setPendingAction(false);
      setRoomId(payload.roomId);
      activeSessionRef.current.roomId = payload.roomId;
      setSelectedGameId(payload.selectedGameId);
      setSelectedExpansions(payload.selectedExpansions);
      setPlayerColors(payload.playerColors);
      setRoomStatus(payload.status);
      setSanitizedView(payload.view);
      setPlayerNames(payload.playerNames);
      setFinalScores(payload.finalScores ?? null);
      setFinalStandings(payload.finalStandings ?? null);
    });

    socket.on('action_error', ({ message }) => {
      setPendingAction(false);
      setErrorBanner(message);
      pushToast(message, 'error');
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [enabled, serverUrl, pushToast]);

  const createRoom = useCallback(
    (playerName: string, initialGameId: GameId | null = null) => {
      const socket = socketRef.current;
      if (!socket) {
        const msg = 'Socket is not connected to multiplayer server.';
        setErrorBanner(msg);
        pushToast(msg, 'error');
        return;
      }
      const cleanName = playerName.trim() || 'Player 1';
      localStorage.setItem('ttr_last_player_name', cleanName);
      activeSessionRef.current.playerName = cleanName;
      setErrorBanner(null);

      socket.emit(
        'create_room',
        { playerName: cleanName, selectedGameId: initialGameId },
        (res) => {
          if (res.ok && res.roomId && res.sessionToken) {
            localStorage.setItem(`ttr_session_${res.roomId}`, res.sessionToken);
            activeSessionRef.current.roomId = res.roomId;
            setRoomId(res.roomId);
            setPlayerId(res.playerId ?? 'p1');
            if (res.selectedGameId) {
              setSelectedGameId(res.selectedGameId);
            }
            if (res.configuredGameId !== undefined) {
              setConfiguredGameId(res.configuredGameId);
            }
            if (res.category !== undefined) {
              setCategory(res.category);
            }
            window.history.replaceState(
              {},
              '',
              `/room/${encodeURIComponent(res.roomId)}`
            );
            pushToast(`Room ${res.roomId} created!`, 'success');
          } else {
            const msg = res.error ?? 'Failed to create room.';
            setErrorBanner(msg);
            pushToast(msg, 'error');
          }
        }
      );
    },
    [pushToast]
  );

  const joinRoom = useCallback(
    (targetRoomId: string, playerName: string) => {
      const socket = socketRef.current;
      const normalizedCode = targetRoomId.trim().toUpperCase();
      if (!normalizedCode) {
        return;
      }
      const cleanName =
        playerName.trim() ||
        localStorage.getItem('ttr_last_player_name') ||
        'Player';
      localStorage.setItem('ttr_last_player_name', cleanName);
      activeSessionRef.current.playerName = cleanName;
      activeSessionRef.current.roomId = normalizedCode;

      if (!socket || !socket.connected) {
        socket?.once('connect', () => {
          joinRoom(normalizedCode, cleanName);
        });
        return;
      }

      const storedToken =
        localStorage.getItem(`ttr_session_${normalizedCode}`) ?? undefined;

      setErrorBanner(null);
      socket.emit(
        'join_room',
        {
          roomId: normalizedCode,
          playerName: cleanName,
          ...(storedToken !== undefined ? { sessionToken: storedToken } : {}),
        },
        (res) => {
          if (res.ok && res.sessionToken) {
            const finalRoomId = res.roomId ?? normalizedCode;
            localStorage.setItem(
              `ttr_session_${finalRoomId}`,
              res.sessionToken
            );
            activeSessionRef.current.roomId = finalRoomId;
            setRoomId(finalRoomId);
            if (res.playerId) {
              setPlayerId(res.playerId);
            }
            if (res.selectedGameId) {
              setSelectedGameId(res.selectedGameId);
            }
            if (res.configuredGameId !== undefined) {
              setConfiguredGameId(res.configuredGameId);
            }
            if (res.category !== undefined) {
              setCategory(res.category);
            }
            window.history.replaceState(
              {},
              '',
              `/room/${encodeURIComponent(finalRoomId)}`
            );
          } else {
            const msg = res.error ?? 'Failed to join room.';
            setErrorBanner(msg);
            pushToast(msg, 'error');
          }
        }
      );
    },
    [pushToast]
  );

  const setGameCategory = useCallback(
    (nextCategory: GameCategorySlug) => {
      const socket = socketRef.current;
      if (!socket || !roomId) {
        return;
      }
      setErrorBanner(null);
      socket.emit('set_game_category', { roomId, category: nextCategory });
    },
    [roomId]
  );

  const selectGame = useCallback(
    (gameId: GameId | null) => {
      const socket = socketRef.current;
      if (!socket || !roomId) {
        return;
      }
      setErrorBanner(null);
      socket.emit('select_game', { roomId, gameId });
    },
    [roomId]
  );

  const toggleExpansion = useCallback(
    (expansionId: string) => {
      const socket = socketRef.current;
      if (!socket || !roomId) {
        return;
      }
      setErrorBanner(null);
      socket.emit('toggle_expansion', { roomId, expansionId });
    },
    [roomId]
  );

  const chooseColor = useCallback(
    (colorId: string) => {
      const socket = socketRef.current;
      if (!socket || !roomId) {
        return;
      }
      setErrorBanner(null);
      socket.emit('choose_color', { roomId, colorId });
    },
    [roomId]
  );

  const toggleReady = useCallback(
    (ready?: boolean) => {
      const socket = socketRef.current;
      if (!socket || !roomId) {
        return;
      }
      setErrorBanner(null);
      socket.emit('toggle_ready', {
        roomId,
        ...(ready !== undefined ? { ready } : {}),
      });
    },
    [roomId]
  );

  const startGame = useCallback(
    (seed?: number) => {
      const socket = socketRef.current;
      if (!socket || !roomId) {
        return;
      }
      setErrorBanner(null);
      socket.emit('start_game', {
        roomId,
        ...(seed !== undefined ? { seed } : {}),
      });
    },
    [roomId]
  );

  const resetToLobby = useCallback(() => {
    const socket = socketRef.current;
    if (!socket || !roomId) {
      return;
    }
    setErrorBanner(null);
    socket.emit('reset_to_lobby', { roomId });
  }, [roomId]);

  const sendAction = useCallback(
    (action: AnyGameAction) => {
      const socket = socketRef.current;
      if (!socket || !roomId) {
        return;
      }
      setErrorBanner(null);
      setPendingAction(true);
      socket.emit('dispatch_action', { roomId, action }, (res) => {
        if (!res.ok) {
          setPendingAction(false);
        }
      });
    },
    [roomId]
  );

  const leaveRoom = useCallback(() => {
    activeSessionRef.current.roomId = null;
    setRoomId(null);
    setPlayerId(null);
    setRoomStatus(null);
    setConfiguredGameId(null);
    setSelectedExpansions([]);
    setPlayerSettings({});
    setPlayerColors({});
    setSanitizedView(null);
    setFinalScores(null);
    setFinalStandings(null);
    setLobbyPlayers([]);
    setErrorBanner(null);
    setPendingAction(false);
    window.history.replaceState({}, '', '/');
  }, []);

  const clearError = useCallback(() => {
    setErrorBanner(null);
  }, []);

  return {
    connected,
    reconnecting,
    pendingAction,
    roomId,
    category,
    selectedGameId,
    configuredGameId,
    selectedExpansions,
    playerSettings,
    playerColors,
    playerId,
    roomStatus,
    hostPlayerId,
    lobbyPlayers,
    playerNames,
    sanitizedView,
    finalScores,
    finalStandings,
    errorBanner,
    toasts,
    dismissToast,
    clearError,
    createRoom,
    joinRoom,
    setGameCategory,
    selectGame,
    toggleExpansion,
    chooseColor,
    toggleReady,
    startGame,
    resetToLobby,
    sendAction,
    leaveRoom,
  };
}
