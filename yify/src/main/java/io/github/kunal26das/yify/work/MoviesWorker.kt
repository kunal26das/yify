package io.github.kunal26das.yify.work

import android.content.Context
import androidx.hilt.work.HiltWorker
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import dagger.assisted.Assisted
import dagger.assisted.AssistedInject
import io.github.kunal26das.yify.Constants
import io.github.kunal26das.yify.domain.repo.MovieRepository
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.launch
import kotlin.math.ceil

@HiltWorker
class MoviesWorker @AssistedInject constructor(
    @Assisted context: Context,
    @Assisted params: WorkerParameters,
    private val movieRepository: MovieRepository,
) : CoroutineWorker(context, params) {
    override suspend fun doWork(): Result {
        val remoteCount = movieRepository.getRemoteMoviesCount()
        val localCount = movieRepository.getLocalMoviesCount()
        val diff = remoteCount - localCount
        val pages = ceil(diff / Constants.MAX_LOAD_SIZE.toFloat()).toInt()
        val job = CoroutineScope(Dispatchers.Default).launch {
            /*if (remoteCount > localCount)*/
            (Constants.FIRST_PAGE..pages).map { page ->
                async {
                    movieRepository.getMovies(Constants.MAX_LOAD_SIZE, page)
                    println("Loading page $page / $pages")
                }
            }.awaitAll()
        }
        job.join()
        return Result.success()
    }
}