package io.github.kunal26das.yify.database

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy.REPLACE
import androidx.room.Query
import io.github.kunal26das.model.Movie
import io.reactivex.rxjava3.core.Completable

@Dao
interface MovieDao : io.github.kunal26das.network.local.DaoService {

    @Insert(onConflict = REPLACE)
    fun insert(movie: Movie): Completable

    @Insert(onConflict = REPLACE)
    fun insert(movies: List<Movie>): Completable

    @Query("SELECT * from Movie where page = :page")
    fun getMovies(page: Int): List<Movie>

}