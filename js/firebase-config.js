/* ============================================================
   FIREBASE-CONFIG.JS — Firebase Initialization
   ============================================================ */

// ── CONFIGURATION (Reemplazar con tus credenciales de la consola de Firebase) ──
const firebaseConfig = {
    apiKey: "TU_API_KEY_AQUI",
    authDomain: "TU_PROYECTO.firebaseapp.com",
    projectId: "TU_PROYECTO_ID",
    storageBucket: "TU_PROYECTO.appspot.com",
    messagingSenderId: "TU_SENDER_ID",
    appId: "TU_APP_ID"
};

// ── INITIALIZATION ──────────────────────────────────────────
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

const auth = firebase.auth();
const db = firebase.firestore();

// Persistencia de sesión local para que el login dure aunque cierren la pestaña
auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);

console.log('🔥 Firebase configurado y listo para la acción.');
