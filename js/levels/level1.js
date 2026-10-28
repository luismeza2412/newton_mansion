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
    'stopped-past': 'El fantasma pasó la puerta sin detenerse a tiempo: probá con más fricción o menos potencia.',
    'no-friction': 'Sin fuerza neta, la velocidad no cambia: el fantasma nunca se detiene. Subí la niebla de fricción.',
    exited: 'El fantasma salió de la mansión sin detenerse: ajustá mejor la potencia y la fricción.',
  };

  var PHASE_READY = 'ready';
  var PHASE_FLYING = 'flying';
  var PHASE_RESOLVED = 'resolved';

  var root, canvas, ctx;
  var frictionInput, frictionValueEl, blowButton, chargeFillEl, resetButton;
  var topbarEl, telemetryEl, statusEl, messageEl;
  var loop = null;
  var tombstones = [];

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
    canvas = root.querySelector('[data-level1="canvas"]');
    ctx = canvas.getContext('2d');
    frictionInput = root.querySelector('[data-level1="friction"]');
    frictionValueEl = root.querySelector('[data-level1="friction-value"]');
    blowButton = root.querySelector('[data-level1="blow"]');
    chargeFillEl = root.querySelector('[data-level1="charge-fill"]');
    resetButton = root.querySelector('[data-level1="reset"]');
    topbarEl = root.querySelector('[data-level1="topbar"]');
    telemetryEl = root.querySelector('[data-level1="telemetry"]');
    statusEl = root.querySelector('[data-level1="status"]');
    messageEl = root.querySelector('[data-level1="message"]');
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
  }

  function updateFrictionLabel() {
    var mu = parseFloat(frictionInput.value) * cfg().FRICTION_SLIDER_MAX;
    frictionValueEl.textContent = 'μ = ' + mu.toFixed(2);
  }

  function updateTopBar() {
    var level = window.NM.state.getState().levels[LEVEL_ID];
    window.NM.hud.renderTopBar(topbarEl, {
      levelId: LEVEL_ID,
      title: TITLE,
      score: level.score,
      attemptNumber: Math.min(level.attempts + 1, cfg().MAX_ATTEMPTS),
      maxAttempts: cfg().MAX_ATTEMPTS,
    });
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

  function updateTelemetry() {
    var mu = (phase === PHASE_READY ? parseFloat(frictionInput.value) : sliderAtLaunch) * cfg().FRICTION_SLIDER_MAX;
    var moving = phase === PHASE_FLYING && sim.v > cfg().VELOCITY_EPSILON;
    var frictionForce = moving ? window.NM.physics.kineticFriction(mu, cfg().MASS_GHOST, cfg().GRAVITY) : 0;
    var netForce = moving ? -frictionForce : 0;
    var a = window.NM.physics.acceleration(netForce, cfg().MASS_GHOST);

    window.NM.hud.renderDataPanel(telemetryEl, [
      { label: 'Velocidad', value: sim.v.toFixed(2), unit: 'm/s' },
      { label: 'Aceleración', value: a.toFixed(2), unit: 'm/s²' },
      { label: 'Fuerza neta', value: netForce.toFixed(2), unit: 'N' },
      { label: 'Fuerza de fricción', value: frictionForce.toFixed(2), unit: 'N' },
    ]);
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
      showMessage('win', starsEarned);
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

  function groundY() {
    return canvas.height * 0.75;
  }

  function drawScene() {
    var w = canvas.width;
    var h = canvas.height;
    var pxPerM = cfg().PX_PER_M;
    var gy = groundY();

    var gradient = ctx.createLinearGradient(0, 0, 0, h);
    gradient.addColorStop(0, '#1a0b2e');
    gradient.addColorStop(1, '#0d0517');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = 'rgba(13, 5, 23, 0.9)';
    ctx.fillRect(0, gy, w, h - gy);

    ctx.fillStyle = 'rgba(168, 155, 185, 0.5)';
    for (var i = 0; i < tombstones.length; i += 1) {
      var tx = tombstones[i] * pxPerM;
      ctx.fillRect(tx - 10, gy - 28, 20, 28);
    }

    var zoneX = cfg().STOP_ZONE_MIN * pxPerM;
    var zoneW = (cfg().STOP_ZONE_MAX - cfg().STOP_ZONE_MIN) * pxPerM;
    ctx.fillStyle = 'rgba(124, 252, 0, 0.25)';
    ctx.fillRect(zoneX, gy - 4, zoneW, 8);

    var doorX = cfg().STOP_ZONE_MAX * pxPerM;
    ctx.fillStyle = 'rgba(255, 117, 24, 0.85)';
    ctx.fillRect(doorX, gy - 70, 36, 70);

    var ghostX = sim.x * pxPerM;
    ctx.shadowColor = '#9b5de5';
    ctx.shadowBlur = 20;
    ctx.fillStyle = 'rgba(244, 241, 255, 0.9)';
    ctx.beginPath();
    ctx.arc(ghostX, gy - 24, 18, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  function render() {
    drawScene();
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
    tombstones = [3, 6, 9, 16, 18];
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
