import { createPRNG, shuffleArray } from '../../common/prng.js';
import { ValidationResult } from '../ticket-to-ride/types.js';
import {
  ALL_POWER_GRID_RESOURCES,
  getBureaucracyPayout,
  PLAYER_COUNT_CONFIGS,
  POWER_GRID_MAPS,
  STARTING_ELEKTRO,
  STEP_3_CARD_ID,
} from './constants.js';
import {
  calculateCityBuildCost,
  createInitialCityBoard,
  selectActiveRegions,
} from './graph.js';
import {
  calculateResourcePurchaseCost,
  canPlantStoreResource,
  createEmptyResourceStorage,
  createInitialResourceMarket,
  drawAndInsertReplacementPlant,
  getPlantRemainingCapacity,
  getTotalStoredOnPlant,
  purchaseMarketResources,
  replenishResourceMarket,
  returnResourcesToSupply,
  setupPowerPlantDeckAndMarkets,
  splitSortedMarket,
  transitionMarketToStep3,
} from './market.js';
import {
  AuctionSubState,
  OwnedPowerPlant,
  PowerGridAction,
  PowerGridGameState,
  PowerGridInitOptions,
  PowerGridPhase,
  PowerGridPlayerState,
  PowerGridResource,
  PowerPlantCard,
  SanitizedPowerGridPlayerState,
  SanitizedPowerGridState,
} from './types.js';

/**
 * Returns the highest power plant number owned by a player, or 0 if they own no plants.
 */
export function getHighestPlantNumber(player: PowerGridPlayerState): number {
  if (player.powerPlants.length === 0) return 0;
  return Math.max(...player.powerPlants.map((p) => p.card.id));
}

/**
 * Returns the highest number of connected cities among all players.
 */
export function getHighestCityCount(
  players: Readonly<Record<string, PowerGridPlayerState>>
): number {
  let maxCities = 0;
  for (const p of Object.values(players)) {
    if (p.cities.length > maxCities) {
      maxCities = p.cities.length;
    }
  }
  return maxCities;
}

/**
 * Phase 1: Determine Turn Order.
 * Ranks players primarily by most connected cities (descending),
 * breaking ties by highest-numbered power plant owned (descending),
 * and preserving `fallbackOrder` if still tied (e.g., Round 1 before plants are bought).
 */
export function determineTurnOrder(
  players: Readonly<Record<string, PowerGridPlayerState>>,
  fallbackOrder: readonly string[]
): readonly string[] {
  const indexMap = new Map<string, number>();
  fallbackOrder.forEach((pid, idx) => indexMap.set(pid, idx));

  return [...fallbackOrder].sort((aId, bId) => {
    const a = players[aId]!;
    const b = players[bId]!;

    if (b.cities.length !== a.cities.length) {
      return b.cities.length - a.cities.length;
    }

    const aMaxPlant = getHighestPlantNumber(a);
    const bMaxPlant = getHighestPlantNumber(b);
    if (bMaxPlant !== aMaxPlant) {
      return bMaxPlant - aMaxPlant;
    }

    return (indexMap.get(aId) ?? 0) - (indexMap.get(bId) ?? 0);
  });
}

/**
 * Computes the maximum number of connected cities a player can actually power
 * using their owned power plants and the fuel currently stored on those plants.
 */
export function calculateMaxPoweredCities(player: PowerGridPlayerState): number {
  let totalPlantCapacity = 0;

  for (const plant of player.powerPlants) {
    if (
      plant.card.resourceType === 'ECOLOGICAL' ||
      plant.card.intakeCost === 0
    ) {
      totalPlantCapacity += plant.card.citiesPowered;
      continue;
    }

    const stored = getTotalStoredOnPlant(plant);
    if (stored >= plant.card.intakeCost) {
      totalPlantCapacity += plant.card.citiesPowered;
    }
  }

  return Math.min(player.cities.length, totalPlantCapacity);
}

/**
 * Evaluates the final game standings and winner according to Power Grid rules:
 * 1. Most cities actually powered (given owned plants, stored fuel, and connected cities).
 * 2. Tie-breaker 1: Most remaining Elektro (`money`).
 * 3. Tie-breaker 2: Most connected cities (`cities.length`).
 */
export function resolveEndGameWinner(state: PowerGridGameState): {
  readonly winnerId: string;
  readonly standings: ReadonlyArray<{
    readonly playerId: string;
    readonly citiesPowered: number;
    readonly money: number;
    readonly totalCities: number;
  }>;
} {
  const standings = state.turnOrder
    .map((pid) => {
      const p = state.players[pid]!;
      return {
        playerId: pid,
        citiesPowered: calculateMaxPoweredCities(p),
        money: p.money,
        totalCities: p.cities.length,
      };
    })
    .sort((a, b) => {
      if (b.citiesPowered !== a.citiesPowered) {
        return b.citiesPowered - a.citiesPowered;
      }
      if (b.money !== a.money) {
        return b.money - a.money;
      }
      return b.totalCities - a.totalCities;
    });

  return {
    winnerId: standings[0]!.playerId,
    standings,
  };
}

function createInitialAuctionSubState(): AuctionSubState {
  return {
    auctionTurnIndex: 0,
    completedAuctionPlayerIds: [],
    activePlant: null,
    currentBid: 0,
    highBidderId: null,
    eligibleBidders: [],
    currentBidderIndex: 0,
    anyPlantPurchasedThisRound: false,
    pendingPlantDiscard: null,
  };
}

/**
 * Initializes a new deterministic Power Grid match (2–6 players).
 */
