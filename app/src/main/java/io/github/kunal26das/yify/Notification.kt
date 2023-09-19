package io.github.kunal26das.yify

import android.app.NotificationManager.IMPORTANCE_MIN

class Notification private constructor() {
    enum class Channel(val importance: Int) {
        Sync(IMPORTANCE_MIN),
    }
}