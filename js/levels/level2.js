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
    'too-weak': 'La calabaza cayó antes de llegar a la torre: hay que probar con más fuerza o una calabaza más liviana.',
    'too-strong': 'La calabaza pasó de largo sin golpear la torre: hay que probar con menos fuerza o una calabaza más pesada.',
    'no-topple': 'El golpe no derribó al menos 3 esqueletos: hay que ajustar la combinación de masa y fuerza.',
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
  var TOWER_CORE_INDEX = 1;
  var TOWER_ROMAN = ['I', 'II', 'III', 'IV', 'V'];

  var root, stageEl, catapultEl, pumpkinEl, towerLabelEl;
  var massButtons, forceInput, forceValueEl, launchButton;
  var topbarEl, telemetryEl, statusEl, messageEl, formulaEl;
  var loop = null;
  var chart = null;
  var blockEls = [];
  var skeletonEls = [];

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
    stageEl = root.querySelector('[data-level2="stage"]');
    catapultEl = root.querySelector('[data-level2="catapult"]');
    pumpkinEl = root.querySelector('[data-level2="pumpkin"]');
    towerLabelEl = root.querySelector('[data-level2="tower-label"]');
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
    return window.NM.config.ENGINE.CANVAS_HEIGHT * 0.75;
  }

  /** Convierte una coordenada x del mundo (px) a % de ancho del stage. */
  function toPercentX(px) {
    return (px / window.NM.config.ENGINE.CANVAS_WIDTH) * 100;
  }

  /** Convierte una coordenada y del mundo (px) a % de alto del stage. */
  function toPercentY(px) {
    return (px / window.NM.config.ENGINE.CANVAS_HEIGHT) * 100;
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

    var canvasWidthPx = window.NM.config.ENGINE.CANVAS_WIDTH;
    var groundBody = Matter.Bodies.rectangle(canvasWidthPx / 2, groundY() + 20, canvasWidthPx, 40, {
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

  /**
   * Posiciona la catapulta y el rótulo de la torre, y crea los elementos DOM
   * de bloques y esqueletos a partir de la geometría de `buildStaticWorld`.
   * Se llama una sola vez en `init`.
   */
  function layoutStage() {
    var blockHPx = cfg().BLOCK_HEIGHT_M * cfg().PX_PER_M;

    catapultEl.style.left = toPercentX(CATAPULT_X_PX) + '%';
    catapultEl.style.top = toPercentY(groundY()) + '%';

    towerLabelEl.style.left = toPercentX(towerCenterXPx()) + '%';
    towerLabelEl.style.top = toPercentY(groundY() - blockHPx * TOWER_ROWS) + '%';

    blockEls = [];
    var romanIdx = 0;
    for (var i = 0; i < blockLayout.length; i += 1) {
      var block = blockLayout[i];
      var isCore = i === TOWER_CORE_INDEX;
      var blockEl = document.createElement('div');
      blockEl.className = isCore ? 'level2-block level2-block--core' : 'level2-block';
      blockEl.textContent = isCore ? 'NÚCLEO' : TOWER_ROMAN[romanIdx];
      if (!isCore) {
        romanIdx += 1;
      }
      blockEl.style.left = toPercentX(block.x) + '%';
      blockEl.style.top = toPercentY(block.y) + '%';
      blockEl.style.width = toPercentX(block.w) + '%';
      blockEl.style.height = toPercentY(block.h) + '%';
      stageEl.insertBefore(blockEl, pumpkinEl);
      blockEls.push(blockEl);
    }

    skeletonEls = [];
    for (var j = 0; j < skeletonStates.length; j += 1) {
      var state = skeletonStates[j];
      var skeletonEl = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      skeletonEl.setAttribute('class', 'level2-skeleton');
      skeletonEl.setAttribute('viewBox', '0 0 100 100');
      skeletonEl.style.width = toPercentX(state.w) + '%';
      skeletonEl.style.height = toPercentY(state.h) + '%';
      var skullGlyph = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      skullGlyph.setAttribute('class', 'level2-skeleton__glyph');
      skullGlyph.setAttribute('x', '50');
      skullGlyph.setAttribute('y', '70');
      skullGlyph.setAttribute('text-anchor', 'middle');
      skullGlyph.textContent = '💀';
      skeletonEl.appendChild(skullGlyph);
      stageEl.insertBefore(skeletonEl, pumpkinEl);
      skeletonEls.push(skeletonEl);
    }
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
    catapultEl.classList.remove('level2-catapult--firing');
    for (var i = 0; i < massButtons.length; i += 1) {
      massButtons[i].disabled = false;
    }
    forceInput.disabled = false;
    launchButton.disabled = false;
    messageEl.hidden = true;
    messageEl.innerHTML = '';
    chart.reset();
    updateMassButtonsUI();
    renderStage();
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
    catapultEl.classList.add('level2-catapult--firing');

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
    var offScreen = x < -50 || x > window.NM.config.ENGINE.CANVAS_WIDTH + 50;
    var nearGround = y >= groundY() - pumpkinRadiusPx - 2;
    var settled = nearGround && lastSpeedMs < SETTLE_SPEED_EPSILON_MS;
    settleTicks = settled ? settleTicks + 1 : 0;
    var timedOut = flightElapsed > FLIGHT_TIMEOUT_S;

    if (offScreen || settleTicks > SETTLE_TICKS_REQUIRED || timedOut) {
      resolveFlight();
    }
  }

  /**
   * Refleja el estado físico (posiciones/ángulos de Matter.js) en los
   * elementos DOM del stage. Se llama cada frame y una vez al final de
   * `resetSim` para feedback visual inmediato.
   */
  function renderStage() {
    for (var i = 0; i < skeletonStates.length; i += 1) {
      var state = skeletonStates[i];
      var el = skeletonEls[i];
      var pos = state.body.position;
      el.style.left = toPercentX(pos.x) + '%';
      el.style.top = toPercentY(pos.y) + '%';
      el.style.transform = 'translate(-50%, -50%) rotate(' + state.body.angle + 'rad)';
      el.classList.toggle('level2-skeleton--toppled', state.toppled);
    }

    if (pumpkinBody) {
      var ppos = pumpkinBody.position;
      pumpkinEl.style.left = toPercentX(ppos.x) + '%';
      pumpkinEl.style.top = toPercentY(ppos.y) + '%';
      pumpkinEl.style.width = toPercentX(pumpkinRadiusPx * 2) + '%';
      pumpkinEl.style.height = toPercentY(pumpkinRadiusPx * 2) + '%';
      pumpkinEl.style.transform = 'translate(-50%, -50%) rotate(' + pumpkinBody.angle + 'rad)';
    } else {
      var radiusM = radiusForKey(selectedMassKey);
      var radiusPx = radiusM * cfg().PX_PER_M;
      var yPx = groundY() - LAUNCH_HEIGHT_M * cfg().PX_PER_M;
      pumpkinEl.style.left = toPercentX(CATAPULT_X_PX) + '%';
      pumpkinEl.style.top = toPercentY(yPx) + '%';
      pumpkinEl.style.width = toPercentX(radiusPx * 2) + '%';
      pumpkinEl.style.height = toPercentY(radiusPx * 2) + '%';
      pumpkinEl.style.transform = 'translate(-50%, -50%)';
    }
  }

  function render() {
    renderStage();
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
    layoutStage();

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
