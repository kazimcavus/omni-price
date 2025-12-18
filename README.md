<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# OmniPrice - Akıllı Fiyat Hesaplama

OmniPrice, çoklu satış kanalları için fiyat hesaplama yapan modern bir React uygulamasıdır.

## 🚀 Yerel Çalıştırma

**Gereksinimler:** Node.js

1. Bağımlılıkları yükleyin:
   ```bash
   npm install
   ```

2. Uygulamayı çalıştırın:
   ```bash
   npm run dev
   ```

3. Tarayıcınızda `http://localhost:5173` adresini açın

## 📦 Build

Production build oluşturmak için:
```bash
npm run build
```

Build çıktısı `dist` klasöründe oluşturulur.

## 🌐 GitHub Pages'e Deploy Etme

Bu uygulama GitHub Pages'e deploy edilmek için hazırlanmıştır.

### Adımlar:

1. **Repository'yi GitHub'a push edin:**
   ```bash
   git add .
   git commit -m "GitHub Pages için hazırlandı"
   git push origin main
   ```

2. **GitHub Repository Ayarları:**
   - GitHub repository'nize gidin
   - **Settings** > **Pages** bölümüne gidin
   - **Source** olarak **GitHub Actions** seçin
   - Kaydedin

3. **Repository Adını Güncelleme:**
   Eğer repository adınız `omni-price` değilse, `vite.config.ts` dosyasındaki base path'i güncelleyin:
   ```typescript
   base: process.env.GITHUB_PAGES === 'true' ? '/your-repo-name/' : '/',
   ```

4. **Otomatik Deploy:**
   - `main` branch'ine her push yaptığınızda GitHub Actions otomatik olarak build alır ve deploy eder
   - Deploy işlemi tamamlandıktan sonra uygulamanız `https://your-username.github.io/omni-price/` adresinde yayında olacaktır

### Manuel Deploy:

Eğer manuel olarak deploy etmek isterseniz:
```bash
npm run build:gh-pages
```

Sonra `dist` klasörünün içeriğini `gh-pages` branch'ine push edebilirsiniz.

## 🛠️ Teknolojiler

- React 18
- TypeScript
- Vite
- Tailwind CSS

## 📝 Lisans

Bu proje özel bir projedir.
