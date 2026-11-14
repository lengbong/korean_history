#!/usr/bin/env node
/*
 * 범이의 역사 탐험대 — 어두운 화면(다크 모드) 스타일 만들기
 *
 *   node tools/build-dark.js
 *
 * css/style.css의 밝은 화면 규칙을 읽어서, 색이 들어간 선언마다 어두운 화면용 색을 계산해
 * 같은 파일 맨 아래의 「자동으로 만든 어두운 화면」 구역(DARK-AUTO-START ~ DARK-AUTO-END)을 새로 써요.
 * css/style.css에서 색을 고치거나 규칙을 더했다면 이 도구를 다시 돌려 주세요.
 *
 * 바꾸는 규칙
 *  - 글자색(color): 어두운 색 → 같은 빛깔의 밝은 색, ‘시대 색 + black’ 섞기 → ‘시대 색 + white’ 섞기,
 *    강조색 변수(--blue 등) → 조금 밝게. 단, 같은 규칙에 진한 바탕색이 있으면 그대로 둬요(노란 단추 위의 갈색 글자 등).
 *  - 바탕·테두리(background, border, outline): 밝은 색 → 같은 빛깔의 어두운 색, ‘… + white’ 섞기 → ‘… + 종이색’.
 *  - 그대로 두는 것: 진한 강조색 바탕(단추·타일), 흰 글자, 그림자, 사진.
 * 자동으로 안 맞는 곳은 구역 아래 「손으로 고친 어두운 화면」에 따로 적어요(이 도구가 건드리지 않아요).
 */
const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, '..', 'css', 'style.css');
const START = '/* DARK-AUTO-START — tools/build-dark.js가 만든 구역이에요. 손으로 고치지 마세요. */';
const END = '/* DARK-AUTO-END */';
const DARK = ':root[data-theme="dark"]';
// 꾸밈용이라 색을 그대로 두는 것 (색동 줄무늬, 꽃가루)
const KEEP = ['.saekdong', '.confetti'];

// 어두운 화면의 기본 색 (밝은 화면의 :root 변수를 덮어써요)
const VARS = `${DARK} {
  color-scheme: dark;
  --bg: #171310;
  --paper: #231e1a;
  --paper-2: #2b2520;
  --ink: #efe6dc;
  --muted: #b5a798;
  --line: #40362d;
  --good-bg: #17301f;
  --bad-bg: #3a1d1d;
  --shadow: 0 4px 0 rgba(0, 0, 0, 0.28), 0 10px 24px rgba(0, 0, 0, 0.38);
}`;

// ---------- 색 계산 ----------
function hexToHsl(hex) {
  let h = hex.replace('#', '');
  if (h.length === 3) h = h.split('').map(c => c + c).join('');
  const [r, g, b] = [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16) / 255);
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let hue = 0, s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) hue = ((g - b) / d + (g < b ? 6 : 0));
    else if (max === g) hue = (b - r) / d + 2;
    else hue = (r - g) / d + 4;
    hue *= 60;
  }
  return [hue, s * 100, l * 100];
}
function hslToHex(h, s, l) {
  s /= 100; l /= 100;
  const k = n => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = n => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return '#' + [0, 8, 4].map(n => Math.round(f(n) * 255).toString(16).padStart(2, '0')).join('');
}
const HEX = /#(?:[0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b/g;
const ACCENT = /var\(--(red|orange|blue|green|purple|good|bad)\)/g;

// 글자색: 어두운 색을 밝게
function textHex(hex) {
  const [h, s, l] = hexToHsl(hex);
  if (l >= 45) return hex;
  return hslToHex(h, Math.min(s, 55), 90 - l * 0.3);
}
// 바탕·테두리: 밝은 색을 어둡게 (빛깔은 조금 남겨요)
function surfaceHex(hex) {
  const lower = hex.toLowerCase();
  if (lower === '#fff' || lower === '#ffffff') return 'var(--paper)';
  const [h, s, l] = hexToHsl(hex);
  if (l > 78) return hslToHex(h, Math.min(s * 0.3, 30), 12 + (100 - l) * 0.45);
  if (l > 60) return hslToHex(h, s * 0.6, l * 0.55);
  return hex;
}
// 값 안에 ‘진한 바탕’이 있는지 (그 위의 글자는 원래 색을 지켜요)
function hasStrongFill(value) {
  if (/var\(--(red|orange|yellow|blue|green|purple|pink|era|tile|nc)\b/.test(value) && !/, (white|var\(--paper\))\)/.test(value)) return true;
  return (value.match(HEX) || []).some(hex => { const l = hexToHsl(hex)[2]; return l >= 30 && l <= 78; });
}

const isText = prop => prop === 'color' || prop === '-webkit-text-fill-color';
const isSurface = prop => /^(background|border|outline)/.test(prop);

