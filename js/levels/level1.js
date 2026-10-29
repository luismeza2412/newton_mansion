/**
 * Nivel 1: El fantasma que no se detiene (1.ª ley de Newton).
 * Implementa RF-10, RF-11, RF-12, RF-13, RF-14 y RF-20 a RF-26.
 */
(function () {
  'use strict';

  var LEVEL_ID = 1;
  var TITLE = 'El fantasma que no se detiene';

  var HINTS = {
    'stopped-short': 'El fantasma se detuvo antes de la alfombra: necesita más potencia o menos fricción.',
    'stopped-past': 'El fantasma pasó la puerta sin detenerse a tiempo: hay que probar con más fricción o menos potencia.',
    'no-friction': 'Sin fuerza neta, la velocidad no cambia: el fantasma nunca se detiene. Hay que subir la niebla de fricción.',
    exited: 'El fantasma salió de la mansión sin detenerse: hay que ajustar mejor la potencia y la fricción.',
  };

  var PHASE_READY = 'ready';
  var PHASE_FLYING = 'flying';
  var PHASE_RESOLVED = 'resolved';

  var root;
  var frictionInput, frictionValueEl, blowButton, chargeFillEl, resetButton;
  var topbarEl, telemetryEl, statusEl, messageEl;
  var carpetEl, markersEl, ghostEl, ghostMassEl, vectorEl, doorEl;
  var frictionScaleMidEl, frictionScaleMaxEl, tipEl;
  var loop = null;
  var trackWidthM = 0;

  var phase = PHASE_READY;
  var isCharging = false;
  var spaceHeld = false;
  var charge = 0; // 0..100
  var sliderAtLaunch = 0; // valor crudo del slider (0..1) fijado al momento del soplido
  var sim = { x: 0, v: 0 };

  function cfg() {
    return window.NM.config.LEVEL1;
  }

  function queryDom() {
    root = document.querySelector('[data-screen="level-1"]');
    frictionInput = root.querySelector('[data-level1="friction"]');
    frictionValueEl = root.querySelector('[data-level1="friction-value"]');
    blowButton = root.querySelector('[data-level1="blow"]');
    chargeFillEl = root.querySelector('[data-level1="charge-fill"]');
    resetButton = root.querySelector('[data-level1="reset"]');
    topbarEl = root.querySelector('[data-level1="topbar"]');
    telemetryEl = root.querySelector('[data-level1="telemetry"]');
    statusEl = root.querySelector('[data-level1="status"]');
    messageEl = root.querySelector('[data-level1="message"]');
    carpetEl = root.querySelector('[data-level1="carpet"]');
    markersEl = root.querySelector('[data-level1="markers"]');
    ghostEl = root.querySelector('[data-level1="ghost"]');
    ghostMassEl = root.querySelector('[data-level1="ghost-mass"]');
    vectorEl = root.querySelector('[data-level1="vector"]');
    doorEl = root.querySelector('[data-level1="door"]');
    frictionScaleMidEl = root.querySelector('[data-level1="friction-scale-mid"]');
    frictionScaleMaxEl = root.querySelector('[data-level1="friction-scale-max"]');
    tipEl = root.querySelector('[data-level1="tip"]');
  }

  /** Convierte una posición en metros a % de ancho del riel (0..100). */
  function toPercent(meters) {
    return Math.max(0, Math.min(100, (meters / trackWidthM) * 100));
  }

  /** Posiciona los elementos estáticos del riel según la configuración del nivel. */
  function layoutStage() {
    trackWidthM = window.NM.config.ENGINE.CANVAS_WIDTH / cfg().PX_PER_M;

    var carpetLeft = toPercent(cfg().STOP_ZONE_MIN);
    var carpetRight = toPercent(cfg().STOP_ZONE_MAX);
    carpetEl.style.left = carpetLeft + '%';
    carpetEl.style.width = carpetRight - carpetLeft + '%';

    doorEl.style.left = toPercent(cfg().STOP_ZONE_MAX) + '%';

    markersEl.innerHTML =
      '<span>0 m (origen)</span>' +
      '<span>' + cfg().STOP_ZONE_MIN.toFixed(1) + ' m (alfombra)</span>' +
      '<span>' + cfg().STOP_ZONE_MAX.toFixed(1) + ' m (puerta)</span>';

    ghostMassEl.textContent = 'm = ' + cfg().MASS_GHOST + ' kg';

    var muMax = cfg().FRICTION_SLIDER_MAX;
    frictionScaleMidEl.textContent = (muMax / 2).toFixed(2) + ' (media)';
    frictionScaleMaxEl.textContent = muMax.toFixed(2) + ' (densa)';

    var law = window.NM.content.laws[1];
    tipEl.innerHTML = '<strong>1.ª Ley de Newton:</strong> ' + law.statement + ' (' + law.formula + ')';
  }

  function withUpdatedLevel(levels, levelId, patch) {
    var next = {};
    for (var id in levels) {
      next[id] = levels[id];
    }
    next[levelId] = patch;
    return next;
  }

  function recomputeTotalScore(levels) {
    var total = 0;
    for (var id in levels) {
      total += levels[id].score;
    }
    return total;
  }

  function resetSim() {
    phase = PHASE_READY;
    isCharging = false;
    charge = 0;
    sim.x = cfg().START_POSITION;
    sim.v = 0;
    frictionInput.disabled = false;
    blowButton.disabled = false;
    resetButton.disabled = false;
    chargeFillEl.style.width = '0%';
    messageEl.hidden = true;
    messageEl.innerHTML = '';
    renderStage();
  }

  function updateFrictionLabel() {
    var mu = parseFloat(frictionInput.value) * cfg().FRICTION_SLIDER_MAX;
    frictionValueEl.textContent = 'μ = ' + mu.toFixed(2);
  }

  function updateTopBar() {
    var level = window.NM.state.getState().levels[LEVEL_ID];
    var maxAttempts = cfg().MAX_ATTEMPTS;
    var attemptsLeft = Math.max(0, maxAttempts - level.attempts);
    var lives = '';
    for (var i = 0; i < maxAttempts; i += 1) {
      var spent = i >= attemptsLeft;
      lives +=
        '<span class="level1-topbar__life' + (spent ? ' level1-topbar__life--spent' : '') + '">🕯️</span>';
    }
    topbarEl.innerHTML =
      '<div class="level1-topbar__title-group">' +
      '<h1 class="level1-topbar__title">Nivel ' + LEVEL_ID + ': ' + TITLE + '</h1>' +
      '<p class="level1-topbar__subtitle">1.ª Ley de Newton (Inercia)</p>' +
      '</div>' +
      '<div class="level1-topbar__stats">' +
      '<div class="level1-topbar__lives">' + lives + '</div>' +
      '<span class="level1-topbar__score">Ectoplasma: ' + level.score + '</span>' +
      '</div>';
  }

  function statusText() {
    if (phase === PHASE_READY) {
      return 'Estado: en reposo (inercia estática)';
    }
    if (phase === PHASE_FLYING) {
      return sim.v > cfg().VELOCITY_EPSILON
        ? 'Estado: movimiento rectilíneo uniforme (1.ª ley activa)'
        : 'Estado: detenido por fricción';
    }
    return statusEl.textContent;
  }

  function telemetryCard(label, value, unit, ratio) {
    var pct = Math.max(0, Math.min(100, ratio * 100));
    return (
      '<div class="level1-telemetry__card">' +
      '<span class="level1-telemetry__label">' + label + '</span>' +
      '<span class="level1-telemetry__value">' + value + ' <small>' + unit + '</small></span>' +
      '<div class="level1-telemetry__bar"><div class="level1-telemetry__bar-fill" style="width: ' + pct.toFixed(0) + '%"></div></div>' +
      '</div>'
    );
  }

  function updateTelemetry() {
    var mu = (phase === PHASE_READY ? parseFloat(frictionInput.value) : sliderAtLaunch) * cfg().FRICTION_SLIDER_MAX;
    var moving = phase === PHASE_FLYING && sim.v > cfg().VELOCITY_EPSILON;
    var frictionForce = moving ? window.NM.physics.kineticFriction(mu, cfg().MASS_GHOST, cfg().GRAVITY) : 0;
    var netForce = moving ? -frictionForce : 0;
    var a = window.NM.physics.acceleration(netForce, cfg().MASS_GHOST);

    var maxForce = cfg().FRICTION_SLIDER_MAX * cfg().MASS_GHOST * cfg().GRAVITY;
    var maxAccel = window.NM.physics.acceleration(maxForce, cfg().MASS_GHOST);

    telemetryEl.innerHTML =
      telemetryCard('Velocidad', sim.v.toFixed(2), 'm/s', sim.v / cfg().BLOW_V_MAX) +
      telemetryCard('Aceleración', Math.abs(a).toFixed(2), 'm/s²', maxAccel ? Math.abs(a) / maxAccel : 0) +
      telemetryCard('Fuerza neta', netForce.toFixed(2), 'N', maxForce ? Math.abs(netForce) / maxForce : 0) +
      telemetryCard('Fuerza de fricción', frictionForce.toFixed(2), 'N', maxForce ? frictionForce / maxForce : 0);

    statusEl.textContent = statusText();
  }

  function starsText(count) {
    var out = '';
    for (var i = 0; i < 3; i += 1) {
      out += i < count ? '★' : '☆';
    }
    return out;
  }

  function showMessage(kind, hintKey, attemptsUsed) {
    var html = '';
    if (kind === 'win') {
      html =
        '<p class="level__message-title level__message-title--ok">¡Victoria! El fantasma se detuvo justo sobre la alfombra.</p>' +
        '<p>Estrellas obtenidas: ' + starsText(hintKey) + '</p>' +
        '<div class="level__message-actions">' +
        '<button type="button" class="btn btn--primary" data-level1-action="retry-level">Jugar de nuevo</button>' +
        '<button type="button" class="btn btn--ghost" data-level1-action="go-home">Volver al inicio</button>' +
        '</div>';
    } else if (kind === 'defeat') {
      html =
        '<p class="level__message-title level__message-title--error">Intento ' + attemptsUsed + ' de ' + cfg().MAX_ATTEMPTS + ' fallido.</p>' +
        '<p>' + HINTS[hintKey] + '</p>' +
        '<div class="level__message-actions">' +
        '<button type="button" class="btn btn--primary" data-level1-action="retry-attempt">Intentar de nuevo</button>' +
        '</div>';
    } else {
      html =
        '<p class="level__message-title level__message-title--error">Se acabaron los 3 intentos.</p>' +
        '<p>' + HINTS[hintKey] + '</p>' +
        '<div class="level__message-actions">' +
        '<button type="button" class="btn btn--primary" data-level1-action="retry-level">Reintentar nivel</button>' +
        '<button type="button" class="btn btn--ghost" data-level1-action="go-home">Volver al inicio</button>' +
        '</div>';
    }
    messageEl.innerHTML = html;
    messageEl.hidden = false;
  }

  /**
   * Resuelve el intento actual: gana si se detuvo dentro de la zona de
   * parada; pierde si se detuvo fuera o si salió de pantalla (RF-24, RF-26).
   */
  function resolveAttempt(won, hintKey) {
    phase = PHASE_RESOLVED;
    blowButton.disabled = true;
    resetButton.disabled = true;

    var state = window.NM.state.getState();
    var level = state.levels[LEVEL_ID];

    if (won) {
      var starsIndex = Math.min(level.attempts, cfg().STARS_BY_ATTEMPT.length - 1);
      var starsEarned = cfg().STARS_BY_ATTEMPT[starsIndex];
      var scoreEarned = starsEarned * window.NM.config.SCORING.POINTS_PER_STAR;
      var newLevels = withUpdatedLevel(state.levels, LEVEL_ID, {
        completed: true,
        stars: Math.max(level.stars, starsEarned),
        score: Math.max(level.score, scoreEarned),
        attempts: 0,
      });
      window.NM.state.setState({
        levels: newLevels,
        unlockedLevel: Math.max(state.unlockedLevel, LEVEL_ID + 1),
        totalScore: recomputeTotalScore(newLevels),
      });
      window.NM.audio.play('win');
      showMessage('win', starsEarned);
      window.NM.quiz.showLesson(LEVEL_ID, {
        onDone: function () {
          var nextScreenId = 'level-' + (LEVEL_ID + 1);
          if (document.querySelector('[data-screen="' + nextScreenId + '"]')) {
            window.NM.screens.navigateTo(nextScreenId);
          } else {
            window.NM.screens.navigateTo('home');
          }
        },
      });
    } else {
      var attemptsUsed = level.attempts + 1;
      window.NM.state.setState({
        levels: withUpdatedLevel(state.levels, LEVEL_ID, {
          completed: level.completed,
          stars: level.stars,
          score: level.score,
          attempts: attemptsUsed,
        }),
      });
      window.NM.audio.play('lose');
      if (attemptsUsed >= cfg().MAX_ATTEMPTS) {
        showMessage('final-defeat', hintKey);
      } else {
        showMessage('defeat', hintKey, attemptsUsed);
      }
    }
    updateTopBar();
  }

  function resolveStopped() {
    var min = cfg().STOP_ZONE_MIN;
    var max = cfg().STOP_ZONE_MAX;
    if (sim.x >= min && sim.x <= max) {
      resolveAttempt(true, null);
    } else {
      resolveAttempt(false, sim.x < min ? 'stopped-short' : 'stopped-past');
    }
  }

  function resolveExited() {
    resolveAttempt(false, sliderAtLaunch === 0 ? 'no-friction' : 'exited');
  }

  function startCharge() {
    if (phase !== PHASE_READY || isCharging) {
      return;
    }
    isCharging = true;
  }

  function releaseCharge() {
    if (!isCharging) {
      return;
    }
    isCharging = false;
    if (phase !== PHASE_READY) {
      return;
    }
    var power = charge;
    charge = 0;
    chargeFillEl.style.width = '0%';
    launch(power);
  }

  function launch(power) {
    sliderAtLaunch = parseFloat(frictionInput.value);
    frictionInput.disabled = true;
    blowButton.disabled = true;
    sim.x = cfg().START_POSITION;
    sim.v = (power / 100) * cfg().BLOW_V_MAX;
    phase = PHASE_FLYING;
  }

  function handleKeydown(event) {
    if (event.key !== ' ' && event.code !== 'Space') {
      return;
    }
    event.preventDefault();
    if (!spaceHeld) {
      spaceHeld = true;
      startCharge();
    }
  }

  function handleKeyup(event) {
    if (event.key !== ' ' && event.code !== 'Space') {
      return;
    }
    spaceHeld = false;
    releaseCharge();
  }

  function handleMessageClick(event) {
    var button = event.target.closest ? event.target.closest('[data-level1-action]') : null;
    if (!button) {
      return;
    }
    var action = button.getAttribute('data-level1-action');
    if (action === 'retry-attempt') {
      resetSim();
    } else if (action === 'retry-level') {
      var state = window.NM.state.getState();
      var level = state.levels[LEVEL_ID];
      window.NM.state.setState({
        levels: withUpdatedLevel(state.levels, LEVEL_ID, {
          completed: level.completed,
          stars: level.stars,
          score: level.score,
          attempts: 0,
        }),
      });
      resetSim();
      updateTopBar();
    } else if (action === 'go-home') {
      window.NM.screens.navigateTo('home');
    }
  }

  function update(dt) {
    if (phase === PHASE_READY && isCharging) {
      charge = Math.min(100, charge + (100 / cfg().BLOW_CHARGE_SECONDS) * dt);
      chargeFillEl.style.width = charge.toFixed(0) + '%';
    }

    if (phase !== PHASE_FLYING) {
      return;
    }

    var mu = sliderAtLaunch * cfg().FRICTION_SLIDER_MAX;
    var moving = sim.v > cfg().VELOCITY_EPSILON;
    var frictionForce = moving ? window.NM.physics.kineticFriction(mu, cfg().MASS_GHOST, cfg().GRAVITY) : 0;
    var a = moving ? -window.NM.physics.acceleration(frictionForce, cfg().MASS_GHOST) : 0;
    var next = window.NM.integrator.step(sim, a, dt);
    sim.x = next.x;
    sim.v = next.v < 0 ? 0 : next.v;

    if (sim.v <= cfg().VELOCITY_EPSILON) {
      sim.v = 0;
      resolveStopped();
      return;
    }

    var canvasWidthM = window.NM.config.ENGINE.CANVAS_WIDTH / cfg().PX_PER_M;
    if (sim.x > canvasWidthM) {
      resolveExited();
    }
  }

  /** Refleja el estado físico (sim.x, sim.v) en el riel DOM/CSS. */
  function renderStage() {
    ghostEl.style.left = toPercent(sim.x) + '%';
    var moving = phase === PHASE_FLYING && sim.v > cfg().VELOCITY_EPSILON;
    vectorEl.hidden = !moving;
  }

  function render() {
    renderStage();
    updateTelemetry();
  }

  function onEnter() {
    resetSim();
    updateTopBar();
    document.addEventListener('keydown', handleKeydown);
    document.addEventListener('keyup', handleKeyup);
    loop.start();
  }

  function onExit() {
    loop.stop();
    document.removeEventListener('keydown', handleKeydown);
    document.removeEventListener('keyup', handleKeyup);
    spaceHeld = false;
    isCharging = false;
  }

  function wire() {
    frictionInput.addEventListener('input', updateFrictionLabel);
    blowButton.addEventListener('pointerdown', function (event) {
      event.preventDefault();
      startCharge();
    });
    blowButton.addEventListener('pointerup', releaseCharge);
    blowButton.addEventListener('pointerleave', releaseCharge);
    blowButton.addEventListener('pointercancel', releaseCharge);
    resetButton.addEventListener('click', resetSim);
    messageEl.addEventListener('click', handleMessageClick);
  }

  function init() {
    queryDom();
    layoutStage();
    wire();
    updateFrictionLabel();

    loop = window.NM.loop.createLoop({
      dt: window.NM.config.INTEGRATION.DT,
      maxFrameDt: window.NM.config.INTEGRATION.MAX_FRAME_DT,
      update: update,
      render: render,
    });

    window.NM.screens.registerLifecycle('level-1', { onEnter: onEnter, onExit: onExit });
  }

  window.NM = window.NM || {};
  window.NM.levels = window.NM.levels || {};
  window.NM.levels.level1 = { init: init };
})();
