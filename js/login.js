// ═══ LOGIN.JS ═══
import { auth } from "./firebase-config.js";
import {
  signInWithEmailAndPassword,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

// Se já logado → dashboard
onAuthStateChanged(auth, (user) => {
  if (user) window.location.href = "dashboard.html";
});

const emailEl   = document.getElementById("email");
const passEl    = document.getElementById("password");
const loginBtn  = document.getElementById("loginBtn");
const btnText   = document.getElementById("loginBtnText");
const spinner   = document.getElementById("loginSpinner");
const errorBox  = document.getElementById("loginError");
const errorMsg  = document.getElementById("loginErrorMsg");

function showError(msg) {
  errorMsg.textContent = msg;
  errorBox.style.display = "flex";
}
function hideError() {
  errorBox.style.display = "none";
}
function setLoading(on) {
  loginBtn.disabled     = on;
  btnText.style.display = on ? "none" : "inline";
  spinner.style.display = on ? "block" : "none";
}

const errorMap = {
  "auth/invalid-credential":       "E-mail ou senha incorretos.",
  "auth/user-not-found":           "Usuário não encontrado.",
  "auth/wrong-password":           "Senha incorreta.",
  "auth/too-many-requests":        "Muitas tentativas. Aguarde alguns minutos.",
  "auth/network-request-failed":   "Sem conexão. Verifique sua internet.",
  "auth/invalid-email":            "E-mail inválido.",
};

async function doLogin() {
  const email = emailEl.value.trim();
  const pass  = passEl.value;
  hideError();
  if (!email || !pass) { showError("Preencha e-mail e senha."); return; }
  setLoading(true);
  try {
    await signInWithEmailAndPassword(auth, email, pass);
    window.location.href = "dashboard.html";
  } catch (err) {
    showError(errorMap[err.code] || `Erro: ${err.message}`);
    setLoading(false);
  }
}

loginBtn.addEventListener("click", doLogin);
passEl.addEventListener("keydown",  (e) => { if (e.key === "Enter") doLogin(); });
emailEl.addEventListener("keydown", (e) => { if (e.key === "Enter") passEl.focus(); });
