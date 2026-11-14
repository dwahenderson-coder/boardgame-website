import { createPRNG } from '../../common/prng.js';
import { ValidationResult } from '../ticket-to-ride/types.js';
import {
  createInitialSupply,
  DEFAULT_BASE_KINGDOM_CARD_IDS,
  DOMINION_CARDS,
  getDominionCard,
} from './cards.js';
import {
  calculatePlayerVictoryPoints,
  createStartingPlayerState,
  drawCardsForPlayer,
  removeCardsFromHand,
} from './deck.js';
import {
  Card,
  DominionAction,
  DominionGameState,
  DominionInitOptions,
  DominionPlayerState,
  PendingInteraction,
  SanitizedDominionPlayerState,
  SanitizedDominionState,
} from './types.js';

/**
 * Checks whether the Dominion End-Game condition has been met:
 * 1. The Province pile is empty (`supply['province'] === 0`), OR
 * 2. Any 3 or more Supply piles are empty.
 */
export function checkDominionEndGame(
  supply: Readonly<Record<string, number>>
): boolean {
  if ((supply['province'] ?? 0) <= 0) {
    return true;
  }
  let emptyPiles = 0;
  for (const count of Object.values(supply)) {
    if (count <= 0) {
      emptyPiles += 1;
    }
  }
  return emptyPiles >= 3;
}

/**
 * Computes final Victory Point totals for all players.
 */
export function calculateDominionFinalScores(
  state: DominionGameState
): Record<string, number> {
  const scores: Record<string, number> = {};
  for (const pid of state.playerOrder) {
    const player = state.players[pid];
    if (player) {
      scores[pid] = calculatePlayerVictoryPoints(player);
    }
  }
  return scores;
}

function finalizeStateIfGameOver(
  state: DominionGameState,
  summaryPrefix: string
): DominionGameState {
  if (!checkDominionEndGame(state.supply)) {
    return {
      ...state,
      lastActionSummary: summaryPrefix,
    };
  }

  const finalScores: Record<string, number> = {};
  let bestScore = -Infinity;
  let winnerId: string | null = null;

  for (const pid of state.playerOrder) {
    const score = calculatePlayerVictoryPoints(state.players[pid]!);
    finalScores[pid] = score;
    if (score > bestScore) {
      bestScore = score;
      winnerId = pid;
    }
  }

  return {
    ...state,
    phase: 'GAME_OVER',
    isGameOver: true,
    pendingInteraction: null,
    winnerId,
    finalScores,
    lastActionSummary: `${summaryPrefix} — Game Over! ${winnerId} wins with ${bestScore} VP.`,
  };
}

/**
 * Returns true if `player` is immune to Attack cards (holds Moat in hand or has Lighthouse in play).
 */
function isPlayerImmuneToAttack(player: DominionPlayerState): boolean {
  const hasMoatInHand = player.hand.some(
    (c) => c.id === 'moat' || c.customEffectId === 'MOAT'
  );
  const hasLighthouseInPlay =
    player.inPlay.some(
      (c) => c.id === 'lighthouse' || c.customEffectId === 'LIGHTHOUSE'
    ) ||
    (player.activeDurations ?? []).some(
      (c) => c.id === 'lighthouse' || c.customEffectId === 'LIGHTHOUSE'
    ) ||
    (player.durationCards ?? []).some(
      (c) => c.id === 'lighthouse' || c.customEffectId === 'LIGHTHOUSE'
    );
  return hasMoatInHand || hasLighthouseInPlay;
}

/**
 * Helper to create the next `ATTACK_DEFENSE_OR_DISCARD` interaction for the first
 * opponent in `queue` who still has > 3 cards in hand.
 */
function buildNextMilitiaInteraction(
  players: Readonly<Record<string, DominionPlayerState>>,
  sourceCard: Card,
  queue: readonly string[]
): PendingInteraction | null {
  for (let i = 0; i < queue.length; i++) {
    const targetId = queue[i]!;
    const targetPlayer = players[targetId];
    if (!targetPlayer) continue;
    const discardCountRequired = Math.max(0, targetPlayer.hand.length - 3);
    if (discardCountRequired > 0) {
      return {
        playerId: targetId,
        sourceCard,
        promptType: 'ATTACK_DEFENSE_OR_DISCARD',
        minCount: discardCountRequired,
        maxCount: discardCountRequired,
        remainingTargetQueue: queue.slice(i + 1),
      };
    }
  }
  return null;
}

/**
 * Helper to create the next `PUT_CARD_ONTO_DECK` interaction for Ghost Ship
 * for the first opponent in `queue` who has >= 4 cards in hand.
 */
function buildNextGhostShipInteraction(
  players: Readonly<Record<string, DominionPlayerState>>,
  sourceCard: Card,
  queue: readonly string[]
): PendingInteraction | null {
  for (let i = 0; i < queue.length; i++) {
    const targetId = queue[i]!;
    const targetPlayer = players[targetId];
    if (!targetPlayer) continue;
    const putBackCount = Math.max(0, targetPlayer.hand.length - 3);
    if (putBackCount > 0) {
      return {
        playerId: targetId,
        sourceCard,
        promptType: 'PUT_CARD_ONTO_DECK',
        minCount: putBackCount,
        maxCount: putBackCount,
        remainingTargetQueue: queue.slice(i + 1),
      };
    }
  }
  return null;
}

/**
 * Initializes a new Dominion match for 2 to 4 players.
 */
export function initGame(
  playerIds: string[],
  seed: number,
  options?: DominionInitOptions
): DominionGameState {
  if (playerIds.length < 2 || playerIds.length > 4) {
    throw new Error(
      `Dominion requires between 2 and 4 players (received ${playerIds.length}).`
    );
  }

  const kingdomCards = (
    options?.kingdomCards && options.kingdomCards.length > 0
      ? options.kingdomCards
      : DEFAULT_BASE_KINGDOM_CARD_IDS
  ).map((id) => id.trim().toLowerCase());

  const supply = createInitialSupply(playerIds.length, kingdomCards);
  let prng = createPRNG(seed);

  const players: Record<string, DominionPlayerState> = {};
  for (const pid of playerIds) {
    const created = createStartingPlayerState(pid, prng);
    players[pid] = created.player;
    prng = created.prng;
  }

  const firstPlayerId = playerIds[0]!;

  return {
    gameId: 'dominion',
    phase: 'PLAYING',
    turnPhase: 'ACTION',
    turnStep: 'ACTION',
    isGameOver: false,
    turnNumber: 1,
    playerOrder: [...playerIds],
    activePlayerIndex: 0,
    activePlayerId: firstPlayerId,
    players,
    supply,
    embargoTokens: {},
    kingdomCards,
    trash: [],
    pendingInteraction: null,
    prng,
    winnerId: null,
    finalScores: null,
    lastActionSummary: `Dominion initialized for ${playerIds.length} players. ${firstPlayerId}'s turn (Action Phase).`,
  };
}

export const initDominionGame = initGame;

/**
 * Validates whether `playerId` can perform `action` in `state`.
 */
