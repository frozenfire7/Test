import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { mk, at, rot, toonMat, stoneTexture, grassTexture } from './toon.js';
import { LEVELS, ET, DIALOGUE } from './data.js';
import { buildHero, buildEnemy } from './models.js';
import * as W from './world.js';
import { sfx, music } from './audio.js';

const $ = (s) => document.querySelector(s);
const rnd = (a, b) => a + Math.random() * (b - a);
const dist2 = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const lerp = (a, b, k) => a + (b - a) * k;
const angDiff = (a, b) => Math.atan2(Math.sin(b - a), Math.cos(b - a));

// ---------- renderer ----------
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.prepend(renderer.domElement);

const scene = new THREE.Scene();
const BASE_FOV = 50;
const camera = new THREE.PerspectiveCamera(BASE_FOV, innerWidth / innerHeight, 0.1, 500);
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
composer.addPass(new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.45, 0.65, 0.88));
composer.addPass(new ShaderPass({
  uniforms: { tDiffuse: { value: null } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
  fragmentShader: `uniform sampler2D tDiffuse; varying vec2 vUv; void main(){
    vec4 c = texture2D(tDiffuse, vUv);
    float l = dot(c.rgb, vec3(0.299,0.587,0.114));
    c.rgb = mix(vec3(l), c.rgb, 1.12);               // vivid saturation
    c.rgb = (c.rgb - 0.5) * 1.06 + 0.5;
    float v = smoothstep(0.95, 0.35, distance(vUv, vec2(0.5)));
    c.rgb *= mix(0.74, 1.0, v);                      // soft vignette
    gl_FragColor = c; }`,
}));
composer.addPass(new OutputPass());
addEventListener('resize', () => {
  renderer.setSize(innerWidth, innerHeight);
  composer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
});

const hemi = new THREE.HemisphereLight(0xbfd8ff, 0x4a2f6b, 1.1);
const sun = new THREE.DirectionalLight(0xfff0d8, 2.2);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -28, right: 28, top: 28, bottom: -28, near: 1, far: 90 });
sun.shadow.bias = -0.0005;
scene.add(hemi, sun, sun.target);
const sky = W.makeSky();
scene.add(sky);
const motes = W.motes();
scene.add(motes);

// ---------- game state ----------
const G = {
  area: null, areaGroup: null, level: -1, wave: -1,
  enemies: [], projs: [], parts: [], pops: [], slashes: [],
  interactables: [], colliders: [], R: 30, falls: [],
  timeScale: 1, tactical: false, shake: 0, paused: true, cleared: false, dlg: false,
  hitstop: 0, fov: 0, kills: 0, near: null,
};
const P = {
  g: null, pos: new THREE.Vector3(), vel: new THREE.Vector3(), face: new THREE.Vector3(0, 0, 1),
  hp: 100, max: 100, mp: 100, maxMp: 100, lvl: 1, xp: 0, potions: 2,
  atk: null, combo: 0, lastAtk: -9, queued: null, dodgeT: 0, dodgeCd: 0, iframes: 0, dead: false,
  fire: 0, cd: { s1: 0, s2: 0, s3: 0 }, r: 0.5, hurtT: 0, time: 0, castT: 0, lock: null,
};
let camYaw = 0.6;
const keys = {};
const mouse = { l: false, r: false };

// ---------- HUD ----------
const SKILLS = [
  { id: 's1', key: '1', name: 'Flame', cost: 30, cd: 8 },
  { id: 's2', key: '2', name: 'Frost', cost: 35, cd: 6 },
  { id: 's3', key: '3', name: 'Arc', cost: 20, cd: 2.5 },
];

function say(text, ms = 2500) {
  const el = $('#prompt');
  el.textContent = text;
  clearTimeout(say.t);
  if (ms) say.t = setTimeout(() => { if (el.textContent === text) el.textContent = ''; }, ms);
}

const setCd = (id, pct) => $('#' + id + ' .cd').style.setProperty('--p', Math.max(0, Math.min(100, pct)));
function updateHud() {
  $('#hp i').style.width = (100 * Math.max(0, P.hp) / P.max) + '%';
  $('#mp i').style.width = (100 * P.mp / P.maxMp) + '%';
  $('#xp i').style.width = (100 * P.xp / (60 * P.lvl)) + '%';
  $('#lvl').textContent = `Lv ${P.lvl}   HP ${Math.max(0, Math.ceil(P.hp))}/${P.max}`;
  $('#potn').textContent = 'x' + P.potions;
  SKILLS.forEach((s) => {
    setCd('sk-' + s.id, (100 * P.cd[s.id]) / s.cd);
    $('#sk-' + s.id).classList.toggle('on', s.id === 's1' && P.fire > 0);
  });
  setCd('sk-dodge', (100 * P.dodgeCd) / 0.6);
  setCd('sk-pot', P.potions > 0 ? 0 : 100);
  const boss = G.enemies.find((e) => e.d.boss);
  const bd = $('#boss');
  if (boss && boss.rise <= 0) {
    bd.style.display = 'block';
    bd.querySelector('b').textContent = boss.d.name.toUpperCase();
    bd.querySelector('i').style.width = Math.max(0, 100 * boss.hp / boss.max) + '%';
  } else bd.style.display = 'none';
}

// ---------- minimap ----------
const mctx = $('#mini canvas').getContext('2d');
function drawMini() {
  const S = 160, c = mctx, sc = 2.6, s = Math.sin(camYaw), co = Math.cos(camYaw);
  c.clearRect(0, 0, S, S);
  c.save();
  c.beginPath(); c.arc(80, 80, 78, 0, 6.3); c.clip();
  c.fillStyle = G.area === 'hub' ? '#2c6b4acc' : '#1d1240cc';
  c.fillRect(0, 0, S, S);
  const toMap = (x, z) => {
    const dx = x - P.pos.x, dz = z - P.pos.z;
    return [80 + (dx * co - dz * s) * sc, 80 + (dx * s + dz * co) * sc];
  };
  const [cx, cy] = toMap(0, 0);
  c.strokeStyle = '#fff'; c.lineWidth = 2; c.beginPath(); c.arc(cx, cy, G.R * sc, 0, 6.3); c.stroke();
  c.fillStyle = G.area === 'hub' ? '#4fb877' : '#3a2a6a'; c.fill();
  for (const it of G.interactables) { const [x, y] = toMap(it.x, it.z); c.fillStyle = '#ffd66b'; c.beginPath(); c.arc(x, y, 5, 0, 6.3); c.fill(); }
  for (const e of G.enemies) {
    const [x, y] = toMap(e.pos.x, e.pos.z);
    c.fillStyle = e === P.lock ? '#ffd66b' : '#ff4f5e'; c.beginPath(); c.arc(x, y, e.d.boss ? 6 : 3.5, 0, 6.3); c.fill();
  }
  // player arrow (facing relative to camera)
  const a = Math.atan2(P.face.x * co - P.face.z * s, P.face.x * s + P.face.z * co);
  c.translate(80, 80); c.rotate(a);
  c.fillStyle = '#7df9ff'; c.strokeStyle = '#0b0618'; c.lineWidth = 2;
  c.beginPath(); c.moveTo(0, 8); c.lineTo(-6, -6); c.lineTo(6, -6); c.closePath(); c.fill(); c.stroke();
  c.restore();
}

// ---------- effects ----------
const partGeo = new THREE.SphereGeometry(1, 6, 5);
function burst(pos, color, n = 10, speed = 5, life = 0.5, size = 0.12, up = 2) {
  if (G.parts.length > 400) return;
  for (let i = 0; i < n; i++) {
    const m = new THREE.Mesh(partGeo, new THREE.MeshBasicMaterial({ color, transparent: true }));
    m.scale.setScalar(size * rnd(0.6, 1.4));
    m.position.copy(pos);
    scene.add(m);
    const a = rnd(0, 6.28);
    G.parts.push({ m, v: new THREE.Vector3(Math.cos(a) * rnd(0.3, 1) * speed, rnd(0, up) + 1, Math.sin(a) * rnd(0.3, 1) * speed), life, max: life });
  }
}

