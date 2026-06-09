// ═══ CONTACT.JS ═══
import { db } from "./firebase-config.js";
import { collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// Auto-init when DOM is ready — não depende de nada externo
function setup() {
  const btn     = document.getElementById("cSubmit");
  const nameEl  = document.getElementById("cName");
  const cntEl   = document.getElementById("cContact");
  const msgEl   = document.getElementById("cMessage");
  const charEl  = document.getElementById("cMsgChar");
  const btnTxt  = document.getElementById("cSubmitText");
  const spinner = document.getElementById("cSpinner");
  const form    = document.getElementById("contactForm");
  const success = document.getElementById("cSuccess");
  const errEl   = document.getElementById("cError");

  if (!btn) { console.warn("contact.js: #cSubmit not found"); return; }

  // Contador de caracteres
  msgEl?.addEventListener("input", () => {
    if (charEl) charEl.textContent = `${msgEl.value.length} / 1000`;
  });

  btn.addEventListener("click", async () => {
    const name    = nameEl?.value.trim()  || "";
    const contact = cntEl?.value.trim()   || "";
    const message = msgEl?.value.trim()   || "";

    // Limpa erro anterior
    if (errEl) errEl.style.display = "none";

    // Validações
    if (!name)           { show("Por favor, informe seu nome."); return; }
    if (!message)        { show("A mensagem não pode estar vazia."); return; }
    if (message.length < 5) { show("Mensagem muito curta."); return; }

    // Loading
    btn.disabled = true;
    if (btnTxt)  btnTxt.style.display  = "none";
    if (spinner) spinner.style.display = "block";

    try {
      await addDoc(collection(db, "messages"), {
        name,
        contact: contact || null,
        message,
        read: false,
        createdAt: serverTimestamp(),
      });
      // Sucesso
      if (form)    form.style.display    = "none";
      if (success) success.style.display = "block";
      console.log("✅ Mensagem enviada!");
    } catch (err) {
      console.error("❌ Erro ao enviar mensagem:", err.code, err.message);
      show(`Erro: ${err.message}`);
    } finally {
      btn.disabled = false;
      if (btnTxt)  btnTxt.style.display  = "inline";
      if (spinner) spinner.style.display = "none";
    }
  });

  function show(msg) {
    if (!errEl) return;
    errEl.textContent   = msg;
    errEl.style.display = "block";
    errEl.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  console.log("✅ contact.js: form inicializado");
}

// Roda imediatamente — index.html já tem o DOM quando este módulo executa
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", setup);
} else {
  setup();
}

export function initContactForm() { /* mantido para compatibilidade */ }
