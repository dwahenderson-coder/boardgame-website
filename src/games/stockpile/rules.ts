import { createPRNG, shuffleArray, PRNGState } from '../../common/prng.js';
import { ValidationResult } from '../ticket-to-ride/types.js';

function shuffleWithPRNG<T>(
  items: readonly T[],
  prng: PRNGState
): { shuffled: readonly T[]; nextState: PRNGState } {
  const res = shuffleArray(items, prng);
  return { shuffled: res.value, nextState: res.prng };
}
import {
  StockpileAction,
  StockpileBidValue,
  StockpileCompanyId,
  StockpileCompanyMeta,
  StockpileForecastCard,
  StockpileGameState,
  StockpileInsiderPairing,
  StockpileMarketCard,
  StockpileMovementEvent,
  StockpilePile,
  StockpilePlayerState,
  StockpilePublicPlayerState,
  StockpileSanitizedGameState,
  StockpileSanitizedPile,
  STOCKPILE_BID_TRACK,
} from './types.js';

export const STARTING_CASH = 20000;
export const MAX_ROUNDS = 6;
export const INITIAL_STOCK_PRICE = 5;
export const SPLIT_RESET_PRICE = 6;
export const BANKRUPTCY_RESET_PRICE = 5;
export const SHARE_UNIT_DOLLARS = 1000;
export const MAJORITY_BONUS_DOLLARS = 10000;
export const MAJORITY_TIE_BONUS_DOLLARS = 5000;

export const STOCKPILE_COMPANY_IDS: readonly StockpileCompanyId[] = [
  'GLOBAL_TELECOM',
  'BIOTECH',
  'ENERGY',
  'RAIL',
  'AUTOMOBILE',
  'ELECTRONIC',
] as const;

export const STOCKPILE_COMPANIES: Readonly<Record<StockpileCompanyId, StockpileCompanyMeta>> = {
  GLOBAL_TELECOM: {
    id: 'GLOBAL_TELECOM',
    name: 'Global Telecom',
    ticker: 'GTC',
    colorHex: '#38bdf8',
    badgeClass: 'bg-sky-500/20 text-sky-300 border-sky-500/40',
  },
  BIOTECH: {
    id: 'BIOTECH',
    name: 'Biotech',
    ticker: 'BIO',
    colorHex: '#34d399',
    badgeClass: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
  },
  ENERGY: {
    id: 'ENERGY',
    name: 'Energy',
    ticker: 'NRG',
    colorHex: '#fbbf24',
    badgeClass: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
  },
  RAIL: {
    id: 'RAIL',
    name: 'Rail',
    ticker: 'RAL',
    colorHex: '#a78bfa',
    badgeClass: 'bg-violet-500/20 text-violet-300 border-violet-500/40',
  },
  AUTOMOBILE: {
    id: 'AUTOMOBILE',
    name: 'Automobile',
    ticker: 'AUT',
    colorHex: '#f87171',
    badgeClass: 'bg-red-500/20 text-red-300 border-red-500/40',
  },
  ELECTRONIC: {
    id: 'ELECTRONIC',
    name: 'Electronic',
    ticker: 'ELC',
    colorHex: '#fb923c',
    badgeClass: 'bg-orange-500/20 text-orange-300 border-orange-500/40',
  },
};

export const FORECAST_CARDS: readonly StockpileForecastCard[] = [
  { id: 'FC_PLUS_4', type: 'CHANGE', delta: 4, label: '+4' },
  { id: 'FC_PLUS_3', type: 'CHANGE', delta: 3, label: '+3' },
  { id: 'FC_PLUS_2', type: 'CHANGE', delta: 2, label: '+2' },
  { id: 'FC_MINUS_2', type: 'CHANGE', delta: -2, label: '-2' },
  { id: 'FC_MINUS_3', type: 'CHANGE', delta: -3, label: '-3' },
  { id: 'FC_BANKRUPTCY', type: 'BANKRUPTCY', delta: 0, label: 'BANKRUPTCY' },
];

export function createEmptyPortfolio(): Record<StockpileCompanyId, number> {
  return {
    GLOBAL_TELECOM: 0,
    BIOTECH: 0,
    ENERGY: 0,
    RAIL: 0,
    AUTOMOBILE: 0,
    ELECTRONIC: 0,
  };
}

export function createInitialStockPrices(): Record<StockpileCompanyId, number> {
  return {
    GLOBAL_TELECOM: INITIAL_STOCK_PRICE,
    BIOTECH: INITIAL_STOCK_PRICE,
    ENERGY: INITIAL_STOCK_PRICE,
    RAIL: INITIAL_STOCK_PRICE,
    AUTOMOBILE: INITIAL_STOCK_PRICE,
    ELECTRONIC: INITIAL_STOCK_PRICE,
  };
}

/**
 * Creates the 80-card Market Deck:
 * - 10 standard share cards per company (60 cards)
 * - 8 preferred/bonus share cards across companies to reach 80 total cards
 * - 4 Boom! (+2) cards
 * - 4 Bust! (-2) cards
 * - 4 Trading Fee cards ($1K, $2K, $2K, $3K)
 */
