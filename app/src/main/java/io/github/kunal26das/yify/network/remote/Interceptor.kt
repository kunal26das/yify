package io.github.kunal26das.yify.network.remote

import android.content.Context
import io.github.kunal26das.yify.models.Network
import io.github.kunal26das.yify.models.Network.Companion.KEY_NETWORK
import io.github.kunal26das.yify.network.local.NetworkDatabase
import io.github.kunal26das.yify.network.local.RoomDatabaseProvider
import io.github.kunal26das.yify.network.local.database
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