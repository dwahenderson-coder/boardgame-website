import React, { useMemo, useState } from 'react';
import {
  ALL_CLUE_ROOMS,
  ALL_CLUE_SUSPECTS,
  ALL_CLUE_WEAPONS,
  classifyBoardTile,
  CLUE_BOARD_HEIGHT,
  CLUE_BOARD_WIDTH,
  CLUE_CENTER_SPACE,
  CLUE_ROOM_DEFINITIONS,
  CLUE_START_SQUARES,
  ClueAction,
  ClueCardName,
  ClueRoom,
  ClueSanitizedGameState,
  ClueSuspect,
  ClueWeapon,
  coordKey,
  getReachableClueTargets,
} from '../games/clue/index.js';

export interface ClueBoardProps {
  readonly gameState: ClueSanitizedGameState;
  readonly playerId: string;
  readonly playerNames: Readonly<Record<string, string>>;
  readonly isLocalSandbox?: boolean;
  readonly sendAction: (action: ClueAction, actorOverrideId?: string) => void;
}

const WEAPON_ICONS: Readonly<Record<ClueWeapon, string>> = {
  Candlestick: '🕯️',
  Dagger: '🗡️',
  'Lead Pipe': '🔧',
  Revolver: '🔫',
  Rope: '🪢',
  Wrench: '🔩',
};

const CELL_PX = 26;

