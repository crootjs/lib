// Modul tambahan untuk map.js: mencari tempat dari nama/alamat (geocoding), mencari alamat
// dari titik (reverse geocoding), dan kotak pencarian di peta.
// Bawaannya memakai Nominatim dari OpenStreetMap (https://nominatim.org). Server publiknya
// gratis tapi dibatasi: paling banyak 1 permintaan per detik, tanpa pencarian otomatis setiap
// huruf diketik, dan wajib mencantumkan atribusi OSM. Untuk pemakaian besar, pasang Nominatim
// sendiri (opsi url) atau pakai penyedia lain (opsi provider).
// Tidak mengimpor map.js - petanya dijangkau lewat element.crootjsMap.

const NOMINATIM = "https://nominatim.openstreetmap.org";
const MIN_INTERVAL_MS = 1100; // jarak minimal antar permintaan ke server publik Nominatim

let lastRequest = 0;

function injectStyles() {
    if (document.getElementById("crootjs-mapsearch-style")) return;
    const style = document.createElement("style");
    style.id = "crootjs-mapsearch-style";
    style.textContent = `
.crootjs-map-search {
    position: relative;
    width: min(280px, calc(100vw - 80px));
    font: 13px/1.4 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}
.crootjs-map-search form { display: flex; margin: 0; }
.crootjs-map-search input {
    flex: 1;
    min-width: 0;
    height: 34px;
    margin: 0;
    padding: 0 10px;
    border: 0;
    border-radius: 6px 0 0 6px;
    background-color: #fff;
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.3);
    color: #1f2937;
    font: inherit;
    font-size: 14px;
}
.crootjs-map-search input:focus { outline: 2px solid #2563eb; outline-offset: -2px; }
.crootjs-map-search button.crootjs-map-search-button {
    width: 36px;
    height: 34px;
    margin: 0;
    padding: 0;
    border: 0;
    border-radius: 0 6px 6px 0;
    background-color: #2563eb;
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.3);
    color: #fff;
    cursor: pointer;
}
.crootjs-map-search-results {
    position: absolute;
    left: 0;
    right: 0;
    top: 38px;
    z-index: 1;
    max-height: 260px;
    overflow-y: auto;
    margin: 0;
    padding: 4px;
    border-radius: 6px;
    background-color: #fff;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.25);
    list-style: none;
}
.crootjs-map-search-results[hidden] { display: none; }
.crootjs-map-search-results li {
    padding: 6px 8px;
    border-radius: 4px;
    color: #1f2937;
    cursor: pointer;
}
.crootjs-map-search-results li[aria-selected="true"],
.crootjs-map-search-results li:hover { background-color: #eff6ff; }
.crootjs-map-search-results li.crootjs-map-search-message { color: #6b7280; cursor: default; background: none; }
.crootjs-map-search-results li.crootjs-map-search-credit { font-size: 11px; }
.crootjs-map-search-type { display: block; color: #6b7280; font-size: 11px; }
.crootjs-map-search-pin {
    position: absolute;
    left: 0;
    top: 0;
    width: 14px;
    height: 14px;
    margin: -7px 0 0 -7px;
    border: 3px solid #fff;
    border-radius: 50%;
    background-color: #dc2626;
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.4);
    pointer-events: none;
}
@media (pointer: coarse) {
    .crootjs-map-search input, .crootjs-map-search button.crootjs-map-search-button { height: 40px; }
    .crootjs-map-search-results { top: 44px; }
    .crootjs-map-search-results li { padding: 10px 8px; }
}
`;
    const previous = [...document.head.querySelectorAll('style[id^="crootjs-"]')].pop();
    if (previous) previous.after(style);
    else document.head.prepend(style);
}

function mapOf(id) {
    const container = document.getElementById(id);
    const map = container ? container.crootjsMap : null;
    if (!map) console.warn(`Peta dengan ID "${id}" belum dibuat. Panggil createMap("${id}") dari map.js lebih dulu.`);
    return map;
}

// Server publik Nominatim menolak lebih dari 1 permintaan per detik: permintaan ditunda
// seperlunya, bukan dikirim berbarengan.
async function throttled(url) {
    const wait = lastRequest + MIN_INTERVAL_MS - Date.now();
    lastRequest = Math.max(Date.now(), lastRequest + MIN_INTERVAL_MS);
    if (wait > 0) await new Promise(resolve => setTimeout(resolve, wait));
    const response = await fetch(url, { headers: { Accept: "application/json" } });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
}

// Satu hasil Nominatim -> bentuk yang seragam.
function normalize(item) {
    const bbox = Array.isArray(item.boundingbox) ? item.boundingbox.map(Number) : null; // [minLat, maxLat, minLng, maxLng]
    return {
        name: item.display_name || item.name || "",
        position: [Number(item.lon), Number(item.lat)],
        bbox: bbox ? [bbox[2], bbox[0], bbox[3], bbox[1]] : null,
        type: [item.category || item.class, item.type].filter(Boolean).join(":"),
        address: item.address || null,
        raw: item
    };
}

