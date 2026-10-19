/**
 * Synwave Concert Stage Structure Effect
 * 
 * Accurately replicates the concert stage architecture from the user's reference photo:
 * - Pitch-black stadium night backdrop with zero revolving elements
 * - Massive solid rectangular Jumbotron LED screen (16:9) displaying procedural visual themes
 *   and the exclusive "Now Playing" broadcast banner
 * - Industrial heavy-duty aluminum box-truss roof structure with horizontal cross-beams and vertical legs
 * - Left & Right flamethrower riser platforms flanking the video wall
 * - Foreground concert crowd silhouette: audience heads, raised arms/hands, and glowing mobile phone screens
 * - Audio-reactive crowd bobbing and sub-bass vibration
 */

import * as THREE from 'three';
import { BaseEffect } from './BaseEffect';
import type { VisualEffectContext } from '../../types';
import { StageScreenThemes } from '../stage/StageScreenThemes';
import { calculateStageDimensions } from '../stage/stageDimensions';

export class StageStructureEffect extends BaseEffect {
  readonly id = 'stage-structure';
  readonly name = 'Concert Stage & Solid LED Screen';
  readonly family = 'Stage Architecture';
  readonly cost = 'medium';

  private stageScreenThemes: StageScreenThemes;
  private screenTexture!: THREE.CanvasTexture;
  private screenMesh!: THREE.Mesh;
  private backWallMesh!: THREE.Mesh;
  private stageDeckMesh!: THREE.Mesh;
  private topMask!: THREE.Mesh;
  private btmMask!: THREE.Mesh;
  private leftMask!: THREE.Mesh;
  private rightMask!: THREE.Mesh;
  private topFrame!: THREE.Mesh;
  private btmFrame!: THREE.Mesh;
  private leftFrame!: THREE.Mesh;
  private rightFrame!: THREE.Mesh;
  private innerBorderLine!: THREE.Line;
  private roofTruss!: THREE.Mesh;
  private frontRoofTruss!: THREE.Mesh;
  private leftTower!: THREE.Mesh;
  private rightTower!: THREE.Mesh;
  private leftScrim!: THREE.Mesh;
  private rightScrim!: THREE.Mesh;

  private baseScreenWidth = 17.44;
  private baseScreenHeight = 9.81;
  private readonly bezelThickness = 0.55;
  private hasVideo = false;

  constructor() {
    super();
    this.stageScreenThemes = new StageScreenThemes();
  }

  public setVideoActive(active: boolean): void {
    this.hasVideo = active;
    if (this.screenMesh) {
      this.screenMesh.visible = !active;
    }
    if (this.backWallMesh) {
      this.backWallMesh.visible = !active;
    }
    if (this.innerBorderLine) {
      this.innerBorderLine.visible = !active;
    }
  }

