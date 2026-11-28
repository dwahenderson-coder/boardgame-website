import { PowerGridMapId } from './types.js';

export interface PowerGridCityCoord {
  readonly x: number;
  readonly y: number;
}

export interface PowerGridRegionVisual {
  readonly id: string;
  readonly label: string;
  readonly fillHex: string;
  readonly borderHex: string;
  readonly badgeHex: string;
  readonly textHex: string;
  readonly labelPos: { readonly x: number; readonly y: number };
  readonly polygonPath: string;
}

export interface PowerGridDistrictClusterVisual {
  readonly label: string;
  readonly x: number;
  readonly y: number;
  readonly rx: number;
  readonly ry: number;
}

export interface PowerGridMapVisualLayout {
  readonly mapId: PowerGridMapId;
  readonly viewBoxWidth: number;
  readonly viewBoxHeight: number;
  readonly regions: Readonly<Record<string, PowerGridRegionVisual>>;
  readonly cities: Readonly<Record<string, PowerGridCityCoord>>;
  readonly districtClusters?: readonly PowerGridDistrictClusterVisual[];
}

export const USA_VISUAL_LAYOUT: PowerGridMapVisualLayout = {
  mapId: 'USA',
  viewBoxWidth: 1160,
  viewBoxHeight: 660,
  regions: {
    NORTHWEST: {
      id: 'NORTHWEST',
      label: 'Northwest',
      fillHex: '#581c87',
      borderHex: '#c084fc',
      badgeHex: '#7e22ce',
      textHex: '#f3e8ff',
      labelPos: { x: 245, y: 58 },
      polygonPath:
        'M 42,42 L 435,42 L 445,175 L 560,205 L 555,272 L 432,315 L 330,315 L 312,225 L 152,222 L 42,195 Z',
    },
    SOUTHWEST: {
      id: 'SOUTHWEST',
      label: 'Southwest',
      fillHex: '#164e63',
      borderHex: '#22d3ee',
      badgeHex: '#0e7490',
      textHex: '#cffafe',
      labelPos: { x: 162, y: 512 },
      polygonPath:
        'M 36,225 L 152,222 L 312,225 L 330,315 L 425,342 L 422,445 L 305,498 L 118,505 L 36,345 Z',
    },
    MIDWEST: {
      id: 'MIDWEST',
      label: 'Midwest',
      fillHex: '#713f12',
      borderHex: '#facc15',
      badgeHex: '#a16207',
      textHex: '#fef9c3',
      labelPos: { x: 645, y: 54 },
      polygonPath:
        'M 450,48 L 668,48 L 742,188 L 835,268 L 842,395 L 742,395 L 602,352 L 568,202 L 450,168 Z',
    },
    SOUTH_CENTRAL: {
      id: 'SOUTH_CENTRAL',
      label: 'South Central',
      fillHex: '#7f1d1d',
      borderHex: '#f87171',
      badgeHex: '#b91c1c',
      textHex: '#fee2e2',
      labelPos: { x: 582, y: 614 },
      polygonPath:
        'M 442,292 L 598,292 L 705,378 L 785,432 L 778,495 L 692,596 L 468,604 L 442,385 Z',
    },
    NORTHEAST: {
      id: 'NORTHEAST',
      label: 'Northeast',
      fillHex: '#7c2d12',
      borderHex: '#fb923c',
      badgeHex: '#c2410c',
      textHex: '#ffedd5',
      labelPos: { x: 965, y: 92 },
      polygonPath:
        'M 748,148 L 935,118 L 1132,78 L 1132,235 L 1075,296 L 995,332 L 908,326 L 838,266 L 748,218 Z',
    },
    SOUTHEAST: {
      id: 'SOUTHEAST',
      label: 'Southeast',
      fillHex: '#14532d',
      borderHex: '#4ade80',
      badgeHex: '#15803d',
      textHex: '#dcfce7',
      labelPos: { x: 1035, y: 545 },
      polygonPath:
        'M 855,342 L 1052,338 L 1042,418 L 976,498 L 1022,642 L 822,638 L 845,518 L 788,448 Z',
    },
  },
  cities: {
    // NORTHWEST (7)
    SEATTLE: { x: 118, y: 88 },
    PORTLAND: { x: 96, y: 158 },
    BOISE: { x: 210, y: 176 },
    BILLINGS: { x: 332, y: 124 },
    CHEYENNE: { x: 382, y: 218 },
    DENVER: { x: 382, y: 282 },
    OMAHA: { x: 508, y: 238 },
    // SOUTHWEST (7)
    SAN_FRANCISCO: { x: 84, y: 284 },
    LOS_ANGELES: { x: 114, y: 386 },
    SAN_DIEGO: { x: 152, y: 458 },
    LAS_VEGAS: { x: 208, y: 350 },
    SALT_LAKE_CITY: { x: 266, y: 262 },
    PHOENIX: { x: 262, y: 446 },
    SANTA_FE: { x: 372, y: 388 },
    // MIDWEST (7)
    FARGO: { x: 502, y: 110 },
    DULUTH: { x: 608, y: 98 },
    MINNEAPOLIS: { x: 592, y: 170 },
    CHICAGO: { x: 690, y: 228 },
    ST_LOUIS: { x: 648, y: 314 },
    CINCINNATI: { x: 778, y: 294 },
    KNOXVILLE: { x: 792, y: 366 },
    // SOUTH_CENTRAL (7)
    KANSAS_CITY: { x: 534, y: 320 },
    OKLAHOMA_CITY: { x: 496, y: 400 },
    DALLAS: { x: 504, y: 476 },
    HOUSTON: { x: 522, y: 558 },
    MEMPHIS: { x: 652, y: 406 },
    NEW_ORLEANS: { x: 648, y: 550 },
    BIRMINGHAM: { x: 736, y: 454 },
    // NORTHEAST (7)
    DETROIT: { x: 794, y: 192 },
    BUFFALO: { x: 896, y: 166 },
    PITTSBURGH: { x: 882, y: 248 },
    WASHINGTON: { x: 956, y: 302 },
    PHILADELPHIA: { x: 1030, y: 256 },
    NEW_YORK: { x: 1054, y: 192 },
    BOSTON: { x: 1088, y: 122 },
    // SOUTHEAST (7)
    NORFOLK: { x: 1000, y: 368 },
    RALEIGH: { x: 916, y: 394 },
    ATLANTA: { x: 834, y: 450 },
    SAVANNAH: { x: 924, y: 476 },
    JACKSONVILLE: { x: 900, y: 538 },
    TAMPA: { x: 874, y: 598 },
    MIAMI: { x: 970, y: 614 },
  },
};

