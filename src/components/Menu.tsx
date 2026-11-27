import React, { useState } from 'react';
import { GameMode } from '../game/types';
import { audioManager } from '../game/audio';

interface MenuProps {
  playerName: string;
  onPlayerNameChange: (name: string) => void;
  bestNormal: number;
  bestHard: number;
  onStartGame: (mode: GameMode) => void;
  onOpenSettings: () => void;
  onOpenLeaderboard: () => void;
}

export const Menu: React.FC<MenuProps> = ({
  playerName,
  onPlayerNameChange,
  bestNormal,
  bestHard,
  onStartGame,
  onOpenSettings,
  onOpenLeaderboard,
}) => {
  const [editingName, setEditingName] = useState(false);
  const [tempName, setTempName] = useState(playerName);

  const handleStart = (mode: GameMode) => {
    audioManager.init();
    audioManager.playClick();
    onStartGame(mode);
  };

  const saveName = () => {
    const clean = tempName.trim() || 'RUNNER_01';
    onPlayerNameChange(clean);
    setEditingName(false);
  };

  return (
    <div className="absolute inset-0 flex flex-col justify-between items-center py-8 px-4 z-20 pointer-events-auto select-none">
      {/* Top Title Lockup */}
      <div className="flex flex-col items-center mt-4 sm:mt-8">
        {/* Cyber Emblem / Accent */}
        <div className="flex items-center gap-2 mb-2 text-[#00ff88]/70 text-xs sm:text-sm font-mono-cyber tracking-[0.3em] uppercase">
          <span className="w-8 h-[1px] bg-[#00ff88]/60" />
          <span>CYBER ARCADE SPEED RUNNER</span>
          <span className="w-8 h-[1px] bg-[#00ff88]/60" />
        </div>

        {/* Large Geometric Neon Green Header */}
        <h1 className="font-cyber font-black text-4xl sm:text-6xl md:text-7xl tracking-widest text-[#00ff88] drop-shadow-[0_0_25px_rgba(0,255,136,0.6)] text-center">
          SLIDE DOWN
        </h1>

        <div className="flex items-center gap-4 mt-2 text-xs font-mono-cyber text-cyan-400/80 tracking-widest">
          <span>NORMAL BEST: {bestNormal}m</span>
          <span className="text-zinc-600">|</span>
          <span>HARD BEST: {bestHard}m</span>
        </div>
      </div>

      {/* Center/Lower Menu Block */}
      <div className="w-full max-w-sm flex flex-col items-center mb-6 sm:mb-12">
        {/* Editable Player Name */}
        <div className="w-full mb-5 flex items-center justify-between px-4 py-2 border border-[#00ff88]/30 bg-black/60 clip-cyber-card">
          <span className="text-xs font-mono-cyber text-[#00ff88]/80 uppercase tracking-wider">
            PLAYER:
          </span>
          {editingName ? (
            <input
              type="text"
              value={tempName}
              maxLength={14}
              autoFocus
              onBlur={saveName}
              onKeyDown={(e) => {
                if (e.key === 'Enter') saveName();
              }}
              onChange={(e) => setTempName(e.target.value.toUpperCase())}
              className="bg-zinc-900 text-white font-cyber text-sm px-2 py-0.5 rounded outline-none border border-[#00ff88] text-right"
            />
          ) : (
            <button
              onClick={() => {
                setTempName(playerName);
                setEditingName(true);
              }}
              className="text-sm font-cyber font-bold text-white hover:text-[#00ff88] tracking-wider transition-colors flex items-center gap-1.5 cursor-pointer"
              title="Click to edit name"
            >
              <span>{playerName}</span>
              <span className="text-[10px] text-zinc-500 font-mono-cyber">[EDIT]</span>
            </button>
          )}
        </div>

        {/* Vertical Buttons Stack */}
        <div className="w-full flex flex-col gap-3">
          {/* Normal Mode Button */}
          <button
            data-start="true"
            onClick={() => handleStart('normal')}
            className="group relative w-full px-6 py-3.5 bg-black/80 hover:bg-[#00ff88]/15 border-2 border-[#00ff88] text-left transition-all duration-150 clip-cyber-button shadow-[0_0_15px_rgba(0,255,136,0.25)] hover:shadow-[0_0_25px_rgba(0,255,136,0.6)] cursor-pointer active:scale-[0.98]"
          >
            <div className="flex items-center justify-between">
              <span className="font-cyber font-black text-lg sm:text-xl text-white group-hover:text-[#00ff88] tracking-widest">
                NORMAL MODE
              </span>
              <span className="text-[#00ff88] font-cyber text-lg group-hover:translate-x-1 transition-transform">
                ▶
              </span>
            </div>
            <div className="text-[11px] font-mono-cyber text-[#00ff88]/80 tracking-widest mt-0.5 uppercase">
              SLOWER AND SCENIC
            </div>
          </button>

          {/* Hard Mode Button */}
          <button
            onClick={() => handleStart('hard')}
            className="group relative w-full px-6 py-3.5 bg-black/80 hover:bg-[#ff0055]/15 border-2 border-[#ff0055]/80 hover:border-[#ff0055] text-left transition-all duration-150 clip-cyber-button shadow-[0_0_15px_rgba(255,0,85,0.2)] hover:shadow-[0_0_25px_rgba(255,0,85,0.5)] cursor-pointer active:scale-[0.98]"
          >
            <div className="flex items-center justify-between">
              <span className="font-cyber font-black text-lg sm:text-xl text-white group-hover:text-[#ff0055] tracking-widest">
                HARD MODE
              </span>
              <span className="text-[#ff0055] font-cyber text-lg group-hover:translate-x-1 transition-transform">
                ▶
              </span>
            </div>
            <div className="text-[11px] font-mono-cyber text-[#ff0055]/80 tracking-widest mt-0.5 uppercase">
              FASTER AND CHALLENGING
            </div>
          </button>

          {/* Secondary Buttons Row */}
          <div className="grid grid-cols-2 gap-3 mt-1">
            <button
              onClick={() => {
                audioManager.playClick();
                onOpenSettings();
              }}
              className="py-2.5 px-3 bg-black/70 hover:bg-zinc-900 border border-[#00f3ff]/60 hover:border-[#00f3ff] text-zinc-200 hover:text-[#00f3ff] font-cyber font-bold text-xs sm:text-sm tracking-wider uppercase transition-all clip-cyber-button cursor-pointer text-center"
            >
              SETTINGS
            </button>
            <button
              onClick={() => {
                audioManager.playClick();
                onOpenLeaderboard();
              }}
              className="py-2.5 px-3 bg-black/70 hover:bg-zinc-900 border border-[#00f3ff]/60 hover:border-[#00f3ff] text-zinc-200 hover:text-[#00f3ff] font-cyber font-bold text-xs sm:text-sm tracking-wider uppercase transition-all clip-cyber-button cursor-pointer text-center"
            >
              LEADERBOARD
            </button>
          </div>
        </div>

        {/* Keyboard / Touch Controls Hint */}
        <div className="mt-4 text-[11px] font-mono-cyber text-zinc-400 text-center tracking-wider">
          A / D or ◀ ▶ KEYS TO STEER · NO WALLS · AVOID HAZARDS
        </div>
      </div>
    </div>
  );
};
