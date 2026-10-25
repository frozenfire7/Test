import * as THREE from 'three';

// 4-step light ramp gives the hard-edged anime shading bands
const ramp = new THREE.DataTexture(new Uint8Array([70, 130, 200, 255]), 4, 1, THREE.RedFormat);
ramp.minFilter = ramp.magFilter = THREE.NearestFilter;
ramp.needsUpdate = true;

// fx=true adds a hard rim light and a glossy cel highlight (characters, props); off for flat ground
export function toonMat(color, extra = {}, fx = true) {
  const m = new THREE.MeshToonMaterial({ color, gradientMap: ramp, ...extra });
  if (fx) {
    m.onBeforeCompile = (sh) => {
      sh.fragmentShader = sh.fragmentShader.replace('#include <opaque_fragment>', `
        vec3 nn = normalize(normal);
        float rim = 1.0 - saturate(dot(nn, normalize(vViewPosition)));
        outgoingLight += vec3(0.55, 0.8, 1.0) * step(0.74, rim) * 0.2;
        float gl = dot(nn, normalize(vec3(-0.35, 0.65, 0.68)));
        outgoingLight += vec3(1.0) * step(0.94, gl) * 0.3;
        #include <opaque_fragment>`);
    };
    m.customProgramCacheKey = () => 'toonfx';
  }
  return m;
}

// Inverted-hull ink outline: back faces pushed out along normals
const outlineCache = new Map();
function outlineMat(thick, color) {
  const k = thick + ':' + color;
  if (!outlineCache.has(k)) {
    outlineCache.set(k, new THREE.ShaderMaterial({
      uniforms: { t: { value: thick }, c: { value: new THREE.Color(color) } },
      vertexShader: 'uniform float t; void main(){ gl_Position = projectionMatrix*modelViewMatrix*vec4(position+normal*t,1.0); }',
      fragmentShader: 'uniform vec3 c; void main(){ gl_FragColor = vec4(c,1.0); }',
      side: THREE.BackSide,
    }));
  }
  return outlineCache.get(k);
}

export function mk(geom, color, { o = 0.04, emissive = 0, ei = 1, shadow = true, basic = false, opacity = 1 } = {}) {
  const mat = basic
    ? new THREE.MeshBasicMaterial({ color, transparent: opacity < 1, opacity })
    : toonMat(color, emissive ? { emissive, emissiveIntensity: ei } : {});
  const m = new THREE.Mesh(geom, mat);
  m.castShadow = shadow;
  m.receiveShadow = true;
  if (o > 0) {
    const ol = new THREE.Mesh(geom, outlineMat(o, 0x140c28));
    ol.castShadow = false;
    m.add(ol);
  }
  return m;
}

export const at = (obj, x = 0, y = 0, z = 0) => { obj.position.set(x, y, z); return obj; };

export function stoneTexture(base = '#6a5f8f', line = '#463b6b') {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = base; g.fillRect(0, 0, 256, 256);
  g.strokeStyle = line; g.lineWidth = 6;
  for (let i = 0; i <= 256; i += 64) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, 256); g.stroke(); g.beginPath(); g.moveTo(0, i); g.lineTo(256, i); g.stroke(); }
  g.fillStyle = 'rgba(255,255,255,.07)';
  for (let i = 0; i < 40; i++) g.fillRect(Math.random() * 256, Math.random() * 256, 14, 6);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function grassTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#6fd65c'; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 70; i++) {
    g.fillStyle = Math.random() < 0.5 ? 'rgba(40,150,70,.22)' : 'rgba(210,255,120,.2)';
    g.beginPath(); g.ellipse(Math.random() * 256, Math.random() * 256, 10 + Math.random() * 22, 6 + Math.random() * 12, Math.random() * 3, 0, 6.3); g.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export const rot = (o, x = 0, y = 0, z = 0) => { o.rotation.set(x, y, z); return o; };