export const GERMANY_VISUAL_LAYOUT: PowerGridMapVisualLayout = {
  mapId: 'GERMANY',
  viewBoxWidth: 1160,
  viewBoxHeight: 660,
  regions: {
    NORTH: {
      id: 'NORTH',
      label: 'North',
      fillHex: '#164e63',
      borderHex: '#22d3ee',
      badgeHex: '#0e7490',
      textHex: '#cffafe',
      labelPos: { x: 320, y: 58 },
      polygonPath:
        'M 225,88 L 415,24 L 585,56 L 568,192 L 525,282 L 425,282 L 340,215 L 225,182 Z',
    },
    EAST: {
      id: 'EAST',
      label: 'East',
      fillHex: '#14532d',
      borderHex: '#4ade80',
      badgeHex: '#15803d',
      textHex: '#dcfce7',
      labelPos: { x: 845, y: 58 },
      polygonPath:
        'M 588,58 L 765,42 L 962,78 L 978,278 L 758,282 L 596,286 L 574,188 Z',
    },
    WEST: {
      id: 'WEST',
      label: 'West',
      fillHex: '#581c87',
      borderHex: '#c084fc',
      badgeHex: '#7e22ce',
      textHex: '#f3e8ff',
      labelPos: { x: 145, y: 248 },
      polygonPath:
        'M 98,286 L 278,214 L 392,226 L 402,382 L 306,452 L 106,422 Z',
    },
    CENTER: {
      id: 'CENTER',
      label: 'Center',
      fillHex: '#713f12',
      borderHex: '#facc15',
      badgeHex: '#a16207',
      textHex: '#fef9c3',
      labelPos: { x: 965, y: 312 },
      polygonPath:
        'M 418,292 L 758,292 L 975,318 L 968,402 L 668,416 L 438,434 L 414,368 Z',
    },
    SOUTH_WEST: {
      id: 'SOUTH_WEST',
      label: 'South-West',
      fillHex: '#7f1d1d',
      borderHex: '#f87171',
      badgeHex: '#b91c1c',
      textHex: '#fee2e2',
      labelPos: { x: 148, y: 618 },
      polygonPath:
        'M 78,432 L 306,432 L 498,442 L 502,602 L 282,608 L 165,612 L 78,498 Z',
    },
    SOUTH_EAST: {
      id: 'SOUTH_EAST',
      label: 'South-East',
      fillHex: '#7c2d12',
      borderHex: '#fb923c',
      badgeHex: '#c2410c',
      textHex: '#ffedd5',
      labelPos: { x: 892, y: 588 },
      polygonPath:
        'M 516,436 L 745,436 L 868,482 L 858,634 L 292,648 L 308,602 L 512,598 Z',
    },
  },
  cities: {
    // NORTH (7)
    FLENSBURG: { x: 458, y: 58 },
    KIEL: { x: 540, y: 98 },
    CUXHAVEN: { x: 378, y: 118 },
    WILHELMSHAVEN: { x: 280, y: 152 },
    HAMBURG: { x: 518, y: 162 },
    BREMEN: { x: 392, y: 188 },
    HANNOVER: { x: 476, y: 248 },
    // EAST (7)
    ROSTOCK: { x: 728, y: 86 },
    TORGELOW: { x: 874, y: 114 },
    LUBECK: { x: 618, y: 126 },
    SCHWERIN: { x: 672, y: 178 },
    MAGDEBURG: { x: 648, y: 256 },
    BERLIN: { x: 794, y: 218 },
    FRANKFURT_ODER: { x: 920, y: 238 },
    // WEST (7)
    OSNABRUCK: { x: 332, y: 252 },
    MUNSTER: { x: 268, y: 304 },
    DUISBURG: { x: 154, y: 326 },
    ESSEN: { x: 250, y: 356 },
    DORTMUND: { x: 352, y: 344 },
    DUSSELDORF: { x: 164, y: 392 },
    KOLN: { x: 262, y: 422 },
    // CENTER (7)
    KASSEL: { x: 468, y: 336 },
    GOTTINGEN: { x: 560, y: 316 },
    FULDA: { x: 494, y: 406 },
    ERFURT: { x: 626, y: 368 },
    HALLE: { x: 716, y: 326 },
    LEIPZIG: { x: 804, y: 350 },
    DRESDEN: { x: 916, y: 360 },
    // SOUTH_WEST (7)
    AACHEN: { x: 132, y: 458 },
    TRIER: { x: 184, y: 520 },
    WIESBADEN: { x: 346, y: 458 },
    FRANKFURT_MAIN: { x: 444, y: 470 },
    SAARBRUCKEN: { x: 224, y: 580 },
    MANNHEIM: { x: 374, y: 536 },
    STUTTGART: { x: 458, y: 576 },
    // SOUTH_EAST (7)
    WURZBURG: { x: 564, y: 474 },
    NURNBERG: { x: 680, y: 476 },
    REGENSBURG: { x: 794, y: 514 },
    FREIBURG: { x: 344, y: 624 },
    KONSTANZ: { x: 482, y: 630 },
    AUGSBURG: { x: 648, y: 576 },
    MUNCHEN: { x: 780, y: 600 },
  },
};

