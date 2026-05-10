import { PushNotifications } from '@capacitor/push-notifications';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Capacitor } from '@capacitor/core';

export const initNotifications = async () => {
  if (Capacitor.getPlatform() === 'web') return;

  // Request permission to use push notifications
  let permStatus = await PushNotifications.checkPermissions();

  if (permStatus.receive === 'prompt') {
    permStatus = await PushNotifications.requestPermissions();
  }

  if (permStatus.receive !== 'granted') {
    console.error('User denied permissions!');
    return;
  }

  await PushNotifications.register();

  // On success, we should be able to receive notifications
  PushNotifications.addListener('registration', (token) => {
    console.log('Push registration success, token: ' + token.value);
    // You would typically send this token to your server to target this device
  });

  // Some error occurred
  PushNotifications.addListener('registrationError', (error) => {
    console.error('Error on registration: ' + JSON.stringify(error));
  });

  // Create notification channels/categories for calls
  if (Capacitor.getPlatform() === 'android') {
    await LocalNotifications.createChannel({
      id: 'calls',
      name: 'Incoming Calls',
      description: 'Incoming video and audio calls',
      importance: 5,
      visibility: 1,
      vibration: true,
      sound: 'ringtone.mp3' // Assumes ringtone.mp3 is in android/app/src/main/res/raw
    });
  }

  // Show the notification payload if the app is open
  PushNotifications.addListener('pushNotificationReceived', (notification) => {
    console.log('Push received: ' + JSON.stringify(notification));
    
    const isCall = notification.data?.type === 'call_invite';

    LocalNotifications.schedule({
      notifications: [
        {
          title: notification.title || (isCall ? 'Incoming Call' : 'New Message'),
          body: notification.body || (isCall ? `${notification.data.callerName} is calling you...` : 'You have a new message'),
          id: isCall ? 999 : Math.floor(Math.random() * 10000),
          extra: notification.data,
          channelId: isCall ? 'calls' : 'messages',
          smallIcon: 'ic_stat_call',
          actionTypeId: isCall ? 'CALL_ACTIONS' : undefined,
          schedule: { at: new Date(Date.now() + 1000) }
        }
      ]
    });
  });

  // Register action types
  await LocalNotifications.registerActionTypes({
    types: [
      {
        id: 'CALL_ACTIONS',
        actions: [
          { id: 'answer', title: 'Answer', foreground: true },
          { id: 'decline', title: 'Decline', destructive: true, foreground: false }
        ]
      }
    ]
  });

  // Method called when tapping on a notification
  PushNotifications.addListener('pushNotificationActionPerformed', (notification) => {
    console.log('Push action performed: ' + JSON.stringify(notification));
    if (notification.actionId === 'answer') {
      // Logic to answer the call - this will open the app and trigger the answer flow
      window.location.href = `/?action=answer&from=${notification.notification.data.from}`;
    }
  });

  LocalNotifications.addListener('localNotificationActionPerformed', (notification) => {
     console.log('Local action performed:', notification);
     if (notification.actionId === 'answer') {
        window.location.href = `/?action=answer&from=${notification.notification.extra.from}`;
     }
  });
};
