import { Graph } from '../../common/graph.js';
import { Deck } from '../../mechanics/deck.js';
import {
  ALL_TRAIN_CARD_COLORS,
  createEmptyHand,
  createStandardTrainDeckCards,
  FACE_UP_SLOTS,
  INITIAL_HAND_SIZE,
  INITIAL_MIN_TICKETS_TO_KEEP,
  INITIAL_TICKETS_DEALT,
  INITIAL_TRAINS_PER_PLAYER,
  ROUTE_SCORE_TABLE,
  STANDARD_BOARD_ROUTES,
  STANDARD_DESTINATION_TICKETS,
  TURN_MIN_TICKETS_TO_KEEP,
  TURN_TICKETS_DEALT,
} from './constants.js';
import {
  Action,
  ClaimRouteAction,
  DestinationTicket,
  DrawCardsAction,
  GameState,
  HandCounts,
  KeepTicketsAction,
  PlayerState,
  RouteEdge,
  SanitizedGameState,
  SanitizedOpponentState,
  TrainCardColor,
  ValidationResult,
} from './types.js';

// --- Internal Pure Helpers ---

function addCardsToHand(
  hand: HandCounts,
  cards: readonly TrainCardColor[]
): HandCounts {
  const next = { ...hand };
  for (const c of cards) {
    next[c] = (next[c] ?? 0) + 1;
  }
  return next;
}

function getTotalCardsInHand(hand: HandCounts): number {
  let sum = 0;
  for (const color of ALL_TRAIN_CARD_COLORS) {
    sum += hand[color];
  }
  return sum;
}

/**
 * Refills empty face-up card slots from the train deck and checks the "3 locomotives"
 * rule: if 3 or more face-up cards are LOCOMOTIVE, all 5 are discarded and replaced
 * (up to a bounded safety limit to prevent infinite loops if the remaining deck is mostly locomotives).
 */
function replenishFaceUpCards(
  currentFaceUp: readonly (TrainCardColor | null)[],
  deck: Deck<TrainCardColor>
): (TrainCardColor | null)[] {
  const slots: (TrainCardColor | null)[] = [...currentFaceUp];

  const fillEmptySlots = () => {
    for (let i = 0; i < FACE_UP_SLOTS; i++) {
      if (slots[i] === null && deck.totalAvailable > 0) {
        const drawn = deck.draw(1);
        slots[i] = drawn[0] ?? null;
      }
    }
  };

  fillEmptySlots();

  let wipeAttempts = 0;
  while (wipeAttempts < 5) {
    const locoCount = slots.filter((c) => c === 'LOCOMOTIVE').length;
    if (locoCount < 3) {
      break;
    }

    // Check if there are enough non-locomotive cards across deck + discard + faceUp to ever have < 3 locomotives
    const activeCards = slots.filter((c): c is TrainCardColor => c !== null);
    const totalNonLocoAvailable =
      activeCards.filter((c) => c !== 'LOCOMOTIVE').length +
      deck.drawPile.filter((c) => c !== 'LOCOMOTIVE').length +
      deck.discardPile.filter((c) => c !== 'LOCOMOTIVE').length;

    if (totalNonLocoAvailable < 3) {
      break;
    }

    // Discard all face-up cards and redraw 5
    deck.discard(activeCards);
    for (let i = 0; i < FACE_UP_SLOTS; i++) {
      slots[i] = null;
    }
    fillEmptySlots();
    wipeAttempts++;
  }

  return slots;
}

function canDrawReplacementCard(state: GameState): boolean {
  const deckAvailable =
    state.trainDeck.drawPile.length + state.trainDeck.discardPile.length > 0;
  if (deckAvailable) {
    return true;
  }
  return state.faceUpCards.some((c) => c !== null && c !== 'LOCOMOTIVE');
}

