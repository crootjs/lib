// Penampil model 3D glTF 2.0 (.glb dan .gltf) yang ditulis dari nol: parser biner, matriks,
// shader, dan kontrol orbit sendiri - tanpa Three.js atau library lain. Merender dengan
// WebGL2, dengan cadangan otomatis ke WebGL1 untuk browser lama.
//
// Kontrol: geser = putar, klik kanan + geser / Shift + geser / dua jari = geser pandangan,
// roda mouse / pinch = zoom, klik ganda = pusatkan di titik itu, panah dan +/- di keyboard.
//
// Gizmo transform, hotspot HTML, dan ekspor GLB ada di model3dtools.js.

const DRAG_THRESHOLD = 4;                 // piksel gerakan sebelum tekanan dianggap geser, bukan klik
const MAX_PITCH = 89 * Math.PI / 180;     // kamera tidak boleh tepat di atas/bawah target
const ROTATE_SPEED = 0.008;               // radian per piksel geser
const CAMERA_DURATION = 300;              // ms animasi fitView dan klik ganda
const GLB_MAGIC = 0x46546C67;             // "glTF"
const CHUNK_JSON = 0x4E4F534A;
const CHUNK_BIN = 0x004E4942;
const SUPPORTED_EXTENSIONS = ["KHR_materials_unlit", "KHR_materials_emissive_strength", "KHR_mesh_quantization"];
const COMPONENTS = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT2: 4, MAT3: 9, MAT4: 16 };
const ARRAY_TYPES = { 5120: Int8Array, 5121: Uint8Array, 5122: Int16Array, 5123: Uint16Array, 5125: Uint32Array, 5126: Float32Array };
const DATA_GETTERS = { 5120: "getInt8", 5121: "getUint8", 5122: "getInt16", 5123: "getUint16", 5125: "getUint32", 5126: "getFloat32" };
// Atribut bilangan bulat yang "normalized" dibaca sebagai pecahan (spesifikasi glTF 3.11).
const NORMALIZE = { 5120: v => Math.max(v / 127, -1), 5121: v => v / 255, 5122: v => Math.max(v / 32767, -1), 5123: v => v / 65535 };
const ATTRIBUTES = ["aPosition", "aNormal", "aUV", "aColor"]; // urutan = lokasi atributnya
const ATTRIBUTE_DEFAULTS = { aNormal: [0, 0, 1, 0], aUV: [0, 0, 0, 0], aColor: [1, 1, 1, 1] };
// Material tanpa definisi: abu-abu terang yang tidak mengilap (bawaan spesifikasi, logam penuh,
// tampak gelap tanpa peta lingkungan).
const DEFAULT_MATERIAL = { color: [0.8, 0.8, 0.8, 1], texture: null, metallic: 0, roughness: 0.8, emissive: [0, 0, 0], alphaMode: "OPAQUE", alphaCutoff: 0.5, doubleSided: false, unlit: false };

const VERTEX_SHADER = `
attribute vec3 aPosition;
attribute vec3 aNormal;
attribute vec2 aUV;
attribute vec4 aColor;
uniform mat4 uViewProj;
uniform mat4 uModel;
uniform mat3 uNormal;
varying vec3 vWorld;
varying vec3 vNormal;
varying vec2 vUV;
varying vec4 vColor;
void main() {
    vec4 world = uModel * vec4(aPosition, 1.0);
    vWorld = world.xyz;
    vNormal = uNormal * aNormal;
    vUV = aUV;
    vColor = aColor;
    gl_PointSize = 4.0;
    gl_Position = uViewProj * world;
}`;

// Pencahayaan sederhana: cahaya langit/tanah (ambient), satu lampu searah yang ikut kamera,
// dan kilap Blinn-Phong menurut roughness. Warna dihitung di ruang linear, lalu dikembalikan
// ke sRGB di akhir.
const FRAGMENT_SHADER = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform vec4 uColor;
uniform sampler2D uTexture;
uniform float uUseTexture;
uniform vec3 uEmissive;
uniform vec3 uEye;
uniform vec3 uLight;
uniform float uMetallic;
uniform float uRoughness;
uniform float uLit;
uniform float uAlphaMode;
uniform float uAlphaCutoff;
uniform float uHighlight;
uniform vec4 uClip;
uniform float uClipOn;
uniform vec4 uCap;
varying vec3 vWorld;
varying vec3 vNormal;
varying vec2 vUV;
varying vec4 vColor;
void main() {
    vec4 base = uColor * vColor;
    if (uUseTexture > 0.5) {
        vec4 texel = texture2D(uTexture, vUV);
        base *= vec4(pow(texel.rgb, vec3(2.2)), texel.a);
    }
    if (uAlphaMode > 0.5 && uAlphaMode < 1.5 && base.a < uAlphaCutoff) discard;
    float alpha = uAlphaMode > 1.5 ? base.a : 1.0;
    // Potongan melintang: sisi depan bidang dibuang. Permukaan dalam yang jadi terlihat
    // (sisi belakang segitiga) diwarnai rata seperti bidang potong yang padat.
    if (uClipOn > 0.5) {
        if (dot(uClip.xyz, vWorld) + uClip.w > 0.0) discard;
        if (!gl_FrontFacing) {
            vec3 cap = uCap.a > 0.5 ? uCap.rgb : base.rgb * 0.55;
            gl_FragColor = vec4(pow(clamp(cap, 0.0, 1.0), vec3(1.0 / 2.2)), 1.0);
            return;
        }
    }
    vec3 color = base.rgb;
    if (uLit > 0.5) {
        vec3 n = normalize(vNormal);
        if (!gl_FrontFacing) n = -n;
        vec3 v = normalize(uEye - vWorld);
        float diffuse = max(dot(n, uLight), 0.0);
        vec3 ambient = mix(vec3(0.16, 0.15, 0.14), vec3(0.36, 0.38, 0.42), 0.5 + 0.5 * n.y);
        vec3 h = normalize(uLight + v);
        float specular = pow(max(dot(n, h), 0.0), mix(96.0, 6.0, uRoughness)) * (1.0 - 0.85 * uRoughness);
        vec3 f0 = mix(vec3(0.04), base.rgb, uMetallic);
        color = base.rgb * (1.0 - 0.6 * uMetallic) * (ambient + vec3(0.8) * diffuse) + f0 * specular * step(0.0001, diffuse);
    }
    color += uEmissive;
    color = mix(color, vec3(0.1, 0.35, 1.0), uHighlight * 0.45);
    gl_FragColor = vec4(pow(clamp(color, 0.0, 1.0), vec3(1.0 / 2.2)) * alpha, alpha);
}`;

const viewers = new Map(); // id elemen -> state penampil

function injectStyles() {
    if (document.getElementById("crootjs-model3d-style")) return;
    const style = document.createElement("style");
    style.id = "crootjs-model3d-style";
    style.textContent = `
