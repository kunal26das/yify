package io.github.kunal26das.model

import android.os.Parcelable
import androidx.room.Entity
import androidx.room.PrimaryKey
import kotlinx.parcelize.Parcelize
import okhttp3.Request
import okhttp3.Response

@Entity
@Parcelize
data class Network(
    val url: String? = null,
    val method: String? = null,
    val message: String? = null,
    val isSuccessful: Boolean? = null,

    @PrimaryKey
    val time: Long = System.currentTimeMillis(),
) : Parcelable {

    constructor(request: Request, response: Response) : this(
        request.url.toString(),
        request.method,
        response.message,
        response.isSuccessful,
    )

    companion object {
        const val KEY_NETWORK = "network"
    }

}
