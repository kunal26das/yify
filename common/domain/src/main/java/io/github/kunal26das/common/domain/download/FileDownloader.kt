package io.github.kunal26das.common.domain.download

interface FileDownloader {
    suspend fun download(url: String?): File?
}