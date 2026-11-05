import {
  CardZone,
  createStandardDeck,
  formatCardLabel,
  StandardCard,
} from '../../common/cards/index.js';
import { createPRNG, PRNGState } from '../../common/prng.js';
import { ValidationResult } from '../ticket-to-ride/types.js';
import {
  KingsCornersAction,
  KingsCornersGameState,
  KingsCornersPlayerState,
  KingsCornersSanitizedGameState,
  KingsCornersSanitizedPlayerState,
} from './types.js';

export const KC_INITIAL_QUARTERS = 4;

/**
 * Kings Corners Card Scoring:
 * A = 1, 2..9 = face value, 10/J/Q = 10, K = 0
 */
export function getKingsCornersCardPoints(card: StandardCard): number {
  switch (card.rank) {
    case 'A':
      return 1;
    case 'K':
      return 0;
    case '10':
    case 'J':
    case 'Q':
      return 10;
    default:
      return card.value;
  }
}

export function calculateKingsCornersHandScore(
  cards: readonly StandardCard[]
): number {
  return cards.reduce((sum, c) => sum + getKingsCornersCardPoints(c), 0);
}

function findNextActivePlayerIndex(
  playerOrder: readonly string[],
  players: Readonly<Record<string, KingsCornersPlayerState>>,
  fromIndex: number
): number {
  const n = playerOrder.length;
  for (let offset = 1; offset <= n; offset++) {
    const idx = (fromIndex + offset) % n;
    const pid = playerOrder[idx]!;
    if (!players[pid]!.eliminated) {
      return idx;
    }
  }
  return fromIndex;
}

function dealKingsCornersHand(
  playerOrder: readonly string[],
  prevPlayers: Readonly<Record<string, KingsCornersPlayerState>>,
  dealerIndex: number,
  handNumber: number,
  turnNumber: number,
  potQuarters: number,
  prng: PRNGState
): KingsCornersGameState {
  const deckZone = new CardZone<StandardCard>({
    id: 'kc_deck',
    visibility: 'hidden',
    initialCards: createStandardDeck(),
  });
  const nextPrng = deckZone.shuffle(prng);

  const nextPlayers: Record<string, KingsCornersPlayerState> = {};

  for (const pid of playerOrder) {
    const prev = prevPlayers[pid];
    const quarters = prev ? prev.quarters : KC_INITIAL_QUARTERS;
    const eliminated = quarters <= 0;

    if (!eliminated) {
      const dealt = deckZone.draw(4);
      nextPlayers[pid] = {
        id: pid,
        quarters,
        eliminated: false,
        cards: [dealt[0]!, dealt[1]!, dealt[2]!, dealt[3]!],
        peekedRow: null,
        readyAfterPeek: false,
        lastActionLabel: 'Choosing 2 cards to peek...',
        lastHandScore: null,
      };
    } else {
      // Eliminated players keep placeholder cards and are skipped
      nextPlayers[pid] = {
        id: pid,
        quarters: 0,
        eliminated: true,
        cards: prev!.cards,
        peekedRow: null,
        readyAfterPeek: true,
        lastActionLabel: 'Eliminated (0 Quarters)',
        lastHandScore: null,
      };
    }
  }

  const firstDiscard = deckZone.draw(1);
  const firstActiveIndex = findNextActivePlayerIndex(
    playerOrder,
    nextPlayers,
    dealerIndex
  );

  return {
    gameId: 'kings_corners',
    phase: 'PLAYING',
    turnStep: 'INITIAL_PEEK',
    turnNumber,
    handNumber,
    playerOrder: [...playerOrder],
    dealerIndex,
    activePlayerIndex: firstActiveIndex,
    knockerId: null,
    potQuarters,
    drawPile: deckZone.getCards(),
    discardPile: firstDiscard,
    pendingDrawnCard: null,
    players: nextPlayers,
    prng: nextPrng,
    winnerId: null,
    lastActionSummary: `Hand #${handNumber} dealt! Each player may peek at either their Top 2 or Bottom 2 cards before play begins.`,
    lastHandSummary: null,
  };
}

