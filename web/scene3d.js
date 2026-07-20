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

function drawMountainLayer(ctx, width, height, baseY, amplitude, color, phase) {
  ctx.beginPath();
  ctx.moveTo(0, height);
  ctx.lineTo(0, baseY);
  for (let i = 0; i <= 96; i++) {
    const t = i / 96;
    const ridge =
      Math.sin(t * Math.PI * 6 + phase) * 0.38 +
      Math.sin(t * Math.PI * 14 + phase * 0.7) * 0.17 +
      Math.abs(Math.sin(t * Math.PI * 4 + phase)) * 0.75;
    ctx.lineTo(t * width, baseY - ridge * amplitude);
  }
  ctx.lineTo(width, height);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}

function drawRockyMountain(ctx, width, height) {
  const points = [
    [0, 720], [150, 690], [310, 710], [470, 665], [610, 630],
    [760, 555], [885, 470], [985, 375], [1055, 335], [1135, 390],
    [1225, 475], [1335, 520], [1430, 585], [1535, 550], [1645, 610],
    [1780, 650], [1920, 675], [width, 710],
  ];
  const mountain = ctx.createLinearGradient(0, 330, 0, 760);
  mountain.addColorStop(0, '#5b3b42');
  mountain.addColorStop(0.5, '#854b3e');
  mountain.addColorStop(1, '#3c362c');

  ctx.beginPath();
  ctx.moveTo(0, height);
  ctx.lineTo(points[0][0], points[0][1]);
  for (const [x, y] of points) ctx.lineTo(x, y);
  ctx.lineTo(width, height);
  ctx.closePath();
  ctx.fillStyle = mountain;
  ctx.fill();

  const facets = [
    { color: 'rgba(225, 117, 72, 0.36)', points: [[1055, 335], [1135, 390], [1270, 520], [1080, 475]] },
    { color: 'rgba(235, 137, 82, 0.28)', points: [[1080, 475], [1270, 520], [1430, 585], [1190, 610]] },
    { color: 'rgba(38, 36, 43, 0.48)', points: [[760, 555], [985, 375], [1080, 475], [900, 680], [690, 650]] },
    { color: 'rgba(42, 39, 40, 0.5)', points: [[985, 375], [1055, 335], [1080, 475], [1015, 570]] },
    { color: 'rgba(207, 94, 58, 0.3)', points: [[1335, 520], [1535, 550], [1645, 610], [1420, 680]] },
  ];
  for (const facet of facets) {
    ctx.beginPath();
    ctx.moveTo(facet.points[0][0], facet.points[0][1]);
    for (let i = 1; i < facet.points.length; i++) ctx.lineTo(facet.points[i][0], facet.points[i][1]);
    ctx.closePath();
    ctx.fillStyle = facet.color;
    ctx.fill();
  }

  ctx.lineCap = 'round';
  const ridges = [
    [1055, 350, 1005, 490, 920, 640],
    [1110, 405, 1160, 500, 1225, 620],
    [985, 455, 900, 560, 790, 650],
    [1300, 525, 1395, 590, 1490, 650],
  ];
  for (const [x1, y1, cx, cy, x2, y2] of ridges) {
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.quadraticCurveTo(cx, cy, x2, y2);
    ctx.lineWidth = 11;
    ctx.strokeStyle = 'rgba(36, 30, 34, 0.34)';
    ctx.stroke();
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(240, 141, 88, 0.3)';
    ctx.stroke();
  }
}

