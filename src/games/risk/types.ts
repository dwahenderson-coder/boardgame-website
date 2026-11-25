import { PRNGState } from '../../common/prng.js';

export type RiskContinentId =
  | 'NORTH_AMERICA'
  | 'SOUTH_AMERICA'
  | 'EUROPE'
  | 'AFRICA'
  | 'ASIA'
  | 'AUSTRALIA';

export type RiskTerritoryId =
  // North America (9)
  | 'alaska'
  | 'northwest_territory'
  | 'greenland'
  | 'alberta'
  | 'ontario'
  | 'quebec'
  | 'western_united_states'
  | 'eastern_united_states'
  | 'central_america'
  // South America (4)
  | 'venezuela'
  | 'peru'
  | 'brazil'
  | 'argentina'
  // Europe (7)
  | 'iceland'
  | 'great_britain'
  | 'scandinavia'
  | 'northern_europe'
  | 'western_europe'
  | 'southern_europe'
  | 'ukraine'
  // Africa (6)
  | 'north_africa'
  | 'egypt'
  | 'east_africa'
  | 'congo'
  | 'south_africa'
  | 'madagascar'
  // Asia (12)
  | 'ural'
  | 'siberia'
  | 'yakutsk'
  | 'kamchatka'
  | 'irkutsk'
  | 'afghanistan'
  | 'china'
  | 'mongolia'
  | 'japan'
  | 'middle_east'
  | 'india'
  | 'siam'
  // Australia (4)
  | 'indonesia'
  | 'new_guinea'
  | 'western_australia'
  | 'eastern_australia';

export type RiskCardSymbol = 'INFANTRY' | 'CAVALRY' | 'ARTILLERY' | 'WILD';

export interface RiskCard {
  readonly id: string;
  readonly symbol: RiskCardSymbol;
  readonly territoryId: RiskTerritoryId | null;
}

export type RiskSetupMode = 'MANUAL' | 'AUTO';
export type RiskCardTradeMode = 'ESCALATING' | 'FIXED';
export type RiskWinCondition = 'WORLD_DOMINATION' | 'CAPITAL' | 'SECRET_MISSION';

export type RiskTurnStep =
  | 'SETUP_CLAIM'
  | 'SETUP_PLACE'
  | 'CHOOSE_CAPITAL'
  | 'REINFORCE'
  | 'ATTACK'
  | 'AWAITING_DEFENDER_DICE'
  | 'CONQUEST_MOVE'
  | 'FORCED_CARD_TRADE'
  | 'FORTIFY'
  | 'GAME_OVER';

export type RiskSecretMission =
  | {
      readonly id: string;
      readonly title: string;
      readonly description: string;
      readonly kind: 'CONQUER_CONTINENTS';
      readonly requiredContinents: readonly RiskContinentId[];
      readonly extraAnyContinent: boolean;
    }
  | {
      readonly id: string;
      readonly title: string;
      readonly description: string;
      readonly kind: 'CONQUER_TERRITORIES';
      readonly minTerritories: number;
      readonly minArmiesPerTerritory: number;
    }
  | {
      readonly id: string;
      readonly title: string;
      readonly description: string;
      readonly kind: 'DESTROY_PLAYER';
      readonly targetPlayerId: string;
      readonly fallbackTerritories: number;
    };

export interface RiskTerritoryState {
  readonly id: RiskTerritoryId;
  readonly ownerId: string | null;
  readonly armies: number;
}

export interface RiskPlayerState {
  readonly id: string;
  readonly color: string;
  readonly isNeutral: boolean;
  readonly eliminated: boolean;
  readonly eliminatedByPlayerId: string | null;
  readonly unplacedArmies: number;
  readonly cards: readonly RiskCard[];
  readonly autoDefend: boolean;
  readonly capitalTerritoryId: RiskTerritoryId | null;
  readonly secretMission: RiskSecretMission | null;
}

export interface RiskSanitizedPlayerState {
  readonly id: string;
  readonly color: string;
  readonly isNeutral: boolean;
  readonly eliminated: boolean;
  readonly eliminatedByPlayerId: string | null;
  readonly unplacedArmies: number;
  readonly cardCount: number;
  readonly cards: readonly RiskCard[] | null;
  readonly autoDefend: boolean;
  readonly capitalTerritoryId: RiskTerritoryId | null;
  readonly secretMission: RiskSecretMission | null;
}

export interface RiskDiceComparison {
  readonly attackerDie: number;
  readonly defenderDie: number;
  readonly winner: 'ATTACKER' | 'DEFENDER';
}

export interface RiskCombatVolley {
  readonly attackerRolls: readonly number[];
  readonly defenderRolls: readonly number[];
  readonly comparisons: readonly RiskDiceComparison[];
  readonly attackerLosses: number;
  readonly defenderLosses: number;
}

export interface RiskCombatSummary {
  readonly fromTerritoryId: RiskTerritoryId;
  readonly toTerritoryId: RiskTerritoryId;
  readonly attackerId: string;
  readonly defenderId: string;
  readonly mode: 'MANUAL' | 'AUTO';
  readonly volleys: readonly RiskCombatVolley[];
  readonly totalAttackerLosses: number;
  readonly totalDefenderLosses: number;
  readonly conquered: boolean;
  readonly stoppedForManualDefense: boolean;
}