/**
 * Initializes a new Kings Corners match for 2 to 6 players.
 */
export function initKingsCornersGame(
  playerIds: string[],
  seed: number
): KingsCornersGameState {
  if (playerIds.length < 2 || playerIds.length > 6) {
    throw new Error(
      `Kings Corners requires between 2 and 6 players (received ${playerIds.length}).`
    );
  }

  const prng = createPRNG(seed);
  return dealKingsCornersHand(playerIds, {}, 0, 1, 1, 0, prng);
}

/**
 * Validates a Kings Corners action.
 */
export function validateKingsCornersAction(
  state: KingsCornersGameState,
  playerId: string,
  action: KingsCornersAction
): ValidationResult {
  if (state.phase === 'GAME_OVER') {
    return { valid: false, reason: 'The game is already over.' };
  }

  const player = state.players[playerId];
  if (!player) {
    return { valid: false, reason: `Unknown player "${playerId}".` };
  }

  if (action.type === 'KC_NEXT_HAND') {
    if (state.turnStep !== 'HAND_OVER') {
      return {
        valid: false,
        reason: 'Can only deal the next hand after the current hand ends.',
      };
    }
    return { valid: true };
  }

  if (player.eliminated) {
    return { valid: false, reason: 'Eliminated players cannot act.' };
  }

  // Initial Peek Phase (simultaneous for all non-eliminated players)
  if (state.turnStep === 'INITIAL_PEEK') {
    if (action.type === 'KC_PEEK_CARDS') {
      if (player.readyAfterPeek) {
        return {
          valid: false,
          reason: 'You have already locked in and hidden your cards.',
        };
      }
      if (player.peekedRow !== null) {
        return {
          valid: false,
          reason: `You already chose to peek at your ${player.peekedRow.toLowerCase()} 2 cards.`,
        };
      }
      return { valid: true };
    }

    if (action.type === 'KC_FINISH_PEEK') {
      if (player.peekedRow === null) {
        return {
          valid: false,
          reason: 'Select either Top 2 or Bottom 2 cards to peek at first.',
        };
      }
      if (player.readyAfterPeek) {
        return { valid: false, reason: 'You are already marked ready.' };
      }
      return { valid: true };
    }

    return {
      valid: false,
      reason: 'All players must finish peeking at their 2 cards before the hand starts.',
    };
  }

  // Turn-based Play Phase
  const activePlayerId = state.playerOrder[state.activePlayerIndex];
  if (playerId !== activePlayerId) {
    return {
      valid: false,
      reason: `Out of turn: waiting for ${activePlayerId}.`,
    };
  }

  if (state.turnStep === 'AWAITING_TURN_ACTION') {
    switch (action.type) {
      case 'KC_DRAW_DECK':
        if (state.drawPile.length === 0 && state.discardPile.length <= 1) {
          return { valid: false, reason: 'No cards remaining to draw.' };
        }
        return { valid: true };

      case 'KC_TAKE_DISCARD':
        if (state.discardPile.length === 0) {
          return { valid: false, reason: 'Discard pile is empty.' };
        }
        if (
          action.replaceSlotIndex < 0 ||
          action.replaceSlotIndex > 3 ||
          !Number.isInteger(action.replaceSlotIndex)
        ) {
          return { valid: false, reason: 'Invalid card slot index (0..3).' };
        }
        return { valid: true };

      case 'KC_KNOCK':
        if (state.knockerId !== null) {
          return {
            valid: false,
            reason: `${state.knockerId} has already knocked this hand!`,
          };
        }
        return { valid: true };

      default:
        return {
          valid: false,
          reason: 'Choose to Draw from Deck, Swap with Discard, or Knock.',
        };
    }
  }

  if (state.turnStep === 'DECIDING_DRAWN_CARD') {
    if (action.type === 'KC_USE_DRAWN') {
      if (
        action.replaceSlotIndex < 0 ||
        action.replaceSlotIndex > 3 ||
        !Number.isInteger(action.replaceSlotIndex)
      ) {
        return { valid: false, reason: 'Invalid card slot index (0..3).' };
      }
      return { valid: true };
    }
    if (action.type === 'KC_DISCARD_DRAWN') {
      return { valid: true };
    }
    return {
      valid: false,
      reason:
        'You drew a card from the deck: choose one of your 4 slots to replace or discard the drawn card.',
    };
  }

  return { valid: false, reason: 'Action not allowed in current step.' };
}

