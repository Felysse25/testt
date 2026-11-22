/* 群島製圖所 A 版：產生給 AI 的「造島包」(ZIP) */
(function () {
  const ISLE = window.ISLE, U = ISLE.U, D = ISLE.DATA;
  const esc = U.esc;
  const LAST = 'isle-studio:lastKit';

  const AI = {
    claude: { name: 'Claude Code', how: '在造島包資料夾開啟終端機，輸入 `claude` 啟動，再把指令整段貼上。' },
    codex: { name: 'Codex', how: '在造島包資料夾開啟終端機，輸入 `codex` 啟動，再把指令整段貼上。' },
    gemini: { name: 'Gemini CLI', how: '在造島包資料夾開啟終端機，輸入 `gemini` 啟動，再把指令整段貼上。' },
    antigravity: { name: 'Antigravity', how: '用 Antigravity 打開造島包資料夾，在 Agent 面板貼上指令。' },
    cursor: { name: 'Cursor', how: '用 Cursor 打開造島包資料夾，切到 Agent 模式後貼上指令。' },
    other: { name: '其他 AI 工具', how: '讓你的 AI 工具可以讀寫這個資料夾，然後貼上指令。' }
  };
  const DEPLOY = {
    ask: { name: '做完再問我', line: '做完並測試好以後，問我要把網站放到哪裡（例如 Netlify、GitHub Pages），再照我的回答部署。' },
    netlify: { name: 'Netlify', line: '做完並測試好以後，部署到 Netlify，完成後把網址告訴我。需要我登入或授權時，請一步一步告訴我要點哪裡。' },
    github: { name: 'GitHub Pages', line: '做完並測試好以後，部署到 GitHub Pages，完成後把網址告訴我。需要我登入或建立儲存庫時，請一步一步告訴我。' },
    cloudflare: { name: 'Cloudflare Pages', line: '做完並測試好以後，部署到 Cloudflare Pages，完成後把網址告訴我。需要登入時請一步一步帶我做。' },
    vercel: { name: 'Vercel', line: '做完並測試好以後，部署到 Vercel，完成後把網址告訴我。需要登入時請一步一步帶我做。' },
    local: { name: '先不上架', line: '先不要上架。做完後告訴我怎麼在自己電腦上打開來看。' }
  };
  const UPDATE_KINDS = [['content', '修改內容'], ['islands', '新增或刪除島嶼'], ['look', '調整外觀'], ['features', '增減功能'], ['bug', '修正問題'], ['other', '其他']];

  /* ---------- 島型規格（給 AI 讀） ---------- */
  const TYPE_SPEC = {
    course: ['每座島 = 一課。島上主建築是小教室，旗子用強調色。', '島嶼面板依序呈現：一句介紹、學習目標、內容重點、學習單（可在網頁作答、存在瀏覽器、可列印）、小測驗。', '中央「總複習島」：從各課題目隨機抽 8 題做跨課測驗；顯示每一課是否看過、測驗最佳成績。', '完成條件：看過每一課，且每課測驗答對 60% 以上 → 可領完成證書。'],
    life: ['每座島 = 一個地點（作品、課程、服務、興趣、生活、聯絡）。依類型放不同建築：作品→展示館、課程→教室、服務→有遮陽棚的小店、聯絡→郵筒。', '面板顯示介紹與重點；若有「行動按鈕文字」，按鈕連到第一個連結，沒有連結就連到作者聯絡方式。', '中央廣場：自我介紹、聯絡方式、所有地點的卡片總覽。'],
    treasure: ['每座島中央有一個寶箱（可以直接在 3D 場景點擊）。', '每日鑰匙：每天 3 把，午夜重置；每座島的小測驗第一次答對 80% 以上可多得 1 把。', '開寶箱：消耗 1 把鑰匙，從這座島的知識卡抽一張（優先抽還沒收集的），翻卡動畫顯示卡名與說明。', '收集圖鑑：所有卡片的格子，已收集顯示內容、未收集顯示「？」。中央「寶物總部」顯示今日鑰匙、圖鑑入口與各島收集進度。'],
    local: ['每座島 = 一個區域。主建築是涼亭或地標。', '面板：介紹、重點、景點與美食卡片、在地故事。', '探索護照：第一次打開某座島就自動蓋章。中央「旅客服務中心」顯示護照集章進度與小嚮導入口。'],
    expo: ['每座島 = 一個展區，島上用帳篷代表攤位（數量依攤位數）。', '面板：介紹、活動時程表、作品或攤位卡片。第一次打開自動集章。', '中央「活動服務台」：把各展區時程合併成依時間排序的全場時程表，並顯示集章卡進度。'],
    science: ['每座島 = 理解現象的一個步驟，島上有望遠鏡。', '面板：說明、觀察重點、按鈕「到觀測台看這一步」→ 打開互動模擬並把滑桿設到該步驟的位置。', '中央「互動觀測台」：可拖曳滑桿、播放／暫停、開關圖層的 2D 或 3D 模擬（現象見 project.json 的 center.extra.sim），下面列出所有步驟，可點選跳到該步驟。', '模擬必須正確：月相要依日地月相對位置正確顯示亮面；四季要算出太陽直射緯度、正午太陽高度與晝長；時區要正確顯示各城市時間與晨昏線；季風要依月份顯示海陸溫差與風向。'],
    live: ['每座島 = 一個資訊頻道，島上有看板，看板上顯示最新一則標題。', '資料來源：Google 試算表（發布為 CSV）或 RSS；讀不到時改用手動填的備用動態，並顯示更新時間。', '中央「總看板」：各頻道最新一則消息與更新時間。', '只讀公開資料、不需要 API 金鑰；請處理跨網域（CORS）讀不到的情況。'],
    runner: ['每座島 = 一個單元。進入後可選初級／中級／高級，開始三跑道跑酷：畫面上方顯示規則，項目從遠方迎面而來，左右換道「吃掉」正確項目、閃開錯誤項目。', '操作：鍵盤左右鍵、A/D、手機左右滑或點左右半邊、畫面上的左右按鈕。三條命、限時。', '難度越高：速度越快、間隔越短、錯誤項目比例越高、過關門檻越高。', '中央「挑戰總部」：各單元各難度的最佳分數與通過標記。每個單元都通過初級 → 可領證書。'],
    empathy: ['每座島 = 一個情境，用第一人稱（主角）走過一天的時間軸。', '「支持模式」開關：打開後每個時刻下方出現「可以怎麼支持」，場景光線變得溫暖明亮；關閉時顯示原本的困難。', '中央「討論教室」：45 分鐘帶領流程、討論問題、各島支持策略總整理，以及明顯的「這只是部分經驗的模擬」聲明。', '用詞尊重，不嘲弄、不誇大障礙或困難。'],
    literature: ['每座島 = 一個主題；島上每一篇文獻是一棟小房子（數量依文獻數）。', '面板：每篇文獻一張卡：篇名、作者、年份、出處、我的筆記、連結、「複製 APA」按鈕。', '中央「中央圖書館」：全部文獻總目錄，可搜尋作者／年份／篇名、可排序，可匯出 APA 文字檔與 BibTeX。', '只放書目資訊與使用者自己的筆記，不要放文獻全文。'],
    portfolio: ['每座島 = 一段經歷，依時間順序排列並用橋連起來，形成成長路線。', '島上每件「我做了什麼」是一棟建築；在 3D 或面板點開時，跳出「能力 +1」的提示，並記錄已看過。', '中央「能力總覽塔」：時間軸、每項能力的累計次數長條圖、反思整理。全部點開後可產生成長證書。'],
    quest: ['每座島 = 一個關卡，有島上角色（NPC）與一隻觀念怪獸（會上下彈跳的可愛造型）。', '和 NPC 對話（逐句顯示台詞），再挑戰怪獸：用測驗題當攻擊，答對扣怪獸血量、答錯扣自己的愛心（3 顆），答對 60% 且還有愛心就打倒怪獸並得到印章。', '中央「最終試煉島」：集滿所有印章才開放，從全部題目抽 10 題做魔王戰，通過即可領冒險證書。']
  };
  const FEATURE_SPEC = {
    search: '搜尋：頂部搜尋框，輸入時即時列出符合的島與內容片段，點選就飛到該島並打開面板。',
    list: '文字清單：一個按鈕打開「不用 3D」的完整內容清單（所有島的文字、連結），供螢幕閱讀器與不支援 WebGL 的裝置使用；偵測不到 WebGL 時自動顯示。',
    progress: '探索進度：記錄看過哪些島（localStorage），標籤與底部導覽顯示 ✓，有進度總表與「清除進度」。',
    quiz: '小測驗：一次一題、選項隨機排列、立即回饋並顯示正確答案、最後顯示分數與再做一次；記錄最佳成績。沒有題目的島可以從各島重點自動出「哪一項屬於這座島」的題目。',
    cert: '完成證書：達成條件後，輸入名字產生證書圖片（網站名、名字、日期、作者、印章），可下載 PNG 與列印；未達成時說明還差什麼。',
    keys: '每日鑰匙：每天固定數量，午夜重置，畫面上顯示剩餘數量。',
    codex: '收集圖鑑：已收集／未收集卡片一覽與收集比例。',
    daynight: '晝夜切換：白天／黃昏／夜晚三個按鈕，改變 3D 光線、天空與網頁底色。',
    clock: '即時時鐘：顯示現在時間，3D 天色跟著實際時間變化。',
    music: '背景音樂：預設不播放，按下才播，可以關掉；請用 Web Audio 即時生成或使用有授權的音樂，並標示來源。',
    reduceMotion: '減少動態：一鍵停止所有動畫與鏡頭飛行；預設跟隨系統的「減少動態」設定。',
    share: '分享卡片：把目前 3D 畫面截圖加上網站名稱、介紹與探索進度，做成 1200×630 的圖片供下載，並可複製網址。',
    guide: '小嚮導問答：在網站自己的內容裡用關鍵字找答案（不呼叫任何外部 AI），回答時附上出處島嶼，並可一鍵前往。',
    resume: '接關碼：把 localStorage 的進度編碼成一串文字，可複製；在另一台裝置貼上即可接著玩。',
    walkers: '散步的小人：每座島有幾個小人沿著小路走動。',
    residents: '居民對話與交易：點居民會停下來揮手並跳出對話泡泡；沙灘上可以撿貝殼，累積的貝殼可以跟居民交換小禮物（背包中可查看）。',
    skyLife: '天空與海的動態：雲朵飄移、鳥群飛過、帆船繞島、海浪起伏。',
    nightLights: '夜晚燈光：天黑後路燈、窗戶亮起，出現螢火蟲與星星。'
  };

  /* ---------- 文件產生 ---------- */
  function tbl(rows) { return rows.map(r => '| ' + r.join(' | ') + ' |').join('\n'); }
  function md(s) { return String(s == null ? '' : s).replace(/\|/g, '／').replace(/\n/g, ' '); }
  function slugOf(S) { return S.meta.slug || U.slug(S.meta.name); }

  function readList(S, t) {
    const a = ['`spec/00_總覽.md`：網站是什麼、給誰用', '`spec/01_島型玩法.md`：「' + t.name + '」的互動規則（最重要）', '`spec/02_島嶼內容.md`：每座島要放的文字（也在 `data/project.json`、`data/islands.csv`）', '`spec/03_外觀.md`、`spec/04_配色.md`：風格、島形、動物、點綴、運鏡、配色', '`spec/05_功能.md`：要做與不要做的功能'];
    if (S.rpg) a.push('`spec/06_RPG模式.md`：RPG 冒險模式');
    if (S.life) a.push('`spec/07_生活感.md`：生活感模式');
    a.push('`spec/08_資料與檔案.md`、`spec/09_技術與品質.md`、`spec/10_部署.md`', '最後用 `CHECKLIST.md` 逐項自我檢查');
    return a;
  }
  function buildDocs(S, files) {
    const t = D.TYPES[S.type];
    const named = S.islands.filter(i => (i.name || '').trim());
    const docs = {};
    const date = U.today();
    const lang = D.LANGS[S.meta.lang] || '繁體中文';
    const filesOf = id => files.filter(f => f.isle === id);

    docs['AGENTS.md'] = `# 造島包：${S.meta.name}

> 這是用「群島製圖所」產生的網站規格包（${date}）。請依照這份規格，從零開始做一個 **3D 島嶼網站**。

## 你的任務
把 \`data/project.json\` 與 \`spec/\` 描述的內容，做成一個可以在瀏覽器裡逛的 3D 群島網站：中間一座大島，周圍 ${named.length} 座小島，每座島代表一個內容單元。網站放在 \`site/\` 資料夾。

## 請依序閱讀
${readList(S, t).map((x, n) => (n + 1) + '. ' + x).join('\n')}

## 不能違反的規則
- **純靜態網站**：只用 HTML、CSS、JavaScript，不需要伺服器、資料庫或任何 API 金鑰。
- **3D 用 Three.js**，固定版本號；可以用 CDN，但也請把函式庫複製一份放在 \`site/\` 裡，確保離線也能開。
- **所有 3D 造型都要原創**：島嶼、建築、樹、動物、角色全部用程式（幾何體組合）繪製，不要下載或複製別人的模型、圖片、網站程式碼。
- **內容只用使用者提供的資料**：\`project.json\`、\`files/\` 裡的檔案${S.sources ? '，以及 `spec/08_資料與檔案.md` 列出的公開網址' : ''}。資料不夠時可以補充合理的示意文字，但要在畫面上標示「示意」。
- **介面語言：${lang}**。
- 進度存在 \`localStorage\`，讀寫都要用 try/catch 包起來，存不了也不能壞掉。
- 手機、平板、電腦都要好用；觸控可以旋轉與縮放。
- 偵測不到 WebGL 時，自動改用文字清單呈現全部內容。

## 工作流程
1. 讀完上面所有文件，先在心裡規劃檔案結構與元件。
2. 在 \`site/\` 建立網站。建議結構：\`index.html\`、\`css/\`、\`js/\`、\`lib/\`（Three.js）、\`files/\`（從造島包的 \`files/\` 複製需要的檔案）。
3. 用本機伺服器（例如 \`npx serve site\` 或 \`python -m http.server\`）開起來，自己操作每座島、每個功能。
4. 對照 \`CHECKLIST.md\` 逐項檢查並修正問題。
5. 部署：${DEPLOY[S.deploy] ? DEPLOY[S.deploy].line : DEPLOY.ask.line}
6. 有不確定的地方，先用合理的預設完成，最後一次列出給使用者確認。
${S.notes ? `\n## 使用者的補充說明\n${S.notes}\n` : ''}`;

    docs['CLAUDE.md'] = '# 給 Claude Code\n\n請先完整閱讀 `AGENTS.md`，那裡有全部的規則與流程。\n';
    docs['GEMINI.md'] = '# 給 Gemini\n\n請先完整閱讀 `AGENTS.md`，那裡有全部的規則與流程。\n';

    docs['spec/00_總覽.md'] = `# 總覽

| 項目 | 內容 |
|---|---|
| 網站名稱 | ${md(S.meta.name)} |
| 一句話介紹 | ${md(S.meta.tagline)} |
| 網址代號 | ${md(slugOf(S))} |
| 目標對象 | ${md(S.meta.audience || '一般大眾')} |
| 作者／單位 | ${md(S.meta.author)} |
| 聯絡方式 | ${md(S.meta.contact)} |
| 吉祥物 | ${md(S.meta.mascot)}${S.meta.mascotLook ? '：' + md(S.meta.mascotLook) : ''} |
| 介面語言 | ${lang} |
| 島型 | ${t.icon} ${t.name}${S.rpg ? '＋RPG 冒險模式' : ''}${S.life ? '＋生活感模式' : ''} |
| 島嶼數 | 中央島 1 座＋周圍 ${named.length} 座 |

## 畫面結構
- 全螢幕 3D 群島，可拖曳旋轉、滾輪或雙指縮放、右鍵或 Shift 拖曳平移。
- 每座島上方有名稱標籤（編號＋島名），點島或標籤 → 鏡頭飛到該島，並打開內容面板（電腦在右側、手機在下方）。
- 頂部：網站名稱（點了回到全景）、搜尋、工具按鈕。手機上工具收進選單。
- 底部：所有島的快速導覽列。
- 第一次進站顯示歡迎畫面：網站名稱、介紹、作者、${S.meta.mascot ? '吉祥物打招呼、' : ''}操作說明、「開始探索」按鈕。
${S.meta.mascotLook ? `\n## 吉祥物\n「${S.meta.mascot || '吉祥物'}」：${S.meta.mascotLook}。請原創繪製，可出現在歡迎畫面、小嚮導與 3D 場景中。\n` : ''}`;

    docs['spec/01_島型玩法.md'] = `# 島型玩法：${t.icon} ${t.name}

${t.desc}

- 每座島的單位：**${t.isle}**
- 中央島：**${S.center.name || t.centerName}**——${t.centerRole}
${S.center.note ? `- 中央島補充：${S.center.note}\n` : ''}${(t.center || []).map(f => `- ${f.label}：${f.kind === 'select' ? U.optLabel((f.options.find(o => U.optVal(o) === (S.center.extra || {})[f.k]) || f.options[0])) : ((S.center.extra || {})[f.k] || '（未填）').replace(/\n/g, '；')}`).join('\n')}

## 互動規則
${TYPE_SPEC[S.type].map(x => '- ' + x).join('\n')}

## 每座島的專屬欄位
${t.fields.map(f => `- **${f.label}**${f.cols ? '（每行：' + f.cols.join('｜') + '）' : f.kind === 'lines' ? '（一行一項）' : ''}`).join('\n')}

## 通用欄位
- 內容重點：用「；」分隔的多個重點。
- 測驗題：一行一題，格式「題目｜正確答案｜錯誤1｜錯誤2｜錯誤3」。
- 連結：一行一個，格式「名稱｜網址」。
`;

    const isleMd = (i, k) => {
      const ex = i.extra || {};
      const lines = [`## ${String(k + 1).padStart(2, '0')}　${i.name}`, ''];
      if (i.intro) lines.push(`**一句介紹**：${i.intro}`, '');
      if (i.category) lines.push(`- 分類：${i.category}`);
      if (i.goal) lines.push(`- 學習目標：${i.goal}`);
      const pts = U.splitList(i.points);
      if (pts.length) lines.push('', '**內容重點**', ...pts.map(p => '- ' + p));
      const simple = [];
      t.fields.forEach(f => {
        const v = ex[f.k]; if (!v) return;
        if (f.kind === 'lines' && f.cols) lines.push('', `**${f.label}**`, '', tbl([f.cols, f.cols.map(() => '---')].concat(U.rows(v, f.cols.length).map(r => r.slice(0, f.cols.length).map(md)))));
        else if (f.kind === 'lines') lines.push('', `**${f.label}**`, ...U.lines(v).map(x => '- ' + x));
        else if (f.kind === 'textarea') lines.push('', `**${f.label}**`, '', v);
        else simple.push(`- ${f.label}：${f.kind === 'select' ? U.optLabel((f.options.find(o => U.optVal(o) === v) || v)) : v}`);
      });
      if (simple.length) lines.push('', '**設定**', ...simple);
      const qz = U.parseQuiz(i.quiz);
      if (qz.length) lines.push('', '**測驗題**', ...qz.map((q, n) => `${n + 1}. ${q.q}　✔ ${q.a}${q.wrong.length ? '　✘ ' + q.wrong.join('、') : ''}`));
      const ln = U.parseLinks(i.links);
      if (ln.length) lines.push('', '**連結**', ...ln.map(l => `- [${l.name}](${l.url})`));
      const fs = filesOf(i.id);
      if (fs.length) lines.push('', '**這座島的檔案**', ...fs.map(f => `- \`files/${f.path}\``));
      return lines.join('\n');
    };
    docs['spec/02_島嶼內容.md'] = `# 島嶼內容

完整資料也在 \`data/project.json\`（請以它為準）與 \`data/islands.csv\`。

## ★　${S.center.name || t.centerName}（中央島）
${S.center.note || t.centerRole}
${filesOf('shared').length ? `\n全站共用檔案：\n${filesOf('shared').map(f => `- \`files/${f.path}\``).join('\n')}\n` : ''}
${named.map(isleMd).join('\n\n---\n\n')}
`;

    const st = D.STYLES[S.style], sh = D.SHAPES[S.shape], dt = D.DETAIL.find(d => d.v === S.detail) || D.DETAIL[2];
    docs['spec/03_外觀.md'] = `# 外觀

## 視覺風格：${st.name}
${st.desc}。所有材質、光影、描邊都要統一在這個風格裡。

## 島的形狀：${sh.icon} ${sh.name}
${sh.desc}。
- 中央島比周圍的島大；周圍的島${S.type === 'portfolio' ? '依時間順序沿著螺旋線排列，前後用橋連接' : '平均圍成一圈（超過 8 座時排成內外兩圈）'}。
${S.shape === 'float' ? '- 浮空島底部是倒錐形岩層，島與島用吊橋相連，下方是緩慢起伏的雲海。\n' : ''}${S.shape === 'volcano' ? '- 火山放在中央島一側，口部有岩漿微光與持續冒出的煙。\n' : ''}${S.shape === 'atoll' ? '- 外圍有一圈環形沙洲與棕櫚樹，圈內是淺藍色潟湖。\n' : ''}
## 精緻度：${'★'.repeat(dt.v)} ${dt.name}
${dt.desc}。
- ★ 簡潔：島＋少數樹。
- ★★ 標準：加上房子、樹叢、碼頭。
- ★★★ 精緻：加上小路、圍籬、花叢、路燈、長椅、木箱等小道具。
- ★★★★ 極致：再加上更多建築、石頭與浪花細節。

## 島上的動物
${S.animals.length ? S.animals.map(k => `- ${D.ANIMALS[k].icon} ${D.ANIMALS[k].name}`).join('\n') : '（不放動物）'}

動物要有簡單的動作：陸地動物在島上走動、兔子小雞會跳、鴨子在岸邊游、海豚跳出水面、鯨魚浮沉、海鷗盤旋、蝴蝶在花叢飛、螃蟹在沙灘橫走。點動物會出現小小的反應。

## 地景點綴
${S.extras.length ? S.extras.map(k => `- ${D.EXTRAS[k].icon} ${D.EXTRAS[k].name}`).join('\n') : '（不加點綴）'}

## 鏡頭運鏡：${D.CINEMA[S.cinema].icon} ${D.CINEMA[S.cinema].name}
${D.CINEMA[S.cinema].desc}。點島時鏡頭平順飛到該島；提供「回到全景」與「重播開場」按鈕。開啟「減少動態」時一律改成直接切換。

## 字體：${D.FONTS[S.font].name}
${D.FONTS[S.font].desc}。字體優先使用系統內建字（${D.FONTS[S.font].css}），不要依賴外部字型服務也能正常顯示。
`;

    const th = S.theme, order = th.order || ['day', 'dusk', 'night'];
    docs['spec/04_配色.md'] = `# 配色

## 三組網頁底色（訪客可以切換）
${tbl([['順序', '名稱', '色碼'], ['---', '---', '---']].concat(order.map((k, n) => { const s = D.THEME_SLOTS.find(x => x.k === k); return [n === 0 ? '1（預設）' : String(n + 1), s.icon + ' ' + s.name, th[k]]; })))}

- 3D 場景後方的背景與霧氣使用目前的底色，讓島像擺在桌上的模型。
- ${th.auto ? '**自動切換**：依 3D 場景中的時間，白天用「晴空」、黃昏用「暮色」、夜晚用「星夜」；訪客手動選了某一組，就照訪客的選擇並記住。' : '不自動切換，預設使用第一組，訪客可以手動切換並記住。'}
- 深色底色時，文字與面板自動改成淺色。

## 主色與強調色
- 主色：${th.primary}（按鈕、標籤編號、標題）
- 強調色：${th.accent}（重點、進度、提示）

## 對比
所有文字與背景的對比至少達到 WCAG AA（一般文字 4.5:1）。
`;

    const feats = S.features.filter(f => FEATURE_SPEC[f]);
    const off = D.FEATURES.filter(f => !S.features.includes(f.id));
    docs['spec/05_功能.md'] = `# 功能

## 必備
- 自適應版面：電腦、平板、手機都好用。
- 鍵盤可以操作所有按鈕；對話框可以用 Esc 關閉；所有圖示按鈕都有文字標籤（aria-label）。
- 不做 PWA（不需要安裝到桌面或離線快取）。

## 要做的功能
${feats.map(f => '- ' + FEATURE_SPEC[f]).join('\n') || '（無）'}

## 不要做的功能
${off.map(f => '- ' + f.name).join('\n') || '（無）'}
`;
    if (S.rpg) docs['spec/06_RPG模式.md'] = `# RPG 冒險模式

把「${t.name}」變成小型冒險遊戲：
- **建立冒險者**：第一次進站輸入名字，畫面左上顯示「Lv.等級 名字」與經驗值條。
- **角色移動**：3D 小人站在島上，方向鍵／WASD 依鏡頭方向移動，點島面會走過去；點其他島會坐小船（浮空島則走吊橋）移動過去。鏡頭跟著角色。
- **島民**：每座島有一位 NPC，頭上有發光的提示記號。靠近時出現「和○○說話（E）」按鈕；對話內容取自該島的介紹與重點${S.type === 'quest' ? '或 NPC 台詞' : ''}。
- **經驗值**：第一次到島 +5、第一次對話 +10、測驗依答對比例最多 +30；每 100 點升一級，升級時跳出提示。
- **島章**：通過該島試煉（測驗 60% 以上；沒有題目的島則和島民說完話即可領取）得到島章。
- **最終挑戰**：集滿所有島章後，在中央島挑戰從全部題目抽出的魔王戰，通過即可領「冒險證書」。
`;
    if (S.life) docs['spec/07_生活感.md'] = `# 生活感模式

讓島「活起來」：
- 居民沿著小路散步，點了會停下來揮手，跳出對話泡泡（每位居民一句不同的話）。
- 沙灘上散落貝殼，點了撿起來（顯示 +1），一段時間後會在別處重新出現。
- 「居民交換所」：用貝殼交換小禮物（花、冰淇淋、明信片、風箏、燈籠、羅盤……），放進背包。
- 天上有雲與鳥群，海上有帆船繞島，海浪起伏。
- 天色會自動循環：白天陽光、黃昏變橘紅、夜晚路燈與窗戶亮起、滿天星星與螢火蟲。訪客也可以手動切換。
`;
    docs['spec/08_資料與檔案.md'] = `# 資料與檔案

## 使用者放進來的檔案
${files.length ? `共 ${files.length} 個，放在 \`files/\`，依資料夾對應到島：\n\n${tbl([['檔案', '對應', '大小'], ['---', '---', '---']].concat(files.map(f => { const k = S.islands.findIndex(i => i.id === f.isle); return ['`files/' + f.path + '`', k < 0 ? '共用' : S.islands[k].name, Math.round(f.size / 1024) + ' KB']; })))}` : '沒有放檔案。請依 `project.json` 的文字撰寫，資料不足的地方補上示意內容並標示「示意」。'}

## 怎麼使用這些檔案
- 讀懂內容後，**改寫**成適合網頁閱讀的短段落、重點、題目，放進對應的島。不要整份貼上。
- 圖片可以放進該島的相簿。
- ${S.allowDownload ? '**允許公開原檔**：在對應的島放「下載」連結，把檔案複製到 `site/files/`。' : '**不要公開原檔**：只把內容改寫進網頁，原始檔案不要放進 `site/`（圖片可以縮小後當插圖）。'}
${S.sources ? `\n## 請上網整理的公開資料\n${U.lines(S.sources).map(u => '- ' + u).join('\n')}\n\n規則：\n- 只讀公開頁面；遵守網站的 robots.txt 與使用條款，請求之間放慢速度。\n- 內容改寫成摘要，不要大段照抄；每段內容附上來源網址與查詢日期（${date}）。\n- 不抓個人資料、不下載圖片。需要登入的頁面一律跳過。\n` : ''}`;

    docs['spec/09_技術與品質.md'] = `# 技術與品質

- 純靜態：\`site/index.html\` 可以直接放到任何靜態空間；所有路徑用相對路徑。
- Three.js 固定版本，並在 \`site/lib/\` 放一份；相機控制可自行實作（拖曳旋轉、滾輪與雙指縮放、平移）。
- 效能：一般筆電要流暢（目標 60fps，最低 30fps）；精緻度高時可共用幾何體與材質；分頁隱藏時暫停動畫；裝置像素比最多 2。
- 3D 物件要能點擊（Raycaster）：島、寶箱、怪獸、居民、貝殼、建築等。
- 島嶼名稱標籤用 HTML 疊在畫面上，隨鏡頭移動，被擋住或在畫面外時隱藏。
- 隨機擺放要用固定種子（例如網址代號＋島嶼編號），每次重新整理位置都一樣。
- localStorage 的鍵名用 \`${slugOf(S)}:\` 開頭；讀寫用 try/catch。
- 無障礙：對比足夠、可以只用鍵盤操作、文字清單模式、尊重「減少動態」。
- 不追蹤使用者、不放廣告、不載入不必要的第三方服務。
`;
    const dp = DEPLOY[S.deploy] || DEPLOY.ask;
    docs['spec/10_部署.md'] = `# 部署

使用者選擇：**${dp.name}**

${dp.line}

- 部署的是 \`site/\` 資料夾。
- 網址建議使用代號 \`${slugOf(S)}\`（例如 ${slugOf(S)}.netlify.app），被占用時換一個相近的並告訴使用者。
- 部署完成後，把網址、之後要怎麼更新內容，用簡單的話告訴使用者。
`;

    const checks = [
      '雙擊或用本機伺服器打開 `site/index.html` 都沒有錯誤（瀏覽器主控台沒有紅字）',
      `中央島＋${named.length} 座島都看得到，名稱標籤正確`,
      '點每一座島：鏡頭飛過去、面板內容正確、可以關閉',
      '島型玩法（spec/01）每一條規則都做到了',
      ...feats.map(f => FEATURE_SPEC[f].split('：')[0] + ' 可以正常使用'),
      S.rpg ? 'RPG：建角、移動、對話、經驗值、島章、最終挑戰、證書都可以完成' : null,
      S.life ? '生活感：居民對話、撿貝殼、交換、天色循環都正常' : null,
      `外觀符合：${st.name}、${sh.name}、精緻度 ${dt.name}、選定的動物與點綴都在`,
      '三組底色可以切換；深色底色時文字清楚',
      '手機寬度（390px）下：可以旋轉縮放、面板從下方出現、工具在選單裡',
      '關掉 WebGL 或在不支援的瀏覽器時，會改用文字清單',
      '「減少動態」打開後沒有動畫',
      '重新整理後進度還在；清除進度可以用',
      '所有連結都能打開；沒有使用者沒提供的假連結',
      '沒有使用任何別人的圖片、模型或程式碼'
    ].filter(Boolean);
    docs['CHECKLIST.md'] = `# 完成前自我檢查\n\n${checks.map(c => '- [ ] ' + c).join('\n')}\n`;

    // 給人看的說明
    const ai = AI[S.ai] || AI.other;
    docs['START_HERE.md'] = `# 從這裡開始：${S.meta.name}

這是你在「群島製圖所」產生的造島包。接下來請 AI 幫你把網站蓋出來。

## 步驟
1. 把這個 ZIP **解壓縮**到一個好找的地方（例如桌面）。
2. 打開 **${ai.name}**：${ai.how}
3. 把 \`給AI的指令.txt\` 裡的文字**整段貼上**，送出。
4. AI 會讀規格、寫程式、自己測試。過程中它可能會問你問題或請你確認，照實回答就好。
5. 做完後，${dp.name === '先不上架' ? 'AI 會告訴你怎麼在電腦上打開網站。' : `AI 會${S.deploy === 'ask' ? '問你要放到哪個網站' : '把網站放到 ' + dp.name}，最後給你網址。`}

## 之後想修改
回到群島製圖所改資料，在步驟 6 勾「這是更新」，下載新的造島包，再交給 AI 就可以了。

## 小提醒
- 造島包裡的檔案都留在你的電腦，只有你交給 AI 工具時才會被讀取。
- AI 做出來的網站請自己看一遍內容是否正確。
`;
    return docs;
  }

  function promptText(S, isUpdate) {
    const dp = DEPLOY[S.deploy] || DEPLOY.ask;
    if (isUpdate) return `你好！這是「${S.meta.name}」的更新包。網站之前已經做好了。

1. 先讀 UPDATE.md，了解這次要改哪些地方；需要時再參考 AGENTS.md 與 spec/。
2. 在原本的網站上修改（如果你看不到原本的網站，請先問我放在哪裡），只改 UPDATE.md 列出的部分，不要整個重做。
3. 改完在本機打開測試，確認沒有弄壞其他功能，並對照 CHECKLIST.md 檢查。
4. ${dp.line}
有不確定的地方，先用合理的方式完成，最後一起列給我確認。`;
    return `你好！這個資料夾是一份「造島包」，請你幫我做一個 3D 島嶼網站「${S.meta.name}」。

1. 先完整閱讀 AGENTS.md，再依序讀 spec/ 裡的文件和 data/project.json。
2. 照規格在 site/ 資料夾裡把網站做出來，3D 場景全部用程式原創繪製。
3. 做完後在本機打開自己測試每座島、每個功能，對照 CHECKLIST.md 逐項檢查並修正。
4. ${dp.line}
有不確定的地方，先用合理的方式完成，最後一起列給我確認。`;
  }

  function csv(S) {
    const t = D.TYPES[S.type];
    const head = ['編號', '島名', '一句介紹', '分類', '學習目標', '內容重點', '連結', '測驗題'].concat(t.fields.map(f => f.label));
    const q = v => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
    const rows = S.islands.filter(i => (i.name || '').trim()).map((i, k) => [k + 1, i.name, i.intro, i.category, i.goal, i.points, i.links, i.quiz].concat(t.fields.map(f => (i.extra || {})[f.k] || '')));
    return '﻿' + [head].concat(rows).map(r => r.map(q).join(',')).join('\r\n');
  }

  /* ---------- 更新模式：比對 ---------- */
  function diff(a, b) {
    if (!a) return [];
    const out = [];
    const cmp = (label, x, y) => { if (JSON.stringify(x) !== JSON.stringify(y)) out.push(`${label}：${short(x)} → ${short(y)}`); };
    const short = v => { const s = Array.isArray(v) ? v.join('、') : typeof v === 'object' && v ? JSON.stringify(v) : String(v == null ? '' : v); return s.length > 40 ? s.slice(0, 40) + '…' : (s || '（空白）'); };
    if (a.type !== b.type) out.push(`島型：${(D.TYPES[a.type] || {}).name} → ${D.TYPES[b.type].name}`);
    cmp('RPG 模式', !!a.rpg, !!b.rpg); cmp('生活感模式', !!a.life, !!b.life);
    ['name', 'tagline', 'slug', 'audience', 'author', 'contact', 'mascot', 'mascotLook', 'lang'].forEach(k => cmp('基本資料・' + k, (a.meta || {})[k], b.meta[k]));
    cmp('中央島名稱', (a.center || {}).name, b.center.name); cmp('中央島說明', (a.center || {}).note, b.center.note);
    const aIs = (a.islands || []).filter(i => i.name), bIs = b.islands.filter(i => i.name);
    bIs.forEach(i => { const o = aIs.find(x => x.id === i.id); if (!o) out.push(`新增島嶼：${i.name}`); else { ['name', 'intro', 'category', 'goal', 'points', 'links', 'quiz'].forEach(k => cmp(`「${i.name}」・${k}`, o[k], i[k])); Object.keys(Object.assign({}, o.extra, i.extra)).forEach(k => cmp(`「${i.name}」・${k}`, (o.extra || {})[k], (i.extra || {})[k])); } });
    aIs.forEach(o => { if (!bIs.find(x => x.id === o.id)) out.push(`刪除島嶼：${o.name}`); });
    const order = arr => arr.map(i => i.id).join(',');
    if (order(aIs.filter(o => bIs.find(x => x.id === o.id))) !== order(bIs.filter(i => aIs.find(x => x.id === i.id)))) out.push('島嶼順序有調整');
    cmp('視覺風格', a.style, b.style); cmp('島形', a.shape, b.shape); cmp('精緻度', a.detail, b.detail); cmp('字體', a.font, b.font); cmp('運鏡', a.cinema, b.cinema);
    cmp('動物', a.animals, b.animals); cmp('點綴', a.extras, b.extras); cmp('配色', a.theme, b.theme);
    const fa = a.features || [], fb = b.features;
    fb.filter(f => !fa.includes(f)).forEach(f => out.push('新增功能：' + (D.FEATURES.find(x => x.id === f) || { name: f }).name));
    fa.filter(f => !fb.includes(f)).forEach(f => out.push('移除功能：' + (D.FEATURES.find(x => x.id === f) || { name: f }).name));
    return out;
  }
  function baseline() { if (Kit._baseline) return Kit._baseline; try { return JSON.parse(localStorage.getItem(LAST) || 'null'); } catch (e) { return null; } }

  /* ---------- 打包 ---------- */
  async function buildZip(St) {
    const S = St.state();
    const files = St.files();
    const proj = St.projectData();
    const up = S.update || {};
    const isUpdate = !!up.on;
    const docs = buildDocs(S, files);
    const z = new JSZip();
    const top = z.folder(`${S.meta.slug || U.slug(S.meta.name)}-造島包`);
    Object.keys(docs).forEach(k => top.file(k, docs[k]));
    top.file('data/project.json', JSON.stringify(proj, null, 2));
    top.file('data/islands.csv', csv(S));
    top.file('給AI的指令.txt', promptText(S, isUpdate));
    top.folder('site');
    top.file('site/請AI把網站做在這裡.txt', '這個資料夾一開始是空的，AI 會把網站做在這裡。\n');
    files.forEach(f => top.file('files/' + f.path, f.blob));
    if (isUpdate) {
      const ch = diff(baseline(), proj);
      const kinds = (up.kinds || []).map(k => (UPDATE_KINDS.find(x => x[0] === k) || [k, k])[1]);
      top.file('UPDATE.md', `# 這次的更新（${U.today()}）\n\n## 更新類型\n${kinds.map(k => '- ' + k).join('\n') || '- （未勾選）'}\n\n## 使用者的說明\n${up.desc || '（未填）'}\n\n## 表單自動比對出的變更\n${ch.length ? ch.map(c => '- ' + c).join('\n') : '- 沒有偵測到表單資料的變化（可能只是要修正問題）'}\n\n## 做法\n- 在既有網站上修改，不要重做；保留原本的程式架構與訪客進度格式（localStorage 鍵名不變）。\n- 新的完整資料在 \`data/project.json\`；新增或修改的檔案在 \`files/\`。\n- 改完後依 CHECKLIST.md 檢查，確認沒有弄壞其他功能。\n`);
      top.file('CHANGELOG.md', `# 更新紀錄\n\n## ${U.today()}\n${(up.desc || '').split('\n').map(l => '- ' + l).join('\n')}\n${ch.map(c => '- ' + c).join('\n')}\n`);
    }
    const blob = await z.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } });
    try { localStorage.setItem(LAST, JSON.stringify(proj)); } catch (e) { /* 存不下就算了 */ }
    return blob;
  }

  /* ---------- 步驟 6 畫面 ---------- */
  function step6Html(o) {
    const S = o.S;
    S.update = S.update || { on: false, kinds: [], desc: '' };
    const up = S.update;
    const base = baseline();
    const ch = up.on ? diff(base, ISLE.Studio.projectData()) : [];
    return `<h2>下載造島包</h2><p class="hint">造島包是一個 ZIP，裡面有給 AI 看的規格、你的資料與檔案。交給 AI 工具，它就會幫你把網站蓋出來。</p>
      ${o.sum}${o.issueHtml}
      <h3>你用哪個 AI 來蓋島？</h3><div class="choice-grid">${Object.keys(AI).map(k => `<button type="button" class="choice ${S.ai === k ? 'on' : ''}" data-a="kitAi" data-v="${k}">${AI[k].name}</button>`).join('')}</div>
      <h3>想放到哪個網站？</h3><div class="choice-grid">${Object.keys(DEPLOY).map(k => `<button type="button" class="choice ${S.deploy === k ? 'on' : ''}" data-a="kitDeploy" data-v="${k}">${DEPLOY[k].name}</button>`).join('')}</div>
      <h3>還有什麼要跟 AI 說的？</h3>${o.field('補充說明（選填）', 'notes', { kind: 'textarea', rows: 3, ph: '例如：首頁要放學校 Logo；題目請用國小三年級看得懂的字' })}
      <div class="update-box"><label class="check"><input type="checkbox" data-kit="upOn" ${up.on ? 'checked' : ''}> <b>這是更新</b>（之前已經請 AI 做過網站，這次要修改）</label>
        ${up.on ? `<p class="mini">比對基準：${base ? '上次下載的造島包（' + esc((base._saved || '').slice(0, 10)) + '）' : '還沒有基準'}　<label class="linkb">改用舊的 project.json<input type="file" accept=".json" data-kit="base" hidden></label></p>
        <div class="chips">${UPDATE_KINDS.map(([k, n]) => `<label class="chipb ${up.kinds.includes(k) ? 'on' : ''}"><input type="checkbox" hidden data-kit="kind" data-v="${k}" ${up.kinds.includes(k) ? 'checked' : ''}>${n}</label>`).join('')}</div>
        <label class="fld"><span>這次要改什麼？<i class="req">*</i></span><textarea rows="3" data-kit="desc" placeholder="用自己的話寫，例如：第三課的測驗題換新的；夜晚模式字太暗">${esc(up.desc)}</textarea></label>
        ${ch.length ? `<p class="mini">造島工坊比對出的變更（會一起交給 AI）：</p><ul class="diff">${ch.map(c => `<li>${esc(c)}</li>`).join('')}</ul>` : `<p class="mini muted">${base ? '目前表單和基準沒有差異。' : ''}</p>`}` : ''}
      </div>
      <div class="big-actions"><button type="button" class="sbtn coral big" data-a="kitDownload" ${o.issues.length ? 'disabled' : ''}>⬇ 下載造島包</button><button type="button" class="sbtn ghost big" data-a="kitCopy">📋 複製給 AI 的指令</button></div>
      <div class="kit-done" hidden></div>`;
  }

  const Kit = {
    step6Html, buildDocs, promptText, diff,
    actions: {
      kitAi: (b, St) => { St.state().ai = b.dataset.v; St.save(); St.render(); },
      kitDeploy: (b, St) => { St.state().deploy = b.dataset.v; St.save(); St.render(); },
      kitCopy: (b, St) => { const S = St.state(); const t = promptText(S, S.update && S.update.on); (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(() => St.toast('指令已複製，貼到 AI 工具就可以了'), () => St.modal(`<h2>給 AI 的指令</h2><p class="hint">請手動選取複製：</p><div class="prompt-box">${esc(t)}</div>`)); },
      kitDownload: async (b, St) => {
        const S = St.state();
        if (S.update && S.update.on && !(S.update.desc || '').trim()) { St.toast('請寫下這次要更新什麼'); return; }
        b.disabled = true; b.textContent = '打包中…';
        try {
          const blob = await buildZip(St);
          St.saveBlob(blob, `${S.meta.slug || U.slug(S.meta.name)}-造島包${S.update && S.update.on ? '-更新' : ''}.zip`);
          const ai = AI[S.ai] || AI.other;
          const box = document.querySelector('.kit-done');
          box.hidden = false;
          box.innerHTML = `<div class="done-box"><h3>🎉 造島包下載好了！接下來：</h3><ol><li>把 ZIP 解壓縮。</li><li>${esc(ai.how)}</li><li>貼上下面這段指令（也在造島包裡的「給AI的指令.txt」）。</li><li>AI 測試好以後${S.deploy === 'ask' ? '會問你要放到哪個網站，回答它就好' : S.deploy === 'local' ? '會告訴你怎麼在電腦上打開' : '會部署到 ' + DEPLOY[S.deploy].name + ' 並給你網址'}。</li></ol><div class="prompt-box">${esc(promptText(S, S.update && S.update.on))}</div><div class="row-end"><button type="button" class="sbtn small" data-a="kitCopy">📋 複製指令</button></div></div>`;
          box.scrollIntoView({ behavior: 'smooth', block: 'start' });
        } catch (e) { St.toast('打包失敗：' + e.message); }
        b.disabled = false; b.textContent = '⬇ 下載造島包';
      }
    },
    onChange(t, St) {
      const S = St.state(); S.update = S.update || { on: false, kinds: [], desc: '' };
      if (t.dataset.kit === 'upOn') { S.update.on = t.checked; St.save(); St.render(); }
      if (t.dataset.kit === 'kind') { const k = t.dataset.v; const a = S.update.kinds; const i = a.indexOf(k); if (t.checked && i < 0) a.push(k); if (!t.checked && i >= 0) a.splice(i, 1); t.parentElement.classList.toggle('on', t.checked); St.save(); }
      if (t.dataset.kit === 'base' && t.files[0]) { const rd = new FileReader(); rd.onload = () => { try { Kit._baseline = JSON.parse(rd.result); St.toast('已改用這份 project.json 當比對基準'); St.render(); } catch (e) { St.toast('讀不懂這個檔案'); } }; rd.readAsText(t.files[0]); }
    },
    onInput(t, St) { if (t.dataset.kit === 'desc') { const S = St.state(); S.update.desc = t.value; St.save(); } }
  };
  ISLE.Kit = Kit;
})();
