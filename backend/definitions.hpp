#pragma once

#include <array>
#include <cstdint>
#include <limits>
#include <utility>
#include <vector>
#define COMPUTES constexpr
constexpr int INF = std::numeric_limits<int>::max();

constexpr int ROWS = 6;
constexpr int COLS = 7;
constexpr int MAXCONNECTED = 4;

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
    std::array<std::array<Cell, COLS>, ROWS> board{};
    Cell own_color{Cell::empty};
    GameStyle game_style{GameStyle::full_board};

    COMPUTES std::array<state, COLS> get_neighbours() const
    {
        std::array<state, COLS> neighbours{};

        for (int col = 0; col < COLS; ++col)
        {
            if (board[0][col] == Cell::empty)
            {
                neighbours[col] = apply_move(col);
            }
        }

        return neighbours;
    }

    COMPUTES state apply_move(int col) const
    {
        state child = *this;
        child.own_color = (own_color == Cell::red) ? Cell::yellow : Cell::red;

        for (int i = 1; i < ROWS; ++i)
        {
            if (board[i][col] != Cell::empty)
            {
                child.board[i - 1][col] = own_color;
                return child;
            }
        }

        // last row
        child.board[ROWS - 1][col] = own_color;
        return child;
    }

    COMPUTES int count_consecutive(int r, int c, int dr, int dc, Cell target) const
    {
        int count = 0;
        int curr_r = r + dr;
        int curr_c = c + dc;

        while (curr_r >= 0 and curr_r < ROWS and curr_c >= 0 and curr_c < COLS and board[curr_r][curr_c] == target)
        {
            ++count;
            curr_r += dr;
            curr_c += dc;
        }
        return count;
    }

    COMPUTES bool four_connected(int r, int c) const
    {
        const Cell target = board[r][c];
        if (target == Cell::empty)
        {
            return false;
        }

        constexpr std::array<std::pair<int, int>, 4> directions = {{{0, 1}, {1, 0}, {1, 1}, {1, -1}}};

        for (const auto &[dr, dc] : directions)
        {
            const int forward = count_consecutive(r, c, dr, dc, target);

            if (1 + forward >= MAXCONNECTED)
            {
                return true;
            }
        }

        return false;
    }

    COMPUTES int count_fours(Cell target) const
    {
        if (target == Cell::empty)
            return 0;

        constexpr std::array<std::pair<int, int>, 4> directions = {{{0, 1}, {1, 0}, {1, 1}, {1, -1}}};
        int total = 0;

        for (int r = 0; r < ROWS; ++r)
        {
            for (int c = 0; c < COLS; ++c)
            {
                if (board[r][c] != target)
                    continue;

                for (const auto &[dr, dc] : directions)
                {
                    if (1 + count_consecutive(r, c, dr, dc, target) >= MAXCONNECTED)
                    {
                        ++total;
                    }
                }
            }
        }

        return total;
    }

    COMPUTES bool is_board_full() const
    {
        for (int c = 0; c < COLS; ++c)
        {
            if (board[0][c] == Cell::empty)
            {
                return false;
            }
        }
        return true;
    }

    COMPUTES bool has_any_four() const
    {
        for (int r = 0; r < ROWS; ++r)
        {
            for (int c = 0; c < COLS; ++c)
            {
                if (four_connected(r, c))
                {
                    return true;
                }
            }
        }

        return false;
    }

    COMPUTES bool is_terminal() const
    {
        // check for win
        if (game_style == GameStyle::first_four and has_any_four())
            return true;

        return is_board_full();
    }

    COMPUTES int utility(Cell max_player, int level) const;
    // a function involving number of boards own state and the other state
    // it should return a big number if own state is near win and small when
    // other near to win
    // probably should use primes randomness
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

// included here cause utility is defined at the end of it
#include "calculate_utility.hpp"
