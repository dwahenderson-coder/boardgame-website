import { PRNGState } from '../../common/prng.js';

export type PowerGridResource = 'COAL' | 'OIL' | 'GARBAGE' | 'URANIUM';

export type PowerPlantType =
  | 'COAL'
  | 'OIL'
  | 'HYBRID'
  | 'GARBAGE'
  | 'URANIUM'
  | 'ECOLOGICAL'
  | 'STEP_3';

export type PowerGridStep = 'STEP_1' | 'STEP_2' | 'STEP_3';

export enum PowerGridPhase {
  PHASE_1_DETERMINE_TURN_ORDER = 'PHASE_1_DETERMINE_TURN_ORDER',
  PHASE_2_AUCTION_POWER_PLANTS = 'PHASE_2_AUCTION_POWER_PLANTS',
  PHASE_3_BUY_RESOURCES = 'PHASE_3_BUY_RESOURCES',
  PHASE_4_BUILD_CITIES = 'PHASE_4_BUILD_CITIES',
  PHASE_5_BUREAUCRACY = 'PHASE_5_BUREAUCRACY',
  GAME_OVER = 'GAME_OVER',
}

export interface PowerPlantCard {
  readonly id: number; // Plant number (minimum bid), or 99 for STEP_3 card
  readonly resourceType: PowerPlantType;
  readonly intakeCost: number; // Amount of fuel burned to power cities
  readonly citiesPowered: number; // Number of cities this plant can power
}

export interface OwnedPowerPlant {
  readonly card: PowerPlantCard;
  readonly storedResources: Readonly<Record<PowerGridResource, number>>;
}

export interface CityNodeDefinition {
  readonly id: string;
  readonly name: string;
  readonly regionId: string;
}

export interface CityEdgeDefinition {
  readonly from: string;
  readonly to: string;
  readonly cost: number; // Pipe connection cost ($0 to $44+)
}

export interface PowerGridMapDefinition {
  readonly id: 'USA' | 'GERMANY';
  readonly name: string;
  readonly regions: readonly string[];
  readonly regionAdjacency: Readonly<Record<string, readonly string[]>>;
  readonly cities: readonly CityNodeDefinition[];
  readonly connections: readonly CityEdgeDefinition[];
}

export interface CityOccupancyState {
  readonly cityId: string;
  readonly regionId: string;
  readonly owners: readonly string[]; // Up to 3 playerIds in slot order (Slot 1 = $10, Slot 2 = $15, Slot 3 = $20)
}

export interface ResourceMarketState {
  readonlyCOAL?: never;
  readonly inventory: Readonly<Record<PowerGridResource, number>>;
  readonly totalSupplyPool: Readonly<Record<PowerGridResource, number>>;
}

export interface PlayerCountConfig {
  readonly playerCount: number;
  readonly activeRegionsCount: number;
  readonly randomlyRemovedDarkCards: number;
  readonly randomlyRemovedLightCards: number;
  readonly maxPlantsPerPlayer: number;
  readonly step2TriggerCities: number;
  readonly gameEndTriggerCities: number;
}

export interface AuctionSubState {
  /** Which player in turnOrder is currently deciding whether to open an auction or pass */
  readonly auctionTurnIndex: number;
  /** Players who have already bought a plant or passed out of the entire auction phase this round */
  readonly completedAuctionPlayerIds: readonly string[];
  /** Currently active plant on the auction block (null when awaiting an opening bid) */
  readonly activePlant: PowerPlantCard | null;
  readonly currentBid: number;
  readonly highBidderId: string | null;
  /** Players eligible to bid in the current plant's auction (in clockwise order) */
  readonly eligibleBidders: readonly string[];
  /** Index into eligibleBidders for whose turn it is to raise or pass on activePlant */
  readonly currentBidderIndex: number;
  /** Whether at least one plant has been purchased in Phase 2 this round */
  readonly anyPlantPurchasedThisRound: boolean;
  /** If a winning bidder exceeds maxPlantsPerPlayer, they must discard one owned plant before continuing */
  readonly pendingPlantDiscard: {
    readonly playerId: string;
    readonly newlyWonPlant: PowerPlantCard;
  } | null;
}

export interface PowerGridPlayerState {
  readonly id: string;
  readonly money: number; // Elektro
  readonly cities: readonly string[]; // Claimed city IDs
  readonly powerPlants: readonly OwnedPowerPlant[];
  readonly lastPoweredCities: number;
}

export interface SanitizedPowerGridPlayerState {
  readonly id: string;
  readonly money: number | null; // Hidden (null) for opponents when hideMoney option is enabled
  readonly cities: readonly string[];
  readonly cityCount: number;
  readonly powerPlants: readonly OwnedPowerPlant[];
  readonly highestPlantNumber: number;
  readonly lastPoweredCities: number;
}

