export type DeckType = 'general_store' | 'property_deed' | 'doc_badluck';

export type CardTiming =
  | 'INSTANT'
  | 'ON_REVEAL_DICE'
  | 'ON_GOLD_MINE'
  | 'ON_BANK_ROBBERY'
  | 'ON_GENERAL_STORE'
  | 'ON_SALOON'
  | 'ON_SHERIFF'
  | 'ON_TOWN_HALL'
  | 'ON_DOC_BADLUCK'
  | 'REACTION_STORE_CARD'
  | 'PASSIVE_END_GAME';

export interface DiceTownCard {
  id: string;
  deck: DeckType;
  displayName: string;
  vp: number;
  timing: CardTiming;
  effectType: string;
  effectParams?: Record<string, number | string>;
  description: string;
}

// ============================================================================
// 1. GENERAL STORE DECK (19 Cards Total)
// ============================================================================
export const GENERAL_STORE_CARDS: DiceTownCard[] = [
  // --- Equipment Cards (6 Cards: 1, 2, 3, 4, 6, 8 VP) ---
  {
    id: 'store_equip_1vp_01',
    deck: 'general_store',
    displayName: 'Equipment (1 VP) Boots',
    vp: 1,
    timing: 'PASSIVE_END_GAME',
    effectType: 'FLAT_VP',
    description: 'Worth 1 Victory Point at the end of the game.',
  },
  {
    id: 'store_equip_2vp_01',
    deck: 'general_store',
    displayName: 'Equipment (2 VP) Spurs',
    vp: 2,
    timing: 'PASSIVE_END_GAME',
    effectType: 'FLAT_VP',
    description: 'Worth 2 Victory Points at the end of the game.',
  },
  {
    id: 'store_equip_3vp_01',
    deck: 'general_store',
    displayName: 'Equipment (3 VP) Stetson',
    vp: 3,
    timing: 'PASSIVE_END_GAME',
    effectType: 'FLAT_VP',
    description: 'Worth 3 Victory Points at the end of the game.',
  },
  {
    id: 'store_equip_4vp_01',
    deck: 'general_store',
    displayName: 'Equipment (4 VP) Pistol',
    vp: 4,
    timing: 'PASSIVE_END_GAME',
    effectType: 'FLAT_VP',
    description: 'Worth 4 Victory Points at the end of the game.',
  },
  {
    id: 'store_equip_6vp_01',
    deck: 'general_store',
    displayName: 'Equipment (5 VP) Wagon',
    vp: 6,
    timing: 'PASSIVE_END_GAME',
    effectType: 'FLAT_VP',
    description: 'Worth 5 Victory Points at the end of the game.',
  },
  {
    id: 'store_equip_8vp_01',
    deck: 'general_store',
    displayName: 'Equipment (8 VP) Horse',
    vp: 8,
    timing: 'PASSIVE_END_GAME',
    effectType: 'FLAT_VP',
    description: 'Worth 8 Victory Points at the end of the game.',
  },

  // --- Action Cards (13 Cards: 2x Brute, 2x Professional Cheater, 9x Unique) ---
  {
    id: 'store_the_brute_01',
    deck: 'general_store',
    displayName: 'The Brute',
    vp: 0,
    timing: 'ON_REVEAL_DICE',
    effectType: 'FREE_KEEP_EXTRA_DICE',
    description:
      'Play when you reveal the dice you kept. Keep more than one die without paying any dollars.',
  },
  {
    id: 'store_the_brute_02',
    deck: 'general_store',
    displayName: 'The Brute',
    vp: 0,
    timing: 'ON_REVEAL_DICE',
    effectType: 'FREE_KEEP_EXTRA_DICE',
    description:
      'Play when you reveal the dice you kept. Keep more than one die without paying any dollars.',
  },
  {
    id: 'store_professional_cheater_01',
    deck: 'general_store',
    displayName: 'Professional Cheater',
    vp: 0,
    timing: 'ON_REVEAL_DICE',
    effectType: 'SET_DIE_FACE',
    description:
      'Play when you reveal the dice you kept. Turn one of those dice to a face of your choice.',
  },
  {
    id: 'store_professional_cheater_02',
    deck: 'general_store',
    displayName: 'Professional Cheater',
    vp: 0,
    timing: 'ON_REVEAL_DICE',
    effectType: 'SET_DIE_FACE',
    description:
      'Play when you reveal the dice you kept. Turn one of those dice to a face of your choice.',
  },
  {
    id: 'store_dynamite_01',
    deck: 'general_store',
    displayName: 'Dynamite',
    vp: 0,
    timing: 'ON_GOLD_MINE',
    effectType: 'DOUBLE_NUGGETS',
    description:
      'Play when you exploit the Gold Mine. Gain twice as many gold nuggets as you normally would.',
  },
  {
    id: 'store_the_girls_01',
    deck: 'general_store',
    displayName: 'The Girls',
    vp: 0,
    timing: 'ON_SALOON',
    effectType: 'DOUBLE_SALOON_ACTION',
    description:
      'Play when you steal at the Saloon. Perform the Saloon action twice in a row (same or different players).',
  },
  {
    id: 'store_unlimited_credit_01',
    deck: 'general_store',
    displayName: 'Unlimited Credit',
    vp: 0,
    timing: 'ON_GENERAL_STORE',
    effectType: 'DOUBLE_STORE_ACTION',
    description:
      'Play when you visit the General Store. Perform the General Store action twice this round.',
  },
  {
    id: 'store_corruption_01',
    deck: 'general_store',
    displayName: 'Corruption',
    vp: 0,
    timing: 'ON_TOWN_HALL',
    effectType: 'BONUS_BLIND_DEED',
    description:
      'Play when rewarded at Town Hall. Also take the top face-down Property Deed from the deck without revealing it.',
  },
  {
    id: 'store_nervous_joe_01',
    deck: 'general_store',
    displayName: 'Nervous Joe',
    vp: 0,
    timing: 'INSTANT',
    effectType: 'STEAL_DOLLARS',
    effectParams: { amount: 4 },
    description: 'Play immediately. A player of your choice must give you $4.',
  },
  {
    id: 'store_marshall_01',
    deck: 'general_store',
    displayName: 'Marshall',
    vp: 0,
    timing: 'ON_SHERIFF',
    effectType: 'RETAIN_SHERIFF',
    description:
      'Play when the Sheriff action is resolved. The previous Sheriff keeps the Sheriff Badge for the next round.',
  },
  {
    id: 'store_even_split_01',
    deck: 'general_store',
    displayName: 'Even Split',
    vp: 0,
    timing: 'ON_BANK_ROBBERY',
    effectType: 'SPLIT_BANK_HEIST',
    description:
      'Play whenever an opponent robs the Bank. That player must give you half of the stolen bills (rounded down).',
  },
  {
    id: 'store_wanted_01',
    deck: 'general_store',
    displayName: 'Wanted',
    vp: 0,
    timing: 'REACTION_STORE_CARD',
    effectType: 'CANCEL_STORE_CARD',
    description:
      'Play when another player plays a General Store card. The effect of that card is nullified.',
  },
  {
    id: 'store_doc_badlucks_elixir_01',
    deck: 'general_store',
    displayName: "Doc Badluck's Elixir",
    vp: 0,
    timing: 'ON_DOC_BADLUCK',
    effectType: 'TRIGGER_DOC_BADLUCK',
    description:
      'Play when Doc Badluck is resolved. Visit Doc Badluck even if you controlled a town location this round.',
  },
];

