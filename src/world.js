import * as THREE from 'three';
import { mk, at, rot, toonMat } from './toon.js';

const WHITE = 0xf6f1ea, GOLD = 0xffd66b, ROCK = 0x9a8aa8;
const cloudMat = toonMat(0xffffff, { emissive: 0x8fb4ff, emissiveIntensity: 0.38 }, false);
const cloudGeo = new THREE.SphereGeometry(1, 12, 9);

export const waterMats = [];
export const clouds = [];

export function makeSky() {
  const m = new THREE.Mesh(
    new THREE.SphereGeometry(300, 32, 16),
    new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
      fragmentShader: `varying vec3 vP; void main(){
        float h = vP.y;
        vec3 hor = vec3(1.0,0.90,0.70), mid = vec3(0.50,0.78,1.0), top = vec3(0.16,0.42,0.95);
        vec3 c = mix(hor, mid, smoothstep(-0.05,0.25,h));
        c = mix(c, top, smoothstep(0.22,0.85,h));
        c = mix(vec3(0.75,0.88,1.0), c, smoothstep(-0.35,-0.02,h));
        vec3 sun = normalize(vec3(0.5,0.32,-0.62));
        float s = max(dot(vP,sun),0.0);
        c += vec3(1.0,0.82,0.45) * (pow(s,10.0)*0.45 + step(0.9986,s)*1.6);
        gl_FragColor = vec4(c,1.0); }`,
    }),
  );
  m.renderOrder = -10;
  return m;
}

export function cloud(x, y, z, s = 1) {
  const g = new THREE.Group();
  const n = 5 + Math.floor(Math.random() * 3);
  for (let i = 0; i < n; i++) {
    const b = new THREE.Mesh(cloudGeo, cloudMat);
    const k = (1 - Math.abs(i - n / 2) / n) * (0.8 + Math.random() * 0.5);
    b.scale.set(k * 2.4, k * 1.5, k * 2);
    b.position.set((i - n / 2) * 1.8, Math.random() * 0.6, Math.random() * 1.4 - 0.7);
    g.add(b);
  }
  g.scale.setScalar(s);
  g.position.set(x, y, z);
  clouds.push({ g, v: 0.3 + Math.random() * 0.5, x0: x });
  return g;
}

export function tree(x, z, s = 1, leaf = 0x45cf5a) {
  const g = new THREE.Group();
  g.add(at(mk(new THREE.CylinderGeometry(0.22, 0.32, 2.2, 6), 0x7a5640), 0, 1.1, 0));
  g.add(at(mk(new THREE.SphereGeometry(1.5, 10, 8), leaf), 0, 3.2, 0));
  g.add(at(mk(new THREE.SphereGeometry(1.0, 10, 8), leaf + 0x101a10), 1.0, 2.7, 0.4));
  g.add(at(mk(new THREE.SphereGeometry(0.9, 10, 8), leaf + 0x0a1408), -0.9, 2.9, -0.4));
  g.position.set(x, 0, z); g.scale.setScalar(s);
  return g;
}

export function column(h = 6, broken = false) {
  const g = new THREE.Group();
  const hh = broken ? h * 0.55 : h;
  g.add(at(mk(new THREE.BoxGeometry(1.5, 0.4, 1.5), WHITE), 0, 0.2, 0));
  g.add(at(mk(new THREE.CylinderGeometry(0.5, 0.58, hh, 10), WHITE), 0, 0.4 + hh / 2, 0));
  g.add(rot(at(mk(new THREE.TorusGeometry(0.55, 0.07, 6, 12), GOLD), 0, 0.9, 0), Math.PI / 2, 0, 0));
  if (!broken) g.add(at(mk(new THREE.BoxGeometry(1.5, 0.4, 1.5), WHITE), 0, 0.4 + hh + 0.2, 0));
  else g.add(rot(at(mk(new THREE.BoxGeometry(0.9, 0.5, 0.8), WHITE), 1.3, 0.25, 0.7), 0, 0.6, 0));
  return g;
}

