import React from 'react';
import {
  DestinationTicket,
  TrainCardColor,
  TTRMapId,
} from '../games/ticket-to-ride/types.js';
import {
  CITY_COORDINATES,
  EUROPE_CITY_COORDINATES,
  ROUTE_COLOR_THEMES,
} from './mapData.js';

interface TrainCarArtworkProps {
  readonly color: TrainCardColor;
}

const CAR_TYPE_LABELS: Readonly<Record<TrainCardColor, string>> = {
  PINK: 'Passenger',
  WHITE: 'Reefer',
  BLUE: 'Tanker',
  YELLOW: 'Boxcar',
  ORANGE: 'Freight',
  BLACK: 'Hopper',
  RED: 'Coal Car',
  GREEN: 'Caboose',
  LOCOMOTIVE: 'Locomotive',
};

/**
 * Custom SVG illustration of each classic Ticket to Ride train car type.
 */
export const TrainCarArtwork: React.FC<TrainCarArtworkProps> = ({ color }) => {
  const theme = ROUTE_COLOR_THEMES[color];

  if (color === 'LOCOMOTIVE') {
    return (
      <svg viewBox="0 0 96 54" className="w-full h-full drop-shadow">
        <defs>
          <linearGradient id="locoRainbow" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#ef4444" />
            <stop offset="25%" stopColor="#f59e0b" />
            <stop offset="50%" stopColor="#10b981" />
            <stop offset="75%" stopColor="#3b82f6" />
            <stop offset="100%" stopColor="#a855f7" />
          </linearGradient>
        </defs>
        {/* Rail track */}
        <line x1="4" y1="47" x2="92" y2="47" stroke="#64748b" strokeWidth="2.5" />
        {/* Steam puffs */}
        <circle cx="24" cy="10" r="4" fill="#e2e8f0" opacity="0.65" />
        <circle cx="33" cy="7" r="5" fill="#f8fafc" opacity="0.5" />
        <circle cx="43" cy="5" r="3.5" fill="#cbd5e1" opacity="0.4" />
        {/* Cowcatcher */}
        <polygon points="8,44 18,34 18,44" fill="#fbbf24" stroke="#0f172a" strokeWidth="1.2" />
        {/* Boiler */}
        <rect x="18" y="21" width="42" height="19" rx="4" fill="url(#locoRainbow)" stroke="#f8fafc" strokeWidth="1.4" />
        {/* Smokestack */}
        <polygon points="23,21 20,12 29,12 27,21" fill="#1e293b" stroke="#fbbf24" strokeWidth="1.2" />
        {/* Steam dome */}
        <path d="M 38 21 A 5 5 0 0 1 48 21 Z" fill="#fbbf24" stroke="#0f172a" strokeWidth="1.2" />
        {/* Engineer Cab */}
        <rect x="58" y="14" width="26" height="26" rx="3" fill="#1e293b" stroke="#fbbf24" strokeWidth="1.5" />
        <rect x="63" y="18" width="14" height="9" rx="1.5" fill="#bae6fd" stroke="#0f172a" strokeWidth="1" />
        {/* Gold stripe */}
        <line x1="18" y1="31" x2="84" y2="31" stroke="#fde047" strokeWidth="2" />
        {/* Driving Wheels */}
        <circle cx="26" cy="42" r="5" fill="#334155" stroke="#fbbf24" strokeWidth="1.6" />
        <circle cx="40" cy="42" r="6" fill="#334155" stroke="#fbbf24" strokeWidth="1.8" />
        <circle cx="56" cy="42" r="6" fill="#334155" stroke="#fbbf24" strokeWidth="1.8" />
        <circle cx="73" cy="42" r="6" fill="#334155" stroke="#fbbf24" strokeWidth="1.8" />
        {/* Side rod */}
        <line x1="26" y1="42" x2="73" y2="42" stroke="#f8fafc" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 96 54" className="w-full h-full drop-shadow">
      {/* Rail track */}
      <line x1="6" y1="47" x2="90" y2="47" stroke="#64748b" strokeWidth="2" />
      {/* Couplers */}
      <rect x="6" y="34" width="6" height="4" rx="1" fill="#475569" />
      <rect x="84" y="34" width="6" height="4" rx="1" fill="#475569" />

      {color === 'BLUE' ? (
        /* Tank Car (Rounded cylinder + top dome) */
        <>
          <path d="M 38 16 A 10 6 0 0 1 58 16 Z" fill={theme.hex} stroke={theme.strokeHex} strokeWidth="1.4" />
          <rect x="13" y="17" width="70" height="20" rx="9" fill={theme.hex} stroke={theme.strokeHex} strokeWidth="1.6" />
          <line x1="30" y1="17" x2="30" y2="37" stroke={theme.strokeHex} strokeWidth="1.3" opacity="0.7" />
          <line x1="66" y1="17" x2="66" y2="37" stroke={theme.strokeHex} strokeWidth="1.3" opacity="0.7" />
          <rect x="11" y="37" width="74" height="3" fill="#0f172a" />
        </>
      ) : color === 'GREEN' ? (
        /* Caboose (Cupola on roof + end platforms) */
        <>
          <rect x="34" y="10" width="28" height="8" rx="2" fill={theme.hex} stroke={theme.strokeHex} strokeWidth="1.4" />
          <rect x="38" y="12" width="8" height="4" rx="1" fill="#fef08a" />
          <rect x="50" y="12" width="8" height="4" rx="1" fill="#fef08a" />
          <rect x="16" y="17" width="64" height="21" rx="3" fill={theme.hex} stroke={theme.strokeHex} strokeWidth="1.6" />
          <rect x="24" y="22" width="10" height="8" rx="1.5" fill="#fef08a" stroke="#0f172a" strokeWidth="1" />
          <rect x="43" y="22" width="10" height="8" rx="1.5" fill="#fef08a" stroke="#0f172a" strokeWidth="1" />
          <rect x="62" y="22" width="10" height="8" rx="1.5" fill="#fef08a" stroke="#0f172a" strokeWidth="1" />
        </>
      ) : color === 'BLACK' || color === 'RED' ? (
        /* Open Hopper / Coal Tender */
        <>
          <path
            d="M 16 18 Q 30 10 48 15 Q 66 10 80 18 Z"
            fill={color === 'RED' ? '#1e293b' : '#475569'}
          />
          <polygon
            points="12,17 84,17 78,38 18,38"
            fill={theme.hex}
            stroke={theme.strokeHex}
            strokeWidth="1.6"
          />
          <line x1="32" y1="17" x2="34" y2="38" stroke={theme.strokeHex} strokeWidth="1.3" opacity="0.75" />
          <line x1="48" y1="17" x2="48" y2="38" stroke={theme.strokeHex} strokeWidth="1.3" opacity="0.75" />
          <line x1="64" y1="17" x2="62" y2="38" stroke={theme.strokeHex} strokeWidth="1.3" opacity="0.75" />
        </>
      ) : color === 'PINK' ? (
        /* Passenger Coach (Arched roof + row of illuminated windows) */
        <>
          <path d="M 12 18 Q 48 11 84 18 Z" fill={theme.strokeHex} />
          <rect x="12" y="17" width="72" height="21" rx="3" fill={theme.hex} stroke={theme.strokeHex} strokeWidth="1.6" />
          {[20, 32, 44, 56, 68].map((wx) => (
            <rect
              key={wx}
              x={wx}
              y="21"
              width="8"
              height="8"
              rx="1.5"
              fill="#fef9c3"
              stroke="#0f172a"
              strokeWidth="1"
            />
          ))}
        </>
      ) : (
        /* Boxcar / Reefer / Freight Car (YELLOW, WHITE, ORANGE) */
        <>
          <rect x="11" y="14" width="74" height="3" rx="1.5" fill={theme.strokeHex} />
          <rect x="13" y="16" width="70" height="22" rx="2.5" fill={theme.hex} stroke={theme.strokeHex} strokeWidth="1.6" />
          {/* Sliding freight door */}
          <rect
            x="39"
            y="18"
            width="18"
            height="18"
            rx="1"
            fill="rgba(15, 23, 42, 0.22)"
            stroke={theme.strokeHex}
            strokeWidth="1.2"
          />
          <line x1="25" y1="16" x2="25" y2="38" stroke={theme.strokeHex} strokeWidth="1" opacity="0.6" />
          <line x1="71" y1="16" x2="71" y2="38" stroke={theme.strokeHex} strokeWidth="1" opacity="0.6" />
        </>
      )}

      {/* Wheel Trucks (Bogies) */}
      <circle cx="24" cy="42" r="4.5" fill="#1e293b" stroke="#cbd5e1" strokeWidth="1.5" />
      <circle cx="35" cy="42" r="4.5" fill="#1e293b" stroke="#cbd5e1" strokeWidth="1.5" />
      <circle cx="61" cy="42" r="4.5" fill="#1e293b" stroke="#cbd5e1" strokeWidth="1.5" />
      <circle cx="72" cy="42" r="4.5" fill="#1e293b" stroke="#cbd5e1" strokeWidth="1.5" />
    </svg>
  );
};

export interface TrainCardVisualProps {
  readonly color: TrainCardColor;
  readonly count?: number;
  readonly recentDrawnCount?: number;
  readonly variant: 'hand' | 'market';
  readonly slotIndex?: number;
  readonly disabled?: boolean;
  readonly onClick?: () => void;
}

/**
 * Physical playing-card representation of a Ticket to Ride Train Car Card.
 */
export const TrainCardVisual: React.FC<TrainCardVisualProps> = ({
  color,
  count = 1,
  recentDrawnCount = 0,
  variant,
  slotIndex,
  disabled = false,
  onClick,
}) => {
  const theme = ROUTE_COLOR_THEMES[color];
  const isEmptyHandSlot = variant === 'hand' && count === 0;

  if (variant === 'market') {
    return (
      <button
        type="button"
        disabled={disabled}
        onClick={onClick}
        className="relative flex flex-col justify-between rounded-xl p-1.5 bg-amber-50/95 hover:bg-white disabled:opacity-45 disabled:cursor-not-allowed border-2 border-amber-200/90 hover:border-amber-400 shadow-md hover:-translate-y-0.5 transition-all group text-left select-none"
        title={`Draw face-up ${theme.label} (${CAR_TYPE_LABELS[color]}) from Slot #${slotIndex ?? 0}`}
      >
        {/* Inner vintage card frame */}
        <div
          className="w-full rounded-lg border p-1 flex flex-col justify-between bg-slate-900/95"
          style={{ borderColor: theme.strokeHex }}
        >
          {/* Top corner emblems */}
          <div className="flex items-center justify-between px-0.5">
            <span
              className="px-1.5 py-0.2 rounded text-[8px] font-black uppercase tracking-wider shadow-sm"
              style={{
                backgroundColor: theme.hex,
                color: theme.textHex,
              }}
            >
              {color === 'LOCOMOTIVE' ? 'WILD' : color}
            </span>
            <span className="text-[8px] font-mono font-bold text-slate-400 group-hover:text-amber-300">
              #{slotIndex}
            </span>
          </div>

          {/* Center Train Car Artwork */}
          <div className="h-11 w-full my-0.5">
            <TrainCarArtwork color={color} />
          </div>

          {/* Bottom car type banner */}
          <div className="flex items-center justify-between px-1 pt-0.5 border-t border-slate-800/90">
            <span className="text-[8px] font-bold uppercase tracking-wider text-slate-300 truncate">
              {CAR_TYPE_LABELS[color]}
            </span>
            {color === 'LOCOMOTIVE' && (
              <span className="text-[8px] font-extrabold text-amber-300">2 Draws</span>
            )}
          </div>
        </div>
      </button>
    );
  }

  // Hand variant: vertical physical playing card with stacked deck depth when count > 1
  return (
    <div
      className={`relative flex flex-col justify-between rounded-xl p-1 border-2 transition-all select-none ${
        recentDrawnCount > 0
          ? 'bg-amber-50 border-amber-400 ring-2 ring-amber-400/60 shadow-lg -translate-y-1'
          : isEmptyHandSlot
          ? 'bg-slate-950/40 border-slate-800/70 opacity-40'
          : 'bg-amber-50/95 border-amber-200/80 shadow-md hover:-translate-y-0.5'
      }`}
    >
      {/* Stacked physical card edges behind when player holds multiple of this color */}
      {count > 1 && (
        <div className="pointer-events-none absolute -top-1 left-1 right-1 h-2 rounded-t-lg bg-amber-100/80 border-t border-x border-amber-300/70 -z-10" />
      )}
      {count > 3 && (
        <div className="pointer-events-none absolute -top-2 left-2 right-2 h-2 rounded-t-lg bg-amber-200/60 border-t border-x border-amber-400/50 -z-20" />
      )}

      {/* Recent Draw Badge (1x / 2x) */}
      {recentDrawnCount > 0 && (
        <span
          className="absolute -top-3 left-1/2 -translate-x-1/2 z-20 px-1.5 py-0.5 rounded-full bg-amber-400 text-slate-950 font-mono text-[10px] font-black shadow-md border border-amber-100 animate-bounce"
          title={`Drew ${recentDrawnCount}x ${color} on last action`}
        >
          +{recentDrawnCount}
        </span>
      )}

      {/* Inner Playing Card Frame */}
      <div
        className="w-full h-full rounded-lg bg-slate-900 p-1 flex flex-col justify-between border"
        style={{
          borderColor: isEmptyHandSlot ? '#1e293b' : theme.strokeHex,
        }}
      >
        {/* Top Pip & Count Badge */}
        <div className="flex items-center justify-between gap-0.5">
          <span
            className="w-3.5 h-3.5 rounded-full border flex items-center justify-center text-[8px] font-black shadow-sm shrink-0"
            style={{
              backgroundColor: theme.hex,
              borderColor: theme.strokeHex,
              color: theme.textHex,
            }}
          >
            {color === 'LOCOMOTIVE' ? '★' : color[0]}
          </span>
          <span
            className={`px-1.5 py-0.2 rounded font-mono text-xs font-black border ${
              count > 0
                ? `${theme.badgeBg} ${theme.badgeBorder}`
                : 'bg-slate-800 text-slate-500 border-slate-700'
            }`}
          >
            ×{count}
          </span>
        </div>

        {/* Center Train Car Illustration */}
        <div className="h-10 w-full my-0.5">
          <TrainCarArtwork color={color} />
        </div>

        {/* Bottom Label */}
        <div
          className="w-full rounded py-0.5 text-center text-[8.5px] font-black uppercase tracking-wider truncate"
          style={{
            backgroundColor: isEmptyHandSlot ? '#0f172a' : theme.hex,
            color: isEmptyHandSlot ? '#64748b' : theme.textHex,
          }}
        >
          {color === 'LOCOMOTIVE' ? 'LOCO' : color}
        </div>
      </div>
    </div>
  );
};

interface TrainCardDeckVisualProps {
  readonly deckCount: number;
  readonly disabled: boolean;
  readonly pending?: boolean;
  readonly onClick: () => void;
}

/**
 * Physical card-back stack for the blind Train Card draw pile.
 */
export const TrainCardDeckVisual: React.FC<TrainCardDeckVisualProps> = ({
  deckCount,
  disabled,
  pending = false,
  onClick,
}) => {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="relative flex flex-col justify-between rounded-xl p-1.5 bg-amber-100/95 hover:bg-white disabled:opacity-45 disabled:cursor-not-allowed border-2 border-indigo-400 hover:border-amber-400 shadow-md hover:-translate-y-0.5 transition-all group select-none"
      title="Draw 1 blind Train Card from the top of the deck"
    >
      <div className="w-full h-full rounded-lg bg-gradient-to-br from-indigo-950 via-slate-900 to-indigo-900 border border-indigo-400/70 p-1.5 flex flex-col items-center justify-between relative overflow-hidden">
        {/* Decorative railway card-back filigree */}
        <div className="w-full flex items-center justify-between text-[8px] font-mono text-indigo-300">
          <span>DECK</span>
          <span className="font-bold text-amber-300">{deckCount}</span>
        </div>

        <div className="my-1 flex flex-col items-center">
          <div className="w-8 h-8 rounded-full bg-indigo-500/20 border border-amber-400/70 flex items-center justify-center text-sm shadow-inner">
            🚂
          </div>
          <span className="text-[8px] font-black uppercase tracking-widest text-amber-200 mt-0.5">
            {pending ? '...' : 'DRAW BLIND'}
          </span>
        </div>

        <div className="w-full text-center text-[7.5px] font-semibold text-indigo-300 group-hover:text-white border-t border-indigo-800/80 pt-0.5">
          Train Car Pile
        </div>
      </div>
    </button>
  );
};

