import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ALL_POWER_GRID_RESOURCES,
  calculateCityBuildCost,
  calculateResourcePurchaseCost,
  canPlantStoreResource,
  CITY_SLOT_COSTS,
  FuelBurnAllocation,
  getBureaucracyPayout,
  getEffectivePlayerCountConfig,
  getMaxCitySlotsForStep,
  getNextUnitCost,
  getPlantRemainingCapacity,
  getTotalStoredOnPlant,
  OwnedPowerPlant,
  POWER_GRID_MAPS,
  POWER_GRID_VISUAL_LAYOUTS,
  PowerGridAction,
  PowerGridPhase,
  PowerGridResource,
  SanitizedPowerGridPlayerState,
  SanitizedPowerGridState,
} from '../games/power-grid/index.js';
import {
  PowerPlantCardVisual,
  PowerPlantMarketLauncherCard,
} from './PowerPlantCardVisual.js';

export interface PowerGridBoardProps {
  readonly state: SanitizedPowerGridState;
  readonly viewingPlayerId: string;
  readonly playerNames: Readonly<Record<string, string>>;
  readonly onDispatchAction: (action: PowerGridAction) => void;
}

interface PlayerColorStyle {
  readonly fill: string;
  readonly stroke: string;
  readonly text: string;
  readonly name: string;
}

const PG_PLAYER_COLORS: Readonly<Record<string, PlayerColorStyle>> = {
  red: { fill: '#ef4444', stroke: '#fecaca', text: '#ffffff', name: 'Red' },
  blue: { fill: '#3b82f6', stroke: '#bfdbfe', text: '#ffffff', name: 'Blue' },
  yellow: {
    fill: '#eab308',
    stroke: '#fef08a',
    text: '#0f172a',
    name: 'Yellow',
  },
  green: { fill: '#22c55e', stroke: '#bbf7d0', text: '#052e16', name: 'Green' },
  purple: {
    fill: '#a855f7',
    stroke: '#e9d5ff',
    text: '#ffffff',
    name: 'Purple',
  },
  black: {
    fill: '#1e293b',
    stroke: '#cbd5e1',
    text: '#f8fafc',
    name: 'Black',
  },
  orange: {
    fill: '#f97316',
    stroke: '#fed7aa',
    text: '#ffffff',
    name: 'Orange',
  },
  white: {
    fill: '#f8fafc',
    stroke: '#64748b',
    text: '#0f172a',
    name: 'White',
  },
};

function getPlayerColorStyle(colorId: string | undefined): PlayerColorStyle {
  if (!colorId) return PG_PLAYER_COLORS['red']!;
  return PG_PLAYER_COLORS[colorId] ?? PG_PLAYER_COLORS['red']!;
}

const RESOURCE_META: Readonly<
  Record<
    PowerGridResource,
    {
      readonly label: string;
      readonly icon: string;
      readonly tokenBg: string;
      readonly tokenBorder: string;
    }
  >
> = {
  COAL: {
    label: 'Coal',
    icon: '🪨',
    tokenBg: '#451a03',
    tokenBorder: '#d97706',
  },
  OIL: {
    label: 'Oil',
    icon: '🛢️',
    tokenBg: '#1e293b',
    tokenBorder: '#94a3b8',
  },
  GARBAGE: {
    label: 'Garbage',
    icon: '♻️',
    tokenBg: '#ca8a04',
    tokenBorder: '#fef08a',
  },
  URANIUM: {
    label: 'Uranium',
    icon: '☢️',
    tokenBg: '#dc2626',
    tokenBorder: '#fca5a5',
  },
};

function makeEdgeKey(a: string, b: string): string {
  return a < b ? `${a}__${b}` : `${b}__${a}`;
}