export const QUEBEC_VISUAL_LAYOUT: PowerGridMapVisualLayout = {
  mapId: 'QUEBEC',
  viewBoxWidth: 1160,
  viewBoxHeight: 660,
  regions: {
    NORTHWEST: {
      id: 'NORTHWEST',
      label: 'Northwest',
      fillHex: '#581c87',
      borderHex: '#c084fc',
      badgeHex: '#7e22ce',
      textHex: '#f3e8ff',
      labelPos: { x: 115, y: 92 },
      polygonPath:
        'M 34,98 L 235,88 L 338,278 L 315,492 L 122,496 L 34,242 Z',
    },
    CENTRAL_HEARTLAND: {
      id: 'CENTRAL_HEARTLAND',
      label: 'Central Heartland',
      fillHex: '#713f12',
      borderHex: '#facc15',
      badgeHex: '#a16207',
      textHex: '#fef9c3',
      labelPos: { x: 432, y: 222 },
      polygonPath:
        'M 338,242 L 548,225 L 642,298 L 648,452 L 562,458 L 322,448 Z',
    },
    SOUTHWEST_METRO: {
      id: 'SOUTHWEST_METRO',
      label: 'Southwest Metro',
      fillHex: '#7f1d1d',
      borderHex: '#f87171',
      badgeHex: '#b91c1c',
      textHex: '#fee2e2',
      labelPos: { x: 472, y: 634 },
      polygonPath:
        'M 304,462 L 562,462 L 656,502 L 656,628 L 304,626 Z',
    },
    CENTRAL_EAST: {
      id: 'CENTRAL_EAST',
      label: 'Central East',
      fillHex: '#831843',
      borderHex: '#f472b6',
      badgeHex: '#be185d',
      textHex: '#fce7f3',
      labelPos: { x: 752, y: 616 },
      polygonPath:
        'M 652,232 L 892,192 L 892,252 L 818,365 L 835,518 L 758,608 L 662,598 L 652,355 Z',
    },
    NORTH: {
      id: 'NORTH',
      label: 'North',
      fillHex: '#14532d',
      borderHex: '#4ade80',
      badgeHex: '#15803d',
      textHex: '#dcfce7',
      labelPos: { x: 845, y: 46 },
      polygonPath:
        'M 536,84 L 705,46 L 1142,36 L 1142,126 L 968,186 L 692,196 L 536,166 Z',
    },
    EAST: {
      id: 'EAST',
      label: 'East',
      fillHex: '#451a03',
      borderHex: '#d97706',
      badgeHex: '#92400e',
      textHex: '#fef3c7',
      labelPos: { x: 1058, y: 422 },
      polygonPath:
        'M 818,365 L 905,252 L 1035,172 L 1146,218 L 1146,404 L 982,392 L 835,412 Z',
    },
  },
  districtClusters: [
    { label: 'Greater Montréal', x: 474, y: 455, rx: 92, ry: 72 },
    { label: 'Québec City', x: 742, y: 292, rx: 86, ry: 66 },
  ],
  cities: {
    // NORTHWEST (7)
    ROUYN_NORANDA: { x: 82, y: 178 },
    AMOS: { x: 168, y: 132 },
    VAL_DOR: { x: 178, y: 224 },
    MANIWAKI: { x: 206, y: 336 },
    MONT_LAURIER: { x: 296, y: 314 },
    HULL: { x: 168, y: 452 },
    GATINEAU: { x: 258, y: 452 },
    // CENTRAL_HEARTLAND (7)
    LACHUTE: { x: 352, y: 412 },
    LAVAL: { x: 436, y: 408 },
    LONGUEUIL: { x: 522, y: 434 },
    REPENTIGNY: { x: 518, y: 368 },
    SHAWINIGAN: { x: 492, y: 266 },
    TROIS_RIVIERES: { x: 576, y: 312 },
    DRUMMONDVILLE: { x: 612, y: 424 },
    // SOUTHWEST_METRO (7)
    VAUDREUIL_DORION: { x: 346, y: 514 },
    VALLEYFIELD: { x: 352, y: 588 },
    POINTE_CLAIRE: { x: 428, y: 482 },
    MONTREAL: { x: 508, y: 496 },
    BROSSARD: { x: 486, y: 568 },
    ST_HYACINTHE: { x: 578, y: 518 },
    GRANBY: { x: 616, y: 592 },
    // CENTRAL_EAST (7)
    VICTORIAVILLE: { x: 688, y: 396 },
    SHERBROOKE: { x: 702, y: 568 },
    ST_GEORGES: { x: 792, y: 486 },
    BEAUPORT: { x: 692, y: 286 },
    CHARLESBOURG: { x: 768, y: 256 },
    QUEBEC: { x: 768, y: 332 },
    ST_SIMEON: { x: 854, y: 218 },
    // NORTH (7)
    ROBERVAL: { x: 582, y: 126 },
    ALMA: { x: 674, y: 96 },
    JONQUIERE: { x: 724, y: 158 },
    CHICOUTIMI: { x: 808, y: 138 },
    BAIE_COMEAU: { x: 928, y: 146 },
    PORT_CARTIER: { x: 1018, y: 108 },
    SEPT_ILES: { x: 1102, y: 74 },
    // EAST (7)
    MONTMAGNY: { x: 854, y: 368 },
    RIVIERE_DU_LOUP: { x: 916, y: 298 },
    RIMOUSKI: { x: 968, y: 242 },
    MATANE: { x: 1028, y: 206 },
    STE_ANNE_DES_MONTS: { x: 1096, y: 246 },
    POINTE_A_LA_CROIX: { x: 1012, y: 342 },
    GASPE: { x: 1106, y: 362 },
  },
};

