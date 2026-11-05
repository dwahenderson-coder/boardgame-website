import {
  PlayerCountConfig,
  PowerGridMapDefinition,
  PowerGridResource,
  PowerGridStep,
  PowerPlantCard,
} from './types.js';

export const STARTING_ELEKTRO = 50;
export const STEP_3_CARD_ID = 99;

export const CITY_SLOT_COSTS: readonly [number, number, number] = [10, 15, 20];

export const ALL_POWER_GRID_RESOURCES: readonly PowerGridResource[] = [
  'COAL',
  'OIL',
  'GARBAGE',
  'URANIUM',
] as const;

/**
 * Total physical resource tokens in the game box.
 */
export const TOTAL_RESOURCE_SUPPLY: Readonly<Record<PowerGridResource, number>> = {
  COAL: 24,
  OIL: 24,
  GARBAGE: 24,
  URANIUM: 12,
};

/**
 * Initial Resource Market starting quantities:
 * - Coal: 24 (Spaces $1–$8 full, 3 per space)
 * - Oil: 18 (Spaces $3–$8 full, 3 per space)
 * - Garbage: 6 (Spaces $7–$8 full, 3 per space; or $6–$8 in Recharged)
 * - Uranium: 2 (Spaces $14 and $16, or $7 and $8 on the 1–8 ladder)
 */
export const INITIAL_MARKET_INVENTORY: Readonly<Record<PowerGridResource, number>> = {
  COAL: 24,
  OIL: 18,
  GARBAGE: 6,
  URANIUM: 2,
};

/**
 * Slot-cost ladders ordered from cheapest slot to most expensive slot.
 * When `k` resources are in the market, they occupy the LAST `k` slots (highest-priced end down).
 * Coal, Oil, and Garbage have 3 sub-spaces per dollar from $1 to $8 (24 spaces).
 * Uranium has 1 sub-space per dollar from $1 to $8 (plus extended scarcity spaces up to 12 tokens).
 */
export const RESOURCE_PRICE_SLOTS: Readonly<Record<PowerGridResource, readonly number[]>> = {
  COAL: [
    1, 1, 1,
    2, 2, 2,
    3, 3, 3,
    4, 4, 4,
    5, 5, 5,
    6, 6, 6,
    7, 7, 7,
    8, 8, 8,
  ],
  OIL: [
    1, 1, 1,
    2, 2, 2,
    3, 3, 3,
    4, 4, 4,
    5, 5, 5,
    6, 6, 6,
    7, 7, 7,
    8, 8, 8,
  ],
  GARBAGE: [
    1, 1, 1,
    2, 2, 2,
    3, 3, 3,
    4, 4, 4,
    5, 5, 5,
    6, 6, 6,
    7, 7, 7,
    8, 8, 8,
  ],
  URANIUM: [1, 2, 3, 4, 5, 6, 7, 8, 10, 12, 14, 16],
};

/**
 * Player count scaling configuration (2 to 6 players).
 */
export const PLAYER_COUNT_CONFIGS: Readonly<Record<number, PlayerCountConfig>> = {
  2: {
    playerCount: 2,
    activeRegionsCount: 3,
    randomlyRemovedDarkCards: 1,
    randomlyRemovedLightCards: 5,
    maxPlantsPerPlayer: 4,
    step2TriggerCities: 10,
    gameEndTriggerCities: 21,
  },
  3: {
    playerCount: 3,
    activeRegionsCount: 3,
    randomlyRemovedDarkCards: 2,
    randomlyRemovedLightCards: 6,
    maxPlantsPerPlayer: 3,
    step2TriggerCities: 7,
    gameEndTriggerCities: 17,
  },
  4: {
    playerCount: 4,
    activeRegionsCount: 4,
    randomlyRemovedDarkCards: 1,
    randomlyRemovedLightCards: 3,
    maxPlantsPerPlayer: 3,
    step2TriggerCities: 7,
    gameEndTriggerCities: 17,
  },
  5: {
    playerCount: 5,
    activeRegionsCount: 5,
    randomlyRemovedDarkCards: 0,
    randomlyRemovedLightCards: 0,
    maxPlantsPerPlayer: 3,
    step2TriggerCities: 7,
    gameEndTriggerCities: 15,
  },
  6: {
    playerCount: 6,
    activeRegionsCount: 5,
    randomlyRemovedDarkCards: 0,
    randomlyRemovedLightCards: 0,
    maxPlantsPerPlayer: 3,
    step2TriggerCities: 6,
    gameEndTriggerCities: 14,
  },
};

/**
 * Bureaucracy Elektro Payout Table indexed by number of cities powered (0..20+).
 */
