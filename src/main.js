import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { mk, at, toonMat, stoneTexture } from './toon.js';
import { LEVELS, ET, DIALOGUE } from './data.js';
import { buildHero, buildEnemy } from './models.js';

const $ = (s) => document.querySelector(s);
const rnd = (a, b) => a + Math.random() * (b - a);
const dist2 = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

// ---------- renderer ----------
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.prepend(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.1, 200);
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.5, 0.6, 0.85);
composer.addPass(bloom);
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
Object.assign(sun.shadow.camera, { left: -26, right: 26, top: 26, bottom: -26, near: 1, far: 80 });
sun.shadow.bias = -0.0005;
scene.add(hemi, sun, sun.target);

// ---------- game state ----------
const G = {
  area: null, areaGroup: null, level: -1, wave: -1,
  enemies: [], projs: [], parts: [], pops: [], slashes: [],
  interactables: [], colliders: [], R: 30,
  timeScale: 1, tactical: false, shake: 0, paused: true, cleared: false, dlg: false,
};
const P = {
  g: null, pos: new THREE.Vector3(), vel: new THREE.Vector3(), face: new THREE.Vector3(0, 0, 1),
  hp: 100, max: 100, mp: 100, maxMp: 100, lvl: 1, xp: 0, potions: 2,
  atk: null, combo: 0, lastAtk: -9, queued: null, dodgeT: 0, dodgeCd: 0, iframes: 0, dead: false,
  fire: 0, cd: { s1: 0, s2: 0, s3: 0 }, r: 0.5, hurtT: 0, time: 0,
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
const skillsEl = $('#skills');
skillsEl.innerHTML = SKILLS.map((s) => `<div class="sk" id="sk-${s.id}"><b>${s.key}</b>${s.name}<div class="cd"></div></div>`).join('') +
  '<div class="sk" id="sk-pot"><b>F</b><span id="potn"></span><div class="cd"></div></div>';

function say(text, ms = 2500) {
  const el = $('#prompt');
  el.textContent = text;
  clearTimeout(say.t);
  if (ms) say.t = setTimeout(() => { if (el.textContent === text) el.textContent = ''; }, ms);
}

function updateHud() {
  $('#hp i').style.width = (100 * P.hp / P.max) + '%';
  $('#mp i').style.width = (100 * P.mp / P.maxMp) + '%';
  $('#xp i').style.width = (100 * P.xp / (60 * P.lvl)) + '%';
  $('#lvl').textContent = `Lv ${P.lvl}   HP ${Math.ceil(P.hp)}/${P.max}`;
  $('#potn').textContent = 'x' + P.potions;
  SKILLS.forEach((s) => {
    const el = $('#sk-' + s.id);
    el.querySelector('.cd').style.height = (100 * Math.max(0, P.cd[s.id]) / s.cd) + '%';
    el.classList.toggle('on', s.id === 's1' && P.fire > 0);
  });
}

// ---------- effects ----------
const partGeo = new THREE.SphereGeometry(1, 6, 5);
function burst(pos, color, n = 10, speed = 5, life = 0.5, size = 0.12, up = 2) {
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
function slashFx(pos, dir, color, scale = 3, dur = 0.22) {
  const m = new THREE.Mesh(slashGeo, new THREE.MeshBasicMaterial({ color, transparent: true, side: THREE.DoubleSide, opacity: 0.9 }));
  m.rotation.x = -Math.PI / 2;
  const g = new THREE.Group();
  g.add(m);
  g.position.copy(pos).setY(1.0);
  g.rotation.y = Math.atan2(dir.x, dir.z) - Math.PI / 2;
  g.scale.setScalar(scale * 0.6);
  scene.add(g);
  G.slashes.push({ g, m, life: dur, max: dur, scale });
}

function popup(pos, text, color = '#fff', size = 20) {
  const el = document.createElement('div');
  el.className = 'pop';
  el.textContent = text;
  el.style.color = color;
  el.style.fontSize = size + 'px';
  document.body.appendChild(el);
  G.pops.push({ el, pos: pos.clone().setY(2.3), life: 0.9, max: 0.9 });
}

const tmpV = new THREE.Vector3();
function toScreen(p, out) {
  tmpV.copy(p).project(camera);
  out.x = (tmpV.x * 0.5 + 0.5) * innerWidth;
  out.y = (-tmpV.y * 0.5 + 0.5) * innerHeight;
  out.vis = tmpV.z < 1;
}
const sp = {};

// ---------- area building ----------
function clearArea() {
  if (G.areaGroup) scene.remove(G.areaGroup);
  G.enemies.forEach((e) => { scene.remove(e.g); e.bar.remove(); });
  G.projs.forEach((p) => scene.remove(p.m));
  G.enemies = []; G.projs = []; G.interactables = []; G.colliders = [];
  G.areaGroup = new THREE.Group();
  scene.add(G.areaGroup);
}

function ground(R, color, texA, texB) {
  const tex = stoneTexture(texA, texB);
  tex.repeat.set(R / 3, R / 3);
  const m = new THREE.Mesh(new THREE.CircleGeometry(R, 48), toonMat(color, { map: tex }));
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
  g.add(at(mk(new THREE.ConeGeometry(2.8, 4, 10), 0x3a63c8), 0, h + 2, 0));
  for (let i = 0; i < 3; i++) g.add(at(mk(new THREE.BoxGeometry(0.6, 1.1, 0.2), 0xffe28a, { emissive: 0xffc95a, ei: 1.2, o: 0.03 }), 0, 3 + i * 3.4, 2.05));
  g.position.set(x, 0, z);
  G.areaGroup.add(g);
  addCollider(x, z, 2.4);
}

function sakura(x, z) {
  const g = new THREE.Group();
  g.add(at(mk(new THREE.CylinderGeometry(0.25, 0.35, 2.4, 6), 0x6b4a3a), 0, 1.2, 0));
  g.add(at(mk(new THREE.SphereGeometry(1.7, 10, 8), 0xffa8d1), 0, 3.3, 0));
  g.add(at(mk(new THREE.SphereGeometry(1.1, 10, 8), 0xffc2e0), 1.1, 2.8, 0.5));
  g.position.set(x, 0, z);
  G.areaGroup.add(g);
  addCollider(x, z, 0.5);
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

function setEnv(sky, fog, hemiI, sunI) {
  scene.background = new THREE.Color(sky);
  scene.fog = new THREE.Fog(fog, 25, 70);
  hemi.intensity = hemiI; sun.intensity = sunI;
}

function buildHub() {
  clearArea();
  G.area = 'hub'; G.level = -1; G.R = 34;
  setEnv(0xa5d8ff, 0xc9e8ff, 1.3, 2.4);
  ground(G.R, 0x9ad28a, '#9bd18a', '#92c982');
  // paved plaza
  const plaza = new THREE.Mesh(new THREE.CircleGeometry(14, 40), toonMat(0xd8cfe8, { map: stoneTexture('#d8cfe8', '#a89cc8') }));
  plaza.rotation.x = -Math.PI / 2; plaza.position.y = 0.02; plaza.receiveShadow = true;
  G.areaGroup.add(plaza);
  // academy keep
  const keep = new THREE.Group();
  keep.add(at(mk(new THREE.BoxGeometry(18, 9, 5), 0xe9e2f7), 0, 4.5, 0));
  keep.add(at(mk(new THREE.ConeGeometry(4, 6, 4), 0x3a63c8), 0, 12, 0));
  keep.position.set(0, 0, -26);
  G.areaGroup.add(keep);
  addCollider(-6, -26, 3.5); addCollider(0, -26, 3.5); addCollider(6, -26, 3.5);
  tower(-13, -24, 14, 0xf1e9ff); tower(13, -24, 14, 0xf1e9ff); tower(-22, -14, 10, 0xe5dcf5); tower(22, -14, 10, 0xe5dcf5);
  [[-18, -4], [18, -4], [-24, 6], [24, 6], [-12, 14], [12, 14]].forEach(([x, z]) => sakura(x, z));
  // fountain
  const f = new THREE.Group();
  f.add(at(mk(new THREE.CylinderGeometry(2.6, 2.9, 0.8, 16), 0xc6bbe6), 0, 0.4, 0));
  f.add(at(mk(new THREE.CylinderGeometry(1.7, 1.7, 0.2, 16), 0x6bd6ff, { emissive: 0x2a9bdd, ei: 0.8 }), 0, 0.85, 0));
  f.add(at(mk(new THREE.OctahedronGeometry(0.8), 0x9ff3ff, { emissive: 0x6be8ff, ei: 1.5 }), 0, 2.4, 0));
  f.position.set(0, 0, 3);
  f.userData.crystal = f.children[2];
  G.areaGroup.add(f); G.fountain = f;
  addCollider(0, 3, 2.9);
  // undercroft gate (east side of plaza)
  const gate = new THREE.Group();
  gate.add(at(mk(new THREE.BoxGeometry(1, 5, 1), 0x4a3f6b), -2, 2.5, 0));
  gate.add(at(mk(new THREE.BoxGeometry(1, 5, 1), 0x4a3f6b), 2, 2.5, 0));
  gate.add(at(mk(new THREE.BoxGeometry(5.2, 1, 1.2), 0x4a3f6b), 0, 5.2, 0));
  const portal = at(mk(new THREE.PlaneGeometry(3, 4.6), 0xb64dff, { basic: true, o: 0, opacity: 0.8 }), 0, 2.4, 0);
  portal.material.side = THREE.DoubleSide;
  gate.add(portal);
  gate.position.set(0, 0, -16);
  G.areaGroup.add(gate);
  runeCircle(3, 0xb64dff, 0, -13);
  G.interactables.push({ x: 0, z: -14, r: 3.5, prompt: 'R — Descend into the Undercroft', act: () => loadDungeon(0) });
  // NPC
  const npc = buildEnemy('npc');
  npc.position.set(-6, 0, -6); npc.rotation.y = 0.8;
  G.areaGroup.add(npc);
  addCollider(-6, -6, 0.6);
  G.interactables.push({ x: -6, z: -6, r: 3, prompt: 'R — Speak with Headmistress Seraphine', act: () => openDialogue('intro') });
  [[-4, 12], [4, 12], [-8, -14], [8, -14]].forEach(([x, z]) => torch(x, z, 0xffd37a));
  P.pos.set(0, 0, 14); camYaw = 0;
  $('#area').textContent = 'Aetherholt Academy — Courtyard';
  $('#obj').textContent = 'Speak to the Headmistress, then enter the gate';
}

function loadDungeon(i) {
  clearArea();
  const L = LEVELS[i];
  G.area = 'dungeon'; G.level = i; G.wave = -1; G.cleared = false; G.R = L.R;
  setEnv(L.sky, L.sky, 2.2, 1.8);
  ground(G.R, L.floor, L.texA, L.texB);
  // walls
  const wall = new THREE.Mesh(new THREE.CylinderGeometry(G.R + 1, G.R + 1, 14, 40, 1, true), toonMat(L.wall, { side: THREE.BackSide, map: stoneTexture(L.texA, L.texB) }));
  wall.material.map.repeat.set(16, 3);
  wall.position.y = 7;
  G.areaGroup.add(wall);
  const cap = new THREE.Mesh(new THREE.CircleGeometry(G.R + 1, 40), toonMat(L.sky));
  cap.rotation.x = Math.PI / 2; cap.position.y = 14;
  G.areaGroup.add(cap);
  const rune = runeCircle(8, L.glow, 0, 0);
  G.rune = rune;
  const n = 8;
  for (let k = 0; k < n; k++) {
    const a = (k / n) * 6.28 + 0.4, d = G.R * 0.8;
    pillar(Math.cos(a) * d, Math.sin(a) * d, L.wall);
  }
  for (let k = 0; k < 6; k++) { const a = k * 1.05 + 0.2; torch(Math.cos(a) * (G.R - 2), Math.sin(a) * (G.R - 2), L.glow); }
  const l1 = new THREE.PointLight(L.glow, 220, 60, 1.4); l1.position.set(0, 7, 0);
  G.areaGroup.add(l1);
  P.pos.set(0, 0, G.R - 5);
  camYaw = 0;
  $('#area').textContent = L.name;
  nextWave();
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
      act: () => (isLast ? victory() : loadDungeon(G.level + 1)),
    });
    $('#obj').textContent = 'Level cleared — step into the portal';
    say('The way down is open.');
    return;
  }
  $('#obj').textContent = `Defeat the enemies (wave ${G.wave + 1}/${L.waves.length})`;
  L.waves[G.wave].forEach((t, i) => {
    const a = (i / L.waves[G.wave].length) * 6.28 + rnd(0, 1), d = rnd(9, G.R - 6);
    spawnEnemy(t, Math.cos(a) * d, Math.sin(a) * d);
  });
  say(G.wave === 0 ? 'Something stirs in the dark...' : 'More are coming!');
  if (L.waves[G.wave].includes('boss')) say('The Hollow Archdean awakens!', 4000);
}

