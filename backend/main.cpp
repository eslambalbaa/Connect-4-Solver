#include "alpha_beta.hpp"
#include "definitions.hpp"
#include "minimax.hpp"
#include <charconv>
#include <chrono>
#include <cstddef>
#include <format>
#include <iostream>
#include <string>
#include <utility>

#define FAST_IO_ON                                                                                                     \
    std::ios::sync_with_stdio(false);                                                                                  \
    std::cin.tie(nullptr);

constexpr size_t BYTES_PER_TREE_NODE = 90;
constexpr size_t BASE_PAYLOAD_BYTES = 512;

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
    std::array<std::array<Cell, COLS>, ROWS> board{};
    for (int r = 0; r < ROWS; ++r)
    {
        for (int c = 0; c < COLS; ++c)
        {
            int cell_val;
            if (!(std::cin >> cell_val))
            {
                return false;
            }
            board[r][c] = static_cast<Cell>(cell_val);
        }
    }

    out_state.from_2d_board(board);
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

inline void append_int(std::string &out, int val)
{
    char buf[16];
    auto [ptr, ec] = std::to_chars(buf, buf + sizeof(buf), val);
    out.append(buf, ptr - buf);
}

void serialize_tree(const tree_node &node, std::string &out)
{
    out.append(R"({"col":)", 7);
    append_int(out, node.col);
    out.append(R"(,"level":)", 9);
    append_int(out, node.level);
    out.append(R"(,"value":)", 9);
    append_int(out, node.value);
    out.append(node.is_max ? R"(,"is_max":true)" : R"(,"is_max":false)", node.is_max ? 14 : 15);
    out.append(node.pruned ? R"(,"pruned":true,"children":[)" : R"(,"pruned":false,"children":[)",
               node.pruned ? 27 : 28);

    for (size_t i = 0; i < node.children.size(); ++i)
    {
        if (i > 0)
            out.push_back(',');
        serialize_tree(node.children[i], out);
    }

    out.append("]}", 2);
}

void emit_best_state(const search_result &best, double elapsed_ms)
{
    std::string out;
    out.reserve(best.nodes_expanded * BYTES_PER_TREE_NODE + BASE_PAYLOAD_BYTES);

    out.append(R"({"board":[)", 10);
    for (int r = 0; r < ROWS; ++r)
    {
        if (r > 0)
            out.push_back(',');
        out.push_back('[');
        for (int c = 0; c < COLS; ++c)
        {
            if (c > 0)
                out.push_back(',');
            out += static_cast<char>('0' + static_cast<int>(best.best_move.get_cell(r, c)));
        }
        out.push_back(']');
    }

    out += std::format(R"(],"is_terminal":{},"nodes_expanded":{},"time_ms":{:.3f},"tree":)",
                       best.best_move.is_terminal(), best.nodes_expanded, elapsed_ms);

    serialize_tree(best.root, out);
    out.append("}\n", 2);

    std::cout.write(out.data(), out.size());
    std::cout.flush();
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
    FAST_IO_ON

    Algorithm choice = choose_algorithm();

    GameStyle game_style = get_game_style();

    Cell solver_color = choose_color();

    int max_levels = get_max_levels();

    launch_algorithm(choice, game_style, solver_color, max_levels);
}
