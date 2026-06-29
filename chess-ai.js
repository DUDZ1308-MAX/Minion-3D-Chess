const PIECE_VALUES = { pawn: 100, knight: 320, bishop: 330, rook: 500, queen: 900, king: 20000 };

const PAWN_TABLE = [
  [0,0,0,0,0,0,0,0],[50,50,50,50,50,50,50,50],[10,10,20,30,30,20,10,10],
  [5,5,10,25,25,10,5,5],[0,0,0,20,20,0,0,0],[5,-5,-10,0,0,-10,-5,5],
  [5,10,10,-20,-20,10,10,5],[0,0,0,0,0,0,0,0]
];
const KNIGHT_TABLE = [
  [-50,-40,-30,-30,-30,-30,-40,-50],[-40,-20,0,0,0,0,-20,-40],
  [-30,0,10,15,15,10,0,-30],[-30,5,15,20,20,15,5,-30],
  [-30,0,15,20,20,15,0,-30],[-30,5,10,15,15,10,5,-30],
  [-40,-20,0,5,5,0,-20,-40],[-50,-40,-30,-30,-30,-30,-40,-50]
];
const BISHOP_TABLE = [
  [-20,-10,-10,-10,-10,-10,-10,-20],[-10,0,0,0,0,0,0,-10],
  [-10,0,5,10,10,5,0,-10],[-10,5,5,10,10,5,5,-10],
  [-10,0,5,10,10,5,0,-10],[-10,10,5,10,10,5,10,-10],
  [-10,5,0,0,0,0,5,-10],[-20,-10,-10,-10,-10,-10,-10,-20]
];
const ROOK_TABLE = [
  [0,0,0,0,0,0,0,0],[5,10,10,10,10,10,10,5],[-5,0,0,0,0,0,0,-5],
  [-5,0,0,0,0,0,0,-5],[-5,0,0,0,0,0,0,-5],[-5,0,0,0,0,0,0,-5],
  [-5,0,0,0,0,0,0,-5],[0,0,0,5,5,0,0,0]
];
const QUEEN_TABLE = [
  [-20,-10,-10,-5,-5,-10,-10,-20],[-10,0,0,0,0,0,0,-10],
  [-10,0,5,5,5,5,0,-10],[-5,0,5,5,5,5,0,-5],
  [0,0,5,5,5,5,0,-5],[-10,5,5,5,5,5,0,-10],
  [-10,0,5,0,0,0,0,-10],[-20,-10,-10,-5,-5,-10,-10,-20]
];
const KING_TABLE = [
  [-30,-40,-40,-50,-50,-40,-40,-30],[-30,-40,-40,-50,-50,-40,-40,-30],
  [-30,-40,-40,-50,-50,-40,-40,-30],[-30,-40,-40,-50,-50,-40,-40,-30],
  [-20,-30,-30,-40,-40,-30,-30,-20],[-10,-20,-20,-20,-20,-20,-20,-10],
  [20,20,0,0,0,0,20,20],[20,30,10,0,0,10,30,20]
];

const TABLES = { pawn: PAWN_TABLE, knight: KNIGHT_TABLE, bishop: BISHOP_TABLE, rook: ROOK_TABLE, queen: QUEEN_TABLE, king: KING_TABLE };

function evaluateBoard(game, aiColor) {
  let score = 0;
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const p = game.board[row][col];
      if (!p) continue;
      const val = PIECE_VALUES[p.type];
      const table = TABLES[p.type];
      const pos = p.color === 'white' ? table[row][col] : table[7 - row][col];
      score += (p.color === aiColor ? 1 : -1) * (val + pos);
    }
  }
  return score;
}

function orderMoves(game, moves) {
  return moves.sort((a, b) => {
    const capA = game.board[a.toRow][a.toCol];
    const capB = game.board[b.toRow][b.toCol];
    const valA = capA ? PIECE_VALUES[capA.type] : 0;
    const valB = capB ? PIECE_VALUES[capB.type] : 0;
    return valB - valA;
  });
}

function minimax(game, depth, alpha, beta, isMaximizing, aiColor) {
  if (depth === 0 || game.gameOver) {
    if (game.gameOver) {
      if (game.result === 'checkmate') return isMaximizing ? -100000 : 100000;
      return 0;
    }
    return evaluateBoard(game, aiColor);
  }

  const moves = orderMoves(game, game.getAllLegalMoves(game.turn));
  if (moves.length === 0) return evaluateBoard(game, aiColor);

  if (isMaximizing) {
    let maxEval = -Infinity;
    for (const move of moves) {
      const clone = game.clone();
      const result = clone.makeMove(move);
      if (result && result.promotion) clone.promotePawn(move, 'queen');
      const score = minimax(clone, depth - 1, alpha, beta, false, aiColor);
      maxEval = Math.max(maxEval, score);
      alpha = Math.max(alpha, score);
      if (beta <= alpha) break;
    }
    return maxEval;
  } else {
    let minEval = Infinity;
    for (const move of moves) {
      const clone = game.clone();
      const result = clone.makeMove(move);
      if (result && result.promotion) clone.promotePawn(move, 'queen');
      const score = minimax(clone, depth - 1, alpha, beta, true, aiColor);
      minEval = Math.min(minEval, score);
      beta = Math.min(beta, score);
      if (beta <= alpha) break;
    }
    return minEval;
  }
}

const DEPTH_MAP = { easy: 1, medium: 2, hard: 3 };

export function getAIMove(game, difficulty) {
  const depth = DEPTH_MAP[difficulty] || 2;
  const aiColor = 'black';
  const moves = game.getAllLegalMoves(aiColor);
  if (moves.length === 0) return null;

  let bestMove = moves[0];
  let bestScore = -Infinity;

  for (const move of moves) {
    const clone = game.clone();
    const result = clone.makeMove(move);
    if (result && result.promotion) clone.promotePawn(move, 'queen');
    const score = minimax(clone, depth - 1, -Infinity, Infinity, false, aiColor);

    if (difficulty === 'easy') {
      const noise = Math.random() * 100;
      if (score + noise > bestScore) {
        bestScore = score + noise;
        bestMove = move;
      }
    } else {
      if (score > bestScore) {
        bestScore = score;
        bestMove = move;
      }
    }
  }

  return bestMove;
}
