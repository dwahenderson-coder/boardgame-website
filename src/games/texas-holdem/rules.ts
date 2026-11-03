import {
  CardZone,
  createStandardDeck,
  EvaluatedPokerHand,
  evaluateBestPokerHand,
  formatCardLabel,
  sanitizeZoneForPlayer,
  StandardCard,
} from '../../common/cards/index.js';
import { createPRNG, PRNGState } from '../../common/prng.js';
import { ValidationResult } from '../ticket-to-ride/types.js';
import {
  HoldemAction,
  HoldemGameState,
  HoldemPlayerState,
  HoldemPublicPlayerState,
  HoldemSanitizedGameState,
  HoldemStreet,
  HoldemWinnerSummary,
} from './types.js';

export const HOLDEM_STARTING_CHIPS = 1000;
export const HOLDEM_SMALL_BLIND = 10;
export const HOLDEM_BIG_BLIND = 20;

function findNextEligibleIndex(
  playerOrder: readonly string[],
  players: Readonly<Record<string, HoldemPlayerState>>,
  startIndex: number,
  predicate: (p: HoldemPlayerState) => boolean
): number {
  const count = playerOrder.length;
  for (let offset = 1; offset <= count; offset++) {
    const idx = (startIndex + offset) % count;
    const pid = playerOrder[idx]!;
    const p = players[pid]!;
    if (predicate(p)) {
      return idx;
    }
  }
  return startIndex;
}

/**
 * Deals a fresh Texas Hold'em hand using the reusable CardZone toolkit.
 */
