package io.github.kunal26das.yify.domain.model

enum class Language {
    English,
    Unknown,
    ;

    companion object {
        operator fun get(language: String?): Language? {
            return values().find { it.name == language }
        }
    }
}