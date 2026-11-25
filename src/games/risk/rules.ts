import {
  createPRNG,
  nextInt,
  PRNGState,
  shuffleArray,
} from '../../common/prng.js';
import { GameSetupOptions } from '../../types/game.js';
import { ValidationResult } from '../ticket-to-ride/types.js';
import {
  ALL_RISK_TERRITORY_IDS,
  areRiskTerritoriesAdjacent,
  buildStandardRiskDeck,
  RISK_CONTINENTS,
  RISK_CONTINENTS_BY_ID,
  RISK_TERRITORIES_BY_ID,
} from './mapData.js';
import {
  RiskAction,
  RiskCard,
  RiskCardSymbol,
  RiskCardTradeMode,
  RiskCombatSummary,
  RiskCombatVolley,
  RiskContinentId,
  RiskDiceComparison,
  RiskGameState,
  RiskPlayerState,
  RiskSanitizedGameState,
  RiskSanitizedPlayerState,
  RiskSecretMission,
  RiskSetupMode,
  RiskTerritoryId,
  RiskTerritoryState,
  RiskWinCondition,
} from './types.js';

export const RISK_NEUTRAL_PLAYER_ID = 'NEUTRAL';

const DEFAULT_RISK_PLAYER_COLORS = [
  'red',
  'blue',
  'green',
  'yellow',
  'purple',
  'orange',
  'black',
  'white',
  'brown',
] as const;

export function getInitialArmiesForPlayerCount(playerCount: number): number {
  switch (playerCount) {
    case 2:
      return 40;
    case 3:
      return 35;
    case 4:
      return 30;
    case 5:
      return 25;
    case 6:
      return 20;
    default:
      return Math.max(15, 50 - playerCount * 5);
  }
}

export function getEscalatingCardSetValue(setsTradedCount: number): number {
  const table = [4, 6, 8, 10, 12, 15];
  if (setsTradedCount < table.length) {
    return table[setsTradedCount]!;
  }
  return 15 + (setsTradedCount - 5) * 5;
}

export function isValidRiskCardSet(cards: readonly RiskCard[]): boolean {
  if (cards.length !== 3) return false;
  const wildCount = cards.filter((c) => c.symbol === 'WILD').length;
  if (wildCount >= 1) return true;

  const symbols = cards.map((c) => c.symbol);
  const unique = new Set(symbols);
  return unique.size === 1 || unique.size === 3;
}

export function evaluateRiskCardSetValue(
  cards: readonly RiskCard[],
  mode: RiskCardTradeMode,
  setsTradedCount: number
): number {
  if (!isValidRiskCardSet(cards)) return 0;
  if (mode === 'ESCALATING') {
    return getEscalatingCardSetValue(setsTradedCount);
  }

  // FIXED mode: 10 for 1 of each, 8 for 3 Artillery, 6 for 3 Cavalry, 4 for 3 Infantry.
  // Wilds substitute for whichever valid symbol combination yields the highest bonus.
  const concreteSymbols: readonly Exclude<RiskCardSymbol, 'WILD'>[] = [
    'INFANTRY',
    'CAVALRY',
    'ARTILLERY',
  ];

  const expandCardChoices = (
    card: RiskCard
  ): readonly Exclude<RiskCardSymbol, 'WILD'>[] =>
    card.symbol === 'WILD' ? concreteSymbols : [card.symbol];

  let bestValue = 0;
  for (const s0 of expandCardChoices(cards[0]!)) {
    for (const s1 of expandCardChoices(cards[1]!)) {
      for (const s2 of expandCardChoices(cards[2]!)) {
        const unique = new Set([s0, s1, s2]);
        if (unique.size === 3) {
          bestValue = Math.max(bestValue, 10);
        } else if (unique.size === 1) {
          if (s0 === 'ARTILLERY') bestValue = Math.max(bestValue, 8);
          else if (s0 === 'CAVALRY') bestValue = Math.max(bestValue, 6);
          else if (s0 === 'INFANTRY') bestValue = Math.max(bestValue, 4);
        }
      }
    }
  }
  return bestValue;
}

export function findValidCardSetInHand(
  hand: readonly RiskCard[]
): readonly [string, string, string] | null {
  for (let i = 0; i < hand.length; i++) {
    for (let j = i + 1; j < hand.length; j++) {
      for (let k = j + 1; k < hand.length; k++) {
        const c1 = hand[i]!;
        const c2 = hand[j]!;
        const c3 = hand[k]!;
        if (isValidRiskCardSet([c1, c2, c3])) {
          return [c1.id, c2.id, c3.id];
        }
      }
    }
  }
  return null;
}

export function getOwnedTerritories(
  territories: Readonly<Record<RiskTerritoryId, RiskTerritoryState>>,
  playerId: string
): RiskTerritoryState[] {
  return ALL_RISK_TERRITORY_IDS.map((id) => territories[id]).filter(
    (t) => t.ownerId === playerId
  );
}

export function doesPlayerControlContinent(
  territories: Readonly<Record<RiskTerritoryId, RiskTerritoryState>>,
  playerId: string,
  continentId: RiskContinentId
): boolean {
  const continent = RISK_CONTINENTS_BY_ID[continentId];
  return continent.territoryIds.every(
    (tid) => territories[tid].ownerId === playerId
  );
}

export function getControlledContinents(
  territories: Readonly<Record<RiskTerritoryId, RiskTerritoryState>>,
  playerId: string
): RiskContinentId[] {
  return RISK_CONTINENTS.filter((c) =>
    doesPlayerControlContinent(territories, playerId, c.id)
  ).map((c) => c.id);
}

export function calculateTurnReinforcements(
  territories: Readonly<Record<RiskTerritoryId, RiskTerritoryState>>,
  playerId: string
): number {
  const ownedCount = getOwnedTerritories(territories, playerId).length;
  const baseArmies = Math.max(3, Math.floor(ownedCount / 3));
  let continentBonus = 0;
  for (const continent of RISK_CONTINENTS) {
    if (doesPlayerControlContinent(territories, playerId, continent.id)) {
      continentBonus += continent.bonusArmies;
    }
  }
  return baseArmies + continentBonus;
}

export function areTerritoriesConnectedByOwner(
  territories: Readonly<Record<RiskTerritoryId, RiskTerritoryState>>,
  playerId: string,
  fromId: RiskTerritoryId,
  toId: RiskTerritoryId
): boolean {
  if (fromId === toId) return false;
  if (
    territories[fromId].ownerId !== playerId ||
    territories[toId].ownerId !== playerId
  ) {
    return false;
  }

  const visited = new Set<RiskTerritoryId>([fromId]);
  const queue: RiskTerritoryId[] = [fromId];

  while (queue.length > 0) {
    const current = queue.shift()!;
    const neighbors = RISK_TERRITORIES_BY_ID[current].adjacentIds;
    for (const neighbor of neighbors) {
      if (neighbor === toId && territories[neighbor].ownerId === playerId) {
        return true;
      }
      if (
        !visited.has(neighbor) &&
        territories[neighbor].ownerId === playerId
      ) {
        visited.add(neighbor);
        queue.push(neighbor);
      }
    }
  }
  return false;
}

function buildSecretMissionsPool(
  humanPlayerIds: readonly string[],
  playerColors: Readonly<Record<string, string>>
): RiskSecretMission[] {
  const missions: RiskSecretMission[] = [
    {
      id: 'mission_asia_sa',
      title: 'Conquer Asia & South America',
      description: 'Control every territory in Asia and South America.',
      kind: 'CONQUER_CONTINENTS',
      requiredContinents: ['ASIA', 'SOUTH_AMERICA'],
      extraAnyContinent: false,
    },
    {
      id: 'mission_asia_africa',
      title: 'Conquer Asia & Africa',
      description: 'Control every territory in Asia and Africa.',
      kind: 'CONQUER_CONTINENTS',
      requiredContinents: ['ASIA', 'AFRICA'],
      extraAnyContinent: false,
    },
    {
      id: 'mission_na_africa',
      title: 'Conquer North America & Africa',
      description: 'Control every territory in North America and Africa.',
      kind: 'CONQUER_CONTINENTS',
      requiredContinents: ['NORTH_AMERICA', 'AFRICA'],
      extraAnyContinent: false,
    },
    {
      id: 'mission_na_australia',
      title: 'Conquer North America & Australia',
      description: 'Control every territory in North America and Australia.',
      kind: 'CONQUER_CONTINENTS',
      requiredContinents: ['NORTH_AMERICA', 'AUSTRALIA'],
      extraAnyContinent: false,
    },
    {
      id: 'mission_eu_sa_plus1',
      title: 'Europe, South America & 1 More',
      description:
        'Control Europe, South America, and at least one additional continent of your choice.',
      kind: 'CONQUER_CONTINENTS',
      requiredContinents: ['EUROPE', 'SOUTH_AMERICA'],
      extraAnyContinent: true,
    },
    {
      id: 'mission_eu_aus_plus1',
      title: 'Europe, Australia & 1 More',
      description:
        'Control Europe, Australia, and at least one additional continent of your choice.',
      kind: 'CONQUER_CONTINENTS',
      requiredContinents: ['EUROPE', 'AUSTRALIA'],
      extraAnyContinent: true,
    },
    {
      id: 'mission_24_territories',
      title: 'Occupy 24 Territories',
      description: 'Conquer and occupy at least 24 territories of your choice.',
      kind: 'CONQUER_TERRITORIES',
      minTerritories: 24,
      minArmiesPerTerritory: 1,
    },
    {
      id: 'mission_18_two_armies',
      title: 'Fortify 18 Territories',
      description:
        'Occupy at least 18 territories with at least 2 armies stationed on each.',
      kind: 'CONQUER_TERRITORIES',
      minTerritories: 18,
      minArmiesPerTerritory: 2,
    },
  ];

  if (humanPlayerIds.length >= 3) {
    for (const targetId of humanPlayerIds) {
      const colorLabel = (playerColors[targetId] ?? 'enemy').toUpperCase();
      missions.push({
        id: `mission_destroy_${targetId}`,
        title: `Eliminate ${targetId} (${colorLabel})`,
        description: `Destroy all armies belonging to ${targetId}. If another player eliminates them first, occupy 24 territories instead.`,
        kind: 'DESTROY_PLAYER',
        targetPlayerId: targetId,
        fallbackTerritories: 24,
      });
    }
  }

  return missions;
}

