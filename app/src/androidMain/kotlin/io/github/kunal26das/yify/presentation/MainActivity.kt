package io.github.kunal26das.yify.presentation

import android.os.Bundle
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.appcompat.app.AppCompatActivity
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.dynamicDarkColorScheme
import androidx.compose.material3.dynamicLightColorScheme
import androidx.compose.ui.Modifier
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import coil3.compose.setSingletonImageLoaderFactory
import io.github.kunal26das.yify.init.CoilInitializer
import io.github.kunal26das.yify.movies.compose.App

class MainActivity : AppCompatActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        val splashScreen = installSplashScreen()
        enableEdgeToEdge()
        super.onCreate(savedInstanceState)
        splashScreen.setKeepOnScreenCondition { false }
        setContent {
            setSingletonImageLoaderFactory {
                CoilInitializer().create(this)
            }
            MaterialTheme(
                colorScheme = when {
                    isSystemInDarkTheme() -> dynamicDarkColorScheme(this)
                    else -> dynamicLightColorScheme(this)
                },
                content = {
                    App(
                        modifier = Modifier.fillMaxSize(),
                    )
                },
            )
        }
    }
}