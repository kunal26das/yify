package io.github.kunal26das.yify.ui

import androidx.work.Constraints
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import dagger.hilt.android.lifecycle.HiltViewModel
import io.github.kunal26das.common.core.ViewModel
import io.github.kunal26das.yify.work.MoviesWorker
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import javax.inject.Inject

@HiltViewModel
class MainViewModel @Inject constructor(
    private val workManager: WorkManager,
) : ViewModel() {

    private val _loading = MutableStateFlow(false)
    val loading = _loading.asStateFlow()

    fun enqueueMoviesWork() {
        val constraints = Constraints.Builder().apply {
            setRequiredNetworkType(NetworkType.CONNECTED)
        }.build()
        val workRequest = OneTimeWorkRequestBuilder<MoviesWorker>().apply {
            setConstraints(constraints)
        }.build()
        workManager.getWorkInfoByIdLiveData(workRequest.id).observeForever {
            _loading.value = it.state.isFinished.not()
        }
        workManager.enqueue(workRequest)
    }
}