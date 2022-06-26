package io.github.kunal26das.yify

import android.content.Context
import androidx.essentials.network.local.Preferences
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
    ) = Preferences(context.getSharedPreferences(context.packageName, Context.MODE_PRIVATE))

    @Provides
    fun getMovieService(): MovieService {
        return YifyRetrofit.getInstance().create(MovieService::class.java)
    }

}