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

  // Show the notification payload if the app is open
  PushNotifications.addListener('pushNotificationReceived', (notification) => {
    console.log('Push received: ' + JSON.stringify(notification));
    
    LocalNotifications.schedule({
      notifications: [
        {
          title: notification.title || 'New Message',
          body: notification.body || 'You have a new message',
          id: Math.floor(Math.random() * 10000),
          extra: notification.data
        }
      ]
    });
  });

  // Method called when tapping on a notification
  PushNotifications.addListener('pushNotificationActionPerformed', (notification) => {
    console.log('Push action performed: ' + JSON.stringify(notification));
  });
};
