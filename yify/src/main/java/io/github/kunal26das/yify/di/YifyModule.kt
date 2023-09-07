package io.github.kunal26das.yify.di

import android.content.Context
import androidx.datastore.core.DataStore
import androidx.datastore.core.DataStoreFactory
import androidx.datastore.core.handlers.ReplaceFileCorruptionHandler
import androidx.datastore.dataStoreFile
import androidx.datastore.preferences.core.PreferenceDataStoreFactory
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.emptyPreferences
import androidx.datastore.preferences.preferencesDataStoreFile
import androidx.room.Room
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.android.qualifiers.ApplicationContext
import dagger.hilt.components.SingletonComponent
import io.github.kunal26das.yify.db.YifyDatabase
import io.github.kunal26das.yify.domain.db.MovieDao
import io.github.kunal26das.yify.model.MoviePreference
import io.github.kunal26das.yify.model.MoviePreferencesSerializer
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob


@Module
@InstallIn(SingletonComponent::class)
object YifyModule {

    private const val YIFY_DATABASE = "yify.db"
    private const val MOVIE_PREFERENCE_JSON = "movie_preference.json"

    @Provides
    fun providesDataStore(
        @ApplicationContext context: Context
    ): DataStore<Preferences> {
        return PreferenceDataStoreFactory.create(
            produceFile = { context.preferencesDataStoreFile(context.packageName) },
            scope = CoroutineScope(Dispatchers.IO + SupervisorJob()),
            corruptionHandler = ReplaceFileCorruptionHandler(
                produceNewData = { emptyPreferences() }
            ),
        )
    }

    @Provides
    fun providesMoviePreferenceDataStore(
        @ApplicationContext context: Context,
    ): DataStore<MoviePreference> {
        return DataStoreFactory.create(
            serializer = MoviePreferencesSerializer,
            produceFile = { context.dataStoreFile(MOVIE_PREFERENCE_JSON) },
            scope = CoroutineScope(Dispatchers.IO + SupervisorJob()),
            corruptionHandler = ReplaceFileCorruptionHandler(
                produceNewData = { MoviePreference() }
            ),
        )
    }

    @Provides
    fun providesYifyDatabase(
        @ApplicationContext context: Context
    ): YifyDatabase {
        return Room.databaseBuilder(
            context = context,
            klass = YifyDatabase::class.java,
            name = YIFY_DATABASE,
        ).build()
    }

    @Provides
    fun providesMovieDao(
        yifyDatabase: YifyDatabase
    ): MovieDao {
        return yifyDatabase.movieDao
    }
}