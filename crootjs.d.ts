// Deklarasi tipe CrootJS untuk import dari jsDelivr. Dibangkitkan oleh tools/build-types.py dari
// kode sumber - jangan diubah manual. Salin ke folder proyek (di samping jsconfig.json),
// lalu VS Code memberi autocomplete untuk:
//   import { createMap } from "https://cdn.jsdelivr.net/gh/crootjs/lib@<versi>/map.min.js";

declare module "https://cdn.jsdelivr.net/gh/crootjs/lib@*/api.js" {
    /**
     * Keempatnya mengembalikan Promise berisi { status, data }, selain memanggil responseFunction.
     * responseFunction boleh null untuk gaya await:
     * const { status, data } = await getJSON(url);
     * const result = await postJSON(url, body, null, "login", token);
     */
    export function getJSON(target_url: string, responseFunction?: (...args: any[]) => any, tokenkey?: any, tokenvalue?: any): Promise<{ status: number; data: any }>;
    export function postJSON(target_url: string, datajson: any, responseFunction?: (...args: any[]) => any, tokenkey?: any, tokenvalue?: any): Promise<{ status: number; data: any }>;
    export function deleteJSON(target_url: string, datajson: any, responseFunction?: (...args: any[]) => any, tokenkey?: any, tokenvalue?: any): Promise<{ status: number; data: any }>;
    export function putJSON(target_url: string, datajson: any, responseFunction?: (...args: any[]) => any, tokenkey?: any, tokenvalue?: any): Promise<{ status: number; data: any }>;
    /**
     * errorFunction (opsional) dipanggil dengan sebuah Error kalau elemen tidak ada,
     * server membalas status non-2xx, jaringan gagal, atau request timeout.
     */
    export function insertHTML(target_url: string, id: string, runFunction?: (...args: any[]) => any, errorFunction?: (...args: any[]) => any): any;
    export function getDomHTML(target_url: string, domFunction?: (...args: any[]) => any): any;
    export function postFile(target_url: string, id: string, formdataname: any, responseFunction?: (...args: any[]) => any): any;
    /**
     * make sure formdataname use in the backend to get data file
     */
    export function postFileWithHeader(target_url: string, tokenkey: any, tokenvalue: any, id: string, formdataname: any, responseFunction?: (...args: any[]) => any): any;
    /**
     * function responseFunction(response) {
     * console.log('HTTP Status:', response.status);
     * console.log('Response Data:', response.data);
     * }
     */
    export function postFileJSON(target_url: string, tokenkey: any, tokenvalue: any, id: string, formdataname: any, responseFunction?: (...args: any[]) => any): any;
    /**
     * get file and download it into your browser, if not 200 then return json
     */
    export function getFileWithHeader(target_url: string, tokenkey: any, tokenvalue: any, responseFunction?: (...args: any[]) => any, fileName?: string): any;
    /**
     * get file bytes if 200, othen than return json
     */
    export function getFileBytesWithHeader(target_url: string, tokenkey: any, tokenvalue: any, responseFunction?: (...args: any[]) => any): any;
}

declare module "https://cdn.jsdelivr.net/gh/crootjs/lib@*/api.min.js" {
    /**
     * Keempatnya mengembalikan Promise berisi { status, data }, selain memanggil responseFunction.
     * responseFunction boleh null untuk gaya await:
     * const { status, data } = await getJSON(url);
     * const result = await postJSON(url, body, null, "login", token);
     */
    export function getJSON(target_url: string, responseFunction?: (...args: any[]) => any, tokenkey?: any, tokenvalue?: any): Promise<{ status: number; data: any }>;
    export function postJSON(target_url: string, datajson: any, responseFunction?: (...args: any[]) => any, tokenkey?: any, tokenvalue?: any): Promise<{ status: number; data: any }>;
    export function deleteJSON(target_url: string, datajson: any, responseFunction?: (...args: any[]) => any, tokenkey?: any, tokenvalue?: any): Promise<{ status: number; data: any }>;
    export function putJSON(target_url: string, datajson: any, responseFunction?: (...args: any[]) => any, tokenkey?: any, tokenvalue?: any): Promise<{ status: number; data: any }>;
    /**
     * errorFunction (opsional) dipanggil dengan sebuah Error kalau elemen tidak ada,
     * server membalas status non-2xx, jaringan gagal, atau request timeout.
     */
    export function insertHTML(target_url: string, id: string, runFunction?: (...args: any[]) => any, errorFunction?: (...args: any[]) => any): any;
    export function getDomHTML(target_url: string, domFunction?: (...args: any[]) => any): any;
    export function postFile(target_url: string, id: string, formdataname: any, responseFunction?: (...args: any[]) => any): any;
    /**
     * make sure formdataname use in the backend to get data file
     */
    export function postFileWithHeader(target_url: string, tokenkey: any, tokenvalue: any, id: string, formdataname: any, responseFunction?: (...args: any[]) => any): any;
    /**
     * function responseFunction(response) {
     * console.log('HTTP Status:', response.status);
     * console.log('Response Data:', response.data);
     * }
     */
    export function postFileJSON(target_url: string, tokenkey: any, tokenvalue: any, id: string, formdataname: any, responseFunction?: (...args: any[]) => any): any;
    /**
     * get file and download it into your browser, if not 200 then return json
     */
    export function getFileWithHeader(target_url: string, tokenkey: any, tokenvalue: any, responseFunction?: (...args: any[]) => any, fileName?: string): any;
    /**
     * get file bytes if 200, othen than return json
     */
    export function getFileBytesWithHeader(target_url: string, tokenkey: any, tokenvalue: any, responseFunction?: (...args: any[]) => any): any;
}

declare module "https://cdn.jsdelivr.net/gh/crootjs/lib@*/auth.js" {
    export function qrController(wauthparam: any): Promise<any>;
    export function deleteCookie(cname: any): any;
    export function getParamsfromURL(): any;
    /**
     * Google Sign In
     * Buat fungsi untuk memanggil gsi js dan menambahkan elemen div ke dalam DOM
     */
    export function appendGoogleSignin(client_id: any, target_url: string): Promise<any>;
    export const IsMobile: any;
}

declare module "https://cdn.jsdelivr.net/gh/crootjs/lib@*/auth.min.js" {
    export function qrController(wauthparam: any): Promise<any>;
    export function deleteCookie(cname: any): any;
    export function getParamsfromURL(): any;
    /**
     * Google Sign In
     * Buat fungsi untuk memanggil gsi js dan menambahkan elemen div ke dalam DOM
     */
    export function appendGoogleSignin(client_id: any, target_url: string): Promise<any>;
    export const IsMobile: any;
}

declare module "https://cdn.jsdelivr.net/gh/crootjs/lib@*/config.js" {
    export const DefaultFailer: any;
    export const DefaultSuccesser: any;
    export const wauthparam: any;
    export const autoinjector: any;
    export const SwalChecker: any;
}

declare module "https://cdn.jsdelivr.net/gh/crootjs/lib@*/config.min.js" {
    export const DefaultFailer: any;
    export const DefaultSuccesser: any;
    export const wauthparam: any;
    export const autoinjector: any;
    export const SwalChecker: any;
}

declare module "https://cdn.jsdelivr.net/gh/crootjs/lib@*/cookie.js" {
    /**
     * Fungsi untuk menyimpan cookie dengan hari kadaluwarsa
     */
    export function setCookieWithExpireDay(cname: any, cvalue: any, exdays: any): any;
    /**
     * Fungsi untuk menyimpan cookie dengan jam kadaluwarsa
     */
    export function setCookieWithExpireHour(cname: any, cvalue: any, exhour: any): any;
    /**
     * Fungsi untuk menyimpan cookie dengan detik kadaluwarsa
     */
    export function setCookieWithExpireSecond(cname: any, cvalue: any, exsecs: any): any;
    /**
     * Fungsi untuk menghapus cookie dengan cara mengatur waktu kadaluwarsa ke masa lalu
     */
    export function deleteCookie(cname: any): any;
    /**
     * Fungsi untuk mendapatkan nilai cookie berdasarkan nama
     */
    export function getCookie(cname: any): any;
}

declare module "https://cdn.jsdelivr.net/gh/crootjs/lib@*/cookie.min.js" {
    /**
     * Fungsi untuk menyimpan cookie dengan hari kadaluwarsa
     */
    export function setCookieWithExpireDay(cname: any, cvalue: any, exdays: any): any;
    /**
     * Fungsi untuk menyimpan cookie dengan jam kadaluwarsa
     */
    export function setCookieWithExpireHour(cname: any, cvalue: any, exhour: any): any;
    /**
     * Fungsi untuk menyimpan cookie dengan detik kadaluwarsa
     */
    export function setCookieWithExpireSecond(cname: any, cvalue: any, exsecs: any): any;
    /**
     * Fungsi untuk menghapus cookie dengan cara mengatur waktu kadaluwarsa ke masa lalu
     */
    export function deleteCookie(cname: any): any;
    /**
     * Fungsi untuk mendapatkan nilai cookie berdasarkan nama
     */
    export function getCookie(cname: any): any;
}

declare module "https://cdn.jsdelivr.net/gh/crootjs/lib@*/debounce.js" {
    /**
     * Menunda eksekusi fn sampai user berhenti memicu selama delay ms.
     * Cocok untuk search-as-you-type: hanya kirim request setelah user selesai mengetik.
     */
    export function debounce(fn: (...args: any[]) => any, delay: any): any;
    /**
     * Membatasi eksekusi fn maksimal sekali setiap delay ms, dengan panggilan terakhir
     * tetap dieksekusi setelah delay (trailing call). Cocok untuk scroll/resize/mousemove handler.
     */
    export function throttle(fn: (...args: any[]) => any, delay: any): any;
}

declare module "https://cdn.jsdelivr.net/gh/crootjs/lib@*/debounce.min.js" {
    /**
     * Menunda eksekusi fn sampai user berhenti memicu selama delay ms.
     * Cocok untuk search-as-you-type: hanya kirim request setelah user selesai mengetik.
     */
    export function debounce(fn: (...args: any[]) => any, delay: any): any;
    /**
     * Membatasi eksekusi fn maksimal sekali setiap delay ms, dengan panggilan terakhir
     * tetap dieksekusi setelah delay (trailing call). Cocok untuk scroll/resize/mousemove handler.
     */
    export function throttle(fn: (...args: any[]) => any, delay: any): any;
}

declare module "https://cdn.jsdelivr.net/gh/crootjs/lib@*/element.js" {
    export function container(id: string): any;
    export function onClick(id: string, actionFunctionName: any): any;
    export function onClicks(className: string, actionFunctionName: any): any;
    export function onChange(id: string, actionfunctionname: any): any;
    export function onChanges(className: string, actionFunctionName: any): any;
    export function onInput(id: string, actionfunctionname: any): any;
    export function onInputs(className: string, actionFunctionName: any): any;
    export function runAfterDOM(runFunctionEvent: any): any;
    export function runAfterAll(runFunctionEvent: any): any;
    export function textFocus(id: string): any;
    export function textBlur(id: string): any;
    export function getValue(id: string): any;
    export function getAttributeValue(id: string, attribute: any): any;
    export function getValueRadio(name: string): any;
    export function getValueSelect(id: string): any;
    export function getTextSelect(id: string): any;
    export function serializeForm(id: string): any;
    export function getFileSize(id: string): any;
    export function setValue(id: string, valuecontent: any): any;
    export function setInner(id: string, content: any): any;
    export function setInnerText(id: string, content: any): any;
    export function addInner(id: string, content: any): any;
    export function addChild(id: string, tag: any, classvalue: any, content: any): any;
    export function setClassValue(el: any, classvalue: any): any;
    export function addClassValue(id: string, classValue: any): any;
    export function show(id: string): any;
    export function hide(id: string): any;
    export function disableInput(id: string): any;
    export function enableInput(id: string): any;
    /**
     * errorCallback (opsional) dipanggil dengan sebuah Error kalau elemen tidak ada,
     * server membalas status non-2xx, jaringan gagal, atau request timeout.
     */
    export function renderHTML(id: string, urlHTML: any, callback?: (...args: any[]) => any, errorCallback?: any): any;
    export function replaceTag(id: string, urlHTML: any, callback?: (...args: any[]) => any): any;
    export function addJSInHead(src: any): any;
    export function addCSSInHead(href: any): any;
    export function isCSSLoaded(href: any): any;
    export function isJSLoaded(src: any): any;
    export function addJS(src: any): Promise<any>;
    export function addCSS(href: any): Promise<any>;
}

declare module "https://cdn.jsdelivr.net/gh/crootjs/lib@*/element.min.js" {
    export function container(id: string): any;
    export function onClick(id: string, actionFunctionName: any): any;
    export function onClicks(className: string, actionFunctionName: any): any;
    export function onChange(id: string, actionfunctionname: any): any;
    export function onChanges(className: string, actionFunctionName: any): any;
    export function onInput(id: string, actionfunctionname: any): any;
    export function onInputs(className: string, actionFunctionName: any): any;
    export function runAfterDOM(runFunctionEvent: any): any;
    export function runAfterAll(runFunctionEvent: any): any;
    export function textFocus(id: string): any;
    export function textBlur(id: string): any;
    export function getValue(id: string): any;
    export function getAttributeValue(id: string, attribute: any): any;
    export function getValueRadio(name: string): any;
    export function getValueSelect(id: string): any;
    export function getTextSelect(id: string): any;
    export function serializeForm(id: string): any;
    export function getFileSize(id: string): any;
    export function setValue(id: string, valuecontent: any): any;
    export function setInner(id: string, content: any): any;
    export function setInnerText(id: string, content: any): any;
    export function addInner(id: string, content: any): any;
    export function addChild(id: string, tag: any, classvalue: any, content: any): any;
    export function setClassValue(el: any, classvalue: any): any;
    export function addClassValue(id: string, classValue: any): any;
    export function show(id: string): any;
    export function hide(id: string): any;
    export function disableInput(id: string): any;
    export function enableInput(id: string): any;
    /**
     * errorCallback (opsional) dipanggil dengan sebuah Error kalau elemen tidak ada,
     * server membalas status non-2xx, jaringan gagal, atau request timeout.
     */
    export function renderHTML(id: string, urlHTML: any, callback?: (...args: any[]) => any, errorCallback?: any): any;
    export function replaceTag(id: string, urlHTML: any, callback?: (...args: any[]) => any): any;
    export function addJSInHead(src: any): any;
    export function addCSSInHead(href: any): any;
    export function isCSSLoaded(href: any): any;
    export function isJSLoaded(src: any): any;
    export function addJS(src: any): Promise<any>;
    export function addCSS(href: any): Promise<any>;
}

declare module "https://cdn.jsdelivr.net/gh/crootjs/lib@*/geo.js" {
    /**
     * Menerima teks JSON atau object hasil JSON.parse, mengembalikan FeatureCollection -
     * apa pun bentuk masukannya: FeatureCollection, satu Feature, satu geometri polos, atau
     * array berisi Feature/geometri (bentuk yang biasa dibalas backend dari query MongoDB).
     * Mengembalikan null kalau masukannya bukan GeoJSON. Item yang tidak valid di dalam
     * sebuah koleksi dilewati (dilaporkan di console), tidak menggagalkan seluruh data.
     */
    export function parseGeoJSON(input: any): any;
    /**
     * Mengambil GeoJSON dari URL. responseFunction selalu dipanggil dengan { status, data }:
     * data berisi FeatureCollection, atau null kalau isi balasannya bukan GeoJSON;
     * { status: 0, data: null } kalau jaringan gagal, CORS ditolak, atau request timeout.
     */
    export function getGeoJSON(target_url: string, responseFunction?: (...args: any[]) => any, tokenkey?: any, tokenvalue?: any): any;
    /**
     * Membaca file GeoJSON yang dipilih user di <input type="file" id="...">.
     * responseFunction dipanggil dengan FeatureCollection, atau null kalau belum ada file
     * yang dipilih, file gagal dibaca, atau isinya bukan GeoJSON.
     */
    export function readGeoJSONFile(id: string, responseFunction?: (...args: any[]) => any): any;
    /**
     * Semua posisi [lng, lat] di dalam data, diratakan jadi satu array.
     */
    export function getCoordinates(geojson: any): any;
    /**
     * Kotak pembatas data: [minLng, minLat, maxLng, maxLat] (urutan bbox RFC 7946).
     * null kalau datanya tidak punya koordinat sama sekali.
     */
    export function getBBox(geojson: any): any;
    /**
     * Titik tengah kotak pembatas sebagai [lng, lat] - untuk memusatkan peta, bukan centroid geometri.
     * null kalau datanya tidak punya koordinat.
     */
    export function getCenter(geojson: any): any;
    /**
     * Nama-nama properti yang dipakai fitur di dalam data, tanpa duplikat, urut sesuai
     * kemunculan pertama. Berguna untuk membuat header tabel.
     */
    export function getPropertyKeys(geojson: any): any;
    /**
     * GeoJSON menyimpan posisi sebagai [longitude, latitude]; Leaflet dan Google Maps
     * memintanya terbalik: [latitude, longitude].
     */
    export function toLatLng(position: number[]): any;
}

declare module "https://cdn.jsdelivr.net/gh/crootjs/lib@*/geo.min.js" {
    /**
     * Menerima teks JSON atau object hasil JSON.parse, mengembalikan FeatureCollection -
     * apa pun bentuk masukannya: FeatureCollection, satu Feature, satu geometri polos, atau
     * array berisi Feature/geometri (bentuk yang biasa dibalas backend dari query MongoDB).
     * Mengembalikan null kalau masukannya bukan GeoJSON. Item yang tidak valid di dalam
     * sebuah koleksi dilewati (dilaporkan di console), tidak menggagalkan seluruh data.
     */
    export function parseGeoJSON(input: any): any;
    /**
     * Mengambil GeoJSON dari URL. responseFunction selalu dipanggil dengan { status, data }:
     * data berisi FeatureCollection, atau null kalau isi balasannya bukan GeoJSON;
     * { status: 0, data: null } kalau jaringan gagal, CORS ditolak, atau request timeout.
     */
    export function getGeoJSON(target_url: string, responseFunction?: (...args: any[]) => any, tokenkey?: any, tokenvalue?: any): any;
    /**
     * Membaca file GeoJSON yang dipilih user di <input type="file" id="...">.
     * responseFunction dipanggil dengan FeatureCollection, atau null kalau belum ada file
     * yang dipilih, file gagal dibaca, atau isinya bukan GeoJSON.
     */
    export function readGeoJSONFile(id: string, responseFunction?: (...args: any[]) => any): any;
    /**
     * Semua posisi [lng, lat] di dalam data, diratakan jadi satu array.
     */
    export function getCoordinates(geojson: any): any;
    /**
     * Kotak pembatas data: [minLng, minLat, maxLng, maxLat] (urutan bbox RFC 7946).
     * null kalau datanya tidak punya koordinat sama sekali.
     */
    export function getBBox(geojson: any): any;
    /**
     * Titik tengah kotak pembatas sebagai [lng, lat] - untuk memusatkan peta, bukan centroid geometri.
     * null kalau datanya tidak punya koordinat.
     */
    export function getCenter(geojson: any): any;
    /**
     * Nama-nama properti yang dipakai fitur di dalam data, tanpa duplikat, urut sesuai
     * kemunculan pertama. Berguna untuk membuat header tabel.
     */
    export function getPropertyKeys(geojson: any): any;
    /**
     * GeoJSON menyimpan posisi sebagai [longitude, latitude]; Leaflet dan Google Maps
     * memintanya terbalik: [latitude, longitude].
     */
    export function toLatLng(position: number[]): any;
}