export const BUREAUCRACY_PAYOUT_TABLE: readonly number[] = [
  10,  // 0 cities
  22,  // 1 city
  33,  // 2 cities
  44,  // 3 cities
  54,  // 4 cities
  64,  // 5 cities
  73,  // 6 cities
  82,  // 7 cities
  90,  // 8 cities
  98,  // 9 cities
  105, // 10 cities
  112, // 11 cities
  118, // 12 cities
  124, // 13 cities
  129, // 14 cities
  134, // 15 cities
  138, // 16 cities
  142, // 17 cities
  145, // 18 cities
  148, // 19 cities
  150, // 20+ cities
] as const;

export function getBureaucracyPayout(citiesPowered: number): number {
  const clamped = Math.max(0, Math.min(citiesPowered, BUREAUCRACY_PAYOUT_TABLE.length - 1));
  return BUREAUCRACY_PAYOUT_TABLE[clamped]!;
}

/**
 * Resource Replenishment Matrix by [playerCount][step][resource].
 */
export const RESOURCE_RESTOCK_TABLE: Readonly<
  Record<number, Readonly<Record<PowerGridStep, Readonly<Record<PowerGridResource, number>>>>>
> = {
  2: {
    STEP_1: { COAL: 3, OIL: 2, GARBAGE: 1, URANIUM: 1 },
    STEP_2: { COAL: 4, OIL: 2, GARBAGE: 2, URANIUM: 1 },
    STEP_3: { COAL: 3, OIL: 4, GARBAGE: 3, URANIUM: 1 },
  },
  3: {
    STEP_1: { COAL: 4, OIL: 2, GARBAGE: 1, URANIUM: 1 },
    STEP_2: { COAL: 5, OIL: 3, GARBAGE: 2, URANIUM: 1 },
    STEP_3: { COAL: 3, OIL: 4, GARBAGE: 3, URANIUM: 1 },
  },
  4: {
    STEP_1: { COAL: 5, OIL: 3, GARBAGE: 2, URANIUM: 1 },
    STEP_2: { COAL: 6, OIL: 4, GARBAGE: 3, URANIUM: 2 },
    STEP_3: { COAL: 4, OIL: 5, GARBAGE: 4, URANIUM: 2 },
  },
  5: {
    STEP_1: { COAL: 5, OIL: 4, GARBAGE: 3, URANIUM: 2 },
    STEP_2: { COAL: 7, OIL: 5, GARBAGE: 3, URANIUM: 3 },
    STEP_3: { COAL: 5, OIL: 6, GARBAGE: 5, URANIUM: 2 },
  },
  6: {
    STEP_1: { COAL: 7, OIL: 5, GARBAGE: 3, URANIUM: 2 },
    STEP_2: { COAL: 9, OIL: 6, GARBAGE: 5, URANIUM: 3 },
    STEP_3: { COAL: 6, OIL: 7, GARBAGE: 6, URANIUM: 3 },
  },
};

/**
 * Standard 42 Power Plant Cards (03 to 50) + Step 3 Card (id: 99).
 * Initial market uses 03–10; Dark-backed cards are 11–15; Light-backed cards are 16–50.
 */
