package io.github.kunal26das.yify.data.dto

import com.google.gson.annotations.SerializedName

data class ResponseDto(
    @SerializedName("data")
    val dataDto: DataDto,
)