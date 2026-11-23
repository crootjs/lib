import { describe, test, assert, fixture, nextFrame } from "./runner.js";
import { createChart, niceScale } from "../chart.js";

const LABELS = ["Jan", "Feb", "Mar", "Apr"];

function keydown(target, key) {
    target.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }));
}

describe("chart.js", () => {
    test("niceScale memberi angka bulat yang mencakup data", () => {
        assert.deepEqual(niceScale(0, 980, 5).ticks, [0, 200, 400, 600, 800, 1000]);
        assert.deepEqual(niceScale(0, 1, 5).ticks, [0, 0.2, 0.4, 0.6, 0.8, 1]);
        const s = niceScale(-35, 120, 4);
        assert.ok(s.min <= -35 && s.max >= 120, "mencakup rentang");
        assert.equal(s.step, 50);
        assert.deepEqual(niceScale(5, 5).ticks[0], 0, "data datar positif mulai dari nol");
        assert.deepEqual(niceScale(0, 0).ticks, [0, 0.2, 0.4, 0.6, 0.8, 1]);
        assert.deepEqual(niceScale(24.3, 31.8, 4).ticks, [24, 26, 28, 30, 32]);
    });

    test("batang berkelompok, bertumpuk, dan garis: jumlah tanda dan legenda", () => {
        const id = fixture(480, 320);
        const series = [{ name: "A", values: [10, 20, 30, 40] }, { name: "B", values: [5, null, 15, 25] }];
        const chart = createChart(id, { labels: LABELS, series, title: "Uji batang" });
        const root = document.getElementById(id);
        assert.equal(root.querySelectorAll(".crootjs-chart-bar").length, 7, "nilai kosong tidak digambar");
        assert.equal(root.querySelectorAll(".crootjs-chart-legend li").length, 2);
        assert.equal(root.querySelector("svg").getAttribute("role"), "img");
        assert.equal(root.querySelector("svg title").textContent, "Uji batang");

        chart.update({ stacked: true });
        assert.equal(root.querySelectorAll(".crootjs-chart-bar").length, 7);

        chart.update({ type: "line", series: [series[0]] });
        assert.equal(root.querySelectorAll(".crootjs-chart-line").length, 1);
        assert.equal(root.querySelectorAll(".crootjs-chart-dot").length, 4);
        assert.ok(root.querySelector(".crootjs-chart-legend").hidden, "satu seri tanpa legenda");
        chart.remove();
        assert.equal(root.children.length, 0);
        assert.ok(!root.classList.contains("crootjs-chart"));
    });

    test("format angka id-ID di sumbu dan tabel, bisa diganti", () => {
        const id = fixture(480, 320);
        const chart = createChart(id, { labels: ["a", "b"], series: [{ name: "Rp", values: [1234.5, 25000] }] });
        const root = document.getElementById(id);
        const cells = [...root.querySelectorAll("table td")].map(td => td.textContent);
        assert.deepEqual(cells, ["1.234,5", "25.000"]);
        const ticks = [...root.querySelectorAll(".crootjs-chart-tick")].map(t => t.textContent);
        // Intl memakai spasi tak terputus di antara angka dan "rb".
        assert.deepEqual(ticks.map(t => t.replace(/\s/g, " ")), ["0", "5 rb", "10 rb", "15 rb", "20 rb", "25 rb"], "sumbu ringkas di atas 10.000");
        chart.update({ format: n => "Rp" + n });
        assert.equal(root.querySelector("table td").textContent, "Rp1234.5");
        chart.remove();
    });

    test("donat: persentase dan penggabungan 'Lainnya'", () => {
        const id = fixture(400, 300);
        const chart = createChart(id, { type: "donut", labels: ["X", "Y", "Z"], series: [{ name: "Jumlah", values: [1, 1, 2] }] });
        const root = document.getElementById(id);
        assert.equal(root.querySelectorAll(".crootjs-chart-slice").length, 3);
        const percent = [...root.querySelectorAll("table tbody tr")].map(tr => tr.lastElementChild.textContent);
        assert.deepEqual(percent, ["25%", "25%", "50%"]);
        assert.equal(root.querySelector(".crootjs-chart-total").textContent, "4");
        // Irisan Y (25 %-50 %) ada di kanan bawah pusat, sudut 135 derajat dari atas.
        const box = root.querySelector("svg").getBoundingClientRect();
        const at = 135 * Math.PI / 180;
        const radius = (Math.min(box.width, box.height) / 2 - 6) * 0.8;
        root.querySelector("svg").dispatchEvent(new PointerEvent("pointermove", {
            clientX: box.x + box.width / 2 + radius * Math.sin(at),
            clientY: box.y + box.height / 2 - radius * Math.cos(at)
        }));
        assert.equal(root.querySelector(".crootjs-chart-tooltip").textContent, "YJumlah1 (25%)");

        const labels = Array.from({ length: 10 }, (_, i) => "L" + i);
        chart.update({ labels, series: [{ name: "Jumlah", values: labels.map(() => 1) }] });
        assert.equal(root.querySelectorAll(".crootjs-chart-slice").length, 8);
        assert.equal(root.querySelector("table tbody tr:last-child th").textContent, "Lainnya");
        assert.equal(root.querySelector("table tbody tr:last-child td").textContent, "3");
        chart.remove();
    });

    test("update mengganti data tanpa membuat wadah baru; tabel aksesibel ikut", () => {
        const id = fixture(480, 320);
        const chart = createChart(id, { labels: LABELS, series: [{ name: "A", values: [1, 2, 3, 4] }], title: "Uji tabel" });
        const root = document.getElementById(id);
        const svg = root.querySelector("svg");
        chart.update({ labels: ["P", "Q"], series: [{ name: "A", values: [7, 8] }, { name: "B", values: [9, 10] }] });
        assert.equal(root.querySelector("svg"), svg, "SVG yang sama");
        assert.equal(root.querySelector("table caption").textContent, "Uji tabel");
        assert.deepEqual([...root.querySelectorAll("thead th")].map(th => th.textContent), ["Label", "A", "B"]);
        assert.deepEqual([...root.querySelectorAll("tbody th")].map(th => th.getAttribute("scope")), ["row", "row"]);
        assert.equal(root.querySelectorAll(".crootjs-chart-bar").length, 4);
        chart.remove();
    });

    test("tooltip muncul saat fokus keyboard dan berpindah dengan panah", async () => {
        const id = fixture(480, 320);
        const chart = createChart(id, { labels: LABELS, series: [{ name: "A", values: [10, 20, 30, 40] }] });
        const root = document.getElementById(id);
        const svg = root.querySelector("svg");
        const tooltip = root.querySelector(".crootjs-chart-tooltip");
        assert.ok(tooltip.hidden);
        svg.focus();
        await nextFrame();
        assert.ok(!tooltip.hidden, "tampil saat fokus");
        assert.ok(tooltip.textContent.startsWith("Jan"));
        keydown(svg, "ArrowRight");
        assert.ok(tooltip.textContent.includes("Feb") && tooltip.textContent.includes("20"));
        const live = root.querySelector("[aria-live]");
        assert.equal(live.textContent, "Feb: A 20");
        keydown(svg, "End");
        assert.ok(tooltip.textContent.startsWith("Apr"));
        keydown(svg, "Escape");
        assert.ok(tooltip.hidden);
        svg.blur();
        chart.remove();
    });

    test("tooltip saat penunjuk di atas batang", () => {
        const id = fixture(480, 320);
        const chart = createChart(id, { labels: LABELS, series: [{ name: "A", values: [10, 20, 30, 40] }] });
        const root = document.getElementById(id);
        const svg = root.querySelector("svg");
        const bar = root.querySelectorAll(".crootjs-chart-bar")[2].getBoundingClientRect();
        svg.dispatchEvent(new PointerEvent("pointermove", { clientX: bar.x + bar.width / 2, clientY: bar.y + 2 }));
        const tooltip = root.querySelector(".crootjs-chart-tooltip");
        assert.ok(!tooltip.hidden);
        assert.ok(tooltip.textContent.startsWith("Mar"));
        svg.dispatchEvent(new PointerEvent("pointerleave"));
        assert.ok(tooltip.hidden);
        chart.remove();
    });

    test("menyesuaikan lebar wadah", async () => {
        const id = fixture(480, 320);
        const chart = createChart(id, { labels: LABELS, series: [{ name: "A", values: [1, 2, 3, 4] }] });
        const root = document.getElementById(id);
        root.style.width = "300px";
        await nextFrame();
        await nextFrame();
        assert.equal(root.querySelector("svg").getAttribute("width"), "300");
        chart.remove();
    });
});
