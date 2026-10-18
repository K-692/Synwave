/**
 * Synwave Concert Stage Structure Effect
 * 
 * Creates a music festival stage environment:
 * - Massive curved Jumbotron LED screen running 100+ audio-reactive visual themes
 * - Integrated "Now Playing" broadcast lower-third on the screen
 * - Elevated glossy reflective concert deck with neon LED stage edging
 * - DJ console / riser with backlit front panel
 * - Heavy-duty aluminum truss arch, vertical towers, and overhead lighting grid
 * - Left & Right curved line-array speaker towers (with sub-bass pulse)
 * - Front VIP / audience barricade establishing the concert viewpoint
 */

import * as THREE from 'three';
import { BaseEffect } from './BaseEffect';
import type { AudioFeatures, VisualEffectContext } from '../../types';
import { StageScreenThemes } from '../stage/StageScreenThemes';

export class StageStructureEffect extends BaseEffect {
  readonly id = 'stage-structure';
  readonly name = 'Concert Stage & LED Jumbotron';
  readonly family = 'Stage Architecture';
  readonly cost = 'medium';

  private stageScreenThemes: StageScreenThemes;
  private screenTexture!: THREE.CanvasTexture;
  private screenMesh!: THREE.Mesh;
  private djFrontMesh!: THREE.Mesh;
  private djFrontTexture!: THREE.CanvasTexture;
  private djCanvas!: HTMLCanvasElement;
  private djCtx!: CanvasRenderingContext2D;

  private leftSpeakers: THREE.Group = new THREE.Group();
  private rightSpeakers: THREE.Group = new THREE.Group();
  private stageDeckEdge!: THREE.LineSegments;
  private stageDeckMesh!: THREE.Mesh;

  // Active theme tracking
  private currentThemeIndex = 0;
  private themeChangeTimer = 0;

  constructor() {
    super();
    this.stageScreenThemes = new StageScreenThemes();
  }

  public initialize(context: VisualEffectContext): void {
    super.initialize(context);

    // 1. Create Stage Deck (Elevated concert platform)
    const deckWidth = 36;
    const deckDepth = 18;
    const deckHeight = 1.6;

    const deckGeo = new THREE.BoxGeometry(deckWidth, deckHeight, deckDepth);
    const deckMat = new THREE.MeshStandardMaterial({
      color: 0x0a0c14,
      roughness: 0.25,
      metalness: 0.85,
    });
    this.stageDeckMesh = new THREE.Mesh(deckGeo, deckMat);
    this.stageDeckMesh.position.set(0, -1.0, -4.0);
    this.group.add(this.stageDeckMesh);
    this.disposables.push(deckGeo, deckMat);

    // Stage Front Edge Neon Strip
    const edgePoints = [
      new THREE.Vector3(-deckWidth / 2, -1.0 + deckHeight / 2 + 0.02, -4.0 + deckDepth / 2),
      new THREE.Vector3(deckWidth / 2, -1.0 + deckHeight / 2 + 0.02, -4.0 + deckDepth / 2),
      new THREE.Vector3(deckWidth / 2, -1.0 + deckHeight / 2 + 0.02, -4.0 - deckDepth / 2),
      new THREE.Vector3(-deckWidth / 2, -1.0 + deckHeight / 2 + 0.02, -4.0 - deckDepth / 2),
    ];
    const edgeGeo = new THREE.BufferGeometry().setFromPoints(edgePoints);
    const edgeMat = new THREE.LineBasicMaterial({
      color: 0x00f0ff,
      linewidth: 3,
    });
    this.stageDeckEdge = new THREE.LineSegments(edgeGeo, edgeMat);
    this.group.add(this.stageDeckEdge);
    this.disposables.push(edgeGeo, edgeMat);

    // 2. Massive Curved LED Jumbotron Screen
    // Positioned behind the DJ riser at z = -12, curved inwards towards audience
    const screenRadius = 26;
    const screenHeight = 12.5;
    const screenArc = Math.PI * 0.52; // ~93.6 degrees curve
    const screenStart = Math.PI * 1.5 - screenArc / 2;

    const screenGeo = new THREE.CylinderGeometry(
      screenRadius,
      screenRadius,
      screenHeight,
      64,
      1,
      true,
      screenStart,
      screenArc
    );
    // Invert geometry normals so inner surface faces audience
    screenGeo.scale(-1, 1, 1);

    this.screenTexture = new THREE.CanvasTexture(this.stageScreenThemes.getCanvas());
    this.screenTexture.minFilter = THREE.LinearFilter;
    this.screenTexture.magFilter = THREE.LinearFilter;
    this.screenTexture.wrapS = THREE.ClampToEdgeWrapping;
    this.screenTexture.wrapT = THREE.ClampToEdgeWrapping;

    const screenMat = new THREE.MeshBasicMaterial({
      map: this.screenTexture,
      side: THREE.DoubleSide,
    });

    this.screenMesh = new THREE.Mesh(screenGeo, screenMat);
    // Center of cylinder placed at (0, 4.8, 14.0) so inner curve rests at z = -12.0
    this.screenMesh.position.set(0, 4.8, 14.0);
    this.group.add(this.screenMesh);
    this.disposables.push(screenGeo, screenMat, this.screenTexture);

    // Screen Outer Glow Frame Arch
    const archRadius = screenRadius + 0.3;
    const archGeo = new THREE.CylinderGeometry(
      archRadius,
      archRadius,
      screenHeight + 0.6,
      48,
      1,
      true,
      screenStart - 0.01,
      screenArc + 0.02
    );
    archGeo.scale(-1, 1, 1);
    const archMat = new THREE.MeshStandardMaterial({
      color: 0x1a2030,
      metalness: 0.9,
      roughness: 0.3,
      wireframe: true,
    });
    const archMesh = new THREE.Mesh(archGeo, archMat);
    archMesh.position.copy(this.screenMesh.position);
    this.group.add(archMesh);
    this.disposables.push(archGeo, archMat);

    // 3. DJ Riser Table with Backlit Equalizer Panel
    const djTableGeo = new THREE.BoxGeometry(7.0, 1.2, 2.2);
    const djTableMat = new THREE.MeshStandardMaterial({
      color: 0x05070d,
      roughness: 0.4,
      metalness: 0.8,
    });
    const djTable = new THREE.Mesh(djTableGeo, djTableMat);
    djTable.position.set(0, 0.4, 2.0);
    this.group.add(djTable);
    this.disposables.push(djTableGeo, djTableMat);

    // DJ Front LED Display Panel
    this.djCanvas = document.createElement('canvas');
    this.djCanvas.width = 256;
    this.djCanvas.height = 64;
    this.djCtx = this.djCanvas.getContext('2d')!;

    this.djFrontTexture = new THREE.CanvasTexture(this.djCanvas);
    const djFrontGeo = new THREE.PlaneGeometry(6.6, 1.0);
    const djFrontMat = new THREE.MeshBasicMaterial({
      map: this.djFrontTexture,
      transparent: true,
    });
    this.djFrontMesh = new THREE.Mesh(djFrontGeo, djFrontMat);
    this.djFrontMesh.position.set(0, 0.4, 3.12);
    this.group.add(this.djFrontMesh);
    this.disposables.push(djFrontGeo, djFrontMat, this.djFrontTexture);

    // DJ Mixer Decks silhouette on top of table
    const decksGeo = new THREE.BoxGeometry(4.5, 0.15, 1.2);
    const decksMat = new THREE.MeshStandardMaterial({
      color: 0x161a26,
      roughness: 0.5,
    });
    const decksMesh = new THREE.Mesh(decksGeo, decksMat);
    decksMesh.position.set(0, 1.08, 2.0);
    this.group.add(decksMesh);
    this.disposables.push(decksGeo, decksMat);

    // 4. Aluminum Truss Framework (Stage towers & overhead grid)
    this.createTrussStructures();

    // 5. Line Array Speaker Towers (Left & Right Wings)
    this.createLineArraySpeakers();

    // 6. Front VIP Crowd Barrier Railing
    this.createCrowdBarricade();
  }