const slashGeo = new THREE.RingGeometry(0.4, 1, 24, 1, -1.0, 2.0);
function slashFx(pos, dir, color, scale = 3, dur = 0.22, tilt = 0) {
  const m = new THREE.Mesh(slashGeo, new THREE.MeshBasicMaterial({ color, transparent: true, side: THREE.DoubleSide, opacity: 0.9 }));
  m.rotation.x = -Math.PI / 2;
  const g = new THREE.Group();
  g.add(m);
  g.position.copy(pos).setY(1.2);
  g.rotation.set(0, Math.atan2(dir.x, dir.z) - Math.PI / 2, tilt, 'YXZ');
  g.scale.setScalar(scale * 0.6);
  scene.add(g);
  G.slashes.push({ g, m, life: dur, max: dur, scale });
}

function shockRing(pos, color, size, dur = 0.5) {
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.5, 1, 40), new THREE.MeshBasicMaterial({ color, transparent: true, side: THREE.DoubleSide, opacity: 0.8 }));
  ring.rotation.x = -Math.PI / 2; ring.position.copy(pos).setY(0.1);
  scene.add(ring);
  G.slashes.push({ g: ring, m: ring, life: dur, max: dur, scale: size, ring: true });
}

function popup(pos, text, color = '#fff', size = 20) {
  const el = document.createElement('div');
  el.className = 'pop';
  el.textContent = text;
  el.style.color = color;
  el.style.fontSize = size + 'px';
  document.body.appendChild(el);
  G.pops.push({ el, pos: pos.clone().setY(pos.y + 2.3).add(new THREE.Vector3(rnd(-0.5, 0.5), 0, 0)), life: 0.9, max: 0.9 });
}

const tmpV = new THREE.Vector3();
function toScreen(p, out) {
  tmpV.copy(p).project(camera);
  out.x = (tmpV.x * 0.5 + 0.5) * innerWidth;
  out.y = (-tmpV.y * 0.5 + 0.5) * innerHeight;
  out.vis = tmpV.z < 1;
}
const sp = {};

function setFlash(e, on) {
  e.g.traverse((o) => {
    if (!o.isMesh || !o.material.isMeshToonMaterial) return;
    if (on) { o.userData.pe = o.material.emissive.getHex(); o.userData.pi = o.material.emissiveIntensity; o.material.emissive.setHex(0xffffff); o.material.emissiveIntensity = 0.85; }
    else if (o.userData.pe !== undefined) { o.material.emissive.setHex(o.userData.pe); o.material.emissiveIntensity = o.userData.pi; }
  });
}

// ---------- area building ----------
function clearArea() {
  if (G.areaGroup) scene.remove(G.areaGroup);
  G.enemies.forEach((e) => { scene.remove(e.g); e.bar.remove(); clearTele(e); });
  G.projs.forEach((p) => scene.remove(p.m));
  G.enemies = []; G.projs = []; G.interactables = []; G.colliders = []; G.falls = []; G.fountain = null; G.rune = null;
  W.clouds.length = 0; W.waterMats.length = 0;
  P.lock = null;
  G.areaGroup = new THREE.Group();
  scene.add(G.areaGroup);
}

function ground(R, color, texA, texB) {
  const tex = stoneTexture(texA, texB);
  tex.repeat.set(R / 3, R / 3);
  const m = new THREE.Mesh(new THREE.CircleGeometry(R, 48), toonMat(color, { map: tex }, false));
  m.rotation.x = -Math.PI / 2;
  m.receiveShadow = true;
  G.areaGroup.add(m);
}

function runeCircle(r, color, x = 0, z = 0) {
  const ring = new THREE.Mesh(new THREE.RingGeometry(r - 0.2, r, 48), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85 }));
  ring.rotation.x = -Math.PI / 2; ring.position.set(x, 0.03, z);
  const ring2 = new THREE.Mesh(new THREE.RingGeometry(r * 0.6 - 0.1, r * 0.6, 6), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85 }));
  ring2.rotation.x = -Math.PI / 2; ring2.position.set(x, 0.035, z);
  G.areaGroup.add(ring, ring2);
  return ring2;
}

function addCollider(x, z, r) { G.colliders.push({ x, z, r }); }

function tower(x, z, h, color) {
  const g = new THREE.Group();
  g.add(at(mk(new THREE.CylinderGeometry(2, 2.3, h, 10), color), 0, h / 2, 0));
  g.add(at(mk(new THREE.ConeGeometry(2.8, 4.5, 10), 0x3a8ee8), 0, h + 2.2, 0));
  g.add(rot(at(mk(new THREE.TorusGeometry(2.1, 0.12, 6, 20), 0xffd66b), 0, h, 0), Math.PI / 2, 0, 0));
  for (let i = 0; i < 3; i++) g.add(at(mk(new THREE.BoxGeometry(0.6, 1.1, 0.2), 0xffe28a, { emissive: 0xffc95a, ei: 1.2, o: 0.03 }), 0, 3 + i * 3.4, 2.05));
  g.position.set(x, 0, z);
  G.areaGroup.add(g);
  addCollider(x, z, 2.4);
}

function pillar(x, z, color) {
  const g = new THREE.Group();
  g.add(at(mk(new THREE.CylinderGeometry(0.9, 1.1, 7, 8), color), 0, 3.5, 0));
  g.add(at(mk(new THREE.BoxGeometry(2.4, 0.6, 2.4), color), 0, 7, 0));
  g.position.set(x, 0, z);
  G.areaGroup.add(g);
  addCollider(x, z, 1.2);
}

function torch(x, z, color = 0xff9a4a) {
  const g = new THREE.Group();
  g.add(at(mk(new THREE.CylinderGeometry(0.12, 0.16, 1.6, 6), 0x3a2a4a), 0, 0.8, 0));
  g.add(at(mk(new THREE.SphereGeometry(0.28, 8, 6), color, { basic: true, o: 0.03 }), 0, 1.8, 0));
  g.position.set(x, 0, z);
  G.areaGroup.add(g);
}

function setEnv(hub, L) {
  sky.visible = hub;
  if (hub) {
    scene.background = null;
    scene.fog = new THREE.Fog(0xd2e8ff, 90, 330);
    hemi.color.set(0xbfe0ff); hemi.groundColor.set(0xffe2a8); hemi.intensity = 0.95;
    sun.color.set(0xffe2b0); sun.intensity = 1.5;
    motes.material.color.set(0xffe08a);
  } else {
    scene.background = new THREE.Color(L.sky);
    scene.fog = new THREE.Fog(L.sky, 25, 75);
    hemi.color.set(0xbfd8ff); hemi.groundColor.set(0x4a2f6b); hemi.intensity = 1.5;
    sun.color.set(0xfff0d8); sun.intensity = 1.2;
    motes.material.color.set(L.glow);
  }
}

