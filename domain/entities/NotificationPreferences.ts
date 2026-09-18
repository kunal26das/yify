import {Genre, Quality} from './MovieQuery';

export interface NotificationPreferences {
    dailyPicks: boolean;
    dailyHour: number;
    quality: Quality;
    minimumRating: number;
    genre: Genre;
    quietHours: boolean;
    quietStartHour: number;
    quietEndHour: number;
    perTitle: boolean;
}

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
    dailyPicks: true,
    dailyHour: 19,
    quality: Quality.P2160,
    minimumRating: 0,
    genre: Genre.All,
    quietHours: false,
    quietStartHour: 22,
    quietEndHour: 8,
    perTitle: false,
};