export function initPowerGridGame(
  playerIds: readonly string[],
  seed = 42,
  options?: PowerGridInitOptions
): PowerGridGameState {
  if (playerIds.length < 2 || playerIds.length > 6) {
    throw new Error(
      `Power Grid requires between 2 and 6 players (received ${playerIds.length}).`
    );
  }

  const cfg = PLAYER_COUNT_CONFIGS[playerIds.length]!;
  const mapId = options?.mapId ?? 'USA';
  const ruleset = options?.ruleset ?? 'RECHARGED';
  const hideMoney = options?.hideMoney ?? false;
  const mapDef = POWER_GRID_MAPS[mapId];

  const activeRegions = selectActiveRegions(
    mapDef,
    cfg.activeRegionsCount,
    options?.mapRegionKeys
  );

  let prng = createPRNG(seed);

  // Phase 1 Round 1 special order: determined randomly by initial seed
  const shuffledOrder = shuffleArray(playerIds, prng);
  prng = shuffledOrder.prng;
  const initialTurnOrder = shuffledOrder.value;

  const marketSetup = setupPowerPlantDeckAndMarkets(
    playerIds.length,
    prng,
    ruleset
  );
  prng = marketSetup.prng;

  const cityBoard = createInitialCityBoard(mapId, activeRegions);
  const resourceMarket = createInitialResourceMarket();

  const players: Record<string, PowerGridPlayerState> = {};
  for (const pid of playerIds) {
    players[pid] = {
      id: pid,
      money: STARTING_ELEKTRO,
      cities: [],
      powerPlants: [],
      lastPoweredCities: 0,
    };
  }

  return {
    gameId: 'power_grid',
    mapId,
    activeRegions,
    ruleset,
    hideMoney,
    turnNumber: 1,
    roundNumber: 1,
    step: 'STEP_1',
    phase: PowerGridPhase.PHASE_2_AUCTION_POWER_PLANTS,
    turnOrder: initialTurnOrder,
    playerOrder: initialTurnOrder,
    activePlayerIndex: 0,
    firstRoundOrderRecomputed: false,
    auction: createInitialAuctionSubState(),
    actualMarket: marketSetup.actualMarket,
    futureMarket: marketSetup.futureMarket,
    drawDeck: marketSetup.drawDeck,
    step3TriggeredDuringPhase: false,
    endGameTriggered: false,
    resourceMarket,
    cityBoard,
    players,
    bureaucracyCompletedIds: [],
    winnerId: null,
    finalStandings: null,
    prng,
    lastActionSummary: `Round 1 initialized on ${mapDef.name} map (${activeRegions.length} active regions). Turn order: ${initialTurnOrder.join(' → ')}.`,
  };
}

/**
 * Returns the ID of the player who must currently act in `state`.
 */
export function getActivePlayerId(state: PowerGridGameState): string {
  if (state.phase === PowerGridPhase.PHASE_2_AUCTION_POWER_PLANTS && state.auction) {
    if (state.auction.pendingPlantDiscard) {
      return state.auction.pendingPlantDiscard.playerId;
    }
    if (state.auction.activePlant) {
      return (
        state.auction.eligibleBidders[state.auction.currentBidderIndex] ??
        state.turnOrder[0]!
      );
    }
    return (
      state.turnOrder[state.auction.auctionTurnIndex] ?? state.turnOrder[0]!
    );
  }
  return state.turnOrder[state.activePlayerIndex] ?? state.turnOrder[0]!;
}

/**
 * Validates whether `action` is legal for `playerId` in `state`.
 */
