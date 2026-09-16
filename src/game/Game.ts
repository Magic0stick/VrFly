import * as THREE from 'three';
import { MultiplayerManager, PlayerData, NetworkMessage } from './MultiplayerManager';

interface Bug {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  targetPoint: THREE.Vector3;
  speed: number;
  health: number;
}

interface Bullet {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  life: number;
}

interface Troop {
  mesh: THREE.Group;
  velocity: THREE.Vector3;
  landed: boolean;
  health: number;
}

interface Drone {
  mesh: THREE.Group;
  velocity: THREE.Vector3;
  health: number;
  orbitCenter: THREE.Vector3;
  orbitRadius: number;
  orbitSpeed: number;
  orbitAngle: number;
}

interface RemotePlayer {
  id: string;
  name: string;
  mesh: THREE.Group;
  nameSprite: THREE.Sprite;
  targetPosition: THREE.Vector3;
  targetRotation: THREE.Euler;
  inAirplane: boolean;
  health: number;
  score: number;
}

interface Lever {
  mesh: THREE.Mesh;
  baseRotation: number;
  currentRotation: number;
  targetRotation: number;
  axis: 'x' | 'z';
  name: string;
}

interface Button {
  mesh: THREE.Mesh;
  pressed: boolean;
  color: number;
  name: string;
  onPressed: () => void;
}

export class VRGame {
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private clock: THREE.Clock;
  
  private cockpit: THREE.Group;
  private airplane: THREE.Group;
  private bugs: Bug[] = [];
  private bullets: Bullet[] = [];
  private troops: Troop[] = [];
  private drones: Drone[] = [];
  private levers: Lever[] = [];
  private buttons: Button[] = [];
  
  // Multiplayer
  private multiplayer: MultiplayerManager;
  private remotePlayers: Map<string, RemotePlayer> = new Map();
  private lastNetworkUpdate: number = 0;
  private networkUpdateInterval: number = 50; // ms
  
  private controllers: THREE.Group[] = [];
  private controllerGrips: THREE.Group[] = [];
  
  private enginePower: number = 0.5;
  private rudderAngle: number = 0;
  private elevatorAngle: number = 0;
  private machineGunActive: boolean = false;
  private machineGunCooldown: number = 0;
  private score: number = 0;
  
  private raycaster: THREE.Raycaster;
  private tempMatrix: THREE.Matrix4;
  
  private ground: THREE.Mesh | null = null;
  private skybox: THREE.Mesh | null = null;
  
  private isVR: boolean = false;
  private animationId: number = 0;
  private elapsedTime: number = 0;
  
  // VR system detection
  private vrSystem: 'steamvr' | 'oculus' | 'wmr' | 'unknown' = 'unknown';
  private controllerProfiles: string[] = [];
  
  // UI elements
  private hudGroup: THREE.Group;
  private scoreText: THREE.Sprite | null = null;
  
  // Flight parameters
  private altitude: number = 500;
  private speed: number = 100;
  private heading: number = 0;

  constructor(private container: HTMLElement) {
    this.clock = new THREE.Clock();
    this.raycaster = new THREE.Raycaster();
    this.tempMatrix = new THREE.Matrix4();
    this.multiplayer = new MultiplayerManager();
    
    // Renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.xr.enabled = true;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.2;
    container.appendChild(this.renderer.domElement);
    
    // Scene
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x87CEEB, 0.00015);
    