function dealHandState(
  playerOrder: readonly string[],
  prevPlayers: Readonly<Record<string, HoldemPlayerState>>,
  dealerIndex: number,
  handNumber: number,
  smallBlind: number,
  bigBlind: number,
  prng: PRNGState
): HoldemGameState {
  // 1. Initialize & shuffle the 52-card Deck Zone
  const deckZone = new CardZone<StandardCard>({
    id: 'deck',
    name: 'Deck',
    visibility: 'hidden',
    initialCards: createStandardDeck(),
  });
  const nextPrng = deckZone.shuffle(prng);

  const burnZone = new CardZone<StandardCard>({
    id: 'burn',
    name: 'Burn Pile',
    visibility: 'hidden',
  });

  const communityZone = new CardZone<StandardCard>({
    id: 'community',
    name: 'Community Board',
    visibility: 'public',
  });

  // 2. Create private hole card zones for each player with chips > 0
  const holeZonesByPlayer = new Map<string, CardZone<StandardCard>>();
  const activeSeatIndices: number[] = [];

  playerOrder.forEach((pid, idx) => {
    const prev = prevPlayers[pid];
    const chips = prev ? prev.chips : HOLDEM_STARTING_CHIPS;
    const zone = new CardZone<StandardCard>({
      id: `hole_${pid}`,
      name: `${pid} Hole Cards`,
      visibility: 'private',
      ownerId: pid,
    });
    holeZonesByPlayer.set(pid, zone);
    if (chips > 0) {
      activeSeatIndices.push(idx);
    }
  });

  // Order hole zones starting clockwise from dealerIndex for authentic dealing
  const orderedHoleZones: CardZone<StandardCard>[] = [];
  for (let offset = 1; offset <= playerOrder.length; offset++) {
    const idx = (dealerIndex + offset) % playerOrder.length;
    const pid = playerOrder[idx]!;
    const prev = prevPlayers[pid];
    const chips = prev ? prev.chips : HOLDEM_STARTING_CHIPS;
    if (chips > 0) {
      orderedHoleZones.push(holeZonesByPlayer.get(pid)!);
    }
  }

  // Deal 2 hole cards round-robin to all non-busted players
  deckZone.dealRoundRobin(orderedHoleZones, 2);

  // 3. Determine Small Blind, Big Blind, and Pre-Flop First-to-Act (UTG)
  const isHeadsUp = activeSeatIndices.length === 2;
  const tempPlayers: Record<string, HoldemPlayerState> = {};

  for (const pid of playerOrder) {
    const prev = prevPlayers[pid];
    const chips = prev ? prev.chips : HOLDEM_STARTING_CHIPS;
    const busted = chips <= 0;
    tempPlayers[pid] = {
      id: pid,
      chips,
      holeZone: holeZonesByPlayer.get(pid)!.toSerialized(),
      currentBet: 0,
      totalHandCommit: 0,
      folded: busted,
      allIn: false,
      hasActedThisStreet: false,
      busted,
      lastActionLabel: busted ? 'Out of Chips' : null,
      handsWon: prev?.handsWon ?? 0,
    };
  }

  const smallBlindIndex = isHeadsUp
    ? dealerIndex
    : findNextEligibleIndex(
        playerOrder,
        tempPlayers,
        dealerIndex,
        (p) => !p.busted
      );

  const bigBlindIndex = findNextEligibleIndex(
    playerOrder,
    tempPlayers,
    smallBlindIndex,
    (p) => !p.busted
  );

  // Post Small Blind & Big Blind
  const sbPlayerId = playerOrder[smallBlindIndex]!;
  const bbPlayerId = playerOrder[bigBlindIndex]!;

  const sbPlayer = tempPlayers[sbPlayerId]!;
  const sbPosted = Math.min(sbPlayer.chips, smallBlind);
  tempPlayers[sbPlayerId] = {
    ...sbPlayer,
    chips: sbPlayer.chips - sbPosted,
    currentBet: sbPosted,
    totalHandCommit: sbPosted,
    allIn: sbPlayer.chips - sbPosted === 0,
    lastActionLabel: `SB $${sbPosted}`,
  };

  const bbPlayer = tempPlayers[bbPlayerId]!;
  const bbPosted = Math.min(bbPlayer.chips, bigBlind);
  tempPlayers[bbPlayerId] = {
    ...bbPlayer,
    chips: bbPlayer.chips - bbPosted,
    currentBet: bbPosted,
    totalHandCommit: bbPosted,
    allIn: bbPlayer.chips - bbPosted === 0,
    lastActionLabel: `BB $${bbPosted}`,
  };

  const pot = sbPosted + bbPosted;
  const currentBet = Math.max(sbPosted, bbPosted);

  const activePlayerIndex = findNextEligibleIndex(
    playerOrder,
    tempPlayers,
    bigBlindIndex,
    (p) => !p.busted && !p.allIn
  );

  return {
    gameId: 'holdem',
    phase: 'PLAYING',
    street: 'PREFLOP',
    turnStep: 'BETTING',
    turnNumber: handNumber,
    handNumber,
    smallBlind,
    bigBlind,
    playerOrder: [...playerOrder],
    dealerIndex,
    smallBlindIndex,
    bigBlindIndex,
    activePlayerIndex,
    pot,
    currentBet,
    minRaiseDelta: bigBlind,
    deckZone: deckZone.toSerialized(),
    burnZone: burnZone.toSerialized(),
    communityZone: communityZone.toSerialized(),
    players: tempPlayers,
    prng: nextPrng,
    winnerId: null,
    lastActionSummary: `Hand #${handNumber} dealt — ${sbPlayerId} posted SB ($${sbPosted}), ${bbPlayerId} posted BB ($${bbPosted}).`,
    lastHandWinners: [],
    showdownHands: {},
  };
}

/**
 * Initializes a new Texas Hold'em match for 2 to 6 players.
 */
export function initHoldemGame(
  playerIds: string[],
  seed: number
): HoldemGameState {
  if (playerIds.length < 2 || playerIds.length > 6) {
    throw new Error(
      `Texas Hold'em requires between 2 and 6 players (received ${playerIds.length}).`
    );
  }

  const prng = createPRNG(seed);
  const initialPlayers: Record<string, HoldemPlayerState> = {};

  for (const pid of playerIds) {
    initialPlayers[pid] = {
      id: pid,
      chips: HOLDEM_STARTING_CHIPS,
      holeZone: {
        id: `hole_${pid}`,
        name: `${pid} Hole Cards`,
        visibility: 'private',
        ownerId: pid,
        cards: [],
      },
      currentBet: 0,
      totalHandCommit: 0,
      folded: false,
      allIn: false,
      hasActedThisStreet: false,
      busted: false,
      lastActionLabel: null,
      handsWon: 0,
    };
  }

  return dealHandState(
    playerIds,
    initialPlayers,
    0,
    1,
    HOLDEM_SMALL_BLIND,
    HOLDEM_BIG_BLIND,
    prng
  );
}

