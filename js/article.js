// ═══ ARTICLE.JS ═══
import { db } from "../js/firebase-config.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// Cursor
const cursor = document.getElementById("cursor");
const follower = document.getElementById("cursorFollower");
let mx = 0, my = 0, fx = 0, fy = 0;
document.addEventListener("mousemove", (e) => {
  mx = e.clientX; my = e.clientY;
  cursor.style.left = mx + "px"; cursor.style.top = my + "px";
});
(function animate() {
  fx += (mx - fx) * .12; fy += (my - fy) * .12;
  follower.style.left = fx + "px"; follower.style.top = fy + "px";
  requestAnimationFrame(animate);
})();

// Header scroll
const header = document.getElementById("siteHeader");
window.addEventListener("scroll", () => {
  header.classList.toggle("scrolled", window.scrollY > 20);
}, { passive: true });

// Reading progress
const progressBar = document.getElementById("readingProgress");
window.addEventListener("scroll", () => {
  const total = document.body.scrollHeight - window.innerHeight;
  const pct = total > 0 ? (window.scrollY / total) * 100 : 0;
  progressBar.style.width = pct + "%";
  progressBar.setAttribute("aria-valuenow", Math.round(pct));
}, { passive: true });

// Year
document.getElementById("year").textContent = new Date().getFullYear();

// Format date
function formatDate(ts) {
  if (!ts) return "";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
}

function readTime(html) {
  const words = html.replace(/<[^>]+>/g, "").split(/\s+/).filter(Boolean).length;
  return `${Math.max(1, Math.ceil(words / 200))} min de leitura`;
}

// Load article
async function loadArticle() {
  const params = new URLSearchParams(window.location.search);
  const id = params.get("id");

  const loading    = document.getElementById("articleLoading");
  const container  = document.getElementById("articleContainer");
  const notFound   = document.getElementById("articleNotFound");

  if (!id) {
    loading.style.display = "none";
    notFound.style.display = "block";
    return;
  }

  try {
    const snap = await getDoc(doc(db, "articles", id));

    loading.style.display = "none";

    if (!snap.exists() || snap.data().status !== "published") {
      notFound.style.display = "block";
      return;
    }

    const article = { id: snap.id, ...snap.data() };

    // Populate
    document.getElementById("articleTitle").textContent    = article.title || "";
    document.getElementById("articleCategory").textContent = article.category || "Geral";
    document.getElementById("articleDate").textContent     = formatDate(article.createdAt);
    document.getElementById("articleReadTime").textContent = readTime(article.content || "");
    document.getElementById("articleBody").innerHTML       = article.content || "";

    // Cover
    if (article.imageUrl) {
      const img = document.getElementById("articleCover");
      img.src = article.imageUrl;
      img.alt = article.title || "";
      document.getElementById("articleCoverWrap").style.display = "block";
    }

    // SEO meta dynamic update
    document.title = `${article.title} — Henrique Siqueira`;
    setMeta("description", article.excerpt || article.title);
    setMeta("og:title",    article.title);
    setMeta("og:description", article.excerpt || "");
    setMeta("og:image",    article.imageUrl || "");
    setMeta("og:url",      window.location.href);
    setMeta("twitter:title", article.title);
    setMeta("twitter:description", article.excerpt || "");
    setMeta("twitter:image", article.imageUrl || "");

    // Canonical
    let canonical = document.querySelector('link[rel="canonical"]');
    if (!canonical) { canonical = document.createElement("link"); canonical.rel = "canonical"; document.head.appendChild(canonical); }
    canonical.href = window.location.href;

    // JSON-LD Article
    const schema = {
      "@context": "https://schema.org",
      "@type": "BlogPosting",
      "headline": article.title,
      "description": article.excerpt || "",
      "image": article.imageUrl || "",
      "author": { "@type": "Person", "name": "Henrique Siqueira" },
      "publisher": { "@type": "Person", "name": "Henrique Siqueira" },
      "datePublished": article.createdAt?.toDate?.()?.toISOString() || "",
      "url": window.location.href,
      "inLanguage": "pt-BR",
    };
    const ld = document.createElement("script");
    ld.type = "application/ld+json";
    ld.textContent = JSON.stringify(schema);
    document.head.appendChild(ld);

    // Share buttons
    const url   = encodeURIComponent(window.location.href);
    const title = encodeURIComponent(article.title || "");
    document.getElementById("shareTwitter").href  = `https://twitter.com/intent/tweet?url=${url}&text=${title}`;
    document.getElementById("shareWhatsapp").href = `https://wa.me/?text=${title}%20${url}`;
    document.getElementById("shareCopy").addEventListener("click", () => {
      navigator.clipboard.writeText(window.location.href).then(() => {
        const btn = document.getElementById("shareCopy");
        btn.style.color = "var(--accent)";
        btn.style.borderColor = "var(--accent)";
        setTimeout(() => {
          btn.style.color = ""; btn.style.borderColor = "";
        }, 2000);
      });
    });

    container.style.display = "block";

  } catch (err) {
    console.error("Failed to load article:", err);
    loading.style.display = "none";
    notFound.style.display = "block";
  }
}

function setMeta(name, content) {
  let el = document.querySelector(`meta[name="${name}"], meta[property="${name}"]`);
  if (el) el.setAttribute("content", content);
}

loadArticle();
