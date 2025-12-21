# 📺 TV Menü Ekranları

## Genel Bakış

Kafe için iki ayrı TV menü ekranı oluşturulmuştur:
- **Sıcak İçecekler TV** - Port 3001
- **Soğuk İçecekler TV** - Port 3002

Bu ekranlar geleneksel kafe menü tahtası gibi tasarlanmıştır - sadece ürün isimleri görünür (resim yok).

## Kullanım

### Server'ı Başlatma
```bash
node server.js
```

Server başlatıldığında 3 port aktif olur:
- **Port 3000** - Ana uygulama (müşteri menüsü + admin paneli)
- **Port 3001** - Sıcak içecekler TV ekranı
- **Port 3002** - Soğuk içecekler TV ekranı

### TV Ekranlarına Erişim

1. **Sıcak İçecekler TV**
   - Tarayıcıda açın: `http://localhost:3001`
   - Tam ekran için: `F11` tuşuna basın
   
2. **Soğuk İçecekler TV**
   - Tarayıcıda açın: `http://localhost:3002`
   - Tam ekran için: `F11` tuşuna basın

### Özellikler

✅ **Canlı Stok Güncellemesi**
- Admin panelinden bir ürün "Stokta Yok" olarak işaretlendiğinde
- TV ekranlarında otomatik olarak üstü çizili ve soluk görünür
- Stok durumu geri geldiğinde normal haline döner

✅ **Kategorize Görünüm**
- Sıcak içecekler kategorilere ayrılmış: Geleneksel Kahveler, Espresso Bazlı, Çaylar, Özel Sıcaklar
- Soğuk içecekler kategorilere ayrılmış: Soğuk Kahveler, Frozen, Milkshake, Pratik Soğuklar, Geleneksel

✅ **Modern Tasarım**
- Koyu tema (kafe ortamı için göz yormaz)
- Büyük, okunabilir yazı tipleri
- Profesyonel görünüm

## Kurulum Notları

### TV Başına Ayrı Bilgisayar/Cihaz Gerekli

Her TV için ayrı bir tarayıcı gerekir:
- TV 1: Bir bilgisayar/tablet üzerinden port 3001
- TV 2: Başka bir bilgisayar/tablet üzerinden port 3002

### Ağ Ayarları

Eğer farklı cihazlardan erişilecekse:
1. Server'ın çalıştığı bilgisayarın IP adresini bulun
2. TV cihazlarından şu şekilde erişin:
   - Sıcak: `http://[SERVER_IP]:3001`
   - Soğuk: `http://[SERVER_IP]:3002`

Örnek: `http://192.168.1.100:3001`

## Sorun Giderme

**Problem:** TV ekranı boş görünüyor
- Çözüm: Server'ın çalıştığından emin olun (`node server.js`)
- Konsolu kontrol edin: Hata mesajı var mı?

**Problem:** Stok güncellemeleri yansımıyor
- Çözüm: Sayfayı yenileyin (F5)
- WebSocket bağlantısını kontrol edin (tarayıcı konsolunda hata var mı?)

**Problem:** Farklı cihazdan erişilemiyor
- Çözüm: Firewall ayarlarını kontrol edin
- Server ve TV cihazları aynı ağda mı?

## Menü İçeriği

### Sıcak İçecekler (Port 3001)
- Geleneksel Kahveler (Türk Kahvesi, Dibek, Menengiç, vb.)
- Espresso Bazlı (Latte, Cappuccino, Mocha, vb.)
- Çaylar (Kupa Çay, Yeşil Çay, Bitki Çayı, vb.)
- Özel Sıcaklar (Sahlep, Sıcak Çikolata, vb.)

### Soğuk İçecekler (Port 3002)
- Soğuk Kahveler (Ice Latte, Cold Brew)
- Frozen (Çeşitli Frozen içecekler)
- Milkshake (Çeşitli Milkshake'ler)
- Pratik Soğuklar (Limonata, Soda, vb.)
- Geleneksel (Boza, Şıra)

---

**Not:** Bu TV ekranları sipariş almaz, sadece menüyü gösterir. Müşteriler siparişlerini telefonlarından (port 3000) verebilirler.
