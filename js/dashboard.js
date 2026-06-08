// ═══ DASHBOARD.JS ═══
import { auth, db, CLOUDINARY_CLOUD_NAME, CLOUDINARY_UPLOAD_PRESET } from "../js/firebase-config.js";
import {
  onAuthStateChanged, signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  collection, addDoc, updateDoc, deleteDoc,
  doc, getDocs, query, orderBy, serverTimestamp, getDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// ── Auth guard ──
onAuthStateChanged(auth, (user) => {
  if (!user) { window.location.href = "login.html"; return; }
  document.getElementById("adminWelcome").textContent = `Bem-vindo de volta, ${user.displayName || user.email} 👋`;
  initDashboard();
});

document.getElementById("logoutBtn").addEventListener("click", async () => {
  await signOut(auth);
  window.location.href = "login.html";
});

// ── State ──
let articles    = [];
let editingId   = null;
let uploadedUrl = null;
let deletingId  = null;

// ── DOM refs ──
const tableBody    = document.getElementById("articlesTableBody");
const editorModal  = document.getElementById("editorModal");
const deleteModal  = document.getElementById("deleteModal");
const searchInput  = document.getElementById("searchArticles");

// ── Init ──
async function initDashboard() {
  await fetchArticles();
  setupNewArticleBtns();
  setupEditor();
  setupDeleteModal();
  setupSearch();
}

// ── Fetch ──
async function fetchArticles() {
  tableBody.innerHTML = `<tr class="table-loading"><td colspan="5">Carregando…</td></tr>`;
  try {
    const snap = await getDocs(query(collection(db, "articles"), orderBy("createdAt", "desc")));
    articles = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderTable(articles);
    updateStats();
  } catch (err) {
    tableBody.innerHTML = `<tr class="table-loading"><td colspan="5">Erro ao carregar artigos.</td></tr>`;
    console.error(err);
  }
}

function updateStats() {
  document.getElementById("totalArticles").textContent     = articles.length;
  document.getElementById("publishedArticles").textContent = articles.filter(a => a.status === "published").length;
  document.getElementById("draftArticles").textContent     = articles.filter(a => a.status === "draft").length;
}

// ── Table ──
function formatDate(ts) {
  if (!ts) return "—";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}

function renderTable(data) {
  if (data.length === 0) {
    tableBody.innerHTML = `<tr class="table-loading"><td colspan="5">Nenhum artigo encontrado.</td></tr>`;
    return;
  }
  tableBody.innerHTML = data.map(a => `
    <tr>
      <td>${a.title || "(Sem título)"}</td>
      <td>${a.category || "—"}</td>
      <td>
        <span class="status-badge status-${a.status || "draft"}">
          ${a.status === "published" ? "Publicado" : "Rascunho"}
        </span>
      </td>
      <td>${formatDate(a.createdAt)}</td>
      <td>
        <div class="table-actions">
          <button class="table-btn" onclick="openEdit('${a.id}')">Editar</button>
          <a href="/artigo.html?id=${a.id}" target="_blank" class="table-btn">Ver</a>
          <button class="table-btn delete" onclick="openDelete('${a.id}')">Excluir</button>
        </div>
      </td>
    </tr>
  `).join("");
}

// ── Search ──
function setupSearch() {
  searchInput.addEventListener("input", (e) => {
    const q = e.target.value.toLowerCase().trim();
    const filtered = q
      ? articles.filter(a =>
          (a.title || "").toLowerCase().includes(q) ||
          (a.category || "").toLowerCase().includes(q)
        )
      : articles;
    renderTable(filtered);
  });
}

// ── New Article buttons ──
function setupNewArticleBtns() {
  const openEditor = () => openCreate();
  document.getElementById("newArticleBtn").addEventListener("click", openEditor);
  document.getElementById("newArticleBtnTop").addEventListener("click", openEditor);
}

// ── EDITOR MODAL ──
function setupEditor() {
  // Close
  document.getElementById("editorModalClose").addEventListener("click", closeEditor);
  document.getElementById("editorCancelBtn").addEventListener("click", closeEditor);
  editorModal.addEventListener("click", (e) => { if (e.target === editorModal) closeEditor(); });

  // Toolbar
  document.querySelectorAll(".toolbar-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const cmd = btn.dataset.cmd;
      if (cmd === "h2") {
        document.execCommand("formatBlock", false, "h2");
      } else if (cmd === "h3") {
        document.execCommand("formatBlock", false, "h3");
      } else if (cmd === "blockquote") {
        document.execCommand("formatBlock", false, "blockquote");
      } else if (cmd === "createLink") {
        const url = prompt("URL do link:");
        if (url) document.execCommand("createLink", false, url);
      } else {
        document.execCommand(cmd, false, null);
      }
      document.getElementById("artContent").focus();
    });
  });

  // Image upload area
  const uploadArea = document.getElementById("imageUploadArea");
  const fileInput  = document.getElementById("artImageFile");

  uploadArea.addEventListener("click", () => fileInput.click());
  uploadArea.addEventListener("dragover", (e) => { e.preventDefault(); uploadArea.style.borderColor = "var(--accent)"; });
  uploadArea.addEventListener("dragleave", () => uploadArea.style.borderColor = "");
  uploadArea.addEventListener("drop", (e) => {
    e.preventDefault();
    uploadArea.style.borderColor = "";
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith("image/")) handleImageFile(file);
  });

  fileInput.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (file) handleImageFile(file);
  });

  // Excerpt counter
  const excerptEl = document.getElementById("artExcerpt");
  const countEl   = document.getElementById("excerptCount");
  excerptEl.addEventListener("input", () => {
    countEl.textContent = `${excerptEl.value.length}/160`;
  });

  // Save
  document.getElementById("editorSaveBtn").addEventListener("click", saveArticle);
}

