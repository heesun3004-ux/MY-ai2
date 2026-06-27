import { Server as NetServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';

let io: SocketIOServer | null = null;

export interface Player {
  id: string;
  name: string;
  color: string;
  index: number;
  score: number;
  rescuedCount: number;
  ready: boolean;
  isHost: boolean;
  x: number;
  y: number;
  angle: number;
  stamina: number;
  isSprinting: boolean;
  swimAnimation: number;
}

export interface RoomSettings {
  gameTime: number;
  victimsCount: number;
  obstaclesCount: number;
}

export interface Room {
  id: string;
  hostName: string;
  maxRescuers: number;
  players: Player[];
  gameState: 'waiting' | 'playing' | 'ended';
  settings: RoomSettings;
  createdAt: number;
}

export interface Victim {
  id: string;
  x: number;
  y: number;
  dangerLevel: number;
  points: number;
  rescued: boolean;
  rescuedBy: string | null;
}

export interface Obstacle {
  id: string;
  x: number;
  y: number;
  penalty: number;
  collected: boolean;
  collectedBy: string | null;
}

const rooms = new Map<string, Room>();

export function getIO(httpServer: NetServer): SocketIOServer {
  if (!io) {
    io = new SocketIOServer(httpServer, {
      cors: {
        origin: '*',
        methods: ['GET', 'POST'],
      },
    });

    io.on('connection', (socket) => {
      let currentRoom: Room | null = null;
      let playerId: string | null = null;

      socket.on('create_room', (data) => {
        const roomId = Math.random().toString(36).substring(2, 8).toUpperCase();
        const room: Room = {
          id: roomId,
          hostName: data.hostName || 'Host',
          maxRescuers: Math.min(data.maxRescuers || 4, 4),
          players: [],
          gameState: 'waiting',
          settings: {
            gameTime: data.gameTime || 60,
            victimsCount: data.victimsCount || 7,
            obstaclesCount: data.obstaclesCount || 4,
          },
          createdAt: Date.now(),
        };
        rooms.set(roomId, room);
        currentRoom = room;
        playerId = 'player_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);

        const player: Player = {
          id: playerId,
          name: data.playerName || 'Host',
          color: '#FF6B6B',
          index: 0,
          score: 0,
          rescuedCount: 0,
          ready: false,
          isHost: true,
          x: 100,
          y: 250,
          angle: 0,
          stamina: 100,
          isSprinting: false,
          swimAnimation: 0,
        };
        room.players.push(player);
        socket.join(room.id);
        socket.emit('room_created', {
          roomId,
          playerId,
          isHost: true,
        });
        broadcastRoomState(room);
      });

      socket.on('join_room', (data) => {
        const room = rooms.get(data.roomId);
        if (!room) {
          socket.emit('error', { message: '방을 찾을 수 없습니다.' });
          return;
        }
        if (room.gameState !== 'waiting') {
          socket.emit('error', { message: '이미 게임이 진행 중입니다.' });
          return;
        }
        if (room.players.length >= room.maxRescuers) {
          socket.emit('error', { message: '방이 가득 찼습니다.' });
          return;
        }

        currentRoom = room;
        playerId = 'player_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);

        const playerColors = ['#FF6B6B', '#4ECDC4', '#FFE66D', '#95E1D3'];
        const playerIndex = room.players.length;

        const player: Player = {
          id: playerId,
          name: data.playerName || 'Player ' + (playerIndex + 1),
          color: playerColors[playerIndex],
          index: playerIndex,
          score: 0,
          rescuedCount: 0,
          ready: false,
          isHost: false,
          x: 800,
          y: 250,
          angle: 0,
          stamina: 100,
          isSprinting: false,
          swimAnimation: 0,
        };
        room.players.push(player);
        socket.join(room.id);
        socket.emit('joined', {
          playerId,
          playerIndex,
          color: player.color,
          name: player.name,
          roomId: room.id,
        });
        broadcastRoomState(room);
      });

      socket.on('player_ready', (data) => {
        if (currentRoom && playerId) {
          const player = currentRoom.players.find((p) => p.id === playerId);
          if (player) {
            player.ready = data.ready !== false;
            broadcastRoomState(currentRoom);
          }
        }
      });

      socket.on('update_settings', (data) => {
        if (currentRoom && playerId) {
          const host = currentRoom.players.find((p) => p.isHost);
          if (host?.id === playerId) {
            if (data.settings) {
              Object.assign(currentRoom.settings, data.settings);
            }
            if (data.maxRescuers !== undefined) {
              currentRoom.maxRescuers = Math.min(data.maxRescuers, 4);
            }
            broadcastRoomState(currentRoom);
          }
        }
      });

      socket.on('start_game', () => {
        if (!currentRoom || !playerId) return;
        const host = currentRoom.players.find((p) => p.isHost);
        if (host?.id !== playerId) return;
        if (currentRoom.players.length === 0) return;

        currentRoom.gameState = 'playing';

        const entities = generateGameEntities(
          900,
          500,
          currentRoom.settings.victimsCount,
          currentRoom.settings.obstaclesCount
        );

        const startPositions = [
          { x: 100, y: 250 },
          { x: 800, y: 250 },
          { x: 100, y: 150 },
          { x: 800, y: 350 },
        ];

        const playerStates = currentRoom.players.map((p, idx) => ({
          ...p,
          x: startPositions[idx].x,
          y: startPositions[idx].y,
          angle: 0,
          stamina: 100,
          isSprinting: false,
          swimAnimation: 0,
        }));

        broadcastToRoom(currentRoom, {
          type: 'game_start',
          gameData: {
            victims: entities.victims,
            obstacles: entities.obstacles,
            players: playerStates,
            settings: currentRoom.settings,
            canvasWidth: 900,
            canvasHeight: 500,
          },
        });
      });

      socket.on('player_move', (data) => {
        if (currentRoom && currentRoom.gameState === 'playing' && playerId) {
          socket.to(currentRoom.id).emit('player_update', {
            playerId,
            x: data.x,
            y: data.y,
            angle: data.angle,
            isSprinting: data.isSprinting,
            stamina: data.stamina,
            swimAnimation: data.swimAnimation,
          });
        }
      });

      socket.on('victim_rescued', (data) => {
        if (currentRoom && currentRoom.gameState === 'playing' && playerId) {
          const player = currentRoom.players.find((p) => p.id === playerId);
          if (player) {
            player.score += data.points;
            player.rescuedCount++;
          }
          broadcastToRoom(currentRoom, {
            type: 'victim_rescued_event',
            playerId,
            victimId: data.victimId,
            points: data.points,
          });
        }
      });

      socket.on('obstacle_hit', (data) => {
        if (currentRoom && currentRoom.gameState === 'playing' && playerId) {
          const player = currentRoom.players.find((p) => p.id === playerId);
          if (player) {
            player.score += data.penalty;
          }
          broadcastToRoom(currentRoom, {
            type: 'obstacle_hit_event',
            playerId,
            obstacleId: data.obstacleId,
            penalty: data.penalty,
          });
        }
      });

      socket.on('sync_state', (data) => {
        if (currentRoom && currentRoom.gameState === 'playing' && playerId) {
          socket.to(currentRoom.id).emit('sync_state', {
            playerId,
            victims: data.victims,
            obstacles: data.obstacles,
          });
        }
      });

      socket.on('end_game', () => {
        if (currentRoom && playerId) {
          const host = currentRoom.players.find((p) => p.isHost);
          if (host?.id === playerId) {
            currentRoom.gameState = 'ended';
            const results = currentRoom.players.map((p) => ({
              id: p.id,
              name: p.name,
              color: p.color,
              score: p.score,
              rescuedCount: p.rescuedCount,
            }));
            broadcastToRoom(currentRoom, {
              type: 'game_end',
              results,
            });
          }
        }
      });

      socket.on('restart_room', () => {
        if (currentRoom && playerId) {
          const host = currentRoom.players.find((p) => p.isHost);
          if (host?.id === playerId) {
            currentRoom.gameState = 'waiting';
            currentRoom.players.forEach((p) => {
              p.score = 0;
              p.rescuedCount = 0;
              p.ready = false;
            });
            broadcastRoomState(currentRoom);
          }
        }
      });

      socket.on('disconnect', () => {
        if (currentRoom && playerId) {
          const idx = currentRoom.players.findIndex((p) => p.id === playerId);
          if (idx !== -1) {
            currentRoom.players.splice(idx, 1);
          }
          if (currentRoom.players.length === 0) {
            rooms.delete(currentRoom.id);
          } else {
            if (idx === 0 && currentRoom.players.length > 0) {
              currentRoom.players[0].isHost = true;
            }
            broadcastRoomState(currentRoom);
          }
        }
      });
    });
  }
  return io;
}

function broadcastToRoom(room: Room, data: unknown) {
  if (!io) return;
  io.to(room.id).emit('message', data);
}

function broadcastRoomState(room: Room) {
  const state = {
    type: 'room_state',
    roomId: room.id,
    hostName: room.hostName,
    maxRescuers: room.maxRescuers,
    gameState: room.gameState,
    settings: room.settings,
    players: room.players.map((p) => ({
      id: p.id,
      name: p.name,
      color: p.color,
      index: p.index,
      ready: p.ready,
      score: p.score,
      rescuedCount: p.rescuedCount,
      isHost: p.isHost,
    })),
  };
  broadcastToRoom(room, state);
}

function generateGameEntities(
  canvasWidth: number,
  canvasHeight: number,
  victimsCount: number,
  obstaclesCount: number
) {
  const positions: { x: number; y: number }[] = [];
  const centerX = canvasWidth / 2;
  const centerY = canvasHeight / 2;
  const margin = 60;

  const zones = [
    { minX: centerX - 200, maxX: centerX - 80, minY: margin, maxY: centerY - 80 },
    { minX: centerX - 80, maxX: centerX + 80, minY: margin, maxY: centerY - 100 },
    { minX: centerX + 80, maxX: centerX + 200, minY: margin, maxY: centerY - 80 },
    { minX: margin, maxX: centerX - 100, minY: centerY + 50, maxY: canvasHeight - margin },
    { minX: centerX - 100, maxX: centerX + 100, minY: centerY + 80, maxY: canvasHeight - margin },
    { minX: centerX + 100, maxX: canvasWidth - margin, minY: centerY + 50, maxY: canvasHeight - margin },
    { minX: centerX - 100, maxX: centerX + 100, minY: centerY - 50, maxY: centerY + 50 },
  ];

  for (let i = 0; i < victimsCount + obstaclesCount; i++) {
    const zone = zones[i % zones.length];
    const x = zone.minX + Math.random() * (zone.maxX - zone.minX);
    const y = zone.minY + Math.random() * (zone.maxY - zone.minY);
    positions.push({ x, y });
  }

  const dangerLevels: number[] = [];
  for (let i = 0; i < victimsCount; i++) {
    dangerLevels.push((i % 7) + 1);
  }
  for (let i = dangerLevels.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [dangerLevels[i], dangerLevels[j]] = [dangerLevels[j], dangerLevels[i]];
  }

  const victims: Victim[] = [];
  for (let i = 0; i < victimsCount; i++) {
    const dangerLevel = dangerLevels[i];
    victims.push({
      id: 'v_' + i,
      x: positions[i].x,
      y: positions[i].y,
      dangerLevel,
      points: dangerLevel * 100,
      rescued: false,
      rescuedBy: null,
    });
  }

  const obstacles: Obstacle[] = [];
  const penalties = [-50, -50, -100, -100];
  for (let i = 0; i < obstaclesCount; i++) {
    const idx = victimsCount + i;
    obstacles.push({
      id: 'o_' + i,
      x: positions[idx].x,
      y: positions[idx].y,
      penalty: penalties[i % penalties.length],
      collected: false,
      collectedBy: null,
    });
  }

  return { victims, obstacles };
}

export function getRooms() {
  return Array.from(rooms.values()).map((r) => ({
    id: r.id,
    hostName: r.hostName,
    maxRescuers: r.maxRescuers,
    playerCount: r.players.length,
    gameState: r.gameState,
  }));
}

export function getRoom(roomId: string) {
  return rooms.get(roomId);
}