export function validatePowerGridAction(
  state: PowerGridGameState,
  playerId: string,
  action: PowerGridAction
): ValidationResult {
  if (state.phase === PowerGridPhase.GAME_OVER) {
    return { valid: false, reason: 'The game is already over.' };
  }

  const player = state.players[playerId];
  if (!player) {
    return { valid: false, reason: `Unknown player "${playerId}".` };
  }

  if (action.type === 'PG_DETERMINE_TURN_ORDER') {
    if (state.phase !== PowerGridPhase.PHASE_1_DETERMINE_TURN_ORDER) {
      return {
        valid: false,
        reason: 'Turn order can only be determined in Phase 1.',
      };
    }
    return { valid: true };
  }

  const expectedActor = getActivePlayerId(state);
  if (playerId !== expectedActor) {
    return {
      valid: false,
      reason: `Out of turn: expected ${expectedActor} to act, but ${playerId} attempted ${action.type}.`,
    };
  }

  switch (action.type) {
    case 'PG_OPEN_AUCTION': {
      if (
        state.phase !== PowerGridPhase.PHASE_2_AUCTION_POWER_PLANTS ||
        !state.auction
      ) {
        return {
          valid: false,
          reason: 'Can only open a power plant auction during Phase 2.',
        };
      }
      if (state.auction.pendingPlantDiscard) {
        return {
          valid: false,
          reason: 'Must discard an excess power plant before opening a new auction.',
        };
      }
      if (state.auction.activePlant !== null) {
        return {
          valid: false,
          reason: `Auction for Plant #${state.auction.activePlant.id} is already in progress.`,
        };
      }
      const plant = state.actualMarket.find((c) => c.id === action.plantId);
      if (!plant) {
        return {
          valid: false,
          reason: `Power Plant #${action.plantId} is not in the Actual Market.`,
        };
      }
      if (!Number.isInteger(action.bid) || action.bid < plant.id) {
        return {
          valid: false,
          reason: `Opening bid (${action.bid}) must be at least the plant's minimum value (${plant.id}).`,
        };
      }
      if (action.bid > player.money) {
        return {
          valid: false,
          reason: `Bid of $${action.bid} exceeds ${playerId}'s Elektro ($${player.money}).`,
        };
      }
      return { valid: true };
    }

    case 'PG_PASS_AUCTION_PHASE': {
      if (
        state.phase !== PowerGridPhase.PHASE_2_AUCTION_POWER_PLANTS ||
        !state.auction
      ) {
        return {
          valid: false,
          reason: 'Can only pass auction phase during Phase 2.',
        };
      }
      if (state.auction.activePlant !== null || state.auction.pendingPlantDiscard) {
        return {
          valid: false,
          reason: 'Cannot pass the entire auction phase while a plant auction is active.',
        };
      }
      if (state.roundNumber === 1) {
        return {
          valid: false,
          reason: 'Round 1 Rule: Every player must purchase a power plant in the first round.',
        };
      }
      return { valid: true };
    }

    case 'PG_RAISE_BID': {
      if (
        state.phase !== PowerGridPhase.PHASE_2_AUCTION_POWER_PLANTS ||
        !state.auction ||
        !state.auction.activePlant
      ) {
        return {
          valid: false,
          reason: 'No active power plant auction to raise bid on.',
        };
      }
      if (state.auction.pendingPlantDiscard) {
        return {
          valid: false,
          reason: 'Awaiting plant discard resolution.',
        };
      }
      if (!Number.isInteger(action.bid) || action.bid <= state.auction.currentBid) {
        return {
          valid: false,
          reason: `Raised bid (${action.bid}) must be strictly greater than current bid ($${state.auction.currentBid}).`,
        };
      }
      if (action.bid > player.money) {
        return {
          valid: false,
          reason: `Bid of $${action.bid} exceeds ${playerId}'s Elektro ($${player.money}).`,
        };
      }
      return { valid: true };
    }

    case 'PG_PASS_CURRENT_BID': {
      if (
        state.phase !== PowerGridPhase.PHASE_2_AUCTION_POWER_PLANTS ||
        !state.auction ||
        !state.auction.activePlant
      ) {
        return {
          valid: false,
          reason: 'No active power plant auction to pass on.',
        };
      }
      if (state.auction.pendingPlantDiscard) {
        return {
          valid: false,
          reason: 'Awaiting plant discard resolution.',
        };
      }
      return { valid: true };
    }

    case 'PG_DISCARD_PLANT': {
      if (
        state.phase !== PowerGridPhase.PHASE_2_AUCTION_POWER_PLANTS ||
        !state.auction ||
        !state.auction.pendingPlantDiscard
      ) {
        return {
          valid: false,
          reason: 'No pending power plant discard required.',
        };
      }
      const discardedOwned = player.powerPlants.find(
        (p) => p.card.id === action.discardPlantId
      );
      if (!discardedOwned) {
        return {
          valid: false,
          reason: `Player ${playerId} does not own Power Plant #${action.discardPlantId} to discard.`,
        };
      }
      return { valid: true };
    }

    case 'PG_BUY_RESOURCES': {
      if (state.phase !== PowerGridPhase.PHASE_3_BUY_RESOURCES) {
        return {
          valid: false,
          reason: 'Can only purchase resources during Phase 3: Buy Resources.',
        };
      }
      if (action.purchases.length === 0) {
        return {
          valid: false,
          reason: 'Must specify at least one resource purchase.',
        };
      }

      // Simulate purchases sequentially to verify market availability, plant capacity, and player money
      let workingMarket = state.resourceMarket;
      const simulatedPlants: OwnedPowerPlant[] = player.powerPlants.map((p) => ({
        card: p.card,
        storedResources: { ...p.storedResources },
      }));
      let totalCost = 0;

      for (const item of action.purchases) {
        if (!Number.isInteger(item.quantity) || item.quantity <= 0) {
          return {
            valid: false,
            reason: 'Resource purchase quantity must be a positive integer.',
          };
        }
        const targetPlantIdx = simulatedPlants.findIndex(
          (p) => p.card.id === item.plantId
        );
        if (targetPlantIdx === -1) {
          return {
            valid: false,
            reason: `Player ${playerId} does not own Power Plant #${item.plantId}.`,
          };
        }
        const targetPlant = simulatedPlants[targetPlantIdx]!;
        if (!canPlantStoreResource(targetPlant.card, item.resource)) {
          return {
            valid: false,
            reason: `Power Plant #${item.plantId} (${targetPlant.card.resourceType}) cannot store ${item.resource}.`,
          };
        }
        const remCap = getPlantRemainingCapacity(targetPlant, item.resource);
        if (item.quantity > remCap) {
          return {
            valid: false,
            reason: `Power Plant #${item.plantId} only has capacity for ${remCap} more ${item.resource} (attempted to store ${item.quantity}).`,
          };
        }
        const itemCost = calculateResourcePurchaseCost(
          workingMarket,
          item.resource,
          item.quantity
        );
        if (itemCost === null) {
          return {
            valid: false,
            reason: `Insufficient ${item.resource} in the Resource Market (requested ${item.quantity}, available ${workingMarket.inventory[item.resource]}).`,
          };
        }
        totalCost += itemCost;
        if (totalCost > player.money) {
          return {
            valid: false,
            reason: `Total resource purchase cost ($${totalCost}) exceeds ${playerId}'s Elektro ($${player.money}).`,
          };
        }

        const purchaseRes = purchaseMarketResources(
          workingMarket,
          item.resource,
          item.quantity
        );
        workingMarket = purchaseRes.nextMarket;
        simulatedPlants[targetPlantIdx] = {
          ...targetPlant,
          storedResources: {
            ...targetPlant.storedResources,
            [item.resource]:
              targetPlant.storedResources[item.resource] + item.quantity,
          },
        };
      }

      return { valid: true };
    }

    case 'PG_FINISH_BUYING_RESOURCES': {
      if (state.phase !== PowerGridPhase.PHASE_3_BUY_RESOURCES) {
        return {
          valid: false,
          reason: 'Can only finish buying resources during Phase 3.',
        };
      }
      return { valid: true };
    }

    case 'PG_BUILD_CITY': {
      if (state.phase !== PowerGridPhase.PHASE_4_BUILD_CITIES) {
        return {
          valid: false,
          reason: 'Can only build cities during Phase 4: Build Cities.',
        };
      }
      const buildCheck = calculateCityBuildCost(
        state.mapId,
        state.cityBoard,
        state.step,
        playerId,
        player.cities,
        action.cityId
      );
      if (!buildCheck.valid) {
        return {
          valid: false,
          reason: buildCheck.reason ?? 'Invalid city build.',
        };
      }
      if (buildCheck.totalCost > player.money) {
        return {
          valid: false,
          reason: `Building in ${action.cityId} costs $${buildCheck.totalCost} ($${buildCheck.slotCost} slot + $${buildCheck.pipeCost} pipe), but ${playerId} only has $${player.money}.`,
        };
      }
      return { valid: true };
    }

    case 'PG_FINISH_BUILDING_CITIES': {
      if (state.phase !== PowerGridPhase.PHASE_4_BUILD_CITIES) {
        return {
          valid: false,
          reason: 'Can only finish building cities during Phase 4.',
        };
      }
      return { valid: true };
    }

    case 'PG_POWER_CITIES': {
      if (state.phase !== PowerGridPhase.PHASE_5_BUREAUCRACY) {
        return {
          valid: false,
          reason: 'Can only power cities during Phase 5: Bureaucracy.',
        };
      }
      const seenPlantIds = new Set<number>();
      for (const alloc of action.allocations) {
        if (seenPlantIds.has(alloc.plantId)) {
          return {
            valid: false,
            reason: `Power Plant #${alloc.plantId} cannot be activated more than once in the same round.`,
          };
        }
        seenPlantIds.add(alloc.plantId);

        const ownedPlant = player.powerPlants.find(
          (p) => p.card.id === alloc.plantId
        );
        if (!ownedPlant) {
          return {
            valid: false,
            reason: `Player ${playerId} does not own Power Plant #${alloc.plantId}.`,
          };
        }

        let spentTotal = 0;
        for (const res of ALL_POWER_GRID_RESOURCES) {
          const amt = alloc.resourcesSpent[res] ?? 0;
          if (amt < 0 || !Number.isInteger(amt)) {
            return {
              valid: false,
              reason: 'Invalid resource spend amount.',
            };
          }
          if (amt > 0 && !canPlantStoreResource(ownedPlant.card, res)) {
            return {
              valid: false,
              reason: `Power Plant #${alloc.plantId} cannot burn ${res}.`,
            };
          }
          if (amt > ownedPlant.storedResources[res]) {
            return {
              valid: false,
              reason: `Power Plant #${alloc.plantId} only has ${ownedPlant.storedResources[res]} ${res} stored (tried to burn ${amt}).`,
            };
          }
          spentTotal += amt;
        }

        if (spentTotal !== ownedPlant.card.intakeCost) {
          return {
            valid: false,
            reason: `Power Plant #${alloc.plantId} requires burning exactly ${ownedPlant.card.intakeCost} fuel (provided ${spentTotal}).`,
          };
        }
      }
      return { valid: true };
    }
  }
}

