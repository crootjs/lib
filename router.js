// Router untuk aplikasi satu halaman (SPA): mode hash (#/mahasiswa/7, jalan di hosting statis
// seperti GitHub Pages tanpa konfigurasi) atau mode history (/app/mahasiswa/7, butuh server yang
// mengirim index.html untuk semua path di bawah base).

function injectStyles() {
    if (document.getElementById("crootjs-router-style")) return;
    const style = document.createElement("style");
    style.id = "crootjs-router-style";
    style.textContent = `
.crootjs-router-status {
    position: absolute;
    width: 1px;
    height: 1px;
    margin: -1px;
    padding: 0;
    overflow: hidden;
    clip: rect(0 0 0 0);
    white-space: nowrap;
    border: 0;
}
`;
    // Di awal <head> (sesudah style CrootJS lain) supaya CSS halaman menang tanpa !important.
    const previous = [...document.head.querySelectorAll('style[id^="crootjs-"]')].pop();
    if (previous) previous.after(style);
    else document.head.prepend(style);
}

// "/mahasiswa/:id" -> daftar segmen. Rute dengan parameter lebih sedikit dicoba lebih dulu,
// jadi "/mahasiswa/baru" menang atas "/mahasiswa/:id" apa pun urutan penulisannya.
function compile(routes) {
    return Object.keys(routes)
        .map(pattern => {
            const segments = split(pattern);
            return { pattern, segments, view: routes[pattern], dynamic: segments.filter(s => s.startsWith(":")).length };
        })
        .sort((a, b) => a.dynamic - b.dynamic);
}

function split(path) {
    return path.split("/").filter(Boolean);
}

function match(compiled, path) {
    const parts = split(path);
    for (const route of compiled) {
        if (route.segments.length !== parts.length) continue;
        const params = {};
        const found = route.segments.every((segment, i) => {
            if (!segment.startsWith(":")) return segment === parts[i];
            try {
                params[segment.slice(1)] = decodeURIComponent(parts[i]);
                return true;
            } catch (error) {
                // %-encoding rusak di URL: dianggap tidak cocok, jadi jatuh ke notFound.
                return false;
            }
        });
        if (found) return { route, params };
    }
    return null;
}

function trimBase(base) {
    return base.replace(/\/+$/, "");
}

// Konten yang dikembalikan handler: teks HTML atau Node. Selain itu (undefined) berarti handler
// sudah menulis DOM sendiri.
function place(outlet, content) {
    if (typeof content === "string") outlet.innerHTML = content;
    else if (content instanceof Node) outlet.replaceChildren(content);
}

