/**
 * Test script to create 15 fake orders for testing scrolling
 * Run with: node test-orders.js
 */

const io = require('socket.io-client');

const socket = io('http://localhost:3000');

const hotDrinks = [
    'Latte', 'Cappuccino', 'Americano Hafif', 'Mocha', 'White Mocha',
    'Espresso', 'Türk Kahvesi', 'Chai Tea Latte', 'Sıcak Çikolata', 'Sahlep'
];

const coldDrinks = [
    'Ice Latte', 'Ice Americano Hafif', 'Ice Mocha', 'Ice White Mocha',
    'Cool Lime', 'Mango Lime', 'Çilek Frozen', 'Lime Frozen', 'Vanilya Milkshake', 'Çikolata Milkshake'
];

const names = [
    'Test1', 'Test2', 'Test3', 'Test4', 'Test5',
    'Test6', 'Test7', 'Test8', 'Test9', 'Test10',
    'Test11', 'Test12', 'Test13', 'Test14', 'Test15'
];

socket.on('connect', () => {
    console.log('✅ Sunucuya bağlandı');

    let orderCount = 0;
    const totalOrders = 15;

    // Create orders with delay
    const createOrder = () => {
        if (orderCount >= totalOrders) {
            console.log('\n🎉 Tüm siparişler oluşturuldu!');
            setTimeout(() => {
                socket.disconnect();
                process.exit(0);
            }, 1000);
            return;
        }

        // Alternate between hot and cold drinks
        const isHot = orderCount % 2 === 0;
        const drinks = isHot ? hotDrinks : coldDrinks;
        const drink = drinks[Math.floor(Math.random() * drinks.length)];
        const name = names[orderCount];
        const phone = `5${Math.floor(Math.random() * 900000000 + 100000000)}`;

        const orderData = {
            guestName: name,
            phone: phone,
            deviceId: `test-device-${orderCount}`,
            item: drink,
            rating: Math.floor(Math.random() * 5) + 1
        };

        socket.emit('placeOrder', orderData);
        orderCount++;

        console.log(`📦 Sipariş #${orderCount}: ${name} - ${drink} (${isHot ? 'Sıcak' : 'Soğuk'})`);

        // Create next order after 300ms
        setTimeout(createOrder, 300);
    };

    // Start creating orders
    setTimeout(createOrder, 500);
});

socket.on('orderSuccess', (data) => {
    console.log(`   ✅ Sipariş onaylandı: #${data.orderNumber}`);
});

socket.on('orderError', (data) => {
    console.log(`   ❌ Hata: ${data.message}`);
});

socket.on('connect_error', (err) => {
    console.log('❌ Bağlantı hatası:', err.message);
    process.exit(1);
});
