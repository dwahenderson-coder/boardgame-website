import { GameSetupOptions } from '../../types/game.js';
import { ValidationResult } from '../ticket-to-ride/types.js';
import {
  CLUE_ROOM_DEFINITIONS,
  coordKey,
  getReachableClueTargets,
} from './board.js';
import {
  ALL_CLUE_CARDS,
  ALL_CLUE_ROOMS,
  ALL_CLUE_SUSPECTS,
  ALL_CLUE_WEAPONS,
  ClueAction,
  ClueActiveSuggestion,
  ClueCard,
  ClueCardName,
  ClueGameState,
  ClueNotepadMark,
  CluePawnPosition,
  CluePlayerState,
  CluePublicOpponentState,
  ClueRoom,
  ClueSanitizedGameState,
  ClueSanitizedSuggestion,
  ClueSolution,
  ClueSuspect,
  ClueWeapon,
} from './types.js';

function nextRandom(rngState: number): { value: number; nextState: number } {
  let t = (rngState + 0x6d2b79f5) | 0;
  const nextState = t;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  const value = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  return { value, nextState };
}

function shuffleWithRng<T>(
  items: readonly T[],
  rngState: number
): { shuffled: T[]; nextState: number } {
  const arr = [...items];
  let current = rngState;
  for (let i = arr.length - 1; i > 0; i--) {
    const r = nextRandom(current);
    current = r.nextState;
    const j = Math.floor(r.value * (i + 1));
    const tmp = arr[i]!;
    arr[i] = arr[j]!;
    arr[j] = tmp;
  }
  return { shuffled: arr, nextState: current };
}

const COLOR_TO_SUSPECT_MAP: Readonly<Record<string, ClueSuspect>> = {
  'Miss Scarlet': 'Miss Scarlet',
  red: 'Miss Scarlet',
  'Colonel Mustard': 'Colonel Mustard',
  yellow: 'Colonel Mustard',
  'Mrs. White': 'Mrs. White',
  white: 'Mrs. White',
  'Mr. Green': 'Mr. Green',
  green: 'Mr. Green',
  'Mrs. Peacock': 'Mrs. Peacock',
  blue: 'Mrs. Peacock',
  'Professor Plum': 'Professor Plum',
  purple: 'Professor Plum',
};

function createInitialNotepad(
  dealtCards: readonly ClueCard[]
): Record<ClueCardName, ClueNotepadMark> {
  const heldSet = new Set<ClueCardName>(dealtCards.map((c) => c.name));
  const pad = {} as Record<ClueCardName, ClueNotepadMark>;
  for (const card of ALL_CLUE_CARDS) {
    pad[card.name] = heldSet.has(card.name) ? 'YES' : 'UNKNOWN';
  }
  return pad;
}

