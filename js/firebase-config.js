// ═══════════════════════════════════════════
// FIREBASE CONFIG — henrique-siqueira
// ═══════════════════════════════════════════

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth }        from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore }   from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey:            "AIzaSyCiOe4O76LqT-4YgSHolTUXtyWo1nKQxBM",
  authDomain:        "henrique-df586.firebaseapp.com",
  projectId:         "henrique-df586",
  storageBucket:     "henrique-df586.firebasestorage.app",
  messagingSenderId: "490225686815",
  appId:             "1:490225686815:web:8dadf8374d3d213711f82a",
};

const app  = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db   = getFirestore(app);

// ── Cloudinary config ──
export const CLOUDINARY_CLOUD_NAME    = "dc0bxgeea";
export const CLOUDINARY_UPLOAD_PRESET = "blog.henrique";
