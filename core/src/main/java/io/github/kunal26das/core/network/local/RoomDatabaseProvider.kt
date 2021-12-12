package io.github.kunal26das.core.network.local

import android.content.Context
import androidx.room.Room
import androidx.room.RoomDatabase

interface RoomDatabaseProvider

inline fun <reified T : RoomDatabaseImpl<*>> RoomDatabaseProvider.database(
    context: Context, name: String = context.applicationContext.packageName,
    crossinline builder: RoomDatabase.Builder<T>.() -> Unit = {
        fallbackToDestructiveMigration()
    }
) = lazy {
    Room.databaseBuilder(context.applicationContext, T::class.java, name).apply {
        builder.invoke(this)
    }.build()
}