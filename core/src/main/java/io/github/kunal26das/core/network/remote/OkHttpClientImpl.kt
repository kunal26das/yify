package io.github.kunal26das.core.network.remote

import io.github.kunal26das.core.service.Singleton
import okhttp3.OkHttpClient

abstract class OkHttpClientImpl(
    private val builder: OkHttpClient.Builder.() -> Unit
) : Singleton<OkHttpClient>() {
    override fun initialize(): OkHttpClient {
        return OkHttpClient.Builder().apply {
            builder.invoke(this)
        }.build()
    }
}