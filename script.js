const toggle = document.querySelector(".menu-toggle");
const pageShell = document.querySelector(".page-shell");
const siteHeader = document.querySelector(".site-header");
const nav = document.querySelector(".site-nav");
const hero = document.querySelector(".hero");
const heroImage = document.querySelector(".hero-visual img");
const sectionLinks = Array.from(document.querySelectorAll('.site-nav a[href^="#"]'));
const observedSections = sectionLinks
  .map((link) => document.querySelector(link.getAttribute("href")))
  .filter(Boolean);
let lightbox;
let lightboxImage;
let lightboxFigure;
let lightboxClose;
let lightboxDownload;
let lastTrigger = null;
let lightboxZoomed = false;
let zoomTargetX = 50;
let zoomTargetY = 50;
let zoomCurrentX = 50;
let zoomCurrentY = 50;
let zoomAnimationFrame = null;

if (toggle && nav) {
  toggle.addEventListener("click", () => {
    const isOpen = nav.classList.toggle("is-open");
    toggle.setAttribute("aria-expanded", String(isOpen));
  });

  nav.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => {
      nav.classList.remove("is-open");
      toggle.setAttribute("aria-expanded", "false");
    });
  });
}

function updateHeaderMode() {
  if (!siteHeader || !hero) {
    return;
  }

  const heroBottom = hero.getBoundingClientRect().bottom;
  const shouldCondense = heroBottom <= Math.min(window.innerHeight * 0.32, 280);
  siteHeader.classList.toggle("is-condensed", shouldCondense);
  pageShell?.classList.toggle("has-floating-toc", shouldCondense);
}

function setActiveSection(id) {
  sectionLinks.forEach((link) => {
    const isActive = link.getAttribute("href") === `#${id}`;
    link.classList.toggle("is-active", isActive);
    if (isActive) {
      link.setAttribute("aria-current", "location");
    } else {
      link.removeAttribute("aria-current");
    }
  });
}

function updateActiveSection() {
  if (!observedSections.length) {
    return;
  }

  const marker = window.innerHeight * 0.3;
  let currentSection = observedSections[0];

  observedSections.forEach((section) => {
    const rect = section.getBoundingClientRect();
    if (rect.top <= marker) {
      currentSection = section;
    }
  });

  if (currentSection?.id) {
    setActiveSection(currentSection.id);
  }
}

const createLightbox = () => {
  const wrapper = document.createElement("div");
  wrapper.className = "lightbox";
  wrapper.hidden = true;
  wrapper.setAttribute("aria-hidden", "true");
  wrapper.innerHTML = `
    <button class="lightbox-backdrop" type="button" aria-label="Lukk bildevisning"></button>
    <div class="lightbox-dialog" role="dialog" aria-modal="true" aria-label="Bildevisning">
      <button class="lightbox-download" type="button" aria-label="Last ned bilde">Last ned</button>
      <button class="lightbox-close" type="button" aria-label="Lukk bildevisning">Lukk</button>
      <figure class="lightbox-figure">
        <img class="lightbox-image" src="" alt="" />
      </figure>
    </div>
  `;

  document.body.append(wrapper);
  lightbox = wrapper;
  lightboxImage = wrapper.querySelector(".lightbox-image");
  lightboxFigure = wrapper.querySelector(".lightbox-figure");
  lightboxClose = wrapper.querySelector(".lightbox-close");
  lightboxDownload = wrapper.querySelector(".lightbox-download");

  wrapper.querySelector(".lightbox-backdrop")?.addEventListener("click", closeLightbox);
  lightboxClose?.addEventListener("click", closeLightbox);
  lightboxDownload?.addEventListener("click", downloadCurrentImage);
  lightboxImage?.addEventListener("click", toggleZoom);
  lightboxFigure?.addEventListener("mousemove", panZoomedImage);
  lightboxFigure?.addEventListener("mouseleave", resetZoomFocus);
};

const openLightbox = (trigger) => {
  if (!lightbox || !lightboxImage) {
    return;
  }

  lightboxImage.src = trigger.dataset.lightboxSrc || trigger.currentSrc || trigger.src;
  lightboxImage.alt = trigger.alt || "";
  lightbox.classList.remove("is-zoomed");
  lightboxImage.classList.remove("is-zoomed");
  lightboxImage.style.transformOrigin = "50% 50%";
  lightboxImage.style.transform = "";
  lightboxDownload?.setAttribute("data-image-src", lightboxImage.src);
  lightboxZoomed = false;
  zoomTargetX = 50;
  zoomTargetY = 50;
  zoomCurrentX = 50;
  zoomCurrentY = 50;
  lightbox.hidden = false;
  lightbox.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
  if (lightboxFigure) {
    lightboxFigure.scrollTop = 0;
    lightboxFigure.scrollLeft = 0;
  }
  lastTrigger = trigger;
  lightboxClose?.focus();
};

