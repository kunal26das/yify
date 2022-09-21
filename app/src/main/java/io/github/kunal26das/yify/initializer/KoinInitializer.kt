package io.github.kunal26das.yify.initializer

import android.content.Context
import org.koin.android.ext.koin.androidContext
import org.koin.core.KoinApplication
import org.koin.core.component.KoinComponent
import org.koin.core.component.inject
import org.koin.core.context.startKoin

class KoinInitializer : IndependentInitializer<KoinApplication> {

    override fun create(context: Context): KoinApplication {
        return startKoin {
            androidContext(context.applicationContext)
        }
    }

    companion object : KoinComponent {
        val ApplicationContext by inject<Context>()
    }

}