package io.github.kunal26das.yify.movies.data

class UnknownLanguageException(genre: String) : Throwable() {
    override val message = "Unknown language $genre"
}