interface DestinationTicketCardVisualProps {
  readonly ticket: DestinationTicket;
  readonly mapId?: TTRMapId | undefined;
  readonly completed: boolean;
  readonly isChaosHalved?: boolean | undefined;
  readonly effectivePoints?: number | undefined;
  readonly selectable?: boolean | undefined;
  readonly selected?: boolean | undefined;
  readonly onToggleSelect?: (() => void) | undefined;
  readonly compact?: boolean | undefined;
  readonly onMouseEnter?: (() => void) | undefined;
  readonly onMouseLeave?: (() => void) | undefined;
}

const USA_MINI_SILHOUETTE =
  'M 55,15 L 495,15 L 525,52 L 595,62 L 645,25 L 955,25 L 985,85 L 965,150 L 940,175 L 905,235 L 875,310 L 855,390 L 865,455 L 868,568 L 832,575 L 800,505 L 725,510 L 665,555 L 555,565 L 495,588 L 350,545 L 225,500 L 125,480 L 68,375 L 82,205 L 102,135 L 88,65 Z';

const EUROPE_MINI_MAIN_SILHOUETTE =
  'M 42,485 L 75,405 L 155,395 L 135,260 L 228,235 L 295,205 L 320,165 L 415,175 L 430,105 L 475,135 L 555,155 L 630,105 L 725,52 L 960,45 L 965,545 L 690,558 L 695,485 L 645,480 L 615,545 L 580,505 L 550,435 L 495,380 L 455,385 L 515,480 L 485,515 L 420,465 L 395,395 L 310,420 L 225,495 L 105,565 L 45,515 Z';