export const STANDARD_POWER_PLANTS: readonly PowerPlantCard[] = [
  // Initial Market (03–10)
  { id: 3, resourceType: 'OIL', intakeCost: 2, citiesPowered: 1 },
  { id: 4, resourceType: 'COAL', intakeCost: 2, citiesPowered: 1 },
  { id: 5, resourceType: 'HYBRID', intakeCost: 2, citiesPowered: 1 },
  { id: 6, resourceType: 'GARBAGE', intakeCost: 1, citiesPowered: 1 },
  { id: 7, resourceType: 'OIL', intakeCost: 3, citiesPowered: 2 },
  { id: 8, resourceType: 'COAL', intakeCost: 3, citiesPowered: 2 },
  { id: 9, resourceType: 'OIL', intakeCost: 1, citiesPowered: 1 },
  { id: 10, resourceType: 'COAL', intakeCost: 2, citiesPowered: 2 },
  // Dark-backed cards (11–15) — one placed on top of deck in Classic/Recharged
  { id: 11, resourceType: 'URANIUM', intakeCost: 1, citiesPowered: 2 },
  { id: 12, resourceType: 'HYBRID', intakeCost: 2, citiesPowered: 2 },
  { id: 13, resourceType: 'ECOLOGICAL', intakeCost: 0, citiesPowered: 1 },
  { id: 14, resourceType: 'GARBAGE', intakeCost: 2, citiesPowered: 2 },
  { id: 15, resourceType: 'COAL', intakeCost: 2, citiesPowered: 3 },
  // Light-backed deck (16–50)
  { id: 16, resourceType: 'OIL', intakeCost: 2, citiesPowered: 3 },
  { id: 17, resourceType: 'URANIUM', intakeCost: 1, citiesPowered: 2 },
  { id: 18, resourceType: 'ECOLOGICAL', intakeCost: 0, citiesPowered: 2 },
  { id: 19, resourceType: 'GARBAGE', intakeCost: 2, citiesPowered: 3 },
  { id: 20, resourceType: 'COAL', intakeCost: 3, citiesPowered: 5 },
  { id: 21, resourceType: 'HYBRID', intakeCost: 2, citiesPowered: 4 },
  { id: 22, resourceType: 'ECOLOGICAL', intakeCost: 0, citiesPowered: 2 },
  { id: 23, resourceType: 'URANIUM', intakeCost: 1, citiesPowered: 3 },
  { id: 24, resourceType: 'GARBAGE', intakeCost: 2, citiesPowered: 4 },
  { id: 25, resourceType: 'COAL', intakeCost: 2, citiesPowered: 5 },
  { id: 26, resourceType: 'OIL', intakeCost: 2, citiesPowered: 5 },
  { id: 27, resourceType: 'ECOLOGICAL', intakeCost: 0, citiesPowered: 3 },
  { id: 28, resourceType: 'URANIUM', intakeCost: 1, citiesPowered: 4 },
  { id: 29, resourceType: 'HYBRID', intakeCost: 1, citiesPowered: 4 },
  { id: 30, resourceType: 'GARBAGE', intakeCost: 3, citiesPowered: 6 },
  { id: 31, resourceType: 'COAL', intakeCost: 3, citiesPowered: 6 },
  { id: 32, resourceType: 'OIL', intakeCost: 3, citiesPowered: 6 },
  { id: 33, resourceType: 'ECOLOGICAL', intakeCost: 0, citiesPowered: 4 },
  { id: 34, resourceType: 'URANIUM', intakeCost: 1, citiesPowered: 5 },
  { id: 35, resourceType: 'OIL', intakeCost: 1, citiesPowered: 5 },
  { id: 36, resourceType: 'COAL', intakeCost: 3, citiesPowered: 7 },
  { id: 37, resourceType: 'ECOLOGICAL', intakeCost: 0, citiesPowered: 4 },
  { id: 38, resourceType: 'GARBAGE', intakeCost: 3, citiesPowered: 7 },
  { id: 39, resourceType: 'URANIUM', intakeCost: 1, citiesPowered: 6 },
  { id: 40, resourceType: 'OIL', intakeCost: 2, citiesPowered: 6 },
  { id: 42, resourceType: 'COAL', intakeCost: 2, citiesPowered: 6 },
  { id: 44, resourceType: 'ECOLOGICAL', intakeCost: 0, citiesPowered: 5 },
  { id: 46, resourceType: 'HYBRID', intakeCost: 3, citiesPowered: 7 },
  { id: 50, resourceType: 'ECOLOGICAL', intakeCost: 0, citiesPowered: 6 },
] as const;

export const STEP_3_CARD: PowerPlantCard = {
  id: STEP_3_CARD_ID,
  resourceType: 'STEP_3',
  intakeCost: 0,
  citiesPowered: 0,
};

/**
 * USA Base Map Definition (6 Regions: NORTHWEST, SOUTHWEST, MIDWEST, SOUTH_CENTRAL, NORTHEAST, SOUTHEAST).
 * 7 Cities per region (42 total) with authentic pipe connection costs.
 */