function victory() {
  G.paused = true;
  $('#end').style.display = 'flex';
  document.exitPointerLock?.();
}

// ---------- enemies ----------
function spawnEnemy(type, x, z) {
  const d = ET[type];
  const g = buildEnemy(type);
  g.position.set(x, 0, z);
  scene.add(g);
  const bar = document.createElement('div');
  bar.className = 'eb' + (d.boss ? ' boss' : '');
  bar.innerHTML = '<i></i>';
  bar.style.display = 'none';
  document.body.appendChild(bar);
  const scale = 1 + 0.12 * G.level;
  const e = {
    type, d, g, bar, hp: d.hp * scale, max: d.hp * scale, dmg: d.dmg * scale,
    pos: g.position, vel: new THREE.Vector3(), state: 'idle', t: 0, cd: rnd(0.5, 1.5), stun: 0, slow: 0, burn: 0,
    tele: null, special: rnd(3, 5), summoned: false, bob: rnd(0, 6), dead: false, face: new THREE.Vector3(0, 0, 1),
  };
  G.enemies.push(e);
  burst(new THREE.Vector3(x, 0.5, z), 0xb64dff, 12, 4, 0.6);
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
  G.shake = 0.35;
  $('#flash').style.opacity = 0.35;
  setTimeout(() => ($('#flash').style.opacity = 0), 120);
  popup(P.pos, Math.round(dmg), '#ff6b8a', 22);
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
  if (e.burn > 0) { e.burn -= dt; damageEnemy(e, 6 * dt, { silent: true }); if (Math.random() < dt * 10) burst(e.pos.clone().setY(1), 0xff8a2a, 1, 1, 0.4, 0.1); }
  if (e.slow > 0) e.slow -= dt;
  if (e.stun > 0) { e.stun -= dt; e.pos.addScaledVector(e.vel, dt); e.vel.multiplyScalar(0.88); return; }
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
        say('The Archdean calls for aid!');
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
      burst(e.pos.clone().setY(0.3), 0xff8a4a, 30, 9, 0.6, 0.2);
      G.shake = 0.6;
      e.state = 'chase'; e.cd = 1.2;
    }
  }
  // separation
  for (const o of G.enemies) if (o !== e) {
    const dx = e.pos.x - o.pos.x, dz = e.pos.z - o.pos.z, m = Math.hypot(dx, dz), min = d.r + o.d.r;
    if (m < min && m > 0.001) { e.pos.x += (dx / m) * (min - m) * 0.5; e.pos.z += (dz / m) * (min - m) * 0.5; }
  }
  if (!d.fly) e.pos.y = 0; else e.pos.y = 0.9 + Math.sin(e.bob) * 0.25;
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
  if (e.dead) return;
  let dmg = base, tag = '', color = '#fff', size = 20;
  if (!o.silent) {
    const roll = 1 + Math.floor(Math.random() * 20); // d20, Baldur's Gate style
    if (roll >= 19) { dmg *= 2; tag = roll === 20 ? ' NAT 20!' : ' CRIT'; color = '#ffd66b'; size = 28; }
    else if (roll <= 2) { dmg *= 0.6; tag = ' glance'; color = '#9ab'; size = 16; }
    popup(e.pos, Math.round(dmg) + tag, color, size);
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
  burst(e.pos.clone().setY(1), 0xb64dff, 22, 6, 0.8, 0.16);
  scene.remove(e.g); e.bar.remove();
  G.enemies.splice(G.enemies.indexOf(e), 1);
  gainXp(e.d.xp);
  if (Math.random() < 0.12 || e.d.boss) { P.potions++; popup(e.pos, '+ potion', '#9ff', 18); }
  P.mp = Math.min(P.maxMp, P.mp + 8);
  if (G.area === 'dungeon' && !G.enemies.length && !G.cleared) setTimeout(nextWave, 1200);
}

