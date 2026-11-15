#pragma once

#include "definitions.hpp"

class alpha_beta
{
  public:
    static state get_best_move(state curr, int k)
    {
        Cell max_player = curr.own_color;
        auto [value, next_state] = max_value(curr, -INF, INF, 0, k, max_player);
        return next_state;
    }

  private:
    static std::pair<int, state> max_value(const state &curr, int alpha, int beta, int level, int k, Cell max_player)
    {
        if (level == k or curr.is_terminal())
        {
            return {curr.utility(max_player, level), curr};
        }

        int value = -INF;
        state best_move;

        for (auto &child : curr.get_neighbours())
        {
            auto [value2, _] = min_value(child, alpha, beta, level + 1, k, max_player);
            if (value2 > value)
            {
                value = value2;
                best_move = child;
                alpha = std::max(alpha, value);
            }

            if (value >= beta)
                return {value, best_move};
        }

        return {value, best_move};
    }

    static std::pair<int, state> min_value(const state &curr, int alpha, int beta, int level, int k, Cell max_player)
    {
        if (level == k or curr.is_terminal())
        {
            return {curr.utility(max_player, level), curr};
        }

        int value = INF;
        state best_move;

        for (auto &child : curr.get_neighbours())
        {
            auto [value2, _] = max_value(child, alpha, beta, level + 1, k, max_player);
            if (value2 < value)
            {
                value = value2;
                best_move = child;
                beta = std::min(beta, value);
            }

            if (value <= alpha)
                return {value, best_move};
        }

        return {value, best_move};
    }
};
