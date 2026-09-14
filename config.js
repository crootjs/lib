import { getParamsfromURL } from "./auth.js";
import { isMobile } from "./useragent.js";

export const DefaultFailer = (_) => {
    alert("maaaf kakak, jangan lupa Swalnya dimasukkan ke html............")
}

/**
 *
 * @param {Object} json
 * @constructor
 */

export const DefaultSuccesser = (json) => {
    console.log(json)
}


export let wauthparam = {
    redirect: "./auth",
    auth_ws: "d3NzOi8vYXV0aC51bGJpLmFjLmlkL3dzL3doYXRzYXV0aC9xcg==",
    keyword: "aHR0cHM6Ly93YS5tZS82MjgxMTIwMDAyNzk/dGV4dD13aDR0NWF1dGgw",
    domaincookie: window.location.host,
    interval: 30,
    // Detik soket uuid lama tetap dibiarkan terbuka sesudah QR berotasi, supaya
    // pemindaian di detik-detik terakhir sebuah siklus tetap sempat masuk.
    // Dibatasi maksimal sepanjang `interval`.
    graceperiod: 15,
    maxqrwait: 90,
    tokencookiehourslifetime: 2,
    id_qr: "whatsauthqr",
    id_counter: "whatsauthcounter",
    tokencookiename: "login",
    apphost: btoa(document.location.href),
    rto: 0,
    countdown: 0,
    wsocket: 0,
    // Diisi qrController: true kalau soket QR yang sedang tampil terputus.
    disconnected: false,
    // Diisi catcher: true begitu token login diterima dan halaman berpindah.
    loggedin: false,
    // Opsional. Dipanggil dengan event close/error saat koneksi QR terputus,
    // supaya pemanggil bisa ikut bereaksi (logging, retry, ganti tampilan).
    onconnectionlost: null,
    mobile: isMobile(),
    urlgetparams: getParamsfromURL(),
    jsonres: null,
    uuid: null,
    waurl: null
}

export let autoinjector = {
    auth_ws: "d3M6Ly8xMjcuMC4wLjE6Nzk3OS9hcGkvdjIvd3Mvc2lw",
    domaincookie: window.location.host,
    using_click: true,
    id_form_user: 'username',
    id_form_password: 'password',
    id_form: 'loginform',
    id_button: 'login',
    interval: 30,
    tokencookiehourslifetime: 2,
    tokencookiename: "login",
    apphost: btoa(document.location.href),
    mobile: isMobile(),
    urlgetparams: getParamsfromURL(),
    failer: DefaultFailer,
    successer: DefaultSuccesser,
}

export const SwalChecker = () => {
    if (typeof Swal == "undefined") {
        alert("maaaf kakak, jangan lupa Swalnya dimasukkan ke html............")
    }
}