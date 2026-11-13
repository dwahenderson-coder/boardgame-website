import { describe, expect, it } from 'vitest';
import { Graph } from '../src/common/graph.js';
import {
  CardZone,
  createStandardDeck,
  evaluateBestPokerHand,
  evaluateTrickWinner,
  isLegalTrickPlay,
  StandardCard,
} from '../src/common/cards/index.js';
import { createPRNG } from '../src/common/prng.js';
import { Deck } from '../src/mechanics/deck.js';
import { RoomManager } from '../src/server/rooms.js';
import {
  BOARD_GAMES_CATALOG,
  CARD_GAMES_CATALOG,
  GAME_CATALOG_BY_ID,
} from '../src/registry/catalog.js';
import {
  getEffectivePlayerBounds,
  isExpansionCompatibleWithMap,
} from '../src/types/game.js';
import {
  BOARD_GAME_METADATA_LIST,
  CARD_GAME_METADATA_LIST,
  GameId,
  GameRegistry,
} from '../src/games/registry.js';
import { HoldemGameState } from '../src/games/texas-holdem/index.js';
import {
  EuchreGameState,
  evaluateEuchreTrickWinner,
  getEuchreEffectiveSuit,
} from '../src/games/euchre/index.js';
import {
  CribbageGameState,
  evaluateCribbageHand,
} from '../src/games/cribbage/index.js';
import {
  getKingsCornersCardPoints,
  KingsCornersGameState,
} from '../src/games/kings-corners/index.js';
import {
  applyCompanyPriceShift,
  createMarketDeck80,
  STOCKPILE_COMPANY_IDS,
  StockpileGameState,
} from '../src/games/stockpile/index.js';
import {
  applyAction,
  calculateFinalScores,
  calculateLongestContinuousPath,
  createEmptyHand,
  getPlayerPerspective,
  initGame,
  STANDARD_BOARD_ROUTES,
  STANDARD_DESTINATION_TICKETS,
  validateAction,
} from '../src/games/ticket-to-ride/index.js';
import { CITY_COORDINATES } from '../src/sandbox/mapData.js';
import type {
  DestinationTicket,
  GameState,
  RouteEdge,
} from '../src/games/ticket-to-ride/types.js';
import type { CatanGameState } from '../src/games/catan/index.js';

