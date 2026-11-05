import { PRNGState, shuffleArray } from '../../common/prng.js';
import {
  ALL_POWER_GRID_RESOURCES,
  INITIAL_MARKET_INVENTORY,
  PLAYER_COUNT_CONFIGS,
  RESOURCE_PRICE_SLOTS,
  RESOURCE_RESTOCK_TABLE,
  STANDARD_POWER_PLANTS,
  STEP_3_CARD,
  STEP_3_CARD_ID,
  TOTAL_RESOURCE_SUPPLY,
} from './constants.js';
import {
  OwnedPowerPlant,
  PowerGridResource,
  PowerGridStep,
  PowerPlantCard,
  ResourceMarketState,
} from './types.js';

export function createEmptyResourceStorage(): Record<PowerGridResource, number> {
  return {
    COAL: 0,
    OIL: 0,
    GARBAGE: 0,
    URANIUM: 0,
  };
}

export function createInitialResourceMarket(): ResourceMarketState {
  const inventory: Record<PowerGridResource, number> = {
    ...INITIAL_MARKET_INVENTORY,
  };
  const totalSupplyPool: Record<PowerGridResource, number> = {
    COAL: TOTAL_RESOURCE_SUPPLY.COAL - inventory.COAL,
    OIL: TOTAL_RESOURCE_SUPPLY.OIL - inventory.OIL,
    GARBAGE: TOTAL_RESOURCE_SUPPLY.GARBAGE - inventory.GARBAGE,
    URANIUM: TOTAL_RESOURCE_SUPPLY.URANIUM - inventory.URANIUM,
  };
  return {
    inventory,
    totalSupplyPool,
  };
}

/**
 * Returns the unit price of the next single available token of `resource` in the market,
 * or `null` if the market has 0 tokens of that resource.
 */
export function getNextUnitCost(
  market: ResourceMarketState,
  resource: PowerGridResource
): number | null {
  const available = market.inventory[resource];
  if (available <= 0) {
    return null;
  }
  const ladder = RESOURCE_PRICE_SLOTS[resource];
  const slotIndex = Math.max(0, ladder.length - available);
  return ladder[slotIndex] ?? null;
}

/**
 * Calculates the cumulative Elektro cost of purchasing `quantity` units of `resource`
 * from the dynamic supply/demand ladder. Returns `null` if insufficient inventory.
 */
export function calculateResourcePurchaseCost(
  market: ResourceMarketState,
  resource: PowerGridResource,
  quantity: number
): number | null {
  if (quantity < 0 || !Number.isInteger(quantity)) {
    return null;
  }
  if (quantity === 0) {
    return 0;
  }
  const available = market.inventory[resource];
  if (quantity > available) {
    return null;
  }

  const ladder = RESOURCE_PRICE_SLOTS[resource];
  const startIndex = ladder.length - available;
  let totalCost = 0;
  for (let i = 0; i < quantity; i++) {
    totalCost += ladder[startIndex + i]!;
  }
  return totalCost;
}

/**
 * Executes a resource purchase from the market, deducting `quantity` from `market.inventory`.
 * Note: Purchased tokens move onto player power plants, so `totalSupplyPool` (unplaced box supply)
 * does not increase until those tokens are burned in Phase 5 or discarded.
 */
export function purchaseMarketResources(
  market: ResourceMarketState,
  resource: PowerGridResource,
  quantity: number
): {
  readonly cost: number;
  readonly nextMarket: ResourceMarketState;
} {
  const cost = calculateResourcePurchaseCost(market, resource, quantity);
  if (cost === null) {
    throw new Error(
      `Cannot purchase ${quantity} ${resource} (only ${market.inventory[resource]} available in market).`
    );
  }
  return {
    cost,
    nextMarket: {
      ...market,
      inventory: {
        ...market.inventory,
        [resource]: market.inventory[resource] - quantity,
      },
    },
  };
}

/**
 * Returns burned or discarded fuel tokens from player plants back to the unplaced box supply pool.
 */
export function returnResourcesToSupply(
  market: ResourceMarketState,
  returned: Partial<Record<PowerGridResource, number>>
): ResourceMarketState {
  const nextSupply: Record<PowerGridResource, number> = {
    ...market.totalSupplyPool,
  };
  for (const res of ALL_POWER_GRID_RESOURCES) {
    const add = returned[res] ?? 0;
    if (add > 0) {
      const maxRemainingInSupply =
        TOTAL_RESOURCE_SUPPLY[res] - market.inventory[res];
      nextSupply[res] = Math.min(maxRemainingInSupply, nextSupply[res] + add);
    }
  }
  return {
    ...market,
    totalSupplyPool: nextSupply,
  };
}

/**
 * Replenishes the Resource Market during Phase 5 (Bureaucracy) according to player count and current Step.
 * If the supply pool has fewer tokens than the restock table specifies (because players are hoarding fuel),
 * only the available tokens in `totalSupplyPool` are added to `inventory`.
 */
