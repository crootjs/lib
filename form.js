// Validasi form dengan pesan di bawah setiap field yang salah. Aturannya diambil dari atribut
// HTML biasa (required, type="email", minlength, maxlength, min, max, pattern, step), ditambah
// aturan sendiri per field. Pesan bawaan berbahasa Indonesia dan bisa diganti.
// Aksesibel: field yang salah diberi aria-invalid="true", pesannya disambungkan lewat
// aria-describedby (dibacakan pembaca layar), dan fokus pindah ke field salah yang pertama.
import { serializeForm } from "./element.js";

const MESSAGES = {
    valueMissing: () => "Wajib diisi.",
    typeMismatch: field => field.type === "email" ? "Format email tidak valid." : field.type === "url" ? "Format URL tidak valid." : "Format tidak valid.",
    tooShort: field => `Minimal ${field.minLength} karakter.`,
    tooLong: field => `Maksimal ${field.maxLength} karakter.`,
    rangeUnderflow: field => `Minimal ${field.min}.`,
    rangeOverflow: field => `Maksimal ${field.max}.`,
    stepMismatch: () => "Nilainya tidak sesuai kelipatan yang diizinkan.",
    badInput: () => "Isi dengan angka.",
    // Atribut title menjelaskan pola yang diminta, seperti saran HTML untuk pattern.
    patternMismatch: field => field.title || "Format tidak sesuai."
};
const ORDER = Object.keys(MESSAGES);

function injectStyles() {
    if (document.getElementById("crootjs-form-style")) return;
    const style = document.createElement("style");
    style.id = "crootjs-form-style";
    style.textContent = `
.crootjs-field-error {
    color: #b91c1c;
    font-size: 0.875em;
    margin: 0.25em 0 0;
}
`;
    const previous = [...document.head.querySelectorAll('style[id^="crootjs-"]')].pop();
    if (previous) previous.after(style);
    else document.head.prepend(style);
}

function formOf(id) {
    const form = document.getElementById(id);
    if (!form || form.tagName !== "FORM") {
        console.warn(`Form dengan ID "${id}" tidak ditemukan.`);
        return null;
    }
    return form;
}

// Field yang divalidasi, satu per nama (radio dan checkbox sekelompok diwakili yang pertama).
function fieldsOf(form) {
    const seen = new Set();
    const fields = [];
    for (const field of form.elements) {
        if (!field.name || field.disabled || !field.willValidate) continue;
        if (seen.has(field.name)) continue;
        seen.add(field.name);
        fields.push(field);
    }
    return fields;
}

function groupOf(form, field) {
    return field.type === "radio" || field.type === "checkbox"
        ? [...form.elements].filter(element => element.name === field.name)
        : [field];
}

// Browser hanya memeriksa minlength/maxlength untuk ketikan pengguna, bukan nilai yang diisi
// lewat kode (fillForm, setValue), jadi panjangnya diperiksa sendiri.
function lengthProblem(field) {
    const length = typeof field.value === "string" ? field.value.length : 0;
    if (length === 0) return null;
    if (field.minLength > 0 && length < field.minLength) return "tooShort";
    if (field.maxLength >= 0 && length > field.maxLength) return "tooLong";
    return null;
}

// Pesan untuk satu field: aturan sendiri dulu (fungsi (nilai, semuaNilai) => pesan atau null),
// lalu validasi bawaan browser.
function messageFor(form, field, values, options) {
    const rule = options.rules && options.rules[field.name];
    for (const element of groupOf(form, field)) element.setCustomValidity("");
    if (typeof rule === "function") {
        const custom = rule(values[field.name], values);
        if (custom) return custom;
    }
    const invalid = groupOf(form, field).find(element => !element.validity.valid || lengthProblem(element)) || null;
    if (!invalid) return null;
    const kind = ORDER.find(name => invalid.validity[name]) || lengthProblem(invalid);
    const own = options.messages && options.messages[field.name];
    if (typeof own === "string") return own;
    if (own && typeof own[kind] === "string") return own[kind];
    return kind ? MESSAGES[kind](invalid) : invalid.validationMessage;
}

// Tempat pesan: sesudah fieldset kelompok radio/checkbox, sesudah <label> yang membungkus field,
// atau tepat sesudah field.
function anchorOf(form, field) {
    const group = groupOf(form, field);
    if (group.length > 1) {
        const fieldset = field.closest("fieldset");
        if (fieldset && group.every(element => fieldset.contains(element))) return { parent: fieldset, after: null };
        field = group[group.length - 1];
    }
    const label = field.closest("label");
    return { parent: null, after: label && form.contains(label) ? label : field };
}

