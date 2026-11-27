import * as THREE from 'three';
import { BallPhysics, TrackSegment, ObstacleData, BoosterData, GameSettings } from './types';
import { BALL_RADIUS, platformTopAt, obstacleXAt } from './physics';

export interface GameEngineCallbacks {
  onScoreUpdate: (score: number) => void;
  onGameOver: (finalScore: number, cause: 'fall' | 'obstacle') => void;
  onBoost: () => void;
  onJump: () => void;
}

/**
 * Creates a procedural cyber grid canvas texture with glowing lines
 */
function createNeonGridTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  // Dark cyber metallic background
  ctx.fillStyle = '#090714';
  ctx.fillRect(0, 0, 256, 256);

  // Subtle interior grid
  ctx.strokeStyle = 'rgba(0, 255, 140, 0.18)';
  ctx.lineWidth = 2;
  const step = 32;
  for (let x = 0; x <= 256; x += step) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, 256);
    ctx.stroke();
  }
  for (let y = 0; y <= 256; y += step) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(256, y);
    ctx.stroke();
  }

  // Bright border lines for edge contours
  ctx.strokeStyle = '#00ff88';
  ctx.lineWidth = 6;
  ctx.strokeRect(0, 0, 256, 256);

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/**
 * Creates procedural booster arrow / chevron texture
 */
function createBoosterTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = 'rgba(0, 0, 0, 0)';
  ctx.fillRect(0, 0, 128, 256);

  // Draw 3 glowing forward yellow/cyan chevrons
  for (let i = 0; i < 3; i++) {
    const yCenter = 40 + i * 80;
    ctx.strokeStyle = i === 1 ? '#00f3ff' : '#ffe600';
    ctx.lineWidth = 14;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    ctx.beginPath();
    ctx.moveTo(24, yCenter + 26);
    ctx.lineTo(64, yCenter - 26);
    ctx.lineTo(104, yCenter + 26);
    ctx.stroke();

    // Inner bright core
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 4;
    ctx.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/**
 * Creates procedural cyber sphere texture with glowing latitude/longitude lines
 */
function createSphereCyberTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  // Deep obsidian sphere base
  ctx.fillStyle = '#080512';
  ctx.fillRect(0, 0, 512, 256);

  // Hexagonal or grid matrix with soft glow
  ctx.shadowColor = '#00f3ff';
  ctx.shadowBlur = 6;
  ctx.strokeStyle = '#00f3ff';
  ctx.lineWidth = 3;

  // Meridians
  for (let x = 0; x <= 512; x += 32) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, 256);
    ctx.stroke();
  }
  // Parallels
  for (let y = 0; y <= 256; y += 32) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(512, y);
    ctx.stroke();
  }

  // Glowing equatorial accent band
  ctx.shadowColor = '#00ff88';
  ctx.shadowBlur = 10;
  ctx.strokeStyle = '#00ff88';
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.moveTo(0, 128);
  ctx.lineTo(512, 128);
  ctx.stroke();

  // White center core line
  ctx.shadowBlur = 0;
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, 128);
  ctx.lineTo(512, 128);
  ctx.stroke();

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export class GameEngine {
  private container: HTMLElement;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private isSoftwareGl = false;

  // Visual Meshes
  private ballGroup: THREE.Group;
  private ballMesh: THREE.Mesh;
  private ballInnerCore: THREE.Mesh;
  private contactShadow: THREE.Mesh;

  // Track rendering
  private trackGroup: THREE.Group;
  private activeSegmentMeshes: Map<TrackSegment, THREE.Group> = new Map();

  // Background Scenery (Cyber Skyscrapers)
  private sceneryGroup: THREE.Group;

  // Particles
  private trailParticles: THREE.Points;
  private particlePositions: Float32Array;
  private particleAlphas: Float32Array;
  private particleCount = 60;
  private particleIndex = 0;

  // Shared reusable textures and materials
  private gridTexture: THREE.CanvasTexture;
  private boosterTexture: THREE.CanvasTexture;
  private platformMaterial: THREE.MeshStandardMaterial;
  private obstacleMaterial: THREE.MeshStandardMaterial;
  private movingObstacleMaterial: THREE.MeshStandardMaterial;
  private boosterMaterial: THREE.MeshBasicMaterial;
  private edgeGlowMaterial: THREE.LineBasicMaterial;

  // Animation frame loop
  private animFrameId = 0;
  private isRunning = false;
  private lastTime = 0;

  // Settings
  private settings: GameSettings;

  constructor(container: HTMLElement, settings: GameSettings) {
    this.container = container;
    this.settings = settings;

    // 1. Detect Software GL
    this.isSoftwareGl = (() => {
      try {
        const gl = document.createElement('canvas').getContext('webgl2');
        if (!gl) return true;
        const ext = gl.getExtension('WEBGL_debug_renderer_info');
        const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
        const gpu = String(gl.getParameter(param));
        gl.getExtension('WEBGL_lose_context')?.loseContext();
        return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
      } catch {
        return true;
      }
    })();

    // 2. Initialize Three.js Renderer
    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl && settings.graphics === 'high',
      powerPreference: 'high-performance',
      alpha: false,
    });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(
      this.isSoftwareGl || settings.graphics === 'low' ? 1 : Math.min(window.devicePixelRatio, 2)
    );
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.renderer.domElement.style.display = 'block';
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    this.container.appendChild(this.renderer.domElement);

    // 3. Scene & Fog (linear fog for clear visibility of upcoming track)
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x06020c);
    this.scene.fog = new THREE.Fog(0x06020c, 50, 360);

    // 4. Camera - 65deg FOV, positioned behind and slightly above
    this.camera = new THREE.PerspectiveCamera(65, width / height, 0.1, 800);
    this.camera.position.set(0, 2.7, -6.2);

    // 5. Lighting
    const hemiLight = new THREE.HemisphereLight(0x00f3ff, 0x140624, 1.2);
    this.scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xffffff, 1.6);
    keyLight.position.set(20, 50, 15);
    this.scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0x00ff88, 1.1);
    rimLight.position.set(-15, 12, -20);
    this.scene.add(rimLight);

    // Additional subtle track spotlight following ahead
    const trackLight = new THREE.DirectionalLight(0x00f3ff, 0.6);
    trackLight.position.set(0, 20, 30);
    this.scene.add(trackLight);

    // 6. Pre-allocate Textures & Materials
    this.gridTexture = createNeonGridTexture();
    this.boosterTexture = createBoosterTexture();
    const sphereTexture = createSphereCyberTexture();

    this.platformMaterial = new THREE.MeshStandardMaterial({
      map: this.gridTexture,
      roughness: 0.35,
      metalness: 0.85,
      emissive: 0x060c18,
      emissiveIntensity: 0.7,
      color: 0xffffff,
    });

    this.obstacleMaterial = new THREE.MeshStandardMaterial({
      color: 0x22050e,
      emissive: 0xff0044,
      emissiveIntensity: 1.1,
      roughness: 0.2,
      metalness: 0.7,
    });

    this.movingObstacleMaterial = new THREE.MeshStandardMaterial({
      color: 0x330814,
      emissive: 0xff1100,
      emissiveIntensity: 1.4,
      roughness: 0.2,
      metalness: 0.8,
    });

    this.boosterMaterial = new THREE.MeshBasicMaterial({
      map: this.boosterTexture,
      transparent: true,
      opacity: 0.95,
      side: THREE.DoubleSide,
    });

    this.edgeGlowMaterial = new THREE.LineBasicMaterial({
      color: 0x00ff88,
      linewidth: 3,
    });

    // 7. Track & Scenery Groups
    this.trackGroup = new THREE.Group();
    this.scene.add(this.trackGroup);

    this.sceneryGroup = new THREE.Group();
    this.scene.add(this.sceneryGroup);
    this.buildProceduralSkyscrapers();

    // 8. Ball Model (Composite 3-part hierarchy: dark sphere + glowing wireframe + inner core)
    this.ballGroup = new THREE.Group();

    // Main sphere
    const sphereGeo = new THREE.SphereGeometry(BALL_RADIUS, 32, 24);
    const sphereMat = new THREE.MeshStandardMaterial({
      map: sphereTexture,
      roughness: 0.2,
      metalness: 0.85,
      emissive: 0x003344,
      emissiveIntensity: 0.75,
    });
    this.ballMesh = new THREE.Mesh(sphereGeo, sphereMat);
    this.ballGroup.add(this.ballMesh);

    // Inner glowing core
    const coreGeo = new THREE.SphereGeometry(BALL_RADIUS * 0.5, 16, 12);
    const coreMat = new THREE.MeshBasicMaterial({
      color: 0x00f3ff,
      wireframe: true,
      transparent: true,
      opacity: 0.6,
    });
    this.ballInnerCore = new THREE.Mesh(coreGeo, coreMat);
    this.ballGroup.add(this.ballInnerCore);

    // Contact shadow
    const shadowGeo = new THREE.CircleGeometry(BALL_RADIUS * 1.1, 24);
    const shadowMat = new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.5,
      depthWrite: false,
    });
    this.contactShadow = new THREE.Mesh(shadowGeo, shadowMat);
    this.contactShadow.rotation.x = -Math.PI / 2;
    this.scene.add(this.contactShadow);

    this.scene.add(this.ballGroup);

    // 9. Particle Trail
    const pGeo = new THREE.BufferGeometry();
    this.particlePositions = new Float32Array(this.particleCount * 3);
    this.particleAlphas = new Float32Array(this.particleCount);

    pGeo.setAttribute('position', new THREE.BufferAttribute(this.particlePositions, 3));

    const pMat = new THREE.PointsMaterial({
      color: 0x00f3ff,
      size: 0.35,
      transparent: true,
      opacity: 0.8,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.trailParticles = new THREE.Points(pGeo, pMat);
    this.scene.add(this.trailParticles);

    // Resize listener
    window.addEventListener('resize', this.onWindowResize);
  }

  public updateSettings(settings: GameSettings) {
    this.settings = settings;
    if (this.renderer) {
      this.renderer.setPixelRatio(
        this.isSoftwareGl || settings.graphics === 'low' ? 1 : Math.min(window.devicePixelRatio, 2)
      );
    }
  }

  /**
   * Builds procedural cyber skyscrapers in the background flanking the track
   */
  private buildProceduralSkyscrapers() {
    const buildingGeo = new THREE.BoxGeometry(1, 1, 1);
    const edgeGeo = new THREE.EdgesGeometry(buildingGeo);

    const darkBuildingMat = new THREE.MeshBasicMaterial({ color: 0x090514 });
    const cyanLineMat = new THREE.LineBasicMaterial({ color: 0x00f3ff, transparent: true, opacity: 0.3 });
    const greenLineMat = new THREE.LineBasicMaterial({ color: 0x00ff88, transparent: true, opacity: 0.25 });
    const purpleLineMat = new THREE.LineBasicMaterial({ color: 0x9900ff, transparent: true, opacity: 0.2 });

    const buildingCount = 48;
    for (let i = 0; i < buildingCount; i++) {
      const bGroup = new THREE.Group();

      const width = 8 + Math.random() * 12;
      const height = 40 + Math.random() * 120;
      const depth = 8 + Math.random() * 16;

      const mesh = new THREE.Mesh(buildingGeo, darkBuildingMat);
      mesh.scale.set(width, height, depth);
      bGroup.add(mesh);

      const lineMat = i % 3 === 0 ? cyanLineMat : i % 3 === 1 ? greenLineMat : purpleLineMat;
      const wireframe = new THREE.LineSegments(edgeGeo, lineMat);
      wireframe.scale.set(width, height, depth);
      bGroup.add(wireframe);

      // Flank left or right
      const isLeft = Math.random() > 0.5;
      const x = isLeft ? -(24 + Math.random() * 45) : (24 + Math.random() * 45);
      const z = (i * 35) - 60;
      const y = height / 2 - 20;

      bGroup.position.set(x, y, z);
      this.sceneryGroup.add(bGroup);
    }
  }

  /**
   * Recycles and moves decorative skyscrapers to keep pace with player forward distance
   */
  public updateScenery(playerZ: number) {
    this.sceneryGroup.children.forEach((child) => {
      if (child.position.z < playerZ - 90) {
        child.position.z += 48 * 35; // Loop forward
      }
    });
  }

  /**
   * Synchronizes track segments with 3D meshes
   */
  public syncTrackSegments(segments: TrackSegment[]) {
    const activeSegments = new Set(segments);

    // 1. Remove meshes for segments that were recycled
    for (const [segment, group] of this.activeSegmentMeshes.entries()) {
      if (!activeSegments.has(segment)) {
        this.trackGroup.remove(group);
        // Dispose geometries in group
        group.traverse((obj) => {
          if (obj instanceof THREE.Mesh || obj instanceof THREE.Line) {
            obj.geometry.dispose();
          }
          if (obj instanceof THREE.Line && obj.material instanceof THREE.LineBasicMaterial && obj.material !== this.edgeGlowMaterial) {
            obj.material.dispose();
          }
        });
        this.activeSegmentMeshes.delete(segment);
      }
    }

    // 2. Create meshes for newly added segments
    for (const seg of segments) {
      if (!this.activeSegmentMeshes.has(seg)) {
        const segGroup = this.createSegmentMesh(seg);
        this.trackGroup.add(segGroup);
        this.activeSegmentMeshes.set(seg, segGroup);
      }
    }
  }

  private createSegmentMesh(seg: TrackSegment): THREE.Group {
    const group = new THREE.Group();
    group.position.set(seg.x, seg.y, seg.z);

    // Main platform box
    const platGeo = new THREE.BoxGeometry(seg.width, seg.height, seg.length);
    if (seg.rampAngle) {
      const vertices = platGeo.attributes.position;
      for (let i = 0; i < vertices.count; i++) {
        const worldZ = seg.z + vertices.getZ(i);
        const rise = platformTopAt(seg, worldZ) - seg.y - seg.height / 2;
        vertices.setY(i, vertices.getY(i) + rise);
      }
      platGeo.computeVertexNormals();
    }
    const platMesh = new THREE.Mesh(platGeo, this.platformMaterial);
    group.add(platMesh);

    // Glowing edge contour lines on top edges
    const topEdges = new THREE.EdgesGeometry(platGeo);
    const edgeLines = new THREE.LineSegments(topEdges, this.edgeGlowMaterial);
    group.add(edgeLines);

    // Boosters
    for (const b of seg.boosters) {
      const bGeo = new THREE.PlaneGeometry(b.width, b.depth / Math.cos(seg.rampAngle ?? 0));
      const bMesh = new THREE.Mesh(bGeo, this.boosterMaterial);
      bMesh.rotation.x = -Math.PI / 2 - (seg.rampAngle ?? 0);
      bMesh.position.set(b.x - seg.x, platformTopAt(seg, b.z) - seg.y + 0.02, b.z - seg.z);
      group.add(bMesh);
    }

    // Obstacles
    for (const obs of seg.obstacles) {
      const obsGeo = new THREE.BoxGeometry(obs.width, obs.height, obs.depth);
      const mat = obs.type === 'moving_horizontal' ? this.movingObstacleMaterial : this.obstacleMaterial;
      const obsMesh = new THREE.Mesh(obsGeo, mat);
      obsMesh.name = obs.id;
      obsMesh.position.set(obs.x - seg.x, obs.y - seg.y, obs.z - seg.z);

      // Bright wireframe contour around obstacle for maximum visibility
      const obsEdges = new THREE.EdgesGeometry(obsGeo);
      const wireColor = obs.type === 'moving_horizontal' ? 0xff4400 : 0xff0055;
      const obsWire = new THREE.LineSegments(obsEdges, new THREE.LineBasicMaterial({ color: wireColor }));
      obsMesh.add(obsWire);

      group.add(obsMesh);
    }

    // Cyber Tunnel Arches
    if (seg.hasTunnel) {
      const archCount = 5;
      const archSpacing = seg.length / archCount;
      const tunnelMat = new THREE.LineBasicMaterial({
        color: seg.tunnelColor ? new THREE.Color(seg.tunnelColor) : 0x00ff88,
        linewidth: 2,
      });

      for (let i = 0; i < archCount; i++) {
        const archZ = -seg.length / 2 + i * archSpacing + archSpacing / 2;
        // Inverted U shape arch
        const points = [
          new THREE.Vector3(-seg.width / 2, seg.height / 2, archZ),
          new THREE.Vector3(-seg.width / 2, seg.height / 2 + 5.5, archZ),
          new THREE.Vector3(seg.width / 2, seg.height / 2 + 5.5, archZ),
          new THREE.Vector3(seg.width / 2, seg.height / 2, archZ),
        ];
        const archGeo = new THREE.BufferGeometry().setFromPoints(points);
        const archLine = new THREE.Line(archGeo, tunnelMat);
        group.add(archLine);
      }
    }

    return group;
  }

  /**
   * Updates moving obstacles positions inside Three.js
   */
  public updateDynamicObstacles(segments: TrackSegment[], time: number) {
    for (const seg of segments) {
      const group = this.activeSegmentMeshes.get(seg);
      if (!group) continue;

      for (const obs of seg.obstacles) {
        if (obs.type === 'moving_horizontal' && obs.speed !== undefined && obs.phase !== undefined) {
          const obsMesh = group.getObjectByName(obs.id);
          if (obsMesh) {
            obsMesh.position.x = obstacleXAt(obs, time) - seg.x;
          }
        }
      }
    }
  }

  /**
   * Updates the ball mesh transform and trail particles
   */
  public updateBall(ball: BallPhysics, dt: number) {
    if (!ball.alive) {
      // In game over, trigger shatter / sinking
      this.ballGroup.scale.multiplyScalar(0.96);
      this.contactShadow.visible = false;
      return;
    }

    this.ballGroup.scale.set(1, 1, 1);
    this.ballGroup.position.set(ball.x, ball.y, ball.z);

    // Apply pitch and roll to ball mesh
    this.ballMesh.rotation.x = ball.pitch;
    this.ballMesh.rotation.z = ball.roll;
    this.ballInnerCore.rotation.x = -ball.pitch * 0.7;
    this.ballInnerCore.rotation.y += dt * 3;

    // Contact shadow
    if (ball.grounded) {
      this.contactShadow.visible = true;
      this.contactShadow.position.set(ball.x, ball.y - ball.radius + 0.03, ball.z);
    } else {
      this.contactShadow.visible = false;
    }

    // Add trail particle
    if (ball.grounded || ball.boostTimer > 0) {
      const pIdx = this.particleIndex % this.particleCount;
      const offset = (Math.random() - 0.5) * 0.3;
      this.particlePositions[pIdx * 3] = ball.x + offset;
      this.particlePositions[pIdx * 3 + 1] = ball.y - ball.radius * 0.5;
      this.particlePositions[pIdx * 3 + 2] = ball.z - 0.4;
      this.particleIndex++;
      this.trailParticles.geometry.attributes.position.needsUpdate = true;
    }

    // Scroll booster textures for animated glow
    this.boosterTexture.offset.y -= dt * 2.5;
  }

  /**
   * Smooth camera tracking with subtle dynamic lean and FOV kick.
   * Keeps ball placed comfortably in the lower third of screen.
   */
  public updateCamera(ball: BallPhysics, dt: number, snap = false) {
    const targetX = ball.x * 0.65;
    const targetY = ball.y + 2.7;
    const targetZ = ball.z - 6.4;

    // Frame-rate independent exponential damping
    const lambda = 12.0;
    const factor = snap ? 1 : 1 - Math.exp(-lambda * dt);

    this.camera.position.x += (targetX - this.camera.position.x) * factor;
    this.camera.position.y += (targetY - this.camera.position.y) * factor;
    this.camera.position.z += (targetZ - this.camera.position.z) * factor;

    // Look forward down the track: slightly higher to anchor ball in lower 35% of screen
    const lookAtX = ball.x * 0.35;
    const lookAtY = ball.y + 1.8;
    const lookAtZ = ball.z + 24.0;

    // Dynamic roll tilt on steering using camera.up vector (never mutate rotation.z after lookAt!)
    const rollTilt = THREE.MathUtils.clamp(-ball.vx * 0.008, -0.06, 0.06);
    this.camera.up.set(rollTilt, 1, 0).normalize();
    this.camera.lookAt(lookAtX, lookAtY, lookAtZ);

    // Dynamic FOV kick on speed boost
    const targetFov = ball.boostTimer > 0 ? 73 : 65;
    this.camera.fov += (targetFov - this.camera.fov) * factor;
    this.camera.updateProjectionMatrix();
  }

  public render() {
    this.renderer.render(this.scene, this.camera);
  }

  public getIsSoftwareGl(): boolean {
    return this.isSoftwareGl;
  }

  private onWindowResize = () => {
    if (!this.container) return;
    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  };

  public dispose() {
    window.removeEventListener('resize', this.onWindowResize);
    cancelAnimationFrame(this.animFrameId);

    // Dispose all meshes and textures
    this.scene.clear();
    this.gridTexture.dispose();
    this.boosterTexture.dispose();
    this.platformMaterial.dispose();
    this.obstacleMaterial.dispose();
    this.movingObstacleMaterial.dispose();
    this.boosterMaterial.dispose();
    this.edgeGlowMaterial.dispose();
    this.renderer.dispose();

    if (this.renderer.domElement.parentElement) {
      this.renderer.domElement.parentElement.removeChild(this.renderer.domElement);
    }
  }
}
