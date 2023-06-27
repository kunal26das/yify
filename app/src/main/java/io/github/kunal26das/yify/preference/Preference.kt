package io.github.kunal26das.yify.preference

import androidx.datastore.preferences.core.booleanPreferencesKey
import androidx.datastore.preferences.core.intPreferencesKey
import androidx.datastore.preferences.core.stringPreferencesKey

@Suppress("EnumEntryName")
enum class Preference {
    quality,
    minimum_rating,
    query_term,
    genre,
    sort_by,
    order_by,
    columns,
    movie_count,
    loading,
    page,
    ;
    val intPreferencesKey get() = intPreferencesKey(name)
    val stringPreferencesKey get() = stringPreferencesKey(name)
    val booleanPreferencesKey get() = booleanPreferencesKey(name)
}