export function createMarketDeck80(): StockpileMarketCard[] {
  const deck: StockpileMarketCard[] = [];

  for (const companyId of STOCKPILE_COMPANY_IDS) {
    const meta = STOCKPILE_COMPANIES[companyId];
    for (let i = 1; i <= 10; i++) {
      deck.push({
        id: `SHARE_${companyId}_${i}`,
        kind: 'SHARE',
        companyId,
        shareCount: 1,
        feeAmount: 0,
        label: `${meta.name} Share`,
      });
    }
  }

  // Add 8 additional share certificates so total deck size is exactly 80 cards
  const extraCompanies: StockpileCompanyId[] = [
    'GLOBAL_TELECOM',
    'BIOTECH',
    'ENERGY',
    'RAIL',
    'AUTOMOBILE',
    'ELECTRONIC',
    'GLOBAL_TELECOM',
    'ENERGY',
  ];
  extraCompanies.forEach((companyId, idx) => {
    const meta = STOCKPILE_COMPANIES[companyId];
    deck.push({
      id: `SHARE_EXTRA_${companyId}_${idx + 1}`,
      kind: 'SHARE',
      companyId,
      shareCount: 1,
      feeAmount: 0,
      label: `${meta.name} Share`,
    });
  });

  for (let i = 1; i <= 4; i++) {
    deck.push({
      id: `BOOM_${i}`,
      kind: 'BOOM',
      companyId: null,
      shareCount: 0,
      feeAmount: 0,
      label: 'Boom! (+$2)',
    });
  }

  for (let i = 1; i <= 4; i++) {
    deck.push({
      id: `BUST_${i}`,
      kind: 'BUST',
      companyId: null,
      shareCount: 0,
      feeAmount: 0,
      label: 'Bust! (-$2)',
    });
  }

  const fees = [1000, 2000, 2000, 3000];
  fees.forEach((fee, idx) => {
    deck.push({
      id: `FEE_${idx + 1}`,
      kind: 'TRADING_FEE',
      companyId: null,
      shareCount: 0,
      feeAmount: fee,
      label: `Trading Fee (-$${fee / 1000}K)`,
    });
  });

  return deck;
}

function drawMarketCards(
  deck: readonly StockpileMarketCard[],
  discard: readonly StockpileMarketCard[],
  count: number,
  prng: PRNGState
): {
  drawn: StockpileMarketCard[];
  nextDeck: StockpileMarketCard[];
  nextDiscard: StockpileMarketCard[];
  nextPrng: PRNGState;
} {
  let workingDeck = [...deck];
  let workingDiscard = [...discard];
  let currentPrng = prng;
  const drawn: StockpileMarketCard[] = [];

  for (let i = 0; i < count; i++) {
    if (workingDeck.length === 0) {
      if (workingDiscard.length === 0) {
        // Emergency replenish if all 80 cards are somehow held
        const fresh = shuffleWithPRNG(createMarketDeck80(), currentPrng);
        workingDeck = [...fresh.shuffled];
        currentPrng = fresh.nextState;
      } else {
        const reshuffled = shuffleWithPRNG(workingDiscard, currentPrng);
        workingDeck = [...reshuffled.shuffled];
        workingDiscard = [];
        currentPrng = reshuffled.nextState;
      }
    }
    const card = workingDeck.shift();
    if (card) {
      drawn.push(card);
    }
  }

  return {
    drawn,
    nextDeck: workingDeck,
    nextDiscard: workingDiscard,
    nextPrng: currentPrng,
  };
}

/**
 * Helper to apply immediate price changes (from Boom/Bust or Phase 6 Forecasts)
 * and trigger Stock Splits at >= $11 or Bankruptcies at <= $0.
 */
export function applyCompanyPriceShift(
  stockPrices: Readonly<Record<StockpileCompanyId, number>>,
  players: Readonly<Record<string, StockpilePlayerState>>,
  companyId: StockpileCompanyId,
  delta: number,
  forceBankruptcy = false
): {
  nextPrices: Record<StockpileCompanyId, number>;
  nextPlayers: Record<string, StockpilePlayerState>;
  movement: StockpileMovementEvent;
} {
  const previousPrice = stockPrices[companyId];
  let newPrice = forceBankruptcy ? 0 : previousPrice + delta;
  let triggeredSplit = false;
  let triggeredBankruptcy = false;

  const nextPlayers: Record<string, StockpilePlayerState> = { ...players };

  if (forceBankruptcy || newPrice <= 0) {
    triggeredBankruptcy = true;
    newPrice = BANKRUPTCY_RESET_PRICE;
    for (const [pid, pState] of Object.entries(nextPlayers)) {
      if (pState.portfolio[companyId] > 0) {
        nextPlayers[pid] = {
          ...pState,
          portfolio: {
            ...pState.portfolio,
            [companyId]: 0,
          },
        };
      }
    }
  } else if (newPrice >= 11) {
    triggeredSplit = true;
    newPrice = SPLIT_RESET_PRICE;
    for (const [pid, pState] of Object.entries(nextPlayers)) {
      const currentShares = pState.portfolio[companyId];
      if (currentShares > 0) {
        nextPlayers[pid] = {
          ...pState,
          portfolio: {
            ...pState.portfolio,
            [companyId]: currentShares * 2,
          },
        };
      }
    }
  }

  const nextPrices: Record<StockpileCompanyId, number> = {
    ...stockPrices,
    [companyId]: newPrice,
  };

  return {
    nextPrices,
    nextPlayers,
    movement: {
      companyId,
      previousPrice,
      forecastLabel: forceBankruptcy ? 'BANKRUPTCY' : delta >= 0 ? `+${delta}` : `${delta}`,
      finalPrice: newPrice,
      triggeredSplit,
      triggeredBankruptcy,
    },
  };
}