    // Camera
    this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 10000);
    this.camera.position.set(0, 1.6, 0);
    
    // Groups
    this.cockpit = new THREE.Group();
    this.airplane = new THREE.Group();
    this.hudGroup = new THREE.Group();
    
    this.setupScene();
    this.setupLighting();
    this.setupCockpit();
    this.setupAirplaneExterior();
    this.setupEnvironment();
    this.setupBugs();
    this.setupDrones();
    this.setupControllers();
    this.setupHUD();
    this.setupChaperoneBounds();
    
    // Event listeners
    window.addEventListener('resize', this.onResize.bind(this));
    
    // Start render loop
    this.renderer.setAnimationLoop(this.animate.bind(this));
  }
  
  private setupScene(): void {
    // Sky gradient
    const skyGeo = new THREE.SphereGeometry(5000, 32, 32);
    const skyMat = new THREE.ShaderMaterial({
      uniforms: {
        topColor: { value: new THREE.Color(0x0077ff) },
        bottomColor: { value: new THREE.Color(0x87CEEB) },
        offset: { value: 400 },
        exponent: { value: 0.6 }
      },
      vertexShader: `
        varying vec3 vWorldPosition;
        void main() {
          vec4 worldPosition = modelMatrix * vec4(position, 1.0);
          vWorldPosition = worldPosition.xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 topColor;
        uniform vec3 bottomColor;
        uniform float offset;
        uniform float exponent;
        varying vec3 vWorldPosition;
        void main() {
          float h = normalize(vWorldPosition + offset).y;
          gl_FragColor = vec4(mix(bottomColor, topColor, max(pow(max(h, 0.0), exponent), 0.0)), 1.0);
        }
      `,
      side: THREE.BackSide
    });
    this.skybox = new THREE.Mesh(skyGeo, skyMat);
    this.scene.add(this.skybox);
    
    // Clouds
    this.createClouds();
  }
  
  private createClouds(): void {
    const cloudGeo = new THREE.SphereGeometry(1, 8, 8);
    const cloudMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.8,
      flatShading: true
    });
    
    for (let i = 0; i < 50; i++) {
      const cloud = new THREE.Group();
      const numPuffs = 5 + Math.floor(Math.random() * 5);
      
      for (let j = 0; j < numPuffs; j++) {
        const puff = new THREE.Mesh(cloudGeo, cloudMat);
        const scale = 20 + Math.random() * 40;
        puff.scale.set(scale, scale * 0.4, scale);
        puff.position.set(
          (Math.random() - 0.5) * 60,
          (Math.random() - 0.5) * 10,
          (Math.random() - 0.5) * 60
        );
        cloud.add(puff);
      }
      
      cloud.position.set(
        (Math.random() - 0.5) * 4000,
        200 + Math.random() * 800,
        (Math.random() - 0.5) * 4000
      );
      this.scene.add(cloud);
    }
  }
  
  private setupLighting(): void {
    const ambientLight = new THREE.AmbientLight(0x404040, 0.5);
    this.scene.add(ambientLight);
    
    const sunLight = new THREE.DirectionalLight(0xffffff, 1.5);
    sunLight.position.set(100, 200, 100);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    this.scene.add(sunLight);
    
    const hemisphereLight = new THREE.HemisphereLight(0x87CEEB, 0x3d5c3d, 0.4);
    this.scene.add(hemisphereLight);
  }
  
  private setupAirplaneExterior(): void {
    // Add airplane body parts visible from cockpit
    const airplaneGroup = new THREE.Group();
    
    // Nose cone (visible through windshield)
    const noseMat = new THREE.MeshStandardMaterial({ color: 0x556b2f, metalness: 0.6, roughness: 0.4 });
    
    // Left wing strut
    const strutGeo = new THREE.BoxGeometry(3, 0.1, 0.3);
    const leftStrut = new THREE.Mesh(strutGeo, noseMat);
    leftStrut.position.set(-2.5, -0.3, -0.5);
    leftStrut.rotation.z = -0.05;
    airplaneGroup.add(leftStrut);
    
    // Right wing strut
    const rightStrut = new THREE.Mesh(strutGeo, noseMat);
    rightStrut.position.set(2.5, -0.3, -0.5);
    rightStrut.rotation.z = 0.05;
    airplaneGroup.add(rightStrut);
    
    // Wing tips
    const wingTipGeo = new THREE.BoxGeometry(0.5, 0.05, 0.8);
    const wingTipMat = new THREE.MeshStandardMaterial({ color: 0xff0000, metalness: 0.3 });
    
    const leftTip = new THREE.Mesh(wingTipGeo, wingTipMat);
    leftTip.position.set(-4.2, -0.3, -0.5);
    airplaneGroup.add(leftTip);
    
    const rightTip = new THREE.Mesh(wingTipGeo, wingTipMat);
    rightTip.position.set(4.2, -0.3, -0.5);
    airplaneGroup.add(rightTip);
    
    // Engine nacelles
    const engineGeo = new THREE.CylinderGeometry(0.2, 0.25, 0.8, 8);
    const engineMat = new THREE.MeshStandardMaterial({ color: 0x444444, metalness: 0.8 });
    
    const leftEngine = new THREE.Mesh(engineGeo, engineMat);
    leftEngine.rotation.x = Math.PI / 2;
    leftEngine.position.set(-1.5, -0.5, -0.8);
    airplaneGroup.add(leftEngine);
    
    const rightEngine = new THREE.Mesh(engineGeo, engineMat);
    rightEngine.rotation.x = Math.PI / 2;
    rightEngine.position.set(1.5, -0.5, -0.8);
    airplaneGroup.add(rightEngine);
    
    // Propeller spinners
    const propGeo = new THREE.ConeGeometry(0.15, 0.3, 8);
    const propMat = new THREE.MeshStandardMaterial({ color: 0x222222, metalness: 0.9 });
    
    const leftProp = new THREE.Mesh(propGeo, propMat);
    leftProp.rotation.x = -Math.PI / 2;
    leftProp.position.set(-1.5, -0.5, -1.25);
    leftProp.name = 'propLeft';
    airplaneGroup.add(leftProp);
    
    const rightProp = new THREE.Mesh(propGeo, propMat);
    rightProp.rotation.x = -Math.PI / 2;
    rightProp.position.set(1.5, -0.5, -1.25);
    rightProp.name = 'propRight';
    airplaneGroup.add(rightProp);
    
    // Tail section hint
    const tailGeo = new THREE.BoxGeometry(0.1, 0.6, 0.8);
    const tail = new THREE.Mesh(tailGeo, noseMat);
    tail.position.set(0, 0.3, 1.5);
    airplaneGroup.add(tail);
    
    // Horizontal stabilizer
    const stabGeo = new THREE.BoxGeometry(1.5, 0.05, 0.4);
    const stab = new THREE.Mesh(stabGeo, noseMat);
    stab.position.set(0, 0.1, 1.5);
    airplaneGroup.add(stab);
    
    this.airplane.add(airplaneGroup);
    this.scene.add(this.airplane);
  }
  
  private setupEnvironment(): void {
    // Ground terrain
    const groundGeo = new THREE.PlaneGeometry(10000, 10000, 100, 100);
    const vertices = groundGeo.attributes.position.array as Float32Array;
    for (let i = 0; i < vertices.length; i += 3) {
      vertices[i + 2] = Math.sin(vertices[i] * 0.01) * 10 + Math.cos(vertices[i + 1] * 0.01) * 10;
    }
    groundGeo.computeVertexNormals();
    
    const groundMat = new THREE.MeshStandardMaterial({
      color: 0x3d5c3d,
      roughness: 0.9,
      flatShading: true
    });
    
    this.ground = new THREE.Mesh(groundGeo, groundMat);
    this.ground.rotation.x = -Math.PI / 2;
    this.ground.position.y = -10;
    this.ground.receiveShadow = true;
    this.scene.add(this.ground);
    
    // Add some trees
    this.createTrees();
    
    // Add buildings/structures
    this.createStructures();
    
    // Add water
    this.createWater();
    
    // Add mountains
    this.createMountains();
    
    // Add landing zone
    this.createLandingZone();
  }
  
  private createLandingZone(): void {
    // Landing zone circle
    const lzGeo = new THREE.RingGeometry(8, 10, 32);
    const lzMat = new THREE.MeshBasicMaterial({ 
      color: 0xffff00, 
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.7
    });
    const lz = new THREE.Mesh(lzGeo, lzMat);
    lz.rotation.x = -Math.PI / 2;
    lz.position.set(0, -9.4, 0);
    this.scene.add(lz);
    
    // Inner circle
    const innerGeo = new THREE.CircleGeometry(8, 32);
    const innerMat = new THREE.MeshBasicMaterial({ 
      color: 0x00ff00, 
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.3
    });
    const inner = new THREE.Mesh(innerGeo, innerMat);
    inner.rotation.x = -Math.PI / 2;
    inner.position.set(0, -9.3, 0);
    this.scene.add(inner);
    
    // "H" marker
    const hGeo = new THREE.PlaneGeometry(6, 6);
    const hCanvas = document.createElement('canvas');
    hCanvas.width = 256;
    hCanvas.height = 256;
    const hCtx = hCanvas.getContext('2d')!;
    hCtx.fillStyle = 'rgba(0,0,0,0)';
    hCtx.fillRect(0, 0, 256, 256);
    hCtx.fillStyle = '#ffffff';
    hCtx.font = 'bold 200px Arial';
    hCtx.textAlign = 'center';
    hCtx.textBaseline = 'middle';
    hCtx.fillText('H', 128, 128);
    
    const hTexture = new THREE.CanvasTexture(hCanvas);
    const hMat = new THREE.MeshBasicMaterial({ 
      map: hTexture, 
      transparent: true, 
      side: THREE.DoubleSide 
    });
    const hMesh = new THREE.Mesh(hGeo, hMat);
    hMesh.rotation.x = -Math.PI / 2;
    hMesh.position.set(0, -9.2, 0);
    this.scene.add(hMesh);
    
    // Beacon lights
    const beaconGeo = new THREE.CylinderGeometry(0.3, 0.3, 3, 8);
    const beaconMat = new THREE.MeshStandardMaterial({ 
      color: 0xff8800, 
      emissive: 0xff4400,
      emissiveIntensity: 0.5
    });
    
    for (let i = 0; i < 4; i++) {
      const angle = (i / 4) * Math.PI * 2;
      const beacon = new THREE.Mesh(beaconGeo, beaconMat);
      beacon.position.set(
        Math.cos(angle) * 12,
        -8,
        Math.sin(angle) * 12
      );
      this.scene.add(beacon);
    }
  }
  
  private createWater(): void {
    const waterGeo = new THREE.PlaneGeometry(10000, 10000);
    const waterMat = new THREE.MeshStandardMaterial({
      color: 0x006994,
      transparent: true,
      opacity: 0.7,
      metalness: 0.9,
      roughness: 0.1
    });
    const water = new THREE.Mesh(waterGeo, waterMat);
    water.rotation.x = -Math.PI / 2;
    water.position.y = -12;
    this.scene.add(water);
  }
  
  private createMountains(): void {
    const mountainMat = new THREE.MeshStandardMaterial({ 
      color: 0x5a5a5a, 
      flatShading: true,
      roughness: 0.9 
    });
    
    for (let i = 0; i < 30; i++) {
      const height = 50 + Math.random() * 200;
      const radius = 30 + Math.random() * 80;
      const mountainGeo = new THREE.ConeGeometry(radius, height, 6 + Math.floor(Math.random() * 4));
      
      // Deform vertices for natural look
      const vertices = mountainGeo.attributes.position.array as Float32Array;
      for (let v = 0; v < vertices.length; v += 3) {
        vertices[v] += (Math.random() - 0.5) * radius * 0.3;
        vertices[v + 1] += (Math.random() - 0.5) * 10;
        vertices[v + 2] += (Math.random() - 0.5) * radius * 0.3;
      }
      mountainGeo.computeVertexNormals();
      
      const mountain = new THREE.Mesh(mountainGeo, mountainMat);
      mountain.position.set(
        (Math.random() - 0.5) * 4000,
        height / 2 - 10,
        (Math.random() - 0.5) * 4000
      );
      mountain.castShadow = true;
      this.scene.add(mountain);
      
      // Snow cap
      if (height > 100) {
        const snowGeo = new THREE.ConeGeometry(radius * 0.3, height * 0.2, 6);
        const snowMat = new THREE.MeshStandardMaterial({ color: 0xffffff, flatShading: true });
        const snow = new THREE.Mesh(snowGeo, snowMat);
        snow.position.set(
          mountain.position.x,
          mountain.position.y + height * 0.4,
          mountain.position.z
        );
        this.scene.add(snow);
      }
    }
  }
  
  private createTrees(): void {
    const trunkGeo = new THREE.CylinderGeometry(0.5, 0.8, 5, 6);
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x4a3020 });
    const leavesGeo = new THREE.ConeGeometry(3, 8, 6);
    const leavesMat = new THREE.MeshStandardMaterial({ color: 0x2d5a1e, flatShading: true });
    
    for (let i = 0; i < 200; i++) {
      const tree = new THREE.Group();
      const trunk = new THREE.Mesh(trunkGeo, trunkMat);
      trunk.position.y = 2.5;
      tree.add(trunk);
      
      const leaves = new THREE.Mesh(leavesGeo, leavesMat);
      leaves.position.y = 8;
      tree.add(leaves);
      
      tree.position.set(
        (Math.random() - 0.5) * 3000,
        -10,
        (Math.random() - 0.5) * 3000
      );
      tree.scale.setScalar(1 + Math.random() * 2);
      this.scene.add(tree);
    }
  }
  
  private createStructures(): void {
    const buildingMat = new THREE.MeshStandardMaterial({ color: 0x808080, flatShading: true });
    
    for (let i = 0; i < 20; i++) {
      const w = 10 + Math.random() * 20;
      const h = 10 + Math.random() * 30;
      const d = 10 + Math.random() * 20;
      const buildingGeo = new THREE.BoxGeometry(w, h, d);
      const building = new THREE.Mesh(buildingGeo, buildingMat);
      building.position.set(
        (Math.random() - 0.5) * 2000,
        h / 2 - 10,
        (Math.random() - 0.5) * 2000
      );
      building.castShadow = true;
      this.scene.add(building);
    }
  }
  
  private setupCockpit(): void {
    // Main cockpit frame
    const cockpitFrame = new THREE.Group();
    
    // Floor
    const floorGeo = new THREE.BoxGeometry(3, 0.1, 3);
    const floorMat = new THREE.MeshStandardMaterial({ color: 0x333333, metalness: 0.5, roughness: 0.7 });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.position.y = -0.5;
    cockpitFrame.add(floor);
    
    // Dashboard
    const dashGeo = new THREE.BoxGeometry(2.5, 0.8, 0.3);
    const dashMat = new THREE.MeshStandardMaterial({ color: 0x2a2a2a, metalness: 0.7, roughness: 0.3 });
    const dashboard = new THREE.Mesh(dashGeo, dashMat);
    dashboard.position.set(0, 0.3, -1.2);
    dashboard.rotation.x = -0.3;
    cockpitFrame.add(dashboard);
    
    // Side panels
    const sidePanelGeo = new THREE.BoxGeometry(0.1, 1, 2);
    const sidePanelMat = new THREE.MeshStandardMaterial({ color: 0x3a3a3a, metalness: 0.5, roughness: 0.5 });
    
    const leftPanel = new THREE.Mesh(sidePanelGeo, sidePanelMat);
    leftPanel.position.set(-1.3, 0.2, -0.3);
    cockpitFrame.add(leftPanel);
    
    const rightPanel = new THREE.Mesh(sidePanelGeo, sidePanelMat);
    rightPanel.position.set(1.3, 0.2, -0.3);
    cockpitFrame.add(rightPanel);
    
    // Overhead panel
    const overheadGeo = new THREE.BoxGeometry(2, 0.05, 1.5);
    const overheadMat = new THREE.MeshStandardMaterial({ color: 0x2a2a2a, metalness: 0.6, roughness: 0.4 });
    const overhead = new THREE.Mesh(overheadGeo, overheadMat);
    overhead.position.set(0, 1.8, -0.5);
    cockpitFrame.add(overhead);
    
    // Windshield frame
    const frameMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, metalness: 0.8, roughness: 0.2 });
    const frameGeo = new THREE.BoxGeometry(2.8, 0.05, 0.05);
    for (let i = 0; i < 3; i++) {
      const frame = new THREE.Mesh(frameGeo, frameMat);
      frame.position.set(0, 0.8 + i * 0.5, -1.5);
      cockpitFrame.add(frame);
    }
    
    // Add interactive levers
    this.createLevers(cockpitFrame);
    
    // Add interactive buttons
    this.createButtons(cockpitFrame);
    
    // Add gauges/indicators
    this.createGauges(cockpitFrame);
    
    // Add machine gun model
    this.createMachineGun(cockpitFrame);
    
    this.cockpit.add(cockpitFrame);
    this.scene.add(this.cockpit);
  }
  
  private createMachineGun(parent: THREE.Group): void {
    const gunGroup = new THREE.Group();
    
    // Gun barrel
    const barrelGeo = new THREE.CylinderGeometry(0.02, 0.025, 0.8, 8);
    const gunMat = new THREE.MeshStandardMaterial({ color: 0x222222, metalness: 0.9, roughness: 0.2 });
    const barrel = new THREE.Mesh(barrelGeo, gunMat);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.z = -0.4;
    gunGroup.add(barrel);
    
    // Gun body
    const bodyGeo = new THREE.BoxGeometry(0.08, 0.06, 0.3);
    const body = new THREE.Mesh(bodyGeo, gunMat);
    body.position.z = -0.1;
    gunGroup.add(body);
    
    // Ammo belt
    const ammoGeo = new THREE.TorusGeometry(0.04, 0.01, 4, 8);
    const ammoMat = new THREE.MeshStandardMaterial({ color: 0xaa8800, metalness: 0.7 });
    const ammo = new THREE.Mesh(ammoGeo, ammoMat);
    ammo.position.set(0, -0.05, 0);
    ammo.rotation.x = Math.PI / 2;
    gunGroup.add(ammo);
    
    // Muzzle
    const muzzleGeo = new THREE.CylinderGeometry(0.03, 0.02, 0.05, 8);
    const muzzleMat = new THREE.MeshStandardMaterial({ color: 0x111111, metalness: 0.9 });
    const muzzle = new THREE.Mesh(muzzleGeo, muzzleMat);
    muzzle.rotation.x = Math.PI / 2;
    muzzle.position.z = -0.82;
    gunGroup.add(muzzle);
    
    gunGroup.position.set(0, 0.1, -1.3);
    parent.add(gunGroup);
  }
  
  private createLevers(parent: THREE.Group): void {
    const leverGeo = new THREE.CylinderGeometry(0.02, 0.03, 0.2, 8);
    const leverKnobGeo = new THREE.SphereGeometry(0.04, 8, 8);
    
    // Throttle lever (left side)
    const throttleGroup = new THREE.Group();
    const throttleLever = new THREE.Mesh(leverGeo, new THREE.MeshStandardMaterial({ color: 0x666666, metalness: 0.8 }));
    const throttleKnob = new THREE.Mesh(leverKnobGeo, new THREE.MeshStandardMaterial({ color: 0xff3333 }));
    throttleKnob.position.y = 0.1;
    throttleGroup.add(throttleLever);
    throttleGroup.add(throttleKnob);
    throttleGroup.position.set(-0.8, 0.1, -0.9);
    parent.add(throttleGroup);
    
    this.levers.push({
      mesh: throttleGroup as any,
      baseRotation: 0,
      currentRotation: 0,
      targetRotation: 0,
      axis: 'x',
      name: 'throttle'
    });
    
    // Rudder lever (right side)
    const rudderGroup = new THREE.Group();
    const rudderLever = new THREE.Mesh(leverGeo, new THREE.MeshStandardMaterial({ color: 0x666666, metalness: 0.8 }));
    const rudderKnob = new THREE.Mesh(leverKnobGeo, new THREE.MeshStandardMaterial({ color: 0x33ff33 }));
    rudderKnob.position.y = 0.1;
    rudderGroup.add(rudderLever);
    rudderGroup.add(rudderKnob);
    rudderGroup.position.set(0.8, 0.1, -0.9);
    parent.add(rudderGroup);
    
    this.levers.push({
      mesh: rudderGroup as any,
      baseRotation: 0,
      currentRotation: 0,
      targetRotation: 0,
      axis: 'x',
      name: 'rudder'
    });
    
    // Elevator lever (center-left)
    const elevatorGroup = new THREE.Group();
    const elevatorLever = new THREE.Mesh(leverGeo, new THREE.MeshStandardMaterial({ color: 0x666666, metalness: 0.8 }));
    const elevatorKnob = new THREE.Mesh(leverKnobGeo, new THREE.MeshStandardMaterial({ color: 0x3333ff }));
    elevatorKnob.position.y = 0.1;
    elevatorGroup.add(elevatorLever);
    elevatorGroup.add(elevatorKnob);
    elevatorGroup.position.set(-0.4, 0.1, -0.9);
    parent.add(elevatorGroup);
    
    this.levers.push({
      mesh: elevatorGroup as any,
      baseRotation: 0,
      currentRotation: 0,
      targetRotation: 0,
      axis: 'x',
      name: 'elevator'
    });
  }
  
  private createButtons(parent: THREE.Group): void {
    const buttonGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.02, 16);
    
    // Machine gun button (red, on dashboard)
    const gunButton = new THREE.Mesh(buttonGeo, new THREE.MeshStandardMaterial({ 
      color: 0xff0000, 
      emissive: 0x330000,
      metalness: 0.3,
      roughness: 0.5
    }));
    gunButton.position.set(0.3, 0.55, -1.05);
    gunButton.rotation.x = -0.3;
    parent.add(gunButton);
    
    this.buttons.push({
      mesh: gunButton,
      pressed: false,
      color: 0xff0000,
      name: 'machineGun',
      onPressed: () => {
        this.machineGunActive = !this.machineGunActive;
      }
    });
    
    // Troop drop button (green)
    const dropButton = new THREE.Mesh(buttonGeo, new THREE.MeshStandardMaterial({ 
      color: 0x00ff00, 
      emissive: 0x003300,
      metalness: 0.3,
      roughness: 0.5
    }));
    dropButton.position.set(0.5, 0.55, -1.05);
    dropButton.rotation.x = -0.3;
    parent.add(dropButton);
    
    this.buttons.push({
      mesh: dropButton,
      pressed: false,
      color: 0x00ff00,
      name: 'dropTroops',
      onPressed: () => {
        this.dropTroop();
      }
    });
    
    // Boost button (yellow)
    const boostButton = new THREE.Mesh(buttonGeo, new THREE.MeshStandardMaterial({ 
      color: 0xffff00, 
      emissive: 0x333300,
      metalness: 0.3,
      roughness: 0.5
    }));
    boostButton.position.set(-0.3, 0.55, -1.05);
    boostButton.rotation.x = -0.3;
    parent.add(boostButton);
    
    this.buttons.push({
      mesh: boostButton,
      pressed: false,
      color: 0xffff00,
      name: 'boost',
      onPressed: () => {
        this.enginePower = Math.min(1.0, this.enginePower + 0.2);
      }
    });
    
    // Flaps button (blue)
    const flapsButton = new THREE.Mesh(buttonGeo, new THREE.MeshStandardMaterial({ 
      color: 0x0088ff, 
      emissive: 0x001133,
      metalness: 0.3,
      roughness: 0.5
    }));
    flapsButton.position.set(-0.5, 0.55, -1.05);
    flapsButton.rotation.x = -0.3;
    parent.add(flapsButton);
    
    this.buttons.push({
      mesh: flapsButton,
      pressed: false,
      color: 0x0088ff,
      name: 'flaps',
      onPressed: () => {
        this.speed = Math.max(50, this.speed - 20);
      }
    });
  }
  
  private createGauges(parent: THREE.Group): void {
    // Speed gauge
    const gaugeGeo = new THREE.CircleGeometry(0.12, 32);
    const gaugeMat = new THREE.MeshStandardMaterial({ color: 0x111111, metalness: 0.5 });
    
    const speedGauge = new THREE.Mesh(gaugeGeo, gaugeMat);
    speedGauge.position.set(-0.15, 0.55, -1.04);
    speedGauge.rotation.x = -0.3;
    parent.add(speedGauge);
    
    // Gauge ring
    const ringGeo = new THREE.RingGeometry(0.11, 0.13, 32);
    const ringMat = new THREE.MeshStandardMaterial({ color: 0x888888, metalness: 0.8 });
    const speedRing = new THREE.Mesh(ringGeo, ringMat);
    speedRing.position.set(-0.15, 0.55, -1.035);
    speedRing.rotation.x = -0.3;
    parent.add(speedRing);
    
    // Altitude gauge
    const altGauge = new THREE.Mesh(gaugeGeo, gaugeMat);
    altGauge.position.set(0.15, 0.55, -1.04);
    altGauge.rotation.x = -0.3;
    parent.add(altGauge);
    
    const altRing = new THREE.Mesh(ringGeo, ringMat);
    altRing.position.set(0.15, 0.55, -1.035);
    altRing.rotation.x = -0.3;
    parent.add(altRing);
  }
  
  private setupDrones(): void {
    for (let i = 0; i < 8; i++) {
      const droneGroup = new THREE.Group();
      
      // Drone body
      const bodyGeo = new THREE.BoxGeometry(0.8, 0.2, 0.8);
      const bodyMat = new THREE.MeshStandardMaterial({ color: 0x333333, metalness: 0.7 });
      const body = new THREE.Mesh(bodyGeo, bodyMat);
      droneGroup.add(body);
      
      // Arms
      const armGeo = new THREE.BoxGeometry(2, 0.05, 0.1);
      const armMat = new THREE.MeshStandardMaterial({ color: 0x555555 });
      const arm1 = new THREE.Mesh(armGeo, armMat);
      droneGroup.add(arm1);
      const arm2 = new THREE.Mesh(armGeo, armMat);
      arm2.rotation.y = Math.PI / 2;
      droneGroup.add(arm2);
      
      // Propellers
      const propGeo = new THREE.CircleGeometry(0.3, 8);
      const propMat = new THREE.MeshBasicMaterial({ color: 0x888888, transparent: true, opacity: 0.5, side: THREE.DoubleSide });
      const positions = [[-1, 0.1, -1], [1, 0.1, -1], [-1, 0.1, 1], [1, 0.1, 1]];
      positions.forEach(pos => {
        const prop = new THREE.Mesh(propGeo, propMat);
        prop.position.set(pos[0], pos[1], pos[2]);
        prop.rotation.x = -Math.PI / 2;
        prop.name = 'droneProp';
        droneGroup.add(prop);
      });
      
      // Red LED
      const ledGeo = new THREE.SphereGeometry(0.05, 4, 4);
      const ledMat = new THREE.MeshBasicMaterial({ color: 0xff0000 });
      const led = new THREE.Mesh(ledGeo, ledMat);
      led.position.set(0, -0.15, 0);
      droneGroup.add(led);
      
      const orbitCenter = new THREE.Vector3(
        (Math.random() - 0.5) * 500,
        100 + Math.random() * 300,
        (Math.random() - 0.5) * 500
      );
      
      droneGroup.position.copy(orbitCenter);
      this.scene.add(droneGroup);
      
      this.drones.push({
        mesh: droneGroup,
        velocity: new THREE.Vector3(),
        health: 5,
        orbitCenter,
        orbitRadius: 30 + Math.random() * 50,
        orbitSpeed: 0.3 + Math.random() * 0.5,
        orbitAngle: Math.random() * Math.PI * 2
      });
    }
  }
  
  private updateDrones(delta: number): void {
    for (const drone of this.drones) {
      drone.orbitAngle += drone.orbitSpeed * delta;
      
      drone.mesh.position.x = drone.orbitCenter.x + Math.cos(drone.orbitAngle) * drone.orbitRadius;
      drone.mesh.position.z = drone.orbitCenter.z + Math.sin(drone.orbitAngle) * drone.orbitRadius;
      drone.mesh.position.y = drone.orbitCenter.y + Math.sin(drone.orbitAngle * 2) * 10;
      
      // Face direction of travel
      drone.mesh.rotation.y = -drone.orbitAngle + Math.PI / 2;
      
      // Animate propellers
      drone.mesh.children.forEach(child => {
        if (child.name === 'droneProp') {
          child.rotation.z += delta * 30;
        }
      });
    }
    
    // Check bullet-drone collisions
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const bullet = this.bullets[i];
      
      for (let j = this.drones.length - 1; j >= 0; j--) {
        const drone = this.drones[j];
        if (bullet.mesh.position.distanceTo(drone.mesh.position) < 2) {
          drone.health--;
          
          if (drone.health <= 0) {
            this.createExplosion(drone.mesh.position.clone());
            this.scene.remove(drone.mesh);
            this.drones.splice(j, 1);
            this.score += 50;
            
            // Haptic feedback on drone kill (stronger)
            this.triggerHaptic('right', 200, 1.0);
            this.triggerHaptic('left', 100, 0.5);
            
            // Respawn drone
            setTimeout(() => this.respawnDrone(), 5000);
          }
          
          this.scene.remove(bullet.mesh);
          this.bullets.splice(i, 1);
          break;
        }
      }
    }
  }
  
  private respawnDrone(): void {
    const droneGroup = new THREE.Group();
    
    const bodyGeo = new THREE.BoxGeometry(0.8, 0.2, 0.8);
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x333333, metalness: 0.7 });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    droneGroup.add(body);
    
    const armGeo = new THREE.BoxGeometry(2, 0.05, 0.1);
    const armMat = new THREE.MeshStandardMaterial({ color: 0x555555 });
    const arm1 = new THREE.Mesh(armGeo, armMat);
    droneGroup.add(arm1);
    const arm2 = new THREE.Mesh(armGeo, armMat);
    arm2.rotation.y = Math.PI / 2;
    droneGroup.add(arm2);
    
    const propGeo = new THREE.CircleGeometry(0.3, 8);
    const propMat = new THREE.MeshBasicMaterial({ color: 0x888888, transparent: true, opacity: 0.5, side: THREE.DoubleSide });
    const positions = [[-1, 0.1, -1], [1, 0.1, -1], [-1, 0.1, 1], [1, 0.1, 1]];
    positions.forEach(pos => {
      const prop = new THREE.Mesh(propGeo, propMat);
      prop.position.set(pos[0], pos[1], pos[2]);
      prop.rotation.x = -Math.PI / 2;
      prop.name = 'droneProp';
      droneGroup.add(prop);
    });
    
    const orbitCenter = new THREE.Vector3(
      (Math.random() - 0.5) * 500,
      100 + Math.random() * 300,
      (Math.random() - 0.5) * 500
    );
    
    droneGroup.position.copy(orbitCenter);
    this.scene.add(droneGroup);
    
    this.drones.push({
      mesh: droneGroup,
      velocity: new THREE.Vector3(),
      health: 5,
      orbitCenter,
      orbitRadius: 30 + Math.random() * 50,
      orbitSpeed: 0.3 + Math.random() * 0.5,
      orbitAngle: Math.random() * Math.PI * 2
    });
  }
  
  private setupBugs(): void {
    const bugBodyGeo = new THREE.SphereGeometry(0.15, 8, 6);
    const bugMat = new THREE.MeshStandardMaterial({ color: 0x2d1b00, roughness: 0.8 });
    const legGeo = new THREE.CylinderGeometry(0.01, 0.01, 0.2, 4);
    const legMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a });
    
    for (let i = 0; i < 30; i++) {
      const bugGroup = new THREE.Group();
      
      // Body
      const body = new THREE.Mesh(bugBodyGeo, bugMat);
      body.scale.set(1, 0.6, 1.3);
      bugGroup.add(body);
      
      // Legs
      for (let l = 0; l < 6; l++) {
        const leg = new THREE.Mesh(legGeo, legMat);
        const side = l < 3 ? -1 : 1;
        const idx = l % 3;
        leg.position.set(side * 0.12, -0.08, (idx - 1) * 0.1);
        leg.rotation.z = side * 0.5;
        bugGroup.add(leg);
      }
      
      // Antennae
      const antennaGeo = new THREE.CylinderGeometry(0.005, 0.005, 0.15, 4);
      const antenna1 = new THREE.Mesh(antennaGeo, legMat);
      antenna1.position.set(-0.05, 0.05, 0.15);
      antenna1.rotation.x = -0.5;
      antenna1.rotation.z = -0.3;
      bugGroup.add(antenna1);
      
      const antenna2 = new THREE.Mesh(antennaGeo, legMat);
      antenna2.position.set(0.05, 0.05, 0.15);
      antenna2.rotation.x = -0.5;
      antenna2.rotation.z = 0.3;
      bugGroup.add(antenna2);
      
      bugGroup.position.set(
        (Math.random() - 0.5) * 100,
        -9.5,
        (Math.random() - 0.5) * 100
      );
      
      this.scene.add(bugGroup);
      
      this.bugs.push({
        mesh: bugGroup as any,
        velocity: new THREE.Vector3(
          (Math.random() - 0.5) * 2,
          0,
          (Math.random() - 0.5) * 2
        ),
        targetPoint: new THREE.Vector3(
          (Math.random() - 0.5) * 100,
          -9.5,
          (Math.random() - 0.5) * 100
        ),
        speed: 1 + Math.random() * 3,
        health: 3
      });
    }
  }
  
  private setupControllers(): void {
    // Setup Three.js XR controllers
    for (let i = 0; i < 2; i++) {
      const xrController = this.renderer.xr.getController(i);
      const xrGrip = this.renderer.xr.getControllerGrip(i);
      
      // Controller visual model
      const controllerModel = new THREE.Group();
      
      // Controller body
      const bodyGeo = new THREE.BoxGeometry(0.04, 0.04, 0.12);
      const bodyMat = new THREE.MeshStandardMaterial({ 
        color: i === 0 ? 0x4444ff : 0xff4444, 
        metalness: 0.5,
        roughness: 0.3
      });
      const body = new THREE.Mesh(bodyGeo, bodyMat);
      controllerModel.add(body);
      
      // Pointer/ray
      const rayGeo = new THREE.CylinderGeometry(0.002, 0.001, 3, 4);
      const rayMat = new THREE.MeshBasicMaterial({ 
        color: i === 0 ? 0x00ff88 : 0xff8800, 
        transparent: true, 
        opacity: 0.6 
      });
      const ray = new THREE.Mesh(rayGeo, rayMat);
      ray.rotation.x = Math.PI / 2;
      ray.position.z = -1.5;
      controllerModel.add(ray);
      
      // Trigger indicator
      const triggerGeo = new THREE.SphereGeometry(0.01, 8, 8);
      const triggerMat = new THREE.MeshBasicMaterial({ color: 0xffff00 });
      const triggerMesh = new THREE.Mesh(triggerGeo, triggerMat);
      triggerMesh.position.set(0, -0.03, -0.02);
      controllerModel.add(triggerMesh);
      
      xrController.add(controllerModel);
      this.scene.add(xrController);
      this.scene.add(xrGrip);
      
      // Store reference
      this.controllers.push(xrController);
      this.controllerGrips.push(xrGrip);
      
      // Controller events
      xrController.addEventListener('selectstart', () => {
        this.checkButtonInteraction(xrController);
        this.checkLeverInteraction(xrController);
      });
    }
  }
  
  private setupHUD(): void {
    // Score display
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 128;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(0, 0, 512, 128);
    ctx.fillStyle = '#00ff00';
    ctx.font = 'bold 48px monospace';
    ctx.fillText(`SCORE: ${this.score}`, 20, 75);
    
    const texture = new THREE.CanvasTexture(canvas);
    const spriteMat = new THREE.SpriteMaterial({ map: texture, transparent: true });
    this.scoreText = new THREE.Sprite(spriteMat);
    this.scoreText.scale.set(1.5, 0.6, 1);
    this.scoreText.position.set(0, 1.4, -1.5);
    this.hudGroup.add(this.scoreText);
    // Crosshair
    const crosshairCanvas = document.createElement('canvas');
    crosshairCanvas.width = 128;
    crosshairCanvas.height = 128;
    const chCtx = crosshairCanvas.getContext('2d')!;
    chCtx.strokeStyle = '#00ff00';
    chCtx.lineWidth = 2;
    chCtx.beginPath();
    chCtx.arc(64, 64, 30, 0, Math.PI * 2);
    chCtx.stroke();
    chCtx.beginPath();
    chCtx.moveTo(64, 20);
    chCtx.lineTo(64, 45);
    chCtx.stroke();
    chCtx.beginPath();
    chCtx.moveTo(64, 83);
    chCtx.lineTo(64, 108);
    chCtx.stroke();
    chCtx.beginPath();
    chCtx.moveTo(20, 64);
    chCtx.lineTo(45, 64);
    chCtx.stroke();
    chCtx.beginPath();
    chCtx.moveTo(83, 64);
    chCtx.lineTo(108, 64);
    chCtx.stroke();
    // Center dot
    chCtx.fillStyle = '#ff0000';
    chCtx.beginPath();
    chCtx.arc(64, 64, 3, 0, Math.PI * 2);
    chCtx.fill();
    
    const crosshairTexture = new THREE.CanvasTexture(crosshairCanvas);
    const crosshairMat = new THREE.SpriteMaterial({ map: crosshairTexture, transparent: true });
    const crosshair = new THREE.Sprite(crosshairMat);
    crosshair.scale.set(0.15, 0.15, 1);
    crosshair.position.set(0, 0.3, -1.5);
    crosshair.name = 'crosshair';
    this.hudGroup.add(crosshair);
    
    this.cockpit.add(this.hudGroup);
  }
  
  private updateHUD(): void {
    if (!this.scoreText) return;
    const canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = 320;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(0, 0, 640, 320);
    
    ctx.fillStyle = '#00ff00';
    ctx.font = 'bold 36px monospace';
    ctx.fillText(`SCORE: ${this.score}`, 20, 45);
    
    ctx.fillStyle = '#00ffff';
    ctx.font = '24px monospace';
    ctx.fillText(`ALT: ${Math.floor(this.altitude)}m`, 20, 90);
    ctx.fillText(`SPD: ${Math.floor(this.speed)}km/h`, 20, 125);
    ctx.fillText(`PWR: ${Math.floor(this.enginePower * 100)}%`, 20, 160);
    
    ctx.fillStyle = '#ff8800';
    ctx.fillText(`BUGS: ${this.bugs.length}`, 300, 90);
    ctx.fillText(`DRONES: ${this.drones.length}`, 300, 125);
    ctx.fillText(`TROOPS: ${this.troops.filter(t => t.landed).length}`, 300, 160);
    
    // Player count
    ctx.fillStyle = '#ffff00';
    ctx.fillText(`PLAYERS: ${this.getPlayerCount()}`, 300, 195);
    
    if (this.machineGunActive) {
      ctx.fillStyle = '#ff0000';
      ctx.font = 'bold 28px monospace';
      ctx.fillText('>>> FIRE <<<', 300, 210);
    }
    
    // Heading indicator
    ctx.fillStyle = '#ffff00';
    ctx.font = '20px monospace';
    ctx.fillText(`HDG: ${Math.floor(this.heading) % 360}°`, 20, 210);
    
    // Mini radar
    const radarX = 540;
    const radarY = 140;
    const radarR = 60;
    
    // Radar background
    ctx.fillStyle = 'rgba(0, 50, 0, 0.8)';
    ctx.beginPath();
    ctx.arc(radarX, radarY, radarR, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#00ff00';
    ctx.lineWidth = 1;
    ctx.stroke();
    
    // Radar grid
    ctx.strokeStyle = 'rgba(0, 100, 0, 0.5)';
    ctx.beginPath();
    ctx.arc(radarX, radarY, radarR / 2, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(radarX - radarR, radarY);
    ctx.lineTo(radarX + radarR, radarY);
    ctx.moveTo(radarX, radarY - radarR);
    ctx.lineTo(radarX, radarY + radarR);
    ctx.stroke();
    
    // Radar sweep
    const sweepAngle = (this.elapsedTime * 2) % (Math.PI * 2);
    ctx.strokeStyle = 'rgba(0, 255, 0, 0.5)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(radarX, radarY);
    ctx.lineTo(
      radarX + Math.cos(sweepAngle) * radarR,
      radarY + Math.sin(sweepAngle) * radarR
    );
    ctx.stroke();
    
    // Bug dots on radar (brown)
    ctx.fillStyle = '#aa6600';
    for (const bug of this.bugs) {
      const bugMesh = bug.mesh as unknown as THREE.Group;
      const dx = (bugMesh.position.x - this.airplane.position.x) / 5;
      const dz = (bugMesh.position.z - this.airplane.position.z) / 5;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist < radarR) {
        ctx.beginPath();
        ctx.arc(radarX + dx, radarY + dz, 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    
    // Drone dots on radar (red)
    ctx.fillStyle = '#ff0000';
    for (const drone of this.drones) {
      const dx = (drone.mesh.position.x - this.airplane.position.x) / 5;
      const dz = (drone.mesh.position.z - this.airplane.position.z) / 5;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist < radarR) {
        ctx.beginPath();
        ctx.arc(radarX + dx, radarY + dz, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    
    // Player dot (center, green)
    ctx.fillStyle = '#00ff00';
    ctx.beginPath();
    ctx.arc(radarX, radarY, 3, 0, Math.PI * 2);
    ctx.fill();
    
    const texture = new THREE.CanvasTexture(canvas);
    (this.scoreText.material as THREE.SpriteMaterial).map?.dispose();
    (this.scoreText.material as THREE.SpriteMaterial).map = texture;
    (this.scoreText.material as THREE.SpriteMaterial).needsUpdate = true;
  }
  
  private dropTroop(): void {
    const troop = new THREE.Group();
    
    // Body
    const bodyGeo = new THREE.CapsuleGeometry(0.15, 0.4, 4, 8);
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x4a6741 });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    troop.add(body);
    
    // Head
    const headGeo = new THREE.SphereGeometry(0.12, 8, 8);
    const headMat = new THREE.MeshStandardMaterial({ color: 0x4a6741 });
    const head = new THREE.Mesh(headGeo, headMat);
    head.position.y = 0.35;
    troop.add(head);
    
    // Helmet
    const helmetGeo = new THREE.SphereGeometry(0.13, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2);
    const helmetMat = new THREE.MeshStandardMaterial({ color: 0x2d4a2d });
    const helmet = new THREE.Mesh(helmetGeo, helmetMat);
    helmet.position.y = 0.38;
    troop.add(helmet);
    
    // Parachute
    const parachuteGeo = new THREE.SphereGeometry(0.8, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2);
    const parachuteMat = new THREE.MeshStandardMaterial({ 
      color: 0xff6600, 
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.8
    });
    const parachute = new THREE.Mesh(parachuteGeo, parachuteMat);
    parachute.position.y = 2;
    parachute.name = 'parachute';
    troop.add(parachute);
    
    // Position relative to airplane
    const airplanePos = this.airplane.position.clone();
    airplanePos.y -= 2;
    troop.position.copy(airplanePos);
    
    const velocity = new THREE.Vector3(
      (Math.random() - 0.5) * 5,
      -2,
      (Math.random() - 0.5) * 5
    );
    
    this.scene.add(troop);
    
    this.troops.push({
      mesh: troop,
      velocity: velocity.clone(),
      landed: false,
      health: 100
    });
    
    // Send to other players
    if (this.multiplayer.isConnectedToServer()) {
      this.multiplayer.sendDropTroop({
        position: { x: airplanePos.x, y: airplanePos.y, z: airplanePos.z },
        velocity: { x: velocity.x, y: velocity.y, z: velocity.z }
      });
    }
  }
  
  private fireBullet(origin: THREE.Vector3, direction: THREE.Vector3): void {
    // Muzzle flash
    const flashGeo = new THREE.SphereGeometry(0.1, 8, 8);
    const flashMat = new THREE.MeshBasicMaterial({ color: 0xffff00, transparent: true, opacity: 0.8 });
    const flash = new THREE.Mesh(flashGeo, flashMat);
    flash.position.copy(origin);
    this.scene.add(flash);
    setTimeout(() => this.scene.remove(flash), 50);
    
    // Bullet tracer
    const bulletGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.8, 4);
    const bulletMat = new THREE.MeshBasicMaterial({ color: 0xffaa00 });
    const bullet = new THREE.Mesh(bulletGeo, bulletMat);
    bullet.position.copy(origin);
    
    // Orient bullet along direction
    bullet.quaternion.setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      direction.clone().normalize()
    );
    
    // Glow effect
    const glowGeo = new THREE.SphereGeometry(0.05, 4, 4);
    const glowMat = new THREE.MeshBasicMaterial({ color: 0xff6600, transparent: true, opacity: 0.4 });
    const glow = new THREE.Mesh(glowGeo, glowMat);
    bullet.add(glow);
    
    this.scene.add(bullet);
    
    const velocity = direction.clone().multiplyScalar(200);
    
    this.bullets.push({
      mesh: bullet,
      velocity,
      life: 3
    });
  }
  
  private updateBugs(delta: number): void {
    for (const bug of this.bugs) {
      const mesh = bug.mesh as unknown as THREE.Group;
      
      // Move toward target
      const dir = bug.targetPoint.clone().sub(mesh.position).normalize();
      mesh.position.add(dir.multiplyScalar(bug.speed * delta));
      
      // Rotate to face direction
      mesh.lookAt(bug.targetPoint);
      
      // Animate legs
      mesh.children.forEach((child, idx) => {
        if (idx > 0 && idx <= 6) {
          child.rotation.x = Math.sin(Date.now() * 0.01 + idx) * 0.3;
        }
      });
      
      // Pick new target when close
      if (mesh.position.distanceTo(bug.targetPoint) < 2) {
        bug.targetPoint.set(
          (Math.random() - 0.5) * 100,
          -9.5,
          (Math.random() - 0.5) * 100
        );
      }
    }
  }
  
  private updateBullets(delta: number): void {
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const bullet = this.bullets[i];
      bullet.mesh.position.add(bullet.velocity.clone().multiplyScalar(delta));
      bullet.life -= delta;
      
      // Check collision with bugs
      for (let j = this.bugs.length - 1; j >= 0; j--) {
        const bug = this.bugs[j];
        const bugMesh = bug.mesh as unknown as THREE.Group;
        if (bullet.mesh.position.distanceTo(bugMesh.position) < 0.8) {
          bug.health--;
          
          // Hit effect - flash the bug
          const bugBody = bugMesh.children[0] as THREE.Mesh;
          if (bugBody && bugBody.material) {
            const origColor = (bugBody.material as THREE.MeshStandardMaterial).color.getHex();
            (bugBody.material as THREE.MeshStandardMaterial).emissive.setHex(0xff0000);
            setTimeout(() => {
              if (bugBody.material) {
                (bugBody.material as THREE.MeshStandardMaterial).emissive.setHex(0x000000);
              }
            }, 100);
          }
          
          if (bug.health <= 0) {
            // Explosion effect
            this.createExplosion(bugMesh.position.clone());
            
            this.scene.remove(bugMesh);
            this.bugs.splice(j, 1);
            this.score += 10;
            
            // Haptic feedback on kill
            this.triggerHaptic('right', 100, 0.8);
            this.triggerHaptic('left', 50, 0.3);
            
            // Respawn bug
            setTimeout(() => this.respawnBug(), 3000);
          }
          
          // Remove bullet
          this.scene.remove(bullet.mesh);
          this.bullets.splice(i, 1);
          break;
        }
      }
      
      if (bullet.life <= 0) {
        this.scene.remove(bullet.mesh);
        this.bullets.splice(i, 1);
      }
    }
  }
  
  private createExplosion(position: THREE.Vector3): void {
    const particleCount = 15;
    const particles: THREE.Mesh[] = [];
    
    for (let i = 0; i < particleCount; i++) {
      const size = 0.05 + Math.random() * 0.1;
      const geo = new THREE.SphereGeometry(size, 4, 4);
      const mat = new THREE.MeshBasicMaterial({ 
        color: new THREE.Color().setHSL(0.05 + Math.random() * 0.1, 1, 0.5),
        transparent: true,
        opacity: 1
      });
      const particle = new THREE.Mesh(geo, mat);
      particle.position.copy(position);
      
      const velocity = new THREE.Vector3(
        (Math.random() - 0.5) * 5,
        Math.random() * 5,
        (Math.random() - 0.5) * 5
      );
      
      this.scene.add(particle);
      particles.push(particle);
      
      // Animate particle
      const startTime = Date.now();
      const animateParticle = () => {
        const elapsed = (Date.now() - startTime) / 1000;
        if (elapsed > 1) {
          this.scene.remove(particle);
          return;
        }
        
        particle.position.add(velocity.clone().multiplyScalar(0.016));
        velocity.y -= 9.8 * 0.016;
        (particle.material as THREE.MeshBasicMaterial).opacity = 1 - elapsed;
        particle.scale.setScalar(1 - elapsed * 0.5);
        
        requestAnimationFrame(animateParticle);
      };
      animateParticle();
    }
  }
  
  private respawnBug(): void {
    const bugBodyGeo = new THREE.SphereGeometry(0.15, 8, 6);
    const bugMat = new THREE.MeshStandardMaterial({ color: 0x2d1b00, roughness: 0.8 });
    
    const bugGroup = new THREE.Group();
    const body = new THREE.Mesh(bugBodyGeo, bugMat);
    body.scale.set(1, 0.6, 1.3);
    bugGroup.add(body);
    
    bugGroup.position.set(
      (Math.random() - 0.5) * 100,
      -9.5,
      (Math.random() - 0.5) * 100
    );
    
    this.scene.add(bugGroup);
    
    this.bugs.push({
      mesh: bugGroup as any,
      velocity: new THREE.Vector3((Math.random() - 0.5) * 2, 0, (Math.random() - 0.5) * 2),
      targetPoint: new THREE.Vector3((Math.random() - 0.5) * 100, -9.5, (Math.random() - 0.5) * 100),
      speed: 1 + Math.random() * 3,
      health: 3
    });
  }
  
  private updateTroops(delta: number): void {
    for (const troop of this.troops) {
      if (troop.landed) continue;
      
      troop.mesh.position.add(troop.velocity.clone().multiplyScalar(delta));
      
      // Slow descent (parachute effect)
      troop.velocity.y = Math.max(troop.velocity.y, -3);
      
      // Check if landed
      if (troop.mesh.position.y <= -9) {
        troop.landed = true;
        troop.mesh.position.y = -9;
        troop.velocity.set(0, 0, 0);
        
        // Remove parachute
        const parachute = troop.mesh.getObjectByName('parachute');
        if (parachute) {
          troop.mesh.remove(parachute);
        }
        
        // Check if landed in landing zone
        const distToLZ = Math.sqrt(
          troop.mesh.position.x * troop.mesh.position.x + 
          troop.mesh.position.z * troop.mesh.position.z
        );
        
        if (distToLZ < 10) {
          this.score += 50; // Bonus for landing in zone
          // Success haptic
          this.triggerHaptic('left', 150, 0.7);
          this.triggerHaptic('right', 150, 0.7);
        } else {
          this.score += 25;
          this.triggerHaptic('left', 80, 0.4);
        }
      }
    }
  }
  
  private updateMachineGun(delta: number): void {
    if (!this.machineGunActive) return;
    
    this.machineGunCooldown -= delta;
    if (this.machineGunCooldown <= 0) {
      this.machineGunCooldown = 0.1; // Fire rate
      
      // Fire from cockpit forward
      const origin = new THREE.Vector3(0, 0.5, -1.5);
      this.cockpit.localToWorld(origin);
      
      const direction = new THREE.Vector3(0, -0.1, -1);
      direction.applyQuaternion(this.cockpit.quaternion).normalize();
      
      this.fireBullet(origin, direction);
    }
  }
  
  private updateFlight(delta: number): void {
    // Update airplane movement
    this.heading += this.rudderAngle * delta * 30;
    this.altitude += this.elevatorAngle * delta * 50;
    this.altitude = Math.max(50, Math.min(2000, this.altitude));
    this.speed = 50 + this.enginePower * 200;
    
    // Move airplane
    const forward = new THREE.Vector3(0, 0, -1);
    forward.applyAxisAngle(new THREE.Vector3(0, 1, 0), THREE.MathUtils.degToRad(this.heading));
    
    this.airplane.position.add(forward.multiplyScalar(this.speed * delta * 0.1));
    this.airplane.position.y = this.altitude - 500; // Relative height
    this.airplane.rotation.y = THREE.MathUtils.degToRad(this.heading);
    
    // Move skybox with airplane
    if (this.skybox) {
      this.skybox.position.copy(this.airplane.position);
    }
    
    // CRITICAL: Move camera with airplane (fixes desktop controls)
    // Camera sits inside the cockpit
    this.camera.position.copy(this.airplane.position);
    this.camera.position.y += 1.6; // Eye height
    
    // Camera looks forward based on heading
    const lookTarget = this.airplane.position.clone();
    lookTarget.add(forward.clone().multiplyScalar(10));
    lookTarget.y = this.camera.position.y + this.elevatorAngle * 5;
    this.camera.lookAt(lookTarget);
    
    // Apply roll from rudder
    this.camera.rotation.z = -this.rudderAngle * 0.2;
    
    // Keep cockpit relative to camera
    this.cockpit.position.copy(this.camera.position);
    this.cockpit.quaternion.copy(this.camera.quaternion);
  }
  
  private handleControllerInput(): void {
    const session = this.renderer.xr.getSession();
    if (!session) return;
    
    for (let i = 0; i < session.inputSources.length; i++) {
      const inputSource = session.inputSources[i];
      if (!inputSource.gamepad) continue;
      
      // Determine which controller (left/right)
      const isLeft = inputSource.handedness === 'left';
      const controllerIdx = isLeft ? 0 : 1;
      
      const controller = this.controllers[controllerIdx];
      if (!controller) continue;
      
      // Use Three.js XR controller data
      const xrController = this.renderer.xr.getController(controllerIdx);
      if (xrController) {
        controller.position.copy(xrController.position);
        controller.quaternion.copy(xrController.quaternion);
        controller.visible = true;
      }
      
      const gamepad = inputSource.gamepad;
      const profiles = inputSource.profiles || [];
      
      // Detect controller type for proper button mapping
      const isIndex = profiles.some(p => p.includes('index') || p.includes('valve'));
      const isVive = profiles.some(p => p.includes('vive') || p.includes('htc'));
      const isOculus = profiles.some(p => p.includes('oculus-touch') || p.includes('meta-quest'));
      const isWMR = profiles.some(p => p.includes('microsoft') || p.includes('wmr'));
      
      // === BUTTON MAPPING ===
      // Different controllers have different button layouts
      
      let triggerBtn: GamepadButton | undefined;
      let gripBtn: GamepadButton | undefined;
      let primaryBtn: GamepadButton | undefined;
      let secondaryBtn: GamepadButton | undefined;
      
      if (isIndex) {
        // Valve Index: trigger=0, trackpad=1, grip=2, A/X=3, B/Y=5
        triggerBtn = gamepad.buttons[0];
        gripBtn = gamepad.buttons[2];
        primaryBtn = gamepad.buttons[3];   // A/X button
        secondaryBtn = gamepad.buttons[5]; // B/Y button
      } else if (isVive) {
        // HTC Vive: trigger=0, grip=2, menu=4, trackpad click=3
        triggerBtn = gamepad.buttons[0];
        gripBtn = gamepad.buttons[2];
        primaryBtn = gamepad.buttons[3]; // trackpad press
        secondaryBtn = gamepad.buttons[4]; // menu
      } else if (isWMR) {
        // Windows Mixed Reality: trigger=0, grip=1, thumbstick click=3, A/X=4, B/Y=5
        triggerBtn = gamepad.buttons[0];
        gripBtn = gamepad.buttons[1];
        primaryBtn = gamepad.buttons[4];
        secondaryBtn = gamepad.buttons[5];
      } else {
        // Oculus Touch / default: trigger=0, grip=1, thumbstick=3, X/A=4, Y/B=5
        triggerBtn = gamepad.buttons[0];
        gripBtn = gamepad.buttons[1];
        primaryBtn = gamepad.buttons[4];
        secondaryBtn = gamepad.buttons[5];
      }
      
      // === TRIGGER: interact with cockpit ===
      if (triggerBtn && triggerBtn.pressed) {
        const interacted = this.checkButtonInteraction(controller);
        this.checkLeverInteraction(controller);
        
        // Haptic feedback on interaction
        if (interacted) {
          this.triggerHaptic(inputSource.handedness as 'left' | 'right', 30, 0.3);
        }
      }
      
      // === GRIP: fire machine gun (hold to fire) ===
      if (gripBtn && gripBtn.pressed && !isLeft) {
        if (!this.machineGunActive) {
          this.machineGunActive = true;
          // Haptic on start firing
          this.triggerHaptic('right', 50, 0.4);
        }
        this.machineGunActive = true;
      } else if (!isLeft && (!gripBtn || !gripBtn.pressed)) {
        // Only deactivate if this is the right controller and grip not pressed
        // Check if any other controller has grip pressed
        const otherSource = session.inputSources[isLeft ? 1 : 0];
        if (!otherSource?.gamepad?.buttons[1]?.pressed) {
          this.machineGunActive = false;
        }
      }
      
      // === PRIMARY BUTTON: drop troops ===
      if (primaryBtn && primaryBtn.pressed && isLeft) {
        if (!this._lastPrimaryPress || Date.now() - this._lastPrimaryPress > 500) {
          this.dropTroop();
          this._lastPrimaryPress = Date.now();
        }
      }
      
      // === SECONDARY BUTTON: boost ===
      if (secondaryBtn && secondaryBtn.pressed) {
        this.enginePower = Math.min(1.0, this.enginePower + 0.02);
      }
      
      // === THUMBSTICK: flight control ===
      // Axes layout varies by controller:
      // Index/Vive: 0=X, 1=Y (thumbstick), 2=trackpad (if present)
      // Oculus: 0=X, 1=Y (thumbstick)
      // WMR: 0=X, 1=Y (thumbstick), 2=X, 3=Y (second stick if present)
      
      let stickX = 0;
      let stickY = 0;
      
      if (isIndex || isVive || isOculus || isWMR) {
        // Standard mapping: axes 0,1 are thumbstick
        stickX = gamepad.axes[0] || 0;
        stickY = gamepad.axes[1] || 0;
      }
      
      // Apply deadzone
      const deadzone = 0.15;
      if (Math.abs(stickX) < deadzone) stickX = 0;
      if (Math.abs(stickY) < deadzone) stickY = 0;
      
      if (isLeft) {
        // Left controller: rudder (X) + elevator (Y)
        this.rudderAngle = stickX;
        this.elevatorAngle = -stickY;
      } else {
        // Right controller: throttle (Y axis)
        if (Math.abs(stickY) > 0.1) {
          this.enginePower = Math.max(0, Math.min(1, this.enginePower - stickY * 0.02));
        }
      }
      
      // === INDEX FINGER TRACKING ===
      // Valve Index supports finger curl tracking
      if (isIndex && gamepad.buttons.length > 3) {
        // Index has additional finger tracking buttons
        // Button 1 = trackpad, but we can also use analog trigger values
        const triggerValue = triggerBtn?.value || 0;
        
        // Analog trigger for fine throttle control
        if (!isLeft && triggerValue > 0.1) {
          this.enginePower = Math.max(0, this.enginePower - triggerValue * 0.005);
        }
      }
    }
  }
  
  // Debounce helper
  private _lastPrimaryPress: number = 0;
  
  // Haptic feedback for controllers
  private triggerHaptic(hand: 'left' | 'right', duration: number = 50, intensity: number = 0.5): void {
    const session = this.renderer.xr.getSession();
    if (!session) return;
    
    for (const source of session.inputSources) {
      if (source.handedness === hand && source.gamepad) {
        // WebXR Haptic Actuator API
        const actuators = (source.gamepad as any).hapticActuators;
        if (actuators && actuators.length > 0) {
          actuators[0].pulse(intensity, duration);
        }
        
        // Alternative: vibrationActuator (newer API)
        const vibrationActuator = (source.gamepad as any).vibrationActuator;
        if (vibrationActuator) {
          vibrationActuator.playEffect?.('dual-rumble', {
            duration,
            strongMagnitude: intensity,
            weakMagnitude: intensity * 0.5
          });
        }
      }
    }
  }
  
  private checkButtonInteraction(controller: THREE.Group): boolean {
    this.tempMatrix.identity().extractRotation(controller.matrixWorld);
    this.raycaster.ray.origin.setFromMatrixPosition(controller.matrixWorld);
    this.raycaster.ray.direction.set(0, 0, -1).applyMatrix4(this.tempMatrix);
    
    const buttonMeshes = this.buttons.map(b => b.mesh);
    const intersects = this.raycaster.intersectObjects(buttonMeshes);
    
    if (intersects.length > 0) {
      const hitButton = this.buttons.find(b => b.mesh === intersects[0].object);
      if (hitButton && !hitButton.pressed) {
        hitButton.pressed = true;
        hitButton.onPressed();
        
        // Visual feedback
        const mat = hitButton.mesh.material as THREE.MeshStandardMaterial;
        mat.emissiveIntensity = 2;
        setTimeout(() => {
          hitButton.pressed = false;
          mat.emissiveIntensity = 1;
        }, 200);
        
        return true;
      }
    }
    return false;
  }
  
  private checkLeverInteraction(controller: THREE.Group): void {
    this.tempMatrix.identity().extractRotation(controller.matrixWorld);
    this.raycaster.ray.origin.setFromMatrixPosition(controller.matrixWorld);
    this.raycaster.ray.direction.set(0, 0, -1).applyMatrix4(this.tempMatrix);
    
    const leverMeshes = this.levers.map(l => l.mesh);
    const intersects = this.raycaster.intersectObjects(leverMeshes, true);
    
    if (intersects.length > 0) {
      const hitLever = this.levers.find(l => {
        const mesh = l.mesh as unknown as THREE.Group;
        return mesh === intersects[0].object || mesh.children.includes(intersects[0].object);
      });
      
      if (hitLever) {
        // Move lever based on controller position
        const controllerPos = new THREE.Vector3();
        controllerPos.setFromMatrixPosition(controller.matrixWorld);
        
        const leverPos = new THREE.Vector3();
        const leverMesh = hitLever.mesh as unknown as THREE.Group;
        leverMesh.getWorldPosition(leverPos);
        
        const dy = controllerPos.y - leverPos.y;
        hitLever.targetRotation = THREE.MathUtils.clamp(dy * 2, -1, 1);
      }
    }
  }
  
  private updateLevers(delta: number): void {
    for (const lever of this.levers) {
      lever.currentRotation += (lever.targetRotation - lever.currentRotation) * delta * 5;
      
      const mesh = lever.mesh as unknown as THREE.Group;
      mesh.rotation.x = lever.currentRotation;
      
      // Apply lever effects
      if (lever.name === 'throttle') {
        this.enginePower = (lever.currentRotation + 1) / 2;
      } else if (lever.name === 'rudder') {
        this.rudderAngle = lever.currentRotation;
      } else if (lever.name === 'elevator') {
        this.elevatorAngle = lever.currentRotation;
      }
    }
  }
  
  private animate(): void {
    const delta = Math.min(this.clock.getDelta(), 0.1);
    this.elapsedTime = this.clock.getElapsedTime();
    const time = this.elapsedTime;
    
    // Handle VR input
    this.handleControllerInput();
    
    // Update game systems
    this.updateFlight(delta);
    this.updateBugs(delta);
    this.updateDrones(delta);
    this.updateBullets(delta);
    this.updateTroops(delta);
    this.updateMachineGun(delta);
    this.updateLevers(delta);
    this.updateRemotePlayers(delta);
    this.updateHUD();
    
    // Send network updates
    if (this.multiplayer.isConnectedToServer()) {
      this.sendNetworkUpdate();
    }
    
    // Animate propellers
    const propLeft = this.airplane.getObjectByName('propLeft');
    const propRight = this.airplane.getObjectByName('propRight');
    if (propLeft) propLeft.rotation.z = time * this.enginePower * 50;
    if (propRight) propRight.rotation.z = -time * this.enginePower * 50;
    
    // Airplane banking based on rudder
    this.airplane.rotation.z = -this.rudderAngle * 0.3;
    this.airplane.rotation.x = this.elevatorAngle * 0.2;
    
    // Machine gun shake
    if (this.machineGunActive) {
      this.cockpit.position.x += (Math.random() - 0.5) * 0.005;
      this.cockpit.position.y += (Math.random() - 0.5) * 0.005;
      
      // Flash crosshair
      const crosshair = this.hudGroup.getObjectByName('crosshair') as THREE.Sprite;
      if (crosshair) {
        (crosshair.material as THREE.SpriteMaterial).opacity = 0.5 + Math.random() * 0.5;
      }
    } else {
      const crosshair = this.hudGroup.getObjectByName('crosshair') as THREE.Sprite;
      if (crosshair) {
        (crosshair.material as THREE.SpriteMaterial).opacity = 0.7;
      }
    }
    
    // Render
    this.renderer.render(this.scene, this.camera);
  }
  
  private onResize(): void {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }
  
  public async enterVR(mode: 'auto' | 'steamvr' | 'oculus' = 'auto'): Promise<void> {
    try {
      // Detect VR system
      await this.detectVRSystem();
      
      // Build session options based on VR system
      const sessionInit: XRSessionInit = {
        requiredFeatures: ['local-floor'],
        optionalFeatures: ['hand-tracking', 'bounded-floor', 'hit-test']
      };
      
      // SteamVR specific features
      if (this.vrSystem === 'steamvr' || mode === 'steamvr') {
        sessionInit.optionalFeatures?.push('dom-overlay');
        sessionInit.optionalFeatures?.push('layers');
      }
      
      // Oculus specific features
      if (this.vrSystem === 'oculus' || mode === 'oculus') {
        sessionInit.optionalFeatures?.push('anchors');
        sessionInit.optionalFeatures?.push('mesh-detection');
      }
      
      // Try different reference spaces for SteamVR compatibility
      const referenceSpaces = ['local-floor', 'local', 'bounded-floor'];
      let session: XRSession | null = null;
      
      for (const refSpace of referenceSpaces) {
        try {
          const tryInit = { ...sessionInit, requiredFeatures: [refSpace] };
          const s = await navigator.xr?.requestSession('immersive-vr', tryInit);
          if (s) {
            session = s;
            console.log(`[VR] Using reference space: ${refSpace}`);
            break;
          }
        } catch (e) {
          console.log(`[VR] Reference space '${refSpace}' not available, trying next...`);
          continue;
        }
      }
      
      // Fallback: try without required features
      if (!session) {
        try {
          const s = await navigator.xr?.requestSession('immersive-vr', {
            optionalFeatures: sessionInit.optionalFeatures
          });
          if (s) session = s;
        } catch (e) {
          console.warn('[VR] Could not start VR session:', e);
        }
      }
      
      if (session) {
        this.renderer.xr.setSession(session);
        this.isVR = true;
        
        // Detect controllers when session starts
        session.addEventListener('inputsourceschange', () => {
          this.detectControllers(session!);
        });
        
        session.addEventListener('end', () => {
          this.isVR = false;
          this.vrSystem = 'unknown';
        });
        
        // Initial controller detection
        this.detectControllers(session);
        
        // Set visibility state handler (for SteamVR dashboard)
        session.addEventListener('visibilitychange', () => {
          console.log(`[VR] Visibility changed: ${session!.visibilityState}`);
          // When SteamVR dashboard opens, visibility becomes 'hidden'
          // We can pause the game or show a message
        });
        
        console.log(`[VR] Session started. System: ${this.vrSystem}, Controllers: ${this.controllerProfiles.join(', ')}`);
      }
    } catch (e) {
      console.error('Failed to enter VR:', e);
      
      let message = 'Не удалось войти в VR режим.\n\n';
      
      if (mode === 'steamvr') {
        message += 'Для SteamVR:\n';
        message += '1. Запустите SteamVR\n';
        message += '2. Откройте SteamVR Browser или используйте ALVR/Virtual Desktop\n';
        message += '3. Убедитесь, что контроллеры подключены\n';
      } else if (mode === 'oculus') {
        message += 'Для Oculus/Meta Quest:\n';
        message += '1. Откройте Oculus Browser\n';
        message += '2. Перейдите по ссылке на эту игру\n';
        message += '3. Нажмите "Войти в VR"\n';
      } else {
        message += 'Убедитесь, что VR-гарнитура подключена и SteamVR/Oculus запущен.';
      }
      
      alert(message);
    }
  }
  
  private async detectVRSystem(): Promise<void> {
    if (!navigator.xr) {
      this.vrSystem = 'unknown';
      return;
    }
    
    try {
      // Check for Oculus browser
      const ua = navigator.userAgent.toLowerCase();
      if (ua.includes('oculus') || ua.includes('quest')) {
        this.vrSystem = 'oculus';
        return;
      }
      
      // Check for SteamVR (via SteamVR Browser or desktop browser with SteamVR running)
      if (ua.includes('steamvr') || ua.includes('valve')) {
        this.vrSystem = 'steamvr';
        return;
      }
      
      // Check for Windows Mixed Reality
      if (ua.includes('windows mixed reality') || ua.includes('wmr')) {
        this.vrSystem = 'wmr';
        return;
      }
      
      // Try to detect from XR system info
      const session = await navigator.xr.requestSession('inline');
      if (session) {
        // Check input sources for controller hints
        const inputSources = session.inputSources;
        for (const source of inputSources) {
          if (source.profiles) {
            for (const profile of source.profiles) {
              if (profile.includes('valve') || profile.includes('index')) {
                this.vrSystem = 'steamvr';
                break;
              }
              if (profile.includes('htc') || profile.includes('vive')) {
                this.vrSystem = 'steamvr';
                break;
              }
              if (profile.includes('oculus') || profile.includes('meta')) {
                this.vrSystem = 'oculus';
                break;
              }
              if (profile.includes('microsoft') || profile.includes('wmr')) {
                this.vrSystem = 'wmr';
                break;
              }
            }
          }
        }
        await session.end();
      }
      
      // Default: check if SteamVR is likely running (desktop browser with XR support)
      if (this.vrSystem === 'unknown') {
        // Assume SteamVR if on desktop with XR support
        if (!ua.includes('mobile') && !ua.includes('android')) {
          this.vrSystem = 'steamvr';
        }
      }
    } catch (e) {
      console.warn('VR system detection failed:', e);
      this.vrSystem = 'unknown';
    }
  }
  
  private detectControllers(session: XRSession): void {
    this.controllerProfiles = [];
    
    for (const source of session.inputSources) {
      if (source.profiles) {
        for (const profile of source.profiles) {
          if (!this.controllerProfiles.includes(profile)) {
            this.controllerProfiles.push(profile);
          }
        }
      }
      
      // Update controller visuals based on profile
      const hand = source.handedness;
      const controllerIdx = hand === 'left' ? 0 : 1;
      
      if (this.controllers[controllerIdx]) {
        this.updateControllerVisuals(this.controllers[controllerIdx], source.profiles || []);
      }
    }
    
    console.log(`[VR] Controllers detected: ${this.controllerProfiles.join(', ')}`);
  }
  
  private updateControllerVisuals(controller: THREE.Group, profiles: string[]): void {
    // Determine controller type and update visuals
    const isIndex = profiles.some(p => p.includes('index') || p.includes('valve'));
    const isVive = profiles.some(p => p.includes('vive') || p.includes('htc'));
    const isOculus = profiles.some(p => p.includes('oculus-touch') || p.includes('meta-quest'));
    const isWMR = profiles.some(p => p.includes('microsoft') || p.includes('wmr'));
    const isHandTracking = profiles.some(p => p.includes('hand') || p.includes('generic-hand'));
    
    // Clear existing children
    while (controller.children.length > 0) {
      controller.remove(controller.children[0]);
    }
    
    if (isHandTracking) {
      // Hand tracking mode - create hand model
      this.createHandModel(controller);
      return;
    }
    
    // Controller body
    const bodyGeo = new THREE.BoxGeometry(0.04, 0.04, 0.12);
    const bodyMat = new THREE.MeshStandardMaterial({ 
      metalness: 0.5,
      roughness: 0.3
    });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    
    // Adjust controller model based on type
    if (isIndex) {
      // Valve Index - knuckles style (ring controller)
      body.scale.set(1.2, 0.8, 1.5);
      bodyMat.color.setHex(0x222222);
      
      // Add knuckle strap visual
      const strapGeo = new THREE.TorusGeometry(0.04, 0.008, 8, 16, Math.PI);
      const strapMat = new THREE.MeshStandardMaterial({ color: 0x444444 });
      const strap = new THREE.Mesh(strapGeo, strapMat);
      strap.position.set(0, 0.03, 0);
      strap.rotation.x = Math.PI / 2;
      controller.add(strap);
    } else if (isVive) {
      // HTC Vive wand
      body.scale.set(0.8, 0.8, 1.8);
      bodyMat.color.setHex(0x333333);
      
      // Add trackpad
      const trackpadGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.005, 16);
      const trackpadMat = new THREE.MeshStandardMaterial({ color: 0x111111 });
      const trackpad = new THREE.Mesh(trackpadGeo, trackpadMat);
      trackpad.position.set(0, 0.025, -0.02);
      controller.add(trackpad);
    } else if (isOculus) {
      // Oculus Touch
      body.scale.set(0.9, 0.9, 1.2);
      bodyMat.color.setHex(0x1a1a1a);
      
      // Add ring
      const ringGeo = new THREE.TorusGeometry(0.03, 0.005, 8, 16);
      const ringMat = new THREE.MeshStandardMaterial({ color: 0x333333 });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.position.set(0, 0.02, -0.03);
      controller.add(ring);
    } else if (isWMR) {
      // Windows Mixed Reality
      body.scale.set(1.0, 0.9, 1.4);
      bodyMat.color.setHex(0x2a2a2a);
    }
    
    controller.add(body);
    
    // Pointer/ray
    const rayGeo = new THREE.CylinderGeometry(0.002, 0.001, 3, 4);
    const rayMat = new THREE.MeshBasicMaterial({ 
      color: isIndex ? 0x00ff88 : isVive ? 0x00aaff : isOculus ? 0xff8800 : 0xffff00, 
      transparent: true, 
      opacity: 0.6 
    });
    const ray = new THREE.Mesh(rayGeo, rayMat);
    ray.rotation.x = Math.PI / 2;
    ray.position.z = -1.5;
    controller.add(ray);
    
    // Trigger indicator
    const triggerGeo = new THREE.SphereGeometry(0.01, 8, 8);
    const triggerMat = new THREE.MeshBasicMaterial({ color: 0xffff00 });
    const triggerMesh = new THREE.Mesh(triggerGeo, triggerMat);
    triggerMesh.position.set(0, -0.03, -0.02);
    controller.add(triggerMesh);
  }
  
  private createHandModel(hand: THREE.Group): void {
    // Simple hand model for hand tracking
    const palmGeo = new THREE.BoxGeometry(0.08, 0.02, 0.1);
    const skinMat = new THREE.MeshStandardMaterial({ color: 0xffcc99, roughness: 0.8 });
    const palm = new THREE.Mesh(palmGeo, skinMat);
    hand.add(palm);
    
    // Fingers
    const fingerGeo = new THREE.CapsuleGeometry(0.008, 0.04, 4, 8);
    const fingerPositions = [
      [-0.03, 0, -0.06], // index
      [-0.01, 0, -0.065], // middle
      [0.01, 0, -0.06], // ring
      [0.03, 0, -0.05], // pinky
    ];
    
    fingerPositions.forEach(pos => {
      const finger = new THREE.Mesh(fingerGeo, skinMat);
      finger.position.set(pos[0], pos[1], pos[2]);
      finger.rotation.x = Math.PI / 2;
      hand.add(finger);
    });
    
    // Thumb
    const thumbGeo = new THREE.CapsuleGeometry(0.01, 0.03, 4, 8);
    const thumb = new THREE.Mesh(thumbGeo, skinMat);
    thumb.position.set(-0.05, 0, -0.02);
    thumb.rotation.z = Math.PI / 4;
    thumb.rotation.x = Math.PI / 2;
    hand.add(thumb);
    
    // Pointer ray from index finger
    const rayGeo = new THREE.CylinderGeometry(0.002, 0.001, 3, 4);
    const rayMat = new THREE.MeshBasicMaterial({ 
      color: 0x00ffff, 
      transparent: true, 
      opacity: 0.6 
    });
    const ray = new THREE.Mesh(rayGeo, rayMat);
    ray.rotation.x = Math.PI / 2;
    ray.position.set(-0.03, 0, -1.5);
    hand.add(ray);
  }
  
  public getVRSystem(): string {
    return this.vrSystem;
  }
  
  public getControllerProfiles(): string[] {
    return this.controllerProfiles;
  }
  
  // === MULTIPLAYER METHODS ===
  
  public async initializeMultiplayer(): Promise<string> {
    const roomCode = await this.multiplayer.initialize(
      (player) => this.onPlayerJoin(player),
      (playerId) => this.onPlayerLeave(playerId),
      (player) => this.onPlayerUpdate(player),
      (message) => this.onNetworkMessage(message),
      (connected, count) => this.onConnectionChange(connected, count)
    );
    
    console.log(`[Multiplayer] Room code: ${roomCode}`);
    return roomCode;
  }
  
  public async joinMultiplayerRoom(roomCode: string): Promise<void> {
    await this.multiplayer.joinRoom(roomCode.toLowerCase());
  }
  
  private onPlayerJoin(player: PlayerData): void {
    console.log(`[Multiplayer] Player joined: ${player.name}`);
    this.createRemotePlayer(player);
  }
  
  private onPlayerLeave(playerId: string): void {
    console.log(`[Multiplayer] Player left: ${playerId}`);
    this.removeRemotePlayer(playerId);
  }
  
  private onPlayerUpdate(player: PlayerData): void {
    const remotePlayer = this.remotePlayers.get(player.id);
    if (remotePlayer) {
      remotePlayer.targetPosition.set(player.position.x, player.position.y, player.position.z);
      remotePlayer.targetRotation.set(player.rotation.x, player.rotation.y, player.rotation.z);
      remotePlayer.health = player.health;
      remotePlayer.score = player.score;
    }
  }
  
  private onNetworkMessage(message: NetworkMessage): void {
    switch (message.type) {
      case 'dropTroop':
        // Another player dropped a troop
        this.createRemoteTroop(message.data);
        break;
      case 'bulletFire':
        // Another player fired a bullet
        this.createRemoteBullet(message.data);
        break;
      case 'hit':
        // We got hit
        if (message.data.targetId === this.multiplayer.getMyId()) {
          // Take damage
          console.log(`[Multiplayer] We got hit for ${message.data.damage} damage`);
        }
        break;
      case 'chat':
        console.log(`[Chat] ${message.data.senderName}: ${message.data.message}`);
        break;
    }
  }
  
  private onConnectionChange(connected: boolean, playerCount: number): void {
    console.log(`[Multiplayer] Connection: ${connected}, Players: ${playerCount}`);
  }
  
  private createRemotePlayer(player: PlayerData): void {
    const playerGroup = new THREE.Group();
    
    // Body
    const bodyGeo = new THREE.CapsuleGeometry(0.2, 0.6, 4, 8);
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x4a6741 });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    playerGroup.add(body);
    
    // Head
    const headGeo = new THREE.SphereGeometry(0.15, 8, 8);
    const headMat = new THREE.MeshStandardMaterial({ color: 0xffcc99 });
    const head = new THREE.Mesh(headGeo, headMat);
    head.position.y = 0.5;
    playerGroup.add(head);
    
    // Helmet
    const helmetGeo = new THREE.SphereGeometry(0.16, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2);
    const helmetMat = new THREE.MeshStandardMaterial({ color: 0x2d4a2d });
    const helmet = new THREE.Mesh(helmetGeo, helmetMat);
    helmet.position.y = 0.55;
    playerGroup.add(helmet);
    
    // Name tag
    const nameCanvas = document.createElement('canvas');
    nameCanvas.width = 256;
    nameCanvas.height = 64;
    const ctx = nameCanvas.getContext('2d')!;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(0, 0, 256, 64);
    ctx.fillStyle = '#00ff00';
    ctx.font = 'bold 24px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(player.name, 128, 40);
    
    const nameTexture = new THREE.CanvasTexture(nameCanvas);
    const nameMat = new THREE.SpriteMaterial({ map: nameTexture, transparent: true });
    const nameSprite = new THREE.Sprite(nameMat);
    nameSprite.scale.set(1, 0.25, 1);
    nameSprite.position.y = 1;
    playerGroup.add(nameSprite);
    
    playerGroup.position.set(player.position.x, player.position.y, player.position.z);
    this.scene.add(playerGroup);
    
    this.remotePlayers.set(player.id, {
      id: player.id,
      name: player.name,
      mesh: playerGroup,
      nameSprite,
      targetPosition: new THREE.Vector3(player.position.x, player.position.y, player.position.z),
      targetRotation: new THREE.Euler(player.rotation.x, player.rotation.y, player.rotation.z),
      inAirplane: player.inAirplane,
      health: player.health,
      score: player.score
    });
  }
  
  private removeRemotePlayer(playerId: string): void {
    const remotePlayer = this.remotePlayers.get(playerId);
    if (remotePlayer) {
      this.scene.remove(remotePlayer.mesh);
      this.remotePlayers.delete(playerId);
    }
  }
  
  private updateRemotePlayers(delta: number): void {
    this.remotePlayers.forEach((player) => {
      // Smooth interpolation
      player.mesh.position.lerp(player.targetPosition, delta * 10);
      
      // Smooth rotation
      player.mesh.rotation.x = THREE.MathUtils.lerp(player.mesh.rotation.x, player.targetRotation.x, delta * 10);
      player.mesh.rotation.y = THREE.MathUtils.lerp(player.mesh.rotation.y, player.targetRotation.y, delta * 10);
      player.mesh.rotation.z = THREE.MathUtils.lerp(player.mesh.rotation.z, player.targetRotation.z, delta * 10);
    });
  }
  
  private sendNetworkUpdate(): void {
    const now = Date.now();
    if (now - this.lastNetworkUpdate < this.networkUpdateInterval) return;
    
    this.lastNetworkUpdate = now;
    
    const playerData: PlayerData = {
      id: this.multiplayer.getMyId(),
      name: 'Player',
      position: {
        x: this.airplane.position.x,
        y: this.airplane.position.y,
        z: this.airplane.position.z
      },
      rotation: {
        x: this.airplane.rotation.x,
        y: this.airplane.rotation.y,
        z: this.airplane.rotation.z
      },
      inAirplane: true,
      health: 100,
      score: this.score
    };
    
    this.multiplayer.sendPlayerUpdate(playerData);
  }
  
  private createRemoteTroop(data: any): void {
    // Create troop from another player
    const troop = new THREE.Group();
    
    const bodyGeo = new THREE.CapsuleGeometry(0.15, 0.4, 4, 8);
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x4a6741 });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    troop.add(body);
    
    const headGeo = new THREE.SphereGeometry(0.12, 8, 8);
    const headMat = new THREE.MeshStandardMaterial({ color: 0x4a6741 });
    const head = new THREE.Mesh(headGeo, headMat);
    head.position.y = 0.35;
    troop.add(head);
    
    // Parachute
    const parachuteGeo = new THREE.SphereGeometry(0.8, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2);
    const parachuteMat = new THREE.MeshStandardMaterial({ 
      color: 0xff6600, 
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.8
    });
    const parachute = new THREE.Mesh(parachuteGeo, parachuteMat);
    parachute.position.y = 2;
    parachute.name = 'parachute';
    troop.add(parachute);
    
    troop.position.set(data.position.x, data.position.y, data.position.z);
    this.scene.add(troop);
    
    this.troops.push({
      mesh: troop,
      velocity: new THREE.Vector3(data.velocity.x, data.velocity.y, data.velocity.z),
      landed: false,
      health: 100
    });
  }
  
  private createRemoteBullet(data: any): void {
    const bulletGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.8, 4);
    const bulletMat = new THREE.MeshBasicMaterial({ color: 0xffaa00 });
    const bullet = new THREE.Mesh(bulletGeo, bulletMat);
    bullet.position.set(data.position.x, data.position.y, data.position.z);
    
    bullet.quaternion.setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      new THREE.Vector3(data.direction.x, data.direction.y, data.direction.z).normalize()
    );
    
    this.scene.add(bullet);
    
    this.bullets.push({
      mesh: bullet,
      velocity: new THREE.Vector3(data.velocity.x, data.velocity.y, data.velocity.z),
      life: 3
    });
  }
  
  public getMultiplayer(): MultiplayerManager {
    return this.multiplayer;
  }
  
  public getPlayerCount(): number {
    return this.multiplayer.getPlayerCount();
  }
  
  // SteamVR Chaperone support - show play area boundaries
  private setupChaperoneBounds(): void {
    // Create visible boundary walls that match SteamVR chaperone
    const boundaryGroup = new THREE.Group();
    boundaryGroup.name = 'chaperoneBounds';
    
    const wallMat = new THREE.MeshBasicMaterial({
      color: 0x00ff88,
      transparent: true,
      opacity: 0.0, // Hidden by default, shown when near boundary
      side: THREE.DoubleSide
    });
    
    // Create boundary indicator (floor grid)
    const gridSize = 4; // 4x4 meter play area
    const gridHelper = new THREE.GridHelper(gridSize, 8, 0x00ff88, 0x004422);
    (gridHelper.material as THREE.Material).transparent = true;
    (gridHelper.material as THREE.Material).opacity = 0.2;
    gridHelper.position.y = -0.5;
    boundaryGroup.add(gridHelper);
    
    // Corner posts
    const postGeo = new THREE.CylinderGeometry(0.02, 0.02, 2, 8);
    const postMat = new THREE.MeshBasicMaterial({ color: 0x00ff88, transparent: true, opacity: 0.3 });
    const corners = [
      [-gridSize/2, 0.5, -gridSize/2],
      [gridSize/2, 0.5, -gridSize/2],
      [-gridSize/2, 0.5, gridSize/2],
      [gridSize/2, 0.5, gridSize/2]
    ];
    
    corners.forEach(pos => {
      const post = new THREE.Mesh(postGeo, postMat);
      post.position.set(pos[0], pos[1], pos[2]);
      boundaryGroup.add(post);
    });
    
    this.cockpit.add(boundaryGroup);
  }
  
  // SteamVR Overlay support - render HUD as SteamVR overlay
  public async setupSteamVROverlay(): Promise<void> {
    if (this.vrSystem !== 'steamvr') return;
    
    try {
      // Check if WebXR Layers API is available
      const session = this.renderer.xr.getSession();
      if (!session) return;
      
      // Request layers feature if available
      const supportedModes = (session as any).supportedDepthFormats;
      console.log('[SteamVR] Session capabilities:', supportedModes);
      
      // Use quad layer for HUD (better performance than rendering to texture)
      if ('requestReferenceSpace' in session) {
        console.log('[SteamVR] Overlay support initialized');
      }
    } catch (e) {
      console.warn('[SteamVR] Overlay setup failed:', e);
    }
  }
  
  // Mouse/keyboard fallback for non-VR
  public setupDesktopControls(): void {
    const keys: { [key: string]: boolean } = {};
    let mouseX = 0;
    let mouseY = 0;
    
    document.addEventListener('keydown', (e) => {
      keys[e.key.toLowerCase()] = true;
      
      if (e.key === ' ') {
        this.machineGunActive = true;
        e.preventDefault();
      }
      if (e.key === 'e' || e.key === 'у') {
        this.dropTroop();
      }
      if (e.key === 'q' || e.key === 'й') {
        this.enginePower = Math.min(1, this.enginePower + 0.1);
      }
    });
    
    document.addEventListener('keyup', (e) => {
      keys[e.key.toLowerCase()] = false;
      
      if (e.key === ' ') {
        this.machineGunActive = false;
      }
    });
    
    // Update controls in animation loop - runs every frame
    const updateControls = () => {
      // A/D for rudder (turn left/right)
      if (keys['a'] || keys['ф']) {
        this.rudderAngle = THREE.MathUtils.lerp(this.rudderAngle, -1, 0.1);
      } else if (keys['d'] || keys['в']) {
        this.rudderAngle = THREE.MathUtils.lerp(this.rudderAngle, 1, 0.1);
      } else {
        this.rudderAngle = THREE.MathUtils.lerp(this.rudderAngle, 0, 0.05);
      }
      
      // W/S for elevator (pitch up/down)
      if (keys['w'] || keys['ц']) {
        this.elevatorAngle = THREE.MathUtils.lerp(this.elevatorAngle, 1, 0.1);
      } else if (keys['s'] || keys['ы']) {
        this.elevatorAngle = THREE.MathUtils.lerp(this.elevatorAngle, -1, 0.1);
      } else {
        this.elevatorAngle = THREE.MathUtils.lerp(this.elevatorAngle, 0, 0.05);
      }
      
      // Shift/Ctrl for throttle
      if (keys['shift']) {
        this.enginePower = Math.min(1, this.enginePower + 0.005);
      }
      if (keys['control']) {
        this.enginePower = Math.max(0, this.enginePower - 0.005);
      }
      
      // Mouse look affects heading directly
      this.heading += mouseX * 0.5;
      mouseX *= 0.9; // Dampen mouse input
      
      requestAnimationFrame(updateControls);
    };
    updateControls();
    
    // Mouse look with pointer lock
    let isPointerLocked = false;
    
    this.renderer.domElement.addEventListener('click', () => {
      if (!isPointerLocked) {
        this.renderer.domElement.requestPointerLock();
      }
    });
    
    document.addEventListener('pointerlockchange', () => {
      isPointerLocked = document.pointerLockElement === this.renderer.domElement;
    });
    
    document.addEventListener('mousemove', (e) => {
      if (!isPointerLocked) return;
      
      // Horizontal mouse movement = heading change
      mouseX = -e.movementX * 0.01;
      
      // Vertical mouse movement = elevator input
      this.elevatorAngle = THREE.MathUtils.clamp(
        this.elevatorAngle - e.movementY * 0.002,
        -1, 1
      );
    });
    
    console.log('[Controls] Desktop controls initialized. Click to enable mouse look.');
    console.log('[Controls] WASD - fly, Space - fire, E - drop troops, Shift/Ctrl - throttle');
  }
  
  public dispose(): void {
    this.renderer.setAnimationLoop(null);
    this.renderer.dispose();
    if (this.container.contains(this.renderer.domElement)) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
