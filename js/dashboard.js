// ═══ DASHBOARD.JS ═══
import { auth, db, CLOUDINARY_CLOUD_NAME, CLOUDINARY_UPLOAD_PRESET } from "../js/firebase-config.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  collection, addDoc, updateDoc, deleteDoc,
  doc, getDocs, query, orderBy, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// ── Auth guard ──
onAuthStateChanged(auth, (user) => {
  if (!user) { window.location.href = "login.html"; return; }
  document.getElementById("adminWelcome").textContent =
    `Bem-vindo de volta, ${user.displayName || user.email} 👋`;
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

const tableBody   = document.getElementById("articlesTableBody");
const editorModal = document.getElementById("editorModal");
const deleteModal = document.getElementById("deleteModal");

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
    const snap = await getDocs(
      query(collection(db, "articles"), orderBy("createdAt", "desc"))
    );
    articles = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderTable(articles);
    updateStats();
  } catch (err) {
    tableBody.innerHTML = `<tr class="table-loading"><td colspan="5">Erro: ${err.message}</td></tr>`;
    console.error("fetchArticles error:", err);
  }
}

function updateStats() {
  document.getElementById("totalArticles").textContent     = articles.length;
  document.getElementById("publishedArticles").textContent = articles.filter(a => a.status === "published").length;
  document.getElementById("draftArticles").textContent     = articles.filter(a => a.status !== "published").length;
}

function formatDate(ts) {
  if (!ts) return "—";
  try {
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
  } catch { return "—"; }
}

function renderTable(data) {
  if (data.length === 0) {
    tableBody.innerHTML = `<tr class="table-loading"><td colspan="5">Nenhum artigo ainda.</td></tr>`;
    return;
  }
  tableBody.innerHTML = data.map(a => `
    <tr>
      <td style="max-width:280px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${a.title || "(Sem título)"}</td>
      <td>${a.category || "—"}</td>
      <td><span class="status-badge status-${a.status === "published" ? "published" : "draft"}">
        ${a.status === "published" ? "Publicado" : "Rascunho"}
      </span></td>
      <td>${formatDate(a.createdAt)}</td>
      <td>
        <div class="table-actions">
          <button class="table-btn" onclick="openEdit('${a.id}')">Editar</button>
          <a href="../artigo.html?id=${a.id}" target="_blank" class="table-btn">Ver</a>
          <button class="table-btn delete" onclick="openDelete('${a.id}')">Excluir</button>
        </div>
      </td>
    </tr>`).join("");
}

// ── Search ──
function setupSearch() {
  document.getElementById("searchArticles")?.addEventListener("input", (e) => {
    const q = e.target.value.toLowerCase().trim();
    renderTable(q ? articles.filter(a =>
      (a.title || "").toLowerCase().includes(q) ||
      (a.category || "").toLowerCase().includes(q)
    ) : articles);
  });
}

// ── New Article ──
function setupNewArticleBtns() {
  document.getElementById("newArticleBtn")?.addEventListener("click", openCreate);
  document.getElementById("newArticleBtnTop")?.addEventListener("click", openCreate);
}

// ── Editor ──
function setupEditor() {
  document.getElementById("editorModalClose")?.addEventListener("click", closeEditor);
  document.getElementById("editorCancelBtn")?.addEventListener("click", closeEditor);
  editorModal?.addEventListener("click", (e) => { if (e.target === editorModal) closeEditor(); });

  // Toolbar
  document.querySelectorAll(".toolbar-btn").forEach(btn => {
    btn.addEventListener("mousedown", (e) => {
      e.preventDefault();
      const cmd = btn.dataset.cmd;
      if (cmd === "h2")         document.execCommand("formatBlock", false, "h2");
      else if (cmd === "h3")    document.execCommand("formatBlock", false, "h3");
      else if (cmd === "blockquote") document.execCommand("formatBlock", false, "blockquote");
      else if (cmd === "createLink") {
        const url = prompt("URL:");
        if (url) document.execCommand("createLink", false, url);
      } else document.execCommand(cmd, false, null);
      document.getElementById("artContent")?.focus();
    });
  });

  // Image upload
  const uploadArea = document.getElementById("imageUploadArea");
  const fileInput  = document.getElementById("artImageFile");
  uploadArea?.addEventListener("click", () => fileInput?.click());
  uploadArea?.addEventListener("dragover", (e) => { e.preventDefault(); });
  uploadArea?.addEventListener("drop", (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file?.type.startsWith("image/")) handleImageFile(file);
  });
  fileInput?.addEventListener("change", (e) => {
    if (e.target.files[0]) handleImageFile(e.target.files[0]);
  });

  // Excerpt counter
  document.getElementById("artExcerpt")?.addEventListener("input", (e) => {
    document.getElementById("excerptCount").textContent = `${e.target.value.length}/160`;
  });

  // Save
  document.getElementById("editorSaveBtn")?.addEventListener("click", saveArticle);
}

