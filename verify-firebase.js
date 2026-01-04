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

async function verify() {
    try {
        const testRef = db.collection('test_verification').doc('connection_check');
        await testRef.set({
            timestamp: new Date().toISOString(),
            status: 'connected',
            agent: 'AntiGravity'
        });
        console.log('✅ Write successful');

        const doc = await testRef.get();
        if (doc.exists) {
            console.log('✅ Read successful:', doc.data());
        } else {
            console.error('❌ Read failed: Document not found');
        }

        await testRef.delete();
        console.log('✅ Delete successful');
        console.log('🎉 Firebase connection is FLAWLESS');
        process.exit(0);
    } catch (error) {
        console.error('❌ Verification failed:', error);
        process.exit(1);
    }
}

verify();
