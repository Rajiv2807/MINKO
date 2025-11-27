// script.js
// Single-module entry: loads shared header/footer, UI interactions, and mounts Three.js chair viewer.
// Camera centering includes adjustable manual offsets so you can try different values quickly.

import * as THREE from 'https://unpkg.com/three@0.126.1/build/three.module.js';
import { GLTFLoader } from 'https://unpkg.com/three@0.126.1/examples/jsm/loaders/GLTFLoader.js';

/* -----------------------------
   Shared includes + utilities
   ----------------------------- */

// Utility to load shared header/footer
function loadSharedPart(id, file) {
  fetch(file)
    .then(res => {
      if (!res.ok) throw new Error(`Failed to fetch ${file}: ${res.status}`);
      return res.text();
    })
    .then(html => {
      const el = document.getElementById(id);
      if (el) el.innerHTML = html;
    })
    .catch(err => console.error(`Error loading ${file}:`, err));
}

// Swatch image update function
function updateProductImage(imgId, newSrc) {
  const imgElement = document.getElementById(imgId);
  if (imgElement) {
    imgElement.src = newSrc;
  }
}

/* -----------------------------
   Three.js viewer variables
   ----------------------------- */

let renderer, scene, camera;
let modelRoot = null;
let wrapper = null;        // wrapper Object3D placed at bottom-center pivot
let debugFrame = null;
let pivotDot = null;
let visualCenter = null;   // bounding-box center (world space) used for centering
let containerEl = null;

// Default manual camera shift fractions (tweak these)
let cameraAdjust = {
  shiftFractionX: 0.06, // positive moves camera right -> model appears left
  shiftFractionY: 0.04  // positive moves camera down -> model appears up when applied as negative
};

// Expose for runtime tweaking in console
window._cameraAdjust = cameraAdjust;

/* -----------------------------
   Helper: resize renderer
   ----------------------------- */