/**
 * Resolves the end of a Kings Corners hand once play circles back to the knocker.
 */
function resolveKingsCornersHandEnd(
  state: KingsCornersGameState,
  nextPlayers: Record<string, KingsCornersPlayerState>,
  lastMoveText: string
): KingsCornersGameState {
  const activePlayerIds = state.playerOrder.filter(
    (pid) => !nextPlayers[pid]!.eliminated
  );

  const scoresByPlayer: Record<string, number> = {};
  let highestScore = -Infinity;
  let lowestScore = Infinity;

  for (const pid of activePlayerIds) {
    const p = nextPlayers[pid]!;
    const score = calculateKingsCornersHandScore(p.cards);
    scoresByPlayer[pid] = score;
    if (score > highestScore) highestScore = score;
    if (score < lowestScore) lowestScore = score;
  }

  const tiedHighest = activePlayerIds.filter(
    (pid) => scoresByPlayer[pid] === highestScore
  );

  // Rule: "If two or more players are tied for highest they both lose a quarter
  // unless this would cause both players to lose their last quarter at which point
  // neither player does and that hand is a push."
  const tiedAtLastQuarter = tiedHighest.filter(
    (pid) => nextPlayers[pid]!.quarters === 1
  );
  const wouldEliminateAllSurvivors =
    activePlayerIds.every(
      (pid) =>
        tiedHighest.includes(pid) && nextPlayers[pid]!.quarters === 1
    );

  const isPush =
    (tiedHighest.length >= 2 && tiedAtLastQuarter.length >= 2) ||
    wouldEliminateAllSurvivors;

  const losers = isPush ? [] : tiedHighest;
  let nextPotQuarters = state.potQuarters;

  for (const pid of activePlayerIds) {
    const p = nextPlayers[pid]!;
    const score = scoresByPlayer[pid]!;
    const lostQuarter = losers.includes(pid);
    const updatedQuarters = lostQuarter ? p.quarters - 1 : p.quarters;
    if (lostQuarter) {
      nextPotQuarters += 1;
    }

    nextPlayers[pid] = {
      ...p,
      quarters: updatedQuarters,
      eliminated: updatedQuarters <= 0,
      lastHandScore: score,
      lastActionLabel: isPush && tiedHighest.includes(pid)
        ? `${score} pts (Tied High — Push!)`
        : lostQuarter
          ? `${score} pts (-1 Quarter)`
          : `${score} pts (Safe)`,
    };
  }

  const survivingIds = state.playerOrder.filter(
    (pid) => nextPlayers[pid]!.quarters > 0
  );
  const isGameOver = survivingIds.length <= 1;
  const winnerId = isGameOver ? (survivingIds[0] ?? null) : null;

  const pushReason = isPush
    ? `Tie at ${highestScore} pts would eliminate multiple players on their last quarter — Hand is a PUSH!`
    : null;

  const outcomeSummary = isPush
    ? `${lastMoveText} — Hand #${state.handNumber} Over! ${pushReason}`
    : `${lastMoveText} — Hand #${state.handNumber} Over! Highest score (${highestScore} pts): ${losers.join(', ')} put${losers.length === 1 ? 's' : ''} a quarter in the pot ($${(nextPotQuarters * 0.25).toFixed(2)}).`;

  return {
    ...state,
    phase: isGameOver ? 'GAME_OVER' : 'PLAYING',
    turnStep: 'HAND_OVER',
    turnNumber: state.turnNumber + 1,
    potQuarters: nextPotQuarters,
    pendingDrawnCard: null,
    players: nextPlayers,
    winnerId,
    lastActionSummary: outcomeSummary,
    lastHandSummary: {
      handNumber: state.handNumber,
      knockerId: state.knockerId ?? activePlayerIds[0]!,
      highestScore,
      lowestScore,
      scoresByPlayer,
      losers,
      isPush,
      pushReason,
    },
  };
}

