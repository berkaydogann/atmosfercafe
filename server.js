/**
 * Atmosfer Kafe - Order Management System
 * Pure Firebase Implementation with Turkish Time (UTC+3) Support
 * 
 * No JSON file operations - everything uses Firestore
 * Order slots: 18:00-20:00, 20:00-22:00, After Chat
 * Server: DigitalOcean (German location, Turkish timezone)
 */

const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const axios = require('axios');
const admin = require('firebase-admin');
const multer = require('multer');
const FirebaseHelper = require('./firebaseHelper');

// Initialize Firebase Admin SDK
let db;
let fbHelper;

try {
  let serviceAccount;

  // Firebase anahtarını Digital Ocean environment variable'dan oku
  if (!process.env.FIREBASE_KEY) {
    throw new Error('❌ FIREBASE_KEY environment variable bulunamadı! Digital Ocean ayarlarını kontrol edin.');
  }
  console.log('🔄 Firebase anahtarı Environment Variable üzerinden okunuyor...');
  serviceAccount = JSON.parse(process.env.FIREBASE_KEY);

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });

  db = admin.firestore();
  fbHelper = new FirebaseHelper(db, admin);

  console.log('✅ Firebase Admin SDK başarıyla başlatıldı');
  console.log('✅ Firestore veritabanı bağlandı');
} catch (error) {
  console.error('❌ Firebase Başlatma Hatası:', error.message);
  console.error('❌ CRITICAL: Sistem Firebase olmadan başlatılamaz! Lütfen yapılandırmayı kontrol edin.');
  process.exit(1);
}

// Initialize Express app
const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Multer konfigürasyonu - Video yükleme için
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: { fileSize: 1 * 1024 * 1024 * 1024 }, // 1GB limit
  fileFilter: function (req, file, cb) {
    if (file.mimetype.startsWith('video/')) {
      cb(null, true);
    } else {
      cb(new Error('Sadece video dosyaları yüklenebilir'));
    }
  }
});

// Port configuration
const PORT = process.env.PORT || 3000;

// In-memory cache for real-time data (synced with Firestore)
let cachedStockStatus = {};
let cachedCafeStatus = {
  isOpen: true,
  lastUpdated: new Date().toISOString(),
  closureReason: null,
  customMessage: null,
  customDetail: null,
  prayerInfo: null,
  countdownEnd: null
};
let tvReadyOrders = [];
let currentVideoUrl = null;

// Load initial cache from Firestore on startup
async function initializeCache() {
  try {
    cachedCafeStatus = await fbHelper.getCafeStatus() || cachedCafeStatus;
    cachedStockStatus = await fbHelper.getStockStatus() || {};
    
    // Load today's active orders
    const activeOrders = await fbHelper.getActiveOrders();
    console.log(`[${fbHelper.getTurkishTime()}] 📋 ${activeOrders.length} aktif sipariş yüklendi`);
  } catch (error) {
    console.error('⚠️ Cache initialization warning:', error.message);
  }
}

// Helper function for timestamp logging (Turkish time)
function getTimestamp() {
  return fbHelper.getTurkishTime();
}

// Initialize menu items (all available items)
function initializeMenuItems() {
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
    cachedStockStatus[item] = true; // true = available
  });
}

