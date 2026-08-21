import {Genre, Quality} from './MovieQuery';

export interface NotificationPreferences {
    quality: Quality;
    minimumRating: number;
    genre: Genre;
    quietHours: boolean;
    quietStartHour: number;
    quietEndHour: number;
    perTitle: boolean;
}

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
    quality: Quality.P2160,
    minimumRating: 0,
    genre: Genre.All,
    quietHours: false,
    quietStartHour: 22,
    quietEndHour: 8,
    perTitle: false,
};
