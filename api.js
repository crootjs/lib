import { getLocal, setLocal } from "./storage.js";

const DEFAULT_TIMEOUT_MS = 15000;

// Menambahkan AbortController+timeout ke sebuah requestOptions object.
// Mengembalikan { cancel } - panggil cancel() setelah request selesai (baik sukses/gagal)
// supaya timer-nya tidak nyangkut.
function withTimeout(requestOptions, timeoutMs = DEFAULT_TIMEOUT_MS) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    requestOptions.signal = controller.signal;
    return { cancel: () => clearTimeout(timeoutId) };
}

// Jenis kegagalan jaringan untuk field error. Browser sengaja tidak membedakan CORS ditolak dan
// server tak terjangkau (keduanya TypeError yang sama), jadi keduanya "network".
function failure(state) {
    if (state.timedOut) return "timeout";
    if (state.aborted) return "abort";
    if (typeof navigator !== "undefined" && navigator.onLine === false) return "offline";
    return "network";
}

// Batas waktu (options.timeout, bawaan 15 detik) digabung dengan options.signal milik pemanggil
// (AbortController) menjadi satu signal untuk fetch. state mencatat penyebab pembatalan.
function control(options) {
    const controller = new AbortController();
    const state = { timedOut: false, aborted: false };
    const timeoutId = setTimeout(() => {
        state.timedOut = true;
        controller.abort();
    }, Number(options.timeout) > 0 ? Number(options.timeout) : DEFAULT_TIMEOUT_MS);
    const external = options.signal;
    const abort = () => {
        state.aborted = true;
        controller.abort();
    };
    if (external) {
        if (external.aborted) abort();
        else external.addEventListener("abort", abort);
    }
    const done = () => {
        clearTimeout(timeoutId);
        if (external) external.removeEventListener("abort", abort);
    };
    return { signal: controller.signal, state, done };
}

// Argumen sesudah responseFunction: (tokenkey, tokenvalue) seperti dulu, atau satu object opsi
// { headers, timeout, signal, cache: { key, ttl } } (token bisa ditaruh di headers).
function readOptions(tokenkey, tokenvalue) {
    if (tokenkey && typeof tokenkey === "object") return tokenkey;
    return tokenkey && tokenvalue ? { headers: { [tokenkey]: tokenvalue } } : {};
}