// Socket.io connection handler
io.on('connection', (socket) => {
  console.log(`[${getTimestamp()}] 🟢 Yeni bağlantı: ${socket.id}`);

  // Send current cafe status to newly connected client
  socket.emit('cafeStatus', cachedCafeStatus);
  socket.emit('stockStatus', cachedStockStatus);

  // ============ ORDER PLACEMENT ============
  socket.on('placeOrder', async (orderData) => {
    try {
      // Check if cafe is open
      if (!cachedCafeStatus.isOpen) {
        socket.emit('cafeIsClosed', { status: cachedCafeStatus });
        return;
      }

      // Place order using Firebase
      const result = await fbHelper.placeOrder({
        guestName: orderData.guestName,
        phone: orderData.phone,
        deviceId: orderData.deviceId,
        item: orderData.item,
        fcmToken: orderData.fcmToken,
        deviceInfo: {
          deviceModel: orderData.deviceModel,
          deviceBrand: orderData.deviceBrand,
          browser: orderData.browser,
          os: orderData.os
        }
      });

      console.log(`[${getTimestamp()}] ✅ Sipariş alındı:`);
      console.log(`   İsim: ${orderData.guestName}`);
      console.log(`   Telefon: ${orderData.phone}`);
      console.log(`   Ürün: ${orderData.item}`);
      console.log(`   Slot: ${result.slot}`);

      // Send success response to customer
      socket.emit('orderSuccess', {
        orderNumber: result.orderNumber,
        slot: result.slot
      });

      // Broadcast new order to all admin dashboards
      io.emit('newOrder', {
        id: result.orderId,
        orderNumber: result.orderNumber,
        guestName: orderData.guestName,
        phone: orderData.phone,
        item: orderData.item,
        slot: result.slot,
        createdAt: getTimestamp()
      });

    } catch (error) {
      console.error(`[${getTimestamp()}] ❌ Sipariş hatası:`, error.message);
      socket.emit('orderError', { message: error.message || 'Sipariş işlenirken bir hata oluştu.' });
    }
  });

  // ============ ADMIN OPERATIONS ============

  // Cafe status toggle
  socket.on('toggleCafeStatus', async (data = {}) => {
    try {
      const { isClosed, closedReason, customNote, customDetail, prayerName, prayerTime } = data;

      await fbHelper.updateCafeStatus(!isClosed, closedReason, {
        customMessage: customNote,
        customDetail: customDetail,
        prayerInfo: closedReason === 'prayer' ? {
          name: prayerName,
          startTime: prayerTime
        } : null
      });

      // Update local cache
      cachedCafeStatus.isOpen = !isClosed;
      cachedCafeStatus.closureReason = closedReason;
      cachedCafeStatus.customMessage = customNote || null;
      cachedCafeStatus.customDetail = customDetail || null;
      cachedCafeStatus.lastUpdated = getTimestamp();

      // Broadcast to all clients
      io.emit('cafeStatus', cachedCafeStatus);

      const status = !isClosed ? 'AÇIK' : 'KAPALI';
      console.log(`[${getTimestamp()}] 🏪 Kafe durumu: ${status} (${closedReason || 'manual'})`);

    } catch (error) {
      console.error(`[${getTimestamp()}] ❌ Cafe status toggle error:`, error);
    }
  });

  // Stock status update
  socket.on('updateStock', async (data) => {
    try {
      const { itemName, isAvailable } = data;

      await fbHelper.updateStockStatus(itemName, isAvailable);

      // Update local cache
      cachedStockStatus[itemName] = isAvailable;

      // Broadcast to all clients
      io.emit('stockUpdated', { itemName, isAvailable });

      console.log(`[${getTimestamp()}] 📦 Stok güncellendi: ${itemName} = ${isAvailable}`);

    } catch (error) {
      console.error(`[${getTimestamp()}] ❌ Stock update error:`, error);
    }
  });

  // Get available order slots
  socket.on('getOrderSlots', async () => {
    try {
      const slots = await fbHelper.getAvailableSlots();
      socket.emit('orderSlots', slots);
    } catch (error) {
      console.error(`[${getTimestamp()}] ❌ Error fetching slots:`, error);
    }
  });

  // Get active orders (for admin dashboard)
  socket.on('getActiveOrders', async (data = {}) => {
    try {
      const date = data.date || fbHelper.getTurkishDate();
      const orders = await fbHelper.getActiveOrders(date);
      socket.emit('activeOrders', orders);
    } catch (error) {
      console.error(`[${getTimestamp()}] ❌ Error fetching active orders:`, error);
    }
  });

  // Mark order as complete
  socket.on('completeOrder', async (orderData) => {
    try {
      const result = await fbHelper.completeOrder(orderData.orderId);

      console.log(`[${getTimestamp()}] ✅ Sipariş hazırlandı: #${result.orderNumber}`);

      // Add to TV ready orders
      tvReadyOrders.push({
        id: orderData.orderId,
        orderNumber: result.orderNumber,
        guestName: orderData.guestName,
        item: orderData.item
      });

      // Send FCM push notification if token exists
      if (orderData.fcmToken) {
        try {
          const message = {
            notification: {
              title: '🎉 Siparişiniz Hazır!',
              body: `${orderData.item} siparişiniz hazır. Lütfen kafeye gelerek alabilirsiniz.`,
            },
            data: {
              orderId: orderData.orderId,
              orderNumber: result.orderNumber.toString(),
              item: orderData.item,
              type: 'order_ready'
            },
            token: orderData.fcmToken
          };

          const response = await admin.messaging().send(message);
          console.log(`[${getTimestamp()}] 📲 FCM Bildirim gönderildi: ${response}`);
        } catch (error) {
          console.error(`[${getTimestamp()}] ⚠️ FCM error:`, error.message);
        }
      }

      // Broadcast to all clients
      io.emit('orderReady', {
        id: orderData.orderId,
        orderNumber: result.orderNumber,
        guestName: orderData.guestName,
        item: orderData.item
      });

      io.emit('orderReadyForTv', {
        id: orderData.orderId,
        orderNumber: result.orderNumber,
        guestName: orderData.guestName,
        item: orderData.item
      });

    } catch (error) {
      console.error(`[${getTimestamp()}] ❌ completeOrder error:`, error.message);
    }
  });

  // Remove order from TV display (customer picked up)
  socket.on('removeFromTv', (data) => {
    tvReadyOrders = tvReadyOrders.filter(o => o.id !== data.orderId);
    io.emit('orderPickedUp', data.orderId);
    console.log(`[${getTimestamp()}] 👤 Sipariş teslim edildi: ${data.orderId}`);
  });

  // TV operations
  socket.on('getReadyOrders', () => {
    socket.emit('readyOrders', tvReadyOrders);
  });

  socket.on('playVideo', (data) => {
    if (data.videoUrl) {
      currentVideoUrl = data.videoUrl;
      console.log(`[${getTimestamp()}] 🎬 Video oynatılıyor: ${data.videoUrl}`);
      io.emit('playVideo', { videoUrl: currentVideoUrl, isYouTube: data.isYouTube || false });
    }
  });

  socket.on('stopVideo', () => {
    currentVideoUrl = null;
    console.log(`[${getTimestamp()}] ⏹️ Video durduruldu`);
    io.emit('stopVideo');
  });

  // Get reports
  socket.on('getReports', async (data = {}) => {
    try {
      const filter = data.filter || 'daily';
      const reports = await fbHelper.getReports(filter);
      socket.emit('reports', reports);
    } catch (error) {
      console.error(`[${getTimestamp()}] ❌ Error fetching reports:`, error);
    }
  });

  // Handle disconnect
  socket.on('disconnect', () => {
    console.log(`[${getTimestamp()}] 🔴 Bağlantı kapatıldı: ${socket.id}`);
  });
});

