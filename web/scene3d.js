import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// ---- Layout konstanta ----
const SPACING = 1.7;
const CENTER_X = ((7 - 1) * SPACING) / 2; // pusatkan 7 kolom
const ROW_Z = 1.15; // jarak baris A (depan) / B (belakang) dari tengah
const PIT_RADIUS = 0.62;
const PIT_DEPTH = 0.28;
const STORE_RADIUS_X = 0.75;
const STORE_RADIUS_Z = 1.55;
const STORE_GAP = 1.55;
const STORE_X = CENTER_X + STORE_GAP + STORE_RADIUS_X;
const SEED_RADIUS = 0.14;
const SEED_HEIGHT = 0.1;
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

function columnOf(hole) {
  // Menjaga lubang seberang (i, 14-i) sejajar secara visual pada sumbu X yang sama.
  if (hole <= 6) return hole;
  return 14 - hole;
}

function holePosition(hole) {
  if (hole === 7) return new THREE.Vector3(STORE_X, 0, 0);
  if (hole === 15) return new THREE.Vector3(-STORE_X, 0, 0);
  const x = columnOf(hole) * SPACING - CENTER_X;
  const z = hole <= 6 ? ROW_Z : -ROW_Z;
  return new THREE.Vector3(x, 0, z);
}

function seedLocalPosition(i, radiusX, radiusZ) {
  const perLayer = 26;
  const layer = Math.floor(i / perLayer);
  const j = i % perLayer;
  const t = (j + 0.5) / perLayer;
  const theta = j * GOLDEN_ANGLE + layer * 0.65;
  return new THREE.Vector3(
    radiusX * Math.sqrt(t) * Math.cos(theta),
    SEED_HEIGHT * 0.58 + layer * SEED_HEIGHT * 0.95,
    radiusZ * Math.sqrt(t) * Math.sin(theta)
  );
}

const SHELL_COLORS = [0xf2e5c3, 0xffe09a, 0xe8e4d5, 0xd9c69e, 0xf6d7a1, 0xded8bd];
const shellMaterials = SHELL_COLORS.map((color) => new THREE.MeshPhysicalMaterial({
  color,
  roughness: 0.24,
  metalness: 0,
  clearcoat: 0.72,
  clearcoatRoughness: 0.2,
}));
const slitMaterial = new THREE.MeshStandardMaterial({ color: 0x24160f, roughness: 0.82 });
const toothMaterial = new THREE.MeshPhysicalMaterial({
  color: 0xfff3d5,
  roughness: 0.3,
  clearcoat: 0.35,
});

// Bentuk cangkang cowrie: badan oval menggembung dengan salah satu ujung sedikit meruncing.
const shellGeometry = new THREE.SphereGeometry(1, 20, 14);
const shellPositions = shellGeometry.attributes.position;
for (let i = 0; i < shellPositions.count; i++) {
  const x = shellPositions.getX(i);
  const y = shellPositions.getY(i);
  const z = shellPositions.getZ(i);
  const taper = 0.91 + 0.09 * (1 - x);
  shellPositions.setXYZ(i, x * 0.14, y * 0.052, z * 0.082 * taper);
}
shellGeometry.computeVertexNormals();

function makeCapsuleShape(halfLength, radius) {
  const shape = new THREE.Shape();
  shape.moveTo(-halfLength, -radius);
  shape.lineTo(halfLength, -radius);
  shape.quadraticCurveTo(halfLength + radius, -radius, halfLength + radius, 0);
  shape.quadraticCurveTo(halfLength + radius, radius, halfLength, radius);
  shape.lineTo(-halfLength, radius);
  shape.quadraticCurveTo(-halfLength - radius, radius, -halfLength - radius, 0);
  shape.quadraticCurveTo(-halfLength - radius, -radius, -halfLength, -radius);
  return shape;
}

const slitGeometry = new THREE.ShapeGeometry(makeCapsuleShape(0.075, 0.012), 12);
slitGeometry.rotateX(-Math.PI / 2);
const toothParts = [];
for (let i = 0; i < 7; i++) {
  const x = -0.058 + i * 0.0193;
  for (const side of [-1, 1]) {
    const tooth = new THREE.BoxGeometry(0.009, 0.006, 0.019);
    tooth.rotateY(side * (0.18 + Math.abs(i - 3) * 0.025));
    tooth.translate(x, 0.0565, side * 0.011);
    toothParts.push(tooth);
  }
}
const teethGeometry = mergeGeometries(toothParts);
for (const part of toothParts) part.dispose();

function seedVariation(seed) {
  const value = Math.sin((seed + 1) * 91.731) * 43758.5453;
  return value - Math.floor(value);
}