declare module "https://cdn.jsdelivr.net/gh/crootjs/lib@*/geomeasure.js" {
    /**
     * Jarak antara dua posisi [lng, lat], dalam meter, mengikuti lengkung bumi (haversine).
     */
    export function getDistance(from: number[], to: number[]): any;
    /**
     * Panjang semua garis di dalam data, dalam meter. Untuk polygon yang dihitung kelilingnya
     * (termasuk tepi lubang). Titik tidak punya panjang.
     */
    export function getLength(geojson: any): any;
    /**
     * Luas semua polygon di dalam data, dalam meter persegi. Lubang dikurangkan.
     * Titik dan garis tidak punya luas.
     */
    export function getArea(geojson: any): any;
    /**
     * Fitur-fitur polygon yang memuat position [lng, lat]. Array kosong kalau tidak ada.
     * Titik yang jatuh di dalam lubang sebuah polygon dihitung berada di luar polygon itu.
     */
    export function getFeaturesAt(position: number[], geojson: any): any;
    /**
     * true kalau position [lng, lat] berada di dalam salah satu polygon di dalam data.
     */
    export function isInside(position: number[], geojson: any): any;
    /**
     * Fitur titik (Point/MultiPoint) yang paling dekat dengan position [lng, lat].
     * Mengembalikan { feature, distance } - distance dalam meter - atau null kalau datanya
     * tidak punya fitur titik. Garis dan polygon tidak ikut dibandingkan.
     */
    export function getNearest(position: number[], geojson: any): any;
    /**
     * Membuat Feature polygon berbentuk lingkaran: pusat di center [lng, lat], jari-jari
     * `radius` meter. GeoJSON tidak mengenal lingkaran, jadi ini segi banyak dengan `steps`
     * sisi (bawaan 64). Cocok untuk menggambar radius (misalnya batas presensi) di peta.
     */
    export function createCircle(center: number[], radius: any, steps?: number): any;
    /**
     * Transformasi affine (geser, putar, skala, miring) dari pasangan titik kontrol: titik ke-i
     * di `from` berpasangan dengan titik ke-i di `to`, masing-masing [x, y]. Gunanya mengubah
     * koordinat sistem lokal (grid CAD, denah, piksel gambar) ke [lng, lat] dan sebaliknya.
     * Minimal 3 pasangan yang tidak segaris; lebih dari 3 dicocokkan dengan kuadrat terkecil.
     * Mengembalikan function transform([x, y]) -> [x, y] dengan:
     * transform.inverse([x, y])  arah sebaliknya (dari `to` ke `from`)
     * transform.error            selisih rata-rata (RMS) titik kontrol setelah ditransformasi,
     * dalam satuan `to` - besar berarti ada titik kontrol yang salah
     * atau null kalau titik kontrolnya kurang atau segaris.
     * Untuk area seukuran kawasan (beberapa km) affine dari lng/lat cukup teliti; untuk area
     * yang jauh lebih luas, pakai proyeksi sungguhan.
     */
    export function createAffineTransform(from: number[], to: number[]): any;
}

declare module "https://cdn.jsdelivr.net/gh/crootjs/lib@*/geomeasure.min.js" {
    /**
     * Jarak antara dua posisi [lng, lat], dalam meter, mengikuti lengkung bumi (haversine).
     */
    export function getDistance(from: number[], to: number[]): any;
    /**
     * Panjang semua garis di dalam data, dalam meter. Untuk polygon yang dihitung kelilingnya
     * (termasuk tepi lubang). Titik tidak punya panjang.
     */
    export function getLength(geojson: any): any;
    /**
     * Luas semua polygon di dalam data, dalam meter persegi. Lubang dikurangkan.
     * Titik dan garis tidak punya luas.
     */
    export function getArea(geojson: any): any;
    /**
     * Fitur-fitur polygon yang memuat position [lng, lat]. Array kosong kalau tidak ada.
     * Titik yang jatuh di dalam lubang sebuah polygon dihitung berada di luar polygon itu.
     */
    export function getFeaturesAt(position: number[], geojson: any): any;
    /**
     * true kalau position [lng, lat] berada di dalam salah satu polygon di dalam data.
     */
    export function isInside(position: number[], geojson: any): any;
    /**
     * Fitur titik (Point/MultiPoint) yang paling dekat dengan position [lng, lat].
     * Mengembalikan { feature, distance } - distance dalam meter - atau null kalau datanya
     * tidak punya fitur titik. Garis dan polygon tidak ikut dibandingkan.
     */
    export function getNearest(position: number[], geojson: any): any;
    /**
     * Membuat Feature polygon berbentuk lingkaran: pusat di center [lng, lat], jari-jari
     * `radius` meter. GeoJSON tidak mengenal lingkaran, jadi ini segi banyak dengan `steps`
     * sisi (bawaan 64). Cocok untuk menggambar radius (misalnya batas presensi) di peta.
     */
    export function createCircle(center: number[], radius: any, steps?: number): any;
    /**
     * Transformasi affine (geser, putar, skala, miring) dari pasangan titik kontrol: titik ke-i
     * di `from` berpasangan dengan titik ke-i di `to`, masing-masing [x, y]. Gunanya mengubah
     * koordinat sistem lokal (grid CAD, denah, piksel gambar) ke [lng, lat] dan sebaliknya.
     * Minimal 3 pasangan yang tidak segaris; lebih dari 3 dicocokkan dengan kuadrat terkecil.
     * Mengembalikan function transform([x, y]) -> [x, y] dengan:
     * transform.inverse([x, y])  arah sebaliknya (dari `to` ke `from`)
     * transform.error            selisih rata-rata (RMS) titik kontrol setelah ditransformasi,
     * dalam satuan `to` - besar berarti ada titik kontrol yang salah
     * atau null kalau titik kontrolnya kurang atau segaris.
     * Untuk area seukuran kawasan (beberapa km) affine dari lng/lat cukup teliti; untuk area
     * yang jauh lebih luas, pakai proyeksi sungguhan.
     */
    export function createAffineTransform(from: number[], to: number[]): any;
}

declare module "https://cdn.jsdelivr.net/gh/crootjs/lib@*/georoute.js" {
    /**
     * Jarak antara dua posisi [lng, lat], dalam meter, mengikuti lengkung bumi (haversine).
     */
    export function getDistance(from: number[], to: number[]): any;
    /**
     * Panjang semua garis di dalam data, dalam meter. Untuk polygon yang dihitung kelilingnya
     * (termasuk tepi lubang). Titik tidak punya panjang.
     */
    export function getLength(geojson: any): any;
    /**
     * Luas semua polygon di dalam data, dalam meter persegi. Lubang dikurangkan.
     * Titik dan garis tidak punya luas.
     */
    export function getArea(geojson: any): any;
    /**
     * Fitur-fitur polygon yang memuat position [lng, lat]. Array kosong kalau tidak ada.
     * Titik yang jatuh di dalam lubang sebuah polygon dihitung berada di luar polygon itu.
     */
    export function getFeaturesAt(position: number[], geojson: any): any;
    /**
     * true kalau position [lng, lat] berada di dalam salah satu polygon di dalam data.
     */
    export function isInside(position: number[], geojson: any): any;
    /**
     * Fitur titik (Point/MultiPoint) yang paling dekat dengan position [lng, lat].
     * Mengembalikan { feature, distance } - distance dalam meter - atau null kalau datanya
     * tidak punya fitur titik. Garis dan polygon tidak ikut dibandingkan.
     */
    export function getNearest(position: number[], geojson: any): any;
    /**
     * Membuat Feature polygon berbentuk lingkaran: pusat di center [lng, lat], jari-jari
     * `radius` meter. GeoJSON tidak mengenal lingkaran, jadi ini segi banyak dengan `steps`
     * sisi (bawaan 64). Cocok untuk menggambar radius (misalnya batas presensi) di peta.
     */
    export function createCircle(center: number[], radius: any, steps?: number): any;
    /**
     * Transformasi affine (geser, putar, skala, miring) dari pasangan titik kontrol: titik ke-i
     * di `from` berpasangan dengan titik ke-i di `to`, masing-masing [x, y]. Gunanya mengubah
     * koordinat sistem lokal (grid CAD, denah, piksel gambar) ke [lng, lat] dan sebaliknya.
     * Minimal 3 pasangan yang tidak segaris; lebih dari 3 dicocokkan dengan kuadrat terkecil.
     * Mengembalikan function transform([x, y]) -> [x, y] dengan:
     * transform.inverse([x, y])  arah sebaliknya (dari `to` ke `from`)
     * transform.error            selisih rata-rata (RMS) titik kontrol setelah ditransformasi,
     * dalam satuan `to` - besar berarti ada titik kontrol yang salah
     * atau null kalau titik kontrolnya kurang atau segaris.
     * Untuk area seukuran kawasan (beberapa km) affine dari lng/lat cukup teliti; untuk area
     * yang jauh lebih luas, pakai proyeksi sungguhan.
     */
    export function createAffineTransform(from: number[], to: number[]): any;
    /**
     * Mencari rute terpendek dari `from` ke `to` (keduanya [lng, lat]) di sepanjang garis-garis
     * (LineString/MultiLineString) di dalam `geojson`. Dihitung di browser, tanpa layanan rute.
     * 
     * - `from` dan `to` boleh di mana saja: masing-masing ditempelkan ke titik terdekat pada
     * garis terdekat, dan rutenya mulai/berakhir di titik tempel itu.
     * - Dua garis dianggap bertemu kalau punya koordinat yang sama. Koordinat dibandingkan
     * setelah dibulatkan ke options.precision angka desimal (bawaan 6, kira-kira 11 cm).
     * Untuk data gambar tangan yang ujung garisnya hanya berdekatan, turunkan nilainya
     * (5 = kira-kira 1 m, 4 = kira-kira 11 m).
     * - Semua garis dianggap dua arah, dan yang dicari jarak terpendek.
     * 
     * Mengembalikan Feature LineString dengan properties.distance (panjang rute, meter),
     * atau null kalau datanya tidak punya garis atau kedua titik tidak terhubung.
     */
    export function findRoute(from: number[], to: number[], geojson: any, options?: Record<string, any>): any;
}

declare module "https://cdn.jsdelivr.net/gh/crootjs/lib@*/georoute.min.js" {
    /**
     * Jarak antara dua posisi [lng, lat], dalam meter, mengikuti lengkung bumi (haversine).
     */
    export function getDistance(from: number[], to: number[]): any;
    /**
     * Panjang semua garis di dalam data, dalam meter. Untuk polygon yang dihitung kelilingnya
     * (termasuk tepi lubang). Titik tidak punya panjang.
     */
    export function getLength(geojson: any): any;
    /**
     * Luas semua polygon di dalam data, dalam meter persegi. Lubang dikurangkan.
     * Titik dan garis tidak punya luas.
     */
    export function getArea(geojson: any): any;
    /**
     * Fitur-fitur polygon yang memuat position [lng, lat]. Array kosong kalau tidak ada.
     * Titik yang jatuh di dalam lubang sebuah polygon dihitung berada di luar polygon itu.
     */
    export function getFeaturesAt(position: number[], geojson: any): any;
    /**
     * true kalau position [lng, lat] berada di dalam salah satu polygon di dalam data.
     */
    export function isInside(position: number[], geojson: any): any;
    /**
     * Fitur titik (Point/MultiPoint) yang paling dekat dengan position [lng, lat].
     * Mengembalikan { feature, distance } - distance dalam meter - atau null kalau datanya
     * tidak punya fitur titik. Garis dan polygon tidak ikut dibandingkan.
     */
    export function getNearest(position: number[], geojson: any): any;
    /**
     * Membuat Feature polygon berbentuk lingkaran: pusat di center [lng, lat], jari-jari
     * `radius` meter. GeoJSON tidak mengenal lingkaran, jadi ini segi banyak dengan `steps`
     * sisi (bawaan 64). Cocok untuk menggambar radius (misalnya batas presensi) di peta.
     */
    export function createCircle(center: number[], radius: any, steps?: number): any;
    /**
     * Transformasi affine (geser, putar, skala, miring) dari pasangan titik kontrol: titik ke-i
     * di `from` berpasangan dengan titik ke-i di `to`, masing-masing [x, y]. Gunanya mengubah
     * koordinat sistem lokal (grid CAD, denah, piksel gambar) ke [lng, lat] dan sebaliknya.
     * Minimal 3 pasangan yang tidak segaris; lebih dari 3 dicocokkan dengan kuadrat terkecil.
     * Mengembalikan function transform([x, y]) -> [x, y] dengan:
     * transform.inverse([x, y])  arah sebaliknya (dari `to` ke `from`)
     * transform.error            selisih rata-rata (RMS) titik kontrol setelah ditransformasi,
     * dalam satuan `to` - besar berarti ada titik kontrol yang salah
     * atau null kalau titik kontrolnya kurang atau segaris.
     * Untuk area seukuran kawasan (beberapa km) affine dari lng/lat cukup teliti; untuk area
     * yang jauh lebih luas, pakai proyeksi sungguhan.
     */
    export function createAffineTransform(from: number[], to: number[]): any;
    /**
     * Mencari rute terpendek dari `from` ke `to` (keduanya [lng, lat]) di sepanjang garis-garis
     * (LineString/MultiLineString) di dalam `geojson`. Dihitung di browser, tanpa layanan rute.
     * 
     * - `from` dan `to` boleh di mana saja: masing-masing ditempelkan ke titik terdekat pada
     * garis terdekat, dan rutenya mulai/berakhir di titik tempel itu.
     * - Dua garis dianggap bertemu kalau punya koordinat yang sama. Koordinat dibandingkan
     * setelah dibulatkan ke options.precision angka desimal (bawaan 6, kira-kira 11 cm).
     * Untuk data gambar tangan yang ujung garisnya hanya berdekatan, turunkan nilainya
     * (5 = kira-kira 1 m, 4 = kira-kira 11 m).
     * - Semua garis dianggap dua arah, dan yang dicari jarak terpendek.
     * 
     * Mengembalikan Feature LineString dengan properties.distance (panjang rute, meter),
     * atau null kalau datanya tidak punya garis atau kedua titik tidak terhubung.
     */
    export function findRoute(from: number[], to: number[], geojson: any, options?: Record<string, any>): any;
}

declare module "https://cdn.jsdelivr.net/gh/crootjs/lib@*/image.js" {
    export function getRandomColor(): any;
    export function getRandomColorName(): any;
}

declare module "https://cdn.jsdelivr.net/gh/crootjs/lib@*/image.min.js" {
    export function getRandomColor(): any;
    export function getRandomColorName(): any;
}

declare module "https://cdn.jsdelivr.net/gh/crootjs/lib@*/loading.js" {
    export const loading: any;
}

declare module "https://cdn.jsdelivr.net/gh/crootjs/lib@*/loading.min.js" {
    export const loading: any;
}

