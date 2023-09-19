package io.github.kunal26das.yify.ui

import androidx.work.WorkInfo
import dagger.hilt.android.lifecycle.HiltViewModel
import io.github.kunal26das.common.core.ViewModel
import io.github.kunal26das.yify.Notification
import io.github.kunal26das.yify.usecase.MoviesWorkerUseCase
import kotlinx.coroutines.flow.Flow
import javax.inject.Inject

@HiltViewModel
class MainViewModel @Inject constructor(
    private val moviesWorkerUseCase: MoviesWorkerUseCase,
) : ViewModel() {
    fun enqueueMoviesWork(): Flow<WorkInfo> {
        return moviesWorkerUseCase.enqueue(Notification.Channel.Sync.name)
    }
}