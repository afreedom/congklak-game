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

function makeTraditionalBoardShape(width, depth) {
  const halfWidth = width / 2;
  const halfDepth = depth / 2;
  const shoulder = Math.min(0.65, width * 0.06);
  const shape = new THREE.Shape();
  shape.moveTo(-halfWidth, 0);
  shape.quadraticCurveTo(-halfWidth + 0.12, -halfDepth * 0.72, -halfWidth + shoulder, -halfDepth);
  shape.lineTo(halfWidth - shoulder, -halfDepth);
  shape.quadraticCurveTo(halfWidth - 0.12, -halfDepth * 0.72, halfWidth, 0);
  shape.quadraticCurveTo(halfWidth - 0.12, halfDepth * 0.72, halfWidth - shoulder, halfDepth);
  shape.lineTo(-halfWidth + shoulder, halfDepth);
  shape.quadraticCurveTo(-halfWidth + 0.12, halfDepth * 0.72, -halfWidth, 0);
  return shape;
}

function addBoardHoles(shape, padding = 1) {
  for (let hole = 0; hole <= 15; hole++) {
    const isStore = hole === 7 || hole === 15;
    const position = holePosition(hole);
    const cutout = new THREE.Path();
    cutout.absellipse(
      position.x,
      position.z,
      (isStore ? STORE_RADIUS_X : PIT_RADIUS) * padding,
      (isStore ? STORE_RADIUS_Z : PIT_RADIUS) * padding,
      0,
      Math.PI * 2,
      true
    );
    shape.holes.push(cutout);
  }
}

