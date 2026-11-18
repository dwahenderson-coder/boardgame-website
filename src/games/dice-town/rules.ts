import {
  createPRNG,
  nextInt,
  PRNGState,
  shuffleArray,
} from '../../common/prng.js';
import { Deck } from '../../mechanics/deck.js';
import { GameSetupOptions } from '../../types/game.js';
import { ValidationResult } from '../ticket-to-ride/types.js';
import {
  DiceTownCard,
  DOC_BADLUCK_CARDS,
  GENERAL_STORE_CARDS,
  PROPERTY_DEED_CARDS,
} from './diceTownCards.js';
import {
  ALL_DIE_FACES,
  DIE_FACE_RANK,
  DiceTownAction,
  DiceTownGameState,
  DiceTownLocation,
  DiceTownPokerHandCategory,
  DiceTownSanitizedState,
  DiceTownVPBreakdown,
  DieFace,
  EvaluatedPokerDiceHand,
  LOCATION_RESOLUTION_ORDER,
  LocationLeaderSummary,
  PlayerState,
  PokerDie,
  SanitizedOpponentState,
  SanitizedPokerDie,
  TownState,
} from './types.js';

// ============================================================================
// 5-Die Poker Hand Evaluator (`9`, `10`, `J`, `Q`, `K`, `A`)
// ============================================================================

export function evaluateDiceTownPokerHand(
  faces: readonly DieFace[]
): EvaluatedPokerDiceHand {
  const freqMap = new Map<number, number>();
  for (const face of faces) {
    const r = DIE_FACE_RANK[face];
    freqMap.set(r, (freqMap.get(r) ?? 0) + 1);
  }

  // Sort by count descending, then by rank descending
  const groups = Array.from(freqMap.entries()).sort((a, b) =>
    b[1] !== a[1] ? b[1] - a[1] : b[0] - a[0]
  );

  const counts = groups.map((g) => g[1]);
  const tiebreakerRanks = groups.map((g) => g[0]);

  const sortedUniqueRanks = Array.from(freqMap.keys()).sort((a, b) => b - a);
  const isStraight =
    sortedUniqueRanks.length === 5 &&
    sortedUniqueRanks[0]! - sortedUniqueRanks[4]! === 4;

  let category: DiceTownPokerHandCategory = 'HIGH_CARD';
  let categoryRank = 1;

  if (counts[0] === 5) {
    category = 'FIVE_OF_A_KIND';
    categoryRank = 8;
  } else if (counts[0] === 4) {
    category = 'FOUR_OF_A_KIND';
    categoryRank = 7;
  } else if (counts[0] === 3 && counts[1] === 2) {
    category = 'FULL_HOUSE';
    categoryRank = 6;
  } else if (isStraight) {
    category = 'STRAIGHT';
    categoryRank = 5;
  } else if (counts[0] === 3) {
    category = 'THREE_OF_A_KIND';
    categoryRank = 4;
  } else if (counts[0] === 2 && counts[1] === 2) {
    category = 'TWO_PAIR';
    categoryRank = 3;
  } else if (counts[0] === 2) {
    category = 'ONE_PAIR';
    categoryRank = 2;
  }

  return {
    category,
    categoryRank,
    tiebreakerRanks,
    label: category.replace(/_/g, ' '),
  };
}

/**
 * Returns > 0 if handA > handB, < 0 if handA < handB, or 0 if exact tie.
 */
export function comparePokerDiceHands(
  handA: EvaluatedPokerDiceHand,
  handB: EvaluatedPokerDiceHand
): number {
  if (handA.categoryRank !== handB.categoryRank) {
    return handA.categoryRank - handB.categoryRank;
  }
  const len = Math.max(
    handA.tiebreakerRanks.length,
    handB.tiebreakerRanks.length
  );
  for (let i = 0; i < len; i++) {
    const rA = handA.tiebreakerRanks[i] ?? 0;
    const rB = handB.tiebreakerRanks[i] ?? 0;
    if (rA !== rB) {
      return rA - rB;
    }
  }
  return 0;
}

export function countDieFace(
  dice: readonly PokerDie[],
  face: DieFace,
  onlyLockedPublic = true
): number {
  return dice.filter(
    (d) =>
      d.value === face && (!onlyLockedPublic || d.status === 'locked_public')
  ).length;
}

export function calculatePlayerVPBreakdown(
  player: PlayerState
): DiceTownVPBreakdown {
  const nuggetVP = player.nuggets * 1;
  const dollarVP = Math.floor(player.dollars / 2);
  const sheriffVP = player.isSheriff ? 5 : 0;
  const propertyDeedVP = player.propertyDeeds.reduce(
    (sum, card) => sum + card.vp,
    0
  );
  const bonusCardVP = player.handCards.reduce(
    (sum, card) => sum + (card.timing === 'PASSIVE_END_GAME' ? card.vp : 0),
    0
  );
  const totalVP =
    nuggetVP + dollarVP + sheriffVP + propertyDeedVP + bonusCardVP;

  return {
    nuggetVP,
    dollarVP,
    sheriffVP,
    propertyDeedVP,
    bonusCardVP,
    totalVP,
  };
}

function createInitialCupDice(): PokerDie[] {
  return Array.from({ length: 5 }, (_, idx) => ({
    index: idx,
    value: '9' as DieFace,
    status: 'in_cup' as const,
  }));
}

function refillPropertyRow(
  propertyDeckState: TownState['propertyDeck'],
  currentFaceUp: readonly DiceTownCard[]
): {
  propertyDeck: TownState['propertyDeck'];
  faceUpProperties: readonly DiceTownCard[];
} {
  const deck = Deck.fromState(propertyDeckState);
  const nextFaceUp = [...currentFaceUp];
  while (nextFaceUp.length < 3 && deck.drawCount > 0) {
    const drawn = deck.draw(1);
    if (drawn[0]) {
      nextFaceUp.push(drawn[0]);
    }
  }
  return {
    propertyDeck: deck.toState(),
    faceUpProperties: nextFaceUp,
  };
}

// ============================================================================
// 1. Initialization (`initDiceTownGame`)
// ============================================================================

export function initDiceTownGame(
  playerIds: string[],
  seed: number = 2026,
  _options?: GameSetupOptions
): DiceTownGameState {
  if (playerIds.length < 2 || playerIds.length > 5) {
    throw new Error(
      `Dice Town requires between 2 and 5 players (received ${playerIds.length}).`
    );
  }

  let prng = createPRNG(seed);

  // Initialize General Store Deck (19 cards)
  const storeDeck = new Deck<DiceTownCard>(GENERAL_STORE_CARDS, prng);
  prng = storeDeck.prngState;

  // Initialize Property Deed Deck (20 cards) and reveal up to 3 face-up properties
  const propDeck = new Deck<DiceTownCard>(PROPERTY_DEED_CARDS, prng);
  const initialFaceUp = propDeck.draw(3);
  prng = propDeck.prngState;

  // Initialize Doc Badluck Deck (7 Elixir cards)
  const badluckDeck = new Deck<DiceTownCard>(DOC_BADLUCK_CARDS, prng);
  prng = badluckDeck.prngState;

  const players: Record<string, PlayerState> = {};
  for (const pid of playerIds) {
    players[pid] = {
      id: pid,
      name: pid,
      dollars: 8,
      nuggets: 0,
      isSheriff: false,
      dice: createInitialCupDice(),
      handCards: [],
      propertyDeeds: [],
      protectedDeedIds: [],
      docBadluckCards: [],
      hasSubmittedSelection: false,
      stagedExtraDiceFee: 0,
      usedBruteThisStep: false,
      locationsWonThisRound: 0,
    };
  }

  const storeDeckState = storeDeck.toState();
  const town: TownState = {
    goldMineNuggets: 30,
    bankVaultDollars: 3, // Starts at $3; gains +$1 per round at ROUND_START
    generalStoreDeck: storeDeckState,
    discardPile: storeDeckState.discardPile,
    propertyDeck: propDeck.toState(),
    faceUpProperties: initialFaceUp,
    docBadluckDeck: badluckDeck.toState(),
  };

  return {
    gameId: 'dice_town',
    phase: 'ROUND_START',
    turnStep: 'ROUND_START',
    subState: 'IDLE',
    roundNumber: 1,
    turnNumber: 1,
    prng,
    playerOrder: [...playerIds],
    activePlayerIndex: 0,
    sheriffPlayerId: null,
    players,
    town,
    currentLocationIndex: 0,
    currentLocation: null,
    currentLocationWinnerId: null,
    sheriffTiebreaker: null,
    generalStorePending: null,
    saloonPending: null,
    docBadluckPending: null,
    docBadluckBonusVisitors: [],
    lastBankRobbery: null,
    lastPlayedStoreCard: null,
    finalVPByPlayer: null,
    winnerId: null,
    lastActionSummary:
      'Welcome to Dice Town! Each player starts with $8 and 5 Poker Dice. Start Round 1 to add $1 to the Bank Vault and roll!',
  };
}

// ============================================================================
// Location Contender & Leader Evaluation Helpers
// ============================================================================

