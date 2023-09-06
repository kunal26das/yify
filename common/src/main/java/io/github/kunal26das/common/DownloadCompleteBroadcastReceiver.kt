package io.github.kunal26das.common

import android.app.DownloadManager
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

class DownloadCompleteBroadcastReceiver(
    private val onReceive: (BroadcastReceiver.(File?) -> Unit)? = null,
) : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action == DownloadManager.ACTION_DOWNLOAD_COMPLETE) {
            val downloadManager = context.getSystemService(DownloadManager::class.java)
            intent.extras?.getLong(DownloadManager.EXTRA_DOWNLOAD_ID)?.let { id ->
                val uri = downloadManager.getUriForDownloadedFile(id)
                onReceive?.invoke(this, File(id, uri))
            } ?: onReceive?.invoke(this, null)
        }
    }
}