// Mencari tempat dari teks: nama, alamat, atau nama jalan.
// responseFunction(results) - results = [{ name, position: [lng, lat], bbox: [minLng, minLat,
// maxLng, maxLat] atau null, type, address, raw }], array kosong kalau tidak ada yang cocok, atau
// null kalau permintaannya gagal (jaringan, server menolak). Juga mengembalikan Promise berisi
// results yang sama.
// options (semua opsional):
//   limit         banyak hasil, bawaan 5
//   countryCodes  batasi negara, misalnya "id" atau "id,my"
//   language      bahasa nama tempat, bawaan bahasa browser
//   viewbox       [minLng, minLat, maxLng, maxLat] untuk mengutamakan hasil di area itu
//   url           alamat server Nominatim sendiri. Bawaan server publik OSM
//   provider      function (query, options) => Promise<results> untuk penyedia lain; dipakai
//                 sebagai ganti Nominatim, hasilnya harus berbentuk seperti di atas
export async function searchPlace(query, responseFunction, options = {}) {
    let results = null;
    const text = String(query || "").trim();
    try {
        if (!text) results = [];
        else if (typeof options.provider === "function") results = await options.provider(text, options);
        else {
            const params = new URLSearchParams({ q: text, format: "jsonv2", addressdetails: "1", limit: String(options.limit || 5) });
            if (options.countryCodes) params.set("countrycodes", options.countryCodes);
            if (options.language || navigator.language) params.set("accept-language", options.language || navigator.language);
            if (Array.isArray(options.viewbox)) params.set("viewbox", options.viewbox.join(","));
            const data = await throttled(`${options.url || NOMINATIM}/search?${params}`);
            results = Array.isArray(data) ? data.map(normalize) : [];
        }
    } catch (error) {
        console.warn(`Pencarian "${text}" gagal: ${error.message}`);
        results = null;
    }
    if (typeof responseFunction === "function") responseFunction(results);
    return results;
}

// Alamat di sebuah titik [lng, lat]. responseFunction(result) - result = { name, position,
// bbox, type, address, raw }, null kalau tidak ada alamat di sana atau permintaannya gagal.
// Juga mengembalikan Promise. options: zoom (detail alamat 3-18, bawaan 18 = bangunan),
// language, url, provider (function (position, options) => Promise<result>).
export async function reverseGeocode(position, responseFunction, options = {}) {
    let result = null;
    try {
        if (typeof options.provider === "function") result = await options.provider(position, options);
        else {
            const params = new URLSearchParams({ lat: String(position[1]), lon: String(position[0]), format: "jsonv2", addressdetails: "1", zoom: String(options.zoom || 18) });
            if (options.language || navigator.language) params.set("accept-language", options.language || navigator.language);
            const data = await throttled(`${options.url || NOMINATIM}/reverse?${params}`);
            result = data && !data.error ? normalize(data) : null;
        }
    } catch (error) {
        console.warn(`Alamat untuk ${position.join(", ")} gagal dicari: ${error.message}`);
        result = null;
    }
    if (typeof responseFunction === "function") responseFunction(result);
    return result;
}

// Zoom terbesar yang membuat kotak [minLng, minLat, maxLng, maxLat] muat di peta selebar
// width x height piksel (Web Mercator).
function zoomForBox(bbox, width, height) {
    const y = latitude => Math.log(Math.tan(Math.PI / 4 + Math.max(-85, Math.min(85, latitude)) * Math.PI / 360));
    const spanX = Math.max((bbox[2] - bbox[0]) / 360, 1e-9);
    const spanY = Math.max((y(bbox[3]) - y(bbox[1])) / (2 * Math.PI), 1e-9);
    return Math.min(Math.log2(width / 256 / spanX), Math.log2(height / 256 / spanY)) - 0.2;
}

