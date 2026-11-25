#include "definitions.hpp"

#ifdef __EMSCRIPTEN__

#include <algorithm>
#include <array>
#include <emscripten/emscripten.h>
#include <string>
#include <utility>

enum class Algorithm
{
    minimax,
    alpha_beta
};

std::pair<search_result, double> use_algorithm(const state &current, Algorithm algorithm, int max_levels);
void append_best_state_json(const search_result &best, double elapsed_ms, std::string &out);

extern "C"
{
    EMSCRIPTEN_KEEPALIVE
    const char *solve_move_json(int algorithm, int game_style, int color, int max_levels, const int *board_42)
    {
        static std::string json_out;
        json_out.clear();

        if (!board_42)
        {
            json_out = R"({"error":"Invalid board buffer"})";
            return json_out.c_str();
        }

        state current;
        current.game_style = static_cast<GameStyle>(game_style);
        current.own_color = static_cast<Cell>(color);

        std::array<std::array<Cell, COLS>, ROWS> board{};
        for (int r = 0; r < ROWS; ++r)
        {
            for (int c = 0; c < COLS; ++c)
            {
                board[r][c] = static_cast<Cell>(board_42[r * COLS + c]);
            }
        }
        current.from_2d_board(board);

        if (current.is_terminal())
        {
            json_out = R"({"error":"Board is already in a terminal state"})";
            return json_out.c_str();
        }

        const int clamped_levels = std::max(1, max_levels);
        auto [best, elapsed_ms] = use_algorithm(current, static_cast<Algorithm>(algorithm), clamped_levels);
        append_best_state_json(best, elapsed_ms, json_out);
        return json_out.c_str();
    }
}

#endif
