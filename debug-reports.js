const admin = require('firebase-admin');

// Initialize Firebase Admin SDK
let db;
try {
    if (!process.env.FIREBASE_KEY_BASE64) {
        throw new Error('❌ FIREBASE_KEY_BASE64 environment variable bulunamadı!');
    }
    const decodedKey = Buffer.from(process.env.FIREBASE_KEY_BASE64, 'base64').toString('utf-8');
    const serviceAccount = JSON.parse(decodedKey);

    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });

    db = admin.firestore();
    console.log('✅ Firebase Admin SDK initialized');
} catch (error) {
    console.error('❌ Firebase init failed:', error.message);
    process.exit(1);
}

async function debugReports() {
    try {
        console.log('Reading reports/salesData...');
        const doc = await db.collection('reports').doc('salesData').get();

        if (!doc.exists) {
            console.log('❌ Document reports/salesData does NOT exist.');
        } else {
            const data = doc.data();
            console.log('✅ Document exists.');

            const dailyKeys = data.daily ? Object.keys(data.daily) : [];
            const monthlyKeys = data.monthly ? Object.keys(data.monthly) : [];

            console.log(`Daily keys (${dailyKeys.length}):`, dailyKeys);
            console.log(`Monthly keys (${monthlyKeys.length}):`, monthlyKeys);
        }

        console.log('\n--- Checking activeOrders/current ---');
        const activeOrdersDoc = await db.collection('activeOrders').doc('current').get();
        if (activeOrdersDoc.exists) {
            const activeData = activeOrdersDoc.data();
            const orders = activeData.orders || [];
            console.log(`Found ${orders.length} active orders.`);
            if (orders.length > 0) {
                console.log('Sample Order:', orders[0]);
            }
        } else {
            console.log('❌ activeOrders/current does not exist.');
        }

        console.log('\n--- Checking sales Collection (New Transaction Log) ---');
        const salesSnapshot = await db.collection('sales').get();
        console.log(`Found ${salesSnapshot.size} documents in sales.`);

    } catch (error) {
        console.error('❌ Error reading reports:', error);
    }
}

debugReports();
