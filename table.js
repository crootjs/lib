// Tabel data: urut per kolom, cari, dan halaman, dirender sebagai <table> sungguhan.
// Pengganti ringan jQuery DataTables. Isi sel selalu dimasukkan sebagai teks (atau Node dari
// format), tidak pernah sebagai HTML, jadi data dari server tidak bisa menyisipkan skrip.
// Data bisa diberikan sekaligus (rows) atau diambil per halaman dari server (source).

const TEXTS = {
    search: "Cari",
    pageSize: "Baris per halaman",
    pages: "Halaman tabel",
    previous: "Sebelumnya",
    next: "Berikutnya",
    page: n => `Halaman ${n}`,
    info: (from, to, total, all) => {
        const id = n => n.toLocaleString("id-ID");
        const filtered = all != null && all !== total ? ` (disaring dari ${id(all)})` : "";
        return `Menampilkan ${id(from)}–${id(to)} dari ${id(total)}${filtered}`;
    },
    empty: "Belum ada data.",
    noMatch: "Tidak ada data yang cocok dengan pencarian.",
    error: "Data gagal dimuat."
};

// numeric: "item 2" sebelum "item 10"; sensitivity base: huruf besar/kecil dan aksen dianggap sama.
const collator = new Intl.Collator("id", { numeric: true, sensitivity: "base" });
let counter = 0;

function injectStyles() {
    if (document.getElementById("crootjs-table-style")) return;
    const style = document.createElement("style");
    style.id = "crootjs-table-style";
    style.textContent = `
.crootjs-table { max-width: 100%; min-width: 0; }
.crootjs-table-tools, .crootjs-table-footer {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-end;
    justify-content: space-between;
    gap: 0.5rem 1rem;
    margin: 0.5rem 0;
}
.crootjs-table-tools label { display: block; }
.crootjs-table-search { flex: 1 1 12rem; max-width: 24rem; }
.crootjs-table-search input { box-sizing: border-box; width: 100%; }
.crootjs-table-size select { width: auto; }
.crootjs-table-scroll { overflow-x: auto; max-width: 100%; }
.crootjs-table-scroll table { width: 100%; border-collapse: collapse; margin: 0; }
/* :where() membuat spesifisitasnya rendah, jadi kelas kolom di CSS halaman (mis. .angka { text-align: right; }) menang. */
:where(.crootjs-table-scroll) :is(th, td) {
    padding: 0.5rem 0.75rem;
    border-bottom: 1px solid var(--croot-border, #d4dbe3);
    text-align: left;
    vertical-align: top;
}
.crootjs-table-scroll caption { text-align: left; font-weight: 600; padding: 0.25rem 0; }
.crootjs-table-scroll thead th { white-space: nowrap; }
.crootjs-table-sort {
    display: inline-flex;
    align-items: center;
    gap: 0.35em;
    min-height: 0;
    margin: 0;
    padding: 0;
    border: 0;
    background: none;
    color: inherit;
    font: inherit;
    font-weight: inherit;
    text-align: inherit;
    cursor: pointer;
}
.crootjs-table-sort:hover { filter: none; text-decoration: underline; }
.crootjs-table-arrow { opacity: 0.6; font-size: 0.8em; }
[aria-sort] > .crootjs-table-sort .crootjs-table-arrow { opacity: 1; }
.crootjs-table-message { text-align: center; color: var(--croot-muted, #64748b); }
.crootjs-table-info { margin: 0; }
.crootjs-table-pages { display: flex; flex-wrap: wrap; align-items: center; gap: 0.25rem; }
.crootjs-table-pages button { min-width: 2.5rem; min-height: 2.5rem; padding: 0.25rem 0.6rem; }
.crootjs-table-scroll table[aria-busy="true"] tbody { opacity: 0.6; }
`;
    const previous = [...document.head.querySelectorAll('style[id^="crootjs-"]')].pop();
    if (previous) previous.after(style);
    else document.head.prepend(style);
}

function isEmpty(value) {
    return value === null || value === undefined || value === "";
}

