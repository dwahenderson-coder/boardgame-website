import React, { useState } from 'react';
import { formatCardLabel } from '../common/cards/index.js';
import {
  getKingsCornersCardPoints,
  KC_INITIAL_QUARTERS,
  KingsCornersAction,
  KingsCornersSanitizedGameState,
  KingsCornersSanitizedPlayerState,
} from '../games/kings-corners/index.js';
import { PlayingCard } from './components/cards/PlayingCard.js';
import { getPlayerPalette } from './mapData.js';

export interface KingsCornersBoardProps {
  readonly gameState: KingsCornersSanitizedGameState;
  readonly playerId: string;
  readonly playerNames: Readonly<Record<string, string>>;
  readonly sendAction: (action: KingsCornersAction) => void;
}

const SLOT_LABELS = [
  'Top-Left (#1)',
  'Top-Right (#2)',
  'Bottom-Left (#3)',
  'Bottom-Right (#4)',
] as const;

/**
 * Renders 4 visual Quarter coins instead of a numeric text total.
 * Active quarters render as 3D metallic coins with milled edges and "25¢";
 * spent quarters render as recessed empty felt coin slots.
 */
const VisualQuartersRow: React.FC<{
  readonly quarters: number;
  readonly size?: 'sm' | 'md';
}> = ({ quarters, size = 'sm' }) => {
  const slots = [0, 1, 2, 3] as const;
  const dim =
    size === 'md'
      ? 'w-8 h-8 text-[10px]'
      : 'w-6 h-6 text-[8px]';

  return (
    <div
      className="inline-flex items-center gap-1.5"
      aria-label={`${quarters} of ${KC_INITIAL_QUARTERS} quarters remaining`}
    >
      {slots.map((idx) => {
        const hasQuarter = idx < quarters;
        return hasQuarter ? (
          <div
            key={idx}
            title={`Quarter #${idx + 1} (Active)`}
            className={`${dim} rounded-full flex items-center justify-center font-black select-none shadow-[0_2px_6px_rgba(0,0,0,0.65),inset_0_1px_2px_rgba(255,255,255,0.85)] border-2 border-amber-300 bg-gradient-to-br from-amber-100 via-slate-200 to-amber-400 text-slate-900 ring-1 ring-amber-500/60 transition-transform`}
          >
            <span className="tracking-tighter leading-none drop-shadow-[0_1px_0_rgba(255,255,255,0.6)]">
              25¢
            </span>
          </div>
        ) : (
          <div
            key={idx}
            title={`Quarter #${idx + 1} (Paid to Pot)`}
            className={`${dim} rounded-full flex items-center justify-center font-bold select-none border border-dashed border-emerald-950/90 bg-black/40 text-emerald-900/50 shadow-inner`}
          >
            <span className="leading-none">○</span>
          </div>
        );
      })}
    </div>
  );
};

