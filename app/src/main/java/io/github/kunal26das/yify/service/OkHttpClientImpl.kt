package io.github.kunal26das.yify.service

import okhttp3.OkHttpClient

abstract class OkHttpClientImpl(
    private val builder: OkHttpClient.Builder.() -> Unit
) : Service<OkHttpClient> {
    override fun get(): OkHttpClient {
        return OkHttpClient.Builder().apply {
            builder.invoke(this)
        }.build()
    }
}