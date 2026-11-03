import {
  CardRank,
  RANK_DISPLAY_NAMES,
  RANK_PLURAL_NAMES,
  StandardCard,
} from '../standard-deck.js';

export type PokerHandCategory =
  | 'HIGH_CARD'
  | 'ONE_PAIR'
  | 'TWO_PAIR'
  | 'THREE_OF_A_KIND'
  | 'STRAIGHT'
  | 'FLUSH'
  | 'FULL_HOUSE'
  | 'FOUR_OF_A_KIND'
  | 'STRAIGHT_FLUSH'
  | 'ROYAL_FLUSH';

export const POKER_CATEGORY_RANK: Readonly<Record<PokerHandCategory, number>> = {
  HIGH_CARD: 0,
  ONE_PAIR: 1,
  TWO_PAIR: 2,
  THREE_OF_A_KIND: 3,
  STRAIGHT: 4,
  FLUSH: 5,
  FULL_HOUSE: 6,
  FOUR_OF_A_KIND: 7,
  STRAIGHT_FLUSH: 8,
  ROYAL_FLUSH: 9,
};

export const POKER_CATEGORY_LABELS: Readonly<Record<PokerHandCategory, string>> =
  {
    HIGH_CARD: 'High Card',
    ONE_PAIR: 'One Pair',
    TWO_PAIR: 'Two Pair',
    THREE_OF_A_KIND: 'Three of a Kind',
    STRAIGHT: 'Straight',
    FLUSH: 'Flush',
    FULL_HOUSE: 'Full House',
    FOUR_OF_A_KIND: 'Four of a Kind',
    STRAIGHT_FLUSH: 'Straight Flush',
    ROYAL_FLUSH: 'Royal Flush',
  };

export interface EvaluatedPokerHand {
  readonly category: PokerHandCategory;
  readonly categoryRank: number;
  /**
   * Monotonic numeric score encoding categoryRank and up to 5 tiebreaker ranks in base-16.
   * Hands with higher `score` strictly beat hands with lower `score`; equal `score` is a split pot.
   */
  readonly score: number;
  readonly tiebreakers: readonly number[];
  readonly bestFive: readonly StandardCard[];
  readonly description: string;
}

const VALUE_TO_RANK: Readonly<Record<number, CardRank>> = {
  1: 'A',
  2: '2',
  3: '3',
  4: '4',
  5: '5',
  6: '6',
  7: '7',
  8: '8',
  9: '9',
  10: '10',
  11: 'J',
  12: 'Q',
  13: 'K',
  14: 'A',
};

function valueToSingular(val: number): string {
  const rank = VALUE_TO_RANK[val] ?? 'A';
  return RANK_DISPLAY_NAMES[rank];
}

function valueToPlural(val: number): string {
  const rank = VALUE_TO_RANK[val] ?? 'A';
  return RANK_PLURAL_NAMES[rank];
}

function encodePokerScore(
  categoryRank: number,
  tiebreakers: readonly number[]
): number {
  let score = categoryRank;
  for (let i = 0; i < 5; i++) {
    score = score * 16 + (tiebreakers[i] ?? 0);
  }
  return score;
}

/**
 * Evaluates an exact 5-card poker hand.
 */
