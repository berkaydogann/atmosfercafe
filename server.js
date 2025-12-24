const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const axios = require('axios');
const fs = require('fs');
const admin = require('firebase-admin');
const multer = require('multer');

// Initialize Firebase Admin SDK
let db;
try {
  let serviceAccount;
  
  // 1. Önce DigitalOcean Environment Variable'a bak
  if (process.env.FIREBASE_KEY) {
    console.log('🔄 Firebase anahtarı Environment Variable üzerinden okunuyor...');
    serviceAccount = JSON.parse(process.env.FIREBASE_KEY);
  } 
  // 2. Yoksa yerel dosyaya bak (Bilgisayarında çalışırken)
  else {
    console.log('📂 Firebase anahtarı yerel dosyadan okunuyor...');
    // Buradaki dosya adının senin indirdiğin JSON ile aynı olduğundan emin ol
    serviceAccount = require('./atmosfercafe-firebase-adminsdk-fbsvc-ccfedce55e.json');
  }

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
  
  db = admin.firestore();
  console.log('✅ Firebase Admin SDK başarıyla başlatıldı');
  console.log('✅ Firestore veritabanı bağlandı');
  
} catch (error) {
  console.error('❌ Firebase Başlatma Hatası:', error.message);
  console.error('⚠️  Sistem Firebase olmadan, sadece yerel hafıza ile çalışacak.');
}

// Initialize Express app
const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Multer konfigürasyonu - Video yükleme için
const videosDir = path.join(__dirname, 'public', 'videos');
if (!fs.existsSync(videosDir)) {
  fs.mkdirSync(videosDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, videosDir);
  },
  filename: function (req, file, cb) {
    const timestamp = Date.now();
    const ext = path.extname(file.originalname);
    cb(null, `video_${timestamp}${ext}`);
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 1 * 1024 * 1024 * 1024 }, // 1GB limit
  fileFilter: function (req, file, cb) {
    // Sadece video dosyaları
    if (file.mimetype.startsWith('video/')) {
      cb(null, true);
    } else {
      cb(new Error('Sadece video dosyaları yüklenebilir'));
    }
  }
});

// Port configuration
const PORT = process.env.PORT || 3000;

// Stok yönetimi - Ürün ID'leri ve stok durumları
const stockStatus = {};

// Cumartesi menüsü - Admin tarafından seçilen ürünler
let saturdayMenuItems = [];

// Cumartesi menü test modu (admin tarafından manuel olarak açılabilir)
let saturdayTestMode = false;

// Cumartesi menü dosyası yolu
const SATURDAY_MENU_FILE = path.join(__dirname, 'saturday_menu.json');

// Aktif siparişler
let activeOrders = [];

// TV Reklam Sistemi
let tvReadyOrders = []; // Hazır siparişlerin TV'de gösterilmesi için liste
let currentVideoUrl = null; // Şu anda oynatılan video

// Aktif siparişler dosyası yolu
const ACTIVE_ORDERS_FILE = path.join(__dirname, 'active_orders.json');

// Aktif siparişleri dosyadan yükle
function loadActiveOrders() {
  try {
    if (fs.existsSync(ACTIVE_ORDERS_FILE)) {
      const data = fs.readFileSync(ACTIVE_ORDERS_FILE, 'utf8');
      activeOrders = JSON.parse(data);
      console.log(`[${getTimestamp()}] 📋 Aktif siparişler yüklendi: ${activeOrders.length} sipariş`);
    }
  } catch (error) {
    console.error(`[${getTimestamp()}] ❌ Aktif sipariş yükleme hatası:`, error.message);
  }
}

// Cumartesi menüsünü dosyadan yükle
function loadSaturdayMenu() {
  try {
    if (fs.existsSync(SATURDAY_MENU_FILE)) {
      const data = fs.readFileSync(SATURDAY_MENU_FILE, 'utf8');
      saturdayMenuItems = JSON.parse(data);
      console.log(`[${getTimestamp()}] 📅 Cumartesi menüsü yüklendi: ${saturdayMenuItems.length} ürün`);
    }
  } catch (error) {
    console.error(`[${getTimestamp()}] ❌ Cumartesi menüsü yükleme hatası:`, error.message);
  }
}

// Cumartesi menüsünü dosyaya kaydet
function saveSaturdayMenu() {
  try {
    fs.writeFileSync(SATURDAY_MENU_FILE, JSON.stringify(saturdayMenuItems, null, 2));
    console.log(`[${getTimestamp()}] ✅ Cumartesi menüsü kaydedildi: ${saturdayMenuItems.length} ürün`);
  } catch (error) {
    console.error(`[${getTimestamp()}] ❌ Cumartesi menüsü kaydetme hatası:`, error.message);
  }
}

// Şu an Cumartesi akşamı mı kontrol et (Cumartesi 18:00'dan sonra veya test modu)
function isSaturdayEvening() {
  // Test modu açıksa her zaman true döndür
  if (saturdayTestMode) {
    return true;
  }
  
  const now = new Date();
  const day = now.getDay(); // 0=Pazar, 6=Cumartesi
  const hour = now.getHours();
  
  return day === 6 && hour >= 18; // Cumartesi ve saat 18 veya sonrası
}

// Cihaz ID kontrolü - Firestore üzerinden (VPN/gizli sekme engeller)
async function checkDeviceLimit(deviceId) {
  const today = new Date().toISOString().split('T')[0];
  
  try {
    if (db) {
      // Firestore'dan kontrol et
      const deviceDoc = await db.collection('dailyOrders')
        .doc(today)
        .collection('devices')
        .doc(deviceId)
        .get();
      
      if (deviceDoc.exists) {
        const deviceData = deviceDoc.data();
        return {
          valid: false,
          message: `Bu cihazdan bugün zaten "${deviceData.name}" adına sipariş verilmiş. Günde tek sipariş hakkınız var.`
        };
      }
      return { valid: true };
    }
  } catch (error) {
    console.error(`[${getTimestamp()}] ❌ Firestore device check error:`, error);
  }
  
  // Fallback: JSON kontrolü
  if (!salesReports.daily[today]) {
    salesReports.daily[today] = { customers: {}, items: {}, phoneRegistry: {}, deviceOrders: {} };
  }
  
  if (!salesReports.daily[today].deviceOrders) {
    salesReports.daily[today].deviceOrders = {};
  }
  
  if (salesReports.daily[today].deviceOrders[deviceId]) {
    const deviceData = salesReports.daily[today].deviceOrders[deviceId];
    return {
      valid: false,
      message: `Bu cihazdan bugün zaten "${deviceData.name}" adına sipariş verilmiş. Günde tek sipariş hakkınız var.`
    };
  }
  
  return { valid: true };
}

