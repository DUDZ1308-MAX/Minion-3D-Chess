import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const THEMES = [
  { name: 'Classic', light: 0xf0d9b5, dark: 0xb58863, bg: 0x1a1a2e, premium: false },
  { name: 'Emerald', light: 0xbddfb0, dark: 0x4a8c5c, bg: 0x0d1f0d, premium: false },
  { name: 'Ocean',  light: 0xb0d0e0, dark: 0x3a7a9a, bg: 0x0a1628, premium: false },
  { name: 'Sunset', light: 0xf5d0a0, dark: 0xd4785a, bg: 0x2a1020, premium: false },
  { name: 'Forest', light: 0xc8d8a0, dark: 0x5a7a3a, bg: 0x0f1a0a, premium: true },
  { name: 'Royal',  light: 0xe0d0f0, dark: 0x7a5a9a, bg: 0x1a1028, premium: true },
  { name: 'Midnight', light: 0x8898a8, dark: 0x384858, bg: 0x050510, premium: true },
  { name: 'Candy',  light: 0xf0d8e8, dark: 0xd07090, bg: 0x1a0810, premium: true },
  { name: 'Gold',   light: 0xffeebb, dark: 0xcc9900, bg: 0x1a1200, premium: true },
  { name: 'Amethyst', light: 0xddccee, dark: 0x8833aa, bg: 0x1a0020, premium: true },
  { name: 'Ruby',   light: 0xeedddd, dark: 0xcc3344, bg: 0x200808, premium: true },
  { name: 'Neon',   light: 0xccffcc, dark: 0x00ff88, bg: 0x001a0a, premium: true },
];
const DEFAULT_THEME = THEMES[0];
const LIGHT_SQUARE = DEFAULT_THEME.light;
const DARK_SQUARE = DEFAULT_THEME.dark;

const SELECTED_COLOR = 0xf7ec13;
const VALID_MOVE_COLOR = 0x75e075;
const CAPTURE_COLOR = 0xe05555;
const LAST_MOVE_COLOR = 0xaaaaff;

export class Chess3DRenderer {
  constructor(container, game, callbacks) {
    this.container = container;
    this.game = game;
    this.callbacks = callbacks || {};
    this.scene = new THREE.Scene();
    this.camera = null;
    this.renderer = null;
    this.controls = null;
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();
    this.boardGroup = new THREE.Group();
    this.pieceGroup = new THREE.Group();
    this.highlightGroup = new THREE.Group();
    this.cursorGroup = new THREE.Group();
    this.selectedPiece = null;
    this.validMoves = [];
    this.pieceMeshes = {};
    this.squareMeshes = [];
    this.lastMoveSquares = [];
    this.cursorRow = 0;
    this.cursorCol = 0;
    this.cursorMesh = null;
    this.currentTheme = 0;
    this.allThemes = THEMES;
    this.lightMat = null;
    this.darkMat = null;
    this.groundMat = null;
    this.animating = false;
    this.inputEnabled = true;
  }

