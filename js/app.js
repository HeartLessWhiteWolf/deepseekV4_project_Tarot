'use strict';

/* ========================================
   Tarot Divination - Main Application Logic
   Dependencies: SoundEngine, MAJOR_ARCANA, DeepSeekAPI
   Load after: sound-engine.js, tarot-data.js, deepseek-api.js
   ======================================== */

var AppState = {
  theme: '',
  drawnCards: [],
  flippedCards: null,
  isDrawing: false
};

var DOM = {};

function initDOMRefs() {
  DOM.themeInput = document.getElementById('theme-input');
  DOM.charCount = document.getElementById('char-count');
  DOM.startBtn = document.getElementById('start-btn');
  DOM.deckContainer = document.getElementById('deck-container');
  DOM.deckStack = document.getElementById('deck-stack');
  DOM.deckHint = document.getElementById('deck-hint');
  DOM.resultSection = document.getElementById('result-section');
  DOM.interpretationSection = document.getElementById('interpretation-section');
  DOM.interpretationGrid = document.getElementById('interpretation-grid');
  DOM.overallText = document.getElementById('overall-text');
  DOM.resetBtn = document.getElementById('reset-btn');
  DOM.soundToggle = document.getElementById('sound-toggle');
  DOM.drawOverlay = document.getElementById('draw-overlay');
  DOM.particles = document.getElementById('particles');
}

/* ========================================
   Particle System
   ======================================== */
function createParticles() {
  var container = DOM.particles;
  container.innerHTML = '';
  for (var i = 0; i < 25; i++) {
    var p = document.createElement('div');
    p.className = 'particle';
    p.style.left = Math.random() * 100 + '%';
    p.style.animationDuration = (8 + Math.random() * 15) + 's';
    p.style.animationDelay = Math.random() * 10 + 's';
    p.style.width = (2 + Math.random() * 3) + 'px';
    p.style.height = p.style.width;
    container.appendChild(p);
  }
}

/* ========================================
   Shuffle Animation
   ======================================== */
function animateShuffle(callback) {
  var stack = DOM.deckStack;
  stack.classList.add('shuffling');
  SoundEngine.shuffleSound();

  function onEnd() {
    stack.removeEventListener('animationend', onEnd);
    stack.classList.remove('shuffling');
    if (callback) callback();
  }
  stack.addEventListener('animationend', onEnd, { once: true });

  setTimeout(function() {
    if (stack.classList.contains('shuffling')) {
      stack.classList.remove('shuffling');
      if (callback) callback();
    }
  }, 900);
}

/* ========================================
   Draw Cards
   ======================================== */
function drawThreeCards() {
  var deck = MAJOR_ARCANA.slice();
  for (var i = deck.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var tmp = deck[i];
    deck[i] = deck[j];
    deck[j] = tmp;
  }
  return [
    { card: deck[0], position: 'past' },
    { card: deck[1], position: 'present' },
    { card: deck[2], position: 'future' }
  ];
}

/* ========================================
   Draw Sparkle Overlay
   ======================================== */
function showDrawEffect(callback) {
  var overlay = DOM.drawOverlay;
  overlay.classList.add('active');
  SoundEngine.drawSound();

  setTimeout(function() {
    overlay.classList.remove('active');
    if (callback) callback();
  }, 1500);

  var sparkle = overlay.querySelector('.draw-sparkle');
  sparkle.style.animation = 'none';
  sparkle.offsetHeight;
  sparkle.style.animation = '';
}

/* ========================================
   Render Card Face
   ======================================== */
function renderCardFace(faceEl, card) {
  faceEl.innerHTML =
    '<span class="card-number">' + card.number + '</span>' +
    '<span class="card-symbol">' + card.symbol + '</span>' +
    '<span class="card-name-zh">' + card.nameZh + '</span>' +
    '<span class="card-name-en">' + card.nameEn + '</span>';
}

/* ========================================
   Card Flip Logic
   ======================================== */