declare module "https://cdn.jsdelivr.net/gh/crootjs/lib@*/map.js" {
    /**
     * Menerima teks JSON atau object hasil JSON.parse, mengembalikan FeatureCollection -
     * apa pun bentuk masukannya: FeatureCollection, satu Feature, satu geometri polos, atau
     * array berisi Feature/geometri (bentuk yang biasa dibalas backend dari query MongoDB).
     * Mengembalikan null kalau masukannya bukan GeoJSON. Item yang tidak valid di dalam
     * sebuah koleksi dilewati (dilaporkan di console), tidak menggagalkan seluruh data.
     */
    export function parseGeoJSON(input: any): any;
    /**
     * Mengambil GeoJSON dari URL. responseFunction selalu dipanggil dengan { status, data }:
     * data berisi FeatureCollection, atau null kalau isi balasannya bukan GeoJSON;
     * { status: 0, data: null } kalau jaringan gagal, CORS ditolak, atau request timeout.
     */
    export function getGeoJSON(target_url: string, responseFunction?: (...args: any[]) => any, tokenkey?: any, tokenvalue?: any): any;
    /**
     * Membaca file GeoJSON yang dipilih user di <input type="file" id="...">.
     * responseFunction dipanggil dengan FeatureCollection, atau null kalau belum ada file
     * yang dipilih, file gagal dibaca, atau isinya bukan GeoJSON.
     */
    export function readGeoJSONFile(id: string, responseFunction?: (...args: any[]) => any): any;
    /**
     * Semua posisi [lng, lat] di dalam data, diratakan jadi satu array.
     */
    export function getCoordinates(geojson: any): any;
    /**
     * Kotak pembatas data: [minLng, minLat, maxLng, maxLat] (urutan bbox RFC 7946).
     * null kalau datanya tidak punya koordinat sama sekali.
     */
    export function getBBox(geojson: any): any;
    /**
     * Titik tengah kotak pembatas sebagai [lng, lat] - untuk memusatkan peta, bukan centroid geometri.
     * null kalau datanya tidak punya koordinat.
     */
    export function getCenter(geojson: any): any;
    /**
     * Nama-nama properti yang dipakai fitur di dalam data, tanpa duplikat, urut sesuai
     * kemunculan pertama. Berguna untuk membuat header tabel.
     */
    export function getPropertyKeys(geojson: any): any;
    /**
     * GeoJSON menyimpan posisi sebagai [longitude, latitude]; Leaflet dan Google Maps
     * memintanya terbalik: [latitude, longitude].
     */
    export function toLatLng(position: number[]): any;
    /**
     * Membuat peta di dalam elemen ber-ID `id`. Elemen itu harus sudah punya tinggi dari CSS.
     * options (semua opsional):
     * center      [lng, lat] - urutan GeoJSON. Default: Indonesia.
     * zoom        default 4
     * minZoom     default 1
     * maxZoom     default 19
     * tiles       pola URL tile raster dengan {z}, {x}, {y}. Boleh juga memakai {s} (subdomain),
     * {r} ("@2x" di layar retina), dan {-y} (baris skema TMS). Default: OpenStreetMap.
     * false = tanpa peta dasar, hanya data yang digambar. Boleh juga object
     * { getTile(z, x, y) } yang mengembalikan Promise berisi Blob, URL, atau null,
     * misalnya file PMTiles dari mapoffline.js.
     * attribution atribusi untuk `tiles` buatan sendiri: teks, elemen DOM (untuk tautan), atau
     * array-nya kalau sumbernya lebih dari satu
     * attributionPrefix  false = tanpa tautan "CrootJS" di depan atribusi
     * maxNativeZoom  level tile tertinggi yang tersedia di server. Di atasnya tile level itu
     * diperbesar (overzoom), jadi maxZoom boleh lebih tinggi. Default: maxZoom.
     * labels      pola URL (atau array pola) tile label transparan yang digambar di atas
     * `tiles`, misalnya nama tempat dan jalan di atas citra satelit (hybrid)
     * subdomains  pengganti {s}: string ("abc") atau array. Default "abc".
     * errorTiles  URL gambar pengganti tile yang gagal dimuat
     * zoomControl false = tanpa tombol +/-
     * scrollZoom  false = roda mouse tetap menggulung halaman, tidak men-zoom peta
     */
    export function createMap(id: string, options?: Record<string, any>): any;
    /**
     * Menghapus peta dari elemennya dan menghentikan semua listener-nya.
     */
    export function removeMap(id: string): any;
    /**
     * Memindahkan tampilan ke center [lng, lat]. zoom opsional; tanpa zoom, level sekarang dipertahankan.
     */
    export function setMapView(id: string, center: number[], zoom: any): any;
    /**
     * Tampilan sekarang: { center: [lng, lat], zoom }.
     */
    export function getMapView(id: string): any;
    /**
     * Bagian dunia yang sedang terlihat, sebagai bbox [minLng, minLat, maxLng, maxLat].
     * Berguna untuk meminta ke backend hanya data di area yang tampak.
     */
    export function getMapBounds(id: string): any;
    /**
     * Posisi [lng, lat] -> titik [x, y] dalam piksel, dihitung dari pojok kiri-atas peta.
     * Hasilnya bisa di luar ukuran peta kalau posisinya sedang tidak terlihat.
     */
    export function mapToPoint(id: string, position: number[]): any;
    /**
     * Kebalikannya: titik [x, y] piksel dari pojok kiri-atas peta -> posisi [lng, lat].
     */
    export function pointToPosition(id: string, point: number[]): any;
    /**
     * runFunction({ center, zoom }) dipanggil setiap kali tampilan berubah: digeser, di-zoom,
     * atau ukuran petanya berubah - termasuk di setiap frame selama gestur berlangsung.
     * Mengembalikan function stop() untuk berhenti mendengarkan.
     */
    export function onMapMove(id: string, runFunction?: (...args: any[]) => any): any;
    /**
     * Menaruh elemen buatanmu (tombol, legenda, dsb) di pojok peta: "top-left", "top-right"
     * (bawaan), "bottom-left", atau "bottom-right". Klik di dalamnya tidak menggeser peta.
     * Mengembalikan function remove() untuk mencabutnya lagi.
     */
    export function addMapControl(id: string, element: any, corner?: string): any;
    /**
     * Memaskan tampilan ke seluruh data. `geojson` boleh GeoJSON apa pun yang diterima
     * parseGeoJSON, atau langsung sebuah bbox [minLng, minLat, maxLng, maxLat].
     * padding: jarak kosong (piksel) antara data dan tepi peta. Boleh per sisi,
     * { top, right, bottom, left }, misalnya supaya data tidak tertutup panel di kiri; sisi
     * yang tidak disebut tetap 24.
     */
    export function fitMap(id: string, geojson: any, padding?: number): any;
    /**
     * Menggambar GeoJSON di atas peta. `geojson` boleh apa pun yang diterima parseGeoJSON:
     * FeatureCollection, satu Feature, satu geometri, atau array-nya.
     * options (semua opsional):
     * name   nama lapisan, untuk showLayer/hideLayer/setLayerStyle/setLayerOrder/removeLayer.
     * Lapisan baru dengan nama yang sudah dipakai menggantikan lapisan lama itu.
     * style  object { stroke, strokeWidth, strokeOpacity, strokeDasharray, lineCap, lineJoin,
     * fill, fillOpacity, radius }, atau function (feature) => object untuk membedakan
     * tiap fitur. strokeDasharray: "6 4" atau [6, 4] untuk garis putus-putus (piksel).
     * popup  function (feature) => teks atau elemen DOM yang ditampilkan saat fitur diklik
     * (null = tanpa popup untuk fitur itu). Default: daftar properties-nya.
     * false = tanpa popup sama sekali.
     * hoverStyle  object gaya yang ditimpakan selama kursor berada di atas sebuah fitur
     * tooltip     function (feature) => teks atau elemen DOM yang mengikuti kursor di atas fitur
     * label  nama properti yang ditulis sebagai label fitur, atau function (feature) => teks
     * (null = tanpa label). Label ditaruh di titiknya, di tengah garis, atau di titik
     * berat polygon; label yang bertabrakan dengan label lain disembunyikan.
     * labelOptions  { minZoom, maxZoom, className, overlap } - overlap: true = tanpa
     * penghindaran tabrakan
     * minZoom, maxZoom  lapisan hanya tampil di rentang zoom ini
     * order  urutan tumpuk: makin besar makin di atas. Default 0; yang sama urut ditambahkan.
     * visible  false = ditambahkan dalam keadaan tersembunyi
     * attribution  sumber data lapisan ini, ditambahkan ke atribusi peta selama lapisannya ada
     * renderer  "canvas" = digambar di satu canvas, bukan satu elemen SVG per bentuk: jauh
     * lebih ringan untuk ribuan garis, terutama di ponsel. Lapisan canvas selalu berada
     * di bawah lapisan SVG. Gaya, popup, hover, tooltip, dan label tetap berlaku.
     * simplify  toleransi penyederhanaan geometri per level zoom, dalam piksel (misalnya 1):
     * titik yang menyimpang kurang dari itu dibuang. Default 0 = tidak disederhanakan.
     * Mengembalikan function remove() untuk menghapus lapisan ini dari peta. Function itu juga
     * punya remove.show(), remove.hide(), remove.setStyle(style), dan remove.setOrder(order),
     * untuk lapisan yang tidak diberi nama.
     */
    export function addGeoJSON(id: string, geojson: any, options?: Record<string, any>): any;
    /**
     * Menampilkan lagi lapisan bernama `name` yang disembunyikan hideLayer().
     */
    export function showLayer(id: string, name: string): any;
    /**
     * Menyembunyikan lapisan tanpa menghapusnya; popup dan hover miliknya ikut ditutup.
     */
    export function hideLayer(id: string, name: string): any;
    /**
     * Mengganti gaya seluruh lapisan. style: object atau function (feature) => object, sama
     * seperti opsi style di addGeoJSON.
     */
    export function setLayerStyle(id: string, name: string, style: any): any;
    /**
     * Mengubah urutan tumpuk lapisan: makin besar makin di atas.
     */
    export function setLayerOrder(id: string, name: string, order: any): any;
    export function removeLayer(id: string, name: string): any;
    /**
     * Daftar lapisan bernama, dari bawah ke atas: [{ name, visible, order }].
     */
    export function getLayers(id: string): any;
    /**
     * Mengganti peta dasar tanpa membuat ulang peta: lapisan, marker, dan popup tetap.
     * tiles: sama seperti opsi tiles di createMap (false = tanpa peta dasar).
     * options: labels, maxNativeZoom, subdomains, errorTiles, attribution - sama seperti di
     * createMap, dan semuanya kembali ke bawaan kalau tidak disebut. minZoom/maxZoom juga
     * boleh disebut (misalnya peta dasar yang tidak boleh di-zoom lewat level tertentu); yang
     * tidak disebut tetap seperti sebelumnya.
     */
    export function setTiles(id: string, tiles: any, options?: Record<string, any>): any;
    /**
     * Mengubah rentang zoom yang diizinkan tanpa membuat ulang peta. minZoom atau maxZoom yang
     * tidak diisi (undefined/null) dibiarkan. Kalau zoom sekarang di luar rentang baru, peta
     * langsung di-zoom ke batas terdekat; tombol +/- ikut menyesuaikan.
     */
    export function setZoomRange(id: string, minZoom: any, maxZoom: any): any;
    /**
     * Menghapus semua lapisan GeoJSON dan menutup popup. Peta dasarnya tetap.
     */
    export function clearMap(id: string): any;
    /**
     * Menampilkan popup di position [lng, lat]. content: teks, atau elemen DOM.
     */
    export function showPopup(id: string, position: number[], content: any): any;
    export function closePopup(id: string): any;
    /**
     * runFunction(position, feature) dipanggil setiap kali peta diklik atau di-tap (bukan
     * digeser). position = [lng, lat] titik yang diklik; feature = fitur GeoJSON yang kena
     * klik, atau null kalau yang diklik peta dasarnya.
     */
    export function onMapClick(id: string, runFunction?: (...args: any[]) => any): any;
    /**
     * runFunction(position, feature, detail) dipanggil saat peta diklik kanan, ditekan lama di
     * layar sentuh (sekitar 0,5 detik tanpa bergeser), atau tombol Menu/Shift+F10 ditekan saat
     * peta difokus. feature = fitur GeoJSON di titik itu, atau null. detail = { point, keyboard }.
     * Selama ada pendengar, menu bawaan browser tidak muncul di peta. Untuk menu siap pakai,
     * lihat addContextMenu di mapcontrol.js. Mengembalikan function stop().
     */
    export function onMapContextMenu(id: string, runFunction?: (...args: any[]) => any): any;
}

declare module "https://cdn.jsdelivr.net/gh/crootjs/lib@*/map.min.js" {
    /**
     * Menerima teks JSON atau object hasil JSON.parse, mengembalikan FeatureCollection -
     * apa pun bentuk masukannya: FeatureCollection, satu Feature, satu geometri polos, atau
     * array berisi Feature/geometri (bentuk yang biasa dibalas backend dari query MongoDB).
     * Mengembalikan null kalau masukannya bukan GeoJSON. Item yang tidak valid di dalam
     * sebuah koleksi dilewati (dilaporkan di console), tidak menggagalkan seluruh data.
     */
    export function parseGeoJSON(input: any): any;
    /**
     * Mengambil GeoJSON dari URL. responseFunction selalu dipanggil dengan { status, data }:
     * data berisi FeatureCollection, atau null kalau isi balasannya bukan GeoJSON;
     * { status: 0, data: null } kalau jaringan gagal, CORS ditolak, atau request timeout.
     */
    export function getGeoJSON(target_url: string, responseFunction?: (...args: any[]) => any, tokenkey?: any, tokenvalue?: any): any;
    /**
     * Membaca file GeoJSON yang dipilih user di <input type="file" id="...">.
     * responseFunction dipanggil dengan FeatureCollection, atau null kalau belum ada file
     * yang dipilih, file gagal dibaca, atau isinya bukan GeoJSON.
     */
    export function readGeoJSONFile(id: string, responseFunction?: (...args: any[]) => any): any;
    /**
     * Semua posisi [lng, lat] di dalam data, diratakan jadi satu array.
     */
    export function getCoordinates(geojson: any): any;
    /**
     * Kotak pembatas data: [minLng, minLat, maxLng, maxLat] (urutan bbox RFC 7946).
     * null kalau datanya tidak punya koordinat sama sekali.
     */
    export function getBBox(geojson: any): any;
    /**
     * Titik tengah kotak pembatas sebagai [lng, lat] - untuk memusatkan peta, bukan centroid geometri.
     * null kalau datanya tidak punya koordinat.
     */
    export function getCenter(geojson: any): any;
    /**
     * Nama-nama properti yang dipakai fitur di dalam data, tanpa duplikat, urut sesuai
     * kemunculan pertama. Berguna untuk membuat header tabel.
     */
    export function getPropertyKeys(geojson: any): any;
    /**
     * GeoJSON menyimpan posisi sebagai [longitude, latitude]; Leaflet dan Google Maps
     * memintanya terbalik: [latitude, longitude].
     */
    export function toLatLng(position: number[]): any;
    /**
     * Membuat peta di dalam elemen ber-ID `id`. Elemen itu harus sudah punya tinggi dari CSS.
     * options (semua opsional):
     * center      [lng, lat] - urutan GeoJSON. Default: Indonesia.
     * zoom        default 4
     * minZoom     default 1
     * maxZoom     default 19
     * tiles       pola URL tile raster dengan {z}, {x}, {y}. Boleh juga memakai {s} (subdomain),
     * {r} ("@2x" di layar retina), dan {-y} (baris skema TMS). Default: OpenStreetMap.
     * false = tanpa peta dasar, hanya data yang digambar. Boleh juga object
     * { getTile(z, x, y) } yang mengembalikan Promise berisi Blob, URL, atau null,
     * misalnya file PMTiles dari mapoffline.js.
     * attribution atribusi untuk `tiles` buatan sendiri: teks, elemen DOM (untuk tautan), atau
     * array-nya kalau sumbernya lebih dari satu
     * attributionPrefix  false = tanpa tautan "CrootJS" di depan atribusi
     * maxNativeZoom  level tile tertinggi yang tersedia di server. Di atasnya tile level itu
     * diperbesar (overzoom), jadi maxZoom boleh lebih tinggi. Default: maxZoom.
     * labels      pola URL (atau array pola) tile label transparan yang digambar di atas
     * `tiles`, misalnya nama tempat dan jalan di atas citra satelit (hybrid)
     * subdomains  pengganti {s}: string ("abc") atau array. Default "abc".
     * errorTiles  URL gambar pengganti tile yang gagal dimuat
     * zoomControl false = tanpa tombol +/-
     * scrollZoom  false = roda mouse tetap menggulung halaman, tidak men-zoom peta
     */
    export function createMap(id: string, options?: Record<string, any>): any;
    /**
     * Menghapus peta dari elemennya dan menghentikan semua listener-nya.
     */
    export function removeMap(id: string): any;
    /**
     * Memindahkan tampilan ke center [lng, lat]. zoom opsional; tanpa zoom, level sekarang dipertahankan.
     */
    export function setMapView(id: string, center: number[], zoom: any): any;
    /**
     * Tampilan sekarang: { center: [lng, lat], zoom }.
     */
    export function getMapView(id: string): any;
    /**
     * Bagian dunia yang sedang terlihat, sebagai bbox [minLng, minLat, maxLng, maxLat].
     * Berguna untuk meminta ke backend hanya data di area yang tampak.
     */
    export function getMapBounds(id: string): any;
    /**
     * Posisi [lng, lat] -> titik [x, y] dalam piksel, dihitung dari pojok kiri-atas peta.
     * Hasilnya bisa di luar ukuran peta kalau posisinya sedang tidak terlihat.
     */
    export function mapToPoint(id: string, position: number[]): any;
    /**
     * Kebalikannya: titik [x, y] piksel dari pojok kiri-atas peta -> posisi [lng, lat].
     */
    export function pointToPosition(id: string, point: number[]): any;
    /**
     * runFunction({ center, zoom }) dipanggil setiap kali tampilan berubah: digeser, di-zoom,
     * atau ukuran petanya berubah - termasuk di setiap frame selama gestur berlangsung.
     * Mengembalikan function stop() untuk berhenti mendengarkan.
     */
    export function onMapMove(id: string, runFunction?: (...args: any[]) => any): any;
    /**
     * Menaruh elemen buatanmu (tombol, legenda, dsb) di pojok peta: "top-left", "top-right"
     * (bawaan), "bottom-left", atau "bottom-right". Klik di dalamnya tidak menggeser peta.
     * Mengembalikan function remove() untuk mencabutnya lagi.
     */
    export function addMapControl(id: string, element: any, corner?: string): any;
    /**
     * Memaskan tampilan ke seluruh data. `geojson` boleh GeoJSON apa pun yang diterima
     * parseGeoJSON, atau langsung sebuah bbox [minLng, minLat, maxLng, maxLat].
     * padding: jarak kosong (piksel) antara data dan tepi peta. Boleh per sisi,
     * { top, right, bottom, left }, misalnya supaya data tidak tertutup panel di kiri; sisi
     * yang tidak disebut tetap 24.
     */
    export function fitMap(id: string, geojson: any, padding?: number): any;
    /**
     * Menggambar GeoJSON di atas peta. `geojson` boleh apa pun yang diterima parseGeoJSON:
     * FeatureCollection, satu Feature, satu geometri, atau array-nya.
     * options (semua opsional):
     * name   nama lapisan, untuk showLayer/hideLayer/setLayerStyle/setLayerOrder/removeLayer.
     * Lapisan baru dengan nama yang sudah dipakai menggantikan lapisan lama itu.
     * style  object { stroke, strokeWidth, strokeOpacity, strokeDasharray, lineCap, lineJoin,
     * fill, fillOpacity, radius }, atau function (feature) => object untuk membedakan
     * tiap fitur. strokeDasharray: "6 4" atau [6, 4] untuk garis putus-putus (piksel).
     * popup  function (feature) => teks atau elemen DOM yang ditampilkan saat fitur diklik
     * (null = tanpa popup untuk fitur itu). Default: daftar properties-nya.
     * false = tanpa popup sama sekali.
     * hoverStyle  object gaya yang ditimpakan selama kursor berada di atas sebuah fitur
     * tooltip     function (feature) => teks atau elemen DOM yang mengikuti kursor di atas fitur
     * label  nama properti yang ditulis sebagai label fitur, atau function (feature) => teks
     * (null = tanpa label). Label ditaruh di titiknya, di tengah garis, atau di titik
     * berat polygon; label yang bertabrakan dengan label lain disembunyikan.
     * labelOptions  { minZoom, maxZoom, className, overlap } - overlap: true = tanpa
     * penghindaran tabrakan
     * minZoom, maxZoom  lapisan hanya tampil di rentang zoom ini
     * order  urutan tumpuk: makin besar makin di atas. Default 0; yang sama urut ditambahkan.
     * visible  false = ditambahkan dalam keadaan tersembunyi
     * attribution  sumber data lapisan ini, ditambahkan ke atribusi peta selama lapisannya ada
     * renderer  "canvas" = digambar di satu canvas, bukan satu elemen SVG per bentuk: jauh
     * lebih ringan untuk ribuan garis, terutama di ponsel. Lapisan canvas selalu berada
     * di bawah lapisan SVG. Gaya, popup, hover, tooltip, dan label tetap berlaku.
     * simplify  toleransi penyederhanaan geometri per level zoom, dalam piksel (misalnya 1):
     * titik yang menyimpang kurang dari itu dibuang. Default 0 = tidak disederhanakan.
     * Mengembalikan function remove() untuk menghapus lapisan ini dari peta. Function itu juga
     * punya remove.show(), remove.hide(), remove.setStyle(style), dan remove.setOrder(order),
     * untuk lapisan yang tidak diberi nama.
     */
    export function addGeoJSON(id: string, geojson: any, options?: Record<string, any>): any;
    /**
     * Menampilkan lagi lapisan bernama `name` yang disembunyikan hideLayer().
     */
    export function showLayer(id: string, name: string): any;
    /**
     * Menyembunyikan lapisan tanpa menghapusnya; popup dan hover miliknya ikut ditutup.
     */
    export function hideLayer(id: string, name: string): any;
    /**
     * Mengganti gaya seluruh lapisan. style: object atau function (feature) => object, sama
     * seperti opsi style di addGeoJSON.
     */
    export function setLayerStyle(id: string, name: string, style: any): any;
    /**
     * Mengubah urutan tumpuk lapisan: makin besar makin di atas.
     */
    export function setLayerOrder(id: string, name: string, order: any): any;
    export function removeLayer(id: string, name: string): any;
    /**
     * Daftar lapisan bernama, dari bawah ke atas: [{ name, visible, order }].
     */
    export function getLayers(id: string): any;
    /**
     * Mengganti peta dasar tanpa membuat ulang peta: lapisan, marker, dan popup tetap.
     * tiles: sama seperti opsi tiles di createMap (false = tanpa peta dasar).
     * options: labels, maxNativeZoom, subdomains, errorTiles, attribution - sama seperti di
     * createMap, dan semuanya kembali ke bawaan kalau tidak disebut. minZoom/maxZoom juga
     * boleh disebut (misalnya peta dasar yang tidak boleh di-zoom lewat level tertentu); yang
     * tidak disebut tetap seperti sebelumnya.
     */
    export function setTiles(id: string, tiles: any, options?: Record<string, any>): any;
    /**
     * Mengubah rentang zoom yang diizinkan tanpa membuat ulang peta. minZoom atau maxZoom yang
     * tidak diisi (undefined/null) dibiarkan. Kalau zoom sekarang di luar rentang baru, peta
     * langsung di-zoom ke batas terdekat; tombol +/- ikut menyesuaikan.
     */
    export function setZoomRange(id: string, minZoom: any, maxZoom: any): any;
    /**
     * Menghapus semua lapisan GeoJSON dan menutup popup. Peta dasarnya tetap.
     */
    export function clearMap(id: string): any;
    /**
     * Menampilkan popup di position [lng, lat]. content: teks, atau elemen DOM.
     */
    export function showPopup(id: string, position: number[], content: any): any;
    export function closePopup(id: string): any;
    /**
     * runFunction(position, feature) dipanggil setiap kali peta diklik atau di-tap (bukan
     * digeser). position = [lng, lat] titik yang diklik; feature = fitur GeoJSON yang kena
     * klik, atau null kalau yang diklik peta dasarnya.
     */
    export function onMapClick(id: string, runFunction?: (...args: any[]) => any): any;
    /**
     * runFunction(position, feature, detail) dipanggil saat peta diklik kanan, ditekan lama di
     * layar sentuh (sekitar 0,5 detik tanpa bergeser), atau tombol Menu/Shift+F10 ditekan saat
     * peta difokus. feature = fitur GeoJSON di titik itu, atau null. detail = { point, keyboard }.
     * Selama ada pendengar, menu bawaan browser tidak muncul di peta. Untuk menu siap pakai,
     * lihat addContextMenu di mapcontrol.js. Mengembalikan function stop().
     */
    export function onMapContextMenu(id: string, runFunction?: (...args: any[]) => any): any;
}

