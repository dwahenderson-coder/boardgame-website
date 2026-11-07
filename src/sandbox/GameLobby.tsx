import React, { useMemo, useState } from 'react';
import {
  PlayerLobbySettings,
  RoomPlayerSummary,
} from '../network/socketTypes.js';
import {
  BOARD_GAMES_CATALOG,
  CARD_GAMES_CATALOG,
  GAME_CATALOG_BY_ID,
  getGameColorById,
} from '../registry/catalog.js';
import {
  GameCategorySlug,
  GameDefinition,
  GameId,
  getEffectivePlayerBounds,
} from '../types/game.js';

export interface GameLobbyProps {
  readonly roomId: string;
  readonly playerId: string | null;
  readonly hostPlayerId: string | null;
  readonly category: GameCategorySlug | null;
  readonly selectedGameId: GameId;
  readonly configuredGameId: GameId | null;
  readonly selectedExpansions: readonly string[];
  readonly playerSettings: Readonly<Record<string, PlayerLobbySettings>>;
  readonly players: readonly RoomPlayerSummary[];
  readonly errorBanner: string | null;
  readonly onSetCategory: (category: GameCategorySlug) => void;
  readonly onSelectGame: (gameId: GameId | null) => void;
  readonly onToggleExpansion: (expansionId: string) => void;
  readonly onChooseColor: (colorId: string) => void;
  readonly onToggleReady: (ready?: boolean) => void;
  readonly onStartGame: () => void;
  readonly onLeaveRoom: () => void;
}