function openCreate() {
  editingId   = null;
  uploadedUrl = null;

  document.getElementById("editorModalTitle").textContent = "Novo Artigo";
  document.getElementById("editorSaveBtnText").textContent = "Publicar Artigo";
  document.getElementById("editingArticleId").value = "";
  document.getElementById("artTitle").value     = "";
  document.getElementById("artCategory").value  = "";
  document.getElementById("artStatus").value    = "published";
  document.getElementById("artContent").innerHTML = "";
  document.getElementById("artExcerpt").value   = "";
  document.getElementById("excerptCount").textContent = "0/160";
  document.getElementById("imagePreview").style.display = "none";
  document.getElementById("uploadPlaceholder").style.display = "flex";
  document.getElementById("uploadProgress").style.display    = "none";
  document.getElementById("editorError").style.display       = "none";

  editorModal.style.display = "flex";
  document.body.style.overflow = "hidden";
}

window.openEdit = async (id) => {
  const article = articles.find(a => a.id === id);
  if (!article) return;

  editingId   = id;
  uploadedUrl = article.imageUrl || null;

  document.getElementById("editorModalTitle").textContent  = "Editar Artigo";
  document.getElementById("editorSaveBtnText").textContent = "Salvar Alterações";
  document.getElementById("editingArticleId").value = id;
  document.getElementById("artTitle").value    = article.title || "";
  document.getElementById("artCategory").value = article.category || "";
  document.getElementById("artStatus").value   = article.status || "draft";
  document.getElementById("artContent").innerHTML = article.content || "";
  document.getElementById("artExcerpt").value  = article.excerpt || "";
  document.getElementById("excerptCount").textContent = `${(article.excerpt || "").length}/160`;
  document.getElementById("editorError").style.display = "none";

  if (article.imageUrl) {
    document.getElementById("imagePreview").src    = article.imageUrl;
    document.getElementById("imagePreview").style.display   = "block";
    document.getElementById("uploadPlaceholder").style.display = "none";
  } else {
    document.getElementById("imagePreview").style.display   = "none";
    document.getElementById("uploadPlaceholder").style.display = "flex";
  }
  document.getElementById("uploadProgress").style.display = "none";

  editorModal.style.display = "flex";
  document.body.style.overflow = "hidden";
};

function closeEditor() {
  editorModal.style.display = "none";
  document.body.style.overflow = "";
}

