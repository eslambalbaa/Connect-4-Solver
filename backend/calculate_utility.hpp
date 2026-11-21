#pragma once

#include "definitions.hpp"
#include <array>
#include <cstdint>
#include <optional>

namespace internal_calculation
{

constexpr int MAX_UTIL = 100000;
constexpr int MIN_UTIL = -MAX_UTIL;

constexpr int FOUR_POINT_WEIGHT = 10000;

constexpr int DOUBLE_THREAT_BONUS = 5000;
constexpr int FULL_BOARD_DOUBLE_THREAT_BONUS = 500;

constexpr int IMMEDIATE_MIN_THREAT = 65;
constexpr int IMMEDIATE_MAX_THREAT = 50;
constexpr int FUTURE_FAVORED_THREAT = 35;
constexpr int FUTURE_UNFAVORED_THREAT = 15;

constexpr int FULL_BOARD_FAVORED_THREAT = 27;
constexpr int FULL_BOARD_UNFAVORED_THREAT = 23;

constexpr int MIN_OPEN_TWO_HORIZ_DIAG = 5;
constexpr int MAX_OPEN_TWO_HORIZ_DIAG = 4;
constexpr int MIN_OPEN_TWO_VERT = 1;
constexpr int MAX_OPEN_TWO_VERT = 1;

constexpr int POS_LINE_WEIGHT = 1;

consteval int count_winning_lines_through(int r, int c)
{
    constexpr std::array<std::pair<int, int>, 4> dirs = {{{0, 1}, {1, 0}, {1, 1}, {1, -1}}};
    int lines = 0;

    for (const auto &[dr, dc] : dirs)
    {
        for (int offset = 0; offset < MAXCONNECTED; ++offset)
        {
            const int start_r = r - offset * dr;
            const int start_c = c - offset * dc;
            const int end_r = start_r + (MAXCONNECTED - 1) * dr;
            const int end_c = start_c + (MAXCONNECTED - 1) * dc;

            if (start_r >= 0 and start_r < ROWS and start_c >= 0 and start_c < COLS and end_r >= 0 and end_r < ROWS and
                end_c >= 0 and end_c < COLS)
            {
                ++lines;
            }
        }
    }
    return lines * POS_LINE_WEIGHT;
}

struct WeightBucket
{
    int weight = 0;
    uint64_t mask = 0;
};

struct WeightTable
{
    std::array<WeightBucket, ROWS * COLS> buckets{};
    int count = 0;
};

consteval WeightTable build_weight_buckets()
{
    WeightTable table{};

    for (int r = 0; r < ROWS; ++r)
    {
        for (int c = 0; c < COLS; ++c)
        {
            const int w = count_winning_lines_through(r, c);
            if (w == 0)
                continue;

            int idx = 0;
            while (idx < table.count and table.buckets[idx].weight != w)
                ++idx;

            if (idx == table.count)
                table.buckets[table.count++].weight = w;

            table.buckets[idx].mask |= BIT_AT(r, c);
        }
    }

    return table;
}

constexpr auto WEIGHT_TABLE = build_weight_buckets();

#define POPCOUNT(bb) std::popcount(static_cast<uint64_t>(bb))
#define EMPTY_CELLS(mask) ((~(mask)) & FULL_BOARD_MASK)
#define OPPONENT_POS(pos, mask) ((pos) ^ (mask))
#define COL_SLICE(bb, c) (((bb) >> ((c) * BITS_PER_COL)) & PLAYABLE_COL_BITS)
#define ROW_BIT(bit) (1ULL << (bit))

COMPUTES int player_pos_score(uint64_t pos)
{
    int score = 0;
    for (int i = 0; i < WEIGHT_TABLE.count; ++i)
    {
        // weighted sums of the peices we have
        score += WEIGHT_TABLE.buckets[i].weight * POPCOUNT(pos & WEIGHT_TABLE.buckets[i].mask);
    }

    return score;
}

COMPUTES int positional_score(uint64_t max_pos, uint64_t min_pos)
{
    return player_pos_score(max_pos) - player_pos_score(min_pos);
}

COMPUTES std::optional<int> terminal_score(const state &curr, uint64_t max_pos, uint64_t min_pos, int level)
{

    // first four game ends in four in a row
    if (curr.game_style == GameStyle::first_four)
    {
        if (HAS_WON(max_pos))
            return MAX_UTIL - level;
        if (HAS_WON(min_pos))
            return MIN_UTIL + level;
    }

    if (curr.is_board_full())
    {

        const int diff = COUNT_FOURS(max_pos) - COUNT_FOURS(min_pos);
        if (diff > 0)
            return MAX_UTIL + diff * FOUR_POINT_WEIGHT - level;
        if (diff < 0)
            return MIN_UTIL + diff * FOUR_POINT_WEIGHT + level;

        return 0;
    }

    return std::nullopt;
}

COMPUTES int connected_fours_score(const state &curr, uint64_t max_pos, uint64_t min_pos)
{
    if (curr.game_style != GameStyle::full_board)
        return 0;

    return (COUNT_FOURS(max_pos) - COUNT_FOURS(min_pos)) * FOUR_POINT_WEIGHT;
}

COMPUTES uint64_t threat_cells_dir(uint64_t p, uint64_t empty, int d)
{
    const uint64_t p1 = p >> d;
    const uint64_t p2 = p >> (2 * d);
    const uint64_t p3 = p >> (3 * d);

    const uint64_t e0 = empty;
    const uint64_t e1 = empty >> d;
    const uint64_t e2 = empty >> (2 * d);
    const uint64_t e3 = empty >> (3 * d);

    const uint64_t slot0_empty = e0 & p1 & p2 & p3;
    const uint64_t slot1_empty = (p & e1 & p2 & p3) << d;
    const uint64_t slot2_empty = (p & p1 & e2 & p3) << (2 * d);
    const uint64_t slot3_empty = (p & p1 & p2 & e3) << (3 * d);

    return slot0_empty | slot1_empty | slot2_empty | slot3_empty;
}

COMPUTES uint64_t all_threat_cells(uint64_t p, uint64_t empty)
{
    return threat_cells_dir(p, empty, DIR_HORIZ) | threat_cells_dir(p, empty, DIR_VERT) |
           threat_cells_dir(p, empty, DIR_DIAG_UP) | threat_cells_dir(p, empty, DIR_DIAG_DOWN);
}

COMPUTES int count_twos_dir(uint64_t p, uint64_t empty, int d)
{
    const uint64_t p1 = p >> d, p2 = p >> (2 * d), p3 = p >> (3 * d);
    const uint64_t e0 = empty, e1 = empty >> d, e2 = empty >> (2 * d), e3 = empty >> (3 * d);

    return POPCOUNT(p & p1 & e2 & e3) + POPCOUNT(p & e1 & p2 & e3) + POPCOUNT(p & e1 & e2 & p3) +
           POPCOUNT(e0 & p1 & p2 & e3) + POPCOUNT(e0 & p1 & e2 & p3) + POPCOUNT(e0 & e1 & p2 & p3);
}

COMPUTES int twos_score(uint64_t max_pos, uint64_t min_pos, uint64_t empty)
{
    const int max_non_vert = count_twos_dir(max_pos, empty, DIR_HORIZ) + count_twos_dir(max_pos, empty, DIR_DIAG_UP) +
                             count_twos_dir(max_pos, empty, DIR_DIAG_DOWN);
    const int max_vert = count_twos_dir(max_pos, empty, DIR_VERT);

    const int min_non_vert = count_twos_dir(min_pos, empty, DIR_HORIZ) + count_twos_dir(min_pos, empty, DIR_DIAG_UP) +
                             count_twos_dir(min_pos, empty, DIR_DIAG_DOWN);
    const int min_vert = count_twos_dir(min_pos, empty, DIR_VERT);

    return (max_non_vert * MAX_OPEN_TWO_HORIZ_DIAG + max_vert * MAX_OPEN_TWO_VERT) -
           (min_non_vert * MIN_OPEN_TWO_HORIZ_DIAG + min_vert * MIN_OPEN_TWO_VERT);
}
COMPUTES int score_threats(uint64_t mask, uint64_t max_threats, uint64_t min_threats, bool max_is_red,
                           GameStyle game_style)
{
    const bool is_full = (game_style == GameStyle::full_board);
    const int favored_w = is_full ? FULL_BOARD_FAVORED_THREAT : FUTURE_FAVORED_THREAT;
    const int unfavored_w = is_full ? FULL_BOARD_UNFAVORED_THREAT : FUTURE_UNFAVORED_THREAT;
    const int double_threat_w = is_full ? FULL_BOARD_DOUBLE_THREAT_BONUS : DOUBLE_THREAT_BONUS;

    int score = 0;

    for (int c = 0; c < COLS; ++c)
    {
        const uint64_t col_bits = COL_SLICE(mask, c);
        const uint64_t max_col = COL_SLICE(max_threats, c);
        const uint64_t min_col = COL_SLICE(min_threats, c);

        // both are empty
        if ((max_col | min_col) == 0)
            continue;

        const int height = std::countr_one(col_bits);

        bool max_blocked_from_below = false;
        bool min_blocked_from_below = false;

        for (int bit = 0; bit < ROWS; ++bit)
        {
            const bool is_max_t = (max_col & ROW_BIT(bit)) != 0;
            const bool is_min_t = (min_col & ROW_BIT(bit)) != 0;

            // red rows take even values advantage
            const bool is_red_row = ((bit & 1) == 0);

            if (is_max_t and !max_blocked_from_below)
            {
                if (bit < ROWS - 1 and ((max_col & ROW_BIT(bit + 1)) != 0))
                    score += double_threat_w;

                if (bit == height)
                    score += IMMEDIATE_MAX_THREAT;
                else
                    score += (is_red_row == max_is_red) ? favored_w : unfavored_w;
                min_blocked_from_below = true;
            }

            if (is_min_t and !min_blocked_from_below)
            {
                if (bit < ROWS - 1 and ((min_col & ROW_BIT(bit + 1)) != 0))
                    score -= double_threat_w;

                if (bit == height)
                    score -= IMMEDIATE_MIN_THREAT;
                else
                    score -= (is_red_row != max_is_red) ? favored_w : unfavored_w;
                max_blocked_from_below = true;
            }
        }
    }

    return score;
}

COMPUTES static int evaluate(const state &curr, Cell max_player, int level)
{
    const uint64_t max_pos = curr.pos_of(max_player);
    const uint64_t min_pos = OPPONENT_POS(max_pos, curr.mask);

    if (auto win = terminal_score(curr, max_pos, min_pos, level))
    {
        return *win;
    }

    const uint64_t empty = EMPTY_CELLS(curr.mask);
    const uint64_t max_threats = all_threat_cells(max_pos, empty);
    const uint64_t min_threats = all_threat_cells(min_pos, empty);

    int score = 0;
    score += connected_fours_score(curr, max_pos, min_pos);
    score += twos_score(max_pos, min_pos, empty);
    score += score_threats(curr.mask, max_threats, min_threats, max_player == Cell::red, curr.game_style);
    score += positional_score(max_pos, min_pos);

    return score;
}

} // namespace internal_calculation

COMPUTES int state::utility(Cell max_player, int level) const
{
    return internal_calculation::evaluate(*this, max_player, level);
}
