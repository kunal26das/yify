package io.github.kunal26das.yify.service

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy.REPLACE
import io.github.kunal26das.yify.models.Movie
import io.reactivex.rxjava3.core.Completable

@Dao
interface MovieDao {

    @Insert(onConflict = REPLACE)
    fun insert(movies: Movie): Completable

    @Insert(onConflict = REPLACE)
    fun insertAll(movies: List<Movie>): Completable

}