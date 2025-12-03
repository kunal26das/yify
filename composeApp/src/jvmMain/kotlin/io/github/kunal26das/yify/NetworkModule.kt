package io.github.kunal26das.yify

import io.ktor.client.HttpClient
import io.ktor.client.engine.cio.CIO
import io.ktor.client.plugins.DefaultRequest
import io.ktor.client.plugins.HttpRequestRetry
import io.ktor.client.plugins.contentnegotiation.ContentNegotiation
import io.ktor.http.ContentType
import io.ktor.http.contentType
import io.ktor.serialization.kotlinx.json.json
import org.koin.dsl.module

val networkModule = module {
    single<HttpClient> {
        HttpClient(CIO) {
            expectSuccess = true
            install(ContentNegotiation) {
                json(get())
            }
            install(DefaultRequest) {
                contentType(ContentType.Application.Json)
                url("https://yts.lt/api/v2/")
            }
            install(HttpRequestRetry) {
                retryOnServerErrors(maxRetries = 5)
                exponentialDelay()
                modifyRequest { request ->
                    request.headers.append("x-retry-count", retryCount.toString())
                }
            }
        }
    }
}