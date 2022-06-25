package io.github.kunal26das.yify.network

import androidx.essentials.network.remote.RetrofitBuilder
import retrofit2.converter.gson.GsonConverterFactory

object YifyRetrofit : RetrofitBuilder({
    baseUrl("https://yts.mx/api/v2/")
    client(YifyOkHttpClient.getInstance())
    addConverterFactory(GsonConverterFactory.create(YifyGson.getInstance()))
})