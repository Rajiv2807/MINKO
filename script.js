// script.js
// Single-module entry: loads shared header/footer, UI interactions, and mounts Three.js chair viewer.
// This version applies a configurable wrapper nudge (moves the model) so you can shift the chair left/up easily.

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

// Default wrapper nudge fractions (fractions of view width/height)
let wrapperAdjust = {
  shiftFractionX: 0.06, // positive moves model left (we apply sign internally)
  shiftFractionY: 0.04  // positive moves model up
};

// Expose for runtime tweaking
window._wrapperAdjust = wrapperAdjust;

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
   Wrapper nudge function
   - Moves wrapper in world space so the model appears shifted on screen
   - shiftFractionX: fraction of view width (0.0 - 0.2 typical)
   - shiftFractionY: fraction of view height (0.0 - 0.2 typical)
   ----------------------------- */
function nudgeWrapper(shiftFractionX = wrapperAdjust.shiftFractionX, shiftFractionY = wrapperAdjust.shiftFractionY) {
  if (!wrapper || !camera || !visualCenter || !containerEl) {
    console.warn('nudgeWrapper: required objects not ready yet.');
    return;
  }

  // Distance from camera to visual center
  const camToCenterDist = camera.position.distanceTo(visualCenter);

  // View size at that distance
  const fovRad = THREE.Math.degToRad(camera.fov);
  const viewHeight = 2 * Math.tan(fovRad / 2) * camToCenterDist;
  const viewWidth = viewHeight * (containerEl.clientWidth / containerEl.clientHeight);

  // Camera basis vectors
  const camDir = new THREE.Vector3();
  camera.getWorldDirection(camDir); // points from camera toward scene
  const camUp = camera.up.clone().normalize();
  const camRight = new THREE.Vector3().crossVectors(camDir, camUp).normalize();

  // Manual offsets in world units
  const manualRightOffset = viewWidth * shiftFractionX;
  const manualUpOffset = viewHeight * shiftFractionY;

  // Apply offsets to wrapper:
  // - To move the model left on screen, move wrapper along -camRight
  // - To move the model up on screen, move wrapper along +camUp
  wrapper.position.addScaledVector(camRight, -manualRightOffset);
  wrapper.position.addScaledVector(camUp, manualUpOffset);

  // Update debug helpers if present
  if (debugFrame && visualCenter) {
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

  // Save chosen values
  wrapperAdjust.shiftFractionX = shiftFractionX;
  wrapperAdjust.shiftFractionY = shiftFractionY;
  window._wrapperAdjust = wrapperAdjust;

  console.log('nudgeWrapper applied', { shiftFractionX, shiftFractionY, manualRightOffset, manualUpOffset, wrapperPos: wrapper.position.toArray() });
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

      // Apply wrapper nudge (moves model visually). This is more obvious than tiny camera nudges.
      nudgeWrapper(wrapperAdjust.shiftFractionX, wrapperAdjust.shiftFractionY);

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
   - call window.nudgeWrapper(x,y) to try new values
   - x,y are fractions (e.g., 0.06, 0.04)
   - call window.resetWrapper() to reset wrapper to original bottom-center (if needed)
   ----------------------------- */

window.nudgeWrapper = function(shiftX = wrapperAdjust.shiftFractionX, shiftY = wrapperAdjust.shiftFractionY) {
  nudgeWrapper(shiftX, shiftY);
};

window.resetWrapper = function() {
  if (!window._modelWrapper || !window._visualCenter) {
    console.warn('resetWrapper: wrapper or visualCenter not ready.');
    return;
  }
  // Reset wrapper to the original bottom-center recorded at load time if available
  // We stored wrapper.position at load; to fully reset you may need to reload the page.
  console.log('Current wrapper position:', window._modelWrapper.position.toArray());
  console.log('To fully reset to original bottom-center, reload the page.');
};
