/*
 * 범이의 역사 탐험대 — 나라별 세계사: 지역 목록과 공통 배열
 * 나라 데이터는 js/nations-*.js 파일이 NATIONS, 사진은 NATION_IMAGES에 넣어요.
 * 화면은 js/nations-view.js가 그려요.
 */

const NATION_REGIONS = [
  { id: 'asia', name: '동아시아', emoji: '🏯', color: '#c8452e', desc: '우리나라와 가장 가까운 이웃, 중국·일본·몽골' },
  { id: 'europe', name: '유럽', emoji: '🏰', color: '#3f6db3', desc: '민주 정치와 로마법, 산업 혁명이 태어난 곳' },
  { id: 'americas', name: '아메리카', emoji: '🗽', color: '#2a9a63', desc: '마야·아즈텍·잉카와 새로 태어난 나라 미국' },
  { id: 'mea', name: '중동·아프리카·인도', emoji: '🐪', color: '#b5832a', desc: '인류 최초의 문명과 거대한 제국들의 고향' },
];

// 지역 안에서 보여 줄 나라 순서
const NATION_ORDER = ['china', 'japan', 'mongolia', 'greece', 'italy', 'uk', 'france', 'germany', 'russia', 'usa', 'mexico', 'peru', 'egypt', 'iraq', 'india', 'turkey'];

const NATIONS = [];
const NATION_IMAGES = [];
