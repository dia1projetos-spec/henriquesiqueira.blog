// ═══ LOGIN.JS ═══
import { auth } from "../js/firebase-config.js";
import {
  signInWithEmailAndPassword,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

// If already logged in, redirect to dashboard
onAuthStateChanged(auth, (user) => {
  if (user) window.location.href = "dashboard.html";
});

const emailInput  = document.getElementById("email");
const passInput   = document.getElementById("password");
const loginBtn    = document.getElementById("loginBtn");
const loginBtnTxt = document.getElementById("loginBtnText");
const spinner     = document.getElementById("loginSpinner");
const errorEl     = document.getElementById("loginError");

function showError(msg) {
  errorEl.textContent = msg;
  errorEl.style.display = "block";
}

async function doLogin() {
  const email    = emailInput.value.trim();
  const password = passInput.value;

  if (!email || !password) { showError("Preencha e-mail e senha."); return; }

  errorEl.style.display = "none";
  loginBtn.disabled  = true;
  loginBtnTxt.style.display = "none";
  spinner.style.display     = "flex";

  try {
    await signInWithEmailAndPassword(auth, email, password);
    window.location.href = "dashboard.html";
  } catch (err) {
    const msgs = {
      "auth/invalid-credential":  "E-mail ou senha incorretos.",
      "auth/user-not-found":      "Usuário não encontrado.",
      "auth/wrong-password":      "Senha incorreta.",
      "auth/too-many-requests":   "Muitas tentativas. Tente mais tarde.",
      "auth/network-request-failed": "Erro de conexão. Verifique sua internet.",
    };
    showError(msgs[err.code] || "Erro ao fazer login. Tente novamente.");
    loginBtn.disabled = false;
    loginBtnTxt.style.display = "inline";
    spinner.style.display     = "none";
  }
}

loginBtn.addEventListener("click", doLogin);
passInput.addEventListener("keydown", (e) => { if (e.key === "Enter") doLogin(); });
emailInput.addEventListener("keydown", (e) => { if (e.key === "Enter") passInput.focus(); });
