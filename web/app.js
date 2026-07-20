import { initGame, getValidMoves, applyMove } from '../src/congklak.js';
import { createScene } from './scene3d.js';

const container = document.getElementById('scene-container');
const turnIndicator = document.getElementById('turn-indicator');
const messageEl = document.getElementById('message');
const restartBtn = document.getElementById('restart');
const renameBtn = document.getElementById('rename');
const loadingEl = document.getElementById('loading');
const nameModal = document.getElementById('name-modal');
const nameForm = document.getElementById('name-form');
const nameInputA = document.getElementById('name-a');
const nameInputB = document.getElementById('name-b');

const NAME_STORAGE_KEY = 'congklak-player-names';
const DEFAULT_NAMES = { A: 'Pemain A', B: 'Pemain B' };

function loadNames() {
  try {
    const raw = localStorage.getItem(NAME_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return {
      A: (parsed.A || '').trim() || DEFAULT_NAMES.A,
      B: (parsed.B || '').trim() || DEFAULT_NAMES.B,
    };
  } catch {
    return null;
  }
}

function saveNames(n) {
  try {
    localStorage.setItem(NAME_STORAGE_KEY, JSON.stringify(n));
  } catch {
    // localStorage tidak tersedia (mis. private mode) - nama cukup dipakai untuk sesi ini saja.
  }
}

const savedNames = loadNames();
let names = savedNames || { ...DEFAULT_NAMES };
const isFirstVisit = savedNames === null;

function nameOf(player) {
  return names[player];
}

function openNameModal() {
  nameInputA.value = names.A;
  nameInputB.value = names.B;
  nameModal.classList.remove('hidden');
  nameInputA.focus();
}

function closeNameModal() {
  nameModal.classList.add('hidden');
}

nameForm.addEventListener('submit', (event) => {
  event.preventDefault();
  names = {
    A: nameInputA.value.trim() || DEFAULT_NAMES.A,
    B: nameInputB.value.trim() || DEFAULT_NAMES.B,
  };
  saveNames(names);
  closeNameModal();
  updateHud();
});

renameBtn.addEventListener('click', () => {
  if (animating) return;
  openNameModal();
});

if (isFirstVisit) {
  openNameModal();
} else {
  closeNameModal();
}

const scene = createScene(container);

let state = initGame();
let animating = false;

function storeOf(player) {
  return player === 'A' ? 7 : 15;
}

function updateHud(turnText) {
  if (turnText) {
    turnIndicator.textContent = turnText;
    return;
  }
  if (state.gameOver) {
    turnIndicator.textContent =
      state.winner === 'draw'
        ? `Permainan berakhir — Seri! (${nameOf('A')}: ${state.board[7]}, ${nameOf('B')}: ${state.board[15]})`
        : `Permainan berakhir — Pemenang: ${nameOf(state.winner)}! (${nameOf('A')}: ${state.board[7]}, ${nameOf('B')}: ${state.board[15]})`;
  } else {
    turnIndicator.textContent = `Giliran: ${nameOf(state.currentPlayer)}`;
  }
}

function syncInteractivity() {
  scene.setValidMoves(state.gameOver || animating ? [] : getValidMoves(state));
}

/**
 * Mainkan satu giliran penuh secara bertahap di papan 3D: tiap event di
 * `result.steps` (pickup, satu biji jatuh, tembak, biji mati, giliran ekstra)
 * dianimasikan satu per satu, dengan indikator giliran sebagai teks pendamping.
 */
async function animateMove(holeIndex) {
  animating = true;
  syncInteractivity();

  const result = applyMove(state, holeIndex);
  const player = state.currentPlayer;
  const playerName = nameOf(player);
  const board = [...state.board]; // salinan lokal untuk melacak sisa biji per lubang selama animasi
  let handAt = holeIndex;

  for (const step of result.steps) {
    if (step.type === 'pickup') {
      board[step.hole] = 0;
      handAt = step.hole;
      updateHud(`${playerName} mengambil ${step.seeds} biji dari lubang ${step.hole}...`);
      await scene.pickupHole(step.hole);
    } else if (step.type === 'sow') {
      updateHud(`${playerName} menabur...`);
      await scene.flySeed(handAt, step.hole);
      board[step.hole] += 1;
      handAt = step.hole;
    } else if (step.type === 'capture') {
      updateHud(`${playerName} tembak!`);
      await Promise.all([
        scene.flyAllSeeds(step.hole, step.store),
        scene.flyAllSeeds(step.opposite, step.store),
      ]);
      board[step.hole] = 0;
      board[step.opposite] = 0;
      await scene.pulseHighlight([step.store]);
    } else if (step.type === 'dead') {
      updateHud(`Biji mati di lubang ${step.hole}.`);
      await scene.pulseHighlight([step.hole], 0x888888, 350);
    } else if (step.type === 'extraTurn') {
      updateHud(`${playerName} mendapat giliran ekstra!`);
      await scene.pulseHighlight([storeOf(player)]);
    }
  }

  if (result.gameOver) {
    const holesToSweep = [0, 1, 2, 3, 4, 5, 6, 8, 9, 10, 11, 12, 13, 14].filter((h) => board[h] > 0);
    if (holesToSweep.length > 0) {
      updateHud('Menghitung skor akhir...');
      await Promise.all(holesToSweep.map((h) => scene.flyAllSeeds(h, h <= 6 ? 7 : 15)));
      await scene.pulseHighlight([7, 15]);
    }
  }

  const { log, steps, ...nextState } = result;
  state = nextState;
  scene.setBoard(state.board); // safety-net resync, memastikan visual persis sama dengan state final
  animating = false;
  syncInteractivity();
  updateHud();
}

function handlePitClick(holeIndex) {
  if (animating || state.gameOver) return;
  try {
    messageEl.textContent = '';
    animateMove(holeIndex);
  } catch (err) {
    animating = false;
    syncInteractivity();
    messageEl.textContent = err.message;
  }
}

scene.onPitClick(handlePitClick);

restartBtn.addEventListener('click', () => {
  if (animating) return;
  state = initGame();
  messageEl.textContent = '';
  scene.setBoard(state.board);
  syncInteractivity();
  updateHud();
});

scene.setBoard(state.board);
syncInteractivity();
updateHud();
loadingEl.classList.add('hidden');