  public initialize(context: VisualEffectContext): void {
    super.initialize(context);

    // 1. Stage Deck (Elevated concert platform)
    const deckWidth = 32;
    const deckDepth = 14;
    const deckHeight = 1.4;

    const deckGeo = new THREE.BoxGeometry(deckWidth, deckHeight, deckDepth);
    const deckMat = new THREE.MeshStandardMaterial({
      color: 0x05070c,
      roughness: 0.35,
      metalness: 0.85,
    });
    this.stageDeckMesh = new THREE.Mesh(deckGeo, deckMat);
    this.stageDeckMesh.position.set(0, -1.2, -2.0);
    this.group.add(this.stageDeckMesh);
    this.disposables.push(deckGeo, deckMat);

    // Stage Front Edge Glow Trim
    const edgePoints = [
      new THREE.Vector3(-deckWidth / 2, -1.2 + deckHeight / 2 + 0.02, -2.0 + deckDepth / 2),
      new THREE.Vector3(deckWidth / 2, -1.2 + deckHeight / 2 + 0.02, -2.0 + deckDepth / 2),
    ];
    const edgeGeo = new THREE.BufferGeometry().setFromPoints(edgePoints);
    const edgeMat = new THREE.LineBasicMaterial({
      color: 0x00f0ff,
      linewidth: 2,
    });
    const stageEdge = new THREE.Line(edgeGeo, edgeMat);
    this.group.add(stageEdge);
    this.disposables.push(edgeGeo, edgeMat);

    // 2. Solid Rectangular LED Jumbotron Screen (Exact match to reference photo)
    const screenWidth = this.baseScreenWidth;
    const screenHeight = this.baseScreenHeight;

    const screenGeo = new THREE.PlaneGeometry(screenWidth, screenHeight);

    this.screenTexture = new THREE.CanvasTexture(this.stageScreenThemes.getCanvas());
    this.screenTexture.minFilter = THREE.LinearFilter;
    this.screenTexture.magFilter = THREE.LinearFilter;

    const screenMat = new THREE.MeshBasicMaterial({
      map: this.screenTexture,
      side: THREE.FrontSide,
    });

    this.screenMesh = new THREE.Mesh(screenGeo, screenMat);
    this.screenMesh.position.set(0, 4.72, -4.5);
    this.group.add(this.screenMesh);
    this.disposables.push(screenGeo, screenMat, this.screenTexture);

    // Screen Solid Black Backing Wall (Hidden when video is playing to allow video shine-through)
    const backWallGeo = new THREE.BoxGeometry(screenWidth + 1.2, screenHeight + 1.2, 0.4);
    const backWallMat = new THREE.MeshBasicMaterial({ color: 0x010204 });
    this.backWallMesh = new THREE.Mesh(backWallGeo, backWallMat);
    this.backWallMesh.position.set(0, 4.72, -4.75);
    this.group.add(this.backWallMesh);
    this.disposables.push(backWallGeo, backWallMat);

    // Solid Black Surrounding Masking Walls:
    // Guarantees that the YouTube video iframe NEVER leaks out past the 3D screen frame!
    const maskMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
    this.disposables.push(maskMat);

    // Top Masking Wall (spans from top of screen up to Y = 35)
    const topMaskGeo = new THREE.PlaneGeometry(90, 24);
    this.topMask = new THREE.Mesh(topMaskGeo, maskMat);
    this.topMask.position.set(0, 4.72 + screenHeight / 2 + 12.0, -4.46);
    this.group.add(this.topMask);
    this.disposables.push(topMaskGeo);

    // Bottom Masking Wall (spans from bottom of screen down to Y = -20)
    const btmMaskGeo = new THREE.PlaneGeometry(90, 20);
    this.btmMask = new THREE.Mesh(btmMaskGeo, maskMat);
    this.btmMask.position.set(0, 4.72 - screenHeight / 2 - 10.0, -4.46);
    this.group.add(this.btmMask);
    this.disposables.push(btmMaskGeo);

    // Left Masking Wall (spans from left edge of screen out to X = -45)
    const sideMaskGeo = new THREE.PlaneGeometry(40, 45);
    this.disposables.push(sideMaskGeo);
    this.leftMask = new THREE.Mesh(sideMaskGeo, maskMat);
    this.leftMask.position.set(-(screenWidth / 2 + 20.0), 4.72, -4.46);
    this.group.add(this.leftMask);

    // Right Masking Wall (spans from right edge of screen out to X = +45)
    this.rightMask = new THREE.Mesh(sideMaskGeo, maskMat);
    this.rightMask.position.set(screenWidth / 2 + 20.0, 4.72, -4.46);
    this.group.add(this.rightMask);

    // Jumbotron Screen Outer Frame Bezel (Bold industrial border framing the 16:9 aperture)
    const frameMat = new THREE.MeshStandardMaterial({
      color: 0x0c0f18,
      roughness: 0.35,
      metalness: 0.85,
    });
    this.disposables.push(frameMat);

    const bezelDepth = 0.40;

    // Top Frame Bezel
    const hFrameGeo = new THREE.BoxGeometry(screenWidth + this.bezelThickness * 2, this.bezelThickness, bezelDepth);
    this.disposables.push(hFrameGeo);
    this.topFrame = new THREE.Mesh(hFrameGeo, frameMat);
    this.topFrame.position.set(0, 4.72 + screenHeight / 2 + this.bezelThickness / 2, -4.44);
    this.group.add(this.topFrame);

    // Bottom Frame Bezel
    this.btmFrame = new THREE.Mesh(hFrameGeo, frameMat);
    this.btmFrame.position.set(0, 4.72 - screenHeight / 2 - this.bezelThickness / 2, -4.44);
    this.group.add(this.btmFrame);

    // Left and Right Frame Bezels
    const vFrameGeo = new THREE.BoxGeometry(this.bezelThickness, screenHeight, bezelDepth);
    this.disposables.push(vFrameGeo);
    this.leftFrame = new THREE.Mesh(vFrameGeo, frameMat);
    this.leftFrame.position.set(-(screenWidth / 2 + this.bezelThickness / 2), 4.72, -4.44);
    this.group.add(this.leftFrame);

    this.rightFrame = new THREE.Mesh(vFrameGeo, frameMat);
    this.rightFrame.position.set(screenWidth / 2 + this.bezelThickness / 2, 4.72, -4.44);
    this.group.add(this.rightFrame);

    // Inner Glowing LED Trim along Aperture Border
    const innerBorderPoints = [
      new THREE.Vector3(-screenWidth / 2, -screenHeight / 2, -4.43),
      new THREE.Vector3(screenWidth / 2, -screenHeight / 2, -4.43),
      new THREE.Vector3(screenWidth / 2, screenHeight / 2, -4.43),
      new THREE.Vector3(-screenWidth / 2, screenHeight / 2, -4.43),
      new THREE.Vector3(-screenWidth / 2, -screenHeight / 2, -4.43),
    ];
    const innerBorderGeo = new THREE.BufferGeometry().setFromPoints(innerBorderPoints);
    const innerBorderMat = new THREE.LineBasicMaterial({ color: 0x00f0ff, linewidth: 2 });
    this.innerBorderLine = new THREE.Line(innerBorderGeo, innerBorderMat);
    this.innerBorderLine.position.set(0, 4.72, 0);
    this.group.add(this.innerBorderLine);
    this.disposables.push(innerBorderGeo, innerBorderMat);

    // Apply initial video active state if provided in context
    if (context.hasVideo) {
      this.setVideoActive(true);
    }

    // 3. Heavy-Duty Aluminum Box-Truss Roof & Framework (Matching photo)
    this.createBoxTrussRig(screenWidth, screenHeight);

    // 4. Performer / DJ Platform in front of Screen
    const djRiserGeo = new THREE.BoxGeometry(5.0, 0.9, 1.8);
    const djRiserMat = new THREE.MeshStandardMaterial({
      color: 0x080a12,
      roughness: 0.5,
      metalness: 0.7,
    });
    const djRiser = new THREE.Mesh(djRiserGeo, djRiserMat);
    djRiser.position.set(0, 0.0, -1.0);
    this.group.add(djRiser);
    this.disposables.push(djRiserGeo, djRiserMat);

    // Initial resize synchronization if window is present
    if (typeof window !== 'undefined') {
      this.resize(window.innerWidth, window.innerHeight);
    }
  }