export function initClueGame(
  playerIds: string[],
  seed: number = 101,
  options?: GameSetupOptions
): ClueGameState {
  if (playerIds.length < 2 || playerIds.length > 6) {
    throw new Error('Clue requires between 2 and 6 players.');
  }

  let rng = seed | 0;

  // 1. Assign Suspects to Players (honoring lobby selections if provided)
  const usedSuspects = new Set<ClueSuspect>();
  const playerSuspects: Record<string, ClueSuspect> = {};

  for (const pid of playerIds) {
    const rawColor = options?.playerColors?.[pid];
    const mapped = rawColor ? COLOR_TO_SUSPECT_MAP[rawColor] : undefined;
    if (mapped && !usedSuspects.has(mapped)) {
      playerSuspects[pid] = mapped;
      usedSuspects.add(mapped);
    }
  }

  for (const pid of playerIds) {
    if (!playerSuspects[pid]) {
      const available =
        ALL_CLUE_SUSPECTS.find((s) => !usedSuspects.has(s)) ?? 'Miss Scarlet';
      playerSuspects[pid] = available;
      usedSuspects.add(available);
    }
  }

  // 2. Select 1 Suspect, 1 Weapon, and 1 Room for the Confidential Solution
  const shuffledSuspects = shuffleWithRng(ALL_CLUE_SUSPECTS, rng);
  rng = shuffledSuspects.nextState;
  const shuffledWeapons = shuffleWithRng(ALL_CLUE_WEAPONS, rng);
  rng = shuffledWeapons.nextState;
  const shuffledRooms = shuffleWithRng(ALL_CLUE_ROOMS, rng);
  rng = shuffledRooms.nextState;

  const solution: ClueSolution = {
    suspect: shuffledSuspects.shuffled[0]!,
    weapon: shuffledWeapons.shuffled[0]!,
    room: shuffledRooms.shuffled[0]!,
  };

  // 3. Shuffle the remaining 18 cards together and deal evenly to players
  const remainingCards: ClueCard[] = [
    ...shuffledSuspects.shuffled.slice(1).map((name) => ({
      id: name,
      name,
      category: 'SUSPECT' as const,
    })),
    ...shuffledWeapons.shuffled.slice(1).map((name) => ({
      id: name,
      name,
      category: 'WEAPON' as const,
    })),
    ...shuffledRooms.shuffled.slice(1).map((name) => ({
      id: name,
      name,
      category: 'ROOM' as const,
    })),
  ];

  const dealtDeck = shuffleWithRng(remainingCards, rng);
  rng = dealtDeck.nextState;

  const handsByPlayer: Record<string, ClueCard[]> = {};
  for (const pid of playerIds) {
    handsByPlayer[pid] = [];
  }
  dealtDeck.shuffled.forEach((card, index) => {
    const targetPid = playerIds[index % playerIds.length]!;
    handsByPlayer[targetPid]!.push(card);
  });

  const players: Record<string, CluePlayerState> = {};
  for (const pid of playerIds) {
    const hand = handsByPlayer[pid]!;
    players[pid] = {
      id: pid,
      suspect: playerSuspects[pid]!,
      hand,
      eliminated: false,
      wasMovedBySuggestion: false,
      notepad: createInitialNotepad(hand),
      receivedClues: [],
    };
  }

  // 4. Place all 6 Suspect pawns on their Starting Squares
  const suspectPositions = {} as Record<ClueSuspect, CluePawnPosition>;
  for (const suspect of ALL_CLUE_SUSPECTS) {
    suspectPositions[suspect] = { kind: 'START', suspect };
  }

  // 5. Place all 6 Weapon tokens in distinct Mansion Rooms
  const weaponPositions = {} as Record<ClueWeapon, ClueRoom>;
  ALL_CLUE_WEAPONS.forEach((weapon, idx) => {
    weaponPositions[weapon] = ALL_CLUE_ROOMS[idx % ALL_CLUE_ROOMS.length]!;
  });

  const firstPlayerId = playerIds[0]!;
  const firstSuspect = players[firstPlayerId]!.suspect;

  return {
    gameId: 'clue',
    phase: 'PLAYING',
    turnStep: 'CHOOSE_MOVE_METHOD',
    turnNumber: 1,
    rngState: rng,
    playerOrder: [...playerIds],
    activePlayerIndex: 0,
    solution,
    players,
    suspectPositions,
    weaponPositions,
    lastDiceRoll: null,
    movesRemaining: 0,
    enteredRoomThisTurn: null,
    activeSuggestion: null,
    winnerId: null,
    winningAccusation: null,
    lastActionSummary: `Case File sealed! ${firstPlayerId} (${firstSuspect}) begins the investigation.`,
  };
}

export function getMatchingSuggestionCards(
  hand: readonly ClueCard[],
  suggestion: {
    readonly suspect: ClueSuspect;
    readonly weapon: ClueWeapon;
    readonly room: ClueRoom;
  }
): ClueCardName[] {
  return hand
    .map((c) => c.name)
    .filter(
      (name) =>
        name === suggestion.suspect ||
        name === suggestion.weapon ||
        name === suggestion.room
    );
}

function getOccupiedHallwayKeys(
  state: ClueGameState,
  excludeSuspect?: ClueSuspect
): Set<string> {
  const occupied = new Set<string>();
  const eliminatedSuspects = new Set<ClueSuspect>(
    Object.values(state.players)
      .filter((p) => p.eliminated)
      .map((p) => p.suspect)
  );
  for (const [suspect, pos] of Object.entries(state.suspectPositions) as Array<
    [ClueSuspect, CluePawnPosition]
  >) {
    if (suspect === excludeSuspect) continue;
    if (eliminatedSuspects.has(suspect)) continue;
    if (pos.kind === 'HALLWAY') {
      occupied.add(coordKey(pos.x, pos.y));
    }
  }
  return occupied;
}