// Memulai router dan langsung menampilkan rute dari URL sekarang.
// routes: { "/pola/:param": view }. view = function(ctx), URL potongan HTML (string), atau
// { html, run }. Lihat docs/router.md untuk opsi dan isi ctx.
export function startRouter(routes, options = {}) {
    const mode = options.mode === "history" ? "history" : "hash";
    const base = mode === "history" ? trimBase(options.base || "") : "";
    const compiled = compile(routes);
    const outlet = options.outlet ? document.getElementById(options.outlet) : null;
    if (options.outlet && !outlet) console.warn(`Elemen dengan ID "${options.outlet}" tidak ditemukan.`);
    const linkSelector = options.links || "nav a[href]";
    const reportError = typeof options.onError === "function"
        ? options.onError
        : (error, ctx) => console.error(`Rute ${ctx.path} gagal:`, error);
    // URL relatif potongan HTML dihitung dari base (mode history) atau halaman ini (mode hash),
    // bukan dari path rute yang sedang tampil, supaya "pages/x.html" selalu menunjuk file yang sama.
    const htmlBase = mode === "history" ? location.origin + base + "/" : location.href.split("#")[0];

    injectStyles();
    const status = document.createElement("div");
    status.className = "crootjs-router-status";
    status.setAttribute("role", "status");
    status.setAttribute("aria-atomic", "true");
    document.body.appendChild(status);

    let token = 0;
    let controller = null;
    let current = null;
    let lastKey = null;
    let first = true;
    let stopped = false;

    // URL -> { path, query } milik router ini, atau null kalau bukan (halaman lain, situs lain,
    // atau di mode hash: hash biasa seperti #konten untuk skip link).
    function parse(url) {
        if (url.origin !== location.origin) return null;
        if (mode === "hash") {
            if (url.pathname !== location.pathname || url.search !== location.search) return null;
            const hash = url.hash.slice(1);
            if (hash && !hash.startsWith("/")) return null;
            const [path, search = ""] = (hash || "/").split("?");
            return { path: path || "/", query: new URLSearchParams(search) };
        }
        if (base && url.pathname !== base && !url.pathname.startsWith(base + "/")) return null;
        return { path: url.pathname.slice(base.length) || "/", query: new URLSearchParams(url.search) };
    }

    function href(path) {
        const target = path.startsWith("/") ? path : "/" + path;
        return mode === "hash" ? "#" + target : base + target;
    }

    function markLinks(path) {
        document.querySelectorAll(linkSelector).forEach(link => {
            const target = link instanceof HTMLAnchorElement ? parse(new URL(link.href)) : null;
            if (target && normalize(target.path) === normalize(path)) link.setAttribute("aria-current", "page");
            else if (link.getAttribute("aria-current") === "page") link.removeAttribute("aria-current");
        });
    }

    function normalize(path) {
        return "/" + split(path).join("/");
    }

    // Fokus ke judul konten baru (atau wadahnya) dan umumkan judulnya, supaya pengguna pembaca
    // layar dan keyboard tahu halaman sudah berganti; tanpa ini fokus tertinggal di tautan lama.
    function settle(scrollTop) {
        if (scrollTop) window.scrollTo(0, 0);
        if (options.focus === false) return;
        const scope = outlet || document.querySelector("main") || document.body;
        const target = typeof options.focus === "string"
            ? document.querySelector(options.focus)
            : scope.querySelector("h1") || scope;
        if (target && target !== document.body) {
            if (!target.hasAttribute("tabindex")) target.setAttribute("tabindex", "-1");
            target.focus({ preventScroll: true });
        }
        const text = ((target && target !== document.body && target.textContent) || "").trim() || document.title;
        // Dikosongkan dulu supaya judul yang sama dengan sebelumnya tetap diumumkan ulang.
        status.textContent = "";
        setTimeout(() => {
            if (!stopped) status.textContent = text;
        }, 50);
    }

    async function render(target, scrollTop) {
        const path = normalize(target.path);
        lastKey = path + "?" + target.query.toString();
        const mine = ++token;
        if (controller) controller.abort();
        controller = new AbortController();
        const signal = controller.signal;

        const found = match(compiled, path);
        const view = found ? found.route.view : options.notFound;
        const ctx = {
            path,
            params: found ? found.params : {},
            query: target.query,
            pattern: found ? found.route.pattern : null,
            signal
        };
        current = ctx;
        markLinks(path);

        const isFirst = first;
        first = false;
        if (!view) {
            if (outlet) outlet.replaceChildren();
            return;
        }
        const spec = typeof view === "string" ? { html: view } : view;
        try {
            if (typeof spec === "function") {
                const content = await spec(ctx);
                if (mine !== token) return;
                if (outlet) place(outlet, content);
            } else {
                if (spec.html) {
                    const response = await fetch(new URL(spec.html, htmlBase), { signal });
                    if (!response.ok) throw new Error(`HTTP ${response.status} untuk ${spec.html}`);
                    const html = await response.text();
                    if (mine !== token) return;
                    if (outlet) outlet.innerHTML = html;
                }
                if (typeof spec.run === "function") await spec.run(ctx);
                if (mine !== token) return;
            }
        } catch (error) {
            // Dibatalkan karena pengguna sudah pindah lagi: bukan kesalahan.
            if (mine !== token) return;
            reportError(error, ctx);
            return;
        }
        if (!isFirst) settle(scrollTop);
    }

    function fromLocation() {
        return parse(new URL(location.href));
    }

    // Tombol back/forward, atau tautan #/... di mode hash. Di mode hash browser memicu popstate
    // dan hashchange sekaligus, jadi URL yang sama dengan yang sedang tampil dilewati.
    function onChange() {
        const target = fromLocation();
        if (!target) return;
        if (normalize(target.path) + "?" + target.query.toString() === lastKey) return;
        render(target, false);
    }

    function onClick(event) {
        if (event.defaultPrevented || event.button !== 0) return;
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        const link = event.target instanceof Element ? event.target.closest("a[href]") : null;
        if (!(link instanceof HTMLAnchorElement)) return;
        if ((link.target && link.target !== "_self") || link.hasAttribute("download")) return;
        const url = new URL(link.href);
        const target = parse(url);
        if (!target) return;
        // Tautan ke #bagian di halaman yang sama dibiarkan ke browser.
        if (url.hash && url.pathname === location.pathname && url.search === location.search) return;
        event.preventDefault();
        navigate(target.path + url.search);
    }

    // path boleh membawa query: "/mahasiswa?q=sari". options.replace = true mengganti entri
    // riwayat sekarang (tidak menambah langkah back). Promise selesai sesudah handler selesai.
    function navigate(path, navOptions = {}) {
        if (stopped) return Promise.resolve();
        const url = new URL(href(path), location.href);
        const same = url.href === location.href;
        if (navOptions.replace || same) history.replaceState(history.state, "", url);
        else history.pushState(null, "", url);
        return render(parse(url) || { path: "/", query: new URLSearchParams() }, true);
    }

    function stop() {
        if (stopped) return;
        stopped = true;
        token++;
        if (controller) controller.abort();
        window.removeEventListener("popstate", onChange);
        window.removeEventListener("hashchange", onChange);
        document.removeEventListener("click", onClick);
        status.remove();
    }

    window.addEventListener("popstate", onChange);
    if (mode === "hash") window.addEventListener("hashchange", onChange);
    else document.addEventListener("click", onClick);

    // Ditunda satu microtask supaya handler boleh memakai objek router yang dikembalikan
    // (const router = startRouter(...)) walaupun handler itu sinkron. Hash bukan rute (misalnya
    // #konten) saat halaman dibuka dianggap beranda.
    queueMicrotask(() => {
        if (stopped) return;
        render(fromLocation() || { path: mode === "hash" ? "/" : location.pathname, query: new URLSearchParams(location.search) }, false);
    });

    return {
        navigate,
        href,
        current: () => current && { path: current.path, params: current.params, query: current.query, pattern: current.pattern },
        stop
    };
}
