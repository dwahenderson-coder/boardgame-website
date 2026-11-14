import {
  CardZone,
  createStandardDeck,
  formatCardLabel,
  sanitizeZoneForPlayer,
  StandardCard,
} from '../../common/cards/index.js';
import { createPRNG, PRNGState } from '../../common/prng.js';
import { ValidationResult } from '../ticket-to-ride/types.js';
import {
  CribbageAction,
  CribbageGameState,
  CribbagePegPlayedCard,
  CribbagePlayerState,
  CribbagePublicPlayerState,
  CribbageSanitizedGameState,
  CribbageScoreBreakdown,
} from './types.js';

export const CRIBBAGE_TARGET_SCORE = 121;

/**
 * Returns the Cribbage pip value of a card (A = 1, 2..10 = face value, J/Q/K = 10).
 */
export function getCribbagePipValue(card: StandardCard): number {
  if (card.rank === 'A') return 1;
  if (card.value >= 10) return 10;
  return card.value;
}

/**
 * Returns the Cribbage run rank order of a card (A = 1, 2..10 = face value, J = 11, Q = 12, K = 13).
 */
export function getCribbageRunOrder(card: StandardCard): number {
  if (card.rank === 'A') return 1;
  return card.value;
}

/**
 * Evaluates a 4-card Cribbage hand (or Crib) + Starter Card for 15s, Pairs, Runs, Flush, and His Nobs.
 */
export function evaluateCribbageHand(
  handCards: readonly StandardCard[],
  starterCard: StandardCard | null,
  isCrib = false
): CribbageScoreBreakdown {
  const allCards = starterCard ? [...handCards, starterCard] : [...handCards];
  const n = allCards.length;
  const details: string[] = [];

  // 1. Fifteens (any subset summing to 15 scores 2 points)
  let fifteens = 0;
  const totalMasks = 1 << n;
  for (let mask = 1; mask < totalMasks; mask++) {
    let sum = 0;
    for (let i = 0; i < n; i++) {
      if ((mask & (1 << i)) !== 0) {
        sum += getCribbagePipValue(allCards[i]!);
      }
    }
    if (sum === 15) {
      fifteens += 2;
    }
  }
  if (fifteens > 0) {
    details.push(`15s (+${fifteens})`);
  }

  // 2. Pairs (every pair of identical ranks scores 2 points)
  let pairs = 0;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (allCards[i]!.rank === allCards[j]!.rank) {
        pairs += 2;
      }
    }
  }
  if (pairs > 0) {
    details.push(`Pairs (+${pairs})`);
  }

  // 3. Runs (longest contiguous sequence of 3, 4, or 5 ranks)
  let runs = 0;
  for (let runLen = n; runLen >= 3; runLen--) {
    let matchingCombos = 0;
    for (let mask = 1; mask < totalMasks; mask++) {
      // Count bits in mask
      let bits = 0;
      const subsetOrders: number[] = [];
      for (let i = 0; i < n; i++) {
        if ((mask & (1 << i)) !== 0) {
          bits++;
          subsetOrders.push(getCribbageRunOrder(allCards[i]!));
        }
      }
      if (bits !== runLen) continue;
      subsetOrders.sort((a, b) => a - b);
      let isContiguous = true;
      for (let k = 1; k < subsetOrders.length; k++) {
        if (subsetOrders[k]! !== subsetOrders[k - 1]! + 1) {
          isContiguous = false;
          break;
        }
      }
      if (isContiguous) {
        matchingCombos++;
      }
    }
    if (matchingCombos > 0) {
      runs = matchingCombos * runLen;
      break;
    }
  }
  if (runs > 0) {
    details.push(`Runs (+${runs})`);
  }

  // 4. Flush (4 cards in hand of same suit = 4 pts, +1 if starter matches; Crib requires all 5)
  let flush = 0;
  if (handCards.length === 4) {
    const firstSuit = handCards[0]!.suit;
    const allFourMatch =
      firstSuit !== 'JOKER' && handCards.every((c) => c.suit === firstSuit);
    if (allFourMatch) {
      if (starterCard && starterCard.suit === firstSuit) {
        flush = 5;
      } else if (!isCrib) {
        flush = 4;
      }
    }
  }
  if (flush > 0) {
    details.push(`Flush (+${flush})`);
  }

  // 5. His Nobs (Jack in hand matching starterCard suit = +1 pt)
  let nobs = 0;
  if (
    starterCard &&
    starterCard.suit !== 'JOKER' &&
    handCards.some((c) => c.rank === 'J' && c.suit === starterCard.suit)
  ) {
    nobs = 1;
    details.push('His Nobs (+1)');
  }

  const total = fifteens + pairs + runs + flush + nobs;
  return {
    fifteens,
    pairs,
    runs,
    flush,
    nobs,
    total,
    details,
  };
}

