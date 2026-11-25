package com.onetap.studiotracker.ui.components

import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.onetap.studiotracker.data.models.SafarCampaign
import com.onetap.studiotracker.data.models.Stage
import com.onetap.studiotracker.ui.theme.ColorAlJameaDone
import com.onetap.studiotracker.ui.theme.ColorEditingPending
import com.onetap.studiotracker.ui.theme.ColorInProgress
import com.onetap.studiotracker.ui.theme.ColorUploadPending
import com.onetap.studiotracker.ui.theme.ColorUploaded

@Composable
fun MultiStageProgressBar(
    campaign: SafarCampaign,
    modifier: Modifier = Modifier,
    height: Dp = 10.dp
) {
    val total = campaign.tasks.size
    if (total == 0) {
        Box(
            modifier = modifier
                .fillMaxWidth()
                .height(height)
                .clip(RoundedCornerShape(height / 2))
                .background(Color(0xFF334155))
        )
        return
    }

    val editingPendingWeight = campaign.countForStage(Stage.EDITING_PENDING).toFloat() / total
    val inProgressWeight = campaign.countForStage(Stage.IN_PROGRESS).toFloat() / total
    val uploadPendingWeight = campaign.countForStage(Stage.UPLOAD_PENDING).toFloat() / total
    val uploadedWeight = campaign.countForStage(Stage.UPLOADED).toFloat() / total
    val alJameaWeight = campaign.countForStage(Stage.ALJAMEA_DONE).toFloat() / total

    val animatedEditing by animateFloatAsState(targetValue = editingPendingWeight, tween(500), label = "editing")
    val animatedProgress by animateFloatAsState(targetValue = inProgressWeight, tween(500), label = "progress")
    val animatedUploadPending by animateFloatAsState(targetValue = uploadPendingWeight, tween(500), label = "uploadPending")
    val animatedUploaded by animateFloatAsState(targetValue = uploadedWeight, tween(500), label = "uploaded")
    val animatedAlJamea by animateFloatAsState(targetValue = alJameaWeight, tween(500), label = "alJamea")

    Row(
        modifier = modifier
            .fillMaxWidth()
            .height(height)
            .clip(RoundedCornerShape(height / 2))
            .background(Color(0xFFF1F5F9))
    ) {
        if (animatedEditing > 0f) {
            Box(
                modifier = Modifier
                    .weight(animatedEditing)
                    .fillMaxHeight()
                    .background(ColorEditingPending)
            )
        }
        if (animatedProgress > 0f) {
            Box(
                modifier = Modifier
                    .weight(animatedProgress)
                    .fillMaxHeight()
                    .background(ColorInProgress)
            )
        }
        if (animatedUploadPending > 0f) {
            Box(
                modifier = Modifier
                    .weight(animatedUploadPending)
                    .fillMaxHeight()
                    .background(ColorUploadPending)
            )
        }
        if (animatedUploaded > 0f) {
            Box(
                modifier = Modifier
                    .weight(animatedUploaded)
                    .fillMaxHeight()
                    .background(ColorUploaded)
            )
        }
        if (animatedAlJamea > 0f) {
            Box(
                modifier = Modifier
                    .weight(animatedAlJamea)
                    .fillMaxHeight()
                    .background(ColorAlJameaDone)
            )
        }
    }
}
