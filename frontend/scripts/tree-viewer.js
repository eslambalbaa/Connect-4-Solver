function formatValue(val) {
  if (val === null || val === undefined || Number.isNaN(Number(val))) return '--';
  const n = Math.trunc(Number(val));
  return n > 0 ? `+${n}` : `${n}`;
}

export class TreeViewer {
  constructor({ onWorkerAction = null } = {}) {
    this.onWorkerAction = onWorkerAction;

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

    this.pendingMeta = null;
    this.lastSnapshot = null;
    this.activeTab = 'visual';
    this.selectedPathCols = [];
    this.cachedTextTrace4 = null;
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
      if (!this.lastSnapshot) return;
      this.onWorkerAction?.({ type: 'expandBest', moveId: this.lastSnapshot.moveId });
    });

    this.btnCollapseAllEl?.addEventListener('click', () => {
      if (!this.lastSnapshot) return;
      this.onWorkerAction?.({ type: 'collapseTop', moveId: this.lastSnapshot.moveId });
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
    if (this.activeTab === 'text' && this.lastSnapshot && !this.cachedTextTrace4) {
      this.onWorkerAction?.({ type: 'getTextTrace', moveId: this.lastSnapshot.moveId, maxDepth: 4 });
    }
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
    this.pendingMeta = null;
    this.lastSnapshot = null;
    this.selectedPathCols = [];
    this.cachedTextTrace4 = null;
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

  setMoveMetrics({
    chosenCol,
    cpuPlayer,
    algorithm,
    gameStyle,
    maxLevels,
    nodesExpanded,
    timeMs,
    rootValue
  }) {
    const totalNodes = Number(nodesExpanded ?? 0);
    const elapsedMs = Number(timeMs ?? 0);

    this.pendingMeta = {
      chosenCol,
      cpuPlayer,
      algorithm,
      gameStyle,
      maxLevels,
      nodesExpanded: totalNodes,
      timeMs: elapsedMs,
      rootValue
    };
    this.lastSnapshot = null;
    this.cachedTextTrace4 = null;

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

    if (this.isOpen()) {
      this.renderPanelContent();
    }
  }

  applyTreeSnapshot(snapshot) {
    if (!snapshot || !snapshot.meta) return;
    this.pendingMeta = null;
    this.lastSnapshot = snapshot;
    this.selectedPathCols = snapshot.selectedPathCols || [];
    this.cachedTextTrace4 = null;

    if (snapshot.textTrace3) {
      console.log(snapshot.textTrace3);
    }

    if (this.isOpen()) {
      this.renderPanelContent();
      if (this.activeTab === 'text') {
        this.onWorkerAction?.({ type: 'getTextTrace', moveId: snapshot.moveId, maxDepth: 4 });
      }
    }
  }

  applyVisualData(data) {
    if (!data || !this.lastSnapshot || data.moveId !== this.lastSnapshot.moveId) return;
    this.selectedPathCols = data.selectedPathCols || [];
    this.lastSnapshot.selectedPathCols = this.selectedPathCols;
    this.lastSnapshot.visualLevels = data.visualLevels || [];
    if (this.isOpen()) {
      this.renderPanelContent();
    }
  }

  applyTextTrace(data) {
    if (!data || !this.lastSnapshot || data.moveId !== this.lastSnapshot.moveId) return;
    this.cachedTextTrace4 = data.text || '';
    if (this.isOpen() && this.activeTab === 'text' && this.tracePreEl) {
      this.tracePreEl.textContent = this.cachedTextTrace4;
    }
  }

  setTab(tab) {
    this.activeTab = tab;
    this.tabVisualEl?.classList.toggle('active', tab === 'visual');
    this.tabTextEl?.classList.toggle('active', tab === 'text');
    this.visualPaneEl?.classList.toggle('hidden', tab !== 'visual');
    this.tracePaneEl?.classList.toggle('hidden', tab !== 'text');
    this.renderPanelContent();
    if (tab === 'text' && this.lastSnapshot && !this.cachedTextTrace4) {
      this.onWorkerAction?.({ type: 'getTextTrace', moveId: this.lastSnapshot.moveId, maxDepth: 4 });
    }
  }

  renderMetaSummary(meta) {
    if (!this.metaSummaryEl || !meta) return;
    const { chosenCol, algorithm, maxLevels, nodesExpanded, timeMs, rootValue } = meta;
    const algoText = algorithm === 1 ? 'ALPHA-BETA' : 'MINIMAX';
    this.metaSummaryEl.innerHTML = `
      <span class="tree-meta-chip"><b>ALGO</b> ${algoText}</span>
      <span class="tree-meta-chip"><b>LEVEL K</b> ${maxLevels}</span>
      <span class="tree-meta-chip chip-gold"><b>CHOSEN</b> COL ${chosenCol + 1} (${formatValue(rootValue)})</span>
      <span class="tree-meta-chip"><b>NODES</b> ${nodesExpanded.toLocaleString()}</span>
      <span class="tree-meta-chip"><b>TIME</b> ${timeMs.toFixed(2)} ms</span>
    `;
  }

  renderPanelContent() {
    if (!this.isOpen()) return;

    if (!this.lastSnapshot) {
      if (this.pendingMeta) {
        this.renderMetaSummary(this.pendingMeta);
      } else if (this.metaSummaryEl) {
        this.metaSummaryEl.innerHTML = '<span class="tree-meta-chip">DROP A PIECE TO GENERATE THE AI MINIMAX TREE</span>';
      }
      if (this.colStripEl) this.colStripEl.innerHTML = '';
      if (this.nodesLayerEl) {
        this.nodesLayerEl.innerHTML = this.pendingMeta
          ? '<div class="tree-empty-state">Parsing search tree...</div>'
          : '<div class="tree-empty-state">Waiting for AI move...</div>';
      }
      if (this.svgLayerEl) this.svgLayerEl.innerHTML = '';
      if (this.tracePreEl) {
        this.tracePreEl.textContent = this.pendingMeta
          ? 'Parsing search tree...'
          : 'Make a move against the computer to generate the Minimax tree.';
      }
      return;
    }

    const { meta, level1Children, visualLevels, moveId } = this.lastSnapshot;
    this.renderMetaSummary(meta);
    this.renderLevel1Strip(level1Children, meta.chosenCol, moveId);

    if (this.activeTab === 'text') {
      if (this.tracePreEl) {
        this.tracePreEl.textContent = this.cachedTextTrace4 || this.lastSnapshot.textTrace3 || 'Loading text trace...';
      }
    } else {
      this.renderVisualTree(visualLevels, moveId);
    }
  }

  renderLevel1Strip(children, chosenCol, moveId) {
    if (!this.colStripEl) return;
    this.colStripEl.innerHTML = '';
    const activeCol = this.selectedPathCols[0] ?? chosenCol;

    for (const child of children || []) {
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
        this.onWorkerAction?.({ type: 'selectPath', moveId, levelIdx: 0, col });
      });

      this.colStripEl.appendChild(card);
    }
  }

  renderVisualTree(levels, moveId) {
    if (!this.nodesLayerEl) return;
    this.nodesLayerEl.innerHTML = '';

    for (const lvlObj of levels || []) {
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
        const btn = document.createElement('button');
        btn.type = 'button';

        const roleClass = item.pruned ? 'node-pruned' : item.isMax ? 'node-max' : 'node-min';
        const activeClass = item.isPathActive ? ' path-active' : '';
        const bestClass = item.isBestChoice ? ' best-choice' : '';
        btn.className = `tree-node-card ${roleClass}${activeClass}${bestClass}`;
        btn.dataset.nodeKey = item.key;
        if (lvlObj.parentKey) {
          btn.dataset.parentKey = lvlObj.parentKey;
        }
        if (item.isPathActive) {
          btn.dataset.pathEdge = '1';
        }

        const isRoot = item.col < 0;
        const roleLabel = item.pruned ? 'PRUNED' : item.isMax ? 'MAX' : 'MIN';
        const moveLabel = isRoot ? 'ROOT' : `COL ${item.col + 1}`;
        const valLabel = item.pruned ? 'CUTOFF' : formatValue(item.value);
        const subText = item.childCount > 0 ? `${item.childCount} CHILDREN` : 'LEAF';

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
            this.onWorkerAction?.({ type: 'selectPath', moveId, levelIdx: lvlObj.depthIndex, col: item.col });
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
