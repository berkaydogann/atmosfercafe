/**
 * Firebase Helper Module - Atmosfer Cafe Order Management
 * Handles all Firestore operations with Turkish timezone (UTC+3) support
 */

class FirebaseHelper {
    constructor(db, admin) {
        this.db = db;
        this.admin = admin;
        this.turkishOffset = 3 * 60 * 60 * 1000; // UTC+3 in milliseconds
    }

    // ============ TIME MANAGEMENT ============

    /**
     * Get current time in Turkish timezone (UTC+3)
     * @returns {string} - Formatted time string "YYYY-MM-DD HH:MM:SS"
     */
    getTurkishTime() {
        const now = new Date();
        const turkishTime = new Date(now.getTime() + this.turkishOffset);
        return turkishTime.toISOString().replace('T', ' ').substring(0, 19);
    }

    /**
     * Get current date in Turkish timezone
     * @returns {string} - Date in "YYYY-MM-DD" format
     */
    getTurkishDate() {
        const now = new Date();
        const turkishTime = new Date(now.getTime() + this.turkishOffset);
        return turkishTime.toISOString().substring(0, 10);
    }

    /**
     * Get current hour in Turkish timezone (0-23)
     * @returns {number} - Hour (0-23)
     */
    getTurkishHour() {
        const now = new Date();
        const turkishTime = new Date(now.getTime() + this.turkishOffset);
        return turkishTime.getUTCHours();
    }

    /**
     * Get current Turkish timestamp
     * @returns {Date} - Date object adjusted to Turkish time
     */
    getTurkishTimestamp() {
        const now = new Date();
        return new Date(now.getTime() + this.turkishOffset);
    }

    // ============ ORDER RIGHTS MANAGEMENT ============

    /**
     * Check if a customer can place an order based on time windows
     * @param {string} phone - Customer phone number
     * @param {string} deviceId - Device identifier
     * @returns {Promise<Object>} - { canOrder: boolean, reason: string, nextSlot: string }
     */
    /**
     * Check if a customer can place an order based on time windows
     * @param {string} phone - Customer phone number
     * @param {string} deviceId - Device identifier
     * @returns {Promise<Object>} - { canOrder: boolean, reason: string, nextSlot: string }
     */
    async checkOrderRights(phone, deviceId) {
        const today = this.getTurkishDate();
        const currentHour = this.getTurkishHour();

        // 1. STRICT DEVICE CHECK: Using dedicated collection
        const deviceDocRef = this.db.collection('dailyDeviceUsage').doc(deviceId); // Key is DeviceID
        const deviceDoc = await deviceDocRef.get();

        if (deviceDoc.exists) {
            const deviceData = deviceDoc.data();
            if (deviceData.date === today) {
                // Determine normalized phone (just in case)
                if (deviceData.phone !== phone) {
                    return {
                        canOrder: false,
                        reason: 'Bu cihaz bugün başka bir numara ile eşleşmiş. Güvenlik nedeniyle işlem yapılamaz.',
                        nextSlot: null
                    };
                }
            }
        }

        // Get customer's order rights for today
        const rightsRef = this.db.collection('orderRights').doc(phone);
        const rightsDoc = await rightsRef.get();

        if (!rightsDoc.exists) {
            // First order - can always place
            return {
                canOrder: true,
                reason: 'İlk sipariş',
                slot: this.determineSlot(currentHour),
                orderCount: 0
            };
        }

        const rights = rightsDoc.data();

        // Check if it's a different day - reset allowed
        if (rights.date !== today) {
            return {
                canOrder: true,
                reason: 'Yeni gün - ilk sipariş',
                slot: this.determineSlot(currentHour),
                orderCount: 0
            };
        }

        // Same day - check order count and time windows
        const orderCount = rights.orderCount || 0;

        if (orderCount === 0) {
            // First order
            return {
                canOrder: true,
                reason: 'İlk sipariş',
                slot: this.determineSlot(currentHour),
                orderCount: 0
            };
        } else if (orderCount === 1) {
            // Second order - only between 18:00-20:00
            if (currentHour >= 18 && currentHour < 20) {
                return {
                    canOrder: true,
                    reason: 'İkinci sipariş (18:00-20:00)',
                    slot: '18:00-20:00',
                    orderCount: 1
                };
            } else if (currentHour >= 20) {
                // Missed the slot
                return {
                    canOrder: false,
                    reason: 'Bugünlük sipariş hakkınız dolmuştur. (18:00-20:00 aralığını kaçırdınız)',
                    nextSlot: null
                };
            } else {
                return {
                    canOrder: false,
                    reason: 'İkinci siparişinizi 18:00-20:00 arasında verebilirsiniz.',
                    nextSlot: '18:00-20:00'
                };
            }
        } else if (orderCount === 2) {
            // Third order - only between 20:00-23:00
            if (currentHour >= 20 && currentHour < 23) {
                return {
                    canOrder: true,
                    reason: 'Üçüncü sipariş (20:00-23:00)',
                    slot: '20:00-23:00',
                    orderCount: 2
                };
            } else {
                return {
                    canOrder: false,
                    reason: 'Üçüncü siparişinizi 20:00-23:00 arasında verebilirsiniz.',
                    nextSlot: '20:00-23:00'
                };
            }
        } else {
            // Already placed 3 orders today
            return {
                canOrder: false,
                reason: 'Bugün maksimum sipariş sayısına ulaştınız (3 sipariş).',
                nextSlot: null
            };
        }
    }

