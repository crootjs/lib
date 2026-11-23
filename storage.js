// Mode privat atau pengaturan privasi yang ketat membuat localStorage/sessionStorage melempar
// SecurityError saat diakses, dan penyimpanan yang penuh melempar QuotaExceededError. Semua
// fungsi modul ini menelannya: baca memberi null, simpan memberi false, supaya halaman tetap jalan.
const warned = new Set(); // peringatan sekali per jenis penyimpanan, bukan setiap panggilan

function useStorage(name, action, fallback) {
    try {
        return action(window[name]);
    } catch (error) {
        if (!warned.has(name)) console.warn(`${name} tidak bisa dipakai:`, error.message);
        warned.add(name);
        return fallback;
    }
}

function writeStorage(name, key, value, expiresAt) {
    return useStorage(name, storage => {
        storage.setItem(key, JSON.stringify({ value, expiresAt }));
        return true;
    }, false);
}

function readStorage(name, key) {
    return useStorage(name, storage => {
        const raw = storage.getItem(key);
        if (raw === null) return null;
        let parsed;
        try {
            parsed = JSON.parse(raw);
        } catch {
            return null;
        }
        if (parsed.expiresAt !== null && new Date().getTime() > parsed.expiresAt) {
            storage.removeItem(key);
            return null;
        }
        return parsed.value;
    }, null);
}

function removeStorage(name, key) {
    useStorage(name, storage => storage.removeItem(key));
}

// Fungsi setLocal*/setSession mengembalikan true kalau tersimpan, false kalau penyimpanan diblokir atau penuh.

// Fungsi untuk menyimpan data ke localStorage tanpa kadaluwarsa
export function setLocal(key, value) {
    return writeStorage("localStorage", key, value, null);
}

// Fungsi untuk menyimpan data ke localStorage dengan hari kadaluwarsa
export function setLocalWithExpireDay(key, value, exdays) {
    return writeStorage("localStorage", key, value, new Date().getTime() + (exdays * 24 * 60 * 60 * 1000));
}

// Fungsi untuk menyimpan data ke localStorage dengan jam kadaluwarsa
export function setLocalWithExpireHour(key, value, exhour) {
    return writeStorage("localStorage", key, value, new Date().getTime() + (exhour * 60 * 60 * 1000));
}

// Fungsi untuk menyimpan data ke localStorage dengan detik kadaluwarsa
export function setLocalWithExpireSecond(key, value, exsecs) {
    return writeStorage("localStorage", key, value, new Date().getTime() + (exsecs * 1000));
}

// Fungsi untuk mengambil data dari localStorage (null jika tidak ada atau sudah kadaluwarsa)
export function getLocal(key) {
    return readStorage("localStorage", key);
}

// Fungsi untuk menghapus data dari localStorage
export function deleteLocal(key) {
    removeStorage("localStorage", key);
}

// Fungsi untuk menyimpan data ke sessionStorage
export function setSession(key, value) {
    return writeStorage("sessionStorage", key, value, null);
}

// Fungsi untuk mengambil data dari sessionStorage
export function getSession(key) {
    return readStorage("sessionStorage", key);
}

// Fungsi untuk menghapus data dari sessionStorage
export function deleteSession(key) {
    removeStorage("sessionStorage", key);
}
