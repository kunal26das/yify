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
import dagger.Binds
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.android.qualifiers.ApplicationContext
import dagger.hilt.components.SingletonComponent
import io.github.kunal26das.yify.db.AbstractYifyDatabase
import io.github.kunal26das.yify.db.FlowPreferenceImpl
import io.github.kunal26das.yify.db.ImmutablePreferenceImpl
import io.github.kunal26das.yify.db.MutablePreferencesImpl
import io.github.kunal26das.yify.db.serializer.MoviePreferencesSerializer
import io.github.kunal26das.yify.domain.db.FlowPreference
import io.github.kunal26das.yify.domain.db.ImmutablePreference
import io.github.kunal26das.yify.domain.db.MovieDao
import io.github.kunal26das.yify.domain.db.MutablePreference
import io.github.kunal26das.yify.domain.db.YifyDatabase
import io.github.kunal26das.yify.domain.model.MoviePreference
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import javax.inject.Singleton


@Module
@InstallIn(SingletonComponent::class)
internal abstract class YifyModule {

    @Binds
    abstract fun bindImmutablePreference(
        immutablePreferenceImpl: ImmutablePreferenceImpl
    ): ImmutablePreference

    @Binds
    abstract fun bindMutablePreference(
        mutablePreferencesImpl: MutablePreferencesImpl
    ): MutablePreference

    @Binds
    abstract fun bindFlowPreference(
        flowPreferenceImpl: FlowPreferenceImpl
    ): FlowPreference

    companion object {

        private const val YIFY_DATABASE = "yify.db"
        private const val MOVIE_PREFERENCE_JSON = "movie_preference.json"

        @Provides
        @Singleton
        fun providesPreferenceDataStore(
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
        @Singleton
        fun providesMoviePreferenceDataStore(
            @ApplicationContext context: Context,
        ): DataStore<MoviePreference> {
            return DataStoreFactory.create(
                serializer = MoviePreferencesSerializer,
                produceFile = { context.dataStoreFile(MOVIE_PREFERENCE_JSON) },
                scope = CoroutineScope(Dispatchers.IO + SupervisorJob()),
                corruptionHandler = ReplaceFileCorruptionHandler(
                    produceNewData = { MoviePreference.Default }
                ),
            )
        }

        @Provides
        @Singleton
        fun providesYifyDatabase(
            @ApplicationContext context: Context
        ): YifyDatabase {
            return Room.databaseBuilder(
                context = context,
                klass = AbstractYifyDatabase::class.java,
                name = YIFY_DATABASE,
            ).apply {
                fallbackToDestructiveMigration()
            }.build()
        }

        @Provides
        fun providesMovieDao(
            abstractYifyDatabase: YifyDatabase
        ): MovieDao {
            return abstractYifyDatabase.movieDao
        }
    }
}