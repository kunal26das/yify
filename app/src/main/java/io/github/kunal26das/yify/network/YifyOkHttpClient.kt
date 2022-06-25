package io.github.kunal26das.yify.network

import androidx.essentials.network.remote.OkHttpClientBuilder
import com.facebook.stetho.okhttp3.StethoInterceptor
import okhttp3.logging.HttpLoggingInterceptor

object YifyOkHttpClient : OkHttpClientBuilder({
    addInterceptor(HttpLoggingInterceptor().also {
        it.level = HttpLoggingInterceptor.Level.BODY
    })
    addNetworkInterceptor(StethoInterceptor())
    retryOnConnectionFailure(true)
})