  init() {
    this.scene.background = new THREE.Color(0x1a1a2e);

    this.camera = new THREE.PerspectiveCamera(
      45,
      window.innerWidth / window.innerHeight,
      0.1,
      100
    );
    this.camera.position.set(8, 10, 8);

    try {
      this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    } catch (e) {
      return;
    }
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.container.appendChild(this.renderer.domElement);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.1;
    this.controls.target.set(0, 0, 0);
    this.controls.minDistance = 5;
    this.controls.maxDistance = 20;
    this.controls.maxPolarAngle = Math.PI / 2.05;
    this.controls.update();

    const ambientLight = new THREE.AmbientLight(0x404060, 0.6);
    this.scene.add(ambientLight);

    const mainLight = new THREE.DirectionalLight(0xffeedd, 2.0);
    mainLight.position.set(8, 15, 5);
    mainLight.castShadow = true;
    mainLight.shadow.mapSize.width = 2048;
    mainLight.shadow.mapSize.height = 2048;
    mainLight.shadow.camera.near = 0.5;
    mainLight.shadow.camera.far = 50;
    mainLight.shadow.camera.left = -12;
    mainLight.shadow.camera.right = 12;
    mainLight.shadow.camera.top = 12;
    mainLight.shadow.camera.bottom = -12;
    mainLight.shadow.bias = -0.002;
    this.scene.add(mainLight);

    const fillLight = new THREE.DirectionalLight(0x8888ff, 0.4);
    fillLight.position.set(-5, 5, -8);
    this.scene.add(fillLight);

    const rimLight = new THREE.DirectionalLight(0xffffff, 0.3);
    rimLight.position.set(0, -2, 10);
    this.scene.add(rimLight);

    const groundGeo = new THREE.PlaneGeometry(20, 20);
    this.groundMat = new THREE.MeshStandardMaterial({
      color: 0x1a1a2e,
      roughness: 0.9,
      metalness: 0
    });
    const ground = new THREE.Mesh(groundGeo, this.groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.15;
    ground.receiveShadow = true;
    this.scene.add(ground);

    this.createBoard();
    this.scene.add(this.boardGroup);
    this.scene.add(this.pieceGroup);
    this.scene.add(this.highlightGroup);
    this.scene.add(this.cursorGroup);
    this.updatePieces();
    this.highlightMoves([]);
    this.renderCursor();

    this.renderer.domElement.addEventListener('pointerdown', (e) => this.onPointerDown(e));
    this.renderer.domElement.addEventListener('pointerup', (e) => this.onPointerUp(e));
    window.addEventListener('resize', () => this.onResize());
    document.addEventListener('keydown', (e) => this.onKeyDown(e));

    this.animate();
  }

  createBoard() {
    this.lightMat = new THREE.MeshStandardMaterial({ color: LIGHT_SQUARE, roughness: 0.5, metalness: 0.05 });
    this.darkMat = new THREE.MeshStandardMaterial({ color: DARK_SQUARE, roughness: 0.5, metalness: 0.05 });

    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const isLight = (row + col) % 2 === 0;
        const mat = isLight ? this.lightMat : this.darkMat;
        const geo = new THREE.BoxGeometry(0.96, 0.08, 0.96);
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(col - 3.5, -0.04, row - 3.5);
        mesh.receiveShadow = true;
        mesh.userData = { row, col };
        this.boardGroup.add(mesh);
        this.squareMeshes.push(mesh);
      }
    }

