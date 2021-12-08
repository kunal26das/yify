package io.github.kunal26das.yify.firebase

import com.google.firebase.ktx.Firebase
import com.google.firebase.remoteconfig.FirebaseRemoteConfigValue
import com.google.firebase.remoteconfig.ktx.remoteConfig
import com.google.firebase.remoteconfig.ktx.remoteConfigSettings
import io.github.kunal26das.yify.models.Constants

object RemoteConfig : HashMap<String, FirebaseRemoteConfigValue>() {

    @Synchronized
    fun fetchAndActivate(onCompleteListener: () -> Unit) {
        Firebase.remoteConfig.apply {
            setConfigSettingsAsync(remoteConfigSettings {
                minimumFetchIntervalInSeconds = 0
            })
            fetchAndActivate().addOnCompleteListener {
                RemoteConfig.putAll(Firebase.remoteConfig.all)
                onCompleteListener.invoke()
            }
        }
    }

    override fun get(@Constants key: String) = super.get(key)!!

}
