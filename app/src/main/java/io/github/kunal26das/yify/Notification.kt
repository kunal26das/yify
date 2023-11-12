package io.github.kunal26das.yify

import android.app.NotificationManager.IMPORTANCE_MIN
import androidx.annotation.Keep

class Notification private constructor() {
    @Keep
    enum class Channel(val importance: Int) {
        Sync(IMPORTANCE_MIN),
    }
}