/**
 * Evaluates points scored immediately on a pegging play.
 */
export function evaluatePeggingPlayPoints(
  sequence: readonly CribbagePegPlayedCard[],
  newRunningCount: number
): { points: number; reasons: string[] } {
  let points = 0;
  const reasons: string[] = [];

  if (newRunningCount === 15) {
    points += 2;
    reasons.push('Fifteen (+2)');
  } else if (newRunningCount === 31) {
    points += 2;
    reasons.push('Thirty-One (+2)');
  }

  // Check consecutive matching ranks at the tail of `sequence`
  const lastCard = sequence[sequence.length - 1]!.card;
  let sameRankCount = 1;
  for (let i = sequence.length - 2; i >= 0; i--) {
    if (sequence[i]!.card.rank === lastCard.rank) {
      sameRankCount++;
    } else {
      break;
    }
  }
  if (sameRankCount === 2) {
    points += 2;
    reasons.push('Pair (+2)');
  } else if (sameRankCount === 3) {
    points += 6;
    reasons.push('Pair Royal (+6)');
  } else if (sameRankCount >= 4) {
    points += 12;
    reasons.push('Double Pair Royal (+12)');
  }

  // Check longest run of 3+ at the tail of `sequence`
  let bestRunLength = 0;
  for (let len = sequence.length; len >= 3; len--) {
    const tail = sequence.slice(sequence.length - len);
    const orders = tail
      .map((item) => getCribbageRunOrder(item.card))
      .sort((a, b) => a - b);
    let isRun = true;
    for (let k = 1; k < orders.length; k++) {
      if (orders[k]! !== orders[k - 1]! + 1) {
        isRun = false;
        break;
      }
    }
    if (isRun) {
      bestRunLength = len;
      break;
    }
  }

  if (bestRunLength >= 3) {
    points += bestRunLength;
    reasons.push(`Run of ${bestRunLength} (+${bestRunLength})`);
  }

  return { points, reasons };
}

function canPlayerPegUnder31(
  peggingCards: readonly StandardCard[],
  runningCount: number
): boolean {
  return peggingCards.some(
    (c) => runningCount + getCribbagePipValue(c) <= 31
  );
}

