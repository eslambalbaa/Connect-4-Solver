#pragma once

#include "definitions.hpp"
#include <algorithm>
#include <utility>

class alpha_beta
{
  public:
    static search_result get_best_move(state curr, int k)
    {
        search_result result;
        result.root.col = -1;
        result.root.level = 0;
        result.root.is_max = true;

        Cell max_player = curr.own_color;
        auto [value, next_state] = max_value(curr, -INF, INF, 0, k, max_player, result.nodes_expanded, result.root);

        result.best_move = next_state;
        result.root.value = value;
        return result;
    }

  private:
    // favor the middle it takes place in more moves
    constexpr static std::array<int, COLS> COL_ORDER = {3, 2, 4, 1, 5, 0, 6};

    static std::pair<int, state> max_value(const state &curr, int alpha, int beta, int level, int k, Cell max_player,
                                           uint64_t &nodes_expanded, tree_node &node)
    {
        ++nodes_expanded;
        node.level = level;
        node.is_max = true;
        node.alpha = alpha;
        node.beta = beta;

        if (level == k or curr.is_terminal())
        {
            node.value = curr.utility(max_player, level);
            node.is_leaf = true;
            return {node.value, curr};
        }

        int value = -INF;
        state best_move;
        const bool record_children = should_record(level, k);
        node.truncated = !record_children;

        if (record_children)
            node.children.reserve(COLS);

        int eval_order = 0;
        for (int i = 0; i < COLS; ++i)
        {
            int col = COL_ORDER[i];
            if (!CAN_PLAY(curr.mask, col))
                continue;

            const state child = curr.apply_move(col);

            tree_node child_node;
            child_node.col = col;
            child_node.level = level + 1;
            child_node.order = ++eval_order;
            child_node.is_max = false;

            auto [value2, _] = min_value(child, alpha, beta, level + 1, k, max_player, nodes_expanded, child_node);

            if (record_children)
                node.children.push_back(std::move(child_node));

            if (value2 > value)
            {
                value = value2;
                best_move = child;
                alpha = std::max(alpha, value);
            }

            if (value >= beta)
            {
                if (record_children)
                {
                    for (int j = i + 1; j < COLS; ++j)
                    {
                        int col_j = COL_ORDER[j];
                        if (!CAN_PLAY(curr.mask, col_j))
                            continue;

                        tree_node pruned_node;
                        pruned_node.col = col_j;
                        pruned_node.level = level + 1;
                        pruned_node.order = ++eval_order;
                        pruned_node.alpha = alpha;
                        pruned_node.beta = beta;
                        pruned_node.is_max = false;
                        pruned_node.pruned = true;
                        node.children.push_back(std::move(pruned_node));
                    }
                    std::ranges::sort(node.children, {}, &tree_node::col);
                }

                node.value = value;
                node.alpha = alpha;
                node.beta = beta;
                return {value, best_move};
            }
        }

        if (record_children)
            std::ranges::sort(node.children, {}, &tree_node::col);

        node.value = value;
        node.alpha = alpha;
        node.beta = beta;
        return {value, best_move};
    }

    static std::pair<int, state> min_value(const state &curr, int alpha, int beta, int level, int k, Cell max_player,
                                           uint64_t &nodes_expanded, tree_node &node)
    {
        ++nodes_expanded;
        node.level = level;
        node.is_max = false;
        node.alpha = alpha;
        node.beta = beta;

        if (level == k or curr.is_terminal())
        {
            node.value = curr.utility(max_player, level);
            node.is_leaf = true;
            return {node.value, curr};
        }

        int value = INF;
        state best_move;
        const bool record_children = should_record(level, k);
        node.truncated = !record_children;

        if (record_children)
            node.children.reserve(COLS);

        int eval_order = 0;
        for (int i = 0; i < COLS; ++i)
        {
            int col = COL_ORDER[i];
            if (!CAN_PLAY(curr.mask, col))
                continue;

            const state child = curr.apply_move(col);

            tree_node child_node;
            child_node.col = col;
            child_node.level = level + 1;
            child_node.order = ++eval_order;
            child_node.is_max = true;

            auto [value2, _] = max_value(child, alpha, beta, level + 1, k, max_player, nodes_expanded, child_node);

            if (record_children)
                node.children.push_back(std::move(child_node));

            if (value2 < value)
            {
                value = value2;
                best_move = child;
                beta = std::min(beta, value);
            }

            if (value <= alpha)
            {
                if (record_children)
                {
                    for (int j = i + 1; j < COLS; ++j)
                    {
                        int col_j = COL_ORDER[j];
                        if (!CAN_PLAY(curr.mask, col_j))
                            continue;

                        tree_node pruned_node;
                        pruned_node.col = col_j;
                        pruned_node.level = level + 1;
                        pruned_node.order = ++eval_order;
                        pruned_node.alpha = alpha;
                        pruned_node.beta = beta;
                        pruned_node.is_max = true;
                        pruned_node.pruned = true;
                        node.children.push_back(std::move(pruned_node));
                    }
                    std::ranges::sort(node.children, {}, &tree_node::col);
                }

                node.value = value;
                node.alpha = alpha;
                node.beta = beta;
                return {value, best_move};
            }
        }

        if (record_children)
            std::ranges::sort(node.children, {}, &tree_node::col);

        node.value = value;
        node.alpha = alpha;
        node.beta = beta;
        return {value, best_move};
    }
};
