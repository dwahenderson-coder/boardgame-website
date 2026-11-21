import React, { useEffect, useState } from 'react';
import {
  ALL_DIE_FACES,
  calculatePlayerVPBreakdown,
  DiceTownAction,
  DiceTownLocation,
  DiceTownSanitizedState,
  DieFace,
} from '../games/dice-town/index.js';

export interface DiceTownBoardProps {
  readonly gameState: DiceTownSanitizedState;
  readonly playerId: string;
  readonly playerNames: Readonly<Record<string, string>>;
  readonly isLocalSandbox?: boolean;
  readonly sendAction: (
    action: DiceTownAction,
    actorOverrideId?: string
  ) => void;
}

const LOCATION_META: Readonly<
  Record<
    DiceTownLocation,
    {
      readonly numberLabel: string;
      readonly title: string;
      readonly subtitle: string;
      readonly icon: string;
      readonly dieBadge: string;
      readonly ruleText: string;
      readonly accentClass: string;
    }
  >
> = {
  GOLD_MINE: {
    numberLabel: '#1',
    title: 'Gold Mine',
    subtitle: 'Most 9s Rolled',
    icon: '⛏️',
    dieBadge: '9',
    ruleText: 'Take 1 Gold Nugget (1 VP) from the mine for each [9] you rolled.',
    accentClass: 'border-amber-500/60 bg-amber-950/35',
  },
  BANK: {
    numberLabel: '#2',
    title: 'Town Bank',
    subtitle: 'Most 10s Rolled',
    icon: '🏦',
    dieBadge: '10',
    ruleText: 'Rob the Bank and take all Dollar bills currently in the Vault.',
    accentClass: 'border-emerald-500/60 bg-emerald-950/35',
  },
  GENERAL_STORE: {
    numberLabel: '#3',
    title: 'General Store',
    subtitle: 'Most Jacks (J)',
    icon: '🛒',
    dieBadge: 'J',
    ruleText: 'Draw 1 card per [J] rolled, keep 1 card into hand, discard the rest.',
    accentClass: 'border-cyan-500/60 bg-cyan-950/35',
  },
  SALOON: {
    numberLabel: '#4',
    title: 'Golden Saloon',
    subtitle: 'Most Queens (Q)',
    icon: '💃',
    dieBadge: 'Q',
    ruleText:
      'Target 1 opponent and choose to steal 1 Property Deed OR view 1 random General Store card per [Q] and steal 1.',
    accentClass: 'border-rose-500/60 bg-rose-950/35',
  },
  SHERIFF_OFFICE: {
    numberLabel: '#5',
    title: "Sheriff's Office",
    subtitle: 'Most Kings (K)',
    icon: '⭐',
    dieBadge: 'K',
    ruleText:
      'Claim the Sheriff Star! Breaks all town ties and is worth +5 VP at game end.',
    accentClass: 'border-yellow-400/70 bg-yellow-950/35',
  },
  TOWN_HALL: {
    numberLabel: '#6',
    title: 'Town Hall',
    subtitle: 'Best 5-Die Poker Hand',
    icon: '🏛️',
    dieBadge: 'A / Poker',
    ruleText:
      'Claim the highlighted bottom face-up Property Deed + 1 extra face-up Deed per [A] (up to 3).',
    accentClass: 'border-purple-500/60 bg-purple-950/35',
  },
  DOC_BADLUCK: {
    numberLabel: '#7',
    title: 'Doc Badluck',
    subtitle: 'Won 0 Locations This Round',
    icon: '🧪',
    dieBadge: '0 Wins',
    ruleText:
      'Any player who won ZERO locations chooses between the 2 face-up Doc Badluck cards or drawing 1 from the deck.',
    accentClass: 'border-teal-500/60 bg-teal-950/35',
  },
};

const DIE_FACE_COLORS: Readonly<Record<DieFace, string>> = {
  '9': 'text-amber-300 border-amber-400/80 bg-amber-950/80',
  '10': 'text-emerald-300 border-emerald-400/80 bg-emerald-950/80',
  J: 'text-cyan-300 border-cyan-400/80 bg-cyan-950/80',
  Q: 'text-rose-300 border-rose-400/80 bg-rose-950/80',
  K: 'text-yellow-300 border-yellow-400/80 bg-yellow-950/80',
  A: 'text-purple-300 border-purple-400/80 bg-purple-950/80',
};