declare module "https://cdn.jsdelivr.net/gh/crootjs/lib@*/mapcluster.js" {
    /**
     * Menggambar fitur-fitur titik (Point/MultiPoint) di dalam `geojson` sebagai kelompok.
     * Fitur yang bukan titik dilewati - gambar dengan addGeoJSON() dari map.js.
     * options (semua opsional):
     * radius  jarak pengelompokan dalam piksel: titik-titik dalam satu kotak selebar ini
     * digabung. Bawaan 60. Makin besar, makin sedikit gelembung di layar.
     * color   warna gelembung dan titik. Bawaan biru.
     * popup   function (feature) => teks atau elemen DOM yang ditampilkan saat sebuah titik
     * satuan diklik (null = tanpa popup untuk titik itu). Bawaan: daftar
     * properties-nya. false = tanpa popup sama sekali.
     * onClick function (feature) yang dipanggil saat sebuah titik satuan diklik
     * Mengembalikan function remove() untuk menghapus semuanya dari peta.
     */
    export function addCluster(id: string, geojson: any, options?: Record<string, any>): any;
}

declare module "https://cdn.jsdelivr.net/gh/crootjs/lib@*/mapcluster.min.js" {
    /**
     * Menggambar fitur-fitur titik (Point/MultiPoint) di dalam `geojson` sebagai kelompok.
     * Fitur yang bukan titik dilewati - gambar dengan addGeoJSON() dari map.js.
     * options (semua opsional):
     * radius  jarak pengelompokan dalam piksel: titik-titik dalam satu kotak selebar ini
     * digabung. Bawaan 60. Makin besar, makin sedikit gelembung di layar.
     * color   warna gelembung dan titik. Bawaan biru.
     * popup   function (feature) => teks atau elemen DOM yang ditampilkan saat sebuah titik
     * satuan diklik (null = tanpa popup untuk titik itu). Bawaan: daftar
     * properties-nya. false = tanpa popup sama sekali.
     * onClick function (feature) yang dipanggil saat sebuah titik satuan diklik
     * Mengembalikan function remove() untuk menghapus semuanya dari peta.
     */
    export function addCluster(id: string, geojson: any, options?: Record<string, any>): any;
}

declare module "https://cdn.jsdelivr.net/gh/crootjs/lib@*/mapcontrol.js" {
    /**
     * Menampilkan garis skala ("100 m", "2 km") yang ikut berubah saat peta di-zoom.
     * corner: "bottom-left" (bawaan), "bottom-right", "top-left", atau "top-right".
     * Mengembalikan function remove() untuk mencabutnya.
     */
    export function addScaleBar(id: string, corner?: string): any;
    /**
     * Menanyakan lokasi perangkat ke browser (sekali), menandainya di peta, dan memindahkan
     * tampilan ke sana. Browser hanya mengizinkan ini di halaman HTTPS (atau localhost), dan
     * user harus menyetujui permintaan izinnya.
     * responseFunction (opsional) dipanggil dengan { position: [lng, lat], accuracy } -
     * accuracy dalam meter - atau null kalau lokasinya tidak didapat (izin ditolak, perangkat
     * tidak mendukung, atau lewat 15 detik).
     */
    export function locateUser(id: string, responseFunction?: (...args: any[]) => any): any;
    /**
     * Mengikuti lokasi perangkat terus-menerus (live tracking): penanda lokasi di peta ikut
     * berpindah setiap kali browser melaporkan posisi baru, sampai stop() dipanggil.
     * responseFunction (opsional) dipanggil di setiap pembaruan dengan
     * { position: [lng, lat], accuracy, speed, heading, timestamp } - accuracy dalam meter,
     * speed dalam meter/detik dan heading dalam derajat dari utara (keduanya null kalau
     * perangkat tidak melaporkannya), timestamp dalam milidetik.
     * Kalau izin lokasi ditolak atau perangkat tidak mendukung, responseFunction dipanggil
     * sekali dengan null dan pelacakan berhenti. Gangguan sementara (sinyal hilang) tidak
     * menghentikan pelacakan; browser mencoba lagi sendiri.
     * options.follow (bawaan true): peta ikut bergeser supaya lokasinya tetap di tengah. Begitu
     * user menggeser peta sendiri, peta berhenti mengikuti - penandanya tetap diperbarui.
     * Mengembalikan function stop() untuk menghentikan pelacakan.
     */
    export function trackUser(id: string, responseFunction?: (...args: any[]) => any, options?: Record<string, any>): any;
    /**
     * Menambahkan tombol live tracking ke peta: klik pertama memulai trackUser(), klik
     * berikutnya menghentikannya. Tombolnya berwarna biru selama pelacakan berjalan.
     * responseFunction dan options diteruskan ke trackUser().
     * corner: "top-left" (bawaan), "top-right", "bottom-left", atau "bottom-right".
     * Mengembalikan function remove() yang menghentikan pelacakan dan mencabut tombolnya.
     */
    export function addTrackButton(id: string, responseFunction?: (...args: any[]) => any, options?: Record<string, any>, corner?: string): any;
    /**
     * Menambahkan tombol "lokasi saya" ke peta. Saat diklik, tombol memanggil locateUser()
     * dengan responseFunction yang sama.
     * corner: "top-left" (bawaan, di bawah tombol zoom), "top-right", "bottom-left", atau "bottom-right".
     * Mengembalikan function remove() untuk mencabut tombolnya.
     */
    export function addLocateButton(id: string, responseFunction?: (...args: any[]) => any, corner?: string): any;
    /**
     * Menambahkan pilihan peta dasar ke peta. Memilih salah satu memanggil setTiles() dari
     * map.js - lapisan, marker, dan popup tetap di tempatnya.
     * basemaps: array { name, tiles, labels, maxNativeZoom, subdomains, errorTiles, attribution,
     * minZoom, maxZoom, thumbnail } - semua kecuali name dan thumbnail sama seperti opsi setTiles().
     * options (semua opsional):
     * style      "list" (bawaan, daftar radio) atau "cards" (kartu bergambar seperti di Google Maps)
     * selected   indeks atau name peta dasar yang langsung dipasang. Default 0 (yang pertama).
     * title      judul panel/kisi. Default "Peta dasar".
     * corner     pojok peta. Default "top-right".
     * collapsed  (list) true = panel disimpan di balik tombol
     * trigger    (cards) "hover" atau "click". Default hover di perangkat ber-mouse, klik di layar sentuh.
     * columns    (cards) jumlah kolom kisi. Default 3; di layar <= 640 px paling banyak 2.
     * thumbnailCenter, thumbnailZoom  (cards) titik [lng, lat] dan zoom pratinjau basemap tanpa
     * thumbnail. Default pusat dan zoom peta saat kontrol dipasang.
     * onChange   function (basemap) yang dipanggil setelah peta dasar diganti (termasuk lewat setBasemap)
     * Mengembalikan function remove() untuk mencabut kontrolnya (peta dasar terakhir tetap terpasang).
     */
    export function addBasemapControl(id: string, basemaps: any, options?: Record<string, any>): any;
    /**
     * Mengganti peta dasar dari kode lewat pemilih addBasemapControl (yang terakhir dipasang di
     * peta itu), sehingga radio atau kartunya ikut berpindah. name: name atau indeks basemap.
     * Mengembalikan true kalau berhasil, false kalau peta, pemilih, atau basemap-nya tidak ada.
     */
    export function setBasemap(id: string, name: string): any;
    /**
     * Menambahkan daftar centang untuk menampilkan/menyembunyikan lapisan bernama (opsi name
     * di addGeoJSON). Hanya mengubah visibilitas - lapisannya tidak digambar ulang.
     * layers: array nama, atau array { name, label }. Tanpa layers: semua lapisan bernama yang
     * sudah ada saat fungsi ini dipanggil.
     * options (semua opsional): title (default "Lapisan"), corner, collapsed, dan onChange -
     * function (name, visible) yang dipanggil setiap kali sebuah centang diubah.
     * Mengembalikan function remove() untuk mencabut panelnya.
     */
    export function addLayerControl(id: string, layers: any, options?: Record<string, any>): any;
    /**
     * Menampilkan koordinat di bawah kursor; klik (atau tap) di peta menahan koordinat titik itu
     * dan memunculkan tombol salin. Di layar sentuh, yang tampil hanya koordinat yang di-tap.
     * options (semua opsional):
     * format     function (position) => teks yang ditampilkan dan disalin. Inilah kait untuk
     * sistem koordinat lokal, misalnya grid CAD lewat createAffineTransform dari
     * geomeasure.js. Default: "lat, lng".
     * precision  angka di belakang koma untuk format bawaan. Default 6 (sekitar 10 cm).
     * corner     pojok peta. Default "bottom-left".
     * onClick    function (position, text) yang dipanggil saat koordinat ditahan dengan klik
     * Mengembalikan function remove().
     */
    export function addCoordinateControl(id: string, options?: Record<string, any>): any;
    /**
     * Menu klik kanan di peta. Muncul saat peta diklik kanan, ditekan lama di layar sentuh
     * (sekitar 0,5 detik tanpa bergeser), atau tombol Menu/Shift+F10 ditekan saat peta difokus.
     * items: array item, atau function (position, feature) => array item - dipanggil setiap kali
     * menu dibuka, dengan position = [lng, lat] titik yang diklik dan feature = fitur GeoJSON
     * di titik itu (atau null). Array kosong = menu tidak muncul. Satu item:
     * { label, onClick(position, feature), icon, disabled, danger, title, items }
     * items di dalam item = submenu. "-" = garis pemisah. Teks "coordinates", "center",
     * "zoom-in", "zoom-out" = item siap pakai. false/null/undefined dilewati.
     * options (semua opsional):
     * precision  angka di belakang koma untuk item "coordinates". Default 6.
     * format     function (position) => teks untuk item "coordinates" (dan yang disalin).
     * onOpen     function (position, feature) yang dipanggil setiap kali menu terbuka.
     * Mengembalikan { close(), remove() }.
     */
    export function addContextMenu(id: string, items: any, options?: Record<string, any>): any;
    /**
     * Menambahkan tombol layar penuh: peta memenuhi seluruh layar, klik lagi (atau Esc) untuk
     * kembali. Browser tanpa Fullscreen API (Safari di iPhone) mendapat tiruannya: peta
     * memenuhi jendela browser.
     * corner: "top-left" (bawaan), "top-right", "bottom-left", atau "bottom-right".
     * Mengembalikan function remove() yang juga keluar dari layar penuh.
     */
    export function addFullscreenButton(id: string, corner?: string): any;
}

declare module "https://cdn.jsdelivr.net/gh/crootjs/lib@*/mapcontrol.min.js" {
    /**
     * Menampilkan garis skala ("100 m", "2 km") yang ikut berubah saat peta di-zoom.
     * corner: "bottom-left" (bawaan), "bottom-right", "top-left", atau "top-right".
     * Mengembalikan function remove() untuk mencabutnya.
     */
    export function addScaleBar(id: string, corner?: string): any;
    /**
     * Menanyakan lokasi perangkat ke browser (sekali), menandainya di peta, dan memindahkan
     * tampilan ke sana. Browser hanya mengizinkan ini di halaman HTTPS (atau localhost), dan
     * user harus menyetujui permintaan izinnya.
     * responseFunction (opsional) dipanggil dengan { position: [lng, lat], accuracy } -
     * accuracy dalam meter - atau null kalau lokasinya tidak didapat (izin ditolak, perangkat
     * tidak mendukung, atau lewat 15 detik).
     */
    export function locateUser(id: string, responseFunction?: (...args: any[]) => any): any;
    /**
     * Mengikuti lokasi perangkat terus-menerus (live tracking): penanda lokasi di peta ikut
     * berpindah setiap kali browser melaporkan posisi baru, sampai stop() dipanggil.
     * responseFunction (opsional) dipanggil di setiap pembaruan dengan
     * { position: [lng, lat], accuracy, speed, heading, timestamp } - accuracy dalam meter,
     * speed dalam meter/detik dan heading dalam derajat dari utara (keduanya null kalau
     * perangkat tidak melaporkannya), timestamp dalam milidetik.
     * Kalau izin lokasi ditolak atau perangkat tidak mendukung, responseFunction dipanggil
     * sekali dengan null dan pelacakan berhenti. Gangguan sementara (sinyal hilang) tidak
     * menghentikan pelacakan; browser mencoba lagi sendiri.
     * options.follow (bawaan true): peta ikut bergeser supaya lokasinya tetap di tengah. Begitu
     * user menggeser peta sendiri, peta berhenti mengikuti - penandanya tetap diperbarui.
     * Mengembalikan function stop() untuk menghentikan pelacakan.
     */
    export function trackUser(id: string, responseFunction?: (...args: any[]) => any, options?: Record<string, any>): any;
    /**
     * Menambahkan tombol live tracking ke peta: klik pertama memulai trackUser(), klik
     * berikutnya menghentikannya. Tombolnya berwarna biru selama pelacakan berjalan.
     * responseFunction dan options diteruskan ke trackUser().
     * corner: "top-left" (bawaan), "top-right", "bottom-left", atau "bottom-right".
     * Mengembalikan function remove() yang menghentikan pelacakan dan mencabut tombolnya.
     */
    export function addTrackButton(id: string, responseFunction?: (...args: any[]) => any, options?: Record<string, any>, corner?: string): any;
    /**
     * Menambahkan tombol "lokasi saya" ke peta. Saat diklik, tombol memanggil locateUser()
     * dengan responseFunction yang sama.
     * corner: "top-left" (bawaan, di bawah tombol zoom), "top-right", "bottom-left", atau "bottom-right".
     * Mengembalikan function remove() untuk mencabut tombolnya.
     */
    export function addLocateButton(id: string, responseFunction?: (...args: any[]) => any, corner?: string): any;
    /**
     * Menambahkan pilihan peta dasar ke peta. Memilih salah satu memanggil setTiles() dari
     * map.js - lapisan, marker, dan popup tetap di tempatnya.
     * basemaps: array { name, tiles, labels, maxNativeZoom, subdomains, errorTiles, attribution,
     * minZoom, maxZoom, thumbnail } - semua kecuali name dan thumbnail sama seperti opsi setTiles().
     * options (semua opsional):
     * style      "list" (bawaan, daftar radio) atau "cards" (kartu bergambar seperti di Google Maps)
     * selected   indeks atau name peta dasar yang langsung dipasang. Default 0 (yang pertama).
     * title      judul panel/kisi. Default "Peta dasar".
     * corner     pojok peta. Default "top-right".
     * collapsed  (list) true = panel disimpan di balik tombol
     * trigger    (cards) "hover" atau "click". Default hover di perangkat ber-mouse, klik di layar sentuh.
     * columns    (cards) jumlah kolom kisi. Default 3; di layar <= 640 px paling banyak 2.
     * thumbnailCenter, thumbnailZoom  (cards) titik [lng, lat] dan zoom pratinjau basemap tanpa
     * thumbnail. Default pusat dan zoom peta saat kontrol dipasang.
     * onChange   function (basemap) yang dipanggil setelah peta dasar diganti (termasuk lewat setBasemap)
     * Mengembalikan function remove() untuk mencabut kontrolnya (peta dasar terakhir tetap terpasang).
     */
    export function addBasemapControl(id: string, basemaps: any, options?: Record<string, any>): any;
    /**
     * Mengganti peta dasar dari kode lewat pemilih addBasemapControl (yang terakhir dipasang di
     * peta itu), sehingga radio atau kartunya ikut berpindah. name: name atau indeks basemap.
     * Mengembalikan true kalau berhasil, false kalau peta, pemilih, atau basemap-nya tidak ada.
     */
    export function setBasemap(id: string, name: string): any;
    /**
     * Menambahkan daftar centang untuk menampilkan/menyembunyikan lapisan bernama (opsi name
     * di addGeoJSON). Hanya mengubah visibilitas - lapisannya tidak digambar ulang.
     * layers: array nama, atau array { name, label }. Tanpa layers: semua lapisan bernama yang
     * sudah ada saat fungsi ini dipanggil.
     * options (semua opsional): title (default "Lapisan"), corner, collapsed, dan onChange -
     * function (name, visible) yang dipanggil setiap kali sebuah centang diubah.
     * Mengembalikan function remove() untuk mencabut panelnya.
     */
    export function addLayerControl(id: string, layers: any, options?: Record<string, any>): any;
    /**
     * Menampilkan koordinat di bawah kursor; klik (atau tap) di peta menahan koordinat titik itu
     * dan memunculkan tombol salin. Di layar sentuh, yang tampil hanya koordinat yang di-tap.
     * options (semua opsional):
     * format     function (position) => teks yang ditampilkan dan disalin. Inilah kait untuk
     * sistem koordinat lokal, misalnya grid CAD lewat createAffineTransform dari
     * geomeasure.js. Default: "lat, lng".
     * precision  angka di belakang koma untuk format bawaan. Default 6 (sekitar 10 cm).
     * corner     pojok peta. Default "bottom-left".
     * onClick    function (position, text) yang dipanggil saat koordinat ditahan dengan klik
     * Mengembalikan function remove().
     */
    export function addCoordinateControl(id: string, options?: Record<string, any>): any;
    /**
     * Menu klik kanan di peta. Muncul saat peta diklik kanan, ditekan lama di layar sentuh
     * (sekitar 0,5 detik tanpa bergeser), atau tombol Menu/Shift+F10 ditekan saat peta difokus.
     * items: array item, atau function (position, feature) => array item - dipanggil setiap kali
     * menu dibuka, dengan position = [lng, lat] titik yang diklik dan feature = fitur GeoJSON
     * di titik itu (atau null). Array kosong = menu tidak muncul. Satu item:
     * { label, onClick(position, feature), icon, disabled, danger, title, items }
     * items di dalam item = submenu. "-" = garis pemisah. Teks "coordinates", "center",
     * "zoom-in", "zoom-out" = item siap pakai. false/null/undefined dilewati.
     * options (semua opsional):
     * precision  angka di belakang koma untuk item "coordinates". Default 6.
     * format     function (position) => teks untuk item "coordinates" (dan yang disalin).
     * onOpen     function (position, feature) yang dipanggil setiap kali menu terbuka.
     * Mengembalikan { close(), remove() }.
     */
    export function addContextMenu(id: string, items: any, options?: Record<string, any>): any;
    /**
     * Menambahkan tombol layar penuh: peta memenuhi seluruh layar, klik lagi (atau Esc) untuk
     * kembali. Browser tanpa Fullscreen API (Safari di iPhone) mendapat tiruannya: peta
     * memenuhi jendela browser.
     * corner: "top-left" (bawaan), "top-right", "bottom-left", atau "bottom-right".
     * Mengembalikan function remove() yang juga keluar dari layar penuh.
     */
    export function addFullscreenButton(id: string, corner?: string): any;
}