export function evaluateFiveCardPokerHand(
  fiveCards: readonly StandardCard[]
): EvaluatedPokerHand {
  if (fiveCards.length !== 5) {
    throw new Error(
      `evaluateFiveCardPokerHand requires exactly 5 cards (received ${fiveCards.length}).`
    );
  }

  const sorted = [...fiveCards].sort((a, b) => b.value - a.value);
  const values = sorted.map((c) => c.value);

  const firstSuit = sorted[0]!.suit;
  const isFlush =
    firstSuit !== 'JOKER' && sorted.every((c) => c.suit === firstSuit);

  // Check Straight (including Ace-low wheel A-5-4-3-2)
  const uniqueValues = Array.from(new Set(values));
  let isStraight = false;
  let straightHigh = 0;

  if (uniqueValues.length === 5) {
    if (values[0]! - values[4]! === 4) {
      isStraight = true;
      straightHigh = values[0]!;
    } else if (
      values[0] === 14 &&
      values[1] === 5 &&
      values[2] === 4 &&
      values[3] === 3 &&
      values[4] === 2
    ) {
      isStraight = true;
      straightHigh = 5; // 5-high wheel straight
    }
  }

  // Group counts by rank value
  const countsByValue = new Map<number, StandardCard[]>();
  for (const card of sorted) {
    const existing = countsByValue.get(card.value) ?? [];
    existing.push(card);
    countsByValue.set(card.value, existing);
  }

  // Sort groups by (count DESC, value DESC)
  const groups = Array.from(countsByValue.entries()).sort((a, b) => {
    if (b[1].length !== a[1].length) {
      return b[1].length - a[1].length;
    }
    return b[0] - a[0];
  });

  const orderedCards =
    isStraight && straightHigh === 5
      ? [sorted[1]!, sorted[2]!, sorted[3]!, sorted[4]!, sorted[0]!]
      : groups.flatMap(([, grp]) => grp);

  // 1. Royal Flush & Straight Flush
  if (isFlush && isStraight) {
    if (straightHigh === 14) {
      const category: PokerHandCategory = 'ROYAL_FLUSH';
      const tiebreakers = [14];
      return {
        category,
        categoryRank: POKER_CATEGORY_RANK[category],
        score: encodePokerScore(POKER_CATEGORY_RANK[category], tiebreakers),
        tiebreakers,
        bestFive: orderedCards,
        description: 'Royal Flush',
      };
    }
    const category: PokerHandCategory = 'STRAIGHT_FLUSH';
    const tiebreakers = [straightHigh];
    return {
      category,
      categoryRank: POKER_CATEGORY_RANK[category],
      score: encodePokerScore(POKER_CATEGORY_RANK[category], tiebreakers),
      tiebreakers,
      bestFive: orderedCards,
      description: `Straight Flush, ${valueToSingular(straightHigh)} High`,
    };
  }

  const topCount = groups[0]![1].length;
  const secondCount = groups[1]?.[1].length ?? 0;

  // 2. Four of a Kind
  if (topCount === 4) {
    const quadVal = groups[0]![0];
    const kickerVal = groups[1]![0];
    const category: PokerHandCategory = 'FOUR_OF_A_KIND';
    const tiebreakers = [quadVal, kickerVal];
    return {
      category,
      categoryRank: POKER_CATEGORY_RANK[category],
      score: encodePokerScore(POKER_CATEGORY_RANK[category], tiebreakers),
      tiebreakers,
      bestFive: orderedCards,
      description: `Four of a Kind, ${valueToPlural(quadVal)}`,
    };
  }

  // 3. Full House
  if (topCount === 3 && secondCount === 2) {
    const tripVal = groups[0]![0];
    const pairVal = groups[1]![0];
    const category: PokerHandCategory = 'FULL_HOUSE';
    const tiebreakers = [tripVal, pairVal];
    return {
      category,
      categoryRank: POKER_CATEGORY_RANK[category],
      score: encodePokerScore(POKER_CATEGORY_RANK[category], tiebreakers),
      tiebreakers,
      bestFive: orderedCards,
      description: `Full House, ${valueToPlural(tripVal)} full of ${valueToPlural(pairVal)}`,
    };
  }

  // 4. Flush
  if (isFlush) {
    const category: PokerHandCategory = 'FLUSH';
    const tiebreakers = values;
    return {
      category,
      categoryRank: POKER_CATEGORY_RANK[category],
      score: encodePokerScore(POKER_CATEGORY_RANK[category], tiebreakers),
      tiebreakers,
      bestFive: sorted,
      description: `Flush, ${valueToSingular(values[0]!)} High`,
    };
  }

  // 5. Straight
  if (isStraight) {
    const category: PokerHandCategory = 'STRAIGHT';
    const tiebreakers = [straightHigh];
    return {
      category,
      categoryRank: POKER_CATEGORY_RANK[category],
      score: encodePokerScore(POKER_CATEGORY_RANK[category], tiebreakers),
      tiebreakers,
      bestFive: orderedCards,
      description: `Straight, ${valueToSingular(straightHigh)} High`,
    };
  }

  // 6. Three of a Kind
  if (topCount === 3) {
    const tripVal = groups[0]![0];
    const k1 = groups[1]![0];
    const k2 = groups[2]![0];
    const category: PokerHandCategory = 'THREE_OF_A_KIND';
    const tiebreakers = [tripVal, k1, k2];
    return {
      category,
      categoryRank: POKER_CATEGORY_RANK[category],
      score: encodePokerScore(POKER_CATEGORY_RANK[category], tiebreakers),
      tiebreakers,
      bestFive: orderedCards,
      description: `Three of a Kind, ${valueToPlural(tripVal)}`,
    };
  }

  // 7. Two Pair
  if (topCount === 2 && secondCount === 2) {
    const highPair = groups[0]![0];
    const lowPair = groups[1]![0];
    const kicker = groups[2]![0];
    const category: PokerHandCategory = 'TWO_PAIR';
    const tiebreakers = [highPair, lowPair, kicker];
    return {
      category,
      categoryRank: POKER_CATEGORY_RANK[category],
      score: encodePokerScore(POKER_CATEGORY_RANK[category], tiebreakers),
      tiebreakers,
      bestFive: orderedCards,
      description: `Two Pair, ${valueToPlural(highPair)} & ${valueToPlural(lowPair)}`,
    };
  }

  // 8. One Pair
  if (topCount === 2) {
    const pairVal = groups[0]![0];
    const k1 = groups[1]![0];
    const k2 = groups[2]![0];
    const k3 = groups[3]![0];
    const category: PokerHandCategory = 'ONE_PAIR';
    const tiebreakers = [pairVal, k1, k2, k3];
    return {
      category,
      categoryRank: POKER_CATEGORY_RANK[category],
      score: encodePokerScore(POKER_CATEGORY_RANK[category], tiebreakers),
      tiebreakers,
      bestFive: orderedCards,
      description: `Pair of ${valueToPlural(pairVal)}`,
    };
  }

  // 9. High Card
  const category: PokerHandCategory = 'HIGH_CARD';
  const tiebreakers = values;
  return {
    category,
    categoryRank: POKER_CATEGORY_RANK[category],
    score: encodePokerScore(POKER_CATEGORY_RANK[category], tiebreakers),
    tiebreakers,
    bestFive: sorted,
    description: `${valueToSingular(values[0]!)} High`,
  };
}