function advanceTurn(state: GameState): GameState {
  const currentPlayerId = state.playerOrder[state.activePlayerIndex]!;
  const currentPlayer = state.players[currentPlayerId]!;

  let nextPhase = state.phase;
  let finalRoundTriggeredBy = state.finalRoundTriggeredBy;
  let turnsRemaining = state.turnsRemainingInFinalRound;

  if (state.phase === 'PLAYING') {
    if (currentPlayer.trainsRemaining <= 2) {
      nextPhase = 'FINAL_ROUND';
      finalRoundTriggeredBy = currentPlayerId;
      // Every player (including the triggering player) gets 1 final turn
      turnsRemaining = state.playerOrder.length;
    }
  } else if (state.phase === 'FINAL_ROUND') {
    turnsRemaining = state.turnsRemainingInFinalRound - 1;
    if (turnsRemaining <= 0) {
      return {
        ...state,
        phase: 'GAME_OVER',
        turnStep: 'AWAITING_ACTION',
        turnsRemainingInFinalRound: 0,
      };
    }
  }

  const nextPlayerIndex =
    (state.activePlayerIndex + 1) % state.playerOrder.length;

  return {
    ...state,
    phase: nextPhase,
    activePlayerIndex: nextPlayerIndex,
    turnStep: 'AWAITING_ACTION',
    finalRoundTriggeredBy,
    turnsRemainingInFinalRound: turnsRemaining,
    turnNumber: state.turnNumber + 1,
  };
}

// --- Public Authoritative Engine API ---

export interface InitGameOptions {
  /**
   * If true, deals initial destination tickets directly into each player's active
   * `tickets` list and begins in the `'PLAYING'` phase immediately.
   * Defaults to `false` so every player starts in `'INITIAL_TICKET_SELECTION'`
   * and chooses at least 2 of their 3 initial Destination Tickets.
   */
  readonly skipInitialTicketSelection?: boolean;
  readonly customRoutes?: readonly RouteEdge[];
  readonly customTickets?: readonly DestinationTicket[];
}

/**
 * Initializes a deterministic Ticket to Ride game state for 2 to 5 players.
 */
export function initGame(
  playerIds: string[],
  seed: number,
  options: InitGameOptions = {}
): GameState {
  if (playerIds.length < 2 || playerIds.length > 5) {
    throw new Error(
      `Ticket to Ride requires between 2 and 5 players (received ${playerIds.length}).`
    );
  }
  const uniqueIds = new Set(playerIds);
  if (uniqueIds.size !== playerIds.length) {
    throw new Error('Player IDs must be unique.');
  }

  const trainDeck = new Deck<TrainCardColor>(
    createStandardTrainDeckCards(),
    seed
  );
  // Derive a distinct deterministic seed for the ticket deck
  const ticketSeed = (seed ^ 0x9e3779b9) >>> 0;
  const ticketDeck = new Deck<DestinationTicket>(
    options.customTickets ?? STANDARD_DESTINATION_TICKETS,
    ticketSeed
  );

  const skipInitialSelection = options.skipInitialTicketSelection ?? false;
  const players: Record<string, PlayerState> = {};

  for (const playerId of playerIds) {
    const initialCards = trainDeck.draw(INITIAL_HAND_SIZE, true);
    const dealtTickets = ticketDeck.draw(INITIAL_TICKETS_DEALT, true);

    players[playerId] = {
      id: playerId,
      hand: addCardsToHand(createEmptyHand(), initialCards),
      tickets: skipInitialSelection ? dealtTickets : [],
      pendingTickets: skipInitialSelection ? [] : dealtTickets,
      minTicketsToKeep: skipInitialSelection ? 0 : INITIAL_MIN_TICKETS_TO_KEEP,
      trainsRemaining: INITIAL_TRAINS_PER_PLAYER,
      claimedRoutePoints: 0,
    };
  }

  const initialFaceUp: (TrainCardColor | null)[] = [
    null,
    null,
    null,
    null,
    null,
  ];
  const faceUpCards = replenishFaceUpCards(initialFaceUp, trainDeck);

  const routes: RouteEdge[] = (
    options.customRoutes ?? STANDARD_BOARD_ROUTES
  ).map((route) => ({
    ...route,
  }));

  return {
    phase: skipInitialSelection ? 'PLAYING' : 'INITIAL_TICKET_SELECTION',
    playerOrder: [...playerIds],
    activePlayerIndex: 0,
    turnStep: skipInitialSelection ? 'AWAITING_ACTION' : 'CHOOSING_TICKETS',
    players,
    routes,
    faceUpCards,
    trainDeck: trainDeck.toState(),
    ticketDeck: ticketDeck.toState(),
    finalRoundTriggeredBy: null,
    turnsRemainingInFinalRound: 0,
    turnNumber: 1,
  };
}

