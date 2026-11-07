import {
  GameColorDefinition,
  GameDefinition,
  GameId,
} from '../types/game.js';

export const STANDARD_COLORS: Readonly<Record<string, GameColorDefinition>> = {
  red: {
    id: 'red',
    name: 'Red',
    hex: '#EF4444',
    strokeHex: '#FCA5A5',
  },
  blue: {
    id: 'blue',
    name: 'Blue',
    hex: '#3B82F6',
    strokeHex: '#93C5FD',
  },
  green: {
    id: 'green',
    name: 'Green',
    hex: '#22C55E',
    strokeHex: '#86EFAC',
  },
  yellow: {
    id: 'yellow',
    name: 'Yellow',
    hex: '#EAB308',
    strokeHex: '#FEF08A',
  },
  black: {
    id: 'black',
    name: 'Black',
    hex: '#1E293B',
    strokeHex: '#94A3B8',
  },
  white: {
    id: 'white',
    name: 'White',
    hex: '#F8FAFC',
    strokeHex: '#CBD5E1',
  },
  orange: {
    id: 'orange',
    name: 'Orange',
    hex: '#F97316',
    strokeHex: '#FDBA74',
  },
  purple: {
    id: 'purple',
    name: 'Purple',
    hex: '#A855F7',
    strokeHex: '#D8B4FE',
  },
  brown: {
    id: 'brown',
    name: 'Brown',
    hex: '#A16207',
    strokeHex: '#FDE047',
  },
};

