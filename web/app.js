import { initGame, getValidMoves, applyMove, chooseAiMove } from '../src/congklak.js';
import { createScene } from './scene3d.js';

const container = document.getElementById('scene-container');
const turnIndicator = document.getElementById('turn-indicator');
const messageEl = document.getElementById('message');
const restartBtn = document.getElementById('restart');
const renameBtn = document.getElementById('rename');
const soundToggleBtn = document.getElementById('sound-toggle');
const loadingEl = document.getElementById('loading');
const nameModal = document.getElementById('name-modal');
const nameForm = document.getElementById('name-form');
const nameInputA = document.getElementById('name-a');
const nameInputB = document.getElementById('name-b');
const modeSelect = document.getElementById('play-mode');
const playerBFields = document.getElementById('player-b-fields');
const gameModeEl = document.getElementById('game-mode');
const resultModal = document.getElementById('result-modal');
const resultCard = document.getElementById('result-card');
const resultIcon = document.getElementById('result-icon');
const resultKicker = document.getElementById('result-kicker');
const resultTitle = document.getElementById('result-title');
const resultScore = document.getElementById('result-score');
const resultMessage = document.getElementById('result-message');
const playAgainBtn = document.getElementById('play-again');
const resultSettingsBtn = document.getElementById('result-settings');
const celebration = document.getElementById('celebration');

const NAME_STORAGE_KEY = 'congklak-player-names';
const DEFAULT_NAMES = { A: 'Pemain A', B: 'Pemain B' };
const MODE_STORAGE_KEY = 'congklak-play-mode';
const SOUND_STORAGE_KEY = 'congklak-sound-enabled';

let audioContext = null;
let masterGain = null;
let soundEnabled = true;
try {
  soundEnabled = localStorage.getItem(SOUND_STORAGE_KEY) !== 'off';
} catch {
  // Gunakan suara aktif jika penyimpanan browser tidak tersedia.
}

function getAudioContext() {
  if (audioContext) return audioContext;
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return null;
  audioContext = new AudioContext();
  masterGain = audioContext.createGain();
  masterGain.gain.value = soundEnabled ? 0.55 : 0;
  masterGain.connect(audioContext.destination);
  return audioContext;
}

document.addEventListener('pointerdown', () => {
  const context = getAudioContext();
  if (context?.state === 'suspended') context.resume().catch(() => {});
}, { once: true });

function scheduleTone(context, {
  frequency,
  endFrequency = frequency,
  offset = 0,
  duration = 0.1,
  volume = 0.1,
  type = 'sine',
}) {
  const start = context.currentTime + 0.015 + offset;
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, start);
  oscillator.frequency.exponentialRampToValueAtTime(Math.max(30, endFrequency), start + duration);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(volume, start + Math.min(0.018, duration * 0.25));
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  oscillator.connect(gain).connect(masterGain);
  oscillator.start(start);
  oscillator.stop(start + duration + 0.03);
}

function playGameSound(type, variant = 0) {
  if (!soundEnabled) return;
  const context = getAudioContext();
  if (!context) return;
  if (context.state === 'suspended') context.resume().catch(() => {});

  if (type === 'pickup') {
    const taps = Math.max(2, Math.min(5, Math.ceil(variant / 3)));
    for (let i = 0; i < taps; i++) {
      scheduleTone(context, {
        frequency: 230 + i * 32,
        endFrequency: 105 + i * 12,
        offset: i * 0.035,
        duration: 0.09,
        volume: 0.09,
        type: 'triangle',
      });
    }
  } else if (type === 'sow') {
    const frequency = 620 + (variant % 5) * 48;
    scheduleTone(context, { frequency, endFrequency: frequency * 0.58, duration: 0.065, volume: 0.075 });
    scheduleTone(context, {
      frequency: frequency * 1.72,
      endFrequency: frequency,
      offset: 0.008,
      duration: 0.045,
      volume: 0.035,
    });
  } else if (type === 'capture') {
    scheduleTone(context, { frequency: 310, endFrequency: 120, duration: 0.16, volume: 0.14, type: 'triangle' });
    scheduleTone(context, { frequency: 520, endFrequency: 260, offset: 0.07, duration: 0.18, volume: 0.12, type: 'triangle' });
  } else if (type === 'dead') {
    scheduleTone(context, { frequency: 175, endFrequency: 90, duration: 0.24, volume: 0.1, type: 'triangle' });
  } else if (type === 'extra') {
    for (const [frequency, offset] of [[523.25, 0], [659.25, 0.1], [783.99, 0.2]]) {
      scheduleTone(context, { frequency, offset, duration: 0.16, volume: 0.1 });
    }
  } else if (type === 'turn') {
    scheduleTone(context, { frequency: 392, endFrequency: 330, duration: 0.11, volume: 0.055 });
  } else if (type === 'start') {
    for (const [frequency, offset] of [[392, 0], [523.25, 0.09], [659.25, 0.18]]) {
      scheduleTone(context, { frequency, offset, duration: 0.14, volume: 0.085 });
    }
  }
}

