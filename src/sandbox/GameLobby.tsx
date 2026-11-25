import React, { useMemo, useState } from 'react';
import {
  ALL_BASE_KINGDOM_CARD_IDS,
  DOMINION_CARDS,
  DOMINION_PRESET_GAMES,
  getAvailableDominionKingdomPool,
} from '../games/dominion/index.js';
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
  isExpansionCompatibleWithMap,
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
  const [stageFilter, setStageFilter] = useState<
    'ALL' | 'POLISHED' | 'PLAYTEST'
  >('ALL');

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

    if (
      stagedGame.id === 'dominion' &&
      selectedExpansions.includes('mode:custom')
    ) {
      const selectedCardCount = selectedExpansions.filter((e) =>
        e.startsWith('card:')
      ).length;
      if (selectedCardCount !== 10) {
        return {
          canStart: false,
          reason: `Dominion Custom Kingdom requires 10 cards selected (${selectedCardCount}/10 selected).`,
        };
      }
    }

    return {
      canStart: true,
      reason: `All ${count} players ready — Launch ${stagedGame.name}!`,
    };
  }, [
    stagedGame,
    connectedPlayers,
    effectiveBounds,
    playerSettings,
    selectedExpansions,
  ]);

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

  const polishedGamesInCategory = useMemo(
    () =>
      gamesForActiveCategory.filter((g) => g.releaseStage === 'polished'),
    [gamesForActiveCategory]
  );

  const playtestGamesInCategory = useMemo(
    () =>
      gamesForActiveCategory.filter((g) => g.releaseStage !== 'polished'),
    [gamesForActiveCategory]
  );

  const renderGameCard = (game: GameDefinition) => {
    const isHighlighted = selectedGameId === game.id;
    const isPlaytest = game.releaseStage !== 'polished';

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
                <div className="flex items-center gap-1.5 flex-wrap">
                  <h3 className="text-base font-black text-slate-100">
                    {game.name}
                  </h3>
                  {isPlaytest ? (
                    <span className="px-2 py-0.2 rounded-full bg-cyan-500/20 border border-cyan-400/50 text-cyan-300 font-black text-[9px] uppercase tracking-wider">
                      🧪 Playtest
                    </span>
                  ) : (
                    <span className="px-2 py-0.2 rounded-full bg-emerald-500/20 border border-emerald-400/50 text-emerald-300 font-black text-[9px] uppercase tracking-wider">
                      ✨ Polished
                    </span>
                  )}
                </div>
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
  };

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

            {/* Release Stage Filter Pills: All vs Polished vs Playtest */}
            <div className="inline-flex rounded-xl bg-slate-950 p-1 border border-slate-800">
              <button
                type="button"
                onClick={() => setStageFilter('ALL')}
                className={`px-3 py-1.5 rounded-lg font-bold text-[11px] transition ${
                  stageFilter === 'ALL'
                    ? 'bg-slate-800 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                All Stages ({gamesForActiveCategory.length})
              </button>
              <button
                type="button"
                onClick={() => setStageFilter('POLISHED')}
                className={`px-3 py-1.5 rounded-lg font-bold text-[11px] transition ${
                  stageFilter === 'POLISHED'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                ✨ Polished ({polishedGamesInCategory.length})
              </button>
              <button
                type="button"
                onClick={() => setStageFilter('PLAYTEST')}
                className={`px-3 py-1.5 rounded-lg font-bold text-[11px] transition ${
                  stageFilter === 'PLAYTEST'
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                🧪 Playtest ({playtestGamesInCategory.length})
              </button>
            </div>
          </div>

          {/* 1A. Polished & Released Games Section */}
          {(stageFilter === 'ALL' || stageFilter === 'POLISHED') && (
            <div className="space-y-2">
              <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
                <span className="text-[11px] font-black uppercase tracking-wider text-emerald-300">
                  ✨ Polished & Released Games ({polishedGamesInCategory.length})
                </span>
                <span className="text-[10px] text-slate-400">
                  Production Ready
                </span>
              </div>
              {polishedGamesInCategory.length === 0 ? (
                <div className="p-3.5 rounded-xl bg-slate-950/60 border border-dashed border-slate-800 text-slate-400 text-center text-[11px]">
                  All titles in this category are currently assigned to{' '}
                  <strong className="text-cyan-300">
                    🧪 Playtesting & Under Development
                  </strong>{' '}
                  below.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  {polishedGamesInCategory.map((game) => renderGameCard(game))}
                </div>
              )}
            </div>
          )}

          {/* 1B. Playtesting & Under Development Section */}
          {(stageFilter === 'ALL' || stageFilter === 'PLAYTEST') && (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between border-b border-cyan-500/30 pb-1.5">
                <span className="text-[11px] font-black uppercase tracking-wider text-cyan-300">
                  🧪 Under Development & Playtesting ({playtestGamesInCategory.length})
                </span>
                <span className="text-[10px] text-cyan-200/80 font-semibold">
                  Active Playtest Builds
                </span>
              </div>
              {playtestGamesInCategory.length === 0 ? (
                <div className="p-3.5 rounded-xl bg-slate-950/60 border border-dashed border-slate-800 text-slate-400 text-center text-[11px]">
                  No games are currently in Playtesting for this category.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  {playtestGamesInCategory.map((game) => renderGameCard(game))}
                </div>
              )}
            </div>
          )}

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
                  {stagedGame.releaseStage !== 'polished' ? (
                    <span className="px-2 py-0.5 rounded-full bg-cyan-500/20 border border-cyan-400/50 text-cyan-300 font-black text-[10px] uppercase">
                      🧪 Playtest Build
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/50 text-emerald-300 font-black text-[10px] uppercase">
                      ✨ Polished
                    </span>
                  )}
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
            {/* 2B. Map Selection (for TTR) + Expansions & Modules Section */}
            <div className="p-4 rounded-2xl bg-slate-950/90 border border-slate-800 flex flex-col justify-between space-y-4">
              {stagedGame.id === 'ttr' ? (
                <div className="space-y-4">
                  {/* Option 1: Map Selector */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-black uppercase tracking-wider text-emerald-300 text-[11px]">
                        🗺️ Option 1: Select Map
                      </span>
                      <span className="text-[10px] text-slate-400">
                        {isHost ? 'Host Selection' : 'Synced with Host'}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {(() => {
                        const isEurope =
                          selectedExpansions.includes('europe_map');
                        return (
                          <>
                            <button
                              type="button"
                              disabled={!isHost}
                              onClick={() => {
                                if (isHost && isEurope) {
                                  onToggleExpansion('europe_map');
                                }
                              }}
                              className={`p-3 rounded-xl border-2 text-left transition flex flex-col justify-between ${
                                !isEurope
                                  ? 'bg-emerald-950/40 border-emerald-400 shadow-md'
                                  : 'bg-slate-900/70 border-slate-800 hover:border-slate-700'
                              } ${
                                isHost ? 'cursor-pointer' : 'cursor-default'
                              }`}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span className="font-black text-slate-100 text-xs">
                                  🗽 North America (Base Map)
                                </span>
                                <span
                                  className={`px-2 py-0.5 rounded-full font-black text-[9px] uppercase ${
                                    !isEurope
                                      ? 'bg-emerald-400 text-slate-950'
                                      : 'bg-slate-800 text-slate-400'
                                  }`}
                                >
                                  {!isEurope ? '✓ Active' : 'Select'}
                                </span>
                              </div>
                              <p className="text-[10px] text-slate-400 mt-1 leading-snug">
                                Classic 36-city USA &amp; Canada railway network
                                with 30 Destination Tickets and Trans America
                                Express (+10 pts).
                              </p>
                            </button>

                            <button
                              type="button"
                              disabled={!isHost}
                              onClick={() => {
                                if (isHost && !isEurope) {
                                  onToggleExpansion('europe_map');
                                }
                              }}
                              className={`p-3 rounded-xl border-2 text-left transition flex flex-col justify-between ${
                                isEurope
                                  ? 'bg-emerald-950/40 border-emerald-400 shadow-md'
                                  : 'bg-slate-900/70 border-slate-800 hover:border-slate-700'
                              } ${
                                isHost ? 'cursor-pointer' : 'cursor-default'
                              }`}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span className="font-black text-slate-100 text-xs">
                                  🏰 Europe (Ticket to Ride: Europe)
                                </span>
                                <span
                                  className={`px-2 py-0.5 rounded-full font-black text-[9px] uppercase ${
                                    isEurope
                                      ? 'bg-emerald-400 text-slate-950'
                                      : 'bg-slate-800 text-slate-400'
                                  }`}
                                >
                                  {isEurope ? '✓ Active' : 'Select'}
                                </span>
                              </div>
                              <p className="text-[10px] text-slate-400 mt-1 leading-snug">
                                47 European cities with Ferries, Mountain
                                Tunnels, 3 Train Stations per player (+4 pts
                                unused), and 1 Long + 3 Regular starting
                                tickets.
                              </p>
                            </button>
                          </>
                        );
                      })()}
                    </div>
                  </div>

                  {/* Option 2: Other Expansions (Map-Filtered) */}
                  <div className="pt-3 border-t border-slate-800/80">
                    {(() => {
                      const activeMapId: 'USA' | 'EUROPE' =
                        selectedExpansions.includes('europe_map')
                          ? 'EUROPE'
                          : 'USA';
                      const compatibleExpansions = stagedGame.expansions.filter(
                        (exp) =>
                          exp.id !== 'europe_map' &&
                          isExpansionCompatibleWithMap(exp, activeMapId)
                      );
                      return (
                        <>
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-black uppercase tracking-wider text-purple-300 text-[11px]">
                                🧩 Option 2: Other Expansions
                              </span>
                              <span className="px-2 py-0.5 rounded-full bg-purple-500/15 border border-purple-500/30 text-purple-300 text-[9px] font-bold">
                                Compatible with{' '}
                                {activeMapId === 'EUROPE'
                                  ? 'Europe'
                                  : 'North America'}{' '}
                                Map
                              </span>
                            </div>
                            <span className="text-[10px] text-slate-400">
                              {isHost ? 'Host Toggles' : 'Synced with Host'}
                            </span>
                          </div>

                          <div className="space-y-2.5">
                            {compatibleExpansions.map((exp) => {
                              const enabled = selectedExpansions.includes(
                                exp.id
                              );
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
                                    </div>
                                    <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">
                                      {exp.description}
                                    </p>
                                  </div>

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
                        </>
                      );
                    })()}
                  </div>
                </div>
              ) : stagedGame.id === 'dominion' ? (
                (() => {
                  const activeMode: 'preset' | 'random' | 'custom' =
                    selectedExpansions.includes('mode:random')
                      ? 'random'
                      : selectedExpansions.includes('mode:custom')
                      ? 'custom'
                      : 'preset';
                  const presetToken = selectedExpansions.find((e) =>
                    e.startsWith('preset:')
                  );
                  const activePresetId = presetToken
                    ? presetToken.slice('preset:'.length)
                    : 'base_game';
                  const customSelectedCardIds = selectedExpansions
                    .filter((e) => e.startsWith('card:'))
                    .map((e) => e.slice('card:'.length));
                  const isSeasideEnabled =
                    selectedExpansions.includes('seaside');
                  const isBase1stEnabled =
                    selectedExpansions.includes('base_1st_edition');
                  const availablePresets = DOMINION_PRESET_GAMES.filter(
                    (preset) =>
                      preset.expansion !== 'seaside' || isSeasideEnabled
                  );
                  const availableCardPool =
                    getAvailableDominionKingdomPool(selectedExpansions);

                  return (
                    <div className="space-y-3.5">
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-black uppercase tracking-wider text-amber-300 text-[11px]">
                            🏰 Dominion Kingdom Card Setup
                          </span>
                          <span className="text-[10px] text-slate-400">
                            {isHost ? 'Host Selection' : 'Synced with Host'}
                          </span>
                        </div>

                        {/* Basic Supply Note */}
                        <div className="p-2.5 rounded-xl bg-amber-950/30 border border-amber-500/30 text-[10px] text-amber-200 mb-3">
                          <strong>Included in All Games:</strong> Gold, Silver,
                          Copper, Estate, Duchy, Province, and Curse.
                        </div>

                        {/* Dominion Expansion Toggles (Seaside & 1st Ed Base Cards) */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3">
                          <button
                            type="button"
                            disabled={!isHost}
                            onClick={() => {
                              if (isHost) {
                                onToggleExpansion('seaside');
                              }
                            }}
                            className={`p-2.5 rounded-xl border text-left transition flex items-center justify-between gap-2 ${
                              isSeasideEnabled
                                ? 'bg-orange-950/50 border-orange-400 text-orange-100 shadow'
                                : 'bg-slate-900/70 border-slate-800 text-slate-300 hover:border-slate-700'
                            } ${isHost ? 'cursor-pointer' : 'cursor-default'}`}
                          >
                            <div>
                              <div className="font-black text-[11px]">
                                ⚓ Seaside Expansion (1st &amp; 2nd Ed)
                              </div>
                              <div className="text-[9px] opacity-80">
                                Duration cards, Mats, Coins &amp; 14 Seaside Presets
                              </div>
                            </div>
                            <span
                              className={`px-2 py-0.5 rounded-full font-black text-[9px] uppercase shrink-0 ${
                                isSeasideEnabled
                                  ? 'bg-orange-400 text-slate-950'
                                  : 'bg-slate-800 text-slate-400'
                              }`}
                            >
                              {isSeasideEnabled ? '✓ Enabled' : 'Enable'}
                            </span>
                          </button>

                          <button
                            type="button"
                            disabled={!isHost}
                            onClick={() => {
                              if (isHost) {
                                onToggleExpansion('base_1st_edition');
                              }
                            }}
                            className={`p-2.5 rounded-xl border text-left transition flex items-center justify-between gap-2 ${
                              isBase1stEnabled || isSeasideEnabled
                                ? 'bg-amber-950/50 border-amber-400 text-amber-100 shadow'
                                : 'bg-slate-900/70 border-slate-800 text-slate-300 hover:border-slate-700'
                            } ${isHost ? 'cursor-pointer' : 'cursor-default'}`}
                          >
                            <div>
                              <div className="font-black text-[11px]">
                                📜 1st Edition Base Cards
                              </div>
                              <div className="text-[9px] opacity-80">
                                Adventurer, Chancellor, Feast, Spy, Thief, Woodcutter
                              </div>
                            </div>
                            <span
                              className={`px-2 py-0.5 rounded-full font-black text-[9px] uppercase shrink-0 ${
                                isBase1stEnabled || isSeasideEnabled
                                  ? 'bg-amber-400 text-slate-950'
                                  : 'bg-slate-800 text-slate-400'
                              }`}
                            >
                              {isBase1stEnabled || isSeasideEnabled
                                ? '✓ Included'
                                : 'Enable'}
                            </span>
                          </button>
                        </div>

                        {/* 3 Mode Tabs: Pre-Set Game (Default: Base Game), Random 10 Cards, Select 10 Cards */}
                        <div className="grid grid-cols-3 gap-2">
                          <button
                            type="button"
                            disabled={!isHost}
                            onClick={() => {
                              if (isHost && activeMode !== 'preset') {
                                onToggleExpansion('mode:preset');
                              }
                            }}
                            className={`p-2.5 rounded-xl border text-center font-black text-[11px] transition ${
                              activeMode === 'preset'
                                ? 'bg-amber-500 text-slate-950 border-amber-300 shadow'
                                : 'bg-slate-900 text-slate-300 border-slate-800 hover:border-slate-700'
                            } ${isHost ? 'cursor-pointer' : 'cursor-default'}`}
                          >
                            📋 Pre-Set Game ({availablePresets.length})
                          </button>

                          <button
                            type="button"
                            disabled={!isHost}
                            onClick={() => {
                              if (isHost && activeMode !== 'random') {
                                onToggleExpansion('mode:random');
                              }
                            }}
                            className={`p-2.5 rounded-xl border text-center font-black text-[11px] transition ${
                              activeMode === 'random'
                                ? 'bg-emerald-500 text-slate-950 border-emerald-300 shadow'
                                : 'bg-slate-900 text-slate-300 border-slate-800 hover:border-slate-700'
                            } ${isHost ? 'cursor-pointer' : 'cursor-default'}`}
                          >
                            🎲 Random 10 Cards
                          </button>

                          <button
                            type="button"
                            disabled={!isHost}
                            onClick={() => {
                              if (isHost && activeMode !== 'custom') {
                                onToggleExpansion('mode:custom');
                              }
                            }}
                            className={`p-2.5 rounded-xl border text-center font-black text-[11px] transition ${
                              activeMode === 'custom'
                                ? 'bg-purple-500 text-slate-950 border-purple-300 shadow'
                                : 'bg-slate-900 text-slate-300 border-slate-800 hover:border-slate-700'
                            } ${isHost ? 'cursor-pointer' : 'cursor-default'}`}
                          >
                            ✨ Select 10 Cards ({customSelectedCardIds.length}/10)
                          </button>
                        </div>
                      </div>

                      {/* Mode 1: Pre-Set Games */}
                      {activeMode === 'preset' && (
                        <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                          {availablePresets.map((preset) => {
                            const isSelected = activePresetId === preset.id;
                            const cardNames = preset.cards
                              .map((cid) => DOMINION_CARDS[cid]?.name ?? cid)
                              .join(', ');
                            return (
                              <button
                                key={preset.id}
                                type="button"
                                disabled={!isHost}
                                onClick={() => {
                                  if (isHost) {
                                    onToggleExpansion(`preset:${preset.id}`);
                                  }
                                }}
                                className={`w-full p-2.5 rounded-xl border text-left transition flex flex-col gap-1 ${
                                  isSelected
                                    ? 'bg-amber-950/40 border-amber-400 shadow'
                                    : 'bg-slate-900/70 border-slate-800 hover:border-slate-700'
                                } ${
                                  isHost ? 'cursor-pointer' : 'cursor-default'
                                }`}
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <span className="font-black text-slate-100 text-xs flex items-center gap-1.5">
                                    <span>
                                      {preset.name}
                                      {preset.id === 'base_game'
                                        ? ' (Default)'
                                        : ''}
                                    </span>
                                    {preset.expansion === 'seaside' && (
                                      <span className="px-1.5 py-0.2 rounded bg-orange-500/20 border border-orange-400/50 text-orange-300 text-[9px] font-bold">
                                        ⚓ Seaside
                                      </span>
                                    )}
                                  </span>
                                  <span
                                    className={`px-2 py-0.5 rounded-full font-black text-[9px] uppercase ${
                                      isSelected
                                        ? 'bg-amber-400 text-slate-950'
                                        : 'bg-slate-800 text-slate-400'
                                    }`}
                                  >
                                    {isSelected ? '✓ Active' : 'Select'}
                                  </span>
                                </div>
                                <p className="text-[10px] text-slate-300 leading-snug">
                                  {cardNames}
                                </p>
                              </button>
                            );
                          })}
                        </div>
                      )}

                      {/* Mode 2: Random 10 Kingdom Cards */}
                      {activeMode === 'random' && (
                        <div className="p-3.5 rounded-xl bg-emerald-950/30 border border-emerald-500/40 space-y-2">
                          <div className="font-black text-emerald-300 text-xs">
                            🎲 Random 10 Kingdom Cards
                          </div>
                          <p className="text-[11px] text-slate-300 leading-relaxed">
                            10 Kingdom cards will be randomly dealt from the{' '}
                            {availableCardPool.length} available Kingdom cards
                            when the game starts:
                          </p>
                          <p className="text-[10px] text-slate-400 leading-relaxed">
                            {availableCardPool
                              .map((cid) => DOMINION_CARDS[cid]?.name ?? cid)
                              .join(', ')}
                          </p>
                        </div>
                      )}

                      {/* Mode 3: Custom 10-Card Selection */}
                      {activeMode === 'custom' && (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="text-slate-300 font-semibold">
                              Choose exactly 10 Kingdom cards ({availableCardPool.length} available):
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded-full font-black text-[10px] ${
                                customSelectedCardIds.length === 10
                                  ? 'bg-emerald-500/20 border border-emerald-400 text-emerald-300'
                                  : 'bg-amber-500/20 border border-amber-400 text-amber-300'
                              }`}
                            >
                              {customSelectedCardIds.length} / 10 Selected
                            </span>
                          </div>

                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 max-h-64 overflow-y-auto pr-1">
                            {availableCardPool.map((cid) => {
                              const card = DOMINION_CARDS[cid]!;
                              const isPicked =
                                customSelectedCardIds.includes(cid);
                              const isMaxed =
                                !isPicked && customSelectedCardIds.length >= 10;
                              return (
                                <button
                                  key={cid}
                                  type="button"
                                  disabled={!isHost || isMaxed}
                                  onClick={() => {
                                    if (isHost) {
                                      onToggleExpansion(`card:${cid}`);
                                    }
                                  }}
                                  title={card.description}
                                  className={`p-2 rounded-lg border text-left transition flex items-center justify-between gap-1 ${
                                    isPicked
                                      ? 'bg-purple-950/60 border-purple-400 text-purple-100 shadow'
                                      : 'bg-slate-900/70 border-slate-800 text-slate-300'
                                  } ${
                                    isHost && !isMaxed
                                      ? 'cursor-pointer hover:border-purple-400/60'
                                      : 'opacity-50 cursor-default'
                                  }`}
                                >
                                  <span className="font-bold text-[11px] truncate">
                                    {isPicked ? '✓ ' : ''}
                                    {card.name}
                                  </span>
                                  <span className="px-1.5 py-0.2 rounded-full bg-amber-400 text-slate-950 font-black text-[9px] shrink-0">
                                    ${card.cost}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()
              ) : stagedGame.id === 'risk' ? (
                <div className="space-y-4">
                  {/* Option 1: Territory Setup Mode */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-black uppercase tracking-wider text-rose-300 text-[11px]">
                        🗺️ Option 1: Territory Setup Mode
                      </span>
                      <span className="text-[10px] text-slate-400">
                        {isHost ? 'Host Selection' : 'Synced with Host'}
                      </span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {(() => {
                        const isAutoSetup =
                          selectedExpansions.includes('auto_setup');
                        return (
                          <>
                            <button
                              type="button"
                              disabled={!isHost}
                              onClick={() => {
                                if (isHost && isAutoSetup) {
                                  onToggleExpansion('auto_setup');
                                }
                              }}
                              className={`p-3 rounded-xl border-2 text-left transition flex flex-col justify-between ${
                                !isAutoSetup
                                  ? 'bg-rose-950/40 border-rose-400 shadow-md'
                                  : 'bg-slate-900/70 border-slate-800 hover:border-slate-700'
                              } ${isHost ? 'cursor-pointer' : 'cursor-default'}`}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span className="font-black text-slate-100 text-xs">
                                  🚩 Manual Claim (Standard)
                                </span>
                                <span
                                  className={`px-2 py-0.5 rounded-full font-black text-[9px] uppercase ${
                                    !isAutoSetup
                                      ? 'bg-rose-400 text-slate-950'
                                      : 'bg-slate-800 text-slate-400'
                                  }`}
                                >
                                  {!isAutoSetup ? '✓ Active' : 'Select'}
                                </span>
                              </div>
                              <p className="text-[10px] text-slate-400 mt-1 leading-snug">
                                Commanders take turns claiming territories one
                                by one, then deploy remaining starting armies.
                              </p>
                            </button>

                            <button
                              type="button"
                              disabled={!isHost}
                              onClick={() => {
                                if (isHost && !isAutoSetup) {
                                  onToggleExpansion('auto_setup');
                                }
                              }}
                              className={`p-3 rounded-xl border-2 text-left transition flex flex-col justify-between ${
                                isAutoSetup
                                  ? 'bg-rose-950/40 border-rose-400 shadow-md'
                                  : 'bg-slate-900/70 border-slate-800 hover:border-slate-700'
                              } ${isHost ? 'cursor-pointer' : 'cursor-default'}`}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span className="font-black text-slate-100 text-xs">
                                  ⚡ Fast Auto-Deal Setup
                                </span>
                                <span
                                  className={`px-2 py-0.5 rounded-full font-black text-[9px] uppercase ${
                                    isAutoSetup
                                      ? 'bg-rose-400 text-slate-950'
                                      : 'bg-slate-800 text-slate-400'
                                  }`}
                                >
                                  {isAutoSetup ? '✓ Active' : 'Select'}
                                </span>
                              </div>
                              <p className="text-[10px] text-slate-400 mt-1 leading-snug">
                                Randomly deals all 42 territories evenly at the
                                start, then commanders place remaining armies.
                              </p>
                            </button>
                          </>
                        );
                      })()}
                    </div>
                  </div>

                  {/* Option 2: Card Trade-In Values */}
                  <div className="pt-3 border-t border-slate-800/80">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-black uppercase tracking-wider text-amber-300 text-[11px]">
                        🃏 Option 2: Card Trade-In Values
                      </span>
                      <span className="text-[10px] text-slate-400">
                        {isHost ? 'Host Selection' : 'Synced with Host'}
                      </span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {(() => {
                        const isFixed =
                          selectedExpansions.includes('fixed_card_values');
                        return (
                          <>
                            <button
                              type="button"
                              disabled={!isHost}
                              onClick={() => {
                                if (isHost && isFixed) {
                                  onToggleExpansion('fixed_card_values');
                                }
                              }}
                              className={`p-3 rounded-xl border-2 text-left transition flex flex-col justify-between ${
                                !isFixed
                                  ? 'bg-amber-950/40 border-amber-400 shadow-md'
                                  : 'bg-slate-900/70 border-slate-800 hover:border-slate-700'
                              } ${isHost ? 'cursor-pointer' : 'cursor-default'}`}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span className="font-black text-slate-100 text-xs">
                                  📈 Escalating Sets (Standard)
                                </span>
                                <span
                                  className={`px-2 py-0.5 rounded-full font-black text-[9px] uppercase ${
                                    !isFixed
                                      ? 'bg-amber-400 text-slate-950'
                                      : 'bg-slate-800 text-slate-400'
                                  }`}
                                >
                                  {!isFixed ? '✓ Active' : 'Select'}
                                </span>
                              </div>
                              <p className="text-[10px] text-slate-400 mt-1 leading-snug">
                                Classic escalating bonuses: 4, 6, 8, 10, 12, 15,
                                20, 25... (+5 per trade after the 6th set).
                              </p>
                            </button>

                            <button
                              type="button"
                              disabled={!isHost}
                              onClick={() => {
                                if (isHost && !isFixed) {
                                  onToggleExpansion('fixed_card_values');
                                }
                              }}
                              className={`p-3 rounded-xl border-2 text-left transition flex flex-col justify-between ${
                                isFixed
                                  ? 'bg-amber-950/40 border-amber-400 shadow-md'
                                  : 'bg-slate-900/70 border-slate-800 hover:border-slate-700'
                              } ${isHost ? 'cursor-pointer' : 'cursor-default'}`}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span className="font-black text-slate-100 text-xs">
                                  🔢 Fixed Sets (4 / 6 / 8 / 10)
                                </span>
                                <span
                                  className={`px-2 py-0.5 rounded-full font-black text-[9px] uppercase ${
                                    isFixed
                                      ? 'bg-amber-400 text-slate-950'
                                      : 'bg-slate-800 text-slate-400'
                                  }`}
                                >
                                  {isFixed ? '✓ Active' : 'Select'}
                                </span>
                              </div>
                              <p className="text-[10px] text-slate-400 mt-1 leading-snug">
                                3 Infantry = +4, 3 Cavalry = +6, 3 Artillery =
                                +8, and 1 of each symbol = +10 armies.
                              </p>
                            </button>
                          </>
                        );
                      })()}
                    </div>
                  </div>

                  {/* Option 3: Win Condition */}
                  <div className="pt-3 border-t border-slate-800/80">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-black uppercase tracking-wider text-emerald-300 text-[11px]">
                        🏆 Option 3: Victory Condition
                      </span>
                      <span className="text-[10px] text-slate-400">
                        {isHost ? 'Host Selection' : 'Synced with Host'}
                      </span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      {(() => {
                        const isCapital =
                          selectedExpansions.includes('capital_risk');
                        const isSecret =
                          selectedExpansions.includes('secret_mission');
                        const isWorldDom = !isCapital && !isSecret;

                        return (
                          <>
                            <button
                              type="button"
                              disabled={!isHost}
                              onClick={() => {
                                if (!isHost) return;
                                if (isCapital) onToggleExpansion('capital_risk');
                                if (isSecret)
                                  onToggleExpansion('secret_mission');
                              }}
                              className={`p-2.5 rounded-xl border-2 text-left transition flex flex-col justify-between ${
                                isWorldDom
                                  ? 'bg-emerald-950/40 border-emerald-400 shadow-md'
                                  : 'bg-slate-900/70 border-slate-800 hover:border-slate-700'
                              } ${isHost ? 'cursor-pointer' : 'cursor-default'}`}
                            >
                              <div className="flex items-center justify-between gap-1">
                                <span className="font-black text-slate-100 text-[11px]">
                                  🌍 World Domination
                                </span>
                                {isWorldDom && (
                                  <span className="px-1.5 py-0.5 rounded-full bg-emerald-400 text-slate-950 font-black text-[8px] uppercase">
                                    ✓
                                  </span>
                                )}
                              </div>
                              <p className="text-[10px] text-slate-400 mt-1 leading-snug">
                                Eliminate all rivals &amp; conquer the map.
                              </p>
                            </button>

                            <button
                              type="button"
                              disabled={!isHost}
                              onClick={() => {
                                if (isHost && !isCapital) {
                                  onToggleExpansion('capital_risk');
                                }
                              }}
                              className={`p-2.5 rounded-xl border-2 text-left transition flex flex-col justify-between ${
                                isCapital
                                  ? 'bg-emerald-950/40 border-emerald-400 shadow-md'
                                  : 'bg-slate-900/70 border-slate-800 hover:border-slate-700'
                              } ${isHost ? 'cursor-pointer' : 'cursor-default'}`}
                            >
                              <div className="flex items-center justify-between gap-1">
                                <span className="font-black text-slate-100 text-[11px]">
                                  🏛️ Capital Risk
                                </span>
                                {isCapital && (
                                  <span className="px-1.5 py-0.5 rounded-full bg-emerald-400 text-slate-950 font-black text-[8px] uppercase">
                                    ✓
                                  </span>
                                )}
                              </div>
                              <p className="text-[10px] text-slate-400 mt-1 leading-snug">
                                Place 1 HQ; capture all Capitals to win!
                              </p>
                            </button>

                            <button
                              type="button"
                              disabled={!isHost}
                              onClick={() => {
                                if (isHost && !isSecret) {
                                  onToggleExpansion('secret_mission');
                                }
                              }}
                              className={`p-2.5 rounded-xl border-2 text-left transition flex flex-col justify-between ${
                                isSecret
                                  ? 'bg-emerald-950/40 border-emerald-400 shadow-md'
                                  : 'bg-slate-900/70 border-slate-800 hover:border-slate-700'
                              } ${isHost ? 'cursor-pointer' : 'cursor-default'}`}
                            >
                              <div className="flex items-center justify-between gap-1">
                                <span className="font-black text-slate-100 text-[11px]">
                                  🕵️ Secret Mission
                                </span>
                                {isSecret && (
                                  <span className="px-1.5 py-0.5 rounded-full bg-emerald-400 text-slate-950 font-black text-[8px] uppercase">
                                    ✓
                                  </span>
                                )}
                              </div>
                              <p className="text-[10px] text-slate-400 mt-1 leading-snug">
                                Complete your private classified objective!
                              </p>
                            </button>
                          </>
                        );
                      })()}
                    </div>
                  </div>
                </div>
              ) : stagedGame.id === 'stockpile' ? (
                <div className="space-y-4">
                  {/* Option 1: Basic Board vs Advanced Board Selector */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-black uppercase tracking-wider text-cyan-300 text-[11px]">
                        📊 Option 1: Select Stock Market Board
                      </span>
                      <span className="text-[10px] text-slate-400">
                        {isHost ? 'Host Selection' : 'Synced with Host'}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {(() => {
                        const isAdvanced =
                          selectedExpansions.includes('advanced_board');
                        return (
                          <>
                            <button
                              type="button"
                              disabled={!isHost}
                              onClick={() => {
                                if (isHost && isAdvanced) {
                                  onToggleExpansion('advanced_board');
                                }
                              }}
                              className={`p-3 rounded-xl border-2 text-left transition flex flex-col justify-between ${
                                !isAdvanced
                                  ? 'bg-cyan-950/40 border-cyan-400 shadow-md'
                                  : 'bg-slate-900/70 border-slate-800 hover:border-slate-700'
                              } ${isHost ? 'cursor-pointer' : 'cursor-default'}`}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span className="font-black text-slate-100 text-xs">
                                  📈 Basic Board (Standard Tracks)
                                </span>
                                <span
                                  className={`px-2 py-0.5 rounded-full font-black text-[9px] uppercase ${
                                    !isAdvanced
                                      ? 'bg-cyan-400 text-slate-950'
                                      : 'bg-slate-800 text-slate-400'
                                  }`}
                                >
                                  {!isAdvanced ? '✓ Active' : 'Select'}
                                </span>
                              </div>
                              <p className="text-[10px] text-slate-400 mt-1 leading-snug">
                                Uniform 1–10 stock track for all 6 companies.
                                Starts &amp; resets on 5 after Bankruptcy, and
                                splits to 6.
                              </p>
                            </button>

                            <button
                              type="button"
                              disabled={!isHost}
                              onClick={() => {
                                if (isHost && !isAdvanced) {
                                  onToggleExpansion('advanced_board');
                                }
                              }}
                              className={`p-3 rounded-xl border-2 text-left transition flex flex-col justify-between ${
                                isAdvanced
                                  ? 'bg-cyan-950/40 border-cyan-400 shadow-md'
                                  : 'bg-slate-900/70 border-slate-800 hover:border-slate-700'
                              } ${isHost ? 'cursor-pointer' : 'cursor-default'}`}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span className="font-black text-slate-100 text-xs">
                                  🚀 Advanced Board (Asymmetric Tracks)
                                </span>
                                <span
                                  className={`px-2 py-0.5 rounded-full font-black text-[9px] uppercase ${
                                    isAdvanced
                                      ? 'bg-cyan-400 text-slate-950'
                                      : 'bg-slate-800 text-slate-400'
                                  }`}
                                >
                                  {isAdvanced ? '✓ Active' : 'Select'}
                                </span>
                              </div>
                              <p className="text-[10px] text-slate-400 mt-1 leading-snug">
                                Custom per-company tracks: Cosmic Computers
                                (1-3-5-7-9), Bottomline Bank (1–6), Leading Labs
                                (1–10), American Auto (1–13), Stanford Steel ($
                                dividends), and Epic Electric.
                              </p>
                            </button>
                          </>
                        );
                      })()}
                    </div>
                  </div>

                  {/* Option 2: Other Expansions */}
                  <div className="pt-3 border-t border-slate-800/80">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-black uppercase tracking-wider text-purple-300 text-[11px]">
                        🧩 Option 2: Optional Expansions
                      </span>
                      <span className="text-[10px] text-slate-400">
                        {isHost ? 'Host Toggles' : 'Synced with Host'}
                      </span>
                    </div>
                    <div className="space-y-2.5">
                      {stagedGame.expansions
                        .filter((exp) => exp.id !== 'advanced_board')
                        .map((exp) => {
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
                                <span className="font-bold text-slate-100 text-xs">
                                  {exp.name}
                                </span>
                                <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">
                                  {exp.description}
                                </p>
                              </div>
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
                  </div>
                </div>
              ) : (
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
                                    Up to{' '}
                                    {exp.maxPlayersOverride ??
                                      stagedGame.maxPlayers}
                                    P
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
              )}

              <div className="mt-3 pt-2.5 border-t border-slate-800/80 text-[11px] text-slate-400 flex items-center justify-between">
                <span>
                  {stagedGame.id === 'ttr'
                    ? `Map: ${
                        selectedExpansions.includes('europe_map')
                          ? 'Europe'
                          : 'North America'
                      }`
                    : stagedGame.id === 'dominion'
                    ? 'Kingdom Setup:'
                    : 'Active Expansions:'}
                </span>
                <strong className="text-purple-300">
                  {stagedGame.id === 'ttr'
                    ? `${
                        selectedExpansions.filter((id) => id !== 'europe_map')
                          .length
                      } Expansion(s) Enabled`
                    : stagedGame.id === 'dominion'
                    ? selectedExpansions.includes('mode:random')
                      ? 'Random 10 Cards'
                      : selectedExpansions.includes('mode:custom')
                      ? `Custom (${
                          selectedExpansions.filter((e) =>
                            e.startsWith('card:')
                          ).length
                        }/10 Cards)`
                      : `Pre-Set: ${
                          DOMINION_PRESET_GAMES.find(
                            (p) =>
                              `preset:${p.id}` ===
                              selectedExpansions.find((e) =>
                                e.startsWith('preset:')
                              )
                          )?.name ?? 'Base Game'
                        }`
                    : selectedExpansions.length === 0
                    ? 'Base Game Only'
                    : `${selectedExpansions.length} Enabled`}
                </strong>
              </div>
            </div>

            {/* 2C. Player Color / Suspect Selection Bar */}
            <div className="p-4 rounded-2xl bg-slate-950/90 border border-slate-800 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2.5">
                  <span className="font-black uppercase tracking-wider text-amber-300 text-[11px]">
                    {stagedGame.id === 'clue'
                      ? '🕵️ Select the Suspect You Will Play As'
                      : '🎨 Claim Your Player Color'}
                  </span>
                  <span className="text-[10px] text-slate-400">
                    {mySettings.colorId
                      ? `Selected: ${
                          getGameColorById(stagedGame.id, mySettings.colorId)
                            ?.name ?? mySettings.colorId
                        }`
                      : stagedGame.id === 'clue'
                        ? 'Click an open Suspect below'
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

