let activeAbortController = null;
let activeRequestId = 0;
let currentMoveId = 0;
let currentTree = null;
let currentMeta = null;
let currentSelectedPath = [];
let cachedTextTrace3 = null;
let cachedTextTrace4 = null;

function formatValue(val) {
  if (val === null || val === undefined || Number.isNaN(Number(val))) return '--';
  const n = Math.trunc(Number(val));
  return n > 0 ? `+${n}` : `${n}`;
}

function formatBound(val) {
  if (val === null || val === undefined || Number.isNaN(Number(val))) return '--';
  const n = Math.trunc(Number(val));
  if (n <= -2000000000) return '-∞';
  if (n >= 2000000000) return '+∞';
  return n > 0 ? `+${n}` : `${n}`;
}

function findMoveColFromBoards(prevBoard, nextBoard, player) {
  if (!Array.isArray(prevBoard) || !Array.isArray(nextBoard)) return -1;
  for (let r = 0; r < prevBoard.length; r++) {
    const prevRow = prevBoard[r];
    const nextRow = nextBoard[r];
    if (!prevRow || !nextRow) continue;
    for (let c = 0; c < prevRow.length; c++) {
      if (prevRow[c] === 0 && nextRow[c] === player) {
        return c;
      }
    }
  }
  return -1;
}

function computeDefaultPath(tree, chosenCol, maxDepth) {
  const path = [];
  if (!tree) return path;
  let curr = tree;
  let depth = 0;
  while (curr && Array.isArray(curr.children) && curr.children.length > 0 && depth < maxDepth) {
    let nextChild = null;
    if (depth === 0 && chosenCol >= 0) {
      nextChild = curr.children.find((ch) => Number(ch.col) === chosenCol);
    }
    if (!nextChild) {
      nextChild =
        curr.children.find((ch) => !ch.pruned && ch.value === curr.value) ||
        curr.children.find((ch) => !ch.pruned) ||
        curr.children[0];
    }
    if (!nextChild) break;
    path.push(Number(nextChild.col));
    curr = nextChild;
    depth++;
  }
  return path;
}

function computeBranchPath(tree, prevPath, levelIdx, col) {
  if (!tree) return [];
  const nextPath = prevPath.slice(0, levelIdx);
  nextPath.push(col);

  let curr = tree;
  for (let i = 0; i < nextPath.length; i++) {
    const targetCol = nextPath[i];
    const found = curr.children?.find((ch) => Number(ch.col) === targetCol);
    if (!found) break;
    curr = found;
  }

  while (curr && !curr.pruned && Array.isArray(curr.children) && curr.children.length > 0) {
    const nextChild =
      curr.children.find((ch) => !ch.pruned && ch.value === curr.value) ||
      curr.children.find((ch) => !ch.pruned) ||
      curr.children[0];
    if (!nextChild) break;
    nextPath.push(Number(nextChild.col));
    curr = nextChild;
  }

  return nextPath;
}

function extractLevel1Children(tree) {
  if (!tree || !Array.isArray(tree.children)) return [];
  return tree.children.map((ch) => ({
    col: Number(ch.col),
    value: ch.value,
    pruned: Boolean(ch.pruned)
  }));
}

