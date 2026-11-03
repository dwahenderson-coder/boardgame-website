import { PRNGState, shuffleArray } from '../prng.js';
import { StandardCard } from './standard-deck.js';

export type ZoneVisibility = 'public' | 'private' | 'hidden';

export interface SerializedCardZone<
  T extends { readonly id: string } = StandardCard,
> {
  readonly id: string;
  readonly name: string;
  readonly visibility: ZoneVisibility;
  readonly ownerId: string | null;
  readonly cards: readonly T[];
}

export interface SanitizedCardZone<
  T extends { readonly id: string } = StandardCard,
> {
  readonly id: string;
  readonly name: string;
  readonly visibility: ZoneVisibility;
  readonly ownerId: string | null;
  readonly cardCount: number;
  /**
   * Present only when `visibility === 'public'` or `ownerId === viewingPlayerId`
   * (or when explicitly revealed at showdown). Otherwise `null` to prevent client leaks.
   */
  readonly cards: readonly T[] | null;
}

/**
 * Pure helper to sanitize a serialized card zone for a specific player's perspective.
 */
export function sanitizeZoneForPlayer<
  T extends { readonly id: string } = StandardCard,
>(
  zone: SerializedCardZone<T>,
  viewingPlayerId: string,
  forceReveal = false
): SanitizedCardZone<T> {
  const canSeeCards =
    forceReveal ||
    zone.visibility === 'public' ||
    (zone.visibility === 'private' &&
      zone.ownerId !== null &&
      zone.ownerId === viewingPlayerId);

  return {
    id: zone.id,
    name: zone.name,
    visibility: zone.visibility,
    ownerId: zone.ownerId,
    cardCount: zone.cards.length,
    cards: canSeeCards ? [...zone.cards] : null,
  };
}

/**
 * Universal bounded spatial zone for card games (Deck, Hand, Discard, Trick, Community Board, Meld).
 * Standardizes drawing, dealing, burning, cutting, transferring, and perspective sanitization.
 */
export class CardZone<T extends { readonly id: string } = StandardCard> {
  public readonly id: string;
  public readonly name: string;
  public readonly visibility: ZoneVisibility;
  public readonly ownerId: string | null;
  private cards: T[];

  public constructor(options: {
    id: string;
    name?: string;
    visibility?: ZoneVisibility;
    ownerId?: string | null;
    initialCards?: readonly T[];
  }) {
    this.id = options.id;
    this.name = options.name ?? options.id;
    this.visibility = options.visibility ?? 'hidden';
    this.ownerId = options.ownerId ?? null;
    this.cards = options.initialCards ? [...options.initialCards] : [];
  }

  public get count(): number {
    return this.cards.length;
  }

  public get isEmpty(): boolean {
    return this.cards.length === 0;
  }

  public peekTop(count = 1): readonly T[] {
    return this.cards.slice(0, Math.max(0, count));
  }

  public getCards(): readonly T[] {
    return [...this.cards];
  }

  /**
   * Draws up to `count` cards from the top of the zone.
   */
  public draw(count = 1): T[] {
    if (count <= 0 || this.cards.length === 0) {
      return [];
    }
    return this.cards.splice(0, count);
  }

  /**
   * Adds one or more cards to the zone (defaults to the bottom/end of the zone).
   */
  public add(cards: T | readonly T[], position: 'top' | 'bottom' = 'bottom'): void {
    const list: readonly T[] = Array.isArray(cards)
      ? (cards as readonly T[])
      : [cards as T];
    if (position === 'top') {
      this.cards.unshift(...list);
    } else {
      this.cards.push(...list);
    }
  }

  /**
   * Removes and returns all cards matching `predicate`.
   */
  public remove(predicate: (c: T) => boolean): T[] {
    const removed: T[] = [];
    const remaining: T[] = [];
    for (const card of this.cards) {
      if (predicate(card)) {
        removed.push(card);
      } else {
        remaining.push(card);
      }
    }
    this.cards = remaining;
    return removed;
  }

  /**
   * Transfers a single card by `cardId` from this zone to `targetZone`.
   */
  public transferTo(targetZone: CardZone<T>, cardId: string): boolean {
    const removed = this.remove((c) => c.id === cardId);
    if (removed.length === 0) {
      return false;
    }
    targetZone.add(removed);
    return true;
  }

  /**
   * Burns `count` cards from the top of this zone into `burnZone`.
   */
  public burnTo(burnZone: CardZone<T>, count = 1): T[] {
    const burned = this.draw(count);
    burnZone.add(burned);
    return burned;
  }

  /**
   * Deals `cardsPerTarget` cards in round-robin order to the provided target zones.
   */
  public dealRoundRobin(
    targets: readonly CardZone<T>[],
    cardsPerTarget: number
  ): void {
    for (let round = 0; round < cardsPerTarget; round++) {
      for (const target of targets) {
        const drawn = this.draw(1);
        if (drawn.length > 0) {
          target.add(drawn);
        }
      }
    }
  }

  /**
   * Deterministically shuffles the cards in this zone using the provided PRNG state.
   */
  public shuffle(prng: PRNGState): PRNGState {
    const shuffled = shuffleArray(this.cards, prng);
    this.cards = [...shuffled.value];
    return shuffled.prng;
  }

  /**
   * Cuts the zone at `pivotIndex` (moving the top `pivotIndex` cards to the bottom).
   */
  public cut(pivotIndex: number): void {
    if (this.cards.length === 0) return;
    const norm =
      ((pivotIndex % this.cards.length) + this.cards.length) %
      this.cards.length;
    this.cards = [...this.cards.slice(norm), ...this.cards.slice(0, norm)];
  }

  /**
   * Recycles all cards from `discardZone` into this zone and shuffles deterministically.
   */
  public recycleFrom(discardZone: CardZone<T>, prng: PRNGState): PRNGState {
    const recycled = discardZone.draw(discardZone.count);
    this.add(recycled, 'bottom');
    return this.shuffle(prng);
  }

  public clear(): T[] {
    const all = [...this.cards];
    this.cards = [];
    return all;
  }

  public toSerialized(): SerializedCardZone<T> {
    return {
      id: this.id,
      name: this.name,
      visibility: this.visibility,
      ownerId: this.ownerId,
      cards: [...this.cards],
    };
  }

  public toSanitized(
    viewingPlayerId: string,
    forceReveal = false
  ): SanitizedCardZone<T> {
    return sanitizeZoneForPlayer(
      this.toSerialized(),
      viewingPlayerId,
      forceReveal
    );
  }

  public static fromSerialized<
    T extends { readonly id: string } = StandardCard,
  >(data: SerializedCardZone<T>): CardZone<T> {
    return new CardZone<T>({
      id: data.id,
      name: data.name,
      visibility: data.visibility,
      ownerId: data.ownerId,
      initialCards: data.cards,
    });
  }
}

