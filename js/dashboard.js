// ═══ DASHBOARD.JS ═══
import { auth, db, CLOUDINARY_CLOUD_NAME, CLOUDINARY_UPLOAD_PRESET } from "./firebase-config.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  collection, addDoc, updateDoc, deleteDoc,
  doc, getDocs, query, orderBy, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// ── Auth guard ──
onAuthStateChanged(auth, (user) => {
  if (!user) { window.location.href = "login.html"; return; }
  document.getElementById("adminGreeting").textContent =
    `Bem-vindo de volta, ${user.displayName || user.email.split("@")[0]} 👋`;
  init();
});

// ── Logout ──
document.getElementById("logoutBtn").addEventListener("click", async () => {
  await signOut(auth);
  window.location.href = "login.html";
});

// ── State ──
let articles    = [];
let editingId   = null;
let uploadedUrl = null;
let deletingId  = null;

// ── DOM shortcuts ──
const tableBody   = document.getElementById("tableBody");
const editorModal = document.getElementById("editorModal");
const deleteModal = document.getElementById("deleteModal");

// ═══════════════════════════════════════════
// INIT
// ═══════════════════════════════════════════
async function init() {
  await fetchArticles();

  // New article buttons
  ["sideNewBtn","topNewBtn"].forEach(id =>
    document.getElementById(id)?.addEventListener("click", openCreate)
  );

  setupEditor();
  setupDeleteModal();
  setupSearch();
}

// ═══════════════════════════════════════════
// FETCH
// ═══════════════════════════════════════════
async function fetchArticles() {
  tableBody.innerHTML = `<tr class="table-empty"><td colspan="5">Carregando…</td></tr>`;
  try {
    const snap = await getDocs(
      query(collection(db, "articles"), orderBy("createdAt", "desc"))
    );
    articles = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderTable(articles);
    updateStats();
  } catch (err) {
    tableBody.innerHTML = `<tr class="table-empty"><td colspan="5">Erro ao carregar: ${err.message}</td></tr>`;
    console.error("fetchArticles:", err);
  }
}

function updateStats() {
  document.getElementById("statTotal").textContent     = articles.length;
  document.getElementById("statPublished").textContent = articles.filter(a => a.status === "published").length;
  document.getElementById("statDraft").textContent     = articles.filter(a => a.status !== "published").length;
}

function fmtDate(ts) {
  if (!ts) return "—";
  try {
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleDateString("pt-BR", { day:"2-digit", month:"short", year:"numeric" });
  } catch { return "—"; }
}

function renderTable(data) {
  if (!data.length) {
    tableBody.innerHTML = `<tr class="table-empty"><td colspan="5">Nenhum artigo ainda.</td></tr>`;
    return;
  }
  tableBody.innerHTML = data.map(a => `
    <tr>
      <td style="max-width:300px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">
        ${a.title || "<em style='opacity:.4'>Sem título</em>"}
      </td>
      <td>${a.category || "—"}</td>
      <td>
        <span class="badge badge-${a.status === "published" ? "published" : "draft"}">
          ${a.status === "published" ? "Publicado" : "Rascunho"}
        </span>
      </td>
      <td>${fmtDate(a.createdAt)}</td>
      <td>
        <div class="row-actions">
          <button class="row-btn" onclick="openEdit('${a.id}')">Editar</button>
          <a href="../artigo.html?id=${a.id}" target="_blank" class="row-btn">Ver</a>
          <button class="row-btn danger" onclick="openDelete('${a.id}')">Excluir</button>
        </div>
      </td>
    </tr>`).join("");
}

// ── Search ──
function setupSearch() {
  document.getElementById("searchInput")?.addEventListener("input", (e) => {
    const q = e.target.value.toLowerCase().trim();
    renderTable(q ? articles.filter(a =>
      (a.title || "").toLowerCase().includes(q) ||
      (a.category || "").toLowerCase().includes(q)
    ) : articles);
  });
}