function openCreate() {
  editingId = null; uploadedUrl = null;
  document.getElementById("editorModalTitle").textContent  = "Novo Artigo";
  document.getElementById("editorSaveBtnText").textContent = "Publicar Artigo";
  document.getElementById("editingArticleId").value = "";
  document.getElementById("artTitle").value    = "";
  document.getElementById("artCategory").value = "";
  document.getElementById("artStatus").value   = "published";
  document.getElementById("artContent").innerHTML = "";
  document.getElementById("artExcerpt").value  = "";
  document.getElementById("excerptCount").textContent = "0/160";
  document.getElementById("imagePreview").style.display      = "none";
  document.getElementById("uploadPlaceholder").style.display = "flex";
  document.getElementById("uploadProgress").style.display    = "none";
  document.getElementById("editorError").style.display       = "none";
  editorModal.style.display = "flex";
  document.body.style.overflow = "hidden";
}

window.openEdit = (id) => {
  const a = articles.find(x => x.id === id);
  if (!a) return;
  editingId = id; uploadedUrl = a.imageUrl || null;
  document.getElementById("editorModalTitle").textContent  = "Editar Artigo";
  document.getElementById("editorSaveBtnText").textContent = "Salvar Alterações";
  document.getElementById("editingArticleId").value = id;
  document.getElementById("artTitle").value    = a.title    || "";
  document.getElementById("artCategory").value = a.category || "";
  document.getElementById("artStatus").value   = a.status   || "draft";
  document.getElementById("artContent").innerHTML = a.content || "";
  document.getElementById("artExcerpt").value  = a.excerpt  || "";
  document.getElementById("excerptCount").textContent = `${(a.excerpt||"").length}/160`;
  document.getElementById("editorError").style.display = "none";
  const preview = document.getElementById("imagePreview");
  if (a.imageUrl) {
    preview.src = a.imageUrl; preview.style.display = "block";
    document.getElementById("uploadPlaceholder").style.display = "none";
  } else {
    preview.style.display = "none";
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

// ── Cloudinary upload ──
async function handleImageFile(file) {
  if (file.size > 5 * 1024 * 1024) { alert("Máximo 5MB."); return; }
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
        progressText.textContent = pct + "%";
      }
    });
    xhr.addEventListener("load", () => {
      if (xhr.status === 200) {
        const data = JSON.parse(xhr.responseText);
        uploadedUrl = data.secure_url;
        preview.src = uploadedUrl;
        preview.style.display      = "block";
        progressWrap.style.display = "none";
        resolve(uploadedUrl);
      } else {
        progressText.textContent = "Erro no upload.";
        reject(new Error("Upload failed: " + xhr.responseText));
      }
    });
    xhr.addEventListener("error", () => { progressText.textContent = "Erro de rede."; reject(); });
    xhr.send(formData);
  });
}

// ── Save article ──
async function saveArticle() {
  const title   = document.getElementById("artTitle").value.trim();
  const content = document.getElementById("artContent").innerHTML.trim();
  const excerpt = document.getElementById("artExcerpt").value.trim();
  const cat     = document.getElementById("artCategory").value.trim();
  const status  = document.getElementById("artStatus").value;
  const errorEl = document.getElementById("editorError");

  if (!title)   { showEditorError("O título é obrigatório."); return; }
  if (!content || content === "<br>") { showEditorError("O conteúdo não pode estar vazio."); return; }

  errorEl.style.display = "none";
  const saveBtn = document.getElementById("editorSaveBtn");
  const saveTxt = document.getElementById("editorSaveBtnText");
  const saveSp  = document.getElementById("editorSpinner");
  saveBtn.disabled = true;
  saveTxt.style.display = "none";
  saveSp.style.display  = "flex";

  const data = {
    title, content, excerpt,
    category: cat,
    status,
    imageUrl:  uploadedUrl || null,
    updatedAt: serverTimestamp(),
  };

  try {
    if (editingId) {
      await updateDoc(doc(db, "articles", editingId), data);
      console.log("Article updated:", editingId);
    } else {
      const ref = await addDoc(collection(db, "articles"), {
        ...data,
        createdAt: serverTimestamp(),
      });
      console.log("Article created:", ref.id);
    }
    closeEditor();
    await fetchArticles();
  } catch (err) {
    console.error("saveArticle error:", err);
    showEditorError(`Erro ao salvar: ${err.message}`);
  } finally {
    saveBtn.disabled = false;
    saveTxt.style.display = "inline";
    saveSp.style.display  = "none";
  }
}

function showEditorError(msg) {
  const el = document.getElementById("editorError");
  el.textContent = msg;
  el.style.display = "block";
}

// ── Delete ──
function setupDeleteModal() {
  document.getElementById("deleteCancel")?.addEventListener("click", closeDelete);
  deleteModal?.addEventListener("click", (e) => { if (e.target === deleteModal) closeDelete(); });
  document.getElementById("deleteConfirm")?.addEventListener("click", confirmDelete);
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
  btn.disabled = true; txt.style.display = "none"; sp.style.display = "flex";
  try {
    await deleteDoc(doc(db, "articles", deletingId));
    closeDelete();
    await fetchArticles();
  } catch (err) {
    alert("Erro ao excluir: " + err.message);
  } finally {
    btn.disabled = false; txt.style.display = "inline"; sp.style.display = "none";
  }
}