export function replenishResourceMarket(
  market: ResourceMarketState,
  playerCount: number,
  step: PowerGridStep
): ResourceMarketState {
  const restockRow =
    RESOURCE_RESTOCK_TABLE[playerCount]?.[step] ??
    RESOURCE_RESTOCK_TABLE[4]![step];

  const nextInventory: Record<PowerGridResource, number> = {
    ...market.inventory,
  };
  const nextSupplyPool: Record<PowerGridResource, number> = {
    ...market.totalSupplyPool,
  };

  for (const res of ALL_POWER_GRID_RESOURCES) {
    const maxMarketCapacity = RESOURCE_PRICE_SLOTS[res].length;
    const roomInMarket = Math.max(0, maxMarketCapacity - nextInventory[res]);
    const desiredAdd = restockRow[res];
    const actualAdd = Math.min(
      desiredAdd,
      roomInMarket,
      nextSupplyPool[res]
    );
    nextInventory[res] += actualAdd;
    nextSupplyPool[res] -= actualAdd;
  }

  return {
    inventory: nextInventory,
    totalSupplyPool: nextSupplyPool,
  };
}

/**
 * Checks whether a Power Plant card can store a given resource type.
 */
export function canPlantStoreResource(
  card: PowerPlantCard,
  resource: PowerGridResource
): boolean {
  switch (card.resourceType) {
    case 'COAL':
      return resource === 'COAL';
    case 'OIL':
      return resource === 'OIL';
    case 'HYBRID':
      return resource === 'COAL' || resource === 'OIL';
    case 'GARBAGE':
      return resource === 'GARBAGE';
    case 'URANIUM':
      return resource === 'URANIUM';
    case 'ECOLOGICAL':
    case 'STEP_3':
      return false;
  }
}

export function getTotalStoredOnPlant(plant: OwnedPowerPlant): number {
  return (
    plant.storedResources.COAL +
    plant.storedResources.OIL +
    plant.storedResources.GARBAGE +
    plant.storedResources.URANIUM
  );
}

/**
 * Returns how many additional units of `resource` can be stored on `plant`.
 * Each plant can hold at most `2 * intakeCost` compatible resource tokens in total.
 */
export function getPlantRemainingCapacity(
  plant: OwnedPowerPlant,
  resource: PowerGridResource
): number {
  if (!canPlantStoreResource(plant.card, resource)) {
    return 0;
  }
  const maxCapacity = plant.card.intakeCost * 2;
  const currentStored = getTotalStoredOnPlant(plant);
  return Math.max(0, maxCapacity - currentStored);
}

/**
 * Splits a sorted list of market plants into `actualMarket` and `futureMarket`
 * depending on whether the game is in Step 1/2 (4 actual + 4 future) or Step 3 (up to 6 actual, 0 future).
 */
export function splitSortedMarket(
  plants: readonly PowerPlantCard[],
  step: PowerGridStep
): {
  readonly actualMarket: PowerPlantCard[];
  readonly futureMarket: PowerPlantCard[];
} {
  const sorted = [...plants]
    .filter((c) => c.resourceType !== 'STEP_3' && c.id !== STEP_3_CARD_ID)
    .sort((a, b) => a.id - b.id);

  if (step === 'STEP_3') {
    return {
      actualMarket: sorted.slice(0, 6),
      futureMarket: [],
    };
  }

  return {
    actualMarket: sorted.slice(0, 4),
    futureMarket: sorted.slice(4, 8),
  };
}

/**
 * Initializes the Power Plant market (03–06 in Actual Market, 07–10 in Future Market)
 * and builds the draw deck with player-count-specific removed cards and the Step 3 card at the bottom.
 */