export function validateAction(
  state: DominionGameState,
  playerId: string,
  action: DominionAction
): ValidationResult {
  if (state.isGameOver || state.phase === 'GAME_OVER') {
    return { valid: false, reason: 'The game is already over.' };
  }

  const player = state.players[playerId];
  if (!player) {
    return { valid: false, reason: `Unknown player "${playerId}".` };
  }

  // 1. If a PendingInteraction is active, ONLY `RESOLVE_INTERACTION` by the target player is legal
  if (state.pendingInteraction !== null) {
    const pending = state.pendingInteraction;
    if (action.type !== 'RESOLVE_INTERACTION') {
      return {
        valid: false,
        reason: `Cannot perform ${action.type} while awaiting ${pending.promptType} resolution from ${pending.playerId}.`,
      };
    }
    if (playerId !== pending.playerId) {
      return {
        valid: false,
        reason: `Waiting for ${pending.playerId} to resolve ${pending.sourceCard.name}.`,
      };
    }

    const targetPlayer = state.players[pending.playerId]!;

    switch (pending.promptType) {
      case 'DISCARD_FOR_DRAW':
      case 'DISCARD_EXACT_COUNT':
      case 'PUT_CARD_ONTO_DECK':
      case 'ISLAND_SET_ASIDE':
      case 'HAVEN_SET_ASIDE':
      case 'SALVAGER_TRASH':
      case 'AMBASSADOR_RETURN':
      case 'TRASH_UP_TO_N': {
        const selected = action.selectedCardIds ?? [];
        if (
          selected.length < pending.minCount ||
          selected.length > pending.maxCount
        ) {
          return {
            valid: false,
            reason: `Must select between ${pending.minCount} and ${pending.maxCount} cards (selected ${selected.length}).`,
          };
        }
        const checkHand = removeCardsFromHand(targetPlayer.hand, selected);
        if (!checkHand.valid) {
          return {
            valid: false,
            reason: checkHand.reason ?? 'Selected card is not in hand.',
          };
        }
        return { valid: true };
      }

      case 'EMBARGO_PILE': {
        const pileId = (
          action.gainedCardId ??
          action.selectedCardIds?.[0] ??
          ''
        )
          .trim()
          .toLowerCase();
        if (!pileId || state.supply[pileId] === undefined) {
          return {
            valid: false,
            reason: 'Must select a valid Supply pile for Embargo.',
          };
        }
        return { valid: true };
      }

      case 'NATIVE_VILLAGE_CHOICE':
      case 'PIRATE_SHIP_CHOICE': {
        return { valid: true };
      }

      case 'ATTACK_DEFENSE_OR_DISCARD': {
        if (action.revealMoat) {
          const hasMoat = targetPlayer.hand.some((c) => c.id === 'moat');
          if (!hasMoat) {
            return {
              valid: false,
              reason: 'Cannot reveal Moat: you do not have a Moat in hand.',
            };
          }
          return { valid: true };
        }
        const selected = action.selectedCardIds ?? [];
        if (
          selected.length < pending.minCount ||
          selected.length > pending.maxCount
        ) {
          return {
            valid: false,
            reason: `Must discard ${pending.minCount} card(s) down to 3 in hand (selected ${selected.length}).`,
          };
        }
        const checkHand = removeCardsFromHand(targetPlayer.hand, selected);
        if (!checkHand.valid) {
          return {
            valid: false,
            reason: checkHand.reason ?? 'Selected card is not in hand.',
          };
        }
        return { valid: true };
      }

      case 'GAIN_COSTING_UP_TO': {
        const gainId = (
          action.gainedCardId ??
          action.selectedCardIds?.[0] ??
          ''
        )
          .trim()
          .toLowerCase();
        if (!gainId) {
          return {
            valid: false,
            reason: 'Must specify a card from the Supply to gain.',
          };
        }
        const cardDef = getDominionCard(gainId);
        if (!cardDef) {
          return { valid: false, reason: `Unknown card "${gainId}".` };
        }
        if ((state.supply[cardDef.id] ?? 0) <= 0) {
          return {
            valid: false,
            reason: `Supply pile for ${cardDef.name} is empty.`,
          };
        }
        if (
          pending.maxCost !== undefined &&
          cardDef.cost > pending.maxCost
        ) {
          return {
            valid: false,
            reason: `${cardDef.name} costs ${cardDef.cost}, which exceeds the maximum allowed cost of ${pending.maxCost}.`,
          };
        }
        if (
          pending.restrictedCardKind &&
          !cardDef.types.includes(pending.restrictedCardKind)
        ) {
          return {
            valid: false,
            reason: `Must gain a ${pending.restrictedCardKind} card.`,
          };
        }
        return { valid: true };
      }

      case 'TRASH_AND_UPGRADE': {
        const trashId = (
          action.trashedCardId ??
          action.selectedCardIds?.[0] ??
          ''
        )
          .trim()
          .toLowerCase();
        if (!trashId) {
          if (pending.minCount === 0 && !action.gainedCardId) {
            return { valid: true };
          }
          return {
            valid: false,
            reason: `Must select a card from hand to trash for ${pending.sourceCard.name}.`,
          };
        }
        const checkTrash = removeCardsFromHand(targetPlayer.hand, [trashId]);
        if (!checkTrash.valid) {
          return {
            valid: false,
            reason: checkTrash.reason ?? 'Selected card is not in hand.',
          };
        }
        const trashedCard = checkTrash.removedCards[0]!;
        if (
          pending.restrictedCardKind &&
          !trashedCard.types.includes(pending.restrictedCardKind)
        ) {
          return {
            valid: false,
            reason: `${pending.sourceCard.name} requires trashing a ${pending.restrictedCardKind} card.`,
          };
        }

        // If gainedCardId is also supplied in the same action, validate it right now
        if (action.gainedCardId !== undefined) {
          const gainId = action.gainedCardId.trim().toLowerCase();
          const gainedDef = getDominionCard(gainId);
          if (!gainedDef) {
            return { valid: false, reason: `Unknown card "${gainId}".` };
          }
          if ((state.supply[gainedDef.id] ?? 0) <= 0) {
            return {
              valid: false,
              reason: `Supply pile for ${gainedDef.name} is empty.`,
            };
          }
          const maxAllowedCost =
            trashedCard.cost + (pending.upgradeMaxCostDelta ?? 2);
          if (gainedDef.cost > maxAllowedCost) {
            return {
              valid: false,
              reason: `${gainedDef.name} costs ${gainedDef.cost}, which exceeds the maximum allowed cost of ${maxAllowedCost} (${trashedCard.name} cost ${trashedCard.cost} + ${pending.upgradeMaxCostDelta ?? 2}).`,
            };
          }
          if (
            pending.restrictedCardKind &&
            !gainedDef.types.includes(pending.restrictedCardKind)
          ) {
            return {
              valid: false,
              reason: `${pending.sourceCard.name} requires gaining a ${pending.restrictedCardKind} card.`,
            };
          }
        }
        return { valid: true };
      }
    }
  }

  // 2. Normal Turn Actions: must be the active player
  const activePlayerId = state.playerOrder[state.activePlayerIndex]!;
  if (playerId !== activePlayerId) {
    return {
      valid: false,
      reason: `It is currently ${activePlayerId}'s turn.`,
    };
  }

  switch (action.type) {
    case 'RESOLVE_INTERACTION':
      return {
        valid: false,
        reason: 'There is no pending interaction to resolve.',
      };

    case 'PLAY_ACTION_CARD': {
      if (state.turnPhase !== 'ACTION') {
        return {
          valid: false,
          reason: `Action cards can only be played during the ACTION phase (current phase: ${state.turnPhase}).`,
        };
      }
      if (player.actions <= 0) {
        return {
          valid: false,
          reason: 'No Actions remaining this turn.',
        };
      }
      const checkHand = removeCardsFromHand(player.hand, [action.cardId]);
      if (!checkHand.valid) {
        return {
          valid: false,
          reason: checkHand.reason ?? 'Card is not in hand.',
        };
      }
      const card = checkHand.removedCards[0]!;
      if (!card.types.includes('ACTION')) {
        return {
          valid: false,
          reason: `${card.name} is not an Action card.`,
        };
      }
      return { valid: true };
    }

    case 'END_ACTION_PHASE': {
      if (state.turnPhase !== 'ACTION') {
        return {
          valid: false,
          reason: 'Already past the Action phase.',
        };
      }
      return { valid: true };
    }

    case 'PLAY_TREASURE': {
      if (
        state.turnPhase !== 'ACTION' &&
        state.turnPhase !== 'BUY_TREASURES'
      ) {
        return {
          valid: false,
          reason: `Cannot play Treasure cards during ${state.turnPhase}.`,
        };
      }
      const checkHand = removeCardsFromHand(player.hand, [action.cardId]);
      if (!checkHand.valid) {
        return {
          valid: false,
          reason: checkHand.reason ?? 'Card is not in hand.',
        };
      }
      const card = checkHand.removedCards[0]!;
      if (!card.types.includes('TREASURE')) {
        return {
          valid: false,
          reason: `${card.name} is not a Treasure card.`,
        };
      }
      return { valid: true };
    }

    case 'PLAY_ALL_TREASURES': {
      if (
        state.turnPhase !== 'ACTION' &&
        state.turnPhase !== 'BUY_TREASURES'
      ) {
        return {
          valid: false,
          reason: `Cannot play Treasures during ${state.turnPhase}.`,
        };
      }
      return { valid: true };
    }

    case 'BUY_CARD': {
      if (
        state.turnPhase !== 'ACTION' &&
        state.turnPhase !== 'BUY_TREASURES' &&
        state.turnPhase !== 'BUY_CARDS'
      ) {
        return {
          valid: false,
          reason: `Cannot buy cards during ${state.turnPhase}.`,
        };
      }
      if (player.buys <= 0) {
        return {
          valid: false,
          reason: 'No Buys remaining this turn.',
        };
      }
      const cardDef = getDominionCard(action.cardId);
      if (!cardDef) {
        return {
          valid: false,
          reason: `Unknown Supply card "${action.cardId}".`,
        };
      }
      const remainingInPile = state.supply[cardDef.id];
      if (remainingInPile === undefined) {
        return {
          valid: false,
          reason: `${cardDef.name} is not in the Supply for this game.`,
        };
      }
      if (remainingInPile <= 0) {
        return {
          valid: false,
          reason: `The ${cardDef.name} Supply pile is empty.`,
        };
      }
      if (player.coins < cardDef.cost) {
        return {
          valid: false,
          reason: `Insufficient Coins to buy ${cardDef.name}: costs ${cardDef.cost}, have ${player.coins}.`,
        };
      }
      return { valid: true };
    }

    case 'CLEANUP':
    case 'END_TURN':
      return { valid: true };
  }
}

export const validateDominionAction = validateAction;

/**
 * Pure reducer applying a validated Dominion action.
 */
