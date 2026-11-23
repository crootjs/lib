function injectStyles() {
    if (document.getElementById("crootjs-toast-style")) return;
    const style = document.createElement("style");
    style.id = "crootjs-toast-style";
    // Warna dari variabel croot.css (kontras AA, ikut mode gelap); nilai cadangannya warna terang croot.css.
    style.textContent = `
.crootjs-toast-container {
    position: fixed;
    top: 16px;
    right: 16px;
    z-index: 999999;
    display: flex;
    flex-direction: column;
    gap: 8px;
    pointer-events: none;
}
.crootjs-toast {
    min-width: 240px;
    max-width: min(360px, calc(100vw - 32px));
    padding: 12px 16px;
    border-radius: 8px;
    color: var(--croot-accent-text, #fff);
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    font-size: 14px;
    line-height: 1.4;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    opacity: 0;
    transform: translateX(16px);
    transition: opacity 200ms ease, transform 200ms ease;
    pointer-events: auto;
}
.crootjs-toast-visible {
    opacity: 1;
    transform: translateX(0);
}
.crootjs-toast-success { background-color: var(--croot-success, #15803d); }
.crootjs-toast-error { background-color: var(--croot-danger, #b91c1c); }
.crootjs-toast-warning { background-color: var(--croot-warning, #a16207); }
.crootjs-toast-info { background-color: var(--croot-info, #1d4ed8); }
@media (prefers-reduced-motion: reduce) {
    .crootjs-toast { transition: none; transform: none; }
}
`;
    // Di awal <head>, supaya CSS proyek bisa menimpanya tanpa selektor yang lebih spesifik.
    const previous = [...document.head.querySelectorAll('style[id^="crootjs-"]')].pop();
    if (previous) previous.after(style);
    else document.head.prepend(style);
}

// Live region yang baru dibuat belum dipantau pembaca layar, jadi isi yang langsung masuk tidak
// dibacakan. Selama 100 ms pertama toast diantrekan di Promise ini (urutannya tetap).
let containerReady = null;

// Wadahnya sekaligus live region: pembaca layar membacakan setiap toast yang ditambahkan.
function getContainer() {
    let el = document.getElementById("crootjs-toast-container");
    if (!el) {
        el = document.createElement("div");
        el.id = "crootjs-toast-container";
        el.className = "crootjs-toast-container";
        el.setAttribute("aria-live", "polite");
        document.body.appendChild(el);
        const ready = new Promise((resolve) => setTimeout(resolve, 100));
        containerReady = ready;
        ready.then(() => {
            if (containerReady === ready) containerReady = null;
        });
    }
    return el;
}

// Menampilkan notifikasi toast. type: "info" (default) | "success" | "error" | "warning".
// duration dalam ms; 0 berarti tidak otomatis hilang (dismiss manual lewat function yang dikembalikan).
// Mengembalikan function dismiss() untuk menutup toast ini secara manual kapan saja.
export function toast(message, type = "info", duration = 3000) {
    injectStyles();
    const container = getContainer();

    const el = document.createElement("div");
    el.className = `crootjs-toast crootjs-toast-${type}`;
    // Galat dibacakan segera, memotong apa pun yang sedang dibacakan.
    if (type === "error") el.setAttribute("role", "alert");
    el.textContent = message;
    const show = () => {
        container.appendChild(el);
        requestAnimationFrame(() => { if (!dismissed) el.classList.add("crootjs-toast-visible"); });
    };
    if (containerReady) containerReady.then(show);
    else show();

    let dismissed = false;
    function dismiss() {
        if (dismissed) return;
        dismissed = true;
        el.classList.remove("crootjs-toast-visible");
        let removed = false;
        const remove = () => {
            if (removed) return;
            removed = true;
            el.remove();
        };
        el.addEventListener("transitionend", remove, { once: true });
        setTimeout(remove, 250); // fallback in case transitionend never fires (e.g. prefers-reduced-motion)
    }

    if (duration > 0) {
        setTimeout(dismiss, duration);
    }

    return dismiss;
}

export function toastSuccess(message, duration) {
    return toast(message, "success", duration);
}

export function toastError(message, duration) {
    return toast(message, "error", duration);
}

export function toastWarning(message, duration) {
    return toast(message, "warning", duration);
}

export function toastInfo(message, duration) {
    return toast(message, "info", duration);
}