    const frameMat = new THREE.MeshStandardMaterial({ color: 0x3a2510, roughness: 0.8, metalness: 0.1 });
    const frameGeo = new THREE.BoxGeometry(8.2, 0.12, 8.2);
    const frame = new THREE.Mesh(frameGeo, frameMat);
    frame.position.set(0, -0.08, 0);
    frame.receiveShadow = true;
    this.boardGroup.add(frame);
  }

  createPieceMesh(piece) {
    const group = new THREE.Group();
    const isWhite = piece.color === 'white';

    const skinColor = isWhite ? 0xf5d742 : 0x6b2fa0;
    const overallColor = isWhite ? 0x2a6f8f : 0x2a1a3a;

    const m = (c, r = 0.25, ml = 0.08) =>
      new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: ml });

    const skin = m(skinColor, 0.5, 0.05);
    const overallMat = m(overallColor, 0.7, 0.02);
    const dark = m(0x222222, 0.8, 0.02);
    const eyeWhite = m(0xffffff, 0.1, 0);
    const goggleMat = m(0x444444, 0.8, 0);
    const accentMat = m(isWhite ? 0xd4c9a8 : 0x555555, 0.3, 0.1);
    const gold = m(0xffd700, 0.15, 0.9);

    const cyl = (rt, rb, h, mat) => new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, 12), mat);
    const sphere = (r, mat) => new THREE.Mesh(new THREE.SphereGeometry(r, 10, 10), mat);
    const box = (w, h, d, mat) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    const cone = (rt, h, seg, mat) => new THREE.Mesh(new THREE.ConeGeometry(rt, h, seg), mat);
    const torus = (r, t, mat) => new THREE.Mesh(new THREE.TorusGeometry(r, t, 8, 20), mat);

    for (const d of [-1, 1]) {
      const leg = cyl(0.03, 0.035, 0.04, skin);
      leg.position.set(d * 0.07, 0.02, 0);
      group.add(leg);
      const boot = sphere(0.035, dark);
      boot.position.set(d * 0.07, 0, 0.01);
      boot.scale.set(1, 0.7, 1.3);
      group.add(boot);
    }

    const body = cyl(0.18, 0.19, 0.22, skin);
    body.position.y = 0.14;
    group.add(body);

    const top = new THREE.Mesh(
      new THREE.SphereGeometry(0.18, 12, 10, 0, Math.PI * 2, 0, Math.PI / 2), skin
    );
    top.position.y = 0.25;
    group.add(top);

    const overalls = cyl(0.17, 0.18, 0.10, overallMat);
    overalls.position.y = 0.08;
    group.add(overalls);

    if (piece.type !== 'knight') {
      const bib = box(0.04, 0.06, 0.005, overallMat);
      bib.position.set(0, 0.12, 0.21);
      group.add(bib);
    }

    for (const d of [-1, 1]) {
      const strap = box(0.01, 0.06, 0.03, overallMat);
      strap.position.set(d * 0.10, 0.15, 0.10);
      group.add(strap);
    }

    for (const d of [-1, 1]) {
      const arm = cyl(0.02, 0.025, 0.07, skin);
      arm.position.set(d * 0.20, 0.14, 0);
      arm.rotation.z = d * 0.3;
      arm.rotation.x = 0.2;
      group.add(arm);
      const glove = sphere(0.025, dark);
      glove.position.set(d * 0.23, 0.09, 0.03);
      glove.scale.set(1, 0.8, 1.1);
      group.add(glove);
    }

    if (piece.type !== 'knight') {
      const twoEyes = piece.type === 'rook' || piece.type === 'queen' || piece.type === 'king';
      if (twoEyes) {
        for (const d of [-1, 1]) {
          const e = sphere(0.04, eyeWhite);
          e.position.set(d * 0.055, 0.22, 0.23);
          group.add(e);
          const p = sphere(0.02, dark);
          p.position.set(d * 0.055, 0.22, 0.27);
          group.add(p);
        }
      } else {
        const e = sphere(0.06, eyeWhite);
        e.position.set(0, 0.22, 0.23);
        group.add(e);
        const p = sphere(0.03, dark);
        p.position.set(0, 0.22, 0.29);
        group.add(p);
      }

      const gog = torus(0.195, 0.015, goggleMat);
      gog.position.y = 0.22;
      gog.rotation.x = Math.PI / 2;
      group.add(gog);
    }

    switch (piece.type) {
      case 'pawn': {
        const spike = cone(0.015, 0.05, 6, skin);
        spike.position.set(0, 0.46, 0);
        group.add(spike);
        const spike2 = cone(0.01, 0.03, 6, skin);
        spike2.position.set(-0.04, 0.44, -0.01);
        group.add(spike2);
        break;
      }
      case 'rook': {
        const wall = cyl(0.14, 0.15, 0.04, accentMat);
        wall.position.y = 0.46;
        group.add(wall);
        for (let i = 0; i < 4; i++) {
          const a = (i / 4) * Math.PI * 2;
          const batt = cyl(0.025, 0.03, 0.06, accentMat);
          batt.position.set(Math.sin(a) * 0.12, 0.52, Math.cos(a) * 0.12);
          group.add(batt);
        }
        break;
      }
      case 'knight': {
        const headGroup = new THREE.Group();
        const head = box(0.10, 0.08, 0.18, skin);
        head.position.set(0, 0.04, 0.02);
        headGroup.add(head);
        const snout = box(0.065, 0.045, 0.09, accentMat);
        snout.position.set(0, 0.01, 0.15);
        headGroup.add(snout);
        for (const d of [-1, 1]) {
          const nostril = sphere(0.012, dark);
          nostril.position.set(d * 0.02, 0.005, 0.20);
          headGroup.add(nostril);
        }
        for (const d of [-1, 1]) {
          const eye = sphere(0.02, eyeWhite);
          eye.position.set(d * 0.06, 0.06, 0.06);
          headGroup.add(eye);
          const pupil = sphere(0.012, dark);
          pupil.position.set(d * 0.06, 0.06, 0.09);
          headGroup.add(pupil);
        }
        for (const d of [-1, 1]) {
          const ear = cone(0.015, 0.06, 6, accentMat);
          ear.position.set(d * 0.035, 0.11, -0.02);
          ear.rotation.z = d * 0.3;
          headGroup.add(ear);
        }
        for (let i = 0; i < 4; i++) {
          const m = cone(0.015, 0.035, 6, accentMat);
          m.position.set(0, 0.09 + i * 0.01, -0.06 + i * 0.035);
          m.rotation.x = 0.3;
          headGroup.add(m);
        }
        headGroup.position.set(0, 0.30, 0.10);
        headGroup.rotation.x = -0.3;
        group.add(headGroup);
        break;
      }
      case 'bishop': {
        const hat = cone(0.06, 0.12, 12, accentMat);
        hat.position.y = 0.46;
        group.add(hat);
        const hatTop = cone(0.02, 0.04, 8, accentMat);
        hatTop.position.y = 0.54;
        group.add(hatTop);
        const collar = torus(0.12, 0.02, accentMat);
        collar.position.y = 0.44;
        group.add(collar);
        break;
      }
      case 'queen': {
        const crownRing = torus(0.12, 0.025, gold);
        crownRing.position.y = 0.44;
        crownRing.rotation.x = Math.PI / 2;
        group.add(crownRing);
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2;
          const point = cone(0.02, 0.06, 6, gold);
          point.position.set(Math.sin(a) * 0.11, 0.48, Math.cos(a) * 0.11);
          group.add(point);
        }
        break;
      }
      case 'king': {
        const crownRing = torus(0.14, 0.025, gold);
        crownRing.position.y = 0.44;
        crownRing.rotation.x = Math.PI / 2;
        group.add(crownRing);
        for (let i = 0; i < 5; i++) {
          const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
          const prong = cone(0.025, 0.08, 6, gold);
          prong.position.set(Math.sin(a) * 0.13, 0.49, Math.cos(a) * 0.13);
          group.add(prong);
        }
        const center = cone(0.035, 0.12, 6, gold);
        center.position.y = 0.52;
        group.add(center);
        const cv = box(0.025, 0.07, 0.01, gold);
        cv.position.y = 0.59;
        group.add(cv);
        const ch = box(0.05, 0.01, 0.01, gold);
        ch.position.y = 0.59;
        group.add(ch);

        const capeMat = m(0xcc2222, 0.6, 0.1);
        capeMat.side = THREE.DoubleSide;
        const cape = new THREE.Mesh(
          new THREE.CylinderGeometry(0.19, 0.23, 0.14, 14, 1, true, Math.PI * 3 / 4, Math.PI * 3 / 2),
          capeMat
        );
        cape.position.y = 0.16;
        group.add(cape);
        break;
      }
    }

    const scaleByType = { pawn: 1.15, rook: 1.4, knight: 1.3, bishop: 1.45, queen: 1.45, king: 1.55 };
    const s = scaleByType[piece.type] || 1.4;
    group.scale.setScalar(s);

    if (piece.color === 'white') {
      group.rotation.y = Math.PI;
    }

    group.traverse(child => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });

    return group;
  }

  updatePieces() {
    while (this.pieceGroup.children.length > 0) {
      const child = this.pieceGroup.children[0];
      this.pieceGroup.remove(child);
      this.disposeObject(child);
    }
    this.pieceMeshes = {};

    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const piece = this.game.board[row][col];
        if (piece) {
          const mesh = this.createPieceMesh(piece);
          mesh.position.set(col - 3.5, 0, row - 3.5);
          this.pieceGroup.add(mesh);
          this.pieceMeshes[`${row}-${col}`] = mesh;
        }
      }
    }
  }

  disposeObject(obj) {
    if (obj.geometry) obj.geometry.dispose();
    if (obj.material) {
      if (Array.isArray(obj.material)) {
        obj.material.forEach(m => m.dispose());
      } else {
        obj.material.dispose();
      }
    }
    if (obj.children) {
      for (let i = obj.children.length - 1; i >= 0; i--) {
        this.disposeObject(obj.children[i]);
      }
    }
  }

  highlightMoves(moves) {
    this.clearHighlights();

    const validMat = new THREE.MeshBasicMaterial({
      color: VALID_MOVE_COLOR,
      transparent: true,
      opacity: 0.35,
      depthWrite: false
    });
    const captureMat = new THREE.MeshBasicMaterial({
      color: CAPTURE_COLOR,
      transparent: true,
      opacity: 0.4,
      depthWrite: false,
      side: THREE.DoubleSide
    });
    const selectedMat = new THREE.MeshBasicMaterial({
      color: SELECTED_COLOR,
      transparent: true,
      opacity: 0.4,
      depthWrite: false,
      side: THREE.DoubleSide
    });
    const lastMoveMat = new THREE.MeshBasicMaterial({
      color: LAST_MOVE_COLOR,
      transparent: true,
      opacity: 0.25,
      depthWrite: false
    });

    this.validMoves = moves;

    if (this.selectedPiece) {
      const selRing = new THREE.Mesh(
        new THREE.RingGeometry(0.38, 0.46, 32),
        selectedMat
      );
      selRing.rotation.x = -Math.PI / 2;
      selRing.position.set(this.selectedPiece.col - 3.5, 0.02, this.selectedPiece.row - 3.5);
      this.highlightGroup.add(selRing);
    }

    if (this.game.lastMove) {
      for (const pos of [this.game.lastMove.from, this.game.lastMove.to]) {
        const lm = new THREE.Mesh(
          new THREE.PlaneGeometry(0.9, 0.9),
          lastMoveMat
        );
        lm.rotation.x = -Math.PI / 2;
        lm.position.set(pos.col - 3.5, 0.015, pos.row - 3.5);
        this.highlightGroup.add(lm);
      }
    }

    for (const move of moves) {
      const isCapture = this.game.board[move.toRow][move.toCol] !== null || move.enPassantCapture;
      const geo = isCapture
        ? new THREE.RingGeometry(0.28, 0.4, 32)
        : new THREE.CircleGeometry(0.32, 32);
      const mesh = new THREE.Mesh(geo, isCapture ? captureMat : validMat);
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.set(move.toCol - 3.5, 0.02, move.toRow - 3.5);
      this.highlightGroup.add(mesh);
    }
  }

  resetState() {
    this.selectedPiece = null;
    this.validMoves = [];
    this.cursorRow = 0;
    this.cursorCol = 0;
    this.clearHighlights();
    while (this.cursorGroup.children.length > 0) {
      const child = this.cursorGroup.children[0];
      this.cursorGroup.remove(child);
      this.disposeObject(child);
    }
    this.cursorMesh = null;
    this.renderCursor();
  }

  clearHighlights() {
    while (this.highlightGroup.children.length > 0) {
      const child = this.highlightGroup.children[0];
      this.highlightGroup.remove(child);
      this.disposeObject(child);
    }
    this.validMoves = [];
  }

  onPointerDown(event) {
    if (event.button !== 0) return;
    this._pointerDown = {
      x: event.clientX,
      y: event.clientY,
      time: performance.now()
    };
  }

  onPointerUp(event) {
    if (event.button !== 0) return;
    if (!this._pointerDown) return;

    const dx = event.clientX - this._pointerDown.x;
    const dy = event.clientY - this._pointerDown.y;
    const dt = performance.now() - this._pointerDown.time;
    this._pointerDown = null;

    if (dx * dx + dy * dy > 100 || dt > 500) return;

    this.handleClick(event);
  }

  handleClick(event) {
    if (this.game.gameOver || this.animating || !this.inputEnabled) return;

    const rect = this.renderer.domElement.getBoundingClientRect();
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    this.scene.updateMatrixWorld(true);
    this.camera.updateMatrixWorld(true);
    this.raycaster.setFromCamera(this.mouse, this.camera);

    const square = this.getClickedBoardSquare();
    if (!square) return;

    const piece = this.game.board[square.row][square.col];

    if (this.selectedPiece) {
      const move = this.validMoves.find(m => m.toRow === square.row && m.toCol === square.col);
      if (move) {
        this.executeMove(move);
        return;
      }
      if (piece && piece.color === this.game.turn) {
        this.selectPiece(square.row, square.col);
        return;
      }
      this.clearHighlights();
      this.selectedPiece = null;
    } else {
      if (piece && piece.color === this.game.turn) {
        this.selectPiece(square.row, square.col);
      }
    }
  }

  getClickedBoardSquare() {
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const point = new THREE.Vector3();
    if (!this.raycaster.ray.intersectPlane(plane, point)) return null;
    const col = Math.round(point.x + 3.5);
    const row = Math.round(point.z + 3.5);
    if (row >= 0 && row < 8 && col >= 0 && col < 8) {
      return { row, col };
    }
    return null;
  }

  handlePieceClick(row, col) {
    const piece = this.game.board[row][col];
    if (!piece) return;

    if (this.selectedPiece) {
      const move = this.validMoves.find(m => m.toRow === row && m.toCol === col);
      if (move) {
        this.executeMove(move);
        return;
      }
      if (piece.color === this.game.turn) {
        this.selectPiece(row, col);
        return;
      }
      this.clearHighlights();
      this.selectedPiece = null;
      return;
    }

    if (piece.color === this.game.turn) {
      this.selectPiece(row, col);
    }
  }

  selectPiece(row, col) {
    const moves = this.game.getLegalMoves(row, col);
    if (moves.length === 0) return;
    this.selectedPiece = { row, col };
    this.highlightMoves(moves);
  }

  handleBoardClick() {
    const square = this.getClickedBoardSquare();
    if (!square) {
      this.clearHighlights();
      this.selectedPiece = null;
      return;
    }
    if (this.selectedPiece) {
      const move = this.validMoves.find(m => m.toRow === square.row && m.toCol === square.col);
      if (move) {
        this.executeMove(move);
        return;
      }
    }
    this.clearHighlights();
    this.selectedPiece = null;
  }

  executeMove(move) {
    if (this.animating) return;

    // Find piece and capture info BEFORE updating game state
    const fromKey = `${move.fromRow}-${move.fromCol}`;
    const pieceMesh = this.pieceMeshes[fromKey];
    if (!pieceMesh) return;

    let capturedMesh = null;
    let capPos = null;
    if (move.enPassantCapture) {
      // En passant: captured pawn is at fromRow, toCol
      const capKey = `${move.fromRow}-${move.toCol}`;
      capturedMesh = this.pieceMeshes[capKey];
      if (capturedMesh) {
        capPos = new THREE.Vector3(move.toCol - 3.5, 0.3, move.fromRow - 3.5);
      }
    } else if (move.toRow >= 0 && move.toCol >= 0) {
      // Normal capture
      const capKey = `${move.toRow}-${move.toCol}`;
      capturedMesh = this.pieceMeshes[capKey];
      if (capturedMesh) {
        capPos = new THREE.Vector3(move.toCol - 3.5, 0.3, move.toRow - 3.5);
      }
    }

    // Store castling info for rook animation
    let rookMesh = null;
    let rookFrom = null;
    let rookTo = null;
    let castlingBackRow = null;
    if (move.castling) {
      castlingBackRow = move.toRow;
      if (move.castling === 'kingSide') {
        const rookKey = `${castlingBackRow}-7`;
        rookMesh = this.pieceMeshes[rookKey];
        rookFrom = new THREE.Vector3(7 - 3.5, 0, castlingBackRow - 3.5);
        rookTo = new THREE.Vector3(5 - 3.5, 0, castlingBackRow - 3.5);
      } else {
        const rookKey = `${castlingBackRow}-0`;
        rookMesh = this.pieceMeshes[rookKey];
        rookFrom = new THREE.Vector3(0 - 3.5, 0, castlingBackRow - 3.5);
        rookTo = new THREE.Vector3(3 - 3.5, 0, castlingBackRow - 3.5);
      }
    }

    const result = this.game.makeMove(move);
    if (!result || !result.success) return;

    this.animating = true;
    const startPos = new THREE.Vector3(move.fromCol - 3.5, 0, move.fromRow - 3.5);
    const endPos = new THREE.Vector3(move.toCol - 3.5, 0, move.toRow - 3.5);

    // Remove captured piece from pieceMeshes if captured
    if (capturedMesh) {
      if (move.enPassantCapture) {
        delete this.pieceMeshes[`${move.fromRow}-${move.toCol}`];
      } else {
        delete this.pieceMeshes[`${move.toRow}-${move.toCol}`];
      }
    }
    // Update pieceMeshes for moving piece
    delete this.pieceMeshes[fromKey];
    this.pieceMeshes[`${move.toRow}-${move.toCol}`] = pieceMesh;
    // Update rook if castling
    if (rookMesh && castlingBackRow !== null) {
      if (move.castling === 'kingSide') {
        delete this.pieceMeshes[`${castlingBackRow}-7`];
        this.pieceMeshes[`${castlingBackRow}-5`] = rookMesh;
      } else {
        delete this.pieceMeshes[`${castlingBackRow}-0`];
        this.pieceMeshes[`${castlingBackRow}-3`] = rookMesh;
      }
    }

    const animate = () => {
      const duration = 250;
      const startTime = performance.now();

      const step = () => {
        const t = Math.min((performance.now() - startTime) / duration, 1);
        const eased = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
        pieceMesh.position.lerpVectors(startPos, endPos, eased);
        if (rookMesh) rookMesh.position.lerpVectors(rookFrom, rookTo, eased);

        if (t < 1) {
          requestAnimationFrame(step);
        } else {
          pieceMesh.position.copy(endPos);
          if (rookMesh) rookMesh.position.copy(rookTo);
          this.finishMove(result, move, capPos, capturedMesh);
        }
      };
      step();
    };
    animate();
  }

  finishMove(result, move, capPos, capturedMesh) {
    this.animating = false;

    if (capPos && capturedMesh) {
      this.explodeAt(capPos);
      this.pieceGroup.remove(capturedMesh);
      this.disposeObject(capturedMesh);
    }

    this.clearHighlights();
    this.selectedPiece = null;
    this.cursorRow = move.toRow;
    this.cursorCol = move.toCol;

    if (result.promotion) {
      if (this.callbacks.onPromotion) this.callbacks.onPromotion(move);
      return;
    }

    this.highlightMoves([]);
    this.renderCursor();

    if (this.callbacks.onMove) this.callbacks.onMove(result);
  }

  explodeAt(position) {
    const count = 28;
    const particles = [];
    const colors = [0xff6600, 0xffaa00, 0xff3300, 0xffff00, 0xff8800, 0xffcc00];

    for (let i = 0; i < count; i++) {
      const size = 0.02 + Math.random() * 0.035;
      const geo = new THREE.SphereGeometry(size, 4, 4);
      const mat = new THREE.MeshBasicMaterial({
        color: colors[Math.floor(Math.random() * colors.length)],
        transparent: true,
        opacity: 1
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.copy(position);

      const vel = new THREE.Vector3(
        (Math.random() - 0.5) * 0.35,
        Math.random() * 0.25 + 0.08,
        (Math.random() - 0.5) * 0.35
      );

      this.scene.add(mesh);
      particles.push({ mesh, vel, life: 1 });
    }

    const startTime = performance.now();
    const duration = 500;

    const step = () => {
      const dt = Math.min((performance.now() - startTime) / duration, 1);
      for (const p of particles) {
        p.mesh.position.add(p.vel.clone().multiplyScalar(0.05));
        p.vel.y -= 0.006;
        p.mesh.material.opacity = 1 - dt;
        p.mesh.scale.setScalar(1 - dt * 0.4);
      }
      if (dt < 1) {
        requestAnimationFrame(step);
      } else {
        for (const p of particles) {
          this.scene.remove(p.mesh);
          p.mesh.geometry.dispose();
          p.mesh.material.dispose();
        }
      }
    };
    step();
  }

  onKeyDown(e) {
    if (this.game.gameOver || this.animating) return;
    const key = e.key;
    if (key.startsWith('Arrow')) {
      e.preventDefault();
      const dir = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] }[key];
      this.moveCursor(dir[0], dir[1]);
    } else if (key === 'Enter' || key === ' ') {
      e.preventDefault();
      this.activateCursor();
    } else if (key === 't' || key === 'T') {
      e.preventDefault();
      this.cycleTheme();
    } else if (key === 'Escape') {
      e.preventDefault();
      this.clearHighlights();
      this.selectedPiece = null;
      this.renderCursor();
    }
  }

  moveCursor(dr, dc) {
    this.cursorRow = Math.max(0, Math.min(7, this.cursorRow + dr));
    this.cursorCol = Math.max(0, Math.min(7, this.cursorCol + dc));
    this.renderCursor();
  }

  activateCursor() {
    const row = this.cursorRow;
    const col = this.cursorCol;
    const piece = this.game.board[row][col];

    if (this.selectedPiece) {
      const move = this.validMoves.find(m => m.toRow === row && m.toCol === col);
      if (move) {
        this.executeMove(move);
        return;
      }
      if (piece && piece.color === this.game.turn) {
        this.selectPiece(row, col);
        this.renderCursor();
        return;
      }
      this.clearHighlights();
      this.selectedPiece = null;
      this.renderCursor();
      return;
    }

    if (piece && piece.color === this.game.turn) {
      this.selectPiece(row, col);
      this.renderCursor();
    }
  }

  renderCursor() {
    if (this.cursorMesh) {
      this.cursorGroup.remove(this.cursorMesh);
      this.disposeObject(this.cursorMesh);
    }
    const mat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.45,
      depthWrite: false,
      side: THREE.DoubleSide
    });
    this.cursorMesh = new THREE.Mesh(new THREE.RingGeometry(0.4, 0.48, 32), mat);
    this.cursorMesh.rotation.x = -Math.PI / 2;
    this.cursorMesh.position.set(this.cursorCol - 3.5, 0.03, this.cursorRow - 3.5);
    this.cursorGroup.add(this.cursorMesh);
  }

  applyTheme(index) {
    this.currentTheme = index;
    const theme = THEMES[index];
    this.lightMat.color.setHex(theme.light);
    this.darkMat.color.setHex(theme.dark);
    this.scene.background.setHex(theme.bg);
    if (this.groundMat) this.groundMat.color.setHex(theme.bg);
    document.body.style.background = '#' + theme.bg.toString(16).padStart(6, '0');
  }

  cycleTheme(premium) {
    const available = premium ? THEMES : THEMES.filter(t => !t.premium);
    if (available.length === 0) return;
    const currentIdx = available.indexOf(THEMES[this.currentTheme]);
    const next = available[(currentIdx + 1) % available.length];
    const globalIdx = THEMES.indexOf(next);
    if (globalIdx !== -1) this.applyTheme(globalIdx);
  }

  getThemeCount(premium) {
    return premium ? THEMES.length : THEMES.filter(t => !t.premium).length;
  }

  isPremiumTheme(index) {
    return THEMES[index]?.premium === true;
  }

  animate() {
    requestAnimationFrame(() => this.animate());
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }

  onResize() {
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }
}
