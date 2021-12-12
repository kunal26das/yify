package io.github.kunal26das.yify.network.local

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import io.github.kunal26das.yify.models.Network
import io.reactivex.rxjava3.core.Completable

@Dao
interface NetworkDao : DaoService {

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    fun insert(network: Network): Completable

}