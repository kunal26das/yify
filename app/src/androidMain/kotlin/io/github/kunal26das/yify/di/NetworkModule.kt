package io.github.kunal26das.yify.di

import io.github.kunal26das.yify.BuildConfig
import io.ktor.client.HttpClient
import io.ktor.client.engine.okhttp.OkHttp
import io.ktor.client.plugins.DefaultRequest
import io.ktor.client.plugins.HttpRequestRetry
import io.ktor.client.plugins.contentnegotiation.ContentNegotiation
import io.ktor.client.plugins.logging.LogLevel
import io.ktor.client.plugins.logging.Logger
import io.ktor.client.plugins.logging.Logging
import io.ktor.client.plugins.logging.SIMPLE
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
        url(BuildConfig.DNS_URL.toHttpUrl())
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
        HttpClient(OkHttp) {
            expectSuccess = true
            install(ContentNegotiation) {
                json(get())
            }
            if (BuildConfig.DEBUG) {
                install(Logging) {
                    level = LogLevel.ALL
                    logger = Logger.SIMPLE
                }
            }
            install(DefaultRequest) {
                contentType(ContentType.Application.Json)
                url(BuildConfig.BASE_URL)
            }
            install(HttpRequestRetry) {
                retryOnServerErrors(maxRetries = 5)
                exponentialDelay()
                modifyRequest { request ->
                    request.headers.append("x-retry-count", retryCount.toString())
                }
            }
            engine {
                config {
                    retryOnConnectionFailure(true)
                    dns(getDns(this))
                }
            }
        }
    }
}