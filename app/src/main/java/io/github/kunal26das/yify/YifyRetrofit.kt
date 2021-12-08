package io.github.kunal26das.yify

import io.github.kunal26das.yify.firebase.RemoteConfig
import io.github.kunal26das.yify.models.Constants
import io.github.kunal26das.yify.service.RetrofitImpl
import retrofit2.adapter.rxjava3.RxJava3CallAdapterFactory
import retrofit2.converter.gson.GsonConverterFactory

class YifyRetrofit : RetrofitImpl({
    client(YifyOkHttpClient().get())
    baseUrl(RemoteConfig[Constants.BASE_URL_YIFY].asString())
    addCallAdapterFactory(RxJava3CallAdapterFactory.create())
    addConverterFactory(GsonConverterFactory.create(YifyGson().get()))
})