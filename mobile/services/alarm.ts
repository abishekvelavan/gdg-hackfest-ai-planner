import { Audio } from 'expo-av';
import * as Notifications from 'expo-notifications';

// Keeps track of the currently playing alarm sound
let soundObject: Audio.Sound | null = null;

export async function triggerLocalAlarm() {
    try {
        console.log('Triggering local alarm sound/vibration');

        // Ensure audio is initialized properly for background/foreground
        await Audio.setAudioModeAsync({
            allowsRecordingIOS: false,
            staysActiveInBackground: true,
            playsInSilentModeIOS: true,
            shouldDuckAndroid: true,
            playThroughEarpieceAndroid: false,
        });

        // Stop any existing alarm
        if (soundObject) {
            await soundObject.stopAsync();
            await soundObject.unloadAsync();
            soundObject = null;
        }

        // Load and play a built-in alarm or standard sound
        // Note: We might want a custom asset, for now we can rely on standard system sounds 
        // or trigger an aggressive local notification that plays the default alarm sound

        // Triggering a high priority local notification that acts like an alarm
        await Notifications.scheduleNotificationAsync({
            content: {
                title: '🌅 Early Bird Alarm',
                body: 'Wake up! Your personalized Day Plan is ready.',
                sound: true,
                priority: Notifications.AndroidNotificationPriority.MAX,
                vibrate: [0, 500, 500, 500],
            },
            trigger: null, // immediate
        });

    } catch (err) {
        console.error('Failed to trigger local alarm', err);
    }
}

export async function stopLocalAlarm() {
    if (soundObject) {
        try {
            await soundObject.stopAsync();
            await soundObject.unloadAsync();
            soundObject = null;
        } catch (err) {
            console.error('Failed to stop alarm sound', err);
        }
    }
}