/**
 * Pure reducer applying a validated Kings Corners action.
 */
export function applyKingsCornersAction(
  state: KingsCornersGameState,
  playerId: string,
  action: KingsCornersAction
): KingsCornersGameState {
  const check = validateKingsCornersAction(state, playerId, action);
  if (!check.valid) {
    throw new Error(check.reason ?? 'Invalid Kings Corners action.');
  }

  if (action.type === 'KC_NEXT_HAND') {
    const nextDealerIndex = findNextActivePlayerIndex(
      state.playerOrder,
      state.players,
      state.dealerIndex
    );
    return dealKingsCornersHand(
      state.playerOrder,
      state.players,
      nextDealerIndex,
      state.handNumber + 1,
      state.turnNumber + 1,
      state.potQuarters,
      state.prng
    );
  }

  const actingPlayer = state.players[playerId]!;
  const nextPlayers: Record<string, KingsCornersPlayerState> = {
    ...state.players,
  };

  // 1. Handle Initial Peek Phase actions
  if (state.turnStep === 'INITIAL_PEEK') {
    if (action.type === 'KC_PEEK_CARDS') {
      nextPlayers[playerId] = {
        ...actingPlayer,
        peekedRow: action.row,
        lastActionLabel: `Peeking at ${action.row === 'TOP' ? 'Top 2' : 'Bottom 2'} cards...`,
      };
      return {
        ...state,
        players: nextPlayers,
        lastActionSummary: `${playerId} chose to peek at their ${action.row === 'TOP' ? 'Top 2' : 'Bottom 2'} cards.`,
      };
    }

    if (action.type === 'KC_FINISH_PEEK') {
      nextPlayers[playerId] = {
        ...actingPlayer,
        readyAfterPeek: true,
        lastActionLabel: 'Locked In (Cards Hidden)',
      };

      const allReady = state.playerOrder.every(
        (pid) => nextPlayers[pid]!.eliminated || nextPlayers[pid]!.readyAfterPeek
      );

      const firstTurnPlayerId = state.playerOrder[state.activePlayerIndex]!;

      return {
        ...state,
        turnStep: allReady ? 'AWAITING_TURN_ACTION' : 'INITIAL_PEEK',
        players: nextPlayers,
        lastActionSummary: allReady
          ? `All players locked in their cards! Memorize your positions — ${firstTurnPlayerId} is up first.`
          : `${playerId} locked in their cards.`,
      };
    }
  }

  // 2. Handle Drawing a card from the Deck
  if (action.type === 'KC_DRAW_DECK') {
    let currentDrawPile = [...state.drawPile];
    let currentDiscardPile = [...state.discardPile];
    let nextPrng = state.prng;

    if (currentDrawPile.length === 0 && currentDiscardPile.length > 1) {
      const topDiscard = currentDiscardPile[currentDiscardPile.length - 1]!;
      const recyclable = currentDiscardPile.slice(0, -1);
      const recycleZone = new CardZone<StandardCard>({
        id: 'recycle',
        initialCards: recyclable,
      });
      nextPrng = recycleZone.shuffle(nextPrng);
      currentDrawPile = [...recycleZone.getCards()];
      currentDiscardPile = [topDiscard];
    }

    const drawnCard = currentDrawPile.shift()!;
    nextPlayers[playerId] = {
      ...actingPlayer,
      lastActionLabel: 'Drew from Deck (Deciding...)',
    };

    return {
      ...state,
      turnStep: 'DECIDING_DRAWN_CARD',
      drawPile: currentDrawPile,
      discardPile: currentDiscardPile,
      pendingDrawnCard: drawnCard,
      players: nextPlayers,
      prng: nextPrng,
      lastActionSummary: `${playerId} drew a card from the deck and is deciding whether to swap or discard it.`,
    };
  }

  // 3. Actions that complete a player's turn (KC_USE_DRAWN, KC_DISCARD_DRAWN, KC_TAKE_DISCARD, KC_KNOCK)
  let nextDiscardPile = [...state.discardPile];
  let nextKnockerId = state.knockerId;
  let moveDescription = '';

  if (action.type === 'KC_USE_DRAWN') {
    const drawn = state.pendingDrawnCard!;
    const slot = action.replaceSlotIndex;
    const replacedCard = actingPlayer.cards[slot]!;
    const updatedCards = [...actingPlayer.cards] as [
      StandardCard,
      StandardCard,
      StandardCard,
      StandardCard,
    ];
    updatedCards[slot] = drawn;
    nextDiscardPile.push(replacedCard);

    nextPlayers[playerId] = {
      ...actingPlayer,
      cards: updatedCards,
      lastActionLabel: `Swapped Slot #${slot + 1} (Discarded ${formatCardLabel(replacedCard)})`,
    };
    moveDescription = `${playerId} replaced card #${slot + 1} with their drawn card and discarded ${formatCardLabel(replacedCard)}.`;
  } else if (action.type === 'KC_DISCARD_DRAWN') {
    const drawn = state.pendingDrawnCard!;
    nextDiscardPile.push(drawn);
    nextPlayers[playerId] = {
      ...actingPlayer,
      lastActionLabel: `Discarded Drawn ${formatCardLabel(drawn)}`,
    };
    moveDescription = `${playerId} discarded their drawn card (${formatCardLabel(drawn)}).`;
  } else if (action.type === 'KC_TAKE_DISCARD') {
    const takenDiscard = nextDiscardPile.pop()!;
    const slot = action.replaceSlotIndex;
    const replacedCard = actingPlayer.cards[slot]!;
    const updatedCards = [...actingPlayer.cards] as [
      StandardCard,
      StandardCard,
      StandardCard,
      StandardCard,
    ];
    updatedCards[slot] = takenDiscard;
    nextDiscardPile.push(replacedCard);

    nextPlayers[playerId] = {
      ...actingPlayer,
      cards: updatedCards,
      lastActionLabel: `Took ${formatCardLabel(takenDiscard)} for Slot #${slot + 1}`,
    };
    moveDescription = `${playerId} took ${formatCardLabel(takenDiscard)} from the discard pile for slot #${slot + 1} and discarded ${formatCardLabel(replacedCard)}.`;
  } else if (action.type === 'KC_KNOCK') {
    nextKnockerId = playerId;
    nextPlayers[playerId] = {
      ...actingPlayer,
      lastActionLabel: '🔔 KNOCKED!',
    };
    moveDescription = `🔔 ${playerId} KNOCKED! Every other player gets one final turn.`;
  }

  // Advance clockwise to the next non-eliminated player
  const nextActiveIndex = findNextActivePlayerIndex(
    state.playerOrder,
    nextPlayers,
    state.activePlayerIndex
  );
  const nextActivePlayerId = state.playerOrder[nextActiveIndex]!;

  // If play has circled back to the player who knocked, the hand ends immediately!
  if (nextKnockerId !== null && nextActivePlayerId === nextKnockerId) {
    return resolveKingsCornersHandEnd(
      {
        ...state,
        knockerId: nextKnockerId,
        discardPile: nextDiscardPile,
        pendingDrawnCard: null,
      },
      nextPlayers,
      moveDescription
    );
  }

  return {
    ...state,
    turnStep: 'AWAITING_TURN_ACTION',
    turnNumber: state.turnNumber + 1,
    activePlayerIndex: nextActiveIndex,
    knockerId: nextKnockerId,
    discardPile: nextDiscardPile,
    pendingDrawnCard: null,
    players: nextPlayers,
    lastActionSummary: moveDescription,
  };
}