function setupCardFlip(drawnCardEl, cardData) {
  var faceEl = drawnCardEl.querySelector('.card-face');
  renderCardFace(faceEl, cardData.card);

  var cardBackEl = drawnCardEl.querySelector('.card-face-back');

  function flipHandler(e) {
    if (e) e.preventDefault();
    if (AppState.flippedCards.has(cardData.position)) return;
    drawnCardEl.classList.add('flipped');
    AppState.flippedCards.add(cardData.position);
    SoundEngine.flipSound();

    var hint = drawnCardEl.closest('.card-slot').querySelector('.card-flip-hint');
    if (hint) hint.style.display = 'none';

    if (AppState.flippedCards.size === 3) {
      setTimeout(function() {
        SoundEngine.revealSound();
        showInterpretation();
      }, 600);
    }
  }

  cardBackEl.addEventListener('click', flipHandler);
  cardBackEl.addEventListener('touchend', flipHandler);
}

/* ========================================
   Generate Static Interpretation Text (Fallback)
   ======================================== */
function getStaticInterpretation(cardData, theme) {
  var interpText = '';
  switch(cardData.position) {
    case 'past': interpText = cardData.card.past; break;
    case 'present': interpText = cardData.card.present; break;
    case 'future': interpText = cardData.card.future; break;
    default: interpText = cardData.card.meaning || '';
  }
  if (theme && theme.trim()) {
    interpText += '\n\n<div class="ai-interp ai-loading" data-card="' + cardData.position + '">\u2726 AI正在结合"' + escapeHTML(theme) + '"为您深度解读' + cardData.card.nameZh + '...</div>';
  }
  return interpText;
}

function generateStaticOverall(cards, theme) {
  var past = cards[0], present = cards[1], future = cards[2];
  var readings = [];
  if (theme) {
    readings.push('亲爱的求问者，关于"' + theme + '"的占卜已经完整呈现。');
  } else {
    readings.push('亲爱的求问者，您的三牌占卜已经完整呈现。');
  }
  readings.push('过去的位置出现了「' + past.card.nameZh + '」，' + past.card.past.replace('过去，', '').replace('过去', ''));
  readings.push('现在的位置揭示了「' + present.card.nameZh + '」，' + present.card.present.replace('此刻，', '').replace('此刻', ''));
  readings.push('未来的位置指向「' + future.card.nameZh + '」，' + future.card.future.replace('未来，', '').replace('未来', ''));
  readings.push('<span class="ai-overall-loading">\u2726 AI深度综合分析生成中，请稍候...</span>');
  return readings.join('\n\n');
}

function escapeHTML(str) {
  var div = document.createElement('div');
  div.appendChild(document.createTextNode(str));
  return div.innerHTML;
}

/* ========================================
   Show Interpretation
   ======================================== */
