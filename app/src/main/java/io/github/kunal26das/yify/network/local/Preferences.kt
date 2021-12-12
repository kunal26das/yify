package io.github.kunal26das.yify.network.repository

import android.content.SharedPreferences
import androidx.lifecycle.LiveData
import androidx.lifecycle.MutableLiveData

inline operator fun <reified T> SharedPreferences.get(key: Enum<*>): T? {
    return try {
        when (contains(key.name)) {
            true -> when (T::class) {
                Int::class -> getInt(key.name, 0)
                Long::class -> getLong(key.name, 0L)
                Float::class -> getFloat(key.name, 0f)
                String::class -> getString(key.name, null)
                Boolean::class -> getBoolean(key.name, false)
                else -> null
            }
            false -> null
        } as? T
    } catch (e: ClassCastException) {
        null
    }
}

operator fun SharedPreferences.set(key: Enum<*>, value: Any?) {
    edit().apply {
        when (value) {
            null -> remove(key.name)
            else -> when (value) {
                is Int -> putInt(key.name, value)
                is Long -> putLong(key.name, value)
                is Float -> putFloat(key.name, value)
                is String -> putString(key.name, value)
                is Boolean -> putBoolean(key.name, value)
                else -> Unit
            }
        }
    }.apply()
}

inline fun <reified T> SharedPreferences.liveData(
    key: Enum<*>
): Lazy<LiveData<T?>> = lazyOf(object : LiveData<T?>(),
    SharedPreferences.OnSharedPreferenceChangeListener {

    private val key = key

    override fun onActive() {
        registerOnSharedPreferenceChangeListener(this)
    }

    override fun getValue() = get<T>(key)

    override fun onSharedPreferenceChanged(
        sharedPreferences: SharedPreferences?,
        key: String?
    ) {
        if (this.key.name == key) {
            setValue(get<T>(this.key))
        }
    }

    override fun onInactive() {
        unregisterOnSharedPreferenceChangeListener(this)
    }
})

inline fun <reified T> SharedPreferences.mutableLiveData(
    key: Enum<*>
): Lazy<LiveData<T?>> = lazyOf(object : MutableLiveData<T?>(),
    SharedPreferences.OnSharedPreferenceChangeListener {

    private val key = key

    override fun onActive() {
        registerOnSharedPreferenceChangeListener(this)
    }

    override fun getValue() = get<T>(key)

    override fun setValue(value: T?) {
        if (value != getValue()) {
            super.setValue(value)
            set(key, value)
        }
    }

    override fun onSharedPreferenceChanged(
        sharedPreferences: SharedPreferences?,
        key: String?
    ) {
        if (this.key.name == key) {
            value = get<T>(this.key)
        }
    }

    override fun onInactive() {
        unregisterOnSharedPreferenceChangeListener(this)
    }
})