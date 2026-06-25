const express = require('express');
const http = require('http');
const { WebSocketServer } = require('ws');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

app.use(express.static(path.join(__dirname)));
app.use(express.json());

// 방 저장소
const rooms = new Map();

// 방 생성
app.post('/api/rooms', (req, res) => {
    const { hostName, maxRescuers } = req.body;
    const roomId = Math.random().toString(36).substring(2, 8).toUpperCase();
    
    const room = {
        id: roomId,
        hostName: hostName || 'Host',
        maxRescuers: Math.min(maxRescuers || 4, 4),
        players: [],
        gameState: 'waiting',
        settings: {
            gameTime: 60,
            victimsCount: 7,
            obstaclesCount: 4
        },
        createdAt: Date.now()
    };
    
    rooms.set(roomId, room);
    res.json({ roomId, room });
});

// 방 목록
app.get('/api/rooms', (req, res) => {
    const roomList = Array.from(rooms.values()).map(r => ({
        id: r.id,
        hostName: r.hostName,
        maxRescuers: r.maxRescuers,
        playerCount: r.players.length,
        gameState: r.gameState
    }));
    res.json(roomList);
});

// 방 정보
app.get('/api/rooms/:roomId', (req, res) => {
    const room = rooms.get(req.params.roomId);
    if (!room) return res.status(404).json({ error: 'Room not found' });
    res.json(room);
});

function broadcastToRoom(room, data) {
    room.players.forEach(p => {
        if (p.ws.readyState === 1) {
            p.ws.send(JSON.stringify(data));
        }
    });
}

function broadcastToRoomExcept(room, exceptPlayerId, data) {
    room.players.forEach(p => {
        if (p.id !== exceptPlayerId && p.ws.readyState === 1) {
            p.ws.send(JSON.stringify(data));
        }
    });
}

function broadcastRoomState(room) {
    const state = {
        type: 'room_state',
        roomId: room.id,
        hostName: room.hostName,
        maxRescuers: room.maxRescuers,
        gameState: room.gameState,
        settings: room.settings,
        players: room.players.map(p => ({
            id: p.id,
            name: p.name,
            color: p.color,
            index: p.index,
            ready: p.ready,
            score: p.score,
            rescuedCount: p.rescuedCount
        }))
    };
    broadcastToRoom(room, state);
}

function generateGameEntities(canvasWidth, canvasHeight, victimsCount, obstaclesCount) {
    const positions = [];
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
        { minX: centerX - 100, maxX: centerX + 100, minY: centerY - 50, maxY: centerY + 50 }
    ];
    
    for (let i = 0; i < victimsCount + obstaclesCount; i++) {
        const zone = zones[i % zones.length];
        const x = zone.minX + Math.random() * (zone.maxX - zone.minX);
        const y = zone.minY + Math.random() * (zone.maxY - zone.minY);
        positions.push({ x, y });
    }
    
    const dangerLevels = [];
    for (let i = 0; i < victimsCount; i++) {
        dangerLevels.push((i % 7) + 1);
    }
    // Shuffle
    for (let i = dangerLevels.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [dangerLevels[i], dangerLevels[j]] = [dangerLevels[j], dangerLevels[i]];
    }
    
    const victims = [];
    for (let i = 0; i < victimsCount; i++) {
        const dangerLevel = dangerLevels[i];
        victims.push({
            id: 'v_' + i,
            x: positions[i].x,
            y: positions[i].y,
            dangerLevel: dangerLevel,
            points: dangerLevel * 100,
            rescued: false,
            rescuedBy: null
        });
    }
    
    const obstacles = [];
    const penalties = [-50, -50, -100, -100];
    for (let i = 0; i < obstaclesCount; i++) {
        const idx = victimsCount + i;
        obstacles.push({
            id: 'o_' + i,
            x: positions[idx].x,
            y: positions[idx].y,
            penalty: penalties[i % penalties.length],
            collected: false,
            collectedBy: null
        });
    }
    
    return { victims, obstacles };
}

