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
        assert.deepEqual(result, { status: 200, data: { nama: "croot" } });
        assert.deepEqual(fromCallback, result);
    });
    test("tanpa callback, jaringan gagal = status 0 (tidak reject)", async () => {
        const result = await postJSON("http://127.0.0.1:9/tidak-ada", { a: 1 }, null);
        assert.deepEqual(result, { status: 0, data: null });
    });
});