export const ClueBoard: React.FC<ClueBoardProps> = ({
  gameState,
  playerNames,
  isLocalSandbox = false,
  sendAction,
}) => {
  const [selectedSuspect, setSelectedSuspect] =
    useState<ClueSuspect>('Miss Scarlet');
  const [selectedWeapon, setSelectedWeapon] =
    useState<ClueWeapon>('Candlestick');
  const [accuseOpen, setAccuseOpen] = useState(false);
  const [accuseSuspect, setAccuseSuspect] =
    useState<ClueSuspect>('Miss Scarlet');
  const [accuseWeapon, setAccuseWeapon] = useState<ClueWeapon>('Candlestick');
  const [accuseRoom, setAccuseRoom] = useState<ClueRoom>('Study');

  const formatName = (id: string): string =>
    playerNames[id] ? `${playerNames[id]} (${id})` : id;

  const self = gameState.self;
  const activePlayerId = gameState.activePlayerId;
  const isMyTurn = activePlayerId === self.id;

  const activePlayerSuspect: ClueSuspect =
    activePlayerId === self.id
      ? self.suspect
      : gameState.opponents[activePlayerId]?.suspect ?? 'Miss Scarlet';

  const activePawnPos = gameState.suspectPositions[activePlayerSuspect];

  // Calculate occupied hallway tiles for movement highlights
  const occupiedHallwayKeys = useMemo(() => {
    const keys = new Set<string>();
    const eliminatedSuspects = new Set<ClueSuspect>();
    if (self.eliminated) eliminatedSuspects.add(self.suspect);
    for (const opp of Object.values(gameState.opponents)) {
      if (opp.eliminated) eliminatedSuspects.add(opp.suspect);
    }

    for (const suspect of ALL_CLUE_SUSPECTS) {
      if (suspect === activePlayerSuspect) continue;
      if (eliminatedSuspects.has(suspect)) continue;
      const pos = gameState.suspectPositions[suspect];
      if (pos.kind === 'HALLWAY') {
        keys.add(coordKey(pos.x, pos.y));
      }
    }
    return keys;
  }, [
    gameState.suspectPositions,
    gameState.opponents,
    self.eliminated,
    self.suspect,
    activePlayerSuspect,
  ]);

  const reachableTargets = useMemo(() => {
    if (
      gameState.turnStep !== 'SELECT_DESTINATION' ||
      (!isMyTurn && !isLocalSandbox)
    ) {
      return {
        hallways: new Map<string, number>(),
        rooms: new Map<ClueRoom, number>(),
      };
    }
    return getReachableClueTargets(
      activePawnPos,
      gameState.movesRemaining,
      occupiedHallwayKeys
    );
  }, [
    gameState.turnStep,
    gameState.movesRemaining,
    isMyTurn,
    isLocalSandbox,
    activePawnPos,
    occupiedHallwayKeys,
  ]);

  const currentRoomIfAny: ClueRoom | null =
    activePawnPos.kind === 'ROOM' ? activePawnPos.room : null;

  const currentRoomSecretPassage: ClueRoom | null = currentRoomIfAny
    ? CLUE_ROOM_DEFINITIONS[currentRoomIfAny].secretPassageTo
    : null;

  const activePlayerWasMovedBySuggestion =
    activePlayerId === self.id
      ? self.wasMovedBySuggestion
      : gameState.opponents[activePlayerId]?.wasMovedBySuggestion ?? false;

  // Group pawns and weapons inside each Room for clean display
  const roomOccupants = useMemo(() => {
    const map: Record<
      ClueRoom,
      { suspects: ClueSuspect[]; weapons: ClueWeapon[] }
    > = {
      Kitchen: { suspects: [], weapons: [] },
      Ballroom: { suspects: [], weapons: [] },
      Conservatory: { suspects: [], weapons: [] },
      'Dining Room': { suspects: [], weapons: [] },
      'Billiard Room': { suspects: [], weapons: [] },
      Library: { suspects: [], weapons: [] },
      Lounge: { suspects: [], weapons: [] },
      Hall: { suspects: [], weapons: [] },
      Study: { suspects: [], weapons: [] },
    };
    for (const suspect of ALL_CLUE_SUSPECTS) {
      const pos = gameState.suspectPositions[suspect];
      if (pos.kind === 'ROOM') {
        map[pos.room].suspects.push(suspect);
      }
    }
    for (const weapon of ALL_CLUE_WEAPONS) {
      const r = gameState.weaponPositions[weapon];
      if (r) {
        map[r].weapons.push(weapon);
      }
    }
    return map;
  }, [gameState.suspectPositions, gameState.weaponPositions]);

  // All door coordinates for visual doorway markers
  const doorCoordLookup = useMemo(() => {
    const map = new Map<
      string,
      { room: ClueRoom; dir: 'UP' | 'DOWN' | 'LEFT' | 'RIGHT' }
    >();
    for (const def of Object.values(CLUE_ROOM_DEFINITIONS)) {
      for (const d of def.doors) {
        const dx = d.hallwayTile.x - d.roomTile.x;
        const dy = d.hallwayTile.y - d.roomTile.y;
        const dir: 'UP' | 'DOWN' | 'LEFT' | 'RIGHT' =
          dy < 0 ? 'UP' : dy > 0 ? 'DOWN' : dx < 0 ? 'LEFT' : 'RIGHT';
        map.set(coordKey(d.roomTile.x, d.roomTile.y), { room: def.room, dir });
      }
    }
    return map;
  }, []);

  const disproverPlayerId =
    gameState.activeSuggestion?.disproverPlayerId ?? null;
  const canActAsDisprover =
    gameState.turnStep === 'DISPROVING' &&
    disproverPlayerId !== null &&
    (disproverPlayerId === self.id || isLocalSandbox);

  return (
    <div className="w-full h-full flex flex-col xl:flex-row bg-slate-950 text-slate-100 overflow-y-auto select-none p-3 lg:p-4 gap-4">
      {/* =====================================================================
          LEFT / CENTER: 24x25 MANSION BOARD + TURN CONTROLS
         ===================================================================== */}
      <div className="flex-1 flex flex-col items-center gap-3 min-w-0">
        {/* Top Investigation Status & Action Bar */}
        <div className="w-full max-w-[920px] bg-slate-900/95 border border-slate-800 rounded-2xl p-3.5 shadow-xl flex flex-col gap-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2.5 py-1 rounded-lg bg-amber-500/20 border border-amber-500/40 text-amber-300 text-xs font-black uppercase tracking-wider">
                🔎 Clue • Turn #{gameState.turnNumber}
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 text-xs font-bold text-slate-200">
                Active Detective:{' '}
                <strong className="text-amber-300">
                  {formatName(activePlayerId)}
                </strong>{' '}
                ({activePlayerSuspect})
              </span>
              {currentRoomIfAny && (
                <span className="px-2.5 py-1 rounded-lg bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-bold">
                  📍 In {currentRoomIfAny}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              {(isMyTurn || isLocalSandbox) &&
                !self.eliminated &&
                gameState.phase === 'PLAYING' &&
                gameState.turnStep !== 'DISPROVING' && (
                  <button
                    type="button"
                    onClick={() => setAccuseOpen((prev) => !prev)}
                    className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-black text-xs shadow cursor-pointer"
                  >
                    ⚖️ Make Final Accusation
                  </button>
                )}
            </div>
          </div>

          {/* Last Action Summary */}
          {gameState.lastActionSummary && (
            <div className="text-xs text-slate-300 bg-slate-950/90 border border-slate-800 rounded-xl px-3 py-2 font-medium">
              {gameState.lastActionSummary}
            </div>
          )}

          {/* Phase-Specific Controls for Active Player */}
          {(isMyTurn || isLocalSandbox) &&
            gameState.phase === 'PLAYING' &&
            gameState.turnStep === 'CHOOSE_MOVE_METHOD' && (
              <div className="flex flex-wrap items-center gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={() =>
                    sendAction({ type: 'CLUE_ROLL_DICE' }, activePlayerId)
                  }
                  className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs shadow-lg cursor-pointer"
                >
                  🎲 Roll Dice to Move
                </button>

                {currentRoomSecretPassage && (
                  <button
                    type="button"
                    onClick={() =>
                      sendAction(
                        { type: 'CLUE_USE_SECRET_PASSAGE' },
                        activePlayerId
                      )
                    }
                    className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-black text-xs shadow-lg cursor-pointer"
                  >
                    🕳️ Use Secret Passage to {currentRoomSecretPassage}
                  </button>
                )}

                {currentRoomIfAny && activePlayerWasMovedBySuggestion && (
                  <button
                    type="button"
                    onClick={() =>
                      sendAction({ type: 'CLUE_STAY_IN_ROOM' }, activePlayerId)
                    }
                    className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs shadow-lg cursor-pointer"
                  >
                    🏠 Stay in {currentRoomIfAny} & Make Suggestion
                  </button>
                )}
              </div>
            )}

          {(isMyTurn || isLocalSandbox) &&
            gameState.phase === 'PLAYING' &&
            gameState.turnStep === 'SELECT_DESTINATION' && (
              <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                <span className="text-xs text-emerald-300 font-bold">
                  🎲 Rolled{' '}
                  {gameState.lastDiceRoll
                    ? `${gameState.lastDiceRoll[0]} + ${gameState.lastDiceRoll[1]} = ${
                        gameState.lastDiceRoll[0] + gameState.lastDiceRoll[1]
                      }`
                    : gameState.movesRemaining}{' '}
                  • Click any highlighted green Hallway square or Room on the
                  board ({gameState.movesRemaining} step(s) left).
                </span>
                <button
                  type="button"
                  onClick={() =>
                    sendAction({ type: 'CLUE_END_TURN' }, activePlayerId)
                  }
                  className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs border border-slate-700 cursor-pointer"
                >
                  End Turn Early →
                </button>
              </div>
            )}

          {/* Suggestion Form when inside a Room */}
          {(isMyTurn || isLocalSandbox) &&
            gameState.phase === 'PLAYING' &&
            gameState.turnStep === 'MAKE_SUGGESTION_OR_END' &&
            currentRoomIfAny && (
              <div className="p-3 rounded-xl bg-slate-950 border border-amber-500/50 flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2.5 text-xs">
                  <span className="font-black text-amber-300 uppercase">
                    🗣️ Suggest in {currentRoomIfAny}:
                  </span>
                  <select
                    value={selectedSuspect}
                    onChange={(e) =>
                      setSelectedSuspect(e.target.value as ClueSuspect)
                    }
                    className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white font-bold"
                  >
                    {ALL_CLUE_SUSPECTS.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                  <span className="text-slate-400">with the</span>
                  <select
                    value={selectedWeapon}
                    onChange={(e) =>
                      setSelectedWeapon(e.target.value as ClueWeapon)
                    }
                    className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white font-bold"
                  >
                    {ALL_CLUE_WEAPONS.map((w) => (
                      <option key={w} value={w}>
                        {WEAPON_ICONS[w]} {w}
                      </option>
                    ))}
                  </select>
                  <span className="text-slate-400">in the</span>
                  <span className="px-2.5 py-1 rounded bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 font-black">
                    {currentRoomIfAny}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      sendAction(
                        {
                          type: 'CLUE_MAKE_SUGGESTION',
                          suspect: selectedSuspect,
                          weapon: selectedWeapon,
                        },
                        activePlayerId
                      )
                    }
                    className="px-4 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs shadow cursor-pointer"
                  >
                    📣 Make Suggestion
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      sendAction({ type: 'CLUE_END_TURN' }, activePlayerId)
                    }
                    className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs border border-slate-700 cursor-pointer"
                  >
                    Skip & End Turn
                  </button>
                </div>
              </div>
            )}

          {/* Disprove Interruption Loop Banner */}
          {gameState.turnStep === 'DISPROVING' &&
            gameState.activeSuggestion && (
              <div className="p-3.5 rounded-xl bg-indigo-950/80 border-2 border-indigo-400 flex flex-col gap-2">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <span className="font-black text-indigo-200">
                    🛑 Disprove Interruption Loop:{' '}
                    {formatName(gameState.activeSuggestion.suggestingPlayerId)}{' '}
                    suggested{' '}
                    <strong className="text-white">
                      {gameState.activeSuggestion.suspect}
                    </strong>{' '}
                    with the{' '}
                    <strong className="text-white">
                      {gameState.activeSuggestion.weapon}
                    </strong>{' '}
                    in the{' '}
                    <strong className="text-white">
                      {gameState.activeSuggestion.room}
                    </strong>
                  </span>
                  {gameState.activeSuggestion.passedPlayerIds.length > 0 && (
                    <span className="text-[11px] text-slate-300">
                      Passed (0 matches):{' '}
                      {gameState.activeSuggestion.passedPlayerIds
                        .map((id) => formatName(id))
                        .join(', ')}
                    </span>
                  )}
                </div>

                {canActAsDisprover &&
                gameState.matchingCardsToDisprove.length > 0 ? (
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <span className="text-xs text-amber-300 font-bold">
                      {formatName(disproverPlayerId!)}: Select 1 matching card
                      from your hand to privately show{' '}
                      {formatName(
                        gameState.activeSuggestion.suggestingPlayerId
                      )}
                      :
                    </span>
                    {gameState.matchingCardsToDisprove.map((cardName) => (
                      <button
                        key={cardName}
                        type="button"
                        onClick={() =>
                          sendAction(
                            {
                              type: 'CLUE_DISPROVE_SUGGESTION',
                              card: cardName,
                            },
                            disproverPlayerId!
                          )
                        }
                        className="px-3.5 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs shadow cursor-pointer"
                      >
                        🃏 Show &quot;{cardName}&quot;
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="text-xs text-indigo-200">
                    Waiting for{' '}
                    <strong>{formatName(disproverPlayerId ?? '')}</strong> to
                    choose a card to privately show{' '}
                    {formatName(gameState.activeSuggestion.suggestingPlayerId)}
                    ...
                    {isLocalSandbox && disproverPlayerId !== self.id && (
                      <span className="ml-2 text-amber-300 font-bold">
                        (Switch Viewport to {disproverPlayerId} or enable God
                        Mode to view their hand)
                      </span>
                    )}
                  </div>
                )}
              </div>
            )}

          {/* Post-Suggestion Resolution & End Turn */}
          {gameState.turnStep === 'POST_SUGGESTION' && (
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <div className="text-xs">
                {gameState.activeSuggestion ? (
                  gameState.activeSuggestion.shownByPlayerId ? (
                    gameState.activeSuggestion.shownCard ? (
                      <span className="px-3 py-1.5 rounded-lg bg-emerald-950 border border-emerald-400 text-emerald-200 font-bold inline-block">
                        🔒 Private Clue Revealed:{' '}
                        <strong>
                          {formatName(
                            gameState.activeSuggestion.shownByPlayerId
                          )}
                        </strong>{' '}
                        showed you{' '}
                        <strong className="text-amber-300 underline">
                          {gameState.activeSuggestion.shownCard}
                        </strong>
                        !
                      </span>
                    ) : (
                      <span className="text-slate-300">
                        🔒{' '}
                        <strong>
                          {formatName(
                            gameState.activeSuggestion.shownByPlayerId
                          )}
                        </strong>{' '}
                        privately showed a disproving card to{' '}
                        <strong>
                          {formatName(
                            gameState.activeSuggestion.suggestingPlayerId
                          )}
                        </strong>
                        .
                      </span>
                    )
                  ) : (
                    <span className="text-rose-300 font-bold">
                      ❗ Nobody could disprove the suggestion!
                    </span>
                  )
                ) : (
                  <span className="text-slate-400">
                    Movement complete for this turn.
                  </span>
                )}
              </div>

              {(isMyTurn || isLocalSandbox) && (
                <button
                  type="button"
                  onClick={() =>
                    sendAction({ type: 'CLUE_END_TURN' }, activePlayerId)
                  }
                  className="px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs shadow-lg cursor-pointer"
                >
                  ✓ End Turn →
                </button>
              )}
            </div>
          )}

          {/* Final Accusation Drawer */}
          {accuseOpen && (
            <div className="p-3.5 rounded-xl bg-rose-950/80 border-2 border-rose-500 flex flex-col gap-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase text-rose-200">
                  ⚠️ Final Accusation (Warning: An incorrect accusation
                  eliminates you from moving/winning!)
                </span>
                <button
                  type="button"
                  onClick={() => setAccuseOpen(false)}
                  className="text-xs text-rose-300 hover:text-white font-bold"
                >
                  ✕ Cancel
                </button>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <select
                  value={accuseSuspect}
                  onChange={(e) =>
                    setAccuseSuspect(e.target.value as ClueSuspect)
                  }
                  className="bg-slate-900 border border-rose-400/50 rounded-lg px-2.5 py-1.5 text-white font-bold"
                >
                  {ALL_CLUE_SUSPECTS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
                <span>with the</span>
                <select
                  value={accuseWeapon}
                  onChange={(e) =>
                    setAccuseWeapon(e.target.value as ClueWeapon)
                  }
                  className="bg-slate-900 border border-rose-400/50 rounded-lg px-2.5 py-1.5 text-white font-bold"
                >
                  {ALL_CLUE_WEAPONS.map((w) => (
                    <option key={w} value={w}>
                      {WEAPON_ICONS[w]} {w}
                    </option>
                  ))}
                </select>
                <span>in the</span>
                <select
                  value={accuseRoom}
                  onChange={(e) => setAccuseRoom(e.target.value as ClueRoom)}
                  className="bg-slate-900 border border-rose-400/50 rounded-lg px-2.5 py-1.5 text-white font-bold"
                >
                  {ALL_CLUE_ROOMS.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => {
                    sendAction(
                      {
                        type: 'CLUE_MAKE_ACCUSATION',
                        suspect: accuseSuspect,
                        weapon: accuseWeapon,
                        room: accuseRoom,
                      },
                      activePlayerId
                    );
                    setAccuseOpen(false);
                  }}
                  className="px-4 py-1.5 rounded-xl bg-rose-500 hover:bg-rose-400 text-white font-black text-xs shadow-lg cursor-pointer"
                >
                  ⚖️ Confirm Final Accusation
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ===================================================================
            THE 24 x 25 MANSION GRID BOARD
           =================================================================== */}
        <div className="p-3 rounded-2xl bg-stone-950 border-4 border-stone-800 shadow-2xl overflow-auto max-w-full">
          <div
            className="relative"
            style={{
              width: CLUE_BOARD_WIDTH * CELL_PX,
              height: CLUE_BOARD_HEIGHT * CELL_PX,
            }}
          >
            {/* 1. Base 24x25 Grid Cells (Hallways, Rooms, Borders, Start Squares) */}
            {Array.from({ length: CLUE_BOARD_HEIGHT }, (_, rowIdx) => {
              const y = rowIdx + 1;
              return Array.from({ length: CLUE_BOARD_WIDTH }, (__, colIdx) => {
                const x = colIdx + 1;
                const key = coordKey(x, y);
                const tile = classifyBoardTile(x, y);

                const left = (x - 1) * CELL_PX;
                const top = (y - 1) * CELL_PX;

                if (tile.kind === 'BORDER') {
                  return (
                    <div
                      key={key}
                      style={{
                        left,
                        top,
                        width: CELL_PX,
                        height: CELL_PX,
                        backgroundColor: '#000000',
                      }}
                      className="absolute"
                    />
                  );
                }

                if (tile.kind === 'CLUE_SPACE') {
                  // Rendered as a single overlay block below
                  return null;
                }

                if (tile.kind === 'START_SQUARE') {
                  const startDef = CLUE_START_SQUARES[tile.suspect];
                  const isFirstTile =
                    startDef.tiles[0].x === x && startDef.tiles[0].y === y;
                  const pawnAtStart =
                    gameState.suspectPositions[tile.suspect].kind === 'START';

                  return (
                    <div
                      key={key}
                      title={`${tile.suspect} Starting Square (Exits to X${startDef.exitHallway.x}, Y${startDef.exitHallway.y})`}
                      style={{
                        left,
                        top,
                        width: CELL_PX,
                        height: CELL_PX,
                        backgroundColor: startDef.squareBgHex,
                      }}
                      className="absolute border border-black/50 flex items-center justify-center"
                    >
                      {isFirstTile && pawnAtStart && (
                        <div
                          title={`${tile.suspect} Pawn`}
                          style={{
                            backgroundColor: startDef.pawnHex,
                            borderColor: startDef.pawnBorderHex,
                          }}
                          className="w-5 h-5 rounded-full border-2 shadow-md flex items-center justify-center text-[9px] font-black text-slate-950 z-20"
                        >
                          {tile.suspect
                            .split(' ')
                            .map((w) => w[0])
                            .join('')}
                        </div>
                      )}
                    </div>
                  );
                }

                if (tile.kind === 'ROOM') {
                  const roomDef = CLUE_ROOM_DEFINITIONS[tile.room];
                  const doorInfo = doorCoordLookup.get(key);
                  const isRoomReachable = reachableTargets.rooms.has(tile.room);

                  // Check outer perimeter of room to draw outer wall borders (no internal grid lines!)
                  const upTile =
                    y > 1
                      ? classifyBoardTile(x, y - 1)
                      : ({ kind: 'BORDER' } as const);
                  const downTile =
                    y < CLUE_BOARD_HEIGHT
                      ? classifyBoardTile(x, y + 1)
                      : ({ kind: 'BORDER' } as const);
                  const leftTile =
                    x > 1
                      ? classifyBoardTile(x - 1, y)
                      : ({ kind: 'BORDER' } as const);
                  const rightTile =
                    x < CLUE_BOARD_WIDTH
                      ? classifyBoardTile(x + 1, y)
                      : ({ kind: 'BORDER' } as const);

                  const isTopWall =
                    !(upTile.kind === 'ROOM' && upTile.room === tile.room) &&
                    doorInfo?.dir !== 'UP';
                  const isBottomWall =
                    !(
                      downTile.kind === 'ROOM' && downTile.room === tile.room
                    ) && doorInfo?.dir !== 'DOWN';
                  const isLeftWall =
                    !(
                      leftTile.kind === 'ROOM' && leftTile.room === tile.room
                    ) && doorInfo?.dir !== 'LEFT';
                  const isRightWall =
                    !(
                      rightTile.kind === 'ROOM' && rightTile.room === tile.room
                    ) && doorInfo?.dir !== 'RIGHT';

                  return (
                    <div
                      key={key}
                      onClick={() => {
                        if (isRoomReachable) {
                          sendAction(
                            { type: 'CLUE_MOVE_TO_ROOM', room: tile.room },
                            activePlayerId
                          );
                        }
                      }}
                      style={{
                        left,
                        top,
                        width: CELL_PX,
                        height: CELL_PX,
                        background: roomDef.backgroundStyle,
                        borderTop: isTopWall
                          ? `2px solid ${roomDef.borderColor}`
                          : 'none',
                        borderBottom: isBottomWall
                          ? `2px solid ${roomDef.borderColor}`
                          : 'none',
                        borderLeft: isLeftWall
                          ? `2px solid ${roomDef.borderColor}`
                          : 'none',
                        borderRight: isRightWall
                          ? `2px solid ${roomDef.borderColor}`
                          : 'none',
                      }}
                      className={`absolute ${
                        isRoomReachable
                          ? 'cursor-pointer ring-1 ring-emerald-400/60 brightness-125'
                          : ''
                      }`}
                    >
                      {doorInfo && (
                        <div
                          title={`Door to ${tile.room}`}
                          className="w-full h-full flex items-center justify-center bg-amber-300/35 border border-dashed border-amber-200 text-[9px] font-black text-amber-100"
                        >
                          🚪
                        </div>
                      )}
                    </div>
                  );
                }

                // Otherwise: HALLWAY square (Off-white marble tile with grid lines)
                const stepCost = reachableTargets.hallways.get(key);
                const isReachableHallway = stepCost !== undefined;

                // Check if any suspect pawn is on this hallway square
                const suspectOnHallway = ALL_CLUE_SUSPECTS.find((s) => {
                  const p = gameState.suspectPositions[s];
                  return p.kind === 'HALLWAY' && p.x === x && p.y === y;
                });

                return (
                  <div
                    key={key}
                    onClick={() => {
                      if (isReachableHallway) {
                        sendAction(
                          { type: 'CLUE_MOVE_TO_HALLWAY', x, y },
                          activePlayerId
                        );
                      }
                    }}
                    title={`Hallway (X${x}, Y${y})`}
                    style={{
                      left,
                      top,
                      width: CELL_PX,
                      height: CELL_PX,
                      background: isReachableHallway
                        ? 'linear-gradient(135deg, #bbf7d0 0%, #86efac 100%)'
                        : 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 55%, #f1f5f9 100%)',
                    }}
                    className={`absolute border border-stone-400/80 flex items-center justify-center ${
                      isReachableHallway
                        ? 'cursor-pointer ring-1 ring-emerald-600 z-10'
                        : ''
                    }`}
                  >
                    {suspectOnHallway ? (
                      <div
                        title={`${suspectOnHallway} at (X${x}, Y${y})`}
                        style={{
                          backgroundColor:
                            CLUE_START_SQUARES[suspectOnHallway].pawnHex,
                          borderColor: '#0f172a',
                        }}
                        className="w-5 h-5 rounded-full border-2 shadow-md flex items-center justify-center text-[9px] font-black text-slate-950 z-20"
                      >
                        {suspectOnHallway
                          .split(' ')
                          .map((w) => w[0])
                          .join('')}
                      </div>
                    ) : isReachableHallway ? (
                      <span className="text-[9px] font-black text-emerald-950">
                        {stepCost}
                      </span>
                    ) : null}
                  </div>
                );
              });
            })}

            {/* 2. Center Clue Space Overlay (X10..X14, Y9..Y15) */}
            <div
              style={{
                left: (CLUE_CENTER_SPACE.xMin - 1) * CELL_PX,
                top: (CLUE_CENTER_SPACE.yMin - 1) * CELL_PX,
                width:
                  (CLUE_CENTER_SPACE.xMax - CLUE_CENTER_SPACE.xMin + 1) *
                  CELL_PX,
                height:
                  (CLUE_CENTER_SPACE.yMax - CLUE_CENTER_SPACE.yMin + 1) *
                  CELL_PX,
              }}
              className="absolute bg-black border-2 border-amber-500/80 flex flex-col items-center justify-between p-2 z-10 overflow-hidden shadow-xl"
            >
              {/* Top of Clue Space: Rolled Dice Display */}
              <div className="w-full flex flex-col items-center gap-1 pt-0.5">
                <span className="text-[8px] font-black uppercase tracking-widest text-amber-300/90">
                  Dice Roll
                </span>
                {gameState.lastDiceRoll ? (
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-white text-slate-950 font-black text-sm flex items-center justify-center shadow border border-slate-300">
                      {gameState.lastDiceRoll[0]}
                    </div>
                    <div className="w-7 h-7 rounded-lg bg-white text-slate-950 font-black text-sm flex items-center justify-center shadow border border-slate-300">
                      {gameState.lastDiceRoll[1]}
                    </div>
                  </div>
                ) : (
                  <div className="text-[9px] text-slate-400 italic">
                    Ready to Roll
                  </div>
                )}
              </div>

              {/* Bottom of Clue Space: White Magnifying Glass with "Clue" written diagonally */}
              <div className="relative w-24 h-24 flex items-center justify-center">
                <svg
                  viewBox="0 0 100 100"
                  className="w-20 h-20 text-white drop-shadow"
                >
                  <circle
                    cx="42"
                    cy="42"
                    r="26"
                    fill="rgba(255,255,255,0.14)"
                    stroke="#ffffff"
                    strokeWidth="7"
                  />
                  <line
                    x1="61"
                    y1="61"
                    x2="88"
                    y2="88"
                    stroke="#ffffff"
                    strokeWidth="9"
                    strokeLinecap="round"
                  />
                </svg>
                <span
                  style={{ transform: 'rotate(-28deg)' }}
                  className="absolute font-serif font-black text-xl tracking-wider text-amber-400 drop-shadow-[0_2px_4px_rgba(0,0,0,0.95)]"
                >
                  CLUE
                </span>
              </div>
            </div>

            {/* 3. Room Name Label Boxes, Secret Passages, Suspect Pawns & Weapon Tokens */}
            {Object.values(CLUE_ROOM_DEFINITIONS).map((roomDef) => {
              const left = (roomDef.xMin - 1) * CELL_PX;
              const top = (roomDef.yMin - 1) * CELL_PX;
              const width = (roomDef.xMax - roomDef.xMin + 1) * CELL_PX;
              const height = (roomDef.yMax - roomDef.yMin + 1) * CELL_PX;
              const occupants = roomOccupants[roomDef.room];
              const isReachable = reachableTargets.rooms.has(roomDef.room);

              return (
                <div
                  key={`room_overlay_${roomDef.room}`}
                  onClick={() => {
                    if (isReachable) {
                      sendAction(
                        { type: 'CLUE_MOVE_TO_ROOM', room: roomDef.room },
                        activePlayerId
                      );
                    }
                  }}
                  style={{ left, top, width, height }}
                  className={`absolute pointer-events-none flex flex-col items-center justify-center p-1.5 z-10 ${
                    isReachable ? 'pointer-events-auto cursor-pointer' : ''
                  }`}
                >
                  {/* Room Label Box in a similar color to its background */}
                  <div
                    style={{
                      backgroundColor: roomDef.labelBoxColor,
                      color: roomDef.labelTextColor,
                      borderColor: roomDef.borderColor,
                    }}
                    className="px-2 py-0.5 rounded border shadow-md text-[10px] font-black tracking-wide uppercase text-center leading-tight"
                  >
                    {roomDef.room}
                    {isReachable && (
                      <span className="ml-1 px-1 rounded bg-emerald-400 text-slate-950 text-[8px]">
                        ENTER
                      </span>
                    )}
                  </div>

                  {/* Secret Passage Badge */}
                  {roomDef.secretPassageTo && (
                    <div className="mt-0.5 px-1.5 py-0.2 rounded bg-black/75 border border-amber-400/60 text-[8px] font-bold text-amber-200">
                      🕳️ → {roomDef.secretPassageTo}
                    </div>
                  )}

                  {/* Suspect Pawns inside Room */}
                  {occupants.suspects.length > 0 && (
                    <div className="flex flex-wrap items-center justify-center gap-1 mt-1">
                      {occupants.suspects.map((suspect) => {
                        const sDef = CLUE_START_SQUARES[suspect];
                        return (
                          <div
                            key={suspect}
                            title={suspect}
                            style={{
                              backgroundColor: sDef.pawnHex,
                              borderColor: '#0f172a',
                            }}
                            className="w-5 h-5 rounded-full border-2 shadow flex items-center justify-center text-[8px] font-black text-slate-950"
                          >
                            {suspect
                              .split(' ')
                              .map((w) => w[0])
                              .join('')}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Weapon Tokens inside Room */}
                  {occupants.weapons.length > 0 && (
                    <div className="flex flex-wrap items-center justify-center gap-1 mt-0.5">
                      {occupants.weapons.map((weapon) => (
                        <span
                          key={weapon}
                          title={weapon}
                          className="px-1 py-0.2 rounded bg-slate-950/85 border border-slate-600 text-[8px] font-bold text-slate-100"
                        >
                          {WEAPON_ICONS[weapon]} {weapon}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* =====================================================================
          RIGHT SIDEBAR: PLAYER CARDS, DETECTIVE ROSTER & INTERACTIVE NOTEPAD
         ===================================================================== */}
      <div className="w-full xl:w-96 shrink-0 flex flex-col gap-3">
        {/* 1. Viewing Player's Dealt Clue Cards & Suspect Identity */}
        <div className="bg-slate-900/95 border border-slate-800 rounded-2xl p-3.5 shadow-lg space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span
                style={{
                  backgroundColor: CLUE_START_SQUARES[self.suspect].pawnHex,
                  borderColor: CLUE_START_SQUARES[self.suspect].pawnBorderHex,
                }}
                className="w-4 h-4 rounded-full border-2 shrink-0"
              />
              <span className="font-black text-xs text-white">
                {formatName(self.id)} • {self.suspect}
              </span>
            </div>
            {self.eliminated && (
              <span className="px-2 py-0.5 rounded bg-rose-500/20 border border-rose-500/40 text-rose-300 text-[10px] font-black">
                ELIMINATED
              </span>
            )}
          </div>

          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            🃏 Your Evidence Hand ({self.hand.length} Cards)
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            {self.hand.map((card) => (
              <div
                key={card.id}
                className="p-2 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between text-xs"
              >
                <span className="font-bold text-slate-100 truncate">
                  {card.name}
                </span>
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-800 text-amber-300 font-bold">
                  {card.category}
                </span>
              </div>
            ))}
          </div>

          {/* Received Private Clues Log */}
          {self.receivedClues.length > 0 && (
            <div className="pt-2 border-t border-slate-800 space-y-1">
              <div className="text-[10px] font-bold uppercase text-emerald-300">
                🔒 Clues Shown to You ({self.receivedClues.length})
              </div>
              <div className="max-h-24 overflow-y-auto space-y-1 pr-1">
                {self.receivedClues.map((clue, idx) => (
                  <div
                    key={`${clue.turnNumber}_${idx}`}
                    className="text-[11px] bg-emerald-950/40 border border-emerald-500/30 rounded-lg px-2 py-1 text-emerald-200"
                  >
                    <strong>T{clue.turnNumber}:</strong>{' '}
                    {formatName(clue.fromPlayerId)} showed{' '}
                    <strong className="text-amber-300">{clue.card}</strong>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* 2. Interactive Detective Notepad */}
        <div className="bg-slate-900/95 border border-slate-800 rounded-2xl p-3.5 shadow-lg flex-1 flex flex-col gap-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black uppercase tracking-wider text-amber-300">
              📓 Detective Notepad
            </span>
            <span className="text-[10px] text-slate-400">
              Click any row to cycle mark
            </span>
          </div>

          <div className="space-y-3 overflow-y-auto max-h-[460px] pr-1">
            {(
              [
                { title: 'Suspects', items: ALL_CLUE_SUSPECTS },
                { title: 'Weapons', items: ALL_CLUE_WEAPONS },
                { title: 'Rooms', items: ALL_CLUE_ROOMS },
              ] as const
            ).map((group) => (
              <div key={group.title} className="space-y-1">
                <div className="text-[10px] font-black uppercase tracking-wider text-slate-400 border-b border-slate-800 pb-0.5">
                  {group.title}
                </div>
                <div className="grid grid-cols-1 gap-1">
                  {group.items.map((itemName) => {
                    const mark =
                      self.notepad[itemName as ClueCardName] ?? 'UNKNOWN';
                    const isInMyHand = self.hand.some(
                      (c) => c.name === itemName
                    );
                    return (
                      <button
                        key={itemName}
                        type="button"
                        onClick={() =>
                          sendAction({
                            type: 'CLUE_TOGGLE_NOTEPAD',
                            card: itemName as ClueCardName,
                          })
                        }
                        className={`px-2.5 py-1 rounded-lg border text-left flex items-center justify-between text-xs transition cursor-pointer ${
                          mark === 'YES'
                            ? 'bg-emerald-950/40 border-emerald-500/40 text-slate-300 line-through'
                            : mark === 'NO'
                              ? 'bg-rose-950/30 border-rose-500/30 text-slate-400 line-through'
                              : mark === 'MAYBE'
                                ? 'bg-amber-950/40 border-amber-500/50 text-amber-200'
                                : 'bg-slate-950 border-slate-800 text-slate-100 hover:border-slate-700'
                        }`}
                      >
                        <span className="font-semibold truncate">
                          {itemName}
                          {isInMyHand && (
                            <span className="ml-1.5 text-[9px] text-emerald-400 font-bold no-underline">
                              (In Hand)
                            </span>
                          )}
                        </span>
                        <span className="font-mono font-black text-[10px] shrink-0">
                          {mark === 'YES'
                            ? '✓ CLEARED'
                            : mark === 'NO'
                              ? '✗ RULED OUT'
                              : mark === 'MAYBE'
                                ? '? SUSPECTED'
                                : '—'}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
