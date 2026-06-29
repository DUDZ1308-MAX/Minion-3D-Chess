import { ChessGame } from './chess-logic.js';
import { Chess3DRenderer } from './chess-3d.js?v=6';
import { getAIMove } from './chess-ai.js?v=6';
import { OnlineGame } from './chess-online.js?v=6';

const game = new ChessGame();
let renderer;

const turnIndicator = document.getElementById('turn-indicator');
const statusEl = document.getElementById('status');
const promotionDialog = document.getElementById('promotion-dialog');
const promotionBackdrop = document.getElementById('promotion-backdrop');
const moveLog = document.getElementById('move-log');
let pendingMove = null;
let startTime = Date.now();
let moveEntries = [];
let clockInterval = null;
let gameMode = '2player';
let aiThinking = false;
let playerName = '';
let onlineGame = null;
let isRemoteMove = false;

const PIECE_SYMBOLS = {
  pawn: { white: '♙', black: '♟' },
  rook: { white: '♖', black: '♜' },
  knight: { white: '♘', black: '♞' },
  bishop: { white: '♗', black: '♝' },
  queen: { white: '♕', black: '♛' },
  king: { white: '♔', black: '♚' }
};

function sq(col, row) {
  return String.fromCharCode(97 + col) + (8 - row);
}

function fmtTime() {
  const s = Math.floor((Date.now() - startTime) / 1000);
  return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
}

function logMove(piece, fromCol, fromRow, toCol, toRow) {
  const sym = PIECE_SYMBOLS[piece.type]?.[piece.color] || '?';
  const time = fmtTime();
  const label = `${time} ${sym} ${sq(fromCol, fromRow)}-${sq(toCol, toRow)}`;
  moveEntries.push(label);
  if (moveEntries.length > 10) moveEntries.splice(0, moveEntries.length - 10);
  renderMoveLog();
}

function renderMoveLog() {
  moveLog.innerHTML = moveEntries.map(e => {
    const isWhite = e.includes('♙') || e.includes('♖') || e.includes('♘') || e.includes('♗') || e.includes('♕') || e.includes('♔');
    const colorClass = isWhite ? 'white' : 'black';
    return `<div class="entry"><span class="color-tag ${colorClass}"></span><span class="time">${e.slice(0, 5)}</span>${e.slice(6)}</div>`;
  }).join('');
}

function clearMoveLog() {
  moveEntries = [];
  moveLog.innerHTML = '';
}

function updateUI(result) {
  if (game.gameOver) {
    if (game.result === 'checkmate') {
      const winner = game.turn === 'white' ? 'Black' : 'White';
      turnIndicator.textContent = `${winner} wins by checkmate!`;
      statusEl.textContent = 'Game Over';
      statusEl.className = 'visible';
    } else if (game.result === 'stalemate') {
      turnIndicator.textContent = 'Draw by stalemate!';
      statusEl.textContent = 'Game Over';
      statusEl.className = 'visible';
    }
  } else {
    const turn = game.turn.charAt(0).toUpperCase() + game.turn.slice(1);
    if (gameMode !== '2player' && game.turn === 'white' && playerName) {
      turnIndicator.textContent = `${playerName}'s Turn`;
    } else {
      turnIndicator.textContent = `${turn}'s Turn`;
    }
    if (game.inCheck) {
      statusEl.textContent = 'Check!';
      statusEl.className = 'visible';
    } else {
      statusEl.textContent = '';
      statusEl.className = '';
    }
  }
}

const clockEl = document.getElementById('clock');

function updateClock() {
  const s = Math.floor((Date.now() - startTime) / 1000);
  clockEl.textContent = String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
}

function logLastMove() {
  const last = game.moveHistory[game.moveHistory.length - 1];
  if (last) logMove(last.piece, last.from.col, last.from.row, last.to.col, last.to.row);
}

function triggerAI() {
  if (aiThinking || game.gameOver) return;
  aiThinking = true;
  renderer.inputEnabled = false;
  turnIndicator.textContent = 'AI thinking...';

  setTimeout(() => {
    const move = getAIMove(game, gameMode);
    if (move) {
      renderer.executeMove(move);
    } else {
      aiThinking = false;
      renderer.inputEnabled = true;
    }
  }, 200);
}

function sendLocalMove() {
  if (!onlineGame?.isConnected) return;
  const last = game.moveHistory[game.moveHistory.length - 1];
  if (!last) return;
  const isPromotion = last.piece.type === 'pawn' && (last.to.row === 0 || last.to.row === 7);
  onlineGame.sendMove({
    from: { col: last.from.col, row: last.from.row },
    to: { col: last.to.col, row: last.to.row },
    promotion: isPromotion ? 'queen' : null
  });
}