export interface PowerGridInitOptions {
  readonly mapId?: 'USA' | 'GERMANY';
  readonly mapRegionKeys?: readonly string[];
  readonly hideMoney?: boolean;
  /** Optional classic vs recharged setup flag */
  readonly ruleset?: 'CLASSIC' | 'RECHARGED';
}

export interface PowerGridGameState {
  readonly gameId: 'power_grid';
  readonly mapId: 'USA' | 'GERMANY';
  readonly activeRegions: readonly string[];
  readonly ruleset: 'CLASSIC' | 'RECHARGED';
  readonly hideMoney: boolean;
  readonly turnNumber: number;
  readonly roundNumber: number;
  readonly step: PowerGridStep;
  readonly phase: PowerGridPhase;
  /** Forward turn order (1st = most cities / highest plant) */
  readonly turnOrder: readonly string[];
  /** Alias for turnOrder for compatibility with generic platform runners */
  readonly playerOrder: readonly string[];
  /** Active actor index into the current phase's action order */
  readonly activePlayerIndex: number;
  /** Tracks whether we have re-determined turn order after Round 1's first auction */
  readonly firstRoundOrderRecomputed: boolean;
  readonly auction: AuctionSubState | null;
  readonly actualMarket: readonly PowerPlantCard[];
  readonly futureMarket: readonly PowerPlantCard[];
  readonly drawDeck: readonly PowerPlantCard[];
  readonly step3TriggeredDuringPhase: boolean;
  readonly endGameTriggered: boolean;
  readonly resourceMarket: ResourceMarketState;
  readonly cityBoard: Readonly<Record<string, CityOccupancyState>>;
  readonly players: Readonly<Record<string, PowerGridPlayerState>>;
  readonly bureaucracyCompletedIds: readonly string[];
  readonly winnerId: string | null;
  readonly finalStandings: ReadonlyArray<{
    readonly playerId: string;
    readonly citiesPowered: number;
    readonly money: number;
    readonly totalCities: number;
  }> | null;
  readonly prng: PRNGState;
  readonly lastActionSummary: string | null;
}

export interface SanitizedPowerGridState {
  readonly gameId: 'power_grid';
  readonly mapId: 'USA' | 'GERMANY';
  readonly activeRegions: readonly string[];
  readonly turnNumber: number;
  readonly roundNumber: number;
  readonly step: PowerGridStep;
  readonly phase: PowerGridPhase;
  readonly turnOrder: readonly string[];
  readonly playerOrder: readonly string[];
  readonly activePlayerId: string;
  readonly auction: AuctionSubState | null;
  readonly actualMarket: readonly PowerPlantCard[];
  readonly futureMarket: readonly PowerPlantCard[];
  readonly drawDeckCount: number;
  readonly endGameTriggered: boolean;
  readonly resourceMarket: ResourceMarketState;
  readonly cityBoard: Readonly<Record<string, CityOccupancyState>>;
  readonly self: SanitizedPowerGridPlayerState;
  readonly opponents: Readonly<Record<string, SanitizedPowerGridPlayerState>>;
  readonly winnerId: string | null;
  readonly finalStandings: PowerGridGameState['finalStandings'];
  readonly lastActionSummary: string | null;
}

export interface FuelBurnAllocation {
  readonly plantId: number;
  readonly resourcesSpent: Partial<Record<PowerGridResource, number>>;
}

export type PowerGridAction =
  | {
      readonly type: 'PG_DETERMINE_TURN_ORDER';
    }
  | {
      readonly type: 'PG_OPEN_AUCTION';
      readonly plantId: number;
      readonly bid: number;
    }
  | {
      readonly type: 'PG_PASS_AUCTION_PHASE';
    }
  | {
      readonly type: 'PG_RAISE_BID';
      readonly bid: number;
    }
  | {
      readonly type: 'PG_PASS_CURRENT_BID';
    }
  | {
      readonly type: 'PG_DISCARD_PLANT';
      readonly discardPlantId: number;
      /** Optional fuel transfers from discarded plant to remaining plants */
      readonly transferResources?: ReadonlyArray<{
        readonly toPlantId: number;
        readonly resource: PowerGridResource;
        readonly amount: number;
      }>;
    }
  | {
      readonly type: 'PG_BUY_RESOURCES';
      readonly purchases: ReadonlyArray<{
        readonly plantId: number;
        readonly resource: PowerGridResource;
        readonly quantity: number;
      }>;
    }
  | {
      readonly type: 'PG_FINISH_BUYING_RESOURCES';
    }
  | {
      readonly type: 'PG_BUILD_CITY';
      readonly cityId: string;
    }
  | {
      readonly type: 'PG_FINISH_BUILDING_CITIES';
    }
  | {
      readonly type: 'PG_POWER_CITIES';
      readonly allocations: readonly FuelBurnAllocation[];
    };
