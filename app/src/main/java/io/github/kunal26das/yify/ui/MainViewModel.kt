package io.github.kunal26das.yify.ui

import androidx.work.WorkInfo
import dagger.hilt.android.lifecycle.HiltViewModel
import io.github.kunal26das.common.core.ViewModel
import io.github.kunal26das.yify.usecase.MoviesWorkUseCase
import kotlinx.coroutines.flow.Flow
import javax.inject.Inject

@HiltViewModel
class MainViewModel @Inject constructor(
    private val moviesWorkUseCase: MoviesWorkUseCase,
) : ViewModel() {
    fun enqueueMoviesWork(): Flow<WorkInfo> {
        return moviesWorkUseCase.enqueue()
    }
}