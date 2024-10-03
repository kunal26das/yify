package io.github.kunal26das.di

import dagger.Module
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import io.github.kunal26das.yify.movies.data.di.MoviesDataModule

@Module(
    includes = [
        MoviesDataModule::class,
    ]
)
@InstallIn(SingletonComponent::class)
internal object SingletonDependencies