function updateSoundToggle() {
  soundToggleBtn.textContent = soundEnabled ? 'Suara: Aktif' : 'Suara: Mati';
  soundToggleBtn.setAttribute('aria-pressed', String(soundEnabled));
  soundToggleBtn.setAttribute('aria-label', soundEnabled ? 'Matikan suara permainan' : 'Aktifkan suara permainan');
}

soundToggleBtn.addEventListener('click', () => {
  soundEnabled = !soundEnabled;
  try {
    localStorage.setItem(SOUND_STORAGE_KEY, soundEnabled ? 'on' : 'off');
  } catch {
    // Status suara tetap berlaku untuk sesi ini.
  }
  const context = getAudioContext();
  if (context && masterGain) {
    masterGain.gain.setTargetAtTime(soundEnabled ? 0.55 : 0, context.currentTime, 0.015);
    if (soundEnabled) {
      context.resume().catch(() => {});
      playGameSound('start');
    }
  }
  updateSoundToggle();
});

updateSoundToggle();

function playOutcomeSound(outcome) {
  if (!soundEnabled) return;
  const context = getAudioContext();
  if (!context) return;

  const patterns = {
    win: [[523.25, 0, 0.16], [659.25, 0.14, 0.16], [783.99, 0.28, 0.18], [1046.5, 0.44, 0.38]],
    lose: [[392, 0, 0.2], [349.23, 0.18, 0.2], [293.66, 0.36, 0.22], [196, 0.56, 0.42]],
    draw: [[440, 0, 0.18], [523.25, 0.17, 0.18], [440, 0.34, 0.18], [523.25, 0.51, 0.28]],
  };

  const start = context.currentTime + 0.04;
  const waveform = outcome === 'lose' ? 'triangle' : 'sine';
  for (const [frequency, offset, duration] of patterns[outcome]) {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const noteStart = start + offset;
    oscillator.type = waveform;
    oscillator.frequency.setValueAtTime(frequency, noteStart);
    gain.gain.setValueAtTime(0.0001, noteStart);
    gain.gain.exponentialRampToValueAtTime(0.16, noteStart + 0.025);
    gain.gain.exponentialRampToValueAtTime(0.0001, noteStart + duration);
    oscillator.connect(gain).connect(masterGain);
    oscillator.start(noteStart);
    oscillator.stop(noteStart + duration + 0.03);
  }
}

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
let savedMode = null;
try {
  savedMode = localStorage.getItem(MODE_STORAGE_KEY);
} catch {
  // Gunakan mode bawaan jika penyimpanan browser tidak tersedia.
}
let playMode = savedMode === 'pvp' ? 'pvp' : 'ai';
const isFirstVisit = savedNames === null || savedMode === null;

function nameOf(player) {
  if (playMode === 'ai' && player === 'B') return 'AI';
  return names[player];
}

function updateModeFields() {
  playerBFields.classList.toggle('hidden', modeSelect.value === 'ai');
}

function openNameModal() {
  nameInputA.value = names.A;
  nameInputB.value = names.B;
  modeSelect.value = playMode;
  updateModeFields();
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
  const modeChanged = playMode !== modeSelect.value;
  playMode = modeSelect.value;
  try {
    localStorage.setItem(MODE_STORAGE_KEY, playMode);
  } catch {
    // Mode tetap berlaku untuk sesi ini.
  }
  closeNameModal();
  if (modeChanged) {
    resetGame();
  } else {
    playGameSound('start');
  }
  updateHud();
});

modeSelect.addEventListener('change', updateModeFields);

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

function createInitialState() {
  const initial = initGame();
  if (playMode === 'ai' && Math.random() < 0.5) {
    return { ...initial, currentPlayer: 'B' };
  }
  return initial;
}

let state = createInitialState();
let animating = false;

function storeOf(player) {
  return player === 'A' ? 7 : 15;
}

function updateHud(turnText) {
  gameModeEl.textContent = playMode === 'ai' ? 'Mode: Lawan AI' : 'Mode: 2 Pemain';
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
  const isAiTurn = playMode === 'ai' && state.currentPlayer === 'B';
  scene.setValidMoves(state.gameOver || animating || isAiTurn ? [] : getValidMoves(state));
}

