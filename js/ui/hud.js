/**
 * HUD genérico de los niveles (RF-10, RF-14): barra superior y panel de
 * datos en vivo. No conoce reglas de ningún nivel en particular; recibe los
 * valores ya calculados y solo se encarga de pintarlos. Namespace: NM.hud
 */
(function () {
  'use strict';

  /**
   * Pinta la barra superior de un nivel: nombre, puntaje e intentos (o el
   * contador que indique `attemptLabel`, p. ej. "Lanzamiento" en el Nivel 3).
   * @param {HTMLElement} el - Contenedor de la barra superior.
   * @param {{levelId: number, title: string, score: number, attemptNumber: number, maxAttempts: number, attemptLabel: (string|undefined)}} info
   */
  function renderTopBar(el, info) {
    var label = info.attemptLabel || 'Intento';
    el.innerHTML =
      '<span class="hud__title">Nivel ' + info.levelId + ' · ' + info.title + '</span>' +
      '<span class="hud__score">Puntaje: ' + info.score + '</span>' +
      '<span class="hud__attempts">' + label + ' ' + info.attemptNumber + ' / ' + info.maxAttempts + '</span>';
  }

  /**
   * Pinta el panel de "datos en vivo" con una fila por variable (RF-14).
   * @param {HTMLElement} el - Contenedor del panel.
   * @param {Array<{label: string, value: string, unit: string}>} fields
   */
  function renderDataPanel(el, fields) {
    var html = '';
    for (var i = 0; i < fields.length; i += 1) {
      html +=
        '<div class="hud__field">' +
        '<span class="hud__field-label">' + fields[i].label + '</span>' +
        '<span class="hud__field-value">' + fields[i].value + ' <small>' + fields[i].unit + '</small></span>' +
        '</div>';
    }
    el.innerHTML = html;
  }

  window.NM = window.NM || {};
  window.NM.hud = { renderTopBar: renderTopBar, renderDataPanel: renderDataPanel };
})();
