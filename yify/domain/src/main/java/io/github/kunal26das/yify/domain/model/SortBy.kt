package io.github.kunal26das.yify.domain.model

import kotlinx.serialization.Serializable

@Serializable
enum class SortBy {
    Title, Year, Rating, Peers, Seeds, DateAdded;
}