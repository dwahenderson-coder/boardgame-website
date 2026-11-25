import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ALL_RISK_TERRITORY_IDS,
  areRiskTerritoriesAdjacent,
  areTerritoriesConnectedByOwner,
  calculateTurnReinforcements,
  doesPlayerControlContinent,
  evaluateRiskCardSetValue,
  findValidCardSetInHand,
  getOwnedTerritories,
  isValidRiskCardSet,
  RISK_CONTINENTS,
  RISK_CONTINENTS_BY_ID,
  RISK_DASHED_SEA_CONNECTIONS,
  RISK_NEUTRAL_PLAYER_ID,
  RISK_TERRITORIES,
  RISK_TERRITORIES_BY_ID,
  RiskAction,
  RiskCard,
  RiskCardSymbol,
  RiskSanitizedGameState,
  RiskTerritoryId,
} from '../games/risk/index.js';

export interface RiskBoardProps {
  readonly state: RiskSanitizedGameState;
  readonly viewingPlayerId: string;
  readonly playerNames: Readonly<Record<string, string>>;
  readonly isSpectator: boolean;
  readonly onDispatchAction: (action: RiskAction) => void;
}

interface ColorPaletteEntry {
  readonly fill: string;
  readonly stroke: string;
  readonly badgeBg: string;
  readonly badgeText: string;
  readonly label: string;
}

const RISK_COLOR_PALETTE: Readonly<Record<string, ColorPaletteEntry>> = {
  red: {
    fill: '#ef4444',
    stroke: '#991b1b',
    badgeBg: '#b91c1c',
    badgeText: '#ffffff',
    label: 'Crimson',
  },
  blue: {
    fill: '#3b82f6',
    stroke: '#1e40af',
    badgeBg: '#1d4ed8',
    badgeText: '#ffffff',
    label: 'Cobalt',
  },
  green: {
    fill: '#22c55e',
    stroke: '#166534',
    badgeBg: '#15803d',
    badgeText: '#ffffff',
    label: 'Emerald',
  },
  yellow: {
    fill: '#eab308',
    stroke: '#854d0e',
    badgeBg: '#fde047',
    badgeText: '#0f172a',
    label: 'Gold',
  },
  purple: {
    fill: '#a855f7',
    stroke: '#581c87',
    badgeBg: '#7e22ce',
    badgeText: '#ffffff',
    label: 'Imperial Purple',
  },
  orange: {
    fill: '#f97316',
    stroke: '#9a3412',
    badgeBg: '#ea580c',
    badgeText: '#ffffff',
    label: 'Amber',
  },
  black: {
    fill: '#334155',
    stroke: '#0f172a',
    badgeBg: '#0f172a',
    badgeText: '#f8fafc',
    label: 'Obsidian',
  },
  white: {
    fill: '#f1f5f9',
    stroke: '#475569',
    badgeBg: '#f8fafc',
    badgeText: '#0f172a',
    label: 'Ivory',
  },
  brown: {
    fill: '#a16207',
    stroke: '#451a03',
    badgeBg: '#78350f',
    badgeText: '#ffffff',
    label: 'Bronze',
  },
  neutral: {
    fill: '#94a3b8',
    stroke: '#475569',
    badgeBg: '#475569',
    badgeText: '#f8fafc',
    label: 'Neutral Garrison',
  },
};

function getColorTheme(colorId: string | undefined): ColorPaletteEntry {
  if (!colorId) {
    return RISK_COLOR_PALETTE['neutral']!;
  }
  return RISK_COLOR_PALETTE[colorId] ?? RISK_COLOR_PALETTE['red']!;
}

function getCardSymbolMeta(symbol: RiskCardSymbol): {
  readonly icon: string;
  readonly label: string;
  readonly accent: string;
} {
  switch (symbol) {
    case 'INFANTRY':
      return { icon: '💂', label: 'Infantry', accent: '#38bdf8' };
    case 'CAVALRY':
      return { icon: '🐎', label: 'Cavalry', accent: '#fbbf24' };
    case 'ARTILLERY':
      return { icon: '💣', label: 'Artillery', accent: '#f87171' };
    case 'WILD':
      return { icon: '⭐', label: 'Wild (All 3)', accent: '#c084fc' };
  }
}

/**
 * Renders an authentic 6-sided pip die:
 * - WHITE die with dark pips for Attackers
 * - RED die with white pips for Defenders
 */
const RiskPipDie: React.FC<{
  readonly value: number;
  readonly side: 'ATTACKER' | 'DEFENDER';
  readonly size?: number;
  readonly highlight?: 'WIN' | 'LOSS' | 'NONE';
}> = ({ value, side, size = 44, highlight = 'NONE' }) => {
  const isAttacker = side === 'ATTACKER';
  const bgGradient = isAttacker
    ? 'linear-gradient(145deg, #ffffff 0%, #e2e8f0 100%)'
    : 'linear-gradient(145deg, #ef4444 0%, #b91c1c 100%)';
  const pipColor = isAttacker ? '#0f172a' : '#ffffff';
  const baseBorder = isAttacker ? '#94a3b8' : '#7f1d1d';
  const glowStyle =
    highlight === 'WIN'
      ? '0 0 0 2px #22c55e, 0 4px 10px rgba(34,197,94,0.35)'
      : highlight === 'LOSS'
        ? '0 0 0 2px rgba(148,163,184,0.45)'
        : '0 3px 8px rgba(0,0,0,0.35)';

  // 3x3 grid positions (0..8) for standard die faces 1..6
  const activeCellsByValue: Readonly<Record<number, readonly number[]>> = {
    1: [4],
    2: [2, 6],
    3: [2, 4, 6],
    4: [0, 2, 6, 8],
    5: [0, 2, 4, 6, 8],
    6: [0, 2, 3, 5, 6, 8],
  };
  const cells = activeCellsByValue[value] ?? [4];
  const pipSize = Math.max(5, Math.round(size * 0.17));

  return (
    <div
      title={`${isAttacker ? 'Attacker (White)' : 'Defender (Red)'} rolled ${value}`}
      style={{
        width: size,
        height: size,
        borderRadius: Math.round(size * 0.2),
        background: bgGradient,
        border: `2px solid ${baseBorder}`,
        boxShadow: glowStyle,
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gridTemplateRows: 'repeat(3, 1fr)',
        padding: Math.round(size * 0.14),
        boxSizing: 'border-box',
        opacity: highlight === 'LOSS' ? 0.72 : 1,
        flexShrink: 0,
      }}
    >
      {Array.from({ length: 9 }, (_, idx) => (
        <div
          key={idx}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {cells.includes(idx) && (
            <span
              style={{
                width: pipSize,
                height: pipSize,
                borderRadius: '50%',
                background: pipColor,
                boxShadow: isAttacker
                  ? 'inset 0 1px 1px rgba(0,0,0,0.4)'
                  : '0 1px 2px rgba(0,0,0,0.35)',
              }}
            />
          )}
        </div>
      ))}
    </div>
  );
};

