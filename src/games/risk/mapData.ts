import {
  RiskCard,
  RiskCardSymbol,
  RiskContinentId,
  RiskTerritoryId,
} from './types.js';

export interface RiskContinentMeta {
  readonly id: RiskContinentId;
  readonly name: string;
  readonly bonusArmies: number;
  readonly baseTint: string;
  readonly borderAccent: string;
  readonly badgePosition: { readonly x: number; readonly y: number };
  readonly territoryIds: readonly RiskTerritoryId[];
}

export interface RiskTerritoryMeta {
  readonly id: RiskTerritoryId;
  readonly name: string;
  readonly shortName: string;
  readonly continentId: RiskContinentId;
  readonly cardSymbol: Exclude<RiskCardSymbol, 'WILD'>;
  readonly adjacentIds: readonly RiskTerritoryId[];
  readonly svgPath: string;
  readonly center: { readonly x: number; readonly y: number };
}

export interface RiskDashedConnection {
  readonly id: string;
  readonly fromTerritoryId: RiskTerritoryId;
  readonly toTerritoryId: RiskTerritoryId;
  readonly points: readonly { readonly x: number; readonly y: number }[];
  readonly wrapLabel?: {
    readonly text: string;
    readonly x: number;
    readonly y: number;
    readonly align: 'start' | 'end';
  };
}

export const RISK_CONTINENTS: readonly RiskContinentMeta[] = [
  {
    id: 'NORTH_AMERICA',
    name: 'North America',
    bonusArmies: 5,
    baseTint: '#fef08a',
    borderAccent: '#ca8a04',
    badgePosition: { x: 118, y: 292 },
    territoryIds: [
      'alaska',
      'northwest_territory',
      'greenland',
      'alberta',
      'ontario',
      'quebec',
      'western_united_states',
      'eastern_united_states',
      'central_america',
    ],
  },
  {
    id: 'SOUTH_AMERICA',
    name: 'South America',
    bonusArmies: 2,
    baseTint: '#fed7aa',
    borderAccent: '#ea580c',
    badgePosition: { x: 196, y: 505 },
    territoryIds: ['venezuela', 'peru', 'brazil', 'argentina'],
  },
  {
    id: 'EUROPE',
    name: 'Europe',
    bonusArmies: 5,
    baseTint: '#bfdbfe',
    borderAccent: '#2563eb',
    badgePosition: { x: 545, y: 42 },
    territoryIds: [
      'iceland',
      'great_britain',
      'scandinavia',
      'northern_europe',
      'western_europe',
      'southern_europe',
      'ukraine',
    ],
  },
  {
    id: 'AFRICA',
    name: 'Africa',
    bonusArmies: 3,
    baseTint: '#fde68a',
    borderAccent: '#b45309',
    badgePosition: { x: 455, y: 505 },
    territoryIds: [
      'north_africa',
      'egypt',
      'east_africa',
      'congo',
      'south_africa',
      'madagascar',
    ],
  },
  {
    id: 'ASIA',
    name: 'Asia',
    bonusArmies: 7,
    baseTint: '#bbf7d0',
    borderAccent: '#15803d',
    badgePosition: { x: 890, y: 42 },
    territoryIds: [
      'ural',
      'siberia',
      'yakutsk',
      'kamchatka',
      'irkutsk',
      'afghanistan',
      'china',
      'mongolia',
      'japan',
      'middle_east',
      'india',
      'siam',
    ],
  },
  {
    id: 'AUSTRALIA',
    name: 'Australia',
    bonusArmies: 2,
    baseTint: '#e9d5ff',
    borderAccent: '#7e22ce',
    badgePosition: { x: 1015, y: 616 },
    territoryIds: [
      'indonesia',
      'new_guinea',
      'western_australia',
      'eastern_australia',
    ],
  },
];

export const RISK_CONTINENTS_BY_ID: Readonly<
  Record<RiskContinentId, RiskContinentMeta>
