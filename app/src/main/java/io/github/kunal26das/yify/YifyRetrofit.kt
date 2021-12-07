package io.github.kunal26das.yify

import io.github.kunal26das.yify.service.RetrofitImpl
import retrofit2.adapter.rxjava3.RxJava3CallAdapterFactory
import retrofit2.converter.gson.GsonConverterFactory

object YifyRetrofit : RetrofitImpl({
    baseUrl("https://yts.mx/api/v2/")
    client(YifyOkHttpClient.get())
    addCallAdapterFactory(RxJava3CallAdapterFactory.create())
    addConverterFactory(GsonConverterFactory.create(YifyGson.get()))
})