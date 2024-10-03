package io.github.kunal26das.common.download

import android.net.Uri
import io.github.kunal26das.common.domain.download.File

data class AndroidFile(
    val id: Long,
    val uri: Uri,
) : File
