/**
 * Sonidos simples sintetizados con Web Audio API (RF-05, Fase 8). Respeta
 * el silencio global en `NM.state` y no depende de archivos de audio.
 * Namespace: NM.audio
 */
(function () {
  'use strict';

  var audioCtx = null;

  function getContext() {
    var AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) {
      return null;
    }
    if (!audioCtx) {
      audioCtx = new AudioContextClass();
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    return audioCtx;
  }

  function playTone(ctx, preset) {
    var now = ctx.currentTime;
    var oscillator = ctx.createOscillator();
    var gainNode = ctx.createGain();
    oscillator.type = preset.type;
    oscillator.frequency.setValueAtTime(preset.freq, now);
    oscillator.frequency.linearRampToValueAtTime(preset.freqEnd, now + preset.duration);
    gainNode.gain.setValueAtTime(preset.gain, now);
    gainNode.gain.exponentialRampToValueAtTime(0.001, now + preset.duration);
    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);
    oscillator.start(now);
    oscillator.stop(now + preset.duration);
  }

  /**
   * Reproduce un sonido sintetizado si el sonido está activado. No hace nada
   * si el navegador no soporta Web Audio API o si `name` no existe.
   * @param {'click'|'launch'|'win'|'lose'} name
   */
  function play(name) {
    if (!window.NM.state.getState().soundOn) {
      return;
    }
    var preset = window.NM.config.AUDIO[name.toUpperCase()];
    if (!preset) {
      return;
    }
    var ctx = getContext();
    if (!ctx) {
      return;
    }
    playTone(ctx, preset);
  }

  function init() {
    // El AudioContext se crea en el primer play(), recién tras una
    // interacción del usuario, por la política de autoplay del navegador.
  }

  window.NM = window.NM || {};
  window.NM.audio = { init: init, play: play };
})();