// Nilai kosong selalu di akhir, baik urut naik maupun turun.
function compareValues(a, b, dir) {
    if (isEmpty(a) || isEmpty(b)) return isEmpty(a) - isEmpty(b);
    let result;
    if (a instanceof Date && b instanceof Date) result = a - b;
    else if (typeof a === "number" && typeof b === "number") result = a - b;
    else result = collator.compare(String(a), String(b));
    return dir === "desc" ? -result : result;
}

function fillCell(cell, column, row) {
    const value = column.key === undefined ? undefined : row[column.key];
    const content = column.format ? column.format(value, row) : value;
    if (content instanceof Node) cell.append(content);
    else cell.textContent = isEmpty(content) ? "" : String(content);
}

// Nomor halaman yang ditampilkan: pertama, terakhir, dan sekitar halaman aktif; null = celah.
// Selalu paling banyak 7 butir supaya lebar navigasi tetap saat berpindah halaman.
function pageList(page, pages) {
    const wanted = new Set([1, pages]);
    const from = pages <= 7 ? 1 : page <= 4 ? 2 : page >= pages - 3 ? pages - 4 : page - 1;
    const to = pages <= 7 ? pages : page <= 4 ? 5 : page >= pages - 3 ? pages - 1 : page + 1;
    for (let n = from; n <= to; n++) wanted.add(n);
    const list = [];
    for (let n = 1; n <= pages; n++) {
        if (!wanted.has(n)) continue;
        if (list.length && n - list[list.length - 1] > 1) list.push(n - list[list.length - 1] === 2 ? n - 1 : null);
        list.push(n);
    }
    return list;
}