function showAiResult() {
  if (playMode !== 'ai' || !state.gameOver) return;
  const outcome = state.winner === 'A' ? 'win' : state.winner === 'B' ? 'lose' : 'draw';
  const content = {
    win: ['🏆', 'LUAR BIASA!', 'KAMU MENANG!', 'Hebat! Kamu berhasil mengalahkan AI. Siap membuktikannya sekali lagi?'],
    lose: ['🤖', 'AI MENANG!', 'JANGAN MENYERAH!', 'Nyaris! Pelajari langkah AI dan coba rebut kemenangan di permainan berikutnya.'],
    draw: ['🤝', 'SENGIT SEKALI!', 'HASILNYA SERI!', 'Kekuatan kalian seimbang. Main lagi untuk menentukan juara sebenarnya!'],
  }[outcome];

  resultCard.dataset.outcome = outcome;
  [resultIcon.textContent, resultKicker.textContent, resultTitle.textContent, resultMessage.textContent] = content;
  resultScore.textContent = `${nameOf('A')} ${state.board[7]}  —  ${state.board[15]} AI`;
  celebration.replaceChildren(...Array.from({ length: 28 }, (_, index) => {
    const piece = document.createElement('i');
    piece.style.setProperty('--x', `${(index * 37) % 100}%`);
    piece.style.setProperty('--delay', `${(index % 9) * -0.22}s`);
    piece.style.setProperty('--spin', `${180 + (index % 5) * 90}deg`);
    piece.style.setProperty('--hue', `${(index * 53) % 360}`);
    return piece;
  }));
  playOutcomeSound(outcome);
  resultModal.classList.remove('hidden');
  playAgainBtn.focus();
}

function hideAiResult() {
  resultModal.classList.add('hidden');
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function runAiIfNeeded() {
  while (playMode === 'ai' && state.currentPlayer === 'B' && !state.gameOver) {
    animating = true;
    syncInteractivity();
    updateHud('AI sedang berpikir...');
    await wait(650);
    const move = chooseAiMove(state);
    animating = false;
    if (move === null) return;
    await animateMove(move);
  }
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
      playGameSound('pickup', step.seeds);
      await scene.pickupHole(step.hole);
    } else if (step.type === 'sow') {
      updateHud(`${playerName} menabur...`);
      playGameSound('sow', step.hole);
      await scene.flySeed(handAt, step.hole);
      board[step.hole] += 1;
      handAt = step.hole;
    } else if (step.type === 'capture') {
      updateHud(`${playerName} tembak!`);
      playGameSound('capture');
      await Promise.all([
        scene.flyAllSeeds(step.hole, step.store),
        scene.flyAllSeeds(step.opposite, step.store),
      ]);
      board[step.hole] = 0;
      board[step.opposite] = 0;
      await scene.pulseHighlight([step.store]);
    } else if (step.type === 'dead') {
      updateHud(`Biji mati di lubang ${step.hole}.`);
      playGameSound('dead');
      await scene.pulseHighlight([step.hole], 0x888888, 350);
    } else if (step.type === 'extraTurn') {
      updateHud(`${playerName} mendapat giliran ekstra!`);
      playGameSound('extra');
      await scene.pulseHighlight([storeOf(player)]);
    }
  }

  if (result.gameOver) {
    const holesToSweep = [0, 1, 2, 3, 4, 5, 6, 8, 9, 10, 11, 12, 13, 14].filter((h) => board[h] > 0);
    if (holesToSweep.length > 0) {
      updateHud('Menghitung skor akhir...');
      playGameSound('capture');
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
  if (!state.gameOver && state.currentPlayer !== player) playGameSound('turn');
  if (state.gameOver && playMode === 'pvp') {
    playOutcomeSound(state.winner === 'draw' ? 'draw' : 'win');
  }
  showAiResult();
}

async function handlePitClick(holeIndex) {
  if (animating || state.gameOver) return;
  try {
    messageEl.textContent = '';
    await animateMove(holeIndex);
    await runAiIfNeeded();
  } catch (err) {
    animating = false;
    syncInteractivity();
    messageEl.textContent = err.message;
  }
}

scene.onPitClick(handlePitClick);

function resetGame() {
  if (animating) return;
  hideAiResult();
  state = createInitialState();
  messageEl.textContent = '';
  scene.setBoard(state.board);
  syncInteractivity();
  updateHud();
  playGameSound('start');
  runAiIfNeeded();
}

restartBtn.addEventListener('click', resetGame);
playAgainBtn.addEventListener('click', resetGame);
resultSettingsBtn.addEventListener('click', () => {
  hideAiResult();
  openNameModal();
});

scene.setBoard(state.board);
syncInteractivity();
updateHud();
loadingEl.classList.add('hidden');
runAiIfNeeded();