export function hasCompletedSecretMission(
  state: RiskGameState,
  playerId: string
): { readonly completed: boolean; readonly reason: string | null } {
  const player = state.players[playerId];
  if (!player || !player.secretMission) {
    return { completed: false, reason: null };
  }

  const mission = player.secretMission;
  if (mission.kind === 'CONQUER_CONTINENTS') {
    const controlled = getControlledContinents(state.territories, playerId);
    const hasRequired = mission.requiredContinents.every((cid) =>
      controlled.includes(cid)
    );
    if (!hasRequired) {
      return { completed: false, reason: null };
    }
    if (
      mission.extraAnyContinent &&
      controlled.length < mission.requiredContinents.length + 1
    ) {
      return { completed: false, reason: null };
    }
    return {
      completed: true,
      reason: `Secret Mission Achieved: ${mission.title}!`,
    };
  }

  if (mission.kind === 'CONQUER_TERRITORIES') {
    const owned = getOwnedTerritories(state.territories, playerId).filter(
      (t) => t.armies >= mission.minArmiesPerTerritory
    );
    if (owned.length >= mission.minTerritories) {
      return {
        completed: true,
        reason: `Secret Mission Achieved: ${mission.title}!`,
      };
    }
    return { completed: false, reason: null };
  }

  // DESTROY_PLAYER
  const target = state.players[mission.targetPlayerId];
  if (
    target &&
    mission.targetPlayerId !== playerId &&
    target.eliminated &&
    target.eliminatedByPlayerId === playerId
  ) {
    return {
      completed: true,
      reason: `Secret Mission Achieved: Eliminated ${mission.targetPlayerId}!`,
    };
  }

  // Fallback to 24 territories if target is self or eliminated by someone else
  if (
    mission.targetPlayerId === playerId ||
    (target && target.eliminated && target.eliminatedByPlayerId !== playerId)
  ) {
    const ownedCount = getOwnedTerritories(state.territories, playerId).length;
    if (ownedCount >= mission.fallbackTerritories) {
      return {
        completed: true,
        reason: `Secret Mission Achieved (Fallback): Occupied ${mission.fallbackTerritories} territories!`,
      };
    }
  }

  return { completed: false, reason: null };
}

function checkGameVictory(
  state: RiskGameState,
  candidatePlayerId: string
): { readonly winnerId: string | null; readonly victoryReason: string | null } {
  const humanPlayers = state.playerOrder
    .map((pid) => state.players[pid]!)
    .filter((p) => !p.isNeutral);
  const survivingHumans = humanPlayers.filter((p) => !p.eliminated);

  // Eliminating every other human commander always wins in any mode
  if (survivingHumans.length === 1) {
    const soleSurvivor = survivingHumans[0]!;
    return {
      winnerId: soleSurvivor.id,
      victoryReason: `${soleSurvivor.id} conquered the world by eliminating all rival commanders!`,
    };
  }

  if (state.winCondition === 'CAPITAL') {
    const capitalTerritoryIds = Object.keys(
      state.capitalOwnerByTerritory
    ) as RiskTerritoryId[];
    if (
      capitalTerritoryIds.length >= 2 &&
      capitalTerritoryIds.every(
        (tid) => state.territories[tid].ownerId === candidatePlayerId
      )
    ) {
      return {
        winnerId: candidatePlayerId,
        victoryReason: `${candidatePlayerId} captured all ${capitalTerritoryIds.length} World Capitals!`,
      };
    }
  }

  if (state.winCondition === 'SECRET_MISSION') {
    const missionCheck = hasCompletedSecretMission(state, candidatePlayerId);
    if (missionCheck.completed) {
      return {
        winnerId: candidatePlayerId,
        victoryReason: missionCheck.reason ?? `${candidatePlayerId} completed their Secret Mission!`,
      };
    }
  }

  const ownedAll42 = ALL_RISK_TERRITORY_IDS.every(
    (tid) => state.territories[tid].ownerId === candidatePlayerId
  );
  if (ownedAll42) {
    return {
      winnerId: candidatePlayerId,
      victoryReason: `${candidatePlayerId} achieved Total World Domination across all 42 territories!`,
    };
  }

  return { winnerId: null, victoryReason: null };
}

function appendLog(
  logs: readonly string[],
  entry: string
): readonly string[] {
  const next = [...logs, entry];
  return next.length > 60 ? next.slice(next.length - 60) : next;
}

