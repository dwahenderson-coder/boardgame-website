import {
  CardSuit,
  CardZone,
  createStandardDeck,
  formatCardLabel,
  sanitizeZoneForPlayer,
  StandardCard,
  SUIT_METADATA,
   TrickPlay,
} from '../../common/cards/index.js';
import { createPRNG, PRNGState } from '../../common/prng.js';
import { ValidationResult } from '../ticket-to-ride/types.js';
import {
  EuchreAction,
  EuchreGameState,
  EuchrePlayerState,
  EuchrePublicPlayerState,
  EuchreSanitizedGameState,
} from './types.js';

export const EUCHRE_WINNING_SCORE = 10;

const SAME_COLOR_SUIT: Readonly<Record<CardSuit, CardSuit>> = {
  S: 'C',
  C: 'S',
  H: 'D',
  D: 'H',
};

/**
 * Generates the standard 24-card Euchre deck (9, 10, J, Q, K, A of all 4 suits).
 */
export function createEuchreDeck(): StandardCard[] {
  return createStandardDeck().filter((c) => c.value >= 9 && c.suit !== 'JOKER');
}

/**
 * Returns the effective suit of a card in Euchre (accounting for the Left Bower belonging to Trump).
 */
export function getEuchreEffectiveSuit(
  card: StandardCard,
  trumpSuit: CardSuit | null
): CardSuit {
  if (card.suit === 'JOKER') return 'S';
  if (
    trumpSuit !== null &&
    card.rank === 'J' &&
    card.suit === SAME_COLOR_SUIT[trumpSuit]
  ) {
    return trumpSuit;
  }
  return card.suit;
}

/**
 * Returns the trick-winning strength of `card` given `leadSuit` and `trumpSuit`:
 * - Right Bower (J of trump) = 100
 * - Left Bower (J of same color) = 99
 * - Other Trump (A, K, Q, 10, 9) = 80 + card.value
 * - Lead Suit (A, K, Q, J, 10, 9) = 40 + card.value
 * - Off-suit = card.value
 */
export function getEuchreCardStrength(
  card: StandardCard,
  leadSuit: CardSuit,
  trumpSuit: CardSuit | null
): number {
  if (trumpSuit !== null) {
    if (card.rank === 'J' && card.suit === trumpSuit) {
      return 100; // Right Bower
    }
    if (card.rank === 'J' && card.suit === SAME_COLOR_SUIT[trumpSuit]) {
      return 99; // Left Bower
    }
    if (card.suit === trumpSuit) {
      return 80 + card.value;
    }
  }
  const effectiveSuit = getEuchreEffectiveSuit(card, trumpSuit);
  if (effectiveSuit === leadSuit) {
    return 40 + card.value;
  }
  return card.value;
}

export function evaluateEuchreTrickWinner(
  plays: readonly TrickPlay[],
  trumpSuit: CardSuit | null
): TrickPlay {
  const first = plays[0]!;
  const leadSuit = getEuchreEffectiveSuit(first.card, trumpSuit);
  let bestPlay = first;
  let bestScore = getEuchreCardStrength(first.card, leadSuit, trumpSuit);

  for (let i = 1; i < plays.length; i++) {
    const play = plays[i]!;
    const score = getEuchreCardStrength(play.card, leadSuit, trumpSuit);
    if (score > bestScore) {
      bestScore = score;
      bestPlay = play;
    }
  }
  return bestPlay;
}

export function isLegalEuchreCardPlay(
  hand: readonly StandardCard[],
  card: StandardCard,
  leadCard: StandardCard | null,
  trumpSuit: CardSuit | null
): boolean {
  if (!hand.some((c) => c.id === card.id)) {
    return false;
  }
  if (!leadCard) {
    return true;
  }
  const leadEffectiveSuit = getEuchreEffectiveSuit(leadCard, trumpSuit);
  const playedEffectiveSuit = getEuchreEffectiveSuit(card, trumpSuit);
  if (playedEffectiveSuit === leadEffectiveSuit) {
    return true;
  }
  const hasLeadSuit = hand.some(
    (c) => getEuchreEffectiveSuit(c, trumpSuit) === leadEffectiveSuit
  );
  return !hasLeadSuit;
}

