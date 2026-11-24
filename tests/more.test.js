import { describe, test, assert } from "./runner.js";
import { getJSON, uploadFile, downloadFile, postFile, postFileJSON, getFileBytesWithHeader } from "../api.js";
import { sendSTP, verifySTP } from "../stp.js";
import { openWebSocketSetId, sendMessagetoWebSocket, closeWebSocket } from "../websocket.js";
import { getRandomColor, getRandomColorName } from "../image.js";
import { tapClick } from "../trace.js";

// Mengganti window[name] selama run() berjalan, lalu mengembalikannya.
async function replacing(name, value, run) {
    const original = window[name];
    window[name] = value;
    try {
        return await run();
    } finally {
        window[name] = original;
    }
}

const jsonResponse = (body, status = 200) => Promise.resolve(new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } }));

// <input type="file"> berisi file buatan, untuk fungsi yang membaca dari id input.
function fileInput(id, files) {
    const input = document.createElement("input");
    input.type = "file";
    input.id = id;
    const transfer = new DataTransfer();
    files.forEach(file => transfer.items.add(file));
    input.files = transfer.files;
    document.body.appendChild(input);
    return input;
}

// XMLHttpRequest tiruan: mencatat request, lalu mengirim kemajuan dan jawaban saat respond().
class FakeXHR {
    constructor() {
        FakeXHR.last = this;
        this.headers = {};
        this.upload = {};
        this.status = 0;
        this.responseText = "";
    }
    open(method, url) { this.method = method; this.url = url; }
    setRequestHeader(key, value) { this.headers[key.toLowerCase()] = value; }
    getAllResponseHeaders() { return "content-type: application/json\r\nx-file-id: 42\r\n"; }
    send(body) { this.body = body; if (FakeXHR.onSend) FakeXHR.onSend(this); }
    abort() { if (this.onabort) this.onabort(); }
    progress(loaded, total) { this.upload.onprogress({ lengthComputable: true, loaded, total }); }
    respond(status, text) { this.status = status; this.responseText = text; this.onload(); }
}

describe("api.js: membatalkan request", () => {
    test("signal: abort() memberi error abort", async () => {
        const controller = new AbortController();
        await replacing("fetch", (url, options) => new Promise((resolve, reject) => {
            options.signal.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
        }), async () => {
            const pending = getJSON("https://contoh.test/lama", null, { signal: controller.signal });
            controller.abort();
            const result = await pending;
            assert.equal(result.status, 0);
            assert.equal(result.error, "abort");
        });
    });
});

describe("api.js: uploadFile", () => {
    test("file dari input, field dan data tambahan, header, kemajuan", async () => {
        const input = fileInput("uji-upload", [new File(["halo"], "a.txt"), new File(["dunia"], "b.txt")]);
        const progress = [];
        FakeXHR.onSend = xhr => {
            xhr.progress(5, 10);
            xhr.progress(10, 10);
            xhr.respond(201, '{"id":42}');
        };
        try {
            const result = await replacing("XMLHttpRequest", FakeXHR, () => uploadFile("https://contoh.test/unggah", "uji-upload", null, {
                field: "berkas", data: { judul: "KTP" }, headers: { login: "token" },
                onProgress: fraction => progress.push(fraction)
            }));
            const xhr = FakeXHR.last;
            assert.equal(xhr.method, "POST");
            assert.equal(xhr.headers.login, "token");
            assert.equal(xhr.body.getAll("berkas").length, 2);
            assert.equal(xhr.body.get("judul"), "KTP");
            assert.deepEqual(progress, [0.5, 1]);
            assert.equal(result.status, 201);
            assert.deepEqual(result.data, { id: 42 });
            assert.equal(result.headers.get("X-File-Id"), "42");
            assert.equal(result.error, null);
        } finally {
            FakeXHR.onSend = null;
            input.remove();
        }
    });
    test("tanpa file: error nofile tanpa request", async () => {
        const input = fileInput("uji-kosong", []);
        FakeXHR.last = null;
        const urutan = [];
        const result = await replacing("XMLHttpRequest", FakeXHR, () => {
            const done = uploadFile("https://contoh.test/unggah", "uji-kosong", () => urutan.push("callback"));
            urutan.push("sesudah uploadFile");
            return done;
        });
        input.remove();
        assert.equal(result.error, "nofile");
        assert.deepEqual(urutan, ["sesudah uploadFile", "callback"], "callback tetap jalan belakangan");
        assert.equal(FakeXHR.last, null);
    });
    test("timeout dihitung dari kemajuan terakhir; signal membatalkan", async () => {
        FakeXHR.onSend = xhr => setTimeout(() => xhr.progress(1, 10), 30);
        try {
            const started = performance.now();
            const late = await replacing("XMLHttpRequest", FakeXHR, () => uploadFile("https://contoh.test/u", new Blob(["x"]), null, { timeout: 50 }));
            assert.equal(late.error, "timeout");
            assert.ok(performance.now() - started >= 75, "kemajuan di 30 ms harus menunda timeout");
            const controller = new AbortController();
            FakeXHR.onSend = () => controller.abort();
            const cancelled = await replacing("XMLHttpRequest", FakeXHR, () => uploadFile("https://contoh.test/u", new Blob(["x"]), null, { signal: controller.signal }));
            assert.equal(cancelled.error, "abort");
        } finally {
            FakeXHR.onSend = null;
        }
    });
    test("server sungguhan: status dan body asli", async () => {
        // Server statis tidak menerima POST: python http.server menjawab 501, GitHub Pages 405,
        // keduanya dengan body HTML.
        const result = await uploadFile(new URL("./", location.href).href, new File(["isi"], "c.txt"), null);
        assert.ok(result.status >= 400, `status ${result.status}`);
        assert.equal(result.data, null);
        assert.equal(result.error, null);
    });
});

