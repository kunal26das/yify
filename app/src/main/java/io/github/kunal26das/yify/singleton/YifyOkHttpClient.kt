package io.github.kunal26das.yify.singleton

import android.content.Context
import com.facebook.stetho.okhttp3.StethoInterceptor
import io.github.kunal26das.yify.network.Interceptor

class YifyOkHttpClient(context: Context) : io.github.kunal26das.network.remote.OkHttpClientImpl({
    addNetworkInterceptor(StethoInterceptor())
    addInterceptor(Interceptor(context))
    retryOnConnectionFailure(true)
})