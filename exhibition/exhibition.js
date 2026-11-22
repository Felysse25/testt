(() => {
  const data = EXHIBITION;
  const analytics = ExhibitionAnalytics;
  const $ = id => document.getElementById(id);
  const panel = $('panel');
  const body = $('panel-body');
  const dishes = new Map();
  const openedCountries = new Set();
  const playedInterviews = new Set();
  let openedExhibit = null;
  let pendingMedia = new AbortController();
  let active = 0;
  let world;
  const mediaQuery = matchMedia('(prefers-reduced-motion: reduce)');

  function element(tag, text, parent, className) {
    const node = document.createElement(tag);
    if (text) node.textContent = text;
    if (className) node.className = className;
    parent.append(node);
    return node;
  }

  function button(text, parent, action, className) {
    const node = element('button', text, parent, className);
    node.type = 'button';
    node.addEventListener('click', action);
    return node;
  }

  const activities = ExhibitionActivities.create({
    element, button, track: analytics.track, badge: $('passport-count')
  });
  $('passport-launch').addEventListener('click', () => {
    openedExhibit = 'passport';
    title('Digital Food Passport', data.islands[0].name);
    activities.renderPassport(body);
  });

  function clearPanel() {
    pendingMedia.abort();
    pendingMedia = new AbortController();
    for (const clip of body.querySelectorAll('video')) {
      clip.pause();
      clip.removeAttribute('src');
      clip.load();
    }
    body.replaceChildren();
  }

  function title(titleText, context) {
    $('panel-title').textContent = titleText;
    $('panel-context').textContent = context;
    clearPanel();
    if (!panel.open) panel.showModal();
    panel.scrollTop = 0;
  }

  function localMediaPath(path) {
    if (typeof path !== 'string' || !path.trim() || /^(?:[a-z][a-z0-9+.-]*:|[\/])/i.test(path.trim())) return null;
    const base = new URL('.', location.href);
    const url = new URL(path.trim(), base);
    return url.href.startsWith(base.href) ? url.href : null;
  }

  function mediaCard(parent, label, message, kind) {
    const card = element('div', '', parent, 'media-card media-card-' + kind);
    element('strong', label, card);
    const status = element('p', message, card);
    status.setAttribute('role', 'status');
    return {card, status};
  }

  function picture(parent, asset, label, missing, imageClass = '') {
    const path = localMediaPath(asset?.path);
    const {card, status} = mediaCard(parent, label, path ? 'Loading image…' : missing, 'image');
    if (!path) return;
    const signal = pendingMedia.signal;
    const image = document.createElement('img');
    image.alt = asset.alt || label;
    image.className = imageClass;
    image.decoding = 'async';
    image.addEventListener('load', () => {
      if (signal.aborted || !image.naturalWidth) return;
      card.replaceWith(image);
      if (asset.credit) {
        const credit = element('figcaption', '', parent);
        if (asset.source) element('a', asset.credit, credit).href = asset.source;
        else credit.textContent = asset.credit;
        if (asset.license) {
          credit.append(' · ');
          element('a', 'License', credit).href = asset.license;
        }
      }
    }, {once: true, signal});
    image.addEventListener('error', () => { status.textContent = missing; }, {once: true, signal});
    image.src = path;
  }

  function video(pathValue, label, placeholder, onPlaying) {
    const path = localMediaPath(pathValue);
    const {card, status} = mediaCard(body, label, path ? 'Loading video…' : placeholder, 'video');
    if (!path) return;
    const signal = pendingMedia.signal;
    const clip = element('video', '', body);
    clip.hidden = true;
    clip.controls = true;
    clip.playsInline = true;
    clip.preload = 'metadata';
    clip.setAttribute('aria-label', label);
    if (onPlaying) clip.addEventListener('playing', onPlaying, {once: true, signal});
    clip.addEventListener('loadedmetadata', () => {
      if (clip.videoWidth > 0) {
        card.hidden = true;
        clip.hidden = false;
      } else {
        status.textContent = placeholder;
      }
    }, {once: true, signal});
    clip.addEventListener('error', () => {
      clip.remove();
      card.hidden = false;
      status.textContent = placeholder;
    }, {once: true, signal});
    clip.src = path;
  }

  async function surveyMedia(asset) {
    const label = 'Survey infographic';
    const missing = 'The final survey infographic will be shared here when it is available.';
    const path = localMediaPath(asset?.path);
    if (!path || !new URL(path).pathname.toLowerCase().endsWith('.pdf')) {
      picture(element('figure', '', body), asset, label, missing, 'survey-image');
      return;
    }
    const {card, status} = mediaCard(body, label, 'Checking PDF…', 'document');
    if (location.protocol === 'file:') {
      status.textContent = 'Open the exhibition through a local web server to view the PDF.';
      return;
    }
    const signal = pendingMedia.signal;
    try {
      const response = await fetch(path, {headers: {Range: 'bytes=0-1023'}, signal});
      if (!response.ok || !response.body) throw new Error('PDF is unavailable');
      const reader = response.body.getReader();
      let signature = '';
      try {
        while (signature.length < 5) {
          const {done, value} = await reader.read();
          if (done) break;
          signature += new TextDecoder().decode(value.subarray(0, 5 - signature.length));
        }
      } finally {
        await reader.cancel();
      }
      if (signature !== '%PDF-') throw new Error('PDF signature is missing');
      status.textContent = 'Opens in a new tab.';
      const link = element('a', 'Open survey infographic (PDF)', card);
      link.href = path;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
    } catch (_) {
      if (!signal.aborted) status.textContent = missing;
    }
  }

  function showDish({country, dish}) {
    title(dish.name, country.name);
    const flag = document.createElement('img');
    flag.className = 'flag';
    flag.src = country.flag;
    flag.alt = '';
    $('panel-context').prepend(flag);
    element('p', ExhibitionScenery.modelStatus[dish.id] || '3D display unavailable', body, 'placeholder');
    element('p', dish.intro, body);
    element('h3', 'Cultural background', body);
    element('p', dish.background, body);
    if (dish.quote) {
      element('h3', 'Personal survey response', body);
      if (dish.quoteContext) element('p', dish.quoteContext, body);
      element('blockquote', '“' + dish.quote + '”', body);
    }
    if (dish.photos?.length) {
      element('h3', 'Reference photographs', body);
      const gallery = element('div', '', body, 'gallery');
      for (const photo of dish.photos) {
        picture(element('figure', '', gallery), photo, dish.name, 'This reference photograph is unavailable.');
      }
    }
    video(dish.video, 'Dish video', 'A dish video can be added here.');
  }

  function feedbackUrl(value) {
    try {
      const url = new URL(value);
      if (url.protocol !== 'https:' || url.username || url.password || url.port) return null;
      const short = url.hostname === 'forms.gle' && /^\/[A-Za-z0-9]+\/?$/.test(url.pathname);
      const long = url.hostname === 'docs.google.com' &&
        /^\/forms\/(?:u\/\d+\/)?d\/(?:e\/)?[A-Za-z0-9_-]+\/viewform\/?$/.test(url.pathname);
      return short || long ? url.href : null;
    } catch (_) {
      return null;
    }
  }

  function showExhibit(id) {
    if (panel.open && openedExhibit === id) return;
    openedExhibit = id;
    if (dishes.has(id)) {
      const entry = dishes.get(id);
      const fields = {island_id: entry.islandId, country_id: entry.countryId};
      if (!openedCountries.has(entry.countryId) && analytics.track('country_opened', fields)) {
        openedCountries.add(entry.countryId);
      }
      analytics.track('food_opened', {...fields, food_id: id});
      activities.stamp(entry.countryId, entry.islandId);
      showDish(entry);
      return;
    }
    const station = data.stations[id];
    if (!station) return;
    title(id === 'reflection' ? 'What Does Home Taste Like?' : station.title, data.islands[0].name);
    if (id === 'quiz') activities.renderQuiz(body);
    if (id === 'reflection') activities.renderReflection(body);
    if (station.text) element('p', station.text, body);
    if (id === 'feedback') {
      const fields = {island_id: data.islands[0].id};
      analytics.track('feedback_opened', fields);
      const url = feedbackUrl(station.formUrl);
      if (url) {
        const link = element('a', 'Give Feedback', body, 'feedback-link');
        link.href = url;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.addEventListener('click', () => analytics.track('feedback_link_clicked', fields));
        link.addEventListener('auxclick', event => {
          if (event.button === 1) analytics.track('feedback_link_clicked', fields);
        });
      } else {
        button('Give Feedback', body, () => {}).disabled = true;
        element('p', 'The feedback questionnaire will be available when its link is configured.', body, 'placeholder');
      }
    }
    if (id === 'welcome') video(station.video, 'Welcome video', 'The welcome video will appear here when available.');
    if (id === 'research') {
      const metrics = element('div', '', body, 'metrics');
      for (const {value, label} of station.metrics) {
        const card = element('div', '', metrics, 'metric');
        element('strong', value, card);
        element('span', label, card);
      }
      for (const finding of station.additionalFindings) element('p', finding, body);
      element('h3', 'Final survey infographic', body);
      surveyMedia(station.infographic);
    }
    if (id === 'interviews') for (const interview of station.interviews) {
      element('h3', interview.name, body);
      if (interview.role) element('p', interview.role, body);
      video(interview.video, 'Interview recording', 'This interview recording will appear here when available.', () => {
        if (!playedInterviews.has(interview.id) && analytics.track('interview_played', {
          island_id: data.islands[0].id, interview_id: interview.id
        })) {
          playedInterviews.add(interview.id);
        }
      });
    }
    if (id === 'vegetarian') {
      element('h3', 'Proposed dishes for a campus pilot', body);
      const list = element('ul', '', body);
      for (const idea of station.ideas) element('li', idea, list);
    }
    if (id === 'map') for (const island of data.islands.slice(1)) {
      const index = data.islands.indexOf(island);
      const countries = island.exhibits.map(key => data.countries[key].name).join(' · ');
      button(island.name + ' — ' + countries, body, () => {
        panel.close();
        visit(index);
      }, 'map-stop');
    }
  }

  function renderGuide() {
    const island = data.islands[active];
    $('island-title').textContent = island.name;
    [...$('islands').children].forEach((tab, index) => {
      tab.setAttribute('aria-current', index === active ? 'true' : 'false');
    });
    const exhibits = $('exhibits');
    exhibits.replaceChildren();
    for (const id of island.exhibits) {
      if (active === 0) {
        button(data.stations[id].title, exhibits, () => showExhibit(id), 'exhibit');
        continue;
      }
      const country = data.countries[id];
      const zone = element('section', '', exhibits, 'country');
      zone.style.borderInlineStart = '3px solid ' + country.color;
      zone.style.paddingInlineStart = '.55rem';
      const label = element('h3', '', zone);
      const flag = element('img', '', label, 'flag');
      flag.src = country.flag;
      flag.alt = '';
      element('span', country.name, label);
      for (const dish of country.dishes) button(dish.name, zone, () => showExhibit(dish.id), 'exhibit');
    }
  }

  function visit(index) {
    const changed = active !== index;
    active = index;
    if (changed) analytics.track('island_visited', {island_id: data.islands[active].id});
    renderGuide();
    world?.flyTo(index);
  }

  for (const island of data.islands.slice(1)) {
    for (const countryId of island.exhibits) {
      const country = data.countries[countryId];
      for (const dish of country.dishes) dishes.set(dish.id, {country, dish, countryId, islandId: island.id});
    }
  }
  data.islands.forEach((island, index) => button(island.short, $('islands'), () => visit(index)));
  $('home').addEventListener('click', () => visit(0));
  $('reset').addEventListener('click', () => world?.flyTo(active));
  panel.addEventListener('close', () => {
    if (!panel.open) {
      openedExhibit = null;
      clearPanel();
    }
  });

  const config = ISLE.DATA.defaultState();
  config.type = 'expo';
  config.meta.slug = 'more-than-a-meal';
  config.center.name = data.islands[0].name;
  config.islands = data.islands.slice(1).map((island, i) => ({
    ...ISLE.DATA.blankIsland(i + 1), name: island.name
  }));
  config.cinema = 'smooth';
  config.extras = [];
  config.animals = [];
  config.features = ['walkers'];
  config.detail = 3;
  world = ISLE.World.create($('world'), config, {
    decorateIsland: ExhibitionScenery.decorate,
    buildBridges: ExhibitionScenery.bridges,
    groundPalette: {top: '#75a467', beach: '#dfca96', rock: '#906a52'},
    waterColor: '#59a9ae',
    onPick(info) {
      if (info.kind === 'landmark') showExhibit(info.id);
      else if (info.kind === 'isle' && info.index !== active) visit(info.index);
    }
  });
  if (world) {
    world.setFog('#d8eee5');
    world.setTod(15.5, 'fixed');
    world.setReduced(mediaQuery.matches);
    mediaQuery.addEventListener('change', event => {
      world.setReduced(event.matches);
      world.flyTo(active);
    });
    world.setView({theta: .13, phi: .67, tx: 0, ty: 1, tz: 0,
      radius: world.isles[0].r * ($('world').clientWidth / $('world').clientHeight < .8 ? 4.7 : 3.1)});
  } else {
    $('gesture').textContent = '3D view unavailable. The exhibition guide is still interactive.';
    $('reset').disabled = true;
  }
  renderGuide();

  if (analytics.configured) {
    const settings = $('analytics-settings');
    const consent = $('analytics-choice');
    function setConsentVisible(visible) {
      consent.hidden = !visible;
      settings.setAttribute('aria-expanded', String(visible));
    }
    settings.hidden = false;
    settings.setAttribute('aria-controls', consent.id);
    setConsentVisible(analytics.choice() === null);
    settings.addEventListener('click', () => setConsentVisible(consent.hidden));
    for (const [id, choice] of [['analytics-allow', 'granted'], ['analytics-decline', 'denied']]) {
      $(id).addEventListener('click', () => {
        analytics.setChoice(choice, data.islands[active].id);
        setConsentVisible(false);
        settings.focus();
      });
    }
    analytics.enable(data.islands[active].id);
  }
})();
