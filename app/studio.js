/* 群島製圖所：6 步驟表單（A、B 兩版共用）
   ISLE.Studio.init({ mode: 'A' | 'B' }) */
(function () {
  const ISLE = window.ISLE, U = ISLE.U, D = ISLE.DATA;
  const esc = U.esc;
  const STORE = 'isle-studio:state';
  const MAX_ISLES = 20, MAX_BYTES = 200 * 1024 * 1024;

  const Studio = {};
  let mode = 'A', S = null, step = 1, FILES = [], root = null, previewReady = false, pvTimer = 0, saveTimer = 0;
  const openMore = new Set();

  /* ---------- 狀態 ---------- */
  function load() {
    try {
      const raw = localStorage.getItem(STORE);
      if (raw) { S = migrate(JSON.parse(raw)); return true; }
    } catch (e) { /* 第一次使用或無法存取 */ }
    S = D.defaultState();
    return false;
  }
  function migrate(o) {
    const d = D.defaultState();
    const s = Object.assign(d, o);
    s.meta = Object.assign(D.defaultState().meta, o.meta || {});
    s.theme = Object.assign(D.defaultState().theme, o.theme || {});
    s.center = Object.assign({ name: '', note: '', extra: {} }, o.center || {});
    s.islands = (o.islands || d.islands).map(i => Object.assign(D.blankIsland(), i, { extra: Object.assign({}, i.extra || {}) }));
    return s;
  }
  function save() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => { try { localStorage.setItem(STORE, JSON.stringify(S)); flash('已自動儲存'); } catch (e) { flash('瀏覽器無法儲存，請記得匯出專案檔'); } }, 400);
    schedulePreview();
  }
  function flash(t) { const el = root.querySelector('.save-state'); if (el) { el.textContent = t; el.classList.add('on'); clearTimeout(el._t); el._t = setTimeout(() => el.classList.remove('on'), 1600); } }
  function setPath(path, val) {
    const ks = path.split('.'); let o = S;
    for (let i = 0; i < ks.length - 1; i++) { o = o[ks[i]] = o[ks[i]] || {}; }
    o[ks[ks.length - 1]] = val;
  }
  function getPath(path) { return path.split('.').reduce((o, k) => (o == null ? o : o[k]), S); }
  const T = () => D.TYPES[S.type] || D.TYPES.course;
  const named = () => S.islands.filter(i => (i.name || '').trim());

  /* ---------- 外框 ---------- */
  const STEPS = () => [
    { n: 1, name: '選島型' }, { n: 2, name: '基本資料' }, { n: 3, name: '島嶼清單' },
    { n: 4, name: '放入資料' }, { n: 5, name: '外觀與功能' }, { n: 6, name: mode === 'A' ? '下載造島包' : '產生網站' }
  ];
  function shell() {
    root.innerHTML = `
      <header class="st-head">
        <div class="logo"><span class="logo-mark" aria-hidden="true"><i></i><i></i><i></i></span><div><b>群島製圖所</b><small>${mode === 'A' ? 'A 版・AI 造島包產生器' : 'B 版・直接產生島嶼網站'}</small></div></div>
        <div class="head-act">
          <span class="save-state" aria-live="polite"></span>
          <button type="button" class="hbtn" data-a="examples">🧪 範例</button>
          <button type="button" class="hbtn" data-a="saveProject" title="把目前的填寫內容存成檔案">💾 匯出專案</button>
          <label class="hbtn" title="打開之前匯出的專案檔">📂 匯入專案<input type="file" accept=".json,application/json" data-a="loadProject" hidden></label>
          <button type="button" class="hbtn" data-a="help">？ 說明</button>
        </div>
      </header>
      <div class="st-main">
        <section class="st-form">
          <ol class="rail" role="tablist"></ol>
          <div class="step-wrap"></div>
          <nav class="step-nav"><button type="button" class="sbtn ghost" data-a="prev">← 上一步</button><button type="button" class="sbtn ghost pv-only" data-a="pvFull">看預覽</button><button type="button" class="sbtn" data-a="next">下一步 →</button></nav>
        </section>
        <aside class="st-preview" aria-label="即時預覽">
          <div class="pv-bar"><b>即時預覽</b><span class="pv-cap"></span><span class="pv-tools"><button type="button" data-a="pvTod" data-v="day" title="白天">☀️</button><button type="button" data-a="pvTod" data-v="dusk" title="黃昏">🌇</button><button type="button" data-a="pvTod" data-v="night" title="夜晚">🌙</button><button type="button" data-a="pvIntro" title="重播運鏡">🎬</button><button type="button" data-a="pvFull" title="放大預覽">⛶</button></span></div>
          <div class="pv-frame"><iframe title="島嶼預覽" src="app/preview.html"></iframe></div>
          <p class="pv-note">${mode === 'A' ? '這是示意預覽，真正的網站會由 AI 依造島包蓋得更完整。' : '這就是會產生出來的網站，可以直接點島、答題、試玩。'}</p>
        </aside>
      </div>
      <div class="st-modal" hidden><div class="st-card"><button type="button" class="st-x" data-a="mclose" aria-label="關閉">✕</button><div class="st-mbody"></div></div></div>
      <div class="st-toast" aria-live="polite"></div>`;
    root.querySelector('.pv-frame iframe').addEventListener('load', () => { previewReady = true; schedulePreview(0); });
    window.addEventListener('message', e => { if (e.data && e.data.isle === 'ready') { previewReady = true; schedulePreview(0); } });
  }
  function renderRail() {
    root.querySelector('.rail').innerHTML = STEPS().map(s => `<li><button type="button" role="tab" aria-selected="${s.n === step}" data-a="go" data-v="${s.n}" class="${s.n === step ? 'on' : ''} ${s.n < step ? 'done' : ''}"><span>${s.n}</span>${s.name}</button></li>`).join('');
    const nav = root.querySelector('.step-nav');
    nav.querySelector('[data-a=prev]').disabled = step === 1;
    nav.querySelector('[data-a=next]').hidden = step === 6;
  }
  function render() {
    renderRail();
    const w = root.querySelector('.step-wrap');
    w.innerHTML = `<p class="step-no">步驟 ${step}／6</p>` + [null, step1, step2, step3, step4, step5, step6][step]();
    w.scrollTop = 0;
    root.querySelector('.st-form').scrollTo({ top: 0 });
    updateCaption();
  }
  function toast(t, ms) { const el = root.querySelector('.st-toast'); el.textContent = t; el.classList.add('on'); clearTimeout(el._t); el._t = setTimeout(() => el.classList.remove('on'), ms || 2400); }
  function modal(html) { root.querySelector('.st-mbody').innerHTML = html; root.querySelector('.st-modal').hidden = false; }
  function closeModal() { root.querySelector('.st-modal').hidden = true; }
  Studio.toast = t => toast(t); Studio.modal = modal; Studio.closeModal = closeModal;

  /* ---------- 步驟 1：島型 ---------- */
  function step1() {
    return `<h2>你想蓋哪一種島？</h2><p class="hint">挑最接近的就好，之後可以回來改。每種島型都會自動勾好適合的功能。</p>
      <div class="type-grid">${Object.keys(D.TYPES).map(k => { const t = D.TYPES[k]; return `<button type="button" class="type-card ${S.type === k ? 'on' : ''}" data-a="type" data-v="${k}" aria-pressed="${S.type === k}"><span class="ti" aria-hidden="true">${t.icon}</span><b>${t.name}</b><span class="td">${t.desc}</span><span class="tf">適合：${t.fit}</span></button>`; }).join('')}</div>
      <div class="mode-row">
        <label class="mode-card ${S.rpg ? 'on' : ''}"><input type="checkbox" data-a="rpg" ${S.rpg ? 'checked' : ''}><span class="ti">🎮</span><span><b>加上 RPG 冒險模式</b><small>建立角色在島上走動、每座島有島民說故事、答題拿經驗值升級、集滿島章挑戰中央島、領冒險證書。</small></span></label>
        <label class="mode-card ${S.life ? 'on' : ''}"><input type="checkbox" data-a="life" ${S.life ? 'checked' : ''}><span class="ti">🌤️</span><span><b>加上生活感模式</b><small>居民散步、點了會揮手聊天，可以撿貝殼交換小禮物；雲、鳥、帆船會動，天色從白天變黃昏再到夜晚，燈火亮起。</small></span></label>
      </div>`;
  }

  /* ---------- 步驟 2：基本資料 ---------- */
  function field(label, path, o) {
    o = o || {};
    const v = getPath(path) || '';
    const req = o.req ? '<i class="req">*</i>' : '';
    const id = 'f-' + path.replace(/\W/g, '-');
    if (o.kind === 'select') return `<label class="fld" for="${id}"><span>${label}${req}</span><select id="${id}" data-k="${path}">${o.options.map(op => `<option value="${esc(op[0])}" ${String(v) === String(op[0]) ? 'selected' : ''}>${esc(op[1])}</option>`).join('')}</select>${o.help ? `<small>${o.help}</small>` : ''}</label>`;
    if (o.kind === 'textarea') return `<label class="fld" for="${id}"><span>${label}${req}</span><textarea id="${id}" data-k="${path}" rows="${o.rows || 3}" placeholder="${esc(o.ph || '')}">${esc(v)}</textarea>${o.help ? `<small>${o.help}</small>` : ''}</label>`;
    return `<label class="fld ${o.half ? 'half' : ''}" for="${id}"><span>${label}${req}</span><input id="${id}" data-k="${path}" value="${esc(v)}" placeholder="${esc(o.ph || '')}" ${o.max ? `maxlength="${o.max}"` : ''}>${o.help ? `<small>${o.help}</small>` : ''}<em class="err" hidden></em></label>`;
  }
  function step2() {
    return `<h2>基本資料</h2><p class="hint">有 <i class="req">*</i> 的必填，其他留白也可以。</p>
      <div class="fgrid">
        ${field('網站名稱', 'meta.name', { req: true, ph: '例如：水的旅行', max: 30 })}
        ${field('一句話介紹', 'meta.tagline', { req: true, ph: '例如：跟著一滴水認識水循環', max: 60 })}
        ${field('英文代號（網址與檔名用）', 'meta.slug', { ph: 'water-journey', help: '小寫英文、數字和減號，例如 my-island', half: true })}
        ${field('目標對象', 'meta.audience', { kind: 'select', options: [['', '請選擇']].concat(D.AUDIENCES.map(a => [a, a])), half: true })}
        ${field('作者或單位', 'meta.author', { half: true })}
        ${field('聯絡方式或社群連結', 'meta.contact', { half: true, ph: 'Email 或網址' })}
        ${field('吉祥物或主角名字', 'meta.mascot', { half: true, ph: '例如：滴滴' })}
        ${field('介面語言', 'meta.lang', { kind: 'select', options: Object.keys(D.LANGS).map(k => [k, D.LANGS[k]]), half: true })}
        ${field('吉祥物外觀描述', 'meta.mascotLook', { kind: 'textarea', rows: 2, ph: '例如：一顆圓滾滾的水滴，戴著小草帽', help: mode === 'A' ? 'AI 會依描述原創繪製。' : '會用在歡迎畫面與小嚮導的名字。' })}
      </div>`;
  }

  /* ---------- 步驟 3：島嶼清單 ---------- */
  function extraField(isl, f) {
    const v = (isl.extra || {})[f.k] || '';
    const id = 'x-' + isl.id + '-' + f.k;
    const help = f.hint || (f.cols ? '一行一筆：' + f.cols.join('｜') : '');
    if (f.kind === 'select') return `<label class="fld half" for="${id}"><span>${f.label}</span><select id="${id}" data-isle="${isl.id}" data-x="${f.k}"><option value="">（請選擇）</option>${f.options.map(o => `<option value="${esc(U.optVal(o))}" ${v === U.optVal(o) ? 'selected' : ''}>${esc(U.optLabel(o))}</option>`).join('')}</select></label>`;
    if (f.kind === 'lines' || f.kind === 'textarea') return `<label class="fld" for="${id}"><span>${f.label}</span><textarea id="${id}" rows="3" data-isle="${isl.id}" data-x="${f.k}" placeholder="${esc(f.cols ? f.cols.join('｜') : '')}">${esc(v)}</textarea>${help ? `<small>${esc(help)}</small>` : ''}</label>`;
    return `<label class="fld half" for="${id}"><span>${f.label}</span><input id="${id}" data-isle="${isl.id}" data-x="${f.k}" value="${esc(v)}" placeholder="${esc(f.ph || '')}"></label>`;
  }
  function isleRow(isl, k) {
    const t = T();
    const more = openMore.has(isl.id);
    const files = FILES.filter(f => f.isle === isl.id);
    return `<li class="isle-row" data-id="${isl.id}">
      <div class="ir-head"><span class="ir-n">${String(k + 1).padStart(2, '0')}</span>
        <input class="ir-name" data-isle="${isl.id}" data-f="name" value="${esc(isl.name)}" placeholder="${t.isle}名 *" aria-label="第 ${k + 1} 座島的${t.isle}名" maxlength="30">
        <input class="ir-intro" data-isle="${isl.id}" data-f="intro" value="${esc(isl.intro)}" placeholder="一句介紹" aria-label="一句介紹">
        <span class="ir-act"><button type="button" data-a="up" data-v="${isl.id}" aria-label="上移">↑</button><button type="button" data-a="down" data-v="${isl.id}" aria-label="下移">↓</button><button type="button" data-a="more" data-v="${isl.id}" aria-expanded="${more}">${more ? '收合' : '更多'}</button><button type="button" data-a="del" data-v="${isl.id}" aria-label="刪除">✕</button></span>
      </div>
      ${more ? `<div class="ir-more fgrid">
        <label class="fld half"><span>分類</span><input data-isle="${isl.id}" data-f="category" value="${esc(isl.category)}"></label>
        <label class="fld half"><span>學習目標</span><input data-isle="${isl.id}" data-f="goal" value="${esc(isl.goal)}"></label>
        <label class="fld"><span>內容重點</span><textarea rows="2" data-isle="${isl.id}" data-f="points" placeholder="用；分隔，例如：重點一；重點二">${esc(isl.points)}</textarea></label>
        ${t.fields.map(f => extraField(isl, f)).join('')}
        <label class="fld"><span>測驗題（選填）</span><textarea rows="2" data-isle="${isl.id}" data-f="quiz" placeholder="題目｜正確答案｜錯誤1｜錯誤2｜錯誤3">${esc(isl.quiz)}</textarea><small>一行一題。沒填的話，網站會從各島重點自動出題。</small></label>
        <label class="fld"><span>相關連結（選填）</span><textarea rows="2" data-isle="${isl.id}" data-f="links" placeholder="名稱｜https://…">${esc(isl.links)}</textarea></label>
        <div class="fld"><span>這座島的檔案</span>${files.length ? `<p class="mini">${files.map(f => '📄 ' + esc(f.name)).join('　')}</p>` : '<p class="mini muted">還沒有。到步驟 4 放進檔案，就會依資料夾名稱自動對應。</p>'}</div>
      </div>` : ''}
    </li>`;
  }
  function step3() {
    const t = T();
    const n = named().length;
    return `<h2>島嶼清單</h2><p class="hint">一列是一座島，建議 3～12 座（最多 ${MAX_ISLES}）。先填名稱和一句介紹，按「更多」補充內容。</p>
      <div class="tool-row">
        <button type="button" class="sbtn small" data-a="addIsle" ${S.islands.length >= MAX_ISLES ? 'disabled' : ''}>＋ 新增一座島</button>
        <button type="button" class="sbtn small ghost" data-a="xlsTemplate">⬇ 下載 Excel 範本</button>
        <label class="sbtn small ghost">⬆ 匯入 Excel<input type="file" accept=".xlsx,.xls,.csv" data-a="xlsImport" hidden></label>
        <button type="button" class="sbtn small ghost" data-a="pasteOpen">📋 從試算表貼上</button>
        <span class="count">已命名 ${n} 座（共 ${S.islands.length} 列）</span>
      </div>
      <label class="check small"><input type="checkbox" data-a="replaceMode" ${Studio._replace ? 'checked' : ''}> 匯入時取代目前清單（不勾＝加在後面）</label>
      <ol class="isle-list">${S.islands.map(isleRow).join('')}</ol>
      ${n < 2 ? '<p class="warn">至少要有 2 座有名字的島。</p>' : ''}
      <div class="center-box">
        <h3>★ 中央大島</h3><p class="hint">放在群島中間。${esc(t.centerRole)}</p>
        <div class="fgrid">
          ${field('中央島名稱', 'center.name', { ph: t.centerName, half: true })}
          ${field('補充說明', 'center.note', { ph: '（選填）', half: true })}
          ${(t.center || []).map(f => f.kind === 'select' ? field(f.label, 'center.extra.' + f.k, { kind: 'select', options: f.options.map(o => [U.optVal(o), U.optLabel(o)]), half: true }) : field(f.label, 'center.extra.' + f.k, { kind: 'textarea', rows: 3, help: f.hint })).join('')}
        </div>
      </div>`;
  }

  /* ---------- 步驟 4：檔案 ---------- */
  function totalBytes() { return FILES.reduce((s, f) => s + f.size, 0); }
  function fmtSize(b) { return b > 1048576 ? (b / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(b / 1024)) + ' KB'; }
  function step4() {
    const opts = [['shared', '00 共用（全站）']].concat(S.islands.map((i, k) => [i.id, String(k + 1).padStart(2, '0') + ' ' + (i.name || '（未命名）')]));
    return `<h2>放入手邊的資料</h2><p class="hint">講義、簡報、PDF、圖片、題庫都可以。檔案只在你的瀏覽器裡處理，<b>不會上傳到任何伺服器</b>。</p>
      <div class="tipbox"><b>📁 建議：一座島一個資料夾</b><ol><li>按「下載資料夾範本」，裡面已依島名建好 <code>01_島名</code> 資料夾，另有 <code>00_共用</code>。</li><li>把每座島的資料放進同名資料夾。</li><li>整包壓成 ZIP 拖進來（或直接拖資料夾），會自動對應到同名的島。</li></ol><button type="button" class="sbtn small ghost" data-a="folderTpl">⬇ 下載資料夾範本</button></div>
      <div class="drop" tabindex="0" role="button" aria-label="選擇或拖入檔案"><b>把檔案、資料夾或 ZIP 拖到這裡</b><span>或按這裡選擇檔案（可多選，ZIP 會自動解開；總共 200 MB 以內）</span><input type="file" multiple data-a="files" hidden></div>
      <p class="mini">${FILES.length} 個檔案・${fmtSize(totalBytes())}</p>
      ${FILES.length ? `<table class="ftable"><thead><tr><th>檔名</th><th>大小</th><th>放到哪座島</th><th></th></tr></thead><tbody>${FILES.map(f => `<tr><td>${/^image\//.test(f.type) ? '🖼' : '📄'} ${esc(f.name)}<small>${esc(f.rel || '')}</small></td><td>${fmtSize(f.size)}</td><td><select data-file="${f.id}">${opts.map(o => `<option value="${o[0]}" ${f.isle === o[0] ? 'selected' : ''}>${esc(o[1])}</option>`).join('')}</select></td><td><button type="button" class="linkb" data-a="rmFile" data-v="${f.id}" aria-label="移除">✕</button></td></tr>`).join('')}</tbody></table>` : `<p class="muted">還沒有檔案。沒有也沒關係，${mode === 'A' ? 'AI 會依你填的內容撰寫，並標示「示意」。' : '網站會用你在表單填的內容。'}</p>`}
      <label class="check"><input type="checkbox" data-k="allowDownload" ${S.allowDownload ? 'checked' : ''}> 允許訪客下載這些原始檔案</label>
      <p class="mini muted">不勾的話，${mode === 'A' ? 'AI 只會讀內容改寫進網頁，不會公開原檔' : '只有圖片會放進網站的相簿，其他檔案只顯示名稱'}。</p>
      <p class="mini warn-soft">小提醒：文字會自動保存，但檔案在重新整理頁面後需要重新放進來。</p>
      ${mode === 'A' ? `<div class="center-box"><h3>🌐 請 AI 上網整理資料（選填）</h3><p class="hint">手邊沒有檔案時，貼上公開網站的網址（學校官網、開放資料等），AI 會讀這些頁面整理成島嶼內容，並附上來源與查詢日期。</p>${field('公開資料網址（一行一個）', 'sources', { kind: 'textarea', rows: 3, ph: 'https://…', help: 'AI 只讀公開頁面、遵守網站規定並放慢速度；內容會改寫成摘要並附來源，不抓個資與圖片。需要登入的網站請不要貼。' })}</div>` : ''}`;
  }

  /* ---------- 步驟 5：外觀與功能 ---------- */
  function step5() {
    const th = S.theme;
    const slots = th.order || ['day', 'dusk', 'night'];
    const slotInfo = k => D.THEME_SLOTS.find(s => s.k === k);
    const featList = D.FEATURES;
    return `<h2>配色、外觀與功能</h2>
      <h3>三組底色 <small>訪客可以自己切換</small></h3>
      <div class="slots">${slots.map((k, idx) => { const si = slotInfo(k); return `<div class="slot"><span>${si.icon} ${si.name}${idx === 0 ? ' <em>預設</em>' : ''}</span><input type="color" data-k="theme.${k}" value="${esc(th[k])}" aria-label="${si.name}底色"><code>${esc(th[k])}</code><span class="arrows"><button type="button" data-a="slotMove" data-v="${idx}" data-d="-1" ${idx === 0 ? 'disabled' : ''} aria-label="往前">←</button><button type="button" data-a="slotMove" data-v="${idx}" data-d="1" ${idx === 2 ? 'disabled' : ''} aria-label="往後">→</button></span></div>`; }).join('')}</div>
      <label class="check"><input type="checkbox" data-k="theme.auto" ${th.auto ? 'checked' : ''}> 跟著島上的日出日落自動換底色（訪客手動選了就照訪客的）</label>
      <div class="fgrid"><label class="fld half"><span>主色</span><input type="color" data-k="theme.primary" value="${esc(th.primary)}"></label><label class="fld half"><span>強調色</span><input type="color" data-k="theme.accent" value="${esc(th.accent)}"></label></div>
      <p class="mini">一鍵套用配色：</p><div class="chips">${D.PALETTES.map(p => `<button type="button" class="pal" data-a="palette" data-v="${p.id}"><i style="background:${p.day}"></i><i style="background:${p.dusk}"></i><i style="background:${p.night}"></i><i style="background:${p.primary}"></i><i style="background:${p.accent}"></i>${p.name}</button>`).join('')}</div>
      <h3>視覺風格</h3><div class="opt-grid">${Object.keys(D.STYLES).map(k => `<button type="button" class="opt-card ${S.style === k ? 'on' : ''}" data-a="set" data-k="style" data-v="${k}"><b>${D.STYLES[k].name}</b><small>${D.STYLES[k].desc}</small></button>`).join('')}</div>
      <h3>字體</h3><div class="opt-grid three">${Object.keys(D.FONTS).map(k => `<button type="button" class="opt-card ${S.font === k ? 'on' : ''}" data-a="set" data-k="font" data-v="${k}" style="font-family:${esc(D.FONTS[k].css)}"><b>${D.FONTS[k].name}</b><small>${D.FONTS[k].desc}</small></button>`).join('')}</div>
      <h3>島的形狀</h3><div class="opt-grid">${Object.keys(D.SHAPES).map(k => `<button type="button" class="opt-card ${S.shape === k ? 'on' : ''}" data-a="set" data-k="shape" data-v="${k}"><b>${D.SHAPES[k].icon} ${D.SHAPES[k].name}</b><small>${D.SHAPES[k].desc}</small></button>`).join('')}</div>
      <h3>精緻度</h3><div class="seg">${D.DETAIL.map(d => `<button type="button" class="${S.detail === d.v ? 'on' : ''}" data-a="set" data-k="detail" data-v="${d.v}" title="${d.desc}">${'★'.repeat(d.v)} ${d.name}</button>`).join('')}</div><p class="mini">${(D.DETAIL.find(d => d.v === S.detail) || {}).desc || ''}</p>
      <h3>島上的動物 <small>可複選</small></h3><div class="chips">${Object.keys(D.ANIMALS).map(k => `<button type="button" class="chipb ${S.animals.includes(k) ? 'on' : ''}" data-a="toggle" data-k="animals" data-v="${k}" aria-pressed="${S.animals.includes(k)}">${D.ANIMALS[k].icon} ${D.ANIMALS[k].name}</button>`).join('')}</div>
      <h3>地景點綴 <small>可複選</small></h3><div class="chips">${Object.keys(D.EXTRAS).map(k => `<button type="button" class="chipb ${S.extras.includes(k) ? 'on' : ''}" data-a="toggle" data-k="extras" data-v="${k}" aria-pressed="${S.extras.includes(k)}">${D.EXTRAS[k].icon} ${D.EXTRAS[k].name}</button>`).join('')}</div>
      <h3>鏡頭運鏡</h3><div class="opt-grid">${Object.keys(D.CINEMA).map(k => `<button type="button" class="opt-card ${S.cinema === k ? 'on' : ''}" data-a="set" data-k="cinema" data-v="${k}"><b>${D.CINEMA[k].icon} ${D.CINEMA[k].name}</b><small>${D.CINEMA[k].desc}</small></button>`).join('')}</div>
      <h3>想要的功能 <small>已依島型勾好建議組合</small></h3>
      <p class="mini">✓ 手機、平板、電腦都能用（必備）　✓ 不需要伺服器、不需要 API 金鑰</p>
      <div class="feat-grid">${featList.map(f => `<label class="feat ${S.features.includes(f.id) ? 'on' : ''}"><input type="checkbox" data-a="feature" data-v="${f.id}" ${S.features.includes(f.id) ? 'checked' : ''}><b>${f.name}</b><small>${f.desc}</small></label>`).join('')}</div>
      <p class="mini muted">動物、樹、建築都是通用造型，全部用程式原創繪製。</p>`;
  }

  /* ---------- 步驟 6 ---------- */
  function step6() {
    const issues = validate();
    const sum = `<ul class="summary"><li><b>島型</b>${T().icon} ${T().name}${S.rpg ? '＋RPG' : ''}${S.life ? '＋生活感' : ''}</li><li><b>網站</b>${esc(S.meta.name || '（未填）')}</li><li><b>島嶼</b>${named().length} 座＋中央島</li><li><b>外觀</b>${D.STYLES[S.style].name}・${D.SHAPES[S.shape].name}・${'★'.repeat(S.detail)}</li><li><b>檔案</b>${FILES.length} 個</li><li><b>功能</b>${S.features.length} 項</li></ul>`;
    const issueHtml = issues.length ? `<div class="warn"><b>還差一點：</b><ul>${issues.map(i => `<li><button type="button" class="linkb" data-a="go" data-v="${i[0]}">步驟 ${i[0]}</button> ${esc(i[1])}</li>`).join('')}</ul></div>` : '';
    if (mode === 'A' && ISLE.Kit) return ISLE.Kit.step6Html({ S, FILES, sum, issueHtml, field, issues });
    if (mode === 'B' && ISLE.Export) return ISLE.Export.step6Html({ S, FILES, sum, issueHtml, issues });
    return sum;
  }
  function validate() {
    const out = [];
    if (!(S.meta.name || '').trim()) out.push([2, '請填網站名稱']);
    if (!(S.meta.tagline || '').trim()) out.push([2, '請用一句話介紹這個網站']);
    if (S.meta.slug && !/^[a-z0-9-]+$/.test(S.meta.slug)) out.push([2, '英文代號只能用小寫英文、數字和減號']);
    if (named().length < 2) out.push([3, '至少要有 2 座有名字的島']);
    return out;
  }
  Studio.validate = validate;

  /* ---------- 預覽 ---------- */
  function previewState() {
    const s = JSON.parse(JSON.stringify(S));
    s.islands = s.islands.map(i => Object.assign(i, { files: FILES.filter(f => f.isle === i.id).map(f => ({ name: f.name, type: f.type, size: f.size, path: f.path })) }));
    return s;
  }
  Studio.previewState = previewState;
  function schedulePreview(ms) {
    clearTimeout(pvTimer);
    pvTimer = setTimeout(() => {
      const f = root.querySelector('.pv-frame iframe');
      if (!f || !f.contentWindow || !previewReady) return;
      try { f.contentWindow.postMessage({ isle: 'state', state: previewState() }, '*'); } catch (e) { /* 預覽還沒準備好 */ }
    }, ms == null ? 450 : ms);
  }
  function pvCmd(cmd, arg) { const f = root.querySelector('.pv-frame iframe'); if (f && f.contentWindow) f.contentWindow.postMessage({ isle: 'cmd', cmd, arg }, '*'); }
  function updateCaption() {
    const c = root.querySelector('.pv-cap');
    if (c) c.textContent = `${T().name}${S.rpg ? '＋RPG' : ''}${S.life ? '＋生活感' : ''}・${D.SHAPES[S.shape].name}・${D.STYLES[S.style].name}`;
  }

  /* ---------- 島嶼清單操作 ---------- */
  function findIsle(id) { return S.islands.find(i => i.id === id); }
  function applyType(k) {
    S.type = k;
    const base = D.TYPES[k].features.slice();
    if (S.life) D.LIFE_FEATURES.forEach(f => base.includes(f) || base.push(f));
    if (S.life && !base.includes('residents')) base.push('residents');
    S.features = base.filter(f => D.FEATURES.some(x => x.id === f));
  }
  function fillExample(k) {
    const ex = JSON.parse(JSON.stringify(ISLE.EXAMPLES[k]));
    const keepTheme = S.theme;
    S = D.defaultState();
    S.theme = keepTheme;
    S.meta = Object.assign(S.meta, ex.meta);
    S.center = Object.assign({ name: '', note: '', extra: {} }, ex.center);
    S.islands = ex.islands.map((i, n) => Object.assign(D.blankIsland(n), i));
    ['shape', 'style', 'animals', 'extras'].forEach(p => { if (ex[p]) S[p] = ex[p]; });
    applyType(k);
    FILES = [];
  }

  /* ---------- Excel ---------- */
  function sheetCols() {
    const t = T();
    return [['name', '島名'], ['intro', '一句介紹'], ['category', '分類'], ['goal', '學習目標'], ['points', '內容重點'], ['links', '連結'], ['quiz', '測驗題']].concat(t.fields.map(f => ['x:' + f.k, f.label]));
  }
  function xlsTemplate() {
    if (!window.XLSX) { toast('找不到 Excel 元件'); return; }
    const cols = sheetCols();
    const ex = ISLE.EXAMPLES[S.type];
    const rows = [cols.map(c => c[1])];
    ex.islands.slice(0, 2).forEach(i => rows.push(cols.map(([k]) => { const v = k.startsWith('x:') ? (i.extra || {})[k.slice(2)] : i[k]; return k === 'name' ? '（範例）' + i.name : (v || ''); })));
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = cols.map(c => ({ wch: c[0] === 'name' ? 18 : 28 }));
    const help = XLSX.utils.aoa_to_sheet([['怎麼填'], ['1. 一列是一座島，最多 20 座；第 1 列的欄位名稱不要改、不要刪。'], ['2. 只有「島名」必填。'], ['3. 「內容重點」有好幾點時，用全形分號「；」隔開。'], ['4. 多行內容（例如測驗題、知識卡）在同一格內用 Alt＋Enter 換行，每行用「｜」分欄。'], ['5. 測驗題格式：題目｜正確答案｜錯誤1｜錯誤2｜錯誤3'], ['6. 島名開頭是「（範例）」的列不會被匯入，可以直接改寫或刪掉。']]);
    help['!cols'] = [{ wch: 80 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '島嶼清單');
    XLSX.utils.book_append_sheet(wb, help, '填寫說明');
    XLSX.writeFile(wb, `島嶼清單範本_${T().name}.xlsx`);
  }
  function importRows(rows) {
    if (!rows.length) { toast('沒有讀到資料'); return; }
    const header = rows[0].map(h => String(h || '').trim());
    const cols = sheetCols();
    const map = header.map(h => { const c = cols.find(c => c[1] === h || c[0] === h); return c ? c[0] : null; });
    if (!map.includes('name')) { toast('第 1 列找不到「島名」欄位，請用範本填寫'); return; }
    const list = [];
    rows.slice(1).forEach(r => {
      const isl = D.blankIsland(list.length);
      map.forEach((k, j) => { if (!k) return; const v = String(r[j] == null ? '' : r[j]).replace(/\r\n/g, '\n').trim(); if (k.startsWith('x:')) isl.extra[k.slice(2)] = v; else isl[k] = v; });
      if (isl.name && !/^（範例）/.test(isl.name)) list.push(isl);
    });
    if (!list.length) { toast('沒有可以匯入的島（範例列不會匯入）'); return; }
    if (Studio._replace) S.islands = list; else S.islands = S.islands.filter(i => (i.name || '').trim()).concat(list);
    if (S.islands.length > MAX_ISLES) { S.islands = S.islands.slice(0, MAX_ISLES); toast(`超過 ${MAX_ISLES} 座，只保留前 ${MAX_ISLES} 座`); }
    else toast(`匯入了 ${list.length} 座島`);
    save(); render();
  }
  function xlsImport(file) {
    const rd = new FileReader();
    rd.onload = () => {
      try {
        const wb = XLSX.read(new Uint8Array(rd.result), { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        importRows(XLSX.utils.sheet_to_json(ws, { header: 1, blankrows: false, defval: '' }));
      } catch (e) { toast('讀不到這個檔案，請確認是 .xlsx 格式'); }
    };
    rd.readAsArrayBuffer(file);
  }
  function pasteOpen() {
    modal(`<h2>📋 從試算表複製貼上</h2><p class="hint">在 Excel 或 Google 試算表選取範圍（<b>包含第 1 列欄位名稱</b>）複製，貼在下面。欄位名稱要和範本一樣：${sheetCols().map(c => c[1]).join('、')}。</p><textarea class="paste" rows="8" placeholder="島名	一句介紹	…"></textarea><div class="row-end"><button type="button" class="sbtn" data-a="pasteDo">匯入</button></div>`);
  }
  function parseTsv(text) {
    const rows = []; let row = [], cur = '', q = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (q) { if (ch === '"' && text[i + 1] === '"') { cur += '"'; i++; } else if (ch === '"') q = false; else cur += ch; }
      else if (ch === '"' && cur === '') q = true; else if (ch === '\t') { row.push(cur); cur = ''; } else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i++; row.push(cur); rows.push(row); row = []; cur = ''; } else cur += ch;
    }
    if (cur || row.length) { row.push(cur); rows.push(row); }
    return rows.filter(r => r.some(c => String(c).trim()));
  }

  /* ---------- 檔案 ---------- */
  let fileSeq = 0;
  function folderTpl() {
    const z = new JSZip();
    z.file('00_共用/放全站共用的資料.txt', '例如：課程大綱、全站題庫、作者照片。\n');
    S.islands.forEach((i, k) => { const nm = String(k + 1).padStart(2, '0') + '_' + safeName(i.name || '未命名'); z.file(nm + '/把這座島的資料放這裡.txt', `島名：${i.name || ''}\n把講義、簡報、圖片等放進這個資料夾。\n`); });
    z.file('說明.txt', '1. 每座島的資料放進同名資料夾。\n2. 全站共用的放 00_共用。\n3. 整個資料夾壓成 ZIP，拖回群島製圖所的步驟 4。\n');
    z.generateAsync({ type: 'blob' }).then(b => saveBlob(b, `${S.meta.slug || '群島'}_資料夾範本.zip`));
  }
  function safeName(s) { return String(s).replace(/[\\/:*?"<>|]/g, '_').trim().slice(0, 40) || '未命名'; }
  Studio.safeName = safeName;
  function matchIsle(rel) {
    const parts = rel.split('/');
    for (const p of parts.slice(0, -1)) {
      if (/^00[_\s-]/.test(p) || /共用/.test(p)) return 'shared';
      const m = p.match(/^(\d{1,2})[_\s-]*(.*)$/);
      if (m) { const byNum = S.islands[+m[1] - 1]; const byName = S.islands.find(i => i.name && m[2] && i.name.trim() === m[2].trim()); if (byName) return byName.id; if (byNum) return byNum.id; }
      const byName = S.islands.find(i => i.name && i.name.trim() === p.trim()); if (byName) return byName.id;
    }
    return 'shared';
  }
  function addFile(blob, rel) {
    rel = rel.replace(/^\/+/, '');
    const name = rel.split('/').pop();
    if (/^(\.|__MACOSX|Thumbs\.db|desktop\.ini)/.test(name) || rel.includes('__MACOSX/')) return;
    if (totalBytes() + blob.size > MAX_BYTES) { toast('超過 200 MB，有些檔案沒有放進來'); return; }
    const type = blob.type || guessType(name);
    FILES.push({ id: 'f' + (++fileSeq), name, rel, size: blob.size, type, blob, isle: matchIsle(rel) });
  }
  function guessType(n) { const e = n.split('.').pop().toLowerCase(); return { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml', pdf: 'application/pdf', mp3: 'audio/mpeg', mp4: 'video/mp4' }[e] || 'application/octet-stream'; }
  async function ingest(list) {
    for (const it of list) {
      if (/\.zip$/i.test(it.rel)) {
        try { const z = await JSZip.loadAsync(it.file); const ents = Object.values(z.files).filter(f => !f.dir); for (const f of ents) { const b = await f.async('blob'); addFile(new Blob([b], { type: guessType(f.name) }), f.name); } }
        catch (e) { toast('ZIP 解不開：' + it.rel); }
      } else addFile(it.file, it.rel);
    }
    assignPaths(); render(); schedulePreview();
    toast(`目前共有 ${FILES.length} 個檔案`);
  }
  function assignPaths() {
    const used = new Set();
    FILES.forEach(f => {
      const k = S.islands.findIndex(i => i.id === f.isle);
      const dir = k < 0 ? '00_共用' : String(k + 1).padStart(2, '0') + '_' + safeName(S.islands[k].name || '未命名');
      let p = dir + '/' + safeName(f.name), n = 1;
      while (used.has(p)) { p = dir + '/' + n + '_' + safeName(f.name); n++; }
      used.add(p); f.path = p;
    });
  }
  Studio.files = () => { assignPaths(); return FILES; };
  function readEntry(entry, path, out) {
    return new Promise(res => {
      if (entry.isFile) entry.file(f => { out.push({ file: f, rel: path + f.name }); res(); }, () => res());
      else if (entry.isDirectory) {
        const rd = entry.createReader(); const all = [];
        const next = () => rd.readEntries(async ents => { if (!ents.length) { for (const e of all) await readEntry(e, path + entry.name + '/', out); res(); } else { all.push(...ents); next(); } }, () => res());
        next();
      } else res();
    });
  }
  async function onDrop(e) {
    e.preventDefault();
    const out = [];
    const items = e.dataTransfer.items;
    if (items && items[0] && items[0].webkitGetAsEntry) {
      const ents = [...items].map(i => i.webkitGetAsEntry()).filter(Boolean);
      for (const en of ents) await readEntry(en, '', out);
    } else [...e.dataTransfer.files].forEach(f => out.push({ file: f, rel: f.name }));
    ingest(out);
  }

  /* ---------- 專案檔 ---------- */
  function saveBlob(blob, name) { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500); }
  Studio.saveBlob = saveBlob;
  function saveProject() { saveBlob(new Blob([JSON.stringify(projectData(), null, 2)], { type: 'application/json' }), `${S.meta.slug || 'islands'}.project.json`); toast('專案檔已下載，下次可以用「匯入專案」接著做'); }
  function projectData() { const s = previewState(); s._app = '群島製圖所'; s._saved = new Date().toISOString(); return s; }
  Studio.projectData = projectData;
  function loadProject(file) {
    const rd = new FileReader();
    rd.onload = () => { try { const o = JSON.parse(rd.result); if (!o.islands) throw 0; S = migrate(o); save(); step = 1; render(); toast('已載入專案（檔案需要重新放入）'); } catch (e) { toast('這不是群島製圖所的專案檔'); } };
    rd.readAsText(file);
  }

  /* ---------- 事件 ---------- */
  const A = {
    go: b => { step = +b.dataset.v; render(); },
    prev: () => { if (step > 1) { step--; render(); } },
    next: () => { if (step === 3 && named().length < 2) { toast('至少要有 2 座有名字的島'); return; } if (step < 6) { step++; render(); } },
    type: b => { applyType(b.dataset.v); save(); render(); toast(`已切換成「${T().name}」，並套用建議功能`); },
    set: b => { const k = b.dataset.k; S[k] = k === 'detail' ? +b.dataset.v : b.dataset.v; save(); render(); },
    toggle: b => { const arr = S[b.dataset.k]; const v = b.dataset.v; const i = arr.indexOf(v); if (i >= 0) arr.splice(i, 1); else arr.push(v); save(); b.classList.toggle('on'); b.setAttribute('aria-pressed', i < 0); },
    palette: b => { const p = D.PALETTES.find(x => x.id === b.dataset.v); Object.assign(S.theme, { day: p.day, dusk: p.dusk, night: p.night, primary: p.primary, accent: p.accent }); save(); render(); },
    slotMove: b => { const o = S.theme.order; const i = +b.dataset.v, j = i + +b.dataset.d; [o[i], o[j]] = [o[j], o[i]]; save(); render(); },
    addIsle: () => { if (S.islands.length >= MAX_ISLES) return; const n = D.blankIsland(S.islands.length); S.islands.push(n); save(); render(); setTimeout(() => { const el = root.querySelector(`[data-id="${n.id}"] .ir-name`); el && el.focus(); }, 30); },
    del: b => { const isl = findIsle(b.dataset.v); if (isl.name && !confirm(`確定刪除「${isl.name}」？`)) return; S.islands = S.islands.filter(i => i.id !== b.dataset.v); FILES.forEach(f => { if (f.isle === b.dataset.v) f.isle = 'shared'; }); save(); render(); },
    up: b => { const i = S.islands.findIndex(x => x.id === b.dataset.v); if (i > 0) { [S.islands[i - 1], S.islands[i]] = [S.islands[i], S.islands[i - 1]]; save(); render(); } },
    down: b => { const i = S.islands.findIndex(x => x.id === b.dataset.v); if (i < S.islands.length - 1) { [S.islands[i + 1], S.islands[i]] = [S.islands[i], S.islands[i + 1]]; save(); render(); } },
    more: b => { const id = b.dataset.v; openMore.has(id) ? openMore.delete(id) : openMore.add(id); render(); },
    xlsTemplate, pasteOpen,
    pasteDo: () => { const t = root.querySelector('.paste').value; closeModal(); importRows(parseTsv(t)); },
    folderTpl,
    rmFile: b => { FILES = FILES.filter(f => f.id !== b.dataset.v); assignPaths(); render(); schedulePreview(); },
    examples: () => modal(`<h2>🧪 用範例試試</h2><p class="hint">選一種島型，會填入一份完整的示範資料（會取代目前的填寫內容）。</p><div class="type-grid small">${Object.keys(D.TYPES).map(k => `<button type="button" class="type-card" data-a="useExample" data-v="${k}"><span class="ti">${D.TYPES[k].icon}</span><b>${D.TYPES[k].name}</b><span class="tf">${esc(ISLE.EXAMPLES[k].meta.name)}</span></button>`).join('')}</div>`),
    useExample: b => { const hasData = named().length > 0; if (hasData && !confirm('會取代目前填的內容，確定嗎？（可以先「匯出專案」備份）')) return; fillExample(b.dataset.v); closeModal(); save(); step = 1; render(); schedulePreview(0); toast('已填入範例，右邊預覽可以直接試玩'); },
    saveProject, help: () => welcome(true), mclose: closeModal,
    pvTod: b => pvCmd('tod', b.dataset.v), pvIntro: () => pvCmd('intro'),
    pvFull: () => root.classList.toggle('pv-big'),
    start: () => { closeModal(); try { localStorage.setItem(STORE + ':welcomed', '1'); } catch (e) { /* 略 */ } }
  };
  function bind() {
    root.addEventListener('click', e => {
      const b = e.target.closest('[data-a]'); if (!b || b.tagName === 'INPUT') return;
      if (b.closest('.drop')) return;
      const f = A[b.dataset.a] || (ISLE.Kit && ISLE.Kit.actions[b.dataset.a]) || (ISLE.Export && ISLE.Export.actions[b.dataset.a]);
      if (f) { e.preventDefault(); f(b, Studio); }
    });
    root.addEventListener('click', e => { const d = e.target.closest('.drop'); if (d) d.querySelector('input').click(); });
    root.addEventListener('keydown', e => { const d = e.target.closest('.drop'); if (d && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); d.querySelector('input').click(); } });
    root.addEventListener('input', e => {
      const t = e.target;
      if (t.dataset.k && t.type !== 'checkbox') {
        let v = t.value;
        if (t.dataset.k === 'meta.slug') { v = v.toLowerCase().replace(/[^a-z0-9-]/g, '-'); if (v !== t.value) t.value = v; }
        setPath(t.dataset.k, v); save();
        if (t.type === 'color') { const c = t.parentElement.querySelector('code'); if (c) c.textContent = v; }
      } else if (t.dataset.isle) {
        const isl = findIsle(t.dataset.isle); if (!isl) return;
        if (t.dataset.x) isl.extra[t.dataset.x] = t.value; else isl[t.dataset.f] = t.value;
        save();
        if (t.dataset.f === 'name') { const c = root.querySelector('.count'); if (c) c.textContent = `已命名 ${named().length} 座（共 ${S.islands.length} 列）`; }
      } else if (ISLE.Kit && ISLE.Kit.onInput) ISLE.Kit.onInput(t, Studio);
    });
    root.addEventListener('change', e => {
      const t = e.target, a = t.dataset.a;
      if (t.dataset.k && t.type === 'checkbox') { setPath(t.dataset.k, t.checked); save(); }
      if (t.dataset.k && t.tagName === 'SELECT') { setPath(t.dataset.k, t.value); save(); }
      if (t.dataset.isle && t.tagName === 'SELECT') { const isl = findIsle(t.dataset.isle); isl.extra[t.dataset.x] = t.value; save(); }
      if (t.dataset.file) { const f = FILES.find(x => x.id === t.dataset.file); if (f) { f.isle = t.value; assignPaths(); schedulePreview(); } }
      if (a === 'rpg' || a === 'life') { S[a] = t.checked; if (a === 'life') applyType(S.type); save(); render(); }
      if (a === 'feature') { const i = S.features.indexOf(t.dataset.v); if (t.checked && i < 0) S.features.push(t.dataset.v); if (!t.checked && i >= 0) S.features.splice(i, 1); t.closest('.feat').classList.toggle('on', t.checked); save(); }
      if (a === 'replaceMode') Studio._replace = t.checked;
      if (a === 'xlsImport' && t.files[0]) { xlsImport(t.files[0]); t.value = ''; }
      if (a === 'loadProject' && t.files[0]) { loadProject(t.files[0]); t.value = ''; }
      if (a === 'files' && t.files.length) { ingest([...t.files].map(f => ({ file: f, rel: f.webkitRelativePath || f.name }))); t.value = ''; }
      if (ISLE.Kit && ISLE.Kit.onChange) ISLE.Kit.onChange(t, Studio);
    });
    root.addEventListener('dragover', e => { const d = e.target.closest('.drop'); if (d) { e.preventDefault(); d.classList.add('over'); } });
    root.addEventListener('dragleave', e => { const d = e.target.closest('.drop'); if (d) d.classList.remove('over'); });
    root.addEventListener('drop', e => { const d = e.target.closest('.drop'); if (d) { d.classList.remove('over'); onDrop(e); } });
    root.querySelector('.st-modal').addEventListener('click', e => { if (e.target.classList.contains('st-modal')) closeModal(); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') { closeModal(); root.classList.remove('pv-big'); } });
  }

  function welcome(force) {
    let seen = false; try { seen = !!localStorage.getItem(STORE + ':welcomed'); } catch (e) { /* 略 */ }
    if (seen && !force) return;
    modal(`<h2>歡迎來到群島製圖所 🗺️</h2><p>${mode === 'A' ? '幾分鐘填好資料，就能下載一份給 AI 的「造島包」，請 AI 幫你蓋出一座 3D 島嶼網站。' : '幾分鐘填好資料，就能直接下載一個 3D 島嶼網站，雙擊就能打開。'}</p>
      <ol class="howto-list"><li><b>選島型</b>：課程、品牌、導覽、活動、闖關……挑最接近的；想做成遊戲就打開 RPG 模式。</li><li><b>填資料、列島嶼</b>：可以直接從 Excel 匯入。</li><li><b>放進檔案</b>：講義、簡報、圖片，只在你的電腦處理。</li><li><b>挑外觀</b>：配色、風格、島形、動物、運鏡。</li><li>${mode === 'A' ? '<b>下載造島包</b>：交給 Claude Code、Codex、Gemini CLI 等 AI 工具，它會蓋好網站再問你要放到哪裡。' : '<b>產生網站</b>：下載 ZIP 解壓縮後雙擊 index.html，或直接上傳到 Netlify 等免費空間。'}</li></ol>
      <p class="mini muted">填的內容會自動存在這台電腦的瀏覽器裡，下次打開還在。也可以隨時「匯出專案」備份。</p>
      <div class="row-end"><button type="button" class="sbtn ghost" data-a="examples">用範例試試</button><button type="button" class="sbtn" data-a="start">開始造島</button></div>`);
  }

  Studio.init = function (o) {
    mode = (o && o.mode) || 'A';
    Studio.mode = mode;
    root = document.getElementById('studio');
    root.dataset.mode = mode;
    const had = load();
    if (!S.features || !S.features.length) applyType(S.type);
    shell(); bind(); render();
    if (!had) welcome();
  };
  Studio.state = () => S;
  Studio.setState = s => { S = s; save(); render(); };
  Studio.render = () => render();
  Studio.named = named;
  Studio.type = T;
  Studio.esc = esc;
  Studio.field = field;
  Studio.save = save;

  ISLE.Studio = Studio;
})();