function createVillagePanoramaTexture(renderer) {
  const canvas = document.createElement('canvas');
  canvas.width = 2048;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d');

  const sky = ctx.createLinearGradient(0, 0, 0, canvas.height);
  sky.addColorStop(0, '#b76168');
  sky.addColorStop(0.33, '#ec866f');
  sky.addColorStop(0.58, '#ffc486');
  sky.addColorStop(0.72, '#f5d69a');
  sky.addColorStop(1, '#5f763d');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const sun = ctx.createRadialGradient(420, 355, 8, 420, 355, 150);
  sun.addColorStop(0, 'rgba(255, 247, 197, 0.95)');
  sun.addColorStop(0.25, 'rgba(255, 202, 115, 0.72)');
  sun.addColorStop(1, 'rgba(255, 210, 120, 0)');
  ctx.fillStyle = sun;
  ctx.fillRect(240, 175, 360, 360);

  ctx.lineCap = 'round';
  for (let i = 0; i < 12; i++) {
    const y = 90 + i * 35;
    ctx.beginPath();
    ctx.moveTo(-80 + (i % 3) * 90, y);
    ctx.bezierCurveTo(430, y - 28, 1220, y + 42, canvas.width + 90, y - 12);
    ctx.lineWidth = 18 + (i % 4) * 7;
    ctx.strokeStyle = i % 2 === 0 ? 'rgba(255, 207, 178, 0.2)' : 'rgba(126, 62, 75, 0.14)';
    ctx.stroke();
  }

  drawMountainLayer(ctx, canvas.width, canvas.height, 700, 52, '#8b7770', 1.8);
  drawRockyMountain(ctx, canvas.width, canvas.height);

  const fields = ctx.createLinearGradient(0, 720, 0, canvas.height);
  fields.addColorStop(0, '#789746');
  fields.addColorStop(0.5, '#92a84c');
  fields.addColorStop(1, '#53692f');
  ctx.fillStyle = fields;
  ctx.fillRect(0, 720, canvas.width, canvas.height - 720);

  for (let y = 755; y < canvas.height; y += 48) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    for (let x = 0; x <= canvas.width; x += 64) {
      ctx.lineTo(x, y + Math.sin(x * 0.012 + y) * 8);
    }
    ctx.lineWidth = 7;
    ctx.strokeStyle = 'rgba(225, 203, 102, 0.5)';
    ctx.stroke();
  }

  for (let x = 55; x < canvas.width; x += 118) {
    ctx.beginPath();
    ctx.moveTo(x, 728);
    ctx.lineTo(x + 48, canvas.height);
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(44, 81, 35, 0.38)';
    ctx.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return texture;
}

function createPaddyTexture(renderer) {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#6e873d';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  for (let row = 0; row < 8; row++) {
    for (let column = 0; column < 8; column++) {
      const light = (row + column) % 3;
      ctx.fillStyle = ['#78933e', '#668037', '#849b43'][light];
      ctx.fillRect(column * 128 + 5, row * 128 + 5, 118, 118);
    }
  }

  ctx.lineWidth = 10;
  ctx.strokeStyle = '#b5a35a';
  for (let i = 0; i <= 8; i++) {
    ctx.beginPath();
    ctx.moveTo(i * 128, 0);
    ctx.lineTo(i * 128, canvas.height);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, i * 128);
    ctx.lineTo(canvas.width, i * 128);
    ctx.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(4, 4);
  texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return texture;
}

function createThatchTexture(renderer) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  const base = ctx.createLinearGradient(0, 0, canvas.width, 0);
  base.addColorStop(0, '#6e421f');
  base.addColorStop(0.5, '#a16b32');
  base.addColorStop(1, '#5c3519');
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  for (let x = 0; x < canvas.width; x += 7) {
    const offset = Math.sin(x * 0.19) * 8;
    ctx.beginPath();
    ctx.moveTo(x, -10);
    ctx.lineTo(x + offset, canvas.height + 10);
    ctx.lineWidth = x % 21 === 0 ? 3 : 1;
    ctx.strokeStyle = x % 14 === 0 ? 'rgba(49, 25, 10, 0.55)' : 'rgba(230, 174, 85, 0.28)';
    ctx.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(5, 2);
  texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return texture;
}

function makeRoundBeam(start, end, radius, material) {
  const direction = end.clone().sub(start);
  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(radius * 0.88, radius, direction.length(), 10),
    material
  );
  beam.position.copy(start).add(end).multiplyScalar(0.5);
  beam.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
  beam.castShadow = true;
  beam.receiveShadow = true;
  return beam;
}

