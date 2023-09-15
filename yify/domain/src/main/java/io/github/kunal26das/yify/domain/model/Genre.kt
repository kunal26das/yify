package io.github.kunal26das.yify.domain.model

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
        operator fun get(genre: String?): Genre? {
            return try {
                Genre.valueOf(genre!!)
            } catch (e: Exception) {
                null
            }
        }
    }
}