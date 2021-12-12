package io.github.kunal26das.core.network.local

import androidx.room.RoomDatabase

abstract class RoomDatabaseImpl<T : DaoService> : RoomDatabase() {
    abstract val dao: T
}