/**
 * Helper to finalize awarding a won auction plant to `winnerId` (once any 4th plant discard is resolved),
 * draw its replacement into the market, and advance the Phase 2 auction state machine.
 */
function finalizePlantAcquisitionAndAdvanceAuction(
  state: PowerGridGameState,
  winnerId: string,
  wonPlant: PowerPlantCard,
  updatedWinner: PowerGridPlayerState,
  updatedResourceMarket = state.resourceMarket
): PowerGridGameState {
  const auction = state.auction!;
  const nextPlayers: Record<string, PowerGridPlayerState> = {
    ...state.players,
    [winnerId]: updatedWinner,
  };

  // Remove the won plant from `actualMarket` and draw a replacement card
  const remainingActual = state.actualMarket.filter((c) => c.id !== wonPlant.id);
  const highestCities = getHighestCityCount(nextPlayers);
  const drawRes = drawAndInsertReplacementPlant(
    remainingActual,
    state.futureMarket,
    state.drawDeck,
    state.step,
    highestCities
  );

  const nextCompleted = [...auction.completedAuctionPlayerIds, winnerId];
  const step3Flag = state.step3TriggeredDuringPhase || drawRes.step3Triggered;

  return advanceOrCompletePhase2Auction({
    ...state,
    players: nextPlayers,
    resourceMarket: updatedResourceMarket,
    actualMarket: drawRes.actualMarket,
    futureMarket: drawRes.futureMarket,
    drawDeck: drawRes.drawDeck,
    step3TriggeredDuringPhase: step3Flag,
    auction: {
      ...auction,
      completedAuctionPlayerIds: nextCompleted,
      activePlant: null,
      currentBid: 0,
      highBidderId: null,
      eligibleBidders: [],
      currentBidderIndex: 0,
      anyPlantPurchasedThisRound: true,
      pendingPlantDiscard: null,
    },
    lastActionSummary: `${winnerId} won Power Plant #${wonPlant.id} for $${auction.currentBid}.`,
  });
}

/**
 * Checks if any player still needs to open/pass an auction in Phase 2.
 * If all players have completed Phase 2, handles end-of-Phase-2 market cleanup,
 * Step 3 transition if triggered, Round 1 turn order re-determination, and transitions to Phase 3.
 */
function advanceOrCompletePhase2Auction(
  state: PowerGridGameState
): PowerGridGameState {
  const auction = state.auction!;
  const completedSet = new Set(auction.completedAuctionPlayerIds);

  // Find the first player in `turnOrder` who has not yet bought a plant or passed this round
  const nextTurnIdx = state.turnOrder.findIndex(
    (pid) => !completedSet.has(pid)
  );

  if (nextTurnIdx !== -1 && state.actualMarket.length > 0) {
    return {
      ...state,
      activePlayerIndex: nextTurnIdx,
      auction: {
        ...auction,
        auctionTurnIndex: nextTurnIdx,
      },
    };
  }

  // All players have completed Phase 2!
  let nextActual = [...state.actualMarket];
  let nextFuture = [...state.futureMarket];
  let nextDeck = [...state.drawDeck];
  let step3Flag = state.step3TriggeredDuringPhase;
  let nextStep = state.step;
  let nextPrng = state.prng;

  // Rule: If NO plant was bought in the round, discard the lowest plant in Actual Market and draw replacement
  if (!auction.anyPlantPurchasedThisRound && nextActual.length > 0) {
    const remainingActual = nextActual.slice(1);
    const highestCities = getHighestCityCount(state.players);
    const drawRes = drawAndInsertReplacementPlant(
      remainingActual,
      nextFuture,
      nextDeck,
      nextStep,
      highestCities
    );
    nextActual = drawRes.actualMarket;
    nextFuture = drawRes.futureMarket;
    nextDeck = drawRes.drawDeck;
    step3Flag = step3Flag || drawRes.step3Triggered;
  }

  // If Step 3 card was drawn during Phase 2, transition to Step 3 now
  if (step3Flag && nextStep !== 'STEP_3') {
    const step3Res = transitionMarketToStep3(
      nextActual,
      nextFuture,
      nextDeck,
      nextPrng
    );
    nextActual = step3Res.actualMarket;
    nextFuture = step3Res.futureMarket;
    nextDeck = step3Res.drawDeck;
    nextPrng = step3Res.prng;
    nextStep = 'STEP_3';
    step3Flag = false;
  }

  // Round 1 special rule: Re-determine turn order after all players buy their first power plant!
  let nextTurnOrder = state.turnOrder;
  let nextFirstRoundRecomputed = state.firstRoundOrderRecomputed;
  if (state.roundNumber === 1 && !state.firstRoundOrderRecomputed) {
    nextTurnOrder = determineTurnOrder(state.players, state.turnOrder);
    nextFirstRoundRecomputed = true;
  }

  // Transition to Phase 3: Buy Resources (Reverse Turn Order -> last player in turnOrder goes first)
  return {
    ...state,
    step: nextStep,
    phase: PowerGridPhase.PHASE_3_BUY_RESOURCES,
    turnOrder: nextTurnOrder,
    playerOrder: nextTurnOrder,
    activePlayerIndex: nextTurnOrder.length - 1,
    firstRoundOrderRecomputed: nextFirstRoundRecomputed,
    auction: null,
    actualMarket: nextActual,
    futureMarket: nextFuture,
    drawDeck: nextDeck,
    step3TriggeredDuringPhase: false,
    prng: nextPrng,
    lastActionSummary: `${state.lastActionSummary ?? ''} Phase 2 complete — entering Phase 3: Buy Resources (reverse turn order).`.trim(),
  };
}

