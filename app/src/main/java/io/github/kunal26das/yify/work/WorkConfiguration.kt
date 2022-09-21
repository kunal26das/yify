package io.github.kunal26das.yify.work

import androidx.hilt.work.HiltWorkerFactory
import io.github.kunal26das.yify.hilt.WorkConfigurationBuilder
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class WorkConfiguration @Inject constructor(
    workerFactory: HiltWorkerFactory
) : WorkConfigurationBuilder({
    setWorkerFactory(workerFactory)
})