function requestJSON(method, target_url, responseFunction, datajson, options) {
    const headers = new Headers(options.headers || {});
    if (!headers.has("Accept")) headers.set("Accept", "application/json");
    // Content-Type hanya kalau ada body: GET dengan Content-Type: application/json memicu
    // preflight CORS, yang ditolak host statis (GitHub Pages, raw.githubusercontent.com).
    if (datajson !== undefined && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");

    // Hasilnya dikirim ke responseFunction (kalau ada) dan juga menjadi isi Promise yang
    // dikembalikan, jadi bisa dipakai dengan callback maupun await. Promise-nya tidak pernah
    // reject: kegagalan jaringan juga berupa { status: 0, data: null, error }.
    const respond = result => {
        if (typeof responseFunction === "function") responseFunction(result);
        return result;
    };

    // Cache di localStorage, hanya untuk GET: selama ttl detik tidak ada request sama sekali;
    // sesudahnya, kalau server memberi ETag, request membawa If-None-Match dan balasan 304
    // memakai data yang tersimpan.
    const cache = method === "GET" && options.cache && options.cache.key ? options.cache : null;
    const stored = cache ? getLocal(cache.key) : null;
    if (stored && Date.now() < stored.expiresAt) {
        return Promise.resolve(respond({ status: stored.status, data: stored.data, headers: new Headers(), error: null, cached: true }));
    }
    if (stored && stored.etag && !headers.has("If-None-Match")) headers.set("If-None-Match", stored.etag);

    const requestOptions = { method, redirect: 'follow', headers };
    if (datajson !== undefined) requestOptions.body = JSON.stringify(datajson);
    const { signal, state, done } = control(options);
    requestOptions.signal = signal;

    return fetch(target_url, requestOptions)
        .then(response => response.text().then(text => {
            let data;
            try {
                data = JSON.parse(text);
            } catch (parseError) {
                data = null;
            }
            const result = { status: response.status, data, headers: response.headers, error: null, cached: false };
            // 304 = data tersimpan masih berlaku. Statusnya dilaporkan seperti saat disimpan (200),
            // supaya pemanggil cukup memeriksa status === 200; headers tetap milik balasan 304.
            if (cache && response.status === 304 && stored) {
                result.status = stored.status;
                result.data = stored.data;
                result.cached = true;
            }
            if (cache && (response.ok || result.cached)) {
                setLocal(cache.key, {
                    status: result.status,
                    data: result.data,
                    etag: response.headers.get("ETag") || (stored && stored.etag) || null,
                    expiresAt: Date.now() + (Number(cache.ttl) || 0) * 1000
                });
            }
            return result;
        }))
        .catch(error => {
            // Jaringan gagal, timeout, atau CORS ditolak: fetch() tidak memberi response sama
            // sekali. status 0 bukan status HTTP asli (yang selalu >= 100).
            const kind = failure(state);
            if (kind !== "abort") console.warn(`${method} ${target_url} gagal (${kind}):`, error.message);
            return { status: 0, data: null, headers: new Headers(), error: kind, cached: false };
        })
        .finally(done)
        .then(respond);
}

// Keempatnya mengembalikan Promise berisi { status, data, headers, error, cached }, selain
// memanggil responseFunction. responseFunction boleh null untuk gaya await:
//   const { status, data } = await getJSON(url);
//   const result = await postJSON(url, body, null, "login", token);
// Sesudah responseFunction boleh (tokenkey, tokenvalue) atau satu object opsi:
//   headers  object header tambahan, misalnya { Authorization: "Bearer ..." }
//   timeout  milidetik sebelum request dibatalkan. Bawaan 15000.
//   signal   AbortSignal dari AbortController: controller.abort() membatalkan request
//            (error "abort", tanpa peringatan di console).
//   cache    { key, ttl }: simpan hasil GET yang berhasil di localStorage selama ttl detik
//            (hanya getJSON), lalu tanyakan ulang dengan If-None-Match; 304 memberi data tersimpan
//            dengan status aslinya (200) dan cached = true.
// headers = Headers dari server (kosong kalau gagal atau dari cache); error = null, atau
// "timeout" / "abort" / "offline" / "network" saat status 0; cached = true kalau data dari cache.
export function getJSON(target_url, responseFunction, tokenkey = null, tokenvalue = null) {
    return requestJSON('GET', target_url, responseFunction, undefined, readOptions(tokenkey, tokenvalue));
}

export function postJSON(target_url, datajson, responseFunction, tokenkey = null, tokenvalue = null) {
    return requestJSON('POST', target_url, responseFunction, datajson, readOptions(tokenkey, tokenvalue));
}

export function deleteJSON(target_url, datajson, responseFunction, tokenkey = null, tokenvalue = null) {
    return requestJSON('DELETE', target_url, responseFunction, datajson, readOptions(tokenkey, tokenvalue));
}

export function putJSON(target_url, datajson, responseFunction, tokenkey = null, tokenvalue = null) {
    return requestJSON('PUT', target_url, responseFunction, datajson, readOptions(tokenkey, tokenvalue));
}

// Headers dari teks getAllResponseHeaders() milik XMLHttpRequest.
function parseHeaders(text) {
    const headers = new Headers();
    text.trim().split(/[\r\n]+/).forEach(line => {
        const colon = line.indexOf(":");
        if (colon > 0) headers.append(line.slice(0, colon).trim(), line.slice(colon + 1).trim());
    });
    return headers;
}

function parseJSON(text) {
    try {
        return JSON.parse(text);
    } catch (parseError) {
        return null;
    }
}

// FormData dari source uploadFile; null kalau tidak ada file.
function toFormData(source, field, extra) {
    if (source instanceof FormData) return source;
    let files = source;
    if (typeof source === "string") {
        const input = document.getElementById(source);
        files = input && input.files ? input.files : null;
    }
    if (files instanceof Blob) files = [files];
    files = files ? Array.from(files) : [];
    if (files.length === 0) return null;
    const form = new FormData();
    files.forEach(file => form.append(field, file));
    Object.entries(extra || {}).forEach(([key, value]) => form.append(key, typeof value === "object" ? JSON.stringify(value) : String(value)));
    return form;
}

// Mengunggah file dengan multipart/form-data dan melaporkan kemajuannya. Hasilnya sama bentuknya
// dengan getJSON: { status, data, headers, error } ke responseFunction (boleh null) dan Promise
// yang tidak pernah reject.
// source: id <input type="file"> (semua file pilihannya), File/Blob, FileList, array File, atau
//         FormData yang sudah jadi.
// options (semua opsional):
//   field       nama field file di form. Bawaan "file" (samakan dengan backend).
//   data        object field tambahan, misalnya { judul: "Foto KTP" }.
//   method      Bawaan "POST".
//   headers     object header tambahan (token). Content-Type diisi browser (dengan boundary).
//   timeout     milidetik tanpa kemajuan sebelum dibatalkan. Bawaan 15000; dihitung ulang setiap
//               ada data yang terkirim, jadi file besar di jaringan lambat tetap bisa selesai.
//   signal      AbortSignal untuk membatalkan (error "abort").
//   onProgress  function (fraction, loaded, total) selama mengunggah; fraction 0 sampai 1.
// error "nofile" kalau tidak ada file yang dipilih (tanpa request).
// Memakai XMLHttpRequest, karena fetch() belum bisa melaporkan kemajuan unggahan.
export function uploadFile(target_url, source, responseFunction, options = {}) {
    const respond = result => {
        if (typeof responseFunction === "function") responseFunction(result);
        return result;
    };
    const form = toFormData(source, options.field || "file", options.data);
    if (!form) {
        console.warn(`uploadFile ${target_url}: tidak ada file yang dipilih.`);
        return Promise.resolve(respond({ status: 0, data: null, headers: new Headers(), error: "nofile" }));
    }
    return new Promise(resolve => {
        const xhr = new XMLHttpRequest();
        const state = { timedOut: false, aborted: false };
        const limit = Number(options.timeout) > 0 ? Number(options.timeout) : DEFAULT_TIMEOUT_MS;
        let timeoutId = null;
        const idle = () => {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => {
                state.timedOut = true;
                xhr.abort();
            }, limit);
        };
        const abort = () => {
            state.aborted = true;
            xhr.abort();
        };
        const finish = result => {
            clearTimeout(timeoutId);
            if (options.signal) options.signal.removeEventListener("abort", abort);
            resolve(respond(result));
        };
        const fail = () => {
            const kind = failure(state);
            if (kind !== "abort") console.warn(`uploadFile ${target_url} gagal (${kind}).`);
            finish({ status: 0, data: null, headers: new Headers(), error: kind });
        };
        xhr.open(options.method || "POST", target_url);
        new Headers(options.headers || {}).forEach((value, key) => xhr.setRequestHeader(key, value));
        if (!new Headers(options.headers || {}).has("Accept")) xhr.setRequestHeader("Accept", "application/json");
        xhr.upload.onprogress = event => {
            idle();
            if (typeof options.onProgress === "function" && event.lengthComputable) {
                options.onProgress(event.total ? event.loaded / event.total : 1, event.loaded, event.total);
            }
        };
        xhr.onprogress = idle;
        xhr.onload = () => finish({
            status: xhr.status,
            data: parseJSON(xhr.responseText),
            headers: parseHeaders(xhr.getAllResponseHeaders()),
            error: null
        });
        xhr.onerror = fail;
        xhr.onabort = fail;
        if (options.signal) {
            if (options.signal.aborted) {
                state.aborted = true;
                fail();
                return;
            }
            options.signal.addEventListener("abort", abort);
        }
        idle();
        xhr.send(form);
    });
}

