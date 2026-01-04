const admin = require('firebase-admin');

// Initialize Firebase Admin SDK
let db;
try {
    if (!process.env.FIREBASE_KEY) {
        throw new Error('❌ FIREBASE_KEY environment variable bulunamadı!');
    }
    const serviceAccount = JSON.parse(process.env.FIREBASE_KEY);

    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });

    db = admin.firestore();
    console.log('✅ Firebase Admin SDK initialized\n');
} catch (error) {
    console.error('❌ Firebase init failed:', error.message);
    process.exit(1);
}

async function inspectCompletedOrders() {
    try {
        console.log('--- Inspecting completedOrders Collection ---');
        const snapshot = await db.collection('completedOrders').limit(5).get();

        console.log(`Found ${snapshot.size} documents (showing first 5)\n`);

        snapshot.forEach(doc => {
            console.log(`Document ID: ${doc.id}`);
            console.log('Data:', JSON.stringify(doc.data(), null, 2));
            console.log('---');
        });

        console.log('\n--- Inspecting activeOrders Collection ---');
        const activeSnapshot = await db.collection('activeOrders').get();
        console.log(`Found ${activeSnapshot.size} active orders\n`);

        if (activeSnapshot.size > 0) {
            activeSnapshot.forEach(doc => {
                console.log(`Active Order ID: ${doc.id}`);
                console.log('Data:', JSON.stringify(doc.data(), null, 2));
                console.log('---');
            });
        }

    } catch (error) {
        console.error('❌ Error inspecting Firestore:', error);
    }
}

inspectCompletedOrders();