function setupRoundPhase1And2(
  playerOrder: readonly string[],
  firstPlayerIndex: number,
  roundNumber: number,
  stockPrices: Readonly<Record<StockpileCompanyId, number>>,
  existingPlayers: Readonly<Record<string, StockpilePlayerState>>,
  deck: readonly StockpileMarketCard[],
  discard: readonly StockpileMarketCard[],
  prng: PRNGState,
  lastRoundMovements: readonly StockpileMovementEvent[],
  summaryText: string
): StockpileGameState {
  // Phase 1: Information (shuffle 6 companies & 6 forecast cards)
  const shuffledCompanies = shuffleWithPRNG(STOCKPILE_COMPANY_IDS, prng);
  const shuffledForecasts = shuffleWithPRNG(FORECAST_CARDS, shuffledCompanies.nextState);
  let currentPrng = shuffledForecasts.nextState;

  const allPairings: StockpileInsiderPairing[] = [];
  for (let i = 0; i < 6; i++) {
    const companyId = shuffledCompanies.shuffled[i]!;
    const forecast = shuffledForecasts.shuffled[i]!;
    const isPublic = i === 0;
    const ownerPlayerId = !isPublic && i - 1 < playerOrder.length ? playerOrder[i - 1]! : null;
    allPairings.push({
      companyId,
      forecast,
      isPublic,
      ownerPlayerId,
    });
  }

  const publicPairing = allPairings[0]!;

  // Phase 2: Supply
  // Create N stockpiles, deal 1 face-up market card to each stockpile
  let currentDeck = [...deck];
  let currentDiscard = [...discard];

  const stockpiles: StockpilePile[] = [];
  for (let i = 0; i < playerOrder.length; i++) {
    const drawRes = drawMarketCards(currentDeck, currentDiscard, 1, currentPrng);
    currentDeck = drawRes.nextDeck;
    currentDiscard = drawRes.nextDiscard;
    currentPrng = drawRes.nextPrng;

    stockpiles.push({
      index: i,
      faceUpCards: drawRes.drawn,
      faceDownCards: [],
      currentBid: null,
      highBidderId: null,
    });
  }

  // Deal 2 market cards to each player for Phase 2 Supply placement
  const nextPlayers: Record<string, StockpilePlayerState> = {};
  for (let i = 0; i < playerOrder.length; i++) {
    const pid = playerOrder[i]!;
    const prev = existingPlayers[pid]!;
    const drawRes = drawMarketCards(currentDeck, currentDiscard, 2, currentPrng);
    currentDeck = drawRes.nextDeck;
    currentDiscard = drawRes.nextDiscard;
    currentPrng = drawRes.nextPrng;

    const privatePairing = allPairings[i + 1] ?? null;

    nextPlayers[pid] = {
      ...prev,
      supplyHand: drawRes.drawn,
      hasPlacedSupply: false,
      pendingActionCards: [],
      outbidFromPileIndex: null,
      hasFinishedSelling: false,
      insiderPairing: privatePairing,
    };
  }

  return {
    gameId: 'stockpile',
    phase: 'PLAYING',
    turnStep: 'PHASE_2_SUPPLY',
    turnNumber: 1,
    roundNumber,
    maxRounds: MAX_ROUNDS,
    playerOrder,
    firstPlayerIndex,
    activePlayerIndex: firstPlayerIndex,
    stockPrices,
    marketDeck: currentDeck,
    marketDiscard: currentDiscard,
    publicPairing,
    allPairings,
    stockpiles,
    players: nextPlayers,
    lastRoundMovements,
    prng: currentPrng,
    winnerId: null,
    lastActionSummary: summaryText,
  };
}

export function initStockpileGame(playerIds: readonly string[], seed = 42): StockpileGameState {
  if (playerIds.length < 2 || playerIds.length > 5) {
    throw new Error('Stockpile requires 2 to 5 players.');
  }

  const initialPrng = createPRNG(seed);
  const rawDeck = createMarketDeck80();
  const shuffledDeck = shuffleWithPRNG(rawDeck, initialPrng);

  const initialPlayers: Record<string, StockpilePlayerState> = {};
  for (const pid of playerIds) {
    initialPlayers[pid] = {
      id: pid,
      cash: STARTING_CASH,
      portfolio: createEmptyPortfolio(),
      supplyHand: [],
      hasPlacedSupply: false,
      pendingActionCards: [],
      outbidFromPileIndex: null,
      hasFinishedSelling: false,
      insiderPairing: null,
      lastActionLabel: null,
      endGameStockLiquidation: 0,
      endGameMajorityBonus: 0,
    };
  }

  return setupRoundPhase1And2(
    [...playerIds],
    0,
    1,
    createInitialStockPrices(),
    initialPlayers,
    shuffledDeck.shuffled,
    [],
    shuffledDeck.nextState,
    [],
    'Round 1 started — Insider Information dealt & Stockpiles initialized!'
  );
}