declare module "https://cdn.jsdelivr.net/gh/crootjs/lib@*/mapdraw.js" {
    /**
     * Mulai menggambar satu geometri. type: "point", "line", atau "polygon" (atau "Point",
     * "LineString", "Polygon"). Klik peta menambah titik; klik ganda, Enter, atau klik titik
     * pertama poligon = selesai; Backspace = hapus titik terakhir; Esc = batal. Titik selesai
     * dengan satu klik.
     * responseFunction(feature) dipanggil sekali: Feature GeoJSON hasilnya, atau null kalau
     * dibatalkan. options (semua opsional):
     * properties  object, atau function (type) => object, untuk properties Feature hasilnya.
     * onChange    function (feature) setiap titik ditambah/dihapus, untuk menampilkan progres
     * (feature null kalau titiknya belum cukup).
     * Mengembalikan { finish(), undo(), stop() } - finish untuk tombol "Selesai" di layar sentuh,
     * yang tidak punya klik ganda.
     */
    export function startDrawing(id: string, type: string, responseFunction?: (...args: any[]) => any, options?: Record<string, any>): any;
    /**
     * Menampilkan pegangan untuk mengubah sebuah geometri: geser simpul (bulat putih) untuk
     * memindahkannya, geser titik tengah ruas (bulat kecil oranye) untuk menambah simpul, klik
     * ganda simpul (atau tekan lama di layar sentuh) untuk menghapusnya.
     * feature: Feature atau geometri GeoJSON (Point, LineString, Polygon, atau Multi-nya). Data
     * aslinya tidak diubah; hasilnya dari getFeature() atau onChange.
     * options (semua opsional):
     * onChange  function (feature) setiap selesai menggeser/menambah/menghapus simpul.
     * Mengembalikan { getFeature(), stop() }.
     */
    export function editFeature(id: string, feature: any, options?: Record<string, any>): any;
    /**
     * Menambahkan tombol gambar titik, garis, poligon, ubah, dan hapus ke peta, beserta lapisan
     * yang menampilkan hasilnya. Data dikelola sendiri sebagai FeatureCollection.
     * options (semua opsional):
     * data        GeoJSON awal yang bisa diubah/dihapus.
     * tools       daftar tombol, bawaan ["point", "line", "polygon", "edit", "delete"].
     * properties  object, atau function (type) => object, untuk fitur baru.
     * corner      pojok peta. Bawaan "top-left".
     * onChange    function (featureCollection) setiap data berubah (tambah, ubah, hapus).
     * Mengembalikan { getData(), setData(geojson), clear(), remove() }.
     */
    export function addDrawControl(id: string, options?: Record<string, any>): any;
}

declare module "https://cdn.jsdelivr.net/gh/crootjs/lib@*/mapdraw.min.js" {
    /**
     * Mulai menggambar satu geometri. type: "point", "line", atau "polygon" (atau "Point",
     * "LineString", "Polygon"). Klik peta menambah titik; klik ganda, Enter, atau klik titik
     * pertama poligon = selesai; Backspace = hapus titik terakhir; Esc = batal. Titik selesai
     * dengan satu klik.
     * responseFunction(feature) dipanggil sekali: Feature GeoJSON hasilnya, atau null kalau
     * dibatalkan. options (semua opsional):
     * properties  object, atau function (type) => object, untuk properties Feature hasilnya.
     * onChange    function (feature) setiap titik ditambah/dihapus, untuk menampilkan progres
     * (feature null kalau titiknya belum cukup).
     * Mengembalikan { finish(), undo(), stop() } - finish untuk tombol "Selesai" di layar sentuh,
     * yang tidak punya klik ganda.
     */
    export function startDrawing(id: string, type: string, responseFunction?: (...args: any[]) => any, options?: Record<string, any>): any;
    /**
     * Menampilkan pegangan untuk mengubah sebuah geometri: geser simpul (bulat putih) untuk
     * memindahkannya, geser titik tengah ruas (bulat kecil oranye) untuk menambah simpul, klik
     * ganda simpul (atau tekan lama di layar sentuh) untuk menghapusnya.
     * feature: Feature atau geometri GeoJSON (Point, LineString, Polygon, atau Multi-nya). Data
     * aslinya tidak diubah; hasilnya dari getFeature() atau onChange.
     * options (semua opsional):
     * onChange  function (feature) setiap selesai menggeser/menambah/menghapus simpul.
     * Mengembalikan { getFeature(), stop() }.
     */
    export function editFeature(id: string, feature: any, options?: Record<string, any>): any;
    /**
     * Menambahkan tombol gambar titik, garis, poligon, ubah, dan hapus ke peta, beserta lapisan
     * yang menampilkan hasilnya. Data dikelola sendiri sebagai FeatureCollection.
     * options (semua opsional):
     * data        GeoJSON awal yang bisa diubah/dihapus.
     * tools       daftar tombol, bawaan ["point", "line", "polygon", "edit", "delete"].
     * properties  object, atau function (type) => object, untuk fitur baru.
     * corner      pojok peta. Bawaan "top-left".
     * onChange    function (featureCollection) setiap data berubah (tambah, ubah, hapus).
     * Mengembalikan { getData(), setData(geojson), clear(), remove() }.
     */
    export function addDrawControl(id: string, options?: Record<string, any>): any;
}

declare module "https://cdn.jsdelivr.net/gh/crootjs/lib@*/mapheat.js" {
    /**
     * Menggambar heatmap kepadatan titik di peta.
     * data: GeoJSON berisi Point/MultiPoint, atau array [lng, lat] / [lng, lat, bobot].
     * options (semua opsional):
     * weight        bobot tiap titik: nama properti atau function(feature) => angka. Bawaan 1
     * (data array: elemen ketiga kalau ada). Titik berbobot <= 0 dilewati.
     * radius        jarak pengaruh tiap titik dalam piksel: panasnya memudar sampai habis di
     * jarak ini. Bawaan 30.
     * radiusMeters  jarak pengaruh dalam meter (menggantikan radius): ikut membesar saat di-zoom.
     * max           kepadatan yang dianggap "paling panas" - jumlah bobot titik di sekitar sebuah
     * tempat, tiap titik dihitung penuh di tempatnya dan memudar sampai radius.
     * Bawaan: kepadatan tertinggi di layar, seperti heatmap Google Maps.
     * scale         "linear" (bawaan), "sqrt", atau "log": cara kepadatan dipetakan ke warna.
     * "sqrt"/"log" menonjolkan tempat yang sepi kalau datanya menumpuk di beberapa
     * titik saja (misalnya dekat BTS).
     * gradient      { posisi 0..1: warna }. Bawaan biru - sian - hijau - kuning - merah.
     * opacity       keburaman seluruh lapisan (0-1). Bawaan 0,8.
     * legend        true atau { title, corner, low, high } untuk menampilkan legenda gradasinya.
     * Mengembalikan { setData(data), setOptions(options), show(), hide(), remove() }.
     */
    export function addHeatmap(id: string, data: any, options?: Record<string, any>): any;
    /**
     * Menggambar data titik sebagai petak berwarna (persegi atau heksagon). Titik-titik di satu
     * petak digabung; warna petak ditentukan nilai gabungannya, seperti peta cakupan sinyal.
     * data: GeoJSON berisi Point/MultiPoint, atau array [lng, lat] / [lng, lat, nilai].
     * options (semua opsional):
     * value       nilai tiap titik: nama properti atau function(feature) => angka (data array:
     * elemen ketiga). Titik tanpa nilai angka dilewati. Tanpa value: petak dihitung
     * dari banyaknya titik.
     * aggregate   "mean" (bawaan kalau ada value), "max", "min", "sum", atau "count" (bawaan
     * tanpa value).
     * shape       "square" (bawaan) atau "hex".
     * cellSize    lebar petak dalam piksel layar. Bawaan 32. Petak dikelompokkan ulang tiap
     * level zoom, jadi ukurannya di layar tetap.
     * cellMeters  lebar petak dalam meter (menggantikan cellSize): petaknya tetap di lapangan,
     * ikut membesar saat di-zoom.
     * breaks      [{ value, color, label }] urut naik: petak bernilai >= value memakai color itu
     * (yang di bawah break pertama memakai warna pertama). Bawaan: rentang nilai
     * dibagi rata ke `colors`.
     * colors      warna untuk batas otomatis, rendah -> tinggi. Bawaan merah - kuning - hijau.
     * opacity     keburaman lapisan (0-1). Bawaan 0,7.
     * stroke      warna garis tepi petak. Bawaan tanpa garis.
     * popup       function(cell) => teks atau elemen saat petak diklik; false = tanpa popup.
     * Bawaan: nilai dan banyak titiknya.
     * onClick     function(cell) yang dipanggil saat petak diklik.
     * legend      true atau { title, corner } untuk menampilkan legenda warnanya.
     * cell = { value, count, mean, min, max, sum, center: [lng, lat], color, label }.
     * Mengembalikan { setData(data), setOptions(options), show(), hide(), remove(), cellAt(position) }.
     * cellAt(position) = cell di [lng, lat] itu (seperti yang diterima onClick), atau null - misalnya
     * untuk menu klik kanan addContextMenu.
     */
    export function addGridMap(id: string, data: any, options?: Record<string, any>): any;
}

declare module "https://cdn.jsdelivr.net/gh/crootjs/lib@*/mapheat.min.js" {
    /**
     * Menggambar heatmap kepadatan titik di peta.
     * data: GeoJSON berisi Point/MultiPoint, atau array [lng, lat] / [lng, lat, bobot].
     * options (semua opsional):
     * weight        bobot tiap titik: nama properti atau function(feature) => angka. Bawaan 1
     * (data array: elemen ketiga kalau ada). Titik berbobot <= 0 dilewati.
     * radius        jarak pengaruh tiap titik dalam piksel: panasnya memudar sampai habis di
     * jarak ini. Bawaan 30.
     * radiusMeters  jarak pengaruh dalam meter (menggantikan radius): ikut membesar saat di-zoom.
     * max           kepadatan yang dianggap "paling panas" - jumlah bobot titik di sekitar sebuah
     * tempat, tiap titik dihitung penuh di tempatnya dan memudar sampai radius.
     * Bawaan: kepadatan tertinggi di layar, seperti heatmap Google Maps.
     * scale         "linear" (bawaan), "sqrt", atau "log": cara kepadatan dipetakan ke warna.
     * "sqrt"/"log" menonjolkan tempat yang sepi kalau datanya menumpuk di beberapa
     * titik saja (misalnya dekat BTS).
     * gradient      { posisi 0..1: warna }. Bawaan biru - sian - hijau - kuning - merah.
     * opacity       keburaman seluruh lapisan (0-1). Bawaan 0,8.
     * legend        true atau { title, corner, low, high } untuk menampilkan legenda gradasinya.
     * Mengembalikan { setData(data), setOptions(options), show(), hide(), remove() }.
     */
    export function addHeatmap(id: string, data: any, options?: Record<string, any>): any;
    /**
     * Menggambar data titik sebagai petak berwarna (persegi atau heksagon). Titik-titik di satu
     * petak digabung; warna petak ditentukan nilai gabungannya, seperti peta cakupan sinyal.
     * data: GeoJSON berisi Point/MultiPoint, atau array [lng, lat] / [lng, lat, nilai].
     * options (semua opsional):
     * value       nilai tiap titik: nama properti atau function(feature) => angka (data array:
     * elemen ketiga). Titik tanpa nilai angka dilewati. Tanpa value: petak dihitung
     * dari banyaknya titik.
     * aggregate   "mean" (bawaan kalau ada value), "max", "min", "sum", atau "count" (bawaan
     * tanpa value).
     * shape       "square" (bawaan) atau "hex".
     * cellSize    lebar petak dalam piksel layar. Bawaan 32. Petak dikelompokkan ulang tiap
     * level zoom, jadi ukurannya di layar tetap.
     * cellMeters  lebar petak dalam meter (menggantikan cellSize): petaknya tetap di lapangan,
     * ikut membesar saat di-zoom.
     * breaks      [{ value, color, label }] urut naik: petak bernilai >= value memakai color itu
     * (yang di bawah break pertama memakai warna pertama). Bawaan: rentang nilai
     * dibagi rata ke `colors`.
     * colors      warna untuk batas otomatis, rendah -> tinggi. Bawaan merah - kuning - hijau.
     * opacity     keburaman lapisan (0-1). Bawaan 0,7.
     * stroke      warna garis tepi petak. Bawaan tanpa garis.
     * popup       function(cell) => teks atau elemen saat petak diklik; false = tanpa popup.
     * Bawaan: nilai dan banyak titiknya.
     * onClick     function(cell) yang dipanggil saat petak diklik.
     * legend      true atau { title, corner } untuk menampilkan legenda warnanya.
     * cell = { value, count, mean, min, max, sum, center: [lng, lat], color, label }.
     * Mengembalikan { setData(data), setOptions(options), show(), hide(), remove(), cellAt(position) }.
     * cellAt(position) = cell di [lng, lat] itu (seperti yang diterima onClick), atau null - misalnya
     * untuk menu klik kanan addContextMenu.
     */
    export function addGridMap(id: string, data: any, options?: Record<string, any>): any;
}

declare module "https://cdn.jsdelivr.net/gh/crootjs/lib@*/mapmarker.js" {
    /**
     * Menaruh marker di position [lng, lat] pada peta ber-ID `id`.
     * options (semua opsional):
     * color      warna pin bawaan. Default merah.
     * icon       URL gambar sebagai pengganti pin
     * size       [lebar, tinggi] gambar icon dalam piksel. Default [32, 32].
     * element    elemen DOM buatan sendiri sebagai pengganti pin/icon
     * anchor     bagian marker yang menempel di posisinya: "bottom" (default, ujung bawah
     * di tengah - cocok untuk pin), "center" (cocok untuk ikon bulat), "top",
     * "left", "right", "top-left", "top-right", "bottom-left", atau "bottom-right"
     * offset     [dx, dy] piksel geser tambahan dari titik jangkarnya (dy positif = ke bawah)
     * label      teks yang selalu tampil di bawah marker
     * title      teks bantuan saat kursor berada di atas marker
     * popup      teks atau elemen DOM yang ditampilkan saat marker diklik
     * onClick    function (position) yang dipanggil saat marker diklik
     * draggable  true = marker bisa digeser dengan mouse atau jari
     * onDragEnd  function (position) yang dipanggil setelah marker selesai digeser
     * Mengembalikan { getPosition(), setPosition(position), remove() }.
     */
    export function addMarker(id: string, position: number[], options?: Record<string, any>): any;
}

declare module "https://cdn.jsdelivr.net/gh/crootjs/lib@*/mapmarker.min.js" {
    /**
     * Menaruh marker di position [lng, lat] pada peta ber-ID `id`.
     * options (semua opsional):
     * color      warna pin bawaan. Default merah.
     * icon       URL gambar sebagai pengganti pin
     * size       [lebar, tinggi] gambar icon dalam piksel. Default [32, 32].
     * element    elemen DOM buatan sendiri sebagai pengganti pin/icon
     * anchor     bagian marker yang menempel di posisinya: "bottom" (default, ujung bawah
     * di tengah - cocok untuk pin), "center" (cocok untuk ikon bulat), "top",
     * "left", "right", "top-left", "top-right", "bottom-left", atau "bottom-right"
     * offset     [dx, dy] piksel geser tambahan dari titik jangkarnya (dy positif = ke bawah)
     * label      teks yang selalu tampil di bawah marker
     * title      teks bantuan saat kursor berada di atas marker
     * popup      teks atau elemen DOM yang ditampilkan saat marker diklik
     * onClick    function (position) yang dipanggil saat marker diklik
     * draggable  true = marker bisa digeser dengan mouse atau jari
     * onDragEnd  function (position) yang dipanggil setelah marker selesai digeser
     * Mengembalikan { getPosition(), setPosition(position), remove() }.
     */
    export function addMarker(id: string, position: number[], options?: Record<string, any>): any;
}

declare module "https://cdn.jsdelivr.net/gh/crootjs/lib@*/mapmodel.js" {
    /**
     * Membuat penampil 3D di dalam elemen id (biasanya <div> yang sudah diberi tinggi lewat CSS).
     * options (semua opsional):
     * background  warna atau gradasi CSS latar. Default abu-abu terang bergradasi.
     * "transparent" = latar halaman terlihat.
     * autoRotate  derajat per detik model berputar sendiri; berhenti begitu pengguna menyentuhnya.
     * fov         sudut pandang vertikal kamera, derajat. Default 45.
     * controls    false = tanpa orbit/zoom/geser dari pengguna. Default true.
     * webgl       1 = paksa WebGL1 (untuk menguji cadangan). Default WebGL2, cadangan WebGL1.
     * dracoDecoder  folder dekoder Draco (draco_wasm_wrapper_gltf.js + draco_decoder_gltf.wasm)
     * untuk model terkompresi Draco. Default dari www.gstatic.com; isi dengan folder
     * sendiri kalau aplikasinya harus jalan tanpa server Google.
     */
    export function createViewer(id: string, options?: Record<string, any>): any;
    /**
     * Memuat model glTF 2.0 dan menggantikan model sebelumnya. source: URL file .glb/.gltf,
     * File/Blob (misalnya dari <input type="file">), atau ArrayBuffer.
     * responseFunction(info, error) dipanggil setelah model tampil:
     * info = { parts: [nama bagian], triangles, bounds: { min, max, center, size } }, atau
     * null kalau gagal - error berisi alasannya (juga dicetak di console).
     * Juga mengembalikan Promise berisi info yang sama, jadi bisa di-await.
     */
    export function loadModel(id: string, source: any, responseFunction?: (...args: any[]) => any): Promise<{ parts: string[]; triangles: number; bounds: { min: number[]; max: number[]; center: number[]; size: number[] } | null } | null>;
    /**
     * Menghapus model dari penampil. Penampilnya tetap, siap memuat model lain.
     */
    export function clearModel(id: string): any;
    /**
     * Menghapus penampil dari elemennya, beserta konteks WebGL-nya.
     */
    export function removeViewer(id: string): any;
    /**
     * Daftar semua bagian (node) model, urut seperti pohonnya:
     * [{ name, mesh, parent, depth, visible }]. depth = kedalaman di pohon (0 = paling atas).
     */
    export function getParts(id: string): any;
    /**
     * Mengganti warna sebuah bagian beserta bagian di bawahnya. color: warna CSS ("#ff0000",
     * "red", "rgba(255, 0, 0, 0.5)") atau [r, g, b, a] 0..1; null = kembali ke warna aslinya.
     * Warna dengan alpha < 1 membuatnya transparan. Mengembalikan false kalau bagiannya tidak ada.
     */
    export function setPartColor(id: string, name: string, color: any): any;
    /**
     * Menampilkan atau menyembunyikan sebuah bagian beserta bagian di bawahnya.
     */
    export function setPartVisible(id: string, name: string, visible: any): any;
    /**
     * Menandai bagian yang sedang dipilih dengan warna biru. null = hapus tanda.
     */
    export function highlightPart(id: string, name: string): any;
    /**
     * Posisi, rotasi, dan skala sebuah bagian relatif terhadap induknya:
     * { position: [x, y, z], rotation: [x, y, z] derajat (Euler XYZ), quaternion, scale }.
     */
    export function getPartTransform(id: string, name: string): any;
    /**
     * Mengubah posisi, rotasi, dan/atau skala sebuah bagian (yang diisi saja). rotation =
     * [x, y, z] derajat (Euler XYZ) atau quaternion [x, y, z, w]; scale = angka atau [x, y, z].
     */
    export function setPartTransform(id: string, name: string, transform?: Record<string, any>): any;
    /**
     * runFunction(hit) setiap kali model diklik atau di-tap (bukan digeser). hit = { part, mesh,
     * path, position, distance }: part = nama bagian yang kena, path = nama-nama dari bagian
     * teratas sampai bagian itu, position = titik yang kena [x, y, z]. null kalau yang diklik
     * latarnya. Mengembalikan function stop().
     */
    export function onModelClick(id: string, runFunction?: (...args: any[]) => any): any;
    /**
     * Menggerakkan kamera supaya seluruh model - atau bagian name saja - pas di layar.
     * name boleh juga array nama: semua bagian itu dibuat muat sekaligus.
     */
    export function fitView(id: string, name: string): any;
    /**
     * Mengatur kamera: { yaw, pitch, distance, target } - yang diisi saja. yaw = sudut keliling
     * (derajat, 0 = dari depan/+Z), pitch = sudut dari atas (derajat, -89..89), distance = jarak
     * ke target, target = [x, y, z] titik yang dilihat. animate: false = langsung pindah.
     */
    export function setCameraView(id: string, view?: Record<string, any>, animate?: boolean): any;
    /**
     * Kamera sekarang: { yaw, pitch, distance, target } (sudut dalam derajat).
     */
    export function getCameraView(id: string): any;
    /**
     * Memutar model terus-menerus (derajat per detik), 0 = berhenti.
     */
    export function setAutoRotate(id: string, degreesPerSecond: any): any;
    /**
     * Menaruh model 3D di position [lng, lat]. source: URL .glb/.gltf, File/Blob, atau ArrayBuffer
     * (sama dengan loadModel). Titik asal model (0, 0, 0) - biasanya tengah dasarnya - jatuh tepat
     * di position. Sumbu model mengikuti glTF: +Y ke atas, -Z menghadap utara, +X ke timur.
     * options (semua opsional):
     * heading      putaran model searah jarum jam dari utara, derajat. Bawaan 0.
     * pitch        sudut pandang dari atas cakrawala, derajat (90 = tegak dari atas). Bawaan 50.
     * scale        meter per satuan model. Bawaan 1 (glTF memakai meter).
     * minZoom      di bawah zoom ini model disembunyikan (terlalu kecil). Bawaan 13.
     * onClick      function (hit) saat model diklik; hit sama dengan onModelClick model3d.js.
     * Klik sampai 8 piksel dari model masih dihitung, karena model di peta kecil.
     * responseFunction  function (info, error) setelah model dimuat, sama dengan loadModel.
     * Mengembalikan { setPosition(position), setHeading(degrees), viewerId, loaded, remove() }:
     * viewerId bisa dipakai fungsi model3d.js yang diekspor ulang modul ini, misalnya
     * setPartColor(viewerId, "Antena_1", "red"); loaded = Promise hasil loadModel.
     */
    export function addModel(id: string, position: number[], source: any, options?: Record<string, any>): any;
}