// Mengunduh file. Hasil { status, data, headers, error } ke responseFunction (boleh null) dan
// Promise yang tidak pernah reject: data = Blob kalau status 2xx, selain itu body error server
// yang di-parse dari JSON (atau null).
// options (semua opsional): headers, timeout (bawaan 15000), signal - sama dengan getJSON - dan
//   fileName  kalau diisi, file 2xx langsung disimpan browser dengan nama ini.
export function downloadFile(target_url, responseFunction, options = {}) {
    const respond = result => {
        if (typeof responseFunction === "function") responseFunction(result);
        return result;
    };
    const { signal, state, done } = control(options);
    return fetch(target_url, { method: "GET", redirect: "follow", headers: new Headers(options.headers || {}), signal })
        .then(response => {
            if (!response.ok) {
                return response.text().then(text => ({ status: response.status, data: parseJSON(text), headers: response.headers, error: null }));
            }
            return response.blob().then(blob => {
                if (options.fileName) {
                    const url = URL.createObjectURL(blob);
                    const link = document.createElement("a");
                    link.href = url;
                    link.download = options.fileName;
                    document.body.appendChild(link);
                    link.click();
                    link.remove();
                    // Unduhan baru dimulai sesudah click() selesai diproses; URL dilepas sesudahnya.
                    setTimeout(() => URL.revokeObjectURL(url), 1000);
                }
                return { status: response.status, data: blob, headers: response.headers, error: null };
            });
        })
        .catch(error => {
            const kind = failure(state);
            if (kind !== "abort") console.warn(`downloadFile ${target_url} gagal (${kind}):`, error.message);
            return { status: 0, data: null, headers: new Headers(), error: kind };
        })
        .finally(done)
        .then(respond);
}

