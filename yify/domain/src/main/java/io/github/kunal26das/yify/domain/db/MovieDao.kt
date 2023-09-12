package io.github.kunal26das.yify.domain.db

import androidx.paging.PagingSource
import androidx.room.Dao
import androidx.room.Query
import androidx.room.Upsert
import io.github.kunal26das.yify.domain.entity.MovieEntity
import io.github.kunal26das.yify.domain.model.Genre

@Dao
interface MovieDao {
    @Upsert
    suspend fun upsert(vararg movie: MovieEntity)

    @Upsert
    suspend fun upsert(movies: List<MovieEntity>)

    @Query("SELECT * FROM MOVIE WHERE :id == ID")
    suspend fun get(id: Int): MovieEntity?

    @Query(
        "SELECT * FROM MOVIE " +
                "WHERE :quality == QUALITY " +
                "AND :minimumRating <= RATING " +
                "AND TITLE LIKE '%' + :queryTerm% + '%' " +
                "AND :genre IN(GENRES) " +
                "ORDER BY (CASE " +
                "WHEN :sortBy == 'Title' THEN TITLE " +
                "WHEN :sortBy == 'Year' THEN YEAR " +
                "WHEN :sortBy == 'Rating' THEN RATING " +
                "WHEN :sortBy == 'Peers' THEN PEERS " +
                "WHEN :sortBy == 'Seeds' THEN SEEDS " +
                "WHEN :sortBy == 'DownloadCount' THEN DOWNLOAD_COUNT " +
                "WHEN :sortBy == 'LikeCount' THEN LIKE_COUNT " +
                "ELSE DATE_UPLOADED END) "
    )
    fun getMovies(
        quality: String?,
        minimumRating: Int?,
        queryTerm: String? = null,
        genre: Genre? = null,
        sortBy: String? = null,
//        orderBy: String? = null,
    ): PagingSource<Int, MovieEntity>
}

