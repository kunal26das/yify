package io.github.kunal26das.yify.database

import androidx.room.Database
import androidx.room.Entity
import io.github.kunal26das.model.Network
import io.github.kunal26das.yify.BuildConfig

@Entity
@Database(
    exportSchema = true,
    entities = [Network::class],
    version = BuildConfig.VERSION_CODE,
)
abstract class NetworkDatabase : io.github.kunal26das.network.local.RoomDatabaseImpl<NetworkDao>()