export function evaluateLocationContenders(
  state: DiceTownGameState,
  location: DiceTownLocation
): {
  readonly leaderPlayerIds: string[];
  readonly bestCountOrRank: number;
  readonly bestValueLabel: string;
} {
  if (location === 'DOC_BADLUCK') {
    const eligible = state.playerOrder.filter(
      (pid) =>
        state.players[pid]!.locationsWonThisRound === 0 ||
        state.docBadluckBonusVisitors.includes(pid)
    );
    return {
      leaderPlayerIds: eligible,
      bestCountOrRank: eligible.length,
      bestValueLabel:
        eligible.length > 0 ? `${eligible.length} Visitor(s)` : 'None',
    };
  }

  if (location === 'TOWN_HALL') {
    let bestHand: EvaluatedPokerDiceHand | null = null;
    let leaders: string[] = [];
    for (const pid of state.playerOrder) {
      const p = state.players[pid]!;
      const evaluated = evaluateDiceTownPokerHand(p.dice.map((d) => d.value));
      if (!bestHand) {
        bestHand = evaluated;
        leaders = [pid];
      } else {
        const cmp = comparePokerDiceHands(evaluated, bestHand);
        if (cmp > 0) {
          bestHand = evaluated;
          leaders = [pid];
        } else if (cmp === 0) {
          leaders.push(pid);
        }
      }
    }
    return {
      leaderPlayerIds: leaders,
      bestCountOrRank: bestHand?.categoryRank ?? 0,
      bestValueLabel: bestHand?.label ?? 'None',
    };
  }

  const targetFaceMap: Record<
    Exclude<DiceTownLocation, 'TOWN_HALL' | 'DOC_BADLUCK'>,
    DieFace
  > = {
    GOLD_MINE: '9',
    BANK: '10',
    GENERAL_STORE: 'J',
    SALOON: 'Q',
    SHERIFF_OFFICE: 'K',
  };

  const targetFace = targetFaceMap[location];
  let maxCount = 0;
  let leaders: string[] = [];

  for (const pid of state.playerOrder) {
    const p = state.players[pid]!;
    // Count matching faces across all dice (during LOCATION_RESOLUTION all 5 are locked_public)
    const count = p.dice.filter((d) => d.value === targetFace).length;
    if (count > maxCount) {
      maxCount = count;
      leaders = [pid];
    } else if (count > 0 && count === maxCount) {
      leaders.push(pid);
    }
  }

  return {
    leaderPlayerIds: maxCount > 0 ? leaders : [],
    bestCountOrRank: maxCount,
    bestValueLabel: maxCount > 0 ? `${maxCount}x [${targetFace}]` : 'None',
  };
}

export function buildTownBoardLeaders(
  state: DiceTownGameState
): Record<DiceTownLocation, LocationLeaderSummary> {
  const result = {} as Record<DiceTownLocation, LocationLeaderSummary>;
  for (const loc of LOCATION_RESOLUTION_ORDER) {
    const evalRes = evaluateLocationContenders(state, loc);
    result[loc] = {
      location: loc,
      leaderPlayerIds: evalRes.leaderPlayerIds,
      isTie: evalRes.leaderPlayerIds.length > 1 && loc !== 'DOC_BADLUCK',
      bestValueLabel: evalRes.bestValueLabel,
    };
  }
  return result;
}

// ============================================================================
// Internal Resolution Engine Helpers
// ============================================================================

export function checkEndGameCondition(state: DiceTownGameState): boolean {
  const goldEmpty = state.town.goldMineNuggets <= 0;
  const deedsEmpty =
    state.town.propertyDeck.drawPile.length === 0 &&
    state.town.faceUpProperties.length === 0;
  return goldEmpty || deedsEmpty;
}

export function finalizeDiceTownGameOver(
  state: DiceTownGameState,
  summaryPrefix: string
): DiceTownGameState {
  const finalVPByPlayer: Record<string, DiceTownVPBreakdown> = {};
  let bestVP = -1;
  let bestDollars = -1;
  let winnerId: string | null = null;

  for (const pid of state.playerOrder) {
    const p = state.players[pid]!;
    const breakdown = calculatePlayerVPBreakdown(p);
    finalVPByPlayer[pid] = breakdown;
    if (
      breakdown.totalVP > bestVP ||
      (breakdown.totalVP === bestVP && p.dollars > bestDollars)
    ) {
      bestVP = breakdown.totalVP;
      bestDollars = p.dollars;
      winnerId = pid;
    }
  }

  return {
    ...state,
    phase: 'GAME_OVER',
    turnStep: 'GAME_OVER',
    subState: 'IDLE',
    currentLocation: null,
    sheriffTiebreaker: null,
    generalStorePending: null,
    saloonPending: null,
    docBadluckPending: null,
    finalVPByPlayer,
    winnerId,
    lastActionSummary: `${summaryPrefix} — Game Over! ${winnerId} wins Dice Town with ${bestVP} VP!`,
  };
}

function applyDocBadluckQueue(
  state: DiceTownGameState,
  queue: readonly string[],
  logMessages: string[]
): DiceTownGameState {
  let currentState = state;
  let currentPrng = state.prng;
  const nextPlayers: Record<string, PlayerState> = { ...state.players };
  let deck = Deck.fromState(state.town.docBadluckDeck);
  let storeDeck = Deck.fromState(state.town.generalStoreDeck);
  let sheriffId = state.sheriffPlayerId;

  for (let i = 0; i < queue.length; i++) {
    const visitorId = queue[i]!;
    const drawn = deck.draw(1);
    const elixir = drawn[0];
    if (!elixir) {
      logMessages.push(
        `${visitorId} visited Doc Badluck, but the Elixir deck is empty.`
      );
      continue;
    }

    const visitor = nextPlayers[visitorId]!;
    switch (elixir.effectType) {
      case 'COLLECT_FROM_ALL_DOLLARS': {
        let totalCollected = 0;
        for (const otherId of state.playerOrder) {
          if (otherId === visitorId) continue;
          const opp = nextPlayers[otherId]!;
          const give = Math.min(2, opp.dollars);
          totalCollected += give;
          nextPlayers[otherId] = { ...opp, dollars: opp.dollars - give };
        }
        nextPlayers[visitorId] = {
          ...nextPlayers[visitorId]!,
          dollars: nextPlayers[visitorId]!.dollars + totalCollected,
        };
        deck.discard(elixir);
        logMessages.push(
          `${visitorId} drew ${elixir.displayName} and collected $${totalCollected} from opponents.`
        );
        break;
      }

      case 'COLLECT_FROM_ALL_NUGGETS': {
        let totalNuggets = 0;
        for (const otherId of state.playerOrder) {
          if (otherId === visitorId) continue;
          const opp = nextPlayers[otherId]!;
          const give = Math.min(1, opp.nuggets);
          totalNuggets += give;
          nextPlayers[otherId] = { ...opp, nuggets: opp.nuggets - give };
        }
        nextPlayers[visitorId] = {
          ...nextPlayers[visitorId]!,
          nuggets: nextPlayers[visitorId]!.nuggets + totalNuggets,
        };
        deck.discard(elixir);
        logMessages.push(
          `${visitorId} drew ${elixir.displayName} and collected ${totalNuggets} nugget(s) from opponents.`
        );
        break;
      }

      case 'DRAW_GENERAL_STORE': {
        const storeDrawn = storeDeck.draw(1);
        if (storeDrawn[0]) {
          nextPlayers[visitorId] = {
            ...nextPlayers[visitorId]!,
            handCards: [...nextPlayers[visitorId]!.handCards, storeDrawn[0]],
          };
        }
        deck.discard(elixir);
        logMessages.push(
          `${visitorId} drew ${elixir.displayName} and drew 1 General Store card.`
        );
        break;
      }

      case 'CLAIM_SHERIFF': {
        for (const pid of state.playerOrder) {
          nextPlayers[pid] = {
            ...nextPlayers[pid]!,
            isSheriff: pid === visitorId,
          };
        }
        sheriffId = visitorId;
        deck.discard(elixir);
        logMessages.push(
          `${visitorId} drew ${elixir.displayName} and immediately claimed the Sheriff Badge!`
        );
        break;
      }

      case 'PROTECT_PROPERTY_DEEDS': {
        const unprotected = visitor.propertyDeeds
          .filter((d) => !visitor.protectedDeedIds.includes(d.id))
          .slice(0, 2)
          .map((d) => d.id);
        nextPlayers[visitorId] = {
          ...nextPlayers[visitorId]!,
          protectedDeedIds: [...visitor.protectedDeedIds, ...unprotected],
        };
        deck.discard(elixir);
        logMessages.push(
          `${visitorId} drew ${elixir.displayName} and protected ${unprotected.length} Property Deed(s).`
        );
        break;
      }

      case 'DEMAND_GENERAL_STORE_CARD':
      case 'DEMAND_PROPERTY_DEED': {
        const wantStore = elixir.effectType === 'DEMAND_GENERAL_STORE_CARD';
        const eligibleTargets = state.playerOrder.filter((otherId) => {
          if (otherId === visitorId) return false;
          const opp = nextPlayers[otherId]!;
          if (wantStore) return opp.handCards.length > 0;
          return opp.propertyDeeds.some(
            (d) => !opp.protectedDeedIds.includes(d.id)
          );
        });

        if (eligibleTargets.length === 0) {
          deck.discard(elixir);
          logMessages.push(
            `${visitorId} drew ${elixir.displayName}, but no opponent had an eligible card to give.`
          );
          break;
        }

        // Pause for target selection if interactive, or if only 1 target & 1 card auto-resolve
        deck.discard(elixir);
        const updatedStoreState = storeDeck.toState();
        return {
          ...currentState,
          prng: currentPrng,
          sheriffPlayerId: sheriffId,
          players: nextPlayers,
          town: {
            ...currentState.town,
            generalStoreDeck: updatedStoreState,
            discardPile: updatedStoreState.discardPile,
            docBadluckDeck: deck.toState(),
          },
          subState: 'DOC_BADLUCK_TARGET',
          docBadluckPending: {
            playerId: visitorId,
            card: elixir,
            pendingQueuePlayerIds: queue.slice(i + 1),
          },
          lastActionSummary: `${logMessages.join(' ')} ${visitorId} drew ${elixir.displayName} — select an opponent to demand a card from!`.trim(),
        };
      }
    }
  }

  const updatedStoreState = storeDeck.toState();
  currentState = {
    ...currentState,
    prng: currentPrng,
    sheriffPlayerId: sheriffId,
    players: nextPlayers,
    town: {
      ...currentState.town,
      generalStoreDeck: updatedStoreState,
      discardPile: updatedStoreState.discardPile,
      docBadluckDeck: deck.toState(),
    },
    subState: 'IDLE',
    docBadluckPending: null,
  };

  return finishLocationAndAdvance(
    currentState,
    logMessages.length > 0
      ? logMessages.join(' ')
      : 'Doc Badluck resolved (no visitors needed).'
  );
}

