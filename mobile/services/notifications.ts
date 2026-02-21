import messaging from '@react-native-firebase/messaging';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { api } from './api';

// Configure how notifications appear when app is in foreground
Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
    }),
});

export async function requestUserPermission() {
    const authStatus = await messaging().requestPermission();
    const enabled =
        authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
        authStatus === messaging.AuthorizationStatus.PROVISIONAL;

    if (enabled) {
        console.log('Authorization status:', authStatus);
        await setupFCMToken();
    } else {
        console.log('Push notification permission denied');
    }
}

async function setupFCMToken() {
    try {
        // Get the token
        const token = await messaging().getToken();
        console.log('FCM Token:', token);

        // Send it to the backend
        await api.registerFCMToken(token, 'default_user');

        // Listen to token refresh
        messaging().onTokenRefresh(async (newToken) => {
            console.log('FCM Token Refreshed:', newToken);
            await api.registerFCMToken(newToken, 'default_user');
        });
    } catch (error) {
        console.error('Failed to get/register FCM token:', error);
    }
}

export function setupNotificationListeners() {
    // Listen for push notifications when app is explicitly closed
    messaging().getInitialNotification().then(remoteMessage => {
        if (remoteMessage) {
            console.log('Notification caused app to open from quit state:', remoteMessage.notification);
            handleNotificationOpen(remoteMessage);
        }
    });

    // Listen for push notifications when app is in background
    messaging().onNotificationOpenedApp(remoteMessage => {
        console.log('Notification caused app to open from background state:', remoteMessage.notification);
        handleNotificationOpen(remoteMessage);
    });

    // Listen for push notifications when app is in foreground
    const unsubscribe = messaging().onMessage(async remoteMessage => {
        console.log('A new FCM message arrived!', JSON.stringify(remoteMessage));

        // expo-notifications will display the local notification
        const notificationContent: Notifications.NotificationContentInput = {
            title: remoteMessage.notification?.title || 'Notification',
            body: remoteMessage.notification?.body || '',
            data: remoteMessage.data,
        };

        await Notifications.scheduleNotificationAsync({
            content: notificationContent,
            trigger: null, // trigger immediately
        });
    });

    return unsubscribe;
}

function handleNotificationOpen(remoteMessage: any) {
    // Can navigate or trigger specific app actions based on remoteMessage.data
    console.log('Handling opened notification:', remoteMessage.data);
}
