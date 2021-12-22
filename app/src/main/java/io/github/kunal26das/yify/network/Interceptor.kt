package io.github.kunal26das.yify.network

import android.content.Context
import io.github.kunal26das.core.network.local.RoomDatabaseProvider
import io.github.kunal26das.core.network.local.database
import io.github.kunal26das.model.Network
import io.github.kunal26das.model.Network.Companion.KEY_NETWORK
import io.github.kunal26das.yify.database.NetworkDatabase
import okhttp3.Interceptor
import okhttp3.Response

class Interceptor(context: Context) : Interceptor, RoomDatabaseProvider {

    private val database by database<NetworkDatabase>(context, KEY_NETWORK)

    override fun intercept(chain: Interceptor.Chain): Response {
        val request = chain.request()
        val response = chain.proceed(request)
        database.dao.insert(Network(request, response)).blockingAwait()
        return response
    }

}