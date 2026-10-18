/**
 * Synwave Audio-to-Visual Routing Store & Stage Profiles
 * 
 * Manages user-configurable signal routing, effect sensitivities,
 * stage presets (Festival Mainstage, Industrial, Rock Arena, Cinematic Ambient),
 * and accessibility / safety overrides with localStorage persistence.
 */

import type { AudioVisualRoutingConfig, StageProfile } from '../../types';

export interface StageProfileMetadata {
  id: StageProfile;
  name: string;
  subtitle: string;
  description: string;
  accentColor: string;
  defaultConfig: AudioVisualRoutingConfig;
}

export const STAGE_PROFILES: Record<StageProfile, StageProfileMetadata> = {
  'festival-mainstage': {
    id: 'festival-mainstage',
    name: 'Festival Mainstage',
    subtitle: 'Ultra / Tomorrowland Stadium',
    description: 'High-octane EDM arena with wide laser fans, sync flame cannons, punchy moving heads, and bass-reactive stage wash.',
    accentColor: '#ff0055',
    defaultConfig: {
      kickSensitivity: 1.15,
      bassToBeamIntensity: 1.2,
      vocalToScreenGlow: 1.0,
      pyroThreshold: 0.45,
      laserDensity: 1.25,
      effectDecay: 1.0,
      cameraShakeStrength: 1.2,
      reducedFlash: false,
      disablePyrotechnics: false,
      maxBrightnessLimit: 1.0,
      enabledEffects: {
        lights: true,
        lasers: true,
        flames: true,
        smoke: true,
        screen: true,
      },
    },
  },

  'industrial-underground': {
    id: 'industrial-underground',
    name: 'Industrial Underground',
    subtitle: 'Warehouse Techno / Berlin Club',
    description: 'Cold, raw warehouse techno with dense haze, strobing kick blinders, tight laser cages, and no pyrotechnics.',
    accentColor: '#00ff88',
    defaultConfig: {
      kickSensitivity: 1.3,
      bassToBeamIntensity: 1.4,
      vocalToScreenGlow: 0.8,
      pyroThreshold: 1.0,
      laserDensity: 0.85,
      effectDecay: 0.8,
      cameraShakeStrength: 1.0,
      reducedFlash: false,
      disablePyrotechnics: true,
      maxBrightnessLimit: 0.9,
      enabledEffects: {
        lights: true,
        lasers: true,
        flames: false,
        smoke: true,
        screen: true,
      },
    },
  },

  'rock-arena': {
    id: 'rock-arena',
    name: 'Rock Arena',
    subtitle: 'Stadium Rock & Metal Tour',
    description: 'Warm amber & gold spotlights, chorus fire bursts, heavy floor wash, and rhythmic moving head sweeps.',
    accentColor: '#ff8800',
    defaultConfig: {
      kickSensitivity: 1.0,
      bassToBeamIntensity: 1.15,
      vocalToScreenGlow: 1.1,
      pyroThreshold: 0.55,
      laserDensity: 0.65,
      effectDecay: 1.1,
      cameraShakeStrength: 0.85,
      reducedFlash: false,
      disablePyrotechnics: false,
      maxBrightnessLimit: 0.95,
      enabledEffects: {
        lights: true,
        lasers: true,
        flames: true,
        smoke: true,
        screen: true,
      },
    },
  },

  'cinematic-ambient': {
    id: 'cinematic-ambient',
    name: 'Cinematic Ambient',
    subtitle: 'Planetarium & Orchestral Chill',
    description: 'Intimate and ethereal chillout with soft cyan/violet volumetric haze, zero camera shake, delicate laser lines, and no flames.',
    accentColor: '#00e5ff',
    defaultConfig: {
      kickSensitivity: 0.6,
      bassToBeamIntensity: 0.75,
      vocalToScreenGlow: 1.3,
      pyroThreshold: 1.0,
      laserDensity: 0.45,
      effectDecay: 1.4,
      cameraShakeStrength: 0.0,
      reducedFlash: true,
      disablePyrotechnics: true,
      maxBrightnessLimit: 0.75,
      enabledEffects: {
        lights: true,
        lasers: true,
        flames: false,
        smoke: true,
        screen: true,
      },
    },
  },
};