/**
 * Pure state reducer applying a validated `PowerGridAction`.
 */
export function applyPowerGridAction(
  state: PowerGridGameState,
  playerId: string,
  action: PowerGridAction
): PowerGridGameState {
  const validation = validatePowerGridAction(state, playerId, action);
  if (!validation.valid) {
    throw new Error(validation.reason ?? 'Invalid Power Grid action.');
  }

  const cfg =
    PLAYER_COUNT_CONFIGS[state.turnOrder.length] ?? PLAYER_COUNT_CONFIGS[4]!;
  const player = state.players[playerId]!;

  switch (action.type) {
    case 'PG_DETERMINE_TURN_ORDER': {
      const nextOrder =
        state.roundNumber === 1 && !state.firstRoundOrderRecomputed
          ? state.turnOrder
          : determineTurnOrder(state.players, state.turnOrder);

      return {
        ...state,
        phase: PowerGridPhase.PHASE_2_AUCTION_POWER_PLANTS,
        turnOrder: nextOrder,
        playerOrder: nextOrder,
        activePlayerIndex: 0,
        auction: createInitialAuctionSubState(),
        lastActionSummary: `Phase 1: Turn order determined (${nextOrder.join(' → ')}).`,
      };
    }

    case 'PG_OPEN_AUCTION': {
      const auction = state.auction!;
      const plant = state.actualMarket.find((c) => c.id === action.plantId)!;
      const completedSet = new Set(auction.completedAuctionPlayerIds);

      // Build clockwise list of eligible bidders starting from the opener
      const n = state.turnOrder.length;
      const openerOrderIdx = state.turnOrder.indexOf(playerId);
      const eligibleBidders: string[] = [];
      for (let offset = 0; offset < n; offset++) {
        const pid = state.turnOrder[(openerOrderIdx + offset) % n]!;
        if (!completedSet.has(pid)) {
          eligibleBidders.push(pid);
        }
      }

      // If the opener is the ONLY eligible bidder left, they immediately win the plant for `action.bid`!
      if (eligibleBidders.length === 1) {
        const deductedPlayer: PowerGridPlayerState = {
          ...player,
          money: player.money - action.bid,
        };
        if (deductedPlayer.powerPlants.length >= cfg.maxPlantsPerPlayer) {
          return {
            ...state,
            players: {
              ...state.players,
              [playerId]: deductedPlayer,
            },
            auction: {
              ...auction,
              activePlant: plant,
              currentBid: action.bid,
              highBidderId: playerId,
              eligibleBidders: [playerId],
              currentBidderIndex: 0,
              pendingPlantDiscard: {
                playerId,
                newlyWonPlant: plant,
              },
            },
            lastActionSummary: `${playerId} won Plant #${plant.id} uncontested for $${action.bid} and must discard an existing plant.`,
          };
        }

        const updatedWinner: PowerGridPlayerState = {
          ...deductedPlayer,
          powerPlants: [
            ...deductedPlayer.powerPlants,
            { card: plant, storedResources: createEmptyResourceStorage() },
          ].sort((a, b) => a.card.id - b.card.id),
        };

        return finalizePlantAcquisitionAndAdvanceAuction(
          {
            ...state,
            auction: {
              ...auction,
              currentBid: action.bid,
              highBidderId: playerId,
            },
          },
          playerId,
          plant,
          updatedWinner
        );
      }

      return {
        ...state,
        auction: {
          ...auction,
          activePlant: plant,
          currentBid: action.bid,
          highBidderId: playerId,
          eligibleBidders,
          currentBidderIndex: 1, // Next player in `eligibleBidders` after opener
        },
        lastActionSummary: `${playerId} opened auction on Power Plant #${plant.id} with a bid of $${action.bid}.`,
      };
    }

    case 'PG_PASS_AUCTION_PHASE': {
      const auction = state.auction!;
      const nextCompleted = [...auction.completedAuctionPlayerIds, playerId];
      return advanceOrCompletePhase2Auction({
        ...state,
        auction: {
          ...auction,
          completedAuctionPlayerIds: nextCompleted,
        },
        lastActionSummary: `${playerId} passed on buying a power plant this round.`,
      });
    }

    case 'PG_RAISE_BID': {
      const auction = state.auction!;
      const nextBidderIndex =
        (auction.currentBidderIndex + 1) % auction.eligibleBidders.length;

      return {
        ...state,
        auction: {
          ...auction,
          currentBid: action.bid,
          highBidderId: playerId,
          currentBidderIndex: nextBidderIndex,
        },
        lastActionSummary: `${playerId} raised bid on Power Plant #${auction.activePlant!.id} to $${action.bid}.`,
      };
    }

    case 'PG_PASS_CURRENT_BID': {
      const auction = state.auction!;
      const plant = auction.activePlant!;
      const nextEligible = auction.eligibleBidders.filter(
        (id) => id !== playerId
      );

      // If only 1 bidder remains, they win the auction!
      if (nextEligible.length === 1) {
        const winnerId = nextEligible[0]!;
        const winner = state.players[winnerId]!;
        const deductedWinner: PowerGridPlayerState = {
          ...winner,
          money: winner.money - auction.currentBid,
        };

        if (deductedWinner.powerPlants.length >= cfg.maxPlantsPerPlayer) {
          return {
            ...state,
            players: {
              ...state.players,
              [winnerId]: deductedWinner,
            },
            auction: {
              ...auction,
              eligibleBidders: nextEligible,
              currentBidderIndex: 0,
              pendingPlantDiscard: {
                playerId: winnerId,
                newlyWonPlant: plant,
              },
            },
            lastActionSummary: `${playerId} passed. ${winnerId} won Power Plant #${plant.id} for $${auction.currentBid} and must discard an existing plant.`,
          };
        }

        const updatedWinner: PowerGridPlayerState = {
          ...deductedWinner,
          powerPlants: [
            ...deductedWinner.powerPlants,
            { card: plant, storedResources: createEmptyResourceStorage() },
          ].sort((a, b) => a.card.id - b.card.id),
        };

        return finalizePlantAcquisitionAndAdvanceAuction(
          state,
          winnerId,
          plant,
          updatedWinner
        );
      }

      const nextBidderIdx =
        auction.currentBidderIndex >= nextEligible.length
          ? 0
          : auction.currentBidderIndex;

      return {
        ...state,
        auction: {
          ...auction,
          eligibleBidders: nextEligible,
          currentBidderIndex: nextBidderIdx,
        },
        lastActionSummary: `${playerId} dropped out of bidding for Power Plant #${plant.id}.`,
      };
    }

    case 'PG_DISCARD_PLANT': {
      const auction = state.auction!;
      const pending = auction.pendingPlantDiscard!;
      const discardedPlant = player.powerPlants.find(
        (p) => p.card.id === action.discardPlantId
      )!;

      // Build the new list of owned plants (remaining + newlyWonPlant)
      const remainingPlants: OwnedPowerPlant[] = [
        ...player.powerPlants
          .filter((p) => p.card.id !== action.discardPlantId)
          .map((p) => ({
            card: p.card,
            storedResources: { ...p.storedResources },
          })),
        {
          card: pending.newlyWonPlant,
          storedResources: createEmptyResourceStorage(),
        },
      ].sort((a, b) => a.card.id - b.card.id);

      // Redistribute stored fuel from `discardedPlant` onto `remainingPlants` where compatible & capacity allows
      const leftoverResources: Record<PowerGridResource, number> = {
        ...discardedPlant.storedResources,
      };

      if (action.transferResources) {
        for (const xfer of action.transferResources) {
          const targetIdx = remainingPlants.findIndex(
            (p) => p.card.id === xfer.toPlantId
          );
          if (targetIdx === -1) continue;
          const target = remainingPlants[targetIdx]!;
          const availableToMove = Math.min(
            leftoverResources[xfer.resource],
            xfer.amount,
            getPlantRemainingCapacity(target, xfer.resource)
          );
          if (availableToMove > 0) {
            leftoverResources[xfer.resource] -= availableToMove;
            remainingPlants[targetIdx] = {
              ...target,
              storedResources: {
                ...target.storedResources,
                [xfer.resource]:
                  target.storedResources[xfer.resource] + availableToMove,
              },
            };
          }
        }
      } else {
        // Automatically salvage any compatible fuel onto remaining plants if no explicit transfer map was passed
        for (const res of ALL_POWER_GRID_RESOURCES) {
          for (let i = 0; i < remainingPlants.length; i++) {
            if (leftoverResources[res] <= 0) break;
            const target = remainingPlants[i]!;
            const cap = getPlantRemainingCapacity(target, res);
            const move = Math.min(leftoverResources[res], cap);
            if (move > 0) {
              leftoverResources[res] -= move;
              remainingPlants[i] = {
                ...target,
                storedResources: {
                  ...target.storedResources,
                  [res]: target.storedResources[res] + move,
                },
              };
            }
          }
        }
      }

      const updatedMarket = returnResourcesToSupply(
        state.resourceMarket,
        leftoverResources
      );

      const updatedWinner: PowerGridPlayerState = {
        ...player,
        powerPlants: remainingPlants,
      };

      return finalizePlantAcquisitionAndAdvanceAuction(
        state,
        playerId,
        pending.newlyWonPlant,
        updatedWinner,
        updatedMarket
      );
    }

    case 'PG_BUY_RESOURCES': {
      let workingMarket = state.resourceMarket;
      const updatedPlants: OwnedPowerPlant[] = player.powerPlants.map((p) => ({
        card: p.card,
        storedResources: { ...p.storedResources },
      }));
      let totalCost = 0;

      for (const item of action.purchases) {
        const res = purchaseMarketResources(
          workingMarket,
          item.resource,
          item.quantity
        );
        workingMarket = res.nextMarket;
        totalCost += res.cost;

        const idx = updatedPlants.findIndex((p) => p.card.id === item.plantId);
        const target = updatedPlants[idx]!;
        updatedPlants[idx] = {
          ...target,
          storedResources: {
            ...target.storedResources,
            [item.resource]:
              target.storedResources[item.resource] + item.quantity,
          },
        };
      }

      return {
        ...state,
        resourceMarket: workingMarket,
        players: {
          ...state.players,
          [playerId]: {
            ...player,
            money: player.money - totalCost,
            powerPlants: updatedPlants,
          },
        },
        lastActionSummary: `${playerId} purchased resources for $${totalCost}.`,
      };
    }

    case 'PG_FINISH_BUYING_RESOURCES': {
      // Reverse turn order: decrement activePlayerIndex until 0 is reached
      if (state.activePlayerIndex > 0) {
        return {
          ...state,
          activePlayerIndex: state.activePlayerIndex - 1,
          lastActionSummary: `${playerId} finished buying resources.`,
        };
      }

      // All players have completed Phase 3 -> transition to Phase 4: Build Cities (also Reverse Turn Order)
      return {
        ...state,
        phase: PowerGridPhase.PHASE_4_BUILD_CITIES,
        activePlayerIndex: state.turnOrder.length - 1,
        lastActionSummary: `${playerId} finished buying resources — entering Phase 4: Build Cities (reverse turn order).`,
      };
    }

    case 'PG_BUILD_CITY': {
      const buildRes = calculateCityBuildCost(
        state.mapId,
        state.cityBoard,
        state.step,
        playerId,
        player.cities,
        action.cityId
      );

      const targetCity = state.cityBoard[action.cityId]!;
      const nextCityBoard = {
        ...state.cityBoard,
        [action.cityId]: {
          ...targetCity,
          owners: [...targetCity.owners, playerId],
        },
      };

      const updatedPlayer: PowerGridPlayerState = {
        ...player,
        money: player.money - buildRes.totalCost,
        cities: [...player.cities, action.cityId],
      };

      const nextPlayers: Record<string, PowerGridPlayerState> = {
        ...state.players,
        [playerId]: updatedPlayer,
      };

      let nextStep = state.step;
      let nextActual = [...state.actualMarket];
      let nextFuture = [...state.futureMarket];
      let nextDeck = [...state.drawDeck];
      let step3Flag = state.step3TriggeredDuringPhase;
      const highestCities = getHighestCityCount(nextPlayers);

      // Check Step 2 trigger: When any player connects `step2TriggerCities` (e.g., 7 in 3–4p),
      // transition to STEP_2 and remove the lowest plant from the game!
      if (
        nextStep === 'STEP_1' &&
        updatedPlayer.cities.length >= cfg.step2TriggerCities
      ) {
        nextStep = 'STEP_2';
        if (nextActual.length > 0) {
          const remainingActual = nextActual.slice(1);
          const drawRes = drawAndInsertReplacementPlant(
            remainingActual,
            nextFuture,
            nextDeck,
            nextStep,
            highestCities
          );
          nextActual = drawRes.actualMarket;
          nextFuture = drawRes.futureMarket;
          nextDeck = drawRes.drawDeck;
          step3Flag = step3Flag || drawRes.step3Triggered;
        }
      }

      // Immediately replace any plant in the market whose number <= highest city count
      while (nextActual.length > 0 && nextActual[0]!.id <= highestCities) {
        const remainingActual = nextActual.slice(1);
        const drawRes = drawAndInsertReplacementPlant(
          remainingActual,
          nextFuture,
          nextDeck,
          nextStep,
          highestCities
        );
        nextActual = drawRes.actualMarket;
        nextFuture = drawRes.futureMarket;
        nextDeck = drawRes.drawDeck;
        step3Flag = step3Flag || drawRes.step3Triggered;
      }

      const endTriggered =
        state.endGameTriggered ||
        updatedPlayer.cities.length >= cfg.gameEndTriggerCities;

      return {
        ...state,
        step: nextStep,
        cityBoard: nextCityBoard,
        players: nextPlayers,
        actualMarket: nextActual,
        futureMarket: nextFuture,
        drawDeck: nextDeck,
        step3TriggeredDuringPhase: step3Flag,
        endGameTriggered: endTriggered,
        lastActionSummary: `${playerId} connected ${action.cityId} for $${buildRes.totalCost} ($${buildRes.slotCost} slot + $${buildRes.pipeCost} pipe).`,
      };
    }

    case 'PG_FINISH_BUILDING_CITIES': {
      if (state.activePlayerIndex > 0) {
        return {
          ...state,
          activePlayerIndex: state.activePlayerIndex - 1,
          lastActionSummary: `${playerId} finished building cities.`,
        };
      }

      // All players have finished Phase 4!
      // 1. Check if End-Game was triggered (any player reached `gameEndTriggerCities`)
      if (state.endGameTriggered) {
        const result = resolveEndGameWinner(state);
        return {
          ...state,
          phase: PowerGridPhase.GAME_OVER,
          winnerId: result.winnerId,
          finalStandings: result.standings,
          lastActionSummary: `Game Over! ${result.winnerId} wins by powering ${result.standings[0]!.citiesPowered} cities with $${result.standings[0]!.money} Elektro!`,
        };
      }

      // 2. If Step 3 card was drawn during Phase 4, transition to Step 3 now
      let nextStep = state.step;
      let nextActual = [...state.actualMarket];
      let nextFuture = [...state.futureMarket];
      let nextDeck = [...state.drawDeck];
      let nextPrng = state.prng;

      if (state.step3TriggeredDuringPhase && nextStep !== 'STEP_3') {
        const step3Res = transitionMarketToStep3(
          nextActual,
          nextFuture,
          nextDeck,
          nextPrng
        );
        nextActual = step3Res.actualMarket;
        nextFuture = step3Res.futureMarket;
        nextDeck = step3Res.drawDeck;
        nextPrng = step3Res.prng;
        nextStep = 'STEP_3';
      }

      // 3. Enter Phase 5: Bureaucracy (Forward Turn Order -> index 0)
      return {
        ...state,
        step: nextStep,
        phase: PowerGridPhase.PHASE_5_BUREAUCRACY,
        activePlayerIndex: 0,
        actualMarket: nextActual,
        futureMarket: nextFuture,
        drawDeck: nextDeck,
        step3TriggeredDuringPhase: false,
        bureaucracyCompletedIds: [],
        prng: nextPrng,
        lastActionSummary: `${playerId} finished building cities — entering Phase 5: Bureaucracy.`,
      };
    }

    case 'PG_POWER_CITIES': {
      const burnedTotals: Record<PowerGridResource, number> = {
        COAL: 0,
        OIL: 0,
        GARBAGE: 0,
        URANIUM: 0,
      };

      const allocMap = new Map(
        action.allocations.map((a) => [a.plantId, a.resourcesSpent])
      );

      let totalCapacityPowered = 0;
      const updatedPlants: OwnedPowerPlant[] = player.powerPlants.map((p) => {
        const spent = allocMap.get(p.card.id);
        if (!spent) return p;

        totalCapacityPowered += p.card.citiesPowered;
        const nextStored = { ...p.storedResources };
        for (const res of ALL_POWER_GRID_RESOURCES) {
          const amt = spent[res] ?? 0;
          if (amt > 0) {
            nextStored[res] -= amt;
            burnedTotals[res] += amt;
          }
        }
        return {
          ...p,
          storedResources: nextStored,
        };
      });

      const actualCitiesPowered = Math.min(
        player.cities.length,
        totalCapacityPowered
      );
      const payout = getBureaucracyPayout(actualCitiesPowered);

      const updatedPlayer: PowerGridPlayerState = {
        ...player,
        money: player.money + payout,
        powerPlants: updatedPlants,
        lastPoweredCities: actualCitiesPowered,
      };

      const nextPlayers: Record<string, PowerGridPlayerState> = {
        ...state.players,
        [playerId]: updatedPlayer,
      };

      let workingResourceMarket = returnResourcesToSupply(
        state.resourceMarket,
        burnedTotals
      );

      const nextBureaucracyIds = [...state.bureaucracyCompletedIds, playerId];

      // If more players still need to power cities in Phase 5, advance to next player in forward turn order
      if (state.activePlayerIndex + 1 < state.turnOrder.length) {
        return {
          ...state,
          players: nextPlayers,
          resourceMarket: workingResourceMarket,
          activePlayerIndex: state.activePlayerIndex + 1,
          bureaucracyCompletedIds: nextBureaucracyIds,
          lastActionSummary: `${playerId} powered ${actualCitiesPowered} cities and earned $${payout}.`,
        };
      }

      // All players have powered cities in Phase 5!
      // 1. Replenish Resource Market according to Step and player count
      workingResourceMarket = replenishResourceMarket(
        workingResourceMarket,
        state.turnOrder.length,
        state.step
      );

      // 2. Power Plant Market Maintenance:
      // - In Step 1 & Step 2: Place highest plant from Future Market under the draw deck, draw replacement.
      // - In Step 3: Remove lowest plant from Actual Market from the game, draw replacement.
      let nextStep = state.step;
      let nextActual = [...state.actualMarket];
      let nextFuture = [...state.futureMarket];
      let nextDeck = [...state.drawDeck];
      let nextPrng = state.prng;
      const highestCities = getHighestCityCount(nextPlayers);

      if (nextStep === 'STEP_3') {
        if (nextActual.length > 0) {
          const remainingActual = nextActual.slice(1);
          const drawRes = drawAndInsertReplacementPlant(
            remainingActual,
            nextFuture,
            nextDeck,
            nextStep,
            highestCities
          );
          nextActual = drawRes.actualMarket;
          nextFuture = drawRes.futureMarket;
          nextDeck = drawRes.drawDeck;
        }
      } else {
        const combined = [...nextActual, ...nextFuture].sort(
          (a, b) => a.id - b.id
        );
        if (combined.length > 0) {
          const highestPlant = combined.pop()!;
          const splitBeforeDraw = splitSortedMarket(combined, nextStep);
          const drawRes = drawAndInsertReplacementPlant(
            splitBeforeDraw.actualMarket,
            splitBeforeDraw.futureMarket,
            [...nextDeck, highestPlant],
            nextStep,
            highestCities
          );
          nextActual = drawRes.actualMarket;
          nextFuture = drawRes.futureMarket;
          nextDeck = drawRes.drawDeck;

          if (drawRes.step3Triggered) {
            const step3Res = transitionMarketToStep3(
              nextActual,
              nextFuture,
              nextDeck,
              nextPrng
            );
            nextActual = step3Res.actualMarket;
            nextFuture = step3Res.futureMarket;
            nextDeck = step3Res.drawDeck;
            nextPrng = step3Res.prng;
            nextStep = 'STEP_3';
          }
        }
      }

      // 3. Advance to Next Round & Phase 1 Turn Order Determination -> Phase 2 Auction
      const nextRound = state.roundNumber + 1;
      const nextTurnOrder = determineTurnOrder(nextPlayers, state.turnOrder);

      return {
        ...state,
        roundNumber: nextRound,
        step: nextStep,
        phase: PowerGridPhase.PHASE_2_AUCTION_POWER_PLANTS,
        turnOrder: nextTurnOrder,
        playerOrder: nextTurnOrder,
        activePlayerIndex: 0,
        auction: createInitialAuctionSubState(),
        actualMarket: nextActual,
        futureMarket: nextFuture,
        drawDeck: nextDeck,
        resourceMarket: workingResourceMarket,
        players: nextPlayers,
        bureaucracyCompletedIds: [],
        prng: nextPrng,
        lastActionSummary: `${playerId} powered ${actualCitiesPowered} cities (+$${payout}). Bureaucracy complete — Round ${nextRound} started!`,
      };
    }
  }
}

