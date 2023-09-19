package io.github.kunal26das.yify.init

import android.content.Context
import android.os.StrictMode
import android.os.StrictMode.ThreadPolicy
import android.os.StrictMode.VmPolicy
import androidx.core.content.ContextCompat
import io.github.kunal26das.common.domain.logger.CrashLogger
import io.github.kunal26das.common.init.IndependentInitializer
import javax.inject.Inject

class StrictModeInitializer : IndependentInitializer<Context>() {

    @Inject
    lateinit var crashLogger: CrashLogger

    override fun create(context: Context): Context {
        InitializerEntryPoint.resolve(context).inject(this)
        StrictMode.setThreadPolicy(
            ThreadPolicy.Builder().apply {
                penaltyListener(ContextCompat.getMainExecutor(context)) {
                    crashLogger.log(it)
                }
                detectAll()
            }.build()
        )
        StrictMode.setVmPolicy(
            VmPolicy.Builder().apply {
                penaltyListener(ContextCompat.getMainExecutor(context)) {
                    crashLogger.log(it)
                }
                detectAll()
            }.build()
        )
        return context
    }
}