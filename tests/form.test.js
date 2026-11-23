import { describe, test, assert } from "./runner.js";
import { serializeForm, fillForm } from "../element.js";
import { validateForm, handleForm, clearFormErrors } from "../form.js";

function makeForm(html) {
    const form = document.createElement("form");
    form.id = "uji-form";
    form.innerHTML = html;
    document.body.appendChild(form);
    return form;
}

const FIELDS = `
<label for="f-nama">Nama</label><input id="f-nama" name="nama" required minlength="3">
<label for="f-email">Email</label><input id="f-email" name="email" type="email" aria-describedby="f-email-help"><small id="f-email-help">Opsional</small>
<input id="f-sandi" name="sandi" type="password">
<input id="f-ulang" name="ulang" type="password">
<fieldset><legend>Jenis</legend>
  <label><input type="radio" name="jenis" value="a" required> A</label>
  <label><input type="radio" name="jenis" value="b"> B</label>
</fieldset>
<label><input type="checkbox" name="hobi" value="baca"> Baca</label>
<label><input type="checkbox" name="hobi" value="lari"> Lari</label>
<label><input type="checkbox" name="setuju"> Setuju</label>
<select name="kota" multiple><option value="bdg">Bandung</option><option value="jkt">Jakarta</option></select>
<button type="submit">Kirim</button>`;

describe("element.js: serializeForm dan fillForm", () => {
    test("fillForm lalu serializeForm memberi data yang sama", () => {
        const form = makeForm(FIELDS);
        const data = { nama: "Sari", email: "sari@contoh.id", sandi: "", ulang: "", jenis: "b", hobi: ["lari"], setuju: true, kota: ["bdg", "jkt"] };
        fillForm("uji-form", data);
        assert.deepEqual(serializeForm("uji-form"), data);
        fillForm("uji-form", { hobi: [], kota: [] });
        const after = serializeForm("uji-form");
        assert.deepEqual(after.hobi, []);
        assert.deepEqual(after.kota, []);
        assert.equal(after.nama, "Sari", "field yang tidak ada di data tidak diubah");
        form.remove();
    });
});

describe("form.js", () => {
    test("pesan di bawah field, aria, fokus, aturan sendiri, pesan pengganti", () => {
        const form = makeForm(FIELDS);
        fillForm("uji-form", { nama: "Sa", email: "bukan-email", sandi: "rahasia1", ulang: "rahasia2" });
        const options = {
            rules: { ulang: (value, all) => value !== all.sandi ? "Kata sandi tidak sama." : null },
            messages: { jenis: "Pilih salah satu jenis." }
        };
        assert.equal(validateForm("uji-form", options), false);
        const nama = document.getElementById("f-nama");
        const note = id => document.getElementById(`uji-form-${id}-error`);
        assert.equal(note("f-nama").textContent, "Minimal 3 karakter.");
        assert.equal(note("f-email").textContent, "Format email tidak valid.");
        assert.equal(note("f-ulang").textContent, "Kata sandi tidak sama.");
        assert.equal(note("jenis").textContent, "Pilih salah satu jenis.");
        assert.equal(note("jenis").parentElement.tagName, "FIELDSET");
        assert.equal(nama.getAttribute("aria-invalid"), "true");
        assert.equal(document.getElementById("f-email").getAttribute("aria-describedby"), "f-email-help uji-form-f-email-error");
        assert.equal(document.activeElement, nama);
        assert.equal(note("f-sandi"), null);

        fillForm("uji-form", { nama: "Sari", email: "", ulang: "rahasia1", jenis: "a" });
        assert.equal(validateForm("uji-form", options), true);
        assert.equal(form.querySelectorAll(".crootjs-field-error").length, 0);
        assert.equal(nama.hasAttribute("aria-invalid"), false);
        assert.equal(document.getElementById("f-email").getAttribute("aria-describedby"), "f-email-help");
        form.remove();
    });
    test("handleForm: submit hanya kalau benar; pesan hilang begitu diperbaiki", () => {
        const form = makeForm(FIELDS);
        const submitted = [];
        const handler = handleForm("uji-form", data => submitted.push(data));
        form.requestSubmit();
        assert.equal(submitted.length, 0);
        assert.ok(document.getElementById("uji-form-f-nama-error"));
        const nama = document.getElementById("f-nama");
        nama.value = "Sari";
        nama.dispatchEvent(new Event("input", { bubbles: true }));
        assert.equal(document.getElementById("uji-form-f-nama-error"), null);
        form.querySelector('input[name="jenis"]').click();
        form.requestSubmit();
        assert.equal(submitted.length, 1);
        assert.equal(submitted[0].nama, "Sari");
        handler.remove();
        assert.equal(form.noValidate, false);
        clearFormErrors("uji-form");
        form.remove();
    });
});
