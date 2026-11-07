import React, { useEffect, useState } from 'react';
import { ALL_TRAIN_CARD_COLORS, ROUTE_SCORE_TABLE } from '../games/ticket-to-ride/constants.js';
import {
  HandCounts,
  RouteEdge,
  TrainCardColor,
} from '../games/ticket-to-ride/types.js';
import { getValidPaymentsForRoute, ROUTE_COLOR_THEMES } from './mapData.js';

interface ClaimRoutePopoverProps {
  readonly route: RouteEdge;
  readonly activePlayerId: string;
  readonly actingAsPlayerId: string;
  readonly playerHand: HandCounts;
  readonly onConfirmClaim: (
    actingPlayerId: string,
    routeId: string,
    payment: Partial<Record<TrainCardColor, number>>
  ) => void;
  readonly onClose: () => void;
}

export const ClaimRoutePopover: React.FC<ClaimRoutePopoverProps> = ({
  route,
  activePlayerId,
  actingAsPlayerId,
  playerHand,
  onConfirmClaim,
  onClose,
}) => {
  const validOptions = getValidPaymentsForRoute(
    route.color,
    route.length,
    playerHand,
    route.ferryLocomotives ?? 0
  );

  const [customPayment, setCustomPayment] = useState<
    Partial<Record<TrainCardColor, number>>
  >({});

  useEffect(() => {
    if (validOptions.length > 0 && validOptions[0]) {
      setCustomPayment(validOptions[0].payment);
    } else {
      // Pre-fill a naive payment so the developer can also click "Test Invalid Claim" to verify engine rejection!
      const fallbackColor: TrainCardColor =
        route.color === 'GRAY' ? 'RED' : route.color;
      setCustomPayment({ [fallbackColor]: route.length });
    }
  }, [route.id]);

  const adjustCustomCount = (color: TrainCardColor, delta: number) => {
    setCustomPayment((prev) => {
      const current = prev[color] ?? 0;
      const nextVal = Math.max(0, current + delta);
      const copy = { ...prev };
      if (nextVal === 0) {
        delete copy[color];
      } else {
        copy[color] = nextVal;
      }
      return copy;
    });
  };

  const totalSelected = ALL_TRAIN_CARD_COLORS.reduce(
    (sum, c) => sum + (customPayment[c] ?? 0),
    0
  );

  const routeTheme = ROUTE_COLOR_THEMES[route.color];

  return (
    <div className="absolute top-3 right-3 z-30 w-96 bg-slate-900/95 border border-slate-700 rounded-xl shadow-2xl backdrop-blur-md p-4 text-xs">
      <div className="flex items-start justify-between gap-2 border-b border-slate-800 pb-2.5">
        <div>
          <div className="flex items-center gap-2">
            <span
              className={`px-2 py-0.5 rounded font-bold border ${routeTheme.badgeBg} ${routeTheme.badgeBorder}`}
            >
              {route.color}
            </span>
            <h3 className="text-sm font-bold text-slate-100">
              {route.from} ↔ {route.to}
            </h3>
          </div>
          <p className="text-slate-400 mt-1">
            Length:{' '}
            <span className="text-slate-200 font-semibold">
              {route.length} cars
            </span>{' '}
            • Worth:{' '}
            <span className="text-amber-300 font-semibold">
              +{ROUTE_SCORE_TABLE[route.length] ?? 0} pts
            </span>{' '}
            • Route ID: <code className="text-slate-300">{route.id}</code>
          </p>
          {(route.isTunnel || (route.ferryLocomotives ?? 0) > 0) && (
            <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
              {(route.ferryLocomotives ?? 0) > 0 && (
                <span className="px-2 py-0.5 rounded bg-cyan-500/20 border border-cyan-400/50 text-cyan-200 font-bold text-[10px]">
                  ⛴️ Ferry: Requires ≥ {route.ferryLocomotives} Locomotive(s)
                </span>
              )}
              {route.isTunnel && (
                <span className="px-2 py-0.5 rounded bg-amber-500/20 border border-amber-400/50 text-amber-200 font-bold text-[10px]">
                  ⛰️ Mountain Tunnel: Draws 3 top cards for tunnel tax
                </span>
              )}
            </div>
          )}
        </div>
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-slate-100 px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700"
        >
          ✕
        </button>
      </div>

      {/* Quick Valid Payment Presets */}
      <div className="mt-3">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
          Valid Hand Combinations ({actingAsPlayerId})
        </div>
        {validOptions.length > 0 ? (
          <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pr-1">
            {validOptions.map((opt, idx) => (
              <button
                key={idx}
                onClick={() =>
                  onConfirmClaim(actingAsPlayerId, route.id, opt.payment)
                }
                className="px-2.5 py-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/35 text-emerald-200 border border-emerald-500/40 font-semibold transition flex items-center gap-1.5"
              >
                <span>✓ Claim with {opt.label}</span>
              </button>
            ))}
          </div>
        ) : (
          <div className="p-2 rounded-lg bg-amber-950/40 border border-amber-700/40 text-amber-300">
            <strong>{actingAsPlayerId}</strong> does not currently hold enough
            matching cards for a valid claim. You can still dispatch a custom
            payload below to test engine rejection.
          </div>
        )}
      </div>

      {/* Custom Payment Builder (For Sandbox / Negative Validation Testing) */}
      <div className="mt-3 pt-2.5 border-t border-slate-800">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Custom Payment Payload ({totalSelected}/{route.length} cards)
          </span>
          <button
            onClick={() => setCustomPayment({})}
            className="text-[11px] text-slate-400 hover:text-slate-200 underline"
          >
            Reset
          </button>
        </div>

        <div className="grid grid-cols-3 gap-1.5">
          {ALL_TRAIN_CARD_COLORS.map((color) => {
            const count = customPayment[color] ?? 0;
            const inHand = playerHand[color];
            const theme = ROUTE_COLOR_THEMES[color];
            return (
              <div
                key={color}
                className={`flex items-center justify-between rounded px-2 py-1 border ${
                  count > 0
                    ? 'bg-slate-800 border-amber-500/60'
                    : 'bg-slate-950/60 border-slate-800'
                }`}
              >
                <div className="flex items-center gap-1.5 min-w-0">
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: theme.hex }}
                  />
                  <span className="truncate font-medium text-slate-200 text-[10px]">
                    {color === 'LOCOMOTIVE' ? 'LOCO' : color}
                  </span>
                  <span className="text-[10px] text-slate-500">({inHand})</span>
                </div>
                <div className="flex items-center gap-1 ml-1">
                  <button
                    onClick={() => adjustCustomCount(color, -1)}
                    className="w-4 h-4 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center"
                  >
                    -
                  </button>
                  <span className="w-3 text-center font-mono font-bold text-amber-300">
                    {count}
                  </span>
                  <button
                    onClick={() => adjustCustomCount(color, 1)}
                    className="w-4 h-4 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center"
                  >
                    +
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-3 flex items-center justify-between gap-2">
          <div className="text-[11px] text-slate-400">
            Actor:{' '}
            <span className="font-mono font-bold text-slate-200">
              {actingAsPlayerId}
            </span>
            {actingAsPlayerId !== activePlayerId && (
              <span className="ml-1 text-rose-400">(Out-of-turn test)</span>
            )}
          </div>
          <button
            onClick={() =>
              onConfirmClaim(actingAsPlayerId, route.id, customPayment)
            }
            className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold transition shadow"
          >
            Dispatch CLAIM_ROUTE
          </button>
        </div>
      </div>
    </div>
  );
};

