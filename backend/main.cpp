#include "alpha_beta.hpp"
#include "definitions.hpp"
#include "minimax.hpp"
#include <iostream>

constexpr int default_max_levels = 6;

enum class Algorithm
{
    minimax,
    alpha_beta
};

Algorithm choose_algorithm()
{
    int choice;
    std::cin >> choice;

    return static_cast<Algorithm>(choice);
}

Cell choose_color()
{
    int choice;
    std::cin >> choice;

    return static_cast<Cell>(choice);
}

int get_max_levels()
{
    int max_levels;
    std::cin >> max_levels;
    return max_levels;
}

bool input_state(state &out_state)
{
    for (int r = 0; r < ROWS; ++r)
    {
        for (int c = 0; c < COLS; ++c)
        {
            int cell_val;
            if (!(std::cin >> cell_val))
            {
                return false;
            }
            out_state.board[r][c] = static_cast<Cell>(cell_val);
        }
    }

    return true;
}

state use_algorithm(const state &current, Algorithm algorithm, int max_levels = default_max_levels)
{
    state best_next;

    switch (algorithm)
    {
    case Algorithm::minimax:
        best_next = minimax::get_best_move(current, max_levels);
        break;
    case Algorithm::alpha_beta:
        best_next = alpha_beta::get_best_move(current, max_levels);
        break;
    default:
        break;
    }

    return best_next;
}

std::string serialize_state(const state &best)
{
    std::string rows_json;
    for (int r = 0; r < ROWS; ++r)
    {
        std::string cols_json;
        for (int c = 0; c < COLS; ++c)
        {
            cols_json += std::format("{}{}", static_cast<int>(best.board[r][c]), (c + 1 < COLS ? "," : ""));
        }
        rows_json += std::format("[{}]{}", cols_json, (r + 1 < ROWS ? "," : ""));
    }

    return std::format(R"({{"board":[{}],"is_terminal":{}}})", rows_json, best.is_terminal());
}

void emit_best_state(const state &best)
{
    std::cout << serialize_state(best) << '\n' << std::flush;
}

void launch_algorithm(Algorithm algorithm, Cell color, int max_levels = default_max_levels)
{
    state current;
    while (input_state(current))
    {
        if (current.is_terminal())
            break;

        current.own_color = color;
        state best = use_algorithm(current, algorithm, max_levels);
        emit_best_state(best);

        if (best.is_terminal())
            break;
    }
}

int main()
{
    Algorithm choice = choose_algorithm();

    Cell solver_color = choose_color();

    int max_levels = get_max_levels();

    launch_algorithm(choice, solver_color, max_levels);
}
