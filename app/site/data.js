/* 群島製圖所：共用資料表（表單與產生出來的網站都會用到） */
(function () {
  const ISLE = (window.ISLE = window.ISLE || {});

  /* ---------- 12 種島型 ---------- */
  // fields：每座島專屬的欄位。kind = text | textarea | select | lines（多行，每行用｜分欄）
  const TYPES = {
    course: {
      name: '課程群島', icon: '📘', isle: '課',
      desc: '每一課是一座島：重點整理、學習單與隨堂測驗；中間的大島負責總複習。',
      fit: '各科教學、補救教學、職能訓練',
      centerName: '總複習島',
      centerRole: '從每一課的題目隨機抽題做跨課測驗，並顯示所有課的學習進度。',
      fields: [
        { k: 'worksheet', label: '學習單題目', kind: 'lines', hint: '一行一題，訪客可以在網頁上作答並列印' }
      ],
      features: ['search', 'list', 'progress', 'quiz', 'cert', 'daynight', 'reduceMotion', 'guide', 'resume']
    },
    life: {
      name: '個人品牌島', icon: '🏡', isle: '地點',
      desc: '把作品、課程、服務和生活興趣，各自變成一個可以逛進去的地點。',
      fit: '老師、接案者、工作室、社團、學校處室',
      centerName: '中央廣場',
      centerRole: '主人的自我介紹、聯絡方式，以及前往每個地點的總覽地圖。',
      fields: [
        { k: 'kind', label: '這個地點是', kind: 'select', options: ['作品', '課程', '服務', '興趣', '生活', '聯絡'] },
        { k: 'cta', label: '行動按鈕文字', kind: 'text', ph: '例如：預約諮詢、看完整作品' }
      ],
      features: ['search', 'list', 'progress', 'daynight', 'clock', 'share', 'reduceMotion', 'walkers', 'skyLife']
    },
    treasure: {
      name: '尋寶收集島', icon: '🗝️', isle: '寶箱',
      desc: '每座島有一個寶箱，用每日鑰匙打開抽知識卡，集滿圖鑑；答對小測驗可以多拿鑰匙。',
      fit: '工具圖鑑、單字卡、知識卡收藏',
      centerName: '寶物總部',
      centerRole: '圖鑑總覽、收集進度與每日鑰匙領取處。',
      fields: [
        { k: 'cards', label: '知識卡', kind: 'lines', cols: ['卡名', '說明'], hint: '一行一張：卡名｜說明' }
      ],
      features: ['search', 'list', 'progress', 'quiz', 'keys', 'codex', 'share', 'reduceMotion', 'resume']
    },
    local: {
      name: '地方導覽島', icon: '🧭', isle: '區域',
      desc: '每個區域一座島：地標、美食、景點和在地故事，小嚮導可以回答訪客的問題。',
      fit: '鄉鎮介紹、校園導覽、社區走讀',
      centerName: '旅客服務中心',
      centerRole: '整個地區的總覽、探索護照與小嚮導入口。',
      fields: [
        { k: 'spots', label: '景點與美食', kind: 'lines', cols: ['名稱', '說明'], hint: '一行一個：名稱｜說明' },
        { k: 'story', label: '在地故事', kind: 'textarea' }
      ],
      features: ['search', 'list', 'progress', 'guide', 'daynight', 'clock', 'share', 'reduceMotion', 'walkers', 'skyLife']
    },
    expo: {
      name: '展覽活動島', icon: '🎪', isle: '展區',
      desc: '每個展區一座島：作品、攤位和活動時程，逛完一區蓋一個章。',
      fit: '成果發表、校慶園遊會、節慶活動',
      centerName: '活動服務台',
      centerRole: '活動總覽、全場時程表、展區地圖與集章進度。',
      fields: [
        { k: 'schedule', label: '活動時程', kind: 'lines', cols: ['時間', '活動'], hint: '一行一場：時間｜活動' },
        { k: 'booths', label: '作品或攤位', kind: 'lines', cols: ['名稱', '說明'] }
      ],
      features: ['search', 'list', 'progress', 'clock', 'share', 'reduceMotion', 'walkers', 'nightLights']
    },
    science: {
      name: '現象探究島', icon: '🔭', isle: '觀念步驟',
      desc: '每座島是理解現象的一個步驟；中央是可以拉滑桿、開關圖層的互動觀測台。',
      fit: '月相、四季晝長、時區、季風等會變化的現象',
      centerName: '互動觀測台',
      centerRole: '可操作的現象模擬（滑桿、圖層開關、播放／暫停），並依序帶領看完每一步。',
      fields: [
        { k: 'observe', label: '這一步要觀察什麼', kind: 'textarea' },
        { k: 'simValue', label: '觀測台滑桿位置（0～100）', kind: 'text', ph: '例如 25' }
      ],
      center: [{ k: 'sim', label: '觀測台要模擬的現象', kind: 'select', options: ['moon:月相變化', 'season:四季與晝長', 'timezone:時區與晨昏線', 'monsoon:季風'] }],
      features: ['list', 'progress', 'quiz', 'daynight', 'reduceMotion', 'guide', 'resume']
    },
    live: {
      name: '動態看板島', icon: '📡', isle: '頻道',
      desc: '每個資訊頻道一座島，自動讀取公開試算表或 RSS，把最新消息變成島上的看板。',
      fit: '班級公告、處室消息、社群動態',
      centerName: '總看板',
      centerRole: '各頻道最新一則消息與更新時間的總覽。',
      fields: [
        { k: 'feedType', label: '資料來源', kind: 'select', options: ['manual:只用下面手動填的', 'csv:Google 試算表（發布為 CSV）', 'rss:RSS 網址'] },
        { k: 'feedUrl', label: '來源網址', kind: 'text', ph: 'https://…' },
        { k: 'items', label: '手動或備用動態', kind: 'lines', cols: ['日期', '標題', '連結'], hint: '一行一則：日期｜標題｜連結' }
      ],
      features: ['search', 'list', 'clock', 'daynight', 'reduceMotion', 'share']
    },
    runner: {
      name: '跑酷挑戰島', icon: '🏃', isle: '單元',
      desc: '每個單元一座島，進島就變成三跑道跑酷：吃到正確的、閃開錯誤的，分初中高三級。',
      fit: '倍數質數、詞性分類、快速判斷練習',
      centerName: '挑戰總部',
      centerRole: '選單元與難度，顯示每個單元的最佳成績與通過的難度。',
      fields: [
        { k: 'rule', label: '判斷規則（顯示在畫面上）', kind: 'text', ph: '例如：吃掉 3 的倍數' },
        { k: 'right', label: '要吃的正確項目', kind: 'text', ph: '3；6；9；12（用；分隔）' },
        { k: 'wrong', label: '要閃開的錯誤項目', kind: 'text', ph: '4；7；10；13' }
      ],
      features: ['list', 'progress', 'cert', 'share', 'reduceMotion', 'resume']
    },
    empathy: {
      name: '同理體驗島', icon: '🤝', isle: '情境',
      desc: '每個情境一座島，用第一人稱走過一位學習者的一天，再打開「支持模式」看環境能怎麼幫忙。',
      fit: '特教宣導、融合教育、輔導與同理心課程',
      centerName: '討論教室',
      centerRole: '給帶領者的 45 分鐘流程、討論問題、支持策略整理，以及「這只是部分經驗的模擬」聲明。',
      fields: [
        { k: 'persona', label: '主角（第一人稱）', kind: 'text', ph: '例如：我是小安，聽力比較弱' },
        { k: 'day', label: '一天的經驗', kind: 'lines', cols: ['時間', '我遇到的事', '可以怎麼支持'], hint: '一行一個時刻：時間｜經驗｜支持方式' }
      ],
      center: [{ k: 'questions', label: '討論問題', kind: 'lines', hint: '一行一題' }],
      features: ['list', 'progress', 'reduceMotion', 'daynight']
    },
    literature: {
      name: '文獻知識島', icon: '📚', isle: '主題',
      desc: '每個主題一座島、每篇文獻一棟房子；只放書目、你的筆記和連結，把文獻回顧變成知識城市。',
      fit: '研究所、專題研究、讀書會',
      centerName: '中央圖書館',
      centerRole: '全部文獻的總目錄，可依作者、年份搜尋，並匯出引用格式。',
      fields: [
        { k: 'refs', label: '文獻', kind: 'lines', cols: ['作者', '年份', '篇名', '出處', '我的筆記', '連結'], hint: '一行一篇：作者｜年份｜篇名｜出處｜筆記｜連結' }
      ],
      features: ['search', 'list', 'progress', 'reduceMotion', 'guide', 'daynight']
    },
    portfolio: {
      name: '學習歷程島', icon: '🌱', isle: '經歷',
      desc: '每段經歷一座島，依時間用橋連起來；點開每件「我做了什麼」，就看到用到的能力 +1。',
      fit: '學習歷程檔案、備審、履歷、教師專業成長',
      centerName: '能力總覽塔',
      centerRole: '成長路線圖、每項能力的累計次數，以及反思整理。',
      fields: [
        { k: 'period', label: '時間', kind: 'text', ph: '例如：2025 秋季' },
        { k: 'works', label: '我做了什麼', kind: 'lines', cols: ['事件', '用到的能力'], hint: '一行一件：事件｜能力A、能力B' },
        { k: 'reflect', label: '我的反思', kind: 'textarea' }
      ],
      features: ['list', 'progress', 'share', 'cert', 'reduceMotion', 'daynight']
    },
    quest: {
      name: '闖關冒險島', icon: '⚔️', isle: '關卡',
      desc: '登島和角色對話，答題打倒觀念怪獸，收集印章，最後挑戰中央島領證書。',
      fit: '證照備考、新人訓練、主題闖關',
      centerName: '最終試煉島',
      centerRole: '集滿所有印章後開放的最終挑戰，通過可領取證書。',
      fields: [
        { k: 'npc', label: '島上角色名字', kind: 'text', ph: '例如：燈塔守護者 阿光' },
        { k: 'story', label: '角色台詞', kind: 'lines', hint: '一行一句' },
        { k: 'monster', label: '觀念怪獸名字', kind: 'text', ph: '例如：混淆史萊姆' }
      ],
      features: ['list', 'progress', 'quiz', 'cert', 'share', 'reduceMotion', 'resume', 'music']
    }
  };

  /* ---------- 功能清單 ---------- */
  const FEATURES = [
    { id: 'search', name: '搜尋', desc: '用關鍵字找島嶼和內容' },
    { id: 'list', name: '文字清單', desc: '不用 3D 也能讀完全部內容（無障礙）' },
    { id: 'progress', name: '探索進度', desc: '記錄看過哪些島（存在瀏覽器）' },
    { id: 'quiz', name: '小測驗', desc: '每座島的題目，中央島做總測驗' },
    { id: 'cert', name: '完成證書', desc: '全部完成後可以下載或列印' },
    { id: 'keys', name: '每日鑰匙', desc: '每天可以開寶箱的次數' },
    { id: 'codex', name: '收集圖鑑', desc: '已收集與未收集的卡片' },
    { id: 'daynight', name: '晝夜切換', desc: '白天、黃昏、夜晚光線' },
    { id: 'clock', name: '即時時鐘', desc: '顯示現在時間，天色跟著變' },
    { id: 'music', name: '背景音樂', desc: '按下才播放，可以關掉' },
    { id: 'reduceMotion', name: '減少動態', desc: '暫停動畫，照顧容易暈眩的人' },
    { id: 'share', name: '分享卡片', desc: '產生可以下載的分享圖' },
    { id: 'guide', name: '小嚮導問答', desc: '從網站內容找答案並附出處，不用 API 金鑰' },
    { id: 'resume', name: '接關碼', desc: '換電腦或手機時，用一串代碼接著玩' },
    { id: 'walkers', name: '散步的小人', desc: '島上有小人物沿著小路走動' },
    { id: 'residents', name: '居民對話與交易', desc: '點居民會揮手聊天，可以用撿到的貝殼交換' },
    { id: 'skyLife', name: '天空與海的動態', desc: '雲飄、鳥群、帆船繞島、海浪起伏' },
    { id: 'nightLights', name: '夜晚燈光', desc: '天黑後路燈、窗戶亮起，還有螢火蟲' }
  ];
  const RPG_FEATURES = ['avatar', 'npc', 'exp', 'stamps', 'finalChallenge', 'cert'];
  const LIFE_FEATURES = ['walkers', 'residents', 'skyLife', 'nightLights', 'daynight', 'clock'];

  /* ---------- 配色 ---------- */
  const PALETTES = [
    { id: 'coral', name: '珊瑚航海', day: '#FBF6EE', dusk: '#F3DCCB', night: '#14213A', primary: '#1F4E79', accent: '#E8684A' },
    { id: 'matcha', name: '抹茶庭園', day: '#F4F6EC', dusk: '#E3E7CF', night: '#18241C', primary: '#3E6B48', accent: '#D99A3E' },
    { id: 'lavender', name: '薰衣草霧', day: '#F7F4FA', dusk: '#E6DCEF', night: '#1D1A2E', primary: '#5B4B8A', accent: '#E07A9B' },
    { id: 'soda', name: '檸檬汽水', day: '#F5FBFB', dusk: '#FFF1C9', night: '#0F2530', primary: '#13808C', accent: '#F2B705' },
    { id: 'maple', name: '楓紅秋日', day: '#FBF5EF', dusk: '#F1D2BC', night: '#241815', primary: '#8C3B22', accent: '#C9A227' },
    { id: 'ink', name: '墨藍學院', day: '#F2F4F7', dusk: '#D9DFE8', night: '#0E1420', primary: '#24324A', accent: '#3FA7A0' }
  ];
  const THEME_SLOTS = [
    { k: 'day', icon: '☀️', name: '晴空' },
    { k: 'dusk', icon: '🌇', name: '暮色' },
    { k: 'night', icon: '🌙', name: '星夜' }
  ];

  /* ---------- 視覺風格（引擎用參數） ---------- */
  const STYLES = {
    lowpoly: { name: '低多邊形模型', shade: 'flat', sat: 1, light: 1, water: '#3fa3c4', blocky: false, emissive: 0, outline: false, desc: '俐落的多面體，像桌上的微縮模型' },
    handdrawn: { name: '暖色手繪', shade: 'toon', sat: 0.9, light: 1.05, water: '#5fb3c9', warm: 0.12, outline: true, desc: '暖色調加上描邊，像繪本插圖' },
    watercolor: { name: '淡彩水彩', shade: 'smooth', sat: 0.6, light: 1.15, water: '#8ccbd8', outline: false, desc: '低飽和、柔和亮色' },
    toy: { name: '積木玩具', shade: 'flat', sat: 1.25, light: 1, water: '#2f9fd9', blocky: true, desc: '方塊造型、高飽和色' },
    neon: { name: '夜光科幻', shade: 'smooth', sat: 1.2, light: 0.55, water: '#0c2a4a', emissive: 0.6, outline: false, desc: '暗色場景，邊緣發出霓虹光' },
    paper: { name: '復古紙張', shade: 'toon', sat: 0.45, light: 1.05, water: '#9fbcb8', warm: 0.25, outline: true, desc: '泛黃紙色、舊地圖感' },
    cartoon: { name: '卡通童趣', shade: 'toon', sat: 1.3, light: 1.1, water: '#36b5e0', outline: true, desc: '色塊分明、圓潤可愛' },
    ocean: { name: '海洋清涼', shade: 'smooth', sat: 1, light: 1.05, water: '#1fb5c9', cool: 0.15, desc: '藍綠色調，清爽透亮' },
    cloud: { name: '雲海仙境', shade: 'smooth', sat: 0.75, light: 1.2, water: '#cfe3f1', cool: 0.08, desc: '霧氣與淡色雲海，夢幻輕盈' }
  };

  const FONTS = {
    sans: { name: '黑體', desc: '清楚易讀，適合大量文字', css: '"Noto Sans TC","PingFang TC","Microsoft JhengHei","Heiti TC",system-ui,sans-serif' },
    round: { name: '圓體', desc: '圓潤親切，適合國小與親子', css: '"jf-openhuninn","Yuanti TC","Arial Rounded MT Bold","PingFang TC","Microsoft JhengHei",sans-serif' },
    hand: { name: '手寫感', desc: '活潑有溫度，只用在標題', css: '"Kaiti TC","BiauKai","DFKai-SB","KaiTi",serif' }
  };

  /* ---------- 島的形狀 ---------- */
  const SHAPES = {
    sea: { name: '海上群島', icon: '🌊', desc: '島浮在海面上，有沙灘、浪花、碼頭與帆船' },
    float: { name: '浮空群島', icon: '☁️', desc: '島飄在雲海上，底下是倒錐岩層，用吊橋相連' },
    atoll: { name: '環礁潟湖', icon: '🐠', desc: '淺藍潟湖和沙洲把群島圍成一圈' },
    terrace: { name: '層疊台地', icon: '⛰️', desc: '一層層梯田，像山城有高低層次' },
    volcano: { name: '火山島', icon: '🌋', desc: '中央島是冒煙的火山，黑沙灘與岩漿微光' },
    snow: { name: '冰雪群島', icon: '❄️', desc: '雪白島面、覆雪松樹，海上漂著小冰山' },
    desert: { name: '沙漠綠洲', icon: '🏜️', desc: '金黃沙丘、仙人掌，每座島有一池綠洲' },
    jungle: { name: '熱帶雨林', icon: '🌴', desc: '濃密深綠樹林，像探險叢林' },
    mushroom: { name: '奇幻蘑菇', icon: '🍄', desc: '長滿紅底白點的大蘑菇，像童話繪本' }
  };

  const DETAIL = [
    { v: 1, name: '簡潔', desc: '只有島和少數樹，最省效能' },
    { v: 2, name: '標準', desc: '加上房子、樹叢和碼頭' },
    { v: 3, name: '精緻', desc: '加上小路、圍籬、花叢、路燈和小道具' },
    { v: 4, name: '極致', desc: '再加上更多建築、石頭、浪花細節（需要較好的電腦）' }
  ];

  /* 動物：kind 決定引擎用哪一種造型 */
  const ANIMALS = {
    squirrel: { name: '松鼠', icon: '🐿️', kind: 'quad', color: '#b5652b', size: 0.35, tail: true },
    cat: { name: '貓咪', icon: '🐱', kind: 'quad', color: '#e0a35a', size: 0.4 },
    dog: { name: '小狗', icon: '🐶', kind: 'quad', color: '#c99a6b', size: 0.5 },
    rabbit: { name: '兔子', icon: '🐰', kind: 'quad', color: '#f2efe9', size: 0.35, ears: true },
    deer: { name: '小鹿', icon: '🦌', kind: 'quad', color: '#a8703f', size: 0.75, legs: 1.6 },
    sheep: { name: '綿羊', icon: '🐑', kind: 'quad', color: '#f4f1ea', size: 0.6, fluffy: true },
    cow: { name: '乳牛', icon: '🐄', kind: 'quad', color: '#f2f2f2', size: 0.85, spots: true },
    pig: { name: '小豬', icon: '🐷', kind: 'quad', color: '#f2a7b5', size: 0.55 },
    fox: { name: '狐狸', icon: '🦊', kind: 'quad', color: '#e0702f', size: 0.5, tail: true },
    panda: { name: '熊貓', icon: '🐼', kind: 'quad', color: '#f5f5f5', size: 0.7, panda: true },
    hedgehog: { name: '刺蝟', icon: '🦔', kind: 'quad', color: '#8a6a4a', size: 0.3 },
    frog: { name: '青蛙', icon: '🐸', kind: 'quad', color: '#5fae4a', size: 0.25 },
    chick: { name: '小雞', icon: '🐥', kind: 'bird', color: '#f7d046', size: 0.25 },
    duck: { name: '鴨子', icon: '🦆', kind: 'bird', color: '#f5f5f0', size: 0.35, swim: true },
    penguin: { name: '企鵝', icon: '🐧', kind: 'bird', color: '#2b2b33', size: 0.45, penguin: true },
    flamingo: { name: '紅鶴', icon: '🦩', kind: 'bird', color: '#f28aa0', size: 0.6, legs: 2 },
    owl: { name: '貓頭鷹', icon: '🦉', kind: 'bird', color: '#8b6b4a', size: 0.35 },
    crab: { name: '螃蟹', icon: '🦀', kind: 'crab', color: '#e2483a', size: 0.25 },
    turtle: { name: '海龜', icon: '🐢', kind: 'sea', color: '#4f8a5b', size: 0.5, shell: true },
    seal: { name: '海豹', icon: '🦭', kind: 'beach', color: '#9aa3ad', size: 0.6 },
    dolphin: { name: '海豚', icon: '🐬', kind: 'sea', color: '#6f9fc4', size: 0.9, jump: true },
    whale: { name: '鯨魚', icon: '🐋', kind: 'sea', color: '#3d6489', size: 2.2, spout: true },
    gull: { name: '海鷗', icon: '🕊️', kind: 'flyer', color: '#ffffff', size: 0.35 },
    butterfly: { name: '蝴蝶', icon: '🦋', kind: 'flutter', color: '#f29c38', size: 0.18 }
  };

  const EXTRAS = {
    waterfall: { name: '瀑布', icon: '💧' }, balloon: { name: '熱氣球', icon: '🎈' },
    windmill: { name: '風車', icon: '🌬️' }, flowers: { name: '花田', icon: '🌷' },
    bunting: { name: '彩旗串', icon: '🎏' }, fountain: { name: '噴泉廣場', icon: '⛲' },
    lighthouse: { name: '燈塔', icon: '🗼' }, ferris: { name: '摩天輪', icon: '🎡' },
    sakura: { name: '櫻花樹', icon: '🌸' }, campfire: { name: '營火', icon: '🔥' },
    treehouse: { name: '樹屋', icon: '🌳' }, hotspring: { name: '溫泉', icon: '♨️' },
    rainbow: { name: '彩虹', icon: '🌈' }, kite: { name: '風箏', icon: '🪁' }
  };

  const CINEMA = {
    none: { name: '不要動畫', icon: '⏹', desc: '直接顯示，點島時鏡頭立即移過去' },
    smooth: { name: '平順飛近', icon: '🎥', desc: '開場慢慢靠近，點島時平順飛過去' },
    epic: { name: '電影史詩', icon: '🎬', desc: '從高空環繞俯衝，點島時先繞一圈再飛近' },
    orbit: { name: '環繞巡航', icon: '🌀', desc: '鏡頭繞著群島慢慢轉一圈' },
    drone: { name: '空拍導覽', icon: '🚁', desc: '開場依序低空掠過每一座島' },
    topdown: { name: '上帝視角', icon: '🗺️', desc: '從正上方像看地圖一樣展開' },
    crane: { name: '升降搖臂', icon: '🏗️', desc: '從海平面緩緩升起拉高' }
  };

  const LANGS = { zh: '繁體中文', 'zh-en': '繁中＋英文', en: 'English' };
  const AUDIENCES = ['國小學生', '國中學生', '高中職學生', '大專學生', '老師與教育工作者', '企業員工', '一般大眾', '家長'];

  /* ---------- 小工具（表單與網站共用） ---------- */
  const U = {
    // 用全形或半形分號、頓號、換行切開
    splitList(s) {
      if (Array.isArray(s)) return s.filter(Boolean);
      return String(s || '').split(/[；;\n]/).map(x => x.trim()).filter(Boolean);
    },
    // 多行欄位：每行用｜或 | 分欄
    rows(s, n) {
      return String(s || '').split('\n').map(l => l.trim()).filter(Boolean).map(l => {
        const c = l.split(/[｜|]/).map(x => x.trim());
        if (n) while (c.length < n) c.push('');
        return c;
      });
    },
    lines(s) { return String(s || '').split('\n').map(l => l.trim()).filter(Boolean); },
    optVal(o) { return String(o).split(':')[0]; },
    optLabel(o) { const p = String(o).split(':'); return p[1] || p[0]; },
    slug(s) {
      const t = String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
      return t || 'my-islands';
    },
    esc(s) {
      return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    },
    seeded(seed) {
      let h = 2166136261 >>> 0;
      const str = String(seed);
      for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
      return function () {
        h += 0x6D2B79F5; let t = h;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
    },
    lum(hex) {
      const h = String(hex || '#ffffff').replace('#', '');
      const n = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16);
      const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
      return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    },
    // 解析測驗題：題目｜正解｜誤1｜誤2｜誤3
    parseQuiz(s) {
      return U.rows(s).filter(r => r[0] && r[1]).map(r => ({ q: r[0], a: r[1], wrong: r.slice(2).filter(Boolean) }));
    },
    parseLinks(s) {
      return U.rows(s).map(r => {
        if (r.length === 1) return { name: r[0], url: r[0] };
        return { name: r[0] || r[1], url: r[1] || r[0] };
      }).filter(l => /^https?:\/\//i.test(l.url) || /^(mailto:|tel:)/i.test(l.url));
    },
    today() {
      const d = new Date(), p = n => String(n).padStart(2, '0');
      return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
    }
  };

  function blankIsland(i) {
    return { id: 'i' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6) + (i || ''), name: '', intro: '', category: '', goal: '', points: '', links: '', quiz: '', files: [], extra: {} };
  }

  function defaultState() {
    const p = PALETTES[0];
    return {
      v: 1,
      type: 'course', rpg: false, life: false,
      meta: { name: '', tagline: '', slug: '', audience: '', author: '', contact: '', mascot: '', mascotLook: '', lang: 'zh' },
      islands: [blankIsland(1), blankIsland(2), blankIsland(3)],
      center: { name: '', note: '', extra: {} },
      theme: { day: p.day, dusk: p.dusk, night: p.night, order: ['day', 'dusk', 'night'], primary: p.primary, accent: p.accent, auto: true },
      style: 'lowpoly', font: 'sans', shape: 'sea', detail: 3,
      animals: ['cat', 'gull', 'dolphin'], extras: ['lighthouse', 'flowers'], cinema: 'smooth',
      features: TYPES.course.features.slice(),
      sources: '', allowDownload: false,
      ai: 'claude', deploy: 'ask', notes: ''
    };
  }

  ISLE.DATA = {
    TYPES, FEATURES, RPG_FEATURES, LIFE_FEATURES, PALETTES, THEME_SLOTS, STYLES, FONTS, SHAPES,
    DETAIL, ANIMALS, EXTRAS, CINEMA, LANGS, AUDIENCES, blankIsland, defaultState
  };
  ISLE.U = U;
})();
