/*
  howto.js
  ------------------------------------------------------
  「あそびかた」ページを、1セクションずつ表示するための
  ごく小さなスクリプトです。ゲーム本体(game.js)とは
  関係がありません。
------------------------------------------------------ */
(function () {
  const slides = document.querySelectorAll('.howto-slide');
  const prevBtn = document.getElementById('howto-prev');
  const nextBtn = document.getElementById('howto-next');
  const finishBtn = document.getElementById('howto-finish');
  const progressEl = document.getElementById('howto-progress');

  let current = 0;

  function render() {
    slides.forEach((s, i) => s.classList.toggle('active', i === current));
    progressEl.textContent = (current + 1) + ' / ' + slides.length;

    prevBtn.classList.toggle('hidden', current === 0);

    const isLast = current === slides.length - 1;
    nextBtn.classList.toggle('hidden', isLast);
    finishBtn.classList.toggle('hidden', !isLast);

    window.scrollTo(0, 0);
  }

  prevBtn.addEventListener('click', () => {
    if (current > 0) { current--; render(); }
  });
  nextBtn.addEventListener('click', () => {
    if (current < slides.length - 1) { current++; render(); }
  });

  render();
})();