// Telefon numarası ve isim kontrolü - Firestore üzerinden (VPN bypass engeller)
async function checkPhoneNameMismatch(phone, customerName) {
  const today = new Date().toISOString().split('T')[0];
  
  try {
    if (db) {
      // Firestore'dan kontrol et
      const phoneDoc = await db.collection('dailyOrders')
        .doc(today)
        .collection('phones')
        .doc(phone)
        .get();
      
      if (phoneDoc.exists) {
        const phoneData = phoneDoc.data();
        if (phoneData.name !== customerName) {
          return {
            valid: false,
            message: `Bu telefon numarası "${phoneData.name}" adına kayıtlı. Farklı isimle sipariş verilemez.`
          };
        }
      }
      return { valid: true };
    }
  } catch (error) {
    console.error(`[${getTimestamp()}] ❌ Firestore phone check error:`, error);
  }
  
  // Fallback: JSON kontrolü
  if (!salesReports.daily[today]) {
    salesReports.daily[today] = { customers: {}, items: {}, phoneRegistry: {} };
  }
  
  if (!salesReports.daily[today].phoneRegistry) {
    salesReports.daily[today].phoneRegistry = {};
  }
  
  if (salesReports.daily[today].phoneRegistry[phone]) {
    const registeredName = salesReports.daily[today].phoneRegistry[phone];
    if (registeredName !== customerName) {
      return {
        valid: false,
        message: `Bu telefon numarası "${registeredName}" adına kayıtlı. Farklı isimle sipariş verilemez.`
      };
    }
  }
  
  return { valid: true };
}

// Telefon bazında sipariş hakkı kontrolü - Firestore üzerinden
async function checkOrderRightsByPhone(phone, customerName) {
  const today = new Date().toISOString().split('T')[0];
  
  try {
    if (db) {
      // Firestore'dan kontrol et
      const phoneDoc = await db.collection('dailyOrders')
        .doc(today)
        .collection('phones')
        .doc(phone)
        .get();
      
      if (phoneDoc.exists) {
        const phoneData = phoneDoc.data();
        if (phoneData.orderCount >= 1) {
          return {
            canOrder: false,
            remaining: 0,
            message: 'Günlük sipariş hakkınız dolmuştur (telefon başına 1 sipariş)'
          };
        }
      }
      return { canOrder: true, remaining: 1 };
    }
  } catch (error) {
    console.error(`[${getTimestamp()}] ❌ Firestore order rights check error:`, error);
  }
  
  // Fallback: JSON kontrolü
  if (!salesReports.daily[today]) {
    salesReports.daily[today] = { customers: {}, items: {}, phoneRegistry: {}, phoneOrders: {} };
  }
  
  if (!salesReports.daily[today].phoneRegistry) {
    salesReports.daily[today].phoneRegistry = {};
  }
  
  if (!salesReports.daily[today].phoneOrders) {
    salesReports.daily[today].phoneOrders = {};
  }
  
  if (salesReports.daily[today].phoneOrders[phone]) {
    const orderCount = salesReports.daily[today].phoneOrders[phone].count || 0;
    if (orderCount >= 1) {
      return {
        canOrder: false,
        remaining: 0,
        message: 'Günlük sipariş hakkınız dolmuştur (telefon başına 1 sipariş)'
      };
    }
  }
  
  return { 
    canOrder: true, 
    remaining: 1,
    message: 'Sipariş verebilirsiniz' 
  };
}

// Sipariş hakkı kullan - Firestore'a kaydet (VPN/gizli sekme bypass engeller)
async function useOrderRight(phone, customerName, deviceId, deviceInfo = {}) {
  const today = new Date().toISOString().split('T')[0];
  const timestamp = new Date().toISOString();
  
  try {
    if (db) {
      // Telefon bilgisini Firestore'a kaydet
      await db.collection('dailyOrders')
        .doc(today)
        .collection('phones')
        .doc(phone)
        .set({
          name: customerName,
          phone: phone,
          orderCount: 1,
          deviceId: deviceId,
          deviceModel: deviceInfo.deviceModel || 'unknown',
          deviceBrand: deviceInfo.deviceBrand || 'unknown',
          browser: deviceInfo.browser || 'unknown',
          os: deviceInfo.os || 'unknown',
          firstOrderTime: timestamp,
          lastOrderTime: timestamp
        });
      
      // Cihaz bilgisini Firestore'a kaydet
      await db.collection('dailyOrders')
        .doc(today)
        .collection('devices')
        .doc(deviceId)
        .set({
          name: customerName,
          phone: phone,
          deviceModel: deviceInfo.deviceModel || 'unknown',
          deviceBrand: deviceInfo.deviceBrand || 'unknown',
          browser: deviceInfo.browser || 'unknown',
          os: deviceInfo.os || 'unknown',
          orderTime: timestamp
        });
      
      console.log(`[${getTimestamp()}] ✅ Sipariş kaydı Firestore'a yazıldı: ${phone} - ${customerName}`);
    }
  } catch (error) {
    console.error(`[${getTimestamp()}] ❌ Firestore order save error:`, error);
  }
  
  // JSON yedek kayıt
  if (!salesReports.daily[today]) {
    salesReports.daily[today] = { customers: {}, items: {}, phoneRegistry: {}, phoneOrders: {}, deviceOrders: {} };
  }
  
  if (!salesReports.daily[today].phoneRegistry) {
    salesReports.daily[today].phoneRegistry = {};
  }
  
  if (!salesReports.daily[today].phoneOrders) {
    salesReports.daily[today].phoneOrders = {};
  }
  
  if (!salesReports.daily[today].deviceOrders) {
    salesReports.daily[today].deviceOrders = {};
  }
  
  // Telefon numarasını ve ismi kaydet
  salesReports.daily[today].phoneRegistry[phone] = customerName;
  
  // Telefon için sipariş sayısını artır
  if (!salesReports.daily[today].phoneOrders[phone]) {
    salesReports.daily[today].phoneOrders[phone] = {
      count: 0,
      lastOrder: null,
      name: customerName
    };
  }
  
  salesReports.daily[today].phoneOrders[phone].count += 1;
  salesReports.daily[today].phoneOrders[phone].lastOrder = new Date().toISOString();
  salesReports.daily[today].phoneOrders[phone].name = customerName;
  
  // Cihaz için sipariş kaydı
  salesReports.daily[today].deviceOrders[deviceId] = {
    name: customerName,
    phone: phone,
    orderTime: new Date().toISOString()
  };
  
  saveReports();
}

