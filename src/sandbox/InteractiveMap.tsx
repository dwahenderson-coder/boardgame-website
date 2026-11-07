import React, { useMemo, useState } from 'react';
import { RouteEdge } from '../games/ticket-to-ride/types.js';
import {
  CITY_COORDINATES,
  getPlayerPalette,
  ROUTE_COLOR_THEMES,
} from './mapData.js';

interface InteractiveMapProps {
  readonly routes: readonly RouteEdge[];
  readonly playerOrder: readonly string[];
  readonly playerScores?: Readonly<Record<string, number>>;
  readonly playerNames?: Readonly<Record<string, string>>;
  readonly playerColors?: Readonly<Record<string, string>>;
  readonly selectedRouteId: string | null;
  readonly highlightedCities: ReadonlySet<string>;
  readonly onSelectRoute: (route: RouteEdge) => void;
}

interface ComputedRouteGeometry {
  readonly route: RouteEdge;
  readonly x1: number;
  readonly y1: number;
  readonly x2: number;
  readonly y2: number;
  readonly midX: number;
  readonly midY: number;
  readonly angleDeg: number;
  readonly lengthPx: number;
  readonly isDoubleSibling: boolean;
}

interface ScoreTrackSpace {
  readonly score: number;
  readonly x: number;
  readonly y: number;
  readonly isMajorMilestone: boolean;
  readonly isMinorMilestone: boolean;
}

/**
 * Generates 100 clockwise perimeter spaces (0..99) around the outer frame
 * of the 1000x600 map board:
 * - Top edge (left -> right): 0..30 (31 spaces)
 * - Right edge (top -> bottom): 31..49 (19 spaces)
 * - Bottom edge (right -> left): 50..80 (31 spaces)
 * - Left edge (bottom -> top): 81..99 (19 spaces)
 */
const PERIMETER_SCORE_SPACES: readonly ScoreTrackSpace[] = (() => {
  const spaces: ScoreTrackSpace[] = [];
  const leftX = -22;
  const rightX = 1022;
  const topY = -22;
  const bottomY = 622;

  for (let s = 0; s < 100; s++) {
    let x = 0;
    let y = 0;

    if (s <= 30) {
      // Top edge: 0..30 (31 spaces from leftX to rightX)
      const t = s / 30;
      x = leftX + (rightX - leftX) * t;
      y = topY;
    } else if (s <= 49) {
      // Right edge: 31..49 (19 spaces between topY and bottomY)
      const t = (s - 30) / 20;
      x = rightX;
      y = topY + (bottomY - topY) * t;
    } else if (s <= 80) {
      // Bottom edge: 50..80 (31 spaces from rightX to leftX)
      const t = (s - 50) / 30;
      x = rightX - (rightX - leftX) * t;
      y = bottomY;
    } else {
      // Left edge: 81..99 (19 spaces between bottomY and topY)
      const t = (s - 80) / 20;
      x = leftX;
      y = bottomY - (bottomY - topY) * t;
    }

    spaces.push({
      score: s,
      x,
      y,
      isMajorMilestone: s % 10 === 0,
      isMinorMilestone: s % 5 === 0 && s % 10 !== 0,
    });
  }

  return spaces;
})();

