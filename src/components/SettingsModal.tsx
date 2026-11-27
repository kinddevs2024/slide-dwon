import React from 'react';
import { GameSettings } from '../game/types';
import { X } from 'lucide-react';
import { audioManager } from '../game/audio';

interface SettingsModalProps {
  settings: GameSettings;
  onUpdateSettings: (newSettings: GameSettings) => void;
  onClearRecords: () => void;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  settings,
  onUpdateSettings,
  onClearRecords,
  onClose,
}) => {
  const toggleSound = () => {
    const updated = { ...settings, sound: !settings.sound };
    onUpdateSettings(updated);
    audioManager.setSoundEnabled(updated.sound);
  };

  const toggleMusic = () => {
    const updated = { ...settings, music: !settings.music };
    onUpdateSettings(updated);
    audioManager.setMusicEnabled(updated.music);
  };

  const setSensitivity = (val: number) => {
    onUpdateSettings({ ...settings, sensitivity: val });
  };

  const setGraphics = (quality: 'low' | 'high') => {
    onUpdateSettings({ ...settings, graphics: quality });
  };

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center p-4 bg-black/80 pointer-events-auto select-none">
      <div className="w-full max-w-md bg-[#090514] border-2 border-[#00f3ff]/80 p-6 clip-cyber-card shadow-[0_0_30px_rgba(0,243,255,0.3)]">
        {/* Header */}
        <div className="flex justify-between items-center mb-6 pb-2 border-b border-zinc-800">
          <h3 className="font-cyber font-black text-xl text-[#00f3ff] tracking-widest">
            SETTINGS
          </h3>
          <button
            onClick={() => {
              audioManager.playClick();
              onClose();
            }}
            className="text-zinc-400 hover:text-white p-1 cursor-pointer"
            aria-label="Close settings"
          >
            <X size={20} />
          </button>
        </div>

        {/* Options List */}
        <div className="flex flex-col gap-5 text-sm font-mono-cyber">
          {/* Sound FX */}
          <div className="flex justify-between items-center">
            <span className="text-zinc-200">SOUND EFFECTS</span>
            <button
              onClick={toggleSound}
              className={`px-3 py-1 font-cyber text-xs font-bold rounded cursor-pointer transition-colors border ${
                settings.sound
                  ? 'bg-[#00ff88]/20 border-[#00ff88] text-[#00ff88]'
                  : 'bg-zinc-800 border-zinc-700 text-zinc-500'
              }`}
            >
              {settings.sound ? 'ON' : 'OFF'}
            </button>
          </div>

          {/* Music */}
          <div className="flex justify-between items-center">
            <span className="text-zinc-200">SYNTH MUSIC</span>
            <button
              onClick={toggleMusic}
              className={`px-3 py-1 font-cyber text-xs font-bold rounded cursor-pointer transition-colors border ${
                settings.music
                  ? 'bg-[#00f3ff]/20 border-[#00f3ff] text-[#00f3ff]'
                  : 'bg-zinc-800 border-zinc-700 text-zinc-500'
              }`}
            >
              {settings.music ? 'ON' : 'OFF'}
            </button>
          </div>

          {/* Steering Sensitivity */}
          <div className="flex flex-col gap-2">
            <div className="flex justify-between text-xs">
              <span className="text-zinc-200">STEERING SENSITIVITY</span>
              <span className="text-[#00ff88] font-bold">
                {Math.round(settings.sensitivity * 100)}%
              </span>
            </div>
            <input
              type="range"
              min="0.5"
              max="1.5"
              step="0.05"
              value={settings.sensitivity}
              onChange={(e) => setSensitivity(parseFloat(e.target.value))}
              className="w-full accent-[#00ff88] bg-zinc-800 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-zinc-500">
              <span>PRECISE (50%)</span>
              <span>STANDARD (100%)</span>
              <span>RAPID (150%)</span>
            </div>
          </div>

          {/* Graphics Quality */}
          <div className="flex justify-between items-center">
            <span className="text-zinc-200">GRAPHICS QUALITY</span>
            <div className="flex gap-2">
              <button
                onClick={() => setGraphics('low')}
                className={`px-3 py-1 font-cyber text-xs font-bold rounded cursor-pointer transition-colors border ${
                  settings.graphics === 'low'
                    ? 'bg-yellow-400/20 border-yellow-400 text-yellow-300'
                    : 'bg-zinc-800 border-zinc-700 text-zinc-500'
                }`}
              >
                LOW
              </button>
              <button
                onClick={() => setGraphics('high')}
                className={`px-3 py-1 font-cyber text-xs font-bold rounded cursor-pointer transition-colors border ${
                  settings.graphics === 'high'
                    ? 'bg-[#00ff88]/20 border-[#00ff88] text-[#00ff88]'
                    : 'bg-zinc-800 border-zinc-700 text-zinc-500'
                }`}
              >
                HIGH
              </button>
            </div>
          </div>

          {/* Reset records */}
          <div className="pt-3 border-t border-zinc-800/80 flex justify-between items-center">
            <span className="text-zinc-400 text-xs">LOCAL SAVED SCORES</span>
            <button
              onClick={() => {
                if (window.confirm('Reset all saved local records?')) {
                  onClearRecords();
                }
              }}
              className="text-xs text-red-400 hover:text-red-300 underline cursor-pointer"
            >
              CLEAR RECORDS
            </button>
          </div>
        </div>

        {/* Close Button */}
        <button
          onClick={() => {
            audioManager.playClick();
            onClose();
          }}
          className="mt-6 w-full py-2.5 bg-zinc-800 hover:bg-zinc-700 text-white font-cyber font-bold text-xs tracking-widest uppercase transition-colors clip-cyber-button cursor-pointer"
        >
          CLOSE
        </button>
      </div>
    </div>
  );
};
