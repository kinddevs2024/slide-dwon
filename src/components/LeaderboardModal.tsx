import React, { useState } from 'react';
import { LeaderboardEntry, GameMode } from '../game/types';
import { X, Trophy } from 'lucide-react';
import { audioManager } from '../game/audio';

interface LeaderboardModalProps {
  records: LeaderboardEntry[];
  onClose: () => void;
}

export const LeaderboardModal: React.FC<LeaderboardModalProps> = ({
  records,
  onClose,
}) => {
  const [filter, setFilter] = useState<'all' | GameMode>('all');

  const filtered = records.filter((r) => {
    if (filter === 'all') return true;
    return r.mode === filter;
  });

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center p-4 bg-black/80 pointer-events-auto select-none">
      <div className="w-full max-w-lg bg-[#090514] border-2 border-[#00ff88]/80 p-6 clip-cyber-card shadow-[0_0_30px_rgba(0,255,136,0.25)] flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex justify-between items-center pb-3 border-b border-zinc-800">
          <div className="flex items-center gap-2">
            <Trophy size={20} className="text-[#00ff88]" />
            <h3 className="font-cyber font-black text-xl text-[#00ff88] tracking-widest">
              LOCAL RECORDS
            </h3>
          </div>
          <button
            onClick={() => {
              audioManager.playClick();
              onClose();
            }}
            className="text-zinc-400 hover:text-white p-1 cursor-pointer"
            aria-label="Close leaderboard"
          >
            <X size={20} />
          </button>
        </div>

        {/* Mode Filter Tabs */}
        <div className="flex gap-2 my-3 font-cyber text-xs">
          {(['all', 'normal', 'hard'] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => {
                audioManager.playClick();
                setFilter(mode);
              }}
              className={`px-3 py-1.5 uppercase font-bold tracking-wider rounded cursor-pointer border transition-all ${
                filter === mode
                  ? 'bg-[#00ff88]/20 border-[#00ff88] text-[#00ff88]'
                  : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white'
              }`}
            >
              {mode}
            </button>
          ))}
        </div>

        {/* Records Table */}
        <div className="flex-1 overflow-y-auto pr-1 my-2">
          {filtered.length === 0 ? (
            <div className="text-center py-12 text-zinc-500 font-mono-cyber text-sm">
              NO LOCAL RECORDS RECORDED YET.
              <div className="text-xs text-zinc-600 mt-1">COMPLETE A RUN TO SET A RECORD!</div>
            </div>
          ) : (
            <table className="w-full text-left font-mono-cyber text-xs">
              <thead className="text-[10px] text-zinc-500 uppercase tracking-wider border-b border-zinc-800 sticky top-0 bg-[#090514]">
                <tr>
                  <th className="py-2 px-2">#</th>
                  <th className="py-2 px-2">PLAYER</th>
                  <th className="py-2 px-2">MODE</th>
                  <th className="py-2 px-2 text-right">DISTANCE</th>
                  <th className="py-2 px-2 text-right">DATE</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-900">
                {filtered.map((item, idx) => (
                  <tr
                    key={item.id}
                    className={`hover:bg-zinc-900/60 transition-colors ${
                      idx === 0 ? 'text-yellow-300 font-bold' : 'text-zinc-300'
                    }`}
                  >
                    <td className="py-2.5 px-2 font-cyber">
                      {idx === 0 ? '1' : idx + 1}
                    </td>
                    <td className="py-2.5 px-2 font-bold text-white tracking-wide">
                      {item.name}
                    </td>
                    <td className="py-2.5 px-2">
                      <span
                        className={`text-[9px] px-1.5 py-0.5 rounded border uppercase ${
                          item.mode === 'hard'
                            ? 'border-[#ff0055]/60 text-[#ff0055]'
                            : 'border-[#00ff88]/60 text-[#00ff88]'
                        }`}
                      >
                        {item.mode}
                      </span>
                    </td>
                    <td className="py-2.5 px-2 text-right font-cyber font-bold text-sm text-[#00ff88]">
                      {item.score}m
                    </td>
                    <td className="py-2.5 px-2 text-right text-zinc-500 text-[10px]">
                      {item.date}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer Note */}
        <div className="pt-2 text-[10px] font-mono-cyber text-zinc-500 text-center border-t border-zinc-800/80">
          SAVED LOCALLY IN BROWSER STORAGE
        </div>
      </div>
    </div>
  );
};