function orientSeed(seed, hole, index) {
  seed.rotation.set(
    (seedVariation(index * 31 + hole) - 0.5) * 0.18,
    seedVariation(hole * 101 + index * 17) * Math.PI * 2,
    (seedVariation(index * 53 + hole * 7) - 0.5) * 0.14
  );
}

function createCowrieSeed(seed) {
  const group = new THREE.Group();
  const body = new THREE.Mesh(shellGeometry, shellMaterials[seed % shellMaterials.length]);
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);

  // Celah dan dua baris gerigi dibuat sedikit di atas badan agar terbaca dari kamera permainan.
  const slit = new THREE.Mesh(slitGeometry, slitMaterial);
  slit.position.y = 0.053;
  group.add(slit);

  group.add(new THREE.Mesh(teethGeometry, toothMaterial));

  group.scale.setScalar(0.94 + seedVariation(seed * 13) * 0.12);
  return group;
}

export function createScene(container) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0e1420);
  scene.fog = new THREE.Fog(0x0e1420, 18, 34);

  const camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 100);
  camera.position.set(0, 9.5, 8.5);

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  container.appendChild(renderer.domElement);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 0, 0);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.minDistance = 6;
  controls.maxDistance = 20;
  controls.maxPolarAngle = Math.PI * 0.47;
  controls.update();

  // ---- Cahaya ----
  scene.add(new THREE.AmbientLight(0xfff2e0, 0.55));
  const sun = new THREE.DirectionalLight(0xfff6e6, 1.4);
  sun.position.set(6, 11, 5);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -12;
  sun.shadow.camera.right = 12;
  sun.shadow.camera.top = 10;
  sun.shadow.camera.bottom = -10;
  sun.shadow.bias = -0.0025;
  scene.add(sun);
  const fill = new THREE.PointLight(0x6fa8ff, 0.35, 30);
  fill.position.set(-6, 5, -6);
  scene.add(fill);

  // ---- Lantai ----
  const floor = new THREE.Mesh(
    new THREE.CircleGeometry(20, 48),
    new THREE.MeshStandardMaterial({ color: 0x11161f, roughness: 1 })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.85;
  floor.receiveShadow = true;
  scene.add(floor);

  // ---- Papan kayu ----
  const boardWidth = STORE_X * 2 + STORE_RADIUS_X * 1.6;
  const boardDepth = ROW_Z * 2 + PIT_RADIUS * 2.4;
  const board = new THREE.Mesh(
    new THREE.BoxGeometry(boardWidth, 0.5, boardDepth, 1, 1, 1),
    new THREE.MeshStandardMaterial({ color: 0x8a5a34, roughness: 0.75 })
  );
  board.position.y = -0.25;
  board.castShadow = true;
  board.receiveShadow = true;
  scene.add(board);

  const rim = new THREE.Mesh(
    new THREE.BoxGeometry(boardWidth + 0.35, 0.22, boardDepth + 0.35),
    new THREE.MeshStandardMaterial({ color: 0x6b431f, roughness: 0.8 })
  );
  rim.position.y = -0.5;
  rim.receiveShadow = true;
  scene.add(rim);

  // ---- Grup per lubang: well (sumur) + ring highlight + grup biji ----
  const holeGroups = new Map(); // hole -> { well, ring, seedsGroup, seeds: [] }

  function buildWell(hole) {
    const isStore = hole === 7 || hole === 15;
    const rx = isStore ? STORE_RADIUS_X : PIT_RADIUS;
    const rz = isStore ? STORE_RADIUS_Z : PIT_RADIUS;

    const wellGroup = new THREE.Group();
    const pos = holePosition(hole);
    wellGroup.position.copy(pos);
    scene.add(wellGroup);

    const wellMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(1, 1, PIT_DEPTH, 28),
      new THREE.MeshStandardMaterial({ color: isStore ? 0x3c2716 : 0x4a301c, roughness: 0.9 })
    );
    wellMesh.scale.set(rx, 1, rz);
    wellMesh.position.y = -PIT_DEPTH / 2;
    wellMesh.receiveShadow = true;
    wellGroup.add(wellMesh);

    const ringGeo = new THREE.TorusGeometry(1, 0.045, 10, 40);
    const ring = new THREE.Mesh(ringGeo, new THREE.MeshStandardMaterial({ color: 0xe8b86d, emissive: 0x000000 }));
    ring.rotation.x = Math.PI / 2;
    ring.scale.set(rx * 1.05, rz * 1.05, 1);
    ring.position.y = 0.02;
    ring.visible = false;
    wellGroup.add(ring);

    const seedsGroup = new THREE.Group();
    wellGroup.add(seedsGroup);

    holeGroups.set(hole, { wellGroup, wellMesh, ring, seedsGroup, seeds: [], rx, rz, clickable: false });
  }

  for (let h = 0; h <= 6; h++) buildWell(h);
  for (let h = 8; h <= 14; h++) buildWell(h);
  buildWell(7);
  buildWell(15);

  // ---- Label angka (HTML overlay, diposisikan lewat proyeksi kamera tiap frame) ----
  const labelLayer = document.createElement('div');
  labelLayer.style.position = 'absolute';
  labelLayer.style.inset = '0';
  labelLayer.style.pointerEvents = 'none';
  container.style.position = 'relative';
  container.appendChild(labelLayer);

  const labels = new Map();
  for (const hole of holeGroups.keys()) {
    const el = document.createElement('div');
    el.className = 'seed-label' + (hole === 7 || hole === 15 ? ' store-label-3d' : hole <= 6 ? ' owner-a' : ' owner-b');
    labelLayer.appendChild(el);
    labels.set(hole, el);
  }

  function updateLabels() {
    for (const [hole, entry] of holeGroups) {
      const el = labels.get(hole);
      const count = entry.seeds.length;
      el.textContent = String(count);
      const worldPos = entry.wellGroup.position.clone();
      worldPos.y += 0.15;
      worldPos.project(camera);
      const x = (worldPos.x * 0.5 + 0.5) * container.clientWidth;
      const y = (-worldPos.y * 0.5 + 0.5) * container.clientHeight;
      el.style.left = `${x}px`;
      el.style.top = `${y}px`;
      el.style.display = worldPos.z > 1 ? 'none' : 'block';
    }
  }

  // ---- Manajemen biji ----
  function spawnSeedMesh(hole) {
    const entry = holeGroups.get(hole);
    return createCowrieSeed(entry.seeds.length + hole * 7);
  }

  function relayoutHole(hole) {
    const entry = holeGroups.get(hole);
    entry.seeds.forEach((mesh, i) => {
      const target = seedLocalPosition(i, entry.rx - SEED_RADIUS * 1.3, entry.rz - SEED_RADIUS * 1.3);
      mesh.position.copy(target);
      orientSeed(mesh, hole, i);
    });
  }

  function addSeedInstant(hole) {
    const entry = holeGroups.get(hole);
    const mesh = spawnSeedMesh(hole);
    entry.seedsGroup.add(mesh);
    entry.seeds.push(mesh);
    relayoutHole(hole);
    return mesh;
  }

  function clearHoleInstant(hole) {
    const entry = holeGroups.get(hole);
    for (const mesh of entry.seeds) entry.seedsGroup.remove(mesh);
    entry.seeds = [];
  }

  function setBoard(boardArray) {
    for (const hole of holeGroups.keys()) {
      clearHoleInstant(hole);
      const count = boardArray[hole] || 0;
      for (let i = 0; i < count; i++) addSeedInstant(hole);
    }
    // Refresh label & frame segera; jangan menunggu tick rAF berikutnya
    // (mis. saat tab sedang tidak fokus, rAF bisa ditunda browser).
    updateLabels();
    renderer.render(scene, camera);
  }

  // ---- Highlight lubang yang bisa diklik ----
  function setValidMoves(indices) {
    const valid = new Set(indices);
    for (const [hole, entry] of holeGroups) {
      entry.clickable = valid.has(hole);
      entry.ring.visible = entry.clickable;
      entry.ring.material.color.set(hole <= 6 ? 0x4fa3ff : 0xff6b5e);
    }
  }

  function pulseHighlight(holes, color = 0xffd76a, duration = 500) {
    const start = performance.now();
    const rings = holes.map((h) => holeGroups.get(h).ring);
    for (const ring of rings) {
      ring.visible = true;
      ring.material.color.set(color);
    }
    return new Promise((resolve) => {
      function tick(now) {
        const t = (now - start) / duration;
        if (t >= 1) {
          for (const h of holes) {
            const entry = holeGroups.get(h);
            entry.ring.visible = entry.clickable;
          }
          resolve();
          return;
        }
        const pulse = 0.5 + 0.5 * Math.sin(t * Math.PI * 6);
        for (const ring of rings) ring.material.emissive.setScalar(pulse * 0.6);
        requestAnimationFrame(tick);
      }
      requestAnimationFrame(tick);
    });
  }

  // ---- Animasi: satu biji terbang dari satu lubang ke lubang lain ----
  function flySeed(fromHole, toHole, duration = 260) {
    return new Promise((resolve) => {
      const fromEntry = holeGroups.get(fromHole);
      const toEntry = holeGroups.get(toHole);

      const startWorld = fromEntry.seeds.length
        ? fromEntry.seeds[fromEntry.seeds.length - 1].getWorldPosition(new THREE.Vector3())
        : fromEntry.wellGroup.position.clone();
      const endLocal = seedLocalPosition(
        toEntry.seeds.length,
        toEntry.rx - SEED_RADIUS * 1.3,
        toEntry.rz - SEED_RADIUS * 1.3
      );
      const endWorld = endLocal.clone().add(toEntry.wellGroup.position);

      const mesh = createCowrieSeed(toEntry.seeds.length + toHole * 7);
      mesh.position.copy(startWorld);
      scene.add(mesh);

      const start = performance.now();
      const arcHeight = 1.1 + startWorld.distanceTo(endWorld) * 0.12;

      function tick(now) {
        const t = Math.min((now - start) / duration, 1);
        const ease = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
        mesh.position.lerpVectors(startWorld, endWorld, ease);
        mesh.position.y += Math.sin(t * Math.PI) * arcHeight;
        mesh.rotation.x += 0.25;
        mesh.rotation.y += 0.18;
        if (t < 1) {
          requestAnimationFrame(tick);
        } else {
          scene.remove(mesh);
          toEntry.seedsGroup.add(mesh);
          mesh.position.copy(endLocal);
          orientSeed(mesh, toHole, toEntry.seeds.length);
          toEntry.seeds.push(mesh);
          resolve();
        }
      }
      requestAnimationFrame(tick);
    });
  }

  function pickupHole(hole, duration = 220) {
    const entry = holeGroups.get(hole);
    const seeds = entry.seeds;
    entry.seeds = [];
    if (seeds.length === 0) return Promise.resolve();
    const start = performance.now();
    return new Promise((resolve) => {
      function tick(now) {
        const t = Math.min((now - start) / duration, 1);
        const scale = 1 - t;
        for (const mesh of seeds) {
          mesh.scale.setScalar(scale);
          mesh.position.y += 0.01;
        }
        if (t < 1) {
          requestAnimationFrame(tick);
        } else {
          for (const mesh of seeds) entry.seedsGroup.remove(mesh);
          resolve();
        }
      }
      requestAnimationFrame(tick);
    });
  }

  function flyAllSeeds(fromHole, toHole, duration = 320) {
    const fromEntry = holeGroups.get(fromHole);
    const seeds = fromEntry.seeds;
    fromEntry.seeds = [];
    if (seeds.length === 0) return Promise.resolve();
    const toEntry = holeGroups.get(toHole);
    const start = performance.now();
    const fromWorld = fromEntry.wellGroup.position;
    const targets = seeds.map((mesh, i) => {
      const world = mesh.getWorldPosition(new THREE.Vector3());
      const localTarget = seedLocalPosition(
        toEntry.seeds.length + i,
        toEntry.rx - SEED_RADIUS * 1.3,
        toEntry.rz - SEED_RADIUS * 1.3
      );
      const worldTarget = localTarget.clone().add(toEntry.wellGroup.position);
      fromEntry.seedsGroup.remove(mesh);
      scene.add(mesh);
      mesh.position.copy(world);
      return { mesh, from: world, to: worldTarget, local: localTarget, index: toEntry.seeds.length + i };
    });

    return new Promise((resolve) => {
      function tick(now) {
        const t = Math.min((now - start) / duration, 1);
        const ease = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
        for (const item of targets) {
          item.mesh.position.lerpVectors(item.from, item.to, ease);
          item.mesh.position.y += Math.sin(t * Math.PI) * 0.9;
        }
        if (t < 1) {
          requestAnimationFrame(tick);
        } else {
          for (const item of targets) {
            scene.remove(item.mesh);
            toEntry.seedsGroup.add(item.mesh);
            item.mesh.position.copy(item.local);
            orientSeed(item.mesh, toHole, item.index);
            toEntry.seeds.push(item.mesh);
          }
          resolve();
        }
      }
      requestAnimationFrame(tick);
    });
  }

  // ---- Interaksi klik ----
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  let clickHandler = null;

  renderer.domElement.addEventListener('click', (event) => {
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    const meshes = [...holeGroups.values()].map((e) => e.wellMesh);
    const hits = raycaster.intersectObjects(meshes, false);
    if (hits.length === 0) return;
    const hitMesh = hits[0].object;
    for (const [hole, entry] of holeGroups) {
      if (entry.wellMesh === hitMesh && entry.clickable && clickHandler) {
        clickHandler(hole);
        return;
      }
    }
  });

  function onPitClick(handler) {
    clickHandler = handler;
  }

  // ---- Render loop ----
  function resize() {
    const w = container.clientWidth;
    const h = container.clientHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  }
  window.addEventListener('resize', resize);

  let clock = new THREE.Clock();
  function animate() {
    requestAnimationFrame(animate);
    controls.update();
    updateLabels();
    renderer.render(scene, camera);
  }
  animate();

  return {
    setBoard,
    setValidMoves,
    onPitClick,
    flySeed,
    pickupHole,
    flyAllSeeds,
    pulseHighlight,
    holePosition,
  };
}
