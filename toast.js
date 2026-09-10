let stylesInjected = false;

function injectStyles() {
    if (stylesInjected) return;
    stylesInjected = true;
    const style = document.createElement("style");
    style.id = "crootjs-toast-style";
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
    max-width: 360px;
    padding: 12px 16px;
    border-radius: 8px;
    color: #fff;
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
.crootjs-toast-success { background-color: #17A962; }
.crootjs-toast-error { background-color: #E5484D; }
.crootjs-toast-warning { background-color: #F5A623; color: #111827; }
.crootjs-toast-info { background-color: #007AFF; }
`;
    document.head.appendChild(style);
}

function getContainer() {
    let el = document.getElementById("crootjs-toast-container");
    if (!el) {
        el = document.createElement("div");
        el.id = "crootjs-toast-container";
        el.className = "crootjs-toast-container";
        document.body.appendChild(el);
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
    el.textContent = message;
    container.appendChild(el);

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

    requestAnimationFrame(() => el.classList.add("crootjs-toast-visible"));

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
