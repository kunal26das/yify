package io.github.kunal26das.yify.movies.data.dto

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
data class MetaDto(
    @SerialName("server_time")
    val serverTime: Long?,
    @SerialName("server_timezone")
    val serverTimezone: String?,
    @SerialName("api_version")
    val apiVersion: Int?,
    @SerialName("execution_time")
    val executionTime: String?,
)
