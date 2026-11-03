import React, { useMemo, useState } from 'react';
import {
  ALL_CATAN_RESOURCES,
  CatanAction,
  CatanResource,
  CatanSanitizedGameState,
  CatanTerrain,
} from '../games/catan/index.js';
import { getPlayerPalette } from './mapData.js';

interface CatanBoardProps {
  readonly view: CatanSanitizedGameState;
  readonly isControlsLocked: boolean;
  readonly pendingAction: boolean;
  readonly formatPlayerLabel: (pid: string) => string;
  readonly onDispatchAction: (actorId: string, action: CatanAction) => void;
}

const TERRAIN_THEMES: Readonly<
  Record<
    CatanTerrain,
    { label: string; fill: string; stroke: string; icon: string; badge: string }
  >
> = {
  WOOD: {
    label: 'Forest (Wood)',
    fill: '#14532d',
    stroke: '#4ade80',
    icon: '🌲',
    badge: 'bg-emerald-800 text-emerald-100 border-emerald-500',
  },
  BRICK: {
    label: 'Hills (Brick)',
    fill: '#7c2d12',
    stroke: '#fb923c',
    icon: '🧱',
    badge: 'bg-orange-800 text-orange-100 border-orange-500',
  },
  SHEEP: {
    label: 'Pasture (Sheep)',
    fill: '#365314',
    stroke: '#a3e635',
    icon: '🐑',
    badge: 'bg-lime-700 text-lime-100 border-lime-400',
  },
  WHEAT: {
    label: 'Fields (Wheat)',
    fill: '#713f12',
    stroke: '#facc15',
    icon: '🌾',
    badge: 'bg-amber-600 text-slate-950 border-amber-300',
  },
  ORE: {
    label: 'Mountains (Ore)',
    fill: '#334155',
    stroke: '#94a3b8',
    icon: '⛰️',
    badge: 'bg-slate-700 text-slate-100 border-slate-400',
  },
  DESERT: {
    label: 'Desert (Robber)',
    fill: '#451a03',
    stroke: '#d97706',
    icon: '🏜️',
    badge: 'bg-amber-950 text-amber-300 border-amber-700',
  },
};

function hexPolygonPoints(cx: number, cy: number, radius: number): string {
  const pts: string[] = [];
  for (let i = 0; i < 6; i++) {
    const angleRad = ((60 * i - 30) * Math.PI) / 180;
    const x = cx + radius * Math.cos(angleRad);
    const y = cy + radius * Math.sin(angleRad);
    pts.push(`${x.toFixed(1)},${y.toFixed(1)}`);
  }
  return pts.join(' ');
}

