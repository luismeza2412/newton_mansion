/**
 * Nivel 2: Catapulta de calabazas (2.ª ley de Newton).
 * Implementa RF-30 a RF-38. La calabaza es un cuerpo de Matter.js: la 2.ª ley
 * (a = F/m, v = a·Δt) solo decide su velocidad de salida; el vuelo y las
 * colisiones las resuelve el motor físico.
 */
(function () {
  'use strict';

  var LEVEL_ID = 2;
  var TITLE = 'Catapulta de calabazas';

  var HINTS = {
    'too-weak': 'La calabaza cayó antes de llegar a la torre: probá con más fuerza o una calabaza más liviana.',
    'too-strong': 'La calabaza pasó de largo sin golpear la torre: probá con menos fuerza o una calabaza más pesada.',
    'no-topple': 'El golpe no derribó al menos 3 esqueletos: ajustá la combinación de masa y fuerza.',
  };

  var PHASE_READY = 'ready';
  var PHASE_FLYING = 'flying';
  var PHASE_RESOLVED = 'resolved';

  // Constantes calibradas empíricamente contra vendor/matter.min.js v0.19.0:
  // con gravity.y = 1 y un cuerpo libre, la aceleración real es 1000 px/s²,
  // independiente de dt; y Body.setVelocity({x,y}) * 60 = velocidad real en px/s.
  var MATTER_GRAVITY_PX_S2_PER_UNIT = 1000;
  var MATTER_VELOCITY_SCALE = 60;

  var SETTLE_SPEED_EPSILON_MS = 0.3;
  var SETTLE_TICKS_REQUIRED = 20;
  var FLIGHT_TIMEOUT_S = 6;
  var LAUNCH_HEIGHT_M = 0.3;
  var CATAPULT_X_PX = 130;
  var TOWER_COLS = 3;
  var TOWER_ROWS = 2;

  var root, canvas, ctx;
  var massButtons, forceInput, forceValueEl, launchButton;
  var topbarEl, telemetryEl, statusEl, messageEl, formulaEl;
  var loop = null;
  var chart = null;

  var phase = PHASE_READY;
  var selectedMassKey = 'medium';
  var force = 150;

  var engine = null;
  var pumpkinBody = null;
  var pumpkinRadiusPx = 0;
  var skeletonStates = [];
  var blockLayout = [];
  var massAtLaunch = 'medium';
  var flightElapsed = 0;
  var lastSpeedMs = 0;
  var settleTicks = 0;
  var contactedTower = false;

  function cfg() {
    return window.NM.config.LEVEL2;
  }

  function queryDom() {
    root = document.querySelector('[data-screen="level-2"]');
    canvas = root.querySelector('[data-level2="canvas"]');
    ctx = canvas.getContext('2d');
    massButtons = root.querySelectorAll('[data-level2-mass]');
    forceInput = root.querySelector('[data-level2="force"]');
    forceValueEl = root.querySelector('[data-level2="force-value"]');
    launchButton = root.querySelector('[data-level2="launch"]');
    topbarEl = root.querySelector('[data-level2="topbar"]');
    telemetryEl = root.querySelector('[data-level2="telemetry"]');
    statusEl = root.querySelector('[data-level2="status"]');
    messageEl = root.querySelector('[data-level2="message"]');
    formulaEl = root.querySelector('[data-level2="formula"]');
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
    if (key === 'small') {
      return cfg().MASS_SMALL;
    }
    if (key === 'giant') {
      return cfg().MASS_GIANT;
    }
    return cfg().MASS_MEDIUM;
  }

  function radiusForKey(key) {
    if (key === 'small') {
      return cfg().PUMPKIN_RADIUS_SMALL_M;
    }
    if (key === 'giant') {
      return cfg().PUMPKIN_RADIUS_GIANT_M;
    }
    return cfg().PUMPKIN_RADIUS_MEDIUM_M;
  }

  function groundY() {
    return canvas.height * 0.75;
  }

  function towerCenterXPx() {
    return CATAPULT_X_PX + cfg().TOWER_DISTANCE_M * cfg().PX_PER_M;
  }

  function towerLeftEdgePx() {
    var blockWPx = cfg().BLOCK_WIDTH_M * cfg().PX_PER_M;
    return towerCenterXPx() - (TOWER_COLS * blockWPx) / 2;
  }

  /**
   * Crea la torre estática de bloques, los esqueletos dinámicos parados
   * sobre ella y el piso. Se llama una sola vez en `init`.
   */
  function buildStaticWorld() {
    var blockWPx = cfg().BLOCK_WIDTH_M * cfg().PX_PER_M;
    var blockHPx = cfg().BLOCK_HEIGHT_M * cfg().PX_PER_M;
    var leftPx = towerLeftEdgePx();
    var bodies = [];

    blockLayout = [];
    for (var row = 0; row < TOWER_ROWS; row += 1) {
      var centerY = groundY() - blockHPx * row - blockHPx / 2;
      for (var col = 0; col < TOWER_COLS; col += 1) {
        var centerX = leftPx + blockWPx * col + blockWPx / 2;
        blockLayout.push({ x: centerX, y: centerY, w: blockWPx, h: blockHPx });
        bodies.push(
          Matter.Bodies.rectangle(centerX, centerY, blockWPx, blockHPx, {
            isStatic: true,
            label: 'block',
            friction: cfg().BLOCK_FRICTION,
            restitution: cfg().BLOCK_RESTITUTION,
          })
        );
      }
    }

    var groundBody = Matter.Bodies.rectangle(canvas.width / 2, groundY() + 20, canvas.width, 40, {
      isStatic: true,
      label: 'ground',
      friction: cfg().GROUND_FRICTION,
    });
    bodies.push(groundBody);

    var skeletonWPx = cfg().SKELETON_WIDTH_M * cfg().PX_PER_M;
    var skeletonHPx = cfg().SKELETON_HEIGHT_M * cfg().PX_PER_M;
    var platformTopY = groundY() - blockHPx * TOWER_ROWS;
    var spacingPx = cfg().SKELETON_SPACING_M * cfg().PX_PER_M;
    var totalSpanPx = (cfg().SKELETON_COUNT - 1) * spacingPx;
    var startX = towerCenterXPx() - totalSpanPx / 2;

    skeletonStates = [];
    for (var i = 0; i < cfg().SKELETON_COUNT; i += 1) {
      var x = startX + i * spacingPx;
      var y = platformTopY - skeletonHPx / 2;
      var body = Matter.Bodies.rectangle(x, y, skeletonWPx, skeletonHPx, {
        label: 'skeleton',
        friction: cfg().SKELETON_FRICTION,
        restitution: cfg().SKELETON_RESTITUTION,
        density: cfg().SKELETON_DENSITY,
      });
      bodies.push(body);
      skeletonStates.push({ body: body, initial: { x: x, y: y }, w: skeletonWPx, h: skeletonHPx, toppled: false });
    }

    Matter.World.add(engine.world, bodies);
  }

  function resetSkeletons() {
    for (var i = 0; i < skeletonStates.length; i += 1) {
      var state = skeletonStates[i];
      Matter.Body.setPosition(state.body, state.initial);
      Matter.Body.setAngle(state.body, 0);
      Matter.Body.setVelocity(state.body, { x: 0, y: 0 });
      Matter.Body.setAngularVelocity(state.body, 0);
      state.toppled = false;
    }
  }

  function countToppled() {
    var count = 0;
    for (var i = 0; i < skeletonStates.length; i += 1) {
      if (skeletonStates[i].toppled) {
        count += 1;
      }
    }
    return count;
  }

  function normalizeAngle(angle) {
    var a = angle % (Math.PI * 2);
    if (a > Math.PI) {
      a -= Math.PI * 2;
    }
    if (a < -Math.PI) {
      a += Math.PI * 2;
    }
    return a;
  }

  function updateToppleFlags() {
    for (var i = 0; i < skeletonStates.length; i += 1) {
      var state = skeletonStates[i];
      if (!state.toppled && Math.abs(normalizeAngle(state.body.angle)) > cfg().SKELETON_TOPPLE_ANGLE_RAD) {
        state.toppled = true;
      }
    }
  }

  function handleCollisionStart(event) {
    var pairs = event.pairs;
    for (var i = 0; i < pairs.length; i += 1) {
      var a = pairs[i].bodyA;
      var b = pairs[i].bodyB;
      if (a !== pumpkinBody && b !== pumpkinBody) {
        continue;
      }
      var other = a === pumpkinBody ? b : a;
      if (other.label === 'skeleton' || other.label === 'block') {
        contactedTower = true;
      }
    }
  }

  function resetSim() {
    phase = PHASE_READY;
    if (pumpkinBody) {
      Matter.World.remove(engine.world, pumpkinBody);
      pumpkinBody = null;
    }
    resetSkeletons();
    flightElapsed = 0;
    lastSpeedMs = 0;
    settleTicks = 0;
    contactedTower = false;
    for (var i = 0; i < massButtons.length; i += 1) {
      massButtons[i].disabled = false;
    }
    forceInput.disabled = false;
    launchButton.disabled = false;
    messageEl.hidden = true;
    messageEl.innerHTML = '';
    chart.reset();
    updateMassButtonsUI();
  }

  function updateMassButtonsUI() {
    for (var i = 0; i < massButtons.length; i += 1) {
      var isSelected = massButtons[i].getAttribute('data-level2-mass') === selectedMassKey;
      massButtons[i].setAttribute('aria-pressed', isSelected ? 'true' : 'false');
    }
  }

  function updateForceLabel() {
    forceValueEl.textContent = force + ' N';
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

  function computePreview() {
    var m = massForKey(selectedMassKey);
    var angleRad = (cfg().LAUNCH_ANGLE_DEG * Math.PI) / 180;
    var a = window.NM.physics.acceleration(force, m);
    var v = window.NM.physics.launchVelocity(force, m, cfg().PUSH_DT);
    return {
      m: m,
      F: force,
      a: a,
      v: v,
      vx: v * Math.cos(angleRad),
      vy: v * Math.sin(angleRad),
      p: m * v,
    };
  }

  function renderPreviewPanel(preview) {
    window.NM.hud.renderDataPanel(telemetryEl, [
      { label: 'Masa', value: preview.m.toFixed(0), unit: 'kg' },
      { label: 'Fuerza', value: preview.F.toFixed(0), unit: 'N' },
      { label: 'Aceleración', value: preview.a.toFixed(2), unit: 'm/s²' },
      { label: 'Velocidad de salida', value: preview.v.toFixed(2), unit: 'm/s' },
      { label: 'Momento lineal', value: preview.p.toFixed(2), unit: 'kg·m/s' },
    ]);
  }

  function renderFormula(preview) {
    formulaEl.textContent =
      'a = F / m = ' + preview.F.toFixed(0) + ' N / ' + preview.m.toFixed(0) + ' kg = ' + preview.a.toFixed(2) + ' m/s²';
  }

  function statusText() {
    if (phase === PHASE_READY) {
      return 'Estado: catapulta lista';
    }
    if (phase === PHASE_FLYING) {
      return 'Estado: calabaza en vuelo';
    }
    return statusEl.textContent;
  }

  function starsText(count) {
    var out = '';
    for (var i = 0; i < 3; i += 1) {
      out += i < count ? '★' : '☆';
    }
    return out;
  }

  function showMessage(kind, hintKeyOrStars, attemptsUsed) {
    var html = '';
    if (kind === 'win') {
      html =
        '<p class="level__message-title level__message-title--ok">¡Victoria! Los esqueletos cayeron.</p>' +
        '<p>Estrellas obtenidas: ' + starsText(hintKeyOrStars) + '</p>' +
        '<div class="level__message-actions">' +
        '<button type="button" class="btn btn--primary" data-level2-action="retry-level">Jugar de nuevo</button>' +
        '<button type="button" class="btn btn--ghost" data-level2-action="go-home">Volver al inicio</button>' +
        '</div>';
    } else if (kind === 'defeat') {
      html =
        '<p class="level__message-title level__message-title--error">Lanzamiento ' + attemptsUsed + ' de ' + cfg().MAX_ATTEMPTS + ' fallido.</p>' +
        '<p>' + HINTS[hintKeyOrStars] + '</p>' +
        '<div class="level__message-actions">' +
        '<button type="button" class="btn btn--primary" data-level2-action="retry-attempt">Intentar de nuevo</button>' +
        '</div>';
    } else {
      html =
        '<p class="level__message-title level__message-title--error">Se acabaron los 3 lanzamientos.</p>' +
        '<p>' + HINTS[hintKeyOrStars] + '</p>' +
        '<div class="level__message-actions">' +
        '<button type="button" class="btn btn--primary" data-level2-action="retry-level">Reintentar nivel</button>' +
        '<button type="button" class="btn btn--ghost" data-level2-action="go-home">Volver al inicio</button>' +
        '</div>';
    }
    messageEl.innerHTML = html;
    messageEl.hidden = false;
  }

  /**
   * Resuelve el intento actual: gana si cayeron al menos SKELETON_WIN_COUNT
   * esqueletos (RF-37); si no, clasifica la causa para el hint (RF-38).
   */
  function resolveAttempt(won, hintKey) {
    phase = PHASE_RESOLVED;
    launchButton.disabled = true;

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
      if (attemptsUsed >= cfg().MAX_ATTEMPTS) {
        showMessage('final-defeat', hintKey);
      } else {
        showMessage('defeat', hintKey, attemptsUsed);
      }
    }
    updateTopBar();
  }

  function resolveFlight() {
    updateToppleFlags();
    var toppledCount = countToppled();
    if (toppledCount >= cfg().SKELETON_WIN_COUNT) {
      resolveAttempt(true, null);
      return;
    }
    var hintKey;
    if (!contactedTower) {
      hintKey = pumpkinBody.position.x < towerLeftEdgePx() ? 'too-weak' : 'too-strong';
    } else {
      hintKey = 'no-topple';
    }
    resolveAttempt(false, hintKey);
  }

  function spawnPumpkin(preview) {
    var radiusM = radiusForKey(massAtLaunch);
    pumpkinRadiusPx = radiusM * cfg().PX_PER_M;
    var yPx = groundY() - LAUNCH_HEIGHT_M * cfg().PX_PER_M;

    pumpkinBody = Matter.Bodies.circle(CATAPULT_X_PX, yPx, pumpkinRadiusPx, {
      label: 'pumpkin',
      restitution: cfg().PUMPKIN_RESTITUTION,
      friction: cfg().PUMPKIN_FRICTION,
    });
    Matter.World.add(engine.world, [pumpkinBody]);

    var vxPxPerS = preview.vx * cfg().PX_PER_M;
    var vyPxPerS = preview.vy * cfg().PX_PER_M;
    Matter.Body.setVelocity(pumpkinBody, {
      x: vxPxPerS / MATTER_VELOCITY_SCALE,
      y: -vyPxPerS / MATTER_VELOCITY_SCALE,
    });
  }

  function launch() {
    if (phase !== PHASE_READY) {
      return;
    }
    var preview = computePreview();
    massAtLaunch = selectedMassKey;
    phase = PHASE_FLYING;
    flightElapsed = 0;
    lastSpeedMs = 0;
    settleTicks = 0;
    contactedTower = false;
    chart.reset();

    for (var i = 0; i < massButtons.length; i += 1) {
      massButtons[i].disabled = true;
    }
    forceInput.disabled = true;
    launchButton.disabled = true;

    spawnPumpkin(preview);
  }

  function handleMassClick(event) {
    if (phase !== PHASE_READY) {
      return;
    }
    selectedMassKey = event.currentTarget.getAttribute('data-level2-mass');
    updateMassButtonsUI();
  }

  function handleForceInput() {
    force = parseInt(forceInput.value, 10);
    updateForceLabel();
  }

  function handleMessageClick(event) {
    var button = event.target.closest ? event.target.closest('[data-level2-action]') : null;
    if (!button) {
      return;
    }
    var action = button.getAttribute('data-level2-action');
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
    if (phase !== PHASE_FLYING) {
      return;
    }

    Matter.Engine.update(engine, dt * 1000);
    flightElapsed += dt;
    updateToppleFlags();

    var speedPxPerS = Math.sqrt(
      pumpkinBody.velocity.x * pumpkinBody.velocity.x + pumpkinBody.velocity.y * pumpkinBody.velocity.y
    ) * MATTER_VELOCITY_SCALE;
    lastSpeedMs = speedPxPerS / cfg().PX_PER_M;

    var x = pumpkinBody.position.x;
    var y = pumpkinBody.position.y;
    var offScreen = x < -50 || x > canvas.width + 50;
    var nearGround = y >= groundY() - pumpkinRadiusPx - 2;
    var settled = nearGround && lastSpeedMs < SETTLE_SPEED_EPSILON_MS;
    settleTicks = settled ? settleTicks + 1 : 0;
    var timedOut = flightElapsed > FLIGHT_TIMEOUT_S;

    if (offScreen || settleTicks > SETTLE_TICKS_REQUIRED || timedOut) {
      resolveFlight();
    }
  }

  function drawBlocks() {
    ctx.fillStyle = 'rgba(120, 104, 140, 0.85)';
    for (var i = 0; i < blockLayout.length; i += 1) {
      var block = blockLayout[i];
      ctx.fillRect(block.x - block.w / 2, block.y - block.h / 2, block.w, block.h);
    }
  }

  function drawSkeletons() {
    for (var i = 0; i < skeletonStates.length; i += 1) {
      var state = skeletonStates[i];
      var pos = state.body.position;
      ctx.save();
      ctx.translate(pos.x, pos.y);
      ctx.rotate(state.body.angle);
      ctx.fillStyle = 'rgba(232, 227, 216, 0.95)';
      ctx.fillRect(-state.w / 2, -state.h / 2, state.w, state.h);
      ctx.beginPath();
      ctx.arc(0, -state.h / 2 - 6, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  function drawPumpkin() {
    if (!pumpkinBody) {
      return;
    }
    var pos = pumpkinBody.position;
    ctx.save();
    ctx.translate(pos.x, pos.y);
    ctx.rotate(pumpkinBody.angle);
    ctx.shadowColor = '#ff7518';
    ctx.shadowBlur = 16;
    ctx.fillStyle = '#ff7518';
    ctx.beginPath();
    ctx.arc(0, 0, pumpkinRadiusPx, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(26, 11, 46, 0.85)';
    ctx.beginPath();
    ctx.arc(-pumpkinRadiusPx * 0.35, -pumpkinRadiusPx * 0.15, pumpkinRadiusPx * 0.15, 0, Math.PI * 2);
    ctx.arc(pumpkinRadiusPx * 0.35, -pumpkinRadiusPx * 0.15, pumpkinRadiusPx * 0.15, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawCatapult() {
    var gy = groundY();
    ctx.fillStyle = '#4a2f1f';
    ctx.fillRect(CATAPULT_X_PX - 30, gy - 10, 60, 10);
    ctx.save();
    ctx.translate(CATAPULT_X_PX, gy - 10);
    ctx.rotate(-0.5);
    ctx.fillStyle = '#6b4530';
    ctx.fillRect(-6, -60, 12, 60);
    ctx.restore();
  }

  function drawScene() {
    var w = canvas.width;
    var h = canvas.height;
    var gy = groundY();

    var gradient = ctx.createLinearGradient(0, 0, 0, h);
    gradient.addColorStop(0, '#1a0b2e');
    gradient.addColorStop(1, '#0d0517');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = 'rgba(13, 5, 23, 0.9)';
    ctx.fillRect(0, gy, w, h - gy);

    drawCatapult();
    drawBlocks();
    drawSkeletons();
    drawPumpkin();
  }

  function render() {
    drawScene();
    if (phase === PHASE_READY) {
      var preview = computePreview();
      renderPreviewPanel(preview);
      renderFormula(preview);
    }
    if (phase === PHASE_FLYING) {
      chart.push(flightElapsed, lastSpeedMs);
    }
    statusEl.textContent = statusText();
  }

  function onEnter() {
    resetSim();
    updateTopBar();
    loop.start();
  }

  function onExit() {
    loop.stop();
  }

  function wire() {
    for (var i = 0; i < massButtons.length; i += 1) {
      massButtons[i].addEventListener('click', handleMassClick);
    }
    forceInput.addEventListener('input', handleForceInput);
    launchButton.addEventListener('click', launch);
    messageEl.addEventListener('click', handleMessageClick);
  }

  function init() {
    queryDom();
    wire();
    force = parseInt(forceInput.value, 10);
    updateForceLabel();
    updateMassButtonsUI();

    engine = Matter.Engine.create();
    engine.world.gravity.y = (cfg().GRAVITY * cfg().PX_PER_M) / MATTER_GRAVITY_PX_S2_PER_UNIT;
    Matter.Events.on(engine, 'collisionStart', handleCollisionStart);
    buildStaticWorld();

    chart = window.NM.chart.createLineChart(root.querySelector('[data-level2="chart"]'), {
      label: 'Velocidad',
      color: '#ff7518',
      xLabel: 'Tiempo (s)',
      yLabel: 'Velocidad (m/s)',
    });

    loop = window.NM.loop.createLoop({
      dt: window.NM.config.INTEGRATION.DT,
      maxFrameDt: window.NM.config.INTEGRATION.MAX_FRAME_DT,
      update: update,
      render: render,
    });

    window.NM.screens.registerLifecycle('level-2', { onEnter: onEnter, onExit: onExit });
  }

  window.NM = window.NM || {};
  window.NM.levels = window.NM.levels || {};
  window.NM.levels.level2 = { init: init };
})();