export const PowerGridBoard: React.FC<PowerGridBoardProps> = ({
  state,
  viewingPlayerId,
  playerNames,
  onDispatchAction,
}) => {
  const getName = (pid: string | null | undefined) =>
    pid ? playerNames[pid] ?? pid : '—';

  const isMyTurn = state.activePlayerId === viewingPlayerId;
  const selfPlayer = state.self;
  const mapDef = POWER_GRID_MAPS[state.mapId];
  const visualLayout = POWER_GRID_VISUAL_LAYOUTS[state.mapId];
  const activeRegionSet = useMemo(
    () => new Set(state.activeRegions),
    [state.activeRegions]
  );

  const cfg = getEffectivePlayerCountConfig(
    state.turnOrder.length,
    state.mapId
  );

  const allPlayersById = useMemo(() => {
    const map: Record<string, SanitizedPowerGridPlayerState> = {
      [selfPlayer.id]: selfPlayer,
      ...state.opponents,
    };
    return map;
  }, [selfPlayer, state.opponents]);

  const allPlayersOrdered: SanitizedPowerGridPlayerState[] = useMemo(
    () => state.turnOrder.map((pid) => allPlayersById[pid]!),
    [state.turnOrder, allPlayersById]
  );

  // Auto-AI Opponents toggle
  const [autoAiOpponents, setAutoAiOpponents] = useState<boolean>(false);

  // Centered Power Plant Market Window state (like Catan's Trade Window)
  const [isMarketWindowOpen, setIsMarketWindowOpen] = useState<boolean>(false);

  // Auto-open Market Window when entering Phase 2 Auction on your turn
  const prevPhaseRef = useRef<PowerGridPhase | null>(null);
  useEffect(() => {
    if (
      state.phase === PowerGridPhase.PHASE_2_AUCTION_POWER_PLANTS &&
      prevPhaseRef.current !== PowerGridPhase.PHASE_2_AUCTION_POWER_PLANTS
    ) {
      setIsMarketWindowOpen(true);
    }
    if (
      state.phase !== PowerGridPhase.PHASE_2_AUCTION_POWER_PLANTS &&
      prevPhaseRef.current === PowerGridPhase.PHASE_2_AUCTION_POWER_PLANTS
    ) {
      setIsMarketWindowOpen(false);
    }
    prevPhaseRef.current = state.phase;
  }, [state.phase]);

  // Phase 2: Opening Auction selection
  const [selectedAuctionPlantId, setSelectedAuctionPlantId] = useState<
    number | null
  >(null);
  const [openingBidAmount, setOpeningBidAmount] = useState<number>(3);
  const [raiseBidAmount, setRaiseBidAmount] = useState<number>(4);

  // Phase 3: Resource purchase selection
  const [selectedBuyPlantId, setSelectedBuyPlantId] = useState<number | null>(
    null
  );
  const [selectedBuyResource, setSelectedBuyResource] =
    useState<PowerGridResource>('COAL');
  const [selectedBuyQuantity, setSelectedBuyQuantity] = useState<number>(1);

  // Phase 4: Hover & Flashing Placement Confirmation State
  const [hoveredCityId, setHoveredCityId] = useState<string | null>(null);
  const [pendingBuildCityId, setPendingBuildCityId] = useState<string | null>(
    null
  );

  // Zoom & Pan state (matching Ticket to Ride)
  const [zoomScale, setZoomScale] = useState<number>(1);
  const [panOffset, setPanOffset] = useState<{ x: number; y: number }>({
    x: 0,
    y: 0,
  });
  const isDraggingRef = useRef<boolean>(false);
  const didDragMoveRef = useRef<boolean>(false);
  const dragOriginRef = useRef<{
    x: number;
    y: number;
    panX: number;
    panY: number;
  }>({ x: 0, y: 0, panX: 0, panY: 0 });

  const handleZoomDelta = (delta: number) => {
    setZoomScale((prev) => {
      const next = Math.min(2.5, Math.max(1, Number((prev + delta).toFixed(2))));
      if (next === 1) {
        setPanOffset({ x: 0, y: 0 });
      }
      return next;
    });
  };

  const handleResetZoom = () => {
    setZoomScale(1);
    setPanOffset({ x: 0, y: 0 });
  };

  const handleWheelZoom = (e: React.WheelEvent<HTMLDivElement>) => {
    if (!e.ctrlKey && zoomScale === 1 && e.deltaY > 0) {
      return;
    }
    e.preventDefault();
    handleZoomDelta(e.deltaY < 0 ? 0.2 : -0.2);
  };

  const handleMapMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (zoomScale <= 1) return;
    isDraggingRef.current = true;
    didDragMoveRef.current = false;
    dragOriginRef.current = {
      x: e.clientX,
      y: e.clientY,
      panX: panOffset.x,
      panY: panOffset.y,
    };
  };

  const handleMapMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current) return;
    const dx = e.clientX - dragOriginRef.current.x;
    const dy = e.clientY - dragOriginRef.current.y;
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) {
      didDragMoveRef.current = true;
    }
    const maxPanX = (zoomScale - 1) * 420;
    const maxPanY = (zoomScale - 1) * 260;
    setPanOffset({
      x: Math.max(-maxPanX, Math.min(maxPanX, dragOriginRef.current.panX + dx)),
      y: Math.max(-maxPanY, Math.min(maxPanY, dragOriginRef.current.panY + dy)),
    });
  };

  const handleMapMouseUp = () => {
    isDraggingRef.current = false;
    setTimeout(() => {
      didDragMoveRef.current = false;
    }, 25);
  };

  // Clear pending city confirmation when phase or active turn changes
  useEffect(() => {
    setPendingBuildCityId(null);
  }, [state.phase, state.activePlayerId, state.turnNumber]);

  // Synchronize default auction plant / raise bid when market or auction updates
  useEffect(() => {
    if (state.actualMarket.length > 0) {
      const stillInMarket = state.actualMarket.some(
        (c) => c.id === selectedAuctionPlantId
      );
      if (!stillInMarket) {
        const firstPlant = state.actualMarket[0]!;
        setSelectedAuctionPlantId(firstPlant.id);
        setOpeningBidAmount(firstPlant.id);
      }
    }
  }, [state.actualMarket, selectedAuctionPlantId]);

  useEffect(() => {
    if (state.auction?.activePlant) {
      setRaiseBidAmount(state.auction.currentBid + 1);
    }
  }, [state.auction?.activePlant, state.auction?.currentBid]);

  useEffect(() => {
    if (selfPlayer.powerPlants.length > 0) {
      const exists = selfPlayer.powerPlants.some(
        (p) => p.card.id === selectedBuyPlantId
      );
      if (!exists) {
        const firstFuelPlant =
          selfPlayer.powerPlants.find((p) => p.card.intakeCost > 0) ??
          selfPlayer.powerPlants[0]!;
        setSelectedBuyPlantId(firstFuelPlant.card.id);
      }
    }
  }, [selfPlayer.powerPlants, selectedBuyPlantId]);

  // Auto-AI Opponents runner
  useEffect(() => {
    if (!autoAiOpponents || state.phase === PowerGridPhase.GAME_OVER) return;
    const anchorHumanId = state.turnOrder[0];
    if (state.activePlayerId !== anchorHumanId) {
      const timer = setTimeout(() => {
        onDispatchAction({ type: 'PG_AI_TURN' });
      }, 400);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [
    autoAiOpponents,
    state.phase,
    state.activePlayerId,
    state.turnNumber,
    state.turnOrder,
    onDispatchAction,
  ]);

  // Precompute build cost + shortest pipe path for every active city
  const buildPreviewByCity = useMemo(() => {
    const result: Record<
      string,
      ReturnType<typeof calculateCityBuildCost>
    > = {};
    for (const cid of Object.keys(state.cityBoard)) {
      result[cid] = calculateCityBuildCost(
        state.mapId,
        state.cityBoard,
        state.step,
        selfPlayer.id,
        selfPlayer.cities,
        cid
      );
    }
    return result;
  }, [state.mapId, state.cityBoard, state.step, selfPlayer.id, selfPlayer.cities]);

  // Determine which city is currently previewed (pending confirmation takes priority over hover)
  const previewTargetCityId = pendingBuildCityId ?? hoveredCityId;
  const previewBuildInfo = previewTargetCityId
    ? buildPreviewByCity[previewTargetCityId] ?? null
    : null;

  const highlightedPipeEdgeKeys = useMemo(() => {
    const set = new Set<string>();
    if (previewBuildInfo?.valid && previewBuildInfo.path.length >= 2) {
      for (let i = 0; i < previewBuildInfo.path.length - 1; i++) {
        set.add(
          makeEdgeKey(previewBuildInfo.path[i]!, previewBuildInfo.path[i + 1]!)
        );
      }
    }
    return set;
  }, [previewBuildInfo]);

  const handleCityNodeClick = (cityId: string) => {
    if (didDragMoveRef.current) return;
    if (state.phase !== PowerGridPhase.PHASE_4_BUILD_CITIES || !isMyTurn) {
      return;
    }
    const info = buildPreviewByCity[cityId];
    if (!info || !info.valid) return;
    if (info.totalCost > (selfPlayer.money ?? 0)) return;

    // Stage confirmation with flashing preview
    setPendingBuildCityId((prev) => (prev === cityId ? null : cityId));
  };

  // Compute automatic Bureaucracy fuel allocations for all operable plants owned by `selfPlayer`
  const buildDefaultBureaucracyAllocations = (
    plants: readonly OwnedPowerPlant[]
  ): FuelBurnAllocation[] => {
    const allocations: FuelBurnAllocation[] = [];
    for (const owned of plants) {
      if (owned.card.intakeCost === 0) {
        allocations.push({ plantId: owned.card.id, resourcesSpent: {} });
        continue;
      }
      if (getTotalStoredOnPlant(owned) >= owned.card.intakeCost) {
        let remaining = owned.card.intakeCost;
        const spent: Partial<Record<PowerGridResource, number>> = {};
        for (const res of ALL_POWER_GRID_RESOURCES) {
          const take = Math.min(remaining, owned.storedResources[res]);
          if (take > 0) {
            spent[res] = take;
            remaining -= take;
          }
        }
        if (remaining === 0) {
          allocations.push({ plantId: owned.card.id, resourcesSpent: spent });
        }
      }
    }
    return allocations;
  };

  const maxSlotsOpenForStep = getMaxCitySlotsForStep(state.step);

  // Helper to check if a specific physical slot index in the Resource Market is occupied.
  // Total slots: 24 for Coal/Oil/Garbage (3 per dollar $1..$8 -> indices 0..23),
  // 12 for Uranium (1 per price [1,2,3,4,5,6,7,8,10,12,14,16] -> indices 0..11).
  // When `inventory` tokens remain, they occupy the LAST `inventory` indices.
  const isMarketSlotFilled = (
    res: PowerGridResource,
    slotIndex: number,
    totalSlots: number
  ): boolean => {
    const count = state.resourceMarket.inventory[res];
    return slotIndex >= totalSlots - count;
  };

  return (
    <div className="space-y-3.5 text-slate-100 select-none">
      {/* Keyframes for flashing pending city slot & transmission pipe preview */}
      <style>{`
        @keyframes pgFlashPulse {
          0%, 100% { opacity: 1; filter: drop-shadow(0 0 8px #fde047); }
          50% { opacity: 0.32; filter: drop-shadow(0 0 2px #fde047); }
        }
        .pg-flashing-preview {
          animation: pgFlashPulse 0.85s ease-in-out infinite;
        }
      `}</style>

      {/* =====================================================================
          1. COMPACT STATUS HEADER + POWER PLANT MARKET LAUNCHER CARD
         ===================================================================== */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-3 items-stretch">
        {/* Left: Phase Status + AI Controls (7 cols) */}
        <div className="xl:col-span-7 rounded-2xl bg-slate-900/95 border border-amber-500/40 px-4 py-3 flex flex-wrap items-center justify-between gap-3 shadow-lg">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-md bg-amber-500/20 border border-amber-400/50 text-amber-300 text-xs font-extrabold uppercase">
                ⚡ Power Grid • {mapDef.name}
              </span>
              <span className="px-2.5 py-0.5 rounded-md bg-cyan-500/20 border border-cyan-400/40 text-cyan-300 text-xs font-bold font-mono">
                Round {state.roundNumber} • {state.step.replace('_', ' ')}
              </span>
              <span className="px-2.5 py-0.5 rounded-md bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 text-xs font-bold">
                {state.phase.replace(/^PHASE_\d_/, '').replace(/_/g, ' ')}
              </span>
              <span className="px-2 py-0.5 rounded bg-slate-950 border border-slate-700 text-emerald-300 font-mono text-xs font-bold">
                Your Elektro: ${selfPlayer.money ?? 0}
              </span>
            </div>
            {state.lastActionSummary && (
              <div className="text-[11px] text-slate-300 truncate max-w-xl">
                <strong className="text-amber-300 mr-1">Latest:</strong>
                {state.lastActionSummary}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            {state.phase !== PowerGridPhase.GAME_OVER && (
              <button
                type="button"
                onClick={() => onDispatchAction({ type: 'PG_AI_TURN' })}
                className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-extrabold shadow transition cursor-pointer"
              >
                🤖 AI Step ({getName(state.activePlayerId)})
              </button>
            )}
            <label className="flex items-center gap-1.5 text-xs text-slate-300 bg-slate-800/80 px-2.5 py-1.5 rounded-xl border border-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={autoAiOpponents}
                onChange={(e) => setAutoAiOpponents(e.target.checked)}
                className="accent-amber-400"
              />
              <span>Auto-AI</span>
            </label>
          </div>
        </div>

        {/* Right: Clickable Illustrated Power Plant Market Card (5 cols) */}
        <div className="xl:col-span-5 flex">
          <PowerPlantMarketLauncherCard
            actualMarket={state.actualMarket}
            futureMarket={state.futureMarket}
            drawDeckCount={state.drawDeckCount}
            activeAuctionPlant={state.auction?.activePlant ?? null}
            currentBid={state.auction?.currentBid ?? 0}
            isAuctionPhase={
              state.phase === PowerGridPhase.PHASE_2_AUCTION_POWER_PLANTS
            }
            onOpenMarketWindow={() => setIsMarketWindowOpen(true)}
          />
        </div>
      </div>

      {/* =====================================================================
          2. CONTEXTUAL PHASE ACTION BANNERS (PHASES 2, 4, 5)
         ===================================================================== */}
      {state.phase === PowerGridPhase.PHASE_2_AUCTION_POWER_PLANTS && (
        <div className="rounded-xl bg-amber-950/50 border border-amber-400/60 px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
          <span>
            🔨 <strong>Phase 2 — Power Plant Auctions:</strong> Active bidder is{' '}
            <strong className="text-amber-300">
              {getName(state.activePlayerId)}
            </strong>
            . Click the Power Plant Market card to bid or inspect upcoming plants!
          </span>
          <button
            type="button"
            onClick={() => setIsMarketWindowOpen(true)}
            className="px-3.5 py-1.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 font-black cursor-pointer"
          >
            🏭 Open Power Plant Market Window
          </button>
        </div>
      )}

      {state.phase === PowerGridPhase.PHASE_4_BUILD_CITIES && isMyTurn && (
        <div className="rounded-xl bg-emerald-950/60 border border-emerald-400/60 px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div>
            <strong className="text-emerald-300 uppercase mr-2">
              🏗️ Phase 4 — Build Cities:
            </strong>
            Hover any active city on the map to preview its shortest pipe route &amp;
            cost, then click the city to flash &amp; confirm placement!
          </div>

          <div className="flex items-center gap-2">
            {pendingBuildCityId && buildPreviewByCity[pendingBuildCityId]?.valid && (
              <div className="flex items-center gap-2 bg-slate-950/90 border-2 border-amber-400 rounded-xl px-3 py-1 shadow-lg">
                <span className="font-bold text-amber-200">
                  ⚡ Build{' '}
                  {
                    mapDef.cities.find((c) => c.id === pendingBuildCityId)
                      ?.name
                  }{' '}
                  for ${buildPreviewByCity[pendingBuildCityId]!.totalCost} ($
                  {buildPreviewByCity[pendingBuildCityId]!.slotCost} slot + $
                  {buildPreviewByCity[pendingBuildCityId]!.pipeCost} pipe)?
                </span>
                <button
                  type="button"
                  onClick={() => {
                    onDispatchAction({
                      type: 'PG_BUILD_CITY',
                      cityId: pendingBuildCityId,
                    });
                    setPendingBuildCityId(null);
                  }}
                  className="px-3 py-1 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black cursor-pointer"
                >
                  ✓ Confirm
                </button>
                <button
                  type="button"
                  onClick={() => setPendingBuildCityId(null)}
                  className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold cursor-pointer"
                >
                  ✕ Cancel
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={() =>
                onDispatchAction({ type: 'PG_FINISH_BUILDING_CITIES' })
              }
              className="px-4 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-extrabold shadow cursor-pointer"
            >
              ✅ Finish Building Cities
            </button>
          </div>
        </div>
      )}

      {state.phase === PowerGridPhase.PHASE_5_BUREAUCRACY && isMyTurn && (
        <div className="rounded-xl bg-indigo-950/75 border border-indigo-400/60 px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs">
          {(() => {
            const defaultAllocs = buildDefaultBureaucracyAllocations(
              selfPlayer.powerPlants
            );
            const poweredCapacity = selfPlayer.powerPlants
              .filter((p) =>
                defaultAllocs.some((a) => a.plantId === p.card.id)
              )
              .reduce((sum, p) => sum + p.card.citiesPowered, 0);
            const actualPowered = Math.min(
              selfPlayer.cityCount,
              poweredCapacity
            );
            const reward = getBureaucracyPayout(actualPowered);

            return (
              <>
                <span>
                  ⚡ <strong>Phase 5 — Bureaucracy:</strong> Your fueled plants
                  can power{' '}
                  <strong className="text-emerald-300">
                    {actualPowered}/{selfPlayer.cityCount} cities
                  </strong>{' '}
                  for <strong className="text-amber-300">+${reward} Elektro</strong>.
                </span>
                <button
                  type="button"
                  onClick={() =>
                    onDispatchAction({
                      type: 'PG_POWER_CITIES',
                      allocations: defaultAllocs,
                    })
                  }
                  className="px-4 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black shadow cursor-pointer"
                >
                  ⚡ Power {actualPowered} Cities (+${reward})
                </button>
              </>
            );
          })()}
        </div>
      )}

      {/* =====================================================================
          3. INTEGRATED PHYSICAL POWER GRID GAME BOARD
             - TOP: Turn Order Track + 0–21 Connected Cities Scoring Track
             - CENTER: Interactive USA / Germany Map (Zoom/Pan, Pipes, 3 House Slots)
             - BOTTOM: Physical Resource Market Track ($1–$8 + $10–$16 Uranium)
         ===================================================================== */}
      <div className="rounded-2xl bg-slate-950 border-2 border-slate-700 shadow-2xl overflow-hidden">
        {/* ----------------- BOARD TOP: TURN ORDER & CITY COUNT TRACK ----------------- */}
        <div className="bg-gradient-to-r from-slate-900 via-slate-950 to-slate-900 border-b-2 border-slate-800 px-3.5 py-2.5 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Turn Order Track */}
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-[10px] font-black uppercase tracking-wider text-amber-300 px-2 py-1 rounded bg-amber-500/10 border border-amber-500/30">
              Turn Order
            </span>
            <div className="flex items-center gap-1.5">
              {state.turnOrder.map((pid, idx) => {
                const p = allPlayersById[pid]!;
                const pCol = getPlayerColorStyle(p.color);
                const isActor = pid === state.activePlayerId;

                return (
                  <div
                    key={pid}
                    title={`${idx + 1}. ${getName(pid)} (${p.cityCount} cities, max plant #${p.highestPlantNumber})`}
                    style={{
                      borderColor: isActor ? '#fde047' : pCol.stroke,
                      background: isActor
                        ? 'rgba(250, 204, 21, 0.16)'
                        : 'rgba(15, 23, 42, 0.9)',
                    }}
                    className="px-2 py-1 rounded-lg border flex items-center gap-1.5 text-[11px]"
                  >
                    <span className="font-mono font-black text-slate-400 text-[10px]">
                      {idx + 1}
                    </span>
                    {/* Colored House Icon */}
                    <span
                      style={{
                        width: 13,
                        height: 13,
                        borderRadius: 3,
                        background: pCol.fill,
                        border: `1.5px solid ${pCol.stroke}`,
                        display: 'inline-block',
                      }}
                    />
                    <span className="font-bold text-slate-100 max-w-[78px] truncate">
                      {getName(pid)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 0..21 City Count Track */}
          <div className="flex-1 overflow-x-auto">
            <div className="flex items-center gap-1 min-w-max justify-end">
              <span className="text-[10px] font-black uppercase tracking-wider text-emerald-300 mr-1">
                Cities Connected
              </span>
              {Array.from({ length: 22 }, (_, scoreNum) => {
                const playersHere = allPlayersOrdered.filter(
                  (p) => Math.min(21, p.cityCount) === scoreNum
                );
                const isStep2Mark = scoreNum === cfg.step2TriggerCities;
                const isEndMark = scoreNum === cfg.gameEndTriggerCities;

                return (
                  <div
                    key={scoreNum}
                    title={
                      isStep2Mark
                        ? `${scoreNum} Cities: Triggers STEP 2!`
                        : isEndMark
                          ? `${scoreNum} Cities: Triggers GAME END!`
                          : `${scoreNum} Connected Cities`
                    }
                    className={`relative w-7 h-9 rounded-md border flex flex-col items-center justify-between py-0.5 text-[9px] font-mono font-black ${
                      isEndMark
                        ? 'bg-rose-950/80 border-rose-400 text-rose-200'
                        : isStep2Mark
                          ? 'bg-cyan-950/80 border-cyan-400 text-cyan-200'
                          : 'bg-slate-900/90 border-slate-800 text-slate-400'
                    }`}
                  >
                    <span>
                      {scoreNum}
                      {isStep2Mark ? '⚡' : isEndMark ? '🏁' : ''}
                    </span>
                    <div className="flex items-center justify-center gap-0.5 flex-wrap px-0.5">
                      {playersHere.map((p) => {
                        const c = getPlayerColorStyle(p.color);
                        return (
                          <span
                            key={p.id}
                            style={{
                              width: 7,
                              height: 7,
                              borderRadius: '2px',
                              background: c.fill,
                              border: `1px solid ${c.stroke}`,
                            }}
                          />
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* ----------------- BOARD CENTER: INTERACTIVE VISUAL MAP ----------------- */}
        <div
          className="relative overflow-hidden"
          style={{
            background:
              'radial-gradient(circle at 50% 48%, #0f172a 0%, #090d16 72%, #020617 100%)',
          }}
          onWheel={handleWheelZoom}
          onMouseDown={handleMapMouseDown}
          onMouseMove={handleMapMouseMove}
          onMouseUp={handleMapMouseUp}
          onMouseLeave={() => {
            handleMapMouseUp();
            setHoveredCityId(null);
          }}
        >
          {/* Floating Hover / Preview Cost Breakdown Badge (Top-Left of Map) */}
          {previewTargetCityId && (
            <div className="absolute top-3 left-3 z-20 pointer-events-none bg-slate-950/92 border border-amber-400/70 rounded-xl px-3 py-2 shadow-xl text-xs space-y-0.5">
              {(() => {
                const cDef = mapDef.cities.find(
                  (c) => c.id === previewTargetCityId
                );
                const occ = state.cityBoard[previewTargetCityId];
                const info = buildPreviewByCity[previewTargetCityId];
                if (!cDef) return null;
                if (!occ) {
                  return (
                    <div className="text-slate-400 font-bold">
                      🚫 {cDef.name} ({cDef.regionId.replace(/_/g, ' ')}) —
                      Inactive Region
                    </div>
                  );
                }
                return (
                  <>
                    <div className="font-black text-amber-300">
                      {cDef.isTransregional ? '🌐 ' : '📍 '}
                      {cDef.name}{' '}
                      <span className="text-[10px] text-slate-400 font-normal">
                        ({cDef.regionId.replace(/_/g, ' ')}
                        {cDef.isTransregional ? ' • Transregional' : ''})
                      </span>
                    </div>
                    {occ.owners.includes(selfPlayer.id) ? (
                      <div className="text-emerald-300 font-bold">
                        ✓ Already in your grid
                      </div>
                    ) : info?.valid ? (
                      <div className="text-slate-200 font-mono">
                        Total:{' '}
                        <strong className="text-emerald-300">
                          ${info.totalCost}
                        </strong>{' '}
                        (${info.slotCost} house slot + ${info.pipeCost} pipe)
                      </div>
                    ) : cDef.isTransregional && state.step === 'STEP_1' ? (
                      <div className="text-cyan-300">
                        🔒 Transregional — Opens in Step 2 ($15 slot)
                      </div>
                    ) : (
                      <div className="text-rose-300">
                        🔒 All Step {state.step.slice(-1)} slots occupied
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
          )}

          {/* Floating Zoom & Pan Controls (Top-Right of Map, matching Ticket to Ride) */}
          <div className="absolute top-3 right-3 z-20 flex items-center gap-1 bg-slate-950/90 border border-slate-700 rounded-xl px-2 py-1 shadow-lg">
            <button
              type="button"
              onClick={() => handleZoomDelta(-0.25)}
              disabled={zoomScale <= 1}
              className="w-7 h-7 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-white font-black text-sm cursor-pointer"
            >
              −
            </button>
            <span className="px-2 font-mono text-xs font-bold text-slate-200 min-w-[48px] text-center">
              {Math.round(zoomScale * 100)}%
            </span>
            <button
              type="button"
              onClick={() => handleZoomDelta(0.25)}
              disabled={zoomScale >= 2.5}
              className="w-7 h-7 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-white font-black text-sm cursor-pointer"
            >
              +
            </button>
            {zoomScale > 1 && (
              <button
                type="button"
                onClick={handleResetZoom}
                className="ml-1 px-2 h-7 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/50 text-amber-200 text-[10px] font-bold cursor-pointer"
              >
                Reset
              </button>
            )}
          </div>

          {/* SVG MAP CANVAS */}
          <svg
            viewBox={`0 0 ${visualLayout.viewBoxWidth} ${visualLayout.viewBoxHeight}`}
            style={{
              width: '100%',
              height: 'auto',
              maxHeight: '64vh',
              display: 'block',
              cursor: zoomScale > 1 ? 'grab' : 'default',
              transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoomScale})`,
              transformOrigin: 'center center',
              transition: isDraggingRef.current
                ? 'none'
                : 'transform 0.14s ease-out',
            }}
          >
            {/* Subtle Engineering Blueprint Grid */}
            <g stroke="rgba(148, 163, 184, 0.06)" strokeWidth={1}>
              {[110, 220, 330, 440, 550].map((gy) => (
                <line
                  key={`gy_${gy}`}
                  x1={0}
                  y1={gy}
                  x2={visualLayout.viewBoxWidth}
                  y2={gy}
                />
              ))}
              {[190, 380, 570, 760, 950].map((gx) => (
                <line
                  key={`gx_${gx}`}
                  x1={gx}
                  y1={0}
                  x2={gx}
                  y2={visualLayout.viewBoxHeight}
                />
              ))}
            </g>

            {/* 1. REGIONAL TERRITORY ZONES (Active = Colored, Inactive = Greyed Out) */}
            <g>
              {mapDef.regions.map((rid) => {
                const rVis = visualLayout.regions[rid];
                if (!rVis) return null;
                const isActiveRegion = activeRegionSet.has(rid);

                return (
                  <g key={rid}>
                    <path
                      d={rVis.polygonPath}
                      fill={isActiveRegion ? rVis.fillHex : '#1e293b'}
                      fillOpacity={isActiveRegion ? 0.34 : 0.22}
                      stroke={isActiveRegion ? rVis.borderHex : '#475569'}
                      strokeWidth={isActiveRegion ? 2.2 : 1.4}
                      strokeDasharray={isActiveRegion ? undefined : '7 5'}
                      strokeLinejoin="round"
                    />
                    {/* Region Name Watermark Badge */}
                    <g
                      transform={`translate(${rVis.labelPos.x}, ${rVis.labelPos.y})`}
                    >
                      <rect
                        x={-58}
                        y={-11}
                        width={116}
                        height={20}
                        rx={10}
                        fill={isActiveRegion ? rVis.badgeHex : '#1e293b'}
                        fillOpacity={isActiveRegion ? 0.9 : 0.72}
                        stroke={isActiveRegion ? rVis.borderHex : '#475569'}
                        strokeWidth={1.2}
                      />
                      <text
                        x={0}
                        y={3}
                        textAnchor="middle"
                        fill={isActiveRegion ? rVis.textHex : '#94a3b8'}
                        fontSize={9.5}
                        fontWeight={900}
                      >
                        {isActiveRegion
                          ? rVis.label.toUpperCase()
                          : `${rVis.label.toUpperCase()} (OFF)`}
                      </text>
                    </g>
                  </g>
                );
              })}
            </g>

            {/* 1B. METROPOLITAN MULTI-DISTRICT CLUSTERS (e.g. Greater Montréal & Québec City) */}
            {visualLayout.districtClusters && (
              <g pointerEvents="none">
                {visualLayout.districtClusters.map((dc) => (
                  <g key={dc.label}>
                    <ellipse
                      cx={dc.x}
                      cy={dc.y}
                      rx={dc.rx}
                      ry={dc.ry}
                      fill="rgba(56, 189, 248, 0.06)"
                      stroke="#38bdf8"
                      strokeWidth={1.6}
                      strokeDasharray="6 4"
                    />
                    <text
                      x={dc.x}
                      y={dc.y - dc.ry - 4}
                      textAnchor="middle"
                      fill="#7dd3fc"
                      fontSize={8.5}
                      fontWeight={900}
                    >
                      🏙️ {dc.label.toUpperCase()} MULTI-DISTRICT
                    </text>
                  </g>
                ))}
              </g>
            )}

            {/* 2. TRANSMISSION PIPES & COST BADGES */}
            <g>
              {mapDef.connections.map((edge, idx) => {
                const cFrom = visualLayout.cities[edge.from];
                const cTo = visualLayout.cities[edge.to];
                if (!cFrom || !cTo) return null;

                const isEdgeActive =
                  Boolean(state.cityBoard[edge.from]) &&
                  Boolean(state.cityBoard[edge.to]);
                const edgeKey = makeEdgeKey(edge.from, edge.to);
                const isHighlightedPipe = highlightedPipeEdgeKeys.has(edgeKey);
                const isFlashingPipe =
                  pendingBuildCityId !== null && isHighlightedPipe;

                const midX = (cFrom.x + cTo.x) / 2;
                const midY = (cFrom.y + cTo.y) / 2;

                return (
                  <g
                    key={`pipe_${idx}_${edge.from}_${edge.to}`}
                    opacity={isEdgeActive ? 1 : 0.25}
                    className={isFlashingPipe ? 'pg-flashing-preview' : undefined}
                  >
                    {/* Outer Pipe Casing */}
                    <line
                      x1={cFrom.x}
                      y1={cFrom.y}
                      x2={cTo.x}
                      y2={cTo.y}
                      stroke="#020617"
                      strokeWidth={isHighlightedPipe ? 7.5 : 5}
                      strokeLinecap="round"
                    />
                    {/* Inner Transmission Cable */}
                    <line
                      x1={cFrom.x}
                      y1={cFrom.y}
                      x2={cTo.x}
                      y2={cTo.y}
                      stroke={
                        isHighlightedPipe
                          ? '#fde047'
                          : edge.cost === 0
                            ? '#38bdf8'
                            : isEdgeActive
                              ? '#94a3b8'
                              : '#475569'
                      }
                      strokeWidth={isHighlightedPipe ? 4 : 2.3}
                      strokeLinecap="round"
                    />
                    {/* Pipe Cost Medallion */}
                    <circle
                      cx={midX}
                      cy={midY}
                      r={isHighlightedPipe ? 10.5 : 8.5}
                      fill={
                        isHighlightedPipe
                          ? '#fde047'
                          : edge.cost === 0
                            ? '#0369a1'
                            : '#0f172a'
                      }
                      stroke={
                        isHighlightedPipe
                          ? '#ffffff'
                          : isEdgeActive
                            ? '#cbd5e1'
                            : '#475569'
                      }
                      strokeWidth={1.3}
                    />
                    <text
                      x={midX}
                      y={midY + 3.2}
                      textAnchor="middle"
                      fill={isHighlightedPipe ? '#0f172a' : '#f8fafc'}
                      fontSize={8.8}
                      fontFamily="monospace"
                      fontWeight={900}
                    >
                      {edge.cost}
                    </text>
                  </g>
                );
              })}
            </g>

            {/* 3. CITY NODES WITH 3 CLASSIC HOUSE SLOTS ($10 / $15 / $20) */}
            <g>
              {mapDef.cities.map((cityDef) => {
                const pos = visualLayout.cities[cityDef.id];
                if (!pos) return null;

                const occ = state.cityBoard[cityDef.id];
                const isActiveCity = Boolean(occ);
                const rVis = visualLayout.regions[cityDef.regionId];
                const info = buildPreviewByCity[cityDef.id];

                const isPendingConfirm = pendingBuildCityId === cityDef.id;
                const isHovered = hoveredCityId === cityDef.id;
                const canClickToBuild =
                  isActiveCity &&
                  state.phase === PowerGridPhase.PHASE_4_BUILD_CITIES &&
                  isMyTurn &&
                  Boolean(info?.valid) &&
                  (info?.totalCost ?? Infinity) <= (selfPlayer.money ?? 0);

                // Which slot index (0, 1, or 2) will be claimed if built right now?
                const nextOpenSlotIndex = occ ? occ.owners.length : -1;

                return (
                  <g
                    key={cityDef.id}
                    transform={`translate(${pos.x}, ${pos.y})`}
                    opacity={isActiveCity ? 1 : 0.34}
                    style={{
                      cursor: canClickToBuild ? 'pointer' : 'default',
                    }}
                    onMouseEnter={() => setHoveredCityId(cityDef.id)}
                    onMouseLeave={() =>
                      setHoveredCityId((prev) =>
                        prev === cityDef.id ? null : prev
                      )
                    }
                    onClick={() => handleCityNodeClick(cityDef.id)}
                  >
                    {/* Outer City Box */}
                    <rect
                      x={-39}
                      y={-19}
                      width={78}
                      height={38}
                      rx={6}
                      fill={
                        !isActiveCity
                          ? '#1e293b'
                          : cityDef.isTransregional
                            ? '#082f49'
                            : '#0f172a'
                      }
                      stroke={
                        isPendingConfirm
                          ? '#fde047'
                          : isHovered && canClickToBuild
                            ? '#34d399'
                            : isActiveCity
                              ? cityDef.isTransregional
                                ? '#38bdf8'
                                : (rVis?.borderHex ?? '#94a3b8')
                              : '#475569'
                      }
                      strokeDasharray={
                        cityDef.isTransregional && !isPendingConfirm
                          ? '4 2'
                          : undefined
                      }
                      strokeWidth={
                        isPendingConfirm
                          ? 3
                          : isHovered && canClickToBuild
                            ? 2.4
                            : 1.6
                      }
                    />

                    {/* City Name Header */}
                    <text
                      x={0}
                      y={-7}
                      textAnchor="middle"
                      fill={
                        !isActiveCity
                          ? '#94a3b8'
                          : cityDef.isTransregional
                            ? '#bae6fd'
                            : '#f8fafc'
                      }
                      fontSize={7.8}
                      fontWeight={900}
                    >
                      {cityDef.isTransregional
                        ? `🌐${cityDef.name}`
                        : cityDef.name}
                    </text>

                    {/* 3 Classic House Slots: 10 | 15 | 20 (Transregional: — | 15 | 20) */}
                    {CITY_SLOT_COSTS.map((slotPrice, slotIdx) => {
                      const slotX = -32 + slotIdx * 22;
                      const isTrans = Boolean(cityDef.isTransregional);
                      const isPermanentlySealed = isTrans && slotIdx === 0;

                      const ownerId = isTrans
                        ? slotIdx === 0
                          ? undefined
                          : occ?.owners[slotIdx - 1]
                        : occ?.owners[slotIdx];

                      const ownerPlayer = ownerId
                        ? allPlayersById[ownerId]
                        : undefined;
                      const ownerCol = ownerPlayer
                        ? getPlayerColorStyle(ownerPlayer.color)
                        : null;

                      const isUnlockedByStep = isTrans
                        ? (slotIdx === 1 &&
                            (state.step === 'STEP_2' ||
                              state.step === 'STEP_3')) ||
                          (slotIdx === 2 && state.step === 'STEP_3')
                        : slotIdx < maxSlotsOpenForStep;

                      const expectedSlotIdxForNextBuild = isTrans
                        ? nextOpenSlotIndex + 1
                        : nextOpenSlotIndex;

                      const isFlashingTargetSlot =
                        isPendingConfirm &&
                        slotIdx === expectedSlotIdxForNextBuild;

                      return (
                        <g
                          key={slotPrice}
                          transform={`translate(${slotX}, -2)`}
                          className={
                            isFlashingTargetSlot
                              ? 'pg-flashing-preview'
                              : undefined
                          }
                        >
                          <rect
                            x={0}
                            y={0}
                            width={20}
                            height={17}
                            rx={3}
                            fill={
                              isFlashingTargetSlot
                                ? '#fde047'
                                : ownerCol
                                  ? ownerCol.fill
                                  : isPermanentlySealed
                                    ? '#020617'
                                    : isUnlockedByStep && isActiveCity
                                      ? '#1e293b'
                                      : '#090d16'
                            }
                            stroke={
                              isFlashingTargetSlot
                                ? '#ffffff'
                                : ownerCol
                                  ? ownerCol.stroke
                                  : isUnlockedByStep && isActiveCity
                                    ? '#64748b'
                                    : '#334155'
                            }
                            strokeWidth={ownerCol || isFlashingTargetSlot ? 1.5 : 1}
                          />
                          {ownerCol ? (
                            /* Little House Roof Silhouette inside occupied slot */
                            <polygon
                              points="10,3 3,9 5,9 5,14 15,14 15,9 17,9"
                              fill={ownerCol.text}
                            />
                          ) : (
                            <text
                              x={10}
                              y={11.5}
                              textAnchor="middle"
                              fill={
                                isFlashingTargetSlot
                                  ? '#0f172a'
                                  : isPermanentlySealed
                                    ? '#334155'
                                    : isUnlockedByStep && isActiveCity
                                      ? '#e2e8f0'
                                      : '#475569'
                              }
                              fontSize={8.2}
                              fontFamily="monospace"
                              fontWeight={800}
                            >
                              {isPermanentlySealed ? '—' : slotPrice}
                            </text>
                          )}
                        </g>
                      );
                    })}
                  </g>
                );
              })}
            </g>
          </svg>
        </div>

        {/* ----------------- BOARD BOTTOM: PHYSICAL RESOURCE MARKET TRACK ----------------- */}
        <div className="bg-gradient-to-r from-slate-900 via-slate-950 to-slate-900 border-t-2 border-slate-800 p-3 space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-black uppercase tracking-wider text-cyan-300">
                ⛽ Resource Market ($1–$16 Elektro)
              </span>
              <span className="text-[10px] text-slate-400">
                Coal: $
                {getNextUnitCost(state.resourceMarket, 'COAL') ?? 'Out'} • Oil: $
                {getNextUnitCost(state.resourceMarket, 'OIL') ?? 'Out'} •
                Garbage: $
                {getNextUnitCost(state.resourceMarket, 'GARBAGE') ?? 'Out'} •
                Uranium: $
                {getNextUnitCost(state.resourceMarket, 'URANIUM') ?? 'Out'}
              </span>
            </div>

            {/* Inline Phase 3 Resource Purchase Bar right on the Market */}
            {state.phase === PowerGridPhase.PHASE_3_BUY_RESOURCES && isMyTurn && (
              <div className="flex flex-wrap items-center gap-2 bg-cyan-950/50 border border-cyan-400/50 rounded-xl px-2.5 py-1.5 text-xs">
                <span className="text-cyan-200 font-bold">Plant:</span>
                {selfPlayer.powerPlants.map((p) => (
                  <button
                    key={p.card.id}
                    type="button"
                    onClick={() => setSelectedBuyPlantId(p.card.id)}
                    className={`px-2 py-0.5 rounded font-mono text-[11px] font-bold border cursor-pointer ${
                      selectedBuyPlantId === p.card.id
                        ? 'bg-cyan-400 text-slate-950 border-cyan-200'
                        : 'bg-slate-900 text-slate-300 border-slate-700'
                    }`}
                  >
                    #{p.card.id} ({getTotalStoredOnPlant(p)}/
                    {p.card.intakeCost * 2})
                  </button>
                ))}

                {ALL_POWER_GRID_RESOURCES.map((res) => (
                  <button
                    key={res}
                    type="button"
                    onClick={() => setSelectedBuyResource(res)}
                    className={`px-2 py-0.5 rounded text-[11px] font-bold border cursor-pointer ${
                      selectedBuyResource === res
                        ? 'bg-white text-slate-950 border-white'
                        : 'bg-slate-900 text-slate-300 border-slate-700'
                    }`}
                  >
                    {RESOURCE_META[res].icon}
                  </button>
                ))}

                <input
                  type="number"
                  min={1}
                  max={6}
                  value={selectedBuyQuantity}
                  onChange={(e) =>
                    setSelectedBuyQuantity(
                      Math.max(1, Math.min(6, Number(e.target.value) || 1))
                    )
                  }
                  className="w-12 px-1.5 py-0.5 rounded bg-slate-900 border border-slate-700 font-mono text-xs text-center text-white"
                />

                {(() => {
                  const targetPlant = selfPlayer.powerPlants.find(
                    (p) => p.card.id === selectedBuyPlantId
                  );
                  const estCost = calculateResourcePurchaseCost(
                    state.resourceMarket,
                    selectedBuyResource,
                    selectedBuyQuantity
                  );
                  const canStore =
                    targetPlant !== undefined &&
                    canPlantStoreResource(
                      targetPlant.card,
                      selectedBuyResource
                    ) &&
                    getPlantRemainingCapacity(
                      targetPlant,
                      selectedBuyResource
                    ) >= selectedBuyQuantity;
                  const canAfford =
                    estCost !== null && estCost <= (selfPlayer.money ?? 0);

                  return (
                    <button
                      type="button"
                      disabled={!canStore || !canAfford}
                      onClick={() => {
                        if (selectedBuyPlantId !== null) {
                          onDispatchAction({
                            type: 'PG_BUY_RESOURCES',
                            purchases: [
                              {
                                plantId: selectedBuyPlantId,
                                resource: selectedBuyResource,
                                quantity: selectedBuyQuantity,
                              },
                            ],
                          });
                        }
                      }}
                      className="px-3 py-1 rounded-lg bg-cyan-400 hover:bg-cyan-300 disabled:opacity-40 text-slate-950 font-black cursor-pointer"
                    >
                      Buy {selectedBuyQuantity} {RESOURCE_META[selectedBuyResource].icon}{' '}
                      {estCost !== null ? `($${estCost})` : '(Out)'}
                    </button>
                  );
                })()}

                <button
                  type="button"
                  onClick={() =>
                    onDispatchAction({ type: 'PG_FINISH_BUYING_RESOURCES' })
                  }
                  className="px-3 py-1 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black cursor-pointer"
                >
                  ✓ Done Buying
                </button>
              </div>
            )}
          </div>

          {/* Physical Price Boxes $1..$8 + Uranium $10..$16 */}
          <div className="overflow-x-auto pb-1">
            <div className="flex items-stretch gap-1.5 min-w-max">
              {/* Standard $1 through $8 Boxes (3 Coal, 3 Oil, 3 Garbage, 1 Uranium each) */}
              {Array.from({ length: 8 }, (_, boxIdx) => {
                const dollar = boxIdx + 1;
                return (
                  <div
                    key={`mkt_${dollar}`}
                    className="rounded-xl bg-slate-900 border border-slate-700 p-1.5 flex flex-col gap-1 min-w-[92px]"
                  >
                    <div className="text-center font-mono font-black text-xs text-amber-300 border-b border-slate-800 pb-0.5">
                      ${dollar}
                    </div>
                    {(['COAL', 'OIL', 'GARBAGE'] as const).map((res) => (
                      <div
                        key={res}
                        className="flex items-center justify-center gap-1"
                      >
                        {[0, 1, 2].map((subIdx) => {
                          const slotIndex = boxIdx * 3 + subIdx;
                          const filled = isMarketSlotFilled(res, slotIndex, 24);
                          const rm = RESOURCE_META[res];
                          return (
                            <span
                              key={subIdx}
                              style={{
                                width: 22,
                                height: 18,
                                borderRadius: 4,
                                background: filled ? rm.tokenBg : '#020617',
                                border: `1px solid ${filled ? rm.tokenBorder : '#1e293b'}`,
                                opacity: filled ? 1 : 0.35,
                              }}
                              className="flex items-center justify-center text-[10px]"
                            >
                              {filled ? rm.icon : ''}
                            </span>
                          );
                        })}
                      </div>
                    ))}
                    {/* 1 Uranium slot in $1..$8 */}
                    <div className="flex items-center justify-center pt-0.5 border-t border-slate-800/70">
                      {(() => {
                        const filled = isMarketSlotFilled('URANIUM', boxIdx, 12);
                        const rm = RESOURCE_META['URANIUM'];
                        return (
                          <span
                            style={{
                              width: 26,
                              height: 18,
                              borderRadius: 4,
                              background: filled ? rm.tokenBg : '#020617',
                              border: `1px solid ${filled ? rm.tokenBorder : '#1e293b'}`,
                              opacity: filled ? 1 : 0.35,
                            }}
                            className="flex items-center justify-center text-[10px]"
                          >
                            {filled ? rm.icon : ''}
                          </span>
                        );
                      })()}
                    </div>
                  </div>
                );
              })}

              {/* High-Scarcity Uranium Boxes: $10, $12, $14, $16 */}
              {[10, 12, 14, 16].map((uPrice, idx) => {
                const slotIndex = 8 + idx;
                const filled = isMarketSlotFilled('URANIUM', slotIndex, 12);
                const rm = RESOURCE_META['URANIUM'];
                return (
                  <div
                    key={`u_${uPrice}`}
                    className="rounded-xl bg-rose-950/25 border border-rose-800/60 p-1.5 flex flex-col items-center justify-between min-w-[54px]"
                  >
                    <div className="text-center font-mono font-black text-xs text-rose-300 border-b border-rose-900/50 w-full pb-0.5">
                      ${uPrice}
                    </div>
                    <div className="text-[9px] text-rose-300/70 font-bold">
                      Uranium
                    </div>
                    <span
                      style={{
                        width: 28,
                        height: 24,
                        borderRadius: 6,
                        background: filled ? rm.tokenBg : '#020617',
                        border: `1.5px solid ${filled ? rm.tokenBorder : '#334155'}`,
                        opacity: filled ? 1 : 0.35,
                      }}
                      className="flex items-center justify-center text-xs"
                    >
                      {filled ? rm.icon : ''}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* =====================================================================
          4. PLAYER CORPORATIONS & ILLUSTRATED OWNED POWER PLANTS
         ===================================================================== */}
      <div className="rounded-2xl bg-slate-900/80 border border-slate-800 p-3.5 shadow-xl">
        <div className="text-xs font-extrabold uppercase tracking-wider text-slate-300 mb-2.5">
          👥 Player Corporations, Elektro &amp; Owned Power Plants
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {allPlayersOrdered.map((p) => {
            const isActor = state.activePlayerId === p.id;
            const pCol = getPlayerColorStyle(p.color);
            return (
              <div
                key={p.id}
                className={`rounded-xl border p-3 space-y-2.5 ${
                  isActor
                    ? 'bg-amber-950/20 border-amber-400/70'
                    : 'bg-slate-950/75 border-slate-800'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      style={{
                        width: 13,
                        height: 13,
                        borderRadius: 3,
                        background: pCol.fill,
                        border: `1.5px solid ${pCol.stroke}`,
                        flexShrink: 0,
                      }}
                    />
                    <span className="font-extrabold text-sm text-white truncate">
                      {getName(p.id)}
                    </span>
                    {p.id === viewingPlayerId && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 font-bold">
                        YOU
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 font-mono text-xs shrink-0">
                    <span className="text-emerald-400 font-bold">
                      {p.money !== null ? `$${p.money}` : '🔒 Elektro'}
                    </span>
                    <span className="px-2 py-0.5 rounded bg-slate-800 text-amber-300 font-bold">
                      🏠 {p.cityCount}
                    </span>
                  </div>
                </div>

                {p.powerPlants.length === 0 ? (
                  <div className="text-xs text-slate-500 italic py-2 text-center border border-dashed border-slate-800 rounded-lg">
                    No Power Plants owned yet
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {p.powerPlants.map((owned) => (
                      <PowerPlantCardVisual
                        key={owned.card.id}
                        card={owned.card}
                        ownedPlant={owned}
                        compact={true}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* =====================================================================
          5. CENTERED POWER PLANT MARKET & AUCTION WINDOW (MODAL OVERLAY)
         ===================================================================== */}
      {isMarketWindowOpen && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setIsMarketWindowOpen(false)}
        >
          <div
            className="w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-2xl bg-gradient-to-b from-slate-900 to-slate-950 border-2 border-amber-400/80 shadow-2xl p-5 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
              <div>
                <h2 className="text-base font-black text-amber-300 flex items-center gap-2">
                  🏭 Power Plant Market &amp; Auction Floor
                  <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 text-xs font-mono">
                    Draw Deck: {state.drawDeckCount} cards
                  </span>
                </h2>
                <p className="text-xs text-slate-400">
                  {state.phase === PowerGridPhase.PHASE_2_AUCTION_POWER_PLANTS
                    ? `Active Bidder: ${getName(state.activePlayerId)} • Your Elektro: $${selfPlayer.money ?? 0}`
                    : 'Inspect Actual Market (top row) and Future Market (bottom row). Bidding occurs in Phase 2.'}
                </p>
              </div>

              <div className="flex items-center gap-2">
                {state.phase === PowerGridPhase.PHASE_2_AUCTION_POWER_PLANTS && (
                  <button
                    type="button"
                    onClick={() => onDispatchAction({ type: 'PG_AI_TURN' })}
                    className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold cursor-pointer"
                  >
                    🤖 AI Bid ({getName(state.activePlayerId)})
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setIsMarketWindowOpen(false)}
                  className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-200 text-xs font-extrabold cursor-pointer"
                >
                  ✕ Close Window
                </button>
              </div>
            </div>

            {/* Active Auction Controls inside Modal */}
            {state.phase === PowerGridPhase.PHASE_2_AUCTION_POWER_PLANTS &&
              state.auction && (
                <div className="rounded-xl bg-slate-950/90 border border-amber-500/40 p-3.5 space-y-3">
                  {state.auction.pendingPlantDiscard ? (
                    <div className="space-y-2">
                      <div className="text-xs font-bold text-rose-300">
                        ⚠️ Maximum Capacity ({cfg.maxPlantsPerPlayer} Plants)!{' '}
                        {getName(state.auction.pendingPlantDiscard.playerId)}{' '}
                        must discard an existing Power Plant to keep Plant #
                        {state.auction.pendingPlantDiscard.newlyWonPlant.id}:
                      </div>
                      {isMyTurn && (
                        <div className="flex flex-wrap gap-2">
                          {selfPlayer.powerPlants.map((p) => (
                            <button
                              key={p.card.id}
                              type="button"
                              onClick={() =>
                                onDispatchAction({
                                  type: 'PG_DISCARD_PLANT',
                                  discardPlantId: p.card.id,
                                })
                              }
                              className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold cursor-pointer"
                            >
                              🗑️ Discard Plant #{p.card.id} (🏠
                              {p.card.citiesPowered})
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : state.auction.activePlant ? (
                    <div className="flex flex-wrap items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className="w-36 shrink-0">
                          <PowerPlantCardVisual
                            card={state.auction.activePlant}
                            isActiveAuction={true}
                            compact={true}
                          />
                        </div>
                        <div className="space-y-1">
                          <div className="text-xs uppercase font-black text-amber-300">
                            🔨 On the Auction Block
                          </div>
                          <div className="text-base font-black text-white">
                            High Bid: ${state.auction.currentBid} by{' '}
                            {getName(state.auction.highBidderId)}
                          </div>
                          <div className="text-xs text-slate-400">
                            Eligible Bidders:{' '}
                            {state.auction.eligibleBidders
                              .map((id) => getName(id))
                              .join(' → ')}
                          </div>
                        </div>
                      </div>

                      {isMyTurn ? (
                        <div className="flex flex-wrap items-center gap-2">
                          <input
                            type="number"
                            min={state.auction.currentBid + 1}
                            max={Math.max(
                              state.auction.currentBid + 1,
                              selfPlayer.money ?? 0
                            )}
                            value={raiseBidAmount}
                            onChange={(e) =>
                              setRaiseBidAmount(
                                Math.max(
                                  state.auction!.currentBid + 1,
                                  Number(e.target.value) ||
                                    state.auction!.currentBid + 1
                                )
                              )
                            }
                            className="w-20 px-2.5 py-2 rounded-lg bg-slate-900 border border-slate-700 font-mono text-xs text-white"
                          />
                          <button
                            type="button"
                            disabled={raiseBidAmount > (selfPlayer.money ?? 0)}
                            onClick={() =>
                              onDispatchAction({
                                type: 'PG_RAISE_BID',
                                bid: raiseBidAmount,
                              })
                            }
                            className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-slate-950 font-black text-xs cursor-pointer"
                          >
                            ⬆️ Raise to ${raiseBidAmount}
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              onDispatchAction({ type: 'PG_PASS_CURRENT_BID' })
                            }
                            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-rose-950 text-slate-200 font-bold text-xs border border-slate-700 cursor-pointer"
                          >
                            🏳️ Pass Bid
                          </button>
                        </div>
                      ) : (
                        <div className="text-xs text-amber-200 font-semibold">
                          Waiting for {getName(state.activePlayerId)} to bid or
                          pass...
                        </div>
                      )}
                    </div>
                  ) : isMyTurn ? (
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="text-xs text-slate-200">
                        Click a plant in the <strong>Actual Market</strong> below
                        (Selected:{' '}
                        <strong className="text-sky-300">
                          #{selectedAuctionPlantId ?? '—'}
                        </strong>
                        ) to open bidding:
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs text-slate-400">
                          Opening Bid $:
                        </span>
                        <input
                          type="number"
                          min={selectedAuctionPlantId ?? 3}
                          max={Math.max(
                            selectedAuctionPlantId ?? 3,
                            selfPlayer.money ?? 0
                          )}
                          value={openingBidAmount}
                          onChange={(e) =>
                            setOpeningBidAmount(
                              Math.max(
                                selectedAuctionPlantId ?? 3,
                                Number(e.target.value) ||
                                  (selectedAuctionPlantId ?? 3)
                              )
                            )
                          }
                          className="w-20 px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 font-mono text-xs text-white"
                        />
                        <button
                          type="button"
                          disabled={
                            selectedAuctionPlantId === null ||
                            openingBidAmount < selectedAuctionPlantId ||
                            openingBidAmount > (selfPlayer.money ?? 0)
                          }
                          onClick={() => {
                            if (selectedAuctionPlantId !== null) {
                              onDispatchAction({
                                type: 'PG_OPEN_AUCTION',
                                plantId: selectedAuctionPlantId,
                                bid: openingBidAmount,
                              });
                            }
                          }}
                          className="px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 disabled:opacity-40 text-slate-950 font-black text-xs cursor-pointer"
                        >
                          🔨 Open Auction (#{selectedAuctionPlantId} @ $
                          {openingBidAmount})
                        </button>
                        {state.roundNumber > 1 && (
                          <button
                            type="button"
                            onClick={() =>
                              onDispatchAction({
                                type: 'PG_PASS_AUCTION_PHASE',
                              })
                            }
                            className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs border border-slate-700 cursor-pointer"
                          >
                            ⏭️ Pass Entire Auction
                          </button>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="text-xs text-slate-300">
                      Waiting for{' '}
                      <strong className="text-amber-300">
                        {getName(state.activePlayerId)}
                      </strong>{' '}
                      to select a plant for auction...
                    </div>
                  )}
                </div>
              )}

            {/* ACTUAL MARKET (Illustrated Cards) */}
            <div>
              <div className="text-xs font-black uppercase tracking-wider text-amber-300 mb-2">
                ⚡ Actual Market — Available for Auction Now
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {state.actualMarket.map((card) => {
                  const canSelectForAuction =
                    state.phase ===
                      PowerGridPhase.PHASE_2_AUCTION_POWER_PLANTS &&
                    state.auction?.activePlant === null &&
                    isMyTurn;
                  return (
                    <PowerPlantCardVisual
                      key={card.id}
                      card={card}
                      isSelectable={canSelectForAuction}
                      isSelected={selectedAuctionPlantId === card.id}
                      isActiveAuction={
                        state.auction?.activePlant?.id === card.id
                      }
                      onClick={() => {
                        setSelectedAuctionPlantId(card.id);
                        setOpeningBidAmount(card.id);
                      }}
                    />
                  );
                })}
              </div>
            </div>

            {/* FUTURE MARKET (Illustrated Cards) */}
            {state.futureMarket.length > 0 && (
              <div className="pt-3 border-t border-slate-800">
                <div className="text-xs font-black uppercase tracking-wider text-slate-400 mb-2">
                  🔮 Future Market — Next in Queue (Merged in Step 3)
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 opacity-90">
                  {state.futureMarket.map((card) => (
                    <PowerPlantCardVisual key={card.id} card={card} />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