// Aktif siparişleri dosyaya ve Firestore'a kaydet
async function saveActiveOrders() {
  try {
    // Dosyaya kaydet (yedek)
    fs.writeFileSync(ACTIVE_ORDERS_FILE, JSON.stringify(activeOrders, null, 2));
    
    // Firestore'a kaydet
    if (db) {
      await db.collection('activeOrders').doc('current').set({
        orders: activeOrders,
        lastUpdated: new Date().toISOString()
      });
    }
  } catch (error) {
    console.error(`[${getTimestamp()}] ❌ Aktif sipariş kaydetme hatası:`, error.message);
  }
}

// Aktif siparişleri Firestore'dan yükle
async function loadActiveOrdersFromFirestore() {
  try {
    if (db) {
      const doc = await db.collection('activeOrders').doc('current').get();
      if (doc.exists) {
        const data = doc.data();
        activeOrders = data.orders || [];
        console.log(`[${getTimestamp()}] 📋 Firestore'dan aktif siparişler yüklendi: ${activeOrders.length} sipariş`);
        return;
      }
    }
    // Firestore'da veri yoksa dosyadan yükle
    loadActiveOrders();
  } catch (error) {
    console.error(`[${getTimestamp()}] ❌ Firestore sipariş yükleme hatası:`, error.message);
    // Hata durumunda dosyadan yükle
    loadActiveOrders();
  }
}

// Şu anki saat dilimini döndür
function getCurrentTimeSlot() {
  const now = new Date();
  const hour = now.getHours();
  
  if (hour >= 16 && hour < 18) return '16:00-18:00';
  if (hour >= 18 && hour < 20) return '18:00-20:00';
  return '20:00 sonrası';
}

// Kafe kapalı/açık durumu
let cafeStatus = {
  isClosed: false,
  closedReason: null, // 'prayer' veya 'manual'
  prayerName: null // Hangi namaz vakti
};

// Ezan vakti bilgileri
let prayerTimesData = []; // 30 günlük namaz vakitleri
let prayerTimers = [];

// Satış raporları - 3 aylık veri tut
let salesReports = {
  daily: {}, // { 'YYYY-MM-DD': { customers: { name: count }, items: { item: count } } }
  monthly: {} // { 'YYYY-MM': { customers: { name: count }, items: { item: count } } }
};

// Rapor dosyası yolu
const REPORTS_FILE = path.join(__dirname, 'sales_reports.json');

// Raporları Firestore'dan yükle (JSON fallback)
async function loadReports() {
  try {
    // Önce Firestore'dan dene
    if (db) {
      const doc = await db.collection('reports').doc('salesData').get();
      if (doc.exists) {
        const data = doc.data();
        salesReports.daily = data.daily || {};
        salesReports.monthly = data.monthly || {};
        console.log(`[${getTimestamp()}] 📊 Raporlar Firestore'dan yüklendi: ${Object.keys(salesReports.daily).length} günlük, ${Object.keys(salesReports.monthly).length} aylık`);
        return;
      }
    }
    
    // Firestore yoksa JSON'dan yükle
    if (fs.existsSync(REPORTS_FILE)) {
      const data = fs.readFileSync(REPORTS_FILE, 'utf8');
      salesReports = JSON.parse(data);
      
      // Eski raporlara yeni alanları ekle (geriye uyumluluk için)
      Object.keys(salesReports.daily).forEach(date => {
        if (!salesReports.daily[date].phoneRegistry) {
          salesReports.daily[date].phoneRegistry = {};
        }
        if (!salesReports.daily[date].phoneOrders) {
          salesReports.daily[date].phoneOrders = {};
        }
        if (!salesReports.daily[date].deviceOrders) {
          salesReports.daily[date].deviceOrders = {};
        }
      });
      
      console.log(`[${getTimestamp()}] 📊 Raporlar JSON'dan yüklendi: ${Object.keys(salesReports.daily).length} günlük, ${Object.keys(salesReports.monthly).length} aylık`);
    }
  } catch (error) {
    console.error(`[${getTimestamp()}] ❌ Rapor yükleme hatası:`, error.message);
  }
}

// Raporları Firestore'a kaydet (JSON yedek)
async function saveReports() {
  try {
    // JSON yedek
    fs.writeFileSync(REPORTS_FILE, JSON.stringify(salesReports, null, 2));
    
    // Firestore'a kaydet
    if (db) {
      await db.collection('reports').doc('salesData').set({
        daily: salesReports.daily,
        monthly: salesReports.monthly,
        lastUpdated: new Date().toISOString()
      });
    }
  } catch (error) {
    console.error(`[${getTimestamp()}] ❌ Rapor kaydetme hatası:`, error.message);
  }
}

// Eski raporları temizle (3 aydan eski olanları)
function cleanupOldReports() {
  const now = new Date();
  const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
  const cutoffDate = threeMonthsAgo.toISOString().split('T')[0]; // YYYY-MM-DD
  const cutoffMonth = threeMonthsAgo.toISOString().substring(0, 7); // YYYY-MM

  // Günlük raporları temizle
  Object.keys(salesReports.daily).forEach(date => {
    if (date < cutoffDate) {
      delete salesReports.daily[date];
    }
  });

  // Aylık raporları temizle
  Object.keys(salesReports.monthly).forEach(month => {
    if (month < cutoffMonth) {
      delete salesReports.monthly[month];
    }
  });

  saveReports();
  console.log(`[${getTimestamp()}] 🧹 3 aydan eski raporlar temizlendi`);
}

// Sipariş tamamlandığında rapora ekle
function recordSale(guestName, item) {
  const now = new Date();
  const today = now.toISOString().split('T')[0]; // YYYY-MM-DD
  const thisMonth = now.toISOString().substring(0, 7); // YYYY-MM

  // Günlük rapor
  if (!salesReports.daily[today]) {
    salesReports.daily[today] = { customers: {}, items: {} };
  }
  salesReports.daily[today].customers[guestName] = (salesReports.daily[today].customers[guestName] || 0) + 1;
  salesReports.daily[today].items[item] = (salesReports.daily[today].items[item] || 0) + 1;

  // Aylık rapor
  if (!salesReports.monthly[thisMonth]) {
    salesReports.monthly[thisMonth] = { customers: {}, items: {} };
  }
  salesReports.monthly[thisMonth].customers[guestName] = (salesReports.monthly[thisMonth].customers[guestName] || 0) + 1;
  salesReports.monthly[thisMonth].items[item] = (salesReports.monthly[thisMonth].items[item] || 0) + 1;

  saveReports();
}