function onMoveDone() {
  if (game.gameOver) return;
  if (onlineGame?.isConnected) {
    sendLocalMove();
    renderer.inputEnabled = false;
    turnIndicator.textContent = 'Waiting for opponent...';
    return;
  }
  if (gameMode !== '2player' && game.turn === 'black') {
    triggerAI();
  }
}

function isPremium() {
  return localStorage.getItem('chess3d_premium') === 'true';
}

function setPremium(val) {
  if (val) {
    localStorage.setItem('chess3d_premium', 'true');
  } else {
    localStorage.removeItem('chess3d_premium');
  }
  updatePremiumUI();
}

function updatePremiumUI() {
  const premium = isPremium();
  const btn = document.getElementById('premium-btn');
  const banner = document.getElementById('ad-banner');
  btn.classList.toggle('active', premium);
  if (premium) {
    banner.classList.add('hidden');
  }
}

function isModeAllowed(mode) {
  if (mode === 'hard' && !isPremium()) return false;
  return true;
}

function isOnlineMode() {
  return gameMode === 'online-host' || gameMode === 'online-join';
}

function startGame() {
  game.reset();
  renderer.resetState();
  renderer.updatePieces();
  renderer.inputEnabled = true;
  promotionDialog.className = '';
  promotionBackdrop.className = '';
  pendingMove = null;
  startTime = Date.now();
  clearMoveLog();
  updateUI({});
  aiThinking = false;
  if (!isOnlineMode() && gameMode !== '2player' && game.turn === 'black') {
    triggerAI();
  }
}

function init() {
  renderer = new Chess3DRenderer(document.body, game, {
    onMove(result) {
      updateUI(result);
      logLastMove();
      aiThinking = false;
      renderer.inputEnabled = true;
      onMoveDone();
    },
    onPromotion(move) {
      if (gameMode !== '2player') {
        game.promotePawn(move, 'queen');
        game.inCheck = game.isInCheck(game.turn);
        if (game.isCheckmate(game.turn)) {
          game.gameOver = true;
          game.result = 'checkmate';
        } else if (game.isStalemate(game.turn)) {
          game.gameOver = true;
          game.result = 'stalemate';
        }
        renderer.updatePieces();
        renderer.highlightMoves([]);
        logLastMove();
        updateUI({});
        renderer.inputEnabled = true;
        aiThinking = false;
        onMoveDone();
      } else {
        pendingMove = move;
        promotionDialog.className = 'visible';
        promotionBackdrop.className = 'visible';
      }
    }
  });
  renderer.init();
  startTime = Date.now();
  if (clockInterval) clearInterval(clockInterval);
  clockInterval = setInterval(updateClock, 1000);
  updateClock();
  updatePremiumUI();
}

document.querySelectorAll('.promotion-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    if (!pendingMove) return;
    const pieceType = btn.dataset.piece;
    game.promotePawn(pendingMove, pieceType);
    game.inCheck = game.isInCheck(game.turn);
    if (game.isCheckmate(game.turn)) {
      game.gameOver = true;
      game.result = 'checkmate';
    } else if (game.isStalemate(game.turn)) {
      game.gameOver = true;
      game.result = 'stalemate';
    }
    renderer.updatePieces();
    renderer.highlightMoves([]);
    promotionDialog.className = '';
    promotionBackdrop.className = '';
    pendingMove = null;
    logLastMove();
    updateUI({});
  });
});

function cancelOnline() {
  if (onlineGame) {
    onlineGame.disconnect();
    onlineGame = null;
  }
  document.getElementById('online-host-area').style.display = 'none';
  document.getElementById('online-join-area').style.display = 'none';
  document.getElementById('online-join-status').textContent = '';
}

function startOnlineGame(isHost) {
  document.getElementById('mode-overlay').className = 'hidden';
  gameMode = isHost ? 'online-host' : 'online-join';
  startGame();
  if (!isHost) {
    renderer.inputEnabled = false;
    turnIndicator.textContent = 'Waiting for host...';
  }
}

function handleRemoteMove(data) {
  isRemoteMove = true;
  const fromRow = data.from.row, fromCol = data.from.col;
  const toRow = data.to.row, toCol = data.to.col;
  const piece = game.board[fromRow][fromCol];
  if (!piece) { isRemoteMove = false; return; }
  game.movePiece({ fromRow, fromCol, toRow, toCol });
  if (data.promotion) {
    const p = game.board[toRow][toCol];
    if (p && p.type === 'pawn') {
      p.type = data.promotion;
    }
  }
  game.inCheck = game.isInCheck(game.turn);
  if (game.isCheckmate(game.turn)) {
    game.gameOver = true; game.result = 'checkmate';
  } else if (game.isStalemate(game.turn)) {
    game.gameOver = true; game.result = 'stalemate';
  }
  renderer.updatePieces();
  renderer.highlightMoves([]);
  logLastMove();
  updateUI({});
  renderer.inputEnabled = true;
  isRemoteMove = false;
}

