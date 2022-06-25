package io.github.kunal26das.yify

import android.content.Context
import androidx.essentials.network.local.Preferences
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.android.qualifiers.ApplicationContext
import dagger.hilt.components.SingletonComponent
import io.github.kunal26das.yify.database.MovieDatabase
import io.github.kunal26das.yify.database.MovieDatabaseBuilder
import io.github.kunal26das.yify.network.YifyRetrofit
import io.github.kunal26das.yify.preference.MoviePreferences
import io.github.kunal26das.yify.service.MovieService

@Module
@InstallIn(SingletonComponent::class)
object Module {

    @Provides
    fun getMoviePreferences(
        @ApplicationContext context: Context
    ): Preferences {
        return MoviePreferences(context)
    }

    @Provides
    fun getMovieDatabase(
        @ApplicationContext context: Context
    ): MovieDatabase {
        return MovieDatabaseBuilder(context).getInstance()
    }

    @Provides
    fun getMovieService(): MovieService {
        return YifyRetrofit.getInstance().create(MovieService::class.java)
    }

}