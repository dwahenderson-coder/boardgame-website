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
import { getPlayerPalette } from './mapData.js';

export interface CribbageBoardProps {
  readonly gameState: CribbageSanitizedGameState;
  readonly playerId: string;
  readonly playerNames: Readonly<Record<string, string>>;
  readonly sendAction: (action: CribbageAction) => void;
}

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

        {/* 121-Point Peg Board Progress Bars */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
          {allPlayersInOrder.map((p) => {
            const palette = getPlayerPalette(p.id, gameState.playerOrder);
            const pct = Math.min(
              100,
              Math.round((p.score / gameState.targetScore) * 100)
            );
            const isDealer =
              gameState.playerOrder.indexOf(p.id) === gameState.dealerIndex;
            return (
              <div
                key={p.id}
                className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 flex flex-col gap-1.5"
              >
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5 truncate">
                    <span
                      className={`w-2.5 h-2.5 rounded-full shrink-0 ${palette.dotClass}`}
                    />
                    <span className="font-bold text-white truncate">
                      {formatName(p.id)}
                    </span>
                    {isDealer && (
                      <span className="px-1.5 py-0.5 rounded bg-amber-400 text-slate-950 text-[9px] font-black">
                        CRIB
                      </span>
                    )}
                  </div>
                  <span className="font-mono font-black text-emerald-400 shrink-0">
                    {p.score} / {gameState.targetScore}
                  </span>
                </div>
                <div className="w-full h-2.5 rounded-full bg-slate-800 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-cyan-500 to-emerald-400 transition-all duration-300"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                {p.lastActionLabel && (
                  <div className="text-[10px] text-slate-400 truncate">
                    {p.lastActionLabel}
                  </div>
                )}
              </div>
            );
          })}
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
                {allPlayersInOrder.map((p) => (
                  <div
                    key={p.id}
                    className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-white">
                        {formatName(p.id)} Hand
                      </span>
                      <span className="font-mono font-black text-emerald-400">
                        +{p.lastShowBreakdown?.total ?? 0} pts
                      </span>
                    </div>
                    <HandView
                      cards={p.handZone.cards}
                      cardCount={p.handZone.cardCount}
                      size="sm"
                      fanAngleDeg={3}
                    />
                    <div className="text-[10px] text-slate-400">
                      {p.lastShowBreakdown &&
                      p.lastShowBreakdown.details.length > 0
                        ? p.lastShowBreakdown.details.join(' • ')
                        : '0 pts (No 15s, pairs, or runs)'}
                    </div>
                  </div>
                ))}

                {gameState.cribBreakdown && (
                  <div className="p-2.5 rounded-xl bg-amber-950/25 border border-amber-500/40 space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-amber-300">
                        {formatName(
                          gameState.playerOrder[gameState.dealerIndex]!
                        )}{' '}
                        Crib
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

