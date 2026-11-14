export type ClueSuspect =
  | 'Miss Scarlet'
  | 'Colonel Mustard'
  | 'Mrs. White'
  | 'Mr. Green'
  | 'Mrs. Peacock'
  | 'Professor Plum';

export type ClueWeapon =
  | 'Candlestick'
  | 'Dagger'
  | 'Lead Pipe'
  | 'Revolver'
  | 'Rope'
  | 'Wrench';

export type ClueRoom =
  | 'Kitchen'
  | 'Ballroom'
  | 'Conservatory'
  | 'Dining Room'
  | 'Billiard Room'
  | 'Library'
  | 'Lounge'
  | 'Hall'
  | 'Study';

export type ClueCardName = ClueSuspect | ClueWeapon | ClueRoom;

export type ClueCardCategory = 'SUSPECT' | 'WEAPON' | 'ROOM';

export interface ClueCard {
  readonly id: ClueCardName;
  readonly name: ClueCardName;
  readonly category: ClueCardCategory;
}

export const ALL_CLUE_SUSPECTS: readonly ClueSuspect[] = [
  'Miss Scarlet',
  'Colonel Mustard',
  'Mrs. White',
  'Mr. Green',
  'Mrs. Peacock',
  'Professor Plum',
] as const;

export const ALL_CLUE_WEAPONS: readonly ClueWeapon[] = [
  'Candlestick',
  'Dagger',
  'Lead Pipe',
  'Revolver',
  'Rope',
  'Wrench',
] as const;

export const ALL_CLUE_ROOMS: readonly ClueRoom[] = [
  'Kitchen',
  'Ballroom',
  'Conservatory',
  'Dining Room',
  'Billiard Room',
  'Library',
  'Lounge',
  'Hall',
  'Study',
] as const;

export const ALL_CLUE_CARDS: readonly ClueCard[] = [
  ...ALL_CLUE_SUSPECTS.map((name) => ({
    id: name,
    name,
    category: 'SUSPECT' as const,
  })),
  ...ALL_CLUE_WEAPONS.map((name) => ({
    id: name,
    name,
    category: 'WEAPON' as const,
  })),
  ...ALL_CLUE_ROOMS.map((name) => ({
    id: name,
    name,
    category: 'ROOM' as const,
  })),
];

export interface ClueSolution {
  readonly suspect: ClueSuspect;
  readonly weapon: ClueWeapon;
  readonly room: ClueRoom;
}

export interface ClueGridCoord {
  readonly x: number; // 1 .. 24
  readonly y: number; // 1 .. 25
}

export type CluePawnPosition =
  | { readonly kind: 'START'; readonly suspect: ClueSuspect }
  | { readonly kind: 'HALLWAY'; readonly x: number; readonly y: number }
  | { readonly kind: 'ROOM'; readonly room: ClueRoom };

export type ClueNotepadMark = 'UNKNOWN' | 'NO' | 'YES' | 'MAYBE';

export type CluePhase = 'PLAYING' | 'GAME_OVER';

export type ClueTurnStep =
  | 'CHOOSE_MOVE_METHOD' // Roll dice, take Secret Passage, or stay in Room if moved by suggestion
  | 'SELECT_DESTINATION' // After rolling dice, choose reachable hallway or room
  | 'MAKE_SUGGESTION_OR_END' // If in a room after moving (or staying), can make a Suggestion, Accusation, or End Turn
  | 'DISPROVING' // Clockwise interruption loop waiting on disproverPlayerId to choose 1 matching card
  | 'POST_SUGGESTION' // After suggestion is disproved or passed by all: Active player may make an Accusation or End Turn
  | 'GAME_OVER';

export interface ClueActiveSuggestion {
  readonly suggestingPlayerId: string;
  readonly suspect: ClueSuspect;
  readonly weapon: ClueWeapon;
  readonly room: ClueRoom;
  readonly checkOrder: readonly string[]; // Clockwise playerIds starting left of suggestingPlayerId
  readonly currentCheckIndex: number;
  readonly disproverPlayerId: string | null; // Player currently prompted to show a card (if they have >=1 match)
  readonly passedPlayerIds: readonly string[];
  readonly resolved: boolean;
  readonly shownByPlayerId: string | null;
  readonly shownCard: ClueCardName | null; // Secret in raw state; stripped for everyone except suggestingPlayerId & disproverPlayerId
}

export interface ClueShownClueRecord {
  readonly turnNumber: number;
  readonly fromPlayerId: string;
  readonly card: ClueCardName;
  readonly suggestion: {
    readonly suspect: ClueSuspect;
    readonly weapon: ClueWeapon;
    readonly room: ClueRoom;
  };
}

