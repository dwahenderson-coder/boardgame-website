import { createPRNG, shuffleArray } from '../../common/prng.js';
import { Card } from './types.js';

export const DOMINION_CARDS: Readonly<Record<string, Card>> = {
  // =========================================================================
  // BASIC TREASURE CARDS
  // =========================================================================
  copper: {
    id: 'copper',
    name: 'Copper',
    cost: 0,
    types: ['TREASURE'],
    coins: 1,
    vp: 0,
    actions: 0,
    buys: 0,
    cards: 0,
    description: '+1 Coin',
  },
  silver: {
    id: 'silver',
    name: 'Silver',
    cost: 3,
    types: ['TREASURE'],
    coins: 2,
    vp: 0,
    actions: 0,
    buys: 0,
    cards: 0,
    description: '+2 Coins',
  },
  gold: {
    id: 'gold',
    name: 'Gold',
    cost: 6,
    types: ['TREASURE'],
    coins: 3,
    vp: 0,
    actions: 0,
    buys: 0,
    cards: 0,
    description: '+3 Coins',
  },

  // =========================================================================
  // BASIC VICTORY & CURSE CARDS
  // =========================================================================
  estate: {
    id: 'estate',
    name: 'Estate',
    cost: 2,
    types: ['VICTORY'],
    coins: 0,
    vp: 1,
    actions: 0,
    buys: 0,
    cards: 0,
    description: '1 Victory Point',
  },
  duchy: {
    id: 'duchy',
    name: 'Duchy',
    cost: 5,
    types: ['VICTORY'],
    coins: 0,
    vp: 3,
    actions: 0,
    buys: 0,
    cards: 0,
    description: '3 Victory Points',
  },
  province: {
    id: 'province',
    name: 'Province',
    cost: 8,
    types: ['VICTORY'],
    coins: 0,
    vp: 6,
    actions: 0,
    buys: 0,
    cards: 0,
    description: '6 Victory Points',
  },
  curse: {
    id: 'curse',
    name: 'Curse',
    cost: 0,
    types: ['CURSE'],
    coins: 0,
    vp: -1,
    actions: 0,
    buys: 0,
    cards: 0,
    description: '-1 Victory Point',
  },

  // =========================================================================
  // ALL 26 BASE GAME KINGDOM CARDS (ALPHABETICAL)
  // =========================================================================
  artisan: {
    id: 'artisan',
    name: 'Artisan',
    cost: 6,
    types: ['ACTION'],
    coins: 0,
    vp: 0,
    actions: 0,
    buys: 0,
    cards: 0,
    customEffectId: 'ARTISAN',
    description:
      'Gain a card to your hand costing up to 5. Put a card from your hand onto your deck.',
  },
  bandit: {
    id: 'bandit',
    name: 'Bandit',
    cost: 5,
    types: ['ACTION', 'ATTACK'],
    coins: 0,
    vp: 0,
    actions: 0,
    buys: 0,
    cards: 0,
    customEffectId: 'BANDIT',
    description:
      'Gain a Gold. Each other player reveals the top 2 cards of their deck, trashes a revealed Treasure other than Copper, and discards the rest.',
  },
  bureaucrat: {
    id: 'bureaucrat',
    name: 'Bureaucrat',
    cost: 4,
    types: ['ACTION', 'ATTACK'],
    coins: 0,
    vp: 0,
    actions: 0,
    buys: 0,
    cards: 0,
    customEffectId: 'BUREAUCRAT',
    description:
      'Gain a Silver onto your deck. Each other player reveals a Victory card from their hand and puts it onto their deck.',
  },
  cellar: {
    id: 'cellar',
    name: 'Cellar',
    cost: 2,
    types: ['ACTION'],
    coins: 0,
    vp: 0,
    actions: 1,
    buys: 0,
    cards: 0,
    customEffectId: 'CELLAR',
    description: '+1 Action. Discard any number of cards, then draw that many.',
  },
  chapel: {
    id: 'chapel',
    name: 'Chapel',
    cost: 2,
    types: ['ACTION'],
    coins: 0,
    vp: 0,
    actions: 0,
    buys: 0,
    cards: 0,
    customEffectId: 'CHAPEL',
    description: 'Trash up to 4 cards from your hand.',
  },
  council_room: {
    id: 'council_room',
    name: 'Council Room',
    cost: 5,
    types: ['ACTION'],
    coins: 0,
    vp: 0,
    actions: 0,
    buys: 1,
    cards: 4,
    customEffectId: 'COUNCIL_ROOM',
    description: '+4 Cards, +1 Buy. Each other player draws a card.',
  },
  festival: {
    id: 'festival',
    name: 'Festival',
    cost: 5,
    types: ['ACTION'],
    coins: 2,
    vp: 0,
    actions: 2,
    buys: 1,
    cards: 0,
    description: '+2 Actions, +1 Buy, +2 Coins.',
  },
  gardens: {
    id: 'gardens',
    name: 'Gardens',
    cost: 4,
    types: ['VICTORY'],
    coins: 0,
    vp: 0,
    actions: 0,
    buys: 0,
    cards: 0,
    customEffectId: 'GARDENS',
    description: 'Worth 1 VP per 10 cards you have (round down).',
  },
  harbinger: {
    id: 'harbinger',
    name: 'Harbinger',
    cost: 3,
    types: ['ACTION'],
    coins: 0,
    vp: 0,
    actions: 1,
    buys: 0,
    cards: 1,
    customEffectId: 'HARBINGER',
    description:
      '+1 Card, +1 Action. Look through your discard pile. You may put a card from it onto your deck.',
  },
  laboratory: {
    id: 'laboratory',
    name: 'Laboratory',
    cost: 5,
    types: ['ACTION'],
    coins: 0,
    vp: 0,
    actions: 1,
    buys: 0,
    cards: 2,
    description: '+2 Cards, +1 Action.',
  },
  library: {
    id: 'library',
    name: 'Library',
    cost: 5,
    types: ['ACTION'],
    coins: 0,
    vp: 0,
    actions: 0,
    buys: 0,
    cards: 0,
    customEffectId: 'LIBRARY',
    description:
      'Draw until you have 7 cards in hand, skipping any Action cards you choose to; set those aside, discarding them afterwards.',
  },
  market: {
    id: 'market',
    name: 'Market',
    cost: 5,
    types: ['ACTION'],
    coins: 1,
    vp: 0,
    actions: 1,
    buys: 1,
    cards: 1,
    description: '+1 Card, +1 Action, +1 Buy, +1 Coin.',
  },
  merchant: {
    id: 'merchant',
    name: 'Merchant',
    cost: 3,
    types: ['ACTION'],
    coins: 0,
    vp: 0,
    actions: 1,
    buys: 0,
    cards: 1,
    customEffectId: 'MERCHANT',
    description:
      '+1 Card, +1 Action. The first time you play a Silver this turn, +1 Coin.',
  },
  militia: {
    id: 'militia',
    name: 'Militia',
    cost: 4,
    types: ['ACTION', 'ATTACK'],
    coins: 2,
    vp: 0,
    actions: 0,
    buys: 0,
    cards: 0,
    customEffectId: 'MILITIA',
    description:
      '+2 Coins. Each other player discards down to 3 cards in hand.',
  },
  mine: {
    id: 'mine',
    name: 'Mine',
    cost: 5,
    types: ['ACTION'],
    coins: 0,
    vp: 0,
    actions: 0,
    buys: 0,
    cards: 0,
    customEffectId: 'MINE',
    description:
      'You may trash a Treasure from your hand. Gain a Treasure to your hand costing up to 3 more than it.',
  },
  moat: {
    id: 'moat',
    name: 'Moat',
    cost: 2,
    types: ['ACTION', 'REACTION'],
    coins: 0,
    vp: 0,
    actions: 0,
    buys: 0,
    cards: 2,
    customEffectId: 'MOAT',
    description:
      '+2 Cards. When another player plays an Attack card, you may first reveal this from your hand to be unaffected by it.',
  },
  moneylender: {
    id: 'moneylender',
    name: 'Moneylender',
    cost: 4,
    types: ['ACTION'],
    coins: 0,
    vp: 0,
    actions: 0,
    buys: 0,
    cards: 0,
    customEffectId: 'MONEYLENDER',
    description: 'You may trash a Copper from your hand for +3 Coins.',
  },
  poacher: {
    id: 'poacher',
    name: 'Poacher',
    cost: 4,
    types: ['ACTION'],
    coins: 1,
    vp: 0,
    actions: 1,
    buys: 0,
    cards: 1,
    customEffectId: 'POACHER',
    description:
      '+1 Card, +1 Action, +1 Coin. Discard a card per empty Supply pile.',
  },
  remodel: {
    id: 'remodel',
    name: 'Remodel',
    cost: 4,
    types: ['ACTION'],
    coins: 0,
    vp: 0,
    actions: 0,
    buys: 0,
    cards: 0,
    customEffectId: 'REMODEL',
    description:
      'Trash a card from your hand. Gain a card costing up to 2 more than it.',
  },
  sentry: {
    id: 'sentry',
    name: 'Sentry',
    cost: 5,
    types: ['ACTION'],
    coins: 0,
    vp: 0,
    actions: 1,
    buys: 0,
    cards: 1,
    customEffectId: 'SENTRY',
    description:
      '+1 Card, +1 Action. Look at the top 2 cards of your deck. Trash and/or discard any number of them. Put the rest back on top in any order.',
  },
  smithy: {
    id: 'smithy',
    name: 'Smithy',
    cost: 4,
    types: ['ACTION'],
    coins: 0,
    vp: 0,
    actions: 0,
    buys: 0,
    cards: 3,
    description: '+3 Cards.',
  },
  throne_room: {
    id: 'throne_room',
    name: 'Throne Room',
    cost: 4,
    types: ['ACTION'],
    coins: 0,
    vp: 0,
    actions: 0,
    buys: 0,
    cards: 0,
    customEffectId: 'THRONE_ROOM',
    description: 'You may play an Action card from your hand twice.',
  },
  vassal: {
    id: 'vassal',
    name: 'Vassal',
    cost: 3,
    types: ['ACTION'],
    coins: 2,
    vp: 0,
    actions: 0,
    buys: 0,
    cards: 0,
    customEffectId: 'VASSAL',
    description:
      '+2 Coins. Discard the top card of your deck. If it is an Action card, you may play it.',
  },
  village: {
    id: 'village',
    name: 'Village',
    cost: 3,
    types: ['ACTION'],
    coins: 0,
    vp: 0,
    actions: 2,
    buys: 0,
    cards: 1,
    description: '+1 Card, +2 Actions.',
  },
  witch: {
    id: 'witch',
    name: 'Witch',
    cost: 5,
    types: ['ACTION', 'ATTACK'],
    coins: 0,
    vp: 0,
    actions: 0,
    buys: 0,
    cards: 2,
    customEffectId: 'WITCH',
    description: '+2 Cards. Each other player gains a Curse.',
  },
  workshop: {
    id: 'workshop',
    name: 'Workshop',
    cost: 3,
    types: ['ACTION'],
    coins: 0,
    vp: 0,
    actions: 0,
    buys: 0,
    cards: 0,
    customEffectId: 'WORKSHOP',
    description: 'Gain a card costing up to 4.',
  },
  woodcutter: {
    id: 'woodcutter',
    name: 'Woodcutter',
    cost: 3,
    types: ['ACTION'],
    coins: 2,
    vp: 0,
    actions: 0,
    buys: 1,
    cards: 0,
    description: '+1 Buy, +2 Coins.',
  },
};