declare module "https://cdn.jsdelivr.net/gh/crootjs/lib@*/mapmodel.min.js" {
    /**
     * Membuat penampil 3D di dalam elemen id (biasanya <div> yang sudah diberi tinggi lewat CSS).
     * options (semua opsional):
     * background  warna atau gradasi CSS latar. Default abu-abu terang bergradasi.
     * "transparent" = latar halaman terlihat.
     * autoRotate  derajat per detik model berputar sendiri; berhenti begitu pengguna menyentuhnya.
     * fov         sudut pandang vertikal kamera, derajat. Default 45.
     * controls    false = tanpa orbit/zoom/geser dari pengguna. Default true.
     * webgl       1 = paksa WebGL1 (untuk menguji cadangan). Default WebGL2, cadangan WebGL1.
     * dracoDecoder  folder dekoder Draco (draco_wasm_wrapper_gltf.js + draco_decoder_gltf.wasm)
     * untuk model terkompresi Draco. Default dari www.gstatic.com; isi dengan folder
     * sendiri kalau aplikasinya harus jalan tanpa server Google.
     */
    export function createViewer(id: string, options?: Record<string, any>): any;
    /**
     * Memuat model glTF 2.0 dan menggantikan model sebelumnya. source: URL file .glb/.gltf,
     * File/Blob (misalnya dari <input type="file">), atau ArrayBuffer.
     * responseFunction(info, error) dipanggil setelah model tampil:
     * info = { parts: [nama bagian], triangles, bounds: { min, max, center, size } }, atau
     * null kalau gagal - error berisi alasannya (juga dicetak di console).
     * Juga mengembalikan Promise berisi info yang sama, jadi bisa di-await.
     */
    export function loadModel(id: string, source: any, responseFunction?: (...args: any[]) => any): Promise<{ parts: string[]; triangles: number; bounds: { min: number[]; max: number[]; center: number[]; size: number[] } | null } | null>;
    /**
     * Menghapus model dari penampil. Penampilnya tetap, siap memuat model lain.
     */
    export function clearModel(id: string): any;
    /**
     * Menghapus penampil dari elemennya, beserta konteks WebGL-nya.
     */
    export function removeViewer(id: string): any;
    /**
     * Daftar semua bagian (node) model, urut seperti pohonnya:
     * [{ name, mesh, parent, depth, visible }]. depth = kedalaman di pohon (0 = paling atas).
     */
    export function getParts(id: string): any;
    /**
     * Mengganti warna sebuah bagian beserta bagian di bawahnya. color: warna CSS ("#ff0000",
     * "red", "rgba(255, 0, 0, 0.5)") atau [r, g, b, a] 0..1; null = kembali ke warna aslinya.
     * Warna dengan alpha < 1 membuatnya transparan. Mengembalikan false kalau bagiannya tidak ada.
     */
    export function setPartColor(id: string, name: string, color: any): any;
    /**
     * Menampilkan atau menyembunyikan sebuah bagian beserta bagian di bawahnya.
     */
    export function setPartVisible(id: string, name: string, visible: any): any;
    /**
     * Menandai bagian yang sedang dipilih dengan warna biru. null = hapus tanda.
     */
    export function highlightPart(id: string, name: string): any;
    /**
     * Posisi, rotasi, dan skala sebuah bagian relatif terhadap induknya:
     * { position: [x, y, z], rotation: [x, y, z] derajat (Euler XYZ), quaternion, scale }.
     */
    export function getPartTransform(id: string, name: string): any;
    /**
     * Mengubah posisi, rotasi, dan/atau skala sebuah bagian (yang diisi saja). rotation =
     * [x, y, z] derajat (Euler XYZ) atau quaternion [x, y, z, w]; scale = angka atau [x, y, z].
     */
    export function setPartTransform(id: string, name: string, transform?: Record<string, any>): any;
    /**
     * runFunction(hit) setiap kali model diklik atau di-tap (bukan digeser). hit = { part, mesh,
     * path, position, distance }: part = nama bagian yang kena, path = nama-nama dari bagian
     * teratas sampai bagian itu, position = titik yang kena [x, y, z]. null kalau yang diklik
     * latarnya. Mengembalikan function stop().
     */
    export function onModelClick(id: string, runFunction?: (...args: any[]) => any): any;
    /**
     * Menggerakkan kamera supaya seluruh model - atau bagian name saja - pas di layar.
     * name boleh juga array nama: semua bagian itu dibuat muat sekaligus.
     */
    export function fitView(id: string, name: string): any;
    /**
     * Mengatur kamera: { yaw, pitch, distance, target } - yang diisi saja. yaw = sudut keliling
     * (derajat, 0 = dari depan/+Z), pitch = sudut dari atas (derajat, -89..89), distance = jarak
     * ke target, target = [x, y, z] titik yang dilihat. animate: false = langsung pindah.
     */
    export function setCameraView(id: string, view?: Record<string, any>, animate?: boolean): any;
    /**
     * Kamera sekarang: { yaw, pitch, distance, target } (sudut dalam derajat).
     */
    export function getCameraView(id: string): any;
    /**
     * Memutar model terus-menerus (derajat per detik), 0 = berhenti.
     */
    export function setAutoRotate(id: string, degreesPerSecond: any): any;
    /**
     * Menaruh model 3D di position [lng, lat]. source: URL .glb/.gltf, File/Blob, atau ArrayBuffer
     * (sama dengan loadModel). Titik asal model (0, 0, 0) - biasanya tengah dasarnya - jatuh tepat
     * di position. Sumbu model mengikuti glTF: +Y ke atas, -Z menghadap utara, +X ke timur.
     * options (semua opsional):
     * heading      putaran model searah jarum jam dari utara, derajat. Bawaan 0.
     * pitch        sudut pandang dari atas cakrawala, derajat (90 = tegak dari atas). Bawaan 50.
     * scale        meter per satuan model. Bawaan 1 (glTF memakai meter).
     * minZoom      di bawah zoom ini model disembunyikan (terlalu kecil). Bawaan 13.
     * onClick      function (hit) saat model diklik; hit sama dengan onModelClick model3d.js.
     * Klik sampai 8 piksel dari model masih dihitung, karena model di peta kecil.
     * responseFunction  function (info, error) setelah model dimuat, sama dengan loadModel.
     * Mengembalikan { setPosition(position), setHeading(degrees), viewerId, loaded, remove() }:
     * viewerId bisa dipakai fungsi model3d.js yang diekspor ulang modul ini, misalnya
     * setPartColor(viewerId, "Antena_1", "red"); loaded = Promise hasil loadModel.
     */
    export function addModel(id: string, position: number[], source: any, options?: Record<string, any>): any;
}

declare module "https://cdn.jsdelivr.net/gh/crootjs/lib@*/mapoffline.js" {
    /**
     * Nomor tile di kurva Hilbert, seperti spesifikasi PMTiles: tile di semua zoom sebelumnya,
     * ditambah urutan (x, y) di kurva Hilbert level z.
     */
    export function tileId(z: any, x: any, y: any): any;
    /**
     * Membuka file PMTiles. source: URL, atau File/Blob dari <input type="file">. URL dibaca
     * sepotong-sepotong lewat HTTP Range (Cloudflare R2, S3, nginx biasa); server yang tidak
     * melayani Range dengan benar membuat seluruh file diunduh sekali.
     * responseFunction(archive, error) dipanggil sekali; juga mengembalikan Promise berisi archive
     * (atau null kalau gagal - alasannya di error dan console).
     * archive = { getTile(z, x, y), minZoom, maxZoom, bounds: [minLng, minLat, maxLng, maxLat],
     * center: [lng, lat], centerZoom, tileType, metadata, attribution }
     * archive langsung bisa dipakai sebagai opsi tiles di createMap atau setTiles.
     */
    export function openPMTiles(source: any, responseFunction?: (...args: any[]) => any): Promise<any>;
}

declare module "https://cdn.jsdelivr.net/gh/crootjs/lib@*/mapoffline.min.js" {
    /**
     * Nomor tile di kurva Hilbert, seperti spesifikasi PMTiles: tile di semua zoom sebelumnya,
     * ditambah urutan (x, y) di kurva Hilbert level z.
     */
    export function tileId(z: any, x: any, y: any): any;
    /**
     * Membuka file PMTiles. source: URL, atau File/Blob dari <input type="file">. URL dibaca
     * sepotong-sepotong lewat HTTP Range (Cloudflare R2, S3, nginx biasa); server yang tidak
     * melayani Range dengan benar membuat seluruh file diunduh sekali.
     * responseFunction(archive, error) dipanggil sekali; juga mengembalikan Promise berisi archive
     * (atau null kalau gagal - alasannya di error dan console).
     * archive = { getTile(z, x, y), minZoom, maxZoom, bounds: [minLng, minLat, maxLng, maxLat],
     * center: [lng, lat], centerZoom, tileType, metadata, attribution }
     * archive langsung bisa dipakai sebagai opsi tiles di createMap atau setTiles.
     */
    export function openPMTiles(source: any, responseFunction?: (...args: any[]) => any): Promise<any>;
}

declare module "https://cdn.jsdelivr.net/gh/crootjs/lib@*/mapsearch.js" {
    /**
     * Mencari tempat dari teks: nama, alamat, atau nama jalan.
     * responseFunction(results) - results = [{ name, position: [lng, lat], bbox: [minLng, minLat,
     * maxLng, maxLat] atau null, type, address, raw }], array kosong kalau tidak ada yang cocok, atau
     * null kalau permintaannya gagal (jaringan, server menolak). Juga mengembalikan Promise berisi
     * results yang sama.
     * options (semua opsional):
     * limit         banyak hasil, bawaan 5
     * countryCodes  batasi negara, misalnya "id" atau "id,my"
     * language      bahasa nama tempat, bawaan bahasa browser
     * viewbox       [minLng, minLat, maxLng, maxLat] untuk mengutamakan hasil di area itu
     * url           alamat server Nominatim sendiri. Bawaan server publik OSM
     * provider      function (query, options) => Promise<results> untuk penyedia lain; dipakai
     * sebagai ganti Nominatim, hasilnya harus berbentuk seperti di atas
     */
    export function searchPlace(query: any, responseFunction?: (...args: any[]) => any, options?: Record<string, any>): Promise<any>;
    /**
     * Alamat di sebuah titik [lng, lat]. responseFunction(result) - result = { name, position,
     * bbox, type, address, raw }, null kalau tidak ada alamat di sana atau permintaannya gagal.
     * Juga mengembalikan Promise. options: zoom (detail alamat 3-18, bawaan 18 = bangunan),
     * language, url, provider (function (position, options) => Promise<result>).
     */
    export function reverseGeocode(position: number[], responseFunction?: (...args: any[]) => any, options?: Record<string, any>): Promise<any>;
    /**
     * Kotak pencarian di pojok peta. Ketik lalu Enter (atau tombol cari); pilih hasilnya dengan
     * klik, atau panah atas/bawah + Enter. Peta pindah ke tempat itu dan memberi tanda merah.
     * Pencarian hanya dikirim saat Enter/tombol ditekan, bukan setiap huruf - sesuai aturan server
     * publik Nominatim.
     * options (semua opsional): placeholder, corner (bawaan "top-right"), marker (false = tanpa
     * tanda), maxZoom (zoom terdekat saat pindah, bawaan 17), onSelect(result), plus opsi
     * searchPlace (limit, countryCodes, language, viewbox, url, provider).
     * Selama memakai server Nominatim publik, daftar hasil diberi atribusi "Data © kontributor
     * OpenStreetMap" (wajib menurut aturan pemakaiannya).
     * Mengembalikan { search(text), clear(), remove() }.
     */
    export function addSearchControl(id: string, options?: Record<string, any>): any;
}

declare module "https://cdn.jsdelivr.net/gh/crootjs/lib@*/mapsearch.min.js" {
    /**
     * Mencari tempat dari teks: nama, alamat, atau nama jalan.
     * responseFunction(results) - results = [{ name, position: [lng, lat], bbox: [minLng, minLat,
     * maxLng, maxLat] atau null, type, address, raw }], array kosong kalau tidak ada yang cocok, atau
     * null kalau permintaannya gagal (jaringan, server menolak). Juga mengembalikan Promise berisi
     * results yang sama.
     * options (semua opsional):
     * limit         banyak hasil, bawaan 5
     * countryCodes  batasi negara, misalnya "id" atau "id,my"
     * language      bahasa nama tempat, bawaan bahasa browser
     * viewbox       [minLng, minLat, maxLng, maxLat] untuk mengutamakan hasil di area itu
     * url           alamat server Nominatim sendiri. Bawaan server publik OSM
     * provider      function (query, options) => Promise<results> untuk penyedia lain; dipakai
     * sebagai ganti Nominatim, hasilnya harus berbentuk seperti di atas
     */
    export function searchPlace(query: any, responseFunction?: (...args: any[]) => any, options?: Record<string, any>): Promise<any>;
    /**
     * Alamat di sebuah titik [lng, lat]. responseFunction(result) - result = { name, position,
     * bbox, type, address, raw }, null kalau tidak ada alamat di sana atau permintaannya gagal.
     * Juga mengembalikan Promise. options: zoom (detail alamat 3-18, bawaan 18 = bangunan),
     * language, url, provider (function (position, options) => Promise<result>).
     */
    export function reverseGeocode(position: number[], responseFunction?: (...args: any[]) => any, options?: Record<string, any>): Promise<any>;
    /**
     * Kotak pencarian di pojok peta. Ketik lalu Enter (atau tombol cari); pilih hasilnya dengan
     * klik, atau panah atas/bawah + Enter. Peta pindah ke tempat itu dan memberi tanda merah.
     * Pencarian hanya dikirim saat Enter/tombol ditekan, bukan setiap huruf - sesuai aturan server
     * publik Nominatim.
     * options (semua opsional): placeholder, corner (bawaan "top-right"), marker (false = tanpa
     * tanda), maxZoom (zoom terdekat saat pindah, bawaan 17), onSelect(result), plus opsi
     * searchPlace (limit, countryCodes, language, viewbox, url, provider).
     * Selama memakai server Nominatim publik, daftar hasil diberi atribusi "Data © kontributor
     * OpenStreetMap" (wajib menurut aturan pemakaiannya).
     * Mengembalikan { search(text), clear(), remove() }.
     */
    export function addSearchControl(id: string, options?: Record<string, any>): any;
}

declare module "https://cdn.jsdelivr.net/gh/crootjs/lib@*/maptools.js" {
    /**
     * Panjang dalam meter -> teks: "85,4 m", "640 m", "12,35 km".
     */
    export function formatLength(meters: any): any;
    /**
     * Luas dalam meter persegi -> teks: "850 m²", "2,45 ha", "12,30 km²".
     */
    export function formatArea(squareMeters: any): any;
    /**
     * Mengukur jarak (type "distance") atau luas (type "area") dengan mengklik titik-titik di
     * peta. Selama mengukur, klik peta tidak membuka popup dan tidak diteruskan ke onMapClick.
     * Selesai dengan klik ganda, Enter, atau finish(); Backspace menghapus titik terakhir; Esc
     * membatalkan. Di layar sentuh tidak ada klik ganda: pakai finish() (tombol Selesai di
     * addMeasureControl).
     * responseFunction (opsional) dipanggil sekali saat selesai dengan
     * { type, feature, length, area, text } - feature berupa Feature LineString atau Polygon,
     * length (jarak atau keliling) dalam meter, area dalam meter persegi, text siap tampil -
     * atau null kalau dibatalkan.
     * options.onChange (opsional) dipanggil dengan hasil yang sama setiap kali titiknya berubah.
     * Bentuk hasil ukur tetap tergambar sampai stop() dipanggil atau pengukuran baru dimulai.
     * Mengembalikan { finish(), undo(), stop() } - stop() membatalkan dan menghapus gambarnya.
     */
    export function measure(id: string, type: string, responseFunction?: (...args: any[]) => any, options?: Record<string, any>): any;
    /**
     * Menambahkan tombol ukur jarak dan ukur luas ke peta, beserta kotak hasilnya (dengan tombol
     * Selesai, Hapus titik, dan Tutup - wajib untuk layar sentuh yang tidak punya klik ganda).
     * options (semua opsional):
     * corner    pojok peta. Default "top-left".
     * onResult  function (result) yang dipanggil setiap kali pengukuran selesai; result sama
     * seperti di measure()
     * Mengembalikan function remove().
     */
    export function addMeasureControl(id: string, options?: Record<string, any>): any;
    /**
     * Menempelkan gambar (PNG, JPG, SVG - misalnya master plan atau hasil scan denah) di peta,
     * di atas peta dasar dan di bawah data. Gambar ikut bergeser dan di-zoom bersama peta.
     * Letaknya ditentukan salah satu dari:
     * options.corners   [kiri-atas, kanan-atas, kiri-bawah] gambar, masing-masing [lng, lat].
     * Tiga titik ini cukup untuk rotasi, skala, dan miring sekaligus.
     * options.bounds    [minLng, minLat, maxLng, maxLat], ditambah options.rotation (derajat,
     * searah jarum jam, berputar di tengah gambar)
     * Untuk menggeoreferensikan dari titik kontrol (piksel gambar <-> [lng, lat]), buat
     * transformasinya dengan createAffineTransform dari geomeasure.js lalu hitung ketiga sudutnya.
     * options lainnya: opacity (0..1, default 1), crossOrigin (true kalau gambarnya dari domain
     * lain dan ingin ikut di exportMapImage; servernya harus mengizinkan CORS), alt.
     * Mengembalikan { setCorners(corners), setBounds(bounds, rotation), setOpacity(opacity), remove() }.
     */
    export function addImageOverlay(id: string, url: string, options?: Record<string, any>): any;
    /**
     * Mengekspor tampilan peta saat ini menjadi gambar PNG, misalnya untuk laporan.
     * Yang ikut: peta dasar, gambar overlay, semua lapisan GeoJSON (SVG dan canvas), label fitur,
     * marker, gelembung mapcluster.js, penanda lokasi, hasil alat ukur, garis skala, dan teks
     * atribusi. Label dan elemen HTML digambar dari CSS-nya: latar, garis tepi, sudut membulat,
     * padding, isi ::before/::after, dan text-shadow sebagai halo. Bayangan kotak (box-shadow),
     * gradien, dan transform berputar tidak ikut. Popup dan tombol kontrol juga tidak ikut.
     * Tile peta dasar dimuat ulang dengan CORS; tile dari server yang tidak mengizinkan CORS
     * dilewati (OpenStreetMap dan Esri mengizinkan).
     * responseFunction(blob, info) dipanggil sekali: blob PNG (atau null kalau gagal) dan
     * info { width, height, missingImages } - missingImages = jumlah gambar yang dilewati.
     * options (semua opsional):
     * scale        kelipatan resolusi. Default devicePixelRatio layar (2 di layar retina).
     * attribution  false = tanpa teks atribusi (wajib ada untuk OpenStreetMap - jangan dibuang
     * kalau gambarnya dipublikasikan)
     */
    export function exportMapImage(id: string, responseFunction?: (...args: any[]) => any, options?: Record<string, any>): any;
    /**
     * Mengekspor tampilan peta (seperti exportMapImage) lalu langsung mengunduhnya sebagai file.
     * filename default "peta.png". responseFunction (opsional) menerima hasil yang sama dengan
     * exportMapImage.
     */
    export function downloadMapImage(id: string, filename?: string, responseFunction?: (...args: any[]) => any, options?: Record<string, any>): any;
}

