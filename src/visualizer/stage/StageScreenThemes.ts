/**
 * Synwave Concert Stage Screen Renderer
 * 
 * Renders a solid pitch-black LED screen on the 3D concert stage:
 * - Solid black screen with zero distracting designs or figures
 * - Dynamic spotlight ambient glow matching the active concert lights thrown towards the camera
 * - Song title, artist name, and live telemetry centered directly in the middle of the screen
 * - Real-time audio reactive 4-channel STEM indicators (Kick, Bass, Instruments, Vocals)
 */

import type { AudioFeatures, MusicMood } from '../../types';

export interface ScreenThemeContext {
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
  features: AudioFeatures;
  timeSeconds: number;
  trackTitle: string;
  trackArtist: string;
  currentSection: string;
  themeIndex: number;
  mood: MusicMood;
  spotlightColor?: string;
}

export interface RenderThemeOptions {
  features: AudioFeatures;
  timeSeconds: number;
  trackTitle: string;
  trackArtist: string;
  currentSection: string;
  themeIndex: number;
  mood?: MusicMood;
  spotlightColor?: string;
}

export class StageScreenThemes {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  public readonly width = 1280;
  public readonly height = 720;

  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.width = this.width;
    this.canvas.height = this.height;
    this.ctx = this.canvas.getContext('2d', { alpha: false })!;
  }

  public getCanvas(): HTMLCanvasElement {
    return this.canvas;
  }

  public static getThemeIndexForMood(_mood: MusicMood, _seed: number, _sectionType: string): number {
    return 0;
  }

  /**
   * Renders the solid black concert screen with the track name & details at the center,
   * illuminated by the spotlight glow.
   */
  public render(
    optsOrFeatures: AudioFeatures | RenderThemeOptions,
    _timeSeconds?: number,
    trackTitle?: string,
    trackArtist?: string,
    currentSection?: string,
    _themeIndex?: number
  ): void {
    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;

    let features: AudioFeatures;
    let title = '';
    let artist = '';
    let section = '';
    let lightColor = '#ff6600';

    if ('features' in (optsOrFeatures as RenderThemeOptions)) {
      const opts = optsOrFeatures as RenderThemeOptions;
      features = opts.features;
      title = opts.trackTitle;
      artist = opts.trackArtist;
      section = opts.currentSection;
      lightColor = opts.spotlightColor || '#ff6600';
    } else {
      features = optsOrFeatures as AudioFeatures;
      title = trackTitle || '';
      artist = trackArtist || '';
      section = currentSection || '';
    }

    // 1. Solid Pitch-Black Screen (No designs, no person-like figures)
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, w, h);

    // 2. Subtle Spotlight Ambient Tint (Keeps screen predominantly pitch-black):
    const glowIntensity = Math.min(0.18, 0.04 + features.stems.bass * 0.08 + (features.isDrop ? 0.06 : 0));

    // Dynamic subtle radial flare
    const cx = w / 2;
    const cy = h / 2;
    const glowRadius = w * 0.42;

    const spotGrad = ctx.createRadialGradient(cx, cy, 10, cx, cy, glowRadius);
    const r = parseInt(lightColor.slice(1, 3), 16) || 255;
    const g = parseInt(lightColor.slice(3, 5), 16) || 120;
    const b = parseInt(lightColor.slice(5, 7), 16) || 0;

    spotGrad.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${glowIntensity})`);
    spotGrad.addColorStop(0.5, `rgba(${r}, ${g}, ${b}, ${glowIntensity * 0.25})`);
    spotGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');

    ctx.fillStyle = spotGrad;
    ctx.fillRect(0, 0, w, h);

    // 3. Subtle LED Screen Mesh Grid Overlay (Gives authentic physical stadium LED pixel texture)
    ctx.fillStyle = 'rgba(0, 0, 0, 0.28)';
    for (let y = 0; y < h; y += 4) {
      ctx.fillRect(0, y, w, 1.2);
    }

    // 4. Centered Song Name and Details
    this.renderCenteredTrackDetails(ctx, w, h, title, artist, section, features, lightColor, r, g, b);
  }

  /**
   * Renders the track title, artist, and details right in the centre of the screen.
   */
  private renderCenteredTrackDetails(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    title: string,
    artist: string,
    section: string,
    features: AudioFeatures,
    lightColor: string,
    r: number,
    g: number,
    b: number
  ): void {
    const cx = w / 2;
    const cy = h / 2;

    // A. Center Status Badge (REAL-TIME VISUALS / LIVE REACTIVE MODE)
    const badgeText = features.isDrop ? '⚡ LIVE REACTIVE MODE • FESTIVAL DROP' : '● REAL-TIME VISUALS • NOW PLAYING';
    ctx.font = 'bold 16px "Orbitron", -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Badge pill
    const badgeW = 320;
    const badgeH = 34;
    const badgeY = cy - 130;

    ctx.fillStyle = 'rgba(10, 14, 24, 0.82)';
    ctx.strokeStyle = features.isDrop ? '#ff0055' : lightColor;
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.roundRect(cx - badgeW / 2, badgeY - badgeH / 2, badgeW, badgeH, 17);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = features.isDrop ? '#ff3366' : lightColor;
    ctx.fillText(badgeText, cx, badgeY);

    // B. Song Title (Massive, Crisp, Bold Headline in Screen Center)
    const displayTitle = (title || 'SYNWAVE CONCERT').toUpperCase();
    const cleanTitle = displayTitle.length > 28 ? displayTitle.slice(0, 28) + '...' : displayTitle;

    // Title with sharp contrast shadow
    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.95)';
    ctx.shadowBlur = 10;
    ctx.fillStyle = '#ffffff';
    ctx.font = '900 52px "Orbitron", -apple-system, sans-serif';
    ctx.fillText(cleanTitle, cx, cy - 40);
    ctx.restore();

    // C. Artist Name (Directly below title)
    if (artist) {
      ctx.fillStyle = '#cbd5e1';
      ctx.font = '500 24px "Outfit", -apple-system, sans-serif';
      ctx.fillText(artist, cx, cy + 20);
    }

    // D. Audio Reactive Frequency / Waveform Line in Center
    const waveW = 420;
    const waveY = cy + 65;
    ctx.beginPath();
    ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, 0.85)`;
    ctx.lineWidth = 2.4;

    const step = waveW / 40;
    const startX = cx - waveW / 2;
    for (let i = 0; i <= 40; i++) {
      const x = startX + i * step;
      const freqNorm = features.frequencyData ? features.frequencyData[i * 2] / 255 : 0.5;
      const y = waveY + (Math.sin(i * 0.4 + performance.now() * 0.005) * 12 + (freqNorm - 0.5) * 25);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // E. 4-Channel STEM Indicators (Centered telemetry pills)
    const stemY = cy + 120;
    const stemConfigs = [
      { name: 'KICK', value: features.stems.kick, color: '#ff3366' },
      { name: 'BASS', value: features.stems.bass, color: '#ffaa00' },
      { name: 'INST', value: features.stems.instruments, color: '#00f0ff' },
      { name: 'VOCALS', value: features.stems.vocals, color: '#a855f7' },
    ];

    const stemTotalW = 380;
    const stemSlotW = stemTotalW / 4;
    const stemStartX = cx - stemTotalW / 2 + stemSlotW / 2;

    for (let i = 0; i < stemConfigs.length; i++) {
      const cfg = stemConfigs[i];
      const sX = stemStartX + i * stemSlotW;

      // Stem label
      ctx.font = 'bold 12px "JetBrains Mono", monospace';
      ctx.fillStyle = cfg.color;
      ctx.fillText(cfg.name, sX, stemY - 14);

      // Level bar
      const barW = stemSlotW - 18;
      const barH = 6;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
      ctx.fillRect(sX - barW / 2, stemY, barW, barH);

      const fillW = Math.max(2, Math.min(barW, barW * cfg.value));
      ctx.fillStyle = cfg.color;
      ctx.fillRect(sX - barW / 2, stemY, fillW, barH);
    }

    // F. Section Pill at bottom of screen
    const sectionText = features.isDrop
      ? '⚡ MAXIMUM ENERGY DROP'
      : `SECTION: ${section || 'MAIN STAGE'} • 4K HDR`;
    ctx.font = 'bold 13px "JetBrains Mono", monospace';
    ctx.fillStyle = 'rgba(148, 163, 184, 0.85)';
    ctx.fillText(sectionText, cx, cy + 175);
  }
}