function dealEuchreHand(
  playerOrder: readonly string[],
  prevPlayers: Readonly<Record<string, EuchrePlayerState>>,
  dealerIndex: number,
  handNumber: number,
  turnNumber: number,
  prng: PRNGState
): EuchreGameState {
  const deckZone = new CardZone<StandardCard>({
    id: 'euchre_deck',
    visibility: 'hidden',
    initialCards: createEuchreDeck(),
  });
  const nextPrng = deckZone.shuffle(prng);

  const handZones = new Map<string, CardZone<StandardCard>>();
  const orderedZones: CardZone<StandardCard>[] = [];

  for (let offset = 1; offset <= playerOrder.length; offset++) {
    const idx = (dealerIndex + offset) % playerOrder.length;
    const pid = playerOrder[idx]!;
    const zone = new CardZone<StandardCard>({
      id: `hand_${pid}`,
      name: `${pid} Hand`,
      visibility: 'private',
      ownerId: pid,
    });
    handZones.set(pid, zone);
    orderedZones.push(zone);
  }

  deckZone.dealRoundRobin(orderedZones, 5);
  const upcard = deckZone.draw(1)[0] ?? null;

  const players: Record<string, EuchrePlayerState> = {};
  for (const pid of playerOrder) {
    const prev = prevPlayers[pid];
    players[pid] = {
      id: pid,
      handZone: handZones.get(pid)!.toSerialized(),
      tricksWonThisHand: 0,
      score: prev?.score ?? 0,
      lastActionLabel: null,
    };
  }

  const firstBidderIndex = (dealerIndex + 1) % playerOrder.length;
  const dealerId = playerOrder[dealerIndex]!;

  return {
    gameId: 'euchre',
    phase: 'PLAYING',
    turnStep: 'ORDER_UP_ROUND',
    turnNumber,
    handNumber,
    trickNumber: 1,
    playerOrder: [...playerOrder],
    dealerIndex,
    activePlayerIndex: firstBidderIndex,
    upcard,
    turnedDownSuit: null,
    trumpSuit: null,
    makerPlayerId: null,
    currentTrick: [],
    lastCompletedTrick: null,
    kittyZone: deckZone.toSerialized(),
    players,
    prng: nextPrng,
    winnerId: null,
    lastActionSummary: `Hand #${handNumber} dealt by ${dealerId}. Upcard is ${upcard ? formatCardLabel(upcard) : 'none'} — Order It Up or Pass!`,
  };
}

export function initEuchreGame(
  playerIds: string[],
  seed: number
): EuchreGameState {
  if (playerIds.length < 2 || playerIds.length > 4) {
    throw new Error(
      `Euchre requires between 2 and 4 players (received ${playerIds.length}).`
    );
  }
  return dealEuchreHand(playerIds, {}, 0, 1, 1, createPRNG(seed));
}

export function validateEuchreAction(
  state: EuchreGameState,
  playerId: string,
  action: EuchreAction
): ValidationResult {
  if (state.phase === 'GAME_OVER') {
    return { valid: false, reason: 'The Euchre match has already ended.' };
  }

  const player = state.players[playerId];
  if (!player) {
    return { valid: false, reason: `Unknown player "${playerId}".` };
  }

  if (action.type === 'EUCHRE_NEXT_HAND') {
    if (state.turnStep !== 'HAND_OVER') {
      return {
        valid: false,
        reason: 'Can only deal the next hand after the current 5 tricks finish.',
      };
    }
    return { valid: true };
  }

  const activePlayerId = state.playerOrder[state.activePlayerIndex];
  if (playerId !== activePlayerId) {
    return {
      valid: false,
      reason: `Out of turn: waiting on ${activePlayerId}.`,
    };
  }

  if (state.turnStep === 'ORDER_UP_ROUND') {
    if (
      action.type === 'EUCHRE_ORDER_UP' ||
      action.type === 'EUCHRE_PASS_TRUMP'
    ) {
      return { valid: true };
    }
    return {
      valid: false,
      reason: 'Choose "Order Up" or "Pass" on the upcard.',
    };
  }

  if (state.turnStep === 'NAME_TRUMP_ROUND') {
    if (action.type === 'EUCHRE_PASS_TRUMP') {
      if (state.activePlayerIndex === state.dealerIndex) {
        return {
          valid: false,
          reason:
            'Stick the Dealer! As Dealer in Round 2, you must name a trump suit.',
        };
      }
      return { valid: true };
    }
    if (action.type === 'EUCHRE_CALL_TRUMP') {
      if (action.suit === state.turnedDownSuit) {
        return {
          valid: false,
          reason: `Cannot name ${SUIT_METADATA[action.suit].name} — it was already turned down!`,
        };
      }
      return { valid: true };
    }
    return { valid: false, reason: 'Choose a Trump suit or Pass.' };
  }

  if (state.turnStep === 'PLAYING_TRICK') {
    if (action.type !== 'EUCHRE_PLAY_CARD') {
      return { valid: false, reason: 'Must play a card from your hand.' };
    }
    const card = player.handZone.cards.find((c) => c.id === action.cardId);
    if (!card) {
      return { valid: false, reason: 'Card not found in your hand.' };
    }
    const leadCard = state.currentTrick[0]?.card ?? null;
    if (
      !isLegalEuchreCardPlay(
        player.handZone.cards,
        card,
        leadCard,
        state.trumpSuit
      )
    ) {
      const leadEff = leadCard
        ? getEuchreEffectiveSuit(leadCard, state.trumpSuit)
        : 'S';
      return {
        valid: false,
        reason: `Must follow suit (${SUIT_METADATA[leadEff].name}) — remember the Left Bower counts as Trump!`,
      };
    }
    return { valid: true };
  }

  return { valid: false, reason: 'Action not valid in current Euchre phase.' };
}