// ═══════════════════════════════════════════
// EDITOR MODAL
// ═══════════════════════════════════════════
function setupEditor() {
  // Close
  document.getElementById("editorClose")?.addEventListener("click", closeEditor);
  document.getElementById("editorCancel")?.addEventListener("click", closeEditor);
  editorModal?.addEventListener("click", e => { if (e.target === editorModal) closeEditor(); });

  // Toolbar
  document.querySelectorAll(".t-btn").forEach(btn => {
    btn.addEventListener("mousedown", e => {
      e.preventDefault();
      const cmd = btn.dataset.cmd;
      const editor = document.getElementById("fContent");
      if      (cmd === "h2")         document.execCommand("formatBlock", false, "h2");
      else if (cmd === "h3")         document.execCommand("formatBlock", false, "h3");
      else if (cmd === "blockquote") document.execCommand("formatBlock", false, "blockquote");
      else if (cmd === "createLink") {
        const url = prompt("URL do link:");
        if (url) document.execCommand("createLink", false, url);
      }
      else document.execCommand(cmd, false, null);
      editor?.focus();
    });
  });

  // Image upload
  const zone      = document.getElementById("uploadZone");
  const fileInput = document.getElementById("fileInput");
  zone?.addEventListener("click",     () => fileInput?.click());
  zone?.addEventListener("dragover",  e => { e.preventDefault(); zone.style.borderColor = "var(--gold)"; });
  zone?.addEventListener("dragleave", () => zone.style.borderColor = "");
  zone?.addEventListener("drop", e => {
    e.preventDefault(); zone.style.borderColor = "";
    const f = e.dataTransfer.files[0];
    if (f?.type.startsWith("image/")) handleImage(f);
  });
  fileInput?.addEventListener("change", e => {
    if (e.target.files[0]) handleImage(e.target.files[0]);
  });

  // Excerpt counter
  document.getElementById("fExcerpt")?.addEventListener("input", e => {
    document.getElementById("excerptChar").textContent = `${e.target.value.length} / 160`;
  });

  // Save
  document.getElementById("editorSave")?.addEventListener("click", saveArticle);
}

function resetEditor() {
  document.getElementById("editingId").value  = "";
  document.getElementById("fTitle").value     = "";
  document.getElementById("fCategory").value  = "";
  document.getElementById("fStatus").value    = "published";
  document.getElementById("fContent").innerHTML = "";
  document.getElementById("fExcerpt").value   = "";
  document.getElementById("excerptChar").textContent = "0 / 160";
  document.getElementById("imgPreview").style.display    = "none";
  document.getElementById("imgPlaceholder").style.display = "flex";
  document.getElementById("uploadProgWrap").style.display = "none";
  document.getElementById("editorError").style.display   = "none";
  uploadedUrl = null;
}

function openCreate() {
  editingId = null;
  resetEditor();
  document.getElementById("editorModalTitle").textContent = "Novo Artigo";
  document.getElementById("editorSaveText").textContent   = "Publicar Artigo";
  editorModal.style.display = "flex";
  document.body.style.overflow = "hidden";
}

window.openEdit = (id) => {
  const a = articles.find(x => x.id === id);
  if (!a) return;
  editingId = id;
  uploadedUrl = a.imageUrl || null;
  resetEditor();
  document.getElementById("editorModalTitle").textContent = "Editar Artigo";
  document.getElementById("editorSaveText").textContent   = "Salvar Alterações";
  document.getElementById("editingId").value   = id;
  document.getElementById("fTitle").value      = a.title    || "";
  document.getElementById("fCategory").value   = a.category || "";
  document.getElementById("fStatus").value     = a.status   || "draft";
  document.getElementById("fContent").innerHTML = a.content || "";
  document.getElementById("fExcerpt").value    = a.excerpt  || "";
  document.getElementById("excerptChar").textContent = `${(a.excerpt||"").length} / 160`;
  if (a.imageUrl) {
    document.getElementById("imgPreview").src           = a.imageUrl;
    document.getElementById("imgPreview").style.display  = "block";
    document.getElementById("imgPlaceholder").style.display = "none";
  }
  editorModal.style.display = "flex";
  document.body.style.overflow = "hidden";
};

function closeEditor() {
  editorModal.style.display = "none";
  document.body.style.overflow = "";
}

