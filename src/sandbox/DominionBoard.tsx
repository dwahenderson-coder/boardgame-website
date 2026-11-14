import React, { useState } from 'react';
import {
  BASIC_TREASURE_CARD_IDS,
  BASIC_VICTORY_CARD_IDS,
  Card,
  DominionAction,
  DOMINION_CARDS,
  SanitizedDominionState,
} from '../games/dominion/index.js';

export interface DominionBoardProps {
  readonly gameState: SanitizedDominionState;
  readonly playerId: string;
  readonly playerNames: Readonly<Record<string, string>>;
  readonly sendAction: (action: DominionAction) => void;
}

function getCardBadgeStyle(card: Card): string {
  if (card.types.includes('DURATION')) {
    return 'bg-orange-950/90 border-orange-400/90 text-orange-100';
  }
  if (card.types.includes('ATTACK')) {
    return 'bg-rose-950/90 border-rose-500/80 text-rose-100';
  }
  if (card.types.includes('REACTION')) {
    return 'bg-sky-950/90 border-sky-400/80 text-sky-100';
  }
  if (card.types.includes('ACTION')) {
    return 'bg-slate-900 border-slate-500/80 text-slate-100';
  }
  if (card.types.includes('TREASURE')) {
    return 'bg-amber-950/90 border-amber-400/80 text-amber-100';
  }
  if (card.types.includes('VICTORY')) {
    return 'bg-emerald-950/90 border-emerald-400/80 text-emerald-100';
  }
  return 'bg-purple-950/90 border-purple-500/80 text-purple-200';
}

/**
 * Embargo Coin — Silver Oval Coin with "Embargo" on it.
 */
const EmbargoCoinVisual: React.FC<{ readonly count: number }> = ({ count }) => {
  if (count <= 0) return null;
  return (
    <span
      title={`${count} Embargo Token(s): Buying from this pile grants ${count} Curse(s).`}
      className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-gradient-to-b from-slate-100 via-slate-300 to-slate-400 border-2 border-slate-200 text-slate-950 font-black text-[9px] uppercase tracking-wider shadow-md"
    >
      <span>Embargo</span>
      {count > 1 && <span>×{count}</span>}
    </span>
  );
};

/**
 * Gold Coin — Gold Coin marker added to cards and/or mats (such as Pirate Ship Mat).
 */
const GoldCoinVisual: React.FC<{ readonly index?: number }> = () => (
  <span
    title="Gold Coin Marker (+1 Coin when choosing Coins on Pirate Ship)"
    className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-gradient-to-br from-yellow-200 via-amber-400 to-amber-600 border-2 border-yellow-100 text-amber-950 font-black text-[9px] shadow-md select-none"
  >
    🪙
  </span>
);

