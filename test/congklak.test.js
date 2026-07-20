import test from 'node:test';
import assert from 'node:assert/strict';
import { initGame, getValidMoves, applyMove, checkGameOver } from '../src/congklak.js';

function makeState(overrides = {}) {
  return {
    board: new Array(16).fill(0),
    currentPlayer: 'A',
    gameOver: false,
    winner: null,
    ...overrides,
  };
}

test('initGame: papan awal punya 7 biji di tiap lubang kecil, 0 di lumbung, total 98 biji', () => {
  const state = initGame();
  assert.equal(state.board.length, 16);
  for (let i = 0; i <= 6; i++) assert.equal(state.board[i], 7, `lubang A ke-${i}`);
  for (let i = 8; i <= 14; i++) assert.equal(state.board[i], 7, `lubang B ke-${i}`);
  assert.equal(state.board[7], 0, 'lumbung A kosong');
  assert.equal(state.board[15], 0, 'lumbung B kosong');
  assert.equal(state.board.reduce((a, b) => a + b, 0), 98);
  assert.equal(state.currentPlayer, 'A');
  assert.equal(state.gameOver, false);
  assert.equal(state.winner, null);
});

test('getValidMoves: pada state awal, pemain A boleh pilih lubang 0-6, bukan lubang B atau lumbung', () => {
  const state = initGame();
  assert.deepEqual(getValidMoves(state), [0, 1, 2, 3, 4, 5, 6]);
});

test('getValidMoves: lubang kecil yang sudah kosong tidak termasuk valid moves', () => {
  const state = initGame();
  state.board[2] = 0;
  assert.deepEqual(getValidMoves(state), [0, 1, 3, 4, 5, 6]);
});

test('getValidMoves: untuk pemain B, hanya lubang 8-14 yang tidak kosong', () => {
  const state = { ...initGame(), currentPlayer: 'B' };
  assert.deepEqual(getValidMoves(state), [8, 9, 10, 11, 12, 13, 14]);
});

// ---- applyMove: validasi move ilegal ----

test('applyMove: menolak lubang yang kosong', () => {
  const state = makeState({ board: [0, 7, 7, 7, 7, 7, 7, 0, 7, 7, 7, 7, 7, 7, 7, 0] });
  assert.throws(() => applyMove(state, 0), /kosong/i);
});

test('applyMove: menolak lubang milik lawan', () => {
  const state = makeState({ board: [7, 7, 7, 7, 7, 7, 7, 0, 7, 7, 7, 7, 7, 7, 7, 0] });
  assert.throws(() => applyMove(state, 9), /lawan|milik/i);
});

test('applyMove: menolak indeks lumbung (7 atau 15)', () => {
  const state = makeState({ board: [7, 7, 7, 7, 7, 7, 7, 3, 7, 7, 7, 7, 7, 7, 7, 0] });
  assert.throws(() => applyMove(state, 7), /lumbung/i);
});

test('applyMove: menolak indeks di luar rentang papan', () => {
  const state = makeState({ board: [7, 7, 7, 7, 7, 7, 7, 0, 7, 7, 7, 7, 7, 7, 7, 0] });
  assert.throws(() => applyMove(state, 16), /valid|invalid|tidak/i);
});

test('applyMove: menolak move ketika permainan sudah berakhir', () => {
  const state = makeState({
    board: [7, 7, 7, 7, 7, 7, 7, 0, 7, 7, 7, 7, 7, 7, 7, 0],
    gameOver: true,
    winner: 'A',
  });
  assert.throws(() => applyMove(state, 0), /berakhir|selesai|over/i);
});

// ---- giliran ekstra ----
// Catatan: arah sowing menaik (current+1 mod 16), skip lumbung lawan.
// Urutan lubang untuk A: 0,1,2,3,4,5,6,7(lumbung A),8,...,14,(skip 15),0,...

test('applyMove: biji terakhir jatuh di lumbung sendiri -> giliran ekstra', () => {
  const board = new Array(16).fill(0);
  board[0] = 7; // A menabur 7 biji: 1,2,3,4,5,6,7(lumbung A) - pas berhenti di lumbung sendiri
  const state = makeState({ board });

  const result = applyMove(state, 0);

  assert.deepEqual(result.board, [0, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0]);
  assert.equal(result.currentPlayer, 'A', 'giliran tidak berpindah');
  assert.equal(result.gameOver, false);
  assert.ok(result.log.some((l) => /ekstra/i.test(l)), 'log menyebut giliran ekstra');
});

// ---- relay sowing ----

test('applyMove: biji terakhir jatuh di lubang tidak kosong -> lanjut menabur (relay)', () => {
  const board = new Array(16).fill(0);
  board[0] = 3; // -> ke lubang 1,2,3
  board[3] = 5; // lubang 3 sudah berisi -> begitu biji terakhir jatuh di sini, relay
  const state = makeState({ board });

  const result = applyMove(state, 0);

  // relay: ambil 6 biji dari lubang 3, lanjut ke 4,5,6,7(lumbung A),8,9
  // biji terakhir jatuh di lubang 9 (milik B) yang kosong -> biji mati, giliran pindah ke B
  assert.deepEqual(result.board, [0, 1, 1, 0, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0]);
  assert.equal(result.currentPlayer, 'B');
  assert.equal(result.gameOver, false);
  assert.ok(result.log.some((l) => /lanjut|relay/i.test(l)), 'log menyebut relay/lanjut menabur');
  assert.ok(result.log.some((l) => /mati/i.test(l)), 'log menyebut biji mati');
});

