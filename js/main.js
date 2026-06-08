// ═══ MAIN.JS — Index page ═══
import { db } from "./firebase-config.js";
import {
  collection, query, orderBy, limit,
  getDocs, where, startAfter
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// ── Cursor ──
const cursor         = document.getElementById("cursor");
const cursorFollower = document.getElementById("cursorFollower");
let mouseX = 0, mouseY = 0, followerX = 0, followerY = 0;

document.addEventListener("mousemove", (e) => {
  mouseX = e.clientX; mouseY = e.clientY;
  cursor.style.left = mouseX + "px";
  cursor.style.top  = mouseY + "px";
});

function animateFollower() {
  followerX += (mouseX - followerX) * .12;
  followerY += (mouseY - followerY) * .12;
  cursorFollower.style.left = followerX + "px";
  cursorFollower.style.top  = followerY + "px";
  requestAnimationFrame(animateFollower);
}
animateFollower();

// ── Header scroll ──
const header = document.getElementById("siteHeader");
window.addEventListener("scroll", () => {
  header.classList.toggle("scrolled", window.scrollY > 20);
}, { passive: true });

// ── Year ──
document.getElementById("year").textContent = new Date().getFullYear();

// ── Counter animation ──
function animateCounter(el, target) {
  if (isNaN(target)) { el.textContent = target; return; }
  let current = 0;
  const step = Math.ceil(target / 40);
  const interval = setInterval(() => {
    current = Math.min(current + step, target);
    el.textContent = current;
    if (current >= target) clearInterval(interval);
  }, 30);
}

// ── Smooth anchor links ──
document.querySelectorAll('a[href^="#"]').forEach(a => {
  a.addEventListener("click", (e) => {
    const target = document.querySelector(a.getAttribute("href"));
    if (target) {
      e.preventDefault();
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  });
});

// ── Intersection Observer for animations ──
const io = new IntersectionObserver((entries) => {
  entries.forEach(e => {
    if (e.isIntersecting) e.target.classList.add("visible");
  });
}, { threshold: .1 });

// ── Fetch articles ──
const PAGE_SIZE = 6;
let lastDoc = null;
let totalCount = 0;
let allArticles = [];

async function loadArticles(loadMore = false) {
  try {
    const baseQuery = query(
      collection(db, "articles"),
      where("status", "==", "published"),
      orderBy("createdAt", "desc"),
      limit(PAGE_SIZE + 1)
    );

    const q = loadMore && lastDoc
      ? query(
          collection(db, "articles"),
          where("status", "==", "published"),
          orderBy("createdAt", "desc"),
          startAfter(lastDoc),
          limit(PAGE_SIZE + 1)
        )
      : baseQuery;

    const snap = await getDocs(q);
    const docs = snap.docs;

    const hasMore = docs.length > PAGE_SIZE;
    const articles = docs.slice(0, PAGE_SIZE).map(d => ({ id: d.id, ...d.data() }));

    if (docs.length > 0) {
      lastDoc = docs[Math.min(docs.length - 1, PAGE_SIZE - 1)];
    }

    return { articles, hasMore };
  } catch (err) {
    console.error("Error loading articles:", err);
    return { articles: [], hasMore: false };
  }
}

async function countArticles() {
  try {
    const snap = await getDocs(
      query(collection(db, "articles"), where("status", "==", "published"))
    );
    return snap.size;
  } catch { return 0; }
}

function formatDate(ts) {
  if (!ts) return "";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}

function readTime(content) {
  const words = (content || "").replace(/<[^>]+>/g, "").split(/\s+/).length;
  const mins  = Math.max(1, Math.ceil(words / 200));
  return `${mins} min de leitura`;
}

function renderFeatured(article) {
  const featured = document.getElementById("featuredArticle");
  document.getElementById("featuredLink").href        = `artigo.html?id=${article.id}`;
  document.getElementById("featuredTitle").textContent  = article.title || "";
  document.getElementById("featuredExcerpt").textContent = article.excerpt || "";
  document.getElementById("featuredCategory").textContent = article.category || "Geral";
  document.getElementById("featuredDate").textContent  = formatDate(article.createdAt);
  if (article.imageUrl) {
    const img = document.getElementById("featuredImage");
    img.src = article.imageUrl;
    img.alt = article.title || "";
  }
  featured.style.display = "block";
}

function renderCard(article, delay = 0) {
  const card = document.createElement("article");
  card.className = "article-card";
  card.style.animationDelay = `${delay}ms`;
  card.setAttribute("itemscope", "");
  card.setAttribute("itemtype", "https://schema.org/BlogPosting");

  card.innerHTML = `
    <a href="artigo.html?id=${article.id}" class="card-link" aria-label="Ler: ${article.title || ""}">
      <div class="card-image-wrap">
        ${article.imageUrl
          ? `<img src="${article.imageUrl}" alt="${article.title || ""}" class="card-image" loading="lazy" itemprop="image" />`
          : `<div class="card-no-image">${(article.category || "HS").substring(0, 2).toUpperCase()}</div>`
        }
      </div>
      <div class="card-body">
        <div class="card-meta">
          <span class="card-category" itemprop="articleSection">${article.category || "Geral"}</span>
          <span class="card-date" itemprop="datePublished">${formatDate(article.createdAt)}</span>
        </div>
        <h3 class="card-title" itemprop="headline">${article.title || ""}</h3>
        ${article.excerpt ? `<p class="card-excerpt" itemprop="description">${article.excerpt}</p>` : ""}
      </div>
    </a>
  `;

  return card;
}

async function init() {
  const grid       = document.getElementById("articlesGrid");
  const empty      = document.getElementById("emptyState");
  const loadMoreWrap = document.getElementById("loadMoreWrap");
  const statEl     = document.getElementById("statArticles");

  // Count
  const count = await countArticles();
  animateCounter(statEl, count);

  // Load
  const { articles, hasMore } = await loadArticles();

  // Clear skeletons
  grid.innerHTML = "";

  if (articles.length === 0) {
    empty.style.display = "block";
    return;
  }

  // First article = featured
  const [first, ...rest] = articles;
  renderFeatured(first);

  // Rest in grid
  rest.forEach((a, i) => grid.appendChild(renderCard(a, i * 80)));
  allArticles = [...allArticles, ...rest];

  if (hasMore) {
    loadMoreWrap.style.display = "block";
  }

  // Load more
  document.getElementById("loadMoreBtn").addEventListener("click", async () => {
    const btn = document.getElementById("loadMoreBtn");
    btn.textContent = "Carregando…";
    btn.disabled = true;

    const { articles: more, hasMore: moreLeft } = await loadArticles(true);
    more.forEach((a, i) => grid.appendChild(renderCard(a, i * 60)));
    allArticles = [...allArticles, ...more];

    btn.textContent = "Carregar mais artigos";
    btn.disabled = false;
    if (!moreLeft) loadMoreWrap.style.display = "none";
  });
}

init();
