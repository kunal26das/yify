package io.github.kunal26das.core.gson

import com.google.gson.Gson
import com.google.gson.GsonBuilder
import io.github.kunal26das.core.singleton.Singleton

abstract class GsonImpl(
    private val builder: (GsonBuilder.() -> Unit)? = null
) : Singleton<Gson>() {
    override fun initialize(): Gson {
        return GsonBuilder().apply {
            builder?.invoke(this)
        }.create()
    }
}