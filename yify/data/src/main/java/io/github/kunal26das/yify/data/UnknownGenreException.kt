package io.github.kunal26das.yify.data

class UnknownGenreException(genre: String) : Throwable() {
    override val message = "Unknown genre $genre"
}