export const BASIC_TREASURE_CARD_IDS = ['copper', 'silver', 'gold'] as const;
export const BASIC_VICTORY_CARD_IDS = ['estate', 'duchy', 'province'] as const;
export const BASIC_SUPPLY_CARD_IDS = [
  'copper',
  'silver',
  'gold',
  'estate',
  'duchy',
  'province',
  'curse',
] as const;

export const DEFAULT_BASE_KINGDOM_CARD_IDS: readonly string[] = [
  'cellar',
  'market',
  'merchant',
  'militia',
  'mine',
  'moat',
  'remodel',
  'smithy',
  'village',
  'workshop',
];

/**
 * The 26 official Base Game Kingdom cards available for random & custom 10-card selection.
 */
export const ALL_BASE_KINGDOM_CARD_IDS: readonly string[] = [
  'artisan',
  'bandit',
  'bureaucrat',
  'cellar',
  'chapel',
  'council_room',
  'festival',
  'gardens',
  'harbinger',
  'laboratory',
  'library',
  'market',
  'merchant',
  'militia',
  'mine',
  'moat',
  'moneylender',
  'poacher',
  'remodel',
  'sentry',
  'smithy',
  'throne_room',
  'vassal',
  'village',
  'witch',
  'workshop',
];

export interface DominionPresetGame {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly cards: readonly string[];
}