function addVillageEnvironment(scene, renderer) {
  const panoramaTexture = createVillagePanoramaTexture(renderer);
  const panorama = new THREE.Mesh(
    new THREE.SphereGeometry(52, 64, 32),
    new THREE.MeshBasicMaterial({
      map: panoramaTexture,
      side: THREE.BackSide,
      fog: false,
    })
  );
  panorama.rotation.y = -0.42;
  scene.add(panorama);

  const mountainVista = new THREE.Mesh(
    new THREE.PlaneGeometry(64, 28),
    new THREE.MeshBasicMaterial({ map: panoramaTexture, fog: false })
  );
  mountainVista.position.set(0, 9, -27);
  scene.add(mountainVista);

  const field = new THREE.Mesh(
    new THREE.PlaneGeometry(64, 24),
    new THREE.MeshStandardMaterial({
      map: createPaddyTexture(renderer),
      color: 0xb7c17c,
      roughness: 1,
    })
  );
  field.rotation.x = -Math.PI / 2;
  field.position.set(0, -1.02, 0);
  field.receiveShadow = true;
  scene.add(field);

  const saung = new THREE.Group();
  const saungWidth = 29;
  const postX = 13.35;
  const postZ = 6.75;
  const eaveY = 7.1;
  const ridgeY = 9.4;
  const slatDepth = 0.64;
  const slatCount = 23;
  const slatGeometry = new THREE.BoxGeometry(saungWidth, 0.18, slatDepth);
  const slatMaterials = [
    new THREE.MeshStandardMaterial({ color: 0x75401f, roughness: 0.84 }),
    new THREE.MeshStandardMaterial({ color: 0x8b5128, roughness: 0.82 }),
    new THREE.MeshStandardMaterial({ color: 0x663619, roughness: 0.86 }),
  ];
  for (let i = 0; i < slatCount; i++) {
    const slat = new THREE.Mesh(slatGeometry, slatMaterials[i % slatMaterials.length]);
    slat.position.set(0, -0.74, (i - (slatCount - 1) / 2) * slatDepth);
    slat.castShadow = true;
    slat.receiveShadow = true;
    saung.add(slat);
  }

  const darkWood = new THREE.MeshStandardMaterial({ color: 0x4a2815, roughness: 0.78 });
  const bamboo = new THREE.MeshStandardMaterial({ color: 0x987047, roughness: 0.76 });
  const postGeometry = new THREE.CylinderGeometry(0.2, 0.27, 7.8, 10);
  for (const x of [-postX, postX]) {
    for (const z of [-postZ, postZ]) {
      const post = new THREE.Mesh(postGeometry, darkWood);
      post.position.set(x, 3.25, z);
      post.castShadow = true;
      post.receiveShadow = true;
      saung.add(post);
    }
  }

  for (const z of [-postZ, postZ]) {
    const beam = new THREE.Mesh(new THREE.BoxGeometry(postX * 2 + 0.45, 0.3, 0.28), darkWood);
    beam.position.set(0, eaveY, z);
    beam.castShadow = true;
    saung.add(beam);
  }
  for (const x of [-postX, postX]) {
    const beam = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.3, postZ * 2), darkWood);
    beam.position.set(x, eaveY, 0);
    beam.castShadow = true;
    saung.add(beam);
  }

  const ridge = new THREE.Mesh(new THREE.BoxGeometry(postX * 2 + 0.8, 0.29, 0.32), darkWood);
  ridge.position.set(0, ridgeY, 0);
  ridge.castShadow = true;
  saung.add(ridge);

  for (const x of [-postX + 0.08, postX - 0.08]) {
    saung.add(makeRoundBeam(
      new THREE.Vector3(x, eaveY + 0.05, -postZ - 0.3),
      new THREE.Vector3(x, ridgeY, 0),
      0.12,
      bamboo
    ));
    saung.add(makeRoundBeam(
      new THREE.Vector3(x, ridgeY, 0),
      new THREE.Vector3(x, eaveY + 0.05, postZ + 0.3),
      0.12,
      bamboo
    ));
  }

  const rearRoof = new THREE.Mesh(
    new THREE.PlaneGeometry(saungWidth, postZ + 0.65),
    new THREE.MeshStandardMaterial({
      map: createThatchTexture(renderer),
      color: 0xc09558,
      roughness: 1,
      side: THREE.DoubleSide,
    })
  );
  rearRoof.position.set(0, (eaveY + ridgeY) / 2, -postZ / 2 - 0.12);
  rearRoof.rotation.x = Math.atan2(postZ + 0.25, ridgeY - eaveY);
  rearRoof.castShadow = true;
  rearRoof.receiveShadow = true;
  saung.add(rearRoof);

  const rearRailGeometry = new THREE.BoxGeometry(postX * 2 - 0.8, 0.14, 0.14);
  for (const y of [0.35, 1.28]) {
    const rail = new THREE.Mesh(rearRailGeometry, bamboo);
    rail.position.set(0, y, -postZ + 0.24);
    rail.castShadow = true;
    saung.add(rail);
  }
  for (let x = -12; x <= 12; x += 3) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.11, 1.75, 0.11), bamboo);
    rail.position.set(x, 0.42, -postZ + 0.24);
    rail.castShadow = true;
    saung.add(rail);
  }

  scene.add(saung);
}

export function createScene(container) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xa9d4df);
  scene.fog = new THREE.Fog(0xc4d2bc, 25, 68);

  const camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 100);
  camera.position.set(0, 8.2, 10.8);

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
  scene.add(new THREE.HemisphereLight(0xdff3ff, 0x665033, 1.05));
  const sun = new THREE.DirectionalLight(0xffe9bd, 1.65);
  sun.position.set(-7, 13, 8);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -12;
  sun.shadow.camera.right = 12;
  sun.shadow.camera.top = 10;
  sun.shadow.camera.bottom = -10;
  sun.shadow.bias = -0.0025;
  scene.add(sun);
  const fill = new THREE.PointLight(0xffc878, 0.32, 28);
  fill.position.set(5, 4, 4);
  scene.add(fill);

  // ---- Saung, sawah, dan panorama desa ----
  addVillageEnvironment(scene, renderer);

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
