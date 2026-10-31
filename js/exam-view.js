/*
 * 범이의 역사 탐험대 — 한국사능력검정시험 심화 대비 화면
 * 주소: #/exam (학습 홈), #/exam/note/<단원>, #/exam/drill/<단원|mix|wrong>, #/exam/mock, #/exam/result,
 *       #/exam/flash (암기 카드 덱 고르기), #/exam/flash/<단원|all|hard>
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
    else if (sub === 'drill' && (unitById[arg] || arg === 'mix' || arg === 'wrong')) viewDrill(arg);
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

  function plusParts(p) {
    if (!p) return { story: '', extra: '' };
    const story = p.story ? `<div class="note-story"><p class="note-label">📖 흐름 이야기</p><p>${fmt(p.story)}</p></div>` : '';
    const tips = p.tips && p.tips.length
      ? `<div class="note-tip"><p class="note-label">💡 시험 포인트·함정</p><ul>${p.tips.map(t => `<li>${fmt(t)}</li>`).join('')}</ul></div>` : '';
    const terms = p.terms && p.terms.length
      ? `<details class="note-terms"><summary>🔤 용어 풀이 (${p.terms.length})</summary><dl>${p.terms.map(([w, m]) => `<div><dt>${esc(w)}</dt><dd>${esc(m)}</dd></div>`).join('')}</dl></details>` : '';
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
        ${u.sections.map((s, k) => {
          const p = secPlus[s.h];
          const { story, extra } = plusParts(p);
          return `
          <section class="panel note" id="note-s${k}">
            <h2>${esc(s.h)}</h2>
            ${figures(p && p.img)}
            ${story}
            ${story ? '<p class="note-label note-core-label">📌 핵심 정리</p>' : ''}
            <ul class="note-core">${s.items.map(it => `<li>${fmt(it)}</li>`).join('')}</ul>
            ${extra}
          </section>`;
        }).join('')}
        ${u.tables.map((t, k) => {
          const { story, extra } = plusParts(tablePlus[t.title]);
          return `
          <section class="panel note" id="note-t${k}">
            <h2>📋 ${esc(t.title)}</h2>
            ${story}
            <p class="hint table-hint">표를 옆으로 밀면 더 볼 수 있어요 →</p>
            <div class="table-wrap"><table class="ntable">
              <thead><tr>${t.head.map(h => `<th scope="col">${esc(h)}</th>`).join('')}</tr></thead>
              <tbody>${t.rows.map(r => `<tr>${r.map((c, n) => n === 0 ? `<th scope="row">${fmt(c)}</th>` : `<td>${fmt(c)}</td>`).join('')}</tr>`).join('')}</tbody>
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

  // ---------- 문제 풀기 (단원 · 섞어 풀기 · 오답 노트) ----------
  let drill = null;

  function viewDrill(key) {
    const d = data();
    let qids;
    if (key === 'wrong') qids = A.shuffle(Object.keys(d.wrong).filter(id => qById[id]));
    else if (key === 'mix') qids = A.shuffle(EXAM_QUESTIONS.map(q => q.id)).slice(0, MIX_LEN);
    else {
      // 안 풀어 본 문제를 먼저, 그다음 정답률이 낮은 문제 순으로
      const rate = q => { const s = d.stats[q.id]; return s ? s[1] / s[0] : -1; };
      qids = A.shuffle(unitQs(key)).sort((a, b) => rate(a) - rate(b)).map(q => q.id);
    }
    const title = key === 'wrong' ? '❗ 오답 노트' : key === 'mix' ? '🎲 전 단원 섞어 풀기' : `✏️ ${unitById[key].name}`;
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

  document.addEventListener('click', e => {
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
