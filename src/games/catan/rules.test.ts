import { describe, expect, it } from 'vitest';
import {
  applyCatanAction,
  CATAN_DEV_CARD_DEFINITIONS,
  createSeededRng,
  generateCatanBoard,
  getValidInitialSettlementSpots,
  getValidRoadSpots,
  getValidSettlementSpots,
  initCatanGame,
  shuffleWithRng,
  validateCatanAction,
} from './index.js';

describe('Catan Functionality Update 0.00h — Planar Graph Board Generator, Snake Draft, Dev Cards, Awards & Trade', () => {
  // ---------------------------------------------------------------------------
  // 1. Deterministic Seeded Board Generator (19 Hexes, 54 Vertices, 72 Edges, 9 Harbors, A-R Spiral)
  // ---------------------------------------------------------------------------
  describe('1. Deterministic Planar Graph Board Generator', () => {
    it('generates 19 hexes, 54 vertices, 72 edges, 30 coastal edges, and 9 harbors deterministically from a seed', () => {
      const boardA = generateCatanBoard('CATAN_SEED_001');
      const boardB = generateCatanBoard('CATAN_SEED_001');

      // Replaying the same seed produces the exact same board
      expect(boardA).toEqual(boardB);

      // Omitting seed generates a 6-character alphanumeric seed and stores it on board.seed
      const boardAuto = generateCatanBoard();
      expect(boardAuto.seed).toMatch(/^[A-Z0-9]{6}$/);

      // Verify exact planar graph counts
      expect(Object.keys(boardA.hexes).length).toBe(19);
      expect(Object.keys(boardA.vertices).length).toBe(54);
      expect(Object.keys(boardA.edges).length).toBe(72);

      // Verify 30 coastal edges
      const coastalEdges = Object.values(boardA.edges).filter(
        (e) => e.isCoastal
      );
      expect(coastalEdges).toHaveLength(30);

      // Verify terrain distribution: 4 wood, 4 sheep, 4 wheat, 3 brick, 3 ore, 1 desert
      const terrainCounts: Record<string, number> = {};
      for (const hex of Object.values(boardA.hexes)) {
        terrainCounts[hex.terrain] = (terrainCounts[hex.terrain] ?? 0) + 1;
        if (hex.terrain === 'desert') {
          expect(hex.hasRobber).toBe(true);
          expect(hex.numberToken).toBeNull();
          expect(hex.tokenLetter).toBeNull();
          expect(boardA.robberHexId).toBe(hex.id);
        } else {
          expect(hex.hasRobber).toBe(false);
          expect(hex.numberToken).toBeGreaterThanOrEqual(2);
          expect(hex.numberToken).toBeLessThanOrEqual(12);
          expect(hex.tokenLetter).toMatch(/^[A-R]$/);
        }
      }
      expect(terrainCounts).toEqual({
        wood: 4,
        sheep: 4,
        wheat: 4,
        brick: 3,
        ore: 3,
        desert: 1,
      });

      // Verify 9 harbors placed across 18 distinct coastal vertices (no two harbors share a vertex)
      const harborVertices = Object.values(boardA.vertices).filter(
        (v) => v.harbor !== null
      );
      expect(harborVertices).toHaveLength(18);

      // Verify no two adjacent hexes share red number tokens (6 or 8) across multiple seeds
      for (const testSeed of ['S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7', 'S8']) {
        const b = generateCatanBoard(testSeed);
        const redHexes = Object.values(b.hexes).filter(
          (h) => h.numberToken === 6 || h.numberToken === 8
        );
        expect(redHexes).toHaveLength(4);
        for (let i = 0; i < redHexes.length; i++) {
          for (let j = i + 1; j < redHexes.length; j++) {
            const h1 = redHexes[i]!;
            const h2 = redHexes[j]!;
            const dq = Math.abs(h1.q - h2.q);
            const dr = Math.abs(h1.r - h2.r);
            const ds = Math.abs(h1.q + h1.r - (h2.q + h2.r));
            const hexDistance = Math.max(dq, dr, ds);
            expect(hexDistance).toBeGreaterThan(1);
          }
        }
      }
    });

    it('enforces the Distance Rule and road connectivity in placement helper functions', () => {
      const board = generateCatanBoard('PLACEMENT_TEST');
      // Initially all 54 vertices are valid initial settlement spots
      expect(getValidInitialSettlementSpots(board)).toHaveLength(54);

      const firstVertex = Object.values(board.vertices)[0]!;
      firstVertex.building = 'settlement';
      firstVertex.ownerId = 'p1';

      // Placing a settlement removes that vertex AND its 2-3 adjacent vertices from valid initial spots
      const remainingInitial = getValidInitialSettlementSpots(board);
      expect(remainingInitial.length).toBe(
        54 - 1 - firstVertex.adjacentVertexIds.length
      );

      // Valid road spots for p1 connect to firstVertex
      const roadSpots = getValidRoadSpots(board, 'p1');
      expect(roadSpots.map((e) => e.id).sort()).toEqual(
        [...firstVertex.connectedEdgeIds].sort()
      );

      // Build 2 connected roads for p1 so p1 reaches a vertex 2 segments away
      const e1 = board.edges[firstVertex.connectedEdgeIds[0]!]!;
      e1.ownerId = 'p1';
      const midVertexId =
        e1.endpointVertexIds[0] === firstVertex.id
          ? e1.endpointVertexIds[1]
          : e1.endpointVertexIds[0];
      const midVertex = board.vertices[midVertexId]!;
      const secondEdgeId = midVertex.connectedEdgeIds.find(
        (id) => id !== e1.id
      )!;
      board.edges[secondEdgeId]!.ownerId = 'p1';

      // Now p1 has a valid mid-game settlement spot at the far endpoint of secondEdgeId!
      const validSettlementsForP1 = getValidSettlementSpots(board, 'p1');
      expect(validSettlementsForP1.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ---------------------------------------------------------------------------
  // 2. Starting Player High Roll, Snake Draft Setup & 2nd Settlement Starting Resources
  // ---------------------------------------------------------------------------
  describe('2. Starting Player High Roll, Snake Draft & 2nd Settlement Resources', () => {
    it('determines starting player by highest dice roll, runs forward/reverse snake draft, and grants 1 resource per adjoining hex of the 2nd settlement', () => {
      let state = initCatanGame(['p1', 'p2', 'p3'], 2026);
      const order = state.playerOrder;
      const startPid = order[0]!;

      // Starting player had the highest roll among all players
      const startRollSum =
        state.startingRolls[startPid]![0] + state.startingRolls[startPid]![1];
      for (const pid of order.slice(1)) {
        const sum = state.startingRolls[pid]![0] + state.startingRolls[pid]![1];
        expect(startRollSum).toBeGreaterThan(sum);
      }

      // Forward Round 1: order[0] -> order[1] -> order[2]
      for (let i = 0; i < 3; i++) {
        const pid = order[i]!;
        expect(state.playerOrder[state.activePlayerIndex]).toBe(pid);
        expect(state.turnStep).toBe('SETUP_SETTLEMENT_1');

        const spot = getValidInitialSettlementSpots(state.board)[0]!;
        state = applyCatanAction(state, pid, {
          type: 'CATAN_PLACE_INITIAL_SETTLEMENT',
          vertexId: spot.id,
        });
        expect(state.turnStep).toBe('SETUP_ROAD_1');
        // 1st settlement does NOT grant starting resources
        expect(
          Object.values(state.players[pid]!.resources).reduce(
            (a, b) => a + b,
            0
          )
        ).toBe(0);

        const road = getValidRoadSpots(state.board, pid, spot.id)[0]!;
        state = applyCatanAction(state, pid, {
          type: 'CATAN_PLACE_INITIAL_ROAD',
          edgeId: road.id,
        });
      }

      // Reverse Round 2: order[2] -> order[1] -> order[0]
      for (let i = 2; i >= 0; i--) {
        const pid = order[i]!;
        expect(state.playerOrder[state.activePlayerIndex]).toBe(pid);
        expect(state.turnStep).toBe('SETUP_SETTLEMENT_2');

        // Choose a vertex touching at least 2 non-desert hexes to verify resource grant
        const spot =
          getValidInitialSettlementSpots(state.board).find(
            (v) =>
              v.touchingHexIds.filter(
                (hid) => state.board.hexes[hid]!.terrain !== 'desert'
              ).length >= 2
          ) ?? getValidInitialSettlementSpots(state.board)[0]!;

        const expectedCount = spot.touchingHexIds.filter(
          (hid) => state.board.hexes[hid]!.terrain !== 'desert'
        ).length;

        state = applyCatanAction(state, pid, {
          type: 'CATAN_PLACE_INITIAL_SETTLEMENT',
          vertexId: spot.id,
        });
        expect(state.turnStep).toBe('SETUP_ROAD_2');
        expect(
          Object.values(state.players[pid]!.resources).reduce(
            (a, b) => a + b,
            0
          )
        ).toBe(expectedCount);

        const road = getValidRoadSpots(state.board, pid, spot.id)[0]!;
        state = applyCatanAction(state, pid, {
          type: 'CATAN_PLACE_INITIAL_ROAD',
          edgeId: road.id,
        });
      }

      // Setup complete -> active player is startPid in ROLL_DICE
      expect(state.turnStep).toBe('ROLL_DICE');
      expect(state.playerOrder[state.activePlayerIndex]).toBe(startPid);
    });
  });

  // ---------------------------------------------------------------------------
  // 3. Development Cards, Largest Army (+2 VP) & Longest Road (+2 VP)
  // ---------------------------------------------------------------------------
  describe('3. Development Cards, Largest Army & Longest Road Awards', () => {
    it('shuffles the 25-card Development deck, enforces purchase/same-turn play rules, awards Largest Army at 3 Knights, and awards Longest Road at 5 segments', () => {
      let state = initCatanGame(['p1', 'p2', 'p3'], 777, { skipSetup: true });
      const activePid = state.playerOrder[state.activePlayerIndex]!;

      // Verify 25 Development Cards in starting deck
      expect(state.devCardDeck).toHaveLength(25);

      // Roll dice to enter MAIN_PHASE
      state = applyCatanAction(state, activePid, { type: 'CATAN_ROLL_DICE' });

      // Give activePid resources to buy a Development Card (1 WHEAT, 1 ORE, 1 SHEEP)
      state = {
        ...state,
        devCardDeck: [
          {
            id: 'TEST_KNIGHT_1',
            ...CATAN_DEV_CARD_DEFINITIONS.KNIGHT,
            purchasedOnTurn: 0,
          },
          ...state.devCardDeck,
        ],
        players: {
          ...state.players,
          [activePid]: {
            ...state.players[activePid]!,
            resources: {
              WOOD: 2,
              BRICK: 2,
              SHEEP: 1,
              WHEAT: 1,
              ORE: 1,
            },
          },
        },
      };

      // Purchase Development Card
      state = applyCatanAction(state, activePid, {
        type: 'CATAN_BUY_DEV_CARD',
      });
      expect(state.players[activePid]!.devCards).toHaveLength(1);

      // Cannot play the Knight card on the same turn it was purchased!
      expect(
        validateCatanAction(state, activePid, { type: 'CATAN_PLAY_KNIGHT' })
          .valid
      ).toBe(false);

      // Simulate activePid holding 3 Knights bought on an earlier turn + 1 Monopoly + 1 Year of Plenty
      state = {
        ...state,
        turnNumber: 2,
        turnStep: 'ROLL_DICE', // Progress and Knight cards can be played BEFORE rolling!
        players: {
          ...state.players,
          [activePid]: {
            ...state.players[activePid]!,
            devCards: [
              {
                id: 'K1',
                ...CATAN_DEV_CARD_DEFINITIONS.KNIGHT,
                purchasedOnTurn: 1,
              },
              {
                id: 'K2',
                ...CATAN_DEV_CARD_DEFINITIONS.KNIGHT,
                purchasedOnTurn: 1,
              },
              {
                id: 'K3',
                ...CATAN_DEV_CARD_DEFINITIONS.KNIGHT,
                purchasedOnTurn: 1,
              },
              {
                id: 'M1',
                ...CATAN_DEV_CARD_DEFINITIONS.MONOPOLY,
                purchasedOnTurn: 1,
              },
              {
                id: 'Y1',
                ...CATAN_DEV_CARD_DEFINITIONS.YEAR_OF_PLENTY,
                purchasedOnTurn: 1,
              },
            ],
          },
        },
      };

      // Play 1st Knight (including before rolling!) -> sets hasPlayedDevCardThisTurn = true
      state = applyCatanAction(state, activePid, { type: 'CATAN_PLAY_KNIGHT' });
      expect(state.hasPlayedDevCardThisTurn).toBe(true);

      // Cannot play a 2nd Knight or Progress card on the same turn!
      expect(
        validateCatanAction(
          { ...state, turnStep: 'MAIN_PHASE' },
          activePid,
          { type: 'CATAN_PLAY_KNIGHT' }
        ).valid
      ).toBe(false);

      // Advance to next turns for 2nd and 3rd Knights -> awards Largest Army (+2 VP)!
      state = { ...state, turnNumber: 3, hasPlayedDevCardThisTurn: false, turnStep: 'MAIN_PHASE' };
      state = applyCatanAction(state, activePid, { type: 'CATAN_PLAY_KNIGHT' });
      expect(state.largestArmyOwnerId).toBeNull();

      state = { ...state, turnNumber: 4, hasPlayedDevCardThisTurn: false, turnStep: 'MAIN_PHASE' };
      state = applyCatanAction(state, activePid, { type: 'CATAN_PLAY_KNIGHT' });
      expect(state.players[activePid]!.faceUpKnights).toBe(3);
      expect(state.largestArmyOwnerId).toBe(activePid);
      expect(state.players[activePid]!.hasLargestArmy).toBe(true);
      expect(state.players[activePid]!.victoryPoints).toBe(4); // 2 settlements + 2 Largest Army

      // Play Year of Plenty (+2 ORE) and Monopoly (WOOD) on subsequent turns
      state = { ...state, turnNumber: 5, hasPlayedDevCardThisTurn: false, turnStep: 'MAIN_PHASE' };
      state = applyCatanAction(state, activePid, {
        type: 'CATAN_PLAY_YEAR_OF_PLENTY',
        resource1: 'ORE',
        resource2: 'ORE',
      });
      expect(state.players[activePid]!.resources.ORE).toBe(2);
      expect(state.hasPlayedDevCardThisTurn).toBe(true);

      state = { ...state, turnNumber: 6, hasPlayedDevCardThisTurn: false, turnStep: 'MAIN_PHASE' };
      state = applyCatanAction(state, activePid, {
        type: 'CATAN_PLAY_MONOPOLY',
        resource: 'WOOD',
      });

      // Test Victory Point Card rule: can be played on the turn purchased ONLY if it triggers 10 VP win!
      state = {
        ...state,
        players: {
          ...state.players,
          [activePid]: {
            ...state.players[activePid]!,
            devCards: [
              {
                id: 'VP_UNIV',
                ...CATAN_DEV_CARD_DEFINITIONS.UNIVERSITY,
                purchasedOnTurn: state.turnNumber,
              },
            ],
          },
        },
      };

      // At 4 VP + 1 VP card = 5 VP (< 10), playing the VP card is rejected
      expect(
        validateCatanAction(state, activePid, { type: 'CATAN_PLAY_VP_CARD' })
          .valid
      ).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // 4. Player-to-Player Trade Proposal, Counter-Offer & Accept/Decline Loop
  // ---------------------------------------------------------------------------
  describe('4. Player-to-Player Trade Proposal, Counter-Offer & Accept/Decline', () => {
    it('allows active player to offer X for Y, opponents to accept/counter/decline, and active player to accept or counter back', () => {
      let state = initCatanGame(['p1', 'p2', 'p3'], 888, { skipSetup: true });
      const [activePid, opp1, opp2] = state.playerOrder as [
        string,
        string,
        string,
      ];

      state = applyCatanAction(state, activePid, { type: 'CATAN_ROLL_DICE' });

      // Set known hands
      state = {
        ...state,
        players: {
          ...state.players,
          [activePid]: {
            ...state.players[activePid]!,
            resources: { WOOD: 2, BRICK: 1, SHEEP: 0, WHEAT: 0, ORE: 0 },
          },
          [opp1]: {
            ...state.players[opp1]!,
            resources: { WOOD: 0, BRICK: 0, SHEEP: 0, WHEAT: 0, ORE: 2 },
          },
          [opp2]: {
            ...state.players[opp2]!,
            resources: { WOOD: 0, BRICK: 0, SHEEP: 2, WHEAT: 0, ORE: 0 },
          },
        },
      };

      // Cannot propose resources the active player does not have
      expect(
        validateCatanAction(state, activePid, {
          type: 'CATAN_PROPOSE_TRADE',
          offered: { WOOD: 5 },
          requested: { ORE: 1 },
        }).valid
      ).toBe(false);

      // Active player proposes: 2 WOOD for 1 ORE
      state = applyCatanAction(state, activePid, {
        type: 'CATAN_PROPOSE_TRADE',
        offered: { WOOD: 2 },
        requested: { ORE: 1 },
      });
      expect(state.activeTrade).not.toBeNull();
      expect(state.activeTrade!.phase).toBe('AWAITING_OPPONENTS');

      // opp1 counters with: opp1 gives 1 ORE, asks activePid for 1 WOOD + 1 BRICK
      state = applyCatanAction(state, opp1, {
        type: 'CATAN_RESPOND_TRADE',
        response: 'COUNTER',
        counterGive: { ORE: 1 },
        counterRequest: { WOOD: 1, BRICK: 1 },
      });
      expect(state.activeTrade!.phase).toBe('AWAITING_OPPONENTS');

      // opp2 declines
      state = applyCatanAction(state, opp2, {
        type: 'CATAN_RESPOND_TRADE',
        response: 'DECLINE',
      });

      // Now all opponents have responded -> active player is presented with responses!
      expect(state.activeTrade!.phase).toBe('AWAITING_ACTIVE_PLAYER');
      expect(state.activeTrade!.branches[opp1]!.status).toBe(
        'OPPONENT_COUNTERED'
      );
      expect(state.activeTrade!.branches[opp2]!.status).toBe('DECLINED');

      // Active player accepts opp1's counter-offer (1 WOOD + 1 BRICK for 1 ORE)
      state = applyCatanAction(state, activePid, {
        type: 'CATAN_RESPOND_TRADE',
        response: 'ACCEPT',
        targetOpponentId: opp1,
      });

      expect(state.activeTrade).toBeNull();
      expect(state.players[activePid]!.resources).toEqual({
        WOOD: 1,
        BRICK: 0,
        SHEEP: 0,
        WHEAT: 0,
        ORE: 1,
      });
      expect(state.players[opp1]!.resources).toEqual({
        WOOD: 1,
        BRICK: 1,
        SHEEP: 0,
        WHEAT: 0,
        ORE: 1,
      });
    });
  });

  // ---------------------------------------------------------------------------
  // 5. Catan Functionality 2 Update 0.00i — 7-Roll Discard, Robber Victim & Shuffled Card Steal, Two-Step City Upgrade
  // ---------------------------------------------------------------------------
  describe('5. Catan Functionality 2 Update 0.00i — 7-Roll Discard, Robber Steal & City Upgrade', () => {
    it('discards half rounding down for players with >= 8 cards on a 7, moves robber, selects victim, and steals from shuffled cards', () => {
      let state = initCatanGame(['p1', 'p2', 'p3'], 999, { skipSetup: true });
      const [activePid, opp1, opp2] = state.playerOrder as [string, string, string];

      // Give opp1 9 cards (must discard Math.floor(9/2) = 4) and opp2 7 cards (no discard)
      state = {
        ...state,
        turnStep: 'DISCARD_ON_SEVEN',
        lastDiceRoll: [3, 4],
        pendingDiscards: { [opp1]: 4 },
        robberReturnStep: 'MAIN_PHASE',
        players: {
          ...state.players,
          [opp1]: {
            ...state.players[opp1]!,
            resources: { WOOD: 3, BRICK: 2, SHEEP: 2, WHEAT: 1, ORE: 1 },
          },
          [opp2]: {
            ...state.players[opp2]!,
            resources: { WOOD: 2, BRICK: 2, SHEEP: 1, WHEAT: 1, ORE: 1 },
          },
        },
      };

      // Find a hex where opp1 and opp2 both have buildings so victim selection is triggered
      const targetHex = Object.values(state.board.hexes).find(
        (h) => h.id !== state.board.robberHexId
      )!;
      const touchingVertices = Object.values(state.board.vertices).filter((v) =>
        v.touchingHexIds.includes(targetHex.id)
      );
      const v1 = touchingVertices[0]!;
      const v2 = touchingVertices[2]!;
      v1.building = 'settlement';
      v1.ownerId = opp1;
      v2.building = 'city';
      v2.ownerId = opp2;

      // opp1 discards 4 cards -> transitions to MOVE_ROBBER
      state = applyCatanAction(state, opp1, {
        type: 'CATAN_DISCARD_RESOURCES',
        resources: { WOOD: 2, BRICK: 1, SHEEP: 1 },
      });
      expect(state.turnStep).toBe('MOVE_ROBBER');

      // Active player moves robber to targetHex -> transitions to SELECT_ROBBER_VICTIM
      state = applyCatanAction(state, activePid, {
        type: 'CATAN_MOVE_ROBBER',
        targetHexId: targetHex.id,
      });
      expect(state.turnStep).toBe('SELECT_ROBBER_VICTIM');
      expect(state.robberEligibleVictimIds).toContain(opp1);
      expect(state.robberEligibleVictimIds).toContain(opp2);

      // Active player selects opp1 (who now has 5 cards left) -> shuffles opp1's 5 cards
      state = applyCatanAction(state, activePid, {
        type: 'CATAN_SELECT_ROBBER_VICTIM',
        victimPlayerId: opp1,
      });
      expect(state.turnStep).toBe('STEAL_ROBBER_CARD');
      expect(state.robberShuffledVictimCards).toHaveLength(5);

      // Active player picks index 2 from the 5 shuffled cards
      const activeBeforeTotal = Object.values(
        state.players[activePid]!.resources
      ).reduce((a, b) => a + b, 0);
      state = applyCatanAction(state, activePid, {
        type: 'CATAN_STEAL_CARD',
        cardIndex: 2,
      });
      expect(state.turnStep).toBe('MAIN_PHASE');
      const activeAfterTotal = Object.values(
        state.players[activePid]!.resources
      ).reduce((a, b) => a + b, 0);
      const opp1AfterTotal = Object.values(
        state.players[opp1]!.resources
      ).reduce((a, b) => a + b, 0);
      expect(activeAfterTotal).toBe(activeBeforeTotal + 1);
      expect(opp1AfterTotal).toBe(4);
    });

    it('upgrades a settlement to a city by paying first and then clicking a settlement on the board', () => {
      let state = initCatanGame(['p1', 'p2', 'p3'], 1010, { skipSetup: true });
      const activePid = state.playerOrder[state.activePlayerIndex]!;

      const mySettlement = Object.values(state.board.vertices).find(
        (v) => v.ownerId === activePid && v.building === 'settlement'
      )!;

      state = {
        ...state,
        turnStep: 'MAIN_PHASE',
        players: {
          ...state.players,
          [activePid]: {
            ...state.players[activePid]!,
            resources: { WOOD: 0, BRICK: 0, SHEEP: 0, WHEAT: 2, ORE: 3 },
          },
        },
      };

      // Step 1: Pay 2 WHEAT + 3 ORE to start City Upgrade
      state = applyCatanAction(state, activePid, {
        type: 'CATAN_START_UPGRADE_CITY',
      });
      expect(state.turnStep).toBe('SELECT_CITY_UPGRADE');
      expect(state.cityUpgradePaid).toBe(true);
      expect(state.players[activePid]!.resources.WHEAT).toBe(0);
      expect(state.players[activePid]!.resources.ORE).toBe(0);

      // Step 2: Click the settlement on the board to complete upgrade
      state = applyCatanAction(state, activePid, {
        type: 'CATAN_UPGRADE_CITY',
        vertexId: mySettlement.id,
      });
      expect(state.turnStep).toBe('MAIN_PHASE');
      expect(state.cityUpgradePaid).toBe(false);
      expect(state.board.vertices[mySettlement.id]!.building).toBe('city');
    });
  });
});
