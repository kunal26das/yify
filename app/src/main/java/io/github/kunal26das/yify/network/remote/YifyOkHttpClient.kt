package io.github.kunal26das.yify.network.remote

import android.content.Context
import com.facebook.stetho.okhttp3.StethoInterceptor

class YifyOkHttpClient(context: Context) : OkHttpClientImpl({
    addNetworkInterceptor(StethoInterceptor())
    addInterceptor(Interceptor(context))
    retryOnConnectionFailure(true)
})