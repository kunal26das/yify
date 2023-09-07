package io.github.kunal26das.common.download

interface FileDownloader {
    suspend fun download(url: String?): File?
}