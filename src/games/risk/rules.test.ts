import { describe, expect, it } from 'vitest';
import { getSoundEffectForAction } from '../../sandbox/sound.js';
import {
  ALL_RISK_TERRITORY_IDS,
  applyRiskAction,
  areRiskTerritoriesAdjacent,
  areTerritoriesConnectedByOwner,
  evaluateRiskCardSetValue,
  getOwnedTerritories,
  getRiskPlayerPerspective,
  initRiskGame,
  RISK_CONTINENTS,
  RISK_DASHED_SEA_CONNECTIONS,
  RISK_NEUTRAL_PLAYER_ID,
  RISK_TERRITORIES,
  RiskCard,
  RiskGameState,
  RiskTerritoryId,
  RiskTerritoryState,
  validateRiskAction,
} from './index.js';

describe('Risk Engine & Rules Suite', () => {
  it('has 42 territories across 6 continents with symmetric adjacencies and valid dashed sea connections', () => {
    expect(RISK_TERRITORIES).toHaveLength(42);
    expect(ALL_RISK_TERRITORY_IDS).toHaveLength(42);
    expect(RISK_CONTINENTS).toHaveLength(6);

    const continentTotal = RISK_CONTINENTS.reduce(
      (sum, c) => sum + c.territoryIds.length,
      0
    );
    expect(continentTotal).toBe(42);

    // Every adjacency must be strictly symmetric and non-self
    for (const t of RISK_TERRITORIES) {
      expect(t.adjacentIds.length).toBeGreaterThan(0);
      expect(t.adjacentIds).not.toContain(t.id);
      for (const adjId of t.adjacentIds) {
        expect(areRiskTerritoriesAdjacent(t.id, adjId)).toBe(true);
        expect(areRiskTerritoriesAdjacent(adjId, t.id)).toBe(true);
      }
    }

    // Verify Alaska <-> Kamchatka wrap-around connection
    expect(areRiskTerritoriesAdjacent('alaska', 'kamchatka')).toBe(true);

    // Every dashed sea connection must link two genuinely adjacent territories
    expect(RISK_DASHED_SEA_CONNECTIONS.length).toBeGreaterThanOrEqual(24);
    for (const sea of RISK_DASHED_SEA_CONNECTIONS) {
      expect(
        areRiskTerritoriesAdjacent(sea.fromTerritoryId, sea.toTerritoryId)
      ).toBe(true);
    }
  });

  it('supports Manual Claim vs Auto-Deal setup, lobby player colors, and 2-player Neutral garrison', () => {
    // 3-player Manual Setup with custom lobby colors
    let manualState = initRiskGame(['p1', 'p2', 'p3'], 42, {
      playerColors: { p1: 'purple', p2: 'orange', p3: 'green' },
    });
    expect(manualState.setupMode).toBe('MANUAL');
    expect(manualState.turnStep).toBe('SETUP_CLAIM');
    expect(manualState.players['p1']?.color).toBe('purple');
    expect(manualState.players['p2']?.color).toBe('orange');
    expect(manualState.players['p3']?.color).toBe('green');
    expect(manualState.players['p1']?.unplacedArmies).toBe(35);

    // Claim 1 territory manually, then auto-finish remaining setup
    manualState = applyRiskAction(manualState, 'p1', {
      type: 'RISK_CLAIM_TERRITORY',
      territoryId: 'alaska',
    });
    expect(manualState.territories['alaska'].ownerId).toBe('p1');
    expect(manualState.territories['alaska'].armies).toBe(1);
    expect(manualState.activePlayerIndex).toBe(1);

    manualState = applyRiskAction(manualState, 'p2', {
      type: 'RISK_AUTO_FINISH_SETUP',
    });
    expect(manualState.phase).toBe('PLAYING');
    expect(manualState.turnStep).toBe('REINFORCE');

    // Verify all 3 players received exact 35 starting armies (+ p1's Turn 1 unplaced reinforcements)
    for (const pid of ['p1', 'p2', 'p3']) {
      const placed = getOwnedTerritories(manualState.territories, pid).reduce(
        (s, t) => s + t.armies,
        0
      );
      expect(placed).toBe(35);
    }

    // 2-player Auto-Setup with Neutral garrison
    const twoPlayerAuto = initRiskGame(['p1', 'p2'], 99, {
      selectedExpansions: ['auto_setup'],
    });
    expect(twoPlayerAuto.setupMode).toBe('AUTO');
    expect(twoPlayerAuto.turnStep).toBe('SETUP_PLACE');
    expect(getOwnedTerritories(twoPlayerAuto.territories, 'p1')).toHaveLength(14);
    expect(getOwnedTerritories(twoPlayerAuto.territories, 'p2')).toHaveLength(14);
    const neutralTerrs = getOwnedTerritories(
      twoPlayerAuto.territories,
      RISK_NEUTRAL_PLAYER_ID
    );
    expect(neutralTerrs).toHaveLength(14);
    expect(neutralTerrs.every((t) => t.armies === 2)).toBe(true);
  });

  it('evaluates Escalating vs Fixed card trade-ins, +2 territory bonus, and 5-card mandatory trade', () => {
    const infCards: RiskCard[] = [
      { id: 'c1', symbol: 'INFANTRY', territoryId: 'alaska' },
      { id: 'c2', symbol: 'INFANTRY', territoryId: 'peru' },
      { id: 'c3', symbol: 'INFANTRY', territoryId: 'egypt' },
    ];
    const artCards: RiskCard[] = [
      { id: 'a1', symbol: 'ARTILLERY', territoryId: 'brazil' },
      { id: 'a2', symbol: 'ARTILLERY', territoryId: 'japan' },
      { id: 'a3', symbol: 'ARTILLERY', territoryId: 'western_europe' },
    ];
    const wildMix: RiskCard[] = [
      { id: 'w1', symbol: 'WILD', territoryId: null },
      { id: 'c1', symbol: 'INFANTRY', territoryId: 'alaska' },
      { id: 'k1', symbol: 'CAVALRY', territoryId: 'ontario' },
    ];

    // Escalating values: 4, 6, 8, 10, 12, 15, 20, 25
    expect(evaluateRiskCardSetValue(infCards, 'ESCALATING', 0)).toBe(4);
    expect(evaluateRiskCardSetValue(infCards, 'ESCALATING', 5)).toBe(15);
    expect(evaluateRiskCardSetValue(infCards, 'ESCALATING', 6)).toBe(20);

    // Fixed values: 4 / 6 / 8 / 10 (Wild forms 1-of-each = 10!)
    expect(evaluateRiskCardSetValue(infCards, 'FIXED', 0)).toBe(4);
    expect(evaluateRiskCardSetValue(artCards, 'FIXED', 0)).toBe(8);
    expect(evaluateRiskCardSetValue(wildMix, 'FIXED', 4)).toBe(10);

    // Test mandatory 5-card trade & +2 owned territory bonus in engine
    let state = initRiskGame(['p1', 'p2', 'p3'], 101, {
      selectedExpansions: ['auto_setup', 'fixed_card_values'],
    });
    state = applyRiskAction(state, 'p1', { type: 'RISK_AUTO_FINISH_SETUP' });

    const p1OwnedId = getOwnedTerritories(state.territories, 'p1')[0]!.id;
    const initialArmiesOnOwned = state.territories[p1OwnedId].armies;

    const fiveCardHand: RiskCard[] = [
      { id: 'h1', symbol: 'ARTILLERY', territoryId: p1OwnedId },
      { id: 'h2', symbol: 'ARTILLERY', territoryId: null },
      { id: 'h3', symbol: 'ARTILLERY', territoryId: null },
      { id: 'h4', symbol: 'INFANTRY', territoryId: null },
      { id: 'h5', symbol: 'CAVALRY', territoryId: null },
    ];

    state = {
      ...state,
      players: {
        ...state.players,
        p1: {
          ...state.players['p1']!,
          cards: fiveCardHand,
        },
      },
    };

    // Cannot place reinforcements while holding 5 cards
    expect(
      validateRiskAction(state, 'p1', {
        type: 'RISK_PLACE_REINFORCEMENTS',
        territoryId: p1OwnedId,
        count: 1,
      }).valid
    ).toBe(false);

    const beforeUnplaced = state.players['p1']!.unplacedArmies;
    state = applyRiskAction(state, 'p1', {
      type: 'RISK_TRADE_CARDS',
      cardIds: ['h1', 'h2', 'h3'],
    });

    // Fixed 3 Artillery = +8 unplaced armies, plus +2 directly on p1OwnedId!
    expect(state.players['p1']!.unplacedArmies).toBe(beforeUnplaced + 8);
    expect(state.territories[p1OwnedId].armies).toBe(initialArmiesOnOwned + 2);
  });

  it('supports Manual vs Auto Blitz attacks AND Auto vs Manual Defense dice selection', () => {
    let state = initRiskGame(['p1', 'p2', 'p3'], 777, {
      selectedExpansions: ['auto_setup'],
    });
    state = applyRiskAction(state, 'p1', { type: 'RISK_AUTO_FINISH_SETUP' });

    // Place p1's initial reinforcements so we enter ATTACK step
    const p1StartId = getOwnedTerritories(state.territories, 'p1')[0]!.id;
    state = applyRiskAction(state, 'p1', {
      type: 'RISK_PLACE_REINFORCEMENTS',
      territoryId: p1StartId,
      count: state.players['p1']!.unplacedArmies,
    });
    expect(state.turnStep).toBe('ATTACK');

    // Configure Alaska (p1, 12 armies) vs Northwest Territory (p2, 3 armies)
    const customTerritories: Record<RiskTerritoryId, RiskTerritoryState> = {
      ...state.territories,
      alaska: { id: 'alaska', ownerId: 'p1', armies: 12 },
      northwest_territory: {
        id: 'northwest_territory',
        ownerId: 'p2',
        armies: 3,
      },
    };
    state = { ...state, territories: customTerritories };

    // p2 toggles Manual Defense ON out-of-turn!
    state = applyRiskAction(state, 'p2', {
      type: 'RISK_SET_DEFENSE_MODE',
      autoDefend: false,
    });
    expect(state.players['p2']!.autoDefend).toBe(false);

    // p1 declares a Manual 3-dice attack -> pauses for p2's Manual Defense choice!
    state = applyRiskAction(state, 'p1', {
      type: 'RISK_DECLARE_ATTACK',
      fromTerritoryId: 'alaska',
      toTerritoryId: 'northwest_territory',
      mode: 'MANUAL',
      attackerDice: 3,
    });
    expect(state.turnStep).toBe('AWAITING_DEFENDER_DICE');
    expect(state.pendingDefense?.defenderId).toBe('p2');
    expect(getRiskPlayerPerspective(state, 'p2').activePlayerId).toBe('p2');

    // p1 cannot roll defense dice for p2
    expect(
      validateRiskAction(state, 'p1', {
        type: 'RISK_DEFEND_ROLL',
        defenderDice: 2,
      }).valid
    ).toBe(false);

    // p2 chooses to roll 2 Red Dice
    state = applyRiskAction(state, 'p2', {
      type: 'RISK_DEFEND_ROLL',
      defenderDice: 2,
    });
    expect(state.lastCombat).not.toBeNull();
    expect(state.lastCombat!.volleys[0]!.attackerRolls).toHaveLength(3);
    expect(state.lastCombat!.volleys[0]!.defenderRolls).toHaveLength(2);

    // Now p2 switches back to Auto-Defend, and p1 launches an Auto Blitz!
    state = applyRiskAction(state, 'p2', {
      type: 'RISK_SET_DEFENSE_MODE',
      autoDefend: true,
    });
    if (state.territories['northwest_territory'].ownerId === 'p2') {
      state = applyRiskAction(state, 'p1', {
        type: 'RISK_DECLARE_ATTACK',
        fromTerritoryId: 'alaska',
        toTerritoryId: 'northwest_territory',
        mode: 'AUTO',
        minArmiesToKeep: 2,
      });
    }
    if (state.turnStep === 'CONQUEST_MOVE' && state.pendingConquest) {
      state = applyRiskAction(state, 'p1', {
        type: 'RISK_MOVE_AFTER_CONQUEST',
        armies: state.pendingConquest.minArmiesToMove,
      });
    }
    expect(state.territories['northwest_territory'].ownerId).toBe('p1');
    expect(state.conqueredTerritoryThisTurn).toBe(true);

    // Verify connected-chain fortification & card draw on turn end
    state = {
      ...state,
      territories: {
        ...state.territories,
        alaska: { id: 'alaska', ownerId: 'p1', armies: 5 },
        northwest_territory: {
          id: 'northwest_territory',
          ownerId: 'p1',
          armies: 2,
        },
        ontario: { id: 'ontario', ownerId: 'p1', armies: 2 },
      },
    };
    expect(
      areTerritoriesConnectedByOwner(
        state.territories,
        'p1',
        'alaska',
        'ontario'
      )
    ).toBe(true);

    state = applyRiskAction(state, 'p1', { type: 'RISK_END_ATTACKS' });
    expect(state.turnStep).toBe('FORTIFY');
    state = applyRiskAction(state, 'p1', {
      type: 'RISK_FORTIFY',
      fromTerritoryId: 'alaska',
      toTerritoryId: 'ontario',
      armies: 3,
    });
    expect(state.territories['ontario'].armies).toBe(5);
    expect(state.players['p1']!.cards).toHaveLength(1);
    expect(state.activePlayerIndex).toBe(1);
  });

  it('supports Capital Risk and Secret Mission win conditions with sanitized mission privacy', () => {
    // 1. Capital Risk
    let capState = initRiskGame(['p1', 'p2', 'p3'], 2024, {
      selectedExpansions: ['auto_setup', 'capital_risk'],
    });
    capState = applyRiskAction(capState, 'p1', {
      type: 'RISK_AUTO_FINISH_SETUP',
    });
    expect(capState.turnStep).toBe('CHOOSE_CAPITAL');

    const p1Cap = getOwnedTerritories(capState.territories, 'p1')[0]!.id;
    const p2Cap = getOwnedTerritories(capState.territories, 'p2')[0]!.id;
    const p3Cap = getOwnedTerritories(capState.territories, 'p3')[0]!.id;

    capState = applyRiskAction(capState, 'p1', {
      type: 'RISK_CHOOSE_CAPITAL',
      territoryId: p1Cap,
    });
    capState = applyRiskAction(capState, 'p2', {
      type: 'RISK_CHOOSE_CAPITAL',
      territoryId: p2Cap,
    });
    capState = applyRiskAction(capState, 'p3', {
      type: 'RISK_CHOOSE_CAPITAL',
      territoryId: p3Cap,
    });
    expect(capState.phase).toBe('PLAYING');
    expect(capState.turnStep).toBe('REINFORCE');

    // Place reinforcements for p1, then setup p1 capturing the final rival Capital (when already holding p2Cap)
    capState = applyRiskAction(capState, 'p1', {
      type: 'RISK_PLACE_REINFORCEMENTS',
      territoryId: p1Cap,
      count: capState.players['p1']!.unplacedArmies,
    });
    const adjToP3Cap = RISK_TERRITORIES.find((t) => t.id === p3Cap)!
      .adjacentIds[0]!;
    // Ensure p3 still owns another non-capital territory so this tests Capital Victory specifically
    const otherP3Terr = ALL_RISK_TERRITORY_IDS.find(
      (id) => id !== p1Cap && id !== p2Cap && id !== p3Cap && id !== adjToP3Cap
    )!;
    capState = {
      ...capState,
      territories: {
        ...capState.territories,
        [p1Cap]: { id: p1Cap, ownerId: 'p1', armies: 5 },
        [p2Cap]: { id: p2Cap, ownerId: 'p1', armies: 5 },
        [adjToP3Cap]: { id: adjToP3Cap, ownerId: 'p1', armies: 20 },
        [p3Cap]: { id: p3Cap, ownerId: 'p3', armies: 1 },
        [otherP3Terr]: { id: otherP3Terr, ownerId: 'p3', armies: 5 },
      },
    };

    capState = applyRiskAction(capState, 'p1', {
      type: 'RISK_DECLARE_ATTACK',
      fromTerritoryId: adjToP3Cap,
      toTerritoryId: p3Cap,
      mode: 'AUTO',
    });
    expect(capState.phase).toBe('GAME_OVER');
    expect(capState.winnerId).toBe('p1');

    // 2. Secret Mission privacy
    const secretState: RiskGameState = initRiskGame(['p1', 'p2', 'p3'], 555, {
      selectedExpansions: ['auto_setup', 'secret_mission'],
    });
    expect(secretState.winCondition).toBe('SECRET_MISSION');
    expect(secretState.players['p1']!.secretMission).not.toBeNull();

    const p1View = getRiskPlayerPerspective(secretState, 'p1');
    expect(p1View.players['p1']!.secretMission).not.toBeNull();
    expect(p1View.players['p2']!.secretMission).toBeNull();
    expect(p1View.players['p3']!.secretMission).toBeNull();
  });

  it('maps Risk actions to dedicated sound effects', () => {
    expect(
      getSoundEffectForAction({
        type: 'RISK_DECLARE_ATTACK',
        fromTerritoryId: 'alaska',
        toTerritoryId: 'kamchatka',
        mode: 'MANUAL',
      })
    ).toBe('CANNON_VOLLEY');
    expect(
      getSoundEffectForAction({
        type: 'RISK_DEFEND_ROLL',
        defenderDice: 2,
      })
    ).toBe('DICE_ROLL');
    expect(
      getSoundEffectForAction({
        type: 'RISK_PLACE_REINFORCEMENTS',
        territoryId: 'alaska',
        count: 3,
      })
    ).toBe('MARCHING_DRUM');
    expect(
      getSoundEffectForAction({
        type: 'RISK_TRADE_CARDS',
        cardIds: ['c1', 'c2', 'c3'],
      })
    ).toBe('BUGLE_CALL');
  });
});
