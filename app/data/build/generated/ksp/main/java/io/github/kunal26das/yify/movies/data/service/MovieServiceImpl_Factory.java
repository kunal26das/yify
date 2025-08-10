package io.github.kunal26das.yify.movies.data.service;

import dagger.internal.DaggerGenerated;
import dagger.internal.Factory;
import dagger.internal.QualifierMetadata;
import dagger.internal.ScopeMetadata;
import io.github.kunal26das.yify.movies.domain.logger.ExceptionLogger;
import io.ktor.client.HttpClient;
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
public final class MovieServiceImpl_Factory implements Factory<MovieServiceImpl> {
  private final Provider<HttpClient> httpClientProvider;

  private final Provider<ExceptionLogger> exceptionLoggerProvider;

  public MovieServiceImpl_Factory(Provider<HttpClient> httpClientProvider,
      Provider<ExceptionLogger> exceptionLoggerProvider) {
    this.httpClientProvider = httpClientProvider;
    this.exceptionLoggerProvider = exceptionLoggerProvider;
  }

  @Override
  public MovieServiceImpl get() {
    return newInstance(httpClientProvider.get(), exceptionLoggerProvider.get());
  }

  public static MovieServiceImpl_Factory create(Provider<HttpClient> httpClientProvider,
      Provider<ExceptionLogger> exceptionLoggerProvider) {
    return new MovieServiceImpl_Factory(httpClientProvider, exceptionLoggerProvider);
  }

  public static MovieServiceImpl newInstance(HttpClient httpClient,
      ExceptionLogger exceptionLogger) {
    return new MovieServiceImpl(httpClient, exceptionLogger);
  }
}
