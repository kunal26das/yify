package io.github.kunal26das.yify.hilt

import androidx.essentials.network.Builder
import androidx.work.Configuration

abstract class WorkConfigurationBuilder(
    private val builder: Configuration.Builder.() -> Unit
) : Builder<Configuration>() {
    override fun initialize(): Configuration {
        return Configuration.Builder().apply {
            builder.invoke(this)
        }.build()
    }
}