    /**
     * Determine which slot an order belongs to based on current hour
     * @param {number} hour - Current hour (0-23)
     * @returns {string} - Slot name
     */
    determineSlot(hour) {
        if (hour >= 18 && hour < 20) {
            return '18:00-20:00';
        } else if (hour >= 20 && hour < 23) {
            return '20:00-23:00';
        } else {
            return 'Açık Sipariş';
        }
    }

    /**
     * Update order rights after a successful order
     * @param {string} phone - Customer phone
     * @param {string} deviceId - Device ID
     * @param {Object} orderData - Order information
     */
    async updateOrderRights(phone, deviceId, orderData) {
        const today = this.getTurkishDate();

        // 1. UPDATE DEVICE USAGE (Strict Locking)
        const deviceRef = this.db.collection('dailyDeviceUsage').doc(deviceId);
        await deviceRef.set({
            phone: phone,
            date: today,
            lastOrderAt: this.admin.firestore.FieldValue.serverTimestamp(),
            deviceInfo: orderData.deviceInfo || {}
        }); // Using set to overwrite/create


        // 2. UPDATE CUSTOMER RIGHTS
        const rightsRef = this.db.collection('orderRights').doc(phone);
        const rightsDoc = await rightsRef.get();

        // Ensure deviceInfo is always an object
        const deviceInfo = orderData.deviceInfo || {};
        const now = new Date().toISOString();

        if (!rightsDoc.exists || rightsDoc.data().date !== today) {
            // First order of the day
            await rightsRef.set({
                phone: phone,
                guestName: orderData.guestName,
                deviceId: deviceId,
                deviceInfo: deviceInfo,
                orders: [{
                    orderNumber: orderData.orderNumber,
                    orderId: orderData.orderId,
                    placedAt: now, // Use ISO string instead of serverTimestamp
                    slot: orderData.slot
                }],
                orderCount: 1,
                lastOrderAt: this.admin.firestore.FieldValue.serverTimestamp(),
                date: today
            });
        } else {
            // Subsequent order - update existing record
            const rights = rightsDoc.data();
            await rightsRef.update({
                orders: this.admin.firestore.FieldValue.arrayUnion({
                    orderNumber: orderData.orderNumber,
                    orderId: orderData.orderId,
                    placedAt: now, // Use ISO string instead of serverTimestamp
                    slot: orderData.slot
                }),
                orderCount: (rights.orderCount || 0) + 1,
                lastOrderAt: this.admin.firestore.FieldValue.serverTimestamp(),
                deviceId: deviceId, // Update in case device changed
                deviceInfo: deviceInfo
            });
        }
    }

    // ============ ACTIVE ORDERS MANAGEMENT ============

