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

  // =========================================================================
  // ALL 6 1ST EDITION BASE DOMINION KINGDOM CARDS (ALPHABETICAL)
  // =========================================================================
  adventurer: {
    id: 'adventurer',
    name: 'Adventurer',
    cost: 6,
    types: ['ACTION'],
    coins: 0,
    vp: 0,
    actions: 0,
    buys: 0,
    cards: 0,
    customEffectId: 'ADVENTURER',
    description:
      'Reveal cards from your deck until you reveal 2 Treasure cards. Put those Treasure cards into your hand and discard the other revealed cards.',
  },
  chancellor: {
    id: 'chancellor',
    name: 'Chancellor',
    cost: 3,
    types: ['ACTION'],
    coins: 2,
    vp: 0,
    actions: 0,
    buys: 0,
    cards: 0,
    customEffectId: 'CHANCELLOR',
    description: 'You may immediately put your deck into your discard pile.',
  },
  feast: {
    id: 'feast',
    name: 'Feast',
    cost: 4,
    types: ['ACTION'],
    coins: 0,
    vp: 0,
    actions: 0,
    buys: 0,
    cards: 0,
    customEffectId: 'FEAST',
    description: 'Trash this card. Gain a card costing up to 5.',
  },
  spy: {
    id: 'spy',
    name: 'Spy',
    cost: 4,
    types: ['ACTION', 'ATTACK'],
    coins: 0,
    vp: 0,
    actions: 1,
    buys: 0,
    cards: 1,
    customEffectId: 'SPY',
    description:
      '+1 Card, +1 Action. Each player (including you) reveals the top card of their deck and either discards it or puts it back, your choice.',
  },
  thief: {
    id: 'thief',
    name: 'Thief',
    cost: 5,
    types: ['ACTION', 'ATTACK'],
    coins: 0,
    vp: 0,
    actions: 0,
    buys: 0,
    cards: 0,
    customEffectId: 'THIEF',
    description:
      'Each other player reveals the top 2 cards of their deck. If they revealed any Treasure cards, they trash one of them that you choose. You may gain any or all of the trashed cards. They discard the other revealed cards.',
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

  // =========================================================================
  // ALL 26 1ST EDITION SEASIDE KINGDOM CARDS (ALPHABETICAL)
  // AND 9 2ND EDITION CARDS
  // =========================================================================
  ambassador: {
    id: 'ambassador',
    name: 'Ambassador',
    cost: 3,
    types: ['ACTION', 'ATTACK'],
    coins: 0,
    vp: 0,
    actions: 0,
    buys: 0,
    cards: 0,
    customEffectId: 'AMBASSADOR',
    description:
      'Reveal a card from your hand. Return up to 2 copies of it from your hand to the Supply. Then each other player gains a copy of it.',
  },
  astrolabe: {
    id: 'astrolabe',
    name: 'Astrolabe',
    cost: 3,
    types: ['TREASURE', 'DURATION'],
    coins: 1,
    vp: 0,
    actions: 0,
    buys: 1,
    cards: 0,
    customEffectId: 'ASTROLABE',
    description: 'Now and at the start of your next turn: +1 Coin, +1 Buy.',
  },
  bazaar: {
    id: 'bazaar',
    name: 'Bazaar',
    cost: 5,
    types: ['ACTION'],
    coins: 1,
    vp: 0,
    actions: 2,
    buys: 0,
    cards: 1,
    description: '+1 Card, +2 Actions, +1 Coin.',
  },
  blockade: {
    id: 'blockade',
    name: 'Blockade',
    cost: 4,
    types: ['ACTION', 'ATTACK', 'DURATION'],
    coins: 0,
    vp: 0,
    actions: 0,
    buys: 0,
    cards: 0,
    customEffectId: 'BLOCKADE',
    description:
      "Gain a card costing up to 4, setting it aside. At the start of next turn, put it into your hand. While it's set aside, when another player gains a copy of it on their turn, they gain a Curse.",
  },
  caravan: {
    id: 'caravan',
    name: 'Caravan',
    cost: 4,
    types: ['ACTION', 'DURATION'],
    coins: 0,
    vp: 0,
    actions: 1,
    buys: 0,
    cards: 1,
    customEffectId: 'CARAVAN',
    description: '+1 Card, +1 Action. At the start of your next turn, +1 Card.',
  },
  corsair: {
    id: 'corsair',
    name: 'Corsair',
    cost: 5,
    types: ['ACTION', 'DURATION', 'ATTACK'],
    coins: 2,
    vp: 0,
    actions: 0,
    buys: 0,
    cards: 0,
    customEffectId: 'CORSAIR',
    description:
      'At the start of your next turn, +1 Card. Until then, each other player trashes the first Silver or Gold they play each turn.',
  },
  cutpurse: {
    id: 'cutpurse',
    name: 'Cutpurse',
    cost: 4,
    types: ['ACTION', 'ATTACK'],
    coins: 2,
    vp: 0,
    actions: 0,
    buys: 0,
    cards: 0,
    customEffectId: 'CUTPURSE',
    description:
      '+2 Coins. Each other player discards a Copper (or reveals a hand with no Copper).',
  },
  embargo: {
    id: 'embargo',
    name: 'Embargo',
    cost: 2,
    types: ['ACTION'],
    coins: 2,
    vp: 0,
    actions: 0,
    buys: 0,
    cards: 0,
    customEffectId: 'EMBARGO',
    description:
      '+2 Coins. Trash this. Add an Embargo token to a Supply pile. (For the rest of the game, when a player buys a card from that pile, they gain a Curse.)',
  },
  explorer: {
    id: 'explorer',
    name: 'Explorer',
    cost: 5,
    types: ['ACTION'],
    coins: 0,
    vp: 0,
    actions: 0,
    buys: 0,
    cards: 0,
    customEffectId: 'EXPLORER',
    description:
      "You may reveal a Province from your hand. If you do, gain a Gold to your hand. If you don't, gain a Silver to your hand.",
  },
  fishing_village: {
    id: 'fishing_village',
    name: 'Fishing Village',
    cost: 3,
    types: ['ACTION', 'DURATION'],
    coins: 1,
    vp: 0,
    actions: 2,
    buys: 0,
    cards: 0,
    customEffectId: 'FISHING_VILLAGE',
    description:
      '+2 Actions, +1 Coin. At the start of your next turn: +1 Action and +1 Coin.',
  },
  ghost_ship: {
    id: 'ghost_ship',
    name: 'Ghost Ship',
    cost: 5,
    types: ['ACTION', 'ATTACK'],
    coins: 0,
    vp: 0,
    actions: 0,
    buys: 0,
    cards: 2,
    customEffectId: 'GHOST_SHIP',
    description:
      '+2 Cards. Each other player with 4 or more cards in hand puts cards from their hand onto their deck until they have 3 cards in hand.',
  },
  haven: {
    id: 'haven',
    name: 'Haven',
    cost: 2,
    types: ['ACTION', 'DURATION'],
    coins: 0,
    vp: 0,
    actions: 1,
    buys: 0,
    cards: 1,
    customEffectId: 'HAVEN',
    description:
      '+1 Card, +1 Action. Set aside a card from your hand face down (under this). At the start of your next turn, put it into your hand.',
  },
  island: {
    id: 'island',
    name: 'Island',
    cost: 4,
    types: ['ACTION', 'VICTORY'],
    coins: 0,
    vp: 2,
    actions: 0,
    buys: 0,
    cards: 0,
    customEffectId: 'ISLAND',
    description: '+2 VP. Put this and a card from your hand onto your Island mat.',
  },
  lighthouse: {
    id: 'lighthouse',
    name: 'Lighthouse',
    cost: 2,
    types: ['ACTION', 'DURATION'],
    coins: 1,
    vp: 0,
    actions: 1,
    buys: 0,
    cards: 0,
    customEffectId: 'LIGHTHOUSE',
    description:
      "+1 Action. Now and at the start of your next turn +1 Coin. While this is in play, when another player plays an Attack card, it doesn't affect you.",
  },
  lookout: {
    id: 'lookout',
    name: 'Lookout',
    cost: 3,
    types: ['ACTION'],
    coins: 0,
    vp: 0,
    actions: 1,
    buys: 0,
    cards: 0,
    customEffectId: 'LOOKOUT',
    description:
      '+1 Action. Look at the top 3 cards of your deck. Trash one of them. Discard one of them. Put the other one back on top of your deck.',
  },
  merchant_ship: {
    id: 'merchant_ship',
    name: 'Merchant Ship',
    cost: 5,
    types: ['ACTION', 'DURATION'],
    coins: 2,
    vp: 0,
    actions: 0,
    buys: 0,
    cards: 0,
    customEffectId: 'MERCHANT_SHIP',
    description: 'Now and at the start of your next turn: +2 Coins.',
  },
  monkey: {
    id: 'monkey',
    name: 'Monkey',
    cost: 3,
    types: ['ACTION', 'DURATION'],
    coins: 0,
    vp: 0,
    actions: 0,
    buys: 0,
    cards: 0,
    customEffectId: 'MONKEY',
    description:
      'Until your next turn, when the player to your right gains a card, +1 Card. At the start of your next turn +1 Card.',
  },
  native_village: {
    id: 'native_village',
    name: 'Native Village',
    cost: 2,
    types: ['ACTION'],
    coins: 0,
    vp: 0,
    actions: 2,
    buys: 0,
    cards: 0,
    customEffectId: 'NATIVE_VILLAGE',
    description:
      '+2 Actions. Choose one: Put the top card of your deck face down on your Native Village mat (you may look at those cards at any time); or put all the cards from your mat into your hand.',
  },
  navigator: {
    id: 'navigator',
    name: 'Navigator',
    cost: 4,
    types: ['ACTION'],
    coins: 2,
    vp: 0,
    actions: 0,
    buys: 0,
    cards: 0,
    customEffectId: 'NAVIGATOR',
    description:
      '+2 Coins. Look at the top 5 cards of your deck. Either discard them all, or put them back in any order.',
  },
  outpost: {
    id: 'outpost',
    name: 'Outpost',
    cost: 5,
    types: ['ACTION', 'DURATION'],
    coins: 0,
    vp: 0,
    actions: 0,
    buys: 0,
    cards: 0,
    customEffectId: 'OUTPOST',
    description:
      "If this is the first time you played an Outpost this turn, and the previous turn wasn't yours, then take an extra turn after this one, and you only draw 3 cards for your next hand.",
  },
  pearl_diver: {
    id: 'pearl_diver',
    name: 'Pearl Diver',
    cost: 2,
    types: ['ACTION'],
    coins: 0,
    vp: 0,
    actions: 1,
    buys: 0,
    cards: 1,
    customEffectId: 'PEARL_DIVER',
    description:
      '+1 Card, +1 Action. Look at the bottom card of your deck. You may put it on top.',
  },
  pirate: {
    id: 'pirate',
    name: 'Pirate',
    cost: 5,
    types: ['ACTION', 'DURATION', 'REACTION'],
    coins: 0,
    vp: 0,
    actions: 0,
    buys: 0,
    cards: 0,
    customEffectId: 'PIRATE',
    description:
      'At the start of your next turn gain a Treasure costing up to 6 to your hand. When any player gains a Treasure, you may play this from your hand.',
  },
  pirate_ship: {
    id: 'pirate_ship',
    name: 'Pirate Ship',
    cost: 4,
    types: ['ACTION', 'ATTACK'],
    coins: 0,
    vp: 0,
    actions: 0,
    buys: 0,
    cards: 0,
    customEffectId: 'PIRATE_SHIP',
    description:
      'Choose one: +1 Coin per Gold Coin token on your Pirate Ship mat; or each other player reveals the top 2 cards of their deck, trashes one of those Treasures that you choose, and discards the rest, and then if anyone trashed a Treasure you add a Gold Coin token to your Pirate Ship mat.',
  },
  sailor: {
    id: 'sailor',
    name: 'Sailor',
    cost: 4,
    types: ['ACTION', 'DURATION'],
    coins: 0,
    vp: 0,
    actions: 1,
    buys: 0,
    cards: 0,
    customEffectId: 'SAILOR',
    description:
      '+1 Action. Once this turn, when you gain a Duration card, you may play it. At the start of your next turn +2 Coins and you may trash a card from your hand.',
  },
  salvager: {
    id: 'salvager',
    name: 'Salvager',
    cost: 4,
    types: ['ACTION'],
    coins: 0,
    vp: 0,
    actions: 0,
    buys: 1,
    cards: 0,
    customEffectId: 'SALVAGER',
    description:
      '+1 Buy. Trash a card from your hand. +1 Coin per 1 it costs.',
  },
  sea_chart: {
    id: 'sea_chart',
    name: 'Sea Chart',
    cost: 3,
    types: ['ACTION'],
    coins: 0,
    vp: 0,
    actions: 1,
    buys: 0,
    cards: 1,
    customEffectId: 'SEA_CHART',
    description:
      '+1 Card, +1 Action. Reveal the top card of your deck. If you have a copy of it in play, put it into your hand.',
  },
  sea_hag: {
    id: 'sea_hag',
    name: 'Sea Hag',
    cost: 4,
    types: ['ACTION', 'ATTACK'],
    coins: 0,
    vp: 0,
    actions: 0,
    buys: 0,
    cards: 0,
    customEffectId: 'SEA_HAG',
    description:
      'Each other player discards the top card of their deck, then gains a Curse onto their deck.',
  },
  sea_witch: {
    id: 'sea_witch',
    name: 'Sea Witch',
    cost: 5,
    types: ['ACTION', 'DURATION', 'ATTACK'],
    coins: 0,
    vp: 0,
    actions: 0,
    buys: 0,
    cards: 2,
    customEffectId: 'SEA_WITCH',
    description:
      '+2 Cards. Each other player gains a Curse. At the start of your next turn, +2 Cards, then discard 2 cards.',
  },
  smugglers: {
    id: 'smugglers',
    name: 'Smugglers',
    cost: 3,
    types: ['ACTION'],
    coins: 0,
    vp: 0,
    actions: 0,
    buys: 0,
    cards: 0,
    customEffectId: 'SMUGGLERS',
    description:
      'Gain a copy of a card costing up to 6 that the player to your right gained on their last turn.',
  },
  tactician: {
    id: 'tactician',
    name: 'Tactician',
    cost: 5,
    types: ['ACTION', 'DURATION'],
    coins: 0,
    vp: 0,
    actions: 0,
    buys: 0,
    cards: 0,
    customEffectId: 'TACTICIAN',
    description:
      'If you have at least one card in hand, discard your hand, and at the start of your next turn, +5 Cards, +1 Action, and +1 Buy.',
  },
  tide_pools: {
    id: 'tide_pools',
    name: 'Tide Pools',
    cost: 4,
    types: ['ACTION', 'DURATION'],
    coins: 0,
    vp: 0,
    actions: 1,
    buys: 0,
    cards: 3,
    customEffectId: 'TIDE_POOLS',
    description: '+3 Cards, +1 Action. At the start of your next turn, discard 2 cards.',
  },
  treasure_map: {
    id: 'treasure_map',
    name: 'Treasure Map',
    cost: 4,
    types: ['ACTION'],
    coins: 0,
    vp: 0,
    actions: 0,
    buys: 0,
    cards: 0,
    customEffectId: 'TREASURE_MAP',
    description:
      'Trash this and a Treasure Map from your hand. If you trashed two Treasure Maps, gain 4 Golds onto your deck.',
  },
  treasury: {
    id: 'treasury',
    name: 'Treasury',
    cost: 5,
    types: ['ACTION'],
    coins: 1,
    vp: 0,
    actions: 1,
    buys: 0,
    cards: 1,
    customEffectId: 'TREASURY',
    description:
      "+1 Card, +1 Action, +1 Coin. When you discard this from play, if you didn't buy a Victory card this turn, you may put this onto your deck.",
  },
  warehouse: {
    id: 'warehouse',
    name: 'Warehouse',
    cost: 3,
    types: ['ACTION'],
    coins: 0,
    vp: 0,
    actions: 1,
    buys: 0,
    cards: 3,
    customEffectId: 'WAREHOUSE',
    description: '+3 Cards, +1 Action. Discard 3 cards.',
  },
  wharf: {
    id: 'wharf',
    name: 'Wharf',
    cost: 5,
    types: ['ACTION', 'DURATION'],
    coins: 0,
    vp: 0,
    actions: 0,
    buys: 1,
    cards: 2,
    customEffectId: 'WHARF',
    description:
      'Now and at the start of your next turn: +2 Cards and +1 Buy.',
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

/**
 * The 6 1st Edition Base Dominion Kingdom cards.
 */
export const FIRST_EDITION_BASE_KINGDOM_CARD_IDS: readonly string[] = [
  'adventurer',
  'chancellor',
  'feast',
  'spy',
  'thief',
  'woodcutter',
];

/**
 * All 35 Seaside Kingdom cards (26 1st Edition + 9 2nd Edition).
 */
export const SEASIDE_KINGDOM_CARD_IDS: readonly string[] = [
  'ambassador',
  'astrolabe',
  'bazaar',
  'blockade',
  'caravan',
  'corsair',
  'cutpurse',
  'embargo',
  'explorer',
  'fishing_village',
  'ghost_ship',
  'haven',
  'island',
  'lighthouse',
  'lookout',
  'merchant_ship',
  'monkey',
  'native_village',
  'navigator',
  'outpost',
  'pearl_diver',
  'pirate',
  'pirate_ship',
  'sailor',
  'salvager',
  'sea_chart',
  'sea_hag',
  'sea_witch',
  'smugglers',
  'tactician',
  'tide_pools',
  'treasure_map',
  'treasury',
  'warehouse',
  'wharf',
];

export interface DominionPresetGame {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly cards: readonly string[];
  readonly expansion?: 'base' | 'seaside';
}

export const DOMINION_PRESET_GAMES: readonly DominionPresetGame[] = [
  {
    id: 'base_game',
    name: 'Base Game',
    expansion: 'base',
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
    expansion: 'base',
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
    expansion: 'base',
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
    expansion: 'base',
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
    expansion: 'base',
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
    expansion: 'base',
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

  // =========================================================================
  // SEASIDE EXPANSION PRESET GAMES
  // =========================================================================
  {
    id: 'high_seas_1st_edition',
    name: 'High Seas 1st Edition',
    expansion: 'seaside',
    description:
      'High Seas is a fast-paced setup built around chaining Duration cards for massive draw engines while navigating aggressive pirate attacks and supply taxes: Bazaar, Caravan, Embargo, Explorer, Haven, Island, Lookout, Pirate Ship, Smugglers, Wharf.',
    cards: [
      'bazaar',
      'caravan',
      'embargo',
      'explorer',
      'haven',
      'island',
      'lookout',
      'pirate_ship',
      'smugglers',
      'wharf',
    ],
  },
  {
    id: 'high_seas_2nd_edition',
    name: 'High Seas 2nd Edition',
    expansion: 'seaside',
    description:
      'High Seas is a fast-paced setup built around chaining Duration cards for massive draw engines while navigating aggressive pirate attacks and supply taxes: Bazaar, Blockade, Caravan, Corsair, Haven, Island, Lookout, Pirate, Warehouse, Wharf.',
    cards: [
      'bazaar',
      'blockade',
      'caravan',
      'corsair',
      'haven',
      'island',
      'lookout',
      'pirate',
      'warehouse',
      'wharf',
    ],
  },
  {
    id: 'buried_treasure_1st_edition',
    name: 'High Seas 1st Edition',
    expansion: 'seaside',
    description:
      'Buried Treasure is a swingy, combo-driven setup built around hunting for Treasure Map Gold windfalls while chaining extra turns and hand-cycling Duration cards: Ambassador, Cutpurse, Fishing Village, Lighthouse, Outpost, Pearl Diver, Tactician, Treasure Map, Warehouse, Wharf.',
    cards: [
      'ambassador',
      'cutpurse',
      'fishing_village',
      'lighthouse',
      'outpost',
      'pearl_diver',
      'tactician',
      'treasure_map',
      'warehouse',
      'wharf',
    ],
  },
  {
    id: 'buried_treasure_2nd_edition',
    name: 'High Seas 2nd Edition',
    expansion: 'seaside',
    description:
      'Buried Treasure is a swingy, combo-driven setup built around hunting for Treasure Map Gold windfalls while chaining extra turns and hand-cycling Duration cards: Astrolabe, Cutpurse, Fishing Village, Lighthouse, Monkey, Outpost, Sailor, Sea Chart, Tactician, Treasure Map.',
    cards: [
      'astrolabe',
      'cutpurse',
      'fishing_village',
      'lighthouse',
      'monkey',
      'outpost',
      'sailor',
      'sea_chart',
      'tactician',
      'treasure_map',
    ],
  },
  {
    id: 'shipwrecks',
    name: 'Shipwrecks 1st Edition',
    expansion: 'seaside',
    description:
      'Shipwrecks is a gritty, tactical setup built around trashing curses and junk with Salvager while maneuvering through deck-clogging attacks and top-deck manipulation: Ghost Ship, Merchant Ship, Native Village, Navigator, Pearl Diver, Salvager, Sea Hag, Smugglers, Treasury, Warehouse.',
    cards: [
      'ghost_ship',
      'merchant_ship',
      'native_village',
      'navigator',
      'pearl_diver',
      'salvager',
      'sea_hag',
      'smugglers',
      'treasury',
      'warehouse',
    ],
  },
  {
    id: 'reach_for_tomorrow_1st_edition',
    name: 'Reach for Tomorrow 1st Edition',
    expansion: 'seaside',
    description:
      'Reach for Tomorrow is a fast-cycling setup built around chaining Villages and heavy draw cards to line up Treasure Map Gold windfalls while weathering Curse and hand-disruption attacks: Cutpurse, Ghost Ship, Lookout, Sea Hag, Treasure Map, Artisan, Cellar, Council Room, Vassal, Village.',
    cards: [
      'cutpurse',
      'ghost_ship',
      'lookout',
      'sea_hag',
      'treasure_map',
      'artisan',
      'cellar',
      'council_room',
      'vassal',
      'village',
    ],
  },
  {
    id: 'reach_for_tomorrow_classic_edition',
    name: 'Reach for Tomorrow Classic Edition',
    expansion: 'seaside',
    description:
      'Reach for Tomorrow is a fast-cycling setup built around chaining Villages and heavy draw cards to line up Treasure Map Gold windfalls while weathering Curse and hand-disruption attacks: Cutpurse, Ghost Ship, Lookout, Sea Hag, Treasure Map, Adventurer, Cellar, Council Room, Spy, Village.',
    cards: [
      'cutpurse',
      'ghost_ship',
      'lookout',
      'sea_hag',
      'treasure_map',
      'adventurer',
      'cellar',
      'council_room',
      'spy',
      'village',
    ],
  },
  {
    id: 'reach_for_tomorrow_1.5_edition',
    name: 'Reach for Tomorrow 1.5 Edition',
    expansion: 'seaside',
    description:
      'Reach for Tomorrow is a fast-cycling setup built around chaining Villages and heavy draw cards to line up Treasure Map Gold windfalls while weathering Curse and hand-disruption attacks: Cutpurse, Lookout, Monkey, Sea Witch, Treasure Map, Adventurer, Cellar, Council Room, Spy, Village.',
    cards: [
      'cutpurse',
      'lookout',
      'monkey',
      'sea_witch',
      'treasure_map',
      'adventurer',
      'cellar',
      'council_room',
      'spy',
      'village',
    ],
  },
  {
    id: 'reach_for_tomorrow_2nd_edition',
    name: 'Reach for Tomorrow 2nd Edition',
    expansion: 'seaside',
    description:
      'Reach for Tomorrow is a fast-cycling setup built around chaining Villages and heavy draw cards to line up Treasure Map Gold windfalls while weathering Curse and hand-disruption attacks: Cutpurse, Lookout, Monkey, Sea Witch, Treasure Map, Artisan, Cellar, Council Room, Vassal, Village.',
    cards: [
      'cutpurse',
      'lookout',
      'monkey',
      'sea_witch',
      'treasure_map',
      'artisan',
      'cellar',
      'council_room',
      'vassal',
      'village',
    ],
  },
  {
    id: 'repetition_classic',
    name: 'Repetition Classic Edition',
    expansion: 'seaside',
    description:
      'A rhythmic combo setup built around looping key cards back onto the top of your deck, chaining extra turns with Outpost, and generating steady coin.: Chancellor, Festival, Militia, Workshop, Caravan, Explorer, Outpost, Pearl Diver, Pirate Ship, Treasury.',
    cards: [
      'chancellor',
      'festival',
      'militia',
      'workshop',
      'caravan',
      'explorer',
      'outpost',
      'pearl_diver',
      'pirate_ship',
      'treasury',
    ],
  },
  {
    id: 'repetition_classic_redux',
    name: 'Repetition Classic Redux Edition',
    expansion: 'seaside',
    description:
      'A rhythmic combo setup built around looping key cards back onto the top of your deck, chaining extra turns with Outpost, and generating steady coin.: Festival, Militia, Spy, Workshop, Caravan, Explorer, Outpost, Pearl Diver, Pirate Ship, Treasury.',
    cards: [
      'festival',
      'militia',
      'spy',
      'workshop',
      'caravan',
      'explorer',
      'outpost',
      'pearl_diver',
      'pirate_ship',
      'treasury',
    ],
  },
  {
    id: 'repetition_neo_classic',
    name: 'Repetition Neo Classic Edition',
    expansion: 'seaside',
    description:
      'A rhythmic combo setup built around looping key cards back onto the top of your deck, chaining extra turns with Outpost, and generating steady coin.: Festival, Harbinger, Militia, Workshop, Caravan, Explorer, Outpost, Pearl Diver, Pirate Ship, Treasury.',
    cards: [
      'festival',
      'harbinger',
      'militia',
      'workshop',
      'caravan',
      'explorer',
      'outpost',
      'pearl_diver',
      'pirate_ship',
      'treasury',
    ],
  },
  {
    id: 'repetition_2nd_edition',
    name: 'Repetition 2nd Edition',
    expansion: 'seaside',
    description:
      'A rhythmic combo setup built around looping key cards back onto the top of your deck, chaining extra turns with Outpost, and generating steady coin.: Festival, Harbinger, Militia, Remodel, Workshop, Caravan, Outpost, Pirate, Sea Chart, Treasury.',
    cards: [
      'festival',
      'harbinger',
      'militia',
      'remodel',
      'workshop',
      'caravan',
      'outpost',
      'pirate',
      'sea_chart',
      'treasury',
    ],
  },
  {
    id: 'give_and_take',
    name: 'Give and Take',
    expansion: 'seaside',
    description:
      'A highly interactive, back-and-forth setup centered on trading cards with opponents using Ambassador and Smugglers while managing hand sizes and trashing junk: Library, Market, Moneylender, Witch, Ambassador, Fishing Village, Haven, Island, Salvager, Smugglers.',
    cards: [
      'library',
      'market',
      'moneylender',
      'witch',
      'ambassador',
      'fishing_village',
      'haven',
      'island',
      'salvager',
      'smugglers',
    ],
  },
];

/**
 * Returns the pool of available Kingdom card IDs based on selected expansions.
 */
export function getAvailableDominionKingdomPool(
  selectedExpansions: readonly string[] | undefined
): readonly string[] {
  const tokens = selectedExpansions ?? [];
  const hasSeaside =
    tokens.includes('seaside') || tokens.includes('exp:seaside');
  const hasFirstEd =
    tokens.includes('base_1st_edition') ||
    tokens.includes('exp:base_1st_edition');

  const pool = [...ALL_BASE_KINGDOM_CARD_IDS];
  if (hasFirstEd || hasSeaside) {
    for (const cid of FIRST_EDITION_BASE_KINGDOM_CARD_IDS) {
      if (!pool.includes(cid)) {
        pool.push(cid);
      }
    }
  }
  if (hasSeaside) {
    for (const cid of SEASIDE_KINGDOM_CARD_IDS) {
      if (!pool.includes(cid)) {
        pool.push(cid);
      }
    }
  }
  return pool;
}

/**
 * Resolves the 10 Kingdom card IDs from lobby `selectedExpansions` tokens and seed:
 * - `'mode:random'`: Randomly selects 10 cards from the available Kingdom pool using `seed`.
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
    const pool = getAvailableDominionKingdomPool(tokens);
    const shuffled = shuffleArray(pool, prng).value;
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
