import {
  DestinationTicket,
  HandCounts,
  RouteEdge,
  TrainCardColor,
} from './types.js';

export const ALL_TRAIN_CARD_COLORS: readonly TrainCardColor[] = [
  'RED',
  'BLUE',
  'GREEN',
  'YELLOW',
  'BLACK',
  'WHITE',
  'ORANGE',
  'PINK',
  'LOCOMOTIVE',
] as const;

export const NON_LOCOMOTIVE_COLORS: readonly Exclude<
  TrainCardColor,
  'LOCOMOTIVE'
>[] = [
  'RED',
  'BLUE',
  'GREEN',
  'YELLOW',
  'BLACK',
  'WHITE',
  'ORANGE',
  'PINK',
] as const;

export const INITIAL_TRAINS_PER_PLAYER = 45;
export const INITIAL_STATIONS_PER_PLAYER = 3;
export const UNUSED_STATION_POINTS = 4;
export const INITIAL_HAND_SIZE = 4;
export const INITIAL_TICKETS_DEALT = 3;
export const INITIAL_MIN_TICKETS_TO_KEEP = 2;
export const TURN_TICKETS_DEALT = 3;
export const TURN_MIN_TICKETS_TO_KEEP = 1;
export const FACE_UP_SLOTS = 5;

export const ROUTE_SCORE_TABLE: Readonly<Record<number, number>> = {
  1: 1,
  2: 2,
  3: 4,
  4: 7,
  5: 10,
  6: 15,
  8: 21,
};

export function createEmptyHand(): HandCounts {
  return {
    RED: 0,
    BLUE: 0,
    GREEN: 0,
    YELLOW: 0,
    BLACK: 0,
    WHITE: 0,
    ORANGE: 0,
    PINK: 0,
    LOCOMOTIVE: 0,
  };
}

/**
 * Generates the standard 110-card Ticket to Ride Train Deck:
 * 12 of each of the 8 regular colors (96) + 14 Locomotives = 110 cards.
 */
export function createStandardTrainDeckCards(): TrainCardColor[] {
  const cards: TrainCardColor[] = [];
  for (const color of NON_LOCOMOTIVE_COLORS) {
    for (let i = 0; i < 12; i++) {
      cards.push(color);
    }
  }
  for (let i = 0; i < 14; i++) {
    cards.push('LOCOMOTIVE');
  }
  return cards;
}

/**
 * Standard North America Destination Tickets (subset & representative core set).
 */
export const STANDARD_DESTINATION_TICKETS: readonly DestinationTicket[] = [
  { id: 'TKT_VAN_MTL', from: 'Vancouver', to: 'Montreal', points: 20 },
  { id: 'TKT_SEA_NY', from: 'Seattle', to: 'New York', points: 22 },
  { id: 'TKT_LA_NY', from: 'Los Angeles', to: 'New York', points: 21 },
  { id: 'TKT_LA_MIA', from: 'Los Angeles', to: 'Miami', points: 20 },
  { id: 'TKT_SF_ATL', from: 'San Francisco', to: 'Atlanta', points: 17 },
  { id: 'TKT_PDX_NSH', from: 'Portland', to: 'Nashville', points: 17 },
  { id: 'TKT_VAN_SFE', from: 'Vancouver', to: 'Santa Fe', points: 13 },
  { id: 'TKT_CAL_PHX', from: 'Calgary', to: 'Phoenix', points: 13 },
  { id: 'TKT_LA_CHI', from: 'Los Angeles', to: 'Chicago', points: 16 },
  { id: 'TKT_DEN_PIT', from: 'Denver', to: 'Pittsburgh', points: 11 },
  { id: 'TKT_CHI_LA', from: 'Chicago', to: 'New Orleans', points: 7 },
  { id: 'TKT_DEN_ELP', from: 'Denver', to: 'El Paso', points: 4 },
  { id: 'TKT_KC_HOU', from: 'Kansas City', to: 'Houston', points: 5 },
  { id: 'TKT_NY_ATL', from: 'New York', to: 'Atlanta', points: 6 },
  { id: 'TKT_BOS_MIA', from: 'Boston', to: 'Miami', points: 12 },
  { id: 'TKT_MTL_NO', from: 'Montreal', to: 'New Orleans', points: 13 },
  { id: 'TKT_SEA_LA', from: 'Seattle', to: 'Los Angeles', points: 9 },
  { id: 'TKT_HEL_LA', from: 'Helena', to: 'Los Angeles', points: 8 },
  { id: 'TKT_DUL_HOU', from: 'Duluth', to: 'Houston', points: 8 },
  { id: 'TKT_WIN_HOU', from: 'Winnipeg', to: 'Houston', points: 12 },
  { id: 'TKT_SSM_NSH', from: 'Sault St Marie', to: 'Nashville', points: 8 },
  { id: 'TKT_SSM_OKC', from: 'Sault St Marie', to: 'Oklahoma City', points: 9 },
  { id: 'TKT_TOR_MIA', from: 'Toronto', to: 'Miami', points: 10 },
  { id: 'TKT_WIN_LR', from: 'Winnipeg', to: 'Little Rock', points: 11 },
  { id: 'TKT_MTL_ATL', from: 'Montreal', to: 'Atlanta', points: 9 },
  { id: 'TKT_CAL_SLC', from: 'Calgary', to: 'Salt Lake City', points: 7 },
  { id: 'TKT_PDX_PHX', from: 'Portland', to: 'Phoenix', points: 11 },
  { id: 'TKT_DUL_ELP', from: 'Duluth', to: 'El Paso', points: 10 },
  { id: 'TKT_CHI_SFE', from: 'Chicago', to: 'Santa Fe', points: 9 },
  { id: 'TKT_DAL_NY', from: 'Dallas', to: 'New York', points: 11 },
];

