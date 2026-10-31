/*
 * 범이의 역사 탐험대 — 한국사능력검정시험 심화(1~3급) 대비 데이터
 * 개념 노트는 개조식으로, 문제는 기출 유형을 참고해 새로 만든 연습 문제입니다.
 * 문제의 o(보기)는 [보기, 해설] 쌍이며 첫 번째가 정답입니다. 화면에서는 문제마다 정해진 순서로 섞어 보여 줍니다.
 * 노트의 **굵게** 표시는 화면에서 강조로 바뀝니다.
 */

const EXAM_INFO = {
  name: '한국사능력검정시험 심화',
  count: 50,
  minutes: 80,
  point: 2,
  grades: [[80, '1급'], [70, '2급'], [60, '3급']],
  // 모의고사 단원별 출제 문항 수 (합계 50)
  weights: { pre: 3, three: 5, nambuk: 4, goryeo: 7, joseon1: 6, joseon2: 7, modern: 7, japan: 5, korea: 4, topic: 2 },
};

const EXAM_UNITS = [];
const EXAM_QUESTIONS = [];
// 개념 노트 보강(흐름 이야기·시험 포인트·용어·사료·사진): 단원 id → { sections, tables, sources }
const EXAM_PLUS = {};
// 노트 사진과 출처: js/exam-images.js에서 채워요
const EXAM_IMAGES = [];
// 역사 사전: 개념 노트의 굵은 낱말을 누르면 열리는 상세 설명 (js/exam-dict*.js에서 채워요)
// { id, term, unit, kind, when, aliases:[], summary, story, points:[], related:[], img:[], glossary?:[] }
// aliases: 노트의 다른 표기(띄어쓰기·괄호 속 덧붙임은 자동 무시) / glossary: 용어 풀이에서 같은 이름의 다른 개념을 이 항목으로 이을 때
const EXAM_DICT = [];