function buildHub() {
  clearArea();
  G.area = 'hub'; G.level = -1; G.R = 36;
  setEnv(true);
  music('hub');
  const R = G.R, A = G.areaGroup;
  // floating main island: grass top, cliff side, rock underside
  const gt = grassTexture(); gt.repeat.set(7, 7);
  const top = new THREE.Mesh(new THREE.CircleGeometry(R, 56), toonMat(0x7cc468, { map: gt }, false));
  top.rotation.x = -Math.PI / 2; top.receiveShadow = true; A.add(top);
  A.add(at(mk(new THREE.CylinderGeometry(R, R * 0.97, 3, 56, 1, true), 0xc9b8a8, { o: 0.06 }), 0, -1.5, 0));
  const under = mk(new THREE.ConeGeometry(R * 0.97, R * 1.5, 24), 0x9a8aa8, { o: 0.08 });
  under.rotation.x = Math.PI; under.position.y = -3 - R * 0.75; A.add(under);
  for (let i = 0; i < 5; i++) { const a = i * 1.3; A.add(at(mk(new THREE.OctahedronGeometry(1.4 + i * 0.4), 0x9a8aa8), Math.cos(a) * 16, -R * 1.3 - i * 2, Math.sin(a) * 16)); }
  const rail = mk(new THREE.TorusGeometry(R - 1.2, 0.28, 6, 80), 0xf6f1ea, { o: 0.03 });
  rail.rotation.x = Math.PI / 2; rail.position.y = 0.8; A.add(rail);
  for (let i = 0; i < 36; i++) { const a = (i / 36) * 6.28; A.add(at(mk(new THREE.CylinderGeometry(0.25, 0.3, 0.9, 6), 0xf6f1ea, { o: 0.03 }), Math.cos(a) * (R - 1.2), 0.45, Math.sin(a) * (R - 1.2))); }
  // plaza
  const plaza = new THREE.Mesh(new THREE.CircleGeometry(14, 40), toonMat(0xeee6f6, { map: stoneTexture('#eee6f6', '#b9acd6') }, false));
  plaza.rotation.x = -Math.PI / 2; plaza.position.y = 0.02; plaza.receiveShadow = true; A.add(plaza);
  // academy keep + towers
  const keep = new THREE.Group();
  keep.add(at(mk(new THREE.BoxGeometry(18, 9, 5), 0xf6f1ea), 0, 4.5, 0));
  keep.add(rot(at(mk(new THREE.ConeGeometry(4.5, 7, 4), 0x3a8ee8), 0, 12.5, 0), 0, Math.PI / 4, 0));
  keep.add(at(mk(new THREE.BoxGeometry(5, 4, 0.4), 0xffe28a, { emissive: 0xffc95a, ei: 0.9, o: 0.03 }), 0, 6, 2.6));
  keep.position.set(0, 0, -26);
  A.add(keep);
  addCollider(-6, -26, 3.5); addCollider(0, -26, 3.5); addCollider(6, -26, 3.5);
  tower(-13, -24, 14, 0xf6f1ea); tower(13, -24, 14, 0xf6f1ea); tower(-24, -12, 10, 0xeee6f6); tower(24, -12, 10, 0xeee6f6);
  [[-18, -4], [18, -4], [-25, 8], [25, 8], [-14, 18], [14, 18]].forEach(([x, z], i) => { A.add(W.tree(x, z, 1.1, i % 2 ? 0x45cf5a : 0xff9fcb)); addCollider(x, z, 0.6); });
  // ruined colonnade on the south half
  for (let i = 0; i < 9; i++) {
    const a = 0.45 + i * 0.28, x = Math.cos(a) * 22, z = Math.sin(a) * 22;
    const col = W.column(6, i % 4 === 2); col.position.set(x, 0, z); A.add(col); addCollider(x, z, 0.9);
  }
  for (let i = 0; i < 9; i++) {
    const a = Math.PI - 0.45 - i * 0.28, x = Math.cos(a) * 22, z = Math.sin(a) * 22;
    const col = W.column(6, i % 4 === 1); col.position.set(x, 0, z); A.add(col); addCollider(x, z, 0.9);
  }
  // fountain
  const f = new THREE.Group();
  f.add(at(mk(new THREE.CylinderGeometry(2.6, 2.9, 0.8, 16), 0xe3d9f5), 0, 0.4, 0));
  f.add(at(mk(new THREE.CylinderGeometry(1.7, 1.7, 0.2, 16), 0x6bd6ff, { emissive: 0x2a9bdd, ei: 0.8 }), 0, 0.85, 0));
  f.add(at(mk(new THREE.OctahedronGeometry(0.8), 0x9ff3ff, { emissive: 0x6be8ff, ei: 1.5 }), 0, 2.4, 0));
  f.position.set(0, 0, 3); f.userData.crystal = f.children[2];
  A.add(f); G.fountain = f; addCollider(0, 3, 2.9);
  // undercroft gate
  const gate = new THREE.Group();
  gate.add(at(mk(new THREE.BoxGeometry(1, 5, 1), 0x6a5f8f), -2, 2.5, 0));
  gate.add(at(mk(new THREE.BoxGeometry(1, 5, 1), 0x6a5f8f), 2, 2.5, 0));
  gate.add(at(mk(new THREE.BoxGeometry(5.2, 1, 1.2), 0x6a5f8f), 0, 5.2, 0));
  const portal = at(mk(new THREE.PlaneGeometry(3, 4.6), 0xb64dff, { basic: true, o: 0, opacity: 0.8 }), 0, 2.4, 0);
  portal.material.side = THREE.DoubleSide; gate.add(portal);
  gate.position.set(0, 0, -16); A.add(gate);
  runeCircle(3, 0xb64dff, 0, -13);
  G.interactables.push({ x: 0, z: -14, r: 3.5, prompt: 'R — Descend into the Undercroft', act: () => loadDungeon(0) });
  // NPC
  const npc = buildEnemy('npc');
  npc.position.set(-6, 0, -6); npc.rotation.y = 0.8; A.add(npc); addCollider(-6, -6, 0.6);
  G.interactables.push({ x: -6, z: -6, r: 3, prompt: 'R — Speak with Headmistress Seraphine', act: () => openDialogue('intro') });
  [[-4, 12], [4, 12], [-8, -14], [8, -14]].forEach(([x, z]) => torch(x, z, 0xffd37a));
  // waterfalls spilling off the island edge
  for (const ang of [0.55, 2.75, -2.1]) {
    A.add(W.stream(ang, 24, R, 2.6));
    const wf = W.waterfall(ang, R, 50, 4.2); A.add(wf); G.falls.push(wf.userData.lip);
  }
  // neighbouring floating islands, bridges, distant castle, cloud sea
  const isl = [
    { x: 66, y: 2, z: -18, R: 15, ruin: true }, { x: -68, y: -2, z: 12, R: 13, trees: 7 },
    { x: -36, y: 5, z: -72, R: 18, ruin: true }, { x: 44, y: 9, z: -66, R: 11, trees: 3, top: 0x8ae070 },
  ];
  isl.forEach((o) => A.add(W.island(o)));
  const link = (a, ra, b, rb) => {
    const d = new THREE.Vector3(b.x - a.x, 0, b.z - a.z).normalize();
    A.add(W.bridge(new THREE.Vector3(a.x, a.y, a.z).addScaledVector(d, ra - 0.5), new THREE.Vector3(b.x, b.y, b.z).addScaledVector(d, -(rb - 0.5))));
  };
  link({ x: 0, y: 0, z: 0 }, R, isl[0], isl[0].R);
  link({ x: 0, y: 0, z: 0 }, R, isl[1], isl[1].R);
  link(isl[0], isl[0].R, isl[3], isl[3].R);
  const castle = W.castle(); castle.position.set(-30, 40, -200); castle.scale.setScalar(1.7); A.add(castle);
  for (let i = 0; i < 46; i++) { const a = Math.random() * 6.28, r = rnd(70, 220); A.add(W.cloud(Math.cos(a) * r, rnd(-36, -20), Math.sin(a) * r, rnd(5, 11))); }
  for (let i = 0; i < 22; i++) { const a = Math.random() * 6.28, r = rnd(100, 240); A.add(W.cloud(Math.cos(a) * r, rnd(8, 50), Math.sin(a) * r, rnd(4, 8))); }
  P.pos.set(0, 0, 14); camYaw = 0;
  $('#area').textContent = 'Aetherholt Academy — Sky Courtyard';
  $('#obj').textContent = 'Speak to the Headmistress, then enter the gate';
  snapCamera();
}

