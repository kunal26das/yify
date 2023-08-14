package io.github.kunal26das.yify.di

import android.content.Context
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.MutablePreferences
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.preferencesDataStore
import dagger.Binds
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.android.qualifiers.ApplicationContext
import dagger.hilt.components.SingletonComponent
import io.github.kunal26das.yify.BuildConfig
import io.github.kunal26das.yify.preference.MoviePreferences
import io.github.kunal26das.yify.preference.MoviePreferencesImpl
import io.github.kunal26das.yify.preference.MutableMoviePreferences
import io.github.kunal26das.yify.preference.MutableMoviePreferencesImpl
import io.github.kunal26das.yify.preference.ObservableMoviePreferences
import io.github.kunal26das.yify.preference.ObservableMoviePreferencesImpl
import kotlinx.coroutines.flow.firstOrNull
import kotlinx.coroutines.runBlocking

@Module
@InstallIn(SingletonComponent::class)
abstract class PreferencesModule {

    @Binds
    abstract fun bindMoviePreferences(
        moviePreferences: MoviePreferencesImpl
    ): MoviePreferences

    @Binds
    abstract fun bindMutableMoviePreferences(
        mutableMoviePreferences: MutableMoviePreferencesImpl
    ): MutableMoviePreferences

    @Binds
    abstract fun bindObservableMoviePreferences(
        observableMoviePreferences: ObservableMoviePreferencesImpl
    ): ObservableMoviePreferences

    companion object {

        private val Context.dataStore by preferencesDataStore(
            name = BuildConfig.APPLICATION_ID
        )

        @Provides
        fun providesDataStore(
            @ApplicationContext context: Context
        ): DataStore<Preferences> {
            return context.dataStore
        }

        @Provides
        fun providePreferences(
            dataStore: DataStore<Preferences>
        ): Preferences? {
            return runBlocking {
                dataStore.data.firstOrNull()
            }
        }

        @Provides
        fun providesMutablePreferences(
            preferences: Preferences?,
        ): MutablePreferences? {
            return preferences?.toMutablePreferences()
        }
    }
}