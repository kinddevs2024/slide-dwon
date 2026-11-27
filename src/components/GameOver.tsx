import React, { useEffect } from 'react';
import { GameMode } from '../game/types';
import { audioManager } from '../game/audio';
import confetti from 'canvas-confetti';

interface GameOverProps {
  score: number;
  bestScore: number;
  mode: GameMode;
  cause: 'fall' | 'obstacle' | null;
  onTryAgain: () => void;
  onMainMenu: () => void;
}

export const GameOver: React.FC<GameOverProps> = ({
  score,
  bestScore,
  mode,
  cause,
  onTryAgain,
  onMainMenu,
}) => {
  const isNewBest = score >= bestScore && score > 0;

  useEffect(() => {
    if (isNewBest) {
      try {
        confetti({
          particleCount: 50,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#00ff88', '#00f3ff', '#ffe600'],
        });
      } catch {}
    }
  }, [isNewBest]);

  // Bind Enter / Space to instant Try Again
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'Enter') {
        e.preventDefault();
        audioManager.playClick();
        onTryAgain();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onTryAgain]);

  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center p-4 bg-black/75 pointer-events-auto select-none animate-in fade-in duration-200">
      <div className="w-full max-w-sm flex flex-col items-center bg-[#090514]/95 border-2 border-[#ff0055] p-6 sm:p-8 clip-cyber-card shadow-[0_0_35px_rgba(255,0,85,0.4)] text-center">
        {/* Cause of death kicker */}
        <div className="text-[11px] font-mono-cyber uppercase tracking-[0.25em] text-[#ff0055]/80 mb-1">
          {cause === 'fall' ? 'LOST TO THE VOID' : 'HAZARD IMPACT'}
        </div>

        {/* Large GAME OVER Title */}
        <h2 className="font-cyber font-black text-3xl sm:text-4xl text-[#ff0055] tracking-widest drop-shadow-[0_0_18px_rgba(255,0,85,0.8)] mb-4">
          GAME OVER
        </h2>

        {/* New Best Badge */}
        {isNewBest && (
          <div className="mb-4 px-3 py-1 bg-yellow-400/20 border border-yellow-400 text-yellow-300 font-cyber font-bold text-xs tracking-widest rounded animate-pulse">
            ★ NEW BEST RECORD! ★
          </div>
        )}

        {/* Scores Box */}
        <div className="w-full bg-black/60 border border-zinc-800 p-4 mb-6 rounded flex justify-around items-center">
          <div>
            <div className="text-[10px] font-mono-cyber text-zinc-400 tracking-widest uppercase">
              DISTANCE
            </div>
            <div className="font-cyber font-black text-2xl sm:text-3xl text-white tabular-nums">
              {score}m
            </div>
          </div>
          <div className="w-[1px] h-8 bg-zinc-800" />
          <div>
            <div className="text-[10px] font-mono-cyber text-zinc-400 tracking-widest uppercase">
              {mode.toUpperCase()} BEST
            </div>
            <div className="font-cyber font-black text-2xl sm:text-3xl text-[#00ff88] tabular-nums">
              {Math.max(score, bestScore)}m
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="w-full flex flex-col gap-3">
          <button
            data-start="true"
            onClick={() => {
              audioManager.playClick();
              onTryAgain();
            }}
            className="w-full py-3.5 bg-[#00ff88] hover:bg-[#00ff88]/90 text-black font-cyber font-black text-base sm:text-lg tracking-widest transition-all clip-cyber-button shadow-[0_0_20px_rgba(0,255,136,0.5)] cursor-pointer active:scale-[0.98]"
          >
            TRY AGAIN [SPACE]
          </button>

          <button
            onClick={() => {
              audioManager.playClick();
              onMainMenu();
            }}
            className="w-full py-2.5 bg-transparent hover:bg-zinc-900 border border-zinc-700 hover:border-zinc-500 text-zinc-300 font-cyber font-bold text-xs sm:text-sm tracking-wider uppercase transition-all clip-cyber-button cursor-pointer"
          >
            MAIN MENU
          </button>
        </div>
      </div>
    </div>
  );
};
