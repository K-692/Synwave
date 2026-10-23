/**
 * Synwave Audio-to-Visual Routing Store & Stage Profiles
 * 
 * Manages user-configurable signal routing, spotlight counts, effect sensitivities,
 * and the authoritative Festival Mainstage concert experience.
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
    description: 'High-octane EDM arena with dual corner white sky spotlights, perimeter moving heads, and bass-reactive stage wash.',
    accentColor: '#ff0055',
    defaultConfig: {
      kickSensitivity: 1.15,
      bassToBeamIntensity: 1.2,
      vocalToScreenGlow: 1.0,
      spotlightCount: 3,
      minSpotlightCount: 1,
      maxSpotlightCount: 7,
      autoBpmSpotlightSpawning: true,
      effectDecay: 1.0,
      cameraShakeStrength: 0.0,
      spotlightShakeIntensity: 1.0,
      screenShakeIntensity: 1.0,
      screenFlashIntensity: 1.0,
      screenFlashColorSaturation: 1.0,
      perimeterBassRotationSpeed: 1.0,
      instrumentalMovementSpeed: 1.0,
      spotlightIntensity: 1.5,
      spotlightBeamBrightness: 1.5,
      reducedFlash: false,
      maxBrightnessLimit: 1.0,
      enabledEffects: {
        lights: true,
      },
    },
  },
};

const STORAGE_KEY_CONFIG = 'synwave_routing_config_v6';
const STORAGE_KEY_PROFILE = 'synwave_active_profile_v6';

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

  public setSpotlightCount(count: number): void {
    const min = this.config.minSpotlightCount ?? 1;
    const max = this.config.maxSpotlightCount ?? 7;
    this.updateConfig({ spotlightCount: Math.max(min, Math.min(max, Math.round(count))) });
  }

  public setSpotlightCountLimits(minCount: number, maxCount: number): void {
    const min = Math.max(1, Math.min(8, Math.round(minCount)));
    const max = Math.max(min, Math.min(8, Math.round(maxCount)));
    const current = Math.max(min, Math.min(max, this.config.spotlightCount ?? 3));
    this.updateConfig({
      minSpotlightCount: min,
      maxSpotlightCount: max,
      spotlightCount: current,
    });
  }

  public toggleEffect(family: keyof AudioVisualRoutingConfig['enabledEffects']): void {
    this.config.enabledEffects[family] = !this.config.enabledEffects[family];
    this.persistToStorage();
    this.notifyListeners();
  }

  public resetToProfileDefault(): void {
    const profileMeta = STAGE_PROFILES[this.activeProfile];
    if (!profileMeta) return;
    this.config = {
      ...profileMeta.defaultConfig,
      enabledEffects: { ...profileMeta.defaultConfig.enabledEffects },
    };
    this.persistToStorage();
    this.notifyListeners();
  }

  public subscribe(
    listener: (config: AudioVisualRoutingConfig, profile: StageProfile) => void
  ): () => void {
    this.listeners.add(listener);
    listener(this.config, this.activeProfile);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners(): void {
    for (const listener of this.listeners) {
      try {
        listener(this.config, this.activeProfile);
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