// Tüm menü ürünlerini başlat
function initializeStock() {
  const menuItems = [
    // Çay ve Sohbet (8)
    'Bardak Çay', 'Kupa Çay', 'Limonlu Çay', 'Yeşil Çay', 'Kupa Çay (Bergamot)', 'Limonlu Çay (Bergamot)', 'Bitki Çayı', 'Atom Çayı',
    // Sıcak Kahveler (31)
    'Espresso', 'Double Espresso', 'Cortado', 'Espresso Flat White', 'Double Espresso Flat White', 'Macchiato', 'Double Shot Macchiato', 'Red Eye', 'Black Eye', 'Filtre', 'Sütlü Filtre', 'Americano Hafif', 'Americano Yoğun', 'Sütlü Americano', 'Latte', 'Sahlep Latte', 'Çikolat Latte', 'Vanilya Latte', 'Karamel Latte', 'Coconut Latte', 'Mocha', 'White Mocha', 'Mix Mocha', 'Cappuccino', 'Çikolat Cappuccino', 'Sahlep Cappuccino', 'Vanilya Cappuccino', 'Türk Kahvesi', 'Sütlü Türk Kahvesi', 'Dibek Kahvesi', 'Sütlü Dibek Kahvesi', 'Atmosfer Coffee',
    // Soğuk Kahveler (25)
    'Shot Espresso', 'Shot Double Espresso', 'Ice Cortado', 'Ice Espresso Flat White', 'Ice Double Espresso Flat White', 'Ice Macchiato', 'Ice Double Shot Macchiato', 'Ice Red', 'Ice Black', 'Soğuk Filtre', 'Soğuk Sütlü Filtre', 'Ice Americano Hafif', 'Ice Americano Yoğun', 'Sparkling Americano', 'Ice Sütlü Americano', 'Ice Latte', 'Ice Sahlep Latte', 'Ice Çikolat Latte', 'Ice Vanilya Latte', 'Ice Hazelnut Latte', 'Ice Caramel Latte', 'Ice Coconut Latte', 'Ice White Mocha', 'Ice Mix Mocha', 'Cococream Latte',
    // Hızlı Soğuklar (9)
    'Süt', 'Sade Soda', 'Limon Soda', 'Cool Lime', 'Sodalı Cool Lime', 'Mango Lime', 'Sodalı Mango Lime', 'Cococream', 'Kokteyl',
    // Frozen (10)
    'Çilek Frozen', 'Lime Frozen', 'Lime Fizz Frozen', 'Mango Frozen', 'The Jungle', 'Sour Jungle', 'Jungle Fizz', 'Jungle Sour Fizz', 'Mix Frozen', 'Mikser Frozen',
    // Milkshake (7)
    'Vanilya Milkshake', 'Çikolata Milkshake', 'Çilek Milkshake', 'Muz Milkshake', 'Mango Milkshake', 'Sahlep Milkshake', 'Coconut Milkshake',
    // Geleneksel Kahveler (6)
    'Filtre Kahve', 'Sütlü Filtre Kahve', 'Sütlü Dibek Kahvesi', 'Sütlü Türk Kahvesi', 'Dibek Kahvesi',
    // Special Sıcaklar (3)
    'Chai Tea Latte', 'Sıcak Çikolata', 'Sahlep'
  ];
  
  menuItems.forEach(item => {
    stockStatus[item] = true; // true = stokta var, false = stokta yok
  });
}

initializeStock();

// Log timestamp helper
const getTimestamp = () => {
  return new Date().toLocaleString('tr-TR', { 
    timeZone: 'Europe/Istanbul',
    hour12: false 
  });
};

// Raporları yükle ve başlat
loadReports();

// Aktif siparişleri Firestore'dan yükle (yoksa dosyadan)
if (db) {
  loadActiveOrdersFromFirestore();
} else {
  loadActiveOrders();
}

// Cumartesi menüsünü yükle
loadSaturdayMenu();

// Eski raporları temizle (uygulama başlatıldığında)
cleanupOldReports();

// Ezan vakti API'sinden veri çekme (Diyanet 30 günlük)
async function fetchPrayerTimes() {
  try {
    // Diyanet API - Ankara için cityId: 9206, Monthly endpoint 30 günlük veri döner
    const response = await axios.get('https://awqatsalah.diyanet.gov.tr/api/PrayerTime/Monthly/9206');
    
    // API response.data.data içinde geliyor
    const apiData = response.data.data || response.data;
    prayerTimesData = apiData;
    
    console.log(`[${getTimestamp()}] 🕌 ${prayerTimesData.length} günlük ezan vakitleri güncellendi (Ankara - Diyanet)`);
    
    // Bugünün vakitlerini göster
    const today = getTodayPrayerTimes();
    if (today) {
      console.log(`[${getTimestamp()}] 🕌 Bugünün vakitleri:`, {
        İmsak: today.imsak,
        Güneş: today.gunes,
        Öğle: today.ogle,
        İkindi: today.ikindi,
        Akşam: today.aksam,
        Yatsı: today.yatsi
      });
    }
    
    schedulePrayerClosures();
  } catch (error) {
    console.error(`[${getTimestamp()}] ❌ Diyanet API'den veri alınamadı:`, error.message);
    
    // Alternatif: Aladhan API
    try {
      console.log(`[${getTimestamp()}] ℹ️  Alternatif API deneniyor...`);
      const altResponse = await axios.get('http://api.aladhan.com/v1/calendarByCity', {
        params: {
          city: 'Ankara',
          country: 'Turkey',
          method: 13, // Diyanet method
          month: new Date().getMonth() + 1,
          year: new Date().getFullYear()
        }
      });
      
      const calendar = altResponse.data.data;
      prayerTimesData = calendar.map(day => ({
        MiladiTarihKisa: day.date.gregorian.date,
        Imsak: day.timings.Imsak.split(' ')[0],
        Gunes: day.timings.Sunrise.split(' ')[0],
        Ogle: day.timings.Dhuhr.split(' ')[0],
        Ikindi: day.timings.Asr.split(' ')[0],
        Aksam: day.timings.Maghrib.split(' ')[0],
        Yatsi: day.timings.Isha.split(' ')[0]
      }));
      
      console.log(`[${getTimestamp()}] ✅ Alternatif API'den ${prayerTimesData.length} günlük veri alındı`);
      
      // İlk günün tarih formatını kontrol et
      if (prayerTimesData.length > 0) {
        console.log(`[${getTimestamp()}] 📅 İlk veri örneği:`, {
          Tarih: prayerTimesData[0].MiladiTarihKisa,
          İmsak: prayerTimesData[0].Imsak
        });
      }
      
      const today = getTodayPrayerTimes();
      if (today) {
        console.log(`[${getTimestamp()}] 🕌 Bugünün vakitleri:`, {
          İmsak: today.imsak,
          Güneş: today.gunes,
          Öğle: today.ogle,
          İkindi: today.ikindi,
          Akşam: today.aksam,
          Yatsı: today.yatsi
        });
      } else {
        console.log(`[${getTimestamp()}] ⚠️  Bugünün vakitleri bulunamadı!`);
      }
      
      schedulePrayerClosures();
    } catch (altError) {
      console.error(`[${getTimestamp()}] ❌ Alternatif API de başarısız:`, altError.message);
      // 1 saat sonra tekrar dene
      setTimeout(fetchPrayerTimes, 60 * 60 * 1000);
    }
  }
}