/**
 * Validates whether a player's Texas Hold'em action is legal.
 */
export function validateHoldemAction(
  state: HoldemGameState,
  playerId: string,
  action: HoldemAction
): ValidationResult {
  if (state.phase === 'GAME_OVER') {
    return { valid: false, reason: 'The Texas Hold’em match has already ended.' };
  }

  const player = state.players[playerId];
  if (!player) {
    return { valid: false, reason: `Unknown player "${playerId}".` };
  }

  if (action.type === 'HOLDEM_NEXT_HAND') {
    if (state.turnStep !== 'HAND_OVER') {
      return {
        valid: false,
        reason: 'Can only deal the next hand after the current hand finishes.',
      };
    }
    return { valid: true };
  }

  if (state.turnStep !== 'BETTING') {
    return {
      valid: false,
      reason: 'Betting is complete for this hand. Click "Deal Next Hand".',
    };
  }

  const activePlayerId = state.playerOrder[state.activePlayerIndex];
  if (playerId !== activePlayerId) {
    return {
      valid: false,
      reason: `Out of turn: waiting on ${activePlayerId}.`,
    };
  }

  if (player.folded || player.busted || player.allIn) {
    return { valid: false, reason: 'Player cannot act in current state.' };
  }

  const toCall = Math.max(0, state.currentBet - player.currentBet);

  switch (action.type) {
    case 'HOLDEM_FOLD':
      return { valid: true };

    case 'HOLDEM_CHECK':
      if (toCall > 0) {
        return {
          valid: false,
          reason: `Cannot check facing a bet ($${toCall} to call).`,
        };
      }
      return { valid: true };

    case 'HOLDEM_CALL':
      if (toCall <= 0) {
        return {
          valid: false,
          reason: 'Nothing to call — use Check or Bet instead.',
        };
      }
      return { valid: true };

    case 'HOLDEM_BET_RAISE': {
      const maxTotalBet = player.currentBet + player.chips;
      const minRaiseTarget = state.currentBet + state.minRaiseDelta;

      if (action.targetBet <= state.currentBet) {
        return {
          valid: false,
          reason: `Raise target ($${action.targetBet}) must exceed the current street bet ($${state.currentBet}).`,
        };
      }
      if (action.targetBet > maxTotalBet) {
        return {
          valid: false,
          reason: `Insufficient chips for $${action.targetBet} (maximum all-in is $${maxTotalBet}).`,
        };
      }
      // Allow All-In even if it's less than a full min-raise
      if (action.targetBet < minRaiseTarget && action.targetBet < maxTotalBet) {
        return {
          valid: false,
          reason: `Minimum raise is to $${minRaiseTarget} (or All-In for $${maxTotalBet}).`,
        };
      }
      return { valid: true };
    }

    default:
      return { valid: false, reason: 'Unsupported Texas Hold’em action.' };
  }
}

/**
 * Evaluates showdown hands and distributes main pot + any all-in side pots.
 */
