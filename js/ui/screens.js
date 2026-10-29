/**
 * Navegación entre pantallas, modal "Cómo jugar" y tarjetas de nivel
 * (RF-01 a RF-06). Namespace: NM.screens
 */
(function () {
  'use strict';

  var LEVEL_TITLES = {
    1: 'El fantasma que no se detiene',
    2: 'Catapulta de calabazas',
    3: 'La bruja y su escoba',
  };
  var LEVEL_META = {
    1: { emoji: '👻', lawTag: '1ª Ley' },
    2: { emoji: '🎃', lawTag: '2ª Ley' },
    3: { emoji: '🧙‍♀️', lawTag: '3ª Ley' },
  };
  var LEVEL_IDS = [1, 2, 3];

  var screens = {};
  var activeModal = null;
  var lifecycles = {};
  var currentScreenId = null;

  function queryScreens() {
    var elements = document.querySelectorAll('[data-screen]');
    for (var i = 0; i < elements.length; i += 1) {
      screens[elements[i].getAttribute('data-screen')] = elements[i];
    }
  }

  /**
   * Muestra la pantalla indicada y oculta el resto. Si el id todavía no
   * existe en el DOM (pantallas de niveles de fases futuras), no hace nada.
   * @param {string} screenId
   */
  function navigateTo(screenId) {
    var target = screens[screenId];
    if (!target) {
      return;
    }
    if (currentScreenId && lifecycles[currentScreenId] && lifecycles[currentScreenId].onExit) {
      lifecycles[currentScreenId].onExit();
    }
    for (var id in screens) {
      screens[id].hidden = id !== screenId;
    }
    currentScreenId = screenId;
    window.NM.state.setState({ currentScreen: screenId });
    if (screenId === 'home') {
      renderLevelCards();
    }
    if (screenId === 'final') {
      renderFinalScreen();
    }
    if (lifecycles[screenId] && lifecycles[screenId].onEnter) {
      lifecycles[screenId].onEnter();
    }
  }

  /**
   * Registra callbacks de entrada/salida para una pantalla (usado por los
   * niveles para arrancar/detener su propio bucle de juego).
   * @param {string} screenId
   * @param {{onEnter?: function(): void, onExit?: function(): void}} hooks
   */
  function registerLifecycle(screenId, hooks) {
    lifecycles[screenId] = hooks;
  }

  function levelStatus(state, levelId) {
    if (state.levels[levelId].completed) {
      return 'completed';
    }
    return levelId <= state.unlockedLevel ? 'unlocked' : 'locked';
  }

  function starsMarkup(filledCount) {
    var markup = '';
    for (var i = 0; i < 3; i += 1) {
      markup += '<span class="card__star' + (i < filledCount ? ' card__star--filled' : '') + '">★</span>';
    }
    return markup;
  }

  function cardAction(levelId, status) {
    if (status === 'locked') {
      return (
        '<p class="card__hint">' +
        '<span class="material-symbols-outlined" aria-hidden="true">lock</span>' +
        ' Bloqueado espectral' +
        '</p>'
      );
    }
    var label = status === 'completed' ? 'Jugar de nuevo' : 'Jugar';
    var icon = status === 'completed' ? 'restart_alt' : 'play_arrow';
    return (
      '<button type="button" class="btn btn--primary" data-nav-to="level-' +
      levelId +
      '">' +
      '<span class="material-symbols-outlined" aria-hidden="true">' + icon + '</span> ' +
      label +
      '</button>'
    );
  }

  var STATUS_LABELS = {
    locked: 'Bloqueado espectral',
    unlocked: 'Disponible',
    completed: 'Completado',
  };

  function cardMarkup(levelId, status, levelState) {
    var meta = LEVEL_META[levelId];
    var formula = window.NM.content.laws[levelId].formula;
    var lockOverlay = status === 'locked' ?
      '<div class="level-card__lock"><span class="material-symbols-outlined" aria-hidden="true">lock</span></div>' :
      '';
    return (
      '<article class="level-card level-card--' + status + '">' +
      '<div class="level-card__thumb">' +
      meta.emoji +
      '<span class="level-card__law-tag">' + meta.lawTag + '</span>' +
      lockOverlay +
      '</div>' +
      '<div class="level-card__body">' +
      '<p class="card__eyebrow">Nivel ' + levelId + '</p>' +
      '<h3 class="card__title">' + LEVEL_TITLES[levelId] + '</h3>' +
      '<div class="card__stars">' + starsMarkup(levelState.stars) + '</div>' +
      '<p class="level-card__formula">' + formula + '</p>' +
      '<div class="level-card__footer">' +
      '<span class="level-card__status">' + STATUS_LABELS[status] + '</span>' +
      (status === 'locked' ? '' : cardAction(levelId, status)) +
      '</div>' +
      '</div>' +
      '</article>'
    );
  }

  /**
   * Reconstruye las 3 tarjetas de nivel según el estado actual (RF-02), junto
   * con el badge de progreso real del encabezado de la sección.
   */
  function renderLevelCards() {
    var container = document.querySelector('[data-level-cards]');
    if (!container) {
      return;
    }
    var state = window.NM.state.getState();
    var html = '';
    var completedCount = 0;
    for (var i = 0; i < LEVEL_IDS.length; i += 1) {
      var levelId = LEVEL_IDS[i];
      var status = levelStatus(state, levelId);
      if (status === 'completed') {
        completedCount += 1;
      }
      html += cardMarkup(levelId, status, state.levels[levelId]);
    }
    container.innerHTML = html;
    wireNavButtons(container);

    var badge = document.querySelector('[data-home="levels-progress"]');
    if (badge) {
      badge.textContent = completedCount + '/' + LEVEL_IDS.length + ' superados';
    }
  }

  function finalLevelCardMarkup(levelId, levelState) {
    return (
      '<article class="card card--completed">' +
      '<p class="card__eyebrow">Nivel ' + levelId + '</p>' +
      '<h3 class="card__title">' + LEVEL_TITLES[levelId] + '</h3>' +
      '<div class="card__stars">' + starsMarkup(levelState.stars) + '</div>' +
      '</article>'
    );
  }

  function lawCardMarkup(law) {
    return (
      '<article class="card final__law-card">' +
      '<h3 class="card__title">' + law.name + '</h3>' +
      '<p class="final__law-statement">' + law.statement + '</p>' +
      '<p class="final__law-formula">' + law.formula + '</p>' +
      '</article>'
    );
  }

  /**
   * Reconstruye la pantalla final: puntaje total, estrellas por nivel y
   * resumen de las tres leyes en tarjetas (RF-60).
   */
  function renderFinalScreen() {
    var state = window.NM.state.getState();

    var totalScoreEl = document.querySelector('[data-final="total-score"]');
    if (totalScoreEl) {
      totalScoreEl.textContent = state.totalScore;
    }

    var levelCardsEl = document.querySelector('[data-final="level-cards"]');
    if (levelCardsEl) {
      var levelsHtml = '';
      for (var i = 0; i < LEVEL_IDS.length; i += 1) {
        var levelId = LEVEL_IDS[i];
        levelsHtml += finalLevelCardMarkup(levelId, state.levels[levelId]);
      }
      levelCardsEl.innerHTML = levelsHtml;
    }

    var lawCardsEl = document.querySelector('[data-final="law-cards"]');
    if (lawCardsEl) {
      var lawsHtml = '';
      for (var j = 0; j < LEVEL_IDS.length; j += 1) {
        lawsHtml += lawCardMarkup(window.NM.content.laws[LEVEL_IDS[j]]);
      }
      lawCardsEl.innerHTML = lawsHtml;
    }
  }

  /**
   * Wirea "Jugar de nuevo" de la pantalla final: reinicia el progreso tras
   * confirmar y vuelve al inicio (RF-61).
   */
  function wireFinalReplay() {
    var replayButton = document.querySelector('[data-final-replay]');
    if (!replayButton) {
      return;
    }
    replayButton.addEventListener('click', function () {
      if (window.confirm('¿Seguro que desea borrar su progreso y jugar de nuevo desde el Nivel 1?')) {
        window.NM.state.resetProgress();
        navigateTo('home');
      }
    });
  }

  function handleNavClick(event) {
    navigateTo(event.currentTarget.getAttribute('data-nav-to'));
  }

  function wireNavButtons(scope) {
    var buttons = scope.querySelectorAll('[data-nav-to]');
    for (var i = 0; i < buttons.length; i += 1) {
      buttons[i].addEventListener('click', handleNavClick);
    }
  }

  function firstUnfinishedLevel(state) {
    for (var i = 0; i < LEVEL_IDS.length; i += 1) {
      if (!state.levels[LEVEL_IDS[i]].completed) {
        return LEVEL_IDS[i];
      }
    }
    return LEVEL_IDS[LEVEL_IDS.length - 1];
  }

  /**
   * Wirea el botón "Comenzar Aventura": lleva al primer nivel no completado (RF-03).
   */
  function wireStartButton() {
    var startButton = document.querySelector('[data-start-game]');
    if (!startButton) {
      return;
    }
    startButton.addEventListener('click', function () {
      navigateTo('level-' + firstUnfinishedLevel(window.NM.state.getState()));
    });
  }

  function levelMenuItemMarkup(levelId, status) {
    if (status === 'locked') {
      return (
        '<p class="level-menu__item level-menu__item--locked">' +
        'Nivel ' + levelId + ': ' + LEVEL_TITLES[levelId] +
        ' <span class="material-symbols-outlined" aria-hidden="true">lock</span>' +
        '</p>'
      );
    }
    return (
      '<button type="button" class="btn btn--ghost level-menu__item" data-nav-to="level-' +
      levelId +
      '" data-modal-close>' +
      'Nivel ' + levelId + ': ' + LEVEL_TITLES[levelId] +
      '</button>'
    );
  }

  /**
   * Reconstruye el listado del mapa de niveles (home + niveles 1-3) cada vez
   * que se abre el modal, respetando el mismo estado de bloqueo que las
   * tarjetas del inicio.
   */
  function renderLevelMenu() {
    var container = document.querySelector('[data-level-menu-list]');
    if (!container) {
      return;
    }
    var state = window.NM.state.getState();
    var html =
      '<button type="button" class="btn btn--ghost level-menu__item" data-nav-to="home" data-modal-close>' +
      '<span class="material-symbols-outlined" aria-hidden="true">home</span> Inicio' +
      '</button>';
    for (var i = 0; i < LEVEL_IDS.length; i += 1) {
      var levelId = LEVEL_IDS[i];
      html += levelMenuItemMarkup(levelId, levelStatus(state, levelId));
    }
    container.innerHTML = html;
    wireNavButtons(container);
    wireModalClosers(container);
  }

  function openModal(modalId) {
    var modal = document.querySelector('[data-modal="' + modalId + '"]');
    if (!modal) {
      return;
    }
    if (modalId === 'level-menu') {
      renderLevelMenu();
    }
    modal.hidden = false;
    activeModal = modal;
  }

  function closeModal() {
    if (!activeModal) {
      return;
    }
    activeModal.hidden = true;
    activeModal = null;
  }

  function handleModalOpenClick(event) {
    openModal(event.currentTarget.getAttribute('data-modal-open'));
  }

  function handleKeydown(event) {
    if (event.key === 'Escape') {
      closeModal();
    }
  }

  function wireModalClosers(scope) {
    var closers = scope.querySelectorAll('[data-modal-close]');
    for (var j = 0; j < closers.length; j += 1) {
      closers[j].addEventListener('click', closeModal);
    }
  }

  /**
   * Wirea apertura/cierre del modal: botón, backdrop y tecla Esc (RF-04).
   */
  function wireModals() {
    var openers = document.querySelectorAll('[data-modal-open]');
    for (var i = 0; i < openers.length; i += 1) {
      openers[i].addEventListener('click', handleModalOpenClick);
    }
    wireModalClosers(document);
    var backdrops = document.querySelectorAll('.modal__backdrop');
    for (var k = 0; k < backdrops.length; k += 1) {
      backdrops[k].addEventListener('click', closeModal);
    }
    document.addEventListener('keydown', handleKeydown);
  }

  /**
   * Wirea el botón "Reiniciar progreso" de la pantalla de créditos (RF-06).
   */
  function wireResetProgress() {
    var resetButton = document.querySelector('[data-reset-progress]');
    if (!resetButton) {
      return;
    }
    resetButton.addEventListener('click', function () {
      if (window.confirm('¿Seguro que desea borrar todo su progreso?')) {
        window.NM.state.resetProgress();
        renderLevelCards();
      }
    });
  }

  function renderSoundToggle(button, isOn) {
    var icon = isOn ? 'volume_up' : 'volume_off';
    button.innerHTML = '<span class="material-symbols-outlined" aria-hidden="true">' + icon + '</span>';
    button.setAttribute('aria-label', isOn ? 'Silenciar sonido' : 'Activar sonido');
  }

  /**
   * Wirea el botón de silenciar/activar sonido, visible en todas las pantallas (RF-05).
   */
  function wireSoundToggle() {
    var button = document.querySelector('[data-sound-toggle]');
    if (!button) {
      return;
    }
    renderSoundToggle(button, window.NM.state.getState().soundOn);
    button.addEventListener('click', function () {
      var next = !window.NM.state.getState().soundOn;
      window.NM.state.setState({ soundOn: next });
      renderSoundToggle(button, next);
    });
  }

  /**
   * Inicializa pantallas, modal y controles persistentes. Se llama una sola
   * vez al arrancar la aplicación.
   */
  function init() {
    queryScreens();
    wireNavButtons(document);
    wireStartButton();
    wireModals();
    wireResetProgress();
    wireFinalReplay();
    wireSoundToggle();
    navigateTo(window.NM.state.getState().currentScreen);
  }

  window.NM = window.NM || {};
  window.NM.screens = {
    init: init,
    navigateTo: navigateTo,
    registerLifecycle: registerLifecycle,
    openModal: openModal,
    closeModal: closeModal,
  };
})();