export function validateStockpileAction(
  state: StockpileGameState,
  playerId: string,
  action: StockpileAction
): ValidationResult {
  if (state.phase === 'GAME_OVER') {
    return { valid: false, reason: 'The game is already over.' };
  }

  const activePlayerId = state.playerOrder[state.activePlayerIndex];
  if (!activePlayerId) {
    return { valid: false, reason: 'No active player.' };
  }

  if (action.type === 'STOCKPILE_AI_TURN') {
    return { valid: true };
  }

  if (action.type === 'STOCKPILE_NEXT_ROUND') {
    if (state.turnStep !== 'PHASE_6_MOVEMENT_SUMMARY') {
      return {
        valid: false,
        reason: 'Can only advance round from Phase 6 Movement Summary.',
      };
    }
    return { valid: true };
  }

  if (playerId !== activePlayerId) {
    return { valid: false, reason: 'It is not your turn.' };
  }

  const player = state.players[playerId];
  if (!player) {
    return { valid: false, reason: 'Unknown player.' };
  }

  switch (action.type) {
    case 'STOCKPILE_PLACE_SUPPLY': {
      if (state.turnStep !== 'PHASE_2_SUPPLY') {
        return {
          valid: false,
          reason: 'Can only place supply cards during Phase 2: Supply.',
        };
      }
      if (player.hasPlacedSupply || player.supplyHand.length < 2) {
        return {
          valid: false,
          reason: 'You have already placed your supply cards this round.',
        };
      }
      if (action.faceUpCardId === action.faceDownCardId) {
        return {
          valid: false,
          reason: 'Face-up and face-down cards must be two different cards from your hand.',
        };
      }
      const hasFaceUp = player.supplyHand.some((c) => c.id === action.faceUpCardId);
      const hasFaceDown = player.supplyHand.some((c) => c.id === action.faceDownCardId);
      if (!hasFaceUp || !hasFaceDown) {
        return {
          valid: false,
          reason: 'Selected cards are not in your supply hand.',
        };
      }
      if (
        action.faceUpPileIndex < 0 ||
        action.faceUpPileIndex >= state.stockpiles.length ||
        action.faceDownPileIndex < 0 ||
        action.faceDownPileIndex >= state.stockpiles.length
      ) {
        return { valid: false, reason: 'Invalid stockpile index.' };
      }
      return { valid: true };
    }

    case 'STOCKPILE_BID': {
      if (state.turnStep !== 'PHASE_3_DEMAND') {
        return {
          valid: false,
          reason: 'Can only bid during Phase 3: Demand.',
        };
      }
      const pile = state.stockpiles[action.pileIndex];
      if (!pile) {
        return { valid: false, reason: 'Invalid stockpile index.' };
      }
      if (!STOCKPILE_BID_TRACK.includes(action.bidAmount)) {
        return { valid: false, reason: 'Invalid bid slot value.' };
      }
      // If outbid from a pile, must move token to a DIFFERENT pile
      if (
        player.outbidFromPileIndex !== null &&
        action.pileIndex === player.outbidFromPileIndex
      ) {
        return {
          valid: false,
          reason:
            'When outbid on a stockpile, you must move your bidding token to a different stockpile.',
        };
      }
      if (pile.highBidderId === playerId) {
        return {
          valid: false,
          reason: 'You already hold the high bid on this stockpile.',
        };
      }
      if (pile.currentBid !== null && action.bidAmount <= pile.currentBid) {
        return {
          valid: false,
          reason: `Bid must be higher than the current bid of $${pile.currentBid}K.`,
        };
      }
      const bidCostDollars = action.bidAmount * SHARE_UNIT_DOLLARS;
      if (bidCostDollars > player.cash) {
        return {
          valid: false,
          reason: `Insufficient cash for a $${action.bidAmount}K ($${bidCostDollars.toLocaleString()}) bid.`,
        };
      }
      return { valid: true };
    }

    case 'STOCKPILE_PLAY_BOOM_BUST': {
      if (state.turnStep !== 'PHASE_4_ACTION') {
        return {
          valid: false,
          reason: 'Can only play Boom/Bust cards during Phase 4: Action.',
        };
      }
      const card = player.pendingActionCards.find((c) => c.id === action.cardId);
      if (!card || (card.kind !== 'BOOM' && card.kind !== 'BUST')) {
        return {
          valid: false,
          reason: 'Card is not in your pending Boom/Bust action queue.',
        };
      }
      if (!STOCKPILE_COMPANY_IDS.includes(action.companyId)) {
        return { valid: false, reason: 'Invalid target company.' };
      }
      return { valid: true };
    }

    case 'STOCKPILE_SELL_SHARES': {
      if (state.turnStep !== 'PHASE_5_SELLING') {
        return {
          valid: false,
          reason: 'Can only sell shares during Phase 5: Selling.',
        };
      }
      if (!STOCKPILE_COMPANY_IDS.includes(action.companyId)) {
        return { valid: false, reason: 'Invalid company.' };
      }
      if (!Number.isInteger(action.quantity) || action.quantity <= 0) {
        return { valid: false, reason: 'Quantity must be a positive integer.' };
      }
      const owned = player.portfolio[action.companyId] ?? 0;
      if (action.quantity > owned) {
        return {
          valid: false,
          reason: `You only own ${owned} share(s) of ${STOCKPILE_COMPANIES[action.companyId].name}.`,
        };
      }
      return { valid: true };
    }

    case 'STOCKPILE_FINISH_SELLING': {
      if (state.turnStep !== 'PHASE_5_SELLING') {
        return {
          valid: false,
          reason: 'Can only finish selling during Phase 5: Selling.',
        };
      }
      return { valid: true };
    }

    default:
      return { valid: false, reason: 'Unsupported action.' };
  }
}

/**
 * Transitions from Phase 3 (when all players occupy a unique stockpile)
 * into Phase 4 (or Phase 5 if no players drew Boom/Bust cards).
 */
function resolveWonStockpilesAndEnterPhase4(state: StockpileGameState, lastSummary: string): StockpileGameState {
  const nextPlayers: Record<string, StockpilePlayerState> = { ...state.players };
  const nextDiscard: StockpileMarketCard[] = [...state.marketDiscard];

  for (const pile of state.stockpiles) {
    const winnerId = pile.highBidderId;
    if (!winnerId) continue;
    const winner = nextPlayers[winnerId];
    if (!winner) continue;

    const bidDollars = (pile.currentBid ?? 0) * SHARE_UNIT_DOLLARS;
    let updatedCash = Math.max(0, winner.cash - bidDollars);
    const updatedPortfolio = { ...winner.portfolio };
    const pendingActions: StockpileMarketCard[] = [];

    const allPileCards = [...pile.faceUpCards, ...pile.faceDownCards];
    for (const card of allPileCards) {
      if (card.kind === 'SHARE' && card.companyId) {
        updatedPortfolio[card.companyId] += card.shareCount;
        nextDiscard.push(card);
      } else if (card.kind === 'TRADING_FEE') {
        updatedCash = Math.max(0, updatedCash - card.feeAmount);
        nextDiscard.push(card);
      } else if (card.kind === 'BOOM' || card.kind === 'BUST') {
        pendingActions.push(card);
      }
    }

    nextPlayers[winnerId] = {
      ...winner,
      cash: updatedCash,
      portfolio: updatedPortfolio,
      pendingActionCards: pendingActions,
      outbidFromPileIndex: null,
    };
  }

  // Find first player in turn order starting from firstPlayerIndex who has pendingActionCards
  const n = state.playerOrder.length;
  let nextActionPlayerIndex: number | null = null;
  for (let offset = 0; offset < n; offset++) {
    const idx = (state.firstPlayerIndex + offset) % n;
    const pid = state.playerOrder[idx]!;
    if ((nextPlayers[pid]?.pendingActionCards.length ?? 0) > 0) {
      nextActionPlayerIndex = idx;
      break;
    }
  }

  if (nextActionPlayerIndex !== null) {
    return {
      ...state,
      turnStep: 'PHASE_4_ACTION',
      activePlayerIndex: nextActionPlayerIndex,
      players: nextPlayers,
      marketDiscard: nextDiscard,
      lastActionSummary: `${lastSummary} — Bidding complete! Entering Phase 4: Action (Boom/Bust).`,
    };
  }

  return {
    ...state,
    turnStep: 'PHASE_5_SELLING',
    activePlayerIndex: state.firstPlayerIndex,
    players: nextPlayers,
    marketDiscard: nextDiscard,
    lastActionSummary: `${lastSummary} — Bidding & Trading Fees resolved! Entering Phase 5: Selling.`,
  };
}

