package io.github.kunal26das.yify.domain.model

sealed class Genre(val name: String) {
    data object Action : Genre(GENRE_ACTION)
    data object Adventure : Genre(GENRE_ADVENTURE)
    data object Animation : Genre(GENRE_ANIMATION)
    data object Biography : Genre(GENRE_BIOGRAPHY)
    data object Comedy : Genre(GENRE_COMEDY)
    data object Crime : Genre(GENRE_CRIME)
    data object Documentary : Genre(GENRE_DOCUMENTARY)
    data object Drama : Genre(GENRE_DRAMA)
    data object Family : Genre(GENRE_FAMILY)
    data object Fantasy : Genre(GENRE_FANTASY)
    data object FilmNoir : Genre(GENRE_FILM_NOIR)
    data object History : Genre(GENRE_HISTORY)
    data object Horror : Genre(GENRE_HORROR)
    data object Music : Genre(GENRE_MUSIC)
    data object Musical : Genre(GENRE_MUSICAL)
    data object Mystery : Genre(GENRE_MYSTERY)
    data object Romance : Genre(GENRE_ROMANCE)
    data object SciFi : Genre(GENRE_SCI_FI)
    data object Short : Genre(GENRE_SHORT)
    data object Sport : Genre(GENRE_SPORT)
    data object Thriller : Genre(GENRE_THRILLER)
    data object War : Genre(GENRE_WAR)
    data object Western : Genre(GENRE_WESTERN)
    internal data object Unknown : Genre("")

    companion object {
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

        operator fun get(genre: String?): Genre = when (genre) {
            GENRE_ACTION -> Action
            GENRE_ADVENTURE -> Adventure
            GENRE_ANIMATION -> Animation
            GENRE_BIOGRAPHY -> Biography
            GENRE_COMEDY -> Comedy
            GENRE_CRIME -> Crime
            GENRE_DOCUMENTARY -> Documentary
            GENRE_DRAMA -> Drama
            GENRE_FAMILY -> Family
            GENRE_FANTASY -> Fantasy
            GENRE_FILM_NOIR -> FilmNoir
            GENRE_HISTORY -> History
            GENRE_HORROR -> Horror
            GENRE_MUSIC -> Music
            GENRE_MUSICAL -> Musical
            GENRE_MYSTERY -> Mystery
            GENRE_ROMANCE -> Romance
            GENRE_SCI_FI -> SciFi
            GENRE_SHORT -> Short
            GENRE_SPORT -> Sport
            GENRE_THRILLER -> Thriller
            GENRE_WAR -> War
            GENRE_WESTERN -> Western
            else -> Unknown
        }
    }
}