/**
 * Resolves the winner `winnerId` at `location` (either outright winner or chosen by Sheriff tie-breaker).
 */
export function resolveLocationWinner(
  state: DiceTownGameState,
  location: DiceTownLocation,
  winnerId: string | null,
  summaryPrefix = ''
): DiceTownGameState {
  const prefix = summaryPrefix ? `${summaryPrefix} ` : '';

  if (location === 'DOC_BADLUCK') {
    const visitors = state.playerOrder.filter(
      (pid) =>
        state.players[pid]!.locationsWonThisRound === 0 ||
        state.docBadluckBonusVisitors.includes(pid)
    );
    return applyDocBadluckQueue(
      state,
      visitors,
      prefix ? [prefix.trim()] : []
    );
  }

  if (winnerId === null) {
    return finishLocationAndAdvance(
      state,
      `${prefix}No player won ${location}.`
    );
  }

  const winner = state.players[winnerId]!;
  const nextPlayers: Record<string, PlayerState> = {
    ...state.players,
    [winnerId]: {
      ...winner,
      locationsWonThisRound: winner.locationsWonThisRound + 1,
    },
  };

  switch (location) {
    case 'GOLD_MINE': {
      const ninesCount = countDieFace(winner.dice, '9', false);
      const nuggetsTaken = Math.min(state.town.goldMineNuggets, ninesCount);
      nextPlayers[winnerId] = {
        ...nextPlayers[winnerId]!,
        nuggets: winner.nuggets + nuggetsTaken,
      };
      return finishLocationAndAdvance(
        {
          ...state,
          players: nextPlayers,
          currentLocationWinnerId: winnerId,
          town: {
            ...state.town,
            goldMineNuggets: state.town.goldMineNuggets - nuggetsTaken,
          },
        },
        `${prefix}${winnerId} won Gold Mine (${ninesCount}x 9s) and took ${nuggetsTaken} gold nugget(s)!`
      );
    }

    case 'BANK': {
      const vaultCash = state.town.bankVaultDollars;
      nextPlayers[winnerId] = {
        ...nextPlayers[winnerId]!,
        dollars: winner.dollars + vaultCash,
      };
      return finishLocationAndAdvance(
        {
          ...state,
          players: nextPlayers,
          currentLocationWinnerId: winnerId,
          lastBankRobbery: {
            winnerId,
            amountStolen: vaultCash,
          },
          town: {
            ...state.town,
            bankVaultDollars: 0,
          },
        },
        `${prefix}${winnerId} robbed the Bank and took $${vaultCash}!`
      );
    }

    case 'GENERAL_STORE': {
      const jacksCount = Math.max(1, countDieFace(winner.dice, 'J', false));
      const storeDeck = Deck.fromState(state.town.generalStoreDeck);
      const drawn = storeDeck.draw(jacksCount);
      const nextStoreDeckState = storeDeck.toState();

      if (drawn.length === 0) {
        return finishLocationAndAdvance(
          {
            ...state,
            players: nextPlayers,
            currentLocationWinnerId: winnerId,
          },
          `${prefix}${winnerId} won General Store, but the deck is empty.`
        );
      }

      if (drawn.length === 1) {
        const kept = drawn[0]!;
        nextPlayers[winnerId] = {
          ...nextPlayers[winnerId]!,
          handCards: [...winner.handCards, kept],
        };
        return finishLocationAndAdvance(
          {
            ...state,
            players: nextPlayers,
            currentLocationWinnerId: winnerId,
            town: {
              ...state.town,
              generalStoreDeck: nextStoreDeckState,
              discardPile: nextStoreDeckState.discardPile,
            },
          },
          `${prefix}${winnerId} won General Store (1x J) and drew 1 card.`
        );
      }

      // Multiple cards drawn -> prompt winner to keep 1 and discard the rest
      return {
        ...state,
        players: nextPlayers,
        currentLocationWinnerId: winnerId,
        subState: 'GENERAL_STORE_PICK',
        generalStorePending: {
          winnerPlayerId: winnerId,
          drawnCards: drawn,
          remainingVisits: 0,
        },
        town: {
          ...state.town,
          generalStoreDeck: nextStoreDeckState,
          discardPile: nextStoreDeckState.discardPile,
        },
        lastActionSummary: `${prefix}${winnerId} won General Store (${jacksCount}x J) and drew ${drawn.length} cards — choose 1 card to keep!`,
      };
    }

    case 'SALOON': {
      const queensCount = Math.max(1, countDieFace(winner.dice, 'Q', false));
      const opponentsWithCards = state.playerOrder.filter(
        (pid) => pid !== winnerId && state.players[pid]!.handCards.length > 0
      );

      if (opponentsWithCards.length === 0) {
        return finishLocationAndAdvance(
          {
            ...state,
            players: nextPlayers,
            currentLocationWinnerId: winnerId,
          },
          `${prefix}${winnerId} won Saloon (${queensCount}x Q), but no opponent has any General Store cards in hand.`
        );
      }

      // If only 1 opponent has cards, automatically reveal up to X random cards from their hand
      if (opponentsWithCards.length === 1) {
        const targetId = opponentsWithCards[0]!;
        const targetHand = state.players[targetId]!.handCards;
        const shuffled = shuffleArray(targetHand, state.prng);
        const candidateCards = shuffled.value.slice(
          0,
          Math.min(queensCount, targetHand.length)
        );

        return {
          ...state,
          prng: shuffled.prng,
          players: nextPlayers,
          currentLocationWinnerId: winnerId,
          subState: 'SALOON_STEAL',
          saloonPending: {
            winnerPlayerId: winnerId,
            queensCount,
            targetOpponentId: targetId,
            revealedCandidateCards: candidateCards,
            remainingSteals: 0,
          },
          lastActionSummary: `${prefix}${winnerId} won Saloon (${queensCount}x Q) and is viewing ${candidateCards.length} card(s) from ${targetId}'s hand to steal 1!`,
        };
      }

      return {
        ...state,
        players: nextPlayers,
        currentLocationWinnerId: winnerId,
        subState: 'SALOON_STEAL',
        saloonPending: {
          winnerPlayerId: winnerId,
          queensCount,
          targetOpponentId: null,
          revealedCandidateCards: [],
          remainingSteals: 0,
        },
        lastActionSummary: `${prefix}${winnerId} won Saloon (${queensCount}x Q) — select an opponent to steal 1 card from!`,
      };
    }

    case 'SHERIFF_OFFICE': {
      for (const pid of state.playerOrder) {
        nextPlayers[pid] = {
          ...nextPlayers[pid]!,
          isSheriff: pid === winnerId,
        };
      }
      return finishLocationAndAdvance(
        {
          ...state,
          sheriffPlayerId: winnerId,
          players: nextPlayers,
          currentLocationWinnerId: winnerId,
        },
        `${prefix}${winnerId} won Sheriff's Office and claimed the Sheriff's Star!`
      );
    }

    case 'TOWN_HALL': {
      const acesCount = countDieFace(winner.dice, 'A', false);
      const desiredDeeds = Math.min(3, 1 + acesCount);

      let currentFaceUp = [...state.town.faceUpProperties];
      let propDeck = Deck.fromState(state.town.propertyDeck);
      const claimedDeeds: DiceTownCard[] = [];

      for (let i = 0; i < desiredDeeds; i++) {
        if (currentFaceUp.length === 0 && propDeck.drawCount > 0) {
          currentFaceUp.push(...propDeck.draw(1));
        }
        if (currentFaceUp.length > 0) {
          claimedDeeds.push(currentFaceUp.shift()!);
        }
      }

      // Refill faceUpProperties back up to 3
      const refilled = refillPropertyRow(propDeck.toState(), currentFaceUp);

      nextPlayers[winnerId] = {
        ...nextPlayers[winnerId]!,
        propertyDeeds: [...winner.propertyDeeds, ...claimedDeeds],
      };

      const totalDeedVP = claimedDeeds.reduce((s, c) => s + c.vp, 0);
      return finishLocationAndAdvance(
        {
          ...state,
          players: nextPlayers,
          currentLocationWinnerId: winnerId,
          town: {
            ...state.town,
            propertyDeck: refilled.propertyDeck,
            faceUpProperties: refilled.faceUpProperties,
          },
        },
        `${prefix}${winnerId} won Town Hall (1 + ${acesCount} Ace bonus) and claimed ${claimedDeeds.length} Property Deed(s) worth ${totalDeedVP} VP!`
      );
    }
  }
}

