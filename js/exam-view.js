/*
 * 범이의 역사 탐험대 — 한국사능력검정시험 심화 대비 화면
 * 주소: #/exam (학습 홈), #/exam/note/<단원>, #/exam/drill/<단원|mix|wrong>, #/exam/mock, #/exam/result,
 *       #/exam/flash (암기 카드 덱 고르기), #/exam/flash/<단원|all|hard>,
 *       #/exam/dict (역사 사전), #/exam/dict/u.<단원> (단원만 보기), #/exam/drill/t.<낱말> (낱말 관련 문제)
 * 기록은 대원별로 player.exam 에 저장합니다.
 */
(() => {
  'use strict';

  const A = window.HistoryApp;
  const esc = A.esc;
  const $app = document.getElementById('app');
  const unitById = Object.fromEntries(EXAM_UNITS.map(u => [u.id, u]));
  const qById = Object.fromEntries(EXAM_QUESTIONS.map(q => [q.id, q]));
  // 암기 카드: 앞면 글자로 id를 만들어 카드 순서가 바뀌어도 기록이 이어지게 해요
  const FLASH = EXAM_UNITS.flatMap(u => (EXAM_FLASH[u.id] || []).map(([f, b]) => ({ id: `${u.id}:${f}`, unit: u.id, f, b })));
  const flashById = Object.fromEntries(FLASH.map(c => [c.id, c]));
  const MARKS = ['①', '②', '③', '④', '⑤'];
  const MIX_LEN = 20;
  const LIMIT = EXAM_INFO.minutes * 60;
  const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---------- 도구 ----------
  // 노트의 **굵게** 표시를 강조로 바꿔요
  const fmt = s => esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
  const fmtSrc = s => esc(s).replace(/\n/g, '<br>');
  const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);
  const unitQs = id => EXAM_QUESTIONS.filter(q => q.unit === id);
  const mmss = sec => `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`;

  // 문제 id로 정해지는 순서로 보기를 섞어요 (다시 풀어도 같은 자리)
  function seeded(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return () => {
      h = (h + 0x6d2b79f5) | 0;
      let t = Math.imul(h ^ (h >>> 15), 1 | h);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const optCache = {};
  function optsOf(q) {
    if (optCache[q.id]) return optCache[q.id];
    const rnd = seeded(q.id);
    const order = q.o.map((_, i) => i);
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    optCache[q.id] = order.map(k => ({ text: q.o[k][0], why: q.o[k][1], right: k === 0 }));
    return optCache[q.id];
  }
  const answerIndex = q => optsOf(q).findIndex(o => o.right);

  function gradeOf(score) {
    const g = EXAM_INFO.grades.find(([min]) => score >= min);
    return g ? g[1] : '불합격';
  }

  // ---------- 기록 ----------
  // 같은 객체를 계속 써야 해요 (새 객체로 바꾸면 다른 곳에서 고친 내용이 사라져요)
  function data() {
    const p = A.me();
    const e = p.exam || (p.exam = {});
    if (!e.stats) e.stats = {};
    if (!e.wrong) e.wrong = {};
    if (!Array.isArray(e.mocks)) e.mocks = [];
    if (e.mock === undefined) e.mock = null;
    if (e.last === undefined) e.last = null;
    if (!e.flashHard) e.flashHard = {};
    return e;
  }

  // 한 문제를 풀 때마다 기록해요. 틀리면 오답 노트에 넣고, 오답 노트 문제를 두 번 연속 맞히면 빼요.
  function record(qid, ok) {
    const d = data();
    const s = d.stats[qid] || [0, 0];
    s[0]++;
    if (ok) s[1]++;
    d.stats[qid] = s;
    if (!ok) d.wrong[qid] = 0;
    else if (qid in d.wrong) {
      d.wrong[qid]++;
      if (d.wrong[qid] >= 2) delete d.wrong[qid];
    }
  }

  function unitProgress(id) {
    const d = data();
    const qs = unitQs(id);
    let seen = 0, tries = 0, right = 0;
    qs.forEach(q => {
      const s = d.stats[q.id];
      if (s) { seen++; tries += s[0]; right += s[1]; }
    });
    return { total: qs.length, seen, rate: pct(right, tries) };
  }

  // ---------- 라우팅 ----------
  let timer = null;
  function stopTimer() {
    if (timer) { clearInterval(timer); timer = null; }
  }
  window.addEventListener('hashchange', () => {
    if (!location.hash.startsWith('#/exam/mock')) stopTimer();
  });

  A.registerView('exam', () => {
    stopTimer();
    const [, sub, arg] = location.hash.replace(/^#\/?/, '').split('/');
    if (sub === 'note' && unitById[arg]) viewNote(arg);
    else if (sub === 'drill' && (unitById[arg] || arg === 'mix' || arg === 'wrong' || (arg && arg.startsWith('t.') && termQs(fromKey(arg)).length))) viewDrill(arg);
    else if (sub === 'dict' && EXAM_DICT.length) viewDict(arg);
    else if (sub === 'mock') viewMock();
    else if (sub === 'result' && data().last) viewResult();
    else if (sub === 'flash' && !arg) viewFlashHub();
    else if (sub === 'flash' && (unitById[arg] || arg === 'all' || arg === 'hard')) viewFlash(arg);
    else viewHub();
  });

  function rerender() {
    window.scrollTo(0, 0);
    A.focusHeading();
  }

  // ---------- 학습 홈 ----------
  function viewHub() {
    const d = data();
    let seen = 0, tries = 0, right = 0;
    Object.values(d.stats).forEach(([t, r]) => { seen++; tries += t; right += r; });
    const wrongN = Object.keys(d.wrong).filter(id => qById[id]).length;
    const best = d.mocks.length ? Math.max(...d.mocks.map(m => m.score)) : null;
    const resume = d.mock && d.mock.qids.length;
    $app.innerHTML = `
      <div class="exam">
        <header class="page-head">
          <h1>🎓 한국사능력검정시험 심화 대비</h1>
          <p>심화 시험은 <b>50문항 5지선다, ${EXAM_INFO.minutes}분, 100점 만점</b>이에요. 80점 이상이면 1급, 70점 이상 2급, 60점 이상 3급이에요.</p>
        </header>
        <div class="stats exam-stats">
          <div class="stat"><span class="stat-num">${seen} / ${EXAM_QUESTIONS.length}</span><span class="stat-label">풀어 본 문제</span></div>
          <div class="stat"><span class="stat-num">${tries ? pct(right, tries) + '%' : '—'}</span><span class="stat-label">정답률</span></div>
          <div class="stat"><span class="stat-num">${wrongN}</span><span class="stat-label">오답 노트</span></div>
          <div class="stat"><span class="stat-num">${best != null ? best + '점' : '—'}</span><span class="stat-label">모의고사 최고</span></div>
        </div>
        <div class="exam-actions">
          <a class="exam-big mock" href="#/exam/mock"><span>📝 실전 모의고사</span><small>${resume ? `풀던 시험 이어 풀기 · ${Object.keys(d.mock.ans).length}/${d.mock.qids.length}문항 답함` : `${EXAM_INFO.count}문항 · ${EXAM_INFO.minutes}분 · 단원별 출제 비율 반영`}</small></a>
          <a class="exam-big wrongnote" href="#/exam/drill/wrong"><span>❗ 오답 노트</span><small>${wrongN ? `${wrongN}문제 · 두 번 연속 맞히면 빠져요` : '틀린 문제가 자동으로 모여요'}</small></a>
          <a class="exam-big mix" href="#/exam/drill/mix"><span>🎲 전 단원 섞어 풀기</span><small>${MIX_LEN}문제 · 정답과 해설을 바로 확인</small></a>
          <a class="exam-big flash" href="#/exam/flash"><span>🗂️ 빈출 연도·키워드 암기 카드</span><small>${FLASH.length}장 · 헷갈리는 카드 ${hardCount()}장</small></a>
          ${EXAM_DICT.length ? `<a class="exam-big dict" href="#/exam/dict"><span>📖 역사 사전</span><small>핵심 낱말 ${EXAM_DICT.length}개 · 자세한 설명과 이야기, 시험 포인트</small></a>` : ''}
        </div>
        <h2 class="exam-h2">단원별 학습</h2>
        <ol class="unit-list">
          ${EXAM_UNITS.map((u, i) => {
            const pr = unitProgress(u.id);
            return `<li class="unit-item" style="--era:${u.color}">
              <div class="unit-info">
                <b>${i + 1}. ${esc(u.name)}</b>
                <small>문제 ${pr.total}개 · 풀어 본 문제 ${pr.seen}개${pr.seen ? ` · 정답률 ${pr.rate}%` : ''}</small>
                <div class="bar"><i style="width:${pct(pr.seen, pr.total)}%"></i></div>
              </div>
              <div class="unit-btns">
                <a class="mini" href="#/exam/note/${u.id}">📘 개념 노트</a>
                <a class="mini" href="#/exam/drill/${u.id}">✏️ 문제 풀기</a>
                <a class="mini" href="#/exam/flash/${u.id}">🗂️ 암기 카드</a>
              </div>
            </li>`;
          }).join('')}
        </ol>
        <p class="hint exam-note">문제는 기출 유형을 참고해 새로 만든 연습 문제예요. 실제 시험 일정과 접수는 국사편찬위원회 한국사능력검정시험 누리집에서 확인하세요.</p>
      </div>`;
  }

  // ---------- 개념 노트 ----------
  // 노트 보강: 사진(js/exam-images.js)과 흐름 이야기·시험 포인트·용어·사료(js/exam-plus*.js)
  const imgById = Object.fromEntries(EXAM_IMAGES.map(m => [m.id, m]));
  const link = (href, text) => href ? `<a href="${esc(href)}" target="_blank" rel="noopener">${esc(text)}</a>` : esc(text);
  const credit = m => `사진: ${esc(m.author)} · ${link(m.license_url, m.license)} · ${link(m.source, '위키미디어 공용')}`;

  function figures(ids) {
    const list = (ids || []).map(id => imgById[id]).filter(Boolean);
    if (!list.length) return '';
    return `<div class="note-figs">${list.map(m => `
      <figure class="note-fig">
        <button type="button" class="note-zoom" data-exam-zoom="${esc(m.id)}" aria-label="${esc(m.caption)} 크게 보기">
          <img src="${esc(m.file)}" alt="${esc(m.caption)}" loading="lazy" decoding="async">
        </button>
        <figcaption><b>${esc(m.caption)}</b><small>${credit(m)}</small></figcaption>
      </figure>`).join('')}</div>`;
  }

  function plusParts(p, unit) {
    if (!p) return { story: '', extra: '' };
    const story = p.story ? `<div class="note-story"><p class="note-label">📖 흐름 이야기</p><p>${fmtTerms(p.story, unit)}</p></div>` : '';
    const tips = p.tips && p.tips.length
      ? `<div class="note-tip"><p class="note-label">💡 시험 포인트·함정</p><ul>${p.tips.map(t => `<li>${fmtTerms(t, unit)}</li>`).join('')}</ul></div>` : '';
    const terms = p.terms && p.terms.length
      ? `<details class="note-terms"><summary>🔤 용어 풀이 (${p.terms.length})</summary><dl>${p.terms.map(([w, m]) => `<div><dt>${findEntry(w, unit) ? termBtn(w, unit) : esc(w)}</dt><dd>${esc(m)}</dd></div>`).join('')}</dl></details>` : '';
    return { story, extra: tips + terms };
  }

  function viewNote(id) {
    const u = unitById[id];
    const i = EXAM_UNITS.indexOf(u);
    const prev = EXAM_UNITS[i - 1];
    const next = EXAM_UNITS[i + 1];
    const plus = EXAM_PLUS[u.id] || {};
    const secPlus = plus.sections || {};
    const tablePlus = plus.tables || {};
    const sources = plus.sources || [];
    const toc = u.sections.map((s, k) => [`note-s${k}`, s.h])
      .concat(u.tables.map((t, k) => [`note-t${k}`, t.title]))
      .concat(sources.length ? [['note-src', '📜 대표 사료']] : []);
    $app.innerHTML = `
      <div class="exam ${data().noteCompact ? 'compact' : ''}" style="--era:${u.color}">
        <a class="back" href="#/exam">← 심화 학습 홈</a>
        <header class="exam-unit-head">
          <p>단원 ${i + 1} · 개념 노트</p>
          <h1>${esc(u.name)}</h1>
        </header>
        <div class="row-gap note-tools">
          <a class="btn btn-blue" href="#/exam/drill/${u.id}">✏️ 이 단원 문제 풀기 (${unitQs(u.id).length})</a>
          <a class="btn btn-ghost" href="#/exam/flash/${u.id}">🗂️ 암기 카드</a>
          ${u.era ? `<a class="btn btn-ghost" href="#/era/${u.era}">🐯 아이용 이야기로 먼저 보기</a>` : ''}
        </div>
        <nav class="note-toc" aria-label="이 단원의 주제">${toc.map(([target, label]) => `<button type="button" data-exam-jump="${target}">${esc(label)}</button>`).join('')}</nav>
        <label class="flip-opt"><input type="checkbox" data-exam-compact ${data().noteCompact ? 'checked' : ''}> 📌 핵심 정리만 보기 (이야기·사진·포인트·사료 숨기기)</label>
        <p class="term-help"><span class="term-sample" aria-hidden="true">밑줄 친 낱말</span>을 누르면 자세한 설명과 이야기가 열려요.${EXAM_DICT.some(e => e.unit === u.id) ? ` <a href="#/exam/dict/u.${u.id}">📖 이 단원 사전 보기</a>` : ''}</p>
        ${u.sections.map((s, k) => {
          const p = secPlus[s.h];
          const { story, extra } = plusParts(p, u.id);
          return `
          <section class="panel note" id="note-s${k}">
            <h2>${esc(s.h)}</h2>
            ${figures(p && p.img)}
            ${story}
            ${story ? '<p class="note-label note-core-label">📌 핵심 정리</p>' : ''}
            <ul class="note-core">${s.items.map(it => `<li>${fmtTerms(it, u.id)}</li>`).join('')}</ul>
            ${extra}
          </section>`;
        }).join('')}
        ${u.tables.map((t, k) => {
          const { story, extra } = plusParts(tablePlus[t.title], u.id);
          return `
          <section class="panel note" id="note-t${k}">
            <h2>📋 ${esc(t.title)}</h2>
            ${story}
            <p class="hint table-hint">표를 옆으로 밀면 더 볼 수 있어요 →</p>
            <div class="table-wrap"><table class="ntable">
              <thead><tr>${t.head.map(h => `<th scope="col">${esc(h)}</th>`).join('')}</tr></thead>
              <tbody>${t.rows.map(r => `<tr>${r.map((c, n) => n === 0 ? `<th scope="row">${fmtTerms(c, u.id)}</th>` : `<td>${fmtTerms(c, u.id)}</td>`).join('')}</tr>`).join('')}</tbody>
            </table></div>
            ${extra}
          </section>`;
        }).join('')}
        ${sources.length ? `
          <section class="panel note note-sources" id="note-src">
            <h2>📜 대표 사료 읽기</h2>
            <p class="hint">사료를 읽고 어느 시대·누구·어떤 사건인지 먼저 떠올린 뒤, 정답과 단서를 펼쳐 확인하세요.</p>
            ${sources.map((src, n) => `
              <article class="source">
                <h3>사료 ${n + 1}</h3>
                <div class="exam-src">${fmtSrc(src.text)}<p class="src-from">— ${esc(src.from)}</p></div>
                <details class="source-ans">
                  <summary>정답과 단서 보기</summary>
                  <p><b>정답:</b> ${esc(src.answer)}</p>
                  <p><b>🔎 단서:</b> ${esc(src.clue)}</p>
                  <p class="hint">자료: ${esc(src.title)}</p>
                </details>
              </article>`).join('')}
          </section>` : ''}
        ${figuresCreditNote(u)}
        <div class="cta-row">
          ${prev ? `<a class="btn btn-ghost" href="#/exam/note/${prev.id}">◀ ${esc(prev.short)}</a>` : ''}
          <a class="btn btn-blue" href="#/exam/drill/${u.id}">✏️ 문제 풀기</a>
          ${next ? `<a class="btn btn-ghost" href="#/exam/note/${next.id}">${esc(next.short)} ▶</a>` : ''}
        </div>
      </div>`;
  }

  // 사진이 있는 단원에는 사진 출처 안내를 덧붙여요
  function figuresCreditNote(u) {
    const plus = EXAM_PLUS[u.id];
    if (!plus) return '';
    const used = Object.values(plus.sections || {}).flatMap(p => p.img || []).filter(id => imgById[id]);
    return used.length ? '<p class="hint note-credit">사진은 위키미디어 공용(Wikimedia Commons)에서 자유 이용이 허락된 것만 골라 화면에 맞게 크기를 줄여 실었어요. 각 사진 아래에 지은이와 라이선스, 원본 링크를 적었어요.</p>' : '';
  }

  function zoomImage(id) {
    const m = imgById[id];
    if (!m) return;
    A.openModal(`<figure class="zoom-fig"><img src="${esc(m.file)}" alt="${esc(m.caption)}"><figcaption><b>${esc(m.caption)}</b><small>${credit(m)}</small></figcaption></figure>`, m.caption);
  }

  // ---------- 역사 사전 (개념 노트의 굵은 낱말 → 자세한 설명 팝업) ----------
  // 낱말 비교: 띄어쓰기·『』·괄호 속 덧붙임 ‘(12월)’은 무시해요
  const squash = s => String(s).replace(/[『』「」《》〈〉\s]/g, '');
  const normKey = s => squash(String(s).replace(/\([^)]*\)/g, '')).trim();
  const dictById = Object.fromEntries(EXAM_DICT.map(e => [e.id, e]));
  const dictIndex = new Map();
  EXAM_DICT.forEach(e => [e.term, e.id, ...(e.aliases || [])].forEach(t => {
    const k = normKey(t);
    if (!k) return;
    const list = dictIndex.get(k) || [];
    if (!list.includes(e)) list.push(e);
    dictIndex.set(k, list);
  }));
  // 같은 이름이 여러 단원에 있으면 지금 보고 있는 단원의 항목을 먼저 골라요
  function findEntry(text, unit) {
    const list = dictIndex.get(normKey(text));
    return list ? list.find(e => e.unit === unit) || list[0] : null;
  }
  // 용어 풀이(js/exam-plus*.js의 terms)
  const glossIndex = new Map();
  Object.entries(EXAM_PLUS).forEach(([unit, p]) => Object.values(p.sections || {}).concat(Object.values(p.tables || {}))
    .forEach(x => (x.terms || []).forEach(([w, m]) => { const k = normKey(w); if (!glossIndex.has(k)) glossIndex.set(k, { w, m, unit }); })));
  // 사전 사진: 항목의 img + 사진 쪽에서 dict: [낱말]로 이어 준 것
  const dictImgs = new Map();
  EXAM_IMAGES.forEach(m => (m.dict || []).forEach(t => { const k = normKey(t); dictImgs.set(k, (dictImgs.get(k) || []).concat(m.id)); }));
  const imgsFor = e => [...new Set([...(e.img || []), ...(dictImgs.get(normKey(e.id)) || []), ...(dictImgs.get(normKey(e.term)) || [])])].filter(id => imgById[id]);

  // 관련 문제·암기 카드 찾기 (띄어쓰기를 지운 글자로 비교)
  const qHay = EXAM_QUESTIONS.map(q => [q, squash([q.q, q.src || '', ...q.o.flat()].join(' '))]);
  const flashHay = FLASH.map(c => [c, squash(c.f + ' ' + c.b)]);
  const needlesOf = s => {
    const e = dictById[s];
    return [...new Set((e ? [e.term, e.id, ...(e.aliases || [])] : [s]).map(normKey))].filter(n => n.length >= 2);
  };
  const qsCache = new Map();
  function termQs(s) {
    if (!qsCache.has(s)) {
      const ns = needlesOf(s);
      qsCache.set(s, ns.length ? qHay.filter(([, h]) => ns.some(n => h.includes(n))).map(([q]) => q) : []);
    }
    return qsCache.get(s);
  }
  function termFlash(s) {
    const ns = needlesOf(s);
    return ns.length ? flashHay.filter(([, h]) => ns.some(n => h.includes(n))).map(([c]) => c) : [];
  }
  const toKey = s => 't.' + encodeURIComponent(s);
  function fromKey(key) {
    const raw = key.slice(2);
    try { return decodeURIComponent(raw); } catch (err) { return raw; }
  }
  const termTitle = s => (dictById[s] ? dictById[s].term : s);

  // 누를 수 있는 낱말인지: 사전 항목이 있으면 'full', 용어 풀이·암기 카드·관련 문제가 있으면 'auto'
  const STOP = new Set(['가운데', '벽 쪽', '왕', '이후', '특사', '판', '놀이와 음식', '다른 지역의 사건'].map(normKey));
  const linkCache = new Map();
  function linkState(text, unit) {
    const ck = unit + '|' + text;
    if (linkCache.has(ck)) return linkCache.get(ck);
    const k = normKey(text);
    let st = null;
    if (findEntry(text, unit)) st = 'full';
    else if (k.length >= 2 && !STOP.has(k) && !/^[\d·~,.]+/.test(k) && !/[→]/.test(text)) {
      const n = termQs(text).length;
      if (glossIndex.has(k) || termFlash(text).length || (n >= 1 && n <= 40)) st = 'auto';
    }
    linkCache.set(ck, st);
    return st;
  }
  const termBtn = (text, unit) =>
    `<button type="button" class="term ${linkState(text, unit) === 'full' ? 'full' : ''}" data-term="${esc(text)}" data-term-unit="${esc(unit)}">${esc(text)}</button>`;
  function boldTerm(t, unit, self) {
    const ok = x => !(self && self.has(normKey(x))) && linkState(x.trim(), unit);
    if (ok(t)) return termBtn(t, unit);
    if (t.includes('·') && t.split('·').some(ok)) return `<b>${t.split('·').map(x => (ok(x) ? termBtn(x.trim(), unit) : esc(x))).join('·')}</b>`;
    return `<b>${esc(t)}</b>`;
  }
  // **굵게**를 누를 수 있는 낱말로 바꿔요 (self: 지금 열린 항목 자신은 빼요)
  const fmtTerms = (s, unit, self) => String(s).split(/\*\*(.+?)\*\*/).map((part, i) => (i % 2 ? boldTerm(part, unit, self) : esc(part))).join('');

  // ----- 팝업 -----
  let dictCur = null;
  const dictStack = [];

  function showDictModal(html, label) {
    const box = document.querySelector('#modal .modal-box.dict-box');
    if (box) {
      box.innerHTML = `<button class="modal-x" type="button" data-close aria-label="닫기">✕</button>${html}`;
      box.setAttribute('aria-label', label);
      box.scrollTop = 0;
      box.focus();
    } else {
      A.openModal(html, label);
      const b = document.querySelector('#modal .modal-box');
      if (b) b.classList.add('dict-box');
    }
  }

  function openTerm(text, unit, { id = null, fromModal = false } = {}) {
    const e = id ? dictById[id] : findEntry(text, unit);
    if (fromModal && dictCur) dictStack.push(dictCur);
    else dictStack.length = 0;
    dictCur = { text: e ? e.term : text, unit: e ? e.unit : unit, id: e ? e.id : null };
    showDictModal(e ? entryHtml(e) : autoHtml(text, unit), e ? e.term : text);
  }

  function dictBack() {
    const prev = dictStack.pop();
    if (!prev) return;
    dictCur = prev;
    const e = prev.id && dictById[prev.id];
    showDictModal(e ? entryHtml(e) : autoHtml(prev.text, prev.unit), prev.text);
  }

  function backBtn() {
    const prev = dictStack[dictStack.length - 1];
    return prev ? `<button type="button" class="dict-back" data-dict-back>◀ ‘${esc(prev.text)}’(으)로 돌아가기</button>` : '';
  }

  function dictActions(key, unit, qn) {
    const here = location.hash;
    return `<div class="cta-row dict-actions">
      ${qn ? `<a class="btn btn-blue" href="#/exam/drill/${toKey(key)}">✏️ 관련 문제 ${qn}개 풀기</a>` : ''}
      ${unitById[unit] && !here.startsWith(`#/exam/note/${unit}`) ? `<a class="btn btn-ghost" href="#/exam/note/${unit}">📘 ${esc(unitById[unit].short)} 개념 노트</a>` : ''}
      ${EXAM_DICT.length && !here.startsWith('#/exam/dict') ? '<a class="btn btn-ghost" href="#/exam/dict">📖 역사 사전</a>' : ''}
    </div>`;
  }

  function flashBlock(cards) {
    if (!cards.length) return '';
    return `<section class="dict-sec"><p class="note-label">🗂️ 암기 카드로 확인</p>
      <ul class="dict-flash">${cards.slice(0, 3).map(c => `<li><b>${esc(c.f)}</b><span>${esc(c.b)}</span></li>`).join('')}</ul></section>`;
  }

  function entryHtml(e) {
    const u = unitById[e.unit] || {};
    const self = new Set([e.term, e.id, ...(e.aliases || [])].map(normKey));
    const imgs = imgsFor(e).slice(0, 2).map(id => imgById[id]);
    const rel = (e.related || []).filter(r => !self.has(normKey(r)));
    return `
      <article class="dict-pop" style="--era:${u.color || 'var(--blue)'}">
        ${backBtn()}
        <p class="dict-meta"><span class="chip">${esc(e.kind)}</span><span class="chip">${esc(u.short || '')}</span><span class="dict-when">${esc(e.when)}</span></p>
        <h2 class="dict-title">${esc(e.term)}</h2>
        <p class="dict-sum">${fmt(e.summary)}</p>
        ${imgs.map(m => `
          <figure class="dict-fig">
            <img src="${esc(m.file)}" alt="${esc(m.caption)}" loading="lazy" decoding="async">
            <figcaption><b>${esc(m.caption)}</b><small>${credit(m)}</small></figcaption>
          </figure>`).join('')}
        <section class="dict-sec note-story"><p class="note-label">📖 자세한 이야기</p><p>${fmtTerms(e.story, e.unit, self)}</p></section>
        ${e.points && e.points.length ? `<section class="dict-sec note-tip"><p class="note-label">💡 시험 포인트·함정</p><ul>${e.points.map(t => `<li>${fmtTerms(t, e.unit, self)}</li>`).join('')}</ul></section>` : ''}
        ${rel.length ? `<section class="dict-sec"><p class="note-label">🔗 함께 보면 좋은 낱말</p><div class="dict-rel">${rel.map(r => (linkState(r, e.unit)
          ? `<button type="button" class="chip dict-chip" data-term="${esc(r)}" data-term-unit="${esc(e.unit)}">${esc(r)}</button>`
          : `<span class="chip dict-chip plain">${esc(r)}</span>`)).join('')}</div></section>` : ''}
        ${flashBlock(termFlash(e.id))}
        ${dictActions(e.id, e.unit, termQs(e.id).length)}
      </article>`;
  }

  // 사전 항목이 없는 낱말: 용어 풀이·노트 문장·암기 카드·관련 문제를 모아 보여 줘요
  function autoHtml(text, unit) {
    const u = unitById[unit] || {};
    const k = normKey(text);
    const gloss = glossIndex.get(k);
    const self = new Set([k]);
    const lines = [];
    const order = [unit, ...EXAM_UNITS.map(x => x.id).filter(id => id !== unit)];
    for (const uid of order) {
      const un = unitById[uid];
      un.sections.forEach(s => s.items.forEach(it => { if (squash(it).includes(k)) lines.push([uid, it]); }));
      un.tables.forEach(t => t.rows.forEach(r => { const line = r.join(' — '); if (squash(line).includes(k)) lines.push([uid, line]); }));
      if (lines.length >= 3) break;
    }
    const qn = termQs(text).length;
    return `
      <article class="dict-pop auto" style="--era:${u.color || 'var(--blue)'}">
        ${backBtn()}
        <p class="dict-meta"><span class="chip">${esc(u.short || '')}</span><span class="dict-when">간단 풀이</span></p>
        <h2 class="dict-title">${esc(text)}</h2>
        ${gloss ? `<p class="dict-sum">${esc(gloss.m)}</p>` : ''}
        ${lines.length ? `<section class="dict-sec"><p class="note-label">📌 개념 노트에서</p><ul class="dict-lines">${lines.slice(0, 3).map(([uid, l]) => `<li>${fmtTerms(l, uid, self)}</li>`).join('')}</ul></section>` : ''}
        ${flashBlock(termFlash(text))}
        <p class="hint dict-auto-note">이 낱말은 노트·암기 카드·문제에서 모은 간단 풀이예요.</p>
        ${dictActions(text, unit, qn)}
      </article>`;
  }

  // ----- 사전 목록 화면 -----
  const dictFilter = { unit: '', q: '' };
  // 찾기: 낱말·다른 이름을 먼저, 그다음 요약·이야기·관련 낱말까지 살펴요
  const searchKey = e => squash([e.term, e.id, ...(e.aliases || []), e.summary, e.when, e.kind, e.story, ...(e.related || [])].join(' ').replace(/\*\*/g, '')).toLowerCase();

  function viewDict(arg) {
    const only = arg && arg.startsWith('u.') && unitById[arg.slice(2)] ? arg.slice(2) : '';
    dictFilter.unit = only;
    dictFilter.q = '';
    $app.innerHTML = `
      <div class="exam dict-page">
        <a class="back" href="#/exam">← 심화 학습 홈</a>
        <header class="page-head">
          <h1>📖 역사 사전</h1>
          <p>개념 노트의 핵심 낱말 <b>${EXAM_DICT.length}개</b>를 배경 이야기와 시험 포인트로 자세히 풀었어요. 개념 노트에서 밑줄 친 낱말을 눌러도 바로 열려요.</p>
        </header>
        <label class="dict-search"><span aria-hidden="true">🔍</span><input type="search" data-dict-q placeholder="낱말 찾기 (예: 진대법, 을파소, 귀주)" aria-label="사전에서 낱말 찾기" autocomplete="off" enterkeyhint="search"></label>
        <nav class="note-toc dict-units" aria-label="단원 고르기">
          <button type="button" data-dict-unit="" aria-pressed="${!only}">전체 ${EXAM_DICT.length}</button>
          ${EXAM_UNITS.map(u => {
            const n = EXAM_DICT.filter(e => e.unit === u.id).length;
            return n ? `<button type="button" data-dict-unit="${u.id}" aria-pressed="${only === u.id}" style="--era:${u.color}">${esc(u.short)} ${n}</button>` : '';
          }).join('')}
        </nav>
        <p class="hint dict-count" id="dict-count" role="status"></p>
        ${EXAM_UNITS.map((u, i) => {
          const list = EXAM_DICT.filter(e => e.unit === u.id);
          return list.length ? `
          <section class="panel dict-group" data-dict-group="${u.id}" style="--era:${u.color}">
            <h2>${i + 1}. ${esc(u.name)}</h2>
            <ul class="dict-list">${list.map(e => `
              <li data-dict-key="${esc(searchKey(e))}" data-dict-name="${esc(squash([e.term, e.id, ...(e.aliases || [])].join(' ')).toLowerCase())}">
                <button type="button" class="dict-item" data-term-id="${esc(e.id)}">
                  <span class="dict-item-head"><b>${esc(e.term)}</b>${imgsFor(e).length ? '<span class="dict-pic" title="사진 있음" aria-label="사진 있음">📷</span>' : ''}<small>${esc(e.kind)} · ${esc(e.when)}</small></span>
                  <span class="dict-item-sum">${esc(e.summary.replace(/\*\*/g, ''))}</span>
                </button>
              </li>`).join('')}
            </ul>
          </section>` : '';
        }).join('')}
        <p class="panel dict-empty" hidden>찾는 낱말이 없어요. 띄어쓰기 없이 짧게 다시 찾아보거나, 단원을 ‘전체’로 바꿔 보세요.</p>
      </div>`;
    applyDictFilter();
  }

  function applyDictFilter() {
    const q = squash(dictFilter.q).toLowerCase();
    let shown = 0;
    $app.querySelectorAll('[data-dict-group]').forEach(g => {
      let n = 0;
      const unitOk = !dictFilter.unit || g.dataset.dictGroup === dictFilter.unit;
      g.querySelectorAll('li[data-dict-key]').forEach(li => {
        const ok = unitOk && (!q || li.dataset.dictKey.includes(q));
        li.hidden = !ok;
        // 낱말 이름에 맞는 것을 앞에 보여 줘요
        li.style.order = q && !li.dataset.dictName.includes(q) ? '1' : '';
        if (ok) n++;
      });
      g.hidden = !n;
      shown += n;
    });
    $app.querySelectorAll('[data-dict-unit]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.dictUnit === dictFilter.unit)));
    const cnt = document.getElementById('dict-count');
    if (cnt) cnt.textContent = q || dictFilter.unit ? `${shown}개 낱말을 찾았어요.` : `모두 ${shown}개 낱말이 있어요. 낱말을 누르면 자세한 설명이 열려요.`;
    const empty = $app.querySelector('.dict-empty');
    if (empty) empty.hidden = shown > 0;
  }

  // ---------- 문제 풀기 (단원 · 섞어 풀기 · 오답 노트) ----------
  let drill = null;

  function viewDrill(key) {
    const d = data();
    let qids;
    if (key === 'wrong') qids = A.shuffle(Object.keys(d.wrong).filter(id => qById[id]));
    else if (key === 'mix') qids = A.shuffle(EXAM_QUESTIONS.map(q => q.id)).slice(0, MIX_LEN);
    else if (key.startsWith('t.')) qids = A.shuffle(termQs(fromKey(key)).map(q => q.id));
    else {
      // 안 풀어 본 문제를 먼저, 그다음 정답률이 낮은 문제 순으로
      const rate = q => { const s = d.stats[q.id]; return s ? s[1] / s[0] : -1; };
      qids = A.shuffle(unitQs(key)).sort((a, b) => rate(a) - rate(b)).map(q => q.id);
    }
    const title = key === 'wrong' ? '❗ 오답 노트' : key === 'mix' ? '🎲 전 단원 섞어 풀기'
      : key.startsWith('t.') ? `✏️ ‘${esc(termTitle(fromKey(key)))}’ 관련 문제` : `✏️ ${unitById[key].name}`;
    if (!qids.length) {
      $app.innerHTML = `
        <div class="exam">
          <a class="back" href="#/exam">← 심화 학습 홈</a>
          <section class="panel result">
            <div class="big-emoji" aria-hidden="true">🎉</div>
            <h1>${title}</h1>
            <p>오답 노트가 비어 있어요. 틀린 문제는 여기에 자동으로 모여요.</p>
            <div class="cta-row"><a class="btn btn-blue" href="#/exam/drill/mix">🎲 섞어 풀기</a><a class="btn btn-ghost" href="#/exam/mock">📝 모의고사</a></div>
          </section>
        </div>`;
      return;
    }
    drill = { key, title, qids, i: 0, picked: null, right: 0, missed: [] };
    $app.innerHTML = `<div class="exam"><a class="back" href="#/exam">← 심화 학습 홈</a><div id="drill"></div></div>`;
    renderDrill();
  }

  function questionHtml(q, no, { picked = null, reveal = false, mock = false } = {}) {
    const u = unitById[q.unit];
    const opts = optsOf(q);
    return `
      <section class="exam-q" style="--era:${u.color}">
        <p class="exam-meta"><span class="chip">${esc(u.short)} · ${esc(q.tag)}</span><span class="exam-point">[${EXAM_INFO.point}점]</span></p>
        <h1 class="exam-stem"><span class="exam-no">${no}.</span> ${esc(q.q)}</h1>
        ${q.src ? `<div class="exam-src">${fmtSrc(q.src)}</div>` : ''}
        <ol class="exam-opts">
          ${opts.map((o, k) => {
            let cls = '';
            if (reveal) cls = o.right ? 'right' : k === picked ? 'wrong' : 'dim';
            else if (k === picked) cls = 'chosen';
            return `<li>
              <button type="button" class="exam-opt ${cls}" data-exam-pick="${k}" ${reveal ? 'disabled' : ''} ${mock ? `aria-pressed="${k === picked}"` : ''}>
                <span class="mark" aria-hidden="true">${MARKS[k]}</span><span>${esc(o.text)}</span>
              </button>
              ${reveal ? `<p class="why ${o.right ? 'ok' : ''}">${o.right ? '정답' : '오답'} — ${esc(o.why)}</p>` : ''}
            </li>`;
          }).join('')}
        </ol>
      </section>`;
  }

  function renderDrill() {
    const box = document.getElementById('drill');
    const q = qById[drill.qids[drill.i]];
    const n = drill.qids.length;
    const answered = drill.picked !== null;
    const ok = answered && optsOf(q)[drill.picked].right;
    const done = drill.i + (answered ? 1 : 0);
    box.innerHTML = `
      <div class="quiz-top"><span>${drill.title}</span><span>${drill.i + 1} / ${n}</span><span>✔ ${drill.right}</span></div>
      <div class="bar" role="progressbar" aria-label="진행" aria-valuemin="0" aria-valuemax="${n}" aria-valuenow="${done}"><i style="width:${(done / n) * 100}%"></i></div>
      ${questionHtml(q, drill.i + 1, { picked: drill.picked, reveal: answered })}
      ${answered ? `
        <section class="feedback ${ok ? 'good' : 'bad'}" role="status">
          <div class="fb-head"><strong>${ok ? '⭕ 정답이에요!' : `❌ 오답이에요. 정답은 ${MARKS[answerIndex(q)]}번이에요.`}</strong></div>
          <p>${ok ? '보기별 해설로 다른 선택지도 함께 정리해 두세요.' : '이 문제는 오답 노트에 담았어요. 두 번 연속 맞히면 빠져요.'}</p>
          <button class="btn btn-blue" type="button" data-exam="drill-next">${drill.i + 1 < n ? '다음 문제 ▶' : '결과 보기'}</button>
        </section>` : '<p class="hint">숫자 키 1~5로도 고를 수 있어요.</p>'}`;
    if (answered) {
      const btn = box.querySelector('[data-exam="drill-next"]');
      btn.focus({ preventScroll: true });
      box.querySelector('.feedback').scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'nearest' });
    }
  }

  function pickDrill(k) {
    if (!drill || drill.picked !== null) return;
    const q = qById[drill.qids[drill.i]];
    const ok = optsOf(q)[k].right;
    drill.picked = k;
    if (ok) { drill.right++; A.sfx.good(); } else { drill.missed.push(q.id); A.sfx.bad(); }
    record(q.id, ok);
    A.save();
    renderDrill();
  }

  function nextDrill() {
    if (drill.i + 1 < drill.qids.length) {
      drill.i++;
      drill.picked = null;
      renderDrill();
      rerender();
      return;
    }
    const n = drill.qids.length;
    const rate = pct(drill.right, n);
    if (rate >= 80) { A.sfx.win(); A.confetti(40); }
    document.getElementById('drill').innerHTML = `
      <section class="panel result">
        <h1 class="result-score">${n}문제 중 ${drill.right}문제 정답 (${rate}%)</h1>
        <p class="result-msg">${rate >= 80 ? '1급 수준이에요! 👏' : rate >= 60 ? '조금만 더! 틀린 문제의 해설을 다시 읽어 보세요.' : '개념 노트를 먼저 정리하고 다시 도전해 보세요.'}</p>
        ${drill.missed.length ? `<p>틀린 ${drill.missed.length}문제는 오답 노트에 담았어요.</p>` : ''}
        <div class="cta-row">
          ${drill.missed.length ? '<a class="btn btn-red" href="#/exam/drill/wrong">❗ 오답 노트 풀기</a>' : ''}
          ${unitById[drill.key] ? `<a class="btn btn-ghost" href="#/exam/note/${drill.key}">📘 개념 노트</a>` : ''}
          <a class="btn btn-blue" href="#/exam/drill/${drill.key}">🔄 다시 풀기</a>
          <a class="btn btn-ghost" href="#/exam">심화 학습 홈</a>
        </div>
      </section>`;
    rerender();
  }

  // ---------- 실전 모의고사 ----------
  function buildMock() {
    const qids = [];
    EXAM_UNITS.forEach(u => {
      const n = EXAM_INFO.weights[u.id] || 0;
      A.shuffle(unitQs(u.id)).slice(0, n).forEach(q => qids.push(q.id));
    });
    return { qids, ans: {}, cur: 0, elapsed: 0, at: Date.now() };
  }

  function viewMock() {
    const d = data();
    if (d.mock && d.mock.qids.every(id => qById[id])) { renderMock(); return; }
    d.mock = null;
    const recent = d.mocks.slice(-5).reverse();
    $app.innerHTML = `
      <div class="exam">
        <a class="back" href="#/exam">← 심화 학습 홈</a>
        <header class="page-head">
          <h1>📝 실전 모의고사</h1>
          <p>실제 심화 시험처럼 <b>${EXAM_INFO.count}문항</b>을 <b>${EXAM_INFO.minutes}분</b> 안에 풀어요. 단원별 출제 비율을 반영해 매번 새로 뽑아요.</p>
        </header>
        <section class="panel">
          <h2>시험 방법</h2>
          <ul class="exam-rules">
            <li>문항당 ${EXAM_INFO.point}점, 100점 만점이에요. (실제 시험은 문항마다 1~3점으로 배점이 달라요.)</li>
            <li>정답과 해설은 제출한 뒤에 한꺼번에 보여 줘요. 틀린 문제는 오답 노트에 자동으로 담겨요.</li>
            <li>중간에 다른 화면으로 나가면 시간이 멈추고, 돌아오면 이어서 풀 수 있어요.</li>
            <li>${EXAM_INFO.minutes}분이 지나면 자동으로 제출돼요.</li>
          </ul>
          <div class="cta-row"><button class="btn btn-blue" type="button" data-exam="mock-start">⏱ 시험 시작</button></div>
        </section>
        ${recent.length ? `<section class="panel">
          <h2>최근 기록</h2>
          <div class="table-wrap"><table class="ntable">
            <thead><tr><th scope="col">날짜</th><th scope="col">점수</th><th scope="col">급수</th><th scope="col">걸린 시간</th></tr></thead>
            <tbody>${recent.map(m => `<tr><td>${new Date(m.at).toLocaleDateString('ko-KR')}</td><td>${m.score}점</td><td>${gradeOf(m.score)}</td><td>${Math.round(m.sec / 60)}분</td></tr>`).join('')}</tbody>
          </table></div>
        </section>` : ''}
      </div>`;
  }

  function renderMock(keepFocus) {
    const m = data().mock;
    const q = qById[m.qids[m.cur]];
    const n = m.qids.length;
    const answered = Object.keys(m.ans).length;
    $app.innerHTML = `
      <div class="exam">
        <div class="mock-bar" role="group" aria-label="시험 정보">
          <span class="mock-timer" id="mock-timer" aria-live="off">⏱ ${mmss(Math.max(0, LIMIT - m.elapsed))}</span>
          <span>답한 문항 <b>${answered}</b> / ${n}</span>
          <button class="mini" type="button" data-exam="mock-submit">제출하기</button>
        </div>
        ${questionHtml(q, m.cur + 1, { picked: m.ans[m.cur] != null ? m.ans[m.cur] : null, mock: true })}
        <div class="cta-row">
          <button class="btn btn-ghost" type="button" data-exam="mock-prev" ${m.cur === 0 ? 'disabled' : ''}>◀ 이전</button>
          ${m.cur + 1 < n
            ? '<button class="btn btn-blue" type="button" data-exam="mock-next">다음 ▶</button>'
            : '<button class="btn btn-green" type="button" data-exam="mock-submit">✅ 제출하기</button>'}
        </div>
        <section class="panel omr">
          <h2>답안지 <small class="hint">번호를 누르면 그 문항으로 가요</small></h2>
          <div class="omr-grid">${m.qids.map((_, i) => `<button type="button" class="${m.ans[i] != null ? 'done' : ''} ${i === m.cur ? 'cur' : ''}" data-exam-go="${i}" aria-label="${i + 1}번${m.ans[i] != null ? ` (${MARKS[m.ans[i]]} 표시)` : ' (안 푼 문항)'}">${i + 1}<small>${m.ans[i] != null ? MARKS[m.ans[i]] : ''}</small></button>`).join('')}</div>
        </section>
      </div>`;
    if (!keepFocus) rerender();
    startTimer();
  }

  function startTimer() {
    if (timer) return;
    let lastSave = Date.now();
    timer = setInterval(() => {
      const d = data();
      if (!d.mock || !location.hash.startsWith('#/exam/mock')) { stopTimer(); return; }
      d.mock.elapsed++;
      const left = LIMIT - d.mock.elapsed;
      const el = document.getElementById('mock-timer');
      if (el) {
        el.textContent = `⏱ ${mmss(Math.max(0, left))}`;
        el.classList.toggle('hurry', left <= 300);
      }
      if (Date.now() - lastSave > 10000) { A.save(); lastSave = Date.now(); }
      if (left <= 0) { stopTimer(); submitMock(true); }
    }, 1000);
  }

  function pickMock(k) {
    const m = data().mock;
    if (!m) return;
    if (m.ans[m.cur] === k) delete m.ans[m.cur];
    else m.ans[m.cur] = k;
    A.save();
    A.sfx.tap();
    renderMock(true);
    const btn = $app.querySelector(`[data-exam-pick="${k}"]`);
    if (btn) btn.focus({ preventScroll: true });
  }

  function goMock(i) {
    const m = data().mock;
    if (!m || i < 0 || i >= m.qids.length) return;
    m.cur = i;
    A.save();
    renderMock();
  }

  function submitMock(auto) {
    const d = data();
    const m = d.mock;
    if (!m) return;
    const left = m.qids.length - Object.keys(m.ans).length;
    if (!auto && left > 0 && !window.confirm(`아직 풀지 않은 문항이 ${left}개 있어요. 그래도 제출할까요?`)) return;
    stopTimer();
    let correct = 0;
    m.qids.forEach((id, i) => {
      const ok = m.ans[i] != null && optsOf(qById[id])[m.ans[i]].right;
      if (ok) correct++;
      record(id, ok);
    });
    const score = correct * EXAM_INFO.point;
    d.mocks.push({ at: Date.now(), score, correct, sec: Math.min(m.elapsed, LIMIT) });
    d.last = { qids: m.qids, ans: m.ans, score, correct, sec: Math.min(m.elapsed, LIMIT), auto: !!auto };
    d.mock = null;
    A.save();
    if (score >= 80) { A.sfx.win(); A.confetti(); } else A.sfx.tap();
    location.hash = '#/exam/result';
  }

  // ---------- 결과 ----------
  function viewResult() {
    const r = data().last;
    const grade = gradeOf(r.score);
    const byUnit = {};
    r.qids.forEach((id, i) => {
      const q = qById[id];
      if (!q) return;
      const b = byUnit[q.unit] || (byUnit[q.unit] = { n: 0, ok: 0 });
      b.n++;
      if (r.ans[i] != null && optsOf(q)[r.ans[i]].right) b.ok++;
    });
    const wrongs = r.qids.map((id, i) => ({ q: qById[id], i, pick: r.ans[i] }))
      .filter(x => x.q && !(x.pick != null && optsOf(x.q)[x.pick].right));
    $app.innerHTML = `
      <div class="exam">
        <a class="back" href="#/exam">← 심화 학습 홈</a>
        <section class="panel result">
          <p class="hint">${r.auto ? '시간이 다 되어 자동으로 제출했어요.' : '모의고사 결과'}</p>
          <h1 class="result-score">${r.score}점</h1>
          <p class="grade-badge ${grade === '불합격' ? 'fail' : ''}">${grade === '불합격' ? '60점 미만 · 불합격' : `${grade} 합격 수준`}</p>
          <p>${r.qids.length}문항 중 ${r.correct}문항 정답 · 걸린 시간 ${Math.floor(r.sec / 60)}분 ${r.sec % 60}초</p>
        </section>
        <section class="panel">
          <h2>단원별 결과</h2>
          <ul class="unit-result">
            ${EXAM_UNITS.filter(u => byUnit[u.id]).map(u => {
              const b = byUnit[u.id];
              return `<li style="--era:${u.color}"><span>${esc(u.short)}</span><div class="bar"><i style="width:${pct(b.ok, b.n)}%"></i></div><b>${b.ok}/${b.n}</b>${b.ok < b.n ? `<a class="mini" href="#/exam/note/${u.id}">노트</a>` : ''}</li>`;
            }).join('')}
          </ul>
        </section>
        <section class="panel">
          <h2>틀린 문제 다시 보기 (${wrongs.length})</h2>
          ${wrongs.length ? wrongs.map(x => `
            <details class="review">
              <summary>${x.i + 1}번 · ${esc(unitById[x.q.unit].short)} · ${esc(x.q.tag)} <span class="hint">내 답 ${x.pick != null ? MARKS[x.pick] : '없음'} / 정답 ${MARKS[answerIndex(x.q)]}</span></summary>
              ${questionHtml(x.q, x.i + 1, { picked: x.pick != null ? x.pick : null, reveal: true })}
            </details>`).join('') : '<p>모두 맞혔어요! 🎉</p>'}
        </section>
        <div class="cta-row">
          ${wrongs.length ? '<a class="btn btn-red" href="#/exam/drill/wrong">❗ 오답 노트 풀기</a>' : ''}
          <a class="btn btn-blue" href="#/exam/mock">📝 새 모의고사</a>
          <a class="btn btn-ghost" href="#/exam">심화 학습 홈</a>
        </div>
      </div>`;
  }

  // ---------- 빈출 연도·키워드 암기 카드 ----------
  const hardCount = () => Object.keys(data().flashHard).filter(id => flashById[id]).length;
  let flash = null;

  function viewFlashHub() {
    const d = data();
    const hard = d.flashHard;
    $app.innerHTML = `
      <div class="exam">
        <a class="back" href="#/exam">← 심화 학습 홈</a>
        <header class="page-head">
          <h1>🗂️ 빈출 연도·키워드 암기 카드</h1>
          <p>앞면을 보고 답을 떠올린 뒤 카드를 뒤집어 확인해요. <b>다시 볼래요</b>를 누른 카드는 ‘헷갈리는 카드’에 모이고, <b>알아요</b>를 누르면 빠져요.</p>
        </header>
        <label class="flip-opt"><input type="checkbox" data-exam-rev ${d.flashRev ? 'checked' : ''}> 뒷면(설명)을 먼저 보고 연도·키워드 떠올리기</label>
        <div class="deck-grid">
          <a class="deck deck-all" href="#/exam/flash/all"><b>🎲 전체 섞기</b><small>${FLASH.length}장</small></a>
          <a class="deck deck-hard" href="#/exam/flash/hard"><b>🤔 헷갈리는 카드</b><small>${hardCount()}장</small></a>
          ${EXAM_UNITS.map((u, i) => {
            const cards = FLASH.filter(c => c.unit === u.id);
            const h = cards.filter(c => hard[c.id]).length;
            return `<a class="deck" href="#/exam/flash/${u.id}" style="--era:${u.color}"><b>${i + 1}. ${esc(u.short)}</b><small>${cards.length}장${h ? ` · 헷갈림 ${h}` : ''}</small></a>`;
          }).join('')}
        </div>
      </div>`;
  }

  function viewFlash(key) {
    const d = data();
    let cards;
    if (key === 'all') cards = FLASH;
    else if (key === 'hard') cards = FLASH.filter(c => d.flashHard[c.id]);
    else cards = FLASH.filter(c => c.unit === key);
    const title = key === 'all' ? '🎲 전체 섞기' : key === 'hard' ? '🤔 헷갈리는 카드' : `🗂️ ${unitById[key].short}`;
    if (!cards.length) {
      $app.innerHTML = `
        <div class="exam">
          <a class="back" href="#/exam/flash">← 덱 고르기</a>
          <section class="panel result">
            <div class="big-emoji" aria-hidden="true">🎉</div>
            <h1>${title}</h1>
            <p>헷갈리는 카드가 없어요. 카드를 보다가 <b>다시 볼래요</b>를 누르면 여기에 모여요.</p>
            <div class="cta-row"><a class="btn btn-blue" href="#/exam/flash/all">🎲 전체 섞기</a></div>
          </section>
        </div>`;
      return;
    }
    flash = { key, title, queue: A.shuffle(cards.map(c => c.id)), pos: 0, flipped: false, known: 0, again: 0, total: cards.length, rev: !!d.flashRev };
    $app.innerHTML = `<div class="exam"><a class="back" href="#/exam/flash">← 덱 고르기</a><div id="flash"></div></div>`;
    renderFlash();
  }

  function renderFlash() {
    const box = document.getElementById('flash');
    if (flash.pos >= flash.queue.length) { finishFlash(box); return; }
    const c = flashById[flash.queue[flash.pos]];
    const u = unitById[c.unit];
    const [front, back] = flash.rev ? [c.b, c.f] : [c.f, c.b];
    const left = flash.queue.length - flash.pos;
    box.innerHTML = `
      <div class="quiz-top"><span>${flash.title}</span><span>남은 카드 ${left}</span><span>🤔 ${hardCount()}</span></div>
      <div class="bar" role="progressbar" aria-label="진행" aria-valuemin="0" aria-valuemax="${flash.total}" aria-valuenow="${flash.known}"><i style="width:${(flash.known / flash.total) * 100}%"></i></div>
      <h1 class="visually-hidden">${flash.title} 암기 카드</h1>
      <button type="button" class="flash-card" data-exam="flash-flip" style="--era:${u.color}" aria-label="카드 뒤집기">
        <span class="flash-inner">
          <span class="flash-face front"><small>${esc(u.short)}</small><b>${esc(front)}</b><em>눌러서 뒤집기</em></span>
          <span class="flash-face back" aria-hidden="true"><small>${flash.rev ? '연도·키워드' : '정답'}</small><b>${esc(back)}</b></span>
        </span>
      </button>
      <div class="flash-btns" id="flash-btns">${flashButtons()}</div>
      <p class="hint flash-keys">키보드: 스페이스 = 뒤집기 · 1 = 다시 볼래요 · 2 = 알아요</p>`;
  }

  const flashButtons = () => flash.flipped
    ? `<button class="btn btn-red" type="button" data-exam="flash-again">🤔 다시 볼래요</button>
       <button class="btn btn-green" type="button" data-exam="flash-know">😊 알아요</button>`
    : '<button class="btn btn-blue" type="button" data-exam="flash-flip">🔄 뒤집어 확인하기</button>';

  function flipFlash() {
    const card = document.querySelector('#flash .flash-card');
    if (!card) return;
    flash.flipped = !flash.flipped;
    card.classList.toggle('flipped', flash.flipped);
    card.querySelector('.front').setAttribute('aria-hidden', String(flash.flipped));
    card.querySelector('.back').setAttribute('aria-hidden', String(!flash.flipped));
    document.getElementById('flash-btns').innerHTML = flashButtons();
    A.sfx.tap();
    card.focus({ preventScroll: true });
  }

  function answerFlash(known) {
    if (!flash || !flash.flipped) return;
    const id = flash.queue[flash.pos];
    const hard = data().flashHard;
    if (known) {
      flash.known++;
      delete hard[id];
      A.sfx.good();
    } else {
      // 헷갈리는 카드에 넣고, 이번 학습의 맨 뒤에 한 번 더 보여 줘요
      flash.again++;
      hard[id] = true;
      flash.queue.push(id);
      A.sfx.tap();
    }
    A.save();
    flash.pos++;
    flash.flipped = false;
    renderFlash();
    const card = document.querySelector('#flash .flash-card');
    if (card) card.focus({ preventScroll: true });
  }

  function finishFlash(box) {
    const h = hardCount();
    if (!flash.again) { A.sfx.win(); A.confetti(40); }
    box.innerHTML = `
      <section class="panel result">
        <div class="big-emoji" aria-hidden="true">${flash.again ? '💪' : '🏆'}</div>
        <h1 class="result-score">${flash.total}장을 모두 외웠어요!</h1>
        <p>${flash.again ? `‘다시 볼래요’를 ${flash.again}번 눌렀어요. 헷갈리는 카드는 모두 ${h}장이에요.` : '한 번에 모두 알았어요. 대단해요!'}</p>
        <div class="cta-row">
          ${h ? '<a class="btn btn-red" href="#/exam/flash/hard">🤔 헷갈리는 카드 복습</a>' : ''}
          <a class="btn btn-blue" href="#/exam/flash/${flash.key}">🔄 다시 하기</a>
          <a class="btn btn-ghost" href="#/exam/flash">덱 고르기</a>
        </div>
      </section>`;
    rerender();
  }

  // ---------- 이벤트 ----------
  document.addEventListener('change', e => {
    if (e.target.matches('[data-exam-rev]')) { data().flashRev = e.target.checked; A.save(); }
    if (e.target.matches('[data-exam-compact]')) {
      data().noteCompact = e.target.checked;
      A.save();
      const box = e.target.closest('.exam');
      if (box) box.classList.toggle('compact', e.target.checked);
    }
  });

  document.addEventListener('input', e => {
    if (e.target.matches('[data-dict-q]')) { dictFilter.q = e.target.value; applyDictFilter(); }
  });

  document.addEventListener('click', e => {
    const term = e.target.closest('[data-term], [data-term-id]');
    if (term) {
      openTerm(term.dataset.term || '', term.dataset.termUnit || '', { id: term.dataset.termId || null, fromModal: !!term.closest('#modal') });
      return;
    }
    if (e.target.closest('[data-dict-back]')) { dictBack(); return; }
    const du = e.target.closest('[data-dict-unit]');
    if (du) { dictFilter.unit = du.dataset.dictUnit; applyDictFilter(); return; }
    const jump = e.target.closest('[data-exam-jump]');
    if (jump) {
      const target = document.getElementById(jump.dataset.examJump);
      if (target) target.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
      return;
    }
    const zoom = e.target.closest('[data-exam-zoom]');
    if (zoom) { zoomImage(zoom.dataset.examZoom); return; }
    const pick = e.target.closest('[data-exam-pick]');
    if (pick && !pick.disabled && !pick.closest('details')) {
      const k = Number(pick.dataset.examPick);
      if (location.hash.startsWith('#/exam/mock')) pickMock(k);
      else pickDrill(k);
      return;
    }
    const go = e.target.closest('[data-exam-go]');
    if (go) { goMock(Number(go.dataset.examGo)); return; }
    const act = e.target.closest('[data-exam]');
    if (!act || act.disabled) return;
    switch (act.dataset.exam) {
      case 'drill-next': nextDrill(); break;
      case 'mock-start': data().mock = buildMock(); A.save(); A.sfx.tap(); renderMock(); break;
      case 'mock-prev': goMock(data().mock.cur - 1); break;
      case 'mock-next': goMock(data().mock.cur + 1); break;
      case 'mock-submit': submitMock(false); break;
      case 'flash-flip': flipFlash(); break;
      case 'flash-know': answerFlash(true); break;
      case 'flash-again': answerFlash(false); break;
    }
  });

  // 숫자 키 1~5로 답 고르기 · 암기 카드는 스페이스(뒤집기)와 1·2
  document.addEventListener('keydown', e => {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    if (document.getElementById('modal') || /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName)) return;
    if (location.hash.startsWith('#/exam/flash/') && flash && document.querySelector('#flash .flash-card')) {
      if (e.key === ' ' && document.activeElement.tagName !== 'BUTTON') { e.preventDefault(); flipFlash(); }
      else if (flash.flipped && e.key === '1') answerFlash(false);
      else if (flash.flipped && e.key === '2') answerFlash(true);
      return;
    }
    if (!/^[1-5]$/.test(e.key)) return;
    const k = Number(e.key) - 1;
    if (location.hash.startsWith('#/exam/mock') && data().mock) pickMock(k);
    else if (location.hash.startsWith('#/exam/drill') && drill && document.getElementById('drill') && drill.picked === null) pickDrill(k);
  });
})();
