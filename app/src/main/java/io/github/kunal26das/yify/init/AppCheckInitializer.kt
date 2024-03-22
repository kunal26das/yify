package io.github.kunal26das.yify.init

import android.content.Context
import com.google.firebase.Firebase
import com.google.firebase.appcheck.FirebaseAppCheck
import com.google.firebase.appcheck.appCheck
import com.google.firebase.appcheck.playintegrity.PlayIntegrityAppCheckProviderFactory
import com.google.firebase.initialize

class AppCheckInitializer : IndependentInitializer<FirebaseAppCheck>() {
    override fun create(context: Context): FirebaseAppCheck {
        Firebase.initialize(context = context)
        Firebase.appCheck.installAppCheckProviderFactory(
            PlayIntegrityAppCheckProviderFactory.getInstance(),
        )
        return Firebase.appCheck
    }
}