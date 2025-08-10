package io.github.kunal26das.yify.movies.data.preference;

import androidx.datastore.core.DataStore;
import dagger.internal.DaggerGenerated;
import dagger.internal.Factory;
import dagger.internal.QualifierMetadata;
import dagger.internal.ScopeMetadata;
import javax.annotation.processing.Generated;
import javax.inject.Provider;

@ScopeMetadata
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
public final class MoviePreferencesImpl_Factory implements Factory<MoviePreferencesImpl> {
  private final Provider<DataStore<MoviePreferenceDto>> moviePreferenceDataStoreProvider;

  public MoviePreferencesImpl_Factory(
      Provider<DataStore<MoviePreferenceDto>> moviePreferenceDataStoreProvider) {
    this.moviePreferenceDataStoreProvider = moviePreferenceDataStoreProvider;
  }

  @Override
  public MoviePreferencesImpl get() {
    return newInstance(moviePreferenceDataStoreProvider.get());
  }

  public static MoviePreferencesImpl_Factory create(
      Provider<DataStore<MoviePreferenceDto>> moviePreferenceDataStoreProvider) {
    return new MoviePreferencesImpl_Factory(moviePreferenceDataStoreProvider);
  }

  public static MoviePreferencesImpl newInstance(
      DataStore<MoviePreferenceDto> moviePreferenceDataStore) {
    return new MoviePreferencesImpl(moviePreferenceDataStore);
  }
}
