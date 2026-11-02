import { RouteColor, TrainCardColor } from '../games/ticket-to-ride/types.js';

export interface CityCoordinates {
  readonly x: number; // SVG viewBox 0..1000
  readonly y: number; // SVG viewBox 0..600
  readonly labelOffset?: { readonly dx: number; readonly dy: number };
}

/**
 * Relative coordinates in a 1000x600 SVG viewBox for all North America cities
 * defined in STANDARD_BOARD_ROUTES and STANDARD_DESTINATION_TICKETS.
 */
export const CITY_COORDINATES: Readonly<Record<string, CityCoordinates>> = {
  Vancouver: { x: 130, y: 80, labelOffset: { dx: 0, dy: -14 } },
  Calgary: { x: 255, y: 70, labelOffset: { dx: 0, dy: -14 } },
  Seattle: { x: 120, y: 140, labelOffset: { dx: -38, dy: 4 } },
  Portland: { x: 100, y: 205, labelOffset: { dx: -38, dy: 4 } },
  'San Francisco': { x: 85, y: 365, labelOffset: { dx: -4, dy: 20 } },
  'Los Angeles': { x: 145, y: 465, labelOffset: { dx: -10, dy: 20 } },
  Helena: { x: 325, y: 175, labelOffset: { dx: 0, dy: -14 } },
  'Salt Lake City': { x: 245, y: 310, labelOffset: { dx: -15, dy: -14 } },
  Phoenix: { x: 250, y: 465, labelOffset: { dx: 0, dy: 20 } },
  Denver: { x: 385, y: 330, labelOffset: { dx: -10, dy: -14 } },
  'Santa Fe': { x: 370, y: 425, labelOffset: { dx: -28, dy: 4 } },
  'El Paso': { x: 365, y: 515, labelOffset: { dx: 0, dy: 20 } },
  Duluth: { x: 560, y: 175, labelOffset: { dx: 0, dy: -14 } },
  'Kansas City': { x: 535, y: 330, labelOffset: { dx: 0, dy: -14 } },
  'Oklahoma City': { x: 520, y: 415, labelOffset: { dx: -35, dy: 4 } },
  Dallas: { x: 535, y: 485, labelOffset: { dx: -28, dy: 4 } },
  Houston: { x: 560, y: 545, labelOffset: { dx: 0, dy: 20 } },
  Chicago: { x: 665, y: 245, labelOffset: { dx: 0, dy: -14 } },
  'Saint Louis': { x: 625, y: 335, labelOffset: { dx: 0, dy: -14 } },
  Nashville: { x: 695, y: 390, labelOffset: { dx: -10, dy: -14 } },
  'New Orleans': { x: 660, y: 535, labelOffset: { dx: 0, dy: 20 } },
  Pittsburgh: { x: 785, y: 260, labelOffset: { dx: -10, dy: -14 } },
  Montreal: { x: 865, y: 95, labelOffset: { dx: 0, dy: -14 } },
  Boston: { x: 935, y: 155, labelOffset: { dx: 26, dy: 4 } },
  'New York': { x: 880, y: 225, labelOffset: { dx: 35, dy: 4 } },
  Washington: { x: 855, y: 305, labelOffset: { dx: 40, dy: 4 } },
  Atlanta: { x: 760, y: 435, labelOffset: { dx: 28, dy: 4 } },
  Miami: { x: 845, y: 555, labelOffset: { dx: 26, dy: 5 } },
};

export interface ColorTheme {
  readonly label: string;
  readonly hex: string;
  readonly strokeHex: string;
  readonly textHex: string;
  readonly badgeBg: string;
  readonly badgeBorder: string;
}

export const ROUTE_COLOR_THEMES: Readonly<Record<RouteColor, ColorTheme>> = {
  RED: {
    label: 'Red',
    hex: '#ef4444',
    strokeHex: '#fca5a5',
    textHex: '#ffffff',
    badgeBg: 'bg-red-600 text-white',
    badgeBorder: 'border-red-400',
  },
  BLUE: {
    label: 'Blue',
    hex: '#3b82f6',
    strokeHex: '#93c5fd',
    textHex: '#ffffff',
    badgeBg: 'bg-blue-600 text-white',
    badgeBorder: 'border-blue-400',
  },
  GREEN: {
    label: 'Green',
    hex: '#22c55e',
    strokeHex: '#86efac',
    textHex: '#052e16',
    badgeBg: 'bg-emerald-600 text-white',
    badgeBorder: 'border-emerald-400',
  },
  YELLOW: {
    label: 'Yellow',
    hex: '#eab308',
    strokeHex: '#fde047',
    textHex: '#1e293b',
    badgeBg: 'bg-yellow-400 text-slate-950',
    badgeBorder: 'border-yellow-200',
  },
  BLACK: {
    label: 'Black',
    hex: '#1e293b',
    strokeHex: '#94a3b8',
    textHex: '#f8fafc',
    badgeBg: 'bg-slate-800 text-slate-100',
    badgeBorder: 'border-slate-500',
  },
  WHITE: {
    label: 'White',
    hex: '#f1f5f9',
    strokeHex: '#cbd5e1',
    textHex: '#0f172a',
    badgeBg: 'bg-slate-100 text-slate-900',
    badgeBorder: 'border-white',
  },
  ORANGE: {
    label: 'Orange',
    hex: '#f97316',
    strokeHex: '#fdba74',
    textHex: '#ffffff',
    badgeBg: 'bg-orange-500 text-white',
    badgeBorder: 'border-orange-300',
  },
  PINK: {
    label: 'Pink',
    hex: '#ec4899',
    strokeHex: '#f9a8d4',
    textHex: '#ffffff',
    badgeBg: 'bg-pink-500 text-white',
    badgeBorder: 'border-pink-300',
  },
  LOCOMOTIVE: {
    label: 'Locomotive (Wild)',
    hex: '#a855f7',
    strokeHex: '#fde047',
    textHex: '#ffffff',
    badgeBg:
      'bg-gradient-to-br from-purple-600 via-amber-500 to-cyan-500 text-white',
    badgeBorder: 'border-amber-300',
  },
  GRAY: {
    label: 'Gray (Any 1 Color)',
    hex: '#64748b',
    strokeHex: '#cbd5e1',
    textHex: '#f8fafc',
    badgeBg: 'bg-slate-600 text-slate-100',
    badgeBorder: 'border-slate-400',
  },
};

