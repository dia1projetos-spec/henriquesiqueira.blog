// ═══════════════════════════════════════════
// FIREBASE CONFIG — henrique-siqueira
// ⚠️ Substitua com suas credenciais reais!
// ═══════════════════════════════════════════

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth }        from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore }   from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// ── Cole aqui as credenciais do seu projeto Firebase ──
const firebaseConfig = {
  apiKey:            "SUA_API_KEY",
  authDomain:        "SEU_PROJETO.firebaseapp.com",
  projectId:         "SEU_PROJETO",
  storageBucket:     "SEU_PROJETO.appspot.com",
  messagingSenderId: "SEU_SENDER_ID",
  appId:             "SEU_APP_ID",
};

const app  = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db   = getFirestore(app);

// ── Cloudinary config ──
// Substitua com seu cloud name e upload preset
export const CLOUDINARY_CLOUD_NAME  = "SEU_CLOUD_NAME";
export const CLOUDINARY_UPLOAD_PRESET = "SEU_UPLOAD_PRESET"; // unsigned preset