function gainXp(n) {
  P.xp += n;
  while (P.xp >= 60 * P.lvl) {
    P.xp -= 60 * P.lvl; P.lvl++;
    P.max += 15; P.maxMp += 8; P.hp = P.max; P.mp = P.maxMp;
    popup(P.pos, 'LEVEL UP!', '#ffd66b', 30);
    burst(P.pos.clone().setY(1), 0xffd66b, 30, 6, 1);
  }
}

// ---------- player ----------
const dmgMul = () => 1 + 0.12 * (P.lvl - 1);

function nearestEnemy(range, from = P.pos) {
  let best = null, bd = range;
  for (const e of G.enemies) { const d = dist2(from, e.pos); if (d < bd) { bd = d; best = e; } }
  return best;
}

function startAttack(kind) {
  if (P.dead || G.dlg || P.dodgeT > 0) return;
  if (P.atk) { if (P.atk.t > P.atk.dur * 0.45) P.queued = kind; return; }
  const t = P.time;
  P.combo = t - P.lastAtk < 0.9 ? (P.combo + 1) % 3 : 0;
  const tgt = nearestEnemy(7);
  if (tgt) P.face.copy(tmpV.copy(tgt.pos).sub(P.pos).setY(0).normalize());
  const heavy = kind === 'heavy';
  P.atk = heavy
    ? { kind, t: 0, dur: 0.85, hitAt: 0.5, dmg: 42, range: 3.6, arc: 1.5, done: false, lunge: 7, swing: 1.4 }
    : { kind, t: 0, dur: 0.38 + (P.combo === 2 ? 0.1 : 0), hitAt: 0.16, dmg: [13, 13, 22][P.combo], range: 3.0, arc: 1.2, done: false, lunge: 8, swing: P.combo % 2 ? -1 : 1 };
  P.lastAtk = t;
  P.vel.addScaledVector(P.face, P.atk.lunge);
}

