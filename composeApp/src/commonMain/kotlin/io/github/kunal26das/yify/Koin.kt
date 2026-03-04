package io.github.kunal26das.yify

import io.github.kunal26das.yify.movies.data.di.moviesDataModule
import io.github.kunal26das.yify.movies.di.commonModule
import org.koin.core.KoinApplication
import org.koin.core.context.startKoin

fun initKoin(
    block: KoinApplication.() -> Unit
) {
    startKoin {
        modules(
            commonModule,
            moviesDataModule,
        )
        block.invoke(this)
    }
}