function findNextNonEliminatedPlayerIndex(
  playerOrder: readonly string[],
  players: Readonly<Record<string, CluePlayerState>>,
  fromIndex: number
): number | null {
  const n = playerOrder.length;
  for (let offset = 1; offset <= n; offset++) {
    const idx = (fromIndex + offset) % n;
    const pid = playerOrder[idx]!;
    if (!players[pid]!.eliminated) {
      return idx;
    }
  }
  return null;
}

export function validateClueAction(
  state: ClueGameState,
  playerId: string,
  action: ClueAction
): ValidationResult {
  if (state.phase === 'GAME_OVER') {
    return { valid: false, reason: 'The game is already over.' };
  }

  const player = state.players[playerId];
  if (!player) {
    return { valid: false, reason: `Unknown player "${playerId}".` };
  }

  // Notepad toggling is allowed by any player at any time
  if (action.type === 'CLUE_TOGGLE_NOTEPAD') {
    if (!ALL_CLUE_CARDS.some((c) => c.name === action.card)) {
      return { valid: false, reason: 'Invalid Clue card name.' };
    }
    return { valid: true };
  }

  // During the Disprove interruption loop, ONLY disproverPlayerId can act!
  if (state.turnStep === 'DISPROVING') {
    if (action.type !== 'CLUE_DISPROVE_SUGGESTION') {
      return {
        valid: false,
        reason: `Waiting for ${state.activeSuggestion?.disproverPlayerId} to show a card to disprove the suggestion.`,
      };
    }
    if (
      !state.activeSuggestion ||
      state.activeSuggestion.disproverPlayerId !== playerId
    ) {
      return {
        valid: false,
        reason: 'It is not your turn to disprove this suggestion.',
      };
    }
    const matching = getMatchingSuggestionCards(
      player.hand,
      state.activeSuggestion
    );
    if (!matching.includes(action.card)) {
      return {
        valid: false,
        reason:
          'You must select a card from your hand that matches the suggested Suspect, Weapon, or Room.',
      };
    }
    return { valid: true };
  }

  // All other actions require being the active player (and not eliminated)
  const activePlayerId = state.playerOrder[state.activePlayerIndex]!;
  if (playerId !== activePlayerId) {
    return {
      valid: false,
      reason: `It is currently ${activePlayerId}'s turn.`,
    };
  }
  if (player.eliminated) {
    return {
      valid: false,
      reason: 'You have been eliminated after an incorrect accusation.',
    };
  }

  const currentPos = state.suspectPositions[player.suspect];

  switch (action.type) {
    case 'CLUE_ROLL_DICE': {
      if (state.turnStep !== 'CHOOSE_MOVE_METHOD') {
        return {
          valid: false,
          reason: 'You have already chosen your movement method this turn.',
        };
      }
      return { valid: true };
    }

    case 'CLUE_USE_SECRET_PASSAGE': {
      if (state.turnStep !== 'CHOOSE_MOVE_METHOD') {
        return {
          valid: false,
          reason: 'Secret Passages can only be used before rolling the dice.',
        };
      }
      if (currentPos.kind !== 'ROOM') {
        return {
          valid: false,
          reason: 'You must be inside a room with a Secret Passage to use it.',
        };
      }
      const roomDef = CLUE_ROOM_DEFINITIONS[currentPos.room];
      if (!roomDef.secretPassageTo) {
        return {
          valid: false,
          reason: `The ${currentPos.room} does not have a Secret Passage.`,
        };
      }
      return { valid: true };
    }

    case 'CLUE_STAY_IN_ROOM': {
      if (state.turnStep !== 'CHOOSE_MOVE_METHOD') {
        return {
          valid: false,
          reason: 'You can only choose to stay in the room at the start of your turn.',
        };
      }
      if (currentPos.kind !== 'ROOM' || !player.wasMovedBySuggestion) {
        return {
          valid: false,
          reason:
            'You may only stay in your current room without moving if you were moved there by another player’s Suggestion.',
        };
      }
      return { valid: true };
    }

    case 'CLUE_MOVE_TO_HALLWAY': {
      if (state.turnStep !== 'SELECT_DESTINATION') {
        return {
          valid: false,
          reason: 'Roll the dice before moving to a hallway space.',
        };
      }
      const occupied = getOccupiedHallwayKeys(state, player.suspect);
      const reachable = getReachableClueTargets(
        currentPos,
        state.movesRemaining,
        occupied
      );
      const key = coordKey(action.x, action.y);
      const dist = reachable.hallways.get(key);
      if (dist === undefined) {
        return {
          valid: false,
          reason: `Hallway (X${action.x}, Y${action.y}) is not reachable within ${state.movesRemaining} step(s).`,
        };
      }
      return { valid: true };
    }

    case 'CLUE_MOVE_TO_ROOM': {
      if (state.turnStep !== 'SELECT_DESTINATION') {
        return {
          valid: false,
          reason: 'Roll the dice before moving into a room.',
        };
      }
      const occupied = getOccupiedHallwayKeys(state, player.suspect);
      const reachable = getReachableClueTargets(
        currentPos,
        state.movesRemaining,
        occupied
      );
      const dist = reachable.rooms.get(action.room);
      if (dist === undefined) {
        return {
          valid: false,
          reason: `${action.room} is not reachable within ${state.movesRemaining} step(s).`,
        };
      }
      return { valid: true };
    }

    case 'CLUE_MAKE_SUGGESTION': {
      if (state.turnStep !== 'MAKE_SUGGESTION_OR_END') {
        return {
          valid: false,
          reason:
            'You can only make a Suggestion after entering a room this turn.',
        };
      }
      if (currentPos.kind !== 'ROOM') {
        return {
          valid: false,
          reason: 'You must be inside a Room to make a Suggestion.',
        };
      }
      if (!ALL_CLUE_SUSPECTS.includes(action.suspect)) {
        return { valid: false, reason: 'Invalid Suspect.' };
      }
      if (!ALL_CLUE_WEAPONS.includes(action.weapon)) {
        return { valid: false, reason: 'Invalid Weapon.' };
      }
      return { valid: true };
    }

    case 'CLUE_MAKE_ACCUSATION': {
      if (
        !ALL_CLUE_SUSPECTS.includes(action.suspect) ||
        !ALL_CLUE_WEAPONS.includes(action.weapon) ||
        !ALL_CLUE_ROOMS.includes(action.room)
      ) {
        return {
          valid: false,
          reason: 'Accusation must include a valid Suspect, Weapon, and Room.',
        };
      }
      return { valid: true };
    }

    case 'CLUE_END_TURN': {
      if (state.turnStep === 'CHOOSE_MOVE_METHOD') {
        return {
          valid: false,
          reason: 'You must roll the dice or use a Secret Passage before ending your turn.',
        };
      }
      return { valid: true };
    }

    default:
      return { valid: false, reason: 'Unsupported Clue action.' };
  }
}

