import { ChessGame } from './chess-logic.js';
import { Chess3DRenderer } from './chess-3d.js?v=5';
import { getAIMove } from './chess-ai.js?v=5';

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

function onMoveDone() {
  if (game.gameOver) return;
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
  if (gameMode !== '2player' && game.turn === 'black') {
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

document.querySelectorAll('.mode-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const mode = btn.dataset.mode;
    if (!isModeAllowed(mode)) {
      document.getElementById('premium-overlay').classList.add('visible');
      return;
    }
    gameMode = mode;
    const input = document.getElementById('name-input');
    playerName = input.value.trim();
    document.getElementById('mode-overlay').className = 'hidden';
    startGame();
  });
});

document.getElementById('restart-btn').addEventListener('click', () => {
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