// ── Cloudinary Upload ──
async function handleImageFile(file) {
  if (file.size > 5 * 1024 * 1024) {
    alert("Imagem muito grande. Máximo: 5MB.");
    return;
  }

  const progressWrap = document.getElementById("uploadProgress");
  const progressBar  = document.getElementById("progressBar");
  const progressText = document.getElementById("progressText");
  const placeholder  = document.getElementById("uploadPlaceholder");
  const preview      = document.getElementById("imagePreview");

  placeholder.style.display  = "none";
  preview.style.display      = "none";
  progressWrap.style.display = "flex";
  progressText.textContent   = "Enviando…";

  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);
  formData.append("folder", "henrique-siqueira");

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`);

    xhr.upload.addEventListener("progress", (e) => {
      if (e.lengthComputable) {
        const pct = Math.round((e.loaded / e.total) * 100);
        progressBar.style.setProperty("--progress", pct + "%");
        progressText.textContent = `${pct}%`;
      }
    });

    xhr.addEventListener("load", () => {
      if (xhr.status === 200) {
        const data = JSON.parse(xhr.responseText);
        uploadedUrl = data.secure_url;
        preview.src = uploadedUrl;
        preview.style.display = "block";
        progressWrap.style.display = "none";
        resolve(uploadedUrl);
      } else {
        progressText.textContent = "Erro no upload.";
        reject(new Error("Upload failed"));
      }
    });

    xhr.addEventListener("error", () => {
      progressText.textContent = "Erro no upload.";
      reject(new Error("Network error"));
    });

    xhr.send(formData);
  });
}

// ── Save Article ──
async function saveArticle() {
  const title   = document.getElementById("artTitle").value.trim();
  const content = document.getElementById("artContent").innerHTML.trim();
  const excerpt = document.getElementById("artExcerpt").value.trim();
  const cat     = document.getElementById("artCategory").value.trim();
  const status  = document.getElementById("artStatus").value;
  const errorEl = document.getElementById("editorError");

  if (!title) {
    errorEl.textContent = "O título é obrigatório.";
    errorEl.style.display = "block";
    return;
  }
  if (!content || content === "<br>") {
    errorEl.textContent = "O conteúdo não pode estar vazio.";
    errorEl.style.display = "block";
    return;
  }

  errorEl.style.display = "none";

  const saveBtn = document.getElementById("editorSaveBtn");
  const saveTxt = document.getElementById("editorSaveBtnText");
  const saveSpinner = document.getElementById("editorSpinner");

  saveBtn.disabled  = true;
  saveTxt.style.display    = "none";
  saveSpinner.style.display = "flex";

  const data = {
    title,
    content,
    excerpt,
    category: cat,
    status,
    imageUrl: uploadedUrl || null,
    updatedAt: serverTimestamp(),
  };

  try {
    if (editingId) {
      await updateDoc(doc(db, "articles", editingId), data);
    } else {
      await addDoc(collection(db, "articles"), {
        ...data,
        createdAt: serverTimestamp(),
      });
    }
    closeEditor();
    await fetchArticles();
  } catch (err) {
    errorEl.textContent = "Erro ao salvar artigo. Tente novamente.";
    errorEl.style.display = "block";
    console.error(err);
  } finally {
    saveBtn.disabled  = false;
    saveTxt.style.display    = "inline";
    saveSpinner.style.display = "none";
  }
}

// ── DELETE MODAL ──
function setupDeleteModal() {
  document.getElementById("deleteCancel").addEventListener("click", closeDelete);
  deleteModal.addEventListener("click", (e) => { if (e.target === deleteModal) closeDelete(); });
  document.getElementById("deleteConfirm").addEventListener("click", confirmDelete);
}

window.openDelete = (id) => {
  deletingId = id;
  deleteModal.style.display = "flex";
  document.body.style.overflow = "hidden";
};

function closeDelete() {
  deleteModal.style.display = "none";
  document.body.style.overflow = "";
  deletingId = null;
}

async function confirmDelete() {
  if (!deletingId) return;

  const btn = document.getElementById("deleteConfirm");
  const txt = document.getElementById("deleteConfirmText");
  const sp  = document.getElementById("deleteSpinner");

  btn.disabled = true;
  txt.style.display = "none";
  sp.style.display  = "flex";

  try {
    await deleteDoc(doc(db, "articles", deletingId));
    closeDelete();
    await fetchArticles();
  } catch (err) {
    alert("Erro ao excluir artigo.");
    console.error(err);
  } finally {
    btn.disabled = false;
    txt.style.display = "inline";
    sp.style.display  = "none";
  }
}
