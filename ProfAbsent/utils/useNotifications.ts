import { useState, useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { supabase } from './supabase';

// Configuration du comportement des notifications quand l'app est au premier plan
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export interface NotificationData {
  type: 'demande_approuvee' | 'demande_rejetee' | 'demande_soumise' | 'rappel' | 'info';
  requestId?: number;
  title: string;
  body: string;
}

export function useNotifications() {
  const [expoPushToken, setExpoPushToken] = useState<string | null>(null);
  const [notification, setNotification] = useState<Notifications.Notification | null>(null);
  const notificationListener = useRef<Notifications.Subscription | null>(null);
  const responseListener = useRef<Notifications.Subscription | null>(null);

  useEffect(() => {
    // Enregistrer pour les notifications push
    registerForPushNotificationsAsync().then(token => {
      if (token) {
        setExpoPushToken(token);
        // Sauvegarder le token dans le profil utilisateur
        saveTokenToDatabase(token);
      }
    });

    // Écouter les notifications reçues quand l'app est ouverte
    notificationListener.current = Notifications.addNotificationReceivedListener(notification => {
      setNotification(notification);
      console.log('Notification reçue:', notification);
    });

    // Écouter quand l'utilisateur interagit avec une notification
    responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
      console.log('Réponse notification:', response);
      const data = response.notification.request.content.data as unknown as NotificationData;
      // Ici on peut naviguer vers la demande concernée
      if (data?.requestId) {
        // Navigation vers les détails de la demande
        console.log('Naviguer vers la demande:', data.requestId);
      }
    });

    return () => {
      if (notificationListener.current) {
        notificationListener.current.remove();
      }
      if (responseListener.current) {
        responseListener.current.remove();
      }
    };
  }, []);

  return { expoPushToken, notification };
}

// Fonction pour enregistrer l'appareil aux notifications push
async function registerForPushNotificationsAsync(): Promise<string | null> {
  let token: string | null = null;

  // Les notifications push ne fonctionnent que sur des appareils physiques
  if (!Device.isDevice) {
    console.log('Les notifications push nécessitent un appareil physique');
    return null;
  }

  // Vérifier si on est dans Expo Go (les notifications push ne fonctionnent pas dans Expo Go depuis SDK 53)
  const isExpoGo = Constants.appOwnership === 'expo';
  if (isExpoGo && Platform.OS === 'android') {
    console.log('Les notifications push ne fonctionnent pas dans Expo Go sur Android (SDK 53+). Utilisez un development build.');
    return null;
  }

  // Vérifier/demander les permissions
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    console.log('Permission notifications refusée');
    return null;
  }

  // Obtenir le token Expo Push
  try {
    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId: '0eb1050f-a686-47b4-9300-178fcb2ad596',
    });
    token = tokenData.data;
    console.log('Token push:', token);
  } catch (error) {
    console.error('Erreur obtention token push:', error);
  }

  // Configuration spécifique Android
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#3498db',
    });
  }

  return token;
}

// Sauvegarder le token dans la base de données
async function saveTokenToDatabase(token: string) {
  try {
    const { data: userRes } = await supabase.auth.getUser();
    const user = userRes?.user;
    if (!user) return;

    // Mettre à jour le profil avec le token push
    const { error } = await supabase
      .from('profiles')
      .update({ push_token: token })
      .eq('id_profile', user.id);

    if (error) {
      console.error('Erreur sauvegarde token push:', error);
    } else {
      console.log('Token push sauvegardé');
    }
  } catch (error) {
    console.error('Erreur sauvegarde token:', error);
  }
}

// Envoyer une notification push via Expo
export async function sendPushNotification(
  expoPushToken: string,
  title: string,
  body: string,
  data?: NotificationData
) {
  const message = {
    to: expoPushToken,
    sound: 'default',
    title,
    body,
    data: data || {},
  };

  try {
    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
    });

    const result = await response.json();
    console.log('Résultat envoi notification:', result);
    return result;
  } catch (error) {
    console.error('Erreur envoi notification:', error);
    throw error;
  }
}

