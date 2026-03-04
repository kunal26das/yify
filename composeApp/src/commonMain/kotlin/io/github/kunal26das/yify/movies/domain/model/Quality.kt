package io.github.kunal26das.yify.movies.domain.model

enum class Quality(val value: Int) {
    Low(0),
    Medium(1),
    High(2),
    ;

    companion object {
        operator fun get(quality: Int?): Quality? {
            return entries.find { it.value == quality }
        }
    }
}