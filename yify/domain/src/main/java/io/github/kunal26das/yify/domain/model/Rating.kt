package io.github.kunal26das.yify.domain.model

sealed class Rating(val rating: Int) {
    data object Zero : Rating(0)
    data object One : Rating(1)
    data object Two : Rating(2)
    data object Three : Rating(3)
    data object Four : Rating(4)
    data object Five : Rating(5)
    data object Six : Rating(6)
    data object Seven : Rating(7)
    data object Eight : Rating(8)
    data object Nine : Rating(9)

    companion object {
        val ALL by lazy {
            Rating::class.sealedSubclasses
                .mapNotNull {
                    it.objectInstance
                }
        }
    }
}
