// Service worker uji untuk pwa.test.js, memuat serviceworker.js dari folder lib ini (bukan jsDelivr).
importScripts("../../serviceworker.js");
crootjsServiceWorker({ version: "uji", precache: ["README.md"] });