function applyAttackHit(a) {
  const col = P.fire > 0 ? 0xff8a2a : 0x7df9ff;
  slashFx(P.pos, P.face, col, a.range * 0.9);
  let hit = 0;
  for (const e of [...G.enemies]) {
    tmpV.copy(e.pos).sub(P.pos).setY(0);
    const d = tmpV.length();
    if (d > a.range + e.d.r) continue;
    tmpV.normalize();
    if (Math.acos(Math.min(1, tmpV.dot(P.face))) > a.arc) continue;
    hit++;
    damageEnemy(e, a.dmg * dmgMul() * (P.fire > 0 ? 1.5 : 1), { knock: tmpV.clone().multiplyScalar(a.kind === 'heavy' ? 9 : 4), stun: a.kind === 'heavy' ? 0.6 : 0.25 });
    if (P.fire > 0) e.burn = 3;
    burst(e.pos.clone().setY(1.1), col, 8, 5, 0.3);
  }
  if (hit) { G.shake = a.kind === 'heavy' ? 0.35 : 0.12; P.mp = Math.min(P.maxMp, P.mp + 3 * hit); }
}

function cast(id) {
  const s = SKILLS.find((x) => x.id === id);
  if (P.dead || G.dlg || P.cd[id] > 0 || P.mp < s.cost) { if (P.mp < s.cost) say('Not enough mana', 1000); return; }
  P.mp -= s.cost; P.cd[id] = s.cd;
  const tgt = nearestEnemy(14);
  if (tgt) P.face.copy(tmpV.copy(tgt.pos).sub(P.pos).setY(0).normalize());
  P.castT = 0.3;
  if (id === 's1') {
    P.fire = 15;
    burst(P.pos.clone().setY(1), 0xff8a2a, 24, 5, 0.7);
    popup(P.pos, 'Flame Edge', '#ff9a4a', 20);
  } else if (id === 's2') {
    burst(P.pos.clone().setY(0.4), 0x9fe8ff, 40, 12, 0.7, 0.18, 0.5);
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.5, 1, 40), new THREE.MeshBasicMaterial({ color: 0x9fe8ff, transparent: true, side: THREE.DoubleSide, opacity: 0.8 }));
    ring.rotation.x = -Math.PI / 2; ring.position.copy(P.pos).setY(0.1);
    scene.add(ring);
    G.slashes.push({ g: ring, m: ring, life: 0.5, max: 0.5, scale: 8, ring: true });
    for (const e of [...G.enemies]) if (dist2(P.pos, e.pos) < 8) {
      tmpV.copy(e.pos).sub(P.pos).setY(0).normalize();
      damageEnemy(e, 26 * dmgMul(), { knock: tmpV.clone().multiplyScalar(7), stun: 0.4 });
      e.slow = 4;
    }
    G.shake = 0.3;
  } else if (id === 's3') {
    const m = mk(new THREE.OctahedronGeometry(0.4), 0x7df9ff, { basic: true, o: 0.03 });
    m.position.copy(P.pos).setY(1.3);
    scene.add(m);
    G.projs.push({ m, v: P.face.clone().multiplyScalar(22), dmg: 30 * dmgMul(), life: 1.2, enemy: false, r: 0.9, hit: new Set(), pierce: true });
  }
}

