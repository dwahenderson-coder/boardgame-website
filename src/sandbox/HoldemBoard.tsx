import React, { useEffect, useMemo, useState } from 'react';
import {
  HoldemAction,
  HoldemPublicPlayerState,
  HoldemSanitizedGameState,
} from '../games/texas-holdem/index.js';
import { HandView } from './components/cards/HandView.js';
import { PlayingCard } from './components/cards/PlayingCard.js';
import { getPlayerPalette } from './mapData.js';

export interface HoldemBoardProps {
  readonly gameState: HoldemSanitizedGameState;
  readonly playerId: string;
  readonly playerNames: Readonly<Record<string, string>>;
  readonly sendAction: (action: HoldemAction) => void;
}

export const HoldemBoard: React.FC<HoldemBoardProps> = ({
  gameState,
  playerId,
  playerNames,
  sendAction,
}) => {
  const formatName = (id: string): string =>
    playerNames[id] ? `${playerNames[id]} (${id})` : id;

  const activePlayerId = gameState.playerOrder[gameState.activePlayerIndex]!;
  const isMyTurn =
    gameState.phase === 'PLAYING' &&
    gameState.turnStep === 'BETTING' &&
    activePlayerId === playerId;

  const self = gameState.self;
  const toCall = Math.max(0, gameState.currentBet - self.currentBet);
  const maxTotalBet = self.currentBet + self.chips;
  const minRaiseTarget = Math.min(
    maxTotalBet,
    Math.max(
      gameState.bigBlind,
      gameState.currentBet + gameState.minRaiseDelta
    )
  );

  const [raiseTarget, setRaiseTarget] = useState<number>(minRaiseTarget);

  useEffect(() => {
    setRaiseTarget(minRaiseTarget);
  }, [minRaiseTarget, gameState.handNumber, gameState.street, gameState.currentBet]);

  // Highlight best 5 cards for the viewing player (or winning showdown hand)
  const highlightedIds = useMemo<ReadonlySet<string>>(() => {
    if (
      gameState.turnStep === 'HAND_OVER' &&
      gameState.lastHandWinners.length > 0
    ) {
      const ids = new Set<string>();
      for (const w of gameState.lastHandWinners) {
        for (const cid of w.bestFiveIds) {
          ids.add(cid);
        }
      }
      if (ids.size > 0) return ids;
    }
    if (gameState.selfBestHand && gameState.communityCards.length >= 3) {
      return new Set(gameState.selfBestHand.bestFive.map((c) => c.id));
    }
    return new Set<string>();
  }, [
    gameState.turnStep,
    gameState.lastHandWinners,
    gameState.selfBestHand,
    gameState.communityCards.length,
  ]);

  const allPlayersInSeatOrder = useMemo<HoldemPublicPlayerState[]>(() => {
    return gameState.playerOrder.map((pid) =>
      pid === self.id ? self : gameState.opponents[pid]!
    );
  }, [gameState.playerOrder, self, gameState.opponents]);

  const canBetOrRaise = self.chips > toCall && maxTotalBet > gameState.currentBet;

  return (
    <div className="w-full h-full flex flex-col lg:flex-row bg-slate-950 text-slate-100 overflow-hidden select-none">
      {/* Left / Main Casino Felt Table Area */}
      <div className="flex-1 relative flex flex-col items-center justify-between p-4 lg:p-6 overflow-y-auto bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-emerald-950/60 via-slate-950 to-slate-950">
        {/* Top Action & Street Banner */}
        <div className="w-full max-w-5xl flex flex-wrap items-center justify-between gap-3 bg-slate-900/90 border border-slate-800 rounded-2xl px-4 py-2.5 shadow-lg">
          <div className="flex items-center gap-3">
            <span className="px-2.5 py-1 rounded-lg bg-rose-500/20 border border-rose-500/40 text-rose-300 text-xs font-black uppercase tracking-wider">
              Hand #{gameState.handNumber}
            </span>
            <span className="px-2.5 py-1 rounded-lg bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-black uppercase tracking-wider">
              {gameState.street}
            </span>
            <span className="text-xs text-slate-400 font-semibold">
              Blinds:{' '}
              <strong className="text-slate-200">
                ${gameState.smallBlind} / ${gameState.bigBlind}
              </strong>
            </span>
          </div>

          {gameState.lastActionSummary && (
            <div className="text-xs font-semibold text-amber-300 bg-amber-950/40 border border-amber-500/30 rounded-lg px-3 py-1">
              🃏 {gameState.lastActionSummary}
            </div>
          )}
        </div>

        {/* Opponent Seats Grid */}
        <div className="w-full max-w-5xl grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 my-3">
          {allPlayersInSeatOrder
            .filter((p) => p.id !== self.id)
            .map((opp) => {
              const seatIdx = gameState.playerOrder.indexOf(opp.id);
              const isDealer = seatIdx === gameState.dealerIndex;
              const isSB = seatIdx === gameState.smallBlindIndex;
              const isBB = seatIdx === gameState.bigBlindIndex;
              const isTurn =
                gameState.turnStep === 'BETTING' && activePlayerId === opp.id;
              const palette = getPlayerPalette(opp.id, gameState.playerOrder);
              const showdownEval = gameState.showdownHands[opp.id];
              const isHandWinner = gameState.lastHandWinners.some(
                (w) => w.playerId === opp.id
              );

              return (
                <div
                  key={opp.id}
                  className={`relative rounded-2xl p-3 border transition-all flex flex-col items-center justify-between ${
                    isHandWinner
                      ? 'bg-amber-500/15 border-amber-400 ring-2 ring-amber-400/50 shadow-lg'
                      : isTurn
                        ? 'bg-slate-800/95 border-emerald-400 ring-2 ring-emerald-400/40 shadow-lg'
                        : opp.folded || opp.busted
                          ? 'bg-slate-900/40 border-slate-800/70 opacity-60'
                          : 'bg-slate-900/80 border-slate-800'
                  }`}
                >
                  {/* Seat Role Badges */}
                  <div className="w-full flex items-center justify-between gap-1 mb-1.5">
                    <div className="flex items-center gap-1.5 truncate">
                      <span
                        className={`w-2.5 h-2.5 rounded-full shrink-0 ${palette.dotClass}`}
                      />
                      <span className="text-xs font-bold text-white truncate">
                        {formatName(opp.id)}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {isDealer && (
                        <span className="px-1.5 py-0.5 rounded-full bg-amber-400 text-slate-950 text-[9px] font-black">
                          D
                        </span>
                      )}
                      {isSB && (
                        <span className="px-1.5 py-0.5 rounded-full bg-sky-500/30 border border-sky-400/50 text-sky-200 text-[9px] font-bold">
                          SB
                        </span>
                      )}
                      {isBB && (
                        <span className="px-1.5 py-0.5 rounded-full bg-indigo-500/30 border border-indigo-400/50 text-indigo-200 text-[9px] font-bold">
                          BB
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Opponent Hole Cards via reusable HandView */}
                  <div className="my-1.5">
                    <HandView
                      cards={opp.holeZone.cards}
                      cardCount={opp.holeZone.cardCount}
                      highlightedCardIds={highlightedIds}
                      size="sm"
                      fanAngleDeg={5}
                    />
                  </div>

                  {/* Stack & Bet Footer */}
                  <div className="w-full flex items-center justify-between text-[11px] mt-1 pt-1.5 border-t border-slate-800/80">
                    <span className="font-black text-emerald-400">
                      ${opp.chips}
                    </span>
                    {opp.currentBet > 0 && (
                      <span className="px-1.5 py-0.5 rounded bg-amber-500/20 border border-amber-400/40 text-amber-300 font-bold text-[10px]">
                        Bet: ${opp.currentBet}
                      </span>
                    )}
                    {opp.allIn && (
                      <span className="px-1.5 py-0.5 rounded bg-rose-600 text-white font-black text-[9px] uppercase">
                        ALL-IN
                      </span>
                    )}
                  </div>

                  {opp.lastActionLabel && (
                    <div className="mt-1 text-[10px] font-semibold text-slate-300 truncate max-w-full">
                      {opp.lastActionLabel}
                    </div>
                  )}

                  {showdownEval && (
                    <div className="mt-1 px-2 py-0.5 rounded-full bg-amber-400/20 border border-amber-400/50 text-amber-200 text-[10px] font-bold">
                      {showdownEval.description}
                    </div>
                  )}
                </div>
              );
            })}
        </div>

        {/* Center Casino Felt Oval — Pot & Community Cards */}
        <div className="w-full max-w-3xl my-2 rounded-[40px] bg-gradient-to-b from-emerald-900/50 via-emerald-950/70 to-slate-900/90 border-4 border-amber-700/50 shadow-[inset_0_0_50px_rgba(0,0,0,0.6)] p-5 flex flex-col items-center justify-center gap-4">
          {/* Pot & Current Street Bet Display */}
          <div className="flex flex-wrap items-center justify-center gap-4">
            <div className="px-5 py-2 rounded-2xl bg-slate-950/85 border border-amber-500/40 shadow-md flex items-center gap-2.5">
              <span className="text-xs uppercase tracking-widest text-slate-400 font-bold">
                Total Pot
              </span>
              <span className="text-2xl font-black text-amber-400">
                ${gameState.pot}
              </span>
            </div>

            {gameState.currentBet > 0 && (
              <div className="px-4 py-2 rounded-2xl bg-slate-950/75 border border-slate-700 flex items-center gap-2">
                <span className="text-xs uppercase tracking-wider text-slate-400 font-semibold">
                  Street Bet
                </span>
                <span className="text-lg font-extrabold text-white">
                  ${gameState.currentBet}
                </span>
              </div>
            )}
          </div>

          {/* 5 Community Card Slots (Flop, Turn, River) */}
          <div className="flex items-center justify-center gap-2.5 sm:gap-3.5 py-2">
            {Array.from({ length: 5 }).map((_, slotIdx) => {
              const card = gameState.communityCards[slotIdx];
              const slotLabel =
                slotIdx < 3 ? 'Flop' : slotIdx === 3 ? 'Turn' : 'River';

              if (!card) {
                return (
                  <div
                    key={`comm_empty_${slotIdx}`}
                    className="w-16 h-24 sm:w-20 sm:h-28 rounded-xl border-2 border-dashed border-emerald-600/40 bg-emerald-950/30 flex flex-col items-center justify-center text-emerald-500/50"
                  >
                    <span className="text-[10px] font-bold uppercase tracking-widest">
                      {slotLabel}
                    </span>
                  </div>
                );
              }

              return (
                <PlayingCard
                  key={card.id}
                  card={card}
                  size="lg"
                  highlighted={highlightedIds.has(card.id)}
                />
              );
            })}
          </div>

          {/* Showdown Winner Banner */}
          {gameState.turnStep === 'HAND_OVER' &&
            gameState.lastHandWinners.length > 0 && (
              <div className="w-full max-w-xl rounded-xl bg-amber-500/20 border border-amber-400/60 px-4 py-2.5 text-center shadow-lg">
                {gameState.lastHandWinners.map((w) => (
                  <div
                    key={w.playerId}
                    className="text-sm font-black text-amber-200"
                  >
                    🏆 {formatName(w.playerId)} wins ${w.amountWon} —{' '}
                    <span className="text-white">{w.handDescription}</span>
                  </div>
                ))}
              </div>
            )}
        </div>

        {/* Bottom Viewing Player Hero Seat & Reusable HandView */}
        <div
          className={`w-full max-w-4xl rounded-2xl p-4 border transition-all ${
            isMyTurn
              ? 'bg-slate-900/95 border-emerald-400 ring-2 ring-emerald-400/40 shadow-xl'
              : 'bg-slate-900/85 border-slate-800'
          }`}
        >
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            {/* Hero Info & Hole Cards */}
            <div className="flex items-center gap-5">
              <HandView
                cards={self.holeZone.cards}
                cardCount={self.holeZone.cardCount}
                highlightedCardIds={highlightedIds}
                size="lg"
                fanAngleDeg={7}
              />

              <div className="space-y-1.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-base font-black text-white">
                    {formatName(self.id)} (You)
                  </span>
                  {gameState.playerOrder.indexOf(self.id) ===
                    gameState.dealerIndex && (
                    <span className="px-2 py-0.5 rounded-full bg-amber-400 text-slate-950 text-[10px] font-black">
                      DEALER
                    </span>
                  )}
                  {isMyTurn && (
                    <span className="px-2.5 py-0.5 rounded-full bg-emerald-500 text-slate-950 text-[10px] font-black uppercase tracking-wider animate-pulse">
                      Your Action
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-4 text-xs">
                  <span className="text-slate-400">
                    Chip Stack:{' '}
                    <strong className="text-emerald-400 text-sm font-black">
                      ${self.chips}
                    </strong>
                  </span>
                  <span className="text-slate-400">
                    Street Bet:{' '}
                    <strong className="text-amber-300 font-bold">
                      ${self.currentBet}
                    </strong>
                  </span>
                  <span className="text-slate-400">
                    Hands Won:{' '}
                    <strong className="text-white">{self.handsWon}</strong>
                  </span>
                </div>

                {/* Live Best Hand Evaluator Badge */}
                {gameState.selfBestHand && !self.folded && !self.busted && (
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-indigo-500/20 border border-indigo-400/40 text-indigo-200 text-xs font-bold">
                    <span>🔍 Hand Strength:</span>
                    <span className="text-amber-300 font-black">
                      {gameState.selfBestHand.description}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Hero Betting Controls */}
            <div className="flex flex-col items-stretch sm:items-end gap-2.5 w-full md:w-auto">
              {gameState.turnStep === 'HAND_OVER' &&
              gameState.phase !== 'GAME_OVER' ? (
                <button
                  onClick={() => sendAction({ type: 'HOLDEM_NEXT_HAND' })}
                  className="px-6 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-sm shadow-lg transition cursor-pointer"
                >
                  🃏 Deal Next Hand (Hand #{gameState.handNumber + 1})
                </button>
              ) : (
                <>
                  {/* Primary Action Buttons: Fold, Check / Call, Bet / Raise */}
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      disabled={!isMyTurn}
                      onClick={() => sendAction({ type: 'HOLDEM_FOLD' })}
                      className="px-4 py-2.5 rounded-xl bg-rose-600/90 hover:bg-rose-500 disabled:opacity-40 text-white font-bold text-xs transition cursor-pointer disabled:cursor-not-allowed"
                    >
                      Fold
                    </button>

                    {toCall === 0 ? (
                      <button
                        disabled={!isMyTurn}
                        onClick={() => sendAction({ type: 'HOLDEM_CHECK' })}
                        className="px-5 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 disabled:opacity-40 text-white font-black text-xs transition cursor-pointer disabled:cursor-not-allowed"
                      >
                        Check
                      </button>
                    ) : (
                      <button
                        disabled={!isMyTurn}
                        onClick={() => sendAction({ type: 'HOLDEM_CALL' })}
                        className="px-5 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 disabled:opacity-40 text-white font-black text-xs transition cursor-pointer disabled:cursor-not-allowed"
                      >
                        {self.chips <= toCall
                          ? `Call All-In ($${self.chips})`
                          : `Call $${toCall}`}
                      </button>
                    )}

                    {canBetOrRaise && (
                      <button
                        disabled={!isMyTurn}
                        onClick={() =>
                          sendAction({
                            type: 'HOLDEM_BET_RAISE',
                            targetBet: raiseTarget,
                          })
                        }
                        className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-slate-950 font-black text-xs transition cursor-pointer disabled:cursor-not-allowed shadow-md"
                      >
                        {raiseTarget >= maxTotalBet
                          ? `All-In ($${maxTotalBet})`
                          : gameState.currentBet === 0
                            ? `Bet $${raiseTarget}`
                            : `Raise to $${raiseTarget}`}
                      </button>
                    )}
                  </div>

                  {/* Quick Bet Sizing Presets & Slider */}
                  {canBetOrRaise && isMyTurn && (
                    <div className="flex flex-col gap-1.5 bg-slate-950/80 border border-slate-800 rounded-xl p-2.5">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <button
                          type="button"
                          onClick={() => setRaiseTarget(minRaiseTarget)}
                          className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-[10px] font-bold text-slate-200 cursor-pointer"
                        >
                          Min (${minRaiseTarget})
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setRaiseTarget(
                              Math.min(
                                maxTotalBet,
                                Math.max(
                                  minRaiseTarget,
                                  gameState.currentBet +
                                    Math.floor(gameState.pot / 2)
                                )
                              )
                            )
                          }
                          className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-[10px] font-bold text-slate-200 cursor-pointer"
                        >
                          ½ Pot
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setRaiseTarget(
                              Math.min(
                                maxTotalBet,
                                Math.max(
                                  minRaiseTarget,
                                  gameState.currentBet + gameState.pot
                                )
                              )
                            )
                          }
                          className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-[10px] font-bold text-slate-200 cursor-pointer"
                        >
                          Pot
                        </button>
                        <button
                          type="button"
                          onClick={() => setRaiseTarget(maxTotalBet)}
                          className="px-2 py-1 rounded bg-rose-500/20 border border-rose-500/40 hover:bg-rose-500/30 text-[10px] font-black text-rose-300 cursor-pointer"
                        >
                          All-In (${maxTotalBet})
                        </button>
                      </div>

                      <div className="flex items-center gap-2">
                        <input
                          type="range"
                          min={minRaiseTarget}
                          max={maxTotalBet}
                          step={5}
                          value={raiseTarget}
                          onChange={(e) =>
                            setRaiseTarget(Number(e.target.value))
                          }
                          className="w-36 accent-amber-400 cursor-pointer"
                        />
                        <span className="text-xs font-mono font-bold text-amber-300 w-14 text-right">
                          ${raiseTarget}
                        </span>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

