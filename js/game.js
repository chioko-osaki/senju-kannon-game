/*
  game.js
  ------------------------------------------------------
  ゲームの動き(手の操作、落下物、当たり判定、タイマーなど)を
  まとめたファイルです。

  数値のバランス(制限時間や出現率など)は、このファイルではなく
  data/config.json に書かれています。バランス調整だけしたい場合は
  そちらを編集してください。
------------------------------------------------------ */

(function () {
  // config.json が読み込めなかったとき用の、既定値(バックアップ)。
  // data/config.json と同じ内容にしてあります。
  const DEFAULT_CONFIG = {
    gameSeconds: 42,
    spawnIntervalMs: 650,
    fallSpeedPxPerSec: 150,
    catchRadiusPx: 46,
    devilChance: 0.25,
    lotusChance: 0.03,
    numbMs: 1000,
    lotusBonus: 10
  };

  // ここに config.json の内容を上書きしていく(中身を書き換えるだけで、
  // 参照先は変えない=どのタイミングで読んでも最新の値が見える)
  const GAME_CONFIG = Object.assign({}, DEFAULT_CONFIG);

  fetch('data/config.json')
    .then((res) => {
      if (!res.ok) throw new Error('config.json の応答が正常ではありません');
      return res.json();
    })
    .then((json) => {
      Object.assign(GAME_CONFIG, json);
    })
    .catch((err) => {
      console.warn(
        'data/config.json を読み込めなかったので、既定値を使用します。' +
        '(パソコンでファイルを直接開いた場合によく起こります。GitHub Pages 等の' +
        'サーバー経由で開くと解決します)',
        err
      );
    });

  // ---- 音声 ----
  const sounds = {
    catch: new Audio('sounds/catch.mp3'),
    devil: new Audio('sounds/devil.mp3'),
    lotus: new Audio('sounds/lotus.mp3'),
    bgm: new Audio('sounds/bgm.mp3')
  };
  sounds.bgm.loop = true;
  sounds.bgm.volume = 0.5;

  function playSound(key) {
    const a = sounds[key];
    if (!a) return;
    try {
      a.currentTime = 0;
      a.play().catch(() => {}); // 自動再生がブロックされても無視する
    } catch (e) {
      /* 再生できない環境でもゲームは続行する */
    }
  }

  function startBgm() {
    try {
      sounds.bgm.currentTime = 0;
      sounds.bgm.play().catch(() => {});
    } catch (e) { /* 何もしない */ }
  }

  function stopBgm() {
    try {
      sounds.bgm.pause();
      sounds.bgm.currentTime = 0;
    } catch (e) { /* 何もしない */ }
  }

  // ---- DOM要素の取得 ----
  const app = document.getElementById('app');
  const stage = document.getElementById('stage');
  const handLeftEl = document.getElementById('hand-left');
  const handRightEl = document.getElementById('hand-right');

  const hudEl = document.getElementById('hud');
  const demoHudEl = document.getElementById('demo-hud');
  const scoreDisplayEl = document.getElementById('score-display');
  const timerEl = document.getElementById('timer');
  const scoreEl = document.getElementById('score');

  const startScreen = document.getElementById('start-screen');
  const endScreen = document.getElementById('end-screen');
  const scoreScreen = document.getElementById('score-screen');

  const startBtn = document.getElementById('start-btn');
  const demoBtn = document.getElementById('demo-btn');
  const scoreBtn = document.getElementById('score-btn');
  const retryBtn = document.getElementById('retry-btn');
  const abortBtn = document.getElementById('abort-btn');
  const demoExitBtn = document.getElementById('demo-exit-btn');
  const scoreCloseBtn = document.getElementById('score-close-btn');
  const clearScoresBtn = document.getElementById('clear-scores-btn');

  const finalScoreEl = document.getElementById('final-score');
  const nameInput = document.getElementById('name-input');
  const saveScoreBtn = document.getElementById('save-score-btn');
  const saveNoteEl = document.getElementById('save-note');
  const scoreListEl = document.getElementById('score-list');
  const scoreEmptyEl = document.getElementById('score-empty');

  // ---- 状態 ----
  let stageW = 0, stageH = 0;
  let handLeftX = 0, handRightX = 0;
  let handY = 0;
  let score = 0;
  let timeLeft = 0;
  let running = false;
  let isDemo = false;
  let targets = [];
  let targetIdSeq = 0;
  let numbUntil = { left: 0, right: 0 };
  let spawnTimer = null;
  let countdownTimer = null;
  let rafId = null;
  let lastFrameTime = 0;
  let hasSavedThisRound = false;

  function measure() {
    const rect = app.getBoundingClientRect();
    stageW = rect.width;
    stageH = rect.height;
    handY = stageH * 0.92; // CSSの bottom:8% に合わせている
    handLeftX = stageW * 0.25;
    handRightX = stageW * 0.75;
    updateHandPositions();
  }
  window.addEventListener('resize', measure);

  function updateHandPositions() {
    handLeftEl.style.left = handLeftX + 'px';
    handRightEl.style.left = handRightX + 'px';
  }

  function clamp(v, min, max) { return Math.min(max, Math.max(min, v)); }

  // ---- 入力(左半分/右半分それぞれの中だけで手を動かす) ----
  function handlePointer(clientX) {
    const rect = app.getBoundingClientRect();
    const x = clientX - rect.left;
    const now = performance.now();
    if (x < stageW / 2) {
      if (now < numbUntil.left) return;
      handLeftX = clamp(x, 24, stageW / 2 - 12);
    } else {
      if (now < numbUntil.right) return;
      handRightX = clamp(x, stageW / 2 + 12, stageW - 24);
    }
    updateHandPositions();
  }

  app.addEventListener('touchstart', onTouch, { passive: true });
  app.addEventListener('touchmove', onTouch, { passive: true });
  function onTouch(e) {
    for (const t of e.touches) handlePointer(t.clientX);
  }
  app.addEventListener('mousedown', (e) => handlePointer(e.clientX));
  app.addEventListener('mousemove', (e) => {
    if (e.buttons === 1) handlePointer(e.clientX);
  });

  function applyNumb(side) {
    const now = performance.now();
    numbUntil[side] = now + GAME_CONFIG.numbMs;
    const el = side === 'left' ? handLeftEl : handRightEl;
    el.classList.add('numb');
    setTimeout(() => {
      if (performance.now() >= numbUntil[side]) el.classList.remove('numb');
    }, GAME_CONFIG.numbMs);
  }

  function pulseHand(el) {
    el.classList.remove('catch-pulse');
    void el.offsetWidth; // アニメーションを最初から再生させるためのおまじない
    el.classList.add('catch-pulse');
  }

  // ---- 落下物 ----
  function spawnTarget() {
    const margin = 30;
    const x = margin + Math.random() * (stageW - margin * 2);
    const r = Math.random();
    let type, glyph, extraClass;
    if (r < GAME_CONFIG.lotusChance) {
      type = 'lotus'; glyph = '🪷'; extraClass = ' target-lotus';
    } else if (r < GAME_CONFIG.lotusChance + GAME_CONFIG.devilChance) {
      type = 'devil'; glyph = '😈'; extraClass = ' target-devil';
    } else {
      type = 'sad'; glyph = '🥺'; extraClass = '';
    }
    const el = document.createElement('div');
    el.className = 'target' + extraClass;
    el.textContent = glyph;
    el.style.left = x + 'px';
    el.style.top = '-30px';
    stage.appendChild(el);
    const id = ++targetIdSeq;
    targets.push({ el, x, y: -30, id, caught: false, type });
  }

  function removeTarget(t) {
    if (t.el && t.el.parentNode) t.el.parentNode.removeChild(t.el);
    targets = targets.filter((o) => o.id !== t.id);
  }

  function tryCatch(t) {
    const isLeftSide = t.x < stageW / 2;
    const side = isLeftSide ? 'left' : 'right';
    const handX = isLeftSide ? handLeftX : handRightX;
    const handEl = isLeftSide ? handLeftEl : handRightEl;
    const now = performance.now();
    if (now < numbUntil[side]) return false; // しびれている手には触れられない

    const dx = Math.abs(t.x - handX);
    const dy = Math.abs(t.y - handY);
    if (dx < GAME_CONFIG.catchRadiusPx && dy < GAME_CONFIG.catchRadiusPx) {
      t.caught = true;
      if (t.type === 'devil') {
        applyNumb(side);
        t.el.classList.add('hit-devil');
        playSound('devil');
      } else if (t.type === 'lotus') {
        if (!isDemo) {
          score += GAME_CONFIG.lotusBonus;
          scoreEl.textContent = score;
        }
        t.el.classList.add('caught-lotus');
        pulseHand(handEl);
        playSound('lotus');
      } else {
        if (!isDemo) {
          score++;
          scoreEl.textContent = score;
        }
        t.el.textContent = '😄';
        t.el.classList.add('caught');
        pulseHand(handEl);
        playSound('catch');
      }
      setTimeout(() => removeTarget(t), 300);
      return true;
    }
    return false;
  }

  function frame(now) {
    if (!running) return;
    if (!lastFrameTime) lastFrameTime = now;
    const dt = (now - lastFrameTime) / 1000;
    lastFrameTime = now;

    for (const t of targets.slice()) {
      if (t.caught) continue;
      t.y += GAME_CONFIG.fallSpeedPxPerSec * dt;
      t.el.style.top = t.y + 'px';
      if (!tryCatch(t)) {
        if (t.y > stageH + 40) removeTarget(t); // スルーしたら消えるだけ(ペナルティなし)
      }
    }
    rafId = requestAnimationFrame(frame);
  }

  // ---- 画面の切り替え ----
  function showOnly(el) {
    [startScreen, endScreen, scoreScreen].forEach((s) => s.classList.add('hidden'));
    if (el) el.classList.remove('hidden');
  }

  function startGame(demo) {
    isDemo = !!demo;
    score = 0;
    timeLeft = GAME_CONFIG.gameSeconds;
    numbUntil = { left: 0, right: 0 };
    handLeftEl.classList.remove('numb');
    handRightEl.classList.remove('numb');
    scoreEl.textContent = '0';
    timerEl.textContent = String(GAME_CONFIG.gameSeconds);
    timerEl.classList.remove('timer-urgent');
    targets.forEach(removeTarget);
    targets = [];
    hasSavedThisRound = false;
    measure();

    showOnly(null);

    if (isDemo) {
      hudEl.classList.add('hidden');
      scoreDisplayEl.classList.add('hidden');
      demoHudEl.classList.remove('hidden');
    } else {
      hudEl.classList.remove('hidden');
      scoreDisplayEl.classList.remove('hidden');
      demoHudEl.classList.add('hidden');
    }

    running = true;
    lastFrameTime = 0;
    startBgm();

    spawnTimer = setInterval(spawnTarget, GAME_CONFIG.spawnIntervalMs);
    if (!isDemo) {
      countdownTimer = setInterval(() => {
        timeLeft--;
        timerEl.textContent = String(Math.max(0, timeLeft));
        timerEl.classList.toggle('timer-urgent', timeLeft <= 10 && timeLeft > 0);
        if (timeLeft <= 0) endGame();
      }, 1000);
    }
    rafId = requestAnimationFrame(frame);
  }

  function stopTimers() {
    running = false;
    clearInterval(spawnTimer);
    clearInterval(countdownTimer);
    if (rafId) cancelAnimationFrame(rafId);
  }

  function endGame() {
    stopTimers();
    stopBgm();
    hudEl.classList.add('hidden');
    scoreDisplayEl.classList.add('hidden');
    finalScoreEl.textContent = String(score);
    nameInput.value = '';
    saveNoteEl.classList.add('hidden');
    saveScoreBtn.disabled = false;
    showOnly(endScreen);
  }

  function goToStart() {
    stopTimers();
    stopBgm();
    targets.forEach(removeTarget);
    targets = [];
    numbUntil = { left: 0, right: 0 };
    handLeftEl.classList.remove('numb');
    handRightEl.classList.remove('numb');
    score = 0;
    isDemo = false;
    scoreEl.textContent = '0';
    timerEl.textContent = String(GAME_CONFIG.gameSeconds);
    timerEl.classList.remove('timer-urgent');
    hudEl.classList.add('hidden');
    demoHudEl.classList.add('hidden');
    scoreDisplayEl.classList.add('hidden');
    showOnly(startScreen);
  }

  // ---- スコア確認画面 ----
  function renderScoreList() {
    const list = loadScores(); // storage.js の関数
    scoreListEl.innerHTML = '';
    if (list.length === 0) {
      scoreEmptyEl.classList.remove('hidden');
      scoreListEl.classList.add('hidden');
      return;
    }
    scoreEmptyEl.classList.add('hidden');
    scoreListEl.classList.remove('hidden');
    list.forEach((entry, i) => {
      const li = document.createElement('li');
      li.innerHTML =
        '<span class="rank">' + (i + 1) + '</span>' +
        '<span class="name"></span>' +
        '<span class="num">' + entry.score + '人</span>';
      li.querySelector('.name').textContent = entry.name; // XSS対策のためtextContentで代入
      scoreListEl.appendChild(li);
    });
  }

  function openScoreScreen() {
    renderScoreList();
    showOnly(scoreScreen);
  }

  // ---- ボタンのイベント登録 ----
  startBtn.addEventListener('click', () => startGame(false));
  demoBtn.addEventListener('click', () => startGame(true));
  scoreBtn.addEventListener('click', openScoreScreen);
  retryBtn.addEventListener('click', goToStart);
  abortBtn.addEventListener('click', goToStart);
  demoExitBtn.addEventListener('click', goToStart);
  scoreCloseBtn.addEventListener('click', goToStart);

  if (clearScoresBtn) {
    clearScoresBtn.addEventListener('click', () => {
      if (confirm('保存されているスコアを全部消します。よろしいですか?')) {
        clearScores(); // storage.js の関数
        renderScoreList();
      }
    });
  }

  saveScoreBtn.addEventListener('click', () => {
    if (hasSavedThisRound) return;
    saveScore(nameInput.value, score); // storage.js の関数
    hasSavedThisRound = true;
    saveScoreBtn.disabled = true;
    saveNoteEl.textContent = '保存しました!';
    saveNoteEl.classList.remove('hidden');
  });

  measure();
})();
