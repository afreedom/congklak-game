// Simulasikan AI vs AI (giliran pertama A dan giliran pertama B), catat tiap
// langkah (lubang dipilih, sowing/relay/tembak/biji mati, giliran ekstra, dan
// papan sesudahnya) ke file log terpisah per skenario di folder logs/.
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { initGame, applyMove, chooseAiMove } from '../src/congklak.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const logsDir = join(__dirname, '..', 'logs');

function formatBoard(board) {
  const a = board.slice(0, 7).join(',');
  const b = board.slice(8, 15).join(',');
  return `A[${a}] storeA=${board[7]}  |  B[${b}] storeB=${board[15]}`;
}

function traceGame(firstPlayer) {
  const lines = [];
  let state = initGame();
  state = { ...state, currentPlayer: firstPlayer };
  lines.push(`Giliran pertama: ${firstPlayer}`);
  lines.push(`Papan awal: ${formatBoard(state.board)}`);
  lines.push('');

  let moveNo = 0;
  while (!state.gameOver && moveNo < 500) {
    const player = state.currentPlayer;
    const move = chooseAiMove(state);
    if (move === null) break;
    moveNo++;
    const result = applyMove(state, move);

    lines.push(`--- Langkah #${moveNo}: pemain ${player}, pilih lubang ${move} ---`);
    for (const l of result.log) lines.push(`    ${l}`);
    lines.push(`    Papan sesudah: ${formatBoard(result.board)}`);
    lines.push(`    Giliran berikutnya: ${result.gameOver ? '(selesai)' : result.currentPlayer}`);
    lines.push('');

    const { log, steps, ...nextState } = result;
    state = nextState;
  }

  lines.push(`SELESAI: pemenang ${state.winner} | storeA=${state.board[7]} storeB=${state.board[15]} | total langkah=${moveNo}`);
  return lines.join('\n') + '\n';
}

mkdirSync(logsDir, { recursive: true });

for (const firstPlayer of ['A', 'B']) {
  const outPath = join(logsDir, `trace-first-${firstPlayer}.log`);
  writeFileSync(outPath, traceGame(firstPlayer), 'utf8');
  console.log(`Ditulis: ${outPath}`);
}
