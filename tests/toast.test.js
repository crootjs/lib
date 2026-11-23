import { describe, test, assert, wait } from "./runner.js";
import { toast, toastError, toastSuccess } from "../toast.js";

describe("toast.js", () => {
    test("wadah adalah live region; toast pertama masuk setelah wadah ada", async () => {
        document.getElementById("crootjs-toast-container")?.remove();
        const dismiss = toastSuccess("Tersimpan", 0);
        const container = document.getElementById("crootjs-toast-container");
        assert.equal(container.getAttribute("aria-live"), "polite");
        assert.equal(container.children.length, 0, "belum dimasukkan selagi live region baru dibuat");
        await wait(150);
        const el = container.querySelector(".crootjs-toast-success");
        assert.equal(el.textContent, "Tersimpan");
        assert.equal(el.getAttribute("role"), null, "selain galat tidak memotong pembacaan");
        dismiss();
        await wait(300);
        assert.equal(container.children.length, 0);
    });

    test("beberapa toast sekaligus di wadah baru tetap berurutan", async () => {
        document.getElementById("crootjs-toast-container")?.remove();
        const closers = ["satu", "dua", "tiga"].map((text) => toast(text, "info", 0));
        await wait(150);
        const texts = [...document.querySelectorAll("#crootjs-toast-container .crootjs-toast")].map((el) => el.textContent);
        assert.deepEqual(texts, ["satu", "dua", "tiga"]);
        closers.forEach((dismiss) => dismiss());
        await wait(300);
    });

    test("toastError memakai role=alert dan langsung masuk ke wadah yang sudah ada", async () => {
        const dismiss = toastError("<b>Gagal</b>", 0);
        const el = document.querySelector("#crootjs-toast-container .crootjs-toast-error");
        assert.equal(el.getAttribute("role"), "alert");
        assert.equal(el.textContent, "<b>Gagal</b>", "pesan dipasang sebagai teks");
        dismiss();
        await wait(300);
        assert.equal(el.isConnected, false);
    });

    test("hilang sendiri setelah duration; dismiss() kedua kali tidak berpengaruh", async () => {
        const dismiss = toast("Sebentar", "info", 50);
        const el = document.querySelector("#crootjs-toast-container .crootjs-toast-info");
        assert.ok(el);
        await wait(350);
        assert.equal(el.isConnected, false);
        dismiss();
    });

    test("warna dari variabel croot.css, style di awal head", () => {
        const style = document.getElementById("crootjs-toast-style");
        assert.ok(style.textContent.includes("var(--croot-danger, #b91c1c)"));
        assert.ok(!style.previousElementSibling || style.previousElementSibling.matches('style[id^="crootjs-"]'),
            "tidak didahului stylesheet halaman");
    });
});
