// Renders the 24 body looks with three.js in headless Chromium.
// usage: node render.js <outdir> [only-key]
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const { build } = require('./mesh');

const OUT = process.argv[2];
const ONLY = process.argv[3];
fs.mkdirSync(OUT, { recursive: true });

// MakeHuman muscle and weight (0…1, 0.5 = average) for each look in public/body.js.
const LOOKS = {
  male: {
    now: { skinny: [0.3, 0], slim: [0.42, 0.25], average: [0.45, 0.62, 0.2], belly: [0.42, 0.88, 0.8], heavy: [0.38, 1.35, 0.6], bulky: [0.95, 0.85, 0.35] },
    want: { healthy: [0.55, 0.45], slim: [0.48, 0.28], toned: [0.72, 0.3], athletic: [0.88, 0.35], muscular: [1.08, 0.45], bodybuilder: [1.3, 0.45] },
  },
  female: {
    now: { skinny: [0.3, 0], slim: [0.4, 0.25], average: [0.42, 0.62, 0.2], belly: [0.4, 0.9, 0.7], heavy: [0.36, 1.35, 0.55], bulky: [0.85, 0.85, 0.3] },
    want: { healthy: [0.52, 0.45], slim: [0.45, 0.28], toned: [0.66, 0.32], curvy: [0.68, 0.62], athletic: [0.85, 0.36], fitness: [1.0, 0.3] },
  },
};
const OUTFIT = {
  male: { top: [0.62, 0.65, 0.7], bottom: [0.12, 0.13, 0.16], shoe: [0.1, 0.1, 0.12], hair: [0.13, 0.09, 0.07] },
  female: { top: [0.86, 0.33, 0.55], bottom: [0.16, 0.18, 0.24], shoe: [0.1, 0.1, 0.12], hair: [0.13, 0.09, 0.07] },
};