export const GameLobby: React.FC<GameLobbyProps> = ({
  roomId,
  playerId,
  hostPlayerId,
  category,
  selectedGameId,
  configuredGameId,
  selectedExpansions,
  playerSettings,
  players,
  errorBanner,
  onSetCategory,
  onSelectGame,
  onToggleExpansion,
  onChooseColor,
  onToggleReady,
  onStartGame,
  onLeaveRoom,
}) => {
  const [copiedLink, setCopiedLink] = useState(false);
  const [localCategoryTab, setLocalCategoryTab] = useState<GameCategorySlug>(
    category ?? 'board'
  );

  const isHost = Boolean(playerId && playerId === hostPlayerId);
  const activeCategory: GameCategorySlug = category ?? localCategoryTab;

  const hostPlayerName = useMemo(() => {
    const found = players.find((p) => p.playerId === hostPlayerId);
    return found?.name ?? hostPlayerId ?? 'Host';
  }, [players, hostPlayerId]);

  const connectedPlayers = useMemo(
    () => players.filter((p) => p.connected),
    [players]
  );

  const stagedGame: GameDefinition | null = configuredGameId
    ? GAME_CATALOG_BY_ID[configuredGameId]
    : null;

  const effectiveBounds = useMemo(() => {
    if (!stagedGame) {
      return { minPlayers: 2, maxPlayers: 6 };
    }
    return getEffectivePlayerBounds(stagedGame, selectedExpansions);
  }, [stagedGame, selectedExpansions]);

  // Map colorId -> owner RoomPlayerSummary for uniqueness visualization
  const claimedColorOwners = useMemo(() => {
    const map = new Map<string, RoomPlayerSummary>();
    for (const p of connectedPlayers) {
      const colorId = playerSettings[p.playerId]?.colorId ?? p.colorId;
      if (colorId) {
        map.set(colorId, p);
      }
    }
    return map;
  }, [connectedPlayers, playerSettings]);

  const mySettings: PlayerLobbySettings = useMemo(() => {
    if (!playerId) {
      return { colorId: null, ready: false };
    }
    const fromRecord = playerSettings[playerId];
    if (fromRecord) {
      return fromRecord;
    }
    const summary = players.find((p) => p.playerId === playerId);
    return {
      colorId: summary?.colorId ?? null,
      ready: summary?.ready ?? false,
    };
  }, [playerId, playerSettings, players]);

  // Evaluate Start Game readiness and specific blocker reason
  const startValidation = useMemo((): {
    canStart: boolean;
    reason: string;
  } => {
    if (!stagedGame) {
      return {
        canStart: false,
        reason: 'Select a game from the catalog first.',
      };
    }

    const count = connectedPlayers.length;
    if (count < effectiveBounds.minPlayers) {
      return {
        canStart: false,
        reason: `Requires at least ${effectiveBounds.minPlayers} players (currently ${count} connected).`,
      };
    }
    if (count > effectiveBounds.maxPlayers) {
      return {
        canStart: false,
        reason: `Supports at most ${effectiveBounds.maxPlayers} players (currently ${count} connected).`,
      };
    }

    for (const p of connectedPlayers) {
      const pColor = playerSettings[p.playerId]?.colorId ?? p.colorId;
      if (!pColor) {
        return {
          canStart: false,
          reason: `Waiting for ${p.name} to pick a color.`,
        };
      }
    }

    for (const p of connectedPlayers) {
      const pReady = playerSettings[p.playerId]?.ready ?? p.ready;
      if (!pReady) {
        return {
          canStart: false,
          reason: `Waiting for ${p.name} to mark Ready.`,
        };
      }
    }

    return {
      canStart: true,
      reason: `All ${count} players ready — Launch ${stagedGame.name}!`,
    };
  }, [stagedGame, connectedPlayers, effectiveBounds, playerSettings]);

  const handleCopyInviteLink = () => {
    const inviteUrl = `${window.location.origin}/join/${roomId}`;
    navigator.clipboard.writeText(inviteUrl).catch(() => {});
    setCopiedLink(true);
    window.setTimeout(() => setCopiedLink(false), 2200);
  };

  const handleCategorySwitch = (nextCat: GameCategorySlug) => {
    setLocalCategoryTab(nextCat);
    if (isHost) {
      onSetCategory(nextCat);
    }
  };

  const gamesForActiveCategory =
    activeCategory === 'board' ? BOARD_GAMES_CATALOG : CARD_GAMES_CATALOG;

  return (
    <div className="w-full max-w-4xl bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl p-6 text-xs my-auto">
      {/* ===================================================================
          TOP HEADER BAR & STEP INDICATOR
         =================================================================== */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40">
              Room {roomId}
            </span>
            <span className="text-[10px] font-semibold text-slate-400">
              • {connectedPlayers.length} Connected
            </span>
          </div>
          <h2 className="text-xl font-black text-slate-100 mt-1">
            {stagedGame
              ? `Step 2: Configure ${stagedGame.name}`
              : 'Step 1: Select a Game'}
          </h2>
        </div>

        {/* Multi-step progress pills */}
        <div className="flex items-center gap-2">
          <span
            className={`px-2.5 py-1 rounded-lg font-bold text-[11px] border ${
              !stagedGame
                ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300'
                : 'bg-slate-950 border-slate-800 text-emerald-400'
            }`}
          >
            {stagedGame ? '✓ 1. Game Selected' : '1. Choose Game'}
          </span>
          <span className="text-slate-600">→</span>
          <span
            className={`px-2.5 py-1 rounded-lg font-bold text-[11px] border ${
              stagedGame
                ? 'bg-amber-500/20 border-amber-400 text-amber-200'
                : 'bg-slate-950 border-slate-800 text-slate-500'
            }`}
          >
            2. Colors, Expansions & Ready
          </span>
          <span className="text-slate-600">→</span>
          <span className="px-2.5 py-1 rounded-lg font-bold text-[11px] border bg-slate-950 border-slate-800 text-slate-500">
            3. Play
          </span>

          <button
            type="button"
            onClick={onLeaveRoom}
            className="ml-2 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-rose-950 hover:text-rose-200 text-slate-300 font-semibold transition border border-slate-700"
          >
            Leave Lobby
          </button>
        </div>
      </div>

      {/* Error Banner */}
      {errorBanner && (
        <div className="mt-3 p-3 rounded-xl bg-rose-950/90 border border-rose-500/70 text-rose-200 font-medium flex items-center justify-between">
          <span>⚠️ {errorBanner}</span>
        </div>
      )}

      {/* Shareable Direct Invite Link Bar */}
      <div className="mt-4 p-3 rounded-xl bg-slate-950/90 border border-slate-800 flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-slate-400 text-[11px] font-medium">
            Invite Friends with Room Code{' '}
            <strong className="font-mono text-amber-400">{roomId}</strong> or
            Direct Link:
          </div>
          <div className="font-mono text-xs text-emerald-300 truncate mt-0.5">
            {`${window.location.origin}/join/${roomId}`}
          </div>
        </div>
        <button
          type="button"
          onClick={handleCopyInviteLink}
          className={`px-3.5 py-2 rounded-xl font-bold shrink-0 border transition shadow ${
            copiedLink
              ? 'bg-emerald-500 text-slate-950 border-emerald-400'
              : 'bg-slate-800 hover:bg-slate-700 text-slate-100 border-slate-700'
          }`}
        >
          {copiedLink ? '✓ Invite Link Copied!' : '📋 Copy Invite Link'}
        </button>
      </div>

      {/* ===================================================================
          STEP 1: CATEGORY FILTER & GAME SELECTION GRID
         =================================================================== */}
      {!stagedGame ? (
        <div className="mt-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            {/* Visual Category Tabs: Board Games vs Card Games */}
            <div className="inline-flex rounded-xl bg-slate-950 p-1 border border-slate-800">
              <button
                type="button"
                onClick={() => handleCategorySwitch('board')}
                className={`px-4 py-2 rounded-lg font-black text-xs transition flex items-center gap-2 ${
                  activeCategory === 'board'
                    ? 'bg-emerald-500 text-slate-950 shadow'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <span>🎲 Board Games</span>
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                    activeCategory === 'board'
                      ? 'bg-slate-950/20 text-slate-950'
                      : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {BOARD_GAMES_CATALOG.length}
                </span>
              </button>
              <button
                type="button"
                onClick={() => handleCategorySwitch('card')}
                className={`px-4 py-2 rounded-lg font-black text-xs transition flex items-center gap-2 ${
                  activeCategory === 'card'
                    ? 'bg-amber-400 text-slate-950 shadow'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <span>🃏 Card Games</span>
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                    activeCategory === 'card'
                      ? 'bg-slate-950/20 text-slate-950'
                      : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {CARD_GAMES_CATALOG.length}
                </span>
              </button>
            </div>

            <span className="text-[11px] text-slate-400">
              {isHost
                ? '👑 Host Controls: Click any game card below to configure rules & colors'
                : `🔒 Guest View: Waiting for Host (${hostPlayerName}) to select a game`}
            </span>
          </div>

          {/* Responsive Game Card Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {gamesForActiveCategory.map((game) => {
              const isHighlighted = selectedGameId === game.id;
              return (
                <div
                  key={game.id}
                  onClick={() => {
                    if (isHost) {
                      onSelectGame(game.id);
                    }
                  }}
                  className={`p-4 rounded-2xl border-2 transition flex flex-col justify-between ${
                    isHighlighted
                      ? 'bg-slate-950/90 border-emerald-400/80 shadow-[0_0_20px_rgba(16,185,129,0.15)]'
                      : 'bg-slate-950/70 border-slate-800'
                  } ${
                    isHost
                      ? 'cursor-pointer hover:border-emerald-400 hover:bg-slate-950'
                      : 'cursor-default'
                  }`}
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <span className="text-2xl">{game.icon}</span>
                        <div>
                          <h3 className="text-base font-black text-slate-100">
                            {game.name}
                          </h3>
                          <div className="text-[11px] text-slate-400 font-medium">
                            {game.subtitle}
                          </div>
                        </div>
                      </div>
                      {isHost ? (
                        <span className="px-2.5 py-1 rounded-lg bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 font-bold text-[10px] uppercase shrink-0">
                          Configure →
                        </span>
                      ) : (
                        isHighlighted && (
                          <span className="px-2 py-0.5 rounded bg-amber-500/20 border border-amber-500/40 text-amber-300 font-bold text-[10px]">
                            Host Viewing
                          </span>
                        )
                      )}
                    </div>

                    <p className="mt-2.5 text-slate-300 text-[11px] leading-relaxed">
                      {game.description}
                    </p>
                  </div>

                  <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-700 text-amber-300 font-semibold text-[10px]">
                        👥 {game.minPlayers}–{game.maxPlayers} Players
                      </span>
                      <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-700 text-slate-300 font-semibold text-[10px]">
                        ⏱ ~{game.estimatedMinutes}m
                      </span>
                      {game.expansions.length > 0 && (
                        <span className="px-2 py-0.5 rounded bg-purple-500/15 border border-purple-500/40 text-purple-300 font-semibold text-[10px]">
                          +{game.expansions.length} Expansion
                          {game.expansions.length === 1 ? '' : 's'}
                        </span>
                      )}
                    </div>

                    {/* Available player color swatches preview */}
                    <div className="flex items-center gap-1">
                      {game.availableColors.map((c) => (
                        <span
                          key={c.id}
                          title={c.name}
                          className="w-3.5 h-3.5 rounded-full border"
                          style={{
                            backgroundColor: c.hex,
                            borderColor: c.strokeHex,
                          }}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Connected Players Preview Strip in Step 1 */}
          <div className="pt-3 border-t border-slate-800 flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-slate-400 font-semibold">
                Seated in Lobby ({connectedPlayers.length}):
              </span>
              {players.map((p) => (
                <span
                  key={p.playerId}
                  className="px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 font-semibold flex items-center gap-1.5"
                >
                  <span
                    className={`w-2 h-2 rounded-full ${
                      p.connected ? 'bg-emerald-400' : 'bg-amber-400'
                    }`}
                  />
                  <span>{p.name}</span>
                  {p.isHost && <span className="text-amber-300">👑</span>}
                </span>
              ))}
            </div>
          </div>
        </div>
      ) : (
        /* ===================================================================
           STEP 2: CONFIGURATION & STAGING PANEL
           =================================================================== */
        <div className="mt-5 space-y-5">
          {/* 2A. Game Summary Banner */}
          <div className="p-4 rounded-2xl bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 border-2 border-emerald-500/50 flex flex-wrap items-center justify-between gap-4 shadow-lg">
            <div className="flex items-start gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 border border-emerald-400/50 flex items-center justify-center text-2xl shrink-0">
                {stagedGame.icon}
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-lg font-black text-slate-100">
                    {stagedGame.name}
                  </h3>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 font-bold text-[10px] uppercase">
                    {stagedGame.category === 'board'
                      ? '🎲 Board Game'
                      : '🃏 Card Game'}
                  </span>
                  <span className="px-2 py-0.5 rounded bg-amber-500/20 border border-amber-500/40 text-amber-300 font-bold text-[10px]">
                    👥 {effectiveBounds.minPlayers}–{effectiveBounds.maxPlayers}{' '}
                    Players
                  </span>
                  <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-semibold text-[10px]">
                    ⏱ ~{stagedGame.estimatedMinutes} min
                  </span>
                </div>
                <p className="text-slate-300 text-[11px] mt-1 max-w-2xl">
                  {stagedGame.description}
                </p>
              </div>
            </div>

            {isHost && (
              <button
                type="button"
                onClick={() => onSelectGame(null)}
                className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold border border-slate-600 transition shrink-0"
              >
                ← Change Game
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* 2B. Expansions & Modules Section */}
            <div className="p-4 rounded-2xl bg-slate-950/90 border border-slate-800 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2.5">
                  <span className="font-black uppercase tracking-wider text-purple-300 text-[11px]">
                    🧩 Optional Expansions & Modules
                  </span>
                  <span className="text-[10px] text-slate-400">
                    {isHost ? 'Host Toggles' : 'Synced with Host'}
                  </span>
                </div>

                {stagedGame.expansions.length === 0 ? (
                  <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 text-slate-400 text-center">
                    Standard base rules only for this title.
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {stagedGame.expansions.map((exp) => {
                      const enabled = selectedExpansions.includes(exp.id);
                      return (
                        <div
                          key={exp.id}
                          onClick={() => {
                            if (isHost) {
                              onToggleExpansion(exp.id);
                            }
                          }}
                          title={exp.description}
                          className={`p-3 rounded-xl border transition flex items-start justify-between gap-3 ${
                            enabled
                              ? 'bg-purple-950/40 border-purple-400/80 shadow'
                              : 'bg-slate-900/70 border-slate-800'
                          } ${
                            isHost
                              ? 'cursor-pointer hover:border-purple-400/60'
                              : 'cursor-default'
                          }`}
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-bold text-slate-100 text-xs">
                                {exp.name}
                              </span>
                              {(exp.minPlayersOverride !== undefined ||
                                exp.maxPlayersOverride !== undefined) && (
                                <span className="px-1.5 py-0.2 rounded bg-amber-500/20 border border-amber-500/40 text-amber-300 text-[9px] font-bold">
                                  Up to {exp.maxPlayersOverride ?? stagedGame.maxPlayers}P
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">
                              {exp.description}
                            </p>
                          </div>

                          {/* Toggle Switch / Status Badge */}
                          <span
                            className={`px-2.5 py-1 rounded-full font-black text-[10px] uppercase shrink-0 border ${
                              enabled
                                ? 'bg-purple-500 text-slate-950 border-purple-300'
                                : 'bg-slate-800 text-slate-400 border-slate-700'
                            }`}
                          >
                            {enabled ? '✓ Enabled' : 'Disabled'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="mt-3 pt-2.5 border-t border-slate-800/80 text-[11px] text-slate-400 flex items-center justify-between">
                <span>Active Expansions:</span>
                <strong className="text-purple-300">
                  {selectedExpansions.length === 0
                    ? 'Base Game Only'
                    : `${selectedExpansions.length} Enabled`}
                </strong>
              </div>
            </div>

            {/* 2C. Player Color Selection Bar */}
            <div className="p-4 rounded-2xl bg-slate-950/90 border border-slate-800 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2.5">
                  <span className="font-black uppercase tracking-wider text-amber-300 text-[11px]">
                    🎨 Claim Your Player Color
                  </span>
                  <span className="text-[10px] text-slate-400">
                    {mySettings.colorId
                      ? `Selected: ${
                          getGameColorById(stagedGame.id, mySettings.colorId)
                            ?.name ?? mySettings.colorId
                        }`
                      : 'Click an open swatch below'}
                  </span>
                </div>

                <div className="grid grid-cols-3 sm:grid-cols-3 gap-2.5">
                  {stagedGame.availableColors.map((color) => {
                    const owner = claimedColorOwners.get(color.id);
                    const isMine = owner?.playerId === playerId;
                    const isTakenByOther = Boolean(owner && !isMine);

                    return (
                      <button
                        key={color.id}
                        type="button"
                        disabled={isTakenByOther}
                        onClick={() => onChooseColor(color.id)}
                        className={`relative p-2.5 rounded-xl border-2 transition flex items-center gap-2.5 text-left ${
                          isMine
                            ? 'bg-slate-900 border-amber-400 ring-2 ring-amber-400/40 shadow-md'
                            : isTakenByOther
                            ? 'bg-slate-900/40 border-slate-800/70 opacity-50 cursor-not-allowed'
                            : 'bg-slate-900/90 border-slate-700 hover:border-slate-500 cursor-pointer'
                        }`}
                        title={
                          isTakenByOther
                            ? `${color.name} is already claimed by ${owner?.name}`
                            : `Claim ${color.name}`
                        }
                      >
                        {/* Circular Color Swatch */}
                        <span
                          className="w-7 h-7 rounded-full border-2 flex items-center justify-center font-black text-[10px] shrink-0 shadow"
                          style={{
                            backgroundColor: color.hex,
                            borderColor: color.strokeHex,
                            color:
                              color.id === 'white' || color.id === 'yellow'
                                ? '#0f172a'
                                : '#ffffff',
                          }}
                        >
                          {owner
                            ? owner.name.slice(0, 2).toUpperCase()
                            : ''}
                        </span>

                        <div className="min-w-0">
                          <div className="font-bold text-slate-100 text-xs truncate">
                            {color.name}
                          </div>
                          <div className="text-[10px] truncate">
                            {isMine ? (
                              <span className="text-emerald-400 font-bold">
                                ✓ Yours
                              </span>
                            ) : isTakenByOther ? (
                              <span className="text-slate-400">
                                {owner?.name}
                              </span>
                            ) : (
                              <span className="text-slate-400">Available</span>
                            )}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="mt-3 pt-2.5 border-t border-slate-800/80 text-[11px] text-slate-400 flex items-center justify-between">
                <span>
                  Each player must claim a unique color before readying up.
                </span>
              </div>
            </div>
          </div>

          {/* 2D. Roster & Readiness Table */}
          <div className="p-4 rounded-2xl bg-slate-950/90 border border-slate-800">
            <div className="flex items-center justify-between mb-3">
              <span className="font-black uppercase tracking-wider text-slate-200 text-[11px]">
                👥 Player Roster & Readiness ({connectedPlayers.length} /{' '}
                {effectiveBounds.maxPlayers} Players)
              </span>
              <span className="text-[11px] text-slate-400">
                Required: {effectiveBounds.minPlayers}–
                {effectiveBounds.maxPlayers} Players
              </span>
            </div>

            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {players.map((p) => {
                const pColorId =
                  playerSettings[p.playerId]?.colorId ?? p.colorId;
                const pReady = playerSettings[p.playerId]?.ready ?? p.ready;
                const colorDef = getGameColorById(stagedGame.id, pColorId);
                const isMe = p.playerId === playerId;

                return (
                  <div
                    key={p.playerId}
                    className={`px-3.5 py-2.5 rounded-xl border flex flex-wrap items-center justify-between gap-2 ${
                      pReady
                        ? 'bg-emerald-950/25 border-emerald-500/50'
                        : 'bg-slate-900/90 border-slate-800'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {/* Online Connection Dot */}
                      <span
                        className={`w-2.5 h-2.5 rounded-full ${
                          p.connected
                            ? 'bg-emerald-400 shadow-[0_0_8px_#34d399]'
                            : 'bg-amber-400 animate-pulse'
                        }`}
                      />

                      {/* Claimed Color Swatch */}
                      {colorDef ? (
                        <span
                          className="w-5 h-5 rounded-full border shrink-0 shadow"
                          style={{
                            backgroundColor: colorDef.hex,
                            borderColor: colorDef.strokeHex,
                          }}
                          title={`Color: ${colorDef.name}`}
                        />
                      ) : (
                        <span
                          className="w-5 h-5 rounded-full border border-dashed border-slate-600 bg-slate-950 shrink-0"
                          title="No color selected yet"
                        />
                      )}

                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-slate-100">
                            {p.name}
                          </span>
                          <span className="font-mono text-slate-400 text-xs">
                            ({p.playerId})
                          </span>
                          {isMe && (
                            <span className="px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 text-[10px] font-bold">
                              YOU
                            </span>
                          )}
                          {p.isHost && (
                            <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-bold uppercase">
                              👑 Host
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {colorDef
                            ? `Playing as ${colorDef.name}`
                            : 'Selecting color...'}
                        </div>
                      </div>
                    </div>

                    {/* Ready Status Pill */}
                    <div className="flex items-center gap-2">
                      {!p.connected ? (
                        <span className="px-2.5 py-1 rounded-lg bg-amber-500/20 text-amber-300 font-mono text-[10px] font-bold">
                          Reconnecting...
                        </span>
                      ) : pReady ? (
                        <span className="px-3 py-1 rounded-lg bg-emerald-500 text-slate-950 font-black text-[11px] uppercase shadow">
                          ✓ Ready
                        </span>
                      ) : (
                        <span className="px-3 py-1 rounded-lg bg-slate-800 text-slate-400 font-semibold text-[11px]">
                          Not Ready
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* 2E. Bottom Action Bar: Ready Up + Host Start Game */}
            <div className="mt-4 pt-4 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3">
              {/* Ready Up Button for Local Player */}
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  disabled={!mySettings.colorId}
                  onClick={() => onToggleReady(!mySettings.ready)}
                  title={
                    !mySettings.colorId
                      ? 'Pick a player color above to unlock Ready Up'
                      : mySettings.ready
                      ? 'Click to unmark Ready'
                      : 'Mark yourself Ready to start'
                  }
                  className={`px-5 py-2.5 rounded-xl font-black text-xs transition shadow-lg ${
                    !mySettings.colorId
                      ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                      : mySettings.ready
                      ? 'bg-amber-500 hover:bg-amber-400 text-slate-950'
                      : 'bg-cyan-500 hover:bg-cyan-400 text-slate-950'
                  }`}
                >
                  {!mySettings.colorId
                    ? '🎨 Pick a Color First'
                    : mySettings.ready
                    ? '✓ Ready! (Click to Cancel)'
                    : '⚡ Ready Up'}
                </button>

                <span className="text-[11px] text-slate-300 font-medium">
                  {startValidation.reason}
                </span>
              </div>

              {/* Start Game Button for Host */}
              {isHost ? (
                <button
                  type="button"
                  disabled={!startValidation.canStart}
                  onClick={onStartGame}
                  title={startValidation.reason}
                  className="px-6 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:bg-slate-800 disabled:text-slate-500 disabled:border disabled:border-slate-700 disabled:cursor-not-allowed text-slate-950 font-black text-xs transition shadow-lg"
                >
                  ▶ Start {stagedGame.name}
                </button>
              ) : (
                <span className="px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-800 text-amber-300 font-semibold text-[11px]">
                  Waiting for Host ({hostPlayerName}) to launch match...
                </span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