function drinkPotion() {
  if (P.dead || P.potions <= 0 || P.hp >= P.max) return;
  P.potions--; P.hp = Math.min(P.max, P.hp + 45);
  popup(P.pos, '+45', '#7dffa5', 22);
  burst(P.pos.clone().setY(1), 0x7dffa5, 12, 3, 0.6);
}

function dodge() {
  if (P.dead || G.dlg || P.dodgeCd > 0) return;
  const dir = inputDir();
  if (dir.lengthSq() === 0) dir.copy(P.face).negate();
  P.vel.copy(dir.normalize().multiplyScalar(17));
  P.face.copy(dir).multiplyScalar(dir.dot(P.face) < 0 ? -1 : 1);
  P.dodgeT = 0.26; P.dodgeCd = 0.6; P.iframes = Math.max(P.iframes, 0.38);
  P.atk = null; P.queued = null;
  burst(P.pos.clone().setY(0.5), 0x7df9ff, 8, 3, 0.4);
}

function die() {
  P.dead = true;
  say('You fell... the academy infirmary takes you in.', 0);
  setTimeout(() => {
    P.dead = false; P.hp = P.max; P.mp = P.maxMp; P.vel.set(0, 0, 0); P.iframes = 1;
    buildHub();
    say('', 1);
  }, 2400);
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
  P.iframes -= dt; P.hurtT -= dt; P.dodgeCd -= dt; P.fire -= dt; P.castT = (P.castT ?? 0) - dt;
  for (const k in P.cd) P.cd[k] -= dt;
  P.mp = Math.min(P.maxMp, P.mp + 2.2 * dt);
  if (P.dead) return;
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
      if (!P.atk) P.face.lerp(dir, Math.min(1, dt * 14)).normalize();
    } else P.vel.multiplyScalar(Math.max(0, 1 - dt * 10));
  }
  if (P.atk) {
    const a = P.atk;
    a.t += dt;
    if (!a.done && a.t >= a.hitAt) { a.done = true; applyAttackHit(a); }
    if (a.t >= a.dur) {
      P.atk = null;
      if (P.queued) { const q = P.queued; P.queued = null; startAttack(q); }
    }
  }
  P.pos.addScaledVector(P.vel, dt);
  resolve(P.pos, P.r);
  // model
  const g = P.g;
  g.position.copy(P.pos);
  g.rotation.y = Math.atan2(P.face.x, P.face.z);
  const arm = g.userData.arm, moving = P.vel.lengthSq() > 4;
  let target = -0.5;
  if (P.atk) {
    const k = Math.min(1, P.atk.t / P.atk.dur);
    target = P.atk.kind === 'heavy' ? -2.6 + k * 4.2 : -2.2 + Math.sin(k * Math.PI * 0.8) * 3.4;
    arm.rotation.z = P.atk.swing * 0.5 * Math.sin(k * Math.PI);
  } else { arm.rotation.z = 0; if (P.castT > 0) target = -2.4; }
  arm.rotation.x += (target - arm.rotation.x) * Math.min(1, dt * 30);
  g.userData.body.position.y = moving ? Math.abs(Math.sin(P.time * 12)) * 0.07 : Math.sin(P.time * 2) * 0.02;
  g.userData.cape.rotation.x = 0.2 + (moving ? 0.35 : 0.05) + Math.sin(P.time * 6) * 0.05;
  g.userData.blade.material.color.setHex(P.fire > 0 ? 0xff8a2a : 0x7df9ff);
  g.userData.blade.scale.y = P.fire > 0 ? 1.25 : 1;
  g.visible = !(P.iframes > 0 && P.hurtT > 0 && Math.floor(P.time * 30) % 2);
  if (P.fire > 0 && Math.random() < dt * 25) burst(P.pos.clone().add(new THREE.Vector3(0.5, 1.6, 0.4)), 0xff8a2a, 1, 1.5, 0.4, 0.09);
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
    if (c.give === 'potion') { P.potions += 2; say('Received 2 healing draughts.'); }
    if (c.next) openDialogue(c.next); else { G.dlg = false; el.style.display = 'none'; }
  }));
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
function frame() {
  requestAnimationFrame(frame);
  const real = Math.min(clock.getDelta(), 0.05);
  if (G.paused) { composer.render(); return; }
  const dt = real * G.timeScale;

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
    if (p.life <= 0) { p.el.remove(); G.pops.splice(G.pops.indexOf(p), 1); }
  }
  for (const e of G.enemies) if (e.bar.style.display !== 'none' && !e.d.boss) {
    toScreen(tmpV.copy(e.pos).setY(e.d.fly ? 2.2 : e.d.h || 2.4), sp);
    e.bar.style.left = sp.x + 'px'; e.bar.style.top = sp.y + 'px';
  }

  // ambient animation
  if (G.fountain) G.fountain.userData.crystal.rotation.y += dt, G.fountain.userData.crystal.position.y = 2.4 + Math.sin(P.time * 2) * 0.2;
  if (G.rune) G.rune.rotation.z += dt * 0.4;
  interactCheck();

  // camera
  G.shake = Math.max(0, G.shake - real * 1.5);
  const d = 12, h = 6.5;
  const cx = P.pos.x + Math.sin(camYaw) * d, cz = P.pos.z + Math.cos(camYaw) * d;
  camera.position.lerp(tmpV.set(cx + rnd(-1, 1) * G.shake, h + rnd(-1, 1) * G.shake, cz), Math.min(1, real * 8));
  camera.lookAt(P.pos.x, 2.2, P.pos.z);
  if (keys.q || keys.arrowleft) camYaw -= real * 2;
  if (keys.e || keys.arrowright) camYaw += real * 2;
  sun.position.set(P.pos.x + 18, 30, P.pos.z + 12);
  sun.target.position.copy(P.pos);

  // held mouse = continuous attacks
  if (mouse.l) startAttack('light');
  if (mouse.r) startAttack('heavy');
  updateHud();
  composer.render();
}