/**
 * Standard North America Board Routes.
 */
export const STANDARD_BOARD_ROUTES: readonly RouteEdge[] = [
  { id: 'R_VAN_SEA_1', from: 'Vancouver', to: 'Seattle', length: 1, color: 'GRAY', ownerId: null, routeIndex: 0 },
  { id: 'R_VAN_SEA_2', from: 'Vancouver', to: 'Seattle', length: 1, color: 'GRAY', ownerId: null, routeIndex: 1 },
  { id: 'R_SEA_PDX_1', from: 'Seattle', to: 'Portland', length: 1, color: 'GRAY', ownerId: null, routeIndex: 0 },
  { id: 'R_SEA_PDX_2', from: 'Seattle', to: 'Portland', length: 1, color: 'GRAY', ownerId: null, routeIndex: 1 },
  { id: 'R_PDX_SF_1', from: 'Portland', to: 'San Francisco', length: 5, color: 'GREEN', ownerId: null, routeIndex: 0 },
  { id: 'R_PDX_SF_2', from: 'Portland', to: 'San Francisco', length: 5, color: 'PINK', ownerId: null, routeIndex: 1 },
  { id: 'R_SF_LA_1', from: 'San Francisco', to: 'Los Angeles', length: 3, color: 'YELLOW', ownerId: null, routeIndex: 0 },
  { id: 'R_SF_LA_2', from: 'San Francisco', to: 'Los Angeles', length: 3, color: 'PINK', ownerId: null, routeIndex: 1 },
  { id: 'R_VAN_CAL', from: 'Vancouver', to: 'Calgary', length: 3, color: 'GRAY', ownerId: null, routeIndex: 0 },
  { id: 'R_SEA_HEL', from: 'Seattle', to: 'Helena', length: 6, color: 'YELLOW', ownerId: null, routeIndex: 0 },
  { id: 'R_CAL_HEL', from: 'Calgary', to: 'Helena', length: 4, color: 'GRAY', ownerId: null, routeIndex: 0 },
  { id: 'R_HEL_DEN', from: 'Helena', to: 'Denver', length: 4, color: 'GREEN', ownerId: null, routeIndex: 0 },
  { id: 'R_HEL_DUL', from: 'Helena', to: 'Duluth', length: 6, color: 'ORANGE', ownerId: null, routeIndex: 0 },
  { id: 'R_SF_SLC_1', from: 'San Francisco', to: 'Salt Lake City', length: 5, color: 'ORANGE', ownerId: null, routeIndex: 0 },
  { id: 'R_SF_SLC_2', from: 'San Francisco', to: 'Salt Lake City', length: 5, color: 'WHITE', ownerId: null, routeIndex: 1 },
  { id: 'R_LA_SLC', from: 'Los Angeles', to: 'Salt Lake City', length: 3, color: 'GRAY', ownerId: null, routeIndex: 0 },
  { id: 'R_LA_PHX', from: 'Los Angeles', to: 'Phoenix', length: 3, color: 'GRAY', ownerId: null, routeIndex: 0 },
  { id: 'R_LA_ELP', from: 'Los Angeles', to: 'El Paso', length: 6, color: 'BLACK', ownerId: null, routeIndex: 0 },
  { id: 'R_SLC_DEN_1', from: 'Salt Lake City', to: 'Denver', length: 3, color: 'RED', ownerId: null, routeIndex: 0 },
  { id: 'R_SLC_DEN_2', from: 'Salt Lake City', to: 'Denver', length: 3, color: 'YELLOW', ownerId: null, routeIndex: 1 },
  { id: 'R_SLC_HEL', from: 'Salt Lake City', to: 'Helena', length: 3, color: 'PINK', ownerId: null, routeIndex: 0 },
  { id: 'R_PHX_DEN', from: 'Phoenix', to: 'Denver', length: 5, color: 'WHITE', ownerId: null, routeIndex: 0 },
  { id: 'R_PHX_SFE', from: 'Phoenix', to: 'Santa Fe', length: 3, color: 'GRAY', ownerId: null, routeIndex: 0 },
  { id: 'R_PHX_ELP', from: 'Phoenix', to: 'El Paso', length: 3, color: 'GRAY', ownerId: null, routeIndex: 0 },
  { id: 'R_DEN_SFE', from: 'Denver', to: 'Santa Fe', length: 2, color: 'GRAY', ownerId: null, routeIndex: 0 },
  { id: 'R_SFE_ELP', from: 'Santa Fe', to: 'El Paso', length: 2, color: 'GRAY', ownerId: null, routeIndex: 0 },
  { id: 'R_DEN_KC_1', from: 'Denver', to: 'Kansas City', length: 4, color: 'BLACK', ownerId: null, routeIndex: 0 },
  { id: 'R_DEN_KC_2', from: 'Denver', to: 'Kansas City', length: 4, color: 'ORANGE', ownerId: null, routeIndex: 1 },
  { id: 'R_KC_STL_1', from: 'Kansas City', to: 'Saint Louis', length: 2, color: 'BLUE', ownerId: null, routeIndex: 0 },
  { id: 'R_KC_STL_2', from: 'Kansas City', to: 'Saint Louis', length: 2, color: 'PINK', ownerId: null, routeIndex: 1 },
  { id: 'R_KC_OKC_1', from: 'Kansas City', to: 'Oklahoma City', length: 2, color: 'GRAY', ownerId: null, routeIndex: 0 },
  { id: 'R_KC_OKC_2', from: 'Kansas City', to: 'Oklahoma City', length: 2, color: 'GRAY', ownerId: null, routeIndex: 1 },
  { id: 'R_OKC_DAL_1', from: 'Oklahoma City', to: 'Dallas', length: 2, color: 'GRAY', ownerId: null, routeIndex: 0 },
  { id: 'R_OKC_DAL_2', from: 'Oklahoma City', to: 'Dallas', length: 2, color: 'GRAY', ownerId: null, routeIndex: 1 },
  { id: 'R_DAL_HOU_1', from: 'Dallas', to: 'Houston', length: 1, color: 'GRAY', ownerId: null, routeIndex: 0 },
  { id: 'R_DAL_HOU_2', from: 'Dallas', to: 'Houston', length: 1, color: 'GRAY', ownerId: null, routeIndex: 1 },
  { id: 'R_ELP_HOU', from: 'El Paso', to: 'Houston', length: 6, color: 'GREEN', ownerId: null, routeIndex: 0 },
  { id: 'R_HOU_NO', from: 'Houston', to: 'New Orleans', length: 2, color: 'GRAY', ownerId: null, routeIndex: 0 },
  { id: 'R_DUL_CHI', from: 'Duluth', to: 'Chicago', length: 3, color: 'RED', ownerId: null, routeIndex: 0 },
  { id: 'R_STL_CHI_1', from: 'Saint Louis', to: 'Chicago', length: 2, color: 'GREEN', ownerId: null, routeIndex: 0 },
  { id: 'R_STL_CHI_2', from: 'Saint Louis', to: 'Chicago', length: 2, color: 'WHITE', ownerId: null, routeIndex: 1 },
  { id: 'R_STL_PIT', from: 'Saint Louis', to: 'Pittsburgh', length: 5, color: 'GREEN', ownerId: null, routeIndex: 0 },
  { id: 'R_STL_NSH', from: 'Saint Louis', to: 'Nashville', length: 2, color: 'GRAY', ownerId: null, routeIndex: 0 },
  { id: 'R_CHI_PIT_1', from: 'Chicago', to: 'Pittsburgh', length: 3, color: 'ORANGE', ownerId: null, routeIndex: 0 },
  { id: 'R_CHI_PIT_2', from: 'Chicago', to: 'Pittsburgh', length: 3, color: 'BLACK', ownerId: null, routeIndex: 1 },
  { id: 'R_PIT_NY_1', from: 'Pittsburgh', to: 'New York', length: 2, color: 'WHITE', ownerId: null, routeIndex: 0 },
  { id: 'R_PIT_NY_2', from: 'Pittsburgh', to: 'New York', length: 2, color: 'GREEN', ownerId: null, routeIndex: 1 },
  { id: 'R_NY_BOS_1', from: 'New York', to: 'Boston', length: 2, color: 'YELLOW', ownerId: null, routeIndex: 0 },
  { id: 'R_NY_BOS_2', from: 'New York', to: 'Boston', length: 2, color: 'RED', ownerId: null, routeIndex: 1 },
  { id: 'R_NY_MTL', from: 'New York', to: 'Montreal', length: 3, color: 'BLUE', ownerId: null, routeIndex: 0 },
  { id: 'R_BOS_MTL_1', from: 'Boston', to: 'Montreal', length: 2, color: 'GRAY', ownerId: null, routeIndex: 0 },
  { id: 'R_BOS_MTL_2', from: 'Boston', to: 'Montreal', length: 2, color: 'GRAY', ownerId: null, routeIndex: 1 },
  { id: 'R_NSH_ATL', from: 'Nashville', to: 'Atlanta', length: 1, color: 'GRAY', ownerId: null, routeIndex: 0 },
  { id: 'R_NO_ATL_1', from: 'New Orleans', to: 'Atlanta', length: 4, color: 'YELLOW', ownerId: null, routeIndex: 0 },
  { id: 'R_NO_ATL_2', from: 'New Orleans', to: 'Atlanta', length: 4, color: 'ORANGE', ownerId: null, routeIndex: 1 },
  { id: 'R_NO_MIA', from: 'New Orleans', to: 'Miami', length: 6, color: 'RED', ownerId: null, routeIndex: 0 },
  { id: 'R_ATL_MIA', from: 'Atlanta', to: 'Miami', length: 5, color: 'BLUE', ownerId: null, routeIndex: 0 },
  { id: 'R_NY_WDC_1', from: 'New York', to: 'Washington', length: 2, color: 'ORANGE', ownerId: null, routeIndex: 0 },
  { id: 'R_NY_WDC_2', from: 'New York', to: 'Washington', length: 2, color: 'BLACK', ownerId: null, routeIndex: 1 },
  // Winnipeg connections
  { id: 'R_WIN_CAL', from: 'Winnipeg', to: 'Calgary', length: 6, color: 'WHITE', ownerId: null, routeIndex: 0 },
  { id: 'R_WIN_DUL', from: 'Winnipeg', to: 'Duluth', length: 4, color: 'BLACK', ownerId: null, routeIndex: 0 },
  { id: 'R_WIN_HEL', from: 'Winnipeg', to: 'Helena', length: 4, color: 'BLUE', ownerId: null, routeIndex: 0 },
  { id: 'R_WIN_SSM', from: 'Winnipeg', to: 'Sault St Marie', length: 6, color: 'GRAY', ownerId: null, routeIndex: 0 },
  // Sault St Marie connections
  { id: 'R_SSM_TOR', from: 'Sault St Marie', to: 'Toronto', length: 2, color: 'GRAY', ownerId: null, routeIndex: 0 },
  { id: 'R_SSM_DUL', from: 'Sault St Marie', to: 'Duluth', length: 3, color: 'GRAY', ownerId: null, routeIndex: 0 },
  { id: 'R_SSM_MTL', from: 'Sault St Marie', to: 'Montreal', length: 5, color: 'BLACK', ownerId: null, routeIndex: 0 },
  // Las Vegas connections
  { id: 'R_LV_LA', from: 'Las Vegas', to: 'Los Angeles', length: 2, color: 'GRAY', ownerId: null, routeIndex: 0 },
  { id: 'R_LV_SLC', from: 'Las Vegas', to: 'Salt Lake City', length: 3, color: 'ORANGE', ownerId: null, routeIndex: 0 },
  // Omaha connections
  { id: 'R_OMA_DUL_1', from: 'Omaha', to: 'Duluth', length: 2, color: 'GRAY', ownerId: null, routeIndex: 0 },
  { id: 'R_OMA_DUL_2', from: 'Omaha', to: 'Duluth', length: 2, color: 'GRAY', ownerId: null, routeIndex: 1 },
  { id: 'R_OMA_HEL', from: 'Omaha', to: 'Helena', length: 4, color: 'RED', ownerId: null, routeIndex: 0 },
  { id: 'R_OMA_DEN', from: 'Omaha', to: 'Denver', length: 4, color: 'PINK', ownerId: null, routeIndex: 0 },
  { id: 'R_OMA_KC_1', from: 'Omaha', to: 'Kansas City', length: 1, color: 'GRAY', ownerId: null, routeIndex: 0 },
  { id: 'R_OMA_KC_2', from: 'Omaha', to: 'Kansas City', length: 1, color: 'GRAY', ownerId: null, routeIndex: 1 },
  { id: 'R_OMA_CHI', from: 'Omaha', to: 'Chicago', length: 4, color: 'BLACK', ownerId: null, routeIndex: 0 },
  // Little Rock connections
  { id: 'R_LR_STL', from: 'Little Rock', to: 'Saint Louis', length: 2, color: 'GRAY', ownerId: null, routeIndex: 0 },
  { id: 'R_LR_OKC', from: 'Little Rock', to: 'Oklahoma City', length: 2, color: 'GRAY', ownerId: null, routeIndex: 0 },
  { id: 'R_LR_DAL', from: 'Little Rock', to: 'Dallas', length: 2, color: 'GRAY', ownerId: null, routeIndex: 0 },
  { id: 'R_LR_NO', from: 'Little Rock', to: 'New Orleans', length: 3, color: 'GREEN', ownerId: null, routeIndex: 0 },
  { id: 'R_LR_NSH', from: 'Little Rock', to: 'Nashville', length: 3, color: 'WHITE', ownerId: null, routeIndex: 0 },
  // Toronto connections
  { id: 'R_TOR_MTL', from: 'Toronto', to: 'Montreal', length: 3, color: 'GRAY', ownerId: null, routeIndex: 0 },
  { id: 'R_TOR_DUL', from: 'Toronto', to: 'Duluth', length: 6, color: 'PINK', ownerId: null, routeIndex: 0 },
  { id: 'R_TOR_CHI', from: 'Toronto', to: 'Chicago', length: 4, color: 'WHITE', ownerId: null, routeIndex: 0 },
  { id: 'R_TOR_PIT', from: 'Toronto', to: 'Pittsburgh', length: 2, color: 'GRAY', ownerId: null, routeIndex: 0 },
  // Charleston connections
  { id: 'R_CHA_ATL', from: 'Charleston', to: 'Atlanta', length: 2, color: 'GRAY', ownerId: null, routeIndex: 0 },
  { id: 'R_CHA_RAL', from: 'Charleston', to: 'Raleigh', length: 2, color: 'GRAY', ownerId: null, routeIndex: 0 },
  { id: 'R_CHA_MIA', from: 'Charleston', to: 'Miami', length: 4, color: 'PINK', ownerId: null, routeIndex: 0 },
  // Raleigh connections
  { id: 'R_RAL_ATL_1', from: 'Raleigh', to: 'Atlanta', length: 2, color: 'GRAY', ownerId: null, routeIndex: 0 },
  { id: 'R_RAL_ATL_2', from: 'Raleigh', to: 'Atlanta', length: 2, color: 'GRAY', ownerId: null, routeIndex: 1 },
  { id: 'R_RAL_WDC_1', from: 'Raleigh', to: 'Washington', length: 2, color: 'GRAY', ownerId: null, routeIndex: 0 },
  { id: 'R_RAL_WDC_2', from: 'Raleigh', to: 'Washington', length: 2, color: 'GRAY', ownerId: null, routeIndex: 1 },
  { id: 'R_RAL_PIT', from: 'Raleigh', to: 'Pittsburgh', length: 2, color: 'GRAY', ownerId: null, routeIndex: 0 },
  { id: 'R_RAL_NSH', from: 'Raleigh', to: 'Nashville', length: 3, color: 'BLACK', ownerId: null, routeIndex: 0 },
];

