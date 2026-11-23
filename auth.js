import { setCookieWithExpireHour, getCookie } from "./cookie.js";
import { postJSON } from "./api.js";
import { redirect } from "./url.js";
import { addJSInHead } from "./element.js";
import { refreshbutton, loginbutton } from "./template.js";
import { isMobile as IsMobile } from "./useragent.js";
import { qrSVG } from "./qr.js";

// Lama (detik) soket uuid lama tetap dibiarkan terbuka sesudah QR berotasi.
// Tanpa masa tenggang ini, pemindaian di detik-detik terakhir sebuah siklus
// pasti gagal: pengguna memindai, berpindah ke aplikasi WhatsApp, lalu menekan
// kirim beberapa detik kemudian — saat itu uuid-nya sudah tidak punya soket.
const DEFAULT_GRACE_PERIOD = 15;

function connectWS(wauthparam, id) {
    return new Promise(function (resolve, reject) {
        let wsconn = new WebSocket(atob(wauthparam.auth_ws));
        // Dicatat begitu dibuat, bukan setelah onopen: rotasi QR bisa terjadi
        // sebelum handshake selesai, dan soket yang belum tercatat tidak akan
        // pernah ditutup.
        wauthparam.wsocket = wsconn;
        wsconn.onopen = () => {
            wsconn.send(id);
            console.log("connected and set id");
            resolve(wsconn);
        };
        wsconn.onerror = (err) => {
            console.log("socket error rejected");
            reportLostConnection(wauthparam, wsconn, err);
            reject(err);
        };
        wsconn.onclose = (evt) => {
            console.log("connection closed");
            // Soket yang dipensiunkan saat rotasi memang seharusnya tertutup.
            // Yang perlu diberitahukan ke pengguna hanya kalau yang putus
            // adalah soket milik QR yang sedang tampil di layar.
            reportLostConnection(wauthparam, wsconn, evt);
        };
        wsconn.onmessage = (evt) => {
            let messages = evt.data;
            console.log("incoming message");
            catcher(wauthparam, messages);
        };

    });
}

function openWebSocketSetId(wauthparam, id) {
    if (window["WebSocket"]) { //check browser support
        connectWS(wauthparam, id).then((server) => {
            wauthparam.wsocket = server;
        }).catch((err) => {
            console.log("socket error id : " + id);
        });
    } else {
        alert("Please Update Your browser to the latest version.");
    }
}

function graceSeconds(wauthparam) {
    const grace = Number(wauthparam.graceperiod);
    if (!Number.isFinite(grace) || grace < 0) {
        return DEFAULT_GRACE_PERIOD;
    }
    // Masa tenggang tidak boleh melewati satu siklus penuh; kalau lewat, soket
    // lama masih hidup saat uuid sesudahnya sudah berotasi lagi.
    return Math.min(grace, wauthparam.interval);
}

// Melepas soket dari slot aktif lalu menutupnya sesudah masa tenggang habis.
// Selama tenggang itu onmessage-nya masih jalan, jadi pesan WhatsApp yang
// telat sedikit tetap bisa menuntaskan login.
function retireWebSocket(wauthparam) {
    const socket = wauthparam.wsocket;
    if (!socket || typeof socket.close !== "function") {
        wauthparam.wsocket = 0;
        return;
    }
    // Dilepas lebih dulu supaya onclose-nya nanti tidak dianggap koneksi putus
    // yang perlu dilaporkan ke pengguna.
    wauthparam.wsocket = 0;
    const grace = graceSeconds(wauthparam);
    if (grace <= 0) {
        socket.close();
        return;
    }
    setTimeout(() => socket.close(), grace * 1000);
}

// Dipanggil dari onerror dan onclose. Hanya bereaksi kalau yang putus adalah
// soket yang sedang dipakai QR di layar — soket pensiunan diabaikan.
function reportLostConnection(wauthparam, wsconn, detail) {
    if (wauthparam.wsocket !== wsconn) {
        return;
    }
    // Login sudah lewat: backend memang menutup soket sesudah mengirim token,
    // dan halaman sedang berpindah. Jangan sempat menampilkan "Connection Lost".
    if (wauthparam.loggedin) {
        return;
    }
    wauthparam.wsocket = 0;
    wauthparam.disconnected = true;
    showDisconnected(wauthparam);
    if (typeof wauthparam.onconnectionlost === "function") {
        wauthparam.onconnectionlost(detail);
    }
}