export interface RiskPendingDefense {
  readonly fromTerritoryId: RiskTerritoryId;
  readonly toTerritoryId: RiskTerritoryId;
  readonly attackerId: string;
  readonly defenderId: string;
  readonly attackerDiceCount: 1 | 2 | 3;
  readonly attackMode: 'MANUAL' | 'AUTO';
  readonly minArmiesToKeep: number;
  readonly priorVolleys: readonly RiskCombatVolley[];
}

export interface RiskPendingConquest {
  readonly fromTerritoryId: RiskTerritoryId;
  readonly toTerritoryId: RiskTerritoryId;
  readonly minArmiesToMove: number;
  readonly maxArmiesToMove: number;
}

export interface RiskGameState {
  readonly gameId: 'risk';
  readonly phase: 'SETUP' | 'PLAYING' | 'GAME_OVER';
  readonly turnStep: RiskTurnStep;
  readonly setupMode: RiskSetupMode;
  readonly cardTradeMode: RiskCardTradeMode;
  readonly winCondition: RiskWinCondition;
  readonly playerOrder: readonly string[];
  readonly activePlayerIndex: number;
  readonly turnNumber: number;
  readonly roundNumber: number;
  readonly players: Readonly<Record<string, RiskPlayerState>>;
  readonly territories: Readonly<Record<RiskTerritoryId, RiskTerritoryState>>;
  readonly capitalOwnerByTerritory: Readonly<Record<string, string>>;
  readonly cardDeck: readonly RiskCard[];
  readonly discardPile: readonly RiskCard[];
  readonly setsTradedCount: number;
  readonly conqueredTerritoryThisTurn: boolean;
  readonly pendingDefense: RiskPendingDefense | null;
  readonly pendingConquest: RiskPendingConquest | null;
  readonly returnStepAfterForcedTrade: 'ATTACK' | 'REINFORCE' | null;
  readonly lastCombat: RiskCombatSummary | null;
  readonly winnerId: string | null;
  readonly victoryReason: string | null;
  readonly actionLog: readonly string[];
  readonly prng: PRNGState;
}

export interface RiskSanitizedGameState {
  readonly gameId: 'risk';
  readonly phase: 'SETUP' | 'PLAYING' | 'GAME_OVER';
  readonly turnStep: RiskTurnStep;
  readonly setupMode: RiskSetupMode;
  readonly cardTradeMode: RiskCardTradeMode;
  readonly winCondition: RiskWinCondition;
  readonly playerOrder: readonly string[];
  readonly activePlayerIndex: number;
  readonly activePlayerId: string;
  readonly turnNumber: number;
  readonly roundNumber: number;
  readonly self: RiskSanitizedPlayerState;
  readonly players: Readonly<Record<string, RiskSanitizedPlayerState>>;
  readonly territories: Readonly<Record<RiskTerritoryId, RiskTerritoryState>>;
  readonly capitalOwnerByTerritory: Readonly<Record<string, string>>;
  readonly deckCount: number;
  readonly discardCount: number;
  readonly setsTradedCount: number;
  readonly nextEscalatingSetValue: number;
  readonly conqueredTerritoryThisTurn: boolean;
  readonly pendingDefense: RiskPendingDefense | null;
  readonly pendingConquest: RiskPendingConquest | null;
  readonly lastCombat: RiskCombatSummary | null;
  readonly winnerId: string | null;
  readonly victoryReason: string | null;
  readonly actionLog: readonly string[];
}

export type RiskAction =
  | {
      readonly type: 'RISK_CLAIM_TERRITORY';
      readonly territoryId: RiskTerritoryId;
    }
  | {
      readonly type: 'RISK_PLACE_INITIAL_ARMY';
      readonly territoryId: RiskTerritoryId;
    }
  | {
      readonly type: 'RISK_AUTO_FINISH_SETUP';
    }
  | {
      readonly type: 'RISK_CHOOSE_CAPITAL';
      readonly territoryId: RiskTerritoryId;
    }
  | {
      readonly type: 'RISK_TRADE_CARDS';
      readonly cardIds: readonly [string, string, string];
      readonly bonusTerritoryId?: RiskTerritoryId;
    }
  | {
      readonly type: 'RISK_PLACE_REINFORCEMENTS';
      readonly territoryId: RiskTerritoryId;
      readonly count: number;
    }
  | {
      readonly type: 'RISK_DECLARE_ATTACK';
      readonly fromTerritoryId: RiskTerritoryId;
      readonly toTerritoryId: RiskTerritoryId;
      readonly mode: 'MANUAL' | 'AUTO';
      readonly attackerDice?: 1 | 2 | 3;
      readonly minArmiesToKeep?: number;
    }
  | {
      readonly type: 'RISK_DEFEND_ROLL';
      readonly defenderDice: 1 | 2;
    }
  | {
      readonly type: 'RISK_SET_DEFENSE_MODE';
      readonly autoDefend: boolean;
    }
  | {
      readonly type: 'RISK_MOVE_AFTER_CONQUEST';
      readonly armies: number;
    }
  | {
      readonly type: 'RISK_END_ATTACKS';
    }
  | {
      readonly type: 'RISK_FORTIFY';
      readonly fromTerritoryId: RiskTerritoryId;
      readonly toTerritoryId: RiskTerritoryId;
      readonly armies: number;
    }
  | {
      readonly type: 'RISK_END_TURN';
    };