function loadDungeon(i) {
  clearArea();
  const L = LEVELS[i];
  G.area = 'dungeon'; G.level = i; G.wave = -1; G.cleared = false; G.R = L.R;
  setEnv(false, L);
  music('dungeon');
  ground(G.R, L.floor, L.texA, L.texB);
  const wall = new THREE.Mesh(new THREE.CylinderGeometry(G.R + 1, G.R + 1, 14, 40, 1, true), toonMat(L.wall, { side: THREE.BackSide, map: stoneTexture(L.texA, L.texB) }, false));
  wall.material.map.repeat.set(16, 3);
  wall.position.y = 7;
  G.areaGroup.add(wall);
  const cap = new THREE.Mesh(new THREE.CircleGeometry(G.R + 1, 40), toonMat(L.sky, {}, false));
  cap.rotation.x = Math.PI / 2; cap.position.y = 14;
  G.areaGroup.add(cap);
  G.rune = runeCircle(8, L.glow, 0, 0);
  const n = 8;
  for (let k = 0; k < n; k++) { const a = (k / n) * 6.28 + 0.4, d = G.R * 0.8; pillar(Math.cos(a) * d, Math.sin(a) * d, L.wall); }
  for (let k = 0; k < 6; k++) { const a = k * 1.05 + 0.2; torch(Math.cos(a) * (G.R - 2), Math.sin(a) * (G.R - 2), L.glow); }
  for (let k = 0; k < 9; k++) { const a = k * 0.7 + 0.1; G.areaGroup.add(W.crystal(Math.cos(a) * (G.R - 3.5), Math.sin(a) * (G.R - 3.5), L.glow, rnd(0.8, 1.6))); }
  const l1 = new THREE.PointLight(new THREE.Color(L.glow).lerp(new THREE.Color(0xffffff), 0.65), 90, 60, 1.4); l1.position.set(0, 7, 0);
  G.areaGroup.add(l1);
  P.pos.set(0, 0, G.R - 5);
  camYaw = 0;
  $('#area').textContent = L.name;
  snapCamera();
  showCard(L.card[0], L.card[1], L.card[2], () => nextWave());
}

function nextWave() {
  const L = LEVELS[G.level];
  G.wave++;
  if (G.wave >= L.waves.length) {
    G.cleared = true;
    const isLast = G.level === LEVELS.length - 1;
    const portal = at(mk(new THREE.CylinderGeometry(1.8, 1.8, 0.2, 24), 0xb64dff, { basic: true, o: 0, opacity: 0.85 }), 0, 0.15, 0);
    const beam = at(mk(new THREE.CylinderGeometry(1.4, 1.4, 9, 20, 1, true), 0xb64dff, { basic: true, o: 0, opacity: 0.35 }), 0, 4.5, 0);
    beam.material.side = THREE.DoubleSide;
    G.areaGroup.add(portal, beam);
    G.interactables.push({
      x: 0, z: 0, r: 3.2,
      prompt: isLast ? 'R — Break the summoning circle' : 'R — Descend deeper',
      act: () => { sfx.portal(); (isLast ? victory() : loadDungeon(G.level + 1)); },
    });
    $('#obj').textContent = 'Level cleared — step into the portal';
    say('The way down is open.');
    music('dungeon');
    return;
  }
  $('#obj').textContent = `Defeat the enemies (wave ${G.wave + 1}/${L.waves.length})`;
  const wave = L.waves[G.wave];
  wave.forEach((t, i) => {
    if (t === 'boss') { spawnEnemy('boss', 0, -12); return; }
    const a = (i / wave.length) * 6.28 + rnd(0, 1), d = rnd(9, G.R - 6);
    spawnEnemy(t, Math.cos(a) * d, Math.sin(a) * d);
  });
  if (!wave.includes('boss')) say(G.wave === 0 ? 'Something stirs in the dark...' : 'More are coming!');
}

function victory() {
  G.paused = true;
  music(null);
  $('#stats').textContent = `Level ${P.lvl} · ${G.kills} foes defeated · ${Math.round(P.time)}s`;
  $('#end').style.display = 'flex';
}

function showCard(a, b, c, cb) {
  const el = $('#card');
  el.querySelector('small').textContent = a;
  el.querySelector('h2').textContent = b;
  el.querySelector('p').textContent = c;
  el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
  G.paused = true; sfx.card();
  setTimeout(() => { el.classList.remove('show'); G.paused = false; cb?.(); }, 2300);
}

// ---------- enemies ----------
function spawnEnemy(type, x, z) {
  const d = ET[type];
  const g = buildEnemy(type);
  g.position.set(x, 0, z);
  scene.add(g);
  const bar = document.createElement('div');
  bar.className = 'eb';
  bar.innerHTML = '<i></i>';
  bar.style.display = 'none';
  if (!d.boss) document.body.appendChild(bar);
  const scale = 1 + 0.12 * Math.max(0, G.level);
  const e = {
    type, d, g, bar, hp: d.hp * scale, max: d.hp * scale, dmg: d.dmg * scale,
    pos: g.position, vel: new THREE.Vector3(), state: 'idle', t: 0, cd: rnd(0.5, 1.5), stun: 0, slow: 0, burn: 0, flash: 0,
    tele: null, special: rnd(3, 5), summoned: false, bob: rnd(0, 6), dead: false, face: new THREE.Vector3(0, 0, 1), rise: 0,
  };
  if (d.boss) {
    e.rise = 2.6; e.pos.y = -7; e.state = 'chase';
    sfx.rumble(); music('boss'); say('The Ancient Guardian Golem awakens!', 4000);
  }
  G.enemies.push(e);
  burst(new THREE.Vector3(x, 0.5, z), d.boss ? 0xb9ad9a : 0xb64dff, 12, 4, 0.6);
  return e;
}

function hitPlayer(dmg, from, knock = 4) {
  if (P.dead || P.iframes > 0) return false;
  P.hp -= dmg;
  P.hurtT = 0.3;
  P.iframes = 0.5;
  P.atk = null; P.queued = null;
  tmpV.copy(P.pos).sub(from).setY(0).normalize();
  P.vel.addScaledVector(tmpV, knock * 2.5);
  G.shake = 0.35; G.hitstop = 0.06;
  sfx.hurt();
  $('#flash').style.opacity = 0.45;
  setTimeout(() => ($('#flash').style.opacity = 0), 140);
  popup(P.pos, Math.round(dmg), '#ff6b8a', 24);
  burst(P.pos.clone().setY(1.2), 0xff4f7b, 8, 4, 0.4);
  if (P.hp <= 0) die();
  return true;
}

function enemyShoot(e, speed, dmg, spread = 0) {
  tmpV.copy(P.pos).sub(e.pos).setY(0).normalize();
  const a = Math.atan2(tmpV.x, tmpV.z) + spread;
  const m = mk(new THREE.SphereGeometry(0.35, 8, 6), 0xff5ce1, { basic: true, o: 0.03 });
  m.position.copy(e.pos).setY(1.3);
  scene.add(m);
  G.projs.push({ m, v: new THREE.Vector3(Math.sin(a) * speed, 0, Math.cos(a) * speed), dmg, life: 4, enemy: true, r: 0.6 });
}

