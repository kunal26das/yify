package io.github.kunal26das.yify.domain.model

import kotlinx.serialization.Serializable

@Serializable
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
    History,
    Horror,
    Music,
    Musical,
    Mystery,
    Romance,
    SciFi,
    Short,
    Sport,
    Thriller,
    War,
    Western,
    Unknown,
    ;

    companion object {
        val ALL by lazy {
            values().toMutableList().apply {
                removeAt(indexOf(Unknown))
            }
        }
    }
}