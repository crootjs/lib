import { describe, test, assert, wait } from "./runner.js";
import { startRouter } from "../router.js";

// Halaman uji ikut dipakai sebagai "aplikasi": URL-nya dikembalikan sesudah setiap uji.
const ORIGINAL = location.href;

function setup() {
    const box = document.createElement("div");
    box.innerHTML = `<nav id="router-nav"><a href="#/">Beranda</a> <a href="#/mahasiswa">Mahasiswa</a></nav><div id="router-outlet"></div>`;
    document.body.appendChild(box);
    return {
        outlet: document.getElementById("router-outlet"),
        cleanup(router) {
            router.stop();
            box.remove();
            history.replaceState(null, "", ORIGINAL);
        }
    };
}

const page = title => ctx => `<h1>${title}</h1><p id="router-info">${JSON.stringify(ctx.params)} ${ctx.query.toString()}</p>`;

describe("router.js mode hash", () => {
    test("rute, parameter, query, 404, href, current", async () => {
        const { outlet, cleanup } = setup();
        let notFoundPath = null;
        const router = startRouter({
            "/": page("Beranda"),
            "/mahasiswa": page("Daftar"),
            "/mahasiswa/:id": page("Detail"),
            "/mahasiswa/baru": page("Baru")
        }, {
            outlet: "router-outlet",
            links: "#router-nav a",
            notFound: ctx => {
                notFoundPath = ctx.path;
                return "<h1>Tidak ditemukan</h1>";
            }
        });
        await wait(0);
        assert.equal(outlet.querySelector("h1").textContent, "Beranda", "hash kosong = beranda;");

        await router.navigate("/mahasiswa/a%20b?tab=nilai&tab=absen");
        assert.equal(location.hash, "#/mahasiswa/a%20b?tab=nilai&tab=absen");
        assert.equal(outlet.querySelector("h1").textContent, "Detail");
        const current = router.current();
        assert.equal(current.pattern, "/mahasiswa/:id");
        assert.deepEqual(current.params, { id: "a b" });
        assert.deepEqual(current.query.getAll("tab"), ["nilai", "absen"]);

        await router.navigate("/mahasiswa/baru/");
        assert.equal(outlet.querySelector("h1").textContent, "Baru", "rute tanpa parameter menang, garis miring akhir diabaikan;");

        await router.navigate("/tidak/ada");
        assert.equal(outlet.querySelector("h1").textContent, "Tidak ditemukan");
        assert.equal(notFoundPath, "/tidak/ada");
        assert.equal(router.current().pattern, null);

        await router.navigate("/mahasiswa/%E0%A4%A");
        assert.equal(outlet.querySelector("h1").textContent, "Tidak ditemukan", "%-encoding rusak = 404;");

        assert.equal(router.href("/mahasiswa/7"), "#/mahasiswa/7");
        cleanup(router);
    });

    test("tautan #/..., back, aria-current, hash biasa diabaikan", async () => {
        const { outlet, cleanup } = setup();
        const calls = [];
        const router = startRouter({
            "/": page("Beranda"),
            "/mahasiswa": ctx => {
                calls.push(ctx.path);
                return page("Daftar")(ctx);
            }
        }, { outlet: "router-outlet", links: "#router-nav a" });
        await wait(0);
        const [home, list] = document.querySelectorAll("#router-nav a");
        assert.equal(home.getAttribute("aria-current"), "page");
        assert.equal(list.hasAttribute("aria-current"), false);

        list.click();
        await wait(50);
        assert.equal(outlet.querySelector("h1").textContent, "Daftar");
        assert.equal(list.getAttribute("aria-current"), "page");
        assert.equal(home.hasAttribute("aria-current"), false);
        assert.equal(calls.length, 1, "popstate + hashchange hanya merender sekali;");

        location.hash = "konten";
        await wait(50);
        assert.equal(outlet.querySelector("h1").textContent, "Daftar", "#konten bukan rute;");

        history.back();
        await wait(100);
        history.back();
        await wait(100);
        assert.equal(outlet.querySelector("h1").textContent, "Beranda");
        assert.equal(home.getAttribute("aria-current"), "page");
        cleanup(router);
    });

    test("handler async: hasil lama diabaikan dan signal-nya dibatalkan", async () => {
        const { outlet, cleanup } = setup();
        let slowSignal = null;
        const router = startRouter({
            "/": () => "<h1>Beranda</h1>",
            "/lambat": async ({ signal }) => {
                slowSignal = signal;
                await wait(80);
                return "<h1>Lambat</h1>";
            },
            "/cepat": async () => {
                await wait(10);
                return "<h1>Cepat</h1>";
            }
        }, { outlet: "router-outlet" });
        await wait(0);
        const slow = router.navigate("/lambat");
        const fast = router.navigate("/cepat");
        await Promise.all([slow, fast]);
        assert.equal(outlet.querySelector("h1").textContent, "Cepat");
        assert.equal(slowSignal.aborted, true);
        await wait(100);
        assert.equal(outlet.querySelector("h1").textContent, "Cepat", "hasil lambat tidak menimpa;");
        assert.equal(router.current().path, "/cepat");
        cleanup(router);
    });

    test("fokus dan pengumuman sesudah pindah, tidak saat pertama dibuka", async () => {
        const { outlet, cleanup } = setup();
        const before = document.activeElement;
        const router = startRouter({
            "/": () => "<h1>Beranda</h1>",
            "/profil": () => "<h1>Profil saya</h1>"
        }, { outlet: "router-outlet" });
        await wait(80);
        assert.equal(document.activeElement, before, "fokus tidak dipindah saat halaman dibuka;");
        const status = document.querySelector(".crootjs-router-status");
        assert.equal(status.getAttribute("role"), "status");
        assert.equal(status.textContent, "");

        await router.navigate("/profil");
        const heading = outlet.querySelector("h1");
        assert.equal(document.activeElement, heading);
        assert.equal(heading.getAttribute("tabindex"), "-1");
        await wait(80);
        assert.equal(status.textContent, "Profil saya");
        cleanup(router);
        assert.equal(document.querySelector(".crootjs-router-status"), null, "stop() membuang wilayah status;");
    });

    test("potongan HTML { html, run }, onError, stop", async () => {
        const { outlet, cleanup } = setup();
        const errors = [];
        let ran = null;
        const router = startRouter({
            "/": () => "<h1>Beranda</h1>",
            "/potongan/:id": {
                html: "data:text/html,<h1>Potongan</h1><p id='router-p'></p>",
                run: ({ params }) => {
                    ran = params.id;
                    document.getElementById("router-p").textContent = params.id;
                }
            },
            "/rusak": () => {
                throw new Error("gagal");
            }
        }, { outlet: "router-outlet", onError: (error, ctx) => errors.push([error.message, ctx.path]) });
        await wait(0);
        await router.navigate("/potongan/9");
        assert.equal(outlet.querySelector("h1").textContent, "Potongan");
        assert.equal(ran, "9");
        assert.equal(document.getElementById("router-p").textContent, "9");

        await router.navigate("/rusak");
        assert.deepEqual(errors, [["gagal", "/rusak"]]);

        router.stop();
        location.hash = "/potongan/1";
        await wait(50);
        assert.equal(ran, "9", "sesudah stop() tidak bereaksi;");
        cleanup(router);
    });
});

