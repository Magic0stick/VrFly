import Peer, { DataConnection } from 'peerjs';

export interface PlayerData {
  id: string;
  name: string;
  position: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number };
  inAirplane: boolean;
  airplaneId?: string;
  health: number;
  score: number;
}

export interface NetworkMessage {
  type: 'playerUpdate' | 'playerJoin' | 'playerLeave' | 'chat' | 'dropTroop' | 'bulletFire' | 'hit';
  data: any;
  senderId: string;
  timestamp: number;
}

export class MultiplayerManager {
  private peer: Peer | null = null;
  private connections: Map<string, DataConnection> = new Map();
  private players: Map<string, PlayerData> = new Map();
  private myId: string = '';
  private myName: string = '';
  private isConnected: boolean = false;
  private roomCode: string = '';
  
  private onPlayerJoin?: (player: PlayerData) => void;
  private onPlayerLeave?: (playerId: string) => void;
  private onPlayerUpdate?: (player: PlayerData) => void;
  private onMessage?: (message: NetworkMessage) => void;
  private onConnectionChange?: (connected: boolean, playerCount: number) => void;
  
  constructor() {
    this.myId = this.generateId();
    this.myName = 'Player_' + this.myId.slice(0, 4);
  }
  
  private generateId(): string {
    return 'player_' + Math.random().toString(36).substr(2, 9);
  }
  
