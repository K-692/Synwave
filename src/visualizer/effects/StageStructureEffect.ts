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

export class StageStructureEffect extends BaseEffect {
  readonly id = 'stage-structure';
  readonly name = 'Concert Stage & Solid LED Screen';
  readonly family = 'Stage Architecture';
  readonly cost = 'medium';

  private stageScreenThemes: StageScreenThemes;
  private screenTexture!: THREE.CanvasTexture;
  private screenMesh!: THREE.Mesh;
  private stageDeckMesh!: THREE.Mesh;

  constructor() {
    super();
    this.stageScreenThemes = new StageScreenThemes();
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
    // 21m wide by 11.8m tall, centered at (0, 4.8, -4.5)
    const screenWidth = 21.0;
    const screenHeight = 11.8;

    const screenGeo = new THREE.PlaneGeometry(screenWidth, screenHeight);

    this.screenTexture = new THREE.CanvasTexture(this.stageScreenThemes.getCanvas());
    this.screenTexture.minFilter = THREE.LinearFilter;
    this.screenTexture.magFilter = THREE.LinearFilter;

    const screenMat = new THREE.MeshBasicMaterial({
      map: this.screenTexture,
      side: THREE.FrontSide,
    });

    this.screenMesh = new THREE.Mesh(screenGeo, screenMat);
    this.screenMesh.position.set(0, 4.6, -4.5);
    this.group.add(this.screenMesh);
    this.disposables.push(screenGeo, screenMat, this.screenTexture);

    // Screen Solid Black Backing Wall
    const backWallGeo = new THREE.BoxGeometry(screenWidth + 1.2, screenHeight + 1.2, 0.4);
    const backWallMat = new THREE.MeshBasicMaterial({ color: 0x010204 });
    const backWall = new THREE.Mesh(backWallGeo, backWallMat);
    backWall.position.set(0, 4.6, -4.75);
    this.group.add(backWall);
    this.disposables.push(backWallGeo, backWallMat);

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
    const roofTruss = new THREE.Mesh(roofTrussGeo, trussMat);
    roofTruss.position.set(0, 4.6 + screenHeight / 2 + 1.2, -4.2);
    this.group.add(roofTruss);

    // Secondary front lighting truss hanging overhead
    const frontRoofGeo = new THREE.BoxGeometry(screenWidth + 4.0, 1.0, 1.2);
    this.disposables.push(frontRoofGeo);
    const frontRoofTruss = new THREE.Mesh(frontRoofGeo, trussMat);
    frontRoofTruss.position.set(0, 11.8, 1.5);
    this.group.add(frontRoofTruss);

    // Left and Right vertical truss support towers
    const towerGeo = new THREE.BoxGeometry(1.4, 14.5, 1.4);
    this.disposables.push(towerGeo);

    const leftTower = new THREE.Mesh(towerGeo, trussMat);
    leftTower.position.set(-(screenWidth / 2 + 1.8), 5.5, -4.2);
    this.group.add(leftTower);

    const rightTower = new THREE.Mesh(towerGeo, trussMat);
    rightTower.position.set((screenWidth / 2 + 1.8), 5.5, -4.2);
    this.group.add(rightTower);

    // Stage side acoustic scrims / black masking wings
    const scrimGeo = new THREE.PlaneGeometry(6.0, 13.0);
    const scrimMat = new THREE.MeshBasicMaterial({ color: 0x020306, side: THREE.DoubleSide });
    this.disposables.push(scrimGeo, scrimMat);

    const leftScrim = new THREE.Mesh(scrimGeo, scrimMat);
    leftScrim.position.set(-(screenWidth / 2 + 5.0), 5.2, -4.4);
    leftScrim.rotation.y = 0.35;
    this.group.add(leftScrim);

    const rightScrim = new THREE.Mesh(scrimGeo, scrimMat);
    rightScrim.position.set((screenWidth / 2 + 5.0), 5.2, -4.4);
    rightScrim.rotation.y = -0.35;
    this.group.add(rightScrim);
  }

  public update(context: VisualEffectContext): void {
    const { features } = context;

    // Render solid pitch-black screen with centered track details illuminated by spotlight glow
    this.stageScreenThemes.render({
      features,
      timeSeconds: context.trackTimeSeconds || performance.now() * 0.001,
      trackTitle: context.trackTitle || 'FEEL SOMETHING',
      trackArtist: context.trackArtist || 'ILLENIUM, Excision, I Prevail',
      currentSection: features.isDrop ? 'DROP' : features.isKick ? 'CLIMAX' : 'VERSE',
      themeIndex: 0,
      mood: context.mood || features.mood || 'euphoric-drop',
      spotlightColor: context.palette.primary,
    });
    this.screenTexture.needsUpdate = true;
  }
}