// Membuat tabel di dalam elemen id. Isi elemen diganti. Lihat docs/table.md untuk opsi lengkap.
// Mengembalikan { setRows(rows), refresh(), getState(), remove() } atau null kalau elemen tidak ada.
export function createTable(id, options = {}) {
    const container = document.getElementById(id);
    if (!container) {
        console.warn(`Elemen dengan ID "${id}" tidak ditemukan.`);
        return null;
    }
    injectStyles();

    const texts = { ...TEXTS, ...options.texts };
    const columns = options.columns || [];
    const source = options.source || null;
    const pageSizes = options.pageSizes === undefined ? [10, 25, 50, 100] : options.pageSizes || [];
    let rows = options.rows || [];
    let pageSize = options.pageSize === undefined ? 10 : options.pageSize;
    let page = 1;
    let sort = options.sort ? { key: options.sort.key, dir: options.sort.dir === "desc" ? "desc" : "asc" } : null;
    let query = "";
    let total = 0;
    let request = 0;
    let searchTimer = null;
    const base = `crootjs-table-${++counter}`;

    const root = document.createElement("div");
    root.className = "crootjs-table";

    const tools = document.createElement("div");
    tools.className = "crootjs-table-tools";
    let searchInput = null;
    if (options.search !== false) {
        const wrap = document.createElement("div");
        wrap.className = "crootjs-table-search";
        const label = document.createElement("label");
        label.htmlFor = `${base}-search`;
        label.textContent = texts.search;
        searchInput = document.createElement("input");
        searchInput.type = "search";
        searchInput.id = `${base}-search`;
        searchInput.autocomplete = "off";
        searchInput.setAttribute("aria-controls", `${base}-table`);
        wrap.append(label, searchInput);
        tools.append(wrap);
        searchInput.addEventListener("input", () => {
            clearTimeout(searchTimer);
            // Ke server: tunggu pengguna berhenti mengetik supaya tidak satu request per huruf.
            if (source) searchTimer = setTimeout(() => setQuery(searchInput.value), 300);
            else setQuery(searchInput.value);
        });
    }
    if (pageSize > 0 && pageSizes.length) {
        const wrap = document.createElement("div");
        wrap.className = "crootjs-table-size";
        const label = document.createElement("label");
        label.htmlFor = `${base}-size`;
        label.textContent = texts.pageSize;
        const select = document.createElement("select");
        select.id = `${base}-size`;
        for (const size of new Set([pageSize, ...pageSizes].sort((a, b) => a - b))) {
            select.append(new Option(String(size), String(size), false, size === pageSize));
        }
        select.addEventListener("change", () => {
            pageSize = Number(select.value);
            page = 1;
            update();
        });
        wrap.append(label, select);
        tools.append(wrap);
    }
    if (tools.childElementCount) root.append(tools);

    const scroll = document.createElement("div");
    scroll.className = "crootjs-table-scroll";
    // Wadah gulir harus bisa difokus supaya tabel lebar bisa digulir dengan keyboard.
    scroll.tabIndex = 0;
    scroll.setAttribute("role", "region");
    const table = document.createElement("table");
    table.id = `${base}-table`;
    if (options.tableClass) table.className = options.tableClass;
    if (options.caption) {
        const caption = table.createCaption();
        caption.id = `${base}-caption`;
        caption.textContent = options.caption;
        scroll.setAttribute("aria-labelledby", caption.id);
    } else {
        scroll.setAttribute("aria-label", options.label || "Tabel");
    }
    const headRow = table.createTHead().insertRow();
    const headers = columns.map(column => {
        const th = document.createElement("th");
        th.scope = "col";
        if (column.className) th.className = column.className;
        if (column.key !== undefined && column.sortable !== false) {
            const button = document.createElement("button");
            button.type = "button";
            button.className = "crootjs-table-sort";
            const text = document.createElement("span");
            text.textContent = column.label ?? column.key;
            const arrow = document.createElement("span");
            arrow.className = "crootjs-table-arrow";
            arrow.setAttribute("aria-hidden", "true");
            button.append(text, arrow);
            button.addEventListener("click", () => {
                const dir = sort && sort.key === column.key && sort.dir === "asc" ? "desc" : "asc";
                sort = { key: column.key, dir };
                page = 1;
                update();
            });
            th.append(button);
        } else {
            th.textContent = column.label ?? column.key ?? "";
        }
        headRow.append(th);
        return th;
    });
    const tbody = table.createTBody();
    scroll.append(table);
    root.append(scroll);

    const footer = document.createElement("div");
    footer.className = "crootjs-table-footer";
    const info = document.createElement("p");
    info.className = "crootjs-table-info";
    info.setAttribute("role", "status");
    const nav = document.createElement("nav");
    nav.className = "crootjs-table-pages";
    nav.setAttribute("aria-label", texts.pages);
    footer.append(info, nav);
    root.append(footer);
    container.replaceChildren(root);

    function setQuery(value) {
        const next = value.trim();
        if (next === query) return;
        query = next;
        page = 1;
        update();
    }

    function pageCount() {
        return pageSize > 0 ? Math.max(1, Math.ceil(total / pageSize)) : 1;
    }

    function renderHead() {
        columns.forEach((column, i) => {
            const active = sort && sort.key === column.key;
            if (active) headers[i].setAttribute("aria-sort", sort.dir === "asc" ? "ascending" : "descending");
            else headers[i].removeAttribute("aria-sort");
            const arrow = headers[i].querySelector(".crootjs-table-arrow");
            if (arrow) arrow.textContent = active ? (sort.dir === "asc" ? "▲" : "▼") : "↕";
        });
    }

    function renderMessage(text) {
        const cell = tbody.insertRow().insertCell();
        cell.colSpan = Math.max(1, columns.length);
        cell.className = "crootjs-table-message";
        cell.textContent = text;
    }

    function renderBody(pageRows) {
        tbody.replaceChildren();
        if (!pageRows.length) {
            renderMessage(query ? texts.noMatch : texts.empty);
            return;
        }
        for (const row of pageRows) {
            const tr = tbody.insertRow();
            for (const column of columns) {
                const td = tr.insertCell();
                if (column.className) td.className = column.className;
                fillCell(td, column, row);
            }
        }
    }

    function pageButton(label, target, attrs = {}) {
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = label;
        button.dataset.page = attrs.key || String(target);
        if (attrs.ariaLabel) button.setAttribute("aria-label", attrs.ariaLabel);
        if (attrs.current) button.setAttribute("aria-current", "page");
        else button.className = "secondary";
        button.disabled = Boolean(attrs.disabled);
        button.addEventListener("click", () => {
            page = target;
            update();
        });
        return button;
    }

    // Tombol halaman dibuat ulang setiap render; fokus keyboard dikembalikan ke tombol yang
    // setara supaya pengguna keyboard tidak terlempar ke awal halaman.
    function renderPages() {
        const focused = nav.contains(document.activeElement) ? document.activeElement.dataset.page : null;
        nav.replaceChildren();
        const pages = pageCount();
        nav.hidden = pages <= 1;
        if (pages <= 1) return;
        nav.append(pageButton(texts.previous, page - 1, { key: "previous", disabled: page === 1 }));
        for (const n of pageList(page, pages)) {
            if (n === null) {
                const gap = document.createElement("span");
                gap.textContent = "…";
                gap.setAttribute("aria-hidden", "true");
                nav.append(gap);
            } else {
                nav.append(pageButton(String(n), n, { ariaLabel: texts.page(n), current: n === page }));
            }
        }
        nav.append(pageButton(texts.next, page + 1, { key: "next", disabled: page === pages }));
        if (focused) {
            const same = nav.querySelector(`[data-page="${focused}"]`);
            (same && !same.disabled ? same : nav.querySelector('[aria-current="page"]')).focus();
        }
    }

    function renderInfo(all) {
        if (total === 0) {
            info.textContent = query ? texts.noMatch : texts.empty;
            return;
        }
        const from = pageSize > 0 ? (page - 1) * pageSize + 1 : 1;
        const to = pageSize > 0 ? Math.min(total, page * pageSize) : total;
        info.textContent = texts.info(from, to, total, all);
    }

    function updateLocal() {
        const needle = query.toLocaleLowerCase("id");
        const keys = columns.filter(column => column.key !== undefined).map(column => column.key);
        let list = needle
            ? rows.filter(row => keys.some(key => {
                const value = row[key];
                return (typeof value === "string" || typeof value === "number")
                    && String(value).toLocaleLowerCase("id").includes(needle);
            }))
            : rows.slice();
        if (sort) list.sort((a, b) => compareValues(a[sort.key], b[sort.key], sort.dir));
        total = list.length;
        page = Math.min(page, pageCount());
        if (pageSize > 0) list = list.slice((page - 1) * pageSize, page * pageSize);
        renderHead();
        renderBody(list);
        renderPages();
        renderInfo(rows.length);
    }

    async function updateServer() {
        const ticket = ++request;
        renderHead();
        table.setAttribute("aria-busy", "true");
        const result = await source({ page, pageSize, sort: sort ? { ...sort } : null, query });
        // Jawaban yang datang terlambat (pengguna sudah pindah halaman/mengetik lagi) dibuang.
        if (ticket !== request) return;
        table.removeAttribute("aria-busy");
        if (!result || !Array.isArray(result.rows)) {
            tbody.replaceChildren();
            renderMessage(texts.error);
            info.textContent = texts.error;
            return;
        }
        total = Number(result.total) || 0;
        // Data di server berkurang sehingga halaman ini sudah tidak ada: pindah ke halaman terakhir.
        if (!result.rows.length && total > 0 && page > pageCount()) {
            page = pageCount();
            return updateServer();
        }
        renderBody(result.rows);
        renderPages();
        renderInfo(null);
    }

    function update() {
        if (source) return updateServer();
        updateLocal();
        return Promise.resolve();
    }

    const ready = update();

    return {
        // Mengganti semua baris (mode lokal), mis. sesudah getJSON. Urutan, pencarian, dan halaman tetap.
        setRows(next) {
            rows = next || [];
            return update();
        },
        // Mode server: ambil ulang halaman ini. Promise selesai setelah tabel dirender ulang.
        refresh() {
            return update();
        },
        ready,
        getState() {
            return { page, pageSize, sort: sort ? { ...sort } : null, query, total };
        },
        remove() {
            clearTimeout(searchTimer);
            request++;
            root.remove();
        }
    };
}
