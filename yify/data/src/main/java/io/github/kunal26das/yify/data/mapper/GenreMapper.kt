package io.github.kunal26das.yify.data.mapper

import io.github.kunal26das.yify.domain.model.Genre

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
private const val GENRE_HISTORY = "History"
private const val GENRE_HORROR = "Horror"
private const val GENRE_MUSIC = "Music"
private const val GENRE_MUSICAL = "Musical"
private const val GENRE_MYSTERY = "Mystery"
private const val GENRE_ROMANCE = "Romance"
private const val GENRE_SCI_FI = "Sci-Fi"
private const val GENRE_SHORT = "Short"
private const val GENRE_SPORT = "Sport"
private const val GENRE_THRILLER = "Thriller"
private const val GENRE_WAR = "War"
private const val GENRE_WESTERN = "Western"

val Genre.key: String?
    get() = when (this) {
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
        Genre.History -> GENRE_HISTORY
        Genre.Horror -> GENRE_HORROR
        Genre.Music -> GENRE_MUSIC
        Genre.Musical -> GENRE_MUSICAL
        Genre.Mystery -> GENRE_MYSTERY
        Genre.Romance -> GENRE_ROMANCE
        Genre.SciFi -> GENRE_SCI_FI
        Genre.Short -> GENRE_SHORT
        Genre.Sport -> GENRE_SPORT
        Genre.Thriller -> GENRE_THRILLER
        Genre.War -> GENRE_WAR
        Genre.Western -> GENRE_WESTERN
        else -> null
    }

val String.toGenre: Genre
    get() = when (this) {
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
        GENRE_HISTORY -> Genre.History
        GENRE_HORROR -> Genre.Horror
        GENRE_MUSIC -> Genre.Music
        GENRE_MUSICAL -> Genre.Musical
        GENRE_MYSTERY -> Genre.Mystery
        GENRE_ROMANCE -> Genre.Romance
        GENRE_SCI_FI -> Genre.SciFi
        GENRE_SHORT -> Genre.Short
        GENRE_SPORT -> Genre.Sport
        GENRE_THRILLER -> Genre.Thriller
        GENRE_WAR -> Genre.War
        GENRE_WESTERN -> Genre.Western
        else -> Genre.Unknown
    }

val List<String>?.toGenres: List<Genre>
    get() = this?.map { it.toGenre } ?: emptyList()