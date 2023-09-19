package io.github.kunal26das.yify.init

import android.content.Context
import dagger.hilt.EntryPoint
import dagger.hilt.InstallIn
import dagger.hilt.android.EntryPointAccessors
import dagger.hilt.components.SingletonComponent

@EntryPoint
@InstallIn(SingletonComponent::class)
interface InitializerEntryPoint {

    fun inject(initializer: CoilInitializer)
    fun inject(initializer: StrictModeInitializer)

    companion object {
        fun resolve(context: Context): InitializerEntryPoint {
            return EntryPointAccessors.fromApplication(
                context.applicationContext,
                InitializerEntryPoint::class.java
            )
        }
    }
}