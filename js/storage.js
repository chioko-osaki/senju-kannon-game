/*
  storage.js
  ------------------------------------------------------
  スコアの「保存」「読み込み」だけを担当するファイルです。
  ブラウザの localStorage という仕組みを使っていて、
  サーバーは使いません(このブラウザ・この端末の中だけに保存されます)。

  他のファイルからは、以下の3つの関数だけを呼び出して使います:
    - loadScores()          … 保存されているスコア一覧を取得
    - saveScore(name, score) … 新しいスコアを1件保存
    - clearScores()          … 保存されているスコアを全部消す
------------------------------------------------------ */

const SCORE_STORAGE_KEY = 'senjuKannonHands.scores.v1';
const MAX_SAVED_SCORES = 20; // 保存しておく件数の上限(増やしたい場合はここを変更)

function loadScores() {
  try {
    const raw = localStorage.getItem(SCORE_STORAGE_KEY);
    const list = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(list)) return [];
    return list;
  } catch (e) {
    console.warn('スコアの読み込みに失敗しました。', e);
    return [];
  }
}

function saveScore(name, score) {
  const safeName = (name || '').trim().slice(0, 10) || 'なまえなし';
  const entry = {
    name: safeName,
    score: Number(score) || 0,
    date: new Date().toISOString()
  };

  const list = loadScores();
  list.push(entry);
  list.sort((a, b) => b.score - a.score);
  const trimmed = list.slice(0, MAX_SAVED_SCORES);

  try {
    localStorage.setItem(SCORE_STORAGE_KEY, JSON.stringify(trimmed));
  } catch (e) {
    console.warn('スコアの保存に失敗しました。', e);
  }
  return trimmed;
}

function clearScores() {
  try {
    localStorage.removeItem(SCORE_STORAGE_KEY);
  } catch (e) {
    console.warn('スコアの削除に失敗しました。', e);
  }
}