  private createTrussStructures(): void {
    const trussMat = new THREE.MeshStandardMaterial({
      color: 0x6e7d99,
      metalness: 0.95,
      roughness: 0.35,
      wireframe: true,
    });

    // Vertical Left & Right Towers
    const towerGeo = new THREE.BoxGeometry(1.2, 16, 1.2);
    this.disposables.push(towerGeo, trussMat);

    const leftTower = new THREE.Mesh(towerGeo, trussMat);
    leftTower.position.set(-17.5, 7.0, -5.0);
    this.group.add(leftTower);

    const rightTower = new THREE.Mesh(towerGeo, trussMat);
    rightTower.position.set(17.5, 7.0, -5.0);
    this.group.add(rightTower);

    // Overhead Bridge Grid
    const bridgeGeo = new THREE.BoxGeometry(36, 1.2, 1.2);
    this.disposables.push(bridgeGeo);
    const overheadBridge = new THREE.Mesh(bridgeGeo, trussMat);
    overheadBridge.position.set(0, 14.5, -5.0);
    this.group.add(overheadBridge);

    // Front Stage Lighting Truss (Over audience lip)
    const frontTruss = new THREE.Mesh(bridgeGeo, trussMat);
    frontTruss.position.set(0, 13.0, 3.0);
    this.group.add(frontTruss);
  }