function closeLightbox() {
  if (!lightbox || !lightboxImage) {
    return;
  }

  lightbox.hidden = true;
  lightbox.setAttribute("aria-hidden", "true");
  lightbox.classList.remove("is-zoomed");
  lightboxImage.classList.remove("is-zoomed");
  lightboxImage.src = "";
  lightboxImage.alt = "";
  lightboxImage.style.transformOrigin = "50% 50%";
  lightboxImage.style.transform = "";
  lightboxDownload?.removeAttribute("data-image-src");
  lightboxZoomed = false;
  zoomTargetX = 50;
  zoomTargetY = 50;
  zoomCurrentX = 50;
  zoomCurrentY = 50;
  if (zoomAnimationFrame) {
    cancelAnimationFrame(zoomAnimationFrame);
    zoomAnimationFrame = null;
  }
  document.body.style.overflow = "";
  lastTrigger?.focus();
}

function toggleZoom() {
  if (!lightbox || !lightboxImage || !lightboxFigure) {
    return;
  }

  lightboxZoomed = !lightboxZoomed;
  lightbox.classList.toggle("is-zoomed", lightboxZoomed);
  lightboxImage.classList.toggle("is-zoomed", lightboxZoomed);
  zoomTargetX = 50;
  zoomTargetY = 50;
  zoomCurrentX = 50;
  zoomCurrentY = 50;
  updateZoomTransform(true);

  if (!lightboxZoomed) {
    lightboxFigure.scrollTop = 0;
    lightboxFigure.scrollLeft = 0;
    if (zoomAnimationFrame) {
      cancelAnimationFrame(zoomAnimationFrame);
      zoomAnimationFrame = null;
    }
  } else {
    startZoomAnimation();
  }
}

function panZoomedImage(event) {
  if (!lightboxZoomed || !lightboxFigure || !lightboxImage) {
    return;
  }

  const rect = lightboxFigure.getBoundingClientRect();
  if (!rect.width || !rect.height) {
    return;
  }

  const x = ((event.clientX - rect.left) / rect.width) * 100;
  const y = ((event.clientY - rect.top) / rect.height) * 100;
  const clampedX = Math.max(0, Math.min(100, x));
  const clampedY = Math.max(0, Math.min(100, y));

  zoomTargetX = clampedX;
  zoomTargetY = clampedY;
}

function resetZoomFocus() {
  if (!lightboxZoomed) {
    return;
  }

  zoomTargetX = 50;
  zoomTargetY = 50;
}

function updateZoomTransform(force = false) {
  if (!lightboxImage) {
    return;
  }

  const scale = lightboxZoomed ? 1.5 : 1;
  const originX = force ? zoomTargetX : zoomCurrentX;
  const originY = force ? zoomTargetY : zoomCurrentY;
  lightboxImage.style.transformOrigin = `${originX}% ${originY}%`;
  lightboxImage.style.transform = `scale(${scale})`;
}

function startZoomAnimation() {
  if (!lightboxZoomed || !lightboxImage) {
    return;
  }

  const tick = () => {
    zoomCurrentX += (zoomTargetX - zoomCurrentX) * 0.14;
    zoomCurrentY += (zoomTargetY - zoomCurrentY) * 0.14;
    updateZoomTransform();

    if (lightboxZoomed) {
      zoomAnimationFrame = requestAnimationFrame(tick);
    } else {
      zoomAnimationFrame = null;
    }
  };

  if (!zoomAnimationFrame) {
    zoomAnimationFrame = requestAnimationFrame(tick);
  }
}

function downloadCurrentImage() {
  const src = lightboxDownload?.dataset.imageSrc;
  if (!src) {
    return;
  }

  const anchor = document.createElement("a");
  anchor.href = src;
  anchor.download = src.split("/").pop() || "bilde";
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
}

function updateHeroParallax() {
  if (!hero || !heroImage) {
    return;
  }

  const rect = hero.getBoundingClientRect();
  const viewportHeight = window.innerHeight || 1;
  const progress = Math.max(-1, Math.min(1, rect.top / viewportHeight));
  const offset = progress * -24;
  const scale = 1.01 + Math.abs(progress) * 0.035;

  heroImage.style.transform = `scale(${scale}) translate3d(0, ${offset}px, 0)`;
}

function updateScrollUI() {
  updateHeroParallax();
  updateHeaderMode();
  updateActiveSection();
}

createLightbox();

document.querySelectorAll("main figure img").forEach((image) => {
  if (image.closest(".hero")) {
    return;
  }

  image.classList.add("lightbox-target");
  image.tabIndex = 0;
  image.setAttribute("role", "button");
  image.setAttribute("aria-label", `${image.alt || "Bilde"}, åpne i stor visning`);
  image.dataset.lightboxSrc = image.getAttribute("src") || "";

  image.addEventListener("click", () => openLightbox(image));
  image.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openLightbox(image);
    }
  });
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && lightbox && !lightbox.hidden) {
    closeLightbox();
  }
});

window.addEventListener("scroll", updateScrollUI, { passive: true });
window.addEventListener("resize", updateScrollUI);
updateScrollUI();
