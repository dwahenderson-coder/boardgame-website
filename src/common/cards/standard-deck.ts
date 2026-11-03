import { PRNGResult, PRNGState, shuffleArray } from '../prng.js';

export type CardSuit = 'S' | 'H' | 'D' | 'C';

export type StandardRank =
  | '2'
  | '3'
  | '4'
  | '5'
  | '6'
  | '7'
  | '8'
  | '9'
  | '10'
  | 'J'
  | 'Q'
  | 'K'
  | 'A';

export type CardRank = StandardRank | 'JOKER';

export interface StandardCard {
  readonly id: string;
  readonly suit: CardSuit | 'JOKER';
  readonly rank: CardRank;
  /** Numeric value: 2..10 = face value, J=11, Q=12, K=13, A=14, JOKER=15 */
  readonly value: number;
}

export const CARD_SUITS: readonly CardSuit[] = ['S', 'H', 'D', 'C'] as const;

export const STANDARD_RANKS: readonly StandardRank[] = [
  '2',
  '3',
  '4',
  '5',
  '6',
  '7',
  '8',
  '9',
  '10',
  'J',
  'Q',
  'K',
  'A',
] as const;

export const RANK_VALUES: Readonly<Record<CardRank, number>> = {
  '2': 2,
  '3': 3,
  '4': 4,
  '5': 5,
  '6': 6,
  '7': 7,
  '8': 8,
  '9': 9,
  '10': 10,
  J: 11,
  Q: 12,
  K: 13,
  A: 14,
  JOKER: 15,
};

export const RANK_DISPLAY_NAMES: Readonly<Record<CardRank, string>> = {
  '2': 'Two',
  '3': 'Three',
  '4': 'Four',
  '5': 'Five',
  '6': 'Six',
  '7': 'Seven',
  '8': 'Eight',
  '9': 'Nine',
  '10': 'Ten',
  J: 'Jack',
  Q: 'Queen',
  K: 'King',
  A: 'Ace',
  JOKER: 'Joker',
};

export const RANK_PLURAL_NAMES: Readonly<Record<CardRank, string>> = {
  '2': 'Twos',
  '3': 'Threes',
  '4': 'Fours',
  '5': 'Fives',
  '6': 'Sixes',
  '7': 'Sevens',
  '8': 'Eights',
  '9': 'Nines',
  '10': 'Tens',
  J: 'Jacks',
  Q: 'Queens',
  K: 'Kings',
  A: 'Aces',
  JOKER: 'Jokers',
};

export interface SuitMetadata {
  readonly suit: CardSuit;
  readonly name: string;
  readonly symbol: string;
  readonly color: 'black' | 'red';
}

export const SUIT_METADATA: Readonly<Record<CardSuit, SuitMetadata>> = {
  S: { suit: 'S', name: 'Spades', symbol: '♠', color: 'black' },
  H: { suit: 'H', name: 'Hearts', symbol: '♥', color: 'red' },
  D: { suit: 'D', name: 'Diamonds', symbol: '♦', color: 'red' },
  C: { suit: 'C', name: 'Clubs', symbol: '♣', color: 'black' },
};

export interface CreateStandardDeckOptions {
  readonly includeJokers?: boolean;
  readonly jokerCount?: number;
  readonly deckCount?: number;
}

/**
 * Generates a standard 52-card French playing card deck (plus optional Jokers or multi-deck shoe).
 */
export function createStandardDeck(
  options: CreateStandardDeckOptions = {}
): StandardCard[] {
  const deckCount = options.deckCount ?? 1;
  const includeJokers = options.includeJokers ?? false;
  const jokerCount = options.jokerCount ?? (includeJokers ? 2 : 0);

  const cards: StandardCard[] = [];

  for (let d = 0; d < deckCount; d++) {
    const prefix = deckCount > 1 ? `D${d + 1}_` : '';
    for (const suit of CARD_SUITS) {
      for (const rank of STANDARD_RANKS) {
        cards.push({
          id: `${prefix}${rank}${suit}`,
          suit,
          rank,
          value: RANK_VALUES[rank],
        });
      }
    }

    for (let j = 0; j < jokerCount; j++) {
      cards.push({
        id: `${prefix}JOKER_${j + 1}`,
        suit: 'JOKER',
        rank: 'JOKER',
        value: RANK_VALUES.JOKER,
      });
    }
  }

  return cards;
}

/**
 * Deterministically shuffles an array of cards using the platform's seedable PRNG.
 */
export function shuffleCards<T = StandardCard>(
  cards: readonly T[],
  prng: PRNGState
): PRNGResult<T[]> {
  const res = shuffleArray(cards, prng);
  return {
    value: [...res.value],
    prng: res.prng,
  };
}

/**
 * Cuts a deck of cards at the given pivot index, moving the top `pivot` cards to the bottom.
 */
export function cutCards<T = StandardCard>(
  cards: readonly T[],
  pivot: number
): T[] {
  if (cards.length === 0) return [];
  const normalized = ((pivot % cards.length) + cards.length) % cards.length;
  return [...cards.slice(normalized), ...cards.slice(0, normalized)];
}

/**
 * Formats a StandardCard into a compact human-readable label (e.g. "A♠", "10♥").
 */
export function formatCardLabel(card: StandardCard): string {
  if (card.suit === 'JOKER') return '🃏 Joker';
  return `${card.rank}${SUIT_METADATA[card.suit].symbol}`;
}

