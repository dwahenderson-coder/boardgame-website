import React, { useEffect, useState } from 'react';
import { StandardCard } from '../common/cards/index.js';
import {
  CribbageAction,
  CribbagePublicPlayerState,
  CribbageSanitizedGameState,
  getCribbagePipValue,
} from '../games/cribbage/index.js';
import { HandView } from './components/cards/HandView.js';
import { PlayingCard } from './components/cards/PlayingCard.js';

export interface CribbageBoardProps {
  readonly gameState: CribbageSanitizedGameState;
  readonly playerId: string;
  readonly playerNames: Readonly<Record<string, string>>;
  readonly sendAction: (action: CribbageAction) => void;
}

const PEG_COLORS: readonly {
  readonly fill: string;
  readonly stroke: string;
  readonly trackBg: string;
  readonly trackBorder: string;
  readonly holeRing: string;
  readonly label: string;
}[] = [
  {
    fill: '#ef4444',
    stroke: '#fecaca',
    trackBg: 'rgba(185, 28, 28, 0.36)',
    trackBorder: 'rgba(248, 113, 113, 0.65)',
    holeRing: 'rgba(252, 165, 165, 0.55)',
    label: 'Red',
  },
  {
    fill: '#3b82f6',
    stroke: '#bfdbfe',
    trackBg: 'rgba(29, 78, 216, 0.36)',
    trackBorder: 'rgba(96, 165, 250, 0.65)',
    holeRing: 'rgba(147, 197, 253, 0.55)',
    label: 'Blue',
  },
  {
    fill: '#10b981',
    stroke: '#a7f3d0',
    trackBg: 'rgba(4, 120, 87, 0.36)',
    trackBorder: 'rgba(52, 211, 153, 0.65)',
    holeRing: 'rgba(110, 231, 183, 0.55)',
    label: 'Green',
  },
  {
    fill: '#f59e0b',
    stroke: '#fde68a',
    trackBg: 'rgba(180, 83, 9, 0.38)',
    trackBorder: 'rgba(251, 191, 36, 0.65)',
    holeRing: 'rgba(253, 224, 71, 0.55)',
    label: 'Gold',
  },
];

const CRIBBAGE_STREETS: readonly {
  readonly id: number;
  readonly title: string;
  readonly startHole: number;
  readonly endHole: number;
  readonly reversed: boolean;
  readonly badgeText: string;
}[] = [
  {
    id: 1,
    title: 'Street 1 (1 → 30)',
    startHole: 1,
    endHole: 30,
    reversed: false,
    badgeText: 'Corner 1 at 30 ⤵',
  },
  {
    id: 2,
    title: 'Street 2 (60 ← 31)',
    startHole: 31,
    endHole: 60,
    reversed: true,
    badgeText: '⤵ Corner 2 at 60',
  },
  {
    id: 3,
    title: 'Street 3 (61 → 90)',
    startHole: 61,
    endHole: 90,
    reversed: false,
    badgeText: '🦨 Skunk Line at 90 ⤵',
  },
  {
    id: 4,
    title: 'Street 4 (120 ← 91)',
    startHole: 91,
    endHole: 120,
    reversed: true,
    badgeText: '🏆 To Winning Peg 121',
  },
];