function resolveShowdown(
  state: HoldemGameState,
  deckZone: CardZone<StandardCard>,
  burnZone: CardZone<StandardCard>,
  communityZone: CardZone<StandardCard>
): HoldemGameState {
  // Ensure all 5 community cards are dealt
  while (communityZone.count < 5 && deckZone.count > 0) {
    if (
      communityZone.count === 0 ||
      communityZone.count === 3 ||
      communityZone.count === 4
    ) {
      deckZone.burnTo(burnZone, 1);
    }
    const needed = communityZone.count === 0 ? 3 : 1;
    communityZone.add(deckZone.draw(needed));
  }

  const communityCards = communityZone.getCards();
  const contenders = state.playerOrder.filter((pid) => {
    const p = state.players[pid]!;
    return !p.folded && !p.busted;
  });

  const showdownHands: Record<string, EvaluatedPokerHand> = {};
  for (const pid of contenders) {
    const holeCards = state.players[pid]!.holeZone.cards;
    showdownHands[pid] = evaluateBestPokerHand([
      ...holeCards,
      ...communityCards,
    ]);
  }

  // Compute side pots based on distinct non-zero totalHandCommit levels among contenders
  const commitLevels = Array.from(
    new Set(
      contenders
        .map((pid) => state.players[pid]!.totalHandCommit)
        .filter((amt) => amt > 0)
    )
  ).sort((a, b) => a - b);

  const winningsByPlayer: Record<string, number> = {};
  let prevLevel = 0;

  for (const level of commitLevels) {
    const sliceDelta = level - prevLevel;
    if (sliceDelta <= 0) continue;

    let slicePot = 0;
    for (const pid of state.playerOrder) {
      const committed = state.players[pid]!.totalHandCommit;
      const contribution = Math.max(
        0,
        Math.min(committed, level) - prevLevel
      );
      slicePot += contribution;
    }

    const eligibleContenders = contenders.filter(
      (pid) => state.players[pid]!.totalHandCommit >= level
    );

    if (eligibleContenders.length > 0 && slicePot > 0) {
      let bestScore = -1;
      let sliceWinners: string[] = [];

      for (const pid of eligibleContenders) {
        const handScore = showdownHands[pid]!.score;
        if (handScore > bestScore) {
          bestScore = handScore;
          sliceWinners = [pid];
        } else if (handScore === bestScore) {
          sliceWinners.push(pid);
        }
      }

      const share = Math.floor(slicePot / sliceWinners.length);
      let remainder = slicePot - share * sliceWinners.length;

      for (const winnerPid of sliceWinners) {
        const extra = remainder > 0 ? 1 : 0;
        if (remainder > 0) remainder--;
        winningsByPlayer[winnerPid] =
          (winningsByPlayer[winnerPid] ?? 0) + share + extra;
      }
    }

    prevLevel = level;
  }

  // Any uncalled excess above the highest contender commit level is returned to that bettor
  for (const pid of contenders) {
    const committed = state.players[pid]!.totalHandCommit;
    if (committed > prevLevel) {
      winningsByPlayer[pid] =
        (winningsByPlayer[pid] ?? 0) + (committed - prevLevel);
    }
  }

  const nextPlayers: Record<string, HoldemPlayerState> = {};
  const winnerSummaries: HoldemWinnerSummary[] = [];

  for (const pid of state.playerOrder) {
    const p = state.players[pid]!;
    const won = winningsByPlayer[pid] ?? 0;
    const evalHand = showdownHands[pid];

    if (won > 0 && evalHand) {
      winnerSummaries.push({
        playerId: pid,
        amountWon: won,
        handDescription: evalHand.description,
        bestFiveIds: evalHand.bestFive.map((c) => c.id),
      });
    }

    nextPlayers[pid] = {
      ...p,
      chips: p.chips + won,
      currentBet: 0,
      handsWon: won > 0 ? p.handsWon + 1 : p.handsWon,
      lastActionLabel:
        won > 0 && evalHand
          ? `Won $${won} (${evalHand.description})`
          : p.lastActionLabel,
    };
  }

  const playersWithChips = state.playerOrder.filter(
    (pid) => nextPlayers[pid]!.chips > 0
  );
  const isMatchOver = playersWithChips.length <= 1;
  const matchWinnerId = isMatchOver ? (playersWithChips[0] ?? null) : null;

  const summaryText =
    winnerSummaries.length > 0
      ? winnerSummaries
          .map(
            (w) => `${w.playerId} won $${w.amountWon} with ${w.handDescription}`
          )
          .join(' • ')
      : 'Showdown complete.';

  return {
    ...state,
    phase: isMatchOver ? 'GAME_OVER' : 'PLAYING',
    street: 'SHOWDOWN',
    turnStep: 'HAND_OVER',
    pot: 0,
    currentBet: 0,
    deckZone: deckZone.toSerialized(),
    burnZone: burnZone.toSerialized(),
    communityZone: communityZone.toSerialized(),
    players: nextPlayers,
    winnerId: matchWinnerId,
    lastActionSummary: summaryText,
    lastHandWinners: winnerSummaries,
    showdownHands,
  };
}

/**
 * Pure reducer applying a validated Texas Hold'em action and advancing streets or showdowns.
 */
