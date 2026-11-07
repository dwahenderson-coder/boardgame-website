import React from 'react';
import { DestinationTicket, TrainCardColor } from '../games/ticket-to-ride/types.js';
import { ROUTE_COLOR_THEMES } from './mapData.js';

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
  readonly completed: boolean;
  readonly onMouseEnter: () => void;
  readonly onMouseLeave: () => void;
}

/**
 * Punched vintage railroad Destination Ticket card component.
 */
export const DestinationTicketCardVisual: React.FC<DestinationTicketCardVisualProps> = ({
  ticket,
  completed,
  onMouseEnter,
  onMouseLeave,
}) => {
  return (
    <div
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className={`relative rounded-xl border-2 px-3 py-2 transition cursor-default select-none shadow-sm ${
        completed
          ? 'bg-gradient-to-r from-emerald-950/90 via-slate-900 to-emerald-950/80 border-emerald-400/80 text-emerald-100'
          : 'bg-gradient-to-r from-amber-950/40 via-slate-900 to-amber-950/30 border-amber-500/40 hover:border-amber-400/80 text-slate-100'
      }`}
    >
      {/* Ticket punch notches on left & right edges */}
      <span className="pointer-events-none absolute -left-1.5 top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-slate-950 border-r border-amber-500/40" />
      <span className="pointer-events-none absolute -right-1.5 top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-slate-950 border-l border-amber-500/40" />

      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 text-xs font-extrabold tracking-tight">
            <span className="truncate text-amber-100">{ticket.from}</span>
            <span className="text-amber-400 shrink-0 font-mono">•••▸</span>
            <span className="truncate text-amber-100">{ticket.to}</span>
          </div>
          <div className="flex items-center gap-2 mt-0.5 text-[10px]">
            {completed ? (
              <span className="font-bold text-emerald-400">
                ✓ COMPLETED ROUTE
              </span>
            ) : (
              <span className="text-slate-400">
                Hover to locate terminals on map
              </span>
            )}
          </div>
        </div>

        {/* Brass Point Value Medallion */}
        <div
          className={`w-8 h-8 rounded-full border-2 flex flex-col items-center justify-center font-mono shrink-0 shadow ${
            completed
              ? 'bg-emerald-500 border-emerald-200 text-slate-950'
              : 'bg-amber-500/20 border-amber-400/80 text-amber-300'
          }`}
        >
          <span className="text-xs font-black leading-none">
            {completed ? `+${ticket.points}` : ticket.points}
          </span>
          <span className="text-[7px] font-bold uppercase leading-none">pts</span>
        </div>
      </div>
    </div>
  );
};