export const DOMINION_PRESET_GAMES: readonly DominionPresetGame[] = [
  {
    id: 'base_game',
    name: 'Base Game',
    description:
      'Classic introductory 10-card Kingdom: Cellar, Market, Merchant, Militia, Mine, Moat, Remodel, Smithy, Village, Workshop.',
    cards: [
      'cellar',
      'market',
      'merchant',
      'militia',
      'mine',
      'moat',
      'remodel',
      'smithy',
      'village',
      'workshop',
    ],
  },
  {
    id: 'size_distortion',
    name: 'Size Distortion',
    description:
      'Trash deeply with Chapel and Sentry or bloat your deck for Gardens: Artisan, Bandit, Bureaucrat, Chapel, Festival, Gardens, Sentry, Throne Room, Witch, Workshop.',
    cards: [
      'artisan',
      'bandit',
      'bureaucrat',
      'chapel',
      'festival',
      'gardens',
      'sentry',
      'throne_room',
      'witch',
      'workshop',
    ],
  },
  {
    id: 'deck_top',
    name: 'Deck Top',
    description:
      'Manipulate the top of your deck for Vassal and Council Room combos: Artisan, Bureaucrat, Council Room, Festival, Harbinger, Laboratory, Moneylender, Sentry, Vassal, Village.',
    cards: [
      'artisan',
      'bureaucrat',
      'council_room',
      'festival',
      'harbinger',
      'laboratory',
      'moneylender',
      'sentry',
      'vassal',
      'village',
    ],
  },
  {
    id: 'sleight_of_hand',
    name: 'Sleight of Hand',
    description:
      'Big hand-size engines and Throne Room chains: Cellar, Council Room, Festival, Gardens, Library, Harbinger, Militia, Poacher, Smithy, Throne Room.',
    cards: [
      'cellar',
      'council_room',
      'festival',
      'gardens',
      'library',
      'harbinger',
      'militia',
      'poacher',
      'smithy',
      'throne_room',
    ],
  },
  {
    id: 'improvements',
    name: 'Improvements',
    description:
      'Upgrade Treasures and trash Coppers into power cards: Artisan, Cellar, Market, Merchant, Mine, Moat, Moneylender, Poacher, Remodel, Witch.',
    cards: [
      'artisan',
      'cellar',
      'market',
      'merchant',
      'mine',
      'moat',
      'moneylender',
      'poacher',
      'remodel',
      'witch',
    ],
  },
  {
    id: 'silver_and_gold',
    name: 'Silver & Gold',
    description:
      'Treasure-driven combos with Bandit, Bureaucrat, Merchant, Mine & Moneylender: Bandit, Bureaucrat, Chapel, Harbinger, Laboratory, Merchant, Mine, Moneylender, Throne Room, Vassal.',
    cards: [
      'bandit',
      'bureaucrat',
      'chapel',
      'harbinger',
      'laboratory',
      'merchant',
      'mine',
      'moneylender',
      'throne_room',
      'vassal',
    ],
  },
];

