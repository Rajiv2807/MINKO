// script.js
// Single-module entry: loads shared header/footer, UI interactions, and mounts Three.js chair viewer
// Pivot changed to the center of the bottom of the legs (bounding box min Y, center X/Z)

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

// ✅ Swatch image update function
function updateProductImage(imgId, newSrc) {
  const imgElement = document.getElementById(imgId);
  if (imgElement) {
    imgElement.src = newSrc;
  }
}

/* -----------------------------
   Three.js chair viewer (with bottom-center pivot)
   ----------------------------- */

let renderer, scene, camera;
let modelRoot = null;
let wrapper = null;        // wrapper Object3D placed at bottom-center pivot
let debugFrame = null;
let pivotDot = null;

function initThree(container) {
  // Scene
  scene = new THREE.Scene();
  scene.background = null;

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
  if (!container.contains(renderer.domElement)) container.appendChild(renderer.domElement);

  // Resize helper
  function resizeRendererToContainer() {
    const w = Math.max(1, container.clientWidth);
    const h = Math.max(1, container.clientHeight);
    const pr = renderer.getPixelRatio();
    if (renderer.domElement.width !== Math.floor(w * pr) || renderer.domElement.height !== Math.floor(h * pr)) {
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }
  }
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

      modelRoot.traverse((n) => {
        if (n.isMesh) {
          n.castShadow = true;
          n.receiveShadow = true;
          if (n.material) n.material.needsUpdate = true;
        }
      });

      // bounding box
      const box = new THREE.Box3().setFromObject(modelRoot);
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());

      // bottom-center pivot
      const bottomCenter = new THREE.Vector3(center.x, box.min.y, center.z);

      // wrapper at bottom-center and reparent model into wrapper
      wrapper = new THREE.Object3D();
      wrapper.position.copy(bottomCenter);
      modelRoot.position.sub(bottomCenter);
      wrapper.add(modelRoot);
      scene.add(wrapper);

      // initial camera framing: look at bottomCenter and position by height
      const fovFactor = 1.8;
      const z = Math.max(5.5, size.y * fovFactor);
      const camY = bottomCenter.y + size.y * 0.28;
      camera.position.set(bottomCenter.x, camY, z);
      camera.lookAt(bottomCenter);

      // --- NEW: nudge camera so the model's visual center is centered in the canvas ---
      // compute the model's visual center in world space (use bounding-box center)
      const visualCenter = center.clone();

      // project visual center to NDC using current camera
      const ndc = visualCenter.clone().project(camera); // x,y in [-1,1]

      // if already centered, ndc.x/ndc.y will be near 0
      // compute distance from camera to visual center
      const camToCenterDist = camera.position.distanceTo(visualCenter);

      // compute view size at that distance
      const fovRad = THREE.Math.degToRad(camera.fov);
      const viewHeight = 2 * Math.tan(fovRad / 2) * camToCenterDist;
      const viewWidth = viewHeight * (container.clientWidth / container.clientHeight);

      // camera-space offsets required to move the projected point to center
      const camSpaceX = ndc.x * (viewWidth / 2);
      const camSpaceY = ndc.y * (viewHeight / 2);

      // compute camera right and up vectors in world space
      const camDir = new THREE.Vector3();
      camera.getWorldDirection(camDir); // points from camera toward scene
      const camUp = camera.up.clone().normalize();
      const camRight = new THREE.Vector3().crossVectors(camDir, camUp).normalize();

      // world offset to apply to camera to center the visual point
      const worldOffset = new THREE.Vector3();
      worldOffset.addScaledVector(camRight, camSpaceX);
      worldOffset.addScaledVector(camUp, camSpaceY);

      // apply offset (move camera and keep looking at visual center)
      camera.position.add(worldOffset);
      camera.lookAt(visualCenter);

      // Debug pivot dot at wrapper position
      pivotDot = new THREE.Mesh(
        new THREE.SphereGeometry(0.02),
        new THREE.MeshBasicMaterial({ color: 0xff9900 })
      );
      pivotDot.position.copy(wrapper.position);
      scene.add(pivotDot);
      window._pivotDot = pivotDot;

      // Debug frame
      const camWorld = camera.getWorldPosition(new THREE.Vector3());
      const dist = camWorld.distanceTo(visualCenter);
      const height = 2 * Math.tan(fovRad / 2) * dist;
      const width = height * (container.clientWidth / container.clientHeight);
      debugFrame = new THREE.LineSegments(
        new THREE.EdgesGeometry(new THREE.PlaneGeometry(width, height)),
        new THREE.LineBasicMaterial({ color: 0xff9900 })
      );
      debugFrame.position.copy(visualCenter);
      debugFrame.position.add(camera.getWorldDirection(new THREE.Vector3()).multiplyScalar(-0.01 * dist));
      debugFrame.quaternion.copy(camera.quaternion);
      scene.add(debugFrame);

      window._modelWrapper = wrapper;
      console.log('Chair loaded. bbox center:', center, 'size:', size, 'bottomCenter:', bottomCenter, 'ndc:', ndc);
    },
    undefined,
    (err) => {
      console.error('GLTF load error', err);
    }
  );

  // Interaction: rotate wrapper
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
      let deltaY = targetRotationY - wrapper.rotation.y;
      deltaY = ((deltaY + Math.PI) % (2 * Math.PI)) - Math.PI;
      wrapper.rotation.y += deltaY * 0.08;
      wrapper.rotation.x += (targetRotationX - wrapper.rotation.x) * 0.08;
    }

    renderer.render(scene, camera);
  }
  animate();

  // Resize updates
  window.addEventListener('resize', () => {
    resizeRendererToContainer();
    if (debugFrame && wrapper) {
      const center = new THREE.Box3().setFromObject(wrapper).getCenter(new THREE.Vector3());
      const camWorld = camera.getWorldPosition(new THREE.Vector3());
      const dist = camWorld.distanceTo(center);
      const fov = THREE.Math.degToRad(camera.fov);
      const height = 2 * Math.tan(fov / 2) * dist;
      const width = height * (container.clientWidth / container.clientHeight);
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
      // Optional staggered delay per slot
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
            title.classList.remove("active"); // reset so it replays
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
