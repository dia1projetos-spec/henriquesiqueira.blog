// ═══ DASHBOARD.JS ═══
import { auth, db, CLOUDINARY_CLOUD_NAME, CLOUDINARY_UPLOAD_PRESET } from "./firebase-config.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  collection, addDoc, updateDoc, deleteDoc, doc,
  getDocs, query, orderBy, serverTimestamp, setDoc, getDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// ── Auth guard ──
onAuthStateChanged(auth, (user) => {
  if (!user) { window.location.href = "login.html"; return; }
  document.getElementById("adminGreeting").textContent =
    `Bem-vindo de volta, ${user.displayName || user.email.split("@")[0]} 👋`;
  init();
});

document.getElementById("logoutBtn").addEventListener("click", async () => {
  await signOut(auth); window.location.href = "login.html";
});

// ── State ──
let articles = [], messages = [];
let editingId = null, uploadedUrl = null, deletingId = null;
let viewingMsgId = null;

// ═══════════════════════════════════════════
// TABS
// ═══════════════════════════════════════════
function setupTabs() {
  document.querySelectorAll(".s-link[data-tab]").forEach(link => {
    link.addEventListener("click", e => {
      e.preventDefault();
      const tab = link.dataset.tab;
      document.querySelectorAll(".s-link[data-tab]").forEach(l => l.classList.remove("active"));
      link.classList.add("active");
      document.getElementById("tabArticles").style.display  = tab === "articles"  ? "block" : "none";
      document.getElementById("tabMessages").style.display  = tab === "messages"  ? "block" : "none";
      document.getElementById("tabSlides").style.display    = tab === "slides"    ? "block" : "none";
      document.getElementById("tabSettings").style.display  = tab === "settings"  ? "block" : "none";
      document.getElementById("topNewBtn").style.display    = tab === "articles"  ? "flex"  : "none";
      if (tab === "messages") loadMessages();
      if (tab === "slides")   loadSlidesManager();
      if (tab === "settings") loadSettings();
    });
  });
}

// ═══════════════════════════════════════════
// INIT
// ═══════════════════════════════════════════
async function init() {
  setupTabs();
  await fetchArticles();
  document.getElementById("topNewBtn")?.addEventListener("click", openCreate);
  setupEditor();
  setupDeleteModal();
  setupSearch();
  setupMsgModal();
  countUnread();
}

// ═══════════════════════════════════════════
// ARTICLES
// ═══════════════════════════════════════════
async function fetchArticles() {
  const tbody = document.getElementById("tableBody");
  tbody.innerHTML = `<tr class="table-empty"><td colspan="5">Carregando…</td></tr>`;
  try {
    const snap = await getDocs(query(collection(db, "articles"), orderBy("createdAt", "desc")));
    articles = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderTable(articles);
    document.getElementById("statTotal").textContent     = articles.length;
    document.getElementById("statPublished").textContent = articles.filter(a => a.status === "published").length;
    document.getElementById("statDraft").textContent     = articles.filter(a => a.status !== "published").length;
  } catch (err) {
    tbody.innerHTML = `<tr class="table-empty"><td colspan="5">Erro: ${err.message}</td></tr>`;
    console.error(err);
  }
}

function fmtDate(ts) {
  if (!ts) return "—";
  try { const d = ts.toDate ? ts.toDate() : new Date(ts); return d.toLocaleDateString("pt-BR", { day:"2-digit", month:"short", year:"numeric" }); }
  catch { return "—"; }
}

function renderTable(data) {
  const tbody = document.getElementById("tableBody");
  if (!data.length) { tbody.innerHTML = `<tr class="table-empty"><td colspan="5">Nenhum artigo ainda.</td></tr>`; return; }
  tbody.innerHTML = data.map(a => `
    <tr>
      <td style="max-width:280px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${a.title || "<em style='opacity:.4'>Sem título</em>"}</td>
      <td>${a.category || "—"}</td>
      <td><span class="badge badge-${a.status === "published" ? "published" : "draft"}">${a.status === "published" ? "Publicado" : "Rascunho"}</span></td>
      <td>${fmtDate(a.createdAt)}</td>
      <td><div class="row-actions">
        <button class="row-btn" onclick="openEdit('${a.id}')">Editar</button>
        <a href="../artigo.html?id=${a.id}" target="_blank" class="row-btn">Ver</a>
        <button class="row-btn danger" onclick="openDelete('${a.id}')">Excluir</button>
      </div></td>
    </tr>`).join("");
}

