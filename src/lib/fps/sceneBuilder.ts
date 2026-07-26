import * as THREE from 'three';
import { LAB_CAMERA_FOV } from '../constants/appConstants';
import { clampFov, horizontalFovToVerticalFov } from '../utils/fov';

export interface LabSceneContext {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  targetMesh: THREE.Mesh<THREE.SphereGeometry, THREE.MeshStandardMaterial>;
  turnMarker: THREE.Mesh<THREE.TorusGeometry, THREE.MeshStandardMaterial>;
  setHorizontalFov: (fieldOfView: number) => void;
  getProjectionSnapshot: () => {
    horizontalFieldOfView: number;
    verticalFieldOfView: number;
    aspectRatio: number;
  };
  resize: () => void;
  dispose: () => void;
}

export function createLabScene(canvas: HTMLCanvasElement, fieldOfView: number = LAB_CAMERA_FOV): LabSceneContext {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: false,
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#10141d');

  let horizontalFov = clampFov(fieldOfView);
  const camera = new THREE.PerspectiveCamera(
    horizontalFovToVerticalFov(horizontalFov, 1),
    1,
    0.1,
    200,
  );
  camera.position.set(0, 1.6, 0);

  const ambientLight = new THREE.AmbientLight('#ffffff', 1.2);
  scene.add(ambientLight);

  const directionalLight = new THREE.DirectionalLight('#dbeafe', 1.5);
  directionalLight.position.set(4, 8, 4);
  scene.add(directionalLight);

  const grid = new THREE.GridHelper(30, 30, '#334155', '#1f2937');
  scene.add(grid);

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(40, 40),
    new THREE.MeshStandardMaterial({
      color: '#111827',
      roughness: 1,
      metalness: 0,
    }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.01;
  scene.add(floor);

  const wall = new THREE.Mesh(
    new THREE.BoxGeometry(16, 6, 0.3),
    new THREE.MeshStandardMaterial({
      color: '#1f2937',
      roughness: 1,
    }),
  );
  wall.position.set(0, 2.4, -13);
  scene.add(wall);

  const targetMesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.45, 24, 24),
    new THREE.MeshStandardMaterial({
      color: '#fb7185',
      emissive: '#7f1d1d',
      emissiveIntensity: 0.7,
    }),
  );
  targetMesh.visible = false;
  scene.add(targetMesh);

  const turnMarker = new THREE.Mesh(
    new THREE.TorusGeometry(1, 0.08, 16, 48),
    new THREE.MeshStandardMaterial({
      color: '#22d3ee',
      emissive: '#164e63',
      emissiveIntensity: 0.8,
    }),
  );
  turnMarker.visible = false;
  scene.add(turnMarker);

  function resize(): void {
    const width = canvas.clientWidth || canvas.parentElement?.clientWidth || 960;
    const height = canvas.clientHeight || 480;

    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.fov = horizontalFovToVerticalFov(horizontalFov, camera.aspect);
    camera.updateProjectionMatrix();
  }

  function setHorizontalFov(fieldOfView: number): void {
    horizontalFov = clampFov(fieldOfView);
    resize();
  }

  function getProjectionSnapshot(): {
    horizontalFieldOfView: number;
    verticalFieldOfView: number;
    aspectRatio: number;
  } {
    return {
      horizontalFieldOfView: horizontalFov,
      verticalFieldOfView: camera.fov,
      aspectRatio: camera.aspect,
    };
  }

  function dispose(): void {
    renderer.dispose();
    targetMesh.geometry.dispose();
    targetMesh.material.dispose();
    turnMarker.geometry.dispose();
    turnMarker.material.dispose();
  }

  resize();

  return {
    renderer,
    scene,
    camera,
    targetMesh,
    turnMarker,
    setHorizontalFov,
    getProjectionSnapshot,
    resize,
    dispose,
  };
}
