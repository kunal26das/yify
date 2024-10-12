package io.github.kunal26das.yify.movies.data.mapper

import io.github.kunal26das.yify.movies.data.UnknownGenreException
import io.github.kunal26das.yify.movies.domain.logger.ExceptionLogger
import io.github.kunal26das.yify.movies.domain.logger.Logger
import io.github.kunal26das.yify.movies.domain.logger.Priority
import io.github.kunal26das.yify.movies.domain.model.Genre

private const val GENRE_ACTION = "Action"
private const val GENRE_ADVENTURE = "Adventure"
private const val GENRE_ANIMATION = "Animation"
private const val GENRE_BIOGRAPHY = "Biography"
private const val GENRE_COMEDY = "Comedy"
private const val GENRE_CRIME = "Crime"
private const val GENRE_DOCUMENTARY = "Documentary"
private const val GENRE_DRAMA = "Drama"
private const val GENRE_FAMILY = "Family"
private const val GENRE_FANTASY = "Fantasy"
private const val GENRE_FILM_NOIR = "Film-Noir"
private const val GENRE_GAME_SHOW = "Game-Show"
private const val GENRE_HISTORY = "History"
private const val GENRE_HORROR = "Horror"
private const val GENRE_MUSIC = "Music"
private const val GENRE_MUSICAL = "Musical"
private const val GENRE_MYSTERY = "Mystery"
private const val GENRE_NEWS = "News"
private const val GENRE_REALITY_TV = "Reality-TV"
private const val GENRE_ROMANCE = "Romance"
private const val GENRE_SCI_FI = "Sci-Fi"
private const val GENRE_SPORT = "Sport"
private const val GENRE_TALK_SHOW = "Talk-Show"
private const val GENRE_THRILLER = "Thriller"
private const val GENRE_WAR = "War"
private const val GENRE_WESTERN = "Western"

internal class GenreMapper(
    private val exceptionLogger: ExceptionLogger,
    private val logger: Logger,
) {
    fun getKey(genre: Genre) = when (genre) {
        Genre.Action -> GENRE_ACTION
        Genre.Adventure -> GENRE_ADVENTURE
        Genre.Animation -> GENRE_ANIMATION
        Genre.Biography -> GENRE_BIOGRAPHY
        Genre.Comedy -> GENRE_COMEDY
        Genre.Crime -> GENRE_CRIME
        Genre.Documentary -> GENRE_DOCUMENTARY
        Genre.Drama -> GENRE_DRAMA
        Genre.Family -> GENRE_FAMILY
        Genre.Fantasy -> GENRE_FANTASY
        Genre.FilmNoir -> GENRE_FILM_NOIR
        Genre.GameShow -> GENRE_GAME_SHOW
        Genre.History -> GENRE_HISTORY
        Genre.Horror -> GENRE_HORROR
        Genre.Music -> GENRE_MUSIC
        Genre.Musical -> GENRE_MUSICAL
        Genre.Mystery -> GENRE_MYSTERY
        Genre.News -> GENRE_NEWS
        Genre.RealityTV -> GENRE_REALITY_TV
        Genre.Romance -> GENRE_ROMANCE
        Genre.SciFi -> GENRE_SCI_FI
        Genre.Sport -> GENRE_SPORT
        Genre.TalkShow -> GENRE_TALK_SHOW
        Genre.Thriller -> GENRE_THRILLER
        Genre.War -> GENRE_WAR
        Genre.Western -> GENRE_WESTERN
        else -> null
    }

    fun toGenre(genre: String) = when (genre) {
        GENRE_ACTION -> Genre.Action
        GENRE_ADVENTURE -> Genre.Adventure
        GENRE_ANIMATION -> Genre.Animation
        GENRE_BIOGRAPHY -> Genre.Biography
        GENRE_COMEDY -> Genre.Comedy
        GENRE_CRIME -> Genre.Crime
        GENRE_DOCUMENTARY -> Genre.Documentary
        GENRE_DRAMA -> Genre.Drama
        GENRE_FAMILY -> Genre.Family
        GENRE_FANTASY -> Genre.Fantasy
        GENRE_FILM_NOIR -> Genre.FilmNoir
        GENRE_GAME_SHOW -> Genre.GameShow
        GENRE_HISTORY -> Genre.History
        GENRE_HORROR -> Genre.Horror
        GENRE_MUSIC -> Genre.Music
        GENRE_MUSICAL -> Genre.Musical
        GENRE_MYSTERY -> Genre.Mystery
        GENRE_NEWS -> Genre.News
        GENRE_REALITY_TV -> Genre.RealityTV
        GENRE_ROMANCE -> Genre.Romance
        GENRE_SCI_FI -> Genre.SciFi
        GENRE_SPORT -> Genre.Sport
        GENRE_TALK_SHOW -> Genre.TalkShow
        GENRE_THRILLER -> Genre.Thriller
        GENRE_WAR -> Genre.War
        GENRE_WESTERN -> Genre.Western
        else -> {
            logger.log(Priority.Debug, "Unknown Genre", genre)
            exceptionLogger.log(UnknownGenreException(genre))
            null
        }
    }

    fun toGenres(
        genres: List<String>?
    ): List<Genre> {
        return genres?.mapNotNull {
            toGenre(it)
        } ?: emptyList()
    }
}