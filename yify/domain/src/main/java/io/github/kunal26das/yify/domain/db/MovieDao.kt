package io.github.kunal26das.yify.domain.db

import androidx.paging.PagingSource
import androidx.room.Dao
import androidx.room.Query
import androidx.room.Upsert
import io.github.kunal26das.yify.domain.entity.MovieEntity
import io.github.kunal26das.yify.domain.model.Genre

private const val ASCENDING = "Ascending"
private const val DESCENDING = "Descending"

private const val TITLE = "Title"
private const val YEAR = "Year"
private const val RATING = "Rating"
private const val PEERS = "Peers"
private const val SEEDS = "Seeds"

@Dao
interface MovieDao {

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
                + "AND (:queryTerm IS NULL OR title LIKE ('%' || :queryTerm || '%'))"
                + "AND (:genre IS NULL OR :genre IN (genres))"
                + "ORDER BY "
                + "CASE WHEN :orderBy == '$ASCENDING' AND :sortBy == '$TITLE' THEN title END ASC, "
                + "CASE WHEN :orderBy == '$ASCENDING' AND :sortBy == '$YEAR' THEN year END ASC, "
                + "CASE WHEN :orderBy == '$ASCENDING' AND :sortBy == '$RATING' THEN rating END ASC, "
                + "CASE WHEN :orderBy == '$ASCENDING' AND :sortBy == '$PEERS' THEN peers END ASC, "
                + "CASE WHEN :orderBy == '$ASCENDING' AND :sortBy == '$SEEDS' THEN seeds END ASC, "
                + "CASE WHEN :orderBy == '$ASCENDING' THEN date_uploaded END "
                + "ASC, "
                + "CASE WHEN :orderBy == '$DESCENDING' AND :sortBy == '$TITLE' THEN title END DESC, "
                + "CASE WHEN :orderBy == '$DESCENDING' AND :sortBy == '$YEAR' THEN year END DESC, "
                + "CASE WHEN :orderBy == '$DESCENDING' AND :sortBy == '$RATING' THEN rating END DESC, "
                + "CASE WHEN :orderBy == '$DESCENDING' AND :sortBy == '$PEERS' THEN peers END DESC, "
                + "CASE WHEN :orderBy == '$DESCENDING' AND :sortBy == '$SEEDS' THEN seeds END DESC, "
                + "CASE WHEN :orderBy == '$DESCENDING' THEN date_uploaded END "
                + "DESC "
    )
    fun getMovies(
        quality: Int?,
        minimumRating: Int?,
        queryTerm: String? = null,
        genre: Genre? = null,
        sortBy: String? = null,
        orderBy: String? = null,
    ): PagingSource<Int, MovieEntity>

    @Query("DELETE FROM movie")
    fun clear()
}