declare module "https://cdn.jsdelivr.net/gh/crootjs/lib@*/maptools.min.js" {
    /**
     * Panjang dalam meter -> teks: "85,4 m", "640 m", "12,35 km".
     */
    export function formatLength(meters: any): any;
    /**
     * Luas dalam meter persegi -> teks: "850 m²", "2,45 ha", "12,30 km²".
     */
    export function formatArea(squareMeters: any): any;
    /**
     * Mengukur jarak (type "distance") atau luas (type "area") dengan mengklik titik-titik di
     * peta. Selama mengukur, klik peta tidak membuka popup dan tidak diteruskan ke onMapClick.
     * Selesai dengan klik ganda, Enter, atau finish(); Backspace menghapus titik terakhir; Esc
     * membatalkan. Di layar sentuh tidak ada klik ganda: pakai finish() (tombol Selesai di
     * addMeasureControl).
     * responseFunction (opsional) dipanggil sekali saat selesai dengan
     * { type, feature, length, area, text } - feature berupa Feature LineString atau Polygon,
     * length (jarak atau keliling) dalam meter, area dalam meter persegi, text siap tampil -
     * atau null kalau dibatalkan.
     * options.onChange (opsional) dipanggil dengan hasil yang sama setiap kali titiknya berubah.
     * Bentuk hasil ukur tetap tergambar sampai stop() dipanggil atau pengukuran baru dimulai.
     * Mengembalikan { finish(), undo(), stop() } - stop() membatalkan dan menghapus gambarnya.
     */
    export function measure(id: string, type: string, responseFunction?: (...args: any[]) => any, options?: Record<string, any>): any;
    /**
     * Menambahkan tombol ukur jarak dan ukur luas ke peta, beserta kotak hasilnya (dengan tombol
     * Selesai, Hapus titik, dan Tutup - wajib untuk layar sentuh yang tidak punya klik ganda).
     * options (semua opsional):
     * corner    pojok peta. Default "top-left".
     * onResult  function (result) yang dipanggil setiap kali pengukuran selesai; result sama
     * seperti di measure()
     * Mengembalikan function remove().
     */
    export function addMeasureControl(id: string, options?: Record<string, any>): any;
    /**
     * Menempelkan gambar (PNG, JPG, SVG - misalnya master plan atau hasil scan denah) di peta,
     * di atas peta dasar dan di bawah data. Gambar ikut bergeser dan di-zoom bersama peta.
     * Letaknya ditentukan salah satu dari:
     * options.corners   [kiri-atas, kanan-atas, kiri-bawah] gambar, masing-masing [lng, lat].
     * Tiga titik ini cukup untuk rotasi, skala, dan miring sekaligus.
     * options.bounds    [minLng, minLat, maxLng, maxLat], ditambah options.rotation (derajat,
     * searah jarum jam, berputar di tengah gambar)
     * Untuk menggeoreferensikan dari titik kontrol (piksel gambar <-> [lng, lat]), buat
     * transformasinya dengan createAffineTransform dari geomeasure.js lalu hitung ketiga sudutnya.
     * options lainnya: opacity (0..1, default 1), crossOrigin (true kalau gambarnya dari domain
     * lain dan ingin ikut di exportMapImage; servernya harus mengizinkan CORS), alt.
     * Mengembalikan { setCorners(corners), setBounds(bounds, rotation), setOpacity(opacity), remove() }.
     */
    export function addImageOverlay(id: string, url: string, options?: Record<string, any>): any;
    /**
     * Mengekspor tampilan peta saat ini menjadi gambar PNG, misalnya untuk laporan.
     * Yang ikut: peta dasar, gambar overlay, semua lapisan GeoJSON (SVG dan canvas), label fitur,
     * marker, gelembung mapcluster.js, penanda lokasi, hasil alat ukur, garis skala, dan teks
     * atribusi. Label dan elemen HTML digambar dari CSS-nya: latar, garis tepi, sudut membulat,
     * padding, isi ::before/::after, dan text-shadow sebagai halo. Bayangan kotak (box-shadow),
     * gradien, dan transform berputar tidak ikut. Popup dan tombol kontrol juga tidak ikut.
     * Tile peta dasar dimuat ulang dengan CORS; tile dari server yang tidak mengizinkan CORS
     * dilewati (OpenStreetMap dan Esri mengizinkan).
     * responseFunction(blob, info) dipanggil sekali: blob PNG (atau null kalau gagal) dan
     * info { width, height, missingImages } - missingImages = jumlah gambar yang dilewati.
     * options (semua opsional):
     * scale        kelipatan resolusi. Default devicePixelRatio layar (2 di layar retina).
     * attribution  false = tanpa teks atribusi (wajib ada untuk OpenStreetMap - jangan dibuang
     * kalau gambarnya dipublikasikan)
     */
    export function exportMapImage(id: string, responseFunction?: (...args: any[]) => any, options?: Record<string, any>): any;
    /**
     * Mengekspor tampilan peta (seperti exportMapImage) lalu langsung mengunduhnya sebagai file.
     * filename default "peta.png". responseFunction (opsional) menerima hasil yang sama dengan
     * exportMapImage.
     */
    export function downloadMapImage(id: string, filename?: string, responseFunction?: (...args: any[]) => any, options?: Record<string, any>): any;
}

declare module "https://cdn.jsdelivr.net/gh/crootjs/lib@*/model3d.js" {
    /**
     * Membuat penampil 3D di dalam elemen id (biasanya <div> yang sudah diberi tinggi lewat CSS).
     * options (semua opsional):
     * background  warna atau gradasi CSS latar. Default abu-abu terang bergradasi.
     * "transparent" = latar halaman terlihat.
     * autoRotate  derajat per detik model berputar sendiri; berhenti begitu pengguna menyentuhnya.
     * fov         sudut pandang vertikal kamera, derajat. Default 45.
     * controls    false = tanpa orbit/zoom/geser dari pengguna. Default true.
     * webgl       1 = paksa WebGL1 (untuk menguji cadangan). Default WebGL2, cadangan WebGL1.
     * dracoDecoder  folder dekoder Draco (draco_wasm_wrapper_gltf.js + draco_decoder_gltf.wasm)
     * untuk model terkompresi Draco. Default dari www.gstatic.com; isi dengan folder
     * sendiri kalau aplikasinya harus jalan tanpa server Google.
     */
    export function createViewer(id: string, options?: Record<string, any>): any;
    /**
     * Memuat model glTF 2.0 dan menggantikan model sebelumnya. source: URL file .glb/.gltf,
     * File/Blob (misalnya dari <input type="file">), atau ArrayBuffer.
     * responseFunction(info, error) dipanggil setelah model tampil:
     * info = { parts: [nama bagian], triangles, bounds: { min, max, center, size } }, atau
     * null kalau gagal - error berisi alasannya (juga dicetak di console).
     * Juga mengembalikan Promise berisi info yang sama, jadi bisa di-await.
     */
    export function loadModel(id: string, source: any, responseFunction?: (...args: any[]) => any): Promise<{ parts: string[]; triangles: number; bounds: { min: number[]; max: number[]; center: number[]; size: number[] } | null } | null>;
    /**
     * Menghapus model dari penampil. Penampilnya tetap, siap memuat model lain.
     */
    export function clearModel(id: string): any;
    /**
     * Menghapus penampil dari elemennya, beserta konteks WebGL-nya.
     */
    export function removeViewer(id: string): any;
    /**
     * Daftar semua bagian (node) model, urut seperti pohonnya:
     * [{ name, mesh, parent, depth, visible }]. depth = kedalaman di pohon (0 = paling atas).
     */
    export function getParts(id: string): any;
    /**
     * Mengganti warna sebuah bagian beserta bagian di bawahnya. color: warna CSS ("#ff0000",
     * "red", "rgba(255, 0, 0, 0.5)") atau [r, g, b, a] 0..1; null = kembali ke warna aslinya.
     * Warna dengan alpha < 1 membuatnya transparan. Mengembalikan false kalau bagiannya tidak ada.
     */
    export function setPartColor(id: string, name: string, color: any): any;
    /**
     * Menampilkan atau menyembunyikan sebuah bagian beserta bagian di bawahnya.
     */
    export function setPartVisible(id: string, name: string, visible: any): any;
    /**
     * Menandai bagian yang sedang dipilih dengan warna biru. null = hapus tanda.
     */
    export function highlightPart(id: string, name: string): any;
    /**
     * Posisi, rotasi, dan skala sebuah bagian relatif terhadap induknya:
     * { position: [x, y, z], rotation: [x, y, z] derajat (Euler XYZ), quaternion, scale }.
     */
    export function getPartTransform(id: string, name: string): any;
    /**
     * Mengubah posisi, rotasi, dan/atau skala sebuah bagian (yang diisi saja). rotation =
     * [x, y, z] derajat (Euler XYZ) atau quaternion [x, y, z, w]; scale = angka atau [x, y, z].
     */
    export function setPartTransform(id: string, name: string, transform?: Record<string, any>): any;
    /**
     * runFunction(hit) setiap kali model diklik atau di-tap (bukan digeser). hit = { part, mesh,
     * path, position, distance }: part = nama bagian yang kena, path = nama-nama dari bagian
     * teratas sampai bagian itu, position = titik yang kena [x, y, z]. null kalau yang diklik
     * latarnya. Mengembalikan function stop().
     */
    export function onModelClick(id: string, runFunction?: (...args: any[]) => any): any;
    /**
     * Menggerakkan kamera supaya seluruh model - atau bagian name saja - pas di layar.
     * name boleh juga array nama: semua bagian itu dibuat muat sekaligus.
     */
    export function fitView(id: string, name: string): any;
    /**
     * Mengatur kamera: { yaw, pitch, distance, target } - yang diisi saja. yaw = sudut keliling
     * (derajat, 0 = dari depan/+Z), pitch = sudut dari atas (derajat, -89..89), distance = jarak
     * ke target, target = [x, y, z] titik yang dilihat. animate: false = langsung pindah.
     */
    export function setCameraView(id: string, view?: Record<string, any>, animate?: boolean): any;
    /**
     * Kamera sekarang: { yaw, pitch, distance, target } (sudut dalam derajat).
     */
    export function getCameraView(id: string): any;
    /**
     * Memutar model terus-menerus (derajat per detik), 0 = berhenti.
     */
    export function setAutoRotate(id: string, degreesPerSecond: any): any;
}

declare module "https://cdn.jsdelivr.net/gh/crootjs/lib@*/model3d.min.js" {
    /**
     * Membuat penampil 3D di dalam elemen id (biasanya <div> yang sudah diberi tinggi lewat CSS).
     * options (semua opsional):
     * background  warna atau gradasi CSS latar. Default abu-abu terang bergradasi.
     * "transparent" = latar halaman terlihat.
     * autoRotate  derajat per detik model berputar sendiri; berhenti begitu pengguna menyentuhnya.
     * fov         sudut pandang vertikal kamera, derajat. Default 45.
     * controls    false = tanpa orbit/zoom/geser dari pengguna. Default true.
     * webgl       1 = paksa WebGL1 (untuk menguji cadangan). Default WebGL2, cadangan WebGL1.
     * dracoDecoder  folder dekoder Draco (draco_wasm_wrapper_gltf.js + draco_decoder_gltf.wasm)
     * untuk model terkompresi Draco. Default dari www.gstatic.com; isi dengan folder
     * sendiri kalau aplikasinya harus jalan tanpa server Google.
     */
    export function createViewer(id: string, options?: Record<string, any>): any;
    /**
     * Memuat model glTF 2.0 dan menggantikan model sebelumnya. source: URL file .glb/.gltf,
     * File/Blob (misalnya dari <input type="file">), atau ArrayBuffer.
     * responseFunction(info, error) dipanggil setelah model tampil:
     * info = { parts: [nama bagian], triangles, bounds: { min, max, center, size } }, atau
     * null kalau gagal - error berisi alasannya (juga dicetak di console).
     * Juga mengembalikan Promise berisi info yang sama, jadi bisa di-await.
     */
    export function loadModel(id: string, source: any, responseFunction?: (...args: any[]) => any): Promise<{ parts: string[]; triangles: number; bounds: { min: number[]; max: number[]; center: number[]; size: number[] } | null } | null>;
    /**
     * Menghapus model dari penampil. Penampilnya tetap, siap memuat model lain.
     */
    export function clearModel(id: string): any;
    /**
     * Menghapus penampil dari elemennya, beserta konteks WebGL-nya.
     */
    export function removeViewer(id: string): any;
    /**
     * Daftar semua bagian (node) model, urut seperti pohonnya:
     * [{ name, mesh, parent, depth, visible }]. depth = kedalaman di pohon (0 = paling atas).
     */
    export function getParts(id: string): any;
    /**
     * Mengganti warna sebuah bagian beserta bagian di bawahnya. color: warna CSS ("#ff0000",
     * "red", "rgba(255, 0, 0, 0.5)") atau [r, g, b, a] 0..1; null = kembali ke warna aslinya.
     * Warna dengan alpha < 1 membuatnya transparan. Mengembalikan false kalau bagiannya tidak ada.
     */
    export function setPartColor(id: string, name: string, color: any): any;
    /**
     * Menampilkan atau menyembunyikan sebuah bagian beserta bagian di bawahnya.
     */
    export function setPartVisible(id: string, name: string, visible: any): any;
    /**
     * Menandai bagian yang sedang dipilih dengan warna biru. null = hapus tanda.
     */
    export function highlightPart(id: string, name: string): any;
    /**
     * Posisi, rotasi, dan skala sebuah bagian relatif terhadap induknya:
     * { position: [x, y, z], rotation: [x, y, z] derajat (Euler XYZ), quaternion, scale }.
     */
    export function getPartTransform(id: string, name: string): any;
    /**
     * Mengubah posisi, rotasi, dan/atau skala sebuah bagian (yang diisi saja). rotation =
     * [x, y, z] derajat (Euler XYZ) atau quaternion [x, y, z, w]; scale = angka atau [x, y, z].
     */
    export function setPartTransform(id: string, name: string, transform?: Record<string, any>): any;
    /**
     * runFunction(hit) setiap kali model diklik atau di-tap (bukan digeser). hit = { part, mesh,
     * path, position, distance }: part = nama bagian yang kena, path = nama-nama dari bagian
     * teratas sampai bagian itu, position = titik yang kena [x, y, z]. null kalau yang diklik
     * latarnya. Mengembalikan function stop().
     */
    export function onModelClick(id: string, runFunction?: (...args: any[]) => any): any;
    /**
     * Menggerakkan kamera supaya seluruh model - atau bagian name saja - pas di layar.
     * name boleh juga array nama: semua bagian itu dibuat muat sekaligus.
     */
    export function fitView(id: string, name: string): any;
    /**
     * Mengatur kamera: { yaw, pitch, distance, target } - yang diisi saja. yaw = sudut keliling
     * (derajat, 0 = dari depan/+Z), pitch = sudut dari atas (derajat, -89..89), distance = jarak
     * ke target, target = [x, y, z] titik yang dilihat. animate: false = langsung pindah.
     */
    export function setCameraView(id: string, view?: Record<string, any>, animate?: boolean): any;
    /**
     * Kamera sekarang: { yaw, pitch, distance, target } (sudut dalam derajat).
     */
    export function getCameraView(id: string): any;
    /**
     * Memutar model terus-menerus (derajat per detik), 0 = berhenti.
     */
    export function setAutoRotate(id: string, degreesPerSecond: any): any;
}

