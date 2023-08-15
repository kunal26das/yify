package io.github.kunal26das.yify.domain.model

import androidx.annotation.StringDef
import io.github.kunal26das.yify.domain.model.Genre.Companion.GENRE_ACTION
import io.github.kunal26das.yify.domain.model.Genre.Companion.GENRE_ACTION_COMEDY
import io.github.kunal26das.yify.domain.model.Genre.Companion.GENRE_ADVENTURE
import io.github.kunal26das.yify.domain.model.Genre.Companion.GENRE_ALL
import io.github.kunal26das.yify.domain.model.Genre.Companion.GENRE_ANIMATION
import io.github.kunal26das.yify.domain.model.Genre.Companion.GENRE_COMEDY
import io.github.kunal26das.yify.domain.model.Genre.Companion.GENRE_COMEDY_ROMANCE
import io.github.kunal26das.yify.domain.model.Genre.Companion.GENRE_CRIME
import io.github.kunal26das.yify.domain.model.Genre.Companion.GENRE_DRAMA
import io.github.kunal26das.yify.domain.model.Genre.Companion.GENRE_FANTASY
import io.github.kunal26das.yify.domain.model.Genre.Companion.GENRE_HORROR
import io.github.kunal26das.yify.domain.model.Genre.Companion.GENRE_MYSTERY
import io.github.kunal26das.yify.domain.model.Genre.Companion.GENRE_ROMANCE
import io.github.kunal26das.yify.domain.model.Genre.Companion.GENRE_SCI_FI
import io.github.kunal26das.yify.domain.model.Genre.Companion.GENRE_SUPERHERO
import io.github.kunal26das.yify.domain.model.Genre.Companion.GENRE_THRILLER

@StringDef(
    GENRE_ALL,
    GENRE_COMEDY,
    GENRE_SCI_FI,
    GENRE_HORROR,
    GENRE_ROMANCE,
    GENRE_ACTION,
    GENRE_THRILLER,
    GENRE_DRAMA,
    GENRE_MYSTERY,
    GENRE_CRIME,
    GENRE_ANIMATION,
    GENRE_ADVENTURE,
    GENRE_FANTASY,
    GENRE_COMEDY_ROMANCE,
    GENRE_ACTION_COMEDY,
    GENRE_SUPERHERO,
)
annotation class Genre {
    companion object : ArrayList<String>() {

        const val GENRE_ALL = "all"
        const val GENRE_COMEDY = "Comedy"
        const val GENRE_SCI_FI = "Sci-Fi"
        const val GENRE_HORROR = "Horror"
        const val GENRE_ROMANCE = "Romance"
        const val GENRE_ACTION = "Action"
        const val GENRE_THRILLER = "Thriller"
        const val GENRE_DRAMA = "Drama"
        const val GENRE_MYSTERY = "Mystery"
        const val GENRE_CRIME = "Crime"
        const val GENRE_ANIMATION = "Animation"
        const val GENRE_ADVENTURE = "Adventure"
        const val GENRE_FANTASY = "Fantasy"
        const val GENRE_COMEDY_ROMANCE = "${GENRE_COMEDY}-${GENRE_ROMANCE}"
        const val GENRE_ACTION_COMEDY = "${GENRE_ACTION}-${GENRE_COMEDY}"
        const val GENRE_SUPERHERO = "Superhero"

        init {
            add(GENRE_ALL)
            add(GENRE_COMEDY)
            add(GENRE_SCI_FI)
            add(GENRE_HORROR)
            add(GENRE_ROMANCE)
            add(GENRE_ACTION)
            add(GENRE_THRILLER)
            add(GENRE_DRAMA)
            add(GENRE_MYSTERY)
            add(GENRE_CRIME)
            add(GENRE_ANIMATION)
            add(GENRE_ADVENTURE)
            add(GENRE_FANTASY)
//            add(GENRE_COMEDY_ROMANCE)
//            add(GENRE_ACTION_COMEDY)
//            add(GENRE_SUPERHERO)
        }
    }
}