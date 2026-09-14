import { setCookieWithExpireHour, getCookie } from "./cookie.js";
import { postJSON } from "./api.js";
import { redirect } from "./url.js";
import { addCSSInHead, addJSInHead } from "./element.js";
import Swal from 'https://cdn.jsdelivr.net/npm/sweetalert2@11/src/sweetalert2.js';

import { refreshbutton, loginbutton } from "./template.js";
import { isMobile as IsMobile } from "./useragent.js";
import qrcode from 'https://cdn.skypack.dev/qrcode-generator-es6';

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

// Menghentikan tampilan QR yang sudah pasti gagal dipindai dan menggantinya
// dengan tombol muat ulang.
function showDisconnected(wauthparam) {
    const qr = document.getElementById(wauthparam.id_qr);
    if (qr) {
        qr.innerHTML = refreshbutton;
    }
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
    var svg = document.getElementById(wauthparam.id_qr);
    svg.innerHTML = refreshbutton;
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
    const qrc = new qrcode(0, 'H');
    qrc.addData(text);
    qrc.make();
    let qr = qrc.createSvgTag({});
    var svg = document.getElementById(wauthparam.id_qr);
    svg.innerHTML = qr;
}

function makeLoginButton(text, wauthparam) {
    var svg = document.getElementById(wauthparam.id_qr);
    svg.innerHTML = loginbutton.replace("##URL##", text);
}

function showQR(text, wauthparam) {
    if (typeof text === 'string' && text.length === 0) {
        document.getElementById('qrcode').style.display = 'none';
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
        console.log("catcher runner");
        console.log(jsonres);
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
        // Memuat css sweet alert
        await addCSSInHead("https://cdn.jsdelivr.net/npm/sweetalert2@11/dist/sweetalert2.css");
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

async function gSignIn(response, target_url) {
    try {
        const gtoken = { token: response.credential };
        await postJSON(target_url, "login", getCookie("login"), gtoken, responsePostFunction);
    } catch (error) {
        console.error("Network or JSON parsing error:", error);
        Swal.fire({
            icon: "error",
            title: "Network Error",
            text: "An error occurred while trying to log in. Please try again.",
        });
    }
}

function responsePostFunction(response) {
    if (response.status === 200 && response.data) {
        console.log(response.data);
        setCookieWithExpireHour('login', response.data.token, 18);
        redirect("/dashboard");
    } else {
        console.error("Login failed:", response.data?.message || "Unknown error");
        Swal.fire({
            icon: "error",
            title: "Login Failed",
            text: response.data?.message || "Anda belum terdaftar dengan login google, silahkan tap atau scan qr dahulu untuk pendaftaran.",
        }).then(() => {
            redirect("/login");
        });
    }
}