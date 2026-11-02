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

export const InteractiveMap: React.FC<InteractiveMapProps> = ({
  routes,
  playerOrder,
  selectedRouteId,
  highlightedCities,
  onSelectRoute,
}) => {
  const [hoveredRouteId, setHoveredRouteId] = useState<string | null>(null);

  // Compute parallel offset geometry for all routes
  const geometries = useMemo<ComputedRouteGeometry[]>(() => {
    // Identify city pairs that have 2 parallel routes
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

      // Normalize canonical vector so parallel offset is consistent regardless of from/to order
      const canonicalFrom =
        route.from < route.to ? fromCoord : toCoord;
      const canonicalTo =
        route.from < route.to ? toCoord : fromCoord;

      const dx = canonicalTo.x - canonicalFrom.x;
      const dy = canonicalTo.y - canonicalFrom.y;
      const len = Math.hypot(dx, dy) || 1;

      // Unit normal perpendicular vector
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

  return (
    <div className="relative w-full h-full flex items-center justify-center bg-slate-950 overflow-hidden select-none">
      {/* Subtle blueprint grid background */}
      <svg
        viewBox="0 0 1000 600"
        className="w-full h-full max-h-full object-contain"
      >
        <defs>
          <pattern
            id="minorGrid"
            width="25"
            height="25"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M 25 0 L 0 0 0 25"
              fill="none"
              stroke="rgba(148, 163, 184, 0.05)"
              strokeWidth="1"
            />
          </pattern>
          <pattern
            id="majorGrid"
            width="100"
            height="100"
            patternUnits="userSpaceOnUse"
          >
            <rect width="100" height="100" fill="url(#minorGrid)" />
            <path
              d="M 100 0 L 0 0 0 100"
              fill="none"
              stroke="rgba(148, 163, 184, 0.1)"
              strokeWidth="1"
            />
          </pattern>
          <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3.5" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* Map Canvas Background */}
        <rect
          x="10"
          y="10"
          width="980"
          height="580"
          rx="16"
          fill="#0b1120"
          stroke="#1e293b"
          strokeWidth="2"
        />
        <rect
          x="10"
          y="10"
          width="980"
          height="580"
          rx="16"
          fill="url(#majorGrid)"
        />

        {/* Compass / Map Watermark */}
        <text
          x="32"
          y="568"
          fill="#334155"
          fontSize="11"
          fontWeight="600"
          letterSpacing="0.12em"
        >
          NORTH AMERICA RAIL NETWORK • CLICK ANY UNCLAIMED ROUTE TO CLAIM
        </text>

        {/* 1. Render Routes (Edges) */}
        <g>
          {geometries.map((geo) => {
            const { route, x1, y1, x2, y2, midX, midY } = geo;
            const theme = ROUTE_COLOR_THEMES[route.color];
            const isClaimed = route.ownerId !== null;
            const isSelected = route.id === selectedRouteId;
            const isHovered = route.id === hoveredRouteId;
            const ownerPalette = isClaimed
              ? getPlayerPalette(route.ownerId!, playerOrder)
              : null;

            // Shorten endpoints slightly so routes don't overlap city center circles
            const dx = x2 - x1;
            const dy = y2 - y1;
            const dist = Math.hypot(dx, dy) || 1;
            const trim = 12;
            const sx1 = x1 + (dx / dist) * trim;
            const sy1 = y1 + (dy / dist) * trim;
            const sx2 = x2 - (dx / dist) * trim;
            const sy2 = y2 - (dy / dist) * trim;

            // Compute individual car segments along the route for clear visual length
            const segments = Array.from({ length: route.length }, (_, idx) => {
              const tStart = idx / route.length;
              const tEnd = (idx + 1) / route.length;
              // Add small gap between cars
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
                    strokeWidth="13"
                    strokeOpacity={isSelected ? 0.65 : 0.35}
                    strokeLinecap="round"
                  />
                )}

                {/* Underlying rail bed */}
                <line
                  x1={sx1}
                  y1={sy1}
                  x2={sx2}
                  y2={sy2}
                  stroke="#0f172a"
                  strokeWidth="9"
                  strokeLinecap="round"
                />

                {/* Individual Train Car Slots / Claimed Cars */}
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
                      strokeWidth={isClaimed ? '8.5' : '7'}
                      strokeLinecap="butt"
                    />
                    {/* Inner fill of car slot */}
                    <line
                      x1={seg.x1}
                      y1={seg.y1}
                      x2={seg.x2}
                      y2={seg.y2}
                      stroke={isClaimed ? ownerPalette!.fillHex : theme.hex}
                      strokeWidth={isClaimed ? '6' : '5'}
                      strokeOpacity={isClaimed ? 1 : 0.85}
                      strokeLinecap="butt"
                    />
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
                      ? route.ownerId!.slice(0, 2).toUpperCase()
                      : route.length}
                  </text>
                </g>
              </g>
            );
          })}
        </g>

        {/* 2. Render Cities (Nodes) */}
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
                    r="15"
                    fill="none"
                    stroke="#34d399"
                    strokeWidth="2.5"
                    strokeDasharray="3 2"
                  />
                )}
                {/* Outer Ring */}
                <circle
                  r={isHighlighted ? 8.5 : 6.5}
                  fill={isHighlighted ? '#10b981' : '#f8fafc'}
                  stroke="#020617"
                  strokeWidth="2.5"
                />
                {/* Inner Hub */}
                <circle
                  r="2.8"
                  fill={isHighlighted ? '#022c22' : '#0f172a'}
                />

                {/* City Name Pill */}
                <g transform={`translate(${dx}, ${dy})`}>
                  <text
                    textAnchor="middle"
                    dominantBaseline="central"
                    stroke="#020617"
                    strokeWidth="4"
                    strokeLinejoin="round"
                    fill="#020617"
                    fontSize="10.5"
                    fontWeight="700"
                  >
                    {cityName}
                  </text>
                  <text
                    textAnchor="middle"
                    dominantBaseline="central"
                    fill={isHighlighted ? '#6ee7b7' : '#f1f5f9'}
                    fontSize="10.5"
                    fontWeight="700"
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
                  Claimed by {hoveredGeometry.route.ownerId}
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