export const RiskBoard: React.FC<RiskBoardProps> = ({
  state,
  viewingPlayerId,
  playerNames,
  isSpectator,
  onDispatchAction,
}) => {
  const activePlayerId = state.playerOrder[state.activePlayerIndex] ?? '';
  const isMyTurn = !isSpectator && viewingPlayerId === activePlayerId;
  const viewingPlayer = state.players[viewingPlayerId] ?? null;

  // Map Zoom & Pan state
  const [zoom, setZoom] = useState<number>(1);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const isDraggingRef = useRef(false);
  const dragMovedRef = useRef(false);
  const dragStartRef = useRef<{ x: number; y: number; panX: number; panY: number }>({
    x: 0,
    y: 0,
    panX: 0,
    panY: 0,
  });

  // Tactical Selection State
  const [selectedFromId, setSelectedFromId] = useState<RiskTerritoryId | null>(
    null
  );
  const [selectedToId, setSelectedToId] = useState<RiskTerritoryId | null>(null);
  const [hoveredTerritoryId, setHoveredTerritoryId] =
    useState<RiskTerritoryId | null>(null);

  // Attack Mode & Parameters
  const [attackMode, setAttackMode] = useState<'MANUAL' | 'AUTO'>('MANUAL');
  const [manualAttackerDice, setManualAttackerDice] = useState<1 | 2 | 3>(3);
  const [blitzMinKeep, setBlitzMinKeep] = useState<number>(1);

  // Reinforcement Batch Selector
  const [deployBatchSize, setDeployBatchSize] = useState<1 | 5 | 999>(1);

  // Conquest & Fortify Army Count Sliders
  const [conquestMoveCount, setConquestMoveCount] = useState<number>(1);
  const [fortifyCount, setFortifyCount] = useState<number>(1);

  // Card Drawer & Selection
  const [selectedCardIds, setSelectedCardIds] = useState<string[]>([]);
  const [chosenBonusTerritoryId, setChosenBonusTerritoryId] = useState<
    RiskTerritoryId | ''
  >('');
  const [showCardsModal, setShowCardsModal] = useState<boolean>(false);
  const [showSecretMission, setShowSecretMission] = useState<boolean>(false);

  const displayName = (pid: string): string => {
    if (pid === RISK_NEUTRAL_PLAYER_ID) return 'Neutral Garrison';
    return playerNames[pid] ?? pid;
  };

  // Sync conquestMoveCount when pendingConquest appears
  useEffect(() => {
    if (state.pendingConquest) {
      setConquestMoveCount(state.pendingConquest.maxArmiesToMove);
    }
  }, [state.pendingConquest]);

  // Auto-open card drawer when forced to trade cards
  useEffect(() => {
    if (
      isMyTurn &&
      (state.turnStep === 'FORCED_CARD_TRADE' ||
        (state.turnStep === 'REINFORCE' &&
          (viewingPlayer?.cards?.length ?? 0) >= 5))
    ) {
      setShowCardsModal(true);
    }
  }, [isMyTurn, state.turnStep, viewingPlayer?.cards?.length]);

  // Clear territory selections when turnStep or active player changes
  useEffect(() => {
    setSelectedFromId(null);
    setSelectedToId(null);
  }, [state.turnStep, activePlayerId]);

  // Clamp manualAttackerDice & blitzMinKeep when selectedFromId armies change
  const selectedFromState = selectedFromId
    ? state.territories[selectedFromId]
    : null;
  const selectedToState = selectedToId ? state.territories[selectedToId] : null;

  useEffect(() => {
    if (selectedFromState && selectedFromState.armies >= 2) {
      const maxDice = Math.min(3, selectedFromState.armies - 1) as 1 | 2 | 3;
      setManualAttackerDice(maxDice);
      setBlitzMinKeep((prev) =>
        Math.min(Math.max(1, prev), selectedFromState.armies - 1)
      );
      setFortifyCount(Math.max(1, selectedFromState.armies - 1));
    }
  }, [selectedFromId, selectedFromState?.armies]);

  // Valid targets for ATTACK or FORTIFY when selectedFromId is chosen
  const validTargetTerritoryIds = useMemo<ReadonlySet<RiskTerritoryId>>(() => {
    if (!selectedFromId) return new Set();
    if (state.turnStep === 'ATTACK') {
      const adj = RISK_TERRITORIES_BY_ID[selectedFromId].adjacentIds;
      return new Set(
        adj.filter((tid) => {
          const owner = state.territories[tid].ownerId;
          return owner !== null && owner !== activePlayerId;
        })
      );
    }
    if (state.turnStep === 'FORTIFY') {
      return new Set(
        ALL_RISK_TERRITORY_IDS.filter(
          (tid) =>
            tid !== selectedFromId &&
            state.territories[tid].ownerId === activePlayerId &&
            areTerritoriesConnectedByOwner(
              state.territories,
              activePlayerId,
              selectedFromId,
              tid
            )
        )
      );
    }
    return new Set();
  }, [selectedFromId, state.turnStep, state.territories, activePlayerId]);

  // Card Trade helpers
  const myHand: readonly RiskCard[] = viewingPlayer?.cards ?? [];
  const selectedCardObjects = useMemo(
    () =>
      selectedCardIds
        .map((id) => myHand.find((c) => c.id === id))
        .filter((c): c is RiskCard => c !== undefined),
    [selectedCardIds, myHand]
  );
  const canTradeNow =
    isMyTurn &&
    (state.turnStep === 'REINFORCE' || state.turnStep === 'FORCED_CARD_TRADE');
  const selectedSetValid =
    selectedCardObjects.length === 3 && isValidRiskCardSet(selectedCardObjects);
  const selectedSetBonusValue = selectedSetValid
    ? evaluateRiskCardSetValue(
        selectedCardObjects,
        state.cardTradeMode,
        state.setsTradedCount
      )
    : 0;
  const matchingOwnedCardTerritories = useMemo(
    () =>
      selectedCardObjects
        .map((c) => c.territoryId)
        .filter(
          (tid): tid is RiskTerritoryId =>
            tid !== null && state.territories[tid].ownerId === viewingPlayerId
        ),
    [selectedCardObjects, state.territories, viewingPlayerId]
  );

  const handleToggleCardSelection = (cardId: string) => {
    setSelectedCardIds((prev) => {
      if (prev.includes(cardId)) {
        return prev.filter((id) => id !== cardId);
      }
      if (prev.length >= 3) {
        return [...prev.slice(1), cardId];
      }
      return [...prev, cardId];
    });
  };

  const handleAutoPickValidSet = () => {
    const found = findValidCardSetInHand(myHand);
    if (found) {
      setSelectedCardIds([...found]);
    }
  };

  const handleTradeSelectedCards = () => {
    if (!selectedSetValid || selectedCardIds.length !== 3) return;
    const tuple: readonly [string, string, string] = [
      selectedCardIds[0]!,
      selectedCardIds[1]!,
      selectedCardIds[2]!,
    ];
    const bonusTid =
      chosenBonusTerritoryId &&
      matchingOwnedCardTerritories.includes(chosenBonusTerritoryId)
        ? chosenBonusTerritoryId
        : matchingOwnedCardTerritories[0];

    onDispatchAction({
      type: 'RISK_TRADE_CARDS',
      cardIds: tuple,
      ...(bonusTid !== undefined ? { bonusTerritoryId: bonusTid } : {}),
    });
    setSelectedCardIds([]);
    setChosenBonusTerritoryId('');
  };

  // Map Click Handler
  const handleTerritoryClick = (tid: RiskTerritoryId) => {
    if (dragMovedRef.current) return;
    if (!isMyTurn) return;

    const terr = state.territories[tid];

    if (state.turnStep === 'SETUP_CLAIM') {
      if (terr.ownerId === null) {
        onDispatchAction({ type: 'RISK_CLAIM_TERRITORY', territoryId: tid });
      }
      return;
    }

    if (state.turnStep === 'SETUP_PLACE') {
      if (terr.ownerId === viewingPlayerId) {
        onDispatchAction({
          type: 'RISK_PLACE_INITIAL_ARMY',
          territoryId: tid,
        });
      }
      return;
    }

    if (state.turnStep === 'CHOOSE_CAPITAL') {
      if (terr.ownerId === viewingPlayerId) {
        onDispatchAction({ type: 'RISK_CHOOSE_CAPITAL', territoryId: tid });
      }
      return;
    }

    if (state.turnStep === 'REINFORCE') {
      if (myHand.length >= 5) {
        setShowCardsModal(true);
        return;
      }
      if (
        terr.ownerId === viewingPlayerId &&
        (viewingPlayer?.unplacedArmies ?? 0) > 0
      ) {
        const count = Math.min(
          deployBatchSize,
          viewingPlayer?.unplacedArmies ?? 1
        );
        onDispatchAction({
          type: 'RISK_PLACE_REINFORCEMENTS',
          territoryId: tid,
          count,
        });
      }
      return;
    }

    if (state.turnStep === 'ATTACK') {
      if (terr.ownerId === viewingPlayerId) {
        if (terr.armies >= 2) {
          setSelectedFromId((prev) => (prev === tid ? null : tid));
          setSelectedToId(null);
        }
        return;
      }
      if (
        selectedFromId &&
        terr.ownerId !== viewingPlayerId &&
        areRiskTerritoriesAdjacent(selectedFromId, tid)
      ) {
        setSelectedToId(tid);
      }
      return;
    }

    if (state.turnStep === 'FORTIFY') {
      if (!selectedFromId) {
        if (terr.ownerId === viewingPlayerId && terr.armies >= 2) {
          setSelectedFromId(tid);
          setSelectedToId(null);
        }
        return;
      }
      if (tid === selectedFromId) {
        setSelectedFromId(null);
        setSelectedToId(null);
        return;
      }
      if (validTargetTerritoryIds.has(tid)) {
        setSelectedToId(tid);
      } else if (terr.ownerId === viewingPlayerId && terr.armies >= 2) {
        setSelectedFromId(tid);
        setSelectedToId(null);
      }
    }
  };

  // Zoom / Pan Handlers
  const adjustZoom = (delta: number) => {
    setZoom((prev) => {
      const next = Math.min(2.5, Math.max(1, Number((prev + delta).toFixed(2))));
      if (next === 1) {
        setPan({ x: 0, y: 0 });
      }
      return next;
    });
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (zoom <= 1) return;
    isDraggingRef.current = true;
    dragMovedRef.current = false;
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      panX: pan.x,
      panY: pan.y,
    };
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current) return;
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) {
      dragMovedRef.current = true;
    }
    const maxOffset = (zoom - 1) * 380;
    setPan({
      x: Math.max(-maxOffset, Math.min(maxOffset, dragStartRef.current.panX + dx)),
      y: Math.max(-maxOffset * 0.6, Math.min(maxOffset * 0.6, dragStartRef.current.panY + dy)),
    });
  };

  const handleMouseUp = () => {
    isDraggingRef.current = false;
    setTimeout(() => {
      dragMovedRef.current = false;
    }, 30);
  };

  const isDefenderPromptForMe =
    !isSpectator &&
    state.turnStep === 'AWAITING_DEFENDER_DICE' &&
    state.pendingDefense?.defenderId === viewingPlayerId;

  // Step Instruction Banner Text
  const stepBannerText = useMemo(() => {
    const commander = displayName(activePlayerId);
    switch (state.turnStep) {
      case 'SETUP_CLAIM':
        return isMyTurn
          ? 'Click any unclaimed territory on the map to claim it (+1 army).'
          : `Waiting for ${commander} to claim a territory...`;
      case 'SETUP_PLACE':
        return isMyTurn
          ? `Click one of your territories to place 1 starting army (${viewingPlayer?.unplacedArmies ?? 0} remaining).`
          : `Waiting for ${commander} to deploy starting armies...`;
      case 'CHOOSE_CAPITAL':
        return isMyTurn
          ? '🏛️ Click any territory you control to establish your Capital Headquarters!'
          : `Waiting for ${commander} to choose their Capital Headquarters...`;
      case 'REINFORCE':
        if (isMyTurn && myHand.length >= 5) {
          return '🃏 You hold 5+ Risk cards — trade in a 3-card set before deploying reinforcements!';
        }
        return isMyTurn
          ? `Deploy ${viewingPlayer?.unplacedArmies ?? 0} reinforcement army/armies onto territories you control.`
          : `${commander} is deploying reinforcements...`;
      case 'ATTACK':
        return isMyTurn
          ? selectedFromId
            ? selectedToId
              ? `Ready to attack ${RISK_TERRITORIES_BY_ID[selectedToId].name} from ${RISK_TERRITORIES_BY_ID[selectedFromId].name}! Choose Manual or Auto Blitz.`
              : `Select an adjacent glowing enemy territory to attack from ${RISK_TERRITORIES_BY_ID[selectedFromId].name}.`
            : 'Select one of your territories with 2+ armies to launch an attack, or End Attacks to fortify.'
          : `${commander} is planning attacks...`;
      case 'AWAITING_DEFENDER_DICE': {
        const defId = state.pendingDefense?.defenderId ?? '';
        const toName = state.pendingDefense
          ? RISK_TERRITORIES_BY_ID[state.pendingDefense.toTerritoryId].name
          : '';
        return defId === viewingPlayerId
          ? `🛡️ ${displayName(activePlayerId)} is attacking ${toName}! Choose 1 or 2 Red Defense Dice.`
          : `Waiting for ${displayName(defId)} to roll defense dice for ${toName}...`;
      }
      case 'CONQUEST_MOVE':
        return isMyTurn
          ? '🎖️ Territory conquered! Choose how many armies to advance into the captured territory.'
          : `${commander} is advancing troops into conquered territory...`;
      case 'FORCED_CARD_TRADE':
        return isMyTurn
          ? '🃏 Eliminating a rival pushed your hand to 5+ cards! Trade in sets until you hold fewer than 5 cards.'
          : `${commander} is trading in captured Risk cards...`;
      case 'FORTIFY':
        return isMyTurn
          ? selectedFromId
            ? selectedToId
              ? `Choose how many armies to fortify from ${RISK_TERRITORIES_BY_ID[selectedFromId].name} to ${RISK_TERRITORIES_BY_ID[selectedToId].name}.`
              : `Click any connected emerald-highlighted territory to move armies from ${RISK_TERRITORIES_BY_ID[selectedFromId].name}, or End Turn.`
            : 'Optional Fortify: Click one of your territories (2+ armies) to relocate troops along a connected chain, or End Turn.'
          : `${commander} is fortifying positions...`;
      case 'GAME_OVER':
        return state.victoryReason ?? 'Game Over!';
    }
  }, [
    state.turnStep,
    state.pendingDefense,
    state.victoryReason,
    activePlayerId,
    isMyTurn,
    viewingPlayerId,
    viewingPlayer?.unplacedArmies,
    myHand.length,
    selectedFromId,
    selectedToId,
  ]);

  const lastCombat = state.lastCombat;
  const lastVolley =
    lastCombat && lastCombat.volleys.length > 0
      ? lastCombat.volleys[lastCombat.volleys.length - 1]!
      : null;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '0.75rem',
        color: '#f8fafc',
        userSelect: 'none',
      }}
    >
      {/* ==================== TOP COMMANDER BAR ==================== */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '0.65rem',
          padding: '0.65rem 0.9rem',
          background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
          border: '1px solid #334155',
          borderRadius: '12px',
          boxShadow: '0 6px 18px rgba(0,0,0,0.35)',
        }}
      >
        {/* Mode Badges & Turn Status */}
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.5rem' }}>
          <span
            style={{
              padding: '0.25rem 0.65rem',
              borderRadius: '999px',
              background: '#7f1d1d',
              border: '1px solid #ef4444',
              fontSize: '0.76rem',
              fontWeight: 800,
              letterSpacing: '0.04em',
            }}
          >
            🌍 {state.winCondition === 'CAPITAL'
              ? 'CAPITAL RISK'
              : state.winCondition === 'SECRET_MISSION'
                ? 'SECRET MISSION'
                : 'WORLD DOMINATION'}
          </span>
          <span
            style={{
              padding: '0.25rem 0.6rem',
              borderRadius: '999px',
              background: '#1e293b',
              border: '1px solid #475569',
              fontSize: '0.75rem',
              color: '#cbd5e1',
            }}
          >
            🃏 Cards:{' '}
            {state.cardTradeMode === 'ESCALATING'
              ? `Escalating (Next: +${state.nextEscalatingSetValue})`
              : 'Fixed (4 / 6 / 8 / 10)'}
          </span>
          <span
            style={{
              padding: '0.25rem 0.65rem',
              borderRadius: '999px',
              background: '#0f172a',
              border: '1px solid #475569',
              fontSize: '0.75rem',
              color: '#94a3b8',
            }}
          >
            Round {state.roundNumber} • Step:{' '}
            <strong style={{ color: '#fbbf24' }}>
              {state.turnStep.replace(/_/g, ' ')}
            </strong>
          </span>
        </div>

        {/* Personal Defense Mode Toggle + Cards + Secret Mission Buttons */}
        {!isSpectator && viewingPlayer && !viewingPlayer.isNeutral && (
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              gap: '0.5rem',
            }}
          >
            {/* Defense Mode Toggle (Auto vs Manual) */}
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                background: '#020617',
                border: '1px solid #475569',
                borderRadius: '8px',
                padding: '2px',
              }}
              title="Choose whether your territories roll defense dice automatically (Max Red Dice) or pause so you manually choose 1 or 2 Red Dice."
            >
              <span
                style={{
                  fontSize: '0.72rem',
                  color: '#94a3b8',
                  padding: '0 0.45rem',
                  fontWeight: 700,
                }}
              >
                Defense:
              </span>
              <button
                type="button"
                onClick={() =>
                  onDispatchAction({
                    type: 'RISK_SET_DEFENSE_MODE',
                    autoDefend: true,
                  })
                }
                style={{
                  padding: '0.25rem 0.55rem',
                  fontSize: '0.74rem',
                  fontWeight: 700,
                  borderRadius: '6px',
                  border: 'none',
                  cursor: 'pointer',
                  background: viewingPlayer.autoDefend ? '#dc2626' : 'transparent',
                  color: viewingPlayer.autoDefend ? '#ffffff' : '#94a3b8',
                }}
              >
                ⚡ Auto
              </button>
              <button
                type="button"
                onClick={() =>
                  onDispatchAction({
                    type: 'RISK_SET_DEFENSE_MODE',
                    autoDefend: false,
                  })
                }
                style={{
                  padding: '0.25rem 0.55rem',
                  fontSize: '0.74rem',
                  fontWeight: 700,
                  borderRadius: '6px',
                  border: 'none',
                  cursor: 'pointer',
                  background: !viewingPlayer.autoDefend ? '#dc2626' : 'transparent',
                  color: !viewingPlayer.autoDefend ? '#ffffff' : '#94a3b8',
                }}
              >
                🎲 Manual
              </button>
            </div>

            {/* Territory Cards Button */}
            <button
              type="button"
              onClick={() => setShowCardsModal((v) => !v)}
              style={{
                padding: '0.32rem 0.7rem',
                borderRadius: '8px',
                border:
                  myHand.length >= 5
                    ? '2px solid #fbbf24'
                    : '1px solid #475569',
                background:
                  myHand.length >= 3
                    ? 'linear-gradient(135deg, #854d0e 0%, #a16207 100%)'
                    : '#1e293b',
                color: '#ffffff',
                fontSize: '0.78rem',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              🃏 Cards ({myHand.length})
            </button>

            {/* Secret Mission Button */}
            {state.winCondition === 'SECRET_MISSION' &&
              viewingPlayer.secretMission && (
                <button
                  type="button"
                  onClick={() => setShowSecretMission((v) => !v)}
                  style={{
                    padding: '0.32rem 0.7rem',
                    borderRadius: '8px',
                    border: '1px solid #a855f7',
                    background: showSecretMission ? '#6b21a8' : '#3b0764',
                    color: '#f3e8ff',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  🕵️ {showSecretMission ? 'Hide Mission' : 'Secret Mission'}
                </button>
              )}
          </div>
        )}
      </div>

      {/* ==================== SECRET MISSION CALLOUT ==================== */}
      {showSecretMission && viewingPlayer?.secretMission && (
        <div
          style={{
            padding: '0.75rem 1rem',
            borderRadius: '10px',
            background: 'linear-gradient(135deg, #2e1065 0%, #4c1d95 100%)',
            border: '1px solid #c084fc',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '1rem',
          }}
        >
          <div>
            <div
              style={{
                fontSize: '0.72rem',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                color: '#d8b4fe',
                fontWeight: 800,
              }}
            >
              🕵️ Classified Orders (Visible Only to You)
            </div>
            <div style={{ fontSize: '0.96rem', fontWeight: 800, marginTop: '2px' }}>
              {viewingPlayer.secretMission.title}
            </div>
            <div style={{ fontSize: '0.82rem', color: '#e9d5ff' }}>
              {viewingPlayer.secretMission.description}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowSecretMission(false)}
            style={{
              background: 'rgba(15,23,42,0.5)',
              border: '1px solid #c084fc',
              color: '#f3e8ff',
              borderRadius: '6px',
              padding: '0.3rem 0.6rem',
              cursor: 'pointer',
              fontSize: '0.78rem',
            }}
          >
            Close
          </button>
        </div>
      )}

      {/* ==================== COMMANDERS ROSTER STRIP ==================== */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(175px, 1fr))',
          gap: '0.5rem',
        }}
      >
        {Object.values(state.players).map((p) => {
          const theme = getColorTheme(p.color);
          const isActive = p.id === activePlayerId && state.phase !== 'GAME_OVER';
          const ownedCount = getOwnedTerritories(state.territories, p.id).length;
          const totalTroops = getOwnedTerritories(state.territories, p.id).reduce(
            (sum, t) => sum + t.armies,
            0
          );
          const nextIncome = p.isNeutral
            ? 0
            : calculateTurnReinforcements(state.territories, p.id);

          return (
            <div
              key={p.id}
              style={{
                padding: '0.5rem 0.7rem',
                borderRadius: '10px',
                background: isActive
                  ? 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)'
                  : '#0f172a',
                border: isActive
                  ? `2px solid ${theme.fill}`
                  : '1px solid #334155',
                opacity: p.eliminated ? 0.45 : 1,
                display: 'flex',
                flexDirection: 'column',
                gap: '0.2rem',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '0.4rem',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                  <span
                    style={{
                      width: 13,
                      height: 13,
                      borderRadius: '50%',
                      background: theme.fill,
                      border: `2px solid ${theme.stroke}`,
                      display: 'inline-block',
                      flexShrink: 0,
                    }}
                  />
                  <strong
                    style={{
                      fontSize: '0.83rem',
                      textDecoration: p.eliminated ? 'line-through' : 'none',
                    }}
                  >
                    {displayName(p.id)}
                  </strong>
                </div>
                {isActive && (
                  <span
                    style={{
                      fontSize: '0.66rem',
                      fontWeight: 800,
                      padding: '1px 6px',
                      borderRadius: '999px',
                      background: theme.badgeBg,
                      color: theme.badgeText,
                    }}
                  >
                    TURN
                  </span>
                )}
              </div>
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '0.55rem',
                  fontSize: '0.73rem',
                  color: '#cbd5e1',
                }}
              >
                <span>🗺️ {ownedCount}</span>
                <span>💂 {totalTroops}</span>
                {!p.isNeutral && <span>🃏 {p.cardCount}</span>}
                {!p.isNeutral && !p.eliminated && (
                  <span style={{ color: '#4ade80' }}>+{nextIncome}/turn</span>
                )}
                {!p.isNeutral && (
                  <span
                    title={
                      p.autoDefend
                        ? 'Auto-Defend enabled'
                        : 'Manual Defense enabled'
                    }
                    style={{ color: p.autoDefend ? '#94a3b8' : '#f87171' }}
                  >
                    {p.autoDefend ? '🛡️Auto' : '🎲Manual'}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* ==================== ACTION BAR & STEP INSTRUCTIONS ==================== */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '0.65rem',
          padding: '0.6rem 0.9rem',
          borderRadius: '10px',
          background: isMyTurn
            ? 'linear-gradient(135deg, #172554 0%, #1e293b 100%)'
            : '#0f172a',
          border: isMyTurn ? '1px solid #3b82f6' : '1px solid #334155',
        }}
      >
        <div style={{ fontSize: '0.86rem', fontWeight: 600 }}>{stepBannerText}</div>

        {/* Contextual Action Controls for Active Commander */}
        {isMyTurn && (
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.5rem' }}>
            {(state.turnStep === 'SETUP_CLAIM' ||
              state.turnStep === 'SETUP_PLACE') && (
              <button
                type="button"
                onClick={() =>
                  onDispatchAction({ type: 'RISK_AUTO_FINISH_SETUP' })
                }
                style={{
                  padding: '0.38rem 0.8rem',
                  borderRadius: '8px',
                  border: '1px solid #fbbf24',
                  background: '#854d0e',
                  color: '#fef08a',
                  fontWeight: 700,
                  fontSize: '0.78rem',
                  cursor: 'pointer',
                }}
              >
                ⚡ Quick-Deploy Remaining Setup
              </button>
            )}

            {state.turnStep === 'REINFORCE' && (
              <>
                <div
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '3px',
                    background: '#0f172a',
                    padding: '2px',
                    borderRadius: '7px',
                    border: '1px solid #475569',
                  }}
                >
                  <span
                    style={{
                      fontSize: '0.72rem',
                      color: '#94a3b8',
                      padding: '0 5px',
                    }}
                  >
                    Click adds:
                  </span>
                  {(
                    [
                      { label: '+1', val: 1 },
                      { label: '+5', val: 5 },
                      { label: 'All', val: 999 },
                    ] as const
                  ).map((opt) => (
                    <button
                      key={opt.val}
                      type="button"
                      onClick={() => setDeployBatchSize(opt.val)}
                      style={{
                        padding: '0.2rem 0.5rem',
                        borderRadius: '5px',
                        border: 'none',
                        cursor: 'pointer',
                        fontSize: '0.74rem',
                        fontWeight: 700,
                        background:
                          deployBatchSize === opt.val ? '#2563eb' : 'transparent',
                        color:
                          deployBatchSize === opt.val ? '#ffffff' : '#cbd5e1',
                      }}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                {myHand.length >= 3 && (
                  <button
                    type="button"
                    onClick={() => setShowCardsModal(true)}
                    style={{
                      padding: '0.38rem 0.75rem',
                      borderRadius: '8px',
                      border: '1px solid #fbbf24',
                      background: '#a16207',
                      color: '#ffffff',
                      fontWeight: 700,
                      fontSize: '0.78rem',
                      cursor: 'pointer',
                    }}
                  >
                    🃏 Trade Card Set
                  </button>
                )}
              </>
            )}

            {state.turnStep === 'ATTACK' && (
              <>
                <button
                  type="button"
                  onClick={() => onDispatchAction({ type: 'RISK_END_ATTACKS' })}
                  style={{
                    padding: '0.4rem 0.85rem',
                    borderRadius: '8px',
                    border: '1px solid #38bdf8',
                    background: '#0369a1',
                    color: '#ffffff',
                    fontWeight: 700,
                    fontSize: '0.8rem',
                    cursor: 'pointer',
                  }}
                >
                  🛡️ End Attacks → Fortify
                </button>
                <button
                  type="button"
                  onClick={() => onDispatchAction({ type: 'RISK_END_TURN' })}
                  style={{
                    padding: '0.4rem 0.85rem',
                    borderRadius: '8px',
                    border: '1px solid #64748b',
                    background: '#334155',
                    color: '#f8fafc',
                    fontWeight: 700,
                    fontSize: '0.8rem',
                    cursor: 'pointer',
                  }}
                >
                  ⏭️ End Turn
                </button>
              </>
            )}

            {state.turnStep === 'FORTIFY' && (
              <button
                type="button"
                onClick={() => onDispatchAction({ type: 'RISK_END_TURN' })}
                style={{
                  padding: '0.42rem 0.9rem',
                  borderRadius: '8px',
                  border: '1px solid #22c55e',
                  background: '#15803d',
                  color: '#ffffff',
                  fontWeight: 800,
                  fontSize: '0.82rem',
                  cursor: 'pointer',
                }}
              >
                ✅ Skip Fortify & End Turn
              </button>
            )}
          </div>
        )}
      </div>

      {/* ==================== MAIN LAYOUT: WORLD MAP + TACTICAL SIDEBAR ==================== */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) 330px',
          gap: '0.75rem',
          alignItems: 'start',
        }}
      >
        {/* ==================== INTERACTIVE WORLD MAP ==================== */}
        <div
          style={{
            position: 'relative',
            background: 'radial-gradient(circle at 50% 45%, #0c4a6e 0%, #082f49 65%, #020617 100%)',
            border: '2px solid #334155',
            borderRadius: '14px',
            overflow: 'hidden',
            boxShadow: 'inset 0 0 40px rgba(0,0,0,0.55), 0 8px 24px rgba(0,0,0,0.4)',
          }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          {/* Floating Zoom Controls */}
          <div
            style={{
              position: 'absolute',
              top: 10,
              right: 10,
              zIndex: 10,
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              background: 'rgba(15, 23, 42, 0.88)',
              border: '1px solid #475569',
              borderRadius: '8px',
              padding: '4px 6px',
            }}
          >
            <button
              type="button"
              onClick={() => adjustZoom(-0.25)}
              disabled={zoom <= 1}
              style={{
                width: 26,
                height: 26,
                borderRadius: '5px',
                border: '1px solid #475569',
                background: '#1e293b',
                color: '#f8fafc',
                cursor: zoom > 1 ? 'pointer' : 'not-allowed',
                fontWeight: 800,
              }}
            >
              −
            </button>
            <span
              style={{
                fontSize: '0.74rem',
                fontWeight: 700,
                minWidth: 42,
                textAlign: 'center',
                color: '#e2e8f0',
              }}
            >
              {Math.round(zoom * 100)}%
            </span>
            <button
              type="button"
              onClick={() => adjustZoom(0.25)}
              disabled={zoom >= 2.5}
              style={{
                width: 26,
                height: 26,
                borderRadius: '5px',
                border: '1px solid #475569',
                background: '#1e293b',
                color: '#f8fafc',
                cursor: zoom < 2.5 ? 'pointer' : 'not-allowed',
                fontWeight: 800,
              }}
            >
              +
            </button>
            {zoom > 1 && (
              <button
                type="button"
                onClick={() => {
                  setZoom(1);
                  setPan({ x: 0, y: 0 });
                }}
                style={{
                  padding: '0 6px',
                  height: 26,
                  borderRadius: '5px',
                  border: '1px solid #475569',
                  background: '#334155',
                  color: '#f8fafc',
                  cursor: 'pointer',
                  fontSize: '0.7rem',
                }}
              >
                Reset
              </button>
            )}
          </div>

          <svg
            viewBox="0 0 1200 660"
            style={{
              width: '100%',
              height: 'auto',
              display: 'block',
              cursor: zoom > 1 ? 'grab' : 'default',
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              transformOrigin: 'center center',
              transition: isDraggingRef.current ? 'none' : 'transform 0.15s ease-out',
            }}
          >
            {/* Subtle Ocean Latitude / Longitude Grid */}
            <g stroke="rgba(148, 163, 184, 0.12)" strokeWidth={1}>
              {[110, 220, 330, 440, 550].map((y) => (
                <line key={`lat_${y}`} x1={0} y1={y} x2={1200} y2={y} />
              ))}
              {[200, 400, 600, 800, 1000].map((x) => (
                <line key={`lon_${x}`} x1={x} y1={0} x2={x} y2={660} />
              ))}
            </g>

            {/* ==================== DASHED SEA-ROUTE CONNECTIONS ==================== */}
            <g>
              {RISK_DASHED_SEA_CONNECTIONS.map((sea) => {
                const isHighlighted =
                  selectedFromId === sea.fromTerritoryId ||
                  selectedFromId === sea.toTerritoryId ||
                  hoveredTerritoryId === sea.fromTerritoryId ||
                  hoveredTerritoryId === sea.toTerritoryId;

                const polyPoints = sea.points
                  .map((pt) => `${pt.x},${pt.y}`)
                  .join(' ');

                return (
                  <g key={sea.id}>
                    {/* Dark halo under dashed line for contrast */}
                    <polyline
                      points={polyPoints}
                      fill="none"
                      stroke="rgba(2, 6, 23, 0.75)"
                      strokeWidth={isHighlighted ? 5 : 3.5}
                      strokeLinecap="round"
                    />
                    <polyline
                      points={polyPoints}
                      fill="none"
                      stroke={isHighlighted ? '#fbbf24' : '#bae6fd'}
                      strokeWidth={isHighlighted ? 3 : 2}
                      strokeDasharray="6 5"
                      strokeLinecap="round"
                    />
                    {sea.wrapLabel && (
                      <text
                        x={sea.wrapLabel.x}
                        y={sea.wrapLabel.y}
                        textAnchor={sea.wrapLabel.align}
                        fill="#fde047"
                        fontSize={11}
                        fontWeight={800}
                        style={{
                          paintOrder: 'stroke',
                          stroke: '#020617',
                          strokeWidth: 3,
                        }}
                      >
                        {sea.wrapLabel.text}
                      </text>
                    )}
                  </g>
                );
              })}
            </g>

            {/* ==================== 42 TERRITORY POLYGONS ==================== */}
            <g>
              {RISK_TERRITORIES.map((meta) => {
                const tState = state.territories[meta.id];
                const continent = RISK_CONTINENTS_BY_ID[meta.continentId];
                const owner = tState.ownerId ? state.players[tState.ownerId] : null;
                const ownerTheme = owner ? getColorTheme(owner.color) : null;

                const isSelectedFrom = selectedFromId === meta.id;
                const isSelectedTo = selectedToId === meta.id;
                const isValidTarget = validTargetTerritoryIds.has(meta.id);
                const isHovered = hoveredTerritoryId === meta.id;
                const isUnclaimedClickable =
                  isMyTurn &&
                  state.turnStep === 'SETUP_CLAIM' &&
                  tState.ownerId === null;

                const fill = ownerTheme
                  ? ownerTheme.fill
                  : continent.baseTint;
                const fillOpacity = ownerTheme
                  ? isSelectedFrom || isSelectedTo
                    ? 0.96
                    : isHovered
                      ? 0.88
                      : 0.76
                  : isUnclaimedClickable && isHovered
                    ? 0.65
                    : 0.35;

                const strokeColor = isSelectedFrom
                  ? '#ffffff'
                  : isSelectedTo
                    ? '#fde047'
                    : isValidTarget
                      ? state.turnStep === 'FORTIFY'
                        ? '#4ade80'
                        : '#fbbf24'
                      : continent.borderAccent;

                const strokeWidth =
                  isSelectedFrom || isSelectedTo
                    ? 3.6
                    : isValidTarget
                      ? 2.8
                      : 1.7;

                return (
                  <path
                    key={meta.id}
                    d={meta.svgPath}
                    fill={fill}
                    fillOpacity={fillOpacity}
                    stroke={strokeColor}
                    strokeWidth={strokeWidth}
                    strokeLinejoin="round"
                    style={{
                      cursor: isMyTurn ? 'pointer' : 'default',
                      transition: 'fill-opacity 0.12s ease, stroke-width 0.12s ease',
                    }}
                    onMouseEnter={() => setHoveredTerritoryId(meta.id)}
                    onMouseLeave={() =>
                      setHoveredTerritoryId((prev) =>
                        prev === meta.id ? null : prev
                      )
                    }
                    onClick={() => handleTerritoryClick(meta.id)}
                  >
                    <title>
                      {`${meta.name} (${continent.name})\nOwner: ${tState.ownerId ? displayName(tState.ownerId) : 'Unclaimed'}\nArmies: ${tState.armies}`}
                    </title>
                  </path>
                );
              })}
            </g>

            {/* ==================== ACTIVE ATTACK / FORTIFY VECTOR LINE ==================== */}
            {selectedFromId && selectedToId && (
              <g pointerEvents="none">
                {(() => {
                  const fromC = RISK_TERRITORIES_BY_ID[selectedFromId].center;
                  const toC = RISK_TERRITORIES_BY_ID[selectedToId].center;
                  const isWrap = Math.abs(fromC.x - toC.x) > 650;
                  if (isWrap) return null;
                  return (
                    <line
                      x1={fromC.x}
                      y1={fromC.y}
                      x2={toC.x}
                      y2={toC.y}
                      stroke={state.turnStep === 'FORTIFY' ? '#4ade80' : '#fde047'}
                      strokeWidth={4}
                      strokeDasharray="8 5"
                    />
                  );
                })()}
              </g>
            )}

            {/* ==================== CONTINENT BONUS BANNERS ==================== */}
            <g pointerEvents="none">
              {RISK_CONTINENTS.map((c) => {
                const controllerId = state.playerOrder.find((pid) =>
                  doesPlayerControlContinent(state.territories, pid, c.id)
                );
                const controllerTheme = controllerId
                  ? getColorTheme(state.players[controllerId]?.color)
                  : null;

                return (
                  <g
                    key={c.id}
                    transform={`translate(${c.badgePosition.x}, ${c.badgePosition.y})`}
                  >
                    <rect
                      x={-64}
                      y={-12}
                      width={128}
                      height={22}
                      rx={11}
                      fill={
                        controllerTheme
                          ? controllerTheme.badgeBg
                          : 'rgba(15, 23, 42, 0.82)'
                      }
                      stroke={controllerTheme ? '#fde047' : c.borderAccent}
                      strokeWidth={controllerTheme ? 2 : 1.3}
                    />
                    <text
                      x={0}
                      y={3}
                      textAnchor="middle"
                      fill={controllerTheme ? controllerTheme.badgeText : '#e2e8f0'}
                      fontSize={10}
                      fontWeight={800}
                    >
                      {c.name} (+{c.bonusArmies})
                    </text>
                  </g>
                );
              })}
            </g>

            {/* ==================== TERRITORY LABELS, CAPITALS & ARMY MEDALLIONS ==================== */}
            <g pointerEvents="none">
              {RISK_TERRITORIES.map((meta) => {
                const tState = state.territories[meta.id];
                const owner = tState.ownerId ? state.players[tState.ownerId] : null;
                const theme = owner ? getColorTheme(owner.color) : null;
                const isCapital = Boolean(state.capitalOwnerByTerritory[meta.id]);
                const isValidTarget = validTargetTerritoryIds.has(meta.id);
                const isSelected =
                  selectedFromId === meta.id || selectedToId === meta.id;

                return (
                  <g
                    key={`label_${meta.id}`}
                    transform={`translate(${meta.center.x}, ${meta.center.y})`}
                  >
                    {/* Target Pulse Halo */}
                    {(isValidTarget || isSelected) && (
                      <circle
                        cx={0}
                        cy={-2}
                        r={17}
                        fill="none"
                        stroke={
                          isSelected
                            ? '#ffffff'
                            : state.turnStep === 'FORTIFY'
                              ? '#4ade80'
                              : '#fde047'
                        }
                        strokeWidth={2.5}
                        strokeDasharray={isSelected ? undefined : '4 3'}
                      />
                    )}

                    {/* Capital HQ Gold Ring */}
                    {isCapital && (
                      <g>
                        <circle
                          cx={0}
                          cy={-2}
                          r={16}
                          fill="none"
                          stroke="#fde047"
                          strokeWidth={3}
                        />
                        <text
                          x={14}
                          y={-10}
                          fontSize={13}
                          textAnchor="middle"
                        >
                          🏛️
                        </text>
                      </g>
                    )}

                    {/* Army Count Medallion */}
                    <circle
                      cx={0}
                      cy={-2}
                      r={12}
                      fill={theme ? theme.badgeBg : 'rgba(15,23,42,0.75)'}
                      stroke={isSelected ? '#fde047' : '#ffffff'}
                      strokeWidth={isSelected ? 2.4 : 1.5}
                    />
                    <text
                      x={0}
                      y={2.5}
                      textAnchor="middle"
                      fill={theme ? theme.badgeText : '#94a3b8'}
                      fontSize={11.5}
                      fontWeight={900}
                    >
                      {tState.ownerId ? tState.armies : '—'}
                    </text>

                    {/* Territory Short Name */}
                    <text
                      x={0}
                      y={19}
                      textAnchor="middle"
                      fill="#f8fafc"
                      fontSize={9.5}
                      fontWeight={800}
                      style={{
                        paintOrder: 'stroke',
                        stroke: '#020617',
                        strokeWidth: 3.2,
                      }}
                    >
                      {meta.shortName}
                    </text>
                  </g>
                );
              })}
            </g>
          </svg>
        </div>

        {/* ==================== RIGHT TACTICAL COMMAND & DICE SIDEBAR ==================== */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {/* 1. ATTACK COMMAND CONSOLE (Manual vs Auto Blitz) */}
          {isMyTurn && state.turnStep === 'ATTACK' && (
            <div
              style={{
                padding: '0.85rem',
                borderRadius: '12px',
                background: 'linear-gradient(145deg, #1e293b 0%, #0f172a 100%)',
                border: '1px solid #ef4444',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.65rem',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <strong style={{ fontSize: '0.9rem', color: '#fca5a5' }}>
                  ⚔️ Attack Console
                </strong>
                {/* Attack Mode Toggle: Manual vs Auto */}
                <div
                  style={{
                    display: 'inline-flex',
                    background: '#020617',
                    borderRadius: '7px',
                    padding: '2px',
                    border: '1px solid #475569',
                  }}
                >
                  <button
                    type="button"
                    onClick={() => setAttackMode('MANUAL')}
                    style={{
                      padding: '0.22rem 0.55rem',
                      fontSize: '0.73rem',
                      fontWeight: 800,
                      border: 'none',
                      borderRadius: '5px',
                      cursor: 'pointer',
                      background:
                        attackMode === 'MANUAL' ? '#ef4444' : 'transparent',
                      color: attackMode === 'MANUAL' ? '#ffffff' : '#94a3b8',
                    }}
                  >
                    🎲 Manual
                  </button>
                  <button
                    type="button"
                    onClick={() => setAttackMode('AUTO')}
                    style={{
                      padding: '0.22rem 0.55rem',
                      fontSize: '0.73rem',
                      fontWeight: 800,
                      border: 'none',
                      borderRadius: '5px',
                      cursor: 'pointer',
                      background:
                        attackMode === 'AUTO' ? '#ef4444' : 'transparent',
                      color: attackMode === 'AUTO' ? '#ffffff' : '#94a3b8',
                    }}
                  >
                    ⚡ Auto Blitz
                  </button>
                </div>
              </div>

              <div
                style={{
                  fontSize: '0.8rem',
                  padding: '0.5rem 0.65rem',
                  borderRadius: '8px',
                  background: '#020617',
                  border: '1px solid #334155',
                }}
              >
                <div>
                  <span style={{ color: '#94a3b8' }}>From: </span>
                  <strong>
                    {selectedFromId
                      ? `${RISK_TERRITORIES_BY_ID[selectedFromId].name} (${selectedFromState?.armies ?? 0})`
                      : 'Click your territory (2+)'}
                  </strong>
                </div>
                <div style={{ marginTop: '3px' }}>
                  <span style={{ color: '#94a3b8' }}>Target: </span>
                  <strong style={{ color: '#fde047' }}>
                    {selectedToId
                      ? `${RISK_TERRITORIES_BY_ID[selectedToId].name} (${selectedToState?.armies ?? 0})`
                      : 'Click adjacent enemy'}
                  </strong>
                </div>
              </div>

              {selectedFromState &&
                selectedFromState.armies >= 2 &&
                selectedToId && (
                  <>
                    {attackMode === 'MANUAL' ? (
                      <div>
                        <div
                          style={{
                            fontSize: '0.74rem',
                            color: '#cbd5e1',
                            marginBottom: '0.35rem',
                          }}
                        >
                          Select White Attacker Dice:
                        </div>
                        <div style={{ display: 'flex', gap: '0.4rem' }}>
                          {([1, 2, 3] as const).map((diceCount) => {
                            const maxAllowed = Math.min(
                              3,
                              selectedFromState.armies - 1
                            );
                            const disabled = diceCount > maxAllowed;
                            const active = manualAttackerDice === diceCount;
                            return (
                              <button
                                key={diceCount}
                                type="button"
                                disabled={disabled}
                                onClick={() => setManualAttackerDice(diceCount)}
                                style={{
                                  flex: 1,
                                  padding: '0.4rem 0.3rem',
                                  borderRadius: '8px',
                                  border: active
                                    ? '2px solid #ffffff'
                                    : '1px solid #475569',
                                  background: active ? '#f8fafc' : '#1e293b',
                                  color: active ? '#0f172a' : '#cbd5e1',
                                  fontWeight: 800,
                                  fontSize: '0.78rem',
                                  opacity: disabled ? 0.35 : 1,
                                  cursor: disabled ? 'not-allowed' : 'pointer',
                                }}
                              >
                                {diceCount} {diceCount === 1 ? 'Die' : 'Dice'}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ) : (
                      <div>
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            fontSize: '0.74rem',
                            color: '#cbd5e1',
                            marginBottom: '0.25rem',
                          }}
                        >
                          <span>Stop Blitz if armies drop to:</span>
                          <strong>{blitzMinKeep}</strong>
                        </div>
                        <input
                          type="range"
                          min={1}
                          max={Math.max(1, selectedFromState.armies - 1)}
                          value={blitzMinKeep}
                          onChange={(e) =>
                            setBlitzMinKeep(Number(e.target.value))
                          }
                          style={{ width: '100%' }}
                        />
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={() =>
                        onDispatchAction({
                          type: 'RISK_DECLARE_ATTACK',
                          fromTerritoryId: selectedFromId!,
                          toTerritoryId: selectedToId,
                          mode: attackMode,
                          ...(attackMode === 'MANUAL'
                            ? { attackerDice: manualAttackerDice }
                            : { minArmiesToKeep: blitzMinKeep }),
                        })
                      }
                      style={{
                        padding: '0.55rem',
                        borderRadius: '9px',
                        border: '1px solid #fca5a5',
                        background:
                          'linear-gradient(135deg, #dc2626 0%, #991b1b 100%)',
                        color: '#ffffff',
                        fontWeight: 900,
                        fontSize: '0.86rem',
                        cursor: 'pointer',
                        boxShadow: '0 4px 12px rgba(220, 38, 38, 0.4)',
                      }}
                    >
                      {attackMode === 'MANUAL'
                        ? `🎲 Roll ${manualAttackerDice} White ${manualAttackerDice === 1 ? 'Die' : 'Dice'}`
                        : '⚡ Launch Auto Blitz!'}
                    </button>
                  </>
                )}
            </div>
          )}

          {/* 2. CONQUEST TROOP ADVANCE PANEL */}
          {isMyTurn &&
            state.turnStep === 'CONQUEST_MOVE' &&
            state.pendingConquest && (
              <div
                style={{
                  padding: '0.9rem',
                  borderRadius: '12px',
                  background:
                    'linear-gradient(145deg, #14532d 0%, #052e16 100%)',
                  border: '2px solid #4ade80',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.6rem',
                }}
              >
                <strong style={{ fontSize: '0.92rem', color: '#bbf7d0' }}>
                  🎖️ Advance into{' '}
                  {
                    RISK_TERRITORIES_BY_ID[state.pendingConquest.toTerritoryId]
                      .name
                  }
                </strong>
                <div style={{ fontSize: '0.78rem', color: '#dcfce7' }}>
                  Move between {state.pendingConquest.minArmiesToMove} and{' '}
                  {state.pendingConquest.maxArmiesToMove} armies:
                </div>
                <input
                  type="range"
                  min={state.pendingConquest.minArmiesToMove}
                  max={state.pendingConquest.maxArmiesToMove}
                  value={conquestMoveCount}
                  onChange={(e) => setConquestMoveCount(Number(e.target.value))}
                />
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: '0.4rem',
                  }}
                >
                  <button
                    type="button"
                    onClick={() =>
                      setConquestMoveCount(
                        state.pendingConquest!.minArmiesToMove
                      )
                    }
                    style={{
                      padding: '0.3rem 0.55rem',
                      borderRadius: '6px',
                      border: '1px solid #4ade80',
                      background: 'rgba(15,23,42,0.5)',
                      color: '#dcfce7',
                      fontSize: '0.74rem',
                      cursor: 'pointer',
                    }}
                  >
                    Min ({state.pendingConquest.minArmiesToMove})
                  </button>
                  <strong style={{ fontSize: '1rem', color: '#fde047' }}>
                    Move {conquestMoveCount}
                  </strong>
                  <button
                    type="button"
                    onClick={() =>
                      setConquestMoveCount(
                        state.pendingConquest!.maxArmiesToMove
                      )
                    }
                    style={{
                      padding: '0.3rem 0.55rem',
                      borderRadius: '6px',
                      border: '1px solid #4ade80',
                      background: 'rgba(15,23,42,0.5)',
                      color: '#dcfce7',
                      fontSize: '0.74rem',
                      cursor: 'pointer',
                    }}
                  >
                    Max ({state.pendingConquest.maxArmiesToMove})
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    onDispatchAction({
                      type: 'RISK_MOVE_AFTER_CONQUEST',
                      armies: conquestMoveCount,
                    })
                  }
                  style={{
                    padding: '0.5rem',
                    borderRadius: '8px',
                    border: 'none',
                    background: '#22c55e',
                    color: '#052e16',
                    fontWeight: 900,
                    cursor: 'pointer',
                  }}
                >
                  ✅ Advance {conquestMoveCount}{' '}
                  {conquestMoveCount === 1 ? 'Army' : 'Armies'}
                </button>
              </div>
            )}

          {/* 3. FORTIFY CONSOLE */}
          {isMyTurn &&
            state.turnStep === 'FORTIFY' &&
            selectedFromId &&
            selectedToId &&
            selectedFromState && (
              <div
                style={{
                  padding: '0.85rem',
                  borderRadius: '12px',
                  background: '#0f172a',
                  border: '2px solid #4ade80',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.55rem',
                }}
              >
                <strong style={{ fontSize: '0.88rem', color: '#86efac' }}>
                  🛡️ Fortify Connected Position
                </strong>
                <div style={{ fontSize: '0.78rem', color: '#cbd5e1' }}>
                  {RISK_TERRITORIES_BY_ID[selectedFromId].name} →{' '}
                  {RISK_TERRITORIES_BY_ID[selectedToId].name}
                </div>
                <input
                  type="range"
                  min={1}
                  max={Math.max(1, selectedFromState.armies - 1)}
                  value={Math.min(
                    fortifyCount,
                    Math.max(1, selectedFromState.armies - 1)
                  )}
                  onChange={(e) => setFortifyCount(Number(e.target.value))}
                />
                <button
                  type="button"
                  onClick={() =>
                    onDispatchAction({
                      type: 'RISK_FORTIFY',
                      fromTerritoryId: selectedFromId,
                      toTerritoryId: selectedToId,
                      armies: Math.min(
                        fortifyCount,
                        Math.max(1, selectedFromState.armies - 1)
                      ),
                    })
                  }
                  style={{
                    padding: '0.5rem',
                    borderRadius: '8px',
                    border: 'none',
                    background: '#22c55e',
                    color: '#052e16',
                    fontWeight: 900,
                    cursor: 'pointer',
                  }}
                >
                  🚚 Move {Math.min(fortifyCount, selectedFromState.armies - 1)} &
                  End Turn
                </button>
              </div>
            )}

          {/* 4. VISUAL COMBAT DICE TRAY (WHITE ATTACKER vs RED DEFENDER) */}
          <div
            style={{
              padding: '0.85rem',
              borderRadius: '12px',
              background: 'linear-gradient(145deg, #0f172a 0%, #1e293b 100%)',
              border: '1px solid #475569',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.6rem',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <strong style={{ fontSize: '0.86rem' }}>🎲 Battle Dice Tray</strong>
              <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>
                ⬜ Attacker vs 🟥 Defender
              </span>
            </div>

            {lastCombat && lastVolley ? (
              <>
                <div
                  style={{
                    fontSize: '0.76rem',
                    color: '#cbd5e1',
                    padding: '0.35rem 0.5rem',
                    borderRadius: '6px',
                    background: '#020617',
                  }}
                >
                  <strong>{displayName(lastCombat.attackerId)}</strong> (
                  {RISK_TERRITORIES_BY_ID[lastCombat.fromTerritoryId].shortName}) →{' '}
                  <strong>{displayName(lastCombat.defenderId)}</strong> (
                  {RISK_TERRITORIES_BY_ID[lastCombat.toTerritoryId].shortName})
                  {lastCombat.volleys.length > 1 && (
                    <span style={{ color: '#fbbf24', marginLeft: 6 }}>
                      ({lastCombat.volleys.length} volleys)
                    </span>
                  )}
                </div>

                {/* Side-by-Side Sorted White vs Red Dice Comparisons */}
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.45rem',
                    alignItems: 'center',
                    padding: '0.4rem 0',
                  }}
                >
                  {Array.from(
                    {
                      length: Math.max(
                        lastVolley.attackerRolls.length,
                        lastVolley.defenderRolls.length
                      ),
                    },
                    (_, idx) => {
                      const attDie = lastVolley.attackerRolls[idx];
                      const defDie = lastVolley.defenderRolls[idx];
                      const comp = lastVolley.comparisons[idx];

                      return (
                        <div
                          key={idx}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '0.75rem',
                            width: '100%',
                          }}
                        >
                          <div style={{ width: 46, display: 'flex', justifyContent: 'center' }}>
                            {attDie !== undefined && (
                              <RiskPipDie
                                value={attDie}
                                side="ATTACKER"
                                size={42}
                                highlight={
                                  comp
                                    ? comp.winner === 'ATTACKER'
                                      ? 'WIN'
                                      : 'LOSS'
                                    : 'NONE'
                                }
                              />
                            )}
                          </div>

                          <div
                            style={{
                              minWidth: 74,
                              textAlign: 'center',
                              fontSize: '0.72rem',
                              fontWeight: 800,
                              color: comp
                                ? comp.winner === 'ATTACKER'
                                  ? '#4ade80'
                                  : '#f87171'
                                : '#64748b',
                            }}
                          >
                            {comp
                              ? comp.winner === 'ATTACKER'
                                ? `${comp.attackerDie} > ${comp.defenderDie} ⚔️`
                                : `${comp.attackerDie} ≤ ${comp.defenderDie} 🛡️`
                              : 'Unpaired'}
                          </div>

                          <div style={{ width: 46, display: 'flex', justifyContent: 'center' }}>
                            {defDie !== undefined && (
                              <RiskPipDie
                                value={defDie}
                                side="DEFENDER"
                                size={42}
                                highlight={
                                  comp
                                    ? comp.winner === 'DEFENDER'
                                      ? 'WIN'
                                      : 'LOSS'
                                    : 'NONE'
                                }
                              />
                            )}
                          </div>
                        </div>
                      );
                    }
                  )}
                </div>

                {/* Casualties Summary */}
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: '0.76rem',
                    paddingTop: '0.35rem',
                    borderTop: '1px solid #334155',
                  }}
                >
                  <span>
                    ⬜ Att Losses: <strong>-{lastCombat.totalAttackerLosses}</strong>
                  </span>
                  <span>
                    🟥 Def Losses: <strong>-{lastCombat.totalDefenderLosses}</strong>
                  </span>
                </div>
                {lastCombat.conquered && (
                  <div
                    style={{
                      textAlign: 'center',
                      fontSize: '0.78rem',
                      fontWeight: 800,
                      color: '#fde047',
                    }}
                  >
                    🚩 Territory Captured!
                  </div>
                )}
              </>
            ) : (
              <div
                style={{
                  fontSize: '0.77rem',
                  color: '#94a3b8',
                  textAlign: 'center',
                  padding: '0.75rem 0.4rem',
                }}
              >
                No combat rolled yet. Attackers roll <strong>White Dice</strong>{' '}
                (up to 3) and Defenders roll <strong>Red Dice</strong> (up to 2;
                ties go to Defender).
              </div>
            )}
          </div>

          {/* 5. WAR LOG */}
          <div
            style={{
              padding: '0.75rem',
              borderRadius: '12px',
              background: '#0f172a',
              border: '1px solid #334155',
              maxHeight: 210,
              overflowY: 'auto',
            }}
          >
            <div
              style={{
                fontSize: '0.76rem',
                fontWeight: 800,
                color: '#94a3b8',
                marginBottom: '0.4rem',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}
            >
              📜 War Dispatch Log
            </div>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '0.28rem',
                fontSize: '0.74rem',
                color: '#cbd5e1',
              }}
            >
              {[...state.actionLog]
                .slice(-12)
                .reverse()
                .map((entry, idx) => (
                  <div
                    key={idx}
                    style={{
                      paddingBottom: '0.22rem',
                      borderBottom: '1px solid rgba(51,65,85,0.45)',
                    }}
                  >
                    {entry}
                  </div>
                ))}
            </div>
          </div>
        </div>
      </div>

      {/* ==================== MANUAL DEFENDER DICE MODAL ==================== */}
      {isDefenderPromptForMe && state.pendingDefense && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(2, 6, 23, 0.78)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '1rem',
          }}
        >
          <div
            style={{
              maxWidth: 440,
              width: '100%',
              background: 'linear-gradient(145deg, #450a0a 0%, #1e293b 100%)',
              border: '2px solid #ef4444',
              borderRadius: '16px',
              padding: '1.35rem',
              boxShadow: '0 20px 50px rgba(0,0,0,0.65)',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.9rem',
              color: '#f8fafc',
            }}
          >
            <div style={{ fontSize: '1.08rem', fontWeight: 900 }}>
              🛡️ Incoming Attack on{' '}
              {RISK_TERRITORIES_BY_ID[state.pendingDefense.toTerritoryId].name}!
            </div>
            <div style={{ fontSize: '0.86rem', color: '#fecaca' }}>
              <strong>{displayName(state.pendingDefense.attackerId)}</strong> is
              attacking from{' '}
              <strong>
                {
                  RISK_TERRITORIES_BY_ID[state.pendingDefense.fromTerritoryId]
                    .name
                }
              </strong>{' '}
              rolling{' '}
              <strong>
                {state.pendingDefense.attackerDiceCount} White{' '}
                {state.pendingDefense.attackerDiceCount === 1 ? 'Die' : 'Dice'}
              </strong>
              . Your garrison currently holds{' '}
              <strong>
                {state.territories[state.pendingDefense.toTerritoryId].armies}
              </strong>{' '}
              army/armies.
            </div>

            <div style={{ display: 'flex', gap: '0.65rem' }}>
              <button
                type="button"
                onClick={() =>
                  onDispatchAction({
                    type: 'RISK_DEFEND_ROLL',
                    defenderDice: 1,
                  })
                }
                style={{
                  flex: 1,
                  padding: '0.7rem',
                  borderRadius: '10px',
                  border: '2px solid #fca5a5',
                  background: '#b91c1c',
                  color: '#ffffff',
                  fontWeight: 900,
                  fontSize: '0.9rem',
                  cursor: 'pointer',
                }}
              >
                🟥 Roll 1 Red Die
              </button>
              {state.territories[state.pendingDefense.toTerritoryId].armies >=
                2 && (
                <button
                  type="button"
                  onClick={() =>
                    onDispatchAction({
                      type: 'RISK_DEFEND_ROLL',
                      defenderDice: 2,
                    })
                  }
                  style={{
                    flex: 1,
                    padding: '0.7rem',
                    borderRadius: '10px',
                    border: '2px solid #fde047',
                    background:
                      'linear-gradient(135deg, #dc2626 0%, #991b1b 100%)',
                    color: '#ffffff',
                    fontWeight: 900,
                    fontSize: '0.9rem',
                    cursor: 'pointer',
                  }}
                >
                  🟥🟥 Roll 2 Red Dice
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={() =>
                onDispatchAction({
                  type: 'RISK_SET_DEFENSE_MODE',
                  autoDefend: true,
                })
              }
              style={{
                padding: '0.45rem',
                borderRadius: '8px',
                border: '1px solid #64748b',
                background: 'rgba(15,23,42,0.65)',
                color: '#cbd5e1',
                fontSize: '0.76rem',
                cursor: 'pointer',
              }}
            >
              ⚡ Roll Max Dice & Switch My Defense to Auto
            </button>
          </div>
        </div>
      )}

      {/* ==================== RISK TERRITORY CARDS MODAL ==================== */}
      {showCardsModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(2, 6, 23, 0.78)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '1rem',
          }}
        >
          <div
            style={{
              maxWidth: 680,
              width: '100%',
              background: 'linear-gradient(145deg, #0f172a 0%, #1e293b 100%)',
              border: '2px solid #fbbf24',
              borderRadius: '16px',
              padding: '1.25rem',
              boxShadow: '0 20px 50px rgba(0,0,0,0.7)',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.85rem',
              color: '#f8fafc',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <strong style={{ fontSize: '1.05rem', color: '#fde047' }}>
                  🃏 Risk Territory Cards ({myHand.length})
                </strong>
                <div style={{ fontSize: '0.78rem', color: '#cbd5e1' }}>
                  {state.cardTradeMode === 'ESCALATING'
                    ? `Escalating Trade-In: Next valid 3-card set grants +${state.nextEscalatingSetValue} armies.`
                    : 'Fixed Trade-In: 3 Infantry = +4 • 3 Cavalry = +6 • 3 Artillery = +8 • 1 of Each = +10.'}
                </div>
              </div>
              {!(
                isMyTurn &&
                (state.turnStep === 'FORCED_CARD_TRADE' ||
                  (state.turnStep === 'REINFORCE' && myHand.length >= 5))
              ) && (
                <button
                  type="button"
                  onClick={() => setShowCardsModal(false)}
                  style={{
                    padding: '0.35rem 0.7rem',
                    borderRadius: '8px',
                    border: '1px solid #475569',
                    background: '#1e293b',
                    color: '#f8fafc',
                    cursor: 'pointer',
                  }}
                >
                  ✕ Close
                </button>
              )}
            </div>

            {myHand.length === 0 ? (
              <div
                style={{
                  padding: '1.5rem',
                  textAlign: 'center',
                  color: '#94a3b8',
                  fontSize: '0.86rem',
                }}
              >
                You do not hold any Risk cards yet. Conquer at least 1 territory
                on your turn to draw a card!
              </div>
            ) : (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(128px, 1fr))',
                  gap: '0.6rem',
                }}
              >
                {myHand.map((card) => {
                  const sym = getCardSymbolMeta(card.symbol);
                  const isSelected = selectedCardIds.includes(card.id);
                  const ownsPicturedTerritory =
                    card.territoryId !== null &&
                    state.territories[card.territoryId].ownerId ===
                      viewingPlayerId;

                  return (
                    <button
                      key={card.id}
                      type="button"
                      onClick={() => handleToggleCardSelection(card.id)}
                      style={{
                        padding: '0.65rem 0.5rem',
                        borderRadius: '10px',
                        border: isSelected
                          ? '2px solid #fde047'
                          : '1px solid #475569',
                        background: isSelected
                          ? 'linear-gradient(145deg, #422006 0%, #1e293b 100%)'
                          : '#020617',
                        color: '#f8fafc',
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '0.3rem',
                      }}
                    >
                      <span style={{ fontSize: '1.55rem' }}>{sym.icon}</span>
                      <span
                        style={{
                          fontSize: '0.75rem',
                          fontWeight: 800,
                          color: sym.accent,
                        }}
                      >
                        {sym.label}
                      </span>
                      <span
                        style={{
                          fontSize: '0.74rem',
                          color: '#e2e8f0',
                          textAlign: 'center',
                        }}
                      >
                        {card.territoryId
                          ? RISK_TERRITORIES_BY_ID[card.territoryId].name
                          : 'Wild Card'}
                      </span>
                      {ownsPicturedTerritory && (
                        <span
                          style={{
                            fontSize: '0.66rem',
                            padding: '1px 5px',
                            borderRadius: '999px',
                            background: '#14532d',
                            color: '#86efac',
                            fontWeight: 700,
                          }}
                        >
                          Owned (+2)
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            {matchingOwnedCardTerritories.length > 1 && selectedSetValid && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  fontSize: '0.78rem',
                }}
              >
                <span>Place +2 territory bonus on:</span>
                <select
                  value={
                    chosenBonusTerritoryId || matchingOwnedCardTerritories[0]
                  }
                  onChange={(e) =>
                    setChosenBonusTerritoryId(e.target.value as RiskTerritoryId)
                  }
                  style={{
                    background: '#0f172a',
                    color: '#f8fafc',
                    border: '1px solid #475569',
                    borderRadius: '6px',
                    padding: '0.25rem 0.5rem',
                  }}
                >
                  {matchingOwnedCardTerritories.map((tid) => (
                    <option key={tid} value={tid}>
                      {RISK_TERRITORIES_BY_ID[tid].name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '0.5rem',
                paddingTop: '0.5rem',
                borderTop: '1px solid #334155',
              }}
            >
              <button
                type="button"
                disabled={!findValidCardSetInHand(myHand)}
                onClick={handleAutoPickValidSet}
                style={{
                  padding: '0.4rem 0.75rem',
                  borderRadius: '8px',
                  border: '1px solid #475569',
                  background: '#1e293b',
                  color: '#cbd5e1',
                  fontSize: '0.78rem',
                  cursor: findValidCardSetInHand(myHand)
                    ? 'pointer'
                    : 'not-allowed',
                  opacity: findValidCardSetInHand(myHand) ? 1 : 0.45,
                }}
              >
                ✨ Auto-Select Valid Set
              </button>

              <button
                type="button"
                disabled={!canTradeNow || !selectedSetValid}
                onClick={handleTradeSelectedCards}
                style={{
                  padding: '0.5rem 1rem',
                  borderRadius: '9px',
                  border: 'none',
                  background:
                    canTradeNow && selectedSetValid ? '#eab308' : '#334155',
                  color:
                    canTradeNow && selectedSetValid ? '#0f172a' : '#94a3b8',
                  fontWeight: 900,
                  fontSize: '0.84rem',
                  cursor:
                    canTradeNow && selectedSetValid ? 'pointer' : 'not-allowed',
                }}
              >
                {selectedSetValid
                  ? `⚡ Trade Set for +${selectedSetBonusValue} Armies`
                  : 'Select 3 Matching/Distinct Cards'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
