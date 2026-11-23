// Fungsi untuk menyimpan cookie dengan hari kadaluwarsa
export function setCookieWithExpireDay(cname, cvalue, exdays) {
  const d = new Date();
  d.setTime(d.getTime() + (exdays * 24 * 60 * 60 * 1000));
  let expires = "expires=" + d.toUTCString();
  document.cookie = encodeURIComponent(cname) + "=" + encodeURIComponent(cvalue) + ";" + expires + ";path=/";
}

// Fungsi untuk menyimpan cookie dengan jam kadaluwarsa
export function setCookieWithExpireHour(cname, cvalue, exhour) {
  const d = new Date();
  d.setTime(d.getTime() + (exhour * 60 * 60 * 1000));
  let expires = "expires=" + d.toUTCString();
  document.cookie = encodeURIComponent(cname) + "=" + encodeURIComponent(cvalue) + ";" + expires + ";path=/";
}

// Fungsi untuk menyimpan cookie dengan detik kadaluwarsa
export function setCookieWithExpireSecond(cname, cvalue, exsecs) {
  const d = new Date();
  d.setTime(d.getTime() + (exsecs * 1000));
  let expires = "expires=" + d.toUTCString();
  document.cookie = encodeURIComponent(cname) + "=" + encodeURIComponent(cvalue) + ";" + expires + ";path=/";
}

// Fungsi untuk menghapus cookie dengan cara mengatur waktu kadaluwarsa ke masa lalu
export function deleteCookie(cname) {
  document.cookie = encodeURIComponent(cname) + "= ; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
}

// Fungsi untuk mendapatkan nilai cookie berdasarkan nama
// Nama dan nilai di-decode sekali, setelah dipisah per ";" - nilai berisi ";" atau "%" yang
// disimpan setCookie* tetap utuh. Cookie dari sumber lain yang bukan hasil encodeURIComponent
// dikembalikan apa adanya.
export function getCookie(cname) {
  const decode = text => {
    try {
      return decodeURIComponent(text);
    } catch {
      return text;
    }
  };
  for (const part of document.cookie.split(";")) {
      const separator = part.indexOf("=");
      if (separator === -1) continue;
      if (decode(part.slice(0, separator).trim()) === cname) return decode(part.slice(separator + 1).trim());
  }
  return "";
}
