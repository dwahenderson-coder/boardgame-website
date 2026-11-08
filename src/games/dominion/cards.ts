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
  // CORE 10 KINGDOM CARDS (BASE GAME "FIRST GAME" SET)
  // =========================================================================
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

  // =========================================================================
  // ADDITIONAL BASE GAME KINGDOM CARDS
  // =========================================================================
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
 * Resolves a Dominion Card definition by id or case-insensitive name.
 */
export function getDominionCard(cardIdOrName: string): Card | undefined {
  const normalized = cardIdOrName.trim().toLowerCase();
  return DOMINION_CARDS[normalized];
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