export const DiceTownBoard: React.FC<DiceTownBoardProps> = ({
  gameState,
  playerNames,
  isLocalSandbox = false,
  sendAction,
}) => {
  const [selectedDieIndices, setSelectedDieIndices] = useState<number[]>([]);
  const [useBruteCardId, setUseBruteCardId] = useState<string | null>(null);
  const [useCheaterCardId, setUseCheaterCardId] = useState<string | null>(null);
  const [cheaterDieIdx, setCheaterDieIdx] = useState<number | null>(null);
  const [cheaterFace, setCheaterFace] = useState<DieFace>('A');
  const [targetOpponentId, setTargetOpponentId] = useState<string>('');

  const self = gameState.self;
  const inCupDice = gameState.underTheCup.inCupDice;

  // Reset local selection when roll or round changes
  useEffect(() => {
    if (inCupDice.length > 0 && !self.hasSubmittedSelection) {
      if (gameState.finalRollTriggered) {
        setSelectedDieIndices(inCupDice.map((d) => d.index));
      } else {
        setSelectedDieIndices([inCupDice[0]!.index]);
      }
      setCheaterDieIdx(inCupDice[0]!.index);
    } else {
      setSelectedDieIndices([]);
      setCheaterDieIdx(null);
    }
    setUseBruteCardId(null);
    setUseCheaterCardId(null);
  }, [
    gameState.roundNumber,
    gameState.turnNumber,
    gameState.phase,
    gameState.finalRollTriggered,
    self.id,
    self.hasSubmittedSelection,
    inCupDice.length,
  ]);

  const formatName = (id: string): string =>
    playerNames[id] ? `${playerNames[id]} (${id})` : id;

  const toggleDieIndex = (dieIdx: number) => {
    if (gameState.finalRollTriggered) return;
    setSelectedDieIndices((prev) => {
      if (prev.includes(dieIdx)) {
        return prev.filter((i) => i !== dieIdx);
      }
      return [...prev, dieIdx];
    });
    if (cheaterDieIdx === null) {
      setCheaterDieIdx(dieIdx);
    }
  };

  const effectiveExtraFee = gameState.finalRollTriggered
    ? 0
    : useBruteCardId
      ? 0
      : selectedDieIndices.length === 0
        ? 1
        : Math.max(0, selectedDieIndices.length - 1);
  const canAffordSelection = gameState.finalRollTriggered
    ? true
    : self.dollars >= effectiveExtraFee;

  const bruteCardInHand = self.handCards.find(
    (c) => c.effectType === 'FREE_KEEP_EXTRA_DICE'
  );
  const cheaterCardInHand = self.handCards.find(
    (c) => c.effectType === 'SET_DIE_FACE'
  );

  const otherPlayerIds = gameState.playerOrder.filter((id) => id !== self.id);
  const effectiveTargetOpp = targetOpponentId || otherPlayerIds[0] || '';

  const selfVP = calculatePlayerVPBreakdown(self);

  return (
    <div className="w-full h-full flex flex-col bg-stone-950 text-stone-100 overflow-y-auto select-none p-4 lg:p-6 gap-4 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-amber-950/40 via-stone-950 to-stone-950">
      {/* =====================================================================
          1. TOP WESTERN HEADER & PRIMARY PHASE ACTION BAR
         ===================================================================== */}
      <div className="w-full max-w-7xl mx-auto bg-stone-900/95 border-2 border-amber-600/50 rounded-2xl p-4 shadow-xl flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="px-3 py-1 rounded-xl bg-amber-500/20 border border-amber-400/60 text-amber-300 text-xs font-black uppercase tracking-wider">
              🤠 Dice Town • Round #{gameState.roundNumber}
            </span>
            <span className="px-3 py-1 rounded-xl bg-stone-950 border border-stone-700 text-xs font-bold text-stone-200">
              Phase:{' '}
              <strong className="text-amber-300">
                {gameState.phase.replace(/_/g, ' ')}
              </strong>
              {gameState.currentLocation
                ? ` → ${LOCATION_META[gameState.currentLocation].title}`
                : ''}
            </span>
            <span className="px-3 py-1 rounded-xl bg-yellow-500/20 border border-yellow-400/60 text-yellow-300 text-xs font-black">
              ⭐ Sheriff:{' '}
              {gameState.sheriffPlayerId
                ? formatName(gameState.sheriffPlayerId)
                : 'None in Office'}
            </span>
          </div>

          {/* Primary Phase Progression Button */}
          <div className="flex items-center gap-2.5">
            {(gameState.phase === 'ROUND_START' ||
              gameState.phase === 'END_GAME_CHECK') && (
              <button
                type="button"
                onClick={() => sendAction({ type: 'DT_START_ROUND' })}
                className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-black text-xs shadow-lg cursor-pointer transition transform hover:scale-105"
              >
                {gameState.phase === 'ROUND_START'
                  ? `🤠 Start Round ${gameState.roundNumber} (+$1 to Bank Vault)`
                  : `🤠 Start Next Round (Round ${gameState.roundNumber + 1})`}
              </button>
            )}

            {gameState.phase === 'SIMULTANEOUS_ROLL' && (
              <button
                type="button"
                onClick={() => sendAction({ type: 'DT_ROLL_DICE' })}
                className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-stone-950 font-black text-xs shadow-lg cursor-pointer transition transform hover:scale-105"
              >
                🎲 Shake Dice Cups & Roll Remaining Dice!
              </button>
            )}

            {gameState.phase === 'REVEAL_STEP' && (
              <button
                type="button"
                onClick={() => sendAction({ type: 'DT_REVEAL_DICE' })}
                className="px-5 py-2.5 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-stone-950 font-black text-xs shadow-lg cursor-pointer transition transform hover:scale-105"
              >
                🔓 Reveal All Staged Dice & Pay Extra-Die Fees!
              </button>
            )}
          </div>
        </div>

        {/* Last Action Summary Banner */}
        {gameState.lastActionSummary && (
          <div className="px-3.5 py-2 rounded-xl bg-stone-950/90 border border-stone-800 text-xs text-amber-100 font-medium">
            📜 {gameState.lastActionSummary}
          </div>
        )}

        {/* Final Rolling Round Alert Banner */}
        {gameState.finalRollTriggered &&
          (gameState.phase === 'SIMULTANEOUS_ROLL' ||
            gameState.phase === 'SECRET_SELECTION' ||
            gameState.phase === 'REVEAL_STEP') && (
            <div className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500/95 via-orange-500/95 to-amber-500/95 border-2 border-yellow-200 text-stone-950 font-black text-xs shadow-lg flex items-center justify-between gap-2 animate-pulse">
              <span>
                🚨 FINAL ROLLING ROUND! A player locked all 5 dice — each other
                player gets one final roll and keeps all remaining dice ($0 fee)!
              </span>
              <span className="px-2.5 py-0.5 rounded-lg bg-stone-950 text-amber-300 text-[10px] font-black uppercase">
                Final Roll
              </span>
            </div>
          )}

        {/* ===================================================================
            INTERACTIVE RESOLUTION INTERRUPT BANNERS (Sheriff Tie-Breaker, Store Pick, Saloon Steal, Doc Badluck)
           =================================================================== */}
        {gameState.subState === 'SHERIFF_TIEBREAKER' &&
          gameState.sheriffTiebreakerModal && (
            <div className="p-4 rounded-xl bg-yellow-950/80 border-2 border-yellow-400 shadow-lg flex flex-col gap-2.5">
              <div className="flex items-center justify-between">
                <span className="text-sm font-black text-yellow-300 uppercase tracking-wider">
                  ⭐ Sheriff Tie-Breaker Required at{' '}
                  {
                    LOCATION_META[gameState.sheriffTiebreakerModal.location]
                      .title
                  }
                  !
                </span>
                <span className="text-xs font-bold text-yellow-200">
                  Sheriff:{' '}
                  {formatName(gameState.sheriffTiebreakerModal.sheriffPlayerId)}
                </span>
              </div>
              <p className="text-xs text-stone-200">
                Tied Contenders:{' '}
                <strong>
                  {gameState.sheriffTiebreakerModal.tiedPlayerIds
                    .map((id) => formatName(id))
                    .join(' vs. ')}
                </strong>
                . The Sheriff must choose who wins this location:
              </p>
              {(self.id === gameState.sheriffTiebreakerModal.sheriffPlayerId ||
                isLocalSandbox) && (
                <div className="flex flex-wrap items-center gap-2.5 pt-1">
                  {gameState.sheriffTiebreakerModal.tiedPlayerIds.map(
                    (candidateId) => (
                      <button
                        key={candidateId}
                        type="button"
                        onClick={() =>
                          sendAction(
                            {
                              type: 'DT_SHERIFF_BREAK_TIE',
                              chosenWinnerId: candidateId,
                            },
                            gameState.sheriffTiebreakerModal!.sheriffPlayerId
                          )
                        }
                        className="px-4 py-2 rounded-xl bg-yellow-400 hover:bg-yellow-300 text-stone-950 font-black text-xs shadow cursor-pointer"
                      >
                        ⭐ Award{' '}
                        {
                          LOCATION_META[
                            gameState.sheriffTiebreakerModal!.location
                          ].title
                        }{' '}
                        to {formatName(candidateId)}
                      </button>
                    )
                  )}
                </div>
              )}
            </div>
          )}

        {gameState.subState === 'GENERAL_STORE_PICK' && (
          <div className="p-4 rounded-xl bg-cyan-950/80 border-2 border-cyan-400 shadow-lg flex flex-col gap-2.5">
            <span className="text-sm font-black text-cyan-300 uppercase tracking-wider">
              🛒 General Store Draw —{' '}
              {formatName(gameState.activePlayerId)}: Choose 1 Card to Keep!
            </span>
            {gameState.generalStoreChoiceCards ? (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {gameState.generalStoreChoiceCards.map((card) => (
                  <button
                    key={card.id}
                    type="button"
                    onClick={() =>
                      sendAction(
                        {
                          type: 'DT_GENERAL_STORE_PICK_CARD',
                          cardId: card.id,
                        },
                        gameState.activePlayerId
                      )
                    }
                    className="p-3 rounded-xl bg-stone-950 hover:bg-stone-900 border-2 border-cyan-400/70 text-left flex flex-col justify-between gap-1.5 cursor-pointer transition"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-black text-xs text-white">
                        {card.displayName}
                      </span>
                      {card.vp > 0 && (
                        <span className="px-2 py-0.5 rounded bg-amber-400 text-stone-950 text-[10px] font-black">
                          +{card.vp} VP
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-stone-300">
                      {card.description}
                    </p>
                    <span className="text-[10px] font-black text-cyan-300 uppercase">
                      → Click to Keep This Card
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-xs text-cyan-200">
                Waiting for {formatName(gameState.activePlayerId)} to choose 1
                card from the General Store...
              </p>
            )}
          </div>
        )}

        {gameState.subState === 'SALOON_STEAL' && (
          <div className="p-4 rounded-xl bg-rose-950/80 border-2 border-rose-400 shadow-lg flex flex-col gap-2.5">
            <span className="text-sm font-black text-rose-300 uppercase tracking-wider">
              💃 Golden Saloon — {formatName(gameState.activePlayerId)} Steals a
              Property Deed or General Store Card!
            </span>
            {gameState.saloonRevealedCards &&
            gameState.saloonRevealedCards.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {gameState.saloonRevealedCards.map((card) => (
                  <button
                    key={card.id}
                    type="button"
                    onClick={() =>
                      sendAction(
                        {
                          type: 'DT_SALOON_STEAL_CARD',
                          cardId: card.id,
                        },
                        gameState.activePlayerId
                      )
                    }
                    className="p-3 rounded-xl bg-stone-950 hover:bg-stone-900 border-2 border-rose-400/70 text-left flex flex-col justify-between gap-1.5 cursor-pointer"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-black text-xs text-white">
                        {card.displayName}
                      </span>
                      {card.vp > 0 && (
                        <span className="px-2 py-0.5 rounded bg-amber-400 text-stone-950 text-[10px] font-black">
                          +{card.vp} VP
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-stone-300">
                      {card.description}
                    </p>
                    <span className="text-[10px] font-black text-rose-300 uppercase">
                      → Click to Steal This{' '}
                      {card.deck === 'property_deed'
                        ? 'Property Deed'
                        : 'General Store Card'}
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <span className="text-xs text-rose-200">
                  Choose an opponent and whether to steal one of their{' '}
                  <strong>General Store Hand Cards</strong> or{' '}
                  <strong>Property Deeds</strong>:
                </span>
                <div className="flex flex-wrap items-center gap-2">
                  {gameState.playerOrder
                    .filter((pid) => pid !== gameState.activePlayerId)
                    .map((oppId) => {
                      const isOppSelf = oppId === self.id;
                      const oppView = gameState.opponents[oppId];
                      const handCount = isOppSelf
                        ? self.handCards.length
                        : oppView?.handCardCount ?? 0;
                      const unprotectedDeedsCount = isOppSelf
                        ? self.propertyDeeds.filter(
                            (d) => !self.protectedDeedIds.includes(d.id)
                          ).length
                        : (oppView?.propertyDeeds ?? []).filter(
                            (d) =>
                              !(oppView?.protectedDeedIds ?? []).includes(d.id)
                          ).length;

                      return (
                        <React.Fragment key={oppId}>
                          {handCount > 0 && (
                            <button
                              type="button"
                              onClick={() =>
                                sendAction(
                                  {
                                    type: 'DT_SALOON_SELECT_OPPONENT',
                                    targetPlayerId: oppId,
                                    stealTargetType: 'general_store',
                                  },
                                  gameState.activePlayerId
                                )
                              }
                              className="px-3.5 py-1.5 rounded-xl bg-rose-500 hover:bg-rose-400 text-white font-black text-xs cursor-pointer"
                            >
                              🃏 Steal General Store Card from{' '}
                              {formatName(oppId)} ({handCount})
                            </button>
                          )}
                          {unprotectedDeedsCount > 0 && (
                            <button
                              type="button"
                              onClick={() =>
                                sendAction(
                                  {
                                    type: 'DT_SALOON_SELECT_OPPONENT',
                                    targetPlayerId: oppId,
                                    stealTargetType: 'property_deed',
                                  },
                                  gameState.activePlayerId
                                )
                              }
                              className="px-3.5 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-black text-xs cursor-pointer"
                            >
                              📜 Steal Property Deed from {formatName(oppId)} (
                              {unprotectedDeedsCount})
                            </button>
                          )}
                        </React.Fragment>
                      );
                    })}
                </div>
              </div>
            )}
          </div>
        )}

        {gameState.subState === 'DOC_BADLUCK_PICK' &&
          gameState.docBadluckPickPending && (
            <div className="p-4 rounded-xl bg-teal-950/85 border-2 border-teal-400 shadow-lg flex flex-col gap-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <span className="text-sm font-black text-teal-300 uppercase tracking-wider">
                  🧪 Doc Badluck&apos;s Wagon —{' '}
                  {formatName(gameState.docBadluckPickPending.visitorPlayerId)}{' '}
                  Won 0 Locations!
                </span>
                <span className="text-xs font-bold text-teal-200">
                  Select 1 of the 2 Face-Up Cards OR Draw 1 Blind from the Deck (
                  {gameState.town.docBadluckDrawCount} left)
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {gameState.town.faceUpDocBadluck.map((card, idx) => (
                  <button
                    key={card.id}
                    type="button"
                    onClick={() =>
                      sendAction(
                        {
                          type: 'DT_DOC_BADLUCK_PICK_CARD',
                          source: 'FACE_UP',
                          cardId: card.id,
                        },
                        gameState.docBadluckPickPending!.visitorPlayerId
                      )
                    }
                    className="p-3 rounded-xl bg-stone-950 hover:bg-stone-900 border-2 border-teal-400/80 text-left flex flex-col justify-between gap-1.5 cursor-pointer transition"
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-black text-xs text-white">
                        🧪 Face-Up #{idx + 1}: {card.displayName}
                      </span>
                    </div>
                    <p className="text-[11px] text-stone-300">
                      {card.description}
                    </p>
                    <span className="text-[10px] font-black text-teal-300 uppercase">
                      → Take This Face-Up Elixir
                    </span>
                  </button>
                ))}

                {gameState.town.docBadluckDrawCount > 0 && (
                  <button
                    type="button"
                    onClick={() =>
                      sendAction(
                        {
                          type: 'DT_DOC_BADLUCK_PICK_CARD',
                          source: 'DECK',
                        },
                        gameState.docBadluckPickPending!.visitorPlayerId
                      )
                    }
                    className="p-3 rounded-xl bg-teal-900/40 hover:bg-teal-900/70 border-2 border-dashed border-teal-300 text-left flex flex-col justify-between gap-1.5 cursor-pointer transition"
                  >
                    <span className="font-black text-xs text-teal-200">
                      🎴 Draw 1 Blind from Doc Badluck Deck
                    </span>
                    <p className="text-[11px] text-stone-300">
                      Skip the 2 face-up elixirs and draw the top mystery card
                      from the Doc Badluck deck ({gameState.town.docBadluckDrawCount}{' '}
                      remaining).
                    </p>
                    <span className="text-[10px] font-black text-teal-300 uppercase">
                      → Draw Blind Card from Deck
                    </span>
                  </button>
                )}
              </div>
            </div>
          )}

        {gameState.subState === 'DOC_BADLUCK_TARGET' &&
          gameState.docBadluckPending && (
            <div className="p-4 rounded-xl bg-teal-950/80 border-2 border-teal-400 shadow-lg flex flex-col gap-2.5">
              <span className="text-sm font-black text-teal-300 uppercase tracking-wider">
                🧪 Doc Badluck: {gameState.docBadluckPending.card.displayName} (
                {formatName(gameState.docBadluckPending.playerId)})
              </span>
              <p className="text-xs text-stone-200">
                {gameState.docBadluckPending.card.description}
              </p>
              <div className="flex flex-wrap items-center gap-2">
                {gameState.playerOrder
                  .filter((pid) => pid !== gameState.docBadluckPending!.playerId)
                  .map((oppId) => (
                    <button
                      key={oppId}
                      type="button"
                      onClick={() =>
                        sendAction(
                          {
                            type: 'DT_RESOLVE_DOC_BADLUCK_DEMAND',
                            targetPlayerId: oppId,
                          },
                          gameState.docBadluckPending!.playerId
                        )
                      }
                      className="px-4 py-1.5 rounded-xl bg-teal-400 hover:bg-teal-300 text-stone-950 font-black text-xs cursor-pointer"
                    >
                      Demand from {formatName(oppId)}
                    </button>
                  ))}
              </div>
            </div>
          )}
      </div>

      {/* =====================================================================
          2. CENTRAL TOWN BOARD (6 TOWN LOCATIONS + DOC BADLUCK)
         ===================================================================== */}
      <div className="w-full max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
        {(Object.keys(LOCATION_META) as DiceTownLocation[]).map((loc) => {
          const meta = LOCATION_META[loc];
          const leaderInfo = gameState.townBoardLeaders[loc];
          const isCurrentLoc = gameState.currentLocation === loc;

          return (
            <div
              key={loc}
              className={`rounded-2xl border-2 p-3.5 shadow-lg flex flex-col justify-between gap-2.5 transition ${
                meta.accentClass
              } ${
                isCurrentLoc
                  ? 'ring-2 ring-amber-300 scale-[1.01]'
                  : 'opacity-95'
              }`}
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{meta.icon}</span>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-black text-amber-300">
                          {meta.numberLabel}
                        </span>
                        <span className="text-sm font-black text-white">
                          {meta.title}
                        </span>
                      </div>
                      <div className="text-[10px] font-bold text-stone-300">
                        {meta.subtitle}
                      </div>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded-lg bg-stone-950 border border-stone-700 font-mono font-black text-xs text-amber-300">
                    [{meta.dieBadge}]
                  </span>
                </div>

                <p className="text-[11px] text-stone-300 mt-2 leading-snug">
                  {meta.ruleText}
                </p>

                {/* Location-Specific Live Supply / Cards */}
                <div className="mt-2.5 pt-2 border-t border-white/10 text-xs">
                  {loc === 'GOLD_MINE' && (
                    <div className="flex items-center justify-between">
                      <span className="text-stone-300">Mine Supply:</span>
                      <span className="font-mono font-black text-amber-300">
                        🪙 {gameState.town.goldMineNuggets} / 30 Nuggets
                      </span>
                    </div>
                  )}

                  {loc === 'BANK' && (
                    <div className="flex items-center justify-between">
                      <span className="text-stone-300">Vault Cash:</span>
                      <span className="font-mono font-black text-emerald-300 text-sm">
                        💵 ${gameState.town.bankVaultDollars}
                      </span>
                    </div>
                  )}

                  {loc === 'GENERAL_STORE' && (
                    <div className="flex items-center justify-between">
                      <span className="text-stone-300">Store Deck:</span>
                      <span className="font-mono font-bold text-cyan-300">
                        🃏 {gameState.town.generalStoreDrawCount} Draw •{' '}
                        {gameState.town.generalStoreDiscardCount} Discard
                      </span>
                    </div>
                  )}

                  {loc === 'SALOON' && (
                    <div className="flex items-center justify-between">
                      <span className="text-stone-300">Target Pool:</span>
                      <span className="font-mono font-bold text-rose-300">
                        Deeds or Store Cards
                      </span>
                    </div>
                  )}

                  {loc === 'SHERIFF_OFFICE' && (
                    <div className="flex items-center justify-between">
                      <span className="text-stone-300">Current Sheriff:</span>
                      <span className="font-black text-yellow-300">
                        ⭐{' '}
                        {gameState.sheriffPlayerId
                          ? formatName(gameState.sheriffPlayerId)
                          : 'Vacant'}
                      </span>
                    </div>
                  )}

                  {loc === 'TOWN_HALL' && (
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-stone-300">
                          3 Face-Up Deeds ({gameState.town.propertyDrawCount} in
                          deck):
                        </span>
                      </div>
                      <div className="flex flex-col gap-1.5">
                        {gameState.town.faceUpProperties.length === 0 ? (
                          <span className="text-[11px] text-stone-400 italic">
                            All Property Deeds claimed!
                          </span>
                        ) : (
                          [...gameState.town.faceUpProperties]
                            .map((deed, idx) => ({ deed, idx }))
                            .reverse()
                            .map(({ deed, idx }) => {
                              const isBottomDefault = idx === 0;
                              return (
                                <div
                                  key={deed.id}
                                  className={`px-2.5 py-1.5 rounded-lg border flex items-center justify-between text-[11px] transition ${
                                    isBottomDefault
                                      ? 'bg-gradient-to-r from-amber-950/90 via-purple-950 to-amber-950/90 border-2 border-amber-400 text-amber-200 shadow-md ring-1 ring-amber-400/50'
                                      : 'bg-purple-950/70 border-purple-500/40 text-purple-200'
                                  }`}
                                >
                                  <div className="flex items-center gap-1.5">
                                    <span className="font-black">
                                      {isBottomDefault
                                        ? '★ Bottom Deed #1'
                                        : idx === 1
                                          ? 'Middle Deed #2 (+1 Ace)'
                                          : 'Top Deed #3 (+2 Aces)'}
                                    </span>
                                    {isBottomDefault && (
                                      <span className="px-1.5 py-0.2 rounded bg-amber-400 text-stone-950 text-[9px] font-black uppercase">
                                        Drawn by Default
                                      </span>
                                    )}
                                  </div>
                                  <span className="font-mono font-black text-xs text-white">
                                    +{deed.vp} VP
                                  </span>
                                </div>
                              );
                            })
                        )}
                      </div>
                    </div>
                  )}

                  {loc === 'DOC_BADLUCK' && (
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-stone-300">
                          2 Face-Up + Deck ({gameState.town.docBadluckDrawCount}
                          ):
                        </span>
                      </div>
                      <div className="flex flex-col gap-1">
                        {gameState.town.faceUpDocBadluck.length === 0 ? (
                          <span className="text-[11px] text-stone-400 italic">
                            No face-up Doc Badluck cards left.
                          </span>
                        ) : (
                          gameState.town.faceUpDocBadluck.map((card, idx) => (
                            <div
                              key={card.id}
                              className="px-2 py-1 rounded-lg bg-teal-950/80 border border-teal-400/60 flex flex-col gap-0.5"
                              title={card.description}
                            >
                              <div className="flex items-center justify-between text-[10px]">
                                <span className="font-black text-teal-200">
                                  🧪 Face-Up #{idx + 1}: {card.displayName}
                                </span>
                              </div>
                              <span className="text-[9px] text-stone-300 leading-tight">
                                {card.description}
                              </span>
                            </div>
                          ))
                        )}
                        <div className="px-2 py-1 rounded-lg bg-stone-950/80 border border-dashed border-teal-500/50 flex items-center justify-between text-[10px] text-teal-300">
                          <span className="font-bold">🎴 Or Draw Blind:</span>
                          <span className="font-mono font-black">
                            {gameState.town.docBadluckDrawCount} in Deck
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Current Leader / Contender Footer */}
              <div className="pt-2 border-t border-white/10 flex items-center justify-between text-[11px]">
                <span className="text-stone-400 font-semibold">
                  {loc === 'DOC_BADLUCK' ? 'Eligible:' : 'Leader:'}
                </span>
                <span
                  className={`font-bold truncate ${
                    leaderInfo.isTie
                      ? 'text-yellow-300'
                      : leaderInfo.leaderPlayerIds.length > 0
                        ? 'text-emerald-300'
                        : 'text-stone-500'
                  }`}
                >
                  {leaderInfo.leaderPlayerIds.length === 0
                    ? 'None'
                    : `${leaderInfo.leaderPlayerIds
                        .map((id) => formatName(id))
                        .join(', ')} (${leaderInfo.bestValueLabel})`}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* =====================================================================
          3. PRIVATE "UNDER THE CUP" DICE TRAY & SELECTION CONTROLS
         ===================================================================== */}
      <div className="w-full max-w-7xl mx-auto bg-stone-900/95 border-2 border-amber-500/60 rounded-2xl p-4 shadow-2xl flex flex-col lg:flex-row items-center justify-between gap-4">
        <div className="space-y-1.5 flex-1">
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="text-sm font-black uppercase tracking-wider text-amber-300">
              🥤 Under the Cup — {formatName(self.id)}
            </span>
            <span className="px-2.5 py-0.5 rounded-lg bg-emerald-500/20 border border-emerald-400/50 text-emerald-300 text-xs font-black">
              💵 ${self.dollars}
            </span>
            <span className="px-2.5 py-0.5 rounded-lg bg-amber-500/20 border border-amber-400/50 text-amber-300 text-xs font-black">
              🪙 {self.nuggets} Nuggets
            </span>
            <span className="px-2.5 py-0.5 rounded-lg bg-purple-500/20 border border-purple-400/50 text-purple-300 text-xs font-black">
              🏆 Live Score: {selfVP.totalVP} VP
            </span>
          </div>
          <p className="text-xs text-stone-300">
            {gameState.phase === 'SECRET_SELECTION'
              ? self.hasSubmittedSelection
                ? '✓ You have staged your dice for this roll. Waiting for other players (or click Reveal when all are ready).'
                : gameState.finalRollTriggered
                  ? '🚨 FINAL ROLLING ROUND: An opponent locked all 5 dice! You must lock ALL of your remaining rolled dice below ($0 fee).'
                  : 'Click dice below to keep: 1st die is FREE, each extra die costs $1, OR keep 0 dice by paying $1 to the Stagecoach.'
              : gameState.phase === 'SIMULTANEOUS_ROLL'
                ? 'Click "Shake Dice Cups & Roll Remaining Dice" above to roll your in-cup dice!'
                : 'Your 5 Poker Dice are shown below.'}
          </p>

          {/* Optional Brute / Professional Cheater toggles during SECRET_SELECTION */}
          {gameState.phase === 'SECRET_SELECTION' &&
            !self.hasSubmittedSelection &&
            (bruteCardInHand || cheaterCardInHand) && (
              <div className="flex flex-wrap items-center gap-3 pt-1">
                {bruteCardInHand && (
                  <label className="flex items-center gap-1.5 text-xs bg-stone-950 border border-amber-400/60 rounded-lg px-2.5 py-1 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={useBruteCardId === bruteCardInHand.id}
                      onChange={(e) =>
                        setUseBruteCardId(
                          e.target.checked ? bruteCardInHand.id : null
                        )
                      }
                    />
                    <span className="font-bold text-amber-300">
                      Play &quot;The Brute&quot; ($0 fee for extra dice)
                    </span>
                  </label>
                )}

                {cheaterCardInHand && (
                  <div className="flex items-center gap-2 text-xs bg-stone-950 border border-purple-400/60 rounded-lg px-2.5 py-1">
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={useCheaterCardId === cheaterCardInHand.id}
                        onChange={(e) =>
                          setUseCheaterCardId(
                            e.target.checked ? cheaterCardInHand.id : null
                          )
                        }
                      />
                      <span className="font-bold text-purple-300">
                        Play &quot;Professional Cheater&quot;
                      </span>
                    </label>
                    {useCheaterCardId && (
                      <>
                        <select
                          value={cheaterFace}
                          onChange={(e) =>
                            setCheaterFace(e.target.value as DieFace)
                          }
                          className="bg-stone-900 border border-stone-700 rounded px-1.5 py-0.5 text-white font-bold"
                        >
                          {ALL_DIE_FACES.map((f) => (
                            <option key={f} value={f}>
                              Set to [{f}]
                            </option>
                          ))}
                        </select>
                      </>
                    )}
                  </div>
                )}
              </div>
            )}
        </div>

        {/* 5 Poker Dice Visual Row */}
        <div className="flex flex-wrap items-center gap-2.5">
          {self.dice.map((die) => {
            const isSelectable =
              gameState.phase === 'SECRET_SELECTION' &&
              !self.hasSubmittedSelection &&
              die.status === 'in_cup';
            const isSelected = selectedDieIndices.includes(die.index);
            const faceStyle = DIE_FACE_COLORS[die.value];

            return (
              <button
                key={die.index}
                type="button"
                disabled={!isSelectable}
                onClick={() => {
                  if (isSelectable) {
                    toggleDieIndex(die.index);
                  }
                }}
                className={`w-16 h-20 rounded-2xl border-2 flex flex-col items-center justify-between p-2 transition shadow-lg ${faceStyle} ${
                  isSelectable
                    ? isSelected
                      ? 'ring-4 ring-amber-400 scale-110 cursor-pointer'
                      : 'opacity-80 hover:opacity-100 cursor-pointer'
                    : 'cursor-default'
                }`}
              >
                <span className="text-[9px] font-bold uppercase tracking-wider text-stone-300">
                  Die #{die.index + 1}
                </span>
                <span className="text-2xl font-black font-serif">
                  {die.value}
                </span>
                <span className="text-[8px] font-black uppercase px-1.5 py-0.2 rounded bg-black/50 text-white">
                  {die.status === 'locked_public'
                    ? '🔒 Locked'
                    : die.status === 'staged_hidden'
                      ? '🥤 Staged'
                      : isSelected
                        ? '✓ Keep'
                        : 'In Cup'}
                </span>
              </button>
            );
          })}
        </div>

        {/* Confirm Selection Buttons during SECRET_SELECTION */}
        {gameState.phase === 'SECRET_SELECTION' &&
          !self.hasSubmittedSelection &&
          inCupDice.length > 0 && (
            <div className="flex flex-col gap-2 shrink-0">
              {gameState.finalRollTriggered ? (
                <button
                  type="button"
                  onClick={() =>
                    sendAction({
                      type: 'DT_SELECT_DICE',
                      dieIndices: inCupDice.map((d) => d.index),
                      lockAllRemaining: true,
                      ...(useCheaterCardId && cheaterDieIdx !== null
                        ? {
                            cheaterCardId: useCheaterCardId,
                            cheaterDieIndex: cheaterDieIdx,
                            cheaterTargetFace: cheaterFace,
                          }
                        : {}),
                    })
                  }
                  className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-black text-xs shadow-lg cursor-pointer"
                >
                  🚨 Final Roll: Keep All {inCupDice.length} Remaining Dice ($0)
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    disabled={!canAffordSelection}
                    onClick={() =>
                      sendAction({
                        type: 'DT_SELECT_DICE',
                        dieIndices: selectedDieIndices,
                        ...(useBruteCardId
                          ? { playBruteCardId: useBruteCardId }
                          : {}),
                        ...(useCheaterCardId &&
                        cheaterDieIdx !== null &&
                        selectedDieIndices.includes(cheaterDieIdx)
                          ? {
                              cheaterCardId: useCheaterCardId,
                              cheaterDieIndex: cheaterDieIdx,
                              cheaterTargetFace: cheaterFace,
                            }
                          : {}),
                      })
                    }
                    className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-stone-950 font-black text-xs shadow-lg cursor-pointer disabled:cursor-not-allowed"
                  >
                    {selectedDieIndices.length === 0
                      ? `🐎 Keep 0 Dice — Pay $${effectiveExtraFee} to Stagecoach`
                      : `🥤 Stage ${selectedDieIndices.length} Selected Die/Dice (Cost: $${effectiveExtraFee})`}
                  </button>

                  {selectedDieIndices.length > 0 &&
                    self.dollars >= (useBruteCardId ? 0 : 1) && (
                      <button
                        type="button"
                        onClick={() =>
                          sendAction({
                            type: 'DT_SELECT_DICE',
                            dieIndices: [],
                            ...(useBruteCardId
                              ? { playBruteCardId: useBruteCardId }
                              : {}),
                          })
                        }
                        className="px-4 py-1.5 rounded-xl bg-stone-950 hover:bg-stone-800 border border-orange-400/50 text-orange-300 font-bold text-[11px] cursor-pointer"
                      >
                        🐎 Keep 0 Dice Instead (Pay $
                        {useBruteCardId ? 0 : 1} to Stagecoach)
                      </button>
                    )}

                  {inCupDice.length > 1 &&
                    self.dollars >=
                      (useBruteCardId ? 0 : inCupDice.length - 1) && (
                      <button
                        type="button"
                        onClick={() =>
                          sendAction({
                            type: 'DT_SELECT_DICE',
                            dieIndices: [],
                            lockAllRemaining: true,
                            ...(useBruteCardId
                              ? { playBruteCardId: useBruteCardId }
                              : {}),
                          })
                        }
                        className="px-4 py-1.5 rounded-xl bg-stone-800 hover:bg-stone-700 border border-amber-500/40 text-amber-200 font-bold text-[11px] cursor-pointer"
                      >
                        🔒 Lock All {inCupDice.length} Remaining ($
                        {useBruteCardId ? 0 : inCupDice.length - 1})
                      </button>
                    )}
                </>
              )}
            </div>
          )}
      </div>

      {/* =====================================================================
          4. PLAYER ROSTER, PUBLIC LOCKED DICE, HAND CARDS & PROPERTY DEEDS
         ===================================================================== */}
      <div className="w-full max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left 2 Columns: All Players' Town Table Status */}
        <div className="lg:col-span-2 bg-stone-900/95 border border-stone-800 rounded-2xl p-4 space-y-3">
          <div className="text-xs font-black uppercase tracking-wider text-amber-300">
            🤠 Saloon Table — All Players&apos; Dice & Holdings
          </div>

          <div className="space-y-2.5">
            {gameState.playerOrder.map((pid) => {
              const isSelf = pid === self.id;
              const opp = gameState.opponents[pid];
              const dollars = isSelf ? self.dollars : opp?.dollars ?? 0;
              const nuggets = isSelf ? self.nuggets : opp?.nuggets ?? 0;
              const isSheriff = isSelf
                ? self.isSheriff
                : opp?.isSheriff ?? false;
              const submitted = isSelf
                ? self.hasSubmittedSelection
                : opp?.hasSubmittedSelection ?? false;
              const deeds = isSelf
                ? self.propertyDeeds
                : opp?.propertyDeeds ?? [];
              const handCount = isSelf
                ? self.handCards.length
                : opp?.handCardCount ?? 0;
              const diceList = isSelf ? self.dice : opp?.dice ?? [];

              return (
                <div
                  key={pid}
                  className={`p-3 rounded-xl border flex flex-wrap items-center justify-between gap-3 ${
                    pid === gameState.activePlayerId
                      ? 'bg-stone-950 border-amber-400/80'
                      : 'bg-stone-950/70 border-stone-800'
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-black text-xs text-white">
                        {formatName(pid)}
                      </span>
                      {isSelf && (
                        <span className="px-1.5 py-0.2 rounded bg-cyan-500/20 text-cyan-300 text-[9px] font-black">
                          YOU
                        </span>
                      )}
                      {isSheriff && (
                        <span className="px-2 py-0.2 rounded bg-yellow-400 text-stone-950 text-[9px] font-black">
                          ⭐ SHERIFF (+5 VP)
                        </span>
                      )}
                      {gameState.phase === 'SECRET_SELECTION' && (
                        <span
                          className={`px-2 py-0.2 rounded text-[9px] font-bold ${
                            submitted
                              ? 'bg-emerald-500/20 text-emerald-300'
                              : 'bg-amber-500/20 text-amber-300'
                          }`}
                        >
                          {submitted ? '✓ Staged' : 'Choosing...'}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-3 text-[11px] text-stone-300">
                      <span>
                        💵 <strong>${dollars}</strong>
                      </span>
                      <span>
                        🪙 <strong>{nuggets}</strong> Nuggets
                      </span>
                      <span>
                        🃏 <strong>{handCount}</strong> Store Cards
                      </span>
                      <span>
                        📜 <strong>{deeds.length}</strong> Deeds (
                        {deeds.reduce((s, d) => s + d.vp, 0)} VP)
                      </span>
                    </div>
                  </div>

                  {/* Player's 5 Dice (Public Locked vs Hidden Under Cup) */}
                  <div className="flex items-center gap-1.5">
                    {diceList.map((d) => (
                      <div
                        key={d.index}
                        className={`w-9 h-10 rounded-lg border flex flex-col items-center justify-center font-black text-xs ${
                          d.value !== null
                            ? DIE_FACE_COLORS[d.value]
                            : 'bg-stone-900 border-stone-700 text-stone-500'
                        }`}
                        title={`Die #${d.index + 1}: ${d.status}`}
                      >
                        <span>{d.value ?? '🥤'}</span>
                        <span className="text-[7px] font-sans uppercase text-stone-400">
                          {d.status === 'locked_public'
                            ? 'Lock'
                            : d.status === 'staged_hidden'
                              ? 'Staged'
                              : 'Cup'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Your General Store Hand Cards & Property Deeds */}
        <div className="bg-stone-900/95 border border-stone-800 rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black uppercase tracking-wider text-cyan-300">
              🃏 Your General Store Hand ({self.handCards.length})
            </span>
            {otherPlayerIds.length > 1 && (
              <select
                value={effectiveTargetOpp}
                onChange={(e) => setTargetOpponentId(e.target.value)}
                className="bg-stone-950 border border-stone-700 rounded-lg px-2 py-0.5 text-[10px] text-stone-200"
              >
                {otherPlayerIds.map((id) => (
                  <option key={id} value={id}>
                    Target: {formatName(id)}
                  </option>
                ))}
              </select>
            )}
          </div>

          {self.handCards.length === 0 ? (
            <div className="p-4 rounded-xl bg-stone-950/70 border border-stone-800 text-xs text-stone-500 italic text-center">
              No General Store cards in hand yet. Roll Jacks [J] to shop at the
              General Store!
            </div>
          ) : (
            <div className="space-y-2">
              {self.handCards.map((card) => {
                const isPlayable = card.timing !== 'PASSIVE_END_GAME';
                return (
                  <div
                    key={card.id}
                    className="p-2.5 rounded-xl bg-stone-950 border border-stone-800 flex flex-col gap-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-black text-xs text-white">
                        {card.displayName}
                      </span>
                      {card.vp > 0 ? (
                        <span className="px-2 py-0.5 rounded bg-amber-400 text-stone-950 text-[10px] font-black">
                          +{card.vp} VP
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 text-[9px] font-bold">
                          {card.timing}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-stone-400">
                      {card.description}
                    </p>
                    {isPlayable && (
                      <button
                        type="button"
                        onClick={() =>
                          sendAction({
                            type: 'DT_PLAY_CARD',
                            cardId: card.id,
                            targetPlayerId: effectiveTargetOpp,
                          })
                        }
                        className="self-end px-3 py-1 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-stone-950 font-black text-[10px] cursor-pointer"
                      >
                        ▶ Play Card
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Owned Property Deeds */}
          <div className="pt-2 border-t border-stone-800 space-y-1.5">
            <span className="text-xs font-black uppercase tracking-wider text-purple-300 block">
              📜 Your Property Deeds ({self.propertyDeeds.length})
            </span>
            {self.propertyDeeds.length === 0 ? (
              <div className="text-[11px] text-stone-500 italic">
                Win Town Hall with the best 5-die Poker Hand to claim Property
                Deeds!
              </div>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {self.propertyDeeds.map((deed) => {
                  const isProtected = self.protectedDeedIds.includes(deed.id);
                  return (
                    <span
                      key={deed.id}
                      className="px-2.5 py-1 rounded-lg bg-purple-950/70 border border-purple-400/50 text-purple-200 text-xs font-bold"
                    >
                      📜 +{deed.vp} VP {isProtected ? '🛡️' : ''}
                    </span>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