describe('Milestone 1: Core Game Engine & Shared Utilities', () => {
  // ---------------------------------------------------------------------------
  // 1. Deck<T> Deterministic Re-playability & Lifecycle
  // ---------------------------------------------------------------------------
  describe('Deck<T> - Deterministic Seedable Shuffle & Operations', () => {
    const sampleCards = Array.from({ length: 30 }, (_, i) => `CARD_${i + 1}`);

    it('produces identical shuffle and draw sequences given the same PRNG seed', () => {
      const seed = 0xdeadbeef;
      const deckA = new Deck(sampleCards, seed);
      const deckB = new Deck(sampleCards, seed);

      expect(deckA.drawPile).toEqual(deckB.drawPile);

      const firstBatchA = deckA.draw(7);
      const firstBatchB = deckB.draw(7);
      expect(firstBatchA).toEqual(firstBatchB);
      expect(deckA.drawCount).toBe(23);

      // Discard and reshuffle deterministically
      deckA.discard(firstBatchA);
      deckB.discard(firstBatchB);
      expect(deckA.discardCount).toBe(7);

      deckA.reshuffleDiscardIntoDeck();
      deckB.reshuffleDiscardIntoDeck();

      expect(deckA.discardCount).toBe(0);
      expect(deckA.drawCount).toBe(30);
      expect(deckA.draw(30)).toEqual(deckB.draw(30));
    });

    it('produces distinct sequences given different seeds', () => {
      const deckA = new Deck(sampleCards, 1001);
      const deckB = new Deck(sampleCards, 2002);

      expect(deckA.drawPile).not.toEqual(deckB.drawPile);
    });

    it('automatically reshuffles the discard pile when draw(n) exceeds remaining drawPile', () => {
      const deck = new Deck(['A', 'B', 'C', 'D'], 42);
      const drawn3 = deck.draw(3);
      expect(deck.drawCount).toBe(1);

      deck.discard(drawn3);
      expect(deck.discardCount).toBe(3);

      // Requesting 3 cards when only 1 is in drawPile triggers automatic reshuffle of discardPile
      const next3 = deck.draw(3);
      expect(next3).toHaveLength(3);
      expect(deck.drawCount).toBe(1);
      expect(deck.discardCount).toBe(0);
    });
  });

  // ---------------------------------------------------------------------------
  // 2. Graph Pathfinding & Route Connectivity
  // ---------------------------------------------------------------------------
  describe('Graph - BFS Connectivity & Dijkstra Shortest Path', () => {
    it('accurately evaluates multi-hop connectivity and disjoint subgraphs via BFS', () => {
      const graph = new Graph();
      // West-to-East chain: Vancouver -> Seattle -> Helena -> Denver -> Kansas City -> Saint Louis -> Pittsburgh -> New York
      graph.addEdge('Vancouver', 'Seattle', 1);
      graph.addEdge('Seattle', 'Helena', 6);
      graph.addEdge('Helena', 'Denver', 4);
      graph.addEdge('Denver', 'Kansas City', 4);
      graph.addEdge('Kansas City', 'Saint Louis', 2);
      graph.addEdge('Saint Louis', 'Pittsburgh', 5);
      graph.addEdge('Pittsburgh', 'New York', 2);

      // Isolated southern segment: Miami <-> Atlanta
      graph.addEdge('Miami', 'Atlanta', 5);

      expect(graph.isConnected('Vancouver', 'New York')).toBe(true);
      expect(graph.isConnected('New York', 'Vancouver')).toBe(true);
      expect(graph.isConnected('Seattle', 'Kansas City')).toBe(true);
      expect(graph.isConnected('Vancouver', 'Miami')).toBe(false);
      expect(graph.isConnected('UnknownCity', 'New York')).toBe(false);
    });

    it('computes minimum weight path via Dijkstra shortestPath()', () => {
      const graph = new Graph();
      // Direct expensive route vs multi-hop cheaper route
      graph.addEdge('Seattle', 'Helena', 6);
      graph.addEdge('Seattle', 'Portland', 1);
      graph.addEdge('Portland', 'Salt Lake City', 2);
      graph.addEdge('Salt Lake City', 'Helena', 2);

      const shortest = graph.shortestPath('Seattle', 'Helena');
      expect(shortest).not.toBeNull();
      expect(shortest!.distance).toBe(5);
      expect(shortest!.path).toEqual([
        'Seattle',
        'Portland',
        'Salt Lake City',
        'Helena',
      ]);
    });
  });

  // ---------------------------------------------------------------------------
  // 3. Ticket to Ride 2-Player Turn Sequence, Validation, Perspective & Scoring
  // ---------------------------------------------------------------------------
  describe('Ticket to Ride Authoritative Rules Engine', () => {
    const customRoutes: RouteEdge[] = [
      {
        id: 'R_VAN_SEA_1',
        from: 'Vancouver',
        to: 'Seattle',
        length: 1,
        color: 'GRAY',
        ownerId: null,
        routeIndex: 0,
      },
      {
        id: 'R_VAN_SEA_2',
        from: 'Vancouver',
        to: 'Seattle',
        length: 1,
        color: 'GRAY',
        ownerId: null,
        routeIndex: 1,
      },
      {
        id: 'R_SEA_HEL',
        from: 'Seattle',
        to: 'Helena',
        length: 6,
        color: 'YELLOW',
        ownerId: null,
        routeIndex: 0,
      },
      {
        id: 'R_HEL_DEN',
        from: 'Helena',
        to: 'Denver',
        length: 4,
        color: 'GREEN',
        ownerId: null,
        routeIndex: 0,
      },
    ];

    const customTickets: DestinationTicket[] = [
      { id: 'TKT_VAN_DEN', from: 'Vancouver', to: 'Denver', points: 11 },
      { id: 'TKT_VAN_SEA', from: 'Vancouver', to: 'Seattle', points: 3 },
      { id: 'TKT_SEA_HEL', from: 'Seattle', to: 'Helena', points: 6 },
      { id: 'TKT_HEL_DEN', from: 'Helena', to: 'Denver', points: 5 },
      { id: 'TKT_VAN_HEL', from: 'Vancouver', to: 'Helena', points: 8 },
      { id: 'TKT_SEA_DEN', from: 'Seattle', to: 'Denver', points: 9 },
    ];

    it('enforces turn order, validates route claims, updates board ownership & hands, sanitizes perspective, and scores destination tickets', () => {
      let state = initGame(['alice', 'bob'], 20261031, {
        customRoutes,
        customTickets,
        skipInitialTicketSelection: true,
      });

      // Set up deterministic known hands and tickets for clear assertion of mechanics
      state = {
        ...state,
        players: {
          ...state.players,
          alice: {
            ...state.players['alice']!,
            hand: {
              ...createEmptyHand(),
              RED: 1,
              YELLOW: 5,
              LOCOMOTIVE: 1,
            },
            tickets: [
              { id: 'TKT_VAN_DEN', from: 'Vancouver', to: 'Denver', points: 11 },
              { id: 'TKT_VAN_SEA', from: 'Vancouver', to: 'Seattle', points: 3 },
            ],
          },
          bob: {
            ...state.players['bob']!,
            hand: {
              ...createEmptyHand(),
              GREEN: 2, // Needs 4 GREEN for Helena -> Denver
              BLUE: 2,
            },
            tickets: [
              { id: 'TKT_HEL_DEN', from: 'Helena', to: 'Denver', points: 5 },
            ],
          },
        },
      };

      // 1. Reject action out of turn (Bob attempting to act on Alice's turn)
      const outOfTurnCheck = validateAction(state, 'bob', {
        type: 'DRAW_CARDS',
        source: 'DECK',
      });
      expect(outOfTurnCheck.valid).toBe(false);
      expect(outOfTurnCheck.reason).toContain('Out of turn');
      expect(() =>
        applyAction(state, 'bob', { type: 'DRAW_CARDS', source: 'DECK' })
      ).toThrow(/Out of turn/);

      // 2. Reject claiming a route with wrong card color (Alice paying RED for YELLOW route)
      const wrongColorCheck = validateAction(state, 'alice', {
        type: 'CLAIM_ROUTE',
        routeId: 'R_SEA_HEL',
        payment: { RED: 1, YELLOW: 5 },
      });
      expect(wrongColorCheck.valid).toBe(false);

      // 3. Valid Turn 1 (Alice): Claim Vancouver -> Seattle (length 1, GRAY) using 1 RED card
      state = applyAction(state, 'alice', {
        type: 'CLAIM_ROUTE',
        routeId: 'R_VAN_SEA_1',
        payment: { RED: 1 },
      });

      const vanSeaRoute = state.routes.find((r) => r.id === 'R_VAN_SEA_1')!;
      expect(vanSeaRoute.ownerId).toBe('alice');
      expect(state.players['alice']!.hand.RED).toBe(0);
      expect(state.players['alice']!.trainsRemaining).toBe(44);
      expect(state.players['alice']!.claimedRoutePoints).toBe(1);
      expect(state.playerOrder[state.activePlayerIndex]).toBe('bob');

      // 4. Turn 2 (Bob):
      // 4a. Reject Bob claiming parallel sibling route R_VAN_SEA_2 in a 2-player game
      const doubleRouteCheck = validateAction(state, 'bob', {
        type: 'CLAIM_ROUTE',
        routeId: 'R_VAN_SEA_2',
        payment: { BLUE: 1 },
      });
      expect(doubleRouteCheck.valid).toBe(false);
      expect(doubleRouteCheck.reason).toContain('2-3 player games');

      // 4b. Reject Bob claiming Helena -> Denver (length 4 GREEN) with insufficient cards (only has 2 GREEN)
      const insufficientCardsCheck = validateAction(state, 'bob', {
        type: 'CLAIM_ROUTE',
        routeId: 'R_HEL_DEN',
        payment: { GREEN: 4 },
      });
      expect(insufficientCardsCheck.valid).toBe(false);
      expect(insufficientCardsCheck.reason).toContain('Insufficient GREEN cards');

      // 4c. Valid Turn 2 (Bob): Draw 2 cards from the deck
      state = applyAction(state, 'bob', {
        type: 'DRAW_CARDS',
        source: 'DECK',
      });
      expect(state.turnStep).toBe('DREW_ONE_CARD');
      expect(state.playerOrder[state.activePlayerIndex]).toBe('bob');

      // While in DREW_ONE_CARD step, Bob cannot switch to claiming a route
      expect(
        validateAction(state, 'bob', {
          type: 'CLAIM_ROUTE',
          routeId: 'R_HEL_DEN',
          payment: { GREEN: 4 },
        }).valid
      ).toBe(false);

      // Bob draws 2nd card from deck -> turn advances back to Alice
      state = applyAction(state, 'bob', {
        type: 'DRAW_CARDS',
        source: 'DECK',
      });
      expect(state.turnStep).toBe('AWAITING_ACTION');
      expect(state.playerOrder[state.activePlayerIndex]).toBe('alice');
      expect(state.lastActionSummary).toContain('bob drew a 2nd blind Train Card');

      // Verify Bob's recentDrawnCards tracks the 2 cards drawn on his turn
      const bobRecentTotal = Object.values(
        state.players['bob']!.recentDrawnCards
      ).reduce((sum, n) => sum + (n ?? 0), 0);
      expect(bobRecentTotal).toBe(2);

      // 5. Valid Turn 3 (Alice): Claim Seattle -> Helena (length 6 YELLOW) using 5 YELLOW + 1 LOCOMOTIVE
      state = applyAction(state, 'alice', {
        type: 'CLAIM_ROUTE',
        routeId: 'R_SEA_HEL',
        payment: { YELLOW: 5, LOCOMOTIVE: 1 },
      });
      expect(
        state.routes.find((r) => r.id === 'R_SEA_HEL')!.ownerId
      ).toBe('alice');
      expect(state.players['alice']!.trainsRemaining).toBe(38);
      // 1 pt (length 1) + 15 pts (length 6) = 16 pts
      expect(state.players['alice']!.claimedRoutePoints).toBe(16);

      // 6. Verify getPlayerPerspective strips opponent hidden cards & tickets
      const aliceView = getPlayerPerspective(state, 'alice');
      expect(aliceView.self.id).toBe('alice');
      expect(aliceView.self.tickets).toHaveLength(2);
      expect(aliceView.opponents['bob']).toBeDefined();
      expect(aliceView.opponents['bob']!.handCount).toBe(6); // started with 4, drew 2
      expect(aliceView.opponents['bob']!.ticketCount).toBe(1);
      expect('hand' in aliceView.opponents['bob']!).toBe(false);
      expect('tickets' in aliceView.opponents['bob']!).toBe(false);

      // 7. Verify calculateFinalScores with Graph route completion + Trans America Express (+10 pts)
      // Alice has connected Vancouver -> Seattle -> Helena (longest path = 7 trains), so:
      // - TKT_VAN_SEA (Vancouver -> Seattle, +3) is COMPLETED (+3)
      // - TKT_VAN_DEN (Vancouver -> Denver, 11) is UNCOMPLETED (-11)
      // - Trans America Express (longest continuous path: 7 > 0) = +10
      // Alice total = 16 (routes) + 3 - 11 + 10 = 18
      // Bob has 0 routes claimed, and TKT_HEL_DEN (5) is UNCOMPLETED (-5)
      const scores = calculateFinalScores(state);
      expect(scores['alice']).toBe(18);
      expect(scores['bob']).toBe(-5);
    });

    it('starts in INITIAL_TICKET_SELECTION by default, allowing each player to keep 2 or all 3 dealt routes before transitioning to PLAYING', () => {
      let state = initGame(['alice', 'bob'], 42, {
        customRoutes,
        customTickets,
      });

      expect(state.phase).toBe('INITIAL_TICKET_SELECTION');
      expect(state.turnStep).toBe('CHOOSING_TICKETS');
      expect(state.players['alice']!.pendingTickets).toHaveLength(3);
      expect(state.players['bob']!.pendingTickets).toHaveLength(3);

      // Cannot draw cards before initial ticket selection is completed
      expect(
        validateAction(state, 'alice', {
          type: 'DRAW_CARDS',
          source: 'DECK',
        }).valid
      ).toBe(false);

      // Reject keeping only 1 ticket on initial deal (minimum 2 required)
      const alicePending = state.players['alice']!.pendingTickets;
      expect(
        validateAction(state, 'alice', {
          type: 'KEEP_TICKETS',
          ticketIds: [alicePending[0]!.id],
        }).valid
      ).toBe(false);

      // Alice chooses to discard 1 route and keep 2
      state = applyAction(state, 'alice', {
        type: 'KEEP_TICKETS',
        ticketIds: [alicePending[0]!.id, alicePending[1]!.id],
      });
      expect(state.players['alice']!.tickets).toHaveLength(2);
      expect(state.players['alice']!.pendingTickets).toHaveLength(0);
      expect(state.phase).toBe('INITIAL_TICKET_SELECTION');
      expect(state.playerOrder[state.activePlayerIndex]).toBe('bob');

      // Bob chooses to keep all 3 routes
      const bobPending = state.players['bob']!.pendingTickets;
      state = applyAction(state, 'bob', {
        type: 'KEEP_TICKETS',
        ticketIds: bobPending.map((t) => t.id),
      });
      expect(state.players['bob']!.tickets).toHaveLength(3);
      expect(state.players['bob']!.pendingTickets).toHaveLength(0);

      // Game now transitions to PLAYING with Alice as active player 0
      expect(state.phase).toBe('PLAYING');
      expect(state.turnStep).toBe('AWAITING_ACTION');
      expect(state.playerOrder[state.activePlayerIndex]).toBe('alice');
    });
  });

  // ---------------------------------------------------------------------------
  // 4. Session-Aware Multiplayer RoomManager
  // ---------------------------------------------------------------------------
  describe('RoomManager - Session Tokens, Seat Assignment & Reconnection', () => {
    it('creates a room, assigns p1..p5 seats, handles disconnects/reconnects via sessionToken, and blocks mid-game new joins', () => {
      const manager = new RoomManager();
      const created = manager.createRoom('Alice', 'socket_1');

      expect(created.roomId).toHaveLength(6);
      expect(created.playerId).toBe('p1');
      expect(created.sessionToken).toHaveLength(24);

      const joinBob = manager.joinRoom(created.roomId, 'Bob', 'socket_2');
      expect(joinBob.ok).toBe(true);
      if (!joinBob.ok) return;
      expect(joinBob.player.playerId).toBe('p2');
      expect(joinBob.reconnected).toBe(false);

      // Simulate Bob disconnecting and reconnecting with a new socket ID using his sessionToken
      manager.handleDisconnect('socket_2');
      expect(joinBob.player.connected).toBe(false);

      // Start the game while Bob is disconnected
      created.room.status = 'PLAYING';

      // A brand new 3rd player cannot join once status is PLAYING
      const joinCharlie = manager.joinRoom(
        created.roomId,
        'Charlie',
        'socket_3'
      );
      expect(joinCharlie.ok).toBe(false);

      // Bob CAN reconnect mid-game using his sessionToken
      const reconnectBob = manager.joinRoom(
        created.roomId,
        'Bob',
        'socket_2_new',
        joinBob.sessionToken
      );
      expect(reconnectBob.ok).toBe(true);
      if (!reconnectBob.ok) return;
      expect(reconnectBob.reconnected).toBe(true);
      expect(reconnectBob.player.playerId).toBe('p2');
      expect(reconnectBob.player.connected).toBe(true);
      expect(reconnectBob.player.socketId).toBe('socket_2_new');
    });

    it('migrates hostPlayerId to the next connected player when the host disconnects, and builds full final standings on GAME_OVER', () => {
      const manager = new RoomManager();
      const created = manager.createRoom('AliceHost', 'sock_alice');
      const joinBob = manager.joinRoom(created.roomId, 'BobGuest', 'sock_bob');
      expect(joinBob.ok).toBe(true);
      expect(created.room.hostPlayerId).toBe('p1');

      // Host (Alice, p1) disconnects -> host migrates automatically to Bob (p2)
      const disc = manager.handleDisconnect('sock_alice');
      expect(disc).not.toBeNull();
      expect(disc!.migratedToHostId).toBe('p2');
      expect(created.room.hostPlayerId).toBe('p2');

      // Initialize a game state and verify buildFinalStandings reveals tickets and ranks players
      created.room.gameState = initGame(['p1', 'p2'], 99, {
        skipInitialTicketSelection: true,
      });
      const standings = RoomManager.buildFinalStandings(created.room);
      expect(standings).toHaveLength(2);
      expect(standings[0]!.tickets.length).toBeGreaterThan(0);
    });
  });

  // ---------------------------------------------------------------------------
  // 5. Multi-Game Registry & Catan Engine Integration
  // ---------------------------------------------------------------------------
  describe('GameRegistry - Multi-Game Dispatch (Ticket to Ride & Catan)', () => {
    it('registers ttr (2-5 players) and catan (3-4 players) with unified engine interfaces', () => {
      expect(GameRegistry.ttr.minPlayers).toBe(2);
      expect(GameRegistry.ttr.maxPlayers).toBe(5);
      expect(GameRegistry.catan.minPlayers).toBe(3);
      expect(GameRegistry.catan.maxPlayers).toBe(4);

      const manager = new RoomManager();
      const created = manager.createRoom('Alice', 'sock_1');
      expect(created.room.selectedGameId).toBe('ttr');

      // Switch room to Catan in lobby
      created.room.selectedGameId = 'catan';
      expect(created.room.selectedGameId).toBe('catan');
    });

    it('initializes Catan for 3-4 players, validates dice rolls, produces resources, and builds roads/settlements', () => {
      const catanEngine = GameRegistry.catan;

      // Reject 2-player Catan initialization
      expect(() => catanEngine.initGame(['p1', 'p2'], 101)).toThrow(/3 and 4 players/);

      // Initialize 3-player Catan match
      let state = catanEngine.initGame(['p1', 'p2', 'p3'], 101) as CatanGameState;
      expect(state.gameId).toBe('catan');
      expect(state.hexes).toHaveLength(19);
      expect(state.turnStep).toBe('ROLL_DICE');

      // Cannot build before rolling dice
      expect(
        catanEngine.validateAction(state, 'p1', { type: 'CATAN_BUILD_ROAD' }).valid
      ).toBe(false);

      // Roll dice on p1's turn
      expect(
        catanEngine.validateAction(state, 'p1', { type: 'CATAN_ROLL_DICE' }).valid
      ).toBe(true);
      state = catanEngine.applyAction(state, 'p1', {
        type: 'CATAN_ROLL_DICE',
      }) as CatanGameState;
      expect(state.turnStep).toBe('MAIN_PHASE');
      expect(state.lastDiceRoll).not.toBeNull();

      // Build a road using starting resources (1 BRICK + 1 LUMBER)
      expect(
        catanEngine.validateAction(state, 'p1', { type: 'CATAN_BUILD_ROAD' }).valid
      ).toBe(true);
      state = catanEngine.applyAction(state, 'p1', {
        type: 'CATAN_BUILD_ROAD',
      }) as CatanGameState;
      expect(state.players['p1']!.roadsBuilt).toBe(3);

      // End p1's turn -> advances to p2 in ROLL_DICE step
      state = catanEngine.applyAction(state, 'p1', {
        type: 'CATAN_END_TURN',
      }) as CatanGameState;
      expect(state.playerOrder[state.activePlayerIndex]).toBe('p2');
      expect(state.turnStep).toBe('ROLL_DICE');

      // Sanitized player perspective strips opponent resource hand breakdown
      const p1View = catanEngine.getPlayerPerspective(state, 'p1');
      expect(p1View.gameId).toBe('catan');
      if (p1View.gameId === 'catan') {
        expect(p1View.self.id).toBe('p1');
        expect(p1View.opponents['p2']).toBeDefined();
        expect('resources' in p1View.opponents['p2']!).toBe(false);
      }
    });
  });

  // ---------------------------------------------------------------------------
  // 6. Full North America Board Cities, Routes & Destination Tickets Integrity
  // ---------------------------------------------------------------------------
  describe('Ticket to Ride Full Board Data Integrity', () => {
    it('includes all 8 added cities, removes Washington-Atlanta & NY-Chicago ticket, adds 11 new tickets, and maps every city to SVG coordinates', () => {
      const addedCities = [
        'Winnipeg',
        'Sault St Marie',
        'Las Vegas',
        'Omaha',
        'Little Rock',
        'Toronto',
        'Charleston',
        'Raleigh',
      ];
      for (const city of addedCities) {
        expect(CITY_COORDINATES[city]).toBeDefined();
      }

      // Every city in routes and tickets must exist in CITY_COORDINATES
      for (const r of STANDARD_BOARD_ROUTES) {
        expect(CITY_COORDINATES[r.from]).toBeDefined();
        expect(CITY_COORDINATES[r.to]).toBeDefined();
      }
      for (const t of STANDARD_DESTINATION_TICKETS) {
        expect(CITY_COORDINATES[t.from]).toBeDefined();
        expect(CITY_COORDINATES[t.to]).toBeDefined();
      }

      // Direct Washington <-> Atlanta route is removed
      const wdcAtl = STANDARD_BOARD_ROUTES.find(
        (r) =>
          (r.from === 'Washington' && r.to === 'Atlanta') ||
          (r.from === 'Atlanta' && r.to === 'Washington')
      );
      expect(wdcAtl).toBeUndefined();

      // New York <-> Chicago destination ticket is removed
      const nyChiTicket = STANDARD_DESTINATION_TICKETS.find(
        (t) =>
          (t.from === 'Chicago' && t.to === 'New York') ||
          (t.from === 'New York' && t.to === 'Chicago')
      );
      expect(nyChiTicket).toBeUndefined();

      // Verify all 11 newly added Destination Tickets
      const expectedTickets: Array<[string, string, number]> = [
        ['Winnipeg', 'Houston', 12],
        ['Sault St Marie', 'Nashville', 8],
        ['Sault St Marie', 'Oklahoma City', 9],
        ['Toronto', 'Miami', 10],
        ['Winnipeg', 'Little Rock', 11],
        ['Montreal', 'Atlanta', 9],
        ['Calgary', 'Salt Lake City', 7],
        ['Portland', 'Phoenix', 11],
        ['Duluth', 'El Paso', 10],
        ['Chicago', 'Santa Fe', 9],
        ['Dallas', 'New York', 11],
      ];

      for (const [from, to, points] of expectedTickets) {
        const match = STANDARD_DESTINATION_TICKETS.find(
          (t) => t.from === from && t.to === to && t.points === points
        );
        expect(match).toBeDefined();
      }
    });
  });

  // ---------------------------------------------------------------------------
  // 7. Reusable Card Engine Toolkit (`common/cards`) & Texas Hold'em Engine
  // ---------------------------------------------------------------------------
  describe('Card Engine Toolkit (CardZone, Poker & Trick Evaluators) & Texas Hold’em', () => {
    it('supports StandardCard 52-card decks, CardZone transfers/sanitization, and Trick-Taking evaluation', () => {
      const deck52 = createStandardDeck();
      expect(deck52).toHaveLength(52);
      const deck54 = createStandardDeck({ includeJokers: true });
      expect(deck54).toHaveLength(54);

      const deckZone = new CardZone<StandardCard>({
        id: 'draw_pile',
        visibility: 'hidden',
        initialCards: deck52,
      });
      deckZone.shuffle(createPRNG(42));

      const p1Hand = new CardZone<StandardCard>({
        id: 'hand_p1',
        visibility: 'private',
        ownerId: 'p1',
      });
      const p2Hand = new CardZone<StandardCard>({
        id: 'hand_p2',
        visibility: 'private',
        ownerId: 'p2',
      });

      deckZone.dealRoundRobin([p1Hand, p2Hand], 2);
      expect(p1Hand.count).toBe(2);
      expect(p2Hand.count).toBe(2);
      expect(deckZone.count).toBe(48);

      // Perspective sanitization hides p2's private hand from p1 while revealing cardCount
      const p2SanitizedForP1 = p2Hand.toSanitized('p1');
      expect(p2SanitizedForP1.cardCount).toBe(2);
      expect(p2SanitizedForP1.cards).toBeNull();

      const p1SanitizedForP1 = p1Hand.toSanitized('p1');
      expect(p1SanitizedForP1.cards).toHaveLength(2);

      // Transfer a specific card from p1Hand to a public table zone
      const tableZone = new CardZone<StandardCard>({
        id: 'table',
        visibility: 'public',
      });
      const firstCardId = p1Hand.getCards()[0]!.id;
      expect(p1Hand.transferTo(tableZone, firstCardId)).toBe(true);
      expect(p1Hand.count).toBe(1);
      expect(tableZone.count).toBe(1);

      // Trick-taking evaluator test (lead suit vs trump suit)
      const cardById = (id: string) => deck52.find((c) => c.id === id)!;
      const trickWinnerNoTrump = evaluateTrickWinner(
        [
          { playerId: 'p1', card: cardById('10H') },
          { playerId: 'p2', card: cardById('AS') }, // off-suit Ace
          { playerId: 'p3', card: cardById('KH') }, // highest Heart
        ],
        null
      );
      expect(trickWinnerNoTrump.playerId).toBe('p3');

      const trickWinnerWithSpadeTrump = evaluateTrickWinner(
        [
          { playerId: 'p1', card: cardById('AH') },
          { playerId: 'p2', card: cardById('2S') }, // low trump beats off-suit Ace
          { playerId: 'p3', card: cardById('KH') },
        ],
        'S'
      );
      expect(trickWinnerWithSpadeTrump.playerId).toBe('p2');

      expect(
        isLegalTrickPlay(
          [cardById('10H'), cardById('2C')],
          cardById('2C'),
          'H',
          true
        )
      ).toBe(false);
    });

    it('accurately ranks 5-to-7 card Poker hands including Wheel Straights, Full Houses, and Royal Flushes', () => {
      const deck = createStandardDeck();
      const c = (id: string) => deck.find((card) => card.id === id)!;

      const royalFlush = evaluateBestPokerHand([
        c('AS'),
        c('KS'),
        c('QS'),
        c('JS'),
        c('10S'),
        c('2D'),
        c('3C'),
      ]);
      expect(royalFlush.category).toBe('ROYAL_FLUSH');

      const fullHouse = evaluateBestPokerHand([
        c('AH'),
        c('AD'),
        c('AC'),
        c('KH'),
        c('KD'),
        c('2C'),
        c('7S'),
      ]);
      expect(fullHouse.category).toBe('FULL_HOUSE');

      const wheelStraight = evaluateBestPokerHand([
        c('AS'),
        c('2D'),
        c('3C'),
        c('4H'),
        c('5S'),
        c('9D'),
        c('KC'),
      ]);
      expect(wheelStraight.category).toBe('STRAIGHT');
      expect(wheelStraight.tiebreakers[0]).toBe(5);

      expect(royalFlush.score).toBeGreaterThan(fullHouse.score);
      expect(fullHouse.score).toBeGreaterThan(wheelStraight.score);
    });

    it('runs a full Texas Hold’em hand through GameRegistry.holdem from Pre-Flop to Showdown and Next Hand', () => {
      const holdemEngine = GameRegistry.holdem;
      expect(holdemEngine.minPlayers).toBe(2);
      expect(holdemEngine.maxPlayers).toBe(6);

      let state = holdemEngine.initGame(['p1', 'p2', 'p3'], 777) as HoldemGameState;
      expect(state.gameId).toBe('holdem');
      expect(state.street).toBe('PREFLOP');
      expect(state.pot).toBe(30); // SB $10 (p2) + BB $20 (p3)

      // p1 is UTG in a 3-player game (dealer=p1(0), SB=p2(1), BB=p3(2), active=p1(0))
      expect(state.playerOrder[state.activePlayerIndex]).toBe('p1');

      // Sanitized perspective for p1 reveals p1's 2 hole cards and conceals p2/p3's hole cards
      const p1Perspective = holdemEngine.getPlayerPerspective(state, 'p1');
      if (p1Perspective.gameId === 'holdem') {
        expect(p1Perspective.self.holeZone.cards).toHaveLength(2);
        expect(p1Perspective.opponents['p2']!.holeZone.cards).toBeNull();
        expect(p1Perspective.opponents['p2']!.holeZone.cardCount).toBe(2);
      }

      // Pre-flop: p1 calls $20, p2 completes SB ($10 more), p3 checks BB -> advances to FLOP
      state = holdemEngine.applyAction(state, 'p1', {
        type: 'HOLDEM_CALL',
      }) as HoldemGameState;
      state = holdemEngine.applyAction(state, 'p2', {
        type: 'HOLDEM_CALL',
      }) as HoldemGameState;
      state = holdemEngine.applyAction(state, 'p3', {
        type: 'HOLDEM_CHECK',
      }) as HoldemGameState;

      expect(state.street).toBe('FLOP');
      expect(state.communityZone.cards).toHaveLength(3);
      expect(state.pot).toBe(60);

      // Flop: p2 checks, p3 bets $40, p1 folds, p2 calls $40 -> advances to TURN
      state = holdemEngine.applyAction(state, 'p2', {
        type: 'HOLDEM_CHECK',
      }) as HoldemGameState;
      state = holdemEngine.applyAction(state, 'p3', {
        type: 'HOLDEM_BET_RAISE',
        targetBet: 40,
      }) as HoldemGameState;
      state = holdemEngine.applyAction(state, 'p1', {
        type: 'HOLDEM_FOLD',
      }) as HoldemGameState;
      state = holdemEngine.applyAction(state, 'p2', {
        type: 'HOLDEM_CALL',
      }) as HoldemGameState;

      expect(state.street).toBe('TURN');
      expect(state.communityZone.cards).toHaveLength(4);
      expect(state.pot).toBe(140);

      // Turn: p2 checks, p3 checks -> advances to RIVER
      state = holdemEngine.applyAction(state, 'p2', {
        type: 'HOLDEM_CHECK',
      }) as HoldemGameState;
      state = holdemEngine.applyAction(state, 'p3', {
        type: 'HOLDEM_CHECK',
      }) as HoldemGameState;

      expect(state.street).toBe('RIVER');
      expect(state.communityZone.cards).toHaveLength(5);

      // River: p2 checks, p3 checks -> resolves SHOWDOWN & awards pot
      state = holdemEngine.applyAction(state, 'p2', {
        type: 'HOLDEM_CHECK',
      }) as HoldemGameState;
      state = holdemEngine.applyAction(state, 'p3', {
        type: 'HOLDEM_CHECK',
      }) as HoldemGameState;

      expect(state.street).toBe('SHOWDOWN');
      expect(state.turnStep).toBe('HAND_OVER');
      expect(state.lastHandWinners.length).toBeGreaterThan(0);

      // Total chips in play remain conserved at 3000
      const totalChips = Object.values(state.players).reduce(
        (sum, p) => sum + p.chips,
        0
      );
      expect(totalChips).toBe(3000);

      // Deal Next Hand rotates the dealer button and starts Hand #2
      state = holdemEngine.applyAction(state, 'p1', {
        type: 'HOLDEM_NEXT_HAND',
      }) as HoldemGameState;
      expect(state.handNumber).toBe(2);
      expect(state.street).toBe('PREFLOP');
      expect(state.dealerIndex).toBe(1);
    });
  });

  // ---------------------------------------------------------------------------
  // 8. Categorized Menu (Board vs Card Games), Euchre, Cribbage & Kings Corners
  // ---------------------------------------------------------------------------
  describe('Board vs Card Games Menu, Euchre, Cribbage & Kings Corners', () => {
    it('splits GameRegistry into Board Games (ttr, catan, stockpile, power_grid, dominion) and Card Games (holdem, euchre, cribbage, kings_corners)', () => {
      expect(BOARD_GAME_METADATA_LIST.map((g) => g.id)).toEqual([
        'ttr',
        'catan',
        'stockpile',
        'power_grid',
        'dominion',
      ]);
      expect(CARD_GAME_METADATA_LIST.map((g) => g.id)).toEqual([
        'holdem',
        'euchre',
        'cribbage',
        'kings_corners',
      ]);
    });

    it('enforces Kings Corners rules: 2-card initial peek, hidden cards during play, knock circle-back, K=0 scoring, and last-quarter tie push rule', () => {
      const deck = createStandardDeck();
      const cardById = (id: string) => deck.find((c) => c.id === id)!;

      // Verify exact card point values: A=1, 2..9=face, 10/J/Q=10, K=0
      expect(getKingsCornersCardPoints(cardById('AS'))).toBe(1);
      expect(getKingsCornersCardPoints(cardById('7H'))).toBe(7);
      expect(getKingsCornersCardPoints(cardById('10D'))).toBe(10);
      expect(getKingsCornersCardPoints(cardById('JC'))).toBe(10);
      expect(getKingsCornersCardPoints(cardById('QH'))).toBe(10);
      expect(getKingsCornersCardPoints(cardById('KS'))).toBe(0);

      const kcEngine = GameRegistry.kings_corners;
      let state = kcEngine.initGame(['p1', 'p2'], 555) as KingsCornersGameState;
      expect(state.turnStep).toBe('INITIAL_PEEK');
      expect(state.players['p1']!.quarters).toBe(4);
      expect(state.players['p2']!.quarters).toBe(4);

      // Before peeking, all 4 slots are hidden (null)
      let p1View = kcEngine.getPlayerPerspective(state, 'p1');
      if (p1View.gameId === 'kings_corners') {
        expect(p1View.self.visibleSlots).toEqual([null, null, null, null]);
      }

      // p1 peeks at TOP 2 cards (slots 0 & 1 visible; slots 2 & 3 null)
      state = kcEngine.applyAction(state, 'p1', {
        type: 'KC_PEEK_CARDS',
        row: 'TOP',
      }) as KingsCornersGameState;
      p1View = kcEngine.getPlayerPerspective(state, 'p1');
      if (p1View.gameId === 'kings_corners') {
        expect(p1View.self.visibleSlots[0]).not.toBeNull();
        expect(p1View.self.visibleSlots[1]).not.toBeNull();
        expect(p1View.self.visibleSlots[2]).toBeNull();
        expect(p1View.self.visibleSlots[3]).toBeNull();
      }

      // p2 peeks at BOTTOM 2 cards
      state = kcEngine.applyAction(state, 'p2', {
        type: 'KC_PEEK_CARDS',
        row: 'BOTTOM',
      }) as KingsCornersGameState;

      // Both players finish peeking -> hand begins and ALL 4 cards are hidden again!
      state = kcEngine.applyAction(state, 'p1', {
        type: 'KC_FINISH_PEEK',
      }) as KingsCornersGameState;
      state = kcEngine.applyAction(state, 'p2', {
        type: 'KC_FINISH_PEEK',
      }) as KingsCornersGameState;

      expect(state.turnStep).toBe('AWAITING_TURN_ACTION');
      p1View = kcEngine.getPlayerPerspective(state, 'p1');
      if (p1View.gameId === 'kings_corners') {
        expect(p1View.self.visibleSlots).toEqual([null, null, null, null]);
      }

      // Dealer is p1 (index 0), so p2 (index 1) acts first clockwise from dealer
      expect(state.playerOrder[state.activePlayerIndex]).toBe('p2');

      // Set known cards so p2 has low score (4 Kings = 0 pts) and p1 has high score (35 pts)
      state = {
        ...state,
        players: {
          ...state.players,
          p1: {
            ...state.players['p1']!,
            cards: [
              cardById('10S'),
              cardById('JH'),
              cardById('QD'),
              cardById('5C'),
            ], // 35 pts
          },
          p2: {
            ...state.players['p2']!,
            cards: [
              cardById('KS'),
              cardById('KH'),
              cardById('KD'),
              cardById('KC'),
            ], // 0 pts
          },
        },
      };

      // p2 Knocks! Turn passes to p1 for their final turn
      state = kcEngine.applyAction(state, 'p2', {
        type: 'KC_KNOCK',
      }) as KingsCornersGameState;
      expect(state.knockerId).toBe('p2');
      expect(state.playerOrder[state.activePlayerIndex]).toBe('p1');

      // p1 draws from deck and discards the drawn card -> circles back to p2 (knocker) and ends the hand!
      state = kcEngine.applyAction(state, 'p1', {
        type: 'KC_DRAW_DECK',
      }) as KingsCornersGameState;
      expect(state.turnStep).toBe('DECIDING_DRAWN_CARD');

      state = kcEngine.applyAction(state, 'p1', {
        type: 'KC_DISCARD_DRAWN',
      }) as KingsCornersGameState;

      expect(state.turnStep).toBe('HAND_OVER');
      expect(state.players['p1']!.quarters).toBe(3); // p1 lost 1 quarter
      expect(state.players['p2']!.quarters).toBe(4);
      expect(state.potQuarters).toBe(1);

      // Test the Last-Quarter Tie Push Rule:
      // If both players are on their last quarter (1 quarter each) and tie for highest score, neither loses a quarter!
      let tieState = kcEngine.applyAction(state, 'p1', {
        type: 'KC_NEXT_HAND',
      }) as KingsCornersGameState;
      tieState = {
        ...tieState,
        turnStep: 'AWAITING_TURN_ACTION',
        activePlayerIndex: 0,
        players: {
          p1: {
            ...tieState.players['p1']!,
            quarters: 1,
            readyAfterPeek: true,
            cards: [
              cardById('10S'),
              cardById('10H'),
              cardById('5D'),
              cardById('5C'),
            ], // 30 pts
          },
          p2: {
            ...tieState.players['p2']!,
            quarters: 1,
            readyAfterPeek: true,
            cards: [
              cardById('JS'),
              cardById('QH'),
              cardById('6D'),
              cardById('4C'),
            ], // 30 pts
          },
        },
      };

      tieState = kcEngine.applyAction(tieState, 'p1', {
        type: 'KC_KNOCK',
      }) as KingsCornersGameState;
      tieState = kcEngine.applyAction(tieState, 'p2', {
        type: 'KC_DRAW_DECK',
      }) as KingsCornersGameState;
      tieState = kcEngine.applyAction(tieState, 'p2', {
        type: 'KC_DISCARD_DRAWN',
      }) as KingsCornersGameState;

      expect(tieState.turnStep).toBe('HAND_OVER');
      expect(tieState.lastHandSummary!.isPush).toBe(true);
      expect(tieState.players['p1']!.quarters).toBe(1);
      expect(tieState.players['p2']!.quarters).toBe(1);
    });

    it('evaluates Euchre Right/Left Bowers and Cribbage 15s/Pairs/Runs/Nobs accurately', () => {
      const deck = createStandardDeck();
      const c = (id: string) => deck.find((card) => card.id === id)!;

      // In Euchre with Spades ('S') as Trump, Jack of Clubs ('JC') is the Left Bower and counts as a Spade!
      expect(getEuchreEffectiveSuit(c('JC'), 'S')).toBe('S');
      const winner = evaluateEuchreTrickWinner(
        [
          { playerId: 'p1', card: c('AS') }, // Ace of Trump
          { playerId: 'p2', card: c('JC') }, // Left Bower beats Ace of Trump!
        ],
        'S'
      );
      expect(winner.playerId).toBe('p2');

      const euchreState = GameRegistry.euchre.initGame(
        ['p1', 'p2', 'p3', 'p4'],
        101
      ) as EuchreGameState;
      expect(euchreState.gameId).toBe('euchre');
      expect(euchreState.players['p1']!.handZone.cards).toHaveLength(5);

      // Cribbage Perfect 29-point hand test: 5H, 5C, 5D, JS with starter 5S!
      // 15s = 8 combos (16 pts) + Four of a kind 5s (6 pairs = 12 pts) + His Nobs JS matching 5S (1 pt) = 29 pts!
      const perfect29 = evaluateCribbageHand(
        [c('5H'), c('5C'), c('5D'), c('JS')],
        c('5S'),
        false
      );
      expect(perfect29.fifteens).toBe(16);
      expect(perfect29.pairs).toBe(12);
      expect(perfect29.nobs).toBe(1);
      expect(perfect29.total).toBe(29);

      const cribState = GameRegistry.cribbage.initGame(
        ['p1', 'p2'],
        202
      ) as CribbageGameState;
      expect(cribState.gameId).toBe('cribbage');
      expect(cribState.players['p1']!.handZone.cards).toHaveLength(6);
    });
  });

  // ---------------------------------------------------------------------------
  // 9. Stockpile Digital Board Game Engine (6 Rounds, 6 Phases, Splits & Bankruptcy)
  // ---------------------------------------------------------------------------
  describe('Stockpile Board Game Engine', () => {
    it('initializes 80-card Market Deck, 6 companies at $5, $20,000 starting cash, and Phase 1/2 setup', () => {
      const deck80 = createMarketDeck80();
      expect(deck80).toHaveLength(80);
      expect(deck80.filter((c) => c.kind === 'BOOM')).toHaveLength(4);
      expect(deck80.filter((c) => c.kind === 'BUST')).toHaveLength(4);
      expect(deck80.filter((c) => c.kind === 'TRADING_FEE')).toHaveLength(4);
      for (const cid of STOCKPILE_COMPANY_IDS) {
        const companyShares = deck80.filter(
          (c) => c.kind === 'SHARE' && c.companyId === cid
        );
        expect(companyShares.length).toBeGreaterThanOrEqual(10);
      }

      const spEngine = GameRegistry.stockpile;
      const state = spEngine.initGame(['p1', 'p2', 'p3'], 777) as StockpileGameState;
      expect(state.gameId).toBe('stockpile');
      expect(state.roundNumber).toBe(1);
      expect(state.maxRounds).toBe(6);
      expect(state.turnStep).toBe('PHASE_2_SUPPLY');
      expect(state.stockpiles).toHaveLength(3);

      for (const cid of STOCKPILE_COMPANY_IDS) {
        expect(state.stockPrices[cid]).toBe(5);
      }
      for (const pid of ['p1', 'p2', 'p3']) {
        expect(state.players[pid]!.cash).toBe(20000);
        expect(state.players[pid]!.supplyHand).toHaveLength(2);
        expect(state.players[pid]!.insiderPairing).not.toBeNull();
      }

      // Sanitized perspective hides face-down stockpile cards & other players' private insider pairings
      const p1View = spEngine.getPlayerPerspective(state, 'p1');
      if (p1View.gameId === 'stockpile') {
        expect(p1View.publicPairing).toBeDefined();
        expect(p1View.self.insiderPairing).not.toBeNull();
        expect(p1View.opponents['p2']!.insiderPairing).toBeNull();
        expect(p1View.revealedPairings).toBeNull();
      }
    });

    it('enforces Stock Splits at $11 (doubles shares, resets to $6) and Bankruptcy at $0 (wipes shares, resets to $5)', () => {
      const spEngine = GameRegistry.stockpile;
      let state = spEngine.initGame(['p1', 'p2'], 888) as StockpileGameState;

      // Give p1 3 shares of ENERGY and 4 shares of BIOTECH
      state = {
        ...state,
        stockPrices: {
          ...state.stockPrices,
          ENERGY: 9,
          BIOTECH: 2,
        },
        players: {
          ...state.players,
          p1: {
            ...state.players['p1']!,
            portfolio: {
              ...state.players['p1']!.portfolio,
              ENERGY: 3,
              BIOTECH: 4,
            },
          },
        },
      };

      // Shift ENERGY by +2 -> reaches $11 -> Stock Split! Shares double to 6 and price resets to $6!
      const splitRes = applyCompanyPriceShift(
        state.stockPrices,
        state.players,
        'ENERGY',
        2,
        false
      );
      expect(splitRes.movement.triggeredSplit).toBe(true);
      expect(splitRes.nextPrices.ENERGY).toBe(6);
      expect(splitRes.nextPlayers['p1']!.portfolio.ENERGY).toBe(6);

      // Shift BIOTECH by -2 -> reaches $0 -> Bankruptcy! Shares wiped to 0 and price resets to $5!
      const bankruptRes = applyCompanyPriceShift(
        splitRes.nextPrices,
        splitRes.nextPlayers,
        'BIOTECH',
        -2,
        false
      );
      expect(bankruptRes.movement.triggeredBankruptcy).toBe(true);
      expect(bankruptRes.nextPrices.BIOTECH).toBe(5);
      expect(bankruptRes.nextPlayers['p1']!.portfolio.BIOTECH).toBe(0);
    });

    it('runs through all 6 phases and 6 rounds including outbid displacement, selling, and End-Game Majority Shareholder Bonuses', () => {
      const spEngine = GameRegistry.stockpile;
      let state = spEngine.initGame(['p1', 'p2'], 999) as StockpileGameState;

      // Phase 2: p1 and p2 place 1 face-up and 1 face-down card
      const p1Cards = state.players['p1']!.supplyHand;
      state = spEngine.applyAction(state, 'p1', {
        type: 'STOCKPILE_PLACE_SUPPLY',
        faceUpCardId: p1Cards[0]!.id,
        faceUpPileIndex: 0,
        faceDownCardId: p1Cards[1]!.id,
        faceDownPileIndex: 1,
      }) as StockpileGameState;

      const p2Cards = state.players['p2']!.supplyHand;
      state = spEngine.applyAction(state, 'p2', {
        type: 'STOCKPILE_PLACE_SUPPLY',
        faceUpCardId: p2Cards[0]!.id,
        faceUpPileIndex: 1,
        faceDownCardId: p2Cards[1]!.id,
        faceDownPileIndex: 0,
      }) as StockpileGameState;

      expect(state.turnStep).toBe('PHASE_3_DEMAND');

      // Phase 3: p1 bids $0 on Pile 0
      state = spEngine.applyAction(state, 'p1', {
        type: 'STOCKPILE_BID',
        pileIndex: 0,
        bidAmount: 0,
      }) as StockpileGameState;

      // p2 outbids p1 on Pile 0 with $3K!
      state = spEngine.applyAction(state, 'p2', {
        type: 'STOCKPILE_BID',
        pileIndex: 0,
        bidAmount: 3,
      }) as StockpileGameState;

      // p1 was outbid on Pile 0, so p1 is immediately active and CANNOT re-bid on Pile 0 immediately!
      expect(state.playerOrder[state.activePlayerIndex]).toBe('p1');
      expect(state.players['p1']!.outbidFromPileIndex).toBe(0);
      const invalidRebid = spEngine.validateAction(state, 'p1', {
        type: 'STOCKPILE_BID',
        pileIndex: 0,
        bidAmount: 6,
      });
      expect(invalidRebid.valid).toBe(false);

      // p1 moves their bidding token to Pile 1 at $0 -> every player now occupies a unique stockpile!
      state = spEngine.applyAction(state, 'p1', {
        type: 'STOCKPILE_BID',
        pileIndex: 1,
        bidAmount: 0,
      }) as StockpileGameState;

      // Fast-forward remaining rounds using AI turn action & round advancement until GAME_OVER
      let safetyCounter = 0;
      while (state.phase !== 'GAME_OVER' && safetyCounter < 200) {
        safetyCounter++;
        const activePid = state.playerOrder[state.activePlayerIndex]!;
        if (state.turnStep === 'PHASE_6_MOVEMENT_SUMMARY') {
          state = spEngine.applyAction(state, activePid, {
            type: 'STOCKPILE_NEXT_ROUND',
          }) as StockpileGameState;
        } else {
          state = spEngine.applyAction(state, activePid, {
            type: 'STOCKPILE_AI_TURN',
          }) as StockpileGameState;
        }
      }

      expect(state.phase).toBe('GAME_OVER');
      expect(state.roundNumber).toBe(6);
      expect(state.winnerId).not.toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // 10. Ticket to Ride: Trans America Express (+10 pts) & Tie-Breaker
  // ---------------------------------------------------------------------------
  describe('Ticket to Ride - Trans America Express & Tie-Breaker', () => {
    it('computes longest continuous path allowing loops and repeated cities without reusing routes, awards +10 pts, and breaks final score ties', () => {
      // p1 owns a loop with a tail: A-B (3), B-C (4), C-A (5), and A-D (2).
      // Continuous path D -> A -> B -> C -> A traverses all 4 distinct routes (passing through A twice) for length 2 + 3 + 4 + 5 = 14!
      // Plus a disconnected branch E-F (6) which cannot be combined with the 14-length component.
      const testRoutes: RouteEdge[] = [
        { id: 'R1', from: 'CityA', to: 'CityB', length: 3, color: 'GRAY', routeIndex: 0, ownerId: 'p1' },
        { id: 'R2', from: 'CityB', to: 'CityC', length: 4, color: 'GRAY', routeIndex: 0, ownerId: 'p1' },
        { id: 'R3', from: 'CityC', to: 'CityA', length: 5, color: 'GRAY', routeIndex: 0, ownerId: 'p1' },
        { id: 'R4', from: 'CityA', to: 'CityD', length: 2, color: 'GRAY', routeIndex: 0, ownerId: 'p1' },
        { id: 'R5', from: 'CityE', to: 'CityF', length: 6, color: 'GRAY', routeIndex: 0, ownerId: 'p1' },
        // p2 owns a single path of length 10
        { id: 'R6', from: 'CityX', to: 'CityY', length: 6, color: 'GRAY', routeIndex: 0, ownerId: 'p2' },
        { id: 'R7', from: 'CityY', to: 'CityZ', length: 4, color: 'GRAY', routeIndex: 0, ownerId: 'p2' },
      ];

      expect(calculateLongestContinuousPath(testRoutes, 'p1')).toBe(14);
      expect(calculateLongestContinuousPath(testRoutes, 'p2')).toBe(10);

      // Set up a room where p1 ( seated 2nd in playerOrder: ['p2', 'p1'] ) and p2 end in an exact final score tie (30 pts each):
      // - p2 has 30 route points, 0 ticket points, longest path = 10 -> no Trans America Express -> total = 30
      // - p1 has 20 route points, 0 ticket points, longest path = 14 -> +10 Trans America Express -> total = 30!
      // Verify p1 is ranked #1 (winner) ahead of p2 because p1 holds the Trans America Express!
      const manager = new RoomManager();
      const created = manager.createRoom('BobFirst', 'sock_p2');
      manager.joinRoom(created.roomId, 'AliceSecond', 'sock_p1');

      const baseState = initGame(['p1', 'p2'], 123, {
        skipInitialTicketSelection: true,
      });

      created.room.gameState = {
        ...baseState,
        phase: 'GAME_OVER',
        playerOrder: ['p1', 'p2'], // p1 = BobFirst (10-length path), p2 = AliceSecond (14-length path)
        routes: [
          { id: 'R_P1', from: 'CityX', to: 'CityY', length: 6, color: 'GRAY', routeIndex: 0, ownerId: 'p1' },
          { id: 'R_P2_1', from: 'CityA', to: 'CityB', length: 5, color: 'GRAY', routeIndex: 0, ownerId: 'p2' },
          { id: 'R_P2_2', from: 'CityB', to: 'CityC', length: 5, color: 'GRAY', routeIndex: 0, ownerId: 'p2' },
        ],
        players: {
          p1: {
            ...baseState.players['p1']!,
            claimedRoutePoints: 30,
            tickets: [],
          },
          p2: {
            ...baseState.players['p2']!,
            claimedRoutePoints: 20, // 20 route pts + 10 Trans America Express = 30 total pts (tied with p1!)
            tickets: [],
          },
        },
      };

      const standings = RoomManager.buildFinalStandings(created.room);
      expect(standings[0]!.playerId).toBe('p2');
      expect(standings[0]!.totalScore).toBe(30);
      expect(standings[0]!.hasTransAmericaExpress).toBe(true);
      expect(standings[0]!.longestPathLength).toBe(10);

      expect(standings[1]!.playerId).toBe('p1');
      expect(standings[1]!.totalScore).toBe(30);
      expect(standings[1]!.hasTransAmericaExpress).toBe(false);
      expect(standings[1]!.longestPathLength).toBe(6);
    });
  });

  // ---------------------------------------------------------------------------
  // 11. Multi-Step Game Setup Catalog, Expansions & Lobby Color/Ready State
  // ---------------------------------------------------------------------------
  describe('Game Setup Catalog, Expansion Bounds & Lobby Player Settings', () => {
    it('defines Board and Card game catalogs with colors, expansions, and dynamic player count overrides', () => {
      expect(BOARD_GAMES_CATALOG.map((g) => g.id)).toEqual([
        'ttr',
        'catan',
        'stockpile',
        'power_grid',
        'dominion',
      ]);
      expect(CARD_GAMES_CATALOG.map((g) => g.id)).toEqual([
        'holdem',
        'euchre',
        'cribbage',
        'kings_corners',
      ]);

      // Catan base bounds (3-4 players) vs 5-6 Player Extension override (3-6 players)
      const catanDef = GAME_CATALOG_BY_ID.catan;
      expect(getEffectivePlayerBounds(catanDef, [])).toEqual({
        minPlayers: 3,
        maxPlayers: 4,
      });
      expect(
        getEffectivePlayerBounds(catanDef, ['catan_5_6_player'])
      ).toEqual({
        minPlayers: 3,
        maxPlayers: 6,
      });
    });

    it('tracks player color & ready settings and releases claimed color when a player disconnects in LOBBY', () => {
      const manager = new RoomManager();
      const { roomId, room } = manager.createRoom('HostAlice', 'sock_1', 'ttr');
      const joinRes = manager.joinRoom(roomId, 'GuestBob', 'sock_2');
      expect(joinRes.ok).toBe(true);

      // Host claims 'red' and marks ready; Guest claims 'blue'
      room.playerSettings.set('p1', { colorId: 'red', ready: true });
      room.playerSettings.set('p2', { colorId: 'blue', ready: false });

      expect(RoomManager.getPlayerColorsRecord(room)).toEqual({
        p1: 'red',
        p2: 'blue',
      });

      // Guest disconnects while in LOBBY -> 'blue' is released
      manager.handleDisconnect('sock_2');
      expect(room.playerSettings.get('p2')).toEqual({
        colorId: null,
        ready: false,
      });
      expect(RoomManager.getPlayerColorsRecord(room)).toEqual({
        p1: 'red',
      });

      // Switching games resets all players' colors and ready flags
      RoomManager.resetLobbyPlayerSettings(room);
      expect(room.playerSettings.get('p1')).toEqual({
        colorId: null,
        ready: false,
      });
    });
  });

  // ---------------------------------------------------------------------------
  // 12. Ticket to Ride Expansion — Alvin & Dexter
  // ---------------------------------------------------------------------------
  describe('Ticket to Ride Expansion: Alvin & Dexter', () => {
    it('places Alvin (last player) and Dexter (second-to-last player), blocks City in Chaos routes, enforces Move Monster hop/deck/face-up rules, and scores chaos tickets + monster bonuses', () => {
      let state = initGame(['p1', 'p2', 'p3'], 20261107, {
        enableAlvinAndDexter: true,
      });
      expect(state.alvinAndDexter?.enabled).toBe(true);
      expect(state.alvinAndDexter?.alvinDeckRemaining).toBe(20);
      expect(state.alvinAndDexter?.dexterDeckRemaining).toBe(20);

      // Complete initial ticket selection for all 3 players
      for (const pid of ['p1', 'p2', 'p3']) {
        const pendingIds = state.players[pid]!.pendingTickets.map((t) => t.id);
        state = applyAction(state, pid, {
          type: 'KEEP_TICKETS',
          ticketIds: pendingIds,
        });
      }

      // Now in MONSTER_PLACEMENT: last player in turn order (p3) selects starting city for Alvin
      expect(state.phase).toBe('MONSTER_PLACEMENT');
      expect(state.turnStep).toBe('PLACING_MONSTER');
      expect(state.playerOrder[state.activePlayerIndex]).toBe('p3');
      expect(state.alvinAndDexter?.monsterToPlace).toBe('ALVIN');

      // Non-active player cannot place Alvin
      expect(
        validateAction(state, 'p1', {
          type: 'PLACE_MONSTER',
          monster: 'ALVIN',
          cityName: 'Denver',
        }).valid
      ).toBe(false);

      state = applyAction(state, 'p3', {
        type: 'PLACE_MONSTER',
        monster: 'ALVIN',
        cityName: 'Denver',
      });

      // Next, the player who plays just before p3 (p2) selects starting city for Dexter
      expect(state.phase).toBe('MONSTER_PLACEMENT');
      expect(state.playerOrder[state.activePlayerIndex]).toBe('p2');
      expect(state.alvinAndDexter?.monsterToPlace).toBe('DEXTER');

      // Dexter cannot be placed in the same city as Alvin
      expect(
        validateAction(state, 'p2', {
          type: 'PLACE_MONSTER',
          monster: 'DEXTER',
          cityName: 'Denver',
        }).valid
      ).toBe(false);

      state = applyAction(state, 'p2', {
        type: 'PLACE_MONSTER',
        monster: 'DEXTER',
        cityName: 'Atlanta',
      });

      // Now normal play begins with p1 (first player in turn order)
      expect(state.phase).toBe('PLAYING');
      expect(state.turnStep).toBe('AWAITING_ACTION');
      expect(state.playerOrder[state.activePlayerIndex]).toBe('p1');
      expect(state.alvinAndDexter?.alvinCity).toBe('Denver');
      expect(state.alvinAndDexter?.dexterCity).toBe('Atlanta');

      // Give p1 plenty of train cards & locomotives to test City in Chaos and Move Monster
      state = {
        ...state,
        players: {
          ...state.players,
          p1: {
            ...state.players['p1']!,
            hand: {
              ...state.players['p1']!.hand,
              LOCOMOTIVE: 6,
              RED: 6,
              BLUE: 6,
              GREEN: 6,
              YELLOW: 6,
            },
          },
          p2: {
            ...state.players['p2']!,
            hand: {
              ...state.players['p2']!.hand,
              LOCOMOTIVE: 4,
            },
          },
        },
      };

      // City in Chaos check: Denver (Alvin) and Atlanta (Dexter) block route claiming into/out of them
      const denverRoute = state.routes.find(
        (r) =>
          (r.from === 'Denver' && r.to === 'Omaha') ||
          (r.from === 'Omaha' && r.to === 'Denver')
      )!;
      const chaosClaimCheck = validateAction(state, 'p1', {
        type: 'CLAIM_ROUTE',
        routeId: denverRoute.id,
        payment: { LOCOMOTIVE: denverRoute.length },
      });
      expect(chaosClaimCheck.valid).toBe(false);
      expect(chaosClaimCheck.reason).toContain('City in Chaos');

      // Move Monster: 1 Locomotive allows moving 1-3 cities away (not 4-6 cities away)
      // From Denver, Helena is 2 hops away (Denver -> Salt Lake City -> Helena)
      // whereas Miami is >3 hops away
      expect(
        validateAction(state, 'p1', {
          type: 'MOVE_MONSTER',
          monster: 'ALVIN',
          locomotivesSpent: 1,
          targetCity: 'Miami',
        }).valid
      ).toBe(false);

      state = applyAction(state, 'p1', {
        type: 'MOVE_MONSTER',
        monster: 'ALVIN',
        locomotivesSpent: 1,
        targetCity: 'Helena',
      });

      // Moving a monster is in addition to the player's turn action (still p1's turn!)
      expect(state.playerOrder[state.activePlayerIndex]).toBe('p1');
      expect(state.alvinAndDexter?.alvinCity).toBe('Helena');
      expect(state.alvinAndDexter?.alvinDeckRemaining).toBe(19);
      expect(state.players['p1']!.alvinCards).toBe(1);
      expect(state.players['p1']!.faceUpAlvinTurnsRemaining).toBe(2);

      // Cannot move both monsters during the same turn
      expect(
        validateAction(state, 'p1', {
          type: 'MOVE_MONSTER',
          monster: 'DEXTER',
          locomotivesSpent: 1,
          targetCity: 'Miami',
        }).valid
      ).toBe(false);

      // Now that Alvin left Denver, p1 can claim the Denver route as their normal turn action!
      state = applyAction(state, 'p1', {
        type: 'CLAIM_ROUTE',
        routeId: denverRoute.id,
        payment: { LOCOMOTIVE: denverRoute.length },
      });

      // After p1's turn ends, p1's face-up Alvin card remains face-up (turnsRemaining = 1)
      expect(state.playerOrder[state.activePlayerIndex]).toBe('p2');
      expect(state.players['p1']!.faceUpAlvinTurnsRemaining).toBe(1);
      const p2Perspective = getPlayerPerspective(state, 'p2');
      expect(p2Perspective.opponents['p1']!.hasFaceUpAlvin).toBe(true);
      expect(p2Perspective.opponents['p1']!.hasFaceUpDexter).toBe(false);
      // Specific amount of Alvin and Dexter cards is hidden information
      expect('alvinCards' in p2Perspective.opponents['p1']!).toBe(false);
      expect('dexterCards' in p2Perspective.opponents['p1']!).toBe(false);

      // p2 uses 2 Locomotives to move Dexter 4-6 cities away from Atlanta (e.g. to Denver or Seattle)
      // Let's complete p2 and p3 turns by drawing from deck so it returns to p1's next turn
      state = applyAction(state, 'p2', { type: 'DRAW_CARDS', source: 'DECK' });
      state = applyAction(state, 'p2', { type: 'DRAW_CARDS', source: 'DECK' });
      state = applyAction(state, 'p3', { type: 'DRAW_CARDS', source: 'DECK' });
      state = applyAction(state, 'p3', { type: 'DRAW_CARDS', source: 'DECK' });

      // Now it is p1's next turn: p1 STILL has a face-up Alvin card until the end of this turn!
      expect(state.playerOrder[state.activePlayerIndex]).toBe('p1');
      expect(state.players['p1']!.faceUpAlvinTurnsRemaining).toBe(1);
      const repeatAlvinCheck = validateAction(state, 'p1', {
        type: 'MOVE_MONSTER',
        monster: 'ALVIN',
        locomotivesSpent: 1,
        targetCity: 'Denver',
      });
      expect(repeatAlvinCheck.valid).toBe(false);
      expect(repeatAlvinCheck.reason).toContain('face-up');

      // When p1 finishes their next turn, the face-up Alvin card turns face-down (0 remaining)
      state = applyAction(state, 'p1', { type: 'DRAW_CARDS', source: 'DECK' });
      state = applyAction(state, 'p1', { type: 'DRAW_CARDS', source: 'DECK' });
      expect(state.players['p1']!.faceUpAlvinTurnsRemaining).toBe(0);

      // End-of-game scoring verification:
      // - Alvin is in Helena, Dexter is in Atlanta ("Cities in Chaos")
      // - Ticket containing a City in Chaos is worth half its normal value rounded down (13 -> 6)
      //   for both completed and uncompleted tickets.
      // - Most Alvin cards awards +15 pts (ties award +15 to all tied players).
      // - Most Dexter cards awards +15 pts (ties award +15 to all tied players).
      const scoringState: GameState = {
        ...state,
        routes: state.routes.map((r) => {
          if (
            (r.from === 'Seattle' && r.to === 'Helena') ||
            (r.from === 'Helena' && r.to === 'Seattle')
          ) {
            return { ...r, ownerId: 'p1' }; // p1 connects Seattle -> Helena
          }
          return { ...r, ownerId: null };
        }),
        players: {
          ...state.players,
          p1: {
            ...state.players['p1']!,
            claimedRoutePoints: 0,
            alvinCards: 2, // tied for most Alvin with p2 -> +15
            dexterCards: 1, // most Dexter -> +15
            tickets: [
              // Completed ticket containing Helena (City in Chaos): 13 -> floor(13/2) = +6
              { id: 't1', from: 'Seattle', to: 'Helena', points: 13 },
            ],
          },
          p2: {
            ...state.players['p2']!,
            claimedRoutePoints: 0,
            alvinCards: 2, // tied for most Alvin with p1 -> +15
            dexterCards: 0,
            tickets: [
              // Uncompleted ticket containing Atlanta (City in Chaos): 13 -> -floor(13/2) = -6
              { id: 't2', from: 'Miami', to: 'Atlanta', points: 13 },
            ],
          },
          p3: {
            ...state.players['p3']!,
            claimedRoutePoints: 0,
            alvinCards: 0,
            dexterCards: 0,
            tickets: [
              // Uncompleted ticket NOT in chaos: 11 -> -11
              { id: 't3', from: 'Boston', to: 'Miami', points: 11 },
            ],
          },
        },
      };

      const finalScores = calculateFinalScores(scoringState);
      // p1: +6 (completed chaos ticket) + 10 (Trans America Express) + 15 (Alvin tie) + 15 (Dexter) = 46
      expect(finalScores['p1']).toBe(46);
      // p2: -6 (uncompleted chaos ticket) + 15 (Alvin tie) = 9
      expect(finalScores['p2']).toBe(9);
      // p3: -11 (uncompleted normal ticket) = -11
      expect(finalScores['p3']).toBe(-11);
    });
  });

  // ---------------------------------------------------------------------------
  // 13. Ticket to Ride: Europe Map, Ferries, Mountain Tunnels & Train Stations
  // ---------------------------------------------------------------------------
  describe('Ticket to Ride: Europe Map, Ferries, Tunnels & Train Stations', () => {
    it('deals 1 Long Route + 3 Regular Routes at setup, enforces Ferry locomotive costs, resolves Tunnels, builds Train Stations (1/2/3 cost), and scores +4 pts per unused station & borrows 1 rival route', () => {
      let state = GameRegistry.ttr.initGame(['p1', 'p2'], 20261108, {
        selectedExpansions: ['europe_map'],
      }) as GameState;

      expect(state.mapId).toBe('EUROPE');
      expect(state.stations).toEqual({});
      expect(state.players['p1']!.stationsRemaining).toBe(3);
      expect(state.players['p2']!.stationsRemaining).toBe(3);

      // Each player is dealt 1 Long Route (20-21 pts) + 3 Regular Routes = 4 pending tickets
      expect(state.players['p1']!.pendingTickets).toHaveLength(4);
      expect(
        state.players['p1']!.pendingTickets.filter((t) => t.isLongRoute)
      ).toHaveLength(1);
      expect(state.players['p2']!.pendingTickets).toHaveLength(4);
      expect(
        state.players['p2']!.pendingTickets.filter((t) => t.isLongRoute)
      ).toHaveLength(1);

      // Both players keep at least 2 tickets to start playing
      for (const pid of ['p1', 'p2']) {
        const keepIds = state.players[pid]!.pendingTickets
          .slice(0, 2)
          .map((t) => t.id);
        state = applyAction(state, pid, {
          type: 'KEEP_TICKETS',
          ticketIds: keepIds,
        });
      }
      expect(state.phase).toBe('PLAYING');

      // Give p1 and p2 cards to test Ferries, Tunnels, and Train Stations
      state = {
        ...state,
        players: {
          ...state.players,
          p1: {
            ...state.players['p1']!,
            hand: {
              ...state.players['p1']!.hand,
              RED: 6,
              BLUE: 6,
              GREEN: 6,
              LOCOMOTIVE: 4,
            },
          },
          p2: {
            ...state.players['p2']!,
            hand: {
              ...state.players['p2']!.hand,
              YELLOW: 6,
              BLACK: 6,
              LOCOMOTIVE: 4,
            },
          },
        },
      };

      // 1. Ferry validation: London <-> Dieppe (length 2, GRAY, ferryLocomotives = 1)
      const ferryRoute = state.routes.find(
        (r) =>
          (r.from === 'London' && r.to === 'Dieppe') ||
          (r.from === 'Dieppe' && r.to === 'London')
      )!;
      expect(ferryRoute.ferryLocomotives).toBe(1);

      // Rejects claiming ferry without a Locomotive
      const badFerry = validateAction(state, 'p1', {
        type: 'CLAIM_ROUTE',
        routeId: ferryRoute.id,
        payment: { RED: 2 },
      });
      expect(badFerry.valid).toBe(false);
      expect(badFerry.reason).toContain('Ferry route');

      // Succeeds when paying 1 RED + 1 LOCOMOTIVE
      state = applyAction(state, 'p1', {
        type: 'CLAIM_ROUTE',
        routeId: ferryRoute.id,
        payment: { RED: 1, LOCOMOTIVE: 1 },
      });
      expect(
        state.routes.find((r) => r.id === ferryRoute.id)!.ownerId
      ).toBe('p1');

      // 2. Train Station building:
      // p2 builds 1st station in Paris for 1 card (YELLOW: 1)
      expect(
        validateAction(state, 'p2', {
          type: 'BUILD_STATION',
          cityName: 'Paris',
          payment: { YELLOW: 2 }, // Wrong count: 1st station costs 1 card
        }).valid
      ).toBe(false);

      state = applyAction(state, 'p2', {
        type: 'BUILD_STATION',
        cityName: 'Paris',
        payment: { YELLOW: 1 },
      });
      expect(state.stations?.['Paris']).toBe('p2');
      expect(state.players['p2']!.stationsRemaining).toBe(2);

      // p1 cannot build a station in Paris because p2 already built one there
      expect(
        validateAction(state, 'p1', {
          type: 'BUILD_STATION',
          cityName: 'Paris',
          payment: { BLUE: 1 },
        }).valid
      ).toBe(false);

      // p1 claims Dieppe <-> Paris (length 1) so p1 owns London-Dieppe AND Dieppe-Paris
      const dieppeParis = state.routes.find(
        (r) =>
          (r.from === 'Dieppe' && r.to === 'Paris') ||
          (r.from === 'Paris' && r.to === 'Dieppe')
      )!;
      state = applyAction(state, 'p1', {
        type: 'CLAIM_ROUTE',
        routeId: dieppeParis.id,
        payment: { LOCOMOTIVE: 1 },
      });

      // p2 builds 2nd station in Dieppe for 2 cards of same color (BLACK: 2)
      state = applyAction(state, 'p2', {
        type: 'BUILD_STATION',
        cityName: 'Dieppe',
        payment: { BLACK: 2 },
      });
      expect(state.stations?.['Dieppe']).toBe('p2');
      expect(state.players['p2']!.stationsRemaining).toBe(1);

      // 3. End-game scoring with Stations:
      // - p2 owns NO routes directly, but has built Stations in Paris and Dieppe (1 unused station left = +4 pts).
      // - Using the Paris station (borrows p1's Paris-Dieppe route) and Dieppe station (borrows p1's Dieppe-London route),
      //   p2 completes a London -> Paris ticket worth 7 points!
      // - p1 has 3 unused stations (+12 pts) + 10 pts Longest Path.
      const endState: GameState = {
        ...state,
        players: {
          ...state.players,
          p1: {
            ...state.players['p1']!,
            claimedRoutePoints: 3,
            tickets: [],
          },
          p2: {
            ...state.players['p2']!,
            claimedRoutePoints: 0,
            tickets: [{ id: 'EU_TEST', from: 'London', to: 'Paris', points: 7 }],
          },
        },
      };

      const finalScores = calculateFinalScores(endState);
      // p1: 3 (routes) + 12 (3 unused stations * 4) + 10 (longest path) = 25
      expect(finalScores['p1']).toBe(25);
      // p2: 0 (routes) + 7 (completed London->Paris via borrowed station routes) + 4 (1 unused station * 4) = 11
      expect(finalScores['p2']).toBe(11);
    });

    it('filters Ticket to Ride expansions by map compatibility (USA vs EUROPE)', () => {
      const ttrDef = GAME_CATALOG_BY_ID.ttr;
      const otherExpansions = ttrDef.expansions.filter(
        (exp) => exp.id !== 'europe_map'
      );

      const usaCompatible = otherExpansions
        .filter((exp) => isExpansionCompatibleWithMap(exp, 'USA'))
        .map((exp) => exp.id);
      const europeCompatible = otherExpansions
        .filter((exp) => isExpansionCompatibleWithMap(exp, 'EUROPE'))
        .map((exp) => exp.id);

      // North America (Base Map) supports both Alvin & Dexter and USA 1910 Mystery Train
      expect(usaCompatible).toContain('alvin_and_dexter');
      expect(usaCompatible).toContain('1910_mystery_train');

      // Europe Map only supports Alvin & Dexter (not USA 1910)
      expect(europeCompatible).toContain('alvin_and_dexter');
      expect(europeCompatible).not.toContain('1910_mystery_train');
    });
  });

  // ---------------------------------------------------------------------------
  // 14. Kings Corners 0.00d: Swapped Card Highlighting, Deck Exhaustion & Dev Sandbox All-Games Check
  // ---------------------------------------------------------------------------
  describe('Kings Corners 0.00d Updates & Dev Sandbox All-Games Integration', () => {
    it('highlights swapped card slot in opponent mini displays and ends the hand when the draw deck is exhausted without reshuffling', () => {
      const kcEngine = GameRegistry.kings_corners;
      const deck = createStandardDeck();
      const cardById = (id: string) => deck.find((c) => c.id === id)!;

      let state = kcEngine.initGame(['p1', 'p2'], 404) as KingsCornersGameState;
      // Finish initial peek for both players
      state = kcEngine.applyAction(state, 'p1', {
        type: 'KC_PEEK_CARDS',
        row: 'TOP',
      }) as KingsCornersGameState;
      state = kcEngine.applyAction(state, 'p2', {
        type: 'KC_PEEK_CARDS',
        row: 'BOTTOM',
      }) as KingsCornersGameState;
      state = kcEngine.applyAction(state, 'p1', {
        type: 'KC_FINISH_PEEK',
      }) as KingsCornersGameState;
      state = kcEngine.applyAction(state, 'p2', {
        type: 'KC_FINISH_PEEK',
      }) as KingsCornersGameState;

      // Active player is p2 (clockwise from dealer p1)
      expect(state.playerOrder[state.activePlayerIndex]).toBe('p2');

      // 1. p2 takes the top discard and swaps it into slot #2 (Bottom-Left)
      state = kcEngine.applyAction(state, 'p2', {
        type: 'KC_TAKE_DISCARD',
        replaceSlotIndex: 2,
      }) as KingsCornersGameState;

      expect(state.players['p2']!.lastSwappedSlot).toBe(2);
      expect(state.lastSwappedMove).toEqual({
        playerId: 'p2',
        slotIndex: 2,
      });

      // Verify p1's sanitized view exposes p2's lastSwappedSlot so p2's mini display highlights slot #2
      const p1Perspective = kcEngine.getPlayerPerspective(state, 'p1');
      if (p1Perspective.gameId === 'kings_corners') {
        expect(p1Perspective.opponents['p2']!.lastSwappedSlot).toBe(2);
        expect(p1Perspective.lastSwappedMove).toEqual({
          playerId: 'p2',
          slotIndex: 2,
        });
      }

      // 2. Set drawPile to have only 1 card left and multiple cards in discardPile.
      // When p1 draws that last card and resolves their turn, the hand must end immediately WITHOUT reshuffling!
      state = {
        ...state,
        drawPile: [cardById('KH')],
        discardPile: [cardById('2C'), cardById('3D'), cardById('4S')],
      };

      state = kcEngine.applyAction(state, 'p1', {
        type: 'KC_DRAW_DECK',
      }) as KingsCornersGameState;
      expect(state.turnStep).toBe('DECIDING_DRAWN_CARD');
      expect(state.drawPile).toHaveLength(0);

      // p1 swaps the drawn King into slot #0 -> drawPile is now exhausted, so hand ends immediately!
      state = kcEngine.applyAction(state, 'p1', {
        type: 'KC_USE_DRAWN',
        replaceSlotIndex: 0,
      }) as KingsCornersGameState;

      expect(state.turnStep).toBe('HAND_OVER');
      expect(state.drawPile).toHaveLength(0);
      expect(state.lastHandSummary?.endedByDeckExhausted).toBe(true);
    });

    it('initializes and computes sanitized perspectives and live scores for every game in the Dev Sandbox catalog', () => {
      for (const meta of [...BOARD_GAMES_CATALOG, ...CARD_GAMES_CATALOG]) {
        const engine = GameRegistry[meta.id];
        const playerIds = Array.from(
          { length: meta.minPlayers },
          (_, i) => `Player_${i + 1}`
        );
        const state = engine.initGame(playerIds, 20261107, {
          selectedExpansions: [],
        });
        const stateGameId: GameId =
          'gameId' in state ? (state.gameId as GameId) : 'ttr';
        expect(stateGameId).toBe(meta.id);

        const view = GameRegistry[stateGameId].getPlayerPerspective(
          state,
          playerIds[0]!
        );
        expect(view.self.id).toBe(playerIds[0]);

        const scores = GameRegistry[stateGameId].calculateFinalScores(state);
        expect(Object.keys(scores)).toHaveLength(meta.minPlayers);
      }
    });
  });
});


