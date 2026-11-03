import React from 'react';
import { StandardCard } from '../../../common/cards/index.js';
import { PlayingCard } from './PlayingCard.js';

export interface HandViewProps {
  readonly cards: readonly StandardCard[] | null;
  readonly cardCount?: number;
  readonly faceDown?: boolean;
  readonly highlightedCardIds?: ReadonlySet<string>;
  readonly size?: 'sm' | 'md' | 'lg';
  readonly fanAngleDeg?: number;
  readonly onPlayCard?: (card: StandardCard) => void;
  readonly className?: string;
}

/**
 * Reusable fanned hand component used across Poker, Hearts, Blackjack, and other card games.
 * Automatically renders face-down card backs when `cards` is sanitized (`null`) for opponents.
 */
export const HandView: React.FC<HandViewProps> = ({
  cards,
  cardCount,
  faceDown = false,
  highlightedCardIds,
  size = 'md',
  fanAngleDeg = 6,
  onPlayCard,
  className = '',
}) => {
  const showFaceDown = faceDown || cards === null;
  const totalCount = showFaceDown
    ? (cardCount ?? cards?.length ?? 0)
    : (cards?.length ?? 0);

  if (totalCount === 0) {
    return (
      <div
        className={`inline-flex items-center justify-center px-3 py-2 rounded-xl border border-dashed border-slate-700/70 text-[11px] text-slate-500 ${className}`}
      >
        No Cards
      </div>
    );
  }

  const midpoint = (totalCount - 1) / 2;

  return (
    <div
      className={`inline-flex items-center justify-center ${className}`}
      style={{ perspective: '600px' }}
    >
      {Array.from({ length: totalCount }).map((_, idx) => {
        const card = !showFaceDown && cards ? cards[idx] : undefined;
        const offsetFromCenter = idx - midpoint;
        const rotateDeg = offsetFromCenter * fanAngleDeg;
        const translateY = Math.abs(offsetFromCenter) * 3;
        const isHighlighted =
          card !== undefined && (highlightedCardIds?.has(card.id) ?? false);

        return (
          <div
            key={card ? card.id : `facedown_${idx}`}
            style={{
              transform: `rotate(${rotateDeg}deg) translateY(${translateY}px)`,
              marginLeft: idx === 0 ? '0px' : size === 'sm' ? '-10px' : '-14px',
              zIndex: isHighlighted ? 30 : idx + 1,
            }}
            className="transition-transform duration-200 hover:z-40 hover:-translate-y-2"
          >
            <PlayingCard
              {...(card ? { card } : {})}
              faceDown={showFaceDown}
              highlighted={isHighlighted}
              size={size}
              {...(card && onPlayCard
                ? { onClick: () => onPlayCard(card) }
                : {})}
            />
          </div>
        );
      })}
    </div>
  );
};

