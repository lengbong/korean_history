/*
 * 범이의 역사 탐험대 — 화면과 놀이 로직
 * 주소(#/...)에 따라 화면을 그리는 단일 페이지 앱입니다.
 * 한국사(js/data.js)와 세계사(js/world.js) 데이터를 함께 사용해요.
 */
(() => {
  'use strict';

  // 이름이 바뀌어도 기존 기록이 이어지도록 저장 키는 그대로 둬요
  const STORE_KEY = 'beomi-korean-history-v1';
  const AVATARS = ['🐯', '🐰', '🐻', '🦊', '🐼', '🐸', '🐧', '🦁', '🐶', '🐱', '🐹', '🐨'];
  const LEVELS = {
    1: { name: '쉬움', icon: '🌱', hint: '7~9살 추천 · 쉬운 말과 쉬운 문제' },
    2: { name: '보통', icon: '🌳', hint: '10살 이상 추천 · 더 자세한 이야기와 문제' },
    3: { name: '심화', icon: '🎓', hint: '중고생·어른 추천 · 한국사능력검정시험 심화 대비 (탐험·퀴즈는 보통 수준)' },
  };
  // 심화(3) 대원도 아이용 탐험·퀴즈에서는 보통(2) 수준으로 봐요
  const nextLevel = l => (l % 3) + 1;
  const TRACKS = {
    kr: { id: 'kr', name: '한국사', icon: '🐯', eras: ERAS, mix: 'mix' },
    world: { id: 'world', name: '세계사', icon: '🌍', eras: WORLD_ERAS, mix: 'mixw' },
  };
  const MIX_IDS = { mix: 'kr', mixw: 'world' };
  const ORDER_MODES = {
    kr: { name: '한국사', icon: '🐯', note: '우리나라 역사 속 사건을 차례대로 놓아요.' },
    world: { name: '세계사', icon: '🌍', note: '세계 역사 속 사건을 차례대로 놓아요.' },
    mix: { name: '섞어서', icon: '🔀', note: '한국사와 세계사 사건이 섞여 나와요. 피라미드와 고조선, 무엇이 먼저일까요?' },
  };
  const TYPE_NAMES = { person: '인물', heritage: '문화유산', symbol: '상징' };
  const QUIZ_LEN = 5;
  const MIX_LEN = 10;
  const MAX_PLAYERS = 8;
  const PRAISE = ['딩동댕! 정답이야! 🎉', '대단해! 역사 박사구나! 🎓', '맞았어! 최고야! 👍', '정답! 역시 우리 대원! ✨'];

  ERAS.forEach(e => { e.track = 'kr'; });
  WORLD_ERAS.forEach(e => { e.track = 'world'; });
  const ALL_ERAS = ERAS.concat(WORLD_ERAS);
  const ALL_QUESTIONS = QUESTIONS.concat(WORLD_QUESTIONS);
  const ALL_CARDS = CARDS.concat(WORLD_CARDS);
  const ALL_EVENTS = EVENTS.concat(WORLD_EVENTS);

  const $app = document.getElementById('app');
  const $hud = document.getElementById('hud');
  const eraById = Object.fromEntries(ALL_ERAS.map(e => [e.id, e]));
  const cardById = Object.fromEntries(ALL_CARDS.map(c => [c.id, c]));
  const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // 다른 파일(js/nations-view.js 등)이 화면 중간에 끼워 넣는 HTML
  const hooks = {};
  const hook = (name, ...args) => { try { return hooks[name] ? hooks[name](...args) : ''; } catch (e) { return ''; } };

  // ---------- 작은 도구 ----------
  const esc = s => String(s).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  const shuffle = arr => {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };
  const pick = arr => arr[Math.floor(Math.random() * arr.length)];
  // 받침이 있으면 ‘이야’, 없으면 ‘야’ (예: 이순신이야, 고려야)
  const iya = word => {
    const code = word.charCodeAt(word.length - 1);
    if (code < 0xac00 || code > 0xd7a3) return '(이)야';
    return (code - 0xac00) % 28 ? '이야' : '야';
  };
  const trackOf = item => eraById[item.era].track;
  const cardsOfEra = id => ALL_CARDS.filter(c => c.era === id);
  const cardsOfTrack = t => ALL_CARDS.filter(c => trackOf(c) === t);

  // ---------- 저장 (이 기기의 브라우저에만) ----------
  let state = load();

  function load() {
    const empty = { players: [], currentId: null, sound: true, track: 'kr', orderMode: 'kr' };
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (!raw) return empty;
      const saved = JSON.parse(raw);
      if (!saved || !Array.isArray(saved.players)) return empty;
      saved.players = saved.players.map(p => Object.assign(blankPlayer(), p));
      const s = Object.assign(empty, saved);
      if (!TRACKS[s.track]) s.track = 'kr';
      if (!ORDER_MODES[s.orderMode]) s.orderMode = 'kr';
      return s;
    } catch (e) {
      return empty;
    }
  }

  function save() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) { /* 저장이 막힌 브라우저 */ }
  }

  function blankPlayer() {
    return { id: '', name: '', avatar: AVATARS[0], level: 1, stars: 0, cards: [], stamps: [], best: {} };
  }

  const me = () => state.players.find(p => p.id === state.currentId) || null;

  function setTrack(t) {
    if (TRACKS[t] && state.track !== t) { state.track = t; save(); }
  }

  // ---------- 효과음 (Web Audio) ----------
  let actx = null;
  function tone(freq, start, dur, type = 'triangle', vol = 0.12) {
    if (!state.sound) return;
    try {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      if (actx.state === 'suspended') actx.resume();
      const t = actx.currentTime + start;
      const osc = actx.createOscillator();
      const gain = actx.createGain();
      osc.type = type;
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(vol, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      osc.connect(gain).connect(actx.destination);
      osc.start(t);
      osc.stop(t + dur + 0.05);
    } catch (e) { /* 소리를 낼 수 없는 환경 */ }
  }
  const sfx = {
    tap: () => tone(660, 0, 0.08, 'triangle', 0.05),
    good: () => { tone(784, 0, 0.15); tone(1047, 0.12, 0.3); },
    bad: () => { tone(260, 0, 0.18, 'sawtooth', 0.04); tone(196, 0.16, 0.28, 'sawtooth', 0.04); },
    win: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.12, 0.3)),
    card: () => [880, 1175, 1568].forEach((f, i) => tone(f, i * 0.08, 0.22, 'sine', 0.08)),
  };

  // ---------- 읽어 주기 (음성 합성) ----------
  const canSpeak = 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;
  function speak(text) {
    if (!canSpeak) return;
    try {
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'ko-KR';
      u.rate = 0.95;
      const voice = speechSynthesis.getVoices().find(v => /^ko/i.test(v.lang));
      if (voice) u.voice = voice;
      speechSynthesis.speak(u);
    } catch (e) { /* 음성 합성 실패 */ }
  }
  function stopSpeak() {
    if (canSpeak) try { speechSynthesis.cancel(); } catch (e) { /* 무시 */ }
  }
  const speakBtn = text => canSpeak
    ? `<button class="speak" type="button" data-speak="${esc(text)}">🔊 읽어 줘</button>`
    : '';

  // ---------- 꽃가루 ----------
  function confetti(n = 60) {
    if (reduceMotion) return;
    const box = document.createElement('div');
    box.className = 'confetti';
    box.setAttribute('aria-hidden', 'true');
    const colors = ['#e04848', '#f7b733', '#2a9a63', '#2f6fd0', '#8a5cc7', '#ff7eb6'];
    for (let i = 0; i < n; i++) {
      const bit = document.createElement('i');
      bit.style.left = Math.random() * 100 + '%';
      bit.style.background = pick(colors);
      bit.style.animationDelay = Math.random() * 0.4 + 's';
      bit.style.animationDuration = 1.6 + Math.random() * 1.4 + 's';
      box.appendChild(bit);
    }
    document.body.appendChild(box);
    setTimeout(() => box.remove(), 3500);
  }

  // ---------- 팝업 ----------
  let lastFocus = null;
  function openModal(html, label = '알림') {
    closeModal(false);
    lastFocus = document.activeElement;
    const wrap = document.createElement('div');
    wrap.className = 'modal';
    wrap.id = 'modal';
    wrap.innerHTML = `<div class="modal-box" role="dialog" aria-modal="true" aria-label="${esc(label)}" tabindex="-1">
      <button class="modal-x" type="button" data-close aria-label="닫기">✕</button>${html}</div>`;
    wrap.addEventListener('click', e => {
      if (e.target === wrap || e.target.closest('[data-close]')) closeModal();
    });
    document.body.appendChild(wrap);
    document.body.classList.add('no-scroll');
    wrap.querySelector('.modal-box').focus();
  }
  function closeModal(restoreFocus = true) {
    const m = document.getElementById('modal');
    if (!m) return;
    m.remove();
    document.body.classList.remove('no-scroll');
    stopSpeak();
    if (restoreFocus && lastFocus && document.contains(lastFocus)) lastFocus.focus();
  }

  // ---------- 공통 조각 ----------
  // 한국사/세계사 고르기 (base 주소 뒤에 /kr, /world를 붙인 링크)
  function trackSwitch(active, base) {
    return `<nav class="seg" aria-label="한국사·세계사 고르기">${Object.values(TRACKS).map(t =>
      `<a href="${base}/${t.id}" ${t.id === active ? 'aria-current="page"' : ''}>${t.icon} ${t.name}</a>`).join('')}</nav>`;
  }

  const eraChip = (era, withTrack) =>
    `<span class="chip" style="--era:${era.color}">${withTrack ? TRACKS[era.track].icon : era.emoji} ${esc(era.short)}</span>`;

  // ---------- 카드 ----------
  const art = c => (c.art && ART[c.id]) ? ART[c.id] : `<span aria-hidden="true">${c.emoji}</span>`;

  function cardTile(c, owned) {
    const era = eraById[c.era];
    if (!owned) {
      return `<button class="ctile locked" type="button" data-card="${c.id}" style="--era:${era.color}" aria-label="아직 못 모은 ${esc(era.short)} 카드">
        <span class="ctile-art" aria-hidden="true">❔</span><span class="ctile-name">???</span><span class="ctile-era">${esc(era.short)}</span></button>`;
    }
    return `<button class="ctile" type="button" data-card="${c.id}" style="--era:${era.color}">
      <span class="ctile-art">${art(c)}</span><span class="ctile-name">${esc(c.name)}</span><span class="ctile-era">${esc(era.short)}</span></button>`;
  }

  function bigCard(c) {
    const era = eraById[c.era];
    const track = TRACKS[era.track];
    return `<article class="bigcard" style="--era:${era.color}">
      <div class="bigcard-top"><span class="badge">${track.icon} ${track.name}</span><span class="badge">${TYPE_NAMES[c.type]}</span><span class="badge">${era.emoji} ${esc(era.short)}</span></div>
      <div class="bigcard-art">${art(c)}</div>
      <h2 class="bigcard-name">${esc(c.name)}</h2>
      <p class="bigcard-nick">“${esc(c.nick)}”</p>
      <p class="bigcard-desc">${esc(c.desc)}</p>
      <p class="bigcard-fact"><b>💡 알고 있니?</b> ${esc(c.fact)}</p>
      ${speakBtn(`${c.name}. ${c.nick}. ${c.desc} ${c.fact}`)}
    </article>`;
  }

  function showCard(id) {
    const c = cardById[id];
    if (!c) return;
    if (me().cards.includes(id)) {
      sfx.card();
      openModal(bigCard(c), c.name);
      return;
    }
    const era = eraById[c.era];
    openModal(`<div class="reward">
      <div class="big-emoji">🔒</div>
      <h2>아직 잠긴 카드예요</h2>
      <p><b>${esc(era.name)}</b> 이야기를 끝까지 읽거나, ${esc(era.short)} 퀴즈에서 3문제 이상 맞히면 얻을 수 있어요!</p>
      <div class="cta-row"><a class="btn btn-green" href="#/era/${era.id}">🗺️ 탐험하기</a><a class="btn btn-blue" href="#/quiz/${era.id}">❓ 퀴즈 풀기</a></div>
    </div>`, '잠긴 카드');
  }

  // 아직 없는 카드를 골라 줍니다 (era나 track으로 범위를 좁혀요)
  function takeLocked({ era, track } = {}, n) {
    const p = me();
    const pool = ALL_CARDS.filter(c =>
      (!era || c.era === era) && (!track || trackOf(c) === track) && !p.cards.includes(c.id));
    return shuffle(pool).slice(0, n);
  }

  function award(stars, cards = []) {
    const p = me();
    p.stars += stars;
    cards.forEach(c => { if (!p.cards.includes(c.id)) p.cards.push(c.id); });
    save();
    renderHud();
  }

  const rewardCards = cards => cards.length
    ? `<div class="reward-cards">${cards.map((c, i) => `<div class="flip" style="animation-delay:${0.3 + i * 0.35}s">${cardTile(c, true)}</div>`).join('')}</div>
       <p class="hint">카드를 누르면 자세히 볼 수 있어요.</p>`
    : '';

  // ---------- 머리글 ----------
  function renderHud() {
    const p = me();
    document.body.classList.toggle('no-player', !p);
    $hud.innerHTML = (p ? `
      <a class="hud-player" href="#/players" title="대원 바꾸기"><span class="hud-avatar" aria-hidden="true">${p.avatar}</span><span class="hud-name">${esc(p.name)}</span><span class="visually-hidden"> 대원 (대원 바꾸기)</span></a>
      <span class="hud-stat" title="모은 별"><span aria-hidden="true">⭐</span><span class="visually-hidden">별</span><b>${p.stars}</b></span>
      <span class="hud-stat" title="모은 카드"><span aria-hidden="true">🃏</span><span class="visually-hidden">카드</span><b>${p.cards.length}</b></span>` : '') +
      `<button class="hud-sound" type="button" data-action="sound" aria-pressed="${state.sound}" title="효과음 켜기/끄기"><span aria-hidden="true">${state.sound ? '🔊' : '🔇'}</span><span class="visually-hidden">효과음</span></button>`;
  }

  function setActiveTab(page) {
    const tab = { era: 'timeline', nations: 'timeline', nation: 'timeline', nstory: 'timeline', nquiz: 'quiz' }[page] || page;
    document.querySelectorAll('.tabs a').forEach(a => {
      if (a.dataset.tab === tab) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    });
  }

  function focusHeading() {
    const h = $app.querySelector('h1');
    if (!h) return;
    h.setAttribute('tabindex', '-1');
    h.focus({ preventScroll: true });
  }

  // ---------- 화면 이동 ----------
  function route() {
    stopSpeak();
    closeModal(false);
    const [rawPage, arg] = location.hash.replace(/^#\/?/, '').split('/');
    const page = rawPage || 'home';
    if (!me() && page !== 'players') {
      location.replace('#/players');
      return;
    }
    const views = Object.assign({ home: viewHome, timeline: viewTimeline, era: viewEra, quiz: viewQuiz, cards: viewCards, order: viewOrder, players: viewPlayers }, extraViews);
    (views[page] || viewHome)(arg);
    renderHud();
    setActiveTab(page);
    window.scrollTo(0, 0);
    focusHeading();
  }

  // ---------- 홈 ----------
  const ALL_FACTS = ALL_ERAS.flatMap(e => e.facts.map(f => ({ era: e, text: f })));

  function factHtml(f) {
    return `<p class="fact-text">${eraChip(f.era, true)} ${esc(f.text)}</p>
      <div class="row-gap"><button class="mini" type="button" data-action="next-fact">🎲 다른 이야기</button>${speakBtn(f.text)}</div>`;
  }

  function viewHome() {
    const p = me();
    const stamps = t => TRACKS[t].eras.filter(e => p.stamps.includes(e.id)).length;
    const examBanner = `
      <a class="exam-banner" href="#/exam">
        <span class="exam-banner-icon" aria-hidden="true">🎓</span>
        <span class="exam-banner-text"><b>한국사능력검정시험 심화 대비</b><small>중고생·어른용 · 개념 노트, 사료형 문제, 오답 노트, 실전 모의고사</small></span>
        <span class="exam-banner-go" aria-hidden="true">›</span>
      </a>`;
    const tile = (href, emoji, title, sub, color) =>
      `<a class="menu-tile" href="${href}" style="--tile:${color}"><span class="menu-emoji" aria-hidden="true">${emoji}</span><span class="menu-title">${title}</span><span class="menu-sub">${sub}</span></a>`;
    $app.innerHTML = `
      <section class="hero">
        <div class="mascot" aria-hidden="true">🐯</div>
        <div class="bubble">
          <h1>안녕, ${esc(p.name)} 대원!</h1>
          <p>나는 역사 탐험대장 <b>범이</b>야. 오늘은 어떤 모험을 떠나 볼까?</p>
        </div>
      </section>
      ${p.level === 3 ? examBanner : ''}
      <nav class="menu-grid" aria-label="놀이 고르기">
        ${tile('#/timeline/kr', '🗺️', '한국사 탐험', '선사 시대부터 지금의 대한민국까지 시간 여행', '#2a9a63')}
        ${tile('#/timeline/world', '🌍', '세계사 탐험', '피라미드부터 우주 탐사까지 세계 여행', '#1f8a8a')}
        ${tile('#/quiz', '❓', '역사 퀴즈', 'OX 퀴즈와 골라 맞히기에 도전!', '#2f6fd0')}
        ${tile('#/cards', '🃏', '카드 도감', '인물과 문화유산 카드를 모아요', '#8a5cc7')}
        ${tile('#/order', '🔢', '순서 맞추기', '무엇이 먼저 일어났을까?', '#e04848')}
      </nav>
      ${hook('home')}
      ${p.level === 3 ? '' : examBanner}
      <section class="panel">
        <h2>🎒 ${esc(p.name)} 대원의 탐험 기록</h2>
        <div class="stats">
          <div class="stat"><span class="stat-emoji" aria-hidden="true">🐯</span><span class="stat-num">${stamps('kr')} / ${ERAS.length}</span><span class="stat-label">한국사 도장</span></div>
          <div class="stat"><span class="stat-emoji" aria-hidden="true">🌍</span><span class="stat-num">${stamps('world')} / ${WORLD_ERAS.length}</span><span class="stat-label">세계사 도장</span></div>
          <div class="stat"><span class="stat-emoji" aria-hidden="true">🃏</span><span class="stat-num">${p.cards.length} / ${ALL_CARDS.length}</span><span class="stat-label">모은 카드</span></div>
          <div class="stat"><span class="stat-emoji" aria-hidden="true">⭐</span><span class="stat-num">${p.stars}</span><span class="stat-label">모은 별</span></div>
        </div>
      </section>
      <section class="panel">
        <h2>🤔 알쏭달쏭 역사 이야기</h2>
        <div id="fact">${factHtml(pick(ALL_FACTS))}</div>
      </section>
      <section class="panel tips">
        <h2>👨‍👩‍👧 가족과 함께 즐기는 방법</h2>
        <ul>
          <li>형·언니는 <b>보통</b>, 동생은 <b>쉬움</b>으로 각자 대원 등록을 해 보세요. 나이에 맞는 이야기와 문제가 나와요.</li>
          <li><b>🔊 읽어 줘</b> 버튼을 누르면 이야기를 소리 내어 읽어 줘요. 글을 읽기 어려운 동생도 함께할 수 있어요.</li>
          <li>시대 이야기 아래의 <b>‘그때 세계에서는?’</b> 상자를 보며 같은 때 우리나라와 세계에서 무슨 일이 있었는지 이야기해 보세요.</li>
          <li>퀴즈는 한 사람이 문제를 읽어 주고 다른 사람이 맞히는 방식으로 해 보세요.</li>
          <li>지갑 속 동전과 지폐에서 역사 인물과 문화유산을 찾아보세요. 10원·100원 동전, 만 원 지폐에 숨어 있어요!</li>
        </ul>
      </section>`;
  }

  // ---------- 시대 탐험 (연표) ----------
  function viewTimeline(arg) {
    if (TRACKS[arg]) setTrack(arg);
    const track = TRACKS[state.track];
    const p = me();
    const next = track.eras.find(e => !p.stamps.includes(e.id));
    $app.innerHTML = `
      <header class="page-head">
        <h1>${track.id === 'kr' ? '🗺️' : '🌍'} ${track.name} 탐험</h1>
        ${trackSwitch(track.id, '#/timeline')}
        <p>정거장을 눌러 그 시대로 시간 여행을 떠나요. 이야기를 끝까지 읽으면 <b>탐험 도장</b>과 <b>카드</b>를 받아요!</p>
      </header>
      ${hook('timeline', track.id)}
      <ol class="road">
        ${track.eras.map((e, i) => {
          const done = p.stamps.includes(e.id);
          const owned = cardsOfEra(e.id).filter(c => p.cards.includes(c.id)).length;
          const best = p.best[e.id];
          return `<li class="stop ${done ? 'done' : ''}" style="--era:${e.color}">
            <a class="stop-link" href="#/era/${e.id}">
              <span class="stop-dot" aria-hidden="true">${e.emoji}</span>
              <span class="stop-body">
                <span class="stop-no">${i + 1}번째 정거장${next === e ? ' <em class="here">여기부터!</em>' : ''}</span>
                <span class="stop-name">${esc(e.name)}</span>
                <span class="stop-period">${esc(e.period)}</span>
                <span class="stop-meta">${done ? '🎖️ 도장 받음' : '⬜ 도장 없음'} · 🃏 ${owned}/${cardsOfEra(e.id).length}${best != null ? ` · ⭐ 퀴즈 ${best}/${QUIZ_LEN}` : ''}</span>
              </span>
            </a>
          </li>`;
        }).join('')}
      </ol>`;
  }

  // ---------- 시대 이야기 ----------
  let eraState = null;

  function viewEra(id) {
    const e = eraById[id];
    if (!e) { location.replace('#/timeline'); return; }
    setTrack(e.track);
    eraState = { era: e, idx: 0 };
    const list = TRACKS[e.track].eras;
    const nextEra = list[list.indexOf(e) + 1];
    const compareTitle = e.track === 'kr' ? '🌍 그때 세계에서는?' : '🐯 그때 우리나라에서는?';
    $app.innerHTML = `
      <a class="back" href="#/timeline/${e.track}">← ${TRACKS[e.track].name} 연표로 돌아가기</a>
      <header class="era-banner" style="--era:${e.color}">
        <span class="era-emoji" aria-hidden="true">${e.emoji}</span>
        <div><p class="era-track">${TRACKS[e.track].icon} ${TRACKS[e.track].name}</p><h1>${esc(e.name)}</h1><p>${esc(e.period)}</p></div>
      </header>
      <section id="story" class="story"></section>
      <section class="panel compare ${e.track}">
        <h2>${compareTitle}</h2>
        <ul class="compare-list">
          ${(e.compare || []).map(c => {
            const other = eraById[c.era];
            return `<li>
              <span class="compare-emoji" aria-hidden="true">${c.emoji}</span>
              <div><p>${esc(c.text)}</p><a class="chip chip-link" href="#/era/${other.id}" style="--era:${other.color}">${TRACKS[other.track].icon} ${esc(other.short)} 보러 가기 ›</a></div>
            </li>`;
          }).join('')}
        </ul>
      </section>
      <section class="panel">
        <h2>🔑 핵심 낱말</h2>
        <p class="hint">낱말 카드를 누르면 뜻이 나와요. 뜻을 먼저 맞혀 보세요!</p>
        <div class="words">${e.words.map(([w, m]) => `<button class="word" type="button" data-action="flip-word" aria-pressed="false"><span class="word-front">${esc(w)}</span><span class="word-back">${esc(m)}</span></button>`).join('')}</div>
      </section>
      <section class="panel">
        <h2>🤔 재미있는 사실</h2>
        ${e.facts.map(f => `<p class="fact">${esc(f)}</p>`).join('')}
      </section>
      <section class="panel">
        <h2>🃏 이 시대의 카드</h2>
        <div class="card-grid small" id="era-cards"></div>
      </section>
      <div class="cta-row">
        <a class="btn btn-blue" href="#/quiz/${e.id}">❓ ${esc(e.short)} 퀴즈 도전!</a>
        ${nextEra ? `<a class="btn btn-ghost" href="#/era/${nextEra.id}">다음 시대: ${esc(nextEra.short)} ▶</a>` : ''}
      </div>`;
    renderStory(false);
    renderEraCards();
  }

  function renderEraCards() {
    const box = document.getElementById('era-cards');
    if (!box) return;
    const p = me();
    box.innerHTML = cardsOfEra(eraState.era.id).map(c => cardTile(c, p.cards.includes(c.id))).join('');
  }

  function renderStory(focusNext) {
    const { era: e, idx } = eraState;
    const s = e.slides[idx];
    const text = me().level === 1 ? s.easy : s.normal;
    const last = idx === e.slides.length - 1;
    const box = document.getElementById('story');
    box.innerHTML = `
      <div class="slide" style="--era:${e.color}">
        <div class="slide-emoji" aria-hidden="true">${s.emoji}</div>
        <h2 class="slide-title">${esc(s.title)}</h2>
        <p class="slide-text">${esc(text)}</p>
        ${speakBtn(`${s.title}. ${text}`)}
      </div>
      <div class="slide-nav">
        <button class="btn btn-ghost" type="button" data-action="slide-prev" ${idx === 0 ? 'disabled' : ''}>◀ 이전</button>
        <span class="dots" role="img" aria-label="${e.slides.length}쪽 중 ${idx + 1}쪽">${e.slides.map((_, i) => `<i class="${i === idx ? 'on' : ''}"></i>`).join('')}</span>
        <button class="btn btn-green" type="button" data-action="slide-next">${last ? '탐험 완료 🎖️' : '다음 ▶'}</button>
      </div>`;
    if (focusNext) box.querySelector('[data-action="slide-next"]').focus({ preventScroll: true });
  }

  function moveSlide(step) {
    const { era, idx } = eraState;
    const next = idx + step;
    stopSpeak();
    if (next >= era.slides.length) { finishEra(); return; }
    if (next < 0) return;
    eraState.idx = next;
    renderStory(true);
    const story = document.getElementById('story');
    if (story.getBoundingClientRect().top < 70) story.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
  }

  function finishEra() {
    const e = eraState.era;
    const p = me();
    if (p.stamps.includes(e.id)) {
      openModal(`<div class="reward">
        <div class="stamp" style="--era:${e.color}">${e.emoji}<span>${esc(e.short)}</span></div>
        <h2>${esc(e.short)} 탐험 완료!</h2>
        <p>이미 도장을 받았어요. 이제 퀴즈로 실력을 확인해 볼까?</p>
        <div class="cta-row"><a class="btn btn-blue" href="#/quiz/${e.id}">❓ 퀴즈 도전</a><button class="btn btn-ghost" type="button" data-close>📖 다시 읽기</button></div>
      </div>`, '탐험 완료');
      return;
    }
    p.stamps.push(e.id);
    const got = takeLocked({ era: e.id }, 1);
    award(3, got);
    renderEraCards();
    sfx.win();
    confetti();
    openModal(`<div class="reward">
      <div class="stamp" style="--era:${e.color}">${e.emoji}<span>${esc(e.short)}</span></div>
      <h2>탐험 도장 획득!</h2>
      <p>⭐ 별 3개${got.length ? '와 새 카드를' : '를'} 받았어요.</p>
      ${rewardCards(got)}
      <div class="cta-row"><a class="btn btn-blue" href="#/quiz/${e.id}">❓ 퀴즈 도전</a><a class="btn btn-ghost" href="#/timeline/${e.track}">🗺️ 연표로</a></div>
    </div>`, '탐험 도장 획득');
  }

  // ---------- 퀴즈 ----------
  let quiz = null;

  function viewQuiz(arg) {
    if (!arg || TRACKS[arg]) { viewQuizMenu(arg); return; }
    if (!MIX_IDS[arg] && !eraById[arg]) { location.replace('#/quiz'); return; }
    const track = MIX_IDS[arg] || eraById[arg].track;
    setTrack(track);
    quiz = { id: arg, track, qs: buildQuiz(arg), i: 0, score: 0, picked: null };
    $app.innerHTML = `<a class="back" href="#/quiz/${track}">← ${TRACKS[track].name} 퀴즈 고르기</a><div id="quiz"></div>`;
    renderQuestion();
  }

  function viewQuizMenu(arg) {
    if (TRACKS[arg]) setTrack(arg);
    const track = TRACKS[state.track];
    const p = me();
    const lv = LEVELS[p.level];
    const mixBest = p.best[track.mix];
    $app.innerHTML = `
      <header class="page-head quiz-menu-top">
        <h1>❓ ${track.name} 퀴즈</h1>
        ${trackSwitch(track.id, '#/quiz')}
        <p>시대를 골라 ${QUIZ_LEN}문제에 도전해요. <b>3문제 이상</b> 맞히면 그 시대의 카드를 1장, <b>만점</b>이면 2장 받아요!</p>
        <p>지금 난이도: <b>${lv.icon} ${lv.name}</b> · <a href="#/players">난이도 바꾸기</a></p>
      </header>
      <a class="mix-btn" href="#/quiz/${track.mix}">
        <span class="mix-emoji" aria-hidden="true">🎲</span>
        <span><b>${track.name} 모든 시대 섞어서 ${MIX_LEN}문제!</b><small>7문제 이상 맞히면 ${track.name} 카드 1장, 만점이면 2장${mixBest != null ? ` · 최고 기록 ⭐ ${mixBest}/${MIX_LEN}` : ''}</small></span>
      </a>
      <div class="era-grid">
        ${track.eras.map(e => {
          const best = p.best[e.id];
          return `<a class="era-tile" href="#/quiz/${e.id}" style="--era:${e.color}">
            <span class="era-tile-emoji" aria-hidden="true">${e.emoji}</span>
            <span class="era-tile-name">${esc(e.short)}</span>
            <span class="era-tile-best">${best != null ? `최고 ⭐ ${best}/${QUIZ_LEN}` : '아직 도전 전'}</span>
          </a>`;
        }).join('')}
      </div>
      ${hook('quizMenu', track.id)}`;
  }

  function buildQuiz(id) {
    const level = me().level;
    const allowed = q => level >= 2 || q.level === 1;
    let qs;
    if (MIX_IDS[id]) {
      // 시대마다 한 문제씩 뽑고, 모자란 만큼 더 채워요
      const perEra = TRACKS[MIX_IDS[id]].eras.map(e => shuffle(ALL_QUESTIONS.filter(q => q.era === e.id && allowed(q))));
      const firsts = perEra.map(list => list[0]).filter(Boolean);
      const rest = shuffle(perEra.flatMap(list => list.slice(1)));
      qs = shuffle(firsts.concat(rest).slice(0, MIX_LEN));
    } else {
      const pool = ALL_QUESTIONS.filter(q => q.era === id && allowed(q));
      if (level >= 2) {
        const hard = shuffle(pool.filter(q => q.level === 2)).slice(0, 3);
        const easy = shuffle(pool.filter(q => q.level === 1)).slice(0, QUIZ_LEN - hard.length);
        qs = shuffle(hard.concat(easy));
      } else {
        qs = shuffle(pool).slice(0, QUIZ_LEN);
      }
    }
    return qs.map(q => q.type === 'mc'
      ? Object.assign({}, q, { opts: shuffle(q.choices), right: q.choices[0] })
      : Object.assign({}, q, { opts: ['O', 'X'], right: q.answer ? 'O' : 'X' }));
  }

  function renderQuestion() {
    const box = document.getElementById('quiz');
    const q = quiz.qs[quiz.i];
    const total = quiz.qs.length;
    const era = eraById[q.era];
    const answered = quiz.picked !== null;
    const correct = answered && quiz.picked === q.right;
    const done = quiz.i + (answered ? 1 : 0);
    const cls = o => !answered ? '' : o === q.right ? 'right' : o === quiz.picked ? 'wrong' : 'dim';

    const options = q.type === 'ox'
      ? `<div class="ox">${['O', 'X'].map(o => `
          <button type="button" class="ox-btn ${o === 'O' ? 'o' : 'x'} ${cls(o)}" data-answer="${o}" ${answered ? 'disabled' : ''}>
            <span class="ox-mark" aria-hidden="true">${o === 'O' ? '⭕' : '❌'}</span><span>${o === 'O' ? '맞아요' : '틀려요'}</span>
          </button>`).join('')}</div>`
      : `<div class="choices">${q.opts.map((o, i) => `
          <button type="button" class="choice ${cls(o)}" data-answer="${esc(o)}" ${answered ? 'disabled' : ''}>
            <span class="choice-no" aria-hidden="true">${i + 1}</span>${esc(o)}
          </button>`).join('')}</div>`;

    const readText = q.type === 'mc'
      ? `${q.q} 보기. ${q.opts.map((o, i) => `${i + 1}번, ${o}`).join('. ')}`
      : `${q.q} 맞으면 오, 틀리면 엑스.`;

    box.innerHTML = `
      <div class="quiz-top">
        ${eraChip(era, false)}
        <span>${quiz.i + 1} / ${total}</span>
        <span>⭐ ${quiz.score}</span>
      </div>
      <div class="bar" role="progressbar" aria-label="진행" aria-valuemin="0" aria-valuemax="${total}" aria-valuenow="${done}"><i style="width:${(done / total) * 100}%"></i></div>
      <section class="qcard ${answered ? '' : 'enter'}">
        <span class="qtype">${q.type === 'ox' ? '⭕❌ OX 퀴즈' : '골라 맞히기'}</span>
        <h1 class="qtext">${esc(q.q)}</h1>
        ${speakBtn(readText)}
        ${options}
      </section>
      ${answered ? `
        <section class="feedback ${correct ? 'good' : 'bad'}" role="status">
          <div class="fb-head"><span class="fb-mascot" aria-hidden="true">🐯</span><strong>${correct ? pick(PRAISE)
            : q.type === 'ox' ? `아쉬워! 이 문장은 ${q.right === 'O' ? '⭕ 맞는' : '❌ 틀린'} 말이야.`
            : `아쉬워! 정답은 ‘${esc(q.right)}’${iya(q.right)}.`}</strong></div>
          <p>${esc(q.explain)}</p>
          <button class="btn btn-blue" type="button" data-action="next-q">${quiz.i + 1 < total ? '다음 문제 ▶' : '결과 보기 🏆'}</button>
        </section>` : ''}`;
    if (answered) {
      const next = box.querySelector('[data-action="next-q"]');
      next.focus({ preventScroll: true });
      next.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'nearest' });
    }
  }

  function answer(value) {
    if (!quiz || quiz.picked !== null) return;
    const q = quiz.qs[quiz.i];
    quiz.picked = value;
    if (value === q.right) {
      quiz.score++;
      sfx.good();
      confetti(30);
    } else {
      sfx.bad();
    }
    renderQuestion();
  }

  function nextQuestion() {
    stopSpeak();
    if (quiz.i + 1 < quiz.qs.length) {
      quiz.i++;
      quiz.picked = null;
      renderQuestion();
      window.scrollTo(0, 0);
      focusHeading();
    } else {
      finishQuiz();
    }
  }

  function finishQuiz() {
    const p = me();
    const { id, track, score, qs } = quiz;
    const total = qs.length;
    const isMix = !!MIX_IDS[id];
    if (p.best[id] == null || score > p.best[id]) p.best[id] = score;

    const pass = isMix ? 7 : 3;
    const want = score === total ? 2 : score >= pass ? 1 : 0;
    const got = takeLocked(isMix ? { track } : { era: id }, want);
    const bonus = (want - got.length) * 2; // 카드를 다 모았으면 대신 별을 더 줘요
    award(score + bonus, got);

    const ratio = score / total;
    const msg = ratio === 1 ? '만점! 너는 진정한 역사 박사야! 🏆'
      : ratio >= 0.6 ? '잘했어! 조금만 더 하면 만점이야! 💪'
      : '괜찮아! 이야기를 다시 읽고 또 도전해 보자! 📖';
    sfx.win();
    if (ratio >= 0.6) confetti();

    const era = eraById[id];
    $app.innerHTML = `
      <section class="panel result">
        <div class="mascot" aria-hidden="true">${ratio === 1 ? '🥳' : ratio >= 0.6 ? '😺' : '🐯'}</div>
        <h1 class="result-score">${total}문제 중 ${score}문제 정답!</h1>
        <div class="result-stars" aria-hidden="true">${'⭐'.repeat(score)}${'☆'.repeat(total - score)}</div>
        <p class="result-msg">${msg}</p>
        <p>별 <b>${score + bonus}개</b>를 받았어요.${bonus ? ` (카드를 모두 모아서 보너스 별 ${bonus}개 포함!)` : ''}</p>
        ${got.length ? `<h2>🎁 새 카드 획득!</h2>${rewardCards(got)}`
          : want === 0 ? `<p class="hint">${pass}문제 이상 맞히면 카드를 받을 수 있어요!</p>` : ''}
        <div class="cta-row">
          <button class="btn btn-blue" type="button" data-action="retry-quiz">🔄 다시 도전</button>
          ${era ? `<a class="btn btn-green" href="#/era/${era.id}">📖 ${esc(era.short)} 이야기 보기</a>` : ''}
          <a class="btn btn-ghost" href="#/quiz/${track}">다른 퀴즈 고르기</a>
        </div>
      </section>`;
    window.scrollTo(0, 0);
    focusHeading();
    if (got.length) setTimeout(sfx.card, 700);
  }

  // ---------- 카드 도감 ----------
  function viewCards(arg) {
    let filter = 'all';
    if (TRACKS[arg]) setTrack(arg);
    else if (eraById[arg]) { setTrack(eraById[arg].track); filter = arg; }
    const track = TRACKS[state.track];
    const p = me();
    const pool = cardsOfTrack(track.id);
    const list = filter === 'all' ? pool : cardsOfEra(filter);
    const owned = c => p.cards.includes(c.id);
    const have = pool.filter(owned).length;
    const tabs = [{ href: `#/cards/${track.id}`, on: filter === 'all', label: '전체', count: have, total: pool.length }]
      .concat(track.eras.map(e => ({
        href: `#/cards/${e.id}`, on: filter === e.id, label: e.short,
        count: cardsOfEra(e.id).filter(owned).length, total: cardsOfEra(e.id).length,
      })));
    $app.innerHTML = `
      <header class="page-head">
        <h1>🃏 카드 도감</h1>
        ${trackSwitch(track.id, '#/cards')}
        <p>이야기를 끝까지 읽고 퀴즈를 풀면 카드가 모여요. 카드를 눌러 이야기를 읽어 보세요!</p>
      </header>
      <div class="meter">
        <span>${track.icon} ${track.name} 카드 <b>${have}</b> / ${pool.length}${have === pool.length ? ' 🎉 모두 모았어요!' : ''}</span>
        <div class="bar"><i style="width:${(have / pool.length) * 100}%"></i></div>
        <small class="hint">한국사·세계사 모두 합쳐 ${p.cards.length} / ${ALL_CARDS.length}장</small>
      </div>
      <nav class="filters" aria-label="시대별로 보기">
        ${tabs.map(t => `<a class="filter ${t.on ? 'on' : ''}" href="${t.href}" ${t.on ? 'aria-current="true"' : ''}>${esc(t.label)} <small>${t.count}/${t.total}</small></a>`).join('')}
      </nav>
      <div class="card-grid">${list.map(c => cardTile(c, owned(c))).join('')}</div>`;
  }

  // ---------- 순서 맞추기 ----------
  let order = null;

  function viewOrder(arg) {
    if (ORDER_MODES[arg] && state.orderMode !== arg) { state.orderMode = arg; save(); }
    const mode = state.orderMode;
    $app.innerHTML = `
      <header class="page-head">
        <h1>🔢 순서 맞추기</h1>
        <nav class="seg" aria-label="문제 종류 고르기">${Object.entries(ORDER_MODES).map(([id, m]) =>
          `<a href="#/order/${id}" ${id === mode ? 'aria-current="page"' : ''}>${m.icon} ${m.name}</a>`).join('')}</nav>
        <p>${ORDER_MODES[mode].note} 아래 사건 카드를 <b>옛날 일부터</b> 차례대로 눌러 칸에 넣어요.</p>
      </header>
      <div id="order"></div>`;
    newOrderRound();
  }

  // ‘약’, ‘무렵’이 붙은 연도는 대략이라서, 너무 가까운 사건끼리는 함께 내지 않아요
  const isApprox = ev => /약|무렵/.test(ev.when);
  function separable(a, b, minGap) {
    const gap = Math.abs(a.year - b.year);
    if (gap < minGap) return false;
    return isApprox(a) || isApprox(b) ? gap >= 100 : gap > 0;
  }
  function pickSeparated(pool, n, minGap) {
    const picks = [];
    for (const ev of shuffle(pool)) {
      if (picks.every(p => separable(p, ev, minGap))) picks.push(ev);
      if (picks.length === n) break;
    }
    return picks;
  }

  function newOrderRound() {
    const level = me().level;
    const mode = state.orderMode;
    const n = level === 1 ? 3 : 5;
    const pool = mode === 'mix' ? ALL_EVENTS : ALL_EVENTS.filter(ev => trackOf(ev) === mode);
    let picks;
    if (level === 1 && mode !== 'mix') {
      // 쉬움: 서로 다른 시대에서 하나씩 (시대 이름표가 힌트가 돼요)
      picks = shuffle(TRACKS[mode].eras).slice(0, n).map(e => pick(pool.filter(ev => ev.era === e.id)));
    } else {
      // 섞어서(쉬움)는 300년 이상 떨어진 사건끼리만 나와요
      picks = pickSeparated(pool, n, level === 1 ? 300 : 0);
    }
    order = { items: shuffle(picks), slots: Array(picks.length).fill(null), checked: false, hint: level === 1, level, mode, result: null };
    renderOrder();
  }

  function eventInner(ev) {
    const era = eraById[ev.era];
    return `<span class="ev-emoji" aria-hidden="true">${ev.emoji}</span><span class="ev-label">${esc(ev.label)}</span>${order.hint
      ? `<span class="chip small" style="--era:${era.color}">${order.mode === 'mix' ? TRACKS[era.track].icon + ' ' : ''}${esc(era.short)}</span>` : ''}`;
  }

  function renderOrder() {
    const box = document.getElementById('order');
    if (!box) return;
    const o = order;
    const n = o.slots.length;
    const placed = new Set(o.slots.filter(Boolean));
    const sorted = o.items.slice().sort((a, b) => a.year - b.year);
    const full = o.slots.every(Boolean);

    const slots = o.slots.map((ev, i) => {
      let cls = ev ? 'filled' : '';
      let when = '';
      if (o.checked) {
        cls += ev === sorted[i] ? ' right' : ' wrong';
        when = `<span class="when">${esc(ev.when)}</span>`;
      }
      const label = i === 0 ? '가장 옛날' : i === n - 1 ? '가장 최근' : '';
      return `<li class="slot ${cls}">
        <span class="slot-no" aria-hidden="true">${i + 1}</span>
        ${ev
          ? `<button class="event" type="button" data-action="unplace" data-i="${i}" ${o.checked ? 'disabled' : ''} aria-label="${i + 1}번째: ${esc(ev.label)}${o.checked ? '' : ' (눌러서 빼기)'}">${eventInner(ev)}${when}</button>`
          : `<span class="slot-empty">${i + 1}번째${label ? ` · ${label}` : ''}</span>`}
      </li>`;
    }).join('');

    let bottom;
    if (o.checked) {
      const { ok, got, bonus } = o.result;
      bottom = `<section class="feedback ${ok === n ? 'good' : 'bad'}" role="status">
        <div class="fb-head"><span class="fb-mascot" aria-hidden="true">🐯</span><strong>${ok === n ? '완벽해! 시간 여행 박사구나!' : `${n}개 중 ${ok}개 맞았어! 바른 순서를 확인해 보자.`}</strong></div>
        ${ok < n ? `<ol class="answer-list">${sorted.map(ev => `<li><b>${esc(ev.when)}</b> ${esc(ev.label)}</li>`).join('')}</ol>` : ''}
        <p>⭐ 별 ${ok + bonus}개를 받았어요.${bonus ? ' (카드를 모두 모아서 보너스 별!)' : ''}</p>
        ${got.length ? `<h3>🎁 보너스 카드!</h3>${rewardCards(got)}` : ''}
      </section>
      <div class="cta-row"><button class="btn btn-green" type="button" data-action="order-new">🔄 새 문제</button></div>`;
    } else {
      bottom = `
        <h2 class="visually-hidden">사건 카드</h2>
        <div class="pool">${o.items.map((ev, k) => placed.has(ev) ? '' : `<button class="event" type="button" data-action="place" data-k="${k}">${eventInner(ev)}</button>`).join('')}</div>
        <div class="cta-row">
          ${o.level >= 2 ? `<button class="btn btn-ghost" type="button" data-action="order-hint" aria-pressed="${o.hint}">💡 시대 힌트 ${o.hint ? '끄기' : '보기'}</button>` : ''}
          <button class="btn btn-ghost" type="button" data-action="order-reset" ${placed.size ? '' : 'disabled'}>↩ 처음부터</button>
          <button class="btn btn-blue" type="button" data-action="order-check" ${full ? '' : 'disabled'}>✅ 정답 확인</button>
        </div>`;
    }
    box.innerHTML = `<ol class="slots">${slots}</ol>${bottom}`;
  }

  function placeEvent(k) {
    const ev = order.items[k];
    const slot = order.slots.indexOf(null);
    if (!ev || slot < 0 || order.slots.includes(ev)) return;
    order.slots[slot] = ev;
    sfx.tap();
    renderOrder();
    const nextBtn = document.querySelector('.pool .event') || document.querySelector('[data-action="order-check"]');
    if (nextBtn) nextBtn.focus({ preventScroll: true });
  }

  function unplaceEvent(i) {
    if (order.checked) return;
    // 뺀 칸 뒤의 사건들은 한 칸씩 앞으로 당겨요
    const rest = order.slots.filter((ev, j) => ev && j !== i);
    order.slots = order.slots.map((_, j) => rest[j] || null);
    sfx.tap();
    renderOrder();
  }

  function checkOrder() {
    const sorted = order.items.slice().sort((a, b) => a.year - b.year);
    const n = order.slots.length;
    const ok = order.slots.filter((ev, i) => ev === sorted[i]).length;
    let got = [];
    let bonus = 0;
    if (ok === n) {
      got = takeLocked({ track: order.mode === 'mix' ? null : order.mode }, 1);
      if (!got.length) bonus = 2;
      sfx.win();
      confetti();
    } else {
      sfx.bad();
    }
    award(ok + bonus, got);
    order.checked = true;
    order.result = { ok, got, bonus };
    renderOrder();
    const fb = document.querySelector('#order .feedback');
    if (fb) fb.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'nearest' });
  }

  // ---------- 대원 (가족 프로필) ----------
  function viewPlayers() {
    const first = state.players.length === 0;
    const canAdd = state.players.length < MAX_PLAYERS;
    $app.innerHTML = `
      <header class="page-head">
        <h1>${first ? '🐯 역사 탐험대에 온 걸 환영해!' : '👨‍👩‍👧 탐험 대원'}</h1>
        <p>${first ? '먼저 탐험 대원으로 등록해 줘. 가족 모두 각자 등록할 수 있어요!' : '누가 탐험할 차례인가요? 대원을 눌러 바꿀 수 있어요.'}</p>
      </header>
      ${state.players.length ? `<ul class="players">${state.players.map(p => {
        const lv = LEVELS[p.level];
        const on = p.id === state.currentId;
        return `<li class="player ${on ? 'on' : ''}">
          <button class="player-main" type="button" data-action="choose" data-id="${p.id}">
            <span class="player-avatar" aria-hidden="true">${p.avatar}</span>
            <span class="player-info"><b>${esc(p.name)}</b><small>${lv.icon} ${lv.name} · ⭐ ${p.stars} · 🃏 ${p.cards.length}/${ALL_CARDS.length} · 🎖️ ${p.stamps.length}/${ALL_ERAS.length}</small></span>
            ${on ? '<span class="now">지금 대원</span>' : ''}
          </button>
          <div class="player-tools">
            <button class="mini" type="button" data-action="toggle-level" data-id="${p.id}">난이도: ${lv.icon} ${lv.name} → ${LEVELS[nextLevel(p.level)].icon} ${LEVELS[nextLevel(p.level)].name}</button>
            <button class="mini danger" type="button" data-action="delete" data-id="${p.id}">🗑️ 삭제</button>
          </div>
        </li>`;
      }).join('')}</ul>` : ''}
      ${canAdd ? `
      <form class="panel" id="new-player" autocomplete="off">
        <h2>${first ? '🎒 대원 등록' : '➕ 새 대원 등록'}</h2>
        <label class="field"><span>이름 (별명도 좋아요)</span><input name="name" type="text" maxlength="8" required placeholder="예: 하늘이"></label>
        <fieldset class="field">
          <legend>캐릭터 고르기</legend>
          <div class="avatars">${AVATARS.map((a, i) => `<label class="avatar-opt"><input type="radio" name="avatar" value="${a}" ${i === 0 ? 'checked' : ''}><span>${a}</span></label>`).join('')}</div>
        </fieldset>
        <fieldset class="field">
          <legend>난이도</legend>
          <div class="levels">${[1, 2, 3].map(l => `<label class="level-opt"><input type="radio" name="level" value="${l}" ${l === 1 ? 'checked' : ''}><span><b>${LEVELS[l].icon} ${LEVELS[l].name}</b><small>${LEVELS[l].hint}</small></span></label>`).join('')}</div>
        </fieldset>
        <button class="btn btn-green" type="submit">🚀 탐험 시작!</button>
      </form>` : `<p class="hint">대원은 ${MAX_PLAYERS}명까지 등록할 수 있어요.</p>`}`;
  }

  function addPlayer(form) {
    const data = new FormData(form);
    const name = String(data.get('name') || '').trim().slice(0, 8);
    if (!name) { form.querySelector('input[name="name"]').focus(); return; }
    const p = Object.assign(blankPlayer(), {
      id: 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      name,
      avatar: AVATARS.includes(data.get('avatar')) ? data.get('avatar') : AVATARS[0],
      level: LEVELS[data.get('level')] ? Number(data.get('level')) : 1,
    });
    state.players.push(p);
    state.currentId = p.id;
    save();
    sfx.win();
    // 심화 대원은 바로 한능검 심화 학습으로 안내해요
    location.hash = p.level === 3 ? '#/exam' : '#/home';
  }

  function deletePlayer(id) {
    const p = state.players.find(x => x.id === id);
    if (!p) return;
    if (!window.confirm(`정말 ‘${p.name}’ 대원의 기록을 모두 지울까요?\n지운 기록은 되돌릴 수 없어요.`)) return;
    state.players = state.players.filter(x => x.id !== id);
    if (state.currentId === id) state.currentId = state.players[0] ? state.players[0].id : null;
    save();
    route();
  }

  // ---------- 다른 파일(js/exam-view.js 등)이 화면을 덧붙일 수 있게 ----------
  const extraViews = {};
  window.HistoryApp = {
    registerView: (page, fn) => { extraViews[page] = fn; },
    // 화면 중간에 다른 파일이 HTML을 끼워 넣는 자리 (home, timeline, quizMenu)
    registerHook: (name, fn) => { hooks[name] = fn; },
    me, save, esc, shuffle, pick, sfx, confetti, openModal, closeModal, focusHeading,
    award, cardTile, rewardCards, speakBtn, stopSpeak, cardById, eraById,
  };

  // ---------- 이벤트 ----------
  document.addEventListener('click', e => {
    const t = e.target;

    const speakEl = t.closest('[data-speak]');
    if (speakEl) { speak(speakEl.dataset.speak); return; }

    // 지금 보고 있는 주소를 다시 누르면 화면을 새로 그려요 (예: 새 문제)
    const link = t.closest('a[href^="#/"]');
    if (link) {
      if (link.getAttribute('href') === location.hash) { e.preventDefault(); route(); }
      sfx.tap();
      return;
    }

    const cardEl = t.closest('[data-card]');
    if (cardEl) { showCard(cardEl.dataset.card); return; }

    const ans = t.closest('[data-answer]');
    if (ans && !ans.disabled) { answer(ans.dataset.answer); return; }

    const act = t.closest('[data-action]');
    if (!act || act.disabled) return;
    switch (act.dataset.action) {
      case 'sound':
        state.sound = !state.sound;
        save();
        renderHud();
        sfx.tap();
        break;
      case 'next-fact':
        document.getElementById('fact').innerHTML = factHtml(pick(ALL_FACTS));
        document.querySelector('[data-action="next-fact"]').focus();
        sfx.tap();
        break;
      case 'flip-word': {
        const on = act.getAttribute('aria-pressed') !== 'true';
        act.setAttribute('aria-pressed', String(on));
        sfx.tap();
        break;
      }
      case 'slide-next': moveSlide(1); sfx.tap(); break;
      case 'slide-prev': moveSlide(-1); sfx.tap(); break;
      case 'next-q': nextQuestion(); break;
      case 'retry-quiz': viewQuiz(quiz.id); window.scrollTo(0, 0); focusHeading(); break;
      case 'place': placeEvent(Number(act.dataset.k)); break;
      case 'unplace': unplaceEvent(Number(act.dataset.i)); break;
      case 'order-reset': order.slots = order.slots.map(() => null); renderOrder(); sfx.tap(); break;
      case 'order-hint': order.hint = !order.hint; renderOrder(); sfx.tap(); break;
      case 'order-check': checkOrder(); break;
      case 'order-new': newOrderRound(); window.scrollTo(0, 0); sfx.tap(); break;
      case 'choose':
        state.currentId = act.dataset.id;
        save();
        sfx.tap();
        location.hash = '#/home';
        break;
      case 'toggle-level': {
        const target = state.players.find(x => x.id === act.dataset.id);
        if (target) { target.level = nextLevel(target.level); save(); viewPlayers(); sfx.tap(); }
        break;
      }
      case 'delete': deletePlayer(act.dataset.id); break;
    }
  });

  document.addEventListener('submit', e => {
    if (e.target.id === 'new-player') { e.preventDefault(); addPlayer(e.target); }
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') { closeModal(); return; }
    // 퀴즈: 숫자 키(1~4)나 O/X 키로 답하기
    if (!quiz || quiz.picked !== null || !document.getElementById('quiz') || document.getElementById('modal')) return;
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    const q = quiz.qs[quiz.i];
    const key = e.key.toLowerCase();
    if (q.type === 'mc' && /^[1-4]$/.test(key)) answer(q.opts[Number(key) - 1]);
    if (q.type === 'ox' && (key === 'o' || key === 'x')) answer(key.toUpperCase());
  });

  window.addEventListener('hashchange', route);
  if (canSpeak) try { speechSynthesis.getVoices(); } catch (e) { /* 목소리 목록 미리 불러오기 */ }
  // 뒤에 오는 스크립트가 화면을 등록할 수 있도록 문서를 다 읽은 뒤 첫 화면을 그려요
  document.addEventListener('DOMContentLoaded', route);
})();
