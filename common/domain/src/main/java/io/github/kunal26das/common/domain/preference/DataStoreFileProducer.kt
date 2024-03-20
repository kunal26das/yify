package io.github.kunal26das.common.domain.preference

import java.io.File

fun interface DataStoreFileProducer : (String) -> File
