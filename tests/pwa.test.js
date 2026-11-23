import { describe, test, assert, skip, wait } from "./runner.js";
import { registerServiceWorker, onNetworkChange, isStandalone, installButton } from "../pwa.js";

// beforeinstallprompt tiruan: browser uji tidak pernah mengirimnya sendiri.
function fakeInstallEvent(outcome) {
    const event = new Event("beforeinstallprompt", { cancelable: true });
    event.prompted = 0;
    event.prompt = () => { event.prompted++; };
    event.userChoice = Promise.resolve({ outcome, platform: "web" });
    return event;
}

function makeButton(id) {
    const button = document.createElement("button");
    button.type = "button";
    button.id = id;
    button.textContent = "Pasang aplikasi";
    document.body.appendChild(button);
    return button;
}

describe("pwa.js", () => {
    test("registerServiceWorker: ditolak di luar https/localhost, tanpa reject", async () => {
        const own = Object.getOwnPropertyDescriptor(window, "isSecureContext");
        try {
            Object.defineProperty(window, "isSecureContext", { value: false, configurable: true });
        } catch (error) {
            skip("isSecureContext tidak bisa ditiru di browser ini");
        }
        try {
            const result = await registerServiceWorker("tidak-ada.js");
            assert.deepEqual(result, { ok: false, registration: null, error: "insecure" });
        } finally {
            if (own) Object.defineProperty(window, "isSecureContext", own);
            else delete window.isSecureContext;
        }
        assert.equal(window.isSecureContext, true, "isSecureContext dipulihkan");
    });

    test("registerServiceWorker: file tidak ada memberi error failed, tanpa reject", async () => {
        if (!("serviceWorker" in navigator)) skip("service worker tidak tersedia");
        const result = await registerServiceWorker("fixtures/tidak-ada-sw.js", { scope: "fixtures/tidak-ada/" });
        assert.equal(result.ok, false);
        assert.equal(result.error, "failed");
    });

    test("registerServiceWorker + serviceworker.js: terpasang, precache tersimpan, lalu dibersihkan", async () => {
        if (!("serviceWorker" in navigator)) skip("service worker tidak tersedia");
        // Scope folder kosong supaya halaman uji ini sendiri tidak ikut dikendalikan.
        const result = await registerServiceWorker("fixtures/pwa-sw.js", { scope: "fixtures/pwa/" });
        assert.equal(result.ok, true, result.error);
        const registration = result.registration;
        try {
            for (let i = 0; i < 100 && !(registration.active && registration.active.state === "activated"); i++) await wait(50);
            assert.equal(registration.active && registration.active.state, "activated");
            const names = (await caches.keys()).filter(name => name.includes(registration.scope));
            const precache = names.find(name => name.endsWith("precache uji"));
            assert.ok(precache, `cache precache ada (${names.join(", ")})`);
            const stored = await (await caches.open(precache)).match(new URL("fixtures/README.md", location.href).href);
            assert.ok(stored && stored.ok, "README.md di-precache");
        } finally {
            await registration.unregister();
            for (const name of await caches.keys()) {
                if (name.includes(registration.scope)) await caches.delete(name);
            }
        }
    });

    test("onNetworkChange: nilai awal, event online/offline, berhenti mendengarkan", () => {
        const seen = [];
        const stop = onNetworkChange(online => seen.push(online));
        assert.deepEqual(seen, [navigator.onLine]);
        window.dispatchEvent(new Event("offline"));
        window.dispatchEvent(new Event("online"));
        assert.deepEqual(seen.slice(1), [false, true]);
        stop();
        window.dispatchEvent(new Event("offline"));
        assert.equal(seen.length, 3, "tidak dipanggil lagi sesudah berhenti");
    });

    test("isStandalone: false di tab browser biasa", () => {
        assert.equal(isStandalone(), false);
    });

    test("installButton: tersembunyi, tampil saat bisa dipasang, prompt sekali, lalu sembunyi", async () => {
        const button = makeButton("uji-pasang");
        const outcomes = [];
        try {
            installButton("uji-pasang", { onChoice: outcome => outcomes.push(outcome) });
            assert.equal(button.hidden, true, "tersembunyi sebelum beforeinstallprompt");
            const event = fakeInstallEvent("accepted");
            window.dispatchEvent(event);
            assert.equal(event.defaultPrevented, true, "ajakan bawaan browser ditunda");
            assert.equal(button.hidden, false, "tampil sesudah beforeinstallprompt");
            button.click();
            button.click();
            await wait(0);
            assert.equal(event.prompted, 1, "prompt() hanya sekali per event");
            assert.deepEqual(outcomes, ["accepted"]);
            assert.equal(button.hidden, true, "tersembunyi lagi sesudah dipakai");

            // Event yang datang sebelum tombol dipasang tetap dipakai.
            window.dispatchEvent(fakeInstallEvent("dismissed"));
            const late = makeButton("uji-pasang-2");
            installButton("uji-pasang-2");
            assert.equal(late.hidden, false);
            window.dispatchEvent(new Event("appinstalled"));
            assert.equal(late.hidden, true, "tersembunyi sesudah appinstalled");
            late.remove();
        } finally {
            button.remove();
        }
    });
});
