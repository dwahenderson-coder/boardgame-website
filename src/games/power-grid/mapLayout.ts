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

export interface PowerGridMapVisualLayout {
  readonly mapId: 'USA' | 'GERMANY';
  readonly viewBoxWidth: number;
  readonly viewBoxHeight: number;
  readonly regions: Readonly<Record<string, PowerGridRegionVisual>>;
  readonly cities: Readonly<Record<string, PowerGridCityCoord>>;
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

export const POWER_GRID_VISUAL_LAYOUTS: Readonly<
  Record<'USA' | 'GERMANY', PowerGridMapVisualLayout>
> = {
  USA: USA_VISUAL_LAYOUT,
  GERMANY: GERMANY_VISUAL_LAYOUT,
};
