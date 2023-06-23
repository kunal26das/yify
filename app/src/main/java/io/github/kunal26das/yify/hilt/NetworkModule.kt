package io.github.kunal26das.yify.hilt

import com.google.gson.Gson
import com.google.gson.GsonBuilder
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import io.github.kunal26das.yify.service.MovieService
import okhttp3.OkHttpClient
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory

@Module
@InstallIn(SingletonComponent::class)
object NetworkModule {
    @Provides
    fun getMovieService(
        retrofit: Retrofit
    ) = retrofit.create(MovieService::class.java)

    @Provides
    fun providesOkHttp(): OkHttpClient {
        return OkHttpClient.Builder().apply {
            retryOnConnectionFailure(true)
        }.build()
    }

    @Provides
    fun providesGson(): Gson {
        return GsonBuilder().create()
    }

    @Provides
    fun providesRetrofit(
        okHttpClient: OkHttpClient,
        gson: Gson,
    ): Retrofit {
        return Retrofit.Builder().apply {
            baseUrl("https://yts.mx/api/v2/")
            client(okHttpClient)
            addConverterFactory(GsonConverterFactory.create(gson))
        }.build()
    }
}