/**
 * Validates whether `playerId` can legally execute `action` in `state`.
 */
export function validateAction(
  state: GameState,
  playerId: string,
  action: Action
): ValidationResult {
  if (state.phase === 'GAME_OVER') {
    return { valid: false, reason: 'The game is already over.' };
  }

  const player = state.players[playerId];
  if (!player) {
    return { valid: false, reason: `Unknown player ID: ${playerId}.` };
  }

  // Handle INITIAL_TICKET_SELECTION phase (all players choose simultaneously or in order)
  if (state.phase === 'INITIAL_TICKET_SELECTION') {
    if (action.type !== 'KEEP_TICKETS') {
      return {
        valid: false,
        reason: 'Must complete initial destination ticket selection first.',
      };
    }
    return validateKeepTickets(player, action);
  }

  // In PLAYING or FINAL_ROUND, strictly enforce turn order
  const activePlayerId = state.playerOrder[state.activePlayerIndex];
  if (playerId !== activePlayerId) {
    return {
      valid: false,
      reason: `Out of turn: expected ${activePlayerId}, but ${playerId} attempted to act.`,
    };
  }

  switch (action.type) {
    case 'DRAW_CARDS':
      return validateDrawCard(state, action);
    case 'CLAIM_ROUTE':
      return validateClaimRoute(state, player, action);
    case 'DRAW_TICKETS':
      return validateDrawTickets(state);
    case 'KEEP_TICKETS':
      if (state.turnStep !== 'CHOOSING_TICKETS') {
        return {
          valid: false,
          reason: 'No pending destination tickets to choose from.',
        };
      }
      return validateKeepTickets(player, action);
    default: {
      const _exhaustive: never = action;
      return {
        valid: false,
        reason: `Unsupported action: ${JSON.stringify(_exhaustive)}`,
      };
    }
  }
}

function validateDrawCard(
  state: GameState,
  action: DrawCardsAction
): ValidationResult {
  if (
    state.turnStep !== 'AWAITING_ACTION' &&
    state.turnStep !== 'DREW_ONE_CARD'
  ) {
    return {
      valid: false,
      reason: `Cannot draw train cards during turn step ${state.turnStep}.`,
    };
  }

  if (action.source === 'DECK') {
    const availableInDeck =
      state.trainDeck.drawPile.length + state.trainDeck.discardPile.length;
    if (availableInDeck === 0) {
      return {
        valid: false,
        reason: 'Both the train draw pile and discard pile are empty.',
      };
    }
    return { valid: true };
  }

  if (action.source === 'FACE_UP') {
    if (
      !Number.isInteger(action.slotIndex) ||
      action.slotIndex < 0 ||
      action.slotIndex >= FACE_UP_SLOTS
    ) {
      return {
        valid: false,
        reason: `Invalid face-up slot index: ${action.slotIndex}.`,
      };
    }
    const card = state.faceUpCards[action.slotIndex];
    if (!card) {
      return {
        valid: false,
        reason: `Face-up slot ${action.slotIndex} is empty.`,
      };
    }
    if (state.turnStep === 'DREW_ONE_CARD' && card === 'LOCOMOTIVE') {
      return {
        valid: false,
        reason:
          'Cannot take a face-up Locomotive as the second card of your turn.',
      };
    }
    return { valid: true };
  }

  return { valid: false, reason: 'Invalid draw source.' };
}

