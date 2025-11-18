import { Injectable } from '@angular/core';
import { PushNotifications, Token, PushNotificationSchema, ActionPerformed } from '@capacitor/push-notifications';
import { supabase } from './supabase.client';

@Injectable({ providedIn: 'root' })
export class PushService {

  constructor() {}

  private showAlert(msg: string) {
    setTimeout(() => {
      alert(msg);
    }, 300); // iOS sometimes blocks alerts if triggered instantly
  }

  async init() {
    // Step 1: Check permission
    let permStatus = await PushNotifications.checkPermissions();

    if (permStatus.receive === 'prompt') {
      permStatus = await PushNotifications.requestPermissions();
    }

    if (permStatus.receive !== 'granted') {
      this.showAlert('❌ Push permission NOT granted');
      return;
    }

    this.showAlert('📳 Permission granted — registering…');

    // Step 2: Register
    await PushNotifications.register();

    // Step 3: Registration success
    PushNotifications.addListener('registration', async (token: Token) => {
      console.log('FCM Token:', token.value);
      this.showAlert('✅ Push Registered!\nToken:\n' + token.value);

      const { data } = await supabase.auth.getUser();
      if (data.user) {
        await this.saveToken(data.user.id, token.value);
      } else {
        this.showAlert('⚠️ User not logged in. Token NOT saved.');
      }
    });

    // Step 4: Registration error
    PushNotifications.addListener('registrationError', (err) => {
      console.error(err);
      this.showAlert('❌ Registration ERROR:\n' + JSON.stringify(err));
    });

    // Step 5: Notification received in FOREGROUND
    PushNotifications.addListener('pushNotificationReceived',
      (notification: PushNotificationSchema) => {
        console.log('Notification received:', notification);
        this.showAlert('📩 Push Received (Foreground):\n' + JSON.stringify(notification));
      }
    );

    // Step 6: Notification tapped from background
    PushNotifications.addListener('pushNotificationActionPerformed',
      (action: ActionPerformed) => {
        console.log('Notification action:', action);
        this.showAlert('📨 Push Clicked:\n' + JSON.stringify(action.notification));
      }
    );
  }

  async saveToken(userId: string, fcmToken: string) {
    const { error } = await supabase
      .from('user_tokens')
      .upsert(
        {
          user_id: userId,
          fcm_token: fcmToken,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,fcm_token' }
      );

    if (error) {
      console.error('Save token error:', error);
      this.showAlert('❌ Error saving token:\n' + error.message);
    } else {
      this.showAlert('✅ Token saved to Supabase');
    }
  }

  async deleteTokens(userId: string) {
    const { error } = await supabase
      .from('user_tokens')
      .delete()
      .eq('user_id', userId);

    if (error) {
      console.error('Delete token error:', error);
      this.showAlert('❌ Error deleting token');
    } else {
      this.showAlert('🗑️ Token deleted');
    }
  }
}
