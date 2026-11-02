import { createPRNG, PRNGState, shuffleArray } from '../common/prng.js';

export interface DeckState<T> {
  readonly drawPile: readonly T[];
  readonly discardPile: readonly T[];
  readonly prng: PRNGState;
}

export interface DeckDrawResult<T> {
  readonly drawn: readonly T[];
  readonly deck: Deck<T>;
}

/**
 * Generic, deterministic Deck<T> supporting Fisher-Yates shuffle with a seedable PRNG,
 * draw(n) with automatic or explicit discard reshuffling, discard(card), and immutable
 * state serialization for pure functional state reducers.
 */
export class Deck<T> {
  private _drawPile: readonly T[];
  private _discardPile: readonly T[];
  private _prng: PRNGState;

  constructor(
    initialCards: readonly T[],
    seedOrPrng: number | PRNGState,
    discardPile: readonly T[] = [],
    autoShuffleOnInit = true
  ) {
    this._prng =
      typeof seedOrPrng === 'number' ? createPRNG(seedOrPrng) : seedOrPrng;
    this._discardPile = [...discardPile];

    if (autoShuffleOnInit) {
      const shuffled = shuffleArray(initialCards, this._prng);
      this._drawPile = shuffled.value;
      this._prng = shuffled.prng;
    } else {
      this._drawPile = [...initialCards];
    }
  }

  /**
   * Reconstructs a `Deck<T>` directly from a serialized `DeckState<T>` without re-shuffling.
   */
  public static fromState<T>(state: DeckState<T>): Deck<T> {
    return new Deck<T>(state.drawPile, state.prng, state.discardPile, false);
  }

  /**
   * Exports an immutable snapshot of the deck state.
   */
  public toState(): DeckState<T> {
    return {
      drawPile: [...this._drawPile],
      discardPile: [...this._discardPile],
      prng: { state: this._prng.state },
    };
  }

  /**
   * Number of cards currently remaining in the draw pile.
   */
  public get drawCount(): number {
    return this._drawPile.length;
  }

  /**
   * Number of cards currently in the discard pile.
   */
  public get discardCount(): number {
    return this._discardPile.length;
  }

  /**
   * Total cards across both draw and discard piles.
   */
  public get totalAvailable(): number {
    return this._drawPile.length + this._discardPile.length;
  }

  /**
   * Read-only view of the draw pile (index 0 is the top card to be drawn next).
   */
  public get drawPile(): readonly T[] {
    return this._drawPile;
  }

  /**
   * Read-only view of the discard pile.
   */
  public get discardPile(): readonly T[] {
    return this._discardPile;
  }

  /**
   * Current PRNG state of the deck.
   */
  public get prngState(): PRNGState {
    return this._prng;
  }

  /**
   * Shuffles the current draw pile in place deterministically using Fisher-Yates.
   */
  public shuffle(): this {
    const shuffled = shuffleArray(this._drawPile, this._prng);
    this._drawPile = shuffled.value;
    this._prng = shuffled.prng;
    return this;
  }

  /**
   * Shuffles the discard pile using the internal PRNG and appends it to the bottom of the draw pile.
   */
  public reshuffleDiscardIntoDeck(): this {
    if (this._discardPile.length === 0) {
      return this;
    }
    const shuffledDiscard = shuffleArray(this._discardPile, this._prng);
    this._prng = shuffledDiscard.prng;
    this._drawPile = [...this._drawPile, ...shuffledDiscard.value];
    this._discardPile = [];
    return this;
  }

  /**
   * Draws up to `n` cards from the top of the deck.
   * If the draw pile has fewer than `n` cards and the discard pile is non-empty,
   * automatically reshuffles the discard pile into the draw pile to fulfill the draw.
   * Throws an error if `n < 0` or if `strict = true` and total available cards < `n`.
   */
  public draw(n = 1, strict = false): T[] {
    if (n < 0 || !Number.isInteger(n)) {
      throw new RangeError(`Draw count must be a non-negative integer, got ${n}`);
    }
    if (n === 0) {
      return [];
    }

    if (this._drawPile.length < n && this._discardPile.length > 0) {
      this.reshuffleDiscardIntoDeck();
    }

    if (strict && this._drawPile.length < n) {
      throw new Error(
        `Insufficient cards in deck: requested ${n}, available ${this._drawPile.length}`
      );
    }

    const actualCount = Math.min(n, this._drawPile.length);
    const drawn = this._drawPile.slice(0, actualCount);
    this._drawPile = this._drawPile.slice(actualCount);
    return drawn;
  }

  /**
   * Adds one or more cards to the discard pile.
   */
  public discard(cardOrCards: T | readonly T[]): this {
    if (Array.isArray(cardOrCards)) {
      this._discardPile = [...this._discardPile, ...(cardOrCards as readonly T[])];
    } else {
      this._discardPile = [...this._discardPile, cardOrCards as T];
    }
    return this;
  }

  /**
   * Places cards at the bottom of the draw pile (used e.g. when returning unselected Destination Tickets).
   */
  public putOnBottom(cards: readonly T[]): this {
    this._drawPile = [...this._drawPile, ...cards];
    return this;
  }
}

