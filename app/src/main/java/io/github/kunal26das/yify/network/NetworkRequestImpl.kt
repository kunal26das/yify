package io.github.kunal26das.yify.network

import android.net.NetworkRequest
import io.github.kunal26das.yify.service.Service

abstract class NetworkRequestImpl(
    private val builder: (NetworkRequest.Builder.() -> Unit)? = null
) : Service<NetworkRequest> {
    override fun get(): NetworkRequest {
        return NetworkRequest.Builder().apply {
            builder?.invoke(this)
        }.build()
    }
}