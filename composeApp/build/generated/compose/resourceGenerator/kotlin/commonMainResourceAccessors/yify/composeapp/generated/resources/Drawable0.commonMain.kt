@file:OptIn(org.jetbrains.compose.resources.InternalResourceApi::class)

package yify.composeapp.generated.resources

import org.jetbrains.compose.resources.DrawableResource
import kotlin.OptIn

private object CommonMainDrawable0 {
    public val compose_multiplatform: DrawableResource by
    lazy { init_compose_multiplatform() }
}

internal val Res.drawable.compose_multiplatform: DrawableResource
    get() = CommonMainDrawable0.compose_multiplatform

private fun init_compose_multiplatform(): DrawableResource =
    org.jetbrains.compose.resources.DrawableResource(
        "drawable:compose_multiplatform",
        setOf(
            org.jetbrains.compose.resources.ResourceItem(
                setOf(),
                "composeResources/yify.composeapp.generated.resources/drawable/compose-multiplatform.xml",
                -1,
                -1
            ),
        )
    )
