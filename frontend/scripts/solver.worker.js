import createSolverModule from './solver.js';

let wasm = null;
let boardPtr = 0;

const initPromise = (async () => {
  wasm = await createSolverModule();
  boardPtr = wasm._malloc(42 * 4);
})();

self.addEventListener('message', async (event) => {
  const { requestId, payload } = event.data || {};
  if (!payload) return;

  try {
    await initPromise;

    const base = boardPtr >> 2;
    const heap = wasm.HEAP32;
    const board = payload.board;
    for (let r = 0; r < 6; r++) {
      const row = board[r];
      const rowOffset = base + r * 7;
      for (let c = 0; c < 7; c++) {
        heap[rowOffset + c] = row[c] | 0;
      }
    }

    const outPtr = wasm._solve_move_json(
      payload.algorithm | 0,
      payload.game_style ?? 0,
      payload.color | 0,
      payload.max_levels | 0,
      boardPtr
    );

    const jsonText = wasm.UTF8ToString(outPtr);
    const data = JSON.parse(jsonText);
    self.postMessage({ requestId, data });
  } catch (err) {
    self.postMessage({
      requestId,
      error: err?.message || 'Wasm solver execution failed'
    });
  }
});
