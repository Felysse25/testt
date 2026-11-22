(() => {
  const measurementId = EXHIBITION.analytics.measurementId.trim();
  const configured = /^G-[A-Z0-9]{6,16}$/.test(measurementId) && measurementId !== 'G-XXXXXXXXXX';
  const storageKey = 'more-than-a-meal.analytics.v1';
  const disableKey = 'ga-disable-' + measurementId;
  const landing = new URL(location.href);
  const debug = landing.searchParams.get('ga_debug') === '1';
  const qrTags = {utm_source: 'qr', utm_medium: 'offline', utm_campaign: 'more_than_a_meal'};
  const qrCampaign = Object.entries(qrTags).every(([key, value]) => landing.searchParams.get(key) === value);
  landing.search = '';
  landing.hash = '';
  if (qrCampaign) for (const [key, value] of Object.entries(qrTags)) landing.searchParams.set(key, value);

  let choice = null;
  try {
    const saved = localStorage.getItem(storageKey);
    if (saved === 'granted' || saved === 'denied') choice = saved;
  } catch (_) {
    // A browser that blocks storage can still honor an in-page choice.
  }

  const eventFields = {
    page_view: [],
    exhibition_started: ['island_id'],
    island_visited: ['island_id'],
    country_opened: ['island_id', 'country_id'],
    food_opened: ['island_id', 'country_id', 'food_id'],
    interview_played: ['island_id', 'interview_id'],
    feedback_opened: ['island_id'],
    feedback_link_clicked: ['island_id'],
    passport_stamp_collected: ['island_id', 'country_id'],
    passport_completed: [],
    quiz_started: [],
    quiz_completed: [],
    reflection_saved: []
  };
  const validIds = {
    island_id: new Set(EXHIBITION.islands.map(island => island.id)),
    country_id: new Set(Object.keys(EXHIBITION.countries)),
    food_id: new Set(Object.values(EXHIBITION.countries).flatMap(country => country.dishes.map(dish => dish.id))),
    interview_id: new Set(EXHIBITION.stations.interviews.interviews.map(interview => interview.id))
  };
  const adsDenied = {ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied'};
  let tagStarted = false;
  let pageTracked = false;
  let tag;

  function track(name, parameters = {}) {
    if (!configured || choice !== 'granted' || !tag || !Object.prototype.hasOwnProperty.call(eventFields, name)) return false;
    const fields = {};
    for (const key of eventFields[name]) {
      if (validIds[key].has(parameters[key])) fields[key] = parameters[key];
    }
    tag('event', name, {...fields, send_to: measurementId});
    return true;
  }

  function enable(islandId) {
    if (!configured || choice !== 'granted') return;
    window[disableKey] = false;
    if (!tagStarted) {
      tagStarted = true;
      window.dataLayer = window.dataLayer || [];
      tag = function () { window.dataLayer.push(arguments); };
      tag('consent', 'default', {...adsDenied, analytics_storage: 'granted'});
      tag('js', new Date());
      tag('config', measurementId, {
        send_page_view: false,
        allow_google_signals: false,
        allow_ad_personalization_signals: false,
        page_location: landing.href,
        page_referrer: '',
        ...(qrCampaign ? {campaign_source: 'qr', campaign_medium: 'offline', campaign_name: 'more_than_a_meal'} : {}),
        ...(debug ? {debug_mode: true} : {})
      });
      const script = document.createElement('script');
      script.async = true;
      script.referrerPolicy = 'no-referrer';
      script.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(measurementId);
      document.head.append(script);
    } else {
      tag('consent', 'update', {...adsDenied, analytics_storage: 'granted'});
    }
    if (!pageTracked) {
      pageTracked = true;
      track('page_view');
      track('exhibition_started', {island_id: islandId});
      track('island_visited', {island_id: islandId});
    }
  }

  function setChoice(value, islandId) {
    if (!configured || value === choice || !['granted', 'denied'].includes(value)) return;
    choice = value;
    try { localStorage.setItem(storageKey, value); } catch (_) {}
    if (value === 'granted') enable(islandId);
    else {
      window[disableKey] = true;
      if (tag) tag('consent', 'update', {...adsDenied, analytics_storage: 'denied'});
    }
  }

  window.ExhibitionAnalytics = {configured, enable, track, setChoice, choice: () => choice};
})();