> = Object.fromEntries(RISK_CONTINENTS.map((c) => [c.id, c])) as Record<
  RiskContinentId,
  RiskContinentMeta
>;

export const RISK_TERRITORIES: readonly RiskTerritoryMeta[] = [
  // ================= NORTH AMERICA (9) =================
  {
    id: 'alaska',
    name: 'Alaska',
    shortName: 'Alaska',
    continentId: 'NORTH_AMERICA',
    cardSymbol: 'INFANTRY',
    adjacentIds: ['northwest_territory', 'alberta', 'kamchatka'],
    svgPath: 'M 58,86 L 135,78 L 145,115 L 138,152 L 95,160 L 54,136 Z',
    center: { x: 101, y: 120 },
  },
  {
    id: 'northwest_territory',
    name: 'Northwest Territory',
    shortName: 'NW Terr.',
    continentId: 'NORTH_AMERICA',
    cardSymbol: 'ARTILLERY',
    adjacentIds: ['alaska', 'alberta', 'ontario', 'greenland'],
    svgPath: 'M 135,78 L 268,72 L 278,124 L 222,130 L 145,115 Z',
    center: { x: 208, y: 103 },
  },
  {
    id: 'greenland',
    name: 'Greenland',
    shortName: 'Greenland',
    continentId: 'NORTH_AMERICA',
    cardSymbol: 'CAVALRY',
    adjacentIds: ['northwest_territory', 'ontario', 'quebec', 'iceland'],
    svgPath: 'M 345,42 L 438,38 L 452,85 L 418,125 L 362,118 L 338,78 Z',
    center: { x: 395, y: 81 },
  },
  {
    id: 'alberta',
    name: 'Alberta',
    shortName: 'Alberta',
    continentId: 'NORTH_AMERICA',
    cardSymbol: 'CAVALRY',
    adjacentIds: [
      'alaska',
      'northwest_territory',
      'ontario',
      'western_united_states',
    ],
    svgPath: 'M 145,115 L 222,130 L 218,185 L 138,185 L 138,152 Z',
    center: { x: 180, y: 156 },
  },
  {
    id: 'ontario',
    name: 'Ontario',
    shortName: 'Ontario',
    continentId: 'NORTH_AMERICA',
    cardSymbol: 'CAVALRY',
    adjacentIds: [
      'northwest_territory',
      'alberta',
      'western_united_states',
      'eastern_united_states',
      'quebec',
      'greenland',
    ],
    svgPath:
      'M 222,130 L 278,124 L 292,145 L 285,195 L 238,198 L 218,185 Z',
    center: { x: 256, y: 164 },
  },
  {
    id: 'quebec',
    name: 'Quebec',
    shortName: 'Quebec',
    continentId: 'NORTH_AMERICA',
    cardSymbol: 'CAVALRY',
    adjacentIds: ['ontario', 'eastern_united_states', 'greenland'],
    svgPath: 'M 292,145 L 348,140 L 356,188 L 312,205 L 285,195 Z',
    center: { x: 320, y: 173 },
  },
  {
    id: 'western_united_states',
    name: 'Western United States',
    shortName: 'W. U.S.',
    continentId: 'NORTH_AMERICA',
    cardSymbol: 'ARTILLERY',
    adjacentIds: [
      'alberta',
      'ontario',
      'eastern_united_states',
      'central_america',
    ],
    svgPath:
      'M 138,185 L 218,185 L 238,198 L 232,255 L 182,255 L 146,232 Z',
    center: { x: 190, y: 220 },
  },
  {
    id: 'eastern_united_states',
    name: 'Eastern United States',
    shortName: 'E. U.S.',
    continentId: 'NORTH_AMERICA',
    cardSymbol: 'ARTILLERY',
    adjacentIds: [
      'ontario',
      'quebec',
      'western_united_states',
      'central_america',
    ],
    svgPath:
      'M 238,198 L 285,195 L 312,205 L 322,238 L 262,262 L 232,255 Z',
    center: { x: 274, y: 229 },
  },
  {
    id: 'central_america',
    name: 'Central America',
    shortName: 'C. America',
    continentId: 'NORTH_AMERICA',
    cardSymbol: 'ARTILLERY',
    adjacentIds: [
      'western_united_states',
      'eastern_united_states',
      'venezuela',
    ],
    svgPath:
      'M 182,255 L 232,255 L 262,262 L 268,318 L 238,325 L 198,292 Z',
    center: { x: 232, y: 288 },
  },

  // ================= SOUTH AMERICA (4) =================
  {
    id: 'venezuela',
    name: 'Venezuela',
    shortName: 'Venezuela',
    continentId: 'SOUTH_AMERICA',
    cardSymbol: 'INFANTRY',
    adjacentIds: ['central_america', 'peru', 'brazil'],
    svgPath:
      'M 238,325 L 268,318 L 326,336 L 298,382 L 246,378 L 232,352 Z',
    center: { x: 276, y: 352 },
  },
  {
    id: 'peru',
    name: 'Peru',
    shortName: 'Peru',
    continentId: 'SOUTH_AMERICA',
    cardSymbol: 'INFANTRY',
    adjacentIds: ['venezuela', 'brazil', 'argentina'],
    svgPath: 'M 246,378 L 298,382 L 308,456 L 264,468 L 236,422 Z',
    center: { x: 274, y: 422 },
  },
  {
    id: 'brazil',
    name: 'Brazil',
    shortName: 'Brazil',
    continentId: 'SOUTH_AMERICA',
    cardSymbol: 'ARTILLERY',
    adjacentIds: ['venezuela', 'peru', 'argentina', 'north_africa'],
    svgPath:
      'M 326,336 L 382,375 L 392,430 L 352,482 L 308,456 L 298,382 Z',
    center: { x: 344, y: 412 },
  },
  {
    id: 'argentina',
    name: 'Argentina',
    shortName: 'Argentina',
    continentId: 'SOUTH_AMERICA',
    cardSymbol: 'INFANTRY',
    adjacentIds: ['peru', 'brazil'],
    svgPath:
      'M 264,468 L 308,456 L 352,482 L 318,572 L 278,568 L 266,515 Z',
    center: { x: 302, y: 514 },
  },

  // ================= EUROPE (7) =================
  {
    id: 'iceland',
    name: 'Iceland',
    shortName: 'Iceland',
    continentId: 'EUROPE',
    cardSymbol: 'INFANTRY',
    adjacentIds: ['greenland', 'great_britain', 'scandinavia'],
    svgPath: 'M 462,88 L 516,84 L 522,118 L 468,122 Z',
    center: { x: 492, y: 103 },
  },
  {
    id: 'great_britain',
    name: 'Great Britain',
    shortName: 'Gt. Britain',
    continentId: 'EUROPE',
    cardSymbol: 'ARTILLERY',
    adjacentIds: [
      'iceland',
      'scandinavia',
      'northern_europe',
      'western_europe',
    ],
    svgPath: 'M 465,156 L 512,150 L 520,202 L 472,208 Z',
    center: { x: 493, y: 179 },
  },
  {
    id: 'scandinavia',
    name: 'Scandinavia',
    shortName: 'Scandinavia',
    continentId: 'EUROPE',
    cardSymbol: 'CAVALRY',
    adjacentIds: ['iceland', 'great_britain', 'northern_europe', 'ukraine'],
    svgPath: 'M 552,72 L 622,66 L 638,118 L 605,146 L 558,142 L 544,108 Z',
    center: { x: 589, y: 108 },
  },
  {
    id: 'northern_europe',
    name: 'Northern Europe',
    shortName: 'N. Europe',
    continentId: 'EUROPE',
    cardSymbol: 'ARTILLERY',
    adjacentIds: [
      'great_britain',
      'scandinavia',
      'ukraine',
      'southern_europe',
      'western_europe',
    ],
    svgPath: 'M 534,218 L 556,172 L 614,172 L 622,222 L 550,250 Z',
    center: { x: 579, y: 206 },
  },
  {
    id: 'western_europe',
    name: 'Western Europe',
    shortName: 'W. Europe',
    continentId: 'EUROPE',
    cardSymbol: 'ARTILLERY',
    adjacentIds: [
      'great_britain',
      'northern_europe',
      'southern_europe',
      'north_africa',
    ],
    svgPath:
      'M 476,228 L 534,218 L 550,250 L 532,292 L 474,290 L 465,258 Z',
    center: { x: 506, y: 258 },
  },
  {
    id: 'southern_europe',
    name: 'Southern Europe',
    shortName: 'S. Europe',
    continentId: 'EUROPE',
    cardSymbol: 'ARTILLERY',
    adjacentIds: [
      'western_europe',
      'northern_europe',
      'ukraine',
      'middle_east',
      'egypt',
      'north_africa',
    ],
    svgPath:
      'M 550,250 L 622,222 L 642,258 L 634,292 L 568,296 L 532,292 Z',
    center: { x: 590, y: 266 },
  },
  {
    id: 'ukraine',
    name: 'Ukraine',
    shortName: 'Ukraine',
    continentId: 'EUROPE',
    cardSymbol: 'CAVALRY',
    adjacentIds: [
      'scandinavia',
      'northern_europe',
      'southern_europe',
      'ural',
      'afghanistan',
      'middle_east',
    ],
    svgPath:
      'M 605,146 L 638,118 L 695,112 L 702,178 L 692,238 L 642,258 L 622,222 L 614,172 Z',
    center: { x: 656, y: 184 },
  },

  // ================= AFRICA (6) =================
  {
    id: 'north_africa',
    name: 'North Africa',
    shortName: 'N. Africa',
    continentId: 'AFRICA',
    cardSymbol: 'CAVALRY',
    adjacentIds: [
      'brazil',
      'western_europe',
      'southern_europe',
      'egypt',
      'east_africa',
      'congo',
    ],
    svgPath:
      'M 476,336 L 568,332 L 574,392 L 562,422 L 512,428 L 468,392 Z',
    center: { x: 524, y: 380 },
  },
  {
    id: 'egypt',
    name: 'Egypt',
    shortName: 'Egypt',
    continentId: 'AFRICA',
    cardSymbol: 'INFANTRY',
    adjacentIds: ['north_africa', 'southern_europe', 'middle_east', 'east_africa'],
    svgPath: 'M 568,332 L 634,334 L 640,356 L 628,392 L 574,392 Z',
    center: { x: 604, y: 364 },
  },
  {
    id: 'east_africa',
    name: 'East Africa',
    shortName: 'E. Africa',
    continentId: 'AFRICA',
    cardSymbol: 'INFANTRY',
    adjacentIds: [
      'egypt',
      'north_africa',
      'congo',
      'south_africa',
      'madagascar',
      'middle_east',
    ],
    svgPath:
      'M 574,392 L 628,392 L 658,425 L 636,488 L 604,505 L 576,492 L 584,458 L 562,422 Z',
    center: { x: 612, y: 444 },
  },
  {
    id: 'congo',
    name: 'Congo',
    shortName: 'Congo',
    continentId: 'AFRICA',
    cardSymbol: 'INFANTRY',
    adjacentIds: ['north_africa', 'east_africa', 'south_africa'],
    svgPath:
      'M 512,428 L 562,422 L 584,458 L 576,492 L 526,492 L 508,460 Z',
    center: { x: 547, y: 460 },
  },
  {
    id: 'south_africa',
    name: 'South Africa',
    shortName: 'S. Africa',
    continentId: 'AFRICA',
    cardSymbol: 'ARTILLERY',
    adjacentIds: ['congo', 'east_africa', 'madagascar'],
    svgPath:
      'M 526,492 L 576,492 L 604,505 L 598,566 L 544,572 L 524,532 Z',
    center: { x: 563, y: 534 },
  },
  {
    id: 'madagascar',
    name: 'Madagascar',
    shortName: 'Madagascar',
    continentId: 'AFRICA',
    cardSymbol: 'CAVALRY',
    adjacentIds: ['east_africa', 'south_africa'],
    svgPath: 'M 662,492 L 694,486 L 698,554 L 664,560 Z',
    center: { x: 680, y: 523 },
  },

  // ================= ASIA (12) =================
  {
    id: 'ural',
    name: 'Ural',
    shortName: 'Ural',
    continentId: 'ASIA',
    cardSymbol: 'CAVALRY',
    adjacentIds: ['ukraine', 'siberia', 'china', 'afghanistan'],
    svgPath:
      'M 695,112 L 768,94 L 776,188 L 774,212 L 758,212 L 702,178 Z',
    center: { x: 739, y: 156 },
  },
  {
    id: 'siberia',
    name: 'Siberia',
    shortName: 'Siberia',
    continentId: 'ASIA',
    cardSymbol: 'CAVALRY',
    adjacentIds: ['ural', 'yakutsk', 'irkutsk', 'mongolia', 'china'],
    svgPath:
      'M 768,94 L 855,72 L 858,128 L 854,174 L 846,204 L 776,188 Z',
    center: { x: 815, y: 142 },
  },
  {
    id: 'yakutsk',
    name: 'Yakutsk',
    shortName: 'Yakutsk',
    continentId: 'ASIA',
    cardSymbol: 'CAVALRY',
    adjacentIds: ['siberia', 'kamchatka', 'irkutsk'],
    svgPath: 'M 855,72 L 958,64 L 964,126 L 858,128 Z',
    center: { x: 910, y: 98 },
  },
  {
    id: 'kamchatka',
    name: 'Kamchatka',
    shortName: 'Kamchatka',
    continentId: 'ASIA',
    cardSymbol: 'INFANTRY',
    adjacentIds: ['yakutsk', 'irkutsk', 'mongolia', 'japan', 'alaska'],
    svgPath:
      'M 958,64 L 1076,74 L 1112,118 L 1068,184 L 1036,214 L 1012,174 L 996,208 L 966,208 L 968,176 L 964,126 Z',
    center: { x: 1026, y: 134 },
  },
  {
    id: 'irkutsk',
    name: 'Irkutsk',
    shortName: 'Irkutsk',
    continentId: 'ASIA',
    cardSymbol: 'CAVALRY',
    adjacentIds: ['siberia', 'yakutsk', 'kamchatka', 'mongolia'],
    svgPath: 'M 858,128 L 964,126 L 968,176 L 854,174 Z',
    center: { x: 912, y: 151 },
  },
  {
    id: 'afghanistan',
    name: 'Afghanistan',
    shortName: 'Afghanistan',
    continentId: 'ASIA',
    cardSymbol: 'CAVALRY',
    adjacentIds: ['ukraine', 'ural', 'china', 'india', 'middle_east'],
    svgPath: 'M 702,178 L 758,212 L 768,266 L 738,286 L 692,238 Z',
    center: { x: 731, y: 236 },
  },
  {
    id: 'china',
    name: 'China',
    shortName: 'China',
    continentId: 'ASIA',
    cardSymbol: 'INFANTRY',
    adjacentIds: [
      'afghanistan',
      'ural',
      'siberia',
      'mongolia',
      'india',
      'siam',
    ],
    svgPath:
      'M 758,212 L 774,212 L 776,188 L 846,204 L 848,236 L 984,238 L 968,298 L 918,318 L 862,316 L 792,298 L 768,266 Z',
    center: { x: 868, y: 266 },
  },
  {
    id: 'mongolia',
    name: 'Mongolia',
    shortName: 'Mongolia',
    continentId: 'ASIA',
    cardSymbol: 'ARTILLERY',
    adjacentIds: ['siberia', 'irkutsk', 'kamchatka', 'japan', 'china'],
    svgPath:
      'M 854,174 L 968,176 L 966,208 L 984,238 L 848,236 L 846,204 Z',
    center: { x: 914, y: 207 },
  },
  {
    id: 'japan',
    name: 'Japan',
    shortName: 'Japan',
    continentId: 'ASIA',
    cardSymbol: 'ARTILLERY',
    adjacentIds: ['kamchatka', 'mongolia'],
    svgPath: 'M 1038,234 L 1076,226 L 1088,284 L 1046,294 L 1032,264 Z',
    center: { x: 1060, y: 260 },
  },
  {
    id: 'middle_east',
    name: 'Middle East',
    shortName: 'Middle East',
    continentId: 'ASIA',
    cardSymbol: 'INFANTRY',
    adjacentIds: [
      'ukraine',
      'southern_europe',
      'egypt',
      'east_africa',
      'afghanistan',
      'india',
    ],
    svgPath:
      'M 642,258 L 692,238 L 738,286 L 738,312 L 732,346 L 688,376 L 640,356 L 634,334 L 634,292 Z',
    center: { x: 686, y: 310 },
  },
  {
    id: 'india',
    name: 'India',
    shortName: 'India',
    continentId: 'ASIA',
    cardSymbol: 'CAVALRY',
    adjacentIds: ['middle_east', 'afghanistan', 'china', 'siam'],
    svgPath:
      'M 738,286 L 768,266 L 792,298 L 862,316 L 854,344 L 804,404 L 756,356 L 738,312 Z',
    center: { x: 796, y: 336 },
  },
  {
    id: 'siam',
    name: 'Siam',
    shortName: 'Siam',
    continentId: 'ASIA',
    cardSymbol: 'INFANTRY',
    adjacentIds: ['india', 'china', 'indonesia'],
    svgPath:
      'M 862,316 L 918,318 L 932,368 L 892,398 L 864,376 L 854,344 Z',
    center: { x: 894, y: 355 },
  },

  // ================= AUSTRALIA (4) =================
  {
    id: 'indonesia',
    name: 'Indonesia',
    shortName: 'Indonesia',
    continentId: 'AUSTRALIA',
    cardSymbol: 'ARTILLERY',
    adjacentIds: ['siam', 'new_guinea', 'western_australia'],
    svgPath: 'M 882,428 L 964,424 L 972,464 L 890,468 Z',
    center: { x: 927, y: 446 },
  },
  {
    id: 'new_guinea',
    name: 'New Guinea',
    shortName: 'New Guinea',
    continentId: 'AUSTRALIA',
    cardSymbol: 'INFANTRY',
    adjacentIds: ['indonesia', 'western_australia', 'eastern_australia'],
    svgPath: 'M 1018,422 L 1096,426 L 1104,464 L 1024,462 Z',
    center: { x: 1060, y: 443 },
  },
  {
    id: 'western_australia',
    name: 'Western Australia',
    shortName: 'W. Australia',
    continentId: 'AUSTRALIA',
    cardSymbol: 'ARTILLERY',
    adjacentIds: ['indonesia', 'new_guinea', 'eastern_australia'],
    svgPath: 'M 936,506 L 1018,502 L 1018,582 L 944,586 L 926,546 Z',
    center: { x: 976, y: 544 },
  },
  {
    id: 'eastern_australia',
    name: 'Eastern Australia',
    shortName: 'E. Australia',
    continentId: 'AUSTRALIA',
    cardSymbol: 'INFANTRY',
    adjacentIds: ['new_guinea', 'western_australia'],
    svgPath: 'M 1018,502 L 1098,498 L 1118,546 L 1092,588 L 1018,582 Z',
    center: { x: 1064, y: 544 },
  },
];