/**
 * Resolves the 10 Kingdom card IDs from lobby `selectedExpansions` tokens and seed:
 * - `'mode:random'`: Randomly selects 10 cards from the 26 Base Game Kingdom cards using `seed`.
 * - `'mode:custom'`: Uses the 10 `'card:<id>'` tokens chosen by the Host (falls back to filling up to 10 if fewer).
 * - `'mode:preset'` (default): Uses the active `'preset:<id>'` token, defaulting to `'preset:base_game'` ("Base Game").
 */
export function resolveDominionKingdomCardsFromExpansions(
  selectedExpansions: readonly string[] | undefined,
  seed: number
): readonly string[] {
  const tokens = selectedExpansions ?? [];
  const modeToken =
    tokens.find((t) => t.startsWith('mode:')) ?? 'mode:preset';

  if (modeToken === 'mode:random') {
    const prng = createPRNG(seed);
    const shuffled = shuffleArray(ALL_BASE_KINGDOM_CARD_IDS, prng).value;
    return shuffled.slice(0, 10);
  }

  if (modeToken === 'mode:custom') {
    const chosen = tokens
      .filter((t) => t.startsWith('card:'))
      .map((t) => t.slice('card:'.length).trim().toLowerCase())
      .filter((cid) => Boolean(DOMINION_CARDS[cid]));
    if (chosen.length === 10) {
      return chosen;
    }
    const merged = Array.from(
      new Set([...chosen, ...DEFAULT_BASE_KINGDOM_CARD_IDS])
    );
    return merged.slice(0, 10);
  }

  // Default: Pre-Set Game ('mode:preset')
  const presetToken =
    tokens.find((t) => t.startsWith('preset:')) ?? 'preset:base_game';
  const presetId = presetToken.slice('preset:'.length);
  const preset =
    DOMINION_PRESET_GAMES.find((p) => p.id === presetId) ??
    DOMINION_PRESET_GAMES[0]!;
  return preset.cards;
}

