package io.github.kunal26das.yify.movies.data.di;

import androidx.datastore.core.DataStore;
import dagger.internal.DaggerGenerated;
import dagger.internal.Factory;
import dagger.internal.Preconditions;
import dagger.internal.QualifierMetadata;
import dagger.internal.ScopeMetadata;
import io.github.kunal26das.yify.movies.data.preference.MoviePreferenceDto;
import io.github.kunal26das.yify.movies.domain.logger.ExceptionLogger;
import io.github.kunal26das.yify.movies.domain.preference.DataStoreFileProducer;
import javax.annotation.processing.Generated;
import javax.inject.Provider;
import kotlinx.serialization.json.Json;

@ScopeMetadata("javax.inject.Singleton")
@QualifierMetadata
@DaggerGenerated
@Generated(
    value = "dagger.internal.codegen.ComponentProcessor",
    comments = "https://dagger.dev"
)
@SuppressWarnings({
    "unchecked",
    "rawtypes",
    "KotlinInternal",
    "KotlinInternalInJava",
    "cast",
    "deprecation"
})
public final class MoviesDataModule_Companion_ProvidesMoviePreferenceDataStoreFactory implements Factory<DataStore<MoviePreferenceDto>> {
  private final Provider<DataStoreFileProducer> dataStoreProducerProvider;

  private final Provider<ExceptionLogger> exceptionLoggerProvider;

  private final Provider<Json> jsonProvider;

  public MoviesDataModule_Companion_ProvidesMoviePreferenceDataStoreFactory(
      Provider<DataStoreFileProducer> dataStoreProducerProvider,
      Provider<ExceptionLogger> exceptionLoggerProvider, Provider<Json> jsonProvider) {
    this.dataStoreProducerProvider = dataStoreProducerProvider;
    this.exceptionLoggerProvider = exceptionLoggerProvider;
    this.jsonProvider = jsonProvider;
  }

  @Override
  public DataStore<MoviePreferenceDto> get() {
    return providesMoviePreferenceDataStore(dataStoreProducerProvider.get(), exceptionLoggerProvider.get(), jsonProvider.get());
  }

  public static MoviesDataModule_Companion_ProvidesMoviePreferenceDataStoreFactory create(
      Provider<DataStoreFileProducer> dataStoreProducerProvider,
      Provider<ExceptionLogger> exceptionLoggerProvider, Provider<Json> jsonProvider) {
    return new MoviesDataModule_Companion_ProvidesMoviePreferenceDataStoreFactory(dataStoreProducerProvider, exceptionLoggerProvider, jsonProvider);
  }

  public static DataStore<MoviePreferenceDto> providesMoviePreferenceDataStore(
      DataStoreFileProducer dataStoreProducer, ExceptionLogger exceptionLogger, Json json) {
    return Preconditions.checkNotNullFromProvides(MoviesDataModule.Companion.providesMoviePreferenceDataStore(dataStoreProducer, exceptionLogger, json));
  }
}