export const CatanBoard: React.FC<CatanBoardProps> = ({
  view,
  isControlsLocked,
  pendingAction,
  formatPlayerLabel,
  onDispatchAction,
}) => {
  const [selectedHexId, setSelectedHexId] = useState<string>(
    view.hexes.find((h) => h.terrain !== 'DESERT')?.id ?? 'HEX_1'
  );
  const [tradeGive, setTradeGive] = useState<CatanResource>('WOOD');
  const [tradeReceive, setTradeReceive] = useState<CatanResource>('ORE');

  const selfPlayer = view.self;
  const isMyTurn = view.activePlayerId === selfPlayer.id;

  const hexPositions = useMemo(() => {
    const radius = 52;
    const sqrt3 = Math.sqrt(3);
    return view.hexes.map((hex) => {
      const cx = 500 + radius * sqrt3 * (hex.q + hex.r / 2);
      const cy = 300 + radius * (3 / 2) * hex.r;
      return { hex, cx, cy, radius: radius - 3 };
    });
  }, [view.hexes]);

  const mySettlements = useMemo(
    () =>
      view.buildings.filter(
        (b) => b.ownerId === selfPlayer.id && b.kind === 'SETTLEMENT'
      ),
    [view.buildings, selfPlayer.id]
  );

  const lastRollSum = view.lastDiceRoll
    ? view.lastDiceRoll[0] + view.lastDiceRoll[1]
    : null;

  return (
    <div className="flex-1 flex flex-col min-w-0 min-h-0">
      {/* 1. CENTER HEX ISLAND SVG MAP */}
      <div className="flex-1 relative min-h-0 flex items-center justify-center bg-slate-950 overflow-hidden">
        <svg
          viewBox="0 0 1000 600"
          className="w-full h-full max-h-full object-contain"
        >
          {/* Ocean Backdrop */}
          <rect
            x="10"
            y="10"
            width="980"
            height="580"
            rx="16"
            fill="#082f49"
            stroke="#0369a1"
            strokeWidth="2"
          />

          <text
            x="32"
            y="568"
            fill="#38bdf8"
            fillOpacity="0.6"
            fontSize="11"
            fontWeight="700"
            letterSpacing="0.12em"
          >
            ISLAND OF CATAN • 19-HEX PROCEDURAL BOARD • CLICK ANY HEX TO SELECT
            BUILD SITE
          </text>

          {/* Render 19 Hex Tiles */}
          <g>
            {hexPositions.map(({ hex, cx, cy, radius }) => {
              const theme = TERRAIN_THEMES[hex.terrain];
              const isSelected = hex.id === selectedHexId;
              const isHotRoll =
                lastRollSum !== null && hex.numberToken === lastRollSum;
              const isHighProb =
                hex.numberToken === 6 || hex.numberToken === 8;

              // Find settlements/cities attached to this hex
              const hexBuildings = view.buildings.filter(
                (b) => b.hexIds[0] === hex.id
              );

              return (
                <g
                  key={hex.id}
                  onClick={() => setSelectedHexId(hex.id)}
                  className="cursor-pointer group"
                >
                  <polygon
                    points={hexPolygonPoints(cx, cy, radius)}
                    fill={theme.fill}
                    stroke={
                      isSelected
                        ? '#fbbf24'
                        : isHotRoll
                        ? '#34d399'
                        : theme.stroke
                    }
                    strokeWidth={isSelected || isHotRoll ? 4 : 2}
                  />

                  {/* Terrain Icon & Resource Label */}
                  <text
                    x={cx}
                    y={cy - 18}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fontSize="16"
                  >
                    {theme.icon}
                  </text>

                  {/* Number Token Disc */}
                  {hex.numberToken !== null ? (
                    <g transform={`translate(${cx}, ${cy + 8})`}>
                      <circle
                        r="16"
                        fill={isHotRoll ? '#10b981' : '#fef3c7'}
                        stroke="#0f172a"
                        strokeWidth="2"
                      />
                      <text
                        textAnchor="middle"
                        dominantBaseline="central"
                        fill={isHighProb ? '#dc2626' : '#0f172a'}
                        fontSize="13"
                        fontWeight="900"
                      >
                        {hex.numberToken}
                      </text>
                    </g>
                  ) : (
                    <text
                      x={cx}
                      y={cy + 10}
                      textAnchor="middle"
                      fill="#fde68a"
                      fontSize="10"
                      fontWeight="800"
                    >
                      ROBBER
                    </text>
                  )}

                  {/* Render Player Settlements / Cities on this Hex */}
                  {hexBuildings.map((bld, bIdx) => {
                    const palette = getPlayerPalette(
                      bld.ownerId,
                      view.playerOrder
                    );
                    const angle = ((bIdx * 75 - 45) * Math.PI) / 180;
                    const bx = cx + (radius - 10) * Math.cos(angle);
                    const by = cy + (radius - 10) * Math.sin(angle);
                    return (
                      <g
                        key={bld.id}
                        transform={`translate(${bx}, ${by})`}
                      >
                        <circle
                          r={bld.kind === 'CITY' ? 10 : 8}
                          fill={palette.fillHex}
                          stroke="#020617"
                          strokeWidth="2"
                        />
                        <text
                          textAnchor="middle"
                          dominantBaseline="central"
                          fill="#020617"
                          fontSize="8.5"
                          fontWeight="900"
                        >
                          {bld.kind === 'CITY' ? '🏛' : '🏠'}
                        </text>
                      </g>
                    );
                  })}
                </g>
              );
            })}
          </g>
        </svg>

        {/* Top-Right Dice Roll & Victory Points HUD Card */}
        <div className="absolute top-3 right-3 bg-slate-900/95 border border-slate-700 rounded-2xl p-4 shadow-2xl backdrop-blur-md text-xs w-72 space-y-3">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <span className="font-bold uppercase tracking-wider text-amber-300 text-[11px]">
              🎲 Dice Production
            </span>
            {view.lastDiceRoll ? (
              <span className="px-2.5 py-0.5 rounded-lg bg-amber-500 text-slate-950 font-mono font-black text-sm">
                {view.lastDiceRoll[0]} + {view.lastDiceRoll[1]} ={' '}
                {view.lastDiceRoll[0] + view.lastDiceRoll[1]}
              </span>
            ) : (
              <span className="text-slate-400 italic">No roll yet</span>
            )}
          </div>

          <div className="space-y-1.5">
            <div className="text-[11px] font-semibold text-slate-400">
              Victory Points Standings (Goal: 10 VP):
            </div>
            {view.playerOrder.map((pid) => {
              const isSelf = pid === selfPlayer.id;
              const vp = isSelf
                ? selfPlayer.victoryPoints
                : view.opponents[pid]?.victoryPoints ?? 2;
              const cardsCount = isSelf
                ? ALL_CATAN_RESOURCES.reduce(
                    (s, r) => s + selfPlayer.resources[r],
                    0
                  )
                : view.opponents[pid]?.totalResourceCards ?? 0;
              const palette = getPlayerPalette(pid, view.playerOrder);

              return (
                <div
                  key={pid}
                  className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-slate-950/80 border border-slate-800"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-2.5 h-2.5 rounded-full ${palette.dotClass}`}
                    />
                    <span className="font-bold text-slate-100">
                      {formatPlayerLabel(pid)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 font-mono">
                    <span className="text-slate-400 text-[11px]">
                      🃏{cardsCount}
                    </span>
                    <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold">
                      ★ {vp} VP
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 2. BOTTOM CATAN PLAYER DASHBOARD */}
      <section
        className={`h-60 shrink-0 bg-slate-900 border-t-2 px-4 py-3 flex gap-4 overflow-x-auto z-20 transition-all ${
          isMyTurn
            ? 'border-emerald-500/80 shadow-[0_-4px_20px_rgba(16,185,129,0.18)]'
            : 'border-slate-800'
        }`}
      >
        {/* Column A: Player Resource Hand */}
        <div className="flex-1 min-w-[300px] flex flex-col justify-between bg-slate-950/70 border border-slate-800 rounded-xl p-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
              Resource Hand ({formatPlayerLabel(selfPlayer.id)})
            </span>
            <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[11px] font-bold">
              ★ {selfPlayer.victoryPoints} / 10 Victory Points
            </span>
          </div>

          <div className="grid grid-cols-5 gap-2 my-auto pt-1">
            {ALL_CATAN_RESOURCES.map((res) => {
              const count = selfPlayer.resources[res];
              const theme = TERRAIN_THEMES[res];
              return (
                <div
                  key={res}
                  className={`flex flex-col items-center justify-between rounded-xl p-2 border ${
                    count > 0
                      ? 'bg-slate-900 border-slate-700'
                      : 'bg-slate-950/40 border-slate-800/60 opacity-50'
                  }`}
                >
                  <div
                    className={`w-full h-11 rounded-lg border flex items-center justify-center gap-1 font-mono text-base font-black ${theme.badge}`}
                  >
                    <span>{theme.icon}</span>
                    <span>{count}</span>
                  </div>
                  <span className="text-[10px] font-bold text-slate-300 mt-1">
                    {res}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-800/80">
            <span>
              Supply: 🏠 {selfPlayer.settlementsRemaining} Settlements • 🏛{' '}
              {selfPlayer.citiesRemaining} Cities • 🛣 {selfPlayer.roadsBuilt}{' '}
              Roads Built
            </span>
          </div>
        </div>

        {/* Column B: Turn Actions (Roll Dice, Build Road, Settlement, City) */}
        <div className="w-[420px] shrink-0 flex flex-col justify-between bg-slate-950/70 border border-slate-800 rounded-xl p-3 text-xs">
          <div className="flex items-center justify-between">
            <span className="font-bold uppercase tracking-wider text-slate-300">
              Turn Actions ({view.turnStep})
            </span>
            <span className="text-[11px] font-mono text-amber-300">
              Target Hex: {selectedHexId}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 my-auto">
            {/* 1. Roll Dice Button */}
            <button
              disabled={
                isControlsLocked ||
                pendingAction ||
                view.turnStep !== 'ROLL_DICE'
              }
              onClick={() =>
                onDispatchAction(selfPlayer.id, { type: 'CATAN_ROLL_DICE' })
              }
              className="p-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-35 disabled:cursor-not-allowed text-slate-950 font-black transition shadow flex items-center justify-center gap-2"
            >
              <span>🎲 Roll Production Dice</span>
            </button>

            {/* 2. End Turn Button */}
            <button
              disabled={
                isControlsLocked ||
                pendingAction ||
                view.turnStep !== 'MAIN_PHASE'
              }
              onClick={() =>
                onDispatchAction(selfPlayer.id, { type: 'CATAN_END_TURN' })
              }
              className="p-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-35 disabled:cursor-not-allowed text-slate-950 font-black transition shadow flex items-center justify-center gap-2"
            >
              <span>✓ End Turn →</span>
            </button>

            {/* 3. Build Road */}
            <button
              disabled={
                isControlsLocked ||
                pendingAction ||
                view.turnStep !== 'MAIN_PHASE'
              }
              onClick={() =>
                onDispatchAction(selfPlayer.id, { type: 'CATAN_BUILD_ROAD' })
              }
              className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-35 border border-slate-700 text-slate-100 font-semibold transition flex flex-col items-start"
            >
              <span className="font-bold">🛣 Build Road</span>
              <span className="text-[10px] text-slate-400">
                Cost: 1 Wood + 1 Brick
              </span>
            </button>

            {/* 4. Build Settlement on Selected Hex */}
            <button
              disabled={
                isControlsLocked ||
                pendingAction ||
                view.turnStep !== 'MAIN_PHASE'
              }
              onClick={() =>
                onDispatchAction(selfPlayer.id, {
                  type: 'CATAN_BUILD_SETTLEMENT',
                  hexId: selectedHexId,
                })
              }
              className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-35 border border-slate-700 text-slate-100 font-semibold transition flex flex-col items-start"
            >
              <span className="font-bold">
                🏠 Build Settlement ({selectedHexId})
              </span>
              <span className="text-[10px] text-slate-400">
                1 Wood, 1 Brick, 1 Sheep, 1 Wheat (+1 VP)
              </span>
            </button>
          </div>

          <div className="flex items-center justify-between pt-1 border-t border-slate-800/80">
            <span className="text-[10px] text-slate-400">
              Upgrade Settlement to City (2 Wheat + 3 Ore):
            </span>
            <button
              disabled={
                isControlsLocked ||
                pendingAction ||
                view.turnStep !== 'MAIN_PHASE' ||
                mySettlements.length === 0
              }
              onClick={() => {
                const target = mySettlements[0];
                if (target) {
                  onDispatchAction(selfPlayer.id, {
                    type: 'CATAN_UPGRADE_CITY',
                    buildingId: target.id,
                  });
                }
              }}
              className="px-2.5 py-1 rounded bg-purple-500/20 hover:bg-purple-500/30 disabled:opacity-35 text-purple-200 border border-purple-500/40 text-[11px] font-bold"
            >
              🏛 Upgrade City (+1 VP)
            </button>
          </div>
        </div>

        {/* Column C: 4:1 Maritime Bank Trade */}
        <div className="w-72 shrink-0 flex flex-col justify-between bg-slate-950/70 border border-slate-800 rounded-xl p-3 text-xs">
          <div className="font-bold uppercase tracking-wider text-slate-300">
            ⚓ 4:1 Maritime Bank Trade
          </div>

          <div className="space-y-2 my-auto">
            <div className="flex items-center justify-between gap-2">
              <label className="text-slate-400 text-[11px]">Give 4×:</label>
              <select
                value={tradeGive}
                onChange={(e) => setTradeGive(e.target.value as CatanResource)}
                className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-100 font-semibold"
              >
                {ALL_CATAN_RESOURCES.map((r) => (
                  <option key={r} value={r}>
                    {r} ({selfPlayer.resources[r]})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center justify-between gap-2">
              <label className="text-slate-400 text-[11px]">Receive 1×:</label>
              <select
                value={tradeReceive}
                onChange={(e) =>
                  setTradeReceive(e.target.value as CatanResource)
                }
                className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-100 font-semibold"
              >
                {ALL_CATAN_RESOURCES.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>

            <button
              disabled={
                isControlsLocked ||
                pendingAction ||
                view.turnStep !== 'MAIN_PHASE'
              }
              onClick={() =>
                onDispatchAction(selfPlayer.id, {
                  type: 'CATAN_MARITIME_TRADE',
                  give: tradeGive,
                  receive: tradeReceive,
                })
              }
              className="w-full py-2 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 disabled:opacity-35 text-cyan-200 border border-cyan-500/40 font-bold transition"
            >
              ⇄ Trade 4 {tradeGive} → 1 {tradeReceive}
            </button>
          </div>

          <div className="text-[10px] text-slate-500 pt-1 border-t border-slate-800/80">
            First settler to reach 10 Victory Points wins!
          </div>
        </div>
      </section>
    </div>
  );
};

