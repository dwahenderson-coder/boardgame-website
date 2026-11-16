import type { AnyGameAction } from '../games/registry.js';

export type SoundEffectId =
  | 'TURN_CHIME'
  | 'DICE_ROLL'
  | 'CARD_SNAP'
  | 'CARD_SHUFFLE'
  | 'TRAIN_WHISTLE'
  | 'WOOD_BUILD'
  | 'COIN_CHINK'
  | 'TABLE_KNOCK'
  | 'ROBBER_THUD'
  | 'MYSTERY_STING'
  | 'FOOTSTEP_TAP'
  | 'ERROR_BUZZ'
  | 'VICTORY_FANFARE';

export interface SoundEffectDefinition {
  readonly id: SoundEffectId;
  readonly name: string;
  readonly description: string;
  readonly gamesUsedIn: readonly string[];
  readonly optionalFilePath: string;
}

export const SOUND_EFFECT_CATALOG: readonly SoundEffectDefinition[] = [
  {
    id: 'TURN_CHIME',
    name: 'Turn Notification Chime',
    description: 'Two-note marimba bell (E5 → B5) when the active turn shifts to you.',
    gamesUsedIn: ['All Games'],
    optionalFilePath: '/sounds/turn-chime.mp3',
  },
  {
    id: 'DICE_ROLL',
    name: 'Dice Roll Clatter',
    description: 'Multi-bounce wooden dice clatter across the board.',
    gamesUsedIn: ['Catan', 'Clue'],
    optionalFilePath: '/sounds/dice-roll.mp3',
  },
  {
    id: 'CARD_SNAP',
    name: 'Card Draw / Play Snap',
    description: 'Crisp tabletop card flick when drawing, playing, or showing a card.',
    gamesUsedIn: [
      'Ticket to Ride',
      'Dominion',
      'Cribbage',
      'Kings Corners',
      'Euchre',
      "Texas Hold'em",
      'Catan',
      'Clue',
    ],
    optionalFilePath: '/sounds/card-snap.mp3',
  },
  {
    id: 'CARD_SHUFFLE',
    name: 'Deck Riffle Shuffle',
    description: 'Rapid card riffle cascade when dealing a new hand or round.',
    gamesUsedIn: ['Cribbage', 'Kings Corners', 'Euchre', "Texas Hold'em", 'Stockpile'],
    optionalFilePath: '/sounds/card-shuffle.mp3',
  },
  {
    id: 'TRAIN_WHISTLE',
    name: 'Locomotive Steam Whistle',
    description: 'Warm two-tone train whistle chord when claiming a route or building a station.',
    gamesUsedIn: ['Ticket to Ride'],
    optionalFilePath: '/sounds/train-whistle.mp3',
  },
  {
    id: 'WOOD_BUILD',
    name: 'Wooden Piece Placement',
    description: 'Solid wooden double-tap when placing roads, settlements, cities, or generators.',
    gamesUsedIn: ['Catan', 'Power Grid'],
    optionalFilePath: '/sounds/wood-build.mp3',
  },
  {
    id: 'COIN_CHINK',
    name: 'Coin & Chip Clink',
    description: 'Metallic high-pitched ring for purchases, trades, poker bets, and auction bids.',
    gamesUsedIn: ['Dominion', 'Catan', "Texas Hold'em", 'Stockpile', 'Power Grid'],
    optionalFilePath: '/sounds/coin-chink.mp3',
  },
  {
    id: 'TABLE_KNOCK',
    name: 'Wooden Table Knock',
    description: 'Resonant double-knock on felt/wood for Knocking, Checking, or saying Go.',
    gamesUsedIn: ['Kings Corners', "Texas Hold'em", 'Cribbage'],
    optionalFilePath: '/sounds/table-knock.mp3',
  },
  {
    id: 'ROBBER_THUD',
    name: 'Robber / Monster Thud',
    description: 'Deep low-frequency thud when moving the Robber, playing a Knight, or moving Alvin & Dexter.',
    gamesUsedIn: ['Catan', 'Ticket to Ride'],
    optionalFilePath: '/sounds/robber-thud.mp3',
  },
  {
    id: 'MYSTERY_STING',
    name: 'Detective Mystery Sting',
    description: 'Suspenseful minor chord when making a Suggestion, Accusation, or taking a Secret Passage.',
    gamesUsedIn: ['Clue'],
    optionalFilePath: '/sounds/mystery-sting.mp3',
  },
  {
    id: 'FOOTSTEP_TAP',
    name: 'Mansion Footstep Tap',
    description: 'Soft marble tile step when moving through Clue hallways and rooms.',
    gamesUsedIn: ['Clue'],
    optionalFilePath: '/sounds/footstep-tap.mp3',
  },
  {
    id: 'ERROR_BUZZ',
    name: 'Invalid Move Buzz',
    description: 'Soft low double-buzz when an illegal move is rejected by the rules engine.',
    gamesUsedIn: ['All Games'],
    optionalFilePath: '/sounds/error-buzz.mp3',
  },
  {
    id: 'VICTORY_FANFARE',
    name: 'Victory Fanfare',
    description: 'Bright 4-note major arpeggio (C5 → E5 → G5 → C6) when a match concludes.',
    gamesUsedIn: ['All Games'],
    optionalFilePath: '/sounds/victory-fanfare.mp3',
  },
] as const;