export const DominionBoard: React.FC<DominionBoardProps> = ({
  gameState,
  playerId: _playerId,
  playerNames,
  sendAction,
}) => {
  const [selectedHandIndices, setSelectedHandIndices] = useState<number[]>([]);

  const formatName = (id: string): string =>
    playerNames[id] ? `${playerNames[id]} (${id})` : id;

  const self = gameState.self;
  const pending = gameState.pendingInteraction;
  const isMyTurn =
    !gameState.isGameOver &&
    pending === null &&
    gameState.activePlayerId === self.id;
  const isMyPendingInteraction =
    !gameState.isGameOver &&
    pending !== null &&
    pending.playerId === self.id;

  const toggleHandIndex = (idx: number) => {
    setSelectedHandIndices((prev) =>
      prev.includes(idx) ? prev.filter((i) => i !== idx) : [...prev, idx]
    );
  };

  const selectedHandCardIds = selectedHandIndices
    .map((idx) => self.hand[idx]?.id)
    .filter((id): id is string => Boolean(id));

  const handleSupplyCardClick = (cardId: string) => {
    const cardDef = DOMINION_CARDS[cardId];
    if (!cardDef) return;

    if (isMyPendingInteraction && pending) {
      if (
        pending.promptType === 'GAIN_COSTING_UP_TO' ||
        pending.promptType === 'EMBARGO_PILE'
      ) {
        setSelectedHandIndices([]);
        sendAction({
          type: 'RESOLVE_INTERACTION',
          gainedCardId: cardId,
        });
        return;
      }
      if (
        pending.promptType === 'TRASH_AND_UPGRADE' &&
        selectedHandCardIds.length === 1
      ) {
        const trashedId = selectedHandCardIds[0]!;
        setSelectedHandIndices([]);
        sendAction({
          type: 'RESOLVE_INTERACTION',
          trashedCardId: trashedId,
          gainedCardId: cardId,
        });
        return;
      }
    }

    if (isMyTurn && self.buys > 0 && self.coins >= cardDef.cost) {
      sendAction({
        type: 'BUY_CARD',
        cardId,
      });
    }
  };

  const handleHandCardClick = (card: Card, index: number) => {
    if (isMyPendingInteraction && pending) {
      if (
        pending.promptType === 'DISCARD_FOR_DRAW' ||
        pending.promptType === 'DISCARD_EXACT_COUNT' ||
        pending.promptType === 'PUT_CARD_ONTO_DECK' ||
        pending.promptType === 'ISLAND_SET_ASIDE' ||
        pending.promptType === 'HAVEN_SET_ASIDE' ||
        pending.promptType === 'SALVAGER_TRASH' ||
        pending.promptType === 'AMBASSADOR_RETURN' ||
        pending.promptType === 'TRASH_UP_TO_N' ||
        pending.promptType === 'ATTACK_DEFENSE_OR_DISCARD'
      ) {
        toggleHandIndex(index);
        return;
      }
      if (pending.promptType === 'TRASH_AND_UPGRADE') {
        setSelectedHandIndices([index]);
        return;
      }
    }

    if (!isMyTurn) return;

    if (
      gameState.turnPhase === 'ACTION' &&
      card.types.includes('ACTION') &&
      self.actions > 0
    ) {
      sendAction({
        type: 'PLAY_ACTION_CARD',
        cardId: card.id,
      });
      return;
    }

    if (
      (gameState.turnPhase === 'ACTION' ||
        gameState.turnPhase === 'BUY_TREASURES') &&
      card.types.includes('TREASURE')
    ) {
      sendAction({
        type: 'PLAY_TREASURE',
        cardId: card.id,
      });
    }
  };

  return (
    <div className="w-full h-full flex flex-col bg-slate-950 text-slate-100 overflow-y-auto select-none p-4 gap-3">
      {/* Top Bar: Turn Phase, Active Player Counters & Opponent Summaries */}
      <div className="w-full max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-3 bg-slate-900/95 border border-amber-500/40 rounded-2xl px-4 py-3 shadow-lg">
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="px-2.5 py-1 rounded-lg bg-amber-500/20 border border-amber-400/50 text-amber-300 text-xs font-black uppercase tracking-wider">
            🏰 Dominion • Turn #{gameState.turnNumber}
          </span>
          <span className="px-2.5 py-1 rounded-lg bg-cyan-500/20 border border-cyan-400/50 text-cyan-200 text-xs font-bold">
            Phase: {gameState.turnPhase}
          </span>
          <span className="px-2.5 py-1 rounded-lg bg-slate-800 border border-slate-700 text-xs font-bold text-slate-200">
            ⚡ Actions: <strong className="text-amber-300">{self.actions}</strong>
          </span>
          <span className="px-2.5 py-1 rounded-lg bg-slate-800 border border-slate-700 text-xs font-bold text-slate-200">
            🛒 Buys: <strong className="text-emerald-300">{self.buys}</strong>
          </span>
          <span className="px-2.5 py-1 rounded-lg bg-slate-800 border border-slate-700 text-xs font-bold text-slate-200">
            🪙 Coins: <strong className="text-yellow-300">${self.coins}</strong>
          </span>
          <span className="px-2.5 py-1 rounded-lg bg-emerald-500/20 border border-emerald-400/50 text-emerald-300 text-xs font-black">
            🏆 Your VP: {self.totalVictoryPoints}
          </span>
        </div>

        {/* Opponents Summary Bar */}
        <div className="flex flex-wrap items-center gap-2">
          {Object.values(gameState.opponents).map((opp) => (
            <div
              key={opp.id}
              className={`px-3 py-1 rounded-xl border text-[11px] flex items-center gap-2 ${
                gameState.activePlayerId === opp.id
                  ? 'bg-amber-950/60 border-amber-400 text-amber-200'
                  : 'bg-slate-950 border-slate-800 text-slate-300'
              }`}
            >
              <span className="font-bold">{formatName(opp.id)}</span>
              <span>✋ {opp.handCount}</span>
              <span>📚 {opp.deckCount}</span>
              <span>♻️ {opp.discardCount}</span>
              <span className="text-emerald-300 font-bold">
                {opp.totalVictoryPoints} VP
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Pending Interaction Banner */}
      {pending && (
        <div className="w-full max-w-6xl mx-auto p-3.5 rounded-2xl bg-purple-950/90 border-2 border-purple-400 shadow-xl flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-0.5">
            <div className="text-xs font-black uppercase tracking-wider text-purple-200">
              {!isMyPendingInteraction &&
              pending.promptType === 'ATTACK_DEFENSE_OR_DISCARD' ? (
                1 + (pending.remainingTargetQueue?.length ?? 0) > 1 ? (
                  '⚔️ Militia Played — Waiting for other players to discard.'
                ) : (
                  `⚔️ Militia Played — Waiting for "${
                    playerNames[pending.playerId] ?? pending.playerId
                  }" to discard.`
                )
              ) : (
                <>
                  ⚡ Interactive Resolution Required ({pending.sourceCard.name}) —
                  Target: {formatName(pending.playerId)}
                </>
              )}
            </div>
            <div className="text-xs text-slate-200">
              {!isMyPendingInteraction &&
              pending.promptType === 'ATTACK_DEFENSE_OR_DISCARD' ? (
                1 + (pending.remainingTargetQueue?.length ?? 0) > 1 ? (
                  'Waiting for other players to discard.'
                ) : (
                  `Waiting for "${
                    playerNames[pending.playerId] ?? pending.playerId
                  }" to discard.`
                )
              ) : (
                <>
                  {pending.promptType === 'DISCARD_FOR_DRAW' &&
                    'Select any number of cards from your hand to discard, then click Confirm to draw that many.'}
                  {pending.promptType === 'DISCARD_EXACT_COUNT' &&
                    `Select ${pending.minCount} card(s) from your hand to discard, then click Confirm.`}
                  {pending.promptType === 'PUT_CARD_ONTO_DECK' &&
                    `Select ${pending.minCount} card(s) from your hand to put onto your deck, then click Confirm.`}
                  {pending.promptType === 'TRASH_UP_TO_N' &&
                    `Select up to ${pending.maxCount} cards from your hand to trash, then click Confirm.`}
                  {pending.promptType === 'ATTACK_DEFENSE_OR_DISCARD' &&
                    `Select ${pending.minCount} card(s) from your hand to discard down to 3 (or reveal Moat if held).`}
                  {pending.promptType === 'GAIN_COSTING_UP_TO' &&
                    `Click a card in the Supply costing up to $${pending.maxCost ?? 4} to gain it.`}
                  {pending.promptType === 'EMBARGO_PILE' &&
                    'Click any Supply pile to place a silver Embargo Coin on it.'}
                  {pending.promptType === 'ISLAND_SET_ASIDE' &&
                    'Select 1 card from your hand to place onto your Island Mat (counted for endgame scoring).'}
                  {pending.promptType === 'HAVEN_SET_ASIDE' &&
                    'Select 1 card from your hand to set aside face down under Haven until the start of your next turn.'}
                  {pending.promptType === 'SALVAGER_TRASH' &&
                    'Select 1 card from your hand to trash for +$1 Coin per $1 it costs.'}
                  {pending.promptType === 'AMBASSADOR_RETURN' &&
                    'Select 1 or 2 copies of a card from your hand to return to the Supply (each opponent gains a copy).'}
                  {pending.promptType === 'NATIVE_VILLAGE_CHOICE' &&
                    'Choose whether to put the top card of your deck face down onto your Native Village Mat, or put all cards from your mat into your hand.'}
                  {pending.promptType === 'PIRATE_SHIP_CHOICE' &&
                    `Choose whether to take +$${
                      self.pirateShipTokens ?? 0
                    } Coins from your Pirate Ship Mat, or attack opponents' decks for a Gold Coin token.`}
                  {pending.promptType === 'TRASH_AND_UPGRADE' &&
                    `Step 1: Click 1 ${pending.restrictedCardKind ?? ''} card in your hand to trash, then click a Supply card costing up to +$${pending.upgradeMaxCostDelta ?? 2} more!`}
                </>
              )}
            </div>
          </div>

          {isMyPendingInteraction && (
            <div className="flex flex-wrap items-center gap-2">
              {pending.promptType === 'ATTACK_DEFENSE_OR_DISCARD' &&
                self.hand.some((c) => c.id === 'moat') && (
                  <button
                    onClick={() => {
                      setSelectedHandIndices([]);
                      sendAction({
                        type: 'RESOLVE_INTERACTION',
                        revealMoat: true,
                      });
                    }}
                    className="px-3.5 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-black text-xs shadow cursor-pointer"
                  >
                    🛡️ Reveal Moat (Ignore Attack)
                  </button>
                )}

              {pending.promptType === 'NATIVE_VILLAGE_CHOICE' && (
                <>
                  <button
                    type="button"
                    onClick={() =>
                      sendAction({
                        type: 'RESOLVE_INTERACTION',
                        choice: 'MAT_PUT',
                      })
                    }
                    className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs shadow cursor-pointer"
                  >
                    🛖 Set Aside Top Card onto Mat
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      sendAction({
                        type: 'RESOLVE_INTERACTION',
                        choice: 'MAT_TAKE',
                      })
                    }
                    className="px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs shadow cursor-pointer"
                  >
                    ✋ Take All Mat Cards into Hand (
                    {(self.nativeVillageMat ?? []).length})
                  </button>
                </>
              )}

              {pending.promptType === 'PIRATE_SHIP_CHOICE' && (
                <>
                  <button
                    type="button"
                    onClick={() =>
                      sendAction({
                        type: 'RESOLVE_INTERACTION',
                        choice: 'PIRATE_ATTACK',
                      })
                    }
                    className="px-3.5 py-2 rounded-xl bg-rose-500 hover:bg-rose-400 text-slate-950 font-black text-xs shadow cursor-pointer"
                  >
                    ⛵ Attack Opponents (+1 Gold Coin if Treasure Trashed)
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      sendAction({
                        type: 'RESOLVE_INTERACTION',
                        choice: 'PIRATE_COINS',
                      })
                    }
                    className="px-3.5 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs shadow cursor-pointer"
                  >
                    🪙 Take +${self.pirateShipTokens ?? 0} Coins from Mat
                  </button>
                </>
              )}

              {(pending.promptType === 'DISCARD_FOR_DRAW' ||
                pending.promptType === 'DISCARD_EXACT_COUNT' ||
                pending.promptType === 'PUT_CARD_ONTO_DECK' ||
                pending.promptType === 'ISLAND_SET_ASIDE' ||
                pending.promptType === 'HAVEN_SET_ASIDE' ||
                pending.promptType === 'SALVAGER_TRASH' ||
                pending.promptType === 'AMBASSADOR_RETURN' ||
                pending.promptType === 'TRASH_UP_TO_N' ||
                pending.promptType === 'ATTACK_DEFENSE_OR_DISCARD') && (
                <button
                  disabled={
                    selectedHandCardIds.length < pending.minCount ||
                    selectedHandCardIds.length > pending.maxCount
                  }
                  onClick={() => {
                    const chosen = [...selectedHandCardIds];
                    setSelectedHandIndices([]);
                    sendAction({
                      type: 'RESOLVE_INTERACTION',
                      selectedCardIds: chosen,
                    });
                  }}
                  className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-slate-950 font-black text-xs shadow cursor-pointer"
                >
                  ✓ Confirm Selection ({selectedHandCardIds.length})
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Supply Grid: Basic Treasures, Victory/Curse & 10 Kingdom Piles */}
      <div className="w-full max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-3">
        {/* Basic Treasures & Victory Piles */}
        <div className="p-3 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-2">
          <div className="text-[11px] font-black uppercase tracking-wider text-amber-300">
            🪙 Basic Treasures & 🏆 Victory Supply
          </div>
          <div className="grid grid-cols-2 gap-2">
            {[
              ...BASIC_TREASURE_CARD_IDS,
              ...BASIC_VICTORY_CARD_IDS,
              'curse',
            ].map((cid) => {
              const card = DOMINION_CARDS[cid]!;
              const count = gameState.supply[cid] ?? 0;
              const canBuy =
                isMyTurn && count > 0 && self.buys > 0 && self.coins >= card.cost;
              return (
                <button
                  key={cid}
                  type="button"
                  disabled={count <= 0}
                  onClick={() => handleSupplyCardClick(cid)}
                  className={`p-2 rounded-xl border text-left transition flex flex-col justify-between ${getCardBadgeStyle(
                    card
                  )} ${
                    canBuy
                      ? 'hover:ring-2 hover:ring-amber-400 cursor-pointer'
                      : 'opacity-85'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="font-black text-xs truncate">
                      {card.name}
                    </span>
                    <span className="px-1.5 py-0.2 rounded-full bg-amber-400 text-slate-950 font-black text-[10px]">
                      ${card.cost}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[10px] mt-1">
                    <span className="opacity-80">{card.description}</span>
                    <span className="font-mono font-bold">×{count}</span>
                  </div>
                  {(gameState.embargoTokens?.[cid] ?? 0) > 0 && (
                    <div className="mt-1">
                      <EmbargoCoinVisual
                        count={gameState.embargoTokens?.[cid] ?? 0}
                      />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* 10 Kingdom Supply Piles */}
        <div className="lg:col-span-2 p-3 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black uppercase tracking-wider text-purple-300">
              ⚔️ 10 Kingdom Supply Piles
            </span>
            <span className="text-[10px] text-slate-400">
              Trash Pile: {gameState.trash.length} card(s)
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            {gameState.kingdomCards.map((cid) => {
              const card = DOMINION_CARDS[cid]!;
              const count = gameState.supply[cid] ?? 0;
              const canBuy =
                isMyTurn && count > 0 && self.buys > 0 && self.coins >= card.cost;
              return (
                <button
                  key={cid}
                  type="button"
                  disabled={count <= 0}
                  onClick={() => handleSupplyCardClick(cid)}
                  title={card.description}
                  className={`p-2.5 rounded-xl border text-left transition flex flex-col justify-between min-h-[88px] ${getCardBadgeStyle(
                    card
                  )} ${
                    canBuy
                      ? 'hover:ring-2 hover:ring-amber-400 cursor-pointer'
                      : 'opacity-85'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-black text-xs truncate">
                        {card.name}
                      </span>
                      <span className="px-1.5 py-0.2 rounded-full bg-amber-400 text-slate-950 font-black text-[10px]">
                        ${card.cost}
                      </span>
                    </div>
                    <p className="text-[9px] leading-snug opacity-85 mt-1 line-clamp-3">
                      {card.description}
                    </p>
                  </div>
                  {(gameState.embargoTokens?.[cid] ?? 0) > 0 && (
                    <div className="mt-1">
                      <EmbargoCoinVisual
                        count={gameState.embargoTokens?.[cid] ?? 0}
                      />
                    </div>
                  )}
                  <div className="flex items-center justify-between text-[9px] font-mono pt-1 mt-1 border-t border-white/10">
                    <span>{card.types.join('/')}</span>
                    <span className="font-bold">×{count}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Seaside Player Mats (Island Mat, Native Village Mat, Pirate Ship Mat) */}
      {(gameState.kingdomCards.includes('island') ||
        gameState.kingdomCards.includes('native_village') ||
        gameState.kingdomCards.includes('pirate_ship') ||
        (self.islandMat?.length ?? 0) > 0 ||
        (self.nativeVillageMat?.length ?? 0) > 0 ||
        (self.pirateShipTokens ?? 0) > 0) && (
        <div className="w-full max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Island Mat */}
          {(gameState.kingdomCards.includes('island') ||
            (self.islandMat?.length ?? 0) > 0) && (
            <div className="relative overflow-hidden p-4 rounded-2xl border-2 border-amber-400/70 bg-gradient-to-br from-sky-900/90 via-cyan-800/80 to-amber-700/85 shadow-lg">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-xs font-black uppercase tracking-wider text-amber-200 flex items-center gap-1.5">
                    <span className="text-lg">🌴🏖️</span> Island Mat
                  </div>
                  <p className="text-[10px] text-amber-100/90 mt-0.5">
                    Palm tree &amp; beach mat — cards here are counted for endgame scoring.
                  </p>
                </div>
                <span className="px-2 py-0.5 rounded-full bg-amber-950/80 border border-amber-300/60 text-amber-200 font-black text-[10px]">
                  {self.islandMat?.length ?? 0} Card(s)
                </span>
              </div>
              <div className="mt-2.5 flex flex-wrap gap-1.5 min-h-[28px] items-center">
                {(self.islandMat ?? []).length === 0 ? (
                  <span className="text-[10px] italic text-amber-100/75">
                    No cards set aside on Island Mat yet.
                  </span>
                ) : (
                  (self.islandMat ?? []).map((card, i) => (
                    <span
                      key={`island_${card.id}_${i}`}
                      className={`px-2 py-0.5 rounded-md border text-[10px] font-bold ${getCardBadgeStyle(
                        card
                      )}`}
                    >
                      {card.name}
                    </span>
                  ))
                )}
              </div>
            </div>
          )}

          {/* Native Village Mat */}
          {(gameState.kingdomCards.includes('native_village') ||
            (self.nativeVillageMat?.length ?? 0) > 0) && (
            <div className="relative overflow-hidden p-4 rounded-2xl border-2 border-emerald-400/70 bg-gradient-to-br from-emerald-950/90 via-teal-900/85 to-cyan-900/85 shadow-lg">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-xs font-black uppercase tracking-wider text-emerald-200 flex items-center gap-1.5">
                    <span className="text-lg">🛖🌊</span> Native Village Mat
                  </div>
                  <p className="text-[10px] text-emerald-100/90 mt-0.5">
                    Grass huts &amp; water mat — cards here are counted for endgame scoring.
                  </p>
                </div>
                <span className="px-2 py-0.5 rounded-full bg-emerald-950/80 border border-emerald-300/60 text-emerald-200 font-black text-[10px]">
                  {self.nativeVillageMat?.length ?? 0} Card(s)
                </span>
              </div>
              <div className="mt-2.5 flex flex-wrap gap-1.5 min-h-[28px] items-center">
                {(self.nativeVillageMat ?? []).length === 0 ? (
                  <span className="text-[10px] italic text-emerald-100/75">
                    No cards on your Native Village Mat.
                  </span>
                ) : (
                  (self.nativeVillageMat ?? []).map((card, i) => (
                    <span
                      key={`nv_${card.id}_${i}`}
                      className={`px-2 py-0.5 rounded-md border text-[10px] font-bold ${getCardBadgeStyle(
                        card
                      )}`}
                    >
                      {card.name}
                    </span>
                  ))
                )}
              </div>
            </div>
          )}

          {/* Pirate Ship Mat */}
          {(gameState.kingdomCards.includes('pirate_ship') ||
            (self.pirateShipTokens ?? 0) > 0) && (
            <div className="relative overflow-hidden p-4 rounded-2xl border-2 border-rose-500/75 bg-gradient-to-br from-slate-950 via-red-950/85 to-amber-950/80 shadow-lg">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-xs font-black uppercase tracking-wider text-rose-200 flex items-center gap-1.5">
                    <span className="inline-flex items-center justify-center w-6 h-6 rounded-lg bg-red-700/80 border border-red-400 text-white text-xs shadow">
                      ⛵
                    </span>
                    Pirate Ship Mat (Red Sails)
                  </div>
                  <p className="text-[10px] text-rose-100/90 mt-0.5">
                    Gold Coins are added if treasure is trashed by opponents.
                  </p>
                </div>
                <span className="px-2 py-0.5 rounded-full bg-amber-950/90 border border-amber-400/70 text-amber-200 font-black text-[10px]">
                  {self.pirateShipTokens ?? 0} Gold Coin(s)
                </span>
              </div>
              <div className="mt-2.5 flex flex-wrap gap-1.5 min-h-[28px] items-center">
                {(self.pirateShipTokens ?? 0) === 0 ? (
                  <span className="text-[10px] italic text-rose-100/75">
                    No Gold Coins on Pirate Ship Mat yet.
                  </span>
                ) : (
                  Array.from({ length: self.pirateShipTokens ?? 0 }).map(
                    (_, idx) => <GoldCoinVisual key={`ps_coin_${idx}`} />
                  )
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Play Area & Turn Controls */}
      <div className="w-full max-w-6xl mx-auto p-3.5 rounded-2xl bg-slate-900/90 border border-slate-800 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-black uppercase tracking-wider text-slate-400">
            In Play ({self.inPlay.length}):
          </span>
          {self.inPlay.length === 0 ? (
            <span className="text-xs text-slate-500 italic">
              No cards played yet this turn.
            </span>
          ) : (
            self.inPlay.map((card, i) => (
              <span
                key={`${card.id}_${i}`}
                className={`px-2.5 py-1 rounded-lg border text-xs font-bold inline-flex items-center gap-1 ${getCardBadgeStyle(
                  card
                )}`}
              >
                {card.types.includes('DURATION') && (
                  <span title="Duration Card (Remains in play until 2nd phase completes)">
                    ⏳
                  </span>
                )}
                {card.name}
              </span>
            ))
          )}
        </div>

        {isMyTurn && (
          <div className="flex flex-wrap items-center gap-2">
            {(gameState.turnPhase === 'ACTION' ||
              gameState.turnPhase === 'BUY_TREASURES') &&
              self.hand.some((c) => c.types.includes('TREASURE')) && (
                <button
                  type="button"
                  onClick={() => sendAction({ type: 'PLAY_ALL_TREASURES' })}
                  className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs shadow cursor-pointer"
                >
                  🪙 Play All Treasures
                </button>
              )}

            {gameState.turnPhase === 'ACTION' && (
              <button
                type="button"
                onClick={() => sendAction({ type: 'END_ACTION_PHASE' })}
                className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold text-xs cursor-pointer"
              >
                Skip to Buy Phase →
              </button>
            )}

            <button
              type="button"
              onClick={() => sendAction({ type: 'CLEANUP' })}
              className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs shadow cursor-pointer"
            >
              ✓ End Turn & Cleanup
            </button>
          </div>
        )}
      </div>

      {/* Player Hand & Deck/Discard Zones */}
      <div className="w-full max-w-6xl mx-auto p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <span className="font-black uppercase tracking-wider text-amber-300">
            ✋ Your Hand ({self.hand.length} cards)
          </span>
          <div className="flex items-center gap-3 text-slate-300 font-semibold">
            <span>📚 Draw Deck: {self.deckCount}</span>
            <span>
              ♻️ Discard Pile: {self.discardCount}
              {self.discardTopCard ? ` (Top: ${self.discardTopCard.name})` : ''}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
          {self.hand.map((card, idx) => {
            const isSelected = selectedHandIndices.includes(idx);
            return (
              <button
                key={`${card.id}_hand_${idx}`}
                type="button"
                onClick={() => handleHandCardClick(card, idx)}
                className={`p-3 rounded-xl border text-left transition flex flex-col justify-between min-h-[100px] ${getCardBadgeStyle(
                  card
                )} ${
                  isSelected
                    ? 'ring-2 ring-amber-400 scale-[1.02] shadow-lg'
                    : 'hover:border-amber-400/70'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-1">
                    <span className="font-black text-xs">{card.name}</span>
                    <span className="px-1.5 py-0.2 rounded-full bg-amber-400 text-slate-950 font-black text-[10px]">
                      ${card.cost}
                    </span>
                  </div>
                  <p className="text-[10px] leading-snug opacity-90 mt-1.5">
                    {card.description}
                  </p>
                </div>
                <div className="text-[9px] font-mono uppercase opacity-75 pt-1.5 mt-1.5 border-t border-white/10">
                  {card.types.join(' • ')}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
