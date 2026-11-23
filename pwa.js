// Aplikasi web yang bisa dipasang dan tetap terbuka tanpa internet (PWA), dari sisi halaman.
// Pekerjaan cache-nya dilakukan service worker di domain situs Anda sendiri, yang memuat
// serviceworker.js CrootJS lewat importScripts (lihat docs/pwa.md): browser tidak mengizinkan
// service worker didaftarkan dari domain lain seperti jsDelivr.

const SKIP_WAITING = "crootjs-skip-waiting"; // harus sama dengan serviceworker.js

// beforeinstallprompt bisa datang sebelum installButton dipanggil, jadi ditangkap sejak modul dimuat.
let installEvent = null;
const installButtons = new Set();

function showInstallButtons() {
    for (const button of installButtons) button.hidden = !installEvent;
}

window.addEventListener("beforeinstallprompt", event => {
    // Tanpa preventDefault, Chrome bisa menampilkan ajakan pasangnya sendiri dan prompt() tidak bisa ditunda.
    event.preventDefault();
    installEvent = event;
    showInstallButtons();
});

window.addEventListener("appinstalled", () => {
    installEvent = null;
    showInstallButtons();
});

let stylesInjected = false;

function injectStyles() {
    if (stylesInjected || document.getElementById("crootjs-pwa-style")) return;
    stylesInjected = true;
    const style = document.createElement("style");
    style.id = "crootjs-pwa-style";
    style.textContent = `
.crootjs-pwa-update {
    position: fixed;
    left: 16px;
    right: 16px;
    bottom: 16px;
    z-index: 999998;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px 12px;
    max-width: 28rem;
    margin: 0 auto;
    padding: 12px 16px;
    border: 1px solid var(--croot-border, #d4dbe3);
    border-radius: var(--croot-radius, 8px);
    background-color: var(--croot-surface, #ffffff);
    color: var(--croot-text, #1e293b);
    font-family: var(--croot-font, system-ui, -apple-system, "Segoe UI", sans-serif);
    font-size: 15px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}
.crootjs-pwa-update p { flex: 1 1 12rem; margin: 0; }
.crootjs-pwa-update button { font: inherit; cursor: pointer; }
`;
    // Di awal <head> (sesudah style CrootJS lain): CSS halaman yang ditautkan sesudahnya menang tanpa !important.
    const previous = [...document.head.querySelectorAll('style[id^="crootjs-"]')].pop();
    if (previous) previous.after(style);
    else document.head.prepend(style);
}

// Pemberitahuan bawaan saat versi baru siap: teks dan tombol muat ulang.
function showUpdateNotice(update) {
    if (document.getElementById("crootjs-pwa-update")) return;
    injectStyles();
    const notice = document.createElement("div");
    notice.id = "crootjs-pwa-update";
    notice.className = "crootjs-pwa-update";
    notice.setAttribute("role", "status");
    const text = document.createElement("p");
    text.textContent = "Versi baru aplikasi siap.";
    const reload = document.createElement("button");
    reload.type = "button";
    reload.textContent = "Muat ulang";
    reload.addEventListener("click", () => {
        reload.disabled = true;
        update.activate();
    });
    const later = document.createElement("button");
    later.type = "button";
    later.className = "secondary";
    later.textContent = "Nanti";
    later.addEventListener("click", () => notice.remove());
    notice.append(text, reload, later);
    document.body.appendChild(notice);
}