// Kotak pencarian di pojok peta. Ketik lalu Enter (atau tombol cari); pilih hasilnya dengan
// klik, atau panah atas/bawah + Enter. Peta pindah ke tempat itu dan memberi tanda merah.
// Pencarian hanya dikirim saat Enter/tombol ditekan, bukan setiap huruf - sesuai aturan server
// publik Nominatim.
// options (semua opsional): placeholder, corner (bawaan "top-right"), marker (false = tanpa
// tanda), maxZoom (zoom terdekat saat pindah, bawaan 17), onSelect(result), plus opsi
// searchPlace (limit, countryCodes, language, viewbox, url, provider).
// Selama memakai server Nominatim publik, daftar hasil diberi atribusi "Data © kontributor
// OpenStreetMap" (wajib menurut aturan pemakaiannya).
// Mengembalikan { search(text), clear(), remove() }.
export function addSearchControl(id, options = {}) {
    const map = mapOf(id);
    const none = { search() {}, clear() {}, remove() {} };
    if (!map) return none;
    injectStyles();

    const box = document.createElement("div");
    box.className = "crootjs-map-search";
    const form = document.createElement("form");
    form.setAttribute("role", "search");
    const input = document.createElement("input");
    input.type = "search";
    input.placeholder = options.placeholder || "Cari tempat atau alamat";
    input.setAttribute("aria-label", input.placeholder);
    input.setAttribute("autocomplete", "off");
    const listId = "crootjs-search-" + Math.random().toString(36).slice(2);
    input.setAttribute("aria-controls", listId);
    input.setAttribute("aria-expanded", "false");
    const button = document.createElement("button");
    button.type = "submit";
    button.className = "crootjs-map-search-button";
    button.setAttribute("aria-label", "Cari");
    button.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/></svg>';
    form.append(input, button);
    const list = document.createElement("ul");
    list.className = "crootjs-map-search-results";
    list.id = listId;
    list.setAttribute("role", "listbox");
    list.hidden = true;
    box.append(form, list);

    let results = [];
    let active = -1;
    let pin = null;
    let pinPosition = null;
    let token = 0;

    const showList = open => {
        list.hidden = !open;
        input.setAttribute("aria-expanded", String(open));
    };
    const message = text => {
        list.textContent = "";
        const item = document.createElement("li");
        item.className = "crootjs-map-search-message";
        item.textContent = text;
        list.appendChild(item);
        showList(true);
    };
    const highlight = index => {
        active = index;
        [...list.children].forEach((item, i) => item.setAttribute("aria-selected", String(i === index)));
        if (index >= 0) input.setAttribute("aria-activedescendant", `${listId}-${index}`);
        else input.removeAttribute("aria-activedescendant");
    };
    const placePin = () => {
        if (!pin || !pinPosition) return;
        const point = map.toPoint(pinPosition);
        pin.style.transform = `translate(${point[0]}px, ${point[1]}px)`;
    };
    const stopFollowing = map.onMove(placePin);

    const choose = index => {
        const result = results[index];
        if (!result) return;
        showList(false);
        input.value = result.name;
        const rect = map.root.getBoundingClientRect();
        const maxZoom = Number.isFinite(options.maxZoom) ? options.maxZoom : 17;
        const zoom = result.bbox ? Math.min(maxZoom, zoomForBox(result.bbox, rect.width, rect.height)) : maxZoom;
        const center = result.bbox ? [(result.bbox[0] + result.bbox[2]) / 2, (result.bbox[1] + result.bbox[3]) / 2] : result.position;
        map.setView(center, Math.round(zoom));
        if (options.marker !== false) {
            if (!pin) {
                pin = document.createElement("div");
                pin.className = "crootjs-map-search-pin";
                map.overlay.appendChild(pin);
            }
            pinPosition = result.position;
            placePin();
        }
        if (typeof options.onSelect === "function") options.onSelect(result);
    };

    const search = async text => {
        const query = String(text || "").trim();
        if (!query) return;
        input.value = query;
        const current = ++token;
        message("Mencari...");
        const found = await searchPlace(query, null, options);
        if (current !== token) return; // sudah ada pencarian yang lebih baru
        if (found === null) {
            results = [];
            message("Pencarian gagal. Periksa koneksi, lalu coba lagi.");
            return;
        }
        results = found;
        if (!results.length) {
            message("Tidak ditemukan.");
            return;
        }
        list.textContent = "";
        results.forEach((result, index) => {
            const item = document.createElement("li");
            item.id = `${listId}-${index}`;
            item.setAttribute("role", "option");
            item.textContent = result.name;
            if (result.type) {
                const type = document.createElement("span");
                type.className = "crootjs-map-search-type";
                type.textContent = result.type;
                item.appendChild(type);
            }
            item.addEventListener("click", () => choose(index));
            list.appendChild(item);
        });
        // Atribusi wajib untuk hasil dari server Nominatim publik, di tempat hasilnya tampil.
        if (!options.provider && !options.url) {
            const credit = document.createElement("li");
            credit.className = "crootjs-map-search-message crootjs-map-search-credit";
            credit.textContent = "Data © kontributor OpenStreetMap";
            list.appendChild(credit);
        }
        showList(true);
        highlight(-1);
    };

    form.addEventListener("submit", event => {
        event.preventDefault();
        if (active >= 0 && !list.hidden) choose(active);
        else search(input.value);
    });
    input.addEventListener("keydown", event => {
        if (list.hidden || !results.length) return;
        if (event.key === "ArrowDown") highlight((active + 1) % results.length);
        else if (event.key === "ArrowUp") highlight(active <= 0 ? results.length - 1 : active - 1);
        else if (event.key === "Escape") showList(false);
        else return;
        event.preventDefault();
    });
    const outside = event => {
        if (!box.contains(event.target)) showList(false);
    };
    document.addEventListener("pointerdown", outside, true);

    const removeControl = map.addControl(box, options.corner || "top-right");

    return {
        search,
        clear() {
            token++;
            input.value = "";
            results = [];
            showList(false);
            if (pin) pin.remove();
            pin = null;
            pinPosition = null;
        },
        remove() {
            this.clear();
            stopFollowing();
            document.removeEventListener("pointerdown", outside, true);
            removeControl();
        }
    };
}