function validateClaimRoute(
  state: GameState,
  player: PlayerState,
  action: ClaimRouteAction
): ValidationResult {
  if (state.turnStep !== 'AWAITING_ACTION') {
    return {
      valid: false,
      reason: `Cannot claim a route during turn step ${state.turnStep}.`,
    };
  }

  const route = state.routes.find((r) => r.id === action.routeId);
  if (!route) {
    return { valid: false, reason: `Route ${action.routeId} does not exist.` };
  }

  if (route.ownerId !== null) {
    return {
      valid: false,
      reason: `Route ${action.routeId} is already claimed by ${route.ownerId}.`,
    };
  }

  // Check sibling double-route rules:
  // 1) A single player can NEVER claim both parallel routes between the same two cities.
  // 2) In 2- or 3-player games, once one route of a double-route is claimed by ANY player, the sibling route is locked.
  const siblingRoutes = state.routes.filter(
    (r) =>
      r.id !== route.id &&
      ((r.from === route.from && r.to === route.to) ||
        (r.from === route.to && r.to === route.from))
  );

  for (const sibling of siblingRoutes) {
    if (sibling.ownerId === player.id) {
      return {
        valid: false,
        reason:
          'A player cannot claim both parallel routes between the same two cities.',
      };
    }
    if (state.playerOrder.length <= 3 && sibling.ownerId !== null) {
      return {
        valid: false,
        reason:
          'In 2-3 player games, only one of the double routes between two cities may be claimed.',
      };
    }
  }

  if (player.trainsRemaining < route.length) {
    return {
      valid: false,
      reason: `Insufficient train cars: route requires ${route.length}, player has ${player.trainsRemaining}.`,
    };
  }

  // Validate payment entries
  let totalPaid = 0;
  const nonLocoColorsUsed: TrainCardColor[] = [];

  for (const color of ALL_TRAIN_CARD_COLORS) {
    const count = action.payment[color] ?? 0;
    if (!Number.isInteger(count) || count < 0) {
      return {
        valid: false,
        reason: `Invalid card count (${count}) for color ${color}.`,
      };
    }
    if (count > 0) {
      if (player.hand[color] < count) {
        return {
          valid: false,
          reason: `Insufficient ${color} cards in hand: payment specifies ${count}, player has ${player.hand[color]}.`,
        };
      }
      totalPaid += count;
      if (color !== 'LOCOMOTIVE') {
        nonLocoColorsUsed.push(color);
      }
    }
  }

  if (totalPaid !== route.length) {
    return {
      valid: false,
      reason: `Payment total (${totalPaid}) must exactly match route length (${route.length}).`,
    };
  }

  if (route.color === 'GRAY') {
    if (nonLocoColorsUsed.length > 1) {
      return {
        valid: false,
        reason: `Gray routes must be claimed using a single non-locomotive color (plus optional locomotives), but received multiple colors: ${nonLocoColorsUsed.join(', ')}.`,
      };
    }
  } else {
    if (
      nonLocoColorsUsed.length > 1 ||
      (nonLocoColorsUsed.length === 1 && nonLocoColorsUsed[0] !== route.color)
    ) {
      return {
        valid: false,
        reason: `Route requires ${route.color} cards (or locomotives), but payment included ${nonLocoColorsUsed.join(', ')}.`,
      };
    }
  }

  return { valid: true };
}

function validateDrawTickets(state: GameState): ValidationResult {
  if (state.turnStep !== 'AWAITING_ACTION') {
    return {
      valid: false,
      reason: `Cannot draw destination tickets during turn step ${state.turnStep}.`,
    };
  }

  if (state.ticketDeck.drawPile.length === 0) {
    return {
      valid: false,
      reason: 'The Destination Ticket deck is empty.',
    };
  }

  return { valid: true };
}

function validateKeepTickets(
  player: PlayerState,
  action: KeepTicketsAction
): ValidationResult {
  if (player.pendingTickets.length === 0) {
    return {
      valid: false,
      reason: 'Player has no pending tickets to choose from.',
    };
  }

  const uniqueChosen = new Set(action.ticketIds);
  if (uniqueChosen.size !== action.ticketIds.length) {
    return {
      valid: false,
      reason: 'Duplicate ticket IDs in selection.',
    };
  }

  const requiredMin = Math.min(
    player.minTicketsToKeep,
    player.pendingTickets.length
  );
  if (action.ticketIds.length < requiredMin) {
    return {
      valid: false,
      reason: `Must keep at least ${requiredMin} destination ticket(s), but only selected ${action.ticketIds.length}.`,
    };
  }

  const pendingIds = new Set(player.pendingTickets.map((t) => t.id));
  for (const id of action.ticketIds) {
    if (!pendingIds.has(id)) {
      return {
        valid: false,
        reason: `Ticket ${id} is not in player's pending tickets.`,
      };
    }
  }

  return { valid: true };
}

/**
 * Pure authoritative state reducer: validates `action` and returns a brand-new `GameState`.
 * Throws a descriptive Error if the action is invalid.
 */