/**
 * Produces a player-specific sanitized view of `PowerGridGameState`,
 * hiding draw deck order and optionally hiding opponents' Elektro (`hideMoney`).
 */
export function getPowerGridPlayerPerspective(
  state: PowerGridGameState,
  playerId: string
): SanitizedPowerGridState {
  const effectiveSelfId = state.players[playerId]
    ? playerId
    : state.turnOrder[0]!;

  const toSanitizedPlayer = (
    p: PowerGridPlayerState,
    isSelf: boolean
  ): SanitizedPowerGridPlayerState => ({
    id: p.id,
    money:
      isSelf || !state.hideMoney || state.phase === PowerGridPhase.GAME_OVER
        ? p.money
        : null,
    cities: p.cities,
    cityCount: p.cities.length,
    powerPlants: p.powerPlants,
    highestPlantNumber: getHighestPlantNumber(p),
    lastPoweredCities: p.lastPoweredCities,
  });

  const selfPlayer = toSanitizedPlayer(state.players[effectiveSelfId]!, true);
  const opponents: Record<string, SanitizedPowerGridPlayerState> = {};
  for (const pid of state.turnOrder) {
    if (pid !== effectiveSelfId) {
      opponents[pid] = toSanitizedPlayer(state.players[pid]!, false);
    }
  }

  return {
    gameId: 'power_grid',
    mapId: state.mapId,
    activeRegions: state.activeRegions,
    turnNumber: state.turnNumber,
    roundNumber: state.roundNumber,
    step: state.step,
    phase: state.phase,
    turnOrder: state.turnOrder,
    playerOrder: state.turnOrder,
    activePlayerId: getActivePlayerId(state),
    auction: state.auction,
    actualMarket: state.actualMarket,
    futureMarket: state.futureMarket,
    drawDeckCount: state.drawDeck.length,
    endGameTriggered: state.endGameTriggered,
    resourceMarket: state.resourceMarket,
    cityBoard: state.cityBoard,
    self: selfPlayer,
    opponents,
    winnerId: state.winnerId,
    finalStandings: state.finalStandings,
    lastActionSummary: state.lastActionSummary,
  };
}

export function calculatePowerGridFinalScores(
  state: PowerGridGameState
): Record<string, number> {
  const scores: Record<string, number> = {};
  for (const pid of state.turnOrder) {
    const p = state.players[pid]!;
    scores[pid] = calculateMaxPoweredCities(p);
  }
  return scores;
}

// Standard aliases matching the generic Engine interface (`initGame`, `validateAction`, `applyAction`, `getPlayerPerspective`)
export {
  initPowerGridGame as initGame,
  validatePowerGridAction as validateAction,
  applyPowerGridAction as applyAction,
  getPowerGridPlayerPerspective as getPlayerPerspective,
};