/**
 * Executes Phase 6 Market Movement for all 6 companies and either pauses at
 * PHASE_6_MOVEMENT_SUMMARY (for Rounds 1..5) or liquidates all final shares &
 * awards Majority Shareholder bonuses after Round 6 (`GAME_OVER`).
 */
function executePhase6MarketMovement(state: StockpileGameState, lastSummary: string): StockpileGameState {
  let workingPrices: Record<StockpileCompanyId, number> = { ...state.stockPrices };
  let workingPlayers: Record<string, StockpilePlayerState> = { ...state.players };
  const movements: StockpileMovementEvent[] = [];

  for (const pairing of state.allPairings) {
    const isBankrupt = pairing.forecast.type === 'BANKRUPTCY';
    const res = applyCompanyPriceShift(
      workingPrices,
      workingPlayers,
      pairing.companyId,
      pairing.forecast.delta,
      isBankrupt
    );
    workingPrices = res.nextPrices;
    workingPlayers = res.nextPlayers;
    movements.push(res.movement);
  }

  if (state.roundNumber >= state.maxRounds) {
    // End of Round 6:
    // 1. Award Majority Shareholder Bonus ($10,000 for sole majority, $5,000 each if tied)
    const majorityBonuses: Record<string, number> = {};
    for (const pid of state.playerOrder) {
      majorityBonuses[pid] = 0;
    }

    for (const companyId of STOCKPILE_COMPANY_IDS) {
      let maxShares = 0;
      for (const pid of state.playerOrder) {
        const count = workingPlayers[pid]?.portfolio[companyId] ?? 0;
        if (count > maxShares) {
          maxShares = count;
        }
      }
      if (maxShares > 0) {
        const leaders = state.playerOrder.filter(
          (pid) => (workingPlayers[pid]?.portfolio[companyId] ?? 0) === maxShares
        );
        const bonusPerLeader =
          leaders.length === 1 ? MAJORITY_BONUS_DOLLARS : MAJORITY_TIE_BONUS_DOLLARS;
        for (const leaderId of leaders) {
          majorityBonuses[leaderId] = (majorityBonuses[leaderId] ?? 0) + bonusPerLeader;
        }
      }
    }

    // 2. Liquidate all remaining shares at final values
    let highestCash = -1;
    let winnerId: string | null = null;

    for (const pid of state.playerOrder) {
      const pState = workingPlayers[pid]!;
      let liquidationValue = 0;
      for (const companyId of STOCKPILE_COMPANY_IDS) {
        const shares = pState.portfolio[companyId] ?? 0;
        const price = workingPrices[companyId] ?? 0;
        liquidationValue += shares * price * SHARE_UNIT_DOLLARS;
      }
      const majBonus = majorityBonuses[pid] ?? 0;
      const finalCash = pState.cash + liquidationValue + majBonus;

      workingPlayers[pid] = {
        ...pState,
        cash: finalCash,
        endGameStockLiquidation: liquidationValue,
        endGameMajorityBonus: majBonus,
      };

      if (finalCash > highestCash) {
        highestCash = finalCash;
        winnerId = pid;
      }
    }

    return {
      ...state,
      phase: 'GAME_OVER',
      turnStep: 'GAME_OVER',
      stockPrices: workingPrices,
      players: workingPlayers,
      lastRoundMovements: movements,
      winnerId,
      lastActionSummary: `Round 6 Market Movement complete! Final shares liquidated & Majority Shareholder Bonuses awarded. Winner: ${winnerId} ($${highestCash.toLocaleString()})!`,
    };
  }

  return {
    ...state,
    turnStep: 'PHASE_6_MOVEMENT_SUMMARY',
    stockPrices: workingPrices,
    players: workingPlayers,
    lastRoundMovements: movements,
    lastActionSummary: `${lastSummary} — Phase 6: All Round ${state.roundNumber} Insider Forecasts revealed & applied!`,
  };
}