export const CribbageBoard: React.FC<CribbageBoardProps> = ({
  gameState,
  playerNames,
  sendAction,
}) => {
  const [selectedDiscardIds, setSelectedDiscardIds] = useState<string[]>([]);

  useEffect(() => {
    setSelectedDiscardIds([]);
  }, [gameState.handNumber, gameState.turnStep]);

  const formatName = (id: string): string =>
    playerNames[id] ? `${playerNames[id]} (${id})` : id;

  const self = gameState.self;
  const isMyPegTurn =
    gameState.phase === 'PLAYING' &&
    gameState.turnStep === 'PEGGING' &&
    gameState.activePlayerId === self.id;

  const allPlayersInOrder: CribbagePublicPlayerState[] =
    gameState.playerOrder.map((pid) =>
      pid === self.id ? self : gameState.opponents[pid]!
    );

  // Counting order at the end of a hand: starts left of dealer and continues clockwise around the table to dealer last
  const showCountingOrder: CribbagePublicPlayerState[] =
    gameState.playerOrder.map((_, offset) => {
      const idx =
        (gameState.dealerIndex + 1 + offset) % gameState.playerOrder.length;
      const pid = gameState.playerOrder[idx]!;
      return pid === self.id ? self : gameState.opponents[pid]!;
    });

  const toggleDiscardCard = (card: StandardCard) => {
    if (gameState.turnStep !== 'DISCARD_TO_CRIB' || self.discardedToCrib) {
      return;
    }
    setSelectedDiscardIds((prev) => {
      if (prev.includes(card.id)) {
        return prev.filter((id) => id !== card.id);
      }
      if (prev.length >= gameState.requiredDiscardsPerPlayer) {
        return [...prev.slice(1), card.id];
      }
      return [...prev, card.id];
    });
  };

  const selfPeggingCards = self.peggingCards ?? [];
  const legalPegCardIds = new Set<string>(
    isMyPegTurn
      ? selfPeggingCards
          .filter(
            (c) => gameState.runningCount + getCribbagePipValue(c) <= 31
          )
          .map((c) => c.id)
      : []
  );

  return (
    <div className="w-full h-full flex flex-col bg-slate-950 text-slate-100 overflow-y-auto select-none p-4 lg:p-6 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-cyan-950/35 via-slate-950 to-slate-950">
      {/* Top Cribbage Pegging Track (0 .. 121) */}
      <div className="w-full max-w-6xl mx-auto bg-slate-900/95 border border-slate-800 rounded-2xl p-4 shadow-lg space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <span className="px-2.5 py-1 rounded-lg bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 text-xs font-black uppercase tracking-wider">
              🪵 Cribbage • Hand #{gameState.handNumber}
            </span>
            <span className="px-2.5 py-1 rounded-lg bg-amber-500/20 border border-amber-500/40 text-amber-300 text-xs font-bold">
              Dealer: {formatName(gameState.playerOrder[gameState.dealerIndex]!)}
            </span>
          </div>
          <span className="text-xs text-slate-400">
            15s = 2 pts • Pairs = 2 pts • Runs = 1/card • Flush = 4/5 • His Nobs
            = 1 pt • Target: <strong className="text-emerald-300">121 pts</strong>
          </span>
        </div>

        {/* Visual Wrapped 120-Point + 121 Winning Hole Wooden Cribbage Board (Side-by-Side Off-Color Tracks) */}
        <div
          className="w-full rounded-2xl border-4 border-amber-700/90 p-4 shadow-2xl relative space-y-3"
          style={{
            background:
              'linear-gradient(180deg, #5c3415 0%, #78441c 50%, #4b280e 100%)',
          }}
        >
          {/* Top Player Legend + Start (0) Holes & Winning 121 Peg Hole */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-amber-950/75 border border-amber-800/80 rounded-xl px-3.5 py-2.5">
            {/* Left: Start Holes (0) & Player Peg Legend */}
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-[11px] font-black text-amber-200 uppercase tracking-wider">
                🏁 Start (0):
              </span>
              {allPlayersInOrder.map((p, pIdx) => {
                const pegStyle = PEG_COLORS[pIdx % PEG_COLORS.length]!;
                const isDealer =
                  gameState.playerOrder.indexOf(p.id) === gameState.dealerIndex;
                const clampedScore = Math.min(121, Math.max(0, p.score));

                return (
                  <div
                    key={`legend_${p.id}`}
                    style={{
                      backgroundColor: pegStyle.trackBg,
                      borderColor: pegStyle.trackBorder,
                    }}
                    className="px-2.5 py-1 rounded-xl border flex items-center gap-2 shadow"
                  >
                    {/* Start (0) Peg Hole for this player */}
                    <div
                      title={`${formatName(p.id)} Start Hole (0)`}
                      className={`w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all ${
                        clampedScore === 0
                          ? 'scale-125 ring-2 ring-white shadow-lg'
                          : 'bg-stone-950/90'
                      }`}
                      style={{
                        backgroundColor:
                          clampedScore === 0 ? pegStyle.fill : '#1c1917',
                        borderColor:
                          clampedScore === 0
                            ? pegStyle.stroke
                            : pegStyle.holeRing,
                      }}
                    />
                    <span className="text-xs font-black text-white">
                      {formatName(p.id)}
                    </span>
                    {isDealer && (
                      <span className="px-1.5 py-0.2 rounded bg-amber-400 text-slate-950 text-[9px] font-black">
                        CRIB
                      </span>
                    )}
                    <span className="font-mono font-black text-xs text-amber-200">
                      {p.score} / 121
                    </span>
                    {p.lastActionLabel && (
                      <span className="text-[10px] text-amber-100/90 font-semibold">
                        ({p.lastActionLabel})
                      </span>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Right: Dedicated 121 Game-Winning Peg Hole */}
            <div className="flex items-center gap-2.5 bg-emerald-950/90 border-2 border-emerald-400/80 rounded-xl px-3.5 py-1.5 shadow-lg">
              <span className="text-xs font-black uppercase tracking-wider text-emerald-300">
                🏆 121 Finish Hole:
              </span>
              <div className="flex items-center gap-1.5">
                {allPlayersInOrder.map((p, pIdx) => {
                  const pegStyle = PEG_COLORS[pIdx % PEG_COLORS.length]!;
                  const hasWon = p.score >= 121;
                  return (
                    <div
                      key={`finish_121_${p.id}`}
                      title={`Hole 121 (${formatName(p.id)})`}
                      className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                        hasWon
                          ? 'scale-125 ring-2 ring-white shadow-xl'
                          : 'opacity-75'
                      }`}
                      style={{
                        backgroundColor: hasWon ? pegStyle.fill : '#064e3b',
                        borderColor: hasWon
                          ? pegStyle.stroke
                          : pegStyle.trackBorder,
                      }}
                    >
                      <span className="text-[9px] font-black text-white">
                        ★
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* 4 Wrapped Serpentine Streets (30 Holes per Street = 120 Points Total, Tracks Side-by-Side) */}
          <div className="space-y-2.5">
            {CRIBBAGE_STREETS.map((street) => {
              // 6 groups of 5 holes = 30 holes in this street
              const groupIndices = [0, 1, 2, 3, 4, 5];
              const orderedGroups = street.reversed
                ? [...groupIndices].reverse()
                : groupIndices;

              return (
                <div
                  key={`street_${street.id}`}
                  className="rounded-xl bg-amber-950/70 border-2 border-amber-800/80 p-2.5 space-y-1.5 shadow-inner"
                >
                  <div className="flex items-center justify-between text-[11px] font-black text-amber-200 uppercase tracking-wider px-1">
                    <span>{street.title}</span>
                    <span
                      className={
                        street.id === 3 ? 'text-rose-300' : 'text-amber-300'
                      }
                    >
                      {street.badgeText}
                    </span>
                  </div>

                  {/* Side-by-Side Player Tracks Running Parallel Through This 30-Point Street */}
                  <div className="space-y-1">
                    {allPlayersInOrder.map((p, pIdx) => {
                      const pegStyle = PEG_COLORS[pIdx % PEG_COLORS.length]!;
                      const clampedScore = Math.min(121, Math.max(0, p.score));

                      return (
                        <div
                          key={`street_${street.id}_track_${p.id}`}
                          style={{
                            backgroundColor: pegStyle.trackBg,
                            borderColor: pegStyle.trackBorder,
                          }}
                          className="w-full rounded-lg border px-2 py-1 flex items-center justify-between gap-2"
                        >
                          {/* Track Label Pill */}
                          <div className="w-28 shrink-0 flex items-center gap-1.5 truncate">
                            <span
                              className="w-2.5 h-2.5 rounded-full border shrink-0"
                              style={{
                                backgroundColor: pegStyle.fill,
                                borderColor: pegStyle.stroke,
                              }}
                            />
                            <span className="text-[10px] font-black text-white truncate">
                              {formatName(p.id)}
                            </span>
                          </div>

                          {/* 6 Five-Hole Sections Across the Street (30 Holes) */}
                          <div className="flex-1 grid grid-cols-6 gap-2">
                            {orderedGroups.map((gOffset) => {
                              const groupStart =
                                street.startHole + gOffset * 5;
                              const holeNumbers = Array.from(
                                { length: 5 },
                                (_, i) => groupStart + i
                              );
                              const orderedHoles = street.reversed
                                ? [...holeNumbers].reverse()
                                : holeNumbers;
                              const groupEndLabel = groupStart + 4;

                              return (
                                <div
                                  key={`s_${street.id}_p_${p.id}_g_${gOffset}`}
                                  className="flex items-center justify-between bg-black/25 rounded-md px-2 py-1 border border-white/10"
                                >
                                  {orderedHoles.map((holeNum) => {
                                    const isCurrentPeg =
                                      clampedScore === holeNum;
                                    const isPassed = clampedScore > holeNum;

                                    return (
                                      <div
                                        key={`hole_${p.id}_${holeNum}`}
                                        title={`${formatName(p.id)} • Hole ${holeNum}`}
                                        className={`rounded-full transition-all flex items-center justify-center ${
                                          isCurrentPeg
                                            ? 'w-4 h-4 scale-125 ring-2 ring-white shadow-lg z-10'
                                            : 'w-2.5 h-2.5'
                                        }`}
                                        style={{
                                          backgroundColor:
                                            isCurrentPeg || isPassed
                                              ? pegStyle.fill
                                              : '#0c0a09',
                                          border: isCurrentPeg
                                            ? `2px solid ${pegStyle.stroke}`
                                            : `1px solid ${pegStyle.holeRing}`,
                                          opacity: isPassed ? 0.55 : 1,
                                        }}
                                      />
                                    );
                                  })}
                                  <span className="text-[9px] font-mono font-bold text-white/70 ml-1">
                                    {groupEndLabel}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Center Table: Starter Cut, Crib, and Pegging Sequence / Show Breakdown */}
      <div className="w-full max-w-6xl mx-auto my-4 rounded-3xl bg-gradient-to-b from-slate-900/95 to-slate-950 border-2 border-cyan-500/30 p-5 shadow-xl flex flex-col lg:flex-row items-center justify-between gap-6">
        {/* Left: Starter Card & Dealer's Crib */}
        <div className="flex items-center gap-6 shrink-0">
          <div className="flex flex-col items-center gap-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-300">
              Starter Cut
            </span>
            {gameState.turnStep === 'DISCARD_TO_CRIB' ? (
              <PlayingCard faceDown={true} size="md" />
            ) : gameState.starterCard ? (
              <PlayingCard
                card={gameState.starterCard}
                size="md"
                highlighted={true}
              />
            ) : (
              <PlayingCard faceDown={true} size="md" />
            )}
          </div>

          <div className="flex flex-col items-center gap-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-300">
              Dealer&apos;s Crib ({gameState.cribZone.cardCount}/4)
            </span>
            <HandView
              cards={gameState.cribZone.cards}
              cardCount={gameState.cribZone.cardCount}
              size="sm"
              fanAngleDeg={4}
            />
          </div>
        </div>

        {/* Right / Main Center: Phase Controls (Discard, Pegging, or Show Summary) */}
        <div className="flex-1 w-full flex flex-col items-center justify-center">
          {gameState.turnStep === 'DISCARD_TO_CRIB' && (
            <div className="text-center space-y-2">
              <div className="text-base font-black text-amber-300">
                📥 Discard {gameState.requiredDiscardsPerPlayer} Card
                {gameState.requiredDiscardsPerPlayer === 1 ? '' : 's'} to{' '}
                {formatName(gameState.playerOrder[gameState.dealerIndex]!)}
                &apos;s Crib
              </div>
              <p className="text-xs text-slate-400">
                Click cards in your hand below to select them, then confirm your
                Crib discard.
              </p>
              {!self.discardedToCrib ? (
                <button
                  disabled={
                    selectedDiscardIds.length !==
                    gameState.requiredDiscardsPerPlayer
                  }
                  onClick={() =>
                    sendAction({
                      type: 'CRIB_DISCARD',
                      cardIds: selectedDiscardIds,
                    })
                  }
                  className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-slate-950 font-black text-xs shadow cursor-pointer disabled:cursor-not-allowed"
                >
                  Send {selectedDiscardIds.length}/
                  {gameState.requiredDiscardsPerPlayer} Selected to Crib
                </button>
              ) : (
                <span className="inline-block px-3 py-1.5 rounded-lg bg-slate-800 text-emerald-300 text-xs font-bold">
                  ✓ Discarded to Crib — Waiting for other players...
                </span>
              )}
            </div>
          )}

          {gameState.turnStep === 'PEGGING' && (
            <div className="w-full flex flex-col items-center gap-3">
              <div className="flex items-center gap-4">
                <div className="px-4 py-2 rounded-2xl bg-slate-950 border border-cyan-500/50 flex items-center gap-2.5">
                  <span className="text-xs uppercase font-bold text-slate-400">
                    Pegging Count
                  </span>
                  <span className="text-2xl font-black text-cyan-300">
                    {gameState.runningCount} / 31
                  </span>
                </div>
                <span className="text-xs font-bold text-slate-300">
                  {isMyPegTurn
                    ? '⚡ Your Turn to Peg!'
                    : `Waiting for ${formatName(gameState.activePlayerId)}...`}
                </span>
              </div>

              {/* Current Sequence of Played Pegging Cards */}
              <div className="flex flex-wrap items-center justify-center gap-2.5 min-h-[84px]">
                {gameState.currentSequence.length === 0 ? (
                  <span className="text-xs text-slate-500 italic">
                    Play a card from your hand below to start the count toward
                    15 and 31.
                  </span>
                ) : (
                  gameState.currentSequence.map((item, idx) => (
                    <div
                      key={`${item.card.id}_${idx}`}
                      className="flex flex-col items-center gap-0.5"
                    >
                      <PlayingCard card={item.card} size="sm" />
                      <span className="text-[9px] text-slate-400 font-bold">
                        {formatName(item.playerId)}
                      </span>
                    </div>
                  ))
                )}
              </div>

              {isMyPegTurn && legalPegCardIds.size === 0 && (
                <button
                  onClick={() => sendAction({ type: 'CRIB_SAY_GO' })}
                  className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-black text-xs shadow cursor-pointer"
                >
                  📣 Say &quot;Go!&quot; (No Card Fits Under 31)
                </button>
              )}
            </div>
          )}

          {gameState.turnStep === 'HAND_OVER' && (
            <div className="w-full space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-black text-amber-300">
                  📊 Hand #{gameState.handNumber} Show Counting Breakdown
                </span>
                {gameState.phase !== 'GAME_OVER' && (
                  <button
                    onClick={() => sendAction({ type: 'CRIB_NEXT_HAND' })}
                    className="px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs shadow-lg cursor-pointer"
                  >
                    🃏 Deal Next Hand (Hand #{gameState.handNumber + 1})
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
                {showCountingOrder.map((p, orderIdx) => {
                  const wasCounted = p.lastShowBreakdown !== null;
                  return (
                    <div
                      key={p.id}
                      className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5"
                    >
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-white">
                          #{orderIdx + 1} {formatName(p.id)} Hand
                        </span>
                        {wasCounted ? (
                          <span className="font-mono font-black text-emerald-400">
                            +{p.lastShowBreakdown?.total ?? 0} pts
                          </span>
                        ) : (
                          <span className="font-mono font-bold text-slate-500">
                            Not Counted
                          </span>
                        )}
                      </div>
                      <HandView
                        cards={p.handZone.cards}
                        cardCount={p.handZone.cardCount}
                        size="sm"
                        fanAngleDeg={3}
                      />
                      <div className="text-[10px] text-slate-400">
                        {!wasCounted
                          ? 'Game ended prior to counting this hand (121+ pts reached).'
                          : p.lastShowBreakdown &&
                              p.lastShowBreakdown.details.length > 0
                            ? p.lastShowBreakdown.details.join(' • ')
                            : '0 pts (No 15s, pairs, or runs)'}
                      </div>
                    </div>
                  );
                })}

                {gameState.cribBreakdown ? (
                  <div className="p-2.5 rounded-xl bg-amber-950/25 border border-amber-500/40 space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-amber-300">
                        #{showCountingOrder.length + 1}{' '}
                        {formatName(
                          gameState.playerOrder[gameState.dealerIndex]!
                        )}{' '}
                        Crib (Last)
                      </span>
                      <span className="font-mono font-black text-amber-300">
                        +{gameState.cribBreakdown.total} pts
                      </span>
                    </div>
                    <div className="text-[10px] text-amber-200/80">
                      {gameState.cribBreakdown.details.length > 0
                        ? gameState.cribBreakdown.details.join(' • ')
                        : '0 pts in Crib'}
                    </div>
                  </div>
                ) : (
                  <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-slate-400">
                        {formatName(
                          gameState.playerOrder[gameState.dealerIndex]!
                        )}{' '}
                        Crib (Last)
                      </span>
                      <span className="font-mono font-bold text-slate-500">
                        Not Counted
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-500">
                      Game ended prior to counting the Crib (121+ pts reached).
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Hero Hand & Pegging Cards */}
      <div
        className={`w-full max-w-5xl mx-auto mt-auto rounded-2xl p-4 border transition-all ${
          isMyPegTurn ||
          (gameState.turnStep === 'DISCARD_TO_CRIB' && !self.discardedToCrib)
            ? 'bg-slate-900/95 border-cyan-400 ring-2 ring-cyan-400/40 shadow-xl'
            : 'bg-slate-900/85 border-slate-800'
        }`}
      >
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="space-y-1 text-center md:text-left">
            <div className="flex items-center justify-center md:justify-start gap-2">
              <span className="text-base font-black text-white">
                {formatName(self.id)} (You)
              </span>
              <span className="px-2.5 py-0.5 rounded bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-black">
                {self.score} / 121 pts
              </span>
            </div>
            <p className="text-xs text-slate-400">
              {gameState.turnStep === 'DISCARD_TO_CRIB'
                ? `Click ${gameState.requiredDiscardsPerPlayer} card(s) to select them for the Crib.`
                : gameState.turnStep === 'PEGGING'
                  ? 'Click any highlighted card in your pegging hand to play it to the count.'
                  : 'Your full 4-card hand is scored with the Starter Cut above.'}
            </p>
          </div>

          {gameState.turnStep === 'PEGGING' ? (
            <HandView
              cards={self.peggingCards}
              cardCount={self.peggingCardsCount}
              highlightedCardIds={legalPegCardIds}
              size="lg"
              fanAngleDeg={6}
              {...(isMyPegTurn
                ? {
                    onPlayCard: (card) => {
                      if (legalPegCardIds.has(card.id)) {
                        sendAction({ type: 'CRIB_PLAY_CARD', cardId: card.id });
                      }
                    },
                  }
                : {})}
            />
          ) : (
            <HandView
              cards={self.handZone.cards}
              cardCount={self.handZone.cardCount}
              highlightedCardIds={new Set(selectedDiscardIds)}
              size="lg"
              fanAngleDeg={6}
              {...(gameState.turnStep === 'DISCARD_TO_CRIB' &&
              !self.discardedToCrib
                ? {
                    onPlayCard: toggleDiscardCard,
                  }
                : {})}
            />
          )}
        </div>
      </div>
    </div>
  );
};

