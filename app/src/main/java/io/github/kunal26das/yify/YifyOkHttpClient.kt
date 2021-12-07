package io.github.kunal26das.yify

import com.facebook.stetho.okhttp3.StethoInterceptor
import io.github.kunal26das.yify.service.OkHttpClientImpl

class YifyOkHttpClient : OkHttpClientImpl({
    addNetworkInterceptor(StethoInterceptor())
    retryOnConnectionFailure(true)
})