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
  { id: 'TKT_CHI_NY', from: 'Chicago', to: 'New York', points: 5 },
  { id: 'TKT_BOS_MIA', from: 'Boston', to: 'Miami', points: 12 },
  { id: 'TKT_MTL_NO', from: 'Montreal', to: 'New Orleans', points: 13 },
  { id: 'TKT_SEA_LA', from: 'Seattle', to: 'Los Angeles', points: 9 },
  { id: 'TKT_HEL_LA', from: 'Helena', to: 'Los Angeles', points: 8 },
  { id: 'TKT_DUL_HOU', from: 'Duluth', to: 'Houston', points: 8 },
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
  { id: 'R_WDC_ATL', from: 'Washington', to: 'Atlanta', length: 4, color: 'GRAY', ownerId: null, routeIndex: 0 },
];

