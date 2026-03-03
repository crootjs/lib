// Fungsi untuk memproses input
export function validateUserName(input) {
    input.value = input.value.toLowerCase(); // Convert to lowercase
    input.value = input.value.replace(/\s+/g, ''); // Remove spaces
    input.value = input.value.replace(/[^a-z0-9_-]/gi, ''); // Remove special characters except _ and -
}

export function validateHouseNumber(input) {
    // Konversi ke uppercase
    input.value = input.value.toUpperCase();

    // Hapus karakter underscore (_) dan dash (-)
    input.value = input.value.replace(/[_-]/g, '');

    // (Opsional) Hapus spasi jika kamu juga ingin bersih total
    input.value = input.value.replace(/\s+/g, '');

    // (Opsional) Kalau mau hanya huruf dan angka:
    input.value = input.value.replace(/[^A-Z0-9]/g, '');
}


// Fungsi validasi nomor telepon
export function validatePhoneNumber(input) {
    // Hanya izinkan angka
    input.value = input.value.replace(/[^0-9]/g, '');
    // Jika karakter pertama adalah 0, hapus karakter tersebut
    if (input.value.length > 1 && input.value.charAt(0) === '0') {
        input.value = '62'+input.value.substr(1);
    }
}

// const harga=getAttributeValue('id','data-value');
export function formatRupiah(input) {
    let angka = input.value.replace(/[^,\d]/g, '').toString();
    let split = angka.split(',');
    let sisa = split[0].length % 3;
    let rupiah = split[0].substr(0, sisa);
    let ribuan = split[0].substr(sisa).match(/\d{3}/gi);

    if (ribuan) {
    let separator = sisa ? '.' : '';
    rupiah += separator + ribuan.join('.');
    }

    rupiah = split[1] !== undefined ? rupiah + ',' + split[1] : rupiah;

    // Simpan nilai asli tanpa format di atribut data
    input.setAttribute('data-value', angka);

    // Tampilkan nilai yang diformat
    input.value = 'Rp. ' + rupiah;
}