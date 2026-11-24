// Grafik SVG ringan: batang, garis, dan donat. Ditulis sendiri, bukan Chart.js dan tidak
// kompatibel dengan API-nya.

const SVG_NS = "http://www.w3.org/2000/svg";

// Palet bawaan diperiksa terhadap permukaan croot.css (#ffffff/#f8fafc terang, #1e293b/#0f172a
// gelap): semua warna >= 3:1, dan pasangan bersebelahan tetap terbedakan untuk buta warna.
// Urutannya bagian dari pemeriksaan itu, jadi warna dipakai berurutan, tidak diulang.
const LIGHT = ["#2a78d6", "#e0602b", "#0f946a", "#b07800", "#d24f80", "#008300", "#6250d6", "#d93d3d"];
const DARK = ["#3987e5", "#d95926", "#199e70", "#c98500", "#d55181", "#1f9a1f", "#9085e9", "#e66767"];
const PALETTE = LIGHT.map((_, i) => `var(--croot-chart-${i + 1})`);
const vars = colors => colors.map((color, i) => `--croot-chart-${i + 1}: ${color};`).join(" ");

function injectStyles() {
    if (document.getElementById("crootjs-chart-style")) return;
    const style = document.createElement("style");
    style.id = "crootjs-chart-style";
    // position: relative pada .crootjs-chart: bagian tersembunyi untuk pembaca layar
    // (.crootjs-chart-hidden) berposisi absolut dan diukur dari grafiknya, bukan dari halaman.
    // :where() menurunkan spesifisitas aturan mode gelap supaya `.crootjs-chart { --croot-chart-1: ... }`
    // dari CSS halaman tetap menang di kedua mode.
    style.textContent = `
.crootjs-chart { ${vars(LIGHT)} display: block; position: relative; color: var(--croot-text, #1e293b); }
@media (prefers-color-scheme: dark) { :where(:root:not([data-theme="light"])) .crootjs-chart { ${vars(DARK)} } }
:where(:root[data-theme="dark"]) .crootjs-chart { ${vars(DARK)} }
.crootjs-chart-plot { position: relative; }
.crootjs-chart-plot svg { display: block; width: 100%; overflow: visible; font: 12px/1 var(--croot-font, system-ui, sans-serif); }
.crootjs-chart-plot svg:focus { outline: none; }
.crootjs-chart-plot svg:focus-visible { outline: 2px solid var(--croot-focus, #2563eb); outline-offset: 2px; border-radius: 4px; }
.crootjs-chart-text { fill: var(--croot-muted, #64748b); }
.crootjs-chart-tick { font-variant-numeric: tabular-nums; }
.crootjs-chart-grid { stroke: var(--croot-border, #d4dbe3); stroke-width: 1; shape-rendering: crispEdges; }
.crootjs-chart-axis { stroke: var(--croot-muted, #64748b); stroke-width: 1; shape-rendering: crispEdges; }
.crootjs-chart-band { fill: var(--croot-text, #1e293b); opacity: 0.06; }
.crootjs-chart-cross { stroke: var(--croot-muted, #64748b); stroke-width: 1; }
.crootjs-chart-line { fill: none; stroke-width: 2; stroke-linejoin: round; stroke-linecap: round; }
.crootjs-chart-dot, .crootjs-chart-slice { stroke: var(--croot-surface, #ffffff); stroke-width: 2; }
.crootjs-chart-total { fill: var(--croot-text, #1e293b); font-size: 20px; font-weight: 600; }
.crootjs-chart-tooltip { position: absolute; top: 0; left: 0; z-index: 1; pointer-events: none; padding: 6px 8px; border: 1px solid var(--croot-border, #d4dbe3); border-radius: 6px; background: var(--croot-surface, #ffffff); color: var(--croot-text, #1e293b); box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15); font-size: 13px; line-height: 1.4; white-space: nowrap; }
.crootjs-chart-tooltip[hidden] { display: none; }
.crootjs-chart-tooltip strong { display: block; }
.crootjs-chart-row { display: flex; align-items: center; gap: 6px; }
.crootjs-chart-value { margin-left: auto; padding-left: 12px; font-variant-numeric: tabular-nums; }
.crootjs-chart-swatch { display: inline-block; flex: none; width: 10px; height: 10px; border-radius: 2px; }
.crootjs-chart-swatch-line { height: 2px; width: 12px; }
.crootjs-chart-legend { display: flex; flex-wrap: wrap; gap: 4px 16px; margin: 8px 0 0; padding: 0; list-style: none; font-size: 13px; }
.crootjs-chart-legend li { display: flex; align-items: center; gap: 6px; margin: 0; }
.crootjs-chart-legend .crootjs-chart-value { margin-left: 0; padding-left: 0; color: var(--croot-muted, #64748b); }
.crootjs-chart-hidden { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
`;
    const previous = [...document.head.querySelectorAll('style[id^="crootjs-"]')].pop();
    if (previous) previous.after(style);
    else document.head.prepend(style);
}

