/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { GameMode, GameState, GameSettings, TrackSegment, BallPhysics } from './game/types';
import {
  createInitialBallState,
  stepBallPhysics,
  NORMAL_PHYSICS,
  HARD_PHYSICS,
  INITIAL_BALL_Y,
} from './game/physics';
import {
  createInitialGeneratorState,
  populateTrack,
  GeneratorState,
} from './game/trackGenerator';
import { GameEngine } from './game/engine';
import { audioManager } from './game/audio';
import {
  loadSettings,
  saveSettings,
  loadPlayerName,
  savePlayerName,
  loadBestScore,
  saveBestScore,
  loadRecords,
  addRecord,
  clearAllRecords,
} from './game/storage';
import { Menu } from './components/Menu';
import { HUD } from './components/HUD';
import { GameOver } from './components/GameOver';
import { SettingsModal } from './components/SettingsModal';
import { LeaderboardModal } from './components/LeaderboardModal';
import { TouchControls } from './components/TouchControls';

export default function App() {
  const canvasMountRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<GameEngine | null>(null);

  // High-level Game States
  const [gameState, setGameState] = useState<GameState>('title');
  const [activeMode, setActiveMode] = useState<GameMode>('normal');
  const [score, setScore] = useState(0);
  const [bestNormal, setBestNormal] = useState(0);
  const [bestHard, setBestHard] = useState(0);
  const [speed, setSpeed] = useState(24);
  const [boostActive, setBoostActive] = useState(false);
  const [playerName, setPlayerName] = useState('RUNNER_01');
  const [settings, setSettings] = useState<GameSettings>(loadSettings);
  const [records, setRecords] = useState(loadRecords);
  const [causeOfDeath, setCauseOfDeath] = useState<'fall' | 'obstacle' | null>(null);

  // Modals
  const [showSettings, setShowSettings] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);

  // Touch state
  const [touchLeft, setTouchLeft] = useState(false);
  const [touchRight, setTouchRight] = useState(false);

  // Mutable Game Simulation References (Decoupled from 60fps React render)
  const ballRef = useRef<BallPhysics>(createInitialBallState());
  const trackSegmentsRef = useRef<TrackSegment[]>([]);
  const generatorStateRef = useRef<GeneratorState>(createInitialGeneratorState('normal'));
  const inputAxisRef = useRef<number>(0);
  const keysPressedRef = useRef<Set<string>>(new Set());
  const gameStateRef = useRef<GameState>('title');
  const activeModeRef = useRef<GameMode>('normal');
  const settingsRef = useRef<GameSettings>(settings);
  const animFrameRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);
  const scoreRef = useRef<number>(0);

  // Keep refs in sync with state
  useEffect(() => {
    gameStateRef.current = gameState;
    document.body.dataset.state = gameState;
  }, [gameState]);

  useEffect(() => {
    activeModeRef.current = activeMode;
  }, [activeMode]);

  useEffect(() => {
    settingsRef.current = settings;
    if (engineRef.current) {
      engineRef.current.updateSettings(settings);
    }
    saveSettings(settings);
  }, [settings]);

  // Load initial scores and name
  useEffect(() => {
    setBestNormal(loadBestScore('normal'));
    setBestHard(loadBestScore('hard'));
    setPlayerName(loadPlayerName());
  }, []);

  // Update input axis from keyboard state
  const updateInputFromKeys = useCallback(() => {
    const left =
      keysPressedRef.current.has('ArrowLeft') ||
      keysPressedRef.current.has('KeyA') ||
      touchLeft;
    const right =
      keysPressedRef.current.has('ArrowRight') ||
      keysPressedRef.current.has('KeyD') ||
      touchRight;

    if (left && right) {
      inputAxisRef.current = 0;
    } else if (left) {
      inputAxisRef.current = -1;
    } else if (right) {
      inputAxisRef.current = 1;
    } else {
      inputAxisRef.current = 0;
    }
  }, [touchLeft, touchRight]);

  useEffect(() => {
    updateInputFromKeys();
  }, [touchLeft, touchRight, updateInputFromKeys]);

  // Start or restart a run
  const startGame = useCallback((mode: GameMode) => {
    setActiveMode(mode);
    activeModeRef.current = mode;

    // Reset ball physics
    const newBall = createInitialBallState();
    const phys = mode === 'hard' ? HARD_PHYSICS : NORMAL_PHYSICS;
    newBall.vz = phys.baseSpeed;
    ballRef.current = newBall;

    // Reset track generator
    const newGen = createInitialGeneratorState(mode, Math.floor(Math.random() * 100000));
    generatorStateRef.current = newGen;

    // Initial track population
    const initialSegments = populateTrack([], newGen, 0, 260);
    trackSegmentsRef.current = initialSegments;

    if (engineRef.current) {
      engineRef.current.syncTrackSegments(initialSegments);
      engineRef.current.updateBall(newBall, 0.016);
      engineRef.current.updateCamera(newBall, 0.016);
    }

    scoreRef.current = 0;
    setScore(0);
    setSpeed(phys.baseSpeed);
    setBoostActive(false);
    setCauseOfDeath(null);
    setGameState('playing');

    // Start background music if enabled
    if (settingsRef.current.music) {
      audioManager.startMusic();
    }
  }, []);

  // Return to Main Menu
  const quitToMenu = useCallback(() => {
    audioManager.stopAll();
    setGameState('title');

    // Create scenic idle track
    const newGen = createInitialGeneratorState('normal', 12345);
    generatorStateRef.current = newGen;
    const initialSegments = populateTrack([], newGen, 0, 180);
    trackSegmentsRef.current = initialSegments;

    const idleBall = createInitialBallState();
    idleBall.vz = 14;
    ballRef.current = idleBall;

    if (engineRef.current) {
      engineRef.current.syncTrackSegments(initialSegments);
    }
  }, []);

  // Handle Game Over
  const handleGameOver = useCallback((cause: 'fall' | 'obstacle') => {
    setCauseOfDeath(cause);
    if (cause === 'fall') {
      audioManager.playFall();
    } else {
      audioManager.playCrash();
    }

    const finalDistance = scoreRef.current;
    const currentMode = activeModeRef.current;

    // Check & save best score
    saveBestScore(currentMode, finalDistance);
    if (currentMode === 'hard') {
      setBestHard((prev) => Math.max(prev, finalDistance));
    } else {
      setBestNormal((prev) => Math.max(prev, finalDistance));
    }

    // Add entry to local records
    const updatedRecords = addRecord({
      name: playerName,
      score: finalDistance,
      mode: currentMode,
      date: new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
    });
    setRecords(updatedRecords);

    // Brief delay for crash visual before showing modal
    setTimeout(() => {
      setGameState('gameover');
    }, 450);
  }, [playerName]);

  // Main Animation & Physics Loop
  useEffect(() => {
    if (!canvasMountRef.current) return;

    // Initialize 3D Engine
    const engine = new GameEngine(canvasMountRef.current, settingsRef.current);
    engineRef.current = engine;

    // Generate initial track for title screen
    const initialGen = createInitialGeneratorState('normal', 42);
    generatorStateRef.current = initialGen;
    const initialSegments = populateTrack([], initialGen, 0, 180);
    trackSegmentsRef.current = initialSegments;
    engine.syncTrackSegments(initialSegments);

    // Check autostart query parameter
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('autostart') === '1') {
      startGame('normal');
    }

    lastTimeRef.current = performance.now();
    let lastHudUpdateTime = 0;

    const isSoftware = engine.getIsSoftwareGl();

    const loop = (currentTime: number) => {
      const rawDt = (currentTime - lastTimeRef.current) / 1000;
      lastTimeRef.current = currentTime;
      // Clamped dt to prevent tunneling or physics explosion on tab-switch
      const dt = Math.min(rawDt, 0.05);

      const currentGameState = gameStateRef.current;
      const currentMode = activeModeRef.current;
      const physParams = currentMode === 'hard' ? HARD_PHYSICS : NORMAL_PHYSICS;

      if (currentGameState === 'playing') {
        const prevAlive = ballRef.current.alive;

        // Step physics
        const stepResult = stepBallPhysics(
          ballRef.current,
          inputAxisRef.current,
          settingsRef.current.sensitivity,
          physParams,
          trackSegmentsRef.current,
          dt
        );

        ballRef.current = stepResult.ball;

        // Audio triggers
        if (stepResult.boostTriggered) audioManager.playBoost();
        if (stepResult.jumpTriggered) audioManager.playJump();

        // Continuous rolling hum audio
        audioManager.updateRollingSound(
          ballRef.current.vz,
          ballRef.current.grounded,
          ballRef.current.alive
        );

        // Check death edge
        if (prevAlive && !ballRef.current.alive) {
          handleGameOver(ballRef.current.causeOfDeath || 'fall');
        }

        // Update score while alive and on valid forward progress
        if (ballRef.current.alive && ballRef.current.y > -5) {
          const newScore = Math.max(scoreRef.current, Math.floor(ballRef.current.z));
          scoreRef.current = newScore;
        }

        // Maintain track ahead of player & recycle passed segments
        const updatedSegments = populateTrack(
          trackSegmentsRef.current,
          generatorStateRef.current,
          ballRef.current.z,
          260
        );
        if (updatedSegments !== trackSegmentsRef.current) {
          trackSegmentsRef.current = updatedSegments;
          engine.syncTrackSegments(updatedSegments);
        }

        // Dynamic obstacle animations in Three.js
        engine.updateDynamicObstacles(trackSegmentsRef.current);

        // Update scenery skyscrapers
        engine.updateScenery(ballRef.current.z);

        // Throttle React HUD updates to 10Hz to prevent reconciliation lag
        if (currentTime - lastHudUpdateTime > 100) {
          lastHudUpdateTime = currentTime;
          setScore(scoreRef.current);
          setSpeed(ballRef.current.vz);
          setBoostActive(ballRef.current.boostTimer > 0);
        }
      } else if (currentGameState === 'title') {
        // In Title Menu: ball gently idles forward along track, sitting flush on top of surface
        ballRef.current.z += 12 * dt;
        ballRef.current.pitch += (12 * dt) / ballRef.current.radius;
        ballRef.current.x = Math.sin(currentTime * 0.001) * 2.0;
        ballRef.current.y = INITIAL_BALL_Y;
        ballRef.current.vy = 0;
        ballRef.current.grounded = true;

        // Populate track ahead in title
        const updatedSegments = populateTrack(
          trackSegmentsRef.current,
          generatorStateRef.current,
          ballRef.current.z,
          180
        );
        if (updatedSegments !== trackSegmentsRef.current) {
          trackSegmentsRef.current = updatedSegments;
          engine.syncTrackSegments(updatedSegments);
        }
        engine.updateScenery(ballRef.current.z);
      }

      // Update 3D transforms & Camera
      engine.updateBall(ballRef.current, dt);
      engine.updateCamera(ballRef.current, dt);

      // Render Scene
      engine.render();

      // Pace loop based on hardware or software WebGL
      animFrameRef.current = requestAnimationFrame(loop);
    };

    animFrameRef.current = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(animFrameRef.current);
      engine.dispose();
      audioManager.stopAll();
    };
  }, [handleGameOver, startGame]);

  // Window Keyboard Listeners
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // First gesture audio trigger
      audioManager.init();

      // Avoid scrolling on arrow keys or space
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
        e.preventDefault();
      }

      keysPressedRef.current.add(e.code);
      updateInputFromKeys();

      // Global hotkeys
      if (e.code === 'KeyM') {
        setSettings((prev) => {
          const next = { ...prev, sound: !prev.sound };
          audioManager.setSoundEnabled(next.sound);
          return next;
        });
      }

      if (e.code === 'Escape') {
        if (showSettings) setShowSettings(false);
        else if (showLeaderboard) setShowLeaderboard(false);
        else if (gameStateRef.current === 'playing') quitToMenu();
      }

      // Space / Enter start from Title
      if (
        (e.code === 'Space' || e.code === 'Enter') &&
        gameStateRef.current === 'title' &&
        !showSettings &&
        !showLeaderboard
      ) {
        startGame('normal');
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      keysPressedRef.current.delete(e.code);
      updateInputFromKeys();
    };

    const handleBlur = () => {
      keysPressedRef.current.clear();
      updateInputFromKeys();
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);
    document.addEventListener('visibilitychange', handleBlur);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);
      document.removeEventListener('visibilitychange', handleBlur);
    };
  }, [updateInputFromKeys, showSettings, showLeaderboard, quitToMenu, startGame]);

  // Change player name handler
  const handlePlayerNameChange = (name: string) => {
    setPlayerName(name);
    savePlayerName(name);
  };

  // Toggle sound handler for HUD
  const handleToggleSound = () => {
    setSettings((prev) => {
      const next = { ...prev, sound: !prev.sound };
      audioManager.setSoundEnabled(next.sound);
      return next;
    });
  };

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#05020a] select-none touch-none">
      {/* Three.js Isolated Canvas Mount */}
      <div ref={canvasMountRef} className="absolute inset-0 w-full h-full z-0" />

      {/* Title Screen Overlay */}
      {gameState === 'title' && (
        <Menu
          playerName={playerName}
          onPlayerNameChange={handlePlayerNameChange}
          bestNormal={bestNormal}
          bestHard={bestHard}
          onStartGame={startGame}
          onOpenSettings={() => setShowSettings(true)}
          onOpenLeaderboard={() => setShowLeaderboard(true)}
        />
      )}

      {/* Active Game HUD */}
      {gameState === 'playing' && (
        <>
          <HUD
            score={score}
            bestScore={activeMode === 'hard' ? bestHard : bestNormal}
            mode={activeMode}
            speed={speed}
            boostActive={boostActive}
            soundEnabled={settings.sound}
            onToggleSound={handleToggleSound}
            onQuitToMenu={quitToMenu}
          />
          {/* Mobile on-screen touch controls */}
          <TouchControls
            onSteer={(dir) => {
              inputAxisRef.current = dir;
            }}
            leftActive={touchLeft}
            rightActive={touchRight}
            setLeftActive={setTouchLeft}
            setRightActive={setTouchRight}
          />
        </>
      )}

      {/* Game Over Screen */}
      {gameState === 'gameover' && (
        <GameOver
          score={score}
          bestScore={activeMode === 'hard' ? bestHard : bestNormal}
          mode={activeMode}
          cause={causeOfDeath}
          onTryAgain={() => startGame(activeMode)}
          onMainMenu={quitToMenu}
        />
      )}

      {/* Settings Modal */}
      {showSettings && (
        <SettingsModal
          settings={settings}
          onUpdateSettings={setSettings}
          onClearRecords={() => {
            clearAllRecords();
            setBestNormal(0);
            setBestHard(0);
            setRecords([]);
          }}
          onClose={() => setShowSettings(false)}
        />
      )}

      {/* Leaderboard Modal */}
      {showLeaderboard && (
        <LeaderboardModal
          records={records}
          onClose={() => setShowLeaderboard(false)}
        />
      )}
    </div>
  );
}
