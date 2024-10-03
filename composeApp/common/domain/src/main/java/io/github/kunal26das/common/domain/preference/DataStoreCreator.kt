package io.github.kunal26das.common.domain.preference

import androidx.datastore.core.DataStore
import androidx.datastore.core.DataStoreFactory
import androidx.datastore.core.Serializer
import androidx.datastore.core.handlers.ReplaceFileCorruptionHandler
import io.github.kunal26das.common.domain.logger.ExceptionLogger
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.serialization.DeserializationStrategy
import kotlinx.serialization.SerializationStrategy
import kotlinx.serialization.json.Json
import java.io.InputStream
import java.io.OutputStream

object DataStoreCreator {

    fun <T> create(
        json: Json,
        fileName: String,
        exceptionLogger: ExceptionLogger,
        dataStoreFileProducer: DataStoreFileProducer,
        serializationStrategy: SerializationStrategy<T>,
        deserializationStrategy: DeserializationStrategy<T>,
    ): DataStore<T?> {
        return DataStoreFactory.create(
            serializer = object : Serializer<T?> {

                override val defaultValue = null

                override suspend fun readFrom(input: InputStream): T? {
                    val result = exceptionLogger.runCatching {
                        json.decodeFromString(
                            deserializer = deserializationStrategy,
                            string = input.readBytes().decodeToString(),
                        )
                    }
                    return result.getOrNull()
                }

                override suspend fun writeTo(t: T?, output: OutputStream) {
                    exceptionLogger.runCatching {
                        output.write(t?.let {
                            json.encodeToString(
                                serializer = serializationStrategy,
                                value = t
                            )
                        }.orEmpty().encodeToByteArray())
                    }
                }

            },
            produceFile = { dataStoreFileProducer.invoke(fileName) },
            scope = CoroutineScope(Dispatchers.IO + SupervisorJob()),
            corruptionHandler = ReplaceFileCorruptionHandler(
                produceNewData = { null }
            ),
        )
    }
}