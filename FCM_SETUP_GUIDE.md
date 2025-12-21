# Firebase Cloud Messaging (FCM) Integration Guide

## Overview
This guide explains how to complete the Firebase Cloud Messaging integration for your Cafe Ordering System.

## What Was Changed

### 1. Server-Side (`server.js`)
- **Firebase Admin SDK** imported and initialized
- **placeOrder handler**: Now saves `fcmToken` with each order
- **completeOrder handler**: Sends FCM push notification when order is ready

### 2. Client-Side (`public/menu.html`)
- **Firebase Client SDK** added (App and Messaging modules)
- **Firebase Configuration** object added (needs your credentials)
- **initFirebase()** function: Requests notification permission and retrieves FCM token
- **submitOrder()** function: Now includes `fcmToken` in order payload
- **onMessage** handler: Displays foreground notifications

### 3. Service Worker (`public/firebase-messaging-sw.js`)
- **New file created** to handle background notifications
- Handles `onBackgroundMessage` events
- Shows notifications even when browser is in background or phone is locked

### 4. Dependencies (`package.json`)
- Added `firebase-admin` package

## Setup Instructions

### Step 1: Create Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Add project" or select existing project
3. Follow the setup wizard

### Step 2: Enable Cloud Messaging

1. In Firebase Console, go to **Project Settings** (gear icon)
2. Navigate to **Cloud Messaging** tab
3. Under "Web Push certificates", click **Generate key pair**
4. Copy the **VAPID key** (you'll need this later)

### Step 3: Get Firebase Configuration

1. In Firebase Console, go to **Project Settings**
2. Scroll down to "Your apps" section
3. Click the **Web icon** (</>)
4. Register your app with a nickname (e.g., "Cafe Web App")
5. Copy the `firebaseConfig` object

Example config:
```javascript
const firebaseConfig = {
    apiKey: "AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
    authDomain: "your-project.firebaseapp.com",
    projectId: "your-project-id",
    storageBucket: "your-project.appspot.com",
    messagingSenderId: "123456789012",
    appId: "1:123456789012:web:abcdef123456"
};
```

### Step 4: Download Service Account Key

1. In Firebase Console, go to **Project Settings**
2. Navigate to **Service Accounts** tab
3. Click **Generate new private key**
4. Save the downloaded JSON file
5. **IMPORTANT**: The file should already exist in your project as `atmosfercafe-firebase-adminsdk-fbsvc-ccfedce55e.json`
6. If not, rename the downloaded file to match the name in server.js

### Step 5: Update Configuration Files

#### A. Update `public/menu.html` (Lines ~725-735)

Replace the placeholder Firebase config:
```javascript
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_PROJECT_ID.appspot.com",
    messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
    appId: "YOUR_APP_ID"
};
```

With your actual config from Step 3.

#### B. Update VAPID Key in `public/menu.html` (Line ~750)

Replace:
```javascript
fcmToken = await messaging.getToken({
    vapidKey: 'YOUR_VAPID_KEY' // Replace with your VAPID key
});
```

With your VAPID key from Step 2:
```javascript
fcmToken = await messaging.getToken({
    vapidKey: 'BPXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXx...'
});
```

#### C. Update `public/firebase-messaging-sw.js` (Lines 6-13)

Replace the placeholder Firebase config with the same config from Step 3:
```javascript
const firebaseConfig = {
    apiKey: "AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
    authDomain: "your-project.firebaseapp.com",
    projectId: "your-project-id",
    storageBucket: "your-project.appspot.com",
    messagingSenderId: "123456789012",
    appId: "1:123456789012:web:abcdef123456"
};
```

### Step 6: Install Dependencies

Run the following command in your project directory:
```bash
npm install
```

This will install `firebase-admin` and other dependencies.

### Step 7: Test the Integration

1. **Start the server**:
   ```bash
   npm start
   ```

2. **Open the customer menu** in a browser:
   ```
   http://localhost:3000/
   ```

3. **Grant notification permission** when prompted

4. **Check console logs**:
   - You should see: "Firebase initialized successfully"
   - You should see: "FCM Token: ..." (this confirms token retrieval)

5. **Place a test order**:
   - Fill in name and phone
   - Submit order
   - Check server console for FCM token in order data

6. **Complete the order** from admin panel:
   - Go to `http://localhost:3000/admin`
   - Click "Tamamla" on the order
   - You should receive a push notification!

### Step 8: Test Background Notifications

1. **Lock your phone** or **minimize the browser**
2. Have someone complete your order from the admin panel
3. You should receive a notification even with screen locked!

## How It Works

### Customer Side:
1. Customer opens menu.html
2. `initFirebase()` requests notification permission
3. If granted, retrieves FCM token and stores it
4. When placing order, `fcmToken` is sent to server

### Server Side:
1. `placeOrder` handler saves `fcmToken` with order
2. When admin completes order:
   - Finds order and retrieves stored `fcmToken`
   - Sends push notification via Firebase Admin SDK
   - Customer receives notification (even if phone is locked!)

### Service Worker:
- Runs in background
- Listens for FCM messages
- Displays notifications when app is not in focus

## Troubleshooting

### "Firebase initialization error"
- Check that Firebase config is correct in both `menu.html` and `firebase-messaging-sw.js`
- Ensure both files have the exact same config

### "No FCM token available"
- Check notification permission (should be "granted")
- Check browser console for errors
- Ensure VAPID key is correct

### "FCM Push notification failed"
- Check that `atmosfercafe-firebase-adminsdk-fbsvc-ccfedce55e.json` exists
- Verify service account has proper permissions in Firebase Console
- Check server logs for specific error message

### Service Worker not loading
- Service workers only work on HTTPS or localhost
- Check browser console for service worker errors
- Clear browser cache and reload

### Notifications not showing on phone
- Ensure browser has notification permissions
- On iOS: Use Safari, add to Home Screen as PWA
- On Android: Chrome supports notifications natively

## Security Notes

1. **Never commit** your service account JSON file to public repositories
2. Add to `.gitignore`:
   ```
   *-firebase-adminsdk-*.json
   ```

3. **Restrict API keys** in Firebase Console:
   - Go to Google Cloud Console
   - Navigate to "APIs & Services" > "Credentials"
   - Restrict your API key to specific domains

## Additional Features

### Customize Notification Icons
Update in `firebase-messaging-sw.js`:
```javascript
icon: '/img/your-custom-icon.png',
badge: '/img/your-badge-icon.png',
```

### Customize Notification Sound
Add to `notificationOptions`:
```javascript
sound: '/sounds/notification.mp3'
```

### Handle Notification Actions
The service worker already handles click events. Customize in `notificationclick` event listener.

## Summary

You now have a complete FCM integration that:
- ✅ Sends push notifications when orders are ready
- ✅ Works even when phone is locked
- ✅ Works when browser is in background
- ✅ Stores FCM tokens with orders
- ✅ Handles foreground and background messages

## Next Steps

1. Replace all placeholder config values
2. Install dependencies (`npm install`)
3. Test notification flow
4. Deploy to production (HTTPS required for service workers)
5. Add to .gitignore for security

Good luck! 🎉
