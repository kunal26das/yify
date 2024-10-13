package io.github.kunal26das.yify.movies.presentation

import androidx.core.bundle.Bundle
import androidx.navigation.NavType
import io.github.kunal26das.yify.movies.domain.model.Movie
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json

object MovieNavType : NavType<Movie>(false) {
    override fun get(bundle: Bundle, key: String): Movie? {
        return Json.decodeFromString(bundle.getString(key) ?: return null)
    }

    override fun parseValue(value: String): Movie {
        return Json.decodeFromString(value)
    }

    override fun put(bundle: Bundle, key: String, value: Movie) {
        bundle.putString(key, Json.encodeToString(value))
    }

    override fun serializeAsValue(value: Movie): String {
        return Json.encodeToString(value)
    }
}