'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import Link from 'next/link';

interface Player {
  id: string;
  name: string;
  color: string;
  index: number;
  ready: boolean;
  score: number;
  rescuedCount: number;
  isHost: boolean;
  x?: number;
  y?: number;
  angle?: number;
  stamina?: number;
  isSprinting?: boolean;
  swimAnimation?: number;
}

interface Victim {
  id: string;
  x: number;
  y: number;
  dangerLevel: number;
  points: number;
  rescued: boolean;
  rescuedBy: string | null;
}

interface Obstacle {
  id: string;
  x: number;
  y: number;
  penalty: number;
  collected: boolean;
  collectedBy: string | null;
}

interface RoomSettings {
  gameTime: number;
  victimsCount: number;
  obstaclesCount: number;
}

interface GameData {
  victims: Victim[];
  obstacles: Obstacle[];
  players: Player[];
  settings: RoomSettings;
  canvasWidth: number;
  canvasHeight: number;
}

type GameState = 'lobby' | 'waiting' | 'playing' | 'ended';

export default function GamePage() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [gameState, setGameState] = useState<GameState>('lobby');
  const [playerId, setPlayerId] = useState<string>('');
  const [playerName, setPlayerName] = useState<string>('');
  const [roomHost, setRoomHost] = useState<Player | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [roomId, setRoomId] = useState<string>('');
  const [maxRescuers, setMaxRescuers] = useState(4);
  const [settings, setSettings] = useState<RoomSettings>({ gameTime: 60, victimsCount: 7, obstaclesCount: 4 });
  const [isHost, setIsHost] = useState(false);
  const [joinRoomId, setJoinRoomId] = useState('');
  const [gameData, setGameData] = useState<GameData | null>(null);
  const [results, setResults] = useState<Player[]>([]);
  const [toast, setToast] = useState<{ message: string; type: string } | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);
  const keysRef = useRef<Set<string>>(new Set());
  const playerRef = useRef({ x: 100, y: 250, angle: 0, stamina: 100, isSprinting: false, swimAnimation: 0 });
  const victimsRef = useRef<Victim[]>([]);
  const obstaclesRef = useRef<Obstacle[]>([]);
  const gameTimeRef = useRef(60);
  const gameOverRef = useRef(false);

  // Toast notification
  const showToast = useCallback((message: string, type: string = 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 2500);
  }, []);

  // Socket connection
  useEffect(() => {
    const newSocket = io();
    setSocket(newSocket);

    newSocket.on('connect', () => {
      console.log('Connected to server');
    });

    newSocket.on('room_created', (data) => {
      setRoomId(data.roomId);
      setPlayerId(data.playerId);
      setIsHost(true);
      setGameState('waiting');
      showToast('방이 생성되었습니다!', 'success');
    });

    newSocket.on('joined', (data) => {
      setRoomId(data.roomId);
      setPlayerId(data.playerId);
      setGameState('waiting');
      showToast(`방에 참여했습니다! (${data.roomId})`, 'success');
    });

    newSocket.on('room_state', (data) => {
      setPlayers(data.players);
      setMaxRescuers(data.maxRescuers);
      setSettings(data.settings);
      setGameState(data.gameState);
      const host = data.players.find((p: Player) => p.isHost);
      setRoomHost(host);
      if (host?.id === playerId) {
        setIsHost(true);
      }
    });

    newSocket.on('game_start', (data) => {
      const gameData = data.gameData;
      setGameData(gameData);
      victimsRef.current = [...gameData.victims];
      obstaclesRef.current = [...gameData.obstacles];
      gameTimeRef.current = gameData.settings.gameTime;
      gameOverRef.current = false;
      setGameState('playing');
      
      // Find self player
      const selfPlayer = gameData.players.find((p: Player) => p.id === playerId);
      if (selfPlayer) {
        playerRef.current = {
          x: selfPlayer.x || 100,
          y: selfPlayer.y || 250,
          angle: 0,
          stamina: 100,
          isSprinting: false,
          swimAnimation: 0,
        };
      }
    });

    newSocket.on('player_update', (data) => {
      setPlayers(prev => prev.map(p => 
        p.id === data.playerId 
          ? { ...p, x: data.x, y: data.y, angle: data.angle, stamina: data.stamina, isSprinting: data.isSprinting, swimAnimation: data.swimAnimation }
          : p
      ));
    });

    newSocket.on('victim_rescued_event', (data) => {
      victimsRef.current = victimsRef.current.map(v => 
        v.id === data.victimId ? { ...v, rescued: true, rescuedBy: data.playerId } : v
      );
      const victim = victimsRef.current.find(v => v.id === data.victimId);
      if (victim && data.playerId === playerId) {
        showToast(`+${victim.points}점! 구조 성공!`, 'success');
      }
    });

    newSocket.on('obstacle_hit_event', (data) => {
      obstaclesRef.current = obstaclesRef.current.map(o => 
        o.id === data.obstacleId ? { ...o, collected: true, collectedBy: data.playerId } : o
      );
      if (data.playerId === playerId) {
        showToast(`${data.penalty}점! 장애물에 부딪혔습니다!`, 'warning');
      }
    });

    newSocket.on('game_end', (data) => {
      setResults(data.results);
      setGameState('ended');
      gameOverRef.current = true;
    });

    newSocket.on('error', (data) => {
      showToast(data.message, 'error');
    });

    return () => {
      newSocket.disconnect();
    };
  }, [playerId, showToast]);

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      keysRef.current.add(e.key.toLowerCase());
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      keysRef.current.delete(e.key.toLowerCase());
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // Game loop
  useEffect(() => {
    if (gameState !== 'playing' || !canvasRef.current || !gameData) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let lastTime = Date.now();

    const gameLoop = () => {
      if (gameOverRef.current) return;

      const now = Date.now();
      const delta = (now - lastTime) / 1000;
      lastTime = now;

      // Update game time
      gameTimeRef.current -= delta;
      if (gameTimeRef.current <= 0) {
        gameTimeRef.current = 0;
        gameOverRef.current = true;
        socket?.emit('end_game');
        return;
      }

      // Player movement
      const player = playerRef.current;
      const keys = keysRef.current;
      const speed = player.isSprinting ? 120 : 80;
      
      if (keys.has('arrowup') || keys.has('w')) player.y -= speed * delta;
      if (keys.has('arrowdown') || keys.has('s')) player.y += speed * delta;
      if (keys.has('arrowleft') || keys.has('a')) player.x -= speed * delta;
      if (keys.has('arrowright') || keys.has('d')) player.x += speed * delta;

      // Sprint with shift
      player.isSprinting = keys.has('shift') && player.stamina > 0;
      if (player.isSprinting) {
        player.stamina = Math.max(0, player.stamina - 20 * delta);
      } else {
        player.stamina = Math.min(100, player.stamina + 10 * delta);
      }

      // Swimming animation
      if (keys.has('arrowup') || keys.has('arrowdown') || keys.has('arrowleft') || keys.has('arrowright') ||
          keys.has('w') || keys.has('s') || keys.has('a') || keys.has('d')) {
        player.swimAnimation += delta * 8;
      }

      // Bounds
      player.x = Math.max(20, Math.min(canvas.width - 20, player.x));
      player.y = Math.max(20, Math.min(canvas.height - 20, player.y));

      // Check collisions
      victimsRef.current.forEach(v => {
        if (v.rescued) return;
        const dx = player.x - v.x;
        const dy = player.y - v.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 40) {
          v.rescued = true;
          v.rescuedBy = playerId;
          socket?.emit('victim_rescued', { victimId: v.id, points: v.points });
        }
      });

      obstaclesRef.current.forEach(o => {
        if (o.collected) return;
        const dx = player.x - o.x;
        const dy = player.y - o.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 35) {
          o.collected = true;
          o.collectedBy = playerId;
          socket?.emit('obstacle_hit', { obstacleId: o.id, penalty: o.penalty });
        }
      });

      // Send position update
      socket?.emit('player_move', {
        x: player.x,
        y: player.y,
        angle: player.angle,
        isSprinting: player.isSprinting,
        stamina: player.stamina,
        swimAnimation: player.swimAnimation,
      });

      // Render
      render(ctx, canvas);

      animationRef.current = requestAnimationFrame(gameLoop);
    };

    animationRef.current = requestAnimationFrame(gameLoop);

    return () => {
      cancelAnimationFrame(animationRef.current);
    };
  }, [gameState, gameData, socket, playerId]);

  const render = (ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) => {
    // Background - water
    const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    gradient.addColorStop(0, '#00c6ff');
    gradient.addColorStop(1, '#0072ff');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Water waves
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 5; i++) {
      ctx.beginPath();
      for (let x = 0; x < canvas.width; x += 10) {
        const y = canvas.height * (i + 1) / 6 + Math.sin(x / 30 + Date.now() / 500 + i) * 10;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }

    // Victims
    victimsRef.current.forEach(v => {
      if (v.rescued) {
        ctx.globalAlpha = 0.3;
      }
      ctx.fillStyle = '#ff4757';
      ctx.beginPath();
      ctx.arc(v.x, v.y, 20, 0, Math.PI * 2);
      ctx.fill();
      
      // Danger indicator
      ctx.fillStyle = 'white';
      ctx.font = 'bold 14px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(v.dangerLevel.toString(), v.x, v.y);
      
      // Sinking animation
      if (!v.rescued) {
        const sinkProgress = v.dangerLevel / 7;
        ctx.strokeStyle = `rgba(255, 71, 87, ${sinkProgress})`;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(v.x, v.y, 25 + Math.sin(Date.now() / 200) * 5, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    });

    // Obstacles
    obstaclesRef.current.forEach(o => {
      if (o.collected) {
        ctx.globalAlpha = 0.3;
      }
      ctx.fillStyle = '#2d3436';
      ctx.beginPath();
      ctx.arc(o.x, o.y, 18, 0, Math.PI * 2);
      ctx.fill();
      
      ctx.fillStyle = 'white';
      ctx.font = 'bold 16px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('🪨', o.x, o.y);
      ctx.globalAlpha = 1;
    });

    // Players
    players.forEach(p => {
      const isSelf = p.id === playerId;
      const px = isSelf ? playerRef.current.x : (p.x || 0);
      const py = isSelf ? playerRef.current.y : (p.y || 0);
      
      // Swimmer body
      ctx.save();
      ctx.translate(px, py);
      
      // Swimming animation
      const swimOffset = Math.sin((isSelf ? playerRef.current.swimAnimation : (p.swimAnimation || 0))) * 5;
      
      // Body
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.ellipse(0, swimOffset, 15, 20, 0, 0, Math.PI * 2);
      ctx.fill();
      
      // Head
      ctx.fillStyle = '#ffd700';
      ctx.beginPath();
      ctx.arc(0, -20 + swimOffset, 8, 0, Math.PI * 2);
      ctx.fill();
      
      // Arms
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      const armAngle = Math.sin((isSelf ? playerRef.current.swimAnimation : (p.swimAnimation || 0)) * 2) * 0.5;
      ctx.beginPath();
      ctx.moveTo(-10, swimOffset);
      ctx.lineTo(-25, swimOffset + Math.sin(armAngle) * 10);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(10, swimOffset);
      ctx.lineTo(25, swimOffset - Math.sin(armAngle) * 10);
      ctx.stroke();
      
      ctx.restore();

      // Name tag
      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      ctx.font = 'bold 12px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(p.name, px, py - 35);
      
      // Score
      ctx.fillStyle = 'white';
      ctx.font = '10px Arial';
      ctx.fillText(`${p.score}점`, px, py + 35);

      // Stamina bar (self only)
      if (isSelf) {
        const staminaWidth = 40;
        const staminaX = px - staminaWidth / 2;
        const staminaY = py + 45;
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillRect(staminaX, staminaY, staminaWidth, 5);
        ctx.fillStyle = playerRef.current.stamina > 30 ? '#28a745' : '#dc3545';
        ctx.fillRect(staminaX, staminaY, (playerRef.current.stamina / 100) * staminaWidth, 5);
      }
    });

    // HUD
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(10, 10, 150, 40);
    ctx.fillStyle = 'white';
    ctx.font = 'bold 18px Arial';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(`시간: ${Math.ceil(gameTimeRef.current)}초`, 20, 20);

    // Score display
    const selfPlayer = players.find(p => p.id === playerId);
    if (selfPlayer) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      ctx.fillRect(canvas.width - 160, 10, 150, 40);
      ctx.fillStyle = '#ffc107';
      ctx.font = 'bold 16px Arial';
      ctx.textAlign = 'right';
      ctx.fillText(`점수: ${selfPlayer.score}점`, canvas.width - 20, 20);
      ctx.fillStyle = 'white';
      ctx.font = '12px Arial';
      ctx.fillText(`구조: ${selfPlayer.rescuedCount}명`, canvas.width - 20, 35);
    }
  };

  const handleCreateRoom = () => {
    if (!playerName.trim()) {
      showToast('이름을 입력해주세요.', 'warning');
      return;
    }
    socket?.emit('create_room', {
      hostName: playerName,
      playerName,
      maxRescuers,
      gameTime: settings.gameTime,
      victimsCount: settings.victimsCount,
      obstaclesCount: settings.obstaclesCount,
    });
  };

  const handleJoinRoom = () => {
    if (!playerName.trim()) {
      showToast('이름을 입력해주세요.', 'warning');
      return;
    }
    if (!joinRoomId.trim()) {
      showToast('방 코드를 입력해주세요.', 'warning');
      return;
    }
    socket?.emit('join_room', {
      roomId: joinRoomId.toUpperCase(),
      playerName,
    });
  };

  const handleStartGame = () => {
    socket?.emit('start_game');
  };

  const handleRestart = () => {
    socket?.emit('restart_room');
    setGameState('waiting');
    setGameData(null);
  };

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', padding: '20px' }}>
      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed',
          top: '20px',
          left: '50%',
          transform: 'translateX(-50%)',
          background: toast.type === 'success' ? '#28a745' : toast.type === 'warning' ? '#ffc107' : toast.type === 'error' ? '#dc3545' : '#17a2b8',
          color: 'white',
          padding: '12px 24px',
          borderRadius: '8px',
          zIndex: 1000,
          fontWeight: 'bold',
        }}>
          {toast.message}
        </div>
      )}

      <div style={{ maxWidth: '900px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{ textAlign: 'center', color: 'white', marginBottom: '20px' }}>
          <h1 style={{ fontSize: '28px', marginBottom: '5px' }}>🏊 수영 여행 - 멀티플레이어</h1>
          <p style={{ opacity: 0.9 }}>물에 빠진 사람을 구조하세요!</p>
          <Link href="/" style={{ color: 'white', textDecoration: 'underline', fontSize: '14px' }}>
            ← 기록 앱으로 돌아가기
          </Link>
        </div>

        {/* Lobby */}
        {gameState === 'lobby' && (
          <div style={{ background: 'white', borderRadius: '15px', padding: '30px', textAlign: 'center' }}>
            <h2 style={{ marginBottom: '20px' }}>게임 시작</h2>
            
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>이름</label>
              <input
                type="text"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                placeholder="이름을 입력하세요"
                style={{ padding: '12px', borderRadius: '8px', border: '2px solid #e0e0e0', width: '200px', fontSize: '16px' }}
              />
            </div>

            <div style={{ display: 'flex', gap: '15px', justifyContent: 'center', flexWrap: 'wrap' }}>
              <button
                onClick={handleCreateRoom}
                style={{ padding: '15px 30px', background: 'linear-gradient(135deg, #667eea, #764ba2)', color: 'white', border: 'none', borderRadius: '10px', fontSize: '16px', cursor: 'pointer' }}
              >
                🏠 방 만들기
              </button>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <input
                  type="text"
                  value={joinRoomId}
                  onChange={(e) => setJoinRoomId(e.target.value.toUpperCase())}
                  placeholder="방 코드"
                  maxLength={6}
                  style={{ padding: '12px', borderRadius: '8px', border: '2px solid #e0e0e0', width: '100px', fontSize: '16px', textTransform: 'uppercase' }}
                />
                <button
                  onClick={handleJoinRoom}
                  style={{ padding: '15px 30px', background: 'linear-gradient(135deg, #00c6ff, #0072ff)', color: 'white', border: 'none', borderRadius: '10px', fontSize: '16px', cursor: 'pointer' }}
                >
                  🚪 입장
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Waiting Room */}
        {gameState === 'waiting' && (
          <div style={{ background: 'white', borderRadius: '15px', padding: '30px' }}>
            <div style={{ textAlign: 'center', marginBottom: '20px' }}>
              <h2>대기실</h2>
              <p style={{ color: '#666' }}>방 코드: <strong style={{ color: '#667eea', fontSize: '20px' }}>{roomId}</strong></p>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <h3 style={{ marginBottom: '10px' }}>설정 {isHost && '(호스트만 변경 가능)'}</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '12px' }}>게임 시간 (초)</label>
                  <input
                    type="number"
                    value={settings.gameTime}
                    onChange={(e) => isHost && setSettings(s => ({ ...s, gameTime: parseInt(e.target.value) || 60 }))}
                    disabled={!isHost}
                    style={{ width: '100%', padding: '8px', borderRadius: '5px', border: '1px solid #e0e0e0' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '12px' }}>피해자 수</label>
                  <input
                    type="number"
                    value={settings.victimsCount}
                    onChange={(e) => isHost && setSettings(s => ({ ...s, victimsCount: parseInt(e.target.value) || 7 }))}
                    disabled={!isHost}
                    style={{ width: '100%', padding: '8px', borderRadius: '5px', border: '1px solid #e0e0e0' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '12px' }}>장애물 수</label>
                  <input
                    type="number"
                    value={settings.obstaclesCount}
                    onChange={(e) => isHost && setSettings(s => ({ ...s, obstaclesCount: parseInt(e.target.value) || 4 }))}
                    disabled={!isHost}
                    style={{ width: '100%', padding: '8px', borderRadius: '5px', border: '1px solid #e0e0e0' }}
                  />
                </div>
              </div>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <h3 style={{ marginBottom: '10px' }}>플레이어 ({players.length}/{maxRescuers})</h3>
              {players.map(p => (
                <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px', background: '#f8f9fa', borderRadius: '8px', marginBottom: '5px' }}>
                  <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: p.color }}></div>
                  <span style={{ flex: 1 }}>{p.name} {p.isHost && '(호스트)'}</span>
                  <span style={{ color: p.ready ? '#28a745' : '#6c757d' }}>{p.ready ? '✓ 준비' : '대기'}</span>
                </div>
              ))}
            </div>

            <div style={{ textAlign: 'center' }}>
              {isHost ? (
                <button
                  onClick={handleStartGame}
                  disabled={players.length === 0}
                  style={{ padding: '15px 40px', background: players.length > 0 ? '#28a745' : '#6c757d', color: 'white', border: 'none', borderRadius: '10px', fontSize: '16px', cursor: players.length > 0 ? 'pointer' : 'not-allowed' }}
                >
                  🎮 게임 시작
                </button>
              ) : (
                <p style={{ color: '#666' }}>호스트가 게임을 시작할 때까지 기다려주세요.</p>
              )}
            </div>
          </div>
        )}

        {/* Playing */}
        {gameState === 'playing' && gameData && (
          <div>
            <canvas
              ref={canvasRef}
              width={gameData.canvasWidth}
              height={gameData.canvasHeight}
              style={{ display: 'block', margin: '0 auto', borderRadius: '15px', maxWidth: '100%' }}
            />
            <div style={{ textAlign: 'center', color: 'white', marginTop: '10px', fontSize: '12px' }}>
              조작: WASD/방향키 이동 | Shift 달리기
            </div>
          </div>
        )}

        {/* Game End */}
        {gameState === 'ended' && (
          <div style={{ background: 'white', borderRadius: '15px', padding: '30px', textAlign: 'center' }}>
            <h2 style={{ marginBottom: '20px' }}>🏆 게임 종료!</h2>
            
            <div style={{ marginBottom: '20px' }}>
              {results.sort((a, b) => b.score - a.score).map((p, idx) => (
                <div key={p.id} style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '15px',
                  padding: '15px',
                  background: idx === 0 ? '#fff3cd' : '#f8f9fa',
                  borderRadius: '10px',
                  marginBottom: '10px',
                  border: idx === 0 ? '2px solid #ffc107' : 'none'
                }}>
                  <span style={{ fontSize: '24px' }}>{idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : '🏊'}</span>
                  <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: p.color }}></div>
                  <span style={{ flex: 1, textAlign: 'left', fontWeight: 'bold' }}>{p.name}</span>
                  <span style={{ color: '#667eea', fontWeight: 'bold' }}>{p.score}점</span>
                  <span style={{ color: '#666', fontSize: '12px' }}>구조: {p.rescuedCount}명</span>
                </div>
              ))}
            </div>

            {isHost && (
              <button
                onClick={handleRestart}
                style={{ padding: '15px 40px', background: 'linear-gradient(135deg, #667eea, #764ba2)', color: 'white', border: 'none', borderRadius: '10px', fontSize: '16px', cursor: 'pointer' }}
              >
                🔄 다시 시작
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}