/* 群島製圖所：網站介面層（把 3D 世界、內容面板與所有功能組在一起）
   ISLE.Site.mount(host, cfg, { preview, fileBase }) → site */
(function () {
  const ISLE = window.ISLE, U = ISLE.U, D = ISLE.DATA, G = ISLE.Games;
  const esc = U.esc;
  const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const pad2 = n => String(n).padStart(2, '0');

  /* ---------- 把表單資料整理成網站要用的樣子 ---------- */
  function normalize(cfg) {
    const T = D.TYPES[cfg.type] || D.TYPES.course;
    const named = cfg.islands.filter(i => (i.name || '').trim());
    const list = (named.length ? named : cfg.islands).map((isl, k) => {
      const ex = isl.extra || {};
      return {
        idx: k + 1, raw: isl, name: isl.name || (T.isle + ' ' + (k + 1)), intro: isl.intro || '', category: isl.category || '', goal: isl.goal || '',
        points: U.splitList(isl.points), links: U.parseLinks(isl.links), quiz: U.parseQuiz(isl.quiz), files: isl.files || [], ex
      };
    });
    return { cfg, T, isles: list, center: { idx: 0, name: cfg.center.name || T.centerName, note: cfg.center.note || '', ex: cfg.center.extra || {} } };
  }

  function mount(host, cfg, opts) {
    opts = opts || {};
    const site = {};
    let C = normalize(cfg);
    let world = null, P = null, openIdx = null, support = false, liveData = {}, stopGame = null, simCtl = null;
    const lang = () => C.cfg.meta.lang || 'zh';
    const L = (zh, en) => (lang() === 'en' ? en : lang() === 'zh-en' ? zh + ' ' + en : zh);
    const has = f => (C.cfg.features || []).includes(f) || (C.cfg.life && D.LIFE_FEATURES.includes(f));
    const key = () => 'isle:' + U.slug(C.cfg.meta.slug || C.cfg.meta.name) + (opts.preview ? ':preview' : '');

    /* ---------- 進度存取 ---------- */
    function blankP() { return { visited: {}, quiz: {}, stamps: {}, exp: 0, cards: {}, keys: { date: '', used: 0, bonus: 0 }, keyBonusFrom: {}, ws: {}, runner: {}, works: {}, shells: 0, items: [], name: '', theme: '', motion: null, finalDone: false, talked: {} }; }
    function load() { try { P = Object.assign(blankP(), JSON.parse(localStorage.getItem(key()) || '{}')); } catch (e) { P = blankP(); } }
    function save() { try { localStorage.setItem(key(), JSON.stringify(P)); } catch (e) { /* 無痕模式等情況存不了，就只存在記憶體 */ } renderHud(); }
    load();

    /* ---------- 版面 ---------- */
    host.innerHTML = `
      <div class="site" lang="${lang() === 'en' ? 'en' : 'zh-Hant-TW'}">
        <div class="stage" aria-hidden="false"><div class="labels"></div><div class="nogl" hidden>${L('這台裝置不支援 3D 顯示，已改用文字清單。', 'This device cannot show 3D; showing the text list instead.')}</div></div>
        <header class="bar">
          <button type="button" class="brand" data-act="home" title="${L('回到全景', 'Overview')}"><span class="brand-mark" aria-hidden="true"></span><span class="brand-text"><b class="brand-name"></b><small class="brand-tag"></small></span></button>
          <div class="search" hidden><input type="search" placeholder="${L('搜尋島嶼或內容', 'Search')}" aria-label="${L('搜尋', 'Search')}"><div class="search-res" role="listbox" hidden></div></div>
          <button type="button" class="tool menu-btn" data-act="menu" aria-label="${L('選單', 'Menu')}" aria-expanded="false">☰</button>
          <nav class="tools" aria-label="${L('工具', 'Tools')}"></nav>
        </header>
        <div class="hud" aria-live="polite"></div>
        <nav class="dock" aria-label="${L('島嶼', 'Islands')}"></nav>
        <aside class="panel" hidden aria-modal="false" role="dialog"><button type="button" class="x" data-act="close" aria-label="${L('關閉', 'Close')}">✕</button><div class="panel-body"></div></aside>
        <div class="modal" hidden role="dialog" aria-modal="true"><div class="modal-card"><button type="button" class="x" data-act="mclose" aria-label="${L('關閉', 'Close')}">✕</button><div class="modal-body"></div></div></div>
        <div class="bubble" hidden></div>
        <div class="toasts" aria-live="polite"></div>
        <div class="talk" hidden><button type="button" class="btn" data-act="talk"></button></div>
      </div>`;
    const $ = s => host.querySelector(s);
    const elSite = $('.site'), stage = $('.stage'), labels = $('.labels'), panel = $('.panel'), pbody = $('.panel-body'), modal = $('.modal'), mbody = $('.modal-body');

    /* ---------- 主題、配色與字體 ---------- */
    function slotHex(k) { return C.cfg.theme[k] || '#ffffff'; }
    function applyTheme(slot) {
      const bg = slotHex(slot);
      const dark = U.lum(bg) < 0.45;
      const r = document.documentElement.style;
      r.setProperty('--bg', bg);
      r.setProperty('--ink', dark ? '#eef2f7' : '#1d2433');
      r.setProperty('--muted', dark ? '#a9b4c4' : '#5d6678');
      r.setProperty('--surface', dark ? 'rgba(24,32,48,.92)' : 'rgba(255,255,255,.94)');
      r.setProperty('--line', dark ? 'rgba(255,255,255,.14)' : 'rgba(20,30,50,.12)');
      r.setProperty('--primary', C.cfg.theme.primary);
      r.setProperty('--accent', C.cfg.theme.accent);
      r.setProperty('--head-font', (D.FONTS[C.cfg.font] || D.FONTS.sans).css);
      r.setProperty('--body-font', C.cfg.font === 'round' ? D.FONTS.round.css : D.FONTS.sans.css);
      elSite.dataset.slot = slot; elSite.classList.toggle('dark', dark);
      if (world) world.setFog(bg);
      host.querySelectorAll('[data-slot-btn]').forEach(b => b.setAttribute('aria-pressed', b.dataset.slotBtn === slot));
    }
    function slotForTod(h) { const st = ISLE.World.todState(h); return st.night > 0.55 ? 'night' : st.dusk > 0.45 ? 'dusk' : 'day'; }
    const TOD_FOR = { day: 10.5, dusk: 17.8, night: 21.5 };
    function chooseSlot(slot) { // 訪客手動選
      P.theme = slot; save();
      applyTheme(slot);
      if (world && (has('daynight'))) { world.setTod(TOD_FOR[slot], 'fixed'); }
    }

    /* ---------- 工具列 ---------- */
    function buildTools() {
      const t = [];
      t.push(`<button type="button" class="tool" data-act="home" title="${L('全景', 'Overview')}" aria-label="${L('回到全景', 'Overview')}">⌂</button>`);
      if (has('list')) t.push(tool('list', '☰', L('文字清單', 'Text list')));
      if (has('progress')) t.push(tool('progress', '✓', L('探索進度', 'Progress')));
      if (has('guide')) t.push(tool('guide', '💬', L('小嚮導', 'Guide')));
      if (has('codex') || C.cfg.type === 'treasure') t.push(tool('codex', '📖', L('收集圖鑑', 'Collection')));
      if (has('cert') || C.cfg.rpg) t.push(tool('cert', '🎓', L('證書', 'Certificate')));
      if (has('share')) t.push(tool('share', '🖼', L('分享卡片', 'Share card')));
      if (has('resume')) t.push(tool('resume', '🔑', L('接關碼', 'Resume code')));
      if (has('daynight')) t.push(`<span class="tgroup" role="group" aria-label="${L('晝夜', 'Time of day')}">${D.THEME_SLOTS.map(s => `<button type="button" class="tool" data-slot-btn="${s.k}" data-act="slot" title="${s.name}" aria-label="${s.name}">${s.icon}</button>`).join('')}</span>`);
      if (has('clock') || C.cfg.life) t.push(`<button type="button" class="tool clock" data-act="clock" title="${L('跟著時間變化', 'Live time')}" aria-label="${L('跟著時間變化', 'Live time')}">🕐 <span class="clock-t"></span></button>`);
      if (has('music')) t.push(tool('music', '♪', L('背景音樂', 'Music')));
      if (has('reduceMotion')) t.push(tool('motion', '◐', L('減少動態', 'Reduce motion')));
      $('.tools').innerHTML = t.join('');
      $('.search').hidden = !has('search');
    }
    function tool(act, icon, name) { return `<button type="button" class="tool" data-act="${act}" title="${esc(name)}" aria-label="${esc(name)}"><span aria-hidden="true">${icon}</span><span class="tool-name">${esc(name)}</span></button>`; }

    function buildBrand() {
      const m = C.cfg.meta;
      $('.brand-name').textContent = m.name || L('我的群島', 'My Islands');
      $('.brand-tag').textContent = m.tagline || '';
      $('.brand-mark').textContent = (m.mascot || m.name || '島').slice(0, 1);
      document.title = m.name ? m.name : '群島';
    }

    function buildDock() {
      const all = [{ idx: 0, name: C.center.name }].concat(C.isles);
      $('.dock').innerHTML = all.map(i => `<button type="button" class="dock-i" data-act="open" data-i="${i.idx}"><span class="num">${i.idx ? pad2(i.idx) : '★'}</span>${esc(i.name)}${P.visited[i.idx] ? '<span class="ok" aria-label="已看過">✓</span>' : ''}</button>`).join('');
      labels.innerHTML = all.map(i => `<button type="button" class="lbl${i.idx ? '' : ' center'}${P.visited[i.idx] ? ' seen' : ''}" data-act="open" data-i="${i.idx}" tabindex="-1"><span class="num">${i.idx ? pad2(i.idx) : '★'}</span>${esc(i.name)}</button>`).join('');
    }

    /* ---------- HUD ---------- */
    function renderHud() {
      const h = [];
      const total = C.isles.length + 1;
      if (has('progress')) { const n = Object.keys(P.visited).filter(k => P.visited[k]).length; h.push(`<span class="pill">🧭 ${n}/${total}</span>`); }
      if (C.cfg.rpg) { const lv = Math.floor(P.exp / 100) + 1, pct = P.exp % 100; h.push(`<span class="pill rpg">Lv.${lv} ${esc(P.name || L('冒險者', 'Adventurer'))}<i class="bar"><i style="width:${pct}%"></i></i></span>`); h.push(`<span class="pill">🏅 ${Object.keys(P.stamps).length}/${C.isles.length}</span>`); }
      else if (['quest', 'expo', 'local'].includes(C.cfg.type)) h.push(`<span class="pill">🏅 ${Object.keys(P.stamps).length}/${C.isles.length}</span>`);
      if (has('keys') || C.cfg.type === 'treasure') { refreshKeys(); h.push(`<span class="pill">🔑 ${keysLeft()}</span>`); h.push(`<span class="pill">📖 ${Object.keys(P.cards).length}/${allCards().length}</span>`); }
      if (has('residents')) h.push(`<button type="button" class="pill" data-act="bag">🐚 ${P.shells}${P.items.length ? ' · 🎒' + P.items.length : ''}</button>`);
      $('.hud').innerHTML = h.join('');
    }

    /* ---------- 3D 世界 ---------- */
    function startWorld() {
      if (world) { world.update(C.cfg, opts.keepCam); return; }
      world = ISLE.World.create(stage, C.cfg, {
        onPick: onPick,
        onFrame: placeLabels,
        onNear: i => { const tk = $('.talk'); if (i > 0 || (i === 0 && C.cfg.rpg)) { tk.hidden = false; tk.querySelector('button').textContent = '💬 ' + L('和', 'Talk to ') + npcName(i) + L('說話（E）', ' (E)'); tk.dataset.i = i; } else tk.hidden = true; },
        onArrive: i => { if (C.cfg.rpg) toast(L('抵達 ', 'Arrived: ') + nameOf(i)); }
      });
      if (!world) { $('.nogl').hidden = false; if (!opts.preview) setTimeout(() => openList(), 300); }
    }
    function placeLabels() {
      if (!world) return;
      const btns = labels.children;
      for (let k = 0; k < btns.length; k++) {
        const p = world.project(k);
        if (!p || !p.vis) { btns[k].style.display = 'none'; continue; }
        btns[k].style.display = ''; btns[k].style.transform = `translate(${p.x}px,${p.y}px) translate(-50%,-100%)`;
      }
      const ct = host.querySelector('.clock-t');
      if (ct) { const h = world.getTod(); ct.textContent = pad2(Math.floor(h)) + ':' + pad2(Math.floor(h % 1 * 60)); }
      if (C.cfg.theme.auto && !P.theme && has('daynight') !== undefined) {
        const s = slotForTod(world.getTod());
        if (s !== elSite.dataset.slot) applyTheme(s);
      }
    }

    function onPick(info) {
      switch (info.kind) {
        case 'isle': if (!C.cfg.rpg) openIsle(info.index); break;
        case 'chest': openIsle(info.index); setTimeout(() => openChest(info.index), 400); break;
        case 'monster': openIsle(info.index); setTimeout(() => battle(info.index), 400); break;
        case 'npc': talk(info.index); break;
        case 'work': openIsle(info.index); setTimeout(() => doWork(info.index, info.item), 300); break;
        case 'resident': showBubble(info.chat, info.isle); break;
        case 'shell': P.shells++; save(); toast('🐚 +1　' + L('撿到貝殼！', 'Found a shell!')); break;
        case 'animal': toast(info.name + ' ' + ['🙂', '✨', '💕', '🎵'][Math.floor(Math.random() * 4)]); break;
      }
    }

    /* ---------- 小工具 ---------- */
    function toast(msg, ms) {
      const d = document.createElement('div'); d.className = 'toast'; d.textContent = msg;
      $('.toasts').appendChild(d); setTimeout(() => d.classList.add('out'), ms || 2200); setTimeout(() => d.remove(), (ms || 2200) + 400);
    }
    function showBubble(text, isle) {
      const b = $('.bubble');
      b.innerHTML = `<p>${esc(text)}</p>${has('residents') ? `<button type="button" class="btn small" data-act="trade">${L('用貝殼交換', 'Trade shells')}</button>` : ''}`;
      b.hidden = false; clearTimeout(b._t); b._t = setTimeout(() => (b.hidden = true), 5000);
    }
    function nameOf(i) { return i === 0 ? C.center.name : (C.isles[i - 1] || {}).name || ''; }
    function isleOf(i) { return i === 0 ? null : C.isles[i - 1]; }
    function npcName(i) { const is = isleOf(i); return (is && is.ex.npc) || (i === 0 ? L('島主', 'Keeper') : L('島民', 'Islander')); }
    function fileUrl(f) { if (f.data) return f.data; return opts.fileBase != null ? opts.fileBase + f.path.split('/').map(encodeURIComponent).join('/') : null; }
    function openModal(html, cls) { mbody.innerHTML = html; modal.className = 'modal' + (cls ? ' ' + cls : ''); modal.hidden = false; const f = mbody.querySelector('input,button,textarea'); if (f) setTimeout(() => f.focus(), 50); }
    function closeModal() { modal.hidden = true; if (stopGame) { stopGame(); stopGame = null; } if (simCtl) { simCtl.stop(); simCtl = null; } }
    function download(name, url) { const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove(); }
    function copy(text) { (navigator.clipboard ? navigator.clipboard.writeText(text) : Promise.reject()).then(() => toast(L('已複製', 'Copied')), () => { const ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); toast(L('已複製', 'Copied')); } catch (e) { /* 忽略 */ } ta.remove(); }); }

    /* ---------- 開島 ---------- */
    function openIsle(i) {
      i = +i; openIdx = i;
      if (world) world.flyTo(i);
      if (!P.visited[i]) { P.visited[i] = true; if (['expo', 'local'].includes(C.cfg.type) && i > 0) { P.stamps[i] = true; toast('🏅 ' + L('蓋章：', 'Stamp: ') + nameOf(i)); } if (C.cfg.rpg) addExp(5); save(); buildDock(); }
      pbody.innerHTML = i === 0 ? centerHtml() : isleHtml(isleOf(i));
      panel.hidden = false; panel.scrollTop = 0; pbody.scrollTop = 0;
      elSite.classList.add('panel-open');
      if (world) world.setShift(host.clientWidth > 760 ? panel.offsetWidth + 12 : 0);
      afterRender(i);
      const sr = $('.search-res'); if (sr) sr.hidden = true;
    }
    function closePanel() { panel.hidden = true; openIdx = null; elSite.classList.remove('panel-open'); if (world) world.setShift(0); if (support) { support = false; world && world.setMood('normal'); } }

    function head(is, i) {
      return `<p class="eyebrow">${i ? pad2(i) + ' · ' + esc(C.T.isle) : '★ ' + esc(L('中央島', 'Central island'))}${is && is.category ? ` · <span class="tag">${esc(is.category)}</span>` : ''}</p><h2>${esc(i ? is.name : C.center.name)}</h2>`;
    }
    function pointsHtml(is) {
      let h = '';
      if (is.intro) h += `<p class="lead">${esc(is.intro)}</p>`;
      if (is.goal) h += `<p class="goal"><b>${L('目標', 'Goal')}</b>${esc(is.goal)}</p>`;
      if (is.points.length) h += `<h3>${L('重點', 'Key points')}</h3><ul class="points">${is.points.map(p => `<li>${esc(p)}</li>`).join('')}</ul>`;
      return h;
    }
    function linksFiles(is) {
      let h = '';
      if (is.links.length) h += `<h3>${L('相關連結', 'Links')}</h3><ul class="links">${is.links.map(l => `<li><a href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.name)} ↗</a></li>`).join('')}</ul>`;
      if (is.files.length) {
        const imgs = is.files.filter(f => /^image\//.test(f.type) && fileUrl(f));
        if (imgs.length) h += `<div class="gallery">${imgs.map(f => `<img src="${esc(fileUrl(f))}" alt="${esc(f.name)}" loading="lazy">`).join('')}</div>`;
        const docs = is.files.filter(f => !/^image\//.test(f.type) || !fileUrl(f));
        if (docs.length) h += `<h3>${L('參考資料', 'Materials')}</h3><ul class="files">${docs.map(f => C.cfg.allowDownload && fileUrl(f) ? `<li><a href="${esc(fileUrl(f))}" download>📄 ${esc(f.name)}</a></li>` : `<li>📄 ${esc(f.name)}</li>`).join('')}</ul>`;
      }
      return h;
    }
    function quizBtn(is) {
      if (!(has('quiz') || C.cfg.rpg || C.cfg.type === 'quest')) return '';
      const qs = quizFor(is.idx);
      if (!qs.length) return '';
      const best = P.quiz[is.idx];
      return `<div class="cta-row"><button type="button" class="btn" data-act="quiz" data-i="${is.idx}">${C.cfg.type === 'quest' ? '⚔️ ' + L('挑戰 ', 'Fight ') + esc(is.ex.monster || L('觀念怪獸', 'Monster')) : '✍️ ' + L('小測驗', 'Quiz')}（${qs.length}）</button>${best != null ? `<span class="muted">${L('最佳', 'Best')} ${Math.round(best * 100)}%</span>` : ''}</div>`;
    }

    function isleHtml(is) {
      const i = is.idx, ex = is.ex, t = C.cfg.type;
      let h = head(is, i);
      switch (t) {
        case 'course': {
          h += pointsHtml(is);
          const ws = U.lines(ex.worksheet);
          if (ws.length) h += `<h3>${L('學習單', 'Worksheet')}</h3><div class="ws">${ws.map((q, j) => `<label><span>${j + 1}. ${esc(q)}</span><textarea data-ws="${i}-${j}" rows="2">${esc(P.ws[i + '-' + j] || '')}</textarea></label>`).join('')}<button type="button" class="btn ghost small" data-act="printws" data-i="${i}">🖨 ${L('列印學習單', 'Print')}</button></div>`;
          h += quizBtn(is); break;
        }
        case 'life': {
          h = `<p class="eyebrow">${pad2(i)} · <span class="tag">${esc(ex.kind || '地點')}</span></p><h2>${esc(is.name)}</h2>` + pointsHtml(is);
          if (is.links[0] && ex.cta) h += `<div class="cta-row"><a class="btn" href="${esc(is.links[0].url)}" target="_blank" rel="noopener">${esc(ex.cta)} ↗</a></div>`;
          else if (ex.cta && C.cfg.meta.contact) h += `<div class="cta-row"><a class="btn" href="${/@/.test(C.cfg.meta.contact) ? 'mailto:' + esc(C.cfg.meta.contact) : esc(C.cfg.meta.contact)}">${esc(ex.cta)}</a></div>`;
          break;
        }
        case 'treasure': {
          h += pointsHtml(is);
          const cards = cardsOf(i);
          h += `<div class="chest-box"><div class="chest-art" aria-hidden="true">🧰</div><div><b>${L('寶箱', 'Chest')}</b><p class="muted">${L('今天還有', 'Keys left today: ')} ${keysLeft()} ${L('把鑰匙', '')}・${L('已收集', 'Collected')} ${cards.filter(c => P.cards[c.id]).length}/${cards.length}</p><button type="button" class="btn" data-act="chest" data-i="${i}">🔑 ${L('打開寶箱', 'Open chest')}</button></div></div>`;
          h += quizBtn(is) + (quizFor(i).length ? `<p class="muted small">${L('第一次答對 80% 以上，可以多拿 1 把鑰匙。', 'Score 80%+ to earn a bonus key.')}</p>` : '');
          break;
        }
        case 'local': {
          h += pointsHtml(is);
          const sp = U.rows(ex.spots, 2);
          if (sp.length) h += `<h3>${L('景點與美食', 'Spots')}</h3><div class="cards">${sp.map(r => `<div class="card"><b>${esc(r[0])}</b><p>${esc(r[1])}</p></div>`).join('')}</div>`;
          if (ex.story) h += `<h3>${L('在地故事', 'Local story')}</h3><blockquote>${esc(ex.story)}</blockquote>`;
          h += `<p class="stamp ${P.stamps[i] ? 'got' : ''}">🏅 ${P.stamps[i] ? L('已蓋探索護照章', 'Passport stamped') : ''}</p>`;
          h += quizBtn(is); break;
        }
        case 'expo': {
          h += pointsHtml(is);
          const sc = U.rows(ex.schedule, 2);
          if (sc.length) h += `<h3>${L('活動時程', 'Schedule')}</h3><table class="tbl"><tbody>${sc.map(r => `<tr><th>${esc(r[0])}</th><td>${esc(r[1])}</td></tr>`).join('')}</tbody></table>`;
          const bo = U.rows(ex.booths, 2);
          if (bo.length) h += `<h3>${L('作品與攤位', 'Booths')}</h3><div class="cards">${bo.map(r => `<div class="card"><b>${esc(r[0])}</b><p>${esc(r[1])}</p></div>`).join('')}</div>`;
          h += `<p class="stamp got">🏅 ${L('已集章', 'Stamped')}</p>`; break;
        }
        case 'science': {
          h += pointsHtml(is);
          if (ex.observe) h += `<div class="observe"><b>🔍 ${L('觀察重點', 'Observe')}</b><p>${esc(ex.observe)}</p></div>`;
          h += `<div class="cta-row"><button type="button" class="btn" data-act="sim" data-v="${esc(ex.simValue || 0)}" data-i="${i}">🔭 ${L('到觀測台看這一步', 'Open observatory')}</button></div>`;
          h += quizBtn(is); break;
        }
        case 'live': {
          h += pointsHtml(is) + `<div class="feed" data-feed="${i}">${feedHtml(i)}</div>`; break;
        }
        case 'runner': {
          h += pointsHtml(is);
          const rr = P.runner[i] || {};
          h += `<div class="observe"><b>🏁 ${esc(ex.rule || L('吃掉正確的，閃開錯誤的', 'Collect correct items'))}</b></div><div class="lv-row">${[1, 2, 3].map(lv => `<button type="button" class="btn ${rr['p' + lv] ? 'done' : ''}" data-act="run" data-i="${i}" data-lv="${lv}">${G.LEVELS[lv].name}${rr['b' + lv] ? `<small>${L('最佳', 'Best')} ${rr['b' + lv]}</small>` : ''}${rr['p' + lv] ? ' ✓' : ''}</button>`).join('')}</div>`;
          break;
        }
        case 'empathy': {
          if (ex.persona) h += `<p class="lead persona">「${esc(ex.persona)}」</p>`;
          h += pointsHtml(Object.assign({}, is, { intro: '' }));
          const day = U.rows(ex.day, 3);
          h += `<div class="sup-toggle"><label class="switch"><input type="checkbox" data-act="support" ${support ? 'checked' : ''}><span></span> ${L('支持模式', 'Support mode')}</label><p class="muted small">${L('打開後，看看環境和身邊的人可以怎麼幫忙。', 'See how the environment can help.')}</p></div>`;
          h += `<ol class="day">${day.map(r => `<li><time>${esc(r[0])}</time><p>${esc(r[1])}</p>${r[2] ? `<p class="sup">💡 ${esc(r[2])}</p>` : ''}</li>`).join('')}</ol>`;
          break;
        }
        case 'literature': {
          h += pointsHtml(is);
          const refs = refsOf(i);
          h += refs.length ? `<h3>${L('文獻', 'References')}（${refs.length}）</h3><div class="refs">${refs.map(r => refCard(r)).join('')}</div>` : `<p class="muted">${L('這個主題還沒有放文獻。', 'No references yet.')}</p>`;
          break;
        }
        case 'portfolio': {
          if (ex.period) h += `<p class="muted">📅 ${esc(ex.period)}</p>`;
          h += pointsHtml(is);
          const works = U.rows(ex.works, 2);
          if (works.length) h += `<h3>${L('我做了什麼', 'What I did')}</h3><div class="works">${works.map((w, j) => `<button type="button" class="work ${P.works[i + '-' + j] ? 'done' : ''}" data-act="work" data-i="${i}" data-j="${j}"><b>${esc(w[0])}</b><span>${U.splitList(w[1].replace(/、/g, '；')).map(s => `<em>${esc(s)}</em>`).join('')}</span></button>`).join('')}</div>`;
          if (ex.reflect) h += `<h3>${L('我的反思', 'Reflection')}</h3><blockquote>${esc(ex.reflect)}</blockquote>`;
          break;
        }
        case 'quest': {
          h += pointsHtml(is);
          const lines = U.lines(ex.story);
          h += `<div class="npc"><div class="npc-face" aria-hidden="true">🧙</div><div><b>${esc(ex.npc || L('島民', 'Islander'))}</b><p>${esc(lines[0] || is.intro || '')}</p>${lines.length > 1 ? `<button type="button" class="btn ghost small" data-act="talk" data-i="${i}">${L('繼續對話', 'Talk')} ▸</button>` : ''}</div></div>`;
          h += quizBtn(is) + `<p class="stamp ${P.stamps[i] ? 'got' : ''}">🏅 ${P.stamps[i] ? L('已取得印章', 'Stamp earned') : L('打倒怪獸可以拿到印章', 'Defeat the monster to earn a stamp')}</p>`;
          break;
        }
        default: h += pointsHtml(is) + quizBtn(is);
      }
      if (C.cfg.rpg && t !== 'quest') h += `<div class="cta-row"><button type="button" class="btn ghost" data-act="talk" data-i="${i}">💬 ${L('和', 'Talk to ')}${esc(npcName(i))}${L('說話', '')}</button>${P.stamps[i] ? '<span class="muted">🏅 ' + L('已取得島章', 'Stamped') + '</span>' : ''}</div>`;
      h += linksFiles(is);
      h += navHtml(i);
      return h;
    }
    function navHtml(i) {
      const prev = i > 0 ? i - 1 : null, next = i < C.isles.length ? i + 1 : null;
      return `<div class="pnav">${prev != null ? `<button type="button" class="btn ghost small" data-act="open" data-i="${prev}">← ${esc(nameOf(prev))}</button>` : '<span></span>'}${next != null ? `<button type="button" class="btn ghost small" data-act="open" data-i="${next}">${esc(nameOf(next))} →</button>` : ''}</div>`;
    }

    /* ---------- 中央島 ---------- */
    function centerHtml() {
      const t = C.cfg.type, m = C.cfg.meta;
      let h = head(null, 0);
      h += `<p class="lead">${esc(C.center.note || C.T.centerRole)}</p>`;
      const progressTable = (extra) => `<table class="tbl prog"><tbody>${C.isles.map(is => `<tr><th><button type="button" class="linkish" data-act="open" data-i="${is.idx}">${pad2(is.idx)} ${esc(is.name)}</button></th><td>${P.visited[is.idx] ? '✓' : '—'}</td>${extra ? `<td>${extra(is)}</td>` : ''}</tr>`).join('')}</tbody></table>`;
      switch (t) {
        case 'course': {
          h += `<h3>${L('學習進度', 'Progress')}</h3>` + progressTable(is => P.quiz[is.idx] != null ? Math.round(P.quiz[is.idx] * 100) + '%' : '');
          if (allQuiz().length) h += `<div class="cta-row"><button type="button" class="btn" data-act="quiz" data-i="0">✍️ ${L('跨課總複習', 'Review quiz')}</button>${P.quiz[0] != null ? `<span class="muted">${L('最佳', 'Best')} ${Math.round(P.quiz[0] * 100)}%</span>` : ''}</div>`;
          break;
        }
        case 'life': {
          if (m.author) h += `<p><b>${esc(m.author)}</b></p>`;
          if (m.contact) h += `<p>✉️ ${/^https?:/.test(m.contact) ? `<a href="${esc(m.contact)}" target="_blank" rel="noopener">${esc(m.contact)}</a>` : /@/.test(m.contact) ? `<a href="mailto:${esc(m.contact)}">${esc(m.contact)}</a>` : esc(m.contact)}</p>`;
          h += `<h3>${L('地點總覽', 'All places')}</h3><div class="cards">${C.isles.map(is => `<button type="button" class="card linkcard" data-act="open" data-i="${is.idx}"><span class="tag">${esc(is.ex.kind || '')}</span><b>${esc(is.name)}</b><p>${esc(is.intro)}</p></button>`).join('')}</div>`;
          break;
        }
        case 'treasure': {
          h += `<div class="chest-box"><div class="chest-art" aria-hidden="true">🔑</div><div><b>${L('今日鑰匙', 'Keys today')}：${keysLeft()}</b><p class="muted">${L('每天 3 把，午夜重置。', '3 keys per day.')}</p><button type="button" class="btn" data-act="codex">📖 ${L('打開圖鑑', 'Open collection')}</button></div></div>`;
          h += `<h3>${L('收集進度', 'Collection')}</h3>` + progressTable(is => { const cs = cardsOf(is.idx); return cs.filter(c => P.cards[c.id]).length + '/' + cs.length; });
          break;
        }
        case 'local': case 'expo': {
          if (t === 'expo') {
            const all = [];
            C.isles.forEach(is => U.rows(is.ex.schedule, 2).forEach(r => all.push([r[0], r[1], is.name])));
            all.sort((a, b) => a[0].localeCompare(b[0]));
            if (all.length) h += `<h3>${L('全場時程', 'Full schedule')}</h3><table class="tbl"><tbody>${all.map(r => `<tr><th>${esc(r[0])}</th><td>${esc(r[1])}<small class="muted"> · ${esc(r[2])}</small></td></tr>`).join('')}</tbody></table>`;
          }
          const n = Object.keys(P.stamps).length;
          h += `<h3>${t === 'local' ? L('探索護照', 'Passport') : L('集章卡', 'Stamp card')}（${n}/${C.isles.length}）</h3><div class="stamps">${C.isles.map(is => `<button type="button" class="st ${P.stamps[is.idx] ? 'got' : ''}" data-act="open" data-i="${is.idx}"><span>${P.stamps[is.idx] ? '🏅' : '○'}</span>${esc(is.name)}</button>`).join('')}</div>`;
          if (has('guide')) h += `<div class="cta-row"><button type="button" class="btn ghost" data-act="guide">💬 ${L('問小嚮導', 'Ask the guide')}</button></div>`;
          break;
        }
        case 'science': {
          h += `<div class="sim-host" data-sim></div><h3>${L('依序看懂每一步', 'Steps')}</h3><ol class="steps">${C.isles.map(is => `<li><button type="button" class="linkish" data-act="simstep" data-v="${esc(is.ex.simValue || 0)}">${esc(is.name)}</button><p class="muted small">${esc(is.ex.observe || is.intro)}</p></li>`).join('')}</ol>`;
          break;
        }
        case 'live': {
          h += `<h3>${L('各頻道最新', 'Latest')}</h3><div class="cards">${C.isles.map(is => { const it = (liveData[is.idx] || manualItems(is))[0]; return `<button type="button" class="card linkcard" data-act="open" data-i="${is.idx}"><span class="tag">${esc(is.name)}</span><b>${esc(it ? it.title : L('尚無動態', 'No updates'))}</b><p class="muted">${esc(it ? it.date : '')}</p></button>`; }).join('')}</div>`;
          break;
        }
        case 'runner': {
          h += `<h3>${L('各單元最佳成績', 'Best scores')}</h3><table class="tbl"><thead><tr><th></th>${[1, 2, 3].map(l => `<th>${G.LEVELS[l].name}</th>`).join('')}</tr></thead><tbody>${C.isles.map(is => { const r = P.runner[is.idx] || {}; return `<tr><th><button type="button" class="linkish" data-act="open" data-i="${is.idx}">${esc(is.name)}</button></th>${[1, 2, 3].map(l => `<td>${r['b' + l] || '—'}${r['p' + l] ? ' ✓' : ''}</td>`).join('')}</tr>`; }).join('')}</tbody></table>`;
          break;
        }
        case 'empathy': {
          h += `<h3>${L('45 分鐘帶領流程', '45-minute plan')}</h3><ol class="steps"><li><b>5 分</b>　${L('說明：這是部分經驗的模擬，不代表所有人。', 'Framing')}</li><li><b>15 分</b>　${L('分組各走一座島，記下最有感覺的時刻。', 'Explore')}</li><li><b>10 分</b>　${L('打開支持模式，比較前後差別。', 'Support mode')}</li><li><b>10 分</b>　${L('用下面的問題討論。', 'Discuss')}</li><li><b>5 分</b>　${L('每人寫下一件明天就能做的小事。', 'Commit')}</li></ol>`;
          const qs = U.lines(C.center.ex.questions);
          if (qs.length) h += `<h3>${L('討論問題', 'Questions')}</h3><ol>${qs.map(q => `<li>${esc(q)}</li>`).join('')}</ol>`;
          const sups = []; C.isles.forEach(is => U.rows(is.ex.day, 3).forEach(r => r[2] && sups.push([r[2], is.name])));
          if (sups.length) h += `<h3>${L('支持策略總整理', 'Support strategies')}</h3><ul class="points">${sups.map(s => `<li>${esc(s[0])}<small class="muted"> · ${esc(s[1])}</small></li>`).join('')}</ul>`;
          h += `<p class="note">⚠️ ${L('這些情境只是部分經驗的模擬，每個人的感受都不同，請尊重當事人的說法。', 'These are partial simulations; listen to real people.')}</p>`;
          break;
        }
        case 'literature': {
          const all = []; C.isles.forEach(is => refsOf(is.idx).forEach(r => all.push(Object.assign({ topic: is.name }, r))));
          h += `<div class="lit-tools"><input type="search" data-litq placeholder="${L('搜尋作者、年份、篇名', 'Search refs')}"><select data-litsort><option value="year">${L('依年份', 'By year')}</option><option value="author">${L('依作者', 'By author')}</option></select><button type="button" class="btn small" data-act="export" data-f="apa">APA</button><button type="button" class="btn small ghost" data-act="export" data-f="bib">BibTeX</button></div><div class="refs" data-litlist>${all.map(r => refCard(r, true)).join('')}</div>`;
          break;
        }
        case 'portfolio': {
          const skills = skillTotals();
          const max = Math.max(1, ...Object.values(skills).map(s => s.n));
          h += `<h3>${L('成長路線', 'Timeline')}</h3><ol class="tl">${C.isles.map(is => `<li><button type="button" class="linkish" data-act="open" data-i="${is.idx}"><b>${esc(is.ex.period || '')}</b> ${esc(is.name)}</button></li>`).join('')}</ol>`;
          h += `<h3>${L('能力累計', 'Skills')}</h3><div class="skills">${Object.keys(skills).sort((a, b) => skills[b].n - skills[a].n).map(k => `<div class="sk"><span>${esc(k)}</span><i style="width:${skills[k].n / max * 100}%"></i><b>${skills[k].got}/${skills[k].n}</b></div>`).join('') || `<p class="muted">${L('還沒有填能力。', 'No skills yet.')}</p>`}</div>`;
          const refl = C.isles.filter(is => is.ex.reflect);
          if (refl.length) h += `<h3>${L('我的反思', 'Reflections')}</h3>${refl.map(is => `<blockquote><b>${esc(is.name)}</b><br>${esc(is.ex.reflect)}</blockquote>`).join('')}`;
          break;
        }
        case 'quest': {
          const n = Object.keys(P.stamps).length;
          h += `<div class="stamps">${C.isles.map(is => `<button type="button" class="st ${P.stamps[is.idx] ? 'got' : ''}" data-act="open" data-i="${is.idx}"><span>${P.stamps[is.idx] ? '🏅' : '○'}</span>${esc(is.name)}</button>`).join('')}</div>`;
          h += n >= C.isles.length ? `<div class="cta-row"><button type="button" class="btn" data-act="final">⚔️ ${L('開始最終試煉', 'Final challenge')}</button>${P.finalDone ? '<span class="muted">✓ ' + L('已通過', 'Passed') + '</span>' : ''}</div>` : `<p class="muted">${L('再收集', 'Collect ')} ${C.isles.length - n} ${L('個印章，就能挑戰最終試煉。', ' more stamps to unlock.')}</p>`;
          break;
        }
      }
      if (C.cfg.rpg && t !== 'quest') {
        const n = Object.keys(P.stamps).length;
        h += `<h3>🗺️ ${L('冒險進度', 'Adventure')}</h3><p>${L('島章', 'Stamps')} ${n}/${C.isles.length}　·　Lv.${Math.floor(P.exp / 100) + 1}</p>`;
        h += n >= C.isles.length ? `<div class="cta-row"><button type="button" class="btn" data-act="final">⚔️ ${L('挑戰中央島', 'Final challenge')}</button></div>` : `<p class="muted">${L('走到每座島和島民說話、通過試煉，就能挑戰中央島。', 'Talk to every islander and pass their trials.')}</p>`;
      }
      if (C.isles.length) h += `<h3>${L('前往', 'Go to')}</h3><div class="chips">${C.isles.map(is => `<button type="button" class="chip" data-act="open" data-i="${is.idx}">${pad2(is.idx)} ${esc(is.name)}</button>`).join('')}</div>`;
      return h;
    }

    function afterRender(i) {
      if (i === 0 && C.cfg.type === 'science') {
        const hostEl = pbody.querySelector('[data-sim]');
        if (hostEl) { if (simCtl) simCtl.stop(); simCtl = G.sim(hostEl, { kind: U.optVal(C.center.ex.sim || 'moon'), value: 0 }); }
      }
      if (C.cfg.type === 'live' && i > 0) loadFeed(i);
    }

    /* ---------- 測驗 ---------- */
    function autoQuiz(is) {
      // 沒有題目時，從各島重點自動出「哪一項屬於這座島」
      const mine = is.points; if (!mine.length) return [];
      const others = []; C.isles.forEach(o => { if (o.idx !== is.idx) o.points.forEach(p => others.push(p)); });
      if (others.length < 2) return [];
      return shuffle(mine).slice(0, 3).map(p => ({ q: L(`下列哪一項是「${is.name}」的重點？`, `Which belongs to "${is.name}"?`), a: p, wrong: shuffle(others).slice(0, 3) }));
    }
    function quizFor(i) {
      if (i === 0) return shuffle(allQuiz()).slice(0, 8);
      const is = isleOf(i); if (!is) return [];
      return is.quiz.length ? is.quiz : autoQuiz(is);
    }
    function allQuiz() { const a = []; C.isles.forEach(is => (is.quiz.length ? is.quiz : autoQuiz(is)).forEach(q => a.push(q))); return a; }

    function runQuiz(qs, o) {
      o = o || {};
      let k = 0, right = 0, hearts = 3, hp = qs.length;
      const battle = !!o.battle;
      function show() {
        const q = qs[k];
        const opts2 = shuffle([q.a].concat(q.wrong.length ? q.wrong : ['以上皆非']).filter((v, idx, arr) => arr.indexOf(v) === idx));
        mbody.innerHTML = `<p class="eyebrow">${esc(o.title || L('小測驗', 'Quiz'))} · ${k + 1}/${qs.length}</p>
          ${battle ? `<div class="battle"><div class="mon" aria-hidden="true">👾</div><div><b>${esc(o.monster || '')}</b><i class="hp"><i style="width:${hp / qs.length * 100}%"></i></i><span>${'♥'.repeat(hearts)}${'♡'.repeat(3 - hearts)}</span></div></div>` : ''}
          <h3 class="q">${esc(q.q)}</h3><div class="opts">${opts2.map(op => `<button type="button" class="opt" data-op="${esc(op)}">${esc(op)}</button>`).join('')}</div><p class="fb" aria-live="assertive"></p>`;
        mbody.querySelectorAll('.opt').forEach(b => b.addEventListener('click', () => {
          const ok = b.dataset.op === q.a;
          mbody.querySelectorAll('.opt').forEach(x => { x.disabled = true; if (x.dataset.op === q.a) x.classList.add('right'); });
          if (ok) { right++; hp--; b.classList.add('right'); } else { b.classList.add('wrong'); hearts--; }
          if (battle) { const bar = mbody.querySelector('.hp i'); if (bar) bar.style.width = (hp / qs.length * 100) + '%'; const hs = mbody.querySelector('.battle span'); if (hs) hs.textContent = '♥'.repeat(Math.max(0, hearts)) + '♡'.repeat(3 - Math.max(0, hearts)); }
          mbody.querySelector('.fb').innerHTML = (ok ? '✓ ' + L('答對了！', 'Correct!') : '✗ ' + L('正確答案：', 'Answer: ') + esc(q.a)) + `<button type="button" class="btn small" data-next>${k + 1 < qs.length && !(battle && hearts <= 0) ? L('下一題', 'Next') : L('看結果', 'Result')}</button>`;
          mbody.querySelector('[data-next]').addEventListener('click', () => { k++; if (k < qs.length && !(battle && hearts <= 0)) show(); else done(); });
        }));
      }
      function done() {
        const ratio = right / qs.length;
        const win = battle ? hearts > 0 && right >= Math.ceil(qs.length * 0.6) : ratio >= 0.6;
        mbody.innerHTML = `<div class="result"><div class="big">${battle ? (win ? '🏆' : '💫') : ratio >= 0.8 ? '🌟' : ratio >= 0.6 ? '👍' : '💪'}</div><h3>${battle ? (win ? L('打倒了 ', 'Defeated ') + esc(o.monster || '') + '！' : L('怪獸逃走了，再試一次！', 'It got away — try again!')) : L('答對 ', 'Score: ') + right + ' / ' + qs.length}</h3><div class="cta-row center"><button type="button" class="btn" data-act="mclose">${L('完成', 'Done')}</button><button type="button" class="btn ghost" data-again>${L('再做一次', 'Retry')}</button></div></div>`;
        mbody.querySelector('[data-again]').addEventListener('click', () => { k = 0; right = 0; hearts = 3; hp = qs.length; qs = shuffle(qs); show(); });
        o.onDone && o.onDone(ratio, win);
      }
      openModal('', 'quiz');
      show();
    }
    function startQuiz(i) {
      const qs = quizFor(i); if (!qs.length) return;
      const is = isleOf(i);
      const battleMode = C.cfg.type === 'quest' && i > 0;
      runQuiz(i === 0 ? qs : shuffle(qs), {
        title: i === 0 ? L('總複習', 'Review') : nameOf(i), battle: battleMode, monster: is && is.ex.monster,
        onDone: (ratio, win) => {
          P.quiz[i] = Math.max(P.quiz[i] || 0, ratio);
          if (C.cfg.rpg) addExp(Math.round(ratio * 30));
          if ((battleMode && win) || (C.cfg.rpg && ratio >= 0.6 && i > 0)) { if (!P.stamps[i]) { P.stamps[i] = true; toast('🏅 ' + L('取得印章：', 'Stamp: ') + nameOf(i)); } }
          if ((has('keys') || C.cfg.type === 'treasure') && ratio >= 0.8 && !P.keyBonusFrom[i]) { P.keyBonusFrom[i] = true; refreshKeys(); P.keys.bonus++; toast('🔑 +1'); }
          save(); if (openIdx != null) openIsle(openIdx);
        }
      });
    }

    /* ---------- 寶箱與圖鑑 ---------- */
    function cardsOf(i) { const is = isleOf(i); if (!is) return []; const rows = U.rows(is.ex.cards, 2); return (rows.length ? rows : is.points.map(p => [p, ''])).map((r, j) => ({ id: i + '-' + j, name: r[0], desc: r[1], isle: is.name })); }
    function allCards() { let a = []; C.isles.forEach(is => (a = a.concat(cardsOf(is.idx)))); return a; }
    function refreshKeys() { const d = U.today(); if (P.keys.date !== d) P.keys = { date: d, used: 0, bonus: 0 }; }
    function keysLeft() { refreshKeys(); return Math.max(0, 3 + P.keys.bonus - P.keys.used); }
    function openChest(i) {
      const cs = cardsOf(i); if (!cs.length) { toast(L('這個寶箱是空的', 'Empty chest')); return; }
      if (keysLeft() <= 0) { openModal(`<div class="result"><div class="big">🔒</div><h3>${L('今天的鑰匙用完了', 'No keys left today')}</h3><p class="muted">${L('明天再來，或答對小測驗拿額外鑰匙。', 'Come back tomorrow or ace a quiz.')}</p></div>`); return; }
      P.keys.used++;
      const fresh = cs.filter(c => !P.cards[c.id]);
      const card = (fresh.length ? fresh : cs)[Math.floor(Math.random() * (fresh.length || cs.length))];
      const isNew = !P.cards[card.id];
      P.cards[card.id] = (P.cards[card.id] || 0) + 1; save();
      openModal(`<div class="draw"><div class="kcard flip"><span class="tag">${esc(card.isle)}</span><h3>${esc(card.name)}</h3><p>${esc(card.desc)}</p></div><p>${isNew ? '✨ ' + L('新卡片！', 'New card!') : L('重複卡片', 'Duplicate')}　🔑 ${keysLeft()}</p><div class="cta-row center"><button type="button" class="btn" data-act="codex">📖 ${L('看圖鑑', 'Collection')}</button></div></div>`);
      if (openIdx != null) pbody.innerHTML = openIdx === 0 ? centerHtml() : isleHtml(isleOf(openIdx));
    }
    function openCodex() {
      const cs = allCards();
      openModal(`<h2>📖 ${L('收集圖鑑', 'Collection')}</h2><p class="muted">${Object.keys(P.cards).length}/${cs.length}　🔑 ${keysLeft()}</p><div class="codex">${cs.map(c => P.cards[c.id] ? `<div class="kcard"><span class="tag">${esc(c.isle)}</span><h4>${esc(c.name)}</h4><p>${esc(c.desc)}</p>${P.cards[c.id] > 1 ? `<small>×${P.cards[c.id]}</small>` : ''}</div>` : `<div class="kcard locked"><span class="tag">${esc(c.isle)}</span><h4>？</h4></div>`).join('')}</div>`, 'wide');
    }

    /* ---------- 動態看板 ---------- */
    function manualItems(is) { return U.rows(is.ex.items, 3).map(r => ({ date: r[0], title: r[1], link: r[2] })); }
    function feedHtml(i) {
      const is = isleOf(i); const items = liveData[i] || manualItems(is);
      const src = U.optVal(is.ex.feedType || 'manual');
      return `${src !== 'manual' && is.ex.feedUrl ? `<p class="muted small">${liveData[i] ? '🟢 ' + L('已更新 ', 'Updated ') + (liveData[i].at || '') : '⏳ ' + L('讀取中…（若無法讀取會顯示備用內容）', 'Loading…')}</p>` : ''}<ul class="feed-list">${items.map(it => `<li><time>${esc(it.date)}</time>${it.link ? `<a href="${esc(it.link)}" target="_blank" rel="noopener">${esc(it.title)} ↗</a>` : `<span>${esc(it.title)}</span>`}</li>`).join('') || `<li class="muted">${L('目前沒有動態', 'No updates')}</li>`}</ul>`;
    }
    function parseCsv(text) {
      const rows = []; let row = [], cur = '', q = false;
      for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        if (q) { if (ch === '"' && text[i + 1] === '"') { cur += '"'; i++; } else if (ch === '"') q = false; else cur += ch; }
        else if (ch === '"') q = true; else if (ch === ',') { row.push(cur); cur = ''; } else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i++; row.push(cur); rows.push(row); row = []; cur = ''; } else cur += ch;
      }
      if (cur || row.length) { row.push(cur); rows.push(row); }
      return rows.filter(r => r.some(c => c.trim()));
    }
    function loadFeed(i) {
      const is = isleOf(i); const src = U.optVal(is.ex.feedType || 'manual');
      if (src === 'manual' || !is.ex.feedUrl || liveData[i] || opts.preview) return;
      fetch(is.ex.feedUrl).then(r => r.text()).then(txt => {
        let items = [];
        if (src === 'csv') { const rows = parseCsv(txt); items = rows.slice(1).map(r => ({ date: r[0] || '', title: r[1] || '', link: r[2] || '' })).filter(x => x.title).reverse(); }
        else {
          const doc = new DOMParser().parseFromString(txt, 'text/xml');
          items = [...doc.querySelectorAll('item, entry')].slice(0, 12).map(n => ({ title: (n.querySelector('title') || {}).textContent || '', link: (n.querySelector('link') && (n.querySelector('link').getAttribute('href') || n.querySelector('link').textContent)) || '', date: ((n.querySelector('pubDate, published, updated') || {}).textContent || '').slice(0, 16) }));
        }
        if (items.length) { items.at = new Date().toLocaleTimeString(); liveData[i] = items; world && world.setBillboard(i, is.name, items[0].title); }
      }).catch(() => { /* 本機開啟時常被瀏覽器擋，保留手動內容 */ }).finally(() => { const f = pbody.querySelector(`[data-feed="${i}"]`); if (f) { if (!liveData[i]) liveData[i] = manualItems(is); f.innerHTML = feedHtml(i); } });
    }

    /* ---------- 文獻 ---------- */
    function refsOf(i) { const is = isleOf(i); return U.rows(is && is.ex.refs, 6).filter(r => r[0] || r[2]).map(r => ({ author: r[0], year: r[1], title: r[2], source: r[3], note: r[4], link: r[5] })); }
    function apa(r) { return `${r.author} (${r.year || 'n.d.'}). ${r.title}. ${r.source ? r.source + '.' : ''}${r.link ? ' ' + r.link : ''}`.trim(); }
    function bib(r, k) { const id = (r.author.split(/[ ,]/)[0] || 'ref').replace(/[^A-Za-z]/g, '') + (r.year || '') + k; return `@article{${id},\n  author = {${r.author}},\n  year = {${r.year}},\n  title = {${r.title}},\n  journal = {${r.source}},\n  url = {${r.link}}\n}`; }
    function refCard(r, topic) { return `<article class="ref" data-search="${esc((r.author + ' ' + r.year + ' ' + r.title + ' ' + r.source).toLowerCase())}" data-year="${esc(r.year)}" data-author="${esc(r.author)}">${topic ? `<span class="tag">${esc(r.topic)}</span>` : ''}<h4>${esc(r.title)}</h4><p class="muted">${esc(r.author)}（${esc(r.year)}）${r.source ? '・' + esc(r.source) : ''}</p>${r.note ? `<p class="note2">📝 ${esc(r.note)}</p>` : ''}<div class="ref-act">${r.link ? `<a href="${esc(r.link)}" target="_blank" rel="noopener">${L('連結', 'Link')} ↗</a>` : ''}<button type="button" class="linkish" data-act="cite" data-cite="${esc(apa(r))}">${L('複製 APA', 'Copy APA')}</button></div></article>`; }

    /* ---------- 學習歷程 ---------- */
    function skillTotals() {
      const s = {};
      C.isles.forEach(is => U.rows(is.ex.works, 2).forEach((w, j) => U.splitList(String(w[1]).replace(/、/g, '；')).forEach(k => { s[k] = s[k] || { n: 0, got: 0 }; s[k].n++; if (P.works[is.idx + '-' + j]) s[k].got++; })));
      return s;
    }
    function doWork(i, j) {
      const is = isleOf(i); const w = U.rows(is.ex.works, 2)[j]; if (!w) return;
      const sk = U.splitList(String(w[1]).replace(/、/g, '；'));
      if (!P.works[i + '-' + j]) { P.works[i + '-' + j] = true; save(); sk.forEach((s, k) => setTimeout(() => toast('⬆ ' + s + ' +1'), k * 350)); }
      else toast(w[0] + ' ✓');
      if (openIdx === i) pbody.innerHTML = isleHtml(is);
    }

    /* ---------- RPG / 對話 ---------- */
    function addExp(n) { const before = Math.floor(P.exp / 100); P.exp += n; if (Math.floor(P.exp / 100) > before) toast('⭐ ' + L('升級！Lv.', 'Level up! Lv.') + (Math.floor(P.exp / 100) + 1), 2800); }
    function talk(i) {
      i = +i;
      const is = isleOf(i);
      let lines = [];
      if (is) { lines = U.lines(is.ex.story); if (!lines.length) lines = [is.intro].concat(is.points.slice(0, 3)).filter(Boolean); }
      else lines = [L('歡迎來到 ', 'Welcome to ') + (C.cfg.meta.name || ''), C.T.centerRole];
      if (C.cfg.rpg && !P.name) { askName(() => talk(i)); return; }
      let k = 0;
      const npc = npcName(i);
      function show() {
        mbody.innerHTML = `<div class="dialog"><div class="npc-face big" aria-hidden="true">${i === 0 ? '🧭' : '🧙'}</div><div><b>${esc(npc)}</b><p>${esc(lines[k] || '')}</p><div class="cta-row">${k + 1 < lines.length ? `<button type="button" class="btn small" data-n>${L('繼續', 'Next')} ▸</button>` : ''}${k + 1 >= lines.length && i > 0 && quizFor(i).length && (C.cfg.rpg || C.cfg.type === 'quest') ? `<button type="button" class="btn small" data-trial>⚔️ ${L('接受試煉', 'Take the trial')}</button>` : ''}${k + 1 >= lines.length && i > 0 && C.cfg.rpg && !quizFor(i).length && !P.stamps[i] ? `<button type="button" class="btn small" data-stamp>🏅 ${L('領取島章', 'Get stamp')}</button>` : ''}${k + 1 >= lines.length && i === 0 && C.cfg.rpg && Object.keys(P.stamps).length >= C.isles.length ? `<button type="button" class="btn small" data-final>⚔️ ${L('最終挑戰', 'Final')}</button>` : ''}</div></div></div>`;
        const n = mbody.querySelector('[data-n]'); if (n) n.addEventListener('click', () => { k++; show(); });
        const tr = mbody.querySelector('[data-trial]'); if (tr) tr.addEventListener('click', () => startQuiz(i));
        const st = mbody.querySelector('[data-stamp]'); if (st) st.addEventListener('click', () => { P.stamps[i] = true; addExp(20); save(); toast('🏅 ' + nameOf(i)); closeModal(); });
        const fi = mbody.querySelector('[data-final]'); if (fi) fi.addEventListener('click', finalChallenge);
      }
      if (C.cfg.rpg && !P.talked[i]) { P.talked[i] = true; addExp(10); save(); }
      openModal('', 'dialog-m'); show();
    }
    function askName(cb) {
      openModal(`<h2>🧭 ${L('建立冒險者', 'Create your adventurer')}</h2><p class="muted">${L('用方向鍵或 WASD 走動，點其他島會坐船過去。靠近島民按 E 說話。', 'Move with arrows/WASD, click islands to travel, press E to talk.')}</p><label class="field"><span>${L('你的名字', 'Your name')}</span><input data-name maxlength="16" value="${esc(P.name)}"></label><div class="cta-row"><button type="button" class="btn" data-ok>${L('出發！', 'Go!')}</button></div>`);
      mbody.querySelector('[data-ok]').addEventListener('click', () => { P.name = mbody.querySelector('[data-name]').value.trim() || L('冒險者', 'Adventurer'); save(); closeModal(); world && world.setFollow(true); cb && cb(); });
    }
    function finalChallenge() {
      const qs = shuffle(allQuiz()).slice(0, 10);
      const done = () => { P.finalDone = true; addExp(50); save(); openCert(); };
      if (!qs.length) { done(); return; }
      runQuiz(qs, { title: L('最終試煉', 'Final challenge'), battle: true, monster: L('最終魔王', 'Final boss'), onDone: (r, win) => { if (win) setTimeout(done, 600); } });
    }

    /* ---------- 生活感：交易 ---------- */
    const GOODS = [['🌺', '扶桑花', 3], ['🍦', '冰淇淋', 4], ['💌', '島嶼明信片', 5], ['🪁', '小風箏', 6], ['🏮', '小燈籠', 8], ['🧭', '金色羅盤', 12]];
    function openTrade() {
      openModal(`<h2>🛍️ ${L('居民交換所', 'Trade')}</h2><p class="muted">🐚 ${P.shells} ${L('個貝殼（在沙灘上可以撿）', 'shells (find them on beaches)')}</p><div class="goods">${GOODS.map(([e, n, c], k) => `<button type="button" class="good" data-g="${k}" ${P.shells < c ? 'disabled' : ''}><span class="e">${e}</span><b>${n}</b><small>🐚 ${c}</small></button>`).join('')}</div>${P.items.length ? `<h3>🎒 ${L('我的背包', 'Backpack')}</h3><p>${P.items.map(esc).join(' ')}</p>` : ''}`);
      mbody.querySelectorAll('[data-g]').forEach(b => b.addEventListener('click', () => { const g = GOODS[+b.dataset.g]; if (P.shells < g[2]) return; P.shells -= g[2]; P.items.push(g[0] + g[1]); save(); toast(L('換到了 ', 'Got ') + g[0] + g[1]); openTrade(); }));
    }

    /* ---------- 證書 ---------- */
    function certReady() {
      const t = C.cfg.type;
      if (C.cfg.rpg || t === 'quest') return P.finalDone;
      if (t === 'runner') return C.isles.every(is => (P.runner[is.idx] || {}).p1);
      if (t === 'portfolio') { const tot = skillTotals(); return Object.values(tot).every(s => s.got >= s.n); }
      const visitedAll = C.isles.every(is => P.visited[is.idx]);
      if (has('quiz')) return visitedAll && C.isles.every(is => !quizFor(is.idx).length || (P.quiz[is.idx] || 0) >= 0.6);
      return visitedAll;
    }
    function certHint() {
      const t = C.cfg.type;
      if (C.cfg.rpg || t === 'quest') return L('集滿所有印章並通過最終試煉，就能領證書。', 'Collect all stamps and pass the final challenge.');
      if (t === 'runner') return L('每個單元都通過初級，就能領證書。', 'Pass the beginner level in every unit.');
      if (t === 'portfolio') return L('把每座島的「我做了什麼」都點開，就能產生成長證書。', 'Open every item on each island.');
      return has('quiz') ? L('逛完每座島，並在每座島的小測驗答對 60% 以上。', 'Visit every island and score 60%+ on each quiz.') : L('逛完每一座島就能領證書。', 'Visit every island.');
    }
    function openCert() {
      if (!certReady()) {
        openModal(`<div class="result"><div class="big">🎓</div><h3>${L('還差一點', 'Almost there')}</h3><p>${certHint()}</p>${has('progress') ? `<button type="button" class="btn ghost" data-act="progress">${L('看進度', 'See progress')}</button>` : ''}</div>`);
        return;
      }
      const t = C.cfg.type;
      const title = C.cfg.rpg || t === 'quest' ? L('冒險證書', 'Certificate of Adventure') : t === 'portfolio' ? L('成長證書', 'Growth Certificate') : L('完成證書', 'Certificate of Completion');
      openModal(`<h2>🎓 ${title}</h2><label class="field"><span>${L('證書上的名字', 'Name on certificate')}</span><input data-cn maxlength="20" value="${esc(P.name)}"></label><div class="cert-prev"></div><div class="cta-row"><button type="button" class="btn" data-dl>⬇ ${L('下載圖片', 'Download')}</button><button type="button" class="btn ghost" data-pr>🖨 ${L('列印', 'Print')}</button></div>`, 'wide');
      const draw = () => {
        const nm = mbody.querySelector('[data-cn]').value.trim() || L('探索者', 'Explorer');
        const cv = G.certificate({ title, name: nm, site: C.cfg.meta.name, author: C.cfg.meta.author, date: U.today(), primary: C.cfg.theme.primary, accent: C.cfg.theme.accent, font: (D.FONTS[C.cfg.font] || D.FONTS.sans).css, seal: C.cfg.meta.mascot || L('完成', 'Done'), body: L(`完成「${C.cfg.meta.name || '群島'}」全部 ${C.isles.length} 座島的探索${C.cfg.rpg ? '，並通過最終試煉' : ''}。`, `Completed all ${C.isles.length} islands of ${C.cfg.meta.name}.`) });
        const box = mbody.querySelector('.cert-prev'); box.innerHTML = ''; cv.style.width = '100%'; box.appendChild(cv); return cv;
      };
      let cv = draw();
      mbody.querySelector('[data-cn]').addEventListener('input', () => { P.name = mbody.querySelector('[data-cn]').value.trim(); save(); cv = draw(); });
      mbody.querySelector('[data-dl]').addEventListener('click', () => download(title + '.png', cv.toDataURL('image/png')));
      mbody.querySelector('[data-pr]').addEventListener('click', () => { const w = window.open(''); if (!w) return; w.document.write(`<title>${esc(title)}</title><style>@page{size:landscape;margin:0}body{margin:0}img{width:100%}</style><img src="${cv.toDataURL('image/png')}" onload="print()">`); w.document.close(); });
    }

    /* ---------- 文字清單、進度、搜尋、小嚮導 ---------- */
    function openList() {
      const sec = is => `<section><h3>${pad2(is.idx)} ${esc(is.name)}</h3>${is.intro ? `<p>${esc(is.intro)}</p>` : ''}${is.goal ? `<p><b>${L('目標', 'Goal')}：</b>${esc(is.goal)}</p>` : ''}${is.points.length ? `<ul>${is.points.map(p => `<li>${esc(p)}</li>`).join('')}</ul>` : ''}${extraText(is).map(t => `<p>${esc(t)}</p>`).join('')}${is.links.length ? `<p>${is.links.map(l => `<a href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.name)}</a>`).join('・')}</p>` : ''}<button type="button" class="linkish" data-act="open" data-i="${is.idx}">${L('在地圖上看', 'Show on map')} →</button></section>`;
      openModal(`<h2>☰ ${L('文字清單', 'Text list')}</h2><p class="muted">${esc(C.cfg.meta.tagline || '')}</p><section><h3>★ ${esc(C.center.name)}</h3><p>${esc(C.center.note || C.T.centerRole)}</p></section>${C.isles.map(sec).join('')}`, 'wide list-m');
    }
    function extraText(is) {
      const ex = is.ex, out = [];
      (C.T.fields || []).forEach(f => {
        const v = ex[f.k]; if (!v) return;
        if (f.kind === 'lines') U.rows(v).forEach(r => out.push(f.label + '：' + r.filter(Boolean).join('｜')));
        else if (f.kind === 'select') out.push(f.label + '：' + U.optLabel((f.options.find(o => U.optVal(o) === v) || v)));
        else out.push(f.label + '：' + v);
      });
      return out;
    }
    function openProgress() {
      const n = C.isles.filter(is => P.visited[is.idx]).length;
      openModal(`<h2>✓ ${L('探索進度', 'Progress')}</h2><div class="ring" style="--p:${n / C.isles.length * 100}"><b>${n}/${C.isles.length}</b></div><table class="tbl prog"><tbody>${C.isles.map(is => `<tr><th><button type="button" class="linkish" data-act="open" data-i="${is.idx}">${pad2(is.idx)} ${esc(is.name)}</button></th><td>${P.visited[is.idx] ? '✓ ' + L('看過', 'Visited') : '—'}</td><td>${P.quiz[is.idx] != null ? Math.round(P.quiz[is.idx] * 100) + '%' : ''}</td><td>${P.stamps[is.idx] ? '🏅' : ''}</td></tr>`).join('')}</tbody></table><p class="muted small">${certHint()}</p><div class="cta-row"><button type="button" class="btn ghost small" data-reset>${L('清除我的進度', 'Reset progress')}</button></div>`);
      mbody.querySelector('[data-reset]').addEventListener('click', () => { if (confirm(L('確定要清除這台電腦上的進度嗎？', 'Reset all progress?'))) { P = blankP(); save(); buildDock(); closeModal(); } });
    }
    let IDX = null;
    function buildIndex() {
      IDX = [];
      const add = (i, text) => { if (text && String(text).trim()) IDX.push({ i, text: String(text).trim(), low: String(text).toLowerCase() }); };
      add(0, C.center.note); add(0, C.T.centerRole);
      C.isles.forEach(is => { add(is.idx, is.name + '：' + is.intro); add(is.idx, is.goal); is.points.forEach(p => add(is.idx, p)); extraText(is).forEach(t => add(is.idx, t)); is.quiz.forEach(q => add(is.idx, q.q + ' ' + q.a)); });
    }
    function grams(s) { s = s.toLowerCase().replace(/[\s，。、？！?!.,：:；;「」（）()]/g, ''); const g = new Set(); const words = s.match(/[a-z0-9]+/g) || []; words.forEach(w => g.add(w)); const cjk = s.replace(/[a-z0-9]+/g, ''); for (let i = 0; i < cjk.length - 1; i++) g.add(cjk.slice(i, i + 2)); if (cjk.length === 1) g.add(cjk); return g; }
    function ask(q) {
      if (!IDX) buildIndex();
      const qg = grams(q); if (!qg.size) return [];
      const df = {}; IDX.forEach(p => { p.g = p.g || grams(p.text); qg.forEach(x => { if (p.g.has(x)) df[x] = (df[x] || 0) + 1; }); });
      return IDX.map(p => { let s = 0; qg.forEach(x => { if (p.g.has(x)) s += 1 / Math.log(2 + df[x]); }); return { p, s }; }).filter(x => x.s > 0.3).sort((a, b) => b.s - a.s).slice(0, 3);
    }
    function openGuide() {
      const who = C.cfg.meta.mascot || L('小嚮導', 'Guide');
      openModal(`<h2>💬 ${esc(who)}</h2><p class="muted">${L('問我網站裡的內容，我會告訴你在哪座島。', 'Ask about anything on this site.')}</p><form class="guide-f"><input data-gq placeholder="${L('例如：滿月在什麼時候？', 'e.g. When is the full moon?')}" aria-label="${L('問題', 'Question')}"><button class="btn" type="submit">${L('問', 'Ask')}</button></form><div class="guide-a" aria-live="polite"></div>`);
      mbody.querySelector('.guide-f').addEventListener('submit', e => {
        e.preventDefault();
        const q = mbody.querySelector('[data-gq]').value.trim(); if (!q) return;
        const res = ask(q), box = mbody.querySelector('.guide-a');
        box.innerHTML = res.length ? `<p>${esc(who)}：${L('我在這些地方找到相關內容——', 'Here is what I found:')}</p>${res.map(r => `<div class="ans"><p>${esc(r.p.text)}</p><small>${L('出處：', 'Source: ')}<button type="button" class="linkish" data-act="open" data-i="${r.p.i}">${esc(nameOf(r.p.i))}</button></small></div>`).join('')}` : `<p>${esc(who)}：${L('網站裡沒有找到相關內容，換個說法試試看？', 'Nothing found — try other words.')}</p>`;
      });
    }
    function doSearch(q) {
      const box = $('.search-res');
      q = q.trim().toLowerCase();
      if (!q) { box.hidden = true; return; }
      if (!IDX) buildIndex();
      const seen = new Set(), res = [];
      IDX.forEach(p => { if (p.low.includes(q) && !seen.has(p.i + p.text)) { seen.add(p.i + p.text); res.push(p); } });
      C.isles.forEach(is => { if (is.name.toLowerCase().includes(q) && !res.some(r => r.i === is.idx)) res.unshift({ i: is.idx, text: is.name }); });
      box.innerHTML = res.slice(0, 8).map(r => `<button type="button" role="option" data-act="open" data-i="${r.i}"><b>${esc(nameOf(r.i))}</b><span>${esc(r.text.slice(0, 40))}</span></button>`).join('') || `<p class="muted">${L('找不到', 'No results')}</p>`;
      box.hidden = false;
    }

    /* ---------- 分享卡、接關碼 ---------- */
    function openShare() {
      const n = C.isles.filter(is => P.visited[is.idx]).length;
      G.shareCard({ image: world ? world.screenshot() : null, title: C.cfg.meta.name || '', subtitle: C.cfg.meta.tagline || '', badge: L(`已探索 ${n}/${C.isles.length} 座島`, `Explored ${n}/${C.isles.length}`), accent: C.cfg.theme.accent, bg: C.cfg.theme.day, font: (D.FONTS[C.cfg.font] || D.FONTS.sans).css }).then(cv => {
        openModal(`<h2>🖼 ${L('分享卡片', 'Share card')}</h2><img class="share-img" alt="" src="${cv.toDataURL('image/png')}"><div class="cta-row"><button type="button" class="btn" data-dl>⬇ ${L('下載圖片', 'Download')}</button><button type="button" class="btn ghost" data-cp>🔗 ${L('複製網址', 'Copy link')}</button></div>`, 'wide');
        mbody.querySelector('[data-dl]').addEventListener('click', () => download((C.cfg.meta.slug || 'islands') + '.png', cv.toDataURL('image/png')));
        mbody.querySelector('[data-cp]').addEventListener('click', () => copy(location.href));
      });
    }
    function encodeP() { const json = JSON.stringify(P); return 'ISLE-' + btoa(unescape(encodeURIComponent(json))).replace(/=+$/, ''); }
    function openResume() {
      openModal(`<h2>🔑 ${L('接關碼', 'Resume code')}</h2><p class="muted">${L('換電腦或手機時，把這串代碼貼到另一台裝置的同一個網站。', 'Paste this code on another device to continue.')}</p><textarea class="code" readonly rows="4">${encodeP()}</textarea><div class="cta-row"><button type="button" class="btn small" data-cp>${L('複製', 'Copy')}</button></div><h3>${L('輸入接關碼', 'Enter a code')}</h3><textarea class="code" data-in rows="3" placeholder="ISLE-…"></textarea><div class="cta-row"><button type="button" class="btn" data-load>${L('接著玩', 'Continue')}</button></div>`);
      mbody.querySelector('[data-cp]').addEventListener('click', () => copy(encodeP()));
      mbody.querySelector('[data-load]').addEventListener('click', () => {
        try { const s = mbody.querySelector('[data-in]').value.trim().replace(/^ISLE-/, ''); const obj = JSON.parse(decodeURIComponent(escape(atob(s)))); P = Object.assign(blankP(), obj); save(); buildDock(); closeModal(); toast(L('已載入進度', 'Progress loaded')); }
        catch (e) { toast(L('代碼看起來不對，再檢查一次', 'That code is not valid')); }
      });
    }

    /* ---------- 觀測台、跑酷 ---------- */
    function openSim(v, i) {
      const is = isleOf(i);
      openModal(`<h2>🔭 ${esc(C.center.name)}</h2>${is ? `<p class="observe"><b>${esc(is.name)}</b> ${esc(is.ex.observe || '')}</p>` : ''}<div data-simm></div>`, 'wide');
      simCtl = G.sim(mbody.querySelector('[data-simm]'), { kind: U.optVal(C.center.ex.sim || 'moon'), value: +v || 0 });
    }
    function openRun(i, lv) {
      const is = isleOf(i);
      openModal(`<h2>🏃 ${esc(is.name)}</h2><div data-run></div>`, 'wide');
      stopGame = G.runner(mbody.querySelector('[data-run]'), {
        level: lv, rule: is.ex.rule, right: U.splitList(is.ex.right), wrong: U.splitList(is.ex.wrong),
        onEnd: r => {
          const rr = P.runner[i] = P.runner[i] || {};
          rr['b' + lv] = Math.max(rr['b' + lv] || 0, r.score); if (r.passed) rr['p' + lv] = true;
          if (C.cfg.rpg) addExp(Math.round(r.score / 10));
          save();
          const box = document.createElement('div'); box.className = 'cta-row center';
          box.innerHTML = `<button type="button" class="btn" data-again>${L('再跑一次', 'Again')}</button>${lv < 3 && r.passed ? `<button type="button" class="btn ghost" data-up>${G.LEVELS[lv + 1].name} →</button>` : ''}`;
          mbody.appendChild(box);
          box.querySelector('[data-again]').addEventListener('click', () => openRun(i, lv));
          const up = box.querySelector('[data-up]'); if (up) up.addEventListener('click', () => openRun(i, lv + 1));
          if (openIdx === i) pbody.innerHTML = isleHtml(is);
        }
      });
    }

    /* ---------- 事件委派 ---------- */
    const ACT = {
      home: () => { closePanel(); world && world.home(); },
      open: b => { closeModal(); openIsle(+b.dataset.i); },
      close: closePanel,
      mclose: closeModal,
      menu: b => { const open = elSite.classList.toggle('menu-open'); b.setAttribute('aria-expanded', open); },
      list: openList, progress: openProgress, guide: openGuide, codex: openCodex, cert: openCert, share: openShare, resume: openResume,
      slot: b => chooseSlot(b.dataset.slotBtn),
      clock: () => { P.theme = ''; save(); if (world) { world.setTodMode(C.cfg.life ? 'cycle' : 'real'); toast(C.cfg.life ? L('天色會自動變化', 'Day–night cycle on') : L('跟著現在時間', 'Following real time')); } },
      music: b => { if (G.Music.on) { G.Music.stop(); b.classList.remove('on'); } else { G.Music.start(); b.classList.add('on'); } },
      motion: b => { P.motion = !(P.motion === true); save(); setMotion(); },
      quiz: b => startQuiz(+b.dataset.i),
      chest: b => openChest(+b.dataset.i),
      sim: b => openSim(b.dataset.v, +b.dataset.i),
      simstep: b => simCtl && simCtl.set(b.dataset.v),
      run: b => openRun(+b.dataset.i, +b.dataset.lv),
      work: b => doWork(+b.dataset.i, +b.dataset.j),
      talk: b => talk(b.dataset.i != null ? +b.dataset.i : +($('.talk').dataset.i || 0)),
      final: finalChallenge,
      trade: openTrade, bag: openTrade,
      cite: b => copy(b.dataset.cite),
      printws: b => { const i = +b.dataset.i; const is = isleOf(i); const ws = U.lines(is.ex.worksheet); const w = window.open(''); if (!w) return; w.document.write(`<title>${esc(is.name)}</title><style>body{font-family:sans-serif;padding:32px;line-height:1.7}h1{font-size:22px}.q{margin:18px 0}.a{border:1px solid #999;min-height:80px;padding:8px;white-space:pre-wrap}</style><h1>${esc(C.cfg.meta.name)}｜${esc(is.name)} 學習單</h1><p>姓名：＿＿＿＿＿＿＿　日期：＿＿＿＿＿＿</p>${ws.map((q, j) => `<div class="q"><b>${j + 1}. ${esc(q)}</b><div class="a">${esc(P.ws[i + '-' + j] || '')}</div></div>`).join('')}<script>print()<\/script>`); w.document.close(); },
      export: b => { const all = []; C.isles.forEach(is => refsOf(is.idx).forEach(r => all.push(r))); const txt = b.dataset.f === 'bib' ? all.map(bib).join('\n\n') : all.map(apa).sort().join('\n'); download((C.cfg.meta.slug || 'refs') + (b.dataset.f === 'bib' ? '.bib' : '-apa.txt'), 'data:text/plain;charset=utf-8,' + encodeURIComponent(txt)); }
    };
    host.addEventListener('click', e => {
      const b = e.target.closest('[data-act]'); if (!b || !host.contains(b)) return;
      if (b.tagName === 'INPUT') return;
      const f = ACT[b.dataset.act]; if (f) { e.preventDefault(); f(b); }
      if (b.closest('.tools') && b.dataset.act !== 'menu') elSite.classList.remove('menu-open');
    });
    host.addEventListener('change', e => {
      const t = e.target;
      if (t.dataset.act === 'support') { support = t.checked; world && world.setMood(support ? 'support' : 'challenge'); pbody.classList.toggle('support-on', support); toast(support ? L('支持模式：開', 'Support mode on') : L('支持模式：關', 'Support mode off')); }
    });
    host.addEventListener('input', e => {
      const t = e.target;
      if (t.dataset.ws) { P.ws[t.dataset.ws] = t.value; save(); }
      if (t.matches('.search input')) doSearch(t.value);
      if (t.dataset.litq != null) { const q = t.value.toLowerCase(); pbody.querySelectorAll('[data-litlist] .ref').forEach(r => { r.hidden = q && !r.dataset.search.includes(q); }); }
    });
    host.addEventListener('change', e => {
      if (e.target.dataset.litsort != null) { const list = pbody.querySelector('[data-litlist]'); const k = e.target.value; [...list.children].sort((a, b) => (a.dataset[k] || '').localeCompare(b.dataset[k] || '')).forEach(n => list.appendChild(n)); }
    });
    modal.addEventListener('click', e => { if (e.target === modal) closeModal(); });
    const onKey = e => {
      if (host.offsetParent === null && !opts.preview) return;
      const typing = /INPUT|TEXTAREA|SELECT/.test((document.activeElement || {}).tagName);
      if (e.key === 'Escape') { if (!modal.hidden) closeModal(); else closePanel(); }
      if (typing || !modal.hidden) return;
      if (world && world.hasRpg()) {
        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyW', 'KeyA', 'KeyS', 'KeyD'].includes(e.code)) { world.rpgKey(e.code, e.type === 'keydown'); e.preventDefault(); }
        if (e.code === 'KeyE' && e.type === 'keydown' && !$('.talk').hidden) talk(+$('.talk').dataset.i);
      }
    };
    window.addEventListener('keydown', onKey); window.addEventListener('keyup', onKey);

    function setMotion() {
      const prefers = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
      const on = P.motion == null ? prefers : P.motion;
      elSite.classList.toggle('reduced', !!on);
      world && world.setReduced(!!on);
      const b = host.querySelector('[data-act="motion"]'); if (b) b.classList.toggle('on', !!on);
    }

    /* ---------- 歡迎畫面 ---------- */
    function welcome() {
      const m = C.cfg.meta;
      openModal(`<div class="welcome"><div class="w-mark" aria-hidden="true">${esc((m.mascot || m.name || '島').slice(0, 1))}</div><h1>${esc(m.name || L('我的群島', 'My Islands'))}</h1>${m.tagline ? `<p class="lead">${esc(m.tagline)}</p>` : ''}${m.author ? `<p class="muted">${esc(m.author)}</p>` : ''}${m.mascot ? `<p class="mascot-say">${esc(m.mascot)}：${L('一起去逛島吧！', 'Let’s explore!')}</p>` : ''}<ul class="howto"><li>🖱 ${L('拖曳旋轉，滾輪或雙指縮放', 'Drag to rotate, scroll to zoom')}</li><li>👆 ${L('點島嶼或下方名字看內容', 'Tap an island to open it')}</li>${C.cfg.rpg ? `<li>🧭 ${L('方向鍵走動，E 和島民說話', 'Arrows to move, E to talk')}</li>` : ''}${has('residents') ? `<li>🐚 ${L('點居民聊天，撿貝殼交換禮物', 'Chat with residents, collect shells')}</li>` : ''}</ul><div class="cta-row center"><button type="button" class="btn big" data-go>${L('開始探索', 'Start exploring')}</button>${has('list') ? `<button type="button" class="btn ghost" data-act="list">${L('用文字清單瀏覽', 'Text-only view')}</button>` : ''}</div></div>`, 'welcome-m');
      mbody.querySelector('[data-go]').addEventListener('click', () => { closeModal(); if (C.cfg.rpg) askName(); });
    }

    /* ---------- 初始化與更新 ---------- */
    function init(first) {
      buildBrand(); buildTools(); buildDock(); renderHud(); IDX = null;
      startWorld();
      const initialSlot = P.theme || (C.cfg.theme.auto ? null : C.cfg.theme.order && C.cfg.theme.order[0]) || 'day';
      if (world) {
        if (P.theme) world.setTod(TOD_FOR[P.theme], 'fixed');
        else if (C.cfg.life) world.setTod(new Date().getHours() + new Date().getMinutes() / 60, 'cycle');
        else if (has('clock')) world.setTod(new Date().getHours() + new Date().getMinutes() / 60, 'real');
        else world.setTod(TOD_FOR[C.cfg.theme.order ? C.cfg.theme.order[0] : 'day'], 'fixed');
      }
      applyTheme(world && !P.theme && C.cfg.theme.auto ? slotForTod(world.getTod()) : initialSlot);
      if (C.cfg.rpg && world) world.setFollow(!!P.name);
      setMotion();
      if (C.cfg.type === 'live') C.isles.forEach(is => { const it = manualItems(is)[0]; if (world && it) world.setBillboard(is.idx, is.name, it.title); loadFeed(is.idx); });
      if (first && !opts.preview) welcome();
    }
    init(true);

    site.update = function (cfg2, o2) {
      const prevType = C.cfg.type;
      C = normalize(cfg2); liveData = {};
      if (o2 && o2.resetProgress) { P = blankP(); }
      opts.keepCam = !!(o2 && o2.keepCam);
      closeModal(); if (openIdx != null && (openIdx > C.isles.length || prevType !== C.cfg.type)) closePanel();
      init(false);
      if (openIdx != null) openIsle(openIdx);
    };
    site.world = () => world;
    site.setTod = (slot) => { if (world) { world.setTod(TOD_FOR[slot] || 10, 'fixed'); applyTheme(slot); } };
    site.playIntro = () => world && world.playIntro();
    site.open = i => openIsle(i);
    site.destroy = () => { window.removeEventListener('keydown', onKey); window.removeEventListener('keyup', onKey); world && world.destroy(); G.Music.stop(); host.innerHTML = ''; };
    return site;
  }

  ISLE.Site = { mount, normalize };
})();
