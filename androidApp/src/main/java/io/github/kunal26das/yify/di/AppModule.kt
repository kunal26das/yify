package io.github.kunal26das.yify.di

import android.app.NotificationManager
import android.content.Context
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.android.qualifiers.ApplicationContext
import dagger.hilt.components.SingletonComponent

@Module
@InstallIn(SingletonComponent::class)
internal object AppModule {

    @Provides
    fun providesNotificationManager(
        @ApplicationContext context: Context,
    ): NotificationManager {
        return context.getSystemService(NotificationManager::class.java)
    }
}