function extractVisualLevels(tree, chosenCol, pathCols) {
  if (!tree) return [];
  const levels = [];

  levels.push({
    level: Number(tree.level ?? 0),
    isMax: Boolean(tree.is_max),
    parentKey: null,
    depthIndex: null,
    nodes: [
      {
        key: 'root',
        col: Number(tree.col ?? -1),
        level: Number(tree.level ?? 0),
        value: tree.value,
        alpha: tree.alpha,
        beta: tree.beta,
        order: Number(tree.order ?? 0),
        isMax: Boolean(tree.is_max),
        pruned: Boolean(tree.pruned),
        isLeaf: Boolean(tree.is_leaf),
        truncated: Boolean(tree.truncated),
        childCount: Array.isArray(tree.children) ? tree.children.length : 0,
        isPathActive: true,
        isBestChoice: true
      }
    ]
  });

  let parentNode = tree;
  let parentKey = 'root';

  for (let d = 0; parentNode && Array.isArray(parentNode.children) && parentNode.children.length > 0; d++) {
    const children = parentNode.children;
    const activeCol = pathCols[d];
    let nextParent = null;
    let nextParentKey = null;

    const nodes = children.map((ch, idx) => {
      const c = Number(ch.col);
      const nodeKey = `${parentKey}-${c}-${idx}`;
      const isPathActive = c === activeCol;
      if (isPathActive) {
        nextParent = ch;
        nextParentKey = nodeKey;
      }
      return {
        key: nodeKey,
        col: c,
        level: Number(ch.level ?? d + 1),
        value: ch.value,
        alpha: ch.alpha,
        beta: ch.beta,
        order: Number(ch.order ?? 0),
        isMax: Boolean(ch.is_max),
        pruned: Boolean(ch.pruned),
        isLeaf: Boolean(ch.is_leaf),
        truncated: Boolean(ch.truncated),
        childCount: Array.isArray(ch.children) ? ch.children.length : 0,
        isPathActive,
        isBestChoice: d === 0 && c === chosenCol
      };
    });

    levels.push({
      level: Number(children[0]?.level ?? d + 1),
      isMax: Boolean(children[0]?.is_max),
      parentKey,
      depthIndex: d,
      nodes
    });

    if (!nextParent || nextParent.pruned) break;
    parentNode = nextParent;
    parentKey = nextParentKey;
  }

  return levels;
}

function buildTextTree(tree, meta, maxDepth) {
  if (!tree || !meta) {
    return 'Make a move against the computer to generate the Minimax tree.';
  }
  const { chosenCol, algorithm, gameStyle, maxLevels, nodesExpanded, timeMs, rootValue } = meta;
  const isAlphaBeta = algorithm === 1;
  const algoName = isAlphaBeta ? 'MINIMAX + ALPHA-BETA' : 'MINIMAX';
  const styleName = gameStyle === 0 ? 'FULL BOARD' : 'FIRST FOUR';

  const lines = [];
  lines.push(
    `${algoName} | MODE = ${styleName} | K = ${maxLevels} | CHOSEN COL = ${chosenCol + 1} | VALUE = ${formatValue(rootValue)} | NODES = ${nodesExpanded} | TIME = ${timeMs.toFixed(3)} ms`
  );

  if (Array.isArray(tree.children) && tree.children.length > 0) {
    const colSummary = [...tree.children]
      .sort((a, b) => Number(a.col) - Number(b.col))
      .map((ch) => {
        const c = Number(ch.col) + 1;
        if (ch.pruned) return `Col ${c}: PRUNED`;
        const mark = Number(ch.col) === chosenCol ? '*' : '';
        return `Col ${c}${mark}: ${formatValue(ch.value)}`;
      })
      .join(' | ');
    lines.push(`LEVEL 1 BOARD VALUES: ${colSummary}`);
  }
  lines.push('----------------------------------------------------------------------------------------');

  const walk = (node, prefix, isLast, isRoot) => {
    const role = node.is_max ? 'MAX' : 'MIN';
    const lvl = Number(node.level ?? 0);
    const order = Number(node.order ?? 0);
    const orderPrefix = order > 0 ? `[#${order}] ` : '';

    if (isRoot) {
      const abText = isAlphaBeta ? ` | α=${formatBound(node.alpha)}, β=${formatBound(node.beta)}` : '';
      lines.push(`[L${lvl} ${role} ROOT] value = ${formatValue(node.value)}${abText}`);
    } else {
      const branch = isLast ? '`-- ' : '|-- ';
      const colText = `Col ${Number(node.col) + 1}`;
      if (node.pruned) {
        const cutoffText = isAlphaBeta
          ? ` [PRUNED: α=${formatBound(node.alpha)} ≥ β=${formatBound(node.beta)}]`
          : ' [PRUNED]';
        lines.push(`${prefix}${branch}${orderPrefix}[L${lvl} ${role}] ${colText} |${cutoffText}`);
        return;
      }

      const abText = isAlphaBeta ? ` | α=${formatBound(node.alpha)}, β=${formatBound(node.beta)}` : '';
      const leafText = node.is_leaf ? ' [HEURISTIC]' : '';
      const chosenText = lvl === 1 && Number(node.col) === chosenCol ? ' [CHOSEN]' : '';
      lines.push(
        `${prefix}${branch}${orderPrefix}[L${lvl} ${role}] ${colText} | value = ${formatValue(node.value)}${abText}${leafText}${chosenText}`
      );
    }

    const rawChildren = Array.isArray(node.children) ? node.children : [];
    const children = isAlphaBeta
      ? [...rawChildren].sort((a, b) => (Number(a.order) || 999) - (Number(b.order) || 999))
      : rawChildren;

    const nextPrefix = prefix + (isRoot ? '' : isLast ? '    ' : '|   ');

    if (children.length === 0) {
      if (node.truncated) {
        lines.push(`${nextPrefix}\`-- (truncated at L${lvl}; search evaluated down to L${maxLevels})`);
      }
      return;
    }

    if (lvl >= maxDepth) {
      lines.push(`${nextPrefix}\`-- (${children.length} branches evaluated down to L${maxLevels})`);
      return;
    }

    for (let i = 0; i < children.length; i++) {
      walk(children[i], nextPrefix, i === children.length - 1, false);
    }
  };

  walk(tree, '', true, true);
  return lines.join('\n');
}