/**
 * Evaluates `state.currentLocationIndex` in `LOCATION_RESOLUTION_ORDER`.
 * If a tie occurs, transitions to `SHERIFF_TIEBREAKER` (if a Sheriff exists) or skips if no Sheriff exists.
 */
export function evaluateCurrentLocationStep(
  state: DiceTownGameState,
  summaryPrefix = ''
): DiceTownGameState {
  if (state.currentLocationIndex >= LOCATION_RESOLUTION_ORDER.length) {
    // All locations resolved -> check end game
    if (checkEndGameCondition(state)) {
      return finalizeDiceTownGameOver(state, summaryPrefix || 'Round complete');
    }
    return {
      ...state,
      phase: 'END_GAME_CHECK',
      turnStep: 'END_GAME_CHECK',
      subState: 'IDLE',
      currentLocation: null,
      sheriffTiebreaker: null,
      lastActionSummary: `${summaryPrefix} All locations resolved for Round ${state.roundNumber}. Ready for End-of-Round check / Next Round!`.trim(),
    };
  }

  const location = LOCATION_RESOLUTION_ORDER[state.currentLocationIndex]!;
  const stateAtLoc: DiceTownGameState = {
    ...state,
    phase: 'LOCATION_RESOLUTION',
    turnStep: 'LOCATION_RESOLUTION',
    currentLocation: location,
    currentLocationWinnerId: null,
    sheriffTiebreaker: null,
  };

  if (location === 'DOC_BADLUCK') {
    return resolveLocationWinner(stateAtLoc, 'DOC_BADLUCK', null, summaryPrefix);
  }

  const contenders = evaluateLocationContenders(stateAtLoc, location);
  if (contenders.leaderPlayerIds.length === 0) {
    return resolveLocationWinner(stateAtLoc, location, null, summaryPrefix);
  }

  if (contenders.leaderPlayerIds.length === 1) {
    return resolveLocationWinner(
      stateAtLoc,
      location,
      contenders.leaderPlayerIds[0]!,
      summaryPrefix
    );
  }

  // Tie occurred!
  if (!stateAtLoc.sheriffPlayerId) {
    // Rulebook: If no Sheriff exists yet, no one wins the tied location!
    return resolveLocationWinner(
      stateAtLoc,
      location,
      null,
      `${summaryPrefix} Tie at ${location} (${contenders.leaderPlayerIds.join(', ')}) with no Sheriff in office — nobody wins ${location}!`.trim()
    );
  }

  // Transition to SHERIFF_TIEBREAKER interrupt state!
  return {
    ...stateAtLoc,
    subState: 'SHERIFF_TIEBREAKER',
    sheriffTiebreaker: {
      location,
      sheriffPlayerId: stateAtLoc.sheriffPlayerId,
      tiedPlayerIds: contenders.leaderPlayerIds,
    },
    lastActionSummary: `${summaryPrefix} Tie at ${location} between ${contenders.leaderPlayerIds.join(', ')}! Sheriff ${stateAtLoc.sheriffPlayerId} must choose the winner.`.trim(),
  };
}

function finishLocationAndAdvance(
  state: DiceTownGameState,
  stepSummary: string
): DiceTownGameState {
  // Check if Gold Mine or Property Deeds ran out mid-resolution (Rulebook: Town Hall or Gold Mine emptying triggers end of game after current resolution)
  const nextIndex = state.currentLocationIndex + 1;
  if (nextIndex >= LOCATION_RESOLUTION_ORDER.length) {
    if (checkEndGameCondition(state)) {
      return finalizeDiceTownGameOver(state, stepSummary);
    }
    return {
      ...state,
      phase: 'END_GAME_CHECK',
      turnStep: 'END_GAME_CHECK',
      subState: 'IDLE',
      currentLocationIndex: nextIndex,
      currentLocation: null,
      sheriffTiebreaker: null,
      generalStorePending: null,
      saloonPending: null,
      docBadluckPending: null,
      lastActionSummary: `${stepSummary} — Round ${state.roundNumber} resolution complete!`,
    };
  }

  return evaluateCurrentLocationStep(
    {
      ...state,
      subState: 'IDLE',
      currentLocationIndex: nextIndex,
      generalStorePending: null,
      saloonPending: null,
      docBadluckPending: null,
    },
    stepSummary
  );
}

// ============================================================================
// 2. Action Validation (`validateDiceTownAction`)
// ============================================================================

