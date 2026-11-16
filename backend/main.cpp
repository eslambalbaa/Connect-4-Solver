#include "alpha_beta.hpp"
#include "definitions.hpp"
#include "minimax.hpp"
#include <chrono>
#include <cstddef>
#include <cstdint>
#include <format>
#include <iostream>
#include <string>
#include <utility>

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

GameStyle get_game_style()
{
    int choice;
    std::cin >> choice;

    return static_cast<GameStyle>(choice);
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

std::pair<search_result, double> use_algorithm(const state &current, Algorithm algorithm,
                                               int max_levels = default_max_levels)
{
    const auto start = std::chrono::steady_clock::now();

    search_result result;
    switch (algorithm)
    {
    case Algorithm::minimax:
        result = minimax::get_best_move(current, max_levels);
        break;
    case Algorithm::alpha_beta:
        result = alpha_beta::get_best_move(current, max_levels);
        break;
    default:
        break;
    }

    const auto end = std::chrono::steady_clock::now();
    const double elapsed_ms = std::chrono::duration<double, std::milli>(end - start).count();

    return {result, elapsed_ms};
}

std::string serialize_tree(const tree_node &node)
{
    std::string children_json;
    for (size_t i = 0; i < node.children.size(); ++i)
    {
        children_json += serialize_tree(node.children[i]);
        if (i + 1 < node.children.size())
            children_json += ',';
    }

    return std::format(R"({{"col":{},"level":{},"value":{},"is_max":{},"pruned":{},"children":[{}]}})", node.col,
                       node.level, node.value, node.is_max, node.pruned, children_json);
}

std::string serialize_state(const search_result &best, double elapsed_ms)
{
    std::string rows_json;
    for (int r = 0; r < ROWS; ++r)
    {
        std::string cols_json;
        for (int c = 0; c < COLS; ++c)
        {
            cols_json += std::format("{}{}", static_cast<int>(best.best_move.board[r][c]), (c + 1 < COLS ? "," : ""));
        }
        rows_json += std::format("[{}]{}", cols_json, (r + 1 < ROWS ? "," : ""));
    }

    return std::format(R"({{"board":[{}],"is_terminal":{},"nodes_expanded":{},"time_ms":{:.3f},"tree":{}}})", rows_json,
                       best.best_move.is_terminal(), best.nodes_expanded, elapsed_ms, serialize_tree(best.root));
}

void emit_best_state(const search_result &best, double elapsed_ms)
{
    std::cout << serialize_state(best, elapsed_ms) << '\n' << std::flush;
}

void launch_algorithm(Algorithm algorithm, GameStyle game_style, Cell color, int max_levels = default_max_levels)
{
    state current;
    current.game_style = game_style;
    current.own_color = color;

    while (input_state(current))
    {
        if (current.is_terminal())
            break;

        auto [best, elapsed_ms] = use_algorithm(current, algorithm, max_levels);
        emit_best_state(best, elapsed_ms);

        if (best.best_move.is_terminal())
            break;
    }
}

int main()
{
    Algorithm choice = choose_algorithm();

    GameStyle game_style = get_game_style();

    Cell solver_color = choose_color();

    int max_levels = get_max_levels();

    launch_algorithm(choice, game_style, solver_color, max_levels);
}
