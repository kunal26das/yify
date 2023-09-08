package io.github.kunal26das.yify.db.serializer

import androidx.datastore.core.Serializer
import io.github.kunal26das.yify.model.MoviePreference
import kotlinx.serialization.SerializationException
import kotlinx.serialization.json.Json
import java.io.InputStream
import java.io.OutputStream

object MoviePreferencesSerializer : Serializer<MoviePreference> {
    override val defaultValue: MoviePreference
        get() = MoviePreference()

    override suspend fun readFrom(input: InputStream): MoviePreference {
        return try {
            Json.decodeFromString(
                deserializer = MoviePreference.serializer(),
                string = input.readBytes().decodeToString(),
            )
        } catch (e: Exception) {
            // Log error
            defaultValue
        }
    }

    @Suppress("BlockingMethodInNonBlockingContext")
    override suspend fun writeTo(t: MoviePreference, output: OutputStream) {
        try {
            output.write(
                Json.encodeToString(
                    serializer = MoviePreference.serializer(),
                    value = t
                ).encodeToByteArray()
            )
        } catch (e: SerializationException) {
            // Log error
        }
    }
}