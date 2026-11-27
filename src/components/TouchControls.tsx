import React from 'react';

interface TouchControlsProps {
  leftActive: boolean;
  rightActive: boolean;
  setLeftActive: (active: boolean) => void;
  setRightActive: (active: boolean) => void;
}

export const TouchControls: React.FC<TouchControlsProps> = ({
  leftActive,
  rightActive,
  setLeftActive,
  setRightActive,
}) => {
  const press = (event: React.PointerEvent, setActive: (active: boolean) => void) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    setActive(true);
  };

  return (
    <div className="absolute inset-x-0 bottom-0 pointer-events-none z-10 flex justify-between p-4 sm:p-6 pb-6 select-none">
      {/* Left Touch Zone */}
      <div
        onPointerDown={(event) => press(event, setLeftActive)}
        onLostPointerCapture={() => setLeftActive(false)}
        className={`pointer-events-auto w-24 h-24 sm:w-28 sm:h-28 rounded-2xl border-2 flex items-center justify-center transition-all cursor-pointer backdrop-blur-[2px] touch-none ${
          leftActive
            ? 'bg-[#00ff88]/30 border-[#00ff88] shadow-[0_0_20px_rgba(0,255,136,0.6)] scale-95'
            : 'bg-black/30 border-[#00ff88]/30 hover:border-[#00ff88]/60'
        }`}
      >
        <span
          className={`font-cyber text-2xl sm:text-3xl select-none transition-colors ${
            leftActive ? 'text-[#00ff88]' : 'text-zinc-500'
          }`}
        >
          ◀
        </span>
      </div>

      {/* Right Touch Zone */}
      <div
        onPointerDown={(event) => press(event, setRightActive)}
        onLostPointerCapture={() => setRightActive(false)}
        className={`pointer-events-auto w-24 h-24 sm:w-28 sm:h-28 rounded-2xl border-2 flex items-center justify-center transition-all cursor-pointer backdrop-blur-[2px] touch-none ${
          rightActive
            ? 'bg-[#00ff88]/30 border-[#00ff88] shadow-[0_0_20px_rgba(0,255,136,0.6)] scale-95'
            : 'bg-black/30 border-[#00ff88]/30 hover:border-[#00ff88]/60'
        }`}
      >
        <span
          className={`font-cyber text-2xl sm:text-3xl select-none transition-colors ${
            rightActive ? 'text-[#00ff88]' : 'text-zinc-500'
          }`}
        >
          ▶
        </span>
      </div>
    </div>
  );
};
