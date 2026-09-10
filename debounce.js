// Menunda eksekusi fn sampai user berhenti memicu selama delay ms.
// Cocok untuk search-as-you-type: hanya kirim request setelah user selesai mengetik.
export function debounce(fn, delay) {
    let timeoutId;
    return function (...args) {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => fn.apply(this, args), delay);
    };
}

// Membatasi eksekusi fn maksimal sekali setiap delay ms, dengan panggilan terakhir
// tetap dieksekusi setelah delay (trailing call). Cocok untuk scroll/resize/mousemove handler.
export function throttle(fn, delay) {
    let lastCall = 0;
    let timeoutId;
    return function (...args) {
        const now = Date.now();
        const remaining = delay - (now - lastCall);
        if (remaining <= 0) {
            clearTimeout(timeoutId);
            lastCall = now;
            fn.apply(this, args);
        } else {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => {
                lastCall = Date.now();
                fn.apply(this, args);
            }, remaining);
        }
    };
}