export function applyAction(
  state: DominionGameState,
  playerId: string,
  action: DominionAction
): DominionGameState {
  const validation = validateAction(state, playerId, action);
  if (!validation.valid) {
    throw new Error(validation.reason ?? 'Invalid Dominion action.');
  }

  // =========================================================================
  // 1. RESOLVE_INTERACTION
  // =========================================================================
  if (action.type === 'RESOLVE_INTERACTION') {
    const pending = state.pendingInteraction!;
    const targetPlayer = state.players[pending.playerId]!;
    const nextPlayers: Record<string, DominionPlayerState> = {
      ...state.players,
    };
    const nextSupply: Record<string, number> = { ...state.supply };
    let nextTrash = [...state.trash];
    let nextPrng = state.prng;

    switch (pending.promptType) {
      case 'DISCARD_FOR_DRAW': {
        const selected = action.selectedCardIds ?? [];
        const removed = removeCardsFromHand(targetPlayer.hand, selected);
        const afterDiscardPlayer: DominionPlayerState = {
          ...targetPlayer,
          hand: removed.remainingHand,
          discard: [...targetPlayer.discard, ...removed.removedCards],
        };
        const drawnRes = drawCardsForPlayer(
          afterDiscardPlayer,
          removed.removedCards.length,
          nextPrng
        );
        nextPlayers[pending.playerId] = drawnRes.player;
        nextPrng = drawnRes.prng;

        return {
          ...state,
          players: nextPlayers,
          pendingInteraction: null,
          prng: nextPrng,
          lastActionSummary: `${pending.playerId} discarded ${removed.removedCards.length} card(s) and drew ${drawnRes.drawn.length} card(s) with ${pending.sourceCard.name}.`,
        };
      }

      case 'DISCARD_EXACT_COUNT': {
        const selected = action.selectedCardIds ?? [];
        const removed = removeCardsFromHand(targetPlayer.hand, selected);
        nextPlayers[pending.playerId] = {
          ...targetPlayer,
          hand: removed.remainingHand,
          discard: [...targetPlayer.discard, ...removed.removedCards],
        };

        return {
          ...state,
          players: nextPlayers,
          pendingInteraction: null,
          lastActionSummary: `${pending.playerId} discarded ${removed.removedCards.length} card(s) for ${pending.sourceCard.name}.`,
        };
      }

      case 'PUT_CARD_ONTO_DECK': {
        const selected = action.selectedCardIds ?? [];
        const removed = removeCardsFromHand(targetPlayer.hand, selected);
        nextPlayers[pending.playerId] = {
          ...targetPlayer,
          hand: removed.remainingHand,
          deck: [...removed.removedCards, ...targetPlayer.deck],
        };

        const queue = pending.remainingTargetQueue ?? [];
        const nextPending =
          pending.sourceCard.customEffectId === 'GHOST_SHIP' && queue.length > 0
            ? buildNextGhostShipInteraction(
                nextPlayers,
                pending.sourceCard,
                queue
              )
            : null;

        return {
          ...state,
          players: nextPlayers,
          pendingInteraction: nextPending,
          lastActionSummary: `${pending.playerId} placed ${removed.removedCards.length} card(s) from hand onto their deck (${pending.sourceCard.name}).`,
        };
      }

      case 'ISLAND_SET_ASIDE': {
        const selected = action.selectedCardIds ?? [];
        const removed = removeCardsFromHand(targetPlayer.hand, selected);
        nextPlayers[pending.playerId] = {
          ...targetPlayer,
          hand: removed.remainingHand,
          islandMat: [
            ...(targetPlayer.islandMat ?? []),
            ...removed.removedCards,
          ],
        };

        return {
          ...state,
          players: nextPlayers,
          pendingInteraction: null,
          lastActionSummary: `${pending.playerId} set aside ${
            removed.removedCards[0]?.name ?? 'a card'
          } onto their Island Mat.`,
        };
      }

      case 'HAVEN_SET_ASIDE': {
        const selected = action.selectedCardIds ?? [];
        const removed = removeCardsFromHand(targetPlayer.hand, selected);
        nextPlayers[pending.playerId] = {
          ...targetPlayer,
          hand: removed.remainingHand,
          havenSetAside: [
            ...(targetPlayer.havenSetAside ?? []),
            ...removed.removedCards,
          ],
        };

        return {
          ...state,
          players: nextPlayers,
          pendingInteraction: null,
          lastActionSummary: `${pending.playerId} set aside a card face down under Haven.`,
        };
      }

      case 'SALVAGER_TRASH': {
        const selected = action.selectedCardIds ?? [];
        const removed = removeCardsFromHand(targetPlayer.hand, selected);
        const trashedCard = removed.removedCards[0];
        const coinBonus = trashedCard ? trashedCard.cost : 0;
        if (trashedCard) {
          nextTrash = [...nextTrash, trashedCard];
        }
        nextPlayers[pending.playerId] = {
          ...targetPlayer,
          hand: removed.remainingHand,
          coins: targetPlayer.coins + coinBonus,
        };

        return {
          ...state,
          players: nextPlayers,
          trash: nextTrash,
          pendingInteraction: null,
          lastActionSummary: trashedCard
            ? `${pending.playerId} trashed ${trashedCard.name} with Salvager for +${coinBonus} Coin(s).`
            : `${pending.playerId} resolved Salvager.`,
        };
      }

      case 'AMBASSADOR_RETURN': {
        const selected = action.selectedCardIds ?? [];
        if (selected.length === 0) {
          return {
            ...state,
            pendingInteraction: null,
            lastActionSummary: `${pending.playerId} returned 0 cards with Ambassador.`,
          };
        }
        const revealId = selected[0]!.trim().toLowerCase();
        const sameIdSelected = selected
          .map((s) => s.trim().toLowerCase())
          .filter((s) => s === revealId)
          .slice(0, 2);
        const removed = removeCardsFromHand(targetPlayer.hand, sameIdSelected);
        const returnedCard =
          removed.removedCards[0] ?? getDominionCard(revealId);
        if (returnedCard && nextSupply[returnedCard.id] !== undefined) {
          nextSupply[returnedCard.id] =
            (nextSupply[returnedCard.id] ?? 0) + removed.removedCards.length;
        }
        nextPlayers[pending.playerId] = {
          ...targetPlayer,
          hand: removed.remainingHand,
        };

        // Each other non-immune player gains a copy of `returnedCard` from Supply
        const n = state.playerOrder.length;
        if (returnedCard) {
          for (let offset = 1; offset < n; offset++) {
            const oppId =
              state.playerOrder[(state.activePlayerIndex + offset) % n]!;
            const opp = nextPlayers[oppId]!;
            if (isPlayerImmuneToAttack(opp)) continue;
            if ((nextSupply[returnedCard.id] ?? 0) > 0) {
              nextSupply[returnedCard.id] =
                (nextSupply[returnedCard.id] ?? 1) - 1;
              nextPlayers[oppId] = {
                ...opp,
                discard: [...opp.discard, returnedCard],
              };
            }
          }
        }

        const updatedState: DominionGameState = {
          ...state,
          players: nextPlayers,
          supply: nextSupply,
          pendingInteraction: null,
        };
        return finalizeStateIfGameOver(
          updatedState,
          `${pending.playerId} returned ${removed.removedCards.length} copy(ies) of ${
            returnedCard?.name ?? revealId
          } to the Supply with Ambassador.`
        );
      }

      case 'EMBARGO_PILE': {
        const pileId = (
          action.gainedCardId ??
          action.selectedCardIds?.[0] ??
          ''
        )
          .trim()
          .toLowerCase();
        const nextEmbargo: Record<string, number> = {
          ...(state.embargoTokens ?? {}),
          [pileId]: ((state.embargoTokens ?? {})[pileId] ?? 0) + 1,
        };
        const pileCard = getDominionCard(pileId);
        return {
          ...state,
          embargoTokens: nextEmbargo,
          pendingInteraction: null,
          lastActionSummary: `${pending.playerId} placed an Embargo Coin on the ${
            pileCard?.name ?? pileId
          } pile.`,
        };
      }

      case 'NATIVE_VILLAGE_CHOICE': {
        const choice = action.choice ?? 'MAT_PUT';
        if (choice === 'MAT_TAKE') {
          const matCards = targetPlayer.nativeVillageMat ?? [];
          nextPlayers[pending.playerId] = {
            ...targetPlayer,
            hand: [...targetPlayer.hand, ...matCards],
            nativeVillageMat: [],
          };
          return {
            ...state,
            players: nextPlayers,
            pendingInteraction: null,
            lastActionSummary: `${pending.playerId} took ${matCards.length} card(s) from their Native Village Mat into hand.`,
          };
        }
        // MAT_PUT: Put top card of deck face down on Native Village Mat
        const beforeHandLen = targetPlayer.hand.length;
        const drawnRes = drawCardsForPlayer(targetPlayer, 1, nextPrng);
        nextPrng = drawnRes.prng;
        const topCard = drawnRes.drawn[0];
        const restoredHand = drawnRes.player.hand.slice(0, beforeHandLen);
        nextPlayers[pending.playerId] = {
          ...drawnRes.player,
          hand: restoredHand,
          nativeVillageMat: topCard
            ? [...(targetPlayer.nativeVillageMat ?? []), topCard]
            : [...(targetPlayer.nativeVillageMat ?? [])],
        };
        return {
          ...state,
          players: nextPlayers,
          prng: nextPrng,
          pendingInteraction: null,
          lastActionSummary: topCard
            ? `${pending.playerId} set aside the top card of their deck onto their Native Village Mat.`
            : `${pending.playerId} chose to set aside onto Native Village Mat (deck & discard empty).`,
        };
      }

      case 'PIRATE_SHIP_CHOICE': {
        const choice = action.choice ?? 'PIRATE_ATTACK';
        if (choice === 'PIRATE_COINS') {
          const tokens = targetPlayer.pirateShipTokens ?? 0;
          nextPlayers[pending.playerId] = {
            ...targetPlayer,
            coins: targetPlayer.coins + tokens,
          };
          return {
            ...state,
            players: nextPlayers,
            pendingInteraction: null,
            lastActionSummary: `${pending.playerId} took +${tokens} Coin(s) from their Pirate Ship Mat.`,
          };
        }
        // PIRATE_ATTACK: Each other non-immune player reveals top 2 cards of deck, trashes 1 Treasure, discards rest; if any trashed, +1 Gold Coin token
        let anyTreasureTrashed = false;
        const n = state.playerOrder.length;
        for (let offset = 1; offset < n; offset++) {
          const oppId =
            state.playerOrder[(state.activePlayerIndex + offset) % n]!;
          const opp = nextPlayers[oppId]!;
          if (isPlayerImmuneToAttack(opp)) continue;
          const beforeLen = opp.hand.length;
          const peekRes = drawCardsForPlayer(opp, 2, nextPrng);
          nextPrng = peekRes.prng;
          const revealed = peekRes.drawn;
          const restoredHand = peekRes.player.hand.slice(0, beforeLen);
          // Trash highest-cost revealed Treasure
          let bestTreasureIdx = -1;
          for (let i = 0; i < revealed.length; i++) {
            if (revealed[i]!.types.includes('TREASURE')) {
              if (
                bestTreasureIdx === -1 ||
                revealed[i]!.cost > revealed[bestTreasureIdx]!.cost
              ) {
                bestTreasureIdx = i;
              }
            }
          }
          const toDiscard: Card[] = [];
          for (let i = 0; i < revealed.length; i++) {
            if (i === bestTreasureIdx) {
              nextTrash = [...nextTrash, revealed[i]!];
              anyTreasureTrashed = true;
            } else {
              toDiscard.push(revealed[i]!);
            }
          }
          nextPlayers[oppId] = {
            ...peekRes.player,
            hand: restoredHand,
            discard: [...peekRes.player.discard, ...toDiscard],
          };
        }

        const nextTokens =
          (targetPlayer.pirateShipTokens ?? 0) + (anyTreasureTrashed ? 1 : 0);
        nextPlayers[pending.playerId] = {
          ...nextPlayers[pending.playerId]!,
          pirateShipTokens: nextTokens,
        };

        return {
          ...state,
          players: nextPlayers,
          trash: nextTrash,
          prng: nextPrng,
          pendingInteraction: null,
          lastActionSummary: anyTreasureTrashed
            ? `${pending.playerId} attacked with Pirate Ship, trashed an opponent's Treasure, and added a Gold Coin token to their Pirate Ship Mat (now ${nextTokens})!`
            : `${pending.playerId} attacked with Pirate Ship (no opponent Treasures revealed).`,
        };
      }

      case 'TRASH_UP_TO_N': {
        const selected = action.selectedCardIds ?? [];
        const removed = removeCardsFromHand(targetPlayer.hand, selected);
        nextPlayers[pending.playerId] = {
          ...targetPlayer,
          hand: removed.remainingHand,
        };
        nextTrash = [...nextTrash, ...removed.removedCards];

        return {
          ...state,
          players: nextPlayers,
          trash: nextTrash,
          pendingInteraction: null,
          lastActionSummary: `${pending.playerId} trashed ${removed.removedCards.length} card(s) with ${pending.sourceCard.name}.`,
        };
      }

      case 'ATTACK_DEFENSE_OR_DISCARD': {
        const queue = pending.remainingTargetQueue ?? [];
        if (action.revealMoat) {
          const nextPending = buildNextMilitiaInteraction(
            nextPlayers,
            pending.sourceCard,
            queue
          );
          const waitingCount = nextPending
            ? 1 + (nextPending.remainingTargetQueue?.length ?? 0)
            : 0;
          const waitingSuffix =
            waitingCount === 1 && nextPending
              ? ` Waiting for "${nextPending.playerId}" to discard.`
              : waitingCount > 1
              ? ' Waiting for other players to discard.'
              : '';
          return {
            ...state,
            pendingInteraction: nextPending,
            lastActionSummary: `${pending.playerId} revealed Moat and is unaffected by ${pending.sourceCard.name}!${waitingSuffix}`,
          };
        }

        const selected = action.selectedCardIds ?? [];
        const removed = removeCardsFromHand(targetPlayer.hand, selected);
        nextPlayers[pending.playerId] = {
          ...targetPlayer,
          hand: removed.remainingHand,
          discard: [...targetPlayer.discard, ...removed.removedCards],
        };

        const nextPending = buildNextMilitiaInteraction(
          nextPlayers,
          pending.sourceCard,
          queue
        );
        const waitingCount = nextPending
          ? 1 + (nextPending.remainingTargetQueue?.length ?? 0)
          : 0;
        const waitingSuffix =
          waitingCount === 1 && nextPending
            ? ` Waiting for "${nextPending.playerId}" to discard.`
            : waitingCount > 1
            ? ' Waiting for other players to discard.'
            : '';

        return {
          ...state,
          players: nextPlayers,
          pendingInteraction: nextPending,
          lastActionSummary: `${pending.playerId} discarded ${removed.removedCards.length} card(s) down to 3 in hand (${pending.sourceCard.name}).${waitingSuffix}`,
        };
      }

      case 'GAIN_COSTING_UP_TO': {
        const gainId = (
          action.gainedCardId ??
          action.selectedCardIds?.[0] ??
          ''
        )
          .trim()
          .toLowerCase();
        const gainedCard = getDominionCard(gainId)!;
        nextSupply[gainedCard.id] = (nextSupply[gainedCard.id] ?? 1) - 1;

        if (pending.gainDestination === 'HAND') {
          nextPlayers[pending.playerId] = {
            ...targetPlayer,
            hand: [...targetPlayer.hand, gainedCard],
            gainedCardsThisTurn: [
              ...(targetPlayer.gainedCardsThisTurn ?? []),
              gainedCard,
            ],
          };
        } else if (pending.gainDestination === 'HAVEN') {
          nextPlayers[pending.playerId] = {
            ...targetPlayer,
            havenSetAside: [
              ...(targetPlayer.havenSetAside ?? []),
              gainedCard,
            ],
            gainedCardsThisTurn: [
              ...(targetPlayer.gainedCardsThisTurn ?? []),
              gainedCard,
            ],
          };
        } else {
          nextPlayers[pending.playerId] = {
            ...targetPlayer,
            discard: [...targetPlayer.discard, gainedCard],
            gainedCardsThisTurn: [
              ...(targetPlayer.gainedCardsThisTurn ?? []),
              gainedCard,
            ],
          };
        }

        // If this was Artisan (gain to hand costing up to 5), follow up with PUT_CARD_ONTO_DECK
        const nextPending: PendingInteraction | null =
          pending.sourceCard.customEffectId === 'ARTISAN' &&
          nextPlayers[pending.playerId]!.hand.length > 0
            ? {
                playerId: pending.playerId,
                sourceCard: pending.sourceCard,
                promptType: 'PUT_CARD_ONTO_DECK',
                minCount: 1,
                maxCount: 1,
              }
            : null;

        const updatedState: DominionGameState = {
          ...state,
          players: nextPlayers,
          supply: nextSupply,
          pendingInteraction: nextPending,
        };
        return finalizeStateIfGameOver(
          updatedState,
          `${pending.playerId} gained ${gainedCard.name} via ${pending.sourceCard.name}.`
        );
      }

      case 'TRASH_AND_UPGRADE': {
        const trashId = (
          action.trashedCardId ??
          action.selectedCardIds?.[0] ??
          ''
        )
          .trim()
          .toLowerCase();

        if (!trashId) {
          return {
            ...state,
            pendingInteraction: null,
            lastActionSummary: `${pending.playerId} chose not to trash a card with ${pending.sourceCard.name}.`,
          };
        }

        const removed = removeCardsFromHand(targetPlayer.hand, [trashId]);
        const trashedCard = removed.removedCards[0]!;
        nextTrash = [...nextTrash, trashedCard];
        const maxAllowedCost =
          trashedCard.cost + (pending.upgradeMaxCostDelta ?? 2);

        // If gainedCardId was provided in the same action, complete both Trash and Gain immediately
        if (action.gainedCardId !== undefined) {
          const gainedCard = getDominionCard(action.gainedCardId)!;
          nextSupply[gainedCard.id] = (nextSupply[gainedCard.id] ?? 1) - 1;

          if (pending.gainDestination === 'HAND') {
            nextPlayers[pending.playerId] = {
              ...targetPlayer,
              hand: [...removed.remainingHand, gainedCard],
            };
          } else {
            nextPlayers[pending.playerId] = {
              ...targetPlayer,
              hand: removed.remainingHand,
              discard: [...targetPlayer.discard, gainedCard],
            };
          }

          const updatedState: DominionGameState = {
            ...state,
            players: nextPlayers,
            supply: nextSupply,
            trash: nextTrash,
            pendingInteraction: null,
          };
          return finalizeStateIfGameOver(
            updatedState,
            `${pending.playerId} trashed ${trashedCard.name} and gained ${gainedCard.name} with ${pending.sourceCard.name}.`
          );
        }

        // Otherwise, transition to GAIN_COSTING_UP_TO for step 2
        nextPlayers[pending.playerId] = {
          ...targetPlayer,
          hand: removed.remainingHand,
        };

        return {
          ...state,
          players: nextPlayers,
          trash: nextTrash,
          pendingInteraction: {
            playerId: pending.playerId,
            sourceCard: pending.sourceCard,
            promptType: 'GAIN_COSTING_UP_TO',
            minCount: 1,
            maxCount: 1,
            maxCost: maxAllowedCost,
            ...(pending.restrictedCardKind
              ? { restrictedCardKind: pending.restrictedCardKind }
              : {}),
            gainDestination: pending.gainDestination ?? 'DISCARD',
          },
          lastActionSummary: `${pending.playerId} trashed ${trashedCard.name} with ${pending.sourceCard.name} (now select a card costing up to ${maxAllowedCost}).`,
        };
      }
    }
  }

  // =========================================================================
  // 2. PLAY_ACTION_CARD
  // =========================================================================
  if (action.type === 'PLAY_ACTION_CARD') {
    const player = state.players[playerId]!;
    const removed = removeCardsFromHand(player.hand, [action.cardId]);
    const card = removed.removedCards[0]!;
    const isDurationCard = card.types.includes('DURATION');

    let updatedPlayer: DominionPlayerState = {
      ...player,
      hand: removed.remainingHand,
      inPlay: [...player.inPlay, card],
      durationCards: isDurationCard
        ? [...(player.durationCards ?? []), card]
        : [...(player.durationCards ?? [])],
      actions: player.actions - 1 + card.actions,
      buys: player.buys + card.buys,
      coins: player.coins + card.coins,
      merchantsPlayedThisTurn:
        card.customEffectId === 'MERCHANT'
          ? player.merchantsPlayedThisTurn + 1
          : player.merchantsPlayedThisTurn,
    };

    let nextPrng = state.prng;
    if (card.cards > 0) {
      const drawRes = drawCardsForPlayer(updatedPlayer, card.cards, nextPrng);
      updatedPlayer = drawRes.player;
      nextPrng = drawRes.prng;
    }

    const nextPlayers: Record<string, DominionPlayerState> = {
      ...state.players,
      [playerId]: updatedPlayer,
    };
    const nextSupply: Record<string, number> = { ...state.supply };
    let nextTrash = [...state.trash];
    let pendingInteraction: PendingInteraction | null = null;
    let summaryText = `${playerId} played ${card.name}.`;

    switch (card.customEffectId) {
      // --- 1ST EDITION BASE DOMINION CARDS ---
      case 'ADVENTURER': {
        const revealedTreasures: Card[] = [];
        const otherRevealed: Card[] = [];
        let safety = 0;
        let curr = updatedPlayer;
        while (
          revealedTreasures.length < 2 &&
          (curr.deck.length > 0 || curr.discard.length > 0) &&
          safety < 60
        ) {
          const beforeLen = curr.hand.length;
          const drawOne = drawCardsForPlayer(curr, 1, nextPrng);
          nextPrng = drawOne.prng;
          const top = drawOne.drawn[0];
          const restoredHand = drawOne.player.hand.slice(0, beforeLen);
          curr = {
            ...drawOne.player,
            hand: restoredHand,
          };
          if (!top) break;
          if (top.types.includes('TREASURE')) {
            revealedTreasures.push(top);
          } else {
            otherRevealed.push(top);
          }
          safety += 1;
        }
        updatedPlayer = {
          ...curr,
          hand: [...curr.hand, ...revealedTreasures],
          discard: [...curr.discard, ...otherRevealed],
        };
        nextPlayers[playerId] = updatedPlayer;
        summaryText += ` Put ${revealedTreasures.length} Treasure(s) into hand and discarded ${otherRevealed.length} other card(s).`;
        break;
      }

      case 'CHANCELLOR': {
        updatedPlayer = {
          ...updatedPlayer,
          discard: [...updatedPlayer.discard, ...updatedPlayer.deck],
          deck: [],
        };
        nextPlayers[playerId] = updatedPlayer;
        summaryText += ' Put deck into discard pile.';
        break;
      }

      case 'FEAST': {
        // Trash Feast from inPlay and gain a card costing up to 5
        const inPlayWithoutFeast = [...updatedPlayer.inPlay];
        const feastIdx = inPlayWithoutFeast.findIndex((c) => c.id === 'feast');
        if (feastIdx !== -1) {
          const [trashedFeast] = inPlayWithoutFeast.splice(feastIdx, 1);
          if (trashedFeast) {
            nextTrash = [...nextTrash, trashedFeast];
          }
        }
        updatedPlayer = {
          ...updatedPlayer,
          inPlay: inPlayWithoutFeast,
        };
        nextPlayers[playerId] = updatedPlayer;
        const hasGainable5 = Object.entries(nextSupply).some(([cid, count]) => {
          const def = getDominionCard(cid);
          return count > 0 && def !== undefined && def.cost <= 5;
        });
        if (hasGainable5) {
          pendingInteraction = {
            playerId,
            sourceCard: card,
            promptType: 'GAIN_COSTING_UP_TO',
            minCount: 1,
            maxCount: 1,
            maxCost: 5,
            gainDestination: 'DISCARD',
          };
        }
        summaryText += ' Trashed Feast to gain a card costing up to 5.';
        break;
      }

      case 'SPY': {
        const n = state.playerOrder.length;
        for (let offset = 0; offset < n; offset++) {
          const targetId =
            state.playerOrder[(state.activePlayerIndex + offset) % n]!;
          const target = nextPlayers[targetId]!;
          if (offset > 0 && isPlayerImmuneToAttack(target)) {
            continue;
          }
          const beforeLen = target.hand.length;
          const peekOne = drawCardsForPlayer(target, 1, nextPrng);
          nextPrng = peekOne.prng;
          const topCard = peekOne.drawn[0];
          const restoredHand = peekOne.player.hand.slice(0, beforeLen);
          if (!topCard) continue;
          // For self: discard Victory/Curse/Copper, keep Action/Silver/Gold on top; for opponents: discard Action/Gold/Silver, keep Victory/Curse/Copper on top
          const isJunk =
            topCard.types.includes('VICTORY') ||
            topCard.types.includes('CURSE') ||
            topCard.id === 'copper';
          const shouldDiscard = offset === 0 ? isJunk : !isJunk;
          if (shouldDiscard) {
            nextPlayers[targetId] = {
              ...peekOne.player,
              hand: restoredHand,
              discard: [...peekOne.player.discard, topCard],
            };
          } else {
            nextPlayers[targetId] = {
              ...peekOne.player,
              hand: restoredHand,
              deck: [topCard, ...peekOne.player.deck],
            };
          }
        }
        break;
      }

      case 'THIEF': {
        const n = state.playerOrder.length;
        const gainedTreasures: Card[] = [];
        for (let offset = 1; offset < n; offset++) {
          const oppId =
            state.playerOrder[(state.activePlayerIndex + offset) % n]!;
          const opp = nextPlayers[oppId]!;
          if (isPlayerImmuneToAttack(opp)) continue;
          const beforeLen = opp.hand.length;
          const peekTwo = drawCardsForPlayer(opp, 2, nextPrng);
          nextPrng = peekTwo.prng;
          const revealed = peekTwo.drawn;
          const restoredHand = peekTwo.player.hand.slice(0, beforeLen);
          let bestTreasureIdx = -1;
          for (let i = 0; i < revealed.length; i++) {
            if (revealed[i]!.types.includes('TREASURE')) {
              if (
                bestTreasureIdx === -1 ||
                revealed[i]!.cost > revealed[bestTreasureIdx]!.cost
              ) {
                bestTreasureIdx = i;
              }
            }
          }
          const toDiscard: Card[] = [];
          for (let i = 0; i < revealed.length; i++) {
            if (i === bestTreasureIdx) {
              const stolen = revealed[i]!;
              if (stolen.id !== 'copper') {
                gainedTreasures.push(stolen);
              } else {
                nextTrash = [...nextTrash, stolen];
              }
            } else {
              toDiscard.push(revealed[i]!);
            }
          }
          nextPlayers[oppId] = {
            ...peekTwo.player,
            hand: restoredHand,
            discard: [...peekTwo.player.discard, ...toDiscard],
          };
        }
        if (gainedTreasures.length > 0) {
          updatedPlayer = {
            ...nextPlayers[playerId]!,
            discard: [
              ...nextPlayers[playerId]!.discard,
              ...gainedTreasures,
            ],
          };
          nextPlayers[playerId] = updatedPlayer;
          summaryText += ` Gained ${gainedTreasures.map((c) => c.name).join(', ')}!`;
        }
        break;
      }

      // --- SEASIDE KINGDOM CARDS ---
      case 'AMBASSADOR': {
        if (updatedPlayer.hand.length > 0) {
          pendingInteraction = {
            playerId,
            sourceCard: card,
            promptType: 'AMBASSADOR_RETURN',
            minCount: 1,
            maxCount: Math.min(2, updatedPlayer.hand.length),
          };
        }
        break;
      }

      case 'BLOCKADE': {
        const hasGainable4 = Object.entries(nextSupply).some(([cid, count]) => {
          const def = getDominionCard(cid);
          return count > 0 && def !== undefined && def.cost <= 4;
        });
        if (hasGainable4) {
          pendingInteraction = {
            playerId,
            sourceCard: card,
            promptType: 'GAIN_COSTING_UP_TO',
            minCount: 1,
            maxCount: 1,
            maxCost: 4,
            gainDestination: 'HAVEN',
          };
        }
        break;
      }

      case 'CUTPURSE': {
        const n = state.playerOrder.length;
        for (let offset = 1; offset < n; offset++) {
          const oppId =
            state.playerOrder[(state.activePlayerIndex + offset) % n]!;
          const opp = nextPlayers[oppId]!;
          if (isPlayerImmuneToAttack(opp)) continue;
          const hasCopper = opp.hand.some((c) => c.id === 'copper');
          if (hasCopper) {
            const remCopper = removeCardsFromHand(opp.hand, ['copper']);
            nextPlayers[oppId] = {
              ...opp,
              hand: remCopper.remainingHand,
              discard: [...opp.discard, ...remCopper.removedCards],
            };
          }
        }
        break;
      }

      case 'EMBARGO': {
        // Trash Embargo from inPlay and prompt for a Supply pile to add an Embargo token
        const inPlayWithoutEmbargo = [...updatedPlayer.inPlay];
        const embIdx = inPlayWithoutEmbargo.findIndex(
          (c) => c.id === 'embargo'
        );
        if (embIdx !== -1) {
          const [trashedEmbargo] = inPlayWithoutEmbargo.splice(embIdx, 1);
          if (trashedEmbargo) {
            nextTrash = [...nextTrash, trashedEmbargo];
          }
        }
        updatedPlayer = {
          ...updatedPlayer,
          inPlay: inPlayWithoutEmbargo,
        };
        nextPlayers[playerId] = updatedPlayer;
        pendingInteraction = {
          playerId,
          sourceCard: card,
          promptType: 'EMBARGO_PILE',
          minCount: 1,
          maxCount: 1,
        };
        break;
      }

      case 'EXPLORER': {
        const hasProvince = updatedPlayer.hand.some(
          (c) => c.id === 'province'
        );
        const targetGainId = hasProvince ? 'gold' : 'silver';
        if ((nextSupply[targetGainId] ?? 0) > 0) {
          const gained = DOMINION_CARDS[targetGainId]!;
          nextSupply[targetGainId] = (nextSupply[targetGainId] ?? 1) - 1;
          updatedPlayer = {
            ...updatedPlayer,
            hand: [...updatedPlayer.hand, gained],
            gainedCardsThisTurn: [
              ...(updatedPlayer.gainedCardsThisTurn ?? []),
              gained,
            ],
          };
          nextPlayers[playerId] = updatedPlayer;
          summaryText += hasProvince
            ? ' Revealed Province and gained a Gold to hand!'
            : ' Gained a Silver to hand.';
        }
        break;
      }

      case 'GHOST_SHIP': {
        const targets: string[] = [];
        const n = state.playerOrder.length;
        for (let offset = 1; offset < n; offset++) {
          const oppId =
            state.playerOrder[(state.activePlayerIndex + offset) % n]!;
          const opp = nextPlayers[oppId]!;
          if (isPlayerImmuneToAttack(opp)) continue;
          if (opp.hand.length >= 4) {
            targets.push(oppId);
          }
        }
        pendingInteraction = buildNextGhostShipInteraction(
          nextPlayers,
          card,
          targets
        );
        break;
      }

      case 'HAVEN': {
        if (updatedPlayer.hand.length > 0) {
          pendingInteraction = {
            playerId,
            sourceCard: card,
            promptType: 'HAVEN_SET_ASIDE',
            minCount: 1,
            maxCount: 1,
          };
        }
        break;
      }

      case 'ISLAND': {
        // Move Island from inPlay onto Island Mat, and prompt to set aside 1 card from hand onto Island Mat
        const inPlayWithoutIsland = [...updatedPlayer.inPlay];
        const islIdx = inPlayWithoutIsland.findIndex((c) => c.id === 'island');
        if (islIdx !== -1) {
          inPlayWithoutIsland.splice(islIdx, 1);
        }
        updatedPlayer = {
          ...updatedPlayer,
          inPlay: inPlayWithoutIsland,
          islandMat: [...(updatedPlayer.islandMat ?? []), card],
        };
        nextPlayers[playerId] = updatedPlayer;
        if (updatedPlayer.hand.length > 0) {
          pendingInteraction = {
            playerId,
            sourceCard: card,
            promptType: 'ISLAND_SET_ASIDE',
            minCount: 1,
            maxCount: 1,
          };
        }
        summaryText += ' Placed Island onto Island Mat.';
        break;
      }

      case 'LOOKOUT': {
        const beforeLen = updatedPlayer.hand.length;
        const peekThree = drawCardsForPlayer(updatedPlayer, 3, nextPrng);
        nextPrng = peekThree.prng;
        const revealed = [...peekThree.drawn];
        const restoredHand = peekThree.player.hand.slice(0, beforeLen);
        // Sort revealed ascending by cost: lowest trashed, middle discarded, highest kept on deck
        revealed.sort((a, b) => a.cost - b.cost);
        const trashedOne = revealed[0];
        const discardedOne = revealed[1];
        const topOne = revealed[2];
        if (trashedOne) {
          nextTrash = [...nextTrash, trashedOne];
        }
        updatedPlayer = {
          ...peekThree.player,
          hand: restoredHand,
          discard: discardedOne
            ? [...peekThree.player.discard, discardedOne]
            : [...peekThree.player.discard],
          deck: topOne ? [topOne, ...peekThree.player.deck] : [...peekThree.player.deck],
        };
        nextPlayers[playerId] = updatedPlayer;
        break;
      }

      case 'NATIVE_VILLAGE': {
        pendingInteraction = {
          playerId,
          sourceCard: card,
          promptType: 'NATIVE_VILLAGE_CHOICE',
          minCount: 0,
          maxCount: 0,
        };
        break;
      }

      case 'NAVIGATOR': {
        const beforeLen = updatedPlayer.hand.length;
        const peekFive = drawCardsForPlayer(updatedPlayer, 5, nextPrng);
        nextPrng = peekFive.prng;
        const revealed = peekFive.drawn;
        const restoredHand = peekFive.player.hand.slice(0, beforeLen);
        const junkCount = revealed.filter(
          (c) =>
            c.types.includes('VICTORY') ||
            c.types.includes('CURSE') ||
            c.id === 'copper'
        ).length;
        if (junkCount >= 3) {
          updatedPlayer = {
            ...peekFive.player,
            hand: restoredHand,
            discard: [...peekFive.player.discard, ...revealed],
          };
          summaryText += ` Discarded all ${revealed.length} looked-at cards.`;
        } else {
          const ordered = [...revealed].sort((a, b) => b.cost - a.cost);
          updatedPlayer = {
            ...peekFive.player,
            hand: restoredHand,
            deck: [...ordered, ...peekFive.player.deck],
          };
          summaryText += ` Returned ${revealed.length} cards to top of deck.`;
        }
        nextPlayers[playerId] = updatedPlayer;
        break;
      }

      case 'OUTPOST': {
        if (!updatedPlayer.outpostPlayedThisTurn && !updatedPlayer.isOutpostTurn) {
          updatedPlayer = {
            ...updatedPlayer,
            outpostPlayedThisTurn: true,
          };
          nextPlayers[playerId] = updatedPlayer;
          summaryText += ' Will take an extra 3-card turn after this one!';
        }
        break;
      }

      case 'PEARL_DIVER': {
        if (updatedPlayer.deck.length > 0) {
          const bottomCard =
            updatedPlayer.deck[updatedPlayer.deck.length - 1]!;
          const shouldMoveToTop =
            bottomCard.types.includes('ACTION') || bottomCard.cost >= 3;
          if (shouldMoveToTop) {
            updatedPlayer = {
              ...updatedPlayer,
              deck: [
                bottomCard,
                ...updatedPlayer.deck.slice(0, updatedPlayer.deck.length - 1),
              ],
            };
            nextPlayers[playerId] = updatedPlayer;
            summaryText += ` Moved ${bottomCard.name} from bottom to top of deck.`;
          }
        }
        break;
      }

      case 'PIRATE_SHIP': {
        pendingInteraction = {
          playerId,
          sourceCard: card,
          promptType: 'PIRATE_SHIP_CHOICE',
          minCount: 0,
          maxCount: 0,
        };
        break;
      }

      case 'SALVAGER': {
        if (updatedPlayer.hand.length > 0) {
          pendingInteraction = {
            playerId,
            sourceCard: card,
            promptType: 'SALVAGER_TRASH',
            minCount: 1,
            maxCount: 1,
          };
        }
        break;
      }

      case 'SEA_CHART': {
        const beforeLen = updatedPlayer.hand.length;
        const peekOne = drawCardsForPlayer(updatedPlayer, 1, nextPrng);
        nextPrng = peekOne.prng;
        const topCard = peekOne.drawn[0];
        const restoredHand = peekOne.player.hand.slice(0, beforeLen);
        if (topCard) {
          const hasCopyInPlay = peekOne.player.inPlay.some(
            (c) => c.id === topCard.id
          );
          if (hasCopyInPlay) {
            updatedPlayer = {
              ...peekOne.player,
              hand: [...restoredHand, topCard],
            };
            summaryText += ` Revealed ${topCard.name} (copy in play) and put it into hand!`;
          } else {
            updatedPlayer = {
              ...peekOne.player,
              hand: restoredHand,
              deck: [topCard, ...peekOne.player.deck],
            };
            summaryText += ` Revealed ${topCard.name} and left it on top of deck.`;
          }
          nextPlayers[playerId] = updatedPlayer;
        }
        break;
      }

      case 'SEA_HAG': {
        const n = state.playerOrder.length;
        for (let offset = 1; offset < n; offset++) {
          const oppId =
            state.playerOrder[(state.activePlayerIndex + offset) % n]!;
          const opp = nextPlayers[oppId]!;
          if (isPlayerImmuneToAttack(opp)) continue;
          const beforeLen = opp.hand.length;
          const peekOne = drawCardsForPlayer(opp, 1, nextPrng);
          nextPrng = peekOne.prng;
          const discardedTop = peekOne.drawn[0];
          const restoredHand = peekOne.player.hand.slice(0, beforeLen);
          let nextOppDeck = [...peekOne.player.deck];
          const nextOppDiscard = discardedTop
            ? [...peekOne.player.discard, discardedTop]
            : [...peekOne.player.discard];
          if ((nextSupply['curse'] ?? 0) > 0) {
            nextSupply['curse'] = (nextSupply['curse'] ?? 1) - 1;
            nextOppDeck = [DOMINION_CARDS['curse']!, ...nextOppDeck];
          }
          nextPlayers[oppId] = {
            ...peekOne.player,
            hand: restoredHand,
            discard: nextOppDiscard,
            deck: nextOppDeck,
          };
        }
        summaryText += ' Opponents discarded top card and gained a Curse onto deck!';
        break;
      }

      case 'SEA_WITCH': {
        const n = state.playerOrder.length;
        for (let offset = 1; offset < n; offset++) {
          const oppId =
            state.playerOrder[(state.activePlayerIndex + offset) % n]!;
          const opp = nextPlayers[oppId]!;
          if (isPlayerImmuneToAttack(opp)) continue;
          if ((nextSupply['curse'] ?? 0) > 0) {
            nextSupply['curse'] = (nextSupply['curse'] ?? 1) - 1;
            nextPlayers[oppId] = {
              ...opp,
              discard: [...opp.discard, DOMINION_CARDS['curse']!],
            };
          }
        }
        break;
      }

      case 'SMUGGLERS': {
        const n = state.playerOrder.length;
        const rightPlayerIndex = (state.activePlayerIndex + n - 1) % n;
        const rightPlayerId = state.playerOrder[rightPlayerIndex]!;
        const rightPlayer = nextPlayers[rightPlayerId]!;
        const eligibleFromRight = (rightPlayer.gainedCardsLastTurn ?? []).filter(
          (c) => c.cost <= 6 && (nextSupply[c.id] ?? 0) > 0
        );
        if (eligibleFromRight.length > 0) {
          eligibleFromRight.sort((a, b) => b.cost - a.cost);
          const chosen = eligibleFromRight[0]!;
          nextSupply[chosen.id] = (nextSupply[chosen.id] ?? 1) - 1;
          updatedPlayer = {
            ...updatedPlayer,
            discard: [...updatedPlayer.discard, chosen],
            gainedCardsThisTurn: [
              ...(updatedPlayer.gainedCardsThisTurn ?? []),
              chosen,
            ],
          };
          nextPlayers[playerId] = updatedPlayer;
          summaryText += ` Smuggled a copy of ${chosen.name}!`;
        } else {
          // If right player has no tracked last-turn gains, allow gaining a card costing up to 6
          const hasGainable6 = Object.entries(nextSupply).some(([cid, count]) => {
            const def = getDominionCard(cid);
            return count > 0 && def !== undefined && def.cost <= 6;
          });
          if (hasGainable6) {
            pendingInteraction = {
              playerId,
              sourceCard: card,
              promptType: 'GAIN_COSTING_UP_TO',
              minCount: 1,
              maxCount: 1,
              maxCost: 6,
              gainDestination: 'DISCARD',
            };
          }
        }
        break;
      }

      case 'TACTICIAN': {
        if (updatedPlayer.hand.length > 0) {
          updatedPlayer = {
            ...updatedPlayer,
            discard: [...updatedPlayer.discard, ...updatedPlayer.hand],
            hand: [],
            tacticianPending: true,
          };
          nextPlayers[playerId] = updatedPlayer;
          summaryText +=
            ' Discarded hand — will gain +5 Cards, +1 Action, +1 Buy at the start of next turn!';
        }
        break;
      }

      case 'TREASURE_MAP': {
        const secondMapInHand = updatedPlayer.hand.some(
          (c) => c.id === 'treasure_map'
        );
        // Remove played Treasure Map from inPlay into trash
        const inPlayWithoutMap = [...updatedPlayer.inPlay];
        const mapIdx = inPlayWithoutMap.findIndex(
          (c) => c.id === 'treasure_map'
        );
        if (mapIdx !== -1) {
          const [trashedFirst] = inPlayWithoutMap.splice(mapIdx, 1);
          if (trashedFirst) {
            nextTrash = [...nextTrash, trashedFirst];
          }
        }
        if (secondMapInHand) {
          const remSecond = removeCardsFromHand(updatedPlayer.hand, [
            'treasure_map',
          ]);
          nextTrash = [...nextTrash, ...remSecond.removedCards];
          const goldsToGain = Math.min(4, nextSupply['gold'] ?? 0);
          nextSupply['gold'] = (nextSupply['gold'] ?? 0) - goldsToGain;
          const goldCards = Array.from(
            { length: goldsToGain },
            () => DOMINION_CARDS['gold']!
          );
          updatedPlayer = {
            ...updatedPlayer,
            inPlay: inPlayWithoutMap,
            hand: remSecond.remainingHand,
            deck: [...goldCards, ...updatedPlayer.deck],
            gainedCardsThisTurn: [
              ...(updatedPlayer.gainedCardsThisTurn ?? []),
              ...goldCards,
            ],
          };
          summaryText += ` Trashed two Treasure Maps and gained ${goldsToGain} Gold(s) onto top of deck!`;
        } else {
          updatedPlayer = {
            ...updatedPlayer,
            inPlay: inPlayWithoutMap,
          };
          summaryText +=
            ' Trashed 1 Treasure Map (no second Treasure Map in hand).';
        }
        nextPlayers[playerId] = updatedPlayer;
        break;
      }

      case 'WAREHOUSE': {
        if (updatedPlayer.hand.length > 0) {
          const reqDiscard = Math.min(3, updatedPlayer.hand.length);
          pendingInteraction = {
            playerId,
            sourceCard: card,
            promptType: 'DISCARD_EXACT_COUNT',
            minCount: reqDiscard,
            maxCount: reqDiscard,
          };
        }
        break;
      }
      case 'ARTISAN': {
        const hasGainable = Object.entries(nextSupply).some(([cid, count]) => {
          const def = getDominionCard(cid);
          return count > 0 && def !== undefined && def.cost <= 5;
        });
        if (hasGainable) {
          pendingInteraction = {
            playerId,
            sourceCard: card,
            promptType: 'GAIN_COSTING_UP_TO',
            minCount: 1,
            maxCount: 1,
            maxCost: 5,
            gainDestination: 'HAND',
          };
        } else if (updatedPlayer.hand.length > 0) {
          pendingInteraction = {
            playerId,
            sourceCard: card,
            promptType: 'PUT_CARD_ONTO_DECK',
            minCount: 1,
            maxCount: 1,
          };
        }
        break;
      }

      case 'BANDIT': {
        if ((nextSupply['gold'] ?? 0) > 0) {
          nextSupply['gold'] = (nextSupply['gold'] ?? 1) - 1;
          updatedPlayer = {
            ...updatedPlayer,
            discard: [...updatedPlayer.discard, DOMINION_CARDS['gold']!],
          };
          nextPlayers[playerId] = updatedPlayer;
          summaryText += ' Gained a Gold.';
        }
        const n = state.playerOrder.length;
        for (let offset = 1; offset < n; offset++) {
          const oppId = state.playerOrder[(state.activePlayerIndex + offset) % n]!;
          const opp = nextPlayers[oppId]!;
          const hasMoat = opp.hand.some(
            (c) => c.id === 'moat' || c.customEffectId === 'MOAT'
          );
          if (hasMoat) {
            summaryText += ` (${oppId} revealed Moat!)`;
            continue;
          }
          // Reveal up to 2 cards from opp's deck (recycling if needed)
          const beforeHandLen = opp.hand.length;
          const drawnRes = drawCardsForPlayer(opp, 2, nextPrng);
          nextPrng = drawnRes.prng;
          const revealed = drawnRes.drawn;
          const restoredHand = drawnRes.player.hand.slice(0, beforeHandLen);
          // Find a non-Copper Treasure (prefer trashing Silver over Gold)
          const nonCopperIdx = revealed.findIndex(
            (c) => c.types.includes('TREASURE') && c.id !== 'copper'
          );
          const toDiscard: Card[] = [];
          for (let i = 0; i < revealed.length; i++) {
            if (i === nonCopperIdx) {
              nextTrash = [...nextTrash, revealed[i]!];
            } else {
              toDiscard.push(revealed[i]!);
            }
          }
          nextPlayers[oppId] = {
            ...drawnRes.player,
            hand: restoredHand,
            discard: [...drawnRes.player.discard, ...toDiscard],
          };
        }
        break;
      }

      case 'BUREAUCRAT': {
        if ((nextSupply['silver'] ?? 0) > 0) {
          nextSupply['silver'] = (nextSupply['silver'] ?? 1) - 1;
          updatedPlayer = {
            ...updatedPlayer,
            deck: [DOMINION_CARDS['silver']!, ...updatedPlayer.deck],
          };
          nextPlayers[playerId] = updatedPlayer;
          summaryText += ' Gained a Silver onto deck.';
        }
        const n = state.playerOrder.length;
        for (let offset = 1; offset < n; offset++) {
          const oppId = state.playerOrder[(state.activePlayerIndex + offset) % n]!;
          const opp = nextPlayers[oppId]!;
          const hasMoat = opp.hand.some(
            (c) => c.id === 'moat' || c.customEffectId === 'MOAT'
          );
          if (hasMoat) {
            summaryText += ` (${oppId} revealed Moat!)`;
            continue;
          }
          const victoryCard = opp.hand.find((c) => c.types.includes('VICTORY'));
          if (victoryCard) {
            const removedVic = removeCardsFromHand(opp.hand, [victoryCard.id]);
            nextPlayers[oppId] = {
              ...opp,
              hand: removedVic.remainingHand,
              deck: [...removedVic.removedCards, ...opp.deck],
            };
          }
        }
        break;
      }

      case 'CELLAR': {
        if (updatedPlayer.hand.length > 0) {
          pendingInteraction = {
            playerId,
            sourceCard: card,
            promptType: 'DISCARD_FOR_DRAW',
            minCount: 0,
            maxCount: updatedPlayer.hand.length,
          };
        }
        break;
      }

      case 'CHAPEL': {
        if (updatedPlayer.hand.length > 0) {
          pendingInteraction = {
            playerId,
            sourceCard: card,
            promptType: 'TRASH_UP_TO_N',
            minCount: 0,
            maxCount: Math.min(4, updatedPlayer.hand.length),
          };
        }
        break;
      }

      case 'COUNCIL_ROOM': {
        const n = state.playerOrder.length;
        for (let offset = 1; offset < n; offset++) {
          const oppId = state.playerOrder[(state.activePlayerIndex + offset) % n]!;
          const opp = nextPlayers[oppId]!;
          const drawOpp = drawCardsForPlayer(opp, 1, nextPrng);
          nextPlayers[oppId] = drawOpp.player;
          nextPrng = drawOpp.prng;
        }
        summaryText += ' Each other player drew 1 card.';
        break;
      }

      case 'HARBINGER': {
        if (updatedPlayer.discard.length > 0) {
          let bestIdx = 0;
          for (let i = 1; i < updatedPlayer.discard.length; i++) {
            if (updatedPlayer.discard[i]!.cost > updatedPlayer.discard[bestIdx]!.cost) {
              bestIdx = i;
            }
          }
          const chosen = updatedPlayer.discard[bestIdx]!;
          const nextDiscard = updatedPlayer.discard.filter((_, idx) => idx !== bestIdx);
          updatedPlayer = {
            ...updatedPlayer,
            discard: nextDiscard,
            deck: [chosen, ...updatedPlayer.deck],
          };
          nextPlayers[playerId] = updatedPlayer;
          summaryText += ` Put ${chosen.name} from discard onto deck.`;
        }
        break;
      }

      case 'LIBRARY': {
        let safety = 0;
        while (
          updatedPlayer.hand.length < 7 &&
          (updatedPlayer.deck.length > 0 || updatedPlayer.discard.length > 0) &&
          safety < 40
        ) {
          const drawRes = drawCardsForPlayer(updatedPlayer, 1, nextPrng);
          updatedPlayer = drawRes.player;
          nextPrng = drawRes.prng;
          safety += 1;
        }
        nextPlayers[playerId] = updatedPlayer;
        break;
      }

      case 'MONEYLENDER': {
        const hasCopper = updatedPlayer.hand.some((c) => c.id === 'copper');
        if (hasCopper) {
          const removedCopper = removeCardsFromHand(updatedPlayer.hand, ['copper']);
          updatedPlayer = {
            ...updatedPlayer,
            hand: removedCopper.remainingHand,
            coins: updatedPlayer.coins + 3,
          };
          nextPlayers[playerId] = updatedPlayer;
          nextTrash = [...nextTrash, ...removedCopper.removedCards];
          summaryText += ' Trashed a Copper for +3 Coins.';
        }
        break;
      }

      case 'POACHER': {
        let emptyPiles = 0;
        for (const count of Object.values(nextSupply)) {
          if (count <= 0) {
            emptyPiles += 1;
          }
        }
        if (emptyPiles > 0 && updatedPlayer.hand.length > 0) {
          const reqCount = Math.min(emptyPiles, updatedPlayer.hand.length);
          pendingInteraction = {
            playerId,
            sourceCard: card,
            promptType: 'DISCARD_EXACT_COUNT',
            minCount: reqCount,
            maxCount: reqCount,
          };
        }
        break;
      }

      case 'SENTRY': {
        const beforeHandLen = updatedPlayer.hand.length;
        const peekRes = drawCardsForPlayer(updatedPlayer, 2, nextPrng);
        nextPrng = peekRes.prng;
        const peeked = peekRes.drawn;
        const restoredHand = peekRes.player.hand.slice(0, beforeHandLen);
        const keptForDeck: Card[] = [];
        for (const c of peeked) {
          if (c.id === 'curse' || c.id === 'copper' || c.id === 'estate') {
            nextTrash = [...nextTrash, c];
          } else {
            keptForDeck.push(c);
          }
        }
        updatedPlayer = {
          ...peekRes.player,
          hand: restoredHand,
          deck: [...keptForDeck, ...peekRes.player.deck],
        };
        nextPlayers[playerId] = updatedPlayer;
        break;
      }

      case 'THRONE_ROOM': {
        const actionCardsInHand = updatedPlayer.hand.filter((c) =>
          c.types.includes('ACTION')
        );
        if (actionCardsInHand.length > 0) {
          actionCardsInHand.sort((a, b) => b.cost - a.cost);
          const targetAction = actionCardsInHand[0]!;
          const remTarget = removeCardsFromHand(updatedPlayer.hand, [
            targetAction.id,
          ]);
          updatedPlayer = {
            ...updatedPlayer,
            hand: remTarget.remainingHand,
            inPlay: [...updatedPlayer.inPlay, targetAction],
            actions: updatedPlayer.actions + targetAction.actions * 2,
            buys: updatedPlayer.buys + targetAction.buys * 2,
            coins: updatedPlayer.coins + targetAction.coins * 2,
            merchantsPlayedThisTurn:
              targetAction.customEffectId === 'MERCHANT'
                ? updatedPlayer.merchantsPlayedThisTurn + 2
                : updatedPlayer.merchantsPlayedThisTurn,
          };
          if (targetAction.cards > 0) {
            const drawTwice = drawCardsForPlayer(
              updatedPlayer,
              targetAction.cards * 2,
              nextPrng
            );
            updatedPlayer = drawTwice.player;
            nextPrng = drawTwice.prng;
          }
          nextPlayers[playerId] = updatedPlayer;
          summaryText += ` Played ${targetAction.name} twice!`;
        }
        break;
      }

      case 'VASSAL': {
        const beforeHandLen = updatedPlayer.hand.length;
        const topRes = drawCardsForPlayer(updatedPlayer, 1, nextPrng);
        nextPrng = topRes.prng;
        const revealedTop = topRes.drawn[0];
        const restoredHand = topRes.player.hand.slice(0, beforeHandLen);
        if (revealedTop) {
          if (revealedTop.types.includes('ACTION')) {
            updatedPlayer = {
              ...topRes.player,
              hand: restoredHand,
              inPlay: [...topRes.player.inPlay, revealedTop],
              actions: topRes.player.actions + revealedTop.actions,
              buys: topRes.player.buys + revealedTop.buys,
              coins: topRes.player.coins + revealedTop.coins,
            };
            if (revealedTop.cards > 0) {
              const vassalDraw = drawCardsForPlayer(
                updatedPlayer,
                revealedTop.cards,
                nextPrng
              );
              updatedPlayer = vassalDraw.player;
              nextPrng = vassalDraw.prng;
            }
            summaryText += ` Discarded and played ${revealedTop.name}!`;
          } else {
            updatedPlayer = {
              ...topRes.player,
              hand: restoredHand,
              discard: [...topRes.player.discard, revealedTop],
            };
            summaryText += ` Discarded ${revealedTop.name}.`;
          }
          nextPlayers[playerId] = updatedPlayer;
        }
        break;
      }

      case 'WORKSHOP': {
        const hasGainable = Object.entries(nextSupply).some(([cid, count]) => {
          const def = getDominionCard(cid);
          return count > 0 && def !== undefined && def.cost <= 4;
        });
        if (hasGainable) {
          pendingInteraction = {
            playerId,
            sourceCard: card,
            promptType: 'GAIN_COSTING_UP_TO',
            minCount: 1,
            maxCount: 1,
            maxCost: 4,
            gainDestination: 'DISCARD',
          };
        }
        break;
      }

      case 'REMODEL': {
        if (updatedPlayer.hand.length > 0) {
          pendingInteraction = {
            playerId,
            sourceCard: card,
            promptType: 'TRASH_AND_UPGRADE',
            minCount: 1,
            maxCount: 1,
            gainDestination: 'DISCARD',
            upgradeMaxCostDelta: 2,
          };
        }
        break;
      }

      case 'MINE': {
        const hasTreasureInHand = updatedPlayer.hand.some((c) =>
          c.types.includes('TREASURE')
        );
        if (hasTreasureInHand) {
          pendingInteraction = {
            playerId,
            sourceCard: card,
            promptType: 'TRASH_AND_UPGRADE',
            minCount: 0,
            maxCount: 1,
            restrictedCardKind: 'TREASURE',
            gainDestination: 'HAND',
            upgradeMaxCostDelta: 3,
          };
        }
        break;
      }

      case 'MILITIA': {
        // Check opponents in clockwise turn order for Moat immunity
        const nonImmuneTargets: string[] = [];
        const immuneNames: string[] = [];
        const n = state.playerOrder.length;
        for (let offset = 1; offset < n; offset++) {
          const oppId = state.playerOrder[(state.activePlayerIndex + offset) % n]!;
          const opp = nextPlayers[oppId]!;
          const hasMoat = opp.hand.some(
            (c) => c.id === 'moat' || c.customEffectId === 'MOAT'
          );
          if (hasMoat) {
            immuneNames.push(oppId);
          } else if (opp.hand.length > 3) {
            nonImmuneTargets.push(oppId);
          }
        }

        pendingInteraction = buildNextMilitiaInteraction(
          nextPlayers,
          card,
          nonImmuneTargets
        );

        if (immuneNames.length > 0) {
          summaryText += ` (${immuneNames.join(', ')} revealed Moat and ignored the attack!)`;
        }
        if (pendingInteraction) {
          const waitingCount =
            1 + (pendingInteraction.remainingTargetQueue?.length ?? 0);
          if (waitingCount === 1) {
            summaryText += ` Waiting for "${pendingInteraction.playerId}" to discard.`;
          } else if (waitingCount > 1) {
            summaryText += ' Waiting for other players to discard.';
          }
        }
        break;
      }

      case 'WITCH': {
        const n = state.playerOrder.length;
        const cursedTargets: string[] = [];
        const immuneNames: string[] = [];
        for (let offset = 1; offset < n; offset++) {
          const oppId = state.playerOrder[(state.activePlayerIndex + offset) % n]!;
          const opp = nextPlayers[oppId]!;
          const hasMoat = opp.hand.some(
            (c) => c.id === 'moat' || c.customEffectId === 'MOAT'
          );
          if (hasMoat) {
            immuneNames.push(oppId);
            continue;
          }
          if ((nextSupply['curse'] ?? 0) > 0) {
            nextSupply['curse'] = (nextSupply['curse'] ?? 1) - 1;
            nextPlayers[oppId] = {
              ...opp,
              discard: [...opp.discard, DOMINION_CARDS['curse']!],
            };
            cursedTargets.push(oppId);
          }
        }
        if (cursedTargets.length > 0) {
          summaryText += ` (${cursedTargets.join(', ')} gained a Curse!)`;
        }
        if (immuneNames.length > 0) {
          summaryText += ` (${immuneNames.join(', ')} revealed Moat!)`;
        }
        break;
      }

      default:
        break;
    }

    const nextState: DominionGameState = {
      ...state,
      players: nextPlayers,
      supply: nextSupply,
      trash: nextTrash,
      pendingInteraction,
      prng: nextPrng,
      lastActionSummary: summaryText,
    };

    return finalizeStateIfGameOver(nextState, summaryText);
  }

  // =========================================================================
  // 3. END_ACTION_PHASE
  // =========================================================================
  if (action.type === 'END_ACTION_PHASE') {
    return {
      ...state,
      turnPhase: 'BUY_TREASURES',
      turnStep: 'BUY_TREASURES',
      lastActionSummary: `${playerId} ended the Action Phase and entered the Buy Phase.`,
    };
  }

  // =========================================================================
  // 4. PLAY_TREASURE & PLAY_ALL_TREASURES
  // =========================================================================
  if (action.type === 'PLAY_TREASURE') {
    const player = state.players[playerId]!;
    const removed = removeCardsFromHand(player.hand, [action.cardId]);
    const treasure = removed.removedCards[0]!;
    const isDurationTreasure = treasure.types.includes('DURATION');

    const isFirstSilver =
      treasure.id === 'silver' && !player.silverPlayedThisTurn;
    const merchantBonus = isFirstSilver ? player.merchantsPlayedThisTurn : 0;

    // Check if any opponent has an active Corsair in play and this is the first Silver or Gold played this turn
    const opponentHasCorsair = Object.values(state.players).some(
      (p) =>
        p.id !== playerId &&
        !isPlayerImmuneToAttack(player) &&
        ((p.durationCards ?? []).some((c) => c.id === 'corsair') ||
          (p.activeDurations ?? []).some((c) => c.id === 'corsair') ||
          p.inPlay.some((c) => c.id === 'corsair'))
    );
    const trashedByCorsair =
      opponentHasCorsair &&
      !player.corsairTrashedThisTurn &&
      (treasure.id === 'silver' || treasure.id === 'gold');

    const updatedPlayer: DominionPlayerState = {
      ...player,
      hand: removed.remainingHand,
      inPlay: trashedByCorsair
        ? [...player.inPlay]
        : [...player.inPlay, treasure],
      durationCards:
        isDurationTreasure && !trashedByCorsair
          ? [...(player.durationCards ?? []), treasure]
          : [...(player.durationCards ?? [])],
      buys: player.buys + treasure.buys,
      coins: player.coins + treasure.coins + merchantBonus,
      silverPlayedThisTurn:
        player.silverPlayedThisTurn || treasure.id === 'silver',
      corsairTrashedThisTurn:
        Boolean(player.corsairTrashedThisTurn) || trashedByCorsair,
    };

    return {
      ...state,
      turnPhase: 'BUY_TREASURES',
      turnStep: 'BUY_TREASURES',
      trash: trashedByCorsair ? [...state.trash, treasure] : state.trash,
      players: {
        ...state.players,
        [playerId]: updatedPlayer,
      },
      lastActionSummary: `${playerId} played ${treasure.name} (+${
        treasure.coins + merchantBonus
      } Coin${treasure.coins + merchantBonus === 1 ? '' : 's'}${
        trashedByCorsair ? ', trashed by Corsair!' : ''
      }).`,
    };
  }

  if (action.type === 'PLAY_ALL_TREASURES') {
    const player = state.players[playerId]!;
    const treasuresInHand = player.hand.filter((c) =>
      c.types.includes('TREASURE')
    );
    const nonTreasuresInHand = player.hand.filter(
      (c) => !c.types.includes('TREASURE')
    );

    if (treasuresInHand.length === 0) {
      return {
        ...state,
        turnPhase: 'BUY_TREASURES',
        turnStep: 'BUY_TREASURES',
        lastActionSummary: `${playerId} entered Buy Phase (no Treasures in hand).`,
      };
    }

    const hasSilverInBatch = treasuresInHand.some((c) => c.id === 'silver');
    const merchantBonus =
      hasSilverInBatch && !player.silverPlayedThisTurn
        ? player.merchantsPlayedThisTurn
        : 0;

    const coinsFromTreasures =
      treasuresInHand.reduce((sum, c) => sum + c.coins, 0) + merchantBonus;
    const buysFromTreasures = treasuresInHand.reduce(
      (sum, c) => sum + c.buys,
      0
    );
    const durationTreasures = treasuresInHand.filter((c) =>
      c.types.includes('DURATION')
    );

    const updatedPlayer: DominionPlayerState = {
      ...player,
      hand: nonTreasuresInHand,
      inPlay: [...player.inPlay, ...treasuresInHand],
      durationCards: [
        ...(player.durationCards ?? []),
        ...durationTreasures,
      ],
      buys: player.buys + buysFromTreasures,
      coins: player.coins + coinsFromTreasures,
      silverPlayedThisTurn: player.silverPlayedThisTurn || hasSilverInBatch,
    };

    return {
      ...state,
      turnPhase: 'BUY_TREASURES',
      turnStep: 'BUY_TREASURES',
      players: {
        ...state.players,
        [playerId]: updatedPlayer,
      },
      lastActionSummary: `${playerId} played ${treasuresInHand.length} Treasure(s) for +${coinsFromTreasures} Coins (Total: ${updatedPlayer.coins} Coins).`,
    };
  }

  // =========================================================================
  // 5. BUY_CARD
  // =========================================================================
  if (action.type === 'BUY_CARD') {
    const player = state.players[playerId]!;
    const cardDef = getDominionCard(action.cardId)!;

    const nextSupply: Record<string, number> = {
      ...state.supply,
      [cardDef.id]: (state.supply[cardDef.id] ?? 1) - 1,
    };

    // Check Embargo tokens on the purchased Supply pile
    const embargoCount = (state.embargoTokens ?? {})[cardDef.id] ?? 0;
    const cursesToGain = Math.min(embargoCount, nextSupply['curse'] ?? 0);
    if (cursesToGain > 0) {
      nextSupply['curse'] = (nextSupply['curse'] ?? 0) - cursesToGain;
    }
    const embargoCurses = Array.from(
      { length: cursesToGain },
      () => DOMINION_CARDS['curse']!
    );

    const updatedPlayer: DominionPlayerState = {
      ...player,
      buys: player.buys - 1,
      coins: player.coins - cardDef.cost,
      discard: [...player.discard, cardDef, ...embargoCurses],
      gainedCardsThisTurn: [
        ...(player.gainedCardsThisTurn ?? []),
        cardDef,
        ...embargoCurses,
      ],
      boughtVictoryThisTurn:
        Boolean(player.boughtVictoryThisTurn) ||
        cardDef.types.includes('VICTORY'),
    };

    const nextPlayers: Record<string, DominionPlayerState> = {
      ...state.players,
      [playerId]: updatedPlayer,
    };

    // Monkey check: if the player to the left of `playerId` has Monkey in play, they draw +1 Card per Monkey
    let nextPrng = state.prng;
    const n = state.playerOrder.length;
    const leftPlayerIdx = (state.activePlayerIndex + 1) % n;
    const leftPlayerId = state.playerOrder[leftPlayerIdx]!;
    if (leftPlayerId !== playerId) {
      const leftPlayer = nextPlayers[leftPlayerId]!;
      const monkeyCount = leftPlayer.inPlay.filter(
        (c) => c.id === 'monkey'
      ).length;
      if (monkeyCount > 0) {
        const monkeyDraw = drawCardsForPlayer(
          leftPlayer,
          monkeyCount,
          nextPrng
        );
        nextPlayers[leftPlayerId] = monkeyDraw.player;
        nextPrng = monkeyDraw.prng;
      }
    }

    const nextState: DominionGameState = {
      ...state,
      turnPhase: 'BUY_CARDS',
      turnStep: 'BUY_CARDS',
      players: nextPlayers,
      supply: nextSupply,
      prng: nextPrng,
    };

    const embargoNote =
      cursesToGain > 0
        ? ` (gained ${cursesToGain} Curse(s) from Embargo token)`
        : '';

    return finalizeStateIfGameOver(
      nextState,
      `${playerId} bought ${cardDef.name} (cost ${cardDef.cost})${embargoNote}.`
    );
  }

  // =========================================================================
  // 6. CLEANUP / END_TURN (With Duration Card 2nd-Phase Retention & Resolution)
  // =========================================================================
  if (action.type === 'CLEANUP' || action.type === 'END_TURN') {
    const player = state.players[playerId]!;

    // Duration cards played THIS turn (`durationCards`) stay in `inPlay` for the 2nd phase (`activeDurations`).
    // Cards that were in `activeDurations` (played on the previous turn) have now completed their 2nd phase and are discarded!
    const durationsPlayedThisTurn = [...(player.durationCards ?? [])];
    const remainingDurationCounts = new Map<string, number>();
    for (const dc of durationsPlayedThisTurn) {
      remainingDurationCounts.set(
        dc.id,
        (remainingDurationCounts.get(dc.id) ?? 0) + 1
      );
    }

    const keptInPlayDurations: Card[] = [];
    const discardedFromPlay: Card[] = [];
    const treasuriesToTopDeck: Card[] = [];

    for (const cardInPlay of player.inPlay) {
      const countToKeep = remainingDurationCounts.get(cardInPlay.id) ?? 0;
      if (countToKeep > 0) {
        keptInPlayDurations.push(cardInPlay);
        remainingDurationCounts.set(cardInPlay.id, countToKeep - 1);
      } else if (
        cardInPlay.id === 'treasury' &&
        !player.boughtVictoryThisTurn
      ) {
        treasuriesToTopDeck.push(cardInPlay);
      } else {
        discardedFromPlay.push(cardInPlay);
      }
    }

    const takeOutpostExtraTurn =
      Boolean(player.outpostPlayedThisTurn) && !player.isOutpostTurn;
    const nextHandDrawCount = takeOutpostExtraTurn ? 3 : 5;

    const clearedPlayer: DominionPlayerState = {
      ...player,
      deck: [...treasuriesToTopDeck, ...player.deck],
      hand: [],
      inPlay: keptInPlayDurations,
      durationCards: [],
      activeDurations: keptInPlayDurations,
      discard: [...player.discard, ...discardedFromPlay, ...player.hand],
      actions: 1,
      buys: 1,
      coins: 0,
      merchantsPlayedThisTurn: 0,
      silverPlayedThisTurn: false,
      gainedCardsLastTurn: [...(player.gainedCardsThisTurn ?? [])],
      gainedCardsThisTurn: [],
      boughtVictoryThisTurn: false,
      outpostPlayedThisTurn: false,
      isOutpostTurn: takeOutpostExtraTurn,
      corsairTrashedThisTurn: false,
    };

    // Draw a fresh hand (5 cards normally, or 3 cards for an Outpost extra turn)
    let nextPrng = state.prng;
    const drawRes = drawCardsForPlayer(
      clearedPlayer,
      nextHandDrawCount,
      nextPrng
    );
    nextPrng = drawRes.prng;

    const nextActiveIndex = takeOutpostExtraTurn
      ? state.activePlayerIndex
      : (state.activePlayerIndex + 1) % state.playerOrder.length;
    const nextActivePlayerId = state.playerOrder[nextActiveIndex]!;

    const nextPlayers: Record<string, DominionPlayerState> = {
      ...state.players,
      [playerId]: drawRes.player,
    };
    const nextSupply: Record<string, number> = { ...state.supply };

    // Resolve Start-of-Turn 2nd Phase for `nextActivePlayerId`'s `activeDurations` & `havenSetAside`
    let startingPlayer = nextPlayers[nextActivePlayerId]!;
    const activeDurs = startingPlayer.activeDurations ?? [];
    const setAsideCards = startingPlayer.havenSetAside ?? [];
    let pendingInteraction: PendingInteraction | null = null;

    if (setAsideCards.length > 0) {
      startingPlayer = {
        ...startingPlayer,
        hand: [...startingPlayer.hand, ...setAsideCards],
        havenSetAside: [],
      };
    }

    if (activeDurs.length > 0) {
      let bonusCards = 0;
      let bonusActions = 0;
      let bonusBuys = 0;
      let bonusCoins = 0;
      let discardTwoRequired = 0;
      let pirateTriggered = false;

      for (const dur of activeDurs) {
        switch (dur.customEffectId ?? dur.id.toUpperCase()) {
          case 'ASTROLABE':
            bonusCoins += 1;
            bonusBuys += 1;
            break;
          case 'CARAVAN':
          case 'CORSAIR':
          case 'MONKEY':
            bonusCards += 1;
            break;
          case 'FISHING_VILLAGE':
            bonusActions += 1;
            bonusCoins += 1;
            break;
          case 'LIGHTHOUSE':
            bonusCoins += 1;
            break;
          case 'MERCHANT_SHIP':
            bonusCoins += 2;
            break;
          case 'PIRATE':
            pirateTriggered = true;
            break;
          case 'SAILOR':
            bonusCoins += 2;
            break;
          case 'SEA_WITCH':
            bonusCards += 2;
            discardTwoRequired += 2;
            break;
          case 'TACTICIAN':
            if (startingPlayer.tacticianPending) {
              bonusCards += 5;
              bonusActions += 1;
              bonusBuys += 1;
            }
            break;
          case 'TIDE_POOLS':
            discardTwoRequired += 2;
            break;
          case 'WHARF':
            bonusCards += 2;
            bonusBuys += 1;
            break;
          default:
            break;
        }
      }

      startingPlayer = {
        ...startingPlayer,
        actions: startingPlayer.actions + bonusActions,
        buys: startingPlayer.buys + bonusBuys,
        coins: startingPlayer.coins + bonusCoins,
        tacticianPending: false,
      };

      if (bonusCards > 0) {
        const durDraw = drawCardsForPlayer(
          startingPlayer,
          bonusCards,
          nextPrng
        );
        startingPlayer = durDraw.player;
        nextPrng = durDraw.prng;
      }

      if (pirateTriggered) {
        const gainTreasureId =
          (nextSupply['gold'] ?? 0) > 0
            ? 'gold'
            : (nextSupply['silver'] ?? 0) > 0
            ? 'silver'
            : null;
        if (gainTreasureId) {
          const gainedTreasure = DOMINION_CARDS[gainTreasureId]!;
          nextSupply[gainTreasureId] = (nextSupply[gainTreasureId] ?? 1) - 1;
          startingPlayer = {
            ...startingPlayer,
            hand: [...startingPlayer.hand, gainedTreasure],
          };
        }
      }

      if (discardTwoRequired > 0 && startingPlayer.hand.length > 0) {
        const req = Math.min(discardTwoRequired, startingPlayer.hand.length);
        const durSource =
          activeDurs.find(
            (d) => d.id === 'tide_pools' || d.id === 'sea_witch'
          ) ?? activeDurs[0]!;
        pendingInteraction = {
          playerId: nextActivePlayerId,
          sourceCard: durSource,
          promptType: 'DISCARD_EXACT_COUNT',
          minCount: req,
          maxCount: req,
        };
      }
    }

    nextPlayers[nextActivePlayerId] = startingPlayer;

    const nextState: DominionGameState = {
      ...state,
      turnPhase: 'ACTION',
      turnStep: 'ACTION',
      turnNumber: state.turnNumber + 1,
      activePlayerIndex: nextActiveIndex,
      activePlayerId: nextActivePlayerId,
      players: nextPlayers,
      supply: nextSupply,
      pendingInteraction,
      prng: nextPrng,
    };

    return finalizeStateIfGameOver(
      nextState,
      `${playerId} completed Cleanup and drew ${nextHandDrawCount} cards. Now ${nextActivePlayerId}'s turn.`
    );
  }

  return state;
}