export function applyAction(
  state: GameState,
  playerId: string,
  action: Action
): GameState {
  const validation = validateAction(state, playerId, action);
  if (!validation.valid) {
    throw new Error(`Invalid action: ${validation.reason}`);
  }

  const player = state.players[playerId]!;

  switch (action.type) {
    case 'DRAW_CARDS': {
      const trainDeck = Deck.fromState(state.trainDeck);
      let nextFaceUp = [...state.faceUpCards];
      let drawnCard: TrainCardColor;
      let tookFaceUpLocomotive = false;

      if (action.source === 'DECK') {
        const drawn = trainDeck.draw(1, true);
        drawnCard = drawn[0]!;
        // If any face-up slots were previously empty and cards were reshuffled, replenish
        nextFaceUp = replenishFaceUpCards(nextFaceUp, trainDeck);
      } else {
        drawnCard = nextFaceUp[action.slotIndex]!;
        tookFaceUpLocomotive = drawnCard === 'LOCOMOTIVE';
        nextFaceUp[action.slotIndex] = null;
        nextFaceUp = replenishFaceUpCards(nextFaceUp, trainDeck);
      }

      const updatedPlayer: PlayerState = {
        ...player,
        hand: addCardsToHand(player.hand, [drawnCard]),
      };

      const intermediateState: GameState = {
        ...state,
        players: {
          ...state.players,
          [playerId]: updatedPlayer,
        },
        faceUpCards: nextFaceUp,
        trainDeck: trainDeck.toState(),
      };

      // A face-up Locomotive costs both card draws; or if this was already the 2nd draw, end turn.
      // Also end turn if no legal second card exists anywhere to be drawn.
      if (
        state.turnStep === 'DREW_ONE_CARD' ||
        tookFaceUpLocomotive ||
        !canDrawReplacementCard(intermediateState)
      ) {
        return advanceTurn(intermediateState);
      }

      return {
        ...intermediateState,
        turnStep: 'DREW_ONE_CARD',
      };
    }

    case 'CLAIM_ROUTE': {
      const route = state.routes.find((r) => r.id === action.routeId)!;
      const trainDeck = Deck.fromState(state.trainDeck);

      const nextHand = { ...player.hand };
      const discardedCards: TrainCardColor[] = [];

      for (const color of ALL_TRAIN_CARD_COLORS) {
        const count = action.payment[color] ?? 0;
        if (count > 0) {
          nextHand[color] -= count;
          for (let i = 0; i < count; i++) {
            discardedCards.push(color);
          }
        }
      }

      trainDeck.discard(discardedCards);
      const nextFaceUp = replenishFaceUpCards(state.faceUpCards, trainDeck);

      const routePoints = ROUTE_SCORE_TABLE[route.length] ?? 0;
      const updatedPlayer: PlayerState = {
        ...player,
        hand: nextHand,
        trainsRemaining: player.trainsRemaining - route.length,
        claimedRoutePoints: player.claimedRoutePoints + routePoints,
      };

      const updatedRoutes = state.routes.map((r) =>
        r.id === route.id ? { ...r, ownerId: playerId } : r
      );

      const nextState: GameState = {
        ...state,
        players: {
          ...state.players,
          [playerId]: updatedPlayer,
        },
        routes: updatedRoutes,
        faceUpCards: nextFaceUp,
        trainDeck: trainDeck.toState(),
      };

      return advanceTurn(nextState);
    }

    case 'DRAW_TICKETS': {
      const ticketDeck = Deck.fromState(state.ticketDeck);
      const drawnTickets = ticketDeck.draw(TURN_TICKETS_DEALT, false);

      const updatedPlayer: PlayerState = {
        ...player,
        pendingTickets: drawnTickets,
        minTicketsToKeep: Math.min(
          TURN_MIN_TICKETS_TO_KEEP,
          drawnTickets.length
        ),
      };

      return {
        ...state,
        turnStep: 'CHOOSING_TICKETS',
        players: {
          ...state.players,
          [playerId]: updatedPlayer,
        },
        ticketDeck: ticketDeck.toState(),
      };
    }

    case 'KEEP_TICKETS': {
      const chosenSet = new Set(action.ticketIds);
      const keptTickets = player.pendingTickets.filter((t) =>
        chosenSet.has(t.id)
      );
      const returnedTickets = player.pendingTickets.filter(
        (t) => !chosenSet.has(t.id)
      );

      const ticketDeck = Deck.fromState(state.ticketDeck);
      if (returnedTickets.length > 0) {
        ticketDeck.putOnBottom(returnedTickets);
      }

      const updatedPlayer: PlayerState = {
        ...player,
        tickets: [...player.tickets, ...keptTickets],
        pendingTickets: [],
        minTicketsToKeep: 0,
      };

      const nextPlayers = {
        ...state.players,
        [playerId]: updatedPlayer,
      };

      if (state.phase === 'INITIAL_TICKET_SELECTION') {
        const nextPendingPlayerIndex = state.playerOrder.findIndex(
          (id) => nextPlayers[id]!.pendingTickets.length > 0
        );
        const allReady = nextPendingPlayerIndex === -1;
        return {
          ...state,
          phase: allReady ? 'PLAYING' : 'INITIAL_TICKET_SELECTION',
          activePlayerIndex: allReady ? 0 : nextPendingPlayerIndex,
          turnStep: allReady ? 'AWAITING_ACTION' : 'CHOOSING_TICKETS',
          players: nextPlayers,
          ticketDeck: ticketDeck.toState(),
        };
      }

      const nextState: GameState = {
        ...state,
        players: nextPlayers,
        ticketDeck: ticketDeck.toState(),
      };

      return advanceTurn(nextState);
    }
  }
}