/**
 * Resolves a Dominion Card definition by id or case-insensitive name.
 */
export function getDominionCard(cardIdOrName: string): Card | undefined {
  const normalized = cardIdOrName
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_');
  if (DOMINION_CARDS[normalized]) {
    return DOMINION_CARDS[normalized];
  }
  return Object.values(DOMINION_CARDS).find(
    (c) => c.name.toLowerCase() === cardIdOrName.trim().toLowerCase()
  );
}

/**
 * Creates the initial Supply counts for a 2–4 player Dominion match.
 */
export function createInitialSupply(
  playerCount: number,
  kingdomCardIds: readonly string[] = DEFAULT_BASE_KINGDOM_CARD_IDS
): Record<string, number> {
  const victoryCount = playerCount === 2 ? 8 : 12;
  const curseCount = Math.max(10, (playerCount - 1) * 10);
  const copperCount = Math.max(20, 60 - playerCount * 7);

  const supply: Record<string, number> = {
    copper: copperCount,
    silver: 40,
    gold: 30,
    estate: victoryCount,
    duchy: victoryCount,
    province: victoryCount,
    curse: curseCount,
  };

  for (const rawId of kingdomCardIds) {
    const def = getDominionCard(rawId);
    if (!def) {
      throw new Error(`Unknown Dominion Kingdom card: "${rawId}".`);
    }
    const isVictory = def.types.includes('VICTORY');
    supply[def.id] = isVictory ? victoryCount : 10;
  }

  return supply;
}
