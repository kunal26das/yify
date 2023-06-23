package io.github.kunal26das.yify.hilt

import dagger.Module
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent

@Module(
    includes = [
        PreferencesModule::class
    ]
)
@InstallIn(SingletonComponent::class)
object YifyModule