// Bugünün namaz vakitlerini al
function getTodayPrayerTimes() {
  if (!prayerTimesData || prayerTimesData.length === 0) return null;
  
  const today = new Date();
  
  // Bugünün verisini bul
  const todayData = prayerTimesData.find(day => {
    if (!day.MiladiTarihKisa) return false;
    
    // Farklı tarih formatlarını destekle
    let dayDate;
    if (day.MiladiTarihKisa.includes('-')) {
      const parts = day.MiladiTarihKisa.split('-');
      if (parts.length === 3) {
        // DD-MM-YYYY veya YYYY-MM-DD formatını kontrol et
        if (parts[0].length === 4) {
          // YYYY-MM-DD
          dayDate = new Date(day.MiladiTarihKisa);
        } else {
          // DD-MM-YYYY
          dayDate = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
        }
      }
    } else if (day.MiladiTarihKisa.includes('/')) {
      // DD/MM/YYYY formatı
      const parts = day.MiladiTarihKisa.split('/');
      if (parts.length === 3) {
        dayDate = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
      }
    }
    
    if (!dayDate || isNaN(dayDate.getTime())) return false;
    
    return dayDate.getDate() === today.getDate() &&
           dayDate.getMonth() === today.getMonth() &&
           dayDate.getFullYear() === today.getFullYear();
  });
  
  if (!todayData) return null;
  
  return {
    imsak: todayData.Imsak,
    gunes: todayData.Gunes,
    ogle: todayData.Ogle,
    ikindi: todayData.Ikindi,
    aksam: todayData.Aksam,
    yatsi: todayData.Yatsi
  };
}

// Şu anki namaz vakti bilgisini döndür
function getCurrentPrayerInfo() {
  const prayerTimes = getTodayPrayerTimes();
  if (!prayerTimes) return null;

  const now = new Date();
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();
  const currentTime = currentHour * 60 + currentMinute;

  const prayers = [
    { name: 'Öğle', time: prayerTimes.ogle },
    { name: 'İkindi', time: prayerTimes.ikindi },
    { name: 'Akşam', time: prayerTimes.aksam },
    { name: 'Yatsı', time: prayerTimes.yatsi }
  ];

  for (const prayer of prayers) {
    const [hours, minutes] = prayer.time.split(':').map(Number);
    const prayerTime = hours * 60 + minutes;
    const closingTime = prayerTime - 15;
    const openingTime = prayerTime + 40;

    // Eğer şu an kapatma ve açılma zamanı arasındaysak
    if (currentTime >= closingTime && currentTime <= openingTime) {
      return {
        name: prayer.name,
        time: prayer.time,
        isClosed: true
      };
    }
  }

  return { isClosed: false };
}

// Ezan vakitlerine göre kafe kapatma planlaması
function schedulePrayerClosures() {
  // Eski timer'ları temizle
  prayerTimers.forEach(timer => clearTimeout(timer));
  prayerTimers = [];

  const prayerTimes = getTodayPrayerTimes();
  if (!prayerTimes) return;

  const prayers = [
    { name: 'Öğle', time: prayerTimes.ogle },
    { name: 'İkindi', time: prayerTimes.ikindi },
    { name: 'Akşam', time: prayerTimes.aksam },
    { name: 'Yatsı', time: prayerTimes.yatsi }
  ];

  const now = new Date();
  
  // Önce şu anki durumu kontrol et
  const currentPrayer = getCurrentPrayerInfo();
  if (currentPrayer && currentPrayer.isClosed) {
    console.log(`[${getTimestamp()}] 🕌 Şu an ${currentPrayer.name} namazı vakti - Kafe kapatılıyor`);
    cafeStatus.isClosed = true;
    cafeStatus.closedReason = 'prayer';
    cafeStatus.prayerName = currentPrayer.name;
  }
  
  prayers.forEach(prayer => {
    const [hours, minutes] = prayer.time.split(':').map(Number);
    
    // Ezan vaktinden 15 dakika önce kapatma zamanı
    const closingTime = new Date();
    closingTime.setHours(hours, minutes - 15, 0, 0);
    
    // Ezan vaktinden 40 dakika sonra açılma zamanı
    const openingTime = new Date();
    openingTime.setHours(hours, minutes + 40, 0, 0);

    // Eğer kapatma zamanı geçmemişse timer kur
    if (closingTime > now) {
      const timeUntilClosing = closingTime - now;
      const timer = setTimeout(() => {
        console.log(`[${getTimestamp()}] 🕌 ${prayer.name} namazı için kafe kapatılıyor (15 dk önce)`);
        cafeStatus.isClosed = true;
        cafeStatus.closedReason = 'prayer';
        cafeStatus.prayerName = prayer.name;
        io.emit('cafeStatus', cafeStatus);
      }, timeUntilClosing);
      prayerTimers.push(timer);
      
      console.log(`[${getTimestamp()}] ⏰ ${prayer.name} için kapatma planlandı: ${closingTime.toLocaleTimeString('tr-TR')}`);
    }

    // Eğer açılma zamanı geçmemişse timer kur
    if (openingTime > now) {
      const timeUntilOpening = openingTime - now;
      const timer = setTimeout(() => {
        // Sadece namaz için kapatılmışsa otomatik aç
        if (cafeStatus.closedReason === 'prayer') {
          console.log(`[${getTimestamp()}] 🕌 ${prayer.name} namazından sonra kafe açılıyor (40 dk sonra)`);
          cafeStatus.isClosed = false;
          cafeStatus.closedReason = null;
          cafeStatus.prayerName = null;
          io.emit('cafeStatus', cafeStatus);
        }
      }, timeUntilOpening);
      prayerTimers.push(timer);
      
      console.log(`[${getTimestamp()}] ⏰ ${prayer.name} için açılma planlandı: ${openingTime.toLocaleTimeString('tr-TR')}`);
    }
  });
}

