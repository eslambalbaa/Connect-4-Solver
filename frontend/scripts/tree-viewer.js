function formatValue(val) {
  if (val === null || val === undefined || Number.isNaN(Number(val))) return '--';
  const n = Math.trunc(Number(val));
  return n > 0 ? `+${n}` : `${n}`;
}

function assignNodeKeys(node, pathKey = 'root') {
  if (!node) return;
  node._key = pathKey;
  if (!Array.isArray(node.children)) return;
  for (let i = 0; i < node.children.length; i++) {
    const child = node.children[i];
    assignNodeKeys(child, `${pathKey}-${child.col ?? i}-${i}`);
  }
}

export class TreeViewer {
  constructor() {
    this.telemetryEl = document.getElementById('aiTelemetry');
    this.statValueEl = document.getElementById('aiStatValue');
    this.statTimeEl = document.getElementById('aiStatTime');
    this.statNodesEl = document.getElementById('aiStatNodes');
    this.btnShowTreeEl = document.getElementById('btnShowTree');

    this.panelEl = document.getElementById('treePanel');
    this.btnClosePanelEl = document.getElementById('btnCloseTreePanel');
    this.tabVisualEl = document.getElementById('btnTreeTabVisual');
    this.tabTextEl = document.getElementById('btnTreeTabText');
    this.btnExpandAllEl = document.getElementById('btnExpandTree');
    this.btnCollapseAllEl = document.getElementById('btnCollapseTree');

    this.metaSummaryEl = document.getElementById('treeMetaSummary');
    this.colStripEl = document.getElementById('treeColStrip');
    this.visualPaneEl = document.getElementById('treeVisualPane');
    this.canvasScrollEl = document.getElementById('treeCanvasScroll');
    this.canvasInnerEl = document.getElementById('treeCanvasInner');
    this.svgLayerEl = document.getElementById('treeSvgLayer');
    this.nodesLayerEl = document.getElementById('treeNodesLayer');
    this.tracePaneEl = document.getElementById('treeTracePane');
    this.tracePreEl = document.getElementById('treeTracePre');

    this.lastMoveData = null;
    this.activeTab = 'visual';
    this.selectedPathCols = [];
    this.initEvents();
  }

  initEvents() {
    this.btnShowTreeEl?.addEventListener('click', () => {
      this.togglePanel();
    });

    this.btnClosePanelEl?.addEventListener('click', () => {
      this.closePanel();
    });

    this.tabVisualEl?.addEventListener('click', () => {
      this.setTab('visual');
    });

    this.tabTextEl?.addEventListener('click', () => {
      this.setTab('text');
    });

    this.btnExpandAllEl?.addEventListener('click', () => {
      if (!this.lastMoveData?.tree) return;
      this.selectDefaultPath(this.lastMoveData.maxLevels);
      this.renderPanelContent();
    });

    this.btnCollapseAllEl?.addEventListener('click', () => {
      if (!this.lastMoveData?.tree) return;
      this.selectedPathCols = [this.lastMoveData.chosenCol];
      this.renderPanelContent();
    });

    window.addEventListener('resize', () => {
      if (this.isOpen() && this.activeTab === 'visual') {
        this.drawSvgConnectors();
      }
    });
  }

  isOpen() {
    return Boolean(this.panelEl && !this.panelEl.classList.contains('hidden'));
  }

  togglePanel() {
    if (this.isOpen()) {
      this.closePanel();
    } else {
      this.openPanel();
    }
  }