export function validateDiceTownAction(
  state: DiceTownGameState,
  playerId: string,
  action: DiceTownAction
): ValidationResult {
  if (state.phase === 'GAME_OVER') {
    return { valid: false, reason: 'The game is already over.' };
  }

  const player = state.players[playerId];
  if (!player) {
    return { valid: false, reason: `Unknown player "${playerId}".` };
  }

  switch (action.type) {
    case 'DT_START_ROUND': {
      if (
        state.phase !== 'ROUND_START' &&
        state.phase !== 'END_GAME_CHECK'
      ) {
        return {
          valid: false,
          reason: `Cannot start a round during phase ${state.phase}.`,
        };
      }
      return { valid: true };
    }

    case 'DT_ROLL_DICE': {
      if (state.phase !== 'SIMULTANEOUS_ROLL') {
        return {
          valid: false,
          reason: 'Dice can only be rolled during SIMULTANEOUS_ROLL.',
        };
      }
      return { valid: true };
    }

    case 'DT_SELECT_DICE': {
      if (state.phase !== 'SECRET_SELECTION') {
        return {
          valid: false,
          reason: 'Dice can only be selected during SECRET_SELECTION.',
        };
      }
      const inCupDice = player.dice.filter((d) => d.status === 'in_cup');
      if (inCupDice.length === 0) {
        return {
          valid: false,
          reason: 'All 5 of your dice are already locked.',
        };
      }
      if (player.hasSubmittedSelection) {
        return {
          valid: false,
          reason: 'You have already submitted your dice selection for this roll.',
        };
      }

      const targetIndices = action.lockAllRemaining
        ? inCupDice.map((d) => d.index)
        : [...new Set(action.dieIndices)];

      if (targetIndices.length < 1) {
        return {
          valid: false,
          reason: 'You must select at least 1 in_cup die to keep.',
        };
      }

      for (const idx of targetIndices) {
        const die = player.dice[idx];
        if (!die || die.status !== 'in_cup') {
          return {
            valid: false,
            reason: `Die at index ${idx} is not currently in_cup.`,
          };
        }
      }

      const extraDiceCount = Math.max(0, targetIndices.length - 1);
      let bruteUsed = false;
      if (action.playBruteCardId) {
        const card = player.handCards.find(
          (c) =>
            c.id === action.playBruteCardId &&
            c.effectType === 'FREE_KEEP_EXTRA_DICE'
        );
        if (!card) {
          return {
            valid: false,
            reason: 'You do not hold the specified Brute card.',
          };
        }
        bruteUsed = true;
      }

      if (!bruteUsed && player.dollars < extraDiceCount) {
        return {
          valid: false,
          reason: `Keeping ${targetIndices.length} dice costs $${extraDiceCount} ($1 per extra die beyond the first), but you only have $${player.dollars}.`,
        };
      }

      if (action.cheaterCardId) {
        const cheaterCard = player.handCards.find(
          (c) =>
            c.id === action.cheaterCardId && c.effectType === 'SET_DIE_FACE'
        );
        if (!cheaterCard) {
          return {
            valid: false,
            reason: 'You do not hold the specified Professional Cheater card.',
          };
        }
        if (
          action.cheaterDieIndex === undefined ||
          !targetIndices.includes(action.cheaterDieIndex) ||
          !action.cheaterTargetFace ||
          !ALL_DIE_FACES.includes(action.cheaterTargetFace)
        ) {
          return {
            valid: false,
            reason:
              'Professional Cheater requires a valid kept die index and target face.',
          };
        }
      }

      return { valid: true };
    }

    case 'DT_REVEAL_DICE': {
      if (state.phase !== 'REVEAL_STEP') {
        return {
          valid: false,
          reason: 'Cannot reveal dice outside of REVEAL_STEP.',
        };
      }
      return { valid: true };
    }

    case 'DT_SHERIFF_BREAK_TIE': {
      if (
        state.phase !== 'LOCATION_RESOLUTION' ||
        state.subState !== 'SHERIFF_TIEBREAKER' ||
        !state.sheriffTiebreaker
      ) {
        return {
          valid: false,
          reason: 'There is no active Sheriff tie-breaker.',
        };
      }
      if (playerId !== state.sheriffTiebreaker.sheriffPlayerId) {
        return {
          valid: false,
          reason: `Only the current Sheriff (${state.sheriffTiebreaker.sheriffPlayerId}) can break ties.`,
        };
      }
      if (!state.sheriffTiebreaker.tiedPlayerIds.includes(action.chosenWinnerId)) {
        return {
          valid: false,
          reason: `Chosen player "${action.chosenWinnerId}" is not one of the tied players (${state.sheriffTiebreaker.tiedPlayerIds.join(', ')}).`,
        };
      }
      return { valid: true };
    }

    case 'DT_GENERAL_STORE_PICK_CARD': {
      if (
        state.phase !== 'LOCATION_RESOLUTION' ||
        state.subState !== 'GENERAL_STORE_PICK' ||
        !state.generalStorePending
      ) {
        return {
          valid: false,
          reason: 'No General Store card draw is awaiting selection.',
        };
      }
      if (playerId !== state.generalStorePending.winnerPlayerId) {
        return {
          valid: false,
          reason: `Waiting for ${state.generalStorePending.winnerPlayerId} to pick a General Store card.`,
        };
      }
      if (
        !state.generalStorePending.drawnCards.some(
          (c) => c.id === action.cardId
        )
      ) {
        return {
          valid: false,
          reason: 'Selected card is not among the drawn General Store cards.',
        };
      }
      return { valid: true };
    }

    case 'DT_SALOON_SELECT_OPPONENT': {
      if (
        state.phase !== 'LOCATION_RESOLUTION' ||
        state.subState !== 'SALOON_STEAL' ||
        !state.saloonPending
      ) {
        return {
          valid: false,
          reason: 'No Saloon action is currently active.',
        };
      }
      if (playerId !== state.saloonPending.winnerPlayerId) {
        return {
          valid: false,
          reason: `Waiting for ${state.saloonPending.winnerPlayerId} to choose a Saloon target.`,
        };
      }
      const target = state.players[action.targetPlayerId];
      if (!target || action.targetPlayerId === playerId) {
        return { valid: false, reason: 'Must target a valid opponent.' };
      }
      if (target.handCards.length === 0) {
        return {
          valid: false,
          reason: `${action.targetPlayerId} has no General Store cards in hand.`,
        };
      }
      return { valid: true };
    }

    case 'DT_SALOON_STEAL_CARD': {
      if (
        state.phase !== 'LOCATION_RESOLUTION' ||
        state.subState !== 'SALOON_STEAL' ||
        !state.saloonPending ||
        !state.saloonPending.targetOpponentId
      ) {
        return {
          valid: false,
          reason: 'Select a Saloon target opponent first.',
        };
      }
      if (playerId !== state.saloonPending.winnerPlayerId) {
        return {
          valid: false,
          reason: `Waiting for ${state.saloonPending.winnerPlayerId} to steal a card.`,
        };
      }
      if (
        !state.saloonPending.revealedCandidateCards.some(
          (c) => c.id === action.cardId
        )
      ) {
        return {
          valid: false,
          reason:
            'Chosen card is not among the revealed candidate cards from the opponent.',
        };
      }
      return { valid: true };
    }

    case 'DT_RESOLVE_DOC_BADLUCK_DEMAND': {
      if (
        state.phase !== 'LOCATION_RESOLUTION' ||
        state.subState !== 'DOC_BADLUCK_TARGET' ||
        !state.docBadluckPending
      ) {
        return {
          valid: false,
          reason: 'No Doc Badluck demand is currently pending.',
        };
      }
      if (playerId !== state.docBadluckPending.playerId) {
        return {
          valid: false,
          reason: `Waiting for ${state.docBadluckPending.playerId} to resolve Doc Badluck.`,
        };
      }
      const target = state.players[action.targetPlayerId];
      if (!target || action.targetPlayerId === playerId) {
        return { valid: false, reason: 'Invalid target opponent.' };
      }
      return { valid: true };
    }

    case 'DT_PLAY_CARD': {
      const card = player.handCards.find((c) => c.id === action.cardId);
      if (!card) {
        return {
          valid: false,
          reason: `You do not hold card "${action.cardId}" in your hand.`,
        };
      }
      if (card.timing === 'PASSIVE_END_GAME') {
        return {
          valid: false,
          reason:
            'Equipment cards are scored passively at the end of the game.',
        };
      }
      return { valid: true };
    }

    case 'DT_ADVANCE_RESOLUTION': {
      return { valid: true };
    }

    default:
      return { valid: false, reason: 'Unsupported Dice Town action.' };
  }
}

// ============================================================================
// 3. Pure Deterministic State Transition (`applyDiceTownAction`)
// ============================================================================

