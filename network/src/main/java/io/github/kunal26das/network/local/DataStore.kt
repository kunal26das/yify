package io.github.kunal26das.network.local

import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.*
import kotlinx.coroutines.flow.firstOrNull

inline fun <reified T> getPreferencesKey(enum: Enum<*>): Preferences.Key<T> {
    return when (T::class) {
        Int::class -> intPreferencesKey(enum.name)
        Double::class -> doublePreferencesKey(enum.name)
        String::class -> stringPreferencesKey(enum.name)
        Boolean::class -> booleanPreferencesKey(enum.name)
        Float::class -> floatPreferencesKey(enum.name)
        Long::class -> longPreferencesKey(enum.name)
        Set::class -> stringSetPreferencesKey(enum.name)
        else -> throw UnsupportedOperationException()
    } as Preferences.Key<T>
}

suspend inline fun <reified T> DataStore<Preferences>.get(key: Enum<*>): T? {
    return data.firstOrNull()?.get(getPreferencesKey<T>(key))
}

suspend inline fun <reified T> DataStore<Preferences>.set(key: Enum<*>, value: T?) {
    val preferencesKey = getPreferencesKey<T>(key)
    edit {
        when (value) {
            null -> it.remove(preferencesKey)
            else -> it[preferencesKey] = value
        }
    }
}