function showInterpretation() {
  var grid = DOM.interpretationGrid;
  grid.innerHTML = '';

  var positions = [
    { key: 'past', label: '过去', cssClass: 'past' },
    { key: 'present', label: '现在', cssClass: 'present' },
    { key: 'future', label: '未来', cssClass: 'future' }
  ];

  AppState.drawnCards.forEach(function(cardData, idx) {
    var pos = positions[idx];
    var interpText = getStaticInterpretation(cardData, AppState.theme);

    var cardEl = document.createElement('div');
    cardEl.className = 'interpretation-card ' + pos.cssClass;
    cardEl.innerHTML =
      '<div class="interp-header">' +
        '<span class="interp-position ' + pos.cssClass + '">' + pos.label + '</span>' +
        '<span class="interp-card-name">' + cardData.card.symbol + ' ' + cardData.card.nameZh + '</span>' +
      '</div>' +
      '<div class="interp-content" id="interp-content-' + pos.key + '">' + interpText.replace(/\n/g, '<br>') + '</div>' +
      '<div class="interp-keywords">' +
        cardData.card.keywords.map(function(k) {
          return '<span class="keyword-tag">' + k + '</span>';
        }).join('') +
      '</div>';
    grid.appendChild(cardEl);
  });

  DOM.overallText.innerHTML = generateStaticOverall(AppState.drawnCards, AppState.theme).replace(/\n/g, '<br>');
  DOM.interpretationSection.classList.add('visible');

  setTimeout(function() {
    DOM.interpretationSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, 300);

  // Fetch AI-enhanced interpretations
  if (AppState.theme && AppState.theme.trim()) {
    fetchAIInterpretations();
  }
}

/* ========================================
   Fetch AI-Enhanced Interpretations
   ======================================== */
function fetchAIInterpretations() {
  var positionNames = { past: '过去', present: '现在', future: '未来' };

  // Fetch per-card theme interpretations in parallel
  AppState.drawnCards.forEach(function(cardData) {
    var posName = positionNames[cardData.position];
    var loadingEl = document.querySelector('.ai-interp.ai-loading[data-card="' + cardData.position + '"]');
    if (!loadingEl) return;

    DeepSeekAPI.generateThemeInterpretation(
      cardData.card.nameZh,
      cardData.card.symbol,
      posName,
      AppState.theme
    ).then(function(aiText) {
      if (loadingEl) {
        loadingEl.classList.remove('ai-loading');
        loadingEl.innerHTML = aiText;
      }
    }).catch(function(err) {
      console.warn('AI interpretation failed for ' + cardData.card.nameZh + ': ' + (err.message || err));
      if (loadingEl) {
        loadingEl.classList.remove('ai-loading');
        loadingEl.classList.add('ai-fallback');
        loadingEl.innerHTML = '结合您"' + escapeHTML(AppState.theme) + '"的主题来看，' + cardData.card.nameZh + '在此位置的出现显得格外意味深长。请细细体会其中蕴藏的启示。';
      }
    });
  });

  // Fetch overall reading
  var overallLoadingEl = document.querySelector('.ai-overall-loading');
  if (overallLoadingEl) {
    DeepSeekAPI.generateOverallReading(AppState.drawnCards, AppState.theme)
      .then(function(aiText) {
        if (overallLoadingEl) {
          overallLoadingEl.classList.remove('ai-overall-loading');
          overallLoadingEl.innerHTML = aiText;
        }
      }).catch(function(err) {
        console.warn('AI overall reading failed: ' + (err.message || err));
        if (overallLoadingEl) {
          overallLoadingEl.classList.remove('ai-overall-loading');
          overallLoadingEl.classList.add('ai-fallback');
          overallLoadingEl.innerHTML = '这三张牌共同编织了一幅命运的图景：从过去的积累与经历，到当下的觉醒与抉择，再到未来的希望与可能——一切都在宇宙的安排之中有序展开。请带着这份来自塔罗的智慧，以平静而坚定的心态面对生活中的每一个篇章。命运之轮永不停歇，而您始终是自己人生的掌舵者。';
        }
      });
  }
}

/* ========================================
   Process Card Draw
   ======================================== */
function processDraw() {
  if (AppState.isDrawing) return;
  AppState.isDrawing = true;

  DOM.deckContainer.style.pointerEvents = 'none';
  DOM.deckHint.textContent = '✦ 命运之牌正在抽取中... ✦';
  DOM.deckHint.style.opacity = '0.8';

  animateShuffle(function() {
    AppState.drawnCards = drawThreeCards();
    AppState.flippedCards.clear();

    showDrawEffect(function() {
      DOM.interpretationSection.classList.remove('visible');
      DOM.interpretationGrid.innerHTML = '';

      var positions = ['past', 'present', 'future'];
      positions.forEach(function(pos) {
        var drawnCardEl = document.querySelector('.drawn-card[data-position="' + pos + '"]');
        if (drawnCardEl) drawnCardEl.classList.remove('flipped');
      });

      DOM.resultSection.classList.add('visible');

      positions.forEach(function(pos) {
        var drawnCardEl = document.querySelector('.drawn-card[data-position="' + pos + '"]');
        if (drawnCardEl) {
          var faceEl = document.getElementById('card-face-' + pos);
          if (faceEl) faceEl.innerHTML = '';
        }
      });

      setTimeout(function() {
        positions.forEach(function(pos) {
          var drawnCardEl = document.querySelector('.drawn-card[data-position="' + pos + '"]');
          var cardData = AppState.drawnCards.find(function(d) { return d.position === pos; });
          if (drawnCardEl && cardData) {
            setupCardFlip(drawnCardEl, cardData);
          }
        });

        var hints = document.querySelectorAll('.card-flip-hint');
        for (var i = 0; i < hints.length; i++) {
          hints[i].style.display = '';
        }

        DOM.resultSection.scrollIntoView({ behavior: 'smooth', block: 'start' });

        DOM.deckContainer.style.pointerEvents = '';
        DOM.deckHint.innerHTML = '✦ 请先输入主题，再点击牌堆抽取 ✦';
        DOM.deckHint.style.opacity = '';
        AppState.isDrawing = false;
      }, 500);
    });
  });
}

/* ========================================
   Reset
   ======================================== */
function resetDivination() {
  AppState.theme = '';
  AppState.drawnCards = [];
  AppState.flippedCards.clear();
  AppState.isDrawing = false;

  DOM.themeInput.value = '';
  DOM.charCount.textContent = '0 / 100';
  DOM.charCount.classList.remove('warning');

  DOM.resultSection.classList.remove('visible');
  DOM.interpretationSection.classList.remove('visible');
  DOM.interpretationGrid.innerHTML = '';
  DOM.overallText.textContent = '';

  DOM.deckContainer.style.pointerEvents = '';
  DOM.deckHint.innerHTML = '✦ 请先输入主题，再点击牌堆抽取 ✦';
  DOM.deckHint.style.opacity = '';

  DOM.startBtn.disabled = true;
  DOM.startBtn.style.opacity = '0.4';

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/* ========================================
   Event Bindings
   ======================================== */
function bindEvents() {
  DOM.themeInput.addEventListener('input', function() {
    var len = this.value.length;
    DOM.charCount.textContent = len + ' / 100';
    if (len > 90) {
      DOM.charCount.classList.add('warning');
    } else {
      DOM.charCount.classList.remove('warning');
    }
    AppState.theme = this.value.trim();
    DOM.startBtn.disabled = len === 0 || len > 100;
    DOM.startBtn.style.opacity = (len === 0 || len > 100) ? '0.4' : '1';
    if (len > 0 && len <= 100) {
      DOM.deckHint.innerHTML = '✦ 点击牌堆，抽取您的命运之牌 ✦';
    } else {
      DOM.deckHint.innerHTML = '✦ 请先输入主题，再点击牌堆抽取 ✦';
    }
  });

  DOM.startBtn.addEventListener('click', function() {
    if (AppState.theme || DOM.themeInput.value.trim()) {
      AppState.theme = DOM.themeInput.value.trim();
      processDraw();
    }
  });

  DOM.deckContainer.addEventListener('click', function() {
    if (!AppState.isDrawing && AppState.theme) {
      processDraw();
    }
  });

  DOM.deckContainer.addEventListener('keydown', function(e) {
    if ((e.key === 'Enter' || e.key === ' ') && !AppState.isDrawing && AppState.theme) {
      e.preventDefault();
      processDraw();
    }
  });

  DOM.resetBtn.addEventListener('click', resetDivination);

  DOM.soundToggle.addEventListener('click', function() {
    SoundEngine.toggle();
  });
}

/* ========================================
   Initialize
   ======================================== */
function init() {
  AppState.flippedCards = new Set();

  initDOMRefs();
  createParticles();
  bindEvents();

  DOM.startBtn.disabled = true;
  DOM.startBtn.style.opacity = '0.4';
  DOM.resultSection.classList.remove('visible');
  DOM.interpretationSection.classList.remove('visible');
}

document.addEventListener('DOMContentLoaded', init);
