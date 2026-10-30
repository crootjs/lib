// Modul tambahan untuk map.js: skala peta, "lokasi saya", live tracking, panel pilihan peta
// dasar dan lapisan, tampilan koordinat, dan layar penuh.
// Sengaja tidak mengimpor map.js - petanya dijangkau lewat antarmuka yang dititipkan
// createMap() di elemennya (element.crootjsMap), supaya map.js tidak termuat dua kali.

const EQUATOR = 40075016.686; // keliling bumi di khatulistiwa (meter), dasar ukuran tile Web Mercator
const LOCATE_TIMEOUT_MS = 15000;

const LOCATE_ICON = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">'
    + '<circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2" fill="currentColor"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/></svg>';

const TRACK_ICON = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" aria-hidden="true">'
    + '<path d="M3 11l18-8-8 18-2-8z"/></svg>';

const LAYERS_ICON = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" aria-hidden="true">'
    + '<path d="M12 3l9 5-9 5-9-5z"/><path d="M3 13l9 5 9-5"/></svg>';

const FULLSCREEN_ICON = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">'
    + '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>';

const EXIT_FULLSCREEN_ICON = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">'
    + '<path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5"/></svg>';

const COPY_ICON = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" aria-hidden="true">'
    + '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/></svg>';

let panelCount = 0; // untuk nama grup radio yang unik per halaman

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
.crootjs-map button.crootjs-map-button-active { color: #2563eb; }
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
.crootjs-map-panel {
    box-sizing: border-box;
    min-width: 140px;
    max-width: 240px;
    max-height: 60vh;
    overflow-y: auto;
    padding: 6px 10px;
    border-radius: 6px;
    background-color: #fff;
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.3);
    color: #1f2937;
    font: 13px/1.4 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}