function setupSearch() {
  document.getElementById("searchInput")?.addEventListener("input", e => {
    const q = e.target.value.toLowerCase().trim();
    renderTable(q ? articles.filter(a => (a.title||"").toLowerCase().includes(q) || (a.category||"").toLowerCase().includes(q)) : articles);
  });
}

// ═══════════════════════════════════════════
// MESSAGES
// ═══════════════════════════════════════════
async function countUnread() {
  try {
    const snap = await getDocs(collection(db, "messages"));
    const unread = snap.docs.filter(d => !d.data().read).length;
    const badge = document.getElementById("msgBadge");
    if (unread > 0) { badge.textContent = unread; badge.style.display = "inline-flex"; }
    else badge.style.display = "none";
  } catch {}
}

async function loadMessages() {
  const list = document.getElementById("messagesList");
  const countEl = document.getElementById("msgCount");
  list.innerHTML = `<div class="msg-empty"><div class="msg-empty-icon">📬</div>Carregando…</div>`;
  try {
    const snap = await getDocs(query(collection(db, "messages"), orderBy("createdAt", "desc")));
    messages = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    countEl.textContent = `${messages.length} mensagem${messages.length !== 1 ? "s" : ""}`;
    if (!messages.length) {
      list.innerHTML = `<div class="msg-empty"><div class="msg-empty-icon">📭</div>Nenhuma mensagem ainda.</div>`;
      return;
    }
    list.innerHTML = messages.map(m => `
      <div class="msg-card ${m.read ? "read" : "unread"}" onclick="openMsg('${m.id}')">
        <div class="msg-avatar">${(m.name||"?")[0].toUpperCase()}</div>
        <div class="msg-info">
          <div class="msg-name">${m.name || "Anônimo"}${m.contact ? ` <span style="color:var(--dark-400);font-size:.72rem">· ${m.contact}</span>` : ""}</div>
          <div class="msg-preview">${(m.message||"").slice(0, 90)}${(m.message||"").length > 90 ? "…" : ""}</div>
        </div>
        <div class="msg-date">${fmtDate(m.createdAt)}</div>
        <button class="msg-del-btn" onclick="event.stopPropagation();quickDeleteMsg('${m.id}')">Excluir</button>
      </div>`).join("");
  } catch (err) {
    list.innerHTML = `<div class="msg-empty">Erro ao carregar: ${err.message}</div>`;
  }
}

function setupMsgModal() {
  document.getElementById("msgModalClose")?.addEventListener("click",  closeMsgModal);
  document.getElementById("msgModalClose2")?.addEventListener("click", closeMsgModal);
  document.getElementById("msgModal")?.addEventListener("click", e => { if (e.target === document.getElementById("msgModal")) closeMsgModal(); });
  document.getElementById("msgDeleteBtn")?.addEventListener("click", deleteViewingMsg);
}

window.openMsg = async (id) => {
  const m = messages.find(x => x.id === id);
  if (!m) return;
  viewingMsgId = id;
  document.getElementById("msgDetailName").textContent    = m.name || "Anônimo";
  document.getElementById("msgDetailDate").textContent    = fmtDate(m.createdAt);
  document.getElementById("msgDetailBody").textContent    = m.message || "";
  const contactRow = document.getElementById("msgDetailContactRow");
  if (m.contact) { document.getElementById("msgDetailContact").textContent = m.contact; contactRow.style.display = "flex"; }
  else contactRow.style.display = "none";
  document.getElementById("msgModal").style.display = "flex";
  document.body.style.overflow = "hidden";
  // mark as read
  if (!m.read) {
    try { await updateDoc(doc(db, "messages", id), { read: true }); m.read = true; countUnread(); } catch {}
  }
};

function closeMsgModal() {
  document.getElementById("msgModal").style.display = "none";
  document.body.style.overflow = "";
  viewingMsgId = null;
}

async function deleteViewingMsg() {
  if (!viewingMsgId) return;
  const btn = document.getElementById("msgDeleteBtn");
  const txt = document.getElementById("msgDeleteText");
  const sp  = document.getElementById("msgDeleteSpinner");
  btn.disabled = true; txt.style.display = "none"; sp.style.display = "block";
  try {
    await deleteDoc(doc(db, "messages", viewingMsgId));
    closeMsgModal(); await loadMessages(); countUnread();
  } catch (err) { alert("Erro: " + err.message); }
  finally { btn.disabled = false; txt.style.display = "inline"; sp.style.display = "none"; }
}

