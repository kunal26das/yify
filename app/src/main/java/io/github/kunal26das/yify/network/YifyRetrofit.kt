package io.github.kunal26das.yify.network

import androidx.essentials.network.RetrofitBuilder
import retrofit2.converter.gson.GsonConverterFactory

object YifyRetrofit : RetrofitBuilder({
    baseUrl("https://yts.mx/api/v2/")
    client(YifyOkHttpClient.INSTANCE)
    addConverterFactory(GsonConverterFactory.create(YifyGson.INSTANCE))
})