.crootjs-3d {
    position: absolute;
    inset: 0;
    z-index: 0;
    overflow: hidden;
    background: radial-gradient(circle at 50% 35%, #f8fafc, #d9dee5);
    cursor: grab;
    touch-action: none;
    user-select: none;
    -webkit-user-select: none;
    -webkit-touch-callout: none;
    -webkit-tap-highlight-color: transparent;
    font: 13px/1.4 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    color: #1f2937;
}
.crootjs-3d:focus-visible { outline: 2px solid #2563eb; outline-offset: -2px; }
.crootjs-3d-dragging { cursor: grabbing; }
.crootjs-3d canvas.crootjs-3d-canvas { display: block; width: 100%; height: 100%; }
.crootjs-3d-overlay { position: absolute; inset: 0; pointer-events: none; }
.crootjs-3d-message {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 16px;
    text-align: center;
}
`;
    // Di awal <head> (sesudah style CrootJS lain): CSS halaman yang ditautkan sesudahnya
    // menang tanpa !important.
    const previous = [...document.head.querySelectorAll('style[id^="crootjs-"]')].pop();
    if (previous) previous.after(style);
    else document.head.prepend(style);
}

// ---- Vektor dan matriks. Matriks 4x4 disimpan column-major di Float32Array, sama seperti
// WebGL dan glTF.

const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const subtract = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const scale = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const length = a => Math.hypot(a[0], a[1], a[2]);
const normalize = a => scale(a, 1 / (length(a) || 1));
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const toRadians = degrees => degrees * Math.PI / 180;
const toDegrees = radians => radians * 180 / Math.PI;

function identity() {
    const m = new Float32Array(16);
    m[0] = m[5] = m[10] = m[15] = 1;
    return m;
}

function multiply(a, b) {
    const out = new Float32Array(16);
    for (let column = 0; column < 4; column++) {
        for (let row = 0; row < 4; row++) {
            out[column * 4 + row] = a[row] * b[column * 4] + a[4 + row] * b[column * 4 + 1]
                + a[8 + row] * b[column * 4 + 2] + a[12 + row] * b[column * 4 + 3];
        }
    }
    return out;
}

function invert(a) {
    const [a00, a01, a02, a03, a10, a11, a12, a13, a20, a21, a22, a23, a30, a31, a32, a33] = a;
    const b00 = a00 * a11 - a01 * a10, b01 = a00 * a12 - a02 * a10, b02 = a00 * a13 - a03 * a10;
    const b03 = a01 * a12 - a02 * a11, b04 = a01 * a13 - a03 * a11, b05 = a02 * a13 - a03 * a12;
    const b06 = a20 * a31 - a21 * a30, b07 = a20 * a32 - a22 * a30, b08 = a20 * a33 - a23 * a30;
    const b09 = a21 * a32 - a22 * a31, b10 = a21 * a33 - a23 * a31, b11 = a22 * a33 - a23 * a32;
    let det = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;
    if (!det) return null;
    det = 1 / det;
    return new Float32Array([
        (a11 * b11 - a12 * b10 + a13 * b09) * det, (a02 * b10 - a01 * b11 - a03 * b09) * det,
        (a31 * b05 - a32 * b04 + a33 * b03) * det, (a22 * b04 - a21 * b05 - a23 * b03) * det,
        (a12 * b08 - a10 * b11 - a13 * b07) * det, (a00 * b11 - a02 * b08 + a03 * b07) * det,
        (a32 * b02 - a30 * b05 - a33 * b01) * det, (a20 * b05 - a22 * b02 + a23 * b01) * det,
        (a10 * b10 - a11 * b08 + a13 * b06) * det, (a01 * b08 - a00 * b10 - a03 * b06) * det,
        (a30 * b04 - a31 * b02 + a33 * b00) * det, (a21 * b02 - a20 * b04 - a23 * b00) * det,
        (a11 * b07 - a10 * b09 - a12 * b06) * det, (a00 * b09 - a01 * b07 + a02 * b06) * det,
        (a31 * b01 - a30 * b03 - a32 * b00) * det, (a20 * b03 - a21 * b01 + a22 * b00) * det
    ]);
}

function perspective(fovy, aspect, near, far) {
    const f = 1 / Math.tan(fovy / 2);
    const m = new Float32Array(16);
    m[0] = f / aspect;
    m[5] = f;
    m[10] = (far + near) / (near - far);
    m[11] = -1;
    m[14] = 2 * far * near / (near - far);
    return m;
}

function lookAt(eye, target) {
    const z = normalize(subtract(eye, target));
    const x = normalize(cross([0, 1, 0], z));
    const y = cross(z, x);
    return new Float32Array([
        x[0], y[0], z[0], 0, x[1], y[1], z[1], 0, x[2], y[2], z[2], 0,
        -dot(x, eye), -dot(y, eye), -dot(z, eye), 1
    ]);
}

function transformPoint(m, p) {
    return [
        m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12],
        m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13],
        m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14]
    ];
}

function transformDirection(m, d) {
    return [
        m[0] * d[0] + m[4] * d[1] + m[8] * d[2],
        m[1] * d[0] + m[5] * d[1] + m[9] * d[2],
        m[2] * d[0] + m[6] * d[1] + m[10] * d[2]
    ];
}

// Titik dunia -> clip space, lalu dibagi w.
function projectPoint(m, p) {
    const w = m[3] * p[0] + m[7] * p[1] + m[11] * p[2] + m[15];
    return [
        (m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12]) / w,
        (m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13]) / w,
        (m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14]) / w,
        w
    ];
}

function composeTRS(t, q, s) {
    const [x, y, z, w] = q;
    const x2 = x + x, y2 = y + y, z2 = z + z;
    const xx = x * x2, xy = x * y2, xz = x * z2, yy = y * y2, yz = y * z2, zz = z * z2;
    const wx = w * x2, wy = w * y2, wz = w * z2;
    return new Float32Array([
        (1 - (yy + zz)) * s[0], (xy + wz) * s[0], (xz - wy) * s[0], 0,
        (xy - wz) * s[1], (1 - (xx + zz)) * s[1], (yz + wx) * s[1], 0,
        (xz + wy) * s[2], (yz - wx) * s[2], (1 - (xx + yy)) * s[2], 0,
        t[0], t[1], t[2], 1
    ]);
}

// Matriks node glTF -> translasi, quaternion, dan skala (tanpa shear).
function decompose(m) {
    let sx = Math.hypot(m[0], m[1], m[2]);
    const sy = Math.hypot(m[4], m[5], m[6]) || 1;
    const sz = Math.hypot(m[8], m[9], m[10]) || 1;
    if (determinant3(m) < 0) sx = -sx;
    sx = sx || 1;
    // rotasi baris-kolom (mRK = baris R, kolom K)
    const m11 = m[0] / sx, m21 = m[1] / sx, m31 = m[2] / sx;
    const m12 = m[4] / sy, m22 = m[5] / sy, m32 = m[6] / sy;
    const m13 = m[8] / sz, m23 = m[9] / sz, m33 = m[10] / sz;
    const trace = m11 + m22 + m33;
    let q;
    if (trace > 0) {
        const s = 0.5 / Math.sqrt(trace + 1);
        q = [(m32 - m23) * s, (m13 - m31) * s, (m21 - m12) * s, 0.25 / s];
    } else if (m11 > m22 && m11 > m33) {
        const s = 2 * Math.sqrt(1 + m11 - m22 - m33);
        q = [0.25 * s, (m12 + m21) / s, (m13 + m31) / s, (m32 - m23) / s];
    } else if (m22 > m33) {
        const s = 2 * Math.sqrt(1 + m22 - m11 - m33);
        q = [(m12 + m21) / s, 0.25 * s, (m23 + m32) / s, (m13 - m31) / s];
    } else {
        const s = 2 * Math.sqrt(1 + m33 - m11 - m22);
        q = [(m13 + m31) / s, (m23 + m32) / s, 0.25 * s, (m21 - m12) / s];
    }
    return { translation: [m[12], m[13], m[14]], rotation: q, scale: [sx, sy, sz] };
}

function determinant3(m) {
    return m[0] * (m[5] * m[10] - m[6] * m[9]) - m[4] * (m[1] * m[10] - m[2] * m[9]) + m[8] * (m[1] * m[6] - m[2] * m[5]);
}

// Invers-transpose bagian 3x3: untuk memutar normal dengan benar walau skalanya tidak seragam.
function normalMatrix(m) {
    const a00 = m[0], a01 = m[1], a02 = m[2], a10 = m[4], a11 = m[5], a12 = m[6], a20 = m[8], a21 = m[9], a22 = m[10];
    const b01 = a22 * a11 - a12 * a21, b11 = -a22 * a10 + a12 * a20, b21 = a21 * a10 - a11 * a20;
    let det = a00 * b01 + a01 * b11 + a02 * b21;
    if (!det) return new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1]);
    det = 1 / det;
    return new Float32Array([
        b01 * det, b11 * det, b21 * det,
        (-a22 * a01 + a02 * a21) * det, (a22 * a00 - a02 * a20) * det, (-a21 * a00 + a01 * a20) * det,
        (a12 * a01 - a02 * a11) * det, (-a12 * a00 + a02 * a10) * det, (a11 * a00 - a01 * a10) * det
    ]);
}

// Sudut Euler dalam derajat, urutan XYZ (sama dengan Blender dan Three.js) <-> quaternion.
function eulerToQuaternion(degrees) {
    const [x, y, z] = degrees.map(value => toRadians(value) / 2);
    const c1 = Math.cos(x), c2 = Math.cos(y), c3 = Math.cos(z);
    const s1 = Math.sin(x), s2 = Math.sin(y), s3 = Math.sin(z);
    return [
        s1 * c2 * c3 + c1 * s2 * s3,
        c1 * s2 * c3 - s1 * c2 * s3,
        c1 * c2 * s3 + s1 * s2 * c3,
        c1 * c2 * c3 - s1 * s2 * s3
    ];
}

function quaternionToEuler(q) {
    const m = composeTRS([0, 0, 0], q, [1, 1, 1]);
    const y = Math.asin(clamp(m[8], -1, 1));
    let x, z;
    if (Math.abs(m[8]) < 0.9999999) {
        x = Math.atan2(-m[9], m[10]);
        z = Math.atan2(-m[4], m[0]);
    } else {
        x = Math.atan2(m[6], m[5]);
        z = 0;
    }
    // (x, y, z) dan (x + 180, 180 - y, z + 180) adalah putaran yang sama. Kalau X dan Z
    // sama-sama lewat 90 derajat, bentuk kedua yang dipakai, supaya putaran murni di sumbu Y
    // (azimuth) di atas 90 derajat tetap terbaca [0, y, 0], bukan [180, 180 - y, 180].
    const wrap = angle => Math.atan2(Math.sin(angle), Math.cos(angle));
    const flip = Math.abs(x) > Math.PI / 2 + 1e-9 && Math.abs(z) > Math.PI / 2 + 1e-9;
    const angles = flip ? [wrap(x + Math.PI), wrap(Math.PI - y), wrap(z + Math.PI)] : [x, y, z];
    return angles.map(value => Math.round(toDegrees(value) * 1e6) / 1e6 || 0);
}

// Warna CSS apa pun ("red", "#f00", "rgb(...)") atau [r, g, b, a] 0..1 -> RGBA linear.
let colorContext = null;
function parseColor(color) {
    let rgba;
    if (Array.isArray(color)) {
        rgba = [color[0], color[1], color[2], color[3] === undefined ? 1 : color[3]];
    } else {
        colorContext = colorContext || document.createElement("canvas").getContext("2d");
        colorContext.fillStyle = "#000";
        colorContext.fillStyle = String(color);
        const value = colorContext.fillStyle;
        if (value[0] === "#") {
            rgba = [1, 3, 5].map(i => parseInt(value.slice(i, i + 2), 16) / 255).concat(1);
        } else {
            const parts = value.match(/[\d.]+/g).map(Number);
            rgba = [parts[0] / 255, parts[1] / 255, parts[2] / 255, parts[3] === undefined ? 1 : parts[3]];
        }
    }
    return [Math.pow(rgba[0], 2.2), Math.pow(rgba[1], 2.2), Math.pow(rgba[2], 2.2), rgba[3]];
}

// ---- Membaca glTF / GLB

function loadURI(uri, base) {
    return fetch(new URL(uri, base)).then(response => {
        if (!response.ok) throw new Error(`HTTP ${response.status} saat mengunduh ${uri}`);
        return response.arrayBuffer();
    });
}

// ArrayBuffer .glb atau .gltf -> { json, buffers: [ArrayBuffer], images: [{ bytes, mimeType }] }.
// Buffer dan gambar eksternal (file .bin, .png, atau data: URI) ikut diunduh di sini.
async function parseModel(data, base) {
    const view = new DataView(data);
    let json = null;
    let bin = null;
    if (data.byteLength >= 12 && view.getUint32(0, true) === GLB_MAGIC) {
        if (view.getUint32(4, true) !== 2) throw new Error("hanya GLB versi 2 yang didukung");
        const total = Math.min(view.getUint32(8, true), data.byteLength);
        let offset = 12;
        while (offset + 8 <= total) {
            const chunkLength = view.getUint32(offset, true);
            const type = view.getUint32(offset + 4, true);
            const start = offset + 8;
            if (type === CHUNK_JSON) json = JSON.parse(new TextDecoder().decode(new Uint8Array(data, start, chunkLength)));
            else if (type === CHUNK_BIN && !bin) bin = data.slice(start, start + chunkLength);
            offset = start + chunkLength;
        }
    } else {
        try {
            json = JSON.parse(new TextDecoder().decode(data));
        } catch (parseError) {
            throw new Error("bukan file .glb atau .gltf");
        }
    }
    if (!json || !json.asset || String(json.asset.version)[0] !== "2") throw new Error("bukan glTF 2.0");
    const unsupported = (json.extensionsRequired || []).filter(name => !SUPPORTED_EXTENSIONS.includes(name));
    if (unsupported.length) {
        throw new Error(`model memakai ${unsupported.join(", ")} yang belum didukung. Ekspor ulang tanpa kompresi Draco/meshopt`);
    }

    const buffers = await Promise.all((json.buffers || []).map((buffer, index) => {
        if (buffer.uri !== undefined) return loadURI(buffer.uri, base);
        if (index === 0 && bin) return bin;
        throw new Error(`buffer ${index} tidak punya data`);
    }));
    const images = await Promise.all((json.images || []).map(image => {
        if (image.bufferView !== undefined) {
            const bufferView = json.bufferViews[image.bufferView];
            const bytes = new Uint8Array(buffers[bufferView.buffer], bufferView.byteOffset || 0, bufferView.byteLength);
            return { bytes, mimeType: image.mimeType || "image/png" };
        }
        if (image.uri === undefined) return null;
        const mimeType = image.mimeType || (/\.jpe?g$/i.test(image.uri) || /^data:image\/jpeg/.test(image.uri) ? "image/jpeg" : "image/png");
        return loadURI(image.uri, base).then(buffer => ({ bytes: new Uint8Array(buffer), mimeType }), error => {
            console.warn(`Tekstur ${image.uri} gagal dimuat: ${error.message}`);
            return null;
        });
    }));
    return { json, buffers, images };
}

// Accessor -> { array, size, componentType, normalized, count }. array dibaca langsung dari
// buffer (tanpa menyalin) kalau datanya rapat; data berselang-seling (byteStride) disalin.
function readAccessor(source, index) {
    const { json, buffers } = source;
    const accessor = json.accessors[index];
    const size = COMPONENTS[accessor.type];
    const Type = ARRAY_TYPES[accessor.componentType];
    if (!size || !Type) throw new Error(`accessor ${index}: tipe tidak dikenal`);
    const total = accessor.count * size;
    let array;
    if (accessor.bufferView === undefined) {
        array = new Type(total);
    } else {
        const bufferView = json.bufferViews[accessor.bufferView];
        const buffer = buffers[bufferView.buffer];
        const offset = (bufferView.byteOffset || 0) + (accessor.byteOffset || 0);
        const elementBytes = Type.BYTES_PER_ELEMENT * size;
        const stride = bufferView.byteStride || elementBytes;
        if (stride === elementBytes && offset % Type.BYTES_PER_ELEMENT === 0) {
            array = new Type(buffer, offset, total);
        } else {
            array = new Type(total);
            const data = new DataView(buffer);
            const get = DATA_GETTERS[accessor.componentType];
            for (let i = 0; i < accessor.count; i++) {
                for (let k = 0; k < size; k++) {
                    array[i * size + k] = data[get](offset + i * stride + k * Type.BYTES_PER_ELEMENT, true);
                }
            }
        }
    }
    if (accessor.sparse) {
        // Sparse: sebagian elemen ditimpa nilai lain. Salinan dibuat supaya buffer aslinya utuh.
        const sparse = accessor.sparse;
        array = array.slice();
        const indexView = json.bufferViews[sparse.indices.bufferView];
        const IndexType = ARRAY_TYPES[sparse.indices.componentType];
        const indices = new IndexType(buffers[indexView.buffer].slice((indexView.byteOffset || 0) + (sparse.indices.byteOffset || 0)), 0, sparse.count);
        const valueView = json.bufferViews[sparse.values.bufferView];
        const values = new Type(buffers[valueView.buffer].slice((valueView.byteOffset || 0) + (sparse.values.byteOffset || 0)), 0, sparse.count * size);
        for (let i = 0; i < sparse.count; i++) {
            for (let k = 0; k < size; k++) array[indices[i] * size + k] = values[i * size + k];
        }
    }
    return { array, size, componentType: accessor.componentType, normalized: Boolean(accessor.normalized), count: accessor.count };
}

function toFloat(accessor) {
    if (accessor.array instanceof Float32Array) return accessor.array;
    const convert = accessor.normalized ? NORMALIZE[accessor.componentType] : value => value;
    return Float32Array.from(accessor.array, convert);
}

// Normal per titik dari rata-rata normal segitiga di sekitarnya (model tanpa NORMAL).
function computeNormals(positions, indices, count) {
    const normals = new Float32Array(positions.length);
    for (let i = 0; i + 2 < count; i += 3) {
        const a = (indices ? indices[i] : i) * 3, b = (indices ? indices[i + 1] : i + 1) * 3, c = (indices ? indices[i + 2] : i + 2) * 3;
        const ab = [positions[b] - positions[a], positions[b + 1] - positions[a + 1], positions[b + 2] - positions[a + 2]];
        const ac = [positions[c] - positions[a], positions[c + 1] - positions[a + 1], positions[c + 2] - positions[a + 2]];
        const n = cross(ab, ac);
        [a, b, c].forEach(v => {
            normals[v] += n[0];
            normals[v + 1] += n[1];
            normals[v + 2] += n[2];
        });
    }
    for (let i = 0; i < normals.length; i += 3) {
        const l = Math.hypot(normals[i], normals[i + 1], normals[i + 2]) || 1;
        normals[i] /= l;
        normals[i + 1] /= l;
        normals[i + 2] /= l;
    }
    return normals;
}

function materialOf(material) {
    if (!material) return DEFAULT_MATERIAL;
    const pbr = material.pbrMetallicRoughness || {};
    const extensions = material.extensions || {};
    const strength = extensions.KHR_materials_emissive_strength ? extensions.KHR_materials_emissive_strength.emissiveStrength : 1;
    return {
        color: pbr.baseColorFactor || [1, 1, 1, 1],
        texture: pbr.baseColorTexture ? pbr.baseColorTexture.index : null,
        metallic: pbr.metallicFactor === undefined ? 1 : pbr.metallicFactor,
        roughness: pbr.roughnessFactor === undefined ? 1 : pbr.roughnessFactor,
        emissive: (material.emissiveFactor || [0, 0, 0]).map(value => value * strength),
        alphaMode: material.alphaMode || "OPAQUE",
        alphaCutoff: material.alphaCutoff === undefined ? 0.5 : material.alphaCutoff,
        doubleSided: Boolean(material.doubleSided),
        unlit: Boolean(extensions.KHR_materials_unlit)
    };
}

// ---- GPU

function createContext(canvas, version) {
    const attributes = { antialias: true, alpha: true, premultipliedAlpha: true };
    if (version !== 1) {
        const gl = canvas.getContext("webgl2", attributes);
        if (gl) return { gl, webgl2: true };
    }
    const gl = canvas.getContext("webgl", attributes) || canvas.getContext("experimental-webgl", attributes);
    return gl ? { gl, webgl2: false } : null;
}

// Shader ditulis sekali dalam GLSL ES 1.00 (WebGL1), lalu diubah ke GLSL ES 3.00 untuk WebGL2.
function toES3(source, fragment) {
    let result = "#version 300 es\n" + source
        .replace(/\battribute\b/g, "in")
        .replace(/\bvarying\b/g, fragment ? "in" : "out")
        .replace(/\btexture2D\b/g, "texture");
    if (fragment) result = result.replace(/\bgl_FragColor\b/g, "fragColor").replace("void main", "out vec4 fragColor;\nvoid main");
    return result;
}

function createProgram(gl, webgl2) {
    const compile = (type, source) => {
        const shader = gl.createShader(type);
        gl.shaderSource(shader, webgl2 ? toES3(source, type === gl.FRAGMENT_SHADER) : source);
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader));
        return shader;
    };
    const program = gl.createProgram();
    gl.attachShader(program, compile(gl.VERTEX_SHADER, VERTEX_SHADER));
    gl.attachShader(program, compile(gl.FRAGMENT_SHADER, FRAGMENT_SHADER));
    ATTRIBUTES.forEach((name, location) => gl.bindAttribLocation(program, location, name));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
    const uniforms = {};
    ["uViewProj", "uModel", "uNormal", "uColor", "uTexture", "uUseTexture", "uEmissive", "uEye", "uLight",
        "uMetallic", "uRoughness", "uLit", "uAlphaMode", "uAlphaCutoff", "uHighlight", "uClip", "uClipOn", "uCap"].forEach(name => {
        uniforms[name] = gl.getUniformLocation(program, name);
    });
    return { program, uniforms };
}

function uploadBuffer(gl, target, array) {
    const buffer = gl.createBuffer();
    gl.bindBuffer(target, buffer);
    gl.bufferData(target, array, gl.STATIC_DRAW);
    return buffer;
}

function buildPrimitive(state, primitive, read, materials) {
    const gl = state.gl;
    const attributes = primitive.attributes || {};
    if (attributes.POSITION === undefined) return null;
    const position = read(attributes.POSITION);
    const positions = toFloat(position);
    const mode = primitive.mode === undefined ? 4 : primitive.mode;
    let indices = primitive.indices === undefined ? null : read(primitive.indices).array;
    if (indices instanceof Uint32Array && !state.webgl2 && !state.uintIndices) {
        // WebGL1 tanpa OES_element_index_uint hanya bisa indeks 16-bit.
        if (indices.some(index => index > 65535)) {
            console.warn("Sebagian model dilewati: terlalu besar untuk WebGL1 di browser ini.");
            return null;
        }
        indices = Uint16Array.from(indices);
    }
    const count = indices ? indices.length : position.count;
    const gpu = {};
    const attribute = (name, accessor) => {
        gpu[name] = {
            buffer: uploadBuffer(gl, gl.ARRAY_BUFFER, accessor.array),
            size: accessor.size,
            type: accessor.componentType,
            normalized: accessor.normalized
        };
    };
    attribute("aPosition", position);
    let lit = true;
    if (attributes.NORMAL !== undefined) {
        attribute("aNormal", read(attributes.NORMAL));
    } else if (mode === 4) {
        attribute("aNormal", { array: computeNormals(positions, indices, count), size: 3, componentType: gl.FLOAT, normalized: false });
    } else {
        lit = false; // garis dan titik tanpa normal: warna polos
    }
    if (attributes.TEXCOORD_0 !== undefined) attribute("aUV", read(attributes.TEXCOORD_0));
    if (attributes.COLOR_0 !== undefined) attribute("aColor", read(attributes.COLOR_0));

    const min = [Infinity, Infinity, Infinity];
    const max = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < positions.length; i += 3) {
        for (let k = 0; k < 3; k++) {
            if (positions[i + k] < min[k]) min[k] = positions[i + k];
            if (positions[i + k] > max[k]) max[k] = positions[i + k];
        }
    }
    return {
        mode,
        count,
        lit,
        attributes: gpu,
        indexBuffer: indices ? uploadBuffer(gl, gl.ELEMENT_ARRAY_BUFFER, indices) : null,
        indexType: indices instanceof Uint32Array ? gl.UNSIGNED_INT : indices instanceof Uint8Array ? gl.UNSIGNED_BYTE : gl.UNSIGNED_SHORT,
        positions,
        indices,
        bounds: { min, max },
        material: primitive.material === undefined ? DEFAULT_MATERIAL : materials[primitive.material] || DEFAULT_MATERIAL
    };
}

function isPowerOfTwo(value) {
    return (value & (value - 1)) === 0;
}

async function createTexture(state, image, sampler = {}) {
    const blob = new Blob([image.bytes], { type: image.mimeType });
    let bitmap;
    if (typeof createImageBitmap === "function") {
        bitmap = await createImageBitmap(blob, { premultiplyAlpha: "none", colorSpaceConversion: "none" });
    } else {
        bitmap = await new Promise((resolve, reject) => {
            const element = new Image();
            const url = URL.createObjectURL(blob);
            element.onload = () => {
                URL.revokeObjectURL(url);
                resolve(element);
            };
            element.onerror = () => reject(new Error("gambar tidak bisa dibaca"));
            element.src = url;
        });
    }
    const gl = state.gl;
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, bitmap);
    // WebGL1 tidak bisa mipmap dan repeat untuk gambar yang sisinya bukan pangkat dua.
    const canMipmap = state.webgl2 || (isPowerOfTwo(bitmap.width) && isPowerOfTwo(bitmap.height));
    let minFilter = sampler.minFilter || gl.LINEAR_MIPMAP_LINEAR;
    const mipmapped = minFilter >= gl.NEAREST_MIPMAP_NEAREST && minFilter <= gl.LINEAR_MIPMAP_LINEAR;
    if (mipmapped && !canMipmap) minFilter = gl.LINEAR;
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, minFilter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, sampler.magFilter || gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, canMipmap ? sampler.wrapS || gl.REPEAT : gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, canMipmap ? sampler.wrapT || gl.REPEAT : gl.CLAMP_TO_EDGE);
    if (mipmapped && canMipmap) gl.generateMipmap(gl.TEXTURE_2D);
    if (bitmap.close) bitmap.close();
    return texture;
}

async function buildModel(state, source) {
    const { json } = source;
    const cache = new Map();
    const read = index => {
        if (!cache.has(index)) cache.set(index, readAccessor(source, index));
        return cache.get(index);
    };
    const materials = (json.materials || []).map(materialOf);
    const meshes = (json.meshes || []).map(mesh => (mesh.primitives || []).map(primitive => buildPrimitive(state, primitive, read, materials)).filter(Boolean));
    const textures = await Promise.all((json.textures || []).map(texture => {
        const image = texture.source === undefined ? null : source.images[texture.source];
        if (!image) return null;
        const sampler = json.samplers && texture.sampler !== undefined ? json.samplers[texture.sampler] : undefined;
        return createTexture(state, image, sampler).catch(error => {
            console.warn(`Tekstur model gagal dibaca: ${error.message}`);
            return null;
        });
    }));

    const nodes = (json.nodes || []).map((definition, index) => {
        const trs = definition.matrix ? decompose(definition.matrix) : {
            translation: definition.translation || [0, 0, 0],
            rotation: definition.rotation || [0, 0, 0, 1],
            scale: definition.scale || [1, 1, 1]
        };
        const mesh = definition.mesh === undefined ? null : json.meshes[definition.mesh];
        return {
            index,
            name: definition.name || (mesh && mesh.name) || "node" + index,
            meshName: mesh ? mesh.name || null : null,
            primitives: definition.mesh === undefined ? [] : meshes[definition.mesh] || [],
            childIndices: definition.children || [],
            children: [],
            parent: null,
            translation: [...trs.translation],
            rotation: [...trs.rotation],
            scale: [...trs.scale],
            world: identity(),
            normal: null,
            visible: true,
            color: null
        };
    });
    nodes.forEach(node => {
        node.children = node.childIndices.map(index => nodes[index]).filter(Boolean);
        node.children.forEach(child => { child.parent = node; });
    });
    const scene = json.scenes && json.scenes[json.scene || 0];
    const roots = scene ? (scene.nodes || []).map(index => nodes[index]).filter(Boolean) : nodes.filter(node => !node.parent);
    // Node yang tidak terjangkau dari scene tidak digambar, jadi juga tidak boleh bisa diklik
    // atau ikut dihitung.
    const mark = node => {
        node.inScene = true;
        node.children.forEach(mark);
    };
    roots.forEach(mark);
    const model = { source, nodes, roots, meshes, textures, dirty: true };
    updateWorld(model);
    return model;
}

function disposeModel(state, model) {
    if (!model) return;
    const gl = state.gl;
    model.meshes.forEach(mesh => mesh.forEach(primitive => {
        Object.values(primitive.attributes).forEach(attribute => gl.deleteBuffer(attribute.buffer));
        if (primitive.indexBuffer) gl.deleteBuffer(primitive.indexBuffer);
    }));
    model.textures.forEach(texture => texture && gl.deleteTexture(texture));
}

function updateWorld(model) {
    const visit = (node, parentWorld) => {
        const local = composeTRS(node.translation, node.rotation, node.scale);
        node.world = parentWorld ? multiply(parentWorld, local) : local;
        node.normal = normalMatrix(node.world);
        node.inverse = null; // dihitung saat dibutuhkan (picking)
        node.flipped = determinant3(node.world) < 0;
        node.children.forEach(child => visit(child, node.world));
    };
    model.roots.forEach(root => visit(root, null));
    model.dirty = false;
}

// Kotak pembatas (dunia) dari node-node yang tampil beserta turunannya.
function boundsOf(nodes) {
    const min = [Infinity, Infinity, Infinity];
    const max = [-Infinity, -Infinity, -Infinity];
    const visit = node => {
        if (!node.visible) return;
        node.primitives.forEach(primitive => {
            const { min: a, max: b } = primitive.bounds;
            for (let corner = 0; corner < 8; corner++) {
                const p = transformPoint(node.world, [corner & 1 ? b[0] : a[0], corner & 2 ? b[1] : a[1], corner & 4 ? b[2] : a[2]]);
                for (let k = 0; k < 3; k++) {
                    min[k] = Math.min(min[k], p[k]);
                    max[k] = Math.max(max[k], p[k]);
                }
            }
        });
        node.children.forEach(visit);
    };
    nodes.forEach(visit);
    if (min[0] === Infinity) return null;
    const center = scale(add(min, max), 0.5);
    return { min, max, center, radius: Math.max(length(subtract(max, min)) / 2, 1e-6) };
}

function isShown(node) {
    for (let current = node; current; current = current.parent) {
        if (!current.visible) return false;
    }
    return true;
}

// ---- Kamera

function cameraOf(state) {
    const { target, yaw, pitch, distance } = state.camera;
    const direction = [Math.cos(pitch) * Math.sin(yaw), Math.sin(pitch), Math.cos(pitch) * Math.cos(yaw)];
    const eye = add(target, scale(direction, distance));
    const forward = scale(direction, -1);
    const right = normalize(cross(forward, [0, 1, 0]));
    const up = cross(right, forward);
    const width = state.canvas.clientWidth || 1;
    const height = state.canvas.clientHeight || 1;
    // Bidang dekat/jauh mengikuti jarak ke model, supaya kedalaman tetap teliti di semua skala.
    const sphere = state.sphere || { center: target, radius: distance };
    const toCenter = length(subtract(eye, sphere.center));
    const far = toCenter + sphere.radius * 2;
    const near = Math.max(toCenter - sphere.radius * 2, far / 5000);
    const projection = perspective(state.fov, width / height, near, far);
    const viewProj = multiply(projection, lookAt(eye, target));
    return { eye, target: target.slice(), forward, right, up, viewProj, inverse: invert(viewProj), fov: state.fov, width, height };
}

function toScreen(state, point) {
    const camera = state.cam || cameraOf(state);
    const p = projectPoint(camera.viewProj, point);
    if (p[3] <= 0) return null;
    return [(p[0] + 1) / 2 * camera.width, (1 - p[1]) / 2 * camera.height, p[2]];
}

// Sinar dari kamera melalui titik layar [x, y] (piksel CSS dari pojok kiri atas kanvas).
function rayAt(state, point) {
    const camera = state.cam || cameraOf(state);
    const ndc = [point[0] / camera.width * 2 - 1, 1 - point[1] / camera.height * 2];
    const far = projectPoint(camera.inverse, [ndc[0], ndc[1], 1]);
    return { origin: camera.eye, direction: normalize(subtract(far, camera.eye)) };
}

// Segitiga pertama yang kena sinar origin + t * direction. skip(node) = true untuk melewati
// node itu. Mengembalikan { node, t, position } atau null.
function raycast(state, origin, direction, skip) {
    const model = state.model;
    if (!model) return null;
    if (model.dirty) updateWorld(model);
    let best = null;
    model.nodes.forEach(node => {
        if (!node.inScene || !node.primitives.length || !isShown(node) || (skip && skip(node))) return;
        node.inverse = node.inverse || invert(node.world);
        if (!node.inverse) return;
        const o = transformPoint(node.inverse, origin);
        const d = transformDirection(node.inverse, direction);
        // Bidang potong di ruang lokal node: n.(A p + t) + w = (A^T n).p + (n.t + w).
        let plane = null;
        if (state.clip) {
            const [nx, ny, nz, w] = state.clip.plane;
            const m = node.world;
            plane = [m[0] * nx + m[1] * ny + m[2] * nz, m[4] * nx + m[5] * ny + m[6] * nz, m[8] * nx + m[9] * ny + m[10] * nz,
                m[12] * nx + m[13] * ny + m[14] * nz + w];
        }
        node.primitives.forEach(primitive => {
            if (primitive.mode !== 4 || !hitsBox(o, d, primitive.bounds, best ? best.t : Infinity)) return;
            const t = hitTriangles(o, d, primitive, best ? best.t : Infinity, plane);
            if (t !== null) best = { node, t };
        });
    });
    if (!best) return null;
    best.position = add(origin, scale(direction, best.t));
    return best;
}

function hitsBox(o, d, box, maxT) {
    let near = 0;
    let far = maxT;
    for (let k = 0; k < 3; k++) {
        if (Math.abs(d[k]) < 1e-12) {
            if (o[k] < box.min[k] || o[k] > box.max[k]) return false;
            continue;
        }
        let t1 = (box.min[k] - o[k]) / d[k];
        let t2 = (box.max[k] - o[k]) / d[k];
        if (t1 > t2) [t1, t2] = [t2, t1];
        near = Math.max(near, t1);
        far = Math.min(far, t2);
        if (near > far) return false;
    }
    return true;
}

// Moller-Trumbore. Kedua sisi segitiga dihitung, jadi permukaan dua sisi juga bisa diklik.
function hitTriangles(o, d, primitive, maxT, plane) {
    const p = primitive.positions;
    const indices = primitive.indices;
    let best = null;
    for (let i = 0; i + 2 < primitive.count; i += 3) {
        const a = (indices ? indices[i] : i) * 3, b = (indices ? indices[i + 1] : i + 1) * 3, c = (indices ? indices[i + 2] : i + 2) * 3;
        const e1x = p[b] - p[a], e1y = p[b + 1] - p[a + 1], e1z = p[b + 2] - p[a + 2];
        const e2x = p[c] - p[a], e2y = p[c + 1] - p[a + 1], e2z = p[c + 2] - p[a + 2];
        const px = d[1] * e2z - d[2] * e2y, py = d[2] * e2x - d[0] * e2z, pz = d[0] * e2y - d[1] * e2x;
        const det = e1x * px + e1y * py + e1z * pz;
        if (Math.abs(det) < 1e-12) continue;
        const inv = 1 / det;
        const tx = o[0] - p[a], ty = o[1] - p[a + 1], tz = o[2] - p[a + 2];
        const u = (tx * px + ty * py + tz * pz) * inv;
        if (u < 0 || u > 1) continue;
        const qx = ty * e1z - tz * e1y, qy = tz * e1x - tx * e1z, qz = tx * e1y - ty * e1x;
        const v = (d[0] * qx + d[1] * qy + d[2] * qz) * inv;
        if (v < 0 || u + v > 1) continue;
        const t = (e2x * qx + e2y * qy + e2z * qz) * inv;
        if (t <= 1e-9 || t >= maxT || (best !== null && t >= best)) continue;
        // Titik yang terpotong tidak terlihat, jadi tidak bisa diklik.
        if (plane && plane[0] * (o[0] + d[0] * t) + plane[1] * (o[1] + d[1] * t) + plane[2] * (o[2] + d[2] * t) + plane[3] > 0) continue;
        best = t;
    }
    return best;
}

// ---- Menggambar

function requestRender(state) {
    if (!state.renderFrame && !state.removed) state.renderFrame = requestAnimationFrame(() => render(state));
}

function render(state) {
    state.renderFrame = 0;
    if (state.removed) return;
    const gl = state.gl;
    const canvas = state.canvas;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.max(1, Math.round(canvas.clientWidth * ratio));
    const height = Math.max(1, Math.round(canvas.clientHeight * ratio));
    if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
    }
    gl.viewport(0, 0, width, height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    const model = state.model;
    state.cam = cameraOf(state);
    if (model) {
        if (model.dirty) updateWorld(model);
        const camera = state.cam;
        const { program, uniforms } = state.program;
        gl.useProgram(program);
        gl.uniformMatrix4fv(uniforms.uViewProj, false, camera.viewProj);
        gl.uniform3fv(uniforms.uEye, camera.eye);
        // Lampu dari kiri atas di depan model, ikut berputar dengan kamera.
        gl.uniform3fv(uniforms.uLight, normalize(add(add(scale(camera.up, 0.8), scale(camera.right, -0.45)), scale(camera.forward, -0.6))));
        gl.uniform1i(uniforms.uTexture, 0);
        gl.uniform1f(uniforms.uClipOn, state.clip ? 1 : 0);
        if (state.clip) {
            gl.uniform4fv(uniforms.uClip, state.clip.plane);
            gl.uniform4fv(uniforms.uCap, state.clip.cap || [0, 0, 0, 0]);
        }

        const opaque = [];
        const blended = [];
        const visit = (node, color, highlight) => {
            if (!node.visible) return;
            const ownColor = node.color || color;
            const lit = highlight || state.highlight.has(node);
            node.primitives.forEach(primitive => {
                const item = { node, primitive, color: ownColor, highlight: lit };
                if ((ownColor ? ownColor[3] < 1 : primitive.material.alphaMode === "BLEND")) {
                    item.depth = length(subtract(transformPoint(node.world, scale(add(primitive.bounds.min, primitive.bounds.max), 0.5)), camera.eye));
                    blended.push(item);
                } else {
                    opaque.push(item);
                }
            });
            node.children.forEach(child => visit(child, ownColor, lit));
        };
        model.roots.forEach(root => visit(root, null, false));

        gl.enable(gl.DEPTH_TEST);
        gl.depthMask(true);
        gl.disable(gl.BLEND);
        opaque.forEach(item => drawPrimitive(state, item));
        if (blended.length) {
            // Transparan digambar terakhir, dari yang terjauh, tanpa menulis kedalaman.
            gl.enable(gl.BLEND);
            gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
            gl.depthMask(false);
            blended.sort((a, b) => b.depth - a.depth).forEach(item => drawPrimitive(state, item));
            gl.depthMask(true);
        }
    }
    state.renderHandlers.slice().forEach(runFunction => runFunction());
}

function drawPrimitive(state, item) {
    const gl = state.gl;
    const { uniforms } = state.program;
    const { node, primitive, color } = item;
    const material = primitive.material;
    gl.uniformMatrix4fv(uniforms.uModel, false, node.world);
    gl.uniformMatrix3fv(uniforms.uNormal, false, node.normal);
    gl.uniform4fv(uniforms.uColor, color || material.color);
    // Warna yang diganti setPartColor menggantikan teksturnya juga.
    const texture = !color && material.texture !== null ? state.model.textures[material.texture] : null;
    if (texture) {
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, texture);
    }
    gl.uniform1f(uniforms.uUseTexture, texture ? 1 : 0);
    gl.uniform3fv(uniforms.uEmissive, material.emissive);
    gl.uniform1f(uniforms.uMetallic, material.metallic);
    gl.uniform1f(uniforms.uRoughness, material.roughness);
    gl.uniform1f(uniforms.uLit, primitive.lit && !material.unlit ? 1 : 0);
    const blend = color ? color[3] < 1 : material.alphaMode === "BLEND";
    gl.uniform1f(uniforms.uAlphaMode, blend ? 2 : !color && material.alphaMode === "MASK" ? 1 : 0);
    gl.uniform1f(uniforms.uAlphaCutoff, material.alphaCutoff);
    gl.uniform1f(uniforms.uHighlight, item.highlight ? 1 : 0);
    if (material.doubleSided || blend || state.clip) gl.disable(gl.CULL_FACE);
    else gl.enable(gl.CULL_FACE);
    // Skala negatif membalik urutan titik segitiga.
    gl.frontFace(node.flipped ? gl.CW : gl.CCW);

    ATTRIBUTES.forEach((name, location) => {
        const attribute = primitive.attributes[name];
        if (attribute) {
            gl.bindBuffer(gl.ARRAY_BUFFER, attribute.buffer);
            gl.enableVertexAttribArray(location);
            gl.vertexAttribPointer(location, attribute.size, attribute.type, attribute.normalized, 0, 0);
        } else {
            gl.disableVertexAttribArray(location);
            gl.vertexAttrib4fv(location, ATTRIBUTE_DEFAULTS[name]);
        }
    });
    if (primitive.indexBuffer) {
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, primitive.indexBuffer);
        gl.drawElements(primitive.mode, primitive.count, primitive.indexType, 0);
    } else {
        gl.drawArrays(primitive.mode, 0, primitive.count);
    }
}

// ---- Gerakan kamera

function stopCameraAnimation(state) {
    cancelAnimationFrame(state.cameraFrame);
    state.cameraFrame = 0;
}

function stopAutoRotate(state) {
    cancelAnimationFrame(state.spinFrame);
    state.spinFrame = 0;
    state.autoRotate = 0;
}

// Menggerakkan kamera ke { target, distance, yaw, pitch } (yang diisi saja) dengan halus.
function animateCamera(state, to) {
    stopCameraAnimation(state);
    const from = { target: state.camera.target.slice(), distance: state.camera.distance, yaw: state.camera.yaw, pitch: state.camera.pitch };
    const goal = Object.assign({}, from, to);
    // Putar lewat jalur terpendek.
    goal.yaw = from.yaw + Math.atan2(Math.sin(goal.yaw - from.yaw), Math.cos(goal.yaw - from.yaw));
    const apply = t => {
        const camera = state.camera;
        camera.target = add(from.target, scale(subtract(goal.target, from.target), t));
        camera.distance = from.distance * Math.pow(goal.distance / from.distance, t);
        camera.yaw = from.yaw + (goal.yaw - from.yaw) * t;
        camera.pitch = from.pitch + (goal.pitch - from.pitch) * t;
        requestRender(state);
    };
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        apply(1);
        return;
    }
    const start = performance.now();
    const step = now => {
        const t = clamp((now - start) / CAMERA_DURATION, 0, 1);
        apply(t * (2 - t));
        state.cameraFrame = t < 1 ? requestAnimationFrame(step) : 0;
    };
    state.cameraFrame = requestAnimationFrame(step);
}

// Jarak kamera supaya bola pembatas muat di layar, baik lebar maupun tingginya.
function fitDistance(state, radius) {
    const aspect = (state.canvas.clientWidth || 1) / (state.canvas.clientHeight || 1);
    const fov = Math.min(state.fov, 2 * Math.atan(Math.tan(state.fov / 2) * aspect));
    return radius / Math.sin(fov / 2) * 1.05;
}

function panBy(state, dx, dy) {
    const camera = state.cam || cameraOf(state);
    const perPixel = 2 * state.camera.distance * Math.tan(state.fov / 2) / camera.height;
    state.camera.target = add(state.camera.target, add(scale(camera.right, -dx * perPixel), scale(camera.up, dy * perPixel)));
}

function zoomBy(state, factor) {
    const radius = state.sphere ? state.sphere.radius : 1;
    state.camera.distance = clamp(state.camera.distance * factor, radius * 0.02, radius * 50);
}

function bindGestures(state) {
    const root = state.root;
    const pointers = new Map(); // pointerId -> titik terakhirnya
    let start = null;
    let moved = false;
    let mode = "rotate";

    const pointOf = event => {
        const rect = state.canvas.getBoundingClientRect();
        return [event.clientX - rect.left, event.clientY - rect.top];
    };
    const spread = () => {
        const points = [...pointers.values()];
        return {
            center: [(points[0][0] + points[1][0]) / 2, (points[0][1] + points[1][1]) / 2],
            distance: Math.hypot(points[0][0] - points[1][0], points[0][1] - points[1][1])
        };
    };

    root.addEventListener("pointerdown", event => {
        if (!state.controls) return;
        if (event.pointerType === "mouse" && event.button !== 0 && event.button !== 2) return;
        stopCameraAnimation(state);
        stopAutoRotate(state);
        if (pointers.size === 0) {
            start = pointOf(event);
            moved = false;
            mode = event.button === 2 || event.shiftKey || event.ctrlKey || event.metaKey ? "pan" : "rotate";
        }
        pointers.set(event.pointerId, pointOf(event));
        if (pointers.size > 1) moved = true; // dua jari tidak pernah dihitung klik
    });

    root.addEventListener("pointermove", event => {
        if (!pointers.has(event.pointerId)) return;
        const point = pointOf(event);
        if (!moved) {
            if (Math.hypot(point[0] - start[0], point[1] - start[1]) < DRAG_THRESHOLD) return;
            moved = true;
            try {
                root.setPointerCapture(event.pointerId);
            } catch (captureError) {
                // pointer sudah tidak aktif
            }
            root.classList.add("crootjs-3d-dragging");
        }
        if (pointers.size >= 2) {
            const before = spread();
            pointers.set(event.pointerId, point);
            const after = spread();
            panBy(state, after.center[0] - before.center[0], after.center[1] - before.center[1]);
            if (before.distance > 0 && after.distance > 0) zoomBy(state, before.distance / after.distance);
        } else {
            const last = pointers.get(event.pointerId);
            pointers.set(event.pointerId, point);
            const dx = point[0] - last[0];
            const dy = point[1] - last[1];
            if (mode === "pan") {
                panBy(state, dx, dy);
            } else {
                state.camera.yaw -= dx * ROTATE_SPEED;
                state.camera.pitch = clamp(state.camera.pitch + dy * ROTATE_SPEED, -MAX_PITCH, MAX_PITCH);
            }
        }
        requestRender(state);
    });

    const release = event => {
        if (!pointers.has(event.pointerId)) return;
        pointers.delete(event.pointerId);
        if (pointers.size > 0) return;
        root.classList.remove("crootjs-3d-dragging");
        if (!moved && event.type === "pointerup" && (event.pointerType !== "mouse" || event.button === 0)) {
            handleTap(state, pointOf(event));
        }
    };
    root.addEventListener("pointerup", release);
    root.addEventListener("pointercancel", release);

    // Klik kanan dipakai untuk menggeser pandangan; di kanvas menu browser tidak dimunculkan.
    root.addEventListener("contextmenu", event => {
        if (state.controls && event.target === state.canvas) event.preventDefault();
    });

    root.addEventListener("dblclick", event => {
        if (!state.controls || event.target !== state.canvas) return;
        const ray = rayAt(state, pointOf(event));
        const hit = raycast(state, ray.origin, ray.direction);
        if (hit) animateCamera(state, { target: hit.position, distance: state.camera.distance * 0.6 });
    });

    root.addEventListener("wheel", event => {
        if (!state.controls) return;
        event.preventDefault();
        stopCameraAnimation(state);
        stopAutoRotate(state);
        const lines = event.deltaMode === 1 ? 33 : 1; // Firefox melaporkan baris, bukan piksel
        zoomBy(state, Math.exp(clamp(event.deltaY * lines * (event.ctrlKey ? 0.01 : 0.0015), -1, 1)));
        requestRender(state);
    }, { passive: false });

    root.addEventListener("keydown", event => {
        if (!state.controls || event.target !== root) return;
        const step = toRadians(10);
        if (event.key === "ArrowLeft") state.camera.yaw += step;
        else if (event.key === "ArrowRight") state.camera.yaw -= step;
        else if (event.key === "ArrowUp") state.camera.pitch = clamp(state.camera.pitch + step, -MAX_PITCH, MAX_PITCH);
        else if (event.key === "ArrowDown") state.camera.pitch = clamp(state.camera.pitch - step, -MAX_PITCH, MAX_PITCH);
        else if (event.key === "+" || event.key === "=") zoomBy(state, 0.8);
        else if (event.key === "-") zoomBy(state, 1.25);
        else return;
        event.preventDefault();
        stopAutoRotate(state);
        requestRender(state);
    });
}

function hitInfo(hit) {
    if (!hit) return null;
    const path = [];
    for (let node = hit.node; node; node = node.parent) path.unshift(node.name);
    return { part: hit.node.name, mesh: hit.node.meshName, path, position: hit.position, distance: hit.t };
}

function handleTap(state, point) {
    if (!state.clickHandlers.length) return;
    const ray = rayAt(state, point);
    const info = hitInfo(raycast(state, ray.origin, ray.direction));
    state.clickHandlers.slice().forEach(runFunction => runFunction(info));
}

function startAutoRotate(state, degreesPerSecond) {
    stopAutoRotate(state);
    state.autoRotate = degreesPerSecond;
    if (!degreesPerSecond || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let last = performance.now();
    const step = now => {
        state.camera.yaw += toRadians(state.autoRotate) * (now - last) / 1000;
        last = now;
        render(state);
        state.spinFrame = requestAnimationFrame(step);
    };
    state.spinFrame = requestAnimationFrame(step);
}

// ---- Bagian (node) model

function getViewer(id) {
    const state = viewers.get(id);
    if (!state) console.warn(`Penampil 3D dengan ID "${id}" belum dibuat. Panggil createViewer("${id}") lebih dulu.`);
    return state;
}

// Node bernama name (atau yang mesh-nya bernama name).
function findParts(state, name) {
    if (!state.model) return [];
    return state.model.nodes.filter(node => node.name === name || node.meshName === name);
}

function partsOrWarn(state, name) {
    const parts = findParts(state, name);
    if (!parts.length) console.warn(`Bagian "${name}" tidak ada di model${state.model ? "" : " (model belum dimuat)"}.`);
    return parts;
}

function transformOf(node) {
    return {
        position: node.translation.slice(),
        rotation: quaternionToEuler(node.rotation),
        quaternion: node.rotation.slice(),
        scale: node.scale.slice()
    };
}

// transform: { position, rotation, scale } - yang diisi saja. rotation = [x, y, z] derajat
// (Euler XYZ) atau quaternion [x, y, z, w].
function setTransform(state, node, transform) {
    if (Array.isArray(transform.position)) node.translation = transform.position.slice(0, 3).map(Number);
    if (Array.isArray(transform.rotation)) {
        let q = transform.rotation.length === 4 ? transform.rotation.map(Number) : eulerToQuaternion(transform.rotation.map(Number));
        const l = Math.hypot(...q) || 1;
        q = q.map(value => value / l);
        node.rotation = q;
    }
    if (Array.isArray(transform.scale)) node.scale = transform.scale.slice(0, 3).map(Number);
    else if (Number.isFinite(transform.scale)) node.scale = [transform.scale, transform.scale, transform.scale];
    updateWorld(state.model);
    requestRender(state);
}

function describeModel(state) {
    const model = state.model;
    const bounds = boundsOf(model.roots);
    let triangles = 0;
    model.nodes.forEach(node => {
        if (!node.inScene) return;
        node.primitives.forEach(primitive => {
            if (primitive.mode === 4) triangles += Math.floor(primitive.count / 3);
        });
    });
    return {
        parts: listParts(model).map(part => part.name),
        triangles,
        bounds: bounds ? { min: bounds.min, max: bounds.max, center: bounds.center, size: subtract(bounds.max, bounds.min) } : null
    };
}

function listParts(model) {
    const list = [];
    const visit = (node, depth) => {
        list.push({ name: node.name, mesh: node.meshName, parent: node.parent ? node.parent.name : null, depth, visible: node.visible });
        node.children.forEach(child => visit(child, depth + 1));
    };
    model.roots.forEach(root => visit(root, 0));
    return list;
}

// ---- API

// Membuat penampil 3D di dalam elemen id (biasanya <div> yang sudah diberi tinggi lewat CSS).
// options (semua opsional):
//   background  warna atau gradasi CSS latar. Default abu-abu terang bergradasi.
//               "transparent" = latar halaman terlihat.
//   autoRotate  derajat per detik model berputar sendiri; berhenti begitu pengguna menyentuhnya.
//   fov         sudut pandang vertikal kamera, derajat. Default 45.
//   controls    false = tanpa orbit/zoom/geser dari pengguna. Default true.
//   webgl       1 = paksa WebGL1 (untuk menguji cadangan). Default WebGL2, cadangan WebGL1.
export function createViewer(id, options = {}) {
    const container = document.getElementById(id);
    if (!container) {
        console.warn(`Elemen dengan ID "${id}" tidak ditemukan.`);
        return;
    }
    if (viewers.has(id)) removeViewer(id);
    injectStyles();

    const root = document.createElement("div");
    root.className = "crootjs-3d";
    root.tabIndex = 0;
    root.setAttribute("role", "application");
    root.setAttribute("aria-label", "Penampil model 3D. Geser untuk memutar, roda mouse atau pinch untuk zoom, panah untuk memutar.");
    if (options.background) root.style.background = options.background;
    const canvas = document.createElement("canvas");
    canvas.className = "crootjs-3d-canvas";
    const overlay = document.createElement("div");
    overlay.className = "crootjs-3d-overlay";
    root.append(canvas, overlay);

    const restorePosition = getComputedStyle(container).position === "static";
    if (restorePosition) container.style.position = "relative";
    container.appendChild(root);
    if (container.clientHeight === 0 && container.getClientRects().length > 0) {
        console.warn(`Elemen "${id}" tingginya 0, jadi model 3D-nya tidak akan terlihat. Beri tinggi lewat CSS, misalnya height: 400px.`);
    }

    const context = createContext(canvas, options.webgl);
    if (!context) {
        const message = document.createElement("div");
        message.className = "crootjs-3d-message";
        message.textContent = "Browser ini tidak mendukung WebGL, jadi model 3D tidak bisa ditampilkan.";
        root.appendChild(message);
        console.warn("WebGL tidak tersedia di browser ini.");
        container.crootjs3d = null;
        viewers.set(id, { root, container, restorePosition, removed: true, failed: true });
        return;
    }

    const state = {
        id,
        container,
        root,
        canvas,
        overlay,
        gl: context.gl,
        webgl2: context.webgl2,
        uintIndices: context.webgl2 || Boolean(context.gl.getExtension("OES_element_index_uint")),
        program: null,
        model: null,
        sphere: null,
        camera: { target: [0, 0, 0], yaw: toRadians(30), pitch: toRadians(20), distance: 5 },
        fov: toRadians(Number.isFinite(options.fov) ? options.fov : 45),
        controls: options.controls !== false,
        highlight: new Set(),
        clip: null,
        renderHandlers: [],
        clickHandlers: [],
        renderFrame: 0,
        cameraFrame: 0,
        spinFrame: 0,
        autoRotate: 0,
        loadToken: 0,
        restorePosition,
        removed: false
    };
    state.program = createProgram(state.gl, state.webgl2);

    // Konteks WebGL bisa hilang (GPU di-reset, tab lama di latar belakang): model dibangun
    // ulang dari data yang masih tersimpan begitu konteksnya kembali.
    canvas.addEventListener("webglcontextlost", event => event.preventDefault());
    canvas.addEventListener("webglcontextrestored", () => {
        state.program = createProgram(state.gl, state.webgl2);
        const old = state.model;
        if (!old) return requestRender(state);
        buildModel(state, old.source).then(model => {
            old.nodes.forEach((node, index) => {
                Object.assign(model.nodes[index], { translation: node.translation, rotation: node.rotation, scale: node.scale, visible: node.visible, color: node.color });
            });
            state.highlight = new Set([...state.highlight].map(node => model.nodes[node.index]));
            model.dirty = true;
            state.model = model;
            requestRender(state);
        });
    });

    bindGestures(state);
    state.resizeObserver = new ResizeObserver(() => requestRender(state));
    state.resizeObserver.observe(canvas);
    if (options.autoRotate) startAutoRotate(state, Number(options.autoRotate));

    // Antarmuka untuk model3dtools.js atau modul tambahan buatanmu sendiri. Dititipkan di
    // elemennya, bukan diekspor, supaya modul tambahan tidak perlu mengimpor model3d.js (yang
    // akan memuat salinan kedua dengan daftar penampil yang terpisah).
    container.crootjs3d = {
        root,
        canvas,
        overlay,
        requestRender: () => requestRender(state),
        onRender: runFunction => {
            state.renderHandlers.push(runFunction);
            return function stop() {
                const index = state.renderHandlers.indexOf(runFunction);
                if (index !== -1) state.renderHandlers.splice(index, 1);
            };
        },
        onModel: runFunction => {
            state.modelHandlers = state.modelHandlers || [];
            state.modelHandlers.push(runFunction);
            return function stop() {
                const index = state.modelHandlers.indexOf(runFunction);
                if (index !== -1) state.modelHandlers.splice(index, 1);
            };
        },
        camera: () => state.cam || cameraOf(state),
        toScreen: point => toScreen(state, point),
        rayAt: point => rayAt(state, point),
        raycast: (origin, direction, skip) => raycast(state, origin, direction, skip),
        findParts: name => findParts(state, name),
        isShown,
        boundsOf: nodes => {
            if (state.model && state.model.dirty) updateWorld(state.model);
            return boundsOf(nodes);
        },
        getTransform: node => transformOf(node),
        setTransform: (node, transform) => setTransform(state, node, transform),
        getModel: () => state.model,
        setControls: enabled => { state.controls = enabled !== false; },
        // Bidang potong dunia [nx, ny, nz, w]: titik p dibuang kalau n.p + w > 0. cap = warna
        // linear [r, g, b, 1] permukaan potongnya, atau null = warna bagian itu digelapkan.
        setClip: (plane, cap) => {
            state.clip = plane ? { plane: Float32Array.from(plane), cap: cap ? Float32Array.from(cap) : null } : null;
            requestRender(state);
        },
        // Accessor glTF ke-index sebagai { array, size, componentType, normalized, count }.
        readAccessor: index => readAccessor(state.model.source, index),
        // Setelah translation/rotation/scale node diubah langsung (animasi): hitung ulang.
        update: () => {
            if (!state.model) return;
            state.model.dirty = true;
            requestRender(state);
        },
        parseColor,
        math: { add, subtract, scale, dot, cross, length, normalize, transformPoint, transformDirection, invert, multiply }
    };

    viewers.set(id, state);
    requestRender(state);
}

// Memuat model glTF 2.0 dan menggantikan model sebelumnya. source: URL file .glb/.gltf,
// File/Blob (misalnya dari <input type="file">), atau ArrayBuffer.
// responseFunction(info, error) dipanggil setelah model tampil:
//   info = { parts: [nama bagian], triangles, bounds: { min, max, center, size } }, atau
//   null kalau gagal - error berisi alasannya (juga dicetak di console).
// Juga mengembalikan Promise berisi info yang sama, jadi bisa di-await.
export async function loadModel(id, source, responseFunction) {
    const respond = (info, error) => {
        if (typeof responseFunction === "function") responseFunction(info, error);
        return info;
    };
    const state = getViewer(id);
    if (!state || state.failed) return respond(null, "penampil 3D belum dibuat atau WebGL tidak tersedia");
    const token = ++state.loadToken;
    state.root.classList.add("crootjs-3d-loading");
    const name = typeof source === "string" ? source : source && source.name ? source.name : "model";
    try {
        let data;
        let base = location.href;
        if (typeof source === "string") {
            base = new URL(source, location.href).href;
            const response = await fetch(base);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            data = await response.arrayBuffer();
        } else if (source instanceof ArrayBuffer) {
            data = source;
        } else if (source && typeof source.arrayBuffer === "function") {
            data = await source.arrayBuffer();
        } else {
            throw new Error("source harus URL, File/Blob, atau ArrayBuffer");
        }
        const parsed = await parseModel(data, base);
        if (token !== state.loadToken || state.removed) return null;
        const model = await buildModel(state, parsed);
        if (token !== state.loadToken || state.removed) {
            disposeModel(state, model);
            return null;
        }
        disposeModel(state, state.model);
        state.model = model;
        state.highlight.clear();
        state.sphere = boundsOf(model.roots);
        if (state.sphere) {
            state.camera.target = state.sphere.center.slice();
            state.camera.distance = fitDistance(state, state.sphere.radius);
        }
        state.cam = null;
        requestRender(state);
        (state.modelHandlers || []).slice().forEach(runFunction => runFunction(model));
        return respond(describeModel(state));
    } catch (error) {
        if (token !== state.loadToken) return null;
        console.warn(`Model 3D "${name}" gagal dimuat: ${error.message}`);
        return respond(null, error.message);
    } finally {
        if (token === state.loadToken && !state.removed) state.root.classList.remove("crootjs-3d-loading");
    }
}

// Menghapus model dari penampil. Penampilnya tetap, siap memuat model lain.
export function clearModel(id) {
    const state = getViewer(id);
    if (!state || state.failed) return;
    state.loadToken++;
    disposeModel(state, state.model);
    state.model = null;
    state.sphere = null;
    state.highlight.clear();
    (state.modelHandlers || []).slice().forEach(runFunction => runFunction(null));
    requestRender(state);
}

// Menghapus penampil dari elemennya, beserta konteks WebGL-nya.
export function removeViewer(id) {
    const state = viewers.get(id);
    if (!state) return;
    viewers.delete(id);
    if (!state.failed) {
        state.removed = true;
        cancelAnimationFrame(state.renderFrame);
        stopCameraAnimation(state);
        stopAutoRotate(state);
        state.resizeObserver.disconnect();
        disposeModel(state, state.model);
        const lose = state.gl.getExtension("WEBGL_lose_context");
        if (lose) lose.loseContext();
    }
    state.root.remove();
    if (state.restorePosition) state.container.style.position = "";
    delete state.container.crootjs3d;
}

// Daftar semua bagian (node) model, urut seperti pohonnya:
// [{ name, mesh, parent, depth, visible }]. depth = kedalaman di pohon (0 = paling atas).
export function getParts(id) {
    const state = getViewer(id);
    return state && state.model ? listParts(state.model) : [];
}

// Mengganti warna sebuah bagian beserta bagian di bawahnya. color: warna CSS ("#ff0000",
// "red", "rgba(255, 0, 0, 0.5)") atau [r, g, b, a] 0..1; null = kembali ke warna aslinya.
// Warna dengan alpha < 1 membuatnya transparan. Mengembalikan false kalau bagiannya tidak ada.
export function setPartColor(id, name, color) {
    const state = getViewer(id);
    if (!state || state.failed) return false;
    const parts = partsOrWarn(state, name);
    const value = color === null || color === undefined ? null : parseColor(color);
    parts.forEach(node => { node.color = value; });
    requestRender(state);
    return parts.length > 0;
}

// Menampilkan atau menyembunyikan sebuah bagian beserta bagian di bawahnya.
export function setPartVisible(id, name, visible) {
    const state = getViewer(id);
    if (!state || state.failed) return false;
    const parts = partsOrWarn(state, name);
    parts.forEach(node => { node.visible = visible !== false; });
    requestRender(state);
    return parts.length > 0;
}

// Menandai bagian yang sedang dipilih dengan warna biru. null = hapus tanda.
export function highlightPart(id, name) {
    const state = getViewer(id);
    if (!state || state.failed) return false;
    state.highlight = new Set(name === null || name === undefined ? [] : partsOrWarn(state, name));
    requestRender(state);
    return state.highlight.size > 0;
}

// Posisi, rotasi, dan skala sebuah bagian relatif terhadap induknya:
// { position: [x, y, z], rotation: [x, y, z] derajat (Euler XYZ), quaternion, scale }.
export function getPartTransform(id, name) {
    const state = getViewer(id);
    if (!state || state.failed) return null;
    const node = partsOrWarn(state, name)[0];
    return node ? transformOf(node) : null;
}

// Mengubah posisi, rotasi, dan/atau skala sebuah bagian (yang diisi saja). rotation =
// [x, y, z] derajat (Euler XYZ) atau quaternion [x, y, z, w]; scale = angka atau [x, y, z].
export function setPartTransform(id, name, transform = {}) {
    const state = getViewer(id);
    if (!state || state.failed) return false;
    const parts = partsOrWarn(state, name);
    parts.forEach(node => setTransform(state, node, transform));
    return parts.length > 0;
}

// runFunction(hit) setiap kali model diklik atau di-tap (bukan digeser). hit = { part, mesh,
// path, position, distance }: part = nama bagian yang kena, path = nama-nama dari bagian
// teratas sampai bagian itu, position = titik yang kena [x, y, z]. null kalau yang diklik
// latarnya. Mengembalikan function stop().
export function onModelClick(id, runFunction) {
    const state = getViewer(id);
    if (!state || state.failed) return () => {};
    state.clickHandlers.push(runFunction);
    return function stop() {
        const index = state.clickHandlers.indexOf(runFunction);
        if (index !== -1) state.clickHandlers.splice(index, 1);
    };
}

// Menggerakkan kamera supaya seluruh model - atau bagian name saja - pas di layar.
// name boleh juga array nama: semua bagian itu dibuat muat sekaligus.
export function fitView(id, name) {
    const state = getViewer(id);
    if (!state || state.failed || !state.model) return;
    if (state.model.dirty) updateWorld(state.model);
    const names = Array.isArray(name) ? name : [name];
    const nodes = name === undefined || name === null ? state.model.roots : names.flatMap(value => partsOrWarn(state, value));
    const bounds = boundsOf(nodes);
    if (!bounds) return;
    animateCamera(state, { target: bounds.center, distance: fitDistance(state, bounds.radius) });
}

// Mengatur kamera: { yaw, pitch, distance, target } - yang diisi saja. yaw = sudut keliling
// (derajat, 0 = dari depan/+Z), pitch = sudut dari atas (derajat, -89..89), distance = jarak
// ke target, target = [x, y, z] titik yang dilihat. animate: false = langsung pindah.
export function setCameraView(id, view = {}, animate = true) {
    const state = getViewer(id);
    if (!state || state.failed) return;
    const to = {};
    if (Number.isFinite(view.yaw)) to.yaw = toRadians(view.yaw);
    if (Number.isFinite(view.pitch)) to.pitch = clamp(toRadians(view.pitch), -MAX_PITCH, MAX_PITCH);
    if (Number.isFinite(view.distance) && view.distance > 0) to.distance = view.distance;
    if (Array.isArray(view.target)) to.target = view.target.slice(0, 3).map(Number);
    stopAutoRotate(state);
    if (animate) {
        animateCamera(state, to);
    } else {
        stopCameraAnimation(state);
        Object.assign(state.camera, to);
        requestRender(state);
    }
}

// Kamera sekarang: { yaw, pitch, distance, target } (sudut dalam derajat).
export function getCameraView(id) {
    const state = getViewer(id);
    if (!state || state.failed) return null;
    const camera = state.camera;
    return { yaw: toDegrees(camera.yaw), pitch: toDegrees(camera.pitch), distance: camera.distance, target: camera.target.slice() };
}

// Memutar model terus-menerus (derajat per detik), 0 = berhenti.
export function setAutoRotate(id, degreesPerSecond) {
    const state = getViewer(id);
    if (!state || state.failed) return;
    startAutoRotate(state, Number(degreesPerSecond) || 0);
}
