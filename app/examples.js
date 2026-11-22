/* 群島製圖所：12 種島型的示範資料 */
(function () {
  const ISLE = window.ISLE;
  const I = (name, intro, o) => Object.assign({ name, intro, category: '', goal: '', points: '', links: '', quiz: '', files: [], extra: {} }, o || {});

  const EX = {
    course: {
      meta: { name: '水的旅行', tagline: '跟著一滴水，走完四座島認識水循環', slug: 'water-journey', audience: '國小學生', author: '自然科 林老師', mascot: '滴滴', mascotLook: '一顆圓滾滾的水滴，戴著小草帽' },
      center: { name: '雲朵總複習島', note: '把四課的題目混在一起抽考' },
      shape: 'sea', style: 'cartoon', animals: ['duck', 'gull', 'turtle'], extras: ['waterfall', 'rainbow', 'lighthouse'],
      islands: [
        I('第一課 蒸發', '太陽一曬，水就變成看不見的水蒸氣飛上天。', { category: '水循環', goal: '說出蒸發需要熱', points: '水受熱變成水蒸氣；溫度越高蒸發越快；曬衣服就是蒸發', quiz: '曬衣服變乾是哪一種現象？｜蒸發｜凝結｜降水\n蒸發需要什麼？｜熱｜冰｜風車', extra: { worksheet: '在家裡找一個蒸發的例子\n為什麼夏天衣服乾得比較快？' } }),
        I('第二課 凝結', '水蒸氣遇冷，又變回小水滴。', { category: '水循環', points: '水蒸氣遇冷變小水滴；冰飲料杯外的水珠；雲是很多小水滴', quiz: '冰飲料杯子外面的水珠從哪裡來？｜空氣中的水蒸氣凝結｜杯子漏水｜飲料蒸發', extra: { worksheet: '畫出杯子外面出現水珠的過程' } }),
        I('第三課 降水', '雲裡的水滴變大變重，就落下來變成雨或雪。', { category: '水循環', points: '水滴變大就會落下；雨、雪、冰雹都是降水', quiz: '下列哪一個是降水？｜下雪｜起霧｜結露' }),
        I('第四課 匯流', '雨水流進河川、滲進地下，最後回到海洋。', { category: '水循環', points: '地表逕流流進河川；一部分滲入地下水；河流最後流入海洋', quiz: '雨水最後大多會流到哪裡？｜海洋｜沙漠｜火山' })
      ]
    },
    life: {
      meta: { name: '小島木作室', tagline: '手作木頭小物與親子木工課', slug: 'wood-island', audience: '一般大眾', author: '阿樹', contact: 'hello@example.com', mascot: '木頭熊', mascotLook: '一隻用木塊拼成的小熊' },
      center: { name: '木屑廣場', note: '' },
      shape: 'sea', style: 'handdrawn', animals: ['squirrel', 'cat', 'gull'], extras: ['windmill', 'flowers', 'bunting'],
      islands: [
        I('作品展示館', '每一件都是手工打磨的原木小物。', { points: '原木杯墊；手作木湯匙；動物造型掛勾', extra: { kind: '作品', cta: '看完整作品集' } }),
        I('親子木工課', '大人小孩一起完成第一件木作。', { points: '每月兩場；適合 6 歲以上；材料全包', links: '報名表｜https://example.com/signup', extra: { kind: '課程', cta: '我要報名' } }),
        I('客製訂做', '刻字、尺寸、樹種都可以討論。', { points: '婚禮小物；企業贈禮；學校畢業禮', extra: { kind: '服務', cta: '詢問客製' } }),
        I('週末露營日記', '工作之外，我喜歡在山上露營。', { points: '自己做的折疊椅；營火料理', extra: { kind: '生活' } })
      ]
    },
    treasure: {
      meta: { name: 'AI 工具寶物島', tagline: '每天開寶箱，收集 AI 工具知識卡', slug: 'ai-treasure', audience: '老師與教育工作者', author: '數位教學小組', mascot: '寶寶鑰', mascotLook: '一把會說話的金色小鑰匙' },
      center: { name: '寶物總部', note: '' },
      shape: 'atoll', style: 'toy', animals: ['crab', 'turtle', 'gull'], extras: ['balloon', 'kite'],
      islands: [
        I('寫作工具灣', '幫忙發想、改寫和校對的工具。', { points: '先給清楚的任務；請它列出修改理由', quiz: '請 AI 改寫文章時，最好再要求它？｜說明修改理由｜越長越好｜不要分段', extra: { cards: '提示詞｜清楚寫出任務、對象與格式\n改寫｜保留原意，換成適合讀者的說法\n校對｜找出錯字並說明原因' } }),
        I('圖像工具岬', '生成與編修圖片的工具。', { points: '注意版權；描述主體、風格、構圖', extra: { cards: '構圖｜主體放在哪裡、從什麼角度看\n風格詞｜例如水彩、扁平、像素\n授權｜確認圖片可以怎麼使用' } }),
        I('簡報工具島', '把大綱變成投影片。', { points: '先有大綱再生成；一頁一個重點', extra: { cards: '大綱先行｜先確定每頁要講什麼\n一頁一重點｜避免塞太多字' } }),
        I('安全守則礁', '使用 AI 的注意事項。', { points: '不要輸入個資；查證事實；標示 AI 協作', quiz: '使用 AI 時哪一個做法不恰當？｜貼上學生的身分證字號｜查證重要事實｜註明有用 AI 協助', extra: { cards: '個資保護｜不要輸入可以辨識個人的資料\n事實查核｜重要資訊要找原始來源' } })
      ]
    },
    local: {
      meta: { name: '漫遊三灣鎮', tagline: '用一座島認識一個里', slug: 'sanwan-walk', audience: '一般大眾', author: '三灣社區協會', mascot: '阿灣', mascotLook: '戴斗笠的小螃蟹' },
      center: { name: '三灣旅客中心', note: '' },
      shape: 'sea', style: 'watercolor', animals: ['crab', 'gull', 'cat'], extras: ['lighthouse', 'bunting', 'sakura'],
      islands: [
        I('老街里', '百年紅磚老街與廟口小吃。', { points: '紅磚拱廊；媽祖廟；週末市集', extra: { spots: '紅磚拱廊｜日治時期留下的街屋立面\n廟口麵線｜早上六點開到賣完為止', story: '老街以前是港口貨物集散地，挑夫從碼頭一路挑貨進來。' } }),
        I('漁港里', '看漁船進港、買現撈海鮮。', { points: '下午三點漁船回港；魚市拍賣', extra: { spots: '觀景堤防｜夕陽最美的地方\n魚市｜可以看拍賣，記得穿雨鞋' } }),
        I('茶山里', '山坡上的梯田茶園。', { points: '春茶四月；製茶體驗', extra: { spots: '茶園步道｜約 40 分鐘\n老茶廠｜可以預約炒茶體驗', story: '茶山里的居民多是早年從北部遷來的茶農。' } }),
        I('溪口里', '溪流出海口的濕地生態。', { points: '招潮蟹；候鳥季十月到三月', extra: { spots: '濕地木棧道｜看招潮蟹揮大螯\n賞鳥亭｜冬天可以看到黑面琵鷺' } })
      ]
    },
    expo: {
      meta: { name: '海風國中 成果發表會', tagline: '一年的學習，在這裡展開', slug: 'seabreeze-expo', audience: '家長', author: '海風國中教務處', mascot: '風帆仔', mascotLook: '一艘戴眼鏡的小帆船' },
      center: { name: '活動服務台', note: '入口在活動中心，集滿四個章可兌換紀念品' },
      shape: 'sea', style: 'cartoon', animals: ['gull', 'dolphin'], extras: ['bunting', 'ferris', 'balloon', 'fountain'],
      islands: [
        I('科學展區', '自然科專題研究成果。', { points: '水火箭；淨水實驗；校園植物調查', extra: { schedule: '10:00｜水火箭試射\n13:30｜專題口頭發表', booths: '水火箭小隊｜飛最遠的設計\n淨水實驗｜用木炭和沙子過濾' } }),
        I('藝術展區', '美術與音樂課作品。', { points: '版畫；陶藝；直笛合奏', extra: { schedule: '11:00｜直笛合奏', booths: '版畫牆｜八年級木刻版畫\n陶藝桌｜可以摸的作品' } }),
        I('語文展區', '閱讀心得與英語話劇。', { points: '英語短劇；校刊', extra: { schedule: '14:00｜英語短劇', booths: '校刊角｜一年的校園大事' } }),
        I('美食攤位區', '家長會義賣。', { points: '收入全數捐給圖書室', extra: { schedule: '09:30｜開賣', booths: '古早味粉粿｜家長會招牌\n手作餅乾｜七年級烹飪課' } })
      ]
    },
    science: {
      meta: { name: '月亮變臉記', tagline: '一步一步看懂月相為什麼會變', slug: 'moon-phase', audience: '國小學生', author: '自然科', mascot: '小兔', mascotLook: '住在月亮上的白兔' },
      center: { name: '月相觀測台', note: '', extra: { sim: 'moon' } },
      shape: 'float', style: 'neon', animals: ['rabbit', 'owl'], extras: ['balloon'],
      islands: [
        I('步驟一 太陽照亮月亮', '月亮自己不發光，是被太陽照亮一半。', { points: '月亮反射太陽光；永遠只有一半被照亮', quiz: '月亮會發亮是因為？｜反射太陽光｜自己發光｜反射地球的光', extra: { observe: '看看月亮哪一半是亮的', simValue: '0' } }),
        I('步驟二 從地球看', '我們從地球看，只看到亮面的一部分。', { points: '看到的亮面多少決定月相', extra: { observe: '把滑桿拉到 25，看看是上弦月', simValue: '25' } }),
        I('步驟三 滿月', '地球在太陽和月亮中間時，亮面整個朝向我們。', { points: '滿月約在農曆十五', quiz: '滿月大約在農曆幾號？｜十五｜初一｜初八', extra: { observe: '拉到 50 看滿月', simValue: '50' } }),
        I('步驟四 一個循環', '大約 29.5 天，月相就重來一次。', { points: '朔望月約 29.5 天', extra: { observe: '按播放，看完一整個循環', simValue: '75' } })
      ]
    },
    live: {
      meta: { name: '五年三班動態島', tagline: '班上最新消息都在這裡', slug: 'class-503', audience: '家長', author: '五年三班', mascot: '', mascotLook: '' },
      center: { name: '總看板', note: '' },
      shape: 'sea', style: 'lowpoly', animals: ['gull', 'cat'], extras: ['lighthouse', 'bunting'],
      islands: [
        I('作業公告', '每天的回家作業。', { extra: { feedType: 'manual', items: '11/03｜數學習作 p.24\n11/02｜國語圈詞第五課' } }),
        I('活動消息', '校外教學、比賽與活動。', { extra: { feedType: 'manual', items: '11/10｜校外教學：科學館\n11/20｜班際躲避球賽' } }),
        I('班級相簿', '活動照片連結。', { extra: { feedType: 'manual', items: '10/25｜運動會照片｜https://example.com/album' } }),
        I('老師的話', '給家長的小叮嚀。', { extra: { feedType: 'manual', items: '11/01｜天氣轉涼，請幫孩子帶外套' } })
      ]
    },
    runner: {
      meta: { name: '數感跑酷', tagline: '邊跑邊判斷，練出數字直覺', slug: 'number-run', audience: '國小學生', author: '數學科', mascot: '跑跑', mascotLook: '穿球鞋的數字 7' },
      center: { name: '挑戰總部', note: '' },
      shape: 'terrace', style: 'toy', animals: ['rabbit', 'chick'], extras: ['bunting', 'kite'],
      islands: [
        I('3 的倍數', '吃掉 3 的倍數，閃開其他數字。', { extra: { rule: '吃掉 3 的倍數', right: '3；6；9；12；15；18；21；24；27；30；33；36', wrong: '4；7；10；13；16；20；22；25；28；31；35；38' } }),
        I('質數', '只能被 1 和自己整除的數。', { extra: { rule: '吃掉質數', right: '2；3；5；7；11；13；17；19；23；29；31；37', wrong: '1；4；6；8；9；10；12；15；21；25；27；33' } }),
        I('偶數', '可以被 2 整除的數。', { extra: { rule: '吃掉偶數', right: '2；4；8；10；14；16；22；28；34；40', wrong: '1；3；5；9；11；15；17；21；27；33' } }),
        I('比 1/2 大', '分數比大小。', { extra: { rule: '吃掉比 1/2 大的分數', right: '2/3；3/4；5/8；4/5；7/10；5/6', wrong: '1/3；1/4；2/5；3/8；1/6；3/10' } })
      ]
    },
    empathy: {
      meta: { name: '走進別人的一天', tagline: '用第一人稱體驗不同學習者的日常', slug: 'one-day', audience: '國中學生', author: '輔導室', mascot: '', mascotLook: '' },
      center: { name: '討論教室', note: '這些情境只是部分經驗的模擬，每個人的感受都不一樣。', extra: { questions: '哪一個時刻讓你最有感覺？為什麼？\n如果你是同學，你可以做哪一件小事？\n教室環境可以怎麼調整？' } },
      shape: 'sea', style: 'watercolor', animals: ['cat', 'gull'], extras: ['flowers', 'sakura'],
      islands: [
        I('聽不清楚的一天', '跟著小安經歷一天的課堂。', { extra: { persona: '我是小安，聽力比較弱', day: '08:00｜早自習廣播一片模糊，我不知道要做什麼｜老師把重點寫在黑板上\n10:00｜分組討論大家同時說話｜輪流發言、面向我說話\n12:30｜午餐時同學在背後叫我｜走到我面前或輕拍肩膀' } }),
        I('字會跳舞的一天', '跟著阿哲面對閱讀的挑戰。', { extra: { persona: '我是阿哲，閱讀時字會跳來跳去', day: '09:00｜考卷字很小很密，我讀到一半就累了｜放大字體、增加行距\n13:00｜被點名朗讀｜事先告知段落、可以選擇不朗讀' } }),
        I('坐不住的一天', '跟著小茵體驗專注的困難。', { extra: { persona: '我是小茵，很難一直坐著', day: '10:30｜窗外有聲音，我的注意力就飄走｜座位遠離窗戶與走道\n14:00｜長時間抄寫讓我坐立難安｜分段完成、中間可以起來走動' } }),
        I('剛轉學的一天', '跟著米拉適應新環境。', { extra: { persona: '我是米拉，剛從國外轉學回來', day: '08:30｜大家用我聽不懂的流行語聊天｜主動找我一起聊、解釋用語\n15:00｜不知道社團怎麼報名｜安排一位小幫手' } })
      ]
    },
    literature: {
      meta: { name: '遊戲化學習文獻城', tagline: '我的研究所文獻回顧地圖', slug: 'gamification-lit', audience: '大專學生', author: '研究生 小陳', mascot: '', mascotLook: '' },
      center: { name: '中央圖書館', note: '' },
      shape: 'terrace', style: 'paper', animals: ['owl', 'cat'], extras: ['lighthouse'],
      islands: [
        I('動機理論', '自我決定論與內在動機。', { extra: { refs: 'Deci, E. L., & Ryan, R. M.｜2000｜The "what" and "why" of goal pursuits｜Psychological Inquiry｜三種基本心理需求：自主、勝任、關係｜https://doi.org/10.1207/S15327965PLI1104_01' } }),
        I('遊戲化定義', '什麼是遊戲化。', { extra: { refs: 'Deterding, S., et al.｜2011｜From game design elements to gamefulness｜MindTrek Proceedings｜最常被引用的遊戲化定義｜https://doi.org/10.1145/2181037.2181040' } }),
        I('實證效果', '遊戲化對學習成效的研究。', { extra: { refs: 'Sailer, M., & Homner, L.｜2020｜The gamification of learning: A meta-analysis｜Educational Psychology Review｜後設分析：對認知、動機、行為都有小到中等效果｜https://doi.org/10.1007/s10648-019-09498-w' } }),
        I('研究缺口', '我想補的地方。', { points: '缺少長期追蹤；國小階段研究少', extra: { refs: '' } })
      ]
    },
    portfolio: {
      meta: { name: '我的成長群島', tagline: '高中三年的學習歷程', slug: 'my-growth', audience: '大專學生', author: '王小明', mascot: '', mascotLook: '' },
      center: { name: '能力總覽塔', note: '' },
      shape: 'float', style: 'lowpoly', animals: ['gull', 'butterfly'], extras: ['balloon', 'waterfall'],
      islands: [
        I('高一 科展初體驗', '第一次做研究。', { extra: { period: '2024 春', works: '設計水質檢測實驗｜實驗設計、資料分析\n上台報告｜表達溝通', reflect: '學到研究不是一次就成功，要不斷修正。' } }),
        I('高二 程式社', '擔任社團教學長。', { extra: { period: '2024 秋–2025 夏', works: '教學弟妹寫 Python｜表達溝通、程式設計\n辦社內黑客松｜團隊合作、領導', reflect: '教別人的時候，自己才真的弄懂。' } }),
        I('高二 社區服務', '在社區圖書館說故事。', { extra: { period: '2025 寒假', works: '設計繪本活動｜企劃、表達溝通', reflect: '孩子的反應讓我學會調整節奏。' } }),
        I('高三 專題研究', '用 AI 分析校園用電。', { extra: { period: '2025 秋', works: '收集電表資料｜資料分析\n寫成小論文｜寫作、程式設計', reflect: '從問題出發，比從工具出發更重要。' } })
      ]
    },
    quest: {
      meta: { name: '資安勇者試煉', tagline: '打倒資安怪獸，成為資安勇者', slug: 'security-quest', audience: '企業員工', author: '資訊室', mascot: '盾盾', mascotLook: '一面會走路的小盾牌' },
      center: { name: '最終試煉島', note: '' },
      shape: 'volcano', style: 'cartoon', animals: ['owl', 'fox'], extras: ['campfire', 'lighthouse'],
      islands: [
        I('密碼之島', '學會設定強密碼。', { points: '長度比複雜度重要；不同網站不同密碼；使用密碼管理器', quiz: '哪一個密碼最安全？｜一句長長的通關片語｜123456｜生日', extra: { npc: '守門人 老鎖', story: '勇者，你的密碼是你的生日嗎？\n快去打倒弱密碼史萊姆吧！', monster: '弱密碼史萊姆' } }),
        I('釣魚之島', '辨認釣魚郵件。', { points: '檢查寄件者網域；不要急著點連結；有疑慮就打電話確認', quiz: '收到「帳號將停用，請立刻登入」的信，應該？｜先查寄件者並向資訊室確認｜馬上點連結登入｜轉寄給所有同事', extra: { npc: '漁夫 阿海', story: '海上很多假的魚餌……\n看清楚再咬！', monster: '偽裝釣魚怪' } }),
        I('更新之島', '為什麼要更新。', { points: '更新會修補漏洞；開啟自動更新', quiz: '系統跳出安全性更新，最好？｜盡快安裝｜永遠延後｜關掉通知', extra: { npc: '工匠 阿修', story: '舊的盾牌有破洞，要補起來！', monster: '漏洞蟲' } }),
        I('備份之島', '3-2-1 備份原則。', { points: '3 份資料；2 種媒介；1 份異地', quiz: '3-2-1 備份中的「1」是指？｜一份放在異地｜一天備份一次｜一個硬碟', extra: { npc: '倉庫長 阿存', story: '東西要放三個地方才安心。', monster: '勒索龍' } })
      ]
    }
  };

  ISLE.EXAMPLES = EX;
})();
