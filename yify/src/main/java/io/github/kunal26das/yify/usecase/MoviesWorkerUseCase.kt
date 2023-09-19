package io.github.kunal26das.yify.usecase

import androidx.lifecycle.asFlow
import androidx.work.Constraints
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.NetworkType
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkInfo
import androidx.work.WorkManager
import io.github.kunal26das.yify.work.MoviesWorker
import kotlinx.coroutines.flow.Flow
import java.util.concurrent.TimeUnit
import javax.inject.Inject

class MoviesWorkerUseCase @Inject constructor(
    private val workManager: WorkManager,
) {
    fun enqueue(notificationChannel: String): Flow<WorkInfo> {
        val constraints = Constraints.Builder().apply {
            setRequiredNetworkType(NetworkType.CONNECTED)
            setRequiresBatteryNotLow(true)
            setRequiresStorageNotLow(true)
            setRequiresDeviceIdle(true)
        }.build()
        val inputData = MoviesWorker.getInputData(notificationChannel)
        val workRequest = PeriodicWorkRequestBuilder<MoviesWorker>(
            repeatIntervalTimeUnit = TimeUnit.DAYS,
            repeatInterval = 1,
        ).apply {
            setConstraints(constraints)
            setInputData(inputData)
        }.build()
        workManager.enqueueUniquePeriodicWork(
            WORK_NAME,
            ExistingPeriodicWorkPolicy.KEEP,
            workRequest,
        )
        val liveData = workManager.getWorkInfoByIdLiveData(workRequest.id)
        return liveData.asFlow()
    }

    companion object {
        private const val WORK_NAME = "sync_movies"
    }
}