function updateEnemy(e, dt) {
  const d = e.d;
  e.bob += dt * 4;
  if (e.flash > 0) { e.flash -= dt; if (e.flash <= 0) setFlash(e, false); }
  if (e.g.userData.orbit) e.g.userData.orbit.forEach((rk, i) => {
    const a = e.bob * 0.25 + i * 1.57;
    rk.position.set(Math.cos(a) * 3.6, 3.9 + Math.sin(a * 2) * 0.4, Math.sin(a) * 3.6);
    rk.rotation.y += dt * 2;
  });
  if (e.rise > 0) {
    e.rise -= dt;
    const k = Math.max(0, e.rise / 2.6);
    e.pos.y = -7 * k * k;
    G.shake = Math.max(G.shake, 0.25);
    if (Math.random() < dt * 25) burst(new THREE.Vector3(e.pos.x + rnd(-2, 2), 0.2, e.pos.z + rnd(-2, 2)), 0xcfc4b0, 2, 4, 0.7, 0.22);
    if (e.rise <= 0) { e.pos.y = 0; P.lock = e; sfx.hit(true); burst(new THREE.Vector3(e.pos.x, 0.3, e.pos.z), 0xffd66b, 30, 9, 0.7, 0.2); }
    return;
  }
  if (e.burn > 0) { e.burn -= dt; damageEnemy(e, 6 * dt, { silent: true }); if (Math.random() < dt * 10) burst(e.pos.clone().setY(1), 0xff8a2a, 1, 1, 0.4, 0.1); }
  if (e.slow > 0) e.slow -= dt;
  if (e.stun > 0) { e.stun -= dt; e.pos.addScaledVector(e.vel, dt); e.vel.multiplyScalar(0.88); resolve(e.pos, d.r); return; }
  const to = tmpV.copy(P.pos).sub(e.pos).setY(0);
  const dist = to.length();
  to.normalize();
  const spd = d.spd * (e.slow > 0 ? 0.4 : 1);
  if (e.state === 'idle') {
    if (dist < 16) e.state = 'chase';
  } else if (e.state === 'chase') {
    e.cd -= dt;
    e.face.copy(to);
    const want = d.ranged ? d.keep : d.range * 0.8;
    if (dist > want) e.pos.addScaledVector(to, spd * dt);
    else if (d.ranged && dist < want - 2) e.pos.addScaledVector(to, -spd * dt);
    if (d.boss) {
      e.special -= dt;
      if (e.hp < e.max * 0.5 && !e.summoned) {
        e.summoned = true;
        for (let i = 0; i < 3; i++) spawnEnemy('wisp', e.pos.x + rnd(-5, 5), e.pos.z + rnd(-5, 5));
        say('The Guardian calls for aid!');
      }
      if (e.special <= 0) {
        e.special = 6;
        if (Math.random() < 0.5) { e.state = 'slam'; e.t = 1.2; makeTele(e, 6.5); }
        else for (let k = -2; k <= 2; k++) enemyShoot(e, 9, e.dmg * 0.5, k * 0.22);
      }
    }
    if (e.state === 'chase') {
      if (d.ranged) {
        if (e.cd <= 0 && dist < 18) { e.cd = d.cd; enemyShoot(e, 11, e.dmg); }
      } else if (dist < d.range && e.cd <= 0) {
        e.state = 'wind'; e.t = d.wind; makeTele(e, d.range + 0.6);
      }
    }
  } else if (e.state === 'wind') {
    e.t -= dt;
    e.face.copy(to);
    if (e.t <= 0) {
      clearTele(e);
      if (dist < d.range + 0.9) hitPlayer(e.dmg, e.pos, d.heavy ? 6 : 3);
      burst(e.pos.clone().add(e.face.clone().multiplyScalar(1.5)).setY(1), 0xffffff, 6, 3, 0.25);
      e.state = 'chase'; e.cd = d.cd;
    }
  } else if (e.state === 'slam') {
    e.t -= dt;
    if (e.t <= 0) {
      clearTele(e);
      if (dist < 6.5) hitPlayer(e.dmg * 1.4, e.pos, 8);
      burst(e.pos.clone().setY(0.3), 0xcfc4b0, 30, 9, 0.6, 0.2);
      shockRing(e.pos, 0xffd66b, 7, 0.5);
      G.shake = 0.7; sfx.hit(true);
      e.state = 'chase'; e.cd = 1.2;
    }
  }
  for (const o of G.enemies) if (o !== e && o.rise <= 0) {
    const dx = e.pos.x - o.pos.x, dz = e.pos.z - o.pos.z, m = Math.hypot(dx, dz), min = d.r + o.d.r;
    if (m < min && m > 0.001) { e.pos.x += (dx / m) * (min - m) * 0.5; e.pos.z += (dz / m) * (min - m) * 0.5; }
  }
  e.pos.y = d.fly ? 0.9 + Math.sin(e.bob) * 0.25 : 0;
  resolve(e.pos, d.r);
  e.g.rotation.y = Math.atan2(e.face.x, e.face.z);
  if (!d.fly) e.g.scale.y = 1 + Math.sin(e.bob * 1.5) * 0.02;
}

function makeTele(e, r) {
  clearTele(e);
  const m = new THREE.Mesh(new THREE.CircleGeometry(r, 32), new THREE.MeshBasicMaterial({ color: 0xff2a4a, transparent: true, opacity: 0.35 }));
  m.rotation.x = -Math.PI / 2; m.position.set(e.pos.x, 0.05, e.pos.z);
  scene.add(m); e.tele = m;
}
function clearTele(e) { if (e.tele) { scene.remove(e.tele); e.tele = null; } }

function damageEnemy(e, base, o = {}) {
  if (e.dead || e.rise > 0) return;
  let dmg = base, tag = '', color = '#fff', size = 22;
  if (!o.silent) {
    const roll = 1 + Math.floor(Math.random() * 20); // d20, Baldur's Gate style
    if (roll >= 19) { dmg *= 2; tag = roll === 20 ? ' NAT 20!' : ' CRIT'; color = '#ffd66b'; size = 34; }
    else if (roll <= 2) { dmg *= 0.6; tag = ' glance'; color = '#9ab'; size = 16; }
    popup(e.pos.clone().setY(e.pos.y + (e.d.h || 0) * 0.4), Math.round(dmg) + tag, color, size);
    G.hitstop = Math.max(G.hitstop, o.heavy ? 0.1 : 0.05);
    G.fov = Math.max(G.fov, o.heavy ? 7 : 3);
    sfx.hit(o.heavy);
    if (e.flash <= 0) setFlash(e, true);
    e.flash = 0.09;
  }
  e.hp -= dmg;
  e.bar.style.display = 'block';
  e.bar.firstChild.style.width = Math.max(0, 100 * e.hp / e.max) + '%';
  if (o.knock && !e.d.boss) { e.stun = o.stun ?? 0.3; e.vel.copy(o.knock); }
  if (e.hp <= 0) killEnemy(e);
}

function killEnemy(e) {
  e.dead = true;
  clearTele(e);
  burst(e.pos.clone().setY(1), e.d.boss ? 0xffd66b : 0xb64dff, e.d.boss ? 60 : 22, 6, 0.9, 0.16);
  if (e.d.boss) { shockRing(e.pos, 0xffd66b, 14, 1); G.shake = 1; G.hitstop = 0.25; }
  scene.remove(e.g); e.bar.remove();
  G.enemies.splice(G.enemies.indexOf(e), 1);
  G.kills++; sfx.kill();
  gainXp(e.d.xp);
  if (P.lock === e) P.lock = G.enemies.find((o) => o.rise <= 0 && dist2(P.pos, o.pos) < 20) || null;
  if (Math.random() < 0.12 || e.d.boss) { P.potions++; popup(e.pos, '+ potion', '#9ff', 18); }
  P.mp = Math.min(P.maxMp, P.mp + 8);
  if (G.area === 'dungeon' && !G.enemies.length && !G.cleared) setTimeout(nextWave, 1200);
}

function gainXp(n) {
  P.xp += n;
  while (P.xp >= 60 * P.lvl) {
    P.xp -= 60 * P.lvl; P.lvl++;
    P.max += 15; P.maxMp += 8; P.hp = P.max; P.mp = P.maxMp;
    popup(P.pos, 'LEVEL UP!', '#ffd66b', 32);
    burst(P.pos.clone().setY(1), 0xffd66b, 30, 6, 1);
    sfx.levelup();
  }
}

// ---------- player ----------
const dmgMul = () => 1 + 0.12 * (P.lvl - 1);

function nearestEnemy(range, from = P.pos) {
  let best = null, bd = range;
  for (const e of G.enemies) { if (e.rise > 0) continue; const d = dist2(from, e.pos); if (d < bd) { bd = d; best = e; } }
  return best;
}
const aimTarget = (range) => (P.lock && !P.lock.dead ? P.lock : nearestEnemy(range));

function toggleLock() {
  if (P.lock) { P.lock = null; return; }
  P.lock = nearestEnemy(22);
  if (P.lock) sfx.dodge();
}