export function applyClueAction(
  state: ClueGameState,
  playerId: string,
  action: ClueAction
): ClueGameState {
  const validation = validateClueAction(state, playerId, action);
  if (!validation.valid) {
    throw new Error(validation.reason ?? 'Invalid Clue action');
  }

  // 1. Notepad Toggle (non-turn-advancing personal detective note)
  if (action.type === 'CLUE_TOGGLE_NOTEPAD') {
    const p = state.players[playerId]!;
    const currentMark = p.notepad[action.card] ?? 'UNKNOWN';
    const cycle: ClueNotepadMark[] = ['UNKNOWN', 'NO', 'MAYBE', 'YES'];
    const nextMark =
      action.mark ??
      cycle[(cycle.indexOf(currentMark) + 1) % cycle.length]!;
    return {
      ...state,
      players: {
        ...state.players,
        [playerId]: {
          ...p,
          notepad: {
            ...p.notepad,
            [action.card]: nextMark,
          },
        },
      },
    };
  }

  const activePlayerId = state.playerOrder[state.activePlayerIndex]!;
  const activePlayer = state.players[activePlayerId]!;
  let rng = state.rngState;

  // 2. Roll Dice
  if (action.type === 'CLUE_ROLL_DICE') {
    const r1 = nextRandom(rng);
    rng = r1.nextState;
    const r2 = nextRandom(rng);
    rng = r2.nextState;
    const die1 = Math.floor(r1.value * 6) + 1;
    const die2 = Math.floor(r2.value * 6) + 1;
    const total = die1 + die2;

    const currentPos = state.suspectPositions[activePlayer.suspect];
    const occupied = getOccupiedHallwayKeys(state, activePlayer.suspect);
    const reachable = getReachableClueTargets(currentPos, total, occupied);
    const hasAnyMove =
      reachable.hallways.size > 0 || reachable.rooms.size > 0;

    return {
      ...state,
      rngState: rng,
      lastDiceRoll: [die1, die2],
      movesRemaining: hasAnyMove ? total : 0,
      turnStep: hasAnyMove ? 'SELECT_DESTINATION' : 'POST_SUGGESTION',
      activeSuggestion: null,
      players: {
        ...state.players,
        [activePlayerId]: {
          ...activePlayer,
          wasMovedBySuggestion: false,
        },
      },
      lastActionSummary: hasAnyMove
        ? `${activePlayerId} (${activePlayer.suspect}) rolled ${die1} + ${die2} = ${total}.`
        : `${activePlayerId} (${activePlayer.suspect}) rolled ${die1} + ${die2} = ${total}, but all exits are blocked!`,
    };
  }

  // 3. Use Secret Passage (Study <-> Kitchen, Lounge <-> Conservatory)
  if (action.type === 'CLUE_USE_SECRET_PASSAGE') {
    const currentPos = state.suspectPositions[activePlayer.suspect];
    if (currentPos.kind !== 'ROOM') return state;
    const targetRoom = CLUE_ROOM_DEFINITIONS[currentPos.room].secretPassageTo!;

    return {
      ...state,
      lastDiceRoll: null,
      movesRemaining: 0,
      enteredRoomThisTurn: targetRoom,
      turnStep: 'MAKE_SUGGESTION_OR_END',
      activeSuggestion: null,
      suspectPositions: {
        ...state.suspectPositions,
        [activePlayer.suspect]: { kind: 'ROOM', room: targetRoom },
      },
      players: {
        ...state.players,
        [activePlayerId]: {
          ...activePlayer,
          wasMovedBySuggestion: false,
        },
      },
      lastActionSummary: `${activePlayerId} (${activePlayer.suspect}) took the Secret Passage from the ${currentPos.room} to the ${targetRoom}!`,
    };
  }

  // 4. Stay in Current Room (when moved there by another player's suggestion)
  if (action.type === 'CLUE_STAY_IN_ROOM') {
    const currentPos = state.suspectPositions[activePlayer.suspect];
    if (currentPos.kind !== 'ROOM') return state;
    return {
      ...state,
      lastDiceRoll: null,
      movesRemaining: 0,
      enteredRoomThisTurn: currentPos.room,
      turnStep: 'MAKE_SUGGESTION_OR_END',
      activeSuggestion: null,
      players: {
        ...state.players,
        [activePlayerId]: {
          ...activePlayer,
          wasMovedBySuggestion: false,
        },
      },
      lastActionSummary: `${activePlayerId} (${activePlayer.suspect}) stayed in the ${currentPos.room} (after being summoned by a Suggestion) to make a Suggestion.`,
    };
  }

  // 5. Move to a Hallway Space
  if (action.type === 'CLUE_MOVE_TO_HALLWAY') {
    const currentPos = state.suspectPositions[activePlayer.suspect];
    const occupied = getOccupiedHallwayKeys(state, activePlayer.suspect);
    const reachable = getReachableClueTargets(
      currentPos,
      state.movesRemaining,
      occupied
    );
    const stepsUsed =
      reachable.hallways.get(coordKey(action.x, action.y)) ??
      state.movesRemaining;
    const remaining = Math.max(0, state.movesRemaining - stepsUsed);

    const newPos: CluePawnPosition = {
      kind: 'HALLWAY',
      x: action.x,
      y: action.y,
    };
    const nextReachable =
      remaining > 0
        ? getReachableClueTargets(newPos, remaining, occupied)
        : { hallways: new Map(), rooms: new Map() };
    const canKeepMoving =
      remaining > 0 &&
      (nextReachable.hallways.size > 0 || nextReachable.rooms.size > 0);

    return {
      ...state,
      movesRemaining: canKeepMoving ? remaining : 0,
      turnStep: canKeepMoving ? 'SELECT_DESTINATION' : 'POST_SUGGESTION',
      suspectPositions: {
        ...state.suspectPositions,
        [activePlayer.suspect]: newPos,
      },
      lastActionSummary: `${activePlayerId} (${activePlayer.suspect}) moved to hallway (X${action.x}, Y${action.y})${
        canKeepMoving ? ` (${remaining} step(s) left)` : ''
      }.`,
    };
  }

  // 6. Move into a Room (Entering a room immediately ends movement for the turn!)
  if (action.type === 'CLUE_MOVE_TO_ROOM') {
    return {
      ...state,
      movesRemaining: 0,
      enteredRoomThisTurn: action.room,
      turnStep: 'MAKE_SUGGESTION_OR_END',
      suspectPositions: {
        ...state.suspectPositions,
        [activePlayer.suspect]: { kind: 'ROOM', room: action.room },
      },
      lastActionSummary: `${activePlayerId} (${activePlayer.suspect}) entered the ${action.room}.`,
    };
  }

  // 7. Make a Suggestion (Teleports Suspect & Weapon into current Room + initiates clockwise Disprove loop)
  if (action.type === 'CLUE_MAKE_SUGGESTION') {
    const currentPos = state.suspectPositions[activePlayer.suspect];
    if (currentPos.kind !== 'ROOM') return state;
    const suggestedRoom = currentPos.room;

    // Teleport the named Suspect and Weapon into suggestedRoom
    const nextSuspectPositions: Record<ClueSuspect, CluePawnPosition> = {
      ...state.suspectPositions,
      [action.suspect]: { kind: 'ROOM', room: suggestedRoom },
    };
    const nextWeaponPositions: Record<ClueWeapon, ClueRoom> = {
      ...state.weaponPositions,
      [action.weapon]: suggestedRoom,
    };

    // If another player is playing as `action.suspect` and wasn't already in `suggestedRoom`, mark `wasMovedBySuggestion = true`
    const nextPlayers: Record<string, CluePlayerState> = { ...state.players };
    for (const pid of state.playerOrder) {
      const p = nextPlayers[pid]!;
      if (p.suspect === action.suspect && pid !== activePlayerId) {
        nextPlayers[pid] = {
          ...p,
          wasMovedBySuggestion: true,
        };
      }
    }

    // Build clockwise check order starting left of activePlayerIndex
    const n = state.playerOrder.length;
    const checkOrder: string[] = [];
    for (let offset = 1; offset < n; offset++) {
      checkOrder.push(state.playerOrder[(state.activePlayerIndex + offset) % n]!);
    }

    // Walk clockwise until we find the first player with >= 1 matching card
    const passedPlayerIds: string[] = [];
    let disproverPlayerId: string | null = null;
    let currentCheckIndex = checkOrder.length;

    for (let i = 0; i < checkOrder.length; i++) {
      const checkPid = checkOrder[i]!;
      const matches = getMatchingSuggestionCards(nextPlayers[checkPid]!.hand, {
        suspect: action.suspect,
        weapon: action.weapon,
        room: suggestedRoom,
      });
      if (matches.length > 0) {
        disproverPlayerId = checkPid;
        currentCheckIndex = i;
        break;
      } else {
        passedPlayerIds.push(checkPid);
      }
    }

    const activeSuggestion: ClueActiveSuggestion = {
      suggestingPlayerId: activePlayerId,
      suspect: action.suspect,
      weapon: action.weapon,
      room: suggestedRoom,
      checkOrder,
      currentCheckIndex,
      disproverPlayerId,
      passedPlayerIds,
      resolved: disproverPlayerId === null,
      shownByPlayerId: null,
      shownCard: null,
    };

    const suggestionText = `"${action.suspect} with the ${action.weapon} in the ${suggestedRoom}"`;

    if (disproverPlayerId !== null) {
      return {
        ...state,
        turnStep: 'DISPROVING',
        players: nextPlayers,
        suspectPositions: nextSuspectPositions,
        weaponPositions: nextWeaponPositions,
        activeSuggestion,
        lastActionSummary: `${activePlayerId} suggested ${suggestionText}. Waiting for ${disproverPlayerId} to privately show a disproving card.`,
      };
    }

    return {
      ...state,
      turnStep: 'POST_SUGGESTION',
      players: nextPlayers,
      suspectPositions: nextSuspectPositions,
      weaponPositions: nextWeaponPositions,
      activeSuggestion,
      lastActionSummary: `${activePlayerId} suggested ${suggestionText} — No player could disprove the suggestion!`,
    };
  }

  // 8. Disprove Suggestion (Interrupter privately shows 1 matching card to suggesting player)
  if (action.type === 'CLUE_DISPROVE_SUGGESTION' && state.activeSuggestion) {
    const sug = state.activeSuggestion;
    const suggestingPlayer = state.players[sug.suggestingPlayerId]!;

    const updatedSuggestion: ClueActiveSuggestion = {
      ...sug,
      disproverPlayerId: null,
      resolved: true,
      shownByPlayerId: playerId,
      shownCard: action.card,
    };

    const updatedSuggestingPlayer: CluePlayerState = {
      ...suggestingPlayer,
      notepad: {
        ...suggestingPlayer.notepad,
        [action.card]: 'YES',
      },
      receivedClues: [
        {
          turnNumber: state.turnNumber,
          fromPlayerId: playerId,
          card: action.card,
          suggestion: {
            suspect: sug.suspect,
            weapon: sug.weapon,
            room: sug.room,
          },
        },
        ...suggestingPlayer.receivedClues,
      ],
    };

    return {
      ...state,
      turnStep: 'POST_SUGGESTION',
      players: {
        ...state.players,
        [sug.suggestingPlayerId]: updatedSuggestingPlayer,
      },
      activeSuggestion: updatedSuggestion,
      lastActionSummary: `${playerId} privately showed a card to ${sug.suggestingPlayerId} to disprove "${sug.suspect} with the ${sug.weapon} in the ${sug.room}".`,
    };
  }

  // 9. Make Final Accusation
  if (action.type === 'CLUE_MAKE_ACCUSATION') {
    const isCorrect =
      action.suspect === state.solution.suspect &&
      action.weapon === state.solution.weapon &&
      action.room === state.solution.room;

    if (isCorrect) {
      return {
        ...state,
        phase: 'GAME_OVER',
        turnStep: 'GAME_OVER',
        winnerId: activePlayerId,
        winningAccusation: {
          suspect: action.suspect,
          weapon: action.weapon,
          room: action.room,
        },
        lastActionSummary: `🎉 ${activePlayerId} (${activePlayer.suspect}) solved the mystery! It was ${action.suspect} with the ${action.weapon} in the ${action.room}!`,
      };
    }

    // Wrong accusation -> eliminate player from moving/accusing (they still disprove suggestions)
    const nextPlayers: Record<string, CluePlayerState> = {
      ...state.players,
      [activePlayerId]: {
        ...activePlayer,
        eliminated: true,
      },
    };

    const nextActiveIdx = findNextNonEliminatedPlayerIndex(
      state.playerOrder,
      nextPlayers,
      state.activePlayerIndex
    );

    if (nextActiveIdx === null) {
      return {
        ...state,
        phase: 'GAME_OVER',
        turnStep: 'GAME_OVER',
        players: nextPlayers,
        winnerId: null,
        lastActionSummary: `❌ ${activePlayerId} made an incorrect accusation (${action.suspect}, ${action.weapon}, ${action.room}) and was eliminated! All detectives have been eliminated — Case Unsolved!`,
      };
    }

    const nextPid = state.playerOrder[nextActiveIdx]!;
    return {
      ...state,
      turnStep: 'CHOOSE_MOVE_METHOD',
      turnNumber: state.turnNumber + 1,
      activePlayerIndex: nextActiveIdx,
      players: nextPlayers,
      lastDiceRoll: null,
      movesRemaining: 0,
      enteredRoomThisTurn: null,
      activeSuggestion: null,
      lastActionSummary: `❌ ${activePlayerId} made an incorrect accusation (${action.suspect}, ${action.weapon}, ${action.room}) and is eliminated from moving/accusing! Turn passes to ${nextPid}.`,
    };
  }

  // 10. End Turn
  if (action.type === 'CLUE_END_TURN') {
    const nextActiveIdx =
      findNextNonEliminatedPlayerIndex(
        state.playerOrder,
        state.players,
        state.activePlayerIndex
      ) ?? state.activePlayerIndex;
    const nextPid = state.playerOrder[nextActiveIdx]!;

    return {
      ...state,
      turnStep: 'CHOOSE_MOVE_METHOD',
      turnNumber: state.turnNumber + 1,
      activePlayerIndex: nextActiveIdx,
      lastDiceRoll: null,
      movesRemaining: 0,
      enteredRoomThisTurn: null,
      activeSuggestion: null,
      lastActionSummary: `${activePlayerId} ended their turn. It is now ${nextPid}'s turn.`,
    };
  }

  return state;
}

