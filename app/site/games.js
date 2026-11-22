/* 群島製圖所：小遊戲與產生器（跑酷、觀測台模擬、證書、分享卡、背景音樂） */
(function () {
  const ISLE = window.ISLE;
  const TAU = Math.PI * 2;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  function hidpi(cv, w, h) {
    const r = Math.min(2, window.devicePixelRatio || 1);
    cv.width = w * r; cv.height = h * r; cv.style.width = '100%'; cv.style.maxWidth = w + 'px'; cv.style.aspectRatio = w + '/' + h;
    const c = cv.getContext('2d'); c.setTransform(r, 0, 0, r, 0, 0); return c;
  }
  function css(v, fb) { return getComputedStyle(document.documentElement).getPropertyValue(v).trim() || fb; }

  /* =========================================================
     三跑道跑酷
     ========================================================= */
  const LEVELS = {
    1: { name: '初級', speed: 0.33, time: 35, ratio: 0.6, gap: 1.15, need: 8 },
    2: { name: '中級', speed: 0.46, time: 40, ratio: 0.5, gap: 0.9, need: 12 },
    3: { name: '高級', speed: 0.62, time: 45, ratio: 0.42, gap: 0.7, need: 16 }
  };
  function runner(host, o) {
    const L = LEVELS[o.level] || LEVELS[1];
    host.innerHTML = '';
    const wrap = document.createElement('div'); wrap.className = 'rn-wrap';
    const cv = document.createElement('canvas'); wrap.appendChild(cv);
    const ctl = document.createElement('div'); ctl.className = 'rn-ctl';
    ctl.innerHTML = '<button type="button" data-d="-1" aria-label="往左">◀</button><span class="rn-tip">← → 或滑動換跑道</span><button type="button" data-d="1" aria-label="往右">▶</button>';
    wrap.appendChild(ctl); host.appendChild(wrap);
    const W = 640, H = 420;
    const c = hidpi(cv, W, H);
    const right = o.right.length ? o.right : ['✓'], wrong = o.wrong.length ? o.wrong : ['✗'];
    let lane = 1, items = [], spawnT = 0, t = 0, score = 0, good = 0, lives = 3, combo = 0, over = false, fx = [], last = performance.now(), raf = 0;
    const prim = css('--primary', '#1F4E79'), acc = css('--accent', '#E8684A');
    function move(d) { if (!over) lane = clamp(lane + d, 0, 2); }
    ctl.addEventListener('click', e => { const b = e.target.closest('button'); if (b) move(+b.dataset.d); });
    const key = e => { if (['ArrowLeft', 'KeyA'].includes(e.code)) { move(-1); e.preventDefault(); } if (['ArrowRight', 'KeyD'].includes(e.code)) { move(1); e.preventDefault(); } };
    window.addEventListener('keydown', key);
    let sx = null;
    cv.addEventListener('pointerdown', e => { sx = e.clientX; });
    cv.addEventListener('pointerup', e => { if (sx == null) return; const dx = e.clientX - sx; if (Math.abs(dx) > 25) move(dx > 0 ? 1 : -1); else { const r = cv.getBoundingClientRect(); move((e.clientX - r.left) / r.width < 0.5 ? -1 : 1); } sx = null; });

    const laneX = (ln, z) => { const spread = 70 + (1 - z) * 150; return W / 2 + (ln - 1) * spread; };
    const zy = z => 120 + (1 - z) * 250;
    function spawn() {
      const isRight = Math.random() < L.ratio;
      const pool = isRight ? right : wrong;
      items.push({ ln: Math.floor(Math.random() * 3), z: 1, txt: pool[Math.floor(Math.random() * pool.length)], ok: isRight, hit: false });
    }
    function frame(now) {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      if (!over) {
        t += dt; spawnT -= dt;
        if (spawnT <= 0) { spawn(); spawnT = L.gap * (0.7 + Math.random() * 0.6); }
        items.forEach(it => { it.z -= dt * L.speed; });
        items.forEach(it => {
          if (!it.hit && it.z < 0.08 && it.z > -0.05 && it.ln === lane) {
            it.hit = true;
            if (it.ok) { combo++; good++; score += 10 + Math.min(combo, 10) * 2; fx.push({ x: laneX(lane, 0), y: zy(0) - 40, s: '+' + (10 + Math.min(combo, 10) * 2), c: '#2e9e5b', a: 1 }); }
            else { lives--; combo = 0; fx.push({ x: laneX(lane, 0), y: zy(0) - 40, s: '✗', c: '#d9443a', a: 1 }); }
          }
        });
        items = items.filter(it => it.z > -0.1 && !(it.hit && it.z < 0.03));
        if (lives <= 0 || t >= L.time) end();
      }
      draw();
    }
    function draw() {
      const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#bfe3f2'); g.addColorStop(0.3, '#e9f6ec'); g.addColorStop(1, '#9fd08a');
      c.fillStyle = g; c.fillRect(0, 0, W, H);
      // 跑道
      c.fillStyle = '#d9774f';
      c.beginPath(); c.moveTo(W / 2 - 105, 120); c.lineTo(W / 2 + 105, 120); c.lineTo(W / 2 + 330, H); c.lineTo(W / 2 - 330, H); c.closePath(); c.fill();
      c.strokeStyle = 'rgba(255,255,255,.85)'; c.lineWidth = 3;
      [-0.5, 0.5].forEach(k => { c.beginPath(); c.moveTo(W / 2 + k * 70, 120); c.lineTo(W / 2 + k * 220, H); c.stroke(); });
      // 移動的橫線
      c.strokeStyle = 'rgba(255,255,255,.25)';
      for (let i = 0; i < 8; i++) { const z = ((i / 8) - (t * L.speed) % (1 / 8) + 1) % 1; const y = zy(z); c.beginPath(); c.moveTo(laneX(0, z) - 60, y); c.lineTo(laneX(2, z) + 60, y); c.stroke(); }
      // 物件（遠的先畫）
      items.slice().sort((a, b) => b.z - a.z).forEach(it => {
        if (it.hit) return;
        const s = 0.45 + (1 - it.z) * 0.75, x = laneX(it.ln, it.z), y = zy(it.z);
        c.fillStyle = 'rgba(0,0,0,.15)'; c.beginPath(); c.ellipse(x, y + 4, 34 * s, 9 * s, 0, 0, TAU); c.fill();
        c.fillStyle = '#ffffff'; c.strokeStyle = prim; c.lineWidth = 3 * s;
        const w = Math.max(56, c.measureText(it.txt).width + 30) * s, h = 42 * s;
        c.beginPath(); c.roundRect ? c.roundRect(x - w / 2, y - h - 8 * s, w, h, 10 * s) : c.rect(x - w / 2, y - h - 8 * s, w, h); c.fill(); c.stroke();
        c.fillStyle = '#1d2433'; c.font = `bold ${Math.round(22 * s)}px system-ui, sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle';
        c.fillText(it.txt, x, y - h / 2 - 8 * s);
      });
      // 玩家
      const px = laneX(lane, 0), py = zy(0);
      c.fillStyle = 'rgba(0,0,0,.2)'; c.beginPath(); c.ellipse(px, py + 4, 30, 9, 0, 0, TAU); c.fill();
      const bob = Math.abs(Math.sin(t * 12)) * 6;
      c.fillStyle = acc; c.beginPath(); c.arc(px, py - 34 - bob, 20, 0, TAU); c.fill();
      c.fillStyle = '#f2cfae'; c.beginPath(); c.arc(px, py - 64 - bob, 13, 0, TAU); c.fill();
      c.fillStyle = prim; c.fillRect(px - 14, py - 80 - bob, 28, 7);
      // 資訊
      c.textAlign = 'left'; c.textBaseline = 'top'; c.fillStyle = '#1d2433'; c.font = 'bold 18px system-ui, sans-serif';
      c.fillText(o.rule || '', 16, 12);
      c.font = '16px system-ui, sans-serif';
      c.fillText(`分數 ${score}　答對 ${good}/${L.need}　${'♥'.repeat(Math.max(0, lives))}${'♡'.repeat(3 - Math.max(0, lives))}`, 16, 38);
      c.textAlign = 'right'; c.fillText(`${L.name}　${Math.max(0, Math.ceil(L.time - t))} 秒`, W - 16, 12);
      fx.forEach(f => { c.globalAlpha = f.a; c.fillStyle = f.c; c.font = 'bold 26px system-ui'; c.textAlign = 'center'; c.fillText(f.s, f.x, f.y); f.y -= 1.2; f.a -= 0.02; });
      c.globalAlpha = 1; fx = fx.filter(f => f.a > 0);
      if (over) {
        c.fillStyle = 'rgba(20,28,40,.7)'; c.fillRect(0, 0, W, H);
        c.fillStyle = '#fff'; c.textAlign = 'center'; c.textBaseline = 'middle';
        c.font = 'bold 36px system-ui'; c.fillText(passed() ? '過關！' : '再試一次', W / 2, H / 2 - 30);
        c.font = '20px system-ui'; c.fillText(`分數 ${score}　答對 ${good} 個`, W / 2, H / 2 + 14);
      }
    }
    const passed = () => lives > 0 && good >= L.need;
    function end() { if (over) return; over = true; o.onEnd && o.onEnd({ score, good, passed: passed() }); }
    raf = requestAnimationFrame(frame);
    return function stop() { cancelAnimationFrame(raf); window.removeEventListener('keydown', key); };
  }

  /* =========================================================
     互動觀測台：四種現象模擬
     ========================================================= */
  const SIMS = {
    moon: {
      name: '月相變化', unit: v => '約第 ' + (v / 100 * 29.5).toFixed(1) + ' 天',
      layers: [['orbit', '軌道俯視'], ['view', '從地球看'], ['label', '月相名稱']],
      draw(c, W, H, v, L) {
        const a = v / 100 * TAU; // 0 = 新月（月在地日之間）
        const names = ['新月', '眉月', '上弦月', '盈凸月', '滿月', '虧凸月', '下弦月', '殘月'];
        const name = names[Math.round(v / 100 * 8) % 8];
        c.fillStyle = '#0f1a2c'; c.fillRect(0, 0, W, H);
        if (L.orbit) {
          const cx = W * 0.3, cy = H / 2, R = H * 0.33;
          for (let i = 0; i < 7; i++) { c.strokeStyle = 'rgba(255,214,102,.35)'; c.beginPath(); c.moveTo(0, cy - 90 + i * 30); c.lineTo(cx - R - 30, cy - 90 + i * 30); c.stroke(); }
          c.fillStyle = '#ffd666'; c.font = '13px system-ui'; c.fillText('太陽光 →', 8, 20);
          c.strokeStyle = 'rgba(255,255,255,.3)'; c.setLineDash([4, 6]); c.beginPath(); c.arc(cx, cy, R, 0, TAU); c.stroke(); c.setLineDash([]);
          c.fillStyle = '#3a7bd5'; c.beginPath(); c.arc(cx, cy, 18, 0, TAU); c.fill();
          c.fillStyle = '#fff'; c.fillText('地球', cx - 14, cy + 34);
          const mx = cx - Math.cos(a) * R, my = cy + Math.sin(a) * R;
          c.fillStyle = '#3b4254'; c.beginPath(); c.arc(mx, my, 12, 0, TAU); c.fill();
          c.fillStyle = '#f4f1de'; c.beginPath(); c.arc(mx, my, 12, Math.PI / 2, Math.PI * 1.5, false); c.closePath(); c.fill();
        }
        if (L.view) {
          const cx = L.orbit ? W * 0.75 : W / 2, cy = H / 2, r = H * 0.28;
          const k = Math.cos(a); // 1 = 新月, -1 = 滿月
          const waxing = v < 50;
          const lit = '#f4f1de', dark = '#3b4254';
          c.fillStyle = dark; c.beginPath(); c.arc(cx, cy, r, 0, TAU); c.fill();
          // 亮的半邊：漸盈時右半邊，漸虧時左半邊
          c.fillStyle = lit; c.beginPath();
          if (waxing) c.arc(cx, cy, r, -Math.PI / 2, Math.PI / 2, false); else c.arc(cx, cy, r, Math.PI / 2, Math.PI * 1.5, false);
          c.closePath(); c.fill();
          // 中間的橢圓：眉月時蓋掉一部分亮面，凸月時補上一部分暗面
          c.fillStyle = k > 0 ? dark : lit;
          c.beginPath(); c.ellipse(cx, cy, Math.abs(k) * r + 0.5, r + 0.5, 0, 0, TAU); c.fill();
          c.fillStyle = '#fff'; c.font = '13px system-ui'; c.fillText('從地球看到的樣子', cx - 52, cy + r + 24);
        }
        if (L.label) { c.fillStyle = '#ffd666'; c.font = 'bold 22px system-ui'; c.fillText(name, W - 120, 32); }
      }
    },
    season: {
      name: '四季與晝長', unit: v => { const d = Math.round(v / 100 * 365); const m = new Date(2026, 0, 1 + d); return (m.getMonth() + 1) + ' 月 ' + m.getDate() + ' 日'; },
      layers: [['orbit', '公轉位置'], ['sun', '正午太陽高度'], ['day', '晝長']],
      draw(c, W, H, v, L) {
        const d = v / 100 * 365;
        const decl = 23.44 * Math.sin(TAU * (d - 80) / 365); // 太陽直射緯度
        const lat = 23.5; // 臺灣
        const noon = 90 - Math.abs(lat - decl);
        const hr = 24 / Math.PI * Math.acos(clamp(-Math.tan(lat * Math.PI / 180) * Math.tan(decl * Math.PI / 180), -1, 1));
        c.fillStyle = '#f4f7fb'; c.fillRect(0, 0, W, H);
        c.fillStyle = '#1d2433'; c.font = '13px system-ui';
        if (L.orbit) {
          const cx = W * 0.27, cy = H * 0.5, R = H * 0.3;
          c.strokeStyle = '#b8c4d6'; c.beginPath(); c.ellipse(cx, cy, R * 1.2, R * 0.6, 0, 0, TAU); c.stroke();
          c.fillStyle = '#ffb703'; c.beginPath(); c.arc(cx, cy, 16, 0, TAU); c.fill();
          const ang = TAU * (d - 172) / 365 + Math.PI;
          const ex = cx + Math.cos(ang) * R * 1.2, ey = cy + Math.sin(ang) * R * 0.6;
          c.save(); c.translate(ex, ey); c.rotate(-23.44 * Math.PI / 180);
          c.fillStyle = '#3a7bd5'; c.beginPath(); c.arc(0, 0, 12, 0, TAU); c.fill();
          c.strokeStyle = '#1d2433'; c.beginPath(); c.moveTo(0, -20); c.lineTo(0, 20); c.stroke(); c.restore();
          c.fillStyle = '#1d2433'; ['夏至', '秋分', '冬至', '春分'].forEach((s, i) => { const aa = Math.PI + i * Math.PI / 2; c.fillText(s, cx + Math.cos(aa) * R * 1.45 - 12, cy + Math.sin(aa) * R * 0.85 + 4); });
          c.fillText('直射緯度 ' + decl.toFixed(1) + '°', cx - 50, H - 16);
        }
        if (L.sun) {
          const bx = W * 0.58, by = H * 0.8, R = H * 0.55;
          c.strokeStyle = '#8fa3bf'; c.beginPath(); c.moveTo(bx - 20, by); c.lineTo(bx + R + 20, by); c.stroke();
          const ar = noon * Math.PI / 180;
          c.strokeStyle = '#ffb703'; c.lineWidth = 3; c.beginPath(); c.moveTo(bx, by); c.lineTo(bx + Math.cos(ar) * R * 0.9, by - Math.sin(ar) * R * 0.9); c.stroke(); c.lineWidth = 1;
          c.fillStyle = '#ffb703'; c.beginPath(); c.arc(bx + Math.cos(ar) * R * 0.9, by - Math.sin(ar) * R * 0.9, 10, 0, TAU); c.fill();
          c.fillStyle = '#1d2433'; c.fillText('臺灣正午太陽高度 ' + noon.toFixed(0) + '°', bx, by + 20);
        }
        if (L.day) {
          const x = W * 0.58, y = 20, w = W * 0.38;
          c.fillStyle = '#1d2a44'; c.fillRect(x, y, w, 22);
          c.fillStyle = '#ffd166'; c.fillRect(x + w * (12 - hr / 2) / 24, y, w * hr / 24, 22);
          c.fillStyle = '#1d2433'; c.fillText('白天約 ' + hr.toFixed(1) + ' 小時', x, y + 40);
        }
      }
    },
    timezone: {
      name: '時區與晨昏線', unit: v => '世界標準時間 ' + String(Math.floor(v / 100 * 24)).padStart(2, '0') + ':' + String(Math.floor((v / 100 * 24 % 1) * 60)).padStart(2, '0'),
      layers: [['night', '晨昏線'], ['zones', '時區線'], ['clocks', '城市時鐘']],
      draw(c, W, H, v, L) {
        const utc = v / 100 * 24;
        const top = 30, mh = H - 110;
        c.fillStyle = '#9fd3e6'; c.fillRect(0, top, W, mh);
        // 簡化大陸
        c.fillStyle = '#9ccf7a';
        const blobs = [[-120, 45, 70, 40], [-95, 15, 25, 22], [-60, -15, 30, 35], [15, 50, 40, 22], [20, 5, 35, 45], [95, 45, 75, 35], [110, 15, 30, 15], [135, -25, 25, 15]];
        blobs.forEach(([lo, la, rw, rh]) => { c.beginPath(); c.ellipse((lo + 180) / 360 * W, top + (90 - la) / 180 * mh, rw / 360 * W, rh / 180 * mh, 0, 0, TAU); c.fill(); });
        if (L.night) { // 太陽直射經度 = (12 - utc) * 15
          const sunLon = (12 - utc) * 15;
          c.fillStyle = 'rgba(15,25,50,.55)';
          for (let i = 0; i < 360; i += 2) {
            const lon = i - 180; let dd = ((lon - sunLon + 540) % 360) - 180;
            if (Math.abs(dd) > 90) c.fillRect(i / 360 * W, top, W / 180 + 1, mh);
          }
          const sx = ((sunLon + 540) % 360) / 360 * W;
          c.fillStyle = '#ffd166'; c.beginPath(); c.arc(sx, top + mh / 2, 10, 0, TAU); c.fill();
        }
        if (L.zones) { c.strokeStyle = 'rgba(255,255,255,.5)'; for (let z = -12; z <= 12; z++) { const x = (z * 15 + 180) / 360 * W; c.beginPath(); c.moveTo(x, top); c.lineTo(x, top + mh); c.stroke(); } c.fillStyle = '#1d2433'; c.font = '10px system-ui'; for (let z = -12; z <= 12; z += 3) c.fillText((z >= 0 ? '+' : '') + z, (z * 15 + 180) / 360 * W - 6, top + mh + 12); }
        if (L.clocks) {
          const cities = [['洛杉磯', -8, -118], ['紐約', -5, -74], ['倫敦', 0, 0], ['開羅', 2, 31], ['臺北', 8, 121], ['東京', 9, 139], ['雪梨', 10, 151]];
          c.font = '12px system-ui';
          cities.forEach(([n, off, lon], i) => {
            const h = (utc + off + 24) % 24;
            const x = 10 + i * (W - 20) / cities.length, y = H - 46;
            c.fillStyle = h >= 6 && h < 18 ? '#ffd166' : '#2b3a5c'; c.beginPath(); c.arc(x + 14, y + 12, 12, 0, TAU); c.fill();
            c.fillStyle = '#1d2433'; c.fillText(n + ' ' + String(Math.floor(h)).padStart(2, '0') + ':' + String(Math.floor(h % 1 * 60)).padStart(2, '0'), x + 30, y + 16);
            c.fillStyle = '#d9443a'; c.beginPath(); c.arc((lon + 180) / 360 * W, top + (90 - [34, 41, 51, 30, 25, 36, -34][i]) / 180 * mh, 3, 0, TAU); c.fill();
          });
        }
      }
    },
    monsoon: {
      name: '季風', unit: v => (Math.floor(v / 100 * 11.99) + 1) + ' 月',
      layers: [['temp', '海陸溫度'], ['wind', '風向'], ['press', '氣壓']],
      draw(c, W, H, v, L) {
        const m = Math.floor(v / 100 * 11.99) + 1;
        const s = Math.sin((m - 4) / 12 * TAU); // 夏季 > 0
        c.fillStyle = '#7fc4e0'; c.fillRect(0, 0, W, H);
        const landHot = s > 0;
        c.fillStyle = L.temp ? (landHot ? `rgba(230,120,60,${0.5 + s * 0.4})` : `rgba(120,160,220,${0.5 - s * 0.4})`) : '#9ccf7a';
        c.beginPath(); c.moveTo(0, 0); c.lineTo(W * 0.75, 0); c.bezierCurveTo(W * 0.7, H * 0.3, W * 0.5, H * 0.45, W * 0.35, H * 0.5); c.bezierCurveTo(W * 0.25, H * 0.6, W * 0.1, H * 0.55, 0, H * 0.6); c.closePath(); c.fill();
        if (L.temp) { c.fillStyle = landHot ? `rgba(80,140,220,.35)` : `rgba(240,150,80,.35)`; c.fillRect(0, H * 0.62, W, H * 0.38); }
        c.fillStyle = '#1d2433'; c.font = 'bold 15px system-ui';
        c.fillText('大陸', W * 0.2, H * 0.25); c.fillText('海洋', W * 0.6, H * 0.8);
        if (L.press) { c.font = 'bold 26px system-ui'; c.fillStyle = '#1d2433'; c.fillText(landHot ? '低' : '高', W * 0.32, H * 0.3); c.fillText(landHot ? '高' : '低', W * 0.72, H * 0.72); }
        if (L.wind && Math.abs(s) > 0.25) {
          const dir = landHot ? -1 : 1; // 夏：海吹向陸（往左上）
          c.strokeStyle = '#ffffff'; c.fillStyle = '#ffffff'; c.lineWidth = 3;
          for (let i = 0; i < 6; i++) for (let j = 0; j < 3; j++) {
            const x = W * (0.25 + i * 0.12), y = H * (0.35 + j * 0.18), len = 34 * Math.abs(s);
            const dx = dir * len * 0.8, dy = dir * len * 0.6;
            c.beginPath(); c.moveTo(x - dx / 2, y - dy / 2); c.lineTo(x + dx / 2, y + dy / 2); c.stroke();
            const ang = Math.atan2(dy, dx); c.beginPath(); c.moveTo(x + dx / 2, y + dy / 2); c.lineTo(x + dx / 2 - Math.cos(ang - 0.5) * 9, y + dy / 2 - Math.sin(ang - 0.5) * 9); c.lineTo(x + dx / 2 - Math.cos(ang + 0.5) * 9, y + dy / 2 - Math.sin(ang + 0.5) * 9); c.fill();
          }
          c.lineWidth = 1;
          c.fillStyle = '#1d2433'; c.font = '14px system-ui'; c.fillText(landHot ? '西南季風：從海洋吹向大陸' : '東北季風：從大陸吹向海洋', 12, H - 14);
        } else if (L.wind) { c.fillStyle = '#1d2433'; c.font = '14px system-ui'; c.fillText('季風轉換期，風向不穩定', 12, H - 14); }
      }
    }
  };
  function sim(host, o) {
    const S = SIMS[o.kind] || SIMS.moon;
    host.innerHTML = '';
    const wrap = document.createElement('div'); wrap.className = 'sim-wrap';
    const cv = document.createElement('canvas');
    const ctl = document.createElement('div'); ctl.className = 'sim-ctl';
    ctl.innerHTML = `<div class="sim-row"><button type="button" class="btn small sim-play" aria-label="播放">▶ 播放</button><input type="range" min="0" max="100" step="0.5" value="${o.value || 0}" aria-label="${S.name}"><output></output></div><div class="sim-layers">${S.layers.map(([k, n]) => `<label class="chip"><input type="checkbox" data-k="${k}" checked> ${n}</label>`).join('')}</div>`;
    wrap.append(cv, ctl); host.appendChild(wrap);
    const W = 640, H = 340; const c = hidpi(cv, W, H);
    const range = ctl.querySelector('input[type=range]'), out = ctl.querySelector('output'), play = ctl.querySelector('.sim-play');
    const L = {}; S.layers.forEach(([k]) => (L[k] = true));
    let v = +range.value, playing = false, raf = 0, last = 0;
    function render() { out.textContent = S.unit(v); S.draw(c, W, H, v, L); }
    range.addEventListener('input', () => { v = +range.value; render(); o.onChange && o.onChange(v); });
    ctl.querySelectorAll('[data-k]').forEach(cb => cb.addEventListener('change', () => { L[cb.dataset.k] = cb.checked; render(); }));
    function tick(now) { if (!playing) return; const dt = last ? (now - last) / 1000 : 0; last = now; v = (v + dt * 6) % 100; range.value = v; render(); raf = requestAnimationFrame(tick); }
    play.addEventListener('click', () => { playing = !playing; play.textContent = playing ? '⏸ 暫停' : '▶ 播放'; last = 0; if (playing) raf = requestAnimationFrame(tick); });
    render();
    return { set(x) { v = +x; range.value = v; render(); }, stop() { playing = false; cancelAnimationFrame(raf); } };
  }

  /* =========================================================
     證書與分享卡
     ========================================================= */
  function wrapText(c, text, x, y, maxW, lh) {
    let line = '', yy = y;
    for (const ch of String(text)) { if (c.measureText(line + ch).width > maxW) { c.fillText(line, x, yy); line = ch; yy += lh; } else line += ch; }
    c.fillText(line, x, yy); return yy;
  }
  function certificate(o) {
    const cv = document.createElement('canvas'); cv.width = 1600; cv.height = 1130;
    const c = cv.getContext('2d');
    const prim = o.primary || '#1F4E79', acc = o.accent || '#E8684A';
    c.fillStyle = '#fffdf8'; c.fillRect(0, 0, 1600, 1130);
    c.strokeStyle = prim; c.lineWidth = 18; c.strokeRect(40, 40, 1520, 1050);
    c.strokeStyle = acc; c.lineWidth = 4; c.strokeRect(78, 78, 1444, 974);
    // 角落島嶼紋
    [[120, 120], [1480, 120], [120, 1010], [1480, 1010]].forEach(([x, y]) => { c.fillStyle = acc; c.beginPath(); c.arc(x, y, 22, 0, TAU); c.fill(); c.fillStyle = prim; c.beginPath(); c.arc(x, y, 10, 0, TAU); c.fill(); });
    c.textAlign = 'center'; c.fillStyle = prim;
    c.font = `bold 92px ${o.font || 'serif'}`; c.fillText(o.title || '完成證書', 800, 260);
    c.fillStyle = '#4a4a55'; c.font = '36px system-ui, sans-serif'; c.fillText('茲證明', 800, 380);
    c.fillStyle = '#1d2433'; c.font = `bold 84px ${o.font || 'serif'}`; c.fillText(o.name || '探索者', 800, 500);
    c.strokeStyle = acc; c.lineWidth = 3; c.beginPath(); c.moveTo(520, 530); c.lineTo(1080, 530); c.stroke();
    c.fillStyle = '#4a4a55'; c.font = '38px system-ui, sans-serif';
    wrapText(c, o.body || '', 800, 620, 1150, 56);
    c.font = '30px system-ui, sans-serif'; c.fillStyle = '#6b6b78';
    c.fillText(o.site || '', 800, 880);
    c.textAlign = 'left'; c.fillText(o.date || '', 200, 990);
    c.textAlign = 'right'; c.fillText(o.author || '', 1400, 990);
    // 印章
    c.save(); c.translate(1300, 760); c.rotate(-0.18); c.strokeStyle = '#c8323a'; c.lineWidth = 6; c.beginPath(); c.arc(0, 0, 90, 0, TAU); c.stroke(); c.fillStyle = '#c8323a'; c.textAlign = 'center'; c.font = 'bold 34px system-ui'; c.fillText(o.seal || '完成', 0, 12); c.restore();
    return cv;
  }
  function shareCard(o) {
    const cv = document.createElement('canvas'); cv.width = 1200; cv.height = 630;
    const c = cv.getContext('2d');
    return new Promise(res => {
      const finish = () => {
        const g = c.createLinearGradient(0, 330, 0, 630); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(10,16,28,.82)');
        c.fillStyle = g; c.fillRect(0, 300, 1200, 330);
        c.fillStyle = '#ffffff'; c.font = `bold 64px ${o.font || 'system-ui'}`; c.fillText(o.title || '', 56, 500);
        c.font = '30px system-ui, sans-serif'; c.fillText(o.subtitle || '', 56, 552);
        c.fillStyle = o.accent || '#E8684A'; c.fillRect(56, 576, 120, 8);
        if (o.badge) { c.font = 'bold 28px system-ui'; const w = c.measureText(o.badge).width + 40; c.fillStyle = o.accent || '#E8684A'; c.fillRect(1200 - w - 40, 40, w, 56); c.fillStyle = '#fff'; c.fillText(o.badge, 1200 - w - 20, 78); }
        res(cv);
      };
      c.fillStyle = o.bg || '#cfe6f2'; c.fillRect(0, 0, 1200, 630);
      if (o.image) { const img = new Image(); img.onload = () => { const s = Math.max(1200 / img.width, 630 / img.height); c.drawImage(img, (1200 - img.width * s) / 2, (630 - img.height * s) / 2, img.width * s, img.height * s); finish(); }; img.onerror = finish; img.src = o.image; }
      else finish();
    });
  }

  /* =========================================================
     背景音樂（WebAudio 即時生成，不需要音檔）
     ========================================================= */
  const Music = {
    ctx: null, on: false, timer: 0, master: null,
    start() {
      if (this.on) return;
      const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
      this.ctx = this.ctx || new AC();
      this.ctx.resume && this.ctx.resume();
      this.master = this.ctx.createGain(); this.master.gain.value = 0.0001; this.master.connect(this.ctx.destination);
      this.master.gain.exponentialRampToValueAtTime(0.18, this.ctx.currentTime + 1.5);
      this.on = true;
      const scale = [261.63, 293.66, 329.63, 392.0, 440.0, 523.25, 587.33, 659.25];
      const chords = [[0, 2, 4], [3, 5, 7], [1, 3, 5], [2, 4, 6]];
      let step = 0;
      const pad = (f, t, d) => { const o = this.ctx.createOscillator(), g = this.ctx.createGain(); o.type = 'sine'; o.frequency.value = f / 2; g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.12, t + 1); g.gain.exponentialRampToValueAtTime(0.0001, t + d); o.connect(g); g.connect(this.master); o.start(t); o.stop(t + d + 0.1); };
      const pluck = (f, t) => { const o = this.ctx.createOscillator(), g = this.ctx.createGain(); o.type = 'triangle'; o.frequency.value = f; g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.25, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.2); o.connect(g); g.connect(this.master); o.start(t); o.stop(t + 1.3); };
      const tick = () => {
        if (!this.on) return;
        const t = this.ctx.currentTime + 0.05;
        if (step % 8 === 0) chords[(step / 8) % chords.length].forEach(i => pad(scale[i], t, 4.2));
        if (Math.random() < 0.55) pluck(scale[Math.floor(Math.random() * scale.length)] * (Math.random() < 0.3 ? 2 : 1), t);
        step++;
        this.timer = setTimeout(tick, 500);
      };
      tick();
    },
    stop() {
      if (!this.on) return; this.on = false; clearTimeout(this.timer);
      const m = this.master, ctx = this.ctx;
      try { m.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.6); setTimeout(() => m.disconnect(), 800); } catch (e) { /* 略過 */ }
    }
  };

  ISLE.Games = { runner, sim, SIMS, LEVELS, certificate, shareCard, Music };
})();