  public async initialize(
    onPlayerJoin?: (player: PlayerData) => void,
    onPlayerLeave?: (playerId: string) => void,
    onPlayerUpdate?: (player: PlayerData) => void,
    onMessage?: (message: NetworkMessage) => void,
    onConnectionChange?: (connected: boolean, playerCount: number) => void
  ): Promise<string> {
    this.onPlayerJoin = onPlayerJoin;
    this.onPlayerLeave = onPlayerLeave;
    this.onPlayerUpdate = onPlayerUpdate;
    this.onMessage = onMessage;
    this.onConnectionChange = onConnectionChange;
    
    return new Promise((resolve, reject) => {
      // Create peer with random ID for public server
      this.peer = new Peer(this.myId, {
        debug: 1,
        config: {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            { urls: 'stun:stun2.l.google.com:19302' },
            { urls: 'stun:stun3.l.google.com:19302' },
            { urls: 'stun:stun4.l.google.com:19302' }
          ]
        }
      });
      
      this.peer.on('open', (id) => {
        this.myId = id;
        this.isConnected = true;
        this.roomCode = id.slice(0, 6).toUpperCase();
        console.log(`[Multiplayer] Connected as ${id}, room code: ${this.roomCode}`);
        resolve(this.roomCode);
      });
      
      this.peer.on('connection', (conn) => {
        this.handleConnection(conn);
      });
      
      this.peer.on('error', (err) => {
        console.error('[Multiplayer] Error:', err);
        if (err.type === 'unavailable-id') {
          // Retry with new ID
          this.myId = this.generateId();
          this.peer?.destroy();
          this.initialize(onPlayerJoin, onPlayerLeave, onPlayerUpdate, onMessage, onConnectionChange).then(resolve);
        } else {
          reject(err);
        }
      });
      
      this.peer.on('disconnected', () => {
        console.log('[Multiplayer] Disconnected, attempting reconnect...');
        this.peer?.reconnect();
      });
    });
  }
  
  public async joinRoom(roomCode: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.peer) {
        reject(new Error('Peer not initialized'));
        return;
      }
      
      const conn = this.peer.connect(roomCode.toLowerCase(), {
        reliable: true,
        metadata: {
          name: this.myName,
          playerId: this.myId
        }
      });
      
      conn.on('open', () => {
        console.log(`[Multiplayer] Connected to room ${roomCode}`);
        this.handleConnection(conn);
        
        // Send our player data
        this.sendTo(conn, {
          type: 'playerJoin',
          data: this.getMyPlayerData(),
          senderId: this.myId,
          timestamp: Date.now()
        });
        
        resolve();
      });
      
      conn.on('error', (err) => {
        console.error('[Multiplayer] Connection error:', err);
        reject(err);
      });
      
      // Timeout
      setTimeout(() => {
        if (!conn.open) {
          reject(new Error('Connection timeout'));
        }
      }, 10000);
    });
  }
  
  private handleConnection(conn: DataConnection): void {
    const peerId = conn.peer;
    
    conn.on('open', () => {
      console.log(`[Multiplayer] Connection opened with ${peerId}`);
      this.connections.set(peerId, conn);
      this.updateConnectionStatus();
    });
    
    conn.on('data', (data) => {
      this.handleMessage(data as NetworkMessage, peerId);
    });
    
    conn.on('close', () => {
      console.log(`[Multiplayer] Connection closed with ${peerId}`);
      this.connections.delete(peerId);
      this.players.delete(peerId);
      this.onPlayerLeave?.(peerId);
      this.updateConnectionStatus();
    });
    
    conn.on('error', (err) => {
      console.error(`[Multiplayer] Connection error with ${peerId}:`, err);
      this.connections.delete(peerId);
      this.updateConnectionStatus();
    });
  }
  
  private handleMessage(message: NetworkMessage, senderId: string): void {
    switch (message.type) {
      case 'playerJoin':
        const newPlayer = message.data as PlayerData;
        newPlayer.id = senderId;
        this.players.set(senderId, newPlayer);
        this.onPlayerJoin?.(newPlayer);
        
        // Relay to other connections
        this.broadcastExcept(senderId, message);
        
        // Send our data back
        this.sendTo(this.connections.get(senderId)!, {
          type: 'playerJoin',
          data: this.getMyPlayerData(),
          senderId: this.myId,
          timestamp: Date.now()
        });
        break;
        
      case 'playerUpdate':
        const updatedPlayer = message.data as PlayerData;
        updatedPlayer.id = senderId;
        this.players.set(senderId, updatedPlayer);
        this.onPlayerUpdate?.(updatedPlayer);
        
        // Relay to other connections
        this.broadcastExcept(senderId, message);
        break;
        
      case 'playerLeave':
        this.players.delete(senderId);
        this.onPlayerLeave?.(senderId);
        this.broadcastExcept(senderId, message);
        break;
        
      case 'dropTroop':
      case 'bulletFire':
      case 'hit':
      case 'chat':
        this.onMessage?.(message);
        this.broadcastExcept(senderId, message);
        break;
    }
  }
  
  private broadcast(message: NetworkMessage): void {
    this.connections.forEach((conn) => {
      if (conn.open) {
        conn.send(message);
      }
    });
  }
  
  private broadcastExcept(exceptId: string, message: NetworkMessage): void {
    this.connections.forEach((conn, peerId) => {
      if (peerId !== exceptId && conn.open) {
        conn.send(message);
      }
    });
  }
  
  private sendTo(conn: DataConnection, message: NetworkMessage): void {
    if (conn.open) {
      conn.send(message);
    }
  }
  
  public sendPlayerUpdate(playerData: PlayerData): void {
    this.broadcast({
      type: 'playerUpdate',
      data: playerData,
      senderId: this.myId,
      timestamp: Date.now()
    });
  }
  
  public sendDropTroop(troopData: any): void {
    this.broadcast({
      type: 'dropTroop',
      data: troopData,
      senderId: this.myId,
      timestamp: Date.now()
    });
  }
  
  public sendBulletFire(bulletData: any): void {
    this.broadcast({
      type: 'bulletFire',
      data: bulletData,
      senderId: this.myId,
      timestamp: Date.now()
    });
  }
  
  public sendHit(targetId: string, damage: number): void {
    this.broadcast({
      type: 'hit',
      data: { targetId, damage },
      senderId: this.myId,
      timestamp: Date.now()
    });
  }
  
  public sendChat(message: string): void {
    this.broadcast({
      type: 'chat',
      data: { message, senderName: this.myName },
      senderId: this.myId,
      timestamp: Date.now()
    });
  }
  
  public getMyPlayerData(): PlayerData {
    return {
      id: this.myId,
      name: this.myName,
      position: { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      inAirplane: true,
      health: 100,
      score: 0
    };
  }
  
  public getPlayers(): Map<string, PlayerData> {
    return this.players;
  }
  
  public getPlayerCount(): number {
    return this.connections.size + 1; // +1 for self
  }
  
  public getMyId(): string {
    return this.myId;
  }
  
  public getRoomCode(): string {
    return this.roomCode;
  }
  
  public isConnectedToServer(): boolean {
    return this.isConnected;
  }
  
  private updateConnectionStatus(): void {
    this.onConnectionChange?.(this.isConnected, this.getPlayerCount());
  }
  
  public disconnect(): void {
    // Notify others
    this.broadcast({
      type: 'playerLeave',
      data: { id: this.myId },
      senderId: this.myId,
      timestamp: Date.now()
    });
    
    // Close all connections
    this.connections.forEach((conn) => {
      conn.close();
    });
    this.connections.clear();
    
    // Destroy peer
    this.peer?.destroy();
    this.peer = null;
    this.isConnected = false;
    this.updateConnectionStatus();
  }
}