// Planifier une notification locale (pour les rappels)
export async function scheduleReminderNotification(
  requestId: number,
  title: string,
  body: string,
  triggerDate: Date
) {
  try {
    const identifier = await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data: { type: 'rappel', requestId: String(requestId) },
        sound: 'default',
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: triggerDate,
      },
    });
    console.log('Rappel planifié:', identifier);
    return identifier;
  } catch (error) {
    console.error('Erreur planification rappel:', error);
    throw error;
  }
}

// Annuler une notification planifiée
export async function cancelScheduledNotification(identifier: string) {
  await Notifications.cancelScheduledNotificationAsync(identifier);
}

// Annuler toutes les notifications planifiées
export async function cancelAllScheduledNotifications() {
  await Notifications.cancelAllScheduledNotificationsAsync();
}

// Créer une notification dans la base de données (pour historique in-app)
export async function createNotificationInDB(
  userId: string,
  titre: string,
  message: string,
  type: NotificationData['type'],
  requestId?: number
) {
  try {
    const { error } = await supabase
      .from('notifications')
      .insert({
        id_utilisateur: userId,
        titre,
        message,
        type_notification: type,
        id_demande_associee: requestId || null,
        est_lu: false,
      });

    if (error) {
      console.error('Erreur création notification DB:', error);
    }
  } catch (error) {
    console.error('Erreur notification DB:', error);
  }
}

// Notifier l'utilisateur d'un changement de statut de sa demande
export async function notifyRequestStatusChange(
  requestId: number,
  userId: string,
  newStatus: 'approuve' | 'rejete',
  requestType: string
) {
  const title = newStatus === 'approuve' 
    ? '✅ Demande approuvée' 
    : '❌ Demande rejetée';
  
  const body = newStatus === 'approuve'
    ? `Votre demande de ${requestType} a été approuvée.`
    : `Votre demande de ${requestType} a été rejetée.`;

  // Récupérer le token push de l'utilisateur
  const { data: profile } = await supabase
    .from('profiles')
    .select('push_token')
    .eq('id_profile', userId)
    .single();

  // Envoyer la notification push si le token existe
  if (profile?.push_token) {
    await sendPushNotification(profile.push_token, title, body, {
      type: newStatus === 'approuve' ? 'demande_approuvee' : 'demande_rejetee',
      requestId,
      title,
      body,
    });
  }

  // Créer aussi une notification in-app
  await createNotificationInDB(
    userId,
    title,
    body,
    newStatus === 'approuve' ? 'demande_approuvee' : 'demande_rejetee',
    requestId
  );
}

// Notifier les gestionnaires d'une nouvelle demande
export async function notifyManagersNewRequest(
  requestId: number,
  employeeName: string,
  requestType: string,
  dateDebut: string
) {
  const title = '📋 Nouvelle demande';
  const body = `${employeeName} a soumis une demande de ${requestType} pour le ${dateDebut}`;

  // Récupérer tous les gestionnaires avec leur token push
  const { data: managers } = await supabase
    .from('profiles')
    .select('id_profile, push_token')
    .eq('role', 'Gestionnaire');

  if (managers) {
    for (const manager of managers) {
      // Notification push
      if (manager.push_token) {
        await sendPushNotification(manager.push_token, title, body, {
          type: 'demande_soumise',
          requestId,
          title,
          body,
        });
      }

      // Notification in-app
      await createNotificationInDB(
        manager.id_profile,
        title,
        body,
        'demande_soumise',
        requestId
      );
    }
  }
}

// Planifier un rappel avant une absence
export async function scheduleAbsenceReminder(
  requestId: number,
  absenceDate: string,
  requestType: string,
  daysBefore: number = 1
) {
  const absenceDateObj = new Date(absenceDate);
  const reminderDate = new Date(absenceDateObj);
  reminderDate.setDate(reminderDate.getDate() - daysBefore);
  reminderDate.setHours(9, 0, 0, 0); // Rappel à 9h du matin

  // Ne pas planifier si la date de rappel est déjà passée
  if (reminderDate <= new Date()) {
    console.log('Date de rappel déjà passée, pas de planification');
    return null;
  }

  const title = '⏰ Rappel absence';
  const body = `Votre ${requestType} commence ${daysBefore === 1 ? 'demain' : `dans ${daysBefore} jours`}`;

  return await scheduleReminderNotification(requestId, title, body, reminderDate);
}
