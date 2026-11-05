import React, { useState } from 'react';
import { formatCardLabel } from '../common/cards/index.js';
import {
  getKingsCornersCardPoints,
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

export const KingsCornersBoard: React.FC<KingsCornersBoardProps> = ({
  gameState,
  playerId,
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
    <div className="w-full h-full flex flex-col bg-slate-950 text-slate-100 overflow-y-auto select-none p-4 lg:p-6 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-amber-950/30 via-slate-950 to-slate-950">
      {/* Top Status & Rules Header */}
      <div className="w-full max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-3 bg-slate-900/90 border border-slate-800 rounded-2xl px-4 py-3 shadow-lg">
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="px-2.5 py-1 rounded-lg bg-amber-500/20 border border-amber-500/40 text-amber-300 text-xs font-black uppercase tracking-wider">
            👑 Kings Corners • Hand #{gameState.handNumber}
          </span>
          <span className="px-2.5 py-1 rounded-lg bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-bold">
            🪙 Pot: {gameState.potQuarters} Quarters ($
            {(gameState.potQuarters * 0.25).toFixed(2)})
          </span>
          {gameState.knockerId && (
            <span className="px-3 py-1 rounded-lg bg-rose-600/30 border border-rose-500 text-rose-200 text-xs font-black animate-pulse">
              🔔 {formatName(gameState.knockerId)} KNOCKED — Final Round!
            </span>
          )}
        </div>

        <div className="text-[11px] text-slate-400 font-medium">
          Scoring:{' '}
          <strong className="text-amber-300">K = 0</strong> •{' '}
          <strong className="text-slate-200">A = 1</strong> •{' '}
          <strong className="text-slate-200">2–9 = Face</strong> •{' '}
          <strong className="text-slate-200">10/J/Q = 10</strong> (Lowest 4-Card Total Wins)
        </div>
      </div>

      {/* Opponent 2x2 Grids */}
      <div className="w-full max-w-6xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 my-4">
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
                className={`rounded-2xl p-3 border transition-all flex flex-col justify-between ${
                  opp.eliminated
                    ? 'bg-slate-900/30 border-slate-800/50 opacity-50'
                    : isTurn
                      ? 'bg-slate-900 border-amber-400 ring-2 ring-amber-400/40 shadow-lg'
                      : 'bg-slate-900/80 border-slate-800'
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

                {/* Opponent 2x2 Grid */}
                <div className="grid grid-cols-2 gap-2 place-items-center my-1">
                  {opp.visibleSlots.map((card, sIdx) => (
                    <div
                      key={sIdx}
                      className="flex flex-col items-center gap-0.5"
                    >
                      <PlayingCard
                        {...(card ? { card } : {})}
                        faceDown={card === null}
                        size="sm"
                      />
                      {card && (
                        <span className="text-[9px] font-mono text-amber-300 font-bold">
                          {getKingsCornersCardPoints(card)} pts
                        </span>
                      )}
                    </div>
                  ))}
                </div>

                <div className="mt-2 pt-2 border-t border-slate-800 flex items-center justify-between text-xs">
                  <span className="font-bold text-amber-300">
                    🪙 {opp.quarters} Quarter{opp.quarters === 1 ? '' : 's'}
                  </span>
                  {opp.lastHandScore !== null && (
                    <span className="px-2 py-0.5 rounded bg-slate-800 font-mono font-bold text-white text-[11px]">
                      Total: {opp.lastHandScore} pts
                    </span>
                  )}
                </div>

                {opp.lastActionLabel && (
                  <div className="mt-1 text-[10px] text-slate-400 truncate">
                    {opp.lastActionLabel}
                  </div>
                )}
              </div>
            );
          })}
      </div>

      {/* Center Table: Draw Deck, Discard Pile, and Hand Over / Knock Controls */}
      <div className="w-full max-w-4xl mx-auto my-2 rounded-3xl bg-gradient-to-b from-emerald-950/60 via-slate-900/90 to-slate-900 border-2 border-amber-500/40 p-5 shadow-xl flex flex-col md:flex-row items-center justify-around gap-6">
        {/* Draw Pile & Discard Pile */}
        <div className="flex items-center gap-6">
          {/* Draw Deck */}
          <div className="flex flex-col items-center gap-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Draw Deck ({gameState.drawPileCount})
            </span>
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
          </div>

          {/* Discard Pile */}
          <div className="flex flex-col items-center gap-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
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
              <div className="w-20 h-28 rounded-xl border-2 border-dashed border-slate-700 flex items-center justify-center text-xs text-slate-500">
                Empty
              </div>
            )}
          </div>

          {/* Drawn Card Preview when deciding */}
          {gameState.pendingDrawnCard && (
            <div className="flex flex-col items-center gap-1.5 pl-4 border-l border-slate-800">
              <span className="text-[10px] font-black uppercase tracking-wider text-amber-300 animate-pulse">
                Drawn Card ({getKingsCornersCardPoints(gameState.pendingDrawnCard)}{' '}
                pts)
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
              <p className="text-xs text-slate-300 leading-relaxed">
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
                        className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black text-xs shadow cursor-pointer"
                      >
                        👀 Peek Bottom 2 Cards
                      </button>
                    </>
                  ) : !self.readyAfterPeek ? (
                    <button
                      onClick={() => sendAction({ type: 'KC_FINISH_PEEK' })}
                      className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs shadow-lg cursor-pointer"
                    >
                      ✓ Memorized! Hide Cards & Start Hand
                    </button>
                  ) : (
                    <span className="px-3 py-1.5 rounded-lg bg-slate-800 text-emerald-300 text-xs font-bold">
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
                    onClick={() => {
                      setTakingDiscardMode(false);
                      sendAction({ type: 'KC_DRAW_DECK' });
                    }}
                    className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs shadow cursor-pointer"
                  >
                    🎴 Draw from Deck
                  </button>

                  {gameState.discardTopCard && (
                    <button
                      onClick={() =>
                        setTakingDiscardMode((prev) => !prev)
                      }
                      className={`px-4 py-2.5 rounded-xl font-black text-xs border transition cursor-pointer ${
                        takingDiscardMode
                          ? 'bg-amber-400 text-slate-950 border-amber-300'
                          : 'bg-slate-800 hover:bg-slate-700 text-amber-300 border-amber-500/40'
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
                      className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-black text-xs shadow cursor-pointer"
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
                <div className="p-3 rounded-xl bg-slate-950/90 border border-amber-500/40 text-xs space-y-1">
                  <div className="font-black text-amber-300">
                    Hand #{gameState.lastHandSummary.handNumber} Results (Knocked
                    by {formatName(gameState.lastHandSummary.knockerId)})
                  </div>
                  {gameState.lastHandSummary.isPush ? (
                    <div className="text-emerald-300 font-bold">
                      🤝 {gameState.lastHandSummary.pushReason}
                    </div>
                  ) : (
                    <div className="text-rose-300 font-bold">
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
                  className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs shadow-lg cursor-pointer"
                >
                  🃏 Deal Next Hand (Hand #{gameState.handNumber + 1})
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Bottom Hero 2x2 Grid (2 Top, 2 Bottom) */}
      <div
        className={`w-full max-w-4xl mx-auto mt-2 rounded-2xl p-4 border transition-all ${
          isMyTurn
            ? 'bg-slate-900/95 border-amber-400 ring-2 ring-amber-400/40 shadow-xl'
            : 'bg-slate-900/85 border-slate-800'
        }`}
      >
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="space-y-2 text-center md:text-left">
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

            <div className="flex items-center justify-center md:justify-start gap-4 text-xs">
              <span className="text-slate-400">
                Quarters Remaining:{' '}
                <strong className="text-amber-300 text-sm font-black">
                  🪙 {self.quarters} (${(self.quarters * 0.25).toFixed(2)})
                </strong>
              </span>
              {self.lastHandScore !== null && (
                <span className="text-slate-400">
                  Revealed Hand Score:{' '}
                  <strong className="text-emerald-400 text-sm font-black">
                    {self.lastHandScore} pts
                  </strong>
                </span>
              )}
            </div>

            <p className="text-[11px] text-slate-400 max-w-xs">
              {isMyTurn &&
              (gameState.turnStep === 'DECIDING_DRAWN_CARD' ||
                takingDiscardMode)
                ? '👉 Click any of your 4 card slots on the right to replace that card face-down!'
                : 'Your 4 cards are arranged 2 on Top and 2 on Bottom. All replaced cards stay face-down until the hand ends.'}
            </p>
          </div>

          {/* Hero 2x2 Card Matrix */}
          <div className="grid grid-cols-2 gap-3 bg-slate-950/80 border border-slate-800 rounded-2xl p-4">
            {([0, 1, 2, 3] as const).map((slotIdx) => {
              const card = self.visibleSlots[slotIdx];
              const isSelectableForSwap =
                isMyTurn &&
                (gameState.turnStep === 'DECIDING_DRAWN_CARD' ||
                  takingDiscardMode);

              return (
                <div
                  key={slotIdx}
                  onClick={() => handleSlotClick(slotIdx)}
                  className={`flex flex-col items-center gap-1 p-2 rounded-xl border transition ${
                    isSelectableForSwap
                      ? 'border-amber-400 bg-amber-500/10 hover:bg-amber-500/20 cursor-pointer ring-2 ring-amber-400/30'
                      : 'border-slate-800/80 bg-slate-900/50'
                  }`}
                >
                  <span className="text-[10px] font-bold text-slate-400">
                    {SLOT_LABELS[slotIdx]}
                  </span>
                  <PlayingCard
                    {...(card ? { card } : {})}
                    faceDown={card === null}
                    size="md"
                    highlighted={isSelectableForSwap}
                  />
                  {card ? (
                    <span className="text-[10px] font-mono font-bold text-amber-300">
                      {getKingsCornersCardPoints(card)} pts
                    </span>
                  ) : (
                    <span className="text-[10px] text-slate-500">
                      {isSelectableForSwap ? 'Click to Replace' : 'Face-Down'}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

