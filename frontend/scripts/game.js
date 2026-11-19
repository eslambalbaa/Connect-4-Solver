/**
 * @file game.js
 * @description Core Connect 4 game state engine, rules evaluation,
 * and win-condition verification.
 */

import { BOARD_CONFIG, GAME_STYLES } from './constants.js?v=49';

export class Connect4Game {
  constructor() {
    this.rows = BOARD_CONFIG.ROWS;
    this.cols = BOARD_CONFIG.COLS;
    this.grid = [];
    this.currentPlayer = 1;
    this.gameStyle = GAME_STYLES.FIRST_FOUR;
    this.isOver = false;
    this.isLocked = false;
    this.totalMoves = 0;

    this.reset();
  }

  /**
   * Resets the game state back to an empty grid and player 1.
   */
  reset(gameStyle = this.gameStyle) {
    this.grid = Array.from({ length: this.rows }, () => Array(this.cols).fill(0));
    this.currentPlayer = 1;
    this.gameStyle = gameStyle;
    this.isOver = false;
    this.isLocked = false;
    this.totalMoves = 0;
  }

  /**
   * Finds the lowest available row index in a given column.
   * Returns -1 if the column is completely full.
   *
   * @param {number} col - Column index (0 to COLS - 1)
   * @returns {number} Row index (0 to ROWS - 1) or -1
   */
  getLowestAvailableRow(col) {
    if (col < 0 || col >= this.cols) return -1;
    for (let r = this.rows - 1; r >= 0; r--) {
      if (this.grid[r][col] === 0) {
        return r;
      }
    }
    return -1;
  }

  findMoveCol(nextBoard, player) {
    if (!Array.isArray(nextBoard) || nextBoard.length !== this.rows) {
      return -1;
    }

    let foundCol = -1;
    let foundRow = -1;
    let diffCount = 0;

    for (let r = 0; r < this.rows; r++) {
      const row = nextBoard[r];
      if (!Array.isArray(row) || row.length !== this.cols) {
        return -1;
      }
      for (let c = 0; c < this.cols; c++) {
        const prevVal = this.grid[r][c];
        const nextVal = row[c];
        if (prevVal !== nextVal) {
          if (prevVal !== 0 || nextVal !== player) {
            return -1;
          }
          diffCount++;
          foundRow = r;
          foundCol = c;
        }
      }
    }

    if (diffCount !== 1 || this.getLowestAvailableRow(foundCol) !== foundRow) {
      return -1;
    }

    return foundCol;
  }

  getFourStats(player) {
    const directions = [
      [0, 1],
      [1, 0],
      [1, 1],
      [1, -1]
    ];
    let count = 0;
    const seen = new Set();
    const cells = [];

    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        if (this.grid[r][c] !== player) continue;

        for (const [dr, dc] of directions) {
          let matched = true;
          for (let i = 1; i < 4; i++) {
            const nr = r + i * dr;
            const nc = c + i * dc;
            if (
              nr < 0 ||
              nr >= this.rows ||
              nc < 0 ||
              nc >= this.cols ||
              this.grid[nr][nc] !== player
            ) {
              matched = false;
              break;
            }
          }
          if (matched) {
            count++;
            for (let i = 0; i < 4; i++) {
              const nr = r + i * dr;
              const nc = c + i * dc;
              const key = `${nr},${nc}`;
              if (!seen.has(key)) {
                seen.add(key);
                cells.push([nr, nc]);
              }
            }
          }
        }
      }
    }

    return { count, cells };
  }

  getFourCounts() {
    return {
      1: this.getFourStats(1).count,
      2: this.getFourStats(2).count
    };
  }

  /**
   * Places a disc for the current player in the specified column.
   * Returns placement result object with row, player, winLine, isDraw.
   *
   * @param {number} col
   * @returns {{ success: boolean, row?: number, col?: number, player?: number, winnerId?: number|null, winLine?: Array<[number, number]>|null, isDraw?: boolean, fours?: {1: number, 2: number}|null }}
   */
  dropPiece(col) {
    if (this.isLocked || this.isOver) {
      return { success: false };
    }

    const row = this.getLowestAvailableRow(col);
    if (row < 0) {
      return { success: false, fullColumn: true };
    }

    const player = this.currentPlayer;
    this.grid[row][col] = player;
    this.totalMoves++;

    let winnerId = null;
    let winLine = null;
    let isDraw = false;
    let fours = null;

    if (this.gameStyle === GAME_STYLES.FULL_BOARD) {
      const p1 = this.getFourStats(1);
      const p2 = this.getFourStats(2);
      fours = { 1: p1.count, 2: p2.count };

      if (this.totalMoves >= this.rows * this.cols) {
        this.isOver = true;
        if (p1.count > p2.count) {
          winnerId = 1;
          winLine = p1.cells;
        } else if (p2.count > p1.count) {
          winnerId = 2;
          winLine = p2.cells;
        } else {
          isDraw = true;
        }
      }
    } else {
      winLine = this.checkWin(row, col);
      if (winLine) {
        this.isOver = true;
        winnerId = player;
      } else if (this.totalMoves >= this.rows * this.cols) {
        this.isOver = true;
        isDraw = true;
      }
    }

    return {
      success: true,
      row,
      col,
      player,
      winnerId,
      winLine: winLine || null,
      isDraw,
      fours
    };
  }

  /**
   * Toggles active turn between Player 1 and Player 2.
   * @returns {number} Next player ID
   */
  switchPlayer() {
    this.currentPlayer = this.currentPlayer === 1 ? 2 : 1;
    return this.currentPlayer;
  }

  /**
   * Scans horizontal, vertical, and both diagonal directions from a newly placed piece
   * to determine if 4 or more identical pieces are connected in a line.
   *
   * @param {number} startRow
   * @param {number} startCol
   * @returns {Array<[number, number]> | null} Array of coordinates forming the winning line, or null.
   */
  checkWin(startRow, startCol) {
    const targetPlayer = this.grid[startRow][startCol];
    if (targetPlayer === 0) return null;

    const directions = [
      [0, 1],   // Horizontal
      [1, 0],   // Vertical
      [1, 1],   // Diagonal Down-Right
      [1, -1]   // Diagonal Down-Left
    ];

    for (const [dRow, dCol] of directions) {
      const line = [[startRow, startCol]];

      // Check both positive and negative directions
      for (const step of [1, -1]) {
        let r = startRow + dRow * step;
        let c = startCol + dCol * step;

        while (
          r >= 0 &&
          r < this.rows &&
          c >= 0 &&
          c < this.cols &&
          this.grid[r][c] === targetPlayer
        ) {
          line.push([r, c]);
          r += dRow * step;
          c += dCol * step;
        }
      }

      if (line.length >= 4) {
        return line;
      }
    }

    return null;
  }
}
