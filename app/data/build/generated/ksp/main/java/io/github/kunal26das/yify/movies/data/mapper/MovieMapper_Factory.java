package io.github.kunal26das.yify.movies.data.mapper;

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
public final class MovieMapper_Factory implements Factory<MovieMapper> {
  private final Provider<LanguageMapper> languageMapperProvider;

  private final Provider<GenreMapper> genreMapperProvider;

  public MovieMapper_Factory(Provider<LanguageMapper> languageMapperProvider,
      Provider<GenreMapper> genreMapperProvider) {
    this.languageMapperProvider = languageMapperProvider;
    this.genreMapperProvider = genreMapperProvider;
  }

  @Override
  public MovieMapper get() {
    return newInstance(languageMapperProvider.get(), genreMapperProvider.get());
  }

  public static MovieMapper_Factory create(Provider<LanguageMapper> languageMapperProvider,
      Provider<GenreMapper> genreMapperProvider) {
    return new MovieMapper_Factory(languageMapperProvider, genreMapperProvider);
  }

  public static MovieMapper newInstance(LanguageMapper languageMapper, GenreMapper genreMapper) {
    return new MovieMapper(languageMapper, genreMapper);
  }
}
