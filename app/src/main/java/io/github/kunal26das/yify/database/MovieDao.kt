package io.github.kunal26das.yify.database

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy.REPLACE
import androidx.room.Query
import io.github.kunal26das.model.Movie

@Dao
interface MovieDao {

    @Insert(onConflict = REPLACE)
    suspend fun insert(movie: Movie)

    @Insert(onConflict = REPLACE)
    suspend fun insert(movies: List<Movie>)

    @Query("SELECT * from Movie where page = :page")
    suspend fun getMovies(page: Int): List<Movie>

}