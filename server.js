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
  const fs = require('fs');

  // Önce yerel geliştirme için serviceAccountKey.json dosyasını kontrol et
  const localKeyPath = path.join(__dirname, 'cinaralticafe-73b9e-firebase-adminsdk-fbsvc-b4c8ad6677.json');

  if (fs.existsSync(localKeyPath)) {
    // LOCAL DEVELOPMENT: serviceAccountKey.json dosyası bulundu
    console.log('🔧 LOCAL DEVELOPMENT MODE: serviceAccountKey.json kullanılıyor...');
    serviceAccount = require(localKeyPath);
    console.log('✅ Firebase anahtarı yerel dosyadan yüklendi');
  } else if (process.env.FIREBASE_KEY_BASE64) {
    // PRODUCTION: Digital Ocean environment variable kullan (Base64 formatında)
    console.log('� PRODUCTION MODE: Environment Variable (Base64) kullanılıyor...');
    const decodedKey = Buffer.from(process.env.FIREBASE_KEY_BASE64, 'base64').toString('utf-8');
    serviceAccount = JSON.parse(decodedKey);
    console.log('✅ Firebase anahtarı Environment Variable\'dan yüklendi');
  } else {
    throw new Error(
      '❌ Firebase anahtarı bulunamadı!\n' +
      '   LOCAL TEST için: serviceAccountKey.json dosyasını proje klasörüne ekleyin\n' +
      '   PRODUCTION için: FIREBASE_KEY_BASE64 environment variable\'ı ayarlayın'
    );
  }

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

// Special menus cache (Chat, Chat Prep, Atmosfer)
let specialMenus = {
  chat: { active: false, items: [] },
  chatPrep: { active: false, items: [] },
  atmosfer: { active: false, items: [] }
};

// Sert/Tatlı seçenekleri cache
let drinkTasteOptions = {};

let tvReadyOrders = [];
let currentVideoUrl = null;

