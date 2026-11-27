import React, { useEffect, useMemo, useState } from 'react';
import { GAME_CATALOG, GAME_CATALOG_BY_ID } from '../registry/catalog.js';
import { GAME_RULES_BY_ID } from '../registry/gameRules.js';
import { GameId } from '../types/game.js';

export type RulesTabId = 'CHEAT_SHEET' | 'TURN_FLOW' | 'SCORING' | 'VARIANTS';
export type RulesDisplayMode = 'MODAL' | 'SIDE_DRAWER';

export interface GameRulesViewerProps {
  readonly isOpen: boolean;
  readonly activeGameId: GameId;
  /** Expansion or variant IDs currently active in the lobby or live match */
  readonly activeOptionIds?: readonly string[];
  readonly displayMode: RulesDisplayMode;
  readonly onChangeDisplayMode: (mode: RulesDisplayMode) => void;
  readonly onClose: () => void;
}

export const GameRulesViewer: React.FC<GameRulesViewerProps> = ({
  isOpen,
  activeGameId,
  activeOptionIds = [],
  displayMode,
  onChangeDisplayMode,
  onClose,
}) => {
  const [viewedGameId, setViewedGameId] = useState<GameId>(activeGameId);
  const [activeTab, setActiveTab] = useState<RulesTabId>('CHEAT_SHEET');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Keep viewedGameId synced whenever the host/game switches or modal re-opens
  useEffect(() => {
    if (isOpen) {
      setViewedGameId(activeGameId);
      setSearchQuery('');
    }
  }, [isOpen, activeGameId]);

  // Close centered modal on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  const gameDef = GAME_CATALOG_BY_ID[viewedGameId];
  const rulebook = GAME_RULES_BY_ID[viewedGameId];
  const isViewingCurrentMatchGame = viewedGameId === activeGameId;

  const activeSet = useMemo(() => {
    const s = new Set<string>(['always_active']);
    if (isViewingCurrentMatchGame) {
      for (const id of activeOptionIds) {
        s.add(id);
      }
    }
    return s;
  }, [activeOptionIds, isViewingCurrentMatchGame]);

  const activeVariantsCount = useMemo(
    () =>
      rulebook.variantsAndExpansions.filter((v) => activeSet.has(v.id)).length,
    [rulebook.variantsAndExpansions, activeSet]
  );

  const normalizedQuery = searchQuery.trim().toLowerCase();

  const matchesSearch = (text: string): boolean =>
    !normalizedQuery || text.toLowerCase().includes(normalizedQuery);

  // Filtered sections when searchQuery is non-empty
  const filteredBullets = useMemo(
    () => rulebook.quickSummaryBullets.filter((b) => matchesSearch(b)),
    [rulebook.quickSummaryBullets, normalizedQuery]
  );

  const filteredTables = useMemo(
    () =>
      rulebook.referenceTables.filter(
        (t) =>
          matchesSearch(t.title) ||
          t.headers.some((h) => matchesSearch(h)) ||
          t.rows.some((r) => r.some((cell) => matchesSearch(cell)))
      ),
    [rulebook.referenceTables, normalizedQuery]
  );

  const filteredTurnSteps = useMemo(
    () =>
      rulebook.turnFlowSteps.filter(
        (s) =>
          matchesSearch(s.title) ||
          matchesSearch(s.detail) ||
          (s.uiTip !== undefined && matchesSearch(s.uiTip))
      ),
    [rulebook.turnFlowSteps, normalizedQuery]
  );

  const filteredScoringMatches = useMemo(() => {
    if (!normalizedQuery) return true;
    return (
      matchesSearch(rulebook.scoringAndEndGame.endTrigger) ||
      matchesSearch(rulebook.scoringAndEndGame.tieBreaker) ||
      rulebook.scoringAndEndGame.scoringRules.some((r) => matchesSearch(r))
    );
  }, [rulebook.scoringAndEndGame, normalizedQuery]);

  const sortedAndFilteredVariants = useMemo(() => {
    const base = [...rulebook.variantsAndExpansions].sort((a, b) => {
      const aOn = activeSet.has(a.id) ? 1 : 0;
      const bOn = activeSet.has(b.id) ? 1 : 0;
      return bOn - aOn;
    });
    if (!normalizedQuery) return base;
    return base.filter(
      (v) =>
        matchesSearch(v.title) ||
        matchesSearch(v.summary) ||
        v.details.some((d) => matchesSearch(d))
    );
  }, [rulebook.variantsAndExpansions, activeSet, normalizedQuery]);

  if (!isOpen) {
    return null;
  }

  const renderCheatSheetSection = () => (
    <div className="space-y-4">
      {/* Objective Banner */}
      {(!normalizedQuery || matchesSearch(rulebook.objective)) && (
        <div className="rounded-xl bg-gradient-to-r from-emerald-950/60 to-slate-900 border border-emerald-400/50 p-3.5">
          <div className="text-[10px] font-black uppercase tracking-wider text-emerald-300 mb-1">
            🎯 Primary Objective
          </div>
          <p className="text-xs text-slate-100 font-semibold leading-relaxed">
            {rulebook.objective}
          </p>
        </div>
      )}

      {/* Key Rules Bullets */}
      {filteredBullets.length > 0 && (
        <div className="rounded-xl bg-slate-950/85 border border-slate-800 p-3.5 space-y-2">
          <div className="text-[11px] font-black uppercase tracking-wider text-amber-300">
            ⚡ Essential Rules at a Glance
          </div>
          <ul className="space-y-2 text-xs text-slate-200 leading-relaxed">
            {filteredBullets.map((bullet, idx) => (
              <li key={idx} className="flex items-start gap-2">
                <span className="text-amber-400 font-black mt-0.5">•</span>
                <span>{bullet}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Reference Tables */}
      {filteredTables.map((table, tIdx) => (
        <div
          key={tIdx}
          className="rounded-xl bg-slate-950/90 border border-slate-800 overflow-hidden"
        >
          <div className="px-3.5 py-2 bg-slate-900 border-b border-slate-800 text-[11px] font-black uppercase tracking-wider text-cyan-300">
            📊 {table.title}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-900/60 border-b border-slate-800 text-slate-400 text-[10px] uppercase">
                  {table.headers.map((h, hIdx) => (
                    <th key={hIdx} className="px-3.5 py-2 font-extrabold">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/70">
                {table.rows.map((row, rIdx) => (
                  <tr
                    key={rIdx}
                    className="hover:bg-slate-900/40 text-slate-200"
                  >
                    {row.map((cell, cIdx) => (
                      <td
                        key={cIdx}
                        className={`px-3.5 py-2 ${
                          cIdx === 0 ? 'font-bold text-white' : ''
                        }`}
                      >
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );

  const renderTurnFlowSection = () => (
    <div className="space-y-3">
      {filteredTurnSteps.map((step, idx) => (
        <div
          key={idx}
          className="rounded-xl bg-slate-950/85 border border-slate-800 p-3.5 space-y-2"
        >
          <div className="text-xs font-black text-amber-300">{step.title}</div>
          <p className="text-xs text-slate-200 leading-relaxed">
            {step.detail}
          </p>
          {step.uiTip && (
            <div className="rounded-lg bg-cyan-950/40 border border-cyan-500/30 px-3 py-1.5 text-[11px] text-cyan-200">
              <strong>💡 Board UI Tip:</strong> {step.uiTip}
            </div>
          )}
        </div>
      ))}
    </div>
  );

  const renderScoringSection = () =>
    filteredScoringMatches ? (
      <div className="space-y-3.5">
        <div className="rounded-xl bg-rose-950/35 border border-rose-500/40 p-3.5">
          <div className="text-[10px] font-black uppercase tracking-wider text-rose-300 mb-1">
            🏁 Game-End Trigger
          </div>
          <p className="text-xs text-slate-100 leading-relaxed">
            {rulebook.scoringAndEndGame.endTrigger}
          </p>
        </div>

        <div className="rounded-xl bg-slate-950/85 border border-slate-800 p-3.5 space-y-2">
          <div className="text-[11px] font-black uppercase tracking-wider text-emerald-300">
            🏆 Final Scoring Breakdown
          </div>
          <ul className="space-y-1.5 text-xs text-slate-200">
            {rulebook.scoringAndEndGame.scoringRules.map((rule, idx) => (
              <li key={idx} className="flex items-start gap-2">
                <span className="text-emerald-400 font-black">✓</span>
                <span>{rule}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-xl bg-slate-950/85 border border-slate-800 p-3.5">
          <div className="text-[10px] font-black uppercase tracking-wider text-amber-300 mb-1">
            ⚖️ Tie-Breaker
          </div>
          <p className="text-xs text-slate-200">
            {rulebook.scoringAndEndGame.tieBreaker}
          </p>
        </div>
      </div>
    ) : null;

  const renderVariantsSection = () => (
    <div className="space-y-3">
      {sortedAndFilteredVariants.length === 0 ? (
        <div className="rounded-xl bg-slate-950/75 border border-dashed border-slate-800 p-5 text-center text-xs text-slate-400">
          {normalizedQuery
            ? 'No variants matched your search.'
            : `${gameDef.name} uses its standard classic ruleset without optional expansion toggles.`}
        </div>
      ) : (
        sortedAndFilteredVariants.map((variant) => {
          const isActiveHere = activeSet.has(variant.id);
          return (
            <div
              key={variant.id}
              className={`rounded-xl border p-3.5 space-y-2 ${
                isActiveHere
                  ? 'bg-emerald-950/35 border-emerald-400 shadow-md'
                  : 'bg-slate-950/80 border-slate-800'
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-black text-white">
                  🧩 {variant.title}
                </span>
                {isActiveHere ? (
                  <span className="px-2 py-0.5 rounded-full bg-emerald-400 text-slate-950 font-black text-[9px] uppercase">
                    ✓ Active This Match
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 font-bold text-[9px] uppercase">
                    Optional Variant
                  </span>
                )}
              </div>
              <p className="text-[11px] text-amber-200/90 font-medium">
                {variant.summary}
              </p>
              <ul className="space-y-1 text-xs text-slate-300 pt-1 border-t border-slate-800/80">
                {variant.details.map((d, dIdx) => (
                  <li key={dIdx} className="flex items-start gap-2">
                    <span className="text-slate-500">•</span>
                    <span>{d}</span>
                  </li>
                ))}
              </ul>
            </div>
          );
        })
      )}
    </div>
  );

  const panelBody = (
    <div
      className={`flex flex-col bg-gradient-to-b from-slate-900 to-slate-950 text-slate-100 border-2 border-amber-400/70 shadow-2xl ${
        displayMode === 'MODAL'
          ? 'w-full max-w-3xl max-h-[88vh] rounded-2xl'
          : 'w-full h-full rounded-l-2xl border-r-0'
      }`}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header: Game Picker + Dock/Center Toggle + Close */}
      <div className="px-4 py-3 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2.5 shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="text-2xl">{gameDef.icon}</span>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-black text-amber-300">
                📖 Rulebook &amp; Player Aid:
              </span>
              <select
                value={viewedGameId}
                onChange={(e) => setViewedGameId(e.target.value as GameId)}
                className="px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-700 text-xs font-extrabold text-white cursor-pointer"
              >
                {GAME_CATALOG.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.icon} {g.name}
                    {g.id === activeGameId ? ' (Current)' : ''}
                  </option>
                ))}
              </select>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5 truncate max-w-md">
              {rulebook.tagline}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {rulebook.pdfUrl && (
            <a
              href={rulebook.pdfUrl}
              target="_blank"
              rel="noreferrer"
              className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-600 text-[11px] font-bold text-cyan-300"
            >
              📄 Official PDF
            </a>
          )}
          <button
            type="button"
            onClick={() =>
              onChangeDisplayMode(
                displayMode === 'MODAL' ? 'SIDE_DRAWER' : 'MODAL'
              )
            }
            title={
              displayMode === 'MODAL'
                ? 'Pin rulebook to the right side so you can play while reading'
                : 'Expand rulebook back to the center of the screen'
            }
            className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-600 text-[11px] font-bold text-amber-200 cursor-pointer"
          >
            {displayMode === 'MODAL' ? '📌 Pin Right' : '🗔 Center'}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg bg-rose-600/90 hover:bg-rose-500 text-white text-[11px] font-black cursor-pointer"
          >
            ✕ Close
          </button>
        </div>
      </div>

      {/* Search Bar & 4 Navigation Tabs */}
      <div className="px-4 pt-3 pb-2 border-b border-slate-800 space-y-2.5 shrink-0 bg-slate-900/60">
        <div className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={`🔍 Search ${gameDef.name} rules, costs, cards, or variants...`}
            className="w-full px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-700 focus:border-amber-400 outline-none text-xs text-slate-100 placeholder:text-slate-500"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1.5 text-[11px] text-slate-400 hover:text-white cursor-pointer"
            >
              Clear
            </button>
          )}
        </div>

        {!normalizedQuery && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
            {(
              [
                { id: 'CHEAT_SHEET', label: '⚡ Cheat Sheet' },
                { id: 'TURN_FLOW', label: '🔄 Turn Flow' },
                { id: 'SCORING', label: '🏆 Scoring' },
                {
                  id: 'VARIANTS',
                  label:
                    activeVariantsCount > 0
                      ? `🧩 Variants (${activeVariantsCount} On)`
                      : '🧩 Variants',
                },
              ] as const
            ).map((tab) => {
              const isTabActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`py-1.5 px-2 rounded-lg text-[11px] font-black transition cursor-pointer ${
                    isTabActive
                      ? 'bg-amber-400 text-slate-950 shadow'
                      : 'bg-slate-950/80 text-slate-300 hover:bg-slate-800 border border-slate-800'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Scrollable Rulebook Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {normalizedQuery ? (
          <>
            <div className="text-[11px] font-bold text-amber-300">
              Showing all matching rules in {gameDef.name} for &ldquo;
              {searchQuery}&rdquo;:
            </div>
            {renderCheatSheetSection()}
            {renderTurnFlowSection()}
            {renderScoringSection()}
            {renderVariantsSection()}
            {filteredBullets.length === 0 &&
              filteredTables.length === 0 &&
              filteredTurnSteps.length === 0 &&
              !filteredScoringMatches &&
              sortedAndFilteredVariants.length === 0 && (
                <div className="p-6 text-center text-xs text-slate-400 border border-dashed border-slate-800 rounded-xl">
                  No rules in {gameDef.name} matched &ldquo;{searchQuery}&rdquo;.
                </div>
              )}
          </>
        ) : (
          <>
            {activeTab === 'CHEAT_SHEET' && renderCheatSheetSection()}
            {activeTab === 'TURN_FLOW' && renderTurnFlowSection()}
            {activeTab === 'SCORING' && renderScoringSection()}
            {activeTab === 'VARIANTS' && renderVariantsSection()}
          </>
        )}
      </div>
    </div>
  );

  if (displayMode === 'SIDE_DRAWER') {
    return (
      <div className="fixed top-12 right-0 bottom-0 w-full sm:w-[420px] z-40 pointer-events-auto shadow-2xl">
        {panelBody}
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      {panelBody}
    </div>
  );
};