function dealCribbageHand(
  playerOrder: readonly string[],
  prevPlayers: Readonly<Record<string, CribbagePlayerState>>,
  dealerIndex: number,
  handNumber: number,
  turnNumber: number,
  prng: PRNGState
): CribbageGameState {
  const deckZone = new CardZone<StandardCard>({
    id: 'crib_deck',
    visibility: 'hidden',
    initialCards: createStandardDeck(),
  });
  const nextPrng = deckZone.shuffle(prng);

  const playerCount = playerOrder.length;
  const cardsPerPlayer = playerCount === 2 ? 6 : 5;
  const cribZone = new CardZone<StandardCard>({
    id: 'crib',
    name: "Dealer's Crib",
    visibility: 'hidden',
  });

  // In a 3-player game, deal 1 extra card directly to the Crib so the Crib has 4 cards
  if (playerCount === 3) {
    cribZone.add(deckZone.draw(1));
  }

  const players: Record<string, CribbagePlayerState> = {};
  for (const pid of playerOrder) {
    const prev = prevPlayers[pid];
    const dealt = deckZone.draw(cardsPerPlayer);
    players[pid] = {
      id: pid,
      handZone: {
        id: `hand_${pid}`,
        name: `${pid} Hand`,
        visibility: 'private',
        ownerId: pid,
        cards: dealt,
      },
      peggingCards: [],
      discardedToCrib: false,
      score: prev?.score ?? 0,
      lastActionLabel: 'Selecting Crib discards...',
      lastShowBreakdown: null,
    };
  }

  const starterCard = deckZone.draw(1)[0] ?? null;
  const nonDealerIndex = (dealerIndex + 1) % playerCount;
  const discardNeeded = playerCount === 2 ? 2 : 1;

  return {
    gameId: 'cribbage',
    phase: 'PLAYING',
    turnStep: 'DISCARD_TO_CRIB',
    turnNumber,
    handNumber,
    targetScore: CRIBBAGE_TARGET_SCORE,
    playerOrder: [...playerOrder],
    dealerIndex,
    activePlayerIndex: nonDealerIndex,
    starterCard,
    cribZone: cribZone.toSerialized(),
    cribBreakdown: null,
    runningCount: 0,
    currentSequence: [],
    playedPegHistory: [],
    players,
    prng: nextPrng,
    winnerId: null,
    lastActionSummary: `Hand #${handNumber} dealt (${playerOrder[dealerIndex]} is Dealer). Each player must discard ${discardNeeded} card${discardNeeded === 1 ? '' : 's'} to the Crib.`,
  };
}

export function initCribbageGame(
  playerIds: string[],
  seed: number
): CribbageGameState {
  if (playerIds.length < 2 || playerIds.length > 4) {
    throw new Error(
      `Cribbage requires between 2 and 4 players (received ${playerIds.length}).`
    );
  }
  return dealCribbageHand(playerIds, {}, 0, 1, 1, createPRNG(seed));
}

export function validateCribbageAction(
  state: CribbageGameState,
  playerId: string,
  action: CribbageAction
): ValidationResult {
  if (state.phase === 'GAME_OVER') {
    return { valid: false, reason: 'The Cribbage match has already ended.' };
  }

  const player = state.players[playerId];
  if (!player) {
    return { valid: false, reason: `Unknown player "${playerId}".` };
  }

  if (action.type === 'CRIB_NEXT_HAND') {
    if (state.turnStep !== 'HAND_OVER') {
      return {
        valid: false,
        reason: 'Can only deal the next hand after the current hand finishes.',
      };
    }
    return { valid: true };
  }

  // Simultaneous discard to crib phase
  if (state.turnStep === 'DISCARD_TO_CRIB') {
    if (action.type !== 'CRIB_DISCARD') {
      return {
        valid: false,
        reason: 'Wait until all players discard to the Crib before pegging.',
      };
    }
    if (player.discardedToCrib) {
      return {
        valid: false,
        reason: 'You have already discarded to the Crib.',
      };
    }
    const requiredCount = state.playerOrder.length === 2 ? 2 : 1;
    const uniqueIds = Array.from(new Set(action.cardIds));
    if (uniqueIds.length !== requiredCount) {
      return {
        valid: false,
        reason: `Must select exactly ${requiredCount} card${requiredCount === 1 ? '' : 's'} to discard to the Crib.`,
      };
    }
    for (const cid of uniqueIds) {
      if (!player.handZone.cards.some((c) => c.id === cid)) {
        return {
          valid: false,
          reason: `Card "${cid}" is not in your hand.`,
        };
      }
    }
    return { valid: true };
  }

  // Pegging Phase
  const activePlayerId = state.playerOrder[state.activePlayerIndex];
  if (playerId !== activePlayerId) {
    return {
      valid: false,
      reason: `Out of turn: waiting for ${activePlayerId}.`,
    };
  }

  if (state.turnStep === 'PEGGING') {
    if (action.type === 'CRIB_PLAY_CARD') {
      const card = player.peggingCards.find((c) => c.id === action.cardId);
      if (!card) {
        return {
          valid: false,
          reason: 'That card is not available in your pegging hand.',
        };
      }
      const nextCount = state.runningCount + getCribbagePipValue(card);
      if (nextCount > 31) {
        return {
          valid: false,
          reason: `Playing ${formatCardLabel(card)} would bring the count to ${nextCount} (exceeds 31).`,
        };
      }
      return { valid: true };
    }

    if (action.type === 'CRIB_SAY_GO') {
      if (canPlayerPegUnder31(player.peggingCards, state.runningCount)) {
        return {
          valid: false,
          reason: 'You have a legal card that fits under 31 — you cannot say Go!',
        };
      }
      return { valid: true };
    }
  }

  return { valid: false, reason: 'Invalid Cribbage action.' };
}