function buildSanitizedKingsCornersPlayer(
  p: KingsCornersPlayerState,
  isSelf: boolean,
  turnStep: KingsCornersGameState['turnStep'],
  phase: KingsCornersGameState['phase']
): KingsCornersSanitizedPlayerState {
  const revealAll = turnStep === 'HAND_OVER' || phase === 'GAME_OVER';
  const revealTopTwo =
    isSelf &&
    turnStep === 'INITIAL_PEEK' &&
    p.peekedRow === 'TOP' &&
    !p.readyAfterPeek;
  const revealBottomTwo =
    isSelf &&
    turnStep === 'INITIAL_PEEK' &&
    p.peekedRow === 'BOTTOM' &&
    !p.readyAfterPeek;

  const visibleSlots: [
    StandardCard | null,
    StandardCard | null,
    StandardCard | null,
    StandardCard | null,
  ] = [
    revealAll || revealTopTwo ? p.cards[0] : null,
    revealAll || revealTopTwo ? p.cards[1] : null,
    revealAll || revealBottomTwo ? p.cards[2] : null,
    revealAll || revealBottomTwo ? p.cards[3] : null,
  ];

  return {
    id: p.id,
    quarters: p.quarters,
    eliminated: p.eliminated,
    visibleSlots,
    peekedRow: p.peekedRow,
    readyAfterPeek: p.readyAfterPeek,
    lastActionLabel: p.lastActionLabel,
    lastHandScore: p.lastHandScore,
  };
}