function computeHeuristicAiAction(state: StockpileGameState, activePlayerId: string): StockpileAction {
  const player = state.players[activePlayerId]!;

  if (state.turnStep === 'PHASE_2_SUPPLY') {
    const card0 = player.supplyHand[0]!;
    const card1 = player.supplyHand[1]!;
    const pileCount = state.stockpiles.length;
    const faceUpPileIndex = state.activePlayerIndex % pileCount;
    const faceDownPileIndex = (state.activePlayerIndex + 1) % pileCount;
    return {
      type: 'STOCKPILE_PLACE_SUPPLY',
      faceUpCardId: card0.id,
      faceUpPileIndex,
      faceDownCardId: card1.id,
      faceDownPileIndex,
    };
  }

  if (state.turnStep === 'PHASE_3_DEMAND') {
    // Prefer an unclaimed pile at $0 if allowed
    for (const pile of state.stockpiles) {
      if (
        pile.index !== player.outbidFromPileIndex &&
        pile.highBidderId === null &&
        pile.currentBid === null
      ) {
        return {
          type: 'STOCKPILE_BID',
          pileIndex: pile.index,
          bidAmount: 0,
        };
      }
    }
    // Otherwise find the lowest valid outbid on an allowed pile
    for (const pile of state.stockpiles) {
      if (pile.index === player.outbidFromPileIndex || pile.highBidderId === activePlayerId) {
        continue;
      }
      const nextSlot = STOCKPILE_BID_TRACK.find(
        (b) => (pile.currentBid === null || b > pile.currentBid) && b * SHARE_UNIT_DOLLARS <= player.cash
      );
      if (nextSlot !== undefined) {
        return {
          type: 'STOCKPILE_BID',
          pileIndex: pile.index,
          bidAmount: nextSlot,
        };
      }
    }
    // Fallback
    return {
      type: 'STOCKPILE_BID',
      pileIndex: 0,
      bidAmount: 0,
    };
  }

  if (state.turnStep === 'PHASE_4_ACTION') {
    const nextCard = player.pendingActionCards[0]!;
    // If BOOM, pick company player owns most of (or highest price)
    let bestCompany: StockpileCompanyId = 'GLOBAL_TELECOM';
    if (nextCard.kind === 'BOOM') {
      let bestScore = -1;
      for (const cid of STOCKPILE_COMPANY_IDS) {
        const score = (player.portfolio[cid] ?? 0) * 10 + state.stockPrices[cid];
        if (score > bestScore) {
          bestScore = score;
          bestCompany = cid;
        }
      }
    } else {
      // BUST: pick company opponents own or player owns least of
      let lowestOwned = 999;
      for (const cid of STOCKPILE_COMPANY_IDS) {
        const owned = player.portfolio[cid] ?? 0;
        if (owned < lowestOwned) {
          lowestOwned = owned;
          bestCompany = cid;
        }
      }
    }
    return {
      type: 'STOCKPILE_PLAY_BOOM_BUST',
      cardId: nextCard.id,
      companyId: bestCompany,
    };
  }

  if (state.turnStep === 'PHASE_5_SELLING') {
    // Check if player knows a company is going down or bankrupt via public or private forecast
    const knownNegativeCompanies = new Set<StockpileCompanyId>();
    if (
      state.publicPairing.forecast.type === 'BANKRUPTCY' ||
      state.publicPairing.forecast.delta < 0
    ) {
      knownNegativeCompanies.add(state.publicPairing.companyId);
    }
    if (
      player.insiderPairing &&
      (player.insiderPairing.forecast.type === 'BANKRUPTCY' ||
        player.insiderPairing.forecast.delta < 0)
    ) {
      knownNegativeCompanies.add(player.insiderPairing.companyId);
    }

    for (const cid of knownNegativeCompanies) {
      const owned = player.portfolio[cid] ?? 0;
      if (owned > 0) {
        return {
          type: 'STOCKPILE_SELL_SHARES',
          companyId: cid,
          quantity: owned,
        };
      }
    }

    return { type: 'STOCKPILE_FINISH_SELLING' };
  }

  return { type: 'STOCKPILE_NEXT_ROUND' };
}