export function initRiskGame(
  playerIds: string[],
  seed: number,
  options?: GameSetupOptions
): RiskGameState {
  if (playerIds.length < 2 || playerIds.length > 6) {
    throw new Error('Risk requires between 2 and 6 players.');
  }

  let prng = createPRNG(seed);
  const expansions = new Set(options?.selectedExpansions ?? []);

  const setupMode: RiskSetupMode = expansions.has('auto_setup')
    ? 'AUTO'
    : 'MANUAL';
  const cardTradeMode: RiskCardTradeMode = expansions.has('fixed_card_values')
    ? 'FIXED'
    : 'ESCALATING';
  const winCondition: RiskWinCondition = expansions.has('capital_risk')
    ? 'CAPITAL'
    : expansions.has('secret_mission')
      ? 'SECRET_MISSION'
      : 'WORLD_DOMINATION';

  // Resolve player colors respecting lobby choices
  const usedColors = new Set<string>();
  const resolvedColors: Record<string, string> = {};
  for (const pid of playerIds) {
    const chosen = options?.playerColors?.[pid];
    if (chosen && !usedColors.has(chosen)) {
      resolvedColors[pid] = chosen;
      usedColors.add(chosen);
    }
  }
  for (const pid of playerIds) {
    if (!resolvedColors[pid]) {
      const fallback =
        DEFAULT_RISK_PLAYER_COLORS.find((c) => !usedColors.has(c)) ?? 'red';
      resolvedColors[pid] = fallback;
      usedColors.add(fallback);
    }
  }

  // Shuffle deck of 44 Risk cards
  const shuffledDeckRes = shuffleArray(buildStandardRiskDeck(), prng);
  prng = shuffledDeckRes.prng;
  const cardDeck = shuffledDeckRes.value;

  // Deal Secret Missions if enabled
  const assignedMissions: Record<string, RiskSecretMission | null> = {};
  if (winCondition === 'SECRET_MISSION') {
    const pool = buildSecretMissionsPool(playerIds, resolvedColors);
    const shuffledPoolRes = shuffleArray(pool, prng);
    prng = shuffledPoolRes.prng;
    const available = [...shuffledPoolRes.value];

    for (const pid of playerIds) {
      // Avoid dealing "Destroy Yourself" when another mission is available
      const validIdx = available.findIndex(
        (m) => !(m.kind === 'DESTROY_PLAYER' && m.targetPlayerId === pid)
      );
      const chosenIdx = validIdx >= 0 ? validIdx : 0;
      const mission = available.splice(chosenIdx, 1)[0] ?? null;
      assignedMissions[pid] = mission;
    }
  } else {
    for (const pid of playerIds) {
      assignedMissions[pid] = null;
    }
  }

  const startingArmies = getInitialArmiesForPlayerCount(playerIds.length);
  const players: Record<string, RiskPlayerState> = {};

  for (const pid of playerIds) {
    players[pid] = {
      id: pid,
      color: resolvedColors[pid]!,
      isNeutral: false,
      eliminated: false,
      eliminatedByPlayerId: null,
      unplacedArmies: startingArmies,
      cards: [],
      autoDefend: true,
      capitalTerritoryId: null,
      secretMission: assignedMissions[pid] ?? null,
    };
  }

  const isTwoPlayer = playerIds.length === 2;
  if (isTwoPlayer) {
    players[RISK_NEUTRAL_PLAYER_ID] = {
      id: RISK_NEUTRAL_PLAYER_ID,
      color: 'neutral',
      isNeutral: true,
      eliminated: false,
      eliminatedByPlayerId: null,
      unplacedArmies: 0,
      cards: [],
      autoDefend: true,
      capitalTerritoryId: null,
      secretMission: null,
    };
  }

  const territories = {} as Record<RiskTerritoryId, RiskTerritoryState>;
  for (const tid of ALL_RISK_TERRITORY_IDS) {
    territories[tid] = {
      id: tid,
      ownerId: null,
      armies: 0,
    };
  }

  const shuffledTerritoriesRes = shuffleArray(ALL_RISK_TERRITORY_IDS, prng);
  prng = shuffledTerritoriesRes.prng;
  const shuffledTerritories = shuffledTerritoriesRes.value;

  const logs: string[] = [];

  if (setupMode === 'AUTO') {
    if (isTwoPlayer) {
      // 14 to P1, 14 to P2, 14 to Neutral (with 2 armies each)
      for (let i = 0; i < 42; i++) {
        const tid = shuffledTerritories[i]!;
        if (i < 14) {
          const pid = playerIds[0]!;
          territories[tid] = { id: tid, ownerId: pid, armies: 1 };
          players[pid] = {
            ...players[pid]!,
            unplacedArmies: players[pid]!.unplacedArmies - 1,
          };
        } else if (i < 28) {
          const pid = playerIds[1]!;
          territories[tid] = { id: tid, ownerId: pid, armies: 1 };
          players[pid] = {
            ...players[pid]!,
            unplacedArmies: players[pid]!.unplacedArmies - 1,
          };
        } else {
          territories[tid] = {
            id: tid,
            ownerId: RISK_NEUTRAL_PLAYER_ID,
            armies: 2,
          };
        }
      }
      logs.push(
        'Auto-Setup dealt 14 territories to each commander and 14 Neutral buffer territories (2 armies each).'
      );
    } else {
      for (let i = 0; i < 42; i++) {
        const tid = shuffledTerritories[i]!;
        const pid = playerIds[i % playerIds.length]!;
        territories[tid] = { id: tid, ownerId: pid, armies: 1 };
        players[pid] = {
          ...players[pid]!,
          unplacedArmies: players[pid]!.unplacedArmies - 1,
        };
      }
      logs.push('Auto-Setup dealt all 42 territories across commanders.');
    }
  } else {
    // MANUAL claim mode
    if (isTwoPlayer) {
      // Pre-place 14 Neutral buffer territories with 2 armies each; players claim remaining 28
      for (let i = 0; i < 14; i++) {
        const tid = shuffledTerritories[i]!;
        territories[tid] = {
          id: tid,
          ownerId: RISK_NEUTRAL_PLAYER_ID,
          armies: 2,
        };
      }
      logs.push(
        '2-Player Setup: 14 Neutral territories fortified with 2 armies each. Take turns claiming the remaining 28 territories.'
      );
    } else {
      logs.push(
        'Manual Setup: Commanders take turns claiming unclaimed territories.'
      );
    }
  }

  return {
    gameId: 'risk',
    phase: 'SETUP',
    turnStep: setupMode === 'AUTO' ? 'SETUP_PLACE' : 'SETUP_CLAIM',
    setupMode,
    cardTradeMode,
    winCondition,
    playerOrder: [...playerIds],
    activePlayerIndex: 0,
    turnNumber: 1,
    roundNumber: 1,
    players,
    territories,
    capitalOwnerByTerritory: {},
    cardDeck,
    discardPile: [],
    setsTradedCount: 0,
    conqueredTerritoryThisTurn: false,
    pendingDefense: null,
    pendingConquest: null,
    returnStepAfterForcedTrade: null,
    lastCombat: null,
    winnerId: null,
    victoryReason: null,
    actionLog: logs,
    prng,
  };
}

function findNextPlayerWithSetupArmies(
  state: RiskGameState,
  players: Readonly<Record<string, RiskPlayerState>>,
  fromIndex: number
): number {
  const n = state.playerOrder.length;
  for (let offset = 1; offset <= n; offset++) {
    const idx = (fromIndex + offset) % n;
    const pid = state.playerOrder[idx]!;
    if ((players[pid]?.unplacedArmies ?? 0) > 0) {
      return idx;
    }
  }
  return -1;
}

function findNextAlivePlayerIndex(
  state: RiskGameState,
  players: Readonly<Record<string, RiskPlayerState>>,
  fromIndex: number
): number {
  const n = state.playerOrder.length;
  for (let offset = 1; offset <= n; offset++) {
    const idx = (fromIndex + offset) % n;
    const pid = state.playerOrder[idx]!;
    const p = players[pid];
    if (p && !p.isNeutral && !p.eliminated) {
      return idx;
    }
  }
  return fromIndex;
}

function transitionOutOfSetupPlacement(
  state: RiskGameState,
  players: Readonly<Record<string, RiskPlayerState>>,
  territories: Readonly<Record<RiskTerritoryId, RiskTerritoryState>>,
  prng: PRNGState,
  extraLog: string
): RiskGameState {
  if (state.winCondition === 'CAPITAL') {
    return {
      ...state,
      players,
      territories,
      prng,
      activePlayerIndex: 0,
      turnStep: 'CHOOSE_CAPITAL',
      actionLog: appendLog(
        state.actionLog,
        `${extraLog} Now each commander selects their Capital Headquarters.`
      ),
    };
  }

  const firstPid = state.playerOrder[0]!;
  const initialReinforcements = calculateTurnReinforcements(
    territories,
    firstPid
  );
  const updatedPlayers: Record<string, RiskPlayerState> = {
    ...players,
    [firstPid]: {
      ...players[firstPid]!,
      unplacedArmies: initialReinforcements,
    },
  };

  return {
    ...state,
    phase: 'PLAYING',
    turnStep: 'REINFORCE',
    activePlayerIndex: 0,
    players: updatedPlayers,
    territories,
    prng,
    actionLog: appendLog(
      state.actionLog,
      `${extraLog} Battle begins! ${firstPid} receives ${initialReinforcements} reinforcements.`
    ),
  };
}

function drawTerritoryCardIfEarned(state: RiskGameState): {
  readonly players: Readonly<Record<string, RiskPlayerState>>;
  readonly cardDeck: readonly RiskCard[];
  readonly discardPile: readonly RiskCard[];
  readonly prng: PRNGState;
  readonly drewCard: boolean;
} {
  const activePid = state.playerOrder[state.activePlayerIndex]!;
  if (!state.conqueredTerritoryThisTurn) {
    return {
      players: state.players,
      cardDeck: state.cardDeck,
      discardPile: state.discardPile,
      prng: state.prng,
      drewCard: false,
    };
  }

  let deck = state.cardDeck;
  let discard = state.discardPile;
  let prng = state.prng;

  if (deck.length === 0 && discard.length > 0) {
    const reshuffled = shuffleArray(discard, prng);
    deck = reshuffled.value;
    prng = reshuffled.prng;
    discard = [];
  }

  if (deck.length === 0) {
    return {
      players: state.players,
      cardDeck: deck,
      discardPile: discard,
      prng,
      drewCard: false,
    };
  }

  const drawn = deck[0]!;
  const nextDeck = deck.slice(1);
  const activePlayer = state.players[activePid]!;
  const nextPlayers: Record<string, RiskPlayerState> = {
    ...state.players,
    [activePid]: {
      ...activePlayer,
      cards: [...activePlayer.cards, drawn],
    },
  };

  return {
    players: nextPlayers,
    cardDeck: nextDeck,
    discardPile: discard,
    prng,
    drewCard: true,
  };
}

