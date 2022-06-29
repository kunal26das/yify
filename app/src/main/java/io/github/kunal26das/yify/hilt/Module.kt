package io.github.kunal26das.yify.hilt

import android.content.Context
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.android.qualifiers.ApplicationContext
import dagger.hilt.components.SingletonComponent
import io.github.kunal26das.yify.network.YifyRetrofit
import io.github.kunal26das.yify.service.MovieService

@Module
@InstallIn(SingletonComponent::class)
object Module {

    @Provides
    fun getPreferences(
        @ApplicationContext context: Context
    ) = context.getSharedPreferences(context.packageName, Context.MODE_PRIVATE)!!

    @Provides
    fun getMovieService(): MovieService {
        return YifyRetrofit.INSTANCE.create(MovieService::class.java)
    }

}