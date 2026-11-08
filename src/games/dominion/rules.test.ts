import { describe, expect, it } from 'vitest';
import {
  applyAction,
  calculateDominionFinalScores,
  calculatePlayerVictoryPoints,
  DOMINION_CARDS,
  drawCardsForPlayer,
  getPlayerPerspective,
  initGame,
  validateAction,
} from './index.js';

function c(id: string) {
  const card = DOMINION_CARDS[id];
  if (!card) {
    throw new Error(`Card "${id}" not found in DOMINION_CARDS.`);
  }
  return card;
}

describe('Dominion Core Engine (Base Game 2-4P State Machine, Deck Cycling & Card Pipeline)', () => {
  // ---------------------------------------------------------------------------
  // 1. Setup, Supply Scaling & Recycle Shuffling
  // ---------------------------------------------------------------------------
  describe('1. Setup, Supply Scaling & Recycle Shuffling', () => {
    it('scales Victory & Curse Supply piles by player count and deals 7 Coppers + 3 Estates (5 to hand, 5 in deck)', () => {
      const state2p = initGame(['p1', 'p2'], 101);
      expect(state2p.supply['estate']).toBe(8);
      expect(state2p.supply['duchy']).toBe(8);
      expect(state2p.supply['province']).toBe(8);
      expect(state2p.supply['curse']).toBe(10);

      const state4p = initGame(['p1', 'p2', 'p3', 'p4'], 101);
      expect(state4p.supply['estate']).toBe(12);
      expect(state4p.supply['duchy']).toBe(12);
      expect(state4p.supply['province']).toBe(12);
      expect(state4p.supply['curse']).toBe(30);

      for (const pid of ['p1', 'p2']) {
        const p = state2p.players[pid]!;
        expect(p.hand).toHaveLength(5);
        expect(p.deck).toHaveLength(5);
        expect(p.discard).toHaveLength(0);
        expect(p.inPlay).toHaveLength(0);
        // 3 Estates in initial 10-card deck = 3 VP
        expect(calculatePlayerVictoryPoints(p)).toBe(3);
      }

      // Verify getPlayerPerspective hides opponent hand identities and deck order
      const p1View = getPlayerPerspective(state2p, 'p1');
      expect(p1View.self.hand).toHaveLength(5);
      expect(p1View.self.handCount).toBe(5);
      expect(p1View.self.deckCount).toBe(5);
      expect(p1View.opponents['p2']!.hand).toHaveLength(0);
      expect(p1View.opponents['p2']!.handCount).toBe(5);
      expect(p1View.opponents['p2']!.deckCount).toBe(5);
    });

    it('recycles and shuffles the Discard pile into the Deck when drawing past an empty Deck, and fails silently when both are empty', () => {
      const state = initGame(['p1', 'p2'], 2026);
      const p1 = {
        ...state.players['p1']!,
        deck: [c('copper')], // Only 1 card left in deck
        hand: [],
        discard: [c('silver'), c('gold'), c('village'), c('smithy')], // 4 cards in discard
      };

      // Draw 3 cards: should draw the 1 Copper from deck, then shuffle the 4 discard cards into deck and draw 2 more!
      const draw3 = drawCardsForPlayer(p1, 3, state.prng);
      expect(draw3.drawn).toHaveLength(3);
      expect(draw3.drawn[0]!.id).toBe('copper');
      expect(draw3.player.hand).toHaveLength(3);
      expect(draw3.player.deck).toHaveLength(2);
      expect(draw3.player.discard).toHaveLength(0);

      // Now try drawing 5 more cards when only 2 cards exist in deck and 0 in discard:
      // Should draw the 2 remaining cards and stop silently without crashing!
      const drawMore = drawCardsForPlayer(draw3.player, 5, draw3.prng);
      expect(drawMore.drawn).toHaveLength(2);
      expect(drawMore.player.hand).toHaveLength(5);
      expect(drawMore.player.deck).toHaveLength(0);
      expect(drawMore.player.discard).toHaveLength(0);
    });
  });

  // ---------------------------------------------------------------------------
  // 2. Action / Buy / Coin Economy & Turn Loop
  // ---------------------------------------------------------------------------
  describe('2. Action / Buy / Coin Economy & Turn Loop', () => {
    it('accurately resolves Village (+1 Card, +2 Actions) followed by Smithy (+3 Cards), Merchant + Silver bonus, buying, and Cleanup', () => {
      let state = initGame(['p1', 'p2'], 303);

      // Configure p1's hand and deck deterministically
      state = {
        ...state,
        players: {
          ...state.players,
          p1: {
            ...state.players['p1']!,
            actions: 1,
            buys: 1,
            coins: 0,
            hand: [
              c('village'),
              c('smithy'),
              c('merchant'),
              c('copper'),
              c('estate'),
            ],
            deck: [
              c('silver'),
              c('copper'),
              c('copper'),
              c('gold'),
              c('estate'),
            ],
            discard: [],
            inPlay: [],
          },
        },
      };

      // 1. Play Village (+1 Card -> draws 'silver', +2 Actions -> 1 - 1 + 2 = 2 Actions)
      state = applyAction(state, 'p1', {
        type: 'PLAY_ACTION_CARD',
        cardId: 'village',
      });
      expect(state.players['p1']!.actions).toBe(2);
      expect(state.players['p1']!.hand).toHaveLength(5); // 5 - 1 (village) + 1 (drawn silver) = 5
      expect(state.players['p1']!.inPlay.map((card) => card.id)).toEqual([
        'village',
      ]);

      // 2. Play Smithy (+3 Cards -> draws 'copper', 'copper', 'gold'; Actions: 2 - 1 = 1)
      state = applyAction(state, 'p1', {
        type: 'PLAY_ACTION_CARD',
        cardId: 'smithy',
      });
      expect(state.players['p1']!.actions).toBe(1);
      expect(state.players['p1']!.hand).toHaveLength(7); // 5 - 1 (smithy) + 3 (drawn) = 7
      expect(state.players['p1']!.inPlay.map((card) => card.id)).toEqual([
        'village',
        'smithy',
      ]);

      // 3. Play Merchant (+1 Card -> draws 'estate', +1 Action -> 1 - 1 + 1 = 1)
      state = applyAction(state, 'p1', {
        type: 'PLAY_ACTION_CARD',
        cardId: 'merchant',
      });
      expect(state.players['p1']!.actions).toBe(1);
      expect(state.players['p1']!.hand).toHaveLength(7);
      expect(state.players['p1']!.merchantsPlayedThisTurn).toBe(1);

      // 4. Play all Treasures in hand:
      // Hand has: 3 Coppers (+3), 1 Silver (+2 + 1 Merchant bonus = +3), 1 Gold (+3) = 9 Coins total!
      state = applyAction(state, 'p1', {
        type: 'PLAY_ALL_TREASURES',
      });
      expect(state.turnPhase).toBe('BUY_TREASURES');
      expect(state.players['p1']!.coins).toBe(9);

      // 5. Buy a Province (cost 8): decrements buys to 0, coins to 1, supply['province'] from 8 to 7, places Province in discard
      state = applyAction(state, 'p1', {
        type: 'BUY_CARD',
        cardId: 'province',
      });
      expect(state.turnPhase).toBe('BUY_CARDS');
      expect(state.players['p1']!.buys).toBe(0);
      expect(state.players['p1']!.coins).toBe(1);
      expect(state.supply['province']).toBe(7);
      expect(
        state.players['p1']!.discard.some((card) => card.id === 'province')
      ).toBe(true);

      // Cannot buy another card with 0 buys left
      expect(
        validateAction(state, 'p1', { type: 'BUY_CARD', cardId: 'copper' })
          .valid
      ).toBe(false);

      // 6. Cleanup: moves all inPlay & remaining hand cards to discard, shuffles discard into deck, draws 5 fresh cards, resets counters, passes turn to p2
      state = applyAction(state, 'p1', { type: 'CLEANUP' });
      expect(state.activePlayerId).toBe('p2');
      expect(state.turnPhase).toBe('ACTION');
      expect(state.players['p1']!.hand).toHaveLength(5);
      expect(state.players['p1']!.inPlay).toHaveLength(0);
      expect(state.players['p1']!.actions).toBe(1);
      expect(state.players['p1']!.buys).toBe(1);
      expect(state.players['p1']!.coins).toBe(0);
    });
  });

  // ---------------------------------------------------------------------------
  // 3. Militia Attack & Moat Defense
  // ---------------------------------------------------------------------------
  describe('3. Militia Attack & Moat Defense', () => {
    it('forces non-immune opponents into pendingInteraction to discard down to 3 cards while opponents holding Moat bypass the discard penalty', () => {
      let state = initGame(['p1', 'p2', 'p3'], 404);

      // p1 has Militia in hand
      // p2 has 5 cards in hand WITHOUT Moat (non-immune -> must discard 2 cards down to 3)
      // p3 has 5 cards in hand INCLUDING Moat (immune -> automatically bypasses Militia!)
      state = {
        ...state,
        players: {
          ...state.players,
          p1: {
            ...state.players['p1']!,
            hand: [
              c('militia'),
              c('copper'),
              c('copper'),
              c('estate'),
              c('estate'),
            ],
          },
          p2: {
            ...state.players['p2']!,
            hand: [
              c('copper'),
              c('copper'),
              c('silver'),
              c('estate'),
              c('duchy'),
            ],
          },
          p3: {
            ...state.players['p3']!,
            hand: [
              c('moat'),
              c('copper'),
              c('silver'),
              c('gold'),
              c('estate'),
            ],
          },
        },
      };

      // p1 plays Militia (+2 Coins)
      state = applyAction(state, 'p1', {
        type: 'PLAY_ACTION_CARD',
        cardId: 'militia',
      });

      expect(state.players['p1']!.coins).toBe(2);
      // p3 had Moat so p3 kept all 5 cards and was bypassed; p2 is placed into pendingInteraction to discard 2 cards!
      expect(state.players['p3']!.hand).toHaveLength(5);
      expect(state.pendingInteraction).not.toBeNull();
      expect(state.pendingInteraction!.playerId).toBe('p2');
      expect(state.pendingInteraction!.promptType).toBe(
        'ATTACK_DEFENSE_OR_DISCARD'
      );
      expect(state.pendingInteraction!.minCount).toBe(2);
      expect(state.pendingInteraction!.maxCount).toBe(2);

      // While pendingInteraction is active for p2, p1 cannot proceed to Buy Phase
      expect(
        validateAction(state, 'p1', { type: 'PLAY_ALL_TREASURES' }).valid
      ).toBe(false);

      // p2 cannot discard only 1 card (must discard 2 down to 3)
      expect(
        validateAction(state, 'p2', {
          type: 'RESOLVE_INTERACTION',
          selectedCardIds: ['estate'],
        }).valid
      ).toBe(false);

      // p2 discards 'estate' and 'duchy' -> hand becomes 3 cards and pendingInteraction clears!
      state = applyAction(state, 'p2', {
        type: 'RESOLVE_INTERACTION',
        selectedCardIds: ['estate', 'duchy'],
      });

      expect(state.pendingInteraction).toBeNull();
      expect(state.players['p2']!.hand).toHaveLength(3);
      expect(state.players['p2']!.discard).toHaveLength(2);
      expect(state.players['p3']!.hand).toHaveLength(5);
    });

    it('also supports explicit Moat reveal via RESOLVE_INTERACTION when an opponent is prompted', () => {
      let state = initGame(['p1', 'p2'], 405);
      const p2WithMoat = {
        ...state.players['p2']!,
        hand: [c('moat'), c('copper'), c('copper'), c('estate'), c('estate')],
      };
      state = {
        ...state,
        players: {
          ...state.players,
          p2: p2WithMoat,
        },
        pendingInteraction: {
          playerId: 'p2',
          sourceCard: c('militia'),
          promptType: 'ATTACK_DEFENSE_OR_DISCARD',
          minCount: 2,
          maxCount: 2,
          remainingTargetQueue: [],
        },
      };

      state = applyAction(state, 'p2', {
        type: 'RESOLVE_INTERACTION',
        revealMoat: true,
      });

      expect(state.pendingInteraction).toBeNull();
      expect(state.players['p2']!.hand).toHaveLength(5);
      expect(state.players['p2']!.discard).toHaveLength(0);
    });
  });

  // ---------------------------------------------------------------------------
  // 4. Remodel, Mine, Workshop & Chapel Trash / Upgrade Mechanics
  // ---------------------------------------------------------------------------
  describe('4. Remodel / Trash & Upgrade Mechanics', () => {
    it('moves trashed card to shared trash pile and enforces cost limit on gained replacement card', () => {
      let state = initGame(['p1', 'p2'], 505);

      state = {
        ...state,
        players: {
          ...state.players,
          p1: {
            ...state.players['p1']!,
            actions: 3,
            hand: [
              c('remodel'),
              c('estate'), // cost 2 -> can Remodel into cost <= 4 (e.g. 'smithy'), NOT cost 5 ('duchy')
              c('mine'),
              c('silver'), // cost 3 Treasure -> can Mine into 'gold' (cost 6 Treasure) directly into hand
              c('copper'),
            ],
            discard: [],
          },
        },
      };

      // 1. Play Remodel
      state = applyAction(state, 'p1', {
        type: 'PLAY_ACTION_CARD',
        cardId: 'remodel',
      });
      expect(state.pendingInteraction?.promptType).toBe('TRASH_AND_UPGRADE');

      // Attempting to trash Estate (cost 2) and gain Duchy (cost 5 > 2 + 2) is rejected!
      expect(
        validateAction(state, 'p1', {
          type: 'RESOLVE_INTERACTION',
          trashedCardId: 'estate',
          gainedCardId: 'duchy',
        }).valid
      ).toBe(false);

      // Trashing Estate (cost 2) to gain Smithy (cost 4 <= 2 + 2) succeeds!
      state = applyAction(state, 'p1', {
        type: 'RESOLVE_INTERACTION',
        trashedCardId: 'estate',
        gainedCardId: 'smithy',
      });

      expect(state.pendingInteraction).toBeNull();
      expect(state.trash.map((card) => card.id)).toEqual(['estate']);
      expect(state.supply['smithy']).toBe(9);
      expect(state.players['p1']!.discard.map((card) => card.id)).toEqual([
        'smithy',
      ]);

      // 2. Play Mine: trash Silver (cost 3) to gain Gold (cost 6) directly into HAND
      state = applyAction(state, 'p1', {
        type: 'PLAY_ACTION_CARD',
        cardId: 'mine',
      });
      expect(state.pendingInteraction?.promptType).toBe('TRASH_AND_UPGRADE');

      state = applyAction(state, 'p1', {
        type: 'RESOLVE_INTERACTION',
        trashedCardId: 'silver',
        gainedCardId: 'gold',
      });

      expect(state.pendingInteraction).toBeNull();
      expect(state.trash.map((card) => card.id)).toEqual(['estate', 'silver']);
      expect(
        state.players['p1']!.hand.some((card) => card.id === 'gold')
      ).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // 5. Game Over Triggers & Victory Point Scoring (Including Curses & Gardens)
  // ---------------------------------------------------------------------------
  describe('5. Game Over & Scoring', () => {
    it('flags isGameOver = true when the Province pile empties and accurately totals Victory Points including Curses and Gardens', () => {
      let state = initGame(['p1', 'p2'], 606, {
        kingdomCards: [
          'cellar',
          'market',
          'merchant',
          'militia',
          'mine',
          'moat',
          'remodel',
          'smithy',
          'village',
          'gardens',
        ],
      });

      // Set supply['province'] to 1 and give p1 8 Coins in BUY_TREASURES phase
      // Also populate p1 with:
      // - 1 Province (already in deck = 6 VP) + 1 Province (about to buy = 6 VP)
      // - 2 Duchies (6 VP)
      // - 3 Estates (3 VP)
      // - 1 Curse (-1 VP)
      // - 2 Gardens (with 20 total cards owned after buying Province = 2 * floor(20/10) = 4 VP)
      // Total expected for p1 = 6 + 6 + 6 + 3 - 1 + 4 = 24 VP!
      const p1Deck = [
        c('province'),
        c('duchy'),
        c('duchy'),
        c('estate'),
        c('estate'),
        c('estate'),
        c('curse'),
        c('gardens'),
        c('gardens'),
        ...Array.from({ length: 10 }, () => c('copper')),
      ]; // 19 cards before buying the last Province -> 20 cards after buying!

      state = {
        ...state,
        turnPhase: 'BUY_TREASURES',
        turnStep: 'BUY_TREASURES',
        supply: {
          ...state.supply,
          province: 1,
        },
        players: {
          ...state.players,
          p1: {
            ...state.players['p1']!,
            buys: 1,
            coins: 8,
            deck: p1Deck,
            hand: [],
            discard: [],
            inPlay: [],
          },
          p2: {
            ...state.players['p2']!,
            deck: [c('estate'), c('estate'), c('estate'), c('curse')],
            hand: [],
            discard: [],
            inPlay: [],
          },
        },
      };

      // p1 buys the last Province -> empties Province pile -> triggers immediate Game Over!
      state = applyAction(state, 'p1', {
        type: 'BUY_CARD',
        cardId: 'province',
      });

      expect(state.supply['province']).toBe(0);
      expect(state.isGameOver).toBe(true);
      expect(state.phase).toBe('GAME_OVER');
      expect(state.winnerId).toBe('p1');

      const scores = calculateDominionFinalScores(state);
      expect(scores['p1']).toBe(24);
      expect(scores['p2']).toBe(2); // 3 Estates (3) + 1 Curse (-1) = 2 VP
      expect(state.finalScores).toEqual({
        p1: 24,
        p2: 2,
      });
    });

    it('flags isGameOver = true when any 3 Supply piles are empty even if Provinces remain', () => {
      let state = initGame(['p1', 'p2'], 707);

      // 2 piles are already empty ('village' = 0, 'smithy' = 0) and 'market' has 1 card left
      state = {
        ...state,
        turnPhase: 'BUY_TREASURES',
        turnStep: 'BUY_TREASURES',
        supply: {
          ...state.supply,
          province: 6,
          village: 0,
          smithy: 0,
          market: 1,
        },
        players: {
          ...state.players,
          p1: {
            ...state.players['p1']!,
            buys: 1,
            coins: 5,
          },
        },
      };

      // Buying the last Market empties the 3rd Supply pile -> triggers Game Over!
      state = applyAction(state, 'p1', {
        type: 'BUY_CARD',
        cardId: 'market',
      });

      expect(state.supply['market']).toBe(0);
      expect(state.isGameOver).toBe(true);
      expect(state.phase).toBe('GAME_OVER');
    });
  });
});