// ============================================================================
// 2. PROPERTY DEED DECK (20 Cards Total: 1 VP to 5 VP)
// ============================================================================
// Standard distribution: 5x 1VP, 5x 2VP, 4x 3VP, 3x 4VP, 3x 5VP (Total = 20 cards)
const PROPERTY_DEED_DISTRIBUTION: Array<{ vp: number; count: number }> = [
  { vp: 1, count: 5 },
  { vp: 2, count: 5 },
  { vp: 3, count: 4 },
  { vp: 4, count: 3 },
  { vp: 5, count: 3 },
];

export const PROPERTY_DEED_CARDS: DiceTownCard[] =
  PROPERTY_DEED_DISTRIBUTION.flatMap(({ vp, count }) =>
    Array.from({ length: count }, (_, idx) => ({
      id: `deed_${vp}vp_${String(idx + 1).padStart(2, '0')}`,
      deck: 'property_deed' as const,
      displayName: `Property Deed (${vp} VP)`,
      vp,
      timing: 'PASSIVE_END_GAME' as const,
      effectType: 'FLAT_VP',
      description: `Worth ${vp} Victory Point${vp > 1 ? 's' : ''} at the end of the game.`,
    }))
  );

// ============================================================================
// 3. DOC BADLUCK ELIXIR DECK (7 Cards Total - 2nd Edition / Revised Rules)
// ============================================================================
export const DOC_BADLUCK_CARDS: DiceTownCard[] = [
  {
    id: 'badluck_wealth_01',
    deck: 'doc_badluck',
    displayName: 'Elixir of Wealth',
    vp: 0,
    timing: 'ON_DOC_BADLUCK',
    effectType: 'COLLECT_FROM_ALL_DOLLARS',
    effectParams: { amount: 2 },
    description:
      'Each other player must give you $2 (or all they have if less than $2).',
  },
  {
    id: 'badluck_charm_01',
    deck: 'doc_badluck',
    displayName: 'Elixir of Charm',
    vp: 0,
    timing: 'ON_DOC_BADLUCK',
    effectType: 'COLLECT_FROM_ALL_NUGGETS',
    effectParams: { amount: 1 },
    description:
      'Each other player must give you 1 gold nugget (if they have any).',
  },
  {
    id: 'badluck_fortune_01',
    deck: 'doc_badluck',
    displayName: 'Elixir of Fortune',
    vp: 0,
    timing: 'ON_DOC_BADLUCK',
    effectType: 'DRAW_GENERAL_STORE',
    effectParams: { count: 1 },
    description: 'Draw the top card of the General Store deck into your hand.',
  },
  {
    id: 'badluck_power_01',
    deck: 'doc_badluck',
    displayName: 'Elixir of Power',
    vp: 0,
    timing: 'ON_DOC_BADLUCK',
    effectType: 'CLAIM_SHERIFF',
    description: 'Take the Sheriff Badge. You immediately become the new Sheriff.',
  },
  {
    id: 'badluck_protection_01',
    deck: 'doc_badluck',
    displayName: 'Elixir of Protection',
    vp: 0,
    timing: 'ON_DOC_BADLUCK',
    effectType: 'PROTECT_PROPERTY_DEEDS',
    effectParams: { maxCards: 2 },
    description:
      'Place up to 2 Property Deeds from your hand face-up in front of you. They can no longer be stolen.',
  },
  {
    id: 'badluck_friendship_01',
    deck: 'doc_badluck',
    displayName: 'Elixir of Friendship',
    vp: 0,
    timing: 'ON_DOC_BADLUCK',
    effectType: 'DEMAND_GENERAL_STORE_CARD',
    description:
      'A player of your choice must choose and give you 1 of their General Store cards.',
  },
  {
    id: 'badluck_domination_01',
    deck: 'doc_badluck',
    displayName: 'Elixir of Domination',
    vp: 0,
    timing: 'ON_DOC_BADLUCK',
    effectType: 'DEMAND_PROPERTY_DEED',
    description:
      'A player of your choice must choose and give you 1 of their hidden Property Deeds.',
  },
];