export const GAME_CATALOG: readonly GameDefinition[] = [
  // =========================================================================
  // BOARD GAMES
  // =========================================================================
  {
    id: 'ttr',
    category: 'board',
    icon: '🚂',
    name: 'Ticket to Ride',
    subtitle: 'Cross-Country Rail Adventure',
    description:
      'Collect illustrated train cards, claim railway routes across North America, and connect distant cities on your secret Destination Tickets.',
    minPlayers: 2,
    maxPlayers: 5,
    estimatedMinutes: 45,
    mechanicsLabel: 'Network & Card Drafting',
    badgeColor: 'amber',
    availableColors: [
      STANDARD_COLORS['red']!,
      STANDARD_COLORS['blue']!,
      STANDARD_COLORS['green']!,
      STANDARD_COLORS['yellow']!,
      STANDARD_COLORS['black']!,
    ],
    expansions: [
      {
        id: 'europe_map',
        name: 'Europe (Ticket to Ride: Europe Map)',
        description:
          'Plays on the 47-city Europe Map featuring Ferries (requiring Locomotives), Mountain Tunnels, 3 Train Stations per player (+4 pts per unused station or borrow 1 rival route), and 1 Long Route + 3 Regular Tickets dealt at setup.',
      },
      {
        id: 'alvin_and_dexter',
        name: 'Alvin & Dexter',
        description:
          'Usable on all maps! Adds Alvin the Alien (🛸 Flying Saucer) & Dexter the Dinosaur (🦖 T-Rex). Cities in Chaos block route claims and halve ticket values. Spend 1–2 Locomotives on your turn to move a monster and collect Monster cards (+15 pts for most Alvin / Dexter cards).',
        compatibleMaps: ['USA', 'EUROPE'],
      },
      {
        id: '1910_mystery_train',
        name: 'USA 1910 / Mystery Train',
        description:
          'North America Map expansion adding 1910 Destination Tickets, the Globetrotter bonus card, and Big Cities route variants.',
        compatibleMaps: ['USA'],
      },
    ],
  },
  {
    id: 'catan',
    category: 'board',
    icon: '🏝️',
    name: 'Catan',
    subtitle: 'Settlers of the Hex Island',
    description:
      'Harvest resources from hex tiles, negotiate trades, and build roads, settlements, and cities in a race to 10 Victory Points.',
    minPlayers: 3,
    maxPlayers: 4,
    estimatedMinutes: 60,
    mechanicsLabel: 'Trading, Building & Dice Production',
    badgeColor: 'emerald',
    availableColors: [
      STANDARD_COLORS['red']!,
      STANDARD_COLORS['blue']!,
      STANDARD_COLORS['white']!,
      STANDARD_COLORS['orange']!,
      STANDARD_COLORS['green']!,
      STANDARD_COLORS['brown']!,
    ],
    expansions: [
      {
        id: 'catan_5_6_player',
        name: '5-6 Player Extension',
        description:
          'Expands the island capacity up to 6 players with extra resource cards and Paired Turn building rules.',
        minPlayersOverride: 3,
        maxPlayersOverride: 6,
      },
      {
        id: 'cities_and_knights',
        name: 'Cities & Knights',
        description:
          'Adds city commodities (Paper, Coin, Cloth), active Knights, and Barbarian fleet invasions.',
      },
      {
        id: 'seafarers',
        name: 'Seafarers',
        description:
          'Adds shipping lanes across water hexes, Gold River tiles, and the Pirate ship.',
      },
    ],
  },
  {
    id: 'stockpile',
    category: 'board',
    icon: '📈',
    name: 'Stockpile',
    subtitle: 'Insider Trading & Market Manipulation',
    description:
      'Use private insider market forecasts to bluff, build face-up and face-down stockpiles, bid on portfolios, and profit from stock splits.',
    minPlayers: 2,
    maxPlayers: 5,
    estimatedMinutes: 45,
    mechanicsLabel: 'Insider Info, Blind Stockpiles & Bidding',
    badgeColor: 'cyan',
    availableColors: [
      STANDARD_COLORS['red']!,
      STANDARD_COLORS['blue']!,
      STANDARD_COLORS['green']!,
      STANDARD_COLORS['yellow']!,
      STANDARD_COLORS['purple']!,
    ],
    expansions: [
      {
        id: 'continuing_corruption',
        name: 'Continuing Corruption',
        description:
          'Introduces Commodity Bonds, Forecast Dice, and asymmetric Investor personas across the 6 trading rounds.',
      },
    ],
  },
  {
    id: 'power_grid',
    category: 'board',
    icon: '⚡',
    name: 'Power Grid',
    subtitle: 'Industrial Power Plant Auctions & Grid Expansion',
    description:
      'Bid on power plants, compete for scarce fuel on a dynamic commodity market, and expand your electrical grid across Germany and the USA.',
    minPlayers: 2,
    maxPlayers: 6,
    estimatedMinutes: 90,
    mechanicsLabel: 'Plant Auctions, Fuel Scarcity & Dijkstra Grid',
    badgeColor: 'amber',
    availableColors: [
      STANDARD_COLORS['red']!,
      STANDARD_COLORS['blue']!,
      STANDARD_COLORS['yellow']!,
      STANDARD_COLORS['green']!,
      STANDARD_COLORS['purple']!,
      STANDARD_COLORS['black']!,
    ],
    expansions: [
      {
        id: 'benelux_central_europe',
        name: 'Benelux / Central Europe Map',
        description:
          'Fast-paced European regional grids with accelerated ecological power plants and tighter city connections.',
      },
      {
        id: 'new_power_plant_deck',
        name: 'New Power Plant Deck',
        description:
          'Adds alternative balanced power plant cards for fresh auction pacing and fuel demand curves.',
      },
    ],
  },

  // =========================================================================
  // CARD GAMES
  // =========================================================================
  {
    id: 'holdem',
    category: 'card',
    icon: '🃏',
    name: "Texas Hold'em",
    subtitle: 'No-Limit Casino Poker',
    description:
      'Classic No-Limit Texas Hold’em with rotating dealer button, blinds, side pots, and 7-card best-5 showdown evaluation.',
    minPlayers: 2,
    maxPlayers: 6,
    estimatedMinutes: 30,
    mechanicsLabel: 'No-Limit Betting & Hand Evaluation',
    badgeColor: 'rose',
    availableColors: [
      STANDARD_COLORS['red']!,
      STANDARD_COLORS['blue']!,
      STANDARD_COLORS['green']!,
      STANDARD_COLORS['black']!,
      STANDARD_COLORS['yellow']!,
      STANDARD_COLORS['purple']!,
    ],
    expansions: [
      {
        id: 'tournament_blinds',
        name: 'Tournament Blinds',
        description:
          'Escalates Small and Big Blinds automatically every 4 hands for high-stakes tournament pressure.',
      },
    ],
  },
  {
    id: 'euchre',
    category: 'card',
    icon: '♠️',
    name: 'Euchre',
    subtitle: 'Classic 24-Card Bower Trick-Taking',
    description:
      'Call trump, march alone with the Right and Left Bowers, or Euchre the makers for 2 points in a race to 10.',
    minPlayers: 2,
    maxPlayers: 4,
    estimatedMinutes: 25,
    mechanicsLabel: 'Trump Calling, Right/Left Bowers & Tricks',
    badgeColor: 'indigo',
    availableColors: [
      STANDARD_COLORS['red']!,
      STANDARD_COLORS['blue']!,
      STANDARD_COLORS['green']!,
      STANDARD_COLORS['yellow']!,
    ],
    expansions: [
      {
        id: 'stick_the_dealer',
        name: 'Stick the Dealer',
        description:
          'Forces the dealer to name a trump suit in Round 2 if all other players pass.',
      },
      {
        id: 'jack_of_diamonds_bonus',
        name: 'Jack of Diamonds (-10 pts)',
        description:
          'Classic trick-taking variant awarding a bonus point swing when capturing the Jack of Diamonds.',
      },
    ],
  },
  {
    id: 'cribbage',
    category: 'card',
    icon: '🪵',
    name: 'Cribbage',
    subtitle: '121-Point Pegging & Hand Counting',
    description:
      'Discard to the dealer’s Crib, peg to 31 for pairs and runs, and count fifteens, flushes, and His Nobs along the 121-hole board.',
    minPlayers: 2,
    maxPlayers: 4,
    estimatedMinutes: 30,
    mechanicsLabel: 'Crib Discards, 31 Pegging & 15s/Runs',
    badgeColor: 'cyan',
    availableColors: [
      STANDARD_COLORS['red']!,
      STANDARD_COLORS['blue']!,
      STANDARD_COLORS['green']!,
      STANDARD_COLORS['yellow']!,
    ],
    expansions: [
      {
        id: 'muggins_rule',
        name: 'Muggins & Skunk Line',
        description:
          'Tracks double-game wins when an opponent finishes below the 91-point Skunk mark.',
      },
    ],
  },
  {
    id: 'kings_corners',
    category: 'card',
    icon: '👑',
    name: 'Kings Corners',
    subtitle: '4-Card Memory, Knocking & Quarters Pot',
    description:
      'Peek at 2 of your 4 hidden cards at the start of the hand, swap blindly from the deck or discard pile, and knock when you hold the lowest total.',
    minPlayers: 2,
    maxPlayers: 6,
    estimatedMinutes: 20,
    mechanicsLabel: '2-Card Peek, Hidden Swaps & Low Score Knock',
    badgeColor: 'amber',
    availableColors: [
      STANDARD_COLORS['red']!,
      STANDARD_COLORS['blue']!,
      STANDARD_COLORS['green']!,
      STANDARD_COLORS['yellow']!,
      STANDARD_COLORS['purple']!,
      STANDARD_COLORS['orange']!,
    ],
    expansions: [
      {
        id: 'jack_of_diamonds_minus_10',
        name: 'Jack of Diamonds (-10 pts)',
        description:
          'Special card variant where the Jack of Diamonds counts as -10 points instead of +10.',
      },
    ],
  },
] as const;

export const GAME_CATALOG_BY_ID: Readonly<Record<GameId, GameDefinition>> =
  Object.fromEntries(GAME_CATALOG.map((g) => [g.id, g])) as Record<
    GameId,
    GameDefinition
  >;

export const BOARD_GAMES_CATALOG: readonly GameDefinition[] =
  GAME_CATALOG.filter((g) => g.category === 'board');

export const CARD_GAMES_CATALOG: readonly GameDefinition[] =
  GAME_CATALOG.filter((g) => g.category === 'card');

export function getGameColorById(
  gameId: GameId,
  colorId: string | null | undefined
): GameColorDefinition | null {
  if (!colorId) return null;
  const game = GAME_CATALOG_BY_ID[gameId];
  return (
    game?.availableColors.find((c) => c.id === colorId) ??
    STANDARD_COLORS[colorId] ??
    null
  );
}
