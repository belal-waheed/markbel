/**
 * Web Audio API based sound synthesis for Obel.
 * Provides pleasant, non-intrusive sounds for productivity events.
 */

class SoundSystem {
  private ctx: AudioContext | null = null;

  private getContext() {
    if (!this.ctx) {
      const AudioCtx = (window as unknown as { AudioContext: typeof AudioContext; webkitAudioContext: typeof AudioContext }).AudioContext || 
                       (window as unknown as { AudioContext: typeof AudioContext; webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();
    }
    return this.ctx;
  }

  /**
   * Helper to play a multi-layered, premium "Soft Bell" tone
   */
  private async playSoftBell(
    freq: number, 
    duration: number = 0.5, 
    volume: number = 0.1, 
    harmonics: number[] = [1, 2, 3, 4.2]
  ) {
    const ctx = this.getContext();
    if (ctx.state === 'suspended') await ctx.resume();
    const now = ctx.currentTime;

    // Create a master bus for this sound with a low-pass filter for warmth
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(4000, now);
    filter.Q.setValueAtTime(0.7, now);
    filter.connect(ctx.destination);

    const masterGain = ctx.createGain();
    masterGain.connect(filter);
    
    // Global Envelope
    masterGain.gain.setValueAtTime(0, now);
    masterGain.gain.linearRampToValueAtTime(volume, now + 0.02);
    masterGain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    harmonics.forEach((h, index) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      
      osc.type = index === 0 ? 'sine' : 'triangle';
      osc.frequency.setValueAtTime(freq * h, now);
      
      // Weaker harmonics for richness without dominance
      g.gain.setValueAtTime(1 / (index + 1), now);
      
      osc.connect(g);
      g.connect(masterGain);
      
      osc.start(now);
      osc.stop(now + duration);
    });
  }

  /**
   * Play the celestial, user-provided "Chime" (Timer Complete)
   */
  async playChime() {
    try {
      // Using a standard Audio element for the public MP3 file
      const audio = new Audio('/finish-session.mp3');
      audio.volume = 0.5;
      await audio.play();
    } catch (error: unknown) {
      console.error('Failed to play custom chime:', error);
      // Fallback to stylized synthesis if file fails
      const baseFreqs = [523.25, 659.25, 783.99, 1046.50]; 
      baseFreqs.forEach((f, i) => {
        setTimeout(() => this.playSoftBell(f, 2.5, 0.08, [1, 2.01, 3.02]), i * 150);
      });
    }
  }

  /**
   * Play a satisfying task success "Ding"
   */
  async playSuccess() {
    await this.playSoftBell(880, 0.6, 0.15, [1, 1.5, 2]);
  }

  /**
   * Play a subtle interaction "Click"
   */
  async playClick() {
    const ctx = this.getContext();
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(600, now);
    osc.frequency.exponentialRampToValueAtTime(100, now + 0.04);
    
    gain.gain.setValueAtTime(0.05, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.04);
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.04);
  }

  /**
   * Play a professional "Start Focus" sparkle
   */
  async playStart() {
    await this.playSoftBell(1320, 0.4, 0.1, [1, 2, 3]); // High E6
  }

  /**
   * Play a warm "Pause" tone
   */
  async playPause() {
    await this.playSoftBell(440, 0.4, 0.08, [1, 1.25]); // A4
  }

  /**
   * Play a celebratory "Triple-Jump" sound (Habit Complete)
   */
  async playHabitCheck() {
    const freqs = [659.25, 783.99, 1046.50];
    freqs.forEach((f, i) => {
      setTimeout(() => this.playSoftBell(f, 0.5, 0.1), i * 100);
    });
  }

  /**
   * Play a neutral "Undo/Click" (Habit Uncheck)
   */
  async playHabitUncheck() {
    this.playClick();
  }
}

export const soundSystem = new SoundSystem();
