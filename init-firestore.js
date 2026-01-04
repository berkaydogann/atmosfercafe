/**
 * Firestore Initialization Script
 * Creates initial collections and documents for the cafe system
 */

const admin = require('firebase-admin');

// Initialize Firebase Admin SDK
let serviceAccount;

if (!process.env.FIREBASE_KEY) {
    throw new Error('❌ FIREBASE_KEY environment variable bulunamadı!');
}
console.log('🔄 Firebase anahtarı Environment Variable üzerinden okunuyor...');
serviceAccount = JSON.parse(process.env.FIREBASE_KEY);

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function initializeFirestore() {
    try {
        console.log('🔄 Firestore başlatılıyor...\n');

        // 1. Create cafeStatus collection
        console.log('📝 cafeStatus koleksiyonu oluşturuluyor...');
        await db.collection('cafeStatus').doc('current').set({
            isOpen: true,
            lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
            closureReason: null,
            customMessage: null,
            customDetail: null,
            prayerInfo: null
        });
        console.log('✅ cafeStatus oluşturuldu\n');

        // 2. Create stockStatus collection with all menu items
        console.log('📝 stockStatus koleksiyonu oluşturuluyor...');
        const menuItems = [
            // Çay ve Sohbet
            'Bardak Çay', 'Kupa Çay', 'Limonlu Çay', 'Yeşil Çay', 'Kupa Çay (Bergamot)',
            'Limonlu Çay (Bergamot)', 'Bitki Çayı', 'Atom Çayı',

            // Sıcak Kahveler
            'Espresso', 'Double Espresso', 'Cortado', 'Espresso Flat White',
            'Double Espresso Flat White', 'Macchiato', 'Double Shot Macchiato',
            'Red Eye', 'Black Eye', 'Filtre', 'Sütlü Filtre', 'Americano Hafif',
            'Americano Yoğun', 'Sütlü Americano', 'Latte', 'Sahlep Latte',
            'Çikolat Latte', 'Vanilya Latte', 'Karamel Latte', 'Coconut Latte',
            'Mocha', 'White Mocha', 'Mix Mocha', 'Cappuccino', 'Çikolat Cappuccino',
            'Sahlep Cappuccino', 'Vanilya Cappuccino', 'Türk Kahvesi',
            'Sütlü Türk Kahvesi', 'Dibek Kahvesi', 'Sütlü Dibek Kahvesi',
            'Atmosfer Coffee',

            // Soğuk Kahveler
            'Shot Espresso', 'Shot Double Espresso', 'Ice Cortado',
            'Ice Espresso Flat White', 'Ice Double Espresso Flat White',
            'Ice Macchiato', 'Ice Double Shot Macchiato', 'Ice Red', 'Ice Black',
            'Soğuk Filtre', 'Soğuk Sütlü Filtre', 'Ice Americano Hafif',
            'Ice Americano Yoğun', 'Sparkling Americano', 'Ice Sütlü Americano',
            'Ice Latte', 'Ice Sahlep Latte', 'Ice Çikolat Latte', 'Ice Vanilya Latte',
            'Ice Hazelnut Latte', 'Ice Caramel Latte', 'Ice Coconut Latte',
            'Ice White Mocha', 'Ice Mix Mocha', 'Cococream Latte',

            // Hızlı Soğuklar
            'Süt', 'Sade Soda', 'Limon Soda', 'Cool Lime', 'Sodalı Cool Lime',
            'Mango Lime', 'Sodalı Mango Lime', 'Cococream', 'Kokteyl',

            // Frozen
            'Çilek Frozen', 'Lime Frozen', 'Lime Fizz Frozen', 'Mango Frozen',
            'The Jungle', 'Sour Jungle', 'Jungle Fizz', 'Jungle Sour Fizz',
            'Mix Frozen', 'Mikser Frozen',

            // Milkshake
            'Vanilya Milkshake', 'Çikolata Milkshake', 'Çilek Milkshake',
            'Muz Milkshake', 'Mango Milkshake', 'Sahlep Milkshake', 'Coconut Milkshake',

            // Special Sıcaklar
            'Chai Tea Latte', 'Sıcak Çikolata', 'Sahlep'
        ];

        const stockItems = {};
        menuItems.forEach(item => {
            stockItems[item] = true; // All items available by default
        });

        await db.collection('stockStatus').doc('current').set({
            items: stockItems,
            lastUpdated: admin.firestore.FieldValue.serverTimestamp()
        });
        console.log('✅ stockStatus oluşturuldu (${menuItems.length} ürün)\n');

        console.log('═══════════════════════════════════════════════');
        console.log('✨ Firestore başarıyla başlatıldı!');
        console.log('═══════════════════════════════════════════════');
        console.log('\nOluşturulan koleksiyonlar:');
        console.log('  ✓ cafeStatus/current');
        console.log('  ✓ stockStatus/current');
        console.log('\nDiğer koleksiyonlar ilk sipariş ile oluşacak:');
        console.log('  • activeOrders (siparişler geldiğinde)');
        console.log('  • dailyOrders (siparişler tamamlandığında)');
        console.log('  • orderRights (siparişler geldiğinde)');
        console.log('═══════════════════════════════════════════════\n');

        process.exit(0);
    } catch (error) {
        console.error('❌ Hata:', error);
        process.exit(1);
    }
}

// Run initialization
initializeFirestore();