function finalizeTreeData(requestId, fullData, payload) {
  if (requestId !== activeRequestId) return;

  const tree = fullData.tree;
  const chosenCol = findMoveColFromBoards(payload.board, fullData.board, payload.color);
  const rootValue = tree?.value ?? 0;
  const meta = {
    chosenCol,
    cpuPlayer: payload.color,
    algorithm: payload.algorithm,
    gameStyle: payload.game_style,
    maxLevels: payload.max_levels,
    nodesExpanded: Number(fullData.nodes_expanded ?? 0),
    timeMs: Number(fullData.time_ms ?? 0),
    rootValue
  };

  currentMoveId++;
  const moveId = currentMoveId;
  currentTree = tree;
  currentMeta = meta;
  currentSelectedPath = computeDefaultPath(tree, chosenCol, payload.max_levels);
  cachedTextTrace3 = null;
  cachedTextTrace4 = null;

  const level1Children = extractLevel1Children(tree);
  const visualLevels = extractVisualLevels(tree, chosenCol, currentSelectedPath);

  self.postMessage({
    type: 'treeReady',
    requestId,
    moveId,
    meta,
    level1Children,
    selectedPathCols: currentSelectedPath,
    visualLevels
  });
}

async function handleSolve(requestId, payload) {
  if (activeAbortController) {
    activeAbortController.abort();
  }
  activeAbortController = new AbortController();
  activeRequestId = requestId;
  const signal = activeAbortController.signal;

  try {
    const response = await fetch('/api/move', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal
    });

    if (requestId !== activeRequestId) return;

    if (!response.ok) {
      let errMsg = `HTTP ${response.status}`;
      try {
        const errData = await response.json();
        if (errData?.error) errMsg = errData.error;
      } catch (_) {}
      self.postMessage({ type: 'error', requestId, phase: 'move', message: errMsg });
      return;
    }

    if (!response.body) {
      const data = await response.json();
      if (requestId !== activeRequestId) return;
      if (data.error) {
        self.postMessage({ type: 'error', requestId, phase: 'move', message: data.error });
        return;
      }
      self.postMessage({
        type: 'moveReady',
        requestId,
        board: data.board,
        isTerminal: Boolean(data.is_terminal),
        nodesExpanded: Number(data.nodes_expanded ?? 0),
        timeMs: Number(data.time_ms ?? 0),
        rootValue: data.tree?.value ?? 0
      });
      finalizeTreeData(requestId, data, payload);
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    const parts = [];
    let headerBuf = '';
    let moveSent = false;

    while (true) {
      const { value, done } = await reader.read();
      if (requestId !== activeRequestId) {
        try {
          await reader.cancel();
        } catch (_) {}
        return;
      }

      if (value) {
        const chunkText = decoder.decode(value, { stream: !done });
        parts.push(chunkText);

        if (!moveSent) {
          headerBuf += chunkText;
          if (!done) {
            const markerIdx = headerBuf.indexOf('"children":[');
            if (markerIdx !== -1) {
              try {
                const prefix = JSON.parse(headerBuf.slice(0, markerIdx) + '"children":[]}}');
                if (!prefix.error && prefix.board) {
                  moveSent = true;
                  headerBuf = '';
                  self.postMessage({
                    type: 'moveReady',
                    requestId,
                    board: prefix.board,
                    isTerminal: Boolean(prefix.is_terminal),
                    nodesExpanded: Number(prefix.nodes_expanded ?? 0),
                    timeMs: Number(prefix.time_ms ?? 0),
                    rootValue: prefix.tree?.value ?? 0
                  });
                }
              } catch (_) {}
            } else if (headerBuf.length > 8192) {
              headerBuf = headerBuf.slice(-4096);
            }
          }
        }
      } else if (done) {
        const tail = decoder.decode();
        if (tail) parts.push(tail);
      }

      if (done) break;
    }

    if (requestId !== activeRequestId) return;

    const fullText = parts.length === 1 ? parts[0] : parts.join('');
    parts.length = 0;

    const fullData = JSON.parse(fullText);
    if (requestId !== activeRequestId) return;

    if (fullData.error) {
      self.postMessage({ type: 'error', requestId, phase: moveSent ? 'tree' : 'move', message: fullData.error });
      return;
    }

    if (!moveSent) {
      self.postMessage({
        type: 'moveReady',
        requestId,
        board: fullData.board,
        isTerminal: Boolean(fullData.is_terminal),
        nodesExpanded: Number(fullData.nodes_expanded ?? 0),
        timeMs: Number(fullData.time_ms ?? 0),
        rootValue: fullData.tree?.value ?? 0
      });
    }

    finalizeTreeData(requestId, fullData, payload);
  } catch (err) {
    if (err.name === 'AbortError' || requestId !== activeRequestId) return;
    self.postMessage({ type: 'error', requestId, phase: 'move', message: err.message || 'Solver request failed' });
  } finally {
    if (requestId === activeRequestId) {
      activeAbortController = null;
    }
  }
}

