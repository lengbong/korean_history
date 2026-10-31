/*
 * 범이의 역사 탐험대 — 나라별 세계사 화면
 * 주소: #/nations (나라 고르기), #/nation/<나라>, #/nstory/<이야기>, #/nquiz/<나라>
 * 데이터: js/nations.js(지역·순서), js/nations-*.js(나라 이야기·사진·퀴즈)
 * 기록은 대원별로 player.nations = { read: [이야기 id], stamps: [나라 id], best: {나라: 점수}, mode } 에 저장해요.
 */
(() => {
  'use strict';

  const A = window.HistoryApp;
  if (!A || typeof NATIONS === 'undefined') return;
  const esc = A.esc;
  const $app = document.getElementById('app');
  const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const QUIZ_LEN = 5;
  const MODES = {
    easy: { icon: '🌱', name: '쉬운 이야기' },
    normal: { icon: '🌳', name: '자세한 이야기' },
    deep: { icon: '🎓', name: '어른용 이야기' },
  };
  const PRAISE = ['딩동댕! 정답이야! 🎉', '대단해! 세계사 박사구나! 🌍', '맞았어! 최고야! 👍', '정답! 역시 우리 대원! ✨'];

  // NATION_ORDER 순서대로, 순서표에 없는 나라는 뒤에 붙여요
  const LIST = NATION_ORDER.map(id => NATIONS.find(n => n.id === id)).filter(Boolean)
    .concat(NATIONS.filter(n => !NATION_ORDER.includes(n.id)));
  if (!LIST.length) return;
  const byId = Object.fromEntries(LIST.map(n => [n.id, n]));
  const epById = {};
  LIST.forEach(n => n.episodes.forEach((ep, i) => { epById[ep.id] = { ep, n, i }; }));
  const imgById = Object.fromEntries(NATION_IMAGES.map(m => [m.id, m]));
  const REGIONS = NATION_REGIONS.filter(r => LIST.some(n => n.region === r.id));
  const TOTAL_EPS = LIST.reduce((a, n) => a + n.episodes.length, 0);

  // ---------- 도구 ----------
  const link = (href, text) => href ? `<a href="${esc(href)}" target="_blank" rel="noopener">${esc(text)}</a>` : esc(text);
  const credit = m => `사진: ${esc(m.author)} · ${link(m.license_url, m.license)} · ${link(m.source, '위키미디어 공용')}`;
  // 받침에 따라 조사를 골라요 (예: 중국은 / 프랑스는, 영국과 / 미국과)
  const josa = (word, withBatchim, without) => {
    const w = String(word).replace(/\s*\(.*\)\s*$/, '');
    const code = w.charCodeAt(w.length - 1);
    if (code < 0xac00 || code > 0xd7a3) return withBatchim + '(' + without + ')';
    return (code - 0xac00) % 28 ? withBatchim : without;
  };
  const short = n => n.name.replace(/\s*\(.*\)\s*$/, '');
  const shuffle = A.shuffle;

  function nd() {
    const p = A.me();
    if (!p.nations || typeof p.nations !== 'object') p.nations = {};
    const d = p.nations;
    if (!Array.isArray(d.read)) d.read = [];
    if (!Array.isArray(d.stamps)) d.stamps = [];
    if (!d.best || typeof d.best !== 'object') d.best = {};
    return d;
  }
  const readOf = n => n.episodes.filter(ep => nd().read.includes(ep.id)).length;
  const levelMode = () => ({ 1: 'easy', 2: 'normal', 3: 'deep' }[A.me().level] || 'normal');
  const modeNow = () => (MODES[nd().mode] ? nd().mode : levelMode());
  const cardsOf = n => (n.cards || []).map(id => A.cardById[id]).filter(Boolean);

  function photo(id, cls, alt) {
    const m = imgById[id];
    if (!m) return '';
    return `<img class="${cls || ''}" src="${esc(m.file)}" alt="${esc(alt == null ? m.caption : alt)}" loading="lazy" decoding="async">`;
  }

  function figure(id) {
    const m = imgById[id];
    if (!m) return '';
    return `<figure class="nstory-fig">
      <button type="button" class="note-zoom" data-nv-zoom="${esc(m.id)}" aria-label="${esc(m.caption)} 크게 보기">
        <img src="${esc(m.file)}" alt="${esc(m.caption)}" decoding="async">
      </button>
      <figcaption><b>${esc(m.caption)}</b><small>${credit(m)}</small></figcaption>
    </figure>`;
  }

  function zoom(id) {
    const m = imgById[id];
    if (!m) return;
    A.openModal(`<figure class="zoom-fig"><img src="${esc(m.file)}" alt="${esc(m.caption)}"><figcaption><b>${esc(m.caption)}</b><small>${credit(m)}</small></figcaption></figure>`, m.caption);
  }

  const worldSwitch = active => `<nav class="seg" aria-label="세계사 보는 방법">
      <a href="#/timeline/world" ${active === 'era' ? 'aria-current="page"' : ''}>🕰️ 시대순으로</a>
      <a href="#/nations" ${active === 'nation' ? 'aria-current="page"' : ''}>🧭 나라별로</a>
    </nav>`;

  function banner(sub) {
    const d = nd();
    return `<a class="nation-banner" href="#/nations">
      <span class="nation-banner-icon" aria-hidden="true">🧭</span>
      <span class="nation-banner-text">
        <b>나라별 세계사</b>
        <small>${esc(sub)}</small>
        <span class="nation-banner-flags" aria-hidden="true">${LIST.map(n => `<i class="${d.stamps.includes(n.id) ? 'on' : ''}">${n.flag}</i>`).join('')}</span>
      </span>
      <span class="nation-banner-go" aria-hidden="true">›</span>
    </a>`;
  }

  // ---------- 다른 화면에 끼워 넣기 ----------
  A.registerHook('home', () => banner(`${LIST.length}개 나라, ${TOTAL_EPS}편의 숨은 이야기 · 여권 도장 ${nd().stamps.length}/${LIST.length}`));
  A.registerHook('timeline', track => track === 'world'
    ? worldSwitch('era') + banner(`${LIST.map(short).slice(0, 6).join('·')} 등 ${LIST.length}개 나라의 숨은 이야기를 사진과 함께 읽어요`)
    : '');
  A.registerHook('quizMenu', track => {
    if (track !== 'world') return '';
    const d = nd();
    return `<h2 class="nquiz-menu-h">🧭 나라별 퀴즈</h2>
      <p class="hint">나라 이야기를 읽고 ${QUIZ_LEN}문제에 도전해요. 3문제 이상 맞히면 그 나라와 관련된 카드를 받아요!</p>
      <div class="era-grid">${LIST.map(n => {
        const best = d.best[n.id];
        return `<a class="era-tile" href="#/nquiz/${n.id}" style="--era:${n.color}">
          <span class="era-tile-emoji" aria-hidden="true">${n.flag}</span>
          <span class="era-tile-name">${esc(short(n))}</span>
          <span class="era-tile-best">${best != null ? `최고 ⭐ ${best}/${QUIZ_LEN}` : '아직 도전 전'}</span>
        </a>`;
      }).join('')}</div>`;
  });

  // ---------- 나라 고르기 ----------
  function viewNations() {
    const p = A.me();
    const d = nd();
    const readAll = LIST.reduce((a, n) => a + readOf(n), 0);
    $app.innerHTML = `
      <a class="back" href="#/timeline/world">← 세계사 탐험으로</a>
      <header class="page-head">
        <h1>🧭 나라별 세계사</h1>
        ${worldSwitch('nation')}
        <p>나라를 골라 그 나라의 숨은 이야기를 읽어요. 이야기를 모두 읽으면 그 나라의 <b>여권 도장</b>과 <b>카드</b>를 받아요!</p>
      </header>
      <section class="panel passport">
        <h2>🛂 ${esc(p.name)} 대원의 세계 여권</h2>
        <div class="passport-stamps">${LIST.map(n => {
          const on = d.stamps.includes(n.id);
          return `<a class="pstamp ${on ? 'on' : ''}" href="#/nation/${n.id}" style="--nc:${n.color}" title="${esc(n.name)}${on ? ' 도장 받음' : ''}">
            <span aria-hidden="true">${n.flag}</span><span class="visually-hidden">${esc(n.name)} ${on ? '도장 받음' : '도장 없음'}</span></a>`;
        }).join('')}</div>
        <p class="passport-sum">🛂 도장 <b>${d.stamps.length}</b> / ${LIST.length} · 📖 읽은 이야기 <b>${readAll}</b> / ${TOTAL_EPS}</p>
      </section>
      ${REGIONS.map(r => `
        <section class="region" style="--rc:${r.color}">
          <h2 class="region-h"><span aria-hidden="true">${r.emoji}</span> ${esc(r.name)}</h2>
          <p class="hint">${esc(r.desc)}</p>
          <div class="nation-grid">
            ${LIST.filter(n => n.region === r.id).map(n => {
              const read = readOf(n);
              const best = d.best[n.id];
              const stamped = d.stamps.includes(n.id);
              return `<a class="ntile ${stamped ? 'done' : ''}" href="#/nation/${n.id}" style="--nc:${n.color}">
                <span class="ntile-photo">${photo(n.hero, '', '')}<span class="ntile-flag" aria-hidden="true">${n.flag}</span>${stamped ? '<span class="ntile-stamp" aria-hidden="true">🛂</span>' : ''}</span>
                <span class="ntile-body">
                  <span class="ntile-name">${esc(n.name)}</span>
                  <span class="ntile-tag">${esc(n.tagline)}</span>
                  <span class="ntile-meta">📖 ${read}/${n.episodes.length}${stamped ? ' · 🛂 도장' : ''}${best != null ? ` · ⭐ ${best}/${QUIZ_LEN}` : ''}</span>
                  <span class="bar ntile-bar" aria-hidden="true"><i style="width:${(read / n.episodes.length) * 100}%"></i></span>
                </span>
              </a>`;
            }).join('')}
          </div>
        </section>`).join('')}
      <p class="hint note-credit">사진은 위키미디어 공용(Wikimedia Commons)에서 자유 이용이 허락된 것만 골라 화면에 맞게 크기를 줄여 실었어요. 이야기 화면의 사진 아래에 지은이와 라이선스, 원본 링크가 있어요.</p>`;
  }

  // ---------- 나라 첫 화면 ----------
  function viewNation(id) {
    const n = byId[id];
    if (!n) { location.replace('#/nations'); return; }
    const d = nd();
    const p = A.me();
    const read = readOf(n);
    const stamped = d.stamps.includes(n.id);
    const region = NATION_REGIONS.find(r => r.id === n.region);
    const intro = p.level === 1 ? n.intro.easy : n.intro.normal;
    const firstUnread = n.episodes.find(ep => !d.read.includes(ep.id)) || n.episodes[0];
    const k = LIST.indexOf(n);
    const prev = LIST[k - 1];
    const next = LIST[k + 1];
    const hero = imgById[n.hero];
    const cards = cardsOf(n);
    $app.innerHTML = `
      <a class="back" href="#/nations">← 나라 고르기</a>
      <header class="nation-hero" style="--nc:${n.color}">
        ${hero ? `<button type="button" class="nation-hero-img" data-nv-zoom="${esc(hero.id)}" aria-label="${esc(hero.caption)} 크게 보기">${photo(n.hero, '', hero.caption)}</button>` : ''}
        <div class="nation-hero-text">
          <p>${region ? `${region.emoji} ${esc(region.name)}` : ''}</p>
          <h1><span aria-hidden="true">${n.flag}</span> ${esc(n.name)}</h1>
          <p>${esc(n.tagline)}</p>
        </div>
      </header>
      ${hero ? `<p class="hero-credit"><b>${esc(hero.caption)}</b> · ${credit(hero)}</p>` : ''}
      <section class="panel nation-intro" style="--nc:${n.color}">
        <h2>👋 ${esc(short(n))}${josa(short(n), '은', '는')} 어떤 나라?</h2>
        <p>${esc(intro)}</p>
        ${A.speakBtn(intro)}
        <p class="nation-progress">📖 읽은 이야기 <b>${read}</b> / ${n.episodes.length} · ${stamped ? '🛂 <b>여권 도장 받음!</b>' : '🛂 이야기를 모두 읽으면 여권 도장'}${d.best[n.id] != null ? ` · ⭐ 퀴즈 최고 ${d.best[n.id]}/${QUIZ_LEN}` : ''}</p>
      </section>
      <section class="panel">
        <h2>📖 숨은 이야기 ${n.episodes.length}편</h2>
        <ol class="ep-list">
          ${n.episodes.map((ep, i) => {
            const done = d.read.includes(ep.id);
            return `<li><a class="ep-item ${done ? 'read' : ''}" href="#/nstory/${ep.id}" style="--nc:${n.color}">
              <span class="ep-thumb">${photo(ep.img, '', '')}<span class="ep-no" aria-hidden="true">${i + 1}</span></span>
              <span class="ep-body">
                <span class="ep-period">${esc(ep.period)}</span>
                <span class="ep-title"><span aria-hidden="true">${ep.emoji}</span> ${esc(ep.title)}</span>
                <span class="ep-hook">🤔 ${esc(ep.hook)}</span>
              </span>
              <span class="ep-check" aria-hidden="true">${done ? '✅' : '›'}</span>
              <span class="visually-hidden">${done ? '(읽음)' : ''}</span>
            </a></li>`;
          }).join('')}
        </ol>
      </section>
      <div class="cta-row">
        <a class="btn btn-green" href="#/nstory/${firstUnread.id}">📖 ${read === 0 ? '첫 이야기부터 읽기' : read < n.episodes.length ? '이어서 읽기' : '처음부터 다시 읽기'}</a>
        <a class="btn btn-blue" href="#/nquiz/${n.id}">❓ ${esc(short(n))} 퀴즈 도전</a>
      </div>
      <section class="panel">
        <h2>🗓️ 한눈에 보는 ${esc(short(n))}의 역사</h2>
        <ol class="ntimeline" style="--nc:${n.color}">
          ${n.timeline.map(t => `<li><span class="nt-when">${esc(t.when)}</span><span class="nt-text">${esc(t.text)}</span></li>`).join('')}
        </ol>
      </section>
      ${cards.length ? `
        <section class="panel">
          <h2>🃏 ${esc(short(n))}${josa(short(n), '과', '와')} 관련된 카드</h2>
          <div class="card-grid small">${cards.map(c => A.cardTile(c, p.cards.includes(c.id))).join('')}</div>
          <p class="hint">이 나라 이야기를 모두 읽거나 ${esc(short(n))} 퀴즈에서 3문제 이상 맞히면, 아직 없는 카드 가운데 1장을 받아요.</p>
        </section>` : ''}
      <nav class="nation-pager" aria-label="다른 나라">
        ${prev ? `<a class="btn btn-ghost" href="#/nation/${prev.id}">◀ ${prev.flag} ${esc(short(prev))}</a>` : '<span></span>'}
        ${next ? `<a class="btn btn-ghost" href="#/nation/${next.id}">${next.flag} ${esc(short(next))} ▶</a>` : '<span></span>'}
      </nav>`;
  }

  // ---------- 이야기 ----------
  let story = null;

  function viewStory(id) {
    const hit = epById[id];
    if (!hit) { location.replace('#/nations'); return; }
    const { ep, n, i } = hit;
    story = { ep, n, i };
    const total = n.episodes.length;
    const era = A.eraById[ep.korea && ep.korea.era];
    $app.innerHTML = `
      <a class="back" href="#/nation/${n.id}">← ${n.flag} ${esc(short(n))} 이야기 목록</a>
      <article class="nstory" style="--nc:${n.color}">
        <header class="nstory-head">
          <p class="nstory-kicker"><span aria-hidden="true">${n.flag}</span> ${esc(n.name)} · 이야기 ${i + 1} / ${total}</p>
          <h1><span aria-hidden="true">${ep.emoji}</span> ${esc(ep.title)}</h1>
          <p class="nstory-period">🕰️ ${esc(ep.period)}</p>
        </header>
        <div class="nstory-hook"><span class="nstory-hook-mascot" aria-hidden="true">🐯</span><p><b>궁금해!</b> ${esc(ep.hook)}</p></div>
        ${figure(ep.img)}
        <div class="story-mode" role="group" aria-label="이야기 수준 고르기">
          ${Object.entries(MODES).map(([k, m]) => `<button type="button" data-nv-mode="${k}" aria-pressed="false"><span class="sm-icon" aria-hidden="true">${m.icon}</span><span>${m.name}</span></button>`).join('')}
        </div>
        <div id="nstory-text" class="nstory-text" aria-live="polite"></div>
        <aside class="nbox twist"><h2>💥 반전! 알고 보니</h2><p>${esc(ep.twist)}</p></aside>
        <aside class="nbox today"><h2>🔗 지금 우리와 연결</h2><p>${esc(ep.today)}</p></aside>
        ${era ? `<aside class="nbox korea"><h2>🐯 그때 우리나라에서는?</h2><p>${esc(ep.korea.text)}</p>
          <a class="chip chip-link" href="#/era/${era.id}" style="--era:${era.color}">🐯 ${esc(era.short)} 보러 가기 ›</a></aside>` : ''}
      </article>
      <div class="slide-nav nstory-nav" id="nstory-nav"></div>`;
    renderStoryText();
    renderStoryNav();
  }

  function renderStoryText() {
    const box = document.getElementById('nstory-text');
    if (!box || !story) return;
    const { ep } = story;
    const mode = modeNow();
    document.querySelectorAll('[data-nv-mode]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.nvMode === mode)));
    if (mode === 'deep') {
      const paras = ep.deep || [];
      const chars = paras.join('').length;
      box.className = 'nstory-text deep';
      box.innerHTML = `
        <p class="deep-meta">🎓 중고생·어른을 위한 강의식 이야기 · 약 ${Math.max(1, Math.round(chars / 500))}분</p>
        ${paras.map(t => `<p>${esc(t)}</p>`).join('')}
        ${A.speakBtn(`${ep.title}. ${paras.join(' ')}`)}`;
    } else {
      const text = ep[mode];
      box.className = 'nstory-text ' + mode;
      box.innerHTML = `<p>${esc(text)}</p>${A.speakBtn(`${ep.title}. ${text}`)}`;
    }
  }

  function renderStoryNav() {
    const box = document.getElementById('nstory-nav');
    if (!box || !story) return;
    const { ep, n, i } = story;
    const prev = n.episodes[i - 1];
    const last = i === n.episodes.length - 1;
    const done = nd().read.includes(ep.id);
    const label = !done
      ? (last ? '✅ 다 읽었어요!' : '✅ 다 읽었어요! 다음 이야기 ▶')
      : (last ? `❓ ${esc(short(n))} 퀴즈 도전` : '다음 이야기 ▶');
    box.innerHTML = `
      ${prev ? `<a class="btn btn-ghost" href="#/nstory/${prev.id}">◀ 이전 이야기</a>` : `<a class="btn btn-ghost" href="#/nation/${n.id}">◀ 목록</a>`}
      ${done ? '<span class="read-mark">✅ 읽은 이야기</span>' : ''}
      <button class="btn btn-green" type="button" data-nv="story-done">${label}</button>`;
  }

  function finishStory() {
    const { ep, n, i } = story;
    const d = nd();
    const next = n.episodes[i + 1];
    if (d.read.includes(ep.id)) {
      location.hash = next ? `#/nstory/${next.id}` : `#/nquiz/${n.id}`;
      return;
    }
    d.read.push(ep.id);
    const complete = n.episodes.every(e => d.read.includes(e.id)) && !d.stamps.includes(n.id);
    if (!complete) {
      A.award(1);
      A.sfx.good();
      if (next) { location.hash = `#/nstory/${next.id}`; return; }
      // 마지막 이야기지만 아직 안 읽은 이야기가 남아 있어요
      const left = n.episodes.filter(e => !d.read.includes(e.id));
      A.openModal(`<div class="reward">
        <div class="big-emoji">📖</div>
        <h2>잘 읽었어요! ⭐ 1개</h2>
        <p>아직 안 읽은 이야기가 <b>${left.length}편</b> 남았어요. 모두 읽으면 ${esc(short(n))} 여권 도장을 받아요!</p>
        <div class="cta-row"><a class="btn btn-green" href="#/nstory/${left[0].id}">📖 남은 이야기 읽기</a><a class="btn btn-ghost" href="#/nation/${n.id}">목록으로</a></div>
      </div>`, '이야기 읽기 완료');
      renderStoryNav();
      return;
    }
    d.stamps.push(n.id);
    const got = shuffle(cardsOf(n).filter(c => !A.me().cards.includes(c.id))).slice(0, 1);
    const stars = 1 + 3 + (got.length ? 0 : 2);
    A.award(stars, got);
    A.sfx.win();
    A.confetti();
    renderStoryNav();
    const nextNation = LIST.find(x => !d.stamps.includes(x.id));
    A.openModal(`<div class="reward">
      <div class="stamp" style="--era:${n.color}">${n.flag}<span>${esc(short(n))}</span></div>
      <h2>${esc(short(n))} 여권 도장 획득!</h2>
      <p>${esc(short(n))} 이야기 ${n.episodes.length}편을 모두 읽었어요. ⭐ 별 ${stars}개${got.length ? '와 새 카드를' : '를'} 받았어요.</p>
      ${A.rewardCards(got)}
      <div class="cta-row">
        <a class="btn btn-blue" href="#/nquiz/${n.id}">❓ ${esc(short(n))} 퀴즈 도전</a>
        ${nextNation ? `<a class="btn btn-ghost" href="#/nation/${nextNation.id}">${nextNation.flag} 다음 나라: ${esc(short(nextNation))}</a>` : '<a class="btn btn-ghost" href="#/nations">🧭 나라 고르기</a>'}
      </div>
    </div>`, '여권 도장 획득');
    if (got.length) setTimeout(A.sfx.card, 700);
  }

  // ---------- 나라 퀴즈 ----------
  let nq = null;

  function viewQuiz(id) {
    const n = byId[id];
    if (!n) { location.replace('#/nations'); return; }
    const level = A.me().level;
    const pool = n.quiz.filter(q => level >= 2 || q.level === 1);
    let qs;
    if (level >= 2) {
      const hard = shuffle(pool.filter(q => q.level === 2)).slice(0, 2);
      const easy = shuffle(pool.filter(q => q.level === 1)).slice(0, QUIZ_LEN - hard.length);
      qs = shuffle(hard.concat(easy));
    } else {
      qs = shuffle(pool).slice(0, QUIZ_LEN);
    }
    nq = {
      n, i: 0, score: 0, picked: null,
      qs: qs.map(q => q.type === 'mc'
        ? Object.assign({}, q, { opts: shuffle(q.choices), right: q.choices[0] })
        : Object.assign({}, q, { opts: ['O', 'X'], right: q.answer ? 'O' : 'X' })),
    };
    $app.innerHTML = `<a class="back" href="#/nation/${n.id}">← ${n.flag} ${esc(short(n))} 이야기로</a><div id="nquiz"></div>`;
    renderQuestion();
  }

  function renderQuestion() {
    const box = document.getElementById('nquiz');
    if (!box || !nq) return;
    const { n } = nq;
    const q = nq.qs[nq.i];
    const total = nq.qs.length;
    const answered = nq.picked !== null;
    const correct = answered && nq.picked === q.right;
    const done = nq.i + (answered ? 1 : 0);
    const cls = o => !answered ? '' : o === q.right ? 'right' : o === nq.picked ? 'wrong' : 'dim';
    const options = q.type === 'ox'
      ? `<div class="ox">${['O', 'X'].map(o => `
          <button type="button" class="ox-btn ${o === 'O' ? 'o' : 'x'} ${cls(o)}" data-nq="${o}" ${answered ? 'disabled' : ''}>
            <span class="ox-mark" aria-hidden="true">${o === 'O' ? '⭕' : '❌'}</span><span>${o === 'O' ? '맞아요' : '틀려요'}</span>
          </button>`).join('')}</div>`
      : `<div class="choices">${q.opts.map((o, k) => `
          <button type="button" class="choice ${cls(o)}" data-nq="${esc(o)}" ${answered ? 'disabled' : ''}>
            <span class="choice-no" aria-hidden="true">${k + 1}</span>${esc(o)}
          </button>`).join('')}</div>`;
    const readText = q.type === 'mc'
      ? `${q.q} 보기. ${q.opts.map((o, k) => `${k + 1}번, ${o}`).join('. ')}`
      : `${q.q} 맞으면 오, 틀리면 엑스.`;
    const josaRight = q.type === 'mc' ? (() => {
      const code = q.right.charCodeAt(q.right.length - 1);
      return code < 0xac00 || code > 0xd7a3 ? '(이)야' : (code - 0xac00) % 28 ? '이야' : '야';
    })() : '';
    box.innerHTML = `
      <div class="quiz-top">
        <span class="chip" style="--era:${n.color}">${n.flag} ${esc(short(n))}</span>
        <span>${nq.i + 1} / ${total}</span>
        <span>⭐ ${nq.score}</span>
      </div>
      <div class="bar" role="progressbar" aria-label="진행" aria-valuemin="0" aria-valuemax="${total}" aria-valuenow="${done}"><i style="width:${(done / total) * 100}%"></i></div>
      <section class="qcard ${answered ? '' : 'enter'}">
        <span class="qtype">${q.type === 'ox' ? '⭕❌ OX 퀴즈' : '골라 맞히기'}</span>
        <h1 class="qtext">${esc(q.q)}</h1>
        ${A.speakBtn(readText)}
        ${options}
      </section>
      ${answered ? `
        <section class="feedback ${correct ? 'good' : 'bad'}" role="status">
          <div class="fb-head"><span class="fb-mascot" aria-hidden="true">🐯</span><strong>${correct ? A.pick(PRAISE)
            : q.type === 'ox' ? `아쉬워! 이 문장은 ${q.right === 'O' ? '⭕ 맞는' : '❌ 틀린'} 말이야.`
            : `아쉬워! 정답은 ‘${esc(q.right)}’${josaRight}.`}</strong></div>
          <p>${esc(q.explain)}</p>
          <button class="btn btn-blue" type="button" data-nv="nq-next">${nq.i + 1 < total ? '다음 문제 ▶' : '결과 보기 🏆'}</button>
        </section>` : ''}`;
    if (answered) {
      const nextBtn = box.querySelector('[data-nv="nq-next"]');
      nextBtn.focus({ preventScroll: true });
      nextBtn.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'nearest' });
    }
  }

  function answer(value) {
    if (!nq || nq.picked !== null) return;
    const q = nq.qs[nq.i];
    nq.picked = value;
    if (value === q.right) { nq.score++; A.sfx.good(); A.confetti(30); } else { A.sfx.bad(); }
    renderQuestion();
  }

  function nextQuestion() {
    A.stopSpeak();
    if (nq.i + 1 < nq.qs.length) {
      nq.i++;
      nq.picked = null;
      renderQuestion();
      window.scrollTo(0, 0);
      A.focusHeading();
    } else {
      finishQuiz();
    }
  }

  function finishQuiz() {
    const d = nd();
    const { n, score, qs } = nq;
    const total = qs.length;
    if (d.best[n.id] == null || score > d.best[n.id]) d.best[n.id] = score;
    const want = score === total ? 2 : score >= 3 ? 1 : 0;
    const got = shuffle(cardsOf(n).filter(c => !A.me().cards.includes(c.id))).slice(0, want);
    const bonus = (want - got.length) * 2; // 이 나라 카드를 다 모았으면 별로 대신 줘요
    A.award(score + bonus, got);
    const ratio = score / total;
    const msg = ratio === 1 ? `만점! 너는 ${short(n)} 박사야! 🏆`
      : ratio >= 0.6 ? '잘했어! 조금만 더 하면 만점이야! 💪'
      : '괜찮아! 이야기를 다시 읽고 또 도전해 보자! 📖';
    A.sfx.win();
    if (ratio >= 0.6) A.confetti();
    const firstUnread = n.episodes.find(ep => !d.read.includes(ep.id)) || n.episodes[0];
    $app.innerHTML = `
      <section class="panel result">
        <div class="mascot" aria-hidden="true">${ratio === 1 ? '🥳' : ratio >= 0.6 ? '😺' : '🐯'}</div>
        <p class="nstory-kicker">${n.flag} ${esc(n.name)} 퀴즈</p>
        <h1 class="result-score">${total}문제 중 ${score}문제 정답!</h1>
        <div class="result-stars" aria-hidden="true">${'⭐'.repeat(score)}${'☆'.repeat(total - score)}</div>
        <p class="result-msg">${esc(msg)}</p>
        <p>별 <b>${score + bonus}개</b>를 받았어요.${bonus ? ` (이 나라 카드를 모두 모아서 보너스 별 ${bonus}개 포함!)` : ''}</p>
        ${got.length ? `<h2>🎁 새 카드 획득!</h2>${A.rewardCards(got)}`
          : want === 0 ? '<p class="hint">3문제 이상 맞히면 별을 더 받고, 이 나라 카드도 받을 수 있어요!</p>' : ''}
        <div class="cta-row">
          <button class="btn btn-blue" type="button" data-nv="nq-retry">🔄 다시 도전</button>
          <a class="btn btn-green" href="#/nstory/${firstUnread.id}">📖 ${esc(short(n))} 이야기 읽기</a>
          <a class="btn btn-ghost" href="#/quiz/world">다른 퀴즈 고르기</a>
        </div>
      </section>`;
    window.scrollTo(0, 0);
    A.focusHeading();
    if (got.length) setTimeout(A.sfx.card, 700);
  }

  // ---------- 주소 등록 ----------
  A.registerView('nations', viewNations);
  A.registerView('nation', viewNation);
  A.registerView('nstory', viewStory);
  A.registerView('nquiz', viewQuiz);

  // ---------- 이벤트 ----------
  document.addEventListener('click', e => {
    const t = e.target;
    const z = t.closest('[data-nv-zoom]');
    if (z) { zoom(z.dataset.nvZoom); return; }
    const m = t.closest('[data-nv-mode]');
    if (m) {
      A.stopSpeak();
      nd().mode = m.dataset.nvMode;
      A.save();
      renderStoryText();
      A.sfx.tap();
      return;
    }
    const a = t.closest('[data-nq]');
    if (a && !a.disabled && document.getElementById('nquiz')) { answer(a.dataset.nq); return; }
    const act = t.closest('[data-nv]');
    if (!act || act.disabled) return;
    switch (act.dataset.nv) {
      case 'story-done': if (story && document.getElementById('nstory-nav')) finishStory(); break;
      case 'nq-next': if (nq) nextQuestion(); break;
      case 'nq-retry': if (nq) { viewQuiz(nq.n.id); window.scrollTo(0, 0); A.focusHeading(); } break;
    }
  });

  // 퀴즈: 숫자 키(1~4)나 O/X 키로 답하기
  document.addEventListener('keydown', e => {
    if (!nq || nq.picked !== null || !document.getElementById('nquiz') || document.getElementById('modal')) return;
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    const q = nq.qs[nq.i];
    const key = e.key.toLowerCase();
    if (q.type === 'mc' && /^[1-4]$/.test(key)) answer(q.opts[Number(key) - 1]);
    if (q.type === 'ox' && (key === 'o' || key === 'x')) answer(key.toUpperCase());
  });
})();
