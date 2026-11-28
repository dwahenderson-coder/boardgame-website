import { describe, expect, it } from 'vitest';
import { GameRegistry } from '../registry.js';
import {
  applyAction,
  calculateCityBuildCost,
  calculateResourcePurchaseCost,
  createEmptyResourceStorage,
  determineTurnOrder,
  getBureaucracyPayout,
  getEffectivePlayerCountConfig,
  getNextUnitCost,
  getPlayerPerspective,
  initGame,
  POWER_GRID_MAPS,
  POWER_GRID_VISUAL_LAYOUTS,
  PowerGridGameState,
  PowerGridPhase,
  replenishResourceMarket,
  resolvePowerGridMapIdFromExpansions,
  resolvePowerGridRegionsFromExpansions,
  STANDARD_POWER_PLANTS,
  STEP_3_CARD,
  validateAction,
} from './index.js';

function getPlantById(id: number) {
  const card = STANDARD_POWER_PLANTS.find((p) => p.id === id);
  if (!card) {
    throw new Error(`Power Plant #${id} not found.`);
  }
  return card;
}

describe('Power Grid Core Engine (Headless State Machine, Market & Graph)', () => {
  // ---------------------------------------------------------------------------
  // 1. Turn Order Calculation
  // ---------------------------------------------------------------------------
  describe('1. Phase 1: Turn Order Calculation', () => {
    it('ranks players primarily by most connected cities and breaks ties by highest power plant number', () => {
      let state = initGame(['p1', 'p2', 'p3', 'p4'], 101);

      // Give p1: 4 cities, highest plant #08
      // Give p2: 5 cities, highest plant #03 (most cities -> 1st)
      // Give p3: 4 cities, highest plant #10 (tied at 4 cities with p1, wins tie via plant #10 -> 2nd)
      // Give p4: 2 cities, highest plant #25 (fewest cities -> 4th)
      state = {
        ...state,
        roundNumber: 2,
        firstRoundOrderRecomputed: true,
        phase: PowerGridPhase.PHASE_1_DETERMINE_TURN_ORDER,
        players: {
          p1: {
            ...state.players['p1']!,
            cities: ['SEATTLE', 'PORTLAND', 'BOISE', 'BILLINGS'],
            powerPlants: [
              {
                card: getPlantById(8),
                storedResources: createEmptyResourceStorage(),
              },
            ],
          },
          p2: {
            ...state.players['p2']!,
            cities: [
              'SAN_FRANCISCO',
              'LOS_ANGELES',
              'SAN_DIEGO',
              'LAS_VEGAS',
              'PHOENIX',
            ],
            powerPlants: [
              {
                card: getPlantById(3),
                storedResources: createEmptyResourceStorage(),
              },
            ],
          },
          p3: {
            ...state.players['p3']!,
            cities: ['FARGO', 'DULUTH', 'MINNEAPOLIS', 'CHICAGO'],
            powerPlants: [
              {
                card: getPlantById(4),
                storedResources: createEmptyResourceStorage(),
              },
              {
                card: getPlantById(10),
                storedResources: createEmptyResourceStorage(),
              },
            ],
          },
          p4: {
            ...state.players['p4']!,
            cities: ['OMAHA', 'CHEYENNE'],
            powerPlants: [
              {
                card: getPlantById(25),
                storedResources: createEmptyResourceStorage(),
              },
            ],
          },
        },
      };

      const computedOrder = determineTurnOrder(state.players, state.turnOrder);
      expect(computedOrder).toEqual(['p2', 'p3', 'p1', 'p4']);

      // Also verify applying PG_DETERMINE_TURN_ORDER transitions Phase 1 -> Phase 2 with the exact order
      const nextState = applyAction(state, 'p1', {
        type: 'PG_DETERMINE_TURN_ORDER',
      });
      expect(nextState.phase).toBe(
        PowerGridPhase.PHASE_2_AUCTION_POWER_PLANTS
      );
      expect(nextState.turnOrder).toEqual(['p2', 'p3', 'p1', 'p4']);
    });
  });

  // ---------------------------------------------------------------------------
  // 2. Auction State Machine
  // ---------------------------------------------------------------------------
  describe('2. Phase 2: Auction State Machine', () => {
    it('enforces Round 1 mandatory purchase, bid escalation, dropping out, passing restriction, market replacement & re-sorting, and 4th plant discard', () => {
      let state = initGame(['p1', 'p2', 'p3'], 42);
      // Force a known turn order ['p1', 'p2', 'p3'] and known drawDeck top cards
      state = {
        ...state,
        turnOrder: ['p1', 'p2', 'p3'],
        playerOrder: ['p1', 'p2', 'p3'],
        drawDeck: [
          getPlantById(13),
          getPlantById(11),
          getPlantById(15),
          ...state.drawDeck,
        ],
      };

      // Initial Actual Market has [3, 4, 5, 6] and Future Market has [7, 8, 9, 10]
      expect(state.actualMarket.map((c) => c.id)).toEqual([3, 4, 5, 6]);
      expect(state.futureMarket.map((c) => c.id)).toEqual([7, 8, 9, 10]);

      // Round 1 Rule: p1 cannot pass the auction phase without buying a plant
      const round1PassAttempt = validateAction(state, 'p1', {
        type: 'PG_PASS_AUCTION_PHASE',
      });
      expect(round1PassAttempt.valid).toBe(false);

      // Cannot open auction on a plant in Future Market (#07)
      expect(
        validateAction(state, 'p1', {
          type: 'PG_OPEN_AUCTION',
          plantId: 7,
          bid: 7,
        }).valid
      ).toBe(false);

      // p1 opens auction on Plant #03 with minimum bid $3
      state = applyAction(state, 'p1', {
        type: 'PG_OPEN_AUCTION',
        plantId: 3,
        bid: 3,
      });
      expect(state.auction?.activePlant?.id).toBe(3);
      expect(state.auction?.currentBid).toBe(3);

      // Next bidder is p2: p2 raises to $4
      state = applyAction(state, 'p2', {
        type: 'PG_RAISE_BID',
        bid: 4,
      });
      expect(state.auction?.currentBid).toBe(4);
      expect(state.auction?.highBidderId).toBe('p2');

      // Next bidder is p3: p3 passes out of Plant #03's auction
      state = applyAction(state, 'p3', {
        type: 'PG_PASS_CURRENT_BID',
      });
      expect(state.auction?.eligibleBidders).toEqual(['p1', 'p2']);

      // Back to p1: p1 raises to $5
      state = applyAction(state, 'p1', {
        type: 'PG_RAISE_BID',
        bid: 5,
      });

      // p2 passes -> p1 wins Plant #03 for $5!
      // Replacement card #13 is drawn; combined [4, 5, 6, 7, 8, 9, 10, 13] re-sorts into:
      // Actual Market: [4, 5, 6, 7], Future Market: [8, 9, 10, 13]
      state = applyAction(state, 'p2', {
        type: 'PG_PASS_CURRENT_BID',
      });
      expect(state.players['p1']!.money).toBe(45);
      expect(state.players['p1']!.powerPlants.map((p) => p.card.id)).toEqual([
        3,
      ]);
      expect(state.actualMarket.map((c) => c.id)).toEqual([4, 5, 6, 7]);
      expect(state.futureMarket.map((c) => c.id)).toEqual([8, 9, 10, 13]);

      // Now p2 is up to open an auction (since p1 already bought a plant this round)
      // p2 opens Plant #05 at $5; p3 passes -> p2 wins Plant #05 for $5!
      state = applyAction(state, 'p2', {
        type: 'PG_OPEN_AUCTION',
        plantId: 5,
        bid: 5,
      });
      // Notice p1 is NOT in eligibleBidders because p1 already bought a plant this round
      expect(state.auction?.eligibleBidders).toEqual(['p2', 'p3']);
      state = applyAction(state, 'p3', {
        type: 'PG_PASS_CURRENT_BID',
      });
      expect(state.players['p2']!.powerPlants.map((p) => p.card.id)).toEqual([
        5,
      ]);

      // Now p3 is the last remaining player in Round 1 -> opens Plant #04 at $4 and wins immediately uncontested!
      state = applyAction(state, 'p3', {
        type: 'PG_OPEN_AUCTION',
        plantId: 4,
        bid: 4,
      });
      expect(state.players['p3']!.powerPlants.map((p) => p.card.id)).toEqual([
        4,
      ]);

      // Phase 2 is now complete! Because it was Round 1, turn order is automatically re-determined by highest plant:
      // p2 (#05) -> p3 (#04) -> p1 (#03), and Phase 3 begins in REVERSE turn order (starting with p1)!
      expect(state.phase).toBe(PowerGridPhase.PHASE_3_BUY_RESOURCES);
      expect(state.turnOrder).toEqual(['p2', 'p3', 'p1']);
      expect(state.turnOrder[state.activePlayerIndex]).toBe('p1');
    });

    it('discards the lowest plant in Actual Market when all players pass in Round 2+, and enforces 4th plant discard with fuel transfer', () => {
      let state = initGame(['p1', 'p2', 'p3'], 77);
      state = {
        ...state,
        roundNumber: 2,
        firstRoundOrderRecomputed: true,
        turnOrder: ['p1', 'p2', 'p3'],
        playerOrder: ['p1', 'p2', 'p3'],
        drawDeck: [getPlantById(14), ...state.drawDeck],
      };

      // All 3 players pass the auction phase in Round 2
      state = applyAction(state, 'p1', { type: 'PG_PASS_AUCTION_PHASE' });
      state = applyAction(state, 'p2', { type: 'PG_PASS_AUCTION_PHASE' });
      state = applyAction(state, 'p3', { type: 'PG_PASS_AUCTION_PHASE' });

      // Lowest plant (#03) was discarded and #14 drawn -> Actual Market is now [4, 5, 6, 7]
      expect(state.phase).toBe(PowerGridPhase.PHASE_3_BUY_RESOURCES);
      expect(state.actualMarket.map((c) => c.id)).toEqual([4, 5, 6, 7]);

      // Also verify 4th plant discard & fuel transfer when a player with 3 plants wins a 4th plant:
      let discardState = initGame(['p1', 'p2', 'p3'], 88);
      discardState = {
        ...discardState,
        roundNumber: 3,
        firstRoundOrderRecomputed: true,
        turnOrder: ['p1', 'p2', 'p3'],
        playerOrder: ['p1', 'p2', 'p3'],
        players: {
          ...discardState.players,
          p1: {
            ...discardState.players['p1']!,
            money: 50,
            powerPlants: [
              {
                card: getPlantById(4), // Coal (intake 2, stores 2 Coal)
                storedResources: { COAL: 2, OIL: 0, GARBAGE: 0, URANIUM: 0 },
              },
              {
                card: getPlantById(6),
                storedResources: createEmptyResourceStorage(),
              },
              {
                card: getPlantById(7),
                storedResources: createEmptyResourceStorage(),
              },
            ],
          },
        },
      };

      // p1 opens auction on Hybrid Plant #05 (stores Coal/Oil up to 4) for $5; p2 and p3 pass
      discardState = applyAction(discardState, 'p1', {
        type: 'PG_OPEN_AUCTION',
        plantId: 5,
        bid: 5,
      });
      discardState = applyAction(discardState, 'p2', {
        type: 'PG_PASS_CURRENT_BID',
      });
      discardState = applyAction(discardState, 'p3', {
        type: 'PG_PASS_CURRENT_BID',
      });

      // p1 now has a pendingPlantDiscard for newlyWonPlant #05
      expect(discardState.auction?.pendingPlantDiscard?.newlyWonPlant.id).toBe(
        5
      );

      // p1 discards Plant #04 and transfers its 2 COAL onto newly won Plant #05
      discardState = applyAction(discardState, 'p1', {
        type: 'PG_DISCARD_PLANT',
        discardPlantId: 4,
        transferResources: [{ toPlantId: 5, resource: 'COAL', amount: 2 }],
      });

      const p1Plants = discardState.players['p1']!.powerPlants;
      expect(p1Plants.map((p) => p.card.id)).toEqual([5, 6, 7]);
      expect(
        p1Plants.find((p) => p.card.id === 5)!.storedResources.COAL
      ).toBe(2);
    });
  });

  // ---------------------------------------------------------------------------
  // 3. Resource Market Scarcity
  // ---------------------------------------------------------------------------
  describe('3. Phase 3: Resource Market Scarcity & Storage Capacity', () => {
    it('dynamically increases Coal unit cost from $1 to $2 after 3 Coal are purchased, and enforces 2x intake capacity', () => {
      let state = initGame(['p1', 'p2'], 303);

      // Initially 24 Coal in market -> spaces $1..$8 are full (3 per dollar).
      // Buying 3 Coal costs 3 * $1 = $3, and the next unit of Coal increases to $2!
      expect(state.resourceMarket.inventory.COAL).toBe(24);
      expect(getNextUnitCost(state.resourceMarket, 'COAL')).toBe(1);
      expect(
        calculateResourcePurchaseCost(state.resourceMarket, 'COAL', 3)
      ).toBe(3);

      // Set up Phase 3 with p2 acting first (reverse turn order), owning Plant #08 (3 Coal intake -> max 6 Coal capacity)
      // and p1 acting second, owning Plant #04 (2 Coal intake -> max 4 Coal capacity)
      state = {
        ...state,
        phase: PowerGridPhase.PHASE_3_BUY_RESOURCES,
        turnOrder: ['p1', 'p2'],
        playerOrder: ['p1', 'p2'],
        activePlayerIndex: 1, // p2 acts first in reverse order
        players: {
          p1: {
            ...state.players['p1']!,
            money: 50,
            powerPlants: [
              {
                card: getPlantById(4), // Coal intake 2 -> max capacity 4
                storedResources: createEmptyResourceStorage(),
              },
            ],
          },
          p2: {
            ...state.players['p2']!,
            money: 50,
            powerPlants: [
              {
                card: getPlantById(8), // Coal intake 3 -> max capacity 6
                storedResources: createEmptyResourceStorage(),
              },
            ],
          },
        },
      };

      // p2 buys 3 Coal at $1 each ($3 total)
      state = applyAction(state, 'p2', {
        type: 'PG_BUY_RESOURCES',
        purchases: [{ plantId: 8, resource: 'COAL', quantity: 3 }],
      });
      expect(state.players['p2']!.money).toBe(47);
      expect(state.resourceMarket.inventory.COAL).toBe(21);
      expect(getNextUnitCost(state.resourceMarket, 'COAL')).toBe(2);

      state = applyAction(state, 'p2', {
        type: 'PG_FINISH_BUYING_RESOURCES',
      });

      // Now p1's turn: p1 tries to buy 5 Coal on Plant #04 (exceeds 2x intake capacity of 4) -> rejected!
      expect(
        validateAction(state, 'p1', {
          type: 'PG_BUY_RESOURCES',
          purchases: [{ plantId: 4, resource: 'COAL', quantity: 5 }],
        }).valid
      ).toBe(false);

      // p1 buys 4 Coal: first 3 come from the $2 space ($6) + 4th comes from the $3 space ($3) = $9 total!
      state = applyAction(state, 'p1', {
        type: 'PG_BUY_RESOURCES',
        purchases: [{ plantId: 4, resource: 'COAL', quantity: 4 }],
      });
      expect(state.players['p1']!.money).toBe(41); // 50 - 9 = 41
      expect(state.resourceMarket.inventory.COAL).toBe(17);
      expect(getNextUnitCost(state.resourceMarket, 'COAL')).toBe(3);
    });
  });

  // ---------------------------------------------------------------------------
  // 4. Network Expansion Pathfinding (Dijkstra)
  // ---------------------------------------------------------------------------
  describe('4. Phase 4: Network Expansion Pathfinding (Dijkstra)', () => {
    it('calculates exact city slot cost + cumulative pipe cost across intermediate unowned nodes, and enforces step slot limits', () => {
      let state = initGame(['p1', 'p2', 'p3'], 404, {
        mapId: 'USA',
        mapRegionKeys: ['NORTHWEST', 'SOUTHWEST', 'MIDWEST'],
      });

      state = {
        ...state,
        phase: PowerGridPhase.PHASE_4_BUILD_CITIES,
        turnOrder: ['p1', 'p2', 'p3'],
        playerOrder: ['p1', 'p2', 'p3'],
        activePlayerIndex: 2, // p3 first in reverse order
      };

      // p3 builds their first city in SEATTLE: no pipe cost ($0) + Slot 1 ($10) = $10
      const firstCityCheck = calculateCityBuildCost(
        state.mapId,
        state.cityBoard,
        state.step,
        'p3',
        [],
        'SEATTLE'
      );
      expect(firstCityCheck.valid).toBe(true);
      expect(firstCityCheck.slotCost).toBe(10);
      expect(firstCityCheck.pipeCost).toBe(0);
      expect(firstCityCheck.totalCost).toBe(10);

      state = applyAction(state, 'p3', {
        type: 'PG_BUILD_CITY',
        cityId: 'SEATTLE',
      });
      expect(state.players['p3']!.money).toBe(40);

      // Now p3 wants to connect SALT_LAKE_CITY from SEATTLE, routing through intermediate unowned BOISE:
      // SEATTLE -> BOISE ($12) -> SALT_LAKE_CITY ($8) = $20 cumulative pipe cost + $10 slot cost = $30 total!
      // (Alternative path SEATTLE -> PORTLAND $3 -> BOISE $13 -> SALT_LAKE_CITY $8 = $24 pipe cost)
      const pathCheck = calculateCityBuildCost(
        state.mapId,
        state.cityBoard,
        state.step,
        'p3',
        state.players['p3']!.cities,
        'SALT_LAKE_CITY'
      );
      expect(pathCheck.valid).toBe(true);
      expect(pathCheck.pipeCost).toBe(20);
      expect(pathCheck.slotCost).toBe(10);
      expect(pathCheck.totalCost).toBe(30);
      expect(pathCheck.path).toEqual(['SEATTLE', 'BOISE', 'SALT_LAKE_CITY']);

      state = applyAction(state, 'p3', {
        type: 'PG_BUILD_CITY',
        cityId: 'SALT_LAKE_CITY',
      });
      expect(state.players['p3']!.money).toBe(10); // 40 - 30 = 10

      // Constraint: p3 cannot build a second slot in SEATTLE
      expect(
        validateAction(state, 'p3', {
          type: 'PG_BUILD_CITY',
          cityId: 'SEATTLE',
        }).valid
      ).toBe(false);

      // Advance to p2 in Step 1: p2 cannot build in SEATTLE during STEP_1 because Slot 1 is taken by p3!
      state = applyAction(state, 'p3', {
        type: 'PG_FINISH_BUILDING_CITIES',
      });
      expect(
        validateAction(state, 'p2', {
          type: 'PG_BUILD_CITY',
          cityId: 'SEATTLE',
        }).valid
      ).toBe(false);

      // In STEP_2, Slot 2 opens in SEATTLE at $15!
      const step2State: PowerGridGameState = {
        ...state,
        step: 'STEP_2',
      };
      const step2Check = calculateCityBuildCost(
        step2State.mapId,
        step2State.cityBoard,
        step2State.step,
        'p2',
        [],
        'SEATTLE'
      );
      expect(step2Check.valid).toBe(true);
      expect(step2Check.slotCost).toBe(15);
      expect(step2Check.totalCost).toBe(15);
    });
  });

  // ---------------------------------------------------------------------------
  // 5. Bureaucracy Payout & Restock
  // ---------------------------------------------------------------------------
  describe('5. Phase 5: Bureaucracy Payout, Fuel Deduction & Market Replenishment', () => {
    it('awards exact Elektro from the payout table, deducts burned fuel, and replenishes the Resource Market by player count and step', () => {
      // Verify payout lookup table milestones
      expect(getBureaucracyPayout(0)).toBe(10);
      expect(getBureaucracyPayout(1)).toBe(22);
      expect(getBureaucracyPayout(3)).toBe(44);
      expect(getBureaucracyPayout(7)).toBe(82);
      expect(getBureaucracyPayout(20)).toBe(150);

      let state = initGame(['p1', 'p2', 'p3'], 505);
      // Set up Phase 5 Bureaucracy for a 3-player game in STEP_1:
      // 3-player STEP_1 restock rates: COAL +4, OIL +2, GARBAGE +1, URANIUM +1
      state = {
        ...state,
        phase: PowerGridPhase.PHASE_5_BUREAUCRACY,
        turnOrder: ['p1', 'p2', 'p3'],
        playerOrder: ['p1', 'p2', 'p3'],
        activePlayerIndex: 0,
        drawDeck: [getPlantById(15), STEP_3_CARD],
        resourceMarket: {
          inventory: {
            COAL: 10,
            OIL: 10,
            GARBAGE: 4,
            URANIUM: 1,
          },
          totalSupplyPool: {
            COAL: 11, // 3 Coal are on p1's plant
            OIL: 14,
            GARBAGE: 20,
            URANIUM: 11,
          },
        },
        players: {
          p1: {
            id: 'p1',
            color: 'red',
            money: 10,
            cities: ['SEATTLE', 'PORTLAND', 'BOISE'], // 3 connected cities
            powerPlants: [
              {
                card: getPlantById(8), // Burns 3 Coal -> powers 2 cities
                storedResources: { COAL: 3, OIL: 0, GARBAGE: 0, URANIUM: 0 },
              },
              {
                card: getPlantById(13), // Ecological (0 fuel) -> powers 1 city
                storedResources: createEmptyResourceStorage(),
              },
            ],
            lastPoweredCities: 0,
          },
          p2: {
            id: 'p2',
            color: 'blue',
            money: 20,
            cities: ['SAN_FRANCISCO'],
            powerPlants: [],
            lastPoweredCities: 0,
          },
          p3: {
            id: 'p3',
            color: 'yellow',
            money: 30,
            cities: [],
            powerPlants: [],
            lastPoweredCities: 0,
          },
        },
      };

      // p1 activates Plant #08 (spending 3 Coal) and Ecological Plant #13 (spending 0) -> powers 3 cities -> +$44 Elektro!
      state = applyAction(state, 'p1', {
        type: 'PG_POWER_CITIES',
        allocations: [
          { plantId: 8, resourcesSpent: { COAL: 3 } },
          { plantId: 13, resourcesSpent: {} },
        ],
      });
      expect(state.players['p1']!.money).toBe(54); // 10 + 44
      expect(
        state.players['p1']!.powerPlants.find((p) => p.card.id === 8)!
          .storedResources.COAL
      ).toBe(0);

      // p2 and p3 power 0 cities -> +$10 Elektro each
      state = applyAction(state, 'p2', {
        type: 'PG_POWER_CITIES',
        allocations: [],
      });
      state = applyAction(state, 'p3', {
        type: 'PG_POWER_CITIES',
        allocations: [],
      });

      // Verify Bureaucracy replenished the market according to 3-player STEP_1 table (+4 Coal, +2 Oil, +1 Garbage, +1 Uranium)
      expect(state.resourceMarket.inventory).toEqual({
        COAL: 14,
        OIL: 12,
        GARBAGE: 5,
        URANIUM: 2,
      });
      expect(state.roundNumber).toBe(2);
      expect(state.phase).toBe(PowerGridPhase.PHASE_2_AUCTION_POWER_PLANTS);
    });
  });

  // ---------------------------------------------------------------------------
  // 6. Victory Condition Verification
  // ---------------------------------------------------------------------------
  describe('6. End Game Resolution & Victory Condition Verification', () => {
    it('awards victory to the player who powers the most cities (with fuel) rather than the player who merely connected the most cities', () => {
      let state = initGame(['p1', 'p2'], 606);

      // In a 3-player setup, 17 cities triggers game end. Let's test a 3-player state at the end of Phase 4:
      // - p1 connects 17 cities (triggering Game End), has plants with capacity for 17 cities,
      //   but only has fuel stored to power 12 cities!
      // - p2 has only 15 connected cities, but has plants + fuel to power all 15 cities!
      // - p3 has 15 connected cities and powers 15 cities, but has less Elektro than p2 (testing Tie-breaker #1)!
      state = initGame(['p1', 'p2', 'p3'], 606);

      const makeCities = (count: number, prefix: string) =>
        Array.from({ length: count }, (_, i) => `${prefix}_${i + 1}`);

      state = {
        ...state,
        step: 'STEP_3',
        phase: PowerGridPhase.PHASE_4_BUILD_CITIES,
        turnOrder: ['p1', 'p2', 'p3'],
        playerOrder: ['p1', 'p2', 'p3'],
        activePlayerIndex: 0, // Last player in reverse order finishing Phase 4
        endGameTriggered: true,
        players: {
          p1: {
            id: 'p1',
            color: 'red',
            money: 120,
            cities: makeCities(17, 'C_P1'), // 17 connected cities!
            powerPlants: [
              {
                card: getPlantById(38), // Garbage intake 3, powers 7 cities (FUNDED)
                storedResources: { COAL: 0, OIL: 0, GARBAGE: 3, URANIUM: 0 },
              },
              {
                card: getPlantById(35), // Oil intake 1, powers 5 cities (FUNDED)
                storedResources: { COAL: 0, OIL: 1, GARBAGE: 0, URANIUM: 0 },
              },
              {
                card: getPlantById(36), // Coal intake 3, powers 7 cities (UNFUNDED: only 1 Coal stored!)
                storedResources: { COAL: 1, OIL: 0, GARBAGE: 0, URANIUM: 0 },
              },
            ], // Total actually powered = 7 + 5 + 0 = 12 cities
            lastPoweredCities: 0,
          },
          p2: {
            id: 'p2',
            color: 'blue',
            money: 85,
            cities: makeCities(15, 'C_P2'), // 15 connected cities
            powerPlants: [
              {
                card: getPlantById(50), // Ecological (0 intake), powers 6 cities (FUNDED)
                storedResources: createEmptyResourceStorage(),
              },
              {
                card: getPlantById(44), // Ecological (0 intake), powers 5 cities (FUNDED)
                storedResources: createEmptyResourceStorage(),
              },
              {
                card: getPlantById(37), // Ecological (0 intake), powers 4 cities (FUNDED)
                storedResources: createEmptyResourceStorage(),
              },
            ], // Total actually powered = min(15, 6 + 5 + 4) = 15 cities!
            lastPoweredCities: 0,
          },
          p3: {
            id: 'p3',
            color: 'green',
            money: 40,
            cities: makeCities(15, 'C_P3'), // 15 connected cities
            powerPlants: [
              {
                card: getPlantById(39), // Uranium intake 1, powers 6 cities (FUNDED)
                storedResources: { COAL: 0, OIL: 0, GARBAGE: 0, URANIUM: 1 },
              },
              {
                card: getPlantById(34), // Uranium intake 1, powers 5 cities (FUNDED)
                storedResources: { COAL: 0, OIL: 0, GARBAGE: 0, URANIUM: 1 },
              },
              {
                card: getPlantById(28), // Uranium intake 1, powers 4 cities (FUNDED)
                storedResources: { COAL: 0, OIL: 0, GARBAGE: 0, URANIUM: 1 },
              },
            ], // Total actually powered = 15 cities (tied with p2, but p2 has $85 vs p3's $40)
            lastPoweredCities: 0,
          },
        },
      };

      // p1 finishes building cities -> triggers End Game Resolution
      const finalState = applyAction(state, 'p1', {
        type: 'PG_FINISH_BUILDING_CITIES',
      });

      expect(finalState.phase).toBe(PowerGridPhase.GAME_OVER);
      expect(finalState.winnerId).toBe('p2');
      expect(finalState.finalStandings).toEqual([
        { playerId: 'p2', citiesPowered: 15, money: 85, totalCities: 15 },
        { playerId: 'p3', citiesPowered: 15, money: 40, totalCities: 15 },
        { playerId: 'p1', citiesPowered: 12, money: 120, totalCities: 17 },
      ]);
    });

    it('supports hidden opponent Elektro in getPlayerPerspective when hideMoney is enabled', () => {
      const state = initGame(['p1', 'p2'], 707, {
        mapId: 'GERMANY',
        hideMoney: true,
      });
      const p1Perspective = getPlayerPerspective(state, 'p1');
      expect(p1Perspective.self.money).toBe(50);
      expect(p1Perspective.opponents['p2']!.money).toBeNull();
    });

    it('provides complete visual map coordinates for all 42 cities & 6 regions on both USA and Germany, and supports lobby map/region/color options', () => {
      for (const mapId of ['USA', 'GERMANY'] as const) {
        const mapDef = POWER_GRID_MAPS[mapId];
        const layout = POWER_GRID_VISUAL_LAYOUTS[mapId];
        expect(mapDef.cities).toHaveLength(42);
        expect(mapDef.regions).toHaveLength(6);

        for (const rid of mapDef.regions) {
          expect(layout.regions[rid]).toBeDefined();
          expect(layout.regions[rid]!.polygonPath.length).toBeGreaterThan(10);
        }
        for (const city of mapDef.cities) {
          const coord = layout.cities[city.id];
          expect(coord).toBeDefined();
          expect(coord!.x).toBeGreaterThan(0);
          expect(coord!.y).toBeGreaterThan(0);
        }
      }

      // Default vs custom contiguous regions via expansion tokens
      expect(resolvePowerGridRegionsFromExpansions('USA', 3, [])).toEqual([
        'NORTHWEST',
        'SOUTHWEST',
        'MIDWEST',
      ]);
      expect(
        resolvePowerGridRegionsFromExpansions('GERMANY', 3, [
          'germany_map',
          'region:CUSTOM',
          'region:CENTER',
          'region:SOUTH_WEST',
          'region:SOUTH_EAST',
        ])
      ).toEqual(['CENTER', 'SOUTH_WEST', 'SOUTH_EAST']);

      // Verify GameRegistry.power_grid.initGame honors germany_map, custom regions, and lobby colors
      const regState = GameRegistry.power_grid.initGame(
        ['p1', 'p2', 'p3'],
        99,
        {
          selectedExpansions: [
            'germany_map',
            'region:CUSTOM',
            'region:WEST',
            'region:SOUTH_WEST',
            'region:SOUTH_EAST',
          ],
          playerColors: { p1: 'purple', p2: 'green', p3: 'yellow' },
        }
      ) as PowerGridGameState;

      expect(regState.mapId).toBe('GERMANY');
      expect(regState.activeRegions).toEqual([
        'WEST',
        'SOUTH_WEST',
        'SOUTH_EAST',
      ]);
      expect(Object.keys(regState.cityBoard)).toHaveLength(21);
      expect(regState.players['p1']!.color).toBe('purple');
      expect(regState.players['p2']!.color).toBe('green');
      expect(regState.players['p3']!.color).toBe('yellow');
    });
  });

  // ---------------------------------------------------------------------------
  // 7. Québec & Baden-Württemberg Expansion Maps & Variant Rules
  // ---------------------------------------------------------------------------
  describe('7. Québec & Baden-Württemberg Expansion Maps & Variant Rules', () => {
    it('validates map geometry, symmetric region adjacency, and pipe connections for QUEBEC and BADEN_WUERTTEMBERG', () => {
      const expectedStats = {
        QUEBEC: { cities: 42, regions: 6, connections: 65 },
        BADEN_WUERTTEMBERG: { cities: 35, regions: 5, connections: 69 },
      } as const;

      for (const mapId of ['QUEBEC', 'BADEN_WUERTTEMBERG'] as const) {
        const mapDef = POWER_GRID_MAPS[mapId];
        const layout = POWER_GRID_VISUAL_LAYOUTS[mapId];
        expect(mapDef.cities).toHaveLength(expectedStats[mapId].cities);
        expect(mapDef.regions).toHaveLength(expectedStats[mapId].regions);
        expect(mapDef.connections).toHaveLength(
          expectedStats[mapId].connections
        );

        const cityIds = new Set(mapDef.cities.map((c) => c.id));
        expect(cityIds.size).toBe(expectedStats[mapId].cities);

        // Every region has polygon visual layout and symmetric adjacency
        for (const rid of mapDef.regions) {
          expect(layout.regions[rid]).toBeDefined();
          expect(layout.regions[rid]!.polygonPath.length).toBeGreaterThan(10);
          for (const adj of mapDef.regionAdjacency[rid] ?? []) {
            expect(mapDef.regionAdjacency[adj]).toContain(rid);
          }
        }

        // Every city has visual coordinates
        for (const city of mapDef.cities) {
          const coord = layout.cities[city.id];
          expect(coord).toBeDefined();
          expect(coord!.x).toBeGreaterThan(0);
          expect(coord!.y).toBeGreaterThan(0);
        }

        // Every pipe connection references valid distinct cities
        for (const conn of mapDef.connections) {
          expect(cityIds.has(conn.from)).toBe(true);
          expect(cityIds.has(conn.to)).toBe(true);
          expect(conn.from).not.toBe(conn.to);
          expect(conn.cost).toBeGreaterThanOrEqual(0);
        }
      }

      // Verify expansion ID resolution
      expect(resolvePowerGridMapIdFromExpansions(['quebec_map'])).toBe(
        'QUEBEC'
      );
      expect(
        resolvePowerGridMapIdFromExpansions(['baden_wuerttemberg_map'])
      ).toBe('BADEN_WUERTTEMBERG');
    });

    it('enforces Québec setup (#13, #18, #22 on top of draw deck), Hydro Ecological market protection, and Québec restock rates', () => {
      let state = initGame(['p1', 'p2', 'p3', 'p4'], 2026, {
        mapId: 'QUEBEC',
      });

      // 1. Setup stacks Ecological plants #13, #18, #22 on top of the draw pile in exact order
      expect(state.drawDeck.slice(0, 3).map((c) => c.id)).toEqual([13, 18, 22]);

      // 2. Multi-district 0-cost connections exist (Montréal & Québec City)
      const montrealCheck = calculateCityBuildCost(
        'QUEBEC',
        state.cityBoard,
        'STEP_1',
        'p1',
        ['LAVAL'],
        'LONGUEUIL'
      );
      if (state.cityBoard['LAVAL'] && state.cityBoard['LONGUEUIL']) {
        expect(montrealCheck.valid).toBe(true);
        expect(montrealCheck.pipeCost).toBe(0);
        expect(montrealCheck.slotCost).toBe(10);
      }

      // 3. Hydro / Ecological Market Rule in Phase 5 Bureaucracy:
      // Highest plant in Future Market (#37 Ecological) stays in market;
      // highest non-ecological plant in Future Market (#34 Uranium) cycles under drawDeck!
      state = {
        ...state,
        step: 'STEP_2',
        phase: PowerGridPhase.PHASE_5_BUREAUCRACY,
        turnOrder: ['p1', 'p2', 'p3', 'p4'],
        playerOrder: ['p1', 'p2', 'p3', 'p4'],
        activePlayerIndex: 0,
        actualMarket: [
          getPlantById(14),
          getPlantById(15),
          getPlantById(16),
          getPlantById(18), // Ecological
        ],
        futureMarket: [
          getPlantById(20),
          getPlantById(22), // Ecological
          getPlantById(34), // Highest NON-ecological plant in Future Market
          getPlantById(37), // Highest plant overall, Ecological -> protected!
        ],
        drawDeck: [getPlantById(25), STEP_3_CARD],
      };

      for (const pid of ['p1', 'p2', 'p3', 'p4']) {
        state = applyAction(state, pid, {
          type: 'PG_POWER_CITIES',
          allocations: [],
        });
      }

      // #37 stayed in the market, #34 was cycled under drawDeck, and #25 was drawn!
      const allMarketIds = [
        ...state.actualMarket.map((c) => c.id),
        ...state.futureMarket.map((c) => c.id),
      ];
      expect(allMarketIds).toContain(37);
      expect(allMarketIds).toContain(25);
      expect(allMarketIds).not.toContain(34);
      expect(state.drawDeck[state.drawDeck.length - 1]!.id).toBe(34);

      // 4. Québec custom resource replenishment (4P STEP_2 adds 4 Coal, 4 Oil, 3 Garbage, 2 Uranium)
      const restocked = replenishResourceMarket(
        {
          inventory: { COAL: 0, OIL: 0, GARBAGE: 0, URANIUM: 0 },
          totalSupplyPool: { COAL: 24, OIL: 24, GARBAGE: 24, URANIUM: 12 },
        },
        4,
        'STEP_2',
        'QUEBEC'
      );
      expect(restocked.inventory).toEqual({
        COAL: 4,
        OIL: 4,
        GARBAGE: 3,
        URANIUM: 2,
      });
    });

    it('enforces Baden-Württemberg Transregional cities, Step 2 thresholds (9/6/5), 2-plant Market Stagnation, and Swapped Phase 1 & Phase 2', () => {
      // 1. Step 2 city thresholds: 9 (2P), 6 (3–5P), 5 (6P)
      expect(
        getEffectivePlayerCountConfig(2, 'BADEN_WUERTTEMBERG')
          .step2TriggerCities
      ).toBe(9);
      expect(
        getEffectivePlayerCountConfig(3, 'BADEN_WUERTTEMBERG')
          .step2TriggerCities
      ).toBe(6);
      expect(
        getEffectivePlayerCountConfig(5, 'BADEN_WUERTTEMBERG')
          .step2TriggerCities
      ).toBe(6);
      expect(
        getEffectivePlayerCountConfig(6, 'BADEN_WUERTTEMBERG')
          .step2TriggerCities
      ).toBe(5);

      let state = initGame(['p1', 'p2', 'p3'], 3030, {
        mapId: 'BADEN_WUERTTEMBERG',
        mapRegionKeys: ['NORTH', 'WEST', 'EAST'],
      });

      // Active regions include NORTH -> Transregional city LUDWIGSHAFEN is on the active cityBoard
      expect(state.cityBoard['LUDWIGSHAFEN']).toBeDefined();
      expect(state.cityBoard['BASEL']).toBeUndefined(); // SOUTH_WEST is inactive

      // 2. Transregional Cities: closed in STEP_1, open at $15 in STEP_2, open $15 & $20 in STEP_3
      const step1Trans = calculateCityBuildCost(
        'BADEN_WUERTTEMBERG',
        state.cityBoard,
        'STEP_1',
        'p1',
        ['MANNHEIM'],
        'LUDWIGSHAFEN'
      );
      expect(step1Trans.valid).toBe(false);

      const step2Trans = calculateCityBuildCost(
        'BADEN_WUERTTEMBERG',
        state.cityBoard,
        'STEP_2',
        'p1',
        ['MANNHEIM'],
        'LUDWIGSHAFEN'
      );
      expect(step2Trans.valid).toBe(true);
      expect(step2Trans.slotCost).toBe(15);
      expect(step2Trans.pipeCost).toBe(0);
      expect(step2Trans.totalCost).toBe(15);

      // Once 1 player builds in LUDWIGSHAFEN during STEP_2, 2nd slot ($20) stays closed until STEP_3
      const boardWithOneOccupant = {
        ...state.cityBoard,
        LUDWIGSHAFEN: {
          ...state.cityBoard['LUDWIGSHAFEN']!,
          owners: ['p1'],
        },
      };
      expect(
        calculateCityBuildCost(
          'BADEN_WUERTTEMBERG',
          boardWithOneOccupant,
          'STEP_2',
          'p2',
          ['MANNHEIM'],
          'LUDWIGSHAFEN'
        ).valid
      ).toBe(false);

      const step3TransSecondSlot = calculateCityBuildCost(
        'BADEN_WUERTTEMBERG',
        boardWithOneOccupant,
        'STEP_3',
        'p2',
        ['MANNHEIM'],
        'LUDWIGSHAFEN'
      );
      expect(step3TransSecondSlot.valid).toBe(true);
      expect(step3TransSecondSlot.slotCost).toBe(20);

      // 3. Market Stagnation removes 2 lowest plants + Swapped Phase 1 & Phase 2 recomputes turnOrder after Phase 2!
      state = {
        ...state,
        roundNumber: 2,
        firstRoundOrderRecomputed: true,
        turnOrder: ['p1', 'p2', 'p3'],
        playerOrder: ['p1', 'p2', 'p3'],
        drawDeck: [getPlantById(14), getPlantById(15), ...state.drawDeck],
        players: {
          ...state.players,
          // Give p3 the most cities so turn order will flip to ['p3', 'p2', 'p1'] AFTER Phase 2!
          p1: {
            ...state.players['p1']!,
            cities: ['MANNHEIM'],
            powerPlants: [
              {
                card: getPlantById(3),
                storedResources: createEmptyResourceStorage(),
              },
            ],
          },
          p2: {
            ...state.players['p2']!,
            cities: ['KARLSRUHE', 'RASTATT'],
            powerPlants: [
              {
                card: getPlantById(4),
                storedResources: createEmptyResourceStorage(),
              },
            ],
          },
          p3: {
            ...state.players['p3']!,
            cities: ['STUTTGART', 'LUDWIGSBURG', 'BOBLINGEN'],
            powerPlants: [
              {
                card: getPlantById(5),
                storedResources: createEmptyResourceStorage(),
              },
            ],
          },
        },
      };

      // All 3 players pass Phase 2 Auction in Round 2
      state = applyAction(state, 'p1', { type: 'PG_PASS_AUCTION_PHASE' });
      state = applyAction(state, 'p2', { type: 'PG_PASS_AUCTION_PHASE' });
      state = applyAction(state, 'p3', { type: 'PG_PASS_AUCTION_PHASE' });

      // Both #03 AND #04 (2 lowest plants) were discarded; #14 and #15 drawn -> Actual Market is [5, 6, 7, 8]!
      expect(state.actualMarket.map((c) => c.id)).toEqual([5, 6, 7, 8]);
      // And Swapped Phase 1 ran immediately after Phase 2: turnOrder is now ['p3', 'p2', 'p1']!
      expect(state.turnOrder).toEqual(['p3', 'p2', 'p1']);
      expect(state.phase).toBe(PowerGridPhase.PHASE_3_BUY_RESOURCES);

      // Verify end of Phase 5 does NOT prematurely recompute turnOrder before next round's Phase 2 Auction
      let phase5State: PowerGridGameState = {
        ...state,
        phase: PowerGridPhase.PHASE_5_BUREAUCRACY,
        turnOrder: ['p1', 'p2', 'p3'], // Suppose p1 was 1st entering Bureaucracy even though p3 now has more cities
        playerOrder: ['p1', 'p2', 'p3'],
        activePlayerIndex: 0,
        drawDeck: [getPlantById(20), STEP_3_CARD],
      };
      for (const pid of ['p1', 'p2', 'p3']) {
        phase5State = applyAction(phase5State, pid, {
          type: 'PG_POWER_CITIES',
          allocations: [],
        });
      }
      expect(phase5State.roundNumber).toBe(3);
      expect(phase5State.phase).toBe(PowerGridPhase.PHASE_2_AUCTION_POWER_PLANTS);
      expect(phase5State.turnOrder).toEqual(['p1', 'p2', 'p3']);
    });
  });
});