// Tombol sungguhan (bisa difokus dan ditekan dengan keyboard) berisi animasi
// refreshbutton, untuk memuat ulang halaman supaya mendapat QR baru.
function showRefreshButton(wauthparam) {
    const qr = document.getElementById(wauthparam.id_qr);
    if (!qr) {
        return;
    }
    const button = document.createElement("button");
    button.type = "button";
    button.className = "crootjs-qr-refresh";
    button.setAttribute("aria-label", "Muat ulang untuk mendapatkan QR baru");
    button.innerHTML = refreshbutton;
    button.addEventListener("click", () => location.reload());
    qr.replaceChildren(button);
}

// Menghentikan tampilan QR yang sudah pasti gagal dipindai dan menggantinya
// dengan tombol muat ulang.
function showDisconnected(wauthparam) {
    showRefreshButton(wauthparam);
    const counter = document.getElementById(wauthparam.id_counter);
    if (counter) {
        counter.innerHTML = "Connection Lost, Refresh Your Browser to get QR";
    }
}

function generatePassword() {
    const chars = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ-_.";
    var passwordLength = 17;
    var password = "";
    for (let i = 0; i <= passwordLength; i++) {
        var randomNumber = Math.floor(Math.random() * chars.length);
        password += chars.substring(randomNumber, randomNumber + 1);
    }
    return password;
}

function generateObjectId() {
    var timestamp = (new Date().getTime() / 1000 | 0).toString(16);
    var randomnum = 'xxxxxxxxxxxxxxxx'.replace(/[x]/g, function () {
        return (Math.random() * 16 | 0).toString(16);
    });
    return timestamp + randomnum
}

function generateUUID(wauthparam) {
    let wuid;
    if (window.location.search === '') {
        let uuid = generateObjectId() + "." + crypto.randomUUID() + "." + generatePassword() + "." + wauthparam.apphost;
        if (wauthparam.mobile) {
            wuid = "m." + uuid;
        } else {
            wuid = "d." + uuid;
        }
    } else {
        if (wauthparam.mobile) {
            wuid = wauthparam.urlgetparams.uuid;
        }
    }
    return wuid;
}


const sleepNow = (delay) => new Promise((resolve) => setTimeout(resolve, delay))

export async function qrController(wauthparam) {
    wauthparam.disconnected = false;
    wauthparam.loggedin = false;
    for (let i = 1; i <= wauthparam.maxqrwait; i++) {
        await sleepNow(1000);
        setCounterandQR(wauthparam);
        // Koneksi putus: showDisconnected sudah mengganti isi layar, jadi
        // rotasi dihentikan supaya pesannya tidak ditimpa penghitung.
        if (wauthparam.disconnected) {
            return;
        }
    }
    retireWebSocket(wauthparam);
    showRefreshButton(wauthparam);
    document.getElementById(wauthparam.id_counter).innerHTML = "Refresh Your Browser to get QR";
}

function setCounterandQR(wauthparam) {
    document.getElementById(wauthparam.id_counter).innerHTML = wauthparam.countdown;
    if (wauthparam.countdown === 0) {
        retireWebSocket(wauthparam);
        wauthparam.countdown = wauthparam.interval;
        let uuid = generateUUID(wauthparam);
        let waurl = atob(wauthparam.keyword) + uuid;
        showQR(waurl, wauthparam);
        openWebSocketSetId(wauthparam, uuid);
    }
    wauthparam.countdown--;
}

function makeQrCode(text, wauthparam) {
    document.getElementById(wauthparam.id_qr).innerHTML = qrSVG(text, { ecc: "H", label: "Kode QR login WhatsApp" });
}