export function applyHoldemAction(
  state: HoldemGameState,
  playerId: string,
  action: HoldemAction
): HoldemGameState {
  const validation = validateHoldemAction(state, playerId, action);
  if (!validation.valid) {
    throw new Error(validation.reason ?? 'Invalid Texas Hold’em action.');
  }

  // Handle dealing the next hand
  if (action.type === 'HOLDEM_NEXT_HAND') {
    const nextDealerIndex = findNextEligibleIndex(
      state.playerOrder,
      state.players,
      state.dealerIndex,
      (p) => p.chips > 0
    );
    return dealHandState(
      state.playerOrder,
      state.players,
      nextDealerIndex,
      state.handNumber + 1,
      state.smallBlind,
      state.bigBlind,
      state.prng
    );
  }

  const actingPlayer = state.players[playerId]!;
  const nextPlayers: Record<string, HoldemPlayerState> = { ...state.players };
  let nextPot = state.pot;
  let nextCurrentBet = state.currentBet;
  let nextMinRaiseDelta = state.minRaiseDelta;
  let actionSummary = '';

  switch (action.type) {
    case 'HOLDEM_FOLD': {
      nextPlayers[playerId] = {
        ...actingPlayer,
        folded: true,
        hasActedThisStreet: true,
        lastActionLabel: 'Folded',
      };
      actionSummary = `${playerId} folded.`;
      break;
    }

    case 'HOLDEM_CHECK': {
      nextPlayers[playerId] = {
        ...actingPlayer,
        hasActedThisStreet: true,
        lastActionLabel: 'Checked',
      };
      actionSummary = `${playerId} checked.`;
      break;
    }

    case 'HOLDEM_CALL': {
      const needed = Math.max(0, state.currentBet - actingPlayer.currentBet);
      const added = Math.min(actingPlayer.chips, needed);
      const remainingChips = actingPlayer.chips - added;
      const newStreetBet = actingPlayer.currentBet + added;
      const isAllIn = remainingChips === 0;

      nextPlayers[playerId] = {
        ...actingPlayer,
        chips: remainingChips,
        currentBet: newStreetBet,
        totalHandCommit: actingPlayer.totalHandCommit + added,
        allIn: isAllIn,
        hasActedThisStreet: true,
        lastActionLabel: isAllIn ? `All-In Call ($${added})` : `Called $${added}`,
      };
      nextPot += added;
      actionSummary = isAllIn
        ? `${playerId} called All-In for $${added}!`
        : `${playerId} called $${added}.`;
      break;
    }

    case 'HOLDEM_BET_RAISE': {
      const added = action.targetBet - actingPlayer.currentBet;
      const remainingChips = actingPlayer.chips - added;
      const isAllIn = remainingChips === 0;
      const raiseDelta = action.targetBet - state.currentBet;

      if (raiseDelta > nextMinRaiseDelta) {
        nextMinRaiseDelta = raiseDelta;
      }
      nextCurrentBet = action.targetBet;
      nextPot += added;

      // Reset other contenders' `hasActedThisStreet` so they can respond to the raise
      for (const pid of state.playerOrder) {
        const p = nextPlayers[pid]!;
        if (pid !== playerId && !p.folded && !p.busted && !p.allIn) {
          nextPlayers[pid] = {
            ...p,
            hasActedThisStreet: false,
          };
        }
      }

      const verb = state.currentBet === 0 ? 'Bet' : 'Raised to';
      nextPlayers[playerId] = {
        ...actingPlayer,
        chips: remainingChips,
        currentBet: action.targetBet,
        totalHandCommit: actingPlayer.totalHandCommit + added,
        allIn: isAllIn,
        hasActedThisStreet: true,
        lastActionLabel: isAllIn
          ? `All-In ($${action.targetBet})`
          : `${verb} $${action.targetBet}`,
      };
      actionSummary = isAllIn
        ? `${playerId} moved All-In to $${action.targetBet}!`
        : `${playerId} ${verb.toLowerCase()} $${action.targetBet}.`;
      break;
    }
  }

  // 1. Check if only 1 non-folded contender remains (everyone else folded)
  const contenders = state.playerOrder.filter((pid) => {
    const p = nextPlayers[pid]!;
    return !p.folded && !p.busted;
  });

  if (contenders.length === 1) {
    const soleWinnerId = contenders[0]!;
    const winnerState = nextPlayers[soleWinnerId]!;
    nextPlayers[soleWinnerId] = {
      ...winnerState,
      chips: winnerState.chips + nextPot,
      currentBet: 0,
      handsWon: winnerState.handsWon + 1,
      lastActionLabel: `Won $${nextPot} (Uncontested)`,
    };

    for (const pid of state.playerOrder) {
      if (pid !== soleWinnerId) {
        nextPlayers[pid] = {
          ...nextPlayers[pid]!,
          currentBet: 0,
        };
      }
    }

    const playersWithChips = state.playerOrder.filter(
      (pid) => nextPlayers[pid]!.chips > 0
    );
    const isMatchOver = playersWithChips.length <= 1;

    return {
      ...state,
      phase: isMatchOver ? 'GAME_OVER' : 'PLAYING',
      turnStep: 'HAND_OVER',
      pot: 0,
      currentBet: 0,
      players: nextPlayers,
      winnerId: isMatchOver ? soleWinnerId : null,
      lastActionSummary: `${actionSummary} ${soleWinnerId} wins $${nextPot} uncontested!`,
      lastHandWinners: [
        {
          playerId: soleWinnerId,
          amountWon: nextPot,
          handDescription: 'Uncontested Pot (Opponents Folded)',
          bestFiveIds: [],
        },
      ],
      showdownHands: {},
    };
  }

  // 2. Check if all non-all-in contenders have acted and matched `nextCurrentBet`
  const activeBettors = contenders.filter((pid) => !nextPlayers[pid]!.allIn);
  const streetComplete = activeBettors.every((pid) => {
    const p = nextPlayers[pid]!;
    return p.hasActedThisStreet && p.currentBet === nextCurrentBet;
  });

  if (!streetComplete) {
    const nextActiveIndex = findNextEligibleIndex(
      state.playerOrder,
      nextPlayers,
      state.activePlayerIndex,
      (p) => !p.folded && !p.busted && !p.allIn
    );

    return {
      ...state,
      pot: nextPot,
      currentBet: nextCurrentBet,
      minRaiseDelta: nextMinRaiseDelta,
      activePlayerIndex: nextActiveIndex,
      players: nextPlayers,
      lastActionSummary: actionSummary,
    };
  }

  // 3. Street is complete! Rehydrate CardZones to deal next street or run out Showdown
  const deckZone = CardZone.fromSerialized(state.deckZone);
  const burnZone = CardZone.fromSerialized(state.burnZone);
  const communityZone = CardZone.fromSerialized(state.communityZone);

  const intermediateState: HoldemGameState = {
    ...state,
    turnNumber: state.turnNumber + 1,
    pot: nextPot,
    currentBet: 0,
    minRaiseDelta: state.bigBlind,
    players: nextPlayers,
    lastActionSummary: actionSummary,
  };

  // If at RIVER or at most 1 contender still has chips to bet, run out to Showdown
  if (state.street === 'RIVER' || activeBettors.length <= 1) {
    return resolveShowdown(
      intermediateState,
      deckZone,
      burnZone,
      communityZone
    );
  }

  // Otherwise advance to the next street (FLOP -> TURN -> RIVER)
  let nextStreet: HoldemStreet = 'FLOP';
  let drawnCards: StandardCard[] = [];

  if (state.street === 'PREFLOP') {
    nextStreet = 'FLOP';
    deckZone.burnTo(burnZone, 1);
    drawnCards = deckZone.draw(3);
    communityZone.add(drawnCards);
  } else if (state.street === 'FLOP') {
    nextStreet = 'TURN';
    deckZone.burnTo(burnZone, 1);
    drawnCards = deckZone.draw(1);
    communityZone.add(drawnCards);
  } else if (state.street === 'TURN') {
    nextStreet = 'RIVER';
    deckZone.burnTo(burnZone, 1);
    drawnCards = deckZone.draw(1);
    communityZone.add(drawnCards);
  }

  // Reset street bets for the new betting round
  const resetPlayers: Record<string, HoldemPlayerState> = {};
  for (const pid of state.playerOrder) {
    const p = nextPlayers[pid]!;
    resetPlayers[pid] = {
      ...p,
      currentBet: 0,
      hasActedThisStreet: false,
      lastActionLabel: p.folded || p.allIn || p.busted ? p.lastActionLabel : null,
    };
  }

  // Post-flop action always starts with the first active non-all-in player left of the dealer button
  const firstPostFlopIndex = findNextEligibleIndex(
    state.playerOrder,
    resetPlayers,
    state.dealerIndex,
    (p) => !p.folded && !p.busted && !p.allIn
  );

  const dealtLabel = drawnCards.map(formatCardLabel).join(' ');

  return {
    ...intermediateState,
    street: nextStreet,
    activePlayerIndex: firstPostFlopIndex,
    deckZone: deckZone.toSerialized(),
    burnZone: burnZone.toSerialized(),
    communityZone: communityZone.toSerialized(),
    players: resetPlayers,
    lastActionSummary: `${actionSummary} — ${nextStreet} dealt: [${dealtLabel}]`,
  };
}