    /**
     * Place a new order
     * @param {Object} orderData - Order details
     * @returns {Promise<Object>} - { orderId, orderNumber, slot }
     */
    async placeOrder(orderData) {
        const { guestName, phone, deviceId, item, fcmToken, deviceInfo } = orderData;

        // Check order rights
        const rights = await this.checkOrderRights(phone, deviceId);
        if (!rights.canOrder) {
            throw new Error(rights.reason);
        }

        const today = this.getTurkishDate();
        const slot = rights.slot;

        // Get today's order count to assign order number
        const todayOrdersSnapshot = await this.db.collection('activeOrders')
            .where('date', '==', today)
            .get();

        const orderNumber = todayOrdersSnapshot.size + 1;

        // Create order document
        const orderRef = this.db.collection('activeOrders').doc();
        const orderId = orderRef.id;

        await orderRef.set({
            orderId: orderId,
            orderNumber: orderNumber,
            guestName: guestName,
            phone: phone,
            deviceId: deviceId,
            deviceInfo: deviceInfo || {},
            item: item,
            slot: slot,
            fcmToken: fcmToken || null,
            createdAt: this.admin.firestore.FieldValue.serverTimestamp(),
            date: today
        });

        // Update order rights
        await this.updateOrderRights(phone, deviceId, {
            guestName,
            orderNumber,
            orderId,
            slot,
            deviceInfo: deviceInfo || {}
        });

        return {
            orderId: orderId,
            orderNumber: orderNumber,
            slot: slot
        };
    }

    /**
     * Get all active orders for a specific date
     * @param {string} date - Date in YYYY-MM-DD format (optional, defaults to today)
     * @returns {Promise<Array>} - Array of active orders
     */
    async getActiveOrders(date = null) {
        const targetDate = date || this.getTurkishDate();

        const snapshot = await this.db.collection('activeOrders')
            .where('date', '==', targetDate)
            .orderBy('createdAt', 'asc')
            .get();

        const orders = [];
        snapshot.forEach(doc => {
            const data = doc.data();
            orders.push({
                id: doc.id,
                ...data,
                createdAt: data.createdAt?.toDate?.()?.toISOString() || null
            });
        });

        return orders;
    }

    /**
     * Complete an order (move from activeOrders to dailyOrders)
     * @param {string} orderId - Order ID to complete
     * @returns {Promise<Object>} - Completed order data
     */
    async completeOrder(orderId) {
        const orderRef = this.db.collection('activeOrders').doc(orderId);
        const orderDoc = await orderRef.get();

        if (!orderDoc.exists) {
            throw new Error('Sipariş bulunamadı');
        }

        const orderData = orderDoc.data();
        const date = orderData.date || this.getTurkishDate();

        // Move to dailyOrders collection
        await this.db.collection('dailyOrders')
            .doc(date)
            .collection('orders')
            .doc(orderId)
            .set({
                ...orderData,
                completedAt: this.admin.firestore.FieldValue.serverTimestamp()
            });

        // Remove from active orders
        await orderRef.delete();

        return {
            orderNumber: orderData.orderNumber,
            item: orderData.item,
            guestName: orderData.guestName
        };
    }

    // ============ DAILY ORDERS & REPORTS ============

    /**
     * Get completed orders for a specific date
     * @param {string} date - Date in YYYY-MM-DD format
     * @returns {Promise<Array>} - Array of completed orders
     */
    async getCompletedOrders(date) {
        const targetDate = date || this.getTurkishDate();

        const snapshot = await this.db.collection('dailyOrders')
            .doc(targetDate)
            .collection('orders')
            .orderBy('completedAt', 'asc')
            .get();

        const orders = [];
        snapshot.forEach(doc => {
            const data = doc.data();
            orders.push({
                id: doc.id,
                ...data,
                createdAt: data.createdAt?.toDate?.()?.toISOString() || null,
                completedAt: data.completedAt?.toDate?.()?.toISOString() || null
            });
        });

        return orders;
    }

