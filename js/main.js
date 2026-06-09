// ═══ MAIN.JS ═══
import { db } from "./firebase-config.js";
import {
  collection, query, orderBy, limit, getDocs, startAfter, doc, getDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { initContactForm } from "./contact.js";

// ── Cursor ──
const cursor = document.getElementById("cursor");
const ring   = document.getElementById("cursorFollower");
let mx = 0, my = 0, rx = 0, ry = 0;
document.addEventListener("mousemove", e => {
  mx = e.clientX; my = e.clientY;
  if (cursor) { cursor.style.left = mx+"px"; cursor.style.top = my+"px"; }
});
(function anim() {
  rx += (mx-rx)*.1; ry += (my-ry)*.1;
  if (ring) { ring.style.left = rx+"px"; ring.style.top = ry+"px"; }
  requestAnimationFrame(anim);
})();

// ── Header scroll ──
const header = document.getElementById("siteHeader");
window.addEventListener("scroll", () => {
  header?.classList.toggle("scrolled", window.scrollY > 40);
}, { passive: true });

// ── Year ──
const yearEl = document.getElementById("year");
if (yearEl) yearEl.textContent = new Date().getFullYear();

// ── Load profile photos from Firestore ──
async function loadProfilePhotos() {
  try {
    const snap = await getDoc(doc(db, "settings", "profile"));
    if (!snap.exists()) return;
    const data = snap.data();
    // Hero photo
    if (data.heroPhoto) {
      const imgs = document.querySelectorAll(".hero-photo");
      imgs.forEach(img => { img.src = data.heroPhoto; img.style.display = "block"; });
    }
    // About photo
    if (data.aboutPhoto) {
      const imgs = document.querySelectorAll(".about-photo");
      imgs.forEach(img => { img.src = data.aboutPhoto; img.style.display = "block"; });
    }
  } catch (err) { console.error("loadProfilePhotos:", err); }
}

// ── Format date ──
function fmtDate(ts) {
  if (!ts) return "";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString("pt-BR", { day:"2-digit", month:"short", year:"numeric" });
}

// ── Counter ──
function animCounter(el, target) {
  if (!el || isNaN(target)) { if (el) el.textContent = target; return; }
  let n = 0;
  const step = Math.max(1, Math.ceil(target/40));
  const iv = setInterval(() => {
    n = Math.min(n+step, target);
    el.textContent = n;
    if (n >= target) clearInterval(iv);
  }, 28);
}

// ── Articles ──
const PAGE = 7;
let lastVisible = null;

async function loadArticles(after = null) {
  try {
    const q = after
      ? query(collection(db, "articles"), orderBy("createdAt","desc"), startAfter(after), limit(24))
      : query(collection(db, "articles"), orderBy("createdAt","desc"), limit(24));
    const snap = await getDocs(q);
    const published = snap.docs.filter(d => d.data().status === "published");
    const result = published.slice(0, PAGE).map(d => ({ id: d.id, ...d.data() }));
    if (snap.docs.length > 0) lastVisible = snap.docs[snap.docs.length-1];
    return { articles: result, hasMore: published.length > PAGE };
  } catch (err) { console.error("loadArticles:", err); return { articles: [], hasMore: false }; }
}

async function countPublished() {
  try {
    const snap = await getDocs(query(collection(db,"articles"), orderBy("createdAt","desc")));
    return snap.docs.filter(d => d.data().status === "published").length;
  } catch { return 0; }
}

function renderFeatured(a) {
  const el = document.getElementById("featuredArticle");
  if (!el) return;
  document.getElementById("featuredLink").href             = `artigo.html?id=${a.id}`;
  document.getElementById("featuredTitle").textContent     = a.title   || "";
  document.getElementById("featuredExcerpt").textContent   = a.excerpt || "";
  document.getElementById("featuredCategory").textContent  = a.category || "Geral";
  document.getElementById("featuredDate").textContent      = fmtDate(a.createdAt);
  const img = document.getElementById("featuredImage");
  const fb  = document.getElementById("featuredImgFallback");
  if (a.imageUrl && img) { img.src = a.imageUrl; img.style.display = "block"; if(fb) fb.style.display="none"; }
  el.style.display = "grid";
}

function renderCard(a, delay = 0) {
  const card = document.createElement("article");
  card.className = "article-card";
  card.style.animationDelay = delay + "ms";
  card.innerHTML = `
    <a href="artigo.html?id=${a.id}" class="card-link">
      <div class="card-img-wrap">
        ${a.imageUrl
          ? `<img src="${a.imageUrl}" alt="${a.title||""}" class="card-img" loading="lazy"/>`
          : `<div class="card-img-placeholder"><span>${(a.category||"HS").slice(0,2).toUpperCase()}</span></div>`}
      </div>
      <div class="card-body">
        <div class="card-meta">
          <span class="card-cat">${a.category||"Geral"}</span>
          <span class="card-date">${fmtDate(a.createdAt)}</span>
        </div>
        <h3 class="card-title">${a.title||""}</h3>
        ${a.excerpt ? `<p class="card-excerpt">${a.excerpt}</p>` : ""}
        <span class="card-read">Ler artigo →</span>
      </div>
    </a>`;
  return card;
}

async function init() {
  const grid         = document.getElementById("articlesGrid");
  const empty        = document.getElementById("emptyState");
  const loadMoreWrap = document.getElementById("loadMoreWrap");
  const statEl       = document.getElementById("statArticles");

  // Load photos and count in parallel
  const [count] = await Promise.all([countPublished(), loadProfilePhotos()]);
  animCounter(statEl, count);

  const { articles, hasMore } = await loadArticles();
  if (!grid) return;
  grid.innerHTML = "";
  if (!articles.length) { if(empty) empty.style.display = "block"; return; }

  const [featured, ...rest] = articles;
  renderFeatured(featured);
  rest.forEach((a,i) => grid.appendChild(renderCard(a, i*80)));

  if (hasMore && loadMoreWrap) {
    loadMoreWrap.style.display = "block";
    document.getElementById("loadMoreBtn")?.addEventListener("click", async () => {
      const btn = document.getElementById("loadMoreBtn");
      btn.textContent = "Carregando…"; btn.disabled = true;
      const { articles: more, hasMore: ml } = await loadArticles(lastVisible);
      more.forEach((a,i) => grid.appendChild(renderCard(a, i*60)));
      btn.textContent = "Carregar mais"; btn.disabled = false;
      if (!ml) loadMoreWrap.style.display = "none";
    });
  }

  // Contact form
  initContactForm();
}

init();
