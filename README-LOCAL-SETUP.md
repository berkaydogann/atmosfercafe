# Atmosfer Kafe - Lokal Geliştirme Ortamı Kurulumu

## Firebase Yapılandırması

Bu proje hem **lokal geliştirme** hem de **production (Digital Ocean)** ortamlarını destekler.

### 🔧 Lokal Test için Kurulum

1. **Firebase Console'dan Service Account Key İndirin:**
   - [Firebase Console](https://console.firebase.google.com/) adresine gidin
   - Projenizi seçin (örn: atmosfercafe)
   - Sol menüden **Project Settings** > **Service Accounts** sekmesine gidin
   - **Generate New Private Key** butonuna tıklayın
   - İndirilen JSON dosyasını `cinaralticafe-73b9e-firebase-adminsdk-fbsvc-b4c8ad6677.json` olarak yeniden adlandırın

2. **Dosyayı Proje Klasörüne Yerleştirin:**
   ```
   /Users/berkayaydogan/Desktop/atmosfercafe/
   └── serviceAccountKey.json  ← Bu dosyayı buraya koyun
   ```

3. **Serveri Başlatın:**
   ```bash
   npm start
   ```

4. **Konsol Çıktısını Kontrol Edin:**
   Başarılı olduğunda şu mesajı görmelisiniz:
   ```
   🔧 LOCAL DEVELOPMENT MODE: serviceAccountKey.json kullanılıyor...
   ✅ Firebase anahtarı yerel dosyadan yüklendi
   ```

### 🚀 Production (Digital Ocean) Kurulumu

Digital Ocean'da `FIREBASE_KEY_BASE64` environment variable otomatik olarak kullanılır. Hiçbir değişiklik yapmanıza gerek yok.

**Önemli:** `serviceAccountKey.json` dosyası `.gitignore` içinde olduğu için Git'e eklenmez. Production ortamında sadece environment variable kullanılır.

### ⚠️ Güvenlik Uyarısı

- **ASLA** `serviceAccountKey.json` dosyasını Git'e commit etmeyin!
- Bu dosya `.gitignore` içinde tanımlıdır, ancak yine de dikkatli olun
- Production ortamında sadece Digital Ocean environment variable'ı kullanın

### 🔀 Nasıl Çalışır?

`server.js` dosyası şu sırayla kontrol yapar:

1. ✅ **Önce lokal dosyayı arar:** `serviceAccountKey.json` var mı?
2. ✅ **Yoksa environment variable'ı kullanır:** `FIREBASE_KEY_BASE64`
3. ❌ **İkisi de yoksa hata verir:** Açıklayıcı mesaj gösterir

Bu sayede:
- Lokal testleriniz için sadece dosyayı indirip koymanız yeterli
- Digital Ocean'a deploy ederken hiçbir şey değiştirmenize gerek yok
- Production güvenliği korunmuş olur

### 📝 Test Etme

Server başarıyla başladıktan sonra:
- **Ana Sayfa:** http://localhost:3000
- **Admin Paneli:** http://localhost:3000/admin
- **TV Ekranları:** http://localhost:3000/tv-sicak, /tv-soguk, /tv-reklam

---

**Yardıma mı ihtiyacınız var?** 
Service account key indirme konusunda sorun yaşıyorsanız, Firebase Console'a gidip yukarıdaki adımları takip edin.
