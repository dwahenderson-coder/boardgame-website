import React, { useEffect, useState } from 'react';
import {
  SHARE_UNIT_DOLLARS,
  STOCKPILE_BID_TRACK,
  STOCKPILE_COMPANIES,
  STOCKPILE_COMPANY_IDS,
  StockpileAction,
  StockpileBidValue,
  StockpileCompanyId,
  StockpileMarketCard,
  StockpilePublicPlayerState,
  StockpileSanitizedGameState,
} from '../games/stockpile/index.js';

export interface StockpileBoardProps {
  readonly state: StockpileSanitizedGameState;
  readonly viewingPlayerId: string;
  readonly playerNames: Readonly<Record<string, string>>;
  readonly isSpectator: boolean;
  readonly onDispatchAction: (action: StockpileAction) => void;
}

const PHASE_STEPS: ReadonlyArray<{
  readonly key: string;
  readonly stepNum: number;
  readonly title: string;
  readonly subtitle: string;
}> = [
  {
    key: 'PHASE_1_INFO',
    stepNum: 1,
    title: '1. Information',
    subtitle: 'Public & Private Forecasts dealt',
  },
  {
    key: 'PHASE_2_SUPPLY',
    stepNum: 2,
    title: '2. Supply',
    subtitle: 'Place 1 Face-Up & 1 Face-Down card',
  },
  {
    key: 'PHASE_3_DEMAND',
    stepNum: 3,
    title: '3. Demand',
    subtitle: 'Bid on Stockpiles ($0K–$25K)',
  },
  {
    key: 'PHASE_4_ACTION',
    stepNum: 4,
    title: '4. Action',
    subtitle: 'Apply Boom (+$2) & Bust (-$2)',
  },
  {
    key: 'PHASE_5_SELLING',
    stepNum: 5,
    title: '5. Selling',
    subtitle: 'Sell shares before Market Movement',
  },
  {
    key: 'PHASE_6_MOVEMENT_SUMMARY',
    stepNum: 6,
    title: '6. Market Movement',
    subtitle: 'Reveal all Forecasts & shift stocks',
  },
];