// Load initial cache from Firestore on startup
async function initializeCache() {
  try {
    cachedCafeStatus = await fbHelper.getCafeStatus() || cachedCafeStatus;
    cachedStockStatus = await fbHelper.getStockStatus() || {};

    // Load drink taste options from Firebase
    try {
      const tasteDoc = await db.collection('settings').doc('drinkTasteOptions').get();
      if (tasteDoc.exists) {
        drinkTasteOptions = tasteDoc.data() || {};
      }
    } catch (err) {
      console.warn('⚠️ Could not load drink taste options from Firebase');
    }

    // Load all three special menus from Firebase
    const menuTypes = ['chat', 'chatPrep', 'atmosfer'];
    for (const menuType of menuTypes) {
      try {
        const menuDoc = await db.collection('specialMenus').doc(menuType).get();
        if (menuDoc.exists) {
          const data = menuDoc.data();
          specialMenus[menuType] = {
            active: data.active || false,
            items: data.items || []
          };
        }
      } catch (err) {
        console.warn(`⚠️ Could not load ${menuType} menu from Firebase`);
      }
    }
    console.log(`[${fbHelper.getTurkishTime()}] 📋 Special menus loaded: Chat(${specialMenus.chat.items.length}), ChatPrep(${specialMenus.chatPrep.items.length}), Atmosfer(${specialMenus.atmosfer.items.length})`);

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

// Helper function to broadcast daily stats
async function broadcastDailyStats() {
  try {
    const reports = await fbHelper.getReports('daily');
    if (reports.stats) {
      io.emit('dailyStats', reports.stats);
    }
  } catch (error) {
    console.warn(`[${getTimestamp()}] ⚠️ Could not broadcast daily stats:`, error.message);
  }
}

// Socket.io connection handler
io.on('connection', (socket) => {
  console.log(`[${getTimestamp()}] 🟢 Yeni bağlantı: ${socket.id}`);

  // Send current cafe status to newly connected client
  socket.emit('cafeStatus', cachedCafeStatus);
  socket.emit('stockStatus', cachedStockStatus);
  socket.emit('drinkTasteOptions', drinkTasteOptions);

  // ============ DRINK TASTE OPTIONS (Sert/Tatlı) ============
  socket.on('getDrinkTasteOptions', () => {
    socket.emit('drinkTasteOptions', drinkTasteOptions);
  });

  socket.on('updateDrinkTaste', async (data) => {
    try {
      const { itemName, taste } = data;
      
      // Update local cache
      if (taste === null) {
        delete drinkTasteOptions[itemName];
      } else {
        drinkTasteOptions[itemName] = taste;
      }
      
      // Save to Firebase
      await db.collection('settings').doc('drinkTasteOptions').set(drinkTasteOptions);
      
      // Broadcast to all clients
      io.emit('drinkTasteUpdated', { itemName, taste });
      
      console.log(`[${getTimestamp()}] 🍵 İçecek tadı güncellendi: ${itemName} = ${taste || 'kaldırıldı'}`);
    } catch (error) {
      console.error(`[${getTimestamp()}] ❌ Drink taste update error:`, error);
    }
  });

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
        rating: orderData.rating || null, // Only include if provided
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
        rating: orderData.rating || null,
        slot: result.slot,
        createdAt: getTimestamp()
      });

      // Update daily stats
      broadcastDailyStats();

    } catch (error) {
      console.error(`[${getTimestamp()}] ❌ Sipariş hatası:`, error.message);
      socket.emit('orderError', { message: error.message || 'Sipariş işlenirken bir hata oluştu.' });
    }
  });

  // ============ ADMIN OPERATIONS ============

  // Get current cafe status from Firestore
  socket.on('getCafeStatus', async () => {
    try {
      const cafeStatus = await fbHelper.getCafeStatus();
      const status = {
        ...cafeStatus,
        isClosed: !cafeStatus.isOpen
      };
      socket.emit('cafeStatus', status);
      console.log(`[${getTimestamp()}] 📋 Kafe durumu gönderildi: ${cafeStatus.isOpen ? 'AÇIK' : 'KAPALI'}`);
    } catch (error) {
      console.error(`[${getTimestamp()}] ❌ Error fetching cafe status:`, error);
    }
  });

  // Cafe status toggle
  socket.on('toggleCafeStatus', async (data = {}) => {
    try {
      const { isClosed, closedReason, customNote, customDetail, prayerName, prayerTime } = data;

      // Prepare options object - only include defined values
      const options = {};
      if (customNote) options.customMessage = customNote;
      if (customDetail) options.customDetail = customDetail;

      if (closedReason === 'prayer' && prayerName && prayerTime) {
        options.prayerInfo = {
          name: prayerName,
          startTime: prayerTime
        };
      }

      await fbHelper.updateCafeStatus(!isClosed, closedReason, options);

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

  // Get item ratings for menu display
  socket.on('getItemRatings', async () => {
    try {
      const ratings = await fbHelper.getItemRatings();
      socket.emit('itemRatings', ratings);
      console.log(`[${getTimestamp()}] ⭐ Item ratings sent: ${Object.keys(ratings).length} items`);
    } catch (error) {
      console.error(`[${getTimestamp()}] ❌ Error fetching item ratings:`, error);
      socket.emit('itemRatings', {});
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

      // Update daily stats
      broadcastDailyStats();

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

  // Complete order from TV display (admin marks as completed)
  socket.on('completeOrderFromTv', (data) => {
    tvReadyOrders = tvReadyOrders.filter(o => o.id !== data.orderId);
    io.emit('orderPickedUp', data.orderId);
    console.log(`[${getTimestamp()}] ✅ TV'den sipariş tamamlandı: ${data.orderId}`);
  });

  // TV operations
  socket.on('getReadyOrders', () => {
    socket.emit('readyOrders', tvReadyOrders);
  });

  // Admin panel requests ready orders for TV management
  socket.on('getReadyOrdersForTv', () => {
    socket.emit('readyOrders', tvReadyOrders);
    console.log(`[${getTimestamp()}] 📋 Admin TV hazır siparişleri istedi: ${tvReadyOrders.length} sipariş`);
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

  // ============ SPECIAL MENUS (Chat, Chat Prep, Atmosfer) ============

  // Get all special menus status
  socket.on('getSpecialMenuStatus', async () => {
    try {
      // Return all three menus from cache
      socket.emit('specialMenuStatus', specialMenus);
      console.log(`[${getTimestamp()}] 📋 Special menus status sent`);
    } catch (error) {
      console.error(`[${getTimestamp()}] ❌ Error fetching special menu status:`, error);
    }
  });

  // Toggle a specific special menu
  socket.on('toggleSpecialMenu', async (data) => {
    try {
      const { menuType, active } = data;

      // Validate menu type
      if (!['chat', 'chatPrep', 'atmosfer'].includes(menuType)) {
        console.error(`[${getTimestamp()}] ❌ Invalid menu type: ${menuType}`);
        return;
      }

      // Update cache
      specialMenus[menuType].active = active;

      // Save to Firebase
      await db.collection('specialMenus').doc(menuType).set({
        active: active,
        items: specialMenus[menuType].items,
        lastUpdated: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });

      // Broadcast to all clients
      io.emit('specialMenuToggled', { menuType, active, items: specialMenus[menuType].items });

      const menuNames = { chat: 'Sohbet', chatPrep: 'Sohbet Hazırlık', atmosfer: 'Atmosfer' };
      console.log(`[${getTimestamp()}] 📋 ${menuNames[menuType]} menüsü: ${active ? 'AÇIK' : 'KAPALI'}`);
    } catch (error) {
      console.error(`[${getTimestamp()}] ❌ Error toggling special menu:`, error);
    }
  });

  // Update items for a specific special menu
  socket.on('updateSpecialMenuItems', async (data) => {
    try {
      const { menuType, items } = data;

      // Validate menu type
      if (!['chat', 'chatPrep', 'atmosfer'].includes(menuType)) {
        console.error(`[${getTimestamp()}] ❌ Invalid menu type: ${menuType}`);
        return;
      }

      // Update cache
      specialMenus[menuType].items = items;

      // Save to Firebase
      await db.collection('specialMenus').doc(menuType).set({
        active: specialMenus[menuType].active,
        items: items,
        lastUpdated: admin.firestore.FieldValue.serverTimestamp()
      });

      // Broadcast update to all clients
      io.emit('specialMenuUpdated', { menuType, items, active: specialMenus[menuType].active });

      const menuNames = { chat: 'Sohbet', chatPrep: 'Sohbet Hazırlık', atmosfer: 'Atmosfer' };
      console.log(`[${getTimestamp()}] 📋 ${menuNames[menuType]} menüsü güncellendi: ${items.length} ürün`);
    } catch (error) {
      console.error(`[${getTimestamp()}] ❌ Error updating special menu items:`, error);
    }
  });

  // Get reports
  socket.on('getReports', async (data = {}) => {
    try {
      const filter = data.filter || 'daily';
      const reports = await fbHelper.getReports(filter);

      // Send reports data
      socket.emit('reports', reports);

      // Also send stats separately for quick UI update
      if (reports.stats) {
        socket.emit('dailyStats', reports.stats);
      }
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
    const { filter = 'all' } = req.query;

    console.log(`[${getTimestamp()}] 📊 Rapor çekiliyor - Filtre: ${filter}`);

    // Get data based on filter
    let reportsData;

    if (filter === 'all') {
      // Fetch all historical data
      reportsData = await fbHelper.getReports('all');
    } else if (filter === 'daily') {
      // Fetch only today's data
      reportsData = await fbHelper.getReports('daily');
    } else if (filter === 'weekly') {
      // Fetch last 7 days
      reportsData = await fbHelper.getReports('weekly');
    } else if (filter === 'monthly') {
      // Fetch current month
      reportsData = await fbHelper.getReports('monthly');
    } else {
      // Default to all if unknown filter
      reportsData = await fbHelper.getReports('all');
    }

    // Format response for admin.html
    const response = {
      daily: formatDailyReports(reportsData),
      monthly: formatMonthlyReports(reportsData)
    };

    console.log(`[${getTimestamp()}] ✅ Rapor gönderildi - ${reportsData.orders?.length || 0} sipariş`);

    res.json(response);
  } catch (error) {
    console.error('Reports API error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Helper to format daily reports
function formatDailyReports(data) {
  const result = {};

  if (data && data.orders) {
    data.orders.forEach(order => {
      const date = order.createdAt ? order.createdAt.substring(0, 10) : order.date;

      if (!result[date]) {
        result[date] = {
          customers: {},
          items: {},
          itemRatings: {} // { itemName: { sum, count, avg } }
        };
      }

      // Count customers
      const customerName = order.guestName || 'Misafir';
      result[date].customers[customerName] = (result[date].customers[customerName] || 0) + 1;

      // Count items and aggregate ratings
      const itemName = order.item || 'Bilinmeyen';
      result[date].items[itemName] = (result[date].items[itemName] || 0) + 1;

      // Aggregate item ratings
      if (order.rating) {
        if (!result[date].itemRatings[itemName]) {
          result[date].itemRatings[itemName] = { sum: 0, count: 0 };
        }
        result[date].itemRatings[itemName].sum += order.rating;
        result[date].itemRatings[itemName].count += 1;
        result[date].itemRatings[itemName].avg =
          result[date].itemRatings[itemName].sum / result[date].itemRatings[itemName].count;
      }
    });
  }

  return result;
}

// Helper to format monthly reports
function formatMonthlyReports(data) {
  const result = {};

  if (data && data.orders) {
    data.orders.forEach(order => {
      const date = order.createdAt ? order.createdAt.substring(0, 10) : order.date;
      const month = date.substring(0, 7); // YYYY-MM

      if (!result[month]) {
        result[month] = {
          customers: {},
          items: {},
          itemRatings: {} // { itemName: { sum, count, avg } }
        };
      }

      // Count customers
      const customerName = order.guestName || 'Misafir';
      result[month].customers[customerName] = (result[month].customers[customerName] || 0) + 1;

      // Count items and aggregate ratings
      const itemName = order.item || 'Bilinmeyen';
      result[month].items[itemName] = (result[month].items[itemName] || 0) + 1;

      // Aggregate item ratings
      if (order.rating) {
        if (!result[month].itemRatings[itemName]) {
          result[month].itemRatings[itemName] = { sum: 0, count: 0 };
        }
        result[month].itemRatings[itemName].sum += order.rating;
        result[month].itemRatings[itemName].count += 1;
        result[month].itemRatings[itemName].avg =
          result[month].itemRatings[itemName].sum / result[month].itemRatings[itemName].count;
      }
    });
  }

  return result;
}

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
