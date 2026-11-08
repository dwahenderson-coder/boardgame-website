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
          return {
            ...state,
            pendingInteraction: nextPending,
            lastActionSummary: `${pending.playerId} revealed Moat and is unaffected by ${pending.sourceCard.name}!`,
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

        return {
          ...state,
          players: nextPlayers,
          pendingInteraction: nextPending,
          lastActionSummary: `${pending.playerId} discarded ${removed.removedCards.length} card(s) down to 3 in hand (${pending.sourceCard.name}).`,
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
          };
        } else {
          nextPlayers[pending.playerId] = {
            ...targetPlayer,
            discard: [...targetPlayer.discard, gainedCard],
          };
        }

        const updatedState: DominionGameState = {
          ...state,
          players: nextPlayers,
          supply: nextSupply,
          pendingInteraction: null,
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

    let updatedPlayer: DominionPlayerState = {
      ...player,
      hand: removed.remainingHand,
      inPlay: [...player.inPlay, card],
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
    let pendingInteraction: PendingInteraction | null = null;
    let summaryText = `${playerId} played ${card.name}.`;

    switch (card.customEffectId) {
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

    const isFirstSilver =
      treasure.id === 'silver' && !player.silverPlayedThisTurn;
    const merchantBonus = isFirstSilver ? player.merchantsPlayedThisTurn : 0;

    const updatedPlayer: DominionPlayerState = {
      ...player,
      hand: removed.remainingHand,
      inPlay: [...player.inPlay, treasure],
      coins: player.coins + treasure.coins + merchantBonus,
      silverPlayedThisTurn:
        player.silverPlayedThisTurn || treasure.id === 'silver',
    };

    return {
      ...state,
      turnPhase: 'BUY_TREASURES',
      turnStep: 'BUY_TREASURES',
      players: {
        ...state.players,
        [playerId]: updatedPlayer,
      },
      lastActionSummary: `${playerId} played ${treasure.name} (+${treasure.coins + merchantBonus} Coin${treasure.coins + merchantBonus === 1 ? '' : 's'}).`,
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

    const updatedPlayer: DominionPlayerState = {
      ...player,
      hand: nonTreasuresInHand,
      inPlay: [...player.inPlay, ...treasuresInHand],
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

    const updatedPlayer: DominionPlayerState = {
      ...player,
      buys: player.buys - 1,
      coins: player.coins - cardDef.cost,
      discard: [...player.discard, cardDef],
    };

    const nextSupply: Record<string, number> = {
      ...state.supply,
      [cardDef.id]: (state.supply[cardDef.id] ?? 1) - 1,
    };

    const nextState: DominionGameState = {
      ...state,
      turnPhase: 'BUY_CARDS',
      turnStep: 'BUY_CARDS',
      players: {
        ...state.players,
        [playerId]: updatedPlayer,
      },
      supply: nextSupply,
    };

    return finalizeStateIfGameOver(
      nextState,
      `${playerId} bought ${cardDef.name} (cost ${cardDef.cost}).`
    );
  }

  // =========================================================================
  // 6. CLEANUP / END_TURN
  // =========================================================================
  if (action.type === 'CLEANUP' || action.type === 'END_TURN') {
    const player = state.players[playerId]!;

    // Move all cards in `inPlay` and remaining `hand` to `discard`
    const clearedPlayer: DominionPlayerState = {
      ...player,
      hand: [],
      inPlay: [],
      discard: [...player.discard, ...player.inPlay, ...player.hand],
      actions: 1,
      buys: 1,
      coins: 0,
      merchantsPlayedThisTurn: 0,
      silverPlayedThisTurn: false,
    };

    // Draw a fresh hand of 5 cards (recycling discard via PRNG if deck empties)
    const drawRes = drawCardsForPlayer(clearedPlayer, 5, state.prng);

    const nextActiveIndex =
      (state.activePlayerIndex + 1) % state.playerOrder.length;
    const nextActivePlayerId = state.playerOrder[nextActiveIndex]!;

    const nextState: DominionGameState = {
      ...state,
      turnPhase: 'ACTION',
      turnStep: 'ACTION',
      turnNumber: state.turnNumber + 1,
      activePlayerIndex: nextActiveIndex,
      activePlayerId: nextActivePlayerId,
      players: {
        ...state.players,
        [playerId]: drawRes.player,
      },
      prng: drawRes.prng,
    };

    return finalizeStateIfGameOver(
      nextState,
      `${playerId} completed Cleanup and drew 5 cards. Now ${nextActivePlayerId}'s turn.`
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
  };
}

/**
 * Generates a player-specific perspective for Dominion:
 * - Conceals the exact identities and order of cards in all draw decks (`deckCount` only).
 * - Conceals the card identities in opponents' hands (`handCount` only, `hand: []`).
 * - Exposes `self.hand`, `inPlay`, `discardTopCard`, `supply`, and `trash`.
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
    kingdomCards: state.kingdomCards,
    trash: state.trash,
    pendingInteraction: state.pendingInteraction,
    winnerId: state.winnerId,
    finalScores: state.finalScores,
    lastActionSummary: state.lastActionSummary,
  };
}

export const getDominionPlayerPerspective = getPlayerPerspective;
