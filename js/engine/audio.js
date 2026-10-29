/**
 * Sonidos de terror sintetizados con Web Audio API (RF-05, Fase 8). Respeta
 * el silencio global en `NM.state` y no depende de archivos de audio.
 * Incluye un ambiente (dron + viento) siempre sonando mientras soundOn = true.
 * Namespace: NM.audio
 */
(function () {
  'use strict';

  var audioCtx = null;
  var masterGain = null;
  var ambientStarted = false;
  var noiseBuffer = null;

  function getContext() {
    var AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) {
      return null;
    }
    if (!audioCtx) {
      audioCtx = new AudioContextClass();
      masterGain = audioCtx.createGain();
      masterGain.gain.value = window.NM.state.getState().soundOn ? 1 : 0;
      masterGain.connect(audioCtx.destination);
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    return audioCtx;
  }

  function applyMute() {
    if (!audioCtx || !masterGain) {
      return;
    }
    var target = window.NM.state.getState().soundOn ? 1 : 0;
    masterGain.gain.setTargetAtTime(target, audioCtx.currentTime, 0.08);
  }

  function getNoiseBuffer(ctx) {
    if (!noiseBuffer || noiseBuffer.sampleRate !== ctx.sampleRate) {
      noiseBuffer = createNoiseBuffer(ctx, 4);
    }
    return noiseBuffer;
  }

  function createNoiseBuffer(ctx, seconds) {
    var buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * seconds), ctx.sampleRate);
    var data = buffer.getChannelData(0);
    for (var i = 0; i < data.length; i += 1) {
      data[i] = Math.random() * 2 - 1;
    }
    return buffer;
  }

  function ensureAmbientStarted(ctx) {
    if (ambientStarted) {
      return;
    }
    ambientStarted = true;
    startAmbient(ctx, masterGain);
  }

  function startAmbient(ctx, dest) {
    var cfg = window.NM.config.AUDIO.AMBIENT;
    startDrone(ctx, dest, cfg);
    startWhistle(ctx, dest, cfg);
    startWhisperBed(ctx, dest, cfg);
    scheduleWhisperBurst(ctx, dest, cfg);
  }

  function startDrone(ctx, dest, cfg) {
    var droneFilter = ctx.createBiquadFilter();
    droneFilter.type = 'lowpass';
    droneFilter.frequency.value = (cfg.FILTER_MIN + cfg.FILTER_MAX) / 2;
    droneFilter.Q.value = 0.7;

    var droneGain = ctx.createGain();
    droneGain.gain.value = cfg.DRONE_GAIN;

    var oscLow = ctx.createOscillator();
    oscLow.type = 'sine';
    oscLow.frequency.value = cfg.DRONE_FREQ_LOW;
    var oscMid = ctx.createOscillator();
    oscMid.type = 'sine';
    oscMid.frequency.value = cfg.DRONE_FREQ_MID;

    oscLow.connect(droneFilter);
    oscMid.connect(droneFilter);
    droneFilter.connect(droneGain);
    droneGain.connect(dest);

    var filterLfo = ctx.createOscillator();
    filterLfo.type = 'sine';
    filterLfo.frequency.value = cfg.FILTER_LFO_HZ;
    var filterLfoDepth = ctx.createGain();
    filterLfoDepth.gain.value = (cfg.FILTER_MAX - cfg.FILTER_MIN) / 2;
    filterLfo.connect(filterLfoDepth);
    filterLfoDepth.connect(droneFilter.frequency);

    oscLow.start();
    oscMid.start();
    filterLfo.start();
  }

  function startWhistle(ctx, dest, cfg) {
    var osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = cfg.WHISTLE_FREQ_BASE;

    var gain = ctx.createGain();
    gain.gain.value = cfg.WHISTLE_GAIN;
    osc.connect(gain);
    gain.connect(dest);

    var drift1 = ctx.createOscillator();
    drift1.type = 'sine';
    drift1.frequency.value = cfg.WHISTLE_DRIFT_HZ_1;
    var drift1Depth = ctx.createGain();
    drift1Depth.gain.value = cfg.WHISTLE_DRIFT_DEPTH_1;
    drift1.connect(drift1Depth);
    drift1Depth.connect(osc.frequency);

    var drift2 = ctx.createOscillator();
    drift2.type = 'sine';
    drift2.frequency.value = cfg.WHISTLE_DRIFT_HZ_2;
    var drift2Depth = ctx.createGain();
    drift2Depth.gain.value = cfg.WHISTLE_DRIFT_DEPTH_2;
    drift2.connect(drift2Depth);
    drift2Depth.connect(osc.frequency);

    var tremolo = ctx.createOscillator();
    tremolo.type = 'sine';
    tremolo.frequency.value = cfg.WHISTLE_TREMOLO_HZ;
    var tremoloDepth = ctx.createGain();
    tremoloDepth.gain.value = cfg.WHISTLE_TREMOLO_DEPTH;
    tremolo.connect(tremoloDepth);
    tremoloDepth.connect(gain.gain);

    osc.start();
    drift1.start();
    drift2.start();
    tremolo.start();
  }

  function connectFormant(ctx, source, dest, freq, modHz, cfg) {
    var filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = freq;
    filter.Q.value = cfg.WHISPER_FORMANT_Q;
    source.connect(filter);
    filter.connect(dest);

    var mod = ctx.createOscillator();
    mod.type = 'sine';
    mod.frequency.value = modHz;
    var modDepth = ctx.createGain();
    modDepth.gain.value = cfg.WHISPER_MOD_DEPTH;
    mod.connect(modDepth);
    modDepth.connect(filter.frequency);
    mod.start();
  }

  function startWhisperBed(ctx, dest, cfg) {
    var noise = ctx.createBufferSource();
    noise.buffer = getNoiseBuffer(ctx);
    noise.loop = true;

    var bedGain = ctx.createGain();
    bedGain.gain.value = cfg.WHISPER_GAIN;

    connectFormant(ctx, noise, bedGain, cfg.WHISPER_FORMANT_1, cfg.WHISPER_MOD_HZ_1, cfg);
    connectFormant(ctx, noise, bedGain, cfg.WHISPER_FORMANT_2, cfg.WHISPER_MOD_HZ_2, cfg);
    connectFormant(ctx, noise, bedGain, cfg.WHISPER_FORMANT_3, cfg.WHISPER_MOD_HZ_3, cfg);

    var envelopeLfo = ctx.createOscillator();
    envelopeLfo.type = 'sine';
    envelopeLfo.frequency.value = cfg.WHISPER_ENVELOPE_HZ;
    var envelopeDepth = ctx.createGain();
    envelopeDepth.gain.value = cfg.WHISPER_ENVELOPE_DEPTH;
    envelopeLfo.connect(envelopeDepth);
    envelopeDepth.connect(bedGain.gain);

    var echoDelay = ctx.createDelay(2);
    echoDelay.delayTime.value = cfg.ECHO_DELAY_S;
    var echoFeedback = ctx.createGain();
    echoFeedback.gain.value = cfg.ECHO_FEEDBACK;
    bedGain.connect(dest);
    bedGain.connect(echoDelay);
    echoDelay.connect(echoFeedback);
    echoFeedback.connect(echoDelay);
    echoDelay.connect(dest);

    noise.start();
    envelopeLfo.start();
  }

  function scheduleWhisperBurst(ctx, dest, cfg) {
    var wait =
      cfg.WHISPER_BURST_MIN_INTERVAL + Math.random() * (cfg.WHISPER_BURST_MAX_INTERVAL - cfg.WHISPER_BURST_MIN_INTERVAL);
    setTimeout(function () {
      playWhisperBurst(ctx, dest, cfg);
      scheduleWhisperBurst(ctx, dest, cfg);
    }, wait * 1000);
  }

  function playWhisperBurst(ctx, dest, cfg) {
    var now = ctx.currentTime;
    var source = ctx.createBufferSource();
    source.buffer = getNoiseBuffer(ctx);
    var filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.Q.value = cfg.WHISPER_FORMANT_Q;
    filter.frequency.setValueAtTime(cfg.WHISPER_FORMANT_1, now);
    filter.frequency.linearRampToValueAtTime(cfg.WHISPER_FORMANT_3, now + cfg.WHISPER_BURST_DURATION * 0.55);
    filter.frequency.linearRampToValueAtTime(cfg.WHISPER_FORMANT_1, now + cfg.WHISPER_BURST_DURATION);
    var gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(cfg.WHISPER_BURST_GAIN, now + cfg.WHISPER_BURST_DURATION * 0.35);
    gain.gain.linearRampToValueAtTime(0.0001, now + cfg.WHISPER_BURST_DURATION);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(dest);
    source.start(now);
    source.stop(now + cfg.WHISPER_BURST_DURATION + 0.05);
  }

  function synthClick(ctx, dest, p) {
    var now = ctx.currentTime;
    var osc = ctx.createOscillator();
    osc.type = p.type;
    osc.frequency.setValueAtTime(p.freq, now);
    var gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(p.gain, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + p.duration);
    osc.connect(gain);
    gain.connect(dest);
    osc.start(now);
    osc.stop(now + p.duration + 0.02);
  }

  function synthWhoosh(ctx, dest, p) {
    var now = ctx.currentTime;
    var source = ctx.createBufferSource();
    source.buffer = getNoiseBuffer(ctx);
    var filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.Q.value = 0.8;
    filter.frequency.setValueAtTime(p.filterStart, now);
    filter.frequency.exponentialRampToValueAtTime(p.filterEnd, now + p.duration);
    var gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(p.gain, now + p.duration * 0.3);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + p.duration);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(dest);
    source.start(now);
    source.stop(now + p.duration + 0.05);
  }

  function playBellPartial(ctx, dest, now, freq, peak, duration) {
    var osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now);
    var gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(peak, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.connect(gain);
    gain.connect(dest);
    osc.start(now);
    osc.stop(now + duration + 0.05);
  }

  function synthBell(ctx, dest, p) {
    var now = ctx.currentTime;
    playBellPartial(ctx, dest, now, p.f1, p.gain, p.duration);
    playBellPartial(ctx, dest, now, p.f2, p.gain * 0.55, p.duration * 0.85);
  }

  function playGrowlVoice(ctx, dest, now, freqStart, freqEnd, duration, peak, type) {
    var osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freqStart, now);
    osc.frequency.exponentialRampToValueAtTime(Math.max(freqEnd, 1), now + duration);
    var filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 500;
    var gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(peak, now + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(dest);
    osc.start(now);
    osc.stop(now + duration + 0.05);
  }

  function synthGrowl(ctx, dest, p) {
    var now = ctx.currentTime;
    playGrowlVoice(ctx, dest, now, p.freqStart, p.freqEnd, p.duration, p.gain, p.type);
    playGrowlVoice(ctx, dest, now, p.freqStart + p.detune, p.freqEnd + p.detune, p.duration, p.gain * 0.7, p.type);
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
    var key = name.toUpperCase();
    var preset = window.NM.config.AUDIO[key];
    if (!preset) {
      return;
    }
    var ctx = getContext();
    if (!ctx) {
      return;
    }
    ensureAmbientStarted(ctx);
    if (key === 'WIN') {
      synthBell(ctx, masterGain, preset);
    } else if (key === 'LOSE') {
      synthGrowl(ctx, masterGain, preset);
    } else if (key === 'LAUNCH') {
      synthWhoosh(ctx, masterGain, preset);
    } else if (key === 'CLICK') {
      synthClick(ctx, masterGain, preset);
    }
  }

  function unlock() {
    document.removeEventListener('pointerdown', unlock);
    document.removeEventListener('keydown', unlock);
    var ctx = getContext();
    if (ctx) {
      ensureAmbientStarted(ctx);
    }
  }

  function init() {
    // El AudioContext y el ambiente se crean recién tras la primera
    // interacción del usuario, por la política de autoplay del navegador.
    document.addEventListener('pointerdown', unlock);
    document.addEventListener('keydown', unlock);
    window.NM.state.subscribe(applyMute);
  }

  window.NM = window.NM || {};
  window.NM.audio = { init: init, play: play };
})();
