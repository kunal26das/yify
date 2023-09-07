package io.github.kunal26das.yify.domain.db

import androidx.room.Dao
import androidx.room.Upsert
import io.github.kunal26das.yify.domain.entity.MovieEntity

@Dao
interface MovieDao {
    @Upsert
    suspend fun upsert(movies: MovieEntity)

    @Upsert
    suspend fun upsert(movies: List<MovieEntity>)
}