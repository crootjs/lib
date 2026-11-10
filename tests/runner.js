// Penguji kecil tanpa npm: test() mendaftarkan uji, run() menjalankannya berurutan dan
// menulis hasilnya ke halaman. Halaman memberi <body data-status="passed|failed"> dan baris
// ringkasan "PASSED n FAILED n SKIPPED n" supaya bisa dibaca CI (lihat tests/run.sh).

const tests = [];
let group = "";

export function describe(name, register) {
    group = name;
    register();
    group = "";
}

// options.skip: alasan (teks) kalau uji ini dilewati, misalnya "WebGL tidak tersedia".
export function test(name, run, options = {}) {
    tests.push({ name: group ? `${group} › ${name}` : name, run, skip: options.skip || null });
}

class AssertionError extends Error {}

const format = value => {
    try {
        return JSON.stringify(value);
    } catch (error) {
        return String(value);
    }
};

export const assert = {
    ok(value, message = "nilai harus truthy") {
        if (!value) throw new AssertionError(`${message} (dapat ${format(value)})`);
    },
    equal(actual, expected, message = "") {
        if (actual !== expected) throw new AssertionError(`${message} diharapkan ${format(expected)}, dapat ${format(actual)}`.trim());
    },
    deepEqual(actual, expected, message = "") {
        if (format(actual) !== format(expected)) throw new AssertionError(`${message} diharapkan ${format(expected)}, dapat ${format(actual)}`.trim());
    },
    // Angka (atau array angka) sama sampai selisih tolerance.
    close(actual, expected, tolerance = 1e-6, message = "") {
        const a = [].concat(actual);
        const b = [].concat(expected);
        const same = a.length === b.length && a.every((value, i) => Math.abs(value - b[i]) <= tolerance);
        if (!same) throw new AssertionError(`${message} diharapkan ${format(expected)} ± ${tolerance}, dapat ${format(actual)}`.trim());
    }
};

// Elemen <div> baru berukuran tetap untuk peta atau penampil 3D; dihapus setelah ujinya.
const fixtures = [];
export function fixture(width = 400, height = 300) {
    const element = document.createElement("div");
    element.id = "fixture-" + Math.random().toString(36).slice(2);
    element.className = "fixture";
    element.style.width = width + "px";
    element.style.height = height + "px";
    document.getElementById("fixtures").appendChild(element);
    fixtures.push(element);
    return element.id;
}

export const nextFrame = () => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
export const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

export async function run() {
    const list = document.getElementById("results");
    const counts = { passed: 0, failed: 0, skipped: 0 };
    for (const item of tests) {
        const row = document.createElement("li");
        const started = performance.now();
        let status;
        let detail = "";
        if (item.skip) {
            status = "skipped";
            detail = item.skip;
        } else {
            try {
                await item.run();
                status = "passed";
            } catch (error) {
                status = "failed";
                detail = error instanceof AssertionError ? error.message : (error && error.stack) || String(error);
            }
        }
        fixtures.splice(0).forEach(element => element.remove());
        counts[status]++;
        row.className = status;
        row.textContent = `${status === "passed" ? "✓" : status === "failed" ? "✗" : "–"} ${item.name} (${Math.round(performance.now() - started)} ms)`;
        if (detail) {
            const pre = document.createElement("pre");
            pre.textContent = detail;
            row.appendChild(pre);
        }
        list.appendChild(row);
        console.log(`${status.toUpperCase()} ${item.name}${detail ? "\n  " + detail : ""}`);
    }
    const summary = `PASSED ${counts.passed} FAILED ${counts.failed} SKIPPED ${counts.skipped}`;
    document.getElementById("summary").textContent = summary;
    document.body.dataset.status = counts.failed ? "failed" : "passed";
    console.log(summary);
    return counts;
}