export function temple(w = 3) {
  const g = new THREE.Group();
  g.add(at(mk(new THREE.BoxGeometry(w * 3 + 3, 0.5, 9), WHITE), 0, 0.25, 0));
  g.add(at(mk(new THREE.BoxGeometry(w * 3 + 1.6, 0.5, 8), WHITE), 0, 0.75, 0));
  for (let i = 0; i < w + 1; i++) for (const z of [-3, 3]) {
    const c = column(5, false); c.position.set((i - w / 2) * 3, 1, z); g.add(c);
  }
  g.add(at(mk(new THREE.BoxGeometry(w * 3 + 1.4, 0.6, 7.6), WHITE), 0, 6.7, 0));
  const roof = mk(new THREE.CylinderGeometry(4.4, 4.4, w * 3 + 1.6, 3), 0x3f8fe0);
  roof.rotation.z = Math.PI / 2; roof.rotation.x = Math.PI / 2; roof.rotation.y = Math.PI / 2;
  roof.position.set(0, 8.2, 0); roof.scale.set(0.6, 1, 0.9);
  g.add(roof);
  return g;
}

export function island({ x, y, z, R, top = 0x6fd65c, rock = ROCK, trees = 4, ruin = false }) {
  const g = new THREE.Group();
  g.add(at(mk(new THREE.CylinderGeometry(R, R * 0.95, 1.4, 14), top), 0, -0.7, 0));
  const cone = mk(new THREE.ConeGeometry(R * 0.95, R * 1.5, 12), rock);
  cone.rotation.x = Math.PI; cone.position.y = -1.4 - R * 0.75;
  g.add(cone);
  for (let i = 0; i < 3; i++) {
    const a = i * 2.1 + 0.6;
    g.add(at(mk(new THREE.OctahedronGeometry(1 + i * 0.4), rock), Math.cos(a) * R * 0.5, -R * 1.2 - i * 1.6, Math.sin(a) * R * 0.5));
  }
  for (let i = 0; i < trees; i++) {
    const a = (i / trees) * 6.28 + 0.5, d = R * (0.35 + 0.35 * ((i * 37) % 10) / 10);
    g.add(tree(Math.cos(a) * d, Math.sin(a) * d, 0.8 + (i % 3) * 0.25));
  }
  if (ruin) { const t = temple(2); t.position.set(0, 0, 0); t.scale.setScalar(R > 14 ? 1 : 0.7); g.add(t); }
  g.position.set(x, y, z);
  g.userData = { R };
  return g;
}

export function bridge(a, b) {
  const g = new THREE.Group();
  const N = 12, up = new THREE.Vector3(0, 1, 0);
  const pt = (t) => new THREE.Vector3().lerpVectors(a, b, t).add(new THREE.Vector3(0, Math.sin(t * Math.PI) * 2.2, 0));
  for (let i = 0; i < N; i++) {
    const p = pt((i + 0.5) / N), q = pt((i + 1) / N), p0 = pt(i / N);
    const seg = mk(new THREE.BoxGeometry(2.6, 0.35, p0.distanceTo(q) + 0.05), WHITE);
    seg.position.copy(p);
    seg.lookAt(q.clone());
    seg.rotateY(0);
    g.add(seg);
    if (i % 2 === 0) {
      for (const s of [-1.2, 1.2]) {
        const post = mk(new THREE.CylinderGeometry(0.12, 0.12, 0.9, 6), GOLD);
        post.position.copy(p).add(new THREE.Vector3(0, 0.6, 0)).add(new THREE.Vector3().subVectors(q, p0).cross(up).normalize().multiplyScalar(s));
        g.add(post);
      }
    }
  }
  return g;
}