export function setupPowerPlantDeckAndMarkets(
  playerCount: number,
  prng: PRNGState,
  ruleset: 'CLASSIC' | 'RECHARGED' = 'RECHARGED'
): {
  readonly actualMarket: PowerPlantCard[];
  readonly futureMarket: PowerPlantCard[];
  readonly drawDeck: PowerPlantCard[];
  readonly prng: PRNGState;
} {
  const cfg = PLAYER_COUNT_CONFIGS[playerCount] ?? PLAYER_COUNT_CONFIGS[4]!;

  const initialEight = STANDARD_POWER_PLANTS.filter(
    (p) => p.id >= 3 && p.id <= 10
  ).sort((a, b) => a.id - b.id);

  const actualMarket = initialEight.slice(0, 4);
  const futureMarket = initialEight.slice(4, 8);

  const darkCards = STANDARD_POWER_PLANTS.filter(
    (p) => p.id >= 11 && p.id <= 15
  );
  const lightCards = STANDARD_POWER_PLANTS.filter((p) => p.id >= 16);

  let currentPrng = prng;

  if (ruleset === 'CLASSIC') {
    // Classic rules: Plant 13 goes on top of the deck; remove random cards from remaining deck
    const plant13 = darkCards.find((p) => p.id === 13)!;
    const restPool = [
      ...darkCards.filter((p) => p.id !== 13),
      ...lightCards,
    ];
    const shuffledPool = shuffleArray(restPool, currentPrng);
    currentPrng = shuffledPool.prng;

    const totalRemove =
      cfg.randomlyRemovedDarkCards + cfg.randomlyRemovedLightCards;
    const keptCards = shuffledPool.value.slice(totalRemove);

    return {
      actualMarket,
      futureMarket,
      drawDeck: [plant13, ...keptCards, STEP_3_CARD],
      prng: currentPrng,
    };
  }

  // Recharged rules: Shuffle dark cards (11–15), remove `randomlyRemovedDarkCards`,
  // place 1 dark card on top, and shuffle the remaining dark cards with the kept light cards!
  const shuffledDark = shuffleArray(darkCards, currentPrng);
  currentPrng = shuffledDark.prng;
  const keptDark = shuffledDark.value.slice(cfg.randomlyRemovedDarkCards);
  const topCard = keptDark[0]!;
  const remainingDark = keptDark.slice(1);

  const shuffledLight = shuffleArray(lightCards, currentPrng);
  currentPrng = shuffledLight.prng;
  const keptLight = shuffledLight.value.slice(cfg.randomlyRemovedLightCards);

  const combinedBody = shuffleArray(
    [...remainingDark, ...keptLight],
    currentPrng
  );
  currentPrng = combinedBody.prng;

  return {
    actualMarket,
    futureMarket,
    drawDeck: [topCard, ...combinedBody.value, STEP_3_CARD],
    prng: currentPrng,
  };
}

/**
 * Draws a replacement Power Plant card from `drawDeck` and inserts it into the market.
 * - Automatically discards and redraws any plant whose number `<= highestCityCount`.
 * - If the `STEP_3` card is drawn, flags `step3Triggered = true`.
 */
export function drawAndInsertReplacementPlant(
  actualMarket: readonly PowerPlantCard[],
  futureMarket: readonly PowerPlantCard[],
  drawDeck: readonly PowerPlantCard[],
  step: PowerGridStep,
  highestCityCount: number
): {
  readonly actualMarket: PowerPlantCard[];
  readonly futureMarket: PowerPlantCard[];
  readonly drawDeck: PowerPlantCard[];
  readonly step3Triggered: boolean;
} {
  let workingDeck = [...drawDeck];
  let step3Triggered = false;
  let drawnPlant: PowerPlantCard | null = null;

  while (workingDeck.length > 0) {
    const nextCard = workingDeck.shift()!;
    if (
      nextCard.resourceType === 'STEP_3' ||
      nextCard.id === STEP_3_CARD_ID
    ) {
      step3Triggered = true;
      break;
    }
    if (nextCard.id <= highestCityCount) {
      // Obsolete plant: discard immediately and redraw
      continue;
    }
    drawnPlant = nextCard;
    break;
  }

  const combined = [...actualMarket, ...futureMarket];
  if (drawnPlant) {
    combined.push(drawnPlant);
  }

  const split = splitSortedMarket(combined, step);
  return {
    actualMarket: split.actualMarket,
    futureMarket: split.futureMarket,
    drawDeck: workingDeck,
    step3Triggered,
  };
}

/**
 * Executes the immediate Step 3 transition on the Power Plant market and draw deck:
 * - Removes the lowest-numbered plant in the market from the game.
 * - Collapses `actualMarket` and `futureMarket` into a single `actualMarket` of up to 6 plants.
 * - Shuffles the remaining `drawDeck`.
 */
export function transitionMarketToStep3(
  actualMarket: readonly PowerPlantCard[],
  futureMarket: readonly PowerPlantCard[],
  drawDeck: readonly PowerPlantCard[],
  prng: PRNGState
): {
  readonly actualMarket: PowerPlantCard[];
  readonly futureMarket: PowerPlantCard[];
  readonly drawDeck: PowerPlantCard[];
  readonly prng: PRNGState;
} {
  const combined = [...actualMarket, ...futureMarket]
    .filter((c) => c.resourceType !== 'STEP_3' && c.id !== STEP_3_CARD_ID)
    .sort((a, b) => a.id - b.id);

  // Remove the lowest power plant from the game
  if (combined.length > 0) {
    combined.shift();
  }

  const cleanedDeck = drawDeck.filter(
    (c) => c.resourceType !== 'STEP_3' && c.id !== STEP_3_CARD_ID
  );
  const shuffledDeck = shuffleArray(cleanedDeck, prng);

  return {
    actualMarket: combined.slice(0, 6),
    futureMarket: [],
    drawDeck: [...shuffledDeck.value],
    prng: shuffledDeck.prng,
  };
}