export const USA_MAP: PowerGridMapDefinition = {
  id: 'USA',
  name: 'United States',
  regions: [
    'NORTHWEST',
    'SOUTHWEST',
    'MIDWEST',
    'SOUTH_CENTRAL',
    'NORTHEAST',
    'SOUTHEAST',
  ],
  regionAdjacency: {
    NORTHWEST: ['SOUTHWEST', 'MIDWEST', 'SOUTH_CENTRAL'],
    SOUTHWEST: ['NORTHWEST', 'SOUTH_CENTRAL'],
    MIDWEST: ['NORTHWEST', 'SOUTH_CENTRAL', 'NORTHEAST', 'SOUTHEAST'],
    SOUTH_CENTRAL: ['NORTHWEST', 'SOUTHWEST', 'MIDWEST', 'SOUTHEAST'],
    NORTHEAST: ['MIDWEST', 'SOUTHEAST'],
    SOUTHEAST: ['MIDWEST', 'SOUTH_CENTRAL', 'NORTHEAST'],
  },
  cities: [
    // NORTHWEST (7)
    { id: 'SEATTLE', name: 'Seattle', regionId: 'NORTHWEST' },
    { id: 'PORTLAND', name: 'Portland', regionId: 'NORTHWEST' },
    { id: 'BOISE', name: 'Boise', regionId: 'NORTHWEST' },
    { id: 'BILLINGS', name: 'Billings', regionId: 'NORTHWEST' },
    { id: 'CHEYENNE', name: 'Cheyenne', regionId: 'NORTHWEST' },
    { id: 'DENVER', name: 'Denver', regionId: 'NORTHWEST' },
    { id: 'OMAHA', name: 'Omaha', regionId: 'NORTHWEST' },
    // SOUTHWEST (7)
    { id: 'SAN_FRANCISCO', name: 'San Francisco', regionId: 'SOUTHWEST' },
    { id: 'LOS_ANGELES', name: 'Los Angeles', regionId: 'SOUTHWEST' },
    { id: 'SAN_DIEGO', name: 'San Diego', regionId: 'SOUTHWEST' },
    { id: 'LAS_VEGAS', name: 'Las Vegas', regionId: 'SOUTHWEST' },
    { id: 'SALT_LAKE_CITY', name: 'Salt Lake City', regionId: 'SOUTHWEST' },
    { id: 'PHOENIX', name: 'Phoenix', regionId: 'SOUTHWEST' },
    { id: 'SANTA_FE', name: 'Santa Fe', regionId: 'SOUTHWEST' },
    // MIDWEST (7)
    { id: 'FARGO', name: 'Fargo', regionId: 'MIDWEST' },
    { id: 'DULUTH', name: 'Duluth', regionId: 'MIDWEST' },
    { id: 'MINNEAPOLIS', name: 'Minneapolis', regionId: 'MIDWEST' },
    { id: 'CHICAGO', name: 'Chicago', regionId: 'MIDWEST' },
    { id: 'ST_LOUIS', name: 'St. Louis', regionId: 'MIDWEST' },
    { id: 'CINCINNATI', name: 'Cincinnati', regionId: 'MIDWEST' },
    { id: 'KNOXVILLE', name: 'Knoxville', regionId: 'MIDWEST' },
    // SOUTH_CENTRAL (7)
    { id: 'KANSAS_CITY', name: 'Kansas City', regionId: 'SOUTH_CENTRAL' },
    { id: 'OKLAHOMA_CITY', name: 'Oklahoma City', regionId: 'SOUTH_CENTRAL' },
    { id: 'DALLAS', name: 'Dallas', regionId: 'SOUTH_CENTRAL' },
    { id: 'HOUSTON', name: 'Houston', regionId: 'SOUTH_CENTRAL' },
    { id: 'MEMPHIS', name: 'Memphis', regionId: 'SOUTH_CENTRAL' },
    { id: 'NEW_ORLEANS', name: 'New Orleans', regionId: 'SOUTH_CENTRAL' },
    { id: 'BIRMINGHAM', name: 'Birmingham', regionId: 'SOUTH_CENTRAL' },
    // NORTHEAST (7)
    { id: 'DETROIT', name: 'Detroit', regionId: 'NORTHEAST' },
    { id: 'BUFFALO', name: 'Buffalo', regionId: 'NORTHEAST' },
    { id: 'PITTSBURGH', name: 'Pittsburgh', regionId: 'NORTHEAST' },
    { id: 'WASHINGTON', name: 'Washington', regionId: 'NORTHEAST' },
    { id: 'PHILADELPHIA', name: 'Philadelphia', regionId: 'NORTHEAST' },
    { id: 'NEW_YORK', name: 'New York', regionId: 'NORTHEAST' },
    { id: 'BOSTON', name: 'Boston', regionId: 'NORTHEAST' },
    // SOUTHEAST (7)
    { id: 'NORFOLK', name: 'Norfolk', regionId: 'SOUTHEAST' },
    { id: 'RALEIGH', name: 'Raleigh', regionId: 'SOUTHEAST' },
    { id: 'ATLANTA', name: 'Atlanta', regionId: 'SOUTHEAST' },
    { id: 'SAVANNAH', name: 'Savannah', regionId: 'SOUTHEAST' },
    { id: 'JACKSONVILLE', name: 'Jacksonville', regionId: 'SOUTHEAST' },
    { id: 'TAMPA', name: 'Tampa', regionId: 'SOUTHEAST' },
    { id: 'MIAMI', name: 'Miami', regionId: 'SOUTHEAST' },
  ],
  connections: [
    // NORTHWEST internal & cross-region
    { from: 'SEATTLE', to: 'PORTLAND', cost: 3 },
    { from: 'SEATTLE', to: 'BOISE', cost: 12 },
    { from: 'SEATTLE', to: 'BILLINGS', cost: 9 },
    { from: 'PORTLAND', to: 'BOISE', cost: 13 },
    { from: 'PORTLAND', to: 'SAN_FRANCISCO', cost: 24 },
    { from: 'BOISE', to: 'BILLINGS', cost: 12 },
    { from: 'BOISE', to: 'CHEYENNE', cost: 24 },
    { from: 'BOISE', to: 'SALT_LAKE_CITY', cost: 8 },
    { from: 'BOISE', to: 'SAN_FRANCISCO', cost: 23 },
    { from: 'BILLINGS', to: 'CHEYENNE', cost: 9 },
    { from: 'BILLINGS', to: 'FARGO', cost: 17 },
    { from: 'BILLINGS', to: 'MINNEAPOLIS', cost: 18 },
    { from: 'CHEYENNE', to: 'DENVER', cost: 0 },
    { from: 'CHEYENNE', to: 'OMAHA', cost: 14 },
    { from: 'CHEYENNE', to: 'MINNEAPOLIS', cost: 18 },
    { from: 'DENVER', to: 'SALT_LAKE_CITY', cost: 21 },
    { from: 'DENVER', to: 'SANTA_FE', cost: 13 },
    { from: 'DENVER', to: 'KANSAS_CITY', cost: 16 },
    { from: 'OMAHA', to: 'MINNEAPOLIS', cost: 8 },
    { from: 'OMAHA', to: 'CHICAGO', cost: 13 },
    { from: 'OMAHA', to: 'KANSAS_CITY', cost: 5 },
    // SOUTHWEST
    { from: 'SAN_FRANCISCO', to: 'LOS_ANGELES', cost: 9 },
    { from: 'SAN_FRANCISCO', to: 'LAS_VEGAS', cost: 14 },
    { from: 'SAN_FRANCISCO', to: 'SALT_LAKE_CITY', cost: 27 },
    { from: 'LOS_ANGELES', to: 'SAN_DIEGO', cost: 3 },
    { from: 'LOS_ANGELES', to: 'LAS_VEGAS', cost: 9 },
    { from: 'SAN_DIEGO', to: 'LAS_VEGAS', cost: 9 },
    { from: 'SAN_DIEGO', to: 'PHOENIX', cost: 14 },
    { from: 'LAS_VEGAS', to: 'SALT_LAKE_CITY', cost: 18 },
    { from: 'LAS_VEGAS', to: 'PHOENIX', cost: 15 },
    { from: 'LAS_VEGAS', to: 'SANTA_FE', cost: 27 },
    { from: 'SALT_LAKE_CITY', to: 'SANTA_FE', cost: 28 },
    { from: 'PHOENIX', to: 'SANTA_FE', cost: 18 },
    { from: 'SANTA_FE', to: 'KANSAS_CITY', cost: 16 },
    { from: 'SANTA_FE', to: 'OKLAHOMA_CITY', cost: 15 },
    { from: 'SANTA_FE', to: 'DALLAS', cost: 16 },
    { from: 'SANTA_FE', to: 'HOUSTON', cost: 21 },
    // MIDWEST
    { from: 'FARGO', to: 'DULUTH', cost: 6 },
    { from: 'FARGO', to: 'MINNEAPOLIS', cost: 6 },
    { from: 'DULUTH', to: 'MINNEAPOLIS', cost: 5 },
    { from: 'DULUTH', to: 'CHICAGO', cost: 12 },
    { from: 'DULUTH', to: 'DETROIT', cost: 15 },
    { from: 'MINNEAPOLIS', to: 'CHICAGO', cost: 8 },
    { from: 'CHICAGO', to: 'ST_LOUIS', cost: 10 },
    { from: 'CHICAGO', to: 'CINCINNATI', cost: 7 },
    { from: 'CHICAGO', to: 'DETROIT', cost: 7 },
    { from: 'ST_LOUIS', to: 'KANSAS_CITY', cost: 6 },
    { from: 'ST_LOUIS', to: 'MEMPHIS', cost: 7 },
    { from: 'ST_LOUIS', to: 'CINCINNATI', cost: 12 },
    { from: 'ST_LOUIS', to: 'ATLANTA', cost: 12 },
    { from: 'CINCINNATI', to: 'KNOXVILLE', cost: 6 },
    { from: 'CINCINNATI', to: 'DETROIT', cost: 4 },
    { from: 'CINCINNATI', to: 'PITTSBURGH', cost: 7 },
    { from: 'CINCINNATI', to: 'RALEIGH', cost: 15 },
    { from: 'KNOXVILLE', to: 'ATLANTA', cost: 5 },
    // SOUTH_CENTRAL
    { from: 'KANSAS_CITY', to: 'OKLAHOMA_CITY', cost: 8 },
    { from: 'KANSAS_CITY', to: 'MEMPHIS', cost: 12 },
    { from: 'OKLAHOMA_CITY', to: 'DALLAS', cost: 3 },
    { from: 'OKLAHOMA_CITY', to: 'MEMPHIS', cost: 14 },
    { from: 'DALLAS', to: 'HOUSTON', cost: 5 },
    { from: 'DALLAS', to: 'MEMPHIS', cost: 12 },
    { from: 'DALLAS', to: 'NEW_ORLEANS', cost: 12 },
    { from: 'HOUSTON', to: 'NEW_ORLEANS', cost: 8 },
    { from: 'MEMPHIS', to: 'NEW_ORLEANS', cost: 7 },
    { from: 'MEMPHIS', to: 'BIRMINGHAM', cost: 6 },
    { from: 'NEW_ORLEANS', to: 'BIRMINGHAM', cost: 11 },
    { from: 'NEW_ORLEANS', to: 'JACKSONVILLE', cost: 16 },
    { from: 'BIRMINGHAM', to: 'ATLANTA', cost: 3 },
    { from: 'BIRMINGHAM', to: 'JACKSONVILLE', cost: 9 },
    // NORTHEAST
    { from: 'DETROIT', to: 'BUFFALO', cost: 7 },
    { from: 'DETROIT', to: 'PITTSBURGH', cost: 6 },
    { from: 'BUFFALO', to: 'PITTSBURGH', cost: 7 },
    { from: 'BUFFALO', to: 'NEW_YORK', cost: 8 },
    { from: 'PITTSBURGH', to: 'WASHINGTON', cost: 6 },
    { from: 'PITTSBURGH', to: 'RALEIGH', cost: 7 },
    { from: 'WASHINGTON', to: 'PHILADELPHIA', cost: 3 },
    { from: 'WASHINGTON', to: 'NORFOLK', cost: 5 },
    { from: 'PHILADELPHIA', to: 'NEW_YORK', cost: 0 },
    { from: 'NEW_YORK', to: 'BOSTON', cost: 3 },
    // SOUTHEAST
    { from: 'NORFOLK', to: 'RALEIGH', cost: 3 },
    { from: 'RALEIGH', to: 'ATLANTA', cost: 7 },
    { from: 'RALEIGH', to: 'SAVANNAH', cost: 7 },
    { from: 'ATLANTA', to: 'SAVANNAH', cost: 7 },
    { from: 'SAVANNAH', to: 'JACKSONVILLE', cost: 0 },
    { from: 'JACKSONVILLE', to: 'TAMPA', cost: 4 },
    { from: 'TAMPA', to: 'MIAMI', cost: 4 },
  ],
};

