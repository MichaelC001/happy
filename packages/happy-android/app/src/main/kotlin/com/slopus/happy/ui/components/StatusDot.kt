package com.slopus.happy.ui.components

import android.provider.Settings
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp

/**
 * StatusDot.tsx: a [size] circle (6 by default) in [color]. Pulsing fades
 * between full and 30% opacity, 1 s each way; settling back takes 200 ms.
 */
@Composable
fun StatusDot(color: Color, modifier: Modifier = Modifier, pulsing: Boolean = false, size: Dp = 6.dp) {
    val alpha = remember { Animatable(1f) }
    LaunchedEffect(pulsing) {
        if (pulsing) {
            alpha.animateTo(0.3f, infiniteRepeatable(tween(1000), RepeatMode.Reverse))
        } else {
            alpha.animateTo(1f, tween(200))
        }
    }
    Box(
        modifier = modifier
            .size(size)
            .graphicsLayer { this.alpha = alpha.value }
            .background(color, CircleShape),
    )
}

/** Whether the person has turned animations off (Android's "Remove animations": duration scale 0). */
@Composable
fun rememberReduceMotion(): Boolean {
    val context = LocalContext.current
    return remember(context) {
        Settings.Global.getFloat(context.contentResolver, Settings.Global.ANIMATOR_DURATION_SCALE, 1f) == 0f
    }
}
