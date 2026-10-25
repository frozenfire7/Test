import * as THREE from 'three';
import { mk, at } from './toon.js';

const sph = (r) => new THREE.SphereGeometry(r, 14, 10);
const eye = (x, y, z, c = 0xffffff) => at(mk(new THREE.SphereGeometry(0.06, 6, 5), c, { basic: true, o: 0 }), x, y, z);

export function buildHero() {
  const g = new THREE.Group();
  const body = new THREE.Group();
  g.add(body);
  body.add(at(mk(new THREE.CylinderGeometry(0.28, 0.5, 0.95, 10), 0x1f2b6e), 0, 0.5, 0)); // robe
  body.add(at(mk(new THREE.CylinderGeometry(0.3, 0.3, 0.5, 10), 0xf4f1ff), 0, 1.15, 0)); // tunic
  body.add(at(mk(new THREE.TorusGeometry(0.3, 0.05, 6, 14), 0xffd66b), 0, 0.88, 0)); // belt
  body.add(at(mk(sph(0.3), 0xffe0cc), 0, 1.6, 0)); // head
  body.add(at(mk(new THREE.SphereGeometry(0.34, 14, 10, 0, 6.28, 0, 1.6), 0x7be8ff), 0, 1.65, -0.02)); // hair cap
  for (let i = 0; i < 5; i++) {
    const a = (i - 2) * 0.5;
    const spike = at(mk(new THREE.ConeGeometry(0.1, 0.4, 6), 0x7be8ff), Math.sin(a) * 0.3, 1.9, Math.cos(a) * 0.1 - 0.1);
    spike.rotation.z = -a * 0.6; spike.rotation.x = -0.3;
    body.add(spike);
  }
  body.add(at(mk(new THREE.BoxGeometry(0.35, 0.3, 0.12), 0x7be8ff), 0, 1.75, 0.27)); // bangs
  body.add(eye(-0.11, 1.58, 0.26, 0x3a1b8a), eye(0.11, 1.58, 0.26, 0x3a1b8a));
  body.add(at(mk(new THREE.BoxGeometry(0.05, 0.05, 0.02), 0xffffff, { basic: true, o: 0 }), -0.11, 1.6, 0.285));
  const cape = new THREE.Group();
  cape.add(at(mk(new THREE.BoxGeometry(0.65, 1.1, 0.06), 0xd22a55), 0, -0.55, 0));
  cape.position.set(0, 1.4, -0.3);
  body.add(cape);
  // sword arm
  const arm = new THREE.Group();
  arm.position.set(0.4, 1.35, 0);
  arm.add(at(mk(new THREE.CylinderGeometry(0.09, 0.08, 0.6, 6), 0xf4f1ff), 0, -0.3, 0));
  arm.add(at(mk(sph(0.1), 0xffe0cc), 0, -0.62, 0));
  const hilt = at(mk(new THREE.BoxGeometry(0.32, 0.06, 0.06), 0xffd66b), 0, -0.55, 0.0);
  hilt.rotation.x = Math.PI / 2;
  const blade = at(mk(new THREE.BoxGeometry(0.16, 1.5, 0.05), 0x7df9ff, { basic: true, o: 0.03 }), 0, -1.3, 0);
  // blade points along arm direction (-y); rotating arm.x swings it
  arm.add(hilt, blade);
  arm.rotation.x = -0.5;
  body.add(arm);
  const off = at(mk(new THREE.CylinderGeometry(0.08, 0.07, 0.6, 6), 0xf4f1ff), -0.4, 1.1, 0.05);
  off.rotation.z = 0.2;
  body.add(off);
  g.userData = { arm, body, cape, blade };
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
    const boss = type === 'boss', c = boss ? 0x40305e : 0x8a8aa8, gl = boss ? 0xff7ad9 : 0xffb04a;
    const s = boss ? 1.3 : 1;
    g.add(at(mk(new THREE.BoxGeometry(1.8 * s, 1.8 * s, 1.1 * s), c), 0, 1.6 * s, 0));
    g.add(at(mk(new THREE.BoxGeometry(0.9 * s, 0.9 * s, 0.9 * s), c), 0, 3.0 * s, 0));
    g.add(at(mk(new THREE.BoxGeometry(0.7 * s, 1.1 * s, 0.7 * s), c), -0.5 * s, 0.55 * s, 0));
    g.add(at(mk(new THREE.BoxGeometry(0.7 * s, 1.1 * s, 0.7 * s), c), 0.5 * s, 0.55 * s, 0));
    g.add(at(mk(new THREE.BoxGeometry(0.7 * s, 1.8 * s, 0.7 * s), c), -1.2 * s, 1.6 * s, 0));
    g.add(at(mk(new THREE.BoxGeometry(0.7 * s, 1.8 * s, 0.7 * s), c), 1.2 * s, 1.6 * s, 0));
    g.add(at(mk(new THREE.BoxGeometry(0.5 * s, 0.14 * s, 0.1), gl, { basic: true, o: 0 }), 0, 3.05 * s, 0.46 * s));
    g.add(at(mk(new THREE.OctahedronGeometry(0.35 * s), gl, { emissive: gl, ei: 2, o: 0.02 }), 0, 1.8 * s, 0.6 * s));
    if (boss) {
      const crown = at(mk(new THREE.TorusGeometry(0.8, 0.07, 6, 6), 0xffd66b), 0, 4.1 * s, 0);
      crown.rotation.x = Math.PI / 2;
      g.add(crown);
      g.add(at(mk(new THREE.ConeGeometry(1.4, 2.4, 8, 1, true), 0x7a3f6b, { o: 0.05 }), 0, 1.2 * s, -0.7));
    }
  }
  return g;
}
