export class OnlineGame {
  constructor(game, callbacks) {
    this.game = game;
    this.callbacks = callbacks || {};
    this.peer = null;
    this.conn = null;
    this.roomId = null;
    this.isHost = false;
    this.isConnected = false;
  }

  host() {
    return new Promise((resolve, reject) => {
      this.peer = new Peer();
      this.peer.on('open', (id) => {
        this.roomId = id;
        this.isHost = true;
        resolve(id);
      });
      this.peer.on('connection', (conn) => {
        this._setup(conn);
      });
      this.peer.on('error', (err) => reject(err));
    });
  }

  join(roomId) {
    return new Promise((resolve, reject) => {
      this.peer = new Peer();
      this.peer.on('open', () => {
        const conn = this.peer.connect(roomId, { reliable: true });
        if (!conn) { reject(new Error('Failed to connect')); return; }
        this._setup(conn);
        resolve();
      });
      this.peer.on('error', (err) => reject(err));
      setTimeout(() => reject(new Error('Connection timeout')), 15000);
    });
  }

  _setup(conn) {
    this.conn = conn;
    this.isConnected = true;
    conn.on('data', (data) => this._handle(data));
    conn.on('close', () => {
      this.isConnected = false;
      this.callbacks.onDisconnect?.();
    });
    conn.on('error', () => {
      this.isConnected = false;
      this.callbacks.onDisconnect?.();
    });
    this.callbacks.onConnect?.();
  }

  sendMove(move) {
    if (!this.conn) return;
    this.conn.send({
      type: 'move',
      from: move.from,
      to: move.to,
      promotion: move.promotion || null
    });
  }

  _handle(data) {
    switch (data.type) {
      case 'move':
        this.callbacks.onRemoteMove?.(data);
        break;
    }
  }

  disconnect() {
    try { this.conn?.close(); } catch {}
    try { this.peer?.destroy(); } catch {}
    this.isConnected = false;
    this.conn = null;
    this.peer = null;
  }
}