function findNextPeggerUnder31(
  playerOrder: readonly string[],
  players: Readonly<Record<string, CribbagePlayerState>>,
  fromIndex: number,
  runningCount: number
): number | null {
  const n = playerOrder.length;
  for (let offset = 1; offset <= n; offset++) {
    const idx = (fromIndex + offset) % n;
    const pid = playerOrder[idx]!;
    if (canPlayerPegUnder31(players[pid]!.peggingCards, runningCount)) {
      return idx;
    }
  }
  return null;
}

function findNextPlayerWithAnyPegCards(
  playerOrder: readonly string[],
  players: Readonly<Record<string, CribbagePlayerState>>,
  fromIndex: number
): number | null {
  const n = playerOrder.length;
  for (let offset = 1; offset <= n; offset++) {
    const idx = (fromIndex + offset) % n;
    const pid = playerOrder[idx]!;
    if (players[pid]!.peggingCards.length > 0) {
      return idx;
    }
  }
  return null;
}

/**
 * Scores the Show: begins with the player to the left of the dealer and continues
 * clockwise around the table until the dealer has counted their hand and the Crib last.
 * If any player reaches 121+ points (`state.targetScore`) prior to all players counting
 * their hand (or prior to the Crib), the game ends immediately right there without the
 * remaining players (or Crib) counting their hands!
 */
function scoreCribbageShowPhase(
  state: CribbageGameState,
  nextPlayers: Record<string, CribbagePlayerState>,
  lastPegActionText: string
): CribbageGameState {
  const n = state.playerOrder.length;
  const dealerId = state.playerOrder[state.dealerIndex]!;
  const showSummaries: string[] = [];

  // Score hands clockwise starting with the player to the left of the dealer (offset = 1 .. n)
  for (let offset = 1; offset <= n; offset++) {
    const idx = (state.dealerIndex + offset) % n;
    const pid = state.playerOrder[idx]!;
    const p = nextPlayers[pid]!;
    const breakdown = evaluateCribbageHand(
      p.handZone.cards,
      state.starterCard,
      false
    );
    const updatedScore = p.score + breakdown.total;

    nextPlayers[pid] = {
      ...p,
      score: updatedScore,
      lastShowBreakdown: breakdown,
      lastActionLabel: `Hand: +${breakdown.total} pts`,
    };
    showSummaries.push(`${pid} Hand +${breakdown.total}`);

    // Immediate cutoff if this player reaches 121+ points! Remaining players and Crib do NOT count.
    if (updatedScore >= state.targetScore) {
      return {
        ...state,
        phase: 'GAME_OVER',
        turnStep: 'HAND_OVER',
        turnNumber: state.turnNumber + 1,
        runningCount: 0,
        currentSequence: [],
        cribZone: {
          ...state.cribZone,
          visibility: 'public',
        },
        cribBreakdown: null,
        players: nextPlayers,
        winnerId: pid,
        lastActionSummary: `${lastPegActionText} — Show Scores: ${showSummaries.join(' • ')} — ${pid} reaches ${updatedScore} pts and wins immediately!`,
      };
    }
  }

  // Score Dealer's Crib last (only reached if no player won during hand counting)
  const cribBreakdown = evaluateCribbageHand(
    state.cribZone.cards,
    state.starterCard,
    true
  );
  const dealerAfterHand = nextPlayers[dealerId]!;
  const dealerFinalScore = dealerAfterHand.score + cribBreakdown.total;
  nextPlayers[dealerId] = {
    ...dealerAfterHand,
    score: dealerFinalScore,
    lastActionLabel: `Hand +${dealerAfterHand.lastShowBreakdown?.total ?? 0}, Crib +${cribBreakdown.total}`,
  };
  showSummaries.push(`${dealerId} Crib +${cribBreakdown.total}`);

  const winnerId = dealerFinalScore >= state.targetScore ? dealerId : null;

  return {
    ...state,
    phase: winnerId ? 'GAME_OVER' : 'PLAYING',
    turnStep: 'HAND_OVER',
    turnNumber: state.turnNumber + 1,
    runningCount: 0,
    currentSequence: [],
    cribZone: {
      ...state.cribZone,
      visibility: 'public',
    },
    cribBreakdown,
    players: nextPlayers,
    winnerId,
    lastActionSummary: `${lastPegActionText} — Show Scores: ${showSummaries.join(' • ')}`,
  };
}

