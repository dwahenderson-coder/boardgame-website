import { describe, expect, it } from 'vitest';
import { getSoundEffectForAction } from '../../sandbox/sound.js';
import {
  applyDiceTownAction,
  calculateDiceTownFinalScores,
  calculatePlayerVPBreakdown,
  comparePokerDiceHands,
  DOC_BADLUCK_CARDS,
  evaluateDiceTownPokerHand,
  GENERAL_STORE_CARDS,
  getDiceTownPlayerPerspective,
  initDiceTownGame,
  PokerDie,
  PROPERTY_DEED_CARDS,
  validateDiceTownAction,
} from './index.js';

function makeLockedDice(
  faces: readonly ['9' | '10' | 'J' | 'Q' | 'K' | 'A', ...Array<'9' | '10' | 'J' | 'Q' | 'K' | 'A'>]
): PokerDie[] {
  return faces.slice(0, 5).map((value, index) => ({
    index,
    value,
    status: 'locked_public' as const,
  }));
}

describe('Dice Town Core Engine (0.00k) — Decks, Simultaneous Dice Cup, Locations, Sheriff Tie-Breakers & Scoring', () => {
  // ---------------------------------------------------------------------------
  // 1. Deck Data Integrity (`diceTownCards.ts`) & Initial Setup
  // ---------------------------------------------------------------------------
  it('defines all 19 General Store cards, 20 Property Deeds, and 7 Doc Badluck Elixirs and initializes 2–5 player games', () => {
    expect(GENERAL_STORE_CARDS).toHaveLength(19);
    expect(PROPERTY_DEED_CARDS).toHaveLength(20);
    expect(DOC_BADLUCK_CARDS).toHaveLength(7);

    // Verify Property Deed VP distribution: 5x 1VP, 5x 2VP, 4x 3VP, 3x 4VP, 3x 5VP
    expect(PROPERTY_DEED_CARDS.filter((c) => c.vp === 1)).toHaveLength(5);
    expect(PROPERTY_DEED_CARDS.filter((c) => c.vp === 2)).toHaveLength(5);
    expect(PROPERTY_DEED_CARDS.filter((c) => c.vp === 3)).toHaveLength(4);
    expect(PROPERTY_DEED_CARDS.filter((c) => c.vp === 4)).toHaveLength(3);
    expect(PROPERTY_DEED_CARDS.filter((c) => c.vp === 5)).toHaveLength(3);

    // Player bounds check (2–5 players)
    expect(() => initDiceTownGame(['p1'], 100)).toThrow();
    expect(() =>
      initDiceTownGame(['p1', 'p2', 'p3', 'p4', 'p5', 'p6'], 100)
    ).toThrow();

    const state = initDiceTownGame(['p1', 'p2', 'p3'], 2026);
    expect(state.phase).toBe('ROUND_START');
    expect(state.town.goldMineNuggets).toBe(30);
    expect(state.town.bankVaultDollars).toBe(3);
    expect(state.town.faceUpProperties).toHaveLength(3);
    expect(state.town.propertyDeck.drawPile).toHaveLength(17);
    expect(state.town.generalStoreDeck.drawPile).toHaveLength(19);
    expect(state.town.docBadluckDeck.drawPile).toHaveLength(7);

    for (const pid of ['p1', 'p2', 'p3']) {
      const p = state.players[pid]!;
      expect(p.dollars).toBe(8);
      expect(p.nuggets).toBe(0);
      expect(p.isSheriff).toBe(false);
      expect(p.dice).toHaveLength(5);
      expect(p.dice.every((d) => d.status === 'in_cup')).toBe(true);
    }
  });

  // ---------------------------------------------------------------------------
  // 2. Round Loop: ROUND_START -> SIMULTANEOUS_ROLL -> SECRET_SELECTION -> REVEAL_STEP
  // ---------------------------------------------------------------------------
  it('runs the simultaneous roll, secret selection, extra-die $1 fee validation, The Brute & Professional Cheater cards, and perspective privacy', () => {
    let state = initDiceTownGame(['p1', 'p2'], 777);

    // 1. ROUND_START adds +$1 to bankVaultDollars ($3 -> $4) and transitions to SIMULTANEOUS_ROLL
    state = applyDiceTownAction(state, 'p1', { type: 'DT_START_ROUND' });
    expect(state.phase).toBe('SIMULTANEOUS_ROLL');
    expect(state.town.bankVaultDollars).toBe(4);

    // 2. SIMULTANEOUS_ROLL rolls all in_cup dice privately
    state = applyDiceTownAction(state, 'p1', { type: 'DT_ROLL_DICE' });
    expect(state.phase).toBe('SECRET_SELECTION');

    // Perspective privacy: p1 sees their own in_cup dice values, but p2's in_cup dice have value === null!
    const p1ViewBefore = getDiceTownPlayerPerspective(state, 'p1');
    expect(p1ViewBefore.self.dice.every((d) => d.value !== null)).toBe(true);
    expect(
      p1ViewBefore.opponents['p2']!.dice.every((d) => d.value === null)
    ).toBe(true);

    // 3. SECRET_SELECTION validation:
    // Must select at least 1 die
    expect(
      validateDiceTownAction(state, 'p1', {
        type: 'DT_SELECT_DICE',
        dieIndices: [],
      }).valid
    ).toBe(false);

    // If p1 only has $1, p1 cannot keep 3 dice (which costs $2 extra) without The Brute!
    const lowCashState = {
      ...state,
      players: {
        ...state.players,
        p1: {
          ...state.players['p1']!,
          dollars: 1,
        },
      },
    };
    expect(
      validateDiceTownAction(lowCashState, 'p1', {
        type: 'DT_SELECT_DICE',
        dieIndices: [0, 1, 2],
      }).valid
    ).toBe(false);

    // Give p1 "The Brute" and "Professional Cheater" in hand
    const bruteCard = GENERAL_STORE_CARDS.find(
      (c) => c.id === 'store_the_brute_01'
    )!;
    const cheaterCard = GENERAL_STORE_CARDS.find(
      (c) => c.id === 'store_professional_cheater_01'
    )!;
    state = {
      ...state,
      players: {
        ...state.players,
        p1: {
          ...state.players['p1']!,
          handCards: [bruteCard, cheaterCard],
        },
      },
    };

    // p1 selects 3 dice ([0, 1, 2]) using The Brute ($0 fee!) and Professional Cheater (turns die 0 to 'A')
    state = applyDiceTownAction(state, 'p1', {
      type: 'DT_SELECT_DICE',
      dieIndices: [0, 1, 2],
      playBruteCardId: bruteCard.id,
      cheaterCardId: cheaterCard.id,
      cheaterDieIndex: 0,
      cheaterTargetFace: 'A',
    });
    expect(state.phase).toBe('SECRET_SELECTION'); // still waiting on p2!
    expect(state.players['p1']!.dice[0]!.value).toBe('A');
    expect(state.players['p1']!.dice[0]!.status).toBe('staged_hidden');
    expect(state.players['p1']!.stagedExtraDiceFee).toBe(0);

    // Staged dice remain hidden to p2 before REVEAL_STEP!
    const p2ViewDuring = getDiceTownPlayerPerspective(state, 'p2');
    expect(
      p2ViewDuring.opponents['p1']!.dice.every((d) => d.value === null)
    ).toBe(true);

    // p2 selects 2 dice ([0, 1]) paying $1 extra fee
    state = applyDiceTownAction(state, 'p2', {
      type: 'DT_SELECT_DICE',
      dieIndices: [0, 1],
    });
    expect(state.phase).toBe('REVEAL_STEP');
    expect(state.players['p2']!.stagedExtraDiceFee).toBe(1);

    // 4. REVEAL_STEP deducts $1 from p2 (paid to supply, NOT added to bankVaultDollars!) and reveals locked_public dice
    state = applyDiceTownAction(state, 'p1', { type: 'DT_REVEAL_DICE' });
    expect(state.players['p1']!.dollars).toBe(8); // Brute waived fee
    expect(state.players['p2']!.dollars).toBe(7); // $8 - $1 = $7
    expect(state.town.bankVaultDollars).toBe(4); // Unchanged by extra-die fees!

    // Since both players still have in_cup dice (p1 has 2 left, p2 has 3 left), phase returns to SIMULTANEOUS_ROLL!
    expect(state.phase).toBe('SIMULTANEOUS_ROLL');

    // Locked dice are now publicly visible to opponents!
    const p2ViewAfterReveal = getDiceTownPlayerPerspective(state, 'p2');
    expect(p2ViewAfterReveal.opponents['p1']!.dice[0]!.value).toBe('A');
    expect(p2ViewAfterReveal.opponents['p1']!.dice[3]!.value).toBeNull();

    // Roll remaining dice and lock all remaining at once (`lockAllRemaining: true`)
    state = applyDiceTownAction(state, 'p1', { type: 'DT_ROLL_DICE' });
    state = applyDiceTownAction(state, 'p1', {
      type: 'DT_SELECT_DICE',
      dieIndices: [],
      lockAllRemaining: true,
    });
    state = applyDiceTownAction(state, 'p2', {
      type: 'DT_SELECT_DICE',
      dieIndices: [],
      lockAllRemaining: true,
    });
    expect(state.phase).toBe('REVEAL_STEP');
  });

  // ---------------------------------------------------------------------------
  // 3. Poker Hand Evaluator & Town Hall Tie-Breaking
  // ---------------------------------------------------------------------------
  it('evaluates 5-die Poker Hands (Five of a Kind > Four of a Kind > Full House > Straight > Three of a Kind > Two Pair > One Pair > High Card)', () => {
    const fiveKind = evaluateDiceTownPokerHand(['K', 'K', 'K', 'K', 'K']);
    const fourKind = evaluateDiceTownPokerHand(['A', 'A', 'A', 'A', '9']);
    const fullHouse = evaluateDiceTownPokerHand(['Q', 'Q', 'Q', 'J', 'J']);
    const highStraight = evaluateDiceTownPokerHand(['10', 'J', 'Q', 'K', 'A']);
    const lowStraight = evaluateDiceTownPokerHand(['9', '10', 'J', 'Q', 'K']);
    const threeKind = evaluateDiceTownPokerHand(['10', '10', '10', 'A', 'K']);
    const twoPair = evaluateDiceTownPokerHand(['A', 'A', '9', '9', 'Q']);
    const onePair = evaluateDiceTownPokerHand(['J', 'J', 'A', 'K', '9']);

    expect(fiveKind.category).toBe('FIVE_OF_A_KIND');
    expect(fourKind.category).toBe('FOUR_OF_A_KIND');
    expect(fullHouse.category).toBe('FULL_HOUSE');
    expect(highStraight.category).toBe('STRAIGHT');
    expect(lowStraight.category).toBe('STRAIGHT');
    expect(threeKind.category).toBe('THREE_OF_A_KIND');
    expect(twoPair.category).toBe('TWO_PAIR');
    expect(onePair.category).toBe('ONE_PAIR');

    expect(comparePokerDiceHands(fiveKind, fourKind)).toBeGreaterThan(0);
    expect(comparePokerDiceHands(fourKind, fullHouse)).toBeGreaterThan(0);
    expect(comparePokerDiceHands(fullHouse, highStraight)).toBeGreaterThan(0);
    expect(comparePokerDiceHands(highStraight, lowStraight)).toBeGreaterThan(0);
    expect(comparePokerDiceHands(lowStraight, threeKind)).toBeGreaterThan(0);
    expect(comparePokerDiceHands(threeKind, twoPair)).toBeGreaterThan(0);
    expect(comparePokerDiceHands(twoPair, onePair)).toBeGreaterThan(0);
  });

  // ---------------------------------------------------------------------------
  // 4. Sequential Location Resolution, Sheriff Tie-Breaker & Doc Badluck
  // ---------------------------------------------------------------------------
  it('resolves all 6 Town locations in rulebook order, triggers SHERIFF_TIEBREAKER on ties, and sends 0-win players to Doc Badluck', () => {
    let state = initDiceTownGame(['p1', 'p2', 'p3'], 999);

    // Give p3 a General Store card so Saloon has a valid target to steal from
    const sampleStoreCard = GENERAL_STORE_CARDS[0]!;

    // Set up a round at REVEAL_STEP where all 3 players are locking their final dice:
    // - p1 is current Sheriff
    // - Gold Mine (9s): p1 has two 9s, p2 has two 9s -> TIE at Gold Mine! (Sheriff p1 must break tie)
    // - Bank (10s): p2 has two 10s -> p2 wins Bank ($4)
    // - General Store (Js): p1 has two Js -> p1 draws 2 cards, picks 1, discards 1
    // - Saloon (Qs): p1 has one Q -> p1 steals 1 card from p3
    // - Sheriff's Office (Ks): p2 has one K -> p2 becomes the new Sheriff!
    // - Town Hall (Poker Hand): p1 has Full House (9,9,J,J,A? Let's give p1 ['9','9','J','J','Q'] Two Pair vs p2 ['9','9','10','10','K'] Two Pair -> p1's J+9 beats p2's 10+9!)
    // - Doc Badluck: p3 won ZERO locations (`['A','A','A','9','10']`? Wait: if p3 has Three of a Kind Aces, p3 would win Town Hall! So let's give p3 `['9','10','J','Q','A']` = 1 of each so p3 ties/loses every location and wins 0 locations!)
    state = {
      ...state,
      phase: 'REVEAL_STEP',
      turnStep: 'REVEAL_STEP',
      sheriffPlayerId: 'p1',
      town: {
        ...state.town,
        bankVaultDollars: 5,
      },
      players: {
        p1: {
          ...state.players['p1']!,
          isSheriff: true,
          dice: makeLockedDice(['9', '9', 'J', 'J', 'Q']),
          hasSubmittedSelection: true,
        },
        p2: {
          ...state.players['p2']!,
          isSheriff: false,
          dice: makeLockedDice(['9', '9', '10', '10', 'K']),
          hasSubmittedSelection: true,
        },
        p3: {
          ...state.players['p3']!,
          isSheriff: false,
          // p3 has ['9', '10', 'J', 'K', 'A'] -> 1 of each (no Q, not a straight), so p3 wins 0 locations!
          dice: makeLockedDice(['9', '10', 'J', 'K', 'A']),
          handCards: [sampleStoreCard],
          hasSubmittedSelection: true,
        },
      },
    };

    // Trigger REVEAL_STEP -> all 5 dice locked -> begins LOCATION_RESOLUTION at GOLD_MINE!
    // p1 and p2 tie at GOLD_MINE with two 9s -> pauses at SHERIFF_TIEBREAKER!
    state = applyDiceTownAction(state, 'p1', { type: 'DT_REVEAL_DICE' });
    expect(state.phase).toBe('LOCATION_RESOLUTION');
    expect(state.currentLocation).toBe('GOLD_MINE');
    expect(state.subState).toBe('SHERIFF_TIEBREAKER');
    expect(state.sheriffTiebreaker?.tiedPlayerIds).toEqual(['p1', 'p2']);

    // Non-Sheriff cannot break tie
    expect(
      validateDiceTownAction(state, 'p2', {
        type: 'DT_SHERIFF_BREAK_TIE',
        chosenWinnerId: 'p2',
      }).valid
    ).toBe(false);

    // Sheriff p1 breaks tie at Gold Mine in favor of p1 ->
    // 1. Gold Mine: p1 gets 2 nuggets (goldMineNuggets: 30 -> 28)
    // 2. Bank: p2 wins outright with two 10s ($8 + $5 = $13, bankVaultDollars -> 0)
    // 3. General Store: p1 wins outright with two Js -> pauses at GENERAL_STORE_PICK (draws 2 cards, picks 1)!
    state = applyDiceTownAction(state, 'p1', {
      type: 'DT_SHERIFF_BREAK_TIE',
      chosenWinnerId: 'p1',
    });
    expect(state.players['p1']!.nuggets).toBe(2);
    expect(state.town.goldMineNuggets).toBe(28);
    expect(state.players['p2']!.dollars).toBe(13);
    expect(state.town.bankVaultDollars).toBe(0);
    expect(state.currentLocation).toBe('GENERAL_STORE');
    expect(state.subState).toBe('GENERAL_STORE_PICK');
    expect(state.generalStorePending?.drawnCards).toHaveLength(2);

    // p1 picks 1 card from the 2 drawn General Store cards and discards the other ->
    // 4. Saloon: p1 wins outright with one Q -> only p3 has cards in hand, so pauses at SALOON_STEAL!
    const pickedStoreCardId = state.generalStorePending!.drawnCards[0]!.id;
    state = applyDiceTownAction(state, 'p1', {
      type: 'DT_GENERAL_STORE_PICK_CARD',
      cardId: pickedStoreCardId,
    });
    expect(state.currentLocation).toBe('SALOON');
    expect(state.subState).toBe('SALOON_STEAL');
    expect(state.saloonPending?.targetOpponentId).toBe('p3');
    expect(state.saloonPending?.revealedCandidateCards).toHaveLength(1);

    // p1 steals the card from p3 at Saloon ->
    // 5. Sheriff's Office: p2 and p3 tie with one K! Sheriff (still p1 until Sheriff's Office resolves!) must break the tie!
    state = applyDiceTownAction(state, 'p1', {
      type: 'DT_SALOON_STEAL_CARD',
      cardId: sampleStoreCard.id,
    });
    expect(state.players['p3']!.handCards).toHaveLength(0);
    expect(state.currentLocation).toBe('SHERIFF_OFFICE');
    expect(state.subState).toBe('SHERIFF_TIEBREAKER');
    expect(state.sheriffTiebreaker?.tiedPlayerIds).toEqual(['p2', 'p3']);

    // Sheriff p1 chooses p2 to win Sheriff's Office ->
    // - p2 becomes the new Sheriff (`isSheriff = true`, `sheriffPlayerId = 'p2'`)!
    // - 6. Town Hall: p1's Two Pair (Jacks & 9s) beats p2's Two Pair (10s & 9s) and p3's High Card -> p1 claims 1 Property Deed and refills faceUpProperties to 3!
    // - 7. Doc Badluck: p3 won ZERO locations this round (`locationsWonThisRound === 0`), so p3 visits Doc Badluck!
    state = applyDiceTownAction(state, 'p1', {
      type: 'DT_SHERIFF_BREAK_TIE',
      chosenWinnerId: 'p2',
    });
    expect(state.sheriffPlayerId).toBe('p2');
    expect(state.players['p2']!.isSheriff).toBe(true);
    expect(state.players['p1']!.isSheriff).toBe(false);
    expect(state.players['p1']!.propertyDeeds).toHaveLength(1);
    expect(state.town.faceUpProperties).toHaveLength(3);
    expect(state.players['p3']!.locationsWonThisRound).toBe(0);
  });

  // ---------------------------------------------------------------------------
  // 5. End-Game Trigger & Final Victory Point Calculation + Sound Effects
  // ---------------------------------------------------------------------------
  it('triggers GAME_OVER when Gold Mine nuggets reach 0 and calculates exact Final VP: nuggets + floor(dollars/2) + sheriff(5) + deeds + equipment', () => {
    let state = initDiceTownGame(['p1', 'p2'], 303);

    const equip8VP = GENERAL_STORE_CARDS.find(
      (c) => c.id === 'store_equip_8vp_01'
    )!;
    const deed5VP = PROPERTY_DEED_CARDS.find((c) => c.vp === 5)!;

    state = {
      ...state,
      phase: 'REVEAL_STEP',
      turnStep: 'REVEAL_STEP',
      sheriffPlayerId: 'p1',
      town: {
        ...state.town,
        goldMineNuggets: 2, // Only 2 nuggets left in the Gold Mine!
      },
      players: {
        p1: {
          ...state.players['p1']!,
          dollars: 9, // floor(9/2) = 4 VP
          nuggets: 3, // +2 from Gold Mine = 5 nuggets = 5 VP
          isSheriff: true, // +5 VP (and keeps Sheriff with 1 K)
          handCards: [equip8VP], // +8 VP
          propertyDeeds: [deed5VP], // +5 VP (+2 deeds from Town Hall)
          dice: makeLockedDice(['9', '9', '9', 'K', 'A']),
          hasSubmittedSelection: true,
        },
        p2: {
          ...state.players['p2']!,
          dollars: 4,
          nuggets: 1,
          isSheriff: false,
          dice: makeLockedDice(['10', '10', 'J', 'A', 'A']),
          hasSubmittedSelection: true,
        },
      },
    };

    state = applyDiceTownAction(state, 'p1', { type: 'DT_REVEAL_DICE' });
    expect(state.town.goldMineNuggets).toBe(0);
    expect(state.phase).toBe('GAME_OVER');
    expect(state.winnerId).toBe('p1');

    const p1VP = calculatePlayerVPBreakdown(state.players['p1']!);
    expect(p1VP.nuggetVP).toBe(5);
    expect(p1VP.dollarVP).toBe(4);
    expect(p1VP.sheriffVP).toBe(5);
    expect(p1VP.bonusCardVP).toBe(8);
    expect(p1VP.totalVP).toBe(
      p1VP.nuggetVP +
        p1VP.dollarVP +
        p1VP.sheriffVP +
        p1VP.propertyDeedVP +
        p1VP.bonusCardVP
    );

    const finalScores = calculateDiceTownFinalScores(state);
    expect(finalScores['p1']).toBe(p1VP.totalVP);

    // Verify sound effect mappings for Dice Town actions
    expect(getSoundEffectForAction({ type: 'DT_ROLL_DICE' })).toBe('DICE_ROLL');
    expect(
      getSoundEffectForAction({ type: 'DT_SELECT_DICE', dieIndices: [0] })
    ).toBe('WOOD_BUILD');
    expect(getSoundEffectForAction({ type: 'DT_REVEAL_DICE' })).toBe(
      'COIN_CHINK'
    );
    expect(
      getSoundEffectForAction({
        type: 'DT_SHERIFF_BREAK_TIE',
        chosenWinnerId: 'p1',
      })
    ).toBe('TABLE_KNOCK');
  });
});