export const applyDominionAction = applyAction;

function sanitizePlayer(
  player: DominionPlayerState,
  isSelf: boolean
): SanitizedDominionPlayerState {
  const discardTopCard =
    player.discard.length > 0
      ? player.discard[player.discard.length - 1]!
      : null;

  return {
    id: player.id,
    deckCount: player.deck.length,
    handCount: player.hand.length,
    hand: isSelf ? [...player.hand] : [],
    inPlay: [...player.inPlay],
    discardCount: player.discard.length,
    discardTopCard,
    actions: player.actions,
    buys: player.buys,
    coins: player.coins,
    totalVictoryPoints: calculatePlayerVictoryPoints(player),
    durationCards: [...(player.durationCards ?? [])],
    activeDurations: [...(player.activeDurations ?? [])],
    islandMat: [...(player.islandMat ?? [])],
    nativeVillageMat: isSelf ? [...(player.nativeVillageMat ?? [])] : [],
    nativeVillageMatCount: (player.nativeVillageMat ?? []).length,
    pirateShipTokens: player.pirateShipTokens ?? 0,
  };
}

/**
 * Generates a player-specific perspective for Dominion:
 * - Conceals the exact identities and order of cards in all draw decks (`deckCount` only).
 * - Conceals the card identities in opponents' hands (`handCount` only, `hand: []`).
 * - Exposes `self.hand`, `inPlay`, `discardTopCard`, `supply`, `embargoTokens`, `trash`, and player mats.
 */