// ============ REST API ENDPOINTS ============

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: getTimestamp() });
});

// Get active orders
app.get('/api/active-orders', async (req, res) => {
  try {
    const date = req.query.date || fbHelper.getTurkishDate();
    const orders = await fbHelper.getActiveOrders(date);
    res.json(orders);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get completed orders
app.get('/api/completed-orders', async (req, res) => {
  try {
    const date = req.query.date || fbHelper.getTurkishDate();
    const orders = await fbHelper.getCompletedOrders(date);
    res.json(orders);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get reports
app.get('/api/reports', async (req, res) => {
  try {
    const { filter = 'daily', startDate, endDate } = req.query;
    const reports = await fbHelper.getReports(filter, startDate, endDate);
    res.json(reports);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get available order slots
app.get('/api/order-slots', async (req, res) => {
  try {
    const slots = await fbHelper.getAvailableSlots();
    res.json(slots);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get cafe status
app.get('/api/cafe-status', (req, res) => {
  res.json(cachedCafeStatus);
});

// Get stock status
app.get('/api/stock-status', (req, res) => {
  res.json(cachedStockStatus);
});

// Get menu
app.get('/api/menu', async (req, res) => {
  try {
    const menuSnapshot = await db.collection('menu').get();
    const menu = [];
    menuSnapshot.forEach(doc => {
      menu.push(doc.data());
    });
    res.json(menu || Object.keys(cachedStockStatus));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Video upload endpoint
app.post('/api/upload-video', upload.single('video'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Video dosyası bulunamadı' });
    }

    // Generate filename
    const timestamp = Date.now();
    const filename = `video_${timestamp}.${req.file.mimetype.split('/')[1]}`;
    const filepath = path.join(__dirname, 'public', 'videos', filename);

    // In real scenario, you might upload to cloud storage
    // For now, we'll keep the video URL pattern
    const videoUrl = `/videos/${filename}`;

    console.log(`[${getTimestamp()}] 📹 Video yüklendi: ${videoUrl}`);

    res.json({ success: true, videoUrl: videoUrl });
  } catch (error) {
    console.error(`[${getTimestamp()}] ❌ Video upload error:`, error);
    res.status(500).json({ error: error.message });
  }
});

// ============ PAGE ROUTES ============
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'menu.html'));
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

// ============ STARTUP ============
async function startup() {
  try {
    // Initialize menu items in cache
    initializeMenuItems();

    // Load cache from Firestore
    await initializeCache();

    // Start server
    server.listen(PORT, () => {
      console.log('\n═══════════════════════════════════════════════');
      console.log('🏪 Atmosfer Kafe - Sipariş Sistemi Başladı');
      console.log('═══════════════════════════════════════════════');
      console.log(`📡 Server: http://localhost:${PORT}`);
      console.log(`👥 Müşteri Menüsü: http://localhost:${PORT}/`);
      console.log(`📊 Admin Paneli: http://localhost:${PORT}/admin`);
      console.log(`📺 TV Sıcak: http://localhost:${PORT}/tv-sicak`);
      console.log(`📺 TV Soğuk: http://localhost:${PORT}/tv-soguk`);
      console.log(`📺 TV Reklam: http://localhost:${PORT}/tv-reklam`);
      console.log('═══════════════════════════════════════════════');
      console.log(`[${getTimestamp()}] ✅ Sistem ready - Bağlantılar kabul ediliyor`);
      console.log('═══════════════════════════════════════════════\n');
    });

  } catch (error) {
    console.error('❌ Startup error:', error);
    process.exit(1);
  }
}

// Start the application
startup();
