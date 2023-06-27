package io.github.kunal26das.yify.repository

import com.google.firebase.crashlytics.ktx.crashlytics
import com.google.firebase.ktx.Firebase

sealed interface Repository {
    suspend fun <T> execute(
        block: suspend () -> T
    ) = try {
        block.invoke()
    } catch (e: Throwable) {
        Firebase.crashlytics.recordException(e)
        null
    }
}