// WebSocket 연결
wss.on('connection', (ws) => {
    let currentRoom = null;
    let playerId = null;
    
    ws.on('message', (data) => {
        let msg;
        try {
            msg = JSON.parse(data.toString());
        } catch (e) {
            return;
        }
        
        switch (msg.type) {
            case 'create_room': {
                const roomId = Math.random().toString(36).substring(2, 8).toUpperCase();
                const room = {
                    id: roomId,
                    hostName: msg.hostName || 'Host',
                    maxRescuers: Math.min(msg.maxRescuers || 4, 4),
                    players: [],
                    gameState: 'waiting',
                    settings: {
                        gameTime: msg.gameTime || 60,
                        victimsCount: msg.victimsCount || 7,
                        obstaclesCount: msg.obstaclesCount || 4
                    },
                    createdAt: Date.now()
                };
                rooms.set(roomId, room);
                currentRoom = room;
                playerId = 'player_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
                
                const player = {
                    id: playerId,
                    ws: ws,
                    name: msg.playerName || 'Host',
                    color: '#FF6B6B',
                    index: 0,
                    score: 0,
                    rescuedCount: 0,
                    ready: false,
                    isHost: true
                };
                room.players.push(player);
                ws.send(JSON.stringify({
                    type: 'room_created',
                    roomId: roomId,
                    playerId: playerId,
                    isHost: true
                }));
                broadcastRoomState(room);
                break;
            }
            
            case 'join_room': {
                const room = rooms.get(msg.roomId);
                if (!room) {
                    ws.send(JSON.stringify({ type: 'error', message: '방을 찾을 수 없습니다.' }));
                    return;
                }
                if (room.gameState !== 'waiting') {
                    ws.send(JSON.stringify({ type: 'error', message: '이미 게임이 진행 중입니다.' }));
                    return;
                }
                if (room.players.length >= room.maxRescuers) {
                    ws.send(JSON.stringify({ type: 'error', message: '방이 가득 찼습니다.' }));
                    return;
                }
                
                currentRoom = room;
                playerId = 'player_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
                
                const playerColors = ['#FF6B6B', '#4ECDC4', '#FFE66D', '#95E1D3'];
                const playerIndex = room.players.length;
                
                const player = {
                    id: playerId,
                    ws: ws,
                    name: msg.playerName || ('Player ' + (playerIndex + 1)),
                    color: playerColors[playerIndex],
                    index: playerIndex,
                    score: 0,
                    rescuedCount: 0,
                    ready: false,
                    isHost: false
                };
                room.players.push(player);
                ws.send(JSON.stringify({
                    type: 'joined',
                    playerId: playerId,
                    playerIndex: playerIndex,
                    color: player.color,
                    name: player.name,
                    roomId: room.id
                }));
                broadcastRoomState(room);
                break;
            }
            
            case 'player_ready': {
                if (currentRoom) {
                    const player = currentRoom.players.find(p => p.id === playerId);
                    if (player) {
                        player.ready = msg.ready !== false;
                        broadcastRoomState(currentRoom);
                    }
                }
                break;
            }
            
            case 'update_settings': {
                if (currentRoom && currentRoom.players[0]?.id === playerId) {
                    if (msg.settings) {
                        Object.assign(currentRoom.settings, msg.settings);
                    }
                    if (msg.maxRescuers !== undefined) {
                        currentRoom.maxRescuers = Math.min(msg.maxRescuers, 4);
                    }
                    broadcastRoomState(currentRoom);
                }
                break;
            }
            
            case 'start_game': {
                if (!currentRoom || !currentRoom.players[0] || currentRoom.players[0].id !== playerId) return;
                if (currentRoom.players.length === 0) return;
                
                currentRoom.gameState = 'playing';
                
                const entities = generateGameEntities(900, 500, currentRoom.settings.victimsCount, currentRoom.settings.obstaclesCount);
                
                const startPositions = [
                    { x: 100, y: 250 },
                    { x: 800, y: 250 },
                    { x: 100, y: 150 },
                    { x: 800, y: 350 }
                ];
                
                const playerStates = currentRoom.players.map((p, idx) => ({
                    id: p.id,
                    name: p.name,
                    color: p.color,
                    index: idx,
                    x: startPositions[idx].x,
                    y: startPositions[idx].y,
                    angle: 0,
                    stamina: 100,
                    isSprinting: false,
                    swimAnimation: 0,
                    score: 0,
                    rescuedCount: 0
                }));
                
                broadcastToRoom(currentRoom, {
                    type: 'game_start',
                    gameData: {
                        victims: entities.victims,
                        obstacles: entities.obstacles,
                        players: playerStates,
                        settings: currentRoom.settings,
                        canvasWidth: 900,
                        canvasHeight: 500
                    }
                });
                break;
            }
            
            case 'player_move': {
                if (currentRoom && currentRoom.gameState === 'playing') {
                    broadcastToRoomExcept(currentRoom, playerId, {
                        type: 'player_update',
                        playerId: playerId,
                        x: msg.x,
                        y: msg.y,
                        angle: msg.angle,
                        isSprinting: msg.isSprinting,
                        stamina: msg.stamina,
                        swimAnimation: msg.swimAnimation
                    });
                }
                break;
            }
            
            case 'victim_rescued': {
                if (currentRoom && currentRoom.gameState === 'playing') {
                    const player = currentRoom.players.find(p => p.id === playerId);
                    if (player) {
                        player.score += msg.points;
                        player.rescuedCount++;
                    }
                    broadcastToRoom(currentRoom, {
                        type: 'victim_rescued_event',
                        playerId: playerId,
                        victimId: msg.victimId,
                        points: msg.points
                    });
                }
                break;
            }
            
            case 'obstacle_hit': {
                if (currentRoom && currentRoom.gameState === 'playing') {
                    const player = currentRoom.players.find(p => p.id === playerId);
                    if (player) {
                        player.score += msg.penalty;
                    }
                    broadcastToRoom(currentRoom, {
                        type: 'obstacle_hit_event',
                        playerId: playerId,
                        obstacleId: msg.obstacleId,
                        penalty: msg.penalty
                    });
                }
                break;
            }
            
            case 'sync_state': {
                if (currentRoom && currentRoom.gameState === 'playing') {
                    broadcastToRoomExcept(currentRoom, playerId, {
                        type: 'sync_state',
                        playerId: playerId,
                        victims: msg.victims,
                        obstacles: msg.obstacles
                    });
                }
                break;
            }
            
            case 'end_game': {
                if (currentRoom && currentRoom.players[0]?.id === playerId) {
                    currentRoom.gameState = 'ended';
                    const results = currentRoom.players.map(p => ({
                        id: p.id,
                        name: p.name,
                        color: p.color,
                        score: p.score,
                        rescuedCount: p.rescuedCount
                    }));
                    broadcastToRoom(currentRoom, {
                        type: 'game_end',
                        results: results
                    });
                }
                break;
            }
            
            case 'restart_room': {
                if (currentRoom && currentRoom.players[0]?.id === playerId) {
                    currentRoom.gameState = 'waiting';
                    currentRoom.players.forEach(p => {
                        p.score = 0;
                        p.rescuedCount = 0;
                        p.ready = false;
                    });
                    broadcastRoomState(currentRoom);
                }
                break;
            }
        }
    });
    
    ws.on('close', () => {
        if (currentRoom && playerId) {
            const idx = currentRoom.players.findIndex(p => p.id === playerId);
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

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});