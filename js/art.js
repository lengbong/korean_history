/*
 * 문화유산 카드 그림 (SVG)
 * 이모지로 표현하기 어려운 유물을 간단한 그림으로 그립니다.
 */

const ART = (() => {
  const svg = (body, viewBox = '0 0 120 120') =>
    `<svg viewBox="${viewBox}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">${body}</svg>`;

  const range = n => Array.from({ length: n }, (_, i) => i);

  // 빗살무늬: 줄마다 방향이 바뀌는 짧은 빗금
  const bitsalLines = range(4).map(row => {
    const y = 32 + row * 13;
    const half = 27 - row * 5;
    const dir = row % 2 ? -1 : 1;
    return range(Math.floor(half / 4) + 1).map(i => {
      const x = 60 - half + i * 8;
      return `<line x1="${x}" y1="${y}" x2="${x + 5 * dir}" y2="${y + 7}"/>`;
    }).join('');
  }).join('');

  // 첨성대: 아래가 넓고 위로 갈수록 좁아지는 돌 단
  const cheomCourses = range(11).map(i => {
    const y = 92 - i * 6.4;
    const w = 26 + 22 * Math.pow(1 - i / 10, 1.8);
    return `<rect x="${(60 - w / 2).toFixed(1)}" y="${y.toFixed(1)}" width="${w.toFixed(1)}" height="6.4" rx="1.5"/>`;
  }).join('');

  // 팔만대장경판의 글자
  const blockChars = range(11).map(c => range(6).map(r =>
    `<rect x="${24 + c * 6.6}" y="${40 + r * 7.2}" width="4" height="4.4" rx="1"/>`).join('')).join('');

  // 거북선 등의 쇠못
  const spikes = range(9).map(i => {
    const t = (i + 1) / 10;
    const x = 26 + t * 68;
    const y = 70 - Math.sin(Math.PI * t) * 23;
    return `<path d="M${(x - 2.5).toFixed(1)} ${(y + 1).toFixed(1)} L${x.toFixed(1)} ${(y - 6).toFixed(1)} L${(x + 2.5).toFixed(1)} ${(y + 1).toFixed(1)}Z"/>`;
  }).join('');

  // 태극기 괘 (막대 길이 20, 두께 10/3, 간격 5/3)
  const bar = (y, broken) => broken
    ? `<rect x="-10" y="${y}" width="9.17" height="3.33"/><rect x="0.83" y="${y}" width="9.17" height="3.33"/>`
    : `<rect x="-10" y="${y}" width="20" height="3.33"/>`;
  const trigram = (dist, lines) => lines.map((broken, i) => bar(-(dist - 5 + i * 5) - 1.67, broken)).join('');
  const D = 36.67;

  // 마야 피라미드의 계단식 단 (아래가 넓고 위로 갈수록 좁아져요)
  const mayaTiers = range(5).map(i => {
    const w = 100 - 16 * i;
    return `<rect x="${60 - w / 2}" y="${88 - 12 * i}" width="${w}" height="12"/>`;
  }).join('');

  // 피라미드의 돌 단 (꼭짓점 52,30 · 밑변 10~94, y=99)
  const pyramidCourses = range(6).map(i => {
    const y = 40 + i * 10;
    const half = (y - 30) * (42 / 69);
    return `<line x1="${(52 - half).toFixed(1)}" y1="${y}" x2="${(52 + half).toFixed(1)}" y2="${y}"/>`;
  }).join('');

  return {
    jumeok: svg(`
      <ellipse cx="60" cy="108" rx="34" ry="5" fill="#000" opacity=".08"/>
      <path d="M60 10 C77 30 92 62 88 88 C85 103 73 110 60 110 C47 110 35 103 32 88 C28 62 43 30 60 10Z" fill="#b08968" stroke="#6b4f3a" stroke-width="3" stroke-linejoin="round"/>
      <path d="M60 20 L50 50 L60 68 L71 47Z" fill="#c9a27e"/>
      <path d="M41 70 L60 68 L51 95Z" fill="#9c7556"/>
      <path d="M60 68 L80 73 L69 99Z" fill="#a98063"/>
      <path d="M60 20 L50 50 L60 68 L71 47Z M41 70 L60 68 L80 73" fill="none" stroke="#6b4f3a" stroke-width="1.5" opacity=".6"/>`),

    bitsal: svg(`
      <ellipse cx="60" cy="110" rx="18" ry="4" fill="#000" opacity=".08"/>
      <path d="M28 22 H92 C94 52 82 88 60 108 C38 88 26 52 28 22Z" fill="#c98b5a" stroke="#7a4b2a" stroke-width="3" stroke-linejoin="round"/>
      <ellipse cx="60" cy="22" rx="32" ry="5" fill="#a86c3f" stroke="#7a4b2a" stroke-width="3"/>
      <g stroke="#7a4b2a" stroke-width="2.4" stroke-linecap="round">${bitsalLines}</g>`),

    goindol: svg(`
      <rect x="6" y="100" width="108" height="10" rx="5" fill="#8bc34a"/>
      <path d="M33 58 H47 L49 102 H31Z" fill="#9e9e9e" stroke="#555" stroke-width="3" stroke-linejoin="round"/>
      <path d="M73 58 H87 L89 102 H71Z" fill="#8f8f8f" stroke="#555" stroke-width="3" stroke-linejoin="round"/>
      <path d="M10 52 C16 36 98 30 112 44 C115 55 102 62 60 63 C22 63 8 60 10 52Z" fill="#b5b5b5" stroke="#555" stroke-width="3" stroke-linejoin="round"/>
      <path d="M26 46 C44 40 78 39 96 42" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".45"/>`),

    bipa: svg(`
      <path d="M60 8 C66 24 69 38 67 50 C74 58 77 72 71 84 L65 92 H55 L49 84 C43 72 46 58 53 50 C51 38 54 24 60 8Z" fill="#c8a24c" stroke="#6b5520" stroke-width="3" stroke-linejoin="round"/>
      <path d="M53 50 C56 52 64 52 67 50" fill="none" stroke="#6b5520" stroke-width="2"/>
      <line x1="60" y1="16" x2="60" y2="90" stroke="#6b5520" stroke-width="3"/>
      <rect x="44" y="90" width="32" height="7" rx="3.5" fill="#8d6e63" stroke="#4e342e" stroke-width="2"/>
      <rect x="54" y="97" width="12" height="18" rx="3" fill="#5d4037"/>
      <path d="M62 22 C64 32 65 40 64 48" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" opacity=".5"/>`),

    cheomseongdae: svg(`
      <rect x="22" y="104" width="76" height="8" rx="2" fill="#a1887f"/>
      <rect x="28" y="98" width="64" height="7" rx="2" fill="#bcaaa4"/>
      <g fill="#dccaa8" stroke="#8a7656" stroke-width="1.6">${cheomCourses}</g>
      <rect x="54" y="56" width="12" height="13" rx="1" fill="#4e342e"/>
      <rect x="44" y="20" width="32" height="7" fill="#c9b591" stroke="#8a7656" stroke-width="2"/>
      <rect x="47" y="14" width="26" height="6" fill="#d8c6a2" stroke="#8a7656" stroke-width="2"/>
      <circle cx="94" cy="20" r="3" fill="#f7b733"/><circle cx="102" cy="34" r="2" fill="#f7b733"/><circle cx="20" cy="28" r="2.5" fill="#f7b733"/>`),

    dabotap: svg(`
      <rect x="16" y="100" width="88" height="10" rx="2" fill="#bdb5a8" stroke="#7d756a" stroke-width="2"/>
      <rect x="50" y="94" width="20" height="6" fill="#cfc8bb" stroke="#7d756a" stroke-width="1.5"/>
      <rect x="28" y="72" width="64" height="22" fill="#e3ddd2" stroke="#7d756a" stroke-width="2"/>
      <g fill="#bdb5a8"><rect x="32" y="72" width="6" height="22"/><rect x="82" y="72" width="6" height="22"/><rect x="57" y="72" width="6" height="22"/></g>
      <rect x="22" y="66" width="76" height="7" rx="1.5" fill="#cfc8bb" stroke="#7d756a" stroke-width="2"/>
      <rect x="38" y="54" width="44" height="12" fill="#e3ddd2" stroke="#7d756a" stroke-width="2"/>
      <g stroke="#7d756a" stroke-width="1.5">${range(7).map(i => `<line x1="${42 + i * 6}" y1="56" x2="${42 + i * 6}" y2="64"/>`).join('')}</g>
      <rect x="34" y="50" width="52" height="5" rx="1.5" fill="#cfc8bb" stroke="#7d756a" stroke-width="2"/>
      <rect x="46" y="38" width="28" height="12" fill="#e3ddd2" stroke="#7d756a" stroke-width="2"/>
      <ellipse cx="60" cy="36" rx="18" ry="4.5" fill="#cfc8bb" stroke="#7d756a" stroke-width="2"/>
      <rect x="52" y="22" width="16" height="12" fill="#e3ddd2" stroke="#7d756a" stroke-width="2"/>
      <path d="M44 22 L60 15 L76 22Z" fill="#cfc8bb" stroke="#7d756a" stroke-width="2" stroke-linejoin="round"/>
      <line x1="60" y1="4" x2="60" y2="15" stroke="#7d756a" stroke-width="3"/>
      <circle cx="60" cy="8" r="3" fill="#cfc8bb" stroke="#7d756a" stroke-width="1.5"/>`),

    celadon: svg(`
      <ellipse cx="60" cy="110" rx="18" ry="4" fill="#000" opacity=".08"/>
      <path d="M52 12 H68 V19 C88 23 97 40 93 60 C89 82 78 96 74 108 H46 C42 96 31 82 27 60 C23 40 32 23 52 19Z" fill="#8cc7b5" stroke="#3f7f6f" stroke-width="3" stroke-linejoin="round"/>
      <ellipse cx="60" cy="12" rx="9" ry="3" fill="#6fb09d" stroke="#3f7f6f" stroke-width="2"/>
      <g fill="none" stroke="#fff" stroke-width="2">
        <circle cx="45" cy="52" r="10"/><circle cx="76" cy="66" r="10"/>
      </g>
      <g fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round">
        <path d="M40 54 L45 49 L50 54 M45 49 L45 46"/>
        <path d="M71 68 L76 63 L81 68 M76 63 L76 60"/>
        <path d="M64 40 c3 -4 7 -4 9 0 c2 -3 6 -2 6 1"/>
        <path d="M40 80 c3 -4 7 -4 9 0 c2 -3 6 -2 6 1"/>
      </g>
      <g fill="#7a3b2e"><circle cx="45" cy="51" r="1.2"/><circle cx="76" cy="65" r="1.2"/></g>`),

    tripitaka: svg(`
      <ellipse cx="60" cy="102" rx="46" ry="5" fill="#000" opacity=".08"/>
      <rect x="16" y="30" width="88" height="62" rx="3" fill="#b07d4f" stroke="#5d4037" stroke-width="3"/>
      <rect x="8" y="26" width="11" height="70" rx="3" fill="#6d4c41" stroke="#3e2723" stroke-width="2"/>
      <rect x="101" y="26" width="11" height="70" rx="3" fill="#6d4c41" stroke="#3e2723" stroke-width="2"/>
      <g fill="#4e342e" opacity=".8">${blockChars}</g>
      <path d="M22 36 H98" stroke="#d9a877" stroke-width="2" opacity=".6"/>`),

    hunminjeongeum: svg(`
      <path d="M60 28 C46 20 26 20 10 24 V96 C26 92 46 92 60 100Z" fill="#fff8e1" stroke="#8d6e63" stroke-width="3" stroke-linejoin="round"/>
      <path d="M60 28 C74 20 94 20 110 24 V96 C94 92 74 92 60 100Z" fill="#fffdf4" stroke="#8d6e63" stroke-width="3" stroke-linejoin="round"/>
      <line x1="60" y1="28" x2="60" y2="100" stroke="#8d6e63" stroke-width="2"/>
      <g font-family="Jua, 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif" text-anchor="middle" fill="#3a2e27">
        <text x="35" y="56" font-size="20">ㄱ ㄴ</text>
        <text x="35" y="82" font-size="20">ㄷ ㄹ</text>
        <text x="85" y="56" font-size="20">ㅏ ㅑ</text>
        <text x="85" y="82" font-size="20">ㅓ ㅕ</text>
      </g>
      <rect x="40" y="6" width="40" height="14" rx="4" fill="#e04848"/>
      <text x="60" y="17" font-size="10" text-anchor="middle" fill="#fff" font-family="Jua, sans-serif">훈민정음</text>`),

    geobukseon: svg(`
      <path d="M4 98 q8 -6 16 0 t16 0 t16 0 t16 0 t16 0 t16 0 t16 0" fill="none" stroke="#2f6fd0" stroke-width="3" stroke-linecap="round"/>
      <g stroke="#5d4037" stroke-width="2.5" stroke-linecap="round">
        ${range(6).map(i => `<line x1="${32 + i * 11}" y1="84" x2="${26 + i * 11}" y2="97"/>`).join('')}
      </g>
      <path d="M12 70 H106 L96 88 H22Z" fill="#8d5a3b" stroke="#4e342e" stroke-width="3" stroke-linejoin="round"/>
      <path d="M22 70 C30 40 90 40 98 70Z" fill="#6d8b5a" stroke="#3e5232" stroke-width="3" stroke-linejoin="round"/>
      <g fill="none" stroke="#3e5232" stroke-width="1.5" opacity=".7">
        <path d="M40 66 l6 -8 h10 l6 8 M58 58 l6 -8 h10 l6 8"/>
      </g>
      <g fill="#cfd8dc" stroke="#455a64" stroke-width="1">${spikes}</g>
      <path d="M96 66 C100 52 112 50 116 57 L109 62 L115 66 L100 72Z" fill="#c0392b" stroke="#7b1f16" stroke-width="2" stroke-linejoin="round"/>
      <circle cx="108" cy="56" r="1.8" fill="#fff"/>
      <path d="M14 70 L8 54 L18 64" fill="#c0392b" stroke="#7b1f16" stroke-width="2" stroke-linejoin="round"/>`),

    taegukgi: svg(`
      <rect x="1" y="21" width="118" height="78" fill="#fff" stroke="#d6d0c4" stroke-width="2"/>
      <g transform="translate(60 60)">
        <circle r="20" fill="#0047a0"/>
        <path d="M-16.64 -11.09 A20 20 0 0 1 16.64 11.09 A10 10 0 0 0 0 0 A10 10 0 0 1 -16.64 -11.09Z" fill="#cd2e3a"/>
        <g fill="#000">
          <g transform="rotate(-56.31)">${trigram(D, [false, false, false])}<g transform="rotate(180)">${trigram(D, [true, true, true])}</g></g>
          <g transform="rotate(56.31)">${trigram(D, [true, false, true])}<g transform="rotate(180)">${trigram(D, [false, true, false])}</g></g>
        </g>
      </g>`),

    dongnimmun: svg(`
      <rect x="6" y="106" width="108" height="6" rx="3" fill="#c5b9a5"/>
      <rect x="22" y="34" width="76" height="72" fill="#e6e1d6" stroke="#7d756a" stroke-width="3"/>
      <g stroke="#b9b1a3" stroke-width="1.2">
        ${range(8).map(i => `<line x1="22" y1="${42 + i * 8}" x2="98" y2="${42 + i * 8}"/>`).join('')}
      </g>
      <path d="M44 106 V72 A16 16 0 0 1 76 72 V106Z" fill="#5d554a" stroke="#7d756a" stroke-width="3"/>
      <rect x="16" y="24" width="88" height="11" rx="1.5" fill="#d3ccbe" stroke="#7d756a" stroke-width="3"/>
      <rect x="40" y="16" width="40" height="9" fill="#d3ccbe" stroke="#7d756a" stroke-width="2.5"/>
      <rect x="44" y="40" width="32" height="12" fill="#fff" stroke="#7d756a" stroke-width="2"/>
      <text x="60" y="49.5" font-size="8.5" text-anchor="middle" fill="#3a2e27" font-family="Jua, 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif">독립문</text>`),

    // ---------- 세계사 ----------
    pyramid: svg(`
      <circle cx="96" cy="24" r="11" fill="#f7b733"/>
      <rect x="2" y="96" width="116" height="16" rx="5" fill="#ecd29b"/>
      <path d="M10 99 L52 30 L94 99Z" fill="#e3b866" stroke="#8a6420" stroke-width="3" stroke-linejoin="round"/>
      <path d="M52 30 L94 99 H70Z" fill="#c9973f"/>
      <g stroke="#8a6420" stroke-width="1.4" opacity=".55">${pyramidCourses}</g>
      <path d="M72 99 L94 64 L116 99Z" fill="#e3b866" stroke="#8a6420" stroke-width="3" stroke-linejoin="round"/>
      <path d="M94 64 L116 99 H104Z" fill="#c9973f"/>`),

    greatwall: svg(`
      <path d="M0 74 L20 46 L40 66 L62 34 L86 62 L104 40 L120 56 V120 H0Z" fill="#b7d39c"/>
      <path d="M0 96 Q30 70 60 88 T120 78 V120 H0Z" fill="#8bc34a"/>
      <path d="M-4 90 L24 74 L46 82 L72 60 L98 70 L124 54" fill="none" stroke="#7d6a4f" stroke-width="16" stroke-linejoin="round"/>
      <path d="M-4 90 L24 74 L46 82 L72 60 L98 70 L124 54" fill="none" stroke="#d6c3a0" stroke-width="11" stroke-linejoin="round"/>
      <path d="M-4 82 L24 66 L46 74 L72 52 L98 62 L124 46" fill="none" stroke="#7d6a4f" stroke-width="5" stroke-dasharray="3.5 3"/>
      <g fill="#d6c3a0" stroke="#7d6a4f" stroke-width="2.5">
        <rect x="16" y="52" width="16" height="26"/><rect x="64" y="38" width="16" height="26"/>
      </g>
      <g fill="#7d6a4f">
        <rect x="15" y="47" width="4" height="6"/><rect x="22" y="47" width="4" height="6"/><rect x="29" y="47" width="4" height="6"/>
        <rect x="63" y="33" width="4" height="6"/><rect x="70" y="33" width="4" height="6"/><rect x="77" y="33" width="4" height="6"/>
        <rect x="21" y="60" width="6" height="8" rx="3"/><rect x="69" y="46" width="6" height="8" rx="3"/>
      </g>`),

    castle: svg(`
      <rect x="4" y="104" width="112" height="9" rx="4.5" fill="#6fa8dc"/>
      <rect x="24" y="56" width="72" height="50" fill="#cfc6b8" stroke="#6d6458" stroke-width="3"/>
      <g fill="#cfc6b8" stroke="#6d6458" stroke-width="2.5">${range(6).map(i => `<rect x="${27 + i * 12}" y="48" width="7" height="9"/>`).join('')}</g>
      <rect x="47" y="30" width="26" height="30" fill="#dcd4c7" stroke="#6d6458" stroke-width="3"/>
      <path d="M43 32 L60 8 L77 32Z" fill="#2f6fd0" stroke="#1f4a8a" stroke-width="2.5" stroke-linejoin="round"/>
      <g fill="#dcd4c7" stroke="#6d6458" stroke-width="3">
        <rect x="8" y="40" width="22" height="66"/><rect x="90" y="40" width="22" height="66"/>
      </g>
      <g fill="#c0392b" stroke="#7b1f16" stroke-width="2.5" stroke-linejoin="round">
        <path d="M5 42 L19 14 L33 42Z"/><path d="M87 42 L101 14 L115 42Z"/>
      </g>
      <g stroke="#4e342e" stroke-width="2"><line x1="19" y1="14" x2="19" y2="4"/><line x1="101" y1="14" x2="101" y2="4"/></g>
      <g fill="#f7b733"><path d="M19 4 L29 7 L19 10Z"/><path d="M101 4 L111 7 L101 10Z"/></g>
      <g fill="#4e342e">
        <rect x="16" y="58" width="6" height="10" rx="3"/><rect x="98" y="58" width="6" height="10" rx="3"/>
        <rect x="57" y="40" width="6" height="10" rx="3"/>
      </g>
      <path d="M48 106 V86 A12 12 0 0 1 72 86 V106Z" fill="#5d4037" stroke="#3e2723" stroke-width="2"/>
      <g stroke="#a1887f" stroke-width="1.5">
        <line x1="54" y1="80" x2="54" y2="106"/><line x1="60" y1="76" x2="60" y2="106"/><line x1="66" y1="80" x2="66" y2="106"/>
        <line x1="48" y1="92" x2="72" y2="92"/><line x1="48" y1="99" x2="72" y2="99"/>
      </g>`),

    olmec: svg(`
      <ellipse cx="60" cy="112" rx="36" ry="5" fill="#000" opacity=".08"/>
      <circle cx="24" cy="78" r="7" fill="#a39d8c" stroke="#55503f" stroke-width="2.5"/>
      <circle cx="96" cy="78" r="7" fill="#a39d8c" stroke="#55503f" stroke-width="2.5"/>
      <path d="M27 56 C27 30 93 30 93 56 V92 C93 104 82 111 60 111 C38 111 27 104 27 92Z" fill="#938d7e" stroke="#55503f" stroke-width="3"/>
      <path d="M21 60 C18 20 102 20 99 60 C80 51 40 51 21 60Z" fill="#a8a291" stroke="#55503f" stroke-width="3" stroke-linejoin="round"/>
      <path d="M26 48 C44 40 76 40 94 48" fill="none" stroke="#55503f" stroke-width="2"/>
      <path d="M36 66 Q46 61 55 66 M65 66 Q74 61 84 66" fill="none" stroke="#55503f" stroke-width="2.5" stroke-linecap="round"/>
      <ellipse cx="46" cy="72" rx="7" ry="3" fill="#55503f"/>
      <ellipse cx="74" cy="72" rx="7" ry="3" fill="#55503f"/>
      <path d="M56 70 L50 88 Q60 95 70 88 L64 70" fill="#9c9686" stroke="#55503f" stroke-width="2.5" stroke-linejoin="round"/>
      <path d="M45 99 Q60 92 75 99 Q60 107 45 99Z" fill="#7d7769" stroke="#55503f" stroke-width="2.5" stroke-linejoin="round"/>`),

    mayapyramid: svg(`
      <circle cx="18" cy="96" r="12" fill="#558b2f"/><circle cx="104" cy="94" r="13" fill="#558b2f"/>
      <rect x="0" y="100" width="120" height="14" fill="#7cb342"/>
      <g fill="#cdb88f" stroke="#7d6a4f" stroke-width="2">${mayaTiers}</g>
      <path d="M52 100 L54 40 H66 L68 100Z" fill="#b6a077" stroke="#7d6a4f" stroke-width="2" stroke-linejoin="round"/>
      <g stroke="#7d6a4f" stroke-width="1.2" opacity=".7">${range(10).map(i => `<line x1="${53.5 - i * 0.2}" y1="${46 + i * 6}" x2="${66.5 + i * 0.2}" y2="${46 + i * 6}"/>`).join('')}</g>
      <rect x="45" y="22" width="30" height="18" fill="#cdb88f" stroke="#7d6a4f" stroke-width="2.5"/>
      <rect x="50" y="14" width="20" height="8" fill="#bfa97f" stroke="#7d6a4f" stroke-width="2"/>
      <rect x="56" y="29" width="8" height="11" fill="#5d4037"/>`),

    aksum: svg(`
      <rect x="28" y="104" width="64" height="9" rx="2" fill="#a1887f"/>
      <path d="M43 104 V24 Q60 6 77 24 V104Z" fill="#bcae9f" stroke="#6d5f53" stroke-width="3" stroke-linejoin="round"/>
      <g stroke="#6d5f53" stroke-width="1.5">${range(6).map(i => `<line x1="43" y1="${33 + i * 11}" x2="77" y2="${33 + i * 11}"/>`).join('')}</g>
      <g fill="#6d5f53">${range(5).map(i => `<rect x="49" y="${36 + i * 11}" width="8" height="6" rx="1"/><rect x="63" y="${36 + i * 11}" width="8" height="6" rx="1"/>`).join('')}</g>
      <rect x="54" y="91" width="12" height="13" fill="#6d5f53"/>
      <path d="M50 18 Q60 11 70 18" fill="none" stroke="#fff" stroke-width="2" opacity=".5" stroke-linecap="round"/>`),
  };
})();
