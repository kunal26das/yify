package io.github.kunal26das.yify.movies.domain.preference

import java.io.File

fun interface DataStoreFileProducer : (String) -> File