// ---- tembak (capture) ----

test('applyMove: biji terakhir jatuh di lubang kosong sendiri -> tembak lubang seberang', () => {
  const board = new Array(16).fill(0);
  board[1] = 2; // A menabur dari lubang 1: -> lubang 2, lubang 3 (kosong, milik sendiri)
  board[11] = 5; // seberang lubang 3 (14-3=11) berisi 5 biji
  board[9] = 2; // biji lain milik B supaya B masih bisa jalan setelah giliran pindah
  const state = makeState({ board });

  const result = applyMove(state, 1);

  // 1(captured) + 5(seberang) = 6 masuk lumbung A
  assert.deepEqual(result.board, [0, 0, 1, 0, 0, 0, 0, 6, 0, 2, 0, 0, 0, 0, 0, 0]);
  assert.equal(result.currentPlayer, 'B');
  assert.equal(result.gameOver, false);
  assert.ok(result.log.some((l) => /tembak/i.test(l)), 'log menyebut tembak');
});

test('applyMove: tembak dengan lubang seberang kosong -> hanya biji terakhir masuk lumbung', () => {
  const board = new Array(16).fill(0);
  board[1] = 2;
  board[11] = 0; // seberang kosong
  board[9] = 3; // supaya B tidak buntu
  const state = makeState({ board });

  const result = applyMove(state, 1);

  assert.deepEqual(result.board, [0, 0, 1, 0, 0, 0, 0, 1, 0, 3, 0, 0, 0, 0, 0, 0]);
  assert.equal(result.currentPlayer, 'B');
});

// ---- biji mati (lubang kosong milik lawan) ----

test('applyMove: biji terakhir jatuh di lubang kosong milik lawan -> biji mati, giliran pindah', () => {
  const board = new Array(16).fill(0);
  board[4] = 4; // -> 5,6,7(lumbung A),8(milik B, kosong)
  const state = makeState({ board });

  const result = applyMove(state, 4);

  assert.deepEqual(result.board, [0, 0, 0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0]);
  assert.equal(result.currentPlayer, 'B');
  assert.ok(result.log.some((l) => /mati/i.test(l)));
});

// ---- skip lumbung lawan ----

test('applyMove: menabur melewati lumbung lawan tanpa mengisinya', () => {
  const board = new Array(16).fill(0);
  board[6] = 9; // cukup panjang untuk melewati seluruh lubang B dan lumbung B
  const state = makeState({ board });

  const result = applyMove(state, 6);

  // urutan taburan: 7,8,9,10,11,12,13,14,(skip 15),0(kosong,milik sendiri->tembak, seberang=14)
  assert.equal(result.board[15], 0, 'lumbung B tidak pernah terisi');
  assert.deepEqual(result.board, [0, 0, 0, 0, 0, 0, 0, 3, 1, 1, 1, 1, 1, 1, 0, 0]);
  assert.equal(result.currentPlayer, 'B');
});

// ---- akhir permainan ----

test('checkGameOver: pemain aktif tidak punya lubang berisi -> game over, sisa biji disapu ke lumbung', () => {
  const state = makeState({
    board: [0, 3, 2, 0, 1, 4, 0, 5, 0, 0, 0, 0, 0, 0, 0, 8],
    currentPlayer: 'B',
  });

  const result = checkGameOver(state);

  assert.equal(result.gameOver, true);
  assert.equal(result.board[7], 5 + (3 + 2 + 0 + 1 + 4 + 0));
  assert.equal(result.board[15], 8);
  for (let i = 0; i <= 6; i++) assert.equal(result.board[i], 0);
  assert.equal(result.winner, 'A');
});

test('checkGameOver: pemain aktif masih punya lubang berisi -> belum berakhir', () => {
  const state = makeState({
    board: [0, 3, 0, 0, 0, 0, 0, 5, 0, 0, 0, 0, 0, 0, 0, 8],
    currentPlayer: 'A',
  });

  const result = checkGameOver(state);

  assert.equal(result.gameOver, false);
  assert.equal(result.winner, null);
});

test('checkGameOver: skor lumbung sama setelah disapu -> seri', () => {
  const state = makeState({
    board: [0, 0, 3, 0, 0, 0, 0, 5, 0, 0, 0, 0, 0, 0, 0, 8],
    currentPlayer: 'B',
  });

  const result = checkGameOver(state);

  assert.equal(result.board[7], 8);
  assert.equal(result.board[15], 8);
  assert.equal(result.winner, 'draw');
});

test('applyMove: memicu akhir permainan otomatis ketika lawan jadi buntu', () => {
  const board = new Array(16).fill(0);
  board[0] = 1; // A menabur 1 biji -> lubang 1 (kosong, milik sendiri) -> tembak
  board[2] = 3;
  board[3] = 2;
  board[5] = 1;
  board[6] = 4;
  board[7] = 5; // isi lumbung A sebelumnya
  board[15] = 10; // isi lumbung B sebelumnya
  // seluruh lubang B (8-14) kosong -> setelah giliran pindah ke B, B buntu
  const state = makeState({ board });

  const result = applyMove(state, 0);

  assert.equal(result.gameOver, true);
  assert.equal(result.winner, 'A');
  assert.equal(result.board[7], 5 + 1 /* tembak seberang kosong */ + (3 + 2 + 0 + 1 + 4) /* sapu sisa A */);
  assert.equal(result.board[15], 10);
  for (let i = 0; i <= 6; i++) assert.equal(result.board[i], 0);
  for (let i = 8; i <= 14; i++) assert.equal(result.board[i], 0);
});
