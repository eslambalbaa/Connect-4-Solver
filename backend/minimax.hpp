#pragma once

#include "definitions.hpp"
#include <cstdint>

class minimax
{
  public:
    static search_result get_best_move(state curr, int k)
    {
        search_result result;
        result.root.col = -1;
        result.root.level = 0;
        result.root.is_max = true;

        Cell max_player = curr.own_color;
        auto [value, next_state] = max_value(curr, 0, k, max_player, result.nodes_expanded, result.root);

        result.best_move = next_state;
        result.root.value = value;
        return result;
    }

  private:
    static std::pair<int, state> max_value(const state &curr, int level, int k, Cell max_player,
                                           uint64_t &nodes_expanded, tree_node &node)
    {
        ++nodes_expanded;
        node.level = level;
        node.is_max = true;

        if (level == k or curr.is_terminal())
        {
            node.value = curr.utility(max_player, level);
            return {node.value, curr};
        }

        int value = -INF;
        state best_move;

        for (auto &[col, child] : curr.get_neighbours())
        {
            tree_node child_node;
            child_node.col = col;
            child_node.level = level + 1;
            child_node.is_max = false;

            auto [value2, _] = min_value(child, level + 1, k, max_player, nodes_expanded, child_node);
            node.children.push_back(child_node);

            if (value2 > value)
            {
                value = value2;
                best_move = child;
            }
        }

        node.value = value;
        return {value, best_move};
    }

    static std::pair<int, state> min_value(const state &curr, int level, int k, Cell max_player,
                                           uint64_t &nodes_expanded, tree_node &node)
    {
        ++nodes_expanded;
        node.level = level;
        node.is_max = false;

        if (level == k or curr.is_terminal())
        {
            node.value = curr.utility(max_player, level);
            return {node.value, curr};
        }

        int value = INF;
        state best_move;

        for (auto &[col, child] : curr.get_neighbours())
        {
            tree_node child_node;
            child_node.col = col;
            child_node.level = level + 1;
            child_node.is_max = true;

            auto [value2, _] = max_value(child, level + 1, k, max_player, nodes_expanded, child_node);
            node.children.push_back(child_node);

            if (value2 < value)
            {
                value = value2;
                best_move = child;
            }
        }

        node.value = value;
        return {value, best_move};
    }
};
