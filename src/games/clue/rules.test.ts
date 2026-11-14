import { describe, expect, it } from 'vitest';
import {
  ALL_CLUE_CARDS,
  ALL_CLUE_ROOMS,
  ALL_CLUE_SUSPECTS,
  ALL_CLUE_WEAPONS,
  applyClueAction,
  classifyBoardTile,
  CLUE_ROOM_DEFINITIONS,
  CLUE_START_SQUARES,
  getCluePlayerPerspective,
  getReachableClueTargets,
  initClueGame,
  validateClueAction,
} from './index.js';

describe('Clue Board Game Engine & 24x25 Mansion Grid', () => {
  it('seals 1 Suspect, 1 Weapon, and 1 Room in solution and deals the remaining 18 cards evenly', () => {
    const state = initClueGame(['p1', 'p2', 'p3'], 2026, {
      playerColors: {
        p1: 'Miss Scarlet',
        p2: 'Professor Plum',
        p3: 'Colonel Mustard',
      },
    });

    expect(ALL_CLUE_SUSPECTS).toContain(state.solution.suspect);
    expect(ALL_CLUE_WEAPONS).toContain(state.solution.weapon);
    expect(ALL_CLUE_ROOMS).toContain(state.solution.room);

    expect(state.players['p1']!.suspect).toBe('Miss Scarlet');
    expect(state.players['p2']!.suspect).toBe('Professor Plum');
    expect(state.players['p3']!.suspect).toBe('Colonel Mustard');

    // Remaining 18 cards dealt evenly across 3 players (6 cards each)
    expect(state.players['p1']!.hand).toHaveLength(6);
    expect(state.players['p2']!.hand).toHaveLength(6);
    expect(state.players['p3']!.hand).toHaveLength(6);

    const allDealtNames = [
      ...state.players['p1']!.hand.map((c) => c.name),
      ...state.players['p2']!.hand.map((c) => c.name),
      ...state.players['p3']!.hand.map((c) => c.name),
    ];
    expect(allDealtNames).toHaveLength(18);
    expect(allDealtNames).not.toContain(state.solution.suspect);
    expect(allDealtNames).not.toContain(state.solution.weapon);
    expect(allDealtNames).not.toContain(state.solution.room);
    expect(new Set(allDealtNames).size).toBe(18);
    expect(ALL_CLUE_CARDS).toHaveLength(21);
  });

  it('classifies the 24x25 Mansion Grid rooms, doors, secret passages, Clue Space, starting squares, and borders accurately', () => {
    // Study (X1..X7, Y1..Y4) with door at (X7,Y4) -> hallway (X7,Y5) and secret passage to Kitchen
    expect(classifyBoardTile(7, 4)).toEqual({
      kind: 'ROOM',
      room: 'Study',
      isDoor: true,
    });
    expect(classifyBoardTile(7, 5)).toEqual({ kind: 'HALLWAY' });
    expect(CLUE_ROOM_DEFINITIONS.Study.secretPassageTo).toBe('Kitchen');
    expect(CLUE_ROOM_DEFINITIONS.Kitchen.secretPassageTo).toBe('Study');
    expect(CLUE_ROOM_DEFINITIONS.Lounge.secretPassageTo).toBe('Conservatory');
    expect(CLUE_ROOM_DEFINITIONS.Conservatory.secretPassageTo).toBe('Lounge');

    // Center Clue Space (X10..X14, Y9..Y15)
    expect(classifyBoardTile(12, 12)).toEqual({ kind: 'CLUE_SPACE' });

    // Starting squares & exit hallways
    expect(classifyBoardTile(1, 5)).toEqual({
      kind: 'START_SQUARE',
      suspect: 'Professor Plum',
    });
    expect(classifyBoardTile(1, 6)).toEqual({
      kind: 'START_SQUARE',
      suspect: 'Professor Plum',
    });
    expect(CLUE_START_SQUARES['Professor Plum'].exitHallway).toEqual({
      x: 2,
      y: 6,
    });
    expect(classifyBoardTile(2, 6)).toEqual({ kind: 'HALLWAY' });

    // Border squares
    expect(classifyBoardTile(9, 1)).toEqual({ kind: 'BORDER' });
    expect(classifyBoardTile(18, 1)).toEqual({ kind: 'BORDER' });
    expect(classifyBoardTile(1, 7)).toEqual({ kind: 'BORDER' });
    expect(classifyBoardTile(24, 9)).toEqual({ kind: 'BORDER' });

    // Pathfinding from Professor Plum's start square with a roll of 8 can reach Study!
    // Step 1: (2,6) -> (3,6)->(4,6)->(5,6)->(6,6)->(7,6)->(7,5) [7 steps] -> door (7,4) Study [8 steps]
    const reachable = getReachableClueTargets(
      { kind: 'START', suspect: 'Professor Plum' },
      8
    );
    expect(reachable.rooms.get('Study')).toBe(8);
  });

  it('runs the full Move -> Suggest -> Clockwise Disprove Interruption -> Private Card Reveal -> Accuse flow and sanitizes hidden state', () => {
    let state = initClueGame(['p1', 'p2', 'p3'], 42);

    // Set known solution and hands to test clockwise Disprove interruption deterministically
    state = {
      ...state,
      solution: {
        suspect: 'Colonel Mustard',
        weapon: 'Revolver',
        room: 'Library',
      },
      suspectPositions: {
        ...state.suspectPositions,
        [state.players['p1']!.suspect]: { kind: 'ROOM', room: 'Study' },
      },
      players: {
        ...state.players,
        p1: {
          ...state.players['p1']!,
          hand: [{ id: 'Hall', name: 'Hall', category: 'ROOM' }],
        },
        // p2 (clockwise next) has 0 matching cards for (Professor Plum, Candlestick, Kitchen)
        p2: {
          ...state.players['p2']!,
          suspect: 'Professor Plum',
          hand: [{ id: 'Rope', name: 'Rope', category: 'WEAPON' }],
        },
        // p3 has 2 matching cards ('Professor Plum' and 'Kitchen')
        p3: {
          ...state.players['p3']!,
          hand: [
            {
              id: 'Professor Plum',
              name: 'Professor Plum',
              category: 'SUSPECT',
            },
            { id: 'Kitchen', name: 'Kitchen', category: 'ROOM' },
          ],
        },
      },
    };

    // 1. p1 uses Secret Passage from Study -> Kitchen
    state = applyClueAction(state, 'p1', { type: 'CLUE_USE_SECRET_PASSAGE' });
    expect(state.suspectPositions[state.players['p1']!.suspect]).toEqual({
      kind: 'ROOM',
      room: 'Kitchen',
    });
    expect(state.turnStep).toBe('MAKE_SUGGESTION_OR_END');

    // 2. p1 suggests: Professor Plum with the Candlestick in the Kitchen
    state = applyClueAction(state, 'p1', {
      type: 'CLUE_MAKE_SUGGESTION',
      suspect: 'Professor Plum',
      weapon: 'Candlestick',
    });

    // Professor Plum's pawn and the Candlestick are teleported into the Kitchen!
    expect(state.suspectPositions['Professor Plum']).toEqual({
      kind: 'ROOM',
      room: 'Kitchen',
    });
    expect(state.weaponPositions.Candlestick).toBe('Kitchen');
    // p2 (Professor Plum) is marked wasMovedBySuggestion = true
    expect(state.players['p2']!.wasMovedBySuggestion).toBe(true);

    // p2 had 0 matching cards so p2 auto-passed; p3 is prompted to disprove!
    expect(state.turnStep).toBe('DISPROVING');
    expect(state.activeSuggestion?.passedPlayerIds).toEqual(['p2']);
    expect(state.activeSuggestion?.disproverPlayerId).toBe('p3');

    // Verify p3 cannot show a non-matching card
    expect(
      validateClueAction(state, 'p3', {
        type: 'CLUE_DISPROVE_SUGGESTION',
        card: 'Hall',
      }).valid
    ).toBe(false);

    // p3 shows 'Kitchen' to p1
    state = applyClueAction(state, 'p3', {
      type: 'CLUE_DISPROVE_SUGGESTION',
      card: 'Kitchen',
    });
    expect(state.turnStep).toBe('POST_SUGGESTION');

    // Verify strict sanitization in getCluePlayerPerspective:
    // - p1 (suggester) and p3 (disprover) see shownCard === 'Kitchen'
    // - p2 (observer) sees shownByPlayerId === 'p3' but shownCard === null!
    // - Nobody sees revealedSolution while phase === 'PLAYING'
    const p1View = getCluePlayerPerspective(state, 'p1');
    const p2View = getCluePlayerPerspective(state, 'p2');
    const p3View = getCluePlayerPerspective(state, 'p3');

    expect(p1View.revealedSolution).toBeNull();
    expect(p1View.activeSuggestion?.shownCard).toBe('Kitchen');
    expect(p3View.activeSuggestion?.shownCard).toBe('Kitchen');
    expect(p2View.activeSuggestion?.shownByPlayerId).toBe('p3');
    expect(p2View.activeSuggestion?.shownCard).toBeNull();

    // 3. p1 ends turn -> p2's turn. Since p2 was teleported to Kitchen by Suggestion, p2 can stay in Kitchen!
    state = applyClueAction(state, 'p1', { type: 'CLUE_END_TURN' });
    expect(state.playerOrder[state.activePlayerIndex]).toBe('p2');
    state = applyClueAction(state, 'p2', { type: 'CLUE_STAY_IN_ROOM' });
    expect(state.turnStep).toBe('MAKE_SUGGESTION_OR_END');

    // 4. p2 makes a wrong accusation -> p2 is eliminated, turn passes to p3
    state = applyClueAction(state, 'p2', {
      type: 'CLUE_MAKE_ACCUSATION',
      suspect: 'Miss Scarlet',
      weapon: 'Rope',
      room: 'Study',
    });
    expect(state.players['p2']!.eliminated).toBe(true);
    expect(state.phase).toBe('PLAYING');
    expect(state.playerOrder[state.activePlayerIndex]).toBe('p3');

    // 5. p3 makes the correct accusation -> p3 wins the game!
    state = applyClueAction(state, 'p3', {
      type: 'CLUE_MAKE_ACCUSATION',
      suspect: 'Colonel Mustard',
      weapon: 'Revolver',
      room: 'Library',
    });
    expect(state.phase).toBe('GAME_OVER');
    expect(state.winnerId).toBe('p3');
    expect(getCluePlayerPerspective(state, 'p1').revealedSolution).toEqual({
      suspect: 'Colonel Mustard',
      weapon: 'Revolver',
      room: 'Library',
    });
  });
});