function finishActivePlayerTurn(
  state: RiskGameState,
  turnSummaryLog?: string
): RiskGameState {
  const activePid = state.playerOrder[state.activePlayerIndex]!;

  // Check victory before ending turn (e.g., Secret Mission completed via fortification)
  const victory = checkGameVictory(state, activePid);
  if (victory.winnerId) {
    return {
      ...state,
      phase: 'GAME_OVER',
      turnStep: 'GAME_OVER',
      winnerId: victory.winnerId,
      victoryReason: victory.victoryReason,
      actionLog: appendLog(
        state.actionLog,
        `${turnSummaryLog ? `${turnSummaryLog} ` : ''}${victory.victoryReason}`
      ),
    };
  }

  const cardDraw = drawTerritoryCardIfEarned(state);
  const nextIdx = findNextAlivePlayerIndex(
    state,
    cardDraw.players,
    state.activePlayerIndex
  );
  const nextPid = state.playerOrder[nextIdx]!;
  const wrappedRound =
    nextIdx <= state.activePlayerIndex
      ? state.roundNumber + 1
      : state.roundNumber;

  const reinforcements = calculateTurnReinforcements(
    state.territories,
    nextPid
  );
  const updatedPlayers: Record<string, RiskPlayerState> = {
    ...cardDraw.players,
    [nextPid]: {
      ...cardDraw.players[nextPid]!,
      unplacedArmies: reinforcements,
    },
  };

  let logs = state.actionLog;
  if (turnSummaryLog) {
    logs = appendLog(logs, turnSummaryLog);
  }
  if (cardDraw.drewCard) {
    logs = appendLog(logs, `${activePid} drew a Risk Territory card.`);
  }
  logs = appendLog(
    logs,
    `Turn ${wrappedRound}: ${nextPid} receives ${reinforcements} reinforcements.`
  );

  return {
    ...state,
    turnStep: 'REINFORCE',
    activePlayerIndex: nextIdx,
    turnNumber: state.turnNumber + 1,
    roundNumber: wrappedRound,
    players: updatedPlayers,
    cardDeck: cardDraw.cardDeck,
    discardPile: cardDraw.discardPile,
    conqueredTerritoryThisTurn: false,
    pendingDefense: null,
    pendingConquest: null,
    returnStepAfterForcedTrade: null,
    prng: cardDraw.prng,
    actionLog: logs,
  };
}

function rollSortedDice(
  count: number,
  prng: PRNGState
): { readonly rolls: readonly number[]; readonly prng: PRNGState } {
  const rolls: number[] = [];
  let currentPrng = prng;
  for (let i = 0; i < count; i++) {
    const r = nextInt(currentPrng, 1, 6);
    rolls.push(r.value);
    currentPrng = r.prng;
  }
  rolls.sort((a, b) => b - a);
  return { rolls, prng: currentPrng };
}

function resolveVolleyRolls(
  attackerDiceCount: number,
  defenderDiceCount: number,
  prng: PRNGState
): { readonly volley: RiskCombatVolley; readonly prng: PRNGState } {
  const attRes = rollSortedDice(attackerDiceCount, prng);
  const defRes = rollSortedDice(defenderDiceCount, attRes.prng);

  const pairCount = Math.min(attRes.rolls.length, defRes.rolls.length);
  const comparisons: RiskDiceComparison[] = [];
  let attackerLosses = 0;
  let defenderLosses = 0;

  for (let i = 0; i < pairCount; i++) {
    const aDie = attRes.rolls[i]!;
    const dDie = defRes.rolls[i]!;
    if (aDie > dDie) {
      comparisons.push({
        attackerDie: aDie,
        defenderDie: dDie,
        winner: 'ATTACKER',
      });
      defenderLosses += 1;
    } else {
      // Defender wins ties in Risk
      comparisons.push({
        attackerDie: aDie,
        defenderDie: dDie,
        winner: 'DEFENDER',
      });
      attackerLosses += 1;
    }
  }

  return {
    volley: {
      attackerRolls: attRes.rolls,
      defenderRolls: defRes.rolls,
      comparisons,
      attackerLosses,
      defenderLosses,
    },
    prng: defRes.prng,
  };
}

function finalizeConquestOrPostMove(
  state: RiskGameState,
  fromTerritoryId: RiskTerritoryId,
  toTerritoryId: RiskTerritoryId,
  armiesMoved: number
): RiskGameState {
  const attackerId = state.playerOrder[state.activePlayerIndex]!;
  const fromState = state.territories[fromTerritoryId];
  const toState = state.territories[toTerritoryId];

  const updatedTerritories: Record<RiskTerritoryId, RiskTerritoryState> = {
    ...state.territories,
    [fromTerritoryId]: {
      ...fromState,
      armies: fromState.armies - armiesMoved,
    },
    [toTerritoryId]: {
      ...toState,
      ownerId: attackerId,
      armies: toState.armies + armiesMoved,
    },
  };

  let nextState: RiskGameState = {
    ...state,
    territories: updatedTerritories,
    pendingConquest: null,
    conqueredTerritoryThisTurn: true,
  };

  const victory = checkGameVictory(nextState, attackerId);
  if (victory.winnerId) {
    return {
      ...nextState,
      phase: 'GAME_OVER',
      turnStep: 'GAME_OVER',
      winnerId: victory.winnerId,
      victoryReason: victory.victoryReason,
      actionLog: appendLog(nextState.actionLog, victory.victoryReason!),
    };
  }

  const attackerPlayer = nextState.players[attackerId]!;
  if (attackerPlayer.cards.length >= 5) {
    return {
      ...nextState,
      turnStep: 'FORCED_CARD_TRADE',
      returnStepAfterForcedTrade: 'ATTACK',
      actionLog: appendLog(
        nextState.actionLog,
        `${attackerId} now holds ${attackerPlayer.cards.length} cards and must trade in sets down to fewer than 5 cards.`
      ),
    };
  }

  return {
    ...nextState,
    turnStep: 'ATTACK',
  };
}