export function applyStockpileAction(
  state: StockpileGameState,
  playerId: string,
  action: StockpileAction
): StockpileGameState {
  const activePlayerId = state.playerOrder[state.activePlayerIndex]!;
  const effectivePlayerId = action.type === 'STOCKPILE_AI_TURN' ? activePlayerId : playerId;
  const effectiveAction =
    action.type === 'STOCKPILE_AI_TURN'
      ? computeHeuristicAiAction(state, activePlayerId)
      : action;

  const check = validateStockpileAction(state, effectivePlayerId, effectiveAction);
  if (!check.valid) {
    throw new Error(check.reason ?? 'Invalid Stockpile action.');
  }

  const n = state.playerOrder.length;
  const player = state.players[effectivePlayerId]!;

  switch (effectiveAction.type) {
    case 'STOCKPILE_PLACE_SUPPLY': {
      const faceUpCard = player.supplyHand.find((c) => c.id === effectiveAction.faceUpCardId)!;
      const faceDownCard = player.supplyHand.find((c) => c.id === effectiveAction.faceDownCardId)!;

      const nextStockpiles = state.stockpiles.map((pile) => {
        let nextUp = pile.faceUpCards;
        let nextDown = pile.faceDownCards;
        if (pile.index === effectiveAction.faceUpPileIndex) {
          nextUp = [...nextUp, faceUpCard];
        }
        if (pile.index === effectiveAction.faceDownPileIndex) {
          nextDown = [...nextDown, faceDownCard];
        }
        return {
          ...pile,
          faceUpCards: nextUp,
          faceDownCards: nextDown,
        };
      });

      const summary = `${effectivePlayerId} placed 1 face-up card (${faceUpCard.label} → Pile #${effectiveAction.faceUpPileIndex + 1}) and 1 face-down card (→ Pile #${effectiveAction.faceDownPileIndex + 1})`;

      const nextPlayers: Record<string, StockpilePlayerState> = {
        ...state.players,
        [effectivePlayerId]: {
          ...player,
          supplyHand: [],
          hasPlacedSupply: true,
          lastActionLabel: `Placed Supply (Pile #${effectiveAction.faceUpPileIndex + 1} & #${effectiveAction.faceDownPileIndex + 1})`,
        },
      };

      const allPlaced = state.playerOrder.every((pid) => nextPlayers[pid]?.hasPlacedSupply);
      if (allPlaced) {
        return {
          ...state,
          turnStep: 'PHASE_3_DEMAND',
          turnNumber: state.turnNumber + 1,
          activePlayerIndex: state.firstPlayerIndex,
          stockpiles: nextStockpiles,
          players: nextPlayers,
          lastActionSummary: `${summary} — All supply cards placed! Entering Phase 3: Demand (Bidding Auction).`,
        };
      }

      const nextPlayerIndex = (state.activePlayerIndex + 1) % n;
      return {
        ...state,
        turnNumber: state.turnNumber + 1,
        activePlayerIndex: nextPlayerIndex,
        stockpiles: nextStockpiles,
        players: nextPlayers,
        lastActionSummary: summary,
      };
    }

    case 'STOCKPILE_BID': {
      const targetPile = state.stockpiles[effectiveAction.pileIndex]!;
      const previousBidderId = targetPile.highBidderId;

      const nextStockpiles = state.stockpiles.map((pile, idx) =>
        idx === effectiveAction.pileIndex
          ? {
              ...pile,
              currentBid: effectiveAction.bidAmount,
              highBidderId: effectivePlayerId,
            }
          : pile
      );

      const nextPlayers: Record<string, StockpilePlayerState> = {
        ...state.players,
        [effectivePlayerId]: {
          ...player,
          outbidFromPileIndex: null,
          lastActionLabel: `Bid $${effectiveAction.bidAmount}K on Pile #${effectiveAction.pileIndex + 1}`,
        },
      };

      const summary = previousBidderId
        ? `${effectivePlayerId} outbid ${previousBidderId} on Stockpile #${effectiveAction.pileIndex + 1} with $${effectiveAction.bidAmount}K!`
        : `${effectivePlayerId} bid $${effectiveAction.bidAmount}K on Stockpile #${effectiveAction.pileIndex + 1}`;

      // If another player was outbid, they must immediately move their token to a different pile!
      if (previousBidderId && previousBidderId !== effectivePlayerId) {
        const displacedPlayer = nextPlayers[previousBidderId]!;
        nextPlayers[previousBidderId] = {
          ...displacedPlayer,
          outbidFromPileIndex: effectiveAction.pileIndex,
        };
        const displacedIndex = state.playerOrder.indexOf(previousBidderId);
        return {
          ...state,
          turnNumber: state.turnNumber + 1,
          activePlayerIndex: displacedIndex,
          stockpiles: nextStockpiles,
          players: nextPlayers,
          lastActionSummary: `${summary} (${previousBidderId} must immediately move their bidding token to another pile)`,
        };
      }

      // Check if every player now occupies a unique stockpile
      const occupiedOwners = new Set(
        nextStockpiles.map((p) => p.highBidderId).filter((id): id is string => id !== null)
      );
      if (occupiedOwners.size === n) {
        const updatedState: StockpileGameState = {
          ...state,
          turnNumber: state.turnNumber + 1,
          stockpiles: nextStockpiles,
          players: nextPlayers,
        };
        return resolveWonStockpilesAndEnterPhase4(updatedState, summary);
      }

      // Otherwise find next player in turn order who does not currently hold a high bid
      let nextBidderIndex = state.activePlayerIndex;
      for (let offset = 1; offset <= n; offset++) {
        const candidateIdx = (state.activePlayerIndex + offset) % n;
        const candidateId = state.playerOrder[candidateIdx]!;
        const holdsPile = nextStockpiles.some((p) => p.highBidderId === candidateId);
        if (!holdsPile) {
          nextBidderIndex = candidateIdx;
          break;
        }
      }

      return {
        ...state,
        turnNumber: state.turnNumber + 1,
        activePlayerIndex: nextBidderIndex,
        stockpiles: nextStockpiles,
        players: nextPlayers,
        lastActionSummary: summary,
      };
    }

    case 'STOCKPILE_PLAY_BOOM_BUST': {
      const card = player.pendingActionCards.find((c) => c.id === effectiveAction.cardId)!;
      const delta = card.kind === 'BOOM' ? 2 : -2;
      const shiftRes = applyCompanyPriceShift(
        state.stockPrices,
        state.players,
        effectiveAction.companyId,
        delta,
        false
      );

      const remainingActions = player.pendingActionCards.filter(
        (c) => c.id !== effectiveAction.cardId
      );
      const updatedCurrentPlayer = shiftRes.nextPlayers[effectivePlayerId]!;
      const companyName = STOCKPILE_COMPANIES[effectiveAction.companyId].name;
      const eventSuffix = shiftRes.movement.triggeredSplit
        ? ' (STOCK SPLIT! Shares doubled, price reset to $6)'
        : shiftRes.movement.triggeredBankruptcy
        ? ' (BANKRUPTCY! Shares wiped, price reset to $5)'
        : '';

      const summary = `${effectivePlayerId} played ${card.label} on ${companyName}: $${shiftRes.movement.previousPrice} → $${shiftRes.movement.finalPrice}${eventSuffix}`;

      const nextPlayers: Record<string, StockpilePlayerState> = {
        ...shiftRes.nextPlayers,
        [effectivePlayerId]: {
          ...updatedCurrentPlayer,
          pendingActionCards: remainingActions,
          lastActionLabel: `${card.kind === 'BOOM' ? 'Boom' : 'Bust'} ${companyName}`,
        },
      };

      const nextDiscard = [...state.marketDiscard, card];

      // If current player still has another Boom/Bust card, stay on them
      if (remainingActions.length > 0) {
        return {
          ...state,
          turnNumber: state.turnNumber + 1,
          stockPrices: shiftRes.nextPrices,
          players: nextPlayers,
          marketDiscard: nextDiscard,
          lastActionSummary: summary,
        };
      }

      // Otherwise find next player with pendingActionCards
      let nextActionPlayerIndex: number | null = null;
      for (let offset = 1; offset <= n; offset++) {
        const idx = (state.activePlayerIndex + offset) % n;
        const pid = state.playerOrder[idx]!;
        if ((nextPlayers[pid]?.pendingActionCards.length ?? 0) > 0) {
          nextActionPlayerIndex = idx;
          break;
        }
      }

      if (nextActionPlayerIndex !== null) {
        return {
          ...state,
          turnNumber: state.turnNumber + 1,
          activePlayerIndex: nextActionPlayerIndex,
          stockPrices: shiftRes.nextPrices,
          players: nextPlayers,
          marketDiscard: nextDiscard,
          lastActionSummary: summary,
        };
      }

      return {
        ...state,
        turnStep: 'PHASE_5_SELLING',
        turnNumber: state.turnNumber + 1,
        activePlayerIndex: state.firstPlayerIndex,
        stockPrices: shiftRes.nextPrices,
        players: nextPlayers,
        marketDiscard: nextDiscard,
        lastActionSummary: `${summary} — Entering Phase 5: Selling.`,
      };
    }

    case 'STOCKPILE_SELL_SHARES': {
      const pricePerShare = state.stockPrices[effectiveAction.companyId] * SHARE_UNIT_DOLLARS;
      const proceeds = effectiveAction.quantity * pricePerShare;
      const currentOwned = player.portfolio[effectiveAction.companyId];
      const companyName = STOCKPILE_COMPANIES[effectiveAction.companyId].name;

      const nextPlayers: Record<string, StockpilePlayerState> = {
        ...state.players,
        [effectivePlayerId]: {
          ...player,
          cash: player.cash + proceeds,
          portfolio: {
            ...player.portfolio,
            [effectiveAction.companyId]: currentOwned - effectiveAction.quantity,
          },
          lastActionLabel: `Sold ${effectiveAction.quantity} ${STOCKPILE_COMPANIES[effectiveAction.companyId].ticker} (+$${proceeds.toLocaleString()})`,
        },
      };

      return {
        ...state,
        turnNumber: state.turnNumber + 1,
        players: nextPlayers,
        lastActionSummary: `${effectivePlayerId} sold ${effectiveAction.quantity} share(s) of ${companyName} at $${state.stockPrices[effectiveAction.companyId]}K for $${proceeds.toLocaleString()}`,
      };
    }

    case 'STOCKPILE_FINISH_SELLING': {
      const nextPlayers: Record<string, StockpilePlayerState> = {
        ...state.players,
        [effectivePlayerId]: {
          ...player,
          hasFinishedSelling: true,
          lastActionLabel: 'Finished Selling',
        },
      };

      const summary = `${effectivePlayerId} finished selling shares`;
      const allFinished = state.playerOrder.every((pid) => nextPlayers[pid]?.hasFinishedSelling);
      if (allFinished) {
        const updatedState: StockpileGameState = {
          ...state,
          turnNumber: state.turnNumber + 1,
          players: nextPlayers,
        };
        return executePhase6MarketMovement(updatedState, summary);
      }

      const nextPlayerIndex = (state.activePlayerIndex + 1) % n;
      return {
        ...state,
        turnNumber: state.turnNumber + 1,
        activePlayerIndex: nextPlayerIndex,
        players: nextPlayers,
        lastActionSummary: summary,
      };
    }

    case 'STOCKPILE_NEXT_ROUND': {
      const nextRound = state.roundNumber + 1;
      const nextFirstPlayerIndex = (state.firstPlayerIndex + 1) % n;
      return setupRoundPhase1And2(
        state.playerOrder,
        nextFirstPlayerIndex,
        nextRound,
        state.stockPrices,
        state.players,
        state.marketDeck,
        state.marketDiscard,
        state.prng,
        state.lastRoundMovements,
        `Round ${nextRound} of ${state.maxRounds} started — New Insider Information & Stockpiles dealt!`
      );
    }

    default:
      return state;
  }
}