export function applyDiceTownAction(
  state: DiceTownGameState,
  playerId: string,
  action: DiceTownAction
): DiceTownGameState {
  const check = validateDiceTownAction(state, playerId, action);
  if (!check.valid) {
    throw new Error(check.reason ?? 'Invalid Dice Town action.');
  }

  // 1. ROUND_START: Add +$1 to bankVaultDollars & reset all players' 5 dice to in_cup
  if (action.type === 'DT_START_ROUND') {
    if (state.phase === 'END_GAME_CHECK' && checkEndGameCondition(state)) {
      return finalizeDiceTownGameOver(state, 'End-of-game condition met');
    }

    const nextRoundNumber =
      state.phase === 'END_GAME_CHECK'
        ? state.roundNumber + 1
        : state.roundNumber;

    const nextPlayers: Record<string, PlayerState> = {};
    for (const pid of state.playerOrder) {
      const p = state.players[pid]!;
      nextPlayers[pid] = {
        ...p,
        dice: createInitialCupDice(),
        hasSubmittedSelection: false,
        stagedExtraDiceFee: 0,
        usedBruteThisStep: false,
        locationsWonThisRound: 0,
      };
    }

    const nextBankVault = state.town.bankVaultDollars + 1;

    return {
      ...state,
      phase: 'SIMULTANEOUS_ROLL',
      turnStep: 'SIMULTANEOUS_ROLL',
      subState: 'IDLE',
      roundNumber: nextRoundNumber,
      turnNumber: state.turnNumber + 1,
      players: nextPlayers,
      town: {
        ...state.town,
        bankVaultDollars: nextBankVault,
      },
      currentLocationIndex: 0,
      currentLocation: null,
      currentLocationWinnerId: null,
      sheriffTiebreaker: null,
      generalStorePending: null,
      saloonPending: null,
      docBadluckPending: null,
      docBadluckBonusVisitors: [],
      lastBankRobbery: null,
      lastActionSummary: `Round ${nextRoundNumber} started! +$1 added to the Bank Vault (now $${nextBankVault}). All players' dice reset to in_cup.`,
    };
  }

  // 2. SIMULTANEOUS_ROLL: Server rolls all `in_cup` dice privately for each player
  if (action.type === 'DT_ROLL_DICE') {
    let prng = state.prng;
    const nextPlayers: Record<string, PlayerState> = {};

    for (const pid of state.playerOrder) {
      const p = state.players[pid]!;
      const rolledDice: PokerDie[] = p.dice.map((die) => {
        if (die.status !== 'in_cup') {
          return die;
        }
        const roll = nextInt(prng, 0, ALL_DIE_FACES.length - 1);
        prng = roll.prng;
        return {
          ...die,
          value: ALL_DIE_FACES[roll.value]!,
          status: 'in_cup' as const,
        };
      });

      const hasInCup = rolledDice.some((d) => d.status === 'in_cup');
      nextPlayers[pid] = {
        ...p,
        dice: rolledDice,
        hasSubmittedSelection: !hasInCup,
        stagedExtraDiceFee: 0,
        usedBruteThisStep: false,
      };
    }

    return {
      ...state,
      prng,
      phase: 'SECRET_SELECTION',
      turnStep: 'SECRET_SELECTION',
      turnNumber: state.turnNumber + 1,
      players: nextPlayers,
      lastActionSummary:
        'All in_cup dice rolled privately! Select at least 1 die to keep (extra dice beyond the 1st cost $1 each).',
    };
  }

  // 3. SECRET_SELECTION: Each player stages >= 1 `in_cup` die (`staged_hidden`)
  if (action.type === 'DT_SELECT_DICE') {
    const p = state.players[playerId]!;
    const inCupDice = p.dice.filter((d) => d.status === 'in_cup');
    const selectedSet = new Set<number>(
      action.lockAllRemaining
        ? inCupDice.map((d) => d.index)
        : action.dieIndices
    );

    const extraDiceCount = Math.max(0, selectedSet.size - 1);
    const fee = action.playBruteCardId ? 0 : extraDiceCount;

    let updatedHand = [...p.handCards];
    let storeDeck = Deck.fromState(state.town.generalStoreDeck);

    if (action.playBruteCardId) {
      const card = updatedHand.find((c) => c.id === action.playBruteCardId)!;
      updatedHand = updatedHand.filter((c) => c.id !== action.playBruteCardId);
      storeDeck.discard(card);
    }

    if (action.cheaterCardId) {
      const card = updatedHand.find((c) => c.id === action.cheaterCardId)!;
      updatedHand = updatedHand.filter((c) => c.id !== action.cheaterCardId);
      storeDeck.discard(card);
    }

    const updatedDice: PokerDie[] = p.dice.map((die) => {
      if (!selectedSet.has(die.index)) {
        return die;
      }
      const nextValue =
        action.cheaterCardId &&
        action.cheaterDieIndex === die.index &&
        action.cheaterTargetFace
          ? action.cheaterTargetFace
          : die.value;
      return {
        ...die,
        value: nextValue,
        status: 'staged_hidden' as const,
      };
    });

    const nextPlayers: Record<string, PlayerState> = {
      ...state.players,
      [playerId]: {
        ...p,
        dice: updatedDice,
        handCards: updatedHand,
        hasSubmittedSelection: true,
        stagedExtraDiceFee: fee,
        usedBruteThisStep: Boolean(action.playBruteCardId),
      },
    };

    const allSubmitted = state.playerOrder.every(
      (pid) => nextPlayers[pid]!.hasSubmittedSelection
    );

    const nextStoreState = storeDeck.toState();

    return {
      ...state,
      phase: allSubmitted ? 'REVEAL_STEP' : 'SECRET_SELECTION',
      turnStep: allSubmitted ? 'REVEAL_STEP' : 'SECRET_SELECTION',
      turnNumber: state.turnNumber + 1,
      players: nextPlayers,
      town: {
        ...state.town,
        generalStoreDeck: nextStoreState,
        discardPile: nextStoreState.discardPile,
      },
      lastActionSummary: allSubmitted
        ? 'All players have staged their secret dice! Ready for REVEAL_STEP.'
        : `${playerId} staged ${selectedSet.size} die/dice under the cup.`,
    };
  }

  // 4. REVEAL_STEP: Deduct $1 extra-die fees (to general supply, NOT Bank vault) & transition staged_hidden -> locked_public
  if (action.type === 'DT_REVEAL_DICE') {
    const nextPlayers: Record<string, PlayerState> = {};
    let anyStillInCup = false;

    for (const pid of state.playerOrder) {
      const p = state.players[pid]!;
      const revealedDice: PokerDie[] = p.dice.map((d) =>
        d.status === 'staged_hidden'
          ? { ...d, status: 'locked_public' as const }
          : d
      );
      if (revealedDice.some((d) => d.status === 'in_cup')) {
        anyStillInCup = true;
      }
      nextPlayers[pid] = {
        ...p,
        dollars: Math.max(0, p.dollars - p.stagedExtraDiceFee),
        dice: revealedDice,
        hasSubmittedSelection: !revealedDice.some(
          (d) => d.status === 'in_cup'
        ),
        stagedExtraDiceFee: 0,
        usedBruteThisStep: false,
      };
    }

    if (anyStillInCup) {
      return {
        ...state,
        phase: 'SIMULTANEOUS_ROLL',
        turnStep: 'SIMULTANEOUS_ROLL',
        turnNumber: state.turnNumber + 1,
        players: nextPlayers,
        lastActionSummary:
          'Staged dice revealed and extra-die fees paid to the general supply! Players with remaining dice return to SIMULTANEOUS_ROLL.',
      };
    }

    // All players now have 5 locked_public dice -> advance to LOCATION_RESOLUTION!
    const preResolutionState: DiceTownGameState = {
      ...state,
      phase: 'LOCATION_RESOLUTION',
      turnStep: 'LOCATION_RESOLUTION',
      turnNumber: state.turnNumber + 1,
      players: nextPlayers,
      currentLocationIndex: 0,
    };

    return evaluateCurrentLocationStep(
      preResolutionState,
      'All 5 dice locked for all players! Resolving Town locations:'
    );
  }

  // 5A. SHERIFF_TIEBREAKER: Sheriff chooses winner among tied players
  if (action.type === 'DT_SHERIFF_BREAK_TIE' && state.sheriffTiebreaker) {
    const { location, sheriffPlayerId } = state.sheriffTiebreaker;
    return resolveLocationWinner(
      {
        ...state,
        subState: 'IDLE',
        sheriffTiebreaker: null,
        turnNumber: state.turnNumber + 1,
      },
      location,
      action.chosenWinnerId,
      `Sheriff ${sheriffPlayerId} broke the tie at ${location} in favor of ${action.chosenWinnerId}!`
    );
  }

  // 5B. GENERAL_STORE_PICK: Winner keeps 1 drawn card into handCards and discards the rest
  if (
    action.type === 'DT_GENERAL_STORE_PICK_CARD' &&
    state.generalStorePending
  ) {
    const { winnerPlayerId, drawnCards, remainingVisits } =
      state.generalStorePending;
    const chosenCard = drawnCards.find((c) => c.id === action.cardId)!;
    const discardedCards = drawnCards.filter((c) => c.id !== action.cardId);

    const storeDeck = Deck.fromState(state.town.generalStoreDeck);
    storeDeck.discard(discardedCards);

    const winner = state.players[winnerPlayerId]!;
    const nextPlayers: Record<string, PlayerState> = {
      ...state.players,
      [winnerPlayerId]: {
        ...winner,
        handCards: [...winner.handCards, chosenCard],
      },
    };

    if (remainingVisits > 0 && storeDeck.totalAvailable > 0) {
      const jacksCount = Math.max(1, countDieFace(winner.dice, 'J', false));
      const nextDrawn = storeDeck.draw(jacksCount);
      const nextStoreState = storeDeck.toState();
      return {
        ...state,
        turnNumber: state.turnNumber + 1,
        players: nextPlayers,
        town: {
          ...state.town,
          generalStoreDeck: nextStoreState,
          discardPile: nextStoreState.discardPile,
        },
        generalStorePending: {
          winnerPlayerId,
          drawnCards: nextDrawn,
          remainingVisits: remainingVisits - 1,
        },
        lastActionSummary: `${winnerPlayerId} kept 1 card and triggered their extra General Store visit!`,
      };
    }

    const nextStoreState = storeDeck.toState();
    return finishLocationAndAdvance(
      {
        ...state,
        turnNumber: state.turnNumber + 1,
        players: nextPlayers,
        town: {
          ...state.town,
          generalStoreDeck: nextStoreState,
          discardPile: nextStoreState.discardPile,
        },
        subState: 'IDLE',
        generalStorePending: null,
      },
      `${winnerPlayerId} kept 1 General Store card and discarded ${discardedCards.length}.`
    );
  }

  // 5C. SALOON_SELECT_OPPONENT: Winner picks which opponent to view X random cards from
  if (action.type === 'DT_SALOON_SELECT_OPPONENT' && state.saloonPending) {
    const target = state.players[action.targetPlayerId]!;
    const shuffled = shuffleArray(target.handCards, state.prng);
    const revealed = shuffled.value.slice(
      0,
      Math.min(state.saloonPending.queensCount, target.handCards.length)
    );

    return {
      ...state,
      prng: shuffled.prng,
      turnNumber: state.turnNumber + 1,
      saloonPending: {
        ...state.saloonPending,
        targetOpponentId: action.targetPlayerId,
        revealedCandidateCards: revealed,
      },
      lastActionSummary: `${playerId} targeted ${action.targetPlayerId} at the Saloon and is viewing ${revealed.length} random card(s) from their hand.`,
    };
  }

  // 5D. SALOON_STEAL_CARD: Winner steals 1 card from revealedCandidateCards and returns the rest
  if (
    action.type === 'DT_SALOON_STEAL_CARD' &&
    state.saloonPending &&
    state.saloonPending.targetOpponentId
  ) {
    const { winnerPlayerId, targetOpponentId, remainingSteals, queensCount } =
      state.saloonPending;
    const winner = state.players[winnerPlayerId]!;
    const target = state.players[targetOpponentId]!;

    const stolenCard = target.handCards.find((c) => c.id === action.cardId)!;
    const nextTargetHand = target.handCards.filter(
      (c) => c.id !== action.cardId
    );
    const nextWinnerHand = [...winner.handCards, stolenCard];

    const nextPlayers: Record<string, PlayerState> = {
      ...state.players,
      [winnerPlayerId]: {
        ...winner,
        handCards: nextWinnerHand,
      },
      [targetOpponentId]: {
        ...target,
        handCards: nextTargetHand,
      },
    };

    const anyOpponentStillHasCards = state.playerOrder.some(
      (pid) => pid !== winnerPlayerId && nextPlayers[pid]!.handCards.length > 0
    );

    if (remainingSteals > 0 && anyOpponentStillHasCards) {
      return {
        ...state,
        turnNumber: state.turnNumber + 1,
        players: nextPlayers,
        saloonPending: {
          winnerPlayerId,
          queensCount,
          targetOpponentId: null,
          revealedCandidateCards: [],
          remainingSteals: remainingSteals - 1,
        },
        lastActionSummary: `${winnerPlayerId} stole 1 card from ${targetOpponentId} and is performing a 2nd Saloon steal (The Girls)!`,
      };
    }

    return finishLocationAndAdvance(
      {
        ...state,
        turnNumber: state.turnNumber + 1,
        players: nextPlayers,
        subState: 'IDLE',
        saloonPending: null,
      },
      `${winnerPlayerId} stole 1 card from ${targetOpponentId}'s hand at the Saloon!`
    );
  }

  // 5E. DOC_BADLUCK_TARGET: Resolve Elixir of Friendship or Elixir of Domination
  if (
    action.type === 'DT_RESOLVE_DOC_BADLUCK_DEMAND' &&
    state.docBadluckPending
  ) {
    const {
      playerId: visitorId,
      card,
      pendingQueuePlayerIds,
    } = state.docBadluckPending;
    const visitor = state.players[visitorId]!;
    const target = state.players[action.targetPlayerId]!;
    const nextPlayers: Record<string, PlayerState> = { ...state.players };

    if (card.effectType === 'DEMAND_GENERAL_STORE_CARD') {
      const givenCard =
        (action.cardId
          ? target.handCards.find((c) => c.id === action.cardId)
          : undefined) ?? target.handCards[0];
      if (givenCard) {
        nextPlayers[action.targetPlayerId] = {
          ...target,
          handCards: target.handCards.filter((c) => c.id !== givenCard.id),
        };
        nextPlayers[visitorId] = {
          ...visitor,
          handCards: [...visitor.handCards, givenCard],
        };
      }
    } else if (card.effectType === 'DEMAND_PROPERTY_DEED') {
      const stealableDeeds = target.propertyDeeds.filter(
        (d) => !target.protectedDeedIds.includes(d.id)
      );
      const givenDeed =
        (action.cardId
          ? stealableDeeds.find((d) => d.id === action.cardId)
          : undefined) ?? stealableDeeds[0];
      if (givenDeed) {
        nextPlayers[action.targetPlayerId] = {
          ...target,
          propertyDeeds: target.propertyDeeds.filter(
            (d) => d.id !== givenDeed.id
          ),
        };
        nextPlayers[visitorId] = {
          ...visitor,
          propertyDeeds: [...visitor.propertyDeeds, givenDeed],
        };
      }
    }

    return applyDocBadluckQueue(
      {
        ...state,
        turnNumber: state.turnNumber + 1,
        players: nextPlayers,
        subState: 'IDLE',
        docBadluckPending: null,
      },
      pendingQueuePlayerIds,
      [
        `${visitorId} resolved ${card.displayName} against ${action.targetPlayerId}.`,
      ]
    );
  }

  // 6. ACTION_CARD_WINDOWS (`DT_PLAY_CARD`)
  if (action.type === 'DT_PLAY_CARD') {
    const p = state.players[playerId]!;
    const card = p.handCards.find((c) => c.id === action.cardId)!;
    const remainingHand = p.handCards.filter((c) => c.id !== action.cardId);

    const storeDeck = Deck.fromState(state.town.generalStoreDeck);
    storeDeck.discard(card);
    const nextStoreState = storeDeck.toState();

    const nextPlayers: Record<string, PlayerState> = {
      ...state.players,
      [playerId]: {
        ...p,
        handCards: remainingHand,
      },
    };

    switch (card.effectType) {
      case 'STEAL_DOLLARS': {
        // Nervous Joe: A player of your choice must give you $4
        const targetId =
          action.targetPlayerId ??
          state.playerOrder.find((id) => id !== playerId)!;
        const target = nextPlayers[targetId]!;
        const amount = Math.min(4, target.dollars);
        nextPlayers[targetId] = {
          ...target,
          dollars: target.dollars - amount,
        };
        nextPlayers[playerId] = {
          ...nextPlayers[playerId]!,
          dollars: nextPlayers[playerId]!.dollars + amount,
        };
        return {
          ...state,
          turnNumber: state.turnNumber + 1,
          players: nextPlayers,
          town: {
            ...state.town,
            generalStoreDeck: nextStoreState,
            discardPile: nextStoreState.discardPile,
          },
          lastPlayedStoreCard: { playerId, card },
          lastActionSummary: `${playerId} played ${card.displayName} and took $${amount} from ${targetId}!`,
        };
      }

      case 'SET_DIE_FACE': {
        // Professional Cheater: Turn one of your dice to a face of your choice
        const dieIdx = action.targetDieIndex ?? 0;
        const face = action.targetDieFace ?? 'A';
        nextPlayers[playerId] = {
          ...nextPlayers[playerId]!,
          dice: nextPlayers[playerId]!.dice.map((d) =>
            d.index === dieIdx ? { ...d, value: face } : d
          ),
        };
        return {
          ...state,
          turnNumber: state.turnNumber + 1,
          players: nextPlayers,
          town: {
            ...state.town,
            generalStoreDeck: nextStoreState,
            discardPile: nextStoreState.discardPile,
          },
          lastPlayedStoreCard: { playerId, card },
          lastActionSummary: `${playerId} played ${card.displayName} to turn die #${dieIdx + 1} to [${face}]!`,
        };
      }

      case 'FREE_KEEP_EXTRA_DICE': {
        nextPlayers[playerId] = {
          ...nextPlayers[playerId]!,
          stagedExtraDiceFee: 0,
          usedBruteThisStep: true,
        };
        return {
          ...state,
          turnNumber: state.turnNumber + 1,
          players: nextPlayers,
          town: {
            ...state.town,
            generalStoreDeck: nextStoreState,
            discardPile: nextStoreState.discardPile,
          },
          lastPlayedStoreCard: { playerId, card },
          lastActionSummary: `${playerId} played ${card.displayName} — extra kept dice cost $0 this step!`,
        };
      }

      case 'DOUBLE_NUGGETS': {
        // Dynamite: Gain twice as many gold nuggets at Gold Mine
        const ninesCount = countDieFace(p.dice, '9', false);
        const bonusNuggets = Math.min(state.town.goldMineNuggets, ninesCount);
        nextPlayers[playerId] = {
          ...nextPlayers[playerId]!,
          nuggets: nextPlayers[playerId]!.nuggets + bonusNuggets,
        };
        return {
          ...state,
          turnNumber: state.turnNumber + 1,
          players: nextPlayers,
          town: {
            ...state.town,
            goldMineNuggets: state.town.goldMineNuggets - bonusNuggets,
            generalStoreDeck: nextStoreState,
            discardPile: nextStoreState.discardPile,
          },
          lastPlayedStoreCard: { playerId, card },
          lastActionSummary: `${playerId} played ${card.displayName} and blasted ${bonusNuggets} extra gold nugget(s) from the Gold Mine!`,
        };
      }

      case 'SPLIT_BANK_HEIST': {
        // Even Split: Opponent who robbed the Bank gives you half of the stolen bills (rounded down)
        const heist = state.lastBankRobbery;
        let splitAmount = 0;
        if (heist && heist.winnerId !== playerId) {
          const robber = nextPlayers[heist.winnerId]!;
          splitAmount = Math.min(
            robber.dollars,
            Math.floor(heist.amountStolen / 2)
          );
          nextPlayers[heist.winnerId] = {
            ...robber,
            dollars: robber.dollars - splitAmount,
          };
          nextPlayers[playerId] = {
            ...nextPlayers[playerId]!,
            dollars: nextPlayers[playerId]!.dollars + splitAmount,
          };
        }
        return {
          ...state,
          turnNumber: state.turnNumber + 1,
          players: nextPlayers,
          town: {
            ...state.town,
            generalStoreDeck: nextStoreState,
            discardPile: nextStoreState.discardPile,
          },
          lastPlayedStoreCard: { playerId, card },
          lastActionSummary: `${playerId} played ${card.displayName} and took $${splitAmount} from the Bank heist!`,
        };
      }

      case 'DOUBLE_STORE_ACTION': {
        // Unlimited Credit
        if (state.generalStorePending) {
          return {
            ...state,
            turnNumber: state.turnNumber + 1,
            players: nextPlayers,
            town: {
              ...state.town,
              generalStoreDeck: nextStoreState,
              discardPile: nextStoreState.discardPile,
            },
            generalStorePending: {
              ...state.generalStorePending,
              remainingVisits: state.generalStorePending.remainingVisits + 1,
            },
            lastPlayedStoreCard: { playerId, card },
            lastActionSummary: `${playerId} played ${card.displayName} to perform the General Store action twice!`,
          };
        }
        const drawn = storeDeck.draw(1);
        const updatedStore = storeDeck.toState();
        if (drawn[0]) {
          nextPlayers[playerId] = {
            ...nextPlayers[playerId]!,
            handCards: [...nextPlayers[playerId]!.handCards, drawn[0]],
          };
        }
        return {
          ...state,
          turnNumber: state.turnNumber + 1,
          players: nextPlayers,
          town: {
            ...state.town,
            generalStoreDeck: updatedStore,
            discardPile: updatedStore.discardPile,
          },
          lastPlayedStoreCard: { playerId, card },
          lastActionSummary: `${playerId} played ${card.displayName} for a second General Store draw!`,
        };
      }

      case 'DOUBLE_SALOON_ACTION': {
        if (state.saloonPending) {
          return {
            ...state,
            turnNumber: state.turnNumber + 1,
            players: nextPlayers,
            town: {
              ...state.town,
              generalStoreDeck: nextStoreState,
              discardPile: nextStoreState.discardPile,
            },
            saloonPending: {
              ...state.saloonPending,
              remainingSteals: state.saloonPending.remainingSteals + 1,
            },
            lastPlayedStoreCard: { playerId, card },
            lastActionSummary: `${playerId} played ${card.displayName} to perform the Saloon action twice in a row!`,
          };
        }
        return {
          ...state,
          turnNumber: state.turnNumber + 1,
          players: nextPlayers,
          town: {
            ...state.town,
            generalStoreDeck: nextStoreState,
            discardPile: nextStoreState.discardPile,
          },
          lastPlayedStoreCard: { playerId, card },
          lastActionSummary: `${playerId} played ${card.displayName}!`,
        };
      }

      case 'BONUS_BLIND_DEED': {
        // Corruption: Take the top face-down Property Deed from the deck
        const propDeck = Deck.fromState(state.town.propertyDeck);
        const blindDeed = propDeck.draw(1);
        if (blindDeed[0]) {
          nextPlayers[playerId] = {
            ...nextPlayers[playerId]!,
            propertyDeeds: [
              ...nextPlayers[playerId]!.propertyDeeds,
              blindDeed[0],
            ],
          };
        }
        return {
          ...state,
          turnNumber: state.turnNumber + 1,
          players: nextPlayers,
          town: {
            ...state.town,
            generalStoreDeck: nextStoreState,
            discardPile: nextStoreState.discardPile,
            propertyDeck: propDeck.toState(),
          },
          lastPlayedStoreCard: { playerId, card },
          lastActionSummary: `${playerId} played ${card.displayName} and took the top face-down Property Deed from the deck!`,
        };
      }

      case 'RETAIN_SHERIFF': {
        // Marshall: Keep the Sheriff Badge
        for (const pid of state.playerOrder) {
          nextPlayers[pid] = {
            ...nextPlayers[pid]!,
            isSheriff: pid === playerId,
          };
        }
        return {
          ...state,
          turnNumber: state.turnNumber + 1,
          sheriffPlayerId: playerId,
          players: nextPlayers,
          town: {
            ...state.town,
            generalStoreDeck: nextStoreState,
            discardPile: nextStoreState.discardPile,
          },
          lastPlayedStoreCard: { playerId, card },
          lastActionSummary: `${playerId} played ${card.displayName} and retained the Sheriff Badge!`,
        };
      }

      case 'TRIGGER_DOC_BADLUCK': {
        // Doc Badluck's Elixir: Visit Doc Badluck even if you controlled a town location this round
        return {
          ...state,
          turnNumber: state.turnNumber + 1,
          players: nextPlayers,
          town: {
            ...state.town,
            generalStoreDeck: nextStoreState,
            discardPile: nextStoreState.discardPile,
          },
          docBadluckBonusVisitors: [
            ...new Set([...state.docBadluckBonusVisitors, playerId]),
          ],
          lastPlayedStoreCard: { playerId, card },
          lastActionSummary: `${playerId} played ${card.displayName} and will visit Doc Badluck this round!`,
        };
      }

      case 'CANCEL_STORE_CARD': {
        // Wanted: Nullifies another player's General Store card
        return {
          ...state,
          turnNumber: state.turnNumber + 1,
          players: nextPlayers,
          town: {
            ...state.town,
            generalStoreDeck: nextStoreState,
            discardPile: nextStoreState.discardPile,
          },
          lastPlayedStoreCard: null,
          lastActionSummary: `${playerId} played ${card.displayName} and cancelled the previous General Store card!`,
        };
      }

      default:
        return {
          ...state,
          turnNumber: state.turnNumber + 1,
          players: nextPlayers,
          town: {
            ...state.town,
            generalStoreDeck: nextStoreState,
            discardPile: nextStoreState.discardPile,
          },
          lastPlayedStoreCard: { playerId, card },
          lastActionSummary: `${playerId} played ${card.displayName}.`,
        };
    }
  }

  // 7. DT_ADVANCE_RESOLUTION
  if (action.type === 'DT_ADVANCE_RESOLUTION') {
    if (checkEndGameCondition(state)) {
      return finalizeDiceTownGameOver(state, 'End-of-game condition met');
    }
    return applyDiceTownAction(state, playerId, { type: 'DT_START_ROUND' });
  }

  return state;
}

