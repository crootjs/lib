import { describe, test, assert, wait } from "./runner.js";
import { setCookieWithExpireDay, getCookie, deleteCookie } from "../cookie.js";
import { setLocal, getLocal, deleteLocal, setLocalWithExpireSecond, setSession, getSession } from "../storage.js";
import { debounce, throttle } from "../debounce.js";
import { validatePhoneNumber, formatRupiah, validateUserName } from "../validate.js";
import { getQueryString, folderPath } from "../url.js";
import { setInner, getValue, setValue, onClick, getValueSelect, getTextSelect } from "../element.js";
import { getJSON, postJSON } from "../api.js";

describe("cookie.js", () => {
    test("simpan, baca, hapus", () => {
        setCookieWithExpireDay("crootjs_uji", "nilai 1", 1);
        assert.equal(getCookie("crootjs_uji"), "nilai 1");
        deleteCookie("crootjs_uji");
        assert.equal(getCookie("crootjs_uji"), "");
    });
    test("nilai dan nama berisi ; % dan spasi tetap utuh", () => {
        setCookieWithExpireDay("crootjs uji", "a;b=50% c", 1);
        assert.equal(getCookie("crootjs uji"), "a;b=50% c");
        deleteCookie("crootjs uji");
        assert.equal(getCookie("crootjs uji"), "");
    });
});

describe("storage.js", () => {
    test("localStorage dan sessionStorage", () => {
        setLocal("crootjs_uji", { a: 1 });
        assert.deepEqual(getLocal("crootjs_uji"), { a: 1 });
        deleteLocal("crootjs_uji");
        assert.equal(getLocal("crootjs_uji"), null);
        setSession("crootjs_uji", "x");
        assert.equal(getSession("crootjs_uji"), "x");
    });
    test("penyimpanan yang diblokir tidak menghentikan halaman", () => {
        const descriptor = Object.getOwnPropertyDescriptor(window, "localStorage");
        Object.defineProperty(window, "localStorage", { configurable: true, get() { throw new DOMException("diblokir", "SecurityError"); } });
        try {
            assert.equal(getLocal("crootjs_uji"), null);
            assert.equal(setLocal("crootjs_uji", 1), false);
            deleteLocal("crootjs_uji");
        } finally {
            Object.defineProperty(window, "localStorage", descriptor);
        }
        assert.equal(setLocal("crootjs_uji", 1), true);
        deleteLocal("crootjs_uji");
    });
    test("kedaluwarsa", async () => {
        setLocalWithExpireSecond("crootjs_uji_exp", "sebentar", 0.05);
        assert.equal(getLocal("crootjs_uji_exp"), "sebentar");
        await wait(80);
        assert.equal(getLocal("crootjs_uji_exp"), null);
    });
});

describe("debounce.js", () => {
    test("debounce memanggil sekali setelah diam", async () => {
        let calls = 0;
        const run = debounce(() => calls++, 30);
        run(); run(); run();
        assert.equal(calls, 0);
        await wait(60);
        assert.equal(calls, 1);
    });
    test("throttle: sekali langsung, sekali di akhir", async () => {
        let calls = 0;
        const run = throttle(() => calls++, 40);
        run(); run(); run();
        assert.equal(calls, 1);
        await wait(80);
        assert.equal(calls, 2);
    });
});

describe("validate.js", () => {
    test("nomor telepon jadi 62..., rupiah berformat, username bersih", () => {
        const input = document.createElement("input");
        input.value = "0812-3456 789";
        validatePhoneNumber(input);
        assert.equal(input.value, "628123456789");
        input.value = "1500000";
        formatRupiah(input);
        assert.equal(input.value, "Rp. 1.500.000");
        input.value = "Nama Saya!";
        validateUserName(input);
        assert.equal(input.value, "namasaya");
    });
});

describe("url.js", () => {
    test("folderPath membuang nama file saja", () => {
        const before = location.href;
        const cases = [["/a/b/index.html", "/a/b/"], ["/js/app.min.js", "/js/"], ["/v1.2/page", "/v1.2/page"], ["/docs/", "/docs/"]];
        cases.forEach(([path, expected]) => {
            history.replaceState(null, "", path);
            assert.equal(folderPath(), expected, path);
        });
        history.replaceState(null, "", before);
    });
    test("getQueryString", () => {
        const before = location.href;
        history.replaceState(null, "", "?uji=satu%20dua");
        assert.equal(getQueryString().uji, "satu dua");
        history.replaceState(null, "", before);
    });
});

