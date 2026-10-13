// Modul tambahan untuk map.js: marker berbentuk pin, ikon gambar, atau elemen HTML sendiri.
// Sengaja tidak mengimpor map.js - petanya dijangkau lewat antarmuka yang dititipkan
// createMap() di elemennya (element.crootjsMap), supaya map.js tidak termuat dua kali.

const DRAG_THRESHOLD = 4; // piksel gerakan sebelum sebuah tekanan dianggap geser, bukan klik

// Pin bawaan. Warnanya mengikuti properti CSS `color` elemen marker (fill="currentColor").
const PIN = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 40" width="28" height="40" aria-hidden="true">'
    + '<path fill="currentColor" stroke="#fff" stroke-width="2" d="M14 1C6.8 1 1 6.8 1 14c0 9.4 13 25 13 25s13-15.6 13-25C27 6.8 21.2 1 14 1z"/>'
    + '<circle cx="14" cy="14" r="5" fill="#fff"/></svg>';

function injectStyles() {
    if (document.getElementById("crootjs-mapmarker-style")) return;
    const style = document.createElement("style");
    style.id = "crootjs-mapmarker-style";
    style.textContent = `
.crootjs-marker {
    position: absolute;
    left: 0;
    top: 0;
    color: #dc2626;
    line-height: 0;
    cursor: pointer;
    touch-action: none;
    user-select: none;
    -webkit-user-select: none;
}
.crootjs-marker:focus-visible { outline: 2px solid #2563eb; outline-offset: 2px; }
.crootjs-marker-draggable { cursor: grab; }
.crootjs-marker-dragging { cursor: grabbing; }
.crootjs-marker > img,
.crootjs-marker > svg {
    display: block;
    max-width: none;
    max-height: none;
    margin: 0;
    padding: 0;
    border: 0;
    filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.4));
}
.crootjs-marker-label {
    position: absolute;
    left: 50%;
    top: 100%;
    transform: translateX(-50%);
    margin-top: 2px;
    white-space: nowrap;
    font: 600 12px/1.3 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    color: #1f2937;
    text-shadow: 0 0 2px #fff, 0 0 2px #fff, 0 0 3px #fff, 0 0 3px #fff;
    pointer-events: none;
}
`;
    document.head.appendChild(style);
}

function mapOf(id) {
    const container = document.getElementById(id);
    const map = container ? container.crootjsMap : null;
    if (!map) console.warn(`Peta dengan ID "${id}" belum dibuat. Panggil createMap("${id}") dari map.js lebih dulu.`);
    return map;
}

