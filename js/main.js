// ═══ MAIN.JS — Index page ═══
import { db } from "./firebase-config.js";
import {
  collection, query, orderBy, limit,
  getDocs, startAfter, where
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// ── Cursor ──
const cursor         = document.getElementById("cursor");
const cursorFollower = document.getElementById("cursorFollower");
let mouseX = 0, mouseY = 0, followerX = 0, followerY = 0;
document.addEventListener("mousemove", (e) => {
  mouseX = e.clientX; mouseY = e.clientY;
  if (cursor) { cursor.style.left = mouseX + "px"; cursor.style.top = mouseY + "px"; }
});
(function animF() {
  followerX += (mouseX - followerX) * .1;
  followerY += (mouseY - followerY) * .1;
  if (cursorFollower) { cursorFollower.style.left = followerX + "px"; cursorFollower.style.top = followerY + "px"; }
  requestAnimationFrame(animF);
})();

// ── Header scroll ──
const header = document.getElementById("siteHeader");
window.addEventListener("scroll", () => {
  if (header) header.classList.toggle("scrolled", window.scrollY > 40);
}, { passive: true });

// ── Year ──
const yearEl = document.getElementById("year");
if (yearEl) yearEl.textContent = new Date().getFullYear();

// ── Counter ──
function animateCounter(el, target) {
  if (!el || isNaN(target)) { if (el) el.textContent = target; return; }
  let n = 0;
  const step = Math.max(1, Math.ceil(target / 40));
  const iv = setInterval(() => {
    n = Math.min(n + step, target);
    el.textContent = n;
    if (n >= target) clearInterval(iv);
  }, 30);
}

// ── Format date ──
function formatDate(ts) {
  if (!ts) return "";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}

// ── Articles ──
const PAGE_SIZE = 7; // 1 featured + 6 grid
let lastVisible = null;

async function loadArticles(after = null) {
  try {
    // FIXED: sem where() + orderBy() juntos para evitar necessidade de índice composto
    // Busca todos ordenados por data e filtra em memória
    let q = query(
      collection(db, "articles"),
      orderBy("createdAt", "desc"),
      limit(20)
    );
    if (after) {
      q = query(
        collection(db, "articles"),
        orderBy("createdAt", "desc"),
        startAfter(after),
        limit(20)
      );
    }
    const snap = await getDocs(q);
    // Filtra publicados em memória
    const published = snap.docs.filter(d => d.data().status === "published");
    const articles = published.slice(0, PAGE_SIZE).map(d => ({ id: d.id, ...d.data() }));
    if (snap.docs.length > 0) lastVisible = snap.docs[snap.docs.length - 1];
    return { articles, hasMore: published.length > PAGE_SIZE };
  } catch (err) {
    console.error("Firestore error:", err);
    return { articles: [], hasMore: false };
  }
}

async function countPublished() {
  try {
    const snap = await getDocs(query(collection(db, "articles"), orderBy("createdAt", "desc")));
    return snap.docs.filter(d => d.data().status === "published").length;
  } catch { return 0; }
}

function renderFeatured(article) {
  const el = document.getElementById("featuredArticle");
  if (!el) return;
  document.getElementById("featuredLink").href = `artigo.html?id=${article.id}`;
  document.getElementById("featuredTitle").textContent   = article.title   || "";
  document.getElementById("featuredExcerpt").textContent = article.excerpt || "";
  document.getElementById("featuredCategory").textContent = article.category || "Geral";
  document.getElementById("featuredDate").textContent    = formatDate(article.createdAt);
  const img = document.getElementById("featuredImage");
  if (article.imageUrl && img) {
    img.src = article.imageUrl;
    img.alt = article.title || "";
    img.style.display = "block";
  }
  el.style.display = "grid";
}

function renderCard(article, delay = 0) {
  const card = document.createElement("article");
  card.className = "article-card";
  card.style.animationDelay = delay + "ms";
  card.innerHTML = `
    <a href="artigo.html?id=${article.id}" class="card-link">
      <div class="card-img-wrap">
        ${article.imageUrl
          ? `<img src="${article.imageUrl}" alt="${article.title || ""}" class="card-img" loading="lazy"/>`
          : `<div class="card-img-placeholder"><span>${(article.category||"HS").slice(0,2).toUpperCase()}</span></div>`}
      </div>
      <div class="card-body">
        <div class="card-meta">
          <span class="card-cat">${article.category || "Geral"}</span>
          <span class="card-date">${formatDate(article.createdAt)}</span>
        </div>
        <h3 class="card-title">${article.title || ""}</h3>
        ${article.excerpt ? `<p class="card-excerpt">${article.excerpt}</p>` : ""}
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

  // Stats
  const count = await countPublished();
  animateCounter(statEl, count);

  // Load
  const { articles, hasMore } = await loadArticles();
  if (!grid) return;
  grid.innerHTML = "";

  if (articles.length === 0) {
    if (empty) empty.style.display = "block";
    return;
  }

  const [featured, ...rest] = articles;
  renderFeatured(featured);
  rest.forEach((a, i) => grid.appendChild(renderCard(a, i * 80)));

  if (hasMore && loadMoreWrap) {
    loadMoreWrap.style.display = "block";
    document.getElementById("loadMoreBtn")?.addEventListener("click", async () => {
      const btn = document.getElementById("loadMoreBtn");
      btn.textContent = "Carregando…";
      btn.disabled = true;
      const { articles: more, hasMore: moreLeft } = await loadArticles(lastVisible);
      more.forEach((a, i) => grid.appendChild(renderCard(a, i * 60)));
      btn.textContent = "Carregar mais";
      btn.disabled = false;
      if (!moreLeft) loadMoreWrap.style.display = "none";
    });
  }
}

init();