let sharedAudioContext: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  try {
    if (typeof window === 'undefined') return null;
    if (!sharedAudioContext) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (!AudioCtx) return null;
      sharedAudioContext = new AudioCtx();
    }
    if (sharedAudioContext.state === 'suspended') {
      void sharedAudioContext.resume();
    }
    return sharedAudioContext;
  } catch {
    return null;
  }
}

function playTone(
  ctx: AudioContext,
  freq: number,
  startTime: number,
  duration: number,
  type: OscillatorType = 'sine',
  peakGain = 0.12,
  endFreq?: number
): void {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = type;
  osc.frequency.setValueAtTime(freq, startTime);
  if (endFreq !== undefined) {
    osc.frequency.exponentialRampToValueAtTime(
      Math.max(20, endFreq),
      startTime + duration
    );
  }

  gain.gain.setValueAtTime(0.0001, startTime);
  gain.gain.exponentialRampToValueAtTime(
    peakGain,
    startTime + Math.min(0.015, duration * 0.25)
  );
  gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(startTime);
  osc.stop(startTime + duration + 0.01);
}

function playNoiseBurst(
  ctx: AudioContext,
  startTime: number,
  duration: number,
  bandpassFreq = 1200,
  peakGain = 0.14
): void {
  const sampleCount = Math.max(1, Math.floor(ctx.sampleRate * duration));
  const buffer = ctx.createBuffer(1, sampleCount, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < sampleCount; i++) {
    data[i] = Math.random() * 2 - 1;
  }

  const source = ctx.createBufferSource();
  source.buffer = buffer;

  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.setValueAtTime(bandpassFreq, startTime);
  filter.Q.setValueAtTime(1.8, startTime);

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, startTime);
  gain.gain.exponentialRampToValueAtTime(
    peakGain,
    startTime + Math.min(0.008, duration * 0.2)
  );
  gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

  source.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);

  source.start(startTime);
  source.stop(startTime + duration + 0.01);
}

/**
 * 1. Turn Notification Chime (E5 -> B5)
 */
export function playTurnNotificationChime(): void {
  const ctx = getAudioContext();
  if (!ctx) return;
  const now = ctx.currentTime;
  playTone(ctx, 659.25, now, 0.34, 'sine', 0.12);
  playTone(ctx, 987.77, now + 0.11, 0.36, 'sine', 0.12);
}

/**
 * 2. Dice Roll Clatter (Multi-bounce wooden clicks)
 */
export function playDiceRollSound(): void {
  const ctx = getAudioContext();
  if (!ctx) return;
  const now = ctx.currentTime;
  const offsets = [0, 0.055, 0.11, 0.175, 0.25];
  offsets.forEach((offset, idx) => {
    playNoiseBurst(ctx, now + offset, 0.035, 900 + idx * 180, 0.14);
    playTone(
      ctx,
      260 + idx * 45,
      now + offset,
      0.04,
      'triangle',
      0.09,
      140
    );
  });
}

/**
 * 3. Card Draw / Play Snap
 */
export function playCardSnapSound(): void {
  const ctx = getAudioContext();
  if (!ctx) return;
  const now = ctx.currentTime;
  playNoiseBurst(ctx, now, 0.045, 2200, 0.16);
  playTone(ctx, 420, now, 0.035, 'triangle', 0.06, 180);
}

/**
 * 4. Deck Riffle Shuffle
 */
export function playCardShuffleSound(): void {
  const ctx = getAudioContext();
  if (!ctx) return;
  const now = ctx.currentTime;
  for (let i = 0; i < 6; i++) {
    playNoiseBurst(ctx, now + i * 0.038, 0.028, 1800 + i * 150, 0.12);
  }
}

/**
 * 5. Locomotive Steam Whistle (Ticket to Ride)
 */
export function playTrainWhistleSound(): void {
  const ctx = getAudioContext();
  if (!ctx) return;
  const now = ctx.currentTime;
  // Classic train horn chord (F4 + A4 + C5)
  playTone(ctx, 349.23, now, 0.28, 'triangle', 0.08);
  playTone(ctx, 440.0, now, 0.28, 'triangle', 0.08);
  playTone(ctx, 523.25, now, 0.32, 'triangle', 0.07);
}

