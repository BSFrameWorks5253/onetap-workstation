package com.onetap.studiotracker.ui.theme

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.Spring
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.spring
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxScope
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.composed
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawWithContent
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.launch

val LiquidGlassCanvasBrush = Brush.verticalGradient(
    colors = listOf(
        Color(0xFFF8FAFC),
        Color(0xFFF4F6FA),
        Color(0xFFF1F5F9)
    )
)

/**
 * Animated light-mode Aurora backdrop inspired by Filely's Backdrops.kt:
 * soft pastel blooms glide smoothly when switching screens so translucent
 * Liquid Glass cards & the floating dock refract rich depth behind them.
 */
@Composable
fun LiquidAuroraBackground(
    route: String,
    modifier: Modifier = Modifier,
    content: @Composable BoxScope.() -> Unit = {}
) {
    val targetAnchors = remember(route) {
        when (route) {
            "dashboard" -> listOf(Offset(0.12f, 0.14f), Offset(0.88f, 0.28f), Offset(0.20f, 0.78f), Offset(0.84f, 0.86f))
            "kanban" -> listOf(Offset(0.85f, 0.12f), Offset(0.15f, 0.34f), Offset(0.76f, 0.72f), Offset(0.18f, 0.90f))
            "photos" -> listOf(Offset(0.22f, 0.10f), Offset(0.82f, 0.48f), Offset(0.12f, 0.68f), Offset(0.88f, 0.88f))
            "render" -> listOf(Offset(0.78f, 0.18f), Offset(0.18f, 0.22f), Offset(0.82f, 0.76f), Offset(0.24f, 0.88f))
            "editors" -> listOf(Offset(0.16f, 0.20f), Offset(0.90f, 0.38f), Offset(0.32f, 0.84f), Offset(0.76f, 0.92f))
            "analytics" -> listOf(Offset(0.84f, 0.14f), Offset(0.20f, 0.40f), Offset(0.78f, 0.82f), Offset(0.14f, 0.86f))
            else -> listOf(Offset(0.18f, 0.15f), Offset(0.84f, 0.32f), Offset(0.22f, 0.80f), Offset(0.82f, 0.88f))
        }
    }

    val x0 = remember { Animatable(targetAnchors[0].x) }
    val y0 = remember { Animatable(targetAnchors[0].y) }
    val x1 = remember { Animatable(targetAnchors[1].x) }
    val y1 = remember { Animatable(targetAnchors[1].y) }
    val x2 = remember { Animatable(targetAnchors[2].x) }
    val y2 = remember { Animatable(targetAnchors[2].y) }
    val x3 = remember { Animatable(targetAnchors[3].x) }
    val y3 = remember { Animatable(targetAnchors[3].y) }

    LaunchedEffect(targetAnchors) {
        val spec = tween<Float>(durationMillis = 850, easing = FastOutSlowInEasing)
        launch { x0.animateTo(targetAnchors[0].x, spec) }
        launch { y0.animateTo(targetAnchors[0].y, spec) }
        launch { x1.animateTo(targetAnchors[1].x, spec) }
        launch { y1.animateTo(targetAnchors[1].y, spec) }
        launch { x2.animateTo(targetAnchors[2].x, spec) }
        launch { y2.animateTo(targetAnchors[2].y, spec) }
        launch { x3.animateTo(targetAnchors[3].x, spec) }
        launch { y3.animateTo(targetAnchors[3].y, spec) }
    }

    val infinite = rememberInfiniteTransition(label = "auroraDrift")
    val drift by infinite.animateFloat(
        initialValue = -0.025f,
        targetValue = 0.025f,
        animationSpec = infiniteRepeatable(tween(4200, easing = FastOutSlowInEasing), RepeatMode.Reverse),
        label = "drift"
    )

    Box(modifier = modifier.fillMaxSize().background(LiquidGlassCanvasBrush)) {
        Canvas(modifier = Modifier.fillMaxSize()) {
            val w = size.width
            val h = size.height
            val rLarge = maxOf(w, h) * 0.56f
            val rMed = maxOf(w, h) * 0.48f

            val c0 = Offset((x0.value + drift) * w, (y0.value - drift * 0.5f) * h)
            drawCircle(
                brush = Brush.radialGradient(
                    colors = listOf(Color(0xFFC7D2FE).copy(alpha = 0.16f), Color.Transparent),
                    center = c0,
                    radius = rLarge
                ),
                radius = rLarge,
                center = c0
            )

            val c1 = Offset((x1.value - drift) * w, (y1.value + drift * 0.6f) * h)
            drawCircle(
                brush = Brush.radialGradient(
                    colors = listOf(Color(0xFFC4B5FD).copy(alpha = 0.25f), Color.Transparent),
                    center = c1,
                    radius = rMed
                ),
                radius = rMed,
                center = c1
            )

            val c2 = Offset((x2.value + drift * 0.8f) * w, (y2.value + drift) * h)
            drawCircle(
                brush = Brush.radialGradient(
                    colors = listOf(Color(0xFF6EE7B7).copy(alpha = 0.24f), Color.Transparent),
                    center = c2,
                    radius = rLarge
                ),
                radius = rLarge,
                center = c2
            )

            val c3 = Offset((x3.value - drift * 0.7f) * w, (y3.value - drift) * h)
            drawCircle(
                brush = Brush.radialGradient(
                    colors = listOf(Color(0xFFFBCFE8).copy(alpha = 0.22f), Color.Transparent),
                    center = c3,
                    radius = rMed
                ),
                radius = rMed,
                center = c3
            )
        }
        content()
    }
}