function executeCombatResolution(
  state: RiskGameState,
  params: {
    readonly fromTerritoryId: RiskTerritoryId;
    readonly toTerritoryId: RiskTerritoryId;
    readonly attackerId: string;
    readonly defenderId: string;
    readonly mode: 'MANUAL' | 'AUTO';
    readonly initialAttackerDice: 1 | 2 | 3;
    readonly forcedFirstDefenderDice: (1 | 2) | null;
    readonly minArmiesToKeep: number;
    readonly priorVolleys: readonly RiskCombatVolley[];
  }
): RiskGameState {
  const {
    fromTerritoryId,
    toTerritoryId,
    attackerId,
    defenderId,
    mode,
    minArmiesToKeep,
  } = params;

  let currentFromArmies = state.territories[fromTerritoryId].armies;
  let currentToArmies = state.territories[toTerritoryId].armies;
  let prng = state.prng;
  const volleys: RiskCombatVolley[] = [...params.priorVolleys];

  const defender = state.players[defenderId]!;
  let isFirstIteration = true;
  let lastAttackerDiceUsed: 1 | 2 | 3 = params.initialAttackerDice;

  while (true) {
    const maxAttDice = Math.min(3, currentFromArmies - 1) as 1 | 2 | 3;
    const attackerDice: 1 | 2 | 3 = isFirstIteration
      ? params.initialAttackerDice
      : maxAttDice;
    lastAttackerDiceUsed = attackerDice;

    // Determine if we need to pause for manual defender dice choice
    const needsManualDefenderChoice =
      !defender.isNeutral &&
      !defender.autoDefend &&
      !(isFirstIteration && params.forcedFirstDefenderDice !== null);

    if (needsManualDefenderChoice) {
      // Save partial combat progress if prior volleys occurred and pause for defender
      const updatedTerritories: Record<RiskTerritoryId, RiskTerritoryState> = {
        ...state.territories,
        [fromTerritoryId]: {
          ...state.territories[fromTerritoryId],
          armies: currentFromArmies,
        },
        [toTerritoryId]: {
          ...state.territories[toTerritoryId],
          armies: currentToArmies,
        },
      };

      const totalAttLosses = volleys.reduce(
        (sum, v) => sum + v.attackerLosses,
        0
      );
      const totalDefLosses = volleys.reduce(
        (sum, v) => sum + v.defenderLosses,
        0
      );

      const fromName = RISK_TERRITORIES_BY_ID[fromTerritoryId].name;
      const toName = RISK_TERRITORIES_BY_ID[toTerritoryId].name;

      return {
        ...state,
        turnStep: 'AWAITING_DEFENDER_DICE',
        territories: updatedTerritories,
        prng,
        pendingDefense: {
          fromTerritoryId,
          toTerritoryId,
          attackerId,
          defenderId,
          attackerDiceCount: attackerDice,
          attackMode: mode,
          minArmiesToKeep,
          priorVolleys: volleys,
        },
        lastCombat:
          volleys.length > 0
            ? {
                fromTerritoryId,
                toTerritoryId,
                attackerId,
                defenderId,
                mode,
                volleys,
                totalAttackerLosses: totalAttLosses,
                totalDefenderLosses: totalDefLosses,
                conquered: false,
                stoppedForManualDefense: true,
              }
            : state.lastCombat,
        actionLog: appendLog(
          state.actionLog,
          `${attackerId} attacks ${toName} from ${fromName} with ${attackerDice} die/dice — awaiting ${defenderId}'s defense roll.`
        ),
      };
    }

    const defenderDice: 1 | 2 =
      isFirstIteration && params.forcedFirstDefenderDice !== null
        ? params.forcedFirstDefenderDice
        : (Math.min(2, currentToArmies) as 1 | 2);

    const resolved = resolveVolleyRolls(attackerDice, defenderDice, prng);
    prng = resolved.prng;
    volleys.push(resolved.volley);

    currentFromArmies -= resolved.volley.attackerLosses;
    currentToArmies -= resolved.volley.defenderLosses;
    isFirstIteration = false;

    if (currentToArmies <= 0) {
      break;
    }
    if (mode === 'MANUAL') {
      break;
    }
    if (currentFromArmies <= Math.max(1, minArmiesToKeep)) {
      break;
    }
  }

  const totalAttackerLosses = volleys.reduce(
    (sum, v) => sum + v.attackerLosses,
    0
  );
  const totalDefenderLosses = volleys.reduce(
    (sum, v) => sum + v.defenderLosses,
    0
  );
  const conquered = currentToArmies <= 0;

  const fromName = RISK_TERRITORIES_BY_ID[fromTerritoryId].name;
  const toName = RISK_TERRITORIES_BY_ID[toTerritoryId].name;

  const combatSummary: RiskCombatSummary = {
    fromTerritoryId,
    toTerritoryId,
    attackerId,
    defenderId,
    mode,
    volleys,
    totalAttackerLosses,
    totalDefenderLosses,
    conquered,
    stoppedForManualDefense: false,
  };

  if (!conquered) {
    const updatedTerritories: Record<RiskTerritoryId, RiskTerritoryState> = {
      ...state.territories,
      [fromTerritoryId]: {
        ...state.territories[fromTerritoryId],
        armies: currentFromArmies,
      },
      [toTerritoryId]: {
        ...state.territories[toTerritoryId],
        armies: currentToArmies,
      },
    };

    const lastVolley = volleys[volleys.length - 1]!;
    const logMsg =
      volleys.length === 1
        ? `Battle for ${toName}: ${attackerId} rolled [${lastVolley.attackerRolls.join(', ')}] vs ${defenderId} [${lastVolley.defenderRolls.join(', ')}] (Losses: Att ${totalAttackerLosses}, Def ${totalDefenderLosses}).`
        : `Blitz on ${toName} (${volleys.length} volleys): ${attackerId} lost ${totalAttackerLosses}, ${defenderId} lost ${totalDefenderLosses}.`;

    return {
      ...state,
      turnStep: 'ATTACK',
      territories: updatedTerritories,
      pendingDefense: null,
      lastCombat: combatSummary,
      prng,
      actionLog: appendLog(state.actionLog, logMsg),
    };
  }

  // Territory Conquered!
  let updatedTerritories: Record<RiskTerritoryId, RiskTerritoryState> = {
    ...state.territories,
    [fromTerritoryId]: {
      ...state.territories[fromTerritoryId],
      armies: currentFromArmies,
    },
    [toTerritoryId]: {
      id: toTerritoryId,
      ownerId: attackerId,
      armies: 0,
    },
  };

  let updatedPlayers: Record<string, RiskPlayerState> = { ...state.players };
  let logs = appendLog(
    state.actionLog,
    `${attackerId} conquered ${toName} from ${fromName}!`
  );

  // Check if defender is completely eliminated
  const defenderRemainingCount = getOwnedTerritories(
    updatedTerritories,
    defenderId
  ).length;
  if (defenderRemainingCount === 0) {
    const defPlayer = updatedPlayers[defenderId]!;
    const attPlayer = updatedPlayers[attackerId]!;
    const lootedCards = defPlayer.cards;

    updatedPlayers[defenderId] = {
      ...defPlayer,
      eliminated: true,
      eliminatedByPlayerId: attackerId,
      cards: [],
    };
    if (lootedCards.length > 0) {
      updatedPlayers[attackerId] = {
        ...attPlayer,
        cards: [...attPlayer.cards, ...lootedCards],
      };
      logs = appendLog(
        logs,
        `${attackerId} eliminated ${defenderId} and captured ${lootedCards.length} Risk card(s)!`
      );
    } else {
      logs = appendLog(logs, `${attackerId} eliminated ${defenderId}!`);
    }
  }

  const minMove = Math.min(lastAttackerDiceUsed, currentFromArmies - 1);
  const maxMove = currentFromArmies - 1;

  const baseConqueredState: RiskGameState = {
    ...state,
    territories: updatedTerritories,
    players: updatedPlayers,
    pendingDefense: null,
    lastCombat: combatSummary,
    conqueredTerritoryThisTurn: true,
    prng,
    actionLog: logs,
  };

  if (minMove >= maxMove) {
    return finalizeConquestOrPostMove(
      baseConqueredState,
      fromTerritoryId,
      toTerritoryId,
      minMove
    );
  }

  // Check if conquest already wins immediately (e.g. Capital or Elimination or 24 territories)
  // Apply minMove provisionally just to test immediate win where army count split doesn't block victory
  const provisionalTerritories: Record<RiskTerritoryId, RiskTerritoryState> = {
    ...updatedTerritories,
    [fromTerritoryId]: {
      ...updatedTerritories[fromTerritoryId],
      armies: currentFromArmies - minMove,
    },
    [toTerritoryId]: {
      id: toTerritoryId,
      ownerId: attackerId,
      armies: minMove,
    },
  };
  const provisionalState: RiskGameState = {
    ...baseConqueredState,
    territories: provisionalTerritories,
  };
  const immediateWin = checkGameVictory(provisionalState, attackerId);
  if (immediateWin.winnerId) {
    return {
      ...provisionalState,
      phase: 'GAME_OVER',
      turnStep: 'GAME_OVER',
      pendingConquest: null,
      winnerId: immediateWin.winnerId,
      victoryReason: immediateWin.victoryReason,
      actionLog: appendLog(provisionalState.actionLog, immediateWin.victoryReason!),
    };
  }

  return {
    ...baseConqueredState,
    turnStep: 'CONQUEST_MOVE',
    pendingConquest: {
      fromTerritoryId,
      toTerritoryId,
      minArmiesToMove: minMove,
      maxArmiesToMove: maxMove,
    },
  };
}

