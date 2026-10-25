import * as THREE from 'three';
import { mk, at, rot } from './toon.js';

const sph = (r) => new THREE.SphereGeometry(r, 14, 10);
const eye = (x, y, z, c = 0xffffff) => at(mk(new THREE.SphereGeometry(0.06, 6, 5), c, { basic: true, o: 0 }), x, y, z);

const SILVER = 0xdde8f6, TEAL = 0x16c7b4, DTEAL = 0x0c7f8c, GOLDC = 0xffd66b, CLOTH = 0x14305e;

// cylinder limb between two points
function limb(a, b, r, color, o = 0.035) {
  const d = new THREE.Vector3().subVectors(b, a), len = d.length();
  const m = mk(new THREE.CylinderGeometry(r, r * 0.88, len, 8), color, { o });
  m.position.copy(a).addScaledVector(d, 0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
  return m;
}
const V = (x, y, z) => new THREE.Vector3(x, y, z);

export function buildHero() {
  const g = new THREE.Group();
  const body = new THREE.Group();
  g.add(body);

  // legs (pivot at hip so they can swing)
  const legs = [];
  for (const s of [-1, 1]) {
    const leg = new THREE.Group();
    leg.position.set(s * 0.17, 0.98, 0);
    leg.add(limb(V(0, 0, 0), V(0, -0.48, 0), 0.13, SILVER));
    leg.add(at(mk(sph(0.12), TEAL), 0, -0.5, 0.06));
    leg.add(limb(V(0, -0.5, 0), V(0, -0.92, 0), 0.115, DTEAL));
    leg.add(at(mk(new THREE.BoxGeometry(0.24, 0.16, 0.42), SILVER), 0, -0.95, 0.07));
    leg.add(at(mk(new THREE.BoxGeometry(0.26, 0.05, 0.2), TEAL), 0, -0.88, 0.08));
    body.add(leg); legs.push(leg);
  }
  // faulds (armor skirt) + belt
  body.add(at(mk(new THREE.CylinderGeometry(0.36, 0.5, 0.34, 10), DTEAL), 0, 1.0, 0));
  body.add(at(mk(new THREE.CylinderGeometry(0.34, 0.34, 0.12, 10), GOLDC), 0, 1.18, 0));
  for (let i = 0; i < 5; i++) {
    const a = (i - 2) * 0.55;
    const f = mk(new THREE.BoxGeometry(0.2, 0.42, 0.05), SILVER);
    f.position.set(Math.sin(a) * 0.46, 0.8, Math.cos(a) * 0.46); f.rotation.y = a; f.rotation.x = -0.15;
    body.add(f);
  }
  // torso
  const chest = mk(new THREE.CylinderGeometry(0.36, 0.3, 0.62, 12), SILVER);
  chest.position.y = 1.5; chest.scale.z = 0.8; body.add(chest);
  body.add(at(mk(new THREE.BoxGeometry(0.24, 0.62, 0.05), TEAL), 0, 1.15, 0.33));
  body.add(at(mk(new THREE.OctahedronGeometry(0.11), 0x7df9ff, { emissive: 0x39e6ff, ei: 2, o: 0.02 }), 0, 1.55, 0.3));
  body.add(rot(at(mk(new THREE.TorusGeometry(0.36, 0.05, 6, 16), GOLDC), 0, 1.78, 0), Math.PI / 2, 0, 0));
  // pauldrons
  for (const s of [-1, 1]) {
    const p = at(mk(sph(0.27), SILVER), s * 0.46, 1.72, 0); p.scale.set(1, 0.72, 1); body.add(p);
    const r = at(mk(new THREE.TorusGeometry(0.26, 0.04, 6, 14), TEAL), s * 0.46, 1.72, 0); r.rotation.x = Math.PI / 2; r.scale.set(1, 1, 1.2);
    body.add(r);
    body.add(at(mk(new THREE.ConeGeometry(0.07, 0.22, 5), GOLDC), s * 0.5, 1.95, 0));
  }
  // head: face, helm, crest, hair, big anime eyes
  body.add(at(mk(sph(0.29), 0xffe0cc), 0, 1.98, 0.02));
  const helm = mk(new THREE.SphereGeometry(0.34, 14, 10, 0, 6.28, 0, 1.45), SILVER);
  helm.position.set(0, 2.03, -0.02); helm.rotation.x = -0.15; body.add(helm);
  body.add(at(mk(new THREE.BoxGeometry(0.06, 0.34, 0.5), TEAL), 0, 2.28, -0.05));
  body.add(at(mk(new THREE.BoxGeometry(0.44, 0.07, 0.07), GOLDC), 0, 2.12, 0.25));
  for (let i = 0; i < 3; i++) {
    const h = at(mk(new THREE.ConeGeometry(0.09, 0.38, 5), 0x7be8ff), (i - 1) * 0.15, 1.9, -0.3); h.rotation.x = 2.3; body.add(h);
  }
  for (const s of [-1, 1]) {
    const w = at(mk(sph(0.075), 0xffffff, { o: 0.015 }), s * 0.115, 1.97, 0.26); w.scale.set(1, 1.35, 0.5); body.add(w);
    const ir = at(mk(sph(0.055), 0x1fb6ff, { basic: true, o: 0 }), s * 0.115, 1.96, 0.285); ir.scale.set(1, 1.4, 0.5); body.add(ir);
    body.add(at(mk(sph(0.018), 0xffffff, { basic: true, o: 0 }), s * 0.1, 1.99, 0.3));
  }
  body.add(at(mk(new THREE.BoxGeometry(0.06, 0.012, 0.01), 0x8a4a4a, { basic: true, o: 0 }), 0, 1.87, 0.3));

  // flowing cape: 4 chained segments, animated in main loop
  const capeRoot = new THREE.Group();
  capeRoot.position.set(0, 1.85, -0.3);
  let parent = capeRoot; const capeSegs = [];
  for (let i = 0; i < 4; i++) {
    const seg = new THREE.Group();
    seg.position.y = i === 0 ? 0 : -0.34;
    const w = 0.78 - i * 0.04;
    seg.add(at(mk(new THREE.BoxGeometry(w, 0.36, 0.05), i === 3 ? DTEAL : TEAL), 0, -0.17, 0));
    if (i === 3) seg.add(at(mk(new THREE.BoxGeometry(w, 0.05, 0.07), GOLDC), 0, -0.36, 0));
    parent.add(seg); parent = seg; capeSegs.push(seg);
  }
  body.add(capeRoot);

  // two-handed crystal greatsword: pivot at chest so both arms follow it
  const arm = new THREE.Group();
  arm.position.set(0, 1.5, 0.15);
  arm.add(limb(V(0.42, 0.22, -0.15), V(0.06, -0.55, 0.1), 0.085, SILVER));
  arm.add(limb(V(-0.42, 0.22, -0.15), V(-0.04, -0.8, 0.1), 0.085, SILVER));
  arm.add(at(mk(sph(0.1), TEAL), 0.06, -0.58, 0.1), at(mk(sph(0.1), TEAL), -0.04, -0.83, 0.1));
  arm.add(at(mk(new THREE.CylinderGeometry(0.045, 0.045, 0.95, 8), 0x3a2a5a), 0, -0.7, 0.1));
  const guard = at(mk(new THREE.BoxGeometry(0.62, 0.09, 0.12), GOLDC), 0, -1.22, 0.1);
  arm.add(guard);
  arm.add(at(mk(new THREE.OctahedronGeometry(0.1), 0x7df9ff, { emissive: 0x39e6ff, ei: 2.2, o: 0.02 }), 0, -1.22, 0.16));
  arm.add(at(mk(new THREE.BoxGeometry(0.32, 2.3, 0.07), SILVER, { o: 0.04 }), 0, -2.4, 0.1));
  arm.add(rot(at(mk(new THREE.ConeGeometry(0.22, 0.5, 4), SILVER, { o: 0.04 }), 0, -3.7, 0.1), Math.PI, 0, Math.PI / 4));
  const blade = at(mk(new THREE.BoxGeometry(0.15, 2.4, 0.09), 0x7df9ff, { basic: true, o: 0 }), 0, -2.45, 0.1);
  arm.add(blade);
  arm.rotation.x = -0.5;
  body.add(arm);

  g.userData = { arm, body, cape: capeSegs, blade, legs };
  return g;
}

export function buildEnemy(type) {
  const g = new THREE.Group();
  if (type === 'npc') {
    g.add(at(mk(new THREE.CylinderGeometry(0.3, 0.6, 1.4, 10), 0x6b3fa0), 0, 0.7, 0));
    g.add(at(mk(sph(0.3), 0xffe0cc), 0, 1.7, 0));
    g.add(at(mk(new THREE.SphereGeometry(0.34, 14, 10, 0, 6.28, 0, 1.7), 0xe8e8ff), 0, 1.75, -0.03));
    g.add(at(mk(new THREE.ConeGeometry(0.7, 0.9, 10), 0x4a2a80), 0, 2.3, 0));
    g.add(at(mk(new THREE.TorusGeometry(0.62, 0.04, 6, 20), 0x4a2a80), 0, 1.9, 0));
    g.children[g.children.length - 1].rotation.x = Math.PI / 2;
    g.add(eye(-0.11, 1.7, 0.27, 0x8a2a8a), eye(0.11, 1.7, 0.27, 0x8a2a8a));
    g.add(at(mk(new THREE.OctahedronGeometry(0.15), 0xffe28a, { emissive: 0xffc95a, ei: 2, o: 0.02 }), 0.55, 1.5, 0.3));
  } else if (type === 'wisp') {
    g.add(at(mk(sph(0.45), 0xb64dff, { emissive: 0x8a1fd8, ei: 1.2 }), 0, 0, 0));
    g.add(at(mk(new THREE.ConeGeometry(0.28, 0.7, 8), 0xb64dff, { emissive: 0x8a1fd8, ei: 1 }), 0, 0.6, 0));
    g.add(eye(-0.16, 0.05, 0.4, 0xffffff), eye(0.16, 0.05, 0.4, 0xffffff));
    g.children[g.children.length - 2].scale.set(2, 2.5, 1); g.children[g.children.length - 1].scale.set(2, 2.5, 1);
  } else if (type === 'skel') {
    g.add(at(mk(new THREE.BoxGeometry(0.7, 1.0, 0.4), 0xe8dfc8), 0, 1.0, 0));
    g.add(at(mk(new THREE.BoxGeometry(0.5, 0.6, 0.3), 0xcfc4a8), 0, 0.3, 0));
    g.add(at(mk(sph(0.32), 0xf4ecd8), 0, 1.75, 0));
    g.add(at(mk(new THREE.BoxGeometry(0.3, 0.1, 0.1), 0x2a1a3a, { o: 0 }), 0, 1.65, 0.28));
    g.add(eye(-0.12, 1.8, 0.28, 0xff4f7b), eye(0.12, 1.8, 0.28, 0xff4f7b));
    g.add(at(mk(new THREE.BoxGeometry(0.1, 1.2, 0.05), 0xb8c4d8), 0.55, 1.1, 0.4));
  } else if (type === 'imp') {
    g.add(at(mk(new THREE.ConeGeometry(0.55, 1.4, 8), 0xd23a7a), 0, 0.7, 0));
    g.add(at(mk(sph(0.32), 0xff7ab5), 0, 1.6, 0));
    g.add(at(mk(new THREE.ConeGeometry(0.09, 0.35, 5), 0x3a1a4a), -0.2, 1.95, 0));
    g.add(at(mk(new THREE.ConeGeometry(0.09, 0.35, 5), 0x3a1a4a), 0.2, 1.95, 0));
    g.add(eye(-0.12, 1.62, 0.28, 0xffffff), eye(0.12, 1.62, 0.28, 0xffffff));
    g.add(at(mk(sph(0.2), 0xff5ce1, { basic: true, o: 0.02 }), 0.55, 1.1, 0.4));
  } else if (type === 'golem' || type === 'boss') {
    const boss = type === 'boss', stone = boss ? 0xbfb5a2 : 0xa59d8e, rune = boss ? 0x7df9ff : 0xffb04a, moss = 0x56c95a;
    const s = boss ? 1.45 : 1;
    const part = (geo, x, y, z, c = stone) => g.add(at(mk(geo, c, { o: 0.05 }), x * s, y * s, z * s));
    part(new THREE.BoxGeometry(1.9 * s, 1.9 * s, 1.2 * s), 0, 1.9, 0);
    part(new THREE.BoxGeometry(1.3 * s, 0.35 * s, 1.3 * s), 0, 2.95, 0, moss);
    part(new THREE.BoxGeometry(1.0 * s, 0.95 * s, 0.95 * s), 0, 3.5, 0.05);
    part(new THREE.BoxGeometry(0.8 * s, 1.2 * s, 0.8 * s), -0.55, 0.6, 0);
    part(new THREE.BoxGeometry(0.8 * s, 1.2 * s, 0.8 * s), 0.55, 0.6, 0);
    part(new THREE.BoxGeometry(0.8 * s, 1.9 * s, 0.8 * s), -1.45, 1.9, 0);
    part(new THREE.BoxGeometry(0.8 * s, 1.9 * s, 0.8 * s), 1.45, 1.9, 0);
    part(new THREE.BoxGeometry(1.0 * s, 0.8 * s, 1.0 * s), -1.45, 0.7, 0.1);
    part(new THREE.BoxGeometry(1.0 * s, 0.8 * s, 1.0 * s), 1.45, 0.7, 0.1);
    part(new THREE.BoxGeometry(0.9 * s, 0.25 * s, 0.9 * s), -1.45, 2.95, 0, moss);
    // glowing runes + eyes
    g.add(at(mk(new THREE.BoxGeometry(0.6 * s, 0.14 * s, 0.1), rune, { basic: true, o: 0 }), 0, 3.55 * s, 0.52 * s));
    g.add(at(mk(new THREE.OctahedronGeometry(0.32 * s), rune, { emissive: rune, ei: 2.2, o: 0.03 }), 0, 2.0 * s, 0.65 * s));
    for (const y of [1.3, 2.4]) g.add(at(mk(new THREE.BoxGeometry(1.3 * s, 0.07, 0.06), rune, { basic: true, o: 0 }), 0, y * s, 0.62 * s));
    g.userData.orbit = [];
    if (boss) {
      for (let i = 0; i < 4; i++) {
        const rk = mk(new THREE.OctahedronGeometry(0.45), stone, { o: 0.04 });
        const r2 = at(mk(new THREE.OctahedronGeometry(0.2), rune, { basic: true, o: 0 }), 0, 0, 0);
        rk.add(r2); g.add(rk); g.userData.orbit.push(rk);
      }
      const halo = at(mk(new THREE.TorusGeometry(1.1, 0.07, 6, 24), 0xffd66b, { emissive: 0xffc95a, ei: 1.2, o: 0.03 }), 0, 5.6, 0);
      halo.rotation.x = Math.PI / 2; g.add(halo);
    }
  }
  return g;
}
