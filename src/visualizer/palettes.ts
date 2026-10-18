import type { ColorPalette } from '../types';

export const COLOR_PALETTES: ColorPalette[] = [
  {
    id: 'cyberpunk-neon',
    name: 'Cyberpunk Neon',
    primary: '#00f0ff',       // Vivid Cyan
    secondary: '#ff007f',     // Electric Hot Pink
    accent: '#ffe600',        // Acid Yellow
    background: '#04060d',    // Deep Void Indigo
    glow: '#00ffff',
    laserColor: '#ff007f',
    ambientColor: '#120d2b'
  },
  {
    id: 'synthwave-sunset',
    name: 'Synthwave Sunset',
    primary: '#ff5e3a',       // Sunset Red-Orange
    secondary: '#b800ff',     // Hyper Violet
    accent: '#ff0078',        // Magenta
    background: '#090312',    // Retro Dusk
    glow: '#ff4d79',
    laserColor: '#ff3366',
    ambientColor: '#200833'
  },
  {
    id: 'matrix-emerald',
    name: 'Matrix Emerald',
    primary: '#00ff88',       // Digital Neon Mint
    secondary: '#00b4d8',     // Deep Aqua
    accent: '#70e000',        // Radioactive Lime
    background: '#020b08',    // Dark Terminal Green
    glow: '#00ffaa',
    laserColor: '#00ff66',
    ambientColor: '#041f14'
  },
  {
    id: 'deep-space',
    name: 'Deep Space',
    primary: '#4361ee',       // Electric Cobalt
    secondary: '#7209b7',     // Nebula Violet
    accent: '#4cc9f0',        // Icy Sky Blue
    background: '#030510',    // Starlight Obsidian
    glow: '#3a86ff',
    laserColor: '#4cc9f0',
    ambientColor: '#0a0d24'
  },
  {
    id: 'solar-flare',
    name: 'Solar Flare',
    primary: '#ffaa00',       // Molten Gold
    secondary: '#ff3c00',     // Solar Crimson
    accent: '#ffffff',        // White Heat
    background: '#0c0502',    // Smoldering Black
    glow: '#ff9900',
    laserColor: '#ff3300',
    ambientColor: '#2b1005'
  },
  {
    id: 'monolith-chrome',
    name: 'Monolith Chrome',
    primary: '#ffffff',       // Pure Diamond
    secondary: '#8d99ae',     // Cool Steel
    accent: '#3a86ff',        // Cyan Glint
    background: '#050507',    // Pitch Carbon
    glow: '#e0e0e0',
    laserColor: '#ffffff',
    ambientColor: '#151518'
  }
];

export const getPaletteById = (id: string): ColorPalette => {
  return COLOR_PALETTES.find(p => p.id === id) || COLOR_PALETTES[0];
};