describe("api.js: downloadFile dan fungsi file lama", () => {
    test("downloadFile: Blob untuk 2xx, body error untuk selain itu", async () => {
        const ok = await downloadFile("./fixtures/Box.bin");
        assert.equal(ok.status, 200);
        assert.ok(ok.data instanceof Blob && ok.data.size > 0);
        const missing = await downloadFile("./fixtures/tidak-ada.bin");
        assert.ok(missing.status >= 400, `status ${missing.status}`); // 404, kadang 503 di GitHub Pages
        assert.ok(!(missing.data instanceof Blob));
    });
    test("postFile, postFileJSON, getFileBytesWithHeader tetap seperti dulu", async () => {
        const input = fileInput("uji-lama", [new File(["isi"], "d.txt")]);
        const sent = [];
        try {
            await replacing("fetch", (url, options) => {
                sent.push(options);
                return url.includes("bytes") ? Promise.resolve(new Response(new Uint8Array([1, 2, 3]))) : jsonResponse({ ok: true }, 200);
            }, async () => {
                const plain = await new Promise(resolve => postFile("https://contoh.test/a", "uji-lama", "file", resolve));
                const withStatus = await new Promise(resolve => postFileJSON("https://contoh.test/b", "login", "t", "uji-lama", "file", resolve));
                const bytes = await new Promise(resolve => getFileBytesWithHeader("https://contoh.test/bytes", "login", "t", resolve));
                assert.deepEqual(plain, { ok: true });
                assert.deepEqual(withStatus, { status: 200, data: { ok: true } });
                assert.deepEqual([...new Uint8Array(bytes)], [1, 2, 3]);
                assert.equal(sent[0].body.get("file").name, "d.txt");
                assert.equal(sent[1].headers.get("login"), "t");
            });
        } finally {
            input.remove();
        }
    });
});

describe("stp.js", () => {
    test("nomor divalidasi dulu; request dan jawaban", async () => {
        const sent = [];
        await replacing("fetch", (url, options) => {
            sent.push({ url, body: JSON.parse(options.body) });
            return jsonResponse({ status: "ok" });
        }, async () => {
            let invalid = null;
            await sendSTP("0812345", "captcha").catch(error => { invalid = error; });
            assert.ok(invalid && /62/.test(invalid.message), "nomor tanpa 62 harus ditolak");
            assert.equal(sent.length, 0);
            assert.deepEqual(await sendSTP("6281234567890", "captcha"), { status: "ok" });
            assert.deepEqual(sent[0].body, { phonenumber: "6281234567890", captcha: "captcha" });
            assert.ok(sent[0].url.endsWith("/auth/login"));
        });
    });
    test("server menolak: Promise reject", async () => {
        await replacing("fetch", () => jsonResponse({ status: "salah" }, 403), async () => {
            let rejected = null;
            await verifySTP("6281234567890", "000000").catch(error => { rejected = error; });
            assert.ok(rejected, "status 403 harus reject");
        });
    });
});

describe("websocket.js", () => {
    test("terhubung, mengirim id, menerima dan mengirim pesan", async () => {
        class FakeSocket {
            constructor(url) {
                FakeSocket.last = this;
                this.url = url;
                this.sent = [];
                this.readyState = 0;
                setTimeout(() => { this.readyState = 1; this.onopen(); }, 0);
            }
            send(message) { this.sent.push(message); }
            close() { this.closed = true; }
        }
        FakeSocket.OPEN = 1;
        await replacing("WebSocket", FakeSocket, async () => {
            const received = [];
            const socket = await openWebSocketSetId("user-7", btoa("wss://contoh.test/ws"), data => received.push(data));
            assert.equal(socket.url, "wss://contoh.test/ws");
            assert.deepEqual(socket.sent, ["user-7"]);
            socket.onmessage({ data: "halo" });
            assert.deepEqual(received, ["halo"]);
            sendMessagetoWebSocket("balas", socket);
            assert.deepEqual(socket.sent, ["user-7", "balas"]);
            closeWebSocket(socket);
            assert.ok(socket.closed);
        });
    });
});

describe("image.js dan trace.js", () => {
    test("warna acak", () => {
        assert.ok(/^#[0-9A-F]{6}$/.test(getRandomColor()));
        assert.equal(typeof getRandomColorName(), "string");
    });
    test("tapClick tidak gagal untuk klik maupun sentuhan", () => {
        const target = document.createElement("div");
        tapClick({ target, clientX: 3, clientY: 4 });
        tapClick({ target, touches: [{ clientX: 1, clientY: 2 }] });
    });
});
