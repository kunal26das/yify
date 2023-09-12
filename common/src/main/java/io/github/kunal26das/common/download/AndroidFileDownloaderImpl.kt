package io.github.kunal26das.common.download

import android.app.DownloadManager
import android.content.Context
import android.content.IntentFilter
import android.net.Uri
import io.github.kunal26das.common.model.File

internal class AndroidFileDownloaderImpl(
    private val context: Context
) : FileDownloader {
    override suspend fun download(url: String?): File? {
        if (url.isNullOrEmpty()) return null
        val uri = Uri.parse(url)
        val request = DownloadManager.Request(uri)
        val downloadManager = context.getSystemService(DownloadManager::class.java)
        val intentFilter = IntentFilter(DownloadManager.ACTION_DOWNLOAD_COMPLETE)
        request.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE)
        val id = downloadManager.enqueue(request)
        var file: File? = null
        val receiver = DownloadCompleteBroadcastReceiver {
            if (it?.id == id) {
                context.unregisterReceiver(this)
                file = it
            }
        }
        context.registerReceiver(
            receiver,
            intentFilter,
            Context.RECEIVER_EXPORTED,
        )
        return file
    }
}