/**
 * Ticket to Ride: Europe — 6 Long Destination Tickets (20–21 points).
 * 1 Long Ticket is dealt to each player at the start of a Europe match alongside 3 Regular Tickets.
 */
export const EUROPE_LONG_TICKETS: readonly DestinationTicket[] = [
  { id: 'EU_LONG_LIS_DAN', from: 'Lisboa', to: 'Danzig', points: 20, isLongRoute: true },
  { id: 'EU_LONG_BRE_PET', from: 'Brest', to: 'Petrograd', points: 20, isLongRoute: true },
  { id: 'EU_LONG_PAL_MOS', from: 'Palermo', to: 'Moskva', points: 20, isLongRoute: true },
  { id: 'EU_LONG_KOB_ERZ', from: 'København', to: 'Erzurum', points: 21, isLongRoute: true },
  { id: 'EU_LONG_EDI_ATH', from: 'Edinburgh', to: 'Athina', points: 21, isLongRoute: true },
  { id: 'EU_LONG_CAD_STO', from: 'Cadiz', to: 'Stockholm', points: 21, isLongRoute: true },
];

/**
 * Ticket to Ride: Europe — 40 Regular Destination Tickets (5–13 points).
 */
export const EUROPE_REGULAR_TICKETS: readonly DestinationTicket[] = [
  { id: 'EU_TKT_ATH_ANG', from: 'Athina', to: 'Angora', points: 5 },
  { id: 'EU_TKT_BUD_SOF', from: 'Budapest', to: 'Sofia', points: 5 },
  { id: 'EU_TKT_FRA_KOB', from: 'Frankfurt', to: 'København', points: 5 },
  { id: 'EU_TKT_ROS_ERZ', from: 'Rostov', to: 'Erzurum', points: 5 },
  { id: 'EU_TKT_SOF_SMY', from: 'Sofia', to: 'Smyrna', points: 5 },
  { id: 'EU_TKT_KYI_PET', from: 'Kyiv', to: 'Petrograd', points: 6 },
  { id: 'EU_TKT_ZUR_BRI', from: 'Zürich', to: 'Brindisi', points: 6 },
  { id: 'EU_TKT_ZUR_BUD', from: 'Zürich', to: 'Budapest', points: 6 },
  { id: 'EU_TKT_WAR_SMO', from: 'Warszawa', to: 'Smolensk', points: 6 },
  { id: 'EU_TKT_ZAG_BRI', from: 'Zagreb', to: 'Brindisi', points: 6 },
  { id: 'EU_TKT_PAR_ZAG', from: 'Paris', to: 'Zagreb', points: 7 },
  { id: 'EU_TKT_BRE_MAR', from: 'Brest', to: 'Marseille', points: 7 },
  { id: 'EU_TKT_LON_BER', from: 'London', to: 'Berlin', points: 7 },
  { id: 'EU_TKT_EDI_PAR', from: 'Edinburgh', to: 'Paris', points: 7 },
  { id: 'EU_TKT_AMS_PAM', from: 'Amsterdam', to: 'Pamplona', points: 7 },
  { id: 'EU_TKT_ROM_SMY', from: 'Roma', to: 'Smyrna', points: 8 },
  { id: 'EU_TKT_PAL_CON', from: 'Palermo', to: 'Constantinople', points: 8 },
  { id: 'EU_TKT_SAR_SEV', from: 'Sarajevo', to: 'Sevastopol', points: 8 },
  { id: 'EU_TKT_MAD_DIE', from: 'Madrid', to: 'Dieppe', points: 8 },
  { id: 'EU_TKT_BAR_BRU', from: 'Barcelona', to: 'Bruxelles', points: 8 },
  { id: 'EU_TKT_PAR_WIE', from: 'Paris', to: 'Wien', points: 8 },
  { id: 'EU_TKT_BAR_MUN', from: 'Barcelona', to: 'München', points: 8 },
  { id: 'EU_TKT_BRE_VEN', from: 'Brest', to: 'Venezia', points: 8 },
  { id: 'EU_TKT_SMO_ROS', from: 'Smolensk', to: 'Rostov', points: 8 },
  { id: 'EU_TKT_MAR_ESS', from: 'Marseille', to: 'Essen', points: 8 },
  { id: 'EU_TKT_KYI_SOC', from: 'Kyiv', to: 'Sochi', points: 8 },
  { id: 'EU_TKT_MAD_ZUR', from: 'Madrid', to: 'Zürich', points: 8 },
  { id: 'EU_TKT_BER_BUC', from: 'Berlin', to: 'Bucuresti', points: 8 },
  { id: 'EU_TKT_BRU_DAN', from: 'Bruxelles', to: 'Danzig', points: 9 },
  { id: 'EU_TKT_BER_ROM', from: 'Berlin', to: 'Roma', points: 9 },
  { id: 'EU_TKT_ANG_KHA', from: 'Angora', to: 'Kharkov', points: 10 },
  { id: 'EU_TKT_RIG_BUC', from: 'Riga', to: 'Bucuresti', points: 10 },
  { id: 'EU_TKT_ESS_KYI', from: 'Essen', to: 'Kyiv', points: 10 },
  { id: 'EU_TKT_VEN_CON', from: 'Venezia', to: 'Constantinople', points: 10 },
  { id: 'EU_TKT_LON_WIE', from: 'London', to: 'Wien', points: 10 },
  { id: 'EU_TKT_ATH_WIL', from: 'Athina', to: 'Wilno', points: 11 },
  { id: 'EU_TKT_STO_WIE', from: 'Stockholm', to: 'Wien', points: 11 },
  { id: 'EU_TKT_BER_MOS', from: 'Berlin', to: 'Moskva', points: 12 },
  { id: 'EU_TKT_AMS_WIL', from: 'Amsterdam', to: 'Wilno', points: 12 },
  { id: 'EU_TKT_FRA_SMO', from: 'Frankfurt', to: 'Smolensk', points: 13 },
];