.crootjs-map-panel[hidden] { display: none; }
.crootjs-map-panel-title { margin: 2px 0 4px; font-weight: 600; }
.crootjs-map-panel label {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 2px 0;
    cursor: pointer;
}
.crootjs-map-panel input { margin: 0; }
.crootjs-map-coordinates {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 2px 4px 2px 8px;
    border-radius: 4px;
    background-color: rgba(255, 255, 255, 0.85);
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.25);
    color: #1f2937;
    font: 12px/1.4 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    white-space: pre;
    user-select: text;
    -webkit-user-select: text;
}
.crootjs-map button.crootjs-map-copy {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    min-width: 0;
    height: 22px;
    margin: 0;
    padding: 0;
    border: 0;
    border-radius: 3px;
    background: none;
    color: #4b5563;
    font: 11px/1 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    cursor: pointer;
}
.crootjs-map button.crootjs-map-copy:hover { background-color: #e5e7eb; color: #111827; }
.crootjs-map button.crootjs-map-copy[hidden] { display: none; }
/* Layar penuh tiruan, untuk browser tanpa Fullscreen API (Safari di iPhone). */
.crootjs-map-fullscreen {
    position: fixed !important;
    inset: 0 !important;
    z-index: 2147483000 !important;
    width: auto !important;
    height: auto !important;
    max-width: none !important;
    max-height: none !important;
    margin: 0 !important;
    border-radius: 0 !important;
}
.crootjs-map-panel-group + .crootjs-map-panel-group { margin-top: 6px; padding-top: 6px; border-top: 1px solid #e5e7eb; }
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

// Mengikuti lokasi perangkat terus-menerus (live tracking): penanda lokasi di peta ikut
// berpindah setiap kali browser melaporkan posisi baru, sampai stop() dipanggil.
// responseFunction (opsional) dipanggil di setiap pembaruan dengan
// { position: [lng, lat], accuracy, speed, heading, timestamp } - accuracy dalam meter,
// speed dalam meter/detik dan heading dalam derajat dari utara (keduanya null kalau
// perangkat tidak melaporkannya), timestamp dalam milidetik.
// Kalau izin lokasi ditolak atau perangkat tidak mendukung, responseFunction dipanggil
// sekali dengan null dan pelacakan berhenti. Gangguan sementara (sinyal hilang) tidak
// menghentikan pelacakan; browser mencoba lagi sendiri.
// options.follow (bawaan true): peta ikut bergeser supaya lokasinya tetap di tengah. Begitu
// user menggeser peta sendiri, peta berhenti mengikuti - penandanya tetap diperbarui.
// Mengembalikan function stop() untuk menghentikan pelacakan.
export function trackUser(id, responseFunction, options = {}) {
    const map = mapOf(id);
    const respond = result => {
        if (typeof responseFunction === "function") responseFunction(result);
    };
    if (!map || !navigator.geolocation) {
        respond(null);
        return () => {};
    }

    let follow = options.follow !== false;
    let lastCenter = null; // pusat peta yang terakhir dipasang oleh pelacakan ini
    let watchId = null;
    const stop = () => {
        if (watchId === null) return;
        navigator.geolocation.clearWatch(watchId);
        watchId = null;
    };

    watchId = navigator.geolocation.watchPosition(
        result => {
            const position = [result.coords.longitude, result.coords.latitude];
            showLocation(map, position, result.coords.accuracy);
            if (follow) {
                const view = map.getView();
                const moved = lastCenter
                    && (Math.abs(view.center[0] - lastCenter[0]) > 1e-7 || Math.abs(view.center[1] - lastCenter[1]) > 1e-7);
                if (moved) {
                    // Pusat peta sudah bukan yang dipasang pelacakan: user menggesernya sendiri.
                    follow = false;
                } else {
                    // Pembaruan pertama mendekatkan peta yang masih jauh; sesudahnya zoom pilihan user dipertahankan.
                    map.setView(position, lastCenter ? view.zoom : Math.max(view.zoom, 16));
                    lastCenter = map.getView().center;
                }
            }
            respond({
                position,
                accuracy: result.coords.accuracy,
                speed: result.coords.speed,
                heading: result.coords.heading,
                timestamp: result.timestamp
            });
        },
        error => {
            console.log("error", error);
            // Kode 1 = izin ditolak: pelacakan tidak akan pernah berhasil, jadi dihentikan.
            if (error.code === 1) {
                stop();
                respond(null);
            }
        },
        { enableHighAccuracy: true, timeout: LOCATE_TIMEOUT_MS }
    );
    return stop;
}

// Menambahkan tombol live tracking ke peta: klik pertama memulai trackUser(), klik
// berikutnya menghentikannya. Tombolnya berwarna biru selama pelacakan berjalan.
// responseFunction dan options diteruskan ke trackUser().
// corner: "top-left" (bawaan), "top-right", "bottom-left", atau "bottom-right".
// Mengembalikan function remove() yang menghentikan pelacakan dan mencabut tombolnya.
export function addTrackButton(id, responseFunction, options = {}, corner = "top-left") {
    const map = mapOf(id);
    if (!map) return () => {};
    injectStyles();

    let stop = null;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "crootjs-map-button";
    button.title = "Ikuti lokasi saya";
    button.setAttribute("aria-label", "Ikuti lokasi saya");
    button.setAttribute("aria-pressed", "false");
    button.innerHTML = TRACK_ICON;
    const setActive = active => {
        button.classList.toggle("crootjs-map-button-active", active);
        button.setAttribute("aria-pressed", String(active));
    };
    const end = () => {
        if (stop) stop();
        stop = null;
        setActive(false);
    };
    button.addEventListener("click", () => {
        if (stop) {
            end();
            return;
        }
        setActive(true);
        stop = trackUser(id, result => {
            // null = pelacakan gagal dan sudah berhenti sendiri; tombol kembali ke keadaan mati.
            if (result === null) end();
            if (typeof responseFunction === "function") responseFunction(result);
        }, options);
    });
    const removeControl = map.addControl(button, corner);

    return function remove() {
        end();
        removeControl();
    };
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


// Panel daftar pilihan di pojok peta. collapsed: true = panelnya disimpan di balik tombol
// ikon lapisan (dibuka-tutup dengan klik), cocok untuk layar sempit.
function addPanel(map, title, rows, options) {
    injectStyles();
    const panel = document.createElement("div");
    panel.className = "crootjs-map-panel";
    const group = document.createElement("div");
    group.className = "crootjs-map-panel-group";
    if (title) {
        const heading = document.createElement("div");
        heading.className = "crootjs-map-panel-title";
        heading.textContent = title;
        group.appendChild(heading);
    }
    group.append(...rows);
    panel.appendChild(group);

    let control = panel;
    if (options.collapsed) {
        control = document.createElement("div");
        const button = document.createElement("button");
        button.type = "button";
        button.className = "crootjs-map-button";
        button.title = title || "Lapisan";
        button.setAttribute("aria-label", title || "Lapisan");
        button.setAttribute("aria-expanded", "false");
        button.innerHTML = LAYERS_ICON;
        panel.hidden = true;
        button.addEventListener("click", () => {
            panel.hidden = !panel.hidden;
            button.setAttribute("aria-expanded", String(!panel.hidden));
        });
        control.append(button, panel);
    }
    return map.addControl(control, options.corner || "top-right");
}

function choiceRow(type, name, text, checked, onChange) {
    const label = document.createElement("label");
    const input = document.createElement("input");
    input.type = type;
    input.name = name;
    input.checked = checked;
    input.addEventListener("change", onChange);
    const span = document.createElement("span");
    span.textContent = text;
    label.append(input, span);
    return { label, input };
}

// Menambahkan pilihan peta dasar (radio) ke peta. Memilih salah satu memanggil setTiles()
// dari map.js - lapisan, marker, dan popup tetap di tempatnya.
// basemaps: array { name, tiles, labels, maxNativeZoom, subdomains, errorTiles, attribution,
// minZoom, maxZoom } - semua kecuali name sama seperti opsi setTiles().
// options (semua opsional):
//   selected   indeks atau name peta dasar yang langsung dipasang. Default 0 (yang pertama).
//   title      judul panel. Default "Peta dasar".
//   corner     pojok peta. Default "top-right".
//   collapsed  true = panel disimpan di balik tombol
//   onChange   function (basemap) yang dipanggil setelah peta dasar diganti
// Mengembalikan function remove() untuk mencabut panelnya (peta dasar terakhir tetap terpasang).
export function addBasemapControl(id, basemaps, options = {}) {
    const map = mapOf(id);
    if (!map || !Array.isArray(basemaps) || basemaps.length === 0) return () => {};
    const group = "crootjs-basemap-" + (++panelCount);
    let selected = typeof options.selected === "string"
        ? basemaps.findIndex(basemap => basemap.name === options.selected)
        : (Number.isInteger(options.selected) ? options.selected : 0);
    if (!basemaps[selected]) selected = 0;

    const choose = index => {
        const basemap = basemaps[index];
        map.setTiles(basemap.tiles, basemap);
        if (typeof options.onChange === "function") options.onChange(basemap);
    };
    const rows = basemaps.map((basemap, index) => choiceRow("radio", group, basemap.name || "Peta " + (index + 1), index === selected, () => choose(index)).label);
    map.setTiles(basemaps[selected].tiles, basemaps[selected]);
    return addPanel(map, options.title === undefined ? "Peta dasar" : options.title, rows, options);
}

// Menambahkan daftar centang untuk menampilkan/menyembunyikan lapisan bernama (opsi name
// di addGeoJSON). Hanya mengubah visibilitas - lapisannya tidak digambar ulang.
// layers: array nama, atau array { name, label }. Tanpa layers: semua lapisan bernama yang
// sudah ada saat fungsi ini dipanggil.
// options (semua opsional): title (default "Lapisan"), corner, collapsed, dan onChange -
// function (name, visible) yang dipanggil setiap kali sebuah centang diubah.
// Mengembalikan function remove() untuk mencabut panelnya.
export function addLayerControl(id, layers, options = {}) {
    const map = mapOf(id);
    if (!map) return () => {};
    const current = map.getLayers();
    const items = (Array.isArray(layers) ? layers : current.map(layer => layer.name))
        .map(item => (typeof item === "object" && item !== null ? item : { name: String(item) }));
    const rows = items.map(item => {
        const found = current.find(layer => layer.name === item.name);
        const row = choiceRow("checkbox", "", item.label || item.name, found ? found.visible : true, () => {
            map.setLayerVisible(item.name, row.input.checked);
            if (typeof options.onChange === "function") options.onChange(item.name, row.input.checked);
        });
        return row.label;
    });
    return addPanel(map, options.title === undefined ? "Lapisan" : options.title, rows, options);
}

function formatPosition(position, precision) {
    // Urutan "lat, lng": urutan yang diterima kotak pencarian Google Maps dan kebanyakan GPS.
    return position[1].toFixed(precision) + ", " + position[0].toFixed(precision);
}

// Menampilkan koordinat di bawah kursor; klik (atau tap) di peta menahan koordinat titik itu
// dan memunculkan tombol salin. Di layar sentuh, yang tampil hanya koordinat yang di-tap.
// options (semua opsional):
//   format     function (position) => teks yang ditampilkan dan disalin. Inilah kait untuk
//              sistem koordinat lokal, misalnya grid CAD lewat createAffineTransform dari
//              geomeasure.js. Default: "lat, lng".
//   precision  angka di belakang koma untuk format bawaan. Default 6 (sekitar 10 cm).
//   corner     pojok peta. Default "bottom-left".
//   onClick    function (position, text) yang dipanggil saat koordinat ditahan dengan klik
// Mengembalikan function remove().
export function addCoordinateControl(id, options = {}) {
    const map = mapOf(id);
    if (!map) return () => {};
    injectStyles();

    const precision = Number.isInteger(options.precision) ? options.precision : 6;
    const format = typeof options.format === "function" ? options.format : position => formatPosition(position, precision);
    const box = document.createElement("div");
    box.className = "crootjs-map-coordinates";
    const text = document.createElement("span");
    text.textContent = "—";
    const copy = document.createElement("button");
    copy.type = "button";
    copy.className = "crootjs-map-copy";
    copy.title = "Salin koordinat";
    copy.setAttribute("aria-label", "Salin koordinat");
    copy.innerHTML = COPY_ICON;
    copy.hidden = true;
    box.append(text, copy);

    let pinned = null; // teks koordinat yang ditahan klik terakhir
    const show = value => {
        text.textContent = value === null || value === undefined ? "—" : String(value);
    };
    const move = event => {
        if (event.pointerType !== "mouse") return;
        // Di atas kontrol (termasuk kotak ini sendiri) yang tampil koordinat yang ditahan,
        // supaya tombol salin bisa dicapai tanpa mengubah isinya.
        if (event.target.closest && event.target.closest(".crootjs-map-corner")) {
            show(pinned);
            return;
        }
        const rect = map.root.getBoundingClientRect();
        show(format(map.toPosition([event.clientX - rect.left, event.clientY - rect.top])));
    };
    const leave = () => show(pinned);
    map.root.addEventListener("pointermove", move);
    map.root.addEventListener("pointerleave", leave);
    const stopClick = map.onClick(position => {
        pinned = format(position);
        show(pinned);
        copy.hidden = false;
        if (typeof options.onClick === "function") options.onClick(position, pinned);
    });

    copy.addEventListener("click", () => {
        if (pinned === null) return;
        const done = () => {
            copy.textContent = "✓";
            setTimeout(() => { copy.innerHTML = COPY_ICON; }, 1200);
        };
        // Clipboard API hanya ada di HTTPS/localhost; di luar itu teksnya diblok supaya bisa
        // disalin manual dengan Ctrl+C.
        const select = () => {
            show(pinned);
            const range = document.createRange();
            range.selectNodeContents(text);
            const selection = window.getSelection();
            selection.removeAllRanges();
            selection.addRange(range);
        };
        if (navigator.clipboard && window.isSecureContext) {
            navigator.clipboard.writeText(String(pinned)).then(done, select);
        } else {
            select();
        }
    });
    const removeControl = map.addControl(box, options.corner || "bottom-left");

    return function remove() {
        map.root.removeEventListener("pointermove", move);
        map.root.removeEventListener("pointerleave", leave);
        stopClick();
        removeControl();
    };
}

// Menambahkan tombol layar penuh: peta memenuhi seluruh layar, klik lagi (atau Esc) untuk
// kembali. Browser tanpa Fullscreen API (Safari di iPhone) mendapat tiruannya: peta
// memenuhi jendela browser.
// corner: "top-left" (bawaan), "top-right", "bottom-left", atau "bottom-right".
// Mengembalikan function remove() yang juga keluar dari layar penuh.
export function addFullscreenButton(id, corner = "top-left") {
    const map = mapOf(id);
    if (!map) return () => {};
    injectStyles();

    const container = map.root.parentElement;
    const native = Boolean(document.fullscreenEnabled && container.requestFullscreen);
    const button = document.createElement("button");
    button.type = "button";
    button.className = "crootjs-map-button";

    const isFull = () => (native ? document.fullscreenElement === container : container.classList.contains("crootjs-map-fullscreen"));
    const update = () => {
        const full = isFull();
        button.innerHTML = full ? EXIT_FULLSCREEN_ICON : FULLSCREEN_ICON;
        button.title = full ? "Keluar dari layar penuh" : "Layar penuh";
        button.setAttribute("aria-label", button.title);
        button.setAttribute("aria-pressed", String(full));
    };
    const exit = () => {
        if (!isFull()) return;
        if (native) {
            document.exitFullscreen();
        } else {
            container.classList.remove("crootjs-map-fullscreen");
            update();
        }
    };
    const escape = event => {
        if (event.key === "Escape") exit();
    };
    button.addEventListener("click", () => {
        if (isFull()) {
            exit();
        } else if (native) {
            container.requestFullscreen().catch(error => console.log("error", error));
        } else {
            container.classList.add("crootjs-map-fullscreen");
            update();
        }
    });
    document.addEventListener("fullscreenchange", update);
    if (!native) document.addEventListener("keydown", escape);
    update();
    const removeControl = map.addControl(button, corner);

    return function remove() {
        exit();
        document.removeEventListener("fullscreenchange", update);
        document.removeEventListener("keydown", escape);
        removeControl();
    };
}
