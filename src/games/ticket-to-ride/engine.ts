import { Graph } from '../../common/graph.js';
import { Deck } from '../../mechanics/deck.js';
import {
  ALL_TRAIN_CARD_COLORS,
  createEmptyHand,
  createStandardTrainDeckCards,
  EUROPE_BOARD_ROUTES,
  EUROPE_LONG_TICKETS,
  EUROPE_REGULAR_TICKETS,
  FACE_UP_SLOTS,
  INITIAL_HAND_SIZE,
  INITIAL_MIN_TICKETS_TO_KEEP,
  INITIAL_STATIONS_PER_PLAYER,
  INITIAL_TICKETS_DEALT,
  INITIAL_TRAINS_PER_PLAYER,
  ROUTE_SCORE_TABLE,
  STANDARD_BOARD_ROUTES,
  STANDARD_DESTINATION_TICKETS,
  TURN_MIN_TICKETS_TO_KEEP,
  TURN_TICKETS_DEALT,
  UNUSED_STATION_POINTS,
} from './constants.js';
import {
  Action,
  AlvinAndDexterState,
  BuildStationAction,
  ClaimRouteAction,
  DestinationTicket,
  DrawCardsAction,
  GameState,
  HandCounts,
  KeepTicketsAction,
  MoveMonsterAction,
  PlaceMonsterAction,
  PlayerState,
  RouteEdge,
  SanitizedGameState,
  SanitizedOpponentState,
  TrainCardColor,
  TTRMapId,
  ValidationResult,
} from './types.js';

export const INITIAL_MONSTER_DECK_SIZE = 20;
export const ALVIN_BONUS_POINTS = 15;
export const DEXTER_BONUS_POINTS = 15;

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
 * Returns all unique city names present in the route network, sorted alphabetically.
 */
export function getAllBoardCities(routes: readonly RouteEdge[]): string[] {
  const cities = new Set<string>();
  for (const r of routes) {
    cities.add(r.from);
    cities.add(r.to);
  }
  return Array.from(cities).sort();
}

/**
 * Computes all valid destination cities a monster can move to from `startCity`:
 * - `locomotivesSpent === 1`: cities at 1 to 3 city hops away
 * - `locomotivesSpent === 2`: cities at 4 to 6 city hops away
 * A monster cannot end its move on `startCity` or on `otherMonsterCity`.
 */
export function getReachableMonsterCities(
  routes: readonly RouteEdge[],
  startCity: string,
  otherMonsterCity: string | null,
  locomotivesSpent: 1 | 2
): string[] {
  const adj = new Map<string, Set<string>>();
  for (const r of routes) {
    if (!adj.has(r.from)) {
      adj.set(r.from, new Set());
    }
    if (!adj.has(r.to)) {
      adj.set(r.to, new Set());
    }
    adj.get(r.from)!.add(r.to);
    adj.get(r.to)!.add(r.from);
  }

  if (!adj.has(startCity)) {
    return [];
  }

  const minSteps = locomotivesSpent === 1 ? 1 : 4;
  const maxSteps = locomotivesSpent === 1 ? 3 : 6;

  // BFS for shortest-path city hop distances
  const dist = new Map<string, number>();
  const queue: string[] = [startCity];
  dist.set(startCity, 0);

  while (queue.length > 0) {
    const curr = queue.shift()!;
    const d = dist.get(curr)!;
    if (d >= maxSteps) {
      continue;
    }
    for (const neighbor of adj.get(curr) ?? []) {
      if (!dist.has(neighbor)) {
        dist.set(neighbor, d + 1);
        queue.push(neighbor);
      }
    }
  }

  const reachable: string[] = [];
  for (const [city, d] of dist.entries()) {
    if (
      d >= minSteps &&
      d <= maxSteps &&
      city !== startCity &&
      city !== otherMonsterCity
    ) {
      reachable.push(city);
    }
  }

  return reachable.sort();
}

/**
 * Checks whether `cityName` currently has Alvin or Dexter in it ("City in Chaos").
 */
export function isCityInChaos(
  state: Pick<GameState, 'alvinAndDexter'>,
  cityName: string
): boolean {
  if (!state.alvinAndDexter?.enabled) {
    return false;
  }
  return (
    state.alvinAndDexter.alvinCity === cityName ||
    state.alvinAndDexter.dexterCity === cityName
  );
}

/**
 * Calculates the end-of-game point value of a Destination Ticket.
 * Any ticket whose `from` or `to` city is a "City in Chaos" at the end of the game
 * is worth half its normal point value rounded down (both when completed and when uncompleted).
 */