function createBowlGeometry(radialSegments = 48, rings = 12) {
  const positions = [0, -1, 0];
  const indices = [];

  for (let ring = 1; ring <= rings; ring++) {
    const radius = ring / rings;
    const y = -Math.pow(1 - radius, 2);
    for (let segment = 0; segment < radialSegments; segment++) {
      const angle = segment / radialSegments * Math.PI * 2;
      positions.push(Math.cos(angle) * radius, y, Math.sin(angle) * radius);
    }
  }

  for (let segment = 0; segment < radialSegments; segment++) {
    const current = 1 + segment;
    const next = 1 + (segment + 1) % radialSegments;
    indices.push(0, next, current);
  }

  for (let ring = 1; ring < rings; ring++) {
    const innerStart = 1 + (ring - 1) * radialSegments;
    const outerStart = innerStart + radialSegments;
    for (let segment = 0; segment < radialSegments; segment++) {
      const nextSegment = (segment + 1) % radialSegments;
      const inner = innerStart + segment;
      const innerNext = innerStart + nextSegment;
      const outer = outerStart + segment;
      const outerNext = outerStart + nextSegment;
      indices.push(inner, outerNext, outer, inner, innerNext, outerNext);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function traceBoardCanvas(ctx, width, height, inset = 0) {
  const shoulder = 74;
  ctx.beginPath();
  ctx.moveTo(inset, height / 2);
  ctx.quadraticCurveTo(inset + 16, inset + 34, inset + shoulder, inset);
  ctx.lineTo(width - inset - shoulder, inset);
  ctx.quadraticCurveTo(width - inset - 16, inset + 34, width - inset, height / 2);
  ctx.quadraticCurveTo(width - inset - 16, height - inset - 34, width - inset - shoulder, height - inset);
  ctx.lineTo(inset + shoulder, height - inset);
  ctx.quadraticCurveTo(inset + 16, height - inset - 34, inset, height / 2);
  ctx.closePath();
}

function drawKawung(ctx, x, y, size) {
  ctx.save();
  ctx.translate(x, y);
  for (let i = 0; i < 4; i++) {
    ctx.rotate(Math.PI / 2);
    ctx.beginPath();
    ctx.ellipse(0, -size * 0.24, size * 0.17, size * 0.34, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(54, 20, 10, 0.72)';
    ctx.fill();
    ctx.lineWidth = Math.max(2, size * 0.045);
    ctx.strokeStyle = 'rgba(239, 190, 105, 0.9)';
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.arc(0, 0, size * 0.105, 0, Math.PI * 2);
  ctx.fillStyle = '#e3b064';
  ctx.fill();
  ctx.beginPath();
  ctx.arc(0, 0, size * 0.045, 0, Math.PI * 2);
  ctx.fillStyle = '#5c2512';
  ctx.fill();
  ctx.restore();
}

function drawParang(ctx, x, y, size, rotation) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotation);
  ctx.beginPath();
  ctx.moveTo(-size * 0.6, size * 0.1);
  ctx.bezierCurveTo(-size * 0.2, -size * 0.55, size * 0.42, -size * 0.5, size * 0.58, -size * 0.06);
  ctx.bezierCurveTo(size * 0.25, -size * 0.16, -size * 0.15, size * 0.5, -size * 0.6, size * 0.1);
  ctx.closePath();
  ctx.fillStyle = 'rgba(69, 25, 12, 0.2)';
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = 'rgba(245, 200, 118, 0.32)';
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(size * 0.25, -size * 0.06, size * 0.16, Math.PI * 0.2, Math.PI * 1.55);
  ctx.stroke();
  ctx.restore();
}

function createBatikBoardTexture(renderer, boardWidth, boardDepth) {
  const canvas = document.createElement('canvas');
  canvas.width = 2048;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');

  traceBoardCanvas(ctx, canvas.width, canvas.height, 8);
  ctx.clip();

  const wood = ctx.createLinearGradient(0, 0, 0, canvas.height);
  wood.addColorStop(0, '#a95d2d');
  wood.addColorStop(0.48, '#7f381c');
  wood.addColorStop(0.53, '#8f431f');
  wood.addColorStop(1, '#5e2816');
  ctx.fillStyle = wood;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Serat kayu dibuat deterministik agar tekstur stabil setiap kali papan dimuat.
  for (let i = 0; i < 85; i++) {
    const y = (i * 73) % canvas.height;
    const bend = Math.sin(i * 2.17) * 28;
    ctx.beginPath();
    ctx.moveTo(-20, y);
    ctx.bezierCurveTo(480, y + bend, 1430, y - bend * 0.7, canvas.width + 20, y + bend * 0.25);
    ctx.lineWidth = i % 4 === 0 ? 3 : 1;
    ctx.strokeStyle = i % 3 === 0 ? 'rgba(48, 15, 7, 0.2)' : 'rgba(238, 151, 81, 0.13)';
    ctx.stroke();
  }

  for (let x = 120; x < canvas.width - 80; x += 155) {
    drawParang(ctx, x, 94, 74, -0.34);
    drawParang(ctx, x + 74, canvas.height - 91, 74, Math.PI - 0.34);
  }

  // Motif kawung berada di sela dua baris lubang, mengikuti ukiran pada papan referensi.
  for (let i = 0; i < 7; i++) {
    drawKawung(ctx, canvas.width * (0.196 + i * 0.1013), canvas.height / 2, 76);
  }
  drawKawung(ctx, 80, canvas.height / 2, 96);
  drawKawung(ctx, canvas.width - 80, canvas.height / 2, 96);

  ctx.lineWidth = 10;
  ctx.strokeStyle = 'rgba(61, 21, 10, 0.9)';
  traceBoardCanvas(ctx, canvas.width, canvas.height, 19);
  ctx.stroke();
  ctx.lineWidth = 4;
  ctx.strokeStyle = 'rgba(235, 177, 87, 0.9)';
  traceBoardCanvas(ctx, canvas.width, canvas.height, 29);
  ctx.stroke();

  // Lubang transparan mencegah lapisan motif menutupi cekungan permainan.
  ctx.save();
  ctx.globalCompositeOperation = 'destination-out';
  for (let hole = 0; hole <= 15; hole++) {
    const isStore = hole === 7 || hole === 15;
    const isPit = hole <= 6 || (hole >= 8 && hole <= 14);
    if (!isStore && !isPit) continue;
    const position = holePosition(hole);
    const radiusX = (isStore ? STORE_RADIUS_X : PIT_RADIUS) * 1.04;
    const radiusZ = (isStore ? STORE_RADIUS_Z : PIT_RADIUS) * 1.04;
    const x = (position.x / boardWidth + 0.5) * canvas.width;
    const y = (0.5 - position.z / boardDepth) * canvas.height;
    ctx.beginPath();
    ctx.ellipse(
      x,
      y,
      radiusX / boardWidth * canvas.width,
      radiusZ / boardDepth * canvas.height,
      0,
      0,
      Math.PI * 2
    );
    ctx.fill();
  }
  ctx.restore();

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return texture;
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

  // ---- Papan kayu tradisional berornamen batik ----
  const boardWidth = STORE_X * 2 + STORE_RADIUS_X * 2.5;
  const boardDepth = ROW_Z * 2 + PIT_RADIUS * 2.65;
  const boardShape = makeTraditionalBoardShape(boardWidth, boardDepth);
  addBoardHoles(boardShape, 1.04);
  const boardGeometry = new THREE.ExtrudeGeometry(boardShape, {
    depth: 0.5,
    bevelEnabled: false,
    curveSegments: 24,
  });
  boardGeometry.rotateX(Math.PI / 2);
  const board = new THREE.Mesh(
    boardGeometry,
    new THREE.MeshStandardMaterial({ color: 0x82401f, roughness: 0.68 })
  );
  board.castShadow = true;
  board.receiveShadow = true;
  scene.add(board);

  const batikTop = new THREE.Mesh(
    new THREE.PlaneGeometry(boardWidth, boardDepth),
    new THREE.MeshStandardMaterial({
      map: createBatikBoardTexture(renderer, boardWidth, boardDepth),
      transparent: true,
      alphaTest: 0.02,
      roughness: 0.58,
      metalness: 0.02,
    })
  );
  batikTop.rotation.x = -Math.PI / 2;
  batikTop.position.y = 0.012;
  batikTop.receiveShadow = true;
  scene.add(batikTop);

  const baseShape = makeTraditionalBoardShape(boardWidth + 0.34, boardDepth + 0.3);
  const baseGeometry = new THREE.ExtrudeGeometry(baseShape, {
    depth: 0.2,
    bevelEnabled: false,
    curveSegments: 24,
  });
  baseGeometry.rotateX(Math.PI / 2);
  const rim = new THREE.Mesh(
    baseGeometry,
    new THREE.MeshStandardMaterial({ color: 0x3f1b0e, roughness: 0.8 })
  );
  rim.position.y = -0.43;
  rim.castShadow = true;
  rim.receiveShadow = true;
  scene.add(rim);

  // ---- Grup per lubang: well (sumur) + ring highlight + grup biji ----
  const holeGroups = new Map(); // hole -> { well, ring, seedsGroup, seeds: [] }
  const pitWellMaterial = new THREE.MeshStandardMaterial({ color: 0x32170d, roughness: 0.88 });
  const storeWellMaterial = new THREE.MeshStandardMaterial({ color: 0x281108, roughness: 0.9 });
  const bowlGeometry = createBowlGeometry();
  const carvedRingGeometry = new THREE.TorusGeometry(1, 0.075, 12, 48);
  const carvedRingMaterial = new THREE.MeshStandardMaterial({
    color: 0x4e2010,
    roughness: 0.62,
    metalness: 0.04,
  });
  const highlightRingGeometry = new THREE.TorusGeometry(1, 0.033, 10, 48);

  function buildWell(hole) {
    const isStore = hole === 7 || hole === 15;
    const rx = isStore ? STORE_RADIUS_X : PIT_RADIUS;
    const rz = isStore ? STORE_RADIUS_Z : PIT_RADIUS;

    const wellGroup = new THREE.Group();
    const pos = holePosition(hole);
    wellGroup.position.copy(pos);
    scene.add(wellGroup);

    const wellMesh = new THREE.Mesh(
      bowlGeometry,
      isStore ? storeWellMaterial : pitWellMaterial
    );
    wellMesh.scale.set(rx, PIT_DEPTH, rz);
    wellMesh.position.y = 0.008;
    wellMesh.receiveShadow = true;
    wellGroup.add(wellMesh);

    const carvedRing = new THREE.Mesh(carvedRingGeometry, carvedRingMaterial);
    carvedRing.rotation.x = Math.PI / 2;
    carvedRing.scale.set(rx * 1.055, rz * 1.055, 1);
    carvedRing.position.y = 0.025;
    carvedRing.castShadow = true;
    carvedRing.receiveShadow = true;
    wellGroup.add(carvedRing);

    const ring = new THREE.Mesh(highlightRingGeometry, new THREE.MeshStandardMaterial({
      color: 0xe8b86d,
      emissive: 0x000000,
    }));
    ring.rotation.x = Math.PI / 2;
    ring.scale.set(rx * 1.18, rz * 1.18, 1);
    ring.position.y = 0.065;
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
