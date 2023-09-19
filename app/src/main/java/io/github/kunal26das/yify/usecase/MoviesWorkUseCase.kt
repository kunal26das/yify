package io.github.kunal26das.yify.usecase

import androidx.lifecycle.Observer
import androidx.work.Constraints
import androidx.work.NetworkType
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkInfo
import androidx.work.WorkManager
import io.github.kunal26das.yify.Notification
import io.github.kunal26das.yify.work.MoviesWorker
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.launch
import java.util.concurrent.TimeUnit
import javax.inject.Inject

class MoviesWorkUseCase @Inject constructor(
    private val workManager: WorkManager
) {
    fun enqueue(): Flow<WorkInfo> {
        val constraints = Constraints.Builder().apply {
            setRequiredNetworkType(NetworkType.CONNECTED)
            setRequiresBatteryNotLow(true)
            setRequiresStorageNotLow(true)
        }.build()
        val inputData = MoviesWorker.getInputData(Notification.Channel.Sync)
        val workRequest = PeriodicWorkRequestBuilder<MoviesWorker>(
            repeatIntervalTimeUnit = TimeUnit.DAYS,
            repeatInterval = 1,
        ).apply {
            setConstraints(constraints)
            setInputData(inputData)
        }.build()
        workManager.enqueue(workRequest)
        val liveData = workManager.getWorkInfoByIdLiveData(workRequest.id)
        return callbackFlow {
            val observer = Observer<WorkInfo> {
                launch { send(it) }
            }
            liveData.observeForever(observer)
            awaitClose {
                liveData.removeObserver(observer)
            }
        }
    }
}