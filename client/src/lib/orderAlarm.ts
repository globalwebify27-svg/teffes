// Audio Synthesizer for Store Admin New Order Alarm
// Uses Web Audio API for zero-dependency, guaranteed cross-browser audible chimes

class OrderAlarmSound {
  private audioCtx: AudioContext | null = null;
  private intervalId: any = null;
  private isRinging: boolean = false;

  private initCtx() {
    if (!this.audioCtx && typeof window !== "undefined") {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        this.audioCtx = new AudioCtx();
      }
    }
    if (this.audioCtx && this.audioCtx.state === "suspended") {
      this.audioCtx.resume().catch(() => {});
    }
  }

  public playChime() {
    try {
      this.initCtx();
      if (!this.audioCtx) return;

      const now = this.audioCtx.currentTime;

      // Note 1: High crisp bell (880 Hz / A5)
      const osc1 = this.audioCtx.createOscillator();
      const gain1 = this.audioCtx.createGain();
      osc1.type = "sine";
      osc1.frequency.setValueAtTime(880, now);
      osc1.frequency.exponentialRampToValueAtTime(784, now + 0.35);

      gain1.gain.setValueAtTime(0.65, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

      osc1.connect(gain1);
      gain1.connect(this.audioCtx.destination);
      osc1.start(now);
      osc1.stop(now + 0.4);

      // Note 2: Piercing bright chime (1174.66 Hz / D6)
      const osc2 = this.audioCtx.createOscillator();
      const gain2 = this.audioCtx.createGain();
      osc2.type = "sine";
      osc2.frequency.setValueAtTime(1174.66, now + 0.16);
      osc2.frequency.exponentialRampToValueAtTime(1046.5, now + 0.6);

      gain2.gain.setValueAtTime(0.7, now + 0.16);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.65);

      osc2.connect(gain2);
      gain2.connect(this.audioCtx.destination);
      osc2.start(now + 0.16);
      osc2.stop(now + 0.65);

      // Note 3: Warm undertone (587.33 Hz / D5)
      const osc3 = this.audioCtx.createOscillator();
      const gain3 = this.audioCtx.createGain();
      osc3.type = "triangle";
      osc3.frequency.setValueAtTime(587.33, now);
      gain3.gain.setValueAtTime(0.35, now);
      gain3.gain.exponentialRampToValueAtTime(0.001, now + 0.5);

      osc3.connect(gain3);
      gain3.connect(this.audioCtx.destination);
      osc3.start(now);
      osc3.stop(now + 0.5);
    } catch (e) {
      console.warn("[OrderAlarmSound] Audio play failed:", e);
    }
  }

  public startAlarm() {
    this.isRinging = true;
    this.playChime();
    if (!this.intervalId) {
      this.intervalId = setInterval(() => {
        if (this.isRinging) {
          this.playChime();
        } else {
          this.stopAlarm();
        }
      }, 3500);
    }
  }

  public stopAlarm() {
    this.isRinging = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  public getIsRinging() {
    return this.isRinging;
  }
}

export const orderAlarm = new OrderAlarmSound();