const EUROPE_MINI_UK_SILHOUETTE =
  'M 175,55 L 225,55 L 258,165 L 245,202 L 185,195 L 178,125 Z';

const EUROPE_MINI_SCANDINAVIA_SILHOUETTE =
  'M 435,28 L 585,25 L 560,92 L 485,105 L 445,75 Z';

/**
 * Physical-style Ticket to Ride Destination Ticket card with an embedded
 * USA or Europe board mini-map showing where the two cities are located,
 * a connecting route arc, and a brass point value medallion.
 */
export const DestinationTicketCardVisual: React.FC<
  DestinationTicketCardVisualProps
> = ({
  ticket,
  mapId = 'USA',
  completed,
  isChaosHalved = false,
  effectivePoints,
  selectable = false,
  selected = true,
  onToggleSelect,
  compact = false,
  onMouseEnter,
  onMouseLeave,
}) => {
  const displayPts = effectivePoints ?? ticket.points;
  const isLongRoute = ticket.isLongRoute === true;

  const coordsMap =
    mapId === 'EUROPE' ? EUROPE_CITY_COORDINATES : CITY_COORDINATES;
  const fromCoord = coordsMap[ticket.from] ?? { x: 240, y: 300 };
  const toCoord = coordsMap[ticket.to] ?? { x: 760, y: 300 };

  const dx = toCoord.x - fromCoord.x;
  const dy = toCoord.y - fromCoord.y;
  const dist = Math.hypot(dx, dy) || 1;
  const midX = (fromCoord.x + toCoord.x) / 2;
  const midY = (fromCoord.y + toCoord.y) / 2;
  const curveOffset = Math.min(95, dist * 0.2);
  const ctrlX = midX - (dy / dist) * curveOffset;
  const ctrlY = midY + (dx / dist) * curveOffset;
  const arcPath = `M ${fromCoord.x} ${fromCoord.y} Q ${ctrlX} ${ctrlY} ${toCoord.x} ${toCoord.y}`;

  const allCityPoints = Object.entries(coordsMap);

  const isDiscardedState = selectable && !selected;

  return (
    <div
      role={selectable ? 'button' : undefined}
      tabIndex={selectable ? 0 : undefined}
      onClick={selectable ? onToggleSelect : undefined}
      onKeyDown={
        selectable
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onToggleSelect?.();
              }
            }
          : undefined
      }
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className={`relative rounded-xl border-2 p-2 transition select-none shadow-md ${
        selectable ? 'cursor-pointer' : 'cursor-default'
      } ${
        isDiscardedState
          ? 'bg-rose-950/35 border-rose-500/50 opacity-75 hover:opacity-95'
          : completed
            ? 'bg-gradient-to-br from-emerald-950/90 via-slate-900 to-emerald-950/85 border-emerald-400/90 text-emerald-100'
            : isLongRoute
              ? 'bg-gradient-to-br from-sky-950/90 via-slate-900 to-amber-950/50 border-sky-400/80 hover:border-amber-300 text-slate-100'
              : 'bg-gradient-to-br from-amber-950/65 via-slate-900 to-amber-950/55 border-amber-500/60 hover:border-amber-300 text-slate-100'
      }`}
    >
      {/* Ticket punch notches on left & right edges */}
      <span className="pointer-events-none absolute -left-1.5 top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-slate-950 border-r border-amber-500/50" />
      <span className="pointer-events-none absolute -right-1.5 top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-slate-950 border-l border-amber-500/50" />

      {/* Top Physical Ticket Banner: City A -> City B + Keep/Status Badge */}
      <div className="flex items-center justify-between gap-1.5 pb-1.5 border-b border-amber-500/25">
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          {selectable && (
            <input
              type="checkbox"
              checked={selected}
              onChange={() => {}}
              onClick={(e) => e.stopPropagation()}
              className="w-3.5 h-3.5 accent-amber-400 rounded shrink-0 pointer-events-none"
            />
          )}
          <div
            className={`flex items-center gap-1 text-[11px] font-black tracking-tight min-w-0 ${
              isDiscardedState ? 'line-through text-slate-400' : 'text-amber-100'
            }`}
          >
            <span className="truncate">{ticket.from}</span>
            <span className="text-amber-400 shrink-0 font-mono">➔</span>
            <span className="truncate">{ticket.to}</span>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {isLongRoute && (
            <span className="px-1.5 py-0.2 rounded bg-sky-500/25 border border-sky-400/60 text-sky-200 text-[8px] font-black uppercase">
              Long Route
            </span>
          )}
          {selectable ? (
            <span
              className={`px-1.5 py-0.2 rounded text-[9px] font-black uppercase ${
                selected
                  ? 'bg-emerald-500/25 border border-emerald-400/60 text-emerald-300'
                  : 'bg-rose-500/25 border border-rose-400/60 text-rose-300'
              }`}
            >
              {selected ? 'Keep' : 'Discard'}
            </span>
          ) : completed ? (
            <span className="px-1.5 py-0.2 rounded bg-emerald-500/25 border border-emerald-400/60 text-emerald-300 text-[8.5px] font-black uppercase">
              ✓ Done
            </span>
          ) : null}
        </div>
      </div>

      {/* Center Section: Physical Mini-Map Card Illustration + Point Value Medallion */}
      <div className="mt-1.5 flex items-center gap-2">
        {/* Embedded SVG Mini-Map showing USA/Europe board, all city dots, and highlighted terminal pins */}
        <div
          className={`relative flex-1 rounded-lg overflow-hidden border ${
            completed
              ? 'border-emerald-400/60'
              : isLongRoute
                ? 'border-sky-400/50'
                : 'border-amber-500/50'
          } ${compact ? 'h-14' : 'h-16'} bg-[#2b4c65] shadow-inner`}
        >
          <svg
            viewBox="0 0 1000 600"
            preserveAspectRatio="xMidYMid meet"
            className="w-full h-full block"
          >
            {/* Vintage Ocean Background */}
            <rect x="0" y="0" width="1000" height="600" fill="#234257" />

            {/* Continent Silhouette (USA or Europe) in Warm Parchment */}
            {mapId === 'EUROPE' ? (
              <g>
                <path
                  d={EUROPE_MINI_MAIN_SILHOUETTE}
                  fill="#e7d6b5"
                  stroke="#78350f"
                  strokeWidth="8"
                  strokeLinejoin="round"
                />
                <path
                  d={EUROPE_MINI_UK_SILHOUETTE}
                  fill="#e7d6b5"
                  stroke="#78350f"
                  strokeWidth="8"
                  strokeLinejoin="round"
                />
                <path
                  d={EUROPE_MINI_SCANDINAVIA_SILHOUETTE}
                  fill="#e7d6b5"
                  stroke="#78350f"
                  strokeWidth="8"
                  strokeLinejoin="round"
                />
              </g>
            ) : (
              <path
                d={USA_MINI_SILHOUETTE}
                fill="#e7d6b5"
                stroke="#78350f"
                strokeWidth="8"
                strokeLinejoin="round"
              />
            )}

            {/* Subtle background reference dots for all other board cities */}
            {allCityPoints.map(([cityName, pt]) => {
              if (cityName === ticket.from || cityName === ticket.to) {
                return null;
              }
              return (
                <circle
                  key={cityName}
                  cx={pt.x}
                  cy={pt.y}
                  r="7"
                  fill="#78350f"
                  opacity="0.32"
                />
              );
            })}

            {/* Route Arc Shadow */}
            <path
              d={arcPath}
              fill="none"
              stroke="#0f172a"
              strokeWidth="22"
              strokeLinecap="round"
              opacity="0.45"
            />

            {/* Highlighted Dashed Route Line Connecting ticket.from -> ticket.to */}
            <path
              d={arcPath}
              fill="none"
              stroke={completed ? '#10b981' : '#dc2626'}
              strokeWidth="15"
              strokeDasharray="24 14"
              strokeLinecap="round"
            />

            {/* Endpoint City Rings & Pins */}
            {[
              { name: ticket.from, pt: fromCoord },
              { name: ticket.to, pt: toCoord },
            ].map((endpoint) => {
              const labelAbove = endpoint.pt.y > 125;
              const clampedX = Math.max(125, Math.min(875, endpoint.pt.x));
              const labelY = labelAbove
                ? endpoint.pt.y - 36
                : endpoint.pt.y + 56;
              return (
                <g key={endpoint.name}>
                  {/* Outer glowing bullseye ring */}
                  <circle
                    cx={endpoint.pt.x}
                    cy={endpoint.pt.y}
                    r="34"
                    fill={completed ? '#10b981' : '#ef4444'}
                    opacity="0.28"
                  />
                  {/* Solid city marker pin */}
                  <circle
                    cx={endpoint.pt.x}
                    cy={endpoint.pt.y}
                    r="21"
                    fill={completed ? '#10b981' : '#dc2626'}
                    stroke="#fef3c7"
                    strokeWidth="7"
                  />
                  <circle
                    cx={endpoint.pt.x}
                    cy={endpoint.pt.y}
                    r="7"
                    fill="#fef3c7"
                  />
                  {/* High-contrast mini city nameplate on the ticket map */}
                  <text
                    x={clampedX}
                    y={labelY}
                    textAnchor="middle"
                    fill="#1e293b"
                    stroke="#fef3c7"
                    strokeWidth="14"
                    paintOrder="stroke"
                    fontSize="44"
                    fontWeight="900"
                  >
                    {endpoint.name}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>

        {/* Right Side: Brass Point Value Medallion & Chaos Indicator */}
        <div className="flex flex-col items-center justify-center gap-1 shrink-0">
          <div
            className={`w-10 h-10 rounded-full border-2 flex flex-col items-center justify-center font-mono shadow-md ${
              completed
                ? 'bg-emerald-500 border-emerald-200 text-slate-950'
                : isChaosHalved
                  ? 'bg-purple-500/30 border-purple-300 text-purple-100'
                  : 'bg-gradient-to-b from-amber-300 via-amber-400 to-amber-600 border-amber-100 text-slate-950'
            }`}
            title={`Ticket Value: ${displayPts} points`}
          >
            <span className="text-xs font-black leading-none">
              {completed ? `+${displayPts}` : displayPts}
            </span>
            <span className="text-[7px] font-black uppercase leading-none mt-0.5">
              PTS
            </span>
          </div>

          {isChaosHalved && (
            <span
              className="px-1 py-0.2 rounded bg-purple-950 border border-purple-400/70 text-purple-200 font-bold text-[8px]"
              title={`City in Chaos: Halved from ${ticket.points} to ${displayPts}`}
            >
              ½ ({ticket.points}→{displayPts})
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