function handleOnlineDisconnect() {
  turnIndicator.textContent = 'Connection lost!';
  statusEl.textContent = 'Opponent disconnected';
  statusEl.className = 'visible';
  renderer.inputEnabled = false;
  if (onlineGame) {
    onlineGame.disconnect();
    onlineGame = null;
  }
}

document.querySelectorAll('.mode-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const mode = btn.dataset.mode;
    if (mode === 'host') {
      document.getElementById('online-host-area').style.display = 'block';
      document.getElementById('online-join-area').style.display = 'none';
      document.getElementById('online-join-status').textContent = '';
      document.getElementById('room-code').textContent = '...';
      document.getElementById('online-status').textContent = 'Initializing...';
      cancelOnline();
      onlineGame = new OnlineGame(game, {
        onConnect() {
          document.getElementById('online-status').textContent = 'Connected! Starting game...';
          setTimeout(() => startOnlineGame(true), 500);
        },
        onRemoteMove(data) { handleRemoteMove(data); },
        onDisconnect() { handleOnlineDisconnect(); }
      });
      onlineGame.host().then(id => {
        document.getElementById('room-code').textContent = id;
        document.getElementById('online-status').textContent = 'Waiting for opponent...';
      }).catch(() => {
        document.getElementById('online-status').textContent = 'Failed to create game. Try again.';
      });
      return;
    }
    if (mode === 'join') {
      document.getElementById('online-join-area').style.display = 'block';
      document.getElementById('online-host-area').style.display = 'none';
      return;
    }
    if (!isModeAllowed(mode)) {
      document.getElementById('premium-overlay').classList.add('visible');
      return;
    }
    cancelOnline();
    gameMode = mode;
    const input = document.getElementById('name-input');
    playerName = input.value.trim();
    document.getElementById('mode-overlay').className = 'hidden';
    startGame();
  });
});

document.getElementById('online-cancel-btn').addEventListener('click', () => {
  cancelOnline();
});

document.getElementById('online-connect-btn').addEventListener('click', () => {
  const code = document.getElementById('room-code-input').value.trim();
  if (!code) return;
  document.getElementById('online-join-status').textContent = 'Connecting...';
  cancelOnline();
  onlineGame = new OnlineGame(game, {
    onConnect() {
      document.getElementById('online-join-status').textContent = '';
      document.getElementById('room-code-input').value = '';
      setTimeout(() => startOnlineGame(false), 500);
    },
    onRemoteMove(data) { handleRemoteMove(data); },
    onDisconnect() { handleOnlineDisconnect(); }
  });
  onlineGame.join(code).catch(() => {
    document.getElementById('online-join-status').textContent = 'Connection failed. Check the code.';
    cancelOnline();
  });
});

document.getElementById('online-join-cancel-btn').addEventListener('click', () => {
  cancelOnline();
  document.getElementById('room-code-input').value = '';
});

document.getElementById('room-code-input').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') document.getElementById('online-connect-btn').click();
});

document.getElementById('restart-btn').addEventListener('click', () => {
  cancelOnline();
  document.getElementById('mode-overlay').className = '';
});

document.getElementById('controls-btn').addEventListener('click', () => {
  document.getElementById('controls-overlay').className = 'visible';
});
document.getElementById('controls-close').addEventListener('click', () => {
  document.getElementById('controls-overlay').className = '';
});

document.getElementById('theme-btn').addEventListener('click', () => {
  renderer.cycleTheme(isPremium());
});

document.getElementById('premium-btn').addEventListener('click', () => {
  document.getElementById('premium-overlay').classList.toggle('visible');
});

document.getElementById('premium-close').addEventListener('click', () => {
  document.getElementById('premium-overlay').classList.remove('visible');
});

document.getElementById('premium-unlock-btn').addEventListener('click', () => {
  window.open('https://buymeacoffee.com/dudz1308', '_blank');
  const statusEl = document.getElementById('premium-status');
  statusEl.textContent = 'After your purchase, enter the code you received above.';
  statusEl.className = '';
});

document.getElementById('premium-activate-btn').addEventListener('click', () => {
  const code = document.getElementById('premium-code-input').value.trim().toUpperCase();
  const statusEl = document.getElementById('premium-status');
  if (code.startsWith('CHESS3D-PRO-')) {
    setPremium(true);
    statusEl.textContent = 'Premium activated! Enjoy all features.';
    statusEl.className = 'active';
    document.getElementById('premium-btn').textContent = '★';
    document.getElementById('premium-overlay').classList.remove('visible');
  } else {
    statusEl.textContent = 'Invalid code. Support at buymeacoffee.com/dudz1308';
    statusEl.className = 'error';
  }
});

document.getElementById('premium-code-input').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    document.getElementById('premium-activate-btn').click();
  }
});

init();
