package com.onetap.studiotracker.ui.components

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.Spring
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.spring
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.draw.scale
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.onetap.studiotracker.R
import com.onetap.studiotracker.ui.theme.EmeraldDark
import com.onetap.studiotracker.ui.theme.EmeraldSoft
import com.onetap.studiotracker.ui.theme.EmeraldSuccess
import com.onetap.studiotracker.ui.theme.IndigoPrimary
import com.onetap.studiotracker.ui.theme.IndigoSoft
import com.onetap.studiotracker.ui.theme.LightBorder
import com.onetap.studiotracker.ui.theme.LightSurface
import com.onetap.studiotracker.ui.theme.LiquidAuroraBackground
import com.onetap.studiotracker.ui.theme.TextMuted
import com.onetap.studiotracker.ui.theme.TextPrimary
import com.onetap.studiotracker.ui.theme.TextSecondary
import com.onetap.studiotracker.ui.theme.liquidGlassCard
import kotlinx.coroutines.launch

@Composable
fun StartupScreen(
    statusText: String = "Connecting to Real-Time Cloud…",
    isRealtimeConnected: Boolean = false
) {
    val scale = remember { Animatable(0.84f) }
    val alpha = remember { Animatable(0f) }

    LaunchedEffect(Unit) {
        launch {
            scale.animateTo(
                targetValue = 1f,
                animationSpec = spring(
                    dampingRatio = Spring.DampingRatioMediumBouncy,
                    stiffness = 280f
                )
            )
        }
        launch {
            alpha.animateTo(1f, animationSpec = tween(420))
        }
    }

    val infinite = rememberInfiniteTransition(label = "startupLiquid")
    val pulseAlpha by infinite.animateFloat(
        initialValue = 0.45f,
        targetValue = 1f,
        animationSpec = infiniteRepeatable(tween(900), RepeatMode.Reverse),
        label = "pulseAlpha"
    )
    val haloScale by infinite.animateFloat(
        initialValue = 0.94f,
        targetValue = 1.10f,
        animationSpec = infiniteRepeatable(tween(1700, easing = FastOutSlowInEasing), RepeatMode.Reverse),
        label = "haloScale"
    )
    val ringRotation by infinite.animateFloat(
        initialValue = 0f,
        targetValue = 360f,
        animationSpec = infiniteRepeatable(tween(4600, easing = LinearEasing), RepeatMode.Restart),
        label = "ringRotation"
    )
    val pillSlide by infinite.animateFloat(
        initialValue = 0f,
        targetValue = 1f,
        animationSpec = infiniteRepeatable(tween(1300, easing = FastOutSlowInEasing), RepeatMode.Reverse),
        label = "pillSlide"
    )

    LiquidAuroraBackground(route = "startup") {
        Box(
            modifier = Modifier.fillMaxSize(),
            contentAlignment = Alignment.Center
        ) {
            Column(
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(20.dp),
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 28.dp)
                    .scale(scale.value)
                    .alpha(alpha.value)
                    .liquidGlassCard(
                        cornerRadius = 32.dp,
                        borderColor = Color.White.copy(alpha = 0.95f),
                        borderWidth = 1.5.dp,
                        alpha = 0.76f
                    )
                    .padding(horizontal = 24.dp, vertical = 34.dp)
            ) {
                // Morphing glass halo + rotating prism ring + app icon
                Box(contentAlignment = Alignment.Center) {
                    Box(
                        modifier = Modifier
                            .size(122.dp)
                            .scale(haloScale)
                            .clip(CircleShape)
                            .background(
                                Brush.radialGradient(
                                    colors = listOf(IndigoPrimary.copy(alpha = 0.18f), Color.Transparent)
                                )
                            )
                    )
                    Box(
                        modifier = Modifier
                            .size(100.dp)
                            .rotate(ringRotation)
                            .clip(RoundedCornerShape(30.dp))
                            .border(
                                width = 2.dp,
                                brush = Brush.sweepGradient(
                                    colors = listOf(
                                        IndigoPrimary.copy(alpha = 0.65f),
                                        Color(0xFF06B6D4).copy(alpha = 0.45f),
                                        Color(0xFF10B981).copy(alpha = 0.55f),
                                        Color.White.copy(alpha = 0.25f),
                                        IndigoPrimary.copy(alpha = 0.65f)
                                    )
                                ),
                                shape = RoundedCornerShape(30.dp)
                            )
                    )
                    Box(
                        modifier = Modifier
                            .size(84.dp)
                            .clip(RoundedCornerShape(24.dp))
                            .background(Color.White.copy(alpha = 0.94f))
                            .border(1.5.dp, LightBorder, RoundedCornerShape(24.dp))
                            .padding(14.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        Image(
                            painter = painterResource(id = R.drawable.ic_launcher_logo),
                            contentDescription = "One Tap Logo",
                            modifier = Modifier.fillMaxSize()
                        )
                    }
                }

                Column(
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.spacedBy(4.dp)
                ) {
                    Text(
                        text = "One Tap Studio",
                        color = TextPrimary,
                        fontSize = 26.sp,
                        fontWeight = FontWeight.ExtraBold,
                        letterSpacing = (-0.5).sp
                    )
                    Text(
                        text = "SAFAR PRODUCTION TRACKER",
                        color = IndigoPrimary,
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold,
                        letterSpacing = 1.4.sp
                    )
                }

                // Liquid glass sliding pill loader
                Box(
                    modifier = Modifier
                        .width(204.dp)
                        .height(8.dp)
                        .clip(CircleShape)
                        .background(IndigoSoft.copy(alpha = 0.85f))
                        .border(0.75.dp, Color.White.copy(alpha = 0.9f), CircleShape)
                        .padding(1.5.dp)
                ) {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth(0.42f)
                            .height(5.dp)
                            .padding(start = (pillSlide * 114).dp)
                            .clip(CircleShape)
                            .background(
                                Brush.horizontalGradient(
                                    colors = listOf(IndigoPrimary, Color(0xFF06B6D4))
                                )
                            )
                    )
                }

                Row(
                    modifier = Modifier
                        .clip(CircleShape)
                        .background(if (isRealtimeConnected) EmeraldSoft else LightSurface.copy(alpha = 0.88f))
                        .border(
                            1.dp,
                            if (isRealtimeConnected) EmeraldSuccess.copy(alpha = 0.45f) else LightBorder,
                            CircleShape
                        )
                        .padding(horizontal = 14.dp, vertical = 8.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Box(
                        modifier = Modifier
                            .size(8.dp)
                            .clip(CircleShape)
                            .background(
                                if (isRealtimeConnected) EmeraldSuccess
                                else IndigoPrimary.copy(alpha = pulseAlpha)
                            )
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(
                        text = statusText,
                        color = if (isRealtimeConnected) EmeraldDark else TextSecondary,
                        fontSize = 12.sp,
                        fontWeight = FontWeight.SemiBold
                    )
                }

                Text(
                    text = "Desktop Nexus  •  Cloud Sync  •  Batch Render",
                    color = TextMuted,
                    fontSize = 10.sp,
                    fontWeight = FontWeight.Medium,
                    letterSpacing = 0.4.sp
                )
            }
        }
    }
}
