package io.github.kunal26das.yify.repository

import android.content.Context
import android.content.ContextWrapper
import androidx.datastore.preferences.core.*
import androidx.datastore.preferences.preferencesDataStore
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.flow.firstOrNull
import java.util.*

class DataStore private constructor(
    @ApplicationContext context: Context,
    name: String = context.packageName,
) : ContextWrapper(context) {

    val dataStore by preferencesDataStore(name)

    val Enum<*>.intPreferencesKey
        get() = intPreferencesKey(name)

    val Enum<*>.doublePreferencesKey
        get() = doublePreferencesKey(name)

    val Enum<*>.stringPreferencesKey
        get() = stringPreferencesKey(name)

    val Enum<*>.booleanPreferencesKey
        get() = booleanPreferencesKey(name)

    val Enum<*>.floatPreferencesKey
        get() = floatPreferencesKey(name)

    val Enum<*>.longPreferencesKey
        get() = longPreferencesKey(name)

    val Enum<*>.stringSetPreferencesKey
        get() = stringSetPreferencesKey(name)

    inline fun <reified T> Enum<*>.getPreferencesKey(): Preferences.Key<T> {
        return when (T::class) {
            Int::class -> intPreferencesKey
            Double::class -> doublePreferencesKey
            String::class -> stringPreferencesKey
            Boolean::class -> booleanPreferencesKey
            Float::class -> floatPreferencesKey
            Long::class -> longPreferencesKey
            Set::class -> stringSetPreferencesKey
            else -> throw UnsupportedOperationException()
        } as Preferences.Key<T>
    }

    suspend inline fun <reified T> get(key: Enum<*>): T? {
        return dataStore.data.firstOrNull()?.get(key.getPreferencesKey<T>())
    }

    suspend inline fun <reified T> set(key: Enum<*>, value: T?) {
        val preferencesKey = key.getPreferencesKey<T>()
        dataStore.edit {
            when (value) {
                null -> it.remove(preferencesKey)
                else -> it[preferencesKey] = value
            }
        }
    }

    companion object : WeakHashMap<String, DataStore>() {

        @Synchronized
        fun getInstance(
            context: Context, name: String = context.packageName
        ): DataStore {
            return when {
                containsKey(name) -> get(name)!!
                else -> DataStore(context, name).also {
                    put(name, it)
                }
            }
        }

    }

}