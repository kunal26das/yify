package io.github.kunal26das.core.network.remote

import android.net.NetworkRequest
import io.github.kunal26das.core.singleton.Singleton

abstract class NetworkRequestImpl(
    private val builder: (NetworkRequest.Builder.() -> Unit)? = null
) : Singleton<NetworkRequest>() {
    override fun initialize(): NetworkRequest {
        return NetworkRequest.Builder().apply {
            builder?.invoke(this)
        }.build()
    }
}