describe("element.js", () => {
    test("setInner, getValue, setValue, onClick", () => {
        const box = document.createElement("div");
        box.innerHTML = '<span id="uji-span"></span><input id="uji-input"><button id="uji-button"></button>';
        document.body.appendChild(box);
        setInner("uji-span", "<b>halo</b>");
        assert.equal(document.getElementById("uji-span").textContent, "halo");
        setValue("uji-input", "abc");
        assert.equal(getValue("uji-input"), "abc");
        let clicked = 0;
        onClick("uji-button", () => clicked++);
        box.insertAdjacentHTML("beforeend", '<select id="uji-select"><option value="a">Satu</option><option value="b" selected>Dua</option></select>');
        assert.equal(getValueSelect("uji-select"), "b");
        assert.equal(getTextSelect("uji-select"), "Dua");
        document.getElementById("uji-button").click();
        assert.equal(clicked, 1);
        box.remove();
    });
});

describe("api.js", () => {
    test("getJSON: callback dan await memberi hasil yang sama", async () => {
        const url = "data:application/json," + encodeURIComponent('{"nama":"croot"}');
        let fromCallback = null;
        const result = await getJSON(url, response => { fromCallback = response; });
        assert.equal(result.status, 200);
        assert.deepEqual(result.data, { nama: "croot" });
        assert.deepEqual(fromCallback, result);
    });
    test("tanpa callback, jaringan gagal = status 0 (tidak reject)", async () => {
        const result = await postJSON("http://127.0.0.1:9/tidak-ada", { a: 1 }, null);
        assert.equal(result.status, 0);
        assert.equal(result.data, null);
        assert.equal(result.error, "network");
    });
    test("Content-Type hanya kalau ada body; header tambahan; header respons terbaca", async () => {
        const sent = [];
        const original = window.fetch;
        window.fetch = (url, options) => {
            sent.push(options.headers);
            return Promise.resolve(new Response('{"ok":1}', { status: 200, headers: { "X-RateLimit-Remaining": "59" } }));
        };
        try {
            const result = await getJSON("https://contoh.test/a", null, { headers: { Authorization: "Bearer x" } });
            await postJSON("https://contoh.test/b", { a: 1 }, null, "login", "token");
            assert.equal(sent[0].has("Content-Type"), false);
            assert.equal(sent[0].get("Authorization"), "Bearer x");
            assert.equal(sent[1].get("Content-Type"), "application/json");
            assert.equal(sent[1].get("login"), "token");
            assert.equal(result.headers.get("X-RateLimit-Remaining"), "59");
            assert.equal(result.error, null);
        } finally {
            window.fetch = original;
        }
    });
    test("timeout bisa diatur dan dilaporkan sebagai error timeout", async () => {
        const original = window.fetch;
        window.fetch = (url, options) => new Promise((resolve, reject) => {
            options.signal.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
        });
        try {
            const started = performance.now();
            const result = await getJSON("https://contoh.test/lambat", null, { timeout: 50 });
            assert.ok(performance.now() - started < 1000, "timeout 50 ms tidak dipakai");
            assert.equal(result.status, 0);
            assert.equal(result.error, "timeout");
        } finally {
            window.fetch = original;
        }
    });
    test("cache: tanpa request selama ttl, lalu If-None-Match dan 304 memakai data tersimpan", async () => {
        deleteLocal("crootjs_uji_cache");
        const sent = [];
        const original = window.fetch;
        window.fetch = (url, options) => {
            sent.push(options.headers);
            if (options.headers.get("If-None-Match") === '"v1"') return Promise.resolve(new Response(null, { status: 304 }));
            return Promise.resolve(new Response('{"versi":1}', { status: 200, headers: { ETag: '"v1"' } }));
        };
        try {
            const cache = { key: "crootjs_uji_cache", ttl: 0.05 };
            const first = await getJSON("https://contoh.test/rilis", null, { cache });
            const second = await getJSON("https://contoh.test/rilis", null, { cache });
            assert.equal(sent.length, 1);
            assert.deepEqual(second.data, { versi: 1 });
            assert.equal(second.cached, true);
            assert.equal(first.cached, false);
            await wait(80);
            const third = await getJSON("https://contoh.test/rilis", null, { cache });
            assert.equal(sent.length, 2);
            assert.equal(sent[1].get("If-None-Match"), '"v1"');
            assert.equal(third.status, 200);
            assert.deepEqual(third.data, { versi: 1 });
            assert.equal(third.cached, true);
        } finally {
            window.fetch = original;
            deleteLocal("crootjs_uji_cache");
        }
    });
    test("cache.staleIfError: sesudah ttl, 403 atau jaringan putus memberi data tersimpan", async () => {
        deleteLocal("crootjs_uji_cache");
        const original = window.fetch;
        let mode = "ok";
        window.fetch = () => {
            if (mode === "ok") return Promise.resolve(new Response('{"versi":1}', { status: 200 }));
            if (mode === "403") return Promise.resolve(new Response('{"message":"rate limit"}', { status: 403 }));
            return Promise.reject(new TypeError("Failed to fetch"));
        };
        try {
            const url = "https://contoh.test/rilis";
            await getJSON(url, null, { cache: { key: "crootjs_uji_cache", ttl: 0 } });
            mode = "403";
            const plain = await getJSON(url, null, { cache: { key: "crootjs_uji_cache", ttl: 0 } });
            assert.equal(plain.status, 403, "tanpa staleIfError galatnya tetap dilaporkan");
            assert.equal(plain.stale, undefined);
            const cache = { key: "crootjs_uji_cache", ttl: 0, staleIfError: true };
            const limited = await getJSON(url, null, { cache });
            assert.equal(limited.status, 200);
            assert.deepEqual(limited.data, { versi: 1 });
            assert.equal(limited.cached, true);
            assert.equal(limited.stale, true);
            mode = "network";
            const offline = await getJSON(url, null, { cache });
            assert.equal(offline.status, 200);
            assert.equal(offline.stale, true);
            assert.equal(offline.error, null);
            const controller = new AbortController();
            controller.abort();
            const aborted = await getJSON(url, null, { cache, signal: controller.signal });
            assert.equal(aborted.status, 0, "dibatalkan sendiri tidak diganti data lama");
            assert.equal(aborted.error, "abort");
        } finally {
            window.fetch = original;
            deleteLocal("crootjs_uji_cache");
        }
    });
    test("callback selalu jalan sesudah baris setelah getJSON, juga saat data dari cache", async () => {
        deleteLocal("crootjs_uji_cache");
        const original = window.fetch;
        window.fetch = () => Promise.resolve(new Response('{"v":1}', { status: 200 }));
        try {
            const cache = { key: "crootjs_uji_cache", ttl: 60 };
            for (const sumber of ["jaringan", "cache"]) {
                const urutan = [];
                const done = getJSON("https://contoh.test/urutan", () => urutan.push("callback"), { cache });
                urutan.push("sesudah getJSON");
                await done;
                assert.deepEqual(urutan, ["sesudah getJSON", "callback"], sumber);
            }
        } finally {
            window.fetch = original;
            deleteLocal("crootjs_uji_cache");
        }
    });
    test("cache.select yang melempar error: error \"select\", status asli, tidak disimpan, tidak ditutupi data lama", async () => {
        deleteLocal("crootjs_uji_cache");
        const original = window.fetch;
        const report = console.error;
        console.error = () => {};
        let body = '{"rilis":{"tag":"v1"}}';
        window.fetch = () => Promise.resolve(new Response(body, { status: 200 }));
        try {
            const url = "https://contoh.test/select";
            const cache = { key: "crootjs_uji_cache", ttl: 0, staleIfError: true, select: d => ({ tag: d.rilis.tag }) };
            assert.deepEqual((await getJSON(url, null, { cache })).data, { tag: "v1" });
            // Server mengubah bentuk jawabannya, jadi select yang sama melempar TypeError.
            body = '{"release":{"tag":"v2"}}';
            const broken = await getJSON(url, null, { cache });
            assert.equal(broken.status, 200);
            assert.equal(broken.error, "select");
            assert.equal(broken.data, null);
            assert.equal(broken.stale, undefined, "bukan kegagalan request, jadi tidak diganti data lama");
            assert.deepEqual(getLocal("crootjs_uji_cache").data, { tag: "v1" }, "entri lama tidak ditimpa");
        } finally {
            window.fetch = original;
            console.error = report;
            deleteLocal("crootjs_uji_cache");
        }
    });
    test("select diganti: entri berbentuk lama tidak dipakai, juga tidak diperpanjang lewat 304", async () => {
        deleteLocal("crootjs_uji_cache");
        const sent = [];
        const original = window.fetch;
        window.fetch = (url, options) => {
            sent.push(options.headers.get("If-None-Match"));
            if (options.headers.get("If-None-Match") === '"e1"') return Promise.resolve(new Response(null, { status: 304 }));
            return Promise.resolve(new Response('{"v":1,"w":2}', { status: 200, headers: { ETag: '"e1"' } }));
        };
        try {
            const url = "https://contoh.test/bentuk";
            const lama = await getJSON(url, null, { cache: { key: "crootjs_uji_cache", ttl: 0, select: d => ({ v: d.v }) } });
            assert.deepEqual(lama.data, { v: 1 });
            const baru = await getJSON(url, null, { cache: { key: "crootjs_uji_cache", ttl: 0, select: d => ({ v: d.v, w: d.w }) } });
            assert.equal(sent[1], null, "tanpa If-None-Match, karena data tersimpan berbentuk lama");
            assert.deepEqual(baru.data, { v: 1, w: 2 });
        } finally {
            window.fetch = original;
            deleteLocal("crootjs_uji_cache");
        }
    });
    test("staleReason, lalu jeda sesuai Retry-After / X-RateLimit-Reset setelah 403 atau 429", async () => {
        deleteLocal("crootjs_uji_cache");
        let calls = 0;
        let reply = () => new Response('{"v":1}', { status: 200 });
        const original = window.fetch;
        window.fetch = () => {
            calls++;
            const response = reply();
            return response ? Promise.resolve(response) : Promise.reject(new TypeError("Failed to fetch"));
        };
        try {
            const url = "https://contoh.test/kuota";
            const cache = { key: "crootjs_uji_cache", ttl: 0, staleIfError: true };
            await getJSON(url, null, { cache });
            reply = () => null;
            assert.equal((await getJSON(url, null, { cache })).staleReason, "network");
            reply = () => new Response("{}", { status: 500 });
            assert.equal((await getJSON(url, null, { cache })).staleReason, 500);
            assert.equal(calls, 3, "tanpa petunjuk jeda, setiap panggilan tetap meminta ke server");

            const reset = Math.floor(Date.now() / 1000) + 120;
            reply = () => new Response("{}", { status: 403, headers: { "X-RateLimit-Remaining": "0", "X-RateLimit-Reset": String(reset) } });
            const limited = await getJSON(url, null, { cache });
            assert.equal(limited.staleReason, 403);
            const paused = await getJSON(url, null, { cache });
            assert.equal(calls, 4, "selama jeda tidak ada request");
            assert.equal(paused.stale, true);
            assert.equal(paused.staleReason, 403);
            assert.deepEqual(paused.data, { v: 1 });

            deleteLocal("crootjs_uji_cache");
            reply = () => new Response('{"v":1}', { status: 200 });
            await getJSON(url, null, { cache });
            reply = () => new Response("{}", { status: 429, headers: { "Retry-After": "30" } });
            await getJSON(url, null, { cache });
            const stored = getLocal("crootjs_uji_cache");
            assert.ok(stored.retryAt > Date.now() + 25000 && stored.retryAt <= Date.now() + 30000, `retryAt ${stored.retryAt - Date.now()} ms`);
            assert.equal((await getJSON(url, null, { cache })).staleReason, 429);
            assert.equal(calls, 6);

            setLocal("crootjs_uji_cache", { ...stored, retryAt: Date.now() - 1 });
            reply = () => new Response('{"v":2}', { status: 200 });
            const lagi = await getJSON(url, null, { cache });
            assert.deepEqual(lagi.data, { v: 2 }, "sesudah jeda meminta lagi");
            assert.equal(getLocal("crootjs_uji_cache").retryAt, undefined);
        } finally {
            window.fetch = original;
            deleteLocal("crootjs_uji_cache");
        }
    });
    test("cache terikat ke URL; select memangkas data yang disimpan dan dikembalikan", async () => {
        deleteLocal("crootjs_uji_cache");
        const sent = [];
        const original = window.fetch;
        window.fetch = url => {
            sent.push(url);
            return Promise.resolve(new Response(JSON.stringify({ tag_name: "v" + sent.length, body: "x".repeat(500) }), { status: 200 }));
        };
        try {
            const cache = { key: "crootjs_uji_cache", ttl: 60, select: data => ({ tag: data.tag_name }) };
            const first = await getJSON("https://contoh.test/a", null, { cache });
            assert.deepEqual(first.data, { tag: "v1" });
            assert.deepEqual(getLocal("crootjs_uji_cache").data, { tag: "v1" });
            const again = await getJSON("https://contoh.test/a", null, { cache });
            assert.equal(again.cached, true);
            assert.deepEqual(again.data, { tag: "v1" });
            const other = await getJSON("https://contoh.test/b", null, { cache });
            assert.equal(sent.length, 2, "URL lain dengan key sama tetap meminta ke server");
            assert.equal(other.cached, false);
            assert.deepEqual(other.data, { tag: "v2" });
        } finally {
            window.fetch = original;
            deleteLocal("crootjs_uji_cache");
        }
    });
});
