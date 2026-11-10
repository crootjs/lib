// Pembantu uji peta: peta tanpa peta dasar (tidak bergantung server tile) dan klik tiruan.
import { fixture } from "./runner.js";
import { createMap } from "../map.js";

export function newMap(options = {}) {
    const id = fixture(400, 300);
    createMap(id, Object.assign({ tiles: false, center: [107.6, -6.9], zoom: 14 }, options));
    return id;
}

// Pointer di titik [x, y] relatif terhadap peta, dikirim ke target (bawaan: peta itu sendiri).
export function pointer(id, type, point, target, extra = {}) {
    const rect = document.getElementById(id).getBoundingClientRect();
    const element = target || document.getElementById(id).querySelector(".crootjs-map");
    element.dispatchEvent(new PointerEvent(type, Object.assign({
        bubbles: true, cancelable: true, pointerId: 1, pointerType: "mouse", button: 0,
        clientX: rect.left + point[0], clientY: rect.top + point[1]
    }, extra)));
}

// Klik tanpa geser.
export function tap(id, point, target) {
    pointer(id, "pointerdown", point, target);
    pointer(id, "pointerup", point, target);
}

export function doubleClick(id, point, target) {
    const rect = document.getElementById(id).getBoundingClientRect();
    const element = target || document.getElementById(id).querySelector(".crootjs-map");
    element.dispatchEvent(new MouseEvent("dblclick", { bubbles: true, cancelable: true, clientX: rect.left + point[0], clientY: rect.top + point[1] }));
}
