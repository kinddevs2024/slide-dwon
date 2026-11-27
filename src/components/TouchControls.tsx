import React from 'react';

interface TouchControlsProps {
  onSteer: (dir: number) => void;
  leftActive: boolean;
  rightActive: boolean;
  setLeftActive: (active: boolean) => void;
  setRightActive: (active: boolean) => void;
}

export const TouchControls: React.FC<TouchControlsProps> = ({
  onSteer,
  leftActive,
  rightActive,
  setLeftActive,
  setRightActive,
}) => {
  const updateSteering = (left: boolean, right: boolean) => {
    if (left && right) onSteer(0);
    else if (left) onSteer(-1);
    else if (right) onSteer(1);
    else onSteer(0);
  };

  const handleTouchStartLeft = (e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    setLeftActive(true);
    updateSteering(true, rightActive);
  };

  const handleTouchEndLeft = (e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    setLeftActive(false);
    updateSteering(false, rightActive);
  };

  const handleTouchStartRight = (e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    setRightActive(true);
    updateSteering(leftActive, true);
  };

  const handleTouchEndRight = (e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    setRightActive(false);
    updateSteering(leftActive, false);
  };

  return (
    <div className="absolute inset-x-0 bottom-0 pointer-events-none z-10 flex justify-between p-4 sm:p-6 pb-6 select-none">
      {/* Left Touch Zone */}
      <div
        onTouchStart={handleTouchStartLeft}
        onTouchEnd={handleTouchEndLeft}
        onTouchCancel={handleTouchEndLeft}
        onMouseDown={handleTouchStartLeft}
        onMouseUp={handleTouchEndLeft}
        onMouseLeave={handleTouchEndLeft}
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
        onTouchStart={handleTouchStartRight}
        onTouchEnd={handleTouchEndRight}
        onTouchCancel={handleTouchEndRight}
        onMouseDown={handleTouchStartRight}
        onMouseUp={handleTouchEndRight}
        onMouseLeave={handleTouchEndRight}
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