// ============================================================================
// 4. Sanitized Player Perspective (`getDiceTownPlayerPerspective`)
// ============================================================================

export function getDiceTownPlayerPerspective(
  state: DiceTownGameState,
  playerId: string
): DiceTownSanitizedState {
  const effectivePid = state.players[playerId]
    ? playerId
    : state.playerOrder[0]!;
  const selfPlayer = state.players[effectivePid]!;
  const isGameOver = state.phase === 'GAME_OVER';

  // Strictly conceal `in_cup` and `staged_hidden` dice values for all opponents!
  const opponents: Record<string, SanitizedOpponentState> = {};
  for (const pid of state.playerOrder) {
    if (pid === effectivePid) continue;
    const opp = state.players[pid]!;
    const sanitizedDice: SanitizedPokerDie[] = opp.dice.map((d) => ({
      index: d.index,
      value: isGameOver || d.status === 'locked_public' ? d.value : null,
      status: d.status,
    }));
    opponents[pid] = {
      id: opp.id,
      name: opp.name,
      dollars: opp.dollars,
      nuggets: opp.nuggets,
      isSheriff: opp.isSheriff,
      dice: sanitizedDice,
      handCardCount: opp.handCards.length,
      propertyDeeds: [...opp.propertyDeeds],
      protectedDeedIds: [...opp.protectedDeedIds],
      docBadluckCardCount: opp.docBadluckCards.length,
      hasSubmittedSelection: opp.hasSubmittedSelection,
      locationsWonThisRound: opp.locationsWonThisRound,
    };
  }

  // Determine which player is currently prompted to act
  let activePlayerId =
    state.playerOrder[state.activePlayerIndex] ?? state.playerOrder[0]!;
  if (
    state.subState === 'SHERIFF_TIEBREAKER' &&
    state.sheriffTiebreaker?.sheriffPlayerId
  ) {
    activePlayerId = state.sheriffTiebreaker.sheriffPlayerId;
  } else if (
    state.subState === 'GENERAL_STORE_PICK' &&
    state.generalStorePending?.winnerPlayerId
  ) {
    activePlayerId = state.generalStorePending.winnerPlayerId;
  } else if (
    state.subState === 'SALOON_STEAL' &&
    state.saloonPending?.winnerPlayerId
  ) {
    activePlayerId = state.saloonPending.winnerPlayerId;
  } else if (
    state.subState === 'DOC_BADLUCK_TARGET' &&
    state.docBadluckPending?.playerId
  ) {
    activePlayerId = state.docBadluckPending.playerId;
  } else if (state.phase === 'SECRET_SELECTION') {
    const waitingPid = state.playerOrder.find(
      (pid) => !state.players[pid]!.hasSubmittedSelection
    );
    if (waitingPid) {
      activePlayerId = waitingPid;
    }
  }

  const inCupDice = selfPlayer.dice.filter((d) => d.status === 'in_cup');
  const stagedHiddenDice = selfPlayer.dice.filter(
    (d) => d.status === 'staged_hidden'
  );
  const lockedPublicDice = selfPlayer.dice.filter(
    (d) => d.status === 'locked_public'
  );
  const hasBruteInHand = selfPlayer.handCards.some(
    (c) => c.effectType === 'FREE_KEEP_EXTRA_DICE'
  );
  const maxSelectableDiceCount = hasBruteInHand
    ? inCupDice.length
    : Math.min(inCupDice.length, 1 + selfPlayer.dollars);

  const discardLen = state.town.discardPile.length;

  return {
    gameId: 'dice_town',
    phase: state.phase,
    turnStep: state.turnStep,
    subState: state.subState,
    roundNumber: state.roundNumber,
    turnNumber: state.turnNumber,
    playerOrder: state.playerOrder,
    activePlayerIndex: state.activePlayerIndex,
    activePlayerId,
    sheriffPlayerId: state.sheriffPlayerId,
    self: selfPlayer,
    opponents,
    town: {
      goldMineNuggets: state.town.goldMineNuggets,
      bankVaultDollars: state.town.bankVaultDollars,
      generalStoreDrawCount: state.town.generalStoreDeck.drawPile.length,
      generalStoreDiscardCount: discardLen,
      discardPileTopCard:
        discardLen > 0 ? state.town.discardPile[discardLen - 1]! : null,
      propertyDrawCount: state.town.propertyDeck.drawPile.length,
      faceUpProperties: [...state.town.faceUpProperties],
      docBadluckDrawCount: state.town.docBadluckDeck.drawPile.length,
    },
    currentLocation: state.currentLocation,
    currentLocationWinnerId: state.currentLocationWinnerId,
    townBoardLeaders: buildTownBoardLeaders(state),
    underTheCup: {
      playerId: selfPlayer.id,
      inCupDice,
      stagedHiddenDice,
      lockedPublicDice,
      hasSubmittedSelection: selfPlayer.hasSubmittedSelection,
      maxSelectableDiceCount,
    },
    sheriffTiebreakerModal: state.sheriffTiebreaker,
    generalStoreChoiceCards:
      state.generalStorePending?.winnerPlayerId === effectivePid
        ? state.generalStorePending.drawnCards
        : null,
    saloonRevealedCards:
      state.saloonPending?.winnerPlayerId === effectivePid
        ? state.saloonPending.revealedCandidateCards
        : null,
    docBadluckPending: state.docBadluckPending,
    finalVPByPlayer: state.finalVPByPlayer,
    winnerId: state.winnerId,
    lastActionSummary: state.lastActionSummary,
  };
}

export function calculateDiceTownFinalScores(
  state: DiceTownGameState
): Record<string, number> {
  const scores: Record<string, number> = {};
  for (const pid of state.playerOrder) {
    scores[pid] = calculatePlayerVPBreakdown(state.players[pid]!).totalVP;
  }
  return scores;
}
