package io.github.kunal26das.yify.database

import androidx.room.Database
import androidx.room.Entity
import io.github.kunal26das.core.model.Network
import io.github.kunal26das.core.network.local.RoomDatabaseImpl
import io.github.kunal26das.yify.BuildConfig

@Entity
@Database(
    exportSchema = true,
    entities = [Network::class],
    version = BuildConfig.VERSION_CODE,
)
abstract class NetworkDatabase : RoomDatabaseImpl<NetworkDao>()