declare module "https://cdn.jsdelivr.net/gh/crootjs/lib@*/model3dtools.js" {
    /**
     * Menempelkan elemen HTML (atau teks) ke sebuah titik pada model; posisinya ikut saat model
     * diputar, di-zoom, atau bagiannya digeser.
     * anchor: nama bagian (menempel di tengah bagian itu dan ikut kalau bagiannya dipindah),
     * atau [x, y, z] koordinat model.
     * content: elemen DOM (dipindah ke atas penampil) atau teks.
     * options (semua opsional):
     * at       "center" (bawaan) atau "top": titik tengah, atau tengah sisi atas bagian itu.
     * offset   [x, y, z] tambahan dalam satuan model, misalnya [0, 0.5, 0].
     * occlude  false = tetap jelas walau titiknya tertutup model. Bawaan: diredupkan
     * (kelas crootjs-3d-hotspot-hidden).
     * onClick  function () saat hotspot diklik.
     * className kelas CSS tambahan.
     * Mengembalikan function remove().
     */
    export function addHotspot(id: string, anchor: any, content: any, options?: Record<string, any>): any;
    /**
     * Menampilkan gizmo di sebuah bagian supaya bisa digeser, diputar, atau diskala langsung di
     * layar. Hanya satu gizmo per penampil: memanggil lagi memindahkan gizmo ke bagian lain.
     * mode: "translate" (panah sumbu), "rotate" (cincin; tahan Shift = kelipatan 15 derajat),
     * atau "scale" (sumbu, plus titik tengah untuk skala seragam).
     * onChange(info) dipanggil selama digeser dan sekali lagi saat dilepas:
     * info = { part, position, rotation, quaternion, scale, dragging } - sama dengan
     * getPartTransform, dragging = false pada panggilan terakhir.
     * Sumbu geser dan putar mengikuti sumbu induk bagiannya (sama dengan nilai position dan
     * rotation-nya); sumbu skala mengikuti bagian itu sendiri.
     * Mengembalikan { setMode(mode), remove() }.
     */
    export function enableTransform(id: string, name: string, mode?: string, onChange?: any): any;
    /**
     * Daftar animasi di model: [{ index, name, duration }] (duration dalam detik).
     */
    export function getAnimations(id: string): any;
    /**
     * Memutar animasi yang tersimpan di file glTF. animation: nama atau nomor urut (bawaan 0).
     * options (semua opsional):
     * loop      false = berhenti di akhir. Bawaan true.
     * speed     kecepatan, 1 = normal, 0.5 = setengah.
     * autoplay  false = siap tapi belum jalan.
     * onUpdate  function (time, duration) setiap frame, misalnya untuk menggerakkan slider.
     * onEnd     function () saat selesai (hanya kalau loop: false).
     * Mengembalikan { play(), pause(), stop(), seek(seconds), setSpeed(speed), isPlaying(),
     * time(), duration } - stop() mengembalikan bagian-bagiannya ke posisi semula.
     */
    export function playAnimation(id: string, animation?: number, options?: Record<string, any>): any;
    /**
     * Memisahkan bagian-bagian model menjauh dari pusatnya, seperti gambar perakitan.
     * amount: 0 = rapat (posisi semula), 1 = terpisah penuh; nilai di antaranya boleh, misalnya
     * dari slider. options (semua opsional):
     * part      nama bagian yang anak-anaknya dipisahkan. Bawaan: tingkat pertama yang bercabang.
     * distance  pengali jarak. Bawaan 1: pada amount 1, jarak tiap bagian dari pusat jadi 2x.
     * animate   false = langsung, tanpa animasi (pakai ini untuk nilai dari slider).
     */
    export function explodeModel(id: string, amount: any, options?: Record<string, any>): any;
    /**
     * Memotong model dengan sebuah bidang untuk melihat bagian dalamnya. Sisi yang terpotong
     * tidak digambar dan tidak bisa diklik; permukaan potongnya diwarnai rata.
     * options (semua opsional):
     * axis      "x" (bawaan: bidang tegak, membelah kiri-kanan), "y" (mendatar), atau "z";
     * atau normal [x, y, z] untuk bidang miring.
     * position  letak bidang di sepanjang sumbu itu: 0 = ujung bawah model, 1 = ujung atas.
     * Bawaan 0.5 (tengah).
     * flip      true = buang sisi sebaliknya.
     * color     warna CSS permukaan potong. Bawaan: warna bagian itu, digelapkan.
     * Hanya satu potongan per penampil. Mengembalikan { set(options), remove() } - set mengubah
     * sebagian opsi, misalnya { position } dari slider.
     */
    export function addSection(id: string, options?: Record<string, any>): any;
    /**
     * Tautan yang membuka model di Scene Viewer (aplikasi AR Google di Android): model tampil di
     * ruangan lewat kamera, bisa digeser dan diputar. url harus .glb/.gltf yang bisa diunduh publik
     * lewat HTTPS (bukan blob: atau file lokal). options: title, mode ("ar_preferred" bawaan,
     * "ar_only", "3d_only"), fallback (URL kalau Scene Viewer tidak ada; bawaan halaman ini).
     */
    export function getARLink(url: string, options?: Record<string, any>): any;
    /**
     * Tombol "Lihat di AR" di pojok penampil. Di Android membuka Scene Viewer dengan url; di iPhone
     * dan iPad membuka AR Quick Look - tapi hanya kalau options.usdz diisi (Quick Look tidak bisa
     * membuka .glb; ubah dulu ke .usdz, misalnya dengan Reality Converter). Di perangkat lain
     * tombolnya tidak ditambahkan.
     * options: title, usdz, label (bawaan "Lihat di AR"), mode, fallback.
     * Mengembalikan { supported, remove() } - supported = false kalau tombolnya tidak ditambahkan.
     */
    export function addARButton(id: string, url: string, options?: Record<string, any>): any;
    /**
     * Mengekspor model yang sedang tampil, beserta semua perubahannya (posisi, rotasi, skala,
     * warna, bagian yang disembunyikan), sebagai file .glb.
     * responseFunction(blob) - blob = Blob .glb, atau null kalau belum ada model. Juga
     * mengembalikan Promise berisi blob yang sama.
     */
    export function exportGLB(id: string, responseFunction?: (...args: any[]) => any): Promise<Blob | null>;
    /**
     * exportGLB lalu langsung mengunduhnya sebagai filename.
     */
    export function downloadGLB(id: string, filename?: string, responseFunction?: (...args: any[]) => any): Promise<Blob | null>;
}

declare module "https://cdn.jsdelivr.net/gh/crootjs/lib@*/model3dtools.min.js" {
    /**
     * Menempelkan elemen HTML (atau teks) ke sebuah titik pada model; posisinya ikut saat model
     * diputar, di-zoom, atau bagiannya digeser.
     * anchor: nama bagian (menempel di tengah bagian itu dan ikut kalau bagiannya dipindah),
     * atau [x, y, z] koordinat model.
     * content: elemen DOM (dipindah ke atas penampil) atau teks.
     * options (semua opsional):
     * at       "center" (bawaan) atau "top": titik tengah, atau tengah sisi atas bagian itu.
     * offset   [x, y, z] tambahan dalam satuan model, misalnya [0, 0.5, 0].
     * occlude  false = tetap jelas walau titiknya tertutup model. Bawaan: diredupkan
     * (kelas crootjs-3d-hotspot-hidden).
     * onClick  function () saat hotspot diklik.
     * className kelas CSS tambahan.
     * Mengembalikan function remove().
     */
    export function addHotspot(id: string, anchor: any, content: any, options?: Record<string, any>): any;
    /**
     * Menampilkan gizmo di sebuah bagian supaya bisa digeser, diputar, atau diskala langsung di
     * layar. Hanya satu gizmo per penampil: memanggil lagi memindahkan gizmo ke bagian lain.
     * mode: "translate" (panah sumbu), "rotate" (cincin; tahan Shift = kelipatan 15 derajat),
     * atau "scale" (sumbu, plus titik tengah untuk skala seragam).
     * onChange(info) dipanggil selama digeser dan sekali lagi saat dilepas:
     * info = { part, position, rotation, quaternion, scale, dragging } - sama dengan
     * getPartTransform, dragging = false pada panggilan terakhir.
     * Sumbu geser dan putar mengikuti sumbu induk bagiannya (sama dengan nilai position dan
     * rotation-nya); sumbu skala mengikuti bagian itu sendiri.
     * Mengembalikan { setMode(mode), remove() }.
     */
    export function enableTransform(id: string, name: string, mode?: string, onChange?: any): any;
    /**
     * Daftar animasi di model: [{ index, name, duration }] (duration dalam detik).
     */
    export function getAnimations(id: string): any;
    /**
     * Memutar animasi yang tersimpan di file glTF. animation: nama atau nomor urut (bawaan 0).
     * options (semua opsional):
     * loop      false = berhenti di akhir. Bawaan true.
     * speed     kecepatan, 1 = normal, 0.5 = setengah.
     * autoplay  false = siap tapi belum jalan.
     * onUpdate  function (time, duration) setiap frame, misalnya untuk menggerakkan slider.
     * onEnd     function () saat selesai (hanya kalau loop: false).
     * Mengembalikan { play(), pause(), stop(), seek(seconds), setSpeed(speed), isPlaying(),
     * time(), duration } - stop() mengembalikan bagian-bagiannya ke posisi semula.
     */
    export function playAnimation(id: string, animation?: number, options?: Record<string, any>): any;
    /**
     * Memisahkan bagian-bagian model menjauh dari pusatnya, seperti gambar perakitan.
     * amount: 0 = rapat (posisi semula), 1 = terpisah penuh; nilai di antaranya boleh, misalnya
     * dari slider. options (semua opsional):
     * part      nama bagian yang anak-anaknya dipisahkan. Bawaan: tingkat pertama yang bercabang.
     * distance  pengali jarak. Bawaan 1: pada amount 1, jarak tiap bagian dari pusat jadi 2x.
     * animate   false = langsung, tanpa animasi (pakai ini untuk nilai dari slider).
     */
    export function explodeModel(id: string, amount: any, options?: Record<string, any>): any;
    /**
     * Memotong model dengan sebuah bidang untuk melihat bagian dalamnya. Sisi yang terpotong
     * tidak digambar dan tidak bisa diklik; permukaan potongnya diwarnai rata.
     * options (semua opsional):
     * axis      "x" (bawaan: bidang tegak, membelah kiri-kanan), "y" (mendatar), atau "z";
     * atau normal [x, y, z] untuk bidang miring.
     * position  letak bidang di sepanjang sumbu itu: 0 = ujung bawah model, 1 = ujung atas.
     * Bawaan 0.5 (tengah).
     * flip      true = buang sisi sebaliknya.
     * color     warna CSS permukaan potong. Bawaan: warna bagian itu, digelapkan.
     * Hanya satu potongan per penampil. Mengembalikan { set(options), remove() } - set mengubah
     * sebagian opsi, misalnya { position } dari slider.
     */
    export function addSection(id: string, options?: Record<string, any>): any;
    /**
     * Tautan yang membuka model di Scene Viewer (aplikasi AR Google di Android): model tampil di
     * ruangan lewat kamera, bisa digeser dan diputar. url harus .glb/.gltf yang bisa diunduh publik
     * lewat HTTPS (bukan blob: atau file lokal). options: title, mode ("ar_preferred" bawaan,
     * "ar_only", "3d_only"), fallback (URL kalau Scene Viewer tidak ada; bawaan halaman ini).
     */
    export function getARLink(url: string, options?: Record<string, any>): any;
    /**
     * Tombol "Lihat di AR" di pojok penampil. Di Android membuka Scene Viewer dengan url; di iPhone
     * dan iPad membuka AR Quick Look - tapi hanya kalau options.usdz diisi (Quick Look tidak bisa
     * membuka .glb; ubah dulu ke .usdz, misalnya dengan Reality Converter). Di perangkat lain
     * tombolnya tidak ditambahkan.
     * options: title, usdz, label (bawaan "Lihat di AR"), mode, fallback.
     * Mengembalikan { supported, remove() } - supported = false kalau tombolnya tidak ditambahkan.
     */
    export function addARButton(id: string, url: string, options?: Record<string, any>): any;
    /**
     * Mengekspor model yang sedang tampil, beserta semua perubahannya (posisi, rotasi, skala,
     * warna, bagian yang disembunyikan), sebagai file .glb.
     * responseFunction(blob) - blob = Blob .glb, atau null kalau belum ada model. Juga
     * mengembalikan Promise berisi blob yang sama.
     */
    export function exportGLB(id: string, responseFunction?: (...args: any[]) => any): Promise<Blob | null>;
    /**
     * exportGLB lalu langsung mengunduhnya sebagai filename.
     */
    export function downloadGLB(id: string, filename?: string, responseFunction?: (...args: any[]) => any): Promise<Blob | null>;
}

declare module "https://cdn.jsdelivr.net/gh/crootjs/lib@*/storage.js" {
    /**
     * Fungsi untuk menyimpan data ke localStorage tanpa kadaluwarsa
     */
    export function setLocal(key: string, value: any): any;
    /**
     * Fungsi untuk menyimpan data ke localStorage dengan hari kadaluwarsa
     */
    export function setLocalWithExpireDay(key: string, value: any, exdays: any): any;
    /**
     * Fungsi untuk menyimpan data ke localStorage dengan jam kadaluwarsa
     */
    export function setLocalWithExpireHour(key: string, value: any, exhour: any): any;
    /**
     * Fungsi untuk menyimpan data ke localStorage dengan detik kadaluwarsa
     */
    export function setLocalWithExpireSecond(key: string, value: any, exsecs: any): any;
    /**
     * Fungsi untuk mengambil data dari localStorage (null jika tidak ada atau sudah kadaluwarsa)
     */
    export function getLocal(key: string): any;
    /**
     * Fungsi untuk menghapus data dari localStorage
     */
    export function deleteLocal(key: string): any;
    /**
     * Fungsi untuk menyimpan data ke sessionStorage
     */
    export function setSession(key: string, value: any): any;
    /**
     * Fungsi untuk mengambil data dari sessionStorage
     */
    export function getSession(key: string): any;
    /**
     * Fungsi untuk menghapus data dari sessionStorage
     */
    export function deleteSession(key: string): any;
}

declare module "https://cdn.jsdelivr.net/gh/crootjs/lib@*/storage.min.js" {
    /**
     * Fungsi untuk menyimpan data ke localStorage tanpa kadaluwarsa
     */
    export function setLocal(key: string, value: any): any;
    /**
     * Fungsi untuk menyimpan data ke localStorage dengan hari kadaluwarsa
     */
    export function setLocalWithExpireDay(key: string, value: any, exdays: any): any;
    /**
     * Fungsi untuk menyimpan data ke localStorage dengan jam kadaluwarsa
     */
    export function setLocalWithExpireHour(key: string, value: any, exhour: any): any;
    /**
     * Fungsi untuk menyimpan data ke localStorage dengan detik kadaluwarsa
     */
    export function setLocalWithExpireSecond(key: string, value: any, exsecs: any): any;
    /**
     * Fungsi untuk mengambil data dari localStorage (null jika tidak ada atau sudah kadaluwarsa)
     */
    export function getLocal(key: string): any;
    /**
     * Fungsi untuk menghapus data dari localStorage
     */
    export function deleteLocal(key: string): any;
    /**
     * Fungsi untuk menyimpan data ke sessionStorage
     */
    export function setSession(key: string, value: any): any;
    /**
     * Fungsi untuk mengambil data dari sessionStorage
     */
    export function getSession(key: string): any;
    /**
     * Fungsi untuk menghapus data dari sessionStorage
     */
    export function deleteSession(key: string): any;
}

declare module "https://cdn.jsdelivr.net/gh/crootjs/lib@*/stp.js" {
    export function sendSTP(phoneNumber: any, captchaToken: any): Promise<any>;
    export function verifySTP(phoneNumber: any, password: any): Promise<any>;
    export function resendSTP(phoneNumber: any): Promise<any>;
}

declare module "https://cdn.jsdelivr.net/gh/crootjs/lib@*/stp.min.js" {
    export function sendSTP(phoneNumber: any, captchaToken: any): Promise<any>;
    export function verifySTP(phoneNumber: any, password: any): Promise<any>;
    export function resendSTP(phoneNumber: any): Promise<any>;
}

declare module "https://cdn.jsdelivr.net/gh/crootjs/lib@*/template.js" {
    export const refreshbutton: any;
    export const loginbutton: any;
}

declare module "https://cdn.jsdelivr.net/gh/crootjs/lib@*/template.min.js" {
    export const refreshbutton: any;
    export const loginbutton: any;
}

declare module "https://cdn.jsdelivr.net/gh/crootjs/lib@*/toast.js" {
    /**
     * Menampilkan notifikasi toast. type: "info" (default) | "success" | "error" | "warning".
     * duration dalam ms; 0 berarti tidak otomatis hilang (dismiss manual lewat function yang dikembalikan).
     * Mengembalikan function dismiss() untuk menutup toast ini secara manual kapan saja.
     */
    export function toast(message: any, type?: string, duration?: number): any;
    export function toastSuccess(message: any, duration: any): any;
    export function toastError(message: any, duration: any): any;
    export function toastWarning(message: any, duration: any): any;
    export function toastInfo(message: any, duration: any): any;
}

declare module "https://cdn.jsdelivr.net/gh/crootjs/lib@*/toast.min.js" {
    /**
     * Menampilkan notifikasi toast. type: "info" (default) | "success" | "error" | "warning".
     * duration dalam ms; 0 berarti tidak otomatis hilang (dismiss manual lewat function yang dikembalikan).
     * Mengembalikan function dismiss() untuk menutup toast ini secara manual kapan saja.
     */
    export function toast(message: any, type?: string, duration?: number): any;
    export function toastSuccess(message: any, duration: any): any;
    export function toastError(message: any, duration: any): any;
    export function toastWarning(message: any, duration: any): any;
    export function toastInfo(message: any, duration: any): any;
}

declare module "https://cdn.jsdelivr.net/gh/crootjs/lib@*/trace.js" {
    /**
     * document.addEventListener('click', tapClick);
     * document.addEventListener('touchstart', tapClick);
     * document.addEventListener('touchmove', tapClick);
     */
    export function tapClick(event: any): any;
}

declare module "https://cdn.jsdelivr.net/gh/crootjs/lib@*/trace.min.js" {
    /**
     * document.addEventListener('click', tapClick);
     * document.addEventListener('touchstart', tapClick);
     * document.addEventListener('touchmove', tapClick);
     */
    export function tapClick(event: any): any;
}

declare module "https://cdn.jsdelivr.net/gh/crootjs/lib@*/url.js" {
    export function getProtocol(): any;
    export function getHost(): any;
    export function fullPath(): any;
    export function folderPath(): any;
    export function getPath(): any;
    export function getQueryString(): any;
    export function setQueryString(key: string, value: any): any;
    export function getHash(): any;
    export function setHash(hashvalue: any): any;
    export function redirect(URL: string): any;
    export function onHashChange(runFunctionEvent: any): any;
}

declare module "https://cdn.jsdelivr.net/gh/crootjs/lib@*/url.min.js" {
    export function getProtocol(): any;
    export function getHost(): any;
    export function fullPath(): any;
    export function folderPath(): any;
    export function getPath(): any;
    export function getQueryString(): any;
    export function setQueryString(key: string, value: any): any;
    export function getHash(): any;
    export function setHash(hashvalue: any): any;
    export function redirect(URL: string): any;
    export function onHashChange(runFunctionEvent: any): any;
}

declare module "https://cdn.jsdelivr.net/gh/crootjs/lib@*/useragent.js" {
    export function isMobile(): any;
}

declare module "https://cdn.jsdelivr.net/gh/crootjs/lib@*/useragent.min.js" {
    export function isMobile(): any;
}

declare module "https://cdn.jsdelivr.net/gh/crootjs/lib@*/validate.js" {
    /**
     * Fungsi untuk memproses input
     */
    export function validateUserName(input: any): any;
    export function validateHouseNumber(input: any): any;
    /**
     * Fungsi validasi nomor telepon
     */
    export function validatePhoneNumber(input: any): any;
    /**
     * const harga=getAttributeValue('id','data-value');
     */
    export function formatRupiah(input: any): any;
}

declare module "https://cdn.jsdelivr.net/gh/crootjs/lib@*/validate.min.js" {
    /**
     * Fungsi untuk memproses input
     */
    export function validateUserName(input: any): any;
    export function validateHouseNumber(input: any): any;
    /**
     * Fungsi validasi nomor telepon
     */
    export function validatePhoneNumber(input: any): any;
    /**
     * const harga=getAttributeValue('id','data-value');
     */
    export function formatRupiah(input: any): any;
}

declare module "https://cdn.jsdelivr.net/gh/crootjs/lib@*/websocket.js" {
    export function openWebSocketSetId(id: string, url_ws: any, onMessage: any): any;
    export function connectws(id: string, url_ws: any, onMessage: any): any;
    export function closeWebSocket(wsocket: any): any;
    export function sendMessagetoWebSocket(msg: any, wsocket: any): any;
}

declare module "https://cdn.jsdelivr.net/gh/crootjs/lib@*/websocket.min.js" {
    export function openWebSocketSetId(id: string, url_ws: any, onMessage: any): any;
    export function connectws(id: string, url_ws: any, onMessage: any): any;
    export function closeWebSocket(wsocket: any): any;
    export function sendMessagetoWebSocket(msg: any, wsocket: any): any;
}