function transform(prop, value, strongFill, inkFill) {
  if (isText(prop)) {
    // 바탕이 글자색(--ink)인 뒤집힌 단추: 어두운 화면에서는 바탕이 밝아지니 글자를 종이색으로
    if (inkFill) return value.replace(/#fff(?:fff)?\b|\bwhite\b/gi, 'var(--paper)');
    if (strongFill) return value;
    return value
      .replace(/(\d+)%, black\)/g, (m, n) => `${Math.max(40, n - 15)}%, white)`)
      .replace(HEX, textHex)
      .replace(ACCENT, (m, name) => (/color-mix/.test(value) ? m : `color-mix(in srgb, var(--${name}) 62%, white)`));
  }
  if (isSurface(prop)) {
    return value
      .replace(/, white\)/g, ', var(--paper))')
      .replace(HEX, surfaceHex);
  }
  return value;
}

// ---------- 스타일 읽기 ----------
function splitTop(text, sep) {
  const out = []; let depth = 0, cur = '';
  for (const ch of text) {
    if (ch === '(') depth++; else if (ch === ')') depth--;
    if (ch === sep && depth === 0) { out.push(cur); cur = ''; } else cur += ch;
  }
  if (cur.trim()) out.push(cur);
  return out;
}
function parse(css) {
  const rules = []; let i = 0;
  while (i < css.length) {
    const open = css.indexOf('{', i);
    if (open < 0) break;
    const prelude = css.slice(i, open).trim();
    let depth = 1, j = open + 1;
    while (j < css.length && depth) { if (css[j] === '{') depth++; else if (css[j] === '}') depth--; j++; }
    const body = css.slice(open + 1, j - 1);
    if (/^@(media|supports)/.test(prelude)) rules.push({ at: prelude, rules: parse(body) });
    else if (!prelude.startsWith('@')) rules.push({ sel: prelude, body });
    i = j;
  }
  return rules;
}
// :where()로 감싸 우선순위를 원래 규칙과 똑같이 둬요. 그래야 ‘파란 단추의 흰 글자’처럼
// 더 구체적인 규칙이 이기던 관계가 어두운 화면에서도 그대로 지켜져요.
function darkSelector(sel) {
  return splitTop(sel, ',').map(s => {
    s = s.trim();
    if (s === ':root' || s === 'html') return DARK;
    return `:where(${DARK}) ${s}`;
  }).join(', ');
}
function emit(rules, indent) {
  const out = [];
  for (const r of rules) {
    if (r.at) {
      const inner = emit(r.rules, indent + '  ');
      if (inner.length) out.push(`${indent}${r.at} {\n${inner.join('\n')}\n${indent}}`);
      continue;
    }
    const decls = splitTop(r.body, ';').map(d => {
      const k = d.indexOf(':');
      return k < 0 ? null : [d.slice(0, k).trim(), d.slice(k + 1).trim()];
    }).filter(Boolean);
    const strongFill = decls.some(([p, v]) => /^background/.test(p) && hasStrongFill(v));
    const inkFill = decls.some(([p, v]) => /^background/.test(p) && /var\(--ink\)/.test(v));
    // 글자색·바탕색은 바뀌지 않아도 같이 적어요. 우선순위가 같은 규칙끼리는 나중에 적힌 쪽이 이기는데,
    // 바뀐 규칙만 아래로 옮기면 그 순서가 뒤집히기 때문이에요.
    const always = p => isText(p) || /^background(-color|-image)?$/.test(p);
    const changed = decls
      .filter(([p]) => !p.startsWith('--'))
      .map(([p, v]) => [p, v, transform(p, v, strongFill, inkFill)])
      .filter(([p, v, nv]) => nv !== v || always(p));
    if (changed.length) out.push(`${indent}${darkSelector(r.sel)} { ${changed.map(([p, , nv]) => `${p}: ${nv};`).join(' ')} }`);
  }
  return out;
}

// ---------- 실행 ----------
let css = fs.readFileSync(FILE, 'utf8');
const a = css.indexOf(START);
const b = css.indexOf(END);
const tail = a >= 0 && b > a ? css.slice(b + END.length) : '';
if (a >= 0 && b > a) css = css.slice(0, a);
const source = css.replace(/\/\*[\s\S]*?\*\//g, '');
// 이미 어두운 화면용으로 쓴 규칙(손으로 고친 구역 등)은 다시 바꾸지 않아요
const keep = r => r.at ? Object.assign(r, { rules: r.rules.filter(keep) }) : !r.sel.includes('data-theme') && !KEEP.some(k => r.sel.includes(k));
const rules = parse(source).filter(keep);
const lines = emit(rules, '');
const block = `${START}\n${VARS}\n${lines.join('\n')}\n${END}`;
fs.writeFileSync(FILE, css.replace(/\s*$/, '\n\n') + block + tail.replace(/^\s*$/, '\n'));
console.log(`어두운 화면 규칙 ${lines.length}개를 css/style.css에 썼어요.`);