// weapon pose per attack: W = wind-up angle, E = end angle of the strike (radians about the chest pivot)
const ATK = {
  l0: { dur: 0.44, hit: 0.22, dmg: 13, range: 3.4, arc: 1.25, W: -2.7, E: -0.5, roll: 0.5, lunge: 7 },
  l1: { dur: 0.46, hit: 0.22, dmg: 13, range: 3.4, arc: 1.25, W: -2.3, E: 0.4, roll: -0.7, lunge: 7 },
  l2: { dur: 0.64, hit: 0.34, dmg: 24, range: 3.7, arc: 1.5, W: 2.3, E: 5.78, roll: 0, lunge: 10 },
  heavy: { dur: 1.0, hit: 0.62, dmg: 45, range: 4.1, arc: 1.7, W: 2.7, E: 5.78, roll: 0, lunge: 9 },
};

function startAttack(kind) {
  if (P.dead || G.dlg || G.paused || P.dodgeT > 0) return;
  if (P.atk) { if (P.atk.t > P.atk.dur * 0.45) P.queued = kind; return; }
  const t = P.time;
  P.combo = t - P.lastAtk < 0.9 ? (P.combo + 1) % 3 : 0;
  const tgt = aimTarget(7);
  if (tgt) P.face.copy(tmpV.copy(tgt.pos).sub(P.pos).setY(0).normalize());
  const heavy = kind === 'heavy';
  const def = ATK[heavy ? 'heavy' : 'l' + P.combo];
  P.atk = { ...def, kind, t: 0, done: false };
  P.lastAtk = t;
  sfx.swing(heavy || P.combo === 2);
  P.vel.addScaledVector(P.face, def.lunge);
}

function applyAttackHit(a) {
  const col = P.fire > 0 ? 0xff8a2a : 0x7df9ff;
  slashFx(P.pos, P.face, col, a.range * 0.95, 0.26, a.roll * 0.5);
  const heavy = a.kind === 'heavy' || a.dmg > 20;
  if (heavy) { shockRing(tmpV.copy(P.pos).addScaledVector(P.face, 2.2), col, 3.2, 0.35); P.g.scale.set(1.08, 0.9, 1.08); }
  let hit = 0;
  for (const e of [...G.enemies]) {
    tmpV.copy(e.pos).sub(P.pos).setY(0);
    const d = tmpV.length();
    if (d > a.range + e.d.r) continue;
    tmpV.normalize();
    if (Math.acos(Math.min(1, tmpV.dot(P.face))) > a.arc) continue;
    hit++;
    damageEnemy(e, a.dmg * dmgMul() * (P.fire > 0 ? 1.5 : 1), { knock: tmpV.clone().multiplyScalar(heavy ? 9 : 4), stun: heavy ? 0.6 : 0.25, heavy });
    if (P.fire > 0) e.burn = 3;
    burst(e.pos.clone().setY(1.1 + e.pos.y), col, 8, 5, 0.3);
  }
  if (hit) { G.shake = heavy ? 0.4 : 0.14; P.mp = Math.min(P.maxMp, P.mp + 3 * hit); }
}

function cast(id) {
  const s = SKILLS.find((x) => x.id === id);
  if (P.dead || G.dlg || G.paused || P.cd[id] > 0 || P.mp < s.cost) { if (P.mp < s.cost && !G.paused) say('Not enough mana', 1000); return; }
  P.mp -= s.cost; P.cd[id] = s.cd;
  const tgt = aimTarget(14);
  if (tgt) P.face.copy(tmpV.copy(tgt.pos).sub(P.pos).setY(0).normalize());
  P.castT = 0.3;
  if (id === 's1') {
    P.fire = 15; sfx.flame();
    burst(P.pos.clone().setY(1), 0xff8a2a, 24, 5, 0.7);
    shockRing(P.pos, 0xff8a2a, 4, 0.4);
    popup(P.pos, 'Flame Edge', '#ff9a4a', 22);
  } else if (id === 's2') {
    sfx.frost();
    burst(P.pos.clone().setY(0.4), 0x9fe8ff, 40, 12, 0.7, 0.18, 0.5);
    shockRing(P.pos, 0x9fe8ff, 8, 0.5);
    for (const e of [...G.enemies]) if (dist2(P.pos, e.pos) < 8) {
      tmpV.copy(e.pos).sub(P.pos).setY(0).normalize();
      damageEnemy(e, 26 * dmgMul(), { knock: tmpV.clone().multiplyScalar(7), stun: 0.4 });
      e.slow = 4;
    }
    G.shake = 0.3;
  } else if (id === 's3') {
    sfx.arc();
    const m = mk(new THREE.OctahedronGeometry(0.4), 0x7df9ff, { basic: true, o: 0.03 });
    m.position.copy(P.pos).setY(1.3);
    scene.add(m);
    G.projs.push({ m, v: P.face.clone().multiplyScalar(22), dmg: 30 * dmgMul(), life: 1.2, enemy: false, r: 0.9, hit: new Set(), pierce: true });
  }
}

function drinkPotion() {
  if (P.dead || G.paused || P.potions <= 0 || P.hp >= P.max) return;
  P.potions--; P.hp = Math.min(P.max, P.hp + 45);
  sfx.potion();
  popup(P.pos, '+45', '#7dffa5', 24);
  burst(P.pos.clone().setY(1), 0x7dffa5, 12, 3, 0.6);
}

function dodge() {
  if (P.dead || G.dlg || G.paused || P.dodgeCd > 0) return;
  const dir = inputDir();
  if (dir.lengthSq() === 0) dir.copy(P.face).negate();
  dir.normalize();
  P.vel.copy(dir).multiplyScalar(17);
  P.dodgeT = 0.26; P.dodgeCd = 0.6; P.iframes = Math.max(P.iframes, 0.38);
  P.atk = null; P.queued = null;
  P.g.scale.set(0.9, 0.82, 1.25);
  sfx.dodge();
  burst(P.pos.clone().setY(0.5), 0x7df9ff, 8, 3, 0.4);
}

function die() {
  P.dead = true;
  P.lock = null;
  music(null);
  setTimeout(() => { $('#over').style.display = 'flex'; G.paused = true; }, 1200);
}
function respawn(toHub) {
  $('#over').style.display = 'none';
  G.paused = false;
  P.dead = false; P.hp = P.max; P.mp = P.maxMp; P.vel.set(0, 0, 0); P.iframes = 1;
  if (toHub || G.area !== 'dungeon') buildHub(); else loadDungeon(G.level);
}

function inputDir() {
  const s = Math.sin(camYaw), c = Math.cos(camYaw);
  const f = (keys.w ? 1 : 0) - (keys.s ? 1 : 0), r = (keys.d ? 1 : 0) - (keys.a ? 1 : 0);
  return new THREE.Vector3(-s * f + c * r, 0, -c * f - s * r);
}

function resolve(pos, r) {
  const d = Math.hypot(pos.x, pos.z), lim = G.R - 1 - r;
  if (d > lim) { pos.x *= lim / d; pos.z *= lim / d; }
  for (const c of G.colliders) {
    const dx = pos.x - c.x, dz = pos.z - c.z, m = Math.hypot(dx, dz), min = c.r + r;
    if (m < min && m > 0.0001) { pos.x = c.x + (dx / m) * min; pos.z = c.z + (dz / m) * min; }
  }
}

