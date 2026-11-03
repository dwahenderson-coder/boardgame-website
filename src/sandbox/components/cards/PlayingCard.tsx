import React from 'react';
import {
  CardRank,
  CardSuit,
  StandardCard,
  SUIT_METADATA,
} from '../../../common/cards/index.js';

export interface PlayingCardProps {
  readonly card?: StandardCard;
  readonly rank?: CardRank;
  readonly suit?: CardSuit | 'JOKER';
  readonly faceDown?: boolean;
  readonly highlighted?: boolean;
  readonly dimmed?: boolean;
  readonly size?: 'sm' | 'md' | 'lg';
  readonly onClick?: () => void;
  readonly className?: string;
}

const SIZE_CLASSES: Readonly<
  Record<
    NonNullable<PlayingCardProps['size']>,
    {
      container: string;
      cornerRank: string;
      cornerSuit: string;
      centerPip: string;
    }
  >
> = {
  sm: {
    container: 'w-12 h-17 rounded-lg',
    cornerRank: 'text-[11px] leading-none font-black',
    cornerSuit: 'text-[10px] leading-none',
    centerPip: 'text-xl',
  },
  md: {
    container: 'w-16 h-24 rounded-xl',
    cornerRank: 'text-sm leading-none font-black',
    cornerSuit: 'text-xs leading-none',
    centerPip: 'text-3xl',
  },
  lg: {
    container: 'w-20 h-28 rounded-xl',
    cornerRank: 'text-base leading-none font-black',
    cornerSuit: 'text-sm leading-none',
    centerPip: 'text-4xl',
  },
};

/**
 * Reusable PlayingCard UI primitive shared across all card games (Poker, Hearts, Blackjack, Solitaire).
 */
export const PlayingCard: React.FC<PlayingCardProps> = ({
  card,
  rank,
  suit,
  faceDown = false,
  highlighted = false,
  dimmed = false,
  size = 'md',
  onClick,
  className = '',
}) => {
  const sizeSpec = SIZE_CLASSES[size];

  if (faceDown || (!card && (!rank || !suit))) {
    return (
      <div
        onClick={onClick}
        className={`relative select-none ${sizeSpec.container} bg-gradient-to-br from-indigo-900 via-slate-900 to-rose-950 border-2 border-slate-300/80 shadow-lg flex items-center justify-center overflow-hidden transition-transform duration-200 ${
          onClick ? 'cursor-pointer hover:-translate-y-1.5' : ''
        } ${dimmed ? 'opacity-45' : ''} ${className}`}
      >
        <div className="w-[82%] h-[84%] rounded-md border border-amber-400/40 bg-[radial-gradient(#f59e0b_1px,transparent_1px)] [background-size:6px_6px] opacity-60 flex items-center justify-center">
          <span className="text-amber-300/80 text-sm font-black">♠♥</span>
        </div>
      </div>
    );
  }

  const resolvedRank = card ? card.rank : rank!;
  const resolvedSuit = card ? card.suit : suit!;
  const isJoker = resolvedSuit === 'JOKER';
  const suitMeta = !isJoker ? SUIT_METADATA[resolvedSuit] : null;
  const isRed = suitMeta?.color === 'red';

  const textColorClass = isJoker
    ? 'text-purple-700'
    : isRed
      ? 'text-rose-600'
      : 'text-slate-900';

  const borderClass = highlighted
    ? 'border-amber-400 ring-2 ring-amber-400/70 shadow-amber-500/30 -translate-y-1.5'
    : 'border-slate-300';

  return (
    <div
      onClick={onClick}
      className={`relative select-none ${sizeSpec.container} bg-gradient-to-br from-white via-slate-50 to-slate-100 border-2 ${borderClass} shadow-lg flex flex-col justify-between p-1.5 transition-all duration-200 ${
        onClick ? 'cursor-pointer hover:-translate-y-2 hover:shadow-xl' : ''
      } ${dimmed ? 'opacity-45 grayscale-[30%]' : ''} ${className}`}
    >
      {/* Top-Left Index */}
      <div className={`flex flex-col items-start ${textColorClass}`}>
        <span className={sizeSpec.cornerRank}>
          {isJoker ? '★' : resolvedRank}
        </span>
        <span className={sizeSpec.cornerSuit}>
          {isJoker ? 'JKR' : suitMeta!.symbol}
        </span>
      </div>

      {/* Center Suit Pip */}
      <div
        className={`flex items-center justify-center ${sizeSpec.centerPip} ${textColorClass} drop-shadow-sm`}
      >
        {isJoker ? '🃏' : suitMeta!.symbol}
      </div>

      {/* Bottom-Right Mirrored Index */}
      <div
        className={`flex flex-col items-end rotate-180 ${textColorClass}`}
      >
        <span className={sizeSpec.cornerRank}>
          {isJoker ? '★' : resolvedRank}
        </span>
        <span className={sizeSpec.cornerSuit}>
          {isJoker ? 'JKR' : suitMeta!.symbol}
        </span>
      </div>

      {highlighted && (
        <span className="absolute -top-2 -right-2 px-1.5 py-0.5 rounded-full bg-amber-400 text-slate-950 text-[9px] font-black uppercase tracking-wider shadow">
          Best
        </span>
      )}
    </div>
  );
};

