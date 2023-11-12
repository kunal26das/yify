package io.github.kunal26das.yify.domain.model

import androidx.annotation.Keep
import kotlinx.serialization.Serializable

@Keep
@Serializable
enum class SortBy {
    Title, Year, Rating, Peers, Seeds, DateAdded;
}