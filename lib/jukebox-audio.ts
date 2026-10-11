/** One HTML media element and one optional gain node; never preload a playlist. */
export class JukeboxAudio {
  readonly audio: HTMLAudioElement;
  private context: AudioContext | null = null;
  private gain: GainNode | null = null;
  private volume: number;
  private ticket = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private fadeResolve: (() => void) | null = null;
  private fallbackTimer: ReturnType<typeof setInterval> | null = null;
  wantedPlaying = false;

  constructor(audio: HTMLAudioElement, volume: number) {
    this.audio = audio;
    this.volume = volume;
    audio.preload = 'metadata';
    audio.volume = volume;
  }
  private graph() {
    if (this.context) return;
    const Context = window.AudioContext ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Context) return;
    try {
      const context = new Context(), gain = context.createGain();
      context.createMediaElementSource(this.audio).connect(gain);
      gain.connect(context.destination);
      this.context = context; this.gain = gain;
      this.audio.volume = 1;
      gain.gain.value = this.volume;
    } catch { /* Native media playback remains the fallback when Web Audio is unavailable. */ }
  }
  private cancelFade() {
    if (this.timer) clearTimeout(this.timer);
    if (this.fallbackTimer) clearInterval(this.fallbackTimer);
    this.timer = null; this.fallbackTimer = null;
    const resolve = this.fadeResolve; this.fadeResolve = null; resolve?.();
    if (this.context && this.gain) this.gain.gain.cancelAndHoldAtTime?.(this.context.currentTime);
  }
  private level(value: number) {
    if (this.gain && this.context) {
      this.gain.gain.cancelScheduledValues(this.context.currentTime);
      this.gain.gain.setValueAtTime(value, this.context.currentTime);
    } else this.audio.volume = value;
  }
  private fade(target: number, milliseconds: number): Promise<void> {
    this.cancelFade();
    if (this.context && this.gain) {
      const now = this.context.currentTime;
      this.gain.gain.setValueAtTime(this.gain.gain.value, now);
      this.gain.gain.linearRampToValueAtTime(target, now + milliseconds / 1000);
    } else {
      const start = this.audio.volume, began = performance.now();
      this.fallbackTimer = setInterval(() => {
        const progress = Math.min(1, (performance.now() - began) / milliseconds);
        this.audio.volume = start + (target - start) * progress;
      }, 40);
    }
    return new Promise(resolve => {
      this.fadeResolve = resolve;
      this.timer = setTimeout(() => {
        if (this.fallbackTimer) clearInterval(this.fallbackTimer);
        this.fallbackTimer = null; this.timer = null; this.fadeResolve = null;
        resolve();
      }, milliseconds);
    });
  }
  async play(): Promise<void> {
    const ticket = ++this.ticket;
    this.cancelFade(); this.wantedPlaying = true; this.graph();
    if (this.audio.paused) this.level(0);
    // Both calls start inside the original click handler, before the first await.
    const resume = this.context?.state === 'suspended' ? this.context.resume() : Promise.resolve();
    try {
      await Promise.all([resume, this.audio.play()]);
      if (ticket !== this.ticket) return;
      void this.fade(this.volume, 800);
    } catch (error) {
      if (ticket !== this.ticket) return;
      this.wantedPlaying = false; this.audio.pause(); throw error;
    }
  }
  async pause(): Promise<void> {
    const ticket = ++this.ticket;
    this.wantedPlaying = false;
    await this.fade(0, 280);
    if (ticket === this.ticket) this.audio.pause();
  }
  async select(src: string, play: boolean): Promise<void> {
    const ticket = ++this.ticket;
    this.cancelFade(); this.wantedPlaying = play;
    if (play) {
      this.graph();
      // Unlock the context at the user action, even when switching after a fade.
      if (this.context?.state === 'suspended') void this.context.resume().catch(() => {});
    }
    if (!this.audio.paused) await this.fade(0, 180);
    if (ticket !== this.ticket) return;
    this.audio.pause(); this.audio.src = src; this.audio.load();
    if (play) await this.play();
    else this.level(this.volume);
  }
  setVolume(value: number) {
    this.volume = Math.max(0, Math.min(value, 1));
    if (this.wantedPlaying) this.level(this.volume);
    else if (this.audio.paused) this.level(this.volume);
  }
  stop() {
    ++this.ticket; this.wantedPlaying = false; this.cancelFade(); this.audio.pause();
  }
  destroy() {
    this.stop(); this.audio.removeAttribute('src'); this.audio.load();
    void this.context?.close().catch(() => {});
    this.context = null; this.gain = null;
  }
}
