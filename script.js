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

// Product swatch image update
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

  // Corner gallery zoom logic
  const slots = document.querySelectorAll(".corner-slot img");
  const images = [
    "assets/interior/1.jpg","assets/interior/2.jpg","assets/interior/3.jpg","assets/interior/4.jpg",
    "assets/interior/5.jpg","assets/interior/6.jpg","assets/interior/7.jpg","assets/interior/8.jpg"
  ];

  const minScale = 0.5;   // minimum zoom scale
  const maxScale = 1.0;   // maximum zoom scale (same as showcase slot size)
  let lastScroll = window.scrollY;
  let galleryActive = false;

  // initialize dataset scale with staggered start sizes
  slots.forEach((img, i) => {
    let startScale = minScale + i * 0.1; // staggered start scales
    img.style.transform = `scale(${startScale}) translate(0,0)`;
    img.dataset.scale = startScale;
    img.style.opacity = 1;
  });

  // Observer to activate gallery only when in view
  const gallerySection = document.querySelector(".corner-gallery");
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      galleryActive = entry.isIntersecting;
    });
  }, { threshold: 0.2 });

  if (gallerySection) observer.observe(gallerySection);

  window.addEventListener("scroll", () => {
    if (!galleryActive) return; // only animate when gallery is visible

    const currentScroll = window.scrollY;
    const direction = currentScroll > lastScroll ? "down" : "up";
    lastScroll = currentScroll;

    slots.forEach((img, i) => {
      let currentScale = parseFloat(img.dataset.scale);
      const speed = 0.005 + i * 0.002; // very slow zoom speeds

      if (direction === "down") {
        currentScale += speed;
        if (currentScale >= maxScale) {
          img.style.opacity = 0;
          setTimeout(() => {
            const nextIndex = Math.floor(Math.random() * images.length);
            img.src = images[nextIndex];
            currentScale = minScale + i * 0.1;
            img.style.transform = `scale(${currentScale}) translate(0,0)`;
            img.dataset.scale = currentScale;
            img.style.opacity = 1;
          }, 400);
        }
      } else {
        currentScale -= speed;
        if (currentScale <= minScale) {
          img.style.opacity = 0;
          setTimeout(() => {
            const nextIndex = Math.floor(Math.random() * images.length);
            img.src = images[nextIndex];
            currentScale = maxScale;
            img.style.transform = `scale(${currentScale}) translate(0,0)`;
            img.dataset.scale = currentScale;
            img.style.opacity = 1;
          }, 400);
        }
      }

      // Parallax drift outward from corners
      const drift = (currentScale - minScale) * 20; // drift factor
      let tx = 0, ty = 0;
      if (img.closest(".top-left")) { tx = -drift; ty = -drift; }
      if (img.closest(".top-right")) { tx = drift; ty = -drift; }
      if (img.closest(".bottom-left")) { tx = -drift; ty = drift; }
      if (img.closest(".bottom-right")) { tx = drift; ty = drift; }

      img.style.transform = `scale(${currentScale}) translate(${tx}px, ${ty}px)`;
      img.dataset.scale = currentScale;
    });

    // Animate text color per letter
    const galleryTitleSpans = document.querySelectorAll(".gallery-title span");
    const scrollRatio = Math.min(1, Math.max(0, window.scrollY / window.innerHeight));

    galleryTitleSpans.forEach((span, i) => {
      const delay = i * 0.05;
      const progress = Math.min(1, Math.max(0, scrollRatio - delay));
      const grayValue = Math.floor(255 - progress * 255); // white (255) → black (0)
      span.style.color = `rgb(${grayValue}, ${grayValue}, ${grayValue})`;
    });
  });

  // Hover zoom effect
  if (gallerySection) {
    gallerySection.addEventListener("mouseenter", () => {
      slots.forEach((img, i) => {
        img.style.transition = "transform 2s ease, opacity 0.5s ease";
        img.style.transform = `scale(${maxScale})`;
      });
    });
    gallerySection.addEventListener("mouseleave", () => {
      slots.forEach((img, i) => {
        let currentScale = parseFloat(img.dataset.scale);
        img.style.transition = "transform 2s ease, opacity 0.5s ease";
        img.style.transform = `scale(${currentScale})`;
      });
    });
  }
});
