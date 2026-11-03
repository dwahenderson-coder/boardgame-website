import { CardSuit, StandardCard } from '../standard-deck.js';

export interface TrickPlay {
  readonly playerId: string;
  readonly card: StandardCard;
}

/**
 * Evaluates a completed trick (e.g., Hearts, Spades, Euchre, Bridge) and returns the winning play.
 * - First card played defines the `leadSuit`.
 * - If any card of `trumpSuit` is played, the highest-value trump card wins.
 * - Otherwise, the highest-value card matching `leadSuit` wins.
 */
export function evaluateTrickWinner(
  plays: readonly TrickPlay[],
  trumpSuit: CardSuit | null = null
): TrickPlay {
  if (plays.length === 0) {
    throw new Error('Cannot evaluate an empty trick.');
  }

  const firstPlay = plays[0]!;
  const leadSuit = firstPlay.card.suit;
  let winningPlay = firstPlay;

  for (let i = 1; i < plays.length; i++) {
    const candidate = plays[i]!;
    const winnerIsTrump =
      trumpSuit !== null && winningPlay.card.suit === trumpSuit;
    const candidateIsTrump =
      trumpSuit !== null && candidate.card.suit === trumpSuit;

    if (candidateIsTrump && !winnerIsTrump) {
      winningPlay = candidate;
    } else if (candidateIsTrump && winnerIsTrump) {
      if (candidate.card.value > winningPlay.card.value) {
        winningPlay = candidate;
      }
    } else if (!winnerIsTrump && candidate.card.suit === leadSuit) {
      if (candidate.card.value > winningPlay.card.value) {
        winningPlay = candidate;
      }
    }
  }

  return winningPlay;
}

/**
 * Checks whether a player's hand contains at least one card matching `leadSuit`.
 */
export function hasSuitInHand(
  hand: readonly StandardCard[],
  leadSuit: CardSuit
): boolean {
  return hand.some((c) => c.suit === leadSuit);
}

/**
 * Validates whether playing `card` from `hand` satisfies suit-following rules.
 */
export function isLegalTrickPlay(
  hand: readonly StandardCard[],
  card: StandardCard,
  leadSuit: CardSuit | null,
  mustFollowSuit = true
): boolean {
  if (!hand.some((c) => c.id === card.id)) {
    return false;
  }
  if (!mustFollowSuit || leadSuit === null) {
    return true;
  }
  if (card.suit === leadSuit) {
    return true;
  }
  return !hasSuitInHand(hand, leadSuit);
}

