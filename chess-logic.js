export class ChessGame {
  constructor() {
    this.reset();
  }

  reset() {
    this.board = Array(8).fill(null).map(() => Array(8).fill(null));
    this.turn = 'white';
    this.moveHistory = [];
    this.enPassantTarget = null;
    this.castlingRights = {
      white: { kingSide: true, queenSide: true },
      black: { kingSide: true, queenSide: true }
    };
    this.gameOver = false;
    this.lastMove = null;
    this.inCheck = false;
    this.result = null;
    this.setupPieces();
  }

  setupPieces() {
    const backRow = ['rook', 'knight', 'bishop', 'queen', 'king', 'bishop', 'knight', 'rook'];
    for (let col = 0; col < 8; col++) {
      this.board[0][col] = { type: backRow[col], color: 'black' };
      this.board[1][col] = { type: 'pawn', color: 'black' };
      this.board[6][col] = { type: 'pawn', color: 'white' };
      this.board[7][col] = { type: backRow[col], color: 'white' };
    }
  }

  getPiece(row, col) {
    if (row < 0 || row > 7 || col < 0 || col > 7) return null;
    return this.board[row][col];
  }

  findKing(color) {
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const p = this.board[row][col];
        if (p && p.type === 'king' && p.color === color) return { row, col };
      }
    }
    return null;
  }

  isInBounds(row, col) {
    return row >= 0 && row < 8 && col >= 0 && col < 8;
  }

  generatePseudoMoves(row, col, skipCastlingCheck = false) {
    const piece = this.board[row][col];
    if (!piece) return [];

    switch (piece.type) {
      case 'pawn': return this.generatePawnMoves(row, col, piece.color);
      case 'rook': return this.generateSlidingMoves(row, col, piece.color, [[1,0],[-1,0],[0,1],[0,-1]]);
      case 'knight': return this.generateKnightMoves(row, col, piece.color);
      case 'bishop': return this.generateSlidingMoves(row, col, piece.color, [[1,1],[1,-1],[-1,1],[-1,-1]]);
      case 'queen': return this.generateSlidingMoves(row, col, piece.color, [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]);
      case 'king': return this.generateKingMoves(row, col, piece.color, skipCastlingCheck);
      default: return [];
    }
  }

  generatePawnMoves(row, col, color) {
    const moves = [];
    const dir = color === 'white' ? -1 : 1;
    const startRow = color === 'white' ? 6 : 1;

    const fRow = row + dir;
    if (this.isInBounds(fRow, col) && !this.board[fRow][col]) {
      moves.push({ fromRow: row, fromCol: col, toRow: fRow, toCol: col });
      const fRow2 = row + 2 * dir;
      if (row === startRow && !this.board[fRow2][col]) {
        moves.push({ fromRow: row, fromCol: col, toRow: fRow2, toCol: col, doublePawnPush: true });
      }
    }

    for (const dc of [-1, 1]) {
      const cRow = row + dir;
      const cCol = col + dc;
      if (this.isInBounds(cRow, cCol)) {
        const target = this.board[cRow][cCol];
        if (target && target.color !== color) {
          moves.push({ fromRow: row, fromCol: col, toRow: cRow, toCol: cCol });
        }
        if (this.enPassantTarget && this.enPassantTarget.row === cRow && this.enPassantTarget.col === cCol) {
          moves.push({ fromRow: row, fromCol: col, toRow: cRow, toCol: cCol, enPassantCapture: true });
        }
      }
    }

    return moves;
  }

  generateSlidingMoves(row, col, color, directions) {
    const moves = [];
    for (const [dr, dc] of directions) {
      let r = row + dr;
      let c = col + dc;
      while (this.isInBounds(r, c)) {
        const target = this.board[r][c];
        if (!target) {
          moves.push({ fromRow: row, fromCol: col, toRow: r, toCol: c });
        } else {
          if (target.color !== color) {
            moves.push({ fromRow: row, fromCol: col, toRow: r, toCol: c });
          }
          break;
        }
        r += dr;
        c += dc;
      }
    }
    return moves;
  }

  generateKnightMoves(row, col, color) {
    const moves = [];
    const offsets = [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]];
    for (const [dr, dc] of offsets) {
      const r = row + dr;
      const c = col + dc;
      if (this.isInBounds(r, c)) {
        const target = this.board[r][c];
        if (!target || target.color !== color) {
          moves.push({ fromRow: row, fromCol: col, toRow: r, toCol: c });
        }
      }
    }
    return moves;
  }

  generateKingMoves(row, col, color, skipCastlingCheck = false) {
    const moves = [];
    const offsets = [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]];
    for (const [dr, dc] of offsets) {
      const r = row + dr;
      const c = col + dc;
      if (this.isInBounds(r, c)) {
        const target = this.board[r][c];
        if (!target || target.color !== color) {
          moves.push({ fromRow: row, fromCol: col, toRow: r, toCol: c });
        }
      }
    }

    if (!skipCastlingCheck) {
      const rights = this.castlingRights[color];
      const backRow = color === 'white' ? 7 : 0;
      const kingPos = this.findKing(color);
      if (row === backRow && col === 4 && kingPos && !this.isInCheck(color)) {
        if (rights.kingSide && !this.board[backRow][5] && !this.board[backRow][6]) {
          const rook = this.board[backRow][7];
          if (rook && rook.type === 'rook' && rook.color === color) {
            if (!this.isSquareAttacked(backRow, 5, color === 'white' ? 'black' : 'white') &&
                !this.isSquareAttacked(backRow, 6, color === 'white' ? 'black' : 'white')) {
              moves.push({ fromRow: row, fromCol: col, toRow: backRow, toCol: 6, castling: 'kingSide' });
            }
          }
        }
        if (rights.queenSide && !this.board[backRow][3] && !this.board[backRow][2] && !this.board[backRow][1]) {
          const rook = this.board[backRow][0];
          if (rook && rook.type === 'rook' && rook.color === color) {
            if (!this.isSquareAttacked(backRow, 3, color === 'white' ? 'black' : 'white') &&
                !this.isSquareAttacked(backRow, 2, color === 'white' ? 'black' : 'white')) {
              moves.push({ fromRow: row, fromCol: col, toRow: backRow, toCol: 2, castling: 'queenSide' });
            }
          }
        }
      }
    }

    return moves;
  }

  isMoveLegal(move) {
    const gameCopy = this.clone();
    const piece = gameCopy.board[move.fromRow][move.fromCol];
    gameCopy.board[move.toRow][move.toCol] = piece;
    gameCopy.board[move.fromRow][move.fromCol] = null;

    if (move.enPassantCapture) {
      gameCopy.board[move.fromRow][move.toCol] = null;
    }

    if (move.castling) {
      const backRow = move.toRow;
      if (move.castling === 'kingSide') {
        gameCopy.board[backRow][5] = gameCopy.board[backRow][7];
        gameCopy.board[backRow][7] = null;
        // King passes through f-file (col 5) - check if attacked
        if (this.isSquareAttacked(backRow, 5, piece.color === 'white' ? 'black' : 'white')) return false;
      } else {
        gameCopy.board[backRow][3] = gameCopy.board[backRow][0];
        gameCopy.board[backRow][0] = null;
        // King passes through d-file (col 3) - check if attacked
        if (this.isSquareAttacked(backRow, 3, piece.color === 'white' ? 'black' : 'white')) return false;
      }
    }

    return !gameCopy.isInCheck(piece.color);
  }

  getLegalMoves(row, col) {
    const piece = this.board[row][col];
    if (!piece || this.gameOver) return [];
    if (piece.color !== this.turn) return [];
    const pseudoMoves = this.generatePseudoMoves(row, col);
    return pseudoMoves.filter(move => this.isMoveLegal(move));
  }

  getAllLegalMoves(color) {
    if (!color) color = this.turn;
    const allMoves = [];
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const piece = this.board[row][col];
        if (piece && piece.color === color) {
          allMoves.push(...this.getLegalMoves(row, col));
        }
      }
    }
    return allMoves;
  }

  isInCheck(color) {
    const king = this.findKing(color);
    if (!king) return true;
    const opponent = color === 'white' ? 'black' : 'white';
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const piece = this.board[row][col];
        if (piece && piece.color === opponent) {
          const moves = this.generatePseudoMoves(row, col, true);
          for (const move of moves) {
            if (move.toRow === king.row && move.toCol === king.col) {
              return true;
            }
          }
        }
      }
    }
    return false;
  }

  isSquareAttacked(row, col, byColor) {
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const piece = this.board[r][c];
        if (piece && piece.color === byColor) {
          const moves = this.generatePseudoMoves(r, c, true);
          for (const move of moves) {
            if (move.toRow === row && move.toCol === col) {
              return true;
            }
          }
        }
      }
    }
    return false;
  }

  isCheckmate(color) {
    if (!this.isInCheck(color)) return false;
    return this.getAllLegalMoves(color).length === 0;
  }

  isStalemate(color) {
    if (this.isInCheck(color)) return false;
    return this.getAllLegalMoves(color).length === 0;
  }

  makeMove(move) {
    const piece = this.board[move.fromRow][move.fromCol];
    if (!piece) return { success: false };

    const promoteRow = piece.color === 'white' ? 0 : 7;
    const isPromotion = piece.type === 'pawn' && move.toRow === promoteRow;
    const capturedPiece = this.board[move.toRow][move.toCol];

    this.board[move.toRow][move.toCol] = piece;
    this.board[move.fromRow][move.fromCol] = null;

    if (move.enPassantCapture) {
      this.board[move.fromRow][move.toCol] = null;
    }

    if (move.castling) {
      const backRow = move.toRow;
      if (move.castling === 'kingSide') {
        this.board[backRow][5] = this.board[backRow][7];
        this.board[backRow][7] = null;
      } else {
        this.board[backRow][3] = this.board[backRow][0];
        this.board[backRow][0] = null;
      }
    }

    this.enPassantTarget = move.doublePawnPush
      ? { row: (move.fromRow + move.toRow) / 2, col: move.toCol }
      : null;

    if (piece.type === 'king') {
      this.castlingRights[piece.color].kingSide = false;
      this.castlingRights[piece.color].queenSide = false;
    }
    if (piece.type === 'rook') {
      if (move.fromCol === 0) this.castlingRights[piece.color].queenSide = false;
      if (move.fromCol === 7) this.castlingRights[piece.color].kingSide = false;
    }
    const oppColor = piece.color === 'white' ? 'black' : 'white';
    if (move.toCol === 0) this.castlingRights[oppColor].queenSide = false;
    if (move.toCol === 7) this.castlingRights[oppColor].kingSide = false;

    this.lastMove = { from: { row: move.fromRow, col: move.fromCol }, to: { row: move.toRow, col: move.toCol } };
    this.moveHistory.push({
      piece: { ...piece },
      from: { row: move.fromRow, col: move.fromCol },
      to: { row: move.toRow, col: move.toCol },
      captured: capturedPiece ? { ...capturedPiece } : null,
      castling: move.castling || null,
      enPassantCapture: move.enPassantCapture || null
    });

    this.turn = this.turn === 'white' ? 'black' : 'white';

    this.inCheck = this.isInCheck(this.turn);
    if (this.isCheckmate(this.turn)) {
      this.gameOver = true;
      this.result = 'checkmate';
      return { success: true, checkmate: true, winner: piece.color };
    }
    if (this.isStalemate(this.turn)) {
      this.gameOver = true;
      this.result = 'stalemate';
      return { success: true, stalemate: true };
    }

    if (isPromotion) {
      return { success: true, promotion: true, move, check: this.inCheck };
    }

    return { success: true, check: this.inCheck };
  }

  promotePawn(move, promoteTo) {
    const piece = this.board[move.toRow][move.toCol];
    if (piece && piece.type === 'pawn') {
      piece.type = promoteTo;
    }
  }

  clone() {
    const game = new ChessGame();
    game.board = this.board.map(row => row.map(cell => cell ? { ...cell } : null));
    game.turn = this.turn;
    game.moveHistory = [...this.moveHistory];
    game.enPassantTarget = this.enPassantTarget ? { ...this.enPassantTarget } : null;
    game.castlingRights = {
      white: { ...this.castlingRights.white },
      black: { ...this.castlingRights.black }
    };
    game.gameOver = this.gameOver;
    game.lastMove = this.lastMove ? {
      from: { ...this.lastMove.from },
      to: { ...this.lastMove.to }
    } : null;
    game.inCheck = this.inCheck;
    game.result = this.result;
    return game;
  }
}