/**
 * Germany Base Map Definition (6 Regions: NORTH, EAST, WEST, CENTER, SOUTH_WEST, SOUTH_EAST).
 */
export const GERMANY_MAP: PowerGridMapDefinition = {
  id: 'GERMANY',
  name: 'Germany',
  regions: ['NORTH', 'EAST', 'WEST', 'CENTER', 'SOUTH_WEST', 'SOUTH_EAST'],
  regionAdjacency: {
    NORTH: ['EAST', 'WEST', 'CENTER'],
    EAST: ['NORTH', 'CENTER', 'SOUTH_EAST'],
    WEST: ['NORTH', 'CENTER', 'SOUTH_WEST'],
    CENTER: ['NORTH', 'EAST', 'WEST', 'SOUTH_WEST', 'SOUTH_EAST'],
    SOUTH_WEST: ['WEST', 'CENTER', 'SOUTH_EAST'],
    SOUTH_EAST: ['EAST', 'CENTER', 'SOUTH_WEST'],
  },
  cities: [
    // NORTH (7)
    { id: 'FLENSBURG', name: 'Flensburg', regionId: 'NORTH' },
    { id: 'KIEL', name: 'Kiel', regionId: 'NORTH' },
    { id: 'HAMBURG', name: 'Hamburg', regionId: 'NORTH' },
    { id: 'CUXHAVEN', name: 'Cuxhaven', regionId: 'NORTH' },
    { id: 'BREMEN', name: 'Bremen', regionId: 'NORTH' },
    { id: 'HANNOVER', name: 'Hannover', regionId: 'NORTH' },
    { id: 'WILHELMSHAVEN', name: 'Wilhelmshaven', regionId: 'NORTH' },
    // EAST (7)
    { id: 'LUBECK', name: 'Lübeck', regionId: 'EAST' },
    { id: 'SCHWERIN', name: 'Schwerin', regionId: 'EAST' },
    { id: 'ROSTOCK', name: 'Rostock', regionId: 'EAST' },
    { id: 'TORGELOW', name: 'Torgelow', regionId: 'EAST' },
    { id: 'BERLIN', name: 'Berlin', regionId: 'EAST' },
    { id: 'MAGDEBURG', name: 'Magdeburg', regionId: 'EAST' },
    { id: 'FRANKFURT_ODER', name: 'Frankfurt (O)', regionId: 'EAST' },
    // WEST (7)
    { id: 'OSNABRUCK', name: 'Osnabrück', regionId: 'WEST' },
    { id: 'MUNSTER', name: 'Münster', regionId: 'WEST' },
    { id: 'DUISBURG', name: 'Duisburg', regionId: 'WEST' },
    { id: 'ESSEN', name: 'Essen', regionId: 'WEST' },
    { id: 'DORTMUND', name: 'Dortmund', regionId: 'WEST' },
    { id: 'DUSSELDORF', name: 'Düsseldorf', regionId: 'WEST' },
    { id: 'KOLN', name: 'Köln', regionId: 'WEST' },
    // CENTER (7)
    { id: 'KASSEL', name: 'Kassel', regionId: 'CENTER' },
    { id: 'GOTTINGEN', name: 'Göttingen', regionId: 'CENTER' },
    { id: 'ERFURT', name: 'Erfurt', regionId: 'CENTER' },
    { id: 'FULDA', name: 'Fulda', regionId: 'CENTER' },
    { id: 'HALLE', name: 'Halle', regionId: 'CENTER' },
    { id: 'LEIPZIG', name: 'Leipzig', regionId: 'CENTER' },
    { id: 'DRESDEN', name: 'Dresden', regionId: 'CENTER' },
    // SOUTH_WEST (7)
    { id: 'AACHEN', name: 'Aachen', regionId: 'SOUTH_WEST' },
    { id: 'TRIER', name: 'Trier', regionId: 'SOUTH_WEST' },
    { id: 'WIESBADEN', name: 'Wiesbaden', regionId: 'SOUTH_WEST' },
    { id: 'FRANKFURT_MAIN', name: 'Frankfurt (M)', regionId: 'SOUTH_WEST' },
    { id: 'SAARBRUCKEN', name: 'Saarbrücken', regionId: 'SOUTH_WEST' },
    { id: 'MANNHEIM', name: 'Mannheim', regionId: 'SOUTH_WEST' },
    { id: 'STUTTGART', name: 'Stuttgart', regionId: 'SOUTH_WEST' },
    // SOUTH_EAST (7)
    { id: 'WURZBURG', name: 'Würzburg', regionId: 'SOUTH_EAST' },
    { id: 'NURNBERG', name: 'Nürnberg', regionId: 'SOUTH_EAST' },
    { id: 'REGENSBURG', name: 'Regensburg', regionId: 'SOUTH_EAST' },
    { id: 'AUGSBURG', name: 'Augsburg', regionId: 'SOUTH_EAST' },
    { id: 'MUNCHEN', name: 'München', regionId: 'SOUTH_EAST' },
    { id: 'KONSTANZ', name: 'Konstanz', regionId: 'SOUTH_EAST' },
    { id: 'FREIBURG', name: 'Freiburg', regionId: 'SOUTH_EAST' },
  ],
  connections: [
    { from: 'FLENSBURG', to: 'KIEL', cost: 4 },
    { from: 'KIEL', to: 'HAMBURG', cost: 8 },
    { from: 'KIEL', to: 'LUBECK', cost: 4 },
    { from: 'HAMBURG', to: 'CUXHAVEN', cost: 11 },
    { from: 'HAMBURG', to: 'BREMEN', cost: 11 },
    { from: 'HAMBURG', to: 'HANNOVER', cost: 17 },
    { from: 'HAMBURG', to: 'LUBECK', cost: 6 },
    { from: 'HAMBURG', to: 'SCHWERIN', cost: 8 },
    { from: 'CUXHAVEN', to: 'BREMEN', cost: 8 },
    { from: 'BREMEN', to: 'WILHELMSHAVEN', cost: 11 },
    { from: 'BREMEN', to: 'HANNOVER', cost: 10 },
    { from: 'BREMEN', to: 'OSNABRUCK', cost: 11 },
    { from: 'WILHELMSHAVEN', to: 'OSNABRUCK', cost: 14 },
    { from: 'HANNOVER', to: 'OSNABRUCK', cost: 16 },
    { from: 'HANNOVER', to: 'KASSEL', cost: 15 },
    { from: 'HANNOVER', to: 'MAGDEBURG', cost: 15 },
    { from: 'HANNOVER', to: 'SCHWERIN', cost: 19 },
    { from: 'LUBECK', to: 'SCHWERIN', cost: 6 },
    { from: 'SCHWERIN', to: 'ROSTOCK', cost: 6 },
    { from: 'SCHWERIN', to: 'BERLIN', cost: 18 },
    { from: 'SCHWERIN', to: 'MAGDEBURG', cost: 16 },
    { from: 'ROSTOCK', to: 'TORGELOW', cost: 19 },
    { from: 'TORGELOW', to: 'BERLIN', cost: 15 },
    { from: 'BERLIN', to: 'MAGDEBURG', cost: 10 },
    { from: 'BERLIN', to: 'FRANKFURT_ODER', cost: 6 },
    { from: 'BERLIN', to: 'HALLE', cost: 17 },
    { from: 'MAGDEBURG', to: 'HALLE', cost: 11 },
    { from: 'FRANKFURT_ODER', to: 'LEIPZIG', cost: 21 },
    { from: 'FRANKFURT_ODER', to: 'DRESDEN', cost: 16 },
    { from: 'OSNABRUCK', to: 'MUNSTER', cost: 7 },
    { from: 'OSNABRUCK', to: 'KASSEL', cost: 20 },
    { from: 'MUNSTER', to: 'DUISBURG', cost: 7 },
    { from: 'MUNSTER', to: 'DORTMUND', cost: 2 },
    { from: 'DUISBURG', to: 'ESSEN', cost: 0 },
    { from: 'ESSEN', to: 'DORTMUND', cost: 4 },
    { from: 'ESSEN', to: 'DUSSELDORF', cost: 2 },
    { from: 'DORTMUND', to: 'KASSEL', cost: 18 },
    { from: 'DORTMUND', to: 'FRANKFURT_MAIN', cost: 20 },
    { from: 'DUSSELDORF', to: 'KOLN', cost: 4 },
    { from: 'DUSSELDORF', to: 'AACHEN', cost: 9 },
    { from: 'KOLN', to: 'AACHEN', cost: 7 },
    { from: 'KOLN', to: 'TRIER', cost: 20 },
    { from: 'KOLN', to: 'WIESBADEN', cost: 14 },
    { from: 'KASSEL', to: 'GOTTINGEN', cost: 6 },
    { from: 'KASSEL', to: 'FULDA', cost: 8 },
    { from: 'KASSEL', to: 'FRANKFURT_MAIN', cost: 13 },
    { from: 'GOTTINGEN', to: 'ERFURT', cost: 15 },
    { from: 'ERFURT', to: 'FULDA', cost: 13 },
    { from: 'ERFURT', to: 'HALLE', cost: 6 },
    { from: 'ERFURT', to: 'NURNBERG', cost: 21 },
    { from: 'FULDA', to: 'FRANKFURT_MAIN', cost: 8 },
    { from: 'FULDA', to: 'WURZBURG', cost: 11 },
    { from: 'HALLE', to: 'LEIPZIG', cost: 0 },
    { from: 'LEIPZIG', to: 'DRESDEN', cost: 13 },
    { from: 'AACHEN', to: 'TRIER', cost: 19 },
    { from: 'TRIER', to: 'WIESBADEN', cost: 18 },
    { from: 'TRIER', to: 'SAARBRUCKEN', cost: 11 },
    { from: 'WIESBADEN', to: 'FRANKFURT_MAIN', cost: 0 },
    { from: 'WIESBADEN', to: 'SAARBRUCKEN', cost: 10 },
    { from: 'WIESBADEN', to: 'MANNHEIM', cost: 11 },
    { from: 'FRANKFURT_MAIN', to: 'MANNHEIM', cost: 11 },
    { from: 'FRANKFURT_MAIN', to: 'WURZBURG', cost: 13 },
    { from: 'SAARBRUCKEN', to: 'MANNHEIM', cost: 11 },
    { from: 'SAARBRUCKEN', to: 'STUTTGART', cost: 17 },
    { from: 'SAARBRUCKEN', to: 'FREIBURG', cost: 18 },
    { from: 'MANNHEIM', to: 'STUTTGART', cost: 6 },
    { from: 'MANNHEIM', to: 'WURZBURG', cost: 10 },
    { from: 'STUTTGART', to: 'WURZBURG', cost: 12 },
    { from: 'STUTTGART', to: 'AUGSBURG', cost: 15 },
    { from: 'STUTTGART', to: 'KONSTANZ', cost: 16 },
    { from: 'STUTTGART', to: 'FREIBURG', cost: 16 },
    { from: 'WURZBURG', to: 'NURNBERG', cost: 8 },
    { from: 'NURNBERG', to: 'REGENSBURG', cost: 12 },
    { from: 'NURNBERG', to: 'AUGSBURG', cost: 18 },
    { from: 'REGENSBURG', to: 'MUNCHEN', cost: 10 },
    { from: 'AUGSBURG', to: 'MUNCHEN', cost: 6 },
    { from: 'AUGSBURG', to: 'KONSTANZ', cost: 17 },
    { from: 'KONSTANZ', to: 'FREIBURG', cost: 14 },
  ],
};

export const POWER_GRID_MAPS: Readonly<Record<'USA' | 'GERMANY', PowerGridMapDefinition>> = {
  USA: USA_MAP,
  GERMANY: GERMANY_MAP,
};