window.quickDeleteMsg = async (id) => {
  if (!confirm("Excluir esta mensagem?")) return;
  try { await deleteDoc(doc(db, "messages", id)); await loadMessages(); countUnread(); }
  catch (err) { alert("Erro: " + err.message); }
};

// ═══════════════════════════════════════════
// SETTINGS — fotos
// ═══════════════════════════════════════════
async function loadSettings() {
  try {
    const snap = await getDoc(doc(db, "settings", "profile"));
    if (snap.exists()) {
      const data = snap.data();
      if (data.heroPhoto)   showSettingPreview("Hero",   data.heroPhoto);
      if (data.aboutPhoto)  showSettingPreview("About",  data.aboutPhoto);
      if (data.avatarPhoto) showSettingPreview("Avatar", data.avatarPhoto);
    }
  } catch (err) { console.error("loadSettings:", err); }
}

function showSettingPreview(key, url) {
  const img = document.getElementById(`preview${key}`);
  const ph  = document.getElementById(`placeholder${key}`);
  if (img && ph && url) { img.src = url; img.style.display = "block"; ph.style.display = "none"; }
}

function showFeedback(msg, type = "ok") {
  const el = document.getElementById("settingsFeedback");
  el.textContent = msg;
  el.className = `settings-feedback ${type}`;
  el.style.display = "block";
  setTimeout(() => el.style.display = "none", 3500);
}

function setupSettingUpload(inputId, key, previewKey) {
  document.getElementById(inputId)?.addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { showFeedback("Imagem maior que 5MB.", "err"); return; }
    const progWrap = document.getElementById(`prog${previewKey}Wrap`);
    const progFill = document.getElementById(`prog${previewKey}Fill`);
    const progTxt  = document.getElementById(`prog${previewKey}Txt`);
    progWrap.style.display = "flex"; progFill.style.width = "0%"; progTxt.textContent = "Enviando…";
    try {
      const url = await cloudinaryUpload(file, key, progFill, progTxt);
      await setDoc(doc(db, "settings", "profile"), { [key]: url }, { merge: true });
      showSettingPreview(previewKey, url);
      showFeedback("✓ Foto atualizada com sucesso!");
    } catch (err) {
      showFeedback("Erro no upload: " + err.message, "err");
    } finally {
      progWrap.style.display = "none";
    }
    e.target.value = "";
  });
}

function initSettings() {
  setupSettingUpload("fileHero",   "heroPhoto",   "Hero");
  setupSettingUpload("fileAbout",  "aboutPhoto",  "About");
  setupSettingUpload("fileAvatar", "avatarPhoto", "Avatar");
}