// Her 20 günde bir ezan vakitlerini yeniden çek
function scheduleNextPrayerUpdate() {
  const twentyDaysInMs = 20 * 24 * 60 * 60 * 1000; // 20 gün
  
  setTimeout(() => {
    console.log(`[${getTimestamp()}] 🔄 20 gün geçti, ezan vakitleri güncelleniyor...`);
    fetchPrayerTimes();
    scheduleNextPrayerUpdate(); // Bir sonraki güncellemeyi planla
  }, twentyDaysInMs);
  
  const nextUpdate = new Date(Date.now() + twentyDaysInMs);
  console.log(`[${getTimestamp()}] 📅 Sonraki API güncellemesi: ${nextUpdate.toLocaleString('tr-TR')}`);
}

// Her gün gece yarısı bugünün vakitlerini yeniden planla
function scheduleDailyPrayerUpdate() {
  const now = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 1, 0, 0); // Gece 00:01
  
  const timeUntilMidnight = tomorrow - now;
  
  setTimeout(() => {
    console.log(`[${getTimestamp()}] 🌙 Yeni gün başladı, bugünün vakitleri planlanıyor...`);
    schedulePrayerClosures(); // Bugünün vakitlerini planla
    scheduleDailyPrayerUpdate(); // Bir sonraki günü planla
  }, timeUntilMidnight);
  
  console.log(`[${getTimestamp()}] 📅 Yarın saat 00:01'de günlük vakitler güncellenecek`);
}

