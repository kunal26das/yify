package io.github.kunal26das.yify

import androidx.essentials.core.Application
import coil.ImageLoader
import coil.util.CoilUtils
import com.facebook.stetho.Stetho
import com.facebook.stetho.okhttp3.StethoInterceptor
import com.google.gson.GsonBuilder
import io.github.kunal26das.yify.source.YifyDataSource
import io.github.kunal26das.yify.source.repositories.MovieRepository
import io.github.kunal26das.yify.ui.YifyViewModel
import okhttp3.OkHttpClient
import retrofit2.Retrofit
import retrofit2.adapter.rxjava2.RxJava2CallAdapterFactory
import retrofit2.converter.gson.GsonConverterFactory

class Yify : Application() {

    override fun onCreate() {
        super.onCreate()
        initNetworking()
        single { YifyDataSource() }
        single { MovieRepository() }
        viewModel { YifyViewModel() }
        single {
            ImageLoader.Builder(this)
                .okHttpClient(OkHttpClient.Builder().apply {
                    cache(CoilUtils.createDefaultCache(applicationContext))
                }.build())
                .build()
        }
        Stetho.initializeWithDefaults(applicationContext)
    }

    private fun initNetworking() {
        val gson = GsonBuilder().create()
        val okHttp = OkHttpClient.Builder().apply {
            networkInterceptors().add(StethoInterceptor())
            retryOnConnectionFailure(true)
        }.build()
        single {
            Retrofit.Builder().apply {
                client(okHttp)
                baseUrl(BASE_URL)
                addConverterFactory(GsonConverterFactory.create(gson))
                addCallAdapterFactory(RxJava2CallAdapterFactory.create())
            }.build()
        }
    }

    companion object {
        private const val BASE_URL = "https://yts.mx/api/v2/"
    }

}