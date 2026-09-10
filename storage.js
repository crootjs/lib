function writeStorage(storage, key, value, expiresAt) {
    storage.setItem(key, JSON.stringify({ value, expiresAt }));
}

function readStorage(storage, key) {
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
}

// Fungsi untuk menyimpan data ke localStorage tanpa kadaluwarsa
export function setLocal(key, value) {
    writeStorage(localStorage, key, value, null);
}

// Fungsi untuk menyimpan data ke localStorage dengan hari kadaluwarsa
export function setLocalWithExpireDay(key, value, exdays) {
    writeStorage(localStorage, key, value, new Date().getTime() + (exdays * 24 * 60 * 60 * 1000));
}

// Fungsi untuk menyimpan data ke localStorage dengan jam kadaluwarsa
export function setLocalWithExpireHour(key, value, exhour) {
    writeStorage(localStorage, key, value, new Date().getTime() + (exhour * 60 * 60 * 1000));
}

// Fungsi untuk menyimpan data ke localStorage dengan detik kadaluwarsa
export function setLocalWithExpireSecond(key, value, exsecs) {
    writeStorage(localStorage, key, value, new Date().getTime() + (exsecs * 1000));
}

// Fungsi untuk mengambil data dari localStorage (null jika tidak ada atau sudah kadaluwarsa)
export function getLocal(key) {
    return readStorage(localStorage, key);
}

// Fungsi untuk menghapus data dari localStorage
export function deleteLocal(key) {
    localStorage.removeItem(key);
}

// Fungsi untuk menyimpan data ke sessionStorage
export function setSession(key, value) {
    writeStorage(sessionStorage, key, value, null);
}

// Fungsi untuk mengambil data dari sessionStorage
export function getSession(key) {
    return readStorage(sessionStorage, key);
}

// Fungsi untuk menghapus data dari sessionStorage
export function deleteSession(key) {
    sessionStorage.removeItem(key);
}