/**
 * Generates a player-specific perspective for Kings Corners:
 * - During `INITIAL_PEEK`, reveals only the player's chosen 2 cards (`TOP` or `BOTTOM`) until they lock in.
 * - Once play starts (`AWAITING_TURN_ACTION` / `DECIDING_DRAWN_CARD`), ALL 4 cards remain face-down (`null`)!
 * - At `HAND_OVER` / `GAME_OVER`, reveals all 4 cards for all players.
 */
export function getKingsCornersPlayerPerspective(
  state: KingsCornersGameState,
  playerId: string
): KingsCornersSanitizedGameState {
  const selfPlayer =
    state.players[playerId] ?? state.players[state.playerOrder[0]!]!;
  const activePlayerId =
    state.playerOrder[state.activePlayerIndex] ?? state.playerOrder[0]!;

  const selfSanitized = buildSanitizedKingsCornersPlayer(
    selfPlayer,
    true,
    state.turnStep,
    state.phase
  );

  const opponents: Record<string, KingsCornersSanitizedPlayerState> = {};
  for (const pid of state.playerOrder) {
    if (pid === selfPlayer.id) continue;
    opponents[pid] = buildSanitizedKingsCornersPlayer(
      state.players[pid]!,
      false,
      state.turnStep,
      state.phase
    );
  }

  const discardTopCard =
    state.discardPile.length > 0
      ? state.discardPile[state.discardPile.length - 1]!
      : null;

  return {
    gameId: 'kings_corners',
    phase: state.phase,
    turnStep: state.turnStep,
    turnNumber: state.turnNumber,
    handNumber: state.handNumber,
    playerOrder: state.playerOrder,
    dealerIndex: state.dealerIndex,
    activePlayerIndex: state.activePlayerIndex,
    activePlayerId,
    knockerId: state.knockerId,
    potQuarters: state.potQuarters,
    drawPileCount: state.drawPile.length,
    discardTopCard,
    discardPileCount: state.discardPile.length,
    pendingDrawnCard:
      activePlayerId === selfPlayer.id ? state.pendingDrawnCard : null,
    self: selfSanitized,
    opponents,
    winnerId: state.winnerId,
    lastActionSummary: state.lastActionSummary,
    lastHandSummary: state.lastHandSummary,
  };
}

export function calculateKingsCornersFinalScores(
  state: KingsCornersGameState
): Record<string, number> {
  const scores: Record<string, number> = {};
  for (const pid of state.playerOrder) {
    scores[pid] = state.players[pid]!.quarters;
  }
  return scores;
}

