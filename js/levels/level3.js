/**
 * Nivel 3: La bruja y su escoba (3.ª ley de Newton).
 * Implementa RF-40 a RF-47.
 */
(function () {
  'use strict';

  var LEVEL_ID = 3;
  var TITLE = 'La bruja y su escoba';
  var EXIT_HINT = 'La bruja se alejó demasiado y se perdió en la oscuridad: calculá mejor la dirección y el objeto a lanzar.';

  var PHASE_ACTIVE = 'active';
  var PHASE_RESOLVED = 'resolved';

  var root, canvas, ctx;
  var objectButtons, directionInput, directionValueEl, launchButton;
  var topbarEl, telemetryEl, statusEl, messageEl;
  var loop = null;
  var particleSystem = null;
  var reducedMotion = false;

  var phase = PHASE_ACTIVE;
  var selectedObjectKey = 'candy';
  var directionDeg = 0;
  var throwsUsed = 0;
  var simTime = 0;
  var witch = { x: 0, y: 0, vx: 0, vy: 0 };
  var flyingObjects = [];
  var activeThrow = null;

  function cfg() {
    return window.NM.config.LEVEL3;
  }

  function queryDom() {
    root = document.querySelector('[data-screen="level-3"]');
    canvas = root.querySelector('[data-level3="canvas"]');
    ctx = canvas.getContext('2d');
    objectButtons = root.querySelectorAll('[data-level3-object]');
    directionInput = root.querySelector('[data-level3="direction"]');
    directionValueEl = root.querySelector('[data-level3="direction-value"]');
    launchButton = root.querySelector('[data-level3="launch"]');
    topbarEl = root.querySelector('[data-level3="topbar"]');
    telemetryEl = root.querySelector('[data-level3="telemetry"]');
    statusEl = root.querySelector('[data-level3="status"]');
    messageEl = root.querySelector('[data-level3="message"]');
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

  function massForKey(key) {
    return key === 'cauldron' ? cfg().MASS_CAULDRON : cfg().MASS_CANDY;
  }

  function objectRadiusForKey(key) {
    return key === 'cauldron' ? cfg().OBJECT_RADIUS_CAULDRON_M : cfg().OBJECT_RADIUS_CANDY_M;
  }

  function objectColorForKey(key) {
    return key === 'cauldron' ? '#4a4a4a' : '#ff5fa2';
  }

  function updateObjectButtonsUI() {
    for (var i = 0; i < objectButtons.length; i += 1) {
      var isSelected = objectButtons[i].getAttribute('data-level3-object') === selectedObjectKey;
      objectButtons[i].setAttribute('aria-pressed', isSelected ? 'true' : 'false');
    }
  }

  function updateDirectionLabel() {
    directionValueEl.textContent = directionDeg + '°';
  }

  function starsForThrows(n) {
    var thresholds = cfg().STARS_THRESHOLDS;
    for (var i = 0; i < thresholds.length; i += 1) {
      if (n <= thresholds[i]) {
        return 3 - i;
      }
    }
    return 1;
  }

  function starsText(count) {
    var out = '';
    for (var i = 0; i < 3; i += 1) {
      out += i < count ? '★' : '☆';
    }
    return out;
  }

  function updateTopBar() {
    var level = window.NM.state.getState().levels[LEVEL_ID];
    window.NM.hud.renderTopBar(topbarEl, {
      levelId: LEVEL_ID,
      title: TITLE,
      score: level.score,
      attemptLabel: 'Lanzamiento',
      attemptNumber: Math.min(throwsUsed + 1, cfg().MAX_THROWS),
      maxAttempts: cfg().MAX_THROWS,
    });
  }

  function statusText() {
    if (phase !== PHASE_ACTIVE) {
      return statusEl.textContent;
    }
    var speed = Math.sqrt(witch.vx * witch.vx + witch.vy * witch.vy);
    return speed > 0.05 ? 'Estado: movimiento rectilíneo uniforme (1.ª ley activa)' : 'Estado: flotando en reposo';
  }

  function renderTelemetry() {
    var speed = Math.sqrt(witch.vx * witch.vx + witch.vy * witch.vy);
    window.NM.hud.renderDataPanel(telemetryEl, [
      { label: 'Masa del objeto', value: massForKey(selectedObjectKey).toFixed(0), unit: 'kg' },
      { label: 'Masa de la bruja', value: cfg().MASS_WITCH.toFixed(0), unit: 'kg' },
      { label: 'Velocidad bruja (x)', value: witch.vx.toFixed(2), unit: 'm/s' },
      { label: 'Velocidad bruja (y)', value: witch.vy.toFixed(2), unit: 'm/s' },
      { label: 'Rapidez de la bruja', value: speed.toFixed(2), unit: 'm/s' },
      { label: 'Lanzamientos', value: throwsUsed + ' / ' + cfg().MAX_THROWS, unit: '' },
    ]);
    statusEl.textContent = statusText();
  }

  function showMessage(kind, starsEarned) {
    var html = '';
    if (kind === 'win') {
      html =
        '<p class="level__message-title level__message-title--ok">¡Victoria! La bruja llegó a la luna.</p>' +
        '<p>Estrellas obtenidas: ' + starsText(starsEarned) + '</p>' +
        '<div class="level__message-actions">' +
        '<button type="button" class="btn btn--primary" data-level3-action="retry-level">Jugar de nuevo</button>' +
        '<button type="button" class="btn btn--ghost" data-level3-action="go-home">Volver al inicio</button>' +
        '</div>';
    } else {
      html =
        '<p class="level__message-title level__message-title--error">La bruja se perdió en la noche.</p>' +
        '<p>' + EXIT_HINT + '</p>' +
        '<div class="level__message-actions">' +
        '<button type="button" class="btn btn--primary" data-level3-action="retry-attempt">Intentar de nuevo</button>' +
        '</div>';
    }
    messageEl.innerHTML = html;
    messageEl.hidden = false;
  }

  /**
   * Resuelve el intento: gana si la bruja toca la luna; pierde si sale de
   * los límites del escenario (RF-46).
   */
  function resolveAttempt(won) {
    phase = PHASE_RESOLVED;
    launchButton.disabled = true;
    directionInput.disabled = true;
    for (var i = 0; i < objectButtons.length; i += 1) {
      objectButtons[i].disabled = true;
    }

    if (won) {
      var state = window.NM.state.getState();
      var level = state.levels[LEVEL_ID];
      var starsEarned = starsForThrows(throwsUsed);
      var scoreEarned = starsEarned * window.NM.config.SCORING.POINTS_PER_STAR;
      var newLevels = withUpdatedLevel(state.levels, LEVEL_ID, {
        completed: true,
        stars: Math.max(level.stars, starsEarned),
        score: Math.max(level.score, scoreEarned),
        attempts: level.attempts,
      });
      window.NM.state.setState({
        levels: newLevels,
        unlockedLevel: Math.max(state.unlockedLevel, LEVEL_ID + 1),
        totalScore: recomputeTotalScore(newLevels),
      });
      window.NM.audio.play('win');
      showMessage('win', starsEarned);
      window.NM.quiz.showLesson(LEVEL_ID, {
        nextLabel: 'Ver resultado final',
        onDone: function () {
          window.NM.screens.navigateTo('final');
        },
      });
    } else {
      window.NM.audio.play('lose');
      showMessage('defeat');
    }
    updateTopBar();
  }

  function resetSim() {
    phase = PHASE_ACTIVE;
    witch.x = cfg().WITCH_START_X_M;
    witch.y = cfg().WITCH_START_Y_M;
    witch.vx = 0;
    witch.vy = 0;
    throwsUsed = 0;
    simTime = 0;
    flyingObjects = [];
    activeThrow = null;
    particleSystem.clear();
    directionInput.disabled = false;
    launchButton.disabled = false;
    for (var i = 0; i < objectButtons.length; i += 1) {
      objectButtons[i].disabled = false;
    }
    messageEl.hidden = true;
    messageEl.innerHTML = '';
    updateTopBar();
  }

  function handleObjectClick(event) {
    var button = event.target.closest ? event.target.closest('[data-level3-object]') : null;
    if (!button || phase !== PHASE_ACTIVE) {
      return;
    }
    selectedObjectKey = button.getAttribute('data-level3-object');
    updateObjectButtonsUI();
  }

  function handleDirectionInput() {
    directionDeg = parseInt(directionInput.value, 10);
    updateDirectionLabel();
  }

  function handleMessageClick(event) {
    var button = event.target.closest ? event.target.closest('[data-level3-action]') : null;
    if (!button) {
      return;
    }
    var action = button.getAttribute('data-level3-action');
    if (action === 'retry-attempt' || action === 'retry-level') {
      resetSim();
    } else if (action === 'go-home') {
      window.NM.screens.navigateTo('home');
    }
  }

  /**
   * Lanza el objeto elegido: conserva el momento entre la bruja y el objeto
   * (RF-43), y deja las flechas de fuerza listas para dibujarse (RF-44).
   */
  function launch() {
    if (phase !== PHASE_ACTIVE || throwsUsed >= cfg().MAX_THROWS) {
      return;
    }
    var angleRad = (directionDeg * Math.PI) / 180;
    var dirX = Math.cos(angleRad);
    var dirY = Math.sin(angleRad);
    var m = massForKey(selectedObjectKey);
    var M = cfg().MASS_WITCH;
    var u = cfg().RELATIVE_LAUNCH_SPEED;
    var deltaV = window.NM.physics.recoilDelta(m, u, M);

    var obj = {
      x: witch.x,
      y: witch.y,
      vx: witch.vx + u * dirX,
      vy: witch.vy + u * dirY,
      radius: objectRadiusForKey(selectedObjectKey),
      color: objectColorForKey(selectedObjectKey),
      bornAt: simTime,
    };
    flyingObjects.push(obj);

    witch.vx -= deltaV * dirX;
    witch.vy -= deltaV * dirY;

    var forceN = (m * u) / cfg().PUSH_DT;
    activeThrow = { forceN: forceN, dirAngleRad: angleRad, objectRef: obj, until: simTime + cfg().ARROW_DISPLAY_SECONDS };

    particleSystem.emit({
      x: witch.x * cfg().PX_PER_M,
      y: witch.y * cfg().PX_PER_M,
      count: reducedMotion ? 4 : 16, // RNF-05: reducir partículas con reduced-motion

      color: '#c77dff',
      size: 2,
      life: 0.6,
      speedMin: 40,
      speedMax: 120,
      angleMin: angleRad + Math.PI - 0.6,
      angleMax: angleRad + Math.PI + 0.6,
    });

    throwsUsed += 1;
    if (throwsUsed >= cfg().MAX_THROWS) {
      launchButton.disabled = true;
    }
    updateTopBar();
  }

  function removeExpiredObjects() {
    for (var i = flyingObjects.length - 1; i >= 0; i -= 1) {
      if (simTime - flyingObjects[i].bornAt > cfg().THROW_LIFESPAN_S) {
        flyingObjects.splice(i, 1);
      }
    }
  }

  function update(dt) {
    if (phase !== PHASE_ACTIVE) {
      return;
    }
    simTime += dt;
    witch.x += witch.vx * dt;
    witch.y += witch.vy * dt;
    for (var i = 0; i < flyingObjects.length; i += 1) {
      flyingObjects[i].x += flyingObjects[i].vx * dt;
      flyingObjects[i].y += flyingObjects[i].vy * dt;
    }
    removeExpiredObjects();
    particleSystem.update(dt);

    if (activeThrow && simTime > activeThrow.until) {
      activeThrow = null;
    }

    var touchDist = cfg().WITCH_RADIUS_M + cfg().MOON_RADIUS_M;
    var moonDx = witch.x - cfg().MOON_X_M;
    var moonDy = witch.y - cfg().MOON_Y_M;
    if (moonDx * moonDx + moonDy * moonDy <= touchDist * touchDist) {
      resolveAttempt(true);
      return;
    }

    var margin = cfg().BOUNDS_MARGIN_M;
    var maxXm = window.NM.config.ENGINE.CANVAS_WIDTH / cfg().PX_PER_M + margin;
    var maxYm = window.NM.config.ENGINE.CANVAS_HEIGHT / cfg().PX_PER_M + margin;
    if (witch.x < -margin || witch.x > maxXm || witch.y < -margin || witch.y > maxYm) {
      resolveAttempt(false);
    }
  }

  function drawArrow(x, y, angleRad, length, color, label) {
    var ex = x + Math.cos(angleRad) * length;
    var ey = y + Math.sin(angleRad) * length;
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(ex, ey);
    ctx.stroke();

    var headLen = 8;
    var headAngle = Math.PI / 7;
    ctx.beginPath();
    ctx.moveTo(ex, ey);
    ctx.lineTo(ex - headLen * Math.cos(angleRad - headAngle), ey - headLen * Math.sin(angleRad - headAngle));
    ctx.lineTo(ex - headLen * Math.cos(angleRad + headAngle), ey - headLen * Math.sin(angleRad + headAngle));
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();

    if (label) {
      ctx.font = '12px sans-serif';
      ctx.fillStyle = color;
      ctx.fillText(label, ex + 4, ey);
    }
  }

  function drawMoon() {
    var pxPerM = cfg().PX_PER_M;
    var x = cfg().MOON_X_M * pxPerM;
    var y = cfg().MOON_Y_M * pxPerM;
    var radius = cfg().MOON_RADIUS_M * pxPerM;
    ctx.shadowColor = 'rgba(244, 241, 215, 0.9)';
    ctx.shadowBlur = 25;
    ctx.fillStyle = '#f4f1d7';
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  function drawWitch() {
    var pxPerM = cfg().PX_PER_M;
    var x = witch.x * pxPerM;
    var y = witch.y * pxPerM;
    var radius = cfg().WITCH_RADIUS_M * pxPerM;
    ctx.shadowColor = '#9b5de5';
    ctx.shadowBlur = 16;
    ctx.fillStyle = 'rgba(26, 11, 46, 0.95)';
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#1a0b2e';
    ctx.beginPath();
    ctx.moveTo(x - radius * 0.9, y - radius * 0.3);
    ctx.lineTo(x + radius * 0.9, y - radius * 0.3);
    ctx.lineTo(x, y - radius * 1.8);
    ctx.closePath();
    ctx.fill();
  }

  function drawFlyingObjects() {
    var pxPerM = cfg().PX_PER_M;
    for (var i = 0; i < flyingObjects.length; i += 1) {
      var obj = flyingObjects[i];
      ctx.fillStyle = obj.color;
      ctx.beginPath();
      ctx.arc(obj.x * pxPerM, obj.y * pxPerM, obj.radius * pxPerM, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawAimArrow() {
    var pxPerM = cfg().PX_PER_M;
    var angleRad = (directionDeg * Math.PI) / 180;
    drawArrow(witch.x * pxPerM, witch.y * pxPerM, angleRad, 40, 'rgba(244, 241, 255, 0.8)', null);
  }

  function drawThrowArrows() {
    var pxPerM = cfg().PX_PER_M;
    var objPx = { x: activeThrow.objectRef.x * pxPerM, y: activeThrow.objectRef.y * pxPerM };
    var witchPx = { x: witch.x * pxPerM, y: witch.y * pxPerM };
    var label = 'F = ' + activeThrow.forceN.toFixed(0) + ' N';
    drawArrow(objPx.x, objPx.y, activeThrow.dirAngleRad, 36, '#ff7518', label);
    drawArrow(witchPx.x, witchPx.y, activeThrow.dirAngleRad + Math.PI, 36, '#9b5de5', label);
  }

  function drawScene() {
    var w = canvas.width;
    var h = canvas.height;
    var gradient = ctx.createLinearGradient(0, 0, 0, h);
    gradient.addColorStop(0, '#0d0517');
    gradient.addColorStop(1, '#1a0b2e');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, w, h);

    drawMoon();
    drawFlyingObjects();
    drawWitch();
    particleSystem.render(ctx);
    if (phase === PHASE_ACTIVE) {
      drawAimArrow();
    }
    if (activeThrow && simTime <= activeThrow.until) {
      drawThrowArrows();
    }
  }

  function render() {
    drawScene();
    renderTelemetry();
  }

  function onEnter() {
    resetSim();
    loop.start();
  }

  function onExit() {
    loop.stop();
  }

  function wire() {
    for (var i = 0; i < objectButtons.length; i += 1) {
      objectButtons[i].addEventListener('click', handleObjectClick);
    }
    directionInput.addEventListener('input', handleDirectionInput);
    launchButton.addEventListener('click', launch);
    messageEl.addEventListener('click', handleMessageClick);
  }

  function init() {
    queryDom();
    wire();
    particleSystem = window.NM.particles.createSystem(window.NM.config.ENGINE.MAX_PARTICLES);
    reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    directionDeg = parseInt(directionInput.value, 10);
    updateDirectionLabel();
    updateObjectButtonsUI();

    loop = window.NM.loop.createLoop({
      dt: window.NM.config.INTEGRATION.DT,
      maxFrameDt: window.NM.config.INTEGRATION.MAX_FRAME_DT,
      update: update,
      render: render,
    });

    window.NM.screens.registerLifecycle('level-3', { onEnter: onEnter, onExit: onExit });
  }

  window.NM = window.NM || {};
  window.NM.levels = window.NM.levels || {};
  window.NM.levels.level3 = { init: init };
})();
