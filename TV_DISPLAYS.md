# 📺 TV Menü Ekranları

## Genel Bakış

Kafe için iki ayrı TV menü ekranı oluşturulmuştur:
- **Sıcak İçecekler TV** - /tv-sicak
- **Soğuk İçecekler TV** - /tv-soguk

Bu ekranlar geleneksel kafe menü tahtası gibi tasarlanmıştır - sadece ürün isimleri görünür (resim yok).

## Kullanım

### Server'ı Başlatma
```bash
node server.js
```

Server başlatıldığında tüm hizmetler Port 3000 üzerinde sunarılır:
- **Port 3000** - Ana uygulama (müşteri menüsü + admin paneli)
- **Port 3000/tv-sicak** - Sıcak içecekler TV ekranı
- **Port 3000/tv-soguk** - Soğuk içecekler TV ekranı

### TV Ekranlarına Erişim

1. **Sıcak İçecekler TV**
   - Tarayıcıda açın: `http://localhost:3000/tv-sicak`
   - Tam ekran için: `F11` tuşuna basın
   
2. **Soğuk İçecekler TV**
   - Tarayıcıda açın: `http://localhost:3000/tv-soguk`
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
- TV 1: Bir bilgisayar/tablet üzerinden /tv-sicak
- TV 2: Başka bir bilgisayar/tablet üzerinden /tv-soguk

### Ağ Ayarları

Eğer farklı cihazlardan erişilecekse:
1. Server'ın çalıştığı bilgisayarın IP adresini bulun
2. TV cihazlarından şu şekilde erişin:
   - Sıcak: `http://[SERVER_IP]:3000/tv-sicak`
   - Soğuk: `http://[SERVER_IP]:3000/tv-soguk`

Örnek: `http://192.168.1.100:3000/tv-sicak`

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

### Sıcak İçecekler (/tv-sicak)
- Geleneksel Kahveler (Türk Kahvesi, Dibek, Menengiç, vb.)
- Espresso Bazlı (Latte, Cappuccino, Mocha, vb.)
- Çaylar (Kupa Çay, Yeşil Çay, Bitki Çayı, vb.)
- Özel Sıcaklar (Sahlep, Sıcak Çikolata, vb.)

### Soğuk İçecekler (/tv-soguk)
- Soğuk Kahveler (Ice Latte, Cold Brew)
- Frozen (Çeşitli Frozen içecekler)
- Milkshake (Çeşitli Milkshake'ler)
- Pratik Soğuklar (Limonata, Soda, vb.)
- Geleneksel (Boza, Şıra)

---

**Not:** Bu TV ekranları sipariş almaz, sadece menüyü gösterir. Müşteriler siparişlerini telefonlarından (port 3000) verebilirler.
