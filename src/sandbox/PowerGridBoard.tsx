import React, { useEffect, useState } from 'react';
import {
  ALL_POWER_GRID_RESOURCES,
  calculateCityBuildCost,
  calculateResourcePurchaseCost,
  canPlantStoreResource,
  FuelBurnAllocation,
  getBureaucracyPayout,
  getMaxCitySlotsForStep,
  getNextUnitCost,
  getPlantRemainingCapacity,
  getTotalStoredOnPlant,
  OwnedPowerPlant,
  PLAYER_COUNT_CONFIGS,
  POWER_GRID_MAPS,
  PowerGridAction,
  PowerGridPhase,
  PowerGridResource,
  PowerPlantCard,
  RESOURCE_PRICE_SLOTS,
  SanitizedPowerGridPlayerState,
  SanitizedPowerGridState,
} from '../games/power-grid/index.js';

export interface PowerGridBoardProps {
  readonly state: SanitizedPowerGridState;
  readonly viewingPlayerId: string;
  readonly playerNames: Readonly<Record<string, string>>;
  readonly onDispatchAction: (action: PowerGridAction) => void;
}

const RESOURCE_META: Readonly<
  Record<
    PowerGridResource,
    { readonly label: string; readonly icon: string; readonly badge: string }
  >
> = {
  COAL: {
    label: 'Coal',
    icon: '🪨',
    badge: 'bg-amber-900/40 text-amber-200 border-amber-600/50',
  },
  OIL: {
    label: 'Oil',
    icon: '🛢️',
    badge: 'bg-slate-800 text-slate-200 border-slate-500/50',
  },
  GARBAGE: {
    label: 'Garbage',
    icon: '♻️',
    badge: 'bg-yellow-500/20 text-yellow-200 border-yellow-400/50',
  },
  URANIUM: {
    label: 'Uranium',
    icon: '☢️',
    badge: 'bg-rose-500/20 text-rose-200 border-rose-400/50',
  },
};

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
  const cfg =
    PLAYER_COUNT_CONFIGS[state.turnOrder.length] ?? PLAYER_COUNT_CONFIGS[4]!;

  // Auto-AI Opponents toggle
  const [autoAiOpponents, setAutoAiOpponents] = useState<boolean>(false);

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

  const allPlayersOrdered: SanitizedPowerGridPlayerState[] =
    state.turnOrder.map((pid) =>
      pid === selfPlayer.id ? selfPlayer : state.opponents[pid]!
    );

  const renderPlantTypeBadge = (card: PowerPlantCard) => {
    switch (card.resourceType) {
      case 'COAL':
        return (
          <span className="px-2 py-0.5 rounded bg-amber-900/50 text-amber-200 border border-amber-600/50 text-[10px] font-bold">
            🪨 {card.intakeCost} Coal
          </span>
        );
      case 'OIL':
        return (
          <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-200 border border-slate-500/50 text-[10px] font-bold">
            🛢️ {card.intakeCost} Oil
          </span>
        );
      case 'HYBRID':
        return (
          <span className="px-2 py-0.5 rounded bg-orange-950/70 text-orange-200 border border-orange-500/50 text-[10px] font-bold">
            🪨/🛢️ {card.intakeCost} Hybrid
          </span>
        );
      case 'GARBAGE':
        return (
          <span className="px-2 py-0.5 rounded bg-yellow-500/20 text-yellow-200 border border-yellow-400/50 text-[10px] font-bold">
            ♻️ {card.intakeCost} Garbage
          </span>
        );
      case 'URANIUM':
        return (
          <span className="px-2 py-0.5 rounded bg-rose-500/20 text-rose-200 border border-rose-400/50 text-[10px] font-bold">
            ☢️ {card.intakeCost} Uranium
          </span>
        );
      case 'ECOLOGICAL':
        return (
          <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-200 border border-emerald-400/50 text-[10px] font-bold">
            🍃 Eco (0 Fuel)
          </span>
        );
      default:
        return null;
    }
  };

  const renderPlantCard = (
    card: PowerPlantCard,
    isSelectableAuction: boolean,
    isSelected: boolean
  ) => (
    <div
      key={card.id}
      onClick={() => {
        if (isSelectableAuction) {
          setSelectedAuctionPlantId(card.id);
          setOpeningBidAmount(card.id);
        }
      }}
      className={`rounded-xl border p-3 transition flex flex-col justify-between gap-2 ${
        isSelectableAuction ? 'cursor-pointer' : ''
      } ${
        isSelected
          ? 'bg-amber-500/20 border-amber-400 ring-2 ring-amber-400/40 shadow-lg'
          : 'bg-slate-950/85 border-slate-800 hover:border-slate-700'
      }`}
    >
      <div className="flex items-center justify-between">
        <span className="px-2.5 py-0.5 rounded-lg bg-slate-900 border border-slate-700 font-mono font-black text-base text-white">
          #{card.id.toString().padStart(2, '0')}
        </span>
        <span className="px-2 py-0.5 rounded-md bg-cyan-500/20 border border-cyan-400/40 text-cyan-200 font-mono font-bold text-xs">
          ⚡ Powers {card.citiesPowered}{' '}
          {card.citiesPowered === 1 ? 'City' : 'Cities'}
        </span>
      </div>
      <div className="flex items-center justify-between pt-1">
        {renderPlantTypeBadge(card)}
        <span className="text-[10px] font-mono text-slate-400">
          Min Bid: ${card.id}
        </span>
      </div>
    </div>
  );

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

  return (
    <div className="space-y-5 text-slate-100">
      {/* Top Status & Phase Banner */}
      <div className="rounded-2xl bg-slate-900/90 border border-amber-500/40 p-4 flex flex-wrap items-center justify-between gap-4 shadow-xl">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-md bg-amber-500/20 border border-amber-400/50 text-amber-300 text-xs font-extrabold uppercase">
              ⚡ Power Grid ({mapDef.name})
            </span>
            <span className="px-2.5 py-0.5 rounded-md bg-cyan-500/20 border border-cyan-400/40 text-cyan-300 text-xs font-bold font-mono">
              Round {state.roundNumber} • {state.step.replace('_', ' ')}
            </span>
            <span className="px-2.5 py-0.5 rounded-md bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 text-xs font-bold">
              Phase: {state.phase.replace(/^PHASE_\d_/, '').replace(/_/g, ' ')}
            </span>
            <span className="text-xs text-slate-400 font-mono">
              Step 2 at {cfg.step2TriggerCities} Cities • End at{' '}
              {cfg.gameEndTriggerCities} Cities
            </span>
          </div>
          <div className="text-xs text-slate-300">
            <strong>Turn Order:</strong>{' '}
            {state.turnOrder.map((pid, idx) => (
              <span
                key={pid}
                className={`inline-block mr-2 px-2 py-0.5 rounded font-mono ${
                  pid === state.activePlayerId
                    ? 'bg-amber-400 text-slate-950 font-black'
                    : 'bg-slate-800 text-slate-300'
                }`}
              >
                {idx + 1}. {getName(pid)} ({ pid === selfPlayer.id ? selfPlayer.cityCount : state.opponents[pid]?.cityCount ?? 0 }🏙️)
              </span>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {state.phase !== PowerGridPhase.GAME_OVER && (
            <button
              type="button"
              onClick={() => onDispatchAction({ type: 'PG_AI_TURN' })}
              className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-extrabold shadow transition cursor-pointer"
            >
              🤖 Let AI Play Turn ({getName(state.activePlayerId)})
            </button>
          )}
          <label className="flex items-center gap-1.5 text-xs text-slate-300 bg-slate-800/80 px-3 py-2 rounded-xl border border-slate-700 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={autoAiOpponents}
              onChange={(e) => setAutoAiOpponents(e.target.checked)}
              className="accent-amber-400"
            />
            <span>Auto-AI Opponents</span>
          </label>
        </div>
      </div>

      {/* Last Action Summary Toast */}
      {state.lastActionSummary && (
        <div className="rounded-xl bg-slate-950/90 border border-slate-800 px-4 py-2 text-xs text-amber-200 flex items-center justify-between">
          <span>
            <strong className="text-slate-400 uppercase mr-2">Last Event:</strong>
            {state.lastActionSummary}
          </span>
          <span className="font-mono text-slate-500">
            Draw Deck: {state.drawDeckCount} cards
          </span>
        </div>
      )}

      {/* =====================================================================
          ACTIVE PHASE ACTION CONSOLE
         ===================================================================== */}

      {/* PHASE 2: AUCTION POWER PLANTS CONSOLE */}
      {state.phase === PowerGridPhase.PHASE_2_AUCTION_POWER_PLANTS &&
        state.auction && (
          <div className="rounded-2xl bg-gradient-to-r from-amber-950/60 to-slate-900 border-2 border-amber-400/60 p-4 shadow-xl space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-extrabold uppercase tracking-wider text-amber-300">
                🔨 Phase 2: Power Plant Auction — Active Actor:{' '}
                {getName(state.activePlayerId)}
              </h3>
              <span className="text-xs text-slate-300 font-mono">
                Your Elektro: <strong>${selfPlayer.money}</strong>
              </span>
            </div>

            {state.auction.pendingPlantDiscard ? (
              <div className="space-y-2 bg-slate-950/80 p-3 rounded-xl border border-rose-500/50">
                <div className="text-xs font-bold text-rose-300">
                  ⚠️ Plant Capacity Reached ({cfg.maxPlantsPerPlayer} Plants Max)!{' '}
                  {getName(state.auction.pendingPlantDiscard.playerId)} must choose
                  an existing Power Plant to discard to make room for Plant #
                  {state.auction.pendingPlantDiscard.newlyWonPlant.id}:
                </div>
                {isMyTurn && (
                  <div className="flex flex-wrap gap-2 pt-1">
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
                        🗑️ Discard Plant #{p.card.id} (Powers{' '}
                        {p.card.citiesPowered})
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : state.auction.activePlant ? (
              <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-950/80 p-3.5 rounded-xl border border-amber-500/40">
                <div>
                  <div className="text-xs text-amber-300 font-bold uppercase">
                    Active Auction Block: Power Plant #
                    {state.auction.activePlant.id} (Powers{' '}
                    {state.auction.activePlant.citiesPowered} Cities)
                  </div>
                  <div className="text-sm font-extrabold text-white mt-0.5">
                    Current High Bid: ${state.auction.currentBid} by{' '}
                    {getName(state.auction.highBidderId)}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    Remaining Bidders:{' '}
                    {state.auction.eligibleBidders
                      .map((id) => getName(id))
                      .join(', ')}
                  </div>
                </div>

                {isMyTurn && (
                  <div className="flex items-center gap-2">
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
                      className="w-20 px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 font-mono text-xs text-white"
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
                      className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-slate-950 font-extrabold text-xs cursor-pointer"
                    >
                      ⬆️ Raise Bid (${raiseBidAmount})
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        onDispatchAction({ type: 'PG_PASS_CURRENT_BID' })
                      }
                      className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-rose-950 text-slate-200 font-bold text-xs border border-slate-700 cursor-pointer"
                    >
                      🏳️ Pass on Plant #{state.auction.activePlant.id}
                    </button>
                  </div>
                )}
              </div>
            ) : (
              isMyTurn && (
                <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-950/80 p-3 rounded-xl border border-slate-800">
                  <div className="text-xs text-slate-300">
                    Click a Power Plant in the <strong>Actual Market</strong>{' '}
                    below (selected:{' '}
                    <strong className="text-amber-300">
                      #{selectedAuctionPlantId ?? '—'}
                    </strong>
                    ) to put it up for auction:
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-400">Opening Bid $:</span>
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
                      className="px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 disabled:opacity-40 text-slate-950 font-extrabold text-xs cursor-pointer"
                    >
                      🔨 Open Auction (#{selectedAuctionPlantId} @ $
                      {openingBidAmount})
                    </button>
                    {state.roundNumber > 1 && (
                      <button
                        type="button"
                        onClick={() =>
                          onDispatchAction({ type: 'PG_PASS_AUCTION_PHASE' })
                        }
                        className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs border border-slate-700 cursor-pointer"
                      >
                        ⏭️ Pass Auction Phase
                      </button>
                    )}
                  </div>
                </div>
              )
            )}
          </div>
        )}

      {/* PHASE 3: BUY RESOURCES CONSOLE */}
      {state.phase === PowerGridPhase.PHASE_3_BUY_RESOURCES && isMyTurn && (
        <div className="rounded-2xl bg-gradient-to-r from-cyan-950/70 to-slate-900 border-2 border-cyan-400/60 p-4 shadow-xl space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-extrabold uppercase tracking-wider text-cyan-300">
                🛢️ Phase 3: Buy Fuel Resources ({getName(selfPlayer.id)})
              </h3>
              <p className="text-xs text-slate-300">
                Select one of your Power Plants and buy compatible fuel from the Resource Market (up to 2x intake capacity):
              </p>
            </div>
            <button
              type="button"
              onClick={() =>
                onDispatchAction({ type: 'PG_FINISH_BUYING_RESOURCES' })
              }
              className="px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-xs shadow-lg cursor-pointer"
            >
              ✅ Finish Buying Resources
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-3 bg-slate-950/80 p-3 rounded-xl border border-slate-800">
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400">Target Plant:</span>
              {selfPlayer.powerPlants.map((p) => (
                <button
                  key={p.card.id}
                  type="button"
                  onClick={() => setSelectedBuyPlantId(p.card.id)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold border cursor-pointer ${
                    selectedBuyPlantId === p.card.id
                      ? 'bg-cyan-400 text-slate-950 border-cyan-300'
                      : 'bg-slate-900 text-slate-300 border-slate-700'
                  }`}
                >
                  #{p.card.id} ({p.card.resourceType} •{' '}
                  {getTotalStoredOnPlant(p)}/{p.card.intakeCost * 2} stored)
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400">Resource:</span>
              {ALL_POWER_GRID_RESOURCES.map((res) => (
                <button
                  key={res}
                  type="button"
                  onClick={() => setSelectedBuyResource(res)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold border cursor-pointer ${
                    selectedBuyResource === res
                      ? 'bg-white text-slate-950 border-white'
                      : 'bg-slate-900 text-slate-300 border-slate-700'
                  }`}
                >
                  {RESOURCE_META[res].icon} {RESOURCE_META[res].label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400">Qty:</span>
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
                className="w-14 px-2 py-1 rounded bg-slate-900 border border-slate-700 font-mono text-xs text-center text-white"
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
                  canPlantStoreResource(targetPlant.card, selectedBuyResource) &&
                  getPlantRemainingCapacity(targetPlant, selectedBuyResource) >=
                    selectedBuyQuantity;
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
                    className="px-4 py-1.5 rounded-xl bg-cyan-400 hover:bg-cyan-300 disabled:opacity-40 text-slate-950 font-extrabold text-xs cursor-pointer"
                  >
                    🛒 Buy {selectedBuyQuantity} {selectedBuyResource}{' '}
                    {estCost !== null ? `($${estCost})` : '(Out of Stock)'}
                  </button>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* PHASE 4: BUILD CITIES CONSOLE */}
      {state.phase === PowerGridPhase.PHASE_4_BUILD_CITIES && isMyTurn && (
        <div className="rounded-2xl bg-gradient-to-r from-emerald-950/70 to-slate-900 border-2 border-emerald-400/60 p-4 shadow-xl flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-extrabold uppercase tracking-wider text-emerald-300">
              🏗️ Phase 4: Build Cities in Your Network ({getName(selfPlayer.id)})
            </h3>
            <p className="text-xs text-slate-300">
              Click any available city card in the <strong>City Grid</strong>{' '}
              below to connect it (Slot Cost + Shortest Pipe Cost), or finish building:
            </p>
          </div>
          <button
            type="button"
            onClick={() =>
              onDispatchAction({ type: 'PG_FINISH_BUILDING_CITIES' })
            }
            className="px-5 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-extrabold text-xs shadow-lg cursor-pointer"
          >
            ✅ Finish Building Cities
          </button>
        </div>
      )}

      {/* PHASE 5: BUREAUCRACY POWER CITIES CONSOLE */}
      {state.phase === PowerGridPhase.PHASE_5_BUREAUCRACY && isMyTurn && (
        <div className="rounded-2xl bg-gradient-to-r from-indigo-950/80 to-slate-900 border-2 border-indigo-400/60 p-4 shadow-xl flex flex-wrap items-center justify-between gap-3">
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
                <div>
                  <h3 className="text-sm font-extrabold uppercase tracking-wider text-indigo-300">
                    ⚡ Phase 5: Bureaucracy — Generate Electricity ({getName(selfPlayer.id)})
                  </h3>
                  <p className="text-xs text-slate-300">
                    Your fueled plants can power{' '}
                    <strong className="text-emerald-300">
                      {actualPowered} of your {selfPlayer.cityCount} connected
                      cities
                    </strong>{' '}
                    for an Elektro payout of{' '}
                    <strong className="text-amber-300">+${reward}</strong>!
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    onDispatchAction({
                      type: 'PG_POWER_CITIES',
                      allocations: defaultAllocs,
                    })
                  }
                  className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-xs shadow-lg cursor-pointer"
                >
                  ⚡ Power {actualPowered} Cities & Claim +${reward} Elektro
                </button>
              </>
            );
          })()}
        </div>
      )}

      {/* =====================================================================
          POWER PLANT MARKETS & RESOURCE MARKET GRID
         ===================================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Power Plant Market (7 cols) */}
        <div className="lg:col-span-7 rounded-2xl bg-slate-900/80 border border-slate-800 p-4 shadow-xl space-y-3">
          <div>
            <div className="text-xs font-extrabold uppercase tracking-wider text-amber-300 mb-2">
              🏭 Actual Market (Available for Auction in Phase 2)
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {state.actualMarket.map((card) =>
                renderPlantCard(
                  card,
                  state.phase === PowerGridPhase.PHASE_2_AUCTION_POWER_PLANTS &&
                    state.auction?.activePlant === null,
                  selectedAuctionPlantId === card.id
                )
              )}
            </div>
          </div>

          {state.futureMarket.length > 0 && (
            <div className="pt-2 border-t border-slate-800">
              <div className="text-xs font-extrabold uppercase tracking-wider text-slate-400 mb-2">
                🔮 Future Market (Upcoming Plants — Unlocked in Step 3)
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 opacity-80">
                {state.futureMarket.map((card) =>
                  renderPlantCard(card, false, false)
                )}
              </div>
            </div>
          )}
        </div>

        {/* Resource Market Supply/Demand Ladder (5 cols) */}
        <div className="lg:col-span-5 rounded-2xl bg-slate-900/80 border border-slate-800 p-4 shadow-xl space-y-3">
          <div className="text-xs font-extrabold uppercase tracking-wider text-cyan-300">
            ⛽ Resource Market Supply & Scarcity Ladder
          </div>
          <div className="space-y-2.5">
            {ALL_POWER_GRID_RESOURCES.map((res) => {
              const meta = RESOURCE_META[res];
              const inMarket = state.resourceMarket.inventory[res];
              const maxSlots = RESOURCE_PRICE_SLOTS[res].length;
              const nextPrice = getNextUnitCost(state.resourceMarket, res);

              return (
                <div
                  key={res}
                  className="rounded-xl bg-slate-950/80 border border-slate-800 p-2.5 space-y-1.5"
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-white">
                      {meta.icon} {meta.label}
                    </span>
                    <div className="flex items-center gap-2 font-mono">
                      <span className="text-slate-400">
                        Stock: <strong className="text-white">{inMarket}</strong>/{maxSlots}
                      </span>
                      <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold">
                        {nextPrice !== null ? `Next: $${nextPrice}` : 'Sold Out'}
                      </span>
                    </div>
                  </div>
                  <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                    <div
                      className="h-full bg-cyan-400 transition-all"
                      style={{
                        width: `${Math.round((inMarket / maxSlots) * 100)}%`,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* =====================================================================
          INTERACTIVE CITY GRID & DIJKSTRA CONNECTION CALCULATOR
         ===================================================================== */}
      <div className="rounded-2xl bg-slate-900/80 border border-slate-800 p-4 shadow-xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-extrabold uppercase tracking-wider text-slate-200">
              🗺️ {mapDef.name} Power Grid Topology ({state.activeRegions.length} Active Regions)
            </h3>
            <p className="text-xs text-slate-400">
              Open Slots in {state.step.replace('_', ' ')}: Up to{' '}
              {getMaxCitySlotsForStep(state.step)} player(s) per city ($10 / $15
              / $20). Pipe costs calculated automatically via Dijkstra shortest path.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {state.activeRegions.map((regionId) => {
            const regionCities = mapDef.cities.filter(
              (c) => c.regionId === regionId && state.cityBoard[c.id]
            );
            return (
              <div
                key={regionId}
                className="rounded-xl bg-slate-950/80 border border-slate-800 p-3 space-y-2"
              >
                <div className="text-xs font-extrabold uppercase tracking-wider text-amber-300 border-b border-slate-800 pb-1.5">
                  📍 Region: {regionId.replace(/_/g, ' ')}
                </div>
                <div className="space-y-1.5">
                  {regionCities.map((cityDef) => {
                    const occ = state.cityBoard[cityDef.id]!;
                    const buildCost = calculateCityBuildCost(
                      state.mapId,
                      state.cityBoard,
                      state.step,
                      selfPlayer.id,
                      selfPlayer.cities,
                      cityDef.id
                    );
                    const canBuildNow =
                      state.phase === PowerGridPhase.PHASE_4_BUILD_CITIES &&
                      isMyTurn &&
                      buildCost.valid &&
                      buildCost.totalCost <= (selfPlayer.money ?? 0);

                    return (
                      <div
                        key={cityDef.id}
                        className="rounded-lg bg-slate-900/90 border border-slate-800/90 px-2.5 py-2 flex items-center justify-between gap-2 text-xs"
                      >
                        <div>
                          <div className="font-bold text-slate-100">
                            {cityDef.name}
                          </div>
                          <div className="text-[10px] text-slate-400">
                            Owners:{' '}
                            {occ.owners.length > 0
                              ? occ.owners.map((id) => getName(id)).join(', ')
                              : 'None ($10 Slot Open)'}
                          </div>
                        </div>

                        {occ.owners.includes(selfPlayer.id) ? (
                          <span className="px-2 py-0.5 rounded bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 text-[10px] font-bold">
                            ✓ Connected
                          </span>
                        ) : buildCost.valid ? (
                          <button
                            type="button"
                            disabled={!canBuildNow}
                            onClick={() =>
                              onDispatchAction({
                                type: 'PG_BUILD_CITY',
                                cityId: cityDef.id,
                              })
                            }
                            className={`px-2.5 py-1 rounded-lg font-mono text-[11px] font-bold border transition ${
                              canBuildNow
                                ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 border-emerald-300 cursor-pointer'
                                : 'bg-slate-950 text-slate-400 border-slate-800 cursor-not-allowed'
                            }`}
                            title={`Slot: $${buildCost.slotCost} + Pipe: $${buildCost.pipeCost} (${buildCost.path.join(' → ')})`}
                          >
                            +${buildCost.totalCost} (${buildCost.slotCost}+$
                            {buildCost.pipeCost})
                          </button>
                        ) : (
                          <span className="text-[10px] text-slate-600 italic">
                            Slot Locked
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* =====================================================================
          PLAYER DASHBOARDS (ELEKTRO, CITIES, PLANTS & STORED FUEL)
         ===================================================================== */}
      <div className="rounded-2xl bg-slate-900/80 border border-slate-800 p-4 shadow-xl">
        <h3 className="text-sm font-extrabold uppercase tracking-wider text-slate-200 mb-3">
          👥 Player Corporations, Power Plants & Stored Fuel
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {allPlayersOrdered.map((p) => {
            const isActor = state.activePlayerId === p.id;
            return (
              <div
                key={p.id}
                className={`rounded-xl border p-3 space-y-2 ${
                  isActor
                    ? 'bg-amber-950/20 border-amber-400/60'
                    : 'bg-slate-950/70 border-slate-800'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-sm text-white">
                    {getName(p.id)}{' '}
                    {p.id === viewingPlayerId && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 ml-1">
                        YOU
                      </span>
                    )}
                  </span>
                  <div className="flex items-center gap-2 font-mono text-xs">
                    <span className="text-emerald-400 font-bold">
                      {p.money !== null ? `$${p.money}` : '🔒 Elektro'}
                    </span>
                    <span className="px-2 py-0.5 rounded bg-slate-800 text-amber-300 font-bold">
                      🏙️ {p.cityCount} Cities
                    </span>
                  </div>
                </div>

                <div className="space-y-1.5">
                  {p.powerPlants.length === 0 ? (
                    <div className="text-xs text-slate-500 italic">
                      No Power Plants owned yet
                    </div>
                  ) : (
                    p.powerPlants.map((owned) => (
                      <div
                        key={owned.card.id}
                        className="rounded-lg bg-slate-900 px-2.5 py-1.5 border border-slate-800 flex items-center justify-between text-xs"
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-white">
                            #{owned.card.id}
                          </span>
                          {renderPlantTypeBadge(owned.card)}
                          <span className="text-cyan-300 font-mono text-[11px]">
                            ⚡{owned.card.citiesPowered}
                          </span>
                        </div>
                        <div className="font-mono text-[11px] text-slate-300">
                          {ALL_POWER_GRID_RESOURCES.filter(
                            (r) => owned.storedResources[r] > 0
                          )
                            .map(
                              (r) =>
                                `${RESOURCE_META[r].icon}${owned.storedResources[r]}`
                            )
                            .join(' ') || '0 Fuel'}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