export function getStockpilePlayerPerspective(
  state: StockpileGameState,
  playerId: string
): StockpileSanitizedGameState {
  const effectiveSelfId = state.players[playerId] ? playerId : state.playerOrder[0]!;
  const revealAll =
    state.turnStep === 'PHASE_6_MOVEMENT_SUMMARY' || state.phase === 'GAME_OVER';

  const toPublicPlayer = (p: StockpilePlayerState, isSelf: boolean): StockpilePublicPlayerState => ({
    id: p.id,
    cash: p.cash,
    portfolio: p.portfolio,
    supplyHandCount: p.supplyHand.length,
    supplyHand: isSelf ? p.supplyHand : null,
    hasPlacedSupply: p.hasPlacedSupply,
    pendingActionCards: p.pendingActionCards,
    outbidFromPileIndex: p.outbidFromPileIndex,
    hasFinishedSelling: p.hasFinishedSelling,
    insiderPairing: isSelf || revealAll ? p.insiderPairing : null,
    lastActionLabel: p.lastActionLabel,
    endGameStockLiquidation: p.endGameStockLiquidation,
    endGameMajorityBonus: p.endGameMajorityBonus,
  });

  const selfPlayer = toPublicPlayer(state.players[effectiveSelfId]!, true);
  const opponents: Record<string, StockpilePublicPlayerState> = {};
  for (const pid of state.playerOrder) {
    if (pid !== effectiveSelfId) {
      opponents[pid] = toPublicPlayer(state.players[pid]!, false);
    }
  }

  const stockpiles: StockpileSanitizedPile[] = state.stockpiles.map((pile) => ({
    index: pile.index,
    faceUpCards: pile.faceUpCards,
    faceDownCount: pile.faceDownCards.length,
    currentBid: pile.currentBid,
    highBidderId: pile.highBidderId,
  }));

  return {
    gameId: 'stockpile',
    phase: state.phase,
    turnStep: state.turnStep,
    turnNumber: state.turnNumber,
    roundNumber: state.roundNumber,
    maxRounds: state.maxRounds,
    playerOrder: state.playerOrder,
    firstPlayerIndex: state.firstPlayerIndex,
    activePlayerIndex: state.activePlayerIndex,
    activePlayerId: state.playerOrder[state.activePlayerIndex]!,
    stockPrices: state.stockPrices,
    marketDeckCount: state.marketDeck.length,
    marketDiscardCount: state.marketDiscard.length,
    publicPairing: state.publicPairing,
    revealedPairings: revealAll ? state.allPairings : null,
    stockpiles,
    self: selfPlayer,
    opponents,
    lastRoundMovements: state.lastRoundMovements,
    winnerId: state.winnerId,
    lastActionSummary: state.lastActionSummary,
  };
}

export function calculateStockpileNetWorth(
  state: StockpileGameState,
  playerId: string
): number {
  const player = state.players[playerId];
  if (!player) return 0;
  if (state.phase === 'GAME_OVER') {
    return player.cash;
  }
  let stockVal = 0;
  for (const cid of STOCKPILE_COMPANY_IDS) {
    stockVal += (player.portfolio[cid] ?? 0) * state.stockPrices[cid] * SHARE_UNIT_DOLLARS;
  }
  return player.cash + stockVal;
}

export function calculateStockpileFinalScores(
  state: StockpileGameState
): Record<string, number> {
  const scores: Record<string, number> = {};
  for (const pid of state.playerOrder) {
    scores[pid] = calculateStockpileNetWorth(state, pid);
  }
  return scores;
}