// Menaruh marker di position [lng, lat] pada peta ber-ID `id`.
// options (semua opsional):
//   color      warna pin bawaan. Default merah.
//   icon       URL gambar sebagai pengganti pin
//   size       [lebar, tinggi] gambar icon dalam piksel. Default [32, 32].
//   element    elemen DOM buatan sendiri sebagai pengganti pin/icon
//   anchor     bagian marker yang menempel di posisinya: "bottom" (default, ujung bawah
//              di tengah - cocok untuk pin) atau "center" (cocok untuk ikon bulat)
//   label      teks yang selalu tampil di bawah marker
//   title      teks bantuan saat kursor berada di atas marker
//   popup      teks atau elemen DOM yang ditampilkan saat marker diklik
//   onClick    function (position) yang dipanggil saat marker diklik
//   draggable  true = marker bisa digeser dengan mouse atau jari
//   onDragEnd  function (position) yang dipanggil setelah marker selesai digeser
// Mengembalikan { getPosition(), setPosition(position), remove() }.
export function addMarker(id, position, options = {}) {
    let current = [position[0], position[1]];
    const map = mapOf(id);
    if (!map) {
        return { getPosition: () => current.slice(), setPosition: () => {}, remove: () => {} };
    }
    injectStyles();

    const centered = options.anchor === "center";
    const interactive = Boolean(options.popup || options.onClick || options.draggable);
    const element = document.createElement("div");
    element.className = "crootjs-marker" + (options.draggable ? " crootjs-marker-draggable" : "");
    if (options.color) element.style.color = options.color;
    if (options.title) element.title = options.title;
    if (interactive) {
        element.tabIndex = 0;
        element.setAttribute("role", "button");
        element.setAttribute("aria-label", options.title || options.label || "Marker");
    }

    if (options.element instanceof Node) {
        element.appendChild(options.element);
    } else if (options.icon) {
        const size = Array.isArray(options.size) ? options.size : [32, 32];
        const img = document.createElement("img");
        img.src = options.icon;
        img.alt = "";
        img.draggable = false;
        img.style.width = size[0] + "px";
        img.style.height = size[1] + "px";
        element.appendChild(img);
    } else {
        element.innerHTML = PIN;
    }
    if (options.label) {
        const label = document.createElement("span");
        label.className = "crootjs-marker-label";
        label.textContent = options.label;
        element.appendChild(label);
    }

    // Dipanggil ulang setiap kali peta bergerak, supaya marker tetap di posisinya.
    const place = () => {
        const point = map.toPoint(current);
        element.style.transform = `translate(${Math.round(point[0])}px, ${Math.round(point[1])}px) translate(-50%, ${centered ? "-50%" : "-100%"})`;
    };
    map.overlay.appendChild(element);
    place();
    const stopFollowing = map.onMove(place);

    const click = () => {
        if (options.popup) {
            // Popup muncul di atas marker: jaraknya dari titik jangkar setinggi marker itu.
            map.showPopup(current, options.popup, centered ? element.offsetHeight / 2 : element.offsetHeight);
        }
        if (typeof options.onClick === "function") options.onClick(current.slice());
    };

    let start = null;
    let last = null;
    let grab = null;
    let moved = false;
    const pointOf = event => {
        const rect = map.overlay.getBoundingClientRect();
        return [event.clientX - rect.left, event.clientY - rect.top];
    };

    element.addEventListener("pointerdown", event => {
        if (event.pointerType === "mouse" && event.button !== 0) return;
        // Tekanan pada marker milik marker: peta tidak menganggapnya klik atau awal geseran.
        event.stopPropagation();
        start = pointOf(event);
        last = start;
        moved = false;
        const anchor = map.toPoint(current);
        grab = [start[0] - anchor[0], start[1] - anchor[1]];
        try {
            element.setPointerCapture(event.pointerId);
        } catch (captureError) {
            // pointer sudah tidak aktif; geseran tetap jalan selama pointer masih di atas marker
        }
    });

    element.addEventListener("pointermove", event => {
        if (!start) return;
        const point = pointOf(event);
        if (!moved && Math.hypot(point[0] - start[0], point[1] - start[1]) < DRAG_THRESHOLD) return;
        moved = true;
        if (options.draggable) {
            element.classList.add("crootjs-marker-dragging");
            current = map.toPosition([point[0] - grab[0], point[1] - grab[1]]);
            place();
        } else {
            // Marker yang tidak bisa digeser meneruskan geserannya ke peta. Tanpa ini, peta
            // yang penuh marker sulit digeser karena jari hampir selalu mendarat di marker.
            map.panBy(point[0] - last[0], point[1] - last[1]);
        }
        last = point;
    });

    const release = event => {
        if (!start) return;
        start = null;
        element.classList.remove("crootjs-marker-dragging");
        if (event.type !== "pointerup") return;
        if (!moved) {
            click();
        } else if (options.draggable && typeof options.onDragEnd === "function") {
            options.onDragEnd(current.slice());
        }
    };
    element.addEventListener("pointerup", release);
    element.addEventListener("pointercancel", release);
    // Klik ganda pada marker tidak ikut men-zoom peta.
    element.addEventListener("dblclick", event => event.stopPropagation());
    element.addEventListener("keydown", event => {
        if (!interactive || (event.key !== "Enter" && event.key !== " ")) return;
        event.preventDefault();
        event.stopPropagation();
        click();
    });

    return {
        getPosition: () => current.slice(),
        setPosition: next => {
            current = [next[0], next[1]];
            place();
        },
        remove: () => {
            stopFollowing();
            element.remove();
        }
    };
}
