package io.github.kunal26das.yify.usecase

import androidx.lifecycle.asFlow
import androidx.work.Constraints
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkInfo
import androidx.work.WorkManager
import io.github.kunal26das.yify.BuildConfig
import io.github.kunal26das.yify.work.MoviesWorker
import kotlinx.coroutines.flow.Flow
import javax.inject.Inject

class MoviesWorkerUseCase @Inject constructor(
    private val workManager: WorkManager,
) {
    fun enqueue(notificationChannel: String): Flow<WorkInfo> {
        val constraints = Constraints.Builder().apply {
            setRequiresDeviceIdle(BuildConfig.DEBUG.not())
            setRequiredNetworkType(NetworkType.CONNECTED)
            setRequiresBatteryNotLow(true)
            setRequiresStorageNotLow(true)
        }.build()
        val inputData = MoviesWorker.getInputData(notificationChannel)
        val workRequest = OneTimeWorkRequestBuilder<MoviesWorker>().apply {
            setConstraints(constraints)
            setInputData(inputData)
        }.build()
        workManager.enqueueUniqueWork(WORK_NAME, ExistingWorkPolicy.KEEP, workRequest)
        return workManager.getWorkInfoByIdLiveData(workRequest.id).asFlow()
    }

    companion object {
        private const val WORK_NAME = "sync_movies"
    }
}