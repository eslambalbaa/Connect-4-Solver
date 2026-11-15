#pragma once

#include "definitions.hpp"

class minimax
{
  public:
    static state get_best_move(state curr, int k)
    {
        Cell max_player = curr.own_color;
        auto [value, next_state] = max_value(curr, 0, k, max_player);
        return next_state;
    }

  private:
    static std::pair<int, state> max_value(const state &curr, int level, int k, Cell max_player)
    {
        if (level == k or curr.is_terminal())
        {
            return {curr.utility(max_player, level), curr};
        }

        int value = -INF;
        state best_move;

        for (auto &child : curr.get_neighbours())
        {
            auto [value2, _] = min_value(child, level + 1, k, max_player);
            if (value2 > value)
            {
                value = value2;
                best_move = child;
            }
        }

        return {value, best_move};
    }

    static std::pair<int, state> min_value(const state &curr, int level, int k, Cell max_player)
    {
        if (level == k or curr.is_terminal())
        {
            return {curr.utility(max_player, level), curr};
        }

        int value = INF;
        state move;

        for (auto &child : curr.get_neighbours())
        {
            auto [value2, a2] = max_value(child, level + 1, k, max_player);
            if (value2 < value)
            {
                value = value2;
                move = child;
            }
        }

        return {value, move};
    }
};
