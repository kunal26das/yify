package io.github.kunal26das.yify.movies.data.dto

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
data class ResponseDto(
    @SerialName("status")
    val status: String?,
    @SerialName("status_message")
    val statusMessage: String?,
    @SerialName("data")
    val dataDto: DataDto?,
    @SerialName("@meta")
    val meta: MetaDto?,
)