export const BADEN_WUERTTEMBERG_VISUAL_LAYOUT: PowerGridMapVisualLayout = {
  mapId: 'BADEN_WUERTTEMBERG',
  viewBoxWidth: 1160,
  viewBoxHeight: 660,
  regions: {
    NORTH: {
      id: 'NORTH',
      label: 'North',
      fillHex: '#7f1d1d',
      borderHex: '#f87171',
      badgeHex: '#b91c1c',
      textHex: '#fee2e2',
      labelPos: { x: 495, y: 52 },
      polygonPath:
        'M 205,62 L 772,48 L 768,218 L 525,228 L 338,212 L 205,148 Z',
    },
    WEST: {
      id: 'WEST',
      label: 'West',
      fillHex: '#713f12',
      borderHex: '#facc15',
      badgeHex: '#a16207',
      textHex: '#fef9c3',
      labelPos: { x: 158, y: 256 },
      polygonPath:
        'M 78,365 L 205,222 L 468,232 L 432,332 L 315,508 L 182,508 L 78,448 Z',
    },
    EAST: {
      id: 'EAST',
      label: 'East',
      fillHex: '#1e3a8a',
      borderHex: '#60a5fa',
      badgeHex: '#1d4ed8',
      textHex: '#dbeafe',
      labelPos: { x: 868, y: 138 },
      polygonPath:
        'M 476,232 L 772,218 L 988,158 L 988,238 L 748,382 L 598,442 L 436,432 L 432,332 Z',
    },
    SOUTH_WEST: {
      id: 'SOUTH_WEST',
      label: 'South-West',
      fillHex: '#134e4a',
      borderHex: '#2dd4bf',
      badgeHex: '#0f766e',
      textHex: '#ccfbf1',
      labelPos: { x: 252, y: 646 },
      polygonPath:
        'M 58,588 L 198,512 L 568,482 L 568,632 L 58,646 Z',
    },
    SOUTH_EAST: {
      id: 'SOUTH_EAST',
      label: 'South-East',
      fillHex: '#581c87',
      borderHex: '#c084fc',
      badgeHex: '#7e22ce',
      textHex: '#f3e8ff',
      labelPos: { x: 938, y: 588 },
      polygonPath:
        'M 588,446 L 748,382 L 992,368 L 992,452 L 892,638 L 582,638 Z',
    },
  },
  cities: {
    // NORTH (7 — incl. Ludwigshafen Transregional)
    LUDWIGSHAFEN: { x: 256, y: 98 },
    MANNHEIM: { x: 358, y: 114 },
    HEIDELBERG: { x: 392, y: 176 },
    SINSHEIM: { x: 488, y: 188 },
    TAUBERBISCHOFSHEIM: { x: 648, y: 82 },
    HEILBRONN: { x: 588, y: 198 },
    SCHWABISCH_HALL: { x: 716, y: 178 },
    // WEST (7 — incl. Strasbourg Transregional)
    KARLSRUHE: { x: 324, y: 248 },
    PFORZHEIM: { x: 428, y: 272 },
    RASTATT: { x: 246, y: 294 },
    BADEN_BADEN: { x: 282, y: 354 },
    OFFENBURG: { x: 238, y: 418 },
    STRASBOURG: { x: 128, y: 408 },
    LAHR: { x: 234, y: 482 },
    // EAST (7 — incl. Nürnberg Transregional)
    LUDWIGSBURG: { x: 562, y: 268 },
    STUTTGART: { x: 566, y: 330 },
    BOBLINGEN: { x: 476, y: 356 },
    REUTLINGEN: { x: 542, y: 408 },
    GOPPINGEN: { x: 686, y: 336 },
    ELLWANGEN: { x: 808, y: 246 },
    NURNBERG: { x: 934, y: 194 },
    // SOUTH_WEST (7 — incl. Basel Transregional)
    FREIBURG: { x: 258, y: 546 },
    LORRACH: { x: 198, y: 608 },
    BASEL: { x: 108, y: 622 },
    WALDSHUT_TIENGEN: { x: 338, y: 614 },
    DONAUESCHINGEN: { x: 406, y: 526 },
    TUTTLINGEN: { x: 508, y: 514 },
    SINGEN: { x: 518, y: 594 },
    // SOUTH_EAST (7 — incl. Augsburg Transregional)
    ULM: { x: 768, y: 418 },
    AUGSBURG: { x: 936, y: 408 },
    SIGMARINGEN: { x: 644, y: 496 },
    BIBERACH: { x: 778, y: 498 },
    KONSTANZ: { x: 624, y: 606 },
    FRIEDRICHSHAFEN: { x: 742, y: 608 },
    RAVENSBURG: { x: 832, y: 566 },
  },
};

export const POWER_GRID_VISUAL_LAYOUTS: Readonly<
  Record<PowerGridMapId, PowerGridMapVisualLayout>
> = {
  USA: USA_VISUAL_LAYOUT,
  GERMANY: GERMANY_VISUAL_LAYOUT,
  QUEBEC: QUEBEC_VISUAL_LAYOUT,
  BADEN_WUERTTEMBERG: BADEN_WUERTTEMBERG_VISUAL_LAYOUT,
};
