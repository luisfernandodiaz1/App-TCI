/* ============================================================
   FIREBASE-CONFIG.JS — Firebase Initialization
   ============================================================ */

// ── CONFIGURATION (Reemplazar con tus credenciales reales) ──
var firebaseConfig = {
    apiKey: "AIzaSyBVsrmyu5jokNkL6-D-ctgZlJM_Zp6FiMo",
    authDomain: "erp-logisticotci.firebaseapp.com",
    projectId: "erp-logisticotci",
    storageBucket: "erp-logisticotci.firebasestorage.app",
    messagingSenderId: "239499274495",
    appId: "1:239499274495:web:d3e43bf1ada818778a44ca",
    measurementId: "G-L1XEQQJ6TB"
};

// ── INITIALIZATION ──────────────────────────────────────────
// Se envuelve en try-catch para que la app no muera si la config es inválida
try {
    if (typeof firebase !== 'undefined' && !firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
        window.firebase_db = firebase.firestore();
        console.log('🛰️ Firebase Cloud configurado (Modo Híbrido).');
    }
} catch (e) {
    console.warn('⚠️ Error al inicializar Firebase. Operando solo en modo local.', e);
}
