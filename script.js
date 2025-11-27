// script.js
// Single-module entry: loads shared header/footer, UI interactions, and mounts Three.js chair viewer.
// Restored lighting so the model keeps its original look. No pivot marker.

import * as THREE from 'https://unpkg.com/three@0.126.1/build/three.module.js';
import { GLTFLoader } from 'https://unpkg.com/three@0.126.1/examples/jsm/loaders/GLTFLoader.js';

/* -----------------------------
   Shared includes + utilities
   ----------------------------- */

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

function updateProductImage(imgId, newSrc) {
  const imgElement = document.getElementById(imgId);
  if (imgElement) imgElement.src = newSrc;
}

/* -----------------------------
   Viewer state
   ----------------------------- */

let renderer, scene, camera;
let modelRoot = null;
let wrapper = null;        // wrapper Object3D placed at bottom-center pivot
let visualCenter = null;   // bounding-box center (world space) used for centering
let containerEl = null;

// Keep the nudge values you set
let wrapperAdjust = {
  shiftFractionX: 0.10,
  shiftFractionY: 0.06
};
window._wrapperAdjust = wrapperAdjust;

/* -----------------------------
   Helpers
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
   Simple wrapper nudge (moves model visually)
   ----------------------------- */
function nudgeWrapper(shiftFractionX = wrapperAdjust.shiftFractionX, shiftFractionY = wrapperAdjust.shiftFractionY) {
  if (!wrapper || !camera || !visualCenter || !containerEl) {
    console.warn('nudgeWrapper: required objects not ready.');
    return;
  }
  const camToCenterDist = camera.position.distanceTo(visualCenter);
  const fovRad = THREE.Math.degToRad(camera.fov);
  const viewHeight = 2 * Math.tan(fovRad / 2) * camToCenterDist;
  const viewWidth = viewHeight * (containerEl.clientWidth / containerEl.clientHeight);
  const camDir = new THREE.Vector3(); camera.getWorldDirection(camDir);
  const camUp = camera.up.clone().normalize();
  const camRight = new THREE.Vector3().crossVectors(camDir, camUp).normalize();
  const manualRightOffset = viewWidth * shiftFractionX;
  const manualUpOffset = viewHeight * shiftFractionY;
  // Apply: positive shiftFractionX moves model left (move wrapper along -camRight)
  wrapper.position.addScaledVector(camRight, -manualRightOffset);
  // positive shiftFractionY moves model up (move wrapper along +camUp)
  wrapper.position.addScaledVector(camUp, manualUpOffset);
  wrapperAdjust.shiftFractionX = shiftFractionX;
  wrapperAdjust.shiftFractionY = shiftFractionY;
  window._wrapperAdjust = wrapperAdjust;
  console.log('nudgeWrapper applied', { shiftFractionX, shiftFractionY, wrapperPos: wrapper.position.toArray() });
}

/* -----------------------------
   Camera centering helper (centers visualCenter in canvas)
   ----------------------------- */
function centerCameraOnVisual() {
  if (!camera || !visualCenter || !containerEl) return;
  const box = new THREE.Box3().setFromObject(wrapper || modelRoot);
  const size = box.getSize(new THREE.Vector3());
  const fovFactor = 1.8;
  const dist = Math.max(5.5, size.y * fovFactor);
  const camY = visualCenter.y + size.y * 0.28;
  camera.position.set(visualCenter.x, camY, visualCenter.z + dist);
  camera.lookAt(visualCenter);
  // apply current wrapper nudge so final framing matches expectation
  nudgeWrapper(wrapperAdjust.shiftFractionX, wrapperAdjust.shiftFractionY);
}

/* -----------------------------
   Initialize Three.js viewer (lighting restored)
   ----------------------------- */
function initThree(container) {
  containerEl = container;

  scene = new THREE.Scene();
  scene.background = null; // transparent so CSS background shows through

  camera = new THREE.PerspectiveCamera(
    45,
    Math.max(1, container.clientWidth) / Math.max(1, container.clientHeight),
    0.1,
    1000
  );
  camera.position.set(0, 2.6, 6);

  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  // enable shadows only if your model/materials expect them; keep off for now to avoid heavy darkening
  renderer.shadowMap.enabled = false;
  renderer.domElement.style.display = 'block';
  if (!container.contains(renderer.domElement)) container.appendChild(renderer.domElement);

  resizeRendererToContainer();

  // Restored lighting similar to original setup
  const hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 0.9);
  scene.add(hemi);

  const dir = new THREE.DirectionalLight(0xffffff, 1.0);
  dir.position.set(3, 5, 5);
  scene.add(dir);

  const ambient = new THREE.AmbientLight(0xffffff, 0.18);
  scene.add(ambient);

  // Simple neutral ground for visual grounding
  const groundMat = new THREE.MeshBasicMaterial({ color: 0xf2f2f2 });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.5;
  scene.add(ground);

  // GLTF loader
  const loader = new GLTFLoader();
  loader.load(
    'models/chair.glb',
    (gltf) => {
      modelRoot = gltf.scene;

      // Keep materials as-is; ensure they update
      modelRoot.traverse((n) => {
        if (n.isMesh && n.material) {
          n.material.needsUpdate = true;
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

      // Initial camera framing and centering
      centerCameraOnVisual();

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

  // Keep responsive on resize
  window.addEventListener('resize', () => {
    resizeRendererToContainer();
  });
}

/* -----------------------------
   DOM ready: wire UI + start viewer
   ----------------------------- */

document.addEventListener("DOMContentLoaded", () => {
  loadSharedPart("site-header", "header.html");
  loadSharedPart("site-footer", "footer.html");

  // swatches
  const swatches = document.querySelectorAll(".color-swatch[data-target][data-src]");
  swatches.forEach(swatch => {
    swatch.addEventListener("click", () => {
      const targetId = swatch.getAttribute("data-target");
      const newSrc = swatch.getAttribute("data-src");
      updateProductImage(targetId, newSrc);
      const siblings = swatch.parentElement?.querySelectorAll(".color-swatch");
      siblings?.forEach(s => s.classList.remove("active"));
      swatch.classList.add("active");
    });
  });

  // gallery observer
  const slots = document.querySelectorAll(".gallery-slot img");
  if (slots.length) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) entry.target.classList.add("scaled");
        else entry.target.classList.remove("scaled");
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

  const title = document.querySelector(".gallery-title");
  if (title) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) title.classList.add("active");
        else title.classList.remove("active");
      });
    }, { threshold: 0.3 });
    observer.observe(title);
  }

  const container = document.getElementById('chair-canvas');
  if (container) {
    try { initThree(container); }
    catch (err) { console.error('Failed to initialize 3D viewer:', err); }
  } else {
    console.warn('#chair-canvas not found — 3D viewer not initialized.');
  }
});

/* -----------------------------
   Runtime helpers
   - window.nudgeWrapper(x,y) to try new values (fractions)
   - window.centerCamera() to reframe and apply current nudge
   ----------------------------- */

window.nudgeWrapper = function(shiftX = wrapperAdjust.shiftFractionX, shiftY = wrapperAdjust.shiftFractionY) {
  nudgeWrapper(shiftX, shiftY);
};

window.centerCamera = function() {
  centerCameraOnVisual();
};