  openPanel() {
    if (!this.panelEl) return;
    this.panelEl.classList.remove('hidden');
    document.body.classList.add('tree-open');
    const span = this.btnShowTreeEl?.querySelector('span');
    if (span) span.textContent = 'HIDE TREE';
    this.renderPanelContent();
    window.requestAnimationFrame(() => {
      this.panelEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  closePanel() {
    if (!this.panelEl) return;
    this.panelEl.classList.add('hidden');
    document.body.classList.remove('tree-open');
    const span = this.btnShowTreeEl?.querySelector('span');
    if (span) span.textContent = 'SHOW TREE';
  }

  setAiModeVisible(isAiMode) {
    this.telemetryEl?.classList.toggle('hidden', !isAiMode);
    this.btnShowTreeEl?.classList.toggle('hidden', !isAiMode);
    document.body.classList.toggle('ai-mode', isAiMode);
    if (!isAiMode) {
      this.closePanel();
    }
  }

  resetTelemetry() {
    this.lastMoveData = null;
    this.selectedPathCols = [];
    if (this.statValueEl) this.statValueEl.textContent = '--';
    if (this.statTimeEl) this.statTimeEl.textContent = '--';
    if (this.statNodesEl) this.statNodesEl.textContent = '--';
    this.closePanel();
  }

  setThinkingState() {
    if (this.statValueEl && this.statValueEl.textContent === '--') {
      this.statValueEl.textContent = '...';
    }
  }

  bumpElement(el) {
    if (!el) return;
    el.classList.remove('bump');
    void el.offsetWidth;
    el.classList.add('bump');
    window.setTimeout(() => el.classList.remove('bump'), 320);
  }

  recordMoveResult({
    tree,
    chosenCol,
    cpuPlayer,
    algorithm,
    gameStyle,
    maxLevels,
    nodesExpanded,
    timeMs
  }) {
    if (!tree) return;
    assignNodeKeys(tree, 'root');

    const rootValue = tree.value ?? 0;
    const totalNodes = Number(nodesExpanded ?? 0);
    const elapsedMs = Number(timeMs ?? 0);

    this.lastMoveData = {
      tree,
      chosenCol,
      cpuPlayer,
      algorithm,
      gameStyle,
      maxLevels,
      nodesExpanded: totalNodes,
      timeMs: elapsedMs,
      rootValue
    };

    if (this.statValueEl) {
      this.statValueEl.textContent = formatValue(rootValue);
      this.bumpElement(this.statValueEl);
    }
    if (this.statTimeEl) {
      this.statTimeEl.textContent = elapsedMs < 10 ? `${elapsedMs.toFixed(2)} ms` : `${elapsedMs.toFixed(1)} ms`;
      this.bumpElement(this.statTimeEl);
    }
    if (this.statNodesEl) {
      this.statNodesEl.textContent = totalNodes.toLocaleString();
      this.bumpElement(this.statNodesEl);
    }

    this.selectDefaultPath(maxLevels);
    this.logTreeToConsole();

    if (this.isOpen()) {
      this.renderPanelContent();
    }
  }

  selectDefaultPath(maxDepth) {
    if (!this.lastMoveData?.tree) return;
    const { tree, chosenCol } = this.lastMoveData;
    this.selectedPathCols = [];

    let curr = tree;
    let depth = 0;
    while (curr && Array.isArray(curr.children) && curr.children.length > 0 && depth < maxDepth) {
      let nextChild = null;
      if (depth === 0 && chosenCol >= 0) {
        nextChild = curr.children.find((ch) => Number(ch.col) === chosenCol);
      }
      if (!nextChild) {
        nextChild = curr.children.find((ch) => !ch.pruned && ch.value === curr.value)
          || curr.children.find((ch) => !ch.pruned)
          || curr.children[0];
      }
      if (!nextChild) break;
      this.selectedPathCols.push(Number(nextChild.col));
      curr = nextChild;
      depth++;
    }
  }

  buildTextTree(maxDepth = 3) {
    if (!this.lastMoveData?.tree) {
      return 'Make a move against the computer to generate the Minimax tree.';
    }
    const { tree, chosenCol, algorithm, maxLevels, nodesExpanded, timeMs, rootValue } = this.lastMoveData;
    const algoName = algorithm === 1 ? 'MINIMAX + ALPHA-BETA' : 'MINIMAX';

    const lines = [];
    lines.push(`${algoName} | K = ${maxLevels} | CHOSEN COL = ${chosenCol + 1} | VALUE = ${formatValue(rootValue)} | NODES = ${nodesExpanded} | TIME = ${timeMs.toFixed(3)} ms`);
    lines.push('-------------------------------------------------------------------------');

    const walk = (node, prefix, isLast, isRoot) => {
      const role = node.is_max ? 'MAX' : 'MIN';
      const lvl = Number(node.level ?? 0);
      if (isRoot) {
        lines.push(`[L${lvl} ${role} ROOT] value = ${formatValue(node.value)}`);
      } else {
        const branch = isLast ? '`-- ' : '|-- ';
        const colText = `Col ${Number(node.col) + 1}`;
        const prunedText = node.pruned ? ' [PRUNED]' : '';
        const chosenText = lvl === 1 && Number(node.col) === chosenCol ? ' [CHOSEN]' : '';
        lines.push(`${prefix}${branch}[L${lvl} ${role}] ${colText} | value = ${formatValue(node.value)}${prunedText}${chosenText}`);
      }

      const children = Array.isArray(node.children) ? node.children : [];
      if (children.length === 0) return;

      const nextPrefix = prefix + (isRoot ? '' : isLast ? '    ' : '|   ');
      if (lvl >= maxDepth) {
        lines.push(`${nextPrefix}\`-- (${children.length} child nodes up to L${maxLevels})`);
        return;
      }

      for (let i = 0; i < children.length; i++) {
        walk(children[i], nextPrefix, i === children.length - 1, false);
      }
    };

    walk(tree, '', true, true);
    return lines.join('\n');
  }

  logTreeToConsole() {
    if (!this.lastMoveData?.tree) return;
    console.log(this.buildTextTree(3));
  }

  setTab(tab) {
    this.activeTab = tab;
    this.tabVisualEl?.classList.toggle('active', tab === 'visual');
    this.tabTextEl?.classList.toggle('active', tab === 'text');
    this.visualPaneEl?.classList.toggle('hidden', tab !== 'visual');
    this.tracePaneEl?.classList.toggle('hidden', tab !== 'text');
    this.renderPanelContent();
  }

  renderPanelContent() {
    if (!this.isOpen()) return;

    if (!this.lastMoveData?.tree) {
      if (this.metaSummaryEl) {
        this.metaSummaryEl.innerHTML = '<span class="tree-meta-chip">DROP A PIECE TO GENERATE THE AI MINIMAX TREE</span>';
      }
      if (this.colStripEl) this.colStripEl.innerHTML = '';
      if (this.nodesLayerEl) {
        this.nodesLayerEl.innerHTML = '<div class="tree-empty-state">Waiting for AI move...</div>';
      }
      if (this.svgLayerEl) this.svgLayerEl.innerHTML = '';
      if (this.tracePreEl) {
        this.tracePreEl.textContent = this.buildTextTree();
      }
      return;
    }

    const { tree, chosenCol, algorithm, maxLevels, nodesExpanded, timeMs, rootValue } = this.lastMoveData;
    const algoText = algorithm === 1 ? 'ALPHA-BETA' : 'MINIMAX';

    if (this.metaSummaryEl) {
      this.metaSummaryEl.innerHTML = `
        <span class="tree-meta-chip"><b>ALGO</b> ${algoText}</span>
        <span class="tree-meta-chip"><b>LEVEL K</b> ${maxLevels}</span>
        <span class="tree-meta-chip chip-gold"><b>CHOSEN</b> COL ${chosenCol + 1} (${formatValue(rootValue)})</span>
        <span class="tree-meta-chip"><b>NODES</b> ${nodesExpanded.toLocaleString()}</span>
        <span class="tree-meta-chip"><b>TIME</b> ${timeMs.toFixed(2)} ms</span>
      `;
    }

    this.renderLevel1Strip(tree, chosenCol);

    if (this.activeTab === 'text') {
      if (this.tracePreEl) {
        this.tracePreEl.textContent = this.buildTextTree(4);
      }
    } else {
      this.renderVisualTree(tree, chosenCol);
    }
  }

  renderLevel1Strip(tree, chosenCol) {
    if (!this.colStripEl) return;
    this.colStripEl.innerHTML = '';
    const children = Array.isArray(tree.children) ? tree.children : [];
    const activeCol = this.selectedPathCols[0] ?? chosenCol;

    for (const child of children) {
      const col = Number(child.col);
      const isChosen = col === chosenCol;
      const isSelected = col === activeCol;
      const card = document.createElement('button');
      card.type = 'button';
      card.className = `tree-col-card${isChosen ? ' status-best' : ''}${child.pruned ? ' status-pruned' : ''}${isSelected ? ' selected' : ''}`;

      const badge = isChosen ? '<span class="col-card-best">CHOSEN</span>' : '';
      const valText = child.pruned ? 'PRUNED' : formatValue(child.value);

      card.innerHTML = `
        <div class="col-card-top">
          <span class="col-card-title">COL ${col + 1}</span>
          ${badge}
        </div>
        <span class="col-card-val">${valText}</span>
      `;

      card.addEventListener('click', () => {
        this.selectBranchAtLevel(0, col);
      });

      this.colStripEl.appendChild(card);
    }
  }

  selectBranchAtLevel(levelIdx, col) {
    if (!this.lastMoveData?.tree) return;
    const { tree } = this.lastMoveData;
    const nextPath = this.selectedPathCols.slice(0, levelIdx);
    nextPath.push(col);

    let curr = tree;
    for (let i = 0; i < nextPath.length; i++) {
      const targetCol = nextPath[i];
      const found = curr.children?.find((ch) => Number(ch.col) === targetCol);
      if (!found) break;
      curr = found;
    }

    while (curr && !curr.pruned && Array.isArray(curr.children) && curr.children.length > 0) {
      const nextChild = curr.children.find((ch) => !ch.pruned && ch.value === curr.value)
        || curr.children.find((ch) => !ch.pruned)
        || curr.children[0];
      if (!nextChild) break;
      nextPath.push(Number(nextChild.col));
      curr = nextChild;
    }

    this.selectedPathCols = nextPath;
    this.renderPanelContent();
  }

  renderVisualTree(tree, chosenCol) {
    if (!this.nodesLayerEl) return;
    this.nodesLayerEl.innerHTML = '';

    const levels = [];
    levels.push({
      level: Number(tree.level ?? 0),
      isMax: Boolean(tree.is_max),
      parentKey: null,
      nodes: [
        {
          node: tree,
          isPathActive: true,
          isBestChoice: true
        }
      ]
    });

    let parentNode = tree;
    for (let d = 0; parentNode && Array.isArray(parentNode.children) && parentNode.children.length > 0; d++) {
      const children = parentNode.children;
      const activeCol = this.selectedPathCols[d];

      const rowNodes = children.map((ch) => {
        const c = Number(ch.col);
        return {
          node: ch,
          isPathActive: c === activeCol,
          isBestChoice: d === 0 && c === chosenCol
        };
      });

      levels.push({
        level: Number(children[0]?.level ?? d + 1),
        isMax: Boolean(children[0]?.is_max),
        parentKey: parentNode._key,
        depthIndex: d,
        nodes: rowNodes
      });

      const nextParent = children.find((ch) => Number(ch.col) === activeCol);
      if (!nextParent || nextParent.pruned) break;
      parentNode = nextParent;
    }

    for (const lvlObj of levels) {
      const rowEl = document.createElement('div');
      rowEl.className = 'tree-level-row';

      const labelEl = document.createElement('div');
      labelEl.className = `tree-level-badge ${lvlObj.isMax ? 'badge-max' : 'badge-min'}`;
      labelEl.innerHTML = `
        <span class="lvl-num">L${lvlObj.level}</span>
        <span class="lvl-role">${lvlObj.level === 0 ? 'ROOT' : lvlObj.isMax ? 'MAX' : 'MIN'}</span>
      `;
      rowEl.appendChild(labelEl);

      const cardsWrap = document.createElement('div');
      cardsWrap.className = 'tree-level-cards';

      for (const item of lvlObj.nodes) {
        const { node, isPathActive, isBestChoice } = item;
        const btn = document.createElement('button');
        btn.type = 'button';

        const roleClass = node.pruned ? 'node-pruned' : node.is_max ? 'node-max' : 'node-min';
        const activeClass = isPathActive ? ' path-active' : '';
        const bestClass = isBestChoice ? ' best-choice' : '';
        btn.className = `tree-node-card ${roleClass}${activeClass}${bestClass}`;
        btn.dataset.nodeKey = node._key;
        if (lvlObj.parentKey) {
          btn.dataset.parentKey = lvlObj.parentKey;
        }
        if (isPathActive) {
          btn.dataset.pathEdge = '1';
        }

        const isRoot = Number(node.col) < 0;
        const roleLabel = node.pruned ? 'PRUNED' : node.is_max ? 'MAX' : 'MIN';
        const moveLabel = isRoot ? 'ROOT' : `COL ${Number(node.col) + 1}`;
        const valLabel = node.pruned ? 'CUTOFF' : formatValue(node.value);
        const childCount = Array.isArray(node.children) ? node.children.length : 0;
        const subText = childCount > 0 ? `${childCount} CHILDREN` : 'LEAF';

        btn.innerHTML = `
          <div class="node-card-top">
            <span class="node-role-tag">${roleLabel}</span>
            <span class="node-move-tag">${moveLabel}</span>
          </div>
          <div class="node-val-main">${valLabel}</div>
          <div class="node-sub-meta">${subText}</div>
        `;

        if (!isRoot && typeof lvlObj.depthIndex === 'number') {
          btn.addEventListener('click', () => {
            this.selectBranchAtLevel(lvlObj.depthIndex, Number(node.col));
          });
        }

        cardsWrap.appendChild(btn);
      }

      rowEl.appendChild(cardsWrap);
      this.nodesLayerEl.appendChild(rowEl);
    }

    window.requestAnimationFrame(() => {
      this.drawSvgConnectors();
    });
  }

  drawSvgConnectors() {
    if (!this.svgLayerEl || !this.canvasInnerEl || !this.nodesLayerEl) return;

    const innerRect = this.canvasInnerEl.getBoundingClientRect();
    const width = Math.max(this.canvasInnerEl.scrollWidth, innerRect.width);
    const height = Math.max(this.canvasInnerEl.scrollHeight, innerRect.height);

    this.svgLayerEl.setAttribute('width', String(width));
    this.svgLayerEl.setAttribute('height', String(height));
    this.svgLayerEl.setAttribute('viewBox', `0 0 ${width} ${height}`);

    const cards = Array.from(this.nodesLayerEl.querySelectorAll('.tree-node-card'));
    const cardMap = new Map();
    for (const el of cards) {
      if (el.dataset.nodeKey) {
        cardMap.set(el.dataset.nodeKey, el);
      }
    }

    const paths = [];
    for (const childEl of cards) {
      const parentKey = childEl.dataset.parentKey;
      if (!parentKey) continue;
      const parentEl = cardMap.get(parentKey);
      if (!parentEl) continue;

      const pRect = parentEl.getBoundingClientRect();
      const cRect = childEl.getBoundingClientRect();

      const x1 = pRect.left - innerRect.left + pRect.width / 2;
      const y1 = pRect.bottom - innerRect.top;
      const x2 = cRect.left - innerRect.left + cRect.width / 2;
      const y2 = cRect.top - innerRect.top;
      const midY = (y1 + y2) / 2;

      const isPruned = childEl.classList.contains('node-pruned');
      const isActiveEdge = childEl.dataset.pathEdge === '1' && !isPruned;
      const strokeClass = isPruned ? 'tree-edge edge-pruned' : isActiveEdge ? 'tree-edge edge-active' : 'tree-edge';

      paths.push(
        `<path class="${strokeClass}" d="M ${x1.toFixed(1)} ${y1.toFixed(1)} C ${x1.toFixed(1)} ${midY.toFixed(1)}, ${x2.toFixed(1)} ${midY.toFixed(1)}, ${x2.toFixed(1)} ${y2.toFixed(1)}" />`
      );
    }

    this.svgLayerEl.innerHTML = paths.join('');
  }
}