export interface PlayerPalette {
  readonly name: string;
  readonly fillHex: string;
  readonly strokeHex: string;
  readonly badgeClass: string;
  readonly dotClass: string;
}

export const PLAYER_PALETTES: readonly PlayerPalette[] = [
  {
    name: 'Cyan Express',
    fillHex: '#06b6d4',
    strokeHex: '#cffafe',
    badgeClass: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/50',
    dotClass: 'bg-cyan-400',
  },
  {
    name: 'Amber Line',
    fillHex: '#f59e0b',
    strokeHex: '#fef3c7',
    badgeClass: 'bg-amber-500/20 text-amber-300 border-amber-500/50',
    dotClass: 'bg-amber-400',
  },
  {
    name: 'Rose Rail',
    fillHex: '#f43f5e',
    strokeHex: '#ffe4e6',
    badgeClass: 'bg-rose-500/20 text-rose-300 border-rose-500/50',
    dotClass: 'bg-rose-400',
  },
  {
    name: 'Lime Transit',
    fillHex: '#84cc16',
    strokeHex: '#ecfccb',
    badgeClass: 'bg-lime-500/20 text-lime-300 border-lime-500/50',
    dotClass: 'bg-lime-400',
  },
  {
    name: 'Violet Pacific',
    fillHex: '#8b5cf6',
    strokeHex: '#ede9fe',
    badgeClass: 'bg-violet-500/20 text-violet-300 border-violet-500/50',
    dotClass: 'bg-violet-400',
  },
];

export function getPlayerPalette(
  playerId: string,
  playerOrder: readonly string[]
): PlayerPalette {
  const idx = playerOrder.indexOf(playerId);
  return PLAYER_PALETTES[(idx >= 0 ? idx : 0) % PLAYER_PALETTES.length]!;
}

/**
 * Computes valid card payment combinations for a given route and player hand.
 * Used by the Claim Route modal/popover or still allowing arbitrary custom payment testing.
 */
export function getValidPaymentsForRoute(
  routeColor: RouteColor,
  routeLength: number,
  hand: Readonly<Record<TrainCardColor, number>>
): Array<{
  readonly label: string;
  readonly payment: Partial<Record<TrainCardColor, number>>;
}> {
  const regularColors: Exclude<TrainCardColor, 'LOCOMOTIVE'>[] = [
    'RED',
    'BLUE',
    'GREEN',
    'YELLOW',
    'BLACK',
    'WHITE',
    'ORANGE',
    'PINK',
  ];

  const candidateColors =
    routeColor === 'GRAY'
      ? regularColors
      : [routeColor as Exclude<TrainCardColor, 'LOCOMOTIVE'>];

  const options: Array<{
    readonly label: string;
    readonly payment: Partial<Record<TrainCardColor, number>>;
  }> = [];

  const locoAvailable = hand.LOCOMOTIVE;

  for (const color of candidateColors) {
    const colorAvailable = hand[color];
    if (colorAvailable + locoAvailable < routeLength) {
      continue;
    }

    // Minimum locomotives needed up to maximum locomotives player holds
    const minLoco = Math.max(0, routeLength - colorAvailable);
    const maxLoco = Math.min(routeLength, locoAvailable);

    for (let locoUsed = minLoco; locoUsed <= maxLoco; locoUsed++) {
      const colorUsed = routeLength - locoUsed;
      if (colorUsed === 0 && locoUsed === routeLength) {
        // Pure locomotive payment; only add once
        if (!options.some((o) => o.label === `${routeLength}× LOCOMOTIVE`)) {
          options.push({
            label: `${routeLength}× LOCOMOTIVE`,
            payment: { LOCOMOTIVE: routeLength },
          });
        }
      } else if (colorUsed > 0) {
        const payment: Partial<Record<TrainCardColor, number>> = {
          [color]: colorUsed,
        };
        if (locoUsed > 0) {
          payment.LOCOMOTIVE = locoUsed;
        }
        const label =
          locoUsed > 0
            ? `${colorUsed}× ${color} + ${locoUsed}× LOCO`
            : `${colorUsed}× ${color}`;
        options.push({ label, payment });
      }
    }
  }

  return options;
}

