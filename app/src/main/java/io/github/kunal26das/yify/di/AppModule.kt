package io.github.kunal26das.yify.di

import android.app.NotificationManager
import android.content.Context
import androidx.work.Configuration
import androidx.work.WorkManager
import com.google.gson.Gson
import com.google.gson.GsonBuilder
import com.skydoves.retrofit.adapters.result.ResultCallAdapterFactory
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.android.qualifiers.ApplicationContext
import dagger.hilt.components.SingletonComponent
import io.github.kunal26das.yify.BuildConfig
import io.github.kunal26das.yify.work.YifyWorkerFactory
import okhttp3.Cache
import okhttp3.HttpUrl.Companion.toHttpUrl
import okhttp3.OkHttpClient
import okhttp3.dnsoverhttps.DnsOverHttps
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import java.io.File
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
internal object AppModule {

    @Provides
    fun providesNotificationManager(
        @ApplicationContext context: Context,
    ): NotificationManager {
        return context.getSystemService(NotificationManager::class.java)
    }

    @Provides
    @Singleton
    fun providesWorkManager(
        @ApplicationContext context: Context,
        yifyWorkerFactory: YifyWorkerFactory,
    ): WorkManager {
        val configuration = Configuration.Builder().apply {
            setWorkerFactory(yifyWorkerFactory)
        }.build()
        WorkManager.initialize(context, configuration)
        return WorkManager.getInstance(context)
    }

    @Provides
    @Singleton
    fun providesOkHttp(): OkHttpClient {
        val appCache = Cache(File("cacheDir", "okhttpcache"), 10 * 1024 * 1024)
        val bootstrapClient = OkHttpClient.Builder().cache(appCache).build()
        val dns = DnsOverHttps.Builder().client(bootstrapClient).apply {
            url(BuildConfig.DNS_URL.toHttpUrl())
            includeIPv6(false)
        }.build()
        return bootstrapClient.newBuilder().dns(dns).build()
    }

    @Provides
    @Singleton
    fun providesGson(): Gson {
        return GsonBuilder().create()
    }

    @Provides
    @Singleton
    fun providesRetrofit(
        okHttpClient: OkHttpClient,
        gson: Gson
    ): Retrofit {
        return Retrofit.Builder().apply {
            baseUrl(BuildConfig.BASE_URL)
            client(okHttpClient)
            addConverterFactory(GsonConverterFactory.create(gson))
            addCallAdapterFactory(ResultCallAdapterFactory.create())
        }.build()
    }
}