/**
 * Translucent milky-white Liquid Glass card with specular top-left highlight rim
 * and soft indigo-tinted elevation shadow.
 */
fun Modifier.liquidGlassCard(
    cornerRadius: Dp = 18.dp,
    borderColor: Color = Color(0xFFDCE5F2),
    borderWidth: Dp = 1.dp,
    alpha: Float = 0.78f
): Modifier {
    val shape = RoundedCornerShape(cornerRadius)
    return this
        .shadow(
            elevation = 8.dp,
            shape = shape,
            ambientColor = Color(0x160F172A),
            spotColor = Color(0x1A4F46E5)
        )
        .clip(shape)
        .background(
            Brush.verticalGradient(
                colors = listOf(
                    Color.White.copy(alpha = (alpha + 0.12f).coerceAtMost(0.95f)),
                    Color(0xFFF8FAFC).copy(alpha = alpha)
                )
            )
        )
        .border(
            width = borderWidth,
            brush = Brush.linearGradient(
                colors = listOf(
                    Color.White.copy(alpha = 0.96f),
                    borderColor.copy(alpha = 0.72f)
                )
            ),
            shape = shape
        )
}

/**
 * Bouncy spring press physics inspired by Filely's Press.kt & Motion.kt:
 * swells/dips under the finger, blooms a soft radial touch highlight,
 * and jiggles with an elastic spring on release + haptic tick.
 */
fun Modifier.liquidBouncyClick(
    enabled: Boolean = true,
    pressScale: Float = 0.955f,
    enableHaptics: Boolean = true,
    onClick: () -> Unit
): Modifier = composed {
    if (!enabled) return@composed this
    val scope = rememberCoroutineScope()
    val haptics = LocalHapticFeedback.current
    val scale = remember { Animatable(1f) }
    var touchOffset by remember { mutableStateOf(Offset.Unspecified) }
    val glowAlpha = remember { Animatable(0f) }

    this
        .graphicsLayer {
            scaleX = scale.value
            scaleY = scale.value
        }
        .drawWithContent {
            drawContent()
            if (touchOffset != Offset.Unspecified && glowAlpha.value > 0.01f) {
                val radius = maxOf(size.width, size.height) * 0.65f
                drawCircle(
                    brush = Brush.radialGradient(
                        colors = listOf(
                            Color.White.copy(alpha = 0.42f * glowAlpha.value),
                            Color(0xFF818CF8).copy(alpha = 0.12f * glowAlpha.value),
                            Color.Transparent
                        ),
                        center = touchOffset,
                        radius = radius
                    ),
                    radius = radius,
                    center = touchOffset
                )
            }
        }
        .pointerInput(onClick, enableHaptics, pressScale) {
            detectTapGestures(
                onPress = { offset ->
                    touchOffset = offset
                    scope.launch {
                        scale.animateTo(
                            targetValue = pressScale,
                            animationSpec = spring(dampingRatio = 0.62f, stiffness = 620f)
                        )
                    }
                    scope.launch {
                        glowAlpha.animateTo(1f, tween(110))
                    }
                    val released = tryAwaitRelease()
                    scope.launch {
                        scale.animateTo(
                            targetValue = 1f,
                            animationSpec = spring(
                                dampingRatio = Spring.DampingRatioMediumBouncy,
                                stiffness = 360f
                            )
                        )
                    }
                    scope.launch {
                        glowAlpha.animateTo(0f, tween(260))
                    }
                    if (released && enableHaptics) {
                        haptics.performHapticFeedback(HapticFeedbackType.TextHandleMove)
                    }
                },
                onTap = { onClick() }
            )
        }
}