  /**
   * Aluminum box-truss roof structure matching the real concert stage photo
   */
  private createBoxTrussRig(screenWidth: number, screenHeight: number): void {
    const trussMat = new THREE.MeshStandardMaterial({
      color: 0x5a6880,
      metalness: 0.95,
      roughness: 0.3,
      wireframe: true,
    });

    // Overhead horizontal roof truss spanning above the screen
    const roofTrussGeo = new THREE.BoxGeometry(screenWidth + 6.0, 1.4, 1.8);
    this.disposables.push(roofTrussGeo, trussMat);
    this.roofTruss = new THREE.Mesh(roofTrussGeo, trussMat);
    this.roofTruss.position.set(0, 4.72 + screenHeight / 2 + 1.2, -4.2);
    this.group.add(this.roofTruss);

    // Secondary front lighting truss hanging overhead
    const frontRoofGeo = new THREE.BoxGeometry(screenWidth + 4.0, 1.0, 1.2);
    this.disposables.push(frontRoofGeo);
    this.frontRoofTruss = new THREE.Mesh(frontRoofGeo, trussMat);
    this.frontRoofTruss.position.set(0, 11.8, 1.5);
    this.group.add(this.frontRoofTruss);

    // Left and Right vertical truss support towers
    const towerGeo = new THREE.BoxGeometry(1.4, 14.5, 1.4);
    this.disposables.push(towerGeo);

    this.leftTower = new THREE.Mesh(towerGeo, trussMat);
    this.leftTower.position.set(-(screenWidth / 2 + 1.8), 5.5, -4.2);
    this.group.add(this.leftTower);

    this.rightTower = new THREE.Mesh(towerGeo, trussMat);
    this.rightTower.position.set((screenWidth / 2 + 1.8), 5.5, -4.2);
    this.group.add(this.rightTower);

    // Stage side acoustic scrims / black masking wings
    const scrimGeo = new THREE.PlaneGeometry(6.0, 13.0);
    const scrimMat = new THREE.MeshBasicMaterial({ color: 0x020306, side: THREE.DoubleSide });
    this.disposables.push(scrimGeo, scrimMat);

    this.leftScrim = new THREE.Mesh(scrimGeo, scrimMat);
    this.leftScrim.position.set(-(screenWidth / 2 + 5.0), 5.2, -4.4);
    this.leftScrim.rotation.y = 0.35;
    this.group.add(this.leftScrim);

    this.rightScrim = new THREE.Mesh(scrimGeo, scrimMat);
    this.rightScrim.position.set((screenWidth / 2 + 5.0), 5.2, -4.4);
    this.rightScrim.rotation.y = -0.35;
    this.group.add(this.rightScrim);
  }

