import React, { useMemo, useState } from 'react';
import {
  ALL_CATAN_RESOURCES,
  CatanAction,
  CatanDevCardFrame,
  CatanResource,
  CatanSanitizedGameState,
  CatanTerrain,
  getPlayerMaritimeTradeRate,
  getValidInitialSettlementSpots,
  getValidRoadSpots,
  getValidSettlementSpots,
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

const DEV_FRAME_STYLES: Readonly<
  Record<CatanDevCardFrame, { badge: string; border: string; label: string }>
> = {
  RED: {
    badge: 'bg-rose-950/90 border-rose-500 text-rose-100',
    border: 'border-rose-500',
    label: 'Red Frame • Knight',
  },
  GREEN: {
    badge: 'bg-emerald-950/90 border-emerald-500 text-emerald-100',
    border: 'border-emerald-500',
    label: 'Green Frame • Progress',
  },
  YELLOW: {
    badge: 'bg-amber-950/90 border-amber-400 text-amber-100',
    border: 'border-amber-400',
    label: 'Yellow Frame • Victory Point',
  },
};

const SVG_CENTER_X = 500;
const SVG_CENTER_Y = 300;
const HEX_SCALE = 54;

function toSvgCoords(planarX: number, planarY: number): { x: number; y: number } {
  return {
    x: SVG_CENTER_X + planarX * HEX_SCALE,
    y: SVG_CENTER_Y + planarY * HEX_SCALE,
  };
}

/**
 * Graphical 6-sided die SVG component with traditional pip layouts (1..6).
 */
const DieFaceVisual: React.FC<{ value: number; isHotSeven?: boolean }> = ({
  value,
  isHotSeven,
}) => {
  const pipsByValue: Readonly<Record<number, ReadonlyArray<[number, number]>>> =
    {
      1: [[24, 24]],
      2: [
        [14, 14],
        [34, 34],
      ],
      3: [
        [14, 14],
        [24, 24],
        [34, 34],
      ],
      4: [
        [14, 14],
        [34, 14],
        [14, 34],
        [34, 34],
      ],
      5: [
        [14, 14],
        [34, 14],
        [24, 24],
        [14, 34],
        [34, 34],
      ],
      6: [
        [14, 12],
        [34, 12],
        [14, 24],
        [34, 24],
        [14, 36],
        [34, 36],
      ],
    };

  const pips = pipsByValue[value] ?? pipsByValue[1]!;

  return (
    <svg
      width="48"
      height="48"
      viewBox="0 0 48 48"
      className="drop-shadow-md shrink-0"
    >
      <rect
        x="2"
        y="2"
        width="44"
        height="44"
        rx="10"
        fill={isHotSeven ? '#fef2f2' : '#fffbeb'}
        stroke={isHotSeven ? '#ef4444' : '#d97706'}
        strokeWidth="2.5"
      />
      {pips.map(([px, py], idx) => (
        <circle
          key={idx}
          cx={px}
          cy={py}
          r="4.2"
          fill={isHotSeven ? '#dc2626' : '#0f172a'}
        />
      ))}
    </svg>
  );
};

function createZeroBundle(): Record<CatanResource, number> {
  return { WOOD: 0, BRICK: 0, SHEEP: 0, WHEAT: 0, ORE: 0 };
}

function formatBundleText(
  bundle: Readonly<Record<CatanResource, number>>
): string {
  const items = ALL_CATAN_RESOURCES.filter((r) => (bundle[r] ?? 0) > 0).map(
    (r) => `${bundle[r]} ${r}`
  );
  return items.length > 0 ? items.join(', ') : 'None';
}

export const CatanBoard: React.FC<CatanBoardProps> = ({
  view,
  isControlsLocked,
  pendingAction,
  formatPlayerLabel,
  onDispatchAction,
}) => {
  const selfPlayer = view.self;
  const isMyTurn = view.activePlayerId === selfPlayer.id;

  const [selectedHexId, setSelectedHexId] = useState<string>(
    view.hexes.find((h) => h.terrain !== 'DESERT')?.id ?? '0,0'
  );
  const [selectedVertexId, setSelectedVertexId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);

  // Maritime trade state
  const [tradeGive, setTradeGive] = useState<CatanResource>('WOOD');
  const [tradeReceive, setTradeReceive] = useState<CatanResource>('ORE');

  // Player-to-Player Trade Proposal State
  const [offerAmounts, setOfferAmounts] = useState<Record<CatanResource, number>>(
    () => ({ WOOD: 1, BRICK: 0, SHEEP: 0, WHEAT: 0, ORE: 0 })
  );
  const [requestAmounts, setRequestAmounts] = useState<
    Record<CatanResource, number>
  >(() => ({ WOOD: 0, BRICK: 0, SHEEP: 0, WHEAT: 0, ORE: 1 }));

  // Counter-offer state for responding players or active player
  const [counterGiveAmounts, setCounterGiveAmounts] = useState<
    Record<CatanResource, number>
  >(() => createZeroBundle());
  const [counterRequestAmounts, setCounterRequestAmounts] = useState<
    Record<CatanResource, number>
  >(() => createZeroBundle());
  const [counteringTargetId, setCounteringTargetId] = useState<string | null>(
    null
  );

  // Development Card play parameters
  const [monopolyResource, setMonopolyResource] =
    useState<CatanResource>('WOOD');
  const [yopResource1, setYopResource1] = useState<CatanResource>('WHEAT');
  const [yopResource2, setYopResource2] = useState<CatanResource>('ORE');

  // Discard on 7 state
  const [discardAmounts, setDiscardAmounts] = useState<
    Record<CatanResource, number>
  >(() => createZeroBundle());

  const lastRollSum = view.lastDiceRoll
    ? view.lastDiceRoll[0] + view.lastDiceRoll[1]
    : null;

  // Compute valid vertex & edge placement spots for interactive highlighting on the SVG map
  const validInitialVertices = useMemo(() => {
    if (
      view.turnStep !== 'SETUP_SETTLEMENT_1' &&
      view.turnStep !== 'SETUP_SETTLEMENT_2'
    ) {
      return new Set<string>();
    }
    return new Set(
      getValidInitialSettlementSpots(view.board).map((v) => v.id)
    );
  }, [view.board, view.turnStep]);

  const validMainPhaseVertices = useMemo(() => {
    if (view.turnStep !== 'MAIN_PHASE') return new Set<string>();
    return new Set(
      getValidSettlementSpots(view.board, selfPlayer.id).map((v) => v.id)
    );
  }, [view.board, view.turnStep, selfPlayer.id]);

  const validRoadEdges = useMemo(() => {
    if (view.turnStep === 'SETUP_ROAD_1' || view.turnStep === 'SETUP_ROAD_2') {
      return new Set(
        getValidRoadSpots(
          view.board,
          view.activePlayerId,
          view.lastPlacedSettlementVertexId ?? undefined
        ).map((e) => e.id)
      );
    }
    if (view.turnStep === 'MAIN_PHASE' || view.freeRoadsRemaining > 0) {
      return new Set(
        getValidRoadSpots(view.board, selfPlayer.id).map((e) => e.id)
      );
    }
    return new Set<string>();
  }, [
    view.board,
    view.turnStep,
    view.activePlayerId,
    view.lastPlacedSettlementVertexId,
    view.freeRoadsRemaining,
    selfPlayer.id,
  ]);

  const handleVertexClick = (vertexId: string) => {
    setSelectedVertexId(vertexId);
    const vertex = view.board.vertices[vertexId];
    if (!vertex || isControlsLocked || pendingAction) return;

    if (
      isMyTurn &&
      (view.turnStep === 'SETUP_SETTLEMENT_1' ||
        view.turnStep === 'SETUP_SETTLEMENT_2') &&
      validInitialVertices.has(vertexId)
    ) {
      onDispatchAction(selfPlayer.id, {
        type: 'CATAN_PLACE_INITIAL_SETTLEMENT',
        vertexId,
      });
      return;
    }

    if (isMyTurn && view.turnStep === 'SELECT_CITY_UPGRADE') {
      if (vertex.ownerId === selfPlayer.id && vertex.building === 'settlement') {
        onDispatchAction(selfPlayer.id, {
          type: 'CATAN_UPGRADE_CITY',
          vertexId,
        });
      }
      return;
    }

    if (isMyTurn && view.turnStep === 'MAIN_PHASE') {
      // If clicking valid empty settlement spot and affordable, build Settlement
      if (
        validMainPhaseVertices.has(vertexId) &&
        selfPlayer.resources.WOOD >= 1 &&
        selfPlayer.resources.BRICK >= 1 &&
        selfPlayer.resources.SHEEP >= 1 &&
        selfPlayer.resources.WHEAT >= 1 &&
        selfPlayer.settlementsRemaining > 0
      ) {
        onDispatchAction(selfPlayer.id, {
          type: 'CATAN_BUILD_SETTLEMENT',
          vertexId,
        });
      }
    }
  };

  const handleEdgeClick = (edgeId: string) => {
    setSelectedEdgeId(edgeId);
    if (isControlsLocked || pendingAction || !isMyTurn) return;

    if (
      (view.turnStep === 'SETUP_ROAD_1' || view.turnStep === 'SETUP_ROAD_2') &&
      validRoadEdges.has(edgeId)
    ) {
      onDispatchAction(selfPlayer.id, {
        type: 'CATAN_PLACE_INITIAL_ROAD',
        edgeId,
      });
      return;
    }

    if (
      (view.turnStep === 'MAIN_PHASE' || view.freeRoadsRemaining > 0) &&
      validRoadEdges.has(edgeId) &&
      (view.freeRoadsRemaining > 0 ||
        (selfPlayer.resources.WOOD >= 1 && selfPlayer.resources.BRICK >= 1))
    ) {
      onDispatchAction(selfPlayer.id, {
        type: 'CATAN_BUILD_ROAD',
        edgeId,
      });
    }
  };

  const maritimeRate = getPlayerMaritimeTradeRate(
    view.board,
    selfPlayer.id,
    tradeGive
  );

  return (
    <div className="flex-1 flex flex-col min-w-0 min-h-0">
      {/* =====================================================================
          TOP ROW: LEFT PUBLIC PLAYER INFO SIDEBAR + CENTER HEX ISLAND PLAY MAT
         ===================================================================== */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* LEFT-HAND SIDE PLAYER PUBLIC INFORMATION DISPLAY */}
        <aside className="w-76 shrink-0 bg-slate-900/95 border-r border-slate-800 p-3 flex flex-col gap-2.5 overflow-y-auto z-20">
          <div className="border-b border-slate-800 pb-2 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-amber-300 block">
                Settlers Public Breakdown
              </span>
              <span className="text-[11px] text-slate-400">
                Resources, Dev Cards, Pieces &amp; Awards
              </span>
            </div>
            <span className="px-2 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-[10px] font-bold">
              Goal: 10 VP
            </span>
          </div>

          <div className="space-y-2.5">
            {view.playerOrder.map((pid) => {
              const isSelf = pid === selfPlayer.id;
              const isTurn = pid === view.activePlayerId;
              const opp = view.opponents[pid];
              const palette = getPlayerPalette(pid, view.playerOrder);

              const resourceCardCount = isSelf
                ? ALL_CATAN_RESOURCES.reduce(
                    (sum, r) => sum + selfPlayer.resources[r],
                    0
                  )
                : opp?.totalResourceCards ?? 0;
              const devCardCount = isSelf
                ? selfPlayer.devCards.length
                : opp?.developmentCardCount ?? 0;
              const faceUpKnights = isSelf
                ? selfPlayer.faceUpKnights
                : opp?.faceUpKnights ?? 0;
              const settlementsRemaining = isSelf
                ? selfPlayer.settlementsRemaining
                : opp?.settlementsRemaining ?? 5;
              const citiesRemaining = isSelf
                ? selfPlayer.citiesRemaining
                : opp?.citiesRemaining ?? 4;
              const roadsRemaining = isSelf
                ? selfPlayer.roadsRemaining
                : opp?.roadsRemaining ?? 15;
              const longestRoadLen = isSelf
                ? selfPlayer.longestRoadLength
                : opp?.longestRoadLength ?? 0;
              const hasLongestRoad = isSelf
                ? selfPlayer.hasLongestRoad
                : Boolean(opp?.hasLongestRoad);
              const hasLargestArmy = isSelf
                ? selfPlayer.hasLargestArmy
                : Boolean(opp?.hasLargestArmy);
              const vp = isSelf
                ? selfPlayer.victoryPoints
                : opp?.victoryPoints ?? 0;

              return (
                <div
                  key={pid}
                  className={`rounded-xl border p-2.5 transition-all ${
                    isTurn
                      ? 'bg-slate-950 border-amber-400/90 shadow-[0_0_14px_rgba(251,191,36,0.18)]'
                      : 'bg-slate-950/75 border-slate-800'
                  }`}
                >
                  {/* Player Header */}
                  <div className="flex items-center justify-between gap-2 pb-1.5 border-b border-slate-800/90">
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className="w-3.5 h-3.5 rounded-full shrink-0 border"
                        style={{
                          backgroundColor: palette.fillHex,
                          borderColor: palette.strokeHex,
                        }}
                      />
                      <span className="font-bold text-xs text-slate-100 truncate">
                        {formatPlayerLabel(pid)}
                      </span>
                      {isSelf && (
                        <span className="px-1.5 py-0.2 rounded bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 text-[9px] font-black uppercase">
                          You
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {isTurn && (
                        <span className="px-1.5 py-0.5 rounded bg-amber-500 text-slate-950 font-black text-[9px] uppercase">
                          ⚡ Turn
                        </span>
                      )}
                      <span className="px-2 py-0.5 rounded bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 font-mono font-bold text-xs">
                        ★ {vp} VP
                      </span>
                    </div>
                  </div>

                  {/* Public Stats Grid */}
                  <div className="grid grid-cols-2 gap-1.5 mt-2 text-[11px]">
                    <div className="bg-slate-900/90 border border-slate-800 rounded-lg px-2 py-1 flex items-center justify-between">
                      <span className="text-slate-400">🌾 Resources</span>
                      <span className="font-mono font-bold text-slate-100">
                        {resourceCardCount}
                      </span>
                    </div>
                    <div className="bg-slate-900/90 border border-slate-800 rounded-lg px-2 py-1 flex items-center justify-between">
                      <span className="text-slate-400">📜 Dev Cards</span>
                      <span className="font-mono font-bold text-purple-300">
                        {devCardCount}
                      </span>
                    </div>
                    <div className="bg-slate-900/90 border border-slate-800 rounded-lg px-2 py-1 flex items-center justify-between">
                      <span className="text-slate-400">⚔️ Knights Up</span>
                      <span className="font-mono font-bold text-rose-300">
                        {faceUpKnights}
                      </span>
                    </div>
                    <div className="bg-slate-900/90 border border-slate-800 rounded-lg px-2 py-1 flex items-center justify-between">
                      <span className="text-slate-400">📏 Longest Rd</span>
                      <span className="font-mono font-bold text-amber-300">
                        {longestRoadLen} seg
                      </span>
                    </div>
                  </div>

                  {/* Remaining Pieces Supply */}
                  <div className="mt-1.5 bg-slate-900/70 border border-slate-800/80 rounded-lg px-2 py-1 flex items-center justify-between text-[10px] text-slate-300 font-mono">
                    <span title="Remaining Settlements">
                      🏠 {settlementsRemaining}/5
                    </span>
                    <span title="Remaining Cities">
                      🏛️ {citiesRemaining}/4
                    </span>
                    <span title="Remaining Road Segments">
                      🛣️ {roadsRemaining}/15
                    </span>
                  </div>

                  {/* Longest Road & Largest Army Status Badges */}
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                        hasLongestRoad
                          ? 'bg-amber-500/25 border-amber-400 text-amber-200'
                          : 'bg-slate-900/60 border-slate-800 text-slate-500'
                      }`}
                    >
                      🛣️ Longest Road: {hasLongestRoad ? '★ HOLDER (+2 VP)' : 'No'}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                        hasLargestArmy
                          ? 'bg-rose-500/25 border-rose-400 text-rose-200'
                          : 'bg-slate-900/60 border-slate-800 text-slate-500'
                      }`}
                    >
                      ⚔️ Largest Army: {hasLargestArmy ? '★ HOLDER (+2 VP)' : 'No'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </aside>

        {/* CENTER HEX ISLAND SVG PLAY MAT AREA */}
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
              x="28"
              y="34"
              fill="#7dd3fc"
              fontSize="11"
              fontWeight="800"
              letterSpacing="0.08em"
            >
              ISLAND OF CATAN • SEED: {view.board.seed} • CLICK CORNERS FOR
              SETTLEMENTS/CITIES &amp; EDGES FOR ROADS
            </text>

            {/* 1. Render 19 Hex Tiles */}
            <g>
              {Object.values(view.board.hexes).map((hexNode) => {
                const upperTerrain =
                  hexNode.terrain.toUpperCase() as CatanTerrain;
                const theme = TERRAIN_THEMES[upperTerrain];
                const isSelected = hexNode.id === selectedHexId;
                const isHotRoll =
                  lastRollSum !== null &&
                  hexNode.numberToken === lastRollSum &&
                  !hexNode.hasRobber;
                const isHighProb =
                  hexNode.numberToken === 6 || hexNode.numberToken === 8;

                const cornerPoints = hexNode.vertexIds
                  .map((vid) => {
                    const v = view.board.vertices[vid]!;
                    const pt = toSvgCoords(v.x, v.y);
                    return `${pt.x.toFixed(1)},${pt.y.toFixed(1)}`;
                  })
                  .join(' ');

                const center = toSvgCoords(
                  Math.sqrt(3) * (hexNode.q + hexNode.r / 2),
                  1.5 * hexNode.r
                );

                return (
                  <g
                    key={hexNode.id}
                    onClick={() => {
                      setSelectedHexId(hexNode.id);
                      if (
                        isMyTurn &&
                        !isControlsLocked &&
                        !pendingAction &&
                        view.turnStep === 'MOVE_ROBBER' &&
                        hexNode.id !== view.board.robberHexId
                      ) {
                        onDispatchAction(selfPlayer.id, {
                          type: 'CATAN_MOVE_ROBBER',
                          targetHexId: hexNode.id,
                        });
                      }
                    }}
                    className="cursor-pointer"
                  >
                    <polygon
                      points={cornerPoints}
                      fill={theme.fill}
                      stroke={
                        view.turnStep === 'MOVE_ROBBER' &&
                        hexNode.id !== view.board.robberHexId
                          ? '#f43f5e'
                          : isSelected
                          ? '#fbbf24'
                          : isHotRoll
                          ? '#34d399'
                          : theme.stroke
                      }
                      strokeWidth={
                        view.turnStep === 'MOVE_ROBBER' ||
                        isSelected ||
                        isHotRoll
                          ? 3.5
                          : 2
                      }
                    />

                    {/* Terrain Icon */}
                    <text
                      x={center.x}
                      y={center.y - 16}
                      textAnchor="middle"
                      dominantBaseline="central"
                      fontSize="15"
                    >
                      {theme.icon}
                    </text>

                    {/* Number Token & Letter */}
                    {hexNode.numberToken !== null && (
                      <g transform={`translate(${center.x}, ${center.y + 8})`}>
                        <circle
                          r="15"
                          fill={isHotRoll ? '#10b981' : '#fef3c7'}
                          stroke="#0f172a"
                          strokeWidth="2"
                        />
                        <text
                          y="-2"
                          textAnchor="middle"
                          dominantBaseline="central"
                          fill={isHighProb ? '#dc2626' : '#0f172a'}
                          fontSize="12"
                          fontWeight="900"
                        >
                          {hexNode.numberToken}
                        </text>
                        {hexNode.tokenLetter && (
                          <text
                            y="8"
                            textAnchor="middle"
                            dominantBaseline="central"
                            fill="#475569"
                            fontSize="7"
                            fontWeight="800"
                          >
                            {hexNode.tokenLetter}
                          </text>
                        )}
                      </g>
                    )}

                    {/* Robber Pawn */}
                    {hexNode.hasRobber && (
                      <g
                        transform={`translate(${center.x + 18}, ${
                          center.y - 14
                        })`}
                      >
                        <circle
                          r="11"
                          fill="#1e293b"
                          stroke="#f59e0b"
                          strokeWidth="2"
                        />
                        <text
                          textAnchor="middle"
                          dominantBaseline="central"
                          fill="#fde68a"
                          fontSize="10"
                          fontWeight="900"
                        >
                          🦹
                        </text>
                      </g>
                    )}
                  </g>
                );
              })}
            </g>

            {/* 2. Render 72 Edges (Road Segments) */}
            <g>
              {Object.values(view.board.edges).map((edge) => {
                const v1 = view.board.vertices[edge.endpointVertexIds[0]]!;
                const v2 = view.board.vertices[edge.endpointVertexIds[1]]!;
                const p1 = toSvgCoords(v1.x, v1.y);
                const p2 = toSvgCoords(v2.x, v2.y);
                const isSelectableRoad = isMyTurn && validRoadEdges.has(edge.id);
                const isSelectedEdge = selectedEdgeId === edge.id;

                if (edge.ownerId) {
                  const palette = getPlayerPalette(
                    edge.ownerId,
                    view.playerOrder
                  );
                  return (
                    <g key={edge.id} onClick={() => handleEdgeClick(edge.id)}>
                      <line
                        x1={p1.x}
                        y1={p1.y}
                        x2={p2.x}
                        y2={p2.y}
                        stroke="#020617"
                        strokeWidth="10"
                        strokeLinecap="round"
                      />
                      <line
                        x1={p1.x}
                        y1={p1.y}
                        x2={p2.x}
                        y2={p2.y}
                        stroke={palette.fillHex}
                        strokeWidth="6.5"
                        strokeLinecap="round"
                      />
                    </g>
                  );
                }

                return (
                  <g
                    key={edge.id}
                    onClick={() => handleEdgeClick(edge.id)}
                    className={isSelectableRoad ? 'cursor-pointer' : ''}
                  >
                    <line
                      x1={p1.x}
                      y1={p1.y}
                      x2={p2.x}
                      y2={p2.y}
                      stroke={
                        isSelectableRoad
                          ? '#38bdf8'
                          : isSelectedEdge
                          ? '#fbbf24'
                          : 'rgba(148, 163, 184, 0.22)'
                      }
                      strokeWidth={isSelectableRoad ? 7 : 4}
                      strokeDasharray={isSelectableRoad ? '4 2' : undefined}
                      strokeLinecap="round"
                    />
                  </g>
                );
              })}
            </g>

            {/* 3. Render 54 Hex Corners (Vertices: Settlements, Cities, Harbors & Placement Spots) */}
            <g>
              {Object.values(view.board.vertices).map((vertex) => {
                const pt = toSvgCoords(vertex.x, vertex.y);
                const isInitialSpot =
                  isMyTurn && validInitialVertices.has(vertex.id);
                const isMainBuildSpot =
                  isMyTurn && validMainPhaseVertices.has(vertex.id);
                const isSelectedVertex = selectedVertexId === vertex.id;

                return (
                  <g
                    key={vertex.id}
                    transform={`translate(${pt.x}, ${pt.y})`}
                    onClick={() => handleVertexClick(vertex.id)}
                    className="cursor-pointer"
                  >
                    {/* Coastal Harbor Tag if present */}
                    {vertex.harbor && !vertex.building && (
                      <text
                        y="-10"
                        textAnchor="middle"
                        fill="#7dd3fc"
                        fontSize="7.5"
                        fontWeight="800"
                      >
                        ⚓{vertex.harbor}
                      </text>
                    )}

                    {vertex.building && vertex.ownerId ? (
                      (() => {
                        const palette = getPlayerPalette(
                          vertex.ownerId,
                          view.playerOrder
                        );
                        const isCity = vertex.building === 'city';
                        const isUpgradeableTarget =
                          isMyTurn &&
                          view.turnStep === 'SELECT_CITY_UPGRADE' &&
                          vertex.ownerId === selfPlayer.id &&
                          vertex.building === 'settlement';
                        return (
                          <g>
                            {isUpgradeableTarget && (
                              <circle
                                r="14"
                                fill="none"
                                stroke="#38bdf8"
                                strokeWidth="3"
                                strokeDasharray="3 2"
                              />
                            )}
                            {isCity ? (
                              <rect
                                x="-10"
                                y="-10"
                                width="20"
                                height="20"
                                rx="4"
                                fill={palette.fillHex}
                                stroke="#020617"
                                strokeWidth="2.5"
                              />
                            ) : (
                              <polygon
                                points="0,-10 9,-2 7,9 -7,9 -9,-2"
                                fill={palette.fillHex}
                                stroke={isUpgradeableTarget ? '#38bdf8' : '#020617'}
                                strokeWidth="2.2"
                              />
                            )}
                            <text
                              textAnchor="middle"
                              dominantBaseline="central"
                              fill="#020617"
                              fontSize="8.5"
                              fontWeight="900"
                            >
                              {isCity ? '🏛' : '🏠'}
                            </text>
                          </g>
                        );
                      })()
                    ) : isInitialSpot || isMainBuildSpot ? (
                      <circle
                        r={isInitialSpot ? 7.5 : 6.5}
                        fill={isInitialSpot ? '#10b981' : '#f59e0b'}
                        fillOpacity="0.88"
                        stroke="#ecfdf5"
                        strokeWidth="2"
                      />
                    ) : (
                      <circle
                        r={isSelectedVertex ? 5 : 3.2}
                        fill={
                          isSelectedVertex
                            ? '#fbbf24'
                            : 'rgba(226, 232, 240, 0.35)'
                        }
                      />
                    )}
                  </g>
                );
              })}
            </g>
          </svg>

          {/* TOP-LEFT SPECIAL AWARD BOARDS: LARGEST ARMY (+2 VP) & LONGEST ROAD (+2 VP) */}
          <div className="absolute top-3 left-3 flex flex-col gap-2 w-64 z-10 pointer-events-none">
            {/* Largest Army Board */}
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-rose-950/95 via-slate-900/95 to-amber-950/90 border-2 border-rose-400/70 shadow-xl backdrop-blur-md text-xs">
              <div className="flex items-center justify-between">
                <span className="font-black uppercase tracking-wider text-rose-200 text-[11px]">
                  ⚔️ Largest Army Board
                </span>
                <span className="px-2 py-0.5 rounded-full bg-amber-400 text-slate-950 font-black text-[10px]">
                  +2 VP
                </span>
              </div>
              <p className="text-[10px] text-rose-100/80 mt-0.5">
                First to 3 face-up Knights (taken if exceeded).
              </p>
              <div className="mt-1.5 px-2 py-1 rounded bg-slate-950/80 border border-rose-500/40 flex items-center justify-between text-[11px]">
                <span className="text-slate-300 font-semibold">Holder:</span>
                <span className="font-bold text-amber-300">
                  {view.largestArmyOwnerId
                    ? `${formatPlayerLabel(view.largestArmyOwnerId)} (${
                        view.largestArmySize
                      } Knights)`
                    : 'Unclaimed (Need 3)'}
                </span>
              </div>
            </div>

            {/* Longest Road Board */}
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-amber-950/95 via-slate-900/95 to-emerald-950/90 border-2 border-amber-400/70 shadow-xl backdrop-blur-md text-xs">
              <div className="flex items-center justify-between">
                <span className="font-black uppercase tracking-wider text-amber-200 text-[11px]">
                  🛣️ Longest Road Board
                </span>
                <span className="px-2 py-0.5 rounded-full bg-amber-400 text-slate-950 font-black text-[10px]">
                  +2 VP
                </span>
              </div>
              <p className="text-[10px] text-amber-100/80 mt-0.5">
                First to 5 continuous roads (taken if exceeded).
              </p>
              <div className="mt-1.5 px-2 py-1 rounded bg-slate-950/80 border border-amber-500/40 flex items-center justify-between text-[11px]">
                <span className="text-slate-300 font-semibold">Holder:</span>
                <span className="font-bold text-emerald-300">
                  {view.longestRoadOwnerId
                    ? `${formatPlayerLabel(view.longestRoadOwnerId)} (${
                        view.longestRoadLength
                      } Segments)`
                    : 'Unclaimed (Need 5)'}
                </span>
              </div>
            </div>
          </div>

          {/* SETUP INSTRUCTIONS BANNER (When in Snake-Draft Setup) */}
          {view.turnStep.startsWith('SETUP_') && (
            <div className="absolute top-3 right-3 max-w-xs bg-amber-950/95 border-2 border-amber-400 rounded-2xl p-3.5 shadow-2xl text-xs space-y-1.5">
              <div className="font-black uppercase tracking-wider text-amber-300 text-[11px]">
                🏗️ Snake-Draft Initial Setup ({view.turnStep})
              </div>
              <p className="text-amber-100 text-[11px] leading-relaxed">
                {view.turnStep === 'SETUP_SETTLEMENT_1' &&
                  `${formatPlayerLabel(
                    view.activePlayerId
                  )}: Click any highlighted green hex corner (at least 2 segments away) to place your 1st Settlement.`}
                {view.turnStep === 'SETUP_ROAD_1' &&
                  `${formatPlayerLabel(
                    view.activePlayerId
                  )}: Click any highlighted blue edge connected to your 1st Settlement to place your 1st Road.`}
                {view.turnStep === 'SETUP_SETTLEMENT_2' &&
                  `${formatPlayerLabel(
                    view.activePlayerId
                  )} (Reverse Order): Click a highlighted green hex corner to place your 2nd Settlement and gain 1 of each adjoining hex resource!`}
                {view.turnStep === 'SETUP_ROAD_2' &&
                  `${formatPlayerLabel(
                    view.activePlayerId
                  )}: Click a highlighted blue edge connected to your 2nd Settlement to place your 2nd Road.`}
              </p>
            </div>
          )}

          {/* CITY UPGRADE BOARD SELECTION BANNER */}
          {view.turnStep === 'SELECT_CITY_UPGRADE' && (
            <div className="absolute top-3 right-3 max-w-xs bg-sky-950/95 border-2 border-sky-400 rounded-2xl p-3.5 shadow-2xl text-xs space-y-1.5 z-30">
              <div className="font-black uppercase tracking-wider text-sky-300 text-[11px]">
                🏛️ Select Settlement to Upgrade
              </div>
              <p className="text-sky-100 text-[11px] leading-relaxed">
                Payment of 2 Wheat + 3 Ore received!{' '}
                <strong>{formatPlayerLabel(view.activePlayerId)}</strong>, click
                on one of your highlighted Settlements on the board to upgrade
                it to a City!
              </p>
            </div>
          )}

          {/* MOVE ROBBER BANNER */}
          {view.turnStep === 'MOVE_ROBBER' && (
            <div className="absolute top-3 right-3 max-w-xs bg-rose-950/95 border-2 border-rose-400 rounded-2xl p-3.5 shadow-2xl text-xs space-y-1.5 z-30">
              <div className="font-black uppercase tracking-wider text-rose-300 text-[11px]">
                🦹 Move the Robber
              </div>
              <p className="text-rose-100 text-[11px] leading-relaxed">
                <strong>{formatPlayerLabel(view.activePlayerId)}</strong>: Click
                any hex on the board (highlighted in red) to move the Robber to
                that hex!
              </p>
            </div>
          )}

          {/* DISCARD ON 7 MODAL (Players with >= 8 Resource Cards Discard Half Rounding Down) */}
          {view.turnStep === 'DISCARD_ON_SEVEN' && (
            <div className="absolute inset-x-8 top-14 max-w-xl mx-auto bg-slate-900/98 border-2 border-rose-500 rounded-2xl p-4 shadow-2xl z-30 text-xs space-y-3">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <span className="font-black uppercase tracking-wider text-rose-300 text-xs">
                  🎲 7 Rolled! Players with 8+ Cards Must Discard Half (Rounding Down)
                </span>
              </div>

              <div className="space-y-2">
                {Object.entries(view.pendingDiscards).map(([pid, reqCount]) => {
                  const isSelfDiscard = pid === selfPlayer.id;
                  const currentSum = ALL_CATAN_RESOURCES.reduce(
                    (s, r) => s + discardAmounts[r],
                    0
                  );
                  return (
                    <div
                      key={pid}
                      className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-100">
                          {formatPlayerLabel(pid)} must discard{' '}
                          <strong className="text-rose-400">{reqCount}</strong>{' '}
                          card(s)
                        </span>
                        {isSelfDiscard && (
                          <span className="font-mono text-[11px] text-amber-300">
                            Selected: {currentSum} / {reqCount}
                          </span>
                        )}
                      </div>

                      {isSelfDiscard && (
                        <div className="space-y-2">
                          <div className="flex flex-wrap gap-2">
                            {ALL_CATAN_RESOURCES.map((r) => (
                              <label
                                key={`disc_${r}`}
                                className="flex items-center gap-1 bg-slate-900 px-2 py-1 rounded border border-slate-700 text-[11px]"
                              >
                                <span>
                                  {TERRAIN_THEMES[r].icon} {r} (Have{' '}
                                  {selfPlayer.resources[r]}):
                                </span>
                                <input
                                  type="number"
                                  min={0}
                                  max={selfPlayer.resources[r]}
                                  value={discardAmounts[r]}
                                  onChange={(e) =>
                                    setDiscardAmounts((prev) => ({
                                      ...prev,
                                      [r]: Math.max(
                                        0,
                                        Math.min(
                                          selfPlayer.resources[r],
                                          Number(e.target.value) || 0
                                        )
                                      ),
                                    }))
                                  }
                                  className="w-10 bg-slate-950 border border-slate-700 rounded px-1 text-center font-mono text-white"
                                />
                              </label>
                            ))}
                          </div>
                          <button
                            type="button"
                            disabled={currentSum !== reqCount}
                            onClick={() => {
                              onDispatchAction(selfPlayer.id, {
                                type: 'CATAN_DISCARD_RESOURCES',
                                resources: discardAmounts,
                              });
                              setDiscardAmounts(createZeroBundle());
                            }}
                            className="px-3.5 py-1.5 rounded-lg bg-rose-500 hover:bg-rose-400 disabled:opacity-40 text-slate-950 font-black text-xs"
                          >
                            Confirm Discard ({currentSum}/{reqCount})
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* SELECT ROBBER VICTIM MODAL */}
          {view.turnStep === 'SELECT_ROBBER_VICTIM' && (
            <div className="absolute inset-x-8 top-16 max-w-md mx-auto bg-slate-900/98 border-2 border-amber-400 rounded-2xl p-4 shadow-2xl z-30 text-xs space-y-3">
              <div className="font-black uppercase tracking-wider text-amber-300 text-xs border-b border-slate-800 pb-2">
                🦹 Select Player on Robber Hex to Steal From
              </div>
              <p className="text-slate-300 text-[11px]">
                Select a player who has a settlement or city on the Robber hex:
              </p>
              <div className="grid grid-cols-1 gap-2">
                {view.robberEligibleVictimIds.map((vid) => {
                  const oppCards =
                    view.opponents[vid]?.totalResourceCards ?? 0;
                  return (
                    <button
                      key={vid}
                      type="button"
                      disabled={!isMyTurn || isControlsLocked}
                      onClick={() =>
                        onDispatchAction(selfPlayer.id, {
                          type: 'CATAN_SELECT_ROBBER_VICTIM',
                          victimPlayerId: vid,
                        })
                      }
                      className="p-2.5 rounded-xl bg-slate-950 hover:bg-slate-800 border border-amber-500/50 flex items-center justify-between font-bold text-slate-100 transition"
                    >
                      <span>{formatPlayerLabel(vid)}</span>
                      <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-mono text-[11px]">
                        {oppCards} Resource Card(s)
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* SHUFFLED RESOURCE CARD STEAL DISPLAY */}
          {view.turnStep === 'STEAL_ROBBER_CARD' && view.robberVictimId && (
            <div className="absolute inset-x-8 top-16 max-w-lg mx-auto bg-slate-900/98 border-2 border-emerald-400 rounded-2xl p-4 shadow-2xl z-30 text-xs space-y-3">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <span className="font-black uppercase tracking-wider text-emerald-300 text-xs">
                  🃏 Pick 1 Card from {formatPlayerLabel(view.robberVictimId)}&apos;s Shuffled Hand
                </span>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400 text-emerald-200 font-mono font-black text-[11px]">
                  Picking from {view.robberVictimCardCount} Card(s)
                </span>
              </div>
              <p className="text-slate-300 text-[11px]">
                {formatPlayerLabel(view.robberVictimId)}&apos;s{' '}
                <strong>{view.robberVictimCardCount}</strong> resource cards have
                been shuffled face-down. Click any card below to steal it!
              </p>
              <div className="flex flex-wrap items-center justify-center gap-2.5 py-2">
                {Array.from(
                  { length: view.robberVictimCardCount },
                  (_, idx) => (
                    <button
                      key={idx}
                      type="button"
                      disabled={!isMyTurn || isControlsLocked}
                      onClick={() =>
                        onDispatchAction(selfPlayer.id, {
                          type: 'CATAN_STEAL_CARD',
                          cardIndex: idx,
                        })
                      }
                      className="w-16 h-24 rounded-xl bg-gradient-to-br from-amber-700 via-amber-900 to-slate-950 hover:from-emerald-600 hover:to-emerald-900 border-2 border-amber-400 hover:border-emerald-300 shadow-lg flex flex-col items-center justify-center gap-1 transition transform hover:-translate-y-1 cursor-pointer disabled:opacity-50"
                    >
                      <span className="text-lg">🌾</span>
                      <span className="font-mono font-black text-[10px] text-amber-200">
                        Card #{idx + 1}
                      </span>
                    </button>
                  )
                )}
              </div>
            </div>
          )}

          {/* BOTTOM-RIGHT PICTURE OF THE DICE ROLL RESULTS + ALL STARTING PLAYER ROLLS */}
          <div className="absolute bottom-3 right-3 bg-slate-900/95 border-2 border-amber-500/70 rounded-2xl p-3 shadow-2xl backdrop-blur-md text-xs w-72 space-y-2 z-10">
            <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
              <span className="font-black uppercase tracking-wider text-amber-300 text-[11px]">
                🎲 Dice Roll Results
              </span>
              {view.lastDiceRoll && (
                <span className="px-2 py-0.5 rounded-full bg-amber-400 text-slate-950 font-mono font-black text-xs">
                  Sum: {view.lastDiceRoll[0] + view.lastDiceRoll[1]}
                </span>
              )}
            </div>

            {view.lastDiceRoll ? (
              <div className="flex items-center justify-center gap-3 py-1">
                <DieFaceVisual
                  value={view.lastDiceRoll[0]}
                  isHotSeven={
                    view.lastDiceRoll[0] + view.lastDiceRoll[1] === 7
                  }
                />
                <span className="text-lg font-black text-amber-300">+</span>
                <DieFaceVisual
                  value={view.lastDiceRoll[1]}
                  isHotSeven={
                    view.lastDiceRoll[0] + view.lastDiceRoll[1] === 7
                  }
                />
                <span className="text-lg font-black text-emerald-300">
                  = {view.lastDiceRoll[0] + view.lastDiceRoll[1]}
                </span>
              </div>
            ) : (
              <div className="text-center py-3 text-slate-400 italic">
                Roll the dice to view result
              </div>
            )}

            {/* Display the results of all starting player rolls */}
            {Object.keys(view.startingRolls).length > 0 && (
              <div className="text-[10px] text-slate-300 border-t border-slate-800/80 pt-1.5 space-y-1">
                <div className="font-black uppercase tracking-wider text-amber-300 text-[9px] flex items-center justify-between">
                  <span>All Starting Player Rolls:</span>
                  {view.startingPlayerId && (
                    <span className="text-emerald-300">
                      ★ 1st: {formatPlayerLabel(view.startingPlayerId)}
                    </span>
                  )}
                </div>
                <div className="space-y-0.5">
                  {view.playerOrder.map((pid) => {
                    const roll = view.startingRolls[pid];
                    if (!roll) return null;
                    const isStarter = pid === view.startingPlayerId;
                    return (
                      <div
                        key={`start_roll_${pid}`}
                        className={`flex items-center justify-between px-1.5 py-0.5 rounded ${
                          isStarter
                            ? 'bg-amber-500/20 border border-amber-500/40 text-amber-200 font-bold'
                            : 'bg-slate-950/60 text-slate-400'
                        }`}
                      >
                        <span className="truncate">
                          {isStarter ? '★ ' : ''}
                          {formatPlayerLabel(pid)}
                        </span>
                        <span className="font-mono">
                          🎲 {roll[0]} + {roll[1]} = {roll[0] + roll[1]}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* ACTIVE PLAYER-TO-PLAYER TRADE NEGOTIATION OVERLAY */}
          {view.activeTrade && (
            <div className="absolute inset-x-6 bottom-4 max-w-3xl mx-auto bg-slate-900/98 border-2 border-cyan-400 rounded-2xl p-4 shadow-2xl z-30 text-xs space-y-3">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <div>
                  <span className="px-2 py-0.5 rounded bg-cyan-500/20 border border-cyan-400 text-cyan-200 font-black text-[10px] uppercase">
                    🤝 Active Trade Negotiation ({view.activeTrade.phase})
                  </span>
                  <h3 className="font-black text-sm text-slate-100 mt-1">
                    {formatPlayerLabel(view.activeTrade.initiatorId)} offers{' '}
                    <span className="text-emerald-300">
                      {formatBundleText(view.activeTrade.initialOffered)}
                    </span>{' '}
                    for{' '}
                    <span className="text-amber-300">
                      {formatBundleText(view.activeTrade.initialRequested)}
                    </span>
                  </h3>
                </div>
                {selfPlayer.id === view.activeTrade.initiatorId && (
                  <button
                    type="button"
                    onClick={() =>
                      onDispatchAction(selfPlayer.id, {
                        type: 'CATAN_CANCEL_TRADE',
                      })
                    }
                    className="px-2.5 py-1 rounded-lg bg-rose-950/80 hover:bg-rose-900 border border-rose-500/60 text-rose-200 font-bold text-[11px]"
                  >
                    ✕ Cancel Trade
                  </button>
                )}
              </div>

              {/* Branches Status & Controls */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {Object.values(view.activeTrade.branches).map((branch) => {
                  const isMyBranch = selfPlayer.id === branch.opponentId;
                  const isActiveInitiator =
                    selfPlayer.id === view.activeTrade?.initiatorId;

                  return (
                    <div
                      key={branch.opponentId}
                      className="p-3 rounded-xl bg-slate-950/90 border border-slate-800 space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-100">
                          {formatPlayerLabel(branch.opponentId)}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-full font-black text-[9px] uppercase ${
                            branch.status === 'OPPONENT_ACCEPTED'
                              ? 'bg-emerald-500/20 border border-emerald-400 text-emerald-300'
                              : branch.status === 'OPPONENT_COUNTERED'
                              ? 'bg-amber-500/20 border border-amber-400 text-amber-300'
                              : branch.status === 'DECLINED'
                              ? 'bg-rose-500/20 border border-rose-400 text-rose-300'
                              : 'bg-slate-800 text-slate-300'
                          }`}
                        >
                          {branch.status}
                        </span>
                      </div>

                      <div className="text-[11px] text-slate-300">
                        <div>
                          Active Gives:{' '}
                          <strong className="text-emerald-300">
                            {formatBundleText(branch.activeGives)}
                          </strong>
                        </div>
                        <div>
                          {formatPlayerLabel(branch.opponentId)} Gives:{' '}
                          <strong className="text-amber-300">
                            {formatBundleText(branch.opponentGives)}
                          </strong>
                        </div>
                      </div>

                      {/* Opponent Controls when AWAITING_OPPONENTS */}
                      {view.activeTrade?.phase === 'AWAITING_OPPONENTS' &&
                        (isMyBranch || !isControlsLocked) &&
                        branch.status === 'AWAITING_OPPONENT' && (
                          <div className="space-y-2 pt-1 border-t border-slate-800">
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() =>
                                  onDispatchAction(branch.opponentId, {
                                    type: 'CATAN_RESPOND_TRADE',
                                    response: 'ACCEPT',
                                  })
                                }
                                className="px-2.5 py-1 rounded bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-[11px]"
                              >
                                ✓ Accept
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  setCounteringTargetId(
                                    counteringTargetId === branch.opponentId
                                      ? null
                                      : branch.opponentId
                                  )
                                }
                                className="px-2.5 py-1 rounded bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-[11px]"
                              >
                                ⇄ Counter
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  onDispatchAction(branch.opponentId, {
                                    type: 'CATAN_RESPOND_TRADE',
                                    response: 'DECLINE',
                                  })
                                }
                                className="px-2.5 py-1 rounded bg-rose-600 hover:bg-rose-500 text-white font-black text-[11px]"
                              >
                                ✕ Decline
                              </button>
                            </div>
                          </div>
                        )}

                      {/* Active Player Controls when AWAITING_ACTIVE_PLAYER */}
                      {view.activeTrade?.phase === 'AWAITING_ACTIVE_PLAYER' &&
                        isActiveInitiator &&
                        (branch.status === 'OPPONENT_ACCEPTED' ||
                          branch.status === 'OPPONENT_COUNTERED') && (
                          <div className="flex items-center gap-1.5 pt-1 border-t border-slate-800">
                            <button
                              type="button"
                              onClick={() =>
                                onDispatchAction(selfPlayer.id, {
                                  type: 'CATAN_RESPOND_TRADE',
                                  response: 'ACCEPT',
                                  targetOpponentId: branch.opponentId,
                                })
                              }
                              className="px-2.5 py-1 rounded bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-[11px]"
                            >
                              ✓ Accept Offer
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setCounteringTargetId(
                                  counteringTargetId === branch.opponentId
                                    ? null
                                    : branch.opponentId
                                )
                              }
                              className="px-2.5 py-1 rounded bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-[11px]"
                            >
                              ⇄ Counter
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                onDispatchAction(selfPlayer.id, {
                                  type: 'CATAN_RESPOND_TRADE',
                                  response: 'DECLINE',
                                  targetOpponentId: branch.opponentId,
                                })
                              }
                              className="px-2.5 py-1 rounded bg-rose-600 hover:bg-rose-500 text-white font-black text-[11px]"
                            >
                              ✕ Decline
                            </button>
                          </div>
                        )}
                    </div>
                  );
                })}
              </div>

              {/* Counter-Offer Editor */}
              {counteringTargetId && (
                <div className="p-3 rounded-xl bg-slate-950 border border-amber-400/60 space-y-2">
                  <div className="font-bold text-amber-300 text-[11px]">
                    Build Counter-Proposal (You Offer vs You Request):
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <span className="text-[10px] text-slate-400 block mb-1">
                        You Give (Max = Your Hand):
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {ALL_CATAN_RESOURCES.map((r) => (
                          <label
                            key={`cg_${r}`}
                            className="flex items-center gap-1 bg-slate-900 px-1.5 py-1 rounded border border-slate-800 text-[10px]"
                          >
                            <span>{r}:</span>
                            <input
                              type="number"
                              min={0}
                              max={selfPlayer.resources[r]}
                              value={counterGiveAmounts[r]}
                              onChange={(e) =>
                                setCounterGiveAmounts((prev) => ({
                                  ...prev,
                                  [r]: Math.max(
                                    0,
                                    Math.min(
                                      selfPlayer.resources[r],
                                      Number(e.target.value) || 0
                                    )
                                  ),
                                }))
                              }
                              className="w-10 bg-slate-950 border border-slate-700 rounded px-1 text-center font-mono"
                            />
                          </label>
                        ))}
                      </div>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block mb-1">
                        You Ask For:
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {ALL_CATAN_RESOURCES.map((r) => (
                          <label
                            key={`cr_${r}`}
                            className="flex items-center gap-1 bg-slate-900 px-1.5 py-1 rounded border border-slate-800 text-[10px]"
                          >
                            <span>{r}:</span>
                            <input
                              type="number"
                              min={0}
                              max={19}
                              value={counterRequestAmounts[r]}
                              onChange={(e) =>
                                setCounterRequestAmounts((prev) => ({
                                  ...prev,
                                  [r]: Math.max(
                                    0,
                                    Number(e.target.value) || 0
                                  ),
                                }))
                              }
                              className="w-10 bg-slate-950 border border-slate-700 rounded px-1 text-center font-mono"
                            />
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const actorId =
                        view.activeTrade?.phase === 'AWAITING_OPPONENTS'
                          ? counteringTargetId
                          : view.activeTrade?.initiatorId ?? selfPlayer.id;
                      onDispatchAction(actorId, {
                        type: 'CATAN_RESPOND_TRADE',
                        response: 'COUNTER',
                        ...(view.activeTrade?.phase ===
                        'AWAITING_ACTIVE_PLAYER'
                          ? { targetOpponentId: counteringTargetId }
                          : {}),
                        counterGive: counterGiveAmounts,
                        counterRequest: counterRequestAmounts,
                      });
                      setCounteringTargetId(null);
                    }}
                    className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs"
                  >
                    Send Counter-Proposal
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* =====================================================================
          2. BOTTOM CATAN PLAYER DASHBOARD (Resources, Actions, Dev Cards, Trade)
         ===================================================================== */}
      <section
        className={`h-64 shrink-0 bg-slate-900 border-t-2 px-4 py-3 flex gap-3.5 overflow-x-auto z-20 transition-all ${
          isMyTurn
            ? 'border-emerald-500/80 shadow-[0_-4px_20px_rgba(16,185,129,0.18)]'
            : 'border-slate-800'
        }`}
      >
        {/* Column A: Player Resource Hand & Supply */}
        <div className="w-72 shrink-0 flex flex-col justify-between bg-slate-950/70 border border-slate-800 rounded-xl p-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
              Resources ({formatPlayerLabel(selfPlayer.id)})
            </span>
            <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[11px] font-bold">
              ★ {selfPlayer.victoryPoints} / 10 VP
            </span>
          </div>

          <div className="grid grid-cols-5 gap-1.5 my-auto pt-1">
            {ALL_CATAN_RESOURCES.map((res) => {
              const count = selfPlayer.resources[res];
              const theme = TERRAIN_THEMES[res];
              return (
                <div
                  key={res}
                  className={`flex flex-col items-center justify-between rounded-xl p-1.5 border ${
                    count > 0
                      ? 'bg-slate-900 border-slate-700'
                      : 'bg-slate-950/40 border-slate-800/60 opacity-50'
                  }`}
                >
                  <div
                    className={`w-full h-10 rounded-lg border flex items-center justify-center gap-0.5 font-mono text-sm font-black ${theme.badge}`}
                  >
                    <span>{theme.icon}</span>
                    <span>{count}</span>
                  </div>
                  <span className="text-[9px] font-bold text-slate-300 mt-1">
                    {res}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1 border-t border-slate-800/80">
            <span>
              🏠 {selfPlayer.settlementsRemaining} • 🏛{' '}
              {selfPlayer.citiesRemaining} • 🛣 {selfPlayer.roadsRemaining} left
            </span>
            <span>⚔️ {selfPlayer.faceUpKnights} Knights</span>
          </div>
        </div>

        {/* Column B: Core Turn & Building Actions */}
        <div className="w-80 shrink-0 flex flex-col justify-between bg-slate-950/70 border border-slate-800 rounded-xl p-3 text-xs">
          <div className="flex items-center justify-between">
            <span className="font-bold uppercase tracking-wider text-slate-300">
              Turn Actions ({view.turnStep})
            </span>
            {view.freeRoadsRemaining > 0 && (
              <span className="px-2 py-0.5 rounded bg-emerald-500 text-slate-950 font-black text-[10px]">
                🛣️ {view.freeRoadsRemaining} Free Road(s)
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 gap-1.5 my-auto">
            <button
              disabled={
                isControlsLocked ||
                pendingAction ||
                (view.turnStep !== 'ROLL_DICE' &&
                  view.turnStep !== 'ROLL_FOR_START')
              }
              onClick={() =>
                onDispatchAction(selfPlayer.id, { type: 'CATAN_ROLL_DICE' })
              }
              className="p-2 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-35 text-slate-950 font-black transition shadow flex items-center justify-center gap-1.5"
            >
              <span>🎲 Roll Dice</span>
            </button>

            <button
              disabled={
                isControlsLocked ||
                pendingAction ||
                view.turnStep !== 'MAIN_PHASE'
              }
              onClick={() =>
                onDispatchAction(selfPlayer.id, { type: 'CATAN_END_TURN' })
              }
              className="p-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-35 text-slate-950 font-black transition shadow flex items-center justify-center gap-1.5"
            >
              <span>✓ End Turn →</span>
            </button>

            <button
              disabled={
                isControlsLocked ||
                pendingAction ||
                (view.turnStep !== 'MAIN_PHASE' &&
                  view.turnStep !== 'SETUP_ROAD_1' &&
                  view.turnStep !== 'SETUP_ROAD_2' &&
                  view.freeRoadsRemaining <= 0)
              }
              onClick={() =>
                onDispatchAction(selfPlayer.id, {
                  type: 'CATAN_BUILD_ROAD',
                  ...(selectedEdgeId ? { edgeId: selectedEdgeId } : {}),
                })
              }
              className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-35 border border-slate-700 text-slate-100 font-semibold transition flex flex-col items-start"
            >
              <span className="font-bold">🛣 Build Road</span>
              <span className="text-[9px] text-slate-400">
                1 Wood + 1 Brick
              </span>
            </button>

            <button
              disabled={
                isControlsLocked ||
                pendingAction ||
                (view.turnStep !== 'MAIN_PHASE' &&
                  view.turnStep !== 'SETUP_SETTLEMENT_1' &&
                  view.turnStep !== 'SETUP_SETTLEMENT_2')
              }
              onClick={() =>
                onDispatchAction(selfPlayer.id, {
                  type: 'CATAN_BUILD_SETTLEMENT',
                  ...(selectedVertexId ? { vertexId: selectedVertexId } : {}),
                })
              }
              className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-35 border border-slate-700 text-slate-100 font-semibold transition flex flex-col items-start"
            >
              <span className="font-bold">🏠 Build Settlement</span>
              <span className="text-[9px] text-slate-400">
                1W, 1B, 1S, 1Wh (+1 VP)
              </span>
            </button>

            <button
              disabled={
                isControlsLocked ||
                pendingAction ||
                view.turnStep !== 'MAIN_PHASE'
              }
              onClick={() =>
                onDispatchAction(selfPlayer.id, {
                  type: 'CATAN_START_UPGRADE_CITY',
                })
              }
              className={`p-2 rounded-xl border text-slate-100 font-semibold transition flex flex-col items-start ${
                view.turnStep === 'SELECT_CITY_UPGRADE'
                  ? 'bg-sky-900 border-sky-400 text-sky-100'
                  : 'bg-slate-900 hover:bg-slate-800 border-slate-700 disabled:opacity-35'
              }`}
            >
              <span className="font-bold">
                {view.turnStep === 'SELECT_CITY_UPGRADE'
                  ? '🏛 Click Settlement on Board'
                  : '🏛 Upgrade City'}
              </span>
              <span className="text-[9px] text-slate-400">
                2 Wheat + 3 Ore (+1 VP)
              </span>
            </button>

            <button
              disabled={
                isControlsLocked ||
                pendingAction ||
                view.turnStep !== 'MAIN_PHASE' ||
                view.devCardDeckCount <= 0
              }
              onClick={() =>
                onDispatchAction(selfPlayer.id, { type: 'CATAN_BUY_DEV_CARD' })
              }
              className="p-2 rounded-xl bg-purple-950/70 hover:bg-purple-900/80 disabled:opacity-35 border border-purple-500/60 text-purple-100 font-semibold transition flex flex-col items-start"
            >
              <span className="font-bold">
                📜 Buy Dev Card ({view.devCardDeckCount})
              </span>
              <span className="text-[9px] text-purple-300">
                1 Wheat, 1 Ore, 1 Sheep
              </span>
            </button>
          </div>
        </div>

        {/* Column C: Development Cards Hand (Red / Green / Yellow Frames) */}
        <div className="w-80 shrink-0 flex flex-col justify-between bg-slate-950/70 border border-slate-800 rounded-xl p-3 text-xs">
          <div className="flex items-center justify-between">
            <span className="font-bold uppercase tracking-wider text-purple-300">
              📜 Development Cards ({selfPlayer.devCards.length})
            </span>
            <span className="text-[10px] text-slate-400">
              {view.hasPlayedDevCardThisTurn
                ? '✓ 1 Played This Turn'
                : `Deck: ${view.devCardDeckCount} left`}
            </span>
          </div>

          <div className="flex-1 overflow-y-auto space-y-1.5 my-1.5 pr-1">
            {selfPlayer.devCards.length === 0 ? (
              <div className="text-slate-500 italic text-[11px] py-4 text-center">
                No Development Cards in hand. Purchase for 1 Wheat + 1 Ore + 1
                Sheep.
              </div>
            ) : (
              selfPlayer.devCards.map((card) => {
                const frameStyle = DEV_FRAME_STYLES[card.frame];
                const boughtThisTurn = card.purchasedOnTurn === view.turnNumber;
                const canPlayThisTurn =
                  isMyTurn &&
                  (card.category === 'VICTORY_POINT' ||
                    (!boughtThisTurn && !view.hasPlayedDevCardThisTurn));

                return (
                  <div
                    key={card.id}
                    className={`p-2 rounded-lg border-2 flex items-center justify-between gap-2 ${frameStyle.badge}`}
                  >
                    <div className="min-w-0">
                      <div className="font-black text-[11px] flex items-center gap-1.5">
                        <span>{card.name}</span>
                        <span className="text-[9px] opacity-80 font-normal">
                          ({frameStyle.label})
                        </span>
                      </div>
                      <p className="text-[9px] opacity-90 truncate">
                        {card.description}
                      </p>
                    </div>

                    <button
                      type="button"
                      disabled={!canPlayThisTurn || isControlsLocked}
                      onClick={() => {
                        if (card.type === 'KNIGHT') {
                          onDispatchAction(selfPlayer.id, {
                            type: 'CATAN_PLAY_KNIGHT',
                            ...(selectedHexId !== view.board.robberHexId
                              ? { targetHexId: selectedHexId }
                              : {}),
                          });
                        } else if (card.type === 'MONOPOLY') {
                          onDispatchAction(selfPlayer.id, {
                            type: 'CATAN_PLAY_MONOPOLY',
                            resource: monopolyResource,
                          });
                        } else if (card.type === 'YEAR_OF_PLENTY') {
                          onDispatchAction(selfPlayer.id, {
                            type: 'CATAN_PLAY_YEAR_OF_PLENTY',
                            resource1: yopResource1,
                            resource2: yopResource2,
                          });
                        } else if (card.type === 'ROAD_BUILDING') {
                          onDispatchAction(selfPlayer.id, {
                            type: 'CATAN_PLAY_ROAD_BUILDING',
                          });
                        } else {
                          onDispatchAction(selfPlayer.id, {
                            type: 'CATAN_PLAY_VP_CARD',
                            cardId: card.id,
                          });
                        }
                      }}
                      className="px-2 py-1 rounded bg-slate-950 hover:bg-slate-900 disabled:opacity-40 text-amber-300 border border-amber-400/50 font-black text-[10px] shrink-0"
                    >
                      {boughtThisTurn && card.category !== 'VICTORY_POINT'
                        ? 'Next Turn'
                        : view.hasPlayedDevCardThisTurn &&
                          card.category !== 'VICTORY_POINT'
                        ? '1/Turn Limit'
                        : 'Play'}
                    </button>
                  </div>
                );
              })
            )}
          </div>

          {/* Resource selectors for Monopoly / Year of Plenty */}
          <div className="flex items-center justify-between gap-1 pt-1 border-t border-slate-800/80 text-[10px]">
            <span className="text-slate-400">Monopoly/YoP:</span>
            <select
              value={monopolyResource}
              onChange={(e) =>
                setMonopolyResource(e.target.value as CatanResource)
              }
              className="bg-slate-900 border border-slate-700 rounded px-1 py-0.5 text-slate-200"
              title="Monopoly target resource"
            >
              {ALL_CATAN_RESOURCES.map((r) => (
                <option key={`m_${r}`} value={r}>
                  Mono: {r}
                </option>
              ))}
            </select>
            <select
              value={yopResource1}
              onChange={(e) => setYopResource1(e.target.value as CatanResource)}
              className="bg-slate-900 border border-slate-700 rounded px-1 py-0.5 text-slate-200"
            >
              {ALL_CATAN_RESOURCES.map((r) => (
                <option key={`y1_${r}`} value={r}>
                  {r}
                </option>
              ))}
            </select>
            <select
              value={yopResource2}
              onChange={(e) => setYopResource2(e.target.value as CatanResource)}
              className="bg-slate-900 border border-slate-700 rounded px-1 py-0.5 text-slate-200"
            >
              {ALL_CATAN_RESOURCES.map((r) => (
                <option key={`y2_${r}`} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Column D: Player-to-Player Trade Proposal & Maritime Bank Trade */}
        <div className="w-96 shrink-0 flex flex-col justify-between bg-slate-950/70 border border-slate-800 rounded-xl p-3 text-xs">
          <div className="flex items-center justify-between">
            <span className="font-bold uppercase tracking-wider text-cyan-300">
              🤝 Offer Trade (X for Y) &amp; {maritimeRate}:1 Port
            </span>
          </div>

          {/* Player-to-Player Trade Builder */}
          <div className="space-y-1.5 my-auto">
            <div className="flex items-center gap-1 flex-wrap">
              <span className="text-[10px] text-emerald-300 font-bold w-14">
                Offer (X):
              </span>
              {ALL_CATAN_RESOURCES.map((r) => (
                <label
                  key={`off_${r}`}
                  className="flex items-center gap-0.5 bg-slate-900 px-1 py-0.5 rounded border border-slate-800 text-[9px]"
                >
                  <span>{r.slice(0, 2)}</span>
                  <input
                    type="number"
                    min={0}
                    max={selfPlayer.resources[r]}
                    value={offerAmounts[r]}
                    onChange={(e) =>
                      setOfferAmounts((prev) => ({
                        ...prev,
                        [r]: Math.max(
                          0,
                          Math.min(
                            selfPlayer.resources[r],
                            Number(e.target.value) || 0
                          )
                        ),
                      }))
                    }
                    className="w-8 bg-slate-950 border border-slate-700 rounded text-center font-mono text-slate-100"
                  />
                </label>
              ))}
            </div>

            <div className="flex items-center gap-1 flex-wrap">
              <span className="text-[10px] text-amber-300 font-bold w-14">
                Ask (Y):
              </span>
              {ALL_CATAN_RESOURCES.map((r) => (
                <label
                  key={`req_${r}`}
                  className="flex items-center gap-0.5 bg-slate-900 px-1 py-0.5 rounded border border-slate-800 text-[9px]"
                >
                  <span>{r.slice(0, 2)}</span>
                  <input
                    type="number"
                    min={0}
                    max={19}
                    value={requestAmounts[r]}
                    onChange={(e) =>
                      setRequestAmounts((prev) => ({
                        ...prev,
                        [r]: Math.max(0, Number(e.target.value) || 0),
                      }))
                    }
                    className="w-8 bg-slate-950 border border-slate-700 rounded text-center font-mono text-slate-100"
                  />
                </label>
              ))}
            </div>

            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                disabled={
                  isControlsLocked ||
                  pendingAction ||
                  !isMyTurn ||
                  view.turnStep !== 'MAIN_PHASE' ||
                  Boolean(view.activeTrade)
                }
                onClick={() =>
                  onDispatchAction(selfPlayer.id, {
                    type: 'CATAN_PROPOSE_TRADE',
                    offered: offerAmounts,
                    requested: requestAmounts,
                  })
                }
                className="flex-1 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 disabled:opacity-35 text-slate-950 font-black text-[11px] transition shadow"
              >
                🤝 Propose Player Trade
              </button>
            </div>
          </div>

          {/* Maritime Trade Quick Bar */}
          <div className="flex items-center justify-between gap-1.5 pt-1.5 border-t border-slate-800/80 text-[10px]">
            <select
              value={tradeGive}
              onChange={(e) => setTradeGive(e.target.value as CatanResource)}
              className="bg-slate-900 border border-slate-700 rounded px-1.5 py-0.5 text-slate-100"
            >
              {ALL_CATAN_RESOURCES.map((r) => (
                <option key={`mg_${r}`} value={r}>
                  Give {getPlayerMaritimeTradeRate(view.board, selfPlayer.id, r)}×{' '}
                  {r}
                </option>
              ))}
            </select>
            <span>→</span>
            <select
              value={tradeReceive}
              onChange={(e) => setTradeReceive(e.target.value as CatanResource)}
              className="bg-slate-900 border border-slate-700 rounded px-1.5 py-0.5 text-slate-100"
            >
              {ALL_CATAN_RESOURCES.map((r) => (
                <option key={`mr_${r}`} value={r}>
                  1× {r}
                </option>
              ))}
            </select>
            <button
              type="button"
              disabled={
                isControlsLocked ||
                pendingAction ||
                !isMyTurn ||
                view.turnStep !== 'MAIN_PHASE'
              }
              onClick={() =>
                onDispatchAction(selfPlayer.id, {
                  type: 'CATAN_MARITIME_TRADE',
                  give: tradeGive,
                  receive: tradeReceive,
                })
              }
              className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-35 text-cyan-200 border border-cyan-500/40 font-bold"
            >
              ⚓ Bank Trade
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};