const STORAGE_KEY_CONFIG = 'synwave_routing_config_v2';
const STORAGE_KEY_PROFILE = 'synwave_active_profile_v2';

export class RoutingStore {
  private static instance: RoutingStore;
  private activeProfile: StageProfile = 'festival-mainstage';
  private config: AudioVisualRoutingConfig;
  private listeners: Set<(config: AudioVisualRoutingConfig, profile: StageProfile) => void> = new Set();

  private constructor() {
    this.config = { ...STAGE_PROFILES['festival-mainstage'].defaultConfig };
    this.loadFromStorage();
  }

  public static getInstance(): RoutingStore {
    if (!RoutingStore.instance) {
      RoutingStore.instance = new RoutingStore();
    }
    return RoutingStore.instance;
  }

  public getConfig(): AudioVisualRoutingConfig {
    return { ...this.config };
  }

  public getActiveProfile(): StageProfile {
    return this.activeProfile;
  }

  public setProfile(profile: StageProfile, applyPresetConfig = true): void {
    if (!STAGE_PROFILES[profile]) return;
    this.activeProfile = profile;
    if (applyPresetConfig) {
      this.config = {
        ...STAGE_PROFILES[profile].defaultConfig,
        enabledEffects: { ...STAGE_PROFILES[profile].defaultConfig.enabledEffects },
      };
    }
    this.persistToStorage();
    this.notifyListeners();
  }

  public updateConfig(partial: Partial<AudioVisualRoutingConfig>): void {
    this.config = {
      ...this.config,
      ...partial,
      enabledEffects: {
        ...this.config.enabledEffects,
        ...(partial.enabledEffects || {}),
      },
    };
    this.persistToStorage();
    this.notifyListeners();
  }

  public toggleEffect(family: keyof AudioVisualRoutingConfig['enabledEffects']): void {
    this.config.enabledEffects[family] = !this.config.enabledEffects[family];
    this.persistToStorage();
    this.notifyListeners();
  }

  public resetToProfileDefault(): void {
    const profileMeta = STAGE_PROFILES[this.activeProfile];
    if (profileMeta) {
      this.config = {
        ...profileMeta.defaultConfig,
        enabledEffects: { ...profileMeta.defaultConfig.enabledEffects },
      };
      this.persistToStorage();
      this.notifyListeners();
    }
  }

  public subscribe(listener: (config: AudioVisualRoutingConfig, profile: StageProfile) => void): () => void {
    this.listeners.add(listener);
    listener(this.getConfig(), this.getActiveProfile());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners(): void {
    const cfg = this.getConfig();
    const prof = this.getActiveProfile();
    for (const listener of this.listeners) {
      try {
        listener(cfg, prof);
      } catch (e) {
        console.error('Error notifying routing listener:', e);
      }
    }
  }

  private loadFromStorage(): void {
    try {
      const storedProfile = localStorage.getItem(STORAGE_KEY_PROFILE) as StageProfile | null;
      if (storedProfile && STAGE_PROFILES[storedProfile]) {
        this.activeProfile = storedProfile;
      }

      const storedConfig = localStorage.getItem(STORAGE_KEY_CONFIG);
      if (storedConfig) {
        const parsed = JSON.parse(storedConfig);
        this.config = {
          ...STAGE_PROFILES[this.activeProfile].defaultConfig,
          ...parsed,
          enabledEffects: {
            ...STAGE_PROFILES[this.activeProfile].defaultConfig.enabledEffects,
            ...(parsed.enabledEffects || {}),
          },
        };
      }
    } catch (e) {
      console.warn('Could not load routing store config from localStorage:', e);
    }
  }

  private persistToStorage(): void {
    try {
      localStorage.setItem(STORAGE_KEY_PROFILE, this.activeProfile);
      localStorage.setItem(STORAGE_KEY_CONFIG, JSON.stringify(this.config));
    } catch (e) {
      console.warn('Could not save routing store config to localStorage:', e);
    }
  }
}
