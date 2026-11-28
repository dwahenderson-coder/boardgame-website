import { GameId } from '../types/game.js';

export interface RuleReferenceTable {
  readonly title: string;
  readonly headers: readonly string[];
  readonly rows: readonly (readonly string[])[];
}

export interface RuleTurnStepItem {
  readonly title: string;
  readonly detail: string;
  readonly uiTip?: string;
}

export interface RuleVariantEntry {
  /** Matches expansion IDs or derived state flags (e.g., 'europe_map', 'germany_map', 'advanced_board', 'always_active') */
  readonly id: string;
  readonly title: string;
  readonly summary: string;
  readonly details: readonly string[];
}

export interface GameRulebook {
  readonly gameId: GameId;
  readonly tagline: string;
  readonly objective: string;
  readonly quickSummaryBullets: readonly string[];
  readonly referenceTables: readonly RuleReferenceTable[];
  readonly turnFlowSteps: readonly RuleTurnStepItem[];
  readonly scoringAndEndGame: {
    readonly endTrigger: string;
    readonly scoringRules: readonly string[];
    readonly tieBreaker: string;
  };
  readonly variantsAndExpansions: readonly RuleVariantEntry[];
  readonly pdfUrl?: string;
}

export const GAME_RULES_BY_ID: Readonly<Record<GameId, GameRulebook>> = {
  // ===========================================================================
  // 1. TICKET TO RIDE
  // ===========================================================================
  ttr: {
    gameId: 'ttr',
    tagline: 'Collect train cards, claim railway routes, and connect Destination Ticket cities.',
    objective:
      'Score the most points from claiming railway routes between cities, completing secret Destination Tickets, and earning the Longest Continuous Path bonus (+10 pts).',
    quickSummaryBullets: [
      'Each player starts with 45 plastic trains, 4 Train Cards, and Destination Tickets (keep at least 2 at game start).',
      'On your turn, perform EXACTLY ONE main action: (1) Draw 2 Train Cards, (2) Claim 1 Route, or (3) Draw 3 Destination Tickets (keep at least 1).',
      'Taking a face-up Locomotive (rainbow wild) counts as BOTH card draws for your turn (you cannot take a face-up Locomotive as your 2nd draw). Blind Locomotives from the deck only count as 1 card.',
      'Gray routes accept a matching set of ANY single color; Locomotives act as wild cards for any route.',
      'In 2-player and 3-player games, only ONE track of a double-route may be claimed.',
    ],
    referenceTables: [
      {
        title: 'Route Length Scoring Table',
        headers: ['Route Length', 'Points Awarded'],
        rows: [
          ['1 Train', '1 pt'],
          ['2 Trains', '2 pts'],
          ['3 Trains', '4 pts'],
          ['4 Trains', '7 pts'],
          ['5 Trains', '10 pts'],
          ['6 Trains', '15 pts'],
          ['8 Trains (Europe)', '21 pts'],
        ],
      },
    ],
    turnFlowSteps: [
      {
        title: 'Option A: Draw Train Cards',
        detail:
          'Draw 2 cards from the 5 face-up cards or blind Draw Deck. If 3+ face-up cards become Locomotives simultaneously, all 5 face-up cards are discarded and replaced.',
        uiTip: 'Click face-up Train Cards or the Draw Deck in the bottom card tray.',
      },
      {
        title: 'Option B: Claim a Route',
        detail:
          'Discard a set of Train Cards matching the length and color of an unclaimed route, then place your trains on that route to score immediate points.',
        uiTip:
          'Click any glowing route on the map to open the payment popover, and use +/- or scroll to zoom and pan the map.',
      },
      {
        title: 'Option C: Draw Destination Tickets',
        detail:
          'Draw 3 new Destination Tickets and keep at least 1. Completed tickets add their point value at game end; uncompleted tickets subtract their value!',
        uiTip:
          'Hover any Destination Ticket card to preview its exact city-to-city arc on the main map; completed tickets glow green.',
      },
    ],
    scoringAndEndGame: {
      endTrigger:
        'When any player’s plastic train supply drops to 2, 1, or 0 trains at the end of their turn, every player (including that player) gets 1 final turn.',
      scoringRules: [
        '+ Route Points scored during the match based on route lengths.',
        '+ Value of every Destination Ticket whose two cities are connected by a continuous chain of your routes.',
        '− Value of every uncompleted Destination Ticket still in your hand.',
        '+ 10 pts for the player(s) holding the Longest Continuous Path (Trans America Express / European Express).',
      ],
      tieBreaker:
        'Most completed Destination Tickets, then holder of the Longest Continuous Path (+10 bonus).',
    },
    variantsAndExpansions: [
      {
        id: 'europe_map',
        title: 'Ticket to Ride: Europe Map',
        summary: 'Adds Ferries, Mountain Tunnels, 3 Train Stations per player, and 8-train routes.',
        details: [
          'Ferries: Gray/colored water routes marked with Locomotive icons require that exact number of Locomotives as part of payment.',
          'Mountain Tunnels: Outlined routes flip the top 3 cards from the deck—each flipped card matching your payment color (or Locomotive) requires 1 extra matching card from your hand, or you cancel the claim at no penalty.',
          'Train Stations (3 per player): Cost 1 card for your 1st station, 2 matching cards for your 2nd, and 3 matching cards for your 3rd. Lets you borrow 1 route into that city for Destination Ticket completion; each unused station is worth +4 pts!',
        ],
      },
      {
        id: 'alvin_and_dexter',
        title: 'Alvin & Dexter Monster Expansion',
        summary: 'Adds Alvin the Alien (🛸) and Dexter the Dinosaur (🦖) causing City Chaos.',
        details: [
          'A city occupied by Alvin or Dexter is in Chaos: routes into/out of that city cannot be claimed while the monster remains there.',
          'Destination Tickets referencing a city in Chaos at the end of the game have their positive point value halved (rounded down).',
          'During your turn, you may spend 1 or 2 Locomotives to move Alvin or Dexter up to 3 cities per Locomotive and collect an Alvin/Dexter card (+15 pts end-game bonus for most Alvin / most Dexter cards).',
        ],
      },
      {
        id: '1910_mystery_train',
        title: 'USA 1910 / Mystery Train',
        summary: 'Expanded North America ticket pool and classic Globetrotter bonus.',
        details: [
          'Compatible with the North America base map alongside expanded route strategies.',
        ],
      },
    ],
  },

  // ===========================================================================
  // 2. CATAN
  // ===========================================================================
  catan: {
    gameId: 'catan',
    tagline: 'Harvest hex resources, negotiate trades, and build settlements & cities to 10 VP.',
    objective:
      'Be the first settler to reach 10 Victory Points (VP) on your turn through Settlements, Cities, Longest Road, Largest Army, and VP Development Cards.',
    quickSummaryBullets: [
      'Snake-draft setup: Players place 2 Settlements + 2 Roads (1st -> Last, then Last -> 1st) and collect starting resources from their 2nd Settlement.',
      'Distance Rule: No two Settlements/Cities may occupy adjacent intersections—at least 2 road edges must separate them.',
      'Rolling a 7: Anyone holding 8+ resource cards discards half (rounded down); the roller moves the Robber to block a hex and steals 1 random card from an adjacent player.',
      'You may play at most 1 Development Card per turn, and never on the same turn you bought it (except winning VP cards at 10 VP).',
    ],
    referenceTables: [
      {
        title: 'Building Costs & Victory Points',
        headers: ['Build Item', 'Resource Cost', 'Victory Points'],
        rows: [
          ['Road', '1 Wood + 1 Brick', '0 VP (Longest Road 5+ = 2 VP)'],
          ['Settlement', '1 Wood + 1 Brick + 1 Sheep + 1 Wheat', '1 VP'],
          ['City (Upgrade)', '2 Wheat + 3 Ore', '2 VP (replaces Settlement +1)'],
          ['Development Card', '1 Sheep + 1 Wheat + 1 Ore', 'Knight / Progress / 1 VP'],
        ],
      },
    ],
    turnFlowSteps: [
      {
        title: '1. Resource Production (Roll 2d6)',
        detail:
          'Every Settlement adjacent to a hex matching the dice sum produces 1 resource; every City produces 2 resources (unless blocked by the Robber).',
        uiTip: 'When playing a Knight or rolling a 7, click any hex to preview moving the Robber and confirm.',
      },
      {
        title: '2. Trade (Domestic & Maritime)',
        detail:
          'Propose player-to-player trades or trade with the bank at 4:1 (3:1 with a Generic Harbor, or 2:1 with a specialized Resource Harbor).',
        uiTip:
          'Click the Trade button to open the centered GUI Trade Window with your Offer on the left and Ask on the right.',
      },
      {
        title: '3. Build & Play Development Cards',
        detail:
          'Spend resources to build Roads, Settlements, Cities, or buy Development Cards (Knight, Road Building, Year of Plenty, Monopoly, Victory Point).',
        uiTip:
          'Clicking a Road, Settlement, City, or Robber spot flashes the location on the board with a Confirm / Cancel prompt.',
      },
    ],
    scoringAndEndGame: {
      endTrigger:
        'The game ends immediately when the active player reaches 10 or more Victory Points (including hidden VP cards) during their turn.',
      scoringRules: [
        '1 VP per Settlement on the board.',
        '2 VP per City on the board.',
        '2 VP for Longest Road (first continuous road of length 5+; stolen only by strictly longer road).',
        '2 VP for Largest Army (first to play 3 Knights; stolen only by strictly more played Knights).',
        '1 VP per Victory Point Development Card.',
      ],
      tieBreaker: 'Active player wins immediately upon hitting 10+ VP on their own turn.',
    },
    variantsAndExpansions: [
      {
        id: 'catan_5_6_player',
        title: '5–6 Player Extension',
        summary: 'Expands player capacity up to 6 settlers.',
        details: [
          'Allows up to 6 players in the lobby with unique lobby color selections.',
        ],
      },
    ],
  },

  // ===========================================================================
  // 3. RISK
  // ===========================================================================
  risk: {
    gameId: 'risk',
    tagline: 'Deploy armies across 42 territories, roll White vs. Red battle dice, and conquer the world.',
    objective:
      'Fulfill the active Victory Condition—conquer all rival commanders (World Domination), capture all World Capitals (Capital Risk), or complete your private Secret Mission.',
    quickSummaryBullets: [
      'Starting Armies: 40 (2P + 14 Neutral territories w/ 2 armies each), 35 (3P), 30 (4P), 25 (5P), or 20 (6P).',
      'Reinforcements each turn = max(3, floor(Owned Territories / 3)) + Continent Bonuses + Traded Card Sets.',
      'Combat Dice: Attackers roll 1–3 WHITE dice (leaving at least 1 army behind); Defenders roll 1–2 RED dice. Compare highest vs. highest (and 2nd highest if both rolled 2+). DEFENDER WINS ALL TIES!',
      'Conquering at least 1 territory during your turn earns 1 Risk Territory Card when your turn ends (max 1 card per turn).',
      'Holding 5+ Risk cards forces you to trade in a 3-card set (both at the start of Reinforce and immediately mid-turn if eliminating a rival gives you their cards).',
    ],
    referenceTables: [
      {
        title: 'Continent Control Bonuses',
        headers: ['Continent', 'Territories', 'Bonus Armies / Turn'],
        rows: [
          ['Asia', '12 Territories', '+7 Armies'],
          ['North America', '9 Territories', '+5 Armies'],
          ['Europe', '7 Territories', '+5 Armies'],
          ['Africa', '6 Territories', '+3 Armies'],
          ['South America', '4 Territories', '+2 Armies'],
          ['Australia', '4 Territories', '+2 Armies'],
        ],
      },
    ],
    turnFlowSteps: [
      {
        title: '1. Reinforce & Trade Risk Cards',
        detail:
          'Trade valid 3-card sets (3 matching symbols, 1 of each symbol, or any set with a Wild). Owning a territory pictured on a traded card places +2 bonus armies directly onto it (once per set). Deploy all unplaced armies onto your territories.',
        uiTip: 'Use the +1 / +5 / All batch toggle to deploy reinforcements quickly.',
      },
      {
        title: '2. Attack (Manual Volley or Auto Blitz)',
        detail:
          'Attack adjacent enemy territories across land borders or dashed sea routes (including Alaska ↔ Kamchatka). If defender armies drop to 0, advance at least as many armies as White dice rolled in the final volley.',
        uiTip:
          'Toggle Attack between Manual (1/2/3 White Dice) and Auto Blitz. Every player can also toggle their own Defense between Auto (Max Red Dice) and Manual (prompt for 1 or 2 Red Dice) anytime in the top bar!',
      },
      {
        title: '3. Fortify (Connected Chain)',
        detail:
          'Optionally move any number of armies (leaving at least 1 behind) from one owned territory to another connected through an unbroken chain of territories you control, then end your turn.',
      },
    ],
    scoringAndEndGame: {
      endTrigger:
        'Triggered immediately upon satisfying the active Victory Condition (World Domination, all Capitals controlled, or Secret Mission completed).',
      scoringRules: [
        'World Domination (Default): Eliminate all rival human commanders.',
        'Capital Risk: Control every Capital Headquarters territory simultaneously.',
        'Secret Mission: Complete the exact objective printed on your private Secret Mission dossier.',
      ],
      tieBreaker: 'Immediate victory upon achieving the active win condition.',
    },
    variantsAndExpansions: [
      {
        id: 'auto_setup',
        title: 'Fast Auto-Deal Setup',
        summary: 'Deals all 42 territories evenly at random instead of manual alternating claims.',
        details: [
          'Skips manual claiming and starts directly in remaining army placement (with a Quick-Deploy button if you want instant full setup).',
        ],
      },
      {
        id: 'fixed_card_values',
        title: 'Fixed Card Trade-In Values (4 / 6 / 8 / 10)',
        summary: 'Replaces classic escalating card sets (4, 6, 8, 10, 12, 15, 20...) with symbol-based sets.',
        details: [
          '3 Infantry = +4 armies • 3 Cavalry = +6 armies • 3 Artillery = +8 armies • 1 of Each = +10 armies (Wilds form highest valid set).',
        ],
      },
      {
        id: 'capital_risk',
        title: 'Capital Risk Win Condition',
        summary: 'Each commander establishes 1 Capital Headquarters (🏛️) after setup.',
        details: [
          'Capture and hold all Capitals simultaneously to win immediately without needing all 42 territories.',
        ],
      },
      {
        id: 'secret_mission',
        title: 'Secret Mission Win Condition',
        summary: 'Deals 1 private classified objective card to each commander.',
        details: [
          'Objectives include specific continent pairs, 24 territories, 18 territories with 2+ armies each, or eliminating a specific rival (falling back to 24 territories if eliminated by someone else).',
        ],
      },
    ],
  },

  // ===========================================================================
  // 4. STOCKPILE
  // ===========================================================================
  stockpile: {
    gameId: 'stockpile',
    tagline: 'Leverage private insider forecasts, bluff stockpiles, bid on portfolios, and ride splits & dividends.',
    objective:
      'Accumulate the highest Net Worth ($ Cash + Stock Liquidation + Majority Shareholder Bonuses) across the trading rounds.',
    quickSummaryBullets: [
      '6 Companies: Cosmic Computers (Blue), Bottomline Bank (Green), Leading Laboratories (Purple), American Automotive (Red), Stanford Steel (Grey), and Epic Electric (Yellow).',
      'Every round pairs the 6 companies with 6 Market Forecast cards (+4, +3, +2, +1, -2, -3, or $2,000/share Dividend): 1 pairing is Public, and each player sees 1 Private Insider pairing!',
      'Stock Split: Reaching the right end of a company’s track splits the stock—doubling every player’s shares in that company!',
      'Bankruptcy: Dropping off the left end (below 1) wipes out all currently held shares of that company and resets its share price to its start space.',
    ],
    referenceTables: [
      {
        title: 'Forecast Deck & End-Game Majority Bonuses',
        headers: ['Event / Bonus', 'Effect'],
        rows: [
          ['+4 / +3 / +2 / +1', 'Share price moves UP that many spaces (can trigger Split).'],
          ['-2 / -3', 'Share price moves DOWN that many spaces (can trigger Bankruptcy).'],
          ['Dividend ($2,000)', 'Price stays unchanged; pays $2,000 per share owned!'],
          ['Majority Shareholder', '+$10,000 for most shares in a company (+$5,000 for 2nd).'],
        ],
      },
    ],
    turnFlowSteps: [
      {
        title: '1. Information & 2. Supply',
        detail:
          'Inspect the 1 Public Forecast and your 1 Private Insider Forecast. Then place 1 Market card Face-Up and 1 Market card Face-Down onto any two Stockpiles (including Trading Fee cards, Boom +$2, Bust -$2, and Stock shares).',
      },
      {
        title: '3. Demand (Stockpile Bidding) & 4. Action',
        detail:
          'Bid from $0K to $25K to claim a Stockpile; outbid players must bid higher or move to another pile. Every player wins exactly 1 Stockpile and immediately resolves any Boom (+$2) or Bust (-$2) action cards inside.',
      },
      {
        title: '5. Selling & 6. End-of-Round Movement',
        detail:
          'Sell any shares at their current price BEFORE the hidden Forecasts resolve (handy if you know a company is crashing!). Then all 6 Forecasts reveal and shift stock prices.',
      },
    ],
    scoringAndEndGame: {
      endTrigger: 'Concludes after the final round’s Movement Phase.',
      scoringRules: [
        '+ All accumulated Cash (from sales, dividends, and starting capital minus bids/fees).',
        '+ Final Stock Liquidation: all remaining shares sold at their final share price.',
        '+ Majority Shareholder Bonuses ($10K for 1st, $5K for 2nd in each of the 6 companies).',
      ],
      tieBreaker: 'Highest total Net Worth.',
    },
    variantsAndExpansions: [
      {
        id: 'advanced_board',
        title: 'Advanced Board (Asymmetric Company Tracks)',
        summary: 'Unique risk/reward track for each of the 6 corporations!',
        details: [
          'Cosmic Computers (Blue): High-volatility steps 1–3–5–7–9 → Split (Start 5, Split to 5).',
          'Bottomline Bank (Green): Fast-splitting 1–2–3–4–5–6 → Split (Start 5, Split to 4).',
          'Leading Laboratories (Purple): Classic 1–10 → Split (Start 5, Split to 6).',
          'American Automotive (Red): High ceiling 1–3–5–7–9–11–13 → Split (Start 5, Split to 7).',
          'Stanford Steel (Grey): 1, 1$, 2, 2$, 3, 3$, 4, 4$, 5, 5$$ → Split — pays $1,000 per $ symbol passed or landed on ONLY when moving UP!',
          'Epic Electric (Yellow): Extended dual-5 / dual-6 stability track 1–3–4–5–5–6–6–7–8–10 → Split.',
        ],
      },
    ],
  },

  // ===========================================================================
  // 5. POWER GRID
  // ===========================================================================
  power_grid: {
    gameId: 'power_grid',
    tagline: 'Bid on illustrated power plants, buy scarce commodities, and wire cities across the USA or Germany.',
    objective:
      'Power the MOST connected cities (with fueled Power Plants!) during Phase 4 when any player connects the Game-End threshold of cities.',
    quickSummaryBullets: [
      'CRITICAL RULE: Connecting the most cities only triggers the end of the game—you WIN by powering the most cities with fueled plants!',
      'Turn Order Advantage: Leading players (most cities + highest plant) bid first in Auctions, while trailing players buy cheapest Fuel first AND build cheapest City slots first (reverse turn order in Phases 3 & 4!).',
      'Fuel Storage: Each Power Plant can store up to 2× its fuel intake requirement of its matching fuel type (Ecological plants require 0 fuel).',
      'Game Steps: Step 1 opens 1 slot/city ($10); Step 2 opens 2 slots/city ($10/$15); Step 3 opens all 3 slots/city ($10/$15/$20) and merges the Power Plant market to 6 plants.',
    ],
    referenceTables: [
      {
        title: 'Player Count Scaling & Thresholds',
        headers: ['Players', 'Active Regions', 'Max Plants', 'Step 2 Cities', 'Game End Cities'],
        rows: [
          ['2 Players', '3 Regions', '4 Plants', '10 Cities', '21 Cities'],
          ['3 Players', '3 Regions', '3 Plants', '7 Cities', '17 Cities'],
          ['4 Players', '4 Regions', '3 Plants', '7 Cities', '17 Cities'],
          ['5 Players', '5 Regions', '3 Plants', '7 Cities', '15 Cities'],
          ['6 Players', '5 Regions', '3 Plants', '6 Cities', '14 Cities'],
        ],
      },
      {
        title: 'Selected Bureaucracy Elektro Payouts',
        headers: ['Cities Powered', 'Elektro Paid'],
        rows: [
          ['0 / 1 / 2 / 3 Cities', '$10 / $22 / $33 / $44'],
          ['4 / 5 / 6 / 7 Cities', '$54 / $64 / $73 / $82'],
          ['8 / 10 / 12 / 15 Cities', '$90 / $105 / $118 / $134'],
          ['17 / 18 / 19 / 20+ Cities', '$142 / $145 / $148 / $150'],
        ],
      },
    ],
    turnFlowSteps: [
      {
        title: '1. Turn Order & 2. Power Plant Auctions',
        detail:
          'Turn order updates at the top of the board (most cities, tie-break highest plant). In Phase 2, players open bidding on plants in the Actual Market (minimum bid = plant number) or pass (Round 1 requires buying a plant). Max 1 plant bought per round.',
        uiTip:
          'Click the Power Plant Market Launcher Card at the top-right to expand the centered Power Plant Market & Auction Window!',
      },
      {
        title: '3. Buy Fuel Resources (Reverse Turn Order)',
        detail:
          'Starting from last in Turn Order to first, buy Coal, Oil, Garbage, or Uranium from the $1–$16 Resource Market at the bottom of the board up to 2× each plant’s intake.',
      },
      {
        title: '4. Build Cities (Reverse Turn Order) & 5. Bureaucracy',
        detail:
          'Connect new cities paying Slot Cost ($10/$15/$20) + Shortest Pipe Cost from your existing network (intermediate cities may be routed through freely). In Phase 5, spend fuel to power cities for Elektro and restock the Resource Market.',
        uiTip:
          'Hover any city on the map to highlight the shortest pipe path & cost, then click to flash the house slot and confirm placement! Use +/- or wheel to zoom/pan.',
      },
    ],
    scoringAndEndGame: {
      endTrigger:
        'Immediately at the end of Phase 4 (Building) in the round where at least 1 player reaches or exceeds the Game-End city count (21 / 17 / 17 / 15 / 14).',
      scoringRules: [
        'Winner is the player who can ACTUALLY POWER the most connected cities using their owned plants and currently stored fuel!',
      ],
      tieBreaker: '1st tie-breaker: Most remaining Elektro ($). 2nd tie-breaker: Most total connected cities.',
    },
    variantsAndExpansions: [
      {
        id: 'germany_map',
        title: 'Germany Map (Double-Sided Board)',
        summary: '42 German industrial cities across North, East, West, Center, South-West, and South-East.',
        details: [
          'Features dense Ruhr Valley & Saxony $0 twin-city links (Duisburg–Essen, Halle–Leipzig, Wiesbaden–Frankfurt) with inactive regions shown greyed out.',
        ],
      },
      {
        id: 'quebec_map',
        title: 'Québec Map (Hydro Expansion)',
        summary: '42 cities across 6 Québec regions with Ecological deck stack & Hydro market retention.',
        details: [
          'Deck Setup: Ecological plants #13, #18, and #22 are placed on top of the draw pile in that exact order (#13 on top).',
          'Hydro / Ecological Market Rule: Ecological (green) plants are NEVER cycled under the draw deck during Phase 5 Bureaucracy—instead, the highest-numbered non-ecological plant in the Future Market is placed under the deck.',
          'Multi-District Hubs: Greater Montréal (Laval, Longueuil, Pointe-Claire, Montréal) and Québec City (Charlesbourg, Beauport, Québec) feature $0 internal links.',
          'Uses the custom Québec Resource Replenishment Table.',
        ],
      },
      {
        id: 'baden_wuerttemberg_map',
        title: 'Baden-Württemberg Map (Transregional Expansion)',
        summary: '5 regions + 5 Transregional border cities, swapped Phase 2 → Phase 1, and faster Step 2.',
        details: [
          'Swapped Phase 1 & Phase 2: Every round runs Phase 2 (Auction Power Plants) FIRST, then re-determines Turn Order (Phase 1) before buying fuel and building cities!',
          'Transregional Cities (Ludwigshafen, Strasbourg, Nürnberg, Basel, Augsburg): Locked during Step 1; open in Step 2 starting at the $15 slot ($15 in Step 2, $15 & $20 in Step 3).',
          'Market Stagnation: If zero plants are bought in Phase 2, the 2 lowest-numbered plants are removed from the market instead of 1.',
          'Accelerated Step 2: Triggers at 9 cities (2P), 6 cities (3–5P), or 5 cities (6P).',
        ],
      },
      {
        id: 'region:CUSTOM',
        title: 'Custom Contiguous Region Setup',
        summary: 'Host manually chose custom contiguous regions instead of standard defaults.',
        details: [
          'All non-selected regions are cordoned off (greyed out) on the board and cannot be built in or routed through.',
        ],
      },
    ],
  },

  // ===========================================================================
  // 6. DOMINION
  // ===========================================================================
  dominion: {
    gameId: 'dominion',
    tagline: 'Draft Actions, Treasures, and Victory cards to build an efficient deck-building engine.',
    objective:
      'Have the most Victory Points (VP) across your entire deck when either the Province pile empties OR any 3 Supply piles empty.',
    quickSummaryBullets: [
      'Every player begins with an identical 10-card deck: 7 Coppers ($1 each) and 3 Estates (1 VP each).',
      'Remember A–B–C on every turn: Action Phase (play 1 Action) → Buy Phase (play Treasures & make 1 Buy) → Clean-Up (discard everything & draw 5 fresh cards).',
      'Cards granted "+1 Action" let you chain additional Action cards; "+1 Buy" lets you buy multiple Supply cards.',
      'Green Victory cards score points at game end, but clog your 5-card hand during the match unless they also have an Action/Treasure type!',
    ],
    referenceTables: [
      {
        title: 'Basic Supply Cards (In Every Match)',
        headers: ['Card', 'Cost', 'Effect / VP'],
        rows: [
          ['Copper / Silver / Gold', '$0 / $3 / $6', '+$1 / +$2 / +$3 Treasure'],
          ['Estate / Duchy / Province', '$2 / $5 / $8', '1 VP / 3 VP / 6 VP'],
          ['Curse', '$0', '-1 VP (given by Attacks like Witch)'],
        ],
      },
    ],
    turnFlowSteps: [
      {
        title: '1. Action Phase',
        detail:
          'Play up to 1 Action card from your hand (plus any bonus "+Actions" generated). Attack cards like Militia, Witch, Bureaucrat, Spy, or Pirate Ship affect rivals unless blocked by a Moat Reaction!',
      },
      {
        title: '2. Buy Phase',
        detail:
          'Play any Treasure cards from your hand (or click Play All Treasures) to add to your coin pool, then buy up to 1 card (+ bonus Buys) from the Supply into your discard pile.',
      },
      {
        title: '3. Clean-Up Phase',
        detail:
          'All played cards (except active Seaside Duration cards!) and unplayed hand cards go to your discard pile, and you draw a new 5-card hand (shuffling your discard pile whenever your draw deck runs out).',
      },
    ],
    scoringAndEndGame: {
      endTrigger:
        'At the end of any turn in which the Province pile is empty OR any 3 Supply piles are empty.',
      scoringRules: [
        'Sum all Victory symbols across your Deck, Hand, Discard, and Island/Native Village mats (including Gardens = 1 VP per 10 total cards owned, rounded down, minus Curses).',
      ],
      tieBreaker: 'If tied on VP, the tied player who took FEWER turns wins!',
    },
    variantsAndExpansions: [
      {
        id: 'seaside',
        title: 'Dominion: Seaside Expansion',
        summary: 'Adds Orange Duration cards, Player Mats (Island, Native Village, Pirate Ship), and Embargo tokens.',
        details: [
          'Duration Cards (e.g. Wharf, Fishing Village, Tactician, Lighthouse): Stay in play until the Clean-Up of the turn their "Next Turn" effect resolves!',
          'Island Mat: Sets aside Island (2 VP) + 1 card from your hand until game end.',
          'Pirate Ship Mat: Accumulates Coin tokens from successful attacks or produces +$1 per token.',
        ],
      },
      {
        id: 'base_1st_edition',
        title: '1st Edition Base Kingdom Cards',
        summary: 'Includes classic 1st Edition cards (Adventurer, Chancellor, Feast, Spy, Thief, Woodcutter).',
        details: [
          'Available in Random, Preset, and Custom 10-card Kingdom drafts.',
        ],
      },
    ],
  },

  // ===========================================================================
  // 7. CLUE
  // ===========================================================================
  clue: {
    gameId: 'clue',
    tagline: 'Move through Boddy Mansion, test Suspect + Weapon + Room suggestions, and solve the case.',
    objective:
      'Be the first detective to deduce the exact Suspect, Weapon, and Room hidden inside the Confidential Case File and make a correct Accusation.',
    quickSummaryBullets: [
      'At game start, 1 Suspect, 1 Weapon, and 1 Room are sealed in the Case File; the remaining 18 cards are dealt among the players.',
      'Corner Rooms feature diagonal Secret Passages: Study ↔ Kitchen and Lounge ↔ Conservatory.',
      'Making a Suggestion requires you to physically be inside the suggested Room—and teleports the named Suspect into that Room!',
      'Be careful: An incorrect Accusation eliminates you from moving and winning (though you still disprove others’ Suggestions)!',
    ],
    referenceTables: [
      {
        title: 'Clue Evidence Categories (21 Total Cards)',
        headers: ['Category', 'Cards'],
        rows: [
          ['6 Suspects', 'Scarlet, Mustard, White, Green, Peacock, Plum'],
          ['6 Weapons', 'Candlestick, Dagger, Lead Pipe, Revolver, Rope, Wrench'],
          ['9 Rooms', 'Kitchen, Ballroom, Conservatory, Dining, Billiard, Library, Lounge, Hall, Study'],
        ],
      },
    ],
    turnFlowSteps: [
      {
        title: '1. Movement (Roll, Secret Passage, or Stay)',
        detail:
          'Roll the die to move through hallways into a Room, take a corner Secret Passage, or stay in your current Room if another player’s Suggestion pulled you there since your last turn.',
      },
      {
        title: '2. Make a Suggestion & Disprove',
        detail:
          'Once inside a Room, suggest [Any Suspect] + [Any Weapon] + [Your Current Room]. Proceeding clockwise, the FIRST player holding 1+ of those cards privately reveals 1 matching card to you alone.',
        uiTip: 'Use your private Detective Notepad to cross off revealed evidence!',
      },
      {
        title: '3. Optional Formal Accusation',
        detail:
          'When confident, declare a formal Accusation naming ANY Suspect, Weapon, and Room.',
      },
    ],
    scoringAndEndGame: {
      endTrigger:
        'Ends immediately when a player makes a correct Accusation, or when only 1 non-eliminated detective remains.',
      scoringRules: [
        'Exact match on all 3 Case File cards wins the game!',
      ],
      tieBreaker: 'No ties—single winner per case.',
    },
    variantsAndExpansions: [],
  },

  // ===========================================================================
  // 8. DICE TOWN
  // ===========================================================================
  dice_town: {
    gameId: 'dice_town',
    tagline: 'Roll 5 Poker Dice to raid the Gold Mine, Bank, General Store, Saloon, Sheriff, and Town Hall!',
    objective:
      'Earn the most Victory Points (VP) from Nuggets, Cash, Property Deeds, General Store cards, and the Sheriff Star before the Gold Mine or Town Hall Deeds run out.',
    quickSummaryBullets: [
      'Poker Dice have 6 faces: 9 (Gold Nugget), 10 ($), Jack (General Store), Queen (Saloon), King (Sheriff), and Ace.',
      'Each roll, keeping 1 die is FREE; keeping 2+ dice costs $1 per extra die; OR you may keep 0 dice by paying $1 to the Stagecoach!',
      'Final Rolling Round: As soon as ANY player locks in all 5 of their dice, every other unfinished player gets 1 final roll and automatically locks all remaining dice!',
      'Ties at any town location are broken by the current Sheriff!',
    ],
    referenceTables: [
      {
        title: 'Town Locations & Resolution Order',
        headers: ['Location', 'How to Win It', 'Reward & End-Game VP'],
        rows: [
          ['1. Gold Mine', 'Most 9s rolled', '1 Nugget per 9 rolled (1 VP / Nugget)'],
          ['2. Bank', 'Most 10s rolled', 'Take all Stagecoach $ bills ($2 = 1 VP)'],
          ['3. General Store', 'Most Jacks rolled', 'Draw cards = Jacks, keep 1'],
          ['4. Saloon', 'Most Queens rolled', 'Steal 1 Deed OR Card (draw = Queens, keep 1)'],
          ['5. Sheriff Office', 'Most Kings rolled', 'Claim Sheriff Star (5 VP + breaks all ties!)'],
          ['6. Town Hall', 'Best 5-Dice Poker Hand', '1st (bottom) Deed + extra for 4K / Full House / 5A'],
          ['7. Doc Badluck', 'Won NOTHING this round', 'Pick 1 of 2 Face-Up Elixirs OR draw 1 blind!'],
        ],
      },
    ],
    turnFlowSteps: [
      {
        title: '1. Simultaneous / Sequential Dice Cup Rolling',
        detail:
          'Roll your remaining Poker Dice and choose which dice to lock under your cup: 1 die = $0, N dice = $(N−1) to the Stagecoach, or 0 dice = $1 to the Stagecoach.',
      },
      {
        title: '2. Town Resolution (Locations 1 → 6)',
        detail:
          'Compare locked 5-dice cups across Gold Mine (9s), Bank (10s), General Store (Js), Saloon (Qs—choose whether to steal a Property Deed or General Store card!), Sheriff (Ks), and Town Hall (Poker Hand; highlighted bottom of the 3 face-up Deeds is awarded first!).',
      },
      {
        title: '3. Doc Badluck’s Office (Consolation)',
        detail:
          'Every player who gained nothing in Steps 1–6 visits Doc Badluck and chooses between the 2 face-up Elixir cards or drawing 1 card blind from the deck.',
      },
    ],
    scoringAndEndGame: {
      endTrigger:
        'Triggered at the end of the round in which either the last Gold Nugget OR the last Property Deed is claimed.',
      scoringRules: [
        '1 VP per Gold Nugget.',
        '1 VP per $2 in Cash (rounded down).',
        'Printed VP (1–5 VP) on all owned Property Deeds.',
        '5 VP for holding the Sheriff Star at game end.',
        'Printed VP on General Store / Doc Badluck bonus cards.',
      ],
      tieBreaker: 'Current Sheriff breaks any final VP tie!',
    },
    variantsAndExpansions: [
      {
        id: 'always_active',
        title: 'Active Dice Town House & Deluxe Rules',
        summary: 'Stagecoach $1 zero-keep, Final Round Bell, Saloon choice, 3 Deeds, and 2 Doc Badluck face-ups.',
        details: [
          'Zero-Die Re-roll: Pay $1 to the Stagecoach to keep 0 dice and re-roll your cup.',
          'Final Rolling Round: First player to lock 5 dice rings the bell—everyone else gets 1 last roll.',
          'Saloon Versatility: Winner chooses between stealing Property Deeds or General Store cards.',
          'Open Displays: 3 face-up Property Deeds (bottom highlighted as next drawn) & 2 face-up Doc Badluck cards.',
        ],
      },
    ],
  },

  // ===========================================================================
  // 9. TEXAS HOLD'EM
  // ===========================================================================
  holdem: {
    gameId: 'holdem',
    tagline: 'No-Limit Texas Hold’em Poker with blinds, community streets, and side-pot showdowns.',
    objective:
      'Win chips by making the strongest 5-card poker hand from your 2 private hole cards + 5 community cards, or by getting all opponents to fold.',
    quickSummaryBullets: [
      'Dealer Button rotates clockwise each hand; Small Blind and Big Blind post forced bets to seed the pot.',
      '4 Betting Streets: Pre-Flop (2 hole cards) → Flop (3 community cards) → Turn (4th card) → River (5th card).',
      'No-Limit Betting: Raise at least the size of the previous bet/raise, or push All-In at any time (side pots are computed automatically).',
    ],
    referenceTables: [
      {
        title: '5-Card Poker Hand Rankings (Highest → Lowest)',
        headers: ['Rank', 'Hand', 'Example'],
        rows: [
          ['1', 'Royal / Straight Flush', 'A♠ K♠ Q♠ J♠ 10♠'],
          ['2', 'Four of a Kind', '9♣ 9♦ 9♥ 9♠ K♦'],
          ['3', 'Full House', 'Q♠ Q♥ Q♦ 7♣ 7♠'],
          ['4', 'Flush', 'Any 5 cards of the same suit'],
          ['5', 'Straight', '5 sequential ranks (A can be high or 5-high)'],
          ['6–9', 'Three of a Kind > Two Pair > One Pair > High Card', 'Standard kickers break ties'],
        ],
      },
    ],
    turnFlowSteps: [
      {
        title: '1. Blinds & Pre-Flop',
        detail:
          'Each player receives 2 private Hole Cards. Action starts left of the Big Blind: Fold, Call, or Raise.',
      },
      {
        title: '2. Flop, Turn & River',
        detail:
          'Post-flop betting begins with the first active player left of the Dealer Button: Check, Bet, Call, Raise, or Fold.',
      },
      {
        title: '3. Showdown & Next Hand',
        detail:
          'Remaining contenders reveal Hole Cards; the engine evaluates the best 5-of-7 hand for each eligible pot.',
      },
    ],
    scoringAndEndGame: {
      endTrigger: 'Match concludes when one player captures all chips at the table.',
      scoringRules: [
        'Each main pot and side pot goes to the best 5-card hand among players who contributed to that pot.',
      ],
      tieBreaker: 'Exact 5-card hand ties split the pot evenly.',
    },
    variantsAndExpansions: [],
  },

  // ===========================================================================
  // 10. EUCHRE
  // ===========================================================================
  euchre: {
    gameId: 'euchre',
    tagline: 'Classic 4-player partnership trick-taking with Right & Left Bowers and Going Alone.',
    objective:
      'Work with your partner across the table (Seat 1 & 3 vs. Seat 2 & 4) to be the first team to score 10 Points.',
    quickSummaryBullets: [
      'Uses a 24-card deck (9, 10, J, Q, K, Ace in all 4 suits); 5 cards dealt to each player + 1 kitty Upcard.',
      'BOWER RULE: The highest card in the game is the Jack of Trump (Right Bower). The 2nd highest card is the OTHER Jack of the SAME COLOR (Left Bower—e.g. J♠ when ♣ is Trump!), and it legally counts as a TRUMP card when following suit!',
      'Going Alone: The Maker may play the hand solo (partner sits out) to go for +4 points on a 5-trick sweep!',
    ],
    referenceTables: [
      {
        title: 'Trump Rank & Hand Scoring',
        headers: ['Category', 'Details'],
        rows: [
          ['Trump Suit Order', 'Right Bower (J of Trump) > Left Bower (Same-Color J) > A > K > Q > 10 > 9'],
          ['Off-Suit Order', 'A > K > Q > J > 10 > 9'],
          ['Makers win 3 or 4 Tricks', '+1 Point to Makers'],
          ['Makers sweep all 5 Tricks (March)', '+2 Points (+4 Points if Going Alone!)'],
          ['Euchred (Makers win < 3 Tricks)', '+2 Points to Defenders!'],
        ],
      },
    ],
    turnFlowSteps: [
      {
        title: '1. Trump Bidding (Round 1 & Round 2)',
        detail:
          'Round 1: Players clockwise may "Order Up" the Upcard suit to the Dealer (Dealer picks up Upcard and discards 1 card) or Pass. Round 2: If all pass, Upcard is turned down and players may call ANY OTHER suit as Trump.',
      },
      {
        title: '2. Trick-Taking (5 Tricks)',
        detail:
          'Player left of Dealer leads Trick 1. You MUST follow the led suit if able (remembering Left Bower belongs to the Trump suit, not its printed suit!). Highest Trump wins, or highest card of the led suit if no Trump was played.',
      },
    ],
    scoringAndEndGame: {
      endTrigger: 'First partnership to reach 10 or more points at the end of a hand wins!',
      scoringRules: [
        '+1 pt for 3–4 tricks by Makers • +2 pts for all 5 tricks • +4 pts for Alone sweep • +2 pts to Defenders on a Euchre.',
      ],
      tieBreaker: 'Only one team scores points on any given hand.',
    },
    variantsAndExpansions: [],
  },

  // ===========================================================================
  // 11. CRIBBAGE
  // ===========================================================================
  cribbage: {
    gameId: 'cribbage',
    tagline: 'Pegging to 31, counting 15s, pairs, and runs, and racing around the 121-point board.',
    objective:
      'Be the first player to peg 121 points through live Pegging play and Counting hands + the Dealer’s Crib.',
    quickSummaryBullets: [
      'Card Counting Values: Ace = 1, 2–9 = face value, 10 / Jack / Queen / King = 10.',
      'Points peg in strict real-time order: you win the instant your peg hits 121 (even mid-pegging or before the Dealer gets to count!).',
      'Counting Order in The Show: Non-Dealer(s) count FIRST → Dealer’s Hand → Dealer’s Crib last!',
    ],
    referenceTables: [
      {
        title: 'Cribbage Scoring Combinations',
        headers: ['Combination', 'Points', 'Notes'],
        rows: [
          ['Fifteen (Sum = 15)', '2 pts', 'Both in Pegging (exact 15) and Hand/Crib combos'],
          ['Thirty-One (Pegging)', '2 pts', 'Hitting exact 31 during Pegging resets count to 0'],
          ['Go / Last Card', '1 pt', 'Last legal card played before 31 when rivals say Go'],
          ['Pair / 3-Kind / 4-Kind', '2 / 6 / 12 pts', 'Consecutive matching ranks in Pegging or Hand'],
          ['Run of 3+ Cards', '1 pt / card', 'e.g. 4–5–6 = 3 pts (need not be played in sorted order)'],
          ['Flush (Hand / Crib)', '4 or 5 pts', 'Crib Flush requires all 4 crib cards + Starter to match'],
          ['His Heels / His Nobs', '2 pts / 1 pt', 'Jack cut as Starter (+2 Dealer) / Jack matching Starter suit (+1)'],
        ],
      },
    ],
    turnFlowSteps: [
      {
        title: '1. Deal, Discard to Crib & Cut Starter',
        detail:
          'Players discard cards face-down to form the 4-card Crib belonging to the Dealer, then cut the Starter card (if it is a Jack, Dealer immediately pegs +2 for "His Heels").',
      },
      {
        title: '2. The Play (Pegging to 31)',
        detail:
          'Alternate playing 1 card at a time without exceeding a running total of 31, scoring 15s, 31s, Pairs, Runs, and "Go" (+1) along the way.',
      },
      {
        title: '3. The Show (Hand & Crib Counting)',
        detail:
          'Non-Dealer scores their 4 cards + Starter first, followed by Dealer’s 4 cards + Starter, and finally Dealer’s 4 Crib cards + Starter.',
      },
    ],
    scoringAndEndGame: {
      endTrigger: 'Instantaneous victory the moment any player reaches 121 points!',
      scoringRules: [
        'Skunk if opponent finishes under 91 points (classic bragging rights!).',
      ],
      tieBreaker: 'No ties—points are awarded strictly one event/player at a time.',
    },
    variantsAndExpansions: [],
  },

  // ===========================================================================
  // 12. KINGS CORNERS (4-CARD GOLF / KNOCK QUARTERS)
  // ===========================================================================
  kings_corners: {
    gameId: 'kings_corners',
    tagline: 'Memorize your 4 hidden cards, swap in 0-point Kings, and Knock to stick rivals with Quarters!',
    objective:
      'Keep your 4-card hidden grid as close to 0 points as possible each hand so you don’t lose your 4 starting Quarters!',
    quickSummaryBullets: [
      'Every player starts with 4 Quarters and is dealt 4 face-down cards in a 2×2 grid.',
      'Initial Peek: At the start of each hand, you privately peek at 2 of your 4 face-down cards—remember where they are!',
      'KINGS ARE ZERO POINTS (best card in the deck!), Aces = 1 pt, 2–9 = face value, and 10 / J / Q = 10 pts.',
      'Knocking on the table skips drawing and gives every other player exactly 1 final turn before all cards flip face-up!',
    ],
    referenceTables: [
      {
        title: 'Card Point Values (Lower Is Better!)',
        headers: ['Card Rank', 'Point Value'],
        rows: [
          ['King (K)', '0 Points (Best!)'],
          ['Ace (A)', '1 Point'],
          ['2 through 9', 'Face Value (2–9 pts)'],
          ['10, Jack (J), Queen (Q)', '10 Points (Worst!)'],
        ],
      },
    ],
    turnFlowSteps: [
      {
        title: '1. Initial 2-Card Peek',
        detail:
          'Click any 2 of your 4 face-down slots to memorize their values before play begins. Cards stay hidden during the round!',
      },
      {
        title: '2. Draw & Swap — OR Knock!',
        detail:
          'On your turn, either: (A) Take the top face-up Discard and swap it into 1 of your 4 slots, (B) Draw blind from the Deck to swap into a slot or discard it, OR (C) Knock to trigger the final circle of turns!',
      },
      {
        title: '3. Showdown & Quarter Penalty',
        detail:
          'All hands flip face-up! The player(s) with the HIGHEST point total lose 1 Quarter (note: if a player on their very last Quarter ties for highest score, the hand pushes so no one loses a Quarter on that tie!).',
      },
    ],
    scoringAndEndGame: {
      endTrigger: 'Players who lose all 4 Quarters are eliminated; last surviving player wins!',
      scoringRules: [
        'Lowest 4-card sum avoids losing Quarters; 4 Kings = 0 total points!',
      ],
      tieBreaker: 'Last player remaining with 1+ Quarters.',
    },
    variantsAndExpansions: [],
  },
};
