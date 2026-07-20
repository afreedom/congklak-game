// Logic permainan Congklak (Mancala Indonesia). Pure functions, immutable state.

/** @typedef {{board: number[], currentPlayer: 'A'|'B', gameOver: boolean, winner: 'A'|'B'|'draw'|null}} GameState */

export function initGame() {
  const board = new Array(16).fill(0);
  for (let i = 0; i <= 6; i++) board[i] = 7;
  for (let i = 8; i <= 14; i++) board[i] = 7;
  return { board, currentPlayer: 'A', gameOver: false, winner: null };
}

const HOLES = {
  A: { small: [0, 1, 2, 3, 4, 5, 6], store: 7, opponentStore: 15 },
  B: { small: [8, 9, 10, 11, 12, 13, 14], store: 15, opponentStore: 7 },
};

export function getValidMoves(state) {
  const { small } = HOLES[state.currentPlayer];
  return small.filter((i) => state.board[i] > 0);
}

function ownerOfSmallHole(index) {
  if (index >= 0 && index <= 6) return 'A';
  if (index >= 8 && index <= 14) return 'B';
  return null; // lumbung, bukan lubang kecil
}

function isStoreIndex(index) {
  return index === 7 || index === 15;
}

/** Lubang seberang: i (0-6) berseberangan dengan 14-i (dan simetris untuk 8-14). */
function oppositeOf(index) {
  return 14 - index;
}

/** Lubang berikutnya searah sowing, melewati (skip) lumbung milik lawan. */
function nextHole(index, player) {
  let n = (index + 1) % 16;
  if (n === HOLES[player].opponentStore) n = (n + 1) % 16;
  return n;
}

function assertValidMove(state, holeIndex) {
  if (state.gameOver) {
    throw new Error('Permainan sudah berakhir, tidak bisa jalan lagi.');
  }
  if (!Number.isInteger(holeIndex) || holeIndex < 0 || holeIndex > 15) {
    throw new Error(`Lubang ${holeIndex} tidak valid.`);
  }
  if (isStoreIndex(holeIndex)) {
    throw new Error('Tidak boleh memilih lumbung sebagai lubang awal.');
  }
  const owner = ownerOfSmallHole(holeIndex);
  if (owner !== state.currentPlayer) {
    throw new Error(`Lubang ${holeIndex} milik lawan, bukan milik ${state.currentPlayer}.`);
  }
  if (state.board[holeIndex] === 0) {
    throw new Error(`Lubang ${holeIndex} kosong, tidak bisa dipilih.`);
  }
}

/**
 * Tabur `seeds` biji satu per satu mulai dari lubang setelah `startIndex`.
 * Mengubah `board` secara langsung (board sudah berupa salinan lokal di applyMove).
 * Mencatat satu event `sow` per biji ke `steps`, supaya pemanggil (mis. UI) bisa
 * mengganimasikan penambahan biji satu per satu.
 * Mengembalikan lubang tempat biji terakhir jatuh, dan apakah lubang itu kosong SEBELUM biji terakhir jatuh.
 */
function sowFrom(board, player, startIndex, seeds, steps) {
  let idx = startIndex;
  let lastWasEmptyBefore = false;
  for (let s = 0; s < seeds; s++) {
    idx = nextHole(idx, player);
    const before = board[idx];
    board[idx] += 1;
    steps.push({ type: 'sow', hole: idx, valueAfter: board[idx] });
    if (s === seeds - 1) lastWasEmptyBefore = before === 0;
  }
  return { lastIndex: idx, lastWasEmptyBefore };
}

/**
 * Jalankan satu giliran penuh (termasuk relay & tembak). Tidak memutasi `state`.
 * Selain state baru, hasilnya menyertakan:
 * - `log`: array string ringkasan kejadian (untuk ditampilkan sebagai teks).
 * - `steps`: array event granular (pickup/sow/relay/capture/dead/extraTurn) untuk animasi UI,
 *   sesuai urutan kejadian sebenarnya, satu event per biji yang ditabur.
 */
export function applyMove(state, holeIndex) {
  assertValidMove(state, holeIndex);

  const board = [...state.board];
  const player = state.currentPlayer;
  const log = [];
  const steps = [];

  let seeds = board[holeIndex];
  board[holeIndex] = 0;
  steps.push({ type: 'pickup', hole: holeIndex, seeds });
  log.push(`${player} menabur dari lubang ${holeIndex} (${seeds} biji)`);

  let extraTurn = false;

  // Relay sowing: berlanjut selama biji terakhir jatuh di lubang tidak kosong.
  for (;;) {
    const { lastIndex, lastWasEmptyBefore } = sowFrom(board, player, holeIndex, seeds, steps);

    if (isStoreIndex(lastIndex)) {
      // nextHole selalu skip lumbung lawan, jadi ini pasti lumbung sendiri.
      steps.push({ type: 'extraTurn', player });
      log.push(`${player} mendapat giliran ekstra (biji terakhir di lumbung sendiri)`);
      extraTurn = true;
      break;
    }

    const owner = ownerOfSmallHole(lastIndex);

    if (!lastWasEmptyBefore) {
      // Lubang tidak kosong (sebelum biji terakhir jatuh) -> relay: ambil semua, lanjut menabur dari sana.
      seeds = board[lastIndex];
      board[lastIndex] = 0;
      holeIndex = lastIndex; // titik tabur berikutnya dimulai setelah lubang ini
      steps.push({ type: 'pickup', hole: lastIndex, seeds });
      log.push(`${player} lanjut menabur (relay) dari lubang ${lastIndex} (${seeds} biji)`);
      continue;
    }

    if (owner === player) {
      // Tembak: lubang kosong milik sendiri.
      const oppIndex = oppositeOf(lastIndex);
      const captured = board[lastIndex] + board[oppIndex];
      board[lastIndex] = 0;
      board[oppIndex] = 0;
      board[HOLES[player].store] += captured;
      steps.push({
        type: 'capture',
        hole: lastIndex,
        opposite: oppIndex,
        total: captured,
        store: HOLES[player].store,
      });
      log.push(
        `${player} tembak: ${captured} biji dari lubang ${lastIndex} (lubang seberang ${oppIndex}) masuk lumbung`
      );
    } else {
      // Biji mati: lubang kosong milik lawan.
      board[lastIndex] = 1;
      steps.push({ type: 'dead', hole: lastIndex });
      log.push(`Biji mati di lubang ${lastIndex} (milik ${owner})`);
    }
    break;
  }

  const nextPlayer = extraTurn ? player : (player === 'A' ? 'B' : 'A');
  const interim = { board, currentPlayer: nextPlayer, gameOver: false, winner: null };
  const finalState = checkGameOver(interim);

  return { ...finalState, log, steps };
}

export function checkGameOver(state) {
  if (getValidMoves(state).length > 0) {
    return { ...state };
  }

  const board = [...state.board];

  let sumA = 0;
  for (const i of HOLES.A.small) {
    sumA += board[i];
    board[i] = 0;
  }
  board[HOLES.A.store] += sumA;

  let sumB = 0;
  for (const i of HOLES.B.small) {
    sumB += board[i];
    board[i] = 0;
  }
  board[HOLES.B.store] += sumB;

  const storeA = board[HOLES.A.store];
  const storeB = board[HOLES.B.store];
  let winner;
  if (storeA > storeB) winner = 'A';
  else if (storeB > storeA) winner = 'B';
  else winner = 'draw';

  return { board, currentPlayer: state.currentPlayer, gameOver: true, winner };
}
