package io.github.kunal26das.common

interface FileDownloader {
    suspend fun download(url: String?): File?
}