// Mendaftarkan service worker situs Anda (file di domain sendiri, mis. "sw.js" di samping index.html).
// options (semua opsional):
//   scope     folder yang dikendalikan. Bawaan folder tempat file service worker berada.
//   onUpdate  function({ registration, activate }) saat versi baru sudah terpasang dan menunggu.
//             activate() mengaktifkan versi itu lalu memuat ulang halaman. Kalau tidak diisi,
//             tampil pemberitahuan bawaan dengan tombol "Muat ulang".
// Mengembalikan Promise { ok, registration, error } yang tidak pernah reject. error: "insecure"
// (bukan https/localhost), "unsupported" (browser tanpa service worker), atau "failed" (file
// tidak ditemukan atau error di dalamnya; detailnya di console).
export async function registerServiceWorker(url = "sw.js", options = {}) {
    const refuse = (error, message) => {
        console.warn(`registerServiceWorker: ${message}`);
        return { ok: false, registration: null, error };
    };
    if (!window.isSecureContext) return refuse("insecure", "service worker hanya jalan di https atau localhost; halaman tetap jalan tanpa mode offline.");
    if (!("serviceWorker" in navigator)) return refuse("unsupported", "browser ini tidak mendukung service worker.");

    let registration;
    try {
        registration = await navigator.serviceWorker.register(url, options.scope ? { scope: options.scope } : undefined);
    } catch (error) {
        return refuse("failed", `gagal mendaftarkan ${url}: ${error.message}`);
    }

    const onUpdate = typeof options.onUpdate === "function" ? options.onUpdate : showUpdateNotice;
    const announce = worker => {
        // Tanpa controller berarti ini pemasangan pertama, bukan pembaruan.
        if (!navigator.serviceWorker.controller) return;
        onUpdate({
            registration,
            activate() {
                navigator.serviceWorker.addEventListener("controllerchange", () => window.location.reload(), { once: true });
                worker.postMessage({ type: SKIP_WAITING });
            }
        });
    };
    if (registration.waiting) announce(registration.waiting);
    registration.addEventListener("updatefound", () => {
        const worker = registration.installing;
        worker.addEventListener("statechange", () => {
            if (worker.state === "installed") announce(worker);
        });
    });
    return { ok: true, registration, error: null };
}

// Memanggil callback(online) sekarang dan setiap kali koneksi putus atau tersambung lagi.
// online bernilai false hanya kalau perangkat benar-benar tanpa jaringan; tersambung ke Wi-Fi
// tanpa internet tetap dianggap online oleh browser.
// Mengembalikan function untuk berhenti mendengarkan.
export function onNetworkChange(callback) {
    const listener = event => callback(event.type === "online");
    window.addEventListener("online", listener);
    window.addEventListener("offline", listener);
    callback(navigator.onLine);
    return () => {
        window.removeEventListener("online", listener);
        window.removeEventListener("offline", listener);
    };
}

// true kalau halaman dibuka sebagai aplikasi terpasang (jendela sendiri, bukan tab browser).
export function isStandalone() {
    return ["standalone", "fullscreen", "minimal-ui"].some(mode => window.matchMedia(`(display-mode: ${mode})`).matches)
        || navigator.standalone === true; // Safari iOS memakai properti ini
}

// Tombol "Pasang aplikasi": disembunyikan (atribut hidden) dan hanya tampil saat browser
// menyatakan aplikasi bisa dipasang (event beforeinstallprompt; Chrome, Edge, Samsung Internet).
// Klik membuka dialog pasang browser. Firefox dan Safari tidak punya event ini, jadi tombolnya
// tetap tersembunyi; di sana pengguna memasang lewat menu browser.
// options.onChoice(outcome) dipanggil sesudah dialog ditutup: "accepted" atau "dismissed".
export function installButton(id, options = {}) {
    const button = document.getElementById(id);
    if (!button) {
        console.warn(`installButton: elemen #${id} tidak ditemukan.`);
        return;
    }
    installButtons.add(button);
    showInstallButtons();
    button.addEventListener("click", async () => {
        const event = installEvent;
        if (!event) return;
        // Satu event hanya boleh memanggil prompt() sekali.
        installEvent = null;
        showInstallButtons();
        event.prompt();
        const { outcome } = await event.userChoice;
        if (typeof options.onChoice === "function") options.onChoice(outcome);
    });
}