export const StockpileBoard: React.FC<StockpileBoardProps> = ({
  state,
  viewingPlayerId,
  playerNames,
  isSpectator,
  onDispatchAction,
}) => {
  const getName = (pid: string | null | undefined) =>
    pid ? playerNames[pid] ?? pid : '—';

  const isMyTurn = !isSpectator && state.activePlayerId === viewingPlayerId;
  const selfPlayer = state.self;

  // Phase 2: Supply selection state
  const [faceUpCardIndex, setFaceUpCardIndex] = useState<0 | 1>(0);
  const [faceUpPileIndex, setFaceUpPileIndex] = useState<number>(0);
  const [faceDownPileIndex, setFaceDownPileIndex] = useState<number>(
    state.stockpiles.length > 1 ? 1 : 0
  );

  // Phase 4: Boom/Bust target company state
  const [selectedActionCompany, setSelectedActionCompany] =
    useState<StockpileCompanyId>('GLOBAL_TELECOM');

  // Phase 5: Selling quantity per company
  const [sellQuantities, setSellQuantities] = useState<
    Record<StockpileCompanyId, number>
  >({
    GLOBAL_TELECOM: 1,
    BIOTECH: 1,
    ENERGY: 1,
    RAIL: 1,
    AUTOMOBILE: 1,
    ELECTRONIC: 1,
  });

  // Auto-AI toggle for solo play convenience
  const [autoAiOpponents, setAutoAiOpponents] = useState<boolean>(false);
  const [showPrivateInsider, setShowPrivateInsider] = useState<boolean>(true);

  useEffect(() => {
    if (!autoAiOpponents || state.phase === 'GAME_OVER') return;
    if (state.turnStep === 'PHASE_6_MOVEMENT_SUMMARY') return;
    // Automatically play AI turn when active player is not playerOrder[0] (or not viewingPlayerId)
    const humanAnchorId = state.playerOrder[0];
    if (state.activePlayerId !== humanAnchorId) {
      const timer = setTimeout(() => {
        onDispatchAction({ type: 'STOCKPILE_AI_TURN' });
      }, 450);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [
    autoAiOpponents,
    state.phase,
    state.turnStep,
    state.activePlayerId,
    state.turnNumber,
    state.playerOrder,
    onDispatchAction,
  ]);

  const allPlayersOrdered: StockpilePublicPlayerState[] = state.playerOrder.map(
    (pid) => (pid === selfPlayer.id ? selfPlayer : state.opponents[pid]!)
  );

  const computeEstimatedNetWorth = (p: StockpilePublicPlayerState): number => {
    if (state.phase === 'GAME_OVER') return p.cash;
    let stockVal = 0;
    for (const cid of STOCKPILE_COMPANY_IDS) {
      stockVal +=
        (p.portfolio[cid] ?? 0) * state.stockPrices[cid] * SHARE_UNIT_DOLLARS;
    }
    return p.cash + stockVal;
  };

  const renderMarketCardBadge = (card: StockpileMarketCard) => {
    if (card.kind === 'SHARE' && card.companyId) {
      const meta = STOCKPILE_COMPANIES[card.companyId];
      return (
        <div
          key={card.id}
          className={`px-2.5 py-1.5 rounded-lg border text-xs font-bold flex items-center justify-between gap-2 ${meta.badgeClass}`}
        >
          <span>📈 {meta.name}</span>
          <span className="font-mono px-1.5 py-0.5 rounded bg-slate-950/60 text-[10px]">
            {meta.ticker} (${state.stockPrices[card.companyId]}K)
          </span>
        </div>
      );
    }
    if (card.kind === 'BOOM') {
      return (
        <div
          key={card.id}
          className="px-2.5 py-1.5 rounded-lg border border-emerald-400/50 bg-emerald-500/20 text-emerald-200 text-xs font-bold flex items-center justify-between"
        >
          <span>🚀 BOOM!</span>
          <span className="font-mono text-[10px] bg-emerald-950/70 px-1.5 py-0.5 rounded">
            +$2 Any Stock
          </span>
        </div>
      );
    }
    if (card.kind === 'BUST') {
      return (
        <div
          key={card.id}
          className="px-2.5 py-1.5 rounded-lg border border-rose-400/50 bg-rose-500/20 text-rose-200 text-xs font-bold flex items-center justify-between"
        >
          <span>💥 BUST!</span>
          <span className="font-mono text-[10px] bg-rose-950/70 px-1.5 py-0.5 rounded">
            -$2 Any Stock
          </span>
        </div>
      );
    }
    return (
      <div
        key={card.id}
        className="px-2.5 py-1.5 rounded-lg border border-amber-400/50 bg-amber-500/20 text-amber-200 text-xs font-bold flex items-center justify-between"
      >
        <span>🏦 Trading Fee</span>
        <span className="font-mono text-[10px] bg-amber-950/70 px-1.5 py-0.5 rounded">
          -${(card.feeAmount / 1000).toFixed(0)}K
        </span>
      </div>
    );
  };

  const renderPhaseInstructionBanner = () => {
    if (state.phase === 'GAME_OVER') {
      return (
        <div className="rounded-xl bg-gradient-to-r from-amber-500/20 via-emerald-500/20 to-cyan-500/20 border border-amber-400/50 p-4 flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-amber-300">
              🏆 Final Bell — 6 Rounds Complete
            </div>
            <div className="text-lg font-extrabold text-white mt-0.5">
              Winner: {getName(state.winnerId)}! All shares liquidated & Majority Shareholder Bonuses ($10K) awarded.
            </div>
          </div>
        </div>
      );
    }

    const activeName = getName(state.activePlayerId);
    let instructionText = '';
    if (state.turnStep === 'PHASE_2_SUPPLY') {
      instructionText = `${activeName}: Select 1 card from your supply hand to place FACE-UP and 1 card to place FACE-DOWN into any stockpile.`;
    } else if (state.turnStep === 'PHASE_3_DEMAND') {
      const activeObj = allPlayersOrdered.find(
        (p) => p.id === state.activePlayerId
      );
      if (
        activeObj &&
        activeObj.outbidFromPileIndex !== null
      ) {
        instructionText = `${activeName} was OUTBID on Stockpile #${activeObj.outbidFromPileIndex + 1}! Must immediately place a bidding token on a DIFFERENT stockpile.`;
      } else {
        instructionText = `${activeName}: Place your bidding token on any Stockpile's track ($0K to $25K). Bidding ends when every player holds a unique Stockpile.`;
      }
    } else if (state.turnStep === 'PHASE_4_ACTION') {
      instructionText = `${activeName}: Play your collected Boom! (+$2) or Bust! (-$2) card to shift a company's stock value immediately.`;
    } else if (state.turnStep === 'PHASE_5_SELLING') {
      instructionText = `${activeName}: Sell any shares at current market prices before Phase 6 Market Movement, or click "Finish Selling".`;
    } else if (state.turnStep === 'PHASE_6_MOVEMENT_SUMMARY') {
      instructionText = `All Round ${state.roundNumber} Insider Forecasts have been revealed and applied to the Stock Tracker! Review movements and start Round ${state.roundNumber + 1}.`;
    }

    return (
      <div className="rounded-xl bg-slate-900/90 border border-cyan-500/30 p-3.5 flex flex-wrap items-center justify-between gap-3 shadow-lg">
        <div className="flex items-center gap-3">
          <span className="px-2.5 py-1 rounded-md bg-cyan-500/20 border border-cyan-400/40 text-cyan-300 text-xs font-extrabold uppercase tracking-wider">
            Round {state.roundNumber} / {state.maxRounds}
          </span>
          <span className="text-sm font-medium text-slate-200">
            {instructionText}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {state.turnStep !== 'PHASE_6_MOVEMENT_SUMMARY' && (
            <button
              type="button"
              onClick={() => onDispatchAction({ type: 'STOCKPILE_AI_TURN' })}
              className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow transition cursor-pointer"
              title="Let the built-in AI heuristic play the current active player's turn"
            >
              🤖 Let AI Play Turn ({activeName})
            </button>
          )}
          <label className="flex items-center gap-1.5 text-xs text-slate-300 bg-slate-800/80 px-2.5 py-1.5 rounded-lg border border-slate-700 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={autoAiOpponents}
              onChange={(e) => setAutoAiOpponents(e.target.checked)}
              className="accent-cyan-400"
            />
            <span>Auto-AI Opponents</span>
          </label>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-5 text-slate-100">
      {/* Phase Stepper Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
        {PHASE_STEPS.map((s) => {
          const isCurrent =
            state.turnStep === s.key ||
            (s.key === 'PHASE_1_INFO' && state.turnStep === 'PHASE_2_SUPPLY');
          return (
            <div
              key={s.key}
              className={`rounded-xl px-3 py-2 border transition ${
                isCurrent
                  ? 'bg-cyan-950/80 border-cyan-400 text-white shadow-md shadow-cyan-950/50'
                  : 'bg-slate-900/60 border-slate-800 text-slate-400'
              }`}
            >
              <div className="text-xs font-bold">{s.title}</div>
              <div className="text-[11px] opacity-80 truncate">{s.subtitle}</div>
            </div>
          );
        })}
      </div>

      {/* Instruction & AI Bar */}
      {renderPhaseInstructionBanner()}

      {/* Last Action Summary Toast */}
      {state.lastActionSummary && (
        <div className="rounded-lg bg-slate-950/80 border border-slate-800 px-3.5 py-2 text-xs text-cyan-200 flex items-center justify-between">
          <span>
            <strong className="text-slate-400 uppercase mr-2">Last Action:</strong>
            {state.lastActionSummary}
          </span>
          <span className="text-slate-500 font-mono">
            Deck: {state.marketDeckCount} | Discard: {state.marketDiscardCount}
          </span>
        </div>
      )}

      {/* Top Grid: Stock Value Tracker ($0-$11) + Phase 1 Insider Information */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Stock Value Tracker (8 cols) */}
        <div className="lg:col-span-8 rounded-2xl bg-slate-900/80 border border-slate-800 p-4 shadow-xl">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <div>
              <h3 className="text-sm font-extrabold uppercase tracking-wider text-slate-200">
                📊 Stock Market Tracker ($1K – $10K per Share)
              </h3>
              <p className="text-xs text-slate-400">
                Reach <span className="text-rose-400 font-semibold">$0 (Bankruptcy)</span>: wipes shares to 0 & resets to $5. Reach{' '}
                <span className="text-emerald-400 font-semibold">$11 (Stock Split)</span>: doubles all shares & resets to $6!
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-[11px] text-slate-400 font-mono">
                  <th className="py-1.5 pr-3">Company</th>
                  <th className="px-1.5 py-1.5 text-center text-rose-400 bg-rose-950/30 rounded-tl">
                    $0 💥
                  </th>
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((val) => (
                    <th key={val} className="px-1.5 py-1.5 text-center">
                      ${val}K
                    </th>
                  ))}
                  <th className="px-1.5 py-1.5 text-center text-emerald-400 bg-emerald-950/30 rounded-tr">
                    $11 ✂️2x
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-xs">
                {STOCKPILE_COMPANY_IDS.map((cid) => {
                  const meta = STOCKPILE_COMPANIES[cid];
                  const currentPrice = state.stockPrices[cid];
                  return (
                    <tr key={cid} className="hover:bg-slate-800/30">
                      <td className="py-2 pr-3 font-bold whitespace-nowrap">
                        <span
                          className="inline-block w-2.5 h-2.5 rounded-full mr-2"
                          style={{ backgroundColor: meta.colorHex }}
                        />
                        <span className="text-slate-100">{meta.name}</span>
                        <span className="ml-1.5 text-[10px] font-mono text-slate-400">
                          ({meta.ticker})
                        </span>
                      </td>
                      {/* $0 Bankruptcy cell */}
                      <td className="p-1 text-center bg-rose-950/20 border-x border-rose-900/30">
                        <span className="text-[10px] text-rose-400/70 font-mono">
                          Wipe→$5
                        </span>
                      </td>
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((val) => {
                        const isHere = currentPrice === val;
                        return (
                          <td
                            key={val}
                            className={`p-1 text-center font-mono ${
                              val === 5 || val === 6
                                ? 'bg-slate-800/30'
                                : ''
                            }`}
                          >
                            {isHere ? (
                              <div
                                className="mx-auto w-7 h-7 rounded-lg flex items-center justify-center font-extrabold text-slate-950 shadow-md ring-2 ring-white"
                                style={{ backgroundColor: meta.colorHex }}
                              >
                                ${val}
                              </div>
                            ) : (
                              <span className="text-slate-600 text-[11px]">
                                ·
                              </span>
                            )}
                          </td>
                        );
                      })}
                      {/* $11 Stock Split cell */}
                      <td className="p-1 text-center bg-emerald-950/20 border-x border-emerald-900/30">
                        <span className="text-[10px] text-emerald-400/80 font-mono">
                          2x→$6
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Phase 1: Insider Information Panel (4 cols) */}
        <div className="lg:col-span-4 rounded-2xl bg-slate-900/80 border border-slate-800 p-4 shadow-xl flex flex-col justify-between space-y-3">
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-extrabold uppercase tracking-wider text-slate-200">
                🕵️ Phase 1: Insider Information
              </h3>
              <button
                type="button"
                onClick={() => setShowPrivateInsider((prev) => !prev)}
                className="text-[11px] px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 cursor-pointer"
              >
                {showPrivateInsider ? '🙈 Hide My Card' : '👁️ Show My Card'}
              </button>
            </div>
            <p className="text-xs text-slate-400 mb-3">
              Forecasts take effect in Phase 6 (Market Movement).
            </p>

            {/* Public Pairing */}
            <div className="rounded-xl bg-amber-500/10 border border-amber-400/40 p-3 mb-3">
              <div className="text-[10px] font-bold uppercase tracking-wider text-amber-300">
                📢 Public Market Forecast (Everyone Sees)
              </div>
              <div className="mt-1 flex items-center justify-between">
                <span className="font-bold text-sm text-white">
                  {STOCKPILE_COMPANIES[state.publicPairing.companyId].name}
                </span>
                <span
                  className={`px-2.5 py-0.5 rounded font-mono font-extrabold text-sm ${
                    state.publicPairing.forecast.type === 'BANKRUPTCY' ||
                    state.publicPairing.forecast.delta < 0
                      ? 'bg-rose-500/30 text-rose-200 border border-rose-400/50'
                      : 'bg-emerald-500/30 text-emerald-200 border border-emerald-400/50'
                  }`}
                >
                  {state.publicPairing.forecast.label}
                </span>
              </div>
            </div>

            {/* Viewing Player's Private Pairing */}
            <div className="rounded-xl bg-cyan-500/10 border border-cyan-400/40 p-3">
              <div className="text-[10px] font-bold uppercase tracking-wider text-cyan-300">
                🔒 Your Private Insider Tip ({getName(selfPlayer.id)})
              </div>
              {selfPlayer.insiderPairing ? (
                showPrivateInsider ? (
                  <div className="mt-1 flex items-center justify-between">
                    <span className="font-bold text-sm text-white">
                      {
                        STOCKPILE_COMPANIES[selfPlayer.insiderPairing.companyId]
                          .name
                      }
                    </span>
                    <span
                      className={`px-2.5 py-0.5 rounded font-mono font-extrabold text-sm ${
                        selfPlayer.insiderPairing.forecast.type ===
                          'BANKRUPTCY' ||
                        selfPlayer.insiderPairing.forecast.delta < 0
                          ? 'bg-rose-500/30 text-rose-200 border border-rose-400/50'
                          : 'bg-emerald-500/30 text-emerald-200 border border-emerald-400/50'
                      }`}
                    >
                      {selfPlayer.insiderPairing.forecast.label}
                    </span>
                  </div>
                ) : (
                  <div className="mt-1 text-xs text-slate-400 italic">
                    Hidden for pass-and-play privacy — click "Show My Card" above.
                  </div>
                )
              ) : (
                <div className="mt-1 text-xs text-slate-400">None</div>
              )}
            </div>
          </div>

          {/* Revealed Forecasts in Phase 6 or Game Over */}
          {state.revealedPairings ? (
            <div className="rounded-xl bg-slate-950/90 border border-emerald-500/40 p-3">
              <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-300 mb-1.5">
                🔓 All Round {state.roundNumber} Forecasts Revealed
              </div>
              <div className="grid grid-cols-2 gap-1.5 text-xs">
                {state.revealedPairings.map((pair, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between bg-slate-900 px-2 py-1 rounded border border-slate-800"
                  >
                    <span className="truncate font-semibold">
                      {STOCKPILE_COMPANIES[pair.companyId].ticker}
                    </span>
                    <span
                      className={`font-mono font-bold ${
                        pair.forecast.type === 'BANKRUPTCY' ||
                        pair.forecast.delta < 0
                          ? 'text-rose-400'
                          : 'text-emerald-400'
                      }`}
                    >
                      {pair.forecast.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-[11px] text-slate-400 bg-slate-950/50 rounded-lg px-3 py-2 border border-slate-800/80">
              🔒 {6 - 1 - (selfPlayer.insiderPairing ? 1 : 0)} other Forecast pairings remain hidden with opponents & the board until Phase 6!
            </div>
          )}
        </div>
      </div>

      {/* Active Phase Action Console (Phase 2 Supply / Phase 4 Action / Phase 5 Selling / Phase 6 Summary) */}
      {state.turnStep === 'PHASE_2_SUPPLY' &&
        isMyTurn &&
        selfPlayer.supplyHand &&
        selfPlayer.supplyHand.length >= 2 && (
          <div className="rounded-2xl bg-gradient-to-r from-cyan-950/70 to-slate-900 border-2 border-cyan-400/60 p-4 shadow-xl space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h4 className="text-sm font-extrabold uppercase tracking-wider text-cyan-300">
                  📦 Your Phase 2 Supply Hand ({getName(selfPlayer.id)})
                </h4>
                <p className="text-xs text-slate-300">
                  Choose which card to place <strong>FACE-UP</strong> (public) and which card to place <strong>FACE-DOWN</strong> (secret) into any Stockpile.
                </p>
              </div>
              <button
                type="button"
                onClick={() =>
                  setFaceUpCardIndex((prev) => (prev === 0 ? 1 : 0))
                }
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-600 text-xs font-bold text-cyan-200 cursor-pointer"
              >
                🔄 Swap Face-Up / Face-Down Assignment
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Face-Up Card Assignment */}
              <div className="rounded-xl bg-slate-950/80 border border-emerald-500/40 p-3 space-y-2">
                <div className="text-xs font-bold text-emerald-300 uppercase">
                  👁️ Card Placed FACE-UP (Visible to All)
                </div>
                {renderMarketCardBadge(selfPlayer.supplyHand[faceUpCardIndex]!)}
                <div className="flex items-center gap-2 pt-1">
                  <span className="text-xs text-slate-400">Target Pile:</span>
                  <div className="flex flex-wrap gap-1.5">
                    {state.stockpiles.map((p) => (
                      <button
                        key={p.index}
                        type="button"
                        onClick={() => setFaceUpPileIndex(p.index)}
                        className={`px-2.5 py-1 rounded text-xs font-bold cursor-pointer ${
                          faceUpPileIndex === p.index
                            ? 'bg-emerald-500 text-slate-950'
                            : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                        }`}
                      >
                        Pile #{p.index + 1}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Face-Down Card Assignment */}
              <div className="rounded-xl bg-slate-950/80 border border-amber-500/40 p-3 space-y-2">
                <div className="text-xs font-bold text-amber-300 uppercase">
                  🔒 Card Placed FACE-DOWN (Hidden)
                </div>
                {renderMarketCardBadge(
                  selfPlayer.supplyHand[faceUpCardIndex === 0 ? 1 : 0]!
                )}
                <div className="flex items-center gap-2 pt-1">
                  <span className="text-xs text-slate-400">Target Pile:</span>
                  <div className="flex flex-wrap gap-1.5">
                    {state.stockpiles.map((p) => (
                      <button
                        key={p.index}
                        type="button"
                        onClick={() => setFaceDownPileIndex(p.index)}
                        className={`px-2.5 py-1 rounded text-xs font-bold cursor-pointer ${
                          faceDownPileIndex === p.index
                            ? 'bg-amber-400 text-slate-950'
                            : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                        }`}
                      >
                        Pile #{p.index + 1}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => {
                  const upCard = selfPlayer.supplyHand![faceUpCardIndex]!;
                  const downCard =
                    selfPlayer.supplyHand![faceUpCardIndex === 0 ? 1 : 0]!;
                  onDispatchAction({
                    type: 'STOCKPILE_PLACE_SUPPLY',
                    faceUpCardId: upCard.id,
                    faceUpPileIndex,
                    faceDownCardId: downCard.id,
                    faceDownPileIndex,
                  });
                }}
                className="px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-sm shadow-lg cursor-pointer"
              >
                ✅ Confirm & Place Both Cards into Stockpiles
              </button>
            </div>
          </div>
        )}

      {/* Phase 4: Action (Boom / Bust Manipulation) */}
      {state.turnStep === 'PHASE_4_ACTION' &&
        isMyTurn &&
        selfPlayer.pendingActionCards.length > 0 && (
          <div className="rounded-2xl bg-gradient-to-r from-indigo-950/80 to-slate-900 border-2 border-indigo-400/60 p-4 shadow-xl space-y-3">
            <h4 className="text-sm font-extrabold uppercase tracking-wider text-indigo-300">
              ⚡ Phase 4: Market Manipulation ({getName(selfPlayer.id)})
            </h4>
            <p className="text-xs text-slate-300">
              Select a company and trigger your Boom! (+$2) or Bust! (-$2) card immediately:
            </p>
            <div className="flex flex-wrap items-center gap-2">
              {STOCKPILE_COMPANY_IDS.map((cid) => {
                const meta = STOCKPILE_COMPANIES[cid];
                return (
                  <button
                    key={cid}
                    type="button"
                    onClick={() => setSelectedActionCompany(cid)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold border cursor-pointer transition ${
                      selectedActionCompany === cid
                        ? 'bg-white text-slate-950 border-white shadow'
                        : 'bg-slate-800 text-slate-200 border-slate-700 hover:bg-slate-700'
                    }`}
                  >
                    {meta.name} (${state.stockPrices[cid]}K)
                  </button>
                );
              })}
            </div>
            <div className="flex flex-wrap gap-3 pt-1">
              {selfPlayer.pendingActionCards.map((card) => (
                <button
                  key={card.id}
                  type="button"
                  onClick={() =>
                    onDispatchAction({
                      type: 'STOCKPILE_PLAY_BOOM_BUST',
                      cardId: card.id,
                      companyId: selectedActionCompany,
                    })
                  }
                  className={`px-4 py-2 rounded-xl font-extrabold text-xs shadow-lg cursor-pointer ${
                    card.kind === 'BOOM'
                      ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950'
                      : 'bg-rose-500 hover:bg-rose-400 text-white'
                  }`}
                >
                  Play {card.label} on{' '}
                  {STOCKPILE_COMPANIES[selectedActionCompany].name}
                </button>
              ))}
            </div>
          </div>
        )}

      {/* Phase 5: Selling Console */}
      {state.turnStep === 'PHASE_5_SELLING' && isMyTurn && (
        <div className="rounded-2xl bg-gradient-to-r from-emerald-950/70 to-slate-900 border-2 border-emerald-400/60 p-4 shadow-xl space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h4 className="text-sm font-extrabold uppercase tracking-wider text-emerald-300">
                💵 Phase 5: Sell Shares Before Market Movement ({getName(selfPlayer.id)})
              </h4>
              <p className="text-xs text-slate-300">
                Sell any shares you fear will drop or go bankrupt in Phase 6, or hold onto shares aiming for a Stock Split ($11)!
              </p>
            </div>
            <button
              type="button"
              onClick={() =>
                onDispatchAction({ type: 'STOCKPILE_FINISH_SELLING' })
              }
              className="px-5 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-extrabold text-xs shadow-lg cursor-pointer"
            >
              ✅ Finish Selling & Lock Portfolio
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {STOCKPILE_COMPANY_IDS.map((cid) => {
              const meta = STOCKPILE_COMPANIES[cid];
              const owned = selfPlayer.portfolio[cid] ?? 0;
              const price = state.stockPrices[cid];
              const qty = Math.min(sellQuantities[cid] ?? 1, Math.max(1, owned));

              return (
                <div
                  key={cid}
                  className="rounded-xl bg-slate-950/80 border border-slate-800 p-3 flex items-center justify-between gap-2"
                >
                  <div>
                    <div className="text-xs font-bold text-white">
                      {meta.name} ({meta.ticker})
                    </div>
                    <div className="text-[11px] text-slate-400 font-mono">
                      Owned: <strong className="text-white">{owned}</strong> | Price:{' '}
                      <strong className="text-emerald-400">${price}K</strong>/sh
                    </div>
                  </div>
                  {owned > 0 ? (
                    <div className="flex items-center gap-1.5">
                      <input
                        type="number"
                        min={1}
                        max={owned}
                        value={qty}
                        onChange={(e) =>
                          setSellQuantities((prev) => ({
                            ...prev,
                            [cid]: Math.max(
                              1,
                              Math.min(owned, Number(e.target.value) || 1)
                            ),
                          }))
                        }
                        className="w-12 px-1.5 py-1 rounded bg-slate-900 border border-slate-700 text-xs text-center font-mono text-white"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          onDispatchAction({
                            type: 'STOCKPILE_SELL_SHARES',
                            companyId: cid,
                            quantity: qty,
                          })
                        }
                        className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold cursor-pointer"
                      >
                        Sell (+${qty * price}K)
                      </button>
                    </div>
                  ) : (
                    <span className="text-[11px] text-slate-600 italic">
                      No shares
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Phase 6: Market Movement Summary & Advance Round */}
      {(state.turnStep === 'PHASE_6_MOVEMENT_SUMMARY' ||
        state.phase === 'GAME_OVER') &&
        state.lastRoundMovements.length > 0 && (
          <div className="rounded-2xl bg-slate-900/95 border-2 border-amber-400/60 p-4 shadow-xl space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h4 className="text-sm font-extrabold uppercase tracking-wider text-amber-300">
                  📈 Phase 6: Round {state.roundNumber} Market Movement Results
                </h4>
                <p className="text-xs text-slate-300">
                  All 6 company forecasts have been revealed and applied simultaneously:
                </p>
              </div>
              {state.turnStep === 'PHASE_6_MOVEMENT_SUMMARY' && (
                <button
                  type="button"
                  onClick={() =>
                    onDispatchAction({ type: 'STOCKPILE_NEXT_ROUND' })
                  }
                  className="px-5 py-2 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-extrabold text-sm shadow-lg cursor-pointer"
                >
                  ➡️ Start Round {state.roundNumber + 1} of {state.maxRounds}
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
              {state.lastRoundMovements.map((mv) => {
                const meta = STOCKPILE_COMPANIES[mv.companyId];
                return (
                  <div
                    key={mv.companyId}
                    className="rounded-xl bg-slate-950/90 border border-slate-800 p-2.5 text-xs space-y-1"
                  >
                    <div className="font-bold text-white truncate">
                      {meta.name}
                    </div>
                    <div className="font-mono text-[11px] text-slate-400">
                      Forecast:{' '}
                      <strong
                        className={
                          mv.forecastLabel === 'BANKRUPTCY' ||
                          mv.forecastLabel.startsWith('-')
                            ? 'text-rose-400'
                            : 'text-emerald-400'
                        }
                      >
                        {mv.forecastLabel}
                      </strong>
                    </div>
                    <div className="font-mono font-bold text-slate-200">
                      ${mv.previousPrice}K → ${mv.finalPrice}K
                    </div>
                    {mv.triggeredSplit && (
                      <div className="text-[10px] font-extrabold text-emerald-300 bg-emerald-950/70 px-1.5 py-0.5 rounded">
                        ✂️ SPLIT! Shares 2x!
                      </div>
                    )}
                    {mv.triggeredBankruptcy && (
                      <div className="text-[10px] font-extrabold text-rose-300 bg-rose-950/70 px-1.5 py-0.5 rounded">
                        💥 BANKRUPT! Wiped!
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

      {/* Stockpiles & Bidding Tracks Grid */}
      <div>
        <h3 className="text-sm font-extrabold uppercase tracking-wider text-slate-200 mb-2.5">
          🗃️ The Stockpiles & Demand Bidding Tracks ({state.stockpiles.length} Piles)
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {state.stockpiles.map((pile) => {
            const isOutbidRestricted =
              state.turnStep === 'PHASE_3_DEMAND' &&
              selfPlayer.outbidFromPileIndex === pile.index;
            return (
              <div
                key={pile.index}
                className={`rounded-2xl bg-slate-900/85 border p-4 flex flex-col justify-between space-y-3 shadow-lg ${
                  pile.highBidderId === viewingPlayerId
                    ? 'border-cyan-400/70 ring-1 ring-cyan-400/30'
                    : 'border-slate-800'
                }`}
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-extrabold text-white">
                      Stockpile #{pile.index + 1}
                    </span>
                    {pile.highBidderId ? (
                      <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 border border-amber-400/50 text-amber-200 text-xs font-bold">
                        🔨 High Bid: ${pile.currentBid}K ({getName(pile.highBidderId)})
                      </span>
                    ) : (
                      <span className="text-xs text-slate-500 font-mono">
                        Unclaimed
                      </span>
                    )}
                  </div>

                  {/* Face-Up Cards */}
                  <div className="space-y-1.5">
                    <div className="text-[10px] uppercase tracking-wider font-bold text-slate-400">
                      Face-Up Cards ({pile.faceUpCards.length})
                    </div>
                    {pile.faceUpCards.map((c) => renderMarketCardBadge(c))}
                  </div>

                  {/* Face-Down Count */}
                  <div className="flex items-center justify-between rounded-lg bg-slate-950/70 border border-slate-800 px-3 py-1.5 text-xs">
                    <span className="text-slate-400 font-medium">
                      🔒 Face-Down Mystery Cards:
                    </span>
                    <span className="font-mono font-bold text-amber-300">
                      {pile.faceDownCount} hidden card(s)
                    </span>
                  </div>
                </div>

                {/* Bidding Track ($0, $1, $3, $6, $10, $15, $20, $25) */}
                <div className="pt-2 border-t border-slate-800/80">
                  <div className="flex items-center justify-between text-[10px] uppercase tracking-wider font-bold text-slate-400 mb-1.5">
                    <span>Bidding Track ($K)</span>
                    {isOutbidRestricted && (
                      <span className="text-rose-400">
                        ⚠️ Outbid here — pick another pile!
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-8 gap-1">
                    {STOCKPILE_BID_TRACK.map((slotVal: StockpileBidValue) => {
                      const isCurrentBidSlot = pile.currentBid === slotVal;
                      const canBidHere =
                        state.turnStep === 'PHASE_3_DEMAND' &&
                        isMyTurn &&
                        !isOutbidRestricted &&
                        pile.highBidderId !== viewingPlayerId &&
                        (pile.currentBid === null ||
                          slotVal > pile.currentBid) &&
                        slotVal * SHARE_UNIT_DOLLARS <= selfPlayer.cash;

                      return (
                        <button
                          key={slotVal}
                          type="button"
                          disabled={!canBidHere}
                          onClick={() =>
                            onDispatchAction({
                              type: 'STOCKPILE_BID',
                              pileIndex: pile.index,
                              bidAmount: slotVal,
                            })
                          }
                          className={`py-1.5 rounded text-center font-mono text-xs font-bold border transition ${
                            isCurrentBidSlot
                              ? 'bg-amber-400 text-slate-950 border-white ring-2 ring-amber-300 font-extrabold'
                              : canBidHere
                              ? 'bg-cyan-950/90 hover:bg-cyan-500 hover:text-slate-950 text-cyan-200 border-cyan-500/50 cursor-pointer'
                              : 'bg-slate-950/50 text-slate-600 border-slate-800/60 cursor-not-allowed'
                          }`}
                        >
                          ${slotVal}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Player Portfolios & Cash Leaderboard */}
      <div className="rounded-2xl bg-slate-900/80 border border-slate-800 p-4 shadow-xl">
        <h3 className="text-sm font-extrabold uppercase tracking-wider text-slate-200 mb-3">
          💼 Player Portfolios, Cash & Majority Shareholder Standings
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-[11px] text-slate-400 uppercase">
                <th className="py-2 pr-3">Investor</th>
                <th className="py-2 px-2">Cash</th>
                {STOCKPILE_COMPANY_IDS.map((cid) => (
                  <th key={cid} className="py-2 px-2 text-center font-mono">
                    {STOCKPILE_COMPANIES[cid].ticker}
                  </th>
                ))}
                <th className="py-2 pl-3 text-right">Est. Net Worth</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {allPlayersOrdered.map((p) => {
                const isTurn =
                  state.phase === 'PLAYING' && state.activePlayerId === p.id;
                const netWorth = computeEstimatedNetWorth(p);
                return (
                  <tr
                    key={p.id}
                    className={
                      isTurn ? 'bg-cyan-950/30 font-semibold' : 'hover:bg-slate-800/30'
                    }
                  >
                    <td className="py-2.5 pr-3 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white">
                          {getName(p.id)}
                        </span>
                        {p.id === viewingPlayerId && (
                          <span className="px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 text-[10px] font-bold">
                            YOU
                          </span>
                        )}
                        {isTurn && (
                          <span className="px-1.5 py-0.5 rounded bg-amber-400 text-slate-950 text-[10px] font-extrabold">
                            ACTIVE
                          </span>
                        )}
                      </div>
                      {p.lastActionLabel && (
                        <div className="text-[11px] text-slate-400">
                          {p.lastActionLabel}
                        </div>
                      )}
                    </td>
                    <td className="py-2.5 px-2 font-mono font-bold text-emerald-400">
                      ${p.cash.toLocaleString()}
                    </td>
                    {STOCKPILE_COMPANY_IDS.map((cid) => {
                      const count = p.portfolio[cid] ?? 0;
                      return (
                        <td
                          key={cid}
                          className="py-2.5 px-2 text-center font-mono"
                        >
                          <span
                            className={`px-2 py-0.5 rounded ${
                              count > 0
                                ? 'bg-slate-800 text-white font-bold'
                                : 'text-slate-600'
                            }`}
                          >
                            {count}
                          </span>
                        </td>
                      );
                    })}
                    <td className="py-2.5 pl-3 text-right font-mono font-extrabold text-amber-300">
                      ${netWorth.toLocaleString()}
                      {state.phase === 'GAME_OVER' &&
                        p.endGameMajorityBonus > 0 && (
                          <div className="text-[10px] text-emerald-400">
                            (incl. +${p.endGameMajorityBonus.toLocaleString()} Majority Bonus)
                          </div>
                        )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

