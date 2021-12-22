package io.github.kunal26das.yify.database

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import io.github.kunal26das.model.Network
import io.reactivex.rxjava3.core.Completable

@Dao
interface NetworkDao : io.github.kunal26das.network.local.DaoService {

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    fun insert(network: Network): Completable

}