/**
 * Generates a player-specific perspective using CardZone sanitization (`sanitizeZoneForPlayer`).
 * Conceals opponent hole cards while betting is in progress; reveals non-folded hands at Showdown.
 */
export function getHoldemPlayerPerspective(
  state: HoldemGameState,
  playerId: string
): HoldemSanitizedGameState {
  const selfPlayer =
    state.players[playerId] ?? state.players[state.playerOrder[0]!]!;

  const selfSanitizedZone = sanitizeZoneForPlayer(
    selfPlayer.holeZone,
    selfPlayer.id,
    true
  );

  const selfPublic: HoldemPublicPlayerState = {
    id: selfPlayer.id,
    chips: selfPlayer.chips,
    holeZone: selfSanitizedZone,
    currentBet: selfPlayer.currentBet,
    totalHandCommit: selfPlayer.totalHandCommit,
    folded: selfPlayer.folded,
    allIn: selfPlayer.allIn,
    hasActedThisStreet: selfPlayer.hasActedThisStreet,
    busted: selfPlayer.busted,
    lastActionLabel: selfPlayer.lastActionLabel,
    handsWon: selfPlayer.handsWon,
  };

  const opponents: Record<string, HoldemPublicPlayerState> = {};
  const isShowdownReveal = state.street === 'SHOWDOWN';

  for (const pid of state.playerOrder) {
    if (pid === selfPlayer.id) continue;
    const opp = state.players[pid]!;
    const revealOpponent = isShowdownReveal && !opp.folded && !opp.busted;
    opponents[pid] = {
      id: opp.id,
      chips: opp.chips,
      holeZone: sanitizeZoneForPlayer(
        opp.holeZone,
        selfPlayer.id,
        revealOpponent
      ),
      currentBet: opp.currentBet,
      totalHandCommit: opp.totalHandCommit,
      folded: opp.folded,
      allIn: opp.allIn,
      hasActedThisStreet: opp.hasActedThisStreet,
      busted: opp.busted,
      lastActionLabel: opp.lastActionLabel,
      handsWon: opp.handsWon,
    };
  }

  const allVisibleForSelf = [
    ...selfPlayer.holeZone.cards,
    ...state.communityZone.cards,
  ];
  const selfBestHand =
    selfPlayer.holeZone.cards.length > 0 && !selfPlayer.busted
      ? evaluateBestPokerHand(allVisibleForSelf)
      : null;

  return {
    gameId: 'holdem',
    phase: state.phase,
    street: state.street,
    turnStep: state.turnStep,
    turnNumber: state.turnNumber,
    handNumber: state.handNumber,
    smallBlind: state.smallBlind,
    bigBlind: state.bigBlind,
    playerOrder: state.playerOrder,
    dealerIndex: state.dealerIndex,
    smallBlindIndex: state.smallBlindIndex,
    bigBlindIndex: state.bigBlindIndex,
    activePlayerIndex: state.activePlayerIndex,
    activePlayerId:
      state.playerOrder[state.activePlayerIndex] ?? state.playerOrder[0]!,
    pot: state.pot,
    currentBet: state.currentBet,
    minRaiseDelta: state.minRaiseDelta,
    deckCount: state.deckZone.cards.length,
    burnCount: state.burnZone.cards.length,
    communityCards: state.communityZone.cards,
    self: selfPublic,
    selfBestHand,
    opponents,
    winnerId: state.winnerId,
    lastActionSummary: state.lastActionSummary,
    lastHandWinners: state.lastHandWinners,
    showdownHands: state.showdownHands,
  };
}

/**
 * Computes final chip counts for the end-of-game leaderboard.
 */
export function calculateHoldemFinalScores(
  state: HoldemGameState
): Record<string, number> {
  const scores: Record<string, number> = {};
  for (const pid of state.playerOrder) {
    scores[pid] = state.players[pid]!.chips;
  }
  return scores;
}
