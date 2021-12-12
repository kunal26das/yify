package io.github.kunal26das.yify.network.local

import androidx.room.RoomDatabase

abstract class RoomDatabaseImpl<T : DaoService> : RoomDatabase() {
    abstract val dao: T
}