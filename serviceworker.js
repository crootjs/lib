// Inti service worker CrootJS. Bukan modul halaman: file ini dimuat oleh service worker di domain
// situs Anda sendiri, karena browser tidak mengizinkan service worker dari domain lain:
//
//   // sw.js, di samping index.html
//   importScripts("https://cdn.jsdelivr.net/gh/crootjs/lib@<versi>/serviceworker.min.js");
//   crootjsServiceWorker({ version: "1", precache: ["./", "index.html", "style.css", "index.js"] });
//
// Daftarkan sw.js dari halaman dengan registerServiceWorker di pwa.js. Ditulis sebagai script
// klasik (bukan ES module) supaya importScripts jalan di semua browser.

(() => {
    const SKIP_WAITING = "crootjs-skip-waiting"; // harus sama dengan pwa.js

    // Berkas jsDelivr dengan versi pasti (@1.2.3 atau hash commit) tidak pernah berubah isinya,
    // berbeda dari @latest atau @1 yang bisa berubah.
    const PINNED_CDN = /^https:\/\/cdn\.jsdelivr\.net\/[^?#]*@(\d+\.\d+\.\d+[^/]*|[0-9a-f]{7,40})\//;

    // Respons yang boleh disimpan: berhasil (2xx; respons opaque berstatus 0 tidak termasuk) dan
    // tidak dilarang server lewat Cache-Control: no-store.
    const storable = response => response.ok && !/no-store/i.test(response.headers.get("Cache-Control") || "");

    // Safari menolak respons hasil redirect untuk navigasi, jadi isinya disalin ke respons baru.
    async function clean(response) {
        if (!response.redirected) return response;
        return new Response(await response.blob(), { status: response.status, statusText: response.statusText, headers: response.headers });
    }

    // options:
    //   version         teks versi aplikasi (wajib). Ubah setiap kali daftar precache berubah atau
    //                   ingin semua cache dikosongkan; cache versi lama dihapus saat versi baru aktif.
    //   precache        daftar file yang disimpan saat pemasangan, relatif terhadap sw.js; boleh URL
    //                   lengkap jsDelivr. Kalau satu saja gagal diunduh, versi ini tidak dipasang.
    //   offlinePage     halaman cadangan saat navigasi gagal dan halamannya belum tersimpan
    //                   (mis. "offline.html"); otomatis ikut di-precache.
    //   maxEntries      jumlah respons terbanyak di cache runtime (yang bukan precache); yang paling
    //                   lama disimpan dibuang. Bawaan 100.
    //   networkTimeout  milidetik menunggu server untuk navigasi sebelum memakai halaman tersimpan.
    //                   Bawaan 5000. Respons server yang datang terlambat tetap disimpan.
    //   name            awalan nama cache. Bawaan "crootjs-pwa".
    self.crootjsServiceWorker = function (options = {}) {
        if (!options.version) throw new Error("crootjsServiceWorker: opsi version wajib diisi.");
        const maxEntries = Number.isFinite(options.maxEntries) ? options.maxEntries : 100;
        const networkTimeout = Number.isFinite(options.networkTimeout) ? options.networkTimeout : 5000;
        // Cache Storage dipakai bersama satu domain; scope di nama cache mencegah aplikasi lain di
        // domain yang sama (mis. folder lain di GitHub Pages) saling menghapus cache.
        const prefix = `${options.name || "crootjs-pwa"} ${self.registration.scope} `;
        const precacheName = `${prefix}precache ${options.version}`;
        const runtimeName = `${prefix}runtime ${options.version}`;
        const absolute = path => new URL(path, self.location.href).href;
        const offlineURL = options.offlinePage ? absolute(options.offlinePage) : null;
        const precacheURLs = [...new Set([...(options.precache || []).map(absolute), ...(offlineURL ? [offlineURL] : [])])];

        // Isi jsDelivr diambil dengan mode cors walaupun halaman memintanya tanpa cors (mis. <link>
        // tanpa atribut crossorigin), supaya yang disimpan bukan respons opaque yang tidak bisa diperiksa.
        const fetchFresh = (url, init = {}) => fetch(url, PINNED_CDN.test(url) ? { ...init, mode: "cors", credentials: "omit" } : init);

        async function lookup(request, matchOptions) {
            for (const name of [precacheName, runtimeName]) {
                const response = await (await caches.open(name)).match(request, matchOptions);
                if (response) return { response, name };
            }
            return null;
        }

        async function store(name, url, response) {
            if (!storable(response)) return;
            const cache = await caches.open(name);
            await cache.put(url, await clean(response));
            if (name !== runtimeName) return;
            const keys = await cache.keys();
            // Urutan keys() = urutan disimpan (put ulang memindahkannya ke belakang), jadi yang terdepan paling lama.
            await Promise.all(keys.slice(0, Math.max(0, keys.length - maxEntries)).map(key => cache.delete(key)));
        }

        self.addEventListener("install", event => {
            event.waitUntil((async () => {
                // Semua diunduh dulu baru disimpan: kalau ada yang gagal, install gagal dan versi
                // lama tetap dipakai, bukan versi setengah jadi.
                const responses = await Promise.all(precacheURLs.map(async url => {
                    const response = await fetchFresh(url, { cache: "reload" });
                    if (!response.ok) throw new Error(`precache gagal: ${url} (${response.status})`);
                    return clean(response);
                }));
                const cache = await caches.open(precacheName);
                await Promise.all(responses.map((response, i) => cache.put(precacheURLs[i], response)));
            })());
        });

        self.addEventListener("activate", event => {
            event.waitUntil((async () => {
                const names = await caches.keys();
                await Promise.all(names
                    .filter(name => name.startsWith(prefix) && name !== precacheName && name !== runtimeName)
                    .map(name => caches.delete(name)));
                // Halaman yang sudah terbuka saat pemasangan pertama langsung dikendalikan.
                await self.clients.claim();
            })());
        });

        self.addEventListener("message", event => {
            if (event.data && event.data.type === SKIP_WAITING) self.skipWaiting();
        });

        // Network-first: halaman terbaru kalau online; halaman tersimpan, lalu offlinePage, kalau tidak.
        async function navigate(event) {
            const { request } = event;
            const network = fetch(request).then(async response => {
                // Halaman yang ada di precache diperbarui di sana, supaya saat offline yang tampil versi terakhir.
                const found = await lookup(request.url);
                await store(found ? found.name : runtimeName, request.url, response.clone());
                return response;
            });
            event.waitUntil(network.catch(() => null));
            const fromCache = async () => {
                const found = await lookup(request.url) || await lookup(request.url, { ignoreSearch: true });
                return found ? found.response : null;
            };
            const slow = new Promise(resolve => setTimeout(resolve, networkTimeout)).then(fromCache);
            const first = await Promise.race([network.catch(() => null), slow]);
            if (first) return first;
            const response = await network.catch(() => null) || await fromCache()
                || (offlineURL && (await caches.open(precacheName)).match(offlineURL));
            return response || Response.error();
        }

        // Stale-while-revalidate: langsung dari cache, sambil diperbarui di latar untuk kunjungan berikutnya.
        async function staleWhileRevalidate(event) {
            const found = await lookup(event.request);
            const network = fetch(event.request).then(async response => {
                await store(found ? found.name : runtimeName, event.request.url, response.clone());
                return response;
            });
            if (!found) return network;
            event.waitUntil(network.catch(() => null));
            return found.response;
        }

        // Cache-first untuk berkas jsDelivr berversi pasti: isinya tidak berubah, jadi tidak perlu dicek lagi.
        async function cacheFirst(event) {
            const found = await lookup(event.request.url);
            if (found) return found.response;
            const response = await fetchFresh(event.request.url);
            await store(runtimeName, event.request.url, response.clone());
            return response;
        }

        self.addEventListener("fetch", event => {
            const { request } = event;
            // POST/PUT dan sejenisnya, serta request Range (video, PMTiles), dibiarkan ke jaringan apa adanya.
            if (request.method !== "GET" || request.headers.has("range")) return;
            const url = new URL(request.url);
            if (request.mode === "navigate" && url.origin === self.location.origin) event.respondWith(navigate(event));
            // destination kosong = fetch()/XMLHttpRequest dari kode halaman (mis. data API): tidak
            // disimpan, supaya data tidak basi tanpa disadari.
            else if (url.origin === self.location.origin && request.destination) event.respondWith(staleWhileRevalidate(event));
            else if (PINNED_CDN.test(request.url)) event.respondWith(cacheFirst(event));
            // Domain lain (API, tile peta, font) tidak disentuh.
        });
    };
})();