/**
 * 6. Wooden Piece Placement (Catan / Power Grid)
 */
export function playWoodBuildSound(): void {
  const ctx = getAudioContext();
  if (!ctx) return;
  const now = ctx.currentTime;
  playTone(ctx, 210, now, 0.065, 'triangle', 0.14, 110);
  playTone(ctx, 310, now + 0.07, 0.075, 'triangle', 0.14, 160);
}

/**
 * 7. Coin / Poker Chip Clink
 */
export function playCoinChinkSound(): void {
  const ctx = getAudioContext();
  if (!ctx) return;
  const now = ctx.currentTime;
  playTone(ctx, 1760, now, 0.14, 'sine', 0.09);
  playTone(ctx, 2637, now + 0.055, 0.2, 'sine', 0.09);
}

/**
 * 8. Wooden Table Knock (Kings Corners Knock / Hold'em Check / Cribbage Go)
 */
export function playTableKnockSound(): void {
  const ctx = getAudioContext();
  if (!ctx) return;
  const now = ctx.currentTime;
  playTone(ctx, 145, now, 0.08, 'sine', 0.2, 65);
  playNoiseBurst(ctx, now, 0.03, 400, 0.12);
  playTone(ctx, 155, now + 0.12, 0.09, 'sine', 0.22, 70);
  playNoiseBurst(ctx, now + 0.12, 0.03, 420, 0.12);
}

/**
 * 9. Robber / Monster Thud
 */
export function playRobberThudSound(): void {
  const ctx = getAudioContext();
  if (!ctx) return;
  const now = ctx.currentTime;
  playTone(ctx, 130, now, 0.24, 'sawtooth', 0.12, 48);
}

/**
 * 10. Detective Mystery Sting (Clue Suggestion / Accusation / Secret Passage)
 */
export function playMysteryStingSound(): void {
  const ctx = getAudioContext();
  if (!ctx) return;
  const now = ctx.currentTime;
  // A minor / diminished suspense chord (A4 -> C5 -> D#5)
  playTone(ctx, 440, now, 0.35, 'triangle', 0.09);
  playTone(ctx, 523.25, now + 0.07, 0.35, 'triangle', 0.09);
  playTone(ctx, 622.25, now + 0.14, 0.42, 'triangle', 0.1);
}

/**
 * 11. Mansion Footstep Tap (Clue movement)
 */
export function playFootstepTapSound(): void {
  const ctx = getAudioContext();
  if (!ctx) return;
  const now = ctx.currentTime;
  playNoiseBurst(ctx, now, 0.025, 1100, 0.1);
  playTone(ctx, 240, now, 0.035, 'sine', 0.08, 120);
}

/**
 * 12. Invalid Move Error Buzz
 */
export function playErrorBuzzSound(): void {
  const ctx = getAudioContext();
  if (!ctx) return;
  const now = ctx.currentTime;
  playTone(ctx, 160, now, 0.1, 'sawtooth', 0.08, 130);
  playTone(ctx, 140, now + 0.11, 0.14, 'sawtooth', 0.08, 110);
}

/**
 * 13. Victory Fanfare (C5 -> E5 -> G5 -> C6)
 */
export function playVictoryFanfareSound(): void {
  const ctx = getAudioContext();
  if (!ctx) return;
  const now = ctx.currentTime;
  const notes = [523.25, 659.25, 783.99, 1046.5];
  notes.forEach((freq, idx) => {
    playTone(
      ctx,
      freq,
      now + idx * 0.11,
      idx === notes.length - 1 ? 0.48 : 0.22,
      'triangle',
      0.13
    );
  });
}

export function playSoundEffect(id: SoundEffectId): void {
  switch (id) {
    case 'TURN_CHIME':
      playTurnNotificationChime();
      break;
    case 'DICE_ROLL':
      playDiceRollSound();
      break;
    case 'CARD_SNAP':
      playCardSnapSound();
      break;
    case 'CARD_SHUFFLE':
      playCardShuffleSound();
      break;
    case 'TRAIN_WHISTLE':
      playTrainWhistleSound();
      break;
    case 'WOOD_BUILD':
      playWoodBuildSound();
      break;
    case 'COIN_CHINK':
      playCoinChinkSound();
      break;
    case 'TABLE_KNOCK':
      playTableKnockSound();
      break;
    case 'ROBBER_THUD':
      playRobberThudSound();
      break;
    case 'MYSTERY_STING':
      playMysteryStingSound();
      break;
    case 'FOOTSTEP_TAP':
      playFootstepTapSound();
      break;
    case 'ERROR_BUZZ':
      playErrorBuzzSound();
      break;
    case 'VICTORY_FANFARE':
      playVictoryFanfareSound();
      break;
  }
}

/**
 * Maps any game engine action to its matching sound effect.
 */