const defaultFormat = new Intl.NumberFormat("id-ID").format;
const compactFormat = new Intl.NumberFormat("id-ID", { notation: "compact", maximumFractionDigits: 1 }).format;
const percentFormat = new Intl.NumberFormat("id-ID", { style: "percent", maximumFractionDigits: 1 }).format;
const TYPE_NAMES = { bar: "batang", line: "garis", donut: "donat" };
const charts = new WeakMap();

// Skala sumbu dengan angka bulat (kelipatan 1, 2, 2,5, atau 5 dikali 10^n) yang mencakup min..max.
export function niceScale(min, max, maxTicks = 5) {
    if (min === max) {
        if (min > 0) min = 0;
        else if (max < 0) max = 0;
        else max = 1;
    }
    const raw = (max - min) / Math.max(1, maxTicks);
    const magnitude = 10 ** Math.floor(Math.log10(raw));
    const nice = [1, 2, 2.5, 5, 10].find(n => raw / magnitude <= n);
    const step = nice * magnitude;
    // Pembulatan desimal mencegah 0.30000000000000004 di label sumbu.
    const decimals = Math.max(0, -Math.floor(Math.log10(step)) + (nice === 2.5 ? 1 : 0));
    const round = value => Number(value.toFixed(decimals));
    const niceMin = round(Math.floor(min / step) * step);
    const niceMax = round(Math.ceil(max / step) * step);
    const ticks = [];
    for (let i = 0; niceMin + i * step <= niceMax + step / 2; i++) ticks.push(round(niceMin + i * step));
    return { min: niceMin, max: niceMax, step, ticks };
}

function el(tag, attrs, parent) {
    const node = document.createElementNS(SVG_NS, tag);
    for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
    if (parent) parent.appendChild(node);
    return node;
}

function html(tag, className, parent) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (parent) parent.appendChild(node);
    return node;
}

const isValue = value => typeof value === "number" && Number.isFinite(value);

// Batang dengan ujung data membulat 4 px dan pangkal persegi di garis dasar.
function barPath(x, width, base, end, rounded) {
    const up = end < base;
    const r = rounded ? Math.min(4, width / 2, Math.abs(base - end)) : 0;
    const s = up ? 1 : -1;
    return `M${x},${base}V${end + s * r}Q${x},${end} ${x + r},${end}H${x + width - r}Q${x + width},${end} ${x + width},${end + s * r}V${base}Z`;
}

function arcPath(cx, cy, r, inner, a0, a1) {
    const point = (radius, angle) => `${cx + radius * Math.sin(angle)},${cy - radius * Math.cos(angle)}`;
    if (a1 - a0 >= 2 * Math.PI - 1e-9) {
        // Satu irisan 100 %: busur SVG tidak bisa menggambar lingkaran penuh sekaligus.
        const mid = a0 + Math.PI;
        return `M${point(r, a0)}A${r},${r} 0 1 1 ${point(r, mid)}A${r},${r} 0 1 1 ${point(r, a0)}Z` +
            `M${point(inner, a0)}A${inner},${inner} 0 1 0 ${point(inner, mid)}A${inner},${inner} 0 1 0 ${point(inner, a0)}Z`;
    }
    const large = a1 - a0 > Math.PI ? 1 : 0;
    return `M${point(r, a0)}A${r},${r} 0 ${large} 1 ${point(r, a1)}L${point(inner, a1)}A${inner},${inner} 0 ${large} 0 ${point(inner, a0)}Z`;
}