export function applyEuchreAction(
  state: EuchreGameState,
  playerId: string,
  action: EuchreAction
): EuchreGameState {
  const check = validateEuchreAction(state, playerId, action);
  if (!check.valid) {
    throw new Error(check.reason ?? 'Invalid Euchre action.');
  }

  const playerCount = state.playerOrder.length;

  if (action.type === 'EUCHRE_NEXT_HAND') {
    const nextDealer = (state.dealerIndex + 1) % playerCount;
    return dealEuchreHand(
      state.playerOrder,
      state.players,
      nextDealer,
      state.handNumber + 1,
      state.turnNumber + 1,
      state.prng
    );
  }

  const nextPlayers: Record<string, EuchrePlayerState> = { ...state.players };
  const actingPlayer = nextPlayers[playerId]!;

  // 1. Order Up Round
  if (state.turnStep === 'ORDER_UP_ROUND') {
    if (action.type === 'EUCHRE_ORDER_UP') {
      const trumpSuit =
        state.upcard && state.upcard.suit !== 'JOKER' ? state.upcard.suit : 'S';
      const dealerId = state.playerOrder[state.dealerIndex]!;
      const dealerState = nextPlayers[dealerId]!;

      // Dealer picks up the upcard and automatically drops their lowest off-suit card
      if (state.upcard) {
        const dealerCards = [...dealerState.handZone.cards];
        dealerCards.sort(
          (a, b) =>
            getEuchreCardStrength(a, trumpSuit, trumpSuit) -
            getEuchreCardStrength(b, trumpSuit, trumpSuit)
        );
        dealerCards[0] = state.upcard;
        nextPlayers[dealerId] = {
          ...dealerState,
          handZone: {
            ...dealerState.handZone,
            cards: dealerCards,
          },
        };
      }

      nextPlayers[playerId] = {
        ... nextPlayers[playerId]!,
        lastActionLabel: `Ordered Up ${SUIT_METADATA[trumpSuit].symbol}`,
      };

      const firstTrickLeader = (state.dealerIndex + 1) % playerCount;
      return {
        ...state,
        turnStep: 'PLAYING_TRICK',
        turnNumber: state.turnNumber + 1,
        activePlayerIndex: firstTrickLeader,
        upcard: null,
        trumpSuit,
        makerPlayerId: playerId,
        players: nextPlayers,
        lastActionSummary: `${playerId} ordered up ${SUIT_METADATA[trumpSuit].name} (${SUIT_METADATA[trumpSuit].symbol}) as Trump! ${state.playerOrder[firstTrickLeader]} leads Trick #1.`,
      };
    }

    // Passed on Order Up
    nextPlayers[playerId] = {
      ...actingPlayer,
      lastActionLabel: 'Passed',
    };

    if (state.activePlayerIndex === state.dealerIndex) {
      // Everyone passed Round 1 -> turn down upcard and start Round 2
      const turnedDown =
        state.upcard && state.upcard.suit !== 'JOKER' ? state.upcard.suit : 'S';
      const nextBidder = (state.dealerIndex + 1) % playerCount;
      return {
        ...state,
        turnStep: 'NAME_TRUMP_ROUND',
        turnNumber: state.turnNumber + 1,
        activePlayerIndex: nextBidder,
        upcard: null,
        turnedDownSuit: turnedDown,
        players: nextPlayers,
        lastActionSummary: `${playerId} turned down ${SUIT_METADATA[turnedDown].name}. Round 2: name any other suit as Trump!`,
      };
    }

    const nextBidder = (state.activePlayerIndex + 1) % playerCount;
    return {
      ...state,
      turnNumber: state.turnNumber + 1,
      activePlayerIndex: nextBidder,
      players: nextPlayers,
      lastActionSummary: `${playerId} passed on ordering up.`,
    };
  }

  // 2. Name Trump Round (Round 2)
  if (state.turnStep === 'NAME_TRUMP_ROUND') {
    if (action.type === 'EUCHRE_CALL_TRUMP') {
      const trumpSuit = action.suit;
      nextPlayers[playerId] = {
        ...actingPlayer,
        lastActionLabel: `Called ${SUIT_METADATA[trumpSuit].symbol} Trump`,
      };
      const firstTrickLeader = (state.dealerIndex + 1) % playerCount;
      return {
        ...state,
        turnStep: 'PLAYING_TRICK',
        turnNumber: state.turnNumber + 1,
        activePlayerIndex: firstTrickLeader,
        trumpSuit,
        makerPlayerId: playerId,
        players: nextPlayers,
        lastActionSummary: `${playerId} named ${SUIT_METADATA[trumpSuit].name} (${SUIT_METADATA[trumpSuit].symbol}) as Trump! ${state.playerOrder[firstTrickLeader]} leads Trick #1.`,
      };
    }

    // Passed in Round 2
    nextPlayers[playerId] = {
      ...actingPlayer,
      lastActionLabel: 'Passed',
    };
    const nextBidder = (state.activePlayerIndex + 1) % playerCount;
    return {
      ...state,
      turnNumber: state.turnNumber + 1,
      activePlayerIndex: nextBidder,
      players: nextPlayers,
      lastActionSummary: `${playerId} passed.`,
    };
  }

  // 3. Playing a Card in a Trick
  if (action.type === 'EUCHRE_PLAY_CARD') {
    const handZone = CardZone.fromSerialized(actingPlayer.handZone);
    const removed = handZone.remove((c) => c.id === action.cardId);
    const playedCard = removed[0]!;

    nextPlayers[playerId] = {
      ...actingPlayer,
      handZone: handZone.toSerialized(),
      lastActionLabel: `Played ${formatCardLabel(playedCard)}`,
    };

    const updatedTrick: TrickPlay[] = [
      ...state.currentTrick,
      { playerId, card: playedCard },
    ];

    if (updatedTrick.length < playerCount) {
      const nextPlayerIdx = (state.activePlayerIndex + 1) % playerCount;
      return {
        ...state,
        turnNumber: state.turnNumber + 1,
        activePlayerIndex: nextPlayerIdx,
        currentTrick: updatedTrick,
        players: nextPlayers,
        lastActionSummary: `${playerId} played ${formatCardLabel(playedCard)}.`,
      };
    }

    // Trick is complete! Evaluate winner using Right/Left Bower Euchre rules
    const winningPlay = evaluateEuchreTrickWinner(
      updatedTrick,
      state.trumpSuit
    );
    const trickWinnerId = winningPlay.playerId;
    const trickWinnerIdx = state.playerOrder.indexOf(trickWinnerId);
    const winnerState = nextPlayers[trickWinnerId]!;
    const newTricksWon = winnerState.tricksWonThisHand + 1;

    nextPlayers[trickWinnerId] = {
      ...winnerState,
      tricksWonThisHand: newTricksWon,
      lastActionLabel: `Won Trick #${state.trickNumber} (${formatCardLabel(winningPlay.card)})`,
    };

    const completedTrickRecord = {
      winnerId: trickWinnerId,
      plays: updatedTrick,
    };

    // Check if all 5 tricks have been played
    if (state.trickNumber < 5) {
      return {
        ...state,
        turnNumber: state.turnNumber + 1,
        trickNumber: state.trickNumber + 1,
        activePlayerIndex: trickWinnerIdx,
        currentTrick: [],
        lastCompletedTrick: completedTrickRecord,
        players: nextPlayers,
        lastActionSummary: `${playerId} played ${formatCardLabel(playedCard)} — ${trickWinnerId} won Trick #${state.trickNumber} with ${formatCardLabel(winningPlay.card)}!`,
      };
    }

    // All 5 tricks complete -> Score the Hand!
    const makerId = state.makerPlayerId ?? state.playerOrder[0]!;
    const makerSeat = state.playerOrder.indexOf(makerId);
    const isFourPlayerPartnership = playerCount === 4;

    const isOnMakersSide = (pid: string): boolean => {
      const seat = state.playerOrder.indexOf(pid);
      if (isFourPlayerPartnership) {
        return seat % 2 === makerSeat % 2;
      }
      return pid === makerId;
    };

    const makersTricks = state.playerOrder
      .filter(isOnMakersSide)
      .reduce((sum, pid) => sum + nextPlayers[pid]!.tricksWonThisHand, 0);

    let handOutcomeSummary = '';
    if (makersTricks >= 3) {
      const pts = makersTricks === 5 ? 2 : 1;
      for (const pid of state.playerOrder) {
        if (isOnMakersSide(pid)) {
          nextPlayers[pid] = {
            ...nextPlayers[pid]!,
            score: nextPlayers[pid]!.score + pts,
          };
        }
      }
      handOutcomeSummary =
        makersTricks === 5
          ? `March! Makers (${makerId}) swept all 5 tricks for +2 pts!`
          : `Makers (${makerId}) won ${makersTricks}/5 tricks for +1 pt.`;
    } else {
      // EUCHRED! Defenders get +2 points
      for (const pid of state.playerOrder) {
        if (!isOnMakersSide(pid)) {
          nextPlayers[pid] = {
            ...nextPlayers[pid]!,
            score: nextPlayers[pid]!.score + 2,
          };
        }
      }
      handOutcomeSummary = `EUCHRED! Makers (${makerId}) only took ${makersTricks} trick(s) — Defenders score +2 pts!`;
    }

    const matchWinners = state.playerOrder.filter(
      (pid) => nextPlayers[pid]!.score >= EUCHRE_WINNING_SCORE
    );
    const isGameOver = matchWinners.length > 0;

    return {
      ...state,
      phase: isGameOver ? 'GAME_OVER' : 'PLAYING',
      turnStep: 'HAND_OVER',
      turnNumber: state.turnNumber + 1,
      activePlayerIndex: trickWinnerIdx,
      currentTrick: [],
      lastCompletedTrick: completedTrickRecord,
      players: nextPlayers,
      winnerId: isGameOver ? matchWinners[0]! : null,
      lastActionSummary: `Trick #5 won by ${trickWinnerId} — ${handOutcomeSummary}`,
    };
  }

  return state;
}

