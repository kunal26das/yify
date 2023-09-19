package io.github.kunal26das.yify.work

import android.Manifest
import android.content.Context
import androidx.core.app.NotificationCompat
import androidx.hilt.work.HiltWorker
import androidx.work.CoroutineWorker
import androidx.work.Data
import androidx.work.ForegroundInfo
import androidx.work.WorkerParameters
import androidx.work.workDataOf
import dagger.assisted.Assisted
import dagger.assisted.AssistedInject
import io.github.kunal26das.common.util.hasPermission
import io.github.kunal26das.yify.Constants
import io.github.kunal26das.yify.R
import io.github.kunal26das.yify.domain.model.MoviePreference
import io.github.kunal26das.yify.domain.repo.MovieRepository
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlin.math.ceil

@HiltWorker
class MoviesWorker @AssistedInject constructor(
    @Assisted context: Context,
    @Assisted params: WorkerParameters,
    private val movieRepository: MovieRepository,
) : CoroutineWorker(context, params) {

    private val notificationId = Int.MAX_VALUE
    private val channelId = params.inputData.getString(CHANNEL_ID)

    override suspend fun doWork() = withContext(Dispatchers.IO) {
        val remoteCount = movieRepository.getRemoteMoviesCount()
        val localCount = movieRepository.getLocalMoviesCount()
        val diff = remoteCount.getOrNull()?.minus(localCount) ?: 0
        if (diff > 0) {
            val pages = ceil(diff / Constants.MAX_LOAD_SIZE.toFloat()).toInt()
            (pages downTo Constants.FIRST_PAGE).forEach { page ->
                movieRepository.getMovies(
                    limit = Constants.MAX_LOAD_SIZE,
                    page = page,
                    moviePreference = MoviePreference.Default,
                    updateDatabase = true,
                )
                if (applicationContext.hasPermission(Manifest.permission.POST_NOTIFICATIONS)) {
                    setForeground(setProgress(pages - page, pages))
                }
            }
        }
        Result.success()
    }

    private fun setProgress(page: Int, pages: Int): ForegroundInfo {
        val notification = NotificationCompat.Builder(
            applicationContext,
            channelId.orEmpty(),
        ).apply {
            setContentTitle(applicationContext.getString(R.string.synchronising))
            setProgress(pages, page, false)
            setSmallIcon(R.drawable.outline_movie_24)
            setContentText("$page / $pages")
            setOngoing(true)
        }.build()
        return ForegroundInfo(notificationId, notification)
    }

    companion object {
        private const val CHANNEL_ID = "channel_id"

        fun getInputData(channelId: String): Data {
            return workDataOf(CHANNEL_ID to channelId)
        }
    }
}