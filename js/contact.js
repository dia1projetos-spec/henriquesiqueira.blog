// ═══ CONTACT.JS ═══
import { db } from "./firebase-config.js";
import { collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

export function initContactForm() {
  const form    = document.getElementById("contactForm");
  if (!form) return;
  const nameEl  = document.getElementById("cName");
  const cntEl   = document.getElementById("cContact");
  const msgEl   = document.getElementById("cMessage");
  const charEl  = document.getElementById("cMsgChar");
  const btn     = document.getElementById("cSubmit");
  const btnTxt  = document.getElementById("cSubmitText");
  const spinner = document.getElementById("cSpinner");
  const success = document.getElementById("cSuccess");
  const errEl   = document.getElementById("cError");

  msgEl?.addEventListener("input", () => {
    if (charEl) charEl.textContent = `${msgEl.value.length} / 1000`;
  });

  btn?.addEventListener("click", async () => {
    const name    = nameEl?.value.trim();
    const contact = cntEl?.value.trim();
    const message = msgEl?.value.trim();

    errEl.style.display = "none";
    if (!name)    { showErr("Por favor, informe seu nome."); return; }
    if (!message) { showErr("A mensagem não pode estar vazia."); return; }
    if (message.length < 10) { showErr("Mensagem muito curta."); return; }

    btn.disabled = true;
    btnTxt.style.display = "none";
    spinner.style.display = "block";

    try {
      await addDoc(collection(db, "messages"), {
        name, contact: contact || null, message,
        read: false,
        createdAt: serverTimestamp(),
      });
      form.style.display = "none";
      success.style.display = "block";
    } catch (err) {
      showErr("Erro ao enviar. Tente novamente.");
      console.error(err);
    } finally {
      btn.disabled = false;
      btnTxt.style.display = "inline";
      spinner.style.display = "none";
    }

    function showErr(msg) {
      errEl.textContent = msg;
      errEl.style.display = "block";
    }
  });
}