export function getEuchrePlayerPerspective(
  state: EuchreGameState,
  playerId: string
): EuchreSanitizedGameState {
  const selfPlayer =
    state.players[playerId] ?? state.players[state.playerOrder[0]!]!;
  const activePlayerId =
    state.playerOrder[state.activePlayerIndex] ?? state.playerOrder[0]!;

  const selfPublic: EuchrePublicPlayerState = {
    id: selfPlayer.id,
    handZone: sanitizeZoneForPlayer(selfPlayer.handZone, selfPlayer.id, true),
    tricksWonThisHand: selfPlayer.tricksWonThisHand,
    score: selfPlayer.score,
    lastActionLabel: selfPlayer.lastActionLabel,
  };

  const opponents: Record<string, EuchrePublicPlayerState> = {};
  for (const pid of state.playerOrder) {
    if (pid === selfPlayer.id) continue;
    const opp = state.players[pid]!;
    opponents[pid] = {
      id: opp.id,
      handZone: sanitizeZoneForPlayer(opp.handZone, selfPlayer.id, false),
      tricksWonThisHand: opp.tricksWonThisHand,
      score: opp.score,
      lastActionLabel: opp.lastActionLabel,
    };
  }

  return {
    gameId: 'euchre',
    phase: state.phase,
    turnStep: state.turnStep,
    turnNumber: state.turnNumber,
    handNumber: state.handNumber,
    trickNumber: state.trickNumber,
    playerOrder: state.playerOrder,
    dealerIndex: state.dealerIndex,
    activePlayerIndex: state.activePlayerIndex,
    activePlayerId,
    upcard: state.upcard,
    turnedDownSuit: state.turnedDownSuit,
    trumpSuit: state.trumpSuit,
    makerPlayerId: state.makerPlayerId,
    currentTrick: state.currentTrick,
    lastCompletedTrick: state.lastCompletedTrick,
    kittyCount: state.kittyZone.cards.length,
    self: selfPublic,
    opponents,
    winnerId: state.winnerId,
    lastActionSummary: state.lastActionSummary,
  };
}

export function calculateEuchreFinalScores(
  state: EuchreGameState
): Record<string, number> {
  const scores: Record<string, number> = {};
  for (const pid of state.playerOrder) {
    scores[pid] = state.players[pid]!.score;
  }
  return scores;
}

