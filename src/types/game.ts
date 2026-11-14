export type GameCategorySlug = 'board' | 'card';

export type GameId =
  | 'ttr'
  | 'catan'
  | 'stockpile'
  | 'power_grid'
  | 'clue'
  | 'holdem'
  | 'euchre'
  | 'cribbage'
  | 'kings_corners'
  | 'dominion';

export interface GameColorDefinition {
  readonly id: string;
  readonly name: string;
  readonly hex: string;
  readonly strokeHex: string;
}

export interface GameExpansion {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly minPlayersOverride?: number;
  readonly maxPlayersOverride?: number;
  readonly compatibleMaps?: readonly ('USA' | 'EUROPE')[];
}

export function isExpansionCompatibleWithMap(
  expansion: GameExpansion,
  mapId: 'USA' | 'EUROPE'
): boolean {
  if (!expansion.compatibleMaps || expansion.compatibleMaps.length === 0) {
    return true;
  }
  return expansion.compatibleMaps.includes(mapId);
}

export interface GameSetupOptions {
  readonly selectedExpansions?: readonly string[];
  readonly playerColors?: Readonly<Record<string, string>>;
  readonly mapRegionKeys?: readonly string[];
}

export interface GameDefinition {
  readonly id: GameId;
  readonly category: GameCategorySlug;
  readonly icon: string;
  readonly name: string;
  readonly subtitle: string;
  readonly description: string;
  readonly minPlayers: number;
  readonly maxPlayers: number;
  readonly estimatedMinutes: number;
  readonly mechanicsLabel: string;
  readonly badgeColor: string;
  readonly availableColors: readonly GameColorDefinition[];
  readonly expansions: readonly GameExpansion[];
}

/**
 * Computes effective minimum and maximum player bounds for a game
 * after applying any enabled expansion overrides.
 */
export function getEffectivePlayerBounds(
  game: Pick<GameDefinition, 'minPlayers' | 'maxPlayers' | 'expansions'>,
  selectedExpansionIds: readonly string[]
): { readonly minPlayers: number; readonly maxPlayers: number } {
  let minPlayers = game.minPlayers;
  let maxPlayers = game.maxPlayers;

  for (const exp of game.expansions) {
    if (selectedExpansionIds.includes(exp.id)) {
      if (exp.minPlayersOverride !== undefined) {
        minPlayers = Math.min(minPlayers, exp.minPlayersOverride);
      }
      if (exp.maxPlayersOverride !== undefined) {
        maxPlayers = Math.max(maxPlayers, exp.maxPlayersOverride);
      }
    }
  }

  return { minPlayers, maxPlayers };
}

