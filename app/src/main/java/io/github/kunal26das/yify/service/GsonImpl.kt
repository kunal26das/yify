package io.github.kunal26das.yify.service

import com.google.gson.Gson
import com.google.gson.GsonBuilder

abstract class GsonImpl(
    private val builder: (GsonBuilder.() -> Unit)? = null
) : Service<Gson> {
    override fun get(): Gson {
        return GsonBuilder().apply {
            builder?.invoke(this)
        }.create()
    }
}