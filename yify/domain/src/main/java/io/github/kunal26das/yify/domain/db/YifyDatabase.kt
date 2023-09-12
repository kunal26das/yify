package io.github.kunal26das.yify.domain.db

interface YifyDatabase {
    val movieDao: MovieDao
    val torrentDao: TorrentDao
    suspend fun <T> transaction(block: suspend YifyDatabase.() -> T): T
}