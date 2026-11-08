import { PRNGState, shuffleArray } from '../../common/prng.js';
import { DOMINION_CARDS } from './cards.js';
import { Card, DominionPlayerState } from './types.js';

/**
 * Deterministically shuffles an array of Dominion cards using Fisher-Yates.
 */
export function shuffleCards(
  cards: readonly Card[],
  prng: PRNGState
): { readonly shuffled: Card[]; readonly prng: PRNGState } {
  const res = shuffleArray(cards, prng);
  return {
    shuffled: [...res.value],
    prng: res.prng,
  };
}

/**
 * Draws `count` cards for a player, implementing the Dominion Recycling Rule:
 * - Draws from the top (index 0) of `player.deck`.
 * - If `player.deck` becomes empty and more cards are needed, shuffles `player.discard`
 *   using the deterministic PRNG to form the new `deck` and continues drawing.
 * - If both `deck` and `discard` are empty, stops drawing silently without crashing.
 */
export function drawCardsForPlayer(
  player: DominionPlayerState,
  count: number,
  prng: PRNGState
): {
  readonly player: DominionPlayerState;
  readonly drawn: Card[];
  readonly prng: PRNGState;
} {
  if (count <= 0) {
    return { player, drawn: [], prng };
  }

  let currentDeck = [...player.deck];
  let currentDiscard = [...player.discard];
  const currentHand = [...player.hand];
  const drawn: Card[] = [];
  let nextPrng = prng;

  for (let i = 0; i < count; i++) {
    if (currentDeck.length === 0) {
      if (currentDiscard.length === 0) {
        // Both Deck and Discard are empty: fail silently without crashing
        break;
      }
      const recycled = shuffleCards(currentDiscard, nextPrng);
      currentDeck = recycled.shuffled;
      currentDiscard = [];
      nextPrng = recycled.prng;
    }

    const topCard = currentDeck.shift();
    if (!topCard) {
      break;
    }
    currentHand.push(topCard);
    drawn.push(topCard);
  }

  return {
    player: {
      ...player,
      deck: currentDeck,
      hand: currentHand,
      discard: currentDiscard,
    },
    drawn,
    prng: nextPrng,
  };
}

/**
 * Initializes a player's starting 10-card deck (7 Coppers + 3 Estates),
 * shuffles it with the seedable PRNG, and draws an opening hand of 5 cards.
 */
export function createStartingPlayerState(
  playerId: string,
  prng: PRNGState
): {
  readonly player: DominionPlayerState;
  readonly prng: PRNGState;
} {
  const copper = DOMINION_CARDS['copper']!;
  const estate = DOMINION_CARDS['estate']!;

  const initialTen: Card[] = [
    copper,
    copper,
    copper,
    copper,
    copper,
    copper,
    copper,
    estate,
    estate,
    estate,
  ];

  const { shuffled, prng: afterShuffle } = shuffleCards(initialTen, prng);

  const basePlayer: DominionPlayerState = {
    id: playerId,
    deck: shuffled,
    hand: [],
    inPlay: [],
    discard: [],
    actions: 1,
    buys: 1,
    coins: 0,
    merchantsPlayedThisTurn: 0,
    silverPlayedThisTurn: false,
  };

  const drawnResult = drawCardsForPlayer(basePlayer, 5, afterShuffle);
  return {
    player: drawnResult.player,
    prng: drawnResult.prng,
  };
}

/**
 * Removes a specific list of card IDs (one instance per ID in `cardIds`) from a player's hand.
 */
export function removeCardsFromHand(
  hand: readonly Card[],
  cardIds: readonly string[]
): {
  readonly valid: boolean;
  readonly reason?: string;
  readonly remainingHand: Card[];
  readonly removedCards: Card[];
} {
  const remaining = [...hand];
  const removed: Card[] = [];

  for (const rawId of cardIds) {
    const normalized = rawId.trim().toLowerCase();
    const idx = remaining.findIndex(
      (c) => c.id.toLowerCase() === normalized || c.name.toLowerCase() === normalized
    );
    if (idx === -1) {
      return {
        valid: false,
        reason: `Card "${rawId}" is not in player's hand.`,
        remainingHand: [...hand],
        removedCards: [],
      };
    }
    const [card] = remaining.splice(idx, 1);
    removed.push(card!);
  }

  return {
    valid: true,
    remainingHand: remaining,
    removedCards: removed,
  };
}

/**
 * Returns all cards owned by a player across Deck, Hand, Discard, and In-Play.
 */
export function getAllOwnedCards(player: DominionPlayerState): Card[] {
  return [
    ...player.deck,
    ...player.hand,
    ...player.discard,
    ...player.inPlay,
  ];
}

/**
 * Calculates a player's total Victory Points across Deck, Hand, Discard, and In-Play.
 * Includes Estates (+1), Duchies (+3), Provinces (+6), Curses (-1), and Gardens (+1 per 10 total cards owned, rounded down).
 */
export function calculatePlayerVictoryPoints(
  player: DominionPlayerState
): number {
  const allCards = getAllOwnedCards(player);
  const totalCardCount = allCards.length;
  const gardensBonusPerCard = Math.floor(totalCardCount / 10);

  let totalVp = 0;
  for (const card of allCards) {
    if (card.customEffectId === 'GARDENS' || card.id === 'gardens') {
      totalVp += gardensBonusPerCard;
    } else {
      totalVp += card.vp;
    }
  }
  return totalVp;
}
