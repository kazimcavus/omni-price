/** localStorage kota hatası mı? (tarayıcıya göre isim/kod değişiyor) */
export function isQuotaError(e: unknown): boolean {
  return (
    e instanceof DOMException &&
    (e.name === 'QuotaExceededError' ||
      e.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
      e.code === 22)
  );
}

/**
 * localStorage'a yazar; kota dolarsa kaydı silip false döner.
 * setItem'ın render/effect içinde hata fırlatıp uygulamayı beyaz ekrana
 * düşürmesini engellemek için tüm yazmalar bunun üzerinden yapılmalı.
 */
export function safeSetItem(key: string, value: unknown): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (e) {
    if (!isQuotaError(e)) {
      console.error(e);
      return false;
    }
  }
  try {
    localStorage.removeItem(key);
  } catch {
    // yoksay
  }
  return false;
}