// errorFunction (opsional) dipanggil dengan sebuah Error kalau elemen tidak ada,
// server membalas status non-2xx, jaringan gagal, atau request timeout.
export function insertHTML(target_url,id,runFunction,errorFunction = null){
    const fail = (error) => {
        console.warn("Failed to load HTML from "+target_url+" into #"+id, error);
        if (typeof errorFunction === 'function') errorFunction(error);
    };

    const element = document.getElementById(id);
    if (!element) {
        fail(new Error(`Element with ID "${id}" not found.`));
        return;
    }

    var requestOptions = {
    method: 'GET',
    redirect: 'follow'
    };
    const { cancel } = withTimeout(requestOptions);

    fetch(target_url, requestOptions)
    .then(response => {
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.text();
    })
    .then(result => { element.innerHTML = result; })
    // Two-argument then: an exception thrown inside runFunction must not be reported as a load failure.
    .then(() => runFunction(), fail)
    .finally(cancel);
}

export function getDomHTML(target_url,domFunction){
    var requestOptions = {
    method: 'GET',
    redirect: 'follow'
    };
    const { cancel } = withTimeout(requestOptions);

    fetch(target_url, requestOptions)
    .then(response => response.text())
    .then(result => {
        const parser = new DOMParser();
        const htmlDom = parser.parseFromString(result, "text/html");
        domFunction(htmlDom);
    })
    .catch(error => console.warn(`Request ${target_url} gagal:`, error.message))
    .finally(cancel);
}

export function postFile(target_url,id,formdataname,responseFunction) {
    const input = document.getElementById(id);
    const file = input.files[0];
    const formData = new FormData();
    formData.append(formdataname, file);
    var requestOptions = {
        method: 'POST',
        body: formData,
        redirect: 'follow'
        };
    const { cancel } = withTimeout(requestOptions);

    fetch(target_url, requestOptions)
    .then(response => response.text())
    .then(result => {
        let parsed;
        try {
            parsed = JSON.parse(result);
        } catch (parseError) {
            parsed = null;
        }
        responseFunction(parsed);
    })
    .catch(error => {
        console.warn(`Request ${target_url} gagal:`, error.message);
        responseFunction(null);
    })
    .finally(cancel);
}