function updatePlayer(dt) {
  P.time += dt;
  P.iframes -= dt; P.hurtT -= dt; P.dodgeCd -= dt; P.fire -= dt; P.castT -= dt;
  for (const k in P.cd) P.cd[k] -= dt;
  P.mp = Math.min(P.maxMp, P.mp + 2.2 * dt);
  const g = P.g, ud = g.userData;
  g.scale.lerp(tmpV.set(1, 1, 1), Math.min(1, dt * 10));
  if (P.dead) { g.rotation.x = lerp(g.rotation.x, -1.5, Math.min(1, dt * 5)); return; }
  g.rotation.x = 0;
  const dir = inputDir();
  const busy = !!P.atk || G.dlg;
  if (P.dodgeT > 0) {
    P.dodgeT -= dt;
  } else {
    const speed = busy ? 1.6 : 6.8;
    if (dir.lengthSq() > 0 && !G.dlg) {
      dir.normalize();
      P.vel.x += (dir.x * speed - P.vel.x) * Math.min(1, dt * 12);
      P.vel.z += (dir.z * speed - P.vel.z) * Math.min(1, dt * 12);
      if (!P.atk && !(P.lock && !P.lock.dead)) P.face.lerp(dir, Math.min(1, dt * 14)).normalize();
    } else P.vel.multiplyScalar(Math.max(0, 1 - dt * 10));
    if (P.lock && !P.lock.dead && !P.atk) {
      tmpV.copy(P.lock.pos).sub(P.pos).setY(0).normalize();
      P.face.lerp(tmpV, Math.min(1, dt * 12)).normalize();
    }
  }
  let atkK = 0;
  if (P.atk) {
    const a = P.atk;
    a.t += dt;
    if (!a.done && a.t >= a.hit) { a.done = true; applyAttackHit(a); }
    atkK = a.t / a.dur;
    if (a.t >= a.dur) {
      P.atk = null;
      if (P.queued) { const q = P.queued; P.queued = null; startAttack(q); }
    }
  }
  P.pos.addScaledVector(P.vel, dt);
  resolve(P.pos, P.r);

  // pose: wind-up (anticipation) -> fast strike -> follow-through
  g.position.copy(P.pos);
  g.rotation.y = Math.atan2(P.face.x, P.face.z);
  const arm = ud.arm, moving = P.vel.lengthSq() > 4 && P.dodgeT <= 0;
  let lean = 0;
  if (P.atk) {
    const a = P.atk, tw = a.hit - 0.09, ts = a.hit + 0.07, t = a.t;
    let th;
    if (t < tw) { const k = t / tw; th = lerp(-0.5, a.W, 1 - (1 - k) * (1 - k)); lean = -0.28 * k; }
    else if (t < ts) { const k = (t - tw) / (ts - tw); th = lerp(a.W, a.E, Math.pow(k, 1.4)); lean = lerp(-0.28, 0.42, k); }
    else { const k = Math.min(1, (t - ts) / Math.max(0.01, a.dur - ts)); th = a.E > 3 ? a.E : lerp(a.E, -0.5, k); lean = lerp(0.42, 0, k); }
    arm.rotation.x = th;
    arm.rotation.z = a.roll * Math.sin(Math.min(1, atkK) * Math.PI);
  } else {
    if (arm.rotation.x > 3) arm.rotation.x -= Math.PI * 2;
    const target = P.castT > 0 ? -2.4 : -0.5;
    arm.rotation.x = lerp(arm.rotation.x, target, Math.min(1, dt * 14));
    arm.rotation.z = lerp(arm.rotation.z, 0, Math.min(1, dt * 14));
  }
  ud.body.rotation.x = lerp(ud.body.rotation.x, lean + (P.dodgeT > 0 ? 0.5 : moving ? 0.1 : 0), Math.min(1, dt * 18));
  ud.body.position.y = moving ? Math.abs(Math.sin(P.time * 11)) * 0.08 : Math.sin(P.time * 2) * 0.025;
  const sw = moving ? Math.sin(P.time * 11) * 0.8 : 0;
  ud.legs[0].rotation.x = lerp(ud.legs[0].rotation.x, sw, Math.min(1, dt * 20));
  ud.legs[1].rotation.x = lerp(ud.legs[1].rotation.x, -sw, Math.min(1, dt * 20));
  const sf = Math.min(1, P.vel.length() / 7);
  ud.cape.forEach((seg, i) => {
    seg.rotation.x = 0.12 + sf * 0.45 + (P.atk ? 0.3 : 0) + Math.sin(P.time * 6 - i * 0.9) * 0.1 * (0.4 + sf);
  });
  ud.blade.material.color.setHex(P.fire > 0 ? 0xff8a2a : 0x7df9ff);
  g.visible = !(P.iframes > 0 && P.hurtT > 0 && Math.floor(P.time * 30) % 2);
  if (P.fire > 0 && Math.random() < dt * 25) burst(P.pos.clone().add(new THREE.Vector3(rnd(-0.5, 0.5), rnd(0.8, 2.6), rnd(-0.5, 0.5))), 0xff8a2a, 1, 1.5, 0.4, 0.09);
}

// ---------- dialogue ----------
function openDialogue(id) {
  const n = DIALOGUE[id];
  G.dlg = true;
  const el = $('#dlg');
  el.style.display = 'block';
  el.innerHTML = `<h4>${n.who}</h4><p>${n.text}</p>` +
    n.choices.map((c, i) => `<button data-i="${i}">${c.label}</button>`).join('');
  el.querySelectorAll('button').forEach((b) => (b.onclick = () => {
    const c = n.choices[+b.dataset.i];
    if (c.give === 'potion') { P.potions += 2; say('Received 2 healing draughts.'); sfx.potion(); }
    if (c.next) openDialogue(c.next); else { G.dlg = false; el.style.display = 'none'; }
  }));
}

// ---------- camera ----------
const camGoal = new THREE.Vector3();
function camTarget(shake = 0) {
  const d = G.camD || 12, h = G.camH || 6.5;
  return camGoal.set(P.pos.x + Math.sin(camYaw) * d + rnd(-1, 1) * shake, h + rnd(-1, 1) * shake, P.pos.z + Math.cos(camYaw) * d);
}
function snapCamera() {
  camera.position.copy(camTarget());
  camera.lookAt(P.pos.x, 2.2, P.pos.z);
}

// ---------- main loop ----------
function interactCheck() {
  let near = null;
  if (!G.dlg && !P.dead) for (const it of G.interactables) if (Math.hypot(P.pos.x - it.x, P.pos.z - it.z) < it.r) near = it;
  G.near = near;
  if (near) $('#prompt').textContent = near.prompt;
  else if ($('#prompt').textContent.startsWith('R —')) $('#prompt').textContent = '';
}

