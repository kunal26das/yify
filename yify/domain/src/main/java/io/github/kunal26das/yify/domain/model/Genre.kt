package io.github.kunal26das.yify.domain.model

import androidx.annotation.Keep

@Keep
enum class Genre {
    Action,
    Adventure,
    Animation,
    Biography,
    Comedy,
    Crime,
    Documentary,
    Drama,
    Family,
    Fantasy,
    FilmNoir,
    GameShow,
    History,
    Horror,
    Music,
    Musical,
    Mystery,
    News,
    RealityTV,
    Romance,
    SciFi,
    Sport,
    TalkShow,
    Thriller,
    War,
    Western,
    Unknown,
    ;

    companion object {
        operator fun get(genre: String?): Genre? {
            return try {
                Genre.valueOf(genre!!)
            } catch (e: Exception) {
                null
            }
        }
    }
}