// Semua uji didaftarkan lewat import, lalu dijalankan berurutan.
import { run } from "./runner.js";
import "./core.test.js";
import "./geo.test.js";
import "./map.test.js";
import "./mapdraw.test.js";
import "./model3d.test.js";

run();