(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await b.newPage({ viewport: { width: 480, height: 800 } });
  page.on('pageerror', (e) => console.error('page', e.message));
  await page.setContent('<html><body style="margin:0;background:transparent"><canvas id="c" width="480" height="800"></canvas></body></html>');
  await page.addScriptTag({ path: path.join(__dirname, 'node_modules/three/build/three.min.js') });
  for (const sex of ['male', 'female']) {
    for (const kindOf of ['now', 'want']) {
      for (const [id, [muscle, weight, belly = 0]] of Object.entries(LOOKS[sex][kindOf])) {
        const key = `${sex}-${kindOf}-${id}`;
        if (ONLY && !key.includes(ONLY)) continue;
        const m = { ...build({ sex, muscle, weight, belly }), outfit: OUTFIT[sex] };
        const data = await page.evaluate((m) => {
          const T = window.THREE;
          const canvas = document.getElementById('c');
          const r = window.__r || (window.__r = new T.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true }));
          r.setPixelRatio(1);
          r.setSize(480, 800, false);
          r.outputColorSpace = T.SRGBColorSpace;
          r.toneMapping = T.ACESFilmicToneMapping;
          r.toneMappingExposure = 1.05;
          r.setClearColor(0x000000, 0);
          const scene = new T.Scene();
          // Turned a little, so the belly and the depth of the body show.
          const body = new T.Group(); body.rotation.y = -0.42; scene.add(body);
          const g = new T.BufferGeometry();
          g.setAttribute('position', new T.Float32BufferAttribute(m.p.flat(), 3));
          g.setAttribute('mask', new T.Float32BufferAttribute(m.masks.flat(), 4));
          const idx = [];
          for (const f of m.faces) for (let i = 1; i < f.length - 1; i++) idx.push(f[0], f[i], f[i + 1]);
          g.setIndex(idx);
          g.computeVertexNormals();
          const lin = (c) => new T.Color().setRGB(c[0], c[1], c[2], T.SRGBColorSpace);
          const mat = new T.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6, metalness: 0 });
          const U = { ...Object.fromEntries(Object.entries(m.u).map(([k, v]) => [k, { value: v }])),
            cSkin: { value: lin([0.8, 0.57, 0.44]) }, cTop: { value: lin(m.outfit.top) }, cBottom: { value: lin(m.outfit.bottom) },
            cShoe: { value: lin(m.outfit.shoe) }, cHair: { value: lin(m.outfit.hair) } };
          mat.onBeforeCompile = (sh) => {
            Object.assign(sh.uniforms, U);
            sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute vec4 mask; varying vec4 vMask; varying vec3 vP;')
              .replace('#include <begin_vertex>', '#include <begin_vertex>\nvMask = mask; vP = position;');
            sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
              varying vec4 vMask; varying vec3 vP;
              uniform float waist, shortsEnd, neck, eyeY, eyeZ, headTop, footTop, bottom, female;
              uniform vec3 cSkin, cTop, cBottom, cShoe, cHair;
              float edge(float a, float b) { return smoothstep(-0.03, 0.03, a - b); }`)
              .replace('#include <color_fragment>', `
              float y = vP.y; float ax = abs(vP.x); float z = vP.z;
              vec3 c = cSkin;
              float front = smoothstep(-0.3, 0.3, z);
              float neckline = neck + 0.25 - mix(0.45, female > 0.5 ? 1.0 : 1.15, front) + min(ax, 0.95) * mix(0.35, 1.05, front);
              float top = edge(vMask.x, 0.5) * edge(0.5, vMask.y) * edge(neckline, y) * edge(y, waist - 0.05);
              float bot = edge(0.5, vMask.y) * edge(0.5, vMask.z) * edge(0.5, vMask.w) * edge(waist, y) * edge(y, shortsEnd);
              float stripe = (1.0 - female) * edge(ax, 1.15) * edge(0.25, abs(z)) * edge(waist - 0.6, y);
              float hl = eyeY + (headTop - eyeY) * mix(female > 0.5 ? 0.05 : 0.32, 0.5, smoothstep(0.2, 0.9, z));
              float hair = edge(vMask.w, 0.5) * max(edge(y, hl), edge(y, eyeY - (female > 0.5 ? 0.9 : 0.4)) * edge(eyeZ - 1.1, z));
              float shoe = edge(vMask.z, 0.5) + edge(footTop + 0.25, y) * edge(vMask.z + vMask.y, 0.3) * 0.0;
              c = mix(c, cTop, top);
              c = mix(c, mix(cBottom, vec3(0.85), stripe * 0.9), bot);
              c = mix(c, y < bottom + 0.18 ? vec3(0.92) : cShoe, edge(vMask.z, 0.45));
              c = mix(c, cHair, hair);
              diffuseColor.rgb *= c;`);
          };
          body.add(new T.Mesh(g, mat));
          if (m.u.female) {
            // A ponytail behind the head.
            const hairMat = new T.MeshStandardMaterial({ color: lin(m.outfit.hair), roughness: 0.55 });
            const tail = new T.Mesh(new T.CapsuleGeometry(0.32, 1.6, 6, 16), hairMat);
            tail.position.set(0, m.u.eyeY - 0.95, m.u.eyeZ - 2.15);
            tail.rotation.x = 0.35;
            body.add(tail);
            // A bun on top, seen from the front.
            const bun = new T.Mesh(new T.SphereGeometry(0.5, 24, 16), hairMat);
            bun.scale.set(1, 0.8, 1);
            bun.position.set(0, m.u.headTop + 0.15, m.u.eyeZ - 1.75);
            body.add(bun);
          }
          // Eyes
          for (const e of m.eyes) {
            const white = new T.Mesh(new T.SphereGeometry(0.115, 24, 16), new T.MeshStandardMaterial({ color: 0xeeeeee, roughness: 0.3 }));
            white.position.set(e[0], e[1], e[2]);
            body.add(white);
            const iris = new T.Mesh(new T.SphereGeometry(0.06, 16, 12), new T.MeshStandardMaterial({ color: 0x2a1a10, roughness: 0.3 }));
            iris.position.set(e[0], e[1], e[2] + 0.075);
            body.add(iris);
          }
          // Studio light: key from the front-left, fill from the right, rim from behind.
          scene.add(new T.HemisphereLight(0xffffff, 0x554433, 0.9));
          const key = new T.DirectionalLight(0xfff1e0, 2.4); key.position.set(-6, 8, 10); scene.add(key);
          const fill = new T.DirectionalLight(0xdde8ff, 0.7); fill.position.set(8, 2, 6); scene.add(fill);
          const rim = new T.DirectionalLight(0xffffff, 1.6); rim.position.set(3, 6, -10); scene.add(rim);
          const rim2 = new T.DirectionalLight(0xffffff, 1.0); rim2.position.set(-5, 4, -8); scene.add(rim2);
          // Soft shadow on the floor.
          const sh = document.createElement('canvas'); sh.width = sh.height = 128;
          const cx = sh.getContext('2d'); const gr = cx.createRadialGradient(64, 64, 4, 64, 64, 64);
          gr.addColorStop(0, 'rgba(0,0,0,0.35)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); cx.fillStyle = gr; cx.fillRect(0, 0, 128, 128);
          const floor = new T.Mesh(new T.PlaneGeometry(7, 2.2), new T.MeshBasicMaterial({ map: new T.CanvasTexture(sh), transparent: true, depthWrite: false }));
          floor.rotation.x = -Math.PI / 2; floor.position.y = m.bottom + 0.01; scene.add(floor);
          // The same camera for every body, so sizes compare.
          const cam = new T.PerspectiveCamera(16, 480 / 800, 1, 400);
          const midY = m.bottom + 8.4;
          cam.position.set(0, midY + 1.5, 68);
          cam.lookAt(0, midY, 0);
          r.render(scene, cam);
          g.dispose();
          return canvas.toDataURL('image/webp', 0.86);
        }, m);
        fs.writeFileSync(path.join(OUT, `${key}.webp`), Buffer.from(data.split(',')[1], 'base64'));
        console.log(key, Math.round(data.length * 0.75 / 1024), 'KB');
      }
    }
  }
  await b.close();
})();
