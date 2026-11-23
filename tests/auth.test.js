import { describe, test, assert } from "./runner.js";
import { qrController } from "../auth.js";

describe("auth.js", () => {
    test("qrController: tombol muat ulang saat soket gagal", async () => {
        const holder = document.createElement("div");
        holder.innerHTML = '<div id="auth-qr"></div><p id="auth-counter"></p>';
        document.body.appendChild(holder);
        const param = {
            id_qr: "auth-qr", id_counter: "auth-counter", interval: 30, graceperiod: 0, maxqrwait: 3, countdown: 0,
            keyword: btoa("https://wa.me/620000?text=uji"), apphost: btoa(location.href), mobile: false, wsocket: 0,
            // Port 9 (discard) di localhost: koneksi langsung ditolak, jadi jalur "Connection Lost" teruji.
            auth_ws: btoa("ws://127.0.0.1:9/"),
        };
        await qrController(param);
        const button = holder.querySelector("#auth-qr button");
        holder.remove();
        assert.ok(button, "tombol muat ulang");
        assert.equal(button.type, "button");
        assert.ok(param.disconnected);
    });
});
