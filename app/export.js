/* 群島製圖所 B 版：直接產生可以離線打開的島嶼網站 */
(function () {
  const ISLE = window.ISLE, U = ISLE.U, D = ISLE.DATA;
  const esc = U.esc;
  const P = () => window.ISLE_PAYLOAD || {};
  const MAX_INLINE = 12 * 1024 * 1024; // 單一 HTML 最多內嵌的圖片大小

  function siteConfig(St) {
    const s = St.previewState();
    ['ai', 'deploy', 'notes', 'update', 'sources'].forEach(k => delete s[k]);
    s.islands = s.islands.filter(i => (i.name || '').trim());
    return s;
  }
  function publicFiles(St, S) {
    // 圖片一律放進相簿；其他檔案要允許下載才放
    return St.files().filter(f => f.isle !== 'shared' || S.allowDownload).filter(f => /^image\//.test(f.type) || S.allowDownload);
  }
  const safeJs = s => String(s).replace(/<\/script/gi, '<\\/script').replace(/<!--/g, '<\\!--');

  function indexHtml(cfg, inline, fileBase) {
    const m = cfg.meta;
    const head = `<!doctype html>
<html lang="${m.lang === 'en' ? 'en' : 'zh-Hant-TW'}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(m.name || '群島')}</title>
<meta name="description" content="${esc(m.tagline || '')}">
<meta name="generator" content="群島製圖所">
<meta property="og:title" content="${esc(m.name || '')}">
<meta property="og:description" content="${esc(m.tagline || '')}">
<link rel="icon" href="data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'><circle cx='32' cy='32' r='30' fill='${cfg.theme.primary}'/><ellipse cx='32' cy='36' rx='16' ry='10' fill='${cfg.theme.accent}'/></svg>`)}">
${inline ? `<style>${P().css}</style>` : '<link rel="stylesheet" href="css/site.css">'}
</head>
<body>
<div id="app"></div>
<noscript><p style="padding:24px">這個網站需要開啟 JavaScript。</p></noscript>
`;
    const scripts = inline
      ? ['three', 'data', 'world', 'games', 'site'].map(k => `<script>${safeJs(P()[k])}</script>`).join('\n') + `\n<script>window.ISLE_SITE = ${safeJs(JSON.stringify(cfg))};</script>`
      : ['lib/three.min.js', 'js/data.js', 'js/world.js', 'js/games.js', 'js/site.js', 'js/site-data.js'].map(s => `<script src="${s}"></script>`).join('\n');
    return head + scripts + `\n<script>ISLE.Site.mount(document.getElementById('app'), window.ISLE_SITE, { fileBase: ${fileBase == null ? 'null' : JSON.stringify(fileBase)} });</script>\n</body>\n</html>\n`;
  }

  function readme(cfg) {
    return `${cfg.meta.name}
====================

這個網站由「群島製圖所」產生，不需要伺服器，也不需要網路就能打開。

【在自己電腦上看】
1. 把 ZIP 解壓縮（不要直接在壓縮檔裡打開）。
2. 雙擊 index.html，用 Chrome、Edge、Safari 或 Firefox 打開。

【放到網路上分享】
・Netlify：到 app.netlify.com/drop，把整個資料夾拖進去，就會得到一個網址。
・GitHub Pages：把資料夾內容放進一個儲存庫，在 Settings → Pages 開啟。
・Cloudflare Pages、Vercel 也可以，選「上傳靜態檔案」。

【注意】
・訪客的進度存在他自己的瀏覽器裡，不會傳到任何地方。
・「動態看板」的線上資料來源，在本機直接開檔案時常被瀏覽器擋下，放上網路後比較能正常讀取；讀不到時會顯示你填的備用內容。
・要修改內容，請回到群島製圖所匯入 project.json，改完再產生一次。
`;
  }

  async function buildZip(St) {
    const S = St.state();
    const cfg = siteConfig(St);
    const pub = publicFiles(St, S);
    const pubPaths = new Set(pub.map(f => f.path));
    cfg.islands.forEach(i => { i.files = (i.files || []).filter(f => pubPaths.has(f.path)); });
    const z = new JSZip();
    const slug = S.meta.slug || U.slug(S.meta.name);
    const top = z.folder(slug);
    top.file('index.html', indexHtml(cfg, false, 'files/'));
    top.file('css/site.css', P().css);
    top.file('lib/three.min.js', P().three);
    ['data', 'world', 'games', 'site'].forEach(k => top.file(`js/${k}.js`, P()[k]));
    top.file('js/site-data.js', '/* 網站內容：由群島製圖所產生 */\nwindow.ISLE_SITE = ' + JSON.stringify(cfg, null, 1) + ';\n');
    pub.forEach(f => top.file('files/' + f.path, f.blob));
    top.file('使用說明.txt', readme(cfg));
    top.file('project.json', JSON.stringify(St.projectData(), null, 2));
    return z.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } });
  }

  function toDataUrl(blob) { return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(blob); }); }
  async function buildSingle(St) {
    const S = St.state();
    const cfg = siteConfig(St);
    const imgs = St.files().filter(f => /^image\//.test(f.type));
    let total = 0; const urls = {};
    for (const f of imgs) { if (total + f.size > MAX_INLINE) break; total += f.size; urls[f.path] = await toDataUrl(f.blob); }
    cfg.islands.forEach(i => { i.files = (i.files || []).filter(f => urls[f.path]).map(f => Object.assign(f, { data: urls[f.path] })); });
    return new Blob([indexHtml(cfg, true, null)], { type: 'text/html' });
  }

  function step6Html(o) {
    const S = o.S;
    const pub = (ISLE.Studio.files() || []).filter(f => /^image\//.test(f.type) || S.allowDownload);
    return `<h2>產生網站</h2><p class="hint">右邊的預覽就是成品。確認沒問題後，選一種方式下載。</p>
      ${o.sum}${o.issueHtml}
      <div class="big-actions">
        <button type="button" class="sbtn coral big" data-a="exZip" ${o.issues.length ? 'disabled' : ''}>⬇ 下載網站（ZIP）</button>
        <button type="button" class="sbtn ghost big" data-a="exSingle" ${o.issues.length ? 'disabled' : ''}>⬇ 下載單一 HTML 檔</button>
        <button type="button" class="sbtn ghost big" data-a="pvFull">⛶ 全螢幕試玩</button>
      </div>
      <table class="ftable"><tbody>
        <tr><td><b>網站 ZIP</b>（推薦）</td><td>完整網站資料夾，包含 ${pub.length} 個${S.allowDownload ? '檔案' : '圖片'}。解壓縮後雙擊 <code>index.html</code> 就能看；也可以整個資料夾上傳到 Netlify、GitHub Pages。</td></tr>
        <tr><td><b>單一 HTML</b></td><td>所有程式包成一個檔案（約 1 MB），最方便傳給別人或放進雲端硬碟。圖片會一起內嵌（最多 12 MB），${S.allowDownload ? '但可下載的原始檔不會放進去' : '其他檔案不會放進去'}。</td></tr>
      </tbody></table>
      <div class="done-box"><h3>放到網路上</h3><ol><li>到 <b>app.netlify.com/drop</b>，把解壓縮後的資料夾整個拖進去，就會得到網址（免費）。</li><li>或用 GitHub Pages、Cloudflare Pages、Vercel 上傳靜態檔案。</li><li>之後要改內容：回到這裡修改，再下載一次覆蓋上去。記得先「匯出專案」備份。</li></ol></div>
      <p class="mini muted">訪客的進度存在自己的瀏覽器，不會上傳到任何地方。網站完全離線可用，不需要 API 金鑰。</p>`;
  }

  async function run(b, St, fn, label, ext) {
    const S = St.state();
    if (!P().three) { St.toast('找不到網站引擎檔案，請確認 app 資料夾完整'); return; }
    b.disabled = true; const old = b.textContent; b.textContent = '產生中…';
    try { const blob = await fn(St); St.saveBlob(blob, `${S.meta.slug || U.slug(S.meta.name)}${ext}`); St.toast(label); }
    catch (e) { St.toast('產生失敗：' + e.message); }
    b.disabled = false; b.textContent = old;
  }

  ISLE.Export = {
    step6Html, buildZip, buildSingle, indexHtml,
    actions: {
      exZip: (b, St) => run(b, St, buildZip, '網站 ZIP 下載好了！解壓縮後雙擊 index.html', '-網站.zip'),
      exSingle: (b, St) => run(b, St, buildSingle, '單一 HTML 下載好了！雙擊就能打開', '.html')
    }
  };
})();