self.addEventListener('message', (event) => {
  const msg = event.data;
  if (!msg || !msg.type) return;

  if (msg.type === 'solve') {
    handleSolve(msg.requestId, msg.payload);
  } else if (msg.type === 'abort') {
    if (!msg.requestId || msg.requestId === activeRequestId) {
      activeRequestId++;
      if (activeAbortController) {
        activeAbortController.abort();
        activeAbortController = null;
      }
    }
  } else if (msg.type === 'clear') {
    activeRequestId++;
    if (activeAbortController) {
      activeAbortController.abort();
      activeAbortController = null;
    }
    currentTree = null;
    currentMeta = null;
    currentSelectedPath = [];
    cachedTextTrace3 = null;
    cachedTextTrace4 = null;
  } else if (msg.type === 'selectPath') {
    if (!currentTree || !currentMeta || msg.moveId !== currentMoveId) return;
    currentSelectedPath = computeBranchPath(currentTree, currentSelectedPath, msg.levelIdx, msg.col);
    const visualLevels = extractVisualLevels(currentTree, currentMeta.chosenCol, currentSelectedPath);
    self.postMessage({
      type: 'visualData',
      moveId: currentMoveId,
      selectedPathCols: currentSelectedPath,
      visualLevels
    });
  } else if (msg.type === 'expandBest') {
    if (!currentTree || !currentMeta || msg.moveId !== currentMoveId) return;
    currentSelectedPath = computeDefaultPath(currentTree, currentMeta.chosenCol, currentMeta.maxLevels);
    const visualLevels = extractVisualLevels(currentTree, currentMeta.chosenCol, currentSelectedPath);
    self.postMessage({
      type: 'visualData',
      moveId: currentMoveId,
      selectedPathCols: currentSelectedPath,
      visualLevels
    });
  } else if (msg.type === 'collapseTop') {
    if (!currentTree || !currentMeta || msg.moveId !== currentMoveId) return;
    currentSelectedPath = [currentMeta.chosenCol];
    const visualLevels = extractVisualLevels(currentTree, currentMeta.chosenCol, currentSelectedPath);
    self.postMessage({
      type: 'visualData',
      moveId: currentMoveId,
      selectedPathCols: currentSelectedPath,
      visualLevels
    });
  } else if (msg.type === 'getTextTrace') {
    if (!currentTree || !currentMeta || msg.moveId !== currentMoveId) return;
    if (!cachedTextTrace4) {
      const traceDepth = currentMeta.maxLevels <= 5 ? currentMeta.maxLevels : (msg.maxDepth || 4);
      cachedTextTrace4 = buildTextTree(currentTree, currentMeta, traceDepth);
    }
    self.postMessage({
      type: 'textTrace',
      moveId: currentMoveId,
      text: cachedTextTrace4
    });
  }
});