export function validateRiskAction(
  state: RiskGameState,
  playerId: string,
  action: RiskAction
): ValidationResult {
  if (state.phase === 'GAME_OVER' || state.turnStep === 'GAME_OVER') {
    return { valid: false, reason: 'The game is already over.' };
  }

  const player = state.players[playerId];
  if (!player || player.isNeutral) {
    return { valid: false, reason: 'Unknown or non-human player.' };
  }

  // Any human player can toggle their own Auto/Manual defense mode at any time
  if (action.type === 'RISK_SET_DEFENSE_MODE') {
    return { valid: true };
  }

  // Manual Defender Roll is dispatched by the defending player!
  if (action.type === 'RISK_DEFEND_ROLL') {
    if (
      state.turnStep !== 'AWAITING_DEFENDER_DICE' ||
      !state.pendingDefense
    ) {
      return {
        valid: false,
        reason: 'There is no pending defense roll right now.',
      };
    }
    if (state.pendingDefense.defenderId !== playerId) {
      return {
        valid: false,
        reason: 'Only the defending commander may roll defense dice.',
      };
    }
    const defTerritory = state.territories[state.pendingDefense.toTerritoryId];
    const maxDefDice = Math.min(2, defTerritory.armies);
    if (action.defenderDice < 1 || action.defenderDice > maxDefDice) {
      return {
        valid: false,
        reason: `Defender can roll between 1 and ${maxDefDice} dice.`,
      };
    }
    return { valid: true };
  }

  // All other actions require it to be the active player's turn
  const activePlayerId = state.playerOrder[state.activePlayerIndex];
  if (playerId !== activePlayerId) {
    return { valid: false, reason: 'It is not your turn.' };
  }

  switch (action.type) {
    case 'RISK_CLAIM_TERRITORY': {
      if (state.turnStep !== 'SETUP_CLAIM') {
        return { valid: false, reason: 'Not in territory claiming step.' };
      }
      const terr = state.territories[action.territoryId];
      if (!terr) {
        return { valid: false, reason: 'Invalid territory.' };
      }
      if (terr.ownerId !== null) {
        return { valid: false, reason: 'Territory is already claimed.' };
      }
      return { valid: true };
    }

    case 'RISK_PLACE_INITIAL_ARMY': {
      if (state.turnStep !== 'SETUP_PLACE') {
        return {
          valid: false,
          reason: 'Not in initial army placement step.',
        };
      }
      const terr = state.territories[action.territoryId];
      if (!terr || terr.ownerId !== playerId) {
        return {
          valid: false,
          reason: 'You must place armies on a territory you control.',
        };
      }
      if (player.unplacedArmies <= 0) {
        return { valid: false, reason: 'You have no remaining setup armies.' };
      }
      return { valid: true };
    }

    case 'RISK_AUTO_FINISH_SETUP': {
      if (
        state.turnStep !== 'SETUP_CLAIM' &&
        state.turnStep !== 'SETUP_PLACE'
      ) {
        return {
          valid: false,
          reason: 'Auto-finish setup is only available during setup.',
        };
      }
      return { valid: true };
    }

    case 'RISK_CHOOSE_CAPITAL': {
      if (state.turnStep !== 'CHOOSE_CAPITAL') {
        return { valid: false, reason: 'Not in Capital selection step.' };
      }
      const terr = state.territories[action.territoryId];
      if (!terr || terr.ownerId !== playerId) {
        return {
          valid: false,
          reason: 'Your Capital must be placed on a territory you control.',
        };
      }
      if (player.capitalTerritoryId !== null) {
        return { valid: false, reason: 'You have already chosen your Capital.' };
      }
      return { valid: true };
    }

    case 'RISK_TRADE_CARDS': {
      if (
        state.turnStep !== 'REINFORCE' &&
        state.turnStep !== 'FORCED_CARD_TRADE'
      ) {
        return {
          valid: false,
          reason: 'Cards can only be traded at the start of your turn or during a forced mid-turn trade.',
        };
      }
      const [id1, id2, id3] = action.cardIds;
      if (new Set([id1, id2, id3]).size !== 3) {
        return { valid: false, reason: 'Must select 3 distinct cards.' };
      }
      const selectedCards = action.cardIds
        .map((cid) => player.cards.find((c) => c.id === cid))
        .filter((c): c is RiskCard => c !== undefined);
      if (selectedCards.length !== 3) {
        return {
          valid: false,
          reason: 'One or more selected cards are not in your hand.',
        };
      }
      if (!isValidRiskCardSet(selectedCards)) {
        return {
          valid: false,
          reason:
            'Invalid card set. Trade 3 of the same symbol, 1 of each symbol, or include a Wild card.',
        };
      }
      if (action.bonusTerritoryId !== undefined) {
        const matchesCard = selectedCards.some(
          (c) => c.territoryId === action.bonusTerritoryId
        );
        const ownsTerr =
          state.territories[action.bonusTerritoryId]?.ownerId === playerId;
        if (!matchesCard || !ownsTerr) {
          return {
            valid: false,
            reason:
              'Bonus territory must match one of the traded cards and be owned by you.',
          };
        }
      }
      return { valid: true };
    }

    case 'RISK_PLACE_REINFORCEMENTS': {
      if (state.turnStep !== 'REINFORCE') {
        return { valid: false, reason: 'Not in reinforcement step.' };
      }
      if (player.cards.length >= 5) {
        return {
          valid: false,
          reason: 'You hold 5 or more Risk cards and must trade in a set first.',
        };
      }
      const terr = state.territories[action.territoryId];
      if (!terr || terr.ownerId !== playerId) {
        return {
          valid: false,
          reason: 'You can only reinforce territories you control.',
        };
      }
      if (
        !Number.isInteger(action.count) ||
        action.count < 1 ||
        action.count > player.unplacedArmies
      ) {
        return {
          valid: false,
          reason: `Reinforcement count must be between 1 and ${player.unplacedArmies}.`,
        };
      }
      return { valid: true };
    }

    case 'RISK_DECLARE_ATTACK': {
      if (state.turnStep !== 'ATTACK') {
        return { valid: false, reason: 'Not in attack step.' };
      }
      const fromTerr = state.territories[action.fromTerritoryId];
      const toTerr = state.territories[action.toTerritoryId];
      if (!fromTerr || !toTerr) {
        return { valid: false, reason: 'Invalid territory selection.' };
      }
      if (fromTerr.ownerId !== playerId) {
        return {
          valid: false,
          reason: 'You must attack from a territory you control.',
        };
      }
      if (toTerr.ownerId === playerId || toTerr.ownerId === null) {
        return {
          valid: false,
          reason: 'Target territory must belong to an opposing force.',
        };
      }
      if (!areRiskTerritoriesAdjacent(action.fromTerritoryId, action.toTerritoryId)) {
        return {
          valid: false,
          reason: 'Target territory is not connected to attacking territory.',
        };
      }
      if (fromTerr.armies < 2) {
        return {
          valid: false,
          reason: 'Attacking territory needs at least 2 armies to attack.',
        };
      }
      const maxAttDice = Math.min(3, fromTerr.armies - 1);
      if (action.mode === 'MANUAL' && action.attackerDice !== undefined) {
        if (action.attackerDice < 1 || action.attackerDice > maxAttDice) {
          return {
            valid: false,
            reason: `Attacker dice must be between 1 and ${maxAttDice}.`,
          };
        }
      }
      if (action.mode === 'AUTO' && action.minArmiesToKeep !== undefined) {
        if (
          action.minArmiesToKeep < 1 ||
          action.minArmiesToKeep >= fromTerr.armies
        ) {
          return {
            valid: false,
            reason: `Minimum armies to keep must be between 1 and ${fromTerr.armies - 1}.`,
          };
        }
      }
      return { valid: true };
    }

    case 'RISK_MOVE_AFTER_CONQUEST': {
      if (state.turnStep !== 'CONQUEST_MOVE' || !state.pendingConquest) {
        return {
          valid: false,
          reason: 'No conquest troop movement is pending.',
        };
      }
      const { minArmiesToMove, maxArmiesToMove } = state.pendingConquest;
      if (
        !Number.isInteger(action.armies) ||
        action.armies < minArmiesToMove ||
        action.armies > maxArmiesToMove
      ) {
        return {
          valid: false,
          reason: `Must move between ${minArmiesToMove} and ${maxArmiesToMove} armies.`,
        };
      }
      return { valid: true };
    }

    case 'RISK_END_ATTACKS': {
      if (state.turnStep !== 'ATTACK') {
        return { valid: false, reason: 'Can only end attacks during ATTACK step.' };
      }
      return { valid: true };
    }

    case 'RISK_FORTIFY': {
      if (state.turnStep !== 'FORTIFY') {
        return { valid: false, reason: 'Not in fortification step.' };
      }
      const fromTerr = state.territories[action.fromTerritoryId];
      const toTerr = state.territories[action.toTerritoryId];
      if (!fromTerr || !toTerr) {
        return { valid: false, reason: 'Invalid territory selection.' };
      }
      if (fromTerr.ownerId !== playerId || toTerr.ownerId !== playerId) {
        return {
          valid: false,
          reason: 'Both territories must be controlled by you.',
        };
      }
      if (
        !areTerritoriesConnectedByOwner(
          state.territories,
          playerId,
          action.fromTerritoryId,
          action.toTerritoryId
        )
      ) {
        return {
          valid: false,
          reason:
            'Territories are not connected by a chain of territories you control.',
        };
      }
      if (
        !Number.isInteger(action.armies) ||
        action.armies < 1 ||
        action.armies >= fromTerr.armies
      ) {
        return {
          valid: false,
          reason: `You may move between 1 and ${fromTerr.armies - 1} armies.`,
        };
      }
      return { valid: true };
    }

    case 'RISK_END_TURN': {
      if (state.turnStep !== 'ATTACK' && state.turnStep !== 'FORTIFY') {
        return {
          valid: false,
          reason: 'Finish placing reinforcements or resolving combat before ending your turn.',
        };
      }
      return { valid: true };
    }
  }
}