// Membuat grafik di dalam elemen `id`. Mengembalikan { element, update(changes), remove() },
// atau null kalau elemennya tidak ada.
export function createChart(id, config) {
    const container = document.getElementById(id);
    if (!container) {
        console.warn(`Elemen dengan ID "${id}" tidak ditemukan.`);
        return null;
    }
    charts.get(container)?.remove();
    injectStyles();

    const state = { type: "bar", labels: [], series: [], stacked: false, height: 300, ...config };
    container.classList.add("crootjs-chart");
    const plot = html("div", "crootjs-chart-plot", container);
    const svg = el("svg", { role: "img", tabindex: "0", "aria-labelledby": `${id}-chart-title`, "aria-describedby": `${id}-chart-desc` }, plot);
    const tooltip = html("div", "crootjs-chart-tooltip", plot);
    tooltip.hidden = true;
    tooltip.setAttribute("aria-hidden", "true");
    const legend = html("ul", "crootjs-chart-legend", container);
    // Tabel dibungkus div tersembunyi: tabel sendiri tidak patuh width: 1px, jadi isinya yang
    // panjang (white-space: nowrap) bisa melebarkan halaman ponsel; div memotongnya.
    const tableBox = html("div", "crootjs-chart-hidden", container);
    const table = html("table", "", tableBox);
    const live = html("div", "crootjs-chart-hidden", container);
    live.setAttribute("aria-live", "polite");

    let width = 0;
    let items = [];   // satu per titik navigasi: { label, x, y, rows, focus() }
    let active = -1;
    let pick = () => -1;   // posisi penunjuk (x, y) -> indeks item, diganti tiap render

    function colorsFor(count) {
        const colors = state.colors || PALETTE;
        if (count > colors.length) {
            throw new Error(`chart.js: ${count} seri melebihi ${colors.length} warna; gabungkan seri atau beri opsi colors.`);
        }
        return colors;
    }

    // Donat dengan irisan lebih banyak dari warna yang ada: sisanya digabung jadi "Lainnya",
    // karena warna yang diulang membuat dua irisan tampak sama.
    function donutSlices() {
        const limit = (state.colors || PALETTE).length;
        const values = state.labels.map((_, i) => state.series[0]?.values[i]);
        const slices = state.labels.map((label, i) => ({ label, value: isValue(values[i]) && values[i] > 0 ? values[i] : 0 }));
        if (slices.length <= limit) return slices;
        const rest = slices.slice(limit - 1).reduce((sum, slice) => sum + slice.value, 0);
        return [...slices.slice(0, limit - 1), { label: "Lainnya", value: rest }];
    }

    function render() {
        const format = state.format || defaultFormat;
        svg.replaceChildren();
        legend.replaceChildren();
        el("title", { id: `${id}-chart-title` }, svg).textContent = state.title || `Grafik ${TYPE_NAMES[state.type]}`;
        const desc = el("desc", { id: `${id}-chart-desc` }, svg);
        svg.setAttribute("width", width);
        svg.setAttribute("height", state.height);
        svg.setAttribute("viewBox", `0 0 ${width} ${state.height}`);

        if (state.type === "donut") renderDonut(format, desc);
        else renderAxes(format, desc);
        renderTable(format);
        if (active >= items.length) active = items.length - 1;
        if (active >= 0 && !tooltip.hidden) show(active, false);
    }

    function legendItem(color, label, line, extra) {
        const li = html("li", "", legend);
        const swatch = html("span", "crootjs-chart-swatch" + (line ? " crootjs-chart-swatch-line" : ""), li);
        swatch.style.background = color;
        li.append(label);
        if (extra) html("span", "crootjs-chart-value", li).textContent = extra;
    }

    function renderAxes(format, desc) {
        const { labels, series, height } = state;
        const isBar = state.type !== "line";
        const stacked = isBar && state.stacked;
        const colors = colorsFor(series.length);
        const n = labels.length;
        const valueAt = (s, i) => (isValue(s.values[i]) ? s.values[i] : null);

        let lo = Infinity;
        let hi = -Infinity;
        for (let i = 0; i < n; i++) {
            if (stacked) {
                let pos = 0;
                let neg = 0;
                for (const s of series) {
                    const v = valueAt(s, i) ?? 0;
                    if (v > 0) pos += v; else neg += v;
                }
                hi = Math.max(hi, pos);
                lo = Math.min(lo, neg);
            } else {
                for (const s of series) {
                    const v = valueAt(s, i);
                    if (v === null) continue;
                    hi = Math.max(hi, v);
                    lo = Math.min(lo, v);
                }
            }
        }
        if (lo > hi) lo = hi = 0;
        // Batang harus mulai dari nol supaya panjangnya jujur; garis boleh mengikuti rentang datanya.
        if (isBar) {
            lo = Math.min(lo, 0);
            hi = Math.max(hi, 0);
        }

        const top = 10;
        const bottom = 26;
        const scale = niceScale(lo, hi, Math.max(2, Math.floor((height - top - bottom) / 48)));
        const axisFormat = state.format || (Math.max(Math.abs(scale.min), Math.abs(scale.max)) >= 10000 ? compactFormat : defaultFormat);
        const tickLabels = scale.ticks.map(axisFormat);
        const left = Math.max(...tickLabels.map(t => t.length)) * 7 + 10;
        const right = 8;
        const plotW = Math.max(1, width - left - right);
        const plotH = height - top - bottom;
        const y = v => top + plotH - ((v - scale.min) / (scale.max - scale.min)) * plotH;
        const band = plotW / Math.max(1, n);
        const cx = i => left + band * (i + 0.5);

        const chrome = el("g", { "aria-hidden": "true" }, svg);
        scale.ticks.forEach((tick, i) => {
            const ty = Math.round(y(tick)) + 0.5;
            el("line", { class: tick === 0 ? "crootjs-chart-axis" : "crootjs-chart-grid", x1: left, x2: left + plotW, y1: ty, y2: ty }, chrome);
            el("text", { class: "crootjs-chart-text crootjs-chart-tick", x: left - 8, y: ty, "text-anchor": "end", "dominant-baseline": "middle" }, chrome).textContent = tickLabels[i];
        });
        const longest = Math.max(1, ...labels.map(l => String(l).length));
        const every = Math.max(1, Math.ceil((longest * 7 + 8) / band));
        labels.forEach((label, i) => {
            if (i % every) return;
            el("text", { class: "crootjs-chart-text", x: cx(i), y: top + plotH + 18, "text-anchor": "middle" }, chrome).textContent = label;
        });

        const highlight = el("rect", { class: "crootjs-chart-band", x: 0, y: top, width: band, height: plotH, visibility: "hidden" }, svg);
        const marks = el("g", {}, svg);
        const overlay = el("g", { "aria-hidden": "true" }, svg);
        const tops = new Array(n).fill(top + plotH);

        if (isBar) {
            const k = series.length;
            const barW = stacked ? Math.min(24, band * 0.6) : Math.max(1, Math.min(24, (band * 0.8 - (k - 1) * 2) / Math.max(1, k)));
            const groupW = stacked ? barW : k * barW + (k - 1) * 2;
            for (let i = 0; i < n; i++) {
                const x0 = cx(i) - groupW / 2;
                let pos = 0;
                let neg = 0;
                const lastPos = series.findLastIndex(s => (valueAt(s, i) ?? 0) > 0);
                const lastNeg = series.findLastIndex(s => (valueAt(s, i) ?? 0) < 0);
                series.forEach((s, j) => {
                    const v = valueAt(s, i);
                    if (!v) return;
                    let base;
                    let end;
                    let outer = true;
                    if (stacked) {
                        const start = v > 0 ? pos : neg;
                        if (v > 0) pos += v; else neg += v;
                        base = y(start);
                        end = y(start + v);
                        outer = j === (v > 0 ? lastPos : lastNeg);
                        // Celah 2 px warna permukaan memisahkan segmen yang bertumpuk.
                        if (!outer) end += v > 0 ? Math.min(2, base - end) : -Math.min(2, end - base);
                    } else {
                        base = y(0);
                        end = y(v);
                    }
                    const x = stacked ? x0 : x0 + j * (barW + 2);
                    const bar = el("path", { class: "crootjs-chart-bar", d: barPath(x, barW, base, end, outer) }, marks);
                    bar.style.fill = colors[j];
                    tops[i] = Math.min(tops[i], end, base);
                });
            }
        } else {
            const dots = band >= 24 || n === 1;
            series.forEach((s, j) => {
                let d = "";
                let pen = "M";
                for (let i = 0; i < n; i++) {
                    const v = valueAt(s, i);
                    if (v === null) { pen = "M"; continue; }
                    d += `${pen}${cx(i)},${y(v)}`;
                    pen = "L";
                    tops[i] = Math.min(tops[i], y(v));
                }
                const line = el("path", { class: "crootjs-chart-line", d }, marks);
                line.style.stroke = colors[j];
                if (!dots) return;
                for (let i = 0; i < n; i++) {
                    const v = valueAt(s, i);
                    if (v === null) continue;
                    el("circle", { class: "crootjs-chart-dot", cx: cx(i), cy: y(v), r: 4 }, marks).style.fill = colors[j];
                }
            });
        }

        if (series.length > 1) series.forEach((s, j) => legendItem(colors[j], s.name, !isBar));
        legend.hidden = series.length < 2;

        items = labels.map((label, i) => ({
            label,
            x: cx(i),
            y: tops[i],
            rows: series.map((s, j) => ({ name: s.name, color: colors[j], value: valueAt(s, i) === null ? "–" : format(valueAt(s, i)) })),
            focus() {
                overlay.replaceChildren();
                if (isBar) {
                    highlight.setAttribute("x", left + band * i);
                    highlight.setAttribute("visibility", "visible");
                    return;
                }
                el("line", { class: "crootjs-chart-cross", x1: cx(i), x2: cx(i), y1: top, y2: top + plotH }, overlay);
                series.forEach((s, j) => {
                    const v = valueAt(s, i);
                    if (v !== null) el("circle", { class: "crootjs-chart-dot", cx: cx(i), cy: y(v), r: 5 }, overlay).style.fill = colors[j];
                });
            },
            blur() {
                highlight.setAttribute("visibility", "hidden");
                overlay.replaceChildren();
            }
        }));
        pick = (px) => (px < left || px > left + plotW || !n ? -1 : Math.min(n - 1, Math.floor((px - left) / band)));
        const names = series.map(s => s.name).join(", ");
        desc.textContent = state.description ||
            `Grafik ${TYPE_NAMES[state.type]}${stacked ? " bertumpuk" : ""}, ${n} label, ${series.length} seri: ${names}. ` +
            `Sumbu nilai ${axisFormat(scale.min)} sampai ${axisFormat(scale.max)}. Tekan panah kiri atau kanan untuk membaca nilai.`;
    }

    function renderDonut(format, desc) {
        const slices = donutSlices();
        const colors = state.colors || PALETTE;
        const total = slices.reduce((sum, slice) => sum + slice.value, 0);
        const cx = width / 2;
        const cy = state.height / 2;
        const r = Math.max(10, Math.min(width, state.height) / 2 - 6);
        const inner = r * 0.62;
        const marks = el("g", {}, svg);
        let angle = 0;
        items = slices.map((slice, i) => {
            const share = total ? slice.value / total : 0;
            const a0 = angle;
            const a1 = angle + share * 2 * Math.PI;
            angle = a1;
            const mid = (a0 + a1) / 2;
            const path = share > 0 ? el("path", { class: "crootjs-chart-slice", d: arcPath(cx, cy, r, inner, a0, a1) }, marks) : null;
            if (path) path.style.fill = colors[i];
            legendItem(colors[i], slice.label, false, percentFormat(share));
            return {
                label: slice.label,
                share,
                a0,
                a1,
                x: cx + r * Math.sin(mid),
                y: cy - r * Math.cos(mid),
                rows: [{ name: state.series[0]?.name || slice.label, color: colors[i], value: `${format(slice.value)} (${percentFormat(share)})` }],
                focus() { path?.setAttribute("d", arcPath(cx, cy, r + 4, inner, a0, a1)); },
                blur() { path?.setAttribute("d", arcPath(cx, cy, r, inner, a0, a1)); }
            };
        });
        legend.hidden = false;
        const center = el("g", { "aria-hidden": "true" }, svg);
        el("text", { class: "crootjs-chart-total", x: cx, y: cy - 4, "text-anchor": "middle" }, center).textContent = format(total);
        el("text", { class: "crootjs-chart-text", x: cx, y: cy + 14, "text-anchor": "middle" }, center).textContent = "Total";

        pick = (px, py) => {
            const dx = px - cx;
            const dy = py - cy;
            const distance = Math.hypot(dx, dy);
            if (distance < inner || distance > r + 4) return -1;
            const a = (Math.atan2(dx, -dy) + 2 * Math.PI) % (2 * Math.PI);
            return items.findIndex(item => item.share > 0 && a >= item.a0 && a < item.a1);
        };
        desc.textContent = state.description ||
            `Grafik donat, ${slices.length} bagian, total ${format(total)}: ` +
            items.map(item => `${item.label} ${percentFormat(item.share)}`).join(", ") + ".";
    }

    function renderTable(format) {
        table.replaceChildren();
        html("caption", "", table).textContent = state.title || `Grafik ${TYPE_NAMES[state.type]}`;
        const head = html("tr", "", html("thead", "", table));
        const body = html("tbody", "", table);
        const th = (row, text, scope) => {
            const cell = html("th", "", row);
            cell.scope = scope;
            cell.textContent = text;
        };
        th(head, "Label", "col");
        if (state.type === "donut") {
            th(head, state.series[0]?.name || "Nilai", "col");
            th(head, "%", "col");
            const slices = donutSlices();
            slices.forEach((slice, i) => {
                const row = html("tr", "", body);
                th(row, slice.label, "row");
                html("td", "", row).textContent = format(slice.value);
                html("td", "", row).textContent = percentFormat(items[i].share);
            });
            return;
        }
        state.series.forEach(s => th(head, s.name, "col"));
        state.labels.forEach((label, i) => {
            const row = html("tr", "", body);
            th(row, label, "row");
            state.series.forEach(s => {
                html("td", "", row).textContent = isValue(s.values[i]) ? format(s.values[i]) : "–";
            });
        });
    }

    function show(index, announce) {
        if (active >= 0 && items[active]) items[active].blur();
        active = index;
        const item = items[index];
        if (!item) return hide();
        item.focus();
        tooltip.replaceChildren();
        html("strong", "", tooltip).textContent = item.label;
        for (const row of item.rows) {
            const line = html("div", "crootjs-chart-row", tooltip);
            html("span", "crootjs-chart-swatch" + (state.type === "line" ? " crootjs-chart-swatch-line" : ""), line).style.background = row.color;
            line.append(row.name);
            html("span", "crootjs-chart-value", line).textContent = row.value;
        }
        tooltip.hidden = false;
        const left = Math.min(Math.max(0, item.x - tooltip.offsetWidth / 2), Math.max(0, width - tooltip.offsetWidth));
        let top = item.y - tooltip.offsetHeight - 10;
        if (top < 0) top = item.y + 10;
        tooltip.style.transform = `translate(${Math.round(left)}px, ${Math.round(top)}px)`;
        if (announce) live.textContent = `${item.label}: ` + item.rows.map(row => `${row.name} ${row.value}`).join(", ");
    }

    function hide() {
        if (active >= 0 && items[active]) items[active].blur();
        tooltip.hidden = true;
    }

    function pointer(event) {
        const box = svg.getBoundingClientRect();
        const index = pick(event.clientX - box.left, event.clientY - box.top);
        if (index < 0) hide();
        else if (index !== active || tooltip.hidden) show(index, false);
    }

    function keydown(event) {
        const last = items.length - 1;
        const next = {
            ArrowRight: active + 1, ArrowDown: active + 1,
            ArrowLeft: active - 1, ArrowUp: active - 1,
            Home: 0, End: last
        }[event.key];
        if (event.key === "Escape") return hide();
        if (next === undefined || last < 0) return;
        event.preventDefault();
        show(Math.min(last, Math.max(0, next)), true);
    }

    function focus() {
        if (items.length) show(Math.max(0, active), true);
    }

    svg.addEventListener("pointermove", pointer);
    svg.addEventListener("pointerdown", pointer);
    svg.addEventListener("pointerleave", hide);
    svg.addEventListener("keydown", keydown);
    svg.addEventListener("focus", focus);
    svg.addEventListener("blur", hide);

    // Lebar diukur ulang dan SVG digambar ulang dalam piksel sebenarnya (bukan viewBox yang
    // diskalakan), supaya teks tetap 12 px di ponsel dan jumlah label sumbu menyesuaikan lebar.
    const observer = new ResizeObserver(() => {
        const next = plot.clientWidth;
        if (next && next !== width) {
            width = next;
            render();
        }
    });
    observer.observe(plot);
    width = plot.clientWidth;
    if (width) render();

    const chart = {
        element: container,
        update(changes) {
            Object.assign(state, changes);
            if (width) render();
        },
        remove() {
            observer.disconnect();
            plot.remove();
            legend.remove();
            tableBox.remove();
            live.remove();
            container.classList.remove("crootjs-chart");
            charts.delete(container);
        }
    };
    charts.set(container, chart);
    return chart;
}