// ═══════════════════════════════════════════
// CLOUDINARY UPLOAD (genérico)
// ═══════════════════════════════════════════
function cloudinaryUpload(file, folder, fillEl, txtEl) {
  return new Promise((resolve, reject) => {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);
    fd.append("folder", `henrique-siqueira/${folder}`);
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`);
    xhr.upload.addEventListener("progress", e => {
      if (e.lengthComputable && fillEl && txtEl) {
        const p = Math.round((e.loaded / e.total) * 100);
        fillEl.style.width = p + "%"; txtEl.textContent = p + "%";
      }
    });
    xhr.addEventListener("load", () => {
      if (xhr.status === 200) { resolve(JSON.parse(xhr.responseText).secure_url); }
      else { console.error("Cloudinary error:", xhr.responseText); reject(new Error("Upload falhou")); }
    });
    xhr.addEventListener("error", () => reject(new Error("Erro de rede")));
    xhr.send(fd);
  });
}

// ═══════════════════════════════════════════
// EDITOR MODAL
// ═══════════════════════════════════════════
function setupEditor() {
  document.getElementById("editorClose")?.addEventListener("click",  closeEditor);
  document.getElementById("editorCancel")?.addEventListener("click", closeEditor);
  document.getElementById("editorModal")?.addEventListener("click", e => { if (e.target === document.getElementById("editorModal")) closeEditor(); });
  document.querySelectorAll(".t-btn").forEach(btn => {
    btn.addEventListener("mousedown", e => {
      e.preventDefault();
      const cmd = btn.dataset.cmd;
      if (cmd === "h2") document.execCommand("formatBlock", false, "h2");
      else if (cmd === "h3") document.execCommand("formatBlock", false, "h3");
      else if (cmd === "blockquote") document.execCommand("formatBlock", false, "blockquote");
      else if (cmd === "createLink") { const url = prompt("URL:"); if (url) document.execCommand("createLink", false, url); }
      else document.execCommand(cmd, false, null);
      document.getElementById("fContent")?.focus();
    });
  });
  const zone = document.getElementById("uploadZone");
  const fi   = document.getElementById("fileInput");
  zone?.addEventListener("click",     () => fi?.click());
  zone?.addEventListener("dragover",  e => { e.preventDefault(); zone.style.borderColor = "var(--gold)"; });
  zone?.addEventListener("dragleave", () => zone.style.borderColor = "");
  zone?.addEventListener("drop", e => {
    e.preventDefault(); zone.style.borderColor = "";
    const f = e.dataTransfer.files[0];
    if (f?.type.startsWith("image/")) handleCoverImage(f);
  });
  fi?.addEventListener("change", e => { if (e.target.files[0]) handleCoverImage(e.target.files[0]); });

  // Remover foto
  document.getElementById("imgRemoveBtn")?.addEventListener("click", (e) => {
    e.stopPropagation();
    uploadedUrl = null;
    showImagePreview(null);
    if (fi) fi.value = "";
  });

  // YouTube embed
  document.getElementById("youtubeBtn")?.addEventListener("mousedown", (e) => {
    e.preventDefault();
    const editor = document.getElementById("fContent");
    const raw = prompt("Cole a URL do vídeo do YouTube:");
    if (!raw) return;
    // Extrai o ID do vídeo de qualquer formato de URL do YouTube
    const match = raw.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([a-zA-Z0-9_-]{11})/);
    if (!match) { alert("URL inválida. Use um link do YouTube válido."); return; }
    const videoId = match[1];
    const embed = `<div class="yt-embed-wrap"><iframe src="https://www.youtube.com/embed/${videoId}" title="Vídeo do YouTube" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen loading="lazy"></iframe></div>`;
    // Insere no cursor ou no final
    editor.focus();
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0 && editor.contains(sel.anchorNode)) {
      const range = sel.getRangeAt(0);
      range.deleteContents();
      const div = document.createElement("div");
      div.innerHTML = embed;
      const frag = document.createDocumentFragment();
      let node;
      while ((node = div.firstChild)) frag.appendChild(node);
      range.insertNode(frag);
      // Move cursor para depois do embed
      range.collapse(false);
      sel.removeAllRanges();
      sel.addRange(range);
    } else {
      editor.innerHTML += embed;
    }
  });

  document.getElementById("fExcerpt")?.addEventListener("input", e => {
    document.getElementById("excerptChar").textContent = `${e.target.value.length} / 160`;
  });
  document.getElementById("editorSave")?.addEventListener("click", saveArticle);
}

function resetEditor(clearImage = true) {
  document.getElementById("editingId").value = "";
  document.getElementById("fTitle").value    = "";
  document.getElementById("fCategory").value = "";
  document.getElementById("fStatus").value   = "published";
  document.getElementById("fContent").innerHTML = "";
  document.getElementById("fExcerpt").value  = "";
  document.getElementById("excerptChar").textContent = "0 / 160";
  document.getElementById("uploadProgWrap").style.display = "none";
  document.getElementById("editorError").style.display   = "none";
  if (clearImage) {
    uploadedUrl = null;
    showImagePreview(null);
  }
}

function showImagePreview(url) {
  const wrap = document.getElementById("imgPreviewWrap");
  const ph   = document.getElementById("imgPlaceholder");
  const img  = document.getElementById("imgPreview");
  if (url) {
    img.src = url;
    wrap.style.display = "block";
    ph.style.display   = "none";
  } else {
    wrap.style.display = "none";
    ph.style.display   = "flex";
    img.src = "";
  }
}

function openCreate() {
  editingId = null;
  resetEditor(true);
  document.getElementById("editorModalTitle").textContent = "Novo Artigo";
  document.getElementById("editorSaveText").textContent   = "Publicar Artigo";
  document.getElementById("editorModal").style.display    = "flex";
  document.body.style.overflow = "hidden";
}

window.openEdit = (id) => {
  const a = articles.find(x => x.id === id);
  if (!a) return;
  editingId = id;
  uploadedUrl = a.imageUrl || null;
  resetEditor(false); // NÃO limpa a imagem — vamos restaurar logo abaixo
  document.getElementById("editorModalTitle").textContent = "Editar Artigo";
  document.getElementById("editorSaveText").textContent   = "Salvar Alterações";
  document.getElementById("editingId").value    = id;
  document.getElementById("fTitle").value       = a.title    || "";
  document.getElementById("fCategory").value    = a.category || "";
  document.getElementById("fStatus").value      = a.status   || "draft";
  document.getElementById("fContent").innerHTML = a.content  || "";
  document.getElementById("fExcerpt").value     = a.excerpt  || "";
  document.getElementById("excerptChar").textContent = `${(a.excerpt||"").length} / 160`;
  // Restaura imagem salva — sem precisar re-enviar
  showImagePreview(a.imageUrl || null);
  document.getElementById("editorModal").style.display = "flex";
  document.body.style.overflow = "hidden";
};

function closeEditor() {
  document.getElementById("editorModal").style.display = "none";
  document.body.style.overflow = "";
}

async function handleCoverImage(file) {
  if (file.size > 5 * 1024 * 1024) { alert("Máximo 5MB."); return; }
  const wrap = document.getElementById("uploadProgWrap");
  const fill = document.getElementById("progFill");
  const txt  = document.getElementById("progTxt");
  showImagePreview(null); // esconde preview enquanto sobe
  wrap.style.display = "flex"; fill.style.width = "0%"; txt.textContent = "Enviando…";
  try {
    const url = await cloudinaryUpload(file, "covers", fill, txt);
    uploadedUrl = url;
    wrap.style.display = "none";
    showImagePreview(url);
  } catch (err) { txt.textContent = "Erro no upload."; console.error(err); }
}

async function saveArticle() {
  const title   = document.getElementById("fTitle").value.trim();
  const content = document.getElementById("fContent").innerHTML.trim();
  const excerpt = document.getElementById("fExcerpt").value.trim();
  const cat     = document.getElementById("fCategory").value.trim();
  const status  = document.getElementById("fStatus").value;
  const errEl   = document.getElementById("editorError");
  const errMsg  = document.getElementById("editorErrorMsg");
  const showErr = m => { errMsg.textContent = m; errEl.style.display = "flex"; };
  errEl.style.display = "none";
  if (!title)   { showErr("O título é obrigatório."); return; }
  if (!content || content === "<br>") { showErr("O conteúdo não pode estar vazio."); return; }
  const saveBtn = document.getElementById("editorSave");
  const saveTxt = document.getElementById("editorSaveText");
  const saveSp  = document.getElementById("editorSpinner");
  saveBtn.disabled = true; saveTxt.style.display = "none"; saveSp.style.display = "block";
  const data = { title, content, excerpt, category: cat, status, imageUrl: uploadedUrl || null, updatedAt: serverTimestamp() };
  try {
    if (editingId) { await updateDoc(doc(db, "articles", editingId), data); }
    else { await addDoc(collection(db, "articles"), { ...data, createdAt: serverTimestamp() }); }
    closeEditor(); await fetchArticles();
  } catch (err) { showErr(`Erro ao salvar: ${err.message}`); console.error(err); }
  finally { saveBtn.disabled = false; saveTxt.style.display = "inline"; saveSp.style.display = "none"; }
}

// ═══════════════════════════════════════════
// DELETE ARTICLE
// ═══════════════════════════════════════════
function setupDeleteModal() {
  document.getElementById("deleteClose")?.addEventListener("click",  closeDelete);
  document.getElementById("deleteCancel")?.addEventListener("click", closeDelete);
  document.getElementById("deleteModal")?.addEventListener("click", e => { if (e.target === document.getElementById("deleteModal")) closeDelete(); });
  document.getElementById("deleteConfirm")?.addEventListener("click", confirmDelete);
}
window.openDelete = (id) => {
  deletingId = id;
  document.getElementById("deleteModal").style.display = "flex";
  document.body.style.overflow = "hidden";
};
function closeDelete() {
  document.getElementById("deleteModal").style.display = "none";
  document.body.style.overflow = ""; deletingId = null;
}
async function confirmDelete() {
  if (!deletingId) return;
  const btn = document.getElementById("deleteConfirm");
  const txt = document.getElementById("deleteText");
  const sp  = document.getElementById("deleteSpinner");
  btn.disabled = true; txt.style.display = "none"; sp.style.display = "block";
  try { await deleteDoc(doc(db, "articles", deletingId)); closeDelete(); await fetchArticles(); }
  catch (err) { alert("Erro: " + err.message); }
  finally { btn.disabled = false; txt.style.display = "inline"; sp.style.display = "none"; }
}


// ═══════════════════════════════════════════
// SLIDES MANAGER
// ═══════════════════════════════════════════
let slidesData = [];

async function loadSlidesManager() {
  const list  = document.getElementById("slidesList");
  const empty = document.getElementById("slidesEmpty");
  const count = document.getElementById("slideCount");
  if (!list) return;

  try {
    const snap = await getDoc(doc(db, "settings", "slides"));
    slidesData = (snap.exists() && Array.isArray(snap.data().items)) ? snap.data().items : [];
  } catch { slidesData = []; }

  renderSlidesList();

  // Upload zone
  const zone = document.getElementById("slideUploadZone");
  const fi   = document.getElementById("slideFileInput");
  if (zone && !zone.dataset.ready) {
    zone.dataset.ready = "1";
    zone.addEventListener("click", () => fi?.click());
    zone.addEventListener("dragover",  e => { e.preventDefault(); zone.style.borderColor="var(--gold)"; });
    zone.addEventListener("dragleave", () => zone.style.borderColor="");
    zone.addEventListener("drop", e => {
      e.preventDefault(); zone.style.borderColor="";
      const f = e.dataTransfer.files[0];
      if (f?.type.startsWith("image/")) uploadSlide(f);
    });
    fi?.addEventListener("change", e => { if(e.target.files[0]) uploadSlide(e.target.files[0]); fi.value=""; });
  }
}

function renderSlidesList() {
  const list  = document.getElementById("slidesList");
  const empty = document.getElementById("slidesEmpty");
  const count = document.getElementById("slideCount");
  if (!list) return;

  if (count) count.textContent = slidesData.length;

  if (!slidesData.length) {
    list.innerHTML = "";
    if (empty) { empty.style.display="block"; list.appendChild(empty); }
    return;
  }
  if (empty) empty.style.display = "none";

  list.innerHTML = slidesData.map((s, i) => `
    <div class="slide-item" data-index="${i}">
      <img src="${s.url}" alt="Slide ${i+1}" loading="lazy"/>
      <div class="slide-item-overlay">
        <button class="slide-del-btn" onclick="deleteSlide(${i})">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/></svg>
          Remover
        </button>
      </div>
      <div class="slide-order-badge">${i+1}</div>
    </div>`).join("");
}

async function uploadSlide(file) {
  if (file.size > 8*1024*1024) { alert("Máximo 8MB."); return; }
  const wrap = document.getElementById("slideProgWrap");
  const fill = document.getElementById("slideProgFill");
  const txt  = document.getElementById("slideProgTxt");
  if (wrap) { wrap.style.display="flex"; fill.style.width="0%"; txt.textContent="Enviando…"; }
  try {
    const url = await cloudinaryUpload(file, "slides", fill, txt);
    slidesData.push({ url, addedAt: new Date().toISOString() });
    await setDoc(doc(db, "settings", "slides"), { items: slidesData }, { merge: true });
    renderSlidesList();
    showSlideFeedback("✓ Slide adicionado!");
  } catch(err) {
    console.error("uploadSlide:", err);
    if(txt) txt.textContent = "Erro no upload.";
  } finally {
    setTimeout(() => { if(wrap) wrap.style.display="none"; }, 1500);
  }
}

window.deleteSlide = async (idx) => {
  if (!confirm("Remover este slide?")) return;
  slidesData.splice(idx, 1);
  try {
    await setDoc(doc(db, "settings", "slides"), { items: slidesData }, { merge: false });
    renderSlidesList();
    showSlideFeedback("Slide removido.");
  } catch(err) { alert("Erro: " + err.message); }
};

function showSlideFeedback(msg) {
  const el = document.getElementById("settingsFeedback");
  if (!el) return;
  el.textContent = msg; el.className = "settings-feedback ok";
  el.style.display = "block";
  setTimeout(() => el.style.display="none", 3000);
}

// Init settings listeners on load
initSettings();