export function applyRiskAction(
  state: RiskGameState,
  playerId: string,
  action: RiskAction
): RiskGameState {
  const validation = validateRiskAction(state, playerId, action);
  if (!validation.valid) {
    throw new Error(validation.reason ?? 'Invalid Risk action.');
  }

  switch (action.type) {
    case 'RISK_SET_DEFENSE_MODE': {
      const targetPlayer = state.players[playerId]!;
      const updatedPlayers: Record<string, RiskPlayerState> = {
        ...state.players,
        [playerId]: {
          ...targetPlayer,
          autoDefend: action.autoDefend,
        },
      };

      // If this player was currently prompted for manual defense and just switched to Auto-Defend,
      // automatically roll max defense dice right now!
      if (
        action.autoDefend &&
        state.turnStep === 'AWAITING_DEFENDER_DICE' &&
        state.pendingDefense?.defenderId === playerId
      ) {
        const pd = state.pendingDefense;
        const maxDef = Math.min(
          2,
          state.territories[pd.toTerritoryId].armies
        ) as 1 | 2;
        return executeCombatResolution(
          {
            ...state,
            players: updatedPlayers,
          },
          {
            fromTerritoryId: pd.fromTerritoryId,
            toTerritoryId: pd.toTerritoryId,
            attackerId: pd.attackerId,
            defenderId: pd.defenderId,
            mode: pd.attackMode,
            initialAttackerDice: pd.attackerDiceCount,
            forcedFirstDefenderDice: maxDef,
            minArmiesToKeep: pd.minArmiesToKeep,
            priorVolleys: pd.priorVolleys,
          }
        );
      }

      return {
        ...state,
        players: updatedPlayers,
      };
    }

    case 'RISK_CLAIM_TERRITORY': {
      const player = state.players[playerId]!;
      const updatedTerritories: Record<RiskTerritoryId, RiskTerritoryState> = {
        ...state.territories,
        [action.territoryId]: {
          id: action.territoryId,
          ownerId: playerId,
          armies: 1,
        },
      };
      const updatedPlayers: Record<string, RiskPlayerState> = {
        ...state.players,
        [playerId]: {
          ...player,
          unplacedArmies: player.unplacedArmies - 1,
        },
      };

      const terrName = RISK_TERRITORIES_BY_ID[action.territoryId].name;
      const anyUnclaimed = ALL_RISK_TERRITORY_IDS.some(
        (tid) => updatedTerritories[tid].ownerId === null
      );

      if (anyUnclaimed) {
        const nextIdx =
          (state.activePlayerIndex + 1) % state.playerOrder.length;
        return {
          ...state,
          territories: updatedTerritories,
          players: updatedPlayers,
          activePlayerIndex: nextIdx,
          actionLog: appendLog(
            state.actionLog,
            `${playerId} claimed ${terrName}.`
          ),
        };
      }

      // All 42 territories claimed -> move to SETUP_PLACE if anyone still has unplaced armies
      const nextSetupIdx = findNextPlayerWithSetupArmies(
        state,
        updatedPlayers,
        state.activePlayerIndex
      );
      if (nextSetupIdx >= 0) {
        return {
          ...state,
          turnStep: 'SETUP_PLACE',
          territories: updatedTerritories,
          players: updatedPlayers,
          activePlayerIndex: nextSetupIdx,
          actionLog: appendLog(
            state.actionLog,
            `${playerId} claimed ${terrName}. All territories claimed — place remaining starting armies!`
          ),
        };
      }

      return transitionOutOfSetupPlacement(
        state,
        updatedPlayers,
        updatedTerritories,
        state.prng,
        `${playerId} claimed ${terrName}.`
      );
    }

    case 'RISK_PLACE_INITIAL_ARMY': {
      const player = state.players[playerId]!;
      const terr = state.territories[action.territoryId];
      const updatedTerritories: Record<RiskTerritoryId, RiskTerritoryState> = {
        ...state.territories,
        [action.territoryId]: {
          ...terr,
          armies: terr.armies + 1,
        },
      };
      const updatedPlayers: Record<string, RiskPlayerState> = {
        ...state.players,
        [playerId]: {
          ...player,
          unplacedArmies: player.unplacedArmies - 1,
        },
      };

      const terrName = RISK_TERRITORIES_BY_ID[action.territoryId].name;
      const nextIdx = findNextPlayerWithSetupArmies(
        state,
        updatedPlayers,
        state.activePlayerIndex
      );

      if (nextIdx >= 0) {
        return {
          ...state,
          territories: updatedTerritories,
          players: updatedPlayers,
          activePlayerIndex: nextIdx,
          actionLog: appendLog(
            state.actionLog,
            `${playerId} fortified ${terrName} (${terr.armies + 1}).`
          ),
        };
      }

      return transitionOutOfSetupPlacement(
        state,
        updatedPlayers,
        updatedTerritories,
        state.prng,
        `Initial troop deployment complete!`
      );
    }

    case 'RISK_AUTO_FINISH_SETUP': {
      let prng = state.prng;
      const updatedTerritories: Record<RiskTerritoryId, RiskTerritoryState> = {
        ...state.territories,
      };
      const updatedPlayers: Record<string, RiskPlayerState> = {
        ...state.players,
      };

      // 1. Claim any remaining unclaimed territories randomly in turn order
      const unclaimedIds = ALL_RISK_TERRITORY_IDS.filter(
        (tid) => updatedTerritories[tid].ownerId === null
      );
      if (unclaimedIds.length > 0) {
        const shuffledRes = shuffleArray(unclaimedIds, prng);
        prng = shuffledRes.prng;
        let turnIdx = state.activePlayerIndex;
        for (const tid of shuffledRes.value) {
          const pid = state.playerOrder[turnIdx]!;
          updatedTerritories[tid] = { id: tid, ownerId: pid, armies: 1 };
          updatedPlayers[pid] = {
            ...updatedPlayers[pid]!,
            unplacedArmies: updatedPlayers[pid]!.unplacedArmies - 1,
          };
          turnIdx = (turnIdx + 1) % state.playerOrder.length;
        }
      }

      // 2. Distribute each player's remaining starting armies randomly across their owned territories
      for (const pid of state.playerOrder) {
        let rem = updatedPlayers[pid]!.unplacedArmies;
        const ownedIds = ALL_RISK_TERRITORY_IDS.filter(
          (tid) => updatedTerritories[tid].ownerId === pid
        );
        while (rem > 0 && ownedIds.length > 0) {
          const pick = nextInt(prng, 0, ownedIds.length - 1);
          prng = pick.prng;
          const tid = ownedIds[pick.value]!;
          updatedTerritories[tid] = {
            ...updatedTerritories[tid],
            armies: updatedTerritories[tid].armies + 1,
          };
          rem -= 1;
        }
        updatedPlayers[pid] = {
          ...updatedPlayers[pid]!,
          unplacedArmies: 0,
        };
      }

      return transitionOutOfSetupPlacement(
        state,
        updatedPlayers,
        updatedTerritories,
        prng,
        'Auto-deployed all remaining starting armies!'
      );
    }

    case 'RISK_CHOOSE_CAPITAL': {
      const player = state.players[playerId]!;
      const updatedPlayers: Record<string, RiskPlayerState> = {
        ...state.players,
        [playerId]: {
          ...player,
          capitalTerritoryId: action.territoryId,
        },
      };
      const updatedCapitals: Record<string, string> = {
        ...state.capitalOwnerByTerritory,
        [action.territoryId]: playerId,
      };
      const terrName = RISK_TERRITORIES_BY_ID[action.territoryId].name;

      const nextIdx = state.activePlayerIndex + 1;
      if (nextIdx < state.playerOrder.length) {
        return {
          ...state,
          players: updatedPlayers,
          capitalOwnerByTerritory: updatedCapitals,
          activePlayerIndex: nextIdx,
          actionLog: appendLog(
            state.actionLog,
            `${playerId} established their Capital in ${terrName}.`
          ),
        };
      }

      // All capitals chosen -> begin Round 1!
      const firstPid = state.playerOrder[0]!;
      const firstReinforcements = calculateTurnReinforcements(
        state.territories,
        firstPid
      );
      updatedPlayers[firstPid] = {
        ...updatedPlayers[firstPid]!,
        unplacedArmies: firstReinforcements,
      };

      return {
        ...state,
        phase: 'PLAYING',
        turnStep: 'REINFORCE',
        activePlayerIndex: 0,
        players: updatedPlayers,
        capitalOwnerByTerritory: updatedCapitals,
        actionLog: appendLog(
          state.actionLog,
          `${playerId} established their Capital in ${terrName}. All Capitals placed — ${firstPid} receives ${firstReinforcements} reinforcements!`
        ),
      };
    }

    case 'RISK_TRADE_CARDS': {
      const player = state.players[playerId]!;
      const tradedSet = action.cardIds.map(
        (cid) => player.cards.find((c) => c.id === cid)!
      );
      const remainingHand = player.cards.filter(
        (c) => !action.cardIds.includes(c.id)
      );

      const bonusArmies = evaluateRiskCardSetValue(
        tradedSet,
        state.cardTradeMode,
        state.setsTradedCount
      );

      // Check +2 territory ownership bonus (at most once per trade)
      const matchingOwnedTerritoryIds = tradedSet
        .map((c) => c.territoryId)
        .filter(
          (tid): tid is RiskTerritoryId =>
            tid !== null && state.territories[tid].ownerId === playerId
        );

      const chosenBonusTerrId =
        action.bonusTerritoryId &&
        matchingOwnedTerritoryIds.includes(action.bonusTerritoryId)
          ? action.bonusTerritoryId
          : matchingOwnedTerritoryIds[0] ?? null;

      let updatedTerritories = state.territories;
      let territoryBonusText = '';
      if (chosenBonusTerrId) {
        const currentTerr = state.territories[chosenBonusTerrId];
        updatedTerritories = {
          ...state.territories,
          [chosenBonusTerrId]: {
            ...currentTerr,
            armies: currentTerr.armies + 2,
          },
        };
        territoryBonusText = ` (+2 bonus armies on ${RISK_TERRITORIES_BY_ID[chosenBonusTerrId].name})`;
      }

      const updatedPlayers: Record<string, RiskPlayerState> = {
        ...state.players,
        [playerId]: {
          ...player,
          cards: remainingHand,
          unplacedArmies: player.unplacedArmies + bonusArmies,
        },
      };

      let nextStep = state.turnStep;
      let nextReturnStep = state.returnStepAfterForcedTrade;
      if (state.turnStep === 'FORCED_CARD_TRADE' && remainingHand.length < 5) {
        // Now allow placing the newly earned armies before resuming ATTACK!
        nextStep = 'REINFORCE';
        nextReturnStep = 'ATTACK';
      }

      const interimState: RiskGameState = {
        ...state,
        turnStep: nextStep,
        returnStepAfterForcedTrade: nextReturnStep,
        players: updatedPlayers,
        territories: updatedTerritories,
        discardPile: [...state.discardPile, ...tradedSet],
        setsTradedCount: state.setsTradedCount + 1,
        actionLog: appendLog(
          state.actionLog,
          `${playerId} traded in a card set for +${bonusArmies} armies${territoryBonusText}.`
        ),
      };

      // Check if +2 territory bonus satisfied Secret Mission (18 territories w/ 2+ armies)
      const victory = checkGameVictory(interimState, playerId);
      if (victory.winnerId) {
        return {
          ...interimState,
          phase: 'GAME_OVER',
          turnStep: 'GAME_OVER',
          winnerId: victory.winnerId,
          victoryReason: victory.victoryReason,
          actionLog: appendLog(interimState.actionLog, victory.victoryReason!),
        };
      }

      return interimState;
    }

    case 'RISK_PLACE_REINFORCEMENTS': {
      const player = state.players[playerId]!;
      const terr = state.territories[action.territoryId];
      const remainingArmies = player.unplacedArmies - action.count;

      const updatedTerritories: Record<RiskTerritoryId, RiskTerritoryState> = {
        ...state.territories,
        [action.territoryId]: {
          ...terr,
          armies: terr.armies + action.count,
        },
      };
      const updatedPlayers: Record<string, RiskPlayerState> = {
        ...state.players,
        [playerId]: {
          ...player,
          unplacedArmies: remainingArmies,
        },
      };

      const terrName = RISK_TERRITORIES_BY_ID[action.territoryId].name;
      const nextStep =
        remainingArmies === 0
          ? state.returnStepAfterForcedTrade ?? 'ATTACK'
          : 'REINFORCE';

      const interimState: RiskGameState = {
        ...state,
        turnStep: nextStep,
        returnStepAfterForcedTrade:
          remainingArmies === 0 ? null : state.returnStepAfterForcedTrade,
        players: updatedPlayers,
        territories: updatedTerritories,
        actionLog: appendLog(
          state.actionLog,
          `${playerId} deployed +${action.count} army/armies to ${terrName} (now ${terr.armies + action.count}).`
        ),
      };

      const victory = checkGameVictory(interimState, playerId);
      if (victory.winnerId) {
        return {
          ...interimState,
          phase: 'GAME_OVER',
          turnStep: 'GAME_OVER',
          winnerId: victory.winnerId,
          victoryReason: victory.victoryReason,
          actionLog: appendLog(interimState.actionLog, victory.victoryReason!),
        };
      }

      return interimState;
    }

    case 'RISK_DECLARE_ATTACK': {
      const fromTerr = state.territories[action.fromTerritoryId];
      const toTerr = state.territories[action.toTerritoryId];
      const defenderId = toTerr.ownerId!;
      const maxAttDice = Math.min(3, fromTerr.armies - 1) as 1 | 2 | 3;
      const chosenAttackerDice: 1 | 2 | 3 =
        action.mode === 'MANUAL'
          ? (action.attackerDice ?? maxAttDice)
          : maxAttDice;
      const minKeep = Math.max(1, action.minArmiesToKeep ?? 1);

      return executeCombatResolution(state, {
        fromTerritoryId: action.fromTerritoryId,
        toTerritoryId: action.toTerritoryId,
        attackerId: playerId,
        defenderId,
        mode: action.mode,
        initialAttackerDice: chosenAttackerDice,
        forcedFirstDefenderDice: null,
        minArmiesToKeep: minKeep,
        priorVolleys: [],
      });
    }

    case 'RISK_DEFEND_ROLL': {
      const pd = state.pendingDefense!;
      return executeCombatResolution(state, {
        fromTerritoryId: pd.fromTerritoryId,
        toTerritoryId: pd.toTerritoryId,
        attackerId: pd.attackerId,
        defenderId: pd.defenderId,
        mode: pd.attackMode,
        initialAttackerDice: pd.attackerDiceCount,
        forcedFirstDefenderDice: action.defenderDice,
        minArmiesToKeep: pd.minArmiesToKeep,
        priorVolleys: pd.priorVolleys,
      });
    }

    case 'RISK_MOVE_AFTER_CONQUEST': {
      const pc = state.pendingConquest!;
      const toName = RISK_TERRITORIES_BY_ID[pc.toTerritoryId].name;
      const movedState = finalizeConquestOrPostMove(
        state,
        pc.fromTerritoryId,
        pc.toTerritoryId,
        action.armies
      );
      if (movedState.phase === 'GAME_OVER') {
        return movedState;
      }
      return {
        ...movedState,
        actionLog: appendLog(
          movedState.actionLog,
          `${playerId} advanced ${action.armies} army/armies into ${toName}.`
        ),
      };
    }

    case 'RISK_END_ATTACKS': {
      return {
        ...state,
        turnStep: 'FORTIFY',
        actionLog: appendLog(
          state.actionLog,
          `${playerId} ended attacks and entered Fortify phase.`
        ),
      };
    }

    case 'RISK_FORTIFY': {
      const fromTerr = state.territories[action.fromTerritoryId];
      const toTerr = state.territories[action.toTerritoryId];
      const updatedTerritories: Record<RiskTerritoryId, RiskTerritoryState> = {
        ...state.territories,
        [action.fromTerritoryId]: {
          ...fromTerr,
          armies: fromTerr.armies - action.armies,
        },
        [action.toTerritoryId]: {
          ...toTerr,
          armies: toTerr.armies + action.armies,
        },
      };

      const fromName = RISK_TERRITORIES_BY_ID[action.fromTerritoryId].name;
      const toName = RISK_TERRITORIES_BY_ID[action.toTerritoryId].name;

      const fortifiedState: RiskGameState = {
        ...state,
        territories: updatedTerritories,
      };

      return finishActivePlayerTurn(
        fortifiedState,
        `${playerId} fortified ${action.armies} army/armies from ${fromName} to ${toName}.`
      );
    }

    case 'RISK_END_TURN': {
      return finishActivePlayerTurn(state, `${playerId} ended their turn.`);
    }
  }
}

