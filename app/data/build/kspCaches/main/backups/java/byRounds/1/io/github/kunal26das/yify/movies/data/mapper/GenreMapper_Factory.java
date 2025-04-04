package io.github.kunal26das.yify.movies.data.mapper;

import dagger.internal.DaggerGenerated;
import dagger.internal.Factory;
import dagger.internal.QualifierMetadata;
import dagger.internal.ScopeMetadata;
import io.github.kunal26das.yify.movies.domain.logger.ExceptionLogger;
import io.github.kunal26das.yify.movies.domain.logger.Logger;
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
public final class GenreMapper_Factory implements Factory<GenreMapper> {
  private final Provider<ExceptionLogger> exceptionLoggerProvider;

  private final Provider<Logger> loggerProvider;

  public GenreMapper_Factory(Provider<ExceptionLogger> exceptionLoggerProvider,
      Provider<Logger> loggerProvider) {
    this.exceptionLoggerProvider = exceptionLoggerProvider;
    this.loggerProvider = loggerProvider;
  }

  @Override
  public GenreMapper get() {
    return newInstance(exceptionLoggerProvider.get(), loggerProvider.get());
  }

  public static GenreMapper_Factory create(Provider<ExceptionLogger> exceptionLoggerProvider,
      Provider<Logger> loggerProvider) {
    return new GenreMapper_Factory(exceptionLoggerProvider, loggerProvider);
  }

  public static GenreMapper newInstance(ExceptionLogger exceptionLogger, Logger logger) {
    return new GenreMapper(exceptionLogger, logger);
  }
}
