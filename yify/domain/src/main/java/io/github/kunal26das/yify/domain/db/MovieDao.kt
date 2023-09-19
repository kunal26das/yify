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

    @Query("SELECT COUNT(*) FROM movie")
    suspend fun getMoviesCount(): Int

    @Query("SELECT * FROM movie WHERE :id == id")
    suspend fun getMovie(id: Int): MovieEntity?

    @Query(
        "SELECT * FROM movie "
                + "WHERE (:quality IS NULL OR :quality <= quality)"
                + "AND (:minimumRating IS NULL OR :minimumRating <= rating)"
//                + "AND (:queryTerm IS NULL OR title LIKE '%' + :queryTerm + '%')"
                + "AND (:genre IS NULL OR :genre IN (genres))"
                + "ORDER BY "
                + "CASE WHEN :orderBy == 'Ascending' AND :sortBy == 'Title' THEN title END ASC, "
                + "CASE WHEN :orderBy == 'Ascending' AND :sortBy == 'Year' THEN year END ASC, "
                + "CASE WHEN :orderBy == 'Ascending' AND :sortBy == 'Rating' THEN rating END ASC, "
                + "CASE WHEN :orderBy == 'Ascending' AND :sortBy == 'Peers' THEN peers END ASC, "
                + "CASE WHEN :orderBy == 'Ascending' AND :sortBy == 'Seeds' THEN seeds END ASC, "
                + "CASE WHEN :orderBy == 'Ascending' THEN date_uploaded END ASC, "
                + "CASE WHEN :orderBy == 'Descending' AND :sortBy == 'Title' THEN title END DESC, "
                + "CASE WHEN :orderBy == 'Descending' AND :sortBy == 'Year' THEN year END DESC, "
                + "CASE WHEN :orderBy == 'Descending' AND :sortBy == 'Rating' THEN rating END DESC, "
                + "CASE WHEN :orderBy == 'Descending' AND :sortBy == 'Peers' THEN peers END DESC, "
                + "CASE WHEN :orderBy == 'Descending' AND :sortBy == 'Seeds' THEN seeds END DESC, "
                + "CASE WHEN :orderBy == 'Descending' THEN date_uploaded END DESC"
    )
    fun getMovies(
        quality: Int?,
        minimumRating: Int?,
//        queryTerm: String? = null,
        genre: Genre? = null,
        sortBy: String? = null,
        orderBy: String? = null,
    ): PagingSource<Int, MovieEntity>
}