export function getRiskPlayerPerspective(
  state: RiskGameState,
  playerId: string
): RiskSanitizedGameState {
  const revealAllSecrets = state.phase === 'GAME_OVER';
  const sanitizedPlayers: Record<string, RiskSanitizedPlayerState> = {};

  for (const [pid, p] of Object.entries(state.players)) {
    const isSelf = pid === playerId;
    sanitizedPlayers[pid] = {
      id: p.id,
      color: p.color,
      isNeutral: p.isNeutral,
      eliminated: p.eliminated,
      eliminatedByPlayerId: p.eliminatedByPlayerId,
      unplacedArmies: p.unplacedArmies,
      cardCount: p.cards.length,
      cards: isSelf || revealAllSecrets ? p.cards : null,
      autoDefend: p.autoDefend,
      capitalTerritoryId: p.capitalTerritoryId,
      secretMission: isSelf || revealAllSecrets ? p.secretMission : null,
    };
  }

  const fallbackSelf: RiskSanitizedPlayerState =
    sanitizedPlayers[playerId] ??
    sanitizedPlayers[state.playerOrder[0]!]!;

  const effectiveActivePlayerId =
    state.turnStep === 'AWAITING_DEFENDER_DICE' && state.pendingDefense
      ? state.pendingDefense.defenderId
      : state.playerOrder[state.activePlayerIndex]!;

  return {
    gameId: 'risk',
    phase: state.phase,
    turnStep: state.turnStep,
    setupMode: state.setupMode,
    cardTradeMode: state.cardTradeMode,
    winCondition: state.winCondition,
    playerOrder: state.playerOrder,
    activePlayerIndex: state.activePlayerIndex,
    activePlayerId: effectiveActivePlayerId,
    turnNumber: state.turnNumber,
    roundNumber: state.roundNumber,
    self: fallbackSelf,
    players: sanitizedPlayers,
    territories: state.territories,
    capitalOwnerByTerritory: state.capitalOwnerByTerritory,
    deckCount: state.cardDeck.length,
    discardCount: state.discardPile.length,
    setsTradedCount: state.setsTradedCount,
    nextEscalatingSetValue: getEscalatingCardSetValue(state.setsTradedCount),
    conqueredTerritoryThisTurn: state.conqueredTerritoryThisTurn,
    pendingDefense: state.pendingDefense,
    pendingConquest: state.pendingConquest,
    lastCombat: state.lastCombat,
    winnerId: state.winnerId,
    victoryReason: state.victoryReason,
    actionLog: state.actionLog,
  };
}

export function calculateRiskFinalScores(
  state: RiskGameState
): Record<string, number> {
  const scores: Record<string, number> = {};
  for (const pid of state.playerOrder) {
    const ownedCount = getOwnedTerritories(state.territories, pid).length;
    const bonusWin = state.winnerId === pid ? 1000 : 0;
    scores[pid] = bonusWin + ownedCount;
  }
  return scores;
}