export function getEffectiveTicketPoints(
  ticket: DestinationTicket,
  state: Pick<GameState, 'alvinAndDexter'>
): { readonly points: number; readonly isChaosHalved: boolean } {
  const inChaos =
    isCityInChaos(state, ticket.from) || isCityInChaos(state, ticket.to);
  if (inChaos) {
    return {
      points: Math.floor(ticket.points / 2),
      isChaosHalved: true,
    };
  }
  return {
    points: ticket.points,
    isChaosHalved: false,
  };
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

    const activeCards = slots.filter((c): c is TrainCardColor => c !== null);
    const totalNonLocoAvailable =
      activeCards.filter((c) => c !== 'LOCOMOTIVE').length +
      deck.drawPile.filter((c) => c !== 'LOCOMOTIVE').length +
      deck.discardPile.filter((c) => c !== 'LOCOMOTIVE').length;

    if (totalNonLocoAvailable < 3) {
      break;
    }

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

  // Decrement face-up monster card timers at the end of this player's turn.
  // A card received on Turn T starts at 2 -> becomes 1 at the end of Turn T -> becomes 0 at the end of Turn T+1.
  const nextFaceUpAlvin = Math.max(
    0,
    (currentPlayer.faceUpAlvinTurnsRemaining ?? 0) - 1
  );
  const nextFaceUpDexter = Math.max(
    0,
    (currentPlayer.faceUpDexterTurnsRemaining ?? 0) - 1
  );

  const updatedPlayers: Record<string, PlayerState> = {
    ...state.players,
    [currentPlayerId]: {
      ...currentPlayer,
      ...(state.alvinAndDexter?.enabled
        ? {
            faceUpAlvinTurnsRemaining: nextFaceUpAlvin,
            faceUpDexterTurnsRemaining: nextFaceUpDexter,
          }
        : {}),
    },
  };

  const resetMonsterTurnState: AlvinAndDexterState | undefined =
    state.alvinAndDexter
      ? {
          ...state.alvinAndDexter,
          movedMonsterThisTurn: false,
        }
      : undefined;

  let nextPhase = state.phase;
  let finalRoundTriggeredBy = state.finalRoundTriggeredBy;
  let turnsRemaining = state.turnsRemainingInFinalRound;

  if (state.phase === 'PLAYING') {
    if (currentPlayer.trainsRemaining <= 2) {
      nextPhase = 'FINAL_ROUND';
      finalRoundTriggeredBy = currentPlayerId;
      turnsRemaining = state.playerOrder.length;
    }
  } else if (state.phase === 'FINAL_ROUND') {
    turnsRemaining = state.turnsRemainingInFinalRound - 1;
    if (turnsRemaining <= 0) {
      return {
        ...state,
        players: updatedPlayers,
        ...(resetMonsterTurnState !== undefined
          ? { alvinAndDexter: resetMonsterTurnState }
          : {}),
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
    players: updatedPlayers,
    ...(resetMonsterTurnState !== undefined
      ? { alvinAndDexter: resetMonsterTurnState }
      : {}),
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
   * `tickets` list and begins in the `'PLAYING'` (or `'MONSTER_PLACEMENT'`) phase immediately.
   */
  readonly skipInitialTicketSelection?: boolean;
  readonly mapId?: TTRMapId;
  readonly customRoutes?: readonly RouteEdge[];
  readonly customTickets?: readonly DestinationTicket[];
  readonly enableAlvinAndDexter?: boolean;
  readonly initialMonsterCities?: {
    readonly alvinCity: string;
    readonly dexterCity: string;
  };
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

  const mapId: TTRMapId = options.mapId ?? 'USA';
  const trainDeck = new Deck<TrainCardColor>(
    createStandardTrainDeckCards(),
    seed
  );
  const ticketSeed = (seed ^ 0x9e3779b9) >>> 0;
  const longTicketSeed = (seed ^ 0x517cc1b7) >>> 0;
  const longTicketDeck =
    mapId === 'EUROPE' && !options.customTickets
      ? new Deck<DestinationTicket>(EUROPE_LONG_TICKETS, longTicketSeed)
      : null;

  const ticketDeck = new Deck<DestinationTicket>(
    options.customTickets ??
      (mapId === 'EUROPE'
        ? EUROPE_REGULAR_TICKETS
        : STANDARD_DESTINATION_TICKETS),
    ticketSeed
  );

  const skipInitialSelection = options.skipInitialTicketSelection ?? false;
  const enableMonsters = options.enableAlvinAndDexter ?? false;
  const players: Record<string, PlayerState> = {};

  for (const playerId of playerIds) {
    const initialCards = trainDeck.draw(INITIAL_HAND_SIZE, true);
    const dealtTickets = longTicketDeck
      ? [...longTicketDeck.draw(1, false), ...ticketDeck.draw(3, true)]
      : ticketDeck.draw(INITIAL_TICKETS_DEALT, true);

    players[playerId] = {
      id: playerId,
      hand: addCardsToHand(createEmptyHand(), initialCards),
      tickets: skipInitialSelection ? dealtTickets : [],
      pendingTickets: skipInitialSelection ? [] : dealtTickets,
      minTicketsToKeep: skipInitialSelection ? 0 : INITIAL_MIN_TICKETS_TO_KEEP,
      trainsRemaining: INITIAL_TRAINS_PER_PLAYER,
      claimedRoutePoints: 0,
      recentDrawnCards: {},
      ...(mapId === 'EUROPE'
        ? { stationsRemaining: INITIAL_STATIONS_PER_PLAYER }
        : {}),
      ...(enableMonsters
        ? {
            alvinCards: 0,
            dexterCards: 0,
            faceUpAlvinTurnsRemaining: 0,
            faceUpDexterTurnsRemaining: 0,
          }
        : {}),
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
    options.customRoutes ??
    (mapId === 'EUROPE' ? EUROPE_BOARD_ROUTES : STANDARD_BOARD_ROUTES)
  ).map((route) => ({
    ...route,
  }));

  const prePlacedMonsters = Boolean(
    enableMonsters &&
      options.initialMonsterCities?.alvinCity &&
      options.initialMonsterCities?.dexterCity
  );

  const alvinAndDexter: AlvinAndDexterState | undefined = enableMonsters
    ? {
        enabled: true,
        alvinCity: options.initialMonsterCities?.alvinCity ?? null,
        dexterCity: options.initialMonsterCities?.dexterCity ?? null,
        alvinDeckRemaining: INITIAL_MONSTER_DECK_SIZE,
        dexterDeckRemaining: INITIAL_MONSTER_DECK_SIZE,
        movedMonsterThisTurn: false,
        monsterToPlace: prePlacedMonsters ? null : 'ALVIN',
      }
    : undefined;

  // Determine initial phase, activePlayerIndex, and turnStep
  let initialPhase: GameState['phase'] = 'INITIAL_TICKET_SELECTION';
  let initialActiveIndex = 0;
  let initialTurnStep: GameState['turnStep'] = 'CHOOSING_TICKETS';
  let initialSummary =
    'Game started! Each player is choosing their initial Destination Tickets.';

  if (skipInitialSelection) {
    if (enableMonsters && !prePlacedMonsters) {
      initialPhase = 'MONSTER_PLACEMENT';
      // Last player in turn order places Alvin first
      initialActiveIndex = playerIds.length - 1;
      initialTurnStep = 'PLACING_MONSTER';
      initialSummary = `${playerIds[initialActiveIndex]} must select the starting city for Alvin (🛸 Flying Saucer).`;
    } else {
      initialPhase = 'PLAYING';
      initialActiveIndex = 0;
      initialTurnStep = 'AWAITING_ACTION';
      initialSummary = 'Game started! Waiting for first player action.';
    }
  }

  return {
    phase: initialPhase,
    playerOrder: [...playerIds],
    activePlayerIndex: initialActiveIndex,
    turnStep: initialTurnStep,
    players,
    routes,
    faceUpCards,
    trainDeck: trainDeck.toState(),
    ticketDeck: ticketDeck.toState(),
    finalRoundTriggeredBy: null,
    turnsRemainingInFinalRound: 0,
    turnNumber: 1,
    lastActionSummary: initialSummary,
    mapId,
    ...(mapId === 'EUROPE' ? { stations: {} } : {}),
    ...(alvinAndDexter !== undefined ? { alvinAndDexter } : {}),
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

  // 1. Handle INITIAL_TICKET_SELECTION phase
  if (state.phase === 'INITIAL_TICKET_SELECTION') {
    if (action.type !== 'KEEP_TICKETS') {
      return {
        valid: false,
        reason: 'Must complete initial destination ticket selection first.',
      };
    }
    return validateKeepTickets(player, action);
  }

  // 2. Handle MONSTER_PLACEMENT setup phase (Alvin & Dexter expansion)
  if (state.phase === 'MONSTER_PLACEMENT') {
    if (action.type !== 'PLACE_MONSTER') {
      return {
        valid: false,
        reason: 'Must place Alvin and Dexter on their starting cities first.',
      };
    }
    return validatePlaceMonster(state, playerId, action);
  }

  // 3. In PLAYING or FINAL_ROUND, strictly enforce turn order
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
    case 'MOVE_MONSTER':
      return validateMoveMonster(state, player, action);
    case 'BUILD_STATION':
      return validateBuildStation(state, player, action);
    case 'PLACE_MONSTER':
      return {
        valid: false,
        reason: 'Monsters have already been placed on the board.',
      };
    default: {
      const _exhaustive: never = action;
      return {
        valid: false,
        reason: `Unsupported action: ${JSON.stringify(_exhaustive)}`,
      };
    }
  }
}

function validateBuildStation(
  state: GameState,
  player: PlayerState,
  action: BuildStationAction
): ValidationResult {
  if (state.mapId !== 'EUROPE') {
    return {
      valid: false,
      reason: 'Train Stations are only available on the Ticket to Ride: Europe map.',
    };
  }

  if (state.turnStep !== 'AWAITING_ACTION') {
    return {
      valid: false,
      reason: `Cannot build a station during turn step ${state.turnStep}.`,
    };
  }

  const remaining = player.stationsRemaining ?? 0;
  if (remaining <= 0) {
    return {
      valid: false,
      reason: 'You have already built all 3 of your Train Stations.',
    };
  }

  const allCities = getAllBoardCities(state.routes);
  if (!allCities.includes(action.cityName)) {
    return {
      valid: false,
      reason: `City "${action.cityName}" does not exist on the board.`,
    };
  }

  const existingOwner = state.stations?.[action.cityName];
  if (existingOwner) {
    return {
      valid: false,
      reason: `${action.cityName} already has a Train Station built by ${existingOwner}.`,
    };
  }

  if (isCityInChaos(state, action.cityName)) {
    return {
      valid: false,
      reason: `Cannot build a Train Station in ${action.cityName} while it is a City in Chaos!`,
    };
  }

  // 1st station costs 1 card, 2nd station costs 2 cards, 3rd station costs 3 cards (all of a single color; Locomotives are wild)
  const requiredCards = INITIAL_STATIONS_PER_PLAYER - remaining + 1;
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

  if (totalPaid !== requiredCards) {
    return {
      valid: false,
      reason: `Building this station requires ${requiredCards} card(s) of a single color, but payment included ${totalPaid}.`,
    };
  }

  if (nonLocoColorsUsed.length > 1) {
    return {
      valid: false,
      reason: `Station payment must use a single color (plus optional Locomotives), but received multiple colors: ${nonLocoColorsUsed.join(', ')}.`,
    };
  }

  return { valid: true };
}

function validatePlaceMonster(
  state: GameState,
  playerId: string,
  action: PlaceMonsterAction
): ValidationResult {
  if (!state.alvinAndDexter?.enabled) {
    return {
      valid: false,
      reason: 'Alvin & Dexter expansion is not enabled in this match.',
    };
  }

  const expectedPlayerId = state.playerOrder[state.activePlayerIndex];
  if (playerId !== expectedPlayerId) {
    return {
      valid: false,
      reason: `Waiting for ${expectedPlayerId} to place ${state.alvinAndDexter.monsterToPlace}.`,
    };
  }

  if (action.monster !== state.alvinAndDexter.monsterToPlace) {
    return {
      valid: false,
      reason: `Expected placement of ${state.alvinAndDexter.monsterToPlace}, but received ${action.monster}.`,
    };
  }

  const allCities = getAllBoardCities(state.routes);
  if (!allCities.includes(action.cityName)) {
    return {
      valid: false,
      reason: `City "${action.cityName}" does not exist on the board.`,
    };
  }

  if (
    action.monster === 'DEXTER' &&
    state.alvinAndDexter.alvinCity === action.cityName
  ) {
    return {
      valid: false,
      reason: `Dexter cannot start in ${action.cityName} because Alvin is already there.`,
    };
  }

  return { valid: true };
}

function validateMoveMonster(
  state: GameState,
  player: PlayerState,
  action: MoveMonsterAction
): ValidationResult {
  const ad = state.alvinAndDexter;
  if (!ad?.enabled) {
    return {
      valid: false,
      reason: 'Alvin & Dexter expansion is not enabled in this match.',
    };
  }

  if (ad.movedMonsterThisTurn) {
    return {
      valid: false,
      reason:
        'You have already moved a monster this turn (cannot move both monsters or move twice during the same turn).',
    };
  }

  if (action.monster !== 'ALVIN' && action.monster !== 'DEXTER') {
    return {
      valid: false,
      reason: `Invalid monster type: ${String(action.monster)}.`,
    };
  }

  if (action.monster === 'ALVIN') {
    if ((player.faceUpAlvinTurnsRemaining ?? 0) > 0) {
      return {
        valid: false,
        reason:
          'You cannot move Alvin while you have a face-up Alvin card in front of you.',
      };
    }
    if (ad.alvinDeckRemaining <= 0) {
      return {
        valid: false,
        reason: 'No Alvin cards remain in the deck; Alvin cannot be moved.',
      };
    }
  } else {
    if ((player.faceUpDexterTurnsRemaining ?? 0) > 0) {
      return {
        valid: false,
        reason:
          'You cannot move Dexter while you have a face-up Dexter card in front of you.',
      };
    }
    if (ad.dexterDeckRemaining <= 0) {
      return {
        valid: false,
        reason: 'No Dexter cards remain in the deck; Dexter cannot be moved.',
      };
    }
  }

  if (action.locomotivesSpent !== 1 && action.locomotivesSpent !== 2) {
    return {
      valid: false,
      reason: 'Must spend either 1 or 2 Locomotives to move a monster.',
    };
  }

  if (player.hand.LOCOMOTIVE < action.locomotivesSpent) {
    return {
      valid: false,
      reason: `Insufficient Locomotives: moving ${action.monster} ${
        action.locomotivesSpent === 1 ? '1–3' : '4–6'
      } cities requires ${action.locomotivesSpent} Locomotive(s), but you have ${
        player.hand.LOCOMOTIVE
      }.`,
    };
  }

  const currentCity =
    action.monster === 'ALVIN' ? ad.alvinCity : ad.dexterCity;
  const otherCity =
    action.monster === 'ALVIN' ? ad.dexterCity : ad.alvinCity;

  if (!currentCity) {
    return {
      valid: false,
      reason: `${action.monster} has not been placed on the board yet.`,
    };
  }

  const reachable = getReachableMonsterCities(
    state.routes,
    currentCity,
    otherCity,
    action.locomotivesSpent
  );

  if (!reachable.includes(action.targetCity)) {
    return {
      valid: false,
      reason: `${action.targetCity} is not ${
        action.locomotivesSpent === 1 ? '1–3' : '4–6'
      } cities away from ${currentCity} (or is occupied by the other monster).`,
    };
  }

  return { valid: true };
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

  // Alvin & Dexter Rule: Any city with Alvin or Dexter in it is a "City in Chaos"
  // and prevents players from claiming routes into or out of that city.
  if (state.alvinAndDexter?.enabled) {
    if (
      route.from === state.alvinAndDexter.alvinCity ||
      route.to === state.alvinAndDexter.alvinCity
    ) {
      return {
        valid: false,
        reason: `Cannot claim ${route.from} ↔ ${route.to}: ${state.alvinAndDexter.alvinCity} is a City in Chaos (occupied by Alvin 🛸)!`,
      };
    }
    if (
      route.from === state.alvinAndDexter.dexterCity ||
      route.to === state.alvinAndDexter.dexterCity
    ) {
      return {
        valid: false,
        reason: `Cannot claim ${route.from} ↔ ${route.to}: ${state.alvinAndDexter.dexterCity} is a City in Chaos (occupied by Dexter 🦖)!`,
      };
    }
  }

  // Check sibling double-route rules:
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

  // Ferry rule (Europe): route requires a minimum number of Locomotives
  if ((route.ferryLocomotives ?? 0) > 0) {
    const locosPaid = action.payment.LOCOMOTIVE ?? 0;
    if (locosPaid < route.ferryLocomotives!) {
      return {
        valid: false,
        reason: `Ferry route ${route.from} ↔ ${route.to} requires at least ${route.ferryLocomotives} Locomotive(s), but payment only included ${locosPaid}.`,
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
    case 'PLACE_MONSTER': {
      const ad = state.alvinAndDexter!;
      if (action.monster === 'ALVIN') {
        // Next, the player who plays just before the last player selects the starting city for Dexter
        const dexterPlayerIndex = Math.max(0, state.playerOrder.length - 2);
        const dexterPlayerId = state.playerOrder[dexterPlayerIndex]!;
        return {
          ...state,
          activePlayerIndex: dexterPlayerIndex,
          turnStep: 'PLACING_MONSTER',
          alvinAndDexter: {
            ...ad,
            alvinCity: action.cityName,
            monsterToPlace: 'DEXTER',
          },
          lastActionSummary: `${playerId} placed Alvin (🛸 Flying Saucer) in ${action.cityName}! Waiting for ${dexterPlayerId} to place Dexter (🦖 T-Rex).`,
        };
      } else {
        // Both monsters placed -> transition to PLAYING with first player (index 0)
        return {
          ...state,
          phase: 'PLAYING',
          activePlayerIndex: 0,
          turnStep: 'AWAITING_ACTION',
          alvinAndDexter: {
            ...ad,
            dexterCity: action.cityName,
            monsterToPlace: null,
          },
          lastActionSummary: `${playerId} placed Dexter (🦖 T-Rex) in ${action.cityName}! Both monsters are on the map — Game on!`,
        };
      }
    }

    case 'MOVE_MONSTER': {
      const ad = state.alvinAndDexter!;
      const trainDeck = Deck.fromState(state.trainDeck);
      const discardedLocos: TrainCardColor[] = Array.from(
        { length: action.locomotivesSpent },
        () => 'LOCOMOTIVE'
      );
      trainDeck.discard(discardedLocos);
      const nextFaceUp = replenishFaceUpCards(state.faceUpCards, trainDeck);

      const nextHand: HandCounts = {
        ...player.hand,
        LOCOMOTIVE: player.hand.LOCOMOTIVE - action.locomotivesSpent,
      };

      const isAlvin = action.monster === 'ALVIN';
      const fromCity = isAlvin ? ad.alvinCity : ad.dexterCity;

      const updatedPlayer: PlayerState = {
        ...player,
        hand: nextHand,
        alvinCards: (player.alvinCards ?? 0) + (isAlvin ? 1 : 0),
        dexterCards: (player.dexterCards ?? 0) + (isAlvin ? 0 : 1),
        // Remains face-up until the end of this player's NEXT turn (2 turn-ends: end of current turn + end of next turn)
        faceUpAlvinTurnsRemaining: isAlvin
          ? 2
          : player.faceUpAlvinTurnsRemaining ?? 0,
        faceUpDexterTurnsRemaining: isAlvin
          ? player.faceUpDexterTurnsRemaining ?? 0
          : 2,
      };

      const updatedAlvinAndDexter: AlvinAndDexterState = {
        ...ad,
        alvinCity: isAlvin ? action.targetCity : ad.alvinCity,
        dexterCity: isAlvin ? ad.dexterCity : action.targetCity,
        alvinDeckRemaining: isAlvin
          ? ad.alvinDeckRemaining - 1
          : ad.alvinDeckRemaining,
        dexterDeckRemaining: isAlvin
          ? ad.dexterDeckRemaining
          : ad.dexterDeckRemaining - 1,
        movedMonsterThisTurn: true,
      };

      return {
        ...state,
        players: {
          ...state.players,
          [playerId]: updatedPlayer,
        },
        faceUpCards: nextFaceUp,
        trainDeck: trainDeck.toState(),
        alvinAndDexter: updatedAlvinAndDexter,
        lastActionSummary: `${playerId} played ${action.locomotivesSpent} Locomotive(s) to move ${
          isAlvin ? 'Alvin 🛸' : 'Dexter 🦖'
        } from ${fromCity} to ${action.targetCity} and claimed a face-up ${
          isAlvin ? 'Alvin' : 'Dexter'
        } card!`,
      };
    }

    case 'DRAW_CARDS': {
      const trainDeck = Deck.fromState(state.trainDeck);
      let nextFaceUp = [...state.faceUpCards];
      let drawnCard: TrainCardColor;
      let tookFaceUpLocomotive = false;

      if (action.source === 'DECK') {
        const drawn = trainDeck.draw(1, true);
        drawnCard = drawn[0]!;
        nextFaceUp = replenishFaceUpCards(nextFaceUp, trainDeck);
      } else {
        drawnCard = nextFaceUp[action.slotIndex]!;
        tookFaceUpLocomotive = drawnCard === 'LOCOMOTIVE';
        nextFaceUp[action.slotIndex] = null;
        nextFaceUp = replenishFaceUpCards(nextFaceUp, trainDeck);
      }

      const baseRecent =
        state.turnStep === 'DREW_ONE_CARD' ? { ...player.recentDrawnCards } : {};
      baseRecent[drawnCard] = (baseRecent[drawnCard] ?? 0) + 1;

      const updatedPlayer: PlayerState = {
        ...player,
        hand: addCardsToHand(player.hand, [drawnCard]),
        recentDrawnCards: baseRecent,
      };

      const actionDescription =
        action.source === 'DECK'
          ? state.turnStep === 'DREW_ONE_CARD'
            ? `${playerId} drew a 2nd blind Train Card from the deck (finished drawing 2 cards).`
            : `${playerId} drew 1 blind Train Card from the deck (1 of 2).`
          : tookFaceUpLocomotive
          ? `${playerId} took a face-up LOCOMOTIVE (Wild) card from slot #${action.slotIndex}.`
          : state.turnStep === 'DREW_ONE_CARD'
          ? `${playerId} took a face-up ${drawnCard} card from slot #${action.slotIndex} (2 of 2).`
          : `${playerId} took a face-up ${drawnCard} card from slot #${action.slotIndex} (1 of 2).`;

      const intermediateState: GameState = {
        ...state,
        players: {
          ...state.players,
          [playerId]: updatedPlayer,
        },
        faceUpCards: nextFaceUp,
        trainDeck: trainDeck.toState(),
        lastActionSummary: actionDescription,
      };

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
      let claimColor: TrainCardColor = 'LOCOMOTIVE';

      for (const color of ALL_TRAIN_CARD_COLORS) {
        const count = action.payment[color] ?? 0;
        if (count > 0) {
          nextHand[color] -= count;
          if (color !== 'LOCOMOTIVE') {
            claimColor = color;
          }
          for (let i = 0; i < count; i++) {
            discardedCards.push(color);
          }
        }
      }

      let tunnelSummaryNote = '';
      if (route.isTunnel) {
        const tunnelCards = trainDeck.draw(3, true);
        trainDeck.discard(tunnelCards);

        const extraRequired = tunnelCards.filter(
          (c) => c === 'LOCOMOTIVE' || c === claimColor
        ).length;

        if (extraRequired > 0) {
          const availableColor =
            claimColor === 'LOCOMOTIVE' ? 0 : nextHand[claimColor];
          const availableLoco = nextHand.LOCOMOTIVE;

          if (availableColor + availableLoco < extraRequired) {
            // Player cannot afford the tunnel tax: keep original hand, discard only the 3 flipped tunnel cards, and end turn
            const nextFaceUpAfterFail = replenishFaceUpCards(
              state.faceUpCards,
              trainDeck
            );
            const failedState: GameState = {
              ...state,
              players: {
                ...state.players,
                [playerId]: {
                  ...player,
                  recentDrawnCards: {},
                },
              },
              faceUpCards: nextFaceUpAfterFail,
              trainDeck: trainDeck.toState(),
              lastActionSummary: `${playerId} attempted tunnel ${route.from} ↔ ${route.to}, flipped [${tunnelCards.join(', ')}] (+${extraRequired} extra card(s) required), and could not pay the tunnel tax!`,
            };
            return advanceTurn(failedState);
          }

          let remainingExtra = extraRequired;
          if (claimColor !== 'LOCOMOTIVE' && nextHand[claimColor] > 0) {
            const useColor = Math.min(nextHand[claimColor], remainingExtra);
            nextHand[claimColor] -= useColor;
            remainingExtra -= useColor;
            for (let i = 0; i < useColor; i++) {
              discardedCards.push(claimColor);
            }
          }
          if (remainingExtra > 0) {
            nextHand.LOCOMOTIVE -= remainingExtra;
            for (let i = 0; i < remainingExtra; i++) {
              discardedCards.push('LOCOMOTIVE');
            }
          }
          tunnelSummaryNote = ` [Tunnel flipped: ${tunnelCards.join(', ')} -> paid +${extraRequired} extra]`;
        } else {
          tunnelSummaryNote = ` [Tunnel flipped: ${
            tunnelCards.length > 0 ? tunnelCards.join(', ') : 'none'
          } -> +0 extra]`;
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
        recentDrawnCards: {},
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
        lastActionSummary: `${playerId} claimed route ${route.from} ↔ ${route.to} (${route.length} cars, +${routePoints} pts)${tunnelSummaryNote}.`,
      };

      return advanceTurn(nextState);
    }

    case 'BUILD_STATION': {
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

      const currentStations =
        player.stationsRemaining ?? INITIAL_STATIONS_PER_PLAYER;
      const updatedPlayer: PlayerState = {
        ...player,
        hand: nextHand,
        stationsRemaining: currentStations - 1,
        recentDrawnCards: {},
      };

      const nextStations: Record<string, string> = {
        ...(state.stations ?? {}),
        [action.cityName]: playerId,
      };

      const nextState: GameState = {
        ...state,
        players: {
          ...state.players,
          [playerId]: updatedPlayer,
        },
        stations: nextStations,
        faceUpCards: nextFaceUp,
        trainDeck: trainDeck.toState(),
        lastActionSummary: `${playerId} built a Train Station in ${action.cityName} (${discardedCards.length} card(s) paid)!`,
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
        recentDrawnCards: {},
      };

      return {
        ...state,
        turnStep: 'CHOOSING_TICKETS',
        players: {
          ...state.players,
          [playerId]: updatedPlayer,
        },
        ticketDeck: ticketDeck.toState(),
        lastActionSummary: `${playerId} drew ${drawnTickets.length} Destination Tickets and is choosing which to keep.`,
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
        recentDrawnCards: {},
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

        if (
          allReady &&
          state.alvinAndDexter?.enabled &&
          state.alvinAndDexter.monsterToPlace !== null
        ) {
          const alvinSelectorIndex = state.playerOrder.length - 1;
          const alvinSelectorId = state.playerOrder[alvinSelectorIndex]!;
          return {
            ...state,
            phase: 'MONSTER_PLACEMENT',
            activePlayerIndex: alvinSelectorIndex,
            turnStep: 'PLACING_MONSTER',
            players: nextPlayers,
            ticketDeck: ticketDeck.toState(),
            lastActionSummary: `All players chose initial tickets! ${alvinSelectorId} must now select the starting city for Alvin (🛸 Flying Saucer).`,
          };
        }

        return {
          ...state,
          phase: allReady ? 'PLAYING' : 'INITIAL_TICKET_SELECTION',
          activePlayerIndex: allReady ? 0 : nextPendingPlayerIndex,
          turnStep: allReady ? 'AWAITING_ACTION' : 'CHOOSING_TICKETS',
          players: nextPlayers,
          ticketDeck: ticketDeck.toState(),
          lastActionSummary: allReady
            ? `${playerId} kept ${keptTickets.length} initial Destination Ticket(s). All players ready — Game on!`
            : `${playerId} kept ${keptTickets.length} initial Destination Ticket(s).`,
        };
      }

      const nextState: GameState = {
        ...state,
        players: nextPlayers,
        ticketDeck: ticketDeck.toState(),
        lastActionSummary: `${playerId} kept ${keptTickets.length} Destination Ticket(s)${
          returnedTickets.length > 0
            ? ` and discarded ${returnedTickets.length}`
            : ''
        }.`,
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
      ...(opp.stationsRemaining !== undefined
        ? { stationsRemaining: opp.stationsRemaining }
        : {}),
      ...(state.alvinAndDexter?.enabled
        ? {
            hasFaceUpAlvin: (opp.faceUpAlvinTurnsRemaining ?? 0) > 0,
            hasFaceUpDexter: (opp.faceUpDexterTurnsRemaining ?? 0) > 0,
          }
        : {}),
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
      recentDrawnCards: { ...self.recentDrawnCards },
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
    lastActionSummary: state.lastActionSummary,
    ...(state.mapId !== undefined ? { mapId: state.mapId } : {}),
    ...(state.stations !== undefined
      ? { stations: { ...state.stations } }
      : {}),
    ...(state.alvinAndDexter !== undefined
      ? { alvinAndDexter: { ...state.alvinAndDexter } }
      : {}),
  };
}

export const TRANS_AMERICA_EXPRESS_BONUS = 10;

/**
 * Calculates the length (in train cars) of the longest continuous path of routes
 * owned by `playerId`.
 */
export function calculateLongestContinuousPath(
  routes: readonly RouteEdge[],
  playerId: string
): number {
  const ownedRoutes = routes.filter((r) => r.ownerId === playerId);
  if (ownedRoutes.length === 0) {
    return 0;
  }

  interface AdjEdge {
    readonly routeId: string;
    readonly to: string;
    readonly length: number;
  }

  const adj = new Map<string, AdjEdge[]>();
  for (const r of ownedRoutes) {
    if (!adj.has(r.from)) {
      adj.set(r.from, []);
    }
    if (!adj.has(r.to)) {
      adj.set(r.to, []);
    }
    adj.get(r.from)!.push({ routeId: r.id, to: r.to, length: r.length });
    adj.get(r.to)!.push({ routeId: r.id, to: r.from, length: r.length });
  }

  const usedRouteIds = new Set<string>();
  let maxLength = 0;

  const dfs = (currentCity: string, currentLength: number): void => {
    if (currentLength > maxLength) {
      maxLength = currentLength;
    }
    const edges = adj.get(currentCity);
    if (!edges) return;

    for (const edge of edges) {
      if (usedRouteIds.has(edge.routeId)) {
        continue;
      }
      usedRouteIds.add(edge.routeId);
      dfs(edge.to, currentLength + edge.length);
      usedRouteIds.delete(edge.routeId);
    }
  };

  for (const startCity of adj.keys()) {
    dfs(startCity, 0);
  }

  return maxLength;
}

/**
 * Evaluates all players' longest continuous paths and returns the recipient(s)
 * of the 10-point Trans America Express bonus.
 */
export function getTransAmericaExpressRecipients(state: GameState): {
  readonly maxPathLength: number;
  readonly longestPathByPlayer: Record<string, number>;
  readonly recipients: readonly string[];
} {
  const longestPathByPlayer: Record<string, number> = {};
  let maxPathLength = 0;

  for (const playerId of state.playerOrder) {
    const len = calculateLongestContinuousPath(state.routes, playerId);
    longestPathByPlayer[playerId] = len;
    if (len > maxPathLength) {
      maxPathLength = len;
    }
  }

  const recipients =
    maxPathLength > 0
      ? state.playerOrder.filter(
          (pid) => longestPathByPlayer[pid] === maxPathLength
        )
      : [];

  return {
    maxPathLength,
    longestPathByPlayer,
    recipients,
  };
}

/**
 * Evaluates the +15 point Alvin & Dexter end-of-game bonuses:
 * - Player(s) with the most Alvin cards (> 0) each receive +15 points.
 * - Player(s) with the most Dexter cards (> 0) each receive +15 points.
 */
export function getMonsterBonusRecipients(state: GameState): {
  readonly maxAlvinCards: number;
  readonly maxDexterCards: number;
  readonly alvinRecipients: readonly string[];
  readonly dexterRecipients: readonly string[];
} {
  if (!state.alvinAndDexter?.enabled) {
    return {
      maxAlvinCards: 0,
      maxDexterCards: 0,
      alvinRecipients: [],
      dexterRecipients: [],
    };
  }

  let maxAlvinCards = 0;
  let maxDexterCards = 0;

  for (const pid of state.playerOrder) {
    const p = state.players[pid];
    const aCount = p?.alvinCards ?? 0;
    const dCount = p?.dexterCards ?? 0;
    if (aCount > maxAlvinCards) {
      maxAlvinCards = aCount;
    }
    if (dCount > maxDexterCards) {
      maxDexterCards = dCount;
    }
  }

  const alvinRecipients =
    maxAlvinCards > 0
      ? state.playerOrder.filter(
          (pid) => (state.players[pid]?.alvinCards ?? 0) === maxAlvinCards
        )
      : [];

  const dexterRecipients =
    maxDexterCards > 0
      ? state.playerOrder.filter(
          (pid) => (state.players[pid]?.dexterCards ?? 0) === maxDexterCards
        )
      : [];

  return {
    maxAlvinCards,
    maxDexterCards,
    alvinRecipients,
    dexterRecipients,
  };
}

/**
 * Evaluates a player's Destination Tickets at the end of the game.
 * On the Europe map, each Train Station built by `playerId` allows that player to borrow
 * up to 1 rival-owned route into or out of that station's city to help complete tickets
 * (automatically selecting the combination of borrowed routes that maximizes ticket score).
 */
export function evaluatePlayerTickets(
  state: GameState,
  playerId: string
): {
  readonly ticketDelta: number;
  readonly completedTicketIds: ReadonlySet<string>;
} {
  const player = state.players[playerId];
  if (!player || player.tickets.length === 0) {
    return { ticketDelta: 0, completedTicketIds: new Set<string>() };
  }

  const ownedRoutes = state.routes.filter((r) => r.ownerId === playerId);

  const scoreWithBorrowedRoutes = (
    borrowed: readonly RouteEdge[]
  ): { delta: number; completedIds: Set<string> } => {
    const g = new Graph<RouteEdge>();
    for (const r of ownedRoutes) {
      g.addEdge(r.from, r.to, r.length, r);
    }
    for (const r of borrowed) {
      g.addEdge(r.from, r.to, r.length, r);
    }

    let delta = 0;
    const completedIds = new Set<string>();
    for (const ticket of player.tickets) {
      const { points: effectivePts } = getEffectiveTicketPoints(ticket, state);
      if (g.isConnected(ticket.from, ticket.to)) {
        delta += effectivePts;
        completedIds.add(ticket.id);
      } else {
        delta -= effectivePts;
      }
    }
    return { delta, completedIds };
  };

  // Find cities where `playerId` built a Train Station
  const playerStationCities: string[] = [];
  if (state.mapId === 'EUROPE' && state.stations) {
    for (const [city, owner] of Object.entries(state.stations)) {
      if (owner === playerId) {
        playerStationCities.push(city);
      }
    }
  }

  if (playerStationCities.length === 0) {
    const res = scoreWithBorrowedRoutes([]);
    return { ticketDelta: res.delta, completedTicketIds: res.completedIds };
  }

  // For each station city owned by `playerId`, gather all candidate rival-owned routes incident to that city
  const optionsPerStation: (RouteEdge | null)[][] = playerStationCities.map(
    (city) => {
      const rivalRoutes = state.routes.filter(
        (r) =>
          r.ownerId !== null &&
          r.ownerId !== playerId &&
          (r.from === city || r.to === city)
      );
      return [null, ...rivalRoutes];
    }
  );

  let bestResult: { delta: number; completedIds: Set<string> } | null = null;
  const currentChoice: RouteEdge[] = [];

  const searchCombinations = (stationIdx: number): void => {
    if (stationIdx >= optionsPerStation.length) {
      const candidate = scoreWithBorrowedRoutes(currentChoice);
      if (!bestResult || candidate.delta > bestResult.delta) {
        bestResult = candidate;
      }
      return;
    }

    for (const opt of optionsPerStation[stationIdx]!) {
      if (opt !== null) {
        currentChoice.push(opt);
        searchCombinations(stationIdx + 1);
        currentChoice.pop();
      } else {
        searchCombinations(stationIdx + 1);
      }
    }
  };

  searchCombinations(0);

  const finalRes = bestResult ?? scoreWithBorrowedRoutes([]);
  return {
    ticketDelta: finalRes.delta,
    completedTicketIds: finalRes.completedIds,
  };
}

/**
 * Calculates final scores for all players:
 * - Sum of claimed route points
 * - Plus/minus Destination Ticket points (any ticket containing a City in Chaos is worth half its normal value rounded down;
 *   Europe Stations allow borrowing 1 rival route per built station to complete tickets)
 * - Plus +4 points per unused Train Station on the Europe map
 * - Plus 10 points (Trans America Express / European Express) for the player(s) with the longest continuous path
 * - Plus 15 points for the player(s) with the most Alvin cards, and +15 points for the player(s) with the most Dexter cards
 */
export function calculateFinalScores(
  state: GameState
): Record<string, number> {
  const scores: Record<string, number> = {};
  const { recipients } = getTransAmericaExpressRecipients(state);
  const recipientSet = new Set(recipients);
  const { alvinRecipients, dexterRecipients } =
    getMonsterBonusRecipients(state);
  const alvinBonusSet = new Set(alvinRecipients);
  const dexterBonusSet = new Set(dexterRecipients);

  for (const playerId of state.playerOrder) {
    const player = state.players[playerId]!;
    const { ticketDelta } = evaluatePlayerTickets(state, playerId);

    let totalScore = player.claimedRoutePoints + ticketDelta;

    if (state.mapId === 'EUROPE') {
      totalScore +=
        (player.stationsRemaining ?? 0) * UNUSED_STATION_POINTS;
    }

    if (recipientSet.has(playerId)) {
      totalScore += TRANS_AMERICA_EXPRESS_BONUS;
    }

    if (alvinBonusSet.has(playerId)) {
      totalScore += ALVIN_BONUS_POINTS;
    }

    if (dexterBonusSet.has(playerId)) {
      totalScore += DEXTER_BONUS_POINTS;
    }

    scores[playerId] = totalScore;
  }

  return scores;
}
