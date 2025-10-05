package io.github.kunal26das.yify

import io.ktor.client.HttpClient
import io.ktor.client.engine.cio.CIO
import io.ktor.client.plugins.DefaultRequest
import io.ktor.client.plugins.HttpRequestRetry
import io.ktor.client.plugins.contentnegotiation.ContentNegotiation
import io.ktor.http.ContentType
import io.ktor.http.contentType
import io.ktor.serialization.kotlinx.json.json
import kotlinx.serialization.json.Json
import okhttp3.Cache
import okhttp3.Dns
import okhttp3.HttpUrl.Companion.toHttpUrl
import okhttp3.OkHttpClient
import okhttp3.dnsoverhttps.DnsOverHttps
import org.koin.dsl.module
import java.io.File

fun getDns(builder: OkHttpClient.Builder): Dns {
    val file = File("cacheDir", "okhttpcache")
    val appCache = Cache(file, 10 * 1024 * 1024)
    return DnsOverHttps.Builder().client(builder.cache(appCache).build()).apply {
        url("https://1.1.1.1/dns-query".toHttpUrl())
        includeIPv6(false)
    }.build()
}

val networkModule = module {
    single<Json> {
        Json {
            explicitNulls = false
            ignoreUnknownKeys = true
        }
    }
    single<HttpClient> {
        HttpClient(CIO) {
            expectSuccess = true
            install(ContentNegotiation) {
                json(get())
            }
            install(DefaultRequest) {
                contentType(ContentType.Application.Json)
                url("https://yts.mx/api/v2/")
            }
            install(HttpRequestRetry) {
                retryOnServerErrors(maxRetries = 5)
                exponentialDelay()
                modifyRequest { request ->
                    request.headers.append("x-retry-count", retryCount.toString())
                }
            }
            engine {
//                config {
//                    retryOnConnectionFailure(true)
//                    dns(getDns(this))
//                }
            }
        }
    }
}