/**
 * Evaluates the best 5-card Poker hand from 5, 6, or 7 cards (e.g. Texas Hold'em 2 hole + 3..5 community).
 * Also supports evaluating partial pre-flop 2-card hands for UI preview badges.
 */
export function evaluateBestPokerHand(
  cards: readonly StandardCard[]
): EvaluatedPokerHand {
  if (cards.length < 5) {
    // Pre-flop or fewer than 5 cards: evaluate pair vs high card for live HUD helper
    const sorted = [...cards].sort((a, b) => b.value - a.value);
    if (sorted.length >= 2 && sorted[0]!.value === sorted[1]!.value) {
      const pairVal = sorted[0]!.value;
      return {
        category: 'ONE_PAIR',
        categoryRank: POKER_CATEGORY_RANK.ONE_PAIR,
        score: encodePokerScore(POKER_CATEGORY_RANK.ONE_PAIR, [pairVal]),
        tiebreakers: [pairVal],
        bestFive: sorted,
        description: `Pocket ${valueToPlural(pairVal)}`,
      };
    }
    const topVal = sorted[0]?.value ?? 2;
    return {
      category: 'HIGH_CARD',
      categoryRank: POKER_CATEGORY_RANK.HIGH_CARD,
      score: encodePokerScore(
        POKER_CATEGORY_RANK.HIGH_CARD,
        sorted.map((c) => c.value)
      ),
      tiebreakers: sorted.map((c) => c.value),
      bestFive: sorted,
      description: `${valueToSingular(topVal)} High`,
    };
  }

  if (cards.length === 5) {
    return evaluateFiveCardPokerHand(cards);
  }

  // Generate all C(n, 5) combinations (at most C(7, 5) = 21 combinations)
  let best: EvaluatedPokerHand | null = null;
  const n = cards.length;

  for (let a = 0; a < n - 4; a++) {
    for (let b = a + 1; b < n - 3; b++) {
      for (let c = b + 1; c < n - 2; c++) {
        for (let d = c + 1; d < n - 1; d++) {
          for (let e = d + 1; e < n; e++) {
            const combo: StandardCard[] = [
              cards[a]!,
              cards[b]!,
              cards[c]!,
              cards[d]!,
              cards[e]!,
            ];
            const evaluated = evaluateFiveCardPokerHand(combo);
            if (!best || evaluated.score > best.score) {
              best = evaluated;
            }
          }
        }
      }
    }
  }

  return best!;
}

/**
 * Compares two evaluated poker hands: returns > 0 if `a` beats `b`, < 0 if `b` beats `a`, or 0 for a tie.
 */
export function comparePokerHands(
  a: EvaluatedPokerHand,
  b: EvaluatedPokerHand
): number {
  return a.score - b.score;
}

