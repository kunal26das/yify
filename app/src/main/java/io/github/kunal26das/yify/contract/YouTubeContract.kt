package io.github.kunal26das.yify.contract

import android.content.Context
import android.content.Intent

class YouTubeContract : UrlContract() {
    override fun createIntent(context: Context, input: String): Intent {
        return super.createIntent(context, "https://www.youtube.com/watch?v=${input}")
    }
}