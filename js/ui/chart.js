/**
 * Envoltorio genérico sobre Chart.js para gráficas de línea en vivo
 * (RF-35). No conoce reglas de ningún nivel. Namespace: NM.chart
 */
(function () {
  'use strict';

  /**
   * Crea una gráfica de línea vacía, lista para recibir puntos con `push`.
   * @param {HTMLCanvasElement} canvasEl
   * @param {{label: string, color: string, xLabel: string, yLabel: string}} options
   * @returns {{push: function(number, number): void, reset: function(): void}}
   */
  function createLineChart(canvasEl, options) {
    var chart = new Chart(canvasEl.getContext('2d'), {
      type: 'line',
      data: {
        labels: [],
        datasets: [
          {
            label: options.label,
            data: [],
            borderColor: options.color,
            backgroundColor: 'transparent',
            borderWidth: 2,
            tension: 0.25,
            pointRadius: 0,
          },
        ],
      },
      options: {
        animation: false,
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: { title: { display: true, text: options.xLabel } },
          y: { title: { display: true, text: options.yLabel }, beginAtZero: true },
        },
        plugins: { legend: { display: false } },
      },
    });

    function push(x, y) {
      chart.data.labels.push(x.toFixed(2));
      chart.data.datasets[0].data.push(y);
      chart.update();
    }

    function reset() {
      chart.data.labels = [];
      chart.data.datasets[0].data = [];
      chart.update();
    }

    return { push: push, reset: reset };
  }

  window.NM = window.NM || {};
  window.NM.chart = { createLineChart: createLineChart };
})();