  public override resize(width: number, height: number): void {
    const dims = calculateStageDimensions(width, height);
    const sw = dims.screenWidth;
    const sh = dims.screenHeight;
    const cy = dims.screenCenterY;
    const halfW = dims.halfWidth;
    const halfH = dims.halfHeight;
    const scaleX = sw / this.baseScreenWidth;
    const scaleY = sh / this.baseScreenHeight;

    if (this.screenMesh) {
      this.screenMesh.scale.set(scaleX, scaleY, 1);
      this.screenMesh.position.set(0, cy, -4.5);
    }
    if (this.backWallMesh) {
      this.backWallMesh.scale.set(
        (sw + 1.2) / (this.baseScreenWidth + 1.2),
        (sh + 1.2) / (this.baseScreenHeight + 1.2),
        1
      );
      this.backWallMesh.position.set(0, cy, -4.75);
    }
    if (this.topMask) {
      this.topMask.position.set(0, cy + halfH + 12.0, -4.46);
    }
    if (this.btmMask) {
      this.btmMask.position.set(0, cy - halfH - 10.0, -4.46);
    }
    if (this.leftMask) {
      this.leftMask.position.set(-(halfW + 20.0), cy, -4.46);
    }
    if (this.rightMask) {
      this.rightMask.position.set(halfW + 20.0, cy, -4.46);
    }
    if (this.topFrame) {
      this.topFrame.scale.set(
        (sw + this.bezelThickness * 2) / (this.baseScreenWidth + this.bezelThickness * 2),
        1,
        1
      );
      this.topFrame.position.set(0, cy + halfH + this.bezelThickness / 2, -4.44);
    }
    if (this.btmFrame) {
      this.btmFrame.scale.set(
        (sw + this.bezelThickness * 2) / (this.baseScreenWidth + this.bezelThickness * 2),
        1,
        1
      );
      this.btmFrame.position.set(0, cy - halfH - this.bezelThickness / 2, -4.44);
    }
    if (this.leftFrame) {
      this.leftFrame.scale.set(1, scaleY, 1);
      this.leftFrame.position.set(-(halfW + this.bezelThickness / 2), cy, -4.44);
    }
    if (this.rightFrame) {
      this.rightFrame.scale.set(1, scaleY, 1);
      this.rightFrame.position.set(halfW + this.bezelThickness / 2, cy, -4.44);
    }
    if (this.innerBorderLine) {
      this.innerBorderLine.scale.set(scaleX, scaleY, 1);
      this.innerBorderLine.position.set(0, cy, 0);
    }
    if (this.roofTruss) {
      this.roofTruss.scale.set((sw + 6.0) / (this.baseScreenWidth + 6.0), 1, 1);
      this.roofTruss.position.set(0, cy + halfH + 1.2, -4.2);
    }
    if (this.frontRoofTruss) {
      this.frontRoofTruss.scale.set((sw + 4.0) / (this.baseScreenWidth + 4.0), 1, 1);
      this.frontRoofTruss.position.set(0, cy + halfH + 1.6, 1.5);
    }
    if (this.leftTower) {
      this.leftTower.position.set(-(halfW + 1.8), cy + 0.8, -4.2);
    }
    if (this.rightTower) {
      this.rightTower.position.set(halfW + 1.8, cy + 0.8, -4.2);
    }
    if (this.leftScrim) {
      this.leftScrim.position.set(-(halfW + 5.0), cy + 0.5, -4.4);
    }
    if (this.rightScrim) {
      this.rightScrim.position.set(halfW + 5.0, cy + 0.5, -4.4);
    }
  }

  public update(context: VisualEffectContext): void {
    if (context.hasVideo !== undefined && context.hasVideo !== this.hasVideo) {
      this.setVideoActive(context.hasVideo);
    }

    if (this.hasVideo) {
      // YouTube video is playing behind the transparent stage screen opening
      return;
    }

    const { features } = context;

    // Render solid pitch-black screen with centered track details illuminated by spotlight glow
    this.stageScreenThemes.render({
      features,
      timeSeconds: context.trackTimeSeconds || performance.now() * 0.001,
      trackTitle: context.trackTitle || 'SYNWAVE',
      trackArtist: context.trackArtist || 'STAGE READY • SELECT OR DROP AUDIO',
      currentSection: features.isDrop ? 'DROP' : features.isKick ? 'CLIMAX' : 'VERSE',
      themeIndex: 0,
      mood: context.mood || features.mood || 'uplifting-melodic',
      spotlightColor: context.palette.primary,
    });
    this.screenTexture.needsUpdate = true;
  }
}
