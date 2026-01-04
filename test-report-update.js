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
    console.log('✅ Firebase Admin SDK initialized');
} catch (error) {
    console.error('❌ Firebase init failed:', error.message);
    process.exit(1);
}

async function testUpdate() {
    const docRef = db.collection('reports').doc('test_report');

    // 1. Create empty document
    await docRef.set({});
    console.log('✅ Created empty document');

    // 2. Try update with dot notation for missing parent
    try {
        const updates = {
            'daily.2025-01-01.customers.testUser': admin.firestore.FieldValue.increment(1)
        };
        await docRef.update(updates);
        console.log('✅ Update successful');
    } catch (error) {
        console.log('❌ Update failed:', error.message);
    }

    // 3. Try set with merge
    try {
        const updates = {
            daily: {
                '2025-01-01': {
                    customers: {
                        'testUser2': admin.firestore.FieldValue.increment(1)
                    }
                }
            }
        };
        await docRef.set(updates, { merge: true });
        console.log('✅ Set with Merge successful');
    } catch (error) {
        console.log('❌ Set with Merge failed:', error.message);
    }

    // Clean up
    await docRef.delete();
}

testUpdate();
