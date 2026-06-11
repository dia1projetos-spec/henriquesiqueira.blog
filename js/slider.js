// ═══ SLIDER.JS — Hero Slideshow ═══
import { db } from "./firebase-config.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const INTERVAL = 6000; // ms per slide
let slides = [], current = 0, timer = null, progressTimer = null, progressVal = 0;

// ── Load slides from Firestore ──
async function loadSlides() {
  try {
    const snap = await getDoc(doc(db, "settings", "slides"));
    if (snap.exists() && Array.isArray(snap.data().items) && snap.data().items.length > 0) {
      return snap.data().items.filter(s => s.url); // só slides com imagem
    }
  } catch (e) { console.warn("slider:", e); }
  return []; // sem slides → mantém o padrão gradient
}

// ── Build slide DOM ──
function buildSlide(slide, idx) {
  const div = document.createElement("div");
  div.className = "slide";
  div.dataset.index = idx;
  div.style.backgroundImage = `url('${slide.url}')`;
  div.innerHTML = `<div class="slide-photo-overlay"></div>`;
  return div;
}

// ── Dots ──
function buildDots(count) {
  const wrap = document.getElementById("sliderDots");
  if (!wrap) return;
  wrap.innerHTML = "";
  for (let i = 0; i < count; i++) {
    const dot = document.createElement("button");
    dot.className = "slider-dot" + (i === 0 ? " active" : "");
    dot.setAttribute("aria-label", `Slide ${i + 1}`);
    dot.addEventListener("click", () => goTo(i));
    wrap.appendChild(dot);
  }
}

function updateDots() {
  document.querySelectorAll(".slider-dot").forEach((d, i) => {
    d.classList.toggle("active", i === current);
  });
}

// ── Progress bar ──
function startProgress() {
  clearInterval(progressTimer);
  progressVal = 0;
  const fill = document.getElementById("sliderProgressFill");
  if (fill) fill.style.width = "0%";
  progressTimer = setInterval(() => {
    progressVal += 100 / (INTERVAL / 100);
    if (progressVal >= 100) progressVal = 100;
    if (fill) fill.style.width = progressVal + "%";
  }, 100);
}

// ── Navigate ──
function goTo(idx) {
  if (!slides.length) return;
  const track = document.getElementById("slidesTrack");
  const all = track.querySelectorAll(".slide");
  all[current]?.classList.remove("active");
  current = (idx + slides.length) % slides.length;
  all[current]?.classList.add("active");
  updateDots();
  startProgress();
}

function next() { goTo(current + 1); }
function prev() { goTo(current - 1); }

function startAuto() {
  clearInterval(timer);
  timer = setInterval(next, INTERVAL);
}

// ── Init ──
export async function initSlider() {
  const track = document.getElementById("slidesTrack");
  if (!track) return;

  slides = await loadSlides();

  if (slides.length === 0) {
    // Sem slides — mantém o fallback gradient, esconde controls se quiser
    document.getElementById("sliderDots")?.closest(".slider-controls")?.style.setProperty("display", "none");
    return;
  }

  // Remove fallback
  track.innerHTML = "";

  // Build slides
  slides.forEach((s, i) => {
    const el = buildSlide(s, i);
    if (i === 0) el.classList.add("active");
    track.appendChild(el);
  });

  buildDots(slides.length);
  startProgress();
  startAuto();

  // Controls
  document.getElementById("sliderPrev")?.addEventListener("click", () => { prev(); clearInterval(timer); startAuto(); });
  document.getElementById("sliderNext")?.addEventListener("click", () => { next(); clearInterval(timer); startAuto(); });

  // Pause on hover
  const hero = document.getElementById("heroSlider");
  hero?.addEventListener("mouseenter", () => { clearInterval(timer); clearInterval(progressTimer); });
  hero?.addEventListener("mouseleave", () => { startAuto(); startProgress(); });

  // Touch/swipe
  let touchX = 0;
  hero?.addEventListener("touchstart", e => { touchX = e.touches[0].clientX; }, { passive: true });
  hero?.addEventListener("touchend", e => {
    const dx = e.changedTouches[0].clientX - touchX;
    if (Math.abs(dx) > 50) { dx < 0 ? next() : prev(); clearInterval(timer); startAuto(); }
  }, { passive: true });
}
