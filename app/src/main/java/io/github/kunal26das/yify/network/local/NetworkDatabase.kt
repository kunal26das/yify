package io.github.kunal26das.yify.network.local

import androidx.room.Database
import androidx.room.Entity
import io.github.kunal26das.yify.BuildConfig
import io.github.kunal26das.yify.models.Network

@Entity
@Database(
    exportSchema = true,
    entities = [Network::class],
    version = BuildConfig.VERSION_CODE,
)
abstract class NetworkDatabase : RoomDatabaseImpl<NetworkDao>()