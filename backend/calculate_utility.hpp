#pragma once

#include "definitions.hpp"
#include <array>
#include <optional>

namespace internal_calculation
{

constexpr int MAX_UTIL = 100000;
constexpr int MIN_UTIL = -MAX_UTIL;

constexpr int FOUR_POINT_WEIGHT = 10000;

using GridBool = std::array<std::array<bool, COLS>, ROWS>;

struct ThreatMap
{
    GridBool max{};
    GridBool min{};
};

// favour the middle as it has more moves
constexpr std::array<std::array<int, COLS>, ROWS> POSITION_WEIGHTS = {{{3, 4, 5, 7, 5, 4, 3},
                                                                       {4, 6, 8, 10, 8, 6, 4},
                                                                       {5, 8, 11, 13, 11, 8, 5},
                                                                       {5, 8, 11, 13, 11, 8, 5},
                                                                       {4, 6, 8, 10, 8, 6, 4},
                                                                       {3, 4, 5, 7, 5, 4, 3}}};

COMPUTES Cell min_player_color(Cell max_player)
{
    return (max_player == Cell::red) ? Cell::yellow : Cell::red;
}

COMPUTES int positional_score(const state &curr, Cell max_player)
{
    const Cell min_player = min_player_color(max_player);
    int score = 0;

    for (int r = 0; r < ROWS; ++r)
    {
        for (int c = 0; c < COLS; ++c)
        {
            if (curr.board[r][c] == max_player)
                score += POSITION_WEIGHTS[r][c];
            else if (curr.board[r][c] == min_player)
                score -= POSITION_WEIGHTS[r][c];
        }
    }

    return score;
}

COMPUTES int drop_distance(const state &curr, int r, int c)
{
    int empty_below = 0;
    for (int row = r + 1; row < ROWS and curr.board[row][c] == Cell::empty; ++row)
    {
        empty_below++;
    }
    return empty_below;
}

COMPUTES std::optional<int> terminal_score(const state &curr, Cell max_player, int level)
{

    // first four game ends in four in a row
    if (curr.game_style == GameStyle::first_four)
    {
        for (int r = 0; r < ROWS; ++r)
        {
            for (int c = 0; c < COLS; ++c)
            {
                if (curr.four_connected(r, c))
                    return (curr.board[r][c] == max_player) ? MAX_UTIL - level : MIN_UTIL + level;
            }
        }
    }

    if (curr.is_board_full())
    {
        const Cell min_player = min_player_color(max_player);
        const int diff = curr.count_fours(max_player) - curr.count_fours(min_player);
        if (diff > 0)
            return MAX_UTIL + diff * FOUR_POINT_WEIGHT - level;
        if (diff < 0)
            return MIN_UTIL + diff * FOUR_POINT_WEIGHT + level;

        return 0;
    }

    return std::nullopt;
}

COMPUTES int connected_fours_score(const state &curr, Cell max_player)
{
    if (curr.game_style != GameStyle::full_board)
        return 0;

    const Cell min_player = min_player_color(max_player);
    return (curr.count_fours(max_player) - curr.count_fours(min_player)) * FOUR_POINT_WEIGHT;
}

COMPUTES int score_threats(const state &curr, const ThreatMap &threats)
{
    int score = 0;

    for (int c = 0; c < COLS; ++c)
    {
        bool max_blocked_from_below = false;
        bool min_blocked_from_below = false;

        for (int r = ROWS - 1; r >= 0; --r)
        {
            if (r > 0 and threats.max[r][c] == true and threats.max[r - 1][c] == true)
                score += 5000;
            if (r > 0 and threats.min[r][c] == true and threats.min[r - 1][c] == true)
                score -= 5000;

            if (threats.max[r][c] and !max_blocked_from_below)
            {
                // if I reach it right away it takes more
                score += (drop_distance(curr, r, c) == 0) ? 50 : 20;
                min_blocked_from_below = true;
            }

            if (threats.min[r][c] && !min_blocked_from_below)
            {
                score -= (drop_distance(curr, r, c) == 0) ? 65 : 25;
                max_blocked_from_below = true;
            }
        }
    }

    return score;
}

COMPUTES int evaluate_window(const state &curr, int r, int c, int dr, int dc, Cell max_player, ThreatMap &threats)
{
    const Cell min_player = min_player_color(max_player);
    int max_cnt = 0;
    int min_cnt = 0;
    int empty_r = -1;
    int empty_c = -1;

    for (int i = 0; i < MAXCONNECTED; ++i)
    {
        const int nr = r + i * dr;
        const int nc = c + i * dc;
        const Cell cell = curr.board[nr][nc];

        if (cell == max_player)
            ++max_cnt;
        else if (cell == min_player)
            ++min_cnt;
        else
        {
            empty_r = nr;
            empty_c = nc;
        }
    }

    // blocked window
    if (max_cnt > 0 and min_cnt > 0)
        return 0;

    if (max_cnt == 3)
    {
        threats.max[empty_r][empty_c] = true;
        return 0;
    }
    if (min_cnt == 3)
    {
        threats.min[empty_r][empty_c] = true;
        return 0;
    }

    const bool is_vertical = (dc == 0);
    if (max_cnt == 2)
        return is_vertical ? 1 : 4;
    if (min_cnt == 2)
        return is_vertical ? -1 : -5;

    return 0;
}

COMPUTES int scan_all_windows(const state &curr, Cell max_player, ThreatMap &threats)
{
    int score = 0;

    // east
    for (int r = 0; r < ROWS; ++r)
        for (int c = 0; c <= COLS - MAXCONNECTED; ++c)
            score += evaluate_window(curr, r, c, 0, 1, max_player, threats);

    // south
    for (int r = 0; r <= ROWS - MAXCONNECTED; ++r)
        for (int c = 0; c < COLS; ++c)
            score += evaluate_window(curr, r, c, 1, 0, max_player, threats);

    // diagonal  south east
    for (int r = 0; r <= ROWS - MAXCONNECTED; ++r)
        for (int c = 0; c <= COLS - MAXCONNECTED; ++c)
            score += evaluate_window(curr, r, c, 1, 1, max_player, threats);

    // doagonal north east
    for (int r = MAXCONNECTED - 1; r < ROWS; ++r)
        for (int c = 0; c <= COLS - MAXCONNECTED; ++c)
            score += evaluate_window(curr, r, c, -1, 1, max_player, threats);

    return score;
}

COMPUTES static int evaluate(const state &curr, Cell max_player, int level)
{
    if (auto win = terminal_score(curr, max_player, level))
    {
        return *win;
    }

    ThreatMap threats;
    int score = 0;

    score += connected_fours_score(curr, max_player);
    score += scan_all_windows(curr, max_player, threats);
    score += score_threats(curr, threats);
    score += positional_score(curr, max_player);

    return score;
}

} // namespace internal_calculation

COMPUTES int state::utility(Cell max_player, int level) const
{
    return internal_calculation::evaluate(*this, max_player, level);
}
