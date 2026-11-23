import { describe, test, assert } from "./runner.js";
import { createTable } from "../table.js";

function makeBox() {
    // Uji sebelumnya yang gagal di tengah jalan tidak sempat membuang wadahnya.
    document.getElementById("uji-tabel")?.remove();
    const box = document.createElement("div");
    box.id = "uji-tabel";
    document.body.appendChild(box);
    return box;
}

const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
const cells = (box, col = 0) => [...box.querySelectorAll("tbody tr")].map(tr => tr.cells[col].textContent);
const info = box => box.querySelector(".crootjs-table-info").textContent;
const sortButton = (box, i) => box.querySelectorAll("thead th")[i].querySelector("button");
const pageButtons = box => [...box.querySelectorAll(".crootjs-table-pages button")];

function typeSearch(box, text) {
    const input = box.querySelector('input[type="search"]');
    input.value = text;
    input.dispatchEvent(new Event("input", { bubbles: true }));
}

const NAMES = ["Budi", "ani", "Çiça", "Dedi", "item 10", "item 2", "Eka"];
const ROWS = Array.from({ length: 57 }, (_, i) => ({ no: i + 1, nama: `Orang ${i + 1}`, kota: i % 2 ? "Bandung" : "Garut" }));

describe("table.js", () => {
    test("render: <table>, label kolom, keterangan, label input cari", () => {
        const box = makeBox();
        createTable("uji-tabel", {
            columns: [{ key: "no", label: "No" }, { key: "nama", label: "Nama" }, { key: "kota", label: "Kota" }],
            rows: ROWS
        });
        assert.ok(box.querySelector("table"));
        assert.deepEqual([...box.querySelectorAll("thead th")].map(th => th.textContent.replace(/[↕▲▼]/g, "")), ["No", "Nama", "Kota"]);
        assert.equal(box.querySelectorAll("tbody tr").length, 10);
        assert.equal(info(box), "Menampilkan 1–10 dari 57");
        const input = box.querySelector('input[type="search"]');
        assert.equal(box.querySelector(`label[for="${input.id}"]`).textContent, "Cari");
        assert.equal(box.querySelector(".crootjs-table-info").getAttribute("role"), "status");
        box.remove();
    });

    test("urut naik/turun, aria-sort, urutan alami dan bahasa Indonesia", () => {
        const box = makeBox();
        createTable("uji-tabel", {
            columns: [{ key: "nama", label: "Nama" }, { key: "nilai", label: "Nilai" }],
            rows: NAMES.map((nama, i) => ({ nama, nilai: [5, 100, 20, null, 3, 1, 40][i] }))
        });
        const th = box.querySelectorAll("thead th");
        assert.equal(th[0].hasAttribute("aria-sort"), false);
        sortButton(box, 0).click();
        assert.equal(th[0].getAttribute("aria-sort"), "ascending");
        assert.deepEqual(cells(box), ["ani", "Budi", "Çiça", "Dedi", "Eka", "item 2", "item 10"]);
        sortButton(box, 0).click();
        assert.equal(th[0].getAttribute("aria-sort"), "descending");
        assert.deepEqual(cells(box), ["item 10", "item 2", "Eka", "Dedi", "Çiça", "Budi", "ani"]);
        sortButton(box, 1).click();
        assert.equal(th[0].hasAttribute("aria-sort"), false, "hanya satu kolom yang ber-aria-sort");
        assert.equal(th[1].getAttribute("aria-sort"), "ascending");
        assert.deepEqual(cells(box, 1), ["1", "3", "5", "20", "40", "100", ""], "angka urut numerik, kosong di akhir");
        sortButton(box, 1).click();
        assert.deepEqual(cells(box, 1), ["100", "40", "20", "5", "3", "1", ""], "kosong tetap di akhir saat turun");
        box.remove();
    });

    test("cari: tidak peka huruf besar, kembali ke halaman 1, pesan tidak cocok", () => {
        const box = makeBox();
        const table = createTable("uji-tabel", { columns: [{ key: "no" }, { key: "nama" }, { key: "kota" }], rows: ROWS });
        pageButtons(box).find(b => b.textContent === "2").click();
        assert.equal(table.getState().page, 2);
        typeSearch(box, "  BANDUNG ");
        assert.equal(table.getState().page, 1);
        assert.equal(table.getState().query, "BANDUNG");
        assert.equal(info(box), "Menampilkan 1–10 dari 28 (disaring dari 57)");
        typeSearch(box, "orang 5");
        assert.deepEqual(cells(box, 1), ["Orang 5", "Orang 50", "Orang 51", "Orang 52", "Orang 53", "Orang 54", "Orang 55", "Orang 56", "Orang 57"]);
        typeSearch(box, "tidak ada");
        assert.equal(cells(box)[0], "Tidak ada data yang cocok dengan pencarian.");
        assert.equal(box.querySelector("tbody td").colSpan, 3);
        assert.equal(info(box), "Tidak ada data yang cocok dengan pencarian.");
        box.remove();
    });

    test("halaman: batas, tombol nonaktif, aria-current, ukuran halaman, fokus tetap", () => {
        const box = makeBox();
        const table = createTable("uji-tabel", { columns: [{ key: "no" }], rows: ROWS });
        const prev = () => box.querySelector('[data-page="previous"]');
        const next = () => box.querySelector('[data-page="next"]');
        assert.equal(prev().disabled, true);
        assert.equal(box.querySelector('[aria-current="page"]').textContent, "1");
        assert.deepEqual(pageButtons(box).map(b => b.textContent), ["Sebelumnya", "1", "2", "3", "4", "5", "6", "Berikutnya"]);
        next().focus();
        next().click();
        assert.equal(document.activeElement, next(), "fokus tetap di Berikutnya");
        pageButtons(box).find(b => b.textContent === "6").click();
        assert.equal(next().disabled, true);
        assert.equal(document.activeElement, box.querySelector('[aria-current="page"]'), "Berikutnya nonaktif: fokus ke halaman aktif");
        assert.deepEqual(cells(box), ["51", "52", "53", "54", "55", "56", "57"]);
        assert.equal(info(box), "Menampilkan 51–57 dari 57");
        const select = box.querySelector("select");
        assert.equal(box.querySelector(`label[for="${select.id}"]`).textContent, "Baris per halaman");
        select.value = "25";
        select.dispatchEvent(new Event("change"));
        assert.equal(table.getState().page, 1);
        assert.equal(box.querySelectorAll("tbody tr").length, 25);
        table.setRows(ROWS.slice(0, 5));
        assert.equal(box.querySelector(".crootjs-table-pages").hidden, true, "satu halaman: navigasi disembunyikan");
        table.setRows([]);
        assert.equal(cells(box)[0], "Belum ada data.");
        assert.equal(info(box), "Belum ada data.");
        box.remove();
    });

    test("halaman banyak memakai celah …", () => {
        const box = makeBox();
        createTable("uji-tabel", { columns: [{ key: "no" }], rows: ROWS, pageSize: 5 });
        const items = () => [...box.querySelector(".crootjs-table-pages").children].map(el => el.textContent);
        assert.deepEqual(items(), ["Sebelumnya", "1", "2", "3", "4", "5", "…", "12", "Berikutnya"]);
        pageButtons(box).find(b => b.textContent === "5").click();
        pageButtons(box).find(b => b.textContent === "6").click();
        assert.deepEqual(items(), ["Sebelumnya", "1", "…", "5", "6", "7", "…", "12", "Berikutnya"]);
        pageButtons(box).find(b => b.textContent === "12").click();
        assert.deepEqual(items(), ["Sebelumnya", "1", "…", "8", "9", "10", "11", "12", "Berikutnya"]);
        box.remove();
    });

    test("format: teks dan Node; HTML di data tidak dieksekusi", () => {
        const box = makeBox();
        window.__tabelXss = false;
        createTable("uji-tabel", {
            columns: [
                { key: "nama", label: "Nama" },
                { key: "nilai", label: "Nilai", format: v => v.toLocaleString("id-ID") },
                { label: "Aksi", format: (_, row) => {
                    const button = document.createElement("button");
                    button.textContent = `Hapus ${row.nama}`;
                    return button;
                } }
            ],
            rows: [{ nama: '<img src=x onerror="window.__tabelXss=true">', nilai: 1234567 }]
        });
        const td = box.querySelectorAll("tbody td");
        assert.equal(td[0].textContent, '<img src=x onerror="window.__tabelXss=true">');
        assert.equal(box.querySelector("tbody img"), null);
        assert.equal(td[1].textContent, "1.234.567");
        assert.equal(td[2].querySelector("button").textContent, 'Hapus <img src=x onerror="window.__tabelXss=true">');
        assert.equal(box.querySelectorAll("thead th")[2].querySelector("button"), null, "kolom tanpa key tidak bisa diurut");
        return wait(50).then(() => {
            assert.equal(window.__tabelXss, false);
            box.remove();
        });
    });

    test("mode server: parameter, total, cari ditunda, jawaban lama dibuang", async () => {
        const box = makeBox();
        const calls = [];
        const table = createTable("uji-tabel", {
            columns: [{ key: "no", label: "No" }],
            pageSize: 10,
            sort: { key: "no", dir: "desc" },
            source: async params => {
                calls.push(params);
                // Halaman 1 sengaja lebih lambat supaya jawabannya datang setelah halaman 2.
                await wait(params.page === 1 && calls.length === 2 ? 80 : 5);
                if (params.query === "gagal") return null;
                const start = (params.page - 1) * params.pageSize;
                return { rows: Array.from({ length: 10 }, (_, i) => ({ no: 1000 - start - i })), total: 1000 };
            }
        });
        await table.ready;
        assert.deepEqual(calls[0], { page: 1, pageSize: 10, sort: { key: "no", dir: "desc" }, query: "" });
        assert.equal(info(box), "Menampilkan 1–10 dari 1.000");
        assert.equal(box.querySelector("thead th").getAttribute("aria-sort"), "descending");
        const slow = table.refresh();
        pageButtons(box).find(b => b.textContent === "2").click();
        await slow;
        await wait(20);
        assert.equal(cells(box)[0], "990", "jawaban halaman 1 yang terlambat tidak menimpa halaman 2");
        assert.equal(box.querySelector("table").hasAttribute("aria-busy"), false);
        const before = calls.length;
        typeSearch(box, "a");
        typeSearch(box, "ab");
        await wait(100);
        assert.equal(calls.length, before, "belum minta selama masih mengetik");
        await wait(350);
        assert.equal(calls.length, before + 1);
        assert.deepEqual(calls[calls.length - 1], { page: 1, pageSize: 10, sort: { key: "no", dir: "desc" }, query: "ab" });
        typeSearch(box, "gagal");
        await wait(400);
        assert.equal(info(box), "Data gagal dimuat.");
        table.remove();
        assert.equal(box.childElementCount, 0);
        box.remove();
    });
});
