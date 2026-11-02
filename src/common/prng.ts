/**
 * Pure, deterministic, seedable Pseudo-Random Number Generator (Mulberry32).
 * Produces both a random value in [0, 1) (or integer range) and the next PRNG state.
 */

export interface PRNGState {
  readonly state: number;
}

export interface PRNGResult<T> {
  readonly value: T;
  readonly prng: PRNGState;
}

/**
 * Initializes a deterministic PRNG state from an arbitrary integer seed.
 */
export function createPRNG(seed: number): PRNGState {
  // Ensure 32-bit unsigned integer state
  return { state: seed >>> 0 };
}

/**
 * Advances the Mulberry32 generator by one step, returning a float in [0, 1) and the new state.
 */
export function nextFloat(prng: PRNGState): PRNGResult<number> {
  let t = (prng.state + 0x6d2b79f5) | 0;
  const nextState = t >>> 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  const value = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  return {
    value,
    prng: { state: nextState },
  };
}

/**
 * Generates a deterministic integer in [min, max] (inclusive) and returns the new PRNG state.
 */
export function nextInt(
  prng: PRNGState,
  min: number,
  max: number
): PRNGResult<number> {
  if (min > max) {
    throw new RangeError(`Invalid range: min (${min}) > max (${max})`);
  }
  const { value, prng: nextPrng } = nextFloat(prng);
  const intValue = Math.floor(value * (max - min + 1)) + min;
  return {
    value: intValue,
    prng: nextPrng,
  };
}

/**
 * Pure deterministic Fisher-Yates (Knuth) shuffle using the provided PRNG state.
 * Does not mutate the input array.
 */
export function shuffleArray<T>(
  items: readonly T[],
  prng: PRNGState
): PRNGResult<readonly T[]> {
  const result = [...items];
  let currentPrng = prng;

  for (let i = result.length - 1; i > 0; i--) {
    const rand = nextInt(currentPrng, 0, i);
    currentPrng = rand.prng;
    const j = rand.value;
    const temp = result[i]!;
    result[i] = result[j]!;
    result[j] = temp;
  }

  return {
    value: result,
    prng: currentPrng,
  };
}