describe("router.js mode history", () => {
    test("base, navigate, back, intersepsi klik", async () => {
        const dir = location.pathname.replace(/\/[^/]*$/, "");
        const base = dir + "/app-uji";
        history.replaceState(null, "", base + "/mahasiswa/3?urut=nama");
        const { outlet, cleanup } = setup();
        const nav = document.getElementById("router-nav");
        nav.innerHTML = `
<a id="r-home" href="${base}/">Beranda</a>
<a id="r-list" href="${base}/mahasiswa">Mahasiswa</a>
<a id="r-out" href="${dir}/lain.html">Di luar base</a>
<a id="r-ext" href="https://example.com${base}/mahasiswa">Eksternal</a>
<a id="r-blank" href="${base}/mahasiswa" target="_blank">Tab baru</a>
<a id="r-dl" href="${base}/mahasiswa" download>Unduh</a>
<a id="r-anchor" href="#bagian">Bagian</a>`;
        const router = startRouter({
            "/": page("Beranda"),
            "/mahasiswa": page("Daftar"),
            "/mahasiswa/:id": page("Detail")
        }, { mode: "history", base: base + "/", outlet: "router-outlet", links: "#router-nav a" });
        await wait(0);
        assert.equal(outlet.querySelector("h1").textContent, "Detail", "URL awal dibaca;");
        assert.equal(document.getElementById("router-info").textContent, '{"id":"3"} urut=nama');
        assert.equal(router.href("/mahasiswa"), base + "/mahasiswa");

        await router.navigate("/");
        assert.equal(location.pathname, base + "/");
        assert.equal(document.getElementById("r-home").getAttribute("aria-current"), "page");

        // Pendengar sesudah router: mencatat apakah router mencegah navigasi, lalu mencegah
        // sisanya supaya halaman uji tidak benar-benar pindah.
        const prevented = {};
        const record = event => {
            const link = event.target.closest("a");
            prevented[link.id + (event.ctrlKey ? "+ctrl" : "")] = event.defaultPrevented;
            event.preventDefault();
        };
        document.addEventListener("click", record);
        for (const id of ["r-list", "r-out", "r-ext", "r-blank", "r-dl", "r-anchor"]) document.getElementById(id).click();
        document.getElementById("r-list").dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, ctrlKey: true }));
        document.removeEventListener("click", record);
        assert.deepEqual(prevented, {
            "r-list": true, "r-out": false, "r-ext": false, "r-blank": false, "r-dl": false, "r-anchor": false, "r-list+ctrl": false
        });
        await wait(20);
        assert.equal(location.pathname, base + "/mahasiswa");
        assert.equal(outlet.querySelector("h1").textContent, "Daftar");
        assert.equal(document.getElementById("r-list").getAttribute("aria-current"), "page");

        history.back();
        await wait(100);
        assert.equal(outlet.querySelector("h1").textContent, "Beranda");

        await router.navigate("/mahasiswa/5", { replace: true });
        history.back();
        await wait(100);
        assert.equal(outlet.querySelector("h1").textContent, "Detail", "replace tidak menambah riwayat;");
        cleanup(router);
    });
});
