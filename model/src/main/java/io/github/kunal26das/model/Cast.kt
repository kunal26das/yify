package io.github.kunal26das.model

import android.os.Parcelable
import androidx.annotation.NonNull
import androidx.room.Entity
import androidx.room.PrimaryKey
import com.google.gson.annotations.SerializedName
import kotlinx.parcelize.Parcelize

@Entity
@Parcelize
data class Cast(
    @NonNull
    @PrimaryKey
    @SerializedName("imdb_code")
    var imdbCode: String = "",

    @SerializedName("character_name")
    var characterName: String? = null,

    @SerializedName("name")
    var name: String? = null,

    @SerializedName("url_small_image")
    var urlSmallImage: String? = null,
) : Parcelable
