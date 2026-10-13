// Modul tambahan untuk map.js: skala peta dan "lokasi saya".
// Sengaja tidak mengimpor map.js - petanya dijangkau lewat antarmuka yang dititipkan
// createMap() di elemennya (element.crootjsMap), supaya map.js tidak termuat dua kali.

const EQUATOR = 40075016.686; // keliling bumi di khatulistiwa (meter), dasar ukuran tile Web Mercator
const LOCATE_TIMEOUT_MS = 15000;

const LOCATE_ICON = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">'
    + '<circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2" fill="currentColor"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/></svg>';

const locations = new WeakMap(); // lapisan overlay sebuah peta -> penanda lokasinya

function injectStyles() {
    if (document.getElementById("crootjs-mapcontrol-style")) return;
    const style = document.createElement("style");
    style.id = "crootjs-mapcontrol-style";
    style.textContent = `
.crootjs-map-scale {
    box-sizing: border-box;
    min-width: 30px;
    padding: 0 4px 1px;
    border: 2px solid #374151;
    border-top: 0;
    background-color: rgba(255, 255, 255, 0.75);
    color: #1f2937;
    font: 11px/1.3 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    text-align: center;
    white-space: nowrap;
}
.crootjs-map button.crootjs-map-button {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    min-width: 0;
    height: 32px;
    margin: 0;
    padding: 0;
    border: 0;
    border-radius: 6px;
    background-color: #fff;
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.3);
    color: #1f2937;
    cursor: pointer;
}
.crootjs-map button.crootjs-map-button:hover { background-color: #f3f4f6; }
.crootjs-map button.crootjs-map-button:disabled { color: #9ca3af; cursor: progress; }
.crootjs-map-location {
    position: absolute;
    left: 0;
    top: 0;
    pointer-events: none;
}
.crootjs-map-location-accuracy {
    position: absolute;
    left: 0;
    top: 0;
    border-radius: 50%;
    background-color: rgba(37, 99, 235, 0.15);
    border: 1px solid rgba(37, 99, 235, 0.4);
    box-sizing: border-box;
    transform: translate(-50%, -50%);
}
.crootjs-map-location-dot {
    position: absolute;
    left: 0;
    top: 0;
    width: 14px;
    height: 14px;
    border: 3px solid #fff;
    border-radius: 50%;
    background-color: #2563eb;
    box-shadow: 0 0 4px rgba(0, 0, 0, 0.4);
    box-sizing: content-box;
    transform: translate(-50%, -50%);
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

// Panjang satu piksel peta di lapangan (meter) pada sebuah lintang dan zoom. Di proyeksi
// Web Mercator skalanya berubah menurut lintang, jadi lintangnya ikut dihitung.
function metersPerPixel(latitude, zoom) {
    return EQUATOR * Math.cos(latitude * Math.PI / 180) / (256 * Math.pow(2, zoom));
}

// Menampilkan garis skala ("100 m", "2 km") yang ikut berubah saat peta di-zoom.
// corner: "bottom-left" (bawaan), "bottom-right", "top-left", atau "top-right".
// Mengembalikan function remove() untuk mencabutnya.
export function addScaleBar(id, corner = "bottom-left") {
    const map = mapOf(id);
    if (!map) return () => {};
    injectStyles();

    const bar = document.createElement("div");
    bar.className = "crootjs-map-scale";
    const update = view => {
        const scale = metersPerPixel(view.center[1], view.zoom);
        // Angka bulat terbesar (1, 2, atau 5 kali pangkat sepuluh) yang garisnya muat di 100 piksel.
        const widest = scale * 100;
        const magnitude = Math.pow(10, Math.floor(Math.log10(widest)));
        const meters = [5, 2, 1].find(step => step * magnitude <= widest) * magnitude;
        bar.style.width = Math.round(meters / scale) + "px";
        bar.textContent = meters >= 1000 ? (meters / 1000) + " km" : meters + " m";
    };
    update(map.getView());
    const stopFollowing = map.onMove(update);
    const removeControl = map.addControl(bar, corner);

    return function remove() {
        stopFollowing();
        removeControl();
    };
}

// Menggambar penanda lokasi (titik biru + lingkaran ketelitian) di peta. Satu peta hanya
// punya satu penanda; pemanggilan berikutnya memindahkannya.
function showLocation(map, position, accuracy) {
    injectStyles();
    let location = locations.get(map.overlay);
    if (!location) {
        const element = document.createElement("div");
        element.className = "crootjs-map-location";
        const circle = document.createElement("div");
        circle.className = "crootjs-map-location-accuracy";
        const dot = document.createElement("div");
        dot.className = "crootjs-map-location-dot";
        element.append(circle, dot);
        map.overlay.appendChild(element);

        location = { element, circle, position, accuracy };
        location.place = view => {
            const point = map.toPoint(location.position);
            // Lingkaran ketelitian berukuran meter, jadi ukurannya di layar ikut zoom.
            const diameter = 2 * location.accuracy / metersPerPixel(location.position[1], view.zoom);
            element.style.transform = `translate(${Math.round(point[0])}px, ${Math.round(point[1])}px)`;
            circle.style.width = diameter + "px";
            circle.style.height = diameter + "px";
        };
        map.onMove(location.place);
        locations.set(map.overlay, location);
    }
    location.position = position;
    location.accuracy = accuracy;
    location.place(map.getView());
}

// Menanyakan lokasi perangkat ke browser (sekali), menandainya di peta, dan memindahkan
// tampilan ke sana. Browser hanya mengizinkan ini di halaman HTTPS (atau localhost), dan
// user harus menyetujui permintaan izinnya.
// responseFunction (opsional) dipanggil dengan { position: [lng, lat], accuracy } -
// accuracy dalam meter - atau null kalau lokasinya tidak didapat (izin ditolak, perangkat
// tidak mendukung, atau lewat 15 detik).
export function locateUser(id, responseFunction) {
    const map = mapOf(id);
    const respond = result => {
        if (typeof responseFunction === "function") responseFunction(result);
    };
    if (!map || !navigator.geolocation) {
        respond(null);
        return;
    }

    navigator.geolocation.getCurrentPosition(
        result => {
            const position = [result.coords.longitude, result.coords.latitude];
            showLocation(map, position, result.coords.accuracy);
            // Kalau peta sedang jauh, dekatkan; kalau sudah dekat, zoom-nya dibiarkan.
            map.setView(position, Math.max(map.getView().zoom, 16));
            respond({ position, accuracy: result.coords.accuracy });
        },
        error => {
            console.log("error", error);
            respond(null);
        },
        { enableHighAccuracy: true, timeout: LOCATE_TIMEOUT_MS }
    );
}

// Menambahkan tombol "lokasi saya" ke peta. Saat diklik, tombol memanggil locateUser()
// dengan responseFunction yang sama.
// corner: "top-left" (bawaan, di bawah tombol zoom), "top-right", "bottom-left", atau "bottom-right".
// Mengembalikan function remove() untuk mencabut tombolnya.
export function addLocateButton(id, responseFunction, corner = "top-left") {
    const map = mapOf(id);
    if (!map) return () => {};
    injectStyles();

    const button = document.createElement("button");
    button.type = "button";
    button.className = "crootjs-map-button";
    button.setAttribute("aria-label", "Lokasi saya");
    button.title = "Lokasi saya";
    button.innerHTML = LOCATE_ICON;
    button.addEventListener("click", () => {
        // Dinonaktifkan selama menunggu, supaya klik berulang tidak menumpuk permintaan.
        button.disabled = true;
        locateUser(id, result => {
            button.disabled = false;
            if (typeof responseFunction === "function") responseFunction(result);
        });
    });
    return map.addControl(button, corner);
}
