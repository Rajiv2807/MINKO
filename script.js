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
    img.style.transform = `scale(${startScale})`;
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
      const speed = 0.02 + i * 0.005; // staggered zoom speeds

      if (direction === "down") {
        currentScale += speed;
        if (currentScale >= maxScale) {
          // fade out, swap image, fade in
          img.style.opacity = 0;
          setTimeout(() => {
            const nextIndex = Math.floor(Math.random() * images.length);
            img.src = images[nextIndex];
            currentScale = minScale + i * 0.1; // reset to start scale
            img.style.transform = `scale(${currentScale})`;
            img.dataset.scale = currentScale;
            img.style.opacity = 1;
          }, 300);
        }
      } else {
        currentScale -= speed;
        if (currentScale <= minScale) {
          // fade out, swap image, fade in
          img.style.opacity = 0;
          setTimeout(() => {
            const nextIndex = Math.floor(Math.random() * images.length);
            img.src = images[nextIndex];
            currentScale = maxScale; // reset to max scale for zooming out
            img.style.transform = `scale(${currentScale})`;
            img.dataset.scale = currentScale;
            img.style.opacity = 1;
          }, 300);
        }
      }

      img.style.transform = `scale(${currentScale})`;
      img.dataset.scale = currentScale;
    });
  });
});