export function applyCribbageAction(
  state: CribbageGameState,
  playerId: string,
  action: CribbageAction
): CribbageGameState {
  const check = validateCribbageAction(state, playerId, action);
  if (!check.valid) {
    throw new Error(check.reason ?? 'Invalid Cribbage action.');
  }

  const playerCount = state.playerOrder.length;

  if (action.type === 'CRIB_NEXT_HAND') {
    const nextDealer = (state.dealerIndex + 1) % playerCount;
    return dealCribbageHand(
      state.playerOrder,
      state.players,
      nextDealer,
      state.handNumber + 1,
      state.turnNumber + 1,
      state.prng
    );
  }

  const nextPlayers: Record<string, CribbagePlayerState> = {
    ...state.players,
  };
  const actingPlayer = nextPlayers[playerId]!;

  // 1. Discard to Crib Phase
  if (state.turnStep === 'DISCARD_TO_CRIB' && action.type === 'CRIB_DISCARD') {
    const handZone = CardZone.fromSerialized(actingPlayer.handZone);
    const cribZone = CardZone.fromSerialized(state.cribZone);

    for (const cid of action.cardIds) {
      handZone.transferTo(cribZone, cid);
    }

    const keptCards = handZone.getCards();
    nextPlayers[playerId] = {
      ...actingPlayer,
      handZone: handZone.toSerialized(),
      peggingCards: [...keptCards],
      discardedToCrib: true,
      lastActionLabel: 'Discarded to Crib ✓',
    };

    const allDiscarded = state.playerOrder.every(
      (pid) => nextPlayers[pid]!.discardedToCrib
    );

    if (!allDiscarded) {
      return {
        ...state,
        cribZone: cribZone.toSerialized(),
        players: nextPlayers,
        lastActionSummary: `${playerId} discarded to the Crib.`,
      };
    }

    // All players have discarded! Cut the starter card and check "His Heels" (Jack = +2 to dealer)
    const dealerId = state.playerOrder[state.dealerIndex]!;
    let heelsBonusText = '';
    if (state.starterCard && state.starterCard.rank === 'J') {
      const dState = nextPlayers[dealerId]!;
      nextPlayers[dealerId] = {
        ...dState,
        score: dState.score + 2,
        lastActionLabel: 'His Heels! (+2 pts)',
      };
      heelsBonusText = ` — Jack cut (${formatCardLabel(state.starterCard)})! ${dealerId} pegs +2 for His Heels!`;
    }

    const firstPegger = (state.dealerIndex + 1) % playerCount;
    const starterLabel = state.starterCard
      ? formatCardLabel(state.starterCard)
      : 'none';

    return {
      ...state,
      turnStep: 'PEGGING',
      turnNumber: state.turnNumber + 1,
      activePlayerIndex: firstPegger,
      cribZone: cribZone.toSerialized(),
      players: nextPlayers,
      lastActionSummary: `All players discarded! Starter card cut: ${starterLabel}${heelsBonusText}. ${state.playerOrder[firstPegger]} leads Pegging.`,
    };
  }

  // 2. Pegging Phase: Playing a Card
  if (state.turnStep === 'PEGGING' && action.type === 'CRIB_PLAY_CARD') {
    const playedCard = actingPlayer.peggingCards.find(
      (c) => c.id === action.cardId
    )!;
    const remainingPegCards = actingPlayer.peggingCards.filter(
      (c) => c.id !== action.cardId
    );
    const newCount = state.runningCount + getCribbagePipValue(playedCard);
    const updatedSequence: CribbagePegPlayedCard[] = [
      ...state.currentSequence,
      { playerId, card: playedCard },
    ];
    const updatedHistory: CribbagePegPlayedCard[] = [
      ...state.playedPegHistory,
      { playerId, card: playedCard },
    ];

    const pegEval = evaluatePeggingPlayPoints(updatedSequence, newCount);
    let totalPointsEarned = pegEval.points;
    const pointReasons = [...pegEval.reasons];

    // Update acting player's pegging cards first so we can check who can play next
    nextPlayers[playerId] = {
      ...actingPlayer,
      peggingCards: remainingPegCards,
    };

    const nextEligibleUnder31 =
      newCount === 31
        ? null
        : findNextPeggerUnder31(
            state.playerOrder,
            nextPlayers,
            state.activePlayerIndex,
            newCount
          );

    // If nobody can play under 31 (and we didn't already hit 31 exactly), award +1 for Go / Last Card!
    if (nextEligibleUnder31 === null && newCount < 31) {
      totalPointsEarned += 1;
      pointReasons.push('Go / Last Card (+1)');
    }

    const updatedScore = actingPlayer.score + totalPointsEarned;
    const reasonSuffix =
      pointReasons.length > 0 ? ` — ${pointReasons.join(', ')}!` : '';

    nextPlayers[playerId] = {
      ...nextPlayers[playerId]!,
      score: updatedScore,
      lastActionLabel:
        totalPointsEarned > 0
          ? `Played ${formatCardLabel(playedCard)} (+${totalPointsEarned} pts)`
          : `Played ${formatCardLabel(playedCard)} (${newCount})`,
    };

    const moveSummary = `${playerId} played ${formatCardLabel(playedCard)} (Count: ${newCount})${reasonSuffix}`;

    // Instant peg-out win check
    if (updatedScore >= state.targetScore) {
      return {
        ...state,
        phase: 'GAME_OVER',
        turnStep: 'HAND_OVER',
        turnNumber: state.turnNumber + 1,
        runningCount: newCount,
        currentSequence: updatedSequence,
        playedPegHistory: updatedHistory,
        players: nextPlayers,
        winnerId: playerId,
        lastActionSummary: `${moveSummary} — ${playerId} pegs out to ${updatedScore} pts and wins!`,
      };
    }

    // If another player can still play under 31 in this sequence
    if (nextEligibleUnder31 !== null) {
      return {
        ...state,
        turnNumber: state.turnNumber + 1,
        activePlayerIndex: nextEligibleUnder31,
        runningCount: newCount,
        currentSequence: updatedSequence,
        playedPegHistory: updatedHistory,
        players: nextPlayers,
        lastActionSummary: moveSummary,
      };
    }

    // Otherwise the count resets to 0! Check if any player still has pegging cards left
    const nextWithCards = findNextPlayerWithAnyPegCards(
      state.playerOrder,
      nextPlayers,
      state.activePlayerIndex
    );

    if (nextWithCards !== null) {
      return {
        ...state,
        turnNumber: state.turnNumber + 1,
        activePlayerIndex: nextWithCards,
        runningCount: 0,
        currentSequence: [],
        playedPegHistory: updatedHistory,
        players: nextPlayers,
        lastActionSummary: `${moveSummary} — Count resets to 0! ${state.playerOrder[nextWithCards]} leads next sequence.`,
      };
    }

    // All pegging cards have been played -> Score the Show!
    return scoreCribbageShowPhase(
      {
        ...state,
        playedPegHistory: updatedHistory,
      },
      nextPlayers,
      moveSummary
    );
  }

  // 3. Pegging Phase: Saying Go
  if (state.turnStep === 'PEGGING' && action.type === 'CRIB_SAY_GO') {
    const nextEligible = findNextPeggerUnder31(
      state.playerOrder,
      nextPlayers,
      state.activePlayerIndex,
      state.runningCount
    );
    if (nextEligible !== null) {
      return {
        ...state,
        turnNumber: state.turnNumber + 1,
        activePlayerIndex: nextEligible,
        lastActionSummary: `${playerId} says "Go!"`,
      };
    }
  }

  return state;
}

