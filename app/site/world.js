/* 群島製圖所：3D 島嶼世界（Three.js）
   ISLE.World.create(container, cfg, hooks) → world
   cfg = 網站設定（表單 state）。hooks：onPick(info)、onFrame()。 */
(function () {
  const ISLE = window.ISLE;
  const U = ISLE.U, D = ISLE.DATA;
  const T = window.THREE;
  const TAU = Math.PI * 2;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const ease = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

  /* 各島形的地面配色 */
  const GROUND = {
    sea: { top: '#7cbf5a', beach: '#f1dca3', rock: '#8a7f6e', tree: 'round' },
    float: { top: '#86c65e', beach: '#9c7a52', rock: '#76707c', tree: 'round' },
    atoll: { top: '#8fd06a', beach: '#fbe9b9', rock: '#bfae8a', tree: 'palm' },
    terrace: { top: '#8cc063', beach: '#b88f60', rock: '#8a6d4c', tree: 'round' },
    volcano: { top: '#6a9a4b', beach: '#3b3532', rock: '#4b4340', tree: 'pine' },
    snow: { top: '#f4f8fb', beach: '#cfe3ee', rock: '#9fb2c0', tree: 'snowpine' },
    desert: { top: '#e8c37a', beach: '#f1d39a', rock: '#c39a5c', tree: 'cactus' },
    jungle: { top: '#4f8f3a', beach: '#e9d49b', rock: '#6d6150', tree: 'jungle' },
    mushroom: { top: '#a6d17e', beach: '#eadcb8', rock: '#9b8c78', tree: 'mushroom' }
  };

  /* 一天的光線關鍵影格：night = 夜晚程度，dusk = 黃昏程度 */
  const TOD_KEYS = [
    [0, { sun: 0.05, hemi: 0.25, sunC: '#7d8fd6', night: 1, dusk: 0 }],
    [5, { sun: 0.05, hemi: 0.25, sunC: '#7d8fd6', night: 1, dusk: 0 }],
    [6.3, { sun: 0.55, hemi: 0.5, sunC: '#ffb27a', night: 0.35, dusk: 0.8 }],
    [8, { sun: 0.95, hemi: 0.68, sunC: '#fff3dc', night: 0, dusk: 0 }],
    [16.3, { sun: 0.95, hemi: 0.68, sunC: '#fff3dc', night: 0, dusk: 0 }],
    [17.9, { sun: 0.6, hemi: 0.5, sunC: '#ff8a4c', night: 0.15, dusk: 1 }],
    [19.3, { sun: 0.1, hemi: 0.3, sunC: '#8a7fd0', night: 0.9, dusk: 0.25 }],
    [20.5, { sun: 0.05, hemi: 0.25, sunC: '#7d8fd6', night: 1, dusk: 0 }],
    [24, { sun: 0.05, hemi: 0.25, sunC: '#7d8fd6', night: 1, dusk: 0 }]
  ];
  function todState(h) {
    h = ((h % 24) + 24) % 24;
    for (let i = 0; i < TOD_KEYS.length - 1; i++) {
      const [h0, a] = TOD_KEYS[i], [h1, b] = TOD_KEYS[i + 1];
      if (h >= h0 && h <= h1) {
        const t = (h - h0) / (h1 - h0 || 1);
        return {
          sun: lerp(a.sun, b.sun, t), hemi: lerp(a.hemi, b.hemi, t), night: lerp(a.night, b.night, t), dusk: lerp(a.dusk, b.dusk, t),
          sunC: new T.Color(a.sunC).lerp(new T.Color(b.sunC), t)
        };
      }
    }
    return { sun: 1, hemi: 0.7, night: 0, dusk: 0, sunC: new T.Color('#fff') };
  }

  function create(container, cfg, hooks) {
    hooks = hooks || {};
    const W = {}; // 對外的 world 物件
    let renderer;
    try {
      renderer = new T.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    } catch (e) {
      return null; // 不支援 WebGL：由 UI 改用文字清單
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor(0x000000, 0);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = T.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);
    renderer.domElement.className = 'isle-canvas';

    const scene = new T.Scene();
    const camera = new T.PerspectiveCamera(42, 1, 0.1, 900);
    const hemi = new T.HemisphereLight(0xffffff, 0x6b7f5a, 0.7);
    const sun = new T.DirectionalLight(0xffffff, 1);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.bias = -0.0008;
    const amb = new T.AmbientLight(0xffffff, 0.12);
    scene.add(hemi, sun, sun.target, amb);
    scene.fog = new T.Fog(0xffffff, 120, 400);

    let root = null;          // 這一輪建出來的所有東西
    let anim = [];            // 每格要更新的函式 (t, dt) => void
    let nightMats = [];       // 晚上會亮的材質 [{mat, base}]
    let pickables = [];       // 可以點的物件
    let isles = [];           // [{index, pos:Vector3, r, top, group, labelY, name}]
    let extent = 30;
    let waterMesh = null, waterBase = null;
    let stars = null, fireflies = null;
    let reduced = false;
    let tod = 10, todMode = 'fixed';
    let mood = 'normal';
    let S = null; // 目前的風格參數
    let M = null; // 材質工廠
    let rpg = null; // RPG 角色
    let shells = [];

    /* ---------- 材質工廠（依風格調色） ---------- */
    function makeMaterials(st) {
      const cache = new Map();
      let grad = null;
      if (st.shade === 'toon') {
        const data = new Uint8Array([90, 170, 255]);
        grad = new T.DataTexture(data, 3, 1, T.RedFormat);
        grad.minFilter = grad.magFilter = T.NearestFilter;
        grad.needsUpdate = true;
      }
      const warmC = new T.Color('#ffb070'), coolC = new T.Color('#7fc8ff');
      function adj(hex) {
        const c = new T.Color(hex);
        const hsl = {}; c.getHSL(hsl);
        hsl.s = clamp(hsl.s * (st.sat || 1), 0, 1);
        hsl.l = clamp(hsl.l * (st.light || 1), 0, 0.97);
        c.setHSL(hsl.h, hsl.s, hsl.l);
        if (st.warm) c.lerp(warmC, st.warm);
        if (st.cool) c.lerp(coolC, st.cool);
        return c;
      }
      function m(hex, o) {
        o = o || {};
        const key = hex + '|' + JSON.stringify(o);
        if (cache.has(key)) return cache.get(key);
        const color = adj(hex);
        let mat;
        const base = { color, transparent: !!o.transparent, opacity: o.opacity == null ? 1 : o.opacity, side: o.side || T.FrontSide };
        if (o.basic) mat = new T.MeshBasicMaterial(Object.assign(base, { fog: o.fog !== false }));
        else if (st.shade === 'toon') mat = new T.MeshToonMaterial(Object.assign(base, { gradientMap: grad }));
        else mat = new T.MeshStandardMaterial(Object.assign(base, { roughness: o.rough == null ? 0.88 : o.rough, metalness: o.metal || 0, flatShading: st.shade === 'flat' }));
        if (!o.basic) {
          if (o.glow) { mat.emissive = new T.Color(o.glow); mat.emissiveIntensity = 0; nightMats.push({ mat, base: o.glowMin || 0, max: o.glowMax || 1.1 }); }
          else if (st.emissive) { mat.emissive = color.clone(); mat.emissiveIntensity = st.emissive * 0.18; }
        }
        cache.set(key, mat);
        return mat;
      }
      m.adj = adj;
      m.outline = new T.MeshBasicMaterial({ color: st.name === '復古紙張' ? '#5a4632' : '#2c241c', side: T.BackSide });
      return m;
    }

    /* ---------- 幾何小工具 ---------- */
    const GEO = {};
    function geo(key, fn) { return GEO[key] || (GEO[key] = fn()); }
    function mesh(g, mat, o) {
      const me = new T.Mesh(g, mat);
      if (!o || o.shadow !== false) { me.castShadow = true; me.receiveShadow = true; }
      return me;
    }
    function outlined(me, s) {
      if (!S.outline) return me;
      const o = new T.Mesh(me.geometry, M.outline);
      o.scale.setScalar(s || 1.05);
      me.add(o);
      return me;
    }
    function segs(n) { return S.blocky ? Math.max(4, Math.round(n / 3)) : (S.shade === 'flat' ? Math.max(5, Math.round(n * 0.6)) : n); }

    // 外緣有起伏的圓柱
    function jagged(rTop, rBot, h, n, rng, amt) {
      const g = new T.CylinderGeometry(rTop, rBot, h, n, 1);
      const p = g.attributes.position;
      const offs = [];
      for (let i = 0; i <= n; i++) offs.push(1 + (rng() - 0.5) * (amt || 0.12));
      offs[n] = offs[0];
      for (let i = 0; i < p.count; i++) {
        const x = p.getX(i), z = p.getZ(i);
        const rr = Math.hypot(x, z);
        if (rr < 1e-4) continue;
        let a = Math.atan2(z, x); if (a < 0) a += TAU;
        const k = offs[Math.round(a / TAU * n) % (n + 1)];
        p.setX(i, x * k); p.setZ(i, z * k);
      }
      g.computeVertexNormals();
      return g;
    }

    /* ---------- 小物件 ---------- */
    function tree(kind, s, rng) {
      const g = new T.Group();
      const trunkM = M('#8a5a36');
      if (S.blocky && kind !== 'cactus' && kind !== 'mushroom') {
        const t = mesh(geo('bt', () => new T.BoxGeometry(0.3, 1, 0.3)), trunkM); t.position.y = 0.5; g.add(t);
        const c = mesh(geo('bc', () => new T.BoxGeometry(1.1, 1.1, 1.1)), M(kind === 'sakura' ? '#f4a6c4' : kind === 'snowpine' ? '#e8f1f5' : '#4f9e45')); c.position.y = 1.4; g.add(outlined(c));
        g.scale.setScalar(s); return g;
      }
      switch (kind) {
        case 'pine': case 'snowpine': {
          const t = mesh(geo('pt', () => new T.CylinderGeometry(0.1, 0.14, 0.6, 5)), trunkM); t.position.y = 0.3; g.add(t);
          for (let i = 0; i < 3; i++) {
            const c = mesh(geo('pc' + i, () => new T.ConeGeometry(0.8 - i * 0.2, 0.9, segs(8))), M(kind === 'snowpine' && i === 2 ? '#f2f7fa' : kind === 'snowpine' ? '#3f6e58' : '#3f7d4a'));
            c.position.y = 0.8 + i * 0.5; g.add(i === 0 ? outlined(c) : c);
          }
          break;
        }
        case 'palm': case 'jungle': {
          const trunk = new T.Group();
          for (let i = 0; i < 5; i++) {
            const seg = mesh(geo('ps', () => new T.CylinderGeometry(0.09, 0.12, 0.45, 6)), M('#a07a4f'));
            seg.position.set(i * i * 0.012, 0.22 + i * 0.42, 0); seg.rotation.z = -i * 0.05; trunk.add(seg);
          }
          g.add(trunk);
          const leafG = geo('pl', () => { const gg = new T.ConeGeometry(0.22, 1.4, 4); gg.rotateZ(Math.PI / 2); gg.translate(0.7, 0, 0); gg.scale(1, 0.25, 1); return gg; });
          const n = kind === 'jungle' ? 7 : 6;
          for (let i = 0; i < n; i++) {
            const l = mesh(leafG, M(kind === 'jungle' ? '#2f7a37' : '#4a9a3e'));
            l.position.set(0.2, 2.2, 0); l.rotation.y = i / n * TAU; l.rotation.z = -0.35; g.add(l);
          }
          if (kind === 'jungle') {
            const c = mesh(geo('jc', () => new T.IcosahedronGeometry(0.8, 0)), M('#2f6e33')); c.position.y = 1.4; c.scale.set(1.1, 0.8, 1.1); g.add(outlined(c));
          }
          break;
        }
        case 'cactus': {
          const cm = M('#5f9a4a');
          const b = mesh(geo('cb', () => new T.CylinderGeometry(0.22, 0.25, 1.4, segs(8))), cm); b.position.y = 0.7; g.add(outlined(b));
          const a1 = mesh(geo('ca', () => new T.CylinderGeometry(0.12, 0.12, 0.6, segs(6))), cm); a1.position.set(0.32, 0.9, 0); g.add(a1);
          const a2 = a1.clone(); a2.position.set(-0.3, 0.7, 0); a2.scale.y = 0.7; g.add(a2);
          break;
        }
        case 'mushroom': {
          const st = mesh(geo('ms', () => new T.CylinderGeometry(0.18, 0.26, 1, segs(8))), M('#f3ead8')); st.position.y = 0.5; g.add(st);
          const cap = mesh(geo('mc', () => new T.SphereGeometry(0.75, segs(14), 8, 0, TAU, 0, Math.PI / 2)), M(rng() < 0.7 ? '#d8443a' : '#8c5bd6')); cap.position.y = 0.95; cap.scale.y = 0.75; g.add(outlined(cap));
          for (let i = 0; i < 5; i++) {
            const d = mesh(geo('md', () => new T.SphereGeometry(0.09, 6, 4)), M('#ffffff'));
            const a = i / 5 * TAU + rng(); d.position.set(Math.cos(a) * 0.42, 1.25, Math.sin(a) * 0.42); g.add(d);
          }
          break;
        }
        default: { // round / sakura
          const t = mesh(geo('rt', () => new T.CylinderGeometry(0.1, 0.15, 0.9, 6)), trunkM); t.position.y = 0.45; g.add(t);
          const cm = kind === 'sakura' ? M(rng() < 0.5 ? '#f6b3cc' : '#f39bbd') : M(rng() < 0.5 ? '#5fae4e' : '#4f9a45');
          const c = mesh(geo('rc', () => new T.IcosahedronGeometry(0.65, S.shade === 'flat' ? 0 : 1)), cm); c.position.y = 1.25; g.add(outlined(c));
          const c2 = mesh(geo('rc2', () => new T.IcosahedronGeometry(0.42, S.shade === 'flat' ? 0 : 1)), cm); c2.position.set(0.35, 1.0, 0.15); g.add(c2);
        }
      }
      g.scale.setScalar(s);
      g.rotation.y = rng() * TAU;
      return g;
    }

    const WALLS = ['#f4ede1', '#f2d9b8', '#e9e3f2', '#dfeee6', '#f6e1d6', '#e8eef5'];
    const ROOFS = ['#c8553d', '#3f6fa0', '#5e8c4a', '#a2643c', '#7a5ba6', '#d08a2e'];
    function house(o, rng) {
      o = o || {};
      const g = new T.Group();
      const w = o.w || 1.4, d = o.d || 1.2, h = o.h || 1.1;
      const wall = mesh(new T.BoxGeometry(w, h, d), M(o.wall || WALLS[Math.floor(rng() * WALLS.length)]));
      wall.position.y = h / 2; g.add(outlined(wall, 1.03));
      const roofC = o.roof || ROOFS[Math.floor(rng() * ROOFS.length)];
      let roof;
      if (o.flat) {
        roof = mesh(new T.BoxGeometry(w * 1.08, 0.15, d * 1.08), M(roofC)); roof.position.y = h + 0.07;
      } else {
        roof = mesh(new T.ConeGeometry(Math.max(w, d) * 0.82, h * 0.7, 4), M(roofC));
        roof.position.y = h + h * 0.35; roof.rotation.y = Math.PI / 4; roof.scale.set(w / Math.max(w, d), 1, d / Math.max(w, d));
      }
      g.add(outlined(roof, 1.04));
      const door = mesh(geo('door', () => new T.BoxGeometry(0.3, 0.5, 0.05)), M('#6b4a32'), { shadow: false });
      door.position.set(0, 0.25, d / 2 + 0.01); g.add(door);
      const winM = M('#7aa6c8', { glow: '#ffd27a' });
      const nWin = Math.max(1, Math.round(w / 0.7));
      for (let i = 0; i < nWin; i++) {
        const wi = mesh(geo('win', () => new T.BoxGeometry(0.24, 0.24, 0.04)), winM, { shadow: false });
        wi.position.set(-w / 2 + (i + 0.5) * (w / nWin), h * 0.65, d / 2 + 0.02);
        if (Math.abs(wi.position.x) < 0.2 && h < 1.4) wi.position.y = h * 0.78;
        g.add(wi);
        const wb = wi.clone(); wb.position.z = -d / 2 - 0.02; g.add(wb);
      }
      if (o.chimney) { const c = mesh(geo('chim', () => new T.BoxGeometry(0.2, 0.5, 0.2)), M('#8b6f5a')); c.position.set(w * 0.25, h + 0.45, 0); g.add(c); }
      if (o.flag) g.add(flag(o.flagColor || cfg.theme.accent, h + (o.flat ? 0.2 : h * 0.7), 0));
      return g;
    }
    function flag(color, y, x) {
      const g = new T.Group();
      const pole = mesh(geo('fp', () => new T.CylinderGeometry(0.03, 0.03, 1, 5)), M('#d9d4cc')); pole.position.y = 0.5; g.add(pole);
      const f = mesh(geo('ff', () => { const gg = new T.PlaneGeometry(0.5, 0.3); gg.translate(0.25, 0, 0); return gg; }), M(color, { side: T.DoubleSide }));
      f.position.set(0.02, 0.85, 0); g.add(f);
      g.position.set(x || 0, y, 0);
      anim.push(t => { f.rotation.y = Math.sin(t * 3 + y) * 0.35; });
      return g;
    }
    function lamp() {
      const g = new T.Group();
      const p = mesh(geo('lp', () => new T.CylinderGeometry(0.04, 0.05, 1.1, 5)), M('#4a4a52')); p.position.y = 0.55; g.add(p);
      const hd = mesh(geo('lh', () => new T.SphereGeometry(0.12, 8, 6)), M('#fff6d8', { glow: '#ffd27a', glowMax: 1.6 }), { shadow: false }); hd.position.y = 1.15; g.add(hd);
      return g;
    }
    function rock(s, rng) {
      const r = mesh(geo('rock', () => new T.DodecahedronGeometry(0.4, 0)), M(rng() < 0.5 ? '#9a948a' : '#86807a'));
      r.scale.set(s * (0.8 + rng() * 0.5), s * (0.5 + rng() * 0.4), s * (0.8 + rng() * 0.5)); r.rotation.set(rng(), rng() * 3, rng());
      return r;
    }
    function bush(rng) {
      const b = mesh(geo('bush', () => new T.IcosahedronGeometry(0.3, 0)), M(rng() < 0.5 ? '#5aa64a' : '#6bb85a'));
      b.scale.set(1, 0.75, 1); b.position.y = 0.18; return b;
    }
    function flowerPatch(rng, n) {
      const g = new T.Group();
      const cols = ['#f25f7a', '#f7c948', '#ffffff', '#a477e6', '#ff9a3c'];
      for (let i = 0; i < (n || 7); i++) {
        const f = mesh(geo('fl', () => new T.SphereGeometry(0.08, 6, 4)), M(cols[Math.floor(rng() * cols.length)]), { shadow: false });
        f.position.set((rng() - 0.5) * 0.9, 0.12, (rng() - 0.5) * 0.9); g.add(f);
      }
      return g;
    }
    function fence(len) {
      const g = new T.Group(); const fm = M('#c9a97e');
      const n = Math.max(2, Math.round(len / 0.35));
      for (let i = 0; i < n; i++) { const p = mesh(geo('fpost', () => new T.BoxGeometry(0.06, 0.35, 0.06)), fm); p.position.set(-len / 2 + i * len / (n - 1), 0.17, 0); g.add(p); }
      const rail = mesh(new T.BoxGeometry(len, 0.05, 0.04), fm); rail.position.y = 0.26; g.add(rail);
      return g;
    }
    function bench() {
      const g = new T.Group(); const bm = M('#a8754a');
      const s = mesh(geo('bs', () => new T.BoxGeometry(0.7, 0.06, 0.25)), bm); s.position.y = 0.25; g.add(s);
      const b = mesh(geo('bb', () => new T.BoxGeometry(0.7, 0.25, 0.05)), bm); b.position.set(0, 0.4, -0.11); g.add(b);
      return g;
    }
    function crate() { const c = mesh(geo('crate', () => new T.BoxGeometry(0.35, 0.35, 0.35)), M('#b98a55')); c.position.y = 0.17; return c; }

    function person(colors, rng) {
      const g = new T.Group();
      const shirt = colors && colors[0] || ['#e8684a', '#3f6fa0', '#f2c14e', '#5e9c63', '#8a63c8'][Math.floor(rng() * 5)];
      const body = mesh(geo('pb', () => new T.CylinderGeometry(0.14, 0.18, 0.45, 8)), M(shirt)); body.position.y = 0.42; g.add(body);
      const head = mesh(geo('ph', () => new T.SphereGeometry(0.13, 10, 8)), M(colors && colors[1] || '#f2cfae')); head.position.y = 0.78; g.add(head);
      const hair = mesh(geo('phair', () => new T.SphereGeometry(0.135, 10, 6, 0, TAU, 0, Math.PI / 2)), M(['#3a2a20', '#6b4a2a', '#1f1f24', '#c98f4a'][Math.floor(rng() * 4)])); hair.position.y = 0.8; g.add(hair);
      const legs = mesh(geo('pl', () => new T.CylinderGeometry(0.11, 0.1, 0.22, 6)), M('#3b4252')); legs.position.y = 0.1; g.add(legs);
      const armG = geo('parm', () => { const gg = new T.BoxGeometry(0.06, 0.3, 0.06); gg.translate(0, -0.13, 0); return gg; });
      const armL = mesh(armG, M(shirt)); armL.position.set(-0.19, 0.6, 0); g.add(armL);
      const armR = mesh(armG, M(shirt)); armR.position.set(0.19, 0.6, 0); g.add(armR);
      g.userData.armR = armR; g.userData.armL = armL; g.userData.body = body;
      return g;
    }

    function boat(rng, big) {
      const g = new T.Group();
      const hull = mesh(geo('hull', () => { const gg = new T.CylinderGeometry(0.45, 0.25, 0.3, 4, 1); gg.scale(1, 1, 2.2); gg.rotateY(Math.PI / 4); return gg; }), M('#8b5a3c'));
      hull.position.y = 0.1; g.add(hull);
      if (big !== false) {
        const mast = mesh(geo('mast', () => new T.CylinderGeometry(0.03, 0.03, 1.4, 5)), M('#e8e2d8')); mast.position.y = 0.8; g.add(mast);
        const sail = mesh(geo('sail', () => { const sh = new T.Shape(); sh.moveTo(0, 0); sh.lineTo(0, 1.2); sh.lineTo(0.8, 0); sh.lineTo(0, 0); return new T.ShapeGeometry(sh); }), M(rng() < 0.5 ? '#ffffff' : cfg.theme.accent, { side: T.DoubleSide }));
        sail.position.set(0.03, 0.25, 0); sail.rotation.y = Math.PI / 2; g.add(sail);
      }
      return g;
    }

    /* ---------- 動物 ---------- */
    function animalMesh(a, rng) {
      const g = new T.Group();
      const c = M(a.color), dark = M('#2b2b30');
      const s = a.size;
      if (a.kind === 'quad') {
        const body = mesh(geo('ab', () => new T.SphereGeometry(0.5, segs(10), 8)), c); body.scale.set(0.75, 0.6, 1.1); body.position.y = 0.55 * (a.legs || 1); g.add(outlined(body));
        if (a.fluffy) body.scale.multiplyScalar(1.2);
        const head = mesh(geo('ah', () => new T.SphereGeometry(0.32, segs(10), 8)), a.panda ? M('#f5f5f5') : c); head.position.set(0, 0.85 * (a.legs || 1), 0.55); g.add(outlined(head));
        const legG = geo('al', () => { const gg = new T.CylinderGeometry(0.07, 0.07, 0.45, 5); gg.translate(0, -0.22, 0); return gg; });
        const legs = [];
        [[-0.2, 0.3], [0.2, 0.3], [-0.2, -0.3], [0.2, -0.3]].forEach(([x, z]) => {
          const l = mesh(legG, a.panda ? dark : c); l.position.set(x, 0.42 * (a.legs || 1), z); l.scale.y = a.legs || 1; g.add(l); legs.push(l);
        });
        g.userData.legs = legs;
        const earG = geo('ae', () => new T.ConeGeometry(0.08, a.ears ? 0.4 : 0.18, 4));
        [-0.13, 0.13].forEach(x => { const e = mesh(earG, a.panda ? dark : c); e.position.set(x, 1.12 * (a.legs || 1) + (a.ears ? 0.1 : 0), 0.5); g.add(e); });
        [-0.1, 0.1].forEach(x => { const e = mesh(geo('aeye', () => new T.SphereGeometry(0.04, 5, 4)), dark, { shadow: false }); e.position.set(x, 0.9 * (a.legs || 1), 0.84); g.add(e); });
        if (a.tail) { const t = mesh(geo('at', () => new T.ConeGeometry(0.12, 0.5, 5)), c); t.position.set(0, 0.7, -0.6); t.rotation.x = -1.1; g.add(t); }
        if (a.spots) for (let i = 0; i < 3; i++) { const sp = mesh(geo('asp', () => new T.SphereGeometry(0.12, 5, 4)), dark, { shadow: false }); sp.position.set((rng() - 0.5) * 0.5, 0.75, (rng() - 0.5) * 0.6); sp.scale.y = 0.4; g.add(sp); }
      } else if (a.kind === 'bird' || a.kind === 'beach') {
        const body = mesh(geo('bbd', () => new T.SphereGeometry(0.5, segs(10), 8)), c); body.scale.set(0.8, a.kind === 'beach' ? 0.5 : 0.9, a.kind === 'beach' ? 1.6 : 1); body.position.y = 0.5 * (a.legs || 1); g.add(outlined(body));
        const head = mesh(geo('bhd', () => new T.SphereGeometry(0.3, segs(10), 8)), c); head.position.set(0, (a.kind === 'beach' ? 0.65 : 1.0) * (a.legs || 1), 0.35); g.add(head);
        if (a.penguin) { const belly = mesh(geo('pbel', () => new T.SphereGeometry(0.38, 10, 8)), M('#ffffff')); belly.position.set(0, 0.48, 0.18); belly.scale.set(0.8, 1, 0.5); g.add(belly); }
        if (a.kind === 'bird') { const beak = mesh(geo('bbk', () => new T.ConeGeometry(0.08, 0.22, 4)), M(a.penguin ? '#f2a03a' : '#f2b13a')); beak.rotation.x = Math.PI / 2; beak.position.set(0, 1.0 * (a.legs || 1), 0.66); g.add(beak); }
        if (a.legs) { [-0.12, 0.12].forEach(x => { const l = mesh(geo('bleg', () => new T.CylinderGeometry(0.03, 0.03, 0.6, 4)), M('#e9839a')); l.position.set(x, 0.3, 0); g.add(l); }); }
        [-0.12, 0.12].forEach(x => { const e = mesh(geo('aeye', () => new T.SphereGeometry(0.04, 5, 4)), dark, { shadow: false }); e.position.set(x, (a.kind === 'beach' ? 0.72 : 1.07) * (a.legs || 1), 0.6); g.add(e); });
      } else if (a.kind === 'crab') {
        const body = mesh(geo('crb', () => new T.SphereGeometry(0.5, 8, 6)), c); body.scale.set(1.2, 0.45, 0.8); body.position.y = 0.3; g.add(outlined(body));
        [-1, 1].forEach(sd => {
          const cl = mesh(geo('crc', () => new T.SphereGeometry(0.2, 6, 4)), c); cl.position.set(sd * 0.65, 0.4, 0.35); g.add(cl);
          for (let i = 0; i < 3; i++) { const l = mesh(geo('crl', () => new T.BoxGeometry(0.35, 0.05, 0.05)), c); l.position.set(sd * 0.55, 0.15, -0.2 + i * 0.2); l.rotation.z = sd * -0.5; g.add(l); }
        });
      } else if (a.kind === 'sea') {
        const body = mesh(geo('sbd', () => new T.SphereGeometry(0.5, segs(12), 8)), c); body.scale.set(0.6, 0.5, 1.6); g.add(outlined(body));
        if (a.shell) { body.scale.set(1, 0.4, 1.2); const sh = mesh(geo('tsh', () => new T.SphereGeometry(0.5, 8, 6, 0, TAU, 0, Math.PI / 2)), M('#6b5a3a')); sh.scale.set(1.05, 0.6, 1.25); g.add(sh); }
        else { const fin = mesh(geo('sfin', () => new T.ConeGeometry(0.15, 0.4, 4)), c); fin.position.set(0, 0.35, -0.1); fin.rotation.x = -0.4; g.add(fin); const tail = mesh(geo('stail', () => new T.ConeGeometry(0.25, 0.4, 4)), c); tail.position.z = -0.85; tail.rotation.x = -Math.PI / 2; tail.scale.x = 2; g.add(tail); }
      } else if (a.kind === 'flyer') {
        const body = mesh(geo('fbd', () => new T.SphereGeometry(0.3, 8, 6)), c, { shadow: false }); body.scale.set(0.6, 0.6, 1.4); g.add(body);
        const wg = geo('fwing', () => { const gg = new T.PlaneGeometry(0.9, 0.3); gg.translate(0.45, 0, 0); return gg; });
        const w1 = mesh(wg, M('#ffffff', { side: T.DoubleSide }), { shadow: false }); const w2 = w1.clone(); w2.rotation.y = Math.PI; g.add(w1, w2);
        g.userData.wings = [w1, w2];
      } else if (a.kind === 'flutter') {
        const wg = geo('bwing', () => { const gg = new T.CircleGeometry(0.4, 6); gg.translate(0.35, 0, 0); return gg; });
        const w1 = mesh(wg, M(a.color, { side: T.DoubleSide }), { shadow: false }); const w2 = w1.clone(); w2.rotation.y = Math.PI; g.add(w1, w2);
        g.userData.wings = [w1, w2];
      }
      g.scale.setScalar(s);
      return g;
    }

    /* ---------- 島嶼放置 ---------- */
    function layout(n, type, centerR, maxR) {
      // 依實際大小排列：島的外緣（含沙灘與浪花）不能互相碰到，中間留出海面
      const pos = [];
      const reachC = centerR * 1.5, reachI = maxR * 1.5, gap = 3.5;
      const ringR = k => Math.max(reachC + reachI + gap, k > 1 ? (reachI + gap / 2) / Math.sin(Math.PI / k) : 0);
      if (type === 'portfolio') { // 時間線：螺旋排列，相鄰兩島距離固定
        let R = reachC + reachI + gap, ang = -Math.PI * 0.85;
        const step = 2 * reachI + gap;
        for (let i = 0; i < n; i++) {
          pos.push([Math.cos(ang) * R, Math.sin(ang) * R]);
          const da = step / R;
          ang += da;
          R += step * da / TAU; // 每繞一圈往外一個島的距離，圈與圈不會重疊
        }
        return pos;
      }
      if (n <= 8) {
        const R = ringR(n);
        for (let i = 0; i < n; i++) { const a = -Math.PI / 2 + i / n * TAU; pos.push([Math.cos(a) * R, Math.sin(a) * R]); }
      } else {
        const inner = Math.ceil(n / 2.2), outer = n - inner;
        const R1 = ringR(inner);
        const R2 = Math.max(R1 + 2 * reachI + gap, (reachI + gap / 2) / Math.sin(Math.PI / outer));
        for (let i = 0; i < inner; i++) { const a = -Math.PI / 2 + i / inner * TAU; pos.push([Math.cos(a) * R1, Math.sin(a) * R1]); }
        for (let i = 0; i < outer; i++) { const a = -Math.PI / 2 + (i + 0.5) / outer * TAU; pos.push([Math.cos(a) * R2, Math.sin(a) * R2]); }
      }
      return pos;
    }
    let layoutPos = [];
    function dockAngle(def) {
      if (!def.isCenter) return Math.atan2(def.z, def.x); // 一般島：朝外
      // 中央島：朝向周圍島嶼之間最大的空隙，不要指著別的島
      const angs = layoutPos.map(p => Math.atan2(p[1], p[0])).sort((x, y) => x - y);
      if (!angs.length) return Math.PI / 2;
      let best = 0, bestA = angs[0] + Math.PI;
      for (let i = 0; i < angs.length; i++) {
        const a0 = angs[i], a1 = i + 1 < angs.length ? angs[i + 1] : angs[0] + TAU;
        if (a1 - a0 > best) { best = a1 - a0; bestA = (a0 + a1) / 2; }
      }
      return bestA;
    }

    function sampler(rng, r, used) {
      // 在島面上找一個空位：回傳 [x, z] 或 null
      return function (rMin, rMax, gap) {
        for (let k = 0; k < 30; k++) {
          const a = rng() * TAU, d = r * (rMin + rng() * (rMax - rMin));
          const x = Math.cos(a) * d, z = Math.sin(a) * d;
          if (used.every(u => Math.hypot(u[0] - x, u[1] - z) > (u[2] + (gap || 0.8)))) { used.push([x, z, gap || 0.8]); return [x, z]; }
        }
        return null;
      };
    }

    function buildIsland(def) {
      const { index, x, z, r, isCenter } = def;
      const g = new T.Group();
      g.position.set(x, 0, z);
      const rng = U.seeded((cfg.meta.slug || 'isle') + ':' + index + ':' + cfg.shape);
      const shape = cfg.shape;
      const gc = hooks.groundPalette || GROUND[shape] || GROUND.sea;
      const n = segs(isCenter ? 34 : 26);
      let top = 1.0, baseY = 0;
      if (shape === 'float') baseY = 7 + Math.sin(index * 1.7) * 0.8;
      g.position.y = baseY;
      const topMeshes = [];

      // 島體
      if (shape === 'float') {
        const land = mesh(jagged(r, r * 0.95, 0.6, n, rng, 0.14), M(gc.top)); land.position.y = top - 0.3; g.add(outlined(land, 1.02)); topMeshes.push(land);
        const soil = mesh(jagged(r * 0.96, r * 0.8, 0.8, n, rng, 0.18), M(gc.beach)); soil.position.y = top - 1.0; g.add(soil);
        const cone = mesh(new T.ConeGeometry(r * 0.8, r * 1.6, segs(10)), M(gc.rock)); cone.rotation.x = Math.PI; cone.position.y = top - 1.4 - r * 0.8; g.add(cone);
        for (let i = 0; i < 3; i++) { const fr = rock(0.6 + rng(), rng); const a = rng() * TAU; fr.position.set(Math.cos(a) * r * 1.3, -1 - rng() * 2, Math.sin(a) * r * 1.3); g.add(fr); anim.push(t => { fr.position.y += Math.sin(t + i * 2) * 0.002; }); }
      } else if (shape === 'terrace') {
        const base = mesh(jagged(r * 1.1, r * 1.3, 1.2, n, rng, 0.1), M(gc.beach)); base.position.y = 0.0; g.add(base);
        const tiers = isCenter ? 3 : 2;
        for (let k = 0; k < tiers; k++) {
          const rr = r * (1 - k * 0.27);
          const tm = mesh(jagged(rr, rr * 1.03, 0.6, n, rng, 0.08), M(k % 2 ? '#9acb6c' : gc.top)); tm.position.y = top - 0.3 + k * 0.6; g.add(outlined(tm, 1.02)); topMeshes.push(tm);
          const wall = mesh(new T.CylinderGeometry(rr * 1.01, rr * 1.04, 0.25, n, 1, true), M(gc.rock)); wall.position.y = top - 0.55 + k * 0.6; g.add(wall);
        }
        def.tiers = tiers;
      } else {
        const beach = mesh(jagged(r * 1.12, r * 1.3, 0.8, n, rng, 0.1), M(gc.beach)); beach.position.y = 0.25; g.add(beach); topMeshes.push(beach);
        const land = mesh(jagged(r, r * 1.04, 0.6, n, rng, 0.14), M(gc.top)); land.position.y = top - 0.3; g.add(outlined(land, 1.02)); topMeshes.push(land);
        const skirt = mesh(new T.CylinderGeometry(r * 1.29, r * 1.4, 3, n), M(gc.beach)); skirt.position.y = -1.6; skirt.castShadow = false; g.add(skirt);
        if (S.name !== '夜光科幻' && cfg.detail >= 2 && shape !== 'snow') {
          const foam = mesh(new T.RingGeometry(r * 1.3, r * 1.45, n), M('#ffffff', { transparent: true, opacity: 0.55, basic: true }), { shadow: false });
          foam.rotation.x = -Math.PI / 2; foam.position.y = 0.06; g.add(foam);
          anim.push(t => { const k = 1 + Math.sin(t * 1.2 + index) * 0.03; foam.scale.set(k, k, 1); foam.material.opacity = 0.4 + Math.sin(t * 1.2 + index) * 0.15; });
        }
      }
      if (shape === 'volcano' && isCenter) def.reserved = [[r * 0.45, -r * 0.45, r * 0.5]];
      if (shape === 'desert' && !isCenter) { // 綠洲
        const pond = mesh(new T.CylinderGeometry(r * 0.28, r * 0.28, 0.05, segs(16)), M('#3fb3c4', { rough: 0.2 }), { shadow: false }); pond.position.set(r * 0.25, top + 0.02, -r * 0.2); g.add(pond);
        def.reserved = [[r * 0.25, -r * 0.2, r * 0.35]];
      }
      topMeshes.forEach(tm => { tm.userData.pick = { kind: 'isle', index }; pickables.push(tm); });

      def.top = top + (def.tiers ? (def.tiers - 1) * 0.6 : 0);
      def.group = g;
      def.yAt = function (lx, lz) {
        if (!def.tiers) return baseY + top;
        const d = Math.hypot(lx, lz);
        let k = 0; for (let i = 0; i < def.tiers; i++) if (d < r * (1 - i * 0.27) * 0.98) k = i;
        return baseY + top + k * 0.6;
      };
      if (hooks.decorateIsland) {
        hooks.decorateIsland(def, {
          rng, surf: (x, z) => surf(def, x, z),
          tree: (kind, size) => tree(kind, size, rng),
          flowers: n => flowerPatch(rng, n),
          unpick(object) {
            const parts = new Set();
            object.traverse(part => parts.add(part));
            pickables = pickables.filter(part => !parts.has(part));
          },
          pick(object, id) {
            object.traverse(part => {
              if (!part.isMesh) return;
              part.userData.pick = { kind: 'landmark', index, id };
              pickables.push(part);
            });
          }
        });
      } else decorate(def, rng);
      root.add(g);
      return def;
    }

    function surf(def, lx, lz) { return def.yAt(lx, lz) - def.group.position.y; }

    function decorate(def, rng) {
      const { r, isCenter, index, group: g } = def;
      const used = (def.reserved || []).slice();
      const spot = sampler(rng, r, used);
      const det = cfg.detail;
      const gc = GROUND[cfg.shape] || GROUND.sea;
      const put = (obj, p, yOff) => { obj.position.set(p[0], surf(def, p[0], p[1]) + (yOff || 0), p[1]); g.add(obj); return obj; };

      // 地標
      used.push([0, 0, isCenter ? r * 0.42 : r * 0.32]);
      const lm = landmark(def, rng);
      if (lm) { lm.position.y = surf(def, 0, 0); g.add(lm); }

      // 小路環
      if (det >= 3 && cfg.shape !== 'float') {
        const path = mesh(new T.RingGeometry(r * 0.55, r * 0.62, segs(32)), M(cfg.shape === 'snow' ? '#dfe6ea' : '#e6d3a8'), { shadow: false });
        path.rotation.x = -Math.PI / 2; path.position.y = surf(def, r * 0.58, 0) + 0.02; path.receiveShadow = true; g.add(path);
      }
      def.pathR = r * 0.58;

      // 樹
      const treeKind = cfg.extras.includes('sakura') && rng() < 0.35 ? 'sakura' : gc.tree;
      const nTree = [0, 3, 5, 8, 12][det] + (cfg.shape === 'jungle' ? 6 : 0) + (isCenter ? 2 : 0);
      for (let i = 0; i < nTree; i++) { const p = spot(0.62, 0.95, 0.7); if (p) put(tree(rng() < 0.2 && cfg.extras.includes('sakura') ? 'sakura' : treeKind, 0.65 + rng() * 0.45, rng), p); }
      if (cfg.shape === 'mushroom') for (let i = 0; i < 2 + det; i++) { const p = spot(0.4, 0.9, 0.6); if (p) put(tree('mushroom', 0.5 + rng() * 0.7, rng), p); }

      // 房子
      if (det >= 2 && !['literature', 'portfolio'].includes(cfg.type) || isCenter) {
        const nh = isCenter ? 0 : [0, 0, 1, 2, 3][det];
        for (let i = 0; i < nh; i++) { const p = spot(0.4, 0.7, 1.2); if (p) { const h = put(house({ w: 1 + rng() * 0.6, d: 1, h: 0.9 + rng() * 0.4, chimney: rng() < 0.4 }, rng), p); h.rotation.y = Math.atan2(-p[0], -p[1]); } }
      }
      if (det >= 2) for (let i = 0; i < det * 2; i++) { const p = spot(0.3, 0.95, 0.35); if (p) put(bush(rng), p); }
      if (det >= 3) {
        for (let i = 0; i < 3; i++) { const p = spot(0.5, 0.65, 0.4); if (p) put(lamp(), p); }
        for (let i = 0; i < 2; i++) { const p = spot(0.3, 0.9, 0.6); if (p) put(flowerPatch(rng), p); }
        const p1 = spot(0.7, 0.9, 1.2); if (p1) { const f = put(fence(1.4), p1); f.rotation.y = Math.atan2(p1[0], p1[1]) + Math.PI / 2; }
        const p2 = spot(0.45, 0.65, 0.5); if (p2) { const b = put(bench(), p2); b.rotation.y = Math.atan2(-p2[0], -p2[1]); }
        const p3 = spot(0.3, 0.9, 0.4); if (p3) put(crate(), p3);
      }
      if (det >= 4) {
        for (let i = 0; i < 4; i++) { const p = spot(0.8, 1.05, 0.5); if (p) put(rock(0.8, rng), p); }
        const p = spot(0.35, 0.6, 1.2); if (p && !isCenter) put(house({ w: 0.9, d: 0.9, h: 0.8 }, rng), p);
      }
      // 碼頭
      if (det >= 2 && ['sea', 'atoll', 'volcano', 'snow', 'jungle', 'desert', 'mushroom'].includes(cfg.shape)) {
        const dk = new T.Group();
        const L = 2.8;
        const plank = mesh(new T.BoxGeometry(0.8, 0.1, L), M('#a8754a')); plank.position.set(0, 0.72, 0); dk.add(plank);
        for (let i = 0; i < 3; i++) for (const sx of [-0.35, 0.35]) { const post = mesh(geo('dpost2', () => new T.CylinderGeometry(0.06, 0.06, 1.6, 5)), M('#7b5535')); post.position.set(sx, -0.05, 0.1 + i * 0.6); dk.add(post); }
        const a = dockAngle(def);
        const inner = r * 1.02; // 內側壓在沙灘上
        const dd = inner + L / 2;
        dk.position.set(Math.cos(a) * dd, 0, Math.sin(a) * dd); dk.rotation.y = Math.PI / 2 - a;
        g.add(dk);
        def.dock = new T.Vector3(def.x + Math.cos(a) * (dd + L / 2), 0, def.z + Math.sin(a) * (dd + L / 2));
      } else {
        def.dock = new T.Vector3(def.x, def.top, def.z);
      }
      // 每座島的燈火（夜晚）
      if (cfg.features.includes('nightLights') && det >= 2) {
        for (let i = 0; i < 2; i++) { const p = spot(0.45, 0.7, 0.4); if (p) put(lamp(), p); }
      }
    }

    /* 地標：依島型決定每座島的主角建築 */
    function landmark(def, rng) {
      const g = new T.Group();
      const { isCenter, r } = def;
      const isl = def.data || {};
      const ex = isl.extra || {};
      const prim = cfg.theme.primary, acc = cfg.theme.accent;
      const type = cfg.type;
      const add = (o, x, z, y) => { o.position.set(x || 0, y || 0, z || 0); g.add(o); return o; };

      if (isCenter) {
        const big = { w: 3, d: 2.4, h: 2 };
        switch (type) {
          case 'course': add(house(Object.assign({}, big, { roof: prim, flag: true }), rng)); add(tower(0.5, 3.4, '#f2ece0', acc), 1.9, -0.4); break;
          case 'life': add(plaza(r * 0.38)); add(house({ w: 1.6, d: 1.4, h: 1.4, roof: prim, chimney: true }, rng), 0, -1.6); break;
          case 'treasure': add(tower(1.1, 3.6, '#e9d39a', '#c9962a')); add(chest(1.2), 0, 1.8); break;
          case 'local': add(house(Object.assign({}, big, { roof: prim, flat: true, flag: true }), rng)); add(signpost(), 2, 1.4); break;
          case 'expo': add(tent(1.8, acc, prim)); add(tent(1, prim, acc), 2.3, 1); add(tent(1, '#f2c14e', prim), -2.3, 1); break;
          case 'science': add(dome(1.6, '#e7ecf2', prim)); break;
          case 'live': add(billboard(def, 3.2, 2)); break;
          case 'runner': add(arch(3, acc)); add(track(2.8, 5), 0, 0); break;
          case 'empathy': add(house(Object.assign({}, big, { roof: '#d98c5f', chimney: true }), rng)); add(plaza(1.2), 0, 2.4); break;
          case 'literature': add(library(3, prim)); break;
          case 'portfolio': add(tower(0.9, 5, '#f4efe6', prim, true)); break;
          case 'quest': add(castle(acc)); break;
          default: add(house(big, rng));
        }
        if (cfg.extras.includes('fountain')) add(fountain(), r * 0.35, r * 0.35);
        return g;
      }
      switch (type) {
        case 'course': add(house({ w: 1.6, d: 1.2, h: 1.2, roof: prim, flag: true }, rng)); break;
        case 'life': {
          const k = ex.kind || '作品';
          if (k === '服務') add(shop(acc));
          else if (k === '課程') add(house({ w: 1.7, d: 1.3, h: 1.2, roof: prim, flag: true }, rng));
          else if (k === '作品') add(gallery());
          else if (k === '聯絡') add(mailbox());
          else add(house({ w: 1.3, d: 1.2, h: 1, roof: acc, chimney: true }, rng));
          break;
        }
        case 'treasure': { const c = add(chest(1)); c.traverse(o => { if (o.isMesh) { o.userData.pick = { kind: 'chest', index: def.index }; pickables.push(o); } }); break; }
        case 'local': add(pavilion(prim)); break;
        case 'expo': { const n = Math.max(1, Math.min(4, U.rows(ex.booths).length || 2)); for (let i = 0; i < n; i++) { const a = i / n * TAU; add(tent(0.7, i % 2 ? prim : acc, '#ffffff'), Math.cos(a) * (n > 1 ? 1.1 : 0), Math.sin(a) * (n > 1 ? 1.1 : 0)); } break; }
        case 'science': add(telescope(prim)); break;
        case 'live': add(billboard(def, 2.2, 1.4)); break;
        case 'runner': add(track(1.6, 3)); add(arch(1.8, acc), 0, -1.2); break;
        case 'empathy': add(house({ w: 1.4, d: 1.2, h: 1.1, roof: acc, chimney: true }, rng)); break;
        case 'literature': {
          const refs = U.rows(ex.refs).length || 1;
          const n = Math.min(8, refs);
          for (let i = 0; i < n; i++) { const a = i / n * TAU; const rr = n > 1 ? r * 0.38 : 0; const h = add(house({ w: 0.9, d: 0.8, h: 0.9 + (i % 3) * 0.25, roof: [prim, acc, '#8c6b4a'][i % 3] }, rng), Math.cos(a) * rr, Math.sin(a) * rr); h.rotation.y = -a - Math.PI / 2; }
          break;
        }
        case 'portfolio': {
          const n = Math.min(6, U.rows(ex.works).length || 1);
          for (let i = 0; i < n; i++) { const a = i / n * TAU; const rr = n > 1 ? r * 0.36 : 0; const h = add(house({ w: 0.9, d: 0.9, h: 0.9 + i * 0.25, roof: i % 2 ? prim : acc, flat: i % 3 === 2 }, rng), Math.cos(a) * rr, Math.sin(a) * rr); h.rotation.y = -a - Math.PI / 2; h.traverse(o => { if (o.isMesh) { o.userData.pick = { kind: 'work', index: def.index, item: i }; pickables.push(o); } }); }
          break;
        }
        case 'quest': {
          const mon = add(monster(acc), 0.9, 0.4);
          mon.traverse(o => { if (o.isMesh) { o.userData.pick = { kind: 'monster', index: def.index }; pickables.push(o); } });
          anim.push(t => { mon.position.y = 0.15 + Math.abs(Math.sin(t * 2.5 + def.index)) * 0.3; mon.rotation.y = Math.sin(t * 0.8) * 0.6; });
          break;
        }
        default: add(house({}, rng));
      }
      // NPC（闖關型或 RPG 模式）
      if (type === 'quest' || cfg.rpg) {
        const npc = person([prim, '#f2cfae'], rng); npc.scale.setScalar(1.2);
        const mark = mesh(geo('npcmark', () => new T.OctahedronGeometry(0.15, 0)), M('#ffd23f', { glow: '#ffd23f', glowMin: 0.6 }), { shadow: false }); mark.position.y = 1.25; npc.add(mark);
        anim.push(t => { mark.rotation.y = t * 2; mark.position.y = 1.25 + Math.sin(t * 3) * 0.08; });
        add(npc, -1.1, 0.9);
        npc.traverse(o => { if (o.isMesh) { o.userData.pick = { kind: 'npc', index: def.index }; pickables.push(o); } });
        def.npc = npc;
      }
      return g;
    }

    function tower(rad, h, wall, roof, windows) {
      const g = new T.Group();
      const b = mesh(new T.CylinderGeometry(rad, rad * 1.1, h, segs(14)), M(wall)); b.position.y = h / 2; g.add(outlined(b, 1.03));
      const c = mesh(new T.ConeGeometry(rad * 1.3, rad * 1.6, segs(14)), M(roof)); c.position.y = h + rad * 0.8; g.add(outlined(c, 1.04));
      if (windows) for (let i = 0; i < 4; i++) { const w = mesh(geo('twin', () => new T.BoxGeometry(0.25, 0.3, 0.05)), M('#7aa6c8', { glow: '#ffd27a' }), { shadow: false }); w.position.set(0, 1 + i * 0.95, rad + 0.01); g.add(w); }
      return g;
    }
    function plaza(rad) {
      const g = new T.Group();
      const p = mesh(new T.CylinderGeometry(rad, rad, 0.08, segs(24)), M('#e8dcc4')); p.position.y = 0.04; p.castShadow = false; g.add(p);
      for (let i = 0; i < 4; i++) { const b = bench(); const a = i / 4 * TAU; b.position.set(Math.cos(a) * rad * 0.8, 0.05, Math.sin(a) * rad * 0.8); b.rotation.y = -a - Math.PI / 2; g.add(b); }
      return g;
    }
    function chest(s) {
      const g = new T.Group();
      const b = mesh(geo('chb', () => new T.BoxGeometry(0.9, 0.5, 0.6)), M('#9b6232')); b.position.y = 0.25; g.add(outlined(b));
      const lid = mesh(geo('chl', () => { const gg = new T.CylinderGeometry(0.3, 0.3, 0.9, 10, 1, false, 0, Math.PI); gg.rotateZ(Math.PI / 2); return gg; }), M('#b5763d')); lid.position.y = 0.5; g.add(lid);
      const band = mesh(geo('chband', () => new T.BoxGeometry(0.95, 0.08, 0.65)), M('#e8c14a', { glow: '#ffd56b', glowMin: 0.25 })); band.position.y = 0.42; g.add(band);
      g.scale.setScalar(s); return g;
    }
    function signpost() {
      const g = new T.Group();
      const p = mesh(geo('sp', () => new T.CylinderGeometry(0.06, 0.06, 1.6, 5)), M('#8a6a4a')); p.position.y = 0.8; g.add(p);
      for (let i = 0; i < 3; i++) { const a = mesh(geo('spa', () => new T.BoxGeometry(0.9, 0.2, 0.05)), M(['#e8684a', '#3f6fa0', '#f2c14e'][i])); a.position.set(0.3, 1.4 - i * 0.3, 0); a.rotation.y = i * 1.2; g.add(a); }
      return g;
    }
    function tent(s, c1, c2) {
      const g = new T.Group();
      const b = mesh(geo('tb', () => new T.CylinderGeometry(0.9, 0.9, 0.8, segs(12))), M(c2)); b.position.y = 0.4; g.add(outlined(b));
      const t = mesh(geo('tt', () => new T.ConeGeometry(1.05, 0.9, segs(12))), M(c1)); t.position.y = 1.25; g.add(outlined(t));
      const f = flag(c1, 1.7, 0); f.scale.setScalar(0.6); g.add(f);
      g.scale.setScalar(s); return g;
    }
    function dome(rad, wall, roof) {
      const g = new T.Group();
      const b = mesh(new T.CylinderGeometry(rad, rad, 1.2, segs(18)), M(wall)); b.position.y = 0.6; g.add(outlined(b, 1.03));
      const d = mesh(new T.SphereGeometry(rad, segs(18), 10, 0, TAU, 0, Math.PI / 2), M(roof, { rough: 0.4 })); d.position.y = 1.2; g.add(outlined(d, 1.03));
      const tel = mesh(new T.CylinderGeometry(0.15, 0.22, 1.6, 8), M('#ccd3dc')); tel.position.set(0.3, 2.2, 0); tel.rotation.z = -0.7; g.add(tel);
      anim.push(t => { d.rotation.y = t * 0.15; });
      return g;
    }
    function telescope(c) {
      const g = new T.Group();
      const leg = mesh(geo('tleg', () => new T.CylinderGeometry(0.05, 0.05, 1, 4)), M('#555b66'));
      for (let i = 0; i < 3; i++) { const l = leg.clone(); l.position.set(Math.cos(i * 2.1) * 0.25, 0.45, Math.sin(i * 2.1) * 0.25); l.rotation.set(Math.sin(i * 2.1) * 0.3, 0, -Math.cos(i * 2.1) * 0.3); g.add(l); }
      const tube = mesh(geo('ttube', () => new T.CylinderGeometry(0.12, 0.18, 1.3, 10)), M(c)); tube.position.y = 1.15; tube.rotation.z = -0.9; g.add(outlined(tube));
      g.scale.setScalar(1.3);
      return g;
    }
    function billboard(def, w, h) {
      const g = new T.Group();
      for (const sx of [-w / 2 + 0.15, w / 2 - 0.15]) { const p = mesh(new T.CylinderGeometry(0.07, 0.07, h + 0.8, 6), M('#5a5f6b')); p.position.set(sx, (h + 0.8) / 2, 0); g.add(p); }
      const cv = document.createElement('canvas'); cv.width = 512; cv.height = Math.round(512 * h / w);
      const tex = new T.CanvasTexture(cv);
      const board = new T.Mesh(new T.PlaneGeometry(w, h), new T.MeshBasicMaterial({ map: tex, side: T.DoubleSide }));
      board.position.y = 0.8 + h / 2; g.add(board);
      const frame = mesh(new T.BoxGeometry(w + 0.12, h + 0.12, 0.06), M(cfg.theme.primary)); frame.position.set(0, 0.8 + h / 2, -0.04); g.add(frame);
      def.board = { cv, tex };
      drawBoard(def, def.isCenter ? (cfg.center.name || '總看板') : (def.data && def.data.name || ''), '');
      board.userData.pick = { kind: 'isle', index: def.index }; pickables.push(board);
      return g;
    }
    function drawBoard(def, title, line) {
      if (!def.board) return;
      const { cv, tex } = def.board, c = cv.getContext('2d');
      c.fillStyle = cfg.theme.primary; c.fillRect(0, 0, cv.width, cv.height);
      c.fillStyle = '#ffffff'; c.font = 'bold 54px ' + D.FONTS[cfg.font || 'sans'].css; c.textBaseline = 'top';
      c.fillText(String(title).slice(0, 9), 28, 26);
      c.fillStyle = cfg.theme.accent; c.fillRect(28, 96, 120, 8);
      c.fillStyle = '#ffffff'; c.font = '34px ' + D.FONTS.sans.css;
      const s = String(line || '');
      for (let i = 0; i < 3; i++) c.fillText(s.slice(i * 13, (i + 1) * 13), 28, 128 + i * 46);
      tex.needsUpdate = true;
    }
    function arch(w, c) {
      const g = new T.Group();
      const a = mesh(new T.TorusGeometry(w / 2, 0.15, 8, segs(18), Math.PI), M(c)); a.position.y = 0; g.add(outlined(a));
      return g;
    }
    function track(w, l) {
      const g = new T.Group();
      const b = mesh(new T.BoxGeometry(w, 0.06, l), M('#d9774f'), { shadow: false }); b.position.y = 0.04; g.add(b);
      for (let i = 1; i < 3; i++) { const s = mesh(new T.BoxGeometry(0.04, 0.07, l), M('#ffffff'), { shadow: false }); s.position.set(-w / 2 + i * w / 3, 0.05, 0); g.add(s); }
      return g;
    }
    function library(w, roof) {
      const g = new T.Group();
      const base = mesh(new T.BoxGeometry(w, 0.3, w * 0.7), M('#e8e1d3')); base.position.y = 0.15; g.add(base);
      for (let i = 0; i < 5; i++) { const c = mesh(geo('col', () => new T.CylinderGeometry(0.12, 0.12, 1.5, 8)), M('#f4efe6')); c.position.set(-w / 2 + 0.3 + i * (w - 0.6) / 4, 1.05, w * 0.3); g.add(c); }
      const body = mesh(new T.BoxGeometry(w * 0.85, 1.5, w * 0.5), M('#efe8da')); body.position.set(0, 1.05, -0.1); g.add(outlined(body, 1.03));
      const tri = mesh(new T.CylinderGeometry(0.7, 0.7, w, 3), M(roof)); tri.rotation.z = Math.PI / 2; tri.rotation.x = Math.PI / 2; tri.scale.set(1, 1, 0.55); tri.position.y = 2.1; tri.rotation.y = Math.PI / 2; g.add(outlined(tri));
      return g;
    }
    function castle(c) {
      const g = new T.Group();
      const keep = mesh(new T.BoxGeometry(2.2, 2, 2.2), M('#cfc6b8')); keep.position.y = 1; g.add(outlined(keep, 1.03));
      [[-1.2, -1.2], [1.2, -1.2], [-1.2, 1.2], [1.2, 1.2]].forEach(([x, z]) => { const t = tower(0.45, 2.8, '#d9d1c4', c); t.position.set(x, 0, z); g.add(t); });
      const f = flag(c, 2.05, 0); g.add(f);
      return g;
    }
    function shop(c) {
      const g = house({ w: 1.6, d: 1.2, h: 1.1, flat: true, wall: '#f6efe2', roof: '#8c6b4a' }, Math.random);
      const aw = mesh(new T.BoxGeometry(1.7, 0.08, 0.6), M(c)); aw.position.set(0, 0.95, 0.85); aw.rotation.x = 0.35; g.add(aw);
      return g;
    }
    function gallery() {
      const g = new T.Group();
      const b = mesh(new T.BoxGeometry(1.8, 1.2, 1.3), M('#f8f6f2')); b.position.y = 0.6; g.add(outlined(b, 1.03));
      const glass = mesh(new T.BoxGeometry(1.2, 0.7, 0.04), M('#9cc7de', { glow: '#ffe2a8', rough: 0.2 }), { shadow: false }); glass.position.set(0, 0.55, 0.66); g.add(glass);
      const r = mesh(new T.BoxGeometry(2, 0.12, 1.5), M(cfg.theme.primary)); r.position.y = 1.26; g.add(r);
      return g;
    }
    function mailbox() {
      const g = new T.Group();
      const p = mesh(geo('mbp', () => new T.CylinderGeometry(0.06, 0.06, 0.9, 5)), M('#7a5a3a')); p.position.y = 0.45; g.add(p);
      const b = mesh(new T.BoxGeometry(0.5, 0.4, 0.7), M(cfg.theme.accent)); b.position.y = 1.05; g.add(outlined(b));
      g.add(house({ w: 1.2, d: 1, h: 0.9 }, Math.random).translateX(1.3));
      return g;
    }
    function pavilion(roof) {
      const g = new T.Group();
      for (const [x, z] of [[-0.7, -0.7], [0.7, -0.7], [-0.7, 0.7], [0.7, 0.7]]) { const c = mesh(geo('pvc', () => new T.CylinderGeometry(0.08, 0.08, 1.2, 6)), M('#b4462e')); c.position.set(x, 0.6, z); g.add(c); }
      const rf = mesh(new T.ConeGeometry(1.4, 0.8, 4), M(roof)); rf.position.y = 1.55; rf.rotation.y = Math.PI / 4; g.add(outlined(rf));
      const tip = mesh(new T.SphereGeometry(0.12, 6, 4), M('#e8c14a')); tip.position.y = 2; g.add(tip);
      return g;
    }
    function monster(c) {
      const g = new T.Group();
      const b = mesh(geo('monb', () => new T.SphereGeometry(0.55, segs(12), 10)), M(c, { transparent: true, opacity: 0.92 })); b.scale.y = 0.8; b.position.y = 0.45; g.add(outlined(b));
      for (const x of [-0.18, 0.18]) {
        const e = mesh(geo('mone', () => new T.SphereGeometry(0.13, 8, 6)), M('#ffffff')); e.position.set(x, 0.6, 0.42); g.add(e);
        const pu = mesh(geo('monp', () => new T.SphereGeometry(0.06, 6, 4)), M('#1d1d24')); pu.position.set(x, 0.6, 0.53); g.add(pu);
        const h = mesh(geo('monh', () => new T.ConeGeometry(0.08, 0.3, 5)), M('#fff3d6')); h.position.set(x * 1.6, 0.9, 0.1); g.add(h);
      }
      return g;
    }
    function fountain() {
      const g = new T.Group();
      const basin = mesh(new T.CylinderGeometry(0.9, 1, 0.35, segs(18)), M('#d9d2c6')); basin.position.y = 0.17; g.add(basin);
      const water = mesh(new T.CylinderGeometry(0.8, 0.8, 0.05, segs(18)), M('#6cc4e0', { rough: 0.2 }), { shadow: false }); water.position.y = 0.33; g.add(water);
      const col = mesh(new T.CylinderGeometry(0.12, 0.16, 0.8, 8), M('#e6e0d6')); col.position.y = 0.6; g.add(col);
      const drops = [];
      for (let i = 0; i < 14; i++) { const d = mesh(geo('drop', () => new T.SphereGeometry(0.05, 5, 4)), M('#bfe8f5', { transparent: true, opacity: 0.85 }), { shadow: false }); g.add(d); drops.push([d, i / 14]); }
      anim.push(t => { drops.forEach(([d, o]) => { const k = (t * 0.8 + o) % 1; const a = o * TAU; d.position.set(Math.cos(a) * k * 0.65, 1.0 + k * 0.8 - k * k * 1.4, Math.sin(a) * k * 0.65); }); });
      return g;
    }

    /* ---------- 全域點綴（瀑布、熱氣球…） ---------- */
    function placeExtras(rng) {
      const ex = cfg.extras || [];
      const c = isles[0];
      const pickIsle = i => isles[1 + (i % Math.max(1, isles.length - 1))] || c;
      const onTop = (def, lx, lz, obj) => { obj.position.set(lx, surf(def, lx, lz), lz); def.group.add(obj); return obj; };

      if (ex.includes('waterfall')) {
        const def = cfg.shape === 'float' ? c : pickIsle(0);
        const a = 0.6, rr = def.r * 1.0;
        const lx = Math.cos(a) * rr, lz = Math.sin(a) * rr;
        const height = cfg.shape === 'float' ? 6 : 1.4;
        const cv = document.createElement('canvas'); cv.width = 32; cv.height = 128;
        const cx = cv.getContext('2d');
        for (let y = 0; y < 128; y += 8) { cx.fillStyle = y % 16 ? '#9fdcf2' : '#e9f8ff'; cx.fillRect(0, y, 32, 8); }
        const tex = new T.CanvasTexture(cv); tex.wrapT = T.RepeatWrapping; tex.repeat.set(1, 3);
        const fall = new T.Mesh(new T.PlaneGeometry(1.1, height), new T.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.85, side: T.DoubleSide }));
        fall.position.set(lx * 1.02, def.top - height / 2, lz * 1.02); fall.rotation.y = -a + Math.PI / 2;
        def.group.add(fall);
        if (cfg.shape !== 'float') { const rk = rock(2.2, rng); rk.position.set(lx * 0.92, def.top + 0.3, lz * 0.92); def.group.add(rk); fall.position.y = def.top; fall.scale.y = 1.4; }
        anim.push((t) => { tex.offset.y = -t * 1.2; });
        const mist = mesh(new T.SphereGeometry(0.6, 8, 6), M('#ffffff', { transparent: true, opacity: 0.4, basic: true }), { shadow: false });
        mist.position.set(lx * 1.05, def.top - height + 0.2, lz * 1.05); def.group.add(mist);
        anim.push(t => { mist.scale.setScalar(1 + Math.sin(t * 3) * 0.15); });
      }
      if (ex.includes('balloon')) {
        for (let k = 0; k < 2; k++) {
          const b = new T.Group();
          const env = mesh(new T.SphereGeometry(1, segs(14), 10), M(k ? cfg.theme.accent : '#f2c14e')); env.scale.y = 1.2; b.add(outlined(env));
          const stripe = mesh(new T.TorusGeometry(0.98, 0.08, 6, 20), M('#ffffff')); stripe.rotation.x = Math.PI / 2; b.add(stripe);
          const bask = mesh(new T.BoxGeometry(0.5, 0.4, 0.5), M('#8a5a36')); bask.position.y = -1.7; b.add(bask);
          root.add(b);
          const R = extent * (0.5 + k * 0.25), h = 12 + k * 4;
          anim.push(t => { const a = t * 0.04 + k * 3; b.position.set(Math.cos(a) * R, h + Math.sin(t * 0.5 + k) * 0.8, Math.sin(a) * R); });
        }
      }
      if (ex.includes('windmill')) {
        const def = pickIsle(1);
        const wm = new T.Group();
        const towerM = mesh(new T.CylinderGeometry(0.35, 0.55, 2.4, segs(8)), M('#f2ebe0')); towerM.position.y = 1.2; wm.add(outlined(towerM));
        const cap = mesh(new T.ConeGeometry(0.5, 0.6, segs(8)), M('#b5523a')); cap.position.y = 2.7; wm.add(cap);
        const blades = new T.Group(); blades.position.set(0, 2.4, 0.45);
        for (let i = 0; i < 4; i++) { const bl = mesh(geo('blade', () => { const gg = new T.BoxGeometry(0.25, 1.5, 0.04); gg.translate(0, 0.75, 0); return gg; }), M('#e9e1d2')); bl.rotation.z = i * Math.PI / 2; blades.add(bl); }
        wm.add(blades);
        onTop(def, -def.r * 0.45, def.r * 0.45, wm);
        anim.push((t, dt) => { blades.rotation.z += dt * 1.2; });
      }
      if (ex.includes('flowers')) {
        isles.forEach(def => { const fr = U.seeded('fl' + def.index); for (let i = 0; i < (cfg.detail >= 3 ? 3 : 1); i++) { const a = fr() * TAU, d = def.r * (0.7 + fr() * 0.2); onTop(def, Math.cos(a) * d, Math.sin(a) * d, flowerPatch(fr, 12)); } });
      }
      if (ex.includes('bunting')) {
        const cols = ['#e8684a', '#f2c14e', '#3f6fa0', '#5e9c63', '#a477e6'];
        isles.slice(0, 6).forEach(def => {
          const g = new T.Group();
          const pts = [new T.Vector3(-def.r * 0.5, 2, 0), new T.Vector3(def.r * 0.5, 2, 0)];
          for (const p of pts) { const pole = mesh(geo('bpole', () => new T.CylinderGeometry(0.04, 0.04, 2, 5)), M('#ddd5c8')); pole.position.set(p.x, 1, 0); g.add(pole); }
          for (let i = 0; i < 9; i++) {
            const t = i / 8; const fl = mesh(geo('bfl', () => { const gg = new T.ConeGeometry(0.12, 0.25, 3); gg.rotateX(Math.PI); return gg; }), M(cols[i % cols.length]), { shadow: false });
            fl.position.set(lerp(pts[0].x, pts[1].x, t), 1.85 - Math.sin(t * Math.PI) * 0.35, 0); g.add(fl);
          }
          onTop(def, 0, def.r * 0.15, g).rotation.y = def.index;
        });
      }
      if (ex.includes('lighthouse')) {
        const def = pickIsle(2);
        const lh = new T.Group();
        for (let i = 0; i < 4; i++) { const s = mesh(new T.CylinderGeometry(0.42 - i * 0.05, 0.47 - i * 0.05, 0.8, segs(12)), M(i % 2 ? '#d9443a' : '#f6f2ea')); s.position.y = 0.4 + i * 0.8; lh.add(i === 0 ? outlined(s) : s); }
        const lampH = mesh(new T.CylinderGeometry(0.3, 0.3, 0.45, segs(10)), M('#fff7d6', { glow: '#fff1a8', glowMin: 0.2, glowMax: 2 })); lampH.position.y = 3.45; lh.add(lampH);
        const roof = mesh(new T.ConeGeometry(0.4, 0.5, segs(10)), M('#2e3440')); roof.position.y = 3.9; lh.add(roof);
        const beamM = new T.MeshBasicMaterial({ color: '#fff4c4', transparent: true, opacity: 0, side: T.DoubleSide, depthWrite: false });
        const beam = new T.Mesh(new T.ConeGeometry(1.2, 9, 12, 1, true), beamM); beam.rotation.z = Math.PI / 2; beam.position.x = 4.5;
        const pivot = new T.Group(); pivot.position.y = 3.45; pivot.add(beam); lh.add(pivot);
        const a = Math.atan2(def.z, def.x);
        onTop(def, Math.cos(a) * def.r * 0.8, Math.sin(a) * def.r * 0.8, lh);
        anim.push((t, dt) => { pivot.rotation.y += dt * 0.8; beamM.opacity = W._night * 0.25; });
      }
      if (ex.includes('ferris')) {
        const def = c;
        const fw = new T.Group();
        for (const sz of [-0.3, 0.3]) { const leg = mesh(geo('fleg', () => new T.CylinderGeometry(0.07, 0.07, 3.2, 5)), M('#d0d5dd')); leg.position.set(0.6, 1.5, sz); leg.rotation.z = 0.35; fw.add(leg); const l2 = leg.clone(); l2.position.x = -0.6; l2.rotation.z = -0.35; fw.add(l2); }
        const wheel = new T.Group(); wheel.position.y = 3;
        const rim = mesh(new T.TorusGeometry(1.8, 0.06, 6, segs(30)), M(cfg.theme.accent, { glow: cfg.theme.accent, glowMin: 0, glowMax: 0.8 })); wheel.add(rim);
        const cabins = [];
        for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; const sp = mesh(geo('fsp', () => new T.BoxGeometry(0.04, 1.8, 0.04)), M('#d0d5dd')); sp.rotation.z = a; sp.position.set(Math.cos(a + Math.PI / 2) * 0.9, Math.sin(a + Math.PI / 2) * 0.9, 0); wheel.add(sp); const cb = mesh(geo('fcb', () => new T.BoxGeometry(0.35, 0.35, 0.35)), M(['#e8684a', '#f2c14e', '#3f6fa0', '#5e9c63'][i % 4])); wheel.add(cb); cabins.push([cb, a]); }
        fw.add(wheel);
        onTop(def, -def.r * 0.5, -def.r * 0.5, fw);
        anim.push((t, dt) => { wheel.rotation.z += dt * 0.25; cabins.forEach(([cb, a]) => { const aa = a + wheel.rotation.z; cb.position.set(Math.cos(aa) * 1.8, Math.sin(aa) * 1.8 - 0.25, 0); cb.rotation.z = -wheel.rotation.z; }); });
      }
      if (ex.includes('campfire')) {
        const def = pickIsle(3);
        const cf = new T.Group();
        for (let i = 0; i < 4; i++) { const l = mesh(geo('log', () => new T.CylinderGeometry(0.07, 0.07, 0.7, 5)), M('#6b4a2a')); l.rotation.z = Math.PI / 2; l.rotation.y = i * Math.PI / 4; l.position.y = 0.07; cf.add(l); }
        const fl = mesh(new T.ConeGeometry(0.22, 0.6, 6), M('#ff9a3c', { basic: true, transparent: true, opacity: 0.9 }), { shadow: false }); fl.position.y = 0.35; cf.add(fl);
        const light = new T.PointLight('#ff9a3c', 0.8, 6); light.position.y = 0.6; cf.add(light);
        onTop(def, def.r * 0.35, -def.r * 0.4, cf);
        anim.push(t => { fl.scale.set(1 + Math.sin(t * 13) * 0.1, 1 + Math.sin(t * 9) * 0.2, 1); light.intensity = 0.6 + W._night * 1.4 + Math.sin(t * 17) * 0.15; });
      }
      if (ex.includes('treehouse')) {
        const def = pickIsle(4);
        const th = new T.Group();
        const tr = mesh(new T.CylinderGeometry(0.25, 0.4, 3, 8), M('#7a5030')); tr.position.y = 1.5; th.add(tr);
        const cn = mesh(new T.IcosahedronGeometry(1.4, 1), M('#4f9a45')); cn.position.y = 3.6; th.add(outlined(cn));
        const hs = house({ w: 1, d: 1, h: 0.7, roof: '#b5523a' }, rng); hs.position.y = 2.3; hs.position.x = 0.4; th.add(hs);
        const lad = mesh(new T.BoxGeometry(0.3, 2.3, 0.05), M('#a8754a')); lad.position.set(0.5, 1.15, 0.6); lad.rotation.x = 0.2; th.add(lad);
        onTop(def, def.r * 0.5, def.r * 0.4, th);
      }
      if (ex.includes('hotspring')) {
        const def = pickIsle(5);
        const hs = new T.Group();
        const pool = mesh(new T.CylinderGeometry(1, 1, 0.1, segs(16)), M('#8fd3df', { rough: 0.2 }), { shadow: false }); pool.position.y = 0.05; hs.add(pool);
        for (let i = 0; i < 8; i++) { const st = rock(0.6, rng); const a = i / 8 * TAU; st.position.set(Math.cos(a) * 1.1, 0.1, Math.sin(a) * 1.1); hs.add(st); }
        const steam = [];
        for (let i = 0; i < 6; i++) { const s = mesh(geo('steam', () => new T.SphereGeometry(0.25, 6, 5)), M('#ffffff', { transparent: true, opacity: 0.35, basic: true }), { shadow: false }); hs.add(s); steam.push([s, i / 6]); }
        anim.push(t => steam.forEach(([s, o]) => { const k = (t * 0.25 + o) % 1; s.position.set(Math.sin(o * 9) * 0.5, 0.2 + k * 2, Math.cos(o * 9) * 0.5); s.material.opacity = 0.35 * (1 - k); s.scale.setScalar(0.6 + k); }));
        onTop(def, -def.r * 0.4, -def.r * 0.35, hs);
      }
      if (ex.includes('rainbow')) {
        const rb = new T.Group();
        const cols = ['#ff5a5a', '#ff9f43', '#ffd93d', '#6bd66b', '#4dabf7', '#6c63ff', '#b066e0'];
        cols.forEach((cc, i) => { const t = new T.Mesh(new T.TorusGeometry(extent * 0.9 - i * 0.7, 0.35, 6, 48, Math.PI), new T.MeshBasicMaterial({ color: cc, transparent: true, opacity: 0.45, depthWrite: false })); rb.add(t); });
        rb.position.set(0, -2, -extent * 0.9); root.add(rb);
        anim.push(() => { rb.visible = W._night < 0.6; rb.children.forEach(m => { m.material.opacity = 0.45 * (1 - W._night); }); });
      }
      if (ex.includes('kite')) {
        const def = pickIsle(6);
        const kite = mesh(new T.OctahedronGeometry(0.6, 0), M(cfg.theme.accent), { shadow: false }); kite.scale.set(1, 1.4, 0.1);
        root.add(kite);
        const lineGeo = new T.BufferGeometry().setFromPoints([new T.Vector3(), new T.Vector3()]);
        const line = new T.Line(lineGeo, new T.LineBasicMaterial({ color: '#555555' })); root.add(line);
        const base = new T.Vector3(def.x, def.top + def.group.position.y, def.z);
        anim.push(t => { kite.position.set(base.x + 4 + Math.sin(t * 0.7) * 1.5, base.y + 9 + Math.sin(t * 1.3) * 0.8, base.z + 3); kite.rotation.z = Math.sin(t) * 0.3; line.geometry.setFromPoints([base, kite.position]); });
      }
      if (ex.includes('sakura')) { /* 已混在樹裡 */ }
    }

    /* ---------- 動物放置 ---------- */
    function placeAnimals(rng) {
      (cfg.animals || []).forEach((key, ai) => {
        const a = D.ANIMALS[key]; if (!a) return;
        const count = a.kind === 'sea' && a.size > 2 ? 1 : (a.kind === 'flyer' ? 4 : 3);
        for (let k = 0; k < count; k++) {
          const def = isles[(ai * 3 + k) % isles.length];
          const m = animalMesh(a, rng);
          m.traverse(o => { if (o.isMesh) { o.userData.pick = { kind: 'animal', key, name: a.name }; pickables.push(o); } });
          const ph = rng() * TAU, spd = 0.25 + rng() * 0.3;
          if (a.kind === 'quad' || (a.kind === 'bird' && !a.swim)) {
            def.group.add(m);
            const rr = def.r * (0.25 + rng() * 0.55);
            const hop = key === 'rabbit' || key === 'frog' || key === 'chick';
            anim.push(t => {
              const ang = ph + t * spd * (k % 2 ? 1 : -1) * 0.5;
              const x = Math.cos(ang) * rr, z = Math.sin(ang) * rr;
              m.position.set(x, surf(def, x, z) + (hop ? Math.abs(Math.sin(t * 6 + ph)) * 0.25 * a.size : 0), z);
              m.rotation.y = -ang + (k % 2 ? 0 : Math.PI);
              if (m.userData.legs) m.userData.legs.forEach((l, i) => { l.rotation.x = Math.sin(t * 8 + i * Math.PI) * 0.5; });
            });
          } else if (a.swim) {
            root.add(m);
            const R = def.r * 1.55;
            anim.push(t => { const ang = ph + t * 0.15; m.position.set(def.x + Math.cos(ang) * R, (cfg.shape === 'float' ? -100 : 0.05) + Math.sin(t * 2 + ph) * 0.03, def.z + Math.sin(ang) * R); m.rotation.y = -ang; });
            if (cfg.shape === 'float') m.visible = false;
          } else if (a.kind === 'beach' || a.kind === 'crab') {
            def.group.add(m);
            const aa = rng() * TAU, rr = def.r * 1.12;
            anim.push(t => {
              const ang = aa + (a.kind === 'crab' ? Math.sin(t * 0.6 + ph) * 0.4 : 0);
              const x = Math.cos(ang) * rr, z = Math.sin(ang) * rr;
              m.position.set(x, cfg.shape === 'float' ? surf(def, x * 0.85, z * 0.85) : 0.65, z);
              m.rotation.y = -ang + (a.kind === 'crab' ? 0 : Math.PI / 2);
              if (a.kind === 'beach') m.rotation.z = Math.sin(t * 1.5 + ph) * 0.08;
            });
          } else if (a.kind === 'sea') {
            root.add(m);
            if (cfg.shape === 'float') { m.visible = false; continue; }
            const R = extent * (0.55 + rng() * 0.4);
            anim.push(t => {
              const ang = ph + t * 0.06 * (a.size > 2 ? 0.5 : 1);
              m.position.x = Math.cos(ang) * R; m.position.z = Math.sin(ang) * R; m.rotation.y = -ang;
              if (a.jump) { const c = (t * 0.35 + ph) % 1; m.position.y = c < 0.3 ? Math.sin(c / 0.3 * Math.PI) * 1.6 - 0.2 : -0.6; m.rotation.x = c < 0.3 ? -Math.cos(c / 0.3 * Math.PI) * 0.8 : 0; }
              else if (a.spout) m.position.y = -0.5 + Math.sin(t * 0.4 + ph) * 0.35;
              else m.position.y = -0.05;
            });
          } else if (a.kind === 'flyer') {
            root.add(m);
            const R = extent * (0.3 + rng() * 0.6), h = 8 + rng() * 6;
            anim.push(t => { const ang = ph + t * 0.18; m.position.set(Math.cos(ang) * R, h + Math.sin(t + ph) * 1.2 + (cfg.shape === 'float' ? 6 : 0), Math.sin(ang) * R); m.rotation.y = -ang; const f = Math.sin(t * 6 + ph) * 0.6; m.userData.wings[0].rotation.z = f; m.userData.wings[1].rotation.z = -f; });
          } else if (a.kind === 'flutter') {
            def.group.add(m);
            anim.push(t => { const x = Math.sin(t * 0.5 + ph) * def.r * 0.6, z = Math.cos(t * 0.37 + ph) * def.r * 0.6; m.position.set(x, surf(def, x, z) + 0.8 + Math.sin(t * 3 + ph) * 0.3, z); m.rotation.y = t * 0.5; const f = Math.sin(t * 18) * 1.1; m.userData.wings[0].rotation.y = f; m.userData.wings[1].rotation.y = Math.PI - f; });
          }
        }
      });
    }

    /* ---------- 生活感：小人、居民、貝殼 ---------- */
    const CHATS = ['今天天氣真好！', '你也是來逛島的嗎？', '聽說中間那座島很有趣喔。', '我在這裡住好久了。', '要不要拿貝殼跟我換點東西？', '晚上燈亮起來很漂亮！', '慢慢逛，不用急～'];
    function placePeople(rng) {
      const f = cfg.features || [];
      const walkers = f.includes('walkers') || cfg.life;
      const residents = f.includes('residents') || cfg.life;
      if (walkers) {
        isles.forEach(def => {
          const n = def.isCenter ? 3 : (cfg.detail >= 3 ? 2 : 1);
          for (let i = 0; i < n; i++) {
            const p = person(null, rng); def.group.add(p);
            const ph = rng() * TAU, spd = (0.25 + rng() * 0.2) * (rng() < 0.5 ? 1 : -1), rr = def.pathR || def.r * 0.58;
            const isRes = residents && i === 0;
            if (isRes) {
              p.userData.res = { chat: CHATS[Math.floor(rng() * CHATS.length)], isle: def.index, wave: 0 };
              p.traverse(o => { if (o.isMesh) { o.userData.pick = { kind: 'resident', ref: p, isle: def.index }; pickables.push(o); } });
            }
            const walk = (t, dt) => {
              const res = p.userData.res;
              if (res && res.wave > 0) {
                res.wave -= dt;
                p.userData.armR.rotation.z = -2.6 + Math.sin(t * 12) * 0.4;
                return;
              }
              p.userData.armR.rotation.z = 0;
              const ang = ph + t * spd / rr * 1.4;
              const x = Math.cos(ang) * rr, z = Math.sin(ang) * rr;
              p.position.set(x, surf(def, x, z) + Math.abs(Math.sin(t * 8 + ph)) * 0.04, z);
              p.rotation.y = -ang + (spd > 0 ? 0 : Math.PI);
              p.userData.armL.rotation.x = Math.sin(t * 8 + ph) * 0.5; p.userData.armR.rotation.x = -Math.sin(t * 8 + ph) * 0.5;
            };
            walk(0, 0);
            anim.push(walk);
          }
        });
      }
      if (residents && cfg.shape !== 'float') spawnShells(rng);
    }
    function spawnShells(rng) {
      shells.forEach(s => s.parent && s.parent.remove(s));
      shells = [];
      const cols = ['#f7d9c4', '#f2b8c6', '#fff3e0', '#e9c7a0'];
      isles.forEach(def => {
        for (let i = 0; i < 2; i++) {
          const s = mesh(geo('shell', () => { const g = new T.ConeGeometry(0.15, 0.25, 6); g.rotateX(Math.PI / 2); return g; }), M(cols[Math.floor(rng() * cols.length)]));
          const a = rng() * TAU, rr = def.r * 1.17;
          s.position.set(Math.cos(a) * rr, 0.7, Math.sin(a) * rr);
          s.userData.pick = { kind: 'shell', ref: s };
          pickables.push(s); def.group.add(s); shells.push(s);
          anim.push(t => { s.rotation.y = t + a; });
        }
      });
    }

    /* ---------- 天空與海 ---------- */
    function placeSky(rng) {
      const f = cfg.features || [];
      const sky = f.includes('skyLife') || cfg.life;
      // 星星
      const sg = new T.BufferGeometry(); const sp = [];
      for (let i = 0; i < 700; i++) { const a = rng() * TAU, e = 0.1 + rng() * 1.3, R = 330; sp.push(Math.cos(a) * Math.cos(e) * R, Math.sin(e) * R, Math.sin(a) * Math.cos(e) * R); }
      sg.setAttribute('position', new T.Float32BufferAttribute(sp, 3));
      stars = new T.Points(sg, new T.PointsMaterial({ color: '#ffffff', size: 1.6, sizeAttenuation: false, transparent: true, opacity: 0, fog: false }));
      root.add(stars);
      // 月亮
      const moon = new T.Mesh(new T.SphereGeometry(6, 16, 12), new T.MeshBasicMaterial({ color: '#f6f1d5', transparent: true, opacity: 0, fog: false }));
      moon.position.set(-120, 110, -200); root.add(moon);
      anim.push(() => { moon.material.opacity = W._night; });
      if (sky || cfg.shape === 'float' || S.name === '雲海仙境') {
        // 雲
        const cm = new T.MeshStandardMaterial({ color: '#ffffff', roughness: 1, flatShading: S.shade === 'flat', transparent: true, opacity: 0.92 });
        for (let i = 0; i < (cfg.shape === 'float' ? 12 : 7); i++) {
          const cl = new T.Group();
          for (let j = 0; j < 4; j++) { const b = new T.Mesh(geo('cloudb', () => new T.IcosahedronGeometry(1.4, 1)), cm); b.position.set(j * 1.3 - 2, Math.sin(j) * 0.4, (rng() - 0.5) * 1.2); b.scale.setScalar(0.8 + rng() * 0.6); cl.add(b); }
          const R = extent * (1.0 + rng() * 0.6), h = 15 + rng() * 6 + (cfg.shape === 'float' ? 5 : 0), ph = rng() * TAU;
          cl.scale.setScalar(0.7 + rng() * 0.4);
          root.add(cl);
          anim.push(t => { const a = ph + t * 0.012; cl.position.set(Math.cos(a) * R, h, Math.sin(a) * R); });
          anim.push(() => { cm.color.setRGB(1 - W._night * 0.45, 1 - W._night * 0.42, 1 - W._night * 0.3); cm.opacity = 0.92 - W._night * 0.45; });
        }
      }
      if (sky) {
        // 鳥群
        for (let fl = 0; fl < 2; fl++) {
          const flock = new T.Group();
          for (let i = 0; i < 5; i++) { const b = animalMesh(D.ANIMALS.gull, rng); b.scale.setScalar(0.25); b.position.set((i % 2 ? 1 : -1) * Math.ceil(i / 2) * 0.8, 0, -Math.ceil(i / 2) * 0.7); flock.add(b); }
          root.add(flock);
          const ph = rng() * TAU, R = extent * 0.9, h = 18 + fl * 4;
          anim.push(t => { const a = ph + t * 0.1; flock.position.set(Math.cos(a) * R, h, Math.sin(a) * R); flock.rotation.y = -a; flock.children.forEach((b, i) => { const f = Math.sin(t * 7 + i) * 0.7; b.userData.wings[0].rotation.z = f; b.userData.wings[1].rotation.z = -f; }); });
        }
        // 帆船
        if (cfg.shape !== 'float') {
          for (let i = 0; i < 3; i++) {
            const b = boat(rng); root.add(b);
            const R = extent * (0.65 + i * 0.12), ph = rng() * TAU, spd = 0.03 + rng() * 0.02;
            anim.push(t => { const a = ph + t * spd; b.position.set(Math.cos(a) * R, Math.sin(t * 1.5 + i) * 0.08, Math.sin(a) * R); b.rotation.y = -a; b.rotation.z = Math.sin(t * 1.2 + i) * 0.06; });
          }
        }
      }
      if (cfg.shape === 'snow') for (let i = 0; i < 6; i++) { const ice = mesh(new T.IcosahedronGeometry(1 + rng() * 1.2, 0), M('#eaf6fb')); ice.scale.y = 0.7; const a = rng() * TAU, R = extent * (0.7 + rng() * 0.5); ice.position.set(Math.cos(a) * R, 0.1, Math.sin(a) * R); root.add(ice); anim.push(t => { ice.position.y = Math.sin(t * 0.7 + i) * 0.1; }); }
      if (cfg.shape === 'volcano') {
        const c = isles[0];
        const smoke = [];
        for (let i = 0; i < 10; i++) { const s = mesh(geo('smk', () => new T.IcosahedronGeometry(0.8, 0)), M('#8d8a88', { transparent: true, opacity: 0.6 }), { shadow: false }); root.add(s); smoke.push([s, i / 10]); }
        const top = c.volcanoTop || new T.Vector3(0, 8, 0);
        anim.push(t => smoke.forEach(([s, o]) => { const k = (t * 0.12 + o) % 1; s.position.set(top.x + Math.sin(o * 7) * k * 2 + k * 3, top.y + k * 10, top.z + Math.cos(o * 7) * k * 1.5); s.scale.setScalar(0.6 + k * 2); s.material.opacity = 0.55 * (1 - k); }));
      }
      if (cfg.shape === 'atoll') {
        const ring = mesh(new T.TorusGeometry(extent * 0.92, 1.4, 6, segs(60)), M('#f8e6b5')); ring.rotation.x = Math.PI / 2; ring.scale.z = 0.25; ring.position.y = -0.05; root.add(ring);
        for (let i = 0; i < 18; i++) { const a = i / 18 * TAU; const p = tree('palm', 0.8, rng); p.position.set(Math.cos(a) * extent * 0.92, 0.2, Math.sin(a) * extent * 0.92); root.add(p); }
      }
      // 螢火蟲
      if (cfg.features.includes('nightLights') || cfg.life) {
        const fg = new T.BufferGeometry(); const fp = [];
        for (let i = 0; i < 80; i++) { const def = isles[i % isles.length]; const a = rng() * TAU, d = rng() * def.r; fp.push(def.x + Math.cos(a) * d, def.top + def.group.position.y + 0.5 + rng() * 1.5, def.z + Math.sin(a) * d); }
        fg.setAttribute('position', new T.Float32BufferAttribute(fp, 3));
        fireflies = new T.Points(fg, new T.PointsMaterial({ color: '#f9f871', size: 0.18, transparent: true, opacity: 0 }));
        root.add(fireflies);
        const base = fp.slice();
        anim.push(t => { const p = fireflies.geometry.attributes.position; for (let i = 0; i < p.count; i++) p.setY(i, base[i * 3 + 1] + Math.sin(t * 1.5 + i) * 0.3); p.needsUpdate = true; fireflies.material.opacity = W._night * (0.6 + Math.sin(t * 4) * 0.3); });
      }
    }

    function buildWater() {
      const isCloud = cfg.shape === 'float';
      const size = Math.max(260, extent * 7);
      const g = new T.PlaneGeometry(size, size, 70, 70);
      g.rotateX(-Math.PI / 2);
      const col = isCloud ? '#eef3f8' : (cfg.shape === 'atoll' ? '#5cc8d6' : cfg.shape === 'snow' ? '#5b8fb0' : (hooks.waterColor || S.water));
      const wc = new T.Color(col); if (S.light) { const h = {}; wc.getHSL(h); wc.setHSL(h.h, Math.min(h.s, 0.75), clamp(h.l * Math.min(S.light, 1.05), 0.08, 0.85)); }
      const mat = new T.MeshStandardMaterial({ color: wc, roughness: isCloud ? 1 : 0.35, metalness: 0, flatShading: S.shade === 'flat' || isCloud, transparent: false, opacity: 1 });
      waterMesh = new T.Mesh(g, mat);
      waterMesh.receiveShadow = false; // 島的影子落在水面會像錯位的第二層邊
      waterMesh.position.y = isCloud ? -2 : 0;
      root.add(waterMesh);
      waterBase = g.attributes.position.array.slice();
      waterMesh.userData.cloud = isCloud;
      if (cfg.shape === 'atoll') { // 潟湖內圈較淺
        const lag = new T.Mesh(new T.CircleGeometry(extent * 0.88, 48), new T.MeshBasicMaterial({ color: M.adj('#9fe6e3'), transparent: true, opacity: 0.45, depthWrite: false }));
        lag.rotation.x = -Math.PI / 2; lag.position.y = 0.04; root.add(lag);
      }
    }
    function updateWater(t) {
      if (!waterMesh) return;
      const p = waterMesh.geometry.attributes.position;
      const a = p.array, cloud = waterMesh.userData.cloud;
      const amp = cloud ? 0.9 : 0.18;
      for (let i = 0; i < a.length; i += 3) {
        const x = waterBase[i], z = waterBase[i + 2];
        a[i + 1] = Math.sin(x * 0.15 + t * 0.9) * amp + Math.cos(z * 0.12 + t * 0.7) * amp * 0.8;
      }
      p.needsUpdate = true;
      if (S.shade === 'flat' || cloud) waterMesh.geometry.computeVertexNormals();
    }

    function buildBridges() {
      const wantBridges = cfg.shape === 'float' || cfg.type === 'portfolio' || cfg.shape === 'terrace';
      if (!wantBridges) return;
      const pairs = [];
      if (cfg.type === 'portfolio') { for (let i = 1; i < isles.length - 1; i++) pairs.push([i, i + 1]); if (isles.length > 1) pairs.push([0, 1]); }
      else for (let i = 1; i < isles.length; i++) pairs.push([0, i]);
      const plankG = geo('plank', () => new T.BoxGeometry(0.9, 0.08, 0.3));
      pairs.forEach(([a, b]) => {
        const A = isles[a], B = isles[b];
        const pa = new T.Vector3(A.x, A.group.position.y + A.top - 0.05, A.z), pb = new T.Vector3(B.x, B.group.position.y + B.top - 0.05, B.z);
        const dir = pb.clone().sub(pa); const len = dir.length(); dir.normalize();
        const s = pa.clone().add(dir.clone().multiplyScalar(A.r * 0.95)), e = pb.clone().sub(dir.clone().multiplyScalar(B.r * 0.95));
        const L = s.distanceTo(e);
        const n = Math.max(4, Math.round(L / 0.36));
        const yaw = Math.atan2(dir.x, dir.z);
        for (let i = 0; i <= n; i++) {
          const t = i / n; const p = s.clone().lerp(e, t);
          p.y -= Math.sin(t * Math.PI) * (cfg.shape === 'float' ? L * 0.08 : 0) - (cfg.shape === 'float' ? 0 : Math.sin(t * Math.PI) * 0.6);
          const pl = mesh(plankG, M('#a8754a')); pl.position.copy(p); pl.rotation.y = yaw; root.add(pl);
        }
        const rope = new T.LineBasicMaterial({ color: '#7b5535' });
        for (const side of [-0.45, 0.45]) {
          const pts = [];
          const off = new T.Vector3(Math.cos(yaw) * side, 0.45, -Math.sin(yaw) * side);
          for (let i = 0; i <= 16; i++) { const t = i / 16; const p = s.clone().lerp(e, t).add(off); p.y -= Math.sin(t * Math.PI) * (cfg.shape === 'float' ? L * 0.08 : -0.6); pts.push(p); }
          root.add(new T.Line(new T.BufferGeometry().setFromPoints(pts), rope));
        }
      });
    }

    /* ---------- 建構整個世界 ---------- */
    function build() {
      if (root) { scene.remove(root); dispose(root); }
      root = new T.Group(); scene.add(root);
      anim = []; nightMats = []; pickables = []; isles = []; shells = [];
      Object.keys(GEO).forEach(k => { GEO[k].dispose && GEO[k].dispose(); delete GEO[k]; });
      S = Object.assign({}, D.STYLES[cfg.style] || D.STYLES.lowpoly);
      M = makeMaterials(S);
      renderer.shadowMap.enabled = cfg.detail >= 3;
      const rng = U.seeded((cfg.meta.slug || 'isle') + cfg.shape + cfg.style);
      const list = cfg.islands.filter(i => (i.name || '').trim()).length ? cfg.islands.filter(i => (i.name || '').trim()) : cfg.islands;
      const centerR = list.length > 8 ? 8 : 7;
      const radii = list.map((isl, i) => 3.6 + (U.seeded(isl.name + i)() * 0.9) + (cfg.type === 'literature' ? Math.min(1.4, (U.rows((isl.extra || {}).refs).length) * 0.25) : 0));
      const pos = layout(list.length, cfg.type, centerR, Math.max(4.5, ...radii));
      layoutPos = pos;
      extent = pos.reduce((m, p) => Math.max(m, Math.hypot(p[0], p[1])), 12) + 7;
      W.extent = extent;
      const centerDef = { index: 0, x: 0, z: 0, r: centerR, isCenter: true, name: cfg.center.name || (D.TYPES[cfg.type] || {}).centerName || '中央島', data: cfg.center };
      isles.push(buildIsland(centerDef));
      if (cfg.shape === 'volcano') {
        const c = isles[0];
        const v = mesh(new T.CylinderGeometry(1.1, c.r * 0.42, 4, segs(14), 1, true), M('#4b4340')); v.position.set(c.r * 0.45, c.top + 2, -c.r * 0.45); c.group.add(v);
        const lava = mesh(new T.CircleGeometry(1.2, segs(14)), M('#ff6a2a', { basic: true }), { shadow: false }); lava.rotation.x = -Math.PI / 2; lava.position.set(c.r * 0.45, c.top + 3.9, -c.r * 0.45); c.group.add(lava);
        c.volcanoTop = new T.Vector3(c.r * 0.45, c.top + 4, -c.r * 0.45);
        const gl = new T.PointLight('#ff6a2a', 1.2, 14); gl.position.copy(c.volcanoTop); c.group.add(gl);
        anim.push(t => { gl.intensity = 0.8 + Math.sin(t * 3) * 0.3 + W._night; });
      }
      list.forEach((isl, i) => {
        const r = radii[i];
        isles.push(buildIsland({ index: i + 1, x: pos[i][0], z: pos[i][1], r, isCenter: false, name: isl.name, data: isl }));
      });
      buildWater();
      if (hooks.buildBridges) hooks.buildBridges(isles, root);
      else buildBridges();
      placeExtras(rng);
      placeAnimals(rng);
      placePeople(rng);
      placeSky(rng);
      setupShadowCam();
      if (cfg.rpg) setupRpg(); else rpg = null;
      W.isles = isles;
      applyTod();
    }
    function setupShadowCam() {
      const e = extent * 1.15;
      const sc = sun.shadow.camera; sc.left = -e; sc.right = e; sc.top = e; sc.bottom = -e; sc.near = 1; sc.far = 400; sc.updateProjectionMatrix();
    }
    function dispose(o) {
      o.traverse(c => {
        if (c.geometry && !Object.values(GEO).includes(c.geometry)) c.geometry.dispose();
        if (c.material) { const ms = Array.isArray(c.material) ? c.material : [c.material]; ms.forEach(m => { if (m.map) m.map.dispose(); m.dispose(); }); }
      });
    }

    /* ---------- 晝夜 ---------- */
    W._night = 0;
    function applyTod() {
      const st = todState(tod);
      let night = st.night;
      if (S && S.name === '夜光科幻') night = Math.max(night, 0.55);
      W._night = night;
      const ang = (tod - 6) / 12 * Math.PI; // 6 點日出，18 點日落
      const R = extent * 2.5;
      sun.position.set(Math.cos(ang) * R * 0.8, Math.max(0.25, Math.sin(ang)) * R, R * 0.45);
      if (night > 0.6) sun.position.set(-R * 0.6, R * 0.9, -R * 0.4); // 月光
      sun.color.copy(st.sunC);
      const moodK = mood === 'support' ? 1.12 : mood === 'challenge' ? 0.75 : 1;
      sun.intensity = st.sun * (S ? S.light || 1 : 1) * moodK;
      hemi.intensity = st.hemi * moodK;
      hemi.color.set(night > 0.5 ? '#8fa0d8' : mood === 'support' ? '#fff0d0' : '#ffffff');
      amb.intensity = 0.12 + night * 0.12;
      if (hooks.decorateIsland) {
        sun.intensity *= 0.68;
        hemi.intensity *= 0.82;
        sun.color.set('#fff0d6');
      }
      nightMats.forEach(n => { n.mat.emissiveIntensity = Math.max(n.base, night * n.max); });
      if (stars) stars.material.opacity = clamp((night - 0.3) * 1.4, 0, 1);
      W.tod = tod;
    }
    W.setFog = function (hex) {
      scene.fog.color.set(hex);
      scene.fog.near = extent * 2.2; scene.fog.far = extent * 9;
    };
    W.setTod = function (h, mode) { tod = h; if (mode) todMode = mode; applyTod(); };
    W.getTod = () => tod;
    W.setTodMode = m => { todMode = m; };
    W.todState = todState;
    W.setMood = function (m) { mood = m; applyTod(); };
    W.setBillboard = function (i, title, line) { const d = isles[i]; if (d) drawBoard(d, title, line); };

    /* ---------- 相機控制 ---------- */
    const cam = { theta: 0.7, phi: 0.95, radius: 60, tx: 0, ty: 0, tz: 0 };
    let home = null;
    let tween = null; // {frames, i, t}
    let autoOrbit = false;
    let follow = false;
    function applyCam() {
      cam.phi = clamp(cam.phi, 0.05, 1.45);
      cam.radius = clamp(cam.radius, 6, extent * 5);
      const sp = Math.sin(cam.phi);
      camera.position.set(cam.tx + cam.radius * sp * Math.sin(cam.theta), cam.ty + cam.radius * Math.cos(cam.phi), cam.tz + cam.radius * sp * Math.cos(cam.theta));
      camera.lookAt(cam.tx, cam.ty, cam.tz);
    }
    function homeView() {
      const fit = extent * (camera.aspect < 0.8 ? 3.2 : 2.15);
      return { theta: 0.55, phi: 0.92, radius: fit, tx: 0, ty: cfg.shape === 'float' ? 6 : 0, tz: 0 };
    }
    function startTween(frames) {
      if (reduced || !frames.length) { if (frames.length) Object.assign(cam, frames[frames.length - 1]); tween = null; applyCam(); return; }
      tween = { frames: frames.map(f => Object.assign({ d: 1.6 }, f)), i: 0, t: 0, from: Object.assign({}, cam) };
    }
    function stepTween(dt) {
      if (!tween) return;
      const f = tween.frames[tween.i];
      tween.t += dt / f.d;
      const k = ease(clamp(tween.t, 0, 1));
      ['theta', 'phi', 'radius', 'tx', 'ty', 'tz'].forEach(key => { if (f[key] != null) cam[key] = lerp(tween.from[key], f[key], k); });
      if (tween.t >= 1) {
        tween.i++; tween.t = 0; tween.from = Object.assign({}, cam);
        if (tween.i >= tween.frames.length) { tween = null; if (W._onTweenEnd) { const cb = W._onTweenEnd; W._onTweenEnd = null; cb(); } }
      }
    }
    function nearestTheta(target) { // 讓轉向走最短路
      let d = target - cam.theta; while (d > Math.PI) d -= TAU; while (d < -Math.PI) d += TAU; return cam.theta + d;
    }
    W.playIntro = function () {
      home = homeView();
      const h = home, mode = cfg.cinema || 'smooth';
      autoOrbit = false;
      const set = o => Object.assign(cam, h, o);
      switch (mode) {
        case 'none': set({}); applyCam(); tween = null; break;
        case 'smooth': set({ radius: h.radius * 1.7, phi: 0.6, theta: h.theta - 0.6 }); startTween([Object.assign({ d: 3 }, h)]); break;
        case 'epic': set({ radius: h.radius * 2.8, phi: 0.12, theta: h.theta - 2.5, ty: h.ty + 10 }); startTween([{ theta: h.theta - 1, phi: 0.45, radius: h.radius * 1.9, ty: h.ty + 4, d: 2.6 }, { theta: h.theta + 0.6, phi: 1.2, radius: h.radius * 0.7, ty: h.ty, d: 2.2 }, Object.assign({ d: 2 }, h)]); break;
        case 'orbit': set({}); applyCam(); autoOrbit = true; tween = null; break;
        case 'drone': {
          set({ radius: h.radius * 1.4, phi: 0.7 });
          const fr = isles.slice(1, 7).map(d => ({ tx: d.x, ty: d.group.position.y + d.top, tz: d.z, radius: d.r * 3.4, phi: 1.12, theta: Math.atan2(d.x, d.z) + 0.4, d: 1.5 }));
          startTween(fr.concat([Object.assign({ d: 2.2 }, h)])); break;
        }
        case 'topdown': set({ phi: 0.06, radius: h.radius * 1.5 }); startTween([Object.assign({ d: 3 }, h)]); break;
        case 'crane': set({ phi: 1.42, radius: h.radius * 0.75, ty: h.ty - 1 }); startTween([Object.assign({ d: 3.4 }, h)]); break;
        default: set({}); applyCam();
      }
    };
    W.home = function () { home = homeView(); autoOrbit = false; startTween([Object.assign({ theta: nearestTheta(home.theta) }, home, { theta: nearestTheta(home.theta), d: 1.4 })]); };
    W.flyTo = function (i) {
      const d = isles[i]; if (!d) return;
      autoOrbit = false;
      const tgt = { tx: d.x, ty: d.group.position.y + d.top, tz: d.z, radius: d.r * (hooks.decorateIsland ? (camera.aspect < 0.8 ? 4.7 : 3.1) : (d.isCenter ? 3.4 : 3.9)), phi: hooks.decorateIsland ? 0.67 : 0.95, theta: nearestTheta(hooks.decorateIsland ? 0.13 : (Math.atan2(d.x, d.z) || cam.theta)) };
      if (cfg.cinema === 'epic') startTween([{ tx: d.x, ty: tgt.ty, tz: d.z, radius: d.r * 6, phi: 0.7, theta: tgt.theta - 1.2, d: 1.3 }, Object.assign({ d: 1.3 }, tgt)]);
      else if (cfg.cinema === 'topdown') startTween([Object.assign({}, tgt, { phi: 0.35, d: 1.4 })]);
      else if (cfg.cinema === 'none') startTween([Object.assign({}, tgt, { d: 0.01 })]);
      else startTween([Object.assign({ d: 1.4 }, tgt)]);
      if (rpg) rpgTravel(i);
    };
    W.setView = function (o) { tween = null; autoOrbit = false; Object.assign(cam, o); applyCam(); };
    W.highlight = function (i) { /* 預留：標示被搜尋到的島 */ };

    // 滑鼠、觸控
    const ptrs = new Map();
    let dragDist = 0, lastPinch = 0;
    const el = renderer.domElement;
    el.addEventListener('pointerdown', e => { el.setPointerCapture(e.pointerId); ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY }); dragDist = 0; });
    el.addEventListener('pointermove', e => {
      const p = ptrs.get(e.pointerId); if (!p) return;
      const dx = e.clientX - p.x, dy = e.clientY - p.y;
      p.x = e.clientX; p.y = e.clientY;
      if (ptrs.size === 1) {
        dragDist += Math.abs(dx) + Math.abs(dy);
        if (dragDist > 4) { tween = null; autoOrbit = false; }
        if (e.buttons === 2 || e.shiftKey) { // 平移
          const k = cam.radius * 0.0016;
          cam.tx -= (Math.cos(cam.theta) * dx - Math.sin(cam.theta) * dy) * k;
          cam.tz -= (-Math.sin(cam.theta) * dx - Math.cos(cam.theta) * dy) * k;
        } else { cam.theta -= dx * 0.006; cam.phi -= dy * 0.005; }
      } else if (ptrs.size === 2) {
        const [a, b] = [...ptrs.values()];
        const dist = Math.hypot(a.x - b.x, a.y - b.y);
        if (lastPinch && dist > 1) cam.radius *= lastPinch / dist;
        lastPinch = dist; dragDist = 99; tween = null;
      }
    });
    const up = e => {
      const wasTap = ptrs.size === 1 && dragDist < 6;
      ptrs.delete(e.pointerId); if (ptrs.size < 2) lastPinch = 0;
      if (wasTap) pick(e.clientX, e.clientY);
    };
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', e => { ptrs.delete(e.pointerId); lastPinch = 0; });
    el.addEventListener('contextmenu', e => e.preventDefault());
    el.addEventListener('wheel', e => { e.preventDefault(); tween = null; autoOrbit = false; cam.radius *= Math.exp(e.deltaY * 0.0012); }, { passive: false });

    const ray = new T.Raycaster(), ndc = new T.Vector2();
    function pick(cx, cy) {
      const rc = el.getBoundingClientRect();
      ndc.set((cx - rc.left) / rc.width * 2 - 1, -(cy - rc.top) / rc.height * 2 + 1);
      ray.setFromCamera(ndc, camera);
      const hit = ray.intersectObjects(pickables, false)[0];
      if (!hit) return;
      const info = Object.assign({}, hit.object.userData.pick, { point: hit.point });
      if (info.kind === 'resident') { info.ref.userData.res.wave = 2.2; info.chat = info.ref.userData.res.chat; }
      if (info.kind === 'shell') { const s = info.ref; s.parent && s.parent.remove(s); pickables = pickables.filter(p => p !== s); setTimeout(() => { if (root) spawnOne(); }, 20000); }
      if (info.kind === 'isle' && rpg) { rpgWalkTo(info.index, hit.point); }
      hooks.onPick && hooks.onPick(info);
    }
    function spawnOne() {
      const rng = Math.random;
      const def = isles[Math.floor(rng() * isles.length)];
      const s = mesh(geo('shell', () => new T.ConeGeometry(0.15, 0.25, 6)), M('#f7d9c4'));
      const a = rng() * TAU, rr = def.r * 1.17; s.position.set(Math.cos(a) * rr, 0.7, Math.sin(a) * rr);
      s.userData.pick = { kind: 'shell', ref: s }; pickables.push(s); def.group.add(s);
    }

    /* ---------- RPG 角色 ---------- */
    function setupRpg() {
      const r0 = U.seeded('avatar');
      const av = person([cfg.theme.accent, '#f2cfae'], r0); av.scale.setScalar(1.4);
      const hat = mesh(new T.ConeGeometry(0.2, 0.3, 8), M(cfg.theme.primary)); hat.position.y = 1.0; av.add(hat);
      const ring = new T.Mesh(new T.RingGeometry(0.35, 0.45, 20), new T.MeshBasicMaterial({ color: cfg.theme.accent, transparent: true, opacity: 0.7 })); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.03; av.add(ring);
      root.add(av);
      const boatM = boat(r0); boatM.visible = false; root.add(boatM);
      rpg = { av, boat: boatM, isle: 0, lx: 0, lz: isles[0].r * 0.55, target: null, travel: null, keys: {}, near: -1 };
      placeAv();
    }
    function placeAv() {
      const d = isles[rpg.isle];
      rpg.av.position.set(d.x + rpg.lx, d.yAt(rpg.lx, rpg.lz), d.z + rpg.lz);
    }
    function rpgWalkTo(i, point) {
      if (!rpg || rpg.travel) return;
      if (i !== rpg.isle) { rpgTravel(i); return; }
      const d = isles[i];
      rpg.target = [point.x - d.x, point.z - d.z];
    }
    function rpgTravel(i) {
      if (!rpg || i === rpg.isle || rpg.travel) return;
      const A = isles[rpg.isle], B = isles[i];
      const from = rpg.av.position.clone();
      const to = new T.Vector3(B.x + (A.x - B.x) / Math.hypot(A.x - B.x, A.z - B.z || 1) * B.r * 0.7, 0, B.z + (A.z - B.z) / Math.hypot(A.x - B.x, A.z - B.z || 1) * B.r * 0.7);
      const lx = to.x - B.x, lz = to.z - B.z;
      to.y = B.yAt(lx, lz);
      rpg.travel = { from, to, t: 0, dur: Math.max(2, from.distanceTo(to) / 9), dest: i, lx, lz, sea: cfg.shape !== 'float' && cfg.type !== 'portfolio' && cfg.shape !== 'terrace' };
      rpg.target = null;
    }
    function stepRpg(dt, t) {
      if (!rpg) return;
      const av = rpg.av;
      if (rpg.travel) {
        const tr = rpg.travel; tr.t += dt / tr.dur;
        const k = ease(clamp(tr.t, 0, 1));
        const p = tr.from.clone().lerp(tr.to, k);
        if (tr.sea) { p.y = lerp(tr.from.y, tr.to.y, k) - Math.sin(k * Math.PI) * (tr.from.y - 0.2); rpg.boat.visible = k > 0.08 && k < 0.92; rpg.boat.position.set(p.x, 0.05, p.z); rpg.boat.rotation.y = Math.atan2(tr.to.x - tr.from.x, tr.to.z - tr.from.z) - Math.PI / 2; p.y = Math.max(p.y, 0.4); }
        else p.y += Math.sin(k * Math.PI) * 1.2;
        av.position.copy(p);
        av.rotation.y = Math.atan2(tr.to.x - tr.from.x, tr.to.z - tr.from.z);
        if (tr.t >= 1) { rpg.isle = tr.dest; rpg.lx = tr.lx; rpg.lz = tr.lz; rpg.travel = null; rpg.boat.visible = false; placeAv(); hooks.onArrive && hooks.onArrive(rpg.isle); }
        followCam(dt);
        return;
      }
      const d = isles[rpg.isle];
      let mx = 0, mz = 0;
      const k = rpg.keys;
      if (k.ArrowUp || k.KeyW) mz -= 1; if (k.ArrowDown || k.KeyS) mz += 1; if (k.ArrowLeft || k.KeyA) mx -= 1; if (k.ArrowRight || k.KeyD) mx += 1;
      if (mx || mz) { // 依相機方向移動
        const s = Math.sin(cam.theta), c = Math.cos(cam.theta);
        const wx = mx * c + mz * s, wz = -mx * s + mz * c;
        rpg.target = [rpg.lx + wx * 0.6, rpg.lz + wz * 0.6];
      }
      if (rpg.target) {
        const dx = rpg.target[0] - rpg.lx, dz = rpg.target[1] - rpg.lz, dist = Math.hypot(dx, dz);
        if (dist < 0.08) rpg.target = null;
        else {
          const sp = Math.min(dist, dt * 3.2);
          let nx = rpg.lx + dx / dist * sp, nz = rpg.lz + dz / dist * sp;
          const rr = Math.hypot(nx, nz), lim = d.r * 0.92;
          if (rr > lim) { nx *= lim / rr; nz *= lim / rr; rpg.target = null; }
          rpg.lx = nx; rpg.lz = nz;
          av.rotation.y = Math.atan2(dx, dz);
          av.userData.armL.rotation.x = Math.sin(t * 10) * 0.6; av.userData.armR.rotation.x = -Math.sin(t * 10) * 0.6;
        }
        placeAv();
        av.position.y += Math.abs(Math.sin(t * 10)) * 0.05;
      }
      // 靠近 NPC
      let near = -1;
      if (d.npc) { const np = new T.Vector3(); d.npc.getWorldPosition(np); if (np.distanceTo(av.position) < 1.8) near = rpg.isle; }
      if (near !== rpg.near) { rpg.near = near; hooks.onNear && hooks.onNear(near); }
      followCam(dt);
    }
    function followCam(dt) {
      if (!follow || tween) return;
      const p = rpg.av.position;
      cam.tx = lerp(cam.tx, p.x, Math.min(1, dt * 3)); cam.ty = lerp(cam.ty, p.y, Math.min(1, dt * 3)); cam.tz = lerp(cam.tz, p.z, Math.min(1, dt * 3));
    }
    W.rpgKey = (code, down) => { if (rpg) rpg.keys[code] = down; };
    W.setFollow = v => { follow = !!v; if (v && rpg) startTween([{ tx: rpg.av.position.x, ty: rpg.av.position.y, tz: rpg.av.position.z, radius: 14, phi: 0.9, d: 1 }]); };
    W.rpgIsle = () => (rpg ? rpg.isle : -1);
    W.hasRpg = () => !!rpg;
    W.rpgDebug = () => (rpg ? { isle: rpg.isle, travel: rpg.travel ? +rpg.travel.t.toFixed(2) : null, dur: rpg.travel ? rpg.travel.dur : null } : null);

    /* ---------- 標籤投影 ---------- */
    const v3 = new T.Vector3();
    W.project = function (i) {
      const d = isles[i]; if (!d) return null;
      v3.set(d.x, d.group.position.y + d.top + (d.isCenter ? 4.2 : 3.2), d.z);
      v3.project(camera);
      const rc = el.getBoundingClientRect();
      return { x: (v3.x + 1) / 2 * rc.width, y: (1 - v3.y) / 2 * rc.height, vis: v3.z < 1 };
    };

    /* ---------- 迴圈 ---------- */
    let last = performance.now(), clock = 0, running = true, rafId = 0;
    let shiftPx = 0;
    function resize() {
      const w = container.clientWidth || 300, h = container.clientHeight || 300;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      if (shiftPx) camera.setViewOffset(w, h, shiftPx / 2, 0, w, h); else camera.clearViewOffset();
      camera.updateProjectionMatrix();
    }
    W.setShift = function (px) { shiftPx = px || 0; resize(); };
    const ro = new ResizeObserver(resize); ro.observe(container);
    function loop(now) {
      rafId = requestAnimationFrame(loop);
      if (!running) return;
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      if (!reduced) clock += dt;
      if (todMode === 'cycle' && !reduced) { tod = (tod + dt * 0.08) % 24; applyTod(); }
      else if (todMode === 'real') { const n = new Date(); const h = n.getHours() + n.getMinutes() / 60; if (Math.abs(h - tod) > 0.01) { tod = h; applyTod(); } }
      if (!reduced) { for (let i = 0; i < anim.length; i++) anim[i](clock, dt); updateWater(clock); }
      if (autoOrbit && !reduced) cam.theta += dt * 0.06;
      stepTween(dt);
      stepRpg(dt, clock);
      applyCam();
      renderer.render(scene, camera);
      hooks.onFrame && hooks.onFrame();
    }
    document.addEventListener('visibilitychange', () => { running = !document.hidden; last = performance.now(); });

    W.update = function (newCfg, keepCam) {
      cfg = newCfg;
      build();
      resize();
      if (!keepCam) W.playIntro(); else { home = homeView(); }
    };
    W.setReduced = function (v) { reduced = !!v; if (reduced) { tween = null; if (home) Object.assign(cam, home); } };
    W.screenshot = function () { renderer.render(scene, camera); return renderer.domElement.toDataURL('image/png'); };
    W.canvas = el;
    W.destroy = function () { cancelAnimationFrame(rafId); ro.disconnect(); if (root) dispose(root); renderer.dispose(); el.remove(); };
    W.cfg = () => cfg;

    build(); resize(); W.playIntro();
    rafId = requestAnimationFrame(loop);
    return W;
  }

  ISLE.World = { create, todState };
})();
