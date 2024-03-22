package io.github.kunal26das.yify.movies.di

import androidx.datastore.core.DataStore
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import io.github.kunal26das.common.domain.logger.ExceptionLogger
import io.github.kunal26das.common.domain.preference.DataStoreCreator
import io.github.kunal26das.common.domain.preference.DataStoreFileProducer
import io.github.kunal26das.yify.movies.presentation.UiPreference
import kotlinx.serialization.json.Json
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
internal abstract class MoviesModule {

    companion object {

        private const val UI_PREFERENCE_JSON = "ui_preference.json"

        @Provides
        @Singleton
        fun providesUiPreferenceDataStore(
            dataStoreProducer: DataStoreFileProducer,
            exceptionLogger: ExceptionLogger,
            json: Json,
        ): DataStore<UiPreference?> {
            return DataStoreCreator.create(
                json = json,
                exceptionLogger = exceptionLogger,
                dataStoreFileProducer = dataStoreProducer,
                fileName = UI_PREFERENCE_JSON,
                serializationStrategy = UiPreference.serializer(),
                deserializationStrategy = UiPreference.serializer(),
            )
        }
    }
}