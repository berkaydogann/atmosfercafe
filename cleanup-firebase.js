/**
 * Direct Firebase cleanup script - deletes test orders directly from Firestore
 * Run with: node cleanup-firebase.js
 */

const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

// Initialize Firebase
const localKeyPath = path.join(__dirname, 'cinaralticafe-73b9e-firebase-adminsdk-fbsvc-b4c8ad6677.json');

if (!fs.existsSync(localKeyPath)) {
    console.log('❌ Firebase key not found!');
    process.exit(1);
}

const serviceAccount = require(localKeyPath);
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function cleanupTestOrders() {
    console.log('🔍 Test siparişlerini arıyorum...\n');

    // Get today's date in Turkish format
    const now = new Date();
    const turkishDate = new Date(now.getTime() + (3 * 60 * 60 * 1000));
    const dateStr = turkishDate.toISOString().split('T')[0];

    console.log(`📅 Tarih: ${dateStr}`);

    // Query orders collection
    const ordersRef = db.collection('orders');
    const snapshot = await ordersRef
        .where('date', '==', dateStr)
        .where('status', '==', 'pending')
        .get();

    if (snapshot.empty) {
        console.log('✅ Bekleyen sipariş bulunamadı!');
        process.exit(0);
    }

    const testOrders = [];
    snapshot.forEach(doc => {
        const data = doc.data();
        if (data.guestName && data.guestName.startsWith('Test')) {
            testOrders.push({ id: doc.id, ...data });
        }
    });

    console.log(`🧪 ${testOrders.length} test siparişi bulundu\n`);

    if (testOrders.length === 0) {
        console.log('✅ Test siparişi bulunamadı!');
        process.exit(0);
    }

    // Delete each test order
    for (const order of testOrders) {
        await ordersRef.doc(order.id).delete();
        console.log(`❌ Silindi: #${order.orderNumber} - ${order.guestName} - ${order.item}`);
    }

    console.log('\n🎉 Tüm test siparişleri Firebase\'den silindi!');
    process.exit(0);
}

cleanupTestOrders().catch(err => {
    console.error('❌ Hata:', err.message);
    process.exit(1);
});
