package io.github.kunal26das.yify.db.serializer

import androidx.datastore.core.Serializer
import io.github.kunal26das.common.domain.logger.CrashLogger
import io.github.kunal26das.yify.ui.UiPreference
import kotlinx.serialization.SerializationException
import kotlinx.serialization.json.Json
import java.io.InputStream
import java.io.OutputStream
import javax.inject.Inject

class UiPreferencesSerializer @Inject constructor(
    private val crashLogger: CrashLogger,
) : Serializer<UiPreference> {
    override val defaultValue: UiPreference
        get() = UiPreference.Uncategorised

    override suspend fun readFrom(input: InputStream): UiPreference {
        return try {
            Json.decodeFromString(
                deserializer = UiPreference.serializer(),
                string = input.readBytes().decodeToString(),
            )
        } catch (e: Exception) {
            crashLogger.log(e)
            defaultValue
        }
    }

    @Suppress("BlockingMethodInNonBlockingContext")
    override suspend fun writeTo(t: UiPreference, output: OutputStream) {
        try {
            output.write(
                Json.encodeToString(
                    serializer = UiPreference.serializer(),
                    value = t
                ).encodeToByteArray()
            )
        } catch (e: SerializationException) {
            crashLogger.log(e)
        }
    }
}