import React from 'react';
import { GameMode } from '../game/types';
import { Volume2, VolumeX, ArrowLeft } from 'lucide-react';

import { HARD_PHYSICS, NORMAL_PHYSICS } from '../game/physics';

interface HUDProps {
  score: number;
  bestScore: number;
  mode: GameMode;
  speed: number;
  boostActive: boolean;
  soundEnabled: boolean;
  onToggleSound: () => void;
  onQuitToMenu: () => void;
}

export const HUD: React.FC<HUDProps> = ({
  score,
  bestScore,
  mode,
  speed,
  boostActive,
  soundEnabled,
  onToggleSound,
  onQuitToMenu,
}) => {
  const speedLimit = mode === 'hard' ? HARD_PHYSICS.maxSpeed : NORMAL_PHYSICS.maxSpeed;
  const isNewBest = score > bestScore && bestScore > 0;

  return (
    <div className="absolute inset-0 pointer-events-none z-10 select-none p-4 sm:p-6 flex flex-col justify-between">
      {/* Top Bar */}
      <div className="flex justify-between items-start w-full">
        {/* Top-Left: Distance Score & Record */}
        <div className="flex flex-col gap-1 pointer-events-auto">
          {/* Mode Pill */}
          <div className="flex items-center gap-2">
            <span
              className={`text-[10px] font-mono-cyber font-bold px-2 py-0.5 tracking-widest uppercase rounded border ${
                mode === 'hard'
                  ? 'border-[#ff0055] text-[#ff0055] bg-[#ff0055]/10'
                  : 'border-[#00ff88] text-[#00ff88] bg-[#00ff88]/10'
              }`}
            >
              {mode} MODE
            </span>
            {boostActive && (
              <span className="text-[10px] font-mono-cyber font-bold px-2 py-0.5 tracking-widest uppercase rounded border border-yellow-400 text-yellow-300 bg-yellow-400/20 animate-pulse">
                ⚡ BOOST
              </span>
            )}
          </div>

          {/* Big Score Readout */}
          <div className="flex items-baseline gap-1.5 mt-0.5">
            <span className="font-cyber font-black text-3xl sm:text-4xl text-white tracking-wider tabular-nums drop-shadow-[0_0_12px_rgba(0,255,136,0.5)]">
              {score}
            </span>
            <span className="font-mono-cyber text-xs text-[#00ff88] font-bold">M</span>
          </div>

          {/* Best Record */}
          <div className="text-xs font-mono-cyber text-zinc-400 tracking-wider">
            {isNewBest ? (
              <span className="text-yellow-400 font-bold drop-shadow-[0_0_8px_rgba(250,204,21,0.6)]">
                ★ NEW RECORD!
              </span>
            ) : (
              <span>BEST: {bestScore}m</span>
            )}
          </div>
        </div>

        {/* Top-Right: Sound toggle & Quit */}
        <div className="flex items-center gap-2 pointer-events-auto">
          {/* Sound Toggle */}
          <button
            onClick={onToggleSound}
            aria-label={soundEnabled ? 'Mute sound' : 'Unmute sound'}
            className="p-2 sm:p-2.5 bg-black/60 hover:bg-black/80 border border-zinc-700 hover:border-[#00ff88] text-zinc-300 hover:text-[#00ff88] transition-colors rounded cursor-pointer"
            title="Toggle Sound (M)"
          >
            {soundEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
          </button>

          {/* Menu Button */}
          <button
            onClick={onQuitToMenu}
            aria-label="Return to main menu"
            className="p-2 sm:p-2.5 bg-black/60 hover:bg-black/80 border border-zinc-700 hover:border-[#00f3ff] text-zinc-300 hover:text-[#00f3ff] transition-colors rounded cursor-pointer"
            title="Return to Menu (Esc)"
          >
            <ArrowLeft size={18} />
          </button>
        </div>
      </div>

      {/* Bottom Center Speedometer Cue */}
      <div className="self-center mb-2 flex items-center gap-3 bg-black/40 px-3 py-1 border border-zinc-800/80 rounded-full">
        <span className="text-[10px] font-mono-cyber text-zinc-400 tracking-widest uppercase">
          SPD:
        </span>
        <span className="text-xs font-mono-cyber font-bold text-cyan-400 tabular-nums">
          {Math.round(speed)} M/S
        </span>
        <div className="w-16 h-1 bg-zinc-800 rounded overflow-hidden">
          <div
            className={`h-full transition-all duration-100 ${
              boostActive ? 'bg-yellow-400 shadow-[0_0_8px_#ffe600]' : 'bg-[#00ff88]'
            }`}
            style={{ width: `${Math.min(100, (speed / speedLimit) * 100)}%` }}
          />
        </div>
      </div>
    </div>
  );
};
