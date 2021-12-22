package io.github.kunal26das.network.gson

import com.google.gson.Gson
import com.google.gson.GsonBuilder

abstract class GsonImpl(
    private val builder: (GsonBuilder.() -> Unit)? = null
) : io.github.kunal26das.network.Singleton<Gson>() {
    override fun initialize(): Gson {
        return GsonBuilder().apply {
            builder?.invoke(this)
        }.create()
    }
}