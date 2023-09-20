package io.github.kunal26das.yify.work

import android.content.Context
import androidx.hilt.work.HiltWorkerFactory
import androidx.work.ListenableWorker
import androidx.work.WorkerFactory
import androidx.work.WorkerParameters
import io.github.kunal26das.yify.domain.db.YifyDatabase
import io.github.kunal26das.yify.domain.repo.MovieRepository
import javax.inject.Inject

class YifyWorkerFactory @Inject constructor(
    private val hiltWorkerFactory: HiltWorkerFactory,
    private val movieRepository: MovieRepository,
    private val yifyDatabase: YifyDatabase,
) : WorkerFactory() {
    override fun createWorker(
        appContext: Context,
        workerClassName: String,
        workerParameters: WorkerParameters
    ): ListenableWorker? {
        val worker = hiltWorkerFactory.createWorker(appContext, workerClassName, workerParameters)
        if (worker != null) {
            return worker
        }
        if (workerClassName == MoviesWorker::class.qualifiedName) {
            return MoviesWorker(appContext, workerParameters, yifyDatabase, movieRepository)
        }
        return null
    }
}