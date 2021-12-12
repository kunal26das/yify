package io.github.kunal26das.core.network.remote

import io.github.kunal26das.core.singleton.Singleton
import retrofit2.Retrofit

abstract class RetrofitImpl(
    private val builder: Retrofit.Builder.() -> Unit
) : Singleton<Retrofit>() {
    override fun initialize(): Retrofit {
        return Retrofit.Builder().apply {
            builder.invoke(this)
        }.build()
    }
}