export interface CluePlayerState {
  readonly id: string;
  readonly suspect: ClueSuspect;
  readonly hand: readonly ClueCard[];
  readonly eliminated: boolean;
  readonly wasMovedBySuggestion: boolean;
  readonly notepad: Readonly<Record<ClueCardName, ClueNotepadMark>>;
  readonly receivedClues: readonly ClueShownClueRecord[];
}

export interface CluePublicOpponentState {
  readonly id: string;
  readonly suspect: ClueSuspect;
  readonly handCount: number;
  readonly eliminated: boolean;
  readonly wasMovedBySuggestion: boolean;
}

export interface ClueSelfPlayerState {
  readonly id: string;
  readonly suspect: ClueSuspect;
  readonly hand: readonly ClueCard[];
  readonly handCount: number;
  readonly eliminated: boolean;
  readonly wasMovedBySuggestion: boolean;
  readonly notepad: Readonly<Record<ClueCardName, ClueNotepadMark>>;
  readonly receivedClues: readonly ClueShownClueRecord[];
}

export interface ClueGameState {
  readonly gameId: 'clue';
  readonly phase: CluePhase;
  readonly turnStep: ClueTurnStep;
  readonly turnNumber: number;
  readonly rngState: number;
  readonly playerOrder: readonly string[];
  readonly activePlayerIndex: number;
  readonly solution: ClueSolution;
  readonly players: Readonly<Record<string, CluePlayerState>>;
  readonly suspectPositions: Readonly<Record<ClueSuspect, CluePawnPosition>>;
  readonly weaponPositions: Readonly<Record<ClueWeapon, ClueRoom>>;
  readonly lastDiceRoll: readonly [number, number] | null;
  readonly movesRemaining: number;
  readonly enteredRoomThisTurn: ClueRoom | null;
  readonly activeSuggestion: ClueActiveSuggestion | null;
  readonly winnerId: string | null;
  readonly winningAccusation: ClueSolution | null;
  readonly lastActionSummary: string | null;
}

export interface ClueSanitizedSuggestion {
  readonly suggestingPlayerId: string;
  readonly suspect: ClueSuspect;
  readonly weapon: ClueWeapon;
  readonly room: ClueRoom;
  readonly disproverPlayerId: string | null;
  readonly passedPlayerIds: readonly string[];
  readonly resolved: boolean;
  readonly shownByPlayerId: string | null;
  readonly shownCard: ClueCardName | null; // ONLY visible to suggestingPlayerId and disproverPlayerId
}

export interface ClueSanitizedGameState {
  readonly gameId: 'clue';
  readonly phase: CluePhase;
  readonly turnStep: ClueTurnStep;
  readonly turnNumber: number;
  readonly playerOrder: readonly string[];
  readonly activePlayerIndex: number;
  readonly activePlayerId: string;
  readonly self: ClueSelfPlayerState;
  readonly opponents: Readonly<Record<string, CluePublicOpponentState>>;
  readonly suspectPositions: Readonly<Record<ClueSuspect, CluePawnPosition>>;
  readonly weaponPositions: Readonly<Record<ClueWeapon, ClueRoom>>;
  readonly lastDiceRoll: readonly [number, number] | null;
  readonly movesRemaining: number;
  readonly enteredRoomThisTurn: ClueRoom | null;
  readonly activeSuggestion: ClueSanitizedSuggestion | null;
  readonly matchingCardsToDisprove: readonly ClueCardName[]; // Populated if viewing player is disproverPlayerId
  readonly winnerId: string | null;
  readonly revealedSolution: ClueSolution | null; // Revealed only when phase === 'GAME_OVER'
  readonly lastActionSummary: string | null;
}

export type ClueAction =
  | { readonly type: 'CLUE_ROLL_DICE' }
  | { readonly type: 'CLUE_USE_SECRET_PASSAGE' }
  | { readonly type: 'CLUE_STAY_IN_ROOM' }
  | {
      readonly type: 'CLUE_MOVE_TO_HALLWAY';
      readonly x: number;
      readonly y: number;
    }
  | {
      readonly type: 'CLUE_MOVE_TO_ROOM';
      readonly room: ClueRoom;
    }
  | {
      readonly type: 'CLUE_MAKE_SUGGESTION';
      readonly suspect: ClueSuspect;
      readonly weapon: ClueWeapon;
    }
  | {
      readonly type: 'CLUE_DISPROVE_SUGGESTION';
      readonly card: ClueCardName;
    }
  | {
      readonly type: 'CLUE_MAKE_ACCUSATION';
      readonly suspect: ClueSuspect;
      readonly weapon: ClueWeapon;
      readonly room: ClueRoom;
    }
  | {
      readonly type: 'CLUE_TOGGLE_NOTEPAD';
      readonly card: ClueCardName;
      readonly mark?: ClueNotepadMark;
    }
  | { readonly type: 'CLUE_END_TURN' };
