import { useEffect, useRef, useState } from 'react';
import { VRGame } from './game/Game';

function App() {
  const containerRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<VRGame | null>(null);
  const [isVRSupported, setIsVRSupported] = useState(false);
  const [isSteamVRAvailable, setIsSteamVRAvailable] = useState(false);
  const [started, setStarted] = useState(false);
  const [vrSystem, setVrSystem] = useState<string>('');
  const [roomCode, setRoomCode] = useState<string>('');
  const [joinCode, setJoinCode] = useState<string>('');
  const [playerCount, setPlayerCount] = useState<number>(1);
  const [isConnected, setIsConnected] = useState(false);
  const [showLobby, setShowLobby] = useState(true);

  useEffect(() => {
    if (navigator.xr) {
      navigator.xr.isSessionSupported('immersive-vr').then((supported) => {
        setIsVRSupported(supported);
        detectSteamVR();
      });
    }
  }, []);

  const detectSteamVR = async () => {
    try {
      const ua = navigator.userAgent.toLowerCase();
      if (ua.includes('steamvr') || ua.includes('valve')) {
        setIsSteamVRAvailable(true);
        return;
      }
      const isDesktop = !ua.includes('mobile') && !ua.includes('android') && !ua.includes('oculus');
      if (isDesktop && navigator.xr) {
        const supported = await navigator.xr.isSessionSupported('immersive-vr');
        if (supported) {
          setIsSteamVRAvailable(true);
        }
      }
      if (ua.includes('alvr') || ua.includes('virtual desktop')) {
        setIsSteamVRAvailable(true);
      }
    } catch (e) {
      console.warn('SteamVR detection failed:', e);
    }
  };

  const startGame = async () => {
    if (!containerRef.current || gameRef.current) return;
    
    const game = new VRGame(containerRef.current);
    game.setupDesktopControls();
    gameRef.current = game;
    setStarted(true);
    setShowLobby(true);
    
    // Initialize multiplayer
    try {
      const code = await game.initializeMultiplayer();
      setRoomCode(code);
      setIsConnected(true);
    } catch (e) {
      console.error('Multiplayer init failed:', e);
    }
  };

  const joinRoom = async () => {
    if (!gameRef.current || !joinCode) return;
    try {
      await gameRef.current.joinMultiplayerRoom(joinCode);
      setIsConnected(true);
      setShowLobby(false);
    } catch (e) {
      console.error('Failed to join room:', e);
      alert('Не удалось подключиться к комнате. Проверьте код.');
    }
  };

  const enterVR = async (mode: 'auto' | 'steamvr' | 'oculus' = 'auto') => {
    if (gameRef.current) {
      await gameRef.current.enterVR(mode);
      setTimeout(() => {
        if (gameRef.current) {
          setVrSystem(gameRef.current.getVRSystem());
        }
      }, 1000);
    }
  };

  // Update player count periodically
  useEffect(() => {
    const interval = setInterval(() => {
      if (gameRef.current) {
        setPlayerCount(gameRef.current.getPlayerCount());
      }
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    return () => {
      if (gameRef.current) {
        gameRef.current.dispose();
      }
    };
  }, []);

  return (
    <div className="w-full h-screen relative overflow-hidden bg-black">
      <div ref={containerRef} className="w-full h-full" />
      
      {!started && (
        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-b from-gray-900 via-gray-800 to-black z-50 overflow-y-auto">
          <div className="text-center p-8 max-w-3xl my-4">
            <h1 className="text-5xl font-bold text-green-400 mb-4 animate-pulse">
              🛩️ SKY BUG HUNTER VR
            </h1>
            <p className="text-xl text-gray-300 mb-6">
              Мультиплеерная VR-игра • Поддержка SteamVR & Meta Quest
            </p>
            
            <div className="bg-gray-800/60 rounded-lg p-3 mb-6 inline-block border border-gray-600">
              <p className="text-sm text-gray-400">
                WebXR: {isVRSupported ? '✅' : '❌'}
                {isSteamVRAvailable && ' • 🎮 SteamVR'}
              </p>
            </div>
            
            {/* Multiplayer section */}
            <div className="bg-gray-800/80 rounded-xl p-6 mb-6 text-left border border-yellow-500/30">
              <h2 className="text-2xl font-bold text-yellow-400 mb-4">👥 Мультиплеер:</h2>
              <p className="text-gray-300 mb-4">
                Играйте вместе с друзьями! Десант - это другие игроки.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-gray-700/50 p-4 rounded-lg">
                  <p className="text-yellow-300 font-bold mb-2">Создать комнату:</p>
                  <p className="text-sm text-gray-400 mb-3">Начните игру и поделитесь кодом с друзьями</p>
                  <button
                    onClick={startGame}
                    className="w-full px-4 py-2 bg-yellow-600 hover:bg-yellow-500 text-white font-bold rounded-lg transition-all"
                  >
                    🎮 НАЧАТЬ ИГРУ
                  </button>
                </div>
                <div className="bg-gray-700/50 p-4 rounded-lg">
                  <p className="text-yellow-300 font-bold mb-2">Присоединиться:</p>
                  <p className="text-sm text-gray-400 mb-3">Введите код комнаты от друга</p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={joinCode}
                      onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                      placeholder="КОД"
                      maxLength={6}
                      className="flex-1 px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white text-center font-mono uppercase"
                    />
                    <button
                      onClick={() => { startGame(); setTimeout(joinRoom, 1000); }}
                      className="px-4 py-2 bg-green-600 hover:bg-green-500 text-white font-bold rounded-lg transition-all"
                    >
                      →
                    </button>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Controls */}
            <div className="bg-gray-800/80 rounded-xl p-6 mb-6 text-left border border-green-500/30">
              <h2 className="text-2xl font-bold text-green-400 mb-4">🎮 Управление:</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-gray-300">
                <div>
                  <p className="text-yellow-400 font-bold mb-2">🎮 SteamVR:</p>
                  <ul className="space-y-1 text-sm">
                    <li>🕹️ Лев. стик - руль/тангаж</li>
                    <li>🕹️ Прав. стик - газ</li>
                    <li>🔫 Grip (прав.) - пулемёт</li>
                    <li>🪂 X/A (лев.) - десант</li>
                  </ul>
                </div>
                <div>
                  <p className="text-yellow-400 font-bold mb-2">🥽 Oculus:</p>
                  <ul className="space-y-1 text-sm">
                    <li>🕹️ Лев. стик - руль/тангаж</li>
                    <li>🕹️ Прав. стик - газ</li>
                    <li>🔫 Grip (прав.) - пулемёт</li>
                    <li>🪂 X (лев.) - десант</li>
                  </ul>
                </div>
                <div>
                  <p className="text-yellow-400 font-bold mb-2">⌨️ Десктоп:</p>
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
            
            {/* Tasks */}
            <div className="bg-gray-800/80 rounded-xl p-6 mb-6 text-left border border-blue-500/30">
              <h2 className="text-2xl font-bold text-blue-400 mb-4">📋 Задачи:</h2>
              <ul className="text-gray-300 space-y-2">
                <li>🐛 Уничтожай жуков пулемётом (+10 очков)</li>
                <li>🤖 Сбивай вражеские дроны (+50 очков)</li>
                <li>🪂 Сбрасывай десант (других игроков!) в зону высадки</li>
                <li>🎛️ Физически нажимай рычаги и кнопки в кабине</li>
                <li>✈️ Управляй самолётом и держи его в воздухе!</li>
              </ul>
            </div>
            
            <div className="flex gap-3 justify-center flex-wrap">
              {isVRSupported && (
                <>
                  <button
                    onClick={() => { startGame(); setTimeout(() => enterVR('steamvr'), 1000); }}
                    className="px-6 py-4 bg-purple-600 hover:bg-purple-500 text-white font-bold text-lg rounded-lg transform hover:scale-105 transition-all shadow-lg shadow-purple-500/30"
                  >
                    🎮 STEAMVR
                  </button>
                  <button
                    onClick={() => { startGame(); setTimeout(() => enterVR('oculus'), 1000); }}
                    className="px-6 py-4 bg-blue-600 hover:bg-blue-500 text-white font-bold text-lg rounded-lg transform hover:scale-105 transition-all shadow-lg shadow-blue-500/30"
                  >
                    🥽 OCULUS VR
                  </button>
                </>
              )}
              <button
                onClick={startGame}
                className="px-6 py-4 bg-green-600 hover:bg-green-500 text-white font-bold text-lg rounded-lg transform hover:scale-105 transition-all shadow-lg shadow-green-500/30"
              >
                🖥️ ДЕСКТОП
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Lobby */}
      {started && showLobby && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-40">
          <div className="bg-gray-800 rounded-xl p-8 max-w-md border border-yellow-500/30">
            <h2 className="text-3xl font-bold text-yellow-400 mb-4 text-center">🎮 Лобби</h2>
            
            {roomCode && (
              <div className="mb-6">
                <p className="text-gray-400 text-sm mb-2">Код вашей комнаты:</p>
                <div className="bg-gray-900 rounded-lg p-4 text-center">
                  <p className="text-4xl font-mono font-bold text-green-400 tracking-wider">{roomCode}</p>
                </div>
                <p className="text-gray-400 text-xs mt-2 text-center">
                  Поделитесь этим кодом с друзьями!
                </p>
              </div>
            )}
            
            <div className="mb-6">
              <p className="text-gray-400 text-sm mb-2">Игроков онлайн:</p>
              <p className="text-2xl font-bold text-white text-center">{playerCount}</p>
            </div>
            
            <div className="mb-6">
              <p className="text-gray-400 text-sm mb-2">Присоединиться к комнате:</p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  placeholder="КОД"
                  maxLength={6}
                  className="flex-1 px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white text-center font-mono uppercase"
                />
                <button
                  onClick={joinRoom}
                  className="px-4 py-2 bg-green-600 hover:bg-green-500 text-white font-bold rounded-lg transition-all"
                >
                  →
                </button>
              </div>
            </div>
            
            <button
              onClick={() => setShowLobby(false)}
              className="w-full px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg transition-all"
            >
              ▶️ НАЧАТЬ ИГРУ
            </button>
          </div>
        </div>
      )}
      
      {/* In-game HUD */}
      {started && !showLobby && (
        <>
          <div className="absolute top-4 left-4 z-40 pointer-events-none">
            <div className="bg-black/60 rounded-lg p-3 border border-green-500/30">
              <p className="text-green-400 font-mono text-sm">
                WASD - управление | SPACE - огонь | E - десант
              </p>
              <p className="text-yellow-400 font-mono text-xs mt-1">
                👥 Игроков: {playerCount}
              </p>
              {vrSystem && (
                <p className="text-purple-400 font-mono text-xs mt-1">
                  VR: {vrSystem === 'steamvr' ? '🎮 SteamVR' : vrSystem === 'oculus' ? '🥽 Oculus' : vrSystem}
                </p>
              )}
            </div>
          </div>
          
          {roomCode && (
            <div className="absolute top-4 right-4 z-40 pointer-events-none">
              <div className="bg-black/60 rounded-lg p-2 border border-yellow-500/30">
                <p className="text-yellow-400 font-mono text-xs">
                  Комната: {roomCode}
                </p>
              </div>
            </div>
          )}
          
          <div className="absolute bottom-4 right-4 z-40 flex gap-2">
            {isSteamVRAvailable && !vrSystem && (
              <button
                onClick={() => enterVR('steamvr')}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-lg transform hover:scale-105 transition-all shadow-lg text-sm"
              >
                🎮 SteamVR
              </button>
            )}
            {isVRSupported && !vrSystem && (
              <button
                onClick={() => enterVR('oculus')}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg transform hover:scale-105 transition-all shadow-lg text-sm"
              >
                🥽 Oculus
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default App;