    /**
     * Generate sales reports
     * @param {string} filter - 'daily', 'weekly', or 'monthly'
     * @param {string} startDate - Optional start date (YYYY-MM-DD)
     * @param {string} endDate - Optional end date (YYYY-MM-DD)
     * @returns {Promise<Object>} - Report data with aggregations
     */
    async getReports(filter = 'daily', startDate = null, endDate = null) {
        let start, end;
        const today = this.getTurkishDate();

        // Determine date range
        if (filter === 'daily') {
            start = end = startDate || today;
        } else if (filter === 'weekly') {
            // Last 7 days using Turkish Date as base
            const dateObj = new Date(today); // Use today (Turkish YYYY-MM-DD) as base
            dateObj.setDate(dateObj.getDate() - 7);
            start = startDate || dateObj.toISOString().substring(0, 10);
            end = endDate || today;
        } else if (filter === 'monthly') {
            // Current month
            start = startDate || `${today.substring(0, 7)}-01`;
            end = endDate || today;
        }

        // Fetch all completed orders in range
        const allOrders = [];
        const dateRange = this.getDateRange(start, end);

        for (const date of dateRange) {
            const orders = await this.getCompletedOrders(date);
            allOrders.push(...orders);
        }

        // Aggregate data
        const itemCounts = {};
        const slotCounts = {};
        let totalOrders = 0;

        allOrders.forEach(order => {
            // Count by item
            itemCounts[order.item] = (itemCounts[order.item] || 0) + 1;

            // Count by slot
            slotCounts[order.slot] = (slotCounts[order.slot] || 0) + 1;

            totalOrders++;
        });

        return {
            filter: filter,
            startDate: start,
            endDate: end,
            totalOrders: totalOrders,
            itemCounts: itemCounts,
            slotCounts: slotCounts,
            orders: allOrders
        };
    }

    /**
     * Helper: Generate array of dates between start and end
     * @param {string} start - Start date (YYYY-MM-DD)
     * @param {string} end - End date (YYYY-MM-DD)
     * @returns {Array<string>} - Array of dates
     */
    getDateRange(start, end) {
        const dates = [];
        const startDate = new Date(start);
        const endDate = new Date(end);

        while (startDate <= endDate) {
            dates.push(startDate.toISOString().substring(0, 10));
            startDate.setDate(startDate.getDate() + 1);
        }

        return dates;
    }

    // ============ CAFE STATUS MANAGEMENT ============

    /**
     * Get current cafe status
     * @returns {Promise<Object>} - Cafe status
     */
    async getCafeStatus() {
        const statusDoc = await this.db.collection('cafeStatus').doc('current').get();

        if (!statusDoc.exists) {
            // Return default status
            return {
                isOpen: true,
                lastUpdated: this.getTurkishTime(),
                closureReason: null,
                customMessage: null,
                customDetail: null,
                prayerInfo: null
            };
        }

        const data = statusDoc.data();
        return {
            ...data,
            lastUpdated: data.lastUpdated?.toDate?.()?.toISOString() || this.getTurkishTime()
        };
    }

    /**
     * Update cafe status
     * @param {boolean} isOpen - Whether cafe is open
     * @param {string} reason - Closure reason (if applicable)
     * @param {Object} options - Additional options
     */
    async updateCafeStatus(isOpen, reason = null, options = {}) {
        await this.db.collection('cafeStatus').doc('current').set({
            isOpen: isOpen,
            lastUpdated: this.admin.firestore.FieldValue.serverTimestamp(),
            closureReason: reason,
            customMessage: options.customMessage || null,
            customDetail: options.customDetail || null,
            prayerInfo: options.prayerInfo || null,
            saturdayMenuActive: options.saturdayMenuActive !== undefined ? options.saturdayMenuActive : false
        });
    }

    // ============ STOCK STATUS MANAGEMENT ============

    /**
     * Get current stock status for all items
     * @returns {Promise<Object>} - Stock status object
     */
    async getStockStatus() {
        const stockDoc = await this.db.collection('stockStatus').doc('current').get();

        if (!stockDoc.exists) {
            return {};
        }

        const data = stockDoc.data();
        return data.items || {};
    }

    /**
     * Update stock status for a specific item
     * @param {string} itemName - Item name
     * @param {boolean} isAvailable - Whether item is available
     */
    async updateStockStatus(itemName, isAvailable) {
        const stockRef = this.db.collection('stockStatus').doc('current');

        await stockRef.set({
            items: {
                [itemName]: isAvailable
            },
            lastUpdated: this.admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
    }

    // ============ SLOT MANAGEMENT ============

    /**
     * Get available order slots based on current time
     * @returns {Array<Object>} - Available slots
     */
    async getAvailableSlots() {
        const hour = this.getTurkishHour();

        const slots = [
            { name: 'Açık Sipariş', available: hour < 18, timeRange: 'Anytime' },
            { name: '18:00-20:00', available: hour >= 18 && hour < 20, timeRange: '18:00-20:00' },
            { name: '20:00-23:00', available: hour >= 20 && hour < 23, timeRange: '20:00-23:00' }
        ];

        return slots;
    }
}

module.exports = FirebaseHelper;
