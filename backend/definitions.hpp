#pragma once

#include <array>
#include <bit>
#include <cstdint>
#include <limits>
#include <utility>
#include <vector>

#define COMPUTES constexpr
constexpr int INF = std::numeric_limits<int>::max();

constexpr int ROWS = 6;
constexpr int COLS = 7;
constexpr int MAXCONNECTED = 4;

// one extra bit as a guard
constexpr int BITS_PER_COL = ROWS + 1;
constexpr uint64_t PLAYABLE_COL_BITS = (1ULL << ROWS) - 1;

constexpr int DIR_VERT = 1;
constexpr int DIR_HORIZ = BITS_PER_COL;
constexpr int DIR_DIAG_DOWN = BITS_PER_COL - 1; // '\'
constexpr int DIR_DIAG_UP = BITS_PER_COL + 1;   // '/'

consteval uint64_t build_full_board_mask()
{
    uint64_t mask = 0;
    for (int c = 0; c < COLS; ++c)
    {
        mask |= (PLAYABLE_COL_BITS << (c * BITS_PER_COL));
    }
    return mask;
}

constexpr uint64_t FULL_BOARD_MASK = build_full_board_mask();

#define BIT_AT(r, c) (1ULL << ((c) * BITS_PER_COL + (ROWS - 1 - (r))))

#define COL_BOTTOM(c) (1ULL << ((c) * BITS_PER_COL))
#define COL_TOP(c) (1ULL << ((c) * BITS_PER_COL + (ROWS - 1)))
#define OPPONENT_POS(pos, mask) ((pos) ^ (mask))
#define CAN_PLAY(mask, c) (((mask) & COL_TOP(c)) == 0)
#define DROP_PIECE(mask, c) ((mask) | ((mask) + COL_BOTTOM(c)))
#define IS_BOARD_FULL(mask) ((mask) == FULL_BOARD_MASK)
#define POPCOUNT(bb) std::popcount(static_cast<uint64_t>(bb))

#define LINE_4(pos, dir) (((pos) & ((pos) >> (dir))) & (((pos) & ((pos) >> (dir))) >> (2 * (dir))))
#define HAS_LINE_4(pos, dir) (LINE_4((pos), (dir)) != 0)
#define HAS_WON(pos)                                                                                                   \
    (HAS_LINE_4((pos), DIR_HORIZ) or HAS_LINE_4((pos), DIR_VERT) or HAS_LINE_4((pos), DIR_DIAG_UP) or                  \
     HAS_LINE_4((pos), DIR_DIAG_DOWN))
#define COUNT_FOURS(pos)                                                                                               \
    (POPCOUNT(LINE_4((pos), DIR_HORIZ)) + POPCOUNT(LINE_4((pos), DIR_VERT)) + POPCOUNT(LINE_4((pos), DIR_DIAG_UP)) +   \
     POPCOUNT(LINE_4((pos), DIR_DIAG_DOWN)))

enum class GameStyle
{
    full_board,
    first_four
};

enum class Cell : uint8_t
{
    empty,
    red,
    yellow
};

class state
{
  public:
    // all occupied
    uint64_t mask{0};
    uint64_t current_position{0}; // bits occupied by us
    Cell own_color{Cell::empty};
    GameStyle game_style{GameStyle::full_board};

    COMPUTES std::array<state, COLS> get_neighbours() const
    {
        std::array<state, COLS> neighbours{};

        for (int col = 0; col < COLS; ++col)
        {
            if (CAN_PLAY(mask, col))
            {
                neighbours[col] = apply_move(col);
            }
        }

        return neighbours;
    }

    COMPUTES uint64_t pos_of(Cell target) const
    {
        if (target == Cell::empty)
            return 0;

        return (target == own_color) ? current_position : OPPONENT_POS(current_position, mask);
    }

    COMPUTES bool is_board_full() const
    {
        return IS_BOARD_FULL(mask);
    }

    COMPUTES bool is_terminal() const
    {
        // check for win
        if (game_style == GameStyle::first_four and has_any_four())
            return true;

        return is_board_full();
    }

    COMPUTES Cell get_cell(int r, int c) const
    {
        const uint64_t cell_bit = BIT_AT(r, c);
        if ((mask & cell_bit) == 0)
            return Cell::empty;
        if ((current_position & cell_bit) != 0)
            return own_color;
        return (own_color == Cell::red) ? Cell::yellow : Cell::red;
    }

    COMPUTES void from_2d_board(const std::array<std::array<Cell, COLS>, ROWS> &board)
    {
        mask = 0;
        current_position = 0;
        for (int r = 0; r < ROWS; ++r)
        {
            for (int c = 0; c < COLS; ++c)
            {
                if (board[r][c] == Cell::empty)
                    continue;

                const uint64_t cell_bit = BIT_AT(r, c);
                mask |= cell_bit;
                if (board[r][c] == own_color)
                    current_position |= cell_bit;
            }
        }
    }

    COMPUTES int utility(Cell max_player, int level) const;

  private:
    COMPUTES state apply_move(int col) const
    {
        state child;
        child.current_position = OPPONENT_POS(current_position, mask);
        child.mask = DROP_PIECE(mask, col);
        child.own_color = (own_color == Cell::red) ? Cell::yellow : Cell::red;
        child.game_style = game_style;
        return child;
    }

    COMPUTES int count_fours(Cell target) const
    {
        // get the owner's position mask
        const uint64_t pos = pos_of(target);
        return pos == 0 ? 0 : COUNT_FOURS(pos);
    }

    COMPUTES bool has_any_four() const
    {
        return HAS_WON(current_position) or HAS_WON(OPPONENT_POS(current_position, mask));
    }
};

struct tree_node
{
    int col = -1;
    int level = 0;
    int value = 0;
    bool is_max = true;
    bool pruned = false;
    std::vector<tree_node> children;
};

struct search_result
{
    state best_move;
    uint64_t nodes_expanded = 0; // could be massive
    tree_node root;
};

// set for -1 if we need unlimited depth
constexpr int MAX_RECORD_DEPTH = 4;

inline bool should_record(int level)
{
    return MAX_RECORD_DEPTH < 0 || level < MAX_RECORD_DEPTH;
}

// included here cause utility is defined at the end of it
#include "calculate_utility.hpp"
