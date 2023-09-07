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

    companion object : HashMap<String, Genre>(
        Genre::class.sealedSubclasses
            .mapNotNull {
                it.objectInstance
            }.associateBy {
                it.name
            }
    ) {

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

        val ALL get() = values
    }
}