// animated waterfall sheet hanging off an island edge
export function waterfall(angle, R, h = 46, w = 4) {
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
    uniforms: { t: { value: 0 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
    fragmentShader: `uniform float t; varying vec2 vUv; void main(){
      float f = fract(vUv.y*9.0 + t*1.8 + sin(vUv.x*18.0)*0.12);
      float streak = step(0.78, f) * 0.85 + 0.12*sin(vUv.x*34.0 + t*3.0);
      vec3 c = mix(vec3(0.30,0.78,1.0), vec3(1.0), clamp(streak,0.0,1.0));
      float a = 0.88 * smoothstep(0.0,0.35,vUv.y) * (0.7 + 0.3*step(0.5,fract(vUv.x*5.0)));
      gl_FragColor = vec4(c, a); }`,
  });
  waterMats.push(mat);
  const g = new THREE.Group();
  const sheet = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
  sheet.position.set(0, -h / 2 + 0.1, 0);
  g.add(sheet);
  g.add(at(mk(new THREE.BoxGeometry(w + 0.4, 0.3, 1.4), 0xbfeaff, { emissive: 0x6fd0ff, ei: 0.6, o: 0.02 }), 0, 0.05, -0.6));
  g.position.set(Math.cos(angle) * (R + 0.3), 0, Math.sin(angle) * (R + 0.3));
  g.rotation.y = Math.atan2(Math.cos(angle), Math.sin(angle));
  g.userData.lip = g.position.clone();
  return g;
}

export function stream(angle, r0, r1, w = 2.6) {
  const len = r1 - r0, mid = (r0 + r1) / 2;
  const m = mk(new THREE.BoxGeometry(len, 0.08, w), 0x59c8ff, { emissive: 0x2a9bdd, ei: 0.7, o: 0 });
  m.position.set(Math.cos(angle) * mid, 0.07, Math.sin(angle) * mid);
  m.rotation.y = -angle;
  m.receiveShadow = true;
  return m;
}

export function castle() {
  const g = new THREE.Group();
  g.add(island({ x: 0, y: 0, z: 0, R: 20, trees: 3 }));
  const keep = mk(new THREE.BoxGeometry(10, 14, 8), WHITE); keep.position.y = 7; g.add(keep);
  g.add(rot(at(mk(new THREE.ConeGeometry(7.5, 9, 4), 0x3f8fe0), 0, 18.5, 0), 0, Math.PI / 4, 0));
  for (const [x, z, h] of [[-8, -6, 18], [8, -6, 18], [-8, 6, 14], [8, 6, 14], [0, -9, 22]]) {
    g.add(at(mk(new THREE.CylinderGeometry(2, 2.2, h, 10), WHITE), x, h / 2, z));
    g.add(at(mk(new THREE.ConeGeometry(2.8, 5, 10), 0xff7a6b), x, h + 2.5, z));
    g.add(at(mk(new THREE.BoxGeometry(0.5, 1.2, 0.3), GOLD, { emissive: 0xffc95a, ei: 1.4, o: 0.02 }), x, h * 0.6, z + 2.1));
  }
  return g;
}

export function crystal(x, z, color, s = 1) {
  const g = new THREE.Group();
  for (let i = 0; i < 4; i++) {
    const c = mk(new THREE.OctahedronGeometry(0.5 + Math.random() * 0.4), color, { emissive: color, ei: 1.8, o: 0.03 });
    c.scale.set(0.6, 1.6 + Math.random(), 0.6);
    c.position.set((Math.random() - 0.5) * 1.2, 0.9, (Math.random() - 0.5) * 1.2);
    c.rotation.z = (Math.random() - 0.5) * 0.5;
    g.add(c);
  }
  g.position.set(x, 0, z); g.scale.setScalar(s);
  return g;
}

export function motes(n = 160) {
  const pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { pos[i * 3] = (Math.random() - 0.5) * 70; pos[i * 3 + 1] = Math.random() * 16; pos[i * 3 + 2] = (Math.random() - 0.5) * 70; }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const p = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xffe08a, size: 0.28, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }));
  p.frustumCulled = false;
  return p;
}

export function updateWorld(t, dt, cam) {
  for (const m of waterMats) m.uniforms.t.value = t;
  for (const c of clouds) {
    c.g.position.x += c.v * dt;
    if (c.g.position.x - c.x0 > 120) c.g.position.x = c.x0 - 120;
  }
}
