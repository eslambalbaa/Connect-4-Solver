#pragma once

#include <array>
#include <limits>
#include <vector>
#define COMPUTES constexpr
constexpr int INF = std::numeric_limits<int>::max();

constexpr int ROWS = 6;
constexpr int COLS = 7;
constexpr int MAXCONNECTED = 4;
enum class Cell
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

    COMPUTES std::vector<state> get_neighbours() const
    {
        std::vector<state> neighbours;
        neighbours.reserve(COLS);

        for (int col = 0; col < COLS; ++col)
        {
            if (board[0][col] == Cell::empty)
            {
                neighbours.emplace_back(apply_move(col));
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

    COMPUTES bool is_terminal() const
    {
        // check for win
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

        // check for draw
        for (int c = 0; c < COLS; ++c)
        {
            if (board[0][c] == Cell::empty)
            {
                return false;
            }
        }

        return true;
    }

    COMPUTES int utility(Cell max_player, int level) const;
    // a function involving number of boards own state and the other state
    // it should return a big number if own state is near win and small when
    // other near to win
    // probably should use primes randomness
};

// included here cause utility is defined at the end of it
#include "calculate_utility.hpp"