export const KingsCornersBoard: React.FC<KingsCornersBoardProps> = ({
  gameState,
  playerId: _playerId,
  playerNames,
  sendAction,
}) => {
  const [takingDiscardMode, setTakingDiscardMode] = useState<boolean>(false);

  const formatName = (id: string): string =>
    playerNames[id] ? `${playerNames[id]} (${id})` : id;

  const self = gameState.self;
  const isMyTurn =
    gameState.phase === 'PLAYING' &&
    gameState.turnStep !== 'INITIAL_PEEK' &&
    gameState.turnStep !== 'HAND_OVER' &&
    gameState.activePlayerId === self.id;

  const isLastRoundActive =
    gameState.knockerId !== null &&
    gameState.turnStep !== 'HAND_OVER' &&
    gameState.phase !== 'GAME_OVER';

  const allPlayersInOrder: KingsCornersSanitizedPlayerState[] =
    gameState.playerOrder.map((pid) =>
      pid === self.id ? self : gameState.opponents[pid]!
    );

  const handleSlotClick = (slotIndex: 0 | 1 | 2 | 3) => {
    if (!isMyTurn) return;

    if (gameState.turnStep === 'DECIDING_DRAWN_CARD') {
      sendAction({
        type: 'KC_USE_DRAWN',
        replaceSlotIndex: slotIndex,
      });
      return;
    }

    if (
      gameState.turnStep === 'AWAITING_TURN_ACTION' &&
      takingDiscardMode &&
      gameState.discardTopCard
    ) {
      setTakingDiscardMode(false);
      sendAction({
        type: 'KC_TAKE_DISCARD',
        replaceSlotIndex: slotIndex,
      });
    }
  };

  return (
    <div className="relative w-full h-full flex flex-col kc-felt-surface text-slate-100 overflow-y-auto select-none p-4 lg:p-6 pb-28">
      {/* Decorative Casino Felt Gold Pinstripe Frame */}
      <div className="pointer-events-none fixed inset-x-6 top-20 bottom-8 rounded-[40px] border border-amber-400/20 shadow-[inset_0_0_80px_rgba(0,0,0,0.45)] z-0" />

      {/* Top Status & Rules Header */}
      <div className="relative z-10 w-full max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-3 bg-emerald-950/85 backdrop-blur-sm border border-amber-500/40 rounded-2xl px-4 py-2.5 shadow-xl">
        <div className="flex flex-wrap items-center gap-3">
          <span
            className="kc-calligraphy text-2xl sm:text-3xl font-bold px-2 leading-none"
            style={{
              color: '#dc2626',
              textShadow:
                '0 0 2px #fde047, 0 1px 0 #f59e0b, 0 2px 6px rgba(0,0,0,0.85), 1px 1px 0 #fef08a, -1px -1px 0 #f59e0b',
            }}
          >
            Kings Corners
          </span>
          <span className="px-2.5 py-1 rounded-lg bg-amber-500/20 border border-amber-400/40 text-amber-200 text-xs font-black uppercase tracking-wider">
            Hand #{gameState.handNumber}
          </span>
          <span className="px-2.5 py-1 rounded-lg bg-emerald-900/80 border border-amber-400/40 text-amber-300 text-xs font-bold">
            🪙 Pot: {gameState.potQuarters} Quarter
            {gameState.potQuarters === 1 ? '' : 's'} ($
            {(gameState.potQuarters * 0.25).toFixed(2)})
          </span>
          {gameState.knockerId && (
            <span className="px-3 py-1 rounded-lg bg-rose-700/80 border border-amber-300 text-amber-100 text-xs font-black animate-pulse">
              🔔 {formatName(gameState.knockerId)} KNOCKED!
            </span>
          )}
        </div>

        <div className="text-[11px] text-emerald-100/90 font-medium">
          Scoring:{' '}
          <strong className="text-amber-300">K = 0</strong> •{' '}
          <strong className="text-white">A = 1</strong> •{' '}
          <strong className="text-white">2–9 = Face</strong> •{' '}
          <strong className="text-white">10/J/Q = 10</strong> (Lowest 4-Card Total Wins)
        </div>
      </div>

      {/* Opponent 2x2 Mini Displays */}
      <div className="relative z-10 w-full max-w-6xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 my-3">
        {allPlayersInOrder
          .filter((p) => p.id !== self.id)
          .map((opp) => {
            const isTurn =
              gameState.turnStep !== 'INITIAL_PEEK' &&
              gameState.turnStep !== 'HAND_OVER' &&
              gameState.activePlayerId === opp.id;
            const isDealer =
              gameState.playerOrder.indexOf(opp.id) === gameState.dealerIndex;
            const isKnocker = gameState.knockerId === opp.id;
            const palette = getPlayerPalette(opp.id, gameState.playerOrder);

            return (
              <div
                key={opp.id}
                className={`rounded-2xl p-3 border transition-all flex flex-col justify-between backdrop-blur-sm ${
                  opp.eliminated
                    ? 'bg-emerald-950/35 border-emerald-900/50 opacity-50'
                    : isTurn
                      ? 'bg-emerald-950/90 border-amber-400 ring-2 ring-amber-400/50 shadow-xl'
                      : 'bg-emerald-950/75 border-emerald-800/80 shadow-md'
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-2">
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
                      <span className="px-1.5 py-0.5 rounded bg-amber-400 text-slate-950 text-[9px] font-black">
                        DEALER
                      </span>
                    )}
                    {isKnocker && (
                      <span className="px-1.5 py-0.5 rounded bg-rose-600 text-white text-[9px] font-black">
                        KNOCKED
                      </span>
                    )}
                  </div>
                </div>

                {/* Opponent 2x2 Grid with Swapped-Card Highlighting */}
                <div className="grid grid-cols-2 gap-2 place-items-center my-1">
                  {([0, 1, 2, 3] as const).map((sIdx) => {
                    const card = opp.visibleSlots[sIdx] ?? null;
                    const isSwappedSlot = opp.lastSwappedSlot === sIdx;
                    const isLatestTableSwap =
                      gameState.lastSwappedMove?.playerId === opp.id &&
                      gameState.lastSwappedMove?.slotIndex === sIdx;

                    return (
                      <div
                        key={sIdx}
                        className={`relative flex flex-col items-center gap-0.5 p-1.5 rounded-xl border transition-all ${
                          isSwappedSlot
                            ? 'bg-amber-500/25 border-amber-300 ring-2 ring-amber-400 shadow-[0_0_16px_rgba(251,191,36,0.65)]'
                            : 'border-transparent'
                        }`}
                      >
                        {isSwappedSlot && (
                          <span
                            className={`px-1.5 py-0.2 rounded-full text-[8px] font-black uppercase tracking-wider border mb-0.5 ${
                              isLatestTableSwap
                                ? 'bg-amber-400 text-slate-950 border-amber-200 animate-bounce'
                                : 'bg-amber-500/90 text-slate-950 border-amber-300'
                            }`}
                          >
                            🔄 Swapped
                          </span>
                        )}
                        <PlayingCard
                          {...(card ? { card } : {})}
                          faceDown={card === null}
                          size="sm"
                          highlighted={isSwappedSlot}
                        />
                        {card ? (
                          <span className="text-[9px] font-mono text-amber-300 font-bold">
                            {getKingsCornersCardPoints(card)} pts
                          </span>
                        ) : (
                          <span className="text-[8px] text-emerald-200/70 font-semibold">
                            Slot #{sIdx + 1}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* 4 Visual Quarters in Opponent Mini Display */}
                <div className="mt-2 pt-2 border-t border-emerald-800/70 flex items-center justify-between gap-2 text-xs">
                  <VisualQuartersRow quarters={opp.quarters} size="sm" />
                  {opp.lastHandScore !== null && (
                    <span className="px-2 py-0.5 rounded bg-emerald-900/90 border border-amber-400/40 font-mono font-bold text-amber-200 text-[11px]">
                      Total: {opp.lastHandScore} pts
                    </span>
                  )}
                </div>

                {opp.lastActionLabel && (
                  <div className="mt-1 text-[10px] text-emerald-200/80 truncate">
                    {opp.lastActionLabel}
                  </div>
                )}
              </div>
            );
          })}
      </div>

      {/* Center Poker Table Felt with Red & Gold Calligraphy Emblem, Draw Deck, and Discard Pile */}
      <div className="relative z-10 w-full max-w-4xl mx-auto my-2 rounded-3xl bg-gradient-to-b from-emerald-900/75 via-emerald-950/85 to-emerald-950/90 border-2 border-amber-400/60 p-5 shadow-[0_12px_40px_rgba(0,0,0,0.65),inset_0_0_40px_rgba(6,78,59,0.5)] flex flex-col items-center gap-4">
        {/* Centerpiece Red & Gold Calligraphy Crest on the Felt */}
        <div className="flex flex-col items-center text-center select-none">
          <div className="flex items-center gap-3">
            <span className="text-amber-400 text-lg drop-shadow">⚜️</span>
            <h1
              className="kc-calligraphy text-5xl sm:text-6xl font-bold tracking-wide leading-tight px-3"
              style={{
                color: '#dc2626',
                WebkitTextStroke: '1px #fbbf24',
                textShadow:
                  '0 0 4px #fde047, 0 2px 0 #b45309, 0 4px 14px rgba(0,0,0,0.85), 2px 2px 0 #fef08a',
              }}
            >
              Kings Corners
            </h1>
            <span className="text-amber-400 text-lg drop-shadow">⚜️</span>
          </div>
          <div className="h-0.5 w-56 bg-gradient-to-r from-transparent via-amber-400 to-transparent opacity-80" />
        </div>

        <div className="w-full flex flex-col md:flex-row items-center justify-around gap-6">
          {/* Draw Pile & Discard Pile */}
          <div className="flex items-center gap-6">
            {/* Draw Deck */}
            <div className="flex flex-col items-center gap-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-200/90">
                Draw Deck ({gameState.drawPileCount})
              </span>
              {gameState.drawPileCount > 0 ? (
                <PlayingCard
                  faceDown={true}
                  size="lg"
                  {...(isMyTurn && gameState.turnStep === 'AWAITING_TURN_ACTION'
                    ? {
                        onClick: () => {
                          setTakingDiscardMode(false);
                          sendAction({ type: 'KC_DRAW_DECK' });
                        },
                      }
                    : {})}
                />
              ) : (
                <div className="w-20 h-28 rounded-xl border-2 border-dashed border-amber-400/50 bg-emerald-950/70 flex items-center justify-center text-center p-2 text-[10px] font-bold text-amber-300">
                  Deck Exhausted
                </div>
              )}
            </div>

            {/* Discard Pile */}
            <div className="flex flex-col items-center gap-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-200/90">
                Discard Pile ({gameState.discardPileCount})
              </span>
              {gameState.discardTopCard ? (
                <PlayingCard
                  card={gameState.discardTopCard}
                  size="lg"
                  highlighted={takingDiscardMode}
                  {...(isMyTurn && gameState.turnStep === 'AWAITING_TURN_ACTION'
                    ? {
                        onClick: () =>
                          setTakingDiscardMode((prev) => !prev),
                      }
                    : {})}
                />
              ) : (
                <div className="w-20 h-28 rounded-xl border-2 border-dashed border-emerald-700 flex items-center justify-center text-xs text-emerald-400/60">
                  Empty
                </div>
              )}
            </div>

            {/* Drawn Card Preview when deciding */}
            {gameState.pendingDrawnCard && (
              <div className="flex flex-col items-center gap-1.5 pl-4 border-l border-emerald-700/80">
                <span className="text-[10px] font-black uppercase tracking-wider text-amber-300 animate-pulse">
                  Drawn Card (
                  {getKingsCornersCardPoints(gameState.pendingDrawnCard)} pts)
                </span>
                <PlayingCard
                  card={gameState.pendingDrawnCard}
                  size="lg"
                  highlighted={true}
                />
              </div>
            )}
          </div>

          {/* Center Action / Phase Instructions */}
          <div className="flex flex-col items-center md:items-start gap-2.5 max-w-md text-center md:text-left">
            {gameState.turnStep === 'INITIAL_PEEK' && (
              <div className="space-y-2">
                <div className="text-sm font-black text-amber-300">
                  👀 Opening Peek Phase
                </div>
                <p className="text-xs text-emerald-100 leading-relaxed">
                  Look at either your <strong>Top 2</strong> or{' '}
                  <strong>Bottom 2</strong> cards. Memorize them carefully — once
                  you lock in and the hand begins, you cannot look at your cards
                  again!
                </p>
                {!self.eliminated && (
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    {self.peekedRow === null ? (
                      <>
                        <button
                          onClick={() =>
                            sendAction({ type: 'KC_PEEK_CARDS', row: 'TOP' })
                          }
                          className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs shadow cursor-pointer"
                        >
                          👀 Peek Top 2 Cards
                        </button>
                        <button
                          onClick={() =>
                            sendAction({ type: 'KC_PEEK_CARDS', row: 'BOTTOM' })
                          }
                          className="px-4 py-2 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-black text-xs shadow cursor-pointer"
                        >
                          👀 Peek Bottom 2 Cards
                        </button>
                      </>
                    ) : !self.readyAfterPeek ? (
                      <button
                        onClick={() => sendAction({ type: 'KC_FINISH_PEEK' })}
                        className="px-5 py-2.5 rounded-xl bg-emerald-400 hover:bg-emerald-300 text-slate-950 font-black text-xs shadow-lg cursor-pointer"
                      >
                        ✓ Memorized! Hide Cards & Start Hand
                      </button>
                    ) : (
                      <span className="px-3 py-1.5 rounded-lg bg-emerald-900/90 border border-emerald-600 text-emerald-200 text-xs font-bold">
                        ✓ Cards Hidden — Waiting for other players to finish peeking...
                      </span>
                    )}
                  </div>
                )}
              </div>
            )}

            {gameState.turnStep === 'AWAITING_TURN_ACTION' && (
              <div className="space-y-2.5">
                <div className="text-sm font-black text-white">
                  {isMyTurn
                    ? '⚡ Your Turn — Choose an Action:'
                    : `Waiting for ${formatName(gameState.activePlayerId)}...`}
                </div>

                {isMyTurn && (
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      disabled={gameState.drawPileCount === 0}
                      onClick={() => {
                        setTakingDiscardMode(false);
                        sendAction({ type: 'KC_DRAW_DECK' });
                      }}
                      className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-slate-950 font-black text-xs shadow cursor-pointer"
                    >
                      🎴 Draw from Deck ({gameState.drawPileCount})
                    </button>

                    {gameState.discardTopCard && (
                      <button
                        onClick={() =>
                          setTakingDiscardMode((prev) => !prev)
                        }
                        className={`px-4 py-2.5 rounded-xl font-black text-xs border transition cursor-pointer ${
                          takingDiscardMode
                            ? 'bg-amber-300 text-slate-950 border-amber-200'
                            : 'bg-emerald-900/90 hover:bg-emerald-800 text-amber-200 border-amber-400/50'
                        }`}
                      >
                        {takingDiscardMode
                          ? '👇 Click one of your 4 cards below to swap!'
                          : `♻️ Take Discard (${formatCardLabel(gameState.discardTopCard)})`}
                      </button>
                    )}

                    {gameState.knockerId === null && (
                      <button
                        onClick={() => {
                          setTakingDiscardMode(false);
                          sendAction({ type: 'KC_KNOCK' });
                        }}
                        className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-black text-xs border border-amber-300/60 shadow cursor-pointer"
                      >
                        🔔 Knock!
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}

            {gameState.turnStep === 'DECIDING_DRAWN_CARD' && (
              <div className="space-y-2">
                <div className="text-sm font-black text-amber-300">
                  {isMyTurn
                    ? `You drew ${gameState.pendingDrawnCard ? formatCardLabel(gameState.pendingDrawnCard) : 'a card'}! Click any of your 4 cards below to replace it, or discard it:`
                    : `${formatName(gameState.activePlayerId)} is deciding what to do with their drawn card...`}
                </div>
                {isMyTurn && (
                  <button
                    onClick={() => sendAction({ type: 'KC_DISCARD_DRAWN' })}
                    className="px-4 py-2 rounded-xl bg-rose-600/90 hover:bg-rose-500 text-white font-bold text-xs shadow cursor-pointer"
                  >
                    🗑️ Discard Drawn Card Without Swapping
                  </button>
                )}
              </div>
            )}

            {gameState.turnStep === 'HAND_OVER' && (
              <div className="space-y-2">
                {gameState.lastHandSummary && (
                  <div className="p-3 rounded-xl bg-emerald-950/95 border border-amber-400/50 text-xs space-y-1">
                    <div className="font-black text-amber-300">
                      Hand #{gameState.lastHandSummary.handNumber} Results (
                      {gameState.lastHandSummary.endedByDeckExhausted
                        ? 'Draw Deck Exhausted'
                        : `Knocked by ${formatName(gameState.lastHandSummary.knockerId)}`}
                      )
                    </div>
                    {gameState.lastHandSummary.isPush ? (
                      <div className="text-emerald-300 font-bold">
                        🤝 {gameState.lastHandSummary.pushReason}
                      </div>
                    ) : (
                      <div className="text-rose-200 font-bold">
                        🪙 Highest Total ({gameState.lastHandSummary.highestScore}{' '}
                        pts):{' '}
                        {gameState.lastHandSummary.losers
                          .map(formatName)
                          .join(', ')}{' '}
                        paid 1 Quarter to the Pot!
                      </div>
                    )}
                  </div>
                )}

                {gameState.phase !== 'GAME_OVER' && (
                  <button
                    onClick={() => sendAction({ type: 'KC_NEXT_HAND' })}
                    className="px-5 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs shadow-lg cursor-pointer"
                  >
                    🃏 Deal Next Hand (Hand #{gameState.handNumber + 1})
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Hero 2x2 Grid (2 Top, 2 Bottom) */}
      <div
        className={`relative z-10 w-full max-w-4xl mx-auto mt-2 rounded-2xl p-4 border backdrop-blur-sm transition-all ${
          isMyTurn
            ? 'bg-emerald-950/90 border-amber-400 ring-2 ring-amber-400/50 shadow-2xl'
            : 'bg-emerald-950/80 border-emerald-800/80 shadow-lg'
        }`}
      >
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="space-y-2.5 text-center md:text-left">
            <div className="flex items-center justify-center md:justify-start gap-2">
              <span className="text-base font-black text-white">
                {formatName(self.id)} (You)
              </span>
              {gameState.playerOrder.indexOf(self.id) ===
                gameState.dealerIndex && (
                <span className="px-2 py-0.5 rounded bg-amber-400 text-slate-950 text-[10px] font-black">
                  DEALER
                </span>
              )}
              {gameState.knockerId === self.id && (
                <span className="px-2 py-0.5 rounded bg-rose-600 text-white text-[10px] font-black">
                  🔔 YOU KNOCKED
                </span>
              )}
            </div>

            {/* 4 Visual Quarters for Self */}
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-4 text-xs">
              <div className="flex items-center gap-2">
                <span className="text-emerald-200/90 font-semibold">
                  Your Quarters:
                </span>
                <VisualQuartersRow quarters={self.quarters} size="md" />
              </div>

              {self.lastHandScore !== null && (
                <span className="text-emerald-200/90">
                  Revealed Hand Score:{' '}
                  <strong className="text-amber-300 text-sm font-black">
                    {self.lastHandScore} pts
                  </strong>
                </span>
              )}
            </div>

            <p className="text-[11px] text-emerald-200/80 max-w-xs">
              {isMyTurn &&
              (gameState.turnStep === 'DECIDING_DRAWN_CARD' ||
                takingDiscardMode)
                ? '👉 Click any of your 4 card slots on the right to replace that card face-down!'
                : 'Your 4 cards are arranged 2 on Top and 2 on Bottom. All replaced cards stay face-down until the hand ends.'}
            </p>
          </div>

          {/* Hero 2x2 Card Matrix */}
          <div className="grid grid-cols-2 gap-3 bg-emerald-950/90 border border-amber-500/30 rounded-2xl p-4 shadow-inner">
            {([0, 1, 2, 3] as const).map((slotIdx) => {
              const card = self.visibleSlots[slotIdx];
              const isSelectableForSwap =
                isMyTurn &&
                (gameState.turnStep === 'DECIDING_DRAWN_CARD' ||
                  takingDiscardMode);
              const isMyLastSwapped = self.lastSwappedSlot === slotIdx;

              return (
                <div
                  key={slotIdx}
                  onClick={() => handleSlotClick(slotIdx)}
                  className={`flex flex-col items-center gap-1 p-2 rounded-xl border transition ${
                    isSelectableForSwap
                      ? 'border-amber-400 bg-amber-500/15 hover:bg-amber-500/25 cursor-pointer ring-2 ring-amber-400/40'
                      : isMyLastSwapped
                        ? 'border-amber-400/70 bg-amber-500/10'
                        : 'border-emerald-800/80 bg-emerald-900/40'
                  }`}
                >
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] font-bold text-emerald-200/90">
                      {SLOT_LABELS[slotIdx]}
                    </span>
                    {isMyLastSwapped && (
                      <span className="px-1 py-0.2 rounded bg-amber-400 text-slate-950 text-[8px] font-black uppercase">
                        Swapped
                      </span>
                    )}
                  </div>
                  <PlayingCard
                    {...(card ? { card } : {})}
                    faceDown={card === null}
                    size="md"
                    highlighted={isSelectableForSwap || isMyLastSwapped}
                  />
                  {card ? (
                    <span className="text-[10px] font-mono font-bold text-amber-300">
                      {getKingsCornersCardPoints(card)} pts
                    </span>
                  ) : (
                    <span className="text-[10px] text-emerald-300/70">
                      {isSelectableForSwap ? 'Click to Replace' : 'Face-Down'}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Large Bottom Banner Displaying "Last Round" After a Player Knocks */}
      {isLastRoundActive && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-0 inset-x-0 z-30 pointer-events-none flex justify-center px-4 pb-3"
        >
          <div className="w-full max-w-4xl rounded-2xl border-2 border-amber-300 bg-gradient-to-r from-rose-950 via-red-800 to-rose-950 px-6 py-3 shadow-[0_-8px_30px_rgba(220,38,38,0.65)] flex flex-col sm:flex-row items-center justify-between gap-2 text-center">
            <div className="flex items-center gap-3">
              <span className="text-2xl animate-bounce">🔔</span>
              <span
                className="text-2xl sm:text-3xl font-black uppercase tracking-widest text-amber-300 drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]"
              >
                Last Round
              </span>
              <span className="text-2xl animate-bounce">🔔</span>
            </div>
            <div className="text-xs sm:text-sm font-bold text-amber-100">
              {formatName(gameState.knockerId!)} knocked — every other player gets one final turn!
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
