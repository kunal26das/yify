package io.github.kunal26das.yify.preference

import android.content.Context
import androidx.essentials.network.local.Preferences
import dagger.hilt.android.qualifiers.ApplicationContext
import io.github.kunal26das.model.Movie.Companion.KEY_MOVIE
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class MoviePreferences @Inject constructor(
    @ApplicationContext context: Context
) : Preferences(context.getSharedPreferences(KEY_MOVIE, Context.MODE_PRIVATE))