// ---------- input ----------
addEventListener('keydown', (e) => {
  const k = e.key.toLowerCase();
  if (e.repeat && k !== 'q' && k !== 'e') { keys[k] = true; return; }
  keys[k] = true;
  if (k === ' ') { e.preventDefault(); dodge(); }
  else if (k === 'j') startAttack('light');
  else if (k === 'k') startAttack('heavy');
  else if (k === '1') cast('s1');
  else if (k === '2') cast('s2');
  else if (k === '3') cast('s3');
  else if (k === 'f') drinkPotion();
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
renderer.domElement.addEventListener('mousedown', (e) => { if (e.button === 0) mouse.l = true; if (e.button === 2) mouse.r = true; });
addEventListener('mouseup', (e) => { if (e.button === 0) mouse.l = false; if (e.button === 2) mouse.r = false; });
addEventListener('contextmenu', (e) => e.preventDefault());

$('#start').onclick = () => {
  $('#title').style.display = 'none';
  G.paused = false;
  say('Find Headmistress Seraphine near the courtyard.', 4000);
};
$('#again').onclick = () => { $('#end').style.display = 'none'; G.paused = false; buildHub(); };

P.g = buildHero();
scene.add(P.g);
buildHub();
frame();
window.__game = { G, P, buildHub, loadDungeon, cast, startAttack, dodge, keys };
