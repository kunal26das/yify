package io.github.kunal26das.yify.init

import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import io.github.kunal26das.common.init.IndependentInitializer
import io.github.kunal26das.yify.Notification

class NotificationChannelsInitializer : IndependentInitializer<List<NotificationChannel>>() {
    override fun create(context: Context): List<NotificationChannel> {
        val notificationManager = context.getSystemService(NotificationManager::class.java)
        return Notification.Channel.values().map {
            NotificationChannel(it.name, it.name, it.importance).also {
                notificationManager.createNotificationChannel(it)
            }
        }
    }
}