  private createLineArraySpeakers(): void {
    const speakerMat = new THREE.MeshStandardMaterial({
      color: 0x080a10,
      roughness: 0.7,
      metalness: 0.3,
    });

    const boxCount = 7;
    const boxGeo = new THREE.BoxGeometry(1.8, 0.65, 1.4);
    this.disposables.push(boxGeo, speakerMat);

    // Left Array Stack
    for (let i = 0; i < boxCount; i++) {
      const box = new THREE.Mesh(boxGeo, speakerMat);
      // Gentle J-curve curvature
      const angle = (i / boxCount) * 0.28;
      box.position.set(0, -i * 0.72, -Math.sin(angle) * 0.6);
      box.rotation.x = angle;
      this.leftSpeakers.add(box);
    }
    this.leftSpeakers.position.set(-16.0, 11.0, -2.0);
    this.group.add(this.leftSpeakers);

    // Right Array Stack
    for (let i = 0; i < boxCount; i++) {
      const box = new THREE.Mesh(boxGeo, speakerMat);
      const angle = (i / boxCount) * 0.28;
      box.position.set(0, -i * 0.72, -Math.sin(angle) * 0.6);
      box.rotation.x = angle;
      this.rightSpeakers.add(box);
    }
    this.rightSpeakers.position.set(16.0, 11.0, -2.0);
    this.group.add(this.rightSpeakers);

    // Subwoofers under stage wings
    const subGeo = new THREE.BoxGeometry(3.5, 1.8, 2.5);
    this.disposables.push(subGeo);

    const leftSubs = new THREE.Mesh(subGeo, speakerMat);
    leftSubs.position.set(-16.0, -0.1, 2.0);
    this.group.add(leftSubs);

    const rightSubs = new THREE.Mesh(subGeo, speakerMat);
    rightSubs.position.set(16.0, -0.1, 2.0);
    this.group.add(rightSubs);
  }

  private createCrowdBarricade(): void {
    // Metal barricade fence in foreground
    const railMat = new THREE.MeshStandardMaterial({
      color: 0x333b4d,
      roughness: 0.5,
      metalness: 0.9,
    });

    const railGeo = new THREE.CylinderGeometry(0.06, 0.06, 26, 16);
    railGeo.rotateZ(Math.PI / 2);
    this.disposables.push(railGeo, railMat);

    const topRail = new THREE.Mesh(railGeo, railMat);
    topRail.position.set(0, -0.3, 10.5);
    this.group.add(topRail);

    // Vertical barrier posts
    const postGeo = new THREE.CylinderGeometry(0.05, 0.05, 1.4, 8);
    this.disposables.push(postGeo);

    for (let x = -12; x <= 12; x += 3) {
      const post = new THREE.Mesh(postGeo, railMat);
      post.position.set(x, -1.0, 10.5);
      this.group.add(post);
    }
  }

  public update(context: VisualEffectContext): void {
    const { features, deltaSeconds, palette } = context;

    // 1. Determine active theme index
    this.themeChangeTimer += deltaSeconds;
    const mood = context.mood || features.mood || 'euphoric-drop';

    // Update theme when section changes or on drop, or every 20 seconds
    if (this.themeChangeTimer > 20 || features.isDrop) {
      this.currentThemeIndex = StageScreenThemes.getThemeIndexForMood(
        mood,
        context.seed + Math.floor(context.trackTimeSeconds / 15),
        features.isDrop ? 'drop' : 'verse'
      );
      this.themeChangeTimer = 0;
    }

    // 2. Render 100+ Stage Screen Theme to offscreen canvas
    this.stageScreenThemes.render({
      features,
      timeSeconds: context.trackTimeSeconds || performance.now() * 0.001,
      trackTitle: context.trackTitle || 'SYNTHETIC PULSE',
      trackArtist: context.trackArtist || 'CONCERT ARENA LIVE',
      currentSection: features.isDrop ? 'DROP' : features.isKick ? 'CLIMAX' : 'VERSE',
      themeIndex: this.currentThemeIndex,
      mood,
    });
    this.screenTexture.needsUpdate = true;

    // 3. Render DJ Booth Front Display
    this.renderDjDisplay(features, palette.primary);
    this.djFrontTexture.needsUpdate = true;

    // 4. Sub-bass vibration on line array speaker towers
    const subBounce = features.subBass * 0.08 * (features.isKick ? 1.4 : 1.0);
    this.leftSpeakers.position.y = 11.0 + subBounce;
    this.rightSpeakers.position.y = 11.0 + subBounce;

    // 5. Stage deck rim color follows palette primary
    if (this.stageDeckEdge.material instanceof THREE.LineBasicMaterial) {
      this.stageDeckEdge.material.color.set(palette.primary);
    }
  }

  private renderDjDisplay(features: AudioFeatures, primaryColor: string): void {
    const ctx = this.djCtx;
    const w = this.djCanvas.width;
    const h = this.djCanvas.height;

    ctx.fillStyle = '#04060c';
    ctx.fillRect(0, 0, w, h);

    // Mini spectrum bars on DJ front panel
    const barCount = 32;
    const barWidth = (w - 20) / barCount;
    const step = Math.floor(features.frequencyData.length / barCount);

    ctx.fillStyle = primaryColor;
    for (let i = 0; i < barCount; i++) {
      const val = features.frequencyData[i * step] / 255;
      const barH = val * (h - 16);
      ctx.fillRect(10 + i * barWidth, h - 8 - barH, barWidth - 2, barH);
    }

    // Border glow
    ctx.strokeStyle = primaryColor;
    ctx.lineWidth = 2;
    ctx.strokeRect(4, 4, w - 8, h - 8);
  }
}
