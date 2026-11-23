import { describe, test, assert, wait } from "./runner.js";
import { setCookieWithExpireDay, getCookie, deleteCookie } from "../cookie.js";
import { setLocal, getLocal, deleteLocal, setLocalWithExpireSecond, setSession, getSession } from "../storage.js";
import { debounce, throttle } from "../debounce.js";
import { validatePhoneNumber, formatRupiah, validateUserName } from "../validate.js";
import { getQueryString } from "../url.js";
import { setInner, getValue, setValue, onClick } from "../element.js";
import { getJSON, postJSON } from "../api.js";

describe("cookie.js", () => {
    test("simpan, baca, hapus", () => {
        setCookieWithExpireDay("crootjs_uji", "nilai 1", 1);
        assert.equal(getCookie("crootjs_uji"), "nilai 1");
        deleteCookie("crootjs_uji");
        assert.equal(getCookie("crootjs_uji"), "");
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
});
