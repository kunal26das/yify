package io.github.kunal26das.yify.data

class UnknownLanguageException(genre: String) : Throwable() {
    override val message = "Unknown language $genre"
}