function errorId(form, field) {
    return `${form.id || "form"}-${field.id || field.name}-error`.replace(/[^\w-]/g, "-");
}

function showError(form, field, message) {
    const id = errorId(form, field);
    let note = document.getElementById(id);
    if (!note) {
        note = document.createElement("p");
        note.id = id;
        note.className = "crootjs-field-error";
        const anchor = anchorOf(form, field);
        if (anchor.parent) anchor.parent.appendChild(note);
        else anchor.after.after(note);
    }
    note.textContent = message;
    for (const element of groupOf(form, field)) {
        element.setAttribute("aria-invalid", "true");
        const described = (element.getAttribute("aria-describedby") || "").split(" ").filter(Boolean);
        if (!described.includes(id)) element.setAttribute("aria-describedby", described.concat(id).join(" "));
    }
}

function hideError(form, field) {
    const id = errorId(form, field);
    const note = document.getElementById(id);
    if (note) note.remove();
    for (const element of groupOf(form, field)) {
        element.removeAttribute("aria-invalid");
        const described = (element.getAttribute("aria-describedby") || "").split(" ").filter(part => part && part !== id);
        if (described.length) element.setAttribute("aria-describedby", described.join(" "));
        else element.removeAttribute("aria-describedby");
    }
}

// Memeriksa semua field form id dan menampilkan/menghapus pesannya. Mengembalikan true kalau
// semuanya benar; kalau tidak, fokus pindah ke field salah yang pertama.
// options (semua opsional):
//   rules     { namaField: (nilai, semuaNilai) => "pesan" | null } - aturan tambahan, misalnya
//             konfirmasi kata sandi. nilai dari serializeForm.
//   messages  { namaField: "pesan" } atau { namaField: { valueMissing: "...", tooShort: "..." } }
//             untuk mengganti pesan bawaan.
//   focus     false supaya fokus tidak dipindah. Bawaan true.
export function validateForm(id, options = {}) {
    const form = formOf(id);
    if (!form) return false;
    injectStyles();
    const values = serializeForm(id);
    let first = null;
    for (const field of fieldsOf(form)) {
        const message = messageFor(form, field, values, options);
        if (message) {
            showError(form, field, message);
            if (!first) first = field;
        } else {
            hideError(form, field);
        }
    }
    if (first && options.focus !== false) first.focus();
    return !first;
}

// Menghapus semua pesan validasi di form.
export function clearFormErrors(id) {
    const form = formOf(id);
    if (!form) return;
    for (const field of fieldsOf(form)) hideError(form, field);
}

// Menangani submit form: mencegah reload halaman, memvalidasi, lalu memanggil
// onSubmit(data, event) hanya kalau semuanya benar; data dari serializeForm. Sesudah percobaan
// submit pertama, field diperiksa ulang setiap diubah, jadi pesannya hilang begitu diperbaiki.
// Pesan bawaan browser (gelembung) dimatikan dengan novalidate. options sama dengan validateForm.
// Mengembalikan { validate(), clear(), remove() }.
export function handleForm(id, onSubmit, options = {}) {
    const form = formOf(id);
    const none = { validate() { return false; }, clear() {}, remove() {} };
    if (!form) return none;
    form.noValidate = true;
    let attempted = false;
    const recheck = event => {
        if (!attempted || !event.target.name) return;
        const values = serializeForm(id);
        const field = fieldsOf(form).find(candidate => candidate.name === event.target.name);
        if (!field) return;
        const message = messageFor(form, field, values, options);
        if (message) showError(form, field, message);
        else hideError(form, field);
    };
    const submit = event => {
        event.preventDefault();
        attempted = true;
        if (validateForm(id, options) && typeof onSubmit === "function") onSubmit(serializeForm(id), event);
    };
    form.addEventListener("submit", submit);
    form.addEventListener("input", recheck);
    form.addEventListener("change", recheck);
    return {
        validate: () => validateForm(id, options),
        clear: () => clearFormErrors(id),
        remove() {
            form.removeEventListener("submit", submit);
            form.removeEventListener("input", recheck);
            form.removeEventListener("change", recheck);
            form.noValidate = false;
            clearFormErrors(id);
        }
    };
}