// Di ponsel QR tidak bisa dipindai dari layar yang sama, jadi diganti tautan
// yang langsung membuka WhatsApp.
function makeLoginButton(text, wauthparam) {
    const link = document.createElement("a");
    link.href = text;
    link.className = "crootjs-wa-login";
    link.setAttribute("aria-label", "Login dengan WhatsApp");
    link.innerHTML = loginbutton;
    document.getElementById(wauthparam.id_qr).replaceChildren(link);
}

function showQR(text, wauthparam) {
    if (typeof text === 'string' && text.length === 0) {
        document.getElementById(wauthparam.id_qr).hidden = true;
    } else {
        if (wauthparam.mobile) {
            makeLoginButton(text, wauthparam);
        } else {
            makeQrCode(text, wauthparam);
        }

    }
}

export function deleteCookie(cname) {
    document.cookie = cname + "= ; expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/;";
}

function catcher(wauthparam, result) {
    if (result.length > 2) {
        let jsonres = JSON.parse(result);
        wauthparam.loggedin = true;
        setCookieWithExpireHour(wauthparam.tokencookiename, jsonres.login, wauthparam.tokencookiehourslifetime);
        window.location.replace(wauthparam.redirect);
    }
}


export { IsMobile };

export function getParamsfromURL() {
    return new Proxy(new URLSearchParams(window.location.search), {
        get: (searchParams, prop) => searchParams.get(prop),
    });
}

// Google Sign In
// Buat fungsi untuk memanggil gsi js dan menambahkan elemen div ke dalam DOM
export async function appendGoogleSignin(client_id, target_url) {
    try {
        // Memuat script Google Sign-In
        await addJSInHead("https://accounts.google.com/gsi/client");
        // Menginisialisasi Google Sign-In dan menetapkan gSignIn sebagai callback
        google.accounts.id.initialize({
            client_id: client_id,
            callback: (response) => gSignIn(response, target_url), // Menggunakan gSignIn sebagai callback untuk Google Sign-In
        });
        // Render tombol Google Sign-In dalam elemen dengan id "tombolgsigngoogle"
        google.accounts.id.renderButton(
            document.getElementById("logs"),
            {
                theme: "outline", // Bisa "filled_blue", "filled_black", "outline"
                size: "large", // Bisa "small", "medium", "large"
                text: "signin_with", // Bisa "signin_with" atau "continue_with"
                shape: "pill", // Bisa "rectangular", "pill", "circle", "square"
            }
        );
        // Memunculkan pop-up Google Sign-In
        google.accounts.id.prompt();
        console.log('Google Sign-In open successfully!');
    } catch (error) {
        console.error('Failed to load Google Sign-In script:', error);
    }
}

// Pesan modal dengan <dialog> bawaan browser (pengganti SweetAlert2). Resolve
// saat ditutup, baik lewat tombol OK maupun tombol Esc.
function showMessage(title, text) {
    return new Promise(resolve => {
        const dialog = document.createElement("dialog");
        dialog.className = "crootjs-auth-message";
        const heading = document.createElement("h2");
        heading.textContent = title;
        const body = document.createElement("p");
        body.textContent = text;
        const form = document.createElement("form");
        form.method = "dialog";
        const ok = document.createElement("button");
        ok.textContent = "OK";
        form.append(ok);
        dialog.append(heading, body, form);
        dialog.addEventListener("close", () => {
            dialog.remove();
            resolve();
        });
        document.body.append(dialog);
        dialog.showModal();
    });
}

function gSignIn(response, target_url) {
    return postJSON(target_url, { token: response.credential }, responsePostFunction, "login", getCookie("login"));
}

async function responsePostFunction(response) {
    if (response.status === 200 && response.data) {
        setCookieWithExpireHour('login', response.data.token, 18);
        redirect("/dashboard");
        return;
    }
    if (response.status === 0) {
        await showMessage("Gagal terhubung", "Server login tidak bisa dihubungi. Periksa koneksi internet lalu coba lagi.");
        return;
    }
    await showMessage("Login gagal", response.data?.message || "Anda belum terdaftar dengan login google, silahkan tap atau scan qr dahulu untuk pendaftaran.");
    redirect("/login");
}