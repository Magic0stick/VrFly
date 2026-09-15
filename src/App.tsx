import { useEffect, useRef, useState } from 'react';
import { VRGame } from './game/Game';

function App() {
  const containerRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<VRGame | null>(null);
  const [isVRSupported, setIsVRSupported] = useState(false);
  const [isSteamVRAvailable, setIsSteamVRAvailable] = useState(false);
  const [showInstructions, setShowInstructions] = useState(true);
  const [started, setStarted] = useState(false);
  const [vrSystem, setVrSystem] = useState<string>('');

  useEffect(() => {
    // Check VR support
    if (navigator.xr) {
      navigator.xr.isSessionSupported('immersive-vr').then((supported) => {
        setIsVRSupported(supported);
        
        // Detect SteamVR
        detectSteamVR();
      });
    }
  }, []);

  const detectSteamVR = async () => {
    // Check if SteamVR is available
    // SteamVR exposes itself through WebXR when running
    try {
      const ua = navigator.userAgent.toLowerCase();
      
      // Direct SteamVR browser
      if (ua.includes('steamvr') || ua.includes('valve')) {
        setIsSteamVRAvailable(true);
        return;
      }
      
      // Check if we're on desktop (SteamVR runs on desktop)
      const isDesktop = !ua.includes('mobile') && !ua.includes('android') && !ua.includes('oculus');
      
      if (isDesktop && navigator.xr) {
        // On desktop with WebXR support, SteamVR is likely available
        const supported = await navigator.xr.isSessionSupported('immersive-vr');
        if (supported) {
          setIsSteamVRAvailable(true);
        }
      }
      
      // Also check for ALVR/Virtual Desktop (Quest streaming to SteamVR)
      if (ua.includes('alvr') || ua.includes('virtual desktop')) {
        setIsSteamVRAvailable(true);
      }
    } catch (e) {
      console.warn('SteamVR detection failed:', e);
    }
  };

  const startGame = () => {
    if (!containerRef.current || gameRef.current) return;
    
    const game = new VRGame(containerRef.current);
    game.setupDesktopControls();
    gameRef.current = game;
    setStarted(true);
    setShowInstructions(false);
  };

  const enterVR = async (mode: 'auto' | 'steamvr' | 'oculus' = 'auto') => {
    if (gameRef.current) {
      await gameRef.current.enterVR(mode);
      // Update VR system info after entering
      setTimeout(() => {
        if (gameRef.current) {
          setVrSystem(gameRef.current.getVRSystem());
        }
      }, 1000);
    }
  };

  const startWithSteamVR = async () => {
    startGame();
    setTimeout(() => enterVR('steamvr'), 500);
  };

  const startWithOculus = async () => {
    startGame();
    setTimeout(() => enterVR('oculus'), 500);
  };

  useEffect(() => {
    return () => {
      if (gameRef.current) {
        gameRef.current.dispose();
      }
    };
  }, []);

  return (
    <div className="w-full h-screen relative overflow-hidden bg-black">
      {/* Game container */}
      <div ref={containerRef} className="w-full h-full" />
      
      {/* Start screen */}
      {!started && (
        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-b from-gray-900 via-gray-800 to-black z-50 overflow-y-auto">
          <div className="text-center p-8 max-w-3xl my-4">
            <h1 className="text-5xl font-bold text-green-400 mb-4 animate-pulse">
              🛩️ SKY BUG HUNTER VR
            </h1>
            <p className="text-xl text-gray-300 mb-6">
              Браузерная VR-игра • Поддержка SteamVR & Meta Quest
            </p>
            
            {/* VR System Detection */}
            <div className="bg-gray-800/60 rounded-lg p-3 mb-6 inline-block border border-gray-600">
              <p className="text-sm text-gray-400">
                WebXR: {isVRSupported ? '✅ Поддерживается' : '❌ Не обнаружен'}
                {isSteamVRAvailable && ' • 🎮 SteamVR доступен'}
              </p>
            </div>
            
            <div className="bg-gray-800/80 rounded-xl p-6 mb-6 text-left border border-green-500/30">
              <h2 className="text-2xl font-bold text-green-400 mb-4">🎮 Управление:</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-gray-300">
                <div>
                  <p className="text-yellow-400 font-bold mb-2">🎮 SteamVR:</p>
                  <p className="text-xs text-gray-500 mb-1">(Index / Vive / WMR)</p>
                  <ul className="space-y-1 text-sm">
                    <li>🕹️ Лев. стик - руль/тангаж</li>
                    <li>🕹️ Прав. стик - газ</li>
                    <li>🔫 Grip (прав.) - пулемёт</li>
                    <li>🪂 X/A (лев.) - десант</li>
                    <li>🚀 Y/B - ускорение</li>
                    <li>☝️ Trigger - взаимодействие</li>
                  </ul>
                </div>
                <div>
                  <p className="text-yellow-400 font-bold mb-2">🥽 Oculus/Meta:</p>
                  <p className="text-xs text-gray-500 mb-1">(Quest 2/3/Pro)</p>
                  <ul className="space-y-1 text-sm">
                    <li>🕹️ Лев. стик - руль/тангаж</li>
                    <li>🕹️ Прав. стик - газ</li>
                    <li>🔫 Grip (прав.) - пулемёт</li>
                    <li>🪂 X (лев.) - десант</li>
                    <li>🚀 Y - ускорение</li>
                    <li>☝️ Trigger - кнопки/рычаги</li>
                  </ul>
                </div>
                <div>
                  <p className="text-yellow-400 font-bold mb-2">⌨️ Десктоп:</p>
                  <p className="text-xs text-gray-500 mb-1">(без VR)</p>
                  <ul className="space-y-1 text-sm">
                    <li>⌨️ W/S - тангаж</li>
                    <li>⌨️ A/D - крен</li>
                    <li>⌨️ Shift/Ctrl - газ</li>
                    <li>⌨️ Пробел - пулемёт</li>
                    <li>⌨️ E - сброс десанта</li>
                    <li>🖱️ Мышь - обзор</li>
                  </ul>
                </div>
              </div>
            </div>
            
            <div className="bg-gray-800/80 rounded-xl p-6 mb-6 text-left border border-blue-500/30">
              <h2 className="text-2xl font-bold text-blue-400 mb-4">📋 Задачи:</h2>
              <ul className="text-gray-300 space-y-2">
                <li>🐛 Уничтожай жуков пулемётом (+10 очков)</li>
                <li>🤖 Сбивай вражеские дроны (+50 очков)</li>
                <li>🪂 Сбрасывай десант в зону высадки (+50 в зоне, +25 вне)</li>
                <li>🎛️ Физически нажимай рычаги и кнопки в кабине</li>
                <li>✈️ Управляй самолётом и держи его в воздухе!</li>
              </ul>
            </div>
            
            {/* SteamVR Instructions */}
            <div className="bg-gray-800/80 rounded-xl p-6 mb-6 text-left border border-purple-500/30">
              <h2 className="text-2xl font-bold text-purple-400 mb-4">🎮 Подключение SteamVR:</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-gray-300 text-sm">
                <div>
                  <p className="text-purple-300 font-bold mb-2">Valve Index / Vive / WMR:</p>
                  <ol className="list-decimal list-inside space-y-1">
                    <li>Запусти Steam и SteamVR</li>
                    <li>Подключи гарнитуру и контроллеры</li>
                    <li>Открой эту страницу в Chrome/Edge</li>
                    <li>Нажми "🎮 STEAMVR"</li>
                  </ol>
                </div>
                <div>
                  <p className="text-purple-300 font-bold mb-2">Quest через SteamVR (ALVR):</p>
                  <ol className="list-decimal list-inside space-y-1">
                    <li>Установи ALVR на ПК и Quest</li>
                    <li>Запусти SteamVR + ALVR сервер</li>
                    <li>Подключи Quest к ALVR</li>
                    <li>Открой страницу в SteamVR Browser</li>
                  </ol>
                </div>
                <div>
                  <p className="text-purple-300 font-bold mb-2">Quest через Virtual Desktop:</p>
                  <ol className="list-decimal list-inside space-y-1">
                    <li>Установи Virtual Desktop</li>
                    <li>Запусти стрим на Quest</li>
                    <li>Открой браузер в Virtual Desktop</li>
                    <li>Перейди на эту страницу</li>
                  </ol>
                </div>
                <div>
                  <p className="text-purple-300 font-bold mb-2">Quest напрямую (Oculus Browser):</p>
                  <ol className="list-decimal list-inside space-y-1">
                    <li>Открой Oculus Browser на Quest</li>
                    <li>Перейди по ссылке на игру</li>
                    <li>Нажми "🥽 OCULUS VR"</li>
                    <li>Надень гарнитуру!</li>
                  </ol>
                </div>
              </div>
              
              {/* Supported devices */}
              <div className="mt-4 pt-4 border-t border-purple-500/20">
                <p className="text-purple-300 font-bold mb-2">✅ Поддерживаемые устройства SteamVR:</p>
                <div className="flex flex-wrap gap-2 text-xs">
                  <span className="bg-purple-900/50 px-2 py-1 rounded">Valve Index</span>
                  <span className="bg-purple-900/50 px-2 py-1 rounded">HTC Vive</span>
                  <span className="bg-purple-900/50 px-2 py-1 rounded">HTC Vive Pro</span>
                  <span className="bg-purple-900/50 px-2 py-1 rounded">HTC Vive Cosmos</span>
                  <span className="bg-purple-900/50 px-2 py-1 rounded">Windows MR</span>
                  <span className="bg-purple-900/50 px-2 py-1 rounded">Samsung HMD</span>
                  <span className="bg-purple-900/50 px-2 py-1 rounded">HP Reverb G2</span>
                  <span className="bg-purple-900/50 px-2 py-1 rounded">Pimax</span>
                  <span className="bg-purple-900/50 px-2 py-1 rounded">Bigscreen Beyond</span>
                  <span className="bg-blue-900/50 px-2 py-1 rounded">Quest 2 (ALVR/VD)</span>
                  <span className="bg-blue-900/50 px-2 py-1 rounded">Quest 3 (ALVR/VD)</span>
                  <span className="bg-blue-900/50 px-2 py-1 rounded">Quest Pro (ALVR/VD)</span>
                </div>
                <p className="text-purple-300 font-bold mb-2 mt-3">✅ Поддерживаемые контроллеры:</p>
                <div className="flex flex-wrap gap-2 text-xs">
                  <span className="bg-green-900/50 px-2 py-1 rounded">Index Knuckles</span>
                  <span className="bg-green-900/50 px-2 py-1 rounded">Vive Wands</span>
                  <span className="bg-green-900/50 px-2 py-1 rounded">Vive Cosmos Controllers</span>
                  <span className="bg-green-900/50 px-2 py-1 rounded">WMR Motion Controllers</span>
                  <span className="bg-green-900/50 px-2 py-1 rounded">HP Reverb Controllers</span>
                  <span className="bg-green-900/50 px-2 py-1 rounded">Oculus Touch</span>
                  <span className="bg-green-900/50 px-2 py-1 rounded">Meta Quest Touch Pro</span>
                  <span className="bg-green-900/50 px-2 py-1 rounded">Hand Tracking</span>
                </div>
              </div>
            </div>
            
            <div className="flex gap-3 justify-center flex-wrap">
              <button
                onClick={startGame}
                className="px-6 py-4 bg-green-600 hover:bg-green-500 text-white font-bold text-lg rounded-lg 
                         transform hover:scale-105 transition-all shadow-lg shadow-green-500/30"
              >
                🖥️ ДЕСКТОП
              </button>
              
              {isSteamVRAvailable && (
                <button
                  onClick={startWithSteamVR}
                  className="px-6 py-4 bg-purple-600 hover:bg-purple-500 text-white font-bold text-lg rounded-lg 
                           transform hover:scale-105 transition-all shadow-lg shadow-purple-500/30"
                >
                  🎮 STEAMVR
                </button>
              )}
              
              {isVRSupported && (
                <button
                  onClick={startWithOculus}
                  className="px-6 py-4 bg-blue-600 hover:bg-blue-500 text-white font-bold text-lg rounded-lg 
                           transform hover:scale-105 transition-all shadow-lg shadow-blue-500/30"
                >
                  🥽 OCULUS VR
                </button>
              )}
              
              {!isVRSupported && !isSteamVRAvailable && (
                <button
                  onClick={startGame}
                  className="px-6 py-4 bg-gray-600 text-white font-bold text-lg rounded-lg cursor-not-allowed opacity-50"
                  disabled
                >
                  🥽 VR не обнаружен
                </button>
              )}
            </div>
            
            {!isVRSupported && !isSteamVRAvailable && (
              <div className="mt-4 p-3 bg-yellow-900/30 border border-yellow-500/30 rounded-lg">
                <p className="text-yellow-400 text-sm">
                  ⚠️ VR не обнаружен. Для VR режима:
                  <br/>• <strong>SteamVR:</strong> Запусти SteamVR и открой эту страницу в Chrome/Edge
                  <br/>• <strong>Quest 2:</strong> Открой в Oculus Browser или через ALVR/Virtual Desktop
                  <br/>• <strong>ALVR:</strong> Бесплатный способ подключить Quest к SteamVR
                </p>
              </div>
            )}
          </div>
        </div>
      )}
      
      {/* In-game HUD overlay */}
      {started && (
        <div className="absolute top-4 left-4 z-40 pointer-events-none">
          <div className="bg-black/60 rounded-lg p-3 border border-green-500/30">
            <p className="text-green-400 font-mono text-sm">
              WASD - управление | SPACE - огонь | E - десант
            </p>
            {vrSystem && (
              <p className="text-purple-400 font-mono text-xs mt-1">
                VR: {vrSystem === 'steamvr' ? '🎮 SteamVR' : vrSystem === 'oculus' ? '🥽 Oculus' : vrSystem}
              </p>
            )}
          </div>
        </div>
      )}
      
      {/* VR buttons (in-game) */}
      {started && (
        <div className="absolute bottom-4 right-4 z-40 flex gap-2">
          {isSteamVRAvailable && !vrSystem && (
            <button
              onClick={() => enterVR('steamvr')}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-lg 
                       transform hover:scale-105 transition-all shadow-lg text-sm"
            >
              🎮 SteamVR
            </button>
          )}
          {isVRSupported && !vrSystem && (
            <button
              onClick={() => enterVR('oculus')}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg 
                       transform hover:scale-105 transition-all shadow-lg text-sm"
            >
              🥽 Oculus
            </button>
          )}
        </div>
      )}
      
      {/* Instructions toggle */}
      {started && showInstructions && (
        <div className="absolute top-4 right-4 z-40">
          <button
            onClick={() => setShowInstructions(false)}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm"
          >
            ✕ Закрыть
          </button>
        </div>
      )}
    </div>
  );
}

export default App;
