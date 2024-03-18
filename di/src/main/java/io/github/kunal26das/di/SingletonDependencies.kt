package io.github.kunal26das.di

import dagger.Module
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import io.github.kunal26das.yify.data.di.YifyDataModule

@Module(
    includes = [
        YifyDataModule::class,
    ]
)
@InstallIn(SingletonComponent::class)
internal object SingletonDependencies