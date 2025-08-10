package io.github.kunal26das.yify.movies.data.repo;

import dagger.internal.DaggerGenerated;
import dagger.internal.Factory;
import dagger.internal.QualifierMetadata;
import dagger.internal.ScopeMetadata;
import io.github.kunal26das.yify.movies.data.mapper.GenreMapper;
import io.github.kunal26das.yify.movies.data.mapper.MovieMapper;
import io.github.kunal26das.yify.movies.data.service.MovieService;
import io.github.kunal26das.yify.movies.domain.logger.ExceptionLogger;
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
public final class MovieRepositoryImpl_Factory implements Factory<MovieRepositoryImpl> {
  private final Provider<MovieService> movieServiceProvider;

  private final Provider<MovieMapper> movieMapperProvider;

  private final Provider<GenreMapper> genreMapperProvider;

  private final Provider<ExceptionLogger> exceptionLoggerProvider;

  public MovieRepositoryImpl_Factory(Provider<MovieService> movieServiceProvider,
      Provider<MovieMapper> movieMapperProvider, Provider<GenreMapper> genreMapperProvider,
      Provider<ExceptionLogger> exceptionLoggerProvider) {
    this.movieServiceProvider = movieServiceProvider;
    this.movieMapperProvider = movieMapperProvider;
    this.genreMapperProvider = genreMapperProvider;
    this.exceptionLoggerProvider = exceptionLoggerProvider;
  }

  @Override
  public MovieRepositoryImpl get() {
    return newInstance(movieServiceProvider.get(), movieMapperProvider.get(), genreMapperProvider.get(), exceptionLoggerProvider.get());
  }

  public static MovieRepositoryImpl_Factory create(Provider<MovieService> movieServiceProvider,
      Provider<MovieMapper> movieMapperProvider, Provider<GenreMapper> genreMapperProvider,
      Provider<ExceptionLogger> exceptionLoggerProvider) {
    return new MovieRepositoryImpl_Factory(movieServiceProvider, movieMapperProvider, genreMapperProvider, exceptionLoggerProvider);
  }

  public static MovieRepositoryImpl newInstance(MovieService movieService, MovieMapper movieMapper,
      GenreMapper genreMapper, ExceptionLogger exceptionLogger) {
    return new MovieRepositoryImpl(movieService, movieMapper, genreMapper, exceptionLogger);
  }
}
