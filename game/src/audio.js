// All sound is synthesized with WebAudio — no audio files. A soft
// tropical pad loops under the city, engines hum with speed, sirens
// wail two-tone, and short blips mark shots, pickups and paydays.

export function createAudio() {
  let ctx = null;
  let master = null;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let started = false;

  function ensure() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return true; }
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
    } catch { return false; }
    master = ctx.createGain();
    master.gain.value = 0.5;
    master.connect(ctx.destination);
    startPad();
    startEngine();
    startSiren();
    started = true;
    return true;
  }

  function startPad() {
    // Slow detuned triangle chords — sunset over the bay.
    const gain = ctx.createGain();
    gain.gain.value = 0.035;
    gain.connect(master);
    const freqs = [130.81, 196.0, 261.63];
    for (const f of freqs) {
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.value = f;
      osc.detune.value = Math.random() * 8 - 4;
      osc.connect(gain);
      osc.start();
    }
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.07;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.015;
    lfo.connect(lfoGain);
    lfoGain.connect(gain.gain);
    lfo.start();
  }

  function startEngine() {
    engineOsc = ctx.createOscillator();
    engineOsc.type = 'sawtooth';
    engineOsc.frequency.value = 40;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 320;
    engineGain = ctx.createGain();
    engineGain.gain.value = 0;
    engineOsc.connect(filter);
    filter.connect(engineGain);
    engineGain.connect(master);
    engineOsc.start();
  }

  function startSiren() {
    sirenOsc = ctx.createOscillator();
    sirenOsc.type = 'sine';
    sirenOsc.frequency.value = 700;
    sirenGain = ctx.createGain();
    sirenGain.gain.value = 0;
    sirenOsc.connect(sirenGain);
    sirenGain.connect(master);
    sirenOsc.start();
  }

  function blip(freq, seconds, type = 'square', volume = 0.16, slideTo = null) {
    if (!ensure()) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, ctx.currentTime + seconds);
    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + seconds);
    osc.connect(gain);
    gain.connect(master);
    osc.start();
    osc.stop(ctx.currentTime + seconds);
  }

  return {
    unlock() { ensure(); },
    get started() { return started; },
    shot() { blip(190, 0.09, 'square', 0.12, 60); },
    hit() { blip(90, 0.12, 'sawtooth', 0.14, 45); },
    pickup() { blip(660, 0.16, 'sine', 0.18, 990); },
    cash() { blip(880, 0.1, 'sine', 0.16); setTimeout(() => blip(1320, 0.18, 'sine', 0.16), 70); },
    missionDone() { [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => blip(f, 0.22, 'triangle', 0.2), i * 95)); },
    busted() { blip(320, 0.7, 'sawtooth', 0.18, 70); },
    wasted() { blip(220, 0.9, 'triangle', 0.2, 55); },
    door() { blip(240, 0.08, 'sine', 0.12, 180); },
    setEngine(speedRatio, driving) {
      if (!ctx || !engineOsc) return;
      engineOsc.frequency.value = 42 + Math.abs(speedRatio) * 120;
      engineGain.gain.value = driving ? 0.05 + Math.abs(speedRatio) * 0.05 : 0;
    },
    setSiren(active, time) {
      if (!ctx || !sirenOsc) return;
      sirenGain.gain.value = active ? 0.028 : 0;
      if (active) sirenOsc.frequency.value = 660 + Math.sin(time * 5.2) * 190;
    },
  };
}
