package io.github.kunal26das.yify.singleton

import android.content.Context
import retrofit2.adapter.rxjava3.RxJava3CallAdapterFactory
import retrofit2.converter.gson.GsonConverterFactory

class YifyRetrofit(context: Context) : io.github.kunal26das.network.remote.RetrofitImpl({
    baseUrl("https://yts.mx/api/v2/")
    client(YifyOkHttpClient(context).get())
    addCallAdapterFactory(RxJava3CallAdapterFactory.create())
    addConverterFactory(GsonConverterFactory.create(YifyGson().get()))
})