const clock = new THREE.Clock();
let totalT = 0;
function frame() {
  requestAnimationFrame(frame);
  const real = Math.min(clock.getDelta(), 0.05);
  totalT += real;
  sky.position.copy(camera.position);
  if (G.paused) { composer.render(); return; }
  G.hitstop = Math.max(0, G.hitstop - real);
  const dt = real * G.timeScale * (G.hitstop > 0 ? 0.04 : 1);

  updatePlayer(dt);
  G.enemies.slice().forEach((e) => updateEnemy(e, dt));

  for (const p of [...G.projs]) {
    p.m.position.addScaledVector(p.v, dt);
    p.life -= dt;
    p.m.rotation.y += dt * 8;
    if (p.life <= 0 || Math.hypot(p.m.position.x, p.m.position.z) > G.R) { scene.remove(p.m); G.projs.splice(G.projs.indexOf(p), 1); continue; }
    if (p.enemy) {
      if (Math.hypot(p.m.position.x - P.pos.x, p.m.position.z - P.pos.z) < p.r && hitPlayer(p.dmg, p.m.position, 3)) { scene.remove(p.m); G.projs.splice(G.projs.indexOf(p), 1); }
    } else {
      for (const e of [...G.enemies]) if (!p.hit.has(e) && Math.hypot(p.m.position.x - e.pos.x, p.m.position.z - e.pos.z) < p.r + e.d.r) {
        p.hit.add(e); damageEnemy(e, p.dmg, { knock: p.v.clone().normalize().multiplyScalar(4) });
        burst(p.m.position, 0x7df9ff, 8, 4, 0.3);
      }
    }
    if (Math.random() < dt * 40) burst(p.m.position, p.enemy ? 0xff5ce1 : 0x7df9ff, 1, 0.5, 0.3, 0.1);
  }
  for (const s of [...G.slashes]) {
    s.life -= dt;
    const k = 1 - s.life / s.max;
    s.g.scale.setScalar(s.ring ? 1 + k * s.scale : s.scale * (0.6 + k * 0.5));
    s.m.material.opacity = Math.max(0, 0.9 * (1 - k));
    if (s.life <= 0) { scene.remove(s.g); G.slashes.splice(G.slashes.indexOf(s), 1); }
  }
  for (const p of [...G.parts]) {
    p.life -= dt; p.v.y -= 9 * dt;
    p.m.position.addScaledVector(p.v, dt);
    p.m.material.opacity = Math.max(0, p.life / p.max);
    if (p.life <= 0) { scene.remove(p.m); p.m.material.dispose(); G.parts.splice(G.parts.indexOf(p), 1); }
  }
  for (const p of [...G.pops]) {
    p.life -= real; p.pos.y += real * 1.2;
    toScreen(p.pos, sp);
    p.el.style.left = sp.x + 'px'; p.el.style.top = sp.y + 'px';
    p.el.style.opacity = Math.min(1, p.life / 0.4);
    p.el.style.transform = `translate(-50%,-50%) scale(${1 + Math.max(0, p.life - 0.7) * 3})`;
    if (p.life <= 0) { p.el.remove(); G.pops.splice(G.pops.indexOf(p), 1); }
  }
  for (const e of G.enemies) if (e.bar.style.display !== 'none' && !e.d.boss) {
    toScreen(tmpV.copy(e.pos).setY(e.d.fly ? 2.2 : e.d.h || 2.4), sp);
    e.bar.style.left = sp.x + 'px'; e.bar.style.top = sp.y + 'px';
  }

  // lock-on reticle
  const rt = $('#reticle');
  if (P.lock && !P.lock.dead && !P.dead) {
    toScreen(tmpV.copy(P.lock.pos).setY(P.lock.pos.y + (P.lock.d.h ? P.lock.d.h * 0.45 : 1.3)), sp);
    rt.style.display = sp.vis ? 'block' : 'none'; rt.style.left = sp.x + 'px'; rt.style.top = sp.y + 'px';
  } else rt.style.display = 'none';

  // ambient
  W.updateWorld(totalT, dt);
  if (G.fountain) { const c = G.fountain.userData.crystal; c.rotation.y += dt; c.position.y = 2.4 + Math.sin(totalT * 2) * 0.2; }
  if (G.rune) G.rune.rotation.z += dt * 0.4;
  if (G.area === 'hub' && Math.random() < dt * 30 && G.falls.length) {
    const l = G.falls[Math.floor(Math.random() * G.falls.length)];
    burst(new THREE.Vector3(l.x + rnd(-1, 1), 0.6, l.z + rnd(-1, 1)), 0xffffff, 1, 1.5, 0.6, 0.12);
  }
  motes.position.set(P.pos.x, 0, P.pos.z);
  const mp = motes.geometry.attributes.position;
  for (let i = 0; i < mp.count; i++) { let y = mp.getY(i) + dt * 0.5; if (y > 16) y = 0; mp.setY(i, y); }
  mp.needsUpdate = true;
  interactCheck();

  // camera: follow, lock-on assist, FOV kick on hits
  G.shake = Math.max(0, G.shake - real * 1.5);
  if (P.lock && !P.lock.dead && !keys.q && !keys.e) {
    const want = Math.atan2(P.pos.x - P.lock.pos.x, P.pos.z - P.lock.pos.z);
    camYaw += angDiff(camYaw, want) * Math.min(1, real * 2.2);
  }
  camera.position.lerp(camTarget(G.shake), Math.min(1, real * 8));
  camera.lookAt(P.pos.x, 2.2, P.pos.z);
  if (keys.q || keys.arrowleft || touchCam < 0) camYaw -= real * 2;
  if (keys.e || keys.arrowright || touchCam > 0) camYaw += real * 2;
  G.fov = Math.max(0, G.fov - real * 25);
  camera.fov = BASE_FOV + G.fov;
  camera.updateProjectionMatrix();
  sun.position.set(P.pos.x + 18, 30, P.pos.z + 12);
  sun.target.position.copy(P.pos);

  if (mouse.l) startAttack('light');
  if (mouse.r) startAttack('heavy');
  updateHud();
  drawMini();
  composer.render();
}

// ---------- input ----------
let touchCam = 0;
addEventListener('keydown', (e) => {
  const k = e.key.toLowerCase();
  keys[k] = true;
  if (e.repeat || G.paused) return;
  if (k === ' ') { e.preventDefault(); dodge(); }
  else if (k === 'j') startAttack('light');
  else if (k === 'k') startAttack('heavy');
  else if (k === '1') cast('s1');
  else if (k === '2') cast('s2');
  else if (k === '3') cast('s3');
  else if (k === 'f') drinkPotion();
  else if (k === 't') toggleLock();
  else if (k === 'r' && G.near && !G.dlg) G.near.act();
  else if (k === 'tab') {
    e.preventDefault();
    G.tactical = !G.tactical;
    G.timeScale = G.tactical ? 0.12 : 1;
    $('#tact').style.opacity = G.tactical ? 1 : 0;
  }
});
addEventListener('keyup', (e) => { keys[e.key.toLowerCase()] = false; });
addEventListener('blur', () => { for (const k in keys) keys[k] = false; mouse.l = mouse.r = false; });
renderer.domElement.addEventListener('mousedown', (e) => {
  if (e.button === 0) mouse.l = true; if (e.button === 2) mouse.r = true; if (e.button === 1) { e.preventDefault(); if (!G.paused) toggleLock(); }
});
addEventListener('mouseup', (e) => { if (e.button === 0) mouse.l = false; if (e.button === 2) mouse.r = false; });
addEventListener('contextmenu', (e) => e.preventDefault());

// touch controls
if ('ontouchstart' in window || navigator.maxTouchPoints > 0) {
  document.body.classList.add('touch');
  const stick = $('#stick'), nub = $('#nub');
  let sid = null;
  const setStick = (e) => {
    const r = stick.getBoundingClientRect();
    let dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
    const m = Math.hypot(dx, dy), max = 45;
    if (m > max) { dx *= max / m; dy *= max / m; }
    nub.style.transform = `translate(${dx}px,${dy}px)`;
    keys.a = dx < -12; keys.d = dx > 12; keys.w = dy < -12; keys.s = dy > 12;
  };
  stick.addEventListener('pointerdown', (e) => { sid = e.pointerId; stick.setPointerCapture(sid); setStick(e); });
  stick.addEventListener('pointermove', (e) => { if (e.pointerId === sid) setStick(e); });
  const end = () => { sid = null; nub.style.transform = ''; keys.a = keys.d = keys.w = keys.s = false; };
  stick.addEventListener('pointerup', end); stick.addEventListener('pointercancel', end);
  const bind = (id, down, up) => {
    const el = $('#' + id);
    el.addEventListener('pointerdown', (e) => { e.preventDefault(); sfx.unlock(); if (!G.paused) down(); });
    if (up) { el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up); }
  };
  bind('t-atk', () => (mouse.l = true), () => (mouse.l = false));
  bind('t-hvy', () => startAttack('heavy'));
  bind('t-dge', dodge); bind('t-pot', drinkPotion); bind('t-lck', toggleLock);
  bind('t-int', () => { if (G.near && !G.dlg) G.near.act(); });
  bind('t-1', () => cast('s1')); bind('t-2', () => cast('s2')); bind('t-3', () => cast('s3'));
  bind('t-cl', () => (touchCam = -1), () => (touchCam = 0));
  bind('t-cr', () => (touchCam = 1), () => (touchCam = 0));
}

$('#start').onclick = () => {
  sfx.unlock();
  $('#title').style.display = 'none';
  G.paused = false;
  music('hub');
  say('Find Headmistress Seraphine near the courtyard.', 4000);
};
$('#again').onclick = () => { $('#end').style.display = 'none'; G.paused = false; buildHub(); };
$('#retry').onclick = () => respawn(false);
$('#home').onclick = () => respawn(true);

P.g = buildHero();
scene.add(P.g);
buildHub();
frame();
window.__game = { yaw: (v) => (camYaw = v), G, P, buildHub, loadDungeon, cast, startAttack, dodge, keys, nextWave, spawnEnemy };
