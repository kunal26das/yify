package io.github.kunal26das.common.logger

import android.content.Context
import android.os.StrictMode
import androidx.core.content.ContextCompat
import com.google.firebase.crashlytics.FirebaseCrashlytics
import dagger.hilt.android.qualifiers.ApplicationContext
import io.github.kunal26das.common.domain.logger.ExceptionLogger
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
internal class CrashlyticsLogger @Inject constructor(
    @ApplicationContext private val context: Context,
    private val crashlytics: FirebaseCrashlytics,
) : ExceptionLogger {

    init {
        StrictMode.setThreadPolicy(
            StrictMode.ThreadPolicy.Builder().apply {
                penaltyListener(ContextCompat.getMainExecutor(context)) {
                    log(it)
                }
                detectAll()
            }.build()
        )
        StrictMode.setVmPolicy(
            StrictMode.VmPolicy.Builder().apply {
                penaltyListener(ContextCompat.getMainExecutor(context)) {
                    log(it)
                }
                detectAll()
            }.build()
        )
    }

    override fun log(throwable: Throwable) {
        crashlytics.recordException(throwable)
    }

    override suspend fun <T> runCatching(
        tryBlock: suspend () -> T
    ): Result<T> {
        return try {
            val result = tryBlock.invoke()
            Result.success(result)
        } catch (e: Throwable) {
            log(e)
            Result.failure(e)
        }
    }
}