/**
 * Ticket to Ride: Europe — Official Board Routes across all 47 European cities
 * (including Ferries with `ferryLocomotives` and Mountain Tunnels with `isTunnel`).
 */
export const EUROPE_BOARD_ROUTES: readonly RouteEdge[] = [
  // British Isles & Channel Ferries
  { id: 'EU_EDI_LON_1', from: 'Edinburgh', to: 'London', length: 4, color: 'BLACK', ownerId: null, routeIndex: 0 },
  { id: 'EU_EDI_LON_2', from: 'Edinburgh', to: 'London', length: 4, color: 'ORANGE', ownerId: null, routeIndex: 1 },
  { id: 'EU_LON_AMS', from: 'London', to: 'Amsterdam', length: 2, color: 'GRAY', ownerId: null, routeIndex: 0, ferryLocomotives: 2 },
  { id: 'EU_LON_DIE_1', from: 'London', to: 'Dieppe', length: 2, color: 'GRAY', ownerId: null, routeIndex: 0, ferryLocomotives: 1 },
  { id: 'EU_LON_DIE_2', from: 'London', to: 'Dieppe', length: 2, color: 'GRAY', ownerId: null, routeIndex: 1, ferryLocomotives: 1 },

  // Iberia & France
  { id: 'EU_LIS_MAD', from: 'Lisboa', to: 'Madrid', length: 3, color: 'PINK', ownerId: null, routeIndex: 0 },
  { id: 'EU_LIS_CAD', from: 'Lisboa', to: 'Cadiz', length: 2, color: 'BLUE', ownerId: null, routeIndex: 0 },
  { id: 'EU_CAD_MAD', from: 'Cadiz', to: 'Madrid', length: 3, color: 'ORANGE', ownerId: null, routeIndex: 0 },
  { id: 'EU_MAD_BAR', from: 'Madrid', to: 'Barcelona', length: 2, color: 'YELLOW', ownerId: null, routeIndex: 0 },
  { id: 'EU_MAD_PAM_1', from: 'Madrid', to: 'Pamplona', length: 3, color: 'BLACK', ownerId: null, routeIndex: 0, isTunnel: true },
  { id: 'EU_MAD_PAM_2', from: 'Madrid', to: 'Pamplona', length: 3, color: 'WHITE', ownerId: null, routeIndex: 1, isTunnel: true },
  { id: 'EU_BAR_PAM', from: 'Barcelona', to: 'Pamplona', length: 2, color: 'GRAY', ownerId: null, routeIndex: 0, isTunnel: true },
  { id: 'EU_BAR_MAR', from: 'Barcelona', to: 'Marseille', length: 4, color: 'GRAY', ownerId: null, routeIndex: 0 },
  { id: 'EU_PAM_MAR', from: 'Pamplona', to: 'Marseille', length: 4, color: 'RED', ownerId: null, routeIndex: 0 },
  { id: 'EU_PAM_PAR_1', from: 'Pamplona', to: 'Paris', length: 4, color: 'BLUE', ownerId: null, routeIndex: 0 },
  { id: 'EU_PAM_PAR_2', from: 'Pamplona', to: 'Paris', length: 4, color: 'GREEN', ownerId: null, routeIndex: 1 },
  { id: 'EU_PAM_BRE', from: 'Pamplona', to: 'Brest', length: 4, color: 'PINK', ownerId: null, routeIndex: 0 },
  { id: 'EU_BRE_DIE', from: 'Brest', to: 'Dieppe', length: 2, color: 'ORANGE', ownerId: null, routeIndex: 0 },
  { id: 'EU_BRE_PAR', from: 'Brest', to: 'Paris', length: 3, color: 'BLACK', ownerId: null, routeIndex: 0 },
  { id: 'EU_DIE_PAR', from: 'Dieppe', to: 'Paris', length: 1, color: 'PINK', ownerId: null, routeIndex: 0 },
  { id: 'EU_DIE_BRU', from: 'Dieppe', to: 'Bruxelles', length: 2, color: 'GREEN', ownerId: null, routeIndex: 0 },
  { id: 'EU_PAR_BRU_1', from: 'Paris', to: 'Bruxelles', length: 2, color: 'YELLOW', ownerId: null, routeIndex: 0 },
  { id: 'EU_PAR_BRU_2', from: 'Paris', to: 'Bruxelles', length: 2, color: 'RED', ownerId: null, routeIndex: 1 },
  { id: 'EU_PAR_MAR', from: 'Paris', to: 'Marseille', length: 4, color: 'GRAY', ownerId: null, routeIndex: 0 },
  { id: 'EU_PAR_ZUR', from: 'Paris', to: 'Zürich', length: 3, color: 'GRAY', ownerId: null, routeIndex: 0, isTunnel: true },
  { id: 'EU_PAR_FRA_1', from: 'Paris', to: 'Frankfurt', length: 3, color: 'WHITE', ownerId: null, routeIndex: 0 },
  { id: 'EU_PAR_FRA_2', from: 'Paris', to: 'Frankfurt', length: 3, color: 'ORANGE', ownerId: null, routeIndex: 1 },

  // Benelux, Germany & Alps
  { id: 'EU_BRU_AMS', from: 'Bruxelles', to: 'Amsterdam', length: 1, color: 'BLACK', ownerId: null, routeIndex: 0 },
  { id: 'EU_BRU_FRA', from: 'Bruxelles', to: 'Frankfurt', length: 2, color: 'BLUE', ownerId: null, routeIndex: 0 },
  { id: 'EU_AMS_ESS', from: 'Amsterdam', to: 'Essen', length: 3, color: 'YELLOW', ownerId: null, routeIndex: 0 },
  { id: 'EU_AMS_FRA', from: 'Amsterdam', to: 'Frankfurt', length: 2, color: 'WHITE', ownerId: null, routeIndex: 0 },
  { id: 'EU_ESS_FRA', from: 'Essen', to: 'Frankfurt', length: 2, color: 'GREEN', ownerId: null, routeIndex: 0 },
  { id: 'EU_ESS_BER', from: 'Essen', to: 'Berlin', length: 2, color: 'BLUE', ownerId: null, routeIndex: 0 },
  { id: 'EU_ESS_KOB_1', from: 'Essen', to: 'København', length: 3, color: 'GRAY', ownerId: null, routeIndex: 0, ferryLocomotives: 1 },
  { id: 'EU_ESS_KOB_2', from: 'Essen', to: 'København', length: 3, color: 'GRAY', ownerId: null, routeIndex: 1, ferryLocomotives: 1 },
  { id: 'EU_KOB_STO_1', from: 'København', to: 'Stockholm', length: 3, color: 'YELLOW', ownerId: null, routeIndex: 0 },
  { id: 'EU_KOB_STO_2', from: 'København', to: 'Stockholm', length: 3, color: 'WHITE', ownerId: null, routeIndex: 1 },
  { id: 'EU_STO_PET', from: 'Stockholm', to: 'Petrograd', length: 8, color: 'GRAY', ownerId: null, routeIndex: 0, isTunnel: true },
  { id: 'EU_FRA_BER_1', from: 'Frankfurt', to: 'Berlin', length: 3, color: 'BLACK', ownerId: null, routeIndex: 0 },
  { id: 'EU_FRA_BER_2', from: 'Frankfurt', to: 'Berlin', length: 3, color: 'RED', ownerId: null, routeIndex: 1 },
  { id: 'EU_FRA_MUN', from: 'Frankfurt', to: 'München', length: 2, color: 'PINK', ownerId: null, routeIndex: 0 },
  { id: 'EU_MUN_ZUR', from: 'München', to: 'Zürich', length: 2, color: 'YELLOW', ownerId: null, routeIndex: 0, isTunnel: true },
  { id: 'EU_MUN_VEN', from: 'München', to: 'Venezia', length: 2, color: 'BLUE', ownerId: null, routeIndex: 0, isTunnel: true },
  { id: 'EU_MUN_WIE', from: 'München', to: 'Wien', length: 3, color: 'ORANGE', ownerId: null, routeIndex: 0 },
  { id: 'EU_ZUR_MAR', from: 'Zürich', to: 'Marseille', length: 2, color: 'PINK', ownerId: null, routeIndex: 0, isTunnel: true },
  { id: 'EU_ZUR_VEN', from: 'Zürich', to: 'Venezia', length: 2, color: 'GREEN', ownerId: null, routeIndex: 0, isTunnel: true },
  { id: 'EU_MAR_ROM', from: 'Marseille', to: 'Roma', length: 4, color: 'GRAY', ownerId: null, routeIndex: 0, isTunnel: true },

  // Italy & Mediterranean Ferries
  { id: 'EU_VEN_ROM', from: 'Venezia', to: 'Roma', length: 2, color: 'BLACK', ownerId: null, routeIndex: 0 },
  { id: 'EU_VEN_ZAG', from: 'Venezia', to: 'Zagreb', length: 2, color: 'GRAY', ownerId: null, routeIndex: 0 },
  { id: 'EU_ROM_BRI', from: 'Roma', to: 'Brindisi', length: 2, color: 'WHITE', ownerId: null, routeIndex: 0 },
  { id: 'EU_ROM_PAL', from: 'Roma', to: 'Palermo', length: 4, color: 'GRAY', ownerId: null, routeIndex: 0, ferryLocomotives: 1 },
  { id: 'EU_BRI_PAL', from: 'Brindisi', to: 'Palermo', length: 3, color: 'GRAY', ownerId: null, routeIndex: 0, ferryLocomotives: 1 },
  { id: 'EU_BRI_ATH', from: 'Brindisi', to: 'Athina', length: 4, color: 'GRAY', ownerId: null, routeIndex: 0, ferryLocomotives: 1 },
  { id: 'EU_PAL_SMY', from: 'Palermo', to: 'Smyrna', length: 6, color: 'GRAY', ownerId: null, routeIndex: 0, ferryLocomotives: 2 },

  // Central Europe, Poland & Baltic
  { id: 'EU_BER_DAN', from: 'Berlin', to: 'Danzig', length: 4, color: 'GRAY', ownerId: null, routeIndex: 0 },
  { id: 'EU_BER_WAR_1', from: 'Berlin', to: 'Warszawa', length: 4, color: 'PINK', ownerId: null, routeIndex: 0 },
  { id: 'EU_BER_WAR_2', from: 'Berlin', to: 'Warszawa', length: 4, color: 'YELLOW', ownerId: null, routeIndex: 1 },
  { id: 'EU_BER_WIE', from: 'Berlin', to: 'Wien', length: 3, color: 'GREEN', ownerId: null, routeIndex: 0 },
  { id: 'EU_DAN_WAR', from: 'Danzig', to: 'Warszawa', length: 2, color: 'GRAY', ownerId: null, routeIndex: 0 },
  { id: 'EU_DAN_RIG', from: 'Danzig', to: 'Riga', length: 3, color: 'BLACK', ownerId: null, routeIndex: 0 },
  { id: 'EU_RIG_PET', from: 'Riga', to: 'Petrograd', length: 4, color: 'GRAY', ownerId: null, routeIndex: 0 },
  { id: 'EU_RIG_WIL', from: 'Riga', to: 'Wilno', length: 4, color: 'GREEN', ownerId: null, routeIndex: 0 },
  { id: 'EU_WAR_WIE', from: 'Warszawa', to: 'Wien', length: 4, color: 'BLUE', ownerId: null, routeIndex: 0 },
  { id: 'EU_WAR_WIL', from: 'Warszawa', to: 'Wilno', length: 3, color: 'RED', ownerId: null, routeIndex: 0 },
  { id: 'EU_WAR_KYI', from: 'Warszawa', to: 'Kyiv', length: 4, color: 'GRAY', ownerId: null, routeIndex: 0 },
  { id: 'EU_WIE_BUD_1', from: 'Wien', to: 'Budapest', length: 1, color: 'RED', ownerId: null, routeIndex: 0 },
  { id: 'EU_WIE_BUD_2', from: 'Wien', to: 'Budapest', length: 1, color: 'WHITE', ownerId: null, routeIndex: 1 },
  { id: 'EU_WIE_ZAG', from: 'Wien', to: 'Zagreb', length: 2, color: 'GRAY', ownerId: null, routeIndex: 0 },

  // Balkans & Carpathians
  { id: 'EU_ZAG_BUD', from: 'Zagreb', to: 'Budapest', length: 2, color: 'ORANGE', ownerId: null, routeIndex: 0 },
  { id: 'EU_ZAG_SAR', from: 'Zagreb', to: 'Sarajevo', length: 3, color: 'RED', ownerId: null, routeIndex: 0 },
  { id: 'EU_BUD_SAR', from: 'Budapest', to: 'Sarajevo', length: 3, color: 'PINK', ownerId: null, routeIndex: 0 },
  { id: 'EU_BUD_BUC', from: 'Budapest', to: 'Bucuresti', length: 4, color: 'GRAY', ownerId: null, routeIndex: 0, isTunnel: true },
  { id: 'EU_BUD_KYI', from: 'Budapest', to: 'Kyiv', length: 6, color: 'GRAY', ownerId: null, routeIndex: 0, isTunnel: true },
  { id: 'EU_SAR_ATH', from: 'Sarajevo', to: 'Athina', length: 4, color: 'GREEN', ownerId: null, routeIndex: 0 },
  { id: 'EU_SAR_SOF', from: 'Sarajevo', to: 'Sofia', length: 2, color: 'GRAY', ownerId: null, routeIndex: 0, isTunnel: true },
  { id: 'EU_ATH_SOF', from: 'Athina', to: 'Sofia', length: 3, color: 'PINK', ownerId: null, routeIndex: 0 },
  { id: 'EU_ATH_SMY', from: 'Athina', to: 'Smyrna', length: 2, color: 'GRAY', ownerId: null, routeIndex: 0, ferryLocomotives: 1 },
  { id: 'EU_SOF_BUC', from: 'Sofia', to: 'Bucuresti', length: 2, color: 'GRAY', ownerId: null, routeIndex: 0, isTunnel: true },
  { id: 'EU_SOF_CON', from: 'Sofia', to: 'Constantinople', length: 3, color: 'BLUE', ownerId: null, routeIndex: 0 },
  { id: 'EU_BUC_CON', from: 'Bucuresti', to: 'Constantinople', length: 3, color: 'YELLOW', ownerId: null, routeIndex: 0 },
  { id: 'EU_BUC_SEV', from: 'Bucuresti', to: 'Sevastopol', length: 4, color: 'WHITE', ownerId: null, routeIndex: 0 },
  { id: 'EU_BUC_KYI', from: 'Bucuresti', to: 'Kyiv', length: 4, color: 'GRAY', ownerId: null, routeIndex: 0 },

  // Eastern Europe, Russia, Black Sea & Anatolia
  { id: 'EU_WIL_PET', from: 'Wilno', to: 'Petrograd', length: 4, color: 'BLUE', ownerId: null, routeIndex: 0 },
  { id: 'EU_WIL_SMO', from: 'Wilno', to: 'Smolensk', length: 3, color: 'YELLOW', ownerId: null, routeIndex: 0 },
  { id: 'EU_WIL_KYI', from: 'Wilno', to: 'Kyiv', length: 2, color: 'GRAY', ownerId: null, routeIndex: 0 },
  { id: 'EU_PET_MOS', from: 'Petrograd', to: 'Moskva', length: 4, color: 'WHITE', ownerId: null, routeIndex: 0 },
  { id: 'EU_SMO_MOS', from: 'Smolensk', to: 'Moskva', length: 2, color: 'ORANGE', ownerId: null, routeIndex: 0 },
  { id: 'EU_SMO_KYI', from: 'Smolensk', to: 'Kyiv', length: 3, color: 'RED', ownerId: null, routeIndex: 0 },
  { id: 'EU_MOS_KHA', from: 'Moskva', to: 'Kharkov', length: 4, color: 'GRAY', ownerId: null, routeIndex: 0 },
  { id: 'EU_KYI_KHA', from: 'Kyiv', to: 'Kharkov', length: 4, color: 'GRAY', ownerId: null, routeIndex: 0 },
  { id: 'EU_KHA_ROS', from: 'Kharkov', to: 'Rostov', length: 2, color: 'GREEN', ownerId: null, routeIndex: 0 },
  { id: 'EU_ROS_SEV', from: 'Rostov', to: 'Sevastopol', length: 4, color: 'GRAY', ownerId: null, routeIndex: 0 },
  { id: 'EU_ROS_SOC', from: 'Rostov', to: 'Sochi', length: 2, color: 'GRAY', ownerId: null, routeIndex: 0 },
  { id: 'EU_SEV_SOC', from: 'Sevastopol', to: 'Sochi', length: 2, color: 'GRAY', ownerId: null, routeIndex: 0, ferryLocomotives: 1 },
  { id: 'EU_SEV_CON', from: 'Sevastopol', to: 'Constantinople', length: 4, color: 'GRAY', ownerId: null, routeIndex: 0, ferryLocomotives: 2 },
  { id: 'EU_SEV_ERZ', from: 'Sevastopol', to: 'Erzurum', length: 4, color: 'GRAY', ownerId: null, routeIndex: 0, ferryLocomotives: 2 },
  { id: 'EU_SOC_ERZ', from: 'Sochi', to: 'Erzurum', length: 3, color: 'RED', ownerId: null, routeIndex: 0, isTunnel: true },
  { id: 'EU_CON_SMY', from: 'Constantinople', to: 'Smyrna', length: 2, color: 'GRAY', ownerId: null, routeIndex: 0, isTunnel: true },
  { id: 'EU_CON_ANG', from: 'Constantinople', to: 'Angora', length: 2, color: 'GRAY', ownerId: null, routeIndex: 0, isTunnel: true },
  { id: 'EU_SMY_ANG', from: 'Smyrna', to: 'Angora', length: 3, color: 'ORANGE', ownerId: null, routeIndex: 0, isTunnel: true },
  { id: 'EU_ANG_ERZ', from: 'Angora', to: 'Erzurum', length: 3, color: 'BLACK', ownerId: null, routeIndex: 0 },
];


