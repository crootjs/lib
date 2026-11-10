// Membuat file .glb kecil di memori untuk uji model3d.js: grup "Grup" berisi dua kubus
// ("Kotak_A" di x = -1, "Kotak_B" di x = +1, warna berbeda), plus animasi "Geser" yang
// menggerakkan Kotak_B dari y = 0 ke y = 2 dalam 1 detik.
export function makeGLB() {
    const positions = [];
    const normals = [];
    const indices = [];
    const faces = [[[1, 0, 0], [0, 1, 0], [0, 0, 1]], [[-1, 0, 0], [0, 0, 1], [0, 1, 0]], [[0, 1, 0], [0, 0, 1], [1, 0, 0]],
        [[0, -1, 0], [1, 0, 0], [0, 0, 1]], [[0, 0, 1], [1, 0, 0], [0, 1, 0]], [[0, 0, -1], [0, 1, 0], [1, 0, 0]]];
    faces.forEach(([n, u, v]) => {
        const start = positions.length / 3;
        [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(([a, b]) => {
            for (let k = 0; k < 3; k++) positions.push((n[k] + u[k] * a + v[k] * b) * 0.5);
            normals.push(...n);
        });
        indices.push(start, start + 1, start + 2, start, start + 2, start + 3);
    });
    const times = [0, 1];
    const moves = [1, 0, 0, 1, 2, 0];
    const parts = [new Float32Array(positions), new Float32Array(normals), new Uint16Array(indices), new Float32Array(times), new Float32Array(moves)];
    const views = [];
    let length = 0;
    parts.forEach(array => {
        length += (4 - length % 4) % 4;
        views.push({ buffer: 0, byteOffset: length, byteLength: array.byteLength });
        length += array.byteLength;
    });
    length += (4 - length % 4) % 4;
    const json = {
        asset: { version: "2.0" },
        scene: 0,
        scenes: [{ nodes: [0] }],
        nodes: [
            { name: "Grup", children: [1, 2] },
            { name: "Kotak_A", mesh: 0, translation: [-1, 0, 0] },
            { name: "Kotak_B", mesh: 1, translation: [1, 0, 0] }
        ],
        meshes: [
            { name: "Kubus_A", primitives: [{ attributes: { POSITION: 0, NORMAL: 1 }, indices: 2, material: 0 }] },
            { name: "Kubus_B", primitives: [{ attributes: { POSITION: 0, NORMAL: 1 }, indices: 2, material: 1 }] }
        ],
        materials: [
            { name: "Merah", pbrMetallicRoughness: { baseColorFactor: [0.8, 0.1, 0.1, 1], metallicFactor: 0 } },
            { name: "Biru", pbrMetallicRoughness: { baseColorFactor: [0.1, 0.2, 0.8, 1], metallicFactor: 0 } }
        ],
        accessors: [
            { bufferView: 0, componentType: 5126, count: positions.length / 3, type: "VEC3", min: [-0.5, -0.5, -0.5], max: [0.5, 0.5, 0.5] },
            { bufferView: 1, componentType: 5126, count: normals.length / 3, type: "VEC3" },
            { bufferView: 2, componentType: 5123, count: indices.length, type: "SCALAR" },
            { bufferView: 3, componentType: 5126, count: 2, type: "SCALAR", min: [0], max: [1] },
            { bufferView: 4, componentType: 5126, count: 2, type: "VEC3" }
        ],
        bufferViews: views,
        buffers: [{ byteLength: length }],
        animations: [{ name: "Geser", samplers: [{ input: 3, output: 4 }], channels: [{ sampler: 0, target: { node: 2, path: "translation" } }] }]
    };
    let text = new TextEncoder().encode(JSON.stringify(json));
    const jsonLength = text.length + (4 - text.length % 4) % 4;
    const total = 12 + 8 + jsonLength + 8 + length;
    const bytes = new Uint8Array(total);
    const view = new DataView(bytes.buffer);
    view.setUint32(0, 0x46546C67, true);
    view.setUint32(4, 2, true);
    view.setUint32(8, total, true);
    view.setUint32(12, jsonLength, true);
    view.setUint32(16, 0x4E4F534A, true);
    bytes.fill(0x20, 20, 20 + jsonLength);
    bytes.set(text, 20);
    view.setUint32(20 + jsonLength, length, true);
    view.setUint32(24 + jsonLength, 0x004E4942, true);
    parts.forEach((array, i) => bytes.set(new Uint8Array(array.buffer), 28 + jsonLength + views[i].byteOffset));
    return bytes.buffer;
}

export function hasWebGL() {
    const canvas = document.createElement("canvas");
    return Boolean(canvas.getContext("webgl2") || canvas.getContext("webgl"));
}

// Mesh ber-skin paling sederhana: persegi panjang dari x = 0 sampai 2 dengan dua tulang.
// Vertex di x = 0 ikut tulang "Akar" (di titik asal), vertex di x = 2 ikut tulang "Siku"
// (anak Akar, di x = 1). Memutar Siku 90° di sumbu Z mengangkat ujung kanan ke (1, 1).
export function makeSkinnedGLB() {
    const positions = new Float32Array([0, -0.1, 0, 2, -0.1, 0, 2, 0.1, 0, 0, 0.1, 0]);
    const joints = new Uint8Array([0, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0]);
    const weights = new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0]);
    const indices = new Uint16Array([0, 1, 2, 0, 2, 3]);
    const inverseBind = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, -1, 0, 0, 1]);
    const parts = [positions, joints, weights, indices, inverseBind];
    const views = [];
    let length = 0;
    parts.forEach(array => {
        length += (4 - length % 4) % 4;
        views.push({ buffer: 0, byteOffset: length, byteLength: array.byteLength });
        length += array.byteLength;
    });
    length += (4 - length % 4) % 4;
    const json = {
        asset: { version: "2.0" },
        scene: 0,
        scenes: [{ nodes: [0, 1] }],
        nodes: [
            { name: "Lengan", mesh: 0, skin: 0 },
            { name: "Akar", children: [2] },
            { name: "Siku", translation: [1, 0, 0] }
        ],
        skins: [{ joints: [1, 2], inverseBindMatrices: 4 }],
        meshes: [{ name: "Lengan", primitives: [{ attributes: { POSITION: 0, JOINTS_0: 1, WEIGHTS_0: 2 }, indices: 3 }] }],
        accessors: [
            { bufferView: 0, componentType: 5126, count: 4, type: "VEC3", min: [0, -0.1, 0], max: [2, 0.1, 0] },
            { bufferView: 1, componentType: 5121, count: 4, type: "VEC4" },
            { bufferView: 2, componentType: 5126, count: 4, type: "VEC4" },
            { bufferView: 3, componentType: 5123, count: 6, type: "SCALAR" },
            { bufferView: 4, componentType: 5126, count: 2, type: "MAT4" }
        ],
        bufferViews: views,
        buffers: [{ byteLength: length }]
    };
    return packGLB(json, parts, views, length);
}

function packGLB(json, parts, views, length) {
    const text = new TextEncoder().encode(JSON.stringify(json));
    const jsonLength = text.length + (4 - text.length % 4) % 4;
    const total = 12 + 8 + jsonLength + 8 + length;
    const bytes = new Uint8Array(total);
    const view = new DataView(bytes.buffer);
    view.setUint32(0, 0x46546C67, true);
    view.setUint32(4, 2, true);
    view.setUint32(8, total, true);
    view.setUint32(12, jsonLength, true);
    view.setUint32(16, 0x4E4F534A, true);
    bytes.fill(0x20, 20, 20 + jsonLength);
    bytes.set(text, 20);
    view.setUint32(20 + jsonLength, length, true);
    view.setUint32(24 + jsonLength, 0x004E4942, true);
    parts.forEach((array, i) => bytes.set(new Uint8Array(array.buffer, array.byteOffset, array.byteLength), 28 + jsonLength + views[i].byteOffset));
    return bytes.buffer;
}
