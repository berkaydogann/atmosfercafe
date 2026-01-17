/**
 * Cleanup script to cancel all test orders
 * Run with: node cleanup-orders.js
 */

const io = require('socket.io-client');

const socket = io('http://localhost:3000');

socket.on('connect', () => {
    console.log('✅ Sunucuya bağlandı');

    // Get active orders first
    socket.emit('getActiveOrders', {});
});

socket.on('activeOrders', (orders) => {
    console.log(`📋 ${orders.length} aktif sipariş bulundu`);

    if (orders.length === 0) {
        console.log('✅ Temizlenecek sipariş yok!');
        socket.disconnect();
        process.exit(0);
        return;
    }

    // Filter test orders (those with "Test" in the name)
    const testOrders = orders.filter(o => o.guestName && o.guestName.startsWith('Test'));
    console.log(`🧪 ${testOrders.length} test siparişi bulundu`);

    if (testOrders.length === 0) {
        console.log('✅ Test siparişi bulunamadı!');
        socket.disconnect();
        process.exit(0);
        return;
    }

    let cancelled = 0;

    testOrders.forEach((order, index) => {
        setTimeout(() => {
            socket.emit('cancelOrder', { orderId: order.id });
            cancelled++;
            console.log(`❌ İptal edildi: #${order.orderNumber} - ${order.guestName} - ${order.item}`);

            if (cancelled >= testOrders.length) {
                console.log('\n🎉 Tüm test siparişleri temizlendi!');
                setTimeout(() => {
                    socket.disconnect();
                    process.exit(0);
                }, 500);
            }
        }, index * 200);
    });
});

socket.on('connect_error', (err) => {
    console.log('❌ Bağlantı hatası:', err.message);
    process.exit(1);
});