export const InteractiveMap: React.FC<InteractiveMapProps> = ({
  routes,
  playerOrder,
  playerScores = {},
  playerNames = {},
  playerColors = {},
  selectedRouteId,
  highlightedCities,
  onSelectRoute,
}) => {
  const [hoveredRouteId, setHoveredRouteId] = useState<string | null>(null);

  // Compute parallel offset geometry for all routes
  const geometries = useMemo<ComputedRouteGeometry[]>(() => {
    const pairCounts = new Map<string, number>();
    for (const r of routes) {
      const key = [r.from, r.to].sort().join('::');
      pairCounts.set(key, (pairCounts.get(key) ?? 0) + 1);
    }

    return routes.map((route) => {
      const fromCoord = CITY_COORDINATES[route.from] ?? { x: 500, y: 300 };
      const toCoord = CITY_COORDINATES[route.to] ?? { x: 500, y: 300 };

      const key = [route.from, route.to].sort().join('::');
      const isDoubleSibling = (pairCounts.get(key) ?? 1) > 1;

      const canonicalFrom = route.from < route.to ? fromCoord : toCoord;
      const canonicalTo = route.from < route.to ? toCoord : fromCoord;

      const dx = canonicalTo.x - canonicalFrom.x;
      const dy = canonicalTo.y - canonicalFrom.y;
      const len = Math.hypot(dx, dy) || 1;

      const nx = -dy / len;
      const ny = dx / len;

      const offsetMagnitude = isDoubleSibling ? 7.5 : 0;
      const sign = route.routeIndex === 0 ? -1 : 1;
      const ox = nx * offsetMagnitude * sign;
      const oy = ny * offsetMagnitude * sign;

      const x1 = fromCoord.x + ox;
      const y1 = fromCoord.y + oy;
      const x2 = toCoord.x + ox;
      const y2 = toCoord.y + oy;

      const midX = (x1 + x2) / 2;
      const midY = (y1 + y2) / 2;
      const angleDeg = (Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI;

      return {
        route,
        x1,
        y1,
        x2,
        y2,
        midX,
        midY,
        angleDeg,
        lengthPx: len,
        isDoubleSibling,
      };
    });
  }, [routes]);

  const hoveredGeometry = useMemo(
    () => geometries.find((g) => g.route.id === hoveredRouteId) ?? null,
    [geometries, hoveredRouteId]
  );

  // Group players by their current track space (score % 100) so shared spaces fan out cleanly
  const playersBySpace = useMemo(() => {
    const grouped = new Map<
      number,
      Array<{ playerId: string; rawScore: number; lap: number }>
    >();
    for (const pid of playerOrder) {
      const rawScore = Math.max(0, playerScores[pid] ?? 0);
      const spaceIdx = ((rawScore % 100) + 100) % 100;
      const lap = Math.floor(rawScore / 100);
      const list = grouped.get(spaceIdx) ?? [];
      list.push({ playerId: pid, rawScore, lap });
      grouped.set(spaceIdx, list);
    }
    return grouped;
  }, [playerOrder, playerScores]);

  return (
    <div className="relative w-full h-full flex items-center justify-center bg-slate-950 overflow-hidden select-none">
      <svg
        viewBox="-42 -42 1084 684"
        className="w-full h-full max-h-full object-contain"
      >
        <defs>
          {/* Ocean water gradient */}
          <radialGradient id="oceanGradient" cx="50%" cy="50%" r="70%">
            <stop offset="0%" stopColor="#0f2942" />
            <stop offset="65%" stopColor="#09192b" />
            <stop offset="100%" stopColor="#050e1a" />
          </radialGradient>

          {/* Continent parchment-topographic gradient */}
          <linearGradient id="continentLand" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#2b3628" />
            <stop offset="35%" stopColor="#353224" />
            <stop offset="70%" stopColor="#293529" />
            <stop offset="100%" stopColor="#1f2922" />
          </linearGradient>

          {/* Subtle cartographic lat/long grid */}
          <pattern
            id="atlasGrid"
            width="80"
            height="80"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M 80 0 L 0 0 0 80"
              fill="none"
              stroke="rgba(226, 232, 240, 0.05)"
              strokeWidth="1"
              strokeDasharray="3 3"
            />
          </pattern>

          <filter id="landShadow" x="-5%" y="-5%" width="110%" height="110%">
            <feDropShadow
              dx="0"
              dy="3"
              stdDeviation="6"
              floodColor="#020617"
              floodOpacity="0.85"
            />
          </filter>
        </defs>

        {/* =================================================================
            0. OUTER WOODEN / BRASS SCORE TRACK FRAME (-38..-6 around board)
           ================================================================= */}
        <rect
          x="-38"
          y="-38"
          width="1076"
          height="676"
          rx="22"
          fill="#1c140d"
          stroke="#b45309"
          strokeWidth="3"
        />
        <rect
          x="-33"
          y="-33"
          width="1066"
          height="666"
          rx="18"
          fill="none"
          stroke="#78350f"
          strokeWidth="1.5"
          strokeDasharray="6 4"
        />

        {/* =================================================================
            1. INNER MAP CANVAS & NORTH AMERICA GEOGRAPHY (0..1000 x 0..600)
           ================================================================= */}
        <rect
          x="4"
          y="4"
          width="992"
          height="592"
          rx="14"
          fill="url(#oceanGradient)"
          stroke="#d97706"
          strokeWidth="2.5"
        />

        {/* North America Landmass Silhouette & Geography */}
        <g className="pointer-events-none">
          {/* Outer coastal shallow water glow */}
          <path
            d="M 55,15 L 495,15 L 525,52 L 595,62 L 645,25 L 955,25 L 985,85 L 965,150 L 940,175 L 905,235 L 875,310 L 855,390 L 865,455 L 868,568 L 832,575 L 800,505 L 725,510 L 665,555 L 555,565 L 495,588 L 350,545 L 225,500 L 125,480 L 68,375 L 82,205 L 102,135 L 88,65 Z"
            fill="none"
            stroke="#38bdf8"
            strokeOpacity="0.14"
            strokeWidth="14"
            strokeLinejoin="round"
          />

          {/* Main North America Continent Polygon */}
          <path
            d="M 55,15 L 495,15 L 525,52 L 595,62 L 645,25 L 955,25 L 985,85 L 965,150 L 940,175 L 905,235 L 875,310 L 855,390 L 865,455 L 868,568 L 832,575 L 800,505 L 725,510 L 665,555 L 555,565 L 495,588 L 350,545 L 225,500 L 125,480 L 68,375 L 82,205 L 102,135 L 88,65 Z"
            fill="url(#continentLand)"
            stroke="#a16207"
            strokeWidth="2"
            strokeLinejoin="round"
            filter="url(#landShadow)"
          />

          {/* US / Canada / Regional Border Graticules */}
          <path
            d="M 115,112 Q 310,120 555,125"
            fill="none"
            stroke="#fde68a"
            strokeOpacity="0.16"
            strokeWidth="1.5"
            strokeDasharray="6 5"
          />
          <path
            d="M 135,478 Q 255,492 365,522 Q 465,555 545,562"
            fill="none"
            stroke="#fde68a"
            strokeOpacity="0.16"
            strokeWidth="1.5"
            strokeDasharray="6 5"
          />

          {/* Western Rocky Mountains Topographic Shading */}
          <path
            d="M 175,55 L 200,32 L 225,62 L 250,40 L 280,85 M 245,130 L 270,105 L 295,140 L 320,115 L 345,155 M 290,225 L 320,195 L 345,230 L 370,205 L 395,245 M 325,315 L 350,285 L 375,320"
            fill="none"
            stroke="#ca8a04"
            strokeOpacity="0.22"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Eastern Appalachian Mountains Topographic Shading */}
          <path
            d="M 755,345 L 775,322 L 792,345 L 812,320 L 828,340 M 790,285 L 810,262 L 828,285 L 845,260"
            fill="none"
            stroke="#ca8a04"
            strokeOpacity="0.2"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Great Lakes Hydrology (Superior, Michigan, Huron, Erie, Ontario) */}
          <g fill="#0c263d" stroke="#38bdf8" strokeOpacity="0.35" strokeWidth="1.2">
            {/* Lake Superior */}
            <path d="M 575,145 Q 618,122 668,142 Q 645,165 585,162 Z" />
            {/* Lake Michigan */}
            <path d="M 658,168 Q 675,198 668,236 Q 648,232 648,175 Z" />
            {/* Lake Huron */}
            <path d="M 685,152 Q 725,158 722,198 Q 695,195 685,165 Z" />
            {/* Lake Erie */}
            <path d="M 718,218 Q 758,208 776,222 Q 748,235 718,228 Z" />
            {/* Lake Ontario */}
            <path d="M 776,184 Q 815,175 828,188 Q 798,198 776,192 Z" />
          </g>

          {/* Major River Networks (Mississippi / Missouri / Ohio) */}
          <path
            d="M 585,190 Q 615,265 625,335 Q 630,435 655,535 M 410,210 Q 515,265 625,335 M 765,270 Q 695,315 625,335"
            fill="none"
            stroke="#38bdf8"
            strokeOpacity="0.18"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </g>

        {/* Cartographic Grid Overlay */}
        <rect
          x="4"
          y="4"
          width="992"
          height="592"
          rx="14"
          fill="url(#atlasGrid)"
          className="pointer-events-none"
        />

        {/* Decorative Vintage Brass Compass Rose (Bottom-Left Pacific Ocean) */}
        <g
          transform="translate(56, 535)"
          className="pointer-events-none"
          opacity="0.75"
        >
          <circle
            r="26"
            fill="#09192b"
            stroke="#d97706"
            strokeWidth="1.5"
          />
          <circle
            r="21"
            fill="none"
            stroke="#fbbf24"
            strokeWidth="0.8"
            strokeDasharray="2 2"
          />
          <polygon points="0,-22 4,-4 0,-8 -4,-4" fill="#fbbf24" />
          <polygon points="0,22 4,4 0,8 -4,4" fill="#94a3b8" />
          <polygon points="-22,0 -4,-4 -8,0 -4,4" fill="#94a3b8" />
          <polygon points="22,0 4,-4 8,0 4,4" fill="#94a3b8" />
          <text
            y="-25"
            textAnchor="middle"
            fill="#fbbf24"
            fontSize="7"
            fontWeight="800"
          >
            N
          </text>
        </g>

        {/* =================================================================
            2. RENDER PERIMETER 0–99 SCORE TRACK SPACES & PLAYER TOKENS
           ================================================================= */}
        <g className="score-track">
          {PERIMETER_SCORE_SPACES.map((sp) => {
            const occupants = playersBySpace.get(sp.score) ?? [];
            const hasPlayers = occupants.length > 0;
            return (
              <g key={sp.score} transform={`translate(${sp.x}, ${sp.y})`}>
                {/* Score Space Circle */}
                <circle
                  r={sp.isMajorMilestone ? 11 : sp.isMinorMilestone ? 9.5 : 8}
                  fill={
                    sp.isMajorMilestone
                      ? '#78350f'
                      : sp.isMinorMilestone
                      ? '#451a03'
                      : '#1e293b'
                  }
                  stroke={
                    sp.isMajorMilestone
                      ? '#fbbf24'
                      : sp.isMinorMilestone
                      ? '#d97706'
                      : '#475569'
                  }
                  strokeWidth={sp.isMajorMilestone ? 1.8 : 1}
                />
                {/* Score Number */}
                {!hasPlayers && (
                  <text
                    textAnchor="middle"
                    dominantBaseline="central"
                    fill={
                      sp.isMajorMilestone
                        ? '#fef08a'
                        : sp.isMinorMilestone
                        ? '#fde68a'
                        : '#94a3b8'
                    }
                    fontSize={sp.isMajorMilestone ? '8.5' : '7'}
                    fontWeight={
                      sp.isMajorMilestone || sp.isMinorMilestone ? '800' : '600'
                    }
                  >
                    {sp.score}
                  </text>
                )}
              </g>
            );
          })}

          {/* Render Live Wooden Player Scoring Markers on Top of Track */}
          {Array.from(playersBySpace.entries()).map(([spaceIdx, occupants]) => {
            const sp = PERIMETER_SCORE_SPACES[spaceIdx];
            if (!sp) return null;

            return (
              <g key={`tokens-${spaceIdx}`} transform={`translate(${sp.x}, ${sp.y})`}>
                {occupants.map((occ, idx) => {
                  const palette = getPlayerPalette(
                    occ.playerId,
                    playerOrder,
                    playerColors
                  );
                  // Fan multiple tokens slightly if they share the same space
                  const count = occupants.length;
                  const angle =
                    count > 1 ? (idx / count) * Math.PI * 2 - Math.PI / 2 : 0;
                  const radius = count > 1 ? 5.5 : 0;
                  const tx = Math.cos(angle) * radius;
                  const ty = Math.sin(angle) * radius;
                  const label = (
                    playerNames[occ.playerId] ?? occ.playerId
                  )
                    .slice(0, 2)
                    .toUpperCase();

                  return (
                    <g key={occ.playerId} transform={`translate(${tx}, ${ty})`}>
                      <title>{`${
                        playerNames[occ.playerId] ?? occ.playerId
                      }: ${occ.rawScore} pts`}</title>
                      <circle
                        r="9.5"
                        fill={palette.fillHex}
                        stroke="#020617"
                        strokeWidth="2"
                      />
                      <circle
                        r="7.5"
                        fill="none"
                        stroke={palette.strokeHex}
                        strokeWidth="1"
                      />
                      <text
                        textAnchor="middle"
                        dominantBaseline="central"
                        fill="#020617"
                        fontSize="7"
                        fontWeight="900"
                      >
                        {label}
                      </text>
                      {occ.lap > 0 && (
                        <g transform="translate(7, -7)">
                          <circle r="5.5" fill="#fbbf24" stroke="#020617" strokeWidth="1" />
                          <text
                            textAnchor="middle"
                            dominantBaseline="central"
                            fill="#020617"
                            fontSize="5.5"
                            fontWeight="900"
                          >
                            +{occ.lap * 100}
                          </text>
                        </g>
                      )}
                    </g>
                  );
                })}
              </g>
            );
          })}
        </g>

        {/* =================================================================
            3. RENDER RAILROAD ROUTES (EDGES)
           ================================================================= */}
        <g>
          {geometries.map((geo) => {
            const { route, x1, y1, x2, y2, midX, midY } = geo;
            const theme = ROUTE_COLOR_THEMES[route.color];
            const isClaimed = route.ownerId !== null;
            const isSelected = route.id === selectedRouteId;
            const isHovered = route.id === hoveredRouteId;
            const ownerPalette = isClaimed
              ? getPlayerPalette(route.ownerId!, playerOrder, playerColors)
              : null;

            const dx = x2 - x1;
            const dy = y2 - y1;
            const dist = Math.hypot(dx, dy) || 1;
            const trim = 12;
            const sx1 = x1 + (dx / dist) * trim;
            const sy1 = y1 + (dy / dist) * trim;
            const sx2 = x2 - (dx / dist) * trim;
            const sy2 = y2 - (dy / dist) * trim;

            const segments = Array.from({ length: route.length }, (_, idx) => {
              const tStart = idx / route.length;
              const tEnd = (idx + 1) / route.length;
              const pad = 0.06 / route.length;
              const t1 = tStart + pad;
              const t2 = tEnd - pad;
              return {
                x1: sx1 + (sx2 - sx1) * t1,
                y1: sy1 + (sy2 - sy1) * t1,
                x2: sx1 + (sx2 - sx1) * t2,
                y2: sy1 + (sy2 - sy1) * t2,
              };
            });

            return (
              <g
                key={route.id}
                onClick={() => onSelectRoute(route)}
                onMouseEnter={() => setHoveredRouteId(route.id)}
                onMouseLeave={() =>
                  setHoveredRouteId((prev) => (prev === route.id ? null : prev))
                }
                className={
                  isClaimed ? 'cursor-not-allowed' : 'cursor-pointer group'
                }
              >
                {/* Invisible wider hit-target for easy clicking */}
                <line
                  x1={sx1}
                  y1={sy1}
                  x2={sx2}
                  y2={sy2}
                  stroke="transparent"
                  strokeWidth="16"
                  strokeLinecap="round"
                />

                {/* Selection / Hover Halo */}
                {(isSelected || isHovered) && (
                  <line
                    x1={sx1}
                    y1={sy1}
                    x2={sx2}
                    y2={sy2}
                    stroke={isSelected ? '#fbbf24' : '#38bdf8'}
                    strokeWidth="14"
                    strokeOpacity={isSelected ? 0.7 : 0.4}
                    strokeLinecap="round"
                  />
                )}

                {/* Underlying rail bed & wooden railroad ties */}
                <line
                  x1={sx1}
                  y1={sy1}
                  x2={sx2}
                  y2={sy2}
                  stroke="#090d16"
                  strokeWidth="10"
                  strokeLinecap="round"
                />
                <line
                  x1={sx1}
                  y1={sy1}
                  x2={sx2}
                  y2={sy2}
                  stroke="#475569"
                  strokeWidth="9.5"
                  strokeDasharray="2 4"
                  strokeOpacity="0.55"
                />

                {/* Individual Train Car Slots / Claimed Plastic Train Cars */}
                {segments.map((seg, idx) => (
                  <g key={idx}>
                    {/* Outer border of car slot */}
                    <line
                      x1={seg.x1}
                      y1={seg.y1}
                      x2={seg.x2}
                      y2={seg.y2}
                      stroke={
                        isClaimed ? ownerPalette!.strokeHex : theme.strokeHex
                      }
                      strokeWidth={isClaimed ? '9' : '7.5'}
                      strokeLinecap="butt"
                    />
                    {/* Inner fill of car slot */}
                    <line
                      x1={seg.x1}
                      y1={seg.y1}
                      x2={seg.x2}
                      y2={seg.y2}
                      stroke={isClaimed ? ownerPalette!.fillHex : theme.hex}
                      strokeWidth={isClaimed ? '6.5' : '5.2'}
                      strokeOpacity={isClaimed ? 1 : 0.88}
                      strokeLinecap="butt"
                    />
                    {/* 3D roof highlight on claimed plastic train cars */}
                    {isClaimed && (
                      <line
                        x1={seg.x1}
                        y1={seg.y1}
                        x2={seg.x2}
                        y2={seg.y2}
                        stroke="#ffffff"
                        strokeWidth="1.5"
                        strokeOpacity="0.55"
                        strokeLinecap="round"
                      />
                    )}
                  </g>
                ))}

                {/* Route Length & Owner Badge at Midpoint */}
                <g transform={`translate(${midX}, ${midY})`}>
                  <circle
                    r={isClaimed ? 8.5 : 7}
                    fill={isClaimed ? ownerPalette!.fillHex : '#0f172a'}
                    stroke={
                      isSelected
                        ? '#fbbf24'
                        : isClaimed
                        ? ownerPalette!.strokeHex
                        : theme.strokeHex
                    }
                    strokeWidth={isSelected || isClaimed ? 2 : 1.2}
                  />
                  <text
                    textAnchor="middle"
                    dominantBaseline="central"
                    fill={isClaimed ? '#020617' : '#e2e8f0'}
                    fontSize="8.5"
                    fontWeight="800"
                  >
                    {isClaimed
                      ? (playerNames[route.ownerId!] ?? route.ownerId!)
                          .slice(0, 2)
                          .toUpperCase()
                      : route.length}
                  </text>
                </g>
              </g>
            );
          })}
        </g>

        {/* =================================================================
            4. RENDER CITIES (NODES)
           ================================================================= */}
        <g>
          {Object.entries(CITY_COORDINATES).map(([cityName, coord]) => {
            const isHighlighted = highlightedCities.has(cityName);
            const dx = coord.labelOffset?.dx ?? 0;
            const dy = coord.labelOffset?.dy ?? -14;

            return (
              <g
                key={cityName}
                transform={`translate(${coord.x}, ${coord.y})`}
                className="pointer-events-none"
              >
                {isHighlighted && (
                  <circle
                    r="16"
                    fill="rgba(16, 185, 129, 0.18)"
                    stroke="#34d399"
                    strokeWidth="2.5"
                    strokeDasharray="3 2"
                  />
                )}
                {/* Outer Brass/Station Ring */}
                <circle
                  r={isHighlighted ? 8.5 : 6.5}
                  fill={isHighlighted ? '#10b981' : '#fef3c7'}
                  stroke="#020617"
                  strokeWidth="2.5"
                />
                {/* Inner Station Hub */}
                <circle
                  r="2.8"
                  fill={isHighlighted ? '#022c22' : '#78350f'}
                />

                {/* City Name Label */}
                <g transform={`translate(${dx}, ${dy})`}>
                  <text
                    textAnchor="middle"
                    dominantBaseline="central"
                    stroke="#020617"
                    strokeWidth="4"
                    strokeLinejoin="round"
                    fill="#020617"
                    fontSize="10.5"
                    fontWeight="800"
                  >
                    {cityName}
                  </text>
                  <text
                    textAnchor="middle"
                    dominantBaseline="central"
                    fill={isHighlighted ? '#6ee7b7' : '#fef3c7'}
                    fontSize="10.5"
                    fontWeight="800"
                  >
                    {cityName}
                  </text>
                </g>
              </g>
            );
          })}
        </g>
      </svg>

      {/* Floating Route Hover Tooltip */}
      {hoveredGeometry && (
        <div className="pointer-events-none absolute top-3 left-3 bg-slate-900/95 border border-slate-700 rounded-lg px-3 py-2 shadow-xl backdrop-blur-sm text-xs flex items-center gap-2.5">
          <span
            className="w-3 h-3 rounded-sm border shrink-0"
            style={{
              backgroundColor:
                ROUTE_COLOR_THEMES[hoveredGeometry.route.color].hex,
              borderColor:
                ROUTE_COLOR_THEMES[hoveredGeometry.route.color].strokeHex,
            }}
          />
          <div>
            <div className="font-semibold text-slate-100">
              {hoveredGeometry.route.from} ↔ {hoveredGeometry.route.to}
              <span className="ml-1.5 text-slate-400 font-mono">
                ({hoveredGeometry.route.id})
              </span>
            </div>
            <div className="text-slate-400">
              Length:{' '}
              <span className="text-slate-200 font-semibold">
                {hoveredGeometry.route.length}
              </span>{' '}
              • Color:{' '}
              <span className="text-slate-200 font-semibold">
                {hoveredGeometry.route.color}
              </span>{' '}
              • Status:{' '}
              {hoveredGeometry.route.ownerId ? (
                <span className="text-amber-300 font-semibold">
                  Claimed by{' '}
                  {playerNames[hoveredGeometry.route.ownerId] ??
                    hoveredGeometry.route.ownerId}
                </span>
              ) : (
                <span className="text-emerald-400 font-semibold">
                  Unclaimed (Click to Claim)
                </span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
