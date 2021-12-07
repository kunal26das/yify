package io.github.kunal26das.yify.service

import retrofit2.Retrofit

abstract class RetrofitImpl(
    private val builder: Retrofit.Builder.() -> Unit
) : Service<Retrofit> {
    override fun get(): Retrofit {
        return Retrofit.Builder().apply {
            builder.invoke(this)
        }.build()
    }
}