/**
 * Strips hidden information (opponent hand card colors, opponent destination tickets,
 * and draw/discard pile card sequences) to produce a safe client payload for `playerId`.
 */
export function getPlayerPerspective(
  state: GameState,
  playerId: string
): SanitizedGameState {
  const self = state.players[playerId];
  if (!self) {
    throw new Error(`Player ${playerId} does not exist in game state.`);
  }

  const opponents: Record<string, SanitizedOpponentState> = {};
  for (const id of state.playerOrder) {
    if (id === playerId) {
      continue;
    }
    const opp = state.players[id]!;
    opponents[id] = {
      id: opp.id,
      handCount: getTotalCardsInHand(opp.hand),
      ticketCount: opp.tickets.length,
      pendingTicketCount: opp.pendingTickets.length,
      trainsRemaining: opp.trainsRemaining,
      claimedRoutePoints: opp.claimedRoutePoints,
    };
  }

  return {
    phase: state.phase,
    playerOrder: [...state.playerOrder],
    activePlayerId: state.playerOrder[state.activePlayerIndex]!,
    turnStep: state.turnStep,
    self: {
      ...self,
      hand: { ...self.hand },
      tickets: [...self.tickets],
      pendingTickets: [...self.pendingTickets],
    },
    opponents,
    routes: state.routes.map((r) => ({ ...r })),
    faceUpCards: [...state.faceUpCards],
    trainDeckCount: state.trainDeck.drawPile.length,
    trainDiscardCount: state.trainDeck.discardPile.length,
    ticketDeckCount: state.ticketDeck.drawPile.length,
    finalRoundTriggeredBy: state.finalRoundTriggeredBy,
    turnsRemainingInFinalRound: state.turnsRemainingInFinalRound,
    turnNumber: state.turnNumber,
  };
}

/**
 * Calculates final scores for all players:
 * - Sum of claimed route points
 * - Plus points for each completed Destination Ticket (verified via Graph connectivity)
 * - Minus points for each uncompleted Destination Ticket
 */
export function calculateFinalScores(
  state: GameState
): Record<string, number> {
  const scores: Record<string, number> = {};

  for (const playerId of state.playerOrder) {
    const player = state.players[playerId]!;

    // Build a player-specific Graph from all routes claimed by this player
    const playerGraph = new Graph<RouteEdge>();
    for (const route of state.routes) {
      if (route.ownerId === playerId) {
        playerGraph.addEdge(route.from, route.to, route.length, route);
      }
    }

    let totalScore = player.claimedRoutePoints;

    for (const ticket of player.tickets) {
      const completed = playerGraph.isConnected(ticket.from, ticket.to);
      if (completed) {
        totalScore += ticket.points;
      } else {
        totalScore -= ticket.points;
      }
    }

    scores[playerId] = totalScore;
  }

  return scores;
}

