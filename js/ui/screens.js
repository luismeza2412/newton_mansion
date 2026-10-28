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
      return '<p class="card__hint">Bloqueado espectral</p>';
    }
    var label = status === 'completed' ? 'Jugar de nuevo' : 'Jugar';
    return (
      '<button type="button" class="btn btn--primary" data-nav-to="level-' +
      levelId +
      '">' +
      label +
      '</button>'
    );
  }

  function cardMarkup(levelId, status, levelState) {
    return (
      '<article class="card card--' + status + '">' +
      '<p class="card__eyebrow">Nivel ' + levelId + '</p>' +
      '<h3 class="card__title">' + LEVEL_TITLES[levelId] + '</h3>' +
      '<div class="card__stars">' + starsMarkup(levelState.stars) + '</div>' +
      cardAction(levelId, status) +
      '</article>'
    );
  }

  /**
   * Reconstruye las 3 tarjetas de nivel según el estado actual (RF-02).
   */
  function renderLevelCards() {
    var container = document.querySelector('[data-level-cards]');
    if (!container) {
      return;
    }
    var state = window.NM.state.getState();
    var html = '';
    for (var i = 0; i < LEVEL_IDS.length; i += 1) {
      var levelId = LEVEL_IDS[i];
      html += cardMarkup(levelId, levelStatus(state, levelId), state.levels[levelId]);
    }
    container.innerHTML = html;
    wireNavButtons(container);
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
      if (window.confirm('¿Seguro que querés borrar tu progreso y jugar de nuevo desde el Nivel 1?')) {
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

  function openModal(modalId) {
    var modal = document.querySelector('[data-modal="' + modalId + '"]');
    if (!modal) {
      return;
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

  /**
   * Wirea apertura/cierre del modal: botón, backdrop y tecla Esc (RF-04).
   */
  function wireModals() {
    var openers = document.querySelectorAll('[data-modal-open]');
    for (var i = 0; i < openers.length; i += 1) {
      openers[i].addEventListener('click', handleModalOpenClick);
    }
    var closers = document.querySelectorAll('[data-modal-close]');
    for (var j = 0; j < closers.length; j += 1) {
      closers[j].addEventListener('click', closeModal);
    }
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
      if (window.confirm('¿Seguro que querés borrar todo tu progreso?')) {
        window.NM.state.resetProgress();
        renderLevelCards();
      }
    });
  }

  function renderSoundToggle(button, isOn) {
    button.textContent = isOn ? '🔊' : '🔇';
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