/**
 * Strictly sanitizes the Clue game state for `playerId`:
 * - Strips `solution` unless `phase === 'GAME_OVER'`.
 * - Strips all other players' `hand`, `notepad`, and `receivedClues`.
 * - Strips `activeSuggestion.shownCard` unless `playerId` is the suggesting player or the player who showed the card.
 */
export function getCluePlayerPerspective(
  state: ClueGameState,
  playerId: string
): ClueSanitizedGameState {
  const effectivePid = state.players[playerId]
    ? playerId
    : state.playerOrder[0]!;
  const selfPlayer = state.players[effectivePid]!;
  const activePlayerId =
    state.playerOrder[state.activePlayerIndex] ?? state.playerOrder[0]!;

  const opponents: Record<string, CluePublicOpponentState> = {};
  for (const pid of state.playerOrder) {
    if (pid === effectivePid) continue;
    const opp = state.players[pid]!;
    opponents[pid] = {
      id: opp.id,
      suspect: opp.suspect,
      handCount: opp.hand.length,
      eliminated: opp.eliminated,
      wasMovedBySuggestion: opp.wasMovedBySuggestion,
    };
  }

  let sanitizedSuggestion: ClueSanitizedSuggestion | null = null;
  let matchingCardsToDisprove: ClueCardName[] = [];

  if (state.activeSuggestion) {
    const sug = state.activeSuggestion;
    const canSeeShownCard =
      effectivePid === sug.suggestingPlayerId ||
      effectivePid === sug.shownByPlayerId;

    sanitizedSuggestion = {
      suggestingPlayerId: sug.suggestingPlayerId,
      suspect: sug.suspect,
      weapon: sug.weapon,
      room: sug.room,
      disproverPlayerId: sug.disproverPlayerId,
      passedPlayerIds: sug.passedPlayerIds,
      resolved: sug.resolved,
      shownByPlayerId: sug.shownByPlayerId,
      shownCard: canSeeShownCard ? sug.shownCard : null,
    };

    if (
      state.turnStep === 'DISPROVING' &&
      sug.disproverPlayerId === effectivePid
    ) {
      matchingCardsToDisprove = getMatchingSuggestionCards(
        selfPlayer.hand,
        sug
      );
    }
  }

  return {
    gameId: 'clue',
    phase: state.phase,
    turnStep: state.turnStep,
    turnNumber: state.turnNumber,
    playerOrder: state.playerOrder,
    activePlayerIndex: state.activePlayerIndex,
    activePlayerId,
    self: {
      id: selfPlayer.id,
      suspect: selfPlayer.suspect,
      hand: selfPlayer.hand,
      handCount: selfPlayer.hand.length,
      eliminated: selfPlayer.eliminated,
      wasMovedBySuggestion: selfPlayer.wasMovedBySuggestion,
      notepad: selfPlayer.notepad,
      receivedClues: selfPlayer.receivedClues,
    },
    opponents,
    suspectPositions: state.suspectPositions,
    weaponPositions: state.weaponPositions,
    lastDiceRoll: state.lastDiceRoll,
    movesRemaining: state.movesRemaining,
    enteredRoomThisTurn: state.enteredRoomThisTurn,
    activeSuggestion: sanitizedSuggestion,
    matchingCardsToDisprove,
    winnerId: state.winnerId,
    revealedSolution: state.phase === 'GAME_OVER' ? state.solution : null,
    lastActionSummary: state.lastActionSummary,
  };
}

export function calculateClueFinalScores(
  state: ClueGameState
): Record<string, number> {
  const scores: Record<string, number> = {};
  for (const pid of state.playerOrder) {
    scores[pid] = state.winnerId === pid ? 1 : 0;
  }
  return scores;
}
