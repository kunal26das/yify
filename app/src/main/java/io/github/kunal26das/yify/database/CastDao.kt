package io.github.kunal26das.yify.database

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy.Companion.REPLACE
import androidx.room.Query
import io.github.kunal26das.model.Cast

@Dao
interface CastDao {

    @Insert(onConflict = REPLACE)
    suspend fun insert(cast: Cast)

    @Insert(onConflict = REPLACE)
    suspend fun insert(cast: List<Cast>)

    @Query("SELECT * from `Cast` WHERE imdbCode IN (:ids)")
    fun getCast(ids: List<String>): List<Cast>

}