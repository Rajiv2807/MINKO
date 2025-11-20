// Load shared header and footer
function loadSharedPart(id, file) {
  fetch(file)
    .then(res => res.text())
    .then(html => {
      document.getElementById(id).innerHTML = html;
    })
    .catch(err => console.error(`Error loading ${file}:`, err));
}

document.addEventListener("DOMContentLoaded", () => {
  loadSharedPart("site-header", "header.html");
  loadSharedPart("site-footer", "footer.html");
});

// Existing function for swatches
function updateProductImage(imgId, newSrc) {
  const imgElement = document.getElementById(imgId);
  if (imgElement) {
    imgElement.src = newSrc;
  }
}
document.addEventListener("DOMContentLoaded", () => {
  // Existing header/footer load
  loadSharedPart("site-header", "header.html");
  loadSharedPart("site-footer", "footer.html");

  // Zoom gallery logic
  const zoomImages = document.querySelectorAll(".zoom-img");
  let triggered = false;

  window.addEventListener("scroll", () => {
    const gallery = document.querySelector(".zoom-gallery");
    const rect = gallery.getBoundingClientRect();

    if (!triggered && rect.top < window.innerHeight * 0.8) {
      triggered = true;

      // Pick 3–4 random images to zoom
      const shuffled = Array.from(zoomImages).sort(() => 0.5 - Math.random());
      const selected = shuffled.slice(0, 4);

      selected.forEach((img, i) => {
        setTimeout(() => {
          img.classList.add("active");
          // After zoom, disappear
          setTimeout(() => {
            img.classList.remove("active");
            img.classList.add("disappear");
          }, 2000); // disappear after 2s
        }, i * 300); // stagger start
      });
    }
  });
});
