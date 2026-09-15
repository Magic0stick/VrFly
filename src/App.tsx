import { useEffect, useRef, useState } from 'react';
import { VRGame } from './game/Game';

function App() {
  const containerRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<VRGame | null>(null);
  const [isVRSupported, setIsVRSupported] = useState(false);
  const [showInstructions, setShowInstructions] = useState(true);
  const [started, setStarted] = useState(false);

  useEffect(() => {
    // Check VR support
    if (navigator.xr) {
      navigator.xr.isSessionSupported('immersive-vr').then((supported) => {
        setIsVRSupported(supported);
      });
    }
  }, []);

  const startGame = () => {
    if (!containerRef.current || gameRef.current) return;
    
    const game = new VRGame(containerRef.current);
    game.setupDesktopControls();
    gameRef.current = game;
    setStarted(true);
    setShowInstructions(false);
  };

  const enterVR = async () => {
    if (gameRef.current) {
      await gameRef.current.enterVR();
    }
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
        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-b from-gray-900 via-gray-800 to-black z-50">
          <div className="text-center p-8 max-w-2xl">
            <h1 className="text-5xl font-bold text-green-400 mb-4 animate-pulse">
              🛩️ SKY BUG HUNTER VR
            </h1>
            <p className="text-xl text-gray-300 mb-8">
              Браузерная VR-игра для Meta Quest 2
            </p>
            
            <div className="bg-gray-800/80 rounded-xl p-6 mb-8 text-left border border-green-500/30">
              <h2 className="text-2xl font-bold text-green-400 mb-4">🎮 Управление:</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-gray-300">
                <div>
                  <p className="text-yellow-400 font-bold mb-2">VR (Quest 2):</p>
                  <ul className="space-y-1 text-sm">
                    <li>🕹️ Левый стик - руль/тангаж</li>
                    <li>🕹️ Правый стик - газ</li>
                    <li>🔴 Триггер + кнопка - действие</li>
                    <li>👆 Физически нажимай рычаги!</li>
                  </ul>
                </div>
                <div>
                  <p className="text-yellow-400 font-bold mb-2">Десктоп:</p>
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
            
            <div className="bg-gray-800/80 rounded-xl p-6 mb-8 text-left border border-blue-500/30">
              <h2 className="text-2xl font-bold text-blue-400 mb-4">📋 Задачи:</h2>
              <ul className="text-gray-300 space-y-2">
                <li>🐛 Уничтожай жуков пулемётом (+10 очков)</li>
                <li>🤖 Сбивай вражеские дроны (+50 очков)</li>
                <li>🪂 Сбрасывай десант на территорию (+25 очков)</li>
                <li>🎛️ Управляй рычагами в кабине</li>
                <li>🔘 Нажимай кнопки на панели</li>
                <li>✈️ Держи самолёт в воздухе!</li>
              </ul>
            </div>
            
            <div className="flex gap-4 justify-center flex-wrap">
              <button
                onClick={startGame}
                className="px-8 py-4 bg-green-600 hover:bg-green-500 text-white font-bold text-xl rounded-lg 
                         transform hover:scale-105 transition-all shadow-lg shadow-green-500/30"
              >
                🚀 НАЧАТЬ ИГРУ
              </button>
              
              {isVRSupported && (
                <button
                  onClick={() => { startGame(); setTimeout(enterVR, 1000); }}
                  className="px-8 py-4 bg-purple-600 hover:bg-purple-500 text-white font-bold text-xl rounded-lg 
                           transform hover:scale-105 transition-all shadow-lg shadow-purple-500/30"
                >
                  🥽 ВОЙТИ В VR
                </button>
              )}
            </div>
            
            {!isVRSupported && (
              <p className="text-yellow-400 mt-4 text-sm">
                ⚠️ VR не обнаружен. Играйте в десктопном режиме!
                <br/>Для VR откройте на Quest 2 в браузере Oculus/Meta
              </p>
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
          </div>
        </div>
      )}
      
      {/* VR button (in-game) */}
      {started && isVRSupported && (
        <div className="absolute bottom-4 right-4 z-40">
          <button
            onClick={enterVR}
            className="px-6 py-3 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-lg 
                     transform hover:scale-105 transition-all shadow-lg"
          >
            🥽 VR РЕЖИМ
          </button>
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
