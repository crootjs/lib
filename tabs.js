// Tab yang bisa dipakai dengan keyboard, mengikuti pola ARIA Authoring Practices: hanya tab aktif
// yang masuk urutan Tab (tabindex bergilir), panah kiri/kanan berpindah tab dan langsung
// menampilkannya, Home/End ke tab pertama/terakhir. Tampilan dari ui.css; markup HTML-nya
// sendiri yang menentukan isi, jadi tanpa JavaScript semua panel tetap bisa ditulis terlihat.

// Mengaktifkan tab di dalam elemen role="tablist" dengan ID id. Setiap role="tab" menunjuk
// panelnya lewat aria-controls. Tab awal: yang aria-selected="true", atau yang pertama.
// Mengembalikan { select(index), remove() } atau null kalau elemen tidak ada.
export function initTabs(id) {
    const list = document.getElementById(id);
    if (!list) {
        console.warn(`Elemen dengan ID "${id}" tidak ditemukan.`);
        return null;
    }
    const tabs = [...list.querySelectorAll('[role="tab"]')];
    const panelOf = tab => document.getElementById(tab.getAttribute("aria-controls"));

    // Panel tanpa elemen yang bisa difokus tetap harus bisa dicapai dengan Tab sesudah tabnya.
    for (const tab of tabs) {
        const panel = panelOf(tab);
        if (panel && !panel.hasAttribute("tabindex")) panel.tabIndex = 0;
    }

    function select(index, focus = false) {
        if (!tabs[index]) return;
        tabs.forEach((tab, i) => {
            const active = i === index;
            tab.setAttribute("aria-selected", String(active));
            tab.tabIndex = active ? 0 : -1;
            const panel = panelOf(tab);
            if (panel) panel.hidden = !active;
        });
        if (focus) tabs[index].focus();
    }

    const onClick = event => {
        const index = tabs.indexOf(event.target.closest('[role="tab"]'));
        if (index >= 0) select(index);
    };

    const onKeydown = event => {
        const current = tabs.indexOf(event.target);
        if (current < 0) return;
        // Di halaman kanan-ke-kiri, panah kiri menuju tab berikutnya.
        const step = getComputedStyle(list).direction === "rtl" ? -1 : 1;
        const next = {
            ArrowRight: (current + step + tabs.length) % tabs.length,
            ArrowLeft: (current - step + tabs.length) % tabs.length,
            Home: 0,
            End: tabs.length - 1
        }[event.key];
        if (next === undefined) return;
        event.preventDefault();
        select(next, true);
    };

    list.addEventListener("click", onClick);
    list.addEventListener("keydown", onKeydown);
    const initial = tabs.findIndex(tab => tab.getAttribute("aria-selected") === "true");
    select(initial >= 0 ? initial : 0);

    return {
        select(index) {
            select(index);
        },
        remove() {
            list.removeEventListener("click", onClick);
            list.removeEventListener("keydown", onKeydown);
        }
    };
}