export function getSoundEffectForAction(
  action: AnyGameAction
): SoundEffectId | null {
  const actionType = action.type as string;
  switch (actionType) {
    // Dice Rolls
    case 'CATAN_ROLL_DICE':
    case 'CLUE_ROLL_DICE':
      return 'DICE_ROLL';

    // Route & Station Building (Ticket to Ride)
    case 'CLAIM_ROUTE':
    case 'BUILD_STATION':
      return 'TRAIN_WHISTLE';

    // Wood / Board Building (Catan & Power Grid)
    case 'CATAN_PLACE_INITIAL_SETTLEMENT':
    case 'CATAN_PLACE_INITIAL_ROAD':
    case 'CATAN_BUILD_ROAD':
    case 'CATAN_BUILD_SETTLEMENT':
    case 'CATAN_START_UPGRADE_CITY':
    case 'CATAN_UPGRADE_CITY':
    case 'CATAN_PLAY_ROAD_BUILDING':
    case 'PG_BUILD_CITY':
      return 'WOOD_BUILD';

    // Coins, Purchases, Bids & Trades
    case 'BUY_CARD':
    case 'DOMINION_BUY_CARD':
    case 'CATAN_BUY_DEV_CARD':
    case 'CATAN_MARITIME_TRADE':
    case 'CATAN_PROPOSE_TRADE':
    case 'CATAN_RESPOND_TRADE':
    case 'CATAN_PLAY_YEAR_OF_PLENTY':
    case 'CATAN_PLAY_MONOPOLY':
    case 'HOLDEM_CALL':
    case 'HOLDEM_BET_RAISE':
    case 'STOCKPILE_BID':
    case 'STOCKPILE_SELL_SHARES':
    case 'PG_OPEN_AUCTION':
    case 'PG_BID':
    case 'PG_PLACE_BID':
    case 'PG_BUY_RESOURCES':
      return 'COIN_CHINK';

    // Table Knocks / Checks / Go
    case 'KC_KNOCK':
    case 'HOLDEM_CHECK':
    case 'CRIB_SAY_GO':
      return 'TABLE_KNOCK';

    // Robber / Monsters
    case 'CATAN_MOVE_ROBBER':
    case 'CATAN_PLAY_KNIGHT':
    case 'PLACE_MONSTER':
    case 'MOVE_MONSTER':
      return 'ROBBER_THUD';

    // Clue Mystery Actions & Movement
    case 'CLUE_MAKE_SUGGESTION':
    case 'CLUE_MAKE_ACCUSATION':
    case 'CLUE_USE_SECRET_PASSAGE':
      return 'MYSTERY_STING';
    case 'CLUE_MOVE_TO_HALLWAY':
    case 'CLUE_MOVE_TO_ROOM':
    case 'CLUE_STAY_IN_ROOM':
      return 'FOOTSTEP_TAP';

    // Hand / Round Shuffles
    case 'CRIB_NEXT_HAND':
    case 'KC_NEXT_HAND':
    case 'EUCHRE_NEXT_HAND':
    case 'HOLDEM_NEXT_HAND':
    case 'STOCKPILE_NEXT_ROUND':
      return 'CARD_SHUFFLE';

    // Card Draws, Plays & Discards
    case 'DRAW_CARDS':
    case 'DRAW_TICKETS':
    case 'KEEP_TICKETS':
    case 'PLAY_ACTION':
    case 'PLAY_TREASURE':
    case 'PLAY_ALL_TREASURES':
    case 'DOMINION_PLAY_ACTION':
    case 'DOMINION_PLAY_TREASURE':
    case 'DOMINION_PLAY_ALL_TREASURES':
    case 'CRIB_DISCARD':
    case 'CRIB_PLAY_CARD':
    case 'KC_PEEK_CARDS':
    case 'KC_DRAW_DECK':
    case 'KC_SWAP_DRAWN':
    case 'KC_SWAP_DISCARD':
    case 'KC_DISCARD_DRAWN':
    case 'EUCHRE_ORDER_UP':
    case 'EUCHRE_CALL_TRUMP':
    case 'EUCHRE_DEALER_DISCARD':
    case 'EUCHRE_PLAY_CARD':
    case 'HOLDEM_FOLD':
    case 'STOCKPILE_PLACE_SUPPLY':
    case 'CATAN_DISCARD_RESOURCES':
    case 'CATAN_SELECT_ROBBER_VICTIM':
    case 'CATAN_STEAL_CARD':
    case 'CATAN_PLAY_VP_CARD':
    case 'CLUE_DISPROVE_SUGGESTION':
      return 'CARD_SNAP';

    default:
      return null;
  }
}

export function playSoundForAction(action: AnyGameAction): void {
  const effectId = getSoundEffectForAction(action);
  if (effectId) {
    playSoundEffect(effectId);
  }
}