export function getPlayerPerspective(
  state: DominionGameState,
  playerId: string
): SanitizedDominionState {
  const selfPlayer =
    state.players[playerId] ?? state.players[state.playerOrder[0]!]!;

  const selfSanitized = sanitizePlayer(selfPlayer, true);
  const opponents: Record<string, SanitizedDominionPlayerState> = {};

  for (const pid of state.playerOrder) {
    if (pid === selfPlayer.id) continue;
    opponents[pid] = sanitizePlayer(state.players[pid]!, false);
  }

  return {
    gameId: 'dominion',
    phase: state.phase,
    turnPhase: state.turnPhase,
    turnStep: state.turnStep,
    isGameOver: state.isGameOver,
    turnNumber: state.turnNumber,
    playerOrder: state.playerOrder,
    activePlayerIndex: state.activePlayerIndex,
    activePlayerId: state.activePlayerId,
    self: selfSanitized,
    opponents,
    supply: state.supply,
    embargoTokens: state.embargoTokens ?? {},
    kingdomCards: state.kingdomCards,
    trash: state.trash,
    pendingInteraction: state.pendingInteraction,
    winnerId: state.winnerId,
    finalScores: state.finalScores,
    lastActionSummary: state.lastActionSummary,
  };
}

export const getDominionPlayerPerspective = getPlayerPerspective;
