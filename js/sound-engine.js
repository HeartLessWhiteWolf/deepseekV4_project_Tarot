'use strict';

/* ========================================
   Sound Engine - Web Audio API
   Procedural sound effects for Tarot divination
   No external dependencies.
   ======================================== */
const SoundEngine = (function() {
  'use strict';

  var ctx = null;
  var enabled = true;

  function getCtx() {
    if (!ctx) {
      try {
        ctx = new (window.AudioContext || window.webkitAudioContext)();
      } catch (e) {
        enabled = false;
      }
    }
    if (ctx && ctx.state === 'suspended') {
      ctx.resume();
    }
    return ctx;
  }

  function playTone(freq, duration, type, vol) {
    if (!enabled) return;
    type = type || 'sine';
    vol = vol || 0.08;
    var c = getCtx();
    if (!c) return;
    var osc = c.createOscillator();
    var gain = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, c.currentTime);
    gain.gain.setValueAtTime(vol, c.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + duration);
    osc.connect(gain);
    gain.connect(c.destination);
    osc.start(c.currentTime);
    osc.stop(c.currentTime + duration);
  }

  function shuffleSound() {
    for (var i = 0; i < 8; i++) {
      (function(idx) {
        setTimeout(function() {
          playTone(200 + Math.random() * 400, 0.08, 'triangle', 0.05);
        }, idx * 60);
      })(i);
    }
  }

  function drawSound() {
    playTone(523, 0.15, 'sine', 0.08);
    setTimeout(function() { playTone(659, 0.2, 'sine', 0.08); }, 100);
    setTimeout(function() { playTone(784, 0.3, 'sine', 0.1); }, 200);
  }

  function flipSound() {
    playTone(440, 0.1, 'triangle', 0.06);
    setTimeout(function() { playTone(880, 0.15, 'triangle', 0.05); }, 80);
  }

  function revealSound() {
    playTone(523, 0.3, 'sine', 0.07);
    setTimeout(function() { playTone(659, 0.3, 'sine', 0.07); }, 150);
    setTimeout(function() { playTone(784, 0.5, 'sine', 0.09); }, 300);
  }

  function toggle() {
    enabled = !enabled;
    var btn = document.getElementById('sound-toggle');
    if (btn) {
      btn.textContent = enabled ? '\uD83D\uDD0A' : '\uD83D\uDD07';
      btn.classList.toggle('muted', !enabled);
    }
    return enabled;
  }

  return {
    shuffleSound: shuffleSound,
    drawSound: drawSound,
    flipSound: flipSound,
    revealSound: revealSound,
    toggle: toggle,
    enabled: function() { return enabled; }
  };
})();