function resizeRendererToContainer() {
  if (!containerEl || !renderer || !camera) return;
  const w = Math.max(1, containerEl.clientWidth);
  const h = Math.max(1, containerEl.clientHeight);
  const pr = renderer.getPixelRatio();
  if (renderer.domElement.width !== Math.floor(w * pr) || renderer.domElement.height !== Math.floor(h * pr)) {
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
}

/* -----------------------------
   Camera centering function
   - centers visualCenter in the canvas
   - applies manual fractional shifts (cameraAdjust)
   - callable at runtime: window.centerCamera(x,y)
   ----------------------------- */
function centerCameraWithAdjust(shiftFractionX = cameraAdjust.shiftFractionX, shiftFractionY = cameraAdjust.shiftFractionY) {
  if (!camera || !visualCenter || !containerEl) return;

  // Project visual center to NDC using current camera
  const ndc = visualCenter.clone().project(camera); // x,y in [-1,1]

  // Distance from camera to visual center
  const camToCenterDist = camera.position.distanceTo(visualCenter);

  // View size at that distance
  const fovRad = THREE.Math.degToRad(camera.fov);
  const viewHeight = 2 * Math.tan(fovRad / 2) * camToCenterDist;
  const viewWidth = viewHeight * (containerEl.clientWidth / containerEl.clientHeight);

  // Camera-space offsets required to move the projected point to center
  const camSpaceX = ndc.x * (viewWidth / 2);
  const camSpaceY = ndc.y * (viewHeight / 2);

  // Camera basis vectors
  const camDir = new THREE.Vector3();
  camera.getWorldDirection(camDir); // points from camera toward scene
  const camUp = camera.up.clone().normalize();
  const camRight = new THREE.Vector3().crossVectors(camDir, camUp).normalize();

  // Computed world offset to center the visual point
  const worldOffset = new THREE.Vector3();
  worldOffset.addScaledVector(camRight, camSpaceX);
  worldOffset.addScaledVector(camUp, camSpaceY);

  // Apply computed offset
  camera.position.add(worldOffset);

  // Manual adjustments (fractions of view size)
  const manualRightOffset = viewWidth * shiftFractionX;
  const manualUpOffset = viewHeight * shiftFractionY;

  // Apply manual offsets:
  // - moving camera along camRight moves model opposite on screen (so positive shiftFractionX moves model left)
  // - moving camera along camUp moves model opposite on screen (so negative shiftFractionY moves model up)
  camera.position.addScaledVector(camRight, manualRightOffset);
  camera.position.addScaledVector(camUp, -manualUpOffset);

  // Re-orient camera to look at visual center
  camera.lookAt(visualCenter);

  // Update debug helpers if present
  if (debugFrame) {
    const camWorld = camera.getWorldPosition(new THREE.Vector3());
    const dist = camWorld.distanceTo(visualCenter);
    const height = 2 * Math.tan(fovRad / 2) * dist;
    const width = height * (containerEl.clientWidth / containerEl.clientHeight);
    debugFrame.geometry.dispose();
    debugFrame.geometry = new THREE.EdgesGeometry(new THREE.PlaneGeometry(width, height));
    debugFrame.position.copy(visualCenter);
    debugFrame.position.add(camera.getWorldDirection(new THREE.Vector3()).multiplyScalar(-0.01 * dist));
    debugFrame.quaternion.copy(camera.quaternion);
  }

  // Update global adjust object and expose
  cameraAdjust.shiftFractionX = shiftFractionX;
  cameraAdjust.shiftFractionY = shiftFractionY;
  window._cameraAdjust = cameraAdjust;

  console.log('centerCameraWithAdjust applied', { shiftFractionX, shiftFractionY, ndc });
}

/* -----------------------------
   Initialize Three.js viewer
   ----------------------------- */
function initThree(container) {
  containerEl = container;

  // Scene
  scene = new THREE.Scene();
  scene.background = null; // transparent so CSS background shows through

  // Camera
  camera = new THREE.PerspectiveCamera(
    45,
    Math.max(1, container.clientWidth) / Math.max(1, container.clientHeight),
    0.1,
    1000
  );
  camera.position.set(0, 2.6, 6);

  // Renderer
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.domElement.style.display = 'block';

  if (!container.contains(renderer.domElement)) {
    container.appendChild(renderer.domElement);
  }

  // Initial resize
  resizeRendererToContainer();

  // Lights
  const hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 0.9);
  scene.add(hemi);

  const dir = new THREE.DirectionalLight(0xffffff, 1.0);
  dir.position.set(3, 5, 5);
  dir.castShadow = true;
  dir.shadow.mapSize.set(1024, 1024);
  dir.shadow.camera.near = 0.5;
  dir.shadow.camera.far = 30;
  scene.add(dir);

  // Ground shadow catcher
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(20, 20),
    new THREE.ShadowMaterial({ opacity: 0.28 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.5;
  ground.receiveShadow = true;
  scene.add(ground);

  // GLTF loader
  const loader = new GLTFLoader();
  loader.load(
    'models/chair.glb',
    (gltf) => {
      modelRoot = gltf.scene;

      // enable shadows on meshes
      modelRoot.traverse((n) => {
        if (n.isMesh) {
          n.castShadow = true;
          n.receiveShadow = true;
          if (n.material) n.material.needsUpdate = true;
        }
      });

      // compute bounding box and center
      const box = new THREE.Box3().setFromObject(modelRoot);
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());
      visualCenter = center.clone();

      // Compute bottom-center pivot: center.x, box.min.y, center.z
      const bottomCenter = new THREE.Vector3(center.x, box.min.y, center.z);

      // Create wrapper at bottom-center pivot and reparent model into wrapper
      wrapper = new THREE.Object3D();
      wrapper.position.copy(bottomCenter);

      // Move model so its world position becomes relative to wrapper origin
      modelRoot.position.sub(bottomCenter);

      // Add model into wrapper and add wrapper to scene
      wrapper.add(modelRoot);
      scene.add(wrapper);

      // Initial camera framing: look at bottomCenter and position by height
      const fovFactor = 1.8;
      const z = Math.max(5.5, size.y * fovFactor);
      const camY = bottomCenter.y + size.y * 0.28;
      camera.position.set(bottomCenter.x, camY, z);
      camera.lookAt(bottomCenter);

      // Now center visualCenter in the canvas and apply manual adjustments
      centerCameraWithAdjust(cameraAdjust.shiftFractionX, cameraAdjust.shiftFractionY);

      // Debug pivot dot at wrapper position (bottom-center)
      pivotDot = new THREE.Mesh(
        new THREE.SphereGeometry(0.02),
        new THREE.MeshBasicMaterial({ color: 0xff9900 })
      );
      pivotDot.position.copy(wrapper.position);
      scene.add(pivotDot);
      window._pivotDot = pivotDot;

      // Debug frame showing camera frustum projection at visual center
      const camWorld = camera.getWorldPosition(new THREE.Vector3());
      const dist = camWorld.distanceTo(visualCenter);
      const fovRad = THREE.Math.degToRad(camera.fov);
      const height = 2 * Math.tan(fovRad / 2) * dist;
      const width = height * (containerEl.clientWidth / containerEl.clientHeight);
      debugFrame = new THREE.LineSegments(
        new THREE.EdgesGeometry(new THREE.PlaneGeometry(width, height)),
        new THREE.LineBasicMaterial({ color: 0xff9900 })
      );
      debugFrame.position.copy(visualCenter);
      debugFrame.position.add(camera.getWorldDirection(new THREE.Vector3()).multiplyScalar(-0.01 * dist));
      debugFrame.quaternion.copy(camera.quaternion);
      scene.add(debugFrame);

      // Expose wrapper and visualCenter for debugging
      window._modelWrapper = wrapper;
      window._visualCenter = visualCenter.clone();

      console.log('Chair loaded. bbox center:', center, 'size:', size, 'bottomCenter:', bottomCenter);
    },
    undefined,
    (err) => {
      console.error('GLTF load error', err);
    }
  );

  // Interaction: rotate the wrapper (so rotation happens around bottom-center pivot)
  let targetRotationX = 0;
  let targetRotationY = Math.PI;

  container.addEventListener('mousemove', (e) => {
    if (!wrapper) return;
    const rect = container.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width;
    const py = (e.clientY - rect.top) / rect.height;
    targetRotationY = (px - 0.5) * Math.PI * 2;
    targetRotationX = (py - 0.5) * (Math.PI / 2);
  });

  container.addEventListener('mouseleave', () => {
    targetRotationX = 0;
    targetRotationY = Math.PI;
  });

  // Animation loop
  function animate() {
    requestAnimationFrame(animate);
    resizeRendererToContainer();

    if (wrapper) {
      // smooth shortest-path rotation on Y
      let deltaY = targetRotationY - wrapper.rotation.y;
      deltaY = ((deltaY + Math.PI) % (2 * Math.PI)) - Math.PI;
      wrapper.rotation.y += deltaY * 0.08;
      wrapper.rotation.x += (targetRotationX - wrapper.rotation.x) * 0.08;
    }

    renderer.render(scene, camera);
  }
  animate();

  // Keep debug helpers updated on resize
  window.addEventListener('resize', () => {
    resizeRendererToContainer();
    if (debugFrame && wrapper && visualCenter) {
      const center = new THREE.Box3().setFromObject(wrapper).getCenter(new THREE.Vector3());
      const camWorld = camera.getWorldPosition(new THREE.Vector3());
      const dist = camWorld.distanceTo(center);
      const fov = THREE.Math.degToRad(camera.fov);
      const height = 2 * Math.tan(fov / 2) * dist;
      const width = height * (containerEl.clientWidth / containerEl.clientHeight);
      debugFrame.geometry.dispose();
      debugFrame.geometry = new THREE.EdgesGeometry(new THREE.PlaneGeometry(width, height));
      debugFrame.position.copy(center);
      debugFrame.quaternion.copy(camera.quaternion);
    }
    if (pivotDot && wrapper) {
      pivotDot.position.copy(wrapper.position);
    }
  });
}

/* -----------------------------
   DOM ready: wire UI + start viewer
   ----------------------------- */

document.addEventListener("DOMContentLoaded", () => {
  // Load shared parts (header/footer)
  loadSharedPart("site-header", "header.html");
  loadSharedPart("site-footer", "footer.html");

  // --- Swatch interactions ---
  const swatches = document.querySelectorAll(".color-swatch[data-target][data-src]");
  swatches.forEach(swatch => {
    swatch.addEventListener("click", () => {
      const targetId = swatch.getAttribute("data-target");
      const newSrc = swatch.getAttribute("data-src");
      updateProductImage(targetId, newSrc);

      // Visual feedback
      const siblings = swatch.parentElement?.querySelectorAll(".color-swatch");
      siblings?.forEach(s => s.classList.remove("active"));
      swatch.classList.add("active");
    });
  });

  // --- Eight-slot gallery animation using IntersectionObserver ---
  const slots = document.querySelectorAll(".gallery-slot img");
  if (slots.length) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add("scaled");
        } else {
          entry.target.classList.remove("scaled"); // optional: replay when scrolled out
        }
      });
    }, { threshold: 0.3 });

    slots.forEach((img, i) => {
      const rowIndex = Math.floor(i / 4);
      const colIndex = i % 4;
      const delay = rowIndex * 0.2 + colIndex * 0.1;
      img.style.setProperty("--delay", `${delay}s`);
      observer.observe(img);
    });
  }

  // --- Title slide-in animation (scroll-triggered) ---
  const title = document.querySelector(".gallery-title");
  if (title) {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            title.classList.add("active");
          } else {
            title.classList.remove("active");
          }
        });
      },
      { threshold: 0.3 }
    );
    observer.observe(title);
  }

  // Initialize Three.js viewer into the chair canvas
  const container = document.getElementById('chair-canvas');
  if (container) {
    try {
      initThree(container);
    } catch (err) {
      console.error('Failed to initialize 3D viewer:', err);
    }
  } else {
    console.warn('#chair-canvas not found — 3D viewer not initialized.');
  }
});

/* -----------------------------
   Runtime helpers for quick testing
   - call window.centerCamera(x,y) to try new values
   - x,y are fractions (e.g., 0.06, 0.04)
   ----------------------------- */
window.centerCamera = function(shiftX = cameraAdjust.shiftFractionX, shiftY = cameraAdjust.shiftFractionY) {
  if (!visualCenter || !camera) {
    console.warn('visualCenter or camera not ready yet.');
    return;
  }
  centerCameraWithAdjust(shiftX, shiftY);
  console.log('centerCamera called with', { shiftX, shiftY });
};