export function getCribbagePlayerPerspective(
  state: CribbageGameState,
  playerId: string
): CribbageSanitizedGameState {
  const selfPlayer =
    state.players[playerId] ?? state.players[state.playerOrder[0]!]!;
  const activePlayerId =
    state.playerOrder[state.activePlayerIndex] ?? state.playerOrder[0]!;
  const isShowReveal =
    state.turnStep === 'HAND_OVER' || state.phase === 'GAME_OVER';

  const selfPublic: CribbagePublicPlayerState = {
    id: selfPlayer.id,
    handZone: sanitizeZoneForPlayer(selfPlayer.handZone, selfPlayer.id, true),
    peggingCardsCount: selfPlayer.peggingCards.length,
    peggingCards: [...selfPlayer.peggingCards],
    discardedToCrib: selfPlayer.discardedToCrib,
    score: selfPlayer.score,
    lastActionLabel: selfPlayer.lastActionLabel,
    lastShowBreakdown: selfPlayer.lastShowBreakdown,
  };

  const opponents: Record<string, CribbagePublicPlayerState> = {};
  for (const pid of state.playerOrder) {
    if (pid === selfPlayer.id) continue;
    const opp = state.players[pid]!;
    opponents[pid] = {
      id: opp.id,
      handZone: sanitizeZoneForPlayer(
        opp.handZone,
        selfPlayer.id,
        isShowReveal
      ),
      peggingCardsCount: opp.peggingCards.length,
      peggingCards: null,
      discardedToCrib: opp.discardedToCrib,
      score: opp.score,
      lastActionLabel: opp.lastActionLabel,
      lastShowBreakdown: opp.lastShowBreakdown,
    };
  }

  return {
    gameId: 'cribbage',
    phase: state.phase,
    turnStep: state.turnStep,
    turnNumber: state.turnNumber,
    handNumber: state.handNumber,
    targetScore: state.targetScore,
    playerOrder: state.playerOrder,
    dealerIndex: state.dealerIndex,
    activePlayerIndex: state.activePlayerIndex,
    activePlayerId,
    requiredDiscardsPerPlayer: state.playerOrder.length === 2 ? 2 : 1,
    starterCard: state.starterCard,
    cribZone: sanitizeZoneForPlayer(
      state.cribZone,
      selfPlayer.id,
      isShowReveal
    ),
    cribBreakdown: state.cribBreakdown,
    runningCount: state.runningCount,
    currentSequence: state.currentSequence,
    playedPegHistory: state.playedPegHistory,
    self: selfPublic,
    opponents,
    winnerId: state.winnerId,
    lastActionSummary: state.lastActionSummary,
  };
}

export function calculateCribbageFinalScores(
  state: CribbageGameState
): Record<string, number> {
  const scores: Record<string, number> = {};
  for (const pid of state.playerOrder) {
    scores[pid] = state.players[pid]!.score;
  }
  return scores;
}

