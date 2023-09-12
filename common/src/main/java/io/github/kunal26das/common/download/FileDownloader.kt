package io.github.kunal26das.common.download

import io.github.kunal26das.common.model.File

interface FileDownloader {
    suspend fun download(url: String?): File?
}