// Socket.io connection handler
io.on('connection', (socket) => {
  console.log(`[${getTimestamp()}] 🟢 New client connected: ${socket.id}`);

  // Send current cafe status to newly connected client
  socket.emit('cafeStatus', cafeStatus);

  // Listen for 'placeOrder' event from customer
  socket.on('placeOrder', async (orderData) => {
    try {
      // Eğer kafe kapalıysa siparişi kabul etme
      if (cafeStatus.isClosed) {
        socket.emit('cafeIsClosed');
        return;
      }

      // Cihaz ID kontrolü (en önemli kontrol - Firestore üzerinden)
      const deviceCheck = await checkDeviceLimit(orderData.deviceId);
      if (!deviceCheck.valid) {
        socket.emit('deviceLimitExceeded', {
          message: deviceCheck.message
        });
        console.log(`[${getTimestamp()}] ❌ Order rejected - Device ${orderData.deviceId}: ${deviceCheck.message}`);
        return;
      }

      // Telefon-İsim uyuşmazlığı kontrolü (Firestore üzerinden)
      const phoneCheck = await checkPhoneNameMismatch(orderData.phone, orderData.guestName);
      if (!phoneCheck.valid) {
        socket.emit('phoneNameMismatch', {
          message: phoneCheck.message
        });
        console.log(`[${getTimestamp()}] ❌ Order rejected - Phone/Name mismatch: ${phoneCheck.message}`);
        return;
      }

      // Sipariş hakkı kontrolü (Firestore üzerinden - telefon bazında)
      const rightsCheck = await checkOrderRightsByPhone(orderData.phone, orderData.guestName);
      if (!rightsCheck.canOrder) {
        socket.emit('orderLimitExceeded', {
          message: rightsCheck.message,
          remaining: rightsCheck.remaining
        });
        console.log(`[${getTimestamp()}] ❌ Order rejected - Phone ${orderData.phone}: ${rightsCheck.message}`);
        return;
      }

      console.log(`[${getTimestamp()}] 📋 New order received:`);
      console.log(`   Name: ${orderData.guestName}`);
      console.log(`   Phone: ${orderData.phone}`);
      console.log(`   Device: ${orderData.deviceId}`);
      console.log(`   Item: ${orderData.item}`);
      console.log(`   Time: ${orderData.orderTime}`);

      // Cihaz bilgilerini topla
      const deviceInfo = {
        deviceModel: orderData.deviceModel || 'unknown',
        deviceBrand: orderData.deviceBrand || 'unknown',
        browser: orderData.browser || 'unknown',
        os: orderData.os || 'unknown'
      };

      // Sipariş hakkını kullan (Firestore'a kaydet)
      await useOrderRight(orderData.phone, orderData.guestName, orderData.deviceId, deviceInfo);

      // Aktif siparişlere ekle
      const orderNumber = Math.floor(100 + Math.random() * 900); // 3 rakamlı random numara
      const order = {
        id: `order_${Date.now()}`,
        orderNumber: orderNumber,
        guestName: orderData.guestName,
        phone: orderData.phone,
        deviceId: orderData.deviceId,
        item: orderData.item,
        orderTime: orderData.orderTime,
        fcmToken: orderData.fcmToken || null // Save FCM token for push notifications
      };
      activeOrders.push(order);
      await saveActiveOrders();

      // Sipariş başarılı - Müşteriye bildir (sipariş numarasını da gönder)
      socket.emit('orderSuccess', { orderNumber: orderNumber });

      // Emit 'newOrder' event to all admin dashboards
      io.emit('newOrder', order);

      console.log(`[${getTimestamp()}] ✅ Order broadcasted to admin dashboards`);
    } catch (error) {
      console.error(`[${getTimestamp()}] ❌ placeOrder error:`, error);
      socket.emit('orderError', { message: 'Sipariş işlenirken bir hata oluştu.' });
    }
  });

  // Handle cafe closed/open toggle from admin
  socket.on('toggleCafeStatus', (data) => {
    cafeStatus.isClosed = data.isClosed;
    // Manuel olarak açıp kapattığında reason'ı temizle
    if (!data.isClosed) {
      cafeStatus.closedReason = null;
      cafeStatus.prayerName = null;
    } else if (cafeStatus.closedReason !== 'prayer') {
      cafeStatus.closedReason = 'manual';
    }
    
    const status = cafeStatus.isClosed ? 'KAPALI' : 'AÇIK';
    console.log(`[${getTimestamp()}] 🏪 Cafe status changed:`);
    console.log(`   Status: ${status}`);
    console.log(`   Reason: ${cafeStatus.closedReason || 'none'}`);
    
    // Broadcast cafe status to all clients
    io.emit('cafeStatus', cafeStatus);
    // Also broadcast to TV displays
    if (typeof ioHot !== 'undefined') ioHot.emit('cafeStatus', cafeStatus);
    if (typeof ioCold !== 'undefined') ioCold.emit('cafeStatus', cafeStatus);
  });

  // Handle stock status update from admin
  socket.on('updateStock', (data) => {
    const { itemName, isAvailable } = data;
    stockStatus[itemName] = isAvailable;
    
    console.log(`[${getTimestamp()}] 📦 Stock updated:`);
    console.log(`   Item: "${itemName}"`);
    console.log(`   Available: ${isAvailable}`);
    console.log(`   Current stockStatus:`, JSON.stringify(stockStatus, null, 2));
    
    // Broadcast stock status to all clients (menu and TV displays)
    io.emit('stockUpdated', { itemName, isAvailable });
    
    // Also broadcast to TV displays (they will be available after server setup)
    if (typeof ioHot !== 'undefined') ioHot.emit('stockUpdated', { itemName, isAvailable });
    if (typeof ioCold !== 'undefined') ioCold.emit('stockUpdated', { itemName, isAvailable });
  });

  // Send current stock status to newly connected client
  socket.on('getStock', () => {
    socket.emit('stockStatus', stockStatus);
  });

  // Send current cafe status to newly connected client
  socket.on('getCafeStatus', () => {
    socket.emit('cafeStatus', cafeStatus);
  });

  // Cumartesi menü durumunu gönder
  socket.on('getSaturdayMenuStatus', () => {
    socket.emit('saturdayMenuStatus', {
      isSaturdayEvening: isSaturdayEvening(),
      items: saturdayMenuItems
    });
  });

  // Cumartesi menüsünü güncelle
  socket.on('updateSaturdayMenu', (items) => {
    saturdayMenuItems = items;
    saveSaturdayMenu();
    io.emit('saturdayMenuUpdated', saturdayMenuItems);
    // Also broadcast to TV displays
    if (typeof ioHot !== 'undefined') ioHot.emit('saturdayMenuUpdated', saturdayMenuItems);
    if (typeof ioCold !== 'undefined') ioCold.emit('saturdayMenuUpdated', saturdayMenuItems);
    console.log(`[${getTimestamp()}] 📅 Cumartesi menüsü güncellendi: ${items.length} ürün`);
  });

  // Cumartesi test modunu aç/kapat (TEST İÇİN)
  socket.on('toggleSaturdayTestMode', () => {
    saturdayTestMode = !saturdayTestMode;
    const status = saturdayTestMode ? 'AÇIK' : 'KAPALI';
    console.log(`[${getTimestamp()}] 🧪 Cumartesi test modu: ${status}`);
    
    // Tüm müşterilere güncel durumu gönder
    io.emit('saturdayMenuStatus', {
      isSaturdayEvening: isSaturdayEvening(),
      items: saturdayMenuItems
    });
    // Also broadcast to TV displays
    if (typeof ioHot !== 'undefined') ioHot.emit('saturdayMenuStatus', {
      isSaturdayEvening: isSaturdayEvening(),
      items: saturdayMenuItems
    });
    if (typeof ioCold !== 'undefined') ioCold.emit('saturdayMenuStatus', {
      isSaturdayEvening: isSaturdayEvening(),
      items: saturdayMenuItems
    });
  });

  // === TV REKLAM EVENTS ===
  
  // Video oynatma
  socket.on('playVideo', (data) => {
    console.log(`[${getTimestamp()}] 🎬 Video oynatma talebi alındı`);
    
    if (data.videoUrl) {
      currentVideoUrl = data.videoUrl;
      console.log(`[${getTimestamp()}] 📹 Video URL: ${data.videoUrl}`);
      
      // Tüm TV reklam istemcilerine video'yu oynat (YouTube flag'ı ile birlikte)
      io.emit('playVideo', { 
        videoUrl: currentVideoUrl,
        isYouTube: data.isYouTube || false
      });
    } else {
      console.error(`[${getTimestamp()}] ❌ Video URL gönderilmedi`);
    }
  });

  // Video durdurma
  socket.on('stopVideo', () => {
    console.log(`[${getTimestamp()}] ⏹️  Video durdurma talebi alındı`);
    currentVideoUrl = null;
    io.emit('stopVideo');
  });

  // Hazır siparişleri getir (TV sayfası için)
  socket.on('getReadyOrders', () => {
    socket.emit('readyOrders', tvReadyOrders);
  });

  // Hazır siparişleri getir (Admin paneli için)
  socket.on('getReadyOrdersForTv', () => {
    socket.emit('readyOrders', tvReadyOrders);
  });

  // TV'den sipariş tamamlama (Admin panelinden)
  socket.on('completeOrderFromTv', (data) => {
    console.log(`[${getTimestamp()}] ✅ TV siparişi tamamlandı: ${data.orderId}`);
    
    // Listeden çıkar
    tvReadyOrders = tvReadyOrders.filter(o => o.id !== data.orderId);
    
    // Tüm istemcilere bildir
    io.emit('orderCompletedOnTv', data.orderId);
    io.emit('orderCompleted', data.orderId);
  });

  // Handle client disconnect
  socket.on('disconnect', () => {
    console.log(`[${getTimestamp()}] 🔴 Client disconnected: ${socket.id}`);
  });

  // Listen for order completion from admin
  socket.on('completeOrder', async (orderData) => {
    console.log(`[${getTimestamp()}] ✅ Order marked as ready:`);
    console.log(`   Order Number: ${orderData.orderNumber}`);
    console.log(`   Name: ${orderData.guestName}`);
    console.log(`   Item: ${orderData.item}`);
    
    // Find the order to get FCM token
    const order = activeOrders.find(o => o.id === orderData.orderId);
    
    // Send FCM push notification if token exists
    if (order && order.fcmToken) {
      try {
        const message = {
          notification: {
            title: '🎉 Siparişiniz Hazır!',
            body: `${order.item} siparişiniz hazır. Lütfen kafeye gelerek alabilirsiniz.`,
          },
          data: {
            orderId: order.id,
            orderNumber: order.orderNumber.toString(),
            item: order.item,
            type: 'order_ready'
          },
          token: order.fcmToken
        };
        
        const response = await admin.messaging().send(message);
        console.log(`[${getTimestamp()}] 📲 FCM Push notification sent successfully:`, response);
      } catch (error) {
        console.error(`[${getTimestamp()}] ❌ FCM Push notification failed:`, error.message);
      }
    }
    
    // Aktif siparişlerden çıkar
    activeOrders = activeOrders.filter(order => order.id !== orderData.orderId);
    saveActiveOrders();
    
    // TV Reklam Sistemine ekle (hazır siparişlere)
    if (order) {
      tvReadyOrders.push({
        id: orderData.orderId,
        orderNumber: orderData.orderNumber,
        guestName: orderData.guestName,
        item: orderData.item
      });
      
      // TV'ye sipariş hazır olduğunu bildir
      io.emit('orderReady', {
        orderId: orderData.orderId,
        orderNumber: orderData.orderNumber,
        guestName: orderData.guestName,
        item: orderData.item
      });
      
      // TV Reklam sayfasına hazır siparişi gönder
      io.emit('orderReadyForTv', {
        id: orderData.orderId,
        orderNumber: orderData.orderNumber,
        guestName: orderData.guestName,
        item: orderData.item
      });
    }
    
    // Satışı rapora kaydet
    recordSale(orderData.guestName, orderData.item);
    
    // Broadcast to all clients (orderNumber'ı gönder)
    io.emit('orderReady', {
      orderId: orderData.orderId,
      orderNumber: orderData.orderNumber,
      guestName: orderData.guestName,
      item: orderData.item
    });
    
    console.log(`[${getTimestamp()}] 📢 Notification sent to customer (Order #${orderData.orderNumber})`);
  });
});

// Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'menu.html'));
});

// Video upload endpoint
app.post('/api/upload-video', upload.single('video'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'Video dosyası bulunamadı' });
    }

    const videoUrl = `/videos/${req.file.filename}`;
    console.log(`[${getTimestamp()}] 📹 Video yüklendi: ${videoUrl}`);
    
    res.json({ success: true, videoUrl: videoUrl });
  } catch (error) {
    console.error(`[${getTimestamp()}] ❌ Video yükleme hatası:`, error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.get('/tv-sicak', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'tv-hot.html'));
});

app.get('/tv-soguk', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'tv-cold.html'));
});

app.get('/tv-reklam', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'tv-reklam.html'));
});

// Aktif siparişleri al endpoint
app.get('/api/active-orders', (req, res) => {
  res.json(activeOrders);
});

// Raporları al endpoint
// Raporları al endpoint (günlük/haftalık/aylık filtre)
app.get('/api/reports', (req, res) => {
  const { filter = 'all' } = req.query; // all, daily, weekly, monthly
  
  if (filter === 'all') {
    return res.json(salesReports);
  }
  
  const now = new Date();
  const today = now.toISOString().split('T')[0];
  
  if (filter === 'daily') {
    // Sadece bugünün raporu
    return res.json({
      daily: { [today]: salesReports.daily[today] || {} },
      monthly: {}
    });
  }
  
  if (filter === 'weekly') {
    // Son 7 günün raporu
    const weekData = {};
    for (let i = 0; i < 7; i++) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      if (salesReports.daily[dateStr]) {
        weekData[dateStr] = salesReports.daily[dateStr];
      }
    }
    return res.json({
      daily: weekData,
      monthly: {}
    });
  }
  
  if (filter === 'monthly') {
    // Bu ayın raporu
    const thisMonth = now.toISOString().substring(0, 7); // YYYY-MM
    const monthData = {};
    Object.keys(salesReports.daily).forEach(date => {
      if (date.startsWith(thisMonth)) {
        monthData[date] = salesReports.daily[date];
      }
    });
    return res.json({
      daily: monthData,
      monthly: { [thisMonth]: salesReports.monthly[thisMonth] || {} }
    });
  }
  
  res.json(salesReports);
});

// Cumartesi menüsünü al endpoint
app.get('/api/saturday-menu', (req, res) => {
  res.json({
    isSaturdayEvening: isSaturdayEvening(),
    items: saturdayMenuItems
  });
});

// Menüyü Firestore'dan al endpoint
app.get('/api/menu', async (req, res) => {
  try {
    if (!db) {
      return res.status(503).json({ error: 'Firestore not initialized' });
    }
    
    const menuSnapshot = await db.collection('menu').get();
    const menu = [];
    
    menuSnapshot.forEach(doc => {
      menu.push(doc.data());
    });
    
    res.json(menu);
  } catch (error) {
    console.error(`[${getTimestamp()}] ❌ Menü okuma hatası:`, error.message);
    res.status(500).json({ error: 'Failed to fetch menu' });
  }
});

// Menüyü Firestore'a kaydet/güncelle endpoint
app.post('/api/menu', async (req, res) => {
  try {
    if (!db) {
      return res.status(503).json({ error: 'Firestore not initialized' });
    }
    
    const menuData = req.body;
    
    // Her kategoriyi kaydet
    for (const category of menuData) {
      await db.collection('menu').doc(category.id).set(category);
    }
    
    console.log(`[${getTimestamp()}] ✅ Menü Firestore'a kaydedildi`);
    res.json({ success: true });
  } catch (error) {
    console.error(`[${getTimestamp()}] ❌ Menü kaydetme hatası:`, error.message);
    res.status(500).json({ error: 'Failed to save menu' });
  }
});

// Start main server
server.listen(PORT, () => {
  console.log('═══════════════════════════════════════════════');
  console.log('🏪 Charitable Cafe Ordering System Started');
  console.log('═══════════════════════════════════════════════');
  console.log(`📡 Server running on: http://localhost:${PORT}`);
  console.log(`👥 Customer Menu: http://localhost:${PORT}/`);
  console.log(`📊 Admin Dashboard: http://localhost:${PORT}/admin`);
  console.log(`📺 TV Hot Drinks Display: http://localhost:${PORT}/tv-sicak`);
  console.log(`📺 TV Cold Drinks Display: http://localhost:${PORT}/tv-soguk`);
  console.log(`📺 TV Ad Display: http://localhost:${PORT}/tv-reklam`);
  console.log('═══════════════════════════════════════════════');
  console.log(`[${getTimestamp()}] Server is ready to accept connections`);
  
  // Ezan vakti sistemini başlat
  fetchPrayerTimes();
  scheduleNextPrayerUpdate(); // 20 günde bir API'den çek
  scheduleDailyPrayerUpdate(); // Her gün yeni günün vakitlerini planla
});

// Socket.io connections for TV displays are now handled by main 'io' instance above