// ── Cloudinary upload ──
async function handleImage(file) {
  if (file.size > 5 * 1024 * 1024) { alert("Imagem maior que 5MB."); return; }
  const wrap    = document.getElementById("uploadProgWrap");
  const fill    = document.getElementById("progFill");
  const txt     = document.getElementById("progTxt");
  const preview = document.getElementById("imgPreview");
  const ph      = document.getElementById("imgPlaceholder");

  ph.style.display      = "none";
  preview.style.display = "none";
  wrap.style.display    = "flex";
  txt.textContent = "Enviando…";

  const fd = new FormData();
  fd.append("file", file);
  fd.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);
  fd.append("folder", "henrique-siqueira");

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`);
    xhr.upload.addEventListener("progress", e => {
      if (e.lengthComputable) {
        const pct = Math.round((e.loaded / e.total) * 100);
        fill.style.width = pct + "%";
        txt.textContent  = pct + "%";
      }
    });
    xhr.addEventListener("load", () => {
      if (xhr.status === 200) {
        const data = JSON.parse(xhr.responseText);
        uploadedUrl       = data.secure_url;
        preview.src       = uploadedUrl;
        preview.style.display = "block";
        wrap.style.display    = "none";
        resolve(uploadedUrl);
      } else {
        txt.textContent = "Falha no upload.";
        console.error("Cloudinary error:", xhr.responseText);
        reject();
      }
    });
    xhr.addEventListener("error", () => { txt.textContent = "Erro de rede."; reject(); });
    xhr.send(fd);
  });
}

// ── Save ──
async function saveArticle() {
  const title   = document.getElementById("fTitle").value.trim();
  const content = document.getElementById("fContent").innerHTML.trim();
  const excerpt = document.getElementById("fExcerpt").value.trim();
  const cat     = document.getElementById("fCategory").value.trim();
  const status  = document.getElementById("fStatus").value;

  const errEl  = document.getElementById("editorError");
  const errMsg = document.getElementById("editorErrorMsg");

  function showErr(msg) { errMsg.textContent = msg; errEl.style.display = "flex"; }
  errEl.style.display = "none";

  if (!title)                       { showErr("O título é obrigatório."); return; }
  if (!content || content === "<br>") { showErr("O conteúdo não pode estar vazio."); return; }

  const saveBtn = document.getElementById("editorSave");
  const saveTxt = document.getElementById("editorSaveText");
  const saveSp  = document.getElementById("editorSpinner");
  saveBtn.disabled = true;
  saveTxt.style.display = "none";
  saveSp.style.display  = "block";

  const data = { title, content, excerpt, category: cat, status, imageUrl: uploadedUrl || null, updatedAt: serverTimestamp() };

  try {
    if (editingId) {
      await updateDoc(doc(db, "articles", editingId), data);
      console.log("✅ Artigo atualizado:", editingId);
    } else {
      const ref = await addDoc(collection(db, "articles"), { ...data, createdAt: serverTimestamp() });
      console.log("✅ Artigo criado:", ref.id);
    }
    closeEditor();
    await fetchArticles();
  } catch (err) {
    console.error("saveArticle:", err);
    showErr(`Erro ao salvar: ${err.message}`);
  } finally {
    saveBtn.disabled = false;
    saveTxt.style.display = "inline";
    saveSp.style.display  = "none";
  }
}

// ═══════════════════════════════════════════
// DELETE MODAL
// ═══════════════════════════════════════════
function setupDeleteModal() {
  document.getElementById("deleteClose")?.addEventListener("click",  closeDelete);
  document.getElementById("deleteCancel")?.addEventListener("click", closeDelete);
  deleteModal?.addEventListener("click", e => { if (e.target === deleteModal) closeDelete(); });
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
  const txt = document.getElementById("deleteText");
  const sp  = document.getElementById("deleteSpinner");
  btn.disabled = true; txt.style.display = "none"; sp.style.display = "block";
  try {
    await deleteDoc(doc(db, "articles", deletingId));
    console.log("🗑 Artigo excluído:", deletingId);
    closeDelete();
    await fetchArticles();
  } catch (err) {
    alert("Erro ao excluir: " + err.message);
    console.error(err);
  } finally {
    btn.disabled = false; txt.style.display = "inline"; sp.style.display = "none";
  }
}