export const RISK_TERRITORIES_BY_ID: Readonly<
  Record<RiskTerritoryId, RiskTerritoryMeta>
> = Object.fromEntries(RISK_TERRITORIES.map((t) => [t.id, t])) as Record<
  RiskTerritoryId,
  RiskTerritoryMeta
>;

export const ALL_RISK_TERRITORY_IDS: readonly RiskTerritoryId[] =
  RISK_TERRITORIES.map((t) => t.id);

/**
 * Dashed connection lines rendered over oceans/straits for every pair of
 * connected Risk territories that do not physically share a land border.
 */
export const RISK_DASHED_SEA_CONNECTIONS: readonly RiskDashedConnection[] = [
  // Pacific Wrap-Around (Alaska <-> Kamchatka)
  {
    id: 'sea_alaska_wrap_left',
    fromTerritoryId: 'alaska',
    toTerritoryId: 'kamchatka',
    points: [
      { x: 58, y: 112 },
      { x: 2, y: 112 },
    ],
    wrapLabel: {
      text: '← Kamchatka',
      x: 8,
      y: 103,
      align: 'start',
    },
  },
  {
    id: 'sea_kamchatka_wrap_right',
    fromTerritoryId: 'kamchatka',
    toTerritoryId: 'alaska',
    points: [
      { x: 1112, y: 118 },
      { x: 1198, y: 118 },
    ],
    wrapLabel: {
      text: 'Alaska →',
      x: 1192,
      y: 109,
      align: 'end',
    },
  },
  // North America <-> Greenland / Iceland
  {
    id: 'sea_nw_greenland',
    fromTerritoryId: 'northwest_territory',
    toTerritoryId: 'greenland',
    points: [
      { x: 268, y: 74 },
      { x: 342, y: 76 },
    ],
  },
  {
    id: 'sea_ontario_greenland',
    fromTerritoryId: 'ontario',
    toTerritoryId: 'greenland',
    points: [
      { x: 278, y: 124 },
      { x: 362, y: 118 },
    ],
  },
  {
    id: 'sea_quebec_greenland',
    fromTerritoryId: 'quebec',
    toTerritoryId: 'greenland',
    points: [
      { x: 332, y: 142 },
      { x: 388, y: 122 },
    ],
  },
  {
    id: 'sea_greenland_iceland',
    fromTerritoryId: 'greenland',
    toTerritoryId: 'iceland',
    points: [
      { x: 438, y: 96 },
      { x: 464, y: 98 },
    ],
  },
  // European Sea Lanes
  {
    id: 'sea_iceland_gb',
    fromTerritoryId: 'iceland',
    toTerritoryId: 'great_britain',
    points: [
      { x: 492, y: 121 },
      { x: 492, y: 153 },
    ],
  },
  {
    id: 'sea_iceland_scandinavia',
    fromTerritoryId: 'iceland',
    toTerritoryId: 'scandinavia',
    points: [
      { x: 520, y: 102 },
      { x: 546, y: 106 },
    ],
  },
  {
    id: 'sea_gb_scandinavia',
    fromTerritoryId: 'great_britain',
    toTerritoryId: 'scandinavia',
    points: [
      { x: 512, y: 154 },
      { x: 558, y: 136 },
    ],
  },
  {
    id: 'sea_gb_n_europe',
    fromTerritoryId: 'great_britain',
    toTerritoryId: 'northern_europe',
    points: [
      { x: 518, y: 186 },
      { x: 548, y: 192 },
    ],
  },
  {
    id: 'sea_gb_w_europe',
    fromTerritoryId: 'great_britain',
    toTerritoryId: 'western_europe',
    points: [
      { x: 495, y: 206 },
      { x: 498, y: 226 },
    ],
  },
  {
    id: 'sea_scandinavia_n_europe',
    fromTerritoryId: 'scandinavia',
    toTerritoryId: 'northern_europe',
    points: [
      { x: 582, y: 144 },
      { x: 582, y: 172 },
    ],
  },
  // South Atlantic & Mediterranean
  {
    id: 'sea_brazil_n_africa',
    fromTerritoryId: 'brazil',
    toTerritoryId: 'north_africa',
    points: [
      { x: 392, y: 416 },
      { x: 468, y: 392 },
    ],
  },
  {
    id: 'sea_w_europe_n_africa',
    fromTerritoryId: 'western_europe',
    toTerritoryId: 'north_africa',
    points: [
      { x: 502, y: 291 },
      { x: 502, y: 335 },
    ],
  },
  {
    id: 'sea_s_europe_n_africa',
    fromTerritoryId: 'southern_europe',
    toTerritoryId: 'north_africa',
    points: [
      { x: 558, y: 295 },
      { x: 542, y: 333 },
    ],
  },
  {
    id: 'sea_s_europe_egypt',
    fromTerritoryId: 'southern_europe',
    toTerritoryId: 'egypt',
    points: [
      { x: 602, y: 294 },
      { x: 602, y: 333 },
    ],
  },
  // Red Sea & Madagascar
  {
    id: 'sea_e_africa_middle_east',
    fromTerritoryId: 'east_africa',
    toTerritoryId: 'middle_east',
    points: [
      { x: 644, y: 408 },
      { x: 668, y: 368 },
    ],
  },
  {
    id: 'sea_e_africa_madagascar',
    fromTerritoryId: 'east_africa',
    toTerritoryId: 'madagascar',
    points: [
      { x: 648, y: 466 },
      { x: 668, y: 490 },
    ],
  },
  {
    id: 'sea_s_africa_madagascar',
    fromTerritoryId: 'south_africa',
    toTerritoryId: 'madagascar',
    points: [
      { x: 601, y: 536 },
      { x: 663, y: 532 },
    ],
  },
  // East Asia & Japan
  {
    id: 'sea_kamchatka_japan',
    fromTerritoryId: 'kamchatka',
    toTerritoryId: 'japan',
    points: [
      { x: 1048, y: 202 },
      { x: 1058, y: 229 },
    ],
  },
  {
    id: 'sea_mongolia_japan',
    fromTerritoryId: 'mongolia',
    toTerritoryId: 'japan',
    points: [
      { x: 980, y: 232 },
      { x: 1036, y: 250 },
    ],
  },
  // Southeast Asia & Australia
  {
    id: 'sea_siam_indonesia',
    fromTerritoryId: 'siam',
    toTerritoryId: 'indonesia',
    points: [
      { x: 904, y: 392 },
      { x: 918, y: 426 },
    ],
  },
  {
    id: 'sea_indonesia_new_guinea',
    fromTerritoryId: 'indonesia',
    toTerritoryId: 'new_guinea',
    points: [
      { x: 970, y: 444 },
      { x: 1020, y: 444 },
    ],
  },
  {
    id: 'sea_indonesia_w_australia',
    fromTerritoryId: 'indonesia',
    toTerritoryId: 'western_australia',
    points: [
      { x: 942, y: 466 },
      { x: 962, y: 504 },
    ],
  },
  {
    id: 'sea_new_guinea_w_australia',
    fromTerritoryId: 'new_guinea',
    toTerritoryId: 'western_australia',
    points: [
      { x: 1034, y: 462 },
      { x: 996, y: 503 },
    ],
  },
  {
    id: 'sea_new_guinea_e_australia',
    fromTerritoryId: 'new_guinea',
    toTerritoryId: 'eastern_australia',
    points: [
      { x: 1066, y: 463 },
      { x: 1066, y: 500 },
    ],
  },
];

export function buildStandardRiskDeck(): readonly RiskCard[] {
  const territoryCards: RiskCard[] = RISK_TERRITORIES.map((t) => ({
    id: `card_${t.id}`,
    symbol: t.cardSymbol,
    territoryId: t.id,
  }));
  const wildCards: RiskCard[] = [
    { id: 'card_wild_1', symbol: 'WILD', territoryId: null },
    { id: 'card_wild_2', symbol: 'WILD', territoryId: null },
  ];
  return [...territoryCards, ...wildCards];
}

export function areRiskTerritoriesAdjacent(
  a: RiskTerritoryId,
  b: RiskTerritoryId
): boolean {
  const meta = RISK_TERRITORIES_BY_ID[a];
  return meta ? meta.adjacentIds.includes(b) : false;
}
