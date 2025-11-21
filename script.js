// Utility to load shared header/footer
function loadSharedPart(id, file) {
  fetch(file)
    .then(res => res.text())
    .then(html => {
      const el = document.getElementById(id);
      if (el) el.innerHTML = html;
    })
    .catch(err => console.error(`Error loading ${file}:`, err));
}

// ✅ Original swatch image update function
function updateProductImage(imgId, newSrc) {
  const imgElement = document.getElementById(imgId);
  if (imgElement) {
    imgElement.src = newSrc;
  }
}

document.addEventListener("DOMContentLoaded", () => {
  // Load shared parts
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

  // --- Eight-slot scroll-driven gallery ---
  const gallerySection = document.querySelector(".eight-gallery");
  const slots = document.querySelectorAll(".gallery-slot img");

  if (gallerySection && slots.length) {
    // Use the same smooth cubic-bezier with bounceback for all slots
    const easing = "cubic-bezier(0.68, -0.55, 0.27, 1.55)"; // smooth ease with overshoot

    slots.forEach(img => {
      img.style.transition = `transform 2.8s ${easing}`;
    });

    let ticking = false;

    function computeProgress() {
      const rect = gallerySection.getBoundingClientRect();
      const windowHeight = window.innerHeight;

      const centerOffset = Math.abs(rect.top + rect.height / 2 - windowHeight / 2);
      const maxOffset = windowHeight / 2 + rect.height / 2;
      return 1 - Math.min(centerOffset / maxOffset, 1);
    }

    function animateGallery() {
      const progress = computeProgress();

      slots.forEach((img, i) => {
        const columns = 4;
        const rowIndex = Math.floor(i / columns);
        const colIndex = i % columns;

        const rowDelay = rowIndex * 0.2;
        const colDelay = colIndex * 0.1;
        const totalDelay = rowDelay + colDelay;

        let slotProgress = progress - totalDelay;
        if (slotProgress < 0) slotProgress = 0;
        if (slotProgress > 1) slotProgress = 1; // 🔑 force max size

        img.style.transform = `scale(${slotProgress})`;
      });
      ticking = false;
    }

    window.addEventListener("scroll", () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(animateGallery);
      }
    }, { passive: true });

    animateGallery(); // initial run
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
});
