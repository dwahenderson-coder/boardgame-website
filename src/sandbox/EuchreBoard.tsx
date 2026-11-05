import React from 'react';
import {
  CARD_SUITS,
  SUIT_METADATA,
} from '../common/cards/index.js';
import {
  EuchreAction,
  EuchrePublicPlayerState,
  EuchreSanitizedGameState,
  isLegalEuchreCardPlay,
} from '../games/euchre/index.js';
import { HandView } from './components/cards/HandView.js';
import { PlayingCard } from './components/cards/PlayingCard.js';
import { getPlayerPalette } from './mapData.js';

export interface EuchreBoardProps {
  readonly gameState: EuchreSanitizedGameState;
  readonly playerId: string;
  readonly playerNames: Readonly<Record<string, string>>;
  readonly sendAction: (action: EuchreAction) => void;
}

export const EuchreBoard: React.FC<EuchreBoardProps> = ({
  gameState,
  playerNames,
  sendAction,
}) => {
  const formatName = (id: string): string =>
    playerNames[id] ? `${playerNames[id]} (${id})` : id;

  const self = gameState.self;
  const isMyTurn =
    gameState.phase === 'PLAYING' &&
    gameState.turnStep !== 'HAND_OVER' &&
    gameState.activePlayerId === self.id;

  const allPlayersInOrder: EuchrePublicPlayerState[] =
    gameState.playerOrder.map((pid) =>
      pid === self.id ? self : gameState.opponents[pid]!
    );

  const leadCard = gameState.currentTrick[0]?.card ?? null;
  const selfCards = self.handZone.cards ?? [];

  const legalCardIds = new Set<string>(
    gameState.turnStep === 'PLAYING_TRICK' && isMyTurn
      ? selfCards
          .filter((c) =>
            isLegalEuchreCardPlay(
              selfCards,
              c,
              leadCard,
              gameState.trumpSuit
            )
          )
          .map((c) => c.id)
      : []
  );

  return (
    <div className="w-full h-full flex flex-col bg-slate-950 text-slate-100 overflow-y-auto select-none p-4 lg:p-6 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-indigo-950/45 via-slate-950 to-slate-950">
      {/* Top Euchre Status Bar */}
      <div className="w-full max-w-5xl mx-auto flex flex-wrap items-center justify-between gap-3 bg-slate-900/90 border border-slate-800 rounded-2xl px-4 py-3 shadow-lg">
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="px-2.5 py-1 rounded-lg bg-indigo-500/20 border border-indigo-500/40 text-indigo-300 text-xs font-black uppercase tracking-wider">
            ♠️ Euchre • Hand #{gameState.handNumber} • Trick #{gameState.trickNumber}/5
          </span>
          {gameState.trumpSuit ? (
            <span className="px-3 py-1 rounded-lg bg-amber-400 text-slate-950 text-xs font-black">
              Trump: {SUIT_METADATA[gameState.trumpSuit].symbol}{' '}
              {SUIT_METADATA[gameState.trumpSuit].name} (Maker:{' '}
              {formatName(gameState.makerPlayerId ?? '')})
            </span>
          ) : (
            <span className="px-2.5 py-1 rounded-lg bg-slate-800 text-slate-300 text-xs font-semibold">
              Bidding for Trump ({gameState.turnStep === 'ORDER_UP_ROUND' ? 'Round 1' : 'Round 2'})
            </span>
          )}
        </div>

        <div className="text-[11px] text-slate-400">
          Target: <strong className="text-emerald-300">10 pts</strong> •{' '}
          <span className="text-amber-300 font-semibold">
            Right Bower = J of Trump • Left Bower = Same-Color J
          </span>
        </div>
      </div>

      {/* Opponent Seats */}
      <div className="w-full max-w-5xl mx-auto grid grid-cols-1 sm:grid-cols-3 gap-3 my-4">
        {allPlayersInOrder
          .filter((p) => p.id !== self.id)
          .map((opp) => {
            const seatIdx = gameState.playerOrder.indexOf(opp.id);
            const isDealer = seatIdx === gameState.dealerIndex;
            const isTurn =
              gameState.turnStep !== 'HAND_OVER' &&
              gameState.activePlayerId === opp.id;
            const palette = getPlayerPalette(opp.id, gameState.playerOrder);

            return (
              <div
                key={opp.id}
                className={`rounded-2xl p-3 border transition-all flex flex-col items-center justify-between ${
                  isTurn
                    ? 'bg-slate-900 border-indigo-400 ring-2 ring-indigo-400/40 shadow-lg'
                    : 'bg-slate-900/80 border-slate-800'
                }`}
              >
                <div className="w-full flex items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-1.5 truncate">
                    <span
                      className={`w-2.5 h-2.5 rounded-full shrink-0 ${palette.dotClass}`}
                    />
                    <span className="text-xs font-bold text-white truncate">
                      {formatName(opp.id)}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    {isDealer && (
                      <span className="px-1.5 py-0.5 rounded bg-amber-400 text-slate-950 text-[9px] font-black">
                        DEALER
                      </span>
                    )}
                    {gameState.makerPlayerId === opp.id && (
                      <span className="px-1.5 py-0.5 rounded bg-emerald-500 text-slate-950 text-[9px] font-black">
                        MAKER
                      </span>
                    )}
                  </div>
                </div>

                <HandView
                  cards={opp.handZone.cards}
                  cardCount={opp.handZone.cardCount}
                  size="sm"
                  fanAngleDeg={5}
                />

                <div className="w-full mt-2 pt-2 border-t border-slate-800 flex items-center justify-between text-xs">
                  <span className="font-black text-emerald-400">
                    Score: {opp.score} / 10
                  </span>
                  <span className="text-amber-300 font-bold">
                    Tricks: {opp.tricksWonThisHand}
                  </span>
                </div>

                {opp.lastActionLabel && (
                  <div className="mt-1 text-[10px] text-slate-400">
                    {opp.lastActionLabel}
                  </div>
                )}
              </div>
            );
          })}
      </div>

      {/* Center Trick Table & Trump Bidding Area */}
      <div className="w-full max-w-3xl mx-auto my-2 rounded-3xl bg-gradient-to-b from-indigo-950/60 via-slate-900/90 to-slate-900 border-2 border-indigo-500/40 p-5 shadow-xl flex flex-col items-center justify-center gap-4 min-h-[220px]">
        {/* Round 1 Upcard & Order Up Controls */}
        {gameState.turnStep === 'ORDER_UP_ROUND' && (
          <div className="flex flex-col sm:flex-row items-center gap-6">
            {gameState.upcard && (
              <div className="flex flex-col items-center gap-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-300">
                  Kitty Upcard
                </span>
                <PlayingCard
                  card={gameState.upcard}
                  size="lg"
                  highlighted={true}
                />
              </div>
            )}
            <div className="space-y-2 text-center sm:text-left">
              <div className="text-sm font-black text-white">
                {isMyTurn
                  ? `Order Up ${gameState.upcard && gameState.upcard.suit !== 'JOKER' ? SUIT_METADATA[gameState.upcard.suit].name : 'Suit'} as Trump or Pass?`
                  : `Waiting for ${formatName(gameState.activePlayerId)} to Order Up or Pass...`}
              </div>
              <p className="text-xs text-slate-400 max-w-sm">
                Ordering it up makes this suit Trump and the Dealer picks up the
                upcard.
              </p>
              {isMyTurn && (
                <div className="flex items-center justify-center sm:justify-start gap-2.5 pt-1">
                  <button
                    onClick={() => sendAction({ type: 'EUCHRE_ORDER_UP' })}
                    className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs shadow cursor-pointer"
                  >
                    👍 Order It Up!
                  </button>
                  <button
                    onClick={() => sendAction({ type: 'EUCHRE_PASS_TRUMP' })}
                    className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs border border-slate-700 cursor-pointer"
                  >
                    Pass
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Round 2 Name Trump Suit Controls */}
        {gameState.turnStep === 'NAME_TRUMP_ROUND' && (
          <div className="space-y-3 text-center">
            <div className="text-sm font-black text-white">
              {isMyTurn
                ? 'Round 2: Choose any remaining suit as Trump'
                : `Waiting for ${formatName(gameState.activePlayerId)} to name Trump...`}
            </div>
            {isMyTurn && (
              <div className="flex flex-wrap items-center justify-center gap-2.5">
                {CARD_SUITS.filter((s) => s !== gameState.turnedDownSuit).map(
                  (suit) => {
                    const meta = SUIT_METADATA[suit];
                    return (
                      <button
                        key={suit}
                        onClick={() =>
                          sendAction({ type: 'EUCHRE_CALL_TRUMP', suit })
                        }
                        className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-indigo-600 border border-slate-700 text-white font-black text-xs transition cursor-pointer flex items-center gap-1.5"
                      >
                        <span className="text-base">{meta.symbol}</span>
                        <span>Call {meta.name}</span>
                      </button>
                    );
                  }
                )}
                {gameState.activePlayerIndex !== gameState.dealerIndex && (
                  <button
                    onClick={() => sendAction({ type: 'EUCHRE_PASS_TRUMP' })}
                    className="px-4 py-2.5 rounded-xl bg-rose-950/60 hover:bg-rose-900 text-rose-200 border border-rose-500/40 font-bold text-xs cursor-pointer"
                  >
                    Pass
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* Trick Play Area */}
        {(gameState.turnStep === 'PLAYING_TRICK' ||
          gameState.turnStep === 'HAND_OVER') && (
          <div className="w-full flex flex-col items-center gap-3">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-400">
              {gameState.currentTrick.length > 0
                ? `Current Trick (${gameState.currentTrick.length}/${gameState.playerOrder.length})`
                : gameState.lastCompletedTrick
                  ? `Last Trick Won by ${formatName(gameState.lastCompletedTrick.winnerId)}`
                  : 'Lead a Card to Start Trick'}
            </div>

            <div className="flex flex-wrap items-center justify-center gap-4 min-h-[115px]">
              {(gameState.currentTrick.length > 0
                ? gameState.currentTrick
                : gameState.lastCompletedTrick?.plays ?? []
              ).map((play) => (
                <div
                  key={`${play.playerId}_${play.card.id}`}
                  className="flex flex-col items-center gap-1"
                >
                  <PlayingCard card={play.card} size="md" />
                  <span className="text-[10px] font-bold text-slate-300">
                    {formatName(play.playerId)}
                  </span>
                </div>
              ))}
            </div>

            {gameState.turnStep === 'HAND_OVER' &&
              gameState.phase !== 'GAME_OVER' && (
                <button
                  onClick={() => sendAction({ type: 'EUCHRE_NEXT_HAND' })}
                  className="mt-2 px-6 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs shadow-lg cursor-pointer"
                >
                  🃏 Deal Next Hand (Hand #{gameState.handNumber + 1})
                </button>
              )}
          </div>
        )}
      </div>

      {/* Bottom Hero Hand & Score */}
      <div
        className={`w-full max-w-4xl mx-auto mt-2 rounded-2xl p-4 border transition-all ${
          isMyTurn
            ? 'bg-slate-900/95 border-indigo-400 ring-2 ring-indigo-400/40 shadow-xl'
            : 'bg-slate-900/85 border-slate-800'
        }`}
      >
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="space-y-1.5 text-center md:text-left">
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
              {gameState.makerPlayerId === self.id && (
                <span className="px-2 py-0.5 rounded bg-emerald-500 text-slate-950 text-[10px] font-black">
                  MAKER
                </span>
              )}
            </div>

            <div className="flex items-center justify-center md:justify-start gap-4 text-xs">
              <span className="text-slate-400">
                Match Score:{' '}
                <strong className="text-emerald-400 text-sm font-black">
                  {self.score} / 10 pts
                </strong>
              </span>
              <span className="text-slate-400">
                Tricks This Hand:{' '}
                <strong className="text-amber-300 font-bold">
                  {self.tricksWonThisHand} / 5
                </strong>
              </span>
            </div>

            <p className="text-[11px] text-slate-400">
              {gameState.turnStep === 'PLAYING_TRICK' && isMyTurn
                ? '👉 Click a highlighted card in your hand to play it to the trick!'
                : 'Must follow effective lead suit if able (Left Bower counts as Trump suit).'}
            </p>
          </div>

          <HandView
            cards={self.handZone.cards}
            cardCount={self.handZone.cardCount}
            highlightedCardIds={legalCardIds}
            size="lg"
            fanAngleDeg={6}
            {...(gameState.turnStep === 'PLAYING_TRICK' && isMyTurn
              ? {
                  onPlayCard: (card) =>
                    sendAction({ type: 'EUCHRE_PLAY_CARD', cardId: card.id }),
                }
              : {})}
          />
        </div>
      </div>
    </div>
  );
};