//make sure formdataname use in the backend to get data file
export function postFileWithHeader(target_url,tokenkey,tokenvalue,id,formdataname,responseFunction) {
    let myHeaders = new Headers();
    myHeaders.append(tokenkey, tokenvalue);
    myHeaders.append("Accept", "application/json");

    const input = document.getElementById(id);
    const file = input.files[0];
    const formData = new FormData();
    formData.append(formdataname, file);
    var requestOptions = {
        method: 'POST',
        body: formData,
        redirect: 'follow',
        headers: myHeaders
        };
    const { cancel } = withTimeout(requestOptions);

    fetch(target_url, requestOptions)
    .then(response => response.text())
    .then(result => {
        let parsed;
        try {
            parsed = JSON.parse(result);
        } catch (parseError) {
            parsed = null;
        }
        responseFunction(parsed);
    })
    .catch(error => {
        console.warn(`Request ${target_url} gagal:`, error.message);
        responseFunction(null);
    })
    .finally(cancel);
}

// function responseFunction(response) {
//     console.log('HTTP Status:', response.status);
//     console.log('Response Data:', response.data);
// }
export function postFileJSON(target_url, tokenkey, tokenvalue, id, formdataname, responseFunction) {
    let myHeaders = new Headers();
    myHeaders.append(tokenkey, tokenvalue);
    myHeaders.append("Accept", "application/json");

    const input = document.getElementById(id);
    const file = input.files[0];
    const formData = new FormData();
    formData.append(formdataname, file);

    var requestOptions = {
        method: 'POST',
        body: formData,
        redirect: 'follow',
        headers: myHeaders
    };
    const { cancel } = withTimeout(requestOptions);

    fetch(target_url, requestOptions)
    .then(response => response.text().then(data => ({
        status: response.status,
        data: data
    })))
    .then(result => {
        let parsed;
        try {
            parsed = JSON.parse(result.data);
        } catch (parseError) {
            parsed = null;
        }
        responseFunction({ status: result.status, data: parsed });
    })
    .catch(error => {
        console.warn(`Request ${target_url} gagal:`, error.message);
        responseFunction({ status: 0, data: null });
    })
    .finally(cancel);
}

// Mem-parse response.json() dengan aman - resolve ke null (bukan reject) kalau body-nya bukan JSON valid.
function safeJSON(response) {
    return response.json().catch(() => null);
}

//get file and download it into your browser, if not 200 then return json
export function getFileWithHeader(target_url, tokenkey, tokenvalue, responseFunction, fileName) {
    let myHeaders = new Headers();
    myHeaders.append(tokenkey, tokenvalue);

    let requestOptions = {
        method: 'GET',
        redirect: 'follow',
        headers: myHeaders
    };
    const { cancel } = withTimeout(requestOptions);

    fetch(target_url, requestOptions)
        .then(response => {
            if (response.status === 200) {
                // Jika status 200, download file
                return response.blob().then(blob => {
                    const url = window.URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    //let base64fileurl = target_url.split('/').pop();
                    a.download = fileName; // Nama file dari URL
                    document.body.appendChild(a);
                    a.click();
                    a.remove();
                });
            } else {
                // Jika status selain 200, parse sebagai JSON
                return safeJSON(response).then(result => responseFunction(result));
            }
        })
        .catch(error => {
            console.warn(`Request ${target_url} gagal:`, error.message);
            responseFunction({ status: 0 });
        })
        .finally(cancel);
}

//get file bytes if 200, othen than return json
export function getFileBytesWithHeader(target_url, tokenkey, tokenvalue, responseFunction) {
    let myHeaders = new Headers();
    myHeaders.append(tokenkey, tokenvalue);

    let requestOptions = {
        method: 'GET',
        redirect: 'follow',
        headers: myHeaders
    };
    const { cancel } = withTimeout(requestOptions);

    fetch(target_url, requestOptions)
        .then(response => {
            if (response.status === 200) {
                // Jika status 200, return fileBytes
                return response.arrayBuffer().then(buffer => responseFunction(buffer));
            } else {
                // Jika status selain 200, parse sebagai JSON
                return safeJSON(response).then(result => responseFunction(result));
            }
        })
        .catch(error => {
            console.warn(`Request ${target_url} gagal:`, error.message);
            responseFunction({ status: 0 });
        })
        .finally(cancel);
}