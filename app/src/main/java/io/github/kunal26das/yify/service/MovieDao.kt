package io.github.kunal26das.yify.service

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy.REPLACE
import androidx.room.Query
import io.github.kunal26das.yify.models.Movie
import io.reactivex.rxjava3.core.Completable

@Dao
interface MovieDao {

    @Insert(onConflict = REPLACE)
    fun insert(movie: Movie): Completable

    @Insert(onConflict = REPLACE)
    fun insert(movies: List<Movie>): Completable

    @Query("SELECT * from Movie where page = :page")
    fun getMovies(page: Int): List<Movie>

}