import React from 'react';
import {
  ALL_POWER_GRID_RESOURCES,
  OwnedPowerPlant,
  PowerGridResource,
  PowerPlantCard,
  PowerPlantType,
} from '../games/power-grid/index.js';

interface PlantTheme {
  readonly label: string;
  readonly headerBg: string;
  readonly skyTop: string;
  readonly skyBottom: string;
  readonly border: string;
  readonly badgeBg: string;
  readonly badgeText: string;
  readonly fuelIcon: string;
}

const PLANT_THEMES: Readonly<Record<PowerPlantType, PlantTheme>> = {
  COAL: {
    label: 'Coal Plant',
    headerBg: '#451a03',
    skyTop: '#78350f',
    skyBottom: '#1c1917',
    border: '#b45309',
    badgeBg: '#92400e',
    badgeText: '#fef3c7',
    fuelIcon: '🪨',
  },
  OIL: {
    label: 'Oil Refinery',
    headerBg: '#0f172a',
    skyTop: '#334155',
    skyBottom: '#020617',
    border: '#64748b',
    badgeBg: '#1e293b',
    badgeText: '#e2e8f0',
    fuelIcon: '🛢️',
  },
  HYBRID: {
    label: 'Hybrid Coal/Oil',
    headerBg: '#431407',
    skyTop: '#9a3412',
    skyBottom: '#1e293b',
    border: '#f97316',
    badgeBg: '#7c2d12',
    badgeText: '#ffedd5',
    fuelIcon: '🪨/🛢️',
  },
  GARBAGE: {
    label: 'Waste Incinerator',
    headerBg: '#422006',
    skyTop: '#a16207',
    skyBottom: '#292524',
    border: '#eab308',
    badgeBg: '#854d0e',
    badgeText: '#fef9c3',
    fuelIcon: '♻️',
  },
  URANIUM: {
    label: 'Nuclear Reactor',
    headerBg: '#450a0a',
    skyTop: '#991b1b',
    skyBottom: '#18181b',
    border: '#ef4444',
    badgeBg: '#7f1d1d',
    badgeText: '#fee2e2',
    fuelIcon: '☢️',
  },
  ECOLOGICAL: {
    label: 'Wind / Eco Plant',
    headerBg: '#064e3b',
    skyTop: '#0284c7',
    skyBottom: '#065f46',
    border: '#34d399',
    badgeBg: '#047857',
    badgeText: '#d1fae5',
    fuelIcon: '🍃',
  },
  STEP_3: {
    label: 'Step 3 Surge',
    headerBg: '#312e81',
    skyTop: '#4f46e5',
    skyBottom: '#0f172a',
    border: '#818cf8',
    badgeBg: '#3730a3',
    badgeText: '#e0e7ff',
    fuelIcon: '⚡',
  },
};

const RESOURCE_CHIP: Readonly<
  Record<PowerGridResource, { readonly icon: string; readonly bg: string }>
> = {
  COAL: { icon: '🪨', bg: '#78350f' },
  OIL: { icon: '🛢️', bg: '#1e293b' },
  GARBAGE: { icon: '♻️', bg: '#854d0e' },
  URANIUM: { icon: '☢️', bg: '#991b1b' },
};

const PlantArtworkSvg: React.FC<{
  readonly type: PowerPlantType;
  readonly plantId: number;
}> = ({ type, plantId }) => {
  const theme = PLANT_THEMES[type];
  const gradId = `pg_sky_${type}_${plantId}`;

  return (
    <svg
      viewBox="0 0 180 92"
      style={{ width: '100%', height: 'auto', display: 'block', borderRadius: 8 }}
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={theme.skyTop} />
          <stop offset="100%" stopColor={theme.skyBottom} />
        </linearGradient>
      </defs>
      <rect x={0} y={0} width={180} height={92} fill={`url(#${gradId})`} />

      {/* Ground silhouette */}
      <rect x={0} y={76} width={180} height={16} fill="rgba(2,6,23,0.65)" />

      {type === 'COAL' && (
        <g>
          {/* Smoke clouds */}
          <circle cx={62} cy={18} r={9} fill="rgba(203,213,225,0.32)" />
          <circle cx={75} cy={13} r={11} fill="rgba(203,213,225,0.25)" />
          <circle cx={96} cy={16} r={10} fill="rgba(203,213,225,0.3)" />
          {/* Twin smokestacks */}
          <polygon points="50,76 54,24 64,24 68,76" fill="#44403c" stroke="#78716c" strokeWidth={1.2} />
          <polygon points="82,76 86,22 96,22 100,76" fill="#44403c" stroke="#78716c" strokeWidth={1.2} />
          {/* Brick boiler building */}
          <rect x={38} y={48} width={104} height={28} rx={3} fill="#7c2d12" stroke="#d97706" strokeWidth={1.3} />
          {/* Glowing furnace grates */}
          <rect x={48} y={58} width={16} height={12} rx={2} fill="#f97316" />
          <rect x={72} y={58} width={16} height={12} rx={2} fill="#fbbf24" />
          <rect x={96} y={58} width={16} height={12} rx={2} fill="#f97316" />
          {/* Coal heap */}
          <polygon points="118,76 135,54 156,76" fill="#1c1917" stroke="#57534e" strokeWidth={1} />
        </g>
      )}

      {type === 'OIL' && (
        <g>
          {/* Horizon sun */}
          <circle cx={142} cy={28} r={14} fill="rgba(251,191,36,0.28)" />
          {/* Refinery towers */}
          <rect x={36} y={24} width={14} height={52} rx={2} fill="#475569" stroke="#94a3b8" strokeWidth={1.2} />
          <rect x={56} y={32} width={18} height={44} rx={2} fill="#334155" stroke="#94a3b8" strokeWidth={1.2} />
          {/* Flare flame */}
          <path d="M 43,24 C 39,16 43,10 46,14 C 49,10 49,18 43,24 Z" fill="#fb923c" />
          {/* Cylindrical oil tanks */}
          <rect x={82} y={48} width={32} height={28} rx={4} fill="#1e293b" stroke="#cbd5e1" strokeWidth={1.2} />
          <line x1={82} y1={58} x2={114} y2={58} stroke="#64748b" strokeWidth={1.5} />
          {/* Pumpjack silhouette */}
          <polygon points="128,76 138,40 148,76" fill="none" stroke="#e2e8f0" strokeWidth={2} />
          <line x1={122} y1={44} x2={156} y2={34} stroke="#f8fafc" strokeWidth={3} strokeLinecap="round" />
          <line x1={155} y1={35} x2={155} y2={76} stroke="#94a3b8" strokeWidth={1.5} />
        </g>
      )}

      {type === 'HYBRID' && (
        <g>
          {/* Left Coal Stack + Right Oil Tank */}
          <polygon points="44,76 48,24 58,24 62,76" fill="#57534e" stroke="#fdba74" strokeWidth={1.2} />
          <rect x={36} y={50} width={48} height={26} rx={3} fill="#7c2d12" stroke="#fb923c" strokeWidth={1.2} />
          <rect x={96} y={42} width={38} height={34} rx={5} fill="#1e293b" stroke="#94a3b8" strokeWidth={1.2} />
          {/* Connecting turbine bridge */}
          <path d="M 84,60 L 96,60" stroke="#fde047" strokeWidth={3} />
          <circle cx={90} cy={60} r={7} fill="#f97316" stroke="#fef08a" strokeWidth={1.5} />
          <circle cx={60} cy={16} r={8} fill="rgba(226,232,240,0.28)" />
        </g>
      )}

      {type === 'GARBAGE' && (
        <g>
          {/* Waste-to-energy incinerator */}
          <polygon points="118,76 122,20 132,20 136,76" fill="#57534e" stroke="#fde047" strokeWidth={1.2} />
          <rect x={42} y={40} width={82} height={36} rx={4} fill="#713f12" stroke="#facc15" strokeWidth={1.5} />
          {/* Hazard stripes */}
          <line x1={46} y1={72} x2={120} y2={72} stroke="#facc15" strokeWidth={3} strokeDasharray="6 4" />
          {/* Yellow waste drums */}
          <rect x={52} y={50} width={14} height={18} rx={2} fill="#eab308" stroke="#422006" strokeWidth={1} />
          <rect x={70} y={50} width={14} height={18} rx={2} fill="#facc15" stroke="#422006" strokeWidth={1} />
          <circle cx={102} cy={56} r={9} fill="#fef08a" opacity={0.9} />
          <text x={102} y={60} textAnchor="middle" fontSize={11} fill="#422006" fontWeight={900}>
            ♻
          </text>
        </g>
      )}

      {type === 'URANIUM' && (
        <g>
          {/* Hyperbolic cooling tower */}
          <path
            d="M 52,76 Q 64,46 58,24 L 94,24 Q 88,46 100,76 Z"
            fill="#cbd5e1"
            stroke="#f87171"
            strokeWidth={1.5}
          />
          {/* Containment dome */}
          <path d="M 104,76 A 20,20 0 0 1 144,76 Z" fill="#475569" stroke="#fca5a5" strokeWidth={1.4} />
          {/* Glowing atomic rings */}
          <ellipse
            cx={124}
            cy={34}
            rx={16}
            ry={6}
            fill="none"
            stroke="#fde047"
            strokeWidth={1.4}
            transform="rotate(28 124 34)"
          />
          <ellipse
            cx={124}
            cy={34}
            rx={16}
            ry={6}
            fill="none"
            stroke="#f87171"
            strokeWidth={1.4}
            transform="rotate(-28 124 34)"
          />
          <circle cx={124} cy={34} r={3.5} fill="#fef08a" />
        </g>
      )}

      {type === 'ECOLOGICAL' && (
        <g>
          {/* Rolling green hills */}
          <path d="M 0,76 Q 55,54 110,70 T 180,66 L 180,92 L 0,92 Z" fill="#047857" />
          {/* Twin Wind Turbines */}
          {[64, 118].map((cx, i) => (
            <g key={cx}>
              <line x1={cx} y1={74} x2={cx} y2={34 + i * 4} stroke="#f8fafc" strokeWidth={2.6} />
              <circle cx={cx} cy={34 + i * 4} r={3} fill="#fde047" />
              <line x1={cx} y1={34 + i * 4} x2={cx} y2={14 + i * 4} stroke="#ffffff" strokeWidth={2.2} strokeLinecap="round" />
              <line x1={cx} y1={34 + i * 4} x2={cx + 17} y2={44 + i * 4} stroke="#ffffff" strokeWidth={2.2} strokeLinecap="round" />
              <line x1={cx} y1={34 + i * 4} x2={cx - 17} y2={44 + i * 4} stroke="#ffffff" strokeWidth={2.2} strokeLinecap="round" />
            </g>
          ))}
        </g>
      )}

      {type === 'STEP_3' && (
        <g>
          <polygon
            points="92,10 74,46 90,46 80,80 112,38 95,38"
            fill="#fde047"
            stroke="#ffffff"
            strokeWidth={1.2}
          />
        </g>
      )}
    </svg>
  );
};

export interface PowerPlantCardVisualProps {
  readonly card: PowerPlantCard;
  readonly ownedPlant?: OwnedPowerPlant;
  readonly isSelectable?: boolean;
  readonly isSelected?: boolean;
  readonly isActiveAuction?: boolean;
  readonly compact?: boolean;
  readonly onClick?: () => void;
}

export const PowerPlantCardVisual: React.FC<PowerPlantCardVisualProps> = ({
  card,
  ownedPlant,
  isSelectable = false,
  isSelected = false,
  isActiveAuction = false,
  compact = false,
  onClick,
}) => {
  const theme = PLANT_THEMES[card.resourceType];

  return (
    <div
      onClick={isSelectable && onClick ? onClick : undefined}
      style={{
        borderRadius: 12,
        background: `linear-gradient(160deg, ${theme.headerBg} 0%, #090d16 100%)`,
        border: isActiveAuction
          ? '2.5px solid #fde047'
          : isSelected
            ? '2.5px solid #38bdf8'
            : `1.5px solid ${theme.border}`,
        boxShadow: isActiveAuction
          ? '0 0 18px rgba(250, 204, 21, 0.45)'
          : isSelected
            ? '0 0 14px rgba(56, 189, 248, 0.4)'
            : '0 4px 12px rgba(0, 0, 0, 0.45)',
        padding: compact ? '0.45rem' : '0.55rem',
        display: 'flex',
        flexDirection: 'column',
        gap: compact ? '0.35rem' : '0.45rem',
        cursor: isSelectable ? 'pointer' : 'default',
        transition: 'transform 0.14s ease, box-shadow 0.14s ease',
        position: 'relative',
        userSelect: 'none',
      }}
    >
      {/* Top Row: Big Minimum-Bid Plant Number + Type Pill */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '0.35rem',
        }}
      >
        <span
          style={{
            padding: compact ? '1px 7px' : '2px 9px',
            borderRadius: 8,
            background: '#020617',
            border: `1.5px solid ${theme.border}`,
            fontFamily: 'monospace',
            fontWeight: 900,
            fontSize: compact ? '0.92rem' : '1.1rem',
            color: '#ffffff',
            letterSpacing: '0.03em',
          }}
        >
          {card.id === 99 ? 'STEP 3' : card.id.toString().padStart(2, '0')}
        </span>

        <span
          style={{
            padding: '2px 6px',
            borderRadius: 6,
            background: theme.badgeBg,
            color: theme.badgeText,
            fontSize: compact ? '0.62rem' : '0.68rem',
            fontWeight: 800,
            whiteSpace: 'nowrap',
          }}
        >
          {theme.label}
        </span>
      </div>

      {/* Illustrated Artwork Frame */}
      <PlantArtworkSvg type={card.resourceType} plantId={card.id} />

      {/* Bottom Industrial Conversion Strip: Fuel Intake -> Cities Powered */}
      {card.resourceType !== 'STEP_3' && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'rgba(2, 6, 23, 0.82)',
            border: '1px solid rgba(148, 163, 184, 0.25)',
            borderRadius: 8,
            padding: compact ? '3px 6px' : '4px 8px',
            fontSize: compact ? '0.72rem' : '0.78rem',
          }}
        >
          <span
            title={
              card.intakeCost === 0
                ? 'Requires 0 fuel to operate'
                : `Burns ${card.intakeCost} ${theme.label} fuel`
            }
            style={{ fontWeight: 800, color: '#e2e8f0' }}
          >
            {card.intakeCost === 0
              ? '🍃 Free'
              : `${Array.from({ length: card.intakeCost })
                  .map(() => theme.fuelIcon)
                  .join('')}`}
          </span>

          <span style={{ color: '#94a3b8', fontWeight: 900 }}>➔</span>

          <span
            title={`Powers up to ${card.citiesPowered} connected cities`}
            style={{
              padding: '1px 6px',
              borderRadius: 6,
              background: 'rgba(16, 185, 129, 0.2)',
              border: '1px solid rgba(52, 211, 153, 0.5)',
              color: '#6ee7b7',
              fontWeight: 900,
              fontFamily: 'monospace',
            }}
          >
            🏠 {card.citiesPowered}
          </span>
        </div>
      )}

      {/* Owned Plant Stored Fuel Tokens */}
      {ownedPlant && card.intakeCost > 0 && (
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 4,
            fontSize: '0.68rem',
            paddingTop: 2,
          }}
        >
          <span style={{ color: '#94a3b8' }}>
            Stored (Max {card.intakeCost * 2}):
          </span>
          <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
            {ALL_POWER_GRID_RESOURCES.flatMap((res) =>
              Array.from({ length: ownedPlant.storedResources[res] }, (_, i) => (
                <span
                  key={`${res}_${i}`}
                  style={{
                    padding: '0 4px',
                    borderRadius: 4,
                    background: RESOURCE_CHIP[res].bg,
                    border: '1px solid rgba(255,255,255,0.25)',
                    fontSize: '0.68rem',
                  }}
                >
                  {RESOURCE_CHIP[res].icon}
                </span>
              ))
            )}
            {ALL_POWER_GRID_RESOURCES.every(
              (r) => ownedPlant.storedResources[r] === 0
            ) && <span style={{ color: '#64748b' }}>Empty</span>}
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * Clickable Power Plant Market Deck/Summary Card that expands the full
 * Power Plant Market & Auction House window into the center of the screen.
 */
export const PowerPlantMarketLauncherCard: React.FC<{
  readonly actualMarket: readonly PowerPlantCard[];
  readonly futureMarket: readonly PowerPlantCard[];
  readonly drawDeckCount: number;
  readonly activeAuctionPlant: PowerPlantCard | null;
  readonly currentBid: number;
  readonly isAuctionPhase: boolean;
  readonly onOpenMarketWindow: () => void;
}> = ({
  actualMarket,
  futureMarket,
  drawDeckCount,
  activeAuctionPlant,
  currentBid,
  isAuctionPhase,
  onOpenMarketWindow,
}) => {
  return (
    <button
      type="button"
      onClick={onOpenMarketWindow}
      style={{
        width: '100%',
        textAlign: 'left',
        borderRadius: 14,
        padding: '0.75rem 0.9rem',
        background: isAuctionPhase
          ? 'linear-gradient(135deg, #451a03 0%, #1e293b 65%, #0f172a 100%)'
          : 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
        border: isAuctionPhase
          ? '2px solid #fbbf24'
          : '1.5px solid #475569',
        boxShadow: isAuctionPhase
          ? '0 0 20px rgba(251, 191, 36, 0.25)'
          : '0 6px 16px rgba(0, 0, 0, 0.35)',
        color: '#f8fafc',
        cursor: 'pointer',
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '0.75rem',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        {/* Mini Illustrated Stack Icon */}
        <div
          style={{
            width: 52,
            height: 58,
            borderRadius: 10,
            background: 'linear-gradient(145deg, #f59e0b 0%, #b45309 100%)',
            border: '2px solid #fef08a',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '3px 3px 0 #1e293b, 6px 6px 0 #334155',
            flexShrink: 0,
          }}
        >
          <span style={{ fontSize: '1.35rem', lineHeight: 1 }}>🏭</span>
          <span
            style={{
              fontSize: '0.6rem',
              fontWeight: 900,
              color: '#0f172a',
              marginTop: 2,
            }}
          >
            MARKET
          </span>
        </div>

        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.9rem', fontWeight: 900, color: '#fde047' }}>
              ⚡ Power Plant Market &amp; Auction Window
            </span>
            <span
              style={{
                fontSize: '0.68rem',
                padding: '2px 7px',
                borderRadius: 999,
                background: '#020617',
                border: '1px solid #475569',
                color: '#cbd5e1',
                fontFamily: 'monospace',
              }}
            >
              Deck: {drawDeckCount}
            </span>
          </div>

          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '0.35rem',
              marginTop: '0.35rem',
              alignItems: 'center',
            }}
          >
            <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
              Actual:
            </span>
            {actualMarket.map((c) => (
              <span
                key={c.id}
                style={{
                  padding: '1px 6px',
                  borderRadius: 6,
                  background: '#020617',
                  border: `1px solid ${PLANT_THEMES[c.resourceType].border}`,
                  fontSize: '0.72rem',
                  fontFamily: 'monospace',
                  fontWeight: 800,
                }}
              >
                #{c.id.toString().padStart(2, '0')} ({PLANT_THEMES[c.resourceType].fuelIcon}➔🏠{c.citiesPowered})
              </span>
            ))}
            {futureMarket.length > 0 && (
              <>
                <span style={{ fontSize: '0.72rem', color: '#64748b', marginLeft: 4 }}>
                  Future:
                </span>
                {futureMarket.map((c) => (
                  <span
                    key={c.id}
                    style={{
                      padding: '1px 5px',
                      borderRadius: 6,
                      background: 'rgba(15,23,42,0.7)',
                      border: '1px solid #334155',
                      fontSize: '0.68rem',
                      fontFamily: 'monospace',
                      color: '#94a3b8',
                    }}
                  >
                    #{c.id.toString().padStart(2, '0')}
                  </span>
                ))}
              </>
            )}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        {activeAuctionPlant && (
          <span
            style={{
              padding: '0.3rem 0.65rem',
              borderRadius: 8,
              background: '#dc2626',
              color: '#ffffff',
              fontSize: '0.74rem',
              fontWeight: 900,
            }}
          >
            🔨 Bidding #{activeAuctionPlant.id} @ ${currentBid}
          </span>
        )}
        <span
          style={{
            padding: '0.4rem 0.8rem',
            borderRadius: 9,
            background: '#fbbf24',
            color: '#0f172a',
            fontWeight: 900,
            fontSize: '0.76rem',
            whiteSpace: 'nowrap',
          }}
        >
          🔍 Expand Market
        </span>
      </div>
    </button>
  );
};
