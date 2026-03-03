// document.addEventListener('click', tapClick);
// document.addEventListener('touchstart', tapClick);
// document.addEventListener('touchmove', tapClick);
export function tapClick(event) {
    let targetElement = event.target;  // Elemen yang diklik atau disentuh
    console.log('Elemen yang dipicu:', targetElement);

    // Mengecek apakah ini event sentuhan
    if (event.touches && event.touches.length > 0) {
        console.log('Jumlah sentuhan aktif:', event.touches.length);
        console.log('Koordinat sentuhan pertama:', event.touches[0].clientX, event.touches[0].clientY);
    }
    
    // Mengecek apakah ini event mouse (click)
    else if (event.clientX !== null && event.clientX !